// Data-access layer: every read/write to Supabase goes through this file.
// Field names are converted between the frontend's camelCase objects and the
// database's snake_case columns here, so the rest of the app never has to
// think about it (see supabase/README.md for the full mapping table).

import { supabase, setTenantAccessToken } from './supabaseClient';
import {
  User,
  CommitteeInfo,
  Member,
  Chanda,
  DonationAd,
  Expense,
  Loan,
  Task,
  Estimation,
} from '../App';

export interface DeveloperInfo {
  name: string;
  email: string;
  phone: string;
  version: string;
  changelog?: string;
}

// ---------------------------------------------------------------------------
// Row <-> object mapping
// ---------------------------------------------------------------------------

function fromMemberRow(row: any): Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    address: row.address || '',
    role: row.role || '',
    joinDate: row.join_date,
    membershipAmount: row.membership_amount === null || row.membership_amount === undefined ? undefined : Number(row.membership_amount),
    membershipPaidMethod: row.membership_paid_method || undefined,
    membershipPaymentStatus: row.membership_payment_status || undefined,
    membershipPartialAmount: row.membership_partial_amount === null || row.membership_partial_amount === undefined ? undefined : Number(row.membership_partial_amount),
    membershipDate: row.membership_date || undefined,
    membershipBillNumber: row.membership_bill_number || '',
    membershipRemarks: row.membership_remarks || '',
  };
}
function toMemberRow(m: Member) {
  return {
    id: m.id,
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

function fromChandaRow(row: any): Chanda {
  return {
    id: row.id,
    donorName: row.donor_name,
    amount: Number(row.amount) || 0,
    amount1: row.amount1 === null || row.amount1 === undefined ? undefined : Number(row.amount1),
    amount2: row.amount2 === null || row.amount2 === undefined ? undefined : Number(row.amount2),
    paidMethod: row.paid_method,
    paymentStatus: row.payment_status,
    partialAmount: row.partial_amount === null || row.partial_amount === undefined ? undefined : Number(row.partial_amount),
    date: row.date,
    billNumber: row.bill_number || '',
    phone: row.phone || '',
    phone2: row.phone2 || '',
    remarks: row.remarks || '',
  };
}
function toChandaRow(c: Chanda) {
  return {
    id: c.id,
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
    remarks: c.remarks,
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
function toDonationAdRow(d: DonationAd) {
  return {
    id: d.id,
    category: d.category,
    donor_name: d.donorName,
    company_name: d.companyName || null,
    amount: d.amount,
    paid_method: d.paidMethod,
    in_kind: d.inKind,
    date: d.date || null,
    voucher_number: d.category === 'donation' ? (d.voucherNumber || null) : null,
    phone: d.phone,
    phone2: d.phone2 || null,
    remarks: d.remarks,
  };
}

function fromExpenseRow(row: any): Expense {
  const partials = Array.isArray(row.partial_amounts)
    ? row.partial_amounts.map((v: any) => (v === null || v === undefined ? undefined : Number(v)))
    : undefined;
  const partialDates = Array.isArray(row.partial_dates)
    ? row.partial_dates.map((v: any) => (v === null || v === undefined ? undefined : v))
    : undefined;
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount) || 0,
    paymentStatus: row.payment_status,
    partialAmounts: partials,
    partialDates,
    paidThrough: row.paid_through,
    date: row.date,
    category: row.category,
    voucherNumber: row.voucher_number || '',
    vendorName: row.vendor_name || '',
    vendorContact: row.vendor_contact || '',
    remarks: row.remarks || '',
  };
}
function toExpenseRow(e: Expense) {
  return {
    id: e.id,
    title: e.title,
    amount: e.amount,
    payment_status: e.paymentStatus,
    partial_amounts: e.partialAmounts ? e.partialAmounts.map(v => (v === undefined ? null : v)) : null,
    partial_dates: e.partialDates ? e.partialDates.map(v => (v === undefined || v === '' ? null : v)) : null,
    paid_through: e.paidThrough,
    date: e.date,
    category: e.category,
    voucher_number: e.voucherNumber || null,
    vendor_name: e.vendorName || null,
    vendor_contact: e.vendorContact || null,
    remarks: e.remarks,
  };
}

function fromLoanRow(row: any): Loan {
  return {
    id: row.id,
    donorName: row.donor_name,
    amountReceived: Number(row.amount_received) || 0,
    amountPaid: Number(row.amount_paid) || 0,
    phone: row.phone || '',
    paymentMethod: row.payment_method,
    paymentStatus: 'paid',
    date: row.date,
    returnDate: row.return_date || '',
    remarks: row.remarks || '',
  };
}
function toLoanRow(l: Loan) {
  return {
    id: l.id,
    donor_name: l.donorName,
    amount_received: l.amountReceived,
    amount_paid: l.amountPaid || 0,
    phone: l.phone,
    payment_method: l.paymentMethod,
    payment_status: 'paid',
    date: l.date,
    return_date: l.returnDate || null,
    remarks: l.remarks,
  };
}

function fromTaskRow(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    priority: row.priority,
    createdAt: row.created_at,
    expiryDate: row.expiry_date || '',
    assignedMemberIds: row.assigned_member_ids || [],
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || '',
  };
}
function toTaskRow(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    created_at: task.createdAt,
    expiry_date: task.expiryDate || null,
    assigned_member_ids: task.assignedMemberIds || [],
    created_by: task.createdBy || null,
    created_by_name: task.createdByName || null,
  };
}

const DEFAULT_ESTIMATION_COLUMN_LABELS = {
  serialNo: 'S. No.',
  title: 'Title',
  customField: 'Custom Field',
  customField2: 'Custom Field 02',
  amount: 'Amount',
};

function fromEstimationRow(row: any): Estimation {
  return {
    id: row.id,
    title: row.title || '',
    lineItems: row.line_items || [],
    columnLabels: { ...DEFAULT_ESTIMATION_COLUMN_LABELS, ...(row.column_labels || {}) },
    createdAt: row.created_at,
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || '',
  };
}
function toEstimationRow(estimation: Estimation) {
  return {
    id: estimation.id,
    title: estimation.title || '',
    line_items: estimation.lineItems || [],
    column_labels: estimation.columnLabels || DEFAULT_ESTIMATION_COLUMN_LABELS,
    created_at: estimation.createdAt,
    created_by: estimation.createdBy || null,
    created_by_name: estimation.createdByName || null,
  };
}

function fromCommitteeRow(row: any): CommitteeInfo {
  return {
    id: row.id,
    name: row.name || '',
    logo: row.logo_url || '',
    established: row.established || '',
    regNumber: row.reg_number || '',
    association: row.association || '',
    post: row.post || '',
    districtPS: row.district_ps || '',
    pinCode: row.pin_code || '',
    mobile1: row.mobile1 || '',
    mobile2: row.mobile2 || '',
    address: row.address || '',
    phone: row.phone || '',
    year: row.year || '',
  };
}
function toCommitteeRow(c: CommitteeInfo) {
  return {
    name: c.name,
    logo_url: c.logo,
    established: c.established,
    reg_number: c.regNumber,
    association: c.association,
    post: c.post,
    district_ps: c.districtPS,
    pin_code: c.pinCode,
    mobile1: c.mobile1,
    mobile2: c.mobile2 || null,
    address: c.address,
    phone: c.phone,
    year: c.year,
  };
}

function fromDeveloperRow(row: any): DeveloperInfo {
  return {
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    version: row.version || '',
    changelog: row.changelog || '',
  };
}

function fromUserRow(row: any): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password: '', // never stored/returned client-side; see supabase/README.md
    isAdmin: row.is_admin,
    canEdit: row.can_edit !== false, // defaults true for older rows before this column existed
    canDelete: row.can_delete !== false, // defaults true for older rows before this column existed
    canBulkImport: row.can_bulk_import !== false, // defaults true for older rows before this column existed
    isActive: row.is_active !== false, // defaults true for older rows before this column existed
    permissions: row.permissions,
    tenantId: row.tenant_id,
    accessToken: row.access_token,
    subscriptionExpiresAt: row.subscription_expires_at,
  };
}

// ---------------------------------------------------------------------------
// Bulk fetch — called once on app load
// ---------------------------------------------------------------------------

export async function fetchAllData() {
  const [membersRes, chandaRes, donationAdsRes, expensesRes, loansRes, tasksRes, estimationsRes, committeeRes, developerRes, usersRes] =
    await Promise.all([
      supabase.from('members').select('*').order('join_date', { ascending: false }),
      supabase.from('chanda').select('*').order('date', { ascending: false }),
      supabase.from('donation_ads').select('*').order('date', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('loans').select('*').order('date', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('estimations').select('*').order('created_at', { ascending: false }),
      // No .eq('id', ...) here anymore — committee_info is now one row per
      // tenant (see supabase/020_multi_tenant.sql), and RLS already scopes
      // every request to exactly the caller's tenant, so this always
      // returns that tenant's single row.
      supabase.from('committee_info').select('*').limit(1).maybeSingle(),
      supabase.from('developer_info').select('*').eq('id', 1).single(),
      supabase.from('app_users').select('*').order('created_at', { ascending: true }),
    ]);

  const firstError =
    membersRes.error || chandaRes.error || donationAdsRes.error || expensesRes.error || loansRes.error ||
    tasksRes.error || estimationsRes.error || committeeRes.error || developerRes.error || usersRes.error;
  if (firstError) throw firstError;

  return {
    members: (membersRes.data || []).map(fromMemberRow),
    chandaList: (chandaRes.data || []).map(fromChandaRow),
    donationAdsList: (donationAdsRes.data || []).map(fromDonationAdRow),
    expenses: (expensesRes.data || []).map(fromExpenseRow),
    loansList: (loansRes.data || []).map(fromLoanRow),
    tasksList: (tasksRes.data || []).map(fromTaskRow),
    estimationsList: (estimationsRes.data || []).map(fromEstimationRow),
    committeeInfo: fromCommitteeRow(committeeRes.data),
    developerInfo: fromDeveloperRow(developerRes.data),
    users: (usersRes.data || []).map(fromUserRow),
  };
}

// ---------------------------------------------------------------------------
// Generic list sync: diffs an old array against a new array (both keyed by
// `id`) and issues the minimal insert/update/delete calls to match. Used by
// App.tsx so Members/Chanda/DonationAds/Expenses pages can keep calling
// `setMembers(wholeNewArray)` etc. exactly like they did with localStorage.
// ---------------------------------------------------------------------------

export async function syncList<T extends { id: string }>(
  table: 'members' | 'chanda' | 'donation_ads' | 'expenses' | 'loans' | 'tasks' | 'estimations',
  oldList: T[],
  newList: T[],
  toRow: (item: T) => any
): Promise<void> {
  const oldMap = new Map(oldList.map(item => [item.id, item]));
  const newMap = new Map(newList.map(item => [item.id, item]));

  const inserts: T[] = [];
  const updates: T[] = [];
  for (const [id, item] of newMap) {
    const previous = oldMap.get(id);
    if (!previous) inserts.push(item);
    else if (JSON.stringify(previous) !== JSON.stringify(item)) updates.push(item);
  }
  const deletes: string[] = [...oldMap.keys()].filter(id => !newMap.has(id));

  if (inserts.length) {
    const { error } = await supabase.from(table).insert(inserts.map(toRow));
    if (error) throw error;
  }
  for (const item of updates) {
    const { error } = await supabase.from(table).update(toRow(item)).eq('id', item.id);
    if (error) throw error;
  }
  if (deletes.length) {
    const { error } = await supabase.from(table).delete().in('id', deletes);
    if (error) throw error;
  }
}

export const syncMembers = (oldList: Member[], newList: Member[]) =>
  syncList('members', oldList, newList, toMemberRow);
export const syncChanda = (oldList: Chanda[], newList: Chanda[]) =>
  syncList('chanda', oldList, newList, toChandaRow);
export const syncDonationAds = (oldList: DonationAd[], newList: DonationAd[]) =>
  syncList('donation_ads', oldList, newList, toDonationAdRow);
export const syncExpenses = (oldList: Expense[], newList: Expense[]) =>
  syncList('expenses', oldList, newList, toExpenseRow);
export const syncLoans = (oldList: Loan[], newList: Loan[]) =>
  syncList('loans', oldList, newList, toLoanRow);
export const syncTasks = (oldList: Task[], newList: Task[]) =>
  syncList('tasks', oldList, newList, toTaskRow);
export const syncEstimations = (oldList: Estimation[], newList: Estimation[]) =>
  syncList('estimations', oldList, newList, toEstimationRow);

// ---------------------------------------------------------------------------
// Singleton settings rows
// ---------------------------------------------------------------------------

export async function updateCommitteeInfo(info: CommitteeInfo): Promise<void> {
  // No id/tenant filter needed — RLS already scopes this update to exactly
  // the caller's tenant's single committee_info row (see
  // supabase/020_multi_tenant.sql). PostgREST requires *some* filter to
  // avoid a full-table update, so match on the primary key it just read.
  const { error } = await supabase.from('committee_info').update(toCommitteeRow(info)).eq('id', info.id);
  if (error) throw error;
}

export async function updateDeveloperInfo(info: DeveloperInfo): Promise<void> {
  const { error } = await supabase.from('developer_info').update(info).eq('id', 1);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Committee logo upload (Supabase Storage — see supabase/storage.sql)
// ---------------------------------------------------------------------------

export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `committee-logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('logos').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Auth / user management — all go through Postgres RPC functions
// (see supabase/schema.sql and supabase/002_user_management.sql)
// ---------------------------------------------------------------------------

// Called after a successful payment (Billing.tsx) to pick up the new expiry
// the serverless verify-payment/webhook route just wrote, without a full
// re-login. RLS scopes this to the caller's own tenant.
export async function fetchTenantSubscriptionExpiry(tenantId: string): Promise<string | null> {
  const { data, error } = await supabase.from('tenants').select('subscription_expires_at').eq('id', tenantId).single();
  if (error) throw error;
  return data?.subscription_expires_at ?? null;
}

export async function loginRequest(username: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.rpc('login', { p_username: username, p_password: password });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];
  // Every request after this must carry the per-tenant token RLS relies on
  // (see supabase/020_multi_tenant.sql) — set it before returning so the
  // very next fetch (e.g. fetchAllData on login) is already tenant-scoped.
  setTenantAccessToken(row.access_token || null);
  return fromUserRow(row);
}

export async function createUserRequest(
  name: string,
  username: string,
  password: string,
  permissions: User['permissions'],
  canEdit: boolean,
  canDelete: boolean,
  canBulkImport: boolean
): Promise<User> {
  const { data, error } = await supabase.rpc('create_app_user', {
    p_name: name,
    p_username: username,
    p_password: password,
    p_permissions: permissions,
    p_can_edit: canEdit,
    p_can_delete: canDelete,
    p_can_bulk_import: canBulkImport,
  });
  if (error) throw error;
  return fromUserRow(data[0]);
}

export async function updateUserRequest(
  userId: string,
  name: string,
  permissions: User['permissions'],
  canEdit: boolean,
  canDelete: boolean,
  canBulkImport: boolean,
  newPassword?: string
): Promise<User> {
  const { data, error } = await supabase.rpc('update_app_user', {
    p_user_id: userId,
    p_name: name,
    p_permissions: permissions,
    p_new_password: newPassword || null,
    p_can_edit: canEdit,
    p_can_delete: canDelete,
    p_can_bulk_import: canBulkImport,
  });
  if (error) throw error;
  return fromUserRow(data[0]);
}

export async function deleteUserRequest(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_app_user', { p_user_id: userId });
  if (error) throw error;
  return Boolean(data);
}

export async function setUserActiveRequest(userId: string, isActive: boolean): Promise<User> {
  const { data, error } = await supabase.rpc('set_app_user_active', { p_user_id: userId, p_is_active: isActive });
  if (error) throw error;
  return fromUserRow(data[0]);
}

export async function changeOwnPasswordRequest(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('change_password', {
    p_user_id: userId,
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });
  if (error) throw error;
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Activity log — append-only audit trail (see supabase/009_activity_log_and_permissions.sql)
// ---------------------------------------------------------------------------

export type ActivityModule = 'members' | 'chanda' | 'donation_ads' | 'expenses' | 'loans' | 'tasks' | 'estimation' | 'users' | 'settings';
export type ActivityAction = 'create' | 'update' | 'delete' | 'bulk_import';

export interface ActivityLogEntry {
  id: string;
  userId: string | null;
  username: string;
  userName: string;
  action: ActivityAction;
  module: ActivityModule;
  summary: string;
  recordCount: number;
  createdAt: string;
}

export async function logActivity(entry: {
  userId: string;
  username: string;
  userName: string;
  action: ActivityAction;
  module: ActivityModule;
  summary: string;
  count?: number;
}): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    user_id: entry.userId,
    username: entry.username,
    user_name: entry.userName,
    action: entry.action,
    module: entry.module,
    summary: entry.summary,
    record_count: entry.count ?? 1,
  });
  if (error) throw error;
}

export async function fetchActivityLog(limit = 200): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    userName: row.user_name,
    action: row.action,
    module: row.module,
    summary: row.summary,
    recordCount: row.record_count,
    createdAt: row.created_at,
  }));
}
