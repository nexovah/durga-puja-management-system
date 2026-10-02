import { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// Offline: a steady yellow-dot pill, stays up the whole time there's no
// connection. Back online: briefly flips to a green pill, then fades out
// on its own — nothing shown at all once back to normal.
export function ConnectivityPill() {
  const isOnline = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowBackOnline(false);
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
        Offline
      </span>
    );
  }

  if (showBackOnline) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30 shrink-0 transition-opacity duration-500">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Online
      </span>
    );
  }

  return null;
}
