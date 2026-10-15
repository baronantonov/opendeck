import { useState } from 'react';
import { useApp, COURSE_LESSONS } from '../state/store';
import { LessonPlayer } from '../components/LessonPlayer';
import { Paywall } from '../payment/Paywall';

export function Course() {
  const { course, isPaid, adminMode } = useApp();
  const [payOpen, setPayOpen] = useState(false);

  const isUnlocked = (i: number) =>
    isPaid || adminMode || i < course.freeLessons;

  return (
    <div style={{ padding: 16 }}>
      {/* Course Header */}
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
          PIONEER DJ ACADEMY · TRACKLIST
        </div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px', color: '#f0f3f6' }}>
          Курс DJ: Базовый сетап
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#8e98a5' }}>
          От первого бита к полноценному 15-минутному клубному сету — 6 практических модулей.
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
              Урок 1 открыт бесплатно
            </div>
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: '#ff5a00' }}>
              500 ★ / 2 990 ₽
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#8e98a5', lineHeight: 1.4 }}>
            Пройди вступительный урок на виртуальной деке. Для доступа ко всем 6 модулям и сертификации открой полный курс.
          </div>
        </div>
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
