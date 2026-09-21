import { Users, IndianRupee, TrendingDown, Wallet, Calendar, FileText, ClipboardList, Gift, HandCoins, Landmark } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, Loan, getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { DashboardChart } from './DashboardChart';
import { DashboardCategoryBars } from './DashboardCategoryBars';
import { PageHeading } from './PageHeading';

interface DashboardProps {
  members: Member[];
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
}

export function Dashboard({ members, chandaList, donationAdsList, expenses, loansList }: DashboardProps) {
  const { t } = useLanguage();
  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);
  const totalDonationAds = donationAdsList.reduce((sum, item) => sum + item.amount, 0);
  const totalLoansNet = loansList.reduce((sum, loan) => sum + getLoanNetAmount(loan), 0);
  const totalMembershipPayments = members.reduce((sum, m) => sum + getMemberCreditAmount(m), 0);
  const totalCredit = totalChanda + totalDonationAds + totalLoansNet + totalMembershipPayments;
  const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseCreditAmount(expense), 0);
  const balance = totalCredit - totalExpenses;

  const recentChanda = chandaList.length > 0
    ? getChandaCreditAmount([...chandaList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0])
    : 0;

  // Amount still owed by donors: full amount for 'pending', the unpaid
  // remainder for 'partial'. 'rejected' is excluded (donor declined to pay).
  const pendingDueChanda = chandaList.reduce((sum, chanda) => {
    if (chanda.paymentStatus === 'pending') return sum + chanda.amount;
    if (chanda.paymentStatus === 'partial') return sum + Math.max(0, chanda.amount - (chanda.partialAmount || 0));
    return sum;
  }, 0);

  // Key figures: same calm white-card/colored-left-border style used on
  // every other page's widgets (Treasury, Chanda, etc.) — one muted accent
  // color per card instead of a full gradient background.
  const statTiles = [
    { title: t('dashboard.totalMembers'), value: members.length.toString(), subLabel: t('dashboard.totalMembersPaid'), subValue: `₹${totalMembershipPayments.toLocaleString()}`, icon: Users, accent: 'blue' },
    { title: t('dashboard.totalChanda'), value: `₹${totalChanda.toLocaleString()}`, icon: IndianRupee, accent: 'green' },
    { title: t('dashboard.donationAdsTotal'), value: `₹${totalDonationAds.toLocaleString()}`, icon: Gift, accent: 'emerald' },
    { title: t('dashboard.loansOutstanding'), value: `₹${totalLoansNet.toLocaleString()}`, icon: Landmark, accent: 'sky' },
    { title: t('dashboard.recentChanda'), value: `₹${recentChanda.toLocaleString()}`, icon: Wallet, accent: 'purple' },
    { title: t('dashboard.pendingDueChanda'), value: `₹${pendingDueChanda.toLocaleString()}`, icon: HandCoins, accent: 'amber' },
    { title: t('dashboard.totalExpenses'), value: `₹${totalExpenses.toLocaleString()}`, icon: TrendingDown, accent: 'red' },
    { title: t('dashboard.expenses'), value: expenses.length.toString(), icon: ClipboardList, accent: 'orange' },
  ];

  const ACCENT_CLASSES: Record<string, { border: string; icon: string; iconBg: string }> = {
    blue: { border: 'border-blue-500', icon: 'text-blue-600', iconBg: 'bg-blue-50' },
    green: { border: 'border-green-500', icon: 'text-green-600', iconBg: 'bg-green-50' },
    emerald: { border: 'border-emerald-500', icon: 'text-emerald-600', iconBg: 'bg-emerald-50' },
    sky: { border: 'border-sky-500', icon: 'text-sky-600', iconBg: 'bg-sky-50' },
    purple: { border: 'border-purple-500', icon: 'text-purple-600', iconBg: 'bg-purple-50' },
    amber: { border: 'border-amber-500', icon: 'text-amber-600', iconBg: 'bg-amber-50' },
    red: { border: 'border-red-500', icon: 'text-red-600', iconBg: 'bg-red-50' },
    orange: { border: 'border-orange-500', icon: 'text-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-500/10' },
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
              className={`bg-white dark:bg-gray-900 rounded-xl p-3.5 sm:p-5 border-l-4 ${accent.border} flex items-center gap-3 sm:gap-4`}
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

      {/* Year Selector and Download */}
      <div className="flex gap-3 items-center bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="bg-orange-500 p-2 rounded-lg shrink-0">
            <Calendar className="text-white" size={20} />
          </div>
          <select className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm">
            <option value="2026">{t('dashboard.selectYear')}: 2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
        <button className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md flex items-center gap-2 text-sm">
          <FileText size={18} />
          {t('dashboard.download')}
        </button>
      </div>
    </div>
  );
}
