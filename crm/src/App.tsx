import { useEffect, useState } from 'react';
import type { Stats, StudentRow, TestAccount } from './types';
import {
  getStats, getStudents, deleteStudent, resetFree, getTestAccounts, deleteTestAccounts,
} from './api';
import { Login } from './components/Login';
import { StatsBar } from './components/StatsBar';
import { StudentsTable } from './components/StudentsTable';
import { StudentDrawer } from './components/StudentDrawer';
import { GpModal, ConfirmModal } from './components/GpModal';
import { Toast } from './components/ui';

interface Filters {
  q: string; status: string; sort: string; order: string; page: number; per_page: number; total: number;
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: '', status: 'all', sort: 'created', order: 'desc', page: 1, per_page: 25, total: 0 });
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [openId, setOpenId] = useState<number | null>(null);
  const [gpTarget, setGpTarget] = useState<{ uid: number; gp: number } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; text: string; cb: () => void } | null>(null);
  const [tests, setTests] = useState<TestAccount[]>([]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const loadStats = async () => { const s = await getStats(); setStats(s); };
  const loadStudents = async () => {
    const r = await getStudents(filters);
    if (r == null) { setAuthed(false); return; }
    setRows(r.students); setFilters((f) => ({ ...f, total: r.total }));
    setLoaded(true);
  };

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    if (!authed) return;
    loadStats(); loadStudents(); loadTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.status, filters.sort, filters.order, filters.page]);

  const loadTests = async () => { const a = await getTestAccounts(); setTests(a); };

  async function doDelete(uid: number) {
    const ok = await deleteStudent(uid);
    if (ok) { showToast('Ученик удалён'); setOpenId(null); loadStudents(); loadStats(); }
    else showToast('Не удалось удалить');
  }
  async function doReset(uid: number) {
    const ok = await resetFree(uid);
    if (ok) { showToast('Сброшено в бесплатный ✅'); setOpenId(null); loadStudents(); loadStats(); }
    else showToast('Не удалось сбросить');
  }
  async function doDeleteTests() {
    const n = await deleteTestAccounts();
    if (n != null) { showToast(`Удалено тестовых: ${n}`); loadStudents(); loadTests(); }
    setConfirm(null);
  }

  function setFilter(p: Partial<Filters>) { setFilters((f) => ({ ...f, page: 1, ...p })); }

  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  const pages = Math.max(1, Math.ceil(filters.total / filters.per_page));
  const win: number[] = [];
  for (let i = Math.max(1, filters.page - 2); i <= Math.min(pages, filters.page + 2); i++) win.push(i);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 30, padding: '12px 0 16px', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div className="brand-gradient-bg" style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff' }}>OD</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Open Deck · <span className="brand-text" style={{ fontWeight: 800 }}>CRM</span></div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>панель администратора</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 16 }}>{theme === 'dark' ? '🌙' : '☀️'}</button>
        <button onClick={() => { setAuthed(false); }} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Выйти</button>
      </div>

      <StatsBar s={stats} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input value={filters.q} onChange={(e) => setFilter({ q: e.target.value })} placeholder="Поиск по имени, @юзеру, id…" style={{ flex: '1 1 260px', minWidth: 220, padding: '11px 14px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', outline: 'none', color: 'var(--color-text)' }} />
        <div style={{ display: 'inline-flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 3, gap: 2 }}>
          {[['all', 'Все'], ['free', 'Бесплатные'], ['paid', 'Платные'], ['vip', 'VIP']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter({ status: v })} style={{ border: 0, background: filters.status === v ? 'linear-gradient(135deg,var(--color-accent),var(--color-accent-2))' : 'transparent', color: filters.status === v ? '#1d1f1e' : 'var(--color-muted)', padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{l}</button>
          ))}
        </div>
        <select value={`${filters.sort}:${filters.order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); setFilter({ sort: s, order: o || 'desc' }); }} style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', outline: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <option value="created:desc">Сначала новые</option>
          <option value="created:asc">Сначала старые</option>
          <option value="gp:desc">GP ↓</option>
          <option value="first_name:asc">Имя А-Я</option>
          <option value="last_seen:desc">Заходил недавно</option>
        </select>
      </div>

      {!loaded
        ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>Загрузка…</div>
        : <StudentsTable rows={rows} onOpen={(id) => setOpenId(id)} onDelete={(id) => setConfirm({ title: 'Удалить ученика?', text: `ID ${id} будет удалён вместе с платежами, уроками и GP. Необратимо.`, cb: () => doDelete(id) })} onEditGp={(uid, gp) => setGpTarget({ uid, gp })} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Всего: <b>{filters.total.toLocaleString('ru-RU')}</b> · стр. {filters.page} из {pages}</span>
        <div style={{ flex: 1 }} />
        <button disabled={filters.page <= 1} onClick={() => setFilter({ page: filters.page - 1 })} style={pgBtn(filters.page <= 1)}>‹</button>
        {win.map((p) => <button key={p} onClick={() => setFilter({ page: p })} style={pgBtn(false, p === filters.page)}>{p}</button>)}
        <button disabled={filters.page >= pages} onClick={() => setFilter({ page: filters.page + 1 })} style={pgBtn(filters.page >= pages)}>›</button>
      </div>

      {tests.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>🧪 Тестовые аккаунты</span>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Найдено: {tests.length}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setConfirm({ title: 'Удалить все тестовые аккаунты?', text: 'Будут каскадно удалены все аккаунты с именами Tester / E2E / Adhoc / Live* и username tester. Необратимо.', cb: doDeleteTests })} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(251,113,133,.3)', background: 'rgba(251,113,133,.12)', color: 'var(--color-bad)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Удалить все</button>
          </div>
          {tests.map((t) => <div key={t.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 20 }}>🧪</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t.first_name || 'Без имени'}</div><div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{t.username ? '@' + t.username : 'id ' + t.user_id} · {t.groove_points} ⭐</div></div>
          </div>)}
        </div>
      )}

      {openId != null && <StudentDrawer id={openId} onClose={() => setOpenId(null)} onGp={(uid, gp) => setGpTarget({ uid, gp })} onReset={(uid) => setConfirm({ title: 'Сбросить в бесплатный?', text: `Станет бесплатным: удаляются все платежи. GP и прогресс уроков сохраняются.`, cb: () => doReset(uid) })} onDelete={(uid) => setConfirm({ title: 'Удалить ученика?', text: `ID ${uid} будет удалён вместе с платежами, уроками и GP. Необратимо.`, cb: () => doDelete(uid) })} onChange={() => { loadStudents(); loadStats(); }} />}

      {gpTarget && <GpModal uid={gpTarget.uid} name={`id ${gpTarget.uid}`} current={gpTarget.gp} onClose={() => setGpTarget(null)} onSaved={() => { loadStudents(); loadStats(); setGpTarget(null); }} />}

      {confirm && <ConfirmModal open title={confirm.title} text={confirm.text} onOk={confirm.cb} onCancel={() => setConfirm(null)} />}

      <Toast msg={toast} />
    </div>
  );
}

function pgBtn(disabled: boolean, active = false): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 10, border: '1px solid var(--color-border)', background: active ? 'var(--color-accent)' : 'var(--color-surface)', color: active ? '#1d1f1e' : 'var(--color-text)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .4 : 1,
  };
}
