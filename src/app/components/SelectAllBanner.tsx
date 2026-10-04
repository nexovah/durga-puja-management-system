import { useLanguage } from '../i18n/LanguageContext';

interface SelectAllBannerProps {
  // How many rows on the CURRENT page are selected.
  pageSelectedCount: number;
  // How many rows total are selected across every page.
  totalSelectedCount: number;
  // How many rows match the current search/filter in total (across all pages).
  totalFilteredCount: number;
  onSelectAllFiltered: () => void;
  onClear: () => void;
}

// Gmail/Jira-style secondary prompt — shown once every row on the current
// page is selected, offering to extend that selection to every row
// matching the current filter (not just this page). Pagination-aware
// callers pass `totalFilteredCount` from their own filtered/sorted list
// (the same list they hand to `usePagination`) so this never needs its
// own data fetch.
export function SelectAllBanner({
  pageSelectedCount, totalSelectedCount, totalFilteredCount, onSelectAllFiltered, onClear,
}: SelectAllBannerProps) {
  const { t } = useLanguage();

  if (pageSelectedCount === 0) return null;
  const allFilteredSelected = totalSelectedCount >= totalFilteredCount;
  // Nothing more to offer — the whole filtered set already fits on one page.
  if (!allFilteredSelected && totalFilteredCount <= pageSelectedCount) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 bg-orange-50 dark:bg-orange-500/10 border-b border-orange-200 dark:border-orange-500/20 text-sm">
      {allFilteredSelected ? (
        <span className="font-medium text-orange-700 dark:text-orange-400">
          {t('table.selectAllBanner.allSelected').replace('{total}', String(totalFilteredCount))}
        </span>
      ) : (
        <>
          <span className="text-gray-600 dark:text-gray-400">
            {t('table.selectAllBanner.pageSelected').replace('{count}', String(pageSelectedCount))}
          </span>
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400 hover:underline"
          >
            {t('table.selectAllBanner.selectAll').replace('{total}', String(totalFilteredCount))}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
      >
        {t('table.selectAllBanner.clear')}
      </button>
    </div>
  );
}
