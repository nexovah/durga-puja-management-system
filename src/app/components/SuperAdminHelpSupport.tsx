import { useEffect, useState } from 'react';
import { X, Inbox } from 'lucide-react';
import { SupportTicket, TicketStatus, listSupportTicketsRequest, setTicketStatusRequest } from '../lib/superAdminDb';

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};
const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

// Read/status-update view of support_tickets — rows land here from the
// tenant web app's Help & Support modal and the mobile app's Help &
// Support screen alike (same table, same RPC, see supabase/059_support_tickets.sql).
export function SuperAdminHelpSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [viewing, setViewing] = useState<SupportTicket | null>(null);
  const [updating, setUpdating] = useState(false);

  const reload = () => {
    listSupportTicketsRequest()
      .then(setTickets)
      .catch(err => setError(err?.message || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const handleStatusChange = async (ticket: SupportTicket, status: TicketStatus) => {
    setUpdating(true);
    setError('');
    try {
      await setTicketStatusRequest(ticket.id, status);
      setTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, status } : t)));
      setViewing(prev => (prev && prev.id === ticket.id ? { ...prev, status } : prev));
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const filtered = tickets.filter(t => statusFilter === 'all' || t.status === statusFilter);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Help & Support</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12 flex flex-col items-center gap-2">
          <Inbox className="w-8 h-8 opacity-50" />
          No support requests yet.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Tenant</th>
                <th className="text-left px-4 py-2.5 font-medium">Submitted by</th>
                <th className="text-left px-4 py-2.5 font-medium">Title</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(ticket => (
                <tr
                  key={ticket.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                  onClick={() => setViewing(ticket)}
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{ticket.tenantName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{ticket.userName}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{ticket.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(ticket.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{viewing.title}</h3>
              <button onClick={() => setViewing(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tenant</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{viewing.tenantName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Submitted by</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{viewing.userName} (@{viewing.username})</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Submitted</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{new Date(viewing.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                  <select
                    value={viewing.status}
                    disabled={updating}
                    onChange={e => handleStatusChange(viewing, e.target.value as TicketStatus)}
                    className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewing.body}</p>
              </div>
              {viewing.imageUrl && (
                <img src={viewing.imageUrl} alt="Attachment" className="max-h-64 rounded-lg border border-gray-200 dark:border-gray-700" />
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewing(null)}
                className="w-full px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
