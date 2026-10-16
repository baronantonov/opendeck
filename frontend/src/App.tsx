import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppProvider, useApp } from './state/store';
import { ToastProvider } from './components/Toast';
import { BottomNav } from './components/BottomNav';
import { useTelegramTheme } from './lib/theme';
import { useSafeArea } from './lib/safeArea';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { Profile } from './screens/Profile';

function Shell() {
  useTelegramTheme();
  useSafeArea();
  const loc = useLocation();
  const { loading } = useApp();
  const active = loc.pathname.split('/')[1] || 'home';

  // Reset scroll on tab change
  useEffect(() => {
    document.querySelector('.scroll-y')?.scrollTo({ top: 0 });
  }, [active]);

  if (loading) {
    return (
      <div
        style={{
          padding: 'calc(var(--safe-top, 0px) + 16px) 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div className="skel" style={{ height: 46, borderRadius: 14 }} />
        <div className="skel" style={{ height: 160, borderRadius: 18 }} />
        <div className="skel" style={{ height: 60, borderRadius: 14 }} />
        <div className="skel" style={{ height: 90, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <>
      <main
        className="scroll-y"
        style={{
          flex: 1,
          paddingTop: 'var(--safe-top, 0px)',
          paddingBottom: 12,
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/course" element={<Navigate to="/learn" replace />} />
          <Route path="/bonus" element={<Navigate to="/learn" replace />} />
          <Route path="/mentor" element={<Navigate to="/learn" replace />} />
          <Route path="/profile" element={<Profile />} />
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
