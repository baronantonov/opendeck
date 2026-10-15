import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { Button, Card, ProgressBar, Star } from '../components/ui';
import { ARCHETYPES } from '../lib/constants';
import { haptic } from '../lib/theme';
import { HorizontalDeckModal } from '../components/deck/HorizontalDeckModal';

export function Home() {
  const nav = useNavigate();
  const { user, course, isPaid } = useApp();
  const [deckOpen, setDeckOpen] = useState(false);
  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const pct = Math.round((dc / tc) * 100);
  const nextId = Math.min(dc + 1, tc);
  const archLine = ARCHETYPES[user.archetype] || 'Твой путь DJ начинается здесь';

  const playLabel =
    dc === 0
      ? 'Начать урок 1'
      : dc >= tc
        ? 'Курс пройден'
        : !isPaid
          ? 'Открыть доступ · 500 ★'
          : `Продолжить · урок ${nextId}`;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Bar: DJ ID Badge & GP Display */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1b2028 0%, #101317 100%)',
            border: '1.5px solid #00e5ff',
            color: '#00e5ff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 16,
            boxShadow: '0 0 10px rgba(0, 229, 255, 0.25)',
            flexShrink: 0,
          }}
        >
          {user.name[0] || 'D'}
        </div>
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: '#657283',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            DJ PASS · {user.archetype || 'ROOKIE'}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f0f3f6' }}>{user.name}</div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#101318',
            border: '1px solid rgba(255, 214, 0, 0.25)',
            borderRadius: 10,
            padding: '5px 10px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          <Star size={13} />
          <span
            className="font-mono"
            style={{ fontSize: 13.5,
            fontWeight: 700,
            color: '#ffd600' }}
          >
            {user.groovePoints.toLocaleString()} GP
          </span>
        </div>
      </header>

      {/* Centerpiece Hero: Rekordbox Virtual Console */}
      <div
        className="animate-pop"
        style={{
          background: 'linear-gradient(160deg, #161920 0%, #0e1115 100%)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(0, 229, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header line with live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00f076',
                boxShadow: '0 0 6px #00f076',
                display: 'inline-block',
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: '#00e5ff',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              REKORDBOX DUAL-DECK
            </span>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#8a94a2',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            126.0 BPM · SYNC
          </span>
        </div>

        <h2 style={{ fontSize: 20, margin: '0 0 4px', color: '#f0f3f6' }}>
          Виртуальная DJ-консоль
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#8e98a5', lineHeight: 1.45 }}>
          Полноэкранный пульт Pioneer Rekordbox: виниловые джоги, RGB волновые формы, Web Audio 909 kick & 303 acid синтезатор и сведение треков Berlin Vault & Dark Matter.
        </p>

        {/* Mini waveform bar visualization */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            height: 18,
            background: '#090b0e',
            borderRadius: 6,
            padding: '2px 6px',
            alignItems: 'center',
            marginBottom: 14,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <span className="font-mono" style={{ fontSize: 9.5, color: '#00e5ff', fontWeight: 700 }}>A</span>
          <div style={{ flex: 1, height: 6, background: 'linear-gradient(90deg, #0077ff, #00e5ff)', borderRadius: 3 }} />
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ flex: 1, height: 6, background: 'linear-gradient(90deg, #ff3b30, #ff5a00)', borderRadius: 3 }} />
          <span className="font-mono" style={{ fontSize: 9.5, color: '#ff5a00', fontWeight: 700 }}>B</span>
        </div>

        <Button
          variant="primary"
          block
          onClick={() => {
            haptic('heavy');
            setDeckOpen(true);
          }}
        >
          🎧 Встать за пульт Rekordbox
        </Button>
      </div>

      <HorizontalDeckModal
        isOpen={deckOpen}
        onClose={() => setDeckOpen(false)}
      />

      {/* Course Progress Card */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f3f6' }}>Программа обучения DJ</span>
          <span className="font-mono" style={{ fontSize: 12, color: '#00e5ff', fontWeight: 600 }}>
            {dc} / {tc} уроков · {pct}%
          </span>
        </div>
        <ProgressBar value={pct} />
        <div style={{ marginTop: 14 }}>
          <Button
            variant="secondary"
            block
            onClick={() => {
              haptic('medium');
              nav('/course');
            }}
          >
            ▶ {playLabel}
          </Button>
        </div>
      </Card>

      {/* 3 Hardware Feature Specs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { ic: '🎚️', t: 'С нуля', d: '6 уроков до сета' },
          { ic: '🔊', t: 'Web Audio', d: '909 kick & 303' },
          { ic: '🏆', t: 'Сертификат', d: 'микс в профиле' },
        ].map((v) => (
          <div
            key={v.t}
            style={{
              background: '#14171d',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '12px 10px',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
            }}
          >
            <div style={{ fontSize: 20 }}>{v.ic}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6, color: '#f0f3f6' }}>{v.t}</div>
            <div style={{ fontSize: 11, color: '#7e8b9b', marginTop: 2 }}>{v.d}</div>
          </div>
        ))}
      </div>

      {/* Paywall CTA Card (if not paid) */}
      {!isPaid && (
        <div
          className="animate-pop"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.09) 0%, #14171d 100%)',
            border: '1px solid rgba(255, 90, 0, 0.35)',
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0f3f6' }}>Полный доступ к курсу</div>
            <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: '#ff5a00' }}>
              VIP ACCESS
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#8e98a5', marginBottom: 12 }}>
            Урок 1 доступен бесплатно. Разблокируй все 6 практических уроков, 4 бонус-трека и менторство за 500 ★.
          </div>
          <Button
            variant="coral"
            block
            onClick={() => {
              haptic('medium');
              nav('/course');
            }}
          >
            Выбрать тариф · 500 ★
          </Button>
        </div>
      )}
    </div>
  );
}
