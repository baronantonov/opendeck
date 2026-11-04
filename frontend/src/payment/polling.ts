import { apiLessons } from '../api/client';
import { haptic } from '../lib/theme';

export function pollPaid(courseId: string, reload: () => Promise<void>) {
  let tries = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let done = false;

  const checkStatus = async () => {
    if (done) return;
    tries++;
    if (tries > 60) {
      cleanup();
      return;
    }
    try {
      const data = await apiLessons(courseId);
      if (data?.paid) {
        done = true;
        cleanup();
        haptic('success');
        void reload();
      }
    } catch {
      /* ignore */
    }
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void checkStatus();
    }
  };

  const cleanup = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  timer = setInterval(checkStatus, 2000);
}
