import { useEffect, useRef, useState } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  id?: string;
  autoComplete?: string;
}

// Free-text input with a styled, filter-as-you-type suggestion list —
// replaces the native <input list="..."><datalist> pattern, whose
// browser-native popup doesn't match the app's dropdown styling (unlike
// CustomSelect's closed-list dropdown, this still lets the user type a
// brand new value that isn't in `suggestions`).
export function AutocompleteInput({ value, onChange, suggestions, placeholder, className = '', id, autoComplete = 'off' }: AutocompleteInputProps) {
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

  const query = value.trim().toLowerCase();
  const filtered = query
    ? suggestions.filter(s => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
    : suggestions;

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        id={id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none ${className}`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1.5 w-full z-30 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full flex items-center text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
