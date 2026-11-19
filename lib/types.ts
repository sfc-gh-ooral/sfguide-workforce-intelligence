// Screen data shapes. Sample mode reads them from data/sample/<persona>.json; live mode builds the
// same shapes from Snowflake (lib/live-queries.ts) under the persona's role.
export type PersonaId = 'hrbp' | 'comp' | 'chro';

export interface TrendPoint { month: string; headcount: number; hires: number; exits: number; voluntary: number; attrition12m: number | null }
export interface BuRow { bu: string; headcount: number; hires: number; exits: number; attrition: number; voluntaryAttrition: number; openReqs: number; timeToFill: number }
export interface FamilyAttrition { family: string; bu: string; headcount: number; vol6m: number; volPrior6m: number; change: number | null }
export interface Overview {
  kpis: { headcount: number; hires12m: number; exits12m: number; attrition12m: number | null; attritionPrior: number | null; timeToFill: number; openReqs: number; openReqs60: number };
  trend: TrendPoint[]; byBu: BuRow[]; familyAttrition: FamilyAttrition[];
}

export interface Driver { driver: string; weight: number }
export interface TeamRow {
  teamId: string; team: string; bu: string; family: string; location: string; manager: string;
  size: number; span: number; avgRisk: number; highRisk: number; volExits12m: number;
  openReqs: number; openReqs60: number; avgEngagement: number; drivers: Driver[];
}
export interface TeamEmployee { id: string; name: string; level: string; tenure: number; rating: number; engagement: number; compa: number; base: number; monthsSincePromo: number }
export interface Req { req_id: string; bu?: string; job_family: string; location: string; level: string; opened_date: string; status: string; age: number }
export interface TeamDetail extends TeamRow { employees: TeamEmployee[] | null; reqs: Req[]; riskBands: { label: string; count: number | null }[] }
export interface AggGroup { group: string; bu: string; family: string; location: string; level: string; size: number; avgRisk: number }
export type Attrition =
  | { mode: 'teams'; teams: TeamRow[]; details: Record<string, TeamDetail>; wideSpans: { manager: string; team: string; span: number }[] }
  | { mode: 'aggregate'; minGroup: number; groups: AggGroup[]; remainder: { size: number; avgRisk: number; groupsMerged: number } };

export interface PayCell { family: string; level: string; bu: string; nFemale: number; nMale: number; rawGap: number | null; adjustedGap: number | null; medianBase: number | null; suppressed?: boolean }
export interface BelowBand { family: string; level: string; bu: string; headcount: number; belowBand: number; avgCompa: number }
export type PayEquity =
  | { mode: 'masked'; bandDistribution: { band: string; count: number; lo: number }[]; sample: { id: string; name: string; family: string; level: string; salary: string; gender: string; ethnicity: string }[] }
  | { mode: 'aggregate'; minGroup: number; cells: PayCell[]; belowBand: BelowBand[] }
  | { mode: 'full'; cells: PayCell[]; belowBand: BelowBand[] };
export interface CohortMember { id: string; name: string; gender: string; tenure: number; rating: number; base: number; compa: number; location: string }

export interface Voice {
  cycles: string[];
  themeTrend: Record<string, string | number>[];
  sentimentTrend: { cycle: string; positive: number; neutral: number; negative: number; engagement: number }[];
  themes: { theme: string; mentions: number; negativeShare: number }[];
  familyShift: { family: string; comments: number; schedulePct: number }[];
  comments: { responseId: string; family: string; location: string; theme: string; sentiment: string; text: string }[];
  commentCount: number;
}
export interface Answers { opsReqs60: number; opsReqs60ByFamily: Record<string, number>; payOpsHeadcount: number; payOpsVolSinceChange: number; payOpsTopReason: string; payOpsAvgBase: number; payOpsAvgBaseMasked: number; techOpenReqs: number; techReqs60: number }

export interface PersonaBundle {
  persona: PersonaId; label: string; overview: Overview; attrition: Attrition; payEquity: PayEquity;
  payGapCohort: CohortMember[] | null; voice: Voice; answers: Answers;
}

export interface AiResult { text: string; source: 'sample' | 'live'; latencyMs?: number; capability: string }
export interface ActionRecord { id: string; subjectType: string; subjectId: string; subjectLabel: string; action: string; note: string; persona: string; createdAt: string }
