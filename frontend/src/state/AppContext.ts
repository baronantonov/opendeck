import { createContext, useContext } from 'react';
import type { TelegramUserSession } from '../lib/useTelegramUserSession';

export interface AppState extends TelegramUserSession {
  /**
   * Обратная совместимость для компонентов: loading = !isLoaded
   */
  loading: boolean;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
