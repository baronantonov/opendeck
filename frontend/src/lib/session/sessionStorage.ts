import type { CourseProgress, User } from '../../types';
import { preloadUserpic } from '../avatarPreload';
import {
  getCanonicalReferralCode,
  getEffectiveUserId,
  loadSecuredProgress,
} from '../securityGuard';

export const USER_SESSION_STORAGE_KEY = 'opendeck_user_session_v1';

export interface CachedSessionData {
  user: User;
  course: CourseProgress;
  isPaid: boolean;
  paidFull: boolean;
  bonusDone: number;
  referralFriends: number;
  referralGpEarned: number;
  timestamp: number;
}

export type CachedUserSession = CachedSessionData;

export const defaultUser: User = {
  name: 'DJ',
  archetype: 'Куратор Вайба',
  groovePoints: 0,
  referralCode: '',
  referralFriends: 0,
  referralGpEarned: 0,
  bonusLessons: 0,
  photoUrl: '',
};

export const defaultCourse: CourseProgress = {
  currentLessonId: null,
  completedLessons: [],
  freeLessons: 1,
};

export function readTelegramWebAppUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}

export function readEarlyAvatarUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (window as any).__opendeck_userpic_url || '';
  } catch {
    return '';
  }
}

/**
 * Читает мгновенные данные из нативного Telegram WebApp моста (синхронно, без задержек)
 */
export function getTelegramBridgeUser(): Partial<User> | null {
  if (typeof window === 'undefined') return null;
  try {
    const tu = readTelegramWebAppUser();
    const earlyPhoto = readEarlyAvatarUrl();
    if (!tu && !earlyPhoto) return null;
    const photo = tu?.photo_url || earlyPhoto || '';
    if (photo) {
      void preloadUserpic(photo);
    }
    return {
      name: tu?.first_name || 'DJ',
      lastName: tu?.last_name || '',
      username: tu?.username || '',
      photoUrl: photo,
      isPremium: Boolean(tu?.is_premium),
    };
  } catch {
    return null;
  }
}

/**
 * Считывает кэшированную сессию из localStorage
 */
export function readCachedSession(): CachedSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedSessionData;
    if (data?.user?.photoUrl) {
      void preloadUserpic(data.user.photoUrl);
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Сохраняет снимок сессии в localStorage
 */
export function writeCachedSession(data: Omit<CachedSessionData, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedSessionData = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage quota or private mode errors */
  }
}

export function isPreviewMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__PREVIEW__ ||
      window.location.search.includes('preview') ||
      window.location.search.includes('noWelcome') ||
      !(window as any).Telegram?.WebApp?.initData,
  );
}

export function buildPreviewMockSession(): {
  user: User;
  course: CourseProgress;
  isPaid: boolean;
} {
  const tu = readTelegramWebAppUser();
  const uid = tu?.id || getEffectiveUserId();
  const secured = loadSecuredProgress(uid);
  const previewLessons =
    !secured.isTampered && secured.completedLessons.length > 0
      ? secured.completedLessons
      : [1];
  const previewPaid = Boolean(
    !secured.isTampered && secured.isValid && secured.isCoursePurchased,
  );

  const previewUser: User = {
    name: tu?.first_name || 'Антон',
    lastName: tu?.last_name || 'Евдокимов',
    username: tu?.username || 'baronantonov',
    archetype: 'Куратор Вайба',
    groovePoints: 120,
    referralCode: getCanonicalReferralCode(uid),
    referralFriends: 2,
    referralGpEarned: 40,
    bonusLessons: 1,
    photoUrl: tu?.photo_url || '',
    isPremium: Boolean(tu?.is_premium),
  };
  const previewCourse: CourseProgress = {
    currentLessonId: previewLessons[previewLessons.length - 1] || 1,
    completedLessons: previewLessons,
    freeLessons: 1,
  };

  return {
    user: previewUser,
    course: previewCourse,
    isPaid: previewPaid,
  };
}

export function saveSessionSnapshot(params: {
  tu: any;
  currentUid: string | number;
  init: any;
  lessons: any;
  bonus: any;
  localSecuredCompleted: number[];
  cachedPhotoUrl?: string;
  isActuallyPaid: boolean;
}): void {
  const {
    tu,
    currentUid,
    init,
    lessons,
    bonus,
    localSecuredCompleted,
    cachedPhotoUrl,
    isActuallyPaid,
  } = params;

  const effectivePhoto =
    tu?.photo_url || init?.user?.photo_url || cachedPhotoUrl || defaultUser.photoUrl || '';

  const u: User = tu
    ? {
        groovePoints: init?.user.groove_points ?? 0,
        referralCode: getCanonicalReferralCode(currentUid, init?.user.referral_code),
        referralFriends: init?.referral_friends ?? init?.user.referral_friends ?? 0,
        referralGpEarned: init?.referral_gp_earned ?? init?.user.referral_gp_earned ?? 0,
        bonusLessons: init?.user.bonus_lessons ?? 0,
        archetype: init?.user.archetype || 'Куратор Вайба',
        name: tu?.first_name || 'DJ',
        lastName: tu?.last_name || '',
        username: tu?.username || '',
        photoUrl: effectivePhoto,
        isPremium: Boolean(tu?.is_premium),
      }
    : {
        ...defaultUser,
        referralCode: getCanonicalReferralCode(currentUid),
        photoUrl: effectivePhoto,
      };

  writeCachedSession({
    user: u,
    course: {
      completedLessons: (
        init?.course.completed_lessons ||
        lessons?.completed ||
        localSecuredCompleted || [1]
      ).slice(),
      currentLessonId: init?.course.current_lesson_id ?? null,
      freeLessons: init?.course.free_lessons ?? 1,
    },
    isPaid: isActuallyPaid,
    paidFull: Boolean(init?.paid_full || lessons?.paid || isActuallyPaid),
    bonusDone: bonus?.completed?.length ?? 0,
    referralFriends: u.referralFriends,
    referralGpEarned: u.referralGpEarned,
  });
}
