import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Katana and Whispered Vow. Ghost Bride is presentation of confirmed manual
 * moves only: she never acquires targets, ticks damage, or attacks on a timer. */
export const AKAITO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Thread Draw', duration: .44, contacts: [.168], damage: 20, range: 2.65, radius: .67,
    stamina: 10, cooldown: .44, stun: .3, knockback: 3.1, lunge: 3.9, style: 'melee' },
  heavy: { name: 'Severed Knot', duration: .88, contacts: [.4928], damage: 63, range: 2.85, radius: .84,
    stamina: 25, cooldown: 1.25, stun: .7, knockback: 8, lunge: 4.3, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Whispered Vow', duration: 1, contacts: [.55], damage: 118, range: 22, radius: .95,
    stamina: 32, cooldown: 4.8, stun: .85, knockback: 8, speed: 32, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Pinky Promise', duration: 3.2, contacts: [.576, 1.44, 2.592], schedule: [44, 44, 251],
    damage: 44, finisherDamage: 202, range: 2.95, radius: 1.1, stamina: 0, cooldown: 23, stun: .72,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.2, close: 5.2,
    style: 'melee', guardBreak: true, confirm: { recovery: .52 } },
};
export const AKAITO_COMBOS: ComboRow = {
  lh: { name: 'Return Cut', range: 2.7, radius: .78 },
  llh: { name: 'Rising Thread', range: 2.7, radius: .8 },
  lllh: { name: 'Falling Veil', range: 2.9, radius: .92 },
  llls: { name: 'Echoed Vow', range: 2.65, radius: .95 },
  airHeavy: { name: 'Air Knot Cut', range: 2.8, radius: .9 },
  airSpecial: { name: 'Air Vow', radius: 3.2 },
};
export const AKAITO_CONTACTS = {
  light: .48, heavy: .56, special: .55, ultimate: [.18, .45, .81],
  rush: [.48, .56, .48], combos: { lh: .48, llh: .48, lllh: .56, llls: .55, airHeavy: .56, airSpecial: .55 },
} as const;
export const AKAITO_AWAKENING = {
  name: 'TILL DEATH', clip: 'Ring Pact', duration: 2,
  beats: { ring: .36, vow: .72, manifestation: 1.12 }, manualOnly: true,
} as const;
