import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { useCourseProgress } from '../state/CourseProgressContext';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';
import { PaywallModal } from '../components/PaywallModal';
import {
  StaggerContainer,
  StaggerItem,
  ShimmerButton,
} from '../components/MotionWrappers';
import { AbstractGeometryBg } from '../components/LiquidGlassGeometry';
import {
  Lock,
  Unlock,
  Users,
  Flame,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Headphones,
} from 'lucide-react';

const CONFETTI_SHOWN_KEY = 'opendeck_tribe_confetti_shown';
const CONFETTI_COLORS = ['#8ce2c8', '#f5926e', '#c0a0a8', '#f3c969', '#ffffff'];

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRotation: number;
  tilt: number;
  vTilt: number;
  alpha: number;
  shape: 'rect' | 'circle';
}

function TribeCanvasConfetti({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const startTime = performance.now();
    const duration = 3800;

    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    updateSize();

    const particles: ConfettiParticle[] = [];
    const count = 100;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
      const side = i % 3;
      let originX = w * 0.5;
      let originY = h * 0.45;
      let angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      let speed = 9 + Math.random() * 12;

      if (side === 0) {
        originX = w * 0.15;
        originY = h * 0.85;
        angle = -Math.PI / 3 + (Math.random() - 0.5) * 0.7;
        speed = 12 + Math.random() * 14;
      } else if (side === 1) {
        originX = w * 0.85;
        originY = h * 0.85;
        angle = (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.7;
        speed = 12 + Math.random() * 14;
      }

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() - 0.5) * 0.2,
        tilt: Math.random() * Math.PI * 2,
        vTilt: 0.06 + Math.random() * 0.08,
        alpha: 1,
        shape: Math.random() > 0.35 ? 'rect' : 'circle',
      });
    }

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, w, h);

      const fadeStart = 2400;
      let globalAlpha = 1;
      if (elapsed > fadeStart) {
        globalAlpha = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32;
        p.vx *= 0.982;
        p.rotation += p.vRotation;
        p.tilt += p.vTilt;

        const currentAlpha = p.alpha * globalAlpha;
        if (currentAlpha <= 0.01) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const scaleX = Math.cos(p.tilt);
        ctx.scale(scaleX, 1);
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (elapsed < duration) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        onComplete?.();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999] h-screen w-screen"
    />
  );
}

/**
 * Экран «ПЛЕМЯ» (TribeScreen.tsx — VIP Pass):
 * Оформлен как эксклюзивный клубный пропуск в стиле Liquid Glass
 * с абстрактной геометрией и мощной акцентной кнопкой.
 */
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
          <>
            {/* 1. VIP PASS: ДОСТУП ОТКРЫТ */}
            <StaggerItem index={0}>
              <div
                className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_42px_rgba(0,0,0,0.48)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="vip" spheres={2} accent="mint" />

                <div className="relative z-10 flex flex-col gap-4">
                  {/* Шапка VIP Pass */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-mint) 15%, var(--color-surface-2))',
                      }}
                    >
                      <span
                        className="animate-organic-pulse inline-block h-2 w-2 rounded-full"
                        style={{
                          background: 'var(--brand-mint)',
                          boxShadow: '0 0 8px var(--brand-mint)',
                        }}
                      />
                      <span>VIP PASS · АКТИВЕН</span>
                    </span>

                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
                      }}
                    >
                      <Users size={13} className="text-[var(--brand-mint)]" />
                      <span>Open Deck Camp</span>
                    </span>
                  </div>

                  {/* Титульный блок пропуска */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[var(--brand-mint)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_24px_rgba(140,226,200,0.22)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-mint) 18%, var(--color-surface-2))',
                      }}
                    >
                      <Unlock size={26} />
                    </div>
                    <div>
                      <h1 className="brand-text m-0 text-2xl font-extrabold tracking-tight">
                        ТВОЁ ПЛЕМЯ
                      </h1>
                      <p className="m-0 mt-1 text-xs font-semibold text-[var(--brand-mint)]">
                        Закрытый клуб резидентов Open Deck
                      </p>
                    </div>
                  </div>

                  {/* Поздравительное сообщение */}
                  <div
                    className="rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    style={{
                      background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                    }}
                  >
                    <p className="m-0 text-[13.5px] font-medium leading-relaxed text-[var(--color-text)]">
                      Добро пожаловать в племя! Ты сделал первый шаг, и теперь двери нашего кэмпа открыты для тебя. Здесь нет «глупых» вопросов, только поддержка и общая любовь к музыке. Заходи, мы тебя ждем!
                    </p>
                  </div>

                  {/* Мощная акцентная кнопка входа в Camp */}
                  <ShimmerButton
                    variant="mint"
                    block
                    shimmer
                    hapticFeedback="light"
                    onClick={handleJoinCamp}
                    className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
                  >
                    <Sparkles size={18} />
                    <span>Войти в закрытый Camp</span>
                    <ExternalLink size={18} />
                  </ShimmerButton>
                </div>
              </div>
            </StaggerItem>

            {/* 2. ЧТО ВНУТРИ КЭМПА */}
            <StaggerItem index={1}>
              <div
                className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.4)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="card" spheres={0} accent="coral" />

                <div className="relative z-10 flex flex-col gap-3.5">
                  <h3 className="m-0 flex items-center gap-2 text-sm font-extrabold text-[var(--color-text)]">
                    <Flame size={16} className="text-[var(--brand-coral)]" />
                    <span>Привилегии резидента кэмпа</span>
                  </h3>

                  <div className="flex flex-col gap-2.5">
                    <div
                      className="flex items-start gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                      }}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mint)]"
                        style={{ background: 'color-mix(in srgb, var(--brand-mint) 15%, transparent)' }}
                      >
                        <MessageCircle size={15} />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-[var(--color-text)]">
                          Закрытый чат единомышленников
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">
                          Общение с такими же увлеченными студентами и выпускниками школы.
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-start gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                      }}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-coral)]"
                        style={{ background: 'color-mix(in srgb, var(--brand-coral) 15%, transparent)' }}
                      >
                        <HelpCircle size={15} />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-[var(--color-text)]">
                          Ответы на любые вопросы
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">
                          Разбор трудностей по урокам Pocket DJ, технике сведения и софту.
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-start gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                      }}
                    >
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--brand-mauve)]"
                        style={{ background: 'color-mix(in srgb, var(--brand-mauve) 16%, transparent)' }}
                      >
                        <Headphones size={15} />
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-[var(--color-text)]">
                          Фидбек по твоим первым миксам
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-dim)]">
                          Делись записями своих сетов и получай конструктивную обратную связь.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </>
        ) : (
          /* СОСТОЯНИЕ VIP PASS: ЗАКРЫТ ДО ПОКУПКИ КУРСА */
          <>
            <StaggerItem index={0}>
              <div
                className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_16px_42px_rgba(0,0,0,0.48)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="vip" spheres={2} accent="coral" />

                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-coral) 15%, var(--color-surface-2))',
                      }}
                    >
                      <Lock size={12} />
                      <span>VIP PASS · ЗАКРЫТ</span>
                    </span>

                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 65%, transparent)',
                      }}
                    >
                      Требуется Pocket DJ
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[var(--brand-coral)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_0_24px_rgba(245,146,110,0.18)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-coral) 16%, var(--color-surface-2))',
                      }}
                    >
                      <Lock size={26} />
                    </div>
                    <div>
                      <h1 className="brand-text m-0 text-2xl font-extrabold tracking-tight">
                        ЗАКРЫТЫЙ DJ CAMP
                      </h1>
                      <p className="m-0 mt-1 text-xs font-semibold text-[var(--color-text-dim)]">
                        Клубный пропуск резидента Open Deck
                      </p>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    style={{
                      background: 'color-mix(in srgb, var(--color-surface-2) 30%, transparent)',
                    }}
                  >
                    <p className="m-0 text-[13.5px] font-medium leading-relaxed text-[var(--color-text)]">
                      Твой эксклюзивный пропуск в закрытый «Open Deck DJ Camp» ждет тебя. Доступ к комьюнити открывается мгновенно при покупке курса Pocket DJ. Внутри — закрытый чат студентов, разборы миксов и поддержка кураторов.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <ShimmerButton
                      variant="mint"
                      block
                      shimmer
                      hapticFeedback="light"
                      onClick={() => {
                        haptic('light');
                        setPaywallOpen(true);
                      }}
                      className="button-glow-pulse h-13 py-3.5 rounded-2xl text-base font-bold"
                    >
                      <Sparkles size={18} />
                      <span>Открыть Pocket DJ · 2 500 Stars</span>
                    </ShimmerButton>

                    <button
                      type="button"
                      onClick={handleGoToLearn}
                      className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold text-[var(--color-text)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
                      style={{
                        background: 'color-mix(in srgb, var(--color-surface-2) 78%, transparent)',
                      }}
                    >
                      <span>Бесплатные вводные уроки</span>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* 2. ТРАЕКТОРИЯ ДОСТУПА */}
            <StaggerItem index={1}>
              <div
                className="relative overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.4)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
                }}
              >
                <AbstractGeometryBg variant="card" spheres={0} accent="mint" />

                <div className="relative z-10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-dim)]">
                      Активация клубного пропуска
                    </span>
                    <span className="text-xs font-extrabold text-[var(--brand-gold)]">
                      Pocket DJ
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {/* Шаг 1 */}
                    <div
                      className="flex items-center justify-between rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                      style={{
                        background: isLesson1Done
                          ? 'color-mix(in srgb, var(--brand-mint) 10%, var(--color-surface-2))'
                          : 'color-mix(in srgb, var(--color-surface-2) 55%, rgba(14, 17, 16, 0.5))',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold"
                          style={{
                            background: isLesson1Done ? 'var(--brand-mint)' : 'rgba(255,255,255,0.08)',
                            color: isLesson1Done ? '#11322a' : 'var(--color-text-dim)',
                          }}
                        >
                          {isLesson1Done ? <CheckCircle2 size={15} /> : '1'}
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-[var(--color-text)]">
                            Урок 1: Первый контроллер
                          </div>
                          <div
                            className="text-[11px]"
                            style={{
                              color: isLesson1Done ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                            }}
                          >
                            {isLesson1Done ? 'Пройден ✓' : 'Бесплатный вводный урок'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Шаг 2 */}
                    <div
                      className="flex items-center justify-between rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                      style={{
                        background: isLesson2Done
                          ? 'color-mix(in srgb, var(--brand-mint) 10%, var(--color-surface-2))'
                          : 'color-mix(in srgb, var(--color-surface-2) 55%, rgba(14, 17, 16, 0.5))',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold"
                          style={{
                            background: isLesson2Done ? 'var(--brand-mint)' : 'rgba(255,255,255,0.08)',
                            color: isLesson2Done ? '#11322a' : 'var(--color-text-dim)',
                          }}
                        >
                          {isLesson2Done ? <CheckCircle2 size={15} /> : '2'}
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-[var(--color-text)]">
                            Урок 2: Знакомство с FREEDA
                          </div>
                          <div
                            className="text-[11px]"
                            style={{
                              color: isLesson2Done ? 'var(--brand-mint)' : 'var(--color-text-dim)',
                            }}
                          >
                            {isLesson2Done ? 'Пройден ✓' : 'Бесплатный практический урок'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Шаг 3 */}
                    <div
                      className="flex items-center justify-between rounded-2xl p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                      style={{
                        background: 'color-mix(in srgb, var(--brand-coral) 12%, var(--color-surface-2))',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold text-[var(--brand-coral)]"
                          style={{
                            background: 'color-mix(in srgb, var(--brand-coral) 20%, transparent)',
                          }}
                        >
                          <Lock size={13} />
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-[var(--color-text)]">
                            Курс Pocket DJ + Open Deck Camp
                          </div>
                          <div className="text-[11px] font-semibold text-[var(--brand-coral)]">
                            Мгновенная активация VIP Pass
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </>
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
