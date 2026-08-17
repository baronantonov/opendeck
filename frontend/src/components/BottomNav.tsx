import { useLocation, useNavigate } from 'react-router-dom';
import { haptic } from '../lib/theme';

const TABS = [
  { id: 'home', label: 'Главная', icon: 'M3 10l9-8 9 8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21V12h6v9' },
  { id: 'course', label: 'Курс', icon: 'M12 12m-8.5 0a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0 M10 9.2a1 1 0 0 1 1.1-1l4 2.3a1 1 0 0 1 0 1.7l-4 2.3A1 1 0 0 1 10 14.8z' },
  { id: 'bonus', label: 'Бонусы', icon: 'M20 12l-8-8-8 8 8 8 8-8z M12 4v16' },
  { id: 'mentor', label: 'Развитие', icon: 'M23 6 13.5 15.5 8.5 10.5 1 18 M17 6 23 6 23 12' },
  { id: 'profile', label: 'Профиль', icon: 'M12 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M5 19v-2a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2' },
] as const;

export function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  const active = loc.pathname.split('/')[1] || 'home';

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        marginTop: 'auto',
        display: 'flex',
        background: 'color-mix(in srgb, var(--color-surface) 92%, #000)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
        paddingBottom: 'var(--safe-bottom)',
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
              nav(`/${t.id}` === '/home' ? '/' : `/${t.id}`);
            }}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: on ? 'var(--color-mint)' : 'var(--color-text-dim)',
              padding: '10px 0 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              fontSize: 10.5,
              fontWeight: on ? 700 : 500,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
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
