import { supabaseAdmin } from './supabaseAdmin.js';
import { sendAdminAlert } from './email.js';

// Shared by verify-payment.js and webhook.js — both can race to mark the
// same transaction paid (browser calls verify-payment, Razorpay calls the
// webhook independently), so this is written to be safe if it runs twice:
// skips the extension if the transaction is already 'paid'.
export async function markTransactionPaidAndExtend(txn, razorpayPaymentId) {
  if (txn.status === 'paid') return; // already processed — idempotent no-op

  await supabaseAdmin
    .from('billing_transactions')
    .update({ status: 'paid', razorpay_payment_id: razorpayPaymentId, paid_at: new Date().toISOString() })
    .eq('id', txn.id);

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, subscription_expires_at')
    .eq('id', txn.tenant_id)
    .single();

  const base = tenant?.subscription_expires_at && new Date(tenant.subscription_expires_at) > new Date()
    ? new Date(tenant.subscription_expires_at)
    : new Date();

  const next = new Date(base);
  next.setMonth(next.getMonth() + (txn.duration_months || 1));

  await supabaseAdmin
    .from('tenants')
    .update({ subscription_expires_at: next.toISOString() })
    .eq('id', txn.tenant_id);

  sendAdminAlert('new_paid_order_alert', {
    committee_name: tenant?.name || '',
    plan_name: txn.period || '',
    amount: ((txn.amount_paise || 0) / 100).toLocaleString('en-IN', { style: 'currency', currency: txn.currency || 'INR' }),
    period: txn.duration_months === 12 ? 'yearly' : 'monthly',
  }).catch(() => {});
}
