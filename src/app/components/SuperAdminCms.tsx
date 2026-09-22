import { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { CmsPage, listCmsPagesRequest, upsertCmsPageRequest } from '../lib/superAdminDb';
import { uploadLogo } from '../lib/db';

// /super-admin/cms/<slug> — see docs/URL_STATE_CONVENTION.md.
function getSlugFromPath(): string | null {
  const parts = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/');
  return parts[0] === 'cms' && parts[1] ? parts[1] : null;
}

export function SuperAdminCms() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeSlug, setActiveSlugState] = useState<string | null>(() => getSlugFromPath());
  const [form, setForm] = useState<CmsPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const setActiveSlug = (slug: string) => {
    setActiveSlugState(slug);
    window.history.pushState(null, '', `/super-admin/cms/${slug}`);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const loaded = await listCmsPagesRequest();
      setPages(loaded);
      const wantedSlug = activeSlug || getSlugFromPath() || loaded[0]?.slug || null;
      if (wantedSlug) {
        setActiveSlugState(wantedSlug);
        const match = loaded.find(p => p.slug === wantedSlug) || loaded[0];
        if (match) {
          setForm(match);
          if (window.location.pathname !== `/super-admin/cms/${match.slug}`) {
            window.history.replaceState(null, '', `/super-admin/cms/${match.slug}`);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load CMS pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPopState = () => {
      const slug = getSlugFromPath();
      setActiveSlugState(slug);
      const match = pages.find(p => p.slug === slug);
      if (match) setForm(match);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [pages]);

  const selectPage = (page: CmsPage) => {
    setActiveSlug(page.slug);
    setForm(page);
    setMessage('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await upsertCmsPageRequest(form);
      setForm(updated);
      setPages(prev => prev.map(p => (p.slug === updated.slug ? updated : p)));
      setMessage('Saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">CMS</h1>

      {error && !form && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-6">
          <nav className="sm:w-56 shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex sm:flex-col gap-1 overflow-x-auto">
              {pages.map(page => (
                <button
                  key={page.slug}
                  onClick={() => selectPage(page)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeSlug === page.slug
                      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                      : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <FileText size={18} />
                  {page.navLabel}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            {form && (
              <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {form.slug === 'home'
                    ? "SEO metadata for the public landing page (/). Page copy (hero, features, footer) isn't editable here yet."
                    : `Content for the public /${form.slug} page, linked from the landing page footer.`}
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meta Title</label>
                  <input
                    type="text"
                    value={form.metaTitle}
                    onChange={e => setForm({ ...form, metaTitle: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meta Description</label>
                  <textarea
                    rows={3}
                    value={form.metaDescription}
                    onChange={e => setForm({ ...form, metaDescription: e.target.value })}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{form.metaDescription.length} characters (150–160 recommended)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">OG Image (social share preview)</label>
                  <div className="flex items-center gap-3">
                    {form.ogImageUrl && (
                      <img src={form.ogImageUrl} alt="OG preview" className="w-16 h-10 rounded object-cover border border-gray-200 dark:border-gray-700" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file || !form) return;
                        try {
                          const url = await uploadLogo(file);
                          setForm({ ...form, ogImageUrl: url });
                        } catch (err: any) {
                          setError(err?.message || 'Failed to upload image');
                        }
                      }}
                      className={inputClass}
                    />
                  </div>
                </div>

                {form.slug !== 'home' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Page content</label>
                    <textarea
                      rows={14}
                      value={form.body}
                      onChange={e => setForm({ ...form, body: e.target.value })}
                      placeholder="Blank line = new paragraph."
                      className={`${inputClass} font-mono text-sm`}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Published</label>
                  <select
                    value={form.isPublished ? 'yes' : 'no'}
                    onChange={e => setForm({ ...form, isPublished: e.target.value === 'yes' })}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
                >
                  <Save size={20} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
