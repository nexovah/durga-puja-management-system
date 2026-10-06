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
      <div className="w-[min(100%-2rem,52rem)] mx-auto px-0 py-10 sm:py-14">
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
          <article className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-600 mb-3">{page.navLabel}</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-8">{page.metaTitle || page.navLabel}</h1>
            <div className="space-y-4 text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed">
              <MarkdownBody body={page.body} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
