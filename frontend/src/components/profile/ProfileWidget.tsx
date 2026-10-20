import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/store';
import { getUserRank, type RankDef } from '../../lib/constants';
import { haptic } from '../../lib/theme';
import { GpGlowBadge } from '../MotionWrappers';

/**
 * Тип данных пользователя, возвращаемый официальным Telegram WebApp SDK.
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Безопасное чтение данных пользователя напрямую из Telegram Web App SDK.
 */
export function getTelegramWebAppData(): {
  user: TelegramUser | null;
  initData: string;
} {
  if (typeof window === 'undefined') {
    return { user: null, initData: '' };
  }
  const tw = (window as any).Telegram?.WebApp;
  const initData = tw?.initData || '';
  const user = (tw?.initDataUnsafe?.user as TelegramUser) || null;
  return { user, initData };
}

/**
 * Хук разделения ответственности (Data Hook):
 * Объединяет нативные данные сессии Telegram с проверенными бизнес-метриками из БД.
 */
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
  const totalCount = 6;

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

/**
 * Скелетон загрузки профиля (Zero CLS, плавная пульсация).
 */
export function ProfileWidgetSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 18,
        background: 'var(--color-surface)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 15,
          background: 'rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: 110, height: 14, borderRadius: 6, background: 'rgba(255, 255, 255, 0.1)' }} />
        <div style={{ width: 80, height: 11, borderRadius: 4, background: 'rgba(255, 255, 255, 0.06)' }} />
      </div>
      <div
        style={{
          width: 76,
          height: 30,
          borderRadius: 99,
          background: 'rgba(255, 255, 255, 0.08)',
        }}
      />
    </div>
  );
}

/**
 * Аватар с гарантированным фоллбэком и защитой от ошибок загрузки Telegram CDN.
 */
function ProfileAvatar({
  photoUrl,
  name,
  isPremium,
}: {
  photoUrl: string;
  name: string;
  isPremium: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  const initials = (name || 'DJ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'D';

  const showImage = Boolean(photoUrl && !imgError);

  return (
    <div
      style={{
        position: 'relative',
        width: 48,
        height: 48,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 15,
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          background: showImage
            ? '#161817'
            : 'linear-gradient(135deg, var(--brand-mauve) 0%, color-mix(in srgb, var(--brand-mint) 50%, var(--brand-mauve)) 100%)',
          color: '#1d1f1e',
          fontWeight: 800,
          fontSize: initials.length > 1 ? 16 : 19,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {showImage ? (
          <img
            src={photoUrl}
            alt={name}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Бейдж Telegram Premium */}
      {isPremium && (
        <div
          title="Telegram Premium"
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
            border: '2px solid var(--color-bg, #0f1110)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
      )}
    </div>
  );
}

/**
 * Полноценный виджет профиля для главной страницы TMA:
 * Объединяет профиль Telegram с бизнес-метриками SQLite (баланс GP, ранг, статус курса).
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 18,
        background: 'var(--color-surface)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease',
        userSelect: 'none',
      }}
      className="profile-widget glow-card-border active:scale-[0.99]"
    >
      <div className="glow-card-ambient" aria-hidden="true" />
      {/* 1. Аватар Telegram + Fallback */}
      <ProfileAvatar
        photoUrl={data.photoUrl}
        name={data.displayName}
        isPremium={data.isPremium}
      />

      {/* 2. Пользовательские метаданные (Telegram + DB) */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              color: 'var(--color-text)',
            }}
          >
            {data.displayName}
          </div>

          {/* Индикатор Pro / Доступа */}
          {data.isPaid ? (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: 'var(--brand-mint)',
                background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)',
                padding: '1px 5px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              PRO
            </span>
          ) : (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: 'var(--color-text-dim)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1px 5px',
                borderRadius: 4,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {data.completedCount}/{data.totalCount} ур.
            </span>
          )}
        </div>

        {/* Вторая строка: username + ранг DJ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 3,
            fontSize: 11.5,
            color: 'var(--color-text-dim)',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {data.usernameDisplay && (
            <span style={{ color: 'var(--brand-mint)', fontWeight: 600 }}>
              {data.usernameDisplay}
            </span>
          )}
          {data.usernameDisplay && <span>•</span>}
          <span style={{ color: 'var(--color-text-dim)', fontWeight: 500 }}>
            {data.rank.title}
          </span>
        </div>
      </div>

      {/* 3. Бизнес-метрика: Баланс Groove Points (GP) с Ambient Glow */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <GpGlowBadge points={data.groovePoints} />
        <span style={{ fontSize: 10, color: 'var(--color-text-dim)', paddingRight: 4, fontWeight: 500 }}>
          {data.archetype}
        </span>
      </div>
    </div>
  );
}
