import { useEffect, useState } from 'react';
import { Image as ImageIcon, X, Plus, Inbox, ArrowLeft, Send, Inbox as OpenIcon, CheckCircle2 } from 'lucide-react';
import { PageHeading } from './PageHeading';
import {
  SupportTicket, SupportTicketReply, listMyTicketsRequest, createTicketRequest, uploadTicketImage,
  fetchTicketReplies, postTicketReplyRequest,
} from '../lib/db';
import { User } from '../App';

interface HelpSupportPageProps {
  currentUser: User | null;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

type Tab = 'open' | 'resolved';
type View = 'list' | 'create' | { ticket: SupportTicket };

// Full page (was HelpSupportModal.tsx) — a modal's fixed height made a
// growing ticket list and a full reply thread cramped. Left-nav tab shell
// matches Settings.tsx's own pattern (Open Tickets / Resolved Tickets);
// selecting a ticket opens its thread in place of the list, with a small
// thumbnail attachment per message that opens a lightbox on click instead
// of embedding the full-size image inline.
export function HelpSupportPage({ currentUser }: HelpSupportPageProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('open');
  const [view, setView] = useState<View>('list');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    listMyTicketsRequest()
      .then(setTickets)
      .catch(err => setError(err?.message || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const openTickets = tickets.filter(t => t.status !== 'resolved');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');
  const visibleTickets = tab === 'open' ? openTickets : resolvedTickets;

  const selectedTicket = typeof view === 'object' ? tickets.find(t => t.id === view.ticket.id) || view.ticket : null;

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          view === 'list' && (
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
            >
              <Plus size={20} /> Post a New Query
            </button>
          )
        }
      >
        Help & Support
      </PageHeading>

      {view === 'list' && (
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
                Open Tickets
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

          <div className="flex-1 min-w-0 space-y-3">
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">Loading…</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400 text-center py-12">{error}</p>
            ) : visibleTickets.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-sm">{tab === 'open' ? "You don't have any open tickets." : "No resolved tickets yet."}</p>
              </div>
            ) : (
              visibleTickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => setView({ ticket })}
                  className="w-full text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 tracking-wide mb-0.5">{ticket.ticketCode}</p>
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">{ticket.title}</h4>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{new Date(ticket.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{ticket.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {view === 'create' && (
        <CreateTicketForm
          currentUser={currentUser}
          onCancel={() => setView('list')}
          onCreated={() => { setView('list'); reload(); }}
        />
      )}

      {selectedTicket && (
        <TicketThread
          ticket={selectedTicket}
          currentUser={currentUser}
          onBack={() => setView('list')}
          onOpenImage={setLightboxUrl}
          onTicketRepliedOrChanged={reload}
        />
      )}

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

function CreateTicketForm({ currentUser, onCancel, onCreated }: { currentUser: User | null; onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !currentUser) return;
    setSubmitting(true);
    setError('');
    try {
      let imageUrl: string | undefined;
      if (imageFile) imageUrl = await uploadTicketImage(imageFile);
      await createTicketRequest({
        userId: currentUser.id,
        username: currentUser.username,
        userName: currentUser.name,
        title: title.trim(),
        body: body.trim(),
        imageUrl,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">New Support Request</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Submitted by</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{currentUser?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title *</label>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            placeholder="What's this about?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description *</label>
          <textarea
            required
            rows={5}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
            placeholder="Describe your issue in detail…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attach a screenshot (optional)</label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img src={imagePreview} alt="Attachment preview" className="h-28 rounded-lg border border-gray-200 dark:border-gray-700" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(''); }}
                className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:border-orange-400 w-fit">
              <ImageIcon size={16} /> Choose image
              <input type="file" accept="image/*" onChange={handlePickImage} className="hidden" />
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// Attachment thumbnail — small by default, opens the shared Lightbox on
// click instead of ever rendering full-size inline (the behavior explicitly
// asked for, contrasted with the reference screenshot's inline images).
function AttachmentThumb({ url, onOpen }: { url: string; onOpen: (url: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="mt-2 block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors"
    >
      <img src={url} alt="Attachment" className="w-full h-full object-cover" />
    </button>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute top-5 right-5 text-white hover:text-gray-300">
        <X size={28} />
      </button>
      <img src={url} alt="Attachment" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
    </div>
  );
}

function TicketThread({
  ticket, currentUser, onBack, onOpenImage, onTicketRepliedOrChanged,
}: {
  ticket: SupportTicket;
  currentUser: User | null;
  onBack: () => void;
  onOpenImage: (url: string) => void;
  onTicketRepliedOrChanged: () => void;
}) {
  const [replies, setReplies] = useState<SupportTicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replyImageFile, setReplyImageFile] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadReplies = () => {
    setLoading(true);
    fetchTicketReplies(ticket.id)
      .then(setReplies)
      .catch(err => setError(err?.message || 'Failed to load replies'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReplies(); }, [ticket.id]);

  const handlePickReplyImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImageFile(file);
    setReplyImagePreview(URL.createObjectURL(file));
  };

  const handleSendReply = async () => {
    if (!replyBody.trim() || !currentUser) return;
    setSending(true);
    setError('');
    try {
      let imageUrl: string | undefined;
      if (replyImageFile) imageUrl = await uploadTicketImage(replyImageFile);
      await postTicketReplyRequest({
        ticketId: ticket.id,
        ownerUserId: currentUser.id,
        senderUserId: currentUser.id,
        senderName: currentUser.name,
        body: replyBody.trim(),
        imageUrl,
      });
      setReplyBody('');
      setReplyImageFile(null);
      setReplyImagePreview('');
      loadReplies();
      onTicketRepliedOrChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to send reply — please try again.');
    } finally {
      setSending(false);
    }
  };

  const canReply = ticket.status !== 'resolved';

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
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 max-h-[28rem] overflow-y-auto">
        {/* Original message */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{currentUser?.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{ticket.body}</p>
          {ticket.imageUrl && <AttachmentThumb url={ticket.imageUrl} onOpen={onOpenImage} />}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Loading replies…</p>
        ) : (
          replies.map(reply => (
            <div
              key={reply.id}
              className={`rounded-lg p-3.5 ${reply.senderRole === 'admin' ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {reply.senderName}{reply.senderRole === 'admin' && <span className="ml-1.5 text-xs font-normal text-orange-600 dark:text-orange-400">(Support)</span>}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(reply.createdAt).toLocaleString()}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{reply.body}</p>
              {reply.imageUrl && <AttachmentThumb url={reply.imageUrl} onOpen={onOpenImage} />}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 p-4 sm:p-5">
        {canReply ? (
          <div className="space-y-2.5">
            <textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
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
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
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
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">This ticket is resolved — you can't reply to it anymore.</p>
        )}
      </div>
    </div>
  );
}
