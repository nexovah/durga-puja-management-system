// Builds a detailed, transaction-level treasury ledger for a chosen date
// range (a specific month, or a custom from/to range) — the "monthly
// report" table on the Treasury page only ever showed per-month totals,
// with no way to see or export the underlying transactions. Used by both
// the CSV export and the print/PDF report (TreasuryReportModal.tsx).

import { csvField } from './csv';
import { Chanda, DonationAd, Expense, Loan, Member, getChandaCreditAmount, getExpenseCreditAmount, getLoanNetAmount, getMemberCreditAmount } from '../App';

export interface LedgerRow {
  date: string; // ISO yyyy-mm-dd
  type: string; // localized: Chanda / Donation / Ads / Membership / Loan / Expense
  name: string; // donor/vendor/member/lender name
  detail: string; // category/status/notes
  credit: number; // money in
  debit: number; // money out
}

export interface DateRange {
  start: string; // ISO yyyy-mm-dd, inclusive
  end: string; // ISO yyyy-mm-dd, inclusive
}

const inRange = (dateStr: string, range: DateRange) => {
  const d = (dateStr || '').slice(0, 10);
  return d >= range.start && d <= range.end;
};

export interface LedgerSources {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  members: Member[];
  loansList: Loan[];
  expenses: Expense[];
}

export interface LedgerLabels {
  chanda: string;
  donation: string;
  ads: string;
  membership: string;
  loan: string;
  expense: string;
  categoryLabel: (value: string) => string;
  statusLabel: (status: string) => string;
}

export function buildLedger(range: DateRange, sources: LedgerSources, labels: LedgerLabels): LedgerRow[] {
  const rows: LedgerRow[] = [];

  sources.chandaList.forEach(c => {
    if (!inRange(c.date, range)) return;
    rows.push({
      date: c.date,
      type: labels.chanda,
      name: c.donorName,
      detail: labels.statusLabel(c.paymentStatus),
      credit: getChandaCreditAmount(c),
      debit: 0,
    });
  });

  sources.donationAdsList.forEach(d => {
    if (!inRange(d.date, range)) return;
    rows.push({
      date: d.date,
      type: d.category === 'ads' ? labels.ads : labels.donation,
      name: d.donorName || d.companyName || '-',
      detail: d.companyName && d.donorName ? d.companyName : '',
      credit: d.amount,
      debit: 0,
    });
  });

  sources.members.forEach(m => {
    if (!m.membershipDate || !inRange(m.membershipDate, range)) return;
    const amount = getMemberCreditAmount(m);
    if (amount <= 0) return;
    rows.push({
      date: m.membershipDate,
      type: labels.membership,
      name: m.name,
      detail: '',
      credit: amount,
      debit: 0,
    });
  });

  sources.loansList.forEach(l => {
    if (!inRange(l.date, range)) return;
    const net = getLoanNetAmount(l);
    rows.push({
      date: l.date,
      type: labels.loan,
      name: l.donorName,
      detail: '',
      credit: net > 0 ? net : 0,
      debit: net < 0 ? -net : 0,
    });
  });

  sources.expenses.forEach(e => {
    if (!inRange(e.date, range)) return;
    rows.push({
      date: e.date,
      type: labels.expense,
      name: e.vendorName || e.title,
      detail: labels.categoryLabel(e.category),
      credit: 0,
      debit: getExpenseCreditAmount(e),
    });
  });

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function ledgerTotals(rows: LedgerRow[]) {
  const credit = rows.reduce((sum, r) => sum + r.credit, 0);
  const debit = rows.reduce((sum, r) => sum + r.debit, 0);
  return { credit, debit, balance: credit - debit };
}

export function downloadLedgerCSV(filename: string, rows: LedgerRow[], headers: { date: string; type: string; name: string; detail: string; credit: string; debit: string }) {
  const csvContent = [
    [headers.date, headers.type, headers.name, headers.detail, headers.credit, headers.debit].map(csvField).join(','),
    ...rows.map(r => [r.date, r.type, r.name, r.detail, r.credit || '', r.debit || ''].map(csvField).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
