import { useEffect, useState } from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Shared pagination state for any table: slices `items` into the current
// page, clamps `page` back in range whenever the list shrinks (delete) or
// `pageSize` changes, and resets to page 1 whenever the page size changes.
export function usePagination<T>(items: T[], defaultPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = items.slice(startIndex, endIndex);

  return { page, setPage, pageSize, setPageSize, pageItems, totalPages, totalItems, startIndex, endIndex };
}

// Up to 5 numbered page buttons around the current page, plus the last page
// (with an ellipsis) when it falls outside that window.
function getPageWindow(current: number, total: number, size = 5): { nums: number[]; showLastSeparately: boolean } {
  if (total <= size) return { nums: Array.from({ length: total }, (_, i) => i + 1), showLastSeparately: false };

  let start = Math.max(1, current - Math.floor(size / 2));
  let end = start + size - 1;
  if (end >= total) {
    end = total - 1;
    start = Math.max(1, end - size + 1);
  }
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);
  return { nums, showLastSeparately: true };
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  startIndex: number;
  endIndex: number;
}

export function Pagination({
  page, totalPages, onPageChange, pageSize, onPageSizeChange, totalItems, startIndex, endIndex,
}: PaginationProps) {
  const { t } = useLanguage();

  if (totalItems === 0) return null;

  const { nums, showLastSeparately } = getPageWindow(page, totalPages);

  const btnBase = 'min-w-[36px] h-9 px-2.5 flex items-center justify-center rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const btnIdle = 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200';
  const btnActive = 'bg-orange-600 text-white border-orange-600';

  return (
    <div className="px-4 sm:px-6 py-4 border-t border-gray-100 space-y-3">
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className={`${btnBase} ${btnIdle} gap-1 px-3`}
            aria-label={t('pagination.first')}
          >
            <ChevronsLeft size={15} />
            <span className="hidden xs:inline">{t('pagination.first')}</span>
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${btnBase} ${btnIdle} gap-1 px-3`}
            aria-label={t('pagination.back')}
          >
            <ChevronLeft size={15} />
            <span className="hidden xs:inline">{t('pagination.back')}</span>
          </button>

          {nums.map(n => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`${btnBase} ${n === page ? btnActive : btnIdle}`}
            >
              {n}
            </button>
          ))}

          {showLastSeparately && (
            <>
              <span className="px-1 text-gray-400 select-none">···</span>
              <button
                onClick={() => onPageChange(totalPages)}
                className={`${btnBase} ${totalPages === page ? btnActive : btnIdle}`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${btnBase} ${btnIdle} gap-1 px-3`}
            aria-label={t('pagination.next')}
          >
            <span className="hidden xs:inline">{t('pagination.next')}</span>
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            className={`${btnBase} ${btnIdle} gap-1 px-3`}
            aria-label={t('pagination.last')}
          >
            <span className="hidden xs:inline">{t('pagination.last')}</span>
            <ChevronsRight size={15} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>{t('pagination.resultsPerPage')}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <span>
          {totalItems === 0 ? '0' : `${startIndex + 1}-${endIndex}`} {t('pagination.of')} {totalItems.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
