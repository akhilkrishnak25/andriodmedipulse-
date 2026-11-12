import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const DEFAULT_PRODUCTION_BACKEND = 'https://medipulse-backend-veca.onrender.com';
export const DEFAULT_PUBLIC_WEB_URL = 'https://rocketwheelmedpuls.onrender.com';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getNativePlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (window.navigator as any)?.standalone === true
  );
}

export function getPublicWebUrl(): string {
  if (isNativeApp() || typeof window === 'undefined') {
    return DEFAULT_PUBLIC_WEB_URL;
  }
  return window.location.origin;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isNativeApp()) {
    try {
      await Browser.open({ url });
      return;
    } catch {
      // Fallback to standard window open
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
