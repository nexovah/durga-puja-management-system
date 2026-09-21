import { TrendingUp, TrendingDown, Wallet, Download, Gift, Landmark, Users } from 'lucide-react';
import { Chanda, DonationAd, Expense, Loan, Member, getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface TreasuryProps {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  members: Member[];
}

export function Treasury({ chandaList, donationAdsList, expenses, loansList, members }: TreasuryProps) {
  const { t, locale } = useLanguage();
  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);
  const totalDonationAds = donationAdsList.reduce((sum, item) => sum + item.amount, 0);
  const totalLoansNet = loansList.reduce((sum, loan) => sum + getLoanNetAmount(loan), 0);
  const totalMembership = members.reduce((sum, m) => sum + getMemberCreditAmount(m), 0);
  const membersPaidCount = members.filter(m => getMemberCreditAmount(m) > 0).length;
  const totalCredit = totalChanda + totalDonationAds + totalLoansNet + totalMembership;
  const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseCreditAmount(expense), 0);
  const balance = totalCredit - totalExpenses;

  // Monthly data
  const getMonthlyData = () => {
    const monthlyData: { [key: string]: { chanda: number; donationAds: number; membership: number; loans: number; expenses: number } } = {};

    chandaList.forEach(c => {
      const month = new Date(c.date).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, donationAds: 0, membership: 0, loans: 0, expenses: 0 };
      }
      monthlyData[month].chanda += getChandaCreditAmount(c);
    });

    donationAdsList.forEach(d => {
      const month = new Date(d.date).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, donationAds: 0, membership: 0, loans: 0, expenses: 0 };
      }
      monthlyData[month].donationAds += d.amount;
    });

    members.forEach(m => {
      if (!m.membershipDate) return;
      const month = new Date(m.membershipDate).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, donationAds: 0, membership: 0, loans: 0, expenses: 0 };
      }
      monthlyData[month].membership += getMemberCreditAmount(m);
    });

    loansList.forEach(l => {
      const month = new Date(l.date).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, donationAds: 0, membership: 0, loans: 0, expenses: 0 };
      }
      monthlyData[month].loans += getLoanNetAmount(l);
    });

    expenses.forEach(e => {
      const month = new Date(e.date).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, donationAds: 0, membership: 0, loans: 0, expenses: 0 };
      }
      monthlyData[month].expenses += getExpenseCreditAmount(e);
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        chanda: data.chanda,
        donationAds: data.donationAds,
        membership: data.membership,
        loans: data.loans,
        expenses: data.expenses,
        balance: data.chanda + data.donationAds + data.membership + data.loans - data.expenses,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  };

  const monthlyData = getMonthlyData();

  // Top donors (Chanda + Donation/Ads combined)
  const topDonors = Object.entries(
    [...chandaList.map(c => ({ name: c.donorName, amount: getChandaCreditAmount(c) })),
     ...donationAdsList.map(d => ({ name: d.donorName || d.companyName || '-', amount: d.amount }))]
      .reduce((acc, entry) => {
        acc[entry.name] = (acc[entry.name] || 0) + entry.amount;
        return acc;
      }, {} as { [key: string]: number })
  )
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Expense categories
  const expenseCategories = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + getExpenseCreditAmount(e);
      return acc;
    }, {} as { [key: string]: number })
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const handlePrintReport = () => {
    window.print();
  };

  const categoryLabel = (value: string) => {
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold"
          >
            <Download size={20} />
            {t('treasury.printReport')}
          </button>
        }
      >
        {t('treasury.pageTitle')}
      </PageHeading>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-green-500 dark:border-green-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.totalChanda')}</h3>
            <TrendingUp className="text-green-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-green-600">₹{totalChanda.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{chandaList.length} {t('treasury.transactions')}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-emerald-500 dark:border-emerald-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.totalDonationAds')}</h3>
            <Gift className="text-emerald-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-emerald-600">₹{totalDonationAds.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{donationAdsList.length} {t('treasury.transactions')}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-violet-500 dark:border-violet-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.totalMembership')}</h3>
            <Users className="text-violet-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-violet-600">₹{totalMembership.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{membersPaidCount} {t('treasury.membersPaid')}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-sky-500 dark:border-sky-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.loansOutstanding')}</h3>
            <Landmark className="text-sky-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-sky-600">₹{totalLoansNet.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{loansList.length} {t('treasury.transactions')}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-red-500 dark:border-red-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.totalExpenses')}</h3>
            <TrendingDown className="text-red-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-red-600">₹{totalExpenses.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{expenses.length} {t('treasury.transactions')}</p>
        </div>

        <div className={`bg-white dark:bg-gray-900 rounded-xl p-6 border ${balance >= 0 ? 'border-green-500 dark:border-green-500/60' : 'border-red-500 dark:border-red-500/60'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('treasury.currentBalance')}</h3>
            <Wallet className={balance >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{balance.toLocaleString()}
          </p>
          <p className={`text-sm mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balance >= 0 ? t('treasury.surplus') : t('treasury.deficit')}
          </p>
        </div>
      </div>

      {/* Monthly Report */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('treasury.monthlyReport')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.month')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.chanda')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.donationAds')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.totalMembership')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.loansOutstanding')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.expenses')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('treasury.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {monthlyData.map((data, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">{data.month}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold text-right">
                    ₹{data.chanda.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-emerald-600 font-bold text-right">
                    ₹{data.donationAds.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-violet-600 font-bold text-right">
                    ₹{data.membership.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-sky-600 font-bold text-right">
                    ₹{data.loans.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold text-right">
                    ₹{data.expenses.toLocaleString()}
                  </td>
                  <td className={`px-6 py-4 text-sm font-bold text-right ${data.balance >= 0 ? 'text-purple-600' : 'text-orange-600'}`}>
                    ₹{data.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {monthlyData.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('treasury.noMonthlyData')}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Donors */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('treasury.topDonors')}</h3>
          <div className="space-y-3">
            {topDonors.map((donor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{donor.name}</p>
                </div>
                <p className="text-green-600 font-bold">₹{donor.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
          {topDonors.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('treasury.noDonors')}</p>
          )}
        </div>

        {/* Expense Categories */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('treasury.expenseCategories')}</h3>
          <div className="space-y-3">
            {expenseCategories.map((cat, index) => {
              const percentage = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{categoryLabel(cat.category)}</span>
                    <span className="text-sm font-bold text-red-600">₹{cat.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{percentage.toFixed(1)}% {t('treasury.ofTotalExpenses')}</p>
                </div>
              );
            })}
          </div>
          {expenseCategories.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('treasury.noExpenses')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
