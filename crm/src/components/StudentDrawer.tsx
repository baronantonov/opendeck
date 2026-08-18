import { useEffect, useState } from 'react';
import type { StudentDetail } from '../types';
import { getStudent, setLesson } from '../api';
import { initials, fmtDate, fmtDateTime, esc } from '../lib';
import { Button } from './ui';

export function StudentDrawer({
  id, onClose, onGp, onReset, onDelete, onChange,
}: {
  id: number;
  onClose: () => void;
  onGp: (uid: number, gp: number) => void;
  onReset: (uid: number) => void;
  onDelete: (uid: number) => void;
  onChange: () => void;
}) {
  const [s, setS] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getStudent(id).then((d) => {
      if (!alive) return;
      setS(d);
      setLoading(false);
      if (!d) onClose();
    });
    return () => { alive = false; };
  }, [id]);

  async function toggleLesson(course: string, lesson: number, checked: boolean, cb: HTMLInputElement) {
    cb.disabled = true;
    const ok = await setLesson(id, course, lesson, checked);
    cb.disabled = false;
    if (!ok) cb.checked = !checked;
    else onChange();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(460px,100%)', background: 'var(--color-bg)', borderLeft: '1px solid var(--color-border)', transform: 'translateX(0)', transition: '.32s', display: 'flex', flexDirection: 'column', boxShadow: '-30px 0 60px -30px rgba(0,0,0,.7)' }}>
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          {s?.user.photo_url
            ? <img src={s.user.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover' }} />
            : <div className="brand-gradient-bg" style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 19 }}>{initials(s?.user.first_name)}</div>}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 750, fontSize: 18 }}>{s?.user.first_name || 'Без имени'}</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>{(s?.user.username ? '@' + s.user.username : 'id ' + id)} · {s?.user.archetype || ''}</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 20 }} onClick={onClose}>✕</span>
        </div>
        <div style={{ padding: '20px 22px 40px', overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>⏳ Загрузка профиля…</div>}
          {s && s.error && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>Профиль не найден</div>}
          {s && !s.error && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <KV k="GP баланс" v={<span style={{ color: 'var(--color-warn)' }}>{s.gp.toLocaleString('ru-RU')}</span>} />
                <KV k="Статус" v={s.paid_mentor ? 'VIP · менторинг' : s.paid_full ? 'Прошёл полный курс' : s.paid_tripwire ? 'Трипвайр' : 'Бесплатный'} />
                <KV k="Рефералов" v={String(s.referrals_count)} />
                <KV k="Реф-код" v={<span style={{ fontSize: 12 }}>{esc(s.user.referral_code) || '—'}</span>} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <Button variant="warn" style={{ flex: 1 }} onClick={() => onGp(id, s.gp)}>⭐ Счёт</Button>
                <Button variant="ghost" style={{ flex: 1 }} onClick={() => onReset(id)}>🔓 В бесплатный</Button>
                <Button variant="danger" onClick={() => onDelete(id)}>🗑</Button>
              </div>
              {s.lessons && s.lessons.length > 0 && (
                <>
                  <Section title="📚 Прогресс уроков" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                    {s.lessons.slice().sort((a, b) => (a.course_id === b.course_id ? a.lesson_id - b.lesson_id : a.course_id < b.course_id ? -1 : 1)).map((l, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
                        <input type="checkbox" defaultChecked={l.completed} onChange={(e) => toggleLesson(l.course_id, l.lesson_id, e.target.checked, e.target)} style={{ accentColor: 'var(--color-accent)', width: 17, height: 17 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', background: 'var(--color-surface-2)', padding: '2px 7px', borderRadius: 6 }}>{esc(l.course_id)}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>ур. {l.lesson_id}</span>
                        {l.gp_earned ? <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-warn)', fontWeight: 650 }}>+{l.gp_earned}★</span> : null}
                      </label>
                    ))}
                  </div>
                </>
              )}
              <Section title="💳 Платежи" />
              {s.payments && s.payments.length ? s.payments.map((p, i) => (
                <Row key={i} title={esc(p.course_id)} sub={`${esc(p.provider || '')} · ${fmtDateTime(p.created_at)}`} amount={p.status === 'paid' ? `✓ ${p.amount ? p.amount + '★' : ''}` : '·'} pos={p.status === 'paid'} />
              )) : <Empty>Платежей нет</Empty>}
              <Section title="🤝 Приглашённые" />
              {s.referrals && s.referrals.length ? s.referrals.map((rf, i) => (
                <Row key={i} title={esc(rf.first_name || 'Без имени')} sub={rf.username ? '@' + esc(rf.username) : 'id ' + rf.user_id} amount={rf.groove_points ? rf.groove_points + '★' : ''} />
              )) : <Empty>Никого не пригласил</Empty>}
              <Section title="📈 История GP" />
              {s.transactions && s.transactions.length ? s.transactions.slice(0, 40).map((t, i) => (
                <Row key={i} title={esc(t.action_type)} sub={fmtDateTime(t.timestamp)} amount={`${t.amount < 0 ? '' : '+'}${t.amount}`} pos={t.amount >= 0} neg={t.amount < 0} />
              )) : <Empty>Нет движений</Empty>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '11px 13px' }}><div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k}</div><div style={{ fontSize: 15, fontWeight: 650, marginTop: 2 }}>{v}</div></div>;
}
function Section({ title }: { title: string }) {
  return <div style={{ fontWeight: 700, fontSize: 14, marginTop: 16, marginBottom: 8 }}>{title}</div>;
}
function Row({ title, sub, amount, pos, neg }: { title: string; sub: string; amount: string; pos?: boolean; neg?: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{sub}</div>
    </div>
    <div style={{ fontWeight: 700, color: pos ? 'var(--color-good)' : neg ? 'var(--color-bad)' : undefined }}>{amount}</div>
  </div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--color-faint)', fontSize: 12.5, padding: '4px 0' }}>{children}</div>;
}
