/** How the area slot's impact looks are picked (scripts/engine/areaLooks.mts writes them to areaLooks.json): for each
 *  fighter, the matcher's ranking for its area move, kept to vendored effects that cast as a zone. Tools and tests
 *  only: the page reads the JSON. */
import { FIGHTERS } from '../../config';
import { MOVES } from '../../game/moves';
import type { FighterId } from '../../game/types';
import { FIGHTER_IDS } from '../sim/registry';
import { needOf, rank } from './matcher';

export const AREA_LOOKS_FILE = 'src/engine/sim/areaLooks.json';
/** How many picks each fighter keeps, best first. */
const KEEP = 3;
const AUTHORED: Readonly<Partial<Record<FighterId, readonly string[]>>> = {
  'ovid': ['colossus_moltenfist'],
  hagure: ['breath_wind'],
  yodaka: ['wildfire'],
  aqrab: ['undertow'],
  tsubute: ['bloomburst'],
  chohan: ['blade_iaido'],
  // The mana four (31 October 2026, round 7's blind critics: Svanhild's Nest was
  // rainbow rings turning gold, Aquilo's tornado neon green bars, Cardo's an explosion): Mirror Lake is a water
  // dome she raises round herself, Eye of the Gale a standing column of wind, Thistledown Storm a spin that becomes a
  // whirl of black; Bear's Den a black sphere over a dome of dark, the matcher's own first pick.
  svanhild: ['bubblecage'],
  aquilo: ['found_tornado', 'efk_tornado'],
  cardo: ['qk_vortex'],
  bruin: ['cosmos_blackhole'],
};

/** Every vendored effect's id and cast, read from the vendored manifest's source. */
export function vendoredCasts(manifest: string): Map<string, 'line' | 'zone'> {
  const out = new Map<string, 'line' | 'zone'>();
  for (const [, id, cast] of manifest.matchAll(/\{ id: '([^']+)', label: '(?:[^'\\]|\\.)*', school: '[^']*', settings: '[^']*', cast: '(line|zone)'/g)) out.set(id, cast as 'line' | 'zone');
  return out;
}

export function areaLooks(manifest: string): Record<string, string[]> {
  const vendored = vendoredCasts(manifest), out: Record<string, string[]> = {};
  for (const id of FIGHTER_IDS) {
    const series = (FIGHTERS as Record<string, { series?: string }>)[id]?.series;
    const ranked = rank(needOf(id as FighterId, 'area', MOVES[id].area, series), { limit: 60 });
    const preferred = (AUTHORED[id] ?? []).filter(effect => vendored.get(effect) === 'zone');
    const inferred = ranked.filter(m => vendored.get(m.effect.id) === 'zone').map(m => m.effect.id);
    out[id] = [...new Set([...preferred, ...inferred])].slice(0, KEEP);
  }
  return out;
}
