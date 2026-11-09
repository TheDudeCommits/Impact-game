import {MOVES} from '../moves';
import type {FighterId} from '../types';
import {speedCap} from './physics';
import {BALL_RULES, type BallModeId, type ShotKind} from './model';

/** Fighter ball traits: each fighter brings one small edge to the
 *  ball modes, read off their own kit, so picking a fighter means something on the pitch and the court too. Every edge
 *  is a few percent, and headless bot matches measured that none of them wins matches by itself.
 *
 *  | Trait     | Whose kit                                   | The edge                                                   |
 *  |-----------|---------------------------------------------|------------------------------------------------------------|
 *  | AERIALIST | the heavy launches or hops them into the air | air shots (volleys, spikes) fly 2% faster; a Sky Spike     |
 *  |           |                                             | spike is a SKY SPIKE from 3.45 m up, not 3.6               |
 *  | STRIKER   | a melee heavy that knocks back 8.5 or more   | shots from the ground (power, drive, curve, sinker, blast) |
 *  |           |                                             | fly 5% faster                                              |
 *  | WALL      | a light that reaches 2.6 m or more           | a guard meets the ball 0.12 m further out (0.82 m)         |
 *  | PLAYMAKER | everyone else: the string fighters           | taps, bumps and sets heat the ball 0.1 more                |
 *
 *  The order is the order they are read in: a kit that launches is an AERIALIST whatever its reach. No shot ever flies
 *  past the speed its heat allows. Data and arithmetic only, as everything under src/game. */
export type BallTrait = 'aerialist' | 'striker' | 'wall' | 'playmaker';
export const BALL_TRAITS: readonly BallTrait[] = ['aerialist', 'striker', 'wall', 'playmaker'];
export const TRAIT_NAMES: Record<BallTrait, string> = {aerialist: 'AERIALIST', striker: 'STRIKER', wall: 'WALL', playmaker: 'PLAYMAKER'};
export const TRAIT_LINES: Record<BallTrait, string> = {
  aerialist: 'Air shots fly 2% faster; spikes from a little lower count as SKY SPIKES.',
  striker: 'Shots from the ground fly 5% faster.',
  wall: 'Your guard meets the ball a little further out.',
  playmaker: 'Your taps, bumps and sets heat the ball more.',
};
export const TRAIT_RULES = {
  /** AERIALIST: air shots' speed, and the height a Sky Spike spike is named from. */
  airSpeed: 1.02, skySpike: 3.45,
  /** STRIKER: grounded shots' speed. */
  groundSpeed: 1.05,
  /** WALL: metres a guard reaches past the usual 0.7. */
  guardReach: .12,
  /** PLAYMAKER: heat a pass adds besides its own. */
  passHeat: .1,
  /** What decides each from the kit: a heavy that knocks back this far is a STRIKER's, a light that reaches this far a WALL's. */
  strikerKnockback: 8.5, wallReach: 2.6,
} as const;

const cache = new Map<FighterId, BallTrait>();
/** The trait a fighter's kit gives them (see the table above). */
export function traitOf(fighter: FighterId): BallTrait {
  const known = cache.get(fighter);
  if (known) return known;
  const kit = MOVES[fighter];
  let trait: BallTrait = 'playmaker';
  if (kit) {
    const heavy = kit.heavy, light = kit.light;
    if (heavy.outcome === 'launch' || heavy.outcome === 'hop') trait = 'aerialist';
    else if (heavy.style === 'melee' && (heavy.finisherKnockback ?? heavy.knockback) >= TRAIT_RULES.strikerKnockback) trait = 'striker';
    else if (light.range >= TRAIT_RULES.wallReach) trait = 'wall';
  }
  cache.set(fighter, trait);
  return trait;
}

const AIR: ReadonlySet<ShotKind> = new Set(['volley', 'spike']);
const GROUND: ReadonlySet<ShotKind> = new Set(['power', 'drive', 'curve', 'sinker', 'blast']);
const PASS: ReadonlySet<ShotKind> = new Set(['tap', 'bump', 'set']);
/** A strike's flight and heat with the striker's trait on it (in place). `heat`: the ball's heat before the strike, so
 *  the shot keeps under the speed its new heat allows. */
export function withTrait(trait: BallTrait | undefined, mode: BallModeId, heat: number, r: {vx: number; vy: number; vz: number; heat: number; shot: ShotKind; super: boolean}) {
  if (!trait || r.super) return r;
  const k = trait === 'aerialist' && AIR.has(r.shot) ? TRAIT_RULES.airSpeed : trait === 'striker' && GROUND.has(r.shot) ? TRAIT_RULES.groundSpeed : 1;
  if (k !== 1) {
    const speed = Math.hypot(r.vx, r.vy, r.vz), cap = speedCap(mode, Math.min(BALL_RULES.heatMax, heat + r.heat)), scale = speed > 0 ? Math.min(k, Math.max(1, cap / speed)) : 1;
    r.vx *= scale; r.vy *= scale; r.vz *= scale;
  }
  if (trait === 'playmaker' && PASS.has(r.shot)) r.heat += TRAIT_RULES.passHeat;
  return r;
}
