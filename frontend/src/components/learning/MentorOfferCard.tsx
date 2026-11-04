import { mentorPrices } from '../../lib/constants';
import { ShimmerButton } from '../MotionWrappers';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';
import { ChevronDown, CheckCircle2, Sparkles, Award } from 'lucide-react';

export interface MentorOfferCardProps {
  isOpen: boolean;
  onToggle: () => void;
  groovePoints: number;
  onOpenMentorPay: () => void;
}

const MENTOR_FEATURES = [
  '4 персональные сессии по 90 минут в Zoom/Telegram',
  'Глубокий аудит твоих миксов и техники сведения',
  'Персональная селекция и музыкальная библиотека',
  'Индивидуальная дорожная карта для первых клубных сетов',
];

export function MentorOfferCard({
  isOpen,
  onToggle,
  groovePoints,
  onOpenMentorPay,
}: MentorOfferCardProps) {
  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(groovePoints);

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_38px_rgba(0,0,0,0.45)] transition-all duration-200"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
      }}
    >
      <AbstractGeometryBg variant="mentor" spheres={1} accent="gold" />

      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        className="relative z-10 flex cursor-pointer flex-col gap-3 p-5 active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
      >
        <div className="flex items-center justify-between gap-2">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
            style={{
              background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))',
            }}
          >
            <Sparkles size={12} />
            <span>1-НА-1 МЕНТОРСТВО · PREMIUM</span>
          </div>

          <div className="text-[13.5px] font-extrabold text-[var(--brand-gold)]">
            ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-gold) 16%, var(--color-surface-2))',
                }}
              >
                <Award size={20} />
              </div>
              <h3 className="m-0 text-lg font-extrabold tracking-tight text-[var(--color-text)]">
                Живое менторство FREEDA
              </h3>
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              4 персональные сессии по 1.5ч с разбором твоих миксов и треком выступлений.
            </p>
          </div>

          <div
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl transition-colors duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
            style={{
              background: isOpen
                ? 'color-mix(in srgb, var(--brand-gold) 18%, var(--color-surface-2))'
                : 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
              color: isOpen ? 'var(--brand-gold)' : 'var(--color-text-dim)',
            }}
          >
            <ChevronDown
              size={18}
              className={`transition-transform duration-300 ease-out ${
                isOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </div>
        </div>
      </div>

      <div className={`accordion-grid relative z-10 ${isOpen ? 'open' : ''}`}>
        <div className="accordion-content-overflow">
          <div className="flex flex-col gap-3.5 px-5 pb-5 pt-1">
            <p className="m-0 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              Индивидуальная работа с основателем школы FREEDA DJ: разбор каждого твоего перехода, постановка слуха и чувства тайминга, построение драматургии сета и подготовка к первому живому выступлению.
            </p>

            <div className="flex flex-col gap-2">
              {MENTOR_FEATURES.map((item, i) => (
                <div
                  key={`mentor-feat-${i}`}
                  className="flex items-center gap-2.5 text-xs text-[var(--color-text)]"
                >
                  <CheckCircle2 size={15} className="shrink-0 text-[var(--brand-mint)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Расчет цены со скидкой GP без горизонтальных полос */}
            <div
              className="flex flex-col gap-2 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              style={{
                background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
              }}
            >
              <div className="flex justify-between text-xs text-[var(--color-text-dim)]">
                <span>Базовая стоимость:</span>
                <span className={discountUsd > 0 ? 'line-through' : ''}>
                  $250 (23 900 ₽)
                </span>
              </div>

              {discountUsd > 0 && (
                <div className="flex justify-between text-xs text-[var(--brand-mint)]">
                  <span>Скидка за {cappedGp} GP:</span>
                  <b>−${discountUsd} (−{discountRub.toLocaleString('ru-RU')} ₽)</b>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between">
                <span className="text-[13px] font-extrabold text-[var(--color-text)]">
                  Итого к оплате:
                </span>
                <span className="text-base font-extrabold text-[var(--brand-gold)]">
                  ${finalUsd} · {finalRub.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            <ShimmerButton
              variant="gradient"
              block
              shimmer
              hapticFeedback="light"
              onClick={onOpenMentorPay}
              className="h-13 py-3.5 rounded-2xl text-base font-bold"
            >
              <Sparkles size={18} />
              <span>Записаться на созвоны со скидкой</span>
            </ShimmerButton>
          </div>
        </div>
      </div>
    </div>
  );
}
