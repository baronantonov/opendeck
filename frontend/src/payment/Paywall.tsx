import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { openInvoice } from '@telegram-apps/sdk-react';
import { apiCreateInvoice, apiLessons } from '../api/client';
import { useToast } from '../components/Toast';
import { PRICES, mentorPrices } from '../lib/constants';
import { useApp } from '../state/store';
import { haptic } from '../lib/theme';
import { getTelegramWebApp } from '../types';
import {
  X,
  Check,
  Sparkles,
  Target,
  Zap,
  Rocket,
  CreditCard,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { useRegisterModal } from '../lib/navigation';
import { AbstractGeometryBg } from '../components/LiquidGlassGeometry';
import { ShimmerButton } from '../components/MotionWrappers';
import { PaywallModal } from '../components/PaywallModal';

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending' | 'fallback';

type SdkOpenInvoiceFn = ((url: string, type: 'url') => Promise<string>) & {
  isAvailable?: () => boolean;
};

/**
 * Аутентичное открытие окна оплаты Telegram Stars по официальной документации Telegram.
 */
export async function openTelegramStarsInvoice(
  invoiceLink: string,
  callbacks?: {
    onPaid?: () => void;
    onCancelled?: () => void;
    onFailed?: () => void;
    onPending?: () => void;
  },
): Promise<InvoiceStatus> {
  try {
    const sdkFn = openInvoice as unknown as SdkOpenInvoiceFn;
    if (sdkFn && typeof sdkFn.isAvailable === 'function' && sdkFn.isAvailable()) {
      const status = await sdkFn(invoiceLink, 'url');
      if (status === 'paid') callbacks?.onPaid?.();
      else if (status === 'cancelled') callbacks?.onCancelled?.();
      else if (status === 'failed') callbacks?.onFailed?.();
      else if (status === 'pending') callbacks?.onPending?.();
      return status as InvoiceStatus;
    }
  } catch (e) {
    console.warn('[@telegram-apps/sdk-react] openInvoice error:', e);
  }

  const tw = getTelegramWebApp();
  if (tw && typeof tw.openInvoice === 'function') {
    return new Promise((resolve) => {
      try {
        tw.openInvoice?.(invoiceLink, (status: string) => {
          if (status === 'paid') {
            callbacks?.onPaid?.();
            resolve('paid');
          } else if (status === 'cancelled') {
            callbacks?.onCancelled?.();
            resolve('cancelled');
          } else if (status === 'failed') {
            callbacks?.onFailed?.();
            resolve('failed');
          } else if (status === 'pending') {
            callbacks?.onPending?.();
            resolve('pending');
          } else {
            resolve('cancelled');
          }
        });
      } catch (err) {
        console.warn('[Telegram.WebApp.openInvoice] error:', err);
        openTelegramLinkFallback(invoiceLink);
        resolve('fallback');
      }
    });
  }

  openTelegramLinkFallback(invoiceLink);
  return 'fallback';
}

function openTelegramLinkFallback(link: string) {
  const tw = getTelegramWebApp();
  try {
    if (tw?.openTelegramLink) {
      tw.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }
  } catch {
    window.open(link, '_blank');
  }
}

/**
 * Хук для прямого аутентичного чекаута курса в Telegram Stars с фоновой предзагрузкой.
 */
export function useStarsCheckout() {
  const [busy, setBusy] = useState(false);
  const { reload, setPaid } = useApp();
  const { toast } = useToast();
  const prefetchedLinkRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiCreateInvoice({ course_id: 'dj-basics', provider: 'stars' }).then((data) => {
      if (active && data?.invoice_link) {
        prefetchedLinkRef.current = data.invoice_link;
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const checkoutCourse = useCallback(
    async (courseId = 'dj-basics') => {
      if (busy) return;
      setBusy(true);
      haptic('light');
      try {
        let invoiceLink = courseId === 'dj-basics' ? prefetchedLinkRef.current : null;
        if (!invoiceLink) {
          const data = await apiCreateInvoice({ course_id: courseId, provider: 'stars' });
          invoiceLink = data?.invoice_link || null;
        }

        if (!invoiceLink) {
          toast('✕', 'Не удалось создать счёт Telegram Stars.');
          setBusy(false);
          return;
        }

        const status = await openTelegramStarsInvoice(invoiceLink, {
          onPaid: () => {
            haptic('success');
            setPaid(true, true);
            toast('✓', 'Оплата прошла! Все 10 уроков и Племя открыты.');
            void reload();
          },
          onFailed: () => {
            haptic('error');
            toast('✕', 'Оплата не прошла.');
          },
          onCancelled: () => {},
          onPending: () => {
            toast('ℹ', 'Платёж обрабатывается...');
          },
        });

        if (status === 'fallback') {
          toast('ℹ', 'Счёт Telegram Stars открыт в приложении Telegram.');
        }
      } catch (err) {
        console.error('Stars checkout error:', err);
        toast('✕', 'Ошибка сети при создании счёта.');
      } finally {
        setBusy(false);
      }
    },
    [busy, reload, setPaid, toast],
  );

  return { checkoutCourse, busy };
}

export function Paywall({
  courseId = 'dj-basics',
  open,
  onClose,
}: {
  courseId?: string;
  open: boolean;
  onClose: () => void;
}) {
  return <PaywallModal open={open} onClose={onClose} courseId={courseId} />;
}

export { PaywallModal };

function openInvoiceOrLink(url?: string) {
  const tw = getTelegramWebApp();
  if (!url) return;
  try {
    if (tw?.openLink) {
      tw.openLink(url);
      return;
    }
  } catch (e) {
    console.warn('tw.openLink failed, falling back to window.open:', e);
  }
  try {
    const opened = window.open(url, '_blank');
    if (!opened) {
      window.location.assign(url);
    }
  } catch {
    window.location.assign(url);
  }
}

export function MentorPay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { user, reload } = useApp();
  const [busy, setBusy] = useState<'prodamus' | 'tribute' | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'prodamus' | 'tribute'>('prodamus');

  useRegisterModal('mentor-pay-modal', open, onClose);

  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const availableGp = Math.max(user.groovePoints, 0);
  const maxSpendableGp = Math.min(availableGp, PRICES.mentor.gpCap);
  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(maxSpendableGp);

  useEffect(() => {
    if (!open) return;
    haptic('light');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const el = sheetRef.current;
    if (el && el.scrollTop > 5) return;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setDragY(diff);
    } else {
      setDragY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY > 80) {
      haptic('light');
      onClose();
    }
    setDragY(0);
  };

  const bookProdamus = async () => {
    setBusy('prodamus');
    haptic('light');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        provider: 'prodamus',
        points: maxSpendableGp,
      });
      if (!data?.pay_url) {
        if (data?.error === 'prodamus_not_configured')
          toast('!', 'Prodamus временно не настроен.');
        else toast('✕', 'Не удалось создать платёж.');
        return;
      }
      openInvoiceOrLink(data.pay_url);
      toast('✓', 'Оплата открылась. Вернись сюда после подтверждения.');
      pollPaid('mentoring', reload);
      onClose();
    } catch {
      toast('✕', 'Ошибка сети при создании счёта.');
    } finally {
      setBusy(null);
    }
  };

  const bookTribute = async () => {
    setBusy('tribute');
    haptic('light');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        provider: 'tribute',
        points: maxSpendableGp,
      });
      if (!data?.pay_url) {
        if (data?.error === 'tribute_not_configured')
          toast('!', 'Tribute временно не настроен.');
        else toast('✕', 'Не удалось создать счёт в Tribute.');
        return;
      }
      openInvoiceOrLink(data.pay_url);
      toast('✓', 'Оплата открылась. Вернись сюда после подтверждения.');
      pollPaid('mentoring', reload);
      onClose();
    } catch {
      toast('✕', 'Ошибка сети при создании счёта.');
    } finally {
      setBusy(null);
    }
  };

  const handleProceedPayment = () => {
    if (selectedMethod === 'prodamus') {
      void bookProdamus();
    } else {
      void bookTribute();
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[250] flex items-end justify-center bg-black/72 pt-[calc(var(--safe-top,0px)+12px)] backdrop-blur-xl"
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="animate-modal-spring relative w-full max-w-[480px] overflow-y-auto overflow-x-hidden rounded-t-3xl p-5 pb-[calc(var(--safe-bottom,0px)+22px)] text-[var(--color-text)] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_-16px_48px_rgba(0,0,0,0.68)] select-none"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 86%, rgba(16, 20, 19, 0.94))',
          maxHeight: 'calc(100dvh - var(--safe-top, 0px) - 16px)',
          transform: dragY > 0 ? `translate3d(0, ${dragY}px, 0)` : undefined,
          transition: dragY > 0 ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <AbstractGeometryBg variant="mentor" spheres={1} accent="gold" />

        {/* Индикатор свайпа вниз */}
        <div className="relative z-10 mx-auto mb-3.5 h-1 w-10 rounded-full bg-white/20" />

        {/* 1. Шапка */}
        <div className="relative z-10 mb-3.5 flex items-start justify-between gap-3">
          <div>
            <div
              className="mb-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
              style={{
                background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))',
              }}
            >
              <Sparkles size={12} />
              <span>Личное наставничество</span>
            </div>
            <h2 className="m-0 text-xl font-extrabold leading-tight tracking-tight text-[var(--color-text)]">
              Менторство 1 на 1 с FREEDA DJ
            </h2>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic('light');
              onClose();
            }}
            aria-label="Закрыть"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--color-text)] backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-2) 75%, transparent)',
            }}
          >
            <X size={19} strokeWidth={2.3} />
          </button>
        </div>

        {/* Теги формата */}
        <div className="relative z-10 mb-3.5 flex flex-wrap gap-1.5">
          {['4 сессии по 1.5ч', 'Разбор твоих миксов', 'Личный чат с ментором'].map((tag) => (
            <span
              key={tag}
              className="rounded-xl px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
              style={{ background: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)' }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 2. Блок ценности */}
        <div
          className="relative z-10 mb-3.5 flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
          style={{
            background: 'color-mix(in srgb, var(--color-surface-2) 50%, rgba(12, 15, 14, 0.6))',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{ background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)' }}
            >
              <Target size={17} strokeWidth={2.2} />
            </div>
            <div>
              <div className="mb-0.5 text-[13.5px] font-bold text-[var(--color-text)]">
                Персональный разбор точки А
              </div>
              <div className="text-xs leading-relaxed text-[var(--color-text-dim)]">
                Глубокий аудит твоего уровня, музыкального вкуса и пошаговый трек до готового сета.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{ background: 'color-mix(in srgb, var(--brand-gold) 15%, transparent)' }}
            >
              <Zap size={17} strokeWidth={2.2} />
            </div>
            <div>
              <div className="mb-0.5 text-[13.5px] font-bold text-[var(--color-text)]">
                Прямая обратная связь в реалтайме
              </div>
              <div className="text-xs leading-relaxed text-[var(--color-text-dim)]">
                Живой разбор ошибок на созвоне: вычищаем огрехи сведения и работу с частотами.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
              style={{ background: 'color-mix(in srgb, var(--brand-coral) 15%, transparent)' }}
            >
              <Rocket size={17} strokeWidth={2.2} />
            </div>
            <div>
              <div className="mb-0.5 text-[13.5px] font-bold text-[var(--color-text)]">
                Экономия месяцев самостоятельных проб
              </div>
              <div className="text-xs leading-relaxed text-[var(--color-text-dim)]">
                Готовые рабочие связки, чит-коды отбора треков и 10+ лет опыта клубного резидента.
              </div>
            </div>
          </div>
        </div>

        {/* 3. Расчет цены со скидкой Groove Points (без горизонтальных разделителей) */}
        <div
          className="relative z-10 mb-4 flex flex-col gap-2 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
          style={{
            background:
              cappedGp > 0
                ? 'color-mix(in srgb, var(--brand-mint) 8%, var(--color-surface-2))'
                : 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)',
          }}
        >
          <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)]">
            <span>Базовая стоимость:</span>
            <span className={cappedGp > 0 ? 'line-through font-semibold' : 'font-semibold text-[var(--color-text)]'}>
              ${PRICES.mentor.grossUsd} ({PRICES.mentor.grossRub.toLocaleString('ru-RU')} ₽)
            </span>
          </div>

          {cappedGp > 0 && (
            <div
              className="flex items-center justify-between rounded-xl px-3 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              style={{ background: 'rgba(0, 0, 0, 0.25)' }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--brand-mint)]">
                <Sparkles size={13} />
                <span>Списано {cappedGp} Groove Points</span>
              </div>
              <span className="text-xs font-extrabold text-[var(--brand-gold)]">
                −{discountRub.toLocaleString('ru-RU')} ₽ (−${discountUsd})
              </span>
            </div>
          )}

          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--color-text)]">Итого к оплате:</span>
            <div className="text-right">
              <span className="text-xl font-black tracking-tight text-[var(--color-text)]">
                {selectedMethod === 'prodamus'
                  ? `${finalRub.toLocaleString('ru-RU')} ₽`
                  : `$${finalUsd}`}
              </span>
              <span className="ml-1.5 text-xs font-semibold text-[var(--color-text-dim)]">
                ({selectedMethod === 'prodamus' ? `$${finalUsd}` : `${finalRub.toLocaleString('ru-RU')} ₽`})
              </span>
            </div>
          </div>
        </div>

        {/* 4. Способы оплаты */}
        <div className="relative z-10 mb-4">
          <div className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-text-dim)]">
            Способ оплаты
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Prodamus */}
            <div
              onClick={() => {
                haptic('light');
                setSelectedMethod('prodamus');
              }}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
              style={{
                background:
                  selectedMethod === 'prodamus'
                    ? 'color-mix(in srgb, var(--brand-mint) 12%, var(--color-surface-2))'
                    : 'color-mix(in srgb, var(--color-surface-2) 55%, transparent)',
              }}
            >
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                style={{
                  background:
                    selectedMethod === 'prodamus'
                      ? 'var(--brand-mint)'
                      : 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
                  color: selectedMethod === 'prodamus' ? '#11322a' : 'var(--color-text)',
                }}
              >
                <CreditCard size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[var(--color-text)]">
                    Карты РФ и СБП
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--brand-mint)]"
                    style={{ background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)' }}
                  >
                    0% комиссии
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--color-text-dim)]">
                  СБП, МИР, Т-Банк, Сбербанк
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[var(--color-text)]">
                    {finalRub.toLocaleString('ru-RU')} ₽
                  </div>
                  {discountRub > 0 && (
                    <div className="text-[10.5px] font-bold text-[var(--brand-mint)]">
                      −{discountRub.toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </div>
                <div
                  className="grid h-5 w-5 place-items-center rounded-full transition-all"
                  style={{
                    background: selectedMethod === 'prodamus' ? 'var(--brand-mint)' : 'rgba(255,255,255,0.12)',
                    color: '#11322a',
                  }}
                >
                  {selectedMethod === 'prodamus' && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            </div>

            {/* Tribute */}
            <div
              onClick={() => {
                haptic('light');
                setSelectedMethod('tribute');
              }}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
              style={{
                background:
                  selectedMethod === 'tribute'
                    ? 'color-mix(in srgb, var(--brand-mint) 12%, var(--color-surface-2))'
                    : 'color-mix(in srgb, var(--color-surface-2) 55%, transparent)',
              }}
            >
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.16)]"
                style={{
                  background:
                    selectedMethod === 'tribute'
                      ? 'var(--brand-mauve)'
                      : 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
                  color: selectedMethod === 'tribute' ? '#1d1f1e' : 'var(--color-text)',
                }}
              >
                <Globe size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[var(--color-text)]">
                    Зарубежные карты / USDT
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--brand-mauve)]"
                    style={{ background: 'color-mix(in srgb, var(--brand-mauve) 18%, transparent)' }}
                  >
                    Crypto / Int
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--color-text-dim)]">
                  Visa, Mastercard, Crypto (USDT, TON)
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[var(--color-text)]">
                    ${finalUsd}
                  </div>
                  {discountUsd > 0 && (
                    <div className="text-[10.5px] font-bold text-[var(--brand-mint)]">
                      −${discountUsd}
                    </div>
                  )}
                </div>
                <div
                  className="grid h-5 w-5 place-items-center rounded-full transition-all"
                  style={{
                    background: selectedMethod === 'tribute' ? 'var(--brand-mint)' : 'rgba(255,255,255,0.12)',
                    color: '#11322a',
                  }}
                >
                  {selectedMethod === 'tribute' && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Кнопка оплаты */}
        <div className="relative z-10 flex flex-col gap-2.5">
          <ShimmerButton
            variant="gradient"
            block
            shimmer
            hapticFeedback="light"
            disabled={busy !== null}
            onClick={handleProceedPayment}
            className="h-13 py-3.5 rounded-2xl text-base font-bold"
          >
            {busy !== null
              ? 'Подключаем платёжный шлюз...'
              : selectedMethod === 'prodamus'
                ? `Оплатить через СБП / Карту · ${finalRub.toLocaleString('ru-RU')} ₽`
                : `Оплатить картой / USDT · $${finalUsd}`}
          </ShimmerButton>

          <div className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[var(--color-text-dim)]">
            <ShieldCheck size={14} className="text-[var(--brand-mint)]" />
            <span>Безопасная оплата · Прямой чат с ментором открывается сразу</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function pollPaid(courseId: string, reload: () => Promise<void>) {
  let tries = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let done = false;

  const checkStatus = async () => {
    if (done) return;
    tries++;
    if (tries > 60) {
      cleanup();
      return;
    }
    try {
      const data = await apiLessons(courseId);
      if (data?.paid) {
        done = true;
        cleanup();
        haptic('success');
        void reload();
      }
    } catch {
      /* ignore */
    }
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void checkStatus();
    }
  };

  const cleanup = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  timer = setInterval(checkStatus, 2000);
}
