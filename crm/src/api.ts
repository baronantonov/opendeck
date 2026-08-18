import type {
  Stats, StudentsResp, StudentDetail, TestAccount, StudentStatus,
} from './types';

// Legacy crm.html used relative paths (same-origin). Keep that so the CRM works
// from any host that serves it (serveo, ngrok, etc.). No absolute API_BASE.
async function api<T = any>(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
}

export async function getStats(): Promise<Stats | null> {
  const r = await api('/api/crm/stats');
  return r.ok ? r.json() : null;
}

export async function login(key: string): Promise<boolean> {
  const r = await api('/crm/login', {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
  return r.ok;
}

export async function logout(): Promise<void> {
  await api('/crm/logout', { method: 'POST' });
}

export interface StudentQuery {
  q?: string; status?: string; sort?: string; order?: string;
  page?: number; per_page?: number;
}

export async function getStudents(q: StudentQuery): Promise<StudentsResp | null> {
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.status && q.status !== 'all') p.set('status', q.status);
  if (q.sort) p.set('sort', q.sort);
  if (q.order) p.set('order', q.order);
  if (q.page) p.set('page', String(q.page));
  if (q.per_page) p.set('per_page', String(q.per_page));
  const r = await api('/api/crm/students?' + p.toString());
  if (r.status === 401) return null;
  return r.ok ? r.json() : null;
}

export async function getStudent(id: number): Promise<StudentDetail | null> {
  const r = await api('/api/crm/student/' + id);
  if (r.status === 401) return null;
  return r.ok ? r.json() : null;
}

export async function setGp(id: number, amount: number, mode: 'set' | 'add' | 'sub'): Promise<any> {
  const r = await api(`/api/crm/student/${id}/gp`, {
    method: 'POST',
    body: JSON.stringify({ amount, mode }),
  });
  if (r.status === 401) return null;
  return r.ok ? r.json() : null;
}

export async function setLesson(id: number, courseId: string, lessonId: number, completed: boolean): Promise<boolean> {
  const r = await api(`/api/crm/student/${id}/lesson`, {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId, lesson_id: lessonId, completed }),
  });
  if (r.status === 401) return false;
  return r.ok;
}

export async function deleteStudent(id: number): Promise<boolean> {
  const r = await api(`/api/crm/student/${id}?confirm=1`, { method: 'DELETE' });
  if (r.status === 401) return false;
  return r.ok;
}

export async function resetFree(id: number): Promise<boolean> {
  const r = await api(`/api/crm/student/${id}/reset-free`, { method: 'POST' });
  if (r.status === 401) return false;
  return r.ok;
}

export async function getTestAccounts(): Promise<TestAccount[]> {
  const r = await api('/api/crm/test-accounts');
  if (!r.ok) return [];
  const j = await r.json();
  return j.accounts || [];
}

export async function deleteTestAccounts(): Promise<number | null> {
  const r = await api('/api/crm/test-accounts/delete', {
    method: 'POST',
    body: JSON.stringify({ confirm: true }),
  });
  if (r.status === 401) return null;
  if (!r.ok) return null;
  const j = await r.json();
  return j.deleted ?? 0;
}
