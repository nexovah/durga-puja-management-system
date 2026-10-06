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
    html,
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
