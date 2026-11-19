import type { PersonaId } from './types';

// Each persona maps to a Snowflake role in live mode. The policies in sql/setup.sql key off these roles.
export interface Persona {
  id: PersonaId; label: string; short: string; role: string; scope: string;
  pay: string; demographics: string; detail: string; color: string;
}
export const PERSONAS: Record<PersonaId, Persona> = {
  hrbp: {
    id: 'hrbp', label: 'HR business partner', short: 'HRBP', role: 'WI_HRBP_ROLE', scope: 'Operations only',
    pay: 'Masked to $10k bands', demographics: 'Masked', detail: 'Teams, not named individuals', color: '#0f9d8a',
  },
  comp: {
    id: 'comp', label: 'Compensation analyst', short: 'Comp', role: 'WI_COMP_ROLE', scope: 'All business units',
    pay: 'Full detail', demographics: 'Visible for equity analysis', detail: 'Employee-level drill-down', color: '#7c4dff',
  },
  chro: {
    id: 'chro', label: 'CHRO', short: 'CHRO', role: 'WI_CHRO_ROLE', scope: 'All business units',
    pay: 'Aggregates only', demographics: 'Aggregates only', detail: 'Groups under 10 merged', color: '#e8664a',
  },
};
export const PERSONA_IDS: PersonaId[] = ['hrbp', 'comp', 'chro'];
export const isPersona = (x: unknown): x is PersonaId => x === 'hrbp' || x === 'comp' || x === 'chro';
