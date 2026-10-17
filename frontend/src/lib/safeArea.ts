import { useEffect, useState } from 'react';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
  isFullscreen: boolean;
}

/**
 * Получить объект Telegram WebApp из глобальной области видимости.
 */
export function getTelegramWebApp(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp || null;
}

/**
 * Расчет безопасных отступов (Safe Area Insets) с учетом Fullscreen Mode (Bot API 8.0+).
 * В полноэкранном режиме Telegram выводит системные элементы (кнопка закрытия «✕», стрелка свернуть, меню)
 * поверх веб-приложения.
 */
export function calculateSafeAreaInsets(): SafeAreaInsets {
  const tw = getTelegramWebApp();
  if (!tw) {
    return { top: 0, bottom: 0, left: 0, right: 0, isFullscreen: false };
  }

  const platform = String(tw.platform || '').toLowerCase();
  const isIos = platform === 'ios' || platform === 'macos';

  // Проверка полноэкранного режима Telegram (флаги API + эвристика)
  const isFullscreen = Boolean(
    tw.isFullscreen ||
      (tw.isExpanded && typeof window !== 'undefined' && window.innerHeight >= window.screen.height - 40) ||
      (typeof window !== 'undefined' &&
        (window.location.search.includes('fullscreen') || window.location.hash.includes('fullscreen'))),
  );

  const device = tw.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };
  const content = tw.contentSafeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };

  // contentSafeAreaInset в Telegram 8.0+ содержит высоту под системные кнопки Telegram
  let top = Math.max(Number(content.top || 0), Number(device.top || 0));
  let bottom = Math.max(Number(device.bottom || 0), Number(content.bottom || 0));
  const left = Math.max(Number(device.left || 0), Number(content.left || 0));
  const right = Math.max(Number(device.right || 0), Number(content.right || 0));

  // Если включен Fullscreen, но Telegram API еще не передал точные значения (асинхронный баг WebView),
  // выставляем проверенный fallback под плашку контролов Telegram:
  // - Android: ~76-80px (status bar 24-28px + Telegram header 48-52px)
  // - iOS: ~96-104px (Notch/Dynamic Island 44-54px + Telegram header 48-50px)
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
    isFullscreen,
  };
}

/**
 * Реактивный хук Safe Area для Telegram Mini App:
 * 1. Вычисляет актуальный отступ и записывает его в CSS-переменные --safe-* и --app-safe-* на :root.
 * 2. Подписывается на события Telegram: safeAreaChanged, contentSafeAreaChanged, fullscreenChanged, viewportChanged.
 * 3. Выполняет быстрый начальный поллинг, чтобы избежать задержек при открытии приложения.
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => calculateSafeAreaInsets());

  useEffect(() => {
    const tw = getTelegramWebApp();

    const applyInsets = () => {
      const next = calculateSafeAreaInsets();
      setInsets(next);

      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.style.setProperty('--safe-top', `${next.top}px`);
        root.style.setProperty('--safe-bottom', `${next.bottom}px`);
        root.style.setProperty('--safe-left', `${next.left}px`);
        root.style.setProperty('--safe-right', `${next.right}px`);
        root.style.setProperty('--app-safe-top', `${next.top}px`);
        root.style.setProperty('--app-safe-bottom', `${next.bottom}px`);
        root.style.setProperty('--app-safe-left', `${next.left}px`);
        root.style.setProperty('--app-safe-right', `${next.right}px`);
        if (next.isFullscreen) {
          root.classList.add('tg-fullscreen');
        } else {
          root.classList.remove('tg-fullscreen');
        }
      }
    };

    // Применяем сразу
    applyInsets();

    if (!tw) return;

    // Слушаем официальные события Telegram WebApp API
    tw.onEvent?.('safeAreaChanged', applyInsets);
    tw.onEvent?.('contentSafeAreaChanged', applyInsets);
    tw.onEvent?.('fullscreenChanged', applyInsets);
    tw.onEvent?.('viewportChanged', applyInsets);

    // Первые 3 секунды держим таймер для гладкой адаптации после анимации открытия
    const interval = setInterval(applyInsets, 350);
    const timeout = setTimeout(() => clearInterval(interval), 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      tw.offEvent?.('safeAreaChanged', applyInsets);
      tw.offEvent?.('contentSafeAreaChanged', applyInsets);
      tw.offEvent?.('fullscreenChanged', applyInsets);
      tw.offEvent?.('viewportChanged', applyInsets);
    };
  }, []);

  return insets;
}
