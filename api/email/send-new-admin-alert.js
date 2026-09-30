// POST /api/email/send-new-admin-alert
// Body: { to: string, variables: { committee_name, name, username, password, login_url } }
// Header: Authorization: Bearer <super admin access_token>
//
// Fired fire-and-forget right after a successful tenant creation
// (SuperAdminPanel.tsx's handleCreate) — never blocks tenant creation,
// which has already succeeded by this point.
import { verifySuperAdminToken } from '../_lib/verifySuperAdminToken.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    verifySuperAdminToken(req.headers.authorization);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: ' + err.message });
    return;
  }

  const { to, variables } = req.body || {};
  if (!to) {
    res.status(400).json({ error: 'to is required' });
    return;
  }

  try {
    const { subject, html } = await renderTemplate('new_admin_account', variables || {});
    await sendEmail({ to, subject, html });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
    return;
  }

  res.status(200).json({ ok: true });
}
