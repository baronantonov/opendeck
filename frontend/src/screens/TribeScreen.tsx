import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { useCourseProgress } from '../state/CourseProgressContext';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';
import { PaywallModal } from '../components/PaywallModal';
import { StaggerContainer } from '../components/MotionWrappers';
import {
  CONFETTI_SHOWN_KEY,
  TribeCanvasConfetti,
} from '../components/tribe/TribeCanvasConfetti';
import { TribeResidentView } from '../components/tribe/TribeResidentView';
import { TribeGuestView } from '../components/tribe/TribeGuestView';

const DEFAULT_TRIBE_INVITE_URL = 'https://t.me/+S9cLCiFHbWQzY2Iy';

export function TribeScreen() {
  const navigate = useNavigate();
  const { course, isPaid, adminMode } = useApp();
  const { guardTribeAccess, verifyIntegrity, isCoursePurchased } = useCourseProgress();
  const [showConfetti, setShowConfetti] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const tribeGuard = guardTribeAccess();
  const hasAccess = Boolean(adminMode || isPaid || isCoursePurchased || tribeGuard.allowed);
  const isLesson1Done = course.completedLessons.includes(1);
  const isLesson2Done = course.completedLessons.includes(2);

  useEffect(() => {
    if (hasAccess && paywallOpen) {
      setPaywallOpen(false);
    }
  }, [hasAccess, paywallOpen]);

  useEffect(() => {
    if (!hasAccess) return;

    const localFlag = localStorage.getItem(CONFETTI_SHOWN_KEY);
    if (localFlag === 'true') {
      return;
    }

    const tg = getTelegramWebApp();

    const triggerConfettiSuccess = () => {
      localStorage.setItem(CONFETTI_SHOWN_KEY, 'true');
      try {
        tg?.CloudStorage?.setItem?.(CONFETTI_SHOWN_KEY, 'true');
      } catch {
        /* ignore */
      }

      try {
        if (tg?.HapticFeedback?.notificationOccurred) {
          tg.HapticFeedback.notificationOccurred('success');
        } else {
          haptic('success');
        }
      } catch {
        /* fallback */
      }

      setShowConfetti(true);
    };

    if (tg?.CloudStorage?.getItem) {
      try {
        tg.CloudStorage.getItem(CONFETTI_SHOWN_KEY, (err, val) => {
          if (!err && val === 'true') {
            localStorage.setItem(CONFETTI_SHOWN_KEY, 'true');
            return;
          }
          triggerConfettiSuccess();
        });
      } catch {
        triggerConfettiSuccess();
      }
    } else {
      triggerConfettiSuccess();
    }
  }, [hasAccess]);

  const handleJoinCamp = () => {
    haptic('light');
    const guard = guardTribeAccess();
    if (!hasAccess && !guard.allowed) {
      if (guard.reason === 'tampered') {
        verifyIntegrity();
      }
      setPaywallOpen(true);
      return;
    }

    let inviteUrl = DEFAULT_TRIBE_INVITE_URL;
    try {
      const stored = sessionStorage.getItem('opendeck_tribe_link');
      if (stored) inviteUrl = stored;
    } catch {}

    const tg = getTelegramWebApp();
    try {
      if (tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred('success');
      }
    } catch {
      /* fallback */
    }

    try {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(inviteUrl);
        return;
      }
    } catch {
      /* fallback */
    }

    window.open(inviteUrl, '_blank', 'noopener,noreferrer');
  };

  const handleGoToLearn = () => {
    haptic('light');
    navigate('/learn');
  };

  return (
    <div className="flex w-full max-w-full flex-col gap-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] select-none">
      {showConfetti && <TribeCanvasConfetti onComplete={() => setShowConfetti(false)} />}

      <StaggerContainer stepMs={60} className="gap-4">
        {hasAccess ? (
          <TribeResidentView onJoinCamp={handleJoinCamp} />
        ) : (
          <TribeGuestView
            isLesson1Done={isLesson1Done}
            isLesson2Done={isLesson2Done}
            onOpenPaywall={() => {
              haptic('light');
              setPaywallOpen(true);
            }}
            onGoToLearn={handleGoToLearn}
          />
        )}
      </StaggerContainer>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        courseId="dj-basics"
      />
    </div>
  );
}

export default TribeScreen;
