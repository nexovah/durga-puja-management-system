// POST /api/billing/cancel-subscription
// Header: Authorization: Bearer <tenant access_token>
//
// Cancels the caller's own active Razorpay subscription — lets the
// current paid cycle run out rather than cutting it short
// (cancel_at_cycle_end: true). The subscription.cancelled webhook
// (webhook.js) flips billing_subscriptions.status once Razorpay
// confirms it.
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
