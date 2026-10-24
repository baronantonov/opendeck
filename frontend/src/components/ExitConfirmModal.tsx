import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Disc3 } from 'lucide-react';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

export interface ExitConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onExit?: () => void;
}

export function ExitConfirmModal({
  open,
  onClose,
  onExit,
}: ExitConfirmModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsClosing(false);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleConfirmExit = () => {
    haptic('light');
    if (onExit) {
      onExit();
    } else {
      const tw = getTelegramWebApp();
      tw?.close?.();
    }
  };

  const handleStay = () => {
    if (isClosing) return;
    haptic('light');
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 180);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center bg-black/72 p-4 backdrop-blur-xl transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`relative flex w-full max-w-[380px] flex-col items-center overflow-hidden rounded-3xl p-6 text-center backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_24px_60px_rgba(0,0,0,0.72)] transition-all duration-200 ease-out transform-gpu ${
          isClosing ? 'scale-95 opacity-0' : 'animate-modal-spring scale-100 opacity-100'
        }`}
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
        }}
      >
        <AbstractGeometryBg variant="modal" spheres={1} accent="gold" />

        {/* Иконка винила с мягким свечением */}
        <div
          className="relative z-10 mb-4 grid h-14 w-14 place-items-center rounded-2xl text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_8px_24px_rgba(243,201,105,0.2)]"
          style={{
            background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))',
          }}
        >
          <Disc3 size={28} className="animate-spin" style={{ animationDuration: '8s' }} />
        </div>

        <h3 className="relative z-10 m-0 mb-2 text-xl font-extrabold tracking-tight text-[var(--color-text)]">
          Уже уходишь?
        </h3>

        <p className="relative z-10 m-0 mb-5 max-w-[310px] text-[13.5px] leading-relaxed text-[var(--color-text-dim)]">
          Твой прогресс в Open Deck сохранен. До следующего трека и нового ранга осталось совсем немного!
        </p>

        <div className="relative z-10 flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={handleStay}
            className="inline-flex h-13 w-full cursor-pointer items-center justify-center rounded-2xl py-3.5 text-base font-bold text-[#11322a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.34),0_8px_24px_rgba(140,226,200,0.32)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{ background: 'var(--brand-mint)' }}
          >
            Остаться
          </button>

          <button
            type="button"
            onClick={handleConfirmExit}
            className="inline-flex h-13 w-full cursor-pointer items-center justify-center rounded-2xl py-3.5 text-base font-bold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] hover:text-[var(--brand-coral)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
