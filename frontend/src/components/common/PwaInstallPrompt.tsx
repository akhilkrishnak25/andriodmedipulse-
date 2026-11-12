import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { isNativeApp, isStandalonePwa } from '../../utils/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'rocketwheel_pwa_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isNativeApp() || isStandalonePwa()) return;

    const lastDismissed = Number(localStorage.getItem(DISMISS_STORAGE_KEY) || 0);
    if (lastDismissed && Date.now() - lastDismissed < DISMISS_COOLDOWN_MS) {
      return;
    }

    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);

    if (isIos && isSafari) {
      setShowIosGuide(true);
      setDismissed(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDismissed(true);
      }
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  if (dismissed || (!deferredPrompt && !showIosGuide) || isNativeApp() || isStandalonePwa()) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-5 left-3 right-3 md:left-auto md:right-5 md:max-w-sm z-40 animate-in slide-in-from-bottom duration-300 print:hidden">
      <div className="bg-[#15179f] text-white rounded-2xl p-3.5 shadow-2xl border border-royal-400/40 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-6 h-6 text-[#FBA94C]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-extrabold tracking-tight text-white">
            Get Rocket Wheel App
          </div>
          {showIosGuide ? (
            <p className="text-[11px] text-blue-100 leading-snug mt-0.5 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3 h-3 inline text-[#FBA94C]" /> then{' '}
              <strong className="text-white">Add to Home Screen</strong>
            </p>
          ) : (
            <p className="text-[11px] text-blue-100 leading-snug mt-0.5">
              Fast access to OPD booking, live tokens &amp; Digital OP slips
            </p>
          )}
        </div>

        {!showIosGuide && deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="px-3 py-2 rounded-xl bg-[#FF1D6B] hover:bg-[#e1145a] text-white text-xs font-extrabold shrink-0 flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            {installing ? 'Installing...' : 'Install'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
