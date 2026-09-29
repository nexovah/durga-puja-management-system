import { useEffect, useMemo, useState } from 'react';
import { Users, IndianRupee, TrendingDown, ClipboardList, Gift, HandCoins, Landmark, PieChart as PieChartIcon, Wallet, HourglassIcon } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, Loan, getChandaCreditAmount, getDonationAdCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount } from '../App';
import { EventInfo, CashBankAdjustment, listCashBankAdjustmentsRequest } from '../lib/db';
import { computeCashBankTotals } from '../lib/cashBank';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { DashboardChart } from './DashboardChart';
import { DashboardCategoryBars } from './DashboardCategoryBars';
import { DashboardDonut } from './DashboardDonut';
import { PageHeading } from './PageHeading';

interface DashboardProps {
  members: Member[];
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  activeEvent?: EventInfo | null;
}

export function Dashboard({ members, chandaList, donationAdsList, expenses, loansList, activeEvent }: DashboardProps) {
  const { t } = useLanguage();
  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);
  const totalDonationAds = donationAdsList.reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalDonation = donationAdsList.filter(item => item.category === 'donation').reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalAds = donationAdsList.filter(item => item.category === 'ads').reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalLoansNet = loansList.reduce((sum, loan) => sum + getLoanNetAmount(loan), 0);
  const totalMembershipPayments = members.reduce((sum, m) => sum + getMemberCreditAmount(m), 0);
  const totalCredit = totalChanda + totalDonationAds + totalLoansNet + totalMembershipPayments;
  const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseCreditAmount(expense), 0);
  const openingTotal = (activeEvent?.openingCash ?? 0) + (activeEvent?.openingBank ?? 0);
  const balance = totalCredit - totalExpenses + openingTotal;

  // Amount still owed by donors: full amount for 'pending', the unpaid
  // remainder for 'partial'. 'rejected' is excluded (donor declined to pay).
  const pendingDueChanda = chandaList.reduce((sum, chanda) => {
    if (chanda.paymentStatus === 'pending') return sum + chanda.amount;
    if (chanda.paymentStatus === 'partial') return sum + Math.max(0, chanda.amount - (chanda.partialAmount || 0));
    return sum;
  }, 0);

  // Same pending/partial-remainder pattern applied to Donation/Ads and
  // Membership, for the Outstanding/Follow-ups donut below.
  const pendingDueFor = (amount: number, status: string, partial?: number) => {
    if (status === 'pending') return amount;
    if (status === 'partial') return Math.max(0, amount - (partial || 0));
    return 0;
  };
  const pendingDueDonation = donationAdsList
    .filter(d => d.category === 'donation')
    .reduce((sum, d) => sum + pendingDueFor(d.amount, d.paymentStatus), 0);
  const pendingDueAds = donationAdsList
    .filter(d => d.category === 'ads')
    .reduce((sum, d) => sum + pendingDueFor(d.amount, d.paymentStatus), 0);
  const pendingDueMembership = members.reduce((sum, m) => {
    if (!m.membershipAmount || !m.membershipPaymentStatus) return sum;
    return sum + pendingDueFor(m.membershipAmount, m.membershipPaymentStatus, m.membershipPartialAmount);
  }, 0);

  const [adjustments, setAdjustments] = useState<CashBankAdjustment[]>([]);
  useEffect(() => {
    listCashBankAdjustmentsRequest().then(setAdjustments).catch(() => {});
  }, [activeEvent]);

  const cashBank = useMemo(() => (
    activeEvent
      ? computeCashBankTotals({ event: activeEvent, chandaList, donationAdsList, members, loansList, expenses, adjustments })
      : null
  ), [activeEvent, chandaList, donationAdsList, members, loansList, expenses, adjustments]);

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
  const statTiles = [
    { title: t('dashboard.totalMembers'), value: members.length.toString(), subLabel: t('dashboard.totalMembersPaid'), subValue: `₹${totalMembershipPayments.toLocaleString()}`, icon: Users, accent: 'blue' },
    { title: t('dashboard.totalChanda'), value: `₹${totalChanda.toLocaleString()}`, icon: IndianRupee, accent: 'green' },
    { title: t('dashboard.pendingDueChanda'), value: `₹${pendingDueChanda.toLocaleString()}`, icon: HandCoins, accent: 'amber' },
    { title: t('dashboard.donationTotal'), value: `₹${totalDonation.toLocaleString()}`, icon: Gift, accent: 'emerald' },
    { title: t('dashboard.adsTotal'), value: `₹${totalAds.toLocaleString()}`, icon: Gift, accent: 'emerald' },
    { title: t('dashboard.loansOutstanding'), value: `₹${totalLoansNet.toLocaleString()}`, icon: Landmark, accent: 'sky' },
    { title: t('dashboard.totalExpenses'), value: `₹${totalExpenses.toLocaleString()}`, icon: TrendingDown, accent: 'red' },
    { title: t('dashboard.expenses'), value: expenses.length.toString(), icon: ClipboardList, accent: 'orange' },
  ];

  const ACCENT_CLASSES: Record<string, { border: string; icon: string; iconBg: string }> = {
    blue: { border: 'border-blue-500 dark:border-blue-500/60', icon: 'text-blue-600', iconBg: 'bg-blue-50 dark:bg-blue-500/10' },
    green: { border: 'border-green-500 dark:border-green-500/60', icon: 'text-green-600', iconBg: 'bg-green-50 dark:bg-green-500/10' },
    emerald: { border: 'border-emerald-500 dark:border-emerald-500/60', icon: 'text-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    sky: { border: 'border-sky-500 dark:border-sky-500/60', icon: 'text-sky-600', iconBg: 'bg-sky-50 dark:bg-sky-500/10' },
    purple: { border: 'border-purple-500 dark:border-purple-500/60', icon: 'text-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-500/10' },
    amber: { border: 'border-amber-500 dark:border-amber-500/60', icon: 'text-amber-600', iconBg: 'bg-amber-50 dark:bg-amber-500/10' },
    red: { border: 'border-red-500 dark:border-red-500/60', icon: 'text-red-600', iconBg: 'bg-red-50 dark:bg-red-500/10' },
    orange: { border: 'border-orange-500 dark:border-orange-500/60', icon: 'text-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-500/10' },
  };

  return (
    <div className="space-y-4">
      <PageHeading>{t('nav.dashboard')}</PageHeading>

      {/* Collections vs Expenses chart (3) + category totals bar chart (1) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <DashboardChart chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} members={members} />
        </div>
        <div className="lg:col-span-1">
          <DashboardCategoryBars chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} members={members} />
        </div>
      </div>

      {/* Key figures — one per row on mobile (amounts up to ₹9,99,999 need
          room), 2 per row on tablets, capped at 4 per row on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statTiles.map((tile, index) => {
          const accent = ACCENT_CLASSES[tile.accent];
          return (
            <div
              key={index}
              className={`bg-white dark:bg-gray-900 rounded-xl p-3.5 sm:p-5 border border-l-4 ${accent.border} flex items-center gap-3 sm:gap-4`}
            >
              <div className={`${accent.iconBg} p-2.5 sm:p-3 rounded-xl shrink-0`}>
                <tile.icon className={accent.icon} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium leading-tight truncate">{tile.title}</p>
                <p className="text-gray-900 dark:text-gray-100 text-lg sm:text-2xl font-bold leading-tight truncate">{tile.value}</p>
                {'subValue' in tile && (
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 truncate">{tile.subLabel}: <span className="text-gray-600 dark:text-gray-400 font-semibold">{tile.subValue}</span></p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed breakdowns — donut widgets, added alongside (not
          replacing) the existing chart/bars/tiles above */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          ]}
        />
        <DashboardDonut
          title={t('dashboard.donut.expensesByCategory')}
          icon={ClipboardList}
          iconAccent="text-red-600"
          emptyMessage={t('treasury.noExpenses')}
          slices={expensesByCategory}
        />
        {cashBank && (
          <DashboardDonut
            title={t('dashboard.donut.cashVsBank')}
            icon={Wallet}
            iconAccent="text-amber-600"
            emptyMessage={t('dashboard.donut.noBalance')}
            colors={['#d97706', '#2563eb']}
            slices={[
              { name: t('dashboard.donut.cashInHand'), value: Math.max(0, cashBank.closingCash) },
              { name: t('dashboard.donut.moneyInBank'), value: Math.max(0, cashBank.closingBank) },
            ]}
          />
        )}
        <DashboardDonut
          title={t('dashboard.donut.outstanding')}
          icon={HourglassIcon}
          iconAccent="text-purple-600"
          emptyMessage={t('dashboard.donut.noOutstanding')}
          slices={[
            { name: t('nav.chanda'), value: pendingDueChanda },
            { name: t('donationAds.widget.donation'), value: pendingDueDonation },
            { name: t('donationAds.widget.ads'), value: pendingDueAds },
            { name: t('dashboard.totalMembers'), value: pendingDueMembership },
          ]}
        />
      </div>

    </div>
  );
}
