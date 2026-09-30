// POST /api/email/send-test
// Body: { to: string, templateSlug?: string }
// Header: Authorization: Bearer <super admin access_token>
//
// Lets a Super Admin confirm the Resend API key/from-address actually
// works before any real trigger point exists (Phase C). If templateSlug
// is given, renders that template with sample placeholder values;
// otherwise sends a plain hardcoded test message.
import { verifySuperAdminToken } from '../_lib/verifySuperAdminToken.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

const SAMPLE_VARIABLES = {
  committee_name: 'Sample Puja Committee',
  name: 'Sample Name',
  otp: '123456',
  reset_link: 'https://example.com/reset/sample-token',
};

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

  const { to, templateSlug } = req.body || {};
  if (!to) {
    res.status(400).json({ error: 'to is required' });
    return;
  }

  try {
    if (templateSlug) {
      const { subject, html } = await renderTemplate(templateSlug, SAMPLE_VARIABLES);
      await sendEmail({ to, subject: `[Test] ${subject}`, html });
    } else {
      await sendEmail({
        to,
        subject: '[Test] Durga CRM email settings',
        html: '<p>This is a test email confirming your Resend configuration works.</p>',
      });
    }
  } catch (err) {
    res.status(502).json({ error: err.message });
    return;
  }

  res.status(200).json({ ok: true });
}
