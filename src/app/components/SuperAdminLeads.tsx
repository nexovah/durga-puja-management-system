import { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Inbox, MoreVertical, Trash2, Archive, ArchiveRestore, Save } from 'lucide-react';
import {
  Lead,
  LeadStatus,
  listLeadsRequest,
  updateLeadRequest,
  archiveLeadRequest,
  unarchiveLeadRequest,
  deleteLeadRequest,
} from '../lib/superAdminDb';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';

// Rows land here automatically from the public landing page's "Bring your
// committee online" form (LandingPage.tsx's handleSubmit -> api/leads/create.js).
// Status/remarks/archive/delete all go through SECURITY DEFINER RPCs — see
// supabase/099_leads_status_and_management.sql.
const STATUS_LABELS: Record<LeadStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  converted: 'Converted',
  rejected: 'Rejected',
};

const STATUS_PILL_CLASS: Record<LeadStatus, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  converted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  rejected: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export function SuperAdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Lead | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const load = async () => {
    try {
      setLeads(await listLeadsRequest());
    } catch (err: any) {
      setError(err?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLeads = leads.filter(lead => {
    if (Boolean(lead.archivedAt) !== showArchived) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [lead.committeeName, lead.contactName, lead.phone, lead.email]
        .some(v => v !== undefined && v !== null && String(v).toLowerCase().includes(q));
      if (!inText) return false;
    }
    const f = appliedFilters;
    if (f.dateFrom && new Date(lead.createdAt).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(lead.createdAt).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    setError('');
    try {
      if (archiveTarget.archivedAt) await unarchiveLeadRequest(archiveTarget.id);
      else await archiveLeadRequest(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to update lead');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError('');
    try {
      await deleteLeadRequest(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete lead');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Leads</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(s => !s)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showArchived
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-700 dark:text-orange-400'
                : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {showArchived ? 'Showing archived' : 'Show archived'}
          </button>
          <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
        </div>
      </div>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search by committee, contact, phone or email"
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredLeads.length}
          totalCount={leads.length}
          showDateRange
        />
      </CollapsibleSearchPanel>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12 flex flex-col items-center gap-2">
          <Inbox className="w-8 h-8 opacity-50" />
          {leads.length === 0
            ? 'No leads yet — submissions from the landing page\'s "Bring your committee online" form will show up here.'
            : showArchived
              ? 'No archived leads.'
              : 'No leads match your search.'}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Committee</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium">Phone</th>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Submitted</th>
                <th className="text-right px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredLeads.map(lead => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  onClick={() => setViewing(lead)}
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{lead.committeeName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{lead.contactName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{lead.phone}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{lead.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL_CLASS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(lead.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block" ref={openMenuId === lead.id ? menuRef : undefined}>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(o => (o === lead.id ? null : lead.id)); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === lead.id && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30"
                        >
                          <button
                            onClick={() => { setOpenMenuId(null); setViewing(lead); }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            View details
                          </button>
                          <button
                            onClick={() => { setOpenMenuId(null); setArchiveTarget(lead); }}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            {lead.archivedAt ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            {lead.archivedAt ? 'Unarchive' : 'Archive'}
                          </button>
                          <button
                            onClick={() => { setOpenMenuId(null); setDeleteTarget(lead); }}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadDetailModal
        lead={viewing}
        onClose={() => setViewing(null)}
        onSaved={updated => { setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l))); setViewing(updated); }}
      />

      <SuperAdminConfirmModal
        open={!!archiveTarget}
        danger={false}
        title={archiveTarget?.archivedAt ? 'Unarchive lead' : 'Archive lead'}
        message={
          archiveTarget
            ? archiveTarget.archivedAt
              ? `"${archiveTarget.committeeName}" will move back to the main leads list.`
              : `"${archiveTarget.committeeName}" will be hidden from the main leads list. You can unarchive it anytime.`
            : ''
        }
        confirmLabel={busy ? 'Working…' : archiveTarget?.archivedAt ? 'Unarchive' : 'Archive'}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
      />

      <SuperAdminConfirmModal
        open={!!deleteTarget}
        danger
        title="Delete lead"
        message={deleteTarget ? `"${deleteTarget.committeeName}" will be permanently deleted. This cannot be undone.` : ''}
        confirmLabel={busy ? 'Deleting…' : 'Delete'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        title={`Copy ${label}`}
        className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function LeadDetailModal({ lead, onClose, onSaved }: { lead: Lead | null; onClose: () => void; onSaved: (updated: Lead) => void }) {
  const [status, setStatus] = useState<LeadStatus>('pending');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setRemarks(lead.remarks);
      setError('');
    }
  }, [lead]);

  if (!lead) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateLeadRequest(lead.id, status, remarks);
      onSaved(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Lead details</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <CopyableField label="Committee name" value={lead.committeeName} />
          <CopyableField label="Contact name" value={lead.contactName} />
          <CopyableField label="Phone" value={lead.phone} />
          {lead.email && <CopyableField label="Email" value={lead.email} />}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Submitted</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{new Date(lead.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as LeadStatus)} className={inputClass}>
              {(Object.keys(STATUS_LABELS) as LeadStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Remarks</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className={inputClass}
              placeholder="Notes from follow-up calls, why rejected, etc."
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors font-medium"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
