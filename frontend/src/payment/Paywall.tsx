import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { openInvoice } from '@telegram-apps/sdk-react';
import { apiCreateInvoice, apiLessons } from '../api/client';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui';
import { PRICES, mentorPrices } from '../lib/constants';
import { useApp } from '../state/store';
import { haptic } from '../lib/theme';
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

/**
 * Аутентичное открытие окна оплаты Telegram Stars по официальной документации Telegram.
 * 1. Пробует вызов официального SDK @telegram-apps/sdk-react (openInvoice).
 * 2. Делает фоллбэк на window.Telegram.WebApp.openInvoice (официальный WebApp JS API).
 * 3. При запуске вне Telegram открывает ссылку инвойса в приложении Telegram.
 */
export async function openTelegramStarsInvoice(
  invoiceLink: string,
  callbacks?: {
    onPaid?: () => void;
    onCancelled?: () => void;
    onFailed?: () => void;
    onPending?: () => void;
  },
): Promise<'paid' | 'cancelled' | 'failed' | 'pending' | 'fallback'> {
  // 1. Попытка через @telegram-apps/sdk-react
  try {
    if (openInvoice && typeof (openInvoice as any).isAvailable === 'function' && (openInvoice as any).isAvailable()) {
      const status = await openInvoice(invoiceLink, 'url');
      if (status === 'paid') callbacks?.onPaid?.();
      else if (status === 'cancelled') callbacks?.onCancelled?.();
      else if (status === 'failed') callbacks?.onFailed?.();
      else if (status === 'pending') callbacks?.onPending?.();
      return status as 'paid' | 'cancelled' | 'failed' | 'pending';
    }
  } catch (e) {
    console.warn('[@telegram-apps/sdk-react] openInvoice error:', e);
  }

  // 2. Официальный fallback через window.Telegram.WebApp.openInvoice (TMA Core API)
  const tw = (window as any).Telegram?.WebApp;
  if (tw && typeof tw.openInvoice === 'function') {
    return new Promise((resolve) => {
      try {
        tw.openInvoice(invoiceLink, (status: string) => {
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
            resolve(status as any);
          }
        });
      } catch (err) {
        console.warn('[Telegram.WebApp.openInvoice] error:', err);
        openTelegramLinkFallback(invoiceLink);
        resolve('fallback');
      }
    });
  }

  // 3. Fallback вне Telegram (браузер / preview)
  openTelegramLinkFallback(invoiceLink);
  return 'fallback';
}

function openTelegramLinkFallback(link: string) {
  const tw = (window as any).Telegram?.WebApp;
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
 * Хук для прямого аутентичного чекаута курса в Telegram Stars без лишних модалок.
 * Включает фоновую предзагрузку инвойс-ссылки для открытия за 0 миллисекунд.
 */
export function useStarsCheckout() {
  const [busy, setBusy] = useState(false);
  const { reload, setPaid } = useApp();
  const { toast } = useToast();
  const prefetchedLinkRef = useRef<string | null>(null);

  // Предзагрузка инвойс-ссылки в фоне при монтировании:
  // При клике на "Купить" нативное окно Telegram Stars откроется моментально!
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
      haptic('medium');
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
            // Оптимистичное разблокирование: мгновенный доступ без ожидания вебхука
            setPaid(true, true);
            toast('✓', 'Оплата прошла! Все уроки открыты.');
            void reload();
          },
          onFailed: () => {
            haptic('error');
            toast('✕', 'Оплата не прошла.');
          },
          onCancelled: () => {
            // Пользователь закрыл системную шторку Telegram Stars
          },
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

/**
 * @deprecated Старая модалка заменена на аутентичный прямой чекаут Telegram Stars.
 * Для совместимости компонент вызывает checkoutCourse() сразу при открытии.
 */
export function Paywall({
  courseId = 'dj-basics',
  open,
  onClose,
}: {
  courseId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { checkoutCourse } = useStarsCheckout();

  useEffect(() => {
    if (open) {
      onClose();
      void checkoutCourse(courseId);
    }
  }, [open, courseId, onClose, checkoutCourse]);

  return null;
}

function openInvoiceOrLink(
  _link?: string,
  url?: string,
  external = false,
) {
  const tw = (window as any).Telegram?.WebApp;
  if (url) {
    try {
      if (external && tw?.openLink) {
        tw.openLink(url);
        return;
      } else if (tw?.openLink) {
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

  // Управление свайпом вниз для мобильных экранов (bottom-sheet)
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  // Автоматический расчет поинтов и скидки:
  // По умолчанию сразу берем доступные Groove Points пользователя и применяем максимум (до 500 GP)
  const availableGp = Math.max(user.groovePoints, 0);
  const maxSpendableGp = Math.min(availableGp, PRICES.mentor.gpCap);
  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(maxSpendableGp);

  useEffect(() => {
    if (!open) return;
    haptic('medium');

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
    haptic('medium');
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
      openInvoiceOrLink(undefined, data.pay_url, true);
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
    haptic('medium');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        provider: 'tribute',
        points: maxSpendableGp,
      });
      if (!data?.pay_url) {
        if (data?.error === 'tribute_not_configured')
          toast('!', 'Tribute временно не настроен.');
        else
          toast('✕', 'Не удалось создать счёт в Tribute.');
        return;
      }
      openInvoiceOrLink(undefined, data.pay_url, true);
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 250,
        boxSizing: 'border-box',
        paddingTop: 'calc(var(--safe-top, 0px) + 12px)',
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: 500,
          background: 'var(--color-surface)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
          padding: '12px 18px calc(var(--safe-bottom, 0px) + 20px)',
          maxHeight: 'calc(100vh - var(--safe-top, 0px) - 20px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          transform: dragY > 0 ? `translateY(${dragY}px)` : 'none',
          transition: dragY > 0 ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Индикатор свайпа вниз (Drag handle) */}
        <div
          style={{
            width: 42,
            height: 4.5,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.22)',
            margin: '0 auto 14px',
            cursor: 'grab',
          }}
        />

        {/* ── 1. Шапка: Заголовок и заметная кнопка закрытия (крестик X 42x42px) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'color-mix(in srgb, var(--brand-gold) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--brand-gold) 35%, transparent)',
                borderRadius: 99,
                padding: '3px 9px',
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--brand-gold)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              <Sparkles size={12} />
              Личное наставничество
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                lineHeight: 1.25,
                color: 'var(--color-text)',
                letterSpacing: '-0.3px',
              }}
            >
              Менторство 1 на 1 с FREEDA DJ
            </h2>
          </div>

          {/* Заметный крестик закрытия: 42x42px, полупрозрачный фон, backdrop-blur, active effect */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic('light');
              onClose();
            }}
            aria-label="Закрыть"
            style={{
              width: 42,
              height: 42,
              minWidth: 42,
              minHeight: 42,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
            className="hover:bg-white/15 active:scale-90"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {/* ── Формат менторства ── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 14,
          }}
        >
          {['4 сессии по 1.5ч', 'Разбор твоих миксов', 'Личный чат с ментором'].map((tag, i) => (
            <span
              key={i}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--color-text-dim)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                padding: '4px 9px',
                borderRadius: 8,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* ── 2. Блок ценности (Value Proposition & Буллиты с иконками) ── */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: '14px',
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxSizing: 'border-box',
          }}
        >
          {/* Буллит 1: Точка А */}
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)',
                color: 'var(--brand-mint)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Target size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>
                Персональный разбор точки А
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                Глубокий аудит твоего уровня, музыкального вкуса и пошаговый трек до готового часового микса или первого сета.
              </div>
            </div>
          </div>

          {/* Буллит 2: Обратная связь и слепые зоны */}
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--brand-gold) 15%, transparent)',
                color: 'var(--brand-gold)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Zap size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>
                Прямая обратная связь в реалтайме
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                Живой разбор ошибок на созвоне: вычищаем огрехи сведения, работу с эквалайзером и закрываем слепые зоны на твоих глазах.
              </div>
            </div>
          </div>

          {/* Буллит 3: Экономия месяцев */}
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--brand-coral) 15%, transparent)',
                color: 'var(--brand-coral)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Rocket size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>
                Экономия месяцев самостоятельных проб
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
                Готовые рабочие связки, чит-коды отбора треков и 10+ лет опыта клубного резидента вместо хаотичных туториалов.
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Логика автоматического применения Groove Points и расчет цены ── */}
        <div
          style={{
            background: cappedGp > 0
              ? 'color-mix(in srgb, var(--brand-mint) 6%, var(--color-surface-2))'
              : 'rgba(255, 255, 255, 0.03)',
            border: cappedGp > 0
              ? '1px solid color-mix(in srgb, var(--brand-mint) 30%, transparent)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        >
          {/* Базовая цена */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-dim)' }}>
              Базовая стоимость курса:
            </span>
            <span
              style={{
                fontSize: 13,
                textDecoration: cappedGp > 0 ? 'line-through' : 'none',
                color: cappedGp > 0 ? 'var(--color-text-dim)' : 'var(--color-text)',
                fontWeight: 600,
              }}
            >
              ${PRICES.mentor.grossUsd} ({PRICES.mentor.grossRub.toLocaleString('ru-RU')} ₽)
            </span>
          </div>

          {/* Плашка применённой скидки (если поинты есть) */}
          {cappedGp > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--brand-mint) 25%, transparent)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} color="var(--brand-mint)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-mint)' }}>
                  Списано {cappedGp} Groove Points
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-gold)' }}>
                −{discountRub.toLocaleString('ru-RU')} ₽ (−${discountUsd})
              </span>
            </div>
          )}

          {/* Разделитель */}
          <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.07)', margin: '1px 0' }} />

          {/* Итоговая цена */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
              Итого к оплате:
            </span>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.3px',
                }}
              >
                {selectedMethod === 'prodamus'
                  ? `${finalRub.toLocaleString('ru-RU')} ₽`
                  : `$${finalUsd}`}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: 'var(--color-text-dim)',
                  marginLeft: 6,
                  fontWeight: 600,
                }}
              >
                ({selectedMethod === 'prodamus'
                  ? `$${finalUsd}`
                  : `${finalRub.toLocaleString('ru-RU')} ₽`})
              </span>
            </div>
          </div>
        </div>

        {/* ── 4. Интерактивные карточки способов оплаты ── */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: 'var(--color-text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
              padding: '0 2px',
            }}
          >
            Способ оплаты
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Карточка 1: Prodamus (Карты РФ / СБП) */}
            <div
              onClick={() => {
                haptic('light');
                setSelectedMethod('prodamus');
              }}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 16,
                background: selectedMethod === 'prodamus'
                  ? 'color-mix(in srgb, var(--brand-mint) 8%, var(--color-surface))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: selectedMethod === 'prodamus'
                  ? '1.5px solid var(--brand-mint)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: selectedMethod === 'prodamus'
                  ? '0 0 16px rgba(140, 226, 200, 0.16)'
                  : 'none',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxSizing: 'border-box',
              }}
              className="active:scale-[0.98]"
            >
              {/* Векторная иконка метода */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: selectedMethod === 'prodamus'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: selectedMethod === 'prodamus'
                    ? '0 4px 12px rgba(16, 185, 129, 0.35)'
                    : 'none',
                }}
              >
                <CreditCard size={21} />
              </div>

              {/* Название и сабтайтл */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    Карты РФ и СБП
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--brand-mint)',
                      background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    0% комиссии
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-dim)', marginTop: 2 }}>
                  СБП, МИР, Т-Банк, Сбербанк
                </div>
              </div>

              {/* Сумма и чекмарк выбора */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                    {finalRub.toLocaleString('ru-RU')} ₽
                  </div>
                  {discountRub > 0 && (
                    <div style={{ fontSize: 10.5, color: 'var(--brand-mint)', fontWeight: 700 }}>
                      −{discountRub.toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: selectedMethod === 'prodamus'
                      ? '2px solid var(--brand-mint)'
                      : '2px solid rgba(255, 255, 255, 0.25)',
                    background: selectedMethod === 'prodamus' ? 'var(--brand-mint)' : 'transparent',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#11322a',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selectedMethod === 'prodamus' && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            </div>

            {/* Карточка 2: Tribute (Зарубежные карты / USDT) */}
            <div
              onClick={() => {
                haptic('light');
                setSelectedMethod('tribute');
              }}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 16,
                background: selectedMethod === 'tribute'
                  ? 'color-mix(in srgb, var(--brand-mint) 8%, var(--color-surface))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: selectedMethod === 'tribute'
                  ? '1.5px solid var(--brand-mint)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: selectedMethod === 'tribute'
                  ? '0 0 16px rgba(140, 226, 200, 0.16)'
                  : 'none',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxSizing: 'border-box',
              }}
              className="active:scale-[0.98]"
            >
              {/* Векторная иконка метода */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: selectedMethod === 'tribute'
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: selectedMethod === 'tribute'
                    ? '0 4px 12px rgba(59, 130, 246, 0.35)'
                    : 'none',
                }}
              >
                <Globe size={21} />
              </div>

              {/* Название и сабтайтл */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    Зарубежные карты / USDT
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#60a5fa',
                      background: 'rgba(59, 130, 246, 0.15)',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Crypto / Int
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-dim)', marginTop: 2 }}>
                  Visa, Mastercard, Crypto (USDT, TON)
                </div>
              </div>

              {/* Сумма и чекмарк выбора */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
                    ${finalUsd}
                  </div>
                  {discountUsd > 0 && (
                    <div style={{ fontSize: 10.5, color: 'var(--brand-mint)', fontWeight: 700 }}>
                      −${discountUsd}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: selectedMethod === 'tribute'
                      ? '2px solid var(--brand-mint)'
                      : '2px solid rgba(255, 255, 255, 0.25)',
                    background: selectedMethod === 'tribute' ? 'var(--brand-mint)' : 'transparent',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#11322a',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selectedMethod === 'tribute' && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. Главная CTA Кнопка перехода к оплате ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            variant="primary"
            block
            disabled={busy !== null}
            onClick={handleProceedPayment}
            style={{
              height: 52,
              fontSize: 15,
              fontWeight: 800,
              borderRadius: 16,
              boxShadow: '0 4px 18px rgba(140, 226, 200, 0.2)',
            }}
          >
            {busy !== null ? (
              'Подключаем платёжный шлюз...'
            ) : selectedMethod === 'prodamus' ? (
              `Оплатить через СБП / Карту · ${finalRub.toLocaleString('ru-RU')} ₽`
            ) : (
              `Оплатить картой / USDT · $${finalUsd}`
            )}
          </Button>

          {/* Безопасность */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 11.5,
              color: 'var(--color-text-dim)',
              textAlign: 'center',
            }}
          >
            <ShieldCheck size={14} color="var(--brand-mint)" />
            <span>Безопасная оплата · Прямой чат и календарь бронирования открываются сразу</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function pollPaid(courseId: string, reload: () => Promise<void>) {
  let tries = 0;
  let timer: any = null;
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
