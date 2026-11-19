'use client';

import Link from 'next/link';
import { ArrowRight, Clock, LogOut, TrendingUp, UserPlus, Users } from 'lucide-react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, PolicyStrip } from '@/components/Shell';
import { Card, Kpi, LiveError, Policy, Powered, Skeleton } from '@/components/ui';
import { useScreen } from '@/lib/workforce-data';
import { chartTooltip, axis } from '@/lib/chart';

const mlabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export default function OverviewPage() {
  const { data, error, loading, persona, source, latencyMs } = useScreen('overview');
  return (
    <>
      <PageHeader eyebrow="Workforce overview" title={<>Your workforce, <span className="aurora-text">governed by design</span></>}>
        Headcount, hiring, exits, and time-to-fill, filtered and masked for whoever is looking. Switch <strong>View as</strong> to see the same screen through each persona&apos;s policies.
      </PageHeader>
      <PolicyStrip />
      {error && <LiveError message={error} />}
      {loading && !error && <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} />)}</div>}
      {data && (
        <div className="space-y-5">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Kpi label="Headcount" icon={<Users className="w-3.5 h-3.5" />} value={data.kpis.headcount} sub={persona === 'hrbp' ? 'Operations, active' : 'Active employees'} tone="violet" />
            <Kpi label="Hires · 12 mo" icon={<UserPlus className="w-3.5 h-3.5" />} value={data.kpis.hires12m} tone="teal" />
            <Kpi label="Exits · 12 mo" icon={<LogOut className="w-3.5 h-3.5" />} value={data.kpis.exits12m} tone="coral" />
            <Kpi label="Attrition · rolling 12 mo" icon={<TrendingUp className="w-3.5 h-3.5" />} value={data.kpis.attrition12m ?? 0} format={(v) => `${v.toFixed(1)}%`} tone="amber"
              sub={data.kpis.attritionPrior !== null && <span>was {data.kpis.attritionPrior.toFixed(1)}% six months ago</span>} />
            <Kpi label="Time to fill" icon={<Clock className="w-3.5 h-3.5" />} value={data.kpis.timeToFill} format={(v) => `${Math.round(v)} days`} tone="teal"
              sub={<span>{data.kpis.openReqs} open reqs · <strong>{data.kpis.openReqs60}</strong> over 60 days</span>} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Card eyebrow="Trend" title="Headcount and rolling 12-month attrition"
              actions={<>{source === 'live' && <span className="chip">Live · {((latencyMs ?? 0) / 1000).toFixed(1)}s</span>}<Policy>{persona === 'chro' ? 'Aggregation policy' : persona === 'hrbp' ? 'Row access policy' : 'All business units'}</Policy></>}>
              <div className="h-[280px]">
                <ResponsiveContainer>
                  <ComposedChart data={data.trend} margin={{ left: 0, right: 8, top: 8 }}>
                    <defs><linearGradient id="hc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--violet)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--violet)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={mlabel} {...axis} interval={2} />
                    <YAxis yAxisId="l" {...axis} width={52} domain={[(d: number) => Math.floor((d * 0.92) / 500) * 500, (d: number) => Math.ceil((d * 1.02) / 500) * 500]} tickFormatter={(v) => v.toLocaleString()} />
                    <YAxis yAxisId="r" orientation="right" {...axis} width={40} tickFormatter={(v) => `${v}%`} domain={[0, 'dataMax + 4']} />
                    <Tooltip {...chartTooltip} labelFormatter={(m) => mlabel(String(m))} />
                    <Area yAxisId="l" type="monotone" dataKey="headcount" name="Headcount" stroke="var(--violet)" strokeWidth={2} fill="url(#hc)" />
                    <Line yAxisId="r" type="monotone" dataKey="attrition12m" name="Attrition 12 mo (%)" stroke="var(--coral)" strokeWidth={2.5} dot={false} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card eyebrow="Where exits are rising" title="Voluntary exits by job family" actions={<Link href="/attrition" className="chip chip-policy">Attrition risk <ArrowRight className="w-3 h-3" /></Link>}>
              <ul className="space-y-3">
                {data.familyAttrition.slice(0, 6).map((f) => {
                  const rate = (f.vol6m / Math.max(1, f.headcount)) * 100;
                  const hot = (f.change ?? 0) >= 100;
                  return (
                    <li key={f.family}>
                      <div className="flex items-center justify-between text-[13px] mb-1">
                        <span className="font-semibold">{f.family} <span className="font-normal" style={{ color: 'var(--muted)' }}>· {f.bu}</span></span>
                        <span className="tabular">{f.vol6m} in 6 mo{f.change !== null && <span className={`ml-2 chip ${hot ? 'chip-warn' : ''}`}>{f.change > 0 ? '+' : ''}{f.change}%</span>}</span>
                      </div>
                      <div className="meter"><span style={{ width: `${Math.min(100, rate * 4)}%`, background: hot ? 'linear-gradient(90deg, var(--amber), var(--coral))' : undefined }} /></div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[12px] mt-4" style={{ color: 'var(--muted)' }}>Change compares the last six months with the six before, on this synthetic data set.</p>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <Card eyebrow="Monthly flow" title="Hires and exits">
              <div className="h-[230px]">
                <ResponsiveContainer>
                  <BarChart data={data.trend.slice(-12)} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={mlabel} {...axis} />
                    <YAxis {...axis} width={40} />
                    <Tooltip {...chartTooltip} labelFormatter={(m) => mlabel(String(m))} />
                    <Bar dataKey="hires" name="Hires" fill="var(--teal)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="exits" name="Exits" fill="var(--coral)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card eyebrow="By business unit" title="Last 12 months" actions={<Powered>Row access policies</Powered>}>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Business unit</th><th className="text-right">Headcount</th><th className="text-right">Hires</th><th className="text-right">Exits</th><th className="text-right">Attrition</th><th className="text-right">Open reqs</th><th className="text-right">Days to fill</th></tr></thead>
                  <tbody>
                    {data.byBu.map((b) => (
                      <tr key={b.bu}>
                        <td className="font-semibold">{b.bu}</td>
                        <td className="text-right tabular">{b.headcount.toLocaleString()}</td>
                        <td className="text-right tabular">{b.hires}</td>
                        <td className="text-right tabular">{b.exits}</td>
                        <td className="text-right tabular">{b.attrition.toFixed(1)}%</td>
                        <td className="text-right tabular">{b.openReqs}</td>
                        <td className="text-right tabular">{b.timeToFill}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {persona === 'hrbp' && <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>Other business units are filtered out by the BU_ROW_ACCESS row access policy for WI_HRBP_ROLE.</p>}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

