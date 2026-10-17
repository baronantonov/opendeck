import { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useHomeScreenBanner } from '../lib/useHomeScreenBanner';

export interface HomeScreenBannerProps {
  /** Флаг активности/завершения экрана загрузки */
  active?: boolean;
  splashFinished?: boolean;
}

/**
 * Плавающий баннер добавления ярлыка на рабочий стол:
 * - Глобальный сессионный лимит показа (sessionStorage)
 * - Автоскрытие через 8 секунд с индикатором прогресса
 * - Задержка показа ровно 2 секунды
 * - Аппаратное ускорение (translateZ, willChange) и плавный transition на Tailwind CSS
 * - Динамический отступ над таб-баром с учетом safe-area
 * - Сквозной клик вокруг карточки (pointer-events-none для обертки, pointer-events-auto для баннера)
 */
export function HomeScreenBanner({ active = true, splashFinished }: HomeScreenBannerProps) {
  // Страховочный таймер: если splash screen по какой-то причине не прислал onExited
  const [splashTimeout, setSplashTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashTimeout(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const isSplashDone = splashFinished !== undefined ? (splashFinished || splashTimeout) : true;
  const isEnabled = active && isSplashDone;
  const { isMounted, isVisible, progress, dismiss, handleAdd } = useHomeScreenBanner(isEnabled);

  if (!isMounted) return null;

  return (
    <aside
      aria-label="Добавить ярлык на рабочий стол"
      className="fixed left-0 right-0 z-[120] pointer-events-none flex justify-center px-3"
      style={{
        bottom: 'calc(var(--app-safe-bottom, var(--safe-bottom, 0px)) + var(--tabbar-height, 68px) + 12px)',
      }}
    >
      <div
        className={`pointer-events-auto w-full max-w-[420px] transition-all duration-300 ease-out transform ${
          isVisible
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-2 opacity-0 scale-95 pointer-events-none'
        }`}
        style={{
          willChange: 'transform, opacity',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
      >
        <div
          style={{
            width: '100%',
            background: 'color-mix(in srgb, var(--color-surface) 95%, #000)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 18,
            border: '1px solid color-mix(in srgb, var(--brand-mint) 35%, transparent)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(140, 226, 200, 0.12)',
            padding: '12px 14px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Иконка смартфона с фирменным мятным свечением */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--brand-mint) 14%, var(--color-surface))',
              border: '1px solid color-mix(in srgb, var(--brand-mint) 30%, transparent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--brand-mint)',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(140, 226, 200, 0.18)',
            }}
          >
            <Smartphone size={20} />
          </div>

          {/* Текстовый блок */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: 'var(--color-text)',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Ярлык на экран
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--color-text-dim)',
                lineHeight: 1.3,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Прямой запуск без шапки Telegram
            </div>
          </div>

          {/* Кнопки действий */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleAdd}
              style={{
                border: 'none',
                borderRadius: 10,
                background: 'var(--brand-mint)',
                color: '#11322a',
                fontSize: 12.5,
                fontWeight: 800,
                padding: '7px 13px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(140, 226, 200, 0.25)',
                transition: 'transform 0.15s ease',
              }}
              className="active:scale-95"
            >
              Добавить
            </button>

            <button
              type="button"
              onClick={() => dismiss(true)}
              aria-label="Скрыть"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--color-text-dim)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-white/10 active:scale-90"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>

          {/* Тонкий акцентный индикатор прогресса автоскрытия (8 секунд) */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 2.5,
              width: `${progress}%`,
              background: 'var(--brand-mint)',
              boxShadow: '0 0 8px var(--brand-mint)',
              transition: 'width 0.05s linear',
            }}
          />
        </div>
      </div>
    </aside>
  );
}
