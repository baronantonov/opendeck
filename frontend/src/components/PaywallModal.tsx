import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  CheckCircle2,
  Headphones,
  Sliders,
  Users,
  Gift,
  ShieldCheck,
} from 'lucide-react';
import { haptic } from '../lib/theme';
import { useRegisterModal } from '../lib/navigation';
import { useStarsCheckout } from '../payment/Paywall';
import { ShimmerButton } from './MotionWrappers';
import { AbstractGeometryBg } from './LiquidGlassGeometry';
import { GiftCourseModal } from './GiftCourseModal';

export interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  courseId?: string;
  /** Заголовок контекста (например, после завершения 2-го урока) */
  subtitle?: string;
}

/**
 * Модальное окно пейвола «Pocket DJ» в стиле темного Liquid Glass
 * с глубоким матовым размытием (backdrop-blur-2xl), внутренним бликом,
 * деликатной абстрактной геометрией и пружинящим открытием.
 */
export function PaywallModal({
  open,
  onClose,
  courseId = 'dj-basics',
  subtitle = 'Полный доступ · Pocket DJ',
}: PaywallModalProps) {
  const { checkoutCourse, busy } = useStarsCheckout();
  const [giftOpen, setGiftOpen] = useState(false);

  useRegisterModal('paywall-modal', open, () => {
    if (!busy) {
      onClose();
    }
  });

  useEffect(() => {
    if (!open) return;
    haptic('light');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onClose]);

  if (!open) {
    return (
      <GiftCourseModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        courseId={courseId}
        courseTitle="Pocket DJ"
        priceStars={2500}
      />
    );
  }

  const handleClose = () => {
    if (busy) return;
    haptic('light');
    onClose();
  };

  const handleBuy = async () => {
    if (busy) return;
    haptic('light');
    await checkoutCourse(courseId);
    onClose();
  };

  const handleOpenGift = () => {
    if (busy) return;
    haptic('light');
    onClose();
    setGiftOpen(true);
  };

  const content = (
    <div
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Открыть полный курс Pocket DJ"
      className="fixed inset-0 z-[260] flex items-end justify-center bg-black/70 p-0 backdrop-blur-xl transition-opacity duration-200 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-spring relative w-full max-w-[480px] overflow-hidden rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,16px)+20px)] text-[var(--color-text)] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_-16px_48px_rgba(0,0,0,0.68)] transform-gpu select-none"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        <AbstractGeometryBg variant="modal" spheres={1} accent="mint" />

        {/* Индикатор шторки */}
        <div className="relative z-10 mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {/* Шапка модалки */}
        <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-coral) 16%, var(--color-surface-2))',
              }}
            >
              <Sparkles size={12} />
              <span>{subtitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <Headphones size={22} className="shrink-0 text-[var(--brand-mint)]" />
              <h2 className="m-0 text-xl font-extrabold tracking-tight text-[var(--color-text)]">
                Pocket DJ · 10 уроков
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--color-text-dim)] backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-2) 75%, transparent)',
            }}
          >
            <X size={18} strokeWidth={2.3} />
          </button>
        </div>

        <p className="relative z-10 m-0 mb-4 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
          Ты прошёл бесплатную базу! Разблокируй все 10 практических уроков сведения, тренажер Rekordbox и закрытый клуб резидентов Open Deck.
        </p>

        {/* Триггеры ценности в стеклянном контейнере */}
        <div
          className="relative z-10 mb-5 flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{ background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)' }}
            >
              <CheckCircle2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-[var(--color-text)]">
                Все 10 уроков «Pocket DJ»
              </div>
              <div className="text-xs text-[var(--color-text-dim)]">
                Музыкальная теория, Камелот, BPM, Sync, кроссфейдер, лупы и финальный микс.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{ background: 'color-mix(in srgb, var(--brand-coral) 15%, transparent)' }}
            >
              <Users size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-[var(--color-text)]">
                Доступ в закрытое «Племя» (DJ Camp)
              </div>
              <div className="text-xs text-[var(--color-text-dim)]">
                Закрытый чат студентов, разборы твоих первых сетов и поддержка кураторов.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{ background: 'color-mix(in srgb, var(--brand-gold) 15%, transparent)' }}
            >
              <Sliders size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-[var(--color-text)]">
                Практика на DJ-деке + Groove Points
              </div>
              <div className="text-xs text-[var(--color-text-dim)]">
                +50 GP за каждый урок (до −$50 скидки на личное менторство с FREEDA DJ).
              </div>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="relative z-10 flex flex-col gap-2.5">
          <ShimmerButton
            variant="mint"
            block
            shimmer
            hapticFeedback="light"
            disabled={busy}
            onClick={handleBuy}
            className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
          >
            <Sparkles size={18} />
            <span>
              {busy ? 'Открываем Telegram Stars...' : 'Открыть курс · 2 500 Stars'}
            </span>
          </ShimmerButton>

          <button
            type="button"
            onClick={handleOpenGift}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              background: 'color-mix(in srgb, var(--brand-coral) 14%, var(--color-surface-2))',
            }}
          >
            <Gift size={18} />
            <span>Подарить курс</span>
          </button>

          <div className="mt-1 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[var(--color-text-dim)]">
            <ShieldCheck size={14} className="text-[var(--brand-mint)]" />
            <span>Мгновенное открытие доступа через Telegram Stars</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(content, document.body) : content}
      <GiftCourseModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        courseId={courseId}
        courseTitle="Pocket DJ"
        priceStars={2500}
      />
    </>
  );
}

export default PaywallModal;
