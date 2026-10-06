// GET /api/cron/renewal-reminders — runs daily via Vercel Cron (see
// vercel.json's `crons` entry). Protected by CRON_SECRET (set this env
// var in Vercel; Vercel's own cron invoker sends it as a Bearer token
// automatically when configured — see Vercel's Cron Jobs docs) so this
// endpoint can't be triggered by anyone else.
//
// Finds every active subscription whose next auto-charge falls within
// tomorrow's date window and emails the tenant a heads-up — a courtesy
// notice, not a payment action; Razorpay charges automatically
// regardless of whether this email sends.
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data: subs, error } = await supabaseAdmin
    .from('billing_subscriptions')
    .select('*, subscription_plans(*), tenants(name, email)')
    .eq('status', 'active')
    .gte('next_charge_at', tomorrowStart.toISOString())
    .lte('next_charge_at', tomorrowEnd.toISOString());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let sent = 0;
  for (const sub of subs || []) {
    const tenantEmail = sub.tenants?.email;
    if (!tenantEmail) continue;
    const plan = sub.subscription_plans;
    try {
      const { subject, html } = await renderTemplate('renewal_reminder', {
        committee_name: sub.tenants?.name || '',
        plan_name: plan?.name || '',
        amount: ((plan?.amount_paise || 0) / 100).toLocaleString('en-IN', { style: 'currency', currency: plan?.currency || 'INR' }),
        charge_date: new Date(sub.next_charge_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }),
      });
      await sendEmail({ to: tenantEmail, subject, html });
      sent++;
    } catch {
      // Best-effort — one failed send never blocks the rest of the run.
    }
  }

  res.status(200).json({ ok: true, checked: subs?.length || 0, sent });
}
