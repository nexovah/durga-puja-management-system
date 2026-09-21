import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SuperAdminConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean; // red theme vs. amber for a lighter action like disable
  onCancel: () => void;
  onConfirm: () => void;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const generateCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// Static class strings per accent — Tailwind's build-time purge can't see
// through `text-${accent}-600` template interpolation, so every class used
// must appear literally somewhere in the source.
const THEME = {
  red: {
    icon: 'text-red-600',
    box: 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30',
    label: 'text-red-700 dark:text-red-400',
    code: 'text-red-700 dark:text-red-400',
    button: 'bg-red-600 hover:bg-red-700',
  },
  amber: {
    icon: 'text-amber-600',
    box: 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30',
    label: 'text-amber-700 dark:text-amber-400',
    code: 'text-amber-700 dark:text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
} as const;

// Stronger than the tenant-side 4-digit PIN (DeleteConfirmModal) — an 8-char
// mixed-case alphanumeric code, since Super Admin actions here affect a
// whole committee's account, not a single record.
export function SuperAdminConfirmModal({ open, title, message, confirmLabel, danger = true, onCancel, onConfirm }: SuperAdminConfirmModalProps) {
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(generateCode());
      setInput('');
      setError(false);
    }
  }, [open]);

  if (!open) return null;

  const handleConfirmClick = () => {
    if (input === code) {
      onConfirm();
    } else {
      setError(true);
    }
  };

  const t = THEME[danger ? 'red' : 'amber'];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <AlertTriangle className={t.icon} size={20} />
            {title}
          </h3>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>

          <div className={`${t.box} rounded-lg p-4 text-center`}>
            <p className={`text-xs ${t.label} font-medium mb-1`}>Type this code to confirm</p>
            <p className={`text-2xl font-bold tracking-[0.2em] ${t.code} select-none font-mono`}>{code}</p>
          </div>

          <div>
            <input
              type="text"
              maxLength={8}
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              placeholder="Enter the code above"
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full px-4 py-3 text-center text-lg tracking-[0.2em] font-mono border-2 rounded-lg outline-none transition-colors ${
                error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:border-orange-500'
              }`}
            />
            {error && <p className="text-sm text-red-600 mt-2 text-center">Code doesn't match — try again.</p>}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleConfirmClick}
            disabled={input.length !== 8}
            className={`px-6 py-2 ${t.button} text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
