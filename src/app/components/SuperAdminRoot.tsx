import { useState } from 'react';
import { SuperAdminLogin } from './SuperAdminLogin';
import { SuperAdminLayout, SuperAdminPage } from './SuperAdminLayout';
import { SuperAdminTenants } from './SuperAdminPanel';
import { SuperAdminTenantDetail } from './SuperAdminTenantDetail';
import { SuperAdminSettings } from './SuperAdminSettings';
import { superAdminLoginRequest, SuperAdmin, Tenant } from '../lib/superAdminDb';
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
  const [page, setPage] = useState<SuperAdminPage>('tenants');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantsRefreshToken, setTenantsRefreshToken] = useState(0);

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

  if (!admin) {
    return <SuperAdminLogin onLogin={handleLogin} />;
  }

  return (
    <SuperAdminLayout
      adminName={admin.name}
      page={page}
      onNavigate={p => { setPage(p); setSelectedTenant(null); }}
      onLogout={handleLogout}
    >
      {page === 'tenants' && (
        selectedTenant ? (
          <SuperAdminTenantDetail
            tenant={selectedTenant}
            onBack={() => { setSelectedTenant(null); setTenantsRefreshToken(t => t + 1); }}
            onSaved={updated => setSelectedTenant(updated)}
            onDeleted={() => { setSelectedTenant(null); setTenantsRefreshToken(t => t + 1); }}
          />
        ) : (
          <SuperAdminTenants onOpenTenant={setSelectedTenant} refreshToken={tenantsRefreshToken} />
        )
      )}
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
