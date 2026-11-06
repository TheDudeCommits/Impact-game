import type * as THREE from 'three';
import type { AreaAnimOf } from '../engine/sim/areaMoves';
import { forgedMoveFor } from '../engine/sim/forgedKits';
import type { FighterId, PlayerState } from '../game/types';
import { ORIGINALS } from './roster';

/** One body's take: the clip's name (in the file the roster joins onto that body) and its length, seconds. */
export interface AreaCast { readonly clip: string; readonly seconds: number }
export const AREA_CASTS: Partial<Record<FighterId, { readonly base?: AreaCast; readonly form?: AreaCast }>> = {
  'madake': { base: { clip: 'Autumn Stag Cast', seconds: 2.2 }, form: { clip: 'Autumn Stag Cast', seconds: 2.2 } },
  magatsu: { base: { clip: 'Calamity Pyre Cast', seconds: 2.05 }, form: { clip: 'Calamity Pyre Cast', seconds: 2.05 } },
  oro: { base: { clip: 'Knife Rain Cast', seconds: 2.8 } },
  murex: { base: { clip: 'Core Flare Cast', seconds: 2.85 } },
  nigo: { base: { clip: 'Ash Brand Cast', seconds: 1.95 }, form: { clip: 'Ash Brand Cast', seconds: 1.95 } },
  shirokane: { base: { clip: 'Great Dust Fall Cast', seconds: 1.85 } },
  oyashio: { base: { clip: 'Riptide Overthrow Cast', seconds: 2.0 } },
  yodaka: { base: { clip: 'Fire Owl Cast', seconds: 3.0 } },
  mikage: { base: { clip: 'Catwalk Cast', seconds: 1.6 } },
  'psyche': { base: { clip: 'Field of Hands Cast', seconds: 1.85 } },
  shanxiao: { base: { clip: 'Toppled Peak Cast', seconds: 1.95 }, form: { clip: 'Toppled Peak Cast', seconds: 1.95 } },
  shijima: { base: { clip: 'Blue Pyre Cast', seconds: 1.75 }, form: { clip: 'Blue Pyre Cast', seconds: 1.75 } },
  suzuran: { base: { clip: 'Bell Garden Cast', seconds: 1.7 } },
  tobari: { base: { clip: 'Great Ember Cast', seconds: 2.0 }, form: { clip: 'Great Ember Cast', seconds: 2.0 } },
  torsion: { base: { clip: 'Twist-Off Cast', seconds: 2.4 } },
  wataame: { base: { clip: 'Lie In Cast', seconds: 1.75 } },
  'wuming': { base: { clip: 'Lotus Verdict Cast', seconds: 1.85 } },
  'rook': { form: { clip: 'Grave Legion Cast', seconds: 1.85 } },
};

/** The take a fighter's area cast is drawn with, if it is authored (his own move, not a Forge kit's): awakened, the form's
 *  (or the body's, where the awakening keeps his body); else the body's. A form-only take (Rook's) leaves his own cast as
 *  main draws it. */
export function areaCastOf(state: Pick<PlayerState, 'fighter' | 'forge' | 'action' | 'awakened'>): AreaCast | undefined {
  if (!ORIGINALS[state.fighter]) return undefined;
  const cast = AREA_CASTS[state.fighter];
  if (!cast || forgedMoveFor({ ...state, action: 'area' })) return undefined;
  return state.awakened ? cast.form ?? cast.base : cast.base;
}
/** How Fighter.areaAnim draws an authored cast: the body's own clip by name, whole. */
export function areaCastAnim(state: PlayerState): AreaAnimOf | undefined {
  const cast = areaCastOf(state);
  return cast ? { fighter: state.fighter, slot: 'special', clip: cast.clip, full: true } : undefined;
}

/** A body's hold on its take after the move is over (one per Fighter). */
export interface CastHold { on: boolean; last: PlayerState['action'] | undefined; started: number; elapsed: number; seconds: number; clip: string }
export const newCastHold = (): CastHold => ({ on: false, last: undefined, started: 0, elapsed: 0, seconds: 0, clip: '' });

/** The state a body is drawn in this frame: the area action held on after the move while the caster stands doing nothing,
 *  until its take is over. `moving` is the body's drawn ground speed; `active` the clip action it plays now. */
export function castHold(hold: CastHold, state: PlayerState, real: number, moving: number, _form: boolean, active?: THREE.AnimationAction): PlayerState {
  const last = hold.last;
  hold.last = state.action;
  if (state.action === 'area') {
    const cast = areaCastOf(state);
    if (!cast) { hold.on = false; return state; }
    const seconds = state.actionTime * state.actionDuration;
    // A new cast: the action begun again, or its clock gone back (a second cast straight after the first).
    if (!hold.on || last !== 'area' || seconds + .05 < hold.elapsed) { hold.on = true; hold.started = state.actionStarted; hold.seconds = cast.seconds; hold.clip = cast.clip; }
    hold.elapsed = seconds;
    return state;
  }
  if (!hold.on) return state;
  // Anything the caster does ends it: moving off, guarding, a jump, another move, a blow landing on him.
  if (state.action !== 'idle' || !state.alive || !state.grounded || moving > .3 || last !== 'idle' && last !== 'area') { hold.on = false; return state; }
  hold.elapsed += real;
  const clip = active?.getClip();
  const played = clip && clip.name === hold.clip ? active!.time : hold.elapsed;
  if (hold.elapsed >= hold.seconds - 1 / 60 || played >= hold.seconds - 1 / 60 || clip && clip.name !== hold.clip) { hold.on = false; return state; }
  return { ...state, action: 'area', actionStarted: hold.started, actionDuration: hold.seconds, actionTime: hold.elapsed / hold.seconds };
}
