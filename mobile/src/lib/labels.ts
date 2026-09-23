// Same vocabulary as the web app's translation strings (English only for
// v1 — no i18n on mobile yet), just plain lookup objects instead of a
// translation function.
import { PaidMethod, PaymentStatus, ExpensePaymentStatus, PaidThrough } from './db';

export const PAID_METHOD_LABEL: Record<PaidMethod, string> = {
  notSelected: 'Not Selected',
  cash: 'Cash',
  qrScan: 'QR Scan',
  onlineBanking: 'Online Banking',
  check: 'Check Payment',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  partial: 'Partial',
  rejected: 'Rejected',
};

export const EXPENSE_STATUS_LABEL: Record<ExpensePaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  cancelled: 'Cancelled',
};

export const PAID_THROUGH_LABEL: Record<PaidThrough, string> = {
  notSelected: 'Not Selected',
  cash: 'Cash',
  check: 'Check Payment',
  qrPayment: 'QR Payment',
  onlineBanking: 'Online Banking',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid: { bg: '#dcfce7', text: '#166534' },
  pending: { bg: '#fef3c7', text: '#92400e' },
  partial: { bg: '#dbeafe', text: '#1e40af' },
  rejected: { bg: '#fee2e2', text: '#b91c1c' },
  cancelled: { bg: '#fee2e2', text: '#b91c1c' },
};

export const formatAmount = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

export const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const todayISO = (): string => new Date().toISOString().split('T')[0];
