'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Markdown, Powered, SampleTag } from './ui';
import { Reasoning } from './Reasoning';
import { aiSteps, type AiKind } from '@/lib/ai';
import { runAi, useWorkforce } from '@/lib/workforce-data';
import type { AiResult } from '@/lib/types';

// One AI moment: a button, staged reasoning, then the answer with its source and capability badge.
export function AiPanel({ kind, label, args = {}, sample, intro, resetKey }: {
  kind: AiKind; label: string; args?: Record<string, string>; sample: () => string; intro?: string; resetKey?: string;
}) {
  const { persona, mode } = useWorkforce();
  const [state, setState] = useState<{ key?: string; busy: boolean; result: AiResult | null; error: string | null }>({ busy: false, result: null, error: null });
  const current = state.key === `${persona}|${resetKey ?? ''}` ? state : { busy: false, result: null, error: null };
  const steps = aiSteps(kind, persona);

  const go = async () => {
    if (!mode) return;
    const key = `${persona}|${resetKey ?? ''}`;
    setState({ key, busy: true, result: null, error: null });
    try { setState({ key, busy: false, result: await runAi(mode, persona, kind, args, sample), error: null }); }
    catch (e) { setState({ key, busy: false, result: null, error: (e as Error).message }); }
  };

  return (
    <div className="space-y-3">
      {intro && !current.result && !current.busy && <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>{intro}</p>}
      <button className="btn btn-aurora" onClick={go} disabled={current.busy || !mode}>
        <Sparkles className="w-4 h-4" aria-hidden />{current.result ? 'Run again' : label}
      </button>
      {current.busy && <Reasoning steps={steps} expectedMs={mode === 'sample' ? 6000 : 9000} />}
      {current.error && <p className="text-sm" role="alert" style={{ color: 'var(--bad)' }}>{current.error}</p>}
      {current.result && (
        <div className="rounded-2xl p-4 fade-up" style={{ background: 'var(--card-solid)', border: '1px solid var(--line)' }}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {current.result.source === 'sample' ? <SampleTag /> : <span className="chip">Live · {((current.result.latencyMs ?? 0) / 1000).toFixed(1)}s</span>}
            <Powered>{current.result.capability}</Powered>
          </div>
          <Markdown text={current.result.text} />
        </div>
      )}
    </div>
  );
}
