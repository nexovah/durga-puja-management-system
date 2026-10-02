import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth,
  subDays, subMonths,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format,
} from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { Chanda, DonationAd, Expense, Loan, Member, getChandaCreditAmount, getDonationAdCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount, getAwardCreditAmount } from '../App';
import { Award } from '../lib/db';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { TranslationKey } from '../i18n/translations';
import { DONUT_COLORS } from './DashboardDonut';

// Same palette as DashboardDonut/DashboardCategoryBars — Income reuses the
// Sponsorship/Ads green, Expenses reuses the Loan red, so a category reads
// the same color everywhere on the dashboard.
const INCOME_COLOR = DONUT_COLORS[3];
const EXPENSE_COLOR = DONUT_COLORS[5];

interface DashboardChartProps {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  members: Member[];
  awardsList: Award[];
}

type RangeKey = 'allTime' | '7d' | '30d' | '3m' | '6m';
type Granularity = 'day' | 'week' | 'month';

const RANGES: { key: RangeKey; labelKey: TranslationKey; granularity: Granularity }[] = [
  { key: 'allTime', labelKey: 'dashboard.chart.range.allTime', granularity: 'month' },
  { key: '7d', labelKey: 'dashboard.chart.range.7d', granularity: 'day' },
  { key: '30d', labelKey: 'dashboard.chart.range.30d', granularity: 'day' },
  { key: '3m', labelKey: 'dashboard.chart.range.3m', granularity: 'week' },
  { key: '6m', labelKey: 'dashboard.chart.range.6m', granularity: 'month' },
];

// 'allTime' has no fixed lookback — its start is the earliest record date
// across everything shown in this chart, computed by the caller and passed
// in (falls back to `now` when there's no data yet).
function getRangeBounds(key: RangeKey, earliestDate: Date): { start: Date; end: Date } {
  const now = new Date();
  switch (key) {
    case 'allTime':
      return { start: startOfDay(earliestDate), end: endOfDay(now) };
    case '7d':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
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

export function DashboardChart({ chandaList, donationAdsList, expenses, loansList, members, awardsList }: DashboardChartProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const gridStroke = theme === 'dark' ? '#2d3138' : '#f0f0f0';
  const axisStroke = theme === 'dark' ? '#3d434b' : '#e5e7eb';
  const axisTick = theme === 'dark' ? '#9aa1ae' : '#6b7280';
  const tooltipStyle = theme === 'dark'
    ? { borderRadius: 8, border: '1px solid #3d434b', fontSize: 13, background: '#1c1f24', color: '#e5e7eb' }
    : { borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 };
  const [range, setRange] = useState<RangeKey>('allTime');

  const incomeRecords: Record_[] = useMemo(() => [
    ...chandaList.map(c => ({ date: c.date, amount: getChandaCreditAmount(c) })),
    ...donationAdsList.map(d => ({ date: d.date, amount: getDonationAdCreditAmount(d) })),
    ...loansList.map(l => ({ date: l.date, amount: getLoanNetAmount(l) })),
    ...members.filter(m => m.membershipDate).map(m => ({ date: m.membershipDate as string, amount: getMemberCreditAmount(m) })),
    ...awardsList.map(a => ({ date: a.awardedDate, amount: getAwardCreditAmount(a) })),
  ], [chandaList, donationAdsList, loansList, members, awardsList]);

  // Partial-status expenses spread their credited amount across each
  // installment's own date (partialPayments[].date), not the expense's
  // single creation date — otherwise the whole partial sum piles onto one
  // day, producing artificial spikes instead of reflecting when money
  // actually moved. Paid/cancelled/default-status expenses have no
  // installment dates, so they stay a single record on e.date.
  const expenseRecords: Record_[] = useMemo(() => (
    expenses.flatMap(e => {
      if (e.paymentStatus === 'partial' && (e.partialPayments || []).length > 0) {
        return e.partialPayments!.map(p => ({ date: p.date || e.date, amount: p.amount || 0 }));
      }
      return [{ date: e.date, amount: getExpenseCreditAmount(e) }];
    })
  ), [expenses]);

  const activeRange = RANGES.find(r => r.key === range) || RANGES[0];

  const earliestDate = useMemo(() => {
    const now = new Date();
    const allDates = [...incomeRecords, ...expenseRecords]
      .map(r => (r.date ? new Date(r.date) : null))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));
    if (allDates.length === 0) return now;
    return allDates.reduce((earliest, d) => (d < earliest ? d : earliest), now);
  }, [incomeRecords, expenseRecords]);

  const chartData = useMemo(() => {
    const { start, end } = getRangeBounds(range, earliestDate);

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
  }, [range, incomeRecords, expenseRecords, earliestDate]);

  const { start, end } = useMemo(() => getRangeBounds(range, earliestDate), [range, earliestDate]);
  const totalIncome = sumInRange(incomeRecords, start, end);
  const totalExpense = sumInRange(expenseRecords, start, end);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <TrendingUp size={20} className="text-orange-600" />
            {t('dashboard.chart.title')}
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm">
            <span className="text-green-600 font-semibold">{t('dashboard.chart.income')}: ₹{totalIncome.toLocaleString()}</span>
            <span className="text-red-600 font-semibold">{t('dashboard.chart.expenses')}: ₹{totalExpense.toLocaleString()}</span>
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
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400'
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
                <stop offset="5%" stopColor={INCOME_COLOR} stopOpacity={0.35} />
                <stop offset="95%" stopColor={INCOME_COLOR} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={EXPENSE_COLOR} stopOpacity={0.3} />
                <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: axisTick }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: axisTick }}
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
              contentStyle={tooltipStyle}
            />
            <Legend
              formatter={(value) => (value === 'income' ? t('dashboard.chart.income') : t('dashboard.chart.expenses'))}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke={INCOME_COLOR}
              strokeWidth={2}
              fill="url(#incomeGradient)"
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={EXPENSE_COLOR}
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
