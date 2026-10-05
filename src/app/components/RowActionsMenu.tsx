import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

// A 3-dot row-action menu that portals its dropdown to document.body,
// positioned via the trigger button's own getBoundingClientRect() — a
// table row's wrapper is typically overflow-hidden (for rounded corners),
// which clips an absolutely-positioned dropdown regardless of z-index,
// especially for rows near the bottom of the table. Portaling escapes
// that clip entirely (same pattern used for the sidebar's collapsed-nav
// tooltips and EventManageModal's row menu).
export function RowActionsMenu({ menu, width = 160 }: { menu: (close: () => void) => ReactNode; width?: number }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setPos(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pos]);

  const close = () => setPos(null);

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => {
          e.stopPropagation();
          if (pos) { setPos(null); return; }
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {pos && createPortal(
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, right: pos.right, width }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]"
        >
          {menu(close)}
        </div>,
        document.body
      )}
    </>
  );
}
