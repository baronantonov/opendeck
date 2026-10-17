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
      style={{
        position: 'sticky',
        bottom: 0,
        marginTop: 'auto',
        display: 'flex',
        background: 'color-mix(in srgb, var(--color-surface) 94%, #000)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
        paddingBottom: 'var(--app-safe-bottom, var(--safe-bottom, 0px))',
        zIndex: 50,
      }}
    >
      {TABS.map((t) => {
        const on = active === t.id;
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
