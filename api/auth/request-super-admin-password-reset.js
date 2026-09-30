// POST /api/auth/request-super-admin-password-reset
// Body: { username: string }
// Public, no auth — supersedes the old send-super-admin-reset-email Edge
// Function, which used its own separate Supabase secrets. This uses the
// same api/_lib/email.js (Resend, configured in Super Admin -> Settings ->
// Email) and supabaseAdmin as the tenant reset flow, so there's one config
// to manage instead of two. Reuses the existing
// super_admin_password_resets table and super_admin_reset_password RPC
// (supabase/062_super_admin_password_reset.sql) unchanged — always returns
// the same generic response regardless of outcome, so this can't be used
// to enumerate Super Admin usernames.
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
    const { data: admin } = await supabaseAdmin
      .from('super_admins')
      .select('id, name, email')
      .eq('username', username.trim())
      .maybeSingle();

    if (admin?.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await supabaseAdmin.from('super_admin_password_resets').insert({
        super_admin_id: admin.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;
      const resetLink = `${siteUrl}/super-admin/reset-password?token=${token}`;

      const { subject, html } = await renderTemplate('password_reset', { name: admin.name || '', reset_link: resetLink });
      await sendEmail({ to: admin.email, subject, html });
    }
  } catch {
    // Swallow — always respond generically below, regardless of outcome.
  }

  res.status(200).json(GENERIC_RESPONSE);
}
