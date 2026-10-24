import { memo } from 'react';

export interface AbstractGeometryBgProps {
  /** Вариант композиции векторных линий и фигур */
  variant?: 'hero' | 'card' | 'vip' | 'player' | 'modal' | 'mentor' | 'passport';
  /**
   * Количество анимированных глубинных световых сфер (строго 0, 1 или 2 на экран
   * для гарантии 60-120 FPS и отсутствия пересветов)
   */
  spheres?: 0 | 1 | 2;
  /** Цветовой акцент основной сферы */
  accent?: 'mint' | 'mauve' | 'coral' | 'gold';
  /** Опциональное переопределение основного цвета сферы */
  primaryColor?: string;
  /** Опциональное переопределение вторичного цвета сферы */
  secondaryColor?: string;
}

const ACCENT_COLOR_MAP: Record<NonNullable<AbstractGeometryBgProps['accent']>, string> = {
  mint: 'var(--brand-mint, #8ce2c8)',
  mauve: 'var(--brand-mauve, #c0a0a8)',
  coral: 'var(--brand-coral, #f5926e)',
  gold: 'var(--brand-gold, #f3c969)',
};

/**
 * Многослойная фоновая графика в эстетике Liquid Glass:
 * - Векторные абстрактные геометрические фигуры и плавные изогнутые линии (opacity-[0.07])
 * - Глубинные световые сферы с аппаратным GPU-дрейфом (animate-ambient-drift 16–18s, opacity 15–22%, blur-3xl)
 */
export const AbstractGeometryBg = memo(function AbstractGeometryBg({
  variant = 'card',
  spheres = 0,
  accent = 'mint',
  primaryColor: customPrimary,
  secondaryColor: customSecondary,
}: AbstractGeometryBgProps) {
  const primaryColor = customPrimary || ACCENT_COLOR_MAP[accent];
  const secondaryColor =
    customSecondary ||
    (accent === 'mint'
      ? 'var(--brand-mauve, #c0a0a8)'
      : accent === 'gold'
        ? 'var(--brand-coral, #f5926e)'
        : 'var(--brand-mint, #8ce2c8)');

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] select-none"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      {/* 1. Анимированная сфера #1 (аппаратное ускорение GPU, строгий контроль яркости opacity-20) */}
      {spheres >= 1 && (
        <div
          className="animate-ambient-drift absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-20 transform-gpu"
          style={{
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 72%)`,
          }}
        />
      )}

      {/* 2. Анимированная сфера #2 (опционально, строго не более 2 на экран, opacity-15) */}
      {spheres === 2 && (
        <div
          className="animate-ambient-drift-slow absolute -bottom-14 -left-10 h-40 w-40 rounded-full blur-3xl opacity-15 transform-gpu"
          style={{
            background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 72%)`,
          }}
        />
      )}

      {/* 3. Статический деликатный градиент глубины (для карточек без динамических сфер) */}
      {spheres === 0 && (
        <div
          className="absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl opacity-15"
          style={{
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* 4. Векторная абстрактная геометрия и плавные изогнутые линии (opacity-[0.07]) */}
      <svg
        viewBox="0 0 400 220"
        fill="none"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-[0.07]"
      >
        {variant === 'hero' && (
          <>
            <path
              d="M-30 180 C 90 60, 220 230, 430 40"
              stroke="var(--brand-mint)"
              strokeWidth="1.5"
            />
            <path
              d="M-20 110 C 120 10, 260 170, 420 90"
              stroke="var(--brand-mauve)"
              strokeWidth="1.2"
            />
            <circle cx="340" cy="48" r="64" stroke="var(--brand-mint)" strokeWidth="1.2" />
            <circle cx="340" cy="48" r="38" stroke="var(--brand-gold)" strokeWidth="1" strokeDasharray="4 6" />
            <polygon
              points="310,16 378,38 336,96"
              stroke="var(--brand-mint)"
              strokeWidth="1"
            />
          </>
        )}

        {(variant === 'vip' || variant === 'player') && (
          <>
            <path
              d="M-20 190 Q 150 20 420 130"
              stroke="var(--brand-mint)"
              strokeWidth="1.5"
            />
            <path
              d="M-20 70 Q 220 190 420 30"
              stroke="var(--brand-gold)"
              strokeWidth="1.2"
            />
            <polygon
              points="330,22 382,66 346,124 292,80"
              stroke="var(--brand-mint)"
              strokeWidth="1.2"
            />
            <circle cx="337" cy="73" r="46" stroke="var(--brand-mauve)" strokeWidth="1" />
          </>
        )}

        {variant === 'mentor' && (
          <>
            <path
              d="M-10 165 C 110 45, 250 185, 415 55"
              stroke="var(--brand-gold)"
              strokeWidth="1.5"
            />
            <circle cx="345" cy="52" r="54" stroke="var(--brand-gold)" strokeWidth="1.2" />
            <circle cx="345" cy="52" r="28" stroke="var(--brand-coral)" strokeWidth="1" />
          </>
        )}

        {variant === 'modal' && (
          <>
            <path
              d="M-20 140 C 110 20, 270 190, 420 45"
              stroke="var(--brand-mint)"
              strokeWidth="1.4"
            />
            <circle cx="350" cy="42" r="52" stroke="var(--brand-mauve)" strokeWidth="1.1" />
            <polygon
              points="40,180 95,130 130,195"
              stroke="var(--brand-mint)"
              strokeWidth="1"
            />
          </>
        )}

        {(variant === 'card' || variant === 'passport') && (
          <>
            <path
              d="M-15 160 C 130 50, 260 180, 415 60"
              stroke="var(--brand-mint)"
              strokeWidth="1.3"
            />
            <circle cx="348" cy="46" r="48" stroke="var(--brand-mauve)" strokeWidth="1.1" />
            {variant === 'passport' && (
              <polygon
                points="320,18 378,52 342,108"
                stroke="var(--brand-gold)"
                strokeWidth="1"
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
});
