// POST /api/billing/verify-payment
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Header: Authorization: Bearer <tenant access_token>
//
// Called by the frontend right after Razorpay Checkout's success handler
// fires. Verifies the HMAC signature Razorpay returns (proves the payment
// is genuine, not just a client claiming success), then marks the
// transaction paid and extends the tenant's subscription. The webhook
// (webhook.js) does the same thing independently as a fallback in case the
// browser closes before this call completes — both are idempotent.
import crypto from 'crypto';
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { markTransactionPaidAndExtend } from '../_lib/billing.js';

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

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing razorpay_order_id, razorpay_payment_id or razorpay_signature' });
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    res.status(400).json({ error: 'Invalid payment signature' });
    return;
  }

  const { data: txn, error: fetchError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('razorpay_order_id', razorpay_order_id)
    .single();
  if (fetchError || !txn) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  if (txn.tenant_id !== tenantId) {
    res.status(403).json({ error: 'Transaction does not belong to this tenant' });
    return;
  }

  await markTransactionPaidAndExtend(txn, razorpay_payment_id);

  res.status(200).json({ ok: true });
}
