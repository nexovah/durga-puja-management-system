import { ReactNode } from 'react';
import { FormModal } from './FormModal';
import { useLanguage } from '../i18n/LanguageContext';

export interface ViewField {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
  valueClassName?: string; // overrides the default text color/weight, e.g. to match the table row's status color
}

interface ViewModalProps {
  open: boolean;
  title: string;
  fields: ViewField[];
  onClose: () => void;
  onEdit?: () => void;
}

// Read-only counterpart to FormModal — clicking a row's name/title opens this
// instead of the editable form. Same dialog chrome, plain text fields, an
// optional Edit button in the footer to jump into the real edit modal.
export function ViewModal({ open, title, fields, onClose, onEdit }: ViewModalProps) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <FormModal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
            >
              {t('common.edit')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            {t('common.close')}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f, i) => (
          <div key={i} className={f.fullWidth ? 'sm:col-span-2' : ''}>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{f.label}</div>
            <div className={`text-sm whitespace-pre-wrap break-words ${f.valueClassName || 'text-gray-800'}`}>{f.value ?? '—'}</div>
          </div>
        ))}
      </div>
    </FormModal>
  );
}
