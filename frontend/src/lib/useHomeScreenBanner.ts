import { useEffect, useState, useRef, useCallback } from 'react';
import { getTelegramWebApp, type HomeScreenStatus } from '../types';

export const DIRECT_LINK = 'http://t.me/OpenDeck_bot/webapp';
export const STORAGE_PERMANENT_KEY = 'opendeck_hs_added';
export const STORAGE_LEGACY_KEY = 'tma_hs_added';
export const STORAGE_SESSION_DISMISSED_KEY = 'opendeck_banner_dismissed';

/**
 * Проверка постоянного статуса установки ярлыка в CloudStorage и localStorage
 */
async function getStoredAddedFlag(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (
      localStorage.getItem(STORAGE_PERMANENT_KEY) === 'true' ||
      localStorage.getItem(STORAGE_LEGACY_KEY) === 'true'
    ) {
      return true;
    }
  } catch {}

  const tw = getTelegramWebApp();
  const cs = tw?.CloudStorage;
  if (cs && typeof cs.getItem === 'function') {
    return new Promise((resolve) => {
      try {
        cs.getItem(STORAGE_PERMANENT_KEY, (err, val) => {
          if (!err && val === 'true') {
            resolve(true);
          } else {
            // Проверка резервного/legacy ключа
            cs.getItem?.(STORAGE_LEGACY_KEY, (err2, val2) => {
              if (!err2 && val2 === 'true') {
                resolve(true);
              } else {
                resolve(false);
              }
            });
          }
        });
      } catch {
        resolve(false);
      }
    });
  }

  return false;
}

/**
 * Сохранение постоянного флага успешного добавления ярлыка (CloudStorage + localStorage)
 */
export function setStoredAddedFlag(): void {
  try {
    localStorage.setItem(STORAGE_PERMANENT_KEY, 'true');
  } catch {}

  try {
    sessionStorage.setItem(STORAGE_SESSION_DISMISSED_KEY, 'true');
  } catch {}

  const tw = getTelegramWebApp();
  try {
    tw?.CloudStorage?.setItem?.(STORAGE_PERMANENT_KEY, 'true', () => {});
  } catch {}
}

/**
 * Проверка глобального сессионного лимита показа в sessionStorage
 */
function isSessionDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(STORAGE_SESSION_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Сохранение флага скрытия баннера для текущей сессии
 */
function setSessionDismissed(): void {
  try {
    sessionStorage.setItem(STORAGE_SESSION_DISMISSED_KEY, 'true');
  } catch {}
}

/**
 * Определение запуска веб-приложения из ярлыка рабочего стола
 */
function isLaunchedFromHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;

  const tw = getTelegramWebApp();
  const startParam = String(tw?.initDataUnsafe?.start_param || '').toLowerCase();
  if (
    startParam.includes('hs') ||
    startParam.includes('homescreen') ||
    startParam.includes('shortcut') ||
    startParam.includes('webapp')
  ) {
    return true;
  }

  const query = (window.location.search + window.location.hash).toLowerCase();
  if (
    query.includes('hs=1') ||
    query.includes('startapp=hs') ||
    query.includes('source=homescreen') ||
    query.includes('mode=shortcut')
  ) {
    return true;
  }

  // PWA Standalone режим (iOS Safari / Android Chrome)
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return true;
  }

  return false;
}

export interface UseHomeScreenBannerReturn {
  isMounted: boolean;
  isVisible: boolean;
  progress: number;
  dismiss: (isManualClose?: boolean) => void;
  handleAdd: () => void;
}

/**
 * Хук управления показом баннера «Ярлык на экран»:
 * - Проверка Telegram WebApp SDK и Bot API 8.0+
 * - Постоянный статус ('opendeck_hs_added') в CloudStorage / localStorage
 * - Глобальный сессионный лимит ('opendeck_banner_dismissed') в sessionStorage
 * - Задержка показа ровно 2000 мс
 * - Автоскрытие через 8000 мс с плавным прогресс-баром
 * - Аппаратное ускорение анимаций появления и скрытия
 */
export function useHomeScreenBanner(active: boolean = true): UseHomeScreenBannerReturn {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  const addClickTimestampRef = useRef<number | null>(null);
  const delayTimerRef = useRef<any>(null);
  const autoDismissTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const isClosingRef = useRef(false);

  // Скрытие баннера с плавной анимацией и установкой сессионного флага
  const dismiss = useCallback((isManualClose: boolean = false) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (isManualClose) {
      const tw = getTelegramWebApp();
      try {
        tw?.HapticFeedback?.impactOccurred?.('light');
      } catch {}
    }

    setSessionDismissed();

    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Запуск плавной анимации скрытия (fade-out + translate-y)
    setIsVisible(false);

    // Удаление компонента из DOM после завершения 300мс CSS transition
    setTimeout(() => {
      setIsMounted(false);
    }, 320);
  }, []);

  // Клик по кнопке «Добавить»
  const handleAdd = useCallback(() => {
    const tw = getTelegramWebApp();
    try {
      tw?.HapticFeedback?.impactOccurred?.('medium');
    } catch {}

    addClickTimestampRef.current = Date.now();

    try {
      if (typeof tw?.addToHomeScreen === 'function') {
        tw.addToHomeScreen();
      } else {
        // Браузерный фоллбэк: прямой переход на Direct Link
        if (typeof window !== 'undefined') {
          window.open(DIRECT_LINK, '_blank');
        }
        dismiss(true);
      }
    } catch (e) {
      console.warn('[TMA] addToHomeScreen error:', e);
      dismiss(true);
    }
  }, [dismiss]);

  // Запуск таймера автоскрытия на 8000 мс
  const startAutoDismiss = useCallback(() => {
    const DURATION = 8000;
    const INTERVAL = 50;
    const startTime = Date.now();

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remainingPct);

      if (elapsed >= DURATION) {
        clearInterval(progressIntervalRef.current);
      }
    }, INTERVAL);

    autoDismissTimerRef.current = setTimeout(() => {
      dismiss(false);
    }, DURATION);
  }, [dismiss]);

  useEffect(() => {
    if (!active) return;

    let isCurrent = true;

    async function evaluateEligibility() {
      // 1. Проверяем глобальный сессионный лимит (закрыто пользователем ранее в сессии)
      if (isSessionDismissed()) return;

      // 2. Проверяем, запущен ли app уже из ярлыка
      if (isLaunchedFromHomeScreen()) {
        setStoredAddedFlag();
        return;
      }

      // 3. Проверяем постоянный флаг в CloudStorage / localStorage
      const alreadyAdded = await getStoredAddedFlag();
      if (!isCurrent || alreadyAdded) return;

      const proceedToShow = () => {
        // Задержка показа: ровно 2000 мс после инициализации
        delayTimerRef.current = setTimeout(() => {
          if (!isCurrent || isClosingRef.current || isSessionDismissed()) return;

          setIsMounted(true);
          setProgress(100);

          // Два requestAnimationFrame для гарантии монтирования DOM перед анимацией входа
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!isCurrent || isClosingRef.current) return;
              setIsVisible(true);
              startAutoDismiss();
            });
          });
        }, 2000);
      };

      const tw = getTelegramWebApp();
      if (!tw || typeof tw.checkHomeScreenStatus !== 'function') {
        // Обычный браузер или ранняя версия Bot API
        proceedToShow();
        return;
      }

      // 4. Официальная проверка через WebApp.checkHomeScreenStatus (Bot API 8.0+)
      tw.checkHomeScreenStatus((status: HomeScreenStatus) => {
        if (!isCurrent || isClosingRef.current || isSessionDismissed()) return;

        // Если 'added' или 'unsupported' — показ блокируется
        if (status === 'added' || status === 'unsupported') {
          return;
        }

        // Если 'missed' или 'unknown' (iOS) — показываем баннер
        proceedToShow();
      });
    }

    void evaluateEligibility();

    // 5. Подписка на событие успешной установки ярлыка в Telegram
    const tw = getTelegramWebApp();
    const handleHomeScreenAdded = () => {
      setStoredAddedFlag();
      try {
        tw?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      dismiss(true);
    };

    tw?.onEvent?.('homeScreenAdded', handleHomeScreenAdded);

    // 6. Гибридный iOS детект: переход приложения в фон в течение 5 секунд после клика «Добавить»
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'hidden' &&
        addClickTimestampRef.current &&
        Date.now() - addClickTimestampRef.current < 5000
      ) {
        setStoredAddedFlag();
        dismiss(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCurrent = false;
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      tw?.offEvent?.('homeScreenAdded', handleHomeScreenAdded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active, startAutoDismiss, dismiss]);

  return {
    isMounted,
    isVisible,
    progress,
    dismiss,
    handleAdd,
  };
}
