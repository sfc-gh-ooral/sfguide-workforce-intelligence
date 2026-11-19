import { NextResponse } from 'next/server';
import { isSnowflakeConfigured, liveError, notConfigured } from '@/lib/snowflake';
import { isPersona } from '@/lib/personas';
import { liveAttrition, liveCohort, liveOverview, livePayEquity, liveTeamDetail, liveVoice } from '@/lib/live-queries';

// Live screen data, queried under the persona's Snowflake role. Sample mode never calls this route.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const persona = url.searchParams.get('persona');
  const screen = url.searchParams.get('screen');
  if (!isPersona(persona)) return liveError('Unknown persona', 400);
  if (!isSnowflakeConfigured()) return notConfigured();
  const t0 = Date.now();
  try {
    let data: unknown;
    switch (screen) {
      case 'overview': data = await liveOverview(persona); break;
      case 'attrition': data = await liveAttrition(persona); break;
      case 'team': {
        const id = url.searchParams.get('id') ?? '';
        if (!/^E\d{6}$/.test(id)) return liveError('Unknown team', 400);
        data = await liveTeamDetail(persona, id); break;
      }
      case 'pay': data = { payEquity: await livePayEquity(persona), cohort: await liveCohort(persona) }; break;
      case 'voice': data = await liveVoice(persona); break;
      default: return liveError('Unknown screen', 400);
    }
    return NextResponse.json({ data, latencyMs: Date.now() - t0 });
  } catch (error) {
    return liveError(error);
  }
}
