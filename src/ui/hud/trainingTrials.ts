import { AWAKENINGS, moveFor, rushMove } from '../../originals/shownAwakening';
import { COMBO_INPUTS, comboMove, hasCombos, type ComboKey, type EnderKey } from '../../originals/shownCombos';
import { AIR_NORMAL_FIGHTERS, AIR_RUSH, airRushName, RUSH_AIR_STAGES, RUSH_STAGES } from '../../originals/shownMoves';
import type { AttackSlot, CombatEvent, FighterId } from '../../game/types';
import { GUARD_GUIDE } from '../guardGuide';
import { TECHNIQUE_BUTTONS, TECHNIQUE_KEYS, techniqueMove } from '../../game/techniques';
import { displayMove } from '../../originals/apply';

export type TrialPress = 'jump' | 'dash' | AttackSlot | 'awaken';
export type TrialSection = 'string' | 'enders' | 'techniques' | 'air' | 'specials';
export const TRIAL_SECTIONS: readonly TrialSection[] = ['string', 'enders', 'techniques', 'air', 'specials'];
/** commandList()'s own headings. */
export const SECTION_TITLES: Readonly<Record<TrialSection, string>> = { string: 'THE STRING', enders: 'ENDERS', techniques: 'TECHNIQUES', air: 'IN THE AIR', specials: 'SPECIAL MOVES' };
export interface Trial { id: string; section: TrialSection; inputs: readonly TrialPress[]; name: string }

/** The awakenings are named in capitals for their banner; in the list every name is set the same way (commandList). */
const MINOR = new Set(['of', 'the', 'no', 'a', 'an', 'and', 'to', 'in']);
const titled = (name: string) => name !== name.toUpperCase() ? name
  : name.toLowerCase().replace(/\p{L}+/gu, (word, at: number) => at > 0 && MINOR.has(word) ? word : word[0].toUpperCase() + word.slice(1));
const lights = (n: number): TrialPress[] => Array(n).fill('light');

/** The fighter's trials, in the command list's order: the string, the enders, the air, the specials. */
export function trialsFor(id: FighterId): Trial[] {
  const out: Trial[] = [], combos = hasCombos(id);
  for (let stage = 0; stage < RUSH_STAGES; stage++) out.push({ id: `string-${stage}`, section: 'string', inputs: lights(stage + 1), name: rushMove(id, stage, false).name });
  const ender = (key: EnderKey, section: TrialSection) => { const move = comboMove(id, key); if (move) out.push({ id: key, section, inputs: COMBO_INPUTS[key], name: move.name }); };
  if (combos) for (const key of ['lh', 'llh', 'lllh', 'llls'] as const) ender(key, 'enders');
  // Techniques (game/techniques.ts): each a trial, ticked by a blow landed as it (its branch).
  for (const key of TECHNIQUE_KEYS) out.push({ id: key, section: 'techniques', inputs: TECHNIQUE_BUTTONS[key], name: displayMove(id, techniqueMove(id, key).name) });
  const own = AIR_RUSH[id];
  if (own) for (let stage = 0; stage < RUSH_AIR_STAGES; stage++)
    out.push({ id: `air-${stage}`, section: 'air', inputs: ['jump', ...lights(stage + 1)], name: own[stage] ?? rushMove(id, stage, false).name });
  else out.push({ id: 'air-0', section: 'air', inputs: ['jump', 'light'], name: (AIR_NORMAL_FIGHTERS.includes(id) ? airRushName(id, 0) : undefined) ?? rushMove(id, 0, false).name });
  if (combos) { ender('airHeavy', 'air'); ender('airSpecial', 'air'); }
  for (const slot of ['heavy', 'special', 'area', 'ultimate'] as const) out.push({ id: slot, section: 'specials', inputs: [slot], name: moveFor(id, slot, false).name });
  out.push({ id: 'awaken', section: 'specials', inputs: ['awaken'], name: titled(AWAKENINGS[id].name) });
  return out;
}

/** The trial an event completes for its actor: a blow that landed (`hit`) by its slot, its light stage and its ender -
 *  `air` says whether the cast it came from was thrown off the ground - or an awakening. Awakened forms count: the
 *  match is on what was pressed, not on the move's name. */
export function trialOf(event: CombatEvent, air: boolean): string | undefined {
  if (event.kind === 'awaken') return 'awaken';
  if (event.kind !== 'hit') return undefined;
  if (event.branch) return event.branch;
  if (event.slot === 'light') return event.chain === undefined ? undefined : `${air ? 'air' : 'string'}-${event.chain}`;
  if (event.slot === 'heavy' || event.slot === 'special' || event.slot === 'area' || event.slot === 'ultimate') return event.slot;
  return undefined;
}

/** Round 5 (PARRY): the DEFENCE rows under the trials - the PARRY stream's three lessons, named and ordered by the one
 *  source (ui/guardGuide.ts) - and the event that ticks each for the player: a blow they blocked (`blocked` on them),
 *  one they parried (`just-guard` on them), and a guard they broke (`guard-break` thrown by them: an emptied bar or a
 *  red move against a dummy that fights back). */
export type DefenceTrialId = 'block' | 'parry' | 'break';
const DEFENCE_ID: Readonly<Record<(typeof GUARD_GUIDE)[number]['name'], DefenceTrialId>> = { Block: 'block', 'Perfect Parry': 'parry', 'Guard Break': 'break' };
export const DEFENCE_TRIALS: readonly { id: DefenceTrialId; name: string; how: string; keyed: boolean }[] =
  GUARD_GUIDE.map(g => ({ id: DEFENCE_ID[g.name], name: g.name, how: g.how, keyed: DEFENCE_ID[g.name] !== 'break' }));
export function defenceTrialOf(event: CombatEvent, self: string): DefenceTrialId | undefined {
  if (!self) return undefined;
  if (event.kind === 'blocked' && event.targetId === self) return 'block';
  if (event.kind === 'just-guard' && event.targetId === self) return 'parry';
  if (event.kind === 'guard-break' && event.actorId === self && event.targetId && event.targetId !== self) return 'break';
  return undefined;
}

/** How long after its last blow a string still counts as going on, seconds (the simulation's own window is shorter;
 *  this only keeps a burn's or a field's late damage on the string that caused it). */
export const STRING_GRACE = 1.5;
/** The combo readout: the last string the player landed (live, as it grows) and the best one this visit. A string is
 *  the simulation's own: a blow whose `combo` is 1 opens a new one. */
export class ComboTracker {
  hits = 0; damage = 0;
  bestHits = 0; bestDamage = 0;
  private at = -Infinity;
  /** A blow the player landed on someone else, at `now` (seconds). `combo` undefined: damage with no blow of its own. */
  hit(combo: number | undefined, damage: number, now: number) {
    if (combo === undefined) {
      if (now - this.at <= STRING_GRACE && this.hits) this.damage += damage;
    } else {
      if (combo <= 1) { this.hits = 1; this.damage = damage; }
      else { this.hits = Math.max(combo, this.hits); this.damage += damage; }
    }
    this.at = now;
    if (this.hits > this.bestHits || (this.hits === this.bestHits && this.damage > this.bestDamage)) { this.bestHits = this.hits; this.bestDamage = this.damage; }
  }
  reset() { this.hits = this.damage = this.bestHits = this.bestDamage = 0; this.at = -Infinity; }
}
