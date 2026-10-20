/**
 * avatarPreload.ts — Высокоприоритетная предзагрузка и GPU-декодирование юзерпика Telegram.
 *
 * Обеспечивает мгновенный рендер аватара на Главном экране и в Профиле без "мелькания" инициалов
 * и задержек сети, подгружая изображение параллельно с анимацией экрана загрузки (VinylLoader).
 */

const preloadedUrls = new Set<string>();
const inFlightPromises = new Map<string, Promise<boolean>>();

/**
 * Извлекает лучший доступный URL юзерпика синхронно из глобального контекста,
 * нативного Telegram WebApp моста или кэшированной сессии localStorage.
 */
export function getInitialUserpicUrl(): string {
  if (typeof window === 'undefined') return '';

  try {
    // 1. URL, извлечённый ранним скриптом в index.html
    const earlyUrl = (window as any).__opendeck_userpic_url;
    if (earlyUrl && typeof earlyUrl === 'string') {
      return earlyUrl;
    }

    // 2. Telegram WebApp нативный мост
    const twUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (twUser?.photo_url && typeof twUser.photo_url === 'string') {
      return twUser.photo_url;
    }

    // 3. Сохраненная сессия в localStorage
    const rawSession = localStorage.getItem('opendeck_user_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      const cachedPhoto = parsed?.user?.photoUrl;
      if (cachedPhoto && typeof cachedPhoto === 'string') {
        return cachedPhoto;
      }
    }
  } catch {
    /* ignore parse errors */
  }

  return '';
}

/**
 * Предзагружает изображение по URL:
 * - Добавляет <link rel="preload" as="image"> в <head>
 * - Загружает через new Image() с referrerPolicy="no-referrer"
 * - Декодирует через HTMLImageElement.decode() для мгновенного появления без GPU-фризов
 */
export function preloadUserpic(rawUrl?: string | null): Promise<boolean> {
  const url = (rawUrl || getInitialUserpicUrl()).trim();
  if (!url) {
    return Promise.resolve(false);
  }

  if (preloadedUrls.has(url)) {
    return Promise.resolve(true);
  }

  const existingPromise = inFlightPromises.get(url);
  if (existingPromise) {
    return existingPromise;
  }

  // Динамический <link rel="preload"> в <head> для максимального сетевого приоритета браузера
  if (typeof document !== 'undefined') {
    try {
      const selector = `link[rel="preload"][as="image"][href="${CSS.escape(url)}"]`;
      if (!document.querySelector(selector)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
      }
    } catch {
      /* ignore invalid selector or head injection issues */
    }
  }

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';

    const onFinish = async (success: boolean) => {
      inFlightPromises.delete(url);
      if (success) {
        preloadedUrls.add(url);
        try {
          if ('decode' in img && typeof img.decode === 'function') {
            await img.decode();
          }
        } catch {
          /* decode fallback, bitmap is already loaded */
        }
      }
      resolve(success);
    };

    img.onload = () => onFinish(true);
    img.onerror = () => onFinish(false);
    img.src = url;
  });

  inFlightPromises.set(url, promise);
  return promise;
}

export function isUserpicPreloaded(url: string): boolean {
  return preloadedUrls.has(url);
}

// Запускаем предзагрузку немедленно при первой загрузке модуля
if (typeof window !== 'undefined') {
  const initial = getInitialUserpicUrl();
  if (initial) {
    void preloadUserpic(initial);
  }
}
