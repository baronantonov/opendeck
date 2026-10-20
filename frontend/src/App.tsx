import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
import { preloadUserpic } from './lib/avatarPreload';

function Shell() {
  useTelegramTheme();
  const { isReady: isTgReady } = useTelegramInit();
  const { isLoaded: isSessionLoaded, welcomeBonus, user } = useApp();
  const { toast } = useToast();
  const loc = useLocation();
  const { isExitModalOpen, closeExitModal } = useNavigation();
  const [splashFinished, setSplashFinished] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const active = loc.pathname.split('/')[1] || 'home';

  // Предзагрузка юзерпика Telegram во время окна загрузки приложения (VinylLoader)
  useEffect(() => {
    const photo =
      user.photoUrl ||
      (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url ||
      (window as any).__opendeck_userpic_url;

    if (!photo) {
      setIsAvatarReady(true);
      return;
    }

    let active = true;
    // Ограничиваем ожидание максимум 850мс, чтобы аватар подгрузился
    // строго внутри минимального окна показа винила (1350мс) и не задерживал запуск
    const timer = window.setTimeout(() => {
      if (active) setIsAvatarReady(true);
    }, 850);

    preloadUserpic(photo).finally(() => {
      if (active) {
        window.clearTimeout(timer);
        setIsAvatarReady(true);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user.photoUrl]);

  // Комплексный флаг готовности: платформа Telegram + данные пользователя и курса + готовность аватара
  const isAppReady = isTgReady && isSessionLoaded && isAvatarReady;

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

  return (
    <div className="tma-app-shell">
      {/* VinylLoader удерживает оверлей, пока Telegram и сессия не готовы (+ минимальные 1.35с) */}
      <VinylLoader
        isLoading={!isAppReady}
        statusText="Синхронизация битов..."
        onExited={() => setSplashFinished(true)}
      />

      <main
        className="scroll-y"
        style={{
          flex: 1,
          paddingTop: 'var(--app-safe-top, var(--safe-top, 0px))',
          paddingBottom: 12,
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

      {/* Компактный плавающий баннер ярлыка на рабочий стол (активируется после сплэша) */}
      <HomeScreenBanner splashFinished={splashFinished} />

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
