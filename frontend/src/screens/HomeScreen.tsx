import { useState } from 'react';
import { Sliders, Disc3, ArrowUpRight } from 'lucide-react';
import { haptic } from '../lib/theme';
import { HorizontalDeckModal } from '../components/deck/HorizontalDeckModal';
import { ProfileWidget } from '../components/profile/ProfileWidget';
import { StaggerContainer, StaggerItem } from '../components/MotionWrappers';
import { PocketDjPromoWidget } from '../components/PocketDjPromoWidget';
import { AbstractGeometryBg } from '../components/LiquidGlassGeometry';

/**
 * Экран «ГЛАВНАЯ» (HomeScreen.tsx — Витрина конверсии из 3 блоков по канонам SaaS-маркетинга):
 * 1) Компактный стеклянный статус-бар пользователя сверху (UserAvatar, приветствие, бейдж прогресса X / 10).
 * 2) Флагманский Hero-виджет «Pocket DJ» с дрейфующей абстрактной геометрией, триггерами ценности,
 *    главной кнопкой «Открыть курс» с переливающимся бликом и вторичной кнопкой «Подарить курс».
 * 3) Лаконичный Bento-тизер быстрого перехода к практике на DJ-деке.
 */
export function HomeScreen() {
  const [deckOpen, setDeckOpen] = useState(false);

  return (
    <div className="flex w-full max-w-full flex-col gap-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] select-none">
      <StaggerContainer stepMs={60} className="gap-4">
        {/* 1. Компактный стеклянный статус-бар пользователя сверху */}
        <StaggerItem index={0}>
          <ProfileWidget />
        </StaggerItem>

        {/* 2. Флагманский Hero-виджет «Pocket DJ» */}
        <StaggerItem index={1}>
          <PocketDjPromoWidget badgeText="Главный курс · Выбор школы" />
        </StaggerItem>

        {/* 3. Лаконичный Bento-тизер быстрого перехода к практике на DJ-деке */}
        <StaggerItem index={2}>
          <div
            onClick={() => {
              haptic('light');
              setDeckOpen(true);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                haptic('light');
                setDeckOpen(true);
              }
            }}
            className="relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.42)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 78%, rgba(20, 24, 23, 0.84))',
            }}
          >
            {/* Векторная геометрия без лишних анимированных сфер (лимит 2 сферы уже в Hero-виджете) */}
            <AbstractGeometryBg variant="card" spheres={0} accent="mauve" />

            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                  style={{
                    background: 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface-2))',
                  }}
                >
                  <Disc3 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)]">
                      Rekordbox Simulator
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-dim)]"
                      style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                    >
                      Dual Deck A/B
                    </span>
                  </div>
                  <h3 className="m-0 mt-1 text-lg font-extrabold tracking-tight text-[var(--color-text)]">
                    Практика на DJ-деке
                  </h3>
                </div>
              </div>

              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface-2) 75%, transparent)',
                }}
              >
                <ArrowUpRight size={18} />
              </div>
            </div>

            <p className="relative z-10 m-0 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              Интерактивный пульт в горизонтальном режиме: запускай треки, выравнивай BPM, работай эквалайзером и своди на смартфоне.
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic('light');
                setDeckOpen(true);
              }}
              className="relative z-10 inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold text-[var(--color-text)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_6px_18px_rgba(0,0,0,0.28)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
              style={{
                background: 'color-mix(in srgb, var(--color-surface-2) 82%, transparent)',
              }}
            >
              <Sliders size={18} className="text-[var(--brand-mint)]" />
              <span>Открыть виртуальный пульт</span>
            </button>
          </div>
        </StaggerItem>
      </StaggerContainer>

      <HorizontalDeckModal isOpen={deckOpen} onClose={() => setDeckOpen(false)} />
    </div>
  );
}

export default HomeScreen;
