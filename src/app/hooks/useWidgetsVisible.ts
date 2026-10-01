import { useState } from 'react';

const STORAGE_PREFIX = 'puja-widgets-visible-';

// Per-page "show/hide widgets" toggle, persisted to localStorage so it
// survives a reload (cleared only if the browser's site data/cache is
// cleared). Used by the page-level 3-dot menu's "Hide widgets"/"View
// widgets" item on Collection/Donation/Sponsorship/Expenses/Members/
// Loan/Asset/Award.
export function useWidgetsVisible(pageKey: string) {
  const storageKey = STORAGE_PREFIX + pageKey;
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== '0';
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setVisible(v => {
      const next = !v;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // ignore (private browsing / storage blocked) — toggle still works for this session
      }
      return next;
    });
  };

  return [visible, toggle] as const;
}
