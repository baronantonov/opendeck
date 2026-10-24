import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AbstractGeometryBg } from './LiquidGlassGeometry';

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
        className="pointer-events-none fixed left-0 right-0 z-[150] flex flex-col items-center gap-2 px-4"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 94px)',
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-modal-spring relative flex max-w-full items-center gap-2.5 overflow-hidden rounded-2xl px-4 py-3 text-[13px] font-bold text-[var(--color-text)] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_12px_32px_rgba(0,0,0,0.55)] transform-gpu"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
            }}
          >
            <AbstractGeometryBg variant="modal" spheres={0} accent="mint" />
            <span className="relative z-10 text-sm text-[var(--brand-mint)]">{t.icon}</span>
            <span className="relative z-10">{t.text}</span>
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
