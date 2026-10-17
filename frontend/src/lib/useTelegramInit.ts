import { useEffect, useState, useCallback } from 'react';
import { getTelegramWebApp, type TelegramSafeAreaInset } from '../types';

export interface TelegramInitState {
  isReady: boolean;
  isMobile: boolean;
  isFullscreen: boolean;
  platform: string;
  safeArea: TelegramSafeAreaInset;
}

const BRAND_BG = '#2b302e';

/**
 * Расчет комбинированных Safe Area отступов с учетом Bot API 8.0+
 * (device safeAreaInset + contentSafeAreaInset для системных кнопок Telegram)
 */
export function getCombinedSafeArea(): TelegramSafeAreaInset {
  const tw = getTelegramWebApp();
  if (!tw) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const platform = String(tw.platform || '').toLowerCase();
  const isIos = platform === 'ios' || platform === 'macos';
  const isFullscreen = Boolean(tw.isFullscreen);

  const device = tw.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };
  const content = tw.contentSafeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };

  // contentSafeAreaInset в Bot API 8.0+ содержит отступ под системные контролы Telegram (✕, ..., стрелка)
  let top = Math.max(Number(content.top || 0), Number(device.top || 0));
  let bottom = Math.max(Number(device.bottom || 0), Number(content.bottom || 0));

  // Fallback для полноэкранного режима при первой загрузке (пока Telegram WebView асинхронно передает insets)
  if (isFullscreen && top < 70) {
    top = isIos ? 98 : 78;
  }
  if (isIos && bottom === 0 && isFullscreen) {
    bottom = 20;
  }

  return {
    top,
    bottom,
    left: device.left || 0,
    right: device.right || 0,
  };
}

/**
 * Хук инициализации нативного App-like режима Telegram Mini App:
 * 1. Вызов ready() и expand()
 * 2. Принудительный requestFullscreen() на мобилках (iOS, Android)
 * 3. Десктопная адаптация (expand + центрирование max-w-[480px])
 * 4. Блокировка вертикальных свайпов (pull-to-close), закрытия и ориентации
 * 5. Синхронизация системных цветов с брендовым фоном #2b302e
 * 6. Глобальный расчет и реактивное обновление --app-safe-top и --app-safe-bottom
 */
export function useTelegramInit(): TelegramInitState {
  const [state, setState] = useState<TelegramInitState>(() => {
    const tw = getTelegramWebApp();
    const platform = String(tw?.platform || '').toLowerCase();
    const isMobile = platform === 'ios' || platform === 'android';
    return {
      isReady: false,
      isMobile,
      isFullscreen: Boolean(tw?.isFullscreen),
      platform,
      safeArea: getCombinedSafeArea(),
    };
  });

  const syncSafeAreaCss = useCallback(() => {
    const insets = getCombinedSafeArea();
    const tw = getTelegramWebApp();
    const isFs = Boolean(tw?.isFullscreen);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      // Основные CSS-переменные по ТЗ
      root.style.setProperty('--app-safe-top', `${insets.top}px`);
      root.style.setProperty('--app-safe-bottom', `${insets.bottom}px`);
      // Обратная совместимость для существующих компонентов
      root.style.setProperty('--safe-top', `${insets.top}px`);
      root.style.setProperty('--safe-bottom', `${insets.bottom}px`);

      if (isFs) {
        root.classList.add('tg-fullscreen');
      } else {
        root.classList.remove('tg-fullscreen');
      }
    }

    setState((prev) => ({
      ...prev,
      isFullscreen: isFs,
      safeArea: insets,
    }));
  }, []);

  useEffect(() => {
    const tw = getTelegramWebApp();
    if (!tw) {
      syncSafeAreaCss();
      setState((prev) => ({ ...prev, isReady: true }));
      return;
    }

    const platform = String(tw.platform || '').toLowerCase();
    const isMobile = platform === 'ios' || platform === 'android';

    try {
      // 1. Инициализация готовности
      tw.ready?.();
      tw.expand?.();

      // 2. Полноэкранный режим на мобилках (iOS / Android)
      if (isMobile && typeof tw.requestFullscreen === 'function') {
        try {
          tw.requestFullscreen();
        } catch (e) {
          console.warn('[TMA] requestFullscreen failed:', e);
        }
      }

      // 3. Блокировка вертикального свайпа закрытия и случайного закрытия
      tw.disableVerticalSwipes?.();
      tw.enableClosingConfirmation?.();

      // 4. Блокировка ориентации (portrait)
      try {
        tw.lockOrientation?.();
      } catch (e) {
        console.warn('[TMA] lockOrientation failed:', e);
      }

      // 5. Синхронизация системных цветов с брендовой темой #2b302e
      try {
        tw.setBackgroundColor?.(BRAND_BG);
        tw.setHeaderColor?.(BRAND_BG);
        tw.setBottomBarColor?.(BRAND_BG);
      } catch (e) {
        console.warn('[TMA] set system colors failed:', e);
      }
    } catch (err) {
      console.warn('[TMA] Initialization error:', err);
    }

    // Первичная синхронизация safe areas
    syncSafeAreaCss();
    setState({
      isReady: true,
      isMobile,
      isFullscreen: Boolean(tw.isFullscreen),
      platform,
      safeArea: getCombinedSafeArea(),
    });

    // 6. Подписка на реактивные события Telegram Bot API 8.0+
    const events = [
      'safeAreaChanged',
      'contentSafeAreaChanged',
      'fullscreenChanged',
      'fullscreenFailed',
      'viewportChanged',
    ];

    events.forEach((ev) => {
      try {
        tw.onEvent?.(ev, syncSafeAreaCss);
      } catch {}
    });

    // Резервный таймер повторной синхронизации (iOS WebView часто отдает insets с задержкой 100-300ms)
    const t1 = setTimeout(syncSafeAreaCss, 150);
    const t2 = setTimeout(syncSafeAreaCss, 500);

    window.addEventListener('resize', syncSafeAreaCss);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', syncSafeAreaCss);
      events.forEach((ev) => {
        try {
          tw.offEvent?.(ev, syncSafeAreaCss);
        } catch {}
      });
    };
  }, [syncSafeAreaCss]);

  return state;
}
