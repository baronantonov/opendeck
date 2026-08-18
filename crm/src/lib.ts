export function esc(s: any): string {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c),
  );
}

export function initials(name?: string): string {
  const p = (name || '?').trim().split(/\s+/);
  return (((p[0] || '')[0] || '?').toUpperCase() + ((p[1] || '')[0] || ''));
}

export function fmtDate(s?: string): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d as any)) return s;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(s?: string): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d as any)) return s;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function statusBadge(s: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    free: { cls: 'free', label: 'Бесплатный' },
    paid: { cls: 'paid', label: 'Платный' },
    vip: { cls: 'vip', label: 'VIP' },
  };
  return map[s] || map.free;
}
