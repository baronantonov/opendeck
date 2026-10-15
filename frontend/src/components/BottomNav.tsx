import { useLocation, useNavigate } from 'react-router-dom';
import { haptic } from '../lib/theme';

interface TabItem {
  id: string;
  label: string;
  icon: (on: boolean) => JSX.Element;
}

const TABS: TabItem[] = [
  {
    id: 'home',
    label: 'Главная',
    icon: () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="13" rx="2.5" />
        <circle cx="7.5" cy="12.5" r="3" />
        <circle cx="7.5" cy="12.5" r="1" />
        <circle cx="16.5" cy="12.5" r="3" />
        <circle cx="16.5" cy="12.5" r="1" />
        <line x1="12" y1="9" x2="12" y2="16" />
      </svg>
    ),
  },
  {
    id: 'course',
    label: 'Курс',
    icon: () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="3" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'bonus',
    label: 'Бонусы',
    icon: () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
      </svg>
    ),
  },
  {
    id: 'mentor',
    label: 'Развитие',
    icon: () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="11" />
        <line x1="12" y1="7" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Профиль',
    icon: () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

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
        background: 'rgba(15, 18, 23, 0.94)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
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
              haptic('selection');
              nav(`/${t.id}` === '/home' ? '/' : `/${t.id}`);
            }}
            style={{
              flex: 1,
              position: 'relative',
              border: 'none',
              background: 'transparent',
              color: on ? '#00e5ff' : '#626d7c',
              padding: '9px 0 7px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: on ? 700 : 500,
              transition: 'color 0.15s ease',
            }}
          >
            {on && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  width: 20,
                  height: 2,
                  background: '#00e5ff',
                  borderRadius: 2,
                  boxShadow: '0 0 8px #00e5ff',
                }}
              />
            )}
            <div style={{ filter: on ? 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.45))' : 'none' }}>
              {t.icon(on)}
            </div>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
