import { useApp } from '../../state/store';
import { getUserRank } from '../../lib/constants';
import { Star, IconHeadphones, IconSparkles } from '../ui';
import { useToast } from '../Toast';
import { haptic } from '../../lib/theme';
import { UserAvatar } from '../UserAvatar';

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

  // 4. Статус Telegram Premium
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

      {/* ──────────────── ЛЕВАЯ КОЛОНКА: Крупный круглый юзерпик SWR ──────────────── */}
      <div className="relative w-20 h-20 flex-shrink-0">
        <UserAvatar
          size="lg"
          alt={displayName}
          isPremium={isPremium}
          customName={displayName}
        />
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
            zIndex: 15,
          }}
        >
          {rank.tag}
        </div>
      </div>

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
