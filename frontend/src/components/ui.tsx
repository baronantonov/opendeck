import type { ButtonHTMLAttributes, ReactNode, CSSProperties } from 'react';
import { haptic } from '../lib/theme';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

export function Button({
  variant = 'primary',
  block,
  children,
  onClick,
  className = '',
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'coral' | 'ghost' | 'mint' | 'secondary' | 'gradient';
  block?: boolean;
}) {
  // primary = brand mauve; gradient = mauve→mint sweep; coral = payment CTA
  const palette: Record<string, { bg: string; fg: string; shadow?: string }> = {
    primary: {
      bg: 'var(--brand-mauve)',
      fg: '#1d1f1e',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.28), 0 8px 20px -6px rgba(192,160,168,0.35)',
    },
    gradient: {
      bg: 'var(--brand-gradient)',
      fg: '#11322a',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.32), 0 8px 24px -6px rgba(140,226,200,0.38)',
    },
    coral: {
      bg: 'var(--brand-coral)',
      fg: '#241410',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.28), 0 8px 20px -6px rgba(245,146,110,0.35)',
    },
    mint: {
      bg: 'var(--brand-mint)',
      fg: '#11322a',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.34), 0 8px 24px -6px rgba(140,226,200,0.42)',
    },
    ghost: {
      bg: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)',
      fg: 'var(--color-text)',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.1)',
    },
    secondary: {
      bg: 'color-mix(in srgb, var(--color-surface-2) 82%, transparent)',
      fg: 'var(--color-text)',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.14), 0 6px 16px rgba(0,0,0,0.25)',
    },
  };
  const c = palette[variant] || palette.primary;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (rest.disabled) return;
    haptic('light');
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      onClick={handleClick}
      className={`h-13 py-3.5 px-5 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2 select-none active:scale-[0.97] transition-all duration-200 ease-out transform-gpu ${
        block ? 'w-full' : ''
      } ${className}`}
      style={{
        background: c.bg,
        color: c.fg,
        boxShadow: c.shadow,
        opacity: rest.disabled ? 0.5 : 1,
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
  className = '',
}: {
  children: ReactNode;
  style?: CSSProperties;
  strip?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.42)] ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 78%, rgba(20, 24, 23, 0.84))',
        ...style,
      }}
    >
      <AbstractGeometryBg variant="card" spheres={0} accent="mint" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full"
      style={{
        background: 'color-mix(in srgb, var(--color-text) 10%, transparent)',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${clamped}%`,
          background: 'var(--brand-gradient)',
          boxShadow: '0 0 12px rgba(140, 226, 200, 0.45)',
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

export function IconHeadphones({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function IconFader({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function IconDisc({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconWaveform({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4" />
    </svg>
  );
}

export function IconLock({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconCheck({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconSparkles({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

export function IconFlame({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function IconShare({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function IconUsers({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconPlay({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function IconCreditCard({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

export function IconTrophy({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" /><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function IconGift({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
