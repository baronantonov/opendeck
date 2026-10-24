import { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useHomeScreenBanner } from '../lib/useHomeScreenBanner';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

export interface HomeScreenBannerProps {
  active?: boolean;
  splashFinished?: boolean;
}

/**
 * Плавающий баннер добавления ярлыка на рабочий стол в эстетике темного Liquid Glass
 * с глубоким размытием (backdrop-blur-2xl), внутренним бликом и деликатной геометрией.
 */
export function HomeScreenBanner({ active = true, splashFinished }: HomeScreenBannerProps) {
  const [splashTimeout, setSplashTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashTimeout(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const isSplashDone = splashFinished !== undefined ? (splashFinished || splashTimeout) : true;
  const isEnabled = active && isSplashDone;
  const { isMounted, isVisible, progress, dismiss, handleAdd } = useHomeScreenBanner(isEnabled);

  if (!isMounted) return null;

  return (
    <aside
      aria-label="Добавить ярлык на рабочий стол"
      className="pointer-events-none fixed left-0 right-0 z-[120] flex justify-center px-4"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)',
      }}
    >
      <div
        className={`w-full max-w-[448px] transition-all duration-300 ease-out transform-gpu ${
          isVisible
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2 scale-95 opacity-0'
        }`}
      >
        <div
          className="relative flex w-full items-center gap-3 overflow-hidden rounded-3xl px-4 py-3.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_40px_rgba(0,0,0,0.58)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
          }}
        >
          <AbstractGeometryBg variant="modal" spheres={0} accent="mint" />

          {/* Иконка смартфона */}
          <div
            className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
            style={{
              background: 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface-2))',
            }}
          >
            <Smartphone size={20} />
          </div>

          {/* Текстовый блок */}
          <div className="relative z-10 min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold leading-tight text-[var(--color-text)]">
              Ярлык на экран
            </div>
            <div className="mt-0.5 truncate text-[11.5px] leading-tight text-[var(--color-text-dim)]">
              Прямой запуск без шапки Telegram
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="relative z-10 flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleAdd}
              className="cursor-pointer rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#11322a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_4px_12px_rgba(140,226,200,0.28)] active:scale-[0.97] transition-all duration-200 ease-out"
              style={{ background: 'var(--brand-mint)' }}
            >
              Добавить
            </button>

            <button
              type="button"
              onClick={() => dismiss(true)}
              aria-label="Скрыть"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all duration-200 ease-out"
              style={{
                background: 'color-mix(in srgb, var(--color-surface-2) 70%, transparent)',
              }}
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>

          {/* Линейный индикатор автоскрытия */}
          <div
            className="absolute bottom-0 left-0 h-[2.5px] transition-[width] duration-75 ease-linear"
            style={{
              width: `${progress}%`,
              background: 'var(--brand-mint)',
              boxShadow: '0 0 8px var(--brand-mint)',
            }}
          />
        </div>
      </div>
    </aside>
  );
}
