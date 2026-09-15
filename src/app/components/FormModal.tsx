import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode; // the <form> itself — id="modal-form" so the sticky footer's submit button can target it
  footer: ReactNode; // action buttons (Save/Update + Cancel)
}

// Shared Add/Edit modal used by every page's form (Members, Chanda,
// Donation/Ads, Expenses, Loans, Tasks): a centered dialog on desktop,
// full-screen on mobile with the action buttons pinned to the bottom so
// they stay reachable while the form scrolls.
export function FormModal({ open, title, onClose, children, footer }: FormModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {children}
        </div>

        <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 shrink-0 bg-white sticky bottom-0">
          {footer}
        </div>
      </div>
    </div>
  );
}
