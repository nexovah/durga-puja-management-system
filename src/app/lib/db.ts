// Data-access layer: every read/write to Supabase goes through this file.
// Field names are converted between the frontend's camelCase objects and the
// database's snake_case columns here, so the rest of the app never has to
// think about it (see supabase/README.md for the full mapping table).

import { supabase } from './supabaseClient';
import {
  User,
  CommitteeInfo,
  Member,
  Chanda,
  DonationAd,
  Expense,
} from '../App';

export interface DeveloperInfo {
  name: string;
  email: string;
  phone: string;
  version: string;
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
  };
}

function fromChandaRow(row: any): Chanda {
  return {
    id: row.id,
    donorName: row.donor_name,
    amount: Number(row.amount) || 0,
    paidMethod: row.paid_method,
    paymentStatus: row.payment_status,
    partialAmount: row.partial_amount === null || row.partial_amount === undefined ? undefined : Number(row.partial_amount),
    date: row.date,
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
    paid_method: c.paidMethod,
    payment_status: c.paymentStatus,
    partial_amount: c.partialAmount ?? null,
    date: c.date,
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
    phone: d.phone,
    phone2: d.phone2 || null,
    remarks: d.remarks,
  };
}

function fromExpenseRow(row: any): Expense {
  const partials = Array.isArray(row.partial_amounts)
    ? row.partial_amounts.map((v: any) => (v === null || v === undefined ? undefined : Number(v)))
    : undefined;
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount) || 0,
    paymentStatus: row.payment_status,
    partialAmounts: partials,
    paidThrough: row.paid_through,
    date: row.date,
    category: row.category,
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
    paid_through: e.paidThrough,
    date: e.date,
    category: e.category,
    remarks: e.remarks,
  };
}

function fromCommitteeRow(row: any): CommitteeInfo {
  return {
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
    permissions: row.permissions,
  };
}

// ---------------------------------------------------------------------------
// Bulk fetch — called once on app load
// ---------------------------------------------------------------------------

export async function fetchAllData() {
  const [membersRes, chandaRes, donationAdsRes, expensesRes, committeeRes, developerRes, usersRes] =
    await Promise.all([
      supabase.from('members').select('*').order('join_date', { ascending: false }),
      supabase.from('chanda').select('*').order('date', { ascending: false }),
      supabase.from('donation_ads').select('*').order('date', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('committee_info').select('*').eq('id', 1).single(),
      supabase.from('developer_info').select('*').eq('id', 1).single(),
      supabase.from('app_users').select('*').order('created_at', { ascending: true }),
    ]);

  const firstError =
    membersRes.error || chandaRes.error || donationAdsRes.error || expensesRes.error ||
    committeeRes.error || developerRes.error || usersRes.error;
  if (firstError) throw firstError;

  return {
    members: (membersRes.data || []).map(fromMemberRow),
    chandaList: (chandaRes.data || []).map(fromChandaRow),
    donationAdsList: (donationAdsRes.data || []).map(fromDonationAdRow),
    expenses: (expensesRes.data || []).map(fromExpenseRow),
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
  table: 'members' | 'chanda' | 'donation_ads' | 'expenses',
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

// ---------------------------------------------------------------------------
// Singleton settings rows
// ---------------------------------------------------------------------------

export async function updateCommitteeInfo(info: CommitteeInfo): Promise<void> {
  const { error } = await supabase.from('committee_info').update(toCommitteeRow(info)).eq('id', 1);
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

export async function loginRequest(username: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.rpc('login', { p_username: username, p_password: password });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return fromUserRow(data[0]);
}

export async function createUserRequest(
  name: string,
  username: string,
  password: string,
  permissions: User['permissions'],
  canEdit: boolean
): Promise<User> {
  const { data, error } = await supabase.rpc('create_app_user', {
    p_name: name,
    p_username: username,
    p_password: password,
    p_permissions: permissions,
    p_can_edit: canEdit,
  });
  if (error) throw error;
  return fromUserRow(data[0]);
}

export async function updateUserRequest(
  userId: string,
  name: string,
  permissions: User['permissions'],
  canEdit: boolean,
  newPassword?: string
): Promise<User> {
  const { data, error } = await supabase.rpc('update_app_user', {
    p_user_id: userId,
    p_name: name,
    p_permissions: permissions,
    p_new_password: newPassword || null,
    p_can_edit: canEdit,
  });
  if (error) throw error;
  return fromUserRow(data[0]);
}

export async function deleteUserRequest(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_app_user', { p_user_id: userId });
  if (error) throw error;
  return Boolean(data);
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
