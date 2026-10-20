import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getTelegramWebApp } from '../types';

export const AVATAR_CACHE_KEY = 'opendeck_user_avatar_cache';

export interface UserAvatarState {
  /** Текущий отображаемый URL изображения */
  currentUrl: string | null;
  /** Входящий валидированный URL изображения для плавного растворения */
  incomingUrl: string | null;
  /** Флаг активного cross-fade перехода */
  isCrossFading: boolean;
  /** Брендовая монограмма (первая буква имени или 'D') */
  monogram: string;
  /** Флаг наличия валидного аватара */
  hasAvatar: boolean;
  /** Завершение cross-fade анимации и синхронизация текущего URL */
  completeCrossFade: () => void;
}

/**
 * Безопасное синхронное чтение закэшированного URL юзерпика из localStorage
 */
function readCachedAvatar(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AVATAR_CACHE_KEY);
    if (!cached) return null;
    const trimmed = cached.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Безопасная запись/удаление URL аватара в localStorage
 */
function writeCachedAvatar(url: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (url && url.trim().length > 0) {
      localStorage.setItem(AVATAR_CACHE_KEY, url.trim());
    } else {
      localStorage.removeItem(AVATAR_CACHE_KEY);
    }
  } catch {
    /* Игнорируем ошибки квот и приватного режима */
  }
}

/**
 * Извлечение стабильных скалярных примитивов пользователя Telegram WebApp
 */
function getTelegramUserScalars(): {
  userId: number | null;
  photoUrl: string | null;
  firstName: string;
} {
  if (typeof window === 'undefined') {
    return { userId: null, photoUrl: null, firstName: '' };
  }
  try {
    const tw = getTelegramWebApp();
    const u = tw?.initDataUnsafe?.user;
    const userId = typeof u?.id === 'number' ? u.id : null;
    const photoUrl =
      typeof u?.photo_url === 'string' && u.photo_url.trim().length > 0
        ? u.photo_url.trim()
        : null;
    const firstName = typeof u?.first_name === 'string' ? u.first_name.trim() : '';
    return { userId, photoUrl, firstName };
  } catch {
    return { userId: null, photoUrl: null, firstName: '' };
  }
}

/**
 * Хук отказоустойчивого аватара пользователя по паттерну Stale-While-Revalidate (SWR).
 *
 * 1. Zero Delay: мгновенно отдает кэш из localStorage без блокировки UI.
 * 2. Background Revalidation: в изолированном эффекте предзагружает актуальный photo_url.
 * 3. Cross-Fade: при изменении фото плавно переключает слои через CSS opacity.
 * 4. Fallback на монограмму: при удалении аватара очищает кэш и переключается на инициал.
 * 5. Anti-Loop: подписывается исключительно на скалярные примитивы (userId, rawPhotoUrl).
 */
export function useUserAvatar(): UserAvatarState {
  // 1. Синхронная инициализация из кэша (0мс задержки)
  const initialCache = useRef<string | null>(readCachedAvatar());
  const [currentUrl, setCurrentUrl] = useState<string | null>(() => initialCache.current);
  const [incomingUrl, setIncomingUrl] = useState<string | null>(null);
  const [isCrossFading, setIsCrossFading] = useState<boolean>(false);

  // Извлечение скалярных примитивов
  const { userId, photoUrl: rawPhotoUrl, firstName } = getTelegramUserScalars();

  // Вычисление монограммы (первая буква имени пользователя)
  const monogram = useMemo(() => {
    if (!firstName) return 'D';
    const firstChar = firstName.charAt(0);
    return firstChar ? firstChar.toUpperCase() : 'D';
  }, [firstName]);

  // Завершение перехода cross-fade
  const completeCrossFade = useCallback(() => {
    if (incomingUrl) {
      setCurrentUrl(incomingUrl);
      setIncomingUrl(null);
      setIsCrossFading(false);
    }
  }, [incomingUrl]);

  // Страховочный таймер для cross-fade на случай отсутствия transitionEnd
  useEffect(() => {
    if (!isCrossFading) return;
    const timer = window.setTimeout(() => {
      completeCrossFade();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isCrossFading, completeCrossFade]);

  // 2. Фоновая валидация (Stale-While-Revalidate)
  useEffect(() => {
    // Случай удаления аватара в Telegram
    if (!rawPhotoUrl) {
      writeCachedAvatar(null);
      setCurrentUrl(null);
      setIncomingUrl(null);
      setIsCrossFading(false);
      return;
    }

    // Если URL не изменился по сравнению с текущим отображаемым
    if (rawPhotoUrl === currentUrl && !isCrossFading) {
      writeCachedAvatar(rawPhotoUrl);
      return;
    }

    let isMounted = true;
    const preloader = new Image();
    preloader.referrerPolicy = 'no-referrer';

    preloader.onload = () => {
      if (!isMounted) return;

      // Записываем обновленный URL в localStorage
      writeCachedAvatar(rawPhotoUrl);

      // Если до этого изображения не было, монтируем сразу без cross-fade ожидания
      if (!currentUrl) {
        setCurrentUrl(rawPhotoUrl);
        setIncomingUrl(null);
        setIsCrossFading(false);
        return;
      }

      // Если URL действительно отличается от текущего, запускаем плавный cross-fade
      if (currentUrl !== rawPhotoUrl) {
        setIncomingUrl(rawPhotoUrl);
        setIsCrossFading(true);
      }
    };

    preloader.onerror = () => {
      if (!isMounted) return;
      // При ошибке Telegram CDN сохраняем отображение текущего кэша без падения приложения
      console.warn('[useUserAvatar] Telegram CDN photo preload failed, keeping cached avatar');
    };

    preloader.src = rawPhotoUrl;

    return () => {
      isMounted = false;
    };
  }, [userId, rawPhotoUrl, currentUrl, isCrossFading]);

  return useMemo(
    () => ({
      currentUrl,
      incomingUrl,
      isCrossFading,
      monogram,
      hasAvatar: Boolean(currentUrl || incomingUrl),
      completeCrossFade,
    }),
    [currentUrl, incomingUrl, isCrossFading, monogram, completeCrossFade],
  );
}
