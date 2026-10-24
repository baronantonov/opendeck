import { useState, useMemo } from 'react';
import { useApp } from '../../state/store';
import { useCourseProgress } from '../../state/CourseProgressContext';
import { useToast } from '../Toast';
import { getTelegramWebApp } from '../../types';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';
import {
  Wrench,
  RotateCcw,
  Zap,
  Unlock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';

/**
 * Белый список владельца и авторизованных тестировщиков OpenDeck
 */
export const ADMIN_USER_IDS: number[] = [285754501];
export const ADMIN_USERNAMES: string[] = ['baronantonov'];

interface PreviewWindow {
  __PREVIEW__?: boolean;
}

/**
 * Проверка прав доступа к пульту продюсера / Dev Mode.
 * Возвращает true только владельцу проекта (@baronantonov, ID 285754501)
 * или в изолированной среде разработки Antigravity Preview.
 */
export function isProducerAuthorized(
  userId?: number | string | null,
  username?: string | null,
): boolean {
  if (typeof window === 'undefined') return true;

  // 1. Проверка Telegram User ID
  const numericId = Number(userId);
  if (!Number.isNaN(numericId) && ADMIN_USER_IDS.includes(numericId)) {
    return true;
  }

  // 2. Проверка @username
  if (username) {
    const clean = username.replace(/^@+/, '').toLowerCase().trim();
    if (ADMIN_USERNAMES.includes(clean)) {
      return true;
    }
  }

  // 3. Авторегистрация разработчика ТОЛЬКО в dev-окружении или изолированном превью
  const previewWin = window as unknown as PreviewWindow;
  const isPreview = Boolean(
    import.meta.env.DEV &&
      (previewWin.__PREVIEW__ ||
        window.location.search.includes('preview') ||
        window.location.search.includes('dev') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('antigravity') ||
        window.location.hostname.includes('webcontainer')),
  );

  return isPreview;
}

export function ProducerDevPanel() {
  const { setAdminMode } = useApp();
  const {
    isCoursePurchased,
    completedLessons,
    userId,
    username,
    resetProgress,
    setCoursePurchased,
    unlockAllLessons,
    setupPaywallTest,
    verifyIntegrity,
  } = useCourseProgress();

  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Вычисляем Telegram WebApp контекст (без подстановки админского ID гостям в проде)
  const tw = getTelegramWebApp();
  const currentTgId = tw?.initDataUnsafe?.user?.id ?? userId ?? 0;
  const currentUsername = tw?.initDataUnsafe?.user?.username || username || '';

  // Проверка авторизации: для обычных пользователей компонент возвращает null и отсутствует в DOM
  const hasAccess = useMemo(() => {
    return isProducerAuthorized(currentTgId, currentUsername);
  }, [currentTgId, currentUsername]);

  if (!hasAccess) {
    return null;
  }

  const isSigValid = verifyIntegrity();
  const displayLessonsCount = isCoursePurchased ? Math.min(10, Math.max(completedLessons.length, 1)) : Math.max(completedLessons.length, 1);

  const triggerHaptic = (type: 'warning' | 'success' | 'light') => {
    try {
      if (type === 'light') {
        tw?.HapticFeedback?.impactOccurred?.('light');
      } else {
        tw?.HapticFeedback?.notificationOccurred?.(type);
      }
    } catch {
      /* ignore */
    }
  };

  /**
   * 1. Сбросить всё (Режим новичка)
   */
  const handleResetAll = () => {
    triggerHaptic('warning');
    resetProgress();
    setAdminMode(false);
    toast('🔄', 'Режим новичка: всё сброшено до Урока 1');
  };

  /**
   * 2. Выдать покупку Pocket DJ
   */
  const handleGrantPurchase = () => {
    triggerHaptic('success');
    setCoursePurchased(true);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('opendeck_tribe_confetti_shown');
        tw?.CloudStorage?.removeItem?.('opendeck_tribe_confetti_shown', () => {});
      } catch {
        /* ignore */
      }
    }

    toast('⚡', 'Pocket DJ активирован: Племя и все 10 уроков доступны');
  };

  /**
   * 3. Открыть все 10 уроков
   */
  const handleUnlockAll = () => {
    triggerHaptic('success');
    unlockAllLessons();
    setAdminMode(true);
    toast('🔓', 'Все 10 уроков и DJ-дека разблокированы');
  };

  /**
   * 4. Тест Paywall после 2-го урока
   */
  const handleTestPaywall = () => {
    triggerHaptic('light');
    setupPaywallTest();
    setAdminMode(false);
    toast('🎯', 'Урок 1 завершён. Заверши Урок 2 для проверки Paywall');
  };

  return (
    <section aria-label="Пульт продюсера / Dev Mode" className="flex flex-col gap-3">
      {/* ── ПЛАВАЮЩИЙ БЕЙДЖ-ТРИГГЕР [ 🛠 DEV ] В LIQUID GLASS ── */}
      <div className="liquid-glass-pill rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#f3c969]/15 flex items-center justify-center text-[#f3c969] shrink-0">
            <Wrench size={14} />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#f3c969] truncate">
            Пульт продюсера · DEV
          </span>
          <span
            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              isCoursePurchased
                ? 'bg-[#8ce2c8]/20 text-[#8ce2c8]'
                : 'bg-[#f5926e]/20 text-[#f5926e]'
            }`}
          >
            {isCoursePurchased ? 'Куплен' : 'Free'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsOpen((prev) => !prev);
          }}
          className="px-3 py-1.5 rounded-xl bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] text-xs font-bold text-[#f4f7f5] flex items-center gap-1 active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
        >
          <span>{isOpen ? 'Скрыть' : 'Открыть'}</span>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ── РАЗВЕРНУТАЯ ПАНЕЛЬ ПУЛЬТА ПРОДЮСЕРА (DARK LIQUID GLASS) ── */}
      {isOpen && (
        <div className="liquid-glass-card relative overflow-hidden rounded-3xl p-4 flex flex-col gap-3 animate-modal-spring">
          <AbstractGeometryBg variant="modal" spheres={0} />

          {/* 1. СТАТУС-БАР ТЕСТЕРА */}
          <div className="relative z-10 rounded-2xl p-3.5 bg-[#2b302e]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  size={14}
                  color={isSigValid ? 'var(--brand-mint)' : 'var(--brand-coral)'}
                />
                <span className="text-[#9aa3a0]">TG ID:</span>
                <b className="text-[#f4f7f5] font-mono">{currentTgId}</b>
                {currentUsername && (
                  <span className="text-[#8ce2c8] text-[11px]">@{currentUsername}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  isSigValid
                    ? 'bg-[#8ce2c8]/15 text-[#8ce2c8]'
                    : 'bg-[#f5926e]/15 text-[#f5926e]'
                }`}
              >
                {isSigValid ? 'SIG: OK' : 'SIG: INVALID'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-[#9aa3a0]">Курс: </span>
                <b className={isCoursePurchased ? 'text-[#8ce2c8]' : 'text-[#f5926e]'}>
                  {isCoursePurchased ? 'Куплен (Pocket DJ)' : 'Не куплен'}
                </b>
              </div>
              <div>
                <span className="text-[#9aa3a0]">Уроки: </span>
                <b className="text-[#f3c969]">{displayLessonsCount} / 10</b>
              </div>
            </div>
          </div>

          {/* 2. КНОПКИ БЫСТРЫХ СЦЕНАРИЕВ ТЕСТИРОВАНИЯ */}
          <div className="relative z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#f5926e]/12 shadow-[inset_0_1px_1px_rgba(245,146,110,0.25)] text-left active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
            >
              <div className="w-8 h-8 rounded-xl bg-[#f5926e]/20 text-[#f5926e] flex items-center justify-center shrink-0">
                <RotateCcw size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#f4f7f5]">
                  🔄 Сбросить всё (Режим новичка)
                </div>
                <div className="text-[10.5px] text-[#9aa3a0] font-medium">
                  Обнуляет покупку, сбрасывает к Уроку 1, чистит конфетти и баннеры
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleGrantPurchase}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#8ce2c8]/12 shadow-[inset_0_1px_1px_rgba(140,226,200,0.25)] text-left active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
            >
              <div className="w-8 h-8 rounded-xl bg-[#8ce2c8]/20 text-[#8ce2c8] flex items-center justify-center shrink-0">
                <Zap size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#f4f7f5]">
                  ⚡ Выдать покупку Pocket DJ
                </div>
                <div className="text-[10.5px] text-[#9aa3a0] font-medium">
                  Подписывает покупку, разблокирует Племя (салют) и Урок 3
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleUnlockAll}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#f3c969]/12 shadow-[inset_0_1px_1px_rgba(243,201,105,0.25)] text-left active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
            >
              <div className="w-8 h-8 rounded-xl bg-[#f3c969]/20 text-[#f3c969] flex items-center justify-center shrink-0">
                <Unlock size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#f4f7f5]">
                  🔓 Открыть все 10 уроков
                </div>
                <div className="text-[10.5px] text-[#9aa3a0] font-medium">
                  Полный доступ ко всем урокам и деке для быстрого теста
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleTestPaywall}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] text-left active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer border-0"
            >
              <div className="w-8 h-8 rounded-xl bg-white/[0.08] text-[#f4f7f5] flex items-center justify-center shrink-0">
                <Target size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#f4f7f5]">
                  🎯 Тест Paywall после 2-го урока
                </div>
                <div className="text-[10.5px] text-[#9aa3a0] font-medium">
                  Урок 1 пройден, финиш Урока 2 вызовет окно покупки
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
