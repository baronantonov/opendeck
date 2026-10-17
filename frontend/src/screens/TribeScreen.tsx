import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { getTelegramWebApp } from '../types';
import { haptic } from '../lib/theme';
import { Button, Card } from '../components/ui';
import { useStarsCheckout } from '../payment/Paywall';
import {
  StaggerContainer,
  StaggerItem,
  GlowCard,
} from '../components/MotionWrappers';
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

const TRIBE_INVITE_LINK = 'https://t.me/+S9cLCiFHbWQzY2Iy';
const CONFETTI_SHOWN_KEY = 'opendeck_tribe_confetti_shown';

/**
 * Брендовые цвета конфетти Open Deck:
 * Mint (#8ce2c8), Dawn Coral (#f5926e), Mauve (#c0a0a8), Gold (#f3c969), White (#ffffff)
 */
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

/**
 * Автономный легковесный Canvas-компонент салюта конфетти без внешних зависимостей.
 * Самостоятельно очищает canvas, запускает 60fps анимацию на 3.8с и завершается.
 */
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

    // Генерируем залп конфетти (100 частиц) из двух нижних углов и центра
    const particles: ConfettiParticle[] = [];
    const count = 100;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
      const side = i % 3; // 0 = слева снизу, 1 = справа снизу, 2 = из центра
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
        p.vy += 0.32; // Гравитация
        p.vx *= 0.982; // Аэродинамическое сопротивление
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
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

export function TribeScreen() {
  const navigate = useNavigate();
  const { course, isPaid, adminMode } = useApp();
  const { checkoutCourse, busy: checkoutBusy } = useStarsCheckout();
  const [showConfetti, setShowConfetti] = useState(false);

  // Доступ в Племя открывается мгновенно при оплате курса (или в режиме админа)
  const hasAccess = isPaid || adminMode;
  const isLesson1Done = course.completedLessons.includes(1);
  const isLesson2Done = course.completedLessons.includes(2);

  // Однократный запуск конфетти при первом входе после получения доступа
  useEffect(() => {
    if (!hasAccess) return;

    const localFlag = localStorage.getItem(CONFETTI_SHOWN_KEY);
    if (localFlag === 'true') {
      return;
    }

    const tg = getTelegramWebApp();

    const triggerConfettiSuccess = () => {
      // Сохраняем флаг локально и в Telegram CloudStorage
      localStorage.setItem(CONFETTI_SHOWN_KEY, 'true');
      try {
        tg?.CloudStorage?.setItem?.(CONFETTI_SHOWN_KEY, 'true');
      } catch {
        /* игнорируем ошибку хранилища */
      }

      // Тактильный победный отклик
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

  // Обработчик входа в закрытый Telegram-кэмп
  const handleJoinCamp = () => {
    const tg = getTelegramWebApp();
    try {
      if (tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred('success');
      } else {
        haptic('medium');
      }
    } catch {
      /* fallback */
    }

    try {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(TRIBE_INVITE_LINK);
        return;
      }
    } catch {
      /* fallback */
    }

    window.open(TRIBE_INVITE_LINK, '_blank', 'noopener,noreferrer');
  };

  const handleGoToLearn = () => {
    haptic('medium');
    navigate('/learn');
  };

  return (
    <div style={{ padding: '16px 16px 28px', minHeight: '100%' }}>
      {showConfetti && <TribeCanvasConfetti onComplete={() => setShowConfetti(false)} />}

      <StaggerContainer stepMs={65}>
        {/* Состояние Б: Доступ в Племя ОТКРЫТ (курс оплачен или adminMode) */}
        {hasAccess ? (
          <>
            {/* 1. Главная карточка с сиянием и бейджем доступа */}
            <StaggerItem index={0}>
              <GlowCard ambientGlow animatedBorder strip>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--brand-mint)',
                      background: 'rgba(140, 226, 200, 0.12)',
                      border: '1px solid rgba(140, 226, 200, 0.28)',
                      padding: '4px 10px',
                      borderRadius: 99,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'var(--brand-mint)',
                        boxShadow: '0 0 8px var(--brand-mint)',
                      }}
                    />
                    Доступ открыт
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: 'var(--color-text-dim)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '4px 10px',
                      borderRadius: 99,
                    }}
                  >
                    <Users size={13} color="var(--brand-mint)" />
                    Open Deck Camp
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      background: 'radial-gradient(circle at 35% 30%, rgba(140, 226, 200, 0.28) 0%, rgba(17, 50, 42, 0.6) 100%)',
                      border: '1px solid rgba(140, 226, 200, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-mint)',
                      boxShadow: '0 0 24px rgba(140, 226, 200, 0.25)',
                      flexShrink: 0,
                    }}
                  >
                    <Unlock size={28} />
                  </div>
                  <div>
                    <h1
                      className="brand-text"
                      style={{
                        fontSize: 22,
                        margin: '0 0 4px',
                        lineHeight: 1.2,
                        color: 'var(--color-text)',
                      }}
                    >
                      ТВОЁ ПЛЕМЯ
                    </h1>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: 'var(--brand-mint)',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Закрытое комьюнити диджеев
                    </p>
                  </div>
                </div>

                {/* Поздравительный текст согласно ТЗ */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    marginBottom: 18,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: 'var(--color-text)',
                      fontWeight: 500,
                    }}
                  >
                    Добро пожаловать в племя! Ты сделал первый шаг, и теперь двери нашего кэмпа открыты для тебя. Здесь нет 'глупых' вопросов, только поддержка и общая любовь к музыке. Заходи, мы тебя ждем!
                  </p>
                </div>

                {/* Крупная акцентная брендовая кнопка [ Войти в Camp ] */}
                <Button
                  variant="mint"
                  block
                  onClick={handleJoinCamp}
                  style={{
                    padding: '15px 20px',
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    boxShadow: '0 8px 24px -6px rgba(140, 226, 200, 0.55)',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={18} />
                  <span>Войти в Camp</span>
                  <ExternalLink size={18} />
                </Button>
              </GlowCard>
            </StaggerItem>

            {/* 2. Карточка преимуществ закрытого чата */}
            <StaggerItem index={1}>
              <Card style={{ marginTop: 14, background: 'var(--color-surface)' }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: '0 0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Flame size={16} color="var(--brand-coral)" />
                  Что ждет тебя внутри кэмпа
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '10px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(140, 226, 200, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-mint)',
                        flexShrink: 0,
                      }}
                    >
                      <MessageCircle size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        Закрытый чат единомышленников
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Общение с такими же увлеченными студентами и выпускниками школы.
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '10px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(245, 146, 110, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-coral)',
                        flexShrink: 0,
                      }}
                    >
                      <HelpCircle size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        Ответы на любые вопросы
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Разбор трудностей по урокам Pocket DJ, технике сведения и софту.
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '10px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(192, 160, 168, 0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-mauve)',
                        flexShrink: 0,
                      }}
                    >
                      <Headphones size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        Фидбек по твоим первым миксам
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        Делись записями своих сетов и получай конструктивную обратную связь.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          </>
        ) : (
          /* Состояние А: Урок 2 НЕ пройден — Заглушка закрытого клуба */
          <>
            {/* 1. Главный баннер с иконкой замка и закрытым статусом */}
            <StaggerItem index={0}>
              <GlowCard ambientGlow strip>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--brand-coral)',
                      background: 'rgba(245, 146, 110, 0.12)',
                      border: '1px solid rgba(245, 146, 110, 0.28)',
                      padding: '4px 10px',
                      borderRadius: 99,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <Lock size={12} />
                    Доступ закрыт
                  </span>

                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-dim)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '4px 10px',
                      borderRadius: 99,
                    }}
                  >
                    Требуется Pocket DJ
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      background: 'radial-gradient(circle at 35% 30%, rgba(245, 146, 110, 0.24) 0%, rgba(36, 20, 16, 0.7) 100%)',
                      border: '1px solid rgba(245, 146, 110, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-coral)',
                      boxShadow: '0 0 24px rgba(245, 146, 110, 0.2)',
                      flexShrink: 0,
                    }}
                  >
                    <Lock size={26} />
                  </div>
                  <div>
                    <h1
                      className="brand-text"
                      style={{
                        fontSize: 22,
                        margin: '0 0 4px',
                        lineHeight: 1.2,
                        color: 'var(--color-text)',
                      }}
                    >
                      ЗАКРЫТЫЙ DJ CAMP
                    </h1>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: 'var(--color-text-dim)',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Твой билет в сообщество
                    </p>
                  </div>
                </div>

                {/* Интригующий продающий текст */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.28)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: 'var(--color-text)',
                      fontWeight: 500,
                    }}
                  >
                    Твой пропуск в наш закрытый 'Open Deck DJ camp' ждет тебя. Доступ к комьюнити открывается мгновенно при оплате курса Pocket DJ. Внутри — закрытый чат студентов, разборы миксов и поддержка кураторов.
                  </p>
                </div>

                {/* Кнопка покупки курса */}
                <Button
                  variant="gradient"
                  block
                  disabled={checkoutBusy}
                  onClick={() => {
                    haptic('medium');
                    void checkoutCourse('dj-basics');
                  }}
                  style={{
                    padding: '14px 18px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Sparkles size={18} />
                  <span>{checkoutBusy ? 'Открываем Telegram Stars...' : 'Открыть Pocket DJ · 2 500 Stars'}</span>
                </Button>

                {/* Вторичная кнопка «Бесплатные уроки курса» */}
                <Button
                  variant="secondary"
                  block
                  onClick={handleGoToLearn}
                  style={{
                    marginTop: 8,
                    padding: '12px 18px',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  <span>Бесплатные вводные уроки</span>
                  <ArrowRight size={16} />
                </Button>
              </GlowCard>
            </StaggerItem>

            {/* 2. Индикатор прогресса шагов до открытия Племени */}
            <StaggerItem index={1}>
              <Card style={{ marginTop: 14, background: 'var(--color-surface)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                    Допуск в закрытый Camp
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--brand-gold)', fontWeight: 700 }}>
                    Покупка курса
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {/* Шаг 1 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: isLesson1Done ? 'rgba(140, 226, 200, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 12,
                      border: isLesson1Done
                        ? '1px solid rgba(140, 226, 200, 0.2)'
                        : '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: isLesson1Done ? 'var(--brand-mint)' : 'rgba(255, 255, 255, 0.08)',
                          color: isLesson1Done ? '#11322a' : 'var(--color-text-dim)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {isLesson1Done ? <CheckCircle2 size={16} /> : '1'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                          Урок 1: Первый контроллер
                        </div>
                        <div style={{ fontSize: 11, color: isLesson1Done ? 'var(--brand-mint)' : 'var(--color-text-dim)' }}>
                          {isLesson1Done ? 'Пройден ✓' : 'Бесплатный вводный урок'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Шаг 2 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: isLesson2Done ? 'rgba(140, 226, 200, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 12,
                      border: isLesson2Done
                        ? '1px solid rgba(140, 226, 200, 0.2)'
                        : '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: isLesson2Done ? 'var(--brand-mint)' : 'rgba(255, 255, 255, 0.08)',
                          color: isLesson2Done ? '#11322a' : 'var(--color-text-dim)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {isLesson2Done ? <CheckCircle2 size={16} /> : '2'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                          Урок 2: Знакомство с FREEDA
                        </div>
                        <div style={{ fontSize: 11, color: isLesson2Done ? 'var(--brand-mint)' : 'var(--color-text-dim)' }}>
                          {isLesson2Done ? 'Пройден ✓' : 'Бесплатный практический урок'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Шаг 3 (Ключевой) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'rgba(245, 146, 110, 0.08)',
                      borderRadius: 12,
                      border: '1px solid rgba(245, 146, 110, 0.28)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(245, 146, 110, 0.2)',
                          color: 'var(--brand-coral)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        <Lock size={13} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                          Курс Pocket DJ + Open Deck Camp
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--brand-coral)', fontWeight: 600 }}>
                          Ключ к разблокировке Племени 🔑
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          </>
        )}
      </StaggerContainer>
    </div>
  );
}
