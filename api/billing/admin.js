// POST /api/billing/admin
// Body: { action: 'syncPlan' | 'refundCancel', ... }
// Header: Authorization: Bearer <super admin access_token>
//
// Super Admin-side Razorpay actions, merged into one endpoint (from 2
// separate files) to stay under Vercel Hobby's 12-serverless-function
// cap — same consolidation approach already used for the tenant-side
// api/billing/subscription.js dispatcher.
import Razorpay from 'razorpay';
import { verifySuperAdminToken } from '../_lib/verifySuperAdminToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getActiveRazorpayCreds } from '../_lib/paymentGateway.js';

// action: 'syncPlan' — Body: { planId }
// Creates (or re-creates) the Razorpay-side Plan object for a
// subscription_plans row and stores its id. Called by Super Admin's
// Plans page right after a plan is saved (create or price/duration
// change) — without a razorpay_plan_id, that plan can't be subscribed to
// (api/billing/subscription.js's 'create' action requires it).
//
// Razorpay Plans are immutable once created — editing an existing plan's
// price/duration always creates a NEW Razorpay Plan object and
// overwrites the stored id. Tenants already subscribed under the old
// Razorpay plan keep their original price until they resubscribe — this
// is standard Razorpay/industry behavior, not a bug.
async function handleSyncPlan(req, res) {
  const { planId } = req.body || {};
  if (!planId) {
    res.status(400).json({ error: 'planId is required' });
    return;
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (planError || !plan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const { keyId, keySecret } = await getActiveRazorpayCreds();
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  let razorpayPlan;
  try {
    razorpayPlan = await razorpay.plans.create({
      period: plan.duration_months % 12 === 0 ? 'yearly' : 'monthly',
      interval: plan.duration_months % 12 === 0 ? (plan.duration_months / 12) : plan.duration_months,
      item: {
        name: plan.name,
        amount: plan.amount_paise,
        currency: plan.currency,
      },
    });
  } catch (err) {
    res.status(502).json({ error: 'Razorpay plan creation failed: ' + (err?.error?.description || err.message) });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('subscription_plans')
    .update({ razorpay_plan_id: razorpayPlan.id })
    .eq('id', planId);
  if (updateError) {
    res.status(500).json({ error: 'Failed to save Razorpay plan id: ' + updateError.message });
    return;
  }

  res.status(200).json({ ok: true, razorpayPlanId: razorpayPlan.id });
}

// action: 'refundCancel' — Body: { transactionId }
// "Cancel subscription + Refund": issues a real Razorpay refund for the
// payment AND immediately cancels the subscription (cancel_at_cycle_end:
// 0 — cuts access off right away, since this is admin-initiated/
// refunded, not the tenant's own soft cancel). Updates
// billing_transactions/billing_subscriptions/tenants synchronously in
// this same request, so Super Admin Orders and the tenant's own Billing
// page both reflect it immediately — no waiting on the
// subscription.cancelled webhook (which becomes a no-op here via the
// same idempotency guard it already has).
async function handleRefundCancel(req, res) {
  const { transactionId } = req.body || {};
  if (!transactionId) {
    res.status(400).json({ error: 'transactionId is required' });
    return;
  }

  const { data: txn, error: fetchError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  if (fetchError || !txn) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  if (txn.refunded_at) {
    res.status(400).json({ error: 'Already refunded' });
    return;
  }
  if (!txn.razorpay_payment_id) {
    res.status(400).json({ error: 'No Razorpay payment on this transaction to refund' });
    return;
  }

  const { keyId, keySecret } = await getActiveRazorpayCreds();
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  let refund;
  try {
    refund = await razorpay.payments.refund(txn.razorpay_payment_id, {
      amount: txn.amount_paise,
      speed: 'normal',
    });
  } catch (err) {
    res.status(502).json({ error: 'Razorpay refund failed: ' + (err?.error?.description || err.message) });
    return;
  }

  if (txn.razorpay_subscription_id) {
    try {
      await razorpay.subscriptions.cancel(txn.razorpay_subscription_id, { cancel_at_cycle_end: 0 });
    } catch (err) {
      // Refund already went through — don't fail the whole request over
      // a cancel error (e.g. already cancelled). Log and continue to
      // record the refund.
      console.error('Subscription cancel failed after refund:', err?.error?.description || err.message);
    }
  }

  await supabaseAdmin
    .from('billing_transactions')
    .update({ refunded_at: new Date().toISOString(), razorpay_refund_id: refund.id })
    .eq('id', transactionId);

  if (txn.razorpay_subscription_id) {
    await supabaseAdmin
      .from('billing_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('razorpay_subscription_id', txn.razorpay_subscription_id);
  }

  await supabaseAdmin
    .from('tenants')
    .update({ subscription_expires_at: new Date().toISOString() })
    .eq('id', txn.tenant_id);

  res.status(200).json({ ok: true, refundId: refund.id });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    verifySuperAdminToken(req.headers.authorization);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: ' + err.message });
    return;
  }

  const { action } = req.body || {};
  if (action === 'syncPlan') return handleSyncPlan(req, res);
  if (action === 'refundCancel') return handleRefundCancel(req, res);
  res.status(400).json({ error: 'Unknown action' });
}
