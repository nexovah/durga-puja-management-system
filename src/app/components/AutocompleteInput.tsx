import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rankSearchMatches } from '../lib/searchRank';

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
//
// The suggestion list is portaled to document.body (same pattern as
// CustomSelect/RowActionsMenu) rather than absolutely positioned inside
// this component's own wrapper — a plain absolute dropdown gets clipped
// by any scrollable ancestor (e.g. a FormModal's own overflow-y-auto
// body), which was hiding the suggestions entirely inside modals.
export function AutocompleteInput({ value, onChange, suggestions, placeholder, className = '', id, autoComplete = 'off' }: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target)) return;
      if (inputRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? rankSearchMatches(suggestions.filter(s => s.toLowerCase() !== query), value, s => s, undefined, suggestions.length)
    : suggestions;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        id={id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none ${className}`}
      />
      {open && pos && filtered.length > 0 && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[200] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto"
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
