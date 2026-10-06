import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { ImportRowError } from './ImportPreviewModal';

export interface ImportResultsSummary {
  totalRows: number;
  importedCount: number; // inserted + updated
  insertedCount: number;
  updatedCount: number;
  errors: ImportRowError[];
}

interface ImportResultsModalProps {
  open: boolean;
  title?: string;
  summary: ImportResultsSummary | null;
  onClose: () => void;
}

// Shown right after an import is actually committed (distinct from
// ImportPreviewModal, which runs BEFORE anything is saved) — confirms
// what really happened: how many rows were imported, how many were
// skipped, and exactly why each skipped row failed.
export function ImportResultsModal({ open, title = 'Import complete', summary, onClose }: ImportResultsModalProps) {
  if (!open || !summary) return null;
  const hasErrors = summary.errors.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalRows}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rows in file</p>
            </div>
            <div className="rounded-lg border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{summary.importedCount}</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Imported</p>
            </div>
            <div className={`rounded-lg border p-3 text-center ${
              hasErrors
                ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <p className={`text-2xl font-bold ${hasErrors ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {summary.errors.length}
              </p>
              <p className={`text-xs mt-0.5 ${hasErrors ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>Skipped</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {summary.insertedCount} new row{summary.insertedCount === 1 ? '' : 's'} added, {summary.updatedCount} existing row{summary.updatedCount === 1 ? '' : 's'} updated.
          </p>

          {hasErrors ? (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <p className="font-semibold text-amber-800 dark:text-amber-400 text-sm">
                  {summary.errors.length} row{summary.errors.length === 1 ? '' : 's'} could not be imported
                </p>
              </div>
              <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5">
                {summary.errors.map((err, i) => (
                  <div key={i} className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/20 rounded px-2.5 py-1.5">
                    Row {err.line}: {err.reason}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-4 flex items-start gap-2.5">
              <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-green-800 dark:text-green-400 font-medium">Every row imported successfully — no errors.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
