import { ShoppingBag } from 'lucide-react';
import { useRegisterModal } from '../lib/navigation';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

export interface MarketToastProps {
  open: boolean;
  timerKey: number;
  onClose: () => void;
}

/**
 * Всплывающее уведомление раздела «МАРКЕТ» в эстетике темного Liquid Glass
 * с внутренним бликом, деликатной абстрактной геометрией и 8-секундным таймером.
 */
export function MarketToast({ open, timerKey, onClose }: MarketToastProps) {
  useRegisterModal('market_popup', open, onClose);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed left-4 right-4 z-[65] mx-auto max-w-[448px] overflow-hidden rounded-3xl backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_20px_48px_rgba(0,0,0,0.65)] transition-all duration-300 ease-out transform-gpu ${
        open
          ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto'
          : 'translate-y-3 scale-95 opacity-0 pointer-events-none'
      }`}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)',
        background: 'color-mix(in srgb, var(--color-surface) 84%, rgba(16, 20, 19, 0.92))',
      }}
    >
      <AbstractGeometryBg variant="modal" spheres={0} accent="mint" />

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
            style={{
              background: 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface-2))',
              color: 'var(--brand-mint)',
            }}
          >
            <ShoppingBag size={18} />
          </div>
          <p className="m-0 text-[13px] font-medium leading-snug text-[var(--color-text)]">
            Возможно позже тут появится что-то интересное...
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out"
          style={{
            background: 'color-mix(in srgb, var(--brand-mint) 14%, var(--color-surface-2))',
          }}
        >
          Ок, ясно
        </button>
      </div>

      {/* Линейный индикатор автоскрытия на 8000 мс */}
      <div className="relative h-[2.5px] w-full overflow-hidden bg-white/[0.06]">
        {open && (
          <div
            key={timerKey}
            className="h-full w-full origin-left"
            style={{
              background: 'var(--brand-gradient)',
              animation: 'market-countdown 8000ms linear forwards',
            }}
          />
        )}
      </div>
    </div>
  );
}
