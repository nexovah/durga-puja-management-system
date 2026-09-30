// POST /api/email/send-login-notification
// Body: { email: string, name?: string }
// Header: Authorization: Bearer <tenant access_token from login()>
//
// Fired fire-and-forget right after a successful login (loginRequest() in
// src/app/lib/db.ts) — proves the caller really just authenticated via the
// bearer token, then sends the "authentication" template as a plain login
// notification (no real OTP/2FA exists in this app; confirmed scope).
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    verifyTenantToken(req.headers.authorization);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: ' + err.message });
    return;
  }

  const { email, name } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  try {
    const { subject, html } = await renderTemplate('authentication', { name: name || '' });
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    // Best-effort — never block or fail login over a notification.
    res.status(200).json({ ok: false, error: err.message });
    return;
  }

  res.status(200).json({ ok: true });
}
