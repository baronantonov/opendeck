import type { CourseProgress, User } from '../../types';
import { apiInit, apiLessons, apiLessonsBonus, apiProfile } from '../../api/client';
import { preloadUserpic } from '../avatarPreload';
import {
  getCanonicalReferralCode,
  loadSecuredProgress,
  saveSecuredProgress,
} from '../securityGuard';

type SecuredProgressResult = ReturnType<typeof loadSecuredProgress>;

export async function fetchBackendSessionBundle(startParam: string | null) {
  const init = await apiInit(startParam);
  const profile = !init ? await apiProfile().catch(() => null) : null;
  const lessons = await apiLessons('dj-basics').catch(() => null);
  const bonus = await apiLessonsBonus().catch(() => null);

  const tribeLink = init?.tribe_invite_link || lessons?.tribe_invite_link;
  if (tribeLink && typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('opendeck_tribe_link', tribeLink);
    } catch {}
  }

  return { init, profile, lessons, bonus };
}

/**
 * Нормализует и сортирует список пройденных уроков из нескольких источников
 */
export function extractCompletedNumbers(
  remoteLessons: number[] | undefined | null,
  securedLessons: number[],
  isTampered: boolean,
): number[] {
  const merged = Array.from(
    new Set([
      ...(remoteLessons || []),
      ...(isTampered ? [] : securedLessons),
    ]),
  ).sort((a, b) => a - b);
  return merged.length > 0 ? merged : [1];
}

export function reconcileInitialCourse(
  base: CourseProgress,
  secured: SecuredProgressResult,
): CourseProgress {
  if (secured.isTampered) {
    return { ...base, completedLessons: [1] };
  }
  const mergedLessons =
    secured.completedLessons.length > 0 ? secured.completedLessons : base.completedLessons;
  return {
    ...base,
    completedLessons: mergedLessons,
  };
}

export function reconcileInitialPaid(
  uid: string | number,
  cachedPaid: boolean,
  secured: SecuredProgressResult,
): boolean {
  if (secured.isTampered) return false;
  const securedPaid = Boolean(secured.isValid && secured.isCoursePurchased);
  if (cachedPaid && !securedPaid) {
    saveSecuredProgress(
      uid,
      true,
      secured.completedLessons.length > 0 ? secured.completedLessons : [1],
    );
  }
  return securedPaid || cachedPaid;
}

export function reconcileUserFromBackend(
  prevUser: User,
  currentUid: string | number,
  tu: any,
  init: any,
  profile: any,
): User {
  if (init) {
    const effectivePhoto = tu?.photo_url || init.user.photo_url || prevUser.photoUrl || '';
    if (effectivePhoto) void preloadUserpic(effectivePhoto);
    return {
      groovePoints: init.user.groove_points ?? 0,
      referralCode: getCanonicalReferralCode(currentUid, init.user.referral_code),
      referralFriends: init.referral_friends ?? init.user.referral_friends ?? 0,
      referralGpEarned: init.referral_gp_earned ?? init.user.referral_gp_earned ?? 0,
      bonusLessons: init.user.bonus_lessons ?? 0,
      archetype: init.user.archetype || 'Куратор Вайба',
      name: tu?.first_name || init.user.first_name || prevUser.name,
      lastName: tu?.last_name || '',
      username: tu?.username || init.user.username || '',
      photoUrl: effectivePhoto,
      isPremium: Boolean(tu?.is_premium),
    };
  }
  if (profile) {
    const effectivePhoto = tu?.photo_url || profile.user?.photo_url || prevUser.photoUrl || '';
    if (effectivePhoto) void preloadUserpic(effectivePhoto);
    return {
      ...prevUser,
      groovePoints: profile.gp ?? 0,
      referralCode: getCanonicalReferralCode(currentUid, profile.referral_code),
      referralFriends: profile.referral_friends ?? 0,
      referralGpEarned: profile.referral_gp_earned ?? 0,
      bonusLessons: profile.bonus_lessons ?? 0,
      archetype: profile.archetype || 'Куратор Вайба',
      name: tu?.first_name || profile.user?.first_name || prevUser.name,
      lastName: tu?.last_name || '',
      username: tu?.username || profile.user?.username || '',
      photoUrl: effectivePhoto,
      isPremium: Boolean(tu?.is_premium),
    };
  }
  return {
    ...prevUser,
    referralCode: getCanonicalReferralCode(currentUid, prevUser.referralCode),
  };
}

export function reconcileCourseFromBackend(
  prevCourse: CourseProgress,
  init: any,
  lessons: any,
  localSecured: SecuredProgressResult,
): CourseProgress {
  let nextCourse = prevCourse;
  if (init) {
    nextCourse = {
      completedLessons: extractCompletedNumbers(
        init.course.completed_lessons,
        localSecured.completedLessons,
        localSecured.isTampered,
      ),
      currentLessonId: init.course.current_lesson_id ?? null,
      freeLessons: init.course.free_lessons ?? 1,
    };
  }
  if (lessons?.completed) {
    nextCourse = {
      ...nextCourse,
      completedLessons: extractCompletedNumbers(
        lessons.completed,
        localSecured.completedLessons,
        localSecured.isTampered,
      ),
    };
  }
  return nextCourse;
}

export function reconcileSecuredProgress(
  currentUid: string | number,
  init: any,
  lessons: any,
  localSecured: SecuredProgressResult,
): boolean {
  const localPaidValid = Boolean(
    !localSecured.isTampered && localSecured.isValid && localSecured.isCoursePurchased,
  );
  const isActuallyPaid = Boolean(init?.paid || lessons?.paid || localPaidValid);

  if (isActuallyPaid) {
    const effectiveLessons = extractCompletedNumbers(
      init?.course.completed_lessons || lessons?.completed || [1],
      localSecured.completedLessons,
      localSecured.isTampered,
    );
    saveSecuredProgress(currentUid, true, effectiveLessons);
  }

  return isActuallyPaid;
}
