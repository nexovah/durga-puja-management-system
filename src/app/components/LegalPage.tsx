import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CmsPageContent, getCmsPageRequest } from '../lib/db';
import { MarkdownBody } from '../lib/markdown';

interface LegalPageProps {
  slug: string;
  onBack: () => void;
}

export function LegalPage({ slug, onBack }: LegalPageProps) {
  const [page, setPage] = useState<CmsPageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCmsPageRequest(slug).then(setPage).catch(() => setPage(null)).finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : !page ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Page not found.</p>
        ) : (
          <article className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{page.metaTitle || page.navLabel}</h1>
            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <MarkdownBody body={page.body} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
