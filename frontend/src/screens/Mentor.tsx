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
      {/* Header */}
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#00e5ff',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          CAREER & ADVANCED MENTORSHIP
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px', color: '#f0f3f6' }}>
          Персональное менторство
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#8e98a5' }}>
          Индивидуальная работа с действующим диджеем: от первого микса до клубного букинга.
        </p>
      </div>

      {!isPaid && (
        <div
          className="animate-pop"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.08) 0%, #14171d 100%)',
            border: '1px solid rgba(255, 90, 0, 0.3)',
            borderRadius: 16,
            padding: 14,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f0f3f6', marginBottom: 4 }}>
            Сначала пройди базовый курс
          </div>
          <div style={{ fontSize: 12.5, color: '#8e98a5', lineHeight: 1.4 }}>
            Для продуктивного менторства рекомендуется освоить базовые уроки сведения на деке.
          </div>
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            🎛️
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#f0f3f6' }}>Программа 1-на-1 (4 недели)</div>
            <div style={{ fontSize: 12.5, color: '#8e98a5' }}>
              4 живых зум-сессии · разбор твоих миксов · помощь с сетом
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
          {[
            'Разбор библиотеки треков, Harmonic Mixing (Camelot Wheel)',
            'Продвинутая эквализация, Isolator & Color FX (Sweep, Space, Dub Echo)',
            'Запись и мастеринг твоего промо-микса для клубов и подкастов',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#b2bcc8' }}>
              <span className="font-mono" style={{ color: '#00e5ff', fontWeight: 700 }}>0{i + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star size={14} />
            <b className="font-mono" style={{ fontSize: 16, color: '#ffd600' }}>
              {finalStars.toLocaleString('ru-RU')} ★
            </b>
            {discount > 0 && (
              <span className="font-mono" style={{ fontSize: 11.5, color: '#00f076', fontWeight: 600 }}>
                скидка −{discount} GP
              </span>
            )}
          </div>
          <span className="font-mono" style={{ fontSize: 12, color: '#8a94a2' }}>$230 equiv</span>
        </div>

        <Button
          variant="gradient"
          block
          style={{ marginTop: 14 }}
          onClick={() => setOpen(true)}
        >
          Записаться на менторство
        </Button>
      </Card>

      <MentorPay open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
