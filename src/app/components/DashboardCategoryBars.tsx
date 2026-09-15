import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Chanda, DonationAd, Expense, Loan, Member, getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount } from '../App';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardCategoryBarsProps {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  members: Member[];
}

// All-time category totals as 6 pillars: Chanda (paid/credited), Donation
// (category === 'donation'), Ads (category === 'ads'), Expenses (paid/
// credited), Loan (net received), Membership (members' own payments,
// credited). Not tied to the collections-vs-expenses chart's date-range
// selector — these are running totals from the data already loaded into
// the other pages, no new query/DB change needed.
export function DashboardCategoryBars({ chandaList, donationAdsList, expenses, loansList, members }: DashboardCategoryBarsProps) {
  const { t } = useLanguage();

  const totalChanda = chandaList.reduce((sum, c) => sum + getChandaCreditAmount(c), 0);
  const totalDonation = donationAdsList
    .filter(d => d.category === 'donation')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalAds = donationAdsList
    .filter(d => d.category === 'ads')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + getExpenseCreditAmount(e), 0);
  const totalLoan = loansList.reduce((sum, l) => sum + getLoanNetAmount(l), 0);
  const totalMembership = members.reduce((sum, m) => sum + getMemberCreditAmount(m), 0);

  const data = [
    { key: 'membership', label: t('dashboard.chart.pillar.membership'), value: totalMembership, color: '#9333ea' },
    { key: 'chanda', label: t('dashboard.chart.pillar.chanda'), value: totalChanda, color: '#16a34a' },
    { key: 'donation', label: t('dashboard.chart.pillar.donation'), value: totalDonation, color: '#059669' },
    { key: 'ads', label: t('dashboard.chart.pillar.ads'), value: totalAds, color: '#0d9488' },
    { key: 'expenses', label: t('dashboard.chart.pillar.expenses'), value: totalExpenses, color: '#dc2626' },
    { key: 'loan', label: t('dashboard.chart.pillar.loan'), value: totalLoan, color: '#0284c7' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 border border-gray-200 h-full flex flex-col">
      <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
        <BarChart3 size={20} className="text-orange-600" />
        {t('dashboard.chart.pillars.title')}
      </h3>
      <div className="flex-1 h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: -12, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => `₹${v.toLocaleString()}`}
                style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
