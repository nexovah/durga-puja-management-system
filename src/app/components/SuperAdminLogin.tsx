import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface SuperAdminLoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export function SuperAdminLogin({ onLogin }: SuperAdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-block relative mb-4">
            <div className="w-32 h-32 sm:w-[11.2rem] sm:h-[11.2rem] mx-auto bg-white dark:bg-gray-900 rounded-full shadow-2xl flex items-center justify-center border-4 sm:border-8 border-orange-600 relative overflow-hidden">
              <div className="w-[7.2rem] h-[7.2rem] sm:w-[10.4rem] sm:h-[10.4rem] bg-gradient-to-br from-orange-100 to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-12 h-12 sm:w-16 sm:h-16 text-orange-600" />
              </div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Super Admin</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Durga CRM platform administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 sm:p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium transition"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
