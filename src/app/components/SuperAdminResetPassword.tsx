import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { superAdminResetPasswordRequest, isPasswordStrong } from '../lib/superAdminDb';

// /super-admin/reset-password?token=... — the landing page for the link
// sent by the send-super-admin-reset-email Edge Function. Reachable before
// login (SuperAdminRoot checks the path ahead of the auth gate).
export function SuperAdminResetPassword({ onDone }: { onDone: () => void }) {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!isPasswordStrong(password)) {
      setError('Password must be at least 8 characters and include a letter and a digit.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await superAdminResetPasswordRequest(token, password);
      if (ok) {
        setDone(true);
      } else {
        setError('This reset link is invalid or has expired. Request a new one from the login screen.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto bg-white dark:bg-gray-900 rounded-full shadow-xl flex items-center justify-center border-4 border-orange-600 mb-4">
            <ShieldCheck className="w-9 h-9 text-orange-600" />
          </div>
          <h1 className="text-xl font-bold text-orange-600">Reset password</h1>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-3xl shadow-xl p-8">
          {!token ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              This link is missing its reset token. Request a new one from the login screen.
            </p>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm">
                Password changed. You can now sign in with your new password.
              </div>
              <button
                onClick={onDone}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    autoFocus
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
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Confirm new password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors shadow-lg disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
