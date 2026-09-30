// POST /api/leads/create
// Body: { committeeName, contactName, phone, email? }
// Public, no auth — mirrors the openness of the previous direct client
// insert into `leads`, but routed server-side so a lead-alert email can be
// sent (Resend key is server-only).
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { committeeName, contactName, phone, email } = req.body || {};
  if (!committeeName || !contactName || !phone) {
    res.status(400).json({ error: 'committeeName, contactName and phone are required' });
    return;
  }

  const { error: insertError } = await supabaseAdmin.from('leads').insert({
    committee_name: committeeName,
    contact_name: contactName,
    phone,
    email: email || null,
  });
  if (insertError) {
    res.status(500).json({ error: 'Failed to save lead: ' + insertError.message });
    return;
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from('email_provider_settings')
      .select('internal_notify_email')
      .eq('id', 1)
      .single();

    if (settings?.internal_notify_email) {
      const { subject, html } = await renderTemplate('lead_alert', {
        committee_name: committeeName,
        contact_name: contactName,
        phone,
        email: email || '',
      });
      await sendEmail({ to: settings.internal_notify_email, subject, html });
    }
  } catch {
    // Best-effort — the lead is already saved; a notification failure
    // shouldn't be surfaced to the public landing page as an error.
  }

  res.status(200).json({ ok: true });
}
