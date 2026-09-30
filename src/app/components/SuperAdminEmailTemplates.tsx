import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Eye, Code } from 'lucide-react';
import {
  EmailTemplate,
  listEmailTemplatesRequest,
  upsertEmailTemplateRequest,
  deleteEmailTemplateRequest,
} from '../lib/superAdminDb';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';

interface TemplateForm {
  slug: string;
  name: string;
  type: 'transactional' | 'campaign';
  status: 'active' | 'inactive';
  isDefault: boolean;
  previewText: string;
  subject: string;
  htmlBody: string;
}

const EMPTY_FORM: TemplateForm = {
  slug: '', name: '', type: 'transactional', status: 'active', isDefault: false, previewText: '', subject: '', htmlBody: '',
};

// /super-admin/emailTemplates/<id> or /super-admin/emailTemplates/new —
// see docs/URL_STATE_CONVENTION.md.
function getEditingIdFromPath(): string | null {
  const parts = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/');
  return parts[0] === 'emailTemplates' && parts[1] ? parts[1] : null;
}

export function SuperAdminEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingIdState] = useState<string | null>(null); // null = not editing, 'new' = creating
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const openedFromUrl = useRef(false);

  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await listEmailTemplatesRequest();
      setTemplates(loaded);
      if (!openedFromUrl.current) {
        openedFromUrl.current = true;
        const urlId = getEditingIdFromPath();
        if (urlId === 'new') startCreate();
        else if (urlId) {
          const match = loaded.find(t => t.id === urlId);
          if (match) startEdit(match);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onPopState = () => {
      const urlId = getEditingIdFromPath();
      if (!urlId) { setEditingIdState(null); return; }
      if (urlId === 'new') { startCreate(); return; }
      const match = templates.find(t => t.id === urlId);
      if (match) startEdit(match);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setShowPreview(false);
    setEditingIdState('new');
    window.history.pushState(null, '', '/super-admin/emailTemplates/new');
  };

  const startEdit = (template: EmailTemplate) => {
    setForm({
      slug: template.slug,
      name: template.name,
      type: template.type,
      status: template.status,
      isDefault: template.isDefault,
      previewText: template.previewText,
      subject: template.subject,
      htmlBody: template.htmlBody,
    });
    setShowPreview(false);
    setEditingIdState(template.id);
    window.history.pushState(null, '', `/super-admin/emailTemplates/${template.id}`);
  };

  const backToList = () => {
    setEditingIdState(null);
    window.history.pushState(null, '', '/super-admin/emailTemplates');
  };

  const cancelEdit = () => {
    backToList();
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.name.trim() || !form.subject.trim() || !form.htmlBody.trim()) return;
    setSaving(true);
    setError('');
    try {
      await upsertEmailTemplateRequest({
        id: editingId !== 'new' ? editingId! : undefined,
        slug: form.slug.trim(),
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        isDefault: form.isDefault,
        previewText: form.previewText,
        subject: form.subject,
        htmlBody: form.htmlBody,
      } as any);
      backToList();
      setTemplates(await listEmailTemplatesRequest());
    } catch (err: any) {
      setError(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await deleteEmailTemplateRequest(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email Templates</h1>
        <button
          onClick={startCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New template
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
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Password Reset" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Slug {editingId !== 'new' && <span className="text-gray-400">(locked after first save)</span>}
              </label>
              <input
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                disabled={editingId !== 'new'}
                className={`${inputClass} ${editingId !== 'new' ? 'opacity-60 cursor-not-allowed' : ''} font-mono`}
                placeholder="e.g. password_reset"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TemplateForm['type'] })} className={inputClass}>
                <option value="transactional">Transactional</option>
                <option value="campaign">Campaign</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TemplateForm['status'] })} className={inputClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
            Is Default
          </label>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Preview text</label>
            <input value={form.previewText} onChange={e => setForm({ ...form, previewText: e.target.value })} className={inputClass} placeholder="Shown in inbox preview" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputClass} placeholder="e.g. Reset your Durga CRM password" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400">HTML body</label>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700"
              >
                {showPreview ? <Code className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? 'Edit HTML' : 'Preview'}
              </button>
            </div>
            {showPreview ? (
              <iframe
                srcDoc={form.htmlBody}
                sandbox=""
                className="w-full h-64 rounded-lg border border-gray-300 dark:border-gray-700 bg-white"
                title="Template preview"
              />
            ) : (
              <textarea
                rows={12}
                value={form.htmlBody}
                onChange={e => setForm({ ...form, htmlBody: e.target.value })}
                className={`${inputClass} font-mono`}
                placeholder="<p>Hi {{name}}, ...</p>"
              />
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Use {'{{variable}}'} placeholders — substituted when the email is sent.</p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-medium transition"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save template'}
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
      ) : templates.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">No templates yet.</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Default</th>
                <th className="text-left px-4 py-2.5 font-medium">Updated</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {templates.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{t.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.isDefault ? 'Yes' : ''}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(t.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(t)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SuperAdminConfirmModal
        open={!!deleteTarget}
        danger
        title="Delete template"
        message={deleteTarget ? `"${deleteTarget.name}" will be permanently deleted. Any code referencing slug "${deleteTarget.slug}" will fail to send until it's recreated.` : ''}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
