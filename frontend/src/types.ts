export interface Lesson {
  id?: number;
  t: string;
  video?: string;
  d: string[];
}

export interface User {
  name: string;
  lastName?: string;
  username?: string;
  archetype: string;
  groovePoints: number;
  referralCode: string;
  referralFriends: number;
  referralGpEarned: number;
  bonusLessons: number;
  photoUrl: string;
  isPremium?: boolean;
}

export interface CourseProgress {
  currentLessonId: number | null;
  completedLessons: number[];
  freeLessons: number;
}

export interface InitResponse {
  user: {
    id?: string;
    name?: string;
    first_name?: string;
    username?: string;
    photo_url?: string;
    referral_code: string;
    referred_by?: string | null;
    archetype?: string;
    groove_points: number;
    bonus_lessons?: number;
    referral_friends?: number;
    referral_gp_earned?: number;
    last_seen?: string;
  };
  course: {
    course_id: string;
    completed_lessons: number[];
    total_lessons: number;
    current_lesson_id: number | null;
    free_lessons?: number;
    bonus_lessons?: number;
    total_bonus_lessons?: number;
    bonus_unlocked?: boolean;
  };
  referral_friends?: number;
  referral_gp_earned?: number;
  paid?: boolean;
  paid_full?: boolean;
  paid_tripwire?: boolean;
  bonus?: { type: string; amount: number; message: string } | null;
}

export interface LessonsResponse {
  lessons: Lesson[];
  completed: number[];
  paid: boolean;
}

export interface InvoiceResponse {
  invoice_link?: string;
  pay_url?: string;
  error?: string;
  detail?: string;
}

export interface MentorPrice {
  final: number;
  discount: number;
}

export type HomeScreenStatus = 'added' | 'unsupported' | 'missed' | 'unknown';

export interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramCloudStorage {
  getItem: (
    key: string,
    callback: (error: Error | null, value: string) => void,
  ) => void;
  setItem: (
    key: string,
    value: string,
    callback?: (error: Error | null, result: boolean) => void,
  ) => void;
  getItems?: (
    keys: string[],
    callback: (error: Error | null, values: Record<string, string>) => void,
  ) => void;
  removeItem?: (
    key: string,
    callback?: (error: Error | null, result: boolean) => void,
  ) => void;
  removeItems?: (
    keys: string[],
    callback?: (error: Error | null, result: boolean) => void,
  ) => void;
  getKeys?: (callback: (error: Error | null, keys: string[]) => void) => void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface TelegramHapticFeedback {
  impactOccurred: (
    style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
  ) => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      is_bot?: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  bottomBarColor?: string;
  isClosingConfirmationEnabled?: boolean;
  isVerticalSwipesEnabled?: boolean;
  isFullscreen?: boolean;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;

  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;
  CloudStorage?: TelegramCloudStorage;

  ready: () => void;
  expand: () => void;
  close: () => void;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  lockOrientation?: () => void;
  unlockOrientation?: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  checkHomeScreenStatus?: (callback: (status: HomeScreenStatus) => void) => void;
  addToHomeScreen?: () => void;
  onEvent?: (eventType: string, eventHandler: (...args: any[]) => void) => void;
  offEvent?: (eventType: string, eventHandler: (...args: any[]) => void) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp || null;
}

