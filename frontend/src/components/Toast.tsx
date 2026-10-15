import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  icon: string;
  text: string;
}

interface ToastCtx {
  toast: (icon: string, text: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((icon: string, text: string) => {
    const id = ++counter;
    setItems((s) => [...s, { id, icon, text }]);
    setTimeout(() => {
      setItems((s) => s.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(76px + var(--safe-bottom))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
          zIndex: 100,
          padding: '0 16px',
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-pop"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 96%, #000)',
              color: 'var(--color-text)',
              border: '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
              borderRadius: 14,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: '100%',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
