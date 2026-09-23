import { useEffect, useState } from 'react';
import { X, Copy, Check, Inbox } from 'lucide-react';
import { Lead, listLeadsRequest } from '../lib/superAdminDb';

// Read-only view of the `leads` table — rows land here automatically from
// the public landing page's "Bring your committee online" form
// (LandingPage.tsx's handleSubmit -> supabase.from('leads').insert(...)).
// No edit/delete here; this is purely for Super Admin to see and follow up.
export function SuperAdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Lead | null>(null);

  useEffect(() => {
    listLeadsRequest()
      .then(setLeads)
      .catch(err => setError(err?.message || 'Failed to load leads'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Leads</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12 flex flex-col items-center gap-2">
          <Inbox className="w-8 h-8 opacity-50" />
          No leads yet — submissions from the landing page's "Bring your committee online" form will show up here.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Committee</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium">Phone</th>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium">Submitted</th>
                <th className="text-right px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leads.map(lead => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  onClick={() => setViewing(lead)}
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{lead.committeeName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{lead.contactName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{lead.phone}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{lead.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(lead.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setViewing(lead); }}
                      className="text-orange-600 dark:text-orange-400 hover:underline text-xs font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadDetailModal lead={viewing} onClose={() => setViewing(null)} />
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

function LeadDetailModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  if (!lead) return null;
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
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
