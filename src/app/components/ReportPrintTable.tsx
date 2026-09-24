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
export function ReportPrintTable({ companyName, companyLogo, title, rangeLabel, eventLabel, downloadedAt, summary, columns, rows, emptyMessage }: ReportPrintTableProps) {
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
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
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
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-300">
              {row.map((cell, j) => (
                <td key={j} className={`py-1.5 pr-2 text-xs ${columns[j]?.align === 'right' ? 'text-right' : 'text-left'}`}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="py-6 text-center text-sm text-gray-500">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>,
    document.body
  );
}
