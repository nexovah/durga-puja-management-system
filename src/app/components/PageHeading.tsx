import { ReactNode } from 'react';

interface PageHeadingProps {
  children: ReactNode;
  action?: ReactNode;
}

export function PageHeading({ children, action }: PageHeadingProps) {
  return (
    <div className="bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 rounded-xl shadow-md p-6 mb-6 border-l-4 border-orange-600">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-orange-800">{children}</h2>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
