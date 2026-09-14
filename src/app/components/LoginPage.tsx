import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  logo: string;
  onLogin: (username: string, password: string) => boolean;
}

export function LoginPage({ logo, onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('ইউজারনেম এবং পাসওয়ার্ড দিন');
      return;
    }

    const success = onLogin(username, password);
    if (!success) {
      setError('ভুল ইউজারনেম অথবা পাসওয়ার্ড');
    }
  };

  // Check if logo is emoji or image
  const isEmoji = logo && logo.length <= 10 && !logo.startsWith('data:') && !logo.startsWith('http');

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Badge */}
        <div className="text-center mb-6">
          <div className="inline-block relative mb-4">
            {/* Main logo circle with border */}
            <div className="w-56 h-56 mx-auto bg-white rounded-full shadow-2xl flex items-center justify-center border-8 border-orange-600 relative overflow-hidden">
              {/* Inner circle for logo */}
              <div className="w-52 h-52 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center relative overflow-hidden p-2">
                {isEmoji ? (
                  <div className="text-9xl">{logo}</div>
                ) : logo ? (
                  <img 
                    src={logo} 
                    alt="Logo" 
                    className="w-full h-full object-contain rounded-full"
                  />
                ) : (
                  <div className="text-9xl">🕉️</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white px-6 py-3 rounded-full inline-block shadow-lg">
            <h1 className="text-xl font-bold text-orange-600">
              কমিটি ম্যানেজমেন্ট সিস্টেম
            </h1>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-orange-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-3">
                ইউজার আইডি
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="আপনার ইউজার আইডি লিখুন"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-800 mb-3">
                পাসওয়ার্ড
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-orange-400 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  placeholder="আপনার পাসওয়ার্ড লিখুন"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors shadow-lg"
            >
              লগইন করুন
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-700 leading-relaxed">
              দুর্গা পূজা কমিটির সকল কার্যক্রম সহজে পরিচালনা করুন।<br />
              সদস্য, চাঁদা, খরচ ও আর্থিক হিসাব এক জায়গায়।
            </p>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>ডিফল্ট লগইন: admin / admin123</p>
        </div>
      </div>
    </div>
  );
}