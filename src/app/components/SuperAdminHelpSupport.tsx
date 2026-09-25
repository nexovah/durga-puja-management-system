import { useEffect, useState } from 'react';
import { Inbox, Image as ImageIcon, Send, Reply, ArrowLeft, Inbox as OpenIcon, CheckCircle2, X } from 'lucide-react';
import {
  SupportTicket, SupportTicketReply, TicketStatus, listSupportTicketsRequest, setTicketStatusRequest,
  fetchSuperAdminTicketReplies, postSuperAdminTicketReply, uploadSuperAdminTicketReplyImage,
} from '../lib/superAdminDb';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};
const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

type Tab = 'open' | 'resolved';

// Read/status-update/reply view of support_tickets — rows land here from
// the tenant web app's Help & Support page and the mobile app's Help &
// Support screen alike (same table, same RPC, see supabase/059_support_tickets.sql).
// List + independent detail page (not a modal), same shell as the tenant
// side's HelpSupportPage.tsx — Open/Resolved left nav, click a ticket to
// open its thread in place of the list.
export function SuperAdminHelpSupport({ adminName }: { adminName: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('open');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const reload = () => {
    listSupportTicketsRequest()
      .then(setTickets)
      .catch(err => setError(err?.message || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const viewing = viewingId ? tickets.find(t => t.id === viewingId) || null : null;

  const handleStatusChange = async (ticket: SupportTicket, status: TicketStatus) => {
    setUpdating(true);
    setError('');
    try {
      await setTicketStatusRequest(ticket.id, status);
      setTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, status } : t)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const openTickets = tickets.filter(t => t.status !== 'resolved');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');
  const tabTickets = tab === 'open' ? openTickets : resolvedTickets;

  const filtered = tabTickets.filter(t => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !t.ticketCode.toLowerCase().includes(q) && !t.tenantName.toLowerCase().includes(q)) return false;
    const f = appliedFilters;
    if (f.status && t.status !== f.status) return false;
    if (f.dateFrom && new Date(t.createdAt).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(t.createdAt).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  if (viewing) {
    return (
      <TicketDetailPage
        ticket={viewing}
        adminName={adminName}
        updating={updating}
        onStatusChange={status => handleStatusChange(viewing, status)}
        onBack={() => setViewingId(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Help & Support</h1>
        <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
      </div>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search by Ticket ID or Tenant"
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filtered.length}
          totalCount={tabTickets.length}
          statusOptions={[
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'resolved', label: 'Resolved' },
          ]}
          showDateRange
        />
      </CollapsibleSearchPanel>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-56 shrink-0 sm:sticky sm:top-20 sm:self-start">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex sm:flex-col gap-1 overflow-x-auto">
            <button
              onClick={() => setTab('open')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === 'open'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <OpenIcon size={18} />
              Ongoing Tickets
              {openTickets.length > 0 && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{openTickets.length}</span>}
            </button>
            <button
              onClick={() => setTab('resolved')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === 'resolved'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <CheckCircle2 size={18} />
              Resolved Tickets
              {resolvedTickets.length > 0 && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{resolvedTickets.length}</span>}
            </button>
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12 flex flex-col items-center gap-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <Inbox className="w-8 h-8 opacity-50" />
              {tabTickets.length === 0
                ? (tab === 'open' ? 'No ongoing tickets.' : 'No resolved tickets yet.')
                : 'No tickets match your search.'}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Ticket ID</th>
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
                      onClick={() => setViewingId(ticket.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-orange-600 dark:text-orange-400 font-semibold">{ticket.ticketCode}</td>
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
        </div>
      </div>
    </div>
  );
}

function TicketDetailPage({
  ticket, adminName, updating, onStatusChange, onBack,
}: {
  ticket: SupportTicket;
  adminName: string;
  updating: boolean;
  onStatusChange: (status: TicketStatus) => void;
  onBack: () => void;
}) {
  const [replies, setReplies] = useState<SupportTicketReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replyImageFile, setReplyImageFile] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');

  const loadReplies = () => {
    setLoadingReplies(true);
    fetchSuperAdminTicketReplies(ticket.id)
      .then(setReplies)
      .catch(err => setReplyError(err?.message || 'Failed to load replies'))
      .finally(() => setLoadingReplies(false));
  };

  useEffect(() => { loadReplies(); }, [ticket.id]);

  const handlePickReplyImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImageFile(file);
    setReplyImagePreview(URL.createObjectURL(file));
  };

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    setReplyError('');
    try {
      let imageUrl: string | undefined;
      if (replyImageFile) imageUrl = await uploadSuperAdminTicketReplyImage(replyImageFile);
      await postSuperAdminTicketReply({
        ticketId: ticket.id,
        senderName: adminName,
        body: replyBody.trim(),
        imageUrl,
      });
      setReplyBody('');
      setReplyImageFile(null);
      setReplyImagePreview('');
      loadReplies();
    } catch (err: any) {
      setReplyError(err?.message || 'Failed to send reply — please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 mb-3">
          <ArrowLeft size={16} /> Back to tickets
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 tracking-wide mb-0.5">{ticket.ticketCode}</p>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{ticket.title}</h3>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={ticket.status}
              disabled={updating}
              onChange={e => onStatusChange(e.target.value as TicketStatus)}
              className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Committee: <span className="font-medium text-gray-700 dark:text-gray-300">{ticket.tenantName}</span></p>
      </div>

      <div className="p-4 sm:p-5 space-y-4 max-h-[28rem] overflow-y-auto">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ticket.userName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.body}</p>
          {ticket.imageUrl && (
            <img src={ticket.imageUrl} alt="Attachment" className="mt-2 max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
          )}
          <TicketMetaFooter
            date={ticket.createdAt}
            name={`${ticket.userName} (@${ticket.username})`}
            email={ticket.userEmail}
            committeeName={ticket.tenantName || ticket.committeeName}
          />
        </div>

        {loadingReplies ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Loading replies…</p>
        ) : (
          replies.map(reply => (
            <div
              key={reply.id}
              className={`rounded-lg p-3.5 border ${reply.senderRole === 'admin' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' : 'bg-gray-50 dark:bg-gray-800/50 border-transparent'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  {reply.senderRole === 'admin' && <Reply size={13} className="text-orange-600 dark:text-orange-400" />}
                  {reply.senderName}
                  {reply.senderRole === 'admin' && <span className="text-xs font-normal text-orange-600 dark:text-orange-400">(Super Admin)</span>}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(reply.createdAt).toLocaleString()}</p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reply.body}</p>
              {reply.imageUrl && (
                <img src={reply.imageUrl} alt="Attachment" className="mt-2 max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
              )}
              <TicketMetaFooter
                date={reply.createdAt}
                name={reply.senderName}
                email={reply.senderEmail}
                committeeName={reply.senderRole === 'admin' ? null : ticket.tenantName}
              />
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 p-4 sm:p-5 space-y-2.5">
        <textarea
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          rows={3}
          placeholder="Reply as Support…"
          className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
        />
        {replyImagePreview && (
          <div className="relative inline-block">
            <img src={replyImagePreview} alt="Attachment preview" className="h-20 rounded-lg border border-gray-200 dark:border-gray-700" />
            <button
              type="button"
              onClick={() => { setReplyImageFile(null); setReplyImagePreview(''); }}
              className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1"
            >
              <X size={12} />
            </button>
          </div>
        )}
        {replyError && <p className="text-xs text-red-600 dark:text-red-400">{replyError}</p>}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:border-orange-400">
            <ImageIcon size={14} /> Attach
            <input type="file" accept="image/*" onChange={handlePickReplyImage} className="hidden" />
          </label>
          <button
            onClick={handleSendReply}
            disabled={sending || !replyBody.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            <Send size={14} /> {sending ? 'Sending…' : 'Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Footer identity strip shown under every message — date/time · posted by
// name (email) · committee — mirrors the tenant-side ticket footer, plus
// the committee name here since a Super Admin's view spans every tenant.
function TicketMetaFooter({
  date, name, email, committeeName,
}: {
  date: string;
  name: string;
  email?: string | null;
  committeeName?: string | null;
}) {
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-400 dark:text-gray-500">
      <span>{new Date(date).toLocaleString()}</span>
      <span>•</span>
      <span>Posted by {name}{email ? ` (${email})` : ''}</span>
      {committeeName && (
        <>
          <span>•</span>
          <span>{committeeName}</span>
        </>
      )}
    </div>
  );
}
