import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppProvider, useApp } from './state/store';
import { ToastProvider } from './components/Toast';
import { BottomNav } from './components/BottomNav';
import { useTelegramTheme } from './lib/theme';
import { Home } from './screens/Home';
import { Course } from './screens/Course';
import { Bonus } from './screens/Bonus';
import { Mentor } from './screens/Mentor';
import { Profile } from './screens/Profile';

function Shell() {
  useTelegramTheme();
  const loc = useLocation();
  const { loading } = useApp();
  const active = loc.pathname.split('/')[1] || 'home';

  // Reset scroll on tab change
  useEffect(() => {
    document.querySelector('.scroll-y')?.scrollTo({ top: 0 });
  }, [active]);

  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skel" style={{ height: 46, borderRadius: 14 }} />
        <div className="skel" style={{ height: 160, borderRadius: 18 }} />
        <div className="skel" style={{ height: 60, borderRadius: 14 }} />
        <div className="skel" style={{ height: 90, borderRadius: 14 }} />
      </div>
    );
  }

  return (
    <>
      <main className="scroll-y" style={{ flex: 1, paddingBottom: 12 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/course" element={<Course />} />
          <Route path="/bonus" element={<Bonus />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/profile" element={<Profile />} />
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
