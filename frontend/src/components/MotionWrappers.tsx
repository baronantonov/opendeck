import {
  type ReactNode,
  type CSSProperties,
  type ButtonHTMLAttributes,
  Children,
  isValidElement,
  cloneElement,
  memo,
} from 'react';
import { haptic } from '../lib/theme';

/* ==========================================================================
   1. Staggered Entrance Wrappers (Каскадное появление виджетов)
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

    // Если ребенок уже StaggerItem, передаем ему высчитанную задержку,
    // иначе оборачиваем в StaggerItem автоматически.
    if ((child.type as any)?.displayName === 'StaggerItem') {
      return cloneElement(child, {
        delayMs: child.props.delayMs ?? computedDelay,
      } as any);
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

/**
 * Обертка отдельного виджета или карточки с аппаратным выходом снизу вверх:
 * translateY(12px) -> translateY(0), opacity: 0 -> 1, cubic-bezier(0.22, 1, 0.36, 1).
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

  const itemStyle: CSSProperties = {
    ...style,
    ['--stagger-delay' as any]: `${calculatedDelay}ms`,
  };

  return (
    <div className={`stagger-item ${className}`} style={itemStyle}>
      {children}
    </div>
  );
});
StaggerItem.displayName = 'StaggerItem';

/* ==========================================================================
   2. Glow & Animated Border Card (Премиум-виджет с мягким сиянием)
   ========================================================================== */

export interface GlowCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Отображение акцентной полоски бренда сверху карточки */
  strip?: boolean;
  /** Включение деликатного фонового Ambient Glow (blur-xl, opacity 20-30%) */
  ambientGlow?: boolean;
  /** Включение переливающейся 1px градиентной рамки */
  animatedBorder?: boolean;
  onClick?: () => void;
}

/**
 * Карточка с точечным визуальным акцентом: переливающаяся рамка (1px border-gradient)
 * и деликатный фоновый Ambient Glow без перегруза интерфейса.
 */
export function GlowCard({
  children,
  className = '',
  style,
  strip = false,
  ambientGlow = true,
  animatedBorder = true,
  onClick,
}: GlowCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-[18px] p-4 text-[var(--color-text)] select-none ${
        animatedBorder ? 'glow-card-border' : 'brand-card'
      } ${strip ? 'brand-strip' : ''} ${className}`}
      style={{
        background: 'var(--color-surface, #2e3432)',
        ...style,
      }}
    >
      {/* Деликатный фоновый Ambient Glow (глубина без кислотности) */}
      {ambientGlow && <div className="glow-card-ambient" aria-hidden="true" />}

      {/* Контент карточки */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

/* ==========================================================================
   3. Shimmer Button (Целевая CTA-кнопка с пробегающим бликом)
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

/**
 * Премиум CTA-кнопка с плавным диагональным бликом (Shimmer/Sheen effect),
 * пробегающим раз в ~5 секунд, аппаратным масштабированием при нажатии и Telegram haptic.
 */
export function ShimmerButton({
  children,
  variant = 'gradient',
  block = false,
  shimmer = true,
  hapticFeedback = 'medium',
  className = '',
  style,
  onClick,
  disabled,
  ...rest
}: ShimmerButtonProps) {
  const palette: Record<string, { bg: string; fg: string }> = {
    primary: { bg: 'var(--brand-mauve)', fg: '#1d1f1e' },
    gradient: { bg: 'var(--brand-gradient)', fg: '#1d1f1e' },
    coral: { bg: 'var(--brand-coral)', fg: '#241410' },
    mint: { bg: 'var(--brand-mint)', fg: '#11322a' },
    secondary: {
      bg: 'color-mix(in srgb, var(--color-text) 14%, transparent)',
      fg: 'var(--color-text)',
    },
    ghost: {
      bg: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
      fg: 'var(--color-text)',
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
      className={`relative inline-flex items-center justify-center gap-2 font-bold select-none cursor-pointer overflow-hidden transition-transform duration-150 active:scale-[0.98] ${
        block ? 'w-full' : ''
      } ${className}`}
      style={{
        borderRadius: 14,
        padding: '13px 20px',
        fontSize: 15,
        background: currentTheme.bg,
        color: currentTheme.fg,
        border: 'none',
        opacity: disabled ? 0.5 : 1,
        boxShadow:
          variant === 'gradient' || variant === 'coral'
            ? '0 6px 20px -6px rgba(0, 0, 0, 0.45)'
            : 'none',
        ...style,
      }}
    >
      {/* Пробегающий блик света (Sheen) с прозрачными краями */}
      {shimmer && !disabled && (
        <div className="sheen-overlay" aria-hidden="true">
          <div className="sheen-sweep" />
        </div>
      )}

      {/* Текст и иконки кнопки */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}

/* ==========================================================================
   4. Groove Points Glow Badge (Точечный акцент баланса GP)
   ========================================================================== */

export interface GpGlowBadgeProps {
  points: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Акцентный бейдж баланса Groove Points с мягким золотистым Ambient Glow
 * и премиальной окантовкой.
 */
export function GpGlowBadge({ points, className = '', style }: GpGlowBadgeProps) {
  return (
    <div
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full select-none ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--brand-gold, #f3c969) 14%, var(--color-surface, #2e3432))',
        border: '1px solid color-mix(in srgb, var(--brand-gold, #f3c969) 36%, transparent)',
        boxShadow: '0 2px 10px rgba(243, 201, 105, 0.14)',
        ...style,
      }}
    >
      {/* Мягкое золотистое свечение позади */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(243, 201, 105, 0.28) 0%, transparent 75%)',
          filter: 'blur(8px)',
          opacity: 0.6,
        }}
        aria-hidden="true"
      />

      <svg width={13} height={13} viewBox="0 0 24 24" fill="var(--brand-gold)" className="relative z-10">
        <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
      </svg>
      <b
        className="relative z-10 text-[13px] font-extrabold tracking-tight"
        style={{ color: 'var(--brand-gold, #f3c969)' }}
      >
        {points} GP
      </b>
    </div>
  );
}
