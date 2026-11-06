import { isLaboratoryFighter, type LaboratoryFighterId } from './game/rosterAvailability';
import { OUTFITS } from './game/economy/outfits';
import type { FighterId } from './game/types';

/** An explicit, isolated offline preview capability. Ordinary production and
 * development builds remove this selector; neither a URL nor account access
 * can opt them in. Build/serve with `--mode fighter-lab` to review a candidate. */
export function laboratoryFighter(): FighterId | undefined {
  if (import.meta.env?.MODE !== 'fighter-lab' || typeof location !== 'object') return undefined;
  const asked = new URLSearchParams(location.search).getAll('fighter-lab');
  return asked.length === 1 && isLaboratoryFighter(asked[0]) ? asked[0] : undefined;
}

/** The preview homepage can display candidates without changing account or
 * server admission. This capability is erased from ordinary game builds. */
export function isLaboratoryPreviewFighter(value: unknown): value is LaboratoryFighterId {
  return import.meta.env?.MODE === 'fighter-lab' && isLaboratoryFighter(value);
}

export function selectLaboratoryFighter(value: unknown): value is LaboratoryFighterId {
  if(import.meta.env?.MODE !== 'fighter-lab')return false;
  if (!isLaboratoryPreviewFighter(value) || typeof location !== 'object' || typeof history !== 'object') return false;
  const url = new URL(location.href);
  url.searchParams.delete('fighter-lab');
  url.searchParams.set('fighter-lab', value);
  history.replaceState(history.state, '', url);
  return true;
}

/** A held costume can be inspected only beside its explicitly selected candidate
 * in the laboratory build. This never changes ownership or shop admission. */
export function laboratoryOutfit(fighter: FighterId): string | undefined {
  if (import.meta.env?.MODE !== 'fighter-lab' || laboratoryFighter() !== fighter || typeof location !== 'object') return undefined;
  const asked = new URLSearchParams(location.search).getAll('outfit-lab');
  if (asked.length !== 1) return undefined;
  const outfit = Object.hasOwn(OUTFITS, asked[0]) ? OUTFITS[asked[0]] : undefined;
  return outfit?.laboratory && outfit.fighter === fighter ? asked[0] : undefined;
}
