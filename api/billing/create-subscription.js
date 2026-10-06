// POST /api/billing/create-subscription
// Body: { planId: string }
// Header: Authorization: Bearer <tenant access_token from login()>
//
// Replaces one-off Orders (create-order.js) for every paid-plan
// purchase: creates a real Razorpay Subscription, which auto-charges the
// saved payment method every cycle with no manual re-pay. The frontend
// then opens Razorpay Checkout in `subscription_id` mode (same modal,
// same UPI/Card/Netbanking tabs) instead of `order_id` mode.
import Razorpay from 'razorpay';
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getActiveRazorpayCreds } from '../_lib/paymentGateway.js';

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
