import { ReactNode, useEffect, useRef } from 'react';

interface CollapsibleSearchPanelProps {
  open: boolean;
  children: ReactNode;
}

// Animates the TableSearchBar open/closed via a CSS grid-rows 0fr->1fr
// transition (smooth height animation without a fixed max-height guess).
export function CollapsibleSearchPanel({ open, children }: CollapsibleSearchPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the search query input the moment the panel opens, so a user who
  // just clicked the search toggle can start typing immediately without an
  // extra click into the box — standard across every data-table search bar
  // since they all render TableSearchBar's query <input> as the first
  // type="text" field inside this panel.
  useEffect(() => {
    if (!open) return;
    containerRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
  }, [open]);

  return (
    <div
      className={`grid transition-all duration-300 ease-in-out ${
        open ? 'grid-rows-[1fr] opacity-100 mb-6' : 'grid-rows-[0fr] opacity-0 mb-0'
      }`}
    >
      <div ref={containerRef} className="overflow-hidden min-h-0 p-0.5 -m-0.5">
        {children}
      </div>
    </div>
  );
}
