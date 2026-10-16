import { useState, useEffect, useCallback } from 'react';
import { openInvoice } from '@telegram-apps/sdk-react';
import { apiCreateInvoice } from '../api/client';
import { useToast } from '../components/Toast';
import { BottomSheet } from '../components/BottomSheet';
import { Button, IconSparkles } from '../components/ui';
import { PRICES, mentorPrices } from '../lib/constants';
import { useApp } from '../state/store';
import { haptic } from '../lib/theme';

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
 */
export function useStarsCheckout() {
  const [busy, setBusy] = useState(false);
  const { reload } = useApp();
  const { toast } = useToast();

  const checkoutCourse = useCallback(
    async (courseId = 'dj-basics') => {
      if (busy) return;
      setBusy(true);
      haptic('medium');
      try {
        const data = await apiCreateInvoice({ course_id: courseId, provider: 'stars' });
        if (!data?.invoice_link) {
          toast('✕', 'Не удалось создать счёт Telegram Stars.');
          setBusy(false);
          return;
        }

        const status = await openTelegramStarsInvoice(data.invoice_link, {
          onPaid: () => {
            haptic('success');
            toast('✓', 'Оплата прошла! Все уроки открыты.');
            void reload();
          },
          onFailed: () => {
            haptic('error');
            toast('✕', 'Оплата не прошла.');
          },
          onCancelled: () => {
            // Пользователь закрыл нативное окно оплаты Telegram Stars
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
    [busy, reload, toast],
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
      if (external && tw?.openLink) tw.openLink(url);
      else if (tw?.openLink) tw.openLink(url);
      else window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  }
}

function PointsDiscountCounter({
  availableGp,
  maxCapGp = PRICES.mentor.gpCap,
  points,
  onChange,
}: {
  availableGp: number;
  maxCapGp?: number;
  points: number;
  onChange: (val: number) => void;
}) {
  const maxSpendable = Math.min(Math.max(availableGp, 0), maxCapGp);
  const activePoints = Math.min(Math.max(points, 0), maxSpendable);
  const { discountUsd, discountRub } = mentorPrices(activePoints);

  if (availableGp <= 0) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          borderRadius: 14,
          padding: '12px 14px',
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
          <IconSparkles size={14} color="var(--color-mint)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            Скидка за баллы: 0 GP
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text-dim)', lineHeight: 1.4 }}>
          Проходи уроки (+50 GP), бонусы (+30 GP) и приглашай друзей (+50 GP), чтобы накопить скидку до $50 на созвоны!
        </p>
      </div>
    );
  }

  const handleStep = (delta: number) => {
    const next = Math.min(Math.max(activePoints + delta, 0), maxSpendable);
    if (next !== activePoints) {
      haptic('light');
      onChange(next);
    }
  };

  const handlePreset = (val: number) => {
    haptic('light');
    onChange(val);
  };

  const pct = maxSpendable > 0 ? (activePoints / maxSpendable) * 100 : 0;
  const halfPreset = Math.round((maxSpendable / 2) / 25) * 25;

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: '14px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconSparkles size={15} color="var(--color-mint)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            Списать Groove Points
          </span>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--color-mint)',
            background: 'rgba(52, 211, 153, 0.12)',
            padding: '2px 8px',
            borderRadius: 8,
          }}
        >
          Баланс: {availableGp} GP
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 12,
          padding: '8px 12px',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => handleStep(-25)}
          disabled={activePoints <= 0}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: activePoints <= 0 ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
            color: activePoints <= 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-text)',
            fontSize: 18,
            fontWeight: 700,
            cursor: activePoints <= 0 ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          −
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.3px' }}>
            {activePoints} GP
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-mint)', fontWeight: 600, marginTop: 1 }}>
            {activePoints > 0 ? `скидка −$${discountUsd} (−${discountRub.toLocaleString('ru-RU')} ₽)` : 'без скидки'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleStep(25)}
          disabled={activePoints >= maxSpendable}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: activePoints >= maxSpendable ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
            color: activePoints >= maxSpendable ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-text)',
            fontSize: 18,
            fontWeight: 700,
            cursor: activePoints >= maxSpendable ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="range"
          min={0}
          max={maxSpendable}
          step={25}
          value={activePoints}
          onChange={(e) => {
            haptic('selection');
            onChange(Number(e.target.value));
          }}
          style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            accentColor: 'var(--color-mint)',
            cursor: 'pointer',
            background: `linear-gradient(to right, var(--color-mint) 0%, var(--color-mint) ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%, rgba(255, 255, 255, 0.12) 100%)`,
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--color-text-dim)',
            marginTop: 4,
          }}
        >
          <span>0 GP</span>
          <span>макс {maxSpendable} GP (до -$50)</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => handlePreset(0)}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 11.5,
            fontWeight: 600,
            borderRadius: 8,
            border: activePoints === 0 ? '1px solid var(--color-mint)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activePoints === 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            color: activePoints === 0 ? 'var(--color-mint)' : 'var(--color-text-dim)',
            cursor: 'pointer',
          }}
        >
          0 GP
        </button>
        {halfPreset > 0 && halfPreset < maxSpendable && (
          <button
            type="button"
            onClick={() => handlePreset(halfPreset)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 8,
              border: activePoints === halfPreset ? '1px solid var(--color-mint)' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activePoints === halfPreset ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              color: activePoints === halfPreset ? 'var(--color-mint)' : 'var(--color-text-dim)',
              cursor: 'pointer',
            }}
          >
            50% ({halfPreset})
          </button>
        )}
        <button
          type="button"
          onClick={() => handlePreset(maxSpendable)}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 11.5,
            fontWeight: 600,
            borderRadius: 8,
            border: activePoints === maxSpendable ? '1px solid var(--color-mint)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activePoints === maxSpendable ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            color: activePoints === maxSpendable ? 'var(--color-mint)' : 'var(--color-text-dim)',
            cursor: 'pointer',
          }}
        >
          Максимум ({maxSpendable})
        </button>
      </div>
    </div>
  );
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
  const [busy, setBusy] = useState<string | null>(null);

  const maxGp = Math.min(Math.max(user.groovePoints, 0), PRICES.mentor.gpCap);
  const [pointsToUse, setPointsToUse] = useState<number>(maxGp);

  useEffect(() => {
    setPointsToUse(Math.min(Math.max(user.groovePoints, 0), PRICES.mentor.gpCap));
  }, [user.groovePoints, open]);

  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(pointsToUse);

  const bookProdamus = async () => {
    setBusy('prodamus');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        provider: 'prodamus',
        points: pointsToUse,
      });
      if (!data?.pay_url) {
        if (data?.error === 'prodamus_not_configured')
          toast('!', 'Prodamus не настроен.');
        else toast('✕', 'Не удалось создать платёж.');
        return;
      }
      openInvoiceOrLink(undefined, data.pay_url, true);
      toast('✓', 'Оплата открылась в браузере. Вернись сюда после оплаты.');
      pollPaid('mentoring', reload);
      onClose();
    } catch {
      toast('✕', 'Ошибка сети.');
    } finally {
      setBusy(null);
    }
  };

  const bookTribute = async () => {
    setBusy('tribute');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        provider: 'tribute',
        points: pointsToUse,
      });
      if (!data?.pay_url) {
        toast('✕', 'Tribute не настроен.');
        return;
      }
      openInvoiceOrLink(undefined, data.pay_url, true);
    } catch {
      toast('✕', 'Ошибка сети.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Менторство 1-на-1 с FREEDA DJ">
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text-dim)',
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        4 персональные сессии по 1.5 часа, разбор твоих треков, сведение сета и поддержка между звонками. Оплата напрямую (чистыми $190 мастеру).
      </div>

      <PointsDiscountCounter
        availableGp={user.groovePoints}
        points={pointsToUse}
        onChange={setPointsToUse}
      />

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-dim)' }}>
          <span>Базовый тариф:</span>
          <span style={{ textDecoration: discountUsd > 0 ? 'line-through' : 'none' }}>
            ${PRICES.mentor.grossUsd} ({PRICES.mentor.grossRub.toLocaleString('ru-RU')} ₽)
          </span>
        </div>
        {discountUsd > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-mint)' }}>
            <span>Скидка за {cappedGp} GP:</span>
            <span style={{ fontWeight: 600 }}>−${discountUsd} (−{discountRub.toLocaleString('ru-RU')} ₽)</span>
          </div>
        )}
        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '1px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Итого к оплате:</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
              ${finalUsd}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-dim)', marginLeft: 6 }}>
              ({finalRub.toLocaleString('ru-RU')} ₽)
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" block disabled={busy === 'prodamus'} onClick={bookProdamus}>
          Карта РФ / СБП (Prodamus)
          <span style={{ fontWeight: 600 }}>
            {finalRub.toLocaleString('ru-RU')} ₽
            {discountRub > 0 && <span style={{ opacity: 0.85, fontSize: 11.5, marginLeft: 4 }}>(−{discountRub} ₽)</span>}
          </span>
        </Button>
        <Button variant="secondary" block disabled={busy === 'tribute'} onClick={bookTribute}>
          Tribute (USDT / Международные карты)
          <span style={{ fontWeight: 600 }}>
            ${finalUsd}
            {discountUsd > 0 && <span style={{ opacity: 0.85, fontSize: 11.5, marginLeft: 4 }}>(−${discountUsd})</span>}
          </span>
        </Button>
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--color-text-dim)',
            textAlign: 'center',
            margin: '2px 0 0',
          }}
        >
          Оплата напрямую мастеру. Чистыми FREEDA DJ получает $190.
        </p>
      </div>
    </BottomSheet>
  );
}

function pollPaid(courseId: string, reload: () => Promise<void>) {
  let tries = 0;
  const timer = setInterval(async () => {
    tries++;
    if (tries > 30) {
      clearInterval(timer);
      return;
    }
    try {
      const r = await fetch(
        `${(
          (window as any).__OD_API__ || 'https://opendeck-tma.serveousercontent.com'
        ).replace(/\/$/, '')}/api/lessons?course_id=${encodeURIComponent(courseId)}`,
        { headers: { 'X-Init-Data': (window as any).Telegram?.WebApp?.initData || '' } },
      );
      const j = await r.json();
      if (j?.paid) {
        clearInterval(timer);
        void reload();
      }
    } catch {
      /* ignore */
    }
  }, 2000);
}
