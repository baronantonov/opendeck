import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  block,
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'coral' | 'ghost' | 'mint' | 'secondary' | 'gradient';
  block?: boolean;
}) {
  // Pioneer DJ & Rekordbox hardware inspired colorways
  const palette: Record<string, { bg: string; fg: string; border?: string; shadow?: string }> = {
    primary: {
      bg: 'linear-gradient(135deg, #ff5a00 0%, #e04800 100%)',
      fg: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      shadow: '0 4px 16px rgba(255, 90, 0, 0.35)',
    },
    gradient: {
      bg: 'linear-gradient(135deg, #00e5ff 0%, #0088cc 100%)',
      fg: '#080a0e',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      shadow: '0 4px 16px rgba(0, 229, 255, 0.35)',
    },
    coral: {
      bg: 'linear-gradient(135deg, #ff3b30 0%, #d32218 100%)',
      fg: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      shadow: '0 4px 14px rgba(255, 59, 48, 0.3)',
    },
    mint: {
      bg: 'linear-gradient(135deg, #00f076 0%, #00b854 100%)',
      fg: '#080a0e',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      shadow: '0 4px 14px rgba(0, 240, 118, 0.3)',
    },
    ghost: {
      bg: 'rgba(255, 255, 255, 0.05)',
      fg: '#f0f3f6',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    secondary: {
      bg: '#1c2027',
      fg: '#f0f3f6',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      shadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    },
  };
  const c = palette[variant] || palette.primary;
  return (
    <button
      {...rest}
      style={{
        width: block ? '100%' : undefined,
        border: c.border || 'none',
        borderRadius: 12,
        padding: '12px 18px',
        fontSize: 14.5,
        fontWeight: 700,
        background: c.bg,
        color: c.fg,
        boxShadow: c.shadow,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: rest.disabled ? 0.45 : 1,
        transition: 'transform 0.12s ease, opacity 0.12s ease',
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        ...style,
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
        background: '#14171d',
        borderRadius: 16,
        padding: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px rgba(0, 0, 0, 0.45)',
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
        height: 6,
        borderRadius: 99,
        background: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: 'linear-gradient(90deg, #ff5a00 0%, #00e5ff 100%)',
          boxShadow: '0 0 10px rgba(0, 229, 255, 0.5)',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

export function Star({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#ffd600"
      style={{ filter: 'drop-shadow(0 0 4px rgba(255, 214, 0, 0.45))' }}
    >
      <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
    </svg>
  );
}
