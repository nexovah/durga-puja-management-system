import { useEffect, useState } from 'react';
import { Image as ImageIcon, X, Plus, Inbox } from 'lucide-react';
import { FormModal, FormModalCancelButton } from './FormModal';
import { SupportTicket, listMyTicketsRequest, createTicketRequest, uploadTicketImage } from '../lib/db';
import { User } from '../App';

interface HelpSupportModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User | null;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

// Same feature as the mobile app's Help & Support screen — submit a ticket
// (title, body, optional screenshot) to the shared `support_tickets` table;
// view your own past tickets, read-only, with status. Web equivalent of
// mobile/src/screens/HelpSupportScreen.tsx + HelpSupportFormScreen.tsx,
// collapsed into one modal since desktop has the room for it.
export function HelpSupportModal({ open, onClose, currentUser }: HelpSupportModalProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = () => {
    setLoading(true);
    listMyTicketsRequest()
      .then(setTickets)
      .catch(err => setError(err?.message || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      reload();
      setShowForm(false);
    }
  }, [open]);

  const resetForm = () => {
    setTitle('');
    setBody('');
    setImageFile(null);
    setImagePreview('');
    setError('');
  };

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
      resetForm();
      setShowForm(false);
      reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      title={showForm ? 'New Support Request' : 'Help & Support'}
      onClose={onClose}
      footer={
        showForm ? (
          <>
            <button
              type="submit"
              form="help-support-form"
              disabled={submitting}
              className="flex-1 sm:flex-none px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <FormModalCancelButton onClick={() => { resetForm(); setShowForm(false); }} label="Cancel" />
          </>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
          >
            <Plus size={18} /> Post a New Query
          </button>
        )
      }
    >
      {showForm ? (
        <form id="help-support-form" onSubmit={handleSubmit} className="space-y-4">
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
        </form>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-8">{error}</p>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">You haven't submitted any support requests yet.</p>
            </div>
          ) : (
            tickets.map(ticket => (
              <div key={ticket.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200">{ticket.title}</h4>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ticket.status]}`}>
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{new Date(ticket.createdAt).toLocaleString()}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{ticket.body}</p>
                {ticket.imageUrl && (
                  <img src={ticket.imageUrl} alt="Attachment" className="mt-3 max-h-40 rounded-lg border border-gray-200 dark:border-gray-700" />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </FormModal>
  );
}
