// Data-access layer for the Super Admin panel — separate from db.ts since
// these RPCs operate across every tenant, not within one (see
// supabase/022_super_admin.sql, supabase/023_tenant_details_and_subscriptions.sql).
// Uses the same supabase client + the same tenant-aware-fetch token slot in
// supabaseClient.ts; a super-admin token and a committee token are never
// live at the same time in one browser tab.

import { supabase, setTenantAccessToken } from './supabaseClient';

export interface SuperAdmin {
  id: string;
  name: string;
  username: string;
  accessToken: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'disabled' | 'deleted';
  phone: string;
  email: string;
  address: string;
  subscriptionExpiresAt: string | null;
  maxUsers: number | null; // null = unlimited
  userCount: number;
  createdAt: string;
}

export interface SubscriptionCredit {
  id: string;
  tenantId: string;
  period: 'monthly' | 'yearly';
  amountPaise: number;
  note: string | null;
  createdAt: string;
}

function fromTenantRow(row: any): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    subscriptionExpiresAt: row.subscription_expires_at,
    maxUsers: row.max_users ?? null,
    userCount: Number(row.user_count ?? 0),
    createdAt: row.created_at,
  };
}

function fromCreditRow(row: any): SubscriptionCredit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    period: row.period,
    amountPaise: row.amount_paise,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function superAdminLoginRequest(username: string, password: string): Promise<SuperAdmin | null> {
  const { data, error } = await supabase.rpc('super_admin_login', { p_username: username, p_password: password });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];
  setTenantAccessToken(row.access_token || null);
  return { id: row.id, name: row.name, username: row.username, accessToken: row.access_token };
}

export async function listTenantsRequest(): Promise<Tenant[]> {
  const { data, error } = await supabase.rpc('super_admin_list_tenants');
  if (error) throw error;
  return (data || []).map(fromTenantRow);
}

export async function createTenantRequest(
  name: string,
  slug: string,
  adminName: string,
  adminUsername: string,
  adminPassword: string
): Promise<Tenant> {
  const { data, error } = await supabase.rpc('super_admin_create_tenant', {
    p_name: name,
    p_slug: slug,
    p_admin_name: adminName,
    p_admin_username: adminUsername,
    p_admin_password: adminPassword,
  });
  if (error) throw error;
  return fromTenantRow(data[0]);
}

export async function updateTenantRequest(
  tenantId: string,
  name: string,
  slug: string,
  phone: string,
  email: string,
  address: string,
  maxUsers: number | null
): Promise<Tenant> {
  const { data, error } = await supabase.rpc('super_admin_update_tenant', {
    p_tenant_id: tenantId,
    p_name: name,
    p_slug: slug,
    p_phone: phone || null,
    p_email: email || null,
    p_address: address || null,
    p_max_users: maxUsers,
  });
  if (error) throw error;
  return fromTenantRow(data);
}

export async function createAdminForTenantRequest(
  tenantId: string,
  adminName: string,
  adminUsername: string,
  adminPassword: string
): Promise<TenantAdmin> {
  const { data, error } = await supabase.rpc('super_admin_create_admin_for_tenant', {
    p_tenant_id: tenantId,
    p_admin_name: adminName,
    p_admin_username: adminUsername,
    p_admin_password: adminPassword,
  });
  if (error) throw error;
  return fromTenantAdminRow(data[0]);
}

export async function setTenantStatusRequest(tenantId: string, status: 'active' | 'disabled'): Promise<Tenant> {
  const { data, error } = await supabase.rpc('super_admin_set_tenant_status', { p_tenant_id: tenantId, p_status: status });
  if (error) throw error;
  return fromTenantRow(data);
}

export async function deleteTenantRequest(tenantId: string): Promise<void> {
  const { error } = await supabase.rpc('super_admin_delete_tenant', { p_tenant_id: tenantId });
  if (error) throw error;
}

export async function grantSubscriptionRequest(
  tenantId: string,
  period: 'monthly' | 'yearly',
  amountPaise: number,
  note?: string
): Promise<Tenant> {
  const { data, error } = await supabase.rpc('super_admin_grant_subscription', {
    p_tenant_id: tenantId,
    p_period: period,
    p_amount_paise: amountPaise,
    p_note: note || null,
  });
  if (error) throw error;
  return fromTenantRow(data);
}

export async function listSubscriptionCreditsRequest(tenantId: string): Promise<SubscriptionCredit[]> {
  const { data, error } = await supabase.rpc('super_admin_list_subscription_credits', { p_tenant_id: tenantId });
  if (error) throw error;
  return (data || []).map(fromCreditRow);
}

export interface TenantAdmin {
  id: string;
  name: string;
  username: string;
}

function fromTenantAdminRow(row: any): TenantAdmin {
  return { id: row.id, name: row.name, username: row.username };
}

export interface TenantUser {
  id: string;
  name: string;
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

function fromTenantUserRow(row: any): TenantUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    isAdmin: row.is_admin,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listTenantUsersRequest(tenantId: string): Promise<TenantUser[]> {
  const { data, error } = await supabase.rpc('super_admin_list_tenant_users', { p_tenant_id: tenantId });
  if (error) throw error;
  return (data || []).map(fromTenantUserRow);
}

export async function getTenantAdminRequest(tenantId: string): Promise<TenantAdmin | null> {
  const { data, error } = await supabase.rpc('super_admin_get_tenant_admin', { p_tenant_id: tenantId });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return fromTenantAdminRow(data[0]);
}

export async function updateTenantAdminRequest(
  userId: string,
  name: string,
  username: string,
  newPassword?: string
): Promise<TenantAdmin> {
  const { data, error } = await supabase.rpc('super_admin_update_tenant_admin', {
    p_user_id: userId,
    p_name: name,
    p_username: username,
    p_new_password: newPassword || null,
  });
  if (error) throw error;
  return fromTenantAdminRow(data[0]);
}

// Random 10-char password: letters, digits, one symbol — good enough to
// hand a tenant admin as a first/reset password, they can change it later
// from their own Settings > Change Password once logged in.
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const symbols = '!@#$%';
  let pw = '';
  for (let i = 0; i < 9; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += symbols[Math.floor(Math.random() * symbols.length)];
  return pw;
}

export interface SuperAdminProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  phone2: string;
  address: string;
  logoUrl: string;
}

function fromSuperAdminProfileRow(row: any): SuperAdminProfile {
  return {
    id: row.id,
    name: row.name || '',
    username: row.username || '',
    email: row.email || '',
    phone: row.phone || '',
    phone2: row.phone2 || '',
    address: row.address || '',
    logoUrl: row.logo_url || '',
  };
}

export async function getSelfProfileRequest(): Promise<SuperAdminProfile> {
  const { data, error } = await supabase.rpc('super_admin_get_self');
  if (error) throw error;
  return fromSuperAdminProfileRow(data[0]);
}

export async function updateSelfProfileRequest(profile: Omit<SuperAdminProfile, 'id' | 'username'>): Promise<SuperAdminProfile> {
  const { data, error } = await supabase.rpc('super_admin_update_self', {
    p_name: profile.name,
    p_email: profile.email || null,
    p_phone: profile.phone || null,
    p_phone2: profile.phone2 || null,
    p_address: profile.address || null,
    p_logo_url: profile.logoUrl || null,
  });
  if (error) throw error;
  return fromSuperAdminProfileRow(data[0]);
}

export interface DeveloperInfo {
  name: string;
  email: string;
  phone: string;
  version: string;
  changelog: string; // one point per line — rendered as a bullet list
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

export async function getDeveloperInfoRequest(): Promise<DeveloperInfo> {
  const { data, error } = await supabase.from('developer_info').select('*').eq('id', 1).single();
  if (error) throw error;
  return fromDeveloperRow(data);
}

export async function updateDeveloperInfoRequest(info: DeveloperInfo): Promise<DeveloperInfo> {
  const { data, error } = await supabase.rpc('super_admin_update_developer_info', {
    p_name: info.name,
    p_email: info.email,
    p_phone: info.phone,
    p_version: info.version,
    p_changelog: info.changelog || null,
  });
  if (error) throw error;
  return fromDeveloperRow(data);
}

export async function superAdminChangePasswordRequest(currentPassword: string, newPassword: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('super_admin_change_password', {
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });
  if (error) throw error;
  return Boolean(data);
}
