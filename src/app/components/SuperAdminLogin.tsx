import { useEffect, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { getPlatformSettingsRequest, PlatformSettings, superAdminRequestPasswordResetRequest } from '../lib/superAdminDb';

interface SuperAdminLoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export function SuperAdminLogin({ onLogin }: SuperAdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  useEffect(() => {
    getPlatformSettingsRequest().then(setPlatform).catch(() => {});
  }, []);

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

  const showLogo = platform?.showLogoOnSignin !== false;
  const bgImage = platform?.showSigninBackground && platform.signinBackgroundUrl ? platform.signinBackgroundUrl : null;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4 bg-cover bg-center"
      style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
    >
      <div className="w-full max-w-md">
        {showLogo && (
          <div className="text-center mb-6">
            <div className="inline-block relative mb-4">
              <div className="w-32 h-32 sm:w-[11.2rem] sm:h-[11.2rem] mx-auto bg-white dark:bg-gray-900 rounded-full shadow-2xl flex items-center justify-center border-4 border-orange-600 relative overflow-hidden">
                <div className="w-[7.2rem] h-[7.2rem] sm:w-[10.4rem] sm:h-[10.4rem] bg-gradient-to-br from-orange-100 to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-full flex items-center justify-center overflow-hidden">
                  {platform?.logoUrl ? (
                    <img src={platform.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ShieldCheck className="w-12 h-12 sm:w-16 sm:h-16 text-orange-600" />
                  )}
                </div>
              </div>
            </div>
            <h1 className="text-xl font-bold text-orange-600">Super Admin</h1>
          </div>
        )}

        <div className="bg-white dark:bg-gray-950 rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="Enter your username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
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
              className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setForgotMessage(''); }}
                className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Durga CRM platform administration
            </p>
            <a
              href="/login"
              onClick={e => { e.preventDefault(); window.history.pushState(null, '', '/login'); window.location.reload(); }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              Login as tenant
              <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForgotPassword(false)}>
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Reset your password</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Enter your Super Admin username — if it has an email on file, we'll send a reset link there.
            </p>
            {forgotMessage ? (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm">
                {forgotMessage}
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  value={forgotUsername}
                  onChange={e => setForgotUsername(e.target.value)}
                  placeholder="Username"
                  autoFocus
                  className="w-full px-4 py-2.5 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
                >
                  {forgotSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}
            <button
              onClick={() => setShowForgotPassword(false)}
              className="w-full mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
