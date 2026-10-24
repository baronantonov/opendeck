import {
  type ReactNode,
  type CSSProperties,
  type ButtonHTMLAttributes,
  type ReactElement,
  Children,
  isValidElement,
  cloneElement,
  memo,
} from 'react';
import { haptic } from '../lib/theme';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

/* ==========================================================================
   1. Staggered Entrance Wrappers (Каскадное появление виджетов, шаг 60ms)
   ========================================================================== */

export interface StaggerContainerProps {
  children: ReactNode;
  /** Базовый шаг каскадной задержки между виджетами (в мс), по умолчанию 60ms */
  stepMs?: number;
  /** Начальная задержка перед стартом каскада (в мс), по умолчанию 0ms */
  initialDelayMs?: number;
  /** Дополнительные CSS-классы контейнера */
  className?: string;
  /** Пользовательские инлайн-стили */
  style?: CSSProperties;
}

/**
 * Обертка каскадной группы виджетов.
 * Автоматически рассчитывает и инжектирует индекс задержки для дочерних StaggerItem.
 */
export function StaggerContainer({
  children,
  stepMs = 60,
  initialDelayMs = 0,
  className = '',
  style,
}: StaggerContainerProps) {
  let validIndex = 0;

  const mappedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }

    const childIndex = validIndex++;
    const computedDelay = initialDelayMs + childIndex * stepMs;
    const childType = child.type as { displayName?: string };
    const childProps = child.props as { delayMs?: number };

    if (childType?.displayName === 'StaggerItem') {
      return cloneElement(child as ReactElement<StaggerItemProps>, {
        delayMs: childProps.delayMs ?? computedDelay,
      });
    }

    return (
      <StaggerItem key={child.key ?? childIndex} delayMs={computedDelay}>
        {child}
      </StaggerItem>
    );
  });

  return (
    <div className={`flex flex-col gap-4 w-full ${className}`} style={style}>
      {mappedChildren}
    </div>
  );
}

export interface StaggerItemProps {
  children: ReactNode;
  /** Индекс элемента для автоматического расчета задержки (index * stepMs) */
  index?: number;
  /** Прямое указание задержки в миллисекундах */
  delayMs?: number;
  /** Шаг задержки при передаче индекса, по умолчанию 60ms */
  stepMs?: number;
  className?: string;
  style?: CSSProperties;
}

type StaggerCSSProperties = CSSProperties & {
  '--stagger-delay'?: string;
};

/**
 * Обертка отдельного виджета или карточки с аппаратным выходом снизу вверх:
 * opacity-0 translate-y-3 -> opacity-100 translate-y-0, transform-gpu.
 */
export const StaggerItem = memo(function StaggerItem({
  children,
  index = 0,
  delayMs,
  stepMs = 60,
  className = '',
  style,
}: StaggerItemProps) {
  const calculatedDelay = delayMs !== undefined ? delayMs : index * stepMs;

  const itemStyle: StaggerCSSProperties = {
    ...style,
    '--stagger-delay': `${calculatedDelay}ms`,
  };

  return (
    <div className={`stagger-item transform-gpu ${className}`} style={itemStyle}>
      {children}
    </div>
  );
});
StaggerItem.displayName = 'StaggerItem';

/* ==========================================================================
   2. Liquid Glass Glow Card (Премиум-виджет с абстрактной геометрией)
   ========================================================================== */

export interface GlowCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  strip?: boolean;
  ambientGlow?: boolean;
  animatedBorder?: boolean;
  /** Количество анимированных глубинных сфер (0, 1 или 2 на экран) */
  spheres?: 0 | 1 | 2;
  accent?: 'mint' | 'mauve' | 'coral' | 'gold';
  onClick?: () => void;
}

export function GlowCard({
  children,
  className = '',
  style,
  spheres = 1,
  accent = 'mint',
  onClick,
}: GlowCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-3xl p-5 text-[var(--color-text)] select-none backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_38px_rgba(0,0,0,0.48)] ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 80%, rgba(18, 22, 21, 0.86))',
        ...style,
      }}
    >
      <AbstractGeometryBg variant="vip" spheres={spheres} accent={accent} />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

/* ==========================================================================
   3. Shimmer Button (Целевая CTA-кнопка с пробегающим бликом и Spring Physics)
   ========================================================================== */

export interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'coral' | 'mint' | 'gradient' | 'secondary' | 'ghost';
  block?: boolean;
  /** Включение пробегающего диагонального блика (sheen effect) */
  shimmer?: boolean;
  /** Тип тактильного отклика Telegram Haptic при нажатии */
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
}

export function ShimmerButton({
  children,
  variant = 'gradient',
  block = false,
  shimmer = true,
  hapticFeedback = 'light',
  className = '',
  style,
  onClick,
  disabled,
  ...rest
}: ShimmerButtonProps) {
  const palette: Record<string, { bg: string; fg: string; shadow: string }> = {
    primary: {
      bg: 'var(--brand-mauve)',
      fg: '#1d1f1e',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.28), 0 8px 24px -6px rgba(192,160,168,0.4)',
    },
    gradient: {
      bg: 'var(--brand-gradient)',
      fg: '#11322a',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.34), 0 10px 28px -6px rgba(140,226,200,0.42)',
    },
    coral: {
      bg: 'var(--brand-coral)',
      fg: '#241410',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.28), 0 10px 26px -6px rgba(245,146,110,0.42)',
    },
    mint: {
      bg: 'var(--brand-mint)',
      fg: '#11322a',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.36), 0 10px 28px -6px rgba(140,226,200,0.46)',
    },
    secondary: {
      bg: 'color-mix(in srgb, var(--color-surface-2) 82%, transparent)',
      fg: 'var(--color-text)',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.14), 0 8px 20px rgba(0,0,0,0.3)',
    },
    ghost: {
      bg: 'color-mix(in srgb, var(--color-surface-2) 55%, transparent)',
      fg: 'var(--color-text)',
      shadow: 'inset 0 1px 1px rgba(255,255,255,0.1)',
    },
  };

  const currentTheme = palette[variant] || palette.gradient;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (hapticFeedback !== 'none') {
      haptic(hapticFeedback);
    }
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onClick={handleClick}
      className={`relative h-13 py-3.5 px-5 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2 select-none cursor-pointer overflow-hidden active:scale-[0.97] transition-all duration-200 ease-out transform-gpu ${
        block ? 'w-full' : ''
      } ${className}`}
      style={{
        background: currentTheme.bg,
        color: currentTheme.fg,
        boxShadow: currentTheme.shadow,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {shimmer && !disabled && (
        <div className="sheen-overlay" aria-hidden="true">
          <div className="sheen-sweep" />
        </div>
      )}

      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}

/* ==========================================================================
   4. Groove Points Glow Badge (Точечный акцент баланса GP в Liquid Glass)
   ========================================================================== */

export interface GpGlowBadgeProps {
  points: number;
  className?: string;
  style?: CSSProperties;
}

export function GpGlowBadge({ points, className = '', style }: GpGlowBadgeProps) {
  return (
    <div
      className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full select-none backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.16),0_4px_12px_rgba(0,0,0,0.3)] ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--brand-gold, #f3c969) 14%, var(--color-surface, #2e3432))',
        ...style,
      }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" fill="var(--brand-gold)" className="relative z-10">
        <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
      </svg>
      <b
        className="relative z-10 text-xs font-extrabold tracking-tight"
        style={{ color: 'var(--brand-gold, #f3c969)' }}
      >
        {points} GP
      </b>
    </div>
  );
}
