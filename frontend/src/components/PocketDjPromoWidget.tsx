import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { useStarsCheckout } from '../payment/Paywall';
import { haptic } from '../lib/theme';
import {
  Gift,
  Play,
  Sparkles,
  CheckCircle2,
  Headphones,
  Sliders,
  Users,
  Zap,
} from 'lucide-react';
import { ShimmerButton } from './MotionWrappers';
import { GiftCourseModal } from './GiftCourseModal';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

export interface PocketDjPromoWidgetProps {
  className?: string;
  style?: React.CSSProperties;
  badgeText?: string;
}

/**
 * Флагманский Hero-виджет «Pocket DJ» в стиле Liquid Glass
 * с дрейфующей абстрактной геометрией, триггерами ценности (10 уроков + закрытый Camp),
 * главной кнопкой «Открыть курс» с переливающимся бликом и вторичной кнопкой «Подарить курс».
 */
export function PocketDjPromoWidget({
  className = '',
  style,
  badgeText,
}: PocketDjPromoWidgetProps) {
  const nav = useNavigate();
  const { isPaid, adminMode, course } = useApp();
  const { checkoutCourse, busy: checkoutBusy } = useStarsCheckout();
  const [giftOpen, setGiftOpen] = useState(false);

  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const nextLessonIndex = Math.min(dc, tc - 1);
  const nextId = nextLessonIndex + 1;
  const isCourseFinished = dc >= tc;
  const hasAccess = isPaid || adminMode;

  const handlePrimaryClick = () => {
    haptic('light');
    if (!hasAccess) {
      nav('/learn');
    } else {
      nav('/learn');
    }
  };

  const handleQuickBuy = () => {
    haptic('light');
    void checkoutCourse('dj-basics');
  };

  const handleGiftClick = () => {
    haptic('light');
    setGiftOpen(true);
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-3xl p-5 text-[var(--color-text)] select-none backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_40px_rgba(0,0,0,0.48)] ${className}`}
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          ...style,
        }}
      >
        {/* Многослойная фоновая графика: SVG mesh (opacity-[0.07]) + 2 плавно дрейфующие GPU-сферы */}
        <AbstractGeometryBg variant="hero" spheres={2} accent="mint" />

        {/* Декоративный контур винила (без пересветов, на заднем плане) */}
        <div
          className="animate-spin-vinyl pointer-events-none absolute -right-16 -top-16 h-52 w-52 opacity-[0.12] transform-gpu"
          aria-hidden="true"
          style={{ zIndex: 0 }}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx="100" cy="100" r="94" fill="none" stroke="var(--brand-mint)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="76" fill="none" stroke="var(--brand-mauve)" strokeWidth="1" />
            <circle cx="100" cy="100" r="56" fill="none" stroke="var(--brand-mint)" strokeWidth="1" strokeDasharray="6 8" />
            <circle cx="100" cy="100" r="30" fill="var(--brand-mint)" fillOpacity="0.35" />
            <circle cx="100" cy="100" r="8" fill="#181c1b" />
          </svg>
        </div>

        {/* Основной контент Hero-виджета */}
        <div className="relative z-10 flex w-full flex-col gap-4">
          {/* Верхняя строка статуса */}
          <div className="flex items-center justify-between gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-mint) 14%, var(--color-surface-2))',
              }}
            >
              <span
                className="animate-organic-pulse inline-block h-2 w-2 rounded-full"
                style={{
                  background: 'var(--brand-mint)',
                  boxShadow: '0 0 8px var(--brand-mint)',
                }}
              />
              <span>
                {badgeText || (hasAccess ? 'PRO ДОСТУП · АКТИВЕН' : 'ФЛАГМАНСКИЙ КУРС')}
              </span>
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-gold) 14%, var(--color-surface-2))',
              }}
            >
              2 500 Stars
            </span>
          </div>

          {/* Заголовок и ценностный оффер */}
          <div>
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-mint) 16%, var(--color-surface-2))',
                }}
              >
                <Headphones size={20} />
              </div>
              <div>
                <h2 className="m-0 text-2xl font-extrabold tracking-tight text-[var(--color-text)]">
                  Pocket DJ
                </h2>
                <div className="text-xs font-semibold text-[var(--brand-mint)]">
                  10 уроков • Смартфон + Rekordbox
                </div>
              </div>
            </div>

            <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
              Пошаговая система от первого бита до сведения собственного клубного сета из 4–5 треков прямо на телефоне.
            </p>
          </div>

          {/* Триггеры ценности в матовой капсуле */}
          <div
            className="flex flex-col gap-2.5 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
            }}
          >
            <div className="flex items-center gap-2.5 text-xs">
              <CheckCircle2 size={16} className="shrink-0 text-[var(--brand-mint)]" />
              <span className="text-[var(--color-text-dim)]">
                <b className="text-[var(--color-text)]">10 последовательных уроков</b>: от интерфейса до финального микса
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <Users size={16} className="shrink-0 text-[var(--brand-coral)]" />
              <span className="text-[var(--color-text-dim)]">
                <b className="text-[var(--color-text)]">Доступ в закрытый Camp</b>: комьюнити и разбор твоих сетов
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <Sliders size={16} className="shrink-0 text-[var(--brand-mint)]" />
              <span className="text-[var(--color-text-dim)]">
                <b className="text-[var(--color-text)]">Виртуальная DJ-дека</b>: практика на двух деках A/B в реальном времени
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <Zap size={16} className="shrink-0 text-[var(--brand-gold)]" />
              <span className="text-[var(--color-text-dim)]">
                <b className="text-[var(--color-text)]">2 вводных урока бесплатно</b> + бонусные GP на менторство
              </span>
            </div>
          </div>

          {/* Кнопки действий (калибровка 8pt: h-13 / py-3.5, rounded-2xl, text-base font-bold) */}
          <div className="flex flex-col gap-2.5 pt-0.5">
            <ShimmerButton
              variant="mint"
              block
              shimmer
              hapticFeedback="light"
              disabled={checkoutBusy}
              onClick={hasAccess ? handlePrimaryClick : handlePrimaryClick}
              className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
            >
              {hasAccess ? (
                isCourseFinished ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Открыть курс · Все уроки</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    <span>Открыть курс · Урок {nextId}</span>
                  </>
                )
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  <span>Открыть курс</span>
                </>
              )}
            </ShimmerButton>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {!hasAccess && (
                <button
                  type="button"
                  disabled={checkoutBusy}
                  onClick={handleQuickBuy}
                  className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-base font-bold text-[var(--color-text)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                  style={{
                    background: 'color-mix(in srgb, var(--color-surface-2) 78%, transparent)',
                  }}
                >
                  <Sparkles size={17} className="text-[var(--brand-gold)]" />
                  <span>{checkoutBusy ? 'Открываем Stars...' : 'Полный доступ · 2 500 ★'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleGiftClick}
                className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-base font-bold text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                style={{
                  background: 'color-mix(in srgb, var(--brand-coral) 14%, var(--color-surface-2))',
                }}
              >
                <Gift size={18} />
                <span>Подарить курс</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <GiftCourseModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        courseId="dj-basics"
        courseTitle="Pocket DJ"
        priceStars={2500}
      />
    </>
  );
}
