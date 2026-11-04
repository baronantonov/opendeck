import {
  useMemo,
  type ReactNode,
} from 'react';
import type { CourseProgress, Lesson, User } from '../types';
import { COURSE_LESSONS } from '../lib/constants';
import { useTelegramUserSession, type TelegramUserSession } from '../lib/useTelegramUserSession';
import { AppContext, useApp, type AppState } from './AppContext';
import {
  CourseProgressProvider,
  useCourseProgress,
  type CourseProgressContextValue,
} from './CourseProgressContext';

export type { AppState };

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
    <AppContext.Provider value={value}>
      <CourseProgressProvider>{children}</CourseProgressProvider>
    </AppContext.Provider>
  );
}

export { useApp, COURSE_LESSONS, useTelegramUserSession, CourseProgressProvider, useCourseProgress };
export type { TelegramUserSession, CourseProgress, Lesson, User, CourseProgressContextValue };

