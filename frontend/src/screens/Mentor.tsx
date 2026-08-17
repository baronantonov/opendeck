import { useState } from 'react';
import { useApp } from '../state/store';
import { Button, Card, Star } from '../components/ui';
import { MentorPay } from '../payment/Paywall';
import { PRICES } from '../lib/constants';

export function Mentor() {
  const { user, isPaid } = useApp();
  const [open, setOpen] = useState(false);
  const discount = Math.min(user.groovePoints, PRICES.mentor.gpCap);
  const finalStars = Math.max(
    PRICES.mentor.floor,
    PRICES.mentor.gross - discount,
  );

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontSize: 20, margin: 0 }}>Развитие</h2>

      {!isPaid && (
        <Card
          style={{
            borderColor: 'color-mix(in srgb, var(--color-coral) 40%, transparent)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            Сначала открой курс
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)' }}>
            Полный доступ — 2100 ★. После этого откроются бонусы и менторство.
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>🎓</div>
          <div>
            <div style={{ fontWeight: 700 }}>Менторство 1-на-1</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)' }}>
              4 сессии · разбор миксов · дорожная карта
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTop:
              '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star />
            <b>{finalStars.toLocaleString('ru-RU')} ★</b>
            {discount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-mint)' }}>
                скидка −{discount}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>$230 · Tribute</span>
        </div>
        <Button variant="primary" block style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
          Записаться
        </Button>
      </Card>

      <MentorPay open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
