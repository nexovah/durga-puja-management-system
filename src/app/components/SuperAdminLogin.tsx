import { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { superAdminRequestPasswordResetRequest } from '../lib/superAdminDb';
import { AuthShowcaseLayout } from './AuthShowcaseLayout';

interface SuperAdminLoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

// Same visual shell as the tenant login screen (AuthShowcaseLayout) — same
// background, same showcase card, same input/button sizing — just Super
// Admin's own form content in the right-hand column. No Google sign-in, no
// signup; the forgot-password panel swaps in place of the login fields
// instead of opening as a modal, matching LoginPage.tsx's convention.
export function SuperAdminLogin({ onLogin }: SuperAdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgotPassword'>('login');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    const success = await onLogin(username, password);
    setSubmitting(false);
    if (!success) setError('Invalid username or password.');
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotSubmitting(true);
    setForgotMessage('');
    try {
      await superAdminRequestPasswordResetRequest(forgotUsername.trim());
    } catch {
      // Deliberately no error surfaced — the endpoint always resolves the
      // same way regardless of outcome, so a network hiccup gets the same
      // generic message rather than leaking anything about the account.
    } finally {
      setForgotSubmitting(false);
      setForgotMessage('If that account exists and has an email on file, a reset link has been sent.');
    }
  };

  const inputClass = 'w-full px-5 py-3 border-2 border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-base placeholder:text-gray-400';

  const forgotPasswordPanel = (
    <div className="w-full max-w-md">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">Reset your password</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-7">
        Enter your Super Admin username — if it has an email on file, we'll send a reset link there.
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
              placeholder="Enter your username"
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
        onClick={() => { setMode('login'); setForgotMessage(''); }}
        className="w-full mt-6 text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-center"
      >
        Back to login
      </button>
    </div>
  );

  const loginFormPanel = (
    <div className="w-full max-w-md">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">
        Super Admin
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-7">
        Durga CRM platform administration.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">Username</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className={inputClass}
            placeholder="Enter your username"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-800 dark:text-gray-200 mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
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
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center justify-between mt-6 text-base">
        <a
          href="/login"
          onClick={e => { e.preventDefault(); window.history.pushState(null, '', '/login'); window.location.reload(); }}
          className="inline-flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-500 hover:underline"
        >
          Login as tenant
          <ArrowRight size={15} />
        </a>
        <button
          type="button"
          onClick={() => { setMode('forgotPassword'); setForgotMessage(''); }}
          className="font-medium text-red-500 hover:text-red-600 hover:underline"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );

  const formColumn = mode === 'forgotPassword' ? forgotPasswordPanel : loginFormPanel;

  return (
    <AuthShowcaseLayout
      heading1="One Platform. Every Puja."
      heading2="Everything Organized."
      helpTitle="Platform Administration"
      helpDesc="Manage tenants, subscriptions, settings, and every committee on Durga CRM from one place."
      formColumn={formColumn}
    />
  );
}
