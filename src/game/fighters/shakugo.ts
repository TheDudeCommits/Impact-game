import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Shakugo's native magma kit. All damage belongs to a manual cast/contact;
 * NO QUARTER never creates passive damage or an autonomous attacker. */
export const SHAKUGO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Slag Knuckle', duration: .45, contacts: [.168], damage: 21, range: 2.45, radius: .65,
    stamina: 11, cooldown: .45, stun: .3, knockback: 3.3, lunge: 4.2, style: 'melee' },
  heavy: { name: 'Fissure Blast', duration: .96, contacts: [.45 * 1.02 / 1.04], damage: 64, range: 3.05, radius: .92,
    stamina: 27, cooldown: 1.3, stun: .72, knockback: 8.6, lunge: 4.4, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'Sentence: Molten Fang', duration: 1.65, contacts: [.74], damage: 124, range: 25, radius: 1.12,
    stamina: 34, cooldown: 4.7, stun: .86, knockback: 9.2, speed: 24, style: 'projectile', outcome: 'wallBounce', aimOnRelease: true },
  ultimate: { name: 'Final Sentence: Brimstone Rain', duration: 3.95, contacts: [.44, 1.51, 3.15], schedule: [48, 72, 226],
    damage: 48, finisherDamage: 203, range: 3.1, radius: 1.15, stamina: 0, cooldown: 24,
    stun: 1.25, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 6, close: 6,
    style: 'melee', guardBreak: true, confirm: { recovery: .55 } },
};

export const SHAKUGO_COMBOS: ComboRow = {
  lh: { name: 'Cinder Backfist', range: 2.6, radius: .85 },
  llh: { name: 'Fissure Uppercut', range: 2.55, radius: .88 },
  lllh: { name: 'Gavel Hammer', range: 2.85, radius: .95 },
  llls: { name: 'Muzzle Burst', range: 3, radius: 1 },
  airHeavy: { name: 'Slag Descent', range: 2.7, radius: .95 },
  airSpecial: { name: 'Gavel Drop', radius: 3.5 },
};

/** Measured native frame fractions, before Fighter's contact-time warping. */
export const SHAKUGO_CONTACTS = {
  light: 8 / 24, heavy: 13 / 33, special: 22 / 60, ultimate: .44 / 3.95,
  rush1: 8 / 20, rush2: 8 / 23, rush3: 10 / 30,
  combos: { lh: 8 / 23, llh: 8 / 20, lllh: 10 / 30, llls: 13 / 51,
    airHeavy: 10 / 30, airSpecial: 7 / 42 },
} as const;


export const SHAKUGO_AWAKENING = {
  name: 'NO QUARTER', clip: 'NO QUARTER', duration: 44 / 30, entryDuration: .9,
  beats: { gather: .08, fistRaise: .16, magmaSwap: .35, release: .38 },
  manualOnly: true,
  canonScope: 'Gameplay magma-focus state; no new transformation.',
} as const;

export const SHAKUGO_CINEMATIC = {
  opener: { clip: 'Final Sentence: Brimstone Rain', at: .44 / 3.95 },
  cine: { from: .44 / 3.95, at: 3.15 / 3.95,
    windows: [[.44 / 3.95, 2.55 / 3.95, 1.51 / 3.95], [2.55 / 3.95, 1, 3.15 / 3.95]] },
} as const;

export type ShakugoArmVariant = 'Normal' | 'Magma' | 'Hound';
/** Native variants are mutually exclusive. A released hound must be represented
 * by the authoritative projectile; the source's 13m follow-through is hidden.
 * `elapsed` must use the drawn action clock, including contact-time warping. */
export function shakugoArmVariants(action: string, elapsed: number, awakened = false, clip?: string): readonly [ShakugoArmVariant, ShakugoArmVariant] {
  // Simulation flags the focus state at entry; the mesh swap still waits
  // for this fighter's native raised-fist beat.
  if (action === 'awaken') return elapsed >= SHAKUGO_AWAKENING.beats.magmaSwap ? ['Magma', 'Magma'] : ['Normal', 'Normal'];
  const rest: ShakugoArmVariant = awakened ? 'Magma' : 'Normal';
  if (clip === 'Gavel Drop' && action === 'special') return ['Magma', 'Magma'];
  if (clip === 'Muzzle Burst' && action === 'special') return elapsed >= .12 && elapsed < .46 ? ['Hound', rest] : [rest, rest];
  const right = clip === 'Rush 2' || clip === 'Cinder Backfist' || clip === 'Fissure Uppercut';
  if (action === 'special' && elapsed >= .28 && elapsed < .79) return ['Hound', rest];
  if (action === 'light' && elapsed >= .08 && elapsed < .43) return right ? [rest, 'Magma'] : ['Magma', rest];
  if (action === 'heavy' && elapsed >= .12 && elapsed < .9) return right ? [rest, 'Magma'] : ['Magma', rest];
  // The volley segment launches separate native fist meshes. The source
  // keeps extending its attached magma arms to4.7m here; retaining those
  // duplicates the released fists and fills the cinematic with red spikes.
  if (action === 'ultimate') return elapsed >= .82 && elapsed < 2.75 ? ['Normal', 'Normal'] : ['Magma', 'Magma'];
  return [rest, rest];
}
