import { NextResponse } from 'next/server';
import { isSnowflakeConfigured, liveError, notConfigured, query } from '@/lib/snowflake';
import { isPersona } from '@/lib/personas';

// Human-in-the-loop decisions, written to HR.ACTIONS under the persona's role.
const ACTIONS = new Set(['Flag for HRBP review', 'Assign follow-up', 'Escalate to comp review', 'Add note']);

export async function GET(request: Request) {
  const persona = new URL(request.url).searchParams.get('persona');
  if (!isPersona(persona)) return liveError('Unknown persona', 400);
  if (!isSnowflakeConfigured()) return notConfigured();
  try {
    const rows = await query(persona, `SELECT action_id AS "id", subject_type AS "subjectType", subject_id AS "subjectId", subject_label AS "subjectLabel",
      action AS "action", note AS "note", persona_role AS "persona", TO_VARCHAR(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
      FROM ACTIONS ORDER BY created_at DESC LIMIT 50`);
    return NextResponse.json({ actions: rows });
  } catch (error) { return liveError(error); }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { persona, subjectType, subjectId, subjectLabel, action, note } = body ?? {};
  if (!isPersona(persona) || !ACTIONS.has(action)) return liveError('Invalid action', 400);
  if (![subjectType, subjectId, subjectLabel].every((s) => typeof s === 'string' && s.length > 0 && s.length < 200)) return liveError('Invalid subject', 400);
  if (typeof note !== 'string' || note.length > 1000) return liveError('Note must be under 1,000 characters', 400);
  if (!isSnowflakeConfigured()) return notConfigured();
  try {
    await query(persona, 'INSERT INTO ACTIONS (subject_type, subject_id, subject_label, action, note) VALUES (?, ?, ?, ?, ?)',
      [subjectType, subjectId, subjectLabel, action, note]);
    return NextResponse.json({ ok: true });
  } catch (error) { return liveError(error); }
}
