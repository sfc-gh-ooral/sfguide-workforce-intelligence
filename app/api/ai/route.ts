import { NextResponse } from 'next/server';
import { COMPLETE_MODEL, isSnowflakeConfigured, liveError, notConfigured, query } from '@/lib/snowflake';
import { isPersona } from '@/lib/personas';
import { aiCapability, type AiKind } from '@/lib/ai';
import { LATEST_CYCLE, liveTeamDetail, liveVoice } from '@/lib/live-queries';

// Live AI panels. Every input is read under the persona's role, so the model only sees what that
// role is allowed to see. Prompts are passed as bind variables.
const KINDS = new Set<AiKind>(['pay-explain', 'voice-summary', 'team-brief']);
const GUARD = 'Use only the data provided. Write 3 to 5 short paragraphs in Markdown, with **bold** for key numbers and a final "Suggested next steps" line. ' +
  'This is synthetic data. Never recommend actions against named individuals; risk scores are illustrative.';

async function complete(persona: Parameters<typeof query>[0], prompt: string) {
  const rows = await query<{ R: string }>(persona, 'SELECT AI_COMPLETE(?, ?) AS R', [COMPLETE_MODEL, prompt]);
  return String(rows[0]?.R ?? '');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { persona, kind, family, level, teamId } = body ?? {};
  if (!isPersona(persona) || !KINDS.has(kind)) return liveError('Invalid request', 400);
  if (!isSnowflakeConfigured()) return notConfigured();
  const t0 = Date.now();
  try {
    let text = '';
    if (kind === 'pay-explain') {
      if (typeof family !== 'string' || typeof level !== 'string') return liveError('Pick a cell', 400);
      const rows = await query(persona, `SELECT job_family, job_level, n_female, n_male, raw_gap_pct, adjusted_gap_pct, median_base, small_cell
                                         FROM PAY_EQUITY_CELLS WHERE job_family = ? AND job_level = ?`, [family, level]);
      text = await complete(persona, `You are a pay-equity analyst. Explain this cell to an HR leader: what the raw and adjusted gaps mean ` +
        `(the adjusted gap controls for tenure and latest rating), whether the gap looks material, and what to check next. ` +
        `If the gap values are null, explain that they are hidden because the cell has fewer than 10 women or 10 men. ${GUARD}\n\nCell: ${JSON.stringify(rows[0] ?? {})}`);
    } else if (kind === 'voice-summary') {
      if (persona === 'chro') {
        const v = await liveVoice(persona);
        text = await complete(persona, `Summarize what employees are saying in the ${LATEST_CYCLE} survey for a CHRO, using only these aggregate counts. ` +
          `Note which job families stand out. ${GUARD}\n\nThemes: ${JSON.stringify(v.themes)}\nShare of comments about schedules by job family: ${JSON.stringify(v.familyShift)}\nSentiment by cycle: ${JSON.stringify(v.sentimentTrend)}`);
      } else {
        const rows = await query<{ R: string }>(persona,
          `SELECT AI_AGG(job_family || ' [' || COALESCE(theme, '') || ']: ' || comment, ?) AS R FROM SURVEY_AI WHERE cycle = ?`,
          [`You are reading employee engagement survey comments, each prefixed with the job family and theme. Write a summary for an HR business partner: ` +
           `the main themes, which job families stand out and why, and suggested next steps. ${GUARD}`, LATEST_CYCLE]);
        text = String(rows[0]?.R ?? '');
      }
    } else {
      if (typeof teamId !== 'string' || !/^E\d{6}$/.test(teamId) || persona === 'chro') return liveError('Pick a team', 400);
      const t = await liveTeamDetail(persona, teamId);
      if (!t) return liveError('Team not visible to this role', 404);
      const { employees: _e, ...team } = t;
      text = await complete(persona, `You are an HR business partner's assistant. Draft a short conversation plan for meeting this team's manager, ` +
        `based on team-level attrition risk drivers and open requisitions. Do not single out individuals. ${GUARD}\n\nTeam: ${JSON.stringify(team)}`);
    }
    return NextResponse.json({ text, latencyMs: Date.now() - t0, capability: aiCapability(kind, persona) });
  } catch (error) {
    return liveError(error);
  }
}
