import { TrendingUp, TrendingDown, Wallet, Download } from 'lucide-react';
import { Chanda, Expense } from '../App';
import { PageHeading } from './PageHeading';

interface TreasuryProps {
  chandaList: Chanda[];
  expenses: Expense[];
}

export function Treasury({ chandaList, expenses }: TreasuryProps) {
  const totalChanda = chandaList.reduce((sum, chanda) => sum + chanda.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = totalChanda - totalExpenses;

  // Monthly data
  const getMonthlyData = () => {
    const monthlyData: { [key: string]: { chanda: number; expenses: number } } = {};
    
    chandaList.forEach(c => {
      const month = new Date(c.date).toLocaleDateString('bn-IN', { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, expenses: 0 };
      }
      monthlyData[month].chanda += c.amount;
    });

    expenses.forEach(e => {
      const month = new Date(e.date).toLocaleDateString('bn-IN', { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { chanda: 0, expenses: 0 };
      }
      monthlyData[month].expenses += e.amount;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        chanda: data.chanda,
        expenses: data.expenses,
        balance: data.chanda - data.expenses,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  };

  const monthlyData = getMonthlyData();

  // Top donors
  const topDonors = Object.entries(
    chandaList.reduce((acc, c) => {
      acc[c.donorName] = (acc[c.donorName] || 0) + c.amount;
      return acc;
    }, {} as { [key: string]: number })
  )
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Expense categories
  const expenseCategories = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as { [key: string]: number })
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
          >
            <Download size={20} />
            রিপোর্ট প্রিন্ট করুন
          </button>
        }
      >
        কোষাধ্যক্ষ - আর্থিক সারাংশ
      </PageHeading>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">মোট চাঁদা</h3>
            <TrendingUp className="text-green-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-green-600">₹{totalChanda.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">{chandaList.length} টি লেনদেন</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">মোট খরচ</h3>
            <TrendingDown className="text-red-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-red-600">₹{totalExpenses.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">{expenses.length} টি লেনদেন</p>
        </div>

        <div className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${balance >= 0 ? 'border-purple-500' : 'border-orange-500'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">বর্তমান ব্যালেন্স</h3>
            <Wallet className={balance >= 0 ? 'text-purple-500' : 'text-orange-500'} size={24} />
          </div>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-purple-600' : 'text-orange-600'}`}>
            ₹{balance.toLocaleString()}
          </p>
          <p className={`text-sm mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balance >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি'}
          </p>
        </div>
      </div>

      {/* Monthly Report */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">মাসিক রিপোর্ট</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মাস</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">চাঁদা</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">খরচ</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">ব্যালেন্স</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {monthlyData.map((data, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{data.month}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold text-right">
                    ₹{data.chanda.toLocaleString()}
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
            <div className="text-center py-12 text-gray-500">
              কোনো মাসিক ডেটা নেই
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Donors */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">শীর্ষ দাতা</h3>
          <div className="space-y-3">
            {topDonors.map((donor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <p className="font-medium text-gray-800">{donor.name}</p>
                </div>
                <p className="text-green-600 font-bold">₹{donor.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
          {topDonors.length === 0 && (
            <p className="text-gray-500 text-center py-8">কোনো দাতা নেই</p>
          )}
        </div>

        {/* Expense Categories */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">খরচের বিভাগ</h3>
          <div className="space-y-3">
            {expenseCategories.map((cat, index) => {
              const percentage = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                    <span className="text-sm font-bold text-red-600">₹{cat.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% মোট খরচের</p>
                </div>
              );
            })}
          </div>
          {expenseCategories.length === 0 && (
            <p className="text-gray-500 text-center py-8">কোনো খরচ নেই</p>
          )}
        </div>
      </div>
    </div>
  );
}