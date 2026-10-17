import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Disc3 } from 'lucide-react';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';

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
    haptic('medium');
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '16px',
        boxSizing: 'border-box',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.18s ease',
      }}
    >
      <div
        className={isClosing ? '' : 'animate-pop'}
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--color-surface)',
          borderRadius: 24,
          border: '1px solid color-mix(in srgb, var(--brand-line) 65%, transparent)',
          boxShadow:
            '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px color-mix(in srgb, var(--brand-mint) 12%, transparent)',
          padding: '28px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          boxSizing: 'border-box',
          opacity: isClosing ? 0 : 1,
          transform: isClosing ? 'scale(0.94)' : 'scale(1)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        {/* Фирменная иконка винила с мягким свечением */}
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            background: 'color-mix(in srgb, var(--brand-gold) 14%, var(--color-surface))',
            border: '1px solid color-mix(in srgb, var(--brand-gold) 35%, transparent)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--brand-gold)',
            marginBottom: 16,
            boxShadow:
              '0 8px 24px color-mix(in srgb, var(--brand-gold) 22%, transparent)',
          }}
        >
          <Disc3 size={28} className="animate-spin" style={{ animationDuration: '8s' }} />
        </div>

        {/* Заголовок */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 21,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.3px',
          }}
        >
          Уже уходишь?
        </h3>

        {/* Описание */}
        <p
          style={{
            margin: '0 0 22px',
            fontSize: 13.5,
            color: 'var(--color-text-dim)',
            lineHeight: 1.48,
            maxWidth: 310,
          }}
        >
          Твой прогресс в Open Deck сохранен. До следующего трека и нового ранга осталось совсем немного!
        </p>

        {/* Кнопки действий */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {/* Главная акцентная кнопка «Остаться» */}
          <button
            type="button"
            onClick={handleStay}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              border: 'none',
              background: 'var(--brand-mint)',
              color: '#11322a',
              fontSize: 15,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow:
                '0 4px 18px color-mix(in srgb, var(--brand-mint) 28%, transparent)',
              transition: 'transform 0.15s ease',
            }}
            className="active:scale-[0.98]"
          >
            Остаться
          </button>

          {/* Второстепенная кнопка «Выйти» */}
          <button
            type="button"
            onClick={handleConfirmExit}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 14,
              border: '1px solid var(--brand-line)',
              background: 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
              color: 'var(--color-text-dim)',
              fontSize: 14,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="hover:text-[var(--brand-coral)] hover:border-[var(--brand-coral)]/40 active:scale-[0.98]"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
