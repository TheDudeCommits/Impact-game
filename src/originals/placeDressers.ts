import { STAGES, type StageId } from '../game/stages';
import { UNCLEARED_DRESSINGS } from './stages';

const OWN = import.meta.glob<{ dress: unknown }>(['./places/*.ts', '!./places/*.test.ts']);

export const OWN_DRESSINGS: readonly StageId[] = Object.keys(OWN).map(file => file.replace(/^.*\/|\.ts$/g, ''))
  .filter((id): id is StageId => id in STAGES);

export function applyOriginalDressers<T>(dressers: Partial<Record<StageId, () => Promise<T>>>) {
  for (const id of UNCLEARED_DRESSINGS) delete dressers[id];
  for (const id of OWN_DRESSINGS) dressers[id] = () => OWN[`./places/${id}.ts`]().then(module => module.dress as T);
  return dressers;
}
