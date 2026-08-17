import type {
  InitResponse,
  LessonsResponse,
  InvoiceResponse,
} from '../types';

// API_BASE: in prod this is the public HTTPS backend. The legacy ngrok tunnel in
// the old index.html must NOT be used. Override via VITE_API_BASE at build time.
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://opendeck-tma.serveousercontent.com';

// The single source of init data. We read it once from the Telegram WebApp
// bridge (loaded via the script tag in index.html) and reuse everywhere.
// NEVER trust client-sent user data; the backend validates this server-side.
function getInitData(): string {
  try {
    const tg = (window as any).Telegram?.WebApp;
    return tg?.initData || '';
  } catch {
    return '';
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Init-Data': getInitData(),
    ...extra,
  };
}

export async function apiInit(
  startParam: string | null,
): Promise<InitResponse | null> {
  const r = await fetch(`${API_BASE}/api/init`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ init_data: getInitData(), start_param: startParam }),
  });
  return r.ok ? r.json() : null;
}

export async function apiProfile() {
  const r = await fetch(`${API_BASE}/api/profile`, { headers: headers() });
  return r.ok ? r.json() : null;
}

export async function apiLessons(
  courseId: string,
): Promise<LessonsResponse | null> {
  const r = await fetch(
    `${API_BASE}/api/lessons?course_id=${encodeURIComponent(courseId)}`,
    { headers: headers() },
  );
  return r.ok ? r.json() : null;
}

export async function apiLessonsBonus() {
  const r = await fetch(`${API_BASE}/api/lessons-bonus`, { headers: headers() });
  return r.ok ? r.json() : null;
}

export async function apiProgress(courseId: string, lessonId: number) {
  const r = await fetch(`${API_BASE}/api/progress`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ course_id: courseId, lesson_id: lessonId }),
  });
  return r.ok ? r.json() : null;
}

export async function apiGpSpend(amount: number, reason: string) {
  const r = await fetch(`${API_BASE}/api/gp/spend`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ amount, reason }),
  });
  return r.ok ? r.json() : null;
}

export async function apiGpEarn(action: string) {
  const r = await fetch(`${API_BASE}/api/gp/earn`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ action }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return { _err: j.error || 'error' };
  }
  return r.json();
}

export async function apiArchetypeShare() {
  const r = await fetch(`${API_BASE}/api/archetype/share`, {
    method: 'POST',
    headers: headers(),
  });
  return r.ok ? r.json() : null;
}

export async function apiCreateInvoice(payload: {
  course_id: string;
  price?: number;
  provider?: string;
}): Promise<InvoiceResponse | null> {
  const r = await fetch(`${API_BASE}/api/create-invoice`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return j;
  }
  return r.json();
}
