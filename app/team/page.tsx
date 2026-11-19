'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Suspense } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, PolicyStrip } from '@/components/Shell';
import { AiPanel } from '@/components/AiPanel';
import { ActionButton } from '@/components/ActionButton';
import { Card, Kpi, LiveError, Policy, Powered, Skeleton } from '@/components/ui';
import { useTeam, useWorkforce } from '@/lib/workforce-data';
import { sampleTeamBrief } from '@/lib/ai';
import { axis, chartTooltip } from '@/lib/chart';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const BAND_COLORS = ['var(--teal)', 'var(--amber)', 'var(--coral)'];

function TeamView() {
  const id = useSearchParams().get('id');
  const { persona } = useWorkforce();
  const { data, error, loading } = useTeam(persona === 'chro' ? null : id);

  if (persona === 'chro') {
    return (
      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 mt-0.5" style={{ color: 'var(--violet)' }} />
          <div>
            <h2 className="font-display text-xl font-semibold">Team detail isn&apos;t available to the CHRO view</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>Manager teams have fewer than 10 people, and the MIN_GROUP_10 aggregation policy only returns groups of 10 or more to WI_CHRO_ROLE. Switch to the HR business partner or compensation analyst view, or go back to the aggregate risk view.</p>
            <Link href="/attrition" className="btn btn-ghost mt-4"><ArrowLeft className="w-4 h-4" />Back to attrition risk</Link>
          </div>
        </div>
      </Card>
    );
  }
  if (error) return <LiveError message={error} />;
  if (loading || !data) return <Skeleton h={420} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/attrition" className="chip"><ArrowLeft className="w-3.5 h-3.5" />All teams</Link>
        <ActionButton subjectType="team" subjectId={data.teamId} subjectLabel={data.team} />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Average modeled risk" value={data.avgRisk * 100} format={(v) => `${Math.round(v)}%`} tone="coral" sub={`${data.highRisk} of ${data.size} in the high band`} />
        <Kpi label="Avg engagement" value={data.avgEngagement} format={(v) => v.toFixed(2)} tone="violet" sub="Latest survey, 1–5 scale" />
        <Kpi label="Voluntary exits · 12 mo" value={data.volExits12m} tone="amber" />
        <Kpi label="Open reqs > 60 days" value={data.openReqs60} tone="teal" sub={`${data.openReqs} open in total`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card eyebrow="Why this team" title="Top risk drivers" actions={<Powered>Snowflake ML Classification</Powered>}>
          <ul className="space-y-3 mb-5">
            {data.drivers.map((d) => (
              <li key={d.driver}>
                <div className="flex justify-between text-[13.5px] mb-1"><span className="font-semibold">{d.driver}</span><span className="tabular" style={{ color: 'var(--muted)' }}>{d.weight.toFixed(2)}</span></div>
                <div className="meter"><span style={{ width: `${Math.min(100, (d.weight / Math.max(...data.drivers.map((x) => x.weight))) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="eyebrow mb-2">People by risk band</div>
          <div className="h-[150px]">
            <ResponsiveContainer>
              <BarChart data={data.riskBands} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} width={28} allowDecimals={false} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="count" name="People" radius={[8, 8, 0, 0]}>{data.riskBands.map((b, i) => <Cell key={b.label} fill={BAND_COLORS[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card eyebrow="AI conversation plan" title="Prepare for the manager conversation" actions={<Policy>Team-level inputs only</Policy>}>
          <AiPanel kind="team-brief" label="Draft a conversation plan" resetKey={data.teamId} args={{ teamId: data.teamId }} sample={() => sampleTeamBrief(data)}
            intro="Uses team-level drivers and open requisitions only. No individual scores are sent to the model." />
        </Card>
      </div>
      {data.reqs.length > 0 && (
        <Card eyebrow="Hiring backlog" title="Open requisitions on this team">
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Req</th><th>Job family</th><th>Level</th><th>Location</th><th>Opened</th><th className="text-right">Age</th></tr></thead>
            <tbody>{data.reqs.map((r) => (
              <tr key={r.req_id}><td className="tabular">{r.req_id}</td><td>{r.job_family}</td><td>{r.level}</td><td>{r.location}</td><td className="tabular">{r.opened_date}</td>
                <td className="text-right">{r.age > 60 ? <span className="chip chip-warn">{r.age} days</span> : <span className="tabular">{r.age} days</span>}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      {data.employees ? (
        <Card eyebrow="Compensation analyst view" title="Employee-level detail" actions={<><Policy>Full pay detail</Policy><span className="chip chip-warn">Illustrative scores. Not for individual decisions.</span></>}>
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Employee</th><th>Level</th><th className="text-right">Tenure</th><th className="text-right">Rating</th><th className="text-right">Engagement</th><th className="text-right">Base</th><th className="text-right">Compa</th><th className="text-right">Months since promo</th><th className="text-right">Risk</th></tr></thead>
            <tbody>{data.employees.map((e) => (
              <tr key={e.id}><td><span className="font-semibold">{e.name}</span> <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{e.id}</span></td><td>{e.level}</td>
                <td className="text-right tabular">{e.tenure.toFixed(1)} yr</td><td className="text-right tabular">{e.rating}</td><td className="text-right tabular">{e.engagement.toFixed(1)}</td>
                <td className="text-right tabular">${e.base.toLocaleString()}</td><td className="text-right tabular">{e.compa.toFixed(2)}</td><td className="text-right tabular">{e.monthsSincePromo}</td>
                <td className="text-right tabular font-semibold">{pct(e.risk)}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 mt-0.5" style={{ color: 'var(--violet)' }} />
            <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}><strong>Employee-level rows are hidden for the HR business partner.</strong> HRBPs work at the team level. Switch to the compensation analyst view to see named records, with exact pay.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function Title() {
  const id = useSearchParams().get('id');
  return <PageHeader eyebrow={`Attrition risk · team ${id ?? ''}`} title={<>Team <span className="aurora-text">drill-down</span></>}>Modeled risk, drivers, and hiring backlog for one manager&apos;s team, then a human decision.</PageHeader>;
}

export default function TeamPage() {
  return (
    <Suspense fallback={<Skeleton h={420} />}>
      <Title />
      <PolicyStrip />
      <TeamView />
    </Suspense>
  );
}
