import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export interface ImportRowError {
  line: number; // 1-based CSV data-row number (header excluded), for the user to find it in their file
  reason: string;
}

interface ImportPreviewModalProps {
  open: boolean;
  title: string;
  totalRows: number;
  validCount: number;
  errors: ImportRowError[];
  onCancel: () => void;
  onConfirm: () => void;
}

// Shown after a CSV is selected, before it's actually saved: cross-checks
// the file against what's already in the table (and against itself, for
// duplicate bill/voucher numbers within the same file) and shows exactly
// what will happen — how many rows will be added, and which ones are
// blocked and why — so the user can decide before committing.
export function ImportPreviewModal({ open, title, totalRows, validCount, errors, onCancel, onConfirm }: ImportPreviewModalProps) {
  const { t } = useLanguage();
  if (!open) return null;

  const hasErrors = errors.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            {t('import.rowsFound').replace('{count}', String(totalRows))}
          </p>

          {hasErrors ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">
                    {t('import.errorsFound').replace('{count}', String(errors.length))}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{t('import.errorsWillBeSkipped')}</p>
                </div>
              </div>
              <div className="mt-3 max-h-40 overflow-y-auto space-y-1.5">
                {errors.map((err, i) => (
                  <div key={i} className="text-xs text-amber-800 bg-amber-100/60 rounded px-2.5 py-1.5">
                    {t('import.line').replace('{n}', String(err.line))}: {err.reason}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2.5">
              <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-green-800 font-medium">{t('import.noErrors')}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-semibold">
              {t('import.willAdd').replace('{count}', String(validCount))}
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onConfirm}
            disabled={validCount === 0}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {t('import.confirm').replace('{count}', String(validCount))}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
