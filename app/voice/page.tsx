'use client';

import { Quote } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, PolicyStrip } from '@/components/Shell';
import { AiPanel } from '@/components/AiPanel';
import { ActionButton } from '@/components/ActionButton';
import { Card, LiveError, Policy, Powered, SampleTag, Skeleton } from '@/components/ui';
import { useScreen, useWorkforce } from '@/lib/workforce-data';
import { sampleBundle } from '@/lib/mock-source';
import { sampleVoiceSummary } from '@/lib/ai';
import { axis, chartTooltip, THEME_COLORS } from '@/lib/chart';

const SENT = { positive: 'var(--teal)', neutral: 'var(--muted)', negative: 'var(--coral)' } as Record<string, string>;

export default function VoicePage() {
  const { data, error, loading, persona, source, latencyMs } = useScreen('voice');
  const { mode } = useWorkforce();
  const themes = data ? data.themes.map((t) => t.theme) : [];
  return (
    <>
      <PageHeader eyebrow="Voice of employee" title={<>What people are <span className="aurora-text">telling you</span></>}>
        Survey comments classified by theme and sentiment, across four cycles. Read them alongside the attrition and pay screens: they often explain the numbers.
      </PageHeader>
      <PolicyStrip />
      {error && <LiveError message={error} />}
      {loading && !error && <Skeleton h={420} />}
      {data && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card eyebrow="Themes over time" title="Comment volume by theme"
              actions={<>{source === 'live' && <span className="chip">Live · {((latencyMs ?? 0) / 1000).toFixed(1)}s</span>}{mode === 'sample' ? <SampleTag>Sample classification</SampleTag> : <Powered>AI_CLASSIFY</Powered>}</>}>
              <div className="h-[280px]">
                <ResponsiveContainer>
                  <AreaChart data={data.themeTrend} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="cycle" {...axis} />
                    <YAxis {...axis} width={40} />
                    <Tooltip {...chartTooltip} />
                    {themes.map((t) => <Area key={t} type="monotone" dataKey={t} stackId="1" stroke={THEME_COLORS[t]} fill={THEME_COLORS[t]} fillOpacity={0.55} />)}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                {themes.map((t) => <span key={t} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: THEME_COLORS[t] }} />{t}</span>)}
              </div>
            </Card>
            <Card eyebrow="Sentiment" title="Sentiment and engagement by cycle" actions={mode === 'sample' ? <SampleTag>Sample sentiment</SampleTag> : <Powered>AI_SENTIMENT</Powered>}>
              <div className="h-[280px]">
                <ResponsiveContainer>
                  <ComposedChart data={data.sentimentTrend} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="cycle" {...axis} tickFormatter={(c) => String(c).slice(0, 7)} />
                    <YAxis yAxisId="l" {...axis} width={40} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={32} domain={[2.5, 4.5]} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-2)' }} />
                    {(['positive', 'neutral', 'negative'] as const).map((s) => <Bar key={s} yAxisId="l" dataKey={s} stackId="s" fill={SENT[s]} name={s[0].toUpperCase() + s.slice(1)} />)}
                    <Line yAxisId="r" dataKey="engagement" name="Avg engagement" stroke="var(--violet)" strokeWidth={2.5} dot />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
            <Card eyebrow="2026-09 survey" title="Share of comments about schedules and shifts">
              <div className="h-[260px]">
                <ResponsiveContainer>
                  <BarChart data={data.familyShift} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" {...axis} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="family" width={140} {...axis} tick={{ fill: 'var(--ink-2)', fontSize: 11.5 }} />
                    <Tooltip {...chartTooltip} formatter={(v) => `${v}%`} />
                    <Bar dataKey="schedulePct" name="Schedules and shifts" fill="var(--coral)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {persona === 'chro' && <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>Job families with fewer than 10 comments are merged by the aggregation policy and not shown.</p>}
            </Card>
            <Card eyebrow="AI summary" title={persona === 'chro' ? 'Themes summarized from aggregates' : 'What the comments say'}
              actions={<ActionButton subjectType="survey-theme" subjectId="2026-09|Schedules and shifts" subjectLabel="Survey theme: schedules and shifts (2026-09)" defaultAction="Assign follow-up" />}>
              <AiPanel kind="voice-summary" label="Summarize the comments" resetKey={persona} sample={() => sampleVoiceSummary(sampleBundle(persona))}
                intro={persona === 'chro' ? 'The aggregation policy blocks AI_AGG over raw comments for the CHRO, so this summary uses theme and sentiment counts only.' : `Reads ${data.commentCount.toLocaleString()} comments from the latest survey that this role can see.`} />
            </Card>
          </div>

          <Card eyebrow="Comments" title="Latest comments" actions={persona === 'chro' ? <Policy>Aggregation policy · no row-level text</Policy> : <Policy>{persona === 'hrbp' ? 'Row access: Operations only' : 'All business units'}</Policy>}>
            {data.comments.length === 0 ? (
              <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>Individual comments aren&apos;t visible to the CHRO view. The aggregation policy only returns groups of 10 or more responses, so this role works from the themes and the AI summary above.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.comments.slice(0, 10).map((c) => (
                  <figure key={c.responseId} className="rounded-2xl p-4 card-hover" style={{ background: 'var(--card-solid)', border: '1px solid var(--line)' }}>
                    <Quote className="w-4 h-4 mb-2" style={{ color: THEME_COLORS[c.theme] ?? 'var(--violet)' }} aria-hidden />
                    <blockquote className="text-[14px] leading-relaxed">{c.text}</blockquote>
                    <figcaption className="flex flex-wrap items-center gap-2 mt-3 text-[11.5px]">
                      <span className="chip">{c.family} · {c.location}</span>
                      <span className="chip" style={{ color: THEME_COLORS[c.theme], borderColor: THEME_COLORS[c.theme] }}>{c.theme}</span>
                      <span className="chip" style={{ color: SENT[c.sentiment] ?? 'var(--ink-2)' }}>{c.sentiment}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
