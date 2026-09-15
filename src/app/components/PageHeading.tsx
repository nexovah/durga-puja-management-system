import { ReactNode } from 'react';

interface PageHeadingProps {
  children: ReactNode;
  action?: ReactNode;
}

export function PageHeading({ children, action }: PageHeadingProps) {
  return (
    <div className="bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 rounded-xl shadow-md p-4 sm:p-6 mb-6 border-l-4 border-orange-600">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-2xl font-bold text-orange-800">{children}</h2>
        {action && <div className="w-full sm:w-auto">{action}</div>}
      </div>
    </div>
  );
}
