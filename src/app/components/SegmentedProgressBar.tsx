export interface ProgressSegment {
  label: string;
  value: number;
  color: string;
  /** Right-aligned raw figure shown next to the %, e.g. a ₹ amount or a count already formatted as a string. */
  countLabel?: string;
}

// A single horizontal bar split into colored segments by share of the
// total, with a legend row per segment (colored tick + label + % + raw
// figure) below it — the "Conversion Rates"-style widget this app didn't
// have yet. Card shell matches every other Dashboard widget (white/
// gray-900, rounded-xl, bordered, no shadow).
export function SegmentedProgressBar({ title, segments }: { title: string; segments: ProgressSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h3 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>

      {total <= 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">—</p>
      ) : (
        <>
          <div className="h-2 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800">
            {segments.filter(seg => seg.value > 0).map((seg, i) => (
              <div key={i} style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }} />
            ))}
          </div>
          <div className="mt-4 space-y-1.5">
            {segments.map((seg, i) => {
              const pct = total > 0 ? (seg.value / total) * 100 : 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1 h-4 rounded shrink-0" style={{ background: seg.color }} />
                    <span className="text-gray-600 dark:text-gray-400 truncate">{seg.label}</span>
                  </div>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0 ml-2">
                    {seg.countLabel} <span className="text-gray-400 dark:text-gray-500 font-normal">({pct.toFixed(0)}%)</span>
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
