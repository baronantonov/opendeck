import { useState } from 'react';
import { apiProgress } from '../api/client';
import { useToast } from './Toast';
import { Button } from './ui';
import { haptic } from '../lib/theme';
import { useApp } from '../state/store';
import type { Lesson } from '../types';
import { HorizontalDeckModal } from './deck/HorizontalDeckModal';

export function LessonPlayer({
  lesson,
  index,
  locked,
  courseId = 'dj-basics',
  onUnlock,
}: {
  lesson: Lesson;
  index: number;
  locked: boolean;
  courseId?: string;
  onUnlock?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const { toast } = useToast();
  const { completeLesson, course } = useApp();

  const isCompleted = course.completedLessons.includes(index + 1) || done;
  const trackNum = String(index + 1).padStart(2, '0');

  const markDone = async () => {
    try {
      await apiProgress(courseId, index + 1);
    } catch {
      /* offline ok */
    }
    completeLesson(index + 1);
    setDone(true);
    haptic('success');
    toast('✓', 'Урок освоен — +50 GP');
  };

  return (
    <div
      className="animate-pop"
      style={{
        background: '#14171d',
        border: isCompleted
          ? '1px solid rgba(0, 240, 118, 0.3)'
          : locked
            ? '1px solid rgba(255, 255, 255, 0.05)'
            : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        opacity: locked ? 0.6 : 1,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 16px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          className="font-mono"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            background: isCompleted
              ? 'rgba(0, 240, 118, 0.15)'
              : locked
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 229, 255, 0.1)',
            border: isCompleted
              ? '1px solid #00f076'
              : locked
                ? '1px solid rgba(255, 255, 255, 0.08)'
                : '1px solid rgba(0, 229, 255, 0.35)',
            color: isCompleted ? '#00f076' : locked ? '#5d6776' : '#00e5ff',
            fontWeight: 800,
            fontSize: 13.5,
            boxShadow: isCompleted ? '0 0 8px rgba(0, 240, 118, 0.3)' : 'none',
          }}
        >
          {isCompleted ? '✓' : locked ? '🔒' : trackNum}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#f0f3f6' }}>{lesson.t}</div>
          {!open && (
            <div
              style={{
                fontSize: 12,
                color: '#828e9e',
                marginTop: 2,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {lesson.d[0]}
            </div>
          )}
        </div>
      </div>

      {open && lesson.video && (
        <div
          style={{
            marginTop: 12,
            aspectRatio: '16 / 9',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#000',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <iframe
            width="100%"
            height="100%"
            src={lesson.video}
            title={lesson.t}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 0 }}
          />
        </div>
      )}

      {open && (
        <ul
          style={{
            margin: '12px 0 0',
            paddingLeft: 18,
            fontSize: 13,
            color: '#b0b8c4',
            lineHeight: 1.5,
          }}
        >
          {lesson.d.map((p, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {p}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {!locked && index === 0 && (
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
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {locked ? (
            <Button variant="coral" block onClick={onUnlock}>
              Открыть доступ · 500 ★
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                block
                onClick={() => {
                  haptic('light');
                  setOpen((o) => !o);
                }}
              >
                {open ? 'Скрыть урок' : 'Смотреть урок'}
              </Button>
              {open && !isCompleted && (
                <Button variant="mint" block onClick={markDone}>
                  ✓ Освоено · +50 GP
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <HorizontalDeckModal
        isOpen={deckOpen}
        onClose={() => setDeckOpen(false)}
        lesson={lesson}
      />
    </div>
  );
}
