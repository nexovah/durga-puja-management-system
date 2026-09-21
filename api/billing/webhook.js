// POST /api/billing/webhook — configured in Razorpay Dashboard -> Settings
// -> Webhooks, pointing at https://<your-domain>/api/billing/webhook, event
// "payment.captured". Uses a SEPARATE secret (RAZORPAY_WEBHOOK_SECRET, set
// when you create the webhook in the dashboard) from the API key secret.
//
// This is the source of truth that doesn't depend on the buyer's browser
// staying open — verify-payment.js is the fast path for immediate UI
// feedback, this is the fallback that guarantees the subscription still
// extends even if that call never happens.
import crypto from 'crypto';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { markTransactionPaidAndExtend } from '../_lib/billing.js';

// Vercel parses JSON bodies by default, but webhook signature verification
// needs the exact raw bytes Razorpay signed — turn off the default parser
// and read the raw body ourselves.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;

    if (orderId && paymentId) {
      const { data: txn } = await supabaseAdmin
        .from('billing_transactions')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .single();

      if (txn) {
        await markTransactionPaidAndExtend(txn, paymentId);
      }
    }
  }

  // Always 200 — Razorpay retries on non-2xx, and we've already handled
  // (or intentionally ignored) whatever event this was.
  res.status(200).json({ received: true });
}
