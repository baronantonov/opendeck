import { COURSE_LESSONS } from '../../state/store';
import { isLessonUnlocked } from '../../lib/constants';
import { ProgressBar } from '../ui';
import { ShimmerButton } from '../MotionWrappers';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';
import {
  ChevronDown,
  CheckCircle2,
  Lock,
  Play,
  Headphones,
  Sparkles,
  Gift,
} from 'lucide-react';

export interface PocketDjCourseCardProps {
  isOpen: boolean;
  onToggle: () => void;
  completedLessons: number[];
  isPaid: boolean;
  adminMode: boolean;
  hasFullAccess: boolean;
  onOpenLesson: (index: number) => void;
  onOpenPaywall: () => void;
  onOpenGift: () => void;
}

export function PocketDjCourseCard({
  isOpen,
  onToggle,
  completedLessons,
  isPaid,
  adminMode,
  hasFullAccess,
  onOpenLesson,
  onOpenPaywall,
  onOpenGift,
}: PocketDjCourseCardProps) {
  const dc = completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const progressPct = Math.min(100, Math.round((dc / tc) * 100));

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_14px_36px_rgba(0,0,0,0.44)] transition-all duration-200"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
      }}
    >
      <AbstractGeometryBg variant="hero" spheres={1} accent="mint" />

      {/* Шапка спойлера */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        className="relative z-10 flex cursor-pointer flex-col gap-3 p-5 active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface-2))',
                }}
              >
                <Headphones size={20} />
              </div>
              <div>
                <h2 className="m-0 text-xl font-extrabold tracking-tight text-[var(--color-text)]">
                  Pocket DJ
                </h2>
                <div className="text-xs font-semibold text-[var(--brand-mint)]">
                  10 последовательных уроков
                </div>
              </div>
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              Базовый курс сведения треков на смартфоне без дорогого оборудования.
            </p>
          </div>

          <div
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl transition-colors duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
            style={{
              background: isOpen
                ? 'color-mix(in srgb, var(--brand-mint) 16%, var(--color-surface-2))'
                : 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
              color: isOpen ? 'var(--brand-mint)' : 'var(--color-text-dim)',
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

        {/* Шкала прогресса */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-[var(--color-text)]">
              {dc} из {tc} уроков пройдено
            </span>
            <span className="text-[var(--brand-mint)]">{progressPct}%</span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      </div>

      {/* Выпадающее содержимое спойлера (без горизонтальных полос border-t) */}
      <div className={`accordion-grid relative z-10 ${isOpen ? 'open' : ''}`}>
        <div className="accordion-content-overflow">
          <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
            {/* Плашка разблокировки полного курса / подарка */}
            <div
              className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-coral) 10%, var(--color-surface-2))',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-extrabold text-[var(--brand-coral)]">
                  {hasFullAccess ? 'Подарить курс «Pocket DJ»' : 'Полный курс и практика'}
                </span>
                <span className="text-[13.5px] font-extrabold text-[var(--brand-gold)]">
                  2 500 Stars
                </span>
              </div>
              <p className="m-0 text-xs leading-relaxed text-[var(--color-text-dim)]">
                {hasFullAccess
                  ? 'Подари доступ другу в Telegram: 10 уроков сведения, виртуальная дека и закрытый DJ Camp.'
                  : 'Уроки 1 и 2 открыты бесплатно. Разблокируй все 10 уроков, тренажер и доступ в Camp.'}
              </p>
              <div className="flex flex-col gap-2.5">
                {!hasFullAccess && (
                  <ShimmerButton
                    variant="coral"
                    block
                    shimmer
                    hapticFeedback="light"
                    onClick={onOpenPaywall}
                    className="h-13 py-3.5 rounded-2xl text-[15px] sm:text-base font-bold whitespace-nowrap"
                  >
                    <Sparkles size={18} className="shrink-0" />
                    <span className="whitespace-nowrap">Открыть курс · 2 500 Stars</span>
                  </ShimmerButton>
                )}
                <button
                  type="button"
                  onClick={onOpenGift}
                  className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-base font-bold text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                  style={{
                    background: 'color-mix(in srgb, var(--brand-coral) 14%, var(--color-surface))',
                  }}
                >
                  <Gift size={18} />
                  <span>Подарить курс другу</span>
                </button>
              </div>
            </div>

            {/* Список 10 последовательных уроков */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-text-dim)]">
                  Уроки основной траектории
                </span>
                <span className="text-[11px] font-semibold text-[var(--color-text-dim)]">
                  10 уроков
                </span>
              </div>

              {COURSE_LESSONS.map((lesson, idx) => {
                const stepNumber = idx + 1;
                const completed = completedLessons.includes(stepNumber);
                const status = isLessonUnlocked(idx, completedLessons, isPaid, adminMode);
                const unlocked = status.unlocked;
                const isCurrent =
                  unlocked && !completed && (idx === 0 || completedLessons.includes(idx));
                const isPaidLesson = idx >= 2;
                const showPaywallBadge = isPaidLesson && !isPaid && !adminMode;

                return (
                  <div
                    key={`course-lesson-${idx}`}
                    onClick={() => onOpenLesson(idx)}
                    role="button"
                    tabIndex={0}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                    style={{
                      background: isCurrent
                        ? 'color-mix(in srgb, var(--brand-mint) 12%, var(--color-surface-2))'
                        : showPaywallBadge
                          ? 'color-mix(in srgb, var(--brand-coral) 6%, var(--color-surface-2))'
                          : 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                      opacity: !unlocked && !showPaywallBadge ? 0.65 : 1,
                    }}
                  >
                    {/* Индикатор шага */}
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                      style={{
                        background: completed
                          ? 'var(--brand-mint)'
                          : isCurrent
                            ? 'color-mix(in srgb, var(--brand-mint) 22%, var(--color-surface))'
                            : showPaywallBadge
                              ? 'color-mix(in srgb, var(--brand-coral) 16%, transparent)'
                              : 'rgba(255, 255, 255, 0.05)',
                        color: completed
                          ? '#11322a'
                          : isCurrent
                            ? 'var(--brand-mint)'
                            : showPaywallBadge
                              ? 'var(--brand-coral)'
                              : 'var(--color-text-dim)',
                      }}
                    >
                      {completed ? (
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                      ) : showPaywallBadge || !unlocked ? (
                        <Lock size={15} />
                      ) : isCurrent ? (
                        <Play size={15} fill="currentColor" />
                      ) : (
                        <span>{stepNumber < 10 ? `0${stepNumber}` : stepNumber}</span>
                      )}
                    </div>

                    {/* Текст урока во всю ширину карточки */}
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {completed ? (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap">
                              Пройден ✓
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap">
                              <span className="animate-organic-pulse inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand-mint)]" />
                              Текущий урок
                            </span>
                          ) : showPaywallBadge ? (
                            <span
                              className="rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] whitespace-nowrap"
                              style={{
                                background: 'color-mix(in srgb, var(--brand-coral) 16%, transparent)',
                              }}
                            >
                              Pocket DJ
                            </span>
                          ) : idx === 0 || idx === 1 ? (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] whitespace-nowrap">
                              Бесплатный урок
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-text-dim)] whitespace-nowrap">
                              Урок {stepNumber}
                            </span>
                          )}

                          <span
                            className="text-[10px] font-bold whitespace-nowrap"
                            style={{
                              color: completed ? 'var(--color-text-dim)' : 'var(--brand-gold)',
                            }}
                          >
                            +50 GP
                          </span>
                        </div>

                        {/* Компактный статус-пилл в верхней строке */}
                        <div className="shrink-0">
                          {isCurrent ? (
                            <span
                              className="inline-flex items-center whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-[#11322a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]"
                              style={{ background: 'var(--brand-mint)' }}
                            >
                              Смотреть
                            </span>
                          ) : showPaywallBadge ? (
                            <span
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                              style={{
                                background: 'color-mix(in srgb, var(--brand-coral) 14%, transparent)',
                              }}
                            >
                              <Lock size={10} />
                              <span>Открыть</span>
                            </span>
                          ) : !unlocked ? (
                            <span className="inline-flex items-center justify-center rounded-lg bg-white/5 p-1 text-[var(--color-text-dim)]">
                              <Lock size={11} />
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="whitespace-nowrap text-[13px] font-bold leading-snug tracking-[-0.01em] text-[var(--color-text)]">
                        {lesson.t}
                      </div>

                      <div className="whitespace-nowrap text-[11px] leading-snug tracking-[-0.01em] text-[var(--color-text-dim)]">
                        {lesson.d[0]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
