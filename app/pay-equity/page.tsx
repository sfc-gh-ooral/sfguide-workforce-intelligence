'use client';

import { EyeOff, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { PageHeader, PolicyStrip } from '@/components/Shell';
import { AiPanel } from '@/components/AiPanel';
import { ActionButton } from '@/components/ActionButton';
import { Card, LiveError, Policy, Powered, Skeleton } from '@/components/ui';
import { useScreen } from '@/lib/workforce-data';
import { samplePayExplain } from '@/lib/ai';
import { axis, chartTooltip } from '@/lib/chart';
import type { PayCell } from '@/lib/types';

const gapColor = (g: number | null) => (g === null ? 'var(--line-2)' : g <= -4 ? 'var(--coral)' : g <= -2 ? 'var(--amber)' : g >= 2 ? 'var(--violet)' : 'var(--teal)');
const fmt = (g: number | null) => (g === null ? '—' : `${g > 0 ? '+' : ''}${g.toFixed(1)}%`);

export default function PayEquityPage() {
  const { data, error, loading, persona, source, latencyMs } = useScreen('pay');
  const pe = data?.payEquity;
  const cells = useMemo(() => (pe && pe.mode !== 'masked' ? pe.cells.filter((c) => c.nFemale + c.nMale >= 20 || c.suppressed) : []), [pe]);
  const [sel, setSel] = useState<PayCell | null>(null);
  useEffect(() => { if (cells.length) setSel(cells.find((c) => !c.suppressed) ?? cells[0]); }, [cells]);

  return (
    <>
      <PageHeader eyebrow="Pay equity" title={<>Gaps that <span className="aurora-text">survive the controls</span></>}>
        A regression-adjusted gap for every job family and level. Within each cell, pay is compared after controlling for tenure and latest performance rating, so a gap that persists needs a closer look.
      </PageHeader>
      <PolicyStrip />
      {error && <LiveError message={error} />}
      {loading && !error && <Skeleton h={420} />}

      {pe?.mode === 'masked' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Card eyebrow="HR business partner view" title={<span className="flex items-center gap-2"><Lock className="w-5 h-5" style={{ color: 'var(--violet)' }} />Pay equity needs the compensation analyst role</span>}
            actions={<Policy>Masking policy applied</Policy>}>
            <p className="text-[14px] mb-4" style={{ color: 'var(--ink-2)' }}>Gender and ethnicity are masked for WI_HRBP_ROLE, and base pay is rounded down to a $10k band. That&apos;s enough to see the pay mix in Operations, but not enough to compute a gap. Switch <strong>View as</strong> to the compensation analyst to see the adjusted gaps.</p>
            <div className="eyebrow mb-2">Operations headcount by masked pay band</div>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <BarChart data={pe.bandDistribution} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="band" {...axis} interval={1} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                  <YAxis {...axis} width={36} />
                  <Tooltip {...chartTooltip} />
                  <Bar dataKey="count" name="People" fill="var(--violet)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card eyebrow="What the HRBP sees" title="Employee records, as returned by Snowflake" actions={<><Policy>PAY_MASK</Policy><Policy>PROTECTED_ATTR_MASK</Policy></>}>
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th>Employee</th><th>Job family</th><th>Level</th><th>Base salary</th><th>Gender</th><th>Ethnicity</th></tr></thead>
              <tbody>{pe.sample.map((r) => (
                <tr key={r.id}><td className="font-semibold">{r.name}</td><td>{r.family}</td><td>{r.level}</td>
                  <td><span className="chip chip-policy"><EyeOff className="w-3 h-3" />{r.salary}</span></td>
                  <td><span className="chip">{r.gender}</span></td><td><span className="chip">{r.ethnicity}</span></td></tr>
              ))}</tbody>
            </table></div>
            {source === 'live' && <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>Live · {((latencyMs ?? 0) / 1000).toFixed(1)}s · values masked by Snowflake before they reach the app.</p>}
          </Card>
        </div>
      )}

      {pe && pe.mode !== 'masked' && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Card eyebrow="Adjusted gap, women vs men" title="By job family and level"
              actions={<>{source === 'live' && <span className="chip">Live · {((latencyMs ?? 0) / 1000).toFixed(1)}s</span>}{pe.mode === 'aggregate' && <Policy>Small-cell masking · under {pe.minGroup}</Policy>}<Powered>Snowflake SQL</Powered></>}>
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <ScatterChart margin={{ left: 0, right: 12, top: 8 }}>
                    <CartesianGrid stroke="var(--grid)" />
                    <XAxis type="number" dataKey="rawGap" name="Raw gap" unit="%" {...axis} domain={[-9, 6]} />
                    <YAxis type="number" dataKey="adjustedGap" name="Adjusted gap" unit="%" {...axis} width={44} domain={[-9, 6]} />
                    <ZAxis type="number" dataKey="n" range={[40, 360]} />
                    <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                    <ReferenceLine x={0} stroke="var(--muted)" strokeDasharray="4 4" />
                    <Tooltip {...chartTooltip} formatter={(v, n) => [`${v}`, String(n)]} labelFormatter={() => ''}
                      content={({ payload }) => {
                        const c = payload?.[0]?.payload as (PayCell & { n: number }) | undefined;
                        if (!c) return null;
                        return <div style={chartTooltip.contentStyle} className="p-2"><strong>{c.family} · {c.level}</strong><br />Raw {fmt(c.rawGap)} · Adjusted {fmt(c.adjustedGap)}<br />{c.nFemale} women · {c.nMale} men</div>;
                      }} />
                    <Scatter data={cells.filter((c) => c.adjustedGap !== null).map((c) => ({ ...c, n: c.nFemale + c.nMale }))} onClick={(p) => setSel(p as unknown as PayCell)}>
                      {cells.filter((c) => c.adjustedGap !== null).map((c) => <Cell key={`${c.family}${c.level}`} fill={gapColor(c.adjustedGap)} fillOpacity={0.85} cursor="pointer" />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>Each dot is a job family × level cell, sized by headcount. Dots far below zero on both axes are gaps that persist after controls. Click a dot or a row to explain it.</p>
            </Card>
            <Card eyebrow="Explain" title={sel ? `${sel.family} · ${sel.level}` : 'Pick a cell'} actions={sel && <ActionButton subjectType="pay-cell" subjectId={`${sel.family}|${sel.level}`} subjectLabel={`Pay equity: ${sel.family} · ${sel.level}`} defaultAction="Escalate to comp review" />}>
              {sel && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[['Raw gap', fmt(sel.rawGap)], ['Adjusted gap', fmt(sel.adjustedGap)], ['Women · men', `${sel.nFemale} · ${sel.nMale}`]].map(([k, v]) => (
                      <div key={k} className="rounded-xl p-3" style={{ background: 'var(--card-solid)', border: '1px solid var(--line)' }}>
                        <div className="eyebrow">{k}</div><div className="font-display text-[22px] font-semibold tabular" style={{ color: k === 'Adjusted gap' ? gapColor(sel.adjustedGap) : undefined }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <AiPanel kind="pay-explain" label="Explain this gap" resetKey={`${sel.family}|${sel.level}`} args={{ family: sel.family, level: sel.level }}
                    sample={() => samplePayExplain(sel, data?.cohort ?? null, persona)} />
                </>
              )}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <Card eyebrow="Largest adjusted gaps" title="Cells to review">
              <div className="overflow-x-auto"><table className="table">
                <thead><tr><th>Job family · level</th><th>Business unit</th><th className="text-right">Women</th><th className="text-right">Men</th><th className="text-right">Raw</th><th className="text-right">Adjusted</th></tr></thead>
                <tbody>
                  {cells.slice(0, 10).map((c) => (
                    <tr key={`${c.family}${c.level}`} className="row-link" onClick={() => setSel(c)} aria-selected={sel === c}>
                      <td className="font-semibold">{c.family} · {c.level}</td><td>{c.bu}</td>
                      <td className="text-right tabular">{c.nFemale}</td><td className="text-right tabular">{c.nMale}</td>
                      <td className="text-right tabular">{fmt(c.rawGap)}</td>
                      <td className="text-right">{c.suppressed ? <span className="chip chip-policy"><Lock className="w-3 h-3" />Suppressed</span> : <span className="chip" style={{ color: gapColor(c.adjustedGap), borderColor: gapColor(c.adjustedGap) }}>{fmt(c.adjustedGap)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {pe.mode === 'aggregate' && <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>{pe.cells.filter((c) => c.suppressed).length} cells have fewer than {pe.minGroup} women or {pe.minGroup} men. SMALL_CELL_GAP_MASK returns their gaps as blank for WI_CHRO_ROLE.</p>}
            </Card>
            <Card eyebrow="Below band" title="Cohorts with people under band minimum" actions={pe.mode === 'aggregate' ? <Policy>Aggregation policy</Policy> : undefined}>
              <ul className="space-y-3">
                {pe.belowBand.slice(0, 6).map((b) => (
                  <li key={`${b.family}${b.level}`} className="flex items-center justify-between gap-3">
                    <div><div className="font-semibold text-[13.5px]">{b.family} · {b.level}</div><div className="text-[12px]" style={{ color: 'var(--muted)' }}>{b.bu} · avg compa {b.avgCompa.toFixed(2)}</div></div>
                    <span className="chip chip-warn tabular">{b.belowBand} of {b.headcount}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {data?.cohort && (
            <Card eyebrow="Compensation analyst view" title="Software Engineering · L4 cohort, by compa-ratio" actions={<Policy>Full pay detail · WI_COMP_ROLE</Policy>}>
              <div className="h-[220px]">
                <ResponsiveContainer>
                  <ScatterChart margin={{ left: 0, right: 12, top: 8 }}>
                    <CartesianGrid stroke="var(--grid)" />
                    <XAxis type="number" dataKey="tenure" name="Tenure" unit=" yr" {...axis} />
                    <YAxis type="number" dataKey="compa" name="Compa-ratio" {...axis} width={44} domain={[0.75, 1.25]} />
                    <Tooltip {...chartTooltip} />
                    <Scatter name="Women" data={data.cohort.filter((c) => c.gender === 'Female')} fill="var(--coral)" />
                    <Scatter name="Men" data={data.cohort.filter((c) => c.gender === 'Male')} fill="var(--violet)" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}><span style={{ color: 'var(--coral)' }}>●</span> Women <span className="ml-3" style={{ color: 'var(--violet)' }}>●</span> Men · {data.cohort.length} people. On this synthetic data set, women sit lower at every tenure.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
