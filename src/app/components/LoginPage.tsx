import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getPlatformSettingsRequest, getGoogleClientIdRequest, isPasswordStrong } from '../lib/superAdminDb';
import { requestTenantPasswordResetRequest, signupTenantRequest } from '../lib/db';
import { AuthShowcaseLayout } from './AuthShowcaseLayout';

declare global {
  interface Window {
    google?: any;
  }
}

type GoogleAuthResult = { success: boolean; error?: string };

type LoginMode = 'login' | 'signup' | 'forgotPassword';

interface LoginPageProps {
  logo: string;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onGoogleAuth: (idToken: string) => Promise<GoogleAuthResult>;
  initialMode?: LoginMode;
  // Called only for the two modes that have their own URL (/login,
  // /signup) — forgotPassword stays a transient in-page sub-state, same as
  // before, no route of its own.
  onModeChange?: (mode: 'login' | 'signup') => void;
}

// Renders (and self-manages) one instance of the Google Identity Services
// button. Deliberately its own component, not inline markup sharing a ref
// from the parent — AuthShowcaseLayout mounts its `formColumn` prop TWICE
// simultaneously (a desktop-row copy and a mobile-stack copy, swapped via
// CSS visibility, not actual mount/unmount), so a single shared ref in the
// parent would only ever end up pointing at whichever copy happened to
// mount last, leaving the other copy's container permanently empty. As a
// real component, React gives each of those two simultaneous tree
// positions its own independent instance (own ref, own "did I already
// init" flag), so both copies render correctly.
function GoogleAuthButtonSlot({
  mode,
  googleReady,
  googleClientId,
  onCredential,
  errorMessage,
  label,
}: {
  mode: 'login' | 'signup' | 'forgotPassword';
  googleReady: boolean;
  googleClientId: string;
  onCredential: (response: { credential: string }) => void;
  errorMessage: string;
  label: string;
}) {
  const btnRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!googleReady || !btnRef.current) return;

    if (!initializedRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: onCredential,
        });
        initializedRef.current = true;
      } catch (err) {
        // Surfaced so a misconfigured Client ID / unauthorized origin shows
        // up in the console instead of the button just silently never
        // appearing — check here first if the button isn't rendering.
        console.error('Google Identity Services initialize() failed:', err);
        return;
      }
    }

    try {
      btnRef.current.innerHTML = '';
      // No dynamic width measurement, no resize listener, no scaling —
      // GIS hard-caps its own rendered button at 400px internally no
      // matter what's requested, so there's nothing to gain from matching
      // the container size here. This button's own width has no effect
      // on the surrounding form column's width (that's set independently
      // by the panel's own max-w-* class) — fixed at Google's real max.
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 400,
        text: mode === 'signup' ? 'signup_with' : 'signin_with',
      });
    } catch (err) {
      console.error('Google Identity Services renderButton() failed:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, googleReady]);

  return (
    <div className="mb-7">
      <div ref={btnRef} className="w-full flex justify-center" />
      {errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">{errorMessage}</p>
      )}
    </div>
  );
}

// Figma redesign (1920x1080) — decorative background rings/emblem/analytics
// preview image are the 3 provided assets (src/assets/login/*), the right
// column is still the same functional login form (same state, same
// onLogin/forgot-password wiring, no backend change) just restyled to
// match the new design. Google sign-in is intentionally static/non-wired
// per explicit instruction — no auth provider integration exists yet.
export function LoginPage({ logo, onLogin, onGoogleAuth, initialMode, onModeChange }: LoginPageProps) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setModeState] = useState<LoginMode>(initialMode || 'login');
  const goToMode = (next: LoginMode) => {
    setModeState(next);
    if (next === 'login' || next === 'signup') onModeChange?.(next);
  };
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');

  useEffect(() => {
    getPlatformSettingsRequest().then(p => setPlatformLogo(p.logoUrl)).catch(() => {});
  }, []);

  // --- Traditional signup state (email + password + confirm only — no
  //     committee name; the tenant gets an auto-derived placeholder name,
  //     renamed later from Settings) ---
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupShowPassword, setSignupShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState('');

  const [googleButtonError, setGoogleButtonError] = useState('');

  // --- Google Identity Services button loading ---
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);

  useEffect(() => {
    getGoogleClientIdRequest().then(id => setGoogleClientId(id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGoogleScriptLoaded(true);
      return;
    }
    if (document.getElementById('google-identity-script')) {
      // Script tag already exists from an earlier mount (e.g. a Vite HMR
      // reload during dev) but window.google isn't populated yet — its own
      // onload already fired/will fire on that original element, which
      // this new mount never gets notified of. Poll instead of waiting on
      // an event we can't attach to, so the button doesn't get stuck
      // permanently unrendered.
      const id = setInterval(() => {
        if (window.google?.accounts?.id) {
          setGoogleScriptLoaded(true);
          clearInterval(id);
        }
      }, 100);
      const timeout = setTimeout(() => clearInterval(id), 10000);
      return () => { clearInterval(id); clearTimeout(timeout); };
    }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setGoogleButtonError('');
    const result = await onGoogleAuth(response.credential);
    if (result.success) return; // App.tsx already logged the user in (signup or sign-in, one click either way).
    setGoogleButtonError(result.error || 'Google sign-in failed');
  };

  const googleReady = googleScriptLoaded && !!googleClientId && !!window.google?.accounts?.id;

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!signupEmail.trim() || !signupPassword) {
      setSignupError(t('login.enterCredentials'));
      return;
    }
    if (!isPasswordStrong(signupPassword)) {
      setSignupError(t('login.signup.passwordTooWeak'));
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupError(t('login.signup.passwordMismatch'));
      return;
    }
    if (!agreedToTerms) {
      setSignupError(t('login.signup.agreeTermsRequired'));
      return;
    }

    setSignupSubmitting(true);
    try {
      await signupTenantRequest(signupEmail.trim(), signupPassword);
      // Tenant now exists with username = email — log straight in through
      // the same prop/flow a normal login uses (App.tsx's handleLogin),
      // so session state ends up identical either way.
      const success = await onLogin(signupEmail.trim(), signupPassword);
      if (!success) {
        setSignupError('Account created — please sign in.');
        goToMode('login');
      }
    } catch (err: any) {
      setSignupError(err?.message || 'Could not create account — please try again.');
    } finally {
      setSignupSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t('login.enterCredentials'));
      return;
    }

    setSubmitting(true);
    const success = await onLogin(username, password);
    setSubmitting(false);
    if (!success) {
      setError(t('login.invalidCredentials'));
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotSubmitting(true);
    setForgotMessage('');
    try {
      await requestTenantPasswordResetRequest(forgotUsername.trim());
    } catch {
      // Deliberately no error surfaced — the endpoint always resolves the
      // same way regardless of outcome, so a network hiccup gets the same
      // generic message rather than leaking anything about the account.
    } finally {
      setForgotSubmitting(false);
      setForgotMessage('If that account exists and has an email on file, a reset link has been sent.');
    }
  };

  // `logo` is always the '🕉️' default here (see note above) — prefer the
  // platform logo over that default when one's been uploaded. Unused in
  // the new design's form column (the emblem graphic replaces it), kept
  // only for the brand-name/system-title header text.
  const effectiveLogo = logo === '🕉️' && platformLogo ? platformLogo : logo;
  void effectiveLogo;

  const inputClass = 'w-full px-5 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-base placeholder:text-gray-400';

  const forgotPasswordPanel = (
    <div className="w-full max-w-md min-[2400px]:max-w-xl">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">Reset your password</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-7">
        Enter your username — if it has an email on file, we'll send a reset link there.
      </p>

      {forgotMessage ? (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm">
          {forgotMessage}
        </div>
      ) : (
        <form onSubmit={handleForgotSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">Username</label>
            <input
              value={forgotUsername}
              onChange={e => setForgotUsername(e.target.value)}
              placeholder={t('login.userIdPlaceholder')}
              autoFocus
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={forgotSubmitting}
            className="w-full bg-orange-600 text-white py-3 rounded-2xl font-medium text-base hover:bg-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {forgotSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => { goToMode('login'); setForgotMessage(''); }}
        className="w-full mt-6 text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-center"
      >
        Back to login
      </button>
    </div>
  );

  // The GIS button renders into this div — shared markup between the login
  // and signup panels (only one is ever mounted at a time, so there's no
  // collision). A plain disabled-looking fallback shows while the script/
  // client id are still loading, so there's no broken flash.
  // AuthShowcaseLayout renders `formColumn` TWICE simultaneously in the DOM
  // (a desktop-row copy and a mobile-stack copy — CSS just hides whichever
  // doesn't match the viewport, both actually exist at once). A single
  // shared useRef here would only ever point at whichever copy mounted
  // last, leaving the other copy's button permanently empty — this is an
  // actual component so each of the two simultaneous copies gets its own
  // independent ref/init state via React's normal per-position instancing.
  const googleButtonSlot = (
    <GoogleAuthButtonSlot
      mode={mode}
      googleReady={googleReady}
      googleClientId={googleClientId}
      onCredential={handleGoogleCredential}
      errorMessage={googleButtonError}
      label={mode === 'signup' ? t('login.signup.googleButton') : t('login.google')}
    />
  );

  const loginFormPanel = (
    <div className="w-full max-w-md min-[2400px]:max-w-xl">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">
        {t('login.join.title')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-7">
        {t('login.join.subtitle')}
      </p>

      {googleButtonSlot}

      <hr className="border-t border-gray-200 dark:border-gray-700 mt-[30px] mb-7" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">
            {t('login.userId')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
            placeholder={t('login.userIdPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">
            {t('login.password')}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder={t('login.passwordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-orange-600 text-white py-3 rounded-2xl font-medium text-base hover:bg-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <div className="flex items-center justify-between mt-6 text-base">
        <span className="text-gray-400 dark:text-gray-500">
          {t('login.alreadyHaveAccount')}{' '}
          <button
            type="button"
            onClick={() => { goToMode('signup'); setSignupError(''); }}
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-500 hover:underline"
          >
            {t('login.signIn')}
          </button>
        </span>
        <button
          type="button"
          onClick={() => { goToMode('forgotPassword'); setForgotMessage(''); }}
          className="font-medium text-red-500 hover:text-red-600 hover:underline"
        >
          {t('login.forgotPassword')}
        </button>
      </div>
    </div>
  );

  const signupPanel = (
    <div className="w-full max-w-md min-[2400px]:max-w-xl">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">
        {t('login.signup.title')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-7">
        {t('login.signup.subtitle')}
      </p>

      {googleButtonSlot}

      <hr className="border-t border-gray-200 dark:border-gray-700 mt-[30px] mb-7" />

      <form onSubmit={handleSignupSubmit} className="space-y-5">
        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">
            {t('login.signup.email')}
          </label>
          <input
            type="email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            className={inputClass}
            placeholder={t('login.signup.emailPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">
            {t('login.password')}
          </label>
          <div className="relative">
            <input
              type={signupShowPassword ? 'text' : 'password'}
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder={t('login.passwordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setSignupShowPassword(!signupShowPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {signupShowPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">
            {t('login.signup.confirmPassword')}
          </label>
          <input
            type={signupShowPassword ? 'text' : 'password'}
            value={signupConfirmPassword}
            onChange={(e) => setSignupConfirmPassword(e.target.value)}
            className={inputClass}
            placeholder={t('login.signup.confirmPasswordPlaceholder')}
          />
        </div>

        <label className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {t('login.signup.terms')} —{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
              Terms & Conditions
            </a>
          </span>
        </label>

        {signupError && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
            {signupError}
          </div>
        )}

        <button
          type="submit"
          disabled={signupSubmitting}
          className="w-full bg-orange-600 text-white py-3 rounded-2xl font-medium text-base hover:bg-orange-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {signupSubmitting ? t('login.signup.submitting') : t('login.signup.submit')}
        </button>
      </form>

      <div className="mt-6 text-base text-center">
        <span className="text-gray-400 dark:text-gray-500">
          {t('login.signup.haveAccount')}{' '}
          <button
            type="button"
            onClick={() => { goToMode('login'); setError(''); }}
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-500 hover:underline"
          >
            {t('login.signup.signInCta')}
          </button>
        </span>
      </div>
    </div>
  );

  // Same column, same position as the login fields — every other mode
  // swaps in place of the form instead of opening as a modal/separate page.
  const formColumn =
    mode === 'forgotPassword' ? forgotPasswordPanel :
    mode === 'signup' ? signupPanel :
    loginFormPanel;

  return (
    <AuthShowcaseLayout
      heading1={t('login.showcase.heading1')}
      heading2={t('login.showcase.heading2')}
      helpTitle={t('login.showcase.helpTitle')}
      helpDesc={t('login.showcase.helpDesc')}
      formColumn={formColumn}
    />
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.6 10.23c0-.68-.06-1.33-.17-1.96H10v3.71h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.98-4.3 2.98-7.27Z" fill="#4285F4" />
      <path d="M10 20c2.7 0 4.96-.9 6.61-2.43l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.59A10 10 0 0 0 10 20Z" fill="#34A853" />
      <path d="M4.41 11.9A5.99 5.99 0 0 1 4.09 10c0-.66.11-1.3.32-1.9V5.51H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.49l3.34-2.59Z" fill="#FBBC05" />
      <path d="M10 3.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.7 0 10 0A10 10 0 0 0 1.07 5.51l3.34 2.59C5.2 5.74 7.4 3.98 10 3.98Z" fill="#EB4335" />
    </svg>
  );
}
