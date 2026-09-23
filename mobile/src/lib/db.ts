// Real Supabase data access — same tables, same column names, same RLS
// scoping as the web app's src/app/lib/db.ts. No mock/dummy data anywhere;
// every list/add/edit here reads and writes the tenant's real rows.
import { supabase } from './supabase';

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'rejected';
export type PaidMethod = 'notSelected' | 'cash' | 'qrScan' | 'onlineBanking' | 'check';
export type DonationAdCategory = 'donation' | 'ads';
export type ExpensePaymentStatus = 'paid' | 'partial' | 'cancelled';
export type PaidThrough = 'notSelected' | 'cash' | 'check' | 'qrPayment' | 'onlineBanking';

export interface Chanda {
  id: string;
  donorName: string;
  amount: number;
  amount1?: number;
  amount2?: number;
  paidMethod: PaidMethod;
  paymentStatus: PaymentStatus;
  partialAmount?: number;
  date: string;
  billNumber?: string;
  phone: string;
  phone2?: string;
  remarks: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  joinDate: string;
  membershipAmount?: number;
  membershipPaidMethod?: PaidMethod;
  membershipPaymentStatus?: PaymentStatus;
  membershipPartialAmount?: number;
  membershipDate?: string;
  membershipBillNumber?: string;
  membershipRemarks?: string;
}

export interface DonationAd {
  id: string;
  category: DonationAdCategory;
  donorName: string;
  companyName?: string;
  amount: number;
  paidMethod: PaidMethod;
  inKind: string;
  date: string;
  voucherNumber?: string;
  phone: string;
  phone2?: string;
  remarks: string;
}

export interface ExpensePartialPayment {
  amount: number;
  voucherNumber?: string;
  date?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paymentStatus: ExpensePaymentStatus;
  partialPayments?: ExpensePartialPayment[];
  paidThrough: PaidThrough;
  date: string;
  category: string;
  voucherNumber?: string;
  vendorName?: string;
  vendorContact?: string;
  remarks: string;
}

export const getChandaCreditAmount = (c: Chanda): number => {
  switch (c.paymentStatus) {
    case 'paid': return c.amount;
    case 'partial': return c.partialAmount || 0;
    default: return 0;
  }
};

export const getMemberCreditAmount = (m: Member): number => {
  if (!m.membershipAmount) return 0;
  switch (m.membershipPaymentStatus) {
    case 'paid': return m.membershipAmount;
    case 'partial': return m.membershipPartialAmount || 0;
    default: return 0;
  }
};

export const getExpenseCreditAmount = (e: Expense): number => {
  switch (e.paymentStatus) {
    case 'paid': return e.amount;
    case 'partial': return (e.partialPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    default: return 0;
  }
};

// ---------------------------------------------------------------------------
// Row <-> model mapping — column names must match the web app exactly
// (same tables, same schema, see src/app/lib/db.ts on the web side).
// ---------------------------------------------------------------------------

function fromChandaRow(row: any): Chanda {
  return {
    id: row.id,
    donorName: row.donor_name,
    amount: Number(row.amount) || 0,
    amount1: row.amount1 === null || row.amount1 === undefined ? undefined : Number(row.amount1),
    amount2: row.amount2 === null || row.amount2 === undefined ? undefined : Number(row.amount2),
    paidMethod: row.paid_method,
    paymentStatus: row.payment_status,
    partialAmount: row.partial_amount ?? undefined,
    date: row.date,
    billNumber: row.bill_number || '',
    phone: row.phone || '',
    phone2: row.phone2 || '',
    remarks: row.remarks || '',
  };
}
function toChandaRow(c: Partial<Chanda>) {
  return {
    donor_name: c.donorName,
    amount: c.amount,
    amount1: c.amount1 ?? null,
    amount2: c.amount2 ?? null,
    paid_method: c.paidMethod,
    payment_status: c.paymentStatus,
    partial_amount: c.partialAmount ?? null,
    date: c.date,
    bill_number: c.billNumber || null,
    phone: c.phone,
    phone2: c.phone2 || null,
    remarks: c.remarks || '',
  };
}

function fromMemberRow(row: any): Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    address: row.address || '',
    role: row.role || '',
    joinDate: row.join_date,
    membershipAmount: row.membership_amount ?? undefined,
    membershipPaidMethod: row.membership_paid_method || undefined,
    membershipPaymentStatus: row.membership_payment_status || undefined,
    membershipPartialAmount: row.membership_partial_amount ?? undefined,
    membershipDate: row.membership_date || undefined,
    membershipBillNumber: row.membership_bill_number || '',
    membershipRemarks: row.membership_remarks || '',
  };
}
function toMemberRow(m: Partial<Member>) {
  return {
    name: m.name,
    phone: m.phone,
    address: m.address,
    role: m.role,
    join_date: m.joinDate,
    membership_amount: m.membershipAmount ?? null,
    membership_paid_method: m.membershipPaidMethod ?? null,
    membership_payment_status: m.membershipPaymentStatus ?? null,
    membership_partial_amount: m.membershipPartialAmount ?? null,
    membership_date: m.membershipDate || null,
    membership_bill_number: m.membershipBillNumber || null,
    membership_remarks: m.membershipRemarks || null,
  };
}

function fromDonationAdRow(row: any): DonationAd {
  return {
    id: row.id,
    category: row.category,
    donorName: row.donor_name || '',
    companyName: row.company_name || '',
    amount: Number(row.amount) || 0,
    paidMethod: row.paid_method,
    inKind: row.in_kind || '',
    date: row.date || '',
    voucherNumber: row.voucher_number || '',
    phone: row.phone || '',
    phone2: row.phone2 || '',
    remarks: row.remarks || '',
  };
}
function toDonationAdRow(d: Partial<DonationAd>) {
  return {
    category: d.category,
    donor_name: d.donorName,
    company_name: d.companyName || null,
    amount: d.amount,
    paid_method: d.paidMethod,
    in_kind: d.inKind || '',
    date: d.date || null,
    voucher_number: d.category === 'donation' ? (d.voucherNumber || null) : null,
    phone: d.phone,
    phone2: d.phone2 || null,
    remarks: d.remarks || '',
  };
}

function fromExpenseRow(row: any): Expense {
  const partialPayments: ExpensePartialPayment[] | undefined = Array.isArray(row.partial_payments)
    ? row.partial_payments.map((p: any) => ({
        amount: Number(p.amount) || 0,
        voucherNumber: p.voucherNumber || undefined,
        date: p.date || undefined,
      }))
    : undefined;
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount) || 0,
    paymentStatus: row.payment_status,
    partialPayments,
    paidThrough: row.paid_through,
    date: row.date,
    category: row.category,
    voucherNumber: row.voucher_number || '',
    vendorName: row.vendor_name || '',
    vendorContact: row.vendor_contact || '',
    remarks: row.remarks || '',
  };
}
function toExpenseRow(e: Partial<Expense>) {
  return {
    title: e.title,
    amount: e.amount,
    payment_status: e.paymentStatus,
    partial_payments: e.partialPayments && e.partialPayments.length > 0 ? e.partialPayments : null,
    paid_through: e.paidThrough,
    date: e.date,
    category: e.category,
    voucher_number: e.voucherNumber || null,
    vendor_name: e.vendorName || null,
    vendor_contact: e.vendorContact || null,
    remarks: e.remarks || '',
  };
}

// ---------------------------------------------------------------------------
// CRUD — list/create/update only, no delete anywhere (v1 scope).
// ---------------------------------------------------------------------------

export async function listChanda(): Promise<Chanda[]> {
  const { data, error } = await supabase.from('chanda').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromChandaRow);
}
export async function createChanda(c: Omit<Chanda, 'id'>): Promise<Chanda> {
  const { data, error } = await supabase.from('chanda').insert(toChandaRow(c)).select().single();
  if (error) throw error;
  return fromChandaRow(data);
}
export async function updateChanda(id: string, c: Partial<Chanda>): Promise<Chanda> {
  const { data, error } = await supabase.from('chanda').update(toChandaRow(c)).eq('id', id).select().single();
  if (error) throw error;
  return fromChandaRow(data);
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase.from('members').select('*').order('join_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromMemberRow);
}
export async function createMember(m: Omit<Member, 'id'>): Promise<Member> {
  const { data, error } = await supabase.from('members').insert(toMemberRow(m)).select().single();
  if (error) throw error;
  return fromMemberRow(data);
}
export async function updateMember(id: string, m: Partial<Member>): Promise<Member> {
  const { data, error } = await supabase.from('members').update(toMemberRow(m)).eq('id', id).select().single();
  if (error) throw error;
  return fromMemberRow(data);
}

export async function listDonationAds(category?: DonationAdCategory): Promise<DonationAd[]> {
  let query = supabase.from('donation_ads').select('*').order('date', { ascending: false });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(fromDonationAdRow);
}
export async function createDonationAd(d: Omit<DonationAd, 'id'>): Promise<DonationAd> {
  const { data, error } = await supabase.from('donation_ads').insert(toDonationAdRow(d)).select().single();
  if (error) throw error;
  return fromDonationAdRow(data);
}
export async function updateDonationAd(id: string, d: Partial<DonationAd>): Promise<DonationAd> {
  const { data, error } = await supabase.from('donation_ads').update(toDonationAdRow(d)).eq('id', id).select().single();
  if (error) throw error;
  return fromDonationAdRow(data);
}

export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromExpenseRow);
}
export async function createExpense(e: Omit<Expense, 'id'>): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').insert(toExpenseRow(e)).select().single();
  if (error) throw error;
  return fromExpenseRow(data);
}
export async function updateExpense(id: string, e: Partial<Expense>): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').update(toExpenseRow(e)).eq('id', id).select().single();
  if (error) throw error;
  return fromExpenseRow(data);
}

export interface CommitteeInfo {
  name: string;
  association: string;
  logo: string;
  email: string;
  phone: string;
  mobile1: string;
  address: string;
}

// ---------------------------------------------------------------------------
// Vendors — read-only, derived from Expense.vendorName/vendorContact, same
// as the web app's Vendors.tsx (there is no separate 'vendors' table).
// ---------------------------------------------------------------------------

export interface VendorGroup {
  key: string;
  name: string;
  contact: string;
  entries: Expense[];
  totalAmount: number; // sum of credited/received amount (getExpenseCreditAmount)
  totalContractAmount: number; // sum of raw agreed amount, regardless of payment status
  categories: string[];
}

export function vendorGroupsFromExpenses(expenses: Expense[]): VendorGroup[] {
  const withVendor = expenses.filter(exp => (exp.vendorName || '').trim() !== '');
  const groups = new Map<string, VendorGroup>();
  for (const exp of withVendor) {
    const name = (exp.vendorName || '').trim();
    const contact = (exp.vendorContact || '').trim();
    const key = `${name.toLowerCase()}|${contact.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { key, name, contact, entries: [], totalAmount: 0, totalContractAmount: 0, categories: [] });
    }
    const group = groups.get(key)!;
    group.entries.push(exp);
    group.totalAmount += getExpenseCreditAmount(exp);
    group.totalContractAmount += exp.amount;
    if (!group.categories.includes(exp.category)) group.categories.push(exp.category);
  }
  return [...groups.values()]
    .map(g => ({ ...g, entries: g.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export async function getCommitteeInfo(): Promise<CommitteeInfo> {
  const { data, error } = await supabase.from('committee_info').select('*').limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return { name: '', association: '', logo: '', email: '', phone: '', mobile1: '', address: '' };
  return {
    name: data.name || '',
    association: data.association || '',
    logo: data.logo_url || '',
    email: data.email || '',
    phone: data.phone || '',
    mobile1: data.mobile1 || '',
    address: data.address || '',
  };
}
