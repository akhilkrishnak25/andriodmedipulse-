import type { NavigateFunction } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeApp, openExternalUrl } from './platform';

export function initNativeApp(
  navigate: NavigateFunction,
  getCurrentPath: () => string
): () => void {
  if (!isNativeApp()) {
    return () => {};
  }

  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#15179f' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});

  const backHandle = CapApp.addListener('backButton', ({ canGoBack }) => {
    const currentPath = getCurrentPath();
    if (currentPath === '/' || currentPath === '') {
      CapApp.minimizeApp().catch(() => {});
      return;
    }
    if (canGoBack || window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  });

  const urlHandle = CapApp.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url);
      const route = `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
      if (route) {
        navigate(route);
      }
    } catch {
      // Ignore malformed deep-link URLs
    }
  });

  // Route external target="_blank" links through Chrome Custom Tabs instead of breaking WebView navigation
  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    if (anchor.getAttribute('target') === '_blank' && /^https?:\/\//i.test(href)) {
      if (!href.startsWith('https://localhost') && !href.startsWith('http://localhost')) {
        event.preventDefault();
        openExternalUrl(href);
      }
    }
  };
  document.addEventListener('click', handleDocumentClick);

  return () => {
    backHandle.then((h) => h.remove()).catch(() => {});
    urlHandle.then((h) => h.remove()).catch(() => {});
    document.removeEventListener('click', handleDocumentClick);
  };
}
