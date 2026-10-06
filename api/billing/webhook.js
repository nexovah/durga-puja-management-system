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
import { getActiveRazorpayCreds } from '../_lib/paymentGateway.js';
import { sendAdminAlert } from '../_lib/email.js';

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

  const { webhookSecret } = await getActiveRazorpayCreds();
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
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

  // --- Razorpay Subscriptions events (recurring auto-debit) ---------------

  if (event.event === 'subscription.activated') {
    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (subscriptionId) {
      await supabaseAdmin
        .from('billing_subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('razorpay_subscription_id', subscriptionId)
        .eq('status', 'created'); // fallback only — verify-subscription-payment.js is the fast path
    }
  }

  if (event.event === 'subscription.charged') {
    // The auto-debit event itself — fired every renewal cycle with no
    // customer action. Idempotent via the razorpay_payment_id uniqueness
    // check below (a payment.captured webhook for the same charge, or a
    // retry of this same event, never double-inserts).
    const subEntity = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    const subscriptionId = subEntity?.id;
    const paymentId = payment?.id;
    if (subscriptionId && paymentId) {
      const { data: existing } = await supabaseAdmin
        .from('billing_transactions')
        .select('id')
        .eq('razorpay_payment_id', paymentId)
        .maybeSingle();

      if (!existing) {
        const { data: sub } = await supabaseAdmin
          .from('billing_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('razorpay_subscription_id', subscriptionId)
          .single();

        if (sub) {
          const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000).toISOString() : null;
          const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000).toISOString() : null;
          const plan = sub.subscription_plans;

          await supabaseAdmin
            .from('billing_subscriptions')
            .update({ status: 'active', current_start: currentStart, current_end: currentEnd, next_charge_at: currentEnd, updated_at: new Date().toISOString() })
            .eq('id', sub.id);

          await supabaseAdmin.from('billing_transactions').insert({
            tenant_id: sub.tenant_id,
            plan_id: sub.plan_id,
            period: plan?.name || '',
            duration_months: plan?.duration_months || 1,
            amount_paise: payment.amount,
            currency: payment.currency,
            status: 'paid',
            razorpay_order_id: payment.order_id,
            razorpay_payment_id: paymentId,
            razorpay_subscription_id: subscriptionId,
            razorpay_customer_id: payment.customer_id || null,
            period_end: currentEnd,
            paid_at: new Date().toISOString(),
          });

          if (currentEnd) {
            await supabaseAdmin.from('tenants').update({ subscription_expires_at: currentEnd }).eq('id', sub.tenant_id);
          }

          const { data: tenant } = await supabaseAdmin.from('tenants').select('name').eq('id', sub.tenant_id).single();
          sendAdminAlert('new_paid_order_alert', {
            committee_name: tenant?.name || '',
            plan_name: plan?.name || '',
            amount: (payment.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: payment.currency }),
            period: plan?.duration_months === 12 ? 'yearly' : 'monthly',
          }).catch(() => {});
        }
      }
    }
  }

  if (['subscription.cancelled', 'subscription.completed', 'subscription.halted', 'subscription.pending'].includes(event.event)) {
    const subscriptionId = event.payload?.subscription?.entity?.id;
    const statusMap = {
      'subscription.cancelled': 'cancelled',
      'subscription.completed': 'completed',
      'subscription.halted': 'halted',
      'subscription.pending': 'halted', // a failed charge attempt before Razorpay's own retry schedule — surfaced the same as halted
    };
    if (subscriptionId) {
      await supabaseAdmin
        .from('billing_subscriptions')
        .update({ status: statusMap[event.event], updated_at: new Date().toISOString() })
        .eq('razorpay_subscription_id', subscriptionId);
    }
  }

  // Always 200 — Razorpay retries on non-2xx, and we've already handled
  // (or intentionally ignored) whatever event this was.
  res.status(200).json({ received: true });
}
