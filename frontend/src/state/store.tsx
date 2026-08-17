import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CourseProgress, Lesson, User } from '../types';
import { apiInit, apiLessons, apiLessonsBonus, apiProfile } from '../api/client';
import { BONUS_LESSONS, COURSE_LESSONS } from '../lib/constants';

interface AppState {
  loading: boolean;
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

  setUser: (patch: Partial<User>) => void;
  setCourse: (patch: Partial<CourseProgress>) => void;
  setPaid: (paid: boolean, full?: boolean) => void;
  setAdminMode: (v: boolean) => void;
  setBonus: (done: number) => void;
  setReferral: (friends: number, gp: number) => void;
  reload: () => Promise<void>;
  completeLesson: (lessonId: number) => void;
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

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUserState] = useState<User>(defaultUser);
  const [course, setCourseState] = useState<CourseProgress>(defaultCourse);
  const [isPaid, setIsPaid] = useState(false);
  const [paidFull, setPaidFull] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [bonusDone, setBonusDone] = useState(0);
  const [referralFriends, setReferralFriends] = useState(0);
  const [referralGpEarned, setReferralGpEarned] = useState(0);
  const [bonusLessonsData] = useState<Lesson[]>(BONUS_LESSONS);
  const [startParam, setStartParam] = useState<string | null>(null);

  const setUser = (patch: Partial<User>) =>
    setUserState((s) => ({ ...s, ...patch }));
  const setCourse = (
    patch: Partial<CourseProgress> | ((prev: CourseProgress) => Partial<CourseProgress>),
  ) =>
    setCourseState((s) =>
      typeof patch === 'function' ? { ...s, ...patch(s) } : { ...s, ...patch },
    );
  const setPaid = (paid: boolean, full = false) => {
    setIsPaid(paid);
    setPaidFull(full || paid);
  };
  const setBonus = (done: number) => setBonusDone(done);
  const setReferral = (friends: number, gp: number) => {
    setReferralFriends(friends);
    setReferralGpEarned(gp);
  };

  const completeLesson = (lessonId: number) =>
    setCourseState((s) =>
      s.completedLessons.includes(lessonId)
        ? s
        : { ...s, completedLessons: [...s.completedLessons, lessonId] },
    );

  const reload = async () => {
    // Design preview (window.__PREVIEW__): skip network, render immediately
    // with local fallback data so the UI is fully visible outside Telegram.
    if ((window as any).__PREVIEW__) {
      const tu = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      if (tu) {
        setUser({
          name: tu.first_name || 'Аня',
          archetype: 'Куратор Вайба',
          groovePoints: 120,
          referralCode: 'ABC123',
          referralFriends: 2,
          referralGpEarned: 40,
          bonusLessons: 0,
          photoUrl: '',
        });
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sp =
        (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || null;
      setStartParam(sp);
      const init = await apiInit(sp);

      // Local fallback content in case the API is unreachable.
      let profile = null;
      try {
        profile = await apiProfile();
      } catch {
        /* ignore */
      }
      const lessons = await apiLessons('dj-basics').catch(() => null);
      const bonus = await apiLessonsBonus().catch(() => null);

      if (init) {
        setUser({
          groovePoints: init.user.groove_points ?? 0,
          referralCode: init.user.referral_code || '',
          referralFriends: init.user.referral_friends ?? 0,
          referralGpEarned: init.user.referral_gp_earned ?? 0,
          bonusLessons: init.user.bonus_lessons ?? 0,
          archetype: init.user.archetype || 'Куратор Вайба',
          name: init.user.first_name || user.name,
          photoUrl: init.user.photo_url || '',
        });
        setCourse({
          completedLessons: (init.course.completed_lessons || []).slice(),
          currentLessonId: init.course.current_lesson_id ?? null,
          freeLessons: init.course.free_lessons ?? 1,
        });
        setPaid(!!init.paid, !!init.paid_full);
      } else if (profile) {
        setUser({
          groovePoints: profile.gp ?? 0,
          referralCode: profile.referral_code || '',
          referralFriends: profile.referral_friends ?? 0,
          referralGpEarned: profile.referral_gp_earned ?? 0,
          bonusLessons: profile.bonus_lessons ?? 0,
          archetype: profile.archetype || 'Куратор Вайба',
        });
      }

      if (lessons?.completed) {
        setCourse((s) => ({ ...s, completedLessons: lessons.completed.slice() }));
        if (lessons.paid) setPaid(true, true);
      }
      if (bonus?.completed) setBonusDone(bonus.completed.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AppState>(
    () => ({
      loading,
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
      setUser,
      setCourse,
      setPaid,
      setAdminMode,
      setBonus,
      setReferral,
      reload,
      completeLesson,
    }),
    [
      loading,
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
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { COURSE_LESSONS };
