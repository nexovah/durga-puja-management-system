import { useEffect, useState } from 'react';
import { Plus, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Tenant, listTenantsRequest, createTenantRequest, generatePassword } from '../lib/superAdminDb';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function subscriptionBadge(tenant: Tenant) {
  if (!tenant.subscriptionExpiresAt) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">no plan</span>;
  }
  const expired = new Date(tenant.subscriptionExpiresAt).getTime() < Date.now();
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      expired ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    }`}>
      {expired ? 'expired' : 'active'}
    </span>
  );
}

interface SuperAdminTenantsProps {
  onOpenTenant: (tenant: Tenant) => void;
  refreshToken?: number; // bump to force a re-fetch (e.g. after returning from the detail page)
}

export function SuperAdminTenants({ onOpenTenant, refreshToken }: SuperAdminTenantsProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState(() => generatePassword());
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTenants(await listTenantsRequest());
    } catch (err: any) {
      setError(err?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim() || !adminName.trim() || !adminUsername.trim() || !adminPassword) return;
    setCreating(true);
    setError('');
    try {
      await createTenantRequest(newName.trim(), newSlug.trim(), adminName.trim(), adminUsername.trim(), adminPassword);
      setNewName('');
      setNewSlug('');
      setSlugEdited(false);
      setAdminName('');
      setAdminUsername('');
      setAdminPassword(generatePassword());
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tenants</h1>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New tenant
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Committee name</label>
              <input
                value={newName}
                onChange={e => {
                  const v = e.target.value;
                  setNewName(v);
                  if (!slugEdited) setNewSlug(slugify(v));
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Slug (auto-filled, editable)</label>
              <input
                value={newSlug}
                onChange={e => { setNewSlug(e.target.value); setSlugEdited(true); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
            First admin login for this committee
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Password (auto-generated)</label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full pl-3 pr-16 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAdminPassword(generatePassword())}
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
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-medium transition"
          >
            {creating ? 'Creating…' : 'Create tenant'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : tenants.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">No tenants yet.</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Slug</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Subscription</th>
                <th className="text-left px-4 py-2.5 font-medium">Expires</th>
                <th className="text-left px-4 py-2.5 font-medium">Users</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tenants.map(tenant => (
                <tr
                  key={tenant.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  onClick={() => onOpenTenant(tenant)}
                >
                  <td className={`px-4 py-3 font-medium ${
                    tenant.status === 'disabled' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {tenant.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{tenant.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tenant.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{subscriptionBadge(tenant)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {tenant.userCount}{tenant.maxUsers !== null ? ` / ${tenant.maxUsers}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
