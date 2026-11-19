// AI moments: the progress steps each one shows (they name what the live path really runs) and the
// scripted Sample-mode answers, written from the same synthetic numbers the screens show.
import type { CohortMember, PayCell, PersonaBundle, PersonaId, TeamRow } from './types';

export type AiKind = 'pay-explain' | 'voice-summary' | 'team-brief';

export function aiSteps(kind: AiKind, persona: PersonaId): string[] {
  const role = { hrbp: 'WI_HRBP_ROLE', comp: 'WI_COMP_ROLE', chro: 'WI_CHRO_ROLE' }[persona];
  if (kind === 'pay-explain') return [
    `Reading PAY_EQUITY_CELLS as ${role}`,
    persona === 'chro' ? 'Small-cell masking policy hides gaps for groups under 10' : 'Row access and masking policies applied',
    'Explaining the adjusted gap with AI_COMPLETE',
  ];
  if (kind === 'voice-summary') return persona === 'chro'
    ? [`Counting themes and sentiment in SURVEY_AI as ${role}`, 'Aggregation policy: groups under 10 merged', 'Summarizing aggregate counts with AI_COMPLETE (AI_AGG is blocked for this role)']
    : [`Reading 2026-09 survey comments in SURVEY_AI as ${role}`, persona === 'hrbp' ? 'Row access policy: Operations comments only' : 'Row access policy: all business units', 'Summarizing themes across comments with AI_AGG'];
  return [
    `Reading EMPLOYEE_RISK and V_OPEN_REQS for the team as ${role}`,
    'Weighting drivers by ATTRITION_MODEL feature importance',
    'Drafting a conversation plan with AI_COMPLETE',
  ];
}

export const aiCapability = (kind: AiKind, persona: PersonaId) =>
  kind === 'voice-summary' ? (persona === 'chro' ? 'AI_COMPLETE' : 'AI_AGG') : 'AI_COMPLETE';

const pct = (x: number | null) => (x === null ? 'suppressed' : `${x > 0 ? '+' : ''}${x.toFixed(1)}%`);

export function samplePayExplain(cell: PayCell, cohort: CohortMember[] | null, persona: PersonaId): string {
  if (cell.suppressed || cell.adjustedGap === null) {
    return `**${cell.family} · ${cell.level}** has fewer than 10 women or 10 men (${cell.nFemale} and ${cell.nMale}), so the small-cell masking policy hides its gap from this role. With groups that small, one or two people can swing the number, and the gap could identify individuals.\n\n**Suggested next step:** ask a compensation analyst to review the cell with full detail, or roll it up with the adjacent level.`;
  }
  const strong = Math.abs(cell.adjustedGap) >= 3;
  const below = cohort ? cohort.filter((c) => c.gender === 'Female' && c.compa < 0.95).length : null;
  return [
    `**${cell.family} · ${cell.level}** shows a raw gap of **${pct(cell.rawGap)}** and an adjusted gap of **${pct(cell.adjustedGap)}** for women relative to men (${cell.nFemale} women, ${cell.nMale} men).`,
    strong
      ? 'The adjusted figure controls for tenure and latest performance rating. Because the gap barely moves after those controls, tenure mix and ratings don\'t explain it on this synthetic data set.'
      : 'After controlling for tenure and latest rating, the gap is small and within the range seen across other cells.',
    strong && below !== null ? `In this cell, ${below} women sit below 95% of band midpoint.` : '',
    strong
      ? '**Suggested next steps:** confirm job-code mapping and recent hires in the cell, review starting offers for the last two years, and model the cost of moving affected employees to their cohort median. Route findings through counsel before any action.'
      : '**Suggested next step:** keep monitoring this cell each cycle.',
    persona === 'chro' ? '_Built from aggregates only. Individual records aren\'t visible to this role._' : '',
  ].filter(Boolean).join('\n\n');
}

export function sampleVoiceSummary(b: PersonaBundle): string {
  const v = b.voice;
  const top = v.themes.slice(0, 3);
  const ops = v.familyShift.find((f) => f.family === 'Payment Operations');
  const lines = [
    `Across ${v.commentCount.toLocaleString()} comments in the 2026-09 survey${b.persona === 'hrbp' ? ' for Operations' : ''}, the most frequent themes are **${top.map((t) => t.theme.toLowerCase()).join('**, **')}**.`,
    ops ? `**Payment Operations stands out:** ${ops.schedulePct}% of its comments are about schedules and shifts, and most are negative. Employees describe the move to rotating shifts in May 2026 as making childcare and life outside work hard to plan, and several say they're looking for roles with fixed hours. That lines up with the rise in voluntary exits in the same job family.` : '',
    'Other recurring points: open roles leaving teams to cover extra work, and pay that people feel hasn\'t kept up with nearby employers.',
    '**Suggested next steps:** review shift-pattern options with Payment Operations leaders (fixed-shift pods, shift differential, longer schedule notice), and check back in the next pulse survey.',
    b.persona === 'chro' ? '_Summarized from theme and sentiment counts only. Comment text isn\'t visible to this role._' : '',
  ];
  return lines.filter(Boolean).join('\n\n');
}

export function sampleTeamBrief(t: TeamRow): string {
  const d = t.drivers.map((x) => x.driver.toLowerCase());
  return [
    `**${t.team}** has an average modeled risk of **${Math.round(t.avgRisk * 100)}%**, with ${t.highRisk} of ${t.size} people in the high band. The top drivers are ${d.join(', ')}.`,
    t.openReqs60 ? `The team has ${t.openReqs60} open requisitions older than 60 days, so the people who stay are likely covering the gaps.` : '',
    '**Conversation plan for the HRBP**',
    `1. Meet with ${t.manager.split(' ')[0]} (manager) to confirm what the team is experiencing. Start from the drivers, not from individual scores.`,
    d.some((x) => x.includes('shift')) ? '2. Review the rotating-shift pattern: notice period, weekend frequency, and whether fixed-shift options exist.' : d.some((x) => x.includes('pay')) ? '2. Ask the compensation team to review band position for the team\'s roles.' : '2. Review workload and development opportunities with the manager.',
    t.openReqs60 ? '3. Prioritize the aged requisitions with Talent Acquisition, or approve temporary coverage.' : '3. Schedule a follow-up after the next pulse survey.',
    '_Risk scores are illustrative and aggregated to the team. Don\'t use them for decisions about individual employees._',
  ].filter(Boolean).join('\n\n');
}

// Ask HR data: scripted answers for the suggested questions, by persona.
export const CHAT_SUGGESTIONS = [
  'How many open reqs in Operations are older than 60 days?',
  'Why are people leaving Payment Operations?',
  'What is the average base salary in Payment Operations?',
  'How many open reqs in Technology are older than 60 days?',
];
export const CHAT_STEPS = (persona: PersonaId) => [
  'Planning with Cortex Agent (WORKFORCE_AGENT)',
  `Generating SQL with Cortex Analyst over WORKFORCE_SV as ${{ hrbp: 'WI_HRBP_ROLE', comp: 'WI_COMP_ROLE', chro: 'WI_CHRO_ROLE' }[persona]}`,
  'Running the query on WORKFORCE_INTEL_WH with policies applied',
  'Composing the answer',
];

export function sampleChat(q: string, b: PersonaBundle): string {
  const a = b.answers;
  const s = q.toLowerCase();
  if (s.includes('technology')) {
    if (b.persona === 'hrbp') return 'I can\'t give you a number for Technology. Your role\'s row access policy only returns Operations data, so Technology requisitions are hidden from you. A colleague with access to Technology would need to pull that count.';
    return `Technology has **${a.techReqs60} open requisitions older than 60 days**, out of ${a.techOpenReqs} open in total. Operations, for comparison, has ${a.opsReqs60}.`;
  }
  if (s.includes('open req')) {
    const fam = Object.entries(a.opsReqs60ByFamily).sort((x, y) => y[1] - x[1]).map(([f, n]) => `${f} (${n})`).join(', ');
    return `Operations has **${a.opsReqs60} open requisitions older than 60 days**, as of 2026-10-31. By job family: ${fam}. Most of the Payment Operations reqs are backfills opened after the May 2026 schedule change.`;
  }
  if (s.includes('salary') || s.includes('pay')) {
    const k = (x: number) => `$${(x / 1000).toFixed(1)}k`;
    if (b.persona === 'hrbp') return `Average base salary in Payment Operations is **${k(a.payOpsAvgBaseMasked)}** across ${a.payOpsHeadcount} active employees. Pay is masked to $10k bands for your role, so this average comes from banded values and runs low. A compensation analyst sees exact figures.`;
    return `Average base salary in Payment Operations is **${k(a.payOpsAvgBase)}** across ${a.payOpsHeadcount} active employees.${b.persona === 'chro' ? ' This is an aggregate over a group well above the minimum size of 10.' : ''}`;
  }
  if (s.includes('leav') || s.includes('exit') || s.includes('why')) {
    return `**${a.payOpsVolSinceChange} people** have left Payment Operations voluntarily since the May 2026 move to rotating shifts. The top exit reason is **"${a.payOpsTopReason}"**, well ahead of career opportunity and compensation. The same theme dominates the 2026-09 survey comments for the job family.`;
  }
  return 'In Sample mode I can answer the suggested questions. Switch to Live mode to ask Cortex Agent anything about headcount, exits, or requisitions.';
}
