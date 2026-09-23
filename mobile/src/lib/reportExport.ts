// CSV + PDF export for the mobile Reports module. Mirrors the web app's
// src/app/lib/reportExport.ts conventions (column-based CSV, branded PDF
// header) but built for React Native: expo-file-system writes the file,
// expo-sharing opens the native share sheet (the mobile equivalent of a
// browser "download"), and expo-print renders a branded HTML table to PDF.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { CommitteeInfo } from './db';

export interface ReportColumn<T> {
  key: string;
  label: string;
  render: (row: T) => string;
}

// Escapes a single CSV field: wraps in quotes and doubles any embedded
// quotes whenever the value contains a comma, quote, or newline.
export function csvField(value: string): string {
  const v = value ?? '';
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function buildCSV<T>(columns: ReportColumn<T>[], rows: T[]): string {
  const header = columns.map(c => csvField(c.label)).join(',');
  const lines = rows.map(row => columns.map(c => csvField(c.render(row))).join(','));
  return [header, ...lines].join('\n');
}

async function writeAndShare(content: string, filename: string, mimeType: string, dialogTitle: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text' });
  }
  return file.uri;
}

export async function exportCSV<T>(columns: ReportColumn<T>[], rows: T[], moduleLabel: string) {
  const csv = buildCSV(columns, rows);
  const filename = `${moduleLabel.replace(/\s+/g, '_')}_Report.csv`;
  return writeAndShare(csv, filename, 'text/csv', `Export ${moduleLabel} CSV`);
}

function escapeHtml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Builds the branded HTML used for the PDF: a header with the committee's
// logo + name (mirroring web's ReportPrintTable.tsx print header), then the
// module's data as a plain table.
export function buildReportHTML<T>(
  columns: ReportColumn<T>[],
  rows: T[],
  moduleLabel: string,
  committee: CommitteeInfo
): string {
  const committeeName = escapeHtml(committee.association || committee.name || 'Committee');
  const logoImg = committee.logo && /^https?:\/\//.test(committee.logo)
    ? `<img src="${committee.logo}" style="width:48px;height:48px;border-radius:24px;object-fit:cover;" />`
    : `<div style="width:48px;height:48px;border-radius:24px;background:#ea580c;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;">${escapeHtml((committeeName || 'C').charAt(0).toUpperCase())}</div>`;

  const headRow = columns.map(c => `<th style="text-align:left;padding:8px 10px;font-size:11px;border-bottom:2px solid #1c1917;color:#44403c;">${escapeHtml(c.label)}</th>`).join('');
  const bodyRows = rows.map(row => `<tr>${columns.map(c => `<td style="padding:7px 10px;font-size:11px;border-bottom:1px solid #eee7dd;color:#1c1917;">${escapeHtml(c.render(row))}</td>`).join('')}</tr>`).join('');

  return `
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        ${logoImg}
        <div>
          <div style="font-size:17px;font-weight:800;color:#1c1917;">${committeeName}</div>
          <div style="font-size:11px;color:#78716c;">${escapeHtml(moduleLabel)} Report</div>
        </div>
      </div>
      <div style="font-size:10px;color:#a8a29e;margin-bottom:14px;">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </body>
  </html>`;
}

export async function exportPDF<T>(
  columns: ReportColumn<T>[],
  rows: T[],
  moduleLabel: string,
  committee: CommitteeInfo
) {
  const html = buildReportHTML(columns, rows, moduleLabel, committee);
  const { uri } = await Print.printToFileAsync({ html });
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Export ${moduleLabel} PDF`, UTI: 'com.adobe.pdf' });
  }
  return uri;
}
