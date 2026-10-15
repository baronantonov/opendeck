import { useState } from 'react';
import { useApp } from '../state/store';
import { LessonPlayer } from '../components/LessonPlayer';
import { Paywall } from '../payment/Paywall';

export function Bonus() {
  const { bonusLessonsData, isPaid, adminMode } = useApp();
  const [payOpen, setPayOpen] = useState(false);

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
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
          EXCLUSIVE CRATE · BONUS TRACKS
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px', color: '#f0f3f6' }}>
          Бонусные мастер-классы
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#8e98a5' }}>
          Теория саунд-дизайна, анатомия 4/4 грува и психология танцпола — 4 углубленных урока.
        </p>
      </div>

      {!isPaid && !adminMode && (
        <div
          className="animate-pop"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.08) 0%, #14171d 100%)',
            border: '1px solid rgba(255, 90, 0, 0.3)',
            borderRadius: 16,
            padding: 14,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f0f3f6' }}>
              Бонусы входят в полный курс
            </div>
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: '#ff5a00' }}>
              BONUS UNLOCK
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#8e98a5', lineHeight: 1.4 }}>
            Открой доступ к основному курсу Open Deck, и все 4 дополнительных мастер-класса разблокируются автоматически.
          </div>
        </div>
      )}

      {bonusLessonsData.map((lesson, i) => (
        <LessonPlayer
          key={lesson.id ?? i}
          lesson={lesson}
          index={i}
          courseId="dj-bonus"
          locked={!isPaid && !adminMode}
          onUnlock={() => setPayOpen(true)}
        />
      ))}

      <Paywall courseId="dj-basics" open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
