import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { LucideIcon } from 'lucide-react';

const DONUT_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#ec4899'];

export interface DashboardDonutSlice {
  name: string;
  value: number;
}

interface DashboardDonutProps {
  title: string;
  icon: LucideIcon;
  iconAccent?: string; // Tailwind text-color class, defaults to orange
  slices: DashboardDonutSlice[];
  emptyMessage: string;
  colors?: string[]; // override default palette (e.g. amber/blue for Cash vs Bank)
}

// Shared donut widget for Dashboard's new analytics section — copies the
// donut pattern already proven in ReportModulePage.tsx (innerRadius 70/
// outerRadius 110, same card wrapper), so every new breakdown widget looks
// and behaves consistently instead of four one-off chart implementations.
export function DashboardDonut({ title, icon: Icon, iconAccent = 'text-orange-600', slices, emptyMessage, colors = DONUT_COLORS }: DashboardDonutProps) {
  const nonZero = slices.filter(s => s.value > 0);
  const total = nonZero.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={iconAccent} size={18} />
        <h3 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">{title}</h3>
      </div>

      {nonZero.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-16">{emptyMessage}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {nonZero.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {nonZero.map((d, i) => {
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                    <span className="text-gray-600 dark:text-gray-400 truncate">{d.name}</span>
                  </div>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0 ml-2">
                    ₹{d.value.toLocaleString()} <span className="text-gray-400 dark:text-gray-500 font-normal">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
