import { ReactNode } from 'react';

interface PageHeadingProps {
  children: ReactNode;
  action?: ReactNode;
  total?: ReactNode;
}

export function PageHeading({ children, action, total }: PageHeadingProps) {
  return (
    <div className="bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 rounded-xl shadow-md p-4 sm:p-6 mb-6 border-l-4 border-orange-600">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="text-lg sm:text-2xl font-bold text-orange-800">{children}</h2>
          {total && (
            <span className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-amber-200/70 border border-dashed border-orange-500 text-orange-800 font-bold text-sm sm:text-base whitespace-nowrap">
              {total}
            </span>
          )}
        </div>
        {action && <div className="w-full sm:w-auto">{action}</div>}
      </div>
    </div>
  );
}
