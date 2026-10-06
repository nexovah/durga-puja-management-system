// POST /api/email/send-signup
// Body: { to, welcomeVariables: { name, committee_name, login_url }, alertVariables: { committee_name, email, phone, signup_type } }
// Public, no auth header — fired fire-and-forget right after a successful
// TRADITIONAL (password-path) signup_tenant() call: sends the user-facing
// welcome email AND the admin new-signup alert in one request (merged
// from 2 separate endpoints to stay under Vercel Hobby's 12-serverless-
// function cap). The Google path sends both server-side instead, directly
// from google-verify.js.
import { sendEmail, renderTemplate, sendAdminAlert } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { to, welcomeVariables, alertVariables } = req.body || {};

  if (to) {
    try {
      const { subject, html } = await renderTemplate('signup_welcome', welcomeVariables || {});
      await sendEmail({ to, subject, html });
    } catch {
      // Best-effort — never block the signup flow that already succeeded.
    }
  }

  try {
    await sendAdminAlert('new_signup_alert', alertVariables || {});
  } catch {
    // Best-effort.
  }

  res.status(200).json({ ok: true });
}
