import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useApp } from './store';
import {
  getEffectiveUserId,
  guardLessonAccess as guardLessonAccessInternal,
  guardTribeAccess as guardTribeAccessInternal,
  loadSecuredProgress,
  resetSecuredProgress,
  saveSecuredProgress,
} from '../lib/securityGuard';
import { getTelegramWebApp } from '../types';

export interface CourseProgressContextValue {
  isCoursePurchased: boolean;
  completedLessons: number[];
  userId: number | string;
  username: string;
  isTampered: boolean;
  isLessonCompleted: (lessonId: number) => boolean;
  completeLesson: (lessonId: number) => void;
  setCoursePurchased: (purchased: boolean) => void;
  resetProgress: () => void;
  unlockAllLessons: () => void;
  setupPaywallTest: () => void;
  verifyIntegrity: () => boolean;
  guardLessonAccess: (lessonIndex: number) => {
    allowed: boolean;
    reason: 'ok' | 'needs_paywall' | 'tampered' | 'needs_prev_lesson';
  };
  guardTribeAccess: () => {
    allowed: boolean;
    reason: 'ok' | 'needs_paywall' | 'tampered';
  };
}

const CourseProgressContext = createContext<CourseProgressContextValue | null>(null);

export function CourseProgressProvider({ children }: { children: ReactNode }) {
  const {
    user,
    course,
    isPaid,
    adminMode,
    setPaid,
    setCourse,
    completeLesson: completeLessonInSession,
  } = useApp();

  const userId = useMemo(() => {
    const tw = getTelegramWebApp();
    return tw?.initDataUnsafe?.user?.id || getEffectiveUserId();
  }, []);

  const username = useMemo(() => {
    const tw = getTelegramWebApp();
    return tw?.initDataUnsafe?.user?.username || user.username || '';
  }, [user.username]);

  // Проверка целостности состояния
  const verifyIntegrity = useCallback((): boolean => {
    const current = loadSecuredProgress(userId);
    if (current.isTampered || !current.isValid) {
      if (isPaid) {
        setPaid(false, false);
      }
      return false;
    }
    return true;
  }, [userId, isPaid, setPaid]);

  const isTampered = useMemo(() => {
    const current = loadSecuredProgress(userId);
    return current.isTampered;
  }, [userId]);

  const isLessonCompleted = useCallback(
    (lessonId: number) => course.completedLessons.includes(lessonId),
    [course.completedLessons],
  );

  const completeLesson = useCallback(
    (lessonId: number) => {
      completeLessonInSession(lessonId);
      const nextLessons = Array.from(new Set([...course.completedLessons, lessonId])).sort(
        (a, b) => a - b,
      );
      saveSecuredProgress(userId, isPaid, nextLessons);
    },
    [completeLessonInSession, course.completedLessons, userId, isPaid],
  );

  const setCoursePurchased = useCallback(
    (purchased: boolean) => {
      setPaid(purchased, purchased);
      saveSecuredProgress(userId, purchased, course.completedLessons);
    },
    [setPaid, userId, course.completedLessons],
  );

  /**
   * Сбросить всё (Режим новичка)
   */
  const resetProgress = useCallback(() => {
    resetSecuredProgress(userId);
    setPaid(false, false);
    setCourse({
      completedLessons: [1],
      currentLessonId: 1,
      freeLessons: 1,
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('opendeck_tribe_confetti_shown');
        sessionStorage.removeItem('opendeck_banner_dismissed');
        sessionStorage.removeItem('opendeck_banner_dismissed_v2');
        localStorage.removeItem('opendeck_hs_added');
        localStorage.removeItem('opendeck_hs_installed_v2');
      } catch {}

      const tw = getTelegramWebApp();
      try {
        tw?.CloudStorage?.removeItem?.('opendeck_tribe_confetti_shown', () => {});
        tw?.CloudStorage?.removeItem?.('opendeck_hs_added', () => {});
      } catch {}
    }
  }, [userId, setPaid, setCourse]);

  /**
   * Открыть все 10 уроков
   */
  const unlockAllLessons = useCallback(() => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    saveSecuredProgress(userId, true, all);
    setPaid(true, true);
    setCourse({
      completedLessons: all,
      currentLessonId: 10,
      freeLessons: 10,
    });
  }, [userId, setPaid, setCourse]);

  /**
   * Тест Paywall после 2-го урока
   */
  const setupPaywallTest = useCallback(() => {
    saveSecuredProgress(userId, false, [1]);
    setPaid(false, false);
    setCourse({
      completedLessons: [1],
      currentLessonId: 2,
      freeLessons: 1,
    });
  }, [userId, setPaid, setCourse]);

  const effectivePurchased = useMemo(() => {
    if (adminMode || isPaid) return true;
    const current = loadSecuredProgress(userId);
    return Boolean(!current.isTampered && current.isValid && current.isCoursePurchased);
  }, [adminMode, isPaid, userId]);

  const guardLessonAccess = useCallback(
    (lessonIndex: number) => {
      return guardLessonAccessInternal(
        lessonIndex,
        userId,
        effectivePurchased,
        course.completedLessons,
        adminMode,
      );
    },
    [userId, effectivePurchased, course.completedLessons, adminMode],
  );

  const guardTribeAccess = useCallback(() => {
    return guardTribeAccessInternal(userId, effectivePurchased, adminMode);
  }, [userId, effectivePurchased, adminMode]);

  const value = useMemo<CourseProgressContextValue>(
    () => ({
      isCoursePurchased: effectivePurchased,
      completedLessons: course.completedLessons,
      userId,
      username,
      isTampered,
      isLessonCompleted,
      completeLesson,
      setCoursePurchased,
      resetProgress,
      unlockAllLessons,
      setupPaywallTest,
      verifyIntegrity,
      guardLessonAccess,
      guardTribeAccess,
    }),
    [
      effectivePurchased,
      course.completedLessons,
      userId,
      username,
      isTampered,
      isLessonCompleted,
      completeLesson,
      setCoursePurchased,
      resetProgress,
      unlockAllLessons,
      setupPaywallTest,
      verifyIntegrity,
      guardLessonAccess,
      guardTribeAccess,
    ],
  );

  return (
    <CourseProgressContext.Provider value={value}>
      {children}
    </CourseProgressContext.Provider>
  );
}

export function useCourseProgress(): CourseProgressContextValue {
  const ctx = useContext(CourseProgressContext);
  if (!ctx) {
    throw new Error('useCourseProgress must be used within CourseProgressProvider');
  }
  return ctx;
}
