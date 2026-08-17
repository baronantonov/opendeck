import { useState } from 'react';
import { useApp, COURSE_LESSONS } from '../state/store';
import { LessonPlayer } from '../components/LessonPlayer';
import { Paywall } from '../payment/Paywall';
import { Card } from '../components/ui';

export function Course() {
  const { course, isPaid, adminMode } = useApp();
  const [payOpen, setPayOpen] = useState(false);

  const isUnlocked = (i: number) =>
    isPaid || adminMode || i < course.freeLessons;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>Курс DJ</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-dim)' }}>
        От битов к первому сету — 6 уроков.
      </p>

      {!isPaid && !adminMode && (
        <Card
          style={{
            marginBottom: 16,
            borderColor: 'color-mix(in srgb, var(--color-coral) 40%, transparent)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Доступен только урок 1
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-dim)', marginTop: 4 }}>
            Открой доступ, чтобы пройти курс полностью и получить сертификат.
          </div>
        </Card>
      )}

      {COURSE_LESSONS.map((lesson, i) => (
        <LessonPlayer
          key={i}
          lesson={lesson}
          index={i}
          locked={!isUnlocked(i)}
          onUnlock={() => setPayOpen(true)}
        />
      ))}

      <Paywall courseId="dj-basics" open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
