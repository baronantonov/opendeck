import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../../state/store';
import { getUserRank, type RankDef } from '../../lib/constants';
import { haptic } from '../../lib/theme';
import { getTelegramWebApp } from '../../types';
import { GpGlowBadge } from '../MotionWrappers';
import { UserAvatar } from '../UserAvatar';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export function getTelegramWebAppData(): {
  user: TelegramUser | null;
  initData: string;
} {
  if (typeof window === 'undefined') {
    return { user: null, initData: '' };
  }
  const tw = getTelegramWebApp();
  const initData = tw?.initData || '';
  const user = (tw?.initDataUnsafe?.user as TelegramUser | undefined) || null;
  return { user, initData };
}

export function useProfileWidgetData() {
  const { user, course, isPaid, loading } = useApp();
  const { user: tgUser, initData } = getTelegramWebAppData();

  const firstName = tgUser?.first_name || user.name || 'DJ';
  const lastName = tgUser?.last_name || user.lastName || '';
  const displayName = lastName ? `${firstName} ${lastName}` : firstName;

  const rawUsername = tgUser?.username || user.username || '';
  const usernameDisplay = rawUsername ? `@${rawUsername}` : tgUser?.id ? `id: ${tgUser.id}` : '';

  const photoUrl = tgUser?.photo_url || user.photoUrl || '';
  const isPremium = Boolean(tgUser?.is_premium || user.isPremium);

  const groovePoints = user.groovePoints ?? 0;
  const rank: RankDef = getUserRank(groovePoints);

  const completedCount = course.completedLessons.length;
  const totalCount = COURSE_LESSONS.length;

  return {
    loading,
    displayName,
    firstName,
    lastName,
    usernameDisplay,
    photoUrl,
    isPremium,
    groovePoints,
    archetype: user.archetype || 'Куратор Вайба',
    rank,
    isPaid,
    completedCount,
    totalCount,
    hasValidInitData: Boolean(initData),
  };
}

export function ProfileWidgetSkeleton() {
  return (
    <div
      className="animate-pulse flex items-center gap-3 rounded-3xl px-4 py-3.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.4)]"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 78%, rgba(20, 24, 23, 0.84))',
      }}
    >
      <div className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3.5 w-28 rounded-md bg-white/10" />
        <div className="h-3 w-20 rounded-md bg-white/5" />
      </div>
      <div className="h-7 w-20 rounded-full bg-white/10" />
    </div>
  );
}

/**
 * Компактный стеклянный статус-бар пользователя для Главного экрана:
 * UserAvatar (SWR), приветствие, стеклянный бейдж прогресса X / 10 и баланс GP.
 */
export function ProfileWidget({ onClick }: { onClick?: () => void }) {
  const nav = useNavigate();
  const data = useProfileWidgetData();

  if (data.loading) {
    return <ProfileWidgetSkeleton />;
  }

  const handleClick = () => {
    haptic('light');
    if (onClick) {
      onClick();
    } else {
      nav('/profile');
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      className="relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-3xl px-4 py-3.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.42)] select-none active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 78%, rgba(20, 24, 23, 0.84))',
      }}
    >
      <AbstractGeometryBg variant="card" spheres={0} accent="mint" />

      {/* 1. Аватар Telegram Stale-While-Revalidate (SWR) */}
      <div className="relative z-10 shrink-0">
        <UserAvatar
          size="sm"
          alt={data.displayName}
          isPremium={data.isPremium}
          customName={data.displayName}
        />
      </div>

      {/* 2. Приветствие и ранг резидента */}
      <div className="relative z-10 min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-extrabold leading-tight text-[var(--color-text)]">
            Привет, {data.firstName}
          </span>
          {data.isPaid && (
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-mint) 16%, transparent)',
              }}
            >
              PRO
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--color-text-dim)]">
          <span className="font-semibold text-[var(--brand-mint)]">
            {data.rank.title}
          </span>
          <span>•</span>
          <span className="truncate">{data.archetype}</span>
        </div>
      </div>

      {/* 3. Бейдж прогресса X / 10 + баланс GP */}
      <div className="relative z-10 flex shrink-0 flex-col items-end justify-center gap-1.5">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold text-[var(--color-text)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface-2) 78%, transparent)',
          }}
        >
          <span
            className="animate-organic-pulse inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: 'var(--brand-mint)',
              boxShadow: '0 0 8px var(--brand-mint)',
            }}
          />
          <span>
            {data.completedCount} / {data.totalCount}
          </span>
        </div>

        <GpGlowBadge points={data.groovePoints} className="px-2 py-0.5 text-[11px]" />
      </div>
    </div>
  );
}
