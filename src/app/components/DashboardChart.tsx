import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth,
  subDays, subWeeks, subMonths, addDays, addWeeks, addMonths,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format,
} from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { Chanda, DonationAd, Expense, Loan, getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface DashboardChartProps {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
}

type RangeKey = '7d' | 'thisWeek' | 'lastWeek' | '30d' | '3m' | '6m';
type Granularity = 'day' | 'week' | 'month';

const RANGES: { key: RangeKey; labelKey: TranslationKey; granularity: Granularity }[] = [
  { key: '7d', labelKey: 'dashboard.chart.range.7d', granularity: 'day' },
  { key: 'thisWeek', labelKey: 'dashboard.chart.range.thisWeek', granularity: 'day' },
  { key: 'lastWeek', labelKey: 'dashboard.chart.range.lastWeek', granularity: 'day' },
  { key: '30d', labelKey: 'dashboard.chart.range.30d', granularity: 'day' },
  { key: '3m', labelKey: 'dashboard.chart.range.3m', granularity: 'week' },
  { key: '6m', labelKey: 'dashboard.chart.range.6m', granularity: 'month' },
];

function getRangeBounds(key: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  switch (key) {
    case '7d':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case 'thisWeek':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'lastWeek': {
      const lastWeekDay = subWeeks(now, 1);
      return { start: startOfWeek(lastWeekDay, { weekStartsOn: 1 }), end: endOfWeek(lastWeekDay, { weekStartsOn: 1 }) };
    }
    case '30d':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case '3m':
      return { start: startOfDay(subMonths(now, 3)), end: endOfDay(now) };
    case '6m':
      return { start: startOfDay(subMonths(now, 6)), end: endOfDay(now) };
  }
}

interface Record_ { date: string; amount: number }

function sumInRange(records: Record_[], start: Date, end: Date): number {
  return records.reduce((sum, r) => {
    if (!r.date) return sum;
    const d = new Date(r.date);
    return d >= start && d <= end ? sum + r.amount : sum;
  }, 0);
}

export function DashboardChart({ chandaList, donationAdsList, expenses, loansList }: DashboardChartProps) {
  const { t } = useLanguage();
  const [range, setRange] = useState<RangeKey>('30d');

  const incomeRecords: Record_[] = useMemo(() => [
    ...chandaList.map(c => ({ date: c.date, amount: getChandaCreditAmount(c) })),
    ...donationAdsList.map(d => ({ date: d.date, amount: d.amount })),
    ...loansList.map(l => ({ date: l.date, amount: getLoanNetAmount(l) })),
  ], [chandaList, donationAdsList, loansList]);

  const expenseRecords: Record_[] = useMemo(() => (
    expenses.map(e => ({ date: e.date, amount: getExpenseCreditAmount(e) }))
  ), [expenses]);

  const activeRange = RANGES.find(r => r.key === range) || RANGES[3];

  const chartData = useMemo(() => {
    const { start, end } = getRangeBounds(range);

    if (activeRange.granularity === 'day') {
      return eachDayOfInterval({ start, end }).map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        return {
          label: format(day, 'd MMM'),
          income: sumInRange(incomeRecords, dayStart, dayEnd),
          expenses: sumInRange(expenseRecords, dayStart, dayEnd),
        };
      });
    }

    if (activeRange.granularity === 'week') {
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(weekStart => {
        const wStart = startOfWeek(weekStart, { weekStartsOn: 1 });
        const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        return {
          label: format(wStart, 'd MMM'),
          income: sumInRange(incomeRecords, wStart, wEnd),
          expenses: sumInRange(expenseRecords, wStart, wEnd),
        };
      });
    }

    return eachMonthOfInterval({ start, end }).map(monthStart => {
      const mStart = startOfMonth(monthStart);
      const mEnd = endOfMonth(monthStart);
      return {
        label: format(mStart, 'MMM yyyy'),
        income: sumInRange(incomeRecords, mStart, mEnd),
        expenses: sumInRange(expenseRecords, mStart, mEnd),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, incomeRecords, expenseRecords]);

  const { start, end } = useMemo(() => getRangeBounds(range), [range]);
  const totalIncome = sumInRange(incomeRecords, start, end);
  const totalExpense = sumInRange(expenseRecords, start, end);
  const netBalance = totalIncome - totalExpense;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 border border-gray-200">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-orange-600" />
            {t('dashboard.chart.title')}
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm">
            <span className="text-green-600 font-semibold">{t('dashboard.chart.income')}: ₹{totalIncome.toLocaleString()}</span>
            <span className="text-red-600 font-semibold">{t('dashboard.chart.expenses')}: ₹{totalExpense.toLocaleString()}</span>
            <span className={`font-semibold ${netBalance >= 0 ? 'text-purple-600' : 'text-orange-600'}`}>
              {t('dashboard.chart.newBalance')}: ₹{netBalance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                range === r.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `₹${value.toLocaleString()}`,
                name === 'income' ? t('dashboard.chart.income') : t('dashboard.chart.expenses'),
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
            />
            <Legend
              formatter={(value) => (value === 'income' ? t('dashboard.chart.income') : t('dashboard.chart.expenses'))}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#16a34a"
              strokeWidth={2}
              fill="url(#incomeGradient)"
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#dc2626"
              strokeWidth={2}
              fill="url(#expenseGradient)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
