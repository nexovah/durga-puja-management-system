import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode; // the <form> itself — id="modal-form" so the sticky footer's submit button can target it
  footer: ReactNode; // action buttons (Save/Update + Cancel)
}

// Every footer's Cancel button, used across Members/Chanda/Donation-Ads/
// Expenses/Loans/Tasks/Settings — icon-only on mobile (just an X, no
// "Cancel" label) so the primary/secondary action buttons next to it get
// enough room to stay on one line instead of the whole footer stacking
// into 3 separate rows, which was eating too much of the modal's height
// on a phone. Full "Cancel" label returns at sm: and up.
export function FormModalCancelButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="shrink-0 flex items-center justify-center gap-2 px-3 sm:px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
    >
      <X size={18} className="sm:hidden" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// Shared Add/Edit modal used by every page's form (Members, Chanda,
// Donation/Ads, Expenses, Loans, Tasks): a centered dialog on desktop,
// full-screen on mobile with the action buttons pinned to the bottom so
// they stay reachable while the form scrolls.
export function FormModal({ open, title, onClose, children, footer }: FormModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {children}
        </div>

        {/* Always one row, even on mobile — Add/Save&AddNew share the
            remaining space equally (each has flex-1 in its own file) and
            Cancel is icon-only below sm: (FormModalCancelButton above),
            so the footer stays compact and the form above gets more of
            the screen instead of three stacked full-width buttons. */}
        <div className="flex flex-row items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-900 sticky bottom-0">
          {footer}
        </div>
      </div>
    </div>
  );
}
