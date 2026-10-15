import { useState } from 'react';
import { apiCreateInvoice } from '../api/client';
import { useToast } from '../components/Toast';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/ui';
import { PRICES, mentorPrices } from '../lib/constants';
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
      toast('✓', 'Оплата открылась в браузере. Вернись сюда после оплаты.');
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
          Telegram Stars
          <span style={{ opacity: 0.9, fontWeight: 700 }}>
            2 500 Stars
          </span>
        </Button>
        <Button
          variant="secondary"
          block
          disabled={busy === 'prodamus'}
          onClick={bookProdamus}
        >
          Карта РФ / СБП (Prodamus)
          <span style={{ opacity: 0.9, fontWeight: 700 }}>
            {coursePrice.rub}
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

  const { discountUsd, discountRub, finalUsd, finalRub, cappedGp } = mentorPrices(user.groovePoints);

  const bookProdamus = async () => {
    setBusy('prodamus');
    try {
      const data = await apiCreateInvoice({
        course_id: 'mentoring',
        provider: 'prodamus',
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
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        4 персональные сессии по 1.5 часа, разбор твоих треков, сведение сета и поддержка между звонками. Оплата напрямую (чистыми $190 мастеру).
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
        {cappedGp > 0 ? (
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--color-mint)',
              textAlign: 'center',
              margin: '2px 0 0',
            }}
          >
            Применена скидка за {cappedGp} GP: −${discountUsd} (−{discountRub} ₽)
          </p>
        ) : (
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--color-text-dim)',
              textAlign: 'center',
              margin: '2px 0 0',
            }}
          >
            Проходи уроки и получай ачивки, чтобы заработать до $50 скидки!
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
