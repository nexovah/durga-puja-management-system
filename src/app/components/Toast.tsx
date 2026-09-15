import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onDone: () => void;
}

// Small auto-dismissing success banner shown after an Add/Edit modal saves.
// Fixed to the bottom on mobile (clear of the header), top-center on desktop.
export function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-auto sm:top-4 left-1/2 -translate-x-1/2 z-[60] px-4 w-full sm:w-auto flex justify-center">
      <div className="flex items-center gap-2.5 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg font-medium text-sm max-w-md">
        <CheckCircle2 size={20} className="shrink-0" />
        {message}
      </div>
    </div>
  );
}
