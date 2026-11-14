import { useState, useEffect, useCallback, useRef } from 'react';
import type { CourseProgress, Lesson, User } from '../types';
import { apiProgress } from '../api/client';
import { BONUS_LESSONS, COURSE_LESSONS } from './constants';
import { getEffectiveUserId, loadSecuredProgress, saveSecuredProgress } from './securityGuard';
import {
  USER_SESSION_STORAGE_KEY,
  type CachedSessionData,
  type CachedUserSession,
  defaultUser,
  defaultCourse,
  readTelegramWebAppUser,
  getTelegramBridgeUser,
  readCachedSession,
  writeCachedSession,
  isPreviewMockMode,
  buildPreviewMockSession,
  saveSessionSnapshot,
} from './session/sessionStorage';
import {
  fetchBackendSessionBundle,
  reconcileInitialCourse,
  reconcileInitialPaid,
  reconcileUserFromBackend,
  reconcileCourseFromBackend,
  reconcileSecuredProgress,
} from './session/sessionReconcile';

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

  const [user, setUserState] = useState<User>(() => {
    const base = cached.current?.user || defaultUser;
    if (!bridgeUser.current) return base;
    return {
      ...base,
      name: bridgeUser.current.name || base.name,
      lastName: bridgeUser.current.lastName || base.lastName,
      username: bridgeUser.current.username || base.username,
      photoUrl: bridgeUser.current.photoUrl || base.photoUrl,
      isPremium: bridgeUser.current.isPremium ?? base.isPremium,
    };
  });

  const initialUid = getEffectiveUserId();
  const securedInitial = useRef(loadSecuredProgress(initialUid));

  const [course, setCourseState] = useState<CourseProgress>(() =>
    reconcileInitialCourse(cached.current?.course || defaultCourse, securedInitial.current),
  );
  const [isPaid, setIsPaid] = useState<boolean>(() =>
    reconcileInitialPaid(initialUid, Boolean(cached.current?.isPaid), securedInitial.current),
  );
  const [paidFull, setPaidFull] = useState<boolean>(
    () => Boolean(cached.current?.paidFull || securedInitial.current.isCoursePurchased),
  );
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
  const [welcomeBonus, setWelcomeBonus] = useState<{
    type: string;
    amount: number;
    message: string;
  } | null>(null);
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

  const setPaid = useCallback(
    (paid: boolean, full = false) => {
      setIsPaid(paid);
      setPaidFull(full || paid);
      saveSecuredProgress(getEffectiveUserId(), paid, course.completedLessons);
      try {
        const existing = readCachedSession();
        if (existing) writeCachedSession({ ...existing, isPaid: paid, paidFull: full || paid });
      } catch {}
    },
    [course.completedLessons],
  );

  const setBonus = useCallback((done: number) => setBonusDone(done), []);
  const setReferral = useCallback((friends: number, gp: number) => {
    setReferralFriends(friends);
    setReferralGpEarned(gp);
  }, []);

  const completeLesson = useCallback(
    (lessonId: number) => {
      if (course.completedLessons.includes(lessonId)) return;
      setCourseState((s) => {
        if (s.completedLessons.includes(lessonId)) return s;
        const next = [...s.completedLessons, lessonId];
        saveSecuredProgress(getEffectiveUserId(), isPaid, next);
        return { ...s, completedLessons: next };
      });
      setUserState((u) => ({ ...u, groovePoints: u.groovePoints + 50 }));
      void apiProgress('dj-basics', lessonId, false)
        .then((res) => {
          if (res && typeof res.gp === 'number') setUserState((u) => ({ ...u, groovePoints: res.gp }));
        })
        .catch(() => {});
    },
    [course.completedLessons, isPaid],
  );

  const completeBonusLesson = useCallback((bonusId: number) => {
    setBonusDone((prev) => {
      if (prev >= bonusId) return prev;
      setUserState((u) => ({ ...u, groovePoints: u.groovePoints + 30 }));
      return bonusId;
    });
    void apiProgress('dj-bonus', bonusId, true)
      .then((res) => {
        if (res && typeof res.gp === 'number') setUserState((u) => ({ ...u, groovePoints: res.gp }));
      })
      .catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    if (isPreviewMockMode()) {
      const preview = buildPreviewMockSession();
      setUserState(preview.user);
      setCourseState(preview.course);
      if (preview.isPaid) {
        setIsPaid(true);
        setPaidFull(true);
      }
      setIsLoaded(true);
      return;
    }

    try {
      const tu = readTelegramWebAppUser();
      const sp = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || null;
      setStartParam(sp);

      const { init, profile, lessons, bonus } = await fetchBackendSessionBundle(sp);
      const currentUid = tu?.id || getEffectiveUserId();
      setUserState((prev) => reconcileUserFromBackend(prev, currentUid, tu, init, profile));

      const localSecured = loadSecuredProgress(currentUid);
      setCourseState((prev) => reconcileCourseFromBackend(prev, init, lessons, localSecured));

      const isActuallyPaid = reconcileSecuredProgress(currentUid, init, lessons, localSecured);
      if (isActuallyPaid) {
        setIsPaid(true);
        setPaidFull(true);
      } else if (init) {
        setIsPaid(false);
        setPaidFull(false);
      }

      if (init?.bonus) setWelcomeBonus(init.bonus);
      if (bonus?.completed) setBonusDone(bonus.completed.length);

      setTimeout(() => {
        saveSessionSnapshot({
          tu,
          currentUid,
          init,
          lessons,
          bonus,
          localSecuredCompleted: localSecured.completedLessons,
          cachedPhotoUrl: cached.current?.user?.photoUrl,
          isActuallyPaid,
        });
      }, 0);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void reload();
    const safetyTimer = window.setTimeout(() => {
      if (active) setIsLoaded(true);
    }, 2500);
    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
    };
  }, [reload]);

  return {
    isLoaded, user, course, isPaid, paidFull, adminMode,
    bonusLessonsData, bonusDone, referralFriends, referralGpEarned,
    startParam, welcomeBonus, setUser, setCourse, setPaid,
    setAdminMode, setBonus, setReferral, reload, completeLesson, completeBonusLesson,
  };
}

export { USER_SESSION_STORAGE_KEY, COURSE_LESSONS };
export type { CachedSessionData, CachedUserSession };
