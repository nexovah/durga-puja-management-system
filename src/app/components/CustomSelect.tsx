import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

// App-styled replacement for native <select> — the browser's own dropdown
// list (used everywhere a plain <select> was wired up) doesn't follow this
// app's theme and, inside a form, opens directly on top of the field it
// belongs to and the ones below it, obscuring them. This renders the same
// trigger look as a text input, with a dropdown list that matches the rest
// of the app's dropdown styling (white/gray-900 card, orange-50 hover,
// checkmark on the selected row) and opens below the field without
// covering it.
export function CustomSelect({ value, onChange, options, placeholder, disabled, className = '', id }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none flex items-center justify-between gap-2 text-left disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate text-sm ${selected ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
          {selected ? selected.label : (placeholder || '')}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full z-30 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 text-left px-4 py-2 text-sm transition-colors ${
                o.value === value
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={15} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
