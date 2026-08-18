import type { Stats } from '../types';

function Pill({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div style={{ flex: '1 1 130px', minWidth: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '10px 13px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 750, marginTop: 2, color: cls ? `var(--color-${cls})` : undefined }}>{value}{sub && <small style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, display: 'block', marginTop: 1 }}>{sub}</small>}</div>
    </div>
  );
}

export function StatsBar({ s }: { s: Stats | null }) {
  if (!s) return null;
  const gp = s.total_gp >= 1000 ? (s.total_gp / 1000).toFixed(0) + 'K' : String(s.total_gp);
  const items = [
    { label: 'Учеников', value: String(s.total_users), sub: `актив 24ч: ${s.active_today}` },
    { label: 'Новые 7д', value: String(s.new_week), cls: 'accent' },
    { label: 'Актив 24ч', value: String(s.active_today) },
    { label: 'Платные', value: String(s.paid_any), cls: 'good', sub: `полн ${s.paid_full} · триал ${s.paid_tripwire}` },
    { label: 'VIP', value: String(s.paid_mentor), cls: 'vip' },
    { label: 'Выручка ★', value: (s.revenue_stars || 0).toLocaleString('ru-RU'), cls: 'good' },
    { label: 'Рефералов', value: String(s.referrals_total), cls: 'accent' },
    { label: 'GP в обороте', value: gp },
  ];
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '4px 0 18px' }}>
      {items.map((it, i) => <Pill key={i} {...it} />)}
    </div>
  );
}
