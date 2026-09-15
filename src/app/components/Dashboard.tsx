import { Users, IndianRupee, TrendingDown, Wallet, ShoppingCart, BarChart3, Shield, MessageSquare, Calendar, FileText, UserCheck, PieChart, Database, ClipboardList, Gift, HandCoins, Landmark } from 'lucide-react';
import { Member, Chanda, DonationAd, Expense, Loan, getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { DashboardChart } from './DashboardChart';

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
  const totalCredit = totalChanda + totalDonationAds + totalLoansNet;
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

  // Key figures: compact, data-dense cards
  const statTiles = [
    { title: t('dashboard.totalMembers'), value: members.length.toString(), icon: Users, color: 'from-blue-500 to-blue-600' },
    { title: t('dashboard.totalChanda'), value: `₹${totalChanda.toLocaleString()}`, icon: IndianRupee, color: 'from-green-500 to-green-600' },
    { title: t('dashboard.donationAdsTotal'), value: `₹${totalDonationAds.toLocaleString()}`, icon: Gift, color: 'from-emerald-500 to-emerald-600' },
    { title: t('dashboard.loansOutstanding'), value: `₹${totalLoansNet.toLocaleString()}`, icon: Landmark, color: 'from-sky-500 to-sky-600' },
    { title: t('dashboard.recentChanda'), value: `₹${recentChanda.toLocaleString()}`, icon: Wallet, color: 'from-purple-500 to-purple-600' },
    { title: t('dashboard.pendingDueChanda'), value: `₹${pendingDueChanda.toLocaleString()}`, icon: HandCoins, color: 'from-amber-500 to-amber-600' },
    { title: t('dashboard.totalExpenses'), value: `₹${totalExpenses.toLocaleString()}`, icon: TrendingDown, color: 'from-red-500 to-red-600' },
    { title: t('dashboard.expenses'), value: expenses.length.toString(), icon: ClipboardList, color: 'from-orange-500 to-orange-600' },
  ];

  // Quick-access shortcuts: no live number yet, so a smaller icon+label tile
  const actionTiles = [
    { title: t('dashboard.sales'), icon: ShoppingCart, color: 'from-purple-600 to-purple-700' },
    { title: t('dashboard.treasuryManagement'), icon: Wallet, color: 'from-cyan-500 to-cyan-600' },
    { title: t('dashboard.arbitration'), icon: FileText, color: 'from-pink-500 to-pink-600' },
    { title: t('dashboard.budget'), icon: BarChart3, color: 'from-indigo-500 to-indigo-600' },
    { title: t('dashboard.daily'), icon: Calendar, color: 'from-teal-600 to-teal-700' },
    { title: t('dashboard.messages'), icon: MessageSquare, color: 'from-blue-600 to-blue-700' },
    { title: t('dashboard.securityAudit'), icon: Shield, color: 'from-red-600 to-red-700' },
    { title: t('dashboard.subscriptions'), icon: UserCheck, color: 'from-purple-600 to-purple-700' },
    { title: t('dashboard.review'), icon: PieChart, color: 'from-fuchsia-500 to-fuchsia-600' },
    { title: t('dashboard.backup'), icon: Database, color: 'from-gray-600 to-gray-700' },
  ];

  return (
    <div className="space-y-4">
      {/* Collections vs Expenses chart */}
      <DashboardChart chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} />

      {/* Key figures — bigger cards, capped at 4 per row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {statTiles.map((tile, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${tile.color} rounded-xl p-4 sm:p-5 shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-3 sm:gap-4`}
          >
            <div className="bg-white/20 p-3 rounded-xl shrink-0">
              <tile.icon className="text-white" size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-white/90 text-sm font-medium leading-tight truncate">{tile.title}</p>
              <p className="text-white text-xl sm:text-2xl font-bold leading-tight truncate">{tile.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick access — small icon tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2.5 sm:gap-3">
        {actionTiles.map((tile, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${tile.color} rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 aspect-square sm:aspect-auto sm:h-[4.5rem] p-2`}
          >
            <tile.icon className="text-white" size={18} />
            <p className="text-white text-[11px] sm:text-xs font-bold leading-tight">{tile.title}</p>
          </div>
        ))}
      </div>

      {/* Year Selector and Download */}
      <div className="flex gap-3 items-center bg-white rounded-xl p-3 sm:p-4 shadow-md flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="bg-orange-500 p-2 rounded-lg shrink-0">
            <Calendar className="text-white" size={20} />
          </div>
          <select className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm">
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
