// Reads Resend credentials from email_provider_settings (Super Admin ->
// Settings -> Email) via the service-role client, and sends mail
// through Resend's API. Also renders a stored email_templates row with
// simple {{variable}} substitution — the building block Phase C's
// trigger points (auth, password reset, new admin account, lead alert)
// will call.
import { Resend } from 'resend';
import { supabaseAdmin } from './supabaseAdmin.js';

async function getProviderSettings() {
  const { data } = await supabaseAdmin
    .from('email_provider_settings')
    .select('*')
    .eq('id', 1)
    .single();
  return data || {};
}

// Logo + footer are applied here, in ONE place every outgoing email
// already passes through — not baked into each template's html_body —
// so every email (transactional or admin-alert) is guaranteed the same
// branding with no risk of an individual template drifting out of sync.
// Falls back to a plain orange wordmark if no logo has been uploaded yet
// (never an emoji — this is what a customer actually receives).
async function wrapBrandedEmail(innerHtml) {
  const { data: platform } = await supabaseAdmin
    .from('platform_settings')
    .select('logo_url')
    .eq('id', 1)
    .single();
  const logoUrl = platform?.logo_url && /^https?:\/\//.test(platform.logo_url) ? platform.logo_url : null;

  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f7f5f2; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background:#ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ece7df;">
            <tr>
              <td align="center" style="padding: 28px 24px 20px; border-bottom: 1px solid #f0ece4;">
                ${logoUrl
                  ? `<img src="${logoUrl}" alt="Durga CRM" height="36" style="height:36px; width:auto; display:block;" />`
                  : `<span style="font-size:20px; font-weight:800; color:#ea580c; letter-spacing:0.02em;">DURGA CRM</span>`
                }
              </td>
            </tr>
            <tr>
              <td style="padding: 28px 28px 8px; color:#1f2937; font-size:15px; line-height:1.6;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 28px 28px; border-top: 1px solid #f0ece4; margin-top: 16px; color:#9ca3af; font-size:12px; line-height:1.7;">
                <p style="margin:16px 0 0;">
                  If you'd like to report an issue, reach out to DurgaCRM Help.<br/>
                  Post a support ticket from your account to get your issue resolved.
                </p>
                <p style="margin:16px 0 0;">
                  Copyright © 2026 DurgaCRM. All rights reserved.<br/>
                  Unit 527, PS Abacus, New Town, Kolkata 700161
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail({ to, subject, html }) {
  const settings = await getProviderSettings();
  const apiKey = settings.resend_api_key || process.env.RESEND_API_KEY;
  const fromAddress = settings.from_address || process.env.RESEND_FROM_ADDRESS;
  const fromName = settings.from_name || 'Durga CRM';

  if (!apiKey || !fromAddress) {
    throw new Error('Email provider is not configured (missing API key or from address)');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    html: await wrapBrandedEmail(html),
  });

  if (error) {
    throw new Error('Resend send failed: ' + (error.message || JSON.stringify(error)));
  }
}

function substitute(text, variables) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in (variables || {}) ? String(variables[key]) : match
  );
}

export async function renderTemplate(slug, variables) {
  const { data: template, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !template) {
    throw new Error(`Email template not found: ${slug}`);
  }
  return {
    subject: substitute(template.subject, variables),
    html: substitute(template.html_body, variables),
  };
}

// Fires an internal alert to every configured admin recipient (Super
// Admin -> Settings -> Email, one address per line) — new signup, new
// lead, new paid order. Always best-effort: a bad recipient never blocks
// the others, and callers should never await this on the critical path.
export async function sendAdminAlert(templateSlug, variables) {
  const settings = await getProviderSettings();
  const recipients = (settings.alert_recipient_emails || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;
  const rendered = await renderTemplate(templateSlug, variables);
  await Promise.allSettled(recipients.map(to => sendEmail({ to, ...rendered })));
}
