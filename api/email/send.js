// POST /api/email/send
// Body: { action: 'loginNotification' | 'newAdminAlert' | 'signup' | 'test' | 'ticketAlert', ... }
//
// All simple fire-and-forget email endpoints merged into one dispatcher
// (from 4 separate single-purpose files, plus the new ticketAlert
// action) to stay under Vercel Hobby's 12-serverless-function cap, same
// consolidation approach already used for api/billing/subscription.js
// and api/billing/admin.js. Each action keeps its own original auth
// requirement — they're not uniformly gated, since callers range from
// public (new signup) to tenant-token to super-admin-token.
import { verifyTenantToken } from '../_lib/verifyTenantToken.js';
import { verifySuperAdminToken } from '../_lib/verifySuperAdminToken.js';
import { sendEmail, renderTemplate, sendAdminAlert } from '../_lib/email.js';

// action: 'loginNotification' — Body: { email, name? }
// Header: tenant token. Fired right after a successful login.
async function handleLoginNotification(req, res) {
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
    res.status(200).json({ ok: false, error: err.message });
    return;
  }
  res.status(200).json({ ok: true });
}

// action: 'newAdminAlert' — Body: { to, variables: { committee_name, name, username, password, login_url } }
// Header: super admin token. Fired right after Super Admin creates a tenant manually.
async function handleNewAdminAlert(req, res) {
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

// action: 'signup' — Body: { to, welcomeVariables, alertVariables }
// Public, no auth. Fired right after a successful manual signup.
async function handleSignup(req, res) {
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

const TEST_SAMPLE_VARIABLES = {
  committee_name: 'Sample Puja Committee',
  name: 'Sample Name',
  otp: '123456',
  reset_link: 'https://example.com/reset/sample-token',
};

// action: 'test' — Body: { to, templateSlug? }
// Header: super admin token. Lets Super Admin confirm Resend works.
async function handleTest(req, res) {
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
      const { subject, html } = await renderTemplate(templateSlug, TEST_SAMPLE_VARIABLES);
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

// action: 'ticketAlert' — Body: { ticketCode, eventType: 'created' | 'reply', subject, committeeName, senderName, excerpt }
// Header: tenant token (matches the caller's own already-authenticated
// insert into support_tickets/support_ticket_replies). Fired right
// after a tenant creates a ticket or replies to one — never for the
// admin's own reply (no point alerting Super Admin about themselves).
async function handleTicketAlert(req, res) {
  try {
    verifyTenantToken(req.headers.authorization);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: ' + err.message });
    return;
  }
  const { ticketCode, eventType, subject, committeeName, senderName, excerpt } = req.body || {};
  if (!ticketCode || !subject) {
    res.status(400).json({ error: 'ticketCode and subject are required' });
    return;
  }
  try {
    await sendAdminAlert('support_ticket_alert', {
      ticket_code: ticketCode,
      event_type: eventType === 'reply' ? 'New reply' : 'New ticket',
      subject,
      committee_name: committeeName || '',
      sender_name: senderName || '',
      excerpt: excerpt || '',
    });
  } catch {
    // Best-effort — never block the ticket post/reply that already succeeded.
  }
  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { action } = req.body || {};
  if (action === 'loginNotification') return handleLoginNotification(req, res);
  if (action === 'newAdminAlert') return handleNewAdminAlert(req, res);
  if (action === 'signup') return handleSignup(req, res);
  if (action === 'test') return handleTest(req, res);
  if (action === 'ticketAlert') return handleTicketAlert(req, res);
  res.status(400).json({ error: 'Unknown action' });
}
