'use client';

import { ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/Shell';
import { sampleActions } from '@/components/ActionButton';
import { Card, LiveError, Powered, Skeleton } from '@/components/ui';
import { useWorkforce } from '@/lib/workforce-data';
import { liveJson } from '@/lib/mode';
import type { ActionRecord } from '@/lib/types';

export default function DecisionsPage() {
  const { persona, mode } = useWorkforce();
  const [rows, setRows] = useState<ActionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!mode) return;
    if (mode === 'sample') { setRows(sampleActions()); return; }
    liveJson<{ actions: ActionRecord[] }>(`/api/actions?persona=${persona}`).then((r) => setRows(r.actions)).catch((e: Error) => setError(e.message));
  }, [mode, persona]);
  return (
    <>
      <PageHeader eyebrow="Decisions log" title={<>People decide. <span className="aurora-text">The record stays.</span></>}>
        Every flag, follow-up, escalation, and note recorded from the other screens, with the role that made it.
      </PageHeader>
      {error && <LiveError message={error} />}
      {!rows && !error && <Skeleton h={240} />}
      {rows && (
        <Card title={`${rows.length} decision${rows.length === 1 ? '' : 's'}`} eyebrow={mode === 'live' ? 'HR.ACTIONS in Snowflake' : 'Saved in this browser (Sample mode)'}
          actions={mode === 'live' ? <Powered>Snowflake table with role stamp</Powered> : undefined}>
          {rows.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--violet)' }} />
              <p className="font-semibold">No decisions recorded yet</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>Open a team on the Attrition risk screen, or a cell on Pay equity, and choose <strong>Record a decision</strong>.</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>When</th><th>Subject</th><th>Action</th><th>Note</th><th>Role</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><td className="tabular whitespace-nowrap">{r.createdAt}</td><td className="font-semibold">{r.subjectLabel}</td>
                  <td><span className="chip chip-policy">{r.action}</span></td><td style={{ color: 'var(--ink-2)' }}>{r.note || '—'}</td><td className="tabular text-[12px]">{r.persona}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </>
  );
}
