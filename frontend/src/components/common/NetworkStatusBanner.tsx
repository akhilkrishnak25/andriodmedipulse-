import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Network } from '@capacitor/network';
import { isNativeApp } from '../../utils/platform';

export const NetworkStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let cleanupNative: (() => void) | undefined;

    if (isNativeApp()) {
      Network.getStatus()
        .then((status) => setIsOnline(status.connected))
        .catch(() => {});

      const listenerPromise = Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
      });

      cleanupNative = () => {
        listenerPromise.then((handle) => handle.remove()).catch(() => {});
      };
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupNative?.();
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] bg-rose-600 text-white text-xs font-bold py-2 px-4 shadow-md flex items-center justify-center gap-2 safe-area-top"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are offline. Reconnect to book appointments or sync live OPD queues.</span>
    </div>
  );
};
