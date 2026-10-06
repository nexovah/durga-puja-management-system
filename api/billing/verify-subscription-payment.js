// POST /api/billing/verify-subscription-payment
// Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
// Header: Authorization: Bearer <tenant access_token>
//
// Called right after Razorpay Checkout's success handler fires in
// subscription mode. Verifies the HMAC signature per Razorpay's
// subscription-signature spec (payment_id + '|' + subscription_id,
// distinct from the order-mode formula in verify-payment.js), then marks
// the subscription active and records the first charge. No MAX/stacking
// math here — Razorpay's own first-charge-now default means this is
// always "now + 1 cycle", which is what makes paying mid-trial correctly
// start the paid period immediately (ending the trial early) rather than
// stacking after it.
//
// The subscription.activated/subscription.charged webhook branches
// (webhook.js) do the same thing independently as a fallback, same
// idempotent relationship verify-payment.js/webhook.js already have for
// one-off Orders.
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getActiveRazorpayCreds } from '../_lib/paymentGateway.js';
import { sendAdminAlert } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let tenantId;
  try {
    ({ tenantId } = verifyTenantToken(req.headers.authorization));
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: ' + err.message });
    return;
  }

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing razorpay_payment_id, razorpay_subscription_id or razorpay_signature' });
    return;
  }

  const { keyId, keySecret } = await getActiveRazorpayCreds();
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    res.status(400).json({ error: 'Invalid payment signature' });
    return;
  }

  const { data: sub, error: fetchError } = await supabaseAdmin
    .from('billing_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('razorpay_subscription_id', razorpay_subscription_id)
    .single();
  if (fetchError || !sub) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }
  if (sub.tenant_id !== tenantId) {
    res.status(403).json({ error: 'Subscription does not belong to this tenant' });
    return;
  }

  // Already recorded (e.g. the webhook beat us to it) — idempotent no-op.
  if (sub.status === 'active') {
    res.status(200).json({ ok: true });
    return;
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const [rzpSubscription, rzpPayment] = await Promise.all([
    razorpay.subscriptions.fetch(razorpay_subscription_id),
    razorpay.payments.fetch(razorpay_payment_id),
  ]);

  const currentStart = rzpSubscription.current_start ? new Date(rzpSubscription.current_start * 1000).toISOString() : null;
  const currentEnd = rzpSubscription.current_end ? new Date(rzpSubscription.current_end * 1000).toISOString() : null;
  const plan = sub.subscription_plans;

  await supabaseAdmin
    .from('billing_subscriptions')
    .update({ status: 'active', current_start: currentStart, current_end: currentEnd, next_charge_at: currentEnd, updated_at: new Date().toISOString() })
    .eq('id', sub.id);

  await supabaseAdmin.from('billing_transactions').insert({
    tenant_id: tenantId,
    plan_id: sub.plan_id,
    period: plan?.name || '',
    duration_months: plan?.duration_months || 1,
    amount_paise: rzpPayment.amount,
    currency: rzpPayment.currency,
    status: 'paid',
    razorpay_order_id: rzpPayment.order_id,
    razorpay_payment_id,
    razorpay_subscription_id,
    period_end: currentEnd,
    paid_at: new Date().toISOString(),
  });

  if (currentEnd) {
    await supabaseAdmin.from('tenants').update({ subscription_expires_at: currentEnd }).eq('id', tenantId);
  }

  const { data: tenant } = await supabaseAdmin.from('tenants').select('name').eq('id', tenantId).single();
  sendAdminAlert('new_paid_order_alert', {
    committee_name: tenant?.name || '',
    plan_name: plan?.name || '',
    amount: (rzpPayment.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: rzpPayment.currency }),
    period: plan?.duration_months === 12 ? 'yearly' : 'monthly',
  }).catch(() => {});

  res.status(200).json({ ok: true });
}
