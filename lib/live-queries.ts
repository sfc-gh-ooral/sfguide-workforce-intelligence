// Live mode: builds the same screen shapes as the sample bundles, from Snowflake, under the persona's
// role. Every query uses bind variables. Queries a CHRO can run use only COUNT, SUM, and AVG with
// GROUP BY and no window functions, which is what the aggregation policy MIN_GROUP_10 allows.
import { query } from './snowflake';
import type {
  AggGroup, Attrition, BelowBand, BuRow, CohortMember, Driver, FamilyAttrition, Overview, PayCell,
  PayEquity, PersonaId, Req, TeamDetail, TeamRow, TrendPoint, Voice,
} from './types';

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const r1 = (x: number) => Math.round(x * 10) / 10;
const AS_OF = '2026-10-31';
const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 10 + i, 1));
  return d.toISOString().slice(0, 7);
});
const BUS = ['Retail Banking', 'Commercial Banking', 'Wealth Management', 'Operations', 'Technology', 'Risk & Finance'];

// ---------------------------------------------------------------- overview
export async function liveOverview(p: PersonaId): Promise<Overview> {
  const [hc, hires, exits, vol, buHc, buHires, buExits, buVol, reqs, famHc, famVol] = await Promise.all([
    query(p, `SELECT TO_CHAR(m.month_start, 'YYYY-MM') AS M, COUNT(*) AS N FROM V_MONTHS m
              JOIN V_WORKFORCE w ON w.hire_date <= m.month_end AND (w.termination_date IS NULL OR w.termination_date > m.month_end)
              GROUP BY 1`),
    query(p, `SELECT TO_CHAR(DATE_TRUNC('month', hire_date), 'YYYY-MM') AS M, COUNT(*) AS N FROM EMPLOYEES WHERE hire_date >= ? GROUP BY 1`, ['2024-11-01']),
    query(p, `SELECT TO_CHAR(exit_month, 'YYYY-MM') AS M, COUNT(*) AS N FROM V_EXITS WHERE termination_date >= ? GROUP BY 1`, ['2024-11-01']),
    query(p, `SELECT TO_CHAR(exit_month, 'YYYY-MM') AS M, COUNT(*) AS N FROM V_EXITS WHERE termination_date >= ? AND termination_type = ? GROUP BY 1`, ['2024-11-01', 'Voluntary']),
    query(p, `SELECT business_unit AS K, COUNT(*) AS N FROM EMPLOYEES WHERE status = 'Active' GROUP BY 1`),
    query(p, `SELECT business_unit AS K, COUNT(*) AS N FROM EMPLOYEES WHERE hire_date > DATEADD('day', -365, ?::DATE) GROUP BY 1`, [AS_OF]),
    query(p, `SELECT business_unit AS K, COUNT(*) AS N FROM TERMINATIONS WHERE termination_date > DATEADD('day', -365, ?::DATE) GROUP BY 1`, [AS_OF]),
    query(p, `SELECT business_unit AS K, COUNT(*) AS N FROM TERMINATIONS WHERE termination_date > DATEADD('day', -365, ?::DATE) AND termination_type = 'Voluntary' GROUP BY 1`, [AS_OF]),
    query(p, `SELECT business_unit AS K, COUNT_IF(status = 'Open') AS OPEN, COUNT_IF(status = 'Open' AND age_days > 60) AS OPEN60,
                     AVG(IFF(filled_date >= DATEADD('day', -365, ?::DATE), days_to_fill, NULL)) AS TTF,
                     SUM(IFF(filled_date >= DATEADD('day', -365, ?::DATE), days_to_fill, 0)) AS TTF_SUM,
                     COUNT_IF(filled_date >= DATEADD('day', -365, ?::DATE)) AS TTF_N
              FROM V_OPEN_REQS GROUP BY 1`, [AS_OF, AS_OF, AS_OF]),
    query(p, `SELECT job_family AS F, business_unit AS B, COUNT(*) AS N FROM EMPLOYEES WHERE status = 'Active' GROUP BY 1, 2`),
    query(p, `SELECT job_family AS F, termination_date > DATEADD('day', -183, ?::DATE) AS RECENT, COUNT(*) AS N FROM V_EXITS
              WHERE termination_type = 'Voluntary' AND termination_date > DATEADD('day', -365, ?::DATE) GROUP BY 1, 2`, [AS_OF, AS_OF]),
  ]);
  const byMonth = (rows: Row[]) => Object.fromEntries(rows.map((r) => [str(r.M), num(r.N)]));
  const byKey = (rows: Row[]) => Object.fromEntries(rows.map((r) => [str(r.K), num(r.N)]));
  const H = byMonth(hc), HI = byMonth(hires), EX = byMonth(exits), VO = byMonth(vol);
  const trend: TrendPoint[] = MONTHS.map((m) => ({ month: m, headcount: H[m] ?? 0, hires: HI[m] ?? 0, exits: EX[m] ?? 0, voluntary: VO[m] ?? 0, attrition12m: null }));
  trend.forEach((t, i) => {
    if (i < 11) return;
    const win = trend.slice(i - 11, i + 1);
    const avg = win.reduce((s, x) => s + x.headcount, 0) / 12;
    t.attrition12m = avg ? r1((win.reduce((s, x) => s + x.exits, 0) / avg) * 100) : null;
  });
  const bh = byKey(buHc), bhi = byKey(buHires), bex = byKey(buExits), bvo = byKey(buVol);
  const rq = Object.fromEntries(reqs.map((r) => [str(r.K), r]));
  const byBu: BuRow[] = BUS.filter((b) => bh[b]).map((b) => ({
    bu: b, headcount: bh[b], hires: bhi[b] ?? 0, exits: bex[b] ?? 0,
    attrition: r1(((bex[b] ?? 0) / bh[b]) * 100), voluntaryAttrition: r1(((bvo[b] ?? 0) / bh[b]) * 100),
    openReqs: num(rq[b]?.OPEN), timeToFill: Math.round(num(rq[b]?.TTF)),
  }));
  const vol6: Record<string, { recent: number; prior: number }> = {};
  for (const r of famVol) {
    const f = str(r.F); vol6[f] ??= { recent: 0, prior: 0 };
    if (r.RECENT === true || r.RECENT === 'true') vol6[f].recent += num(r.N); else vol6[f].prior += num(r.N);
  }
  const familyAttrition: FamilyAttrition[] = famHc.map((r) => {
    const f = str(r.F), v = vol6[f] ?? { recent: 0, prior: 0 };
    return { family: f, bu: str(r.B), headcount: num(r.N), vol6m: v.recent, volPrior6m: v.prior, change: v.prior ? Math.round(((v.recent - v.prior) / v.prior) * 100) : null };
  }).filter((x) => x.family).sort((a, b) => b.vol6m / b.headcount - a.vol6m / a.headcount);
  const last12 = trend.slice(-12);
  const ttfSum = reqs.reduce((s, r) => s + num(r.TTF_SUM), 0), ttfN = reqs.reduce((s, r) => s + num(r.TTF_N), 0);
  return {
    kpis: {
      headcount: trend[23].headcount, hires12m: last12.reduce((s, x) => s + x.hires, 0), exits12m: last12.reduce((s, x) => s + x.exits, 0),
      attrition12m: trend[23].attrition12m, attritionPrior: trend[17].attrition12m,
      timeToFill: ttfN ? Math.round(ttfSum / ttfN) : 0,
      openReqs: reqs.reduce((s, r) => s + num(r.OPEN), 0), openReqs60: reqs.reduce((s, r) => s + num(r.OPEN60), 0),
    },
    trend, byBu, familyAttrition,
  };
}

// ---------------------------------------------------------------- attrition
// Team drivers: share of the team with each flag, weighted by the model's feature importance
// (FEATURE_IMPORTANCE from ATTRITION_MODEL!SHOW_FEATURE_IMPORTANCE).
const DRIVER_MAP: [string, string, string][] = [
  ['F_SHIFT', 'Rotating-shift schedule', 'WORK_SCHEDULE'],
  ['F_ENG', 'Low engagement score', 'LAST_ENGAGEMENT'],
  ['F_COMPA', 'Pay below band midpoint', 'COMPA_RATIO'],
  ['F_TENURE', 'Tenure under two years', 'TENURE_YEARS'],
  ['F_PROMO', 'No promotion in 3+ years', 'MONTHS_SINCE_PROMO'],
  ['F_SPAN', 'Manager span over 15', 'MANAGER_SPAN'],
  ['F_REQS', 'Open-req backlog on team', 'TEAM_OPEN_REQS_60'],
];

async function liveTeams(p: PersonaId, teamId?: string): Promise<TeamRow[]> {
  const where = teamId ? 'WHERE r.team_id = ?' : '';
  const binds = teamId ? [teamId] : [];
  const [rows, reqs, exits, fi] = await Promise.all([
    query(p, `SELECT r.team_id AS ID, t.team_name AS NAME, t.business_unit AS BU, t.job_family AS FAM, t.location AS LOC, t.manager_name AS MGR,
                     COUNT(*) AS N, AVG(r.risk) AS RISK, AVG(r.last_engagement) AS ENG, SUM(IFF(r.risk >= 0.35, 1, 0)) AS HIGH,
                     AVG(IFF(r.work_schedule = 'Rotating shifts', 1, 0)) AS F_SHIFT, AVG(IFF(r.last_engagement < 3, 1, 0)) AS F_ENG,
                     AVG(IFF(r.compa_ratio < 0.9, 1, 0)) AS F_COMPA, AVG(IFF(r.tenure_years < 2, 1, 0)) AS F_TENURE,
                     AVG(IFF(r.months_since_promo > 36, 1, 0)) AS F_PROMO, MAX(IFF(r.manager_span > 15, 1, 0)) AS F_SPAN,
                     MAX(IFF(r.team_open_reqs_60 > 0, 1, 0)) AS F_REQS, MAX(r.manager_span) AS SPAN
              FROM EMPLOYEE_RISK r JOIN V_TEAMS t ON t.team_id = r.team_id ${where}
              GROUP BY 1, 2, 3, 4, 5, 6 HAVING COUNT(*) >= 3 ORDER BY RISK DESC LIMIT 40`, binds),
    query(p, `SELECT hiring_manager_id AS ID, COUNT(*) AS OPEN, COUNT_IF(age_days > 60) AS OPEN60 FROM V_OPEN_REQS WHERE status = 'Open' GROUP BY 1`),
    query(p, `SELECT e.manager_id AS ID, COUNT(*) AS N FROM V_EXITS x JOIN EMPLOYEES e ON e.employee_id = x.employee_id
              WHERE x.termination_type = 'Voluntary' AND x.termination_date > DATEADD('day', -365, ?::DATE) GROUP BY 1`, [AS_OF]),
    query(p, `SELECT FEATURE AS F, SCORE AS S FROM FEATURE_IMPORTANCE`),
  ]);
  const imp = Object.fromEntries(fi.map((r) => [str(r.F), num(r.S)]));
  const rq = Object.fromEntries(reqs.map((r) => [str(r.ID), r]));
  const ex = Object.fromEntries(exits.map((r) => [str(r.ID), num(r.N)]));
  return rows.map((r) => {
    const id = str(r.ID);
    const drivers: Driver[] = DRIVER_MAP.map(([col, label, feat]) => ({ driver: label, weight: Math.round(num(r[col]) * (imp[feat] ?? 0) * 100) / 100 }))
      .filter((d) => d.weight >= 0.01).sort((a, b) => b.weight - a.weight).slice(0, 3);
    return {
      teamId: id, team: str(r.NAME), bu: str(r.BU), family: str(r.FAM), location: str(r.LOC), manager: str(r.MGR),
      size: num(r.N), span: num(r.SPAN), avgRisk: Math.round(num(r.RISK) * 1000) / 1000, highRisk: num(r.HIGH),
      volExits12m: ex[id] ?? 0, openReqs: num(rq[id]?.OPEN), openReqs60: num(rq[id]?.OPEN60),
      avgEngagement: Math.round(num(r.ENG) * 100) / 100, drivers,
    };
  });
}

export async function liveAttrition(p: PersonaId): Promise<Attrition> {
  if (p === 'chro') {
    // The aggregation policy merges every group under 10 people into one remainder row with NULL keys.
    const rows = await query(p, `SELECT job_family AS F, location AS L, job_level AS LV, COUNT(*) AS N, AVG(risk) AS R
                                 FROM EMPLOYEE_RISK GROUP BY 1, 2, 3`);
    const rem = rows.find((r) => r.F === null || r.F === undefined);
    const fam2bu = await query(p, `SELECT job_family AS F, business_unit AS B, COUNT(*) AS N FROM EMPLOYEE_RISK GROUP BY 1, 2`);
    const bu = Object.fromEntries(fam2bu.filter((r) => r.F).map((r) => [str(r.F), str(r.B)]));
    const groups: AggGroup[] = rows.filter((r) => r.F).map((r) => ({
      group: `${str(r.F)} · ${str(r.L)} · ${str(r.LV)}`, bu: bu[str(r.F)] ?? '', family: str(r.F), location: str(r.L), level: str(r.LV),
      size: num(r.N), avgRisk: Math.round(num(r.R) * 1000) / 1000,
    })).sort((a, b) => b.avgRisk - a.avgRisk).slice(0, 40);
    return { mode: 'aggregate', minGroup: 10, groups, remainder: { size: num(rem?.N), avgRisk: Math.round(num(rem?.R) * 1000) / 1000, groupsMerged: -1 } };
  }
  const [teams, spans] = await Promise.all([
    liveTeams(p),
    query(p, `SELECT t.manager_name AS M, t.team_name AS T, COUNT(*) AS N FROM EMPLOYEES e JOIN V_TEAMS t ON t.team_id = e.manager_id
              WHERE e.status = 'Active' GROUP BY 1, 2 HAVING COUNT(*) > 15 ORDER BY 3 DESC`),
  ]);
  return { mode: 'teams', teams, details: {}, wideSpans: spans.map((r) => ({ manager: str(r.M), team: str(r.T), span: num(r.N) })) };
}

export async function liveTeamDetail(p: PersonaId, teamId: string): Promise<TeamDetail | null> {
  const [row] = await liveTeams(p, teamId);
  if (!row) return null;
  const [reqs, bands, emps] = await Promise.all([
    query(p, `SELECT req_id, job_family, location, job_level, opened_date, status, age_days FROM V_OPEN_REQS
              WHERE hiring_manager_id = ? AND status = 'Open' ORDER BY age_days DESC`, [teamId]),
    query(p, `SELECT CASE WHEN risk < 0.2 THEN 'Low (<20%)' WHEN risk < 0.35 THEN 'Elevated (20–35%)' ELSE 'High (≥35%)' END AS B, COUNT(*) AS N
              FROM EMPLOYEE_RISK WHERE team_id = ? GROUP BY 1`, [teamId]),
    // The app shows named employees only to the compensation analyst persona.
    p === 'comp'
      ? query(p, `SELECT r.employee_id AS ID, w.full_name AS NAME, r.job_level AS LV, r.tenure_years AS T, r.last_rating AS RT, r.last_engagement AS E,
                         r.compa_ratio AS C, w.base_salary AS B, r.months_since_promo AS MP, r.risk AS R
                  FROM EMPLOYEE_RISK r JOIN V_WORKFORCE w ON w.employee_id = r.employee_id WHERE r.team_id = ? ORDER BY r.risk DESC`, [teamId])
      : Promise.resolve(null),
  ]);
  const bandMap = Object.fromEntries(bands.map((b) => [str(b.B), num(b.N)]));
  return {
    ...row,
    reqs: reqs.map((r) => ({ req_id: str(r.REQ_ID), job_family: str(r.JOB_FAMILY), location: str(r.LOCATION), level: str(r.JOB_LEVEL), opened_date: str(r.OPENED_DATE).slice(0, 10), status: str(r.STATUS), age: num(r.AGE_DAYS) } as Req)),
    riskBands: ['Low (<20%)', 'Elevated (20–35%)', 'High (≥35%)'].map((label) => ({ label, count: bandMap[label] ?? 0 })),
    employees: emps ? emps.map((e) => ({ id: str(e.ID), name: str(e.NAME), level: str(e.LV), tenure: num(e.T), rating: num(e.RT), engagement: num(e.E), compa: num(e.C), base: num(e.B), monthsSincePromo: num(e.MP), risk: num(e.R) })) : null,
  };
}

// ---------------------------------------------------------------- pay equity
const band10 = (x: number) => { const lo = Math.floor(x / 10000) * 10; return `$${lo}k–$${lo + 10}k`; };

export async function livePayEquity(p: PersonaId): Promise<PayEquity> {
  if (p === 'hrbp') {
    // PAY_MASK returns base pay rounded down to $10k; PROTECTED_ATTR_MASK returns ***.
    const [dist, sample] = await Promise.all([
      query(p, `SELECT base_salary AS B, COUNT(*) AS N FROM V_WORKFORCE WHERE status = 'Active' GROUP BY 1 ORDER BY 1`),
      query(p, `SELECT employee_id AS ID, full_name AS NAME, job_family AS F, job_level AS L, base_salary AS B, gender AS G, ethnicity AS E
                FROM V_WORKFORCE WHERE status = 'Active' AND NOT is_manager ORDER BY employee_id LIMIT 8`),
    ]);
    return {
      mode: 'masked',
      bandDistribution: dist.map((r) => ({ band: band10(num(r.B)), count: num(r.N), lo: num(r.B) / 1000 })).slice(0, 14),
      sample: sample.map((r) => ({ id: str(r.ID), name: str(r.NAME), family: str(r.F), level: str(r.L), salary: band10(num(r.B)), gender: str(r.G), ethnicity: str(r.E) })),
    };
  }
  const [cells, hc, below] = await Promise.all([
    query(p, `SELECT job_family AS F, job_level AS L, business_unit AS B, n_female AS NF, n_male AS NM, raw_gap_pct AS RAW, adjusted_gap_pct AS ADJ, median_base AS MED
              FROM PAY_EQUITY_CELLS ORDER BY adjusted_gap_pct NULLS LAST`),
    query(p, `SELECT job_family AS F, job_level AS L, business_unit AS B, COUNT(*) AS N, AVG(compa_ratio) AS C FROM V_WORKFORCE WHERE status = 'Active' GROUP BY 1, 2, 3`),
    query(p, `SELECT job_family AS F, job_level AS L, COUNT(*) AS N FROM V_WORKFORCE WHERE status = 'Active' AND base_salary < band_min GROUP BY 1, 2`),
  ]);
  const payCells: PayCell[] = cells.map((r) => {
    const suppressed = r.ADJ === null || r.ADJ === undefined; // SMALL_CELL_GAP_MASK returned NULL
    return { family: str(r.F), level: str(r.L), bu: str(r.B), nFemale: num(r.NF), nMale: num(r.NM), rawGap: suppressed ? null : num(r.RAW), adjustedGap: suppressed ? null : num(r.ADJ), medianBase: suppressed ? null : num(r.MED), ...(p === 'chro' ? { suppressed } : {}) };
  });
  const hcMap = Object.fromEntries(hc.filter((r) => r.F).map((r) => [`${str(r.F)}|${str(r.L)}`, r]));
  const belowBand: BelowBand[] = below.filter((r) => r.F).map((r) => {
    const h = hcMap[`${str(r.F)}|${str(r.L)}`];
    return { family: str(r.F), level: str(r.L), bu: str(h?.B), headcount: num(h?.N), belowBand: num(r.N), avgCompa: Math.round(num(h?.C) * 1000) / 1000 };
  }).sort((a, b) => b.belowBand - a.belowBand).slice(0, 10);
  return p === 'chro' ? { mode: 'aggregate', minGroup: 10, cells: payCells, belowBand } : { mode: 'full', cells: payCells, belowBand };
}

export async function liveCohort(p: PersonaId): Promise<CohortMember[] | null> {
  if (p !== 'comp') return null;
  const rows = await query(p, `SELECT w.employee_id AS ID, w.full_name AS NAME, w.gender AS G, w.tenure_years AS T, r.last_rating AS RT,
                                      w.base_salary AS B, w.compa_ratio AS C, w.location AS L
                               FROM V_WORKFORCE w JOIN EMPLOYEE_RISK r ON r.employee_id = w.employee_id
                               WHERE w.job_family = ? AND w.job_level = ? AND w.gender IN ('Female', 'Male') ORDER BY w.compa_ratio`, ['Software Engineering', 'L4']);
  return rows.map((r) => ({ id: str(r.ID), name: str(r.NAME), gender: str(r.G), tenure: num(r.T), rating: num(r.RT), base: num(r.B), compa: num(r.C), location: str(r.L) }));
}

// ---------------------------------------------------------------- voice of employee
export const LATEST_CYCLE = '2026-09 Annual';
export async function liveVoice(p: PersonaId): Promise<Voice> {
  const [themes, sents, eng, latest, fam, comments] = await Promise.all([
    query(p, `SELECT cycle AS C, theme AS T, COUNT(*) AS N FROM SURVEY_AI GROUP BY 1, 2`),
    query(p, `SELECT cycle AS C, sentiment AS S, COUNT(*) AS N FROM SURVEY_AI GROUP BY 1, 2`),
    query(p, `SELECT cycle AS C, AVG(engagement_score) AS E FROM ENGAGEMENT_SURVEY GROUP BY 1`),
    query(p, `SELECT theme AS T, sentiment AS S, COUNT(*) AS N FROM SURVEY_AI WHERE cycle = ? GROUP BY 1, 2`, [LATEST_CYCLE]),
    query(p, `SELECT job_family AS F, theme = 'Schedules and shifts' AS SCHED, COUNT(*) AS N FROM SURVEY_AI WHERE cycle = ? GROUP BY 1, 2`, [LATEST_CYCLE]),
    p === 'chro' ? Promise.resolve([]) :
      query(p, `SELECT s.response_id AS ID, s.job_family AS F, e.location AS L, s.theme AS T, s.sentiment AS S, s.comment AS X
                FROM SURVEY_AI s JOIN EMPLOYEES e ON e.employee_id = s.employee_id WHERE s.cycle = ?
                ORDER BY (s.job_family = 'Payment Operations') DESC, s.response_id LIMIT 14`, [LATEST_CYCLE]),
  ]);
  const cycles = ['2025-03 Pulse', '2025-09 Annual', '2026-03 Pulse', LATEST_CYCLE];
  const names = [...new Set(themes.map((r) => str(r.T)).filter(Boolean))];
  const themeTrend = cycles.map((c) => {
    const o: Record<string, string | number> = { cycle: c };
    for (const t of names) o[t] = num(themes.find((r) => r.C === c && r.T === t)?.N);
    return o;
  });
  const e = Object.fromEntries(eng.map((r) => [str(r.C), num(r.E)]));
  const sentimentTrend = cycles.map((c) => {
    const f = (s: string) => sents.filter((r) => r.C === c && r.S === s).reduce((a, r) => a + num(r.N), 0);
    return { cycle: c, positive: f('positive'), neutral: f('neutral') + f('mixed'), negative: f('negative'), engagement: Math.round((e[c] ?? 0) * 100) / 100 };
  });
  const themeList = names.map((t) => {
    const rows = latest.filter((r) => r.T === t);
    const total = rows.reduce((a, r) => a + num(r.N), 0);
    const neg = rows.filter((r) => r.S === 'negative').reduce((a, r) => a + num(r.N), 0);
    return { theme: t, mentions: total, negativeShare: total ? Math.round((neg / total) * 100) : 0 };
  }).sort((a, b) => b.mentions - a.mentions);
  const fams: Record<string, { all: number; sched: number }> = {};
  for (const r of fam) {
    if (!r.F) continue;
    const f = str(r.F); fams[f] ??= { all: 0, sched: 0 };
    fams[f].all += num(r.N); if (r.SCHED === true || r.SCHED === 'true') fams[f].sched += num(r.N);
  }
  const familyShift = Object.entries(fams).filter(([, v]) => v.all >= 10)
    .map(([family, v]) => ({ family, comments: v.all, schedulePct: Math.round((v.sched / v.all) * 100) }))
    .sort((a, b) => b.schedulePct - a.schedulePct).slice(0, 8);
  return {
    cycles, themeTrend, sentimentTrend, themes: themeList, familyShift,
    comments: comments.map((r) => ({ responseId: str(r.ID), family: str(r.F), location: str(r.L), theme: str(r.T), sentiment: str(r.S), text: str(r.X) })),
    commentCount: latest.reduce((a, r) => a + num(r.N), 0),
  };
}
