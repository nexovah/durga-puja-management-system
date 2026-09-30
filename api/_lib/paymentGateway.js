// Reads Razorpay credentials from payment_gateway_settings (Super Admin ->
// Settings -> Payment Gateway) via the service-role client, which bypasses
// RLS. Picks the test_* or live_* pair based on the stored `mode`. Falls
// back to the RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET/RAZORPAY_WEBHOOK_SECRET
// env vars whenever the row doesn't exist yet or the relevant fields are
// still empty — so existing deployments keep working unchanged until an
// admin explicitly fills in the new form.
import { supabaseAdmin } from './supabaseAdmin.js';

export async function getActiveRazorpayCreds() {
  const { data } = await supabaseAdmin
    .from('payment_gateway_settings')
    .select('*')
    .eq('id', 1)
    .single();

  const mode = data?.mode === 'live' ? 'live' : 'test';
  const keyId = (mode === 'live' ? data?.live_key_id : data?.test_key_id) || process.env.RAZORPAY_KEY_ID;
  const keySecret = (mode === 'live' ? data?.live_key_secret : data?.test_key_secret) || process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = data?.webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET;

  return { mode, keyId, keySecret, webhookSecret };
}
