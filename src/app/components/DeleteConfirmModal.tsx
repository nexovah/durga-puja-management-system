import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface DeleteConfirmModalProps {
  open: boolean;
  itemLabel?: string; // e.g. the donor's name — shown so the user knows what they're deleting
  onCancel: () => void;
  onConfirm: () => void;
}

const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

// A fresh random 4-digit PIN is shown each time this opens; the user must
// type it back exactly to enable the delete button. Not a secret — it's
// friction against an accidental click, same idea as "type DELETE to
// confirm", just numeric per the request.
export function DeleteConfirmModal({ open, itemLabel, onCancel, onConfirm }: DeleteConfirmModalProps) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setPin(generatePin());
      setInput('');
      setError(false);
    }
  }, [open]);

  if (!open) return null;

  const handleConfirmClick = () => {
    if (input.trim() === pin) {
      onConfirm();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={20} />
            {t('delete.confirmTitle')}
          </h3>
          <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {itemLabel ? t('delete.confirmMessageWithItem').replace('{item}', itemLabel) : t('delete.confirmMessage')}
          </p>

          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-xs text-red-700 font-medium mb-1">{t('delete.typeThisPin')}</p>
            <p className="text-3xl font-bold tracking-[0.3em] text-red-700 select-none">{pin}</p>
          </div>

          <div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={input}
              onChange={(e) => { setInput(e.target.value.replace(/\D/g, '')); setError(false); }}
              placeholder={t('delete.enterPin')}
              autoFocus
              className={`w-full px-4 py-3 text-center text-xl tracking-[0.3em] border-2 rounded-lg outline-none transition-colors ${
                error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:border-orange-500'
              }`}
            />
            {error && (
              <p className="text-sm text-red-600 mt-2 text-center">{t('delete.pinMismatch')}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleConfirmClick}
            disabled={input.length !== 4}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {t('common.delete')}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
