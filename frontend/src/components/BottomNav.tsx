import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Users, User } from 'lucide-react';
import { haptic } from '../lib/theme';
import { getTelegramWebApp } from '../types';
import { useRegisterModal } from '../lib/navigation';

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
      {/* Крупный чистый классический треугольник PLAY без лишних кантиков и обводок */}
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

  // Определение активного раздела по URL
  const active =
    path === '/' || path === '/home'
      ? 'home'
      : path.startsWith('/learn') || path.startsWith('/course') || path.startsWith('/bonus') || path.startsWith('/mentor')
        ? 'learn'
        : path.startsWith('/tribe')
          ? 'tribe'
          : path.startsWith('/profile')
            ? 'profile'
            : 'home';

  // Состояние и таймер для автоисчезающей плашки «МАРКЕТ» (8 секунд)
  const [marketPopupOpen, setMarketPopupOpen] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCloseMarketPopup = useCallback(() => {
    const tg = getTelegramWebApp();
    try {
      if (tg?.HapticFeedback?.impactOccurred) {
        tg.HapticFeedback.impactOccurred('light');
      } else {
        haptic('light');
      }
    } catch {
      /* fallback */
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMarketPopupOpen(false);
  }, []);

  // Регистрация попапа в глобальном стеке модалок для закрытия по кнопке «Назад»
  useRegisterModal('market_popup', marketPopupOpen, handleCloseMarketPopup);

  const handleMarketClick = () => {
    const tg = getTelegramWebApp();
    try {
      if (tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred('warning');
      } else {
        haptic('warning');
      }
    } catch {
      /* fallback */
    }

    // Если таймер уже тикал — сбрасываем его
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Открываем попап и перезапускаем 8-секундный таймер и шкалу прогресса
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

  // На экране урока /lesson/:id скрываем таббар для полноэкранного режима плеера
  if (path.startsWith('/lesson')) {
    return null;
  }

  return (
    <>
      {/* Кастомная всплывающая плашка «МАРКЕТ» с автоскрытием через 8 секунд */}
      <div
        role="alert"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: 14,
          right: 14,
          bottom: 'calc(var(--tabbar-height, 68px) + var(--app-safe-bottom, var(--safe-bottom, 0px)) + 10px)',
          maxWidth: 452,
          margin: '0 auto',
          background: 'color-mix(in srgb, var(--color-surface) 95%, #000)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          border: '1px solid color-mix(in srgb, var(--brand-mint) 28%, var(--color-line))',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(140, 226, 200, 0.12)',
          overflow: 'hidden',
          zIndex: 60,
          opacity: marketPopupOpen ? 1 : 0,
          transform: marketPopupOpen ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.96)',
          pointerEvents: marketPopupOpen ? 'auto' : 'none',
          transition: 'opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(140, 226, 200, 0.14)',
                border: '1px solid rgba(140, 226, 200, 0.28)',
                color: 'var(--brand-mint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShoppingBag size={18} />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.35,
                color: 'var(--color-text)',
                fontWeight: 500,
              }}
            >
              Возможно позже тут появится что-то интересное...
            </p>
          </div>

          <button
            type="button"
            onClick={handleCloseMarketPopup}
            style={{
              border: '1px solid rgba(140, 226, 200, 0.35)',
              background: 'rgba(140, 226, 200, 0.12)',
              color: 'var(--brand-mint)',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              padding: '7px 12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background 0.15s ease, transform 0.1s ease',
            }}
          >
            Ок, ясно
          </button>
        </div>

        {/* Тонкий линейный индикатор обратного отсчета ровно на 8000 мс */}
        <div
          style={{
            height: 2.5,
            background: 'rgba(255, 255, 255, 0.08)',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {marketPopupOpen && (
            <div
              key={timerKey}
              style={{
                height: '100%',
                width: '100%',
                background: 'var(--brand-gradient)',
                animation: 'market-countdown 8000ms linear forwards',
                transformOrigin: 'left',
              }}
            />
          )}
        </div>
      </div>

      {/* Нижняя панель навигации (5 пунктов в ВЕРХНЕМ РЕГИСТРЕ, симметричная сетка grid-cols-5) */}
      <nav
        className="animate-pop"
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'end',
          width: '100%',
          background: 'color-mix(in srgb, var(--color-surface) 94%, #000)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
          paddingBottom: 'var(--app-safe-bottom, var(--safe-bottom, 0px))',
          zIndex: 50,
        }}
      >
        {/* 1) ГЛАВНАЯ (слева) */}
        <button
          type="button"
          onClick={() => {
            haptic('light');
            nav('/');
          }}
          aria-label="ГЛАВНАЯ"
          style={{
            border: 'none',
            background: 'transparent',
            color: active === 'home' ? 'var(--brand-mint)' : 'var(--color-text-dim)',
            padding: '9px 0 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            fontSize: 9.5,
            fontWeight: active === 'home' ? 800 : 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.2s ease',
            minWidth: 0,
            width: '100%',
            userSelect: 'none',
          }}
        >
          {active === 'home' && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                width: 24,
                height: 3,
                borderRadius: '0 0 4px 4px',
                background: 'var(--brand-mint)',
              }}
            />
          )}
          <Home size={20} strokeWidth={active === 'home' ? 2.2 : 1.8} />
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              padding: '0 2px',
              lineHeight: 1.1,
            }}
          >
            ГЛАВНАЯ
          </span>
        </button>

        {/* 2) МАРКЕТ (между «ГЛАВНАЯ» и «ОБУЧЕНИЕ») */}
        <button
          type="button"
          onClick={handleMarketClick}
          aria-label="МАРКЕТ"
          style={{
            border: 'none',
            background: 'transparent',
            color: marketPopupOpen ? 'var(--brand-mint)' : 'var(--color-text-dim)',
            padding: '9px 0 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            fontSize: 9.5,
            fontWeight: marketPopupOpen ? 800 : 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.2s ease',
            minWidth: 0,
            width: '100%',
            userSelect: 'none',
          }}
        >
          <ShoppingBag size={20} strokeWidth={marketPopupOpen ? 2.2 : 1.8} />
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              padding: '0 2px',
              lineHeight: 1.1,
            }}
          >
            МАРКЕТ
          </span>
        </button>

        {/* 3) ОБУЧЕНИЕ (центральная акцентная кнопка с классическим треугольником PLAY) */}
        <button
          type="button"
          onClick={() => {
            haptic('medium');
            nav('/learn');
          }}
          aria-label="ОБУЧЕНИЕ"
          className="dj-play-container"
          style={{
            border: 'none',
            background: 'transparent',
            color: active === 'learn' ? 'var(--brand-mint)' : 'rgba(244, 247, 245, 0.72)',
            padding: '0 0 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            fontSize: 9.5,
            fontWeight: active === 'learn' ? 800 : 700,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
            minWidth: 0,
            width: '100%',
            userSelect: 'none',
          }}
        >
          <div
            className={`dj-play-btn ${active === 'learn' ? 'dj-play-btn--active' : ''}`}
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              marginTop: -16,
              background:
                active === 'learn'
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
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              padding: '0 2px',
              lineHeight: 1.1,
            }}
          >
            ОБУЧЕНИЕ
          </span>
        </button>

        {/* 4) ПЛЕМЯ (справа от «ОБУЧЕНИЕ», перед «ПРОФИЛЬ») */}
        <button
          type="button"
          onClick={() => {
            haptic('light');
            nav('/tribe');
          }}
          aria-label="ПЛЕМЯ"
          style={{
            border: 'none',
            background: 'transparent',
            color: active === 'tribe' ? 'var(--brand-mint)' : 'var(--color-text-dim)',
            padding: '9px 0 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            fontSize: 9.5,
            fontWeight: active === 'tribe' ? 800 : 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.2s ease',
            minWidth: 0,
            width: '100%',
            userSelect: 'none',
          }}
        >
          {active === 'tribe' && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                width: 24,
                height: 3,
                borderRadius: '0 0 4px 4px',
                background: 'var(--brand-mint)',
              }}
            />
          )}
          <Users size={20} strokeWidth={active === 'tribe' ? 2.2 : 1.8} />
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              padding: '0 2px',
              lineHeight: 1.1,
            }}
          >
            ПЛЕМЯ
          </span>
        </button>

        {/* 5) ПРОФИЛЬ (крайняя справа) */}
        <button
          type="button"
          onClick={() => {
            haptic('light');
            nav('/profile');
          }}
          aria-label="ПРОФИЛЬ"
          style={{
            border: 'none',
            background: 'transparent',
            color: active === 'profile' ? 'var(--brand-mint)' : 'var(--color-text-dim)',
            padding: '9px 0 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            fontSize: 9.5,
            fontWeight: active === 'profile' ? 800 : 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.2s ease',
            minWidth: 0,
            width: '100%',
            userSelect: 'none',
          }}
        >
          {active === 'profile' && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                width: 24,
                height: 3,
                borderRadius: '0 0 4px 4px',
                background: 'var(--brand-mint)',
              }}
            />
          )}
          <User size={20} strokeWidth={active === 'profile' ? 2.2 : 1.8} />
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              padding: '0 2px',
              lineHeight: 1.1,
            }}
          >
            ПРОФИЛЬ
          </span>
        </button>
      </nav>
    </>
  );
}
