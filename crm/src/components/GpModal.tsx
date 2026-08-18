import { useState } from 'react';
import { setGp } from '../api';
import { Modal, Button } from './ui';

export function GpModal({
  uid, name, current, onClose, onSaved,
}: { uid: number; name: string; current: number; onClose: () => void; onSaved: (gp: number) => void }) {
  const [mode, setMode] = useState<'set' | 'add' | 'sub'>('set');
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt < 0) { setErr('Введите неотрицательное число'); return; }
    setBusy(true); setErr('');
    const j = await setGp(uid, amt, mode);
    setBusy(false);
    if (j == null) { setErr('Сетевая ошибка'); return; }
    onSaved(j.groove_points);
    onClose();
  }

  return (
    <Modal open onClose={onClose} width={400}>
      <div style={{ padding: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 750, marginBottom: 4 }}>Счёт GP</h2>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>{name} · сейчас: {current} ⭐</div>
        <div style={{ display: 'inline-flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 3, gap: 2, marginBottom: 12 }}>
          {(['set', 'add', 'sub'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ border: 0, background: mode === m ? 'linear-gradient(135deg,var(--color-accent),var(--color-accent-2))' : 'transparent', color: mode === m ? '#1d1f1e' : 'var(--color-muted)', padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {m === 'set' ? 'Установить' : m === 'add' ? 'Начислить' : 'Списать'}
            </button>
          ))}
        </div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" autoFocus placeholder="0" style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', outline: 'none', color: 'var(--color-text)', fontSize: 16 }} />
        {err && <div style={{ color: 'var(--color-bad)', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <Button block variant="primary" style={{ marginTop: 16 }} disabled={busy} onClick={save}>{busy ? '…' : 'Сохранить'}</Button>
      </div>
    </Modal>
  );
}

export function ConfirmModal({
  open, title, text, onOk, onCancel,
}: { open: boolean; title: string; text: string; onOk: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} width={400}>
      <div style={{ padding: 22 }}>
        <h2 style={{ fontSize: 17, fontWeight: 750, marginBottom: 8 }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: 16 }}>{text}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" block onClick={onCancel}>Отмена</Button>
          <Button variant="danger" block onClick={onOk}>Да</Button>
        </div>
      </div>
    </Modal>
  );
}
