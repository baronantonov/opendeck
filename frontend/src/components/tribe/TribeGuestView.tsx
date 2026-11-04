import { StaggerItem, ShimmerButton } from '../MotionWrappers';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';
import { StatusBadge } from '../StatusBadge';
import { Lock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export interface TribeGuestViewProps {
  isLesson1Done: boolean;
  isLesson2Done: boolean;
  onOpenPaywall: () => void;
  onGoToLearn: () => void;
}

export function TribeGuestView({
  isLesson1Done,
  isLesson2Done,
  onOpenPaywall,
  onGoToLearn,
}: TribeGuestViewProps) {
  return (
    <>
      <StaggerItem index={0}>
        <div
          className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_42px_rgba(0,0,0,0.48)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          }}
        >
          <AbstractGeometryBg variant="player" spheres={2} accent="coral" />

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge isPlayer={false} size="md" />

              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
                }}
              >
                Требуется Pocket DJ
              </span>
            </div>

            <div className="flex items-center gap-3.5">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_0_24px_rgba(245,146,110,0.18)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-coral) 16%, var(--color-surface-2))',
                }}
              >
                <Lock size={26} />
              </div>
              <div>
                <h1 className="brand-text m-0 text-2xl font-extrabold tracking-tight">
                  ЗАКРЫТЫЙ DJ CAMP
                </h1>
                <p className="m-0 mt-1 text-xs font-semibold text-[var(--color-text-dim)]">
                  Клубный пропуск резидента Open Deck
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              style={{
                background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
              }}
            >
              <p className="m-0 text-[13.5px] font-medium leading-relaxed text-[var(--color-text)]">
                Твой эксклюзивный пропуск в закрытый «Open Deck DJ Camp» ждет тебя. Доступ к комьюнити открывается мгновенно при покупке курса Pocket DJ. Внутри — закрытый чат студентов, разборы миксов и поддержка кураторов.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <ShimmerButton
                variant="mint"
                block
                shimmer
                hapticFeedback="light"
                onClick={onOpenPaywall}
                className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
              >
                <Sparkles size={18} />
                <span>Открыть Pocket DJ · 2 500 Stars</span>
              </ShimmerButton>

              <button
                type="button"
                onClick={onGoToLearn}
                className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold text-[var(--color-text)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 78%, transparent)',
                }}
              >
                <span>Бесплатные вводные уроки</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* 2. ТРАЕКТОРИЯ ДОСТУПА */}
      <StaggerItem index={1}>
        <div
          className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.4)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          }}
        >
          <AbstractGeometryBg variant="card" spheres={0} accent="mint" />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-dim)]">
                Активация клубного пропуска
              </span>
              <span className="text-xs font-extrabold text-[var(--brand-gold)]">
                Pocket DJ
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Шаг 1 */}
              <div
                className="flex items-center justify-between rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                style={{
                  background: isLesson1Done
                    ? 'color-mix(in srgb, var(--brand-mint) 10%, var(--color-surface-2))'
                    : 'color-mix(in srgb, var(--color-surface-2) 55%, rgba(14, 17, 16, 0.5))',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold"
                    style={{
                      background: isLesson1Done ? 'var(--brand-mint)' : 'rgba(255,255,255,0.08)',
                      color: isLesson1Done ? '#11322a' : 'var(--color-text-dim)',
                    }}
                  >
                    {isLesson1Done ? <CheckCircle2 size={15} /> : '1'}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--color-text)]">
                      Урок 1: Первый контроллер
                    </div>
                    <div
                      className="text-[11px]"
                      style={{
                        color: isLesson1Done ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                      }}
                    >
                      {isLesson1Done ? 'Пройден ✓' : 'Бесплатный вводный урок'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Шаг 2 */}
              <div
                className="flex items-center justify-between rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                style={{
                  background: isLesson2Done
                    ? 'color-mix(in srgb, var(--brand-mint) 10%, var(--color-surface-2))'
                    : 'color-mix(in srgb, var(--color-surface-2) 55%, rgba(14, 17, 16, 0.5))',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold"
                    style={{
                      background: isLesson2Done ? 'var(--brand-mint)' : 'rgba(255,255,255,0.08)',
                      color: isLesson2Done ? '#11322a' : 'var(--color-text-dim)',
                    }}
                  >
                    {isLesson2Done ? <CheckCircle2 size={15} /> : '2'}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--color-text)]">
                      Урок 2: Знакомство с FREEDA
                    </div>
                    <div
                      className="text-[11px]"
                      style={{
                        color: isLesson2Done ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                      }}
                    >
                      {isLesson2Done ? 'Пройден ✓' : 'Бесплатный практический урок'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Шаг 3 */}
              <div
                className="flex items-center justify-between rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-coral) 12%, var(--color-surface-2))',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold text-[var(--brand-coral)]"
                    style={{
                      background: 'color-mix(in srgb, var(--brand-coral) 20%, transparent)',
                    }}
                  >
                    <Lock size={13} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--color-text)]">
                      Курс Pocket DJ + Open Deck Camp
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--brand-coral)]">
                      Мгновенный статус PLAYER
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </StaggerItem>
    </>
  );
}
