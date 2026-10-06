// Minimal CSV parser/serializer helpers used by the import/export features.
// Supports comma-separated values with optional double-quote escaping
// (RFC 4180 style: "" inside a quoted field represents a literal quote).

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Normalize line endings and strip a UTF-8 BOM if present
  const input = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Push the last field/row if the file doesn't end with a newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

export function csvField(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// A page's full set of exportable fields — a superset of its on-screen
// table columns (can include fields not shown in the table, e.g.
// Chanda's amount1/amount2 split). `value` returns the raw CSV-safe
// value for a row; `csvField` escaping is applied by `buildCsv` below.
export interface ExportColumnDef<T> {
  id: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
}

// Builds a CSV string containing only `orderedIds`, in that order —
// used by every page's Export button after the tenant picks columns via
// ExportColumnSelectorModal.
export function buildCsv<T>(rows: T[], columns: ExportColumnDef<T>[], orderedIds: string[]): string {
  const byId = new Map(columns.map(c => [c.id, c]));
  const selected = orderedIds.map(id => byId.get(id)).filter((c): c is ExportColumnDef<T> => !!c);
  const header = selected.map(c => csvField(c.label)).join(',');
  const body = rows.map(row => selected.map(c => csvField(c.value(row))).join(','));
  return [header, ...body].join('\n');
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
