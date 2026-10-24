import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Users, User } from 'lucide-react';
import { haptic } from '../lib/theme';
import { getTelegramWebApp } from '../types';
import { MarketToast } from './MarketToast';

function DjPlayGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      className="block translate-x-[1px]"
    >
      {/* Чистый классический треугольник PLAY без черных или белых кантиков */}
      <path
        d="M7.5 5.2C7.5 4.3 8.5 3.7 9.3 4.2l10.4 6.8c0.8 0.5 0.8 1.7 0 2.2L9.3 20c-0.8 0.5-1.8-0.1-1.8-1V5.2Z"
        fill="#11322a"
      />
    </svg>
  );
}

function triggerLightHaptic() {
  const tg = getTelegramWebApp();
  try {
    if (tg?.HapticFeedback?.impactOccurred) {
      tg.HapticFeedback.impactOccurred('light');
      return;
    }
  } catch {
    /* fallback */
  }
  haptic('light');
}

export function TabBar() {
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;

  const active =
    path === '/' || path === '/home'
      ? 'home'
      : path.startsWith('/learn') ||
          path.startsWith('/course') ||
          path.startsWith('/bonus') ||
          path.startsWith('/mentor')
        ? 'learn'
        : path.startsWith('/tribe')
          ? 'tribe'
          : path.startsWith('/profile')
            ? 'profile'
            : 'home';

  const [marketPopupOpen, setMarketPopupOpen] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCloseMarketPopup = useCallback(() => {
    triggerLightHaptic();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMarketPopupOpen(false);
  }, []);

  const handleMarketClick = () => {
    triggerLightHaptic();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setMarketPopupOpen(true);
    setTimerKey((k) => k + 1);

    timerRef.current = setTimeout(() => {
      setMarketPopupOpen(false);
      timerRef.current = null;
    }, 8000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Изоляция на экране урока: при открытии полноэкранного вертикального урока скрываем капсулу TabBar
  if (path.startsWith('/lesson')) {
    return null;
  }

  return (
    <>
      <MarketToast
        open={marketPopupOpen}
        timerKey={timerKey}
        onClose={handleCloseMarketPopup}
      />

      {/* Парящая стеклянная капсула (Floating Island) в стиле Liquid Glass */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-[480px] justify-center">
        <nav
          aria-label="Главное меню"
          className="pointer-events-auto relative mx-4 mb-[calc(env(safe-area-inset-bottom,0px)+12px)] grid w-full grid-cols-5 items-end rounded-3xl px-1.5 pb-2 pt-1.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.5)] select-none"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 76%, rgba(20, 24, 23, 0.84))',
          }}
        >
          {/* 1) ГЛАВНАЯ */}
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              nav('/');
            }}
            aria-label="ГЛАВНАЯ"
            className="relative flex w-full min-w-0 flex-col items-center justify-end gap-1 py-1.5 uppercase active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              color: active === 'home' ? 'var(--brand-mint)' : 'var(--color-text-dim)',
              fontSize: 9.5,
              fontWeight: active === 'home' ? 800 : 600,
              letterSpacing: '0.03em',
              background: 'transparent',
              border: 'none',
            }}
          >
            {active === 'home' && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 inset-y-0.5 rounded-2xl opacity-20 blur-md"
                style={{ background: 'var(--brand-mint)' }}
              />
            )}
            <Home size={20} strokeWidth={active === 'home' ? 2.3 : 1.8} className="relative z-10" />
            <span className="relative z-10 max-w-full truncate px-0.5 leading-tight">
              ГЛАВНАЯ
            </span>
          </button>

          {/* 2) МАРКЕТ */}
          <button
            type="button"
            onClick={handleMarketClick}
            aria-label="МАРКЕТ"
            className="relative flex w-full min-w-0 flex-col items-center justify-end gap-1 py-1.5 uppercase active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              color: marketPopupOpen ? 'var(--brand-mint)' : 'var(--color-text-dim)',
              fontSize: 9.5,
              fontWeight: marketPopupOpen ? 800 : 600,
              letterSpacing: '0.03em',
              background: 'transparent',
              border: 'none',
            }}
          >
            {marketPopupOpen && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 inset-y-0.5 rounded-2xl opacity-20 blur-md"
                style={{ background: 'var(--brand-mint)' }}
              />
            )}
            <ShoppingBag size={20} strokeWidth={marketPopupOpen ? 2.3 : 1.8} className="relative z-10" />
            <span className="relative z-10 max-w-full truncate px-0.5 leading-tight">
              МАРКЕТ
            </span>
          </button>

          {/* 3) ОБУЧЕНИЕ (Центральная акцентная кнопка с чистым треугольником PLAY) */}
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              nav('/learn');
            }}
            aria-label="ОБУЧЕНИЕ"
            className="dj-play-container relative flex w-full min-w-0 flex-col items-center justify-end gap-1 pb-1.5 pt-0 uppercase active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              color: active === 'learn' ? 'var(--brand-mint)' : 'var(--color-text)',
              fontSize: 9.5,
              fontWeight: active === 'learn' ? 800 : 700,
              letterSpacing: '0.03em',
              background: 'transparent',
              border: 'none',
            }}
          >
            {active === 'learn' && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1 bottom-0.5 top-2 rounded-2xl opacity-25 blur-lg"
                style={{ background: 'var(--brand-mint)' }}
              />
            )}
            <div
              className={`dj-play-btn relative z-10 -mt-5 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ease-out ${
                active === 'learn' ? 'dj-play-btn--active' : ''
              }`}
              style={{
                background:
                  active === 'learn'
                    ? 'radial-gradient(circle at 38% 32%, #b6f8e7 0%, var(--brand-mint) 58%, #63dab5 100%)'
                    : 'radial-gradient(circle at 38% 32%, #a6f1dd 0%, var(--brand-mint) 58%, #66d4b0 100%)',
                border: 'none',
                outline: 'none',
              }}
            >
              <DjPlayGlyph />
            </div>
            <span className="relative z-10 max-w-full truncate px-0.5 leading-tight">
              ОБУЧЕНИЕ
            </span>
          </button>

          {/* 4) ПЛЕМЯ */}
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              nav('/tribe');
            }}
            aria-label="ПЛЕМЯ"
            className="relative flex w-full min-w-0 flex-col items-center justify-end gap-1 py-1.5 uppercase active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              color: active === 'tribe' ? 'var(--brand-mint)' : 'var(--color-text-dim)',
              fontSize: 9.5,
              fontWeight: active === 'tribe' ? 800 : 600,
              letterSpacing: '0.03em',
              background: 'transparent',
              border: 'none',
            }}
          >
            {active === 'tribe' && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 inset-y-0.5 rounded-2xl opacity-20 blur-md"
                style={{ background: 'var(--brand-mint)' }}
              />
            )}
            <Users size={20} strokeWidth={active === 'tribe' ? 2.3 : 1.8} className="relative z-10" />
            <span className="relative z-10 max-w-full truncate px-0.5 leading-tight">
              ПЛЕМЯ
            </span>
          </button>

          {/* 5) ПРОФИЛЬ */}
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              nav('/profile');
            }}
            aria-label="ПРОФИЛЬ"
            className="relative flex w-full min-w-0 flex-col items-center justify-end gap-1 py-1.5 uppercase active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
            style={{
              color: active === 'profile' ? 'var(--brand-mint)' : 'var(--color-text-dim)',
              fontSize: 9.5,
              fontWeight: active === 'profile' ? 800 : 600,
              letterSpacing: '0.03em',
              background: 'transparent',
              border: 'none',
            }}
          >
            {active === 'profile' && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 inset-y-0.5 rounded-2xl opacity-20 blur-md"
                style={{ background: 'var(--brand-mint)' }}
              />
            )}
            <User size={20} strokeWidth={active === 'profile' ? 2.3 : 1.8} className="relative z-10" />
            <span className="relative z-10 max-w-full truncate px-0.5 leading-tight">
              ПРОФИЛЬ
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}

export default TabBar;
