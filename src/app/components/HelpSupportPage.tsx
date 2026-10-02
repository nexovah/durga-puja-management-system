import { useEffect, useState } from 'react';
import { Image as ImageIcon, X, Plus, Inbox, ArrowLeft, Send, Inbox as OpenIcon, CheckCircle2, Reply, MessageSquare } from 'lucide-react';
import { PageHeading } from './PageHeading';
import {
  SupportTicket, SupportTicketReply, TicketActivity, listMyTicketsRequest, createTicketRequest, uploadTicketImage,
  fetchTicketReplies, postTicketReplyRequest, fetchMyTicketActivity, markTicketRead,
} from '../lib/db';
import { User } from '../App';
import { useLanguage } from '../i18n/LanguageContext';

interface HelpSupportPageProps {
  currentUser: User | null;
  committeeName?: string;
  onUnreadChange?: (hasUnread: boolean) => void;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};

type Tab = 'open' | 'resolved';
type View = 'list' | 'create' | { ticket: SupportTicket };

export function HelpSupportPage({ currentUser, committeeName, onUnreadChange }: HelpSupportPageProps) {
  const { t, locale } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activity, setActivity] = useState<Record<string, TicketActivity>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('open');
  const [view, setView] = useState<View>(() => {
    const path = window.location.pathname;
    if (path === '/help-support/new' || path === '/help-support/create') return 'create';
    const match = path.match(/^\/help-support\/([^/]+)$/);
    if (match && match[1] && match[1] !== 'new' && match[1] !== 'create') {
      return { ticket: { id: match[1] } as SupportTicket };
    }
    return 'list';
  });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleGoToCreate = () => {
    if (window.location.pathname !== '/help-support/new') {
      window.history.pushState(null, '', '/help-support/new');
    }
    setView('create');
  };

  const handleOpenTicket = (ticket: SupportTicket) => {
    if (window.location.pathname !== `/help-support/${ticket.id}`) {
      window.history.pushState(null, '', `/help-support/${ticket.id}`);
    }
    setView({ ticket });
    if (currentUser) {
      markTicketRead(ticket.id, currentUser.id)
        .then(reloadActivity)
        .catch(() => {});
    }
  };

  const handleBackToList = () => {
    if (window.location.pathname !== '/help-support') {
      window.history.pushState(null, '', '/help-support');
    }
    setView('list');
  };

  // Handle browser back and forward button
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      if (path === '/help-support/new' || path === '/help-support/create') {
        setView('create');
      } else {
        const match = path.match(/^\/help-support\/([^/]+)$/);
        if (match && match[1] && match[1] !== 'new' && match[1] !== 'create') {
          const ticketId = match[1];
          const found = tickets.find(t => t.id === ticketId);
          setView({ ticket: found || ({ id: ticketId } as SupportTicket) });
        } else {
          setView('list');
        }
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tickets]);

  // When tickets load, resolve any partial ticket from URL
  useEffect(() => {
    if (typeof view === 'object' && tickets.length > 0) {
      const full = tickets.find(t => t.id === view.ticket.id);
      if (full && (!view.ticket.title || view.ticket !== full)) {
        setView({ ticket: full });
      }
    }
  }, [tickets]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return t('helpSupport.status.open');
      case 'in_progress': return t('helpSupport.status.in_progress');
      case 'resolved': return t('helpSupport.status.resolved');
      default: return status;
    }
  };

  const reloadActivity = () => {
    fetchMyTicketActivity()
      .then(rows => {
        const map: Record<string, TicketActivity> = {};
        rows.forEach(row => { map[row.ticketId] = row; });
        setActivity(map);
        onUnreadChange?.(rows.some(r => r.hasUnreadAdminReply));
      })
      .catch(() => {});
  };

  const reload = () => {
    setLoading(true);
    listMyTicketsRequest()
      .then(setTickets)
      .catch(err => setError(err?.message || t('helpSupport.loadError')))
      .finally(() => setLoading(false));
    reloadActivity();
  };

  useEffect(() => { reload(); }, []);

  const openTickets = tickets.filter(t => t.status !== 'resolved');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');
  const visibleTickets = tab === 'open' ? openTickets : resolvedTickets;

  const selectedTicket = typeof view === 'object' ? tickets.find(t => t.id === view.ticket.id) || (view.ticket.title ? view.ticket : null) : null;

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          view === 'list' && (
            <button
              onClick={handleGoToCreate}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
            >
              <Plus size={20} /> {t('helpSupport.postQuery')}
            </button>
          )
        }
      >
        {t('helpSupport.title')}
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
                {t('helpSupport.openTickets')}
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
                {t('helpSupport.resolvedTickets')}
                {resolvedTickets.length > 0 && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{resolvedTickets.length}</span>}
              </button>
            </div>
          </nav>

          <div className="flex-1 min-w-0 space-y-3">
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">{t('helpSupport.loading')}</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400 text-center py-12">{error}</p>
            ) : visibleTickets.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="text-sm">{tab === 'open' ? t('helpSupport.noOpenTickets') : t('helpSupport.noResolvedTickets')}</p>
              </div>
            ) : (
              visibleTickets.map(ticket => {
                const act = activity[ticket.id];
                return (
                  <button
                    key={ticket.id}
                    onClick={() => handleOpenTicket(ticket)}
                    className={`w-full text-left bg-white dark:bg-gray-900 rounded-xl border p-4 transition-colors ${
                      act?.hasUnreadAdminReply
                        ? 'border-orange-300 dark:border-orange-500/50 hover:border-orange-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 tracking-wide mb-0.5">{ticket.ticketCode}</p>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200">{ticket.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!!act?.replyCount && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <MessageSquare size={13} /> {act.replyCount}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ticket.status]}`}>
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>
                    </div>
                    {act?.hasUnreadAdminReply && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        {t('helpSupport.newReplyFromSupport')}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">{ticket.body}</p>
                    <TicketMetaFooter date={ticket.createdAt} name={ticket.userName} email={ticket.userEmail} committeeName={ticket.committeeName} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {view === 'create' && (
        <div className="space-y-4">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            <ArrowLeft size={16} /> {t('helpSupport.thread.back')}
          </button>
          <CreateTicketForm
            currentUser={currentUser}
            committeeName={committeeName}
            onCancel={handleBackToList}
            onCreated={() => { handleBackToList(); reload(); }}
          />
        </div>
      )}

      {selectedTicket && (
        <TicketThread
          ticket={selectedTicket}
          currentUser={currentUser}
          onBack={handleBackToList}
          onOpenImage={setLightboxUrl}
          onTicketRepliedOrChanged={reload}
        />
      )}

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

function CreateTicketForm({ currentUser, committeeName, onCancel, onCreated }: { currentUser: User | null; committeeName?: string; onCancel: () => void; onCreated: () => void }) {
  const { t, locale } = useLanguage();
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
        userEmail: currentUser.email,
        committeeName,
        title: title.trim(),
        body: body.trim(),
        imageUrl,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || t('helpSupport.create.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">{t('helpSupport.create.title')}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('helpSupport.create.submittedBy')}</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{currentUser?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('helpSupport.create.date')}</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{new Date().toLocaleDateString(locale)}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('helpSupport.create.ticketTitle')}</label>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            placeholder={t('helpSupport.create.titlePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('helpSupport.create.description')}</label>
          <textarea
            required
            rows={5}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
            placeholder={t('helpSupport.create.descPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('helpSupport.create.attachScreenshot')}</label>
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
              <ImageIcon size={16} /> {t('helpSupport.create.chooseImage')}
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
            {submitting ? t('helpSupport.create.submitting') : t('helpSupport.create.submit')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

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

function TicketMetaFooter({
  date, name, email, committeeName,
}: {
  date: string;
  name: string;
  email?: string | null;
  committeeName?: string | null;
}) {
  const { t, locale } = useLanguage();
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-400 dark:text-gray-500">
      <span>{new Date(date).toLocaleString(locale)}</span>
      <span>•</span>
      <span>{t('helpSupport.postedBy')} {name}{email ? ` (${email})` : ''}</span>
      {committeeName && (
        <>
          <span>•</span>
          <span>{committeeName}</span>
        </>
      )}
    </div>
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
  const { t, locale } = useLanguage();
  const [replies, setReplies] = useState<SupportTicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replyImageFile, setReplyImageFile] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return t('helpSupport.status.open');
      case 'in_progress': return t('helpSupport.status.in_progress');
      case 'resolved': return t('helpSupport.status.resolved');
      default: return status;
    }
  };

  const loadReplies = () => {
    setLoading(true);
    fetchTicketReplies(ticket.id)
      .then(setReplies)
      .catch(err => setError(err?.message || t('helpSupport.thread.loadRepliesFailed')))
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
        senderEmail: currentUser.email,
        body: replyBody.trim(),
        imageUrl,
      });
      setReplyBody('');
      setReplyImageFile(null);
      setReplyImagePreview('');
      loadReplies();
      onTicketRepliedOrChanged();
    } catch (err: any) {
      setError(err?.message || t('helpSupport.thread.failedReply'));
    } finally {
      setSending(false);
    }
  };

  const canReply = ticket.status !== 'resolved';

  return (
    <div className="max-w-3xl bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 mb-3">
          <ArrowLeft size={16} /> {t('helpSupport.thread.back')}
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 tracking-wide mb-0.5">{ticket.ticketCode}</p>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{ticket.title}</h3>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[ticket.status]}`}>
            {getStatusLabel(ticket.status)}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 max-h-[28rem] overflow-y-auto">
        {/* Original message */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ticket.userName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(ticket.createdAt).toLocaleString(locale)}</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{ticket.body}</p>
          {ticket.imageUrl && <AttachmentThumb url={ticket.imageUrl} onOpen={onOpenImage} />}
          <TicketMetaFooter date={ticket.createdAt} name={ticket.userName} email={ticket.userEmail} committeeName={ticket.committeeName} />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t('helpSupport.thread.loadingReplies')}</p>
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
                  {reply.senderRole === 'admin' && <span className="text-xs font-normal text-orange-600 dark:text-orange-400">{t('helpSupport.thread.supportBadge')}</span>}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(reply.createdAt).toLocaleString(locale)}</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{reply.body}</p>
              {reply.imageUrl && <AttachmentThumb url={reply.imageUrl} onOpen={onOpenImage} />}
              <TicketMetaFooter
                date={reply.createdAt}
                name={reply.senderName}
                email={reply.senderEmail}
                committeeName={reply.senderRole === 'admin' ? null : ticket.committeeName}
              />
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
              placeholder={t('helpSupport.thread.replyPlaceholder')}
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
                <ImageIcon size={14} /> {t('helpSupport.thread.attach')}
                <input type="file" accept="image/*" onChange={handlePickReplyImage} className="hidden" />
              </label>
              <button
                onClick={handleSendReply}
                disabled={sending || !replyBody.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                <Send size={14} /> {sending ? t('helpSupport.thread.sending') : t('helpSupport.thread.reply')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('helpSupport.thread.resolvedNotice')}</p>
        )}
      </div>
    </div>
  );
}
