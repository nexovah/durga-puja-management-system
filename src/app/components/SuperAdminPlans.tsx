import { useEffect, useRef, useState } from 'react';
import { Plus, Archive, Pencil, Save, X } from 'lucide-react';
import {
  SubscriptionPlanAdmin,
  PlanFormInput,
  listPlansAdminRequest,
  createPlanRequest,
  updatePlanRequest,
  archivePlanRequest,
} from '../lib/superAdminDb';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';

const EMPTY_FORM: PlanFormInput = { name: '', description: '', durationMonths: 1, amountPaise: 0, currency: 'INR', features: '', displayOrder: 0 };

const formatAmount = (paise: number, currency: string) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency });

const durationLabel = (months: number) => {
  if (months === 1) return '1 month';
  if (months === 12) return '1 year';
  if (months % 12 === 0) return `${months / 12} years`;
  return `${months} months`;
};

// /super-admin/plans/<id> or /super-admin/plans/new — see
// docs/URL_STATE_CONVENTION.md.
function getEditingIdFromPath(): string | null {
  const parts = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/');
  return parts[0] === 'plans' && parts[1] ? parts[1] : null;
}

export function SuperAdminPlans() {
  const [plans, setPlans] = useState<SubscriptionPlanAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingIdState] = useState<string | null>(null); // null = not editing, 'new' = creating
  const [form, setForm] = useState<PlanFormInput>(EMPTY_FORM);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const openedFromUrl = useRef(false);

  const [archiveTarget, setArchiveTarget] = useState<SubscriptionPlanAdmin | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await listPlansAdminRequest();
      setPlans(loaded);
      if (!openedFromUrl.current) {
        openedFromUrl.current = true;
        const urlId = getEditingIdFromPath();
        if (urlId === 'new') startCreate(loaded.length);
        else if (urlId) {
          const match = loaded.find(p => p.id === urlId);
          if (match) startEdit(match);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onPopState = () => {
      const urlId = getEditingIdFromPath();
      if (!urlId) { setEditingIdState(null); return; }
      if (urlId === 'new') { startCreate(plans.length); return; }
      const match = plans.find(p => p.id === urlId);
      if (match) startEdit(match);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const startCreate = (displayOrder: number) => {
    setForm({ ...EMPTY_FORM, displayOrder });
    setFormActive(true);
    setEditingIdState('new');
    window.history.pushState(null, '', '/super-admin/plans/new');
  };

  const startEdit = (plan: SubscriptionPlanAdmin) => {
    setForm({
      name: plan.name,
      description: plan.description,
      durationMonths: plan.durationMonths,
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      features: plan.features,
      displayOrder: plan.displayOrder,
    });
    setFormActive(plan.isActive);
    setEditingIdState(plan.id);
    window.history.pushState(null, '', `/super-admin/plans/${plan.id}`);
  };

  const backToList = () => {
    setEditingIdState(null);
    window.history.pushState(null, '', '/super-admin/plans');
  };

  const cancelEdit = () => {
    backToList();
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.durationMonths <= 0 || form.amountPaise < 0) return;
    setSaving(true);
    setError('');
    try {
      if (editingId === 'new') {
        await createPlanRequest(form);
      } else if (editingId) {
        await updatePlanRequest(editingId, form, formActive);
      }
      backToList();
      setPlans(await listPlansAdminRequest());
    } catch (err: any) {
      setError(err?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    setError('');
    try {
      await archivePlanRequest(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive plan');
    } finally {
      setArchiving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Subscription Plans</h1>
        <button
          onClick={() => startCreate(plans.length)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New plan
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {editingId && (
        <form onSubmit={handleSave} className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Plan name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Quarterly Plan" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Duration (months)</label>
              <input
                type="number"
                min={1}
                value={form.durationMonths}
                onChange={e => setForm({ ...form, durationMonths: parseInt(e.target.value, 10) || 1 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amountPaise / 100}
                onChange={e => setForm({ ...form, amountPaise: Math.round(parseFloat(e.target.value || '0') * 100) })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value, 10) || 0 })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Shown under the plan name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Features (one per line)</label>
            <textarea
              rows={4}
              value={form.features}
              onChange={e => setForm({ ...form, features: e.target.value })}
              className={`${inputClass} font-mono`}
              placeholder={'Unlimited members & users\nAll collection modules\nPriority support'}
            />
          </div>
          {editingId !== 'new' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
              <select value={formActive ? 'active' : 'archived'} onChange={e => setFormActive(e.target.value === 'active')} className={`${inputClass} w-auto`}>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-medium transition"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save plan'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">No plans yet.</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium">Price</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {plans.map(plan => (
                <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className={`px-4 py-3 font-medium ${plan.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{plan.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{durationLabel(plan.durationMonths)}</td>
                  <td className="px-4 py-3 font-medium">{formatAmount(plan.amountPaise, plan.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      plan.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {plan.isActive ? 'active' : 'archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(plan)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {plan.isActive && (
                        <button
                          onClick={() => setArchiveTarget(plan)}
                          title="Archive"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SuperAdminConfirmModal
        open={!!archiveTarget}
        danger={false}
        title="Archive plan"
        message={
          archiveTarget
            ? `"${archiveTarget.name}" will stop appearing on the landing page, tenant Billing pages, and manual-grant buttons. Existing subscriptions already using this plan are unaffected. You can re-activate it anytime by editing it.`
            : ''
        }
        confirmLabel={archiving ? 'Archiving…' : 'Archive'}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
