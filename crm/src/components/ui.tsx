import React, { useState, useEffect } from 'react';

export function Button({
  variant = 'primary', block, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'warn' | 'coral';
  block?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg,var(--color-accent),var(--color-accent-2))', color: '#1d1f1e', border: '0' },
    ghost: { background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
    danger: { background: 'rgba(251,113,133,.12)', color: 'var(--color-bad)', border: '1px solid rgba(251,113,133,.3)' },
    warn: { background: 'rgba(251,146,60,.12)', color: 'var(--color-coral)', border: '1px solid rgba(245,146,110,.3)' },
    coral: { background: 'var(--color-coral)', color: '#1d1f1e', border: '0' },
  };
  return (
    <button
      {...rest}
      style={{
        padding: '11px 16px', borderRadius: 12, fontWeight: 650, cursor: 'pointer',
        fontSize: 14, transition: '.16s', ...styles[variant],
        width: block ? '100%' : undefined, opacity: rest.disabled ? .5 : 1,
        ...(rest.style || {}),
      }}
    >
      {children}
    </button>
  );
}

export function Modal({
  open, onClose, children, width = 460,
}: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: 18, width: `min(${width}px,100%)`, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 30px 60px -30px rgba(0,0,0,.7)' }}
      >
        {children}
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) ${msg ? 'translateY(0)' : 'translateY(20px)'}`,
        background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)',
        padding: '12px 18px', borderRadius: 12, zIndex: 80, opacity: msg ? 1 : 0, transition: '.25s', pointerEvents: 'none',
        fontSize: 14, fontWeight: 600,
      }}
    >
      {msg}
    </div>
  );
}
