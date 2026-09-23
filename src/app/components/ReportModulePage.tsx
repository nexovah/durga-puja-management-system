import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Search, MoreVertical, Download, FileText, ChevronDown } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { Pagination, usePagination } from './Pagination';
import { ReportPrintTable } from './ReportPrintTable';
import { downloadTableCSV, SummaryLine } from '../lib/reportExport';

export interface ReportColumn<T> {
  key: string;
  label: string;
  align?: 'right';
  render: (row: T) => string;
}

export interface ReportWidget {
  label: string;
  value: string;
}

export type ReportChartType = 'bar' | 'area' | 'donut';

const PIE_COLORS = ['#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#ef4444', '#3b82f6', '#ec4899'];

type RangePreset = 'all' | 'thisMonth' | 'lastMonth' | 'custom';

export interface ReportModulePageProps<T extends { id: string }> {
  pageTitle: string;
  data: T[];
  dateOf: (row: T) => string | undefined;
  searchOf: (row: T) => string;
  columns: ReportColumn<T>[];
  chartType: ReportChartType;
  metricOf?: (row: T) => number;
  breakdownOf?: (rows: T[]) => { name: string; value: number }[];
  computeWidgets: (rows: T[]) => ReportWidget[];
  companyName: string;
  companyLogo: string;
}

export function ReportModulePage<T extends { id: string }>({
  pageTitle, data, dateOf, searchOf, columns, chartType, metricOf, breakdownOf, computeWidgets, companyName, companyLogo,
}: ReportModulePageProps<T>) {
  const { t, locale } = useLanguage();
  const { theme } = useTheme();
  const gridStroke = theme === 'dark' ? '#2d3138' : '#f0f0f0';
  const axisStroke = theme === 'dark' ? '#3d434b' : '#e5e7eb';

  const [rangePreset, setRangePreset] = useState<RangePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<{ rows: (string | number)[][]; summary: SummaryLine[]; rangeLabel: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!printData) return;
    const timer = setTimeout(() => window.print(), 50);
    const onAfterPrint = () => setPrintData(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printData]);

  // Reset selection whenever the filtered set changes shape, so stale
  // checked ids from a previous range/search don't silently linger.
  useEffect(() => { setSelected(new Set()); }, [rangePreset, customStart, customEnd, searchQuery]);

  const rangeBounds = useMemo((): { start: string; end: string } | null => {
    const now = new Date();
    if (rangePreset === 'thisMonth') {
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    }
    if (rangePreset === 'lastMonth') {
      const last = subMonths(now, 1);
      return { start: format(startOfMonth(last), 'yyyy-MM-dd'), end: format(endOfMonth(last), 'yyyy-MM-dd') };
    }
    if (rangePreset === 'custom') {
      if (!customStart || !customEnd) return null;
      return { start: customStart, end: customEnd };
    }
    return null; // 'all'
  }, [rangePreset, customStart, customEnd]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.filter(row => {
      if (rangeBounds) {
        const d = (dateOf(row) || '').slice(0, 10);
        if (!d || d < rangeBounds.start || d > rangeBounds.end) return false;
      }
      if (q && !searchOf(row).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, rangeBounds, searchQuery, dateOf, searchOf]);

  const widgets = useMemo(() => computeWidgets(filteredRows), [filteredRows, computeWidgets]);

  const chartData = useMemo(() => {
    if (chartType === 'donut') {
      return (breakdownOf ? breakdownOf(filteredRows) : []).filter(d => d.value > 0);
    }
    // bar/area: bucket by month
    const buckets: Record<string, number> = {};
    filteredRows.forEach(row => {
      const d = dateOf(row);
      if (!d) return;
      const key = d.slice(0, 7);
      buckets[key] = (buckets[key] || 0) + (metricOf ? metricOf(row) : 0);
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [y, m] = key.split('-').map(Number);
        return { key, label: new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' }), value };
      });
  }, [filteredRows, chartType, breakdownOf, metricOf, dateOf, locale]);

  const pagination = usePagination(filteredRows);

  const allChecked = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id));
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(filteredRows.map(r => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportRows = () => (selected.size > 0 ? filteredRows.filter(r => selected.has(r.id)) : filteredRows);

  const rangeLabel = () => {
    if (rangePreset === 'thisMonth') return t('report.range.thisMonth');
    if (rangePreset === 'lastMonth') return t('report.range.lastMonth');
    if (rangePreset === 'custom' && rangeBounds) return `${rangeBounds.start} – ${rangeBounds.end}`;
    return t('report.range.all');
  };

  const handleDownloadCSV = () => {
    const rows = exportRows();
    downloadTableCSV(`${pageTitle.toLowerCase().replace(/\s+/g, '-')}-report.csv`, {
      companyName,
      summary: computeWidgets(rows),
      headers: columns.map(c => c.label),
      rows: rows.map(row => columns.map(c => c.render(row))),
    });
    setMenuOpen(false);
  };

  const handleDownloadPDF = () => {
    const rows = exportRows();
    setPrintData({
      rows: rows.map(row => columns.map(c => c.render(row))),
      summary: computeWidgets(rows),
      rangeLabel: rangeLabel(),
    });
    setMenuOpen(false);
  };

  const inputClass = "px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
      </div>

      {/* Date range + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={rangePreset}
            onChange={e => setRangePreset(e.target.value as RangePreset)}
            className={`${inputClass} appearance-none pr-8`}
          >
            <option value="all">{t('report.range.all')}</option>
            <option value="thisMonth">{t('report.range.thisMonth')}</option>
            <option value="lastMonth">{t('report.range.lastMonth')}</option>
            <option value="custom">{t('report.range.custom')}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        {rangePreset === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={inputClass} />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={inputClass} />
          </>
        )}
      </div>

      {/* Chart + widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <ResponsiveContainer width="100%" height={280}>
            {chartType === 'donut' ? (
              <PieChart>
                <Pie data={chartData as { name: string; value: number }[]} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                  {(chartData as { name: string; value: number }[]).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              </PieChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData as { label: string; value: number }[]}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" stroke={axisStroke} fontSize={12} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="value" stroke="#f97316" fill="#fed7aa" strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={chartData as { label: string; value: number }[]}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" stroke={axisStroke} fontSize={12} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
          {chartType === 'donut' && (chartData as { name: string; value: number }[]).length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {(chartData as { name: string; value: number }[]).map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {widgets.map((w, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{w.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{w.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className={`${inputClass} w-full pl-9`}
            />
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{selected.size} {t('report.selected')}</span>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  <button onClick={handleDownloadCSV} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Download size={16} /> {t('treasury.report.downloadCSV')}
                  </button>
                  <button onClick={handleDownloadPDF} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <FileText size={16} /> {t('treasury.report.downloadPDF')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 rounded" />
                </th>
                {columns.map(c => (
                  <th key={c.key} className={`px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pagination.pageItems.map(row => (
                <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${selected.has(row.id) ? 'bg-orange-50/60 dark:bg-orange-500/10' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="w-4 h-4 rounded" />
                  </td>
                  {columns.map(c => (
                    <td key={c.key} className={`px-4 py-3 text-gray-700 dark:text-gray-300 ${c.align === 'right' ? 'text-right font-medium' : ''}`}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">{t('report.noData')}</div>
          )}
        </div>

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
        />
      </div>

      {printData && (
        <ReportPrintTable
          companyName={companyName}
          companyLogo={companyLogo}
          title={pageTitle}
          rangeLabel={printData.rangeLabel}
          summary={printData.summary}
          columns={columns.map(c => ({ label: c.label, align: c.align }))}
          rows={printData.rows}
          emptyMessage={t('report.noData')}
        />
      )}
    </div>
  );
}
