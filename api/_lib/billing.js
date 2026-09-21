import { supabaseAdmin } from './supabaseAdmin.js';

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
    .select('subscription_expires_at')
    .eq('id', txn.tenant_id)
    .single();

  const base = tenant?.subscription_expires_at && new Date(tenant.subscription_expires_at) > new Date()
    ? new Date(tenant.subscription_expires_at)
    : new Date();

  const next = new Date(base);
  if (txn.period === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }

  await supabaseAdmin
    .from('tenants')
    .update({ subscription_expires_at: next.toISOString() })
    .eq('id', txn.tenant_id);
}
