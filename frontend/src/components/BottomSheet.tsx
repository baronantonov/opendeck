import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../lib/theme';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    haptic('medium');
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,10,9,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 200,
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop"
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--color-surface)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTop: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
          padding: '18px 16px 24px',
          maxHeight: '86vh',
          overflowY: 'auto',
        }}
      >
        {title && (
          <h3 style={{ margin: '0 0 14px', fontSize: 18 }}>{title}</h3>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
