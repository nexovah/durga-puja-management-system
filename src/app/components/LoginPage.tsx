import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface LoginPageProps {
  logo: string;
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export function LoginPage({ logo, onLogin }: LoginPageProps) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // Check if logo is emoji or image
  const isEmoji = logo && logo.length <= 10 && !logo.startsWith('data:') && !logo.startsWith('http');

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Badge */}
        <div className="text-center mb-6">
          <div className="inline-block relative mb-4">
            {/* Main logo circle with border */}
            <div className="w-32 h-32 sm:w-[11.2rem] sm:h-[11.2rem] mx-auto bg-white dark:bg-gray-900 rounded-full shadow-2xl flex items-center justify-center border-4 sm:border-8 border-orange-600 relative overflow-hidden">
              {/* Inner circle for logo */}
              <div className="w-[7.2rem] h-[7.2rem] sm:w-[10.4rem] sm:h-[10.4rem] bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center relative overflow-hidden p-2">
                {isEmoji ? (
                  <div className="text-5xl sm:text-7xl">{logo}</div>
                ) : logo ? (
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-full"
                  />
                ) : (
                  <div className="text-5xl sm:text-7xl">🕉️</div>
                )}
              </div>
            </div>
          </div>

          <h1 className="text-xl font-bold text-orange-600">
            {t('login.systemTitle')}
          </h1>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-950 rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t('login.userId')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder={t('login.userIdPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t('login.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
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
              className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('login.tagline1')} {t('login.tagline2')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
