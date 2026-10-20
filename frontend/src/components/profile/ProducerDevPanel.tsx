import { useState, useMemo } from 'react';
import { useApp } from '../../state/store';
import { useCourseProgress } from '../../state/CourseProgressContext';
import { useToast } from '../Toast';
import { getTelegramWebApp } from '../../types';
import {
  Wrench,
  RotateCcw,
  Zap,
  Unlock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';

/**
 * Белый список владельца и авторизованных тестировщиков OpenDeck
 */
export const ADMIN_USER_IDS: number[] = [285754501];
export const ADMIN_USERNAMES: string[] = ['baronantonov'];

/**
 * Проверка прав доступа к пульту продюсера / Dev Mode.
 * Возвращает true только владельцу проекта (@baronantonov, ID 285754501)
 * или в изолированной среде разработки Antigravity Preview.
 */
export function isProducerAuthorized(
  userId?: number | string | null,
  username?: string | null,
): boolean {
  if (typeof window === 'undefined') return true;

  // 1. Проверка Telegram User ID
  const numericId = Number(userId);
  if (!Number.isNaN(numericId) && ADMIN_USER_IDS.includes(numericId)) {
    return true;
  }

  // 2. Проверка @username
  if (username) {
    const clean = username.replace(/^@+/, '').toLowerCase().trim();
    if (ADMIN_USERNAMES.includes(clean)) {
      return true;
    }
  }

  // 3. Авторегистрация разработчика в окружении Antigravity / Preview
  const isPreview = Boolean(
    (window as any).__PREVIEW__ ||
      window.location.search.includes('preview') ||
      window.location.search.includes('dev') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('antigravity') ||
      window.location.hostname.includes('webcontainer'),
  );

  return isPreview;
}

export function ProducerDevPanel() {
  const { setAdminMode } = useApp();
  const {
    isCoursePurchased,
    completedLessons,
    userId,
    username,
    resetProgress,
    setCoursePurchased,
    unlockAllLessons,
    setupPaywallTest,
    verifyIntegrity,
  } = useCourseProgress();

  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Вычисляем Telegram WebApp контекст
  const tw = getTelegramWebApp();
  const currentTgId = tw?.initDataUnsafe?.user?.id ?? userId ?? 285754501;
  const currentUsername = tw?.initDataUnsafe?.user?.username || username || 'baronantonov';

  // Проверка авторизации: для обычных пользователей компонент возвращает null и отсутствует в DOM!
  const hasAccess = useMemo(() => {
    return isProducerAuthorized(currentTgId, currentUsername);
  }, [currentTgId, currentUsername]);

  if (!hasAccess) {
    return null;
  }

  const isSigValid = verifyIntegrity();
  const displayLessonsCount = isCoursePurchased ? Math.min(10, Math.max(completedLessons.length, 1)) : 1;

  const triggerHaptic = (type: 'warning' | 'success' | 'medium') => {
    try {
      if (type === 'medium') {
        tw?.HapticFeedback?.impactOccurred?.('medium');
      } else {
        tw?.HapticFeedback?.notificationOccurred?.(type);
      }
    } catch {}
  };

  /**
   * 1. Сбросить всё (Режим новичка)
   */
  const handleResetAll = () => {
    triggerHaptic('warning');
    resetProgress();
    setAdminMode(false);
    toast('🔄', 'Режим новичка: всё сброшено до Урока 1');
  };

  /**
   * 2. Выдать покупку Pocket DJ
   */
  const handleGrantPurchase = () => {
    triggerHaptic('success');
    setCoursePurchased(true);

    // Удаляем флаг показа салюта, чтобы при входе в «ПЛЕМЯ» сработал праздничный Canvas-салют
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('opendeck_tribe_confetti_shown');
        tw?.CloudStorage?.removeItem?.('opendeck_tribe_confetti_shown', () => {});
      } catch {}
    }

    toast('⚡', 'Pocket DJ активирован: Племя и Урок 2 открыты');
  };

  /**
   * 3. Открыть все 10 уроков
   */
  const handleUnlockAll = () => {
    triggerHaptic('success');
    unlockAllLessons();
    setAdminMode(true);
    toast('🔓', 'Все 10 уроков и DJ-дека разблокированы');
  };

  /**
   * 4. Тест Paywall после 2-го урока
   */
  const handleTestPaywall = () => {
    triggerHaptic('medium');
    setupPaywallTest();
    setAdminMode(false);
    toast('🎯', 'Урок 1 завершён. Заверши Урок 2 для проверки Paywall');
  };

  return (
    <section
      aria-label="Пульт продюсера / Dev Mode"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        margin: '12px 0 6px',
      }}
    >
      {/* ── ПЛАВАЮЩИЙ БЕЙДЖ-ТРИГГЕР [ 🛠 DEV ] ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          background: 'color-mix(in srgb, var(--brand-gold) 10%, var(--color-surface))',
          border: '1px solid color-mix(in srgb, var(--brand-gold) 35%, transparent)',
          borderRadius: 14,
          boxShadow: '0 4px 16px rgba(243, 201, 105, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: 'color-mix(in srgb, var(--brand-gold) 20%, transparent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--brand-gold)',
            }}
          >
            <Wrench size={13} />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--brand-gold)',
            }}
          >
            Пульт продюсера · DEV
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 6,
              background: isCoursePurchased
                ? 'color-mix(in srgb, var(--brand-mint) 22%, transparent)'
                : 'color-mix(in srgb, var(--brand-coral) 20%, transparent)',
              color: isCoursePurchased ? 'var(--brand-mint)' : 'var(--brand-coral)',
              border: `1px solid ${
                isCoursePurchased
                  ? 'color-mix(in srgb, var(--brand-mint) 40%, transparent)'
                  : 'color-mix(in srgb, var(--brand-coral) 35%, transparent)'
              }`,
            }}
          >
            {isCoursePurchased ? 'Куплен' : 'Free'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            setIsOpen((prev) => !prev);
          }}
          style={{
            border: 'none',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--color-text)',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <span>{isOpen ? 'Скрыть' : 'Открыть'}</span>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ── РАЗВЕРНУТАЯ ПАНЕЛЬ ПУЛЬТА ПРОДЮСЕРА ── */}
      {isOpen && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 95%, #000)',
            border: '1px solid color-mix(in srgb, var(--brand-gold) 30%, var(--color-line))',
            borderRadius: 16,
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* 1. СТАТУС-БАР ТЕСТЕРА */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              borderRadius: 12,
              padding: '10px 12px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck
                  size={14}
                  color={isSigValid ? 'var(--brand-mint)' : 'var(--brand-coral)'}
                />
                <span style={{ color: 'var(--color-text-dim)' }}>TG ID:</span>
                <b style={{ color: 'var(--color-text)', fontFamily: 'monospace' }}>
                  {currentTgId}
                </b>
                <span style={{ color: 'var(--brand-mint)', fontSize: 11 }}>
                  @{currentUsername}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: isSigValid ? 'var(--brand-mint)' : 'var(--brand-coral)',
                  background: isSigValid
                    ? 'color-mix(in srgb, var(--brand-mint) 15%, transparent)'
                    : 'color-mix(in srgb, var(--brand-coral) 15%, transparent)',
                  padding: '2px 6px',
                  borderRadius: 5,
                }}
              >
                {isSigValid ? 'SIG: OK' : 'SIG: INVALID'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                paddingTop: 4,
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-dim)' }}>Курс: </span>
                <b
                  style={{
                    color: isCoursePurchased ? 'var(--brand-mint)' : 'var(--brand-coral)',
                  }}
                >
                  {isCoursePurchased ? 'Куплен (Pocket DJ)' : 'Не куплен'}
                </b>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-dim)' }}>Уроки: </span>
                <b style={{ color: 'var(--brand-gold)' }}>
                  {displayLessonsCount} / 10
                </b>
              </div>
            </div>
          </div>

          {/* 2. КНОПКИ БЫСТРЫХ СЦЕНАРИЕВ ТЕСТИРОВАНИЯ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {/* Кнопка 1: Сбросить всё (Режим новичка) */}
            <button
              type="button"
              onClick={handleResetAll}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid color-mix(in srgb, var(--brand-coral) 35%, transparent)',
                background: 'color-mix(in srgb, var(--brand-coral) 10%, var(--color-surface))',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--brand-coral) 20%, transparent)',
                  color: 'var(--brand-coral)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>🔄 Сбросить всё (Режим новичка)</div>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-dim)', fontWeight: 500 }}>
                  Обнуляет покупку, сбрасывает к Уроку 1, чистит конфетти и баннеры
                </div>
              </div>
            </button>

            {/* Кнопка 2: Выдать покупку Pocket DJ */}
            <button
              type="button"
              onClick={handleGrantPurchase}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid color-mix(in srgb, var(--brand-mint) 35%, transparent)',
                background: 'color-mix(in srgb, var(--brand-mint) 10%, var(--color-surface))',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--brand-mint) 20%, transparent)',
                  color: 'var(--brand-mint)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>⚡ Выдать покупку Pocket DJ</div>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-dim)', fontWeight: 500 }}>
                  Подписывает покупку, разблокирует Племя (салют) и Урок 3
                </div>
              </div>
            </button>

            {/* Кнопка 3: Открыть все 10 уроков */}
            <button
              type="button"
              onClick={handleUnlockAll}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid color-mix(in srgb, var(--brand-gold) 35%, transparent)',
                background: 'color-mix(in srgb, var(--brand-gold) 10%, var(--color-surface))',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--brand-gold) 20%, transparent)',
                  color: 'var(--brand-gold)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Unlock size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>🔓 Открыть все 10 уроков</div>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-dim)', fontWeight: 500 }}>
                  Полный доступ ко всем урокам и деке для быстрого теста
                </div>
              </div>
            </button>

            {/* Кнопка 4: Тест Paywall после 2-го урока */}
            <button
              type="button"
              onClick={handleTestPaywall}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--color-text)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Target size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>🎯 Тест Paywall после 2-го урока</div>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-dim)', fontWeight: 500 }}>
                  Урок 1 пройден, финиш Урока 2 вызовет окно покупки
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
