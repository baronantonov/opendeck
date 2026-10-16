import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './state/store';
import { ToastProvider } from './components/Toast';
import { BottomNav } from './components/BottomNav';
import { useTelegramTheme } from './lib/theme';
import { useSafeArea } from './lib/safeArea';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { Profile } from './screens/Profile';

import { VinylLoader } from './components/VinylLoader';

function Shell() {
  useTelegramTheme();
  useSafeArea();
  const loc = useLocation();
  const { loading } = useApp();
  const [splashFinished, setSplashFinished] = useState(false);
  const active = loc.pathname.split('/')[1] || 'home';

  // Reset scroll on tab change
  useEffect(() => {
    document.querySelector('.scroll-y')?.scrollTo({ top: 0 });
  }, [active]);

  return (
    <>
      <VinylLoader
        isLoading={loading}
        statusText="Синхронизация битов..."
        onExited={() => setSplashFinished(true)}
      />

      <main
        className="scroll-y"
        style={{
          flex: 1,
          paddingTop: 'var(--safe-top, 0px)',
          paddingBottom: 12,
        }}
      >
        <Routes>
          <Route path="/" element={<Home key={active + String(splashFinished)} />} />
          <Route path="/home" element={<Home key={active + String(splashFinished)} />} />
          <Route path="/learn" element={<Learn key={active} />} />
          <Route path="/course" element={<Navigate to="/learn" replace />} />
          <Route path="/bonus" element={<Navigate to="/learn" replace />} />
          <Route path="/mentor" element={<Navigate to="/learn" replace />} />
          <Route path="/profile" element={<Profile key={active} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppProvider>
  );
}
