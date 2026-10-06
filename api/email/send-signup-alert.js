// POST /api/email/send-signup-alert
// Body: { variables: { committee_name, email, phone, signup_type } }
// Public, no auth header — fired fire-and-forget right after a successful
// manual (password-path) signup_tenant() call, same pattern as
// send-signup-welcome.js. The Google path fires the equivalent
// sendAdminAlert('new_signup_alert', ...) server-side directly from
// google-verify.js instead.
import { sendAdminAlert } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { variables } = req.body || {};

  try {
    await sendAdminAlert('new_signup_alert', variables || {});
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
    return;
  }

  res.status(200).json({ ok: true });
}
