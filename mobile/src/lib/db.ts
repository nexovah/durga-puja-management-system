// Real Supabase data access — same tables, same column names, same RLS
// scoping as the web app's src/app/lib/db.ts. No mock/dummy data anywhere;
// every list/add/edit here reads and writes the tenant's real rows.
import { supabase } from './supabase';

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'rejected';
export type PaidMethod = 'notSelected' | 'cash' | 'qrScan' | 'onlineBanking' | 'check';
export type DonationAdCategory = 'donation' | 'ads';
export type ExpensePaymentStatus = 'paid' | 'partial' | 'cancelled';
export type PaidThrough = 'notSelected' | 'cash' | 'check' | 'qrPayment' | 'onlineBanking';

export type ChandaCategory = 'owner' | 'tenant' | 'apartment' | 'shop';

export interface Chanda {
  id: string;
  donorName: string;
  category?: ChandaCategory;
  numPersons?: number;
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
  // Links to a standing Donor/Committee-member record when picked via the
  // new search-and-pick field — null for free-typed Third-party entries.
  donorId?: string | null;
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
  paymentStatus: PaymentStatus;
  inKind: string;
  date: string;
  voucherNumber?: string;
  phone: string;
  phone2?: string;
  remarks: string;
  // donorId for Member-tab picks; advertiserId for Ads-category Third-
  // party Advertiser picks — null for free-typed/Donation-category entries.
  donorId?: string | null;
  advertiserId?: string | null;
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
  vendorContact2?: string;
  remarks: string;
  // Links to a standing Vendor record when picked via the new
  // search-and-pick field — null if somehow left free-typed.
  vendorId?: string | null;
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
    category: row.category || undefined,
    numPersons: row.num_persons === null || row.num_persons === undefined ? undefined : Number(row.num_persons),
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
    donorId: row.donor_id ?? null,
  };
}
function toChandaRow(c: Partial<Chanda>) {
  return {
    donor_name: c.donorName,
    category: c.category ?? null,
    num_persons: c.numPersons ?? null,
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
    donor_id: c.donorId ?? null,
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
    paymentStatus: row.payment_status || 'pending',
    inKind: row.in_kind || '',
    date: row.date || '',
    voucherNumber: row.voucher_number || '',
    phone: row.phone || '',
    phone2: row.phone2 || '',
    remarks: row.remarks || '',
    donorId: row.donor_id ?? null,
    advertiserId: row.advertiser_id ?? null,
  };
}
function toDonationAdRow(d: Partial<DonationAd>) {
  return {
    category: d.category,
    donor_name: d.donorName,
    company_name: d.companyName || null,
    amount: d.amount,
    paid_method: d.paidMethod,
    payment_status: d.paymentStatus,
    in_kind: d.inKind || '',
    date: d.date || null,
    voucher_number: d.category === 'donation' ? (d.voucherNumber || null) : null,
    phone: d.phone,
    phone2: d.phone2 || null,
    remarks: d.remarks || '',
    donor_id: d.donorId ?? null,
    advertiser_id: d.advertiserId ?? null,
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
    vendorContact2: row.vendor_contact2 || '',
    remarks: row.remarks || '',
    vendorId: row.vendor_id ?? null,
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
    vendor_contact2: e.vendorContact2 || null,
    remarks: e.remarks || '',
    vendor_id: e.vendorId ?? null,
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

// ---------------------------------------------------------------------------
// CMS pages (public read — legal + about pages, no auth needed; see
// supabase/055_cms_pages.sql). Mirrors web's src/app/lib/db.ts
// getCmsPageRequest() exactly (same table, same query, same columns).
// ---------------------------------------------------------------------------

export interface CmsPageContent {
  slug: string;
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  body: string;
}

function fromCmsPageRow(row: any): CmsPageContent {
  return {
    slug: row.slug,
    navLabel: row.nav_label,
    metaTitle: row.meta_title || '',
    metaDescription: row.meta_description || '',
    ogImageUrl: row.og_image_url || '',
    body: row.body || '',
  };
}

export async function getCmsPageRequest(slug: string): Promise<CmsPageContent | null> {
  const { data, error } = await supabase.from('cms_pages').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (error) throw error;
  return data ? fromCmsPageRow(data) : null;
}

// ---------------------------------------------------------------------------
// Activity log — mirrors web's src/app/lib/db.ts logActivity() exactly
// (same `activity_log` table, same column names). Web writes to this table
// client-side after every save, and mobile must do the same or the admin's
// Activity Log page never sees anything created/updated from the app.
// ---------------------------------------------------------------------------

export type ActivityModule = 'members' | 'chanda' | 'donation_ads' | 'expenses' | 'loans' | 'tasks' | 'estimation';
export type ActivityAction = 'create' | 'update';
export type ActivityDevice = 'android' | 'ios';

export interface ActivityFieldChange {
  field: string; // human-readable label, e.g. "Amount", "Phone"
  old: string;
  new: string;
}

export async function logActivity(entry: {
  userId: string;
  username: string;
  userName: string;
  action: ActivityAction;
  module: ActivityModule;
  summary: string;
  device: ActivityDevice;
  changes?: ActivityFieldChange[];
  recordLabel?: string;
}): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    user_id: entry.userId,
    username: entry.username,
    user_name: entry.userName,
    action: entry.action,
    module: entry.module,
    summary: entry.summary,
    record_count: 1,
    device: entry.device,
    changes: entry.changes && entry.changes.length > 0 ? entry.changes : null,
    record_label: entry.recordLabel ?? null,
  });
  if (error) console.error('Failed to write activity log', error);
}

// Compares two flat field-maps and returns only the fields that actually
// changed, formatted for the Activity Log's struck-through-old/plain-new
// diff display — mirrors web's src/app/lib/db.ts diffFields() exactly.
export function diffFields(
  before: Record<string, unknown> | undefined | null,
  after: Record<string, unknown>,
  labels: Record<string, string>
): ActivityFieldChange[] {
  if (!before) return [];
  const format = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  };
  const changes: ActivityFieldChange[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const oldVal = format(before[key]);
    const newVal = format(after[key]);
    if (oldVal !== newVal) changes.push({ field: label, old: oldVal, new: newVal });
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Festival (Puja / Event) selection — multiple festivals can now be
// `is_active` at once (supabase/149_multi_active_events.sql, web side:
// src/app/components/EventSwitcher.tsx), and each user independently picks
// which one they're working in (app_users.current_event_id), per-user not
// per-tenant. `tenants.active_event_id` is now vestigial — DO NOT read it;
// it stops being updated once that migration ships.
//
// Mobile stays "pick, don't manage" (marking a festival active/inactive is
// still web/admin-only, via ManageFestivalsPage.tsx) — but every role can
// now pick their own current festival from mobile too, mirroring the web
// EventSwitcher dropdown's instant, unconfirmed switch (low-stakes,
// personal, only affects this user's own session).
// ---------------------------------------------------------------------------
export interface ActiveEventInfo {
  id: string;
  name: string;
  year: number;
  emoji: string | null;
}

// What THIS user is currently viewing — resolves current_event_id()
// server-side (per-user now, not the old tenant-wide pointer), refetched on
// screen focus (useFocusEffect, same convention as HomeScreen/
// HelpSupportScreen) so it can't silently drift if this user switches
// their selection elsewhere (e.g. on web) mid-session.
export async function getMyCurrentEvent(): Promise<ActiveEventInfo | null> {
  const { data: eventId, error: rpcError } = await supabase.rpc('get_my_current_event');
  if (rpcError) throw rpcError;
  if (!eventId) return null;
  const { data, error } = await supabase
    .from('events')
    .select('id, name, year, emoji')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, year: data.year, emoji: data.emoji ?? null };
}

// Every festival currently in the tenant's active set — the pool this user
// can pick from. tenants has no RLS of its own, but `events` does
// (tenant-isolation only), so a plain filtered select works here.
export async function listActiveEvents(tenantId: string): Promise<ActiveEventInfo[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, year, emoji')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(d => ({ id: d.id, name: d.name, year: d.year, emoji: d.emoji ?? null }));
}

// Point this user's own selection at an active festival — no admin gate,
// no confirmation (same as web's EventSwitcher dropdown row click).
export async function setCurrentEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('set_current_event', { p_event_id: eventId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Donors / Committee members / Vendors / Advertisers — standing, tenant-wide
// entities (no event_id, reused across every festival), mirroring web's
// Donors.tsx/Committee.tsx/Vendors.tsx/Advertisers.tsx (supabase/
// 140_donors_committee.sql, 144_vendors_overhaul.sql, 147_advertisers.sql).
// Mobile intentionally stays list+create only — minimal name+phone quick-
// add, no update/delete, no address/category/WhatsApp editing (that stays
// a web-only task via the dedicated Donors/Vendors/Advertisers pages).
// ---------------------------------------------------------------------------

export interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  unitNo: string | null;
}

export interface CommitteeMember {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
}

export interface Advertiser {
  id: string;
  name: string;
  phone: string | null;
}

export async function listDonors(): Promise<Donor[]> {
  const { data, error } = await supabase.from('donors').select('id, first_name, last_name, phone, unit_no').order('first_name', { ascending: true });
  if (error) throw error;
  return (data || []).map(d => ({ id: d.id, firstName: d.first_name || '', lastName: d.last_name || '', phone: d.phone ?? null, unitNo: d.unit_no ?? null }));
}

export async function createDonor(input: { firstName: string; phone: string }): Promise<Donor> {
  const { data, error } = await supabase
    .from('donors')
    .insert({ first_name: input.firstName, phone: input.phone || null, type: 'owner', category: 'general' })
    .select('id, first_name, last_name, phone, unit_no')
    .single();
  if (error) throw error;
  return { id: data.id, firstName: data.first_name || '', lastName: data.last_name || '', phone: data.phone ?? null, unitNo: data.unit_no ?? null };
}

export async function listCommitteeMembers(): Promise<CommitteeMember[]> {
  const { data, error } = await supabase.from('committee_members').select('id, first_name, last_name, phone').eq('is_active', true).order('first_name', { ascending: true });
  if (error) throw error;
  return (data || []).map(m => ({ id: m.id, firstName: m.first_name || '', lastName: m.last_name || '', phone: m.phone ?? null }));
}

export async function listVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase.from('vendors').select('id, name, phone').order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(v => ({ id: v.id, name: v.name || '', phone: v.phone ?? null }));
}

export async function createVendor(input: { name: string; phone: string }): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .insert({ name: input.name, phone: input.phone || null })
    .select('id, name, phone')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name || '', phone: data.phone ?? null };
}

export async function listAdvertisers(): Promise<Advertiser[]> {
  const { data, error } = await supabase.from('advertisers').select('id, name, phone').order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(a => ({ id: a.id, name: a.name || '', phone: a.phone ?? null }));
}

export async function createAdvertiser(input: { name: string; phone: string }): Promise<Advertiser> {
  const { data, error } = await supabase
    .from('advertisers')
    .insert({ name: input.name, phone: input.phone || null })
    .select('id, name, phone')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name || '', phone: data.phone ?? null };
}
