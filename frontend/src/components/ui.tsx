import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  block,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'coral' | 'ghost' | 'mint' | 'secondary' | 'gradient';
  block?: boolean;
}) {
  // primary = brand mauve; gradient = mauve→mint sweep; coral = payment CTA
  const palette: Record<string, { bg: string; fg: string }> = {
    primary: { bg: 'var(--brand-mauve)', fg: '#1d1f1e' },
    gradient: { bg: 'var(--brand-gradient)', fg: '#1d1f1e' },
    coral: { bg: 'var(--brand-coral)', fg: '#241410' },
    mint: { bg: 'var(--brand-mint)', fg: '#11322a' },
    ghost: {
      bg: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
      fg: 'var(--color-text)',
    },
    secondary: {
      bg: 'color-mix(in srgb, var(--color-text) 14%, transparent)',
      fg: 'var(--color-text)',
    },
  };
  const c = palette[variant];
  return (
    <button
      {...rest}
      style={{
        width: block ? '100%' : undefined,
        border: 'none',
        borderRadius: 14,
        padding: '13px 18px',
        fontSize: 15,
        fontWeight: 700,
        background: c.bg,
        color: c.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: rest.disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  style,
  strip,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  strip?: boolean;
}) {
  return (
    <div
      className={`animate-pop${strip ? ' brand-strip' : ''}`}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 18,
        padding: 16,
        border: '1px solid color-mix(in srgb, var(--brand-mauve) 14%, transparent)',
        boxShadow:
          '0 8px 24px -14px color-mix(in srgb, var(--brand-mauve) 45%, transparent)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        height: 8,
        borderRadius: 99,
        background: 'color-mix(in srgb, var(--color-text) 10%, transparent)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: 'var(--brand-gradient)',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

export function Star({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--brand-gold)">
      <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
    </svg>
  );
}
