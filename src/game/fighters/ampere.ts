import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Manual full-body lightning pressure: glove-led jab, planted kick,
 * aimed index-finger Air Force, and a confirmed three-beat Smash sequence.
 * Awakening changes presentation; lightning never creates automatic attacks. */
export const AMPERE_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Live Line Jab', duration: .42, contacts: [.152], damage: 21,
    range: 1.9, radius: .65, stamina: 8, cooldown: .42, stun: .29,
    knockback: 2.8, lunge: 4.3, style: 'melee' },
  heavy: { name: 'Cape Wrath Kick', duration: .88, contacts: [.4664], damage: 62,
    range: 2.35, radius: .8, stamina: 23, cooldown: 1.15, stun: .6,
    knockback: 9, lunge: 3.1, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Finisterre Flick', duration: 1.12, contacts: [.616], damage: 101,
    range: 28, radius: .78, stamina: 27, cooldown: 4.2, stun: .55,
    knockback: 8, speed: 32, style: 'projectile', aimOnRelease: true },
  // The shared confirm contract caps startup at .6s. The renderer still maps
  // this contact onto the authored clip's .19 pose; later beats are unchanged.
  ultimate: { name: 'Foghorn Blast: Overcharge', duration: 3.2, contacts: [.6, 1.6, 2.528],
    schedule: [31, 37, 268], damage: 31, finisherDamage: 223,
    range: 2.15, radius: .85, stamina: 0, cooldown: 23, stun: .85,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 7, lunge: 13, style: 'melee', guardBreak: true,
    confirm: { recovery: .65 } },
};
export const AMPERE_COMBOS: ComboRow = {
  lh: { name: 'Live Line Cross', range: 2, radius: .7 },
  llh: { name: 'Spark Uppercut', range: 2.1, radius: .8 },
  lllh: { name: 'Good Hope Drop', range: 2.35, radius: .9 },
  llls: { name: 'Finisterre Burst', range: 2.15, radius: .8 },
  airHeavy: { name: 'Lineman\'s Kick', range: 2.3, radius: .9 },
  airSpecial: { name: 'Landfall', radius: 3.1 },
};
export const AMPERE_CONTACTS = {
  light: .46, heavy: .53, special: .55,
  ultimate: [.19, .5, .79], rush: [.46, .46, .53],
  combos: { lh: .46, llh: .51, lllh: .53, llls: .55, airHeavy: .53, airSpecial: .55 },
} as const;
export const AMPERE_AWAKENING = {
  name: 'Vigilante Resolve', clip: 'Vigilante Resolve', duration: 1.5,
  baseModel: '/assets/fighters/ampere-base-df1.glb',
  model: '/assets/fighters/ampere-vigilante-df1.glb',
  baseHeight: 1.78, awakenedHeight: 1.84,
  beats: { gloveCheck: .285, resolve: .525, transform: .84, guard: 1.185 },
  transformAt: .56, manualOnly: true,
} as const;
