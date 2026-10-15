import { useState } from 'react';
import { useApp } from '../state/store';
import { LessonPlayer } from '../components/LessonPlayer';
import { Paywall } from '../payment/Paywall';
import { Card } from '../components/ui';

export function Bonus() {
  const { bonusLessonsData, isPaid, adminMode } = useApp();
  const [payOpen, setPayOpen] = useState(false);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Бонус-уроки</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-dim)' }}>
        Теория, история и направления диджеинга.
      </p>

      {!isPaid && !adminMode && (
        <Card
          strip
          style={{
            marginBottom: 16,
            borderColor: 'color-mix(in srgb, var(--brand-coral) 40%, transparent)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Бонусы — вместе с полным курсом
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginTop: 4 }}>
            Открой доступ к курсу, и все 4 бонус-урока станут доступны.
          </div>
        </Card>
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
