import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { LucideIcon } from 'lucide-react';

export const DONUT_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#ec4899'];

export interface DashboardDonutSlice {
  name: string;
  value: number;
  /** Optional second legend row under this slice — own label on the left, own value (+ optional light-gray parenthetical, e.g. a %) on the right. */
  countRow?: { label: string; value: string; subValue?: string };
  /** Overrides the auto-computed "% of this donut's total" — e.g. "% of this category's own total billed amount" instead, when slices aren't meant to be compared against each other. */
  pctOverride?: number;
  /** Per-slice color override — only honored for `ringSlices`, not the legend's `slices` (which always uses the shared `colors` palette by index). */
  color?: string;
}

interface DashboardDonutProps {
  title: string;
  icon: LucideIcon;
  iconAccent?: string; // Tailwind text-color class, defaults to orange
  slices: DashboardDonutSlice[];
  emptyMessage: string;
  colors?: string[]; // override default palette (e.g. amber/blue for Cash vs Bank)
  // Optional big number shown above (or, in compact mode, beside) the
  // chart — e.g. a grand/billed total that isn't itself one of the
  // (mutually exclusive) slices below it.
  grandTotal?: { label: string; value: number };
  // Horizontal layout: title row on top, then chart + grandTotal/legend
  // side by side in one row instead of stacked — roughly half the height
  // of the default vertical layout. Default layout (used elsewhere on the
  // Dashboard) is unchanged.
  compact?: boolean;
  // Number centered inside the donut's own hole (vs grandTotal, which sits
  // above/beside the chart) — the "Total / 2.758"-style ring from modern
  // analytics dashboards. Independent of grandTotal; a caller can use
  // either, both, or neither.
  centerTotal?: { label: string; value: string };
  // Overrides what the ring itself is drawn from (legend still renders
  // from `slices`) — e.g. showing [pending, already-collected] against a
  // grand total instead of a per-category breakdown, while the legend
  // below keeps listing the detailed per-category figures.
  ringSlices?: DashboardDonutSlice[];
}

// Shared donut widget for Dashboard's new analytics section — copies the
// donut pattern already proven in ReportModulePage.tsx (innerRadius 70/
// outerRadius 110, same card wrapper), so every new breakdown widget looks
// and behaves consistently instead of four one-off chart implementations.
export function DashboardDonut({ title, icon: Icon, iconAccent = 'text-orange-600', slices, emptyMessage, colors = DONUT_COLORS, grandTotal, compact = false, centerTotal, ringSlices }: DashboardDonutProps) {
  const nonZero = slices.filter(s => s.value > 0);
  const total = nonZero.reduce((s, d) => s + d.value, 0);
  const ringData = (ringSlices ?? nonZero).filter(s => s.value > 0);

  const legend = (
    <div className={compact ? 'space-y-1' : 'space-y-1.5 mt-3'}>
      {nonZero.map((d, i) => {
        const pct = d.pctOverride !== undefined ? d.pctOverride : (total > 0 ? (d.value / total) * 100 : 0);
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1 h-4 rounded shrink-0" style={{ background: colors[i % colors.length] }} />
                <span className="text-gray-600 dark:text-gray-400 truncate">{d.name}</span>
              </div>
              <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0 ml-2">
                ₹{d.value.toLocaleString()} <span className="text-gray-400 dark:text-gray-500 font-normal">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            {d.countRow && (
              <div className="flex items-center justify-between text-xs mt-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1 h-4 rounded shrink-0 bg-gray-300 dark:bg-gray-600" />
                  <span className="text-gray-600 dark:text-gray-400 truncate">{d.countRow.label}</span>
                </div>
                <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0 ml-2">
                  {d.countRow.value}{d.countRow.subValue && <span className="text-gray-400 dark:text-gray-500 font-normal"> ({d.countRow.subValue})</span>}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const chart = (
    <div className={`relative w-full ${compact ? 'h-full' : 'h-[220px]'}`}>
      <ResponsiveContainer width="100%" height={compact ? '100%' : 220}>
        <PieChart>
          <Pie data={ringData} dataKey="value" nameKey="name" innerRadius={compact ? '55%' : 60} outerRadius={compact ? '100%' : 90} paddingAngle={2}>
            {ringData.map((d, i) => (
              <Cell key={i} fill={d.color || colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
        </PieChart>
      </ResponsiveContainer>
      {centerTotal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-gray-500 dark:text-gray-400">{centerTotal.label}</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{centerTotal.value}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 ${compact ? 'p-4 h-full flex flex-col' : 'p-4 sm:p-5'}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <Icon className={iconAccent} size={18} />
        <h3 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">{title}</h3>
      </div>

      {!compact && grandTotal && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{grandTotal.label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">₹{grandTotal.value.toLocaleString()}</p>
        </div>
      )}

      {nonZero.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-16">{emptyMessage}</p>
      ) : compact ? (
        <div className="flex items-center gap-6 flex-1">
          <div className="w-40 h-40 sm:w-44 sm:h-44 shrink-0">{chart}</div>
          <div className="flex-1 min-w-0">
            {grandTotal && (
              <div className="mb-1.5">
                <p className="text-xs text-gray-500 dark:text-gray-400">{grandTotal.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">₹{grandTotal.value.toLocaleString()}</p>
              </div>
            )}
            {legend}
          </div>
        </div>
      ) : (
        <>
          {chart}
          {legend}
        </>
      )}
    </div>
  );
}
