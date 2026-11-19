'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, Lock, Network } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, PolicyStrip } from '@/components/Shell';
import { Card, LiveError, Meter, Policy, Powered, Skeleton } from '@/components/ui';
import { useScreen, useWorkforce } from '@/lib/workforce-data';
import { axis, chartTooltip } from '@/lib/chart';

// Color by position within the shown range: top third coral, middle amber, rest teal.
const riskColor = (r: number, max: number, min = 0) => { const t = (r - min) / Math.max(1e-9, max - min); return t > 0.66 ? 'var(--coral)' : t > 0.33 ? 'var(--amber)' : 'var(--teal)'; };
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AttritionPage() {
  const { data, error, loading, source, latencyMs } = useScreen('attrition');
  const { mode } = useWorkforce();
  const router = useRouter();
  return (
    <>
      <PageHeader eyebrow="Attrition risk" title={<>Which teams are <span className="aurora-text">most likely to lose people</span></>}>
        Teams, not named individuals, ranked by modeled voluntary-exit risk, with the drivers behind each score. Scores are illustrative and aggregated to the team.
      </PageHeader>
      <PolicyStrip />
      {error && <LiveError message={error} />}
      {loading && !error && <Skeleton h={420} />}
      {data?.mode === 'aggregate' && (
        <div className="space-y-5">
          <Card eyebrow="CHRO view" title="Risk by job family, location, and level"
            actions={<><Policy>Aggregation policy · minimum group {data.minGroup}</Policy><Powered>Snowflake ML Classification</Powered></>}>
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="h-[420px]">
                <ResponsiveContainer>
                  <BarChart data={data.groups.slice(0, 14)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" {...axis} tickFormatter={pct} />
                    <YAxis type="category" dataKey="group" width={260} {...axis} tick={{ fill: 'var(--ink-2)', fontSize: 11 }} />
                    <Tooltip {...chartTooltip} formatter={(v) => pct(Number(v))} />
                    <Bar dataKey="avgRisk" name="Average risk" radius={[0, 8, 8, 0]}>
                      {data.groups.slice(0, 14).map((g) => <Cell key={g.group} fill={riskColor(g.avgRisk, data.groups[0].avgRisk, data.groups[13]?.avgRisk ?? 0)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--violet) 7%, var(--card-solid))', border: '1px solid color-mix(in srgb, var(--violet) 30%, var(--line))' }}>
                  <div className="flex items-center gap-2 font-semibold mb-1"><Lock className="w-4 h-4" style={{ color: 'var(--violet)' }} />Remainder group</div>
                  <div className="font-display text-[34px] font-semibold tabular">{data.remainder.size.toLocaleString()} <span className="text-[14px] font-sans font-normal" style={{ color: 'var(--ink-2)' }}>people</span></div>
                  <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                    {data.remainder.groupsMerged > 0 ? `${data.remainder.groupsMerged} groups` : 'Every group'} with fewer than {data.minGroup} people {data.remainder.groupsMerged > 0 ? 'were' : 'was'} merged into one row with blank labels by the aggregation policy. Average risk {pct(data.remainder.avgRisk)}.
                  </p>
                </div>
                <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>Manager teams are smaller than {data.minGroup} people, so the CHRO view groups by job family, location, and level instead. Team and employee drill-downs aren&apos;t available to this role.</p>
                {source === 'live' && <span className="chip">Live · {((latencyMs ?? 0) / 1000).toFixed(1)}s</span>}
              </div>
            </div>
          </Card>
        </div>
      )}
      {data?.mode === 'teams' && (
        <div className="space-y-5">
          <Card eyebrow="Work queue" title={`Top ${data.teams.length} teams by modeled risk`}
            actions={<>{source === 'live' && <span className="chip">Live · {((latencyMs ?? 0) / 1000).toFixed(1)}s</span>}<Powered>Snowflake ML Classification</Powered><Policy>Row access policy</Policy></>}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Team</th><th>Business unit</th><th className="w-[160px]">Avg risk</th><th>Top drivers</th><th className="text-right">Vol. exits 12 mo</th><th className="text-right">Reqs &gt; 60 days</th><th /></tr></thead>
                <tbody>
                  {data.teams.slice(0, 18).map((t) => (
                    <tr key={t.teamId} className="row-link" onClick={() => router.push(`/team/?id=${t.teamId}`)}>
                      <td>
                        <Link href={`/team/?id=${t.teamId}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>{t.team}</Link>
                        <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{t.size} people · span {t.span}</div>
                      </td>
                      <td>{t.bu}</td>
                      <td>
                        <div className="flex items-center gap-2"><span className="tabular font-semibold w-10" style={{ color: riskColor(t.avgRisk, data.teams[0].avgRisk, data.teams[17]?.avgRisk ?? 0) }}>{pct(t.avgRisk)}</span><div className="flex-1"><Meter value={t.avgRisk} max={data.teams[0].avgRisk} /></div></div>
                      </td>
                      <td><div className="flex flex-wrap gap-1">{t.drivers.map((d) => <span key={d.driver} className="chip">{d.driver}</span>)}</div></td>
                      <td className="text-right tabular">{t.volExits12m}</td>
                      <td className="text-right tabular">{t.openReqs60 ? <span className="chip chip-warn">{t.openReqs60}</span> : '—'}</td>
                      <td><ChevronRight className="w-4 h-4" style={{ color: 'var(--muted)' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>
              {mode === 'live' ? 'Scores come from ATTRITION_MODEL (SNOWFLAKE.ML.CLASSIFICATION) trained on EMPLOYEE_FEATURES. Drivers are the share of the team with each flag, weighted by the model\'s feature importance.'
                : 'Sample scores come from a fixed formula over the same features the live model uses. Live mode trains SNOWFLAKE.ML.CLASSIFICATION, so its ranking differs somewhat.'}
            </p>
          </Card>
          {data.wideSpans.length > 0 && (
            <Card eyebrow="Structure" title={<span className="flex items-center gap-2"><Network className="w-5 h-5" style={{ color: 'var(--violet)' }} />Managers with more than 15 direct reports</span>}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.wideSpans.map((m) => (
                  <div key={m.team} className="rounded-2xl p-4" style={{ background: 'var(--card-solid)', border: '1px solid var(--line)' }}>
                    <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: 'var(--coral)' }}><AlertTriangle className="w-3.5 h-3.5" />Span {m.span}</div>
                    <div className="font-semibold mt-1">{m.manager}</div>
                    <div className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>{m.team}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
