import { useEffect, useMemo, useState } from 'react';
import { Users, IndianRupee, TrendingDown, ClipboardList, Gift, HandCoins, Landmark, PieChart as PieChartIcon, HourglassIcon, Trophy, CheckSquare } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, Loan, Task, getChandaCreditAmount, getDonationAdCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount, getAwardCreditAmount } from '../App';
import { EventInfo, CashBankAdjustment, listCashBankAdjustmentsRequest, Award, ReceiptSettings } from '../lib/db';
import { computeCashBankTotals } from '../lib/cashBank';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { DashboardChart } from './DashboardChart';
import { DashboardCategoryBars } from './DashboardCategoryBars';
import { DashboardDonut, DONUT_COLORS } from './DashboardDonut';
import { SegmentedProgressBar } from './SegmentedProgressBar';
import { PageHeading } from './PageHeading';
import { DashboardOnboardingWidget } from './DashboardOnboardingWidget';

interface DashboardProps {
  members: Member[];
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  awardsList: Award[];
  tasksList: Task[];
  activeEvent?: EventInfo | null;
  receiptSettings?: ReceiptSettings;
  onNavigateToReceiptSettings?: () => void;
  onNavigateToAddDonor?: () => void;
  onNavigateToCollection?: () => void;
}

export function Dashboard({
  members, chandaList, donationAdsList, expenses, loansList, awardsList, tasksList, activeEvent,
  receiptSettings, onNavigateToReceiptSettings, onNavigateToAddDonor, onNavigateToCollection,
}: DashboardProps) {
  const { t } = useLanguage();
  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);
  const totalDonationAds = donationAdsList.reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalDonation = donationAdsList.filter(item => item.category === 'donation').reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalAds = donationAdsList.filter(item => item.category === 'ads').reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalLoansNet = loansList.reduce((sum, loan) => sum + getLoanNetAmount(loan), 0);
  const totalLoansReceived = loansList.reduce((sum, loan) => sum + loan.amountReceived, 0);
  const totalLoansRepaid = loansList.reduce((sum, loan) => sum + (loan.amountPaid || 0), 0);
  const completedTasks = tasksList.filter(t => t.priority === 'completed').length;
  const taskCompletionRate = tasksList.length > 0 ? completedTasks / tasksList.length : 0;
  const totalMembershipPayments = members.reduce((sum, m) => sum + getMemberCreditAmount(m), 0);
  const totalAwards = awardsList.reduce((sum, a) => sum + getAwardCreditAmount(a), 0);
  const totalCredit = totalChanda + totalDonationAds + totalLoansNet + totalMembershipPayments + totalAwards;
  const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseCreditAmount(expense), 0);
  const openingTotal = (activeEvent?.openingCash ?? 0) + (activeEvent?.openingBank ?? 0);
  const balance = totalCredit - totalExpenses + openingTotal;

  // Amount still owed by donors: full amount for 'pending', the unpaid
  // remainder for 'partial'. 'rejected' is excluded (donor declined to pay).
  // Scoped to Collection (Chanda) only, per explicit instruction — the
  // other income modules don't factor into this widget.
  const pendingDueChanda = chandaList.reduce((sum, chanda) => {
    if (chanda.paymentStatus === 'pending') return sum + chanda.amount;
    if (chanda.paymentStatus === 'partial') return sum + Math.max(0, chanda.amount - (chanda.partialAmount || 0));
    return sum;
  }, 0);
  const totalBilledChanda = chandaList.reduce((sum, c) => sum + c.amount, 0);
  const pendingCountChanda = chandaList.filter(c => c.paymentStatus === 'pending' || c.paymentStatus === 'partial').length;
  const totalBillsChanda = chandaList.length;
  const pendingCollectionPct = totalBilledChanda > 0 ? Math.round((pendingDueChanda / totalBilledChanda) * 100) : 0;
  const pendingBillsPct = totalBillsChanda > 0 ? Math.round((pendingCountChanda / totalBillsChanda) * 100) : 0;

  const [adjustments, setAdjustments] = useState<CashBankAdjustment[]>([]);
  useEffect(() => {
    listCashBankAdjustmentsRequest().then(setAdjustments).catch(() => {});
  }, [activeEvent]);

  const cashBank = useMemo(() => (
    activeEvent
      ? computeCashBankTotals({ event: activeEvent, chandaList, donationAdsList, members, loansList, expenses, awardsList, adjustments })
      : null
  ), [activeEvent, chandaList, donationAdsList, members, loansList, expenses, awardsList, adjustments]);

  const categoryLabel = (value: string) => {
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };
  const expensesByCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of expenses) {
      totals[e.category] = (totals[e.category] || 0) + getExpenseCreditAmount(e);
    }
    return Object.entries(totals)
      .map(([category, value]) => ({ name: categoryLabel(category), value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Key figures: same calm white-card/colored-left-border style used on
  // every other page's widgets (Treasury, Chanda, etc.) — one muted accent
  // color per card instead of a full gradient background.
  const paidMembersCount = members.filter(m => getMemberCreditAmount(m) > 0).length;
  const collectionsReceivedCount = chandaList.filter(c => getChandaCreditAmount(c) > 0).length;
  const totalDonationCount = donationAdsList.filter(item => item.category === 'donation').length;
  const totalAdsCount = donationAdsList.filter(item => item.category === 'ads').length;
  const outstandingLoansCount = loansList.filter(loan => getLoanNetAmount(loan) > 0).length;

  const statTiles = [
    { title: t('dashboard.totalMembers'), value: members.length.toString(), subLabel: t('dashboard.totalMembersPaid'), subValue: `₹${totalMembershipPayments.toLocaleString()}`, icon: Users, accent: 'blue', ring: members.length > 0 ? paidMembersCount / members.length : 0 },
    { title: t('dashboard.totalChanda'), value: `₹${totalChanda.toLocaleString()}`, subLabel: t('dashboard.collections'), subValue: collectionsReceivedCount.toString(), icon: IndianRupee, accent: 'green' },
    { title: t('dashboard.pendingDueChanda'), value: `₹${pendingDueChanda.toLocaleString()}`, subLabel: t('dashboard.outstanding'), subValue: pendingCountChanda.toString(), icon: HandCoins, accent: 'amber' },
    { title: t('dashboard.donationTotal'), value: `₹${totalDonation.toLocaleString()}`, subLabel: t('dashboard.donations'), subValue: totalDonationCount.toString(), icon: Gift, accent: 'emerald' },
    { title: t('dashboard.adsTotal'), value: `₹${totalAds.toLocaleString()}`, subLabel: t('dashboard.sponsorships'), subValue: totalAdsCount.toString(), icon: Gift, accent: 'emerald' },
    { title: t('dashboard.loansOutstanding'), value: `₹${totalLoansNet.toLocaleString()}`, subLabel: t('dashboard.loans'), subValue: outstandingLoansCount.toString(), icon: Landmark, accent: 'sky' },
    { title: t('nav.awards'), value: `₹${totalAwards.toLocaleString()}`, subLabel: t('dashboard.awards'), subValue: awardsList.length.toString(), icon: Trophy, accent: 'cyan' },
    { title: t('dashboard.totalExpenses'), value: `₹${totalExpenses.toLocaleString()}`, subLabel: t('dashboard.expenses'), subValue: expenses.length.toString(), icon: TrendingDown, accent: 'red' },
  ];

  const ACCENT_CLASSES: Record<string, { border: string; icon: string; iconBg: string; bar: string }> = {
    blue: { border: 'border-blue-500 dark:border-blue-500/60', icon: 'text-blue-600', iconBg: 'bg-blue-50 dark:bg-blue-500/10', bar: 'bg-blue-500' },
    green: { border: 'border-green-500 dark:border-green-500/60', icon: 'text-green-600', iconBg: 'bg-green-50 dark:bg-green-500/10', bar: 'bg-green-500' },
    emerald: { border: 'border-emerald-500 dark:border-emerald-500/60', icon: 'text-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', bar: 'bg-emerald-500' },
    sky: { border: 'border-sky-500 dark:border-sky-500/60', icon: 'text-sky-600', iconBg: 'bg-sky-50 dark:bg-sky-500/10', bar: 'bg-sky-500' },
    purple: { border: 'border-yellow-500 dark:border-yellow-500/60', icon: 'text-yellow-600', iconBg: 'bg-yellow-50 dark:bg-yellow-500/10', bar: 'bg-yellow-500' },
    amber: { border: 'border-amber-500 dark:border-amber-500/60', icon: 'text-amber-600', iconBg: 'bg-amber-50 dark:bg-amber-500/10', bar: 'bg-amber-500' },
    red: { border: 'border-red-500 dark:border-red-500/60', icon: 'text-red-600', iconBg: 'bg-red-50 dark:bg-red-500/10', bar: 'bg-red-500' },
    orange: { border: 'border-orange-500 dark:border-orange-500/60', icon: 'text-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-500/10', bar: 'bg-orange-500' },
    cyan: { border: 'border-cyan-500 dark:border-cyan-500/60', icon: 'text-cyan-600', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10', bar: 'bg-cyan-500' },
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeading>{t('nav.dashboard')}</PageHeading>

      <DashboardOnboardingWidget
        activeEvent={activeEvent}
        chandaList={chandaList}
        receiptSettings={receiptSettings}
        onNavigateToReceiptSettings={onNavigateToReceiptSettings}
        onNavigateToAddDonor={onNavigateToAddDonor}
        onNavigateToCollection={onNavigateToCollection}
      />

      {/* Collections vs Expenses chart (3) + category totals bar chart (1) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <DashboardChart chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} members={members} awardsList={awardsList} />
        </div>
        <div className="lg:col-span-1">
          <DashboardCategoryBars chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} members={members} awardsList={awardsList} />
        </div>
      </div>

      {/* Key figures — one per row on mobile (amounts up to ₹9,99,999 need
          room), 2 per row on tablets, capped at 4 per row on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statTiles.map((tile, index) => {
          const accent = ACCENT_CLASSES[tile.accent];
          const ringPct = 'ring' in tile ? Math.max(0, Math.min(1, tile.ring)) : null;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-900 rounded-xl p-3.5 sm:p-5 border border-gray-200 dark:border-gray-700 flex items-center gap-3 sm:gap-4"
            >
              {ringPct !== null ? (
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                  <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" strokeWidth="5" className="stroke-gray-100 dark:stroke-gray-800" />
                    <circle
                      cx="20" cy="20" r="16" fill="none" strokeWidth="5" strokeLinecap="round"
                      className={accent.icon}
                      stroke="currentColor"
                      strokeDasharray={`${ringPct * 100.5} 100.5`}
                    />
                  </svg>
                  <tile.icon className={`${accent.icon} absolute inset-0 m-auto`} size={16} />
                </div>
              ) : (
                <div className={`${accent.iconBg} p-2.5 sm:p-3 rounded-xl shrink-0`}>
                  <tile.icon className={accent.icon} size={22} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium leading-tight truncate">{tile.title}</p>
                <p className="text-gray-900 dark:text-gray-100 text-lg sm:text-2xl font-bold leading-tight truncate">{tile.value}</p>
                {'subValue' in tile && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs truncate">
                    <span className={`w-1 h-3.5 rounded shrink-0 ${accent.bar}`} />
                    <span className="text-gray-600 dark:text-gray-400">{tile.subLabel}</span>
                    <span className="text-gray-800 dark:text-gray-200 font-semibold ml-0.5">{tile.subValue}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed breakdowns — donut/segmented-bar/breakdown widgets, added
          alongside (not replacing) the existing chart/bars/tiles above */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardDonut
          title={t('dashboard.donut.collectionByCategory')}
          icon={PieChartIcon}
          iconAccent="text-green-600"
          emptyMessage={t('dashboard.donut.noCollection')}
          slices={[
            { name: t('nav.chanda'), value: totalChanda },
            { name: t('donationAds.widget.donation'), value: totalDonation },
            { name: t('donationAds.widget.ads'), value: totalAds },
            { name: t('dashboard.totalMembersPaid'), value: totalMembershipPayments },
            { name: t('treasury.loansOutstanding'), value: Math.max(0, totalLoansNet) },
            { name: t('nav.awards'), value: totalAwards },
          ]}
          colors={[DONUT_COLORS[0], DONUT_COLORS[1], DONUT_COLORS[2], DONUT_COLORS[3], DONUT_COLORS[4], DONUT_COLORS[6]]}
          centerTotal={{ label: t('report.balanceSheet.totalIncome'), value: `₹${totalCredit.toLocaleString()}` }}
        />
        <DashboardDonut
          title={t('dashboard.donut.expensesByCategory')}
          icon={ClipboardList}
          iconAccent="text-red-600"
          emptyMessage={t('treasury.noExpenses')}
          slices={expensesByCategory}
          centerTotal={{ label: t('dashboard.totalExpenses'), value: `₹${totalExpenses.toLocaleString()}` }}
        />
        <DashboardDonut
          title={t('dashboard.donut.outstanding')}
          icon={HourglassIcon}
          iconAccent="text-yellow-600"
          emptyMessage={t('dashboard.donut.noOutstanding')}
          slices={[
            {
              name: t('nav.chanda'),
              value: pendingDueChanda,
              pctOverride: pendingCollectionPct,
              countRow: { label: t('dashboard.pendingBillsLabel'), value: String(pendingCountChanda), subValue: `${pendingBillsPct}%` },
            },
          ]}
          centerTotal={{ label: `${pendingCountChanda} ${t('dashboard.billsPending')}`, value: `₹${pendingDueChanda.toLocaleString()}` }}
          ringSlices={[
            { name: t('report.col.pending'), value: pendingDueChanda, color: '#f97316' },
            { name: t('chanda.status.paid'), value: Math.max(0, totalBilledChanda - pendingDueChanda), color: '#d1d5db' },
          ]}
        />

        {cashBank && (
          <SegmentedProgressBar
            title={t('dashboard.donut.cashVsBank')}
            segments={[
              { label: t('dashboard.donut.cashInHand'), value: Math.max(0, cashBank.closingCash), color: '#d97706', countLabel: `₹${Math.max(0, cashBank.closingCash).toLocaleString()}` },
              { label: t('dashboard.donut.moneyInBank'), value: Math.max(0, cashBank.closingBank), color: '#2563eb', countLabel: `₹${Math.max(0, cashBank.closingBank).toLocaleString()}` },
            ]}
          />
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="text-green-600" size={18} />
            <h3 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">{t('dashboard.taskCompletionRate')}</h3>
          </div>
          {tasksList.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('tasks.empty')}</p>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{(taskCompletionRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                {completedTasks} / {tasksList.length} {t('dashboard.tasksCompleted')}
              </p>
              <SegmentedBarOnly pct={taskCompletionRate * 100} color="#16a34a" />
            </>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 flex items-center gap-4">
          <div className="shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('treasury.loansOutstanding')}</p>
            <p className="text-2xl sm:text-3xl font-bold text-sky-600">₹{totalLoansNet.toLocaleString()}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 border-l border-gray-100 dark:border-gray-800 pl-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">{t('report.col.received')}</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">₹{totalLoansReceived.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">{t('report.col.repaid')}</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">₹{totalLoansRepaid.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// Bare single-segment bar (no legend rows) for a card that already shows
// its own number/label above it — avoids SegmentedProgressBar's built-in
// legend duplicating what's already on screen.
function SegmentedBarOnly({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}
