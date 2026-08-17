import { useState } from 'react';
import { apiCreateInvoice } from '../api/client';
import { useToast } from '../components/Toast';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/ui';
import { PRICES } from '../lib/constants';
import { useApp } from '../state/store';

function openInvoiceOrLink(link?: string, url?: string, external = false) {
  const tw = (window as any).Telegram?.WebApp;
  if (link) {
    try {
      tw?.openInvoice?.(link, (status: string) => {
        if (status === 'paid') window.location.reload();
      });
    } catch {
      window.location.reload();
    }
    return;
  }
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

export function Paywall({
  courseId,
  open,
  onClose,
}: {
  courseId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { reload } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const coursePrice =
    PRICES[courseId as 'tripwire' | 'dj-basics'] || PRICES['dj-basics'];

  const bookStars = async () => {
    setBusy('stars');
    try {
      const data = await apiCreateInvoice({ course_id: courseId });
      if (!data?.invoice_link) {
        toast('✕', 'Не удалось создать счёт. Попробуй позже.');
        return;
      }
      // On paid, backend (bot) grants access via successful_payment -> /api/grant.
      // We reload to reflect new access; do NOT call gp/apply from the frontend.
      openInvoiceOrLink(data.invoice_link);
      // optimistic close; real update comes from reload on paid callback
      setTimeout(() => {
        void reload();
        onClose();
      }, 600);
    } catch {
      toast('✕', 'Ошибка сети. Проверь подключение.');
    } finally {
      setBusy(null);
    }
  };

  const bookProdamus = async () => {
    setBusy('prodamus');
    try {
      const data = await apiCreateInvoice({
        course_id: courseId,
        provider: 'prodamus',
      });
      if (!data?.pay_url) {
        if (data?.error === 'prodamus_not_configured')
          toast('!', 'Prodamus не настроен. Попробуй Stars.');
        else toast('✕', 'Не удалось создать платёж.');
        return;
      }
      openInvoiceOrLink(undefined, data.pay_url, true);
      toast('💳', 'Оплата открылась в браузере. Вернись сюда после оплаты.');
      // Poll backend for access confirmation (webhook-driven).
      pollPaid(courseId, reload);
      onClose();
    } catch {
      toast('✕', 'Ошибка сети.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Открыть доступ">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" block disabled={busy === 'stars'} onClick={bookStars}>
          🌟 Оплатить Stars
          <span style={{ opacity: 0.85, fontWeight: 600 }}>
            {coursePrice.stars} ★
          </span>
        </Button>
        <Button
          variant="secondary"
          block
          disabled={busy === 'prodamus'}
          onClick={bookProdamus}
        >
          💳 Картой / СБП
          <span style={{ opacity: 0.85, fontWeight: 600 }}>
            {coursePrice.rub} · МИР · Visa · СБП
          </span>
        </Button>
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--color-text-dim)',
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          Оплата внутри Telegram. Доступ откроется автоматически.
        </p>
      </div>
    </BottomSheet>
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

  const finalStars = Math.max(
    PRICES.mentor.floor,
    PRICES.mentor.gross - Math.min(user.groovePoints, PRICES.mentor.gpCap),
  );
  const discount = Math.min(user.groovePoints, PRICES.mentor.gpCap);

  const bookStars = async () => {
    if (typeof (window as any).Telegram?.WebApp?.openInvoice === 'undefined') {
      toast('ℹ', 'Оплата работает внутри Telegram. Открой через @OpenDeck_bot.');
      return;
    }
    setBusy('stars');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        price: finalStars,
      });
      if (!data?.invoice_link) {
        toast('✕', 'Не удалось создать счёт.');
        return;
      }
      // CRITICAL: do not call /api/gp/apply here. The bot applies the GP
      // discount idempotently on successful_payment (charge_id). Frontend
      // calling it would double-spend GP.
      openInvoiceOrLink(data.invoice_link);
      setTimeout(() => {
        void reload();
        onClose();
      }, 600);
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
      });
      if (!data?.pay_url) {
        toast('✕', 'Tribute не настроен. Попробуй Stars.');
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
    <BottomSheet open={open} onClose={onClose} title="Менторство 1-на-1">
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text-dim)',
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        4 сессии по 1.5 часа, персональная дорожная карта, разбор твоих миксов и
        поддержка между сессиями.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" block disabled={busy === 'stars'} onClick={bookStars}>
          🌟 Stars
          <span style={{ fontWeight: 600 }}>
            {finalStars.toLocaleString('ru-RU')} ★
            {discount ? ` (−${discount})` : ''}
          </span>
        </Button>
        <Button variant="secondary" block disabled={busy === 'tribute'} onClick={bookTribute}>
          💎 Tribute (USDT / карта)
          <span style={{ opacity: 0.85, fontWeight: 600 }}>$230</span>
        </Button>
        {discount > 0 && (
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--color-mint)',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Твоя скидка −{discount} ★ применена вStars-канале
          </p>
        )}
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
