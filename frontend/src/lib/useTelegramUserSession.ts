import { useState, useEffect, useCallback, useRef } from 'react';
import type { CourseProgress, Lesson, User } from '../types';
import { apiInit, apiLessons, apiLessonsBonus, apiProfile, apiProgress } from '../api/client';
import { BONUS_LESSONS, COURSE_LESSONS } from './constants';
import {
  getEffectiveUserId,
  loadSecuredProgress,
  saveSecuredProgress,
} from './securityGuard';
import { preloadUserpic } from './avatarPreload';

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

const defaultUser: User = {
  name: 'DJ',
  archetype: 'Куратор Вайба',
  groovePoints: 0,
  referralCode: '',
  referralFriends: 0,
  referralGpEarned: 0,
  bonusLessons: 0,
  photoUrl: '',
};

const defaultCourse: CourseProgress = {
  currentLessonId: null,
  completedLessons: [],
  freeLessons: 1,
};

/**
 * Читает мгновенные данные из нативного Telegram WebApp моста (синхронно, без задержек)
 */
function getTelegramBridgeUser(): Partial<User> | null {
  if (typeof window === 'undefined') return null;
  try {
    const tu = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const earlyPhoto = (window as any).__opendeck_userpic_url || '';
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
function readCachedSession(): CachedSessionData | null {
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
function writeCachedSession(data: Omit<CachedSessionData, 'timestamp'>) {
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

export interface TelegramUserSession {
  isLoaded: boolean;
  user: User;
  course: CourseProgress;
  isPaid: boolean;
  paidFull: boolean;
  adminMode: boolean;
  bonusLessonsData: Lesson[];
  bonusDone: number;
  referralFriends: number;
  referralGpEarned: number;
  startParam: string | null;
  welcomeBonus: { type: string; amount: number; message: string } | null;

  setUser: (patch: Partial<User>) => void;
  setCourse: (
    patch: Partial<CourseProgress> | ((prev: CourseProgress) => Partial<CourseProgress>),
  ) => void;
  setPaid: (paid: boolean, full?: boolean) => void;
  setAdminMode: (v: boolean) => void;
  setBonus: (done: number) => void;
  setReferral: (friends: number, gp: number) => void;
  reload: () => Promise<void>;
  completeLesson: (lessonId: number) => void;
  completeBonusLesson: (bonusId: number) => void;
}

export function useTelegramUserSession(): TelegramUserSession {
  const cached = useRef<CachedSessionData | null>(readCachedSession());
  const bridgeUser = useRef<Partial<User> | null>(getTelegramBridgeUser());

  // Мгновенная синхронная инициализация: кэш + актуальные данные из Telegram WebApp bridge
  const [user, setUserState] = useState<User>(() => {
    const base = cached.current?.user || defaultUser;
    if (bridgeUser.current) {
      return {
        ...base,
        name: bridgeUser.current.name || base.name,
        lastName: bridgeUser.current.lastName || base.lastName,
        username: bridgeUser.current.username || base.username,
        photoUrl: bridgeUser.current.photoUrl || base.photoUrl,
        isPremium: bridgeUser.current.isPremium ?? base.isPremium,
      };
    }
    return base;
  });

  const initialUid = getEffectiveUserId();
  const securedInitial = useRef(loadSecuredProgress(initialUid));

  const [course, setCourseState] = useState<CourseProgress>(() => {
    const base = cached.current?.course || defaultCourse;
    if (securedInitial.current.isTampered) {
      return { ...base, completedLessons: [1] };
    }
    const mergedLessons = securedInitial.current.completedLessons.length > 0
      ? securedInitial.current.completedLessons
      : base.completedLessons;
    return {
      ...base,
      completedLessons: mergedLessons,
    };
  });

  const [isPaid, setIsPaid] = useState<boolean>(() => {
    if (securedInitial.current.isTampered) return false;
    // Статус покупки валиден, только если криптографическая подпись подтверждает покупку
    const cachePaid = Boolean(cached.current?.isPaid);
    const securedPaid = Boolean(securedInitial.current.isCoursePurchased);
    return cachePaid && securedPaid;
  });

  const [paidFull, setPaidFull] = useState<boolean>(() => cached.current?.paidFull ?? false);
  const [adminMode, setAdminMode] = useState(false);
  const [bonusDone, setBonusDone] = useState<number>(() => cached.current?.bonusDone ?? 0);
  const [referralFriends, setReferralFriends] = useState<number>(
    () => cached.current?.referralFriends ?? 0,
  );
  const [referralGpEarned, setReferralGpEarned] = useState<number>(
    () => cached.current?.referralGpEarned ?? 0,
  );
  const [bonusLessonsData] = useState<Lesson[]>(BONUS_LESSONS);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [welcomeBonus, setWelcomeBonus] = useState<{ type: string; amount: number; message: string } | null>(null);

  // Флаг окончания инициализации данных сессии (true строго после выполнения reload / fallback)
  const [isLoaded, setIsLoaded] = useState(false);

  const setUser = useCallback((patch: Partial<User>) => {
    setUserState((s) => ({ ...s, ...patch }));
  }, []);

  const setCourse = useCallback(
    (patch: Partial<CourseProgress> | ((prev: CourseProgress) => Partial<CourseProgress>)) => {
      setCourseState((s) =>
        typeof patch === 'function' ? { ...s, ...patch(s) } : { ...s, ...patch },
      );
    },
    [],
  );

  const setPaid = useCallback((paid: boolean, full = false) => {
    setIsPaid(paid);
    setPaidFull(full || paid);
    saveSecuredProgress(getEffectiveUserId(), paid, course.completedLessons);
  }, [course.completedLessons]);

  const setBonus = useCallback((done: number) => setBonusDone(done), []);

  const setReferral = useCallback((friends: number, gp: number) => {
    setReferralFriends(friends);
    setReferralGpEarned(gp);
  }, []);

  const completeLesson = useCallback((lessonId: number) => {
    setCourseState((s) => {
      if (s.completedLessons.includes(lessonId)) return s;
      const next = [...s.completedLessons, lessonId];
      saveSecuredProgress(getEffectiveUserId(), isPaid, next);
      return { ...s, completedLessons: next };
    });
    setUserState((u) => ({ ...u, groovePoints: u.groovePoints + 50 }));
    void apiProgress('dj-basics', lessonId, false).then((res) => {
      if (res && typeof res.gp === 'number') {
        setUserState((u) => ({ ...u, groovePoints: res.gp }));
      }
    }).catch(() => {});
  }, [isPaid]);

  const completeBonusLesson = useCallback((bonusId: number) => {
    setBonusDone((prev) => {
      if (prev >= bonusId) return prev;
      setUserState((u) => ({ ...u, groovePoints: u.groovePoints + 30 }));
      return bonusId;
    });
    void apiProgress('dj-bonus', bonusId, true).then((res) => {
      if (res && typeof res.gp === 'number') {
        setUserState((u) => ({ ...u, groovePoints: res.gp }));
      }
    }).catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    const isPreview =
      (window as any).__PREVIEW__ ||
      (typeof window !== 'undefined' &&
        (window.location.search.includes('preview') ||
          window.location.search.includes('noWelcome') ||
          !(window as any).Telegram?.WebApp?.initData));

    if (isPreview) {
      const tu = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      const previewUser: User = {
        name: tu?.first_name || 'Антон',
        lastName: tu?.last_name || 'Евдокимов',
        username: tu?.username || 'baronantonov',
        archetype: 'Куратор Вайба',
        groovePoints: 120,
        referralCode: 'DJ2026',
        referralFriends: 2,
        referralGpEarned: 40,
        bonusLessons: 1,
        photoUrl: tu?.photo_url || '',
        isPremium: Boolean(tu?.is_premium),
      };
      const previewCourse: CourseProgress = {
        currentLessonId: 1,
        completedLessons: [1],
        freeLessons: 1,
      };

      setUserState(previewUser);
      setCourseState(previewCourse);
      setIsLoaded(true);
      return;
    }

    try {
      const tu = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      const sp = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || null;
      setStartParam(sp);

      // Запрашиваем инициализацию с таймаутом
      const init = await apiInit(sp);

      let profile = null;
      if (!init) {
        try {
          profile = await apiProfile();
        } catch {
          /* ignore */
        }
      }

      const lessons = await apiLessons('dj-basics').catch(() => null);
      const bonus = await apiLessonsBonus().catch(() => null);

      const tribeLink = init?.tribe_invite_link || lessons?.tribe_invite_link;
      if (tribeLink && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('opendeck_tribe_link', tribeLink);
        } catch {}
      }

      setUserState((prevUser) => {
        let nextUser = prevUser;
        if (init) {
          const effectivePhoto = tu?.photo_url || init.user.photo_url || prevUser.photoUrl || '';
          if (effectivePhoto) void preloadUserpic(effectivePhoto);
          nextUser = {
            groovePoints: init.user.groove_points ?? 0,
            referralCode: init.user.referral_code || '',
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
        } else if (profile) {
          const effectivePhoto = tu?.photo_url || profile.user?.photo_url || prevUser.photoUrl || '';
          if (effectivePhoto) void preloadUserpic(effectivePhoto);
          nextUser = {
            ...prevUser,
            groovePoints: profile.gp ?? 0,
            referralCode: profile.referral_code || '',
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
        return nextUser;
      });

      setCourseState((prevCourse) => {
        let nextCourse = prevCourse;
        if (init) {
          nextCourse = {
            completedLessons: (init.course.completed_lessons || []).slice(),
            currentLessonId: init.course.current_lesson_id ?? null,
            freeLessons: init.course.free_lessons ?? 1,
          };
        }
        if (lessons?.completed) {
          nextCourse = { ...nextCourse, completedLessons: lessons.completed.slice() };
        }
        return nextCourse;
      });

      const isActuallyPaid = Boolean(init?.paid || lessons?.paid);
      if (isActuallyPaid) {
        setIsPaid(true);
        setPaidFull(true);
        const effectiveLessons = (init?.course.completed_lessons || lessons?.completed || [1]).slice();
        saveSecuredProgress(getEffectiveUserId(), true, effectiveLessons);
      } else if (init) {
        setIsPaid(false);
        setPaidFull(false);
      }

      if (init?.bonus) {
        setWelcomeBonus(init.bonus);
      }

      if (bonus?.completed) {
        setBonusDone(bonus.completed.length);
      }

      // Сохраняем снимок в localStorage
      setTimeout(() => {
        const effectivePhoto = tu?.photo_url || init?.user?.photo_url || cached.current?.user?.photoUrl || defaultUser.photoUrl || '';
        const u = tu
          ? {
              groovePoints: init?.user.groove_points ?? 0,
              referralCode: init?.user.referral_code || '',
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
              photoUrl: effectivePhoto,
            };

        writeCachedSession({
          user: u,
          course: {
            completedLessons: (init?.course.completed_lessons || lessons?.completed || []).slice(),
            currentLessonId: init?.course.current_lesson_id ?? null,
            freeLessons: init?.course.free_lessons ?? 1,
          },
          isPaid: !!init?.paid || !!lessons?.paid,
          paidFull: !!init?.paid_full || !!lessons?.paid,
          bonusDone: bonus?.completed?.length ?? 0,
          referralFriends: u.referralFriends,
          referralGpEarned: u.referralGpEarned,
        });
      }, 0);
    } finally {
      // Флаг окончания загрузки переключается строго после обработки ответа или fallback
      setIsLoaded(true);
    }
  }, []);

  // Первоначальный вызов reload с гарантированным таймаутом-страховкой
  useEffect(() => {
    let active = true;
    void reload();

    // Страховочный таймаут: даже если сеть зависла наглухо, через 2.5с снимаем экран загрузки
    const safetyTimer = window.setTimeout(() => {
      if (active) {
        setIsLoaded(true);
      }
    }, 2500);

    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
    };
  }, [reload]);

  return {
    isLoaded,
    user,
    course,
    isPaid,
    paidFull,
    adminMode,
    bonusLessonsData,
    bonusDone,
    referralFriends,
    referralGpEarned,
    startParam,
    welcomeBonus,
    setUser,
    setCourse,
    setPaid,
    setAdminMode,
    setBonus,
    setReferral,
    reload,
    completeLesson,
    completeBonusLesson,
  };
}

export { COURSE_LESSONS };
