import { Smartphone, X } from 'lucide-react';
import { useHomeScreen } from '../lib/useHomeScreen';

export interface HomeScreenBannerProps {
  splashFinished: boolean;
}

export function HomeScreenBanner({ splashFinished }: HomeScreenBannerProps) {
  const { isVisible, progress, dismiss, handleAdd } = useHomeScreen(splashFinished);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(58px + var(--app-safe-bottom, var(--safe-bottom, 0px)) + 12px)',
        left: 14,
        right: 14,
        maxWidth: 440,
        margin: '0 auto',
        zIndex: 80,
        boxSizing: 'border-box',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="animate-pop"
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
        {/* Иконка смартфона с мятным свечением */}
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
            Быстрый вход без шапки Telegram
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
            onClick={dismiss}
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
            boxShadow: '0 0 6px var(--brand-mint)',
            transition: 'width 0.05s linear',
          }}
        />
      </div>
    </div>
  );
}
