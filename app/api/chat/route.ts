import { NextResponse } from 'next/server';
import { agentName, isSnowflakeConfigured, liveError, notConfigured, query } from '@/lib/snowflake';
import { isPersona } from '@/lib/personas';

// Live chat: sends the question to WORKFORCE_AGENT under the persona's role, so the agent's
// Cortex Analyst queries over WORKFORCE_SV get the same masking and row access as any other query.
// Returns the final text block; earlier blocks are the agent's interim planning notes.
export async function POST(request: Request) {
  const { message, persona } = await request.json().catch(() => ({}));
  if (!isPersona(persona)) return liveError('Unknown persona', 400);
  if (!message || typeof message !== 'string' || message.length > 2000) return liveError('Message is required', 400);
  if (!isSnowflakeConfigured()) return notConfigured();
  const t0 = Date.now();
  try {
    const payload = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: message }] }] });
    const rows = await query<{ T: string }>(persona,
      `WITH r AS (SELECT TRY_PARSE_JSON(SNOWFLAKE.CORTEX.DATA_AGENT_RUN('${agentName()}', ?, TRUE)) AS resp)
       SELECT f.value:text::STRING AS T
       FROM r, LATERAL FLATTEN(input => resp:content) f WHERE f.value:type::STRING = 'text'
       QUALIFY ROW_NUMBER() OVER (ORDER BY f.index DESC) = 1`, [payload]);
    if (!rows[0]?.T) return liveError('The Cortex Agent returned no text. Check that sql/setup.sql ran.');
    return NextResponse.json({ text: rows[0].T, latencyMs: Date.now() - t0 });
  } catch (error) {
    return liveError(error);
  }
}
