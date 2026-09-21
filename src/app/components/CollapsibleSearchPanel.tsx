import { ReactNode } from 'react';

interface CollapsibleSearchPanelProps {
  open: boolean;
  children: ReactNode;
}

// Animates the TableSearchBar open/closed via a CSS grid-rows 0fr->1fr
// transition (smooth height animation without a fixed max-height guess).
export function CollapsibleSearchPanel({ open, children }: CollapsibleSearchPanelProps) {
  return (
    <div
      className={`grid transition-all duration-300 ease-in-out ${
        open ? 'grid-rows-[1fr] opacity-100 mb-6' : 'grid-rows-[0fr] opacity-0 mb-0'
      }`}
    >
      <div className="overflow-hidden min-h-0">
        {children}
      </div>
    </div>
  );
}
