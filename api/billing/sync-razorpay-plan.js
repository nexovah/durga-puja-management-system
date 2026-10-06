// POST /api/billing/sync-razorpay-plan
// Body: { planId: string }
// Header: Authorization: Bearer <super admin access_token>
//
// Creates (or re-creates) the Razorpay-side Plan object for a
// subscription_plans row and stores its id. Called by Super Admin's
// Plans page right after a plan is saved (create or price/duration
// change) — without a razorpay_plan_id, that plan can't be subscribed
// to (create-subscription.js requires it).
//
// Razorpay Plans are immutable once created — editing an existing plan's
// price/duration always creates a NEW Razorpay Plan object and
// overwrites the stored id. Tenants already subscribed under the old
// Razorpay plan keep their original price until they resubscribe — this
// is standard Razorpay/industry behavior, not a bug.
import Razorpay from 'razorpay';
import { verifySuperAdminToken } from '../_lib/verifySuperAdminToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getActiveRazorpayCreds } from '../_lib/paymentGateway.js';

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
