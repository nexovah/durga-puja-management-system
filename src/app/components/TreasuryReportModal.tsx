import { useMemo, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { LedgerLabels, LedgerSources, buildLedger, downloadLedgerCSV } from '../lib/reportExport';

interface TreasuryReportModalProps {
  open: boolean;
  onClose: () => void;
  sources: LedgerSources;
  labels: LedgerLabels;
  onRequestPrint: (rangeLabel: string, range: { start: string; end: string }) => void;
}

const allDatesOf = (sources: LedgerSources): string[] => [
  ...sources.chandaList.map(c => c.date),
  ...sources.donationAdsList.map(d => d.date),
  ...sources.members.map(m => m.membershipDate).filter(Boolean) as string[],
  ...sources.loansList.map(l => l.date),
  ...sources.expenses.map(e => e.date),
];

const monthEnd = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m, 0).toISOString().split('T')[0]; // last day of that month
};

export function TreasuryReportModal({ open, onClose, sources, labels, onRequestPrint }: TreasuryReportModalProps) {
  const { t, locale } = useLanguage();
  const [mode, setMode] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const monthOptions = useMemo(() => {
    const keys = new Set(allDatesOf(sources).map(d => (d || '').slice(0, 7)).filter(Boolean));
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map(key => {
        const [y, m] = key.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
        return { key, label };
      });
  }, [sources, locale]);

  if (!open) return null;

  const currentRange = () => {
    if (mode === 'month') {
      if (!selectedMonth) return null;
      return { start: `${selectedMonth}-01`, end: monthEnd(selectedMonth) };
    }
    if (!customStart || !customEnd) return null;
    return { start: customStart, end: customEnd };
  };

  const currentRangeLabel = () => {
    if (mode === 'month') {
      return monthOptions.find(m => m.key === selectedMonth)?.label || '';
    }
    if (!customStart || !customEnd) return '';
    return `${customStart} – ${customEnd}`;
  };

  const handleDownloadCSV = () => {
    const range = currentRange();
    if (!range) return;
    const rows = buildLedger(range, sources, labels);
    downloadLedgerCSV(
      `treasury-report-${range.start}-to-${range.end}.csv`,
      rows,
      {
        date: t('treasury.report.csv.date'),
        type: t('treasury.report.csv.type'),
        name: t('treasury.report.csv.name'),
        detail: t('treasury.report.csv.detail'),
        credit: t('treasury.report.csv.credit'),
        debit: t('treasury.report.csv.debit'),
      }
    );
    onClose();
  };

  const handleDownloadPDF = () => {
    const range = currentRange();
    if (!range) return;
    onRequestPrint(currentRangeLabel(), range);
    onClose();
  };

  const canGenerate = !!currentRange();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('treasury.report.title')}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('month')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                mode === 'month' ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('treasury.report.byMonth')}
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                mode === 'custom' ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('treasury.report.customRange')}
            </button>
          </div>

          {mode === 'month' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('treasury.month')}</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="">{t('treasury.report.selectMonth')}</option>
                {monthOptions.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              {monthOptions.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('treasury.noMonthlyData')}</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.from')}</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.to')}</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 px-5 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDownloadCSV}
            disabled={!canGenerate}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Download size={18} /> {t('treasury.report.downloadCSV')}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={!canGenerate}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <FileText size={18} /> {t('treasury.report.downloadPDF')}
          </button>
        </div>
      </div>
    </div>
  );
}
