import { useEffect, useRef } from 'react';

export const CONFETTI_SHOWN_KEY = 'opendeck_tribe_confetti_shown';
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

export function TribeCanvasConfetti({ onComplete }: { onComplete?: () => void }) {
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
