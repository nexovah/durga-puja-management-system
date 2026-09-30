// POST /api/auth/request-tenant-password-reset
// Body: { username: string }
// Public, no auth — mirrors send-super-admin-reset-email's Edge Function,
// but for tenant app_users, using our own supabaseAdmin + email.js instead
// of a separate Edge Function. Always returns the same generic response
// regardless of whether the username existed or had an email on file, so
// this can't be used to enumerate tenant usernames.
import crypto from 'crypto';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

const GENERIC_RESPONSE = { message: 'If that account exists and has an email on file, a reset link has been sent.' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(200).json(GENERIC_RESPONSE);
    return;
  }

  try {
    const { data: user } = await supabaseAdmin
      .from('app_users')
      .select('id, name, email')
      .eq('username', username.trim())
      .maybeSingle();

    if (user?.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await supabaseAdmin.from('tenant_password_reset_tokens').insert({
        app_user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;
      const resetLink = `${siteUrl}/reset-password?token=${token}`;

      const { subject, html } = await renderTemplate('password_reset', { name: user.name || '', reset_link: resetLink });
      await sendEmail({ to: user.email, subject, html });
    }
  } catch {
    // Swallow — always respond generically below, regardless of outcome.
  }

  res.status(200).json(GENERIC_RESPONSE);
}
