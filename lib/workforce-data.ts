'use client';

// The persona the reader is viewing as, the Sample/Live mode, and screen loaders that read the
// bundled sample or call the live API under that persona's role. Live never falls back to sample.
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { liveJson, useMode, type Mode } from './mode';
import { sampleBundle } from './mock-source';
import { isPersona } from './personas';
import type { AiResult, Attrition, CohortMember, Overview, PayEquity, PersonaId, TeamDetail, Voice } from './types';
import { aiCapability, type AiKind } from './ai';
import { sampleDelayMs, wait } from './sample-timing';

const PKEY = 'wi-persona';
interface Ctx { persona: PersonaId; setPersona: (p: PersonaId) => void; mode: Mode | undefined; configured: boolean }
const WorkforceCtx = createContext<Ctx>({ persona: 'hrbp', setPersona: () => {}, mode: undefined, configured: false });

export function WorkforceProvider({ children }: { children: ReactNode }) {
  const [persona, setP] = useState<PersonaId>('hrbp');
  const { mode, configured } = useMode();
  useEffect(() => {
    const saved = window.localStorage.getItem(PKEY);
    if (isPersona(saved)) setP(saved);
  }, []);
  const setPersona = useCallback((p: PersonaId) => { window.localStorage.setItem(PKEY, p); setP(p); }, []);
  return createElement(WorkforceCtx.Provider, { value: { persona, setPersona, mode, configured } }, children);
}
export const useWorkforce = () => useContext(WorkforceCtx);

type Screen = 'overview' | 'attrition' | 'pay' | 'voice';
type ScreenData = { overview: Overview; attrition: Attrition; pay: { payEquity: PayEquity; cohort: CohortMember[] | null }; voice: Voice };

function fromSample<S extends Screen>(screen: S, p: PersonaId): ScreenData[S] {
  const b = sampleBundle(p);
  const map: ScreenData = { overview: b.overview, attrition: b.attrition, pay: { payEquity: b.payEquity, cohort: b.payGapCohort }, voice: b.voice };
  return map[screen];
}

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; latencyMs?: number; source?: Mode }

// Loads a screen for the current persona. Sample data is synchronous; live data shows a loading state.
export function useScreen<S extends Screen>(screen: S): Loaded<ScreenData[S]> & { persona: PersonaId } {
  const { persona, mode } = useWorkforce();
  const [state, setState] = useState<Loaded<ScreenData[S]>>({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!mode) return;
    if (mode === 'sample') { setState({ data: fromSample(screen, persona), error: null, loading: false, source: 'sample' }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    liveJson<{ data: ScreenData[S]; latencyMs: number }>(`/api/data?persona=${persona}&screen=${screen}`)
      .then((r) => alive && setState({ data: r.data, error: null, loading: false, latencyMs: r.latencyMs, source: 'live' }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false, source: 'live' }));
    return () => { alive = false; };
  }, [screen, persona, mode]);
  return { ...state, persona };
}

export function useTeam(teamId: string | null): Loaded<TeamDetail> {
  const { persona, mode } = useWorkforce();
  const [state, setState] = useState<Loaded<TeamDetail>>({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!mode || !teamId) return;
    if (mode === 'sample') {
      const a = sampleBundle(persona).attrition;
      const d = a.mode === 'teams' ? a.details[teamId] ?? null : null;
      setState({ data: d, error: d ? null : 'This team isn\'t visible to the current persona.', loading: false, source: 'sample' });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    liveJson<{ data: TeamDetail | null; latencyMs: number }>(`/api/data?persona=${persona}&screen=team&id=${encodeURIComponent(teamId)}`)
      .then((r) => alive && setState({ data: r.data, error: r.data ? null : 'This team isn\'t visible to the current persona.', loading: false, latencyMs: r.latencyMs, source: 'live' }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false, source: 'live' }));
    return () => { alive = false; };
  }, [teamId, persona, mode]);
  return state;
}

// Runs an AI action. Sample mode waits 4–8 s and returns the scripted answer; live mode calls the API.
export async function runAi(mode: Mode, persona: PersonaId, kind: AiKind, args: Record<string, string>, sample: () => string): Promise<AiResult> {
  if (mode === 'sample') {
    await wait(sampleDelayMs());
    return { text: sample(), source: 'sample', capability: aiCapability(kind, persona) };
  }
  const r = await liveJson<{ text: string; latencyMs: number; capability: string }>('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona, kind, ...args }),
  });
  return { text: r.text, source: 'live', latencyMs: r.latencyMs, capability: r.capability };
}
