import snowflake from 'snowflake-sdk';
import { PERSONAS } from './personas';
import type { PersonaId } from './types';

// Live mode: one connection per persona role, so masking, row access, and aggregation policies apply
// exactly as they would for that person. Secondary roles are turned off so only the persona role counts.
snowflake.configure({ logLevel: 'ERROR' });
const pool = new Map<string, Promise<snowflake.Connection>>();

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME && process.env.SNOWFLAKE_DATABASE &&
    process.env.SNOWFLAKE_WAREHOUSE && process.env.SNOWFLAKE_PRIVATE_KEY_PATH);
}

function connect(role: string): Promise<snowflake.Connection> {
  const conn = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT!, username: process.env.SNOWFLAKE_USERNAME!,
    authenticator: 'SNOWFLAKE_JWT', privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH!,
    database: process.env.SNOWFLAKE_DATABASE, schema: process.env.SNOWFLAKE_SCHEMA ?? 'HR',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE, role,
  });
  return new Promise((resolve, reject) => {
    conn.connect((err) => {
      if (err) return reject(new Error(`Snowflake connection failed for ${role}: ${err.message}`));
      conn.execute({ sqlText: 'USE SECONDARY ROLES NONE', complete: (e) => (e ? reject(e) : resolve(conn)) });
    });
  });
}

async function connectionFor(persona: PersonaId) {
  const role = PERSONAS[persona].role;
  let p = pool.get(role);
  if (p) {
    const c = await p.catch(() => null);
    if (c && c.isUp()) return c;
  }
  p = connect(role);
  pool.set(role, p);
  p.catch(() => pool.delete(role));
  return p;
}

export async function query<T = Record<string, unknown>>(persona: PersonaId, sqlText: string, binds: snowflake.Binds = []): Promise<T[]> {
  const conn = await connectionFor(persona);
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText, binds,
      complete: (err, _stmt, rows) => (err ? reject(new Error(err.message)) : resolve((rows ?? []) as T[])),
    });
  });
}

// Live-mode error response. Routes never substitute sample data; the UI shows this message.
export function liveError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status });
}
export function notConfigured() {
  return liveError('No Snowflake connection is configured. Copy .env.example to .env.local and restart.', 503);
}

// Fully qualified agent name from .env.local, validated so it can be inlined safely in SQL.
export function agentName(): string {
  const name = process.env.SNOWFLAKE_AGENT_NAME ?? 'WORKFORCE_INTEL_DB.HR.WORKFORCE_AGENT';
  if (!/^[A-Za-z_][A-Za-z0-9_$]*(\.[A-Za-z_][A-Za-z0-9_$]*){0,2}$/.test(name)) {
    throw new Error('SNOWFLAKE_AGENT_NAME must be a plain identifier such as DB.SCHEMA.AGENT.');
  }
  return name;
}
export const COMPLETE_MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';
