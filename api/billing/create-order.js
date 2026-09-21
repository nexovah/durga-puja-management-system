// POST /api/billing/create-order
// Body: { period: 'monthly' | 'yearly' }
// Header: Authorization: Bearer <tenant access_token from login()>
//
// Creates a Razorpay order for the caller's own tenant (identity comes from
// the verified JWT, never from the request body) and records a 'created'
// billing_transactions row. The frontend then opens Razorpay Checkout with
// the returned order id.
import Razorpay from 'razorpay';
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

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

  const { period } = req.body || {};
  if (period !== 'monthly' && period !== 'yearly') {
    res.status(400).json({ error: 'period must be "monthly" or "yearly"' });
    return;
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('period', period)
    .eq('is_active', true)
    .single();
  if (planError || !plan) {
    res.status(400).json({ error: 'Plan not found' });
    return;
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  let order;
  try {
    order = await razorpay.orders.create({
      amount: plan.amount_paise,
      currency: plan.currency,
      receipt: `tenant_${tenantId}_${Date.now()}`,
    });
  } catch (err) {
    res.status(502).json({ error: 'Razorpay order creation failed: ' + (err?.error?.description || err.message) });
    return;
  }

  const { error: insertError } = await supabaseAdmin.from('billing_transactions').insert({
    tenant_id: tenantId,
    plan_id: plan.id,
    period: plan.period,
    amount_paise: plan.amount_paise,
    currency: plan.currency,
    status: 'created',
    razorpay_order_id: order.id,
  });
  if (insertError) {
    res.status(500).json({ error: 'Failed to record transaction: ' + insertError.message });
    return;
  }

  res.status(200).json({
    orderId: order.id,
    amount: plan.amount_paise,
    currency: plan.currency,
    keyId: process.env.RAZORPAY_KEY_ID, // safe to expose — Checkout requires it client-side
  });
}
