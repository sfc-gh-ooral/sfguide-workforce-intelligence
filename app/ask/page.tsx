'use client';

import { Bot, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader, PolicyStrip } from '@/components/Shell';
import { Reasoning } from '@/components/Reasoning';
import { Card, Markdown, Policy, Powered, SampleTag } from '@/components/ui';
import { useWorkforce } from '@/lib/workforce-data';
import { liveJson } from '@/lib/mode';
import { sampleBundle } from '@/lib/mock-source';
import { CHAT_STEPS, CHAT_SUGGESTIONS, sampleChat } from '@/lib/ai';
import { sampleDelayMs, wait } from '@/lib/sample-timing';
import { PERSONAS } from '@/lib/personas';

interface Msg { role: 'user' | 'assistant'; text: string; source?: 'sample' | 'live'; latencyMs?: number; persona?: string; error?: boolean }

export default function AskPage() {
  const { persona, mode } = useWorkforce();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || busy || !mode) return;
    setInput(''); setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text: q, persona: PERSONAS[persona].label }]);
    try {
      if (mode === 'sample') {
        await wait(sampleDelayMs());
        setMsgs((m) => [...m, { role: 'assistant', text: sampleChat(q, sampleBundle(persona)), source: 'sample' }]);
      } else {
        const r = await liveJson<{ text: string; latencyMs: number }>('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, persona }) });
        setMsgs((m) => [...m, { role: 'assistant', text: r.text, source: 'live', latencyMs: r.latencyMs }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: (e as Error).message, error: true }]);
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader eyebrow="Ask HR data" title={<>Plain-English answers, <span className="aurora-text">same policies</span></>}>
        Ask about headcount, exits, and open requisitions. The agent queries Snowflake as your persona&apos;s role, so masking and row access still apply. Try the same question as two personas.
      </PageHeader>
      <PolicyStrip />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="min-h-[520px] flex flex-col" actions={<><Powered>Cortex Agents</Powered><Powered>Cortex Analyst · Semantic View</Powered></>} title="Conversation" eyebrow="WORKFORCE_AGENT">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1 max-h-[560px]">
            {msgs.length === 0 && (
              <div className="rounded-2xl p-5 text-center" style={{ background: 'color-mix(in srgb, var(--violet) 5%, var(--card-solid))', border: '1px dashed var(--line-2)' }}>
                <Bot className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--violet)' }} />
                <p className="font-semibold">Ask a question, or pick one on the right</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>{mode === 'sample' ? 'Sample mode answers the suggested questions with scripted responses.' : 'Live mode sends your question to WORKFORCE_AGENT in Snowflake.'}</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-3 fade-up ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && <span className="w-8 h-8 shrink-0 rounded-xl grid place-items-center" style={{ background: 'var(--aurora)' }}><Bot className="w-4 h-4 text-white" /></span>}
                <div className={`rounded-2xl px-4 py-3 max-w-[85%] ${m.role === 'user' ? 'text-white' : ''}`}
                  style={m.role === 'user' ? { background: 'var(--rail)' } : { background: 'var(--card-solid)', border: `1px solid ${m.error ? 'var(--bad)' : 'var(--line)'}` }}>
                  {m.role === 'user' ? <><div className="text-[11px] opacity-70 mb-0.5">as {m.persona}</div><div className="text-[14px]">{m.text}</div></>
                    : <>
                      {!m.error && <div className="flex flex-wrap gap-2 mb-2">{m.source === 'sample' ? <SampleTag /> : <span className="chip">Live · {((m.latencyMs ?? 0) / 1000).toFixed(1)}s</span>}<Policy>Policies applied as {PERSONAS[persona].role}</Policy></div>}
                      {m.error ? <p className="text-sm" style={{ color: 'var(--bad)' }}>{m.text}</p> : <Markdown text={m.text} />}
                    </>}
                </div>
                {m.role === 'user' && <span className="w-8 h-8 shrink-0 rounded-xl grid place-items-center" style={{ background: PERSONAS[persona].color }}><User className="w-4 h-4 text-white" /></span>}
              </div>
            ))}
            {busy && <div className="max-w-[85%] ml-11"><Reasoning steps={CHAT_STEPS(persona)} expectedMs={mode === 'sample' ? 6000 : 15000} /></div>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 mt-4" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input className="flex-1 px-4 py-2.5 text-[14px]" placeholder="How many open reqs in Operations are older than 60 days?" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Question" maxLength={2000} />
            <button className="btn btn-aurora" disabled={busy || !input.trim()} aria-label="Send"><Send className="w-4 h-4" /></button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card eyebrow="Try asking" title="Suggested questions">
            <div className="flex flex-col gap-2">
              {CHAT_SUGGESTIONS.map((q) => <button key={q} className="btn btn-ghost !justify-start text-left !font-medium" onClick={() => ask(q)} disabled={busy}>{q}</button>)}
            </div>
          </Card>
          <Card eyebrow="Governance" title="Policies follow the question">
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>Ask the Technology question as the HR business partner, then as the compensation analyst. The HRBP&apos;s row access policy hides Technology, so the agent says it can&apos;t see it instead of returning zero.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
