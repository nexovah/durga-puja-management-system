import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { setOwnPhoneRequest } from '../lib/db';
import { onlyDigits, isPhoneValid } from '../lib/validation';
import { RequiredMark } from './RequiredMark';

// Hard gate — mirrors CreateFirstEventScreen.tsx's pattern exactly. Shown
// to any admin account with no phone on file: every self-serve signup
// before this feature existed, and every Google signup (Google's OAuth
// profile never includes a phone number, so it can't be collected on that
// path's own form the way manual signup's can).
export function PhoneCaptureScreen({
  currentUserId, onCompleted, onLogout,
}: {
  currentUserId: string;
  onCompleted: (phone: string) => void;
  onLogout: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!isPhoneValid(phone, true)) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setOwnPhoneRequest(currentUserId, phone);
      onCompleted(phone);
    } catch (err: any) {
      console.error('Failed to save phone number', err);
      setError(err?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-md p-8 border border-gray-200 dark:border-gray-800">
        <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-2xl">📞</div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 text-center">One more thing</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          Add the best number to reach your committee on — we'll only use it to help set up your account
          and keep you posted on your <span className="font-semibold text-orange-600">1 month free</span> offer.
        </p>

        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone number<RequiredMark /></label>
          <input
            value={phone}
            onChange={e => setPhone(onlyDigits(e.target.value))}
            placeholder="10-digit mobile number"
            autoFocus
            className="w-full mt-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
          />
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
        <button
          onClick={onLogout}
          className="w-full mt-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium transition"
        >
          <span className="inline-flex items-center gap-2 justify-center w-full"><LogOut size={16} /> Log out</span>
        </button>
      </div>
    </div>
  );
}
