import { useEffect, useState, memo } from 'react';

export interface VinylLoaderProps {
  /** Управляет отображением прелоадера */
  isLoading: boolean;
  /** Пользовательский текст статуса загрузки */
  statusText?: string;
  /** Коллбэк после завершения анимации выхода */
  onExited?: () => void;
}

/**
 * Детализированный векторный компонент виниловой пластинки (SVG)
 * с концентрическими дорожками (grooves), диагональными световыми бликами
 * и фирменным акцентным яблоком Open Deck DJ School.
 */
export const VinylDisk = memo(function VinylDisk({
  size = 230,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'block',
        filter: 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.65))',
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Градиент акцентного центрального яблока Open Deck */}
        <linearGradient id="od-label-gradient" x1="20" y1="20" x2="220" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c0a0a8" />
          <stop offset="100%" stopColor="#8ce2c8" />
        </linearGradient>

        {/* Радиальный базовый градиент винилового тела диска */}
        <radialGradient id="od-vinyl-base" cx="120" cy="120" r="118" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a1e1d" />
          <stop offset="65%" stopColor="#121514" />
          <stop offset="98%" stopColor="#0b0d0c" />
          <stop offset="100%" stopColor="#252b29" />
        </radialGradient>

        {/* Диагональные отблески света на микро-канавках (Anisotropic reflection) */}
        <linearGradient id="od-sheen-sheaf-1" x1="120" y1="120" x2="215" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="od-sheen-sheaf-2" x1="120" y1="120" x2="25" y2="185" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Металлический шпиндель */}
        <linearGradient id="od-spindle-rim" x1="113" y1="113" x2="127" y2="127" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="50%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#d1d5db" />
        </linearGradient>
      </defs>

      {/* 1. Основа пластинки и внешний бортик (Outer Rim) */}
      <circle cx="120" cy="120" r="118" fill="url(#od-vinyl-base)" />
      <circle cx="120" cy="120" r="117.5" stroke="#37413d" strokeWidth="1" opacity="0.6" />
      <circle cx="120" cy="120" r="115" stroke="#1f2422" strokeWidth="1.5" />

      {/* 2. Концентрические звуковые дорожки (Lead-in & Music Grooves) */}
      {/* Lead-in groove */}
      <circle cx="120" cy="120" r="111" stroke="#ffffff" strokeWidth="0.5" opacity="0.08" />
      <circle cx="120" cy="120" r="108" stroke="#ffffff" strokeWidth="0.3" opacity="0.05" />

      {/* Секция внешнего трека */}
      <circle cx="120" cy="120" r="104" stroke="#ffffff" strokeWidth="0.4" opacity="0.06" />
      <circle cx="120" cy="120" r="101" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />
      <circle cx="120" cy="120" r="97" stroke="#ffffff" strokeWidth="0.5" opacity="0.07" />
      <circle cx="120" cy="120" r="94" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />
      <circle cx="120" cy="120" r="90" stroke="#ffffff" strokeWidth="0.45" opacity="0.06" />
      <circle cx="120" cy="120" r="87" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />

      {/* Разделитель треков (Song transition marker) */}
      <circle cx="120" cy="120" r="83.5" stroke="#000000" strokeWidth="1.5" opacity="0.8" />
      <circle cx="120" cy="120" r="82.5" stroke="#ffffff" strokeWidth="0.3" opacity="0.07" />

      {/* Секция среднего трека */}
      <circle cx="120" cy="120" r="79" stroke="#ffffff" strokeWidth="0.4" opacity="0.06" />
      <circle cx="120" cy="120" r="75" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />
      <circle cx="120" cy="120" r="71" stroke="#ffffff" strokeWidth="0.5" opacity="0.07" />
      <circle cx="120" cy="120" r="67" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />
      <circle cx="120" cy="120" r="63" stroke="#ffffff" strokeWidth="0.4" opacity="0.05" />
      <circle cx="120" cy="120" r="59" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />

      {/* Run-out groove (внутренняя выводная дорожка) */}
      <circle cx="120" cy="120" r="54" stroke="#000000" strokeWidth="1.8" opacity="0.9" />
      <circle cx="120" cy="120" r="51" stroke="#ffffff" strokeWidth="0.4" opacity="0.08" />
      <circle cx="120" cy="120" r="48" stroke="#ffffff" strokeWidth="0.25" opacity="0.05" />

      {/* 3. Реалистичные диагональные световые отблески (Световой веер) */}
      <polygon
        points="120,120 178,34 224,70"
        fill="url(#od-sheen-sheaf-1)"
        style={{ mixBlendMode: 'screen' }}
      />
      <polygon
        points="120,120 62,206 16,170"
        fill="url(#od-sheen-sheaf-2)"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Тонкий перпендикулярный контр-блик для объемного глянца */}
      <line x1="45" y1="45" x2="195" y2="195" stroke="#ffffff" strokeWidth="0.5" opacity="0.04" />
      <line x1="45" y1="195" x2="195" y2="45" stroke="#ffffff" strokeWidth="0.5" opacity="0.04" />

      {/* 4. Фирменный центральный лейбл (Яблоко пластинки) */}
      <circle cx="120" cy="120" r="41" fill="#141716" stroke="#2a302e" strokeWidth="1" />
      <circle cx="120" cy="120" r="39" fill="url(#od-label-gradient)" />
      <circle cx="120" cy="120" r="38" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="0.6" />
      <circle cx="120" cy="120" r="28" stroke="rgba(29, 31, 30, 0.25)" strokeWidth="0.6" strokeDasharray="2 2" />

      {/* Текстовые метки на яблоке */}
      <text
        x="120"
        y="103"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="800"
        letterSpacing="0.16em"
        fill="#1d1f1e"
        fontFamily="sans-serif"
      >
        OPEN DECK
      </text>
      <text
        x="120"
        y="110"
        textAnchor="middle"
        fontSize="4.5"
        fontWeight="700"
        letterSpacing="0.12em"
        fill="#2e3432"
        fontFamily="sans-serif"
      >
        DJ SCHOOL
      </text>

      {/* Техническая маркировка скорости */}
      <text
        x="120"
        y="136"
        textAnchor="middle"
        fontSize="4"
        fontWeight="600"
        letterSpacing="0.08em"
        fill="#2e3432"
        fontFamily="sans-serif"
      >
        33 ⅓ RPM · STEREO
      </text>

      {/* 5. Центральный стальной шпиндель с отверстием */}
      <circle cx="120" cy="120" r="7.5" fill="url(#od-spindle-rim)" stroke="#111312" strokeWidth="0.8" />
      <circle cx="120" cy="120" r="4.2" fill="#0b0d0c" />
    </svg>
  );
});

/**
 * Полноэкранный брендированный экран загрузки (Vinyl Splash Screen).
 * Отображает крутящийся винил с мягким фоновым сиянием и осуществляет
 * бесшовный fade-out + scale-up переход после готовности данных приложения.
 * Гарантирует минимальное время показа (1350ms), чтобы переход был кинематографичным.
 */
export function VinylLoader({
  isLoading,
  statusText = 'Синхронизация битов...',
  onExited,
}: VinylLoaderProps) {
  // Всегда начинаем с отображения прелоадера при старте приложения
  const [shouldRender, setShouldRender] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // 1. Таймер минимального времени показа винила (1350мс)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1350);
    return () => window.clearTimeout(timer);
  }, []);

  // 2. Логика выхода: только когда данные готовы И прошло минимальное время
  useEffect(() => {
    if (!isLoading && minTimeElapsed && !isExiting) {
      setIsExiting(true);
      const exitTimer = window.setTimeout(() => {
        setShouldRender(false);
        onExited?.();
      }, 380);
      return () => window.clearTimeout(exitTimer);
    }
  }, [isLoading, minTimeElapsed, isExiting, onExited]);

  // Возможность тапнуть по экрану для мгновенного пропуска
  const handleQuickSkip = () => {
    if (!isExiting) {
      setIsExiting(true);
      window.setTimeout(() => {
        setShouldRender(false);
        onExited?.();
      }, 200);
    }
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Загрузка приложения Open Deck DJ School"
      onClick={handleQuickSkip}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center select-none cursor-pointer ${
        isExiting ? 'animate-splash-exit' : ''
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 45%, #323835 0%, #202422 65%, #141716 100%)',
        touchAction: 'none',
      }}
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Мягкая пульсирующая подложка Ambient Glow */}
        <div
          className="absolute rounded-full animate-vinyl-ambient"
          style={{
            width: 270,
            height: 270,
            background:
              'radial-gradient(circle, rgba(140, 226, 200, 0.35) 0%, rgba(192, 160, 168, 0.25) 45%, transparent 75%)',
            filter: 'blur(32px)',
            pointerEvents: 'none',
          }}
        />

        {/* Контейнер непрерывного вращения виниловой пластинки (3s linear infinite) */}
        <div className="relative z-10 animate-spin-vinyl">
          <VinylDisk size={230} />
        </div>

        {/* Брендовая текстовая подпись и статус загрузки */}
        <div className="mt-8 flex flex-col items-center gap-2.5 text-center z-10">
          <h2
            className="brand-text text-xl font-bold tracking-[0.16em] uppercase m-0"
            style={{ fontFamily: 'var(--font-display, sans-serif)' }}
          >
            Open Deck
          </h2>
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--color-text-dim)]">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand-mint)] animate-pulse"
              style={{ animationDuration: '1.4s' }}
            />
            <span>{statusText}</span>
          </div>

          {/* Аккуратный анимированный прогресс-бар загрузки */}
          <div
            style={{
              width: 130,
              height: 3,
              borderRadius: 99,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'var(--brand-gradient)',
                borderRadius: 99,
                animation: 'shimmer 1.35s ease-out forwards',
                width: '100%',
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
