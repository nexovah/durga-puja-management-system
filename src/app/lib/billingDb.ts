// Tenant-side billing data access. Reads (plans, own billing history) go
// straight through Supabase (RLS-scoped, same pattern as everything else in
// db.ts). Writes (creating a Razorpay order, verifying a payment) go
// through the Vercel serverless routes in api/billing/*.js instead, since
// those need secrets (Razorpay key secret, Supabase service-role key) that
// must never reach the browser — see api/_lib/supabaseAdmin.js.

import { supabase } from './supabaseClient';
import { getTenantAccessToken } from './supabaseClient';

export interface SubscriptionPlan {
  id: string;
  period: 'monthly' | 'yearly';
  amountPaise: number;
  currency: string;
}

export interface BillingTransaction {
  id: string;
  period: string;
  amountPaise: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  createdAt: string;
  paidAt: string | null;
}

// Unifies billing_transactions (Razorpay payments) and subscription_credits
// (Super Admin's manual grants — see supabase/023_tenant_details_and_subscriptions.sql)
// into one list for the Billing page's history table. Both extend the same
// tenants.subscription_expires_at, so from the tenant's point of view
// they're the same kind of event: "we paid for N months/years, here's when."
export interface BillingHistoryItem {
  id: string;
  source: 'razorpay' | 'manual';
  period: string;
  amountPaise: number;
  currency: string;
  status: 'paid' | 'created' | 'failed';
  note: string | null;
  date: string;
}

function fromPlanRow(row: any): SubscriptionPlan {
  return { id: row.id, period: row.period, amountPaise: row.amount_paise, currency: row.currency };
}

function fromTransactionRow(row: any): BillingTransaction {
  return {
    id: row.id,
    period: row.period,
    amountPaise: row.amount_paise,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export async function listSubscriptionPlansRequest(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.from('subscription_plans').select('*').eq('is_active', true);
  if (error) throw error;
  return (data || []).map(fromPlanRow);
}

export async function listBillingTransactionsRequest(): Promise<BillingTransaction[]> {
  const { data, error } = await supabase.from('billing_transactions').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromTransactionRow);
}

export async function listBillingHistoryRequest(): Promise<BillingHistoryItem[]> {
  const [txResult, creditResult] = await Promise.all([
    supabase.from('billing_transactions').select('*'),
    supabase.from('subscription_credits').select('*'),
  ]);
  if (txResult.error) throw txResult.error;
  if (creditResult.error) throw creditResult.error;

  const fromRazorpay: BillingHistoryItem[] = (txResult.data || []).map((row: any) => ({
    id: row.id,
    source: 'razorpay',
    period: row.period,
    amountPaise: row.amount_paise,
    currency: row.currency,
    status: row.status,
    note: null,
    date: row.paid_at || row.created_at,
  }));

  const fromManualGrants: BillingHistoryItem[] = (creditResult.data || []).map((row: any) => ({
    id: row.id,
    source: 'manual',
    period: row.period,
    amountPaise: Math.abs(row.amount_paise), // stored negative (a debit) — shown as a positive charge here
    currency: 'INR',
    status: 'paid',
    note: row.note,
    date: row.created_at,
  }));

  return [...fromRazorpay, ...fromManualGrants].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

async function callBillingApi<T>(path: string, body: unknown): Promise<T> {
  const token = getTenantAccessToken();
  if (!token) throw new Error('Not logged in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data as T;
}

export function createOrderRequest(period: 'monthly' | 'yearly'): Promise<CreateOrderResult> {
  return callBillingApi<CreateOrderResult>('/api/billing/create-order', { period });
}

export function verifyPaymentRequest(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): Promise<{ ok: boolean }> {
  return callBillingApi('/api/billing/verify-payment', {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  });
}

// Loads Razorpay's Checkout script once and reuses it on subsequent calls.
let checkoutScriptPromise: Promise<void> | null = null;
export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
      document.body.appendChild(script);
    });
  }
  return checkoutScriptPromise;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}
