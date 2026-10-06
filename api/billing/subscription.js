// POST /api/billing/subscription
// Body: { action: 'create' | 'verify' | 'cancel', ... }
// Header: Authorization: Bearer <tenant access_token>
//
// One endpoint for the whole tenant-side Razorpay Subscriptions
// lifecycle (create / verify / cancel) — merged from 3 separate files
// to stay under Vercel Hobby's 12-serverless-function cap. Each action
// is otherwise unchanged from its original standalone handler.
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getActiveRazorpayCreds } from '../_lib/paymentGateway.js';
import { sendAdminAlert } from '../_lib/email.js';

// action: 'create' — Body: { planId }
// Creates a real Razorpay Subscription (auto-charges the saved payment
// method every cycle). The frontend opens Razorpay Checkout in
// `subscription_id` mode with the returned id.
async function handleCreate(req, res, tenantId) {
  const { planId } = req.body || {};
  if (!planId) {
    res.status(400).json({ error: 'planId is required' });
    return;
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .single();
  if (planError || !plan) {
    res.status(400).json({ error: 'Plan not found or no longer active' });
    return;
  }
  if (!plan.razorpay_plan_id) {
    res.status(400).json({ error: "This plan isn't ready for payment yet — contact support" });
    return;
  }

  const { keyId, keySecret } = await getActiveRazorpayCreds();
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  let subscription;
  try {
    subscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpay_plan_id,
      customer_notify: 1,
      // Effectively open-ended (≈8 years monthly / ≈100 years yearly) —
      // Razorpay requires a finite total_count, there's no "forever"
      // option. The rare case of actually reaching this cap is resolved
      // by simply resubscribing.
      total_count: 100,
      quantity: 1,
    });
  } catch (err) {
    res.status(502).json({ error: 'Razorpay subscription creation failed: ' + (err?.error?.description || err.message) });
    return;
  }

  const { error: insertError } = await supabaseAdmin.from('billing_subscriptions').insert({
    tenant_id: tenantId,
    plan_id: plan.id,
    razorpay_subscription_id: subscription.id,
    status: 'created',
  });
  if (insertError) {
    res.status(500).json({ error: 'Failed to record subscription: ' + insertError.message });
    return;
  }

  res.status(200).json({ subscriptionId: subscription.id, keyId });
}

// action: 'verify' — Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
// Called right after Razorpay Checkout's success handler fires in
// subscription mode. Verifies the HMAC signature per Razorpay's
// subscription-signature spec (payment_id + '|' + subscription_id),
// then marks the subscription active and records the first charge. No
// MAX/stacking math — Razorpay's own first-charge-now default means
// this is always "now + 1 cycle", so paying mid-trial correctly starts
// the paid period immediately rather than stacking after it.
//
// The subscription.activated/subscription.charged webhook branches
// (webhook.js) do the same thing independently as a fallback.
async function handleVerify(req, res, tenantId) {
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
    razorpay_customer_id: rzpPayment.customer_id || null,
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

// action: 'cancel' — no body.
// Cancels the caller's own active Razorpay subscription — lets the
// current paid cycle run out rather than cutting it short
// (cancel_at_cycle_end). The subscription.cancelled webhook flips
// billing_subscriptions.status once Razorpay confirms it.
async function handleCancel(req, res, tenantId) {
  const { data: sub, error: fetchError } = await supabaseAdmin
    .from('billing_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchError || !sub) {
    res.status(404).json({ error: 'No active subscription found' });
    return;
  }

  const { keyId, keySecret } = await getActiveRazorpayCreds();
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  try {
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, { cancel_at_cycle_end: 1 });
  } catch (err) {
    res.status(502).json({ error: 'Razorpay cancellation failed: ' + (err?.error?.description || err.message) });
    return;
  }

  res.status(200).json({ ok: true });
}

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

  const { action } = req.body || {};
  if (action === 'create') return handleCreate(req, res, tenantId);
  if (action === 'verify') return handleVerify(req, res, tenantId);
  if (action === 'cancel') return handleCancel(req, res, tenantId);
  res.status(400).json({ error: 'Unknown action' });
}
