// Same vocabulary as the web app's translation strings (English only for
// v1 — no i18n on mobile yet), just plain lookup objects instead of a
// translation function.
import { PaidMethod, PaymentStatus, ExpensePaymentStatus, PaidThrough } from './db';
import { TaskPriority } from './tasks';

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
  low: { bg: '#dbeafe', text: '#1e40af' },
  medium: { bg: '#fef3c7', text: '#92400e' },
  high: { bg: '#fee2e2', text: '#b91c1c' },
  note: { bg: '#f1ede7', text: '#44403c' },
  completed: { bg: '#dcfce7', text: '#166534' },
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  note: 'Note',
  completed: 'Completed',
};

export const genId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// Turns a camelCase enum value (e.g. "assistantSecretary") into a readable
// title-cased label (e.g. "Assistant Secretary"), matching the web app's
// hardcoded role labels without needing to duplicate every enum value.
export const formatCamelLabel = (value?: string): string => {
  if (!value) return '';
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return spaced
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatAmount = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

export const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const todayISO = (): string => new Date().toISOString().split('T')[0];
