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
  ExpensePartialPayment,
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
function toExpenseRow(e: Expense) {
  return {
    id: e.id,
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
  // A brand-new tenant (e.g. created via Super Admin) has no committee_info
  // row yet until the committee fills in Settings — fall back to empty
  // defaults instead of crashing on a null row.
  if (!row) {
    return {
      id: '',
      name: '',
      logo: '',
      established: '',
      regNumber: '',
      association: '',
      email: '',
      post: '',
      districtPS: '',
      pinCode: '',
      mobile1: '',
      mobile2: '',
      address: '',
      phone: '',
      year: '',
    };
  }
  return {
    id: row.id,
    name: row.name || '',
    logo: row.logo_url || '',
    established: row.established || '',
    regNumber: row.reg_number || '',
    association: row.association || '',
    email: row.email || '',
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
    email: c.email,
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

export async function updateCommitteeInfo(info: CommitteeInfo): Promise<CommitteeInfo> {
  let saved: CommitteeInfo;
  // A brand-new tenant has no committee_info row yet (see fromCommitteeRow's
  // null fallback) — insert one on first save instead of updating a
  // nonexistent id.
  if (!info.id) {
    const { data, error } = await supabase.from('committee_info').insert(toCommitteeRow(info)).select().single();
    if (error) throw error;
    saved = fromCommitteeRow(data);
  } else {
    // No tenant filter needed — RLS already scopes this update to exactly
    // the caller's tenant's single committee_info row (see
    // supabase/020_multi_tenant.sql). PostgREST requires *some* filter to
    // avoid a full-table update, so match on the primary key it just read.
    const { error } = await supabase.from('committee_info').update(toCommitteeRow(info)).eq('id', info.id);
    if (error) throw error;
    saved = info;
  }
  // Mirror the shared fields back into `tenants` so Super Admin's Tenant
  // Detail page reflects the tenant's own edits too — same fields
  // super_admin_update_tenant mirrors the other way (see
  // supabase/051_bidirectional_committee_tenant_sync.sql).
  const { error: syncError } = await supabase.rpc('tenant_update_own_details', {
    p_name: saved.association,
    p_phone: saved.mobile1,
    p_email: saved.email,
    p_address: saved.address,
  });
  if (syncError) throw syncError;
  return saved;
}

export async function updateDeveloperInfo(info: DeveloperInfo): Promise<void> {
  const { error } = await supabase.from('developer_info').update(info).eq('id', 1);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Password generation — mirrors superAdminDb.ts's version (and the
// server-side is_password_strong() in supabase/037_password_strength.sql)
// so a committee admin resetting a member's password gets the same
// generate/strength UX Super Admin already has for tenant admin logins.
// ---------------------------------------------------------------------------

export function isPasswordStrong(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export function generatePassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%';
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const rest = Array.from({ length: 6 }, () => pick(letters + digits)).join('');
  const chars = [pick(letters), pick(digits), pick(symbols), ...rest.split('')];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---------------------------------------------------------------------------
// Committee logo upload (Supabase Storage — see supabase/storage.sql)
// ---------------------------------------------------------------------------

const LOGO_MAX_BYTES = 200 * 1024; // 200 KB — every profile-picture/logo upload (super admin or tenant admin) must fit under this

// Client-side compression for logo/profile-picture uploads only — never
// applied to the Help & Support attachment upload, which stays untouched.
// Draws the image onto a canvas and re-encodes as JPEG, stepping the
// quality down (and shrinking dimensions if quality alone isn't enough)
// until the result is under LOGO_MAX_BYTES. Skips non-raster types (ico)
// where canvas re-encoding isn't meaningful, and skips files already
// under the limit.
async function compressLogoImage(file: File): Promise<File> {
  if (file.size <= LOGO_MAX_BYTES) return file;
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  const encode = (w: number, h: number, quality: number): Promise<Blob | null> =>
    new Promise(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(bitmap, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });

  let blob: Blob | null = null;
  for (const quality of [0.8, 0.6, 0.5, 0.4, 0.3]) {
    blob = await encode(width, height, quality);
    if (blob && blob.size <= LOGO_MAX_BYTES) break;
  }
  // Quality alone wasn't enough — also shrink dimensions, halving until it fits.
  while (blob && blob.size > LOGO_MAX_BYTES && (width > 100 || height > 100)) {
    width = Math.round(width * 0.75);
    height = Math.round(height * 0.75);
    blob = await encode(width, height, 0.5);
  }

  bitmap.close();
  if (!blob) return file;
  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}

export async function uploadLogo(file: File): Promise<string> {
  const compressed = await compressLogoImage(file);
  const ext = compressed.name.split('.').pop() || 'png';
  const path = `committee-logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('logos').upload(path, compressed, {
    upsert: true,
    contentType: compressed.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Help & Support tickets (see supabase/059_support_tickets.sql) — a tenant
// user only ever sees their OWN tickets (RLS: tenant_id + user_id both
// pinned to the JWT), same idea as the mobile app's equivalent feature.
// Immutable once created — no update/delete here, matches the mobile side.
// ---------------------------------------------------------------------------

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  ticketCode: string;
  title: string;
  body: string;
  imageUrl: string | null;
  status: TicketStatus;
  createdAt: string;
}

function fromTicketRow(row: any): SupportTicket {
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listMyTicketsRequest(): Promise<SupportTicket[]> {
  const { data, error } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromTicketRow);
}

export async function uploadTicketImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `ticket-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('support-attachments').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('support-attachments').getPublicUrl(path);
  return data.publicUrl;
}

export async function createTicketRequest(entry: {
  userId: string;
  username: string;
  userName: string;
  title: string;
  body: string;
  imageUrl?: string;
}): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: entry.userId,
      username: entry.username,
      user_name: entry.userName,
      title: entry.title,
      body: entry.body,
      image_url: entry.imageUrl || null,
    })
    .select()
    .single();
  if (error) throw error;
  return fromTicketRow(data);
}

// ---------------------------------------------------------------------------
// CMS pages (public read — landing page + legal pages, no auth needed;
// see supabase/055_cms_pages.sql). Writes are Super Admin-only, in
// superAdminDb.ts.
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
  // Matches by username alone across all tenants (see
  // supabase/036_login_rate_limiting.sql's 2-arg login()) — password
  // verification naturally disambiguates in every realistic case, since
  // two different tenants would need the exact same username AND exact
  // same password to collide. No "Committee" field needed at login.
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
export type ActivityDevice = 'web' | 'android' | 'ios';

export interface ActivityFieldChange {
  field: string; // human-readable label, e.g. "Amount", "Phone"
  old: string;
  new: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string | null;
  username: string;
  userName: string;
  action: ActivityAction;
  module: ActivityModule;
  summary: string;
  recordCount: number;
  device: ActivityDevice | null;
  changes: ActivityFieldChange[] | null;
  recordLabel: string | null;
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
  device?: ActivityDevice;
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
    record_count: entry.count ?? 1,
    device: entry.device ?? 'web',
    changes: entry.changes && entry.changes.length > 0 ? entry.changes : null,
    record_label: entry.recordLabel ?? null,
  });
  if (error) throw error;
}

// Compares two flat field-maps and returns only the fields that actually
// changed, formatted for the Activity Log's struck-through-old/plain-new
// diff display. Pass a `labels` map to control field order and display
// names; fields not in `labels` are skipped.
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
// Events (Puja / Festival scoping) — see supabase/064_events.sql. Each
// tenant has one shared `active_event_id`; every transactional table is
// scoped to it via RLS (`current_event_id()`), so a switch is instant for
// everyone under that tenant without re-issuing tokens.
// ---------------------------------------------------------------------------

export interface EventInfo {
  id: string;
  tenantId: string;
  name: string;
  year: number;
  emoji: string | null;
  createdAt: string;
}

function toEventInfo(row: any): EventInfo {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    year: row.year,
    emoji: row.emoji ?? null,
    createdAt: row.created_at,
  };
}

export async function fetchEvents(): Promise<EventInfo[]> {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(toEventInfo);
}

// The tenant's active event id — looked up live via tenants.active_event_id.
// The tenants table itself has no RLS (only tenant-scoped tables like
// events/members/etc. do), so this must filter to the caller's own tenant
// explicitly — same pattern as fetchTenantSubscriptionExpiry above —
// otherwise .single() sees every tenant's row and errors.
export async function fetchActiveEventId(tenantId: string): Promise<string | null> {
  const { data, error } = await supabase.from('tenants').select('active_event_id').eq('id', tenantId).single();
  if (error) throw error;
  return data?.active_event_id ?? null;
}

export async function createEventRequest(name: string, year: number, emoji: string | null, createdBy?: string): Promise<EventInfo> {
  const { data, error } = await supabase
    .from('events')
    .insert({ name, year, emoji, created_by: createdBy ?? null })
    .select()
    .single();
  if (error) throw error;
  return toEventInfo(data);
}

export async function updateEventRequest(eventId: string, name: string, year: number, emoji: string | null): Promise<EventInfo> {
  const { data, error } = await supabase
    .from('events')
    .update({ name, year, emoji })
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return toEventInfo(data);
}

// Admin-only server-verified switch — see switch_active_event() in
// supabase/064_events.sql. Moves every user under this tenant to the new
// event immediately (single shared pointer, no per-user state).
export async function switchActiveEventRequest(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('switch_active_event', { p_event_id: eventId });
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
    device: row.device ?? null,
    changes: row.changes ?? null,
    recordLabel: row.record_label ?? null,
    createdAt: row.created_at,
  }));
}
