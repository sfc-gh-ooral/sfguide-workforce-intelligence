// Seeded, deterministic synthetic HR data for the Workforce Intelligence pack.
// Writes data/*.csv (loaded by sql/setup.sql) and data/sample/*.json (the app's no-account mode).
// Same seed, same output: `npm run generate` reproduces every number in the screenshots.
// All people, names, and demographics are synthetic. Nothing here is derived from real HR data.
import { mkdirSync, writeFileSync } from 'node:fs';

const SEED = 20261119;
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const normal = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; };

// ---------- calendar ----------
const AS_OF = new Date(Date.UTC(2026, 9, 31)); // 2026-10-31, the data set's "today"
const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const monthStart = (y, m) => new Date(Date.UTC(y, m, 1));
const MONTHS = []; // Nov 2024 .. Oct 2026
for (let i = 0; i < 24; i++) MONTHS.push(monthStart(2024, 10 + i));
const SCHEDULE_CHANGE = monthStart(2026, 4); // May 2026: Payment Operations moves to rotating shifts

// ---------- org structure ----------
const BUS = [
  { bu: 'Retail Banking', w: 0.22, families: [['Branch Banking', 0.45, 0.85], ['Relationship Banking', 0.30, 1.0], ['Contact Center', 0.25, 0.78]] },
  { bu: 'Commercial Banking', w: 0.12, families: [['Commercial Lending', 0.45, 1.15], ['Treasury Services', 0.30, 1.05], ['Credit Analysis', 0.25, 1.05]] },
  { bu: 'Wealth Management', w: 0.14, families: [['Financial Advisory', 0.40, 1.15], ['Client Service', 0.35, 0.86], ['Portfolio Management', 0.25, 1.25]] },
  { bu: 'Operations', w: 0.20, families: [['Payment Operations', 0.40, 0.82], ['Loan Operations', 0.35, 0.84], ['Reconciliation', 0.25, 0.88]] },
  { bu: 'Technology', w: 0.20, families: [['Software Engineering', 0.45, 1.28], ['Data & Analytics', 0.30, 1.22], ['Infrastructure', 0.25, 1.15]] },
  { bu: 'Risk & Finance', w: 0.12, families: [['Risk Management', 0.40, 1.12], ['Compliance', 0.30, 1.05], ['Finance & Accounting', 0.30, 1.02]] },
];
const FAMILY_MULT = Object.fromEntries(BUS.flatMap((b) => b.families.map(([f, , m]) => [f, m])));
const FAMILY_BU = Object.fromEntries(BUS.flatMap((b) => b.families.map(([f]) => [f, b.bu])));
const LOCATIONS = [['Charlotte', 0.24], ['New York', 0.16], ['Chicago', 0.12], ['Dallas', 0.13], ['Phoenix', 0.10], ['Minneapolis', 0.09], ['Jacksonville', 0.10], ['Denver', 0.06]];
const LEVELS = [['L1', 0.20], ['L2', 0.29], ['L3', 0.26], ['L4', 0.15], ['L5', 0.07], ['L6', 0.025], ['L7', 0.005]];
const LEVEL_MID = { L1: 52000, L2: 68000, L3: 88000, L4: 115000, L5: 148000, L6: 190000, L7: 265000 };
const BONUS_PCT = { L1: 0.03, L2: 0.05, L3: 0.07, L4: 0.10, L5: 0.15, L6: 0.20, L7: 0.30 };
const GENDERS = [['Female', 0.49], ['Male', 0.495], ['Non-binary', 0.015]];
const ETHNICITIES = [['White', 0.52], ['Black', 0.14], ['Hispanic or Latino', 0.16], ['Asian', 0.12], ['Two or more', 0.04], ['Not disclosed', 0.02]];

const FIRST_F = ['Ava','Maya','Priya','Elena','Grace','Nora','Lena','Hana','Sofia','Clara','Isla','Leah','Mina','Tessa','Rosa','Julia','Amara','Keiko','Naomi','Ivy','Zara','Lucia','Freya','Dana','Erin','Fiona','Gia','Helen','Imani','Jade','Kara','Lila','Mara','Nia','Olive','Paige','Quinn','Rhea','Sana','Talia'];
const FIRST_M = ['Liam','Noah','Arjun','Mateo','Owen','Ethan','Kai','Leo','Omar','Ravi','Theo','Diego','Felix','Hugo','Ivan','Jonah','Kofi','Luca','Marcus','Nikhil','Oscar','Pablo','Rafael','Samir','Tomas','Victor','Wes','Xavier','Yusuf','Zane','Andre','Ben','Cole','Dev','Eli','Finn','Gabe','Hiro','Isaac','Jude'];
const FIRST_X = ['Alex','Jordan','Riley','Sam','Avery','Morgan','Rowan','Sky'];
const LAST = ['Okafor','Lindqvist','Ramirez','Chen','Patel','Nakamura','Haddad','Kowalski','Mensah','Delgado','Fischer','Novak','Ibrahim','Moreau','Silva','Brennan','Castillo','Duarte','Eriksen','Farouk','Gallagher','Horvath','Iqbal','Jansen','Kaur','Larsen','Mbeki','Nguyen','Oduya','Petrov','Quintero','Rossi','Sato','Tanaka','Ulrich','Varga','Whitfield','Xu','Yilmaz','Zielinski','Abernathy','Bianchi','Carver','Dubois','Ellison','Ferreira','Grummet','Holloway','Iversen','Juarez','Kim','Laurent','Marsh','Navarro','Osei','Prescott','Reyes','Sandoval','Thorne','Vance'];

const LEVEL_N = (l) => Number(l.slice(1));

// ---------- people ----------
const N_TOTAL = 15500;
const people = [];
const usedNames = new Set();
function makeName(gender) {
  for (;;) {
    const first = gender === 'Female' ? pick(FIRST_F) : gender === 'Male' ? pick(FIRST_M) : pick(FIRST_X);
    const name = `${first} ${'ABCDEFGHJKLMNPRSTW'[Math.floor(rnd() * 18)]}. ${pick(LAST)}`;
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
}

for (let i = 0; i < N_TOTAL; i++) {
  const b = weighted(BUS.map((x) => [x, x.w]));
  const family = weighted(b.families.map(([f, w]) => [f, w]));
  const location = weighted(LOCATIONS);
  let level = weighted(LEVELS);
  const gender = weighted(GENDERS);
  // Tenure: mostly exponential, mean ~6 years; a share of hires lands inside the 24-month window.
  const tenureYears = rnd() < 0.05 ? rnd() * 2 : Math.min(30, -Math.log(1 - rnd()) * 7.6 + 0.4);
  const hire = addDays(AS_OF, -Math.round(tenureYears * 365));
  people.push({
    id: `E${String(100001 + i)}`, name: makeName(gender), bu: b.bu, family, location, level, gender,
    ethnicity: weighted(ETHNICITIES), remote: rnd() < (family === 'Software Engineering' || family === 'Data & Analytics' ? 0.35 : 0.12),
    hire, term: null, termType: null, termReason: null, managerId: null, isManager: false,
    // Latent traits drive both exit risk and later engagement and pay, so the live model has real signal.
    engLatent: normal(), payLatent: normal(),
  });
}

// Story 3 team: Wealth Management / Client Service / Charlotte. Make sure the cell exists and is well staffed.
const STORY_TEAM_CELL = ['Wealth Management', 'Client Service', 'Charlotte'];
for (const p of people.filter((p) => p.bu === 'Wealth Management' && p.family === 'Client Service').slice(0, 30)) p.location = 'Charlotte';
// The story team's members: still employed, but with the low-engagement, low-pay profile that predicts exits.
const storyCandidates = people.filter((p) => p.bu === 'Wealth Management' && p.family === 'Client Service' && p.location === 'Charlotte' && p.hire < addDays(AS_OF, -400)).slice(0, 13);
for (const p of storyCandidates) { p.storyCandidate = true; p.engLatent = -1.7 - rnd() * 0.4; p.payLatent = -1.6; }

// ---------- exits over the 24-month window ----------
function volHazard(p, m) {
  if (p.storyCandidate) return 0;
  let h = 0.0052 * Math.exp(-0.95 * p.engLatent - 0.6 * p.payLatent);
  if ((m - p.hire) / (365 * DAY) < 2) h *= 1.4;
  if (LEVEL_N(p.level) <= 2) h *= 1.25;
  if (p.family === 'Payment Operations' && m >= SCHEDULE_CHANGE) h = 0.034 * Math.exp(-0.25 * p.engLatent); // story 1
  return h;
}
for (const p of people) {
  for (const m of MONTHS) {
    if (p.hire >= m || p.term) continue;
    const r = rnd();
    const mid = addDays(m, Math.floor(rnd() * 27));
    if (mid > AS_OF) continue;
    if (r < volHazard(p, m)) {
      p.term = mid; p.termType = 'Voluntary';
      p.termReason = p.family === 'Payment Operations' && m >= SCHEDULE_CHANGE
        ? weighted([['Schedule / work-life balance', 0.62], ['Career opportunity', 0.16], ['Compensation', 0.14], ['Relocation', 0.08]])
        : weighted([['Career opportunity', 0.38], ['Compensation', 0.24], ['Schedule / work-life balance', 0.12], ['Relocation', 0.12], ['Manager relationship', 0.14]]);
    } else if (r < volHazard(p, m) + 0.0018) {
      p.term = mid; p.termType = 'Involuntary';
      p.termReason = weighted([['Performance', 0.55], ['Restructuring', 0.30], ['Policy violation', 0.15]]);
    }
  }
}
const isActive = (p, d = AS_OF) => p.hire <= d && (!p.term || p.term > d);
const tenureAt = (p, d = AS_OF) => (d - p.hire) / (365 * DAY);

// ---------- managers and teams ----------
// In each BU x family x location cell, roughly one manager per 9 people. Managers report to the BU head.
const SPAN_STORY_CELLS = [
  ['Retail Banking', 'Contact Center', 'Phoenix'],
  ['Operations', 'Loan Operations', 'Jacksonville'],
  ['Retail Banking', 'Branch Banking', 'Dallas'],
  ['Technology', 'Infrastructure', 'Charlotte'],
]; // story 4: one manager in each of these cells has more than 15 direct reports
const buHeads = {};
for (const b of BUS) {
  const head = people.find((p) => p.bu === b.bu && isActive(p) && !p.isManager);
  head.level = 'L7'; head.isManager = true; head.family = b.families[0][0]; head.location = 'Charlotte';
  buHeads[b.bu] = head;
}
const cells = new Map();
for (const p of people) {
  if (Object.values(buHeads).includes(p)) continue;
  const k = `${p.bu}|${p.family}|${p.location}`;
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push(p);
}
const teams = new Map(); // managerId -> { manager, members[] }
for (const [k, members] of cells) {
  const active = members.filter((p) => isActive(p));
  if (active.length === 0) continue;
  const [bu, family, location] = k.split('|');
  const spanStory = SPAN_STORY_CELLS.some((c) => c.join('|') === k);
  const nMgr = Math.max(1, Math.round(active.length / 9));
  const sorted = [...active].sort((a, b) => a.hire - b.hire);
  const managers = sorted.slice(0, nMgr);
  for (const m of managers) {
    m.isManager = true;
    if (LEVEL_N(m.level) < 5) m.level = rnd() < 0.8 ? 'L5' : 'L6';
    m.managerId = buHeads[bu].id;
    teams.set(m.id, { manager: m, bu, family, location, members: [] });
  }
  const rest = members.filter((p) => !managers.includes(p));
  rest.forEach((p, i) => {
    if (p.level === 'L7' || p.level === 'L6') p.level = 'L4';
    // Story 4: the first manager in a span cell takes a much larger share.
    const mgr = managers[i % managers.length];
    p.managerId = mgr.id;
    teams.get(mgr.id).members.push(p);
  });
}
// Guarantee story 4 spans exceed 15 active reports by moving people from sibling teams in the cell.
for (const c of SPAN_STORY_CELLS) {
  const cellTeams = [...teams.values()].filter((t) => [t.bu, t.family, t.location].join('|') === c.join('|'));
  const big = cellTeams.sort((a, b) => b.members.length - a.members.length)[0];
  const target = 16 + Math.floor(rnd() * 5);
  for (const t of cellTeams) {
    if (t === big) continue;
    while (big.members.filter((p) => isActive(p)).length < target && t.members.filter((p) => isActive(p)).length > 4) {
      const mv = t.members.find((p) => isActive(p));
      t.members.splice(t.members.indexOf(mv), 1); big.members.push(mv); mv.managerId = big.manager.id;
    }
  }
}
// Story 3: one Charlotte Client Service team with ~12 people.
const storyTeam = [...teams.values()]
  .filter((t) => [t.bu, t.family, t.location].join('|') === STORY_TEAM_CELL.join('|'))
  .sort((a, b) => b.members.length - a.members.length)[0];
// Swap the preselected candidates into the story team (and its non-candidates out to their teams).
for (const c of storyCandidates.filter((x) => isActive(x) && !x.isManager && !storyTeam.members.includes(x))) {
  const from = teams.get(c.managerId);
  const out = storyTeam.members.find((x) => !x.storyCandidate);
  from.members.splice(from.members.indexOf(c), 1); storyTeam.members.push(c); c.managerId = storyTeam.manager.id;
  if (out) { storyTeam.members.splice(storyTeam.members.indexOf(out), 1); from.members.push(out); out.managerId = from.manager.id; }
}
for (const p of storyTeam.members) { if (!p.storyCandidate) continue; p.storyTeam = true; if (LEVEL_N(p.level) > 3) p.level = 'L2'; }
for (const head of Object.values(buHeads)) head.managerId = null;

const teamName = (t) => `${t.family} · ${t.location} (${t.manager.name.split(' ').pop()})`;

// ---------- compensation ----------
const PAY_GAP_CELL = ['Software Engineering', 'L4']; // story 2
for (const p of people) {
  const mid = Math.round(LEVEL_MID[p.level] * FAMILY_MULT[p.family] / 500) * 500;
  p.bandMin = Math.round(mid * 0.8); p.bandMid = mid; p.bandMax = Math.round(mid * 1.2);
}

// ---------- performance (four cycles) ----------
const CYCLES = ['2024H2', '2025H1', '2025H2', '2026H1'];
const CYCLE_DATE = { '2024H2': monthStart(2024, 11), '2025H1': monthStart(2025, 5), '2025H2': monthStart(2025, 11), '2026H1': monthStart(2026, 5) };
const performance = [];
for (const p of people) {
  const base = clamp(3 + normal() * 0.7, 1, 5);
  p.lastRating = null;
  for (const c of CYCLES) {
    if (p.hire > addDays(CYCLE_DATE[c], -90) || (p.term && p.term < CYCLE_DATE[c])) continue;
    const r = clamp(Math.round(base + normal() * 0.5), 1, 5);
    performance.push({ employee_id: p.id, business_unit: p.bu, cycle: c, rating: r });
    p.lastRating = r;
  }
  p.lastRating ??= 3;
}

// Base pay: position in band rises with tenure and rating; noise is small. Story 2 lowers pay for women
// in Software Engineering L4 by ~6.5% after tenure and rating, which the adjusted model still finds.
for (const p of people) {
  const t = tenureAt(p, p.term ?? AS_OF);
  let pos = 0.94 + Math.min(0.16, t * 0.018) + (p.lastRating - 3) * 0.03 + p.payLatent * 0.025 + normal() * 0.025;
  if (p.storyTeam) pos = 0.85 + normal() * 0.015;
  if (p.family === PAY_GAP_CELL[0] && p.level === PAY_GAP_CELL[1] && p.gender === 'Female') pos *= 0.935;
  if (p.family === 'Contact Center' && p.level === 'L1' && rnd() < 0.35) pos = 0.77 + rnd() * 0.02; // a below-band cohort
  p.base = Math.round((p.bandMid * pos) / 100) * 100;
  p.bonus = Math.round((p.base * BONUS_PCT[p.level] * clamp(0.6 + (p.lastRating - 1) * 0.2 + normal() * 0.1, 0, 1.6)) / 100) * 100;
  p.compa = round(p.base / p.bandMid, 3);
}

// ---------- promotions ----------
const promotions = [];
for (const p of people) {
  if (p.storyTeam) { p.lastPromo = null; continue; }
  p.lastPromo = null;
  const n = LEVEL_N(p.level);
  if (n >= 2 && tenureAt(p) > 1.2 && rnd() < 0.55) {
    const back = Math.min(tenureAt(p) - 0.5, 0.2 + rnd() * 4.5);
    const d = addDays(AS_OF, -Math.round(back * 365));
    p.lastPromo = d;
    promotions.push({ employee_id: p.id, business_unit: p.bu, promotion_date: iso(d), from_level: `L${n - 1}`, to_level: p.level });
  }
}
const monthsSincePromo = (p) => Math.round(((AS_OF - (p.lastPromo ?? p.hire)) / DAY) / 30.4);

// ---------- requisitions ----------
const requisitions = [];
let reqN = 5001;
const activeTeams = [...teams.values()];
for (let i = 0; i < 640; i++) {
  const t = pick(activeTeams);
  const opened = addDays(AS_OF, -Math.floor(rnd() * 300));
  const ttf = Math.round(28 + rnd() * 40 + (t.family === 'Software Engineering' ? 15 : 0));
  const filled = addDays(opened, ttf);
  const isFilled = filled <= AS_OF && rnd() < 0.92;
  requisitions.push({ req_id: `R${reqN++}`, bu: t.bu, job_family: t.family, location: t.location, level: pick(['L1', 'L2', 'L2', 'L3', 'L3', 'L4']), hiring_manager_id: t.manager.id, opened_date: iso(opened), filled_date: isFilled ? iso(filled) : null, status: isFilled ? 'Filled' : 'Open' });
}
// Story 3: open-req backlog on the Charlotte Client Service team, all older than 60 days.
for (const age of [74, 88, 95, 112, 131, 146]) {
  requisitions.push({ req_id: `R${reqN++}`, bu: storyTeam.bu, job_family: storyTeam.family, location: storyTeam.location, level: 'L2', hiring_manager_id: storyTeam.manager.id, opened_date: iso(addDays(AS_OF, -age)), filled_date: null, status: 'Open' });
}
// Story 1 side effect: Payment Operations backfills.
for (let i = 0; i < 14; i++) {
  const t = pick(activeTeams.filter((x) => x.family === 'Payment Operations'));
  requisitions.push({ req_id: `R${reqN++}`, bu: t.bu, job_family: t.family, location: t.location, level: pick(['L1', 'L2']), hiring_manager_id: t.manager.id, opened_date: iso(addDays(AS_OF, -(20 + Math.floor(rnd() * 120)))), filled_date: null, status: 'Open' });
}

// ---------- engagement survey ----------
const SURVEYS = [['2025-03 Pulse', monthStart(2025, 2)], ['2025-09 Annual', monthStart(2025, 8)], ['2026-03 Pulse', monthStart(2026, 2)], ['2026-09 Annual', monthStart(2026, 8)]];
const THEMES = {
  'Schedules and shifts': {
    neg: ['The move to rotating shifts has made childcare almost impossible to plan.', 'Weekend coverage every third week is wearing the team down.', 'Schedules are posted too late to plan anything outside work.', 'Since the shift change I have been looking at roles with fixed hours.', 'Rotating nights and weekends without a shift differential feels unfair.'],
    pos: ['My schedule is predictable and my manager is flexible when I need it.', 'I like that I can swap shifts easily with teammates.'],
  },
  'Pay and benefits': {
    neg: ['Pay has not kept up with what similar roles offer nearby.', 'I was told my salary is below the range midpoint and nothing has changed.', 'Bonus criteria are unclear to me.'],
    pos: ['The benefits package is strong, especially the retirement match.', 'I feel fairly paid for my role.'],
  },
  'Career growth': {
    neg: ['I do not see a path to the next level from my current role.', 'Promotions seem to go to people on other teams.', 'There are few chances to learn new skills here.'],
    pos: ['My manager talks with me about my development every quarter.', 'The internal mobility program helped me move into a new role.'],
  },
  'Manager support': {
    neg: ['My manager has too many direct reports to give real feedback.', 'One-on-ones keep getting cancelled.', 'I rarely hear from my manager unless something is wrong.'],
    pos: ['My manager is supportive and removes blockers quickly.', 'I trust my manager and feel heard.'],
  },
  'Workload and staffing': {
    neg: ['We have had open roles for months and everyone is covering extra work.', 'The workload is not sustainable with current staffing.', 'Coverage gaps mean I often skip breaks.'],
    pos: ['Workload is manageable and well balanced across the team.'],
  },
  'Tools and systems': {
    neg: ['The case system is slow and crashes during peak hours.', 'Too many manual workarounds in our tools.'],
    pos: ['The new workflow tooling saves me real time every day.'],
  },
  'Flexibility and remote work': {
    neg: ['The return-to-office days feel arbitrary for my role.'],
    pos: ['Hybrid work lets me stay focused and balanced.', 'I appreciate the flexibility to work from home when needed.'],
  },
  'Recognition': {
    neg: ['Good work goes unnoticed on our team.'],
    pos: ['Leaders recognize good work publicly and often.', 'I feel valued by my team.'],
  },
};
const THEME_NAMES = Object.keys(THEMES);
const survey = [];
let respN = 1;
for (const [cycle, date] of SURVEYS) {
  for (const p of people) {
    if (!isActive(p, date) || rnd() > 0.66) continue;
    const payOpsAfter = p.family === 'Payment Operations' && date >= SCHEDULE_CHANGE;
    let eng = 3.75 + p.engLatent * 0.5 + normal() * 0.35;
    if (payOpsAfter) eng -= 1.15;
    if (p.storyTeam) eng -= 0.9;
    if (teams.get(p.managerId) && SPAN_STORY_CELLS.some((c) => c.join('|') === [p.bu, p.family, p.location].join('|')) && teams.get(p.managerId).members.length > 15) eng -= 0.45;
    eng = clamp(round(eng, 1), 1, 5);
    const mgr = clamp(round(eng + normal() * 0.4, 1), 1, 5);
    let comment = null, theme = null, sentiment = null;
    if (rnd() < (payOpsAfter || p.storyTeam ? 0.62 : 0.33)) {
      theme = payOpsAfter ? weighted([['Schedules and shifts', 0.62], ['Workload and staffing', 0.14], ['Pay and benefits', 0.12], ['Manager support', 0.12]])
        : p.storyTeam ? weighted([['Workload and staffing', 0.45], ['Pay and benefits', 0.25], ['Career growth', 0.30]])
        : weighted(THEME_NAMES.map((t) => [t, t === 'Schedules and shifts' ? 0.04 : 1]));
      const negative = eng < 3.2 ? rnd() < 0.88 : eng > 4.1 ? rnd() < 0.12 : rnd() < 0.45;
      const bank = THEMES[theme][negative ? 'neg' : 'pos'];
      comment = pick(bank);
      sentiment = negative ? (rnd() < 0.85 ? 'negative' : 'neutral') : (rnd() < 0.85 ? 'positive' : 'neutral');
    }
    survey.push({ response_id: `S${respN++}`, employee_id: p.id, business_unit: p.bu, job_family: p.family, cycle, survey_date: iso(date), engagement_score: eng, manager_score: mgr, comment, sample_theme: theme, sample_sentiment: sentiment, _p: p });
  }
}
for (const p of people) p.lastEngagement = 3.7;
for (const s of survey) s._p.lastEngagement = s.engagement_score; // survey rows are in cycle order

// ---------- flight-risk model used for the sample data ----------
// Live mode trains SNOWFLAKE.ML.CLASSIFICATION on the same features; these scores are a stand-in.
const DRIVERS = {
  shift: 'Rotating-shift schedule',
  eng: 'Low engagement score',
  compa: 'Pay below band midpoint',
  tenure: 'Tenure under two years',
  promo: 'No promotion in 3+ years',
  span: 'Manager span over 15',
  reqs: 'Open-req backlog on team',
};
function riskFeatures(p) {
  const team = teams.get(p.managerId);
  return {
    shift: p.family === 'Payment Operations' ? 1 : 0,
    eng: p.lastEngagement < 3 ? 1 : 0,
    compa: p.compa < 0.9 ? 1 : 0,
    tenure: tenureAt(p) < 2 ? 1 : 0,
    promo: monthsSincePromo(p) > 36 ? 1 : 0,
    span: team && team.members.filter((m) => isActive(m)).length > 15 ? 1 : 0,
    reqs: p.storyTeam ? 1 : 0,
  };
}
const WEIGHTS = { shift: 1.35, eng: 1.0, compa: 0.75, tenure: 0.55, promo: 0.35, span: 0.6, reqs: 1.9 };
for (const p of people) {
  const f = riskFeatures(p);
  const z = -3.1 + Object.entries(f).reduce((s, [k, v]) => s + WEIGHTS[k] * v, 0) + normal() * 0.25;
  p.risk = round(1 / (1 + Math.exp(-z)), 3);
  p.features = f;
}

// ---------- write CSVs (the live-mode source of truth) ----------
mkdirSync('data/sample', { recursive: true });
const csvCell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const writeCsv = (file, rows, cols) => {
  writeFileSync(`data/${file}`, [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
  return rows.length;
};
const counts = {};
counts.employees = writeCsv('employees.csv', people.map((p) => ({
  employee_id: p.id, full_name: p.name, business_unit: p.bu, job_family: p.family, job_level: p.level, location: p.location,
  manager_id: p.managerId, is_manager: p.isManager, hire_date: iso(p.hire), termination_date: p.term ? iso(p.term) : null,
  status: isActive(p) ? 'Active' : 'Terminated',
  work_schedule: p.family === 'Payment Operations' ? 'Rotating shifts' : p.family === 'Contact Center' || p.family === 'Branch Banking' ? 'Fixed shifts' : 'Standard hours', gender: p.gender, ethnicity: p.ethnicity, remote_flag: p.remote,
})), ['employee_id', 'full_name', 'business_unit', 'job_family', 'job_level', 'location', 'manager_id', 'is_manager', 'hire_date', 'termination_date', 'status', 'work_schedule', 'gender', 'ethnicity', 'remote_flag']);
counts.compensation = writeCsv('compensation.csv', people.map((p) => ({
  employee_id: p.id, business_unit: p.bu, base_salary: p.base, bonus_target: p.bonus, band_min: p.bandMin, band_mid: p.bandMid, band_max: p.bandMax, compa_ratio: p.compa,
})), ['employee_id', 'business_unit', 'base_salary', 'bonus_target', 'band_min', 'band_mid', 'band_max', 'compa_ratio']);
counts.performance = writeCsv('performance.csv', performance, ['employee_id', 'business_unit', 'cycle', 'rating']);
counts.promotions = writeCsv('promotions.csv', promotions, ['employee_id', 'business_unit', 'promotion_date', 'from_level', 'to_level']);
counts.terminations = writeCsv('terminations.csv', people.filter((p) => p.term).map((p) => ({
  employee_id: p.id, business_unit: p.bu, termination_date: iso(p.term), termination_type: p.termType, reason: p.termReason,
})), ['employee_id', 'business_unit', 'termination_date', 'termination_type', 'reason']);
counts.requisitions = writeCsv('requisitions.csv', requisitions, ['req_id', 'bu', 'job_family', 'location', 'level', 'hiring_manager_id', 'opened_date', 'filled_date', 'status']);
counts.engagement_survey = writeCsv('engagement_survey.csv', survey, ['response_id', 'employee_id', 'business_unit', 'job_family', 'cycle', 'survey_date', 'engagement_score', 'manager_score', 'comment']);

// ---------- sample-mode aggregates, one bundle per persona ----------
// Personas mirror the policies in sql/setup.sql:
//   hrbp  – row access: Operations only; salary masked to a $10k band; protected attributes masked
//   comp  – full pay and demographics, all business units
//   chro  – all business units, aggregates only, groups smaller than 10 merged into a remainder group
const MIN_GROUP = 10;
const PERSONAS = {
  hrbp: { label: 'HR business partner', scope: (p) => p.bu === 'Operations', payMasked: true, demographicsMasked: true, aggregateOnly: false },
  comp: { label: 'Compensation analyst', scope: () => true, payMasked: false, demographicsMasked: false, aggregateOnly: false },
  chro: { label: 'CHRO', scope: () => true, payMasked: false, demographicsMasked: false, aggregateOnly: true },
};
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const reqAge = (r) => daysBetween(new Date(r.opened_date), AS_OF);

function overview(scope) {
  const pop = people.filter(scope);
  const trend = MONTHS.map((m) => {
    const end = addDays(monthStart(m.getUTCFullYear(), m.getUTCMonth() + 1), -1);
    const hc = pop.filter((p) => isActive(p, end)).length;
    const hires = pop.filter((p) => p.hire >= m && p.hire <= end).length;
    const exits = pop.filter((p) => p.term && p.term >= m && p.term <= end);
    return { month: iso(m).slice(0, 7), headcount: hc, hires, exits: exits.length, voluntary: exits.filter((p) => p.termType === 'Voluntary').length };
  });
  trend.forEach((t, i) => {
    if (i < 11) { t.attrition12m = null; return; }
    const win = trend.slice(i - 11, i + 1);
    const avgHc = win.reduce((s, x) => s + x.headcount, 0) / 12;
    t.attrition12m = round((win.reduce((s, x) => s + x.exits, 0) / avgHc) * 100, 1);
  });
  const last12 = trend.slice(-12);
  const reqs = requisitions.filter((r) => scope({ bu: r.bu }));
  const filled = reqs.filter((r) => r.filled_date && new Date(r.filled_date) >= addDays(AS_OF, -365));
  const byBu = BUS.filter((b) => scope({ bu: b.bu })).map((b) => {
    const bp = pop.filter((p) => p.bu === b.bu);
    const hc = bp.filter((p) => isActive(p)).length;
    const ex = bp.filter((p) => p.term && p.term > addDays(AS_OF, -365));
    const br = reqs.filter((r) => r.bu === b.bu);
    const bf = br.filter((r) => r.filled_date && new Date(r.filled_date) >= addDays(AS_OF, -365));
    return {
      bu: b.bu, headcount: hc, hires: bp.filter((p) => p.hire > addDays(AS_OF, -365)).length, exits: ex.length,
      attrition: round((ex.length / hc) * 100, 1), voluntaryAttrition: round((ex.filter((p) => p.termType === 'Voluntary').length / hc) * 100, 1),
      openReqs: br.filter((r) => r.status === 'Open').length,
      timeToFill: Math.round(bf.reduce((s, r) => s + daysBetween(new Date(r.opened_date), new Date(r.filled_date)), 0) / Math.max(1, bf.length)),
    };
  });
  const famAttr = [...new Set(pop.map((p) => p.family))].map((f) => {
    const fp = pop.filter((p) => p.family === f);
    const hc = fp.filter((p) => isActive(p)).length;
    const vol = fp.filter((p) => p.termType === 'Voluntary' && p.term > addDays(AS_OF, -183)).length;
    const volPrior = fp.filter((p) => p.termType === 'Voluntary' && p.term > addDays(AS_OF, -365) && p.term <= addDays(AS_OF, -183)).length;
    return { family: f, bu: FAMILY_BU[f], headcount: hc, vol6m: vol, volPrior6m: volPrior, change: volPrior ? round(((vol - volPrior) / volPrior) * 100) : null };
  }).sort((a, b) => b.vol6m / b.headcount - a.vol6m / a.headcount);
  const cur = trend[trend.length - 1];
  return {
    kpis: {
      headcount: cur.headcount,
      hires12m: last12.reduce((s, x) => s + x.hires, 0),
      exits12m: last12.reduce((s, x) => s + x.exits, 0),
      attrition12m: cur.attrition12m,
      attritionPrior: trend[trend.length - 7].attrition12m,
      timeToFill: Math.round(filled.reduce((s, r) => s + daysBetween(new Date(r.opened_date), new Date(r.filled_date)), 0) / Math.max(1, filled.length)),
      openReqs: reqs.filter((r) => r.status === 'Open').length,
      openReqs60: reqs.filter((r) => r.status === 'Open' && reqAge(r) > 60).length,
    },
    trend, byBu, familyAttrition: famAttr,
  };
}

function teamRow(t) {
  const act = t.members.filter((p) => isActive(p));
  const all = [t.manager, ...act];
  const avgRisk = all.reduce((s, p) => s + p.risk, 0) / all.length;
  const driverScore = Object.keys(DRIVERS).map((k) => [k, all.reduce((s, p) => s + p.features[k], 0) / all.length * WEIGHTS[k]]);
  const top = driverScore.filter(([, v]) => v > 0.05).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ driver: DRIVERS[k], weight: round(v, 2) }));
  const openReqs = requisitions.filter((r) => r.hiring_manager_id === t.manager.id && r.status === 'Open');
  const volExits = t.members.filter((p) => p.termType === 'Voluntary' && p.term > addDays(AS_OF, -365)).length;
  return {
    teamId: t.manager.id, team: teamName(t), bu: t.bu, family: t.family, location: t.location, manager: t.manager.name,
    size: all.length, span: act.length, avgRisk: round(avgRisk, 3), highRisk: all.filter((p) => p.risk >= 0.35).length,
    volExits12m: volExits, openReqs: openReqs.length, openReqs60: openReqs.filter((r) => reqAge(r) > 60).length,
    avgEngagement: round(all.reduce((s, p) => s + p.lastEngagement, 0) / all.length, 2), drivers: top,
  };
}
const band10 = (x) => { const lo = Math.floor(x / 10000) * 10; return `$${lo}k–$${lo + 10}k`; };

function attrition(persona) {
  const P = PERSONAS[persona];
  const tl = [...teams.values()].filter((t) => P.scope({ bu: t.bu })).map(teamRow).sort((a, b) => b.avgRisk - a.avgRisk);
  if (P.aggregateOnly) {
    // CHRO: teams are smaller than the minimum group, so the CHRO view groups by job family, location, and level.
    const groups = new Map();
    for (const p of people.filter((x) => isActive(x))) {
      const k = `${p.family}|${p.location}|${p.level}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    const rows = []; const remainder = [];
    for (const [k, g] of groups) {
      if (g.length < MIN_GROUP) { remainder.push(...g); continue; }
      const [family, location, level] = k.split('|');
      rows.push({ group: `${family} · ${location} · ${level}`, bu: FAMILY_BU[family], family, location, level, size: g.length, avgRisk: round(g.reduce((s, p) => s + p.risk, 0) / g.length, 3) });
    }
    rows.sort((a, b) => b.avgRisk - a.avgRisk);
    return {
      mode: 'aggregate', minGroup: MIN_GROUP, groups: rows.slice(0, 40),
      remainder: { size: remainder.length, avgRisk: round(remainder.reduce((s, p) => s + p.risk, 0) / remainder.length, 3), groupsMerged: [...groups.values()].filter((g) => g.length < MIN_GROUP).length },
    };
  }
  const top = tl.slice(0, 40);
  const details = {};
  for (const row of top) {
    const t = teams.get(row.teamId);
    const all = [t.manager, ...t.members.filter((p) => isActive(p))];
    details[row.teamId] = {
      ...row,
      employees: persona === 'comp' ? all.sort((a, b) => b.risk - a.risk).map((p) => ({
        id: p.id, name: p.name, level: p.level, tenure: round(tenureAt(p), 1), rating: p.lastRating, engagement: p.lastEngagement,
        compa: p.compa, base: p.base, monthsSincePromo: monthsSincePromo(p), risk: p.risk,
      })) : null,
      reqs: requisitions.filter((r) => r.hiring_manager_id === t.manager.id && r.status === 'Open').map((r) => ({ ...r, age: reqAge(r) })),
      riskBands: [['Low (<20%)', 0, 0.2], ['Elevated (20–35%)', 0.2, 0.35], ['High (≥35%)', 0.35, 2]].map(([label, lo, hi]) => ({ label, count: all.filter((p) => p.risk >= lo && p.risk < hi).length })),
    };
  }
  const managers = [...teams.values()].filter((t) => P.scope({ bu: t.bu })).map((t) => ({ manager: t.manager.name, team: teamName(t), span: t.members.filter((p) => isActive(p)).length })).filter((m) => m.span > 15).sort((a, b) => b.span - a.span);
  return { mode: 'teams', teams: top, details, wideSpans: managers };
}

// Adjusted pay gap per level x job family. Within a cell, log(base) is demeaned by rating group, then
// regressed on demeaned tenure; the gap is mean residual (Female) minus mean residual (Male), as a percent.
// sql/setup.sql computes the same quantity with window functions.
function payCells() {
  const act = people.filter((p) => isActive(p) && (p.gender === 'Female' || p.gender === 'Male'));
  const groups = new Map();
  for (const p of act) {
    const k = `${p.family}|${p.level}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const out = [];
  for (const [k, g] of groups) {
    const [family, level] = k.split('|');
    const byR = new Map();
    for (const p of g) { if (!byR.has(p.lastRating)) byR.set(p.lastRating, []); byR.get(p.lastRating).push(p); }
    const rows = g.map((p) => {
      const grp = byR.get(p.lastRating);
      const my = grp.reduce((s, x) => s + Math.log(x.base), 0) / grp.length;
      const mt = grp.reduce((s, x) => s + tenureAt(x), 0) / grp.length;
      return { p, y: Math.log(p.base) - my, t: tenureAt(p) - mt };
    });
    const stt = rows.reduce((s, r) => s + r.t * r.t, 0);
    const b = stt > 0 ? rows.reduce((s, r) => s + r.t * r.y, 0) / stt : 0;
    const res = rows.map((r) => ({ g: r.p.gender, e: r.y - b * r.t, base: r.p.base }));
    const F = res.filter((r) => r.g === 'Female'), M = res.filter((r) => r.g === 'Male');
    if (!F.length || !M.length) continue;
    const mean = (a, f) => a.reduce((s, r) => s + f(r), 0) / a.length;
    out.push({
      family, level, bu: FAMILY_BU[family], nFemale: F.length, nMale: M.length,
      rawGap: round((mean(F, (r) => r.base) / mean(M, (r) => r.base) - 1) * 100, 1),
      adjustedGap: round((Math.exp(mean(F, (r) => r.e) - mean(M, (r) => r.e)) - 1) * 100, 1),
      medianBase: Math.round([...g].sort((a, b) => a.base - b.base)[Math.floor(g.length / 2)].base),
    });
  }
  return out.sort((a, b) => a.adjustedGap - b.adjustedGap);
}
const ALL_PAY_CELLS = payCells();
function belowBand(scope) {
  const g = new Map();
  for (const p of people.filter((x) => isActive(x) && scope(x))) {
    const k = `${p.family}|${p.level}`;
    if (!g.has(k)) g.set(k, { family: p.family, level: p.level, bu: p.bu, n: 0, below: 0, compaSum: 0 });
    const c = g.get(k); c.n++; c.compaSum += p.compa; if (p.base < p.bandMin) c.below++;
  }
  return [...g.values()].filter((c) => c.below > 0).map((c) => ({ family: c.family, level: c.level, bu: c.bu, headcount: c.n, belowBand: c.below, avgCompa: round(c.compaSum / c.n, 3) })).sort((a, b) => b.belowBand - a.belowBand).slice(0, 10);
}
function payEquity(persona) {
  const P = PERSONAS[persona];
  if (P.demographicsMasked) {
    // HRBP: gender is masked, so a gap can't be computed. The view shows banded pay for the BU instead.
    const act = people.filter((p) => isActive(p) && P.scope(p));
    const bands = new Map();
    for (const p of act) { const b = band10(p.base); bands.set(b, (bands.get(b) ?? 0) + 1); }
    const sample = act.filter((p) => !p.isManager).slice(0, 8).map((p) => ({ id: p.id, name: p.name, family: p.family, level: p.level, salary: band10(p.base), gender: '***', ethnicity: '***' }));
    return { mode: 'masked', bandDistribution: [...bands.entries()].map(([band, count]) => ({ band, count, lo: Number(band.slice(1).split('k')[0]) })).sort((a, b) => a.lo - b.lo).slice(0, 14), sample };
  }
  if (P.aggregateOnly) {
    const cells = ALL_PAY_CELLS.map((c) => (c.nFemale < MIN_GROUP || c.nMale < MIN_GROUP ? { ...c, suppressed: true, rawGap: null, adjustedGap: null, medianBase: null } : c));
    return { mode: 'aggregate', minGroup: MIN_GROUP, cells, belowBand: belowBand(() => true).filter((c) => c.belowBand >= MIN_GROUP) };
  }
  return { mode: 'full', cells: ALL_PAY_CELLS, belowBand: belowBand(() => true) };
}
function payGapCohort() {
  const g = people.filter((p) => isActive(p) && p.family === PAY_GAP_CELL[0] && p.level === PAY_GAP_CELL[1] && (p.gender === 'Female' || p.gender === 'Male'));
  return g.map((p) => ({ id: p.id, name: p.name, gender: p.gender, tenure: round(tenureAt(p), 1), rating: p.lastRating, base: p.base, compa: p.compa, location: p.location }))
    .sort((a, b) => a.compa - b.compa);
}

function voice(persona) {
  const P = PERSONAS[persona];
  const rows = survey.filter((s) => P.scope(s._p));
  const cycles = SURVEYS.map(([c]) => c);
  const themeTrend = cycles.map((c) => {
    const o = { cycle: c };
    for (const t of THEME_NAMES) {
      const tr = rows.filter((s) => s.cycle === c && s.sample_theme === t);
      o[t] = tr.length;
    }
    return o;
  });
  const sentimentTrend = cycles.map((c) => {
    const cr = rows.filter((s) => s.cycle === c && s.comment);
    const f = (lab) => cr.filter((s) => s.sample_sentiment === lab).length;
    return { cycle: c, positive: f('positive'), neutral: f('neutral'), negative: f('negative'), engagement: round(rows.filter((s) => s.cycle === c).reduce((x, s) => x + s.engagement_score, 0) / Math.max(1, rows.filter((s) => s.cycle === c).length), 2) };
  });
  const latest = rows.filter((s) => s.cycle === cycles[cycles.length - 1] && s.comment);
  const themes = THEME_NAMES.map((t) => {
    const tr = latest.filter((s) => s.sample_theme === t);
    return { theme: t, mentions: tr.length, negativeShare: tr.length ? round(tr.filter((s) => s.sample_sentiment === 'negative').length / tr.length * 100) : 0 };
  }).sort((a, b) => b.mentions - a.mentions);
  const familyShift = [...new Set(rows.map((s) => s._p.family))].map((f) => {
    const fr = latest.filter((s) => s._p.family === f);
    const sh = fr.filter((s) => s.sample_theme === 'Schedules and shifts').length;
    return { family: f, comments: fr.length, schedulePct: fr.length ? round((sh / fr.length) * 100) : 0 };
  }).filter((x) => x.comments >= MIN_GROUP).sort((a, b) => b.schedulePct - a.schedulePct).slice(0, 8);
  const comments = P.aggregateOnly ? [] : latest
    .filter((s) => persona !== 'comp' || s._p.family === 'Payment Operations' || rnd() < 0.15)
    .sort((a, b) => (a._p.family === 'Payment Operations' ? -1 : 0) - (b._p.family === 'Payment Operations' ? -1 : 0))
    .slice(0, 14).map((s) => ({ responseId: s.response_id, family: s._p.family, location: s._p.location, theme: s.sample_theme, sentiment: s.sample_sentiment, text: s.comment }));
  return { cycles, themeTrend, sentimentTrend, themes, familyShift, comments, commentCount: latest.length };
}

function hrbpAnswers(persona) {
  const P = PERSONAS[persona];
  const reqs = requisitions.filter((r) => P.scope({ bu: r.bu }) && r.status === 'Open');
  const ops = reqs.filter((r) => r.bu === 'Operations' && reqAge(r) > 60);
  const byFam = {};
  for (const r of ops) byFam[r.job_family] = (byFam[r.job_family] ?? 0) + 1;
  const pay = people.filter((p) => isActive(p) && p.family === 'Payment Operations' && P.scope(p));
  const payAll = people.filter((p) => isActive(p) && p.family === 'Payment Operations');
  const payVol = people.filter((p) => p.family === 'Payment Operations' && p.termType === 'Voluntary' && p.term >= SCHEDULE_CHANGE).length;
  return {
    opsReqs60: ops.length, opsReqs60ByFamily: byFam, payOpsHeadcount: payAll.length, payOpsVolSinceChange: payVol,
    payOpsTopReason: 'Schedule / work-life balance',
    payOpsAvgBase: Math.round(pay.reduce((x, p) => x + p.base, 0) / pay.length),
    payOpsAvgBaseMasked: Math.round(pay.reduce((x, p) => x + Math.floor(p.base / 10000) * 10000, 0) / pay.length),
    techOpenReqs: reqs.filter((r) => r.bu === 'Technology').length,
    techReqs60: reqs.filter((r) => r.bu === 'Technology' && reqAge(r) > 60).length,
  };
}

const storyTeamRow = teamRow(storyTeam);
const meta = {
  asOf: iso(AS_OF), seed: SEED, rowCounts: counts, minGroup: MIN_GROUP,
  stories: {
    payOps: { family: 'Payment Operations', bu: 'Operations', changeMonth: '2026-05' },
    payGap: { family: PAY_GAP_CELL[0], level: PAY_GAP_CELL[1], cell: ALL_PAY_CELLS.find((c) => c.family === PAY_GAP_CELL[0] && c.level === PAY_GAP_CELL[1]) },
    flightTeam: storyTeamRow,
    wideSpans: [...teams.values()].map((t) => ({ manager: t.manager.name, team: teamName(t), span: t.members.filter((p) => isActive(p)).length })).filter((m) => m.span > 15),
  },
};
for (const persona of Object.keys(PERSONAS)) {
  const P = PERSONAS[persona];
  writeFileSync(`data/sample/${persona}.json`, JSON.stringify({
    persona, label: P.label,
    overview: overview(P.scope), attrition: attrition(persona), payEquity: payEquity(persona),
    payGapCohort: persona === 'comp' ? payGapCohort() : null, voice: voice(persona), answers: hrbpAnswers(persona),
  }));
}
writeFileSync('data/sample/meta.json', JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ counts, active: people.filter((p) => isActive(p)).length, payGap: meta.stories.payGap.cell, flightTeam: { team: storyTeamRow.team, avgRisk: storyTeamRow.avgRisk, openReqs60: storyTeamRow.openReqs60 }, wideSpans: meta.stories.wideSpans }, null, 1));
