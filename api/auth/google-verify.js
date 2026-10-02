// POST /api/auth/google-verify
// Body: { idToken: string }
// Public, no auth header — this IS the auth entry point for Google sign-in/
// signup, now a single round trip (no more two-step "pick a committee name"
// flow — see supabase/112_signup_no_committee_name.sql, the tenant gets an
// auto-derived placeholder name instead). Every request starts by verifying
// idToken's signature against Google's public JWKS (via google-auth-library,
// official + handles key rotation) — only after that succeeds do we trust
// the email/name/sub it carries. This verified identity is what's passed to
// signup_tenant_google / login_by_google_subject (both service-role-only
// RPCs, never anon-callable) — see supabase/109_tenant_signup.sql's header
// comment for why.
//
// If an app_users row already exists for this Google subject, logs them
// straight in. Otherwise, creates the tenant right away (auto-derived name)
// and logs the brand-new account straight in too — a single click either way.
import { OAuth2Client } from 'google-auth-library';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { sendEmail, renderTemplate } from '../_lib/email.js';

async function getClientId() {
  const { data } = await supabaseAdmin
    .from('google_oauth_settings')
    .select('client_id')
    .eq('id', 1)
    .single();
  return data?.client_id || null;
}

async function verifyIdToken(idToken, clientId) {
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload?.sub) {
    throw new Error('Invalid Google token payload');
  }
  return { email: payload.email, name: payload.name || '', sub: payload.sub };
}

export default async function handler(req, res) {
  // Top-level safety net: ANY unexpected throw anywhere below (a missing
  // env var, an RPC call throwing instead of returning {error}, etc.)
  // previously crashed the function before any res.json() call, which
  // Vercel then returns as an empty/HTML error page — the frontend's
  // res.json() on that empty body threw "Unexpected end of JSON input",
  // masking the real error entirely. Wrapping everything guarantees a
  // real JSON response (with the actual error message) no matter what
  // goes wrong inside.
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { idToken } = req.body || {};
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }

    const clientId = await getClientId();
    if (!clientId) {
      res.status(500).json({ error: 'Google sign-in is not configured yet' });
      return;
    }

    let identity;
    try {
      identity = await verifyIdToken(idToken, clientId);
    } catch (err) {
      res.status(401).json({ error: 'Google verification failed: ' + err.message });
      return;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('app_users')
      .select('google_subject')
      .eq('google_subject', identity.sub)
      .eq('auth_provider', 'google')
      .maybeSingle();
    if (existingError) {
      res.status(500).json({ error: 'Lookup failed: ' + existingError.message });
      return;
    }

    let isNewSignup = false;
    if (!existing) {
      isNewSignup = true;
      const { error: createError } = await supabaseAdmin.rpc('signup_tenant_google', {
        p_email: identity.email,
        p_name: identity.name,
        p_google_subject: identity.sub,
      });
      if (createError) {
        res.status(400).json({ error: createError.message || 'Could not create account' });
        return;
      }
    }

    const { data: loggedIn, error: loginError } = await supabaseAdmin.rpc('login_by_google_subject', { p_google_subject: identity.sub });
    if (loginError || !loggedIn || loggedIn.length === 0) {
      res.status(500).json({ error: loginError?.message || (isNewSignup ? 'Account created but auto-login failed — please sign in again' : 'Account not found or inactive') });
      return;
    }

    if (isNewSignup) {
      try {
        const { subject, html } = await renderTemplate('signup_welcome', {
          name: identity.name || loggedIn[0].name,
          committee_name: loggedIn[0].name,
          login_url: `${req.headers.origin || ''}/login`,
        });
        await sendEmail({ to: identity.email, subject, html });
      } catch {
        // Never block signup over a failed welcome email.
      }
    }

    res.status(200).json({ user: loggedIn[0] });
  } catch (err) {
    console.error('google-verify handler crashed:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
