// POST /api/email/send-signup-welcome
// Body: { to: string, variables: { name, committee_name, login_url } }
// Public, no auth header — fired fire-and-forget right after a successful
// TRADITIONAL (password-path) signup_tenant() call, same pattern as
// loginRequest()'s post-login notification email in db.ts. The Google path
// sends this same template server-side instead, from google-verify.js.
import { sendEmail, renderTemplate } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { to, variables } = req.body || {};
  if (!to) {
    res.status(400).json({ error: 'to is required' });
    return;
  }

  try {
    const { subject, html } = await renderTemplate('signup_welcome', variables || {});
    await sendEmail({ to, subject, html });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
    return;
  }

  res.status(200).json({ ok: true });
}
