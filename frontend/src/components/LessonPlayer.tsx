import { useState } from 'react';
import { apiProgress } from '../api/client';
import { useToast } from './Toast';
import { Button } from './ui';
import { haptic } from '../lib/theme';
import { useApp } from '../state/store';
import type { Lesson } from '../types';

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
  const { toast } = useToast();
  const { completeLesson, course } = useApp();

  const isCompleted = course.completedLessons.includes(index + 1) || done;

  const markDone = async () => {
    try {
      const j = await apiProgress(courseId, index + 1);
      if (j?.gp !== undefined) {
        // server returns updated gp; refresh via reload if needed
      }
    } catch {
      /* offline ok */
    }
    completeLesson(index + 1);
    setDone(true);
    haptic('success');
    toast('✓', 'Урок отмечен — +50 ★');
  };

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        opacity: locked ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            background: isCompleted
              ? 'var(--color-mint)'
              : 'color-mix(in srgb, var(--color-text) 10%, transparent)',
            color: isCompleted ? '#11322a' : 'var(--color-text-dim)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {isCompleted ? '✓' : index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{lesson.t}</div>
          {!open && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-dim)',
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
            color: 'var(--color-text)',
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

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {locked ? (
          <Button variant="coral" block onClick={onUnlock}>
            Открыть доступ
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
              {open ? 'Скрыть' : 'Смотреть'}
            </Button>
            {open && !isCompleted && (
              <Button variant="mint" block onClick={markDone}>
                Готово
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
