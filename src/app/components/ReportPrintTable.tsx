import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import { SummaryLine } from '../lib/reportExport';

export interface PrintColumn {
  label: string;
  align?: 'left' | 'right';
}

interface ReportPrintTableProps {
  companyName: string;
  companyLogo: string; // emoji or data:/http URL, same convention as CommitteeInfo.logo
  title: string;
  rangeLabel?: string;
  eventLabel?: string; // active Puja/Festival name+year — see EventSwitcher.tsx
  downloadedAt?: string; // pre-formatted date/time string, shown top-right when set
  summary: SummaryLine[];
  columns: PrintColumn[];
  rows: (string | number)[][];
  // Optional per-row color hint, parallel to `rows` — e.g. Balance Sheet's
  // income rows green, expenditure rows red. Omit or leave entries
  // undefined for rows that should stay the default black/gray.
  rowTones?: ('positive' | 'negative' | undefined)[];
  // Optional per-row bold hint, parallel to `rows` — e.g. Balance Sheet's
  // "Income"/"Expenditure" section header rows.
  boldRows?: boolean[];
  // Optional per-row "this is a subtotal of everything above" hint,
  // parallel to `rows` — draws the same dark top border as the header row
  // instead of the usual light divider (e.g. Balance Sheet's Total Income).
  strongTopBorderRows?: boolean[];
  // Optional per-row "this is the final figure" hint, parallel to `rows` —
  // dark top border plus extra row height (e.g. Balance Sheet's Closing
  // Balance).
  emphasizedRows?: boolean[];
  // Optional per-row "insert a visible blank gap above this row" hint,
  // parallel to `rows` — e.g. Balance Sheet separating its Income,
  // Expenditure and Closing Balance sections. A plain border-top margin
  // won't work across <tr>s, so this renders a real spacer row instead.
  sectionGapBeforeRows?: boolean[];
  emptyMessage: string;
}

// Shared print/PDF portal for every Reports module (generalized from
// Treasury.tsx's own print area, and Estimation.tsx's before that) —
// hidden on screen, shown only inside @media print via the `.print-area`
// class (see src/styles/globals.css), portaled to document.body so it's
// a sibling of #root and unaffected by #root's own display:none in
// print mode. Branded with the committee's logo + name at the top (a
// real embedded image, unlike the CSV export which can only carry the
// name as plain text — see reportExport.ts's downloadTableCSV), then
// the module's own summary widgets, then the data table.
export function ReportPrintTable({ companyName, companyLogo, title, rangeLabel, eventLabel, downloadedAt, summary, columns, rows, rowTones, boldRows, strongTopBorderRows, emphasizedRows, sectionGapBeforeRows, emptyMessage }: ReportPrintTableProps) {
  const isEmoji = companyLogo && companyLogo.length <= 10 && !companyLogo.startsWith('data:') && !companyLogo.startsWith('http');

  return createPortal(
    <div className="print-area hidden print:block bg-white text-gray-900 p-0">
      <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-300">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
            {isEmoji ? (
              <span className="text-2xl">{companyLogo}</span>
            ) : companyLogo ? (
              <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🕉️</span>
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{companyName}</p>
            {eventLabel && <p className="text-sm font-semibold text-orange-700">{eventLabel}</p>}
            <p className="text-sm text-gray-600">{title}{rangeLabel ? ` — ${rangeLabel}` : ''}</p>
          </div>
        </div>
        {downloadedAt && <p className="text-xs text-gray-500 whitespace-nowrap">{downloadedAt}</p>}
      </div>

      {summary.length > 0 && (
        <div className="flex gap-4 mb-6">
          {summary.map((s, i) => (
            <div key={i} className="flex-1 border border-gray-300 rounded-lg px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.tone === 'positive' ? 'text-green-700' : s.tone === 'negative' ? 'text-red-700' : 'text-gray-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800">
            {columns.map((c, i) => (
              <th key={i} className={`py-2 pr-2 text-sm font-bold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const tone = rowTones?.[i];
            const toneClass = tone === 'positive' ? 'text-green-700' : tone === 'negative' ? 'text-red-700' : '';
            const emphasized = emphasizedRows?.[i];
            const boldClass = boldRows?.[i] || emphasized ? 'font-bold' : '';
            const topBorderClass = emphasized || strongTopBorderRows?.[i] ? 'border-t-2 border-t-gray-800' : '';
            return (
              <Fragment key={i}>
                {sectionGapBeforeRows?.[i] && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: 40 }} />
                  </tr>
                )}
                <tr className={`border-b border-gray-300 ${topBorderClass}`}>
                  {row.map((cell, j) => {
                    const isAmountCell = columns[j]?.align === 'right';
                    return (
                      <td key={j} className={`${emphasized ? 'py-3' : 'py-1.5'} pr-2 ${emphasized ? 'text-sm' : 'text-xs'} ${isAmountCell ? 'text-right' : 'text-left'} ${isAmountCell ? toneClass : ''} ${boldClass}`}>{cell}</td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="py-6 text-center text-sm text-gray-500">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>,
    document.body
  );
}
