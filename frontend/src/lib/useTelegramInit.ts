import { useEffect, useState, useCallback } from 'react';
import { getTelegramWebApp, type TelegramWebApp, type TelegramSafeAreaInset } from '../types';

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
  const left = Math.max(Number(device.left || 0), Number(content.left || 0));
  const right = Math.max(Number(device.right || 0), Number(content.right || 0));

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
    left,
    right,
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
export function isVersionAtLeast(version: string | undefined, minVersion: string): boolean {
  if (!version) return false;
  const v1 = version.split('.').map(Number);
  const v2 = minVersion.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const n1 = v1[i] || 0;
    const n2 = v2[i] || 0;
    if (n1 > n2) return true;
    if (n1 < n2) return false;
  }
  return true;
}

/**
 * Надежное применение защиты от случайного сворачивания и закрытия.
 * Проверяет версию Telegram Bot API для предотвращения исключений WebAppMethodUnsupported.
 */
export function applyTelegramProtection(tw?: TelegramWebApp | null) {
  if (!tw) return;

  try {
    // 1. Инициализация готовности и расширение на весь экран
    try { tw.ready?.(); } catch {}
    try { tw.expand?.(); } catch {}

    const version = tw.version;

    // 2. Полноэкранный режим Bot API 8.0+
    if (isVersionAtLeast(version, '8.0') && typeof tw.requestFullscreen === 'function') {
      try {
        tw.requestFullscreen();
      } catch (e) {
        console.warn('[TMA] requestFullscreen failed:', e);
      }
    }

    // 3. Блокировка вертикальных свайпов закрытия (Bot API 7.7+)
    if (isVersionAtLeast(version, '7.7') && typeof tw.disableVerticalSwipes === 'function') {
      try {
        tw.disableVerticalSwipes();
      } catch {}
    }

    // 4. Запрос подтверждения закрытия (Bot API 6.2+)
    if (isVersionAtLeast(version, '6.2') && typeof tw.enableClosingConfirmation === 'function') {
      try {
        tw.enableClosingConfirmation();
      } catch {}
    }

    // 5. Блокировка ориентации (portrait) (Bot API 8.0+)
    if (isVersionAtLeast(version, '8.0') && typeof tw.lockOrientation === 'function') {
      try {
        tw.lockOrientation();
      } catch {}
    }

    // 6. Синхронизация системных цветов с брендовой темой #2b302e
    if (isVersionAtLeast(version, '6.1')) {
      try { tw.setBackgroundColor?.(BRAND_BG); } catch {}
      try { tw.setHeaderColor?.(BRAND_BG); } catch {}
    }
    if (isVersionAtLeast(version, '7.10')) {
      try { tw.setBottomBarColor?.(BRAND_BG); } catch {}
    }
  } catch (err) {
    console.warn('[TMA] applyTelegramProtection error:', err);
  }
}

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
      root.style.setProperty('--app-safe-left', `${insets.left}px`);
      root.style.setProperty('--app-safe-right', `${insets.right}px`);
      // Обратная совместимость для существующих компонентов
      root.style.setProperty('--safe-top', `${insets.top}px`);
      root.style.setProperty('--safe-bottom', `${insets.bottom}px`);
      root.style.setProperty('--safe-left', `${insets.left}px`);
      root.style.setProperty('--safe-right', `${insets.right}px`);

      if (isFs) {
        root.classList.add('tg-fullscreen');
      } else {
        root.classList.remove('tg-fullscreen');
      }
    }

    setState((prev) => {
      if (
        prev.isFullscreen === isFs &&
        prev.safeArea.top === insets.top &&
        prev.safeArea.bottom === insets.bottom &&
        prev.safeArea.left === insets.left &&
        prev.safeArea.right === insets.right
      ) {
        return prev;
      }
      return {
        ...prev,
        isFullscreen: isFs,
        safeArea: insets,
      };
    });
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

    // 1. Применяем защиту строго ОДИН РАЗ при первом монтировании
    applyTelegramProtection(tw);

    // Первичная синхронизация safe areas
    syncSafeAreaCss();
    setState({
      isReady: true,
      isMobile,
      isFullscreen: Boolean(tw.isFullscreen),
      platform,
      safeArea: getCombinedSafeArea(),
    });

    // Обработчик реактивных событий экрана: ТОЛЬКО синхронизация геометрии,
    // без повторного вызова applyTelegramProtection во избежание бесконечного цикла
    const handleTelegramEvent = () => {
      syncSafeAreaCss();
    };

    // 2. Подписка на реактивные события Telegram Bot API 8.0+
    const events = [
      'safeAreaChanged',
      'contentSafeAreaChanged',
      'fullscreenChanged',
      'viewportChanged',
    ];

    events.forEach((ev) => {
      try {
        tw.onEvent?.(ev, handleTelegramEvent);
      } catch {}
    });

    const t1 = setTimeout(handleTelegramEvent, 150);
    const t2 = setTimeout(handleTelegramEvent, 500);
    window.addEventListener('resize', handleTelegramEvent);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleTelegramEvent);
      events.forEach((ev) => {
        try {
          tw.offEvent?.(ev, handleTelegramEvent);
        } catch {}
      });
    };
  }, [syncSafeAreaCss]);

  return state;
}
