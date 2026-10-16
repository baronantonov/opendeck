import { useState, useMemo } from 'react';
import { useApp } from '../../state/store';
import { getUserRank } from '../../lib/constants';
import { Star, IconHeadphones, IconSparkles } from '../ui';
import { useToast } from '../Toast';
import { haptic } from '../../lib/theme';

/**
 * Тип пользователя из официального Telegram Web App SDK.
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
 * Безопасное чтение данных пользователя напрямую из window.Telegram.WebApp.initDataUnsafe.
 */
export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null;
  const tw = (window as any).Telegram?.WebApp;
  return (tw?.initDataUnsafe?.user as TelegramUser) || null;
}

/**
 * Скелетон двухколоночного профиля (Zero CLS, плавная пульсация).
 */
export function ProfileHeroCardSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderRadius: 22,
        background: 'var(--color-surface)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Левая колонка: скелетон крупного юзерпика */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      />

      {/* Правая колонка: скелетон текстовых строк и бейджей */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: '65%', height: 18, borderRadius: 6, background: 'rgba(255, 255, 255, 0.12)' }} />
        <div style={{ width: '40%', height: 13, borderRadius: 4, background: 'rgba(255, 255, 255, 0.06)' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <div style={{ width: 68, height: 24, borderRadius: 99, background: 'rgba(255, 255, 255, 0.08)' }} />
          <div style={{ width: 84, height: 24, borderRadius: 99, background: 'rgba(255, 255, 255, 0.08)' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Крупный круглый юзерпик пользователя Telegram с гарантированным fallback.
 */
function LargeUserpic({
  photoUrl,
  displayName,
  isPremium,
  rankTag,
}: {
  photoUrl: string;
  displayName: string;
  isPremium: boolean;
  rankTag: string;
}) {
  const [imgError, setImgError] = useState(false);

  // Вычисление 1-2 букв инициалов
  const initials = useMemo(() => {
    const parts = (displayName || 'DJ').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || 'D').toUpperCase();
  }, [displayName]);

  const hasValidPhoto = Boolean(photoUrl && !imgError);

  return (
    <div
      style={{
        position: 'relative',
        width: 80,
        height: 80,
        flexShrink: 0,
      }}
    >
      {/* Крупный круглый аватар */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          background: hasValidPhoto
            ? '#161817'
            : 'linear-gradient(135deg, var(--brand-mauve) 0%, color-mix(in srgb, var(--brand-mint) 45%, var(--brand-mauve)) 100%)',
          border: '2.5px solid color-mix(in srgb, var(--brand-mint) 55%, rgba(255, 255, 255, 0.15))',
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 0 16px -2px color-mix(in srgb, var(--brand-mint) 25%, transparent)',
          userSelect: 'none',
        }}
      >
        {hasValidPhoto ? (
          <img
            src={photoUrl}
            alt={displayName}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1d1f1e',
              fontWeight: 900,
              fontSize: initials.length > 1 ? 24 : 28,
              letterSpacing: '-0.5px',
            }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Бейдж Telegram Premium (правый верхний угол) */}
      {isPremium && (
        <div
          title="Telegram Premium"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            border: '2px solid var(--color-surface, #1e201f)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.45)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
      )}

      {/* Бейдж уровня DJ (нижний край по центру) */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--brand-mint)',
          color: '#11322a',
          fontSize: 9.5,
          fontWeight: 800,
          padding: '2px 7px',
          borderRadius: 99,
          border: '1.5px solid var(--color-surface, #1e201f)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {rankTag}
      </div>
    </div>
  );
}

/**
 * Двухколоночный макет карточки «Профиль»:
 * Слева: крупный круглый юзерпик из Telegram (с fallback и Premium-индикатором).
 * Справа: структурированная бизнес-информация из SQLite БД.
 */
export function ProfileHeroCard() {
  const { user, course, isPaid, loading } = useApp();
  const { toast } = useToast();

  // 1. Получение нативных данных Telegram SDK
  const tgUser = getTelegramUser();

  // 2. Сборка полного имени
  const firstName = tgUser?.first_name || user.name || 'DJ';
  const lastName = tgUser?.last_name || user.lastName || '';
  const displayName = lastName ? `${firstName} ${lastName}` : firstName;

  // 3. Юзернейм
  const username = tgUser?.username || user.username || '';
  const usernameDisplay = username ? `@${username}` : tgUser?.id ? `ID: ${tgUser.id}` : '';

  // 4. Аватар (приоритет Telegram SDK -> кэш БД -> пусто)
  const photoUrl = tgUser?.photo_url || user.photoUrl || '';
  const isPremium = Boolean(tgUser?.is_premium || user.isPremium);

  // 5. Бизнес-метрики из SQLite БД
  const groovePoints = user.groovePoints ?? 0;
  const rank = getUserRank(groovePoints);
  const dc = course.completedLessons.length;
  const tc = 6;
  const archetype = user.archetype || 'Куратор Вайба';

  // Скопировать реферальный код
  const copyReferral = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('medium');
    const code = user.referralCode || 'opendeck';
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(code);
      toast('✓', `Код скопирован: ${code}`);
    } else {
      toast('✓', `Твой код: ${code}`);
    }
  };

  if (loading) {
    return <ProfileHeroCardSkeleton />;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderRadius: 22,
        background: 'var(--color-surface)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 30px -10px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Декоративный световой блик в углу карточки */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -24,
          right: -24,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-mint) 15%, transparent) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ──────────────── ЛЕВАЯ КОЛОНКА: Крупный круглый юзерпик ──────────────── */}
      <LargeUserpic
        photoUrl={photoUrl}
        displayName={displayName}
        isPremium={isPremium}
        rankTag={rank.tag}
      />

      {/* ──────────────── ПРАВАЯ КОЛОНКА: Бизнес-информация из БД ──────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {/* Имя пользователя + Статус PRO/Free */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1.25,
              color: 'var(--color-text)',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {displayName}
          </h2>

          {isPaid ? (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: 'var(--brand-mint)',
                background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)',
                padding: '2px 6px',
                borderRadius: 5,
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
                background: 'rgba(255, 255, 255, 0.06)',
                padding: '2px 6px',
                borderRadius: 5,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {dc}/{tc} ур.
            </span>
          )}
        </div>

        {/* Telegram @username + Архетип */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--color-text-dim)',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {usernameDisplay ? (
            <span style={{ color: 'var(--brand-mint)', fontWeight: 600 }}>
              {usernameDisplay}
            </span>
          ) : (
            <span>Резидент школы</span>
          )}
          <span>•</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {archetype}
          </span>
        </div>

        {/* Сетка бизнес-метрик (Бейджи из SQLite БД) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 2,
          }}
        >
          {/* 1. Баланс Groove Points (GP) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'color-mix(in srgb, var(--brand-gold) 14%, var(--color-surface))',
              border: '1px solid color-mix(in srgb, var(--brand-gold) 28%, transparent)',
              padding: '3px 8px',
              borderRadius: 99,
            }}
          >
            <Star size={12} />
            <b style={{ fontSize: 12, color: 'var(--brand-gold)' }}>
              {groovePoints} GP
            </b>
          </div>

          {/* 2. Ранг в школе диджеинга */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '3px 8px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            <IconHeadphones size={12} color="var(--brand-mauve)" />
            <span>{rank.title}</span>
          </div>

          {/* 3. Реферальный код (быстрый тап для копирования) */}
          {user.referralCode && (
            <button
              type="button"
              onClick={copyReferral}
              title="Нажми, чтобы скопировать код"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                padding: '3px 8px',
                borderRadius: 99,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--brand-mint)',
                cursor: 'pointer',
              }}
            >
              <IconSparkles size={11} color="var(--brand-mint)" />
              <span>{user.referralCode}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
