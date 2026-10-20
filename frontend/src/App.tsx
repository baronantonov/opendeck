import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { AppProvider, useApp } from './state/store';
import { ToastProvider, useToast } from './components/Toast';
import { BottomNav } from './components/BottomNav';
import { useTelegramTheme } from './lib/theme';
import { useTelegramInit } from './lib/useTelegramInit';
import { NavigationProvider, useNavigation } from './lib/navigation';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { HomeScreenBanner } from './components/HomeScreenBanner';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { TribeScreen } from './screens/TribeScreen';
import { Profile } from './screens/Profile';
import { LessonScreen } from './screens/LessonScreen';
import { VinylLoader } from './components/VinylLoader';
import { getTelegramWebApp } from './types';

function Shell() {
  useTelegramTheme();
  const { isReady: isTgReady } = useTelegramInit();
  const { isLoaded: isSessionLoaded, welcomeBonus } = useApp();
  const { toast } = useToast();
  const loc = useLocation();
  const { isExitModalOpen, closeExitModal } = useNavigation();
  const [splashFinished, setSplashFinished] = useState(false);
  const active = loc.pathname.split('/')[1] || 'home';

  // Гарантия строго однократного вызова ready() и expand() при монтировании
  const tgReadyCalledRef = useRef(false);
  useEffect(() => {
    if (tgReadyCalledRef.current) return;
    tgReadyCalledRef.current = true;
    try {
      const tw = getTelegramWebApp();
      if (tw) {
        tw.ready?.();
        tw.expand?.();
      }
    } catch (e) {
      console.warn('[App] Telegram WebApp ready/expand error:', e);
    }
  }, []);

  // Неблокирующий запуск: приложение готово сразу по готовности среды и сессии,
  // аватар пользователя подгружается параллельно по Stale-While-Revalidate без фризов
  const isAppReady = isTgReady && isSessionLoaded;

  // Показ приветственного бонуса (рефералка / подарок)
  useEffect(() => {
    if (welcomeBonus?.message) {
      toast('🎁', welcomeBonus.message);
    }
  }, [welcomeBonus, toast]);

  // Reset scroll on tab change
  useEffect(() => {
    document.querySelector('.scroll-y')?.scrollTo({ top: 0 });
  }, [active]);

  const isLesson = loc.pathname.startsWith('/lesson');

  return (
    <div className="tma-app-shell">
      {/* VinylLoader удерживает оверлей, пока Telegram и сессия не готовы (+ минимальные 1.35с) */}
      <VinylLoader
        isLoading={!isAppReady}
        statusText="Синхронизация битов..."
        onExited={() => setSplashFinished(true)}
      />

      <main
        className={isLesson ? 'flex-1 flex flex-col h-[100dvh] overflow-hidden' : 'scroll-y'}
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: isLesson ? 'flex' : undefined,
          flexDirection: isLesson ? 'column' : undefined,
          paddingTop: 'var(--app-safe-top, var(--safe-top, 0px))',
          paddingBottom: isLesson ? 0 : 20,
          overflowY: isLesson ? 'hidden' : 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          height: isLesson ? '100dvh' : undefined,
          boxSizing: 'border-box',
        }}
      >
        <Routes>
          <Route path="/" element={<Home key={active} />} />
          <Route path="/home" element={<Home key={active} />} />
          <Route path="/learn" element={<Learn key={active} />} />
          <Route path="/course" element={<Navigate to="/learn" replace />} />
          <Route path="/bonus" element={<Navigate to="/learn" replace />} />
          <Route path="/mentor" element={<Navigate to="/learn" replace />} />
          <Route path="/lesson/:id" element={<LessonScreen key={loc.pathname} />} />
          <Route path="/tribe" element={<TribeScreen key={active} />} />
          <Route path="/profile" element={<Profile key={active} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Компактный плавающий баннер ярлыка на рабочий стол (активируется после сплэша, скрыт на уроках) */}
      <HomeScreenBanner active={!isLesson} splashFinished={splashFinished} />

      {/* Кастомный попап подтверждения выхода */}
      <ExitConfirmModal open={isExitModalOpen} onClose={closeExitModal} />

      {/* Навигационное меню: смонтировано сразу под оверлеем прелоадера, исключая CLS и задержку появления */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <NavigationProvider>
          <Shell />
        </NavigationProvider>
      </ToastProvider>
    </AppProvider>
  );
}
