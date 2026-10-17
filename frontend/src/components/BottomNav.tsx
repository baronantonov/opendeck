import { useLocation, useNavigate } from 'react-router-dom';
import { haptic } from '../lib/theme';

const TABS = [
  {
    id: 'home',
    label: 'Главная',
    path: '/',
    icon: 'M3 10l9-8 9 8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21V12h6v9',
  },
  {
    id: 'learn',
    label: 'Обучение',
    path: '/learn',
    icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  },
  {
    id: 'profile',
    label: 'Профиль',
    path: '/profile',
    icon: 'M12 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M5 19v-2a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2',
  },
] as const;

function DjPlayGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      style={{
        display: 'block',
        marginLeft: '2px', // оптическое центрирование вершины треугольника
      }}
    >
      {/* Крупный чистый треугольник PLAY в фирменном изумрудном тоне */}
      <path
        d="M7.5 5.2C7.5 4.3 8.5 3.7 9.3 4.2l10.4 6.8c0.8 0.5 0.8 1.7 0 2.2L9.3 20c-0.8 0.5-1.8-0.1-1.8-1V5.2Z"
        fill="#11322a"
      />
    </svg>
  );
}

export function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;
  const active =
    path === '/' || path === '/home'
      ? 'home'
      : path.startsWith('/learn') || path.startsWith('/course') || path.startsWith('/bonus') || path.startsWith('/mentor')
        ? 'learn'
        : path.startsWith('/profile')
          ? 'profile'
          : 'home';

  return (
    <nav
      className="animate-pop"
      style={{
        position: 'sticky',
        bottom: 0,
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'flex-end',
        background: 'color-mix(in srgb, var(--color-surface) 94%, #000)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
        paddingBottom: 'var(--app-safe-bottom, var(--safe-bottom, 0px))',
        zIndex: 50,
      }}
    >
      {TABS.map((t) => {
        const on = active === t.id;
        const isCenter = t.id === 'learn';

        if (isCenter) {
          return (
            <button
              key={t.id}
              onClick={() => {
                haptic('medium');
                nav(t.path);
              }}
              aria-label={t.label}
              className="dj-play-container"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: on ? 'var(--brand-mint)' : 'rgba(244, 247, 245, 0.72)',
                padding: '0 0 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 3,
                fontSize: 11,
                fontWeight: on ? 800 : 600,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div
                className={`dj-play-btn ${on ? 'dj-play-btn--active' : ''}`}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  marginTop: -16,
                  background: on
                    ? 'radial-gradient(circle at 40% 35%, #b6f8e7 0%, var(--brand-mint) 55%, #63dab5 100%)'
                    : 'radial-gradient(circle at 40% 35%, #a6f1dd 0%, var(--brand-mint) 55%, #66d4b0 100%)',
                  border: 'none',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
                }}
              >
                <DjPlayGlyph />
              </div>
              <span>{t.label}</span>
            </button>
          );
        }

        return (
          <button
            key={t.id}
            onClick={() => {
              haptic('light');
              nav(t.path);
            }}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: on ? 'var(--brand-mint)' : 'var(--color-text-dim)',
              padding: '11px 0 9px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: on ? 800 : 500,
              cursor: 'pointer',
              position: 'relative',
              transition: 'color 0.2s ease',
            }}
          >
            {on && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  width: 32,
                  height: 3,
                  borderRadius: '0 0 4px 4px',
                  background: 'var(--brand-mint)',
                }}
              />
            )}
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth={on ? '2.2' : '1.8'}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
