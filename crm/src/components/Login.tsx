import React, { useState } from 'react';
import { Button } from './ui';
import { login } from '../api';

export function Login({ onOk }: { onOk: () => void }) {
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const ok = await login(key);
      if (ok) onOk();
      else setErr('Неверный пароль');
    } catch {
      setErr('Сетевая ошибка');
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form onSubmit={submit} style={{ width: 'min(380px,100%)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 28, boxShadow: '0 30px 60px -30px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div className="brand-gradient-bg" style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff' }}>OD</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Open Deck</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>CRM · панель админа</div>
          </div>
        </div>
        <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>Пароль доступа</label>
        <input
          value={key} onChange={(e) => setKey(e.target.value)} type="password" autoFocus
          style={{ width: '100%', marginTop: 8, padding: '11px 14px', borderRadius: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', outline: 'none', color: 'var(--color-text)' }}
        />
        {err && <div style={{ color: 'var(--color-bad)', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <Button block variant="primary" style={{ marginTop: 16 }} disabled={busy} type="submit">
          {busy ? '…' : 'Войти'}
        </Button>
      </form>
    </div>
  );
}
