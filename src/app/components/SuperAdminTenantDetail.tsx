import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, UserCog, Users, Eye, EyeOff, RefreshCw, Power, Trash2, RotateCcw, Flame } from 'lucide-react';
import {
  Tenant,
  SubscriptionCredit,
  TenantAdmin,
  TenantUser,
  updateTenantRequest,
  setTenantStatusRequest,
  deleteTenantRequest,
  restoreTenantRequest,
  purgeTenantRequest,
  grantSubscriptionByPlanRequest,
  listPlansAdminRequest,
  SubscriptionPlanAdmin,
  listSubscriptionCreditsRequest,
  getTenantAdminRequest,
  updateTenantAdminRequest,
  createAdminForTenantRequest,
  listTenantUsersRequest,
  generatePassword,
  isPasswordStrong,
} from '../lib/superAdminDb';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';

interface SuperAdminTenantDetailProps {
  tenant: Tenant;
  onBack: () => void;
  onSaved: (tenant: Tenant) => void;
  onDeleted: () => void;
}

export function SuperAdminTenantDetail({ tenant, onBack, onSaved, onDeleted }: SuperAdminTenantDetailProps) {
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [phone, setPhone] = useState(tenant.phone);
  const [email, setEmail] = useState(tenant.email);
  const [address, setAddress] = useState(tenant.address);
  const [maxUsers, setMaxUsers] = useState(tenant.maxUsers === null ? '' : String(tenant.maxUsers));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [credits, setCredits] = useState<SubscriptionCredit[]>([]);
  const [granting, setGranting] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(tenant);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);

  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState(''); // empty = keep current password
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  // Only used when this tenant has zero app_users (older tenants created
  // before this flow existed) — lets Super Admin fix it in place instead of
  // deleting the tenant (which would wipe its real data).
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState(() => generatePassword());
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [users, setUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [plans, setPlans] = useState<SubscriptionPlanAdmin[]>([]);

  useEffect(() => {
    listSubscriptionCreditsRequest(tenant.id).then(setCredits).catch(() => {});
    listTenantUsersRequest(tenant.id).then(setUsers).catch(() => {}).finally(() => setUsersLoading(false));
    listPlansAdminRequest().then(p => setPlans(p.filter(pl => pl.isActive))).catch(() => {});
    getTenantAdminRequest(tenant.id).then(a => {
      setAdmin(a);
      if (a) {
        setAdminName(a.name);
        setAdminUsername(a.username);
      }
    }).catch(err => setError(err?.message || 'Failed to load admin login'));
  }, [tenant.id]);

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin) return;
    setAdminMessage('');
    setError('');
    if (adminPassword && !isPasswordStrong(adminPassword)) {
      setError('Password must be at least 8 characters and include a letter and a digit.');
      return;
    }
    setSavingAdmin(true);
    try {
      const updated = await updateTenantAdminRequest(admin.id, adminName.trim(), adminUsername.trim(), adminPassword || undefined);
      setAdmin(updated);
      setAdminPassword('');
      setAdminMessage(adminPassword ? 'Login updated — password reset.' : 'Login updated.');
      listTenantUsersRequest(tenant.id).then(setUsers).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Failed to update admin login');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const parsedMaxUsers = maxUsers.trim() === '' ? null : Math.max(0, parseInt(maxUsers, 10) || 0);
      const updated = await updateTenantRequest(tenant.id, name.trim(), slug.trim(), phone.trim(), email.trim(), address.trim(), parsedMaxUsers);
      const merged = { ...currentTenant, ...updated, userCount: currentTenant.userCount };
      setCurrentTenant(merged);
      onSaved(merged);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminUsername.trim() || !newAdminPassword) return;
    setError('');
    if (!isPasswordStrong(newAdminPassword)) {
      setError('Password must be at least 8 characters and include a letter and a digit.');
      return;
    }
    setCreatingAdmin(true);
    try {
      const created = await createAdminForTenantRequest(tenant.id, newAdminName.trim(), newAdminUsername.trim(), newAdminPassword);
      setAdmin(created);
      setAdminName(created.name);
      setAdminUsername(created.username);
      listTenantUsersRequest(tenant.id).then(setUsers).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Failed to create admin login');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleGrant = async (planId: string) => {
    setGranting(true);
    setError('');
    try {
      const updated = await grantSubscriptionByPlanRequest(tenant.id, planId);
      const merged = { ...currentTenant, ...updated };
      setCurrentTenant(merged);
      onSaved(merged);
      setCredits(await listSubscriptionCreditsRequest(tenant.id));
    } catch (err: any) {
      setError(err?.message || 'Failed to grant subscription');
    } finally {
      setGranting(false);
    }
  };

  const handleToggleStatus = async () => {
    setTogglingStatus(true);
    setError('');
    try {
      const updated = await setTenantStatusRequest(tenant.id, currentTenant.status === 'active' ? 'disabled' : 'active');
      const merged = { ...currentTenant, ...updated };
      setCurrentTenant(merged);
      onSaved(merged);
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTenantRequest(tenant.id);
      setDeleteOpen(false);
      const merged = { ...currentTenant, status: 'deleted' as const };
      setCurrentTenant(merged);
      onSaved(merged);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete tenant');
      setDeleteOpen(false);
    }
  };

  const [restoring, setRestoring] = useState(false);
  const handleRestore = async () => {
    setRestoring(true);
    setError('');
    try {
      const updated = await restoreTenantRequest(tenant.id);
      const merged = { ...currentTenant, ...updated };
      setCurrentTenant(merged);
      onSaved(merged);
    } catch (err: any) {
      setError(err?.message || 'Failed to restore tenant');
    } finally {
      setRestoring(false);
    }
  };

  const [purgeOpen, setPurgeOpen] = useState(false);
  const handlePurge = async () => {
    try {
      await purgeTenantRequest(tenant.id);
      setPurgeOpen(false);
      onDeleted();
    } catch (err: any) {
      setError(err?.message || 'Failed to purge tenant');
      setPurgeOpen(false);
    }
  };

  const expiresAt = currentTenant.subscriptionExpiresAt ? new Date(currentTenant.subscriptionExpiresAt) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : true;

  // Cancelled grants (see supabase/054_cancel_manual_grant.sql) no longer
  // count toward the active/expired plan match or the history list below.
  const activeCredits = credits.filter(c => !c.cancelledAt);

  // "Active"/"Expired" plan = the plan matching the most recent manual
  // grant (credits are already ordered newest-first by
  // super_admin_list_subscription_credits). Credit amounts are stored as
  // negative debits (see 023_tenant_details_and_subscriptions.sql) —
  // compare against the absolute value.
  const latestCredit = activeCredits[0];
  const grantedPlan = latestCredit
    ? plans.find(p => p.amountPaise === Math.abs(latestCredit.amountPaise)) ?? null
    : null;
  const activePlan = !isExpired ? grantedPlan : null;
  const activePlanId = activePlan?.id ?? null;
  const expiredPlanId = isExpired ? (grantedPlan?.id ?? null) : null;

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to tenants
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentTenant.name}</h1>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            currentTenant.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : currentTenant.status === 'deleted'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            {currentTenant.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentTenant.status === 'deleted' ? (
            <>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-sm font-medium transition"
              >
                <RotateCcw className="w-4 h-4" />
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
              <button
                onClick={() => setPurgeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition"
              >
                <Flame className="w-4 h-4" /> Purge permanently
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => (currentTenant.status === 'active' ? setDisableConfirmOpen(true) : handleToggleStatus())}
                disabled={togglingStatus}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-sm font-medium transition"
              >
                <Power className="w-4 h-4" />
                {currentTenant.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Committee name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Slug</label>
              <input
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              User limit ({currentTenant.userCount} user{currentTenant.userCount === 1 ? '' : 's'} currently)
            </label>
            <input
              type="number"
              min={0}
              value={maxUsers}
              onChange={e => setMaxUsers(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full sm:w-48 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-medium transition"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
          <UserCog className="w-4 h-4" /> Admin login
        </h4>
        {!admin ? (
          <form onSubmit={handleCreateAdmin} className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No admin login exists for this tenant yet — create one so they can log in.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Admin name</label>
                <input
                  value={newAdminName}
                  onChange={e => setNewAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <input
                  value={newAdminUsername}
                  onChange={e => setNewAdminUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Password (auto-generated)</label>
              <div className="relative">
                <input
                  type={showNewAdminPassword ? 'text' : 'password'}
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  className="w-full pl-3 pr-16 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNewAdminPassword(generatePassword())}
                    title="Generate new password"
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword(s => !s)}
                    title={showNewAdminPassword ? 'Hide' : 'Show'}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    {showNewAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingAdmin}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-medium transition"
            >
              {creatingAdmin ? 'Creating…' : 'Create admin login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSaveAdmin} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Admin name</label>
                <input
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <input
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Reset password (leave blank to keep current password)
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-16 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setAdminPassword(generatePassword()); setShowAdminPassword(true); }}
                    title="Generate new password"
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(s => !s)}
                    title={showAdminPassword ? 'Hide' : 'Show'}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            {adminMessage && <p className="text-sm text-green-600 dark:text-green-400">{adminMessage}</p>}
            <button
              type="submit"
              disabled={savingAdmin}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-medium transition"
            >
              {savingAdmin ? 'Saving…' : 'Save login'}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
          <Users className="w-4 h-4" /> Committee users ({users.length}{currentTenant.maxUsers !== null ? ` / ${currentTenant.maxUsers}` : ''})
        </h4>
        {usersLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-medium pb-2">Name</th>
                  <th className="text-left font-medium pb-2">Username</th>
                  <th className="text-left font-medium pb-2">Role</th>
                  <th className="text-left font-medium pb-2">Status</th>
                  <th className="text-left font-medium pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className={`py-2 font-medium ${u.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}`}>{u.name}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{u.username}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-400">{u.isAdmin ? 'Admin' : 'User'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {u.isActive ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" /> Subscription
        </h4>
        <p className="text-sm mb-3">
          {expiresAt ? (
            <>
              Expires <span className="font-medium">{expiresAt.toLocaleDateString()}</span>{' '}
              <span className={isExpired ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                ({isExpired ? 'expired' : 'active'})
              </span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">No subscription granted yet</span>
          )}
        </p>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-2">
          {plans.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No active plans — add one in Subscription Plans first.</p>
          ) : (
            plans.map(plan => {
              const isActivePlan = plan.id === activePlanId;
              const isExpiredPlan = plan.id === expiredPlanId;
              // A subscription is already running (any plan) — block every
              // Grant button until it expires, not just the matching one.
              const blockedByActiveSub = !isExpired && !!currentTenant.subscriptionExpiresAt && !isActivePlan;
              return (
                <button
                  key={plan.id}
                  onClick={() => handleGrant(plan.id)}
                  disabled={granting || (!isExpired && !!currentTenant.subscriptionExpiresAt)}
                  title={blockedByActiveSub && expiresAt ? `Already active until ${expiresAt.toLocaleDateString()}` : undefined}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    isActivePlan
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : isExpiredPlan
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  }`}
                >
                  {isActivePlan || isExpiredPlan ? plan.name : `Grant ${plan.name}`} ({(plan.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: plan.currency })})
                  {isActivePlan && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-500 text-white align-middle">Active</span>}
                  {isExpiredPlan && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white align-middle">Expired</span>}
                </button>
              );
            })
          )}
        </div>

        {activePlan && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {activePlan.name} is active for {currentTenant.name}
            {expiresAt && <> — membership active till <span className="font-medium">{expiresAt.toLocaleDateString()}</span></>}.
          </p>
        )}
        {isExpired && grantedPlan && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-4">
            {grantedPlan.name} expired for {currentTenant.name}
            {expiresAt && <> on <span className="font-medium">{expiresAt.toLocaleDateString()}</span></>}.
          </p>
        )}

        {activeCredits.length > 0 && (
          <div className="space-y-1.5">
            {activeCredits.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                <span>{c.note || c.period}</span>
                <span className="font-medium">{(c.amountPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                <span>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SuperAdminConfirmModal
        open={deleteOpen}
        danger
        title="Delete tenant"
        message={`${currentTenant.name}'s users will be locked out immediately. Their data is NOT wiped yet — you can Restore this tenant anytime, or Purge it permanently as a separate, deliberate step.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <SuperAdminConfirmModal
        open={purgeOpen}
        danger
        title="Purge tenant permanently"
        message={`This permanently wipes ALL of ${currentTenant.name}'s data — members, chanda, expenses, everything. This cannot be undone, and there is no further recovery step after this.`}
        confirmLabel="Purge permanently"
        onCancel={() => setPurgeOpen(false)}
        onConfirm={handlePurge}
      />

      <SuperAdminConfirmModal
        open={disableConfirmOpen}
        danger={false}
        title="Disable tenant"
        message={`${currentTenant.name}'s users will be locked out of their account immediately. Their data stays intact — you can re-enable anytime.`}
        confirmLabel="Disable"
        onCancel={() => setDisableConfirmOpen(false)}
        onConfirm={() => { setDisableConfirmOpen(false); handleToggleStatus(); }}
      />
    </div>
  );
}
