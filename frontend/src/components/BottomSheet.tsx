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
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
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
          background: '#14171d',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.6)',
          padding: '14px 16px 24px',
          maxHeight: '86vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag pill handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.2)',
            margin: '0 auto 16px',
          }}
        />
        {title && (
          <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: '#f0f3f6' }}>
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
