import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, COURSE_LESSONS } from '../state/store';
import { useCourseProgress } from '../state/CourseProgressContext';
import { Star } from '../components/ui';
import { useToast } from '../components/Toast';
import { MentorPay } from '../payment/Paywall';
import { PaywallModal } from '../components/PaywallModal';
import { haptic } from '../lib/theme';
import { Flame, Sliders } from 'lucide-react';
import { useRegisterModal } from '../lib/navigation';
import { GiftCourseModal } from '../components/GiftCourseModal';
import { StaggerContainer, StaggerItem } from '../components/MotionWrappers';
import { StatusBadge } from '../components/StatusBadge';
import { PocketDjCourseCard } from '../components/learning/PocketDjCourseCard';
import { CourseTeaserCard } from '../components/learning/CourseTeaserCard';
import { MentorOfferCard } from '../components/learning/MentorOfferCard';

export function LearningScreen() {
  const navigate = useNavigate();
  const { user, course, isPaid, adminMode } = useApp();
  const { guardLessonAccess, isCoursePurchased } = useCourseProgress();
  const { toast } = useToast();
  const [mentorOpen, setMentorOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['pocket-dj']));
  const [shakingCard, setShakingCard] = useState<string | null>(null);

  useRegisterModal('learn-mentor-modal', mentorOpen, () => setMentorOpen(false));

  const dc = course.completedLessons.length;
  const tc = COURSE_LESSONS.length;
  const hasFullAccess = Boolean(isPaid || adminMode || isCoursePurchased);

  const handleOpenLesson = (index: number) => {
    haptic('light');
    const access = guardLessonAccess(index);
    if (!access.allowed) {
      if (access.reason === 'needs_paywall') setPaywallOpen(true);
      else toast('🔒', 'Сначала заверши предыдущий урок');
      return;
    }
    navigate(`/lesson/${index + 1}`);
  };

  const toggleSection = (sectionKey: string) => {
    haptic('light');
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  const handleLockedCardClick = (cardId: string) => {
    haptic('light');
    setShakingCard(cardId);
    setTimeout(() => setShakingCard((curr) => (curr === cardId ? null : curr)), 500);
  };

  return (
    <div
      className="flex w-full max-w-full flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-[calc(env(safe-area-inset-bottom,0px)+96px)] select-none"
      style={{
        paddingTop:
          'calc(max(env(safe-area-inset-top, 0px), var(--app-safe-top, 0px), var(--safe-top, 0px)) + 16px)',
      }}
    >
      <StaggerContainer stepMs={60} className="gap-4">
        <StaggerItem index={0}>
          <div
            className="flex items-center justify-between gap-2 rounded-full px-4 py-2.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_8px_24px_rgba(0,0,0,0.38)]"
            style={{ background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)' }}
          >
            <StatusBadge isPlayer={hasFullAccess} size="md" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-extrabold text-[var(--color-text)] whitespace-nowrap">
                {dc} / {tc}
              </span>
              <div
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                style={{ background: 'color-mix(in srgb, var(--brand-gold) 15%, var(--color-surface-2))' }}
              >
                <Star size={12} />
                <span className="text-[var(--brand-gold)] font-extrabold whitespace-nowrap">
                  {user.groovePoints} GP
                </span>
              </div>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem index={1}>
          <PocketDjCourseCard
            isOpen={openSections.has('pocket-dj')}
            onToggle={() => toggleSection('pocket-dj')}
            completedLessons={course.completedLessons}
            isPaid={isPaid}
            adminMode={adminMode}
            hasFullAccess={hasFullAccess}
            onOpenLesson={handleOpenLesson}
            onOpenPaywall={() => setPaywallOpen(true)}
            onOpenGift={() => {
              haptic('light');
              setGiftOpen(true);
            }}
          />
        </StaggerItem>

        <StaggerItem index={2}>
          <CourseTeaserCard
            title="Beginner DJ"
            description="Перекладываем знания и осваиваем физический контроллер, изучаем устройство и подключение оборудования."
            tags={['Физический контроллер', 'Коммутация и аудиокарта', 'Архитектура сета']}
            accent="mauve"
            icon={<Sliders size={18} />}
            isShaking={shakingCard === 'beginner'}
            onClick={() => handleLockedCardClick('beginner')}
          />
        </StaggerItem>

        <StaggerItem index={3}>
          <CourseTeaserCard
            title="Advanced DJ"
            description="Фишки и приёмы опытных диджеев, глубокое погружение в плотные слои вайба и работа с танцполом."
            tags={['Креативный лайв-миксинг', 'Работа с аудиторией', 'Собственный почерк']}
            accent="coral"
            icon={<Flame size={18} />}
            isShaking={shakingCard === 'advanced'}
            onClick={() => handleLockedCardClick('advanced')}
          />
        </StaggerItem>

        <StaggerItem index={4}>
          <MentorOfferCard
            isOpen={openSections.has('mentor')}
            onToggle={() => toggleSection('mentor')}
            groovePoints={user.groovePoints}
            onOpenMentorPay={() => setMentorOpen(true)}
          />
        </StaggerItem>
      </StaggerContainer>

      <MentorPay open={mentorOpen} onClose={() => setMentorOpen(false)} />
      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} courseId="dj-basics" />
      <GiftCourseModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        courseId="dj-basics"
        courseTitle="Pocket DJ"
        priceStars={2500}
      />
    </div>
  );
}

export default LearningScreen;
