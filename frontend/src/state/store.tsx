import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { CourseProgress, Lesson, User } from '../types';
import { COURSE_LESSONS } from '../lib/constants';
import { useTelegramUserSession, type TelegramUserSession } from '../lib/useTelegramUserSession';
import {
  CourseProgressProvider,
  useCourseProgress,
  type CourseProgressContextValue,
} from './CourseProgressContext';

export interface AppState extends TelegramUserSession {
  /**
   * Обратная совместимость для компонентов: loading = !isLoaded
   */
  loading: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const session = useTelegramUserSession();

  const value = useMemo<AppState>(
    () => ({
      ...session,
      loading: !session.isLoaded,
    }),
    [session],
  );

  return (
    <Ctx.Provider value={value}>
      <CourseProgressProvider>{children}</CourseProgressProvider>
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { COURSE_LESSONS, useTelegramUserSession, CourseProgressProvider, useCourseProgress };
export type { TelegramUserSession, CourseProgress, Lesson, User, CourseProgressContextValue };

