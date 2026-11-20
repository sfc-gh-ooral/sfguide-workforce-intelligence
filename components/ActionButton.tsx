'use client';

import { ClipboardCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useWorkforce } from '@/lib/workforce-data';
import { liveJson } from '@/lib/mode';
import { PERSONAS } from '@/lib/personas';
import type { ActionRecord } from '@/lib/types';
import { Toast } from './ui';

// Human in the loop: the reader records a decision. Live mode writes it to HR.ACTIONS under the
// persona's role; Sample mode keeps it in this browser.
export const ACTION_TYPES = ['Flag for HRBP review', 'Assign follow-up', 'Escalate to comp review', 'Add note'] as const;
const LS = 'wi-actions';

// Two example entries so the Sample-mode log isn't empty on first visit.
const EXAMPLES: ActionRecord[] = [
  { id: 'example-2', subjectType: 'team', subjectId: 'example', subjectLabel: 'Payment Operations · Charlotte', action: 'Assign follow-up', note: 'Example entry: review shift-pattern options with the Operations leadership team.', persona: 'WI_HRBP_ROLE', createdAt: '2026-10-30 16:05' },
  { id: 'example-1', subjectType: 'pay-cell', subjectId: 'example', subjectLabel: 'Pay equity: Software Engineering · L4', action: 'Escalate to comp review', note: 'Example entry: adjusted gap persists after tenure and rating controls.', persona: 'WI_COMP_ROLE', createdAt: '2026-10-29 11:20' },
];
export function sampleActions(): ActionRecord[] {
  try { return [...JSON.parse(window.localStorage.getItem(LS) ?? '[]'), ...EXAMPLES]; } catch { return EXAMPLES; }
}

export function ActionButton({ subjectType, subjectId, subjectLabel, defaultAction = 'Flag for HRBP review' }: {
  subjectType: string; subjectId: string; subjectLabel: string; defaultAction?: (typeof ACTION_TYPES)[number];
}) {
  const { persona, mode } = useWorkforce();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<string>(defaultAction);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === 'live') {
        await liveJson('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona, subjectType, subjectId, subjectLabel, action, note }) });
      } else {
        const rec: ActionRecord = { id: crypto.randomUUID(), subjectType, subjectId, subjectLabel, action, note, persona: PERSONAS[persona].role, createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ') };
        window.localStorage.setItem(LS, JSON.stringify([rec, ...sampleActions().filter((a) => !a.id.startsWith('example'))].slice(0, 50)));
      }
      setOpen(false); setNote('');
      setToast(mode === 'live' ? 'Recorded in HR.ACTIONS' : 'Saved in this browser (Sample mode)');
      window.setTimeout(() => setToast(null), 3200);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}><ClipboardCheck className="w-4 h-4" aria-hidden />Record a decision</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,10,25,.55)' }} onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="act-title" className="card p-5 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto" style={{ background: 'var(--card-solid)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 id="act-title" className="font-display text-lg font-semibold">Record a decision</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>{subjectLabel}</p>
            <label className="eyebrow block mb-1.5" htmlFor="act-type">Action</label>
            <select id="act-type" className="w-full px-3 py-2 mb-3 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTION_TYPES.map((a) => <option key={a}>{a}</option>)}
            </select>
            <label className="eyebrow block mb-1.5" htmlFor="act-note">Note</label>
            <textarea id="act-note" className="w-full px-3 py-2 text-sm" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="For example: meet the manager this week about the shift pattern." />
            {err && <p className="text-sm mt-2" style={{ color: 'var(--bad)' }}>{err}</p>}
            <div className="flex items-center justify-between gap-3 mt-4">
              <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{mode === 'live' ? `Writes to HR.ACTIONS as ${PERSONAS[persona].role}` : 'Sample mode: saved in this browser'}</span>
              <button className="btn btn-aurora" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      <Toast text={toast} />
    </>
  );
}
