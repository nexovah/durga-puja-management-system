import { useEffect, useState } from 'react';

// Pure connectivity signal from the browser (navigator.onLine +
// online/offline events) — no data caching, no write queue, just whether
// the device currently has a network link. Good enough to drive a status
// pill; a false "online" (link up, Supabase unreachable) isn't caught
// here, same tradeoff navigator.onLine always has.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
