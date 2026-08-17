import { useEffect } from 'react';
import {
  bindThemeParamsCssVars,
  bindViewportCssVars,
  expandViewport,
} from '@telegram-apps/sdk-react';

const themeMap: Record<string, string | undefined> = {
  bgColor: '--tg-bg',
  secondaryBgColor: '--tg-surface',
  textColor: '--tg-text',
  hintColor: '--tg-hint',
  buttonColor: '--tg-accent',
  buttonTextColor: '--tg-accent-text',
};

const viewportMap: Record<string, string | undefined> = {
  height: '--tg-viewport-height',
  stableHeight: '--tg-viewport-stable-height',
};

// v3 SDK: bind Telegram theme + viewport to CSS custom properties. They update
// reactively. The mapper returns a custom var name per key (or falsy to skip).
export function useTelegramTheme() {
  useEffect(() => {
    try {
      bindThemeParamsCssVars((key) => themeMap[key] ?? '');
    } catch {
      /* not in Telegram */
    }
    try {
      bindViewportCssVars((key) => viewportMap[key] ?? null);
    } catch {
      /* ignore */
    }
    try {
      expandViewport();
    } catch {
      /* ignore */
    }
  }, []);
}

// Haptic helper — safe no-op outside Telegram.
export function haptic(
  kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light',
) {
  try {
    const tw = (window as any).Telegram?.WebApp;
    if (!tw) return;
    if (kind === 'success' || kind === 'warning' || kind === 'error') {
      tw.HapticFeedback?.notificationOccurred?.(kind);
    } else {
      tw.HapticFeedback?.impactOccurred?.(kind);
    }
  } catch {
    /* ignore */
  }
}
