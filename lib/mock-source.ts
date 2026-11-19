// Sample mode: bundled synthetic data from scripts/generate-data.mjs. The persona bundles already have
// row filtering, masking, and small-group suppression applied the way the Snowflake policies apply them.
import hrbp from '@/data/sample/hrbp.json';
import comp from '@/data/sample/comp.json';
import chro from '@/data/sample/chro.json';
import meta from '@/data/sample/meta.json';
import type { PersonaBundle, PersonaId } from './types';

const BUNDLES = { hrbp, comp, chro } as unknown as Record<PersonaId, PersonaBundle>;
export const sampleBundle = (p: PersonaId): PersonaBundle => BUNDLES[p];
export const sampleMeta = meta;
