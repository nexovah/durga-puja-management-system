import { useEffect, useState } from 'react';
import { X, Download, TrendingUp, TrendingDown, Scale, CheckCircle2 } from 'lucide-react';
import { Chanda, DonationAd, Expense, Loan, Member, getExpenseCreditAmount } from '../App';
import { EventInfo, Award } from '../lib/db';
import { computeCashBankTotals, CashBankTotals } from '../lib/cashBank';
import { formatFinancialYear } from './EventSwitcher';
import { EXPENSE_CATEGORIES } from './Expenses';
import { useLanguage } from '../i18n/LanguageContext';
import { ReportPrintTable } from './ReportPrintTable';

interface FestivalReportViewProps {
  event: EventInfo;
  companyName: string;
  companyLogo: string;
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  awardsList: Award[];
  loansList: Loan[];
  members: Member[];
  onClose: () => void;
  onPublish: () => Promise<void>;
}

// Reference structure: a one-glance financial statement for a single
// festival (Raised vs Spent, itemized sources/expenses, closing balance) —
// not the row-per-transaction ledger the rest of Reports uses
// (ReportPrintTable/buildLedger). Styled with this app's own orange brand,
// not the maroon reference screenshot — only the layout shape is borrowed.
export function FestivalReportView({
  event, companyName, companyLogo, chandaList, donationAdsList, expenses, awardsList, loansList, members,
  onClose, onPublish,
}: FestivalReportViewProps) {
  const { t, locale } = useLanguage();
  const [publishing, setPublishing] = useState(false);
  const [printData, setPrintData] = useState<{ downloadedAt: string } | null>(null);

  useEffect(() => {
    if (!printData) return;
    const timer = setTimeout(() => window.print(), 50);
    const onAfterPrint = () => setPrintData(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printData]);

  const totals: CashBankTotals = computeCashBankTotals({
    event, chandaList, donationAdsList, members, loansList, expenses, awardsList,
  });

  const fmt = (n: number) => `₹${n.toLocaleString()}`;
  const now = () => new Date().toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const raisedSources = totals.sources.filter(s => ['collection', 'donation', 'sponsorship', 'awardPrizeMoney'].includes(s.key) && (s.cash + s.bank) > 0);
  const totalRaised = raisedSources.reduce((s, r) => s + r.cash + r.bank, 0);

  const expenseByCategory = new Map<string, number>();
  for (const e of expenses) {
    const amount = getExpenseCreditAmount(e);
    if (amount <= 0) continue;
    const key = e.category || 'others';
    expenseByCategory.set(key, (expenseByCategory.get(key) || 0) + amount);
  }
  const expenseRows = Array.from(expenseByCategory.entries())
    .map(([value, amount]) => {
      const found = EXPENSE_CATEGORIES.find(c => c.value === value);
      return { label: found ? t(found.labelKey) : value, amount };
    })
    .sort((a, b) => b.amount - a.amount);
  const totalSpent = expenseRows.reduce((s, r) => s + r.amount, 0);

  const openingTotal = totals.openingCash + totals.openingBank;
  const netThisFestival = totalRaised - totalSpent;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadPDF = () => {
    setPrintData({ downloadedAt: `${t('festivals.report.downloadedAt')}: ${now()}` });
  };

  const printRows: { cells: [string, string]; tone?: 'positive' | 'negative'; bold?: boolean; strongTopBorder?: boolean; emphasized?: boolean; sectionGapBefore?: boolean }[] = [
    { cells: [t('festivals.report.openingBalance'), fmt(openingTotal)], bold: true },
    { cells: [t('festivals.report.raisedAtFestival'), ''], bold: true, sectionGapBefore: true },
    ...raisedSources.map(s => ({ cells: [s.label, fmt(s.cash + s.bank)] as [string, string], tone: 'positive' as const })),
    { cells: [t('festivals.report.totalRaised'), fmt(totalRaised)], tone: 'positive' as const, bold: true, strongTopBorder: true },
    { cells: [t('festivals.report.spentAtFestival'), ''], bold: true, sectionGapBefore: true },
    ...expenseRows.map(r => ({ cells: [r.label, fmt(r.amount)] as [string, string], tone: 'negative' as const })),
    { cells: [t('festivals.report.totalSpent'), fmt(totalSpent)], tone: 'negative' as const, bold: true, strongTopBorder: true },
    { cells: [t('festivals.report.closingBalance'), fmt(openingTotal + netThisFestival)], tone: (openingTotal + netThisFestival) >= 0 ? 'positive' as const : 'negative' as const, emphasized: true, sectionGapBefore: true },
  ];

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-t-xl px-6 py-6 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X size={20} />
          </button>
          <span className="text-3xl leading-none">{event.emoji || '🪔'}</span>
          <h2 className="text-xl font-bold mt-2">{event.name}</h2>
          <p className="text-sm text-white/80 mt-0.5">{companyName} · {formatFinancialYear(event.year)}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                <TrendingUp size={16} /> {t('festivals.report.raisedAtFestival')}
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{fmt(totalRaised)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
                <TrendingDown size={16} /> {t('festivals.report.spentAtFestival')}
              </div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{fmt(totalSpent)}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t('festivals.report.raisedAtFestival')}</h4>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {raisedSources.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('festivals.report.noData')}</p>
              ) : raisedSources.map(s => (
                <div key={s.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{s.label}</span>
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">{fmt(s.cash + s.bank)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-500/10">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('festivals.report.totalRaised')}</span>
                <span className="text-sm font-bold text-green-700 dark:text-green-400">{fmt(totalRaised)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{t('festivals.report.spentAtFestival')}</h4>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {expenseRows.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('festivals.report.noData')}</p>
              ) : expenseRows.map(r => (
                <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{r.label}</span>
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">{fmt(r.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-500/10">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('festivals.report.totalSpent')}</span>
                <span className="text-sm font-bold text-red-700 dark:text-red-400">{fmt(totalSpent)}</span>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-5 flex items-center justify-between ${
            (openingTotal + netThisFestival) >= 0
              ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
              : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <Scale className={(openingTotal + netThisFestival) >= 0 ? 'text-green-700' : 'text-red-600'} size={24} />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('festivals.report.closingBalance')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">{t('festivals.report.openingBalance')} + {t('festivals.report.totalRaised')} − {t('festivals.report.totalSpent')}</p>
              </div>
            </div>
            <p className={`text-2xl font-bold ${(openingTotal + netThisFestival) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(openingTotal + netThisFestival)}
            </p>
          </div>

          {event.reportPublished && event.reportPublishedAt && (
            <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <CheckCircle2 size={14} className="text-green-600" />
              {t('festivals.report.publishedOn')} {new Date(event.reportPublishedAt).toLocaleDateString(locale)}
            </p>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            {t('common.close')}
          </button>
          <button onClick={handleDownloadPDF} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <Download size={16} /> {t('festivals.report.downloadPdf')}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {publishing ? '...' : event.reportPublished ? t('festivals.report.republish') : t('festivals.report.publish')}
          </button>
        </div>
      </div>

      {printData && (
        <ReportPrintTable
          companyName={companyName}
          companyLogo={companyLogo}
          title={t('festivals.report.title')}
          eventLabel={`${event.name} — ${formatFinancialYear(event.year)}`}
          downloadedAt={printData.downloadedAt}
          summary={[{ label: t('festivals.report.closingBalance'), value: fmt(openingTotal + netThisFestival), tone: (openingTotal + netThisFestival) >= 0 ? 'positive' : 'negative' }]}
          columns={[
            { label: t('festivals.report.item') },
            { label: t('report.col.amount'), align: 'right' },
          ]}
          rows={printRows.map(r => r.cells)}
          boldRows={printRows.map(r => r.bold)}
          rowTones={printRows.map(r => r.tone)}
          strongTopBorderRows={printRows.map(r => r.strongTopBorder)}
          emphasizedRows={printRows.map(r => r.emphasized)}
          sectionGapBeforeRows={printRows.map(r => r.sectionGapBefore)}
          emptyMessage=""
        />
      )}
    </div>
  );
}
