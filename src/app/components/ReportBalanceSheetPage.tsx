import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Download, FileText, RefreshCw, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import {
  Chanda, DonationAd, Expense, Loan, Member,
  getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount,
} from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { ReportPrintTable } from './ReportPrintTable';
import { downloadTableCSV } from '../lib/reportExport';

interface ReportBalanceSheetPageProps {
  members: Member[];
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  companyName: string;
  companyLogo: string;
  eventLabel: string;
  onRefresh: () => Promise<void>;
}

// No filters — always reflects the latest entry across every module, as
// requested ("Balance sheet will not have any filter because it will be
// always updated as per latest time entry"). The Refresh button re-pulls
// the 7 event-scoped lists from Supabase (App.tsx's refreshCoreData) so it
// doesn't depend on a page reload to pick up a teammate's just-added row.
export function ReportBalanceSheetPage({
  members, chandaList, donationAdsList, expenses, loansList, companyName, companyLogo, eventLabel, onRefresh,
}: ReportBalanceSheetPageProps) {
  const { t, locale } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [printData, setPrintData] = useState<{ downloadedAt: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error('Failed to refresh balance sheet data', err);
    } finally {
      setRefreshing(false);
    }
  };

  const fmtAmount = (n: number) => `₹${n.toLocaleString()}`;
  const now = () => new Date().toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const totalMembership = members.reduce((s, m) => s + getMemberCreditAmount(m), 0);
  const totalChanda = chandaList.reduce((s, c) => s + getChandaCreditAmount(c), 0);
  const totalDonation = donationAdsList.filter(d => d.category === 'donation').reduce((s, d) => s + d.amount, 0);
  const totalAds = donationAdsList.filter(d => d.category === 'ads').reduce((s, d) => s + d.amount, 0);
  const totalLoans = loansList.reduce((s, l) => s + getLoanNetAmount(l), 0);
  const totalExpenses = expenses.reduce((s, e) => s + getExpenseCreditAmount(e), 0);

  const incomeRows = [
    { label: t('report.balanceSheet.membersPayment'), value: totalMembership },
    { label: t('report.balanceSheet.chandaCollection'), value: totalChanda },
    { label: t('report.balanceSheet.donationCollection'), value: totalDonation },
    { label: t('report.balanceSheet.adsPayment'), value: totalAds },
    { label: t('report.balanceSheet.loanPayment'), value: totalLoans },
  ];
  const totalIncome = incomeRows.reduce((s, r) => s + r.value, 0);

  const expenditureRows = [
    { label: t('report.balanceSheet.expensesTotal'), value: totalExpenses },
  ];
  const totalExpenditure = expenditureRows.reduce((s, r) => s + r.value, 0);

  const closingBalance = totalIncome - totalExpenditure;

  // Single source of truth for the exported table shape — a total row is
  // only shown for a section when it actually sums more than one line
  // item; with just one ("Expenses Total"), a separate "Total Expenditure"
  // row would just repeat the same number.
  const printRows: { cells: [string, string]; tone?: 'positive' | 'negative'; bold?: boolean; strongTopBorder?: boolean; emphasized?: boolean; sectionGapBefore?: boolean }[] = [
    { cells: [t('report.balanceSheet.income'), ''], bold: true },
    ...incomeRows.map(r => ({ cells: [r.label, fmtAmount(r.value)] as [string, string], tone: 'positive' as const })),
    ...(incomeRows.length > 1 ? [{ cells: [t('report.balanceSheet.totalIncome'), fmtAmount(totalIncome)] as [string, string], tone: 'positive' as const, bold: true, strongTopBorder: true }] : []),
    { cells: [t('report.balanceSheet.expenditure'), ''], bold: true, sectionGapBefore: true },
    ...expenditureRows.map(r => ({ cells: [r.label, fmtAmount(r.value)] as [string, string], tone: 'negative' as const })),
    ...(expenditureRows.length > 1 ? [{ cells: [t('report.balanceSheet.totalExpenditure'), fmtAmount(totalExpenditure)] as [string, string], tone: 'negative' as const, bold: true, strongTopBorder: true }] : []),
    { cells: [t('report.balanceSheet.closingBalance'), fmtAmount(closingBalance)], tone: closingBalance >= 0 ? 'positive' as const : 'negative' as const, emphasized: true, sectionGapBefore: true },
  ];

  const handleDownloadCSV = () => {
    const downloadedAt = now();
    downloadTableCSV(`balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`, {
      companyName,
      eventLabel,
      downloadedAt: `${t('report.balanceSheet.downloadedAt')}: ${downloadedAt}`,
      summary: [{ label: t('report.balanceSheet.closingBalance'), value: fmtAmount(closingBalance) }],
      headers: [t('report.balanceSheet.item'), t('report.col.amount')],
      rows: printRows.map(r => r.cells),
    });
    setMenuOpen(false);
  };

  const handleDownloadPDF = () => {
    setPrintData({ downloadedAt: `${t('report.balanceSheet.downloadedAt')}: ${now()}` });
    setMenuOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold text-sm sm:text-base whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  <button onClick={handleDownloadCSV} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Download size={16} /> {t('treasury.report.downloadCSV')}
                  </button>
                  <button onClick={handleDownloadPDF} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <FileText size={16} /> {t('treasury.report.downloadPDF')}
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      >
        {t('report.nav.balanceSheet')}
      </PageHeading>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Income */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <TrendingUp className="text-green-600" size={20} />
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('report.balanceSheet.income')}</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {incomeRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">{i + 1}. {r.label}</span>
                <span className="text-sm font-semibold text-green-700">{fmtAmount(r.value)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 bg-green-50 dark:bg-green-500/10 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('report.balanceSheet.totalIncome')}</span>
            <span className="text-base font-bold text-green-700">{fmtAmount(totalIncome)}</span>
          </div>
        </div>

        {/* B. Expenditure */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <TrendingDown className="text-red-600" size={20} />
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('report.balanceSheet.expenditure')}</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {expenditureRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">{i + 1}. {r.label}</span>
                <span className="text-sm font-semibold text-red-700">{fmtAmount(r.value)}</span>
              </div>
            ))}
          </div>
          {expenditureRows.length > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 bg-red-50 dark:bg-red-500/10 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('report.balanceSheet.totalExpenditure')}</span>
              <span className="text-base font-bold text-red-700">{fmtAmount(totalExpenditure)}</span>
            </div>
          )}
        </div>
      </div>

      {/* C. Closing Balance */}
      <div className={`rounded-xl border p-6 flex items-center justify-between ${
        closingBalance >= 0
          ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
          : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
      }`}>
        <div className="flex items-center gap-3">
          <Scale className={closingBalance >= 0 ? 'text-green-700' : 'text-red-600'} size={28} />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('report.balanceSheet.closingBalance')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">{t('report.balanceSheet.totalIncome')} − {t('report.balanceSheet.totalExpenditure')}</p>
          </div>
        </div>
        <p className={`text-3xl font-bold ${closingBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {fmtAmount(closingBalance)}
        </p>
      </div>

      {printData && (
        <ReportPrintTable
          companyName={companyName}
          companyLogo={companyLogo}
          title={t('report.nav.balanceSheet')}
          eventLabel={eventLabel}
          downloadedAt={printData.downloadedAt}
          summary={[{ label: t('report.balanceSheet.closingBalance'), value: fmtAmount(closingBalance), tone: closingBalance >= 0 ? 'positive' : 'negative' }]}
          columns={[
            { label: t('report.balanceSheet.item') },
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
