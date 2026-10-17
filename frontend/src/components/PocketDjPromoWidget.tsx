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
  Flame,
  Zap,
} from 'lucide-react';
import { ShimmerButton } from './MotionWrappers';
import { GiftCourseModal } from './GiftCourseModal';

export interface PocketDjPromoWidgetProps {
  className?: string;
  style?: React.CSSProperties;
  /** Заголовок контекста отображения (напр. на главном экране или в обучении) */
  badgeText?: string;
}

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
    if (!hasAccess) {
      haptic('medium');
      void checkoutCourse('dj-basics');
    } else {
      haptic('medium');
      nav('/learn');
    }
  };

  const handleGiftClick = () => {
    haptic('light');
    setGiftOpen(true);
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-[22px] p-5 text-[var(--color-text)] select-none glow-card-border ${className}`}
        style={{
          background:
            'radial-gradient(circle at 88% 18%, rgba(140, 226, 200, 0.16) 0%, transparent 58%), radial-gradient(circle at 12% 85%, rgba(192, 160, 168, 0.12) 0%, transparent 60%), var(--color-surface, #2e3432)',
          boxShadow: '0 8px 30px -8px rgba(0, 0, 0, 0.45)',
          boxSizing: 'border-box',
          width: '100%',
          ...style,
        }}
      >
        {/* ── ДЕКОРАТИВНЫЙ ФОНОВЫЙ ВИНИЛ (МЕДЛЕННОЕ ВРАЩЕНИЕ 60 FPS) ── */}
        <div
          className="absolute -right-16 -top-16 w-56 h-56 pointer-events-none opacity-20 animate-spin-vinyl"
          aria-hidden="true"
          style={{ zIndex: 0 }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <defs>
              <radialGradient id="promo-vinyl-grooves" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#8ce2c8" stopOpacity="0.4" />
                <stop offset="25%" stopColor="#2b302e" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8ce2c8" stopOpacity="0.2" />
                <stop offset="75%" stopColor="#2b302e" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#8ce2c8" stopOpacity="0.3" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="96" fill="#111" stroke="var(--brand-mint)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="90" fill="url(#promo-vinyl-grooves)" />
            <circle cx="100" cy="100" r="76" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <circle cx="100" cy="100" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Яблоко пластинки */}
            <circle cx="100" cy="100" r="34" fill="var(--brand-mint)" />
            <circle cx="100" cy="100" r="8" fill="#111" />
          </svg>
        </div>

        {/* ── ОСНОВНОЙ КОНТЕНТ КАРТОЧКИ ── */}
        <div className="relative z-10 flex flex-col gap-3.5 w-full">
          {/* Верхняя строка статуса */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--brand-mint)',
                  boxShadow: '0 0 8px var(--brand-mint)',
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: 'var(--brand-mint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {badgeText || (hasAccess ? 'PRO ДОСТУП · АКТИВЕН' : 'БАЗОВЫЙ КУРС СВЕДЕНИЯ')}
              </span>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--brand-gold)',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(243, 201, 105, 0.25)',
                padding: '2px 8px',
                borderRadius: 99,
              }}
            >
              2 500 Stars
            </span>
          </div>

          {/* Заголовок курса */}
          <div>
            <div className="flex items-center gap-2">
              <Headphones size={22} color="var(--brand-mint)" className="shrink-0" />
              <h2
                style={{
                  fontSize: 22,
                  margin: 0,
                  fontWeight: 800,
                  letterSpacing: '-0.3px',
                  color: 'var(--color-text)',
                }}
              >
                Pocket DJ
              </h2>
            </div>
            <p
              style={{
                margin: '5px 0 0',
                fontSize: 13,
                color: 'var(--color-text-dim)',
                lineHeight: 1.45,
              }}
            >
              Пошаговый трек от первого бита до клубного сета из 5 треков прямо на смартфоне.
            </p>
          </div>

          {/* Продающие динамические буллиты на основе реальных уроков */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.28)',
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div className="flex items-center gap-2.5 text-[12px]">
              <CheckCircle2 size={15} color="var(--brand-mint)" className="shrink-0" />
              <span>
                <b className="text-[var(--color-text)]">6 практических уроков</b>: от первого экрана до сведения сета
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-[12px]">
              <Sliders size={15} color="var(--brand-mint)" className="shrink-0" />
              <span>
                <b className="text-[var(--color-text)]">Интерактивная DJ-дека</b> прямо в телефоне (Dual Deck A/B)
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-[12px]">
              <Zap size={15} color="var(--brand-gold)" className="shrink-0" />
              <span>
                <b className="text-[var(--color-text)]">Сведение & Sync</b>: BPM, кроссфейдер, лупы и фильтры
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-[12px]">
              <Flame size={15} color="var(--brand-coral)" className="shrink-0" />
              <span>
                <b className="text-[var(--color-text)]">Закрытый DJ Camp</b>: комьюнити и разбор миксов (с 2-го урока)
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-[12px]">
              <Sparkles size={15} color="var(--brand-mint)" className="shrink-0" />
              <span>
                <b className="text-[var(--color-text)]">4 бонусных видео</b> от FREEDA DJ: теория, колесо Камелота
              </span>
            </div>
          </div>

          {/* ── КНОПКИ ДЕЙСТВИЯ ── */}
          <div className="flex flex-col gap-2.5 pt-1">
            {/* ГЛАВНАЯ КНОПКА: ПУЛЬСИРУЮЩИЙ GLOW + SHIMMER-БЛИК + HAPTIC */}
            <ShimmerButton
              variant="mint"
              block
              shimmer
              hapticFeedback="medium"
              disabled={checkoutBusy}
              onClick={handlePrimaryClick}
              className="button-glow-pulse text-[15px] py-3.5"
            >
              {checkoutBusy ? (
                'Открываем Telegram Stars...'
              ) : hasAccess ? (
                isCourseFinished ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Курс открыт · Смотреть уроки</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    <span>Продолжить обучение · Урок {nextId}</span>
                  </>
                )
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Открыть курс · 2 500 Stars</span>
                </>
              )}
            </ShimmerButton>

            {/* ВТОРАЯ КНОПКА: «ПОДАРИТЬ КУРС» (АКТИВНА ВСЕГДА) */}
            <button
              type="button"
              onClick={handleGiftClick}
              className="relative inline-flex items-center justify-center gap-2 font-bold select-none cursor-pointer overflow-hidden transition-all duration-150 active:scale-[0.98] w-full"
              style={{
                borderRadius: 14,
                padding: '11px 18px',
                fontSize: 14,
                background: 'color-mix(in srgb, var(--brand-coral) 12%, transparent)',
                color: 'var(--brand-coral)',
                border: '1px solid color-mix(in srgb, var(--brand-coral) 35%, transparent)',
              }}
            >
              <Gift size={16} />
              <span>Подарить курс другу</span>
            </button>
          </div>
        </div>
      </div>

      {/* Кастомное модальное окно подарка с валидацией @username */}
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
