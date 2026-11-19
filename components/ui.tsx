'use client';

import { Check } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

// Small building blocks shared across screens.

export function Powered({ children }: { children: ReactNode }) {
  return <span className="chip chip-powered" title="Snowflake capability behind this component">⬡ Powered by {children}</span>;
}
export function Policy({ children }: { children: ReactNode }) {
  return <span className="chip chip-policy" title="Snowflake governance policy applied to this data">⛨ {children}</span>;
}
export function SampleTag({ children = 'Sample AI response' }: { children?: ReactNode }) {
  return <span className="chip chip-sample">{children}</span>;
}

export function Card({ children, className = '', title, eyebrow, actions }: { children: ReactNode; className?: string; title?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <section className={`card p-5 fade-up ${className}`}>
      {(title || actions || eyebrow) && (
        <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="font-display text-[19px] font-semibold leading-tight">{title}</h2>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function CountUp({ value, format = (v) => Math.round(v).toLocaleString() }: { value: number; format?: (v: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now(); const dur = 900;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / dur); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tabular">{format(v)}</span>;
}

export function Kpi({ label, value, format, sub, tone = 'teal', icon }: { label: string; value: number; format?: (v: number) => string; sub?: ReactNode; tone?: 'teal' | 'violet' | 'coral' | 'amber'; icon?: ReactNode }) {
  return (
    <div className="card card-hover p-4 fade-up relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-[.13]" style={{ background: `var(--${tone})` }} aria-hidden />
      <div className="flex items-center gap-2 eyebrow">{icon}{label}</div>
      <div className="font-display text-[32px] font-semibold mt-1 leading-none"><CountUp value={value} format={format} /></div>
      {sub && <div className="text-[12.5px] mt-2" style={{ color: 'var(--ink-2)' }}>{sub}</div>}
    </div>
  );
}

export function Meter({ value, max = 1 }: { value: number; max?: number }) {
  return <div className="meter" aria-hidden><span style={{ width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }} /></div>;
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} aria-hidden />;
}

export function LiveError({ message }: { message: string }) {
  return (
    <div className="card p-5 border-l-4" style={{ borderLeftColor: 'var(--bad)' }} role="alert">
      <div className="font-semibold mb-1">Live query failed</div>
      <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{message}</p>
      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Live mode never falls back to sample data. Check sql/setup.sql and .env.local, or switch to Sample.</p>
    </div>
  );
}

// Minimal, safe Markdown for AI answers: paragraphs, **bold**, _italic_, and numbered or bulleted lists.
function inline(s: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**') ? <strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong> : <em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `li${nodes.length}-${i}`)}</li>);
    nodes.push(list.ordered ? <ol key={nodes.length}>{items}</ol> : <ul key={nodes.length}>{items}</ul>);
    list = null;
  };
  for (const b of blocks) {
    for (const line of b.split('\n')) {
      const o = line.match(/^\s*\d+[.)]\s+(.*)/); const u = line.match(/^\s*[-*•]\s+(.*)/);
      const h = line.match(/^#{1,4}\s+(.*)/);
      if (o || u) {
        const ordered = !!o;
        if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
        list.items.push((o ?? u)![1]);
      } else if (line.trim()) {
        flush();
        nodes.push(<p key={nodes.length}>{h ? <strong>{h[1].replace(/\*\*/g, '')}</strong> : inline(line, `p${nodes.length}`)}</p>);
      }
    }
    flush();
  }
  return <div className="prose-ai text-[14px]">{nodes}</div>;
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 card px-4 py-3 flex items-center gap-2 fade-up" role="status">
      <Check className="w-4 h-4" style={{ color: 'var(--good)' }} aria-hidden /><span className="text-sm">{text}</span>
    </div>
  );
}
