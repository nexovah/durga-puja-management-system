import { useEffect, useState } from 'react';
import { SuperAdminLogin } from './SuperAdminLogin';
import { SuperAdminResetPassword } from './SuperAdminResetPassword';
import { SuperAdminLayout, SuperAdminPage } from './SuperAdminLayout';
import { SuperAdminTenants } from './SuperAdminPanel';
import { SuperAdminTenantDetail } from './SuperAdminTenantDetail';
import { SuperAdminSettings } from './SuperAdminSettings';
import { SuperAdminPlans } from './SuperAdminPlans';
import { SuperAdminOrders } from './SuperAdminOrders';
import { SuperAdminLeads } from './SuperAdminLeads';
import { SuperAdminHelpSupport } from './SuperAdminHelpSupport';
import { SuperAdminCms } from './SuperAdminCms';
import { superAdminLoginRequest, listTenantsRequest, SuperAdmin, Tenant } from '../lib/superAdminDb';
import { setTenantAccessToken } from '../lib/supabaseClient';

// Entirely separate from the committee app's session/auth (App.tsx) — its
// own localStorage key, its own token, mounted only at /super-admin so it
// never shares state with a logged-in committee user in the same tab.
const SESSION_KEY = 'puja-super-admin-session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day, matches the JWT's own expiry

interface StoredSuperAdminSession {
  admin: SuperAdmin;
  expiresAt: number;
}

const VALID_PAGES: SuperAdminPage[] = ['tenants', 'plans', 'orders', 'leads', 'support', 'cms', 'settings'];

// Same path-based routing idea as the committee app's PAGE_SLUGS
// (App.tsx) — /super-admin/<page> — so a refresh or a shared link lands
// back on the same menu instead of always resetting to Tenants.
function getPageFromPath(): SuperAdminPage {
  const segment = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/')[0];
  return (VALID_PAGES as string[]).includes(segment) ? (segment as SuperAdminPage) : 'tenants';
}

// /super-admin/tenants/<id> — the id segment after the page, if any.
function getTenantIdFromPath(): string | null {
  const parts = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/');
  return parts[0] === 'tenants' && parts[1] ? parts[1] : null;
}

function loadStoredSession(): SuperAdmin | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: StoredSuperAdminSession = JSON.parse(raw);
    if (!session.expiresAt || Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session.admin;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function SuperAdminRoot() {
  const [admin, setAdmin] = useState<SuperAdmin | null>(() => {
    const stored = loadStoredSession();
    if (stored) setTenantAccessToken(stored.accessToken);
    return stored;
  });
  const [page, setPageState] = useState<SuperAdminPage>(() => getPageFromPath());
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantDetailLoading, setTenantDetailLoading] = useState(() => getTenantIdFromPath() !== null);
  const [tenantsRefreshToken, setTenantsRefreshToken] = useState(0);
  // Bumped on every sidebar nav click (even to the already-active page) so
  // the rendered page component remounts and re-reads the URL from
  // scratch — otherwise clicking "Orders" while already inside an order's
  // detail view wouldn't reset that page's own internal selection state.
  const [navResetKey, setNavResetKey] = useState(0);

  const setPage = (p: SuperAdminPage) => {
    setPageState(p);
    const path = `/super-admin/${p}`;
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
  };

  const loadTenantFromUrl = async (id: string) => {
    setTenantDetailLoading(true);
    try {
      const all = await listTenantsRequest();
      setSelectedTenant(all.find(t => t.id === id) || null);
    } catch {
      setSelectedTenant(null);
    } finally {
      setTenantDetailLoading(false);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setPageState(getPageFromPath());
      const tenantId = getTenantIdFromPath();
      if (tenantId) loadTenantFromUrl(tenantId);
      else setSelectedTenant(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // On first mount: normalize an unrecognized bare path, and if the URL
  // already points at a specific tenant (e.g. a refresh mid-detail-view),
  // load it instead of dropping back to the list.
  useEffect(() => {
    const path = `/super-admin/${page}`;
    const tenantId = getTenantIdFromPath();
    if (tenantId) {
      loadTenantFromUrl(tenantId);
    } else if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    window.history.pushState(null, '', `/super-admin/tenants/${tenant.id}`);
  };

  const closeTenant = () => {
    setSelectedTenant(null);
    window.history.pushState(null, '', '/super-admin/tenants');
  };

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await superAdminLoginRequest(username, password);
      if (!result) return false;
      setAdmin(result);
      const session: StoredSuperAdminSession = { admin: result, expiresAt: Date.now() + SESSION_DURATION_MS };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    } catch (err) {
      console.error('Super admin login failed', err);
      return false;
    }
  };

  const handleLogout = () => {
    setAdmin(null);
    localStorage.removeItem(SESSION_KEY);
    setTenantAccessToken(null);
  };

  if (window.location.pathname === '/super-admin/reset-password') {
    return (
      <SuperAdminResetPassword
        onDone={() => { window.location.href = '/super-admin'; }}
      />
    );
  }

  if (!admin) {
    return <SuperAdminLogin onLogin={handleLogin} />;
  }

  return (
    <SuperAdminLayout
      adminName={admin.name}
      page={page}
      onNavigate={p => { setPage(p); setSelectedTenant(null); setNavResetKey(k => k + 1); }}
      onLogout={handleLogout}
    >
      {page === 'tenants' && (
        tenantDetailLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
        ) : selectedTenant ? (
          <SuperAdminTenantDetail
            tenant={selectedTenant}
            onBack={() => { closeTenant(); setTenantsRefreshToken(t => t + 1); }}
            onSaved={updated => setSelectedTenant(updated)}
            onDeleted={() => { closeTenant(); setTenantsRefreshToken(t => t + 1); }}
          />
        ) : (
          <SuperAdminTenants key={navResetKey} onOpenTenant={openTenant} refreshToken={tenantsRefreshToken} />
        )
      )}
      {page === 'plans' && <SuperAdminPlans key={navResetKey} />}
      {page === 'orders' && <SuperAdminOrders key={navResetKey} />}
      {page === 'leads' && <SuperAdminLeads key={navResetKey} />}
      {page === 'support' && <SuperAdminHelpSupport key={navResetKey} />}
      {page === 'cms' && <SuperAdminCms key={navResetKey} />}
      {page === 'settings' && (
        <SuperAdminSettings
          onNameChanged={name => {
            const updated = { ...admin, name };
            setAdmin(updated);
            const stored: StoredSuperAdminSession = { admin: updated, expiresAt: Date.now() + SESSION_DURATION_MS };
            localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
          }}
        />
      )}
    </SuperAdminLayout>
  );
}
