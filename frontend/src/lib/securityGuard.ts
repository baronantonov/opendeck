/**
 * OpenDeck TMA SecurityGuard
 * Модуль криптографической защиты целостности данных, прогресса и статуса покупок.
 * Привязывает состояние к уникальному Telegram User ID (Bot API 8.0+).
 */

import { getTelegramWebApp } from '../types';

export const OPENDECK_INTEGRITY_SALT = 'opendeck_salt_2026_rekordbox_prod_key_7f8a9b';
export const SECURED_PROGRESS_PREFIX = 'opendeck_secured_progress';

export interface SecuredProgressState {
  userId: number | string;
  isCoursePurchased: boolean;
  completedLessons: number[];
  signature: string;
  updatedAt: number;
  version: number;
}

/**
 * Компактная, синхронная, детерминированная реализация SHA-256 на чистом TypeScript.
 * Позволяет проверять подпись мгновенно при каждом рендере и вызове без async-задержек.
 */
export function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];

  let primeCounter = 0;
  const isPrime: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isPrime[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = i < 16 ? w[i] : (
        (w[i] = (
          (w[i - 16] +
            (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
            w[i - 7] +
            (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
          0
        ))
      );

      const s1 =
        rightRotate(oldHash[0], 2) ^
        rightRotate(oldHash[0], 13) ^
        rightRotate(oldHash[0], 22);
      const ch = (oldHash[4] & oldHash[5]) ^ (~oldHash[4] & oldHash[6]);
      const temp1 =
        oldHash[7] +
        (rightRotate(oldHash[4], 6) ^
          rightRotate(oldHash[4], 11) ^
          rightRotate(oldHash[4], 25)) +
        ch +
        k[i] +
        s0;
      const maj =
        (oldHash[0] & oldHash[1]) ^
        (oldHash[0] & oldHash[2]) ^
        (oldHash[1] & oldHash[2]);
      const temp2 = s1 + maj;

      oldHash[7] = oldHash[6];
      oldHash[6] = oldHash[5];
      oldHash[5] = oldHash[4];
      oldHash[4] = (oldHash[3] + temp1) | 0;
      oldHash[3] = oldHash[2];
      oldHash[2] = oldHash[1];
      oldHash[1] = oldHash[0];
      oldHash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let result = '';
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (8 * j)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

/**
 * Получает актуальный числовой или строковый Telegram User ID.
 * При запуске вне Telegram возвращает dev-идентификатор владельца (285754501).
 */
export function getEffectiveUserId(): number | string {
  if (typeof window === 'undefined') return 285754501;
  try {
    const tw = getTelegramWebApp();
    const tu = tw?.initDataUnsafe?.user;
    if (tu?.id) return tu.id;
  } catch {}
  return 285754501; // Дефолтный ID разработчика (@baronantonov)
}

/**
 * Формирует имя ключа в localStorage/CloudStorage с изоляцией по ID пользователя.
 */
export function getStorageKey(userId?: number | string): string {
  const uid = userId ?? getEffectiveUserId();
  return `${SECURED_PROGRESS_PREFIX}_${uid}`;
}

/**
 * Вычисляет криптографическую подпись состояния прогресса и покупок:
 * HASH(userId : isCoursePurchased : sortedLessons : salt : version)
 */
export function computeIntegritySignature(
  userId: number | string,
  isCoursePurchased: boolean,
  completedLessons: number[],
  version = 1,
): string {
  const sorted = Array.from(new Set(completedLessons)).sort((a, b) => a - b);
  const rawPayload = `${userId}:${isCoursePurchased ? '1' : '0'}:${sorted.join(',')}:${OPENDECK_INTEGRITY_SALT}:v${version}`;
  return sha256Sync(rawPayload);
}

/**
 * Проверяет целостность состояния и подписи.
 * Возвращает true только если подпись строго совпадает с вычисленной.
 */
export function verifyStateIntegrity(
  state: Partial<SecuredProgressState> | null,
  expectedUserId?: number | string,
): boolean {
  if (!state || typeof state !== 'object') return false;
  const uid = expectedUserId ?? getEffectiveUserId();

  if (String(state.userId) !== String(uid)) {
    return false;
  }

  if (typeof state.isCoursePurchased !== 'boolean') {
    return false;
  }

  if (!Array.isArray(state.completedLessons)) {
    return false;
  }

  if (!state.signature || typeof state.signature !== 'string') {
    return false;
  }

  const expectedSig = computeIntegritySignature(
    uid,
    state.isCoursePurchased,
    state.completedLessons,
    state.version || 1,
  );

  return state.signature === expectedSig;
}

/**
 * Считывает защищенное состояние из localStorage.
 * Если обнаружена попытка ручной модификации в обход подписи —
 * компрометированные данные автоматически сбрасываются до безопасного дефолта.
 */
export function loadSecuredProgress(userId?: number | string): {
  isCoursePurchased: boolean;
  completedLessons: number[];
  isValid: boolean;
  isTampered: boolean;
} {
  const uid = userId ?? getEffectiveUserId();
  const key = getStorageKey(uid);

  if (typeof window === 'undefined') {
    return { isCoursePurchased: false, completedLessons: [1], isValid: true, isTampered: false };
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Инициализируем безопасный дефолт и подписываем его
      const defaultState = saveSecuredProgress(uid, false, [1]);
      return {
        isCoursePurchased: defaultState.isCoursePurchased,
        completedLessons: defaultState.completedLessons,
        isValid: true,
        isTampered: false,
      };
    }

    const parsed: SecuredProgressState = JSON.parse(raw);
    const isValid = verifyStateIntegrity(parsed, uid);

    if (!isValid) {
      console.warn('[SecurityGuard] State tampering detected for user:', uid);
      // Сброс до безопасного дефолта
      saveSecuredProgress(uid, false, [1]);
      return {
        isCoursePurchased: false,
        completedLessons: [1],
        isValid: false,
        isTampered: true,
      };
    }

    return {
      isCoursePurchased: parsed.isCoursePurchased,
      completedLessons: parsed.completedLessons,
      isValid: true,
      isTampered: false,
    };
  } catch (err) {
    console.error('[SecurityGuard] Error loading secured progress:', err);
    saveSecuredProgress(uid, false, [1]);
    return {
      isCoursePurchased: false,
      completedLessons: [1],
      isValid: false,
      isTampered: true,
    };
  }
}

/**
 * Легитимно подписывает и сохраняет состояние прогресса и покупок
 * синхронно в localStorage и асинхронно в Telegram WebApp.CloudStorage.
 */
export function saveSecuredProgress(
  userId: number | string,
  isCoursePurchased: boolean,
  completedLessons: number[],
): SecuredProgressState {
  const uid = userId ?? getEffectiveUserId();
  const sorted = Array.from(new Set(completedLessons)).sort((a, b) => a - b);
  const version = 1;
  const signature = computeIntegritySignature(uid, isCoursePurchased, sorted, version);

  const state: SecuredProgressState = {
    userId: uid,
    isCoursePurchased,
    completedLessons: sorted,
    signature,
    updatedAt: Date.now(),
    version,
  };

  const key = getStorageKey(uid);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}

    try {
      const tw = getTelegramWebApp();
      tw?.CloudStorage?.setItem?.(key, JSON.stringify(state), () => {});
    } catch {}
  }

  return state;
}

/**
 * Полный сброс состояния до режима новичка с валидной криптографической подписью.
 */
export function resetSecuredProgress(userId?: number | string): SecuredProgressState {
  const uid = userId ?? getEffectiveUserId();
  return saveSecuredProgress(uid, false, [1]);
}

/**
 * Проверка права доступа к уроку по его индексу (0..9).
 * - Урок 1 (index 0): открыт бесплатно всегда (FREE_LESSONS = 1).
 * - Уроки 2–10 (index 1..9): требуют подтвержденной покупки
 *   И завершения предыдущего урока.
 */
export function guardLessonAccess(
  lessonIndex: number,
  userId: number | string,
  isPurchased: boolean,
  completedLessons: number[],
  adminMode = false,
): { allowed: boolean; reason: 'ok' | 'needs_paywall' | 'tampered' | 'needs_prev_lesson' } {
  if (adminMode) return { allowed: true, reason: 'ok' };
  if (lessonIndex === 0) return { allowed: true, reason: 'ok' };

  // Если сервер подтвердил покупку курса, синхронизируем локальное подписанное состояние
  if (isPurchased) {
    const secured = loadSecuredProgress(userId);
    if (!secured.isCoursePurchased) {
      saveSecuredProgress(userId, true, completedLessons);
    }
  } else {
    // Без оплаты уроки 2-10 требуют пейволла
    return { allowed: false, reason: 'needs_paywall' };
  }

  // Проверка целостности хранилища
  const secured = loadSecuredProgress(userId);
  if (secured.isTampered || !secured.isValid) {
    return { allowed: false, reason: 'tampered' };
  }

  // Проверка последовательности прохождения
  const prevLessonNumber = lessonIndex; // для урока 2 (index 1) предыдущий номер 1
  if (!completedLessons.includes(prevLessonNumber)) {
    return { allowed: false, reason: 'needs_prev_lesson' };
  }

  return { allowed: true, reason: 'ok' };
}

/**
 * Проверка права доступа к экрану «ПЛЕМЯ» и инвайт-ссылке.
 */
export function guardTribeAccess(
  userId: number | string,
  isPurchased: boolean,
  adminMode = false,
): { allowed: boolean; reason: 'ok' | 'needs_paywall' | 'tampered' } {
  if (adminMode) return { allowed: true, reason: 'ok' };

  if (isPurchased) {
    const secured = loadSecuredProgress(userId);
    if (!secured.isCoursePurchased) {
      saveSecuredProgress(userId, true, [1]);
    }
  } else {
    return { allowed: false, reason: 'needs_paywall' };
  }

  const secured = loadSecuredProgress(userId);
  if (secured.isTampered || !secured.isValid) {
    return { allowed: false, reason: 'tampered' };
  }

  return { allowed: true, reason: 'ok' };
}
