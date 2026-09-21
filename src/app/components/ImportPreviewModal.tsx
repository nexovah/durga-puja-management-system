import { AlertTriangle, CheckCircle2, PlusCircle, RefreshCcw, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export interface ImportRowError {
  line: number; // 1-based row number within the file (header excluded)
  reason: string;
}

interface ImportPreviewModalProps {
  open: boolean;
  title: string;
  totalRows: number;
  insertCount: number;
  updateCount: number;
  errors: ImportRowError[];
  onCancel: () => void;
  onConfirm: () => void;
}

// Shown after a CSV is selected, before anything is saved: cross-checks the
// file against what's already in the table (matched by the unique Bill/
// Voucher Number field where one exists) and shows exactly what will
// happen — a row whose number matches an existing record updates that
// record's other fields (name, amount, date, status, ...); a row with a
// new or blank number is added as a new record — so the user can see the
// intelligence behind the import before committing.
export function ImportPreviewModal({
  open, title, totalRows, insertCount, updateCount, errors, onCancel, onConfirm,
}: ImportPreviewModalProps) {
  const { t } = useLanguage();
  if (!open) return null;

  const hasErrors = errors.length > 0;
  const totalChanges = insertCount + updateCount;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('import.rowsFound').replace('{count}', String(totalRows))}
          </p>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 flex items-start gap-2.5">
            <PlusCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-blue-800 font-medium">
              {t('import.willAdd').replace('{count}', String(insertCount))}
            </p>
          </div>

          {updateCount > 0 && (
            <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg p-4 flex items-start gap-2.5">
              <RefreshCcw className="text-purple-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm text-purple-800 font-medium">
                  {t('import.willUpdate').replace('{count}', String(updateCount))}
                </p>
                <p className="text-xs text-purple-700 mt-0.5">{t('import.willUpdateHint')}</p>
              </div>
            </div>
          )}

          {hasErrors ? (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
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
          ) : totalChanges > 0 ? (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-4 flex items-start gap-2.5">
              <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-green-800 font-medium">{t('import.noErrors')}</p>
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onConfirm}
            disabled={totalChanges === 0}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {t('import.confirm').replace('{count}', String(totalChanges))}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
