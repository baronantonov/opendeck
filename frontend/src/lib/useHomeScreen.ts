import { useEffect, useState, useRef, useCallback } from 'react';
import { getTelegramWebApp, type HomeScreenStatus } from '../types';
import { haptic } from './theme';

const STORAGE_KEY = 'tma_hs_added';

/**
 * Чтение флага добавления ярлыка из CloudStorage с фоллбэком на localStorage
 */
async function getStoredAddedFlag(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const tw = getTelegramWebApp();
  const cs = tw?.CloudStorage;
  if (cs && typeof cs.getItem === 'function') {
    return new Promise((resolve) => {
      try {
        cs.getItem(STORAGE_KEY, (err, val) => {
          if (!err && val === 'true') {
            resolve(true);
          } else {
            resolve(localStorage.getItem(STORAGE_KEY) === 'true');
          }
        });
      } catch {
        resolve(localStorage.getItem(STORAGE_KEY) === 'true');
      }
    });
  }

  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Сохранение флага успешного добавления ярлыка в CloudStorage и localStorage
 */
export function setStoredAddedFlag(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {}

  const tw = getTelegramWebApp();
  try {
    tw?.CloudStorage?.setItem?.(STORAGE_KEY, 'true', () => {});
  } catch {}
}

/**
 * Проверка запуска веб-приложения из ярлыка на рабочем столе
 */
function isLaunchedFromHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;

  const tw = getTelegramWebApp();
  const startParam = String(tw?.initDataUnsafe?.start_param || '').toLowerCase();
  if (
    startParam.includes('hs') ||
    startParam.includes('homescreen') ||
    startParam.includes('shortcut')
  ) {
    return true;
  }

  const query = window.location.search.toLowerCase() + window.location.hash.toLowerCase();
  if (
    query.includes('hs=1') ||
    query.includes('startapp=hs') ||
    query.includes('source=homescreen')
  ) {
    return true;
  }

  // Флаг Standalone PWA для iOS / Chrome
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return true;
  }

  return false;
}

export function useHomeScreen(splashFinished: boolean) {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const addClickTimestampRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const isDismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    isDismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, []);

  const handleAdd = useCallback(() => {
    haptic('medium');
    addClickTimestampRef.current = Date.now();
    const tw = getTelegramWebApp();

    try {
      if (typeof tw?.addToHomeScreen === 'function') {
        tw.addToHomeScreen();
      } else {
        dismiss();
      }
    } catch (e) {
      console.warn('[TMA] addToHomeScreen failed:', e);
      dismiss();
    }
  }, [dismiss]);

  // Запуск таймера автоскрытия на 8000 мс с обновлением прогресс-бара
  const startAutoDismiss = useCallback(() => {
    const DURATION = 8000;
    const INTERVAL = 50;
    const startTime = Date.now();

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remainingPct);

      if (elapsed >= DURATION) {
        clearInterval(progressIntervalRef.current);
        dismiss();
      }
    }, INTERVAL);
  }, [dismiss]);

  useEffect(() => {
    if (!splashFinished) return;

    let active = true;

    async function evaluateHomeScreenEligibility() {
      // 1. Проверяем, запущен ли app уже с ярлыка
      if (isLaunchedFromHomeScreen()) {
        setStoredAddedFlag();
        return;
      }

      // 2. Проверяем сохраненный флаг в CloudStorage / localStorage
      const alreadyAdded = await getStoredAddedFlag();
      if (!active || alreadyAdded) return;

      const tw = getTelegramWebApp();

      const proceedToShow = () => {
        // Показ ровно через 2000 мс после завершения экрана загрузки
        timerRef.current = setTimeout(() => {
          if (!active || isDismissedRef.current) return;
          setIsVisible(true);
          startAutoDismiss();
        }, 2000);
      };

      if (!tw || typeof tw.checkHomeScreenStatus !== 'function') {
        // Вне Telegram или старая версия API — показываем при первом входе
        proceedToShow();
        return;
      }

      // 3. Вызываем официальный WebApp.checkHomeScreenStatus (Bot API 8.0+)
      tw.checkHomeScreenStatus((status: HomeScreenStatus) => {
        if (!active || isDismissedRef.current) return;

        if (status === 'added' || status === 'unsupported') {
          // При 'added' или 'unsupported' — не показывать
          return;
        }

        if (status === 'missed') {
          // При 'missed' — показывать
          proceedToShow();
          return;
        }

        if (status === 'unknown') {
          // При 'unknown' (iOS Fix): если нет маркера в storage — показываем
          proceedToShow();
        }
      });
    }

    void evaluateHomeScreenEligibility();

    // 4. Слушаем официальное событие Bot API 8.0: homeScreenAdded
    const tw = getTelegramWebApp();
    const handleHomeScreenAdded = () => {
      setStoredAddedFlag();
      dismiss();
      haptic('success');
    };

    tw?.onEvent?.('homeScreenAdded', handleHomeScreenAdded);

    // 5. iOS Fix: Фиксация установки при переходе приложения в фоновый режим
    // (visibilitychange -> hidden) в течение 5 секунд после клика по «Добавить»
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'hidden' &&
        addClickTimestampRef.current &&
        Date.now() - addClickTimestampRef.current < 5000
      ) {
        setStoredAddedFlag();
        dismiss();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      tw?.offEvent?.('homeScreenAdded', handleHomeScreenAdded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [splashFinished, startAutoDismiss, dismiss]);

  return {
    isVisible,
    progress,
    dismiss,
    handleAdd,
  };
}
