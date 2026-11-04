import { StaggerItem, ShimmerButton } from '../MotionWrappers';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';
import { StatusBadge } from '../StatusBadge';
import {
  Unlock,
  Users,
  Flame,
  Sparkles,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Headphones,
} from 'lucide-react';

export interface TribeResidentViewProps {
  onJoinCamp: () => void;
}

export function TribeResidentView({ onJoinCamp }: TribeResidentViewProps) {
  return (
    <>
      {/* 1. КЛУБНЫЙ ДОСТУП: ОТКРЫТ (СТАТУС PLAYER) */}
      <StaggerItem index={0}>
        <div
          className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_42px_rgba(0,0,0,0.48)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          }}
        >
          <AbstractGeometryBg variant="player" spheres={2} accent="mint" />

          <div className="relative z-10 flex flex-col gap-4">
            {/* Шапка клубного пропуска */}
            <div className="flex items-center justify-between gap-2">
              <StatusBadge isPlayer={true} size="md" />

              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
                }}
              >
                <Users size={13} className="text-[var(--brand-mint)]" />
                <span>Open Deck Camp</span>
              </span>
            </div>

            {/* Титульный блок пропуска */}
            <div className="flex items-center gap-3.5">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_24px_rgba(140,226,200,0.22)]"
                style={{
                  background: 'color-mix(in srgb, var(--brand-mint) 18%, var(--color-surface-2))',
                }}
              >
                <Unlock size={26} />
              </div>
              <div>
                <h1 className="brand-text m-0 text-2xl font-extrabold tracking-tight">
                  ТВОЁ ПЛЕМЯ
                </h1>
                <p className="m-0 mt-1 text-xs font-semibold text-[var(--brand-mint)]">
                  Закрытый клуб резидентов Open Deck
                </p>
              </div>
            </div>

            {/* Поздравительное сообщение */}
            <div
              className="rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              style={{
                background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
              }}
            >
              <p className="m-0 text-[13.5px] font-medium leading-relaxed text-[var(--color-text)]">
                Добро пожаловать в племя! Ты сделал первый шаг, и теперь двери нашего кэмпа открыты для тебя. Здесь нет «глупых» вопросов, только поддержка и общая любовь к музыке. Заходи, мы тебя ждем!
              </p>
            </div>

            {/* Мощная акцентная кнопка входа в Camp */}
            <ShimmerButton
              variant="mint"
              block
              shimmer
              hapticFeedback="light"
              onClick={onJoinCamp}
              className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
            >
              <Sparkles size={18} />
              <span>Войти в закрытый Camp</span>
              <ExternalLink size={18} />
            </ShimmerButton>
          </div>
        </div>
      </StaggerItem>

      {/* 2. ЧТО ВНУТРИ КЭМПА */}
      <StaggerItem index={1}>
        <div
          className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.4)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          }}
        >
          <AbstractGeometryBg variant="card" spheres={0} accent="coral" />

          <div className="relative z-10 flex flex-col gap-3.5">
            <h3 className="m-0 flex items-center gap-2 text-sm font-extrabold text-[var(--color-text)]">
              <Flame size={16} className="text-[var(--brand-coral)]" />
              <span>Привилегии резидента кэмпа</span>
            </h3>

            <div className="flex flex-col gap-2.5">
              <div
                className="flex items-start gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                }}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mint)]"
                  style={{ background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)' }}
                >
                  <MessageCircle size={15} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[var(--color-text)]">
                    Закрытый чат единомышленников
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">
                    Общение с такими же увлеченными студентами и выпускниками школы.
                  </div>
                </div>
              </div>

              <div
                className="flex items-start gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                }}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-coral)]"
                  style={{ background: 'color-mix(in srgb, var(--brand-coral) 15%, transparent)' }}
                >
                  <HelpCircle size={15} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[var(--color-text)]">
                    Ответы на любые вопросы
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">
                    Разбор трудностей по урокам Pocket DJ, технике сведения и софту.
                  </div>
                </div>
              </div>

              <div
                className="flex items-start gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                }}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mauve)]"
                  style={{ background: 'color-mix(in srgb, var(--brand-mauve) 16%, transparent)' }}
                >
                  <Headphones size={15} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[var(--color-text)]">
                    Фидбек по твоим первым миксам
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">
                    Делись записями своих сетов и получай конструктивную обратную связь.
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
