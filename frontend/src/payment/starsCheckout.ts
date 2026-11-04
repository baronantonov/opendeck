import { useState, useEffect, useCallback, useRef } from 'react';
import { openInvoice } from '@telegram-apps/sdk-react';
import { apiCreateInvoice } from '../api/client';
import { useToast } from '../components/Toast';
import { useApp } from '../state/AppContext';
import { haptic } from '../lib/theme';
import { getTelegramWebApp } from '../types';

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

export function openTelegramLinkFallback(link: string) {
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

export function openInvoiceOrLink(url?: string) {
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
