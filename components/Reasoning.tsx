'use client';

// Staged progress for AI calls. The steps name what the live path actually runs. In Sample mode they
// advance over the simulated delay; in Live mode they advance on a timer while the real call runs, and
// the last step holds until the answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Reasoning({ steps, expectedMs = 6000 }: { steps: string[]; expectedMs?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(id);
  }, []);
  const per = expectedMs / steps.length;
  const step = Math.min(steps.length - 1, Math.floor(elapsed / per));
  return (
    <div className="reasoning" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-3 relative z-[1]">
        <div className="flex items-center gap-2 text-[13px] font-semibold"><span className="orb" aria-hidden />Reasoning</div>
        <span className="text-[11.5px] tabular" style={{ color: 'var(--muted)' }}>{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      <ol className="space-y-2 relative z-[1]">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className={`reasoning-step ${state} flex items-center gap-2.5 text-[13px]`}>
              {state === 'done' ? <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--good)' }} aria-hidden />
                : state === 'active' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--violet)' }} aria-hidden />
                : <span className="w-4 h-4 shrink-0 rounded-full border" style={{ borderColor: 'var(--line-2)' }} aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="reasoning-bar mt-3 relative z-[1]" aria-hidden><span style={{ width: `${Math.min(96, (elapsed / expectedMs) * 100)}%` }} /></div>
    </div>
  );
}
