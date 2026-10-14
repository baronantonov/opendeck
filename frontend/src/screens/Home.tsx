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
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          className="user-avatar"
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: 'var(--color-accent)',
            color: '#1d1f1e',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          {user.name[0] || 'Д'}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Привет,</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star />
          <b style={{ fontSize: 15 }}>{user.groovePoints}</b>
        </div>
      </header>

      <Card
        strip
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--brand-mauve) 26%, var(--color-surface)), var(--color-surface))',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 4 }}>
          {user.archetype}
        </div>
        <h1 className="brand-text" style={{ fontSize: 28, margin: '0 0 6px' }}>
          Open Deck
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, opacity: 0.85 }}>{archLine}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <Button
            variant="gradient"
            block
            onClick={() => {
              haptic('medium');
              nav('/course');
            }}
          >
            {playLabel}
          </Button>
        </div>
      </Card>

      <Card
        strip
        style={{
          background: 'linear-gradient(135deg, rgba(24, 27, 26, 0.95), rgba(15, 17, 16, 0.95))',
          borderColor: 'rgba(140, 226, 200, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-mint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Rekordbox Simulator
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
            Dual Deck A/B
          </span>
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
          Виртуальная DJ-консоль
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.45 }}>
          Горизонтальный пульт Pioneer/Rekordbox: виниловые джоги, RGB волновые формы, фазометр тактов и треки Berlin Vault & Dark Matter.
        </p>
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
      </Card>

      <HorizontalDeckModal
        isOpen={deckOpen}
        onClose={() => setDeckOpen(false)}
      />

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--color-text-dim)',
            marginBottom: 6,
          }}
        >
          <span>Прогресс курса</span>
          <span>
            {dc} / {tc}
          </span>
        </div>
        <ProgressBar value={pct} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { ic: '🎚️', t: 'С нуля', d: '6 уроков до сета' },
          { ic: '🎁', t: 'Бонусы', d: '★ за просмотры' },
          { ic: '🎧', t: 'Свой вайб', d: 'играй по-своему' },
        ].map((v) => (
          <div
            key={v.t}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 20 }}>{v.ic}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{v.t}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{v.d}</div>
          </div>
        ))}
      </div>

      {!isPaid && (
        <Card
          strip
          style={{ borderColor: 'color-mix(in srgb, var(--brand-coral) 40%, transparent)' }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Открой полный курс</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 10 }}>
            Урок 1 бесплатно. Дальше — доступ за 500 ★.
          </div>
          <Button variant="coral" block onClick={() => nav('/course')}>
            Выбрать план
          </Button>
        </Card>
      )}
    </div>
  );
}
