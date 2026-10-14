import confetti from 'canvas-confetti';

export const triggerCelebrationConfetti = () => {
  // Neo-Mint, Dawn Coral, Mist Pink, Gold
  const colors = ['#8ce2c8', '#f5926e', '#c0a0a8', '#ffd700'];

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: colors,
    ticks: 200,
    gravity: 1.2,
    scalar: 1.1,
  });

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
    });
  }, 200);
};
