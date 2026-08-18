import type { StudentRow } from '../types';
import { initials, fmtDate, statusBadge } from '../lib';

export function StudentsTable({
  rows, onOpen, onDelete, onEditGp,
}: {
  rows: StudentRow[];
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onEditGp: (id: number, gp: number) => void;
}) {
  if (!rows.length) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>🪐<div style={{ marginTop: 10 }}>Никого не найдено</div></div>;
  }
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 18, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-faint)', fontWeight: 700 }}>
            <th style={th}>Ученик</th>
            <th style={th}>Статус</th>
            <th style={th}>GP</th>
            <th style={th}>Уроки</th>
            <th style={th}>Рефералы</th>
            <th style={th}>Бонусы</th>
            <th style={th}>Заходил</th>
            <th style={th}>Регистрация</th>
            <th style={{ ...th, textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const badge = statusBadge(u.status);
            return (
              <tr key={u.user_id} onClick={() => onOpen(u.user_id)} style={{ borderTop: '1px solid var(--color-border)', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {u.photo_url
                      ? <img src={u.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover' }} />
                      : <div className="brand-gradient-bg" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>{initials(u.first_name)}</div>}
                    <div>
                      <div style={{ fontWeight: 650 }}>{u.first_name || 'Без имени'}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{u.username ? '@' + u.username : 'id ' + u.user_id}</div>
                    </div>
                  </div>
                </td>
                <td style={td}><span style={badgeStyle(badge.cls)}>{badge.label}</span></td>
                <td style={td}><span onClick={(e) => { e.stopPropagation(); onEditGp(u.user_id, u.groove_points); }} style={{ color: 'var(--color-warn)', fontWeight: 650, cursor: 'pointer' }}>{u.groove_points.toLocaleString('ru-RU')}</span></td>
                <td style={td}>{u.lessons_done}</td>
                <td style={td}>{u.refers_count}</td>
                <td style={td}>{u.bonus_unlocked > 0 ? <span style={badgeStyle('paid')}>{u.bonus_done}/{u.bonus_unlocked}</span> : <span style={{ color: 'var(--color-faint)' }}>закрыты</span>}</td>
                <td style={{ ...td, color: 'var(--color-faint)' }}>{fmtDate(u.last_seen)}</td>
                <td style={{ ...td, color: 'var(--color-faint)' }}>{fmtDate(u.created_at)}</td>
                <td style={{ ...td, textAlign: 'right' }} onClick={(e) => { e.stopPropagation(); onDelete(u.user_id); }}>
                  <span style={{ cursor: 'pointer', color: 'var(--color-bad)', border: '1px solid rgba(251,113,133,.3)', borderRadius: 9, padding: '6px 9px', fontSize: 15, display: 'inline-block' }}>🗑</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '13px 16px', fontSize: 14, verticalAlign: 'middle' };

function badgeStyle(cls: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    free: { color: 'var(--color-muted)', background: 'var(--color-surface)' },
    paid: { color: 'var(--color-accent-2)', background: 'rgba(140,226,200,.10)', borderColor: 'rgba(140,226,200,.3)' },
    vip: { color: 'var(--color-vip)', background: 'rgba(240,171,252,.10)', borderColor: 'rgba(240,171,252,.32)' },
  };
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 650, border: '1px solid var(--color-border)' };
  return { ...base, ...(map[cls] || map.free) };
}
