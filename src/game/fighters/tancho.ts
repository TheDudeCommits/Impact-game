import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Every ice/fire hit has an input-owned simulation contact. The glacier and
 * cold flame in Phosphor are presentation; neither creates a damage timer. */
export const TANCHO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Frostbeak', duration: .44, contacts: [.168], damage: 22,
    range: 2.4, radius: .65, stamina: 10, cooldown: .44, stun: .3,
    knockback: 3.4, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Scarlet Wing', duration: .96, contacts: [.5184], damage: 65,
    range: 2.9, radius: .95, stamina: 26, cooldown: 1.25, stun: .7,
    knockback: 8.5, lunge: 4.4, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'White Wingspan', duration: 1.2, contacts: [.672], damage: 120,
    range: 24, radius: 1.05, stamina: 33, cooldown: 4.7, stun: .9,
    knockback: 8, speed: 23, style: 'projectile', outcome: 'knockdown', aimOnRelease: true },
  ultimate: { name: 'Thousand Cranes', duration: 3.6,
    contacts: [.558, 1.656, 2.916], schedule: [42, 58, 238], damage: 42, finisherDamage: 206,
    range: 2.8, radius: 1.1, stamina: 0, cooldown: 23, stun: 1.15,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.5, close: 6,
    style: 'melee', guardBreak: true, confirm: { recovery: .52 } },
};
export const TANCHO_COMBOS: ComboRow = {
  lh: { name: 'Rime Backhand', range: 2.45, radius: .8 },
  llh: { name: 'Icicle Beak', range: 2.55, radius: .85 },
  lllh: { name: 'Ember Talon', range: 2.8, radius: .95 },
  llls: { name: 'Kindling Palm', range: 3, radius: .98 },
  airHeavy: { name: 'Falling Scarlet Wing', range: 2.65, radius: .9 },
  airSpecial: { name: 'Snowfield Landing', radius: 3.3 },
};
/** Whether a blow is thrown from his left hand rather than the strike socket's default, the right
 *  (the socket declarations, sockets.ts): his left side is fire. Scarlet Wing is thrown from it - at its contact the left hand is
 *  0.62 m ahead of him and the right still at his hip (scripts/engine/hitframes.mts, 12 October 2026) - so the right
 *  hand was 1.2 m off the blow it was said to strike. The string's enders and the ultimate keep the default, unmeasured. */
export const tanchoStrikesLeft = (action: string, ender: string | undefined): boolean => action === 'heavy' && !ender;
export const TANCHO_CONTACTS = {
  light: .48, heavy: .54, special: .56, ultimate: [.155, .46, .81],
  rush: [.48, .49, .54],
  combos: { lh: .49, llh: .55, lllh: .57, llls: .54, airHeavy: .57, airSpecial: .56 },
} as const;
/** Unique opposed-palms choreography. Runtime entry is 0.9 seconds, so swapAt
 * is 0.585 SECONDS, not normalized clip fraction 0.65. No body/form replacement. */
export const TANCHO_AWAKENING = {
  name: 'Phosphor', clip: 'Phosphor', duration: 1.8, entryDuration: .9,
  beats: { draw: .18, balance: .423, ignition: .585, open: .747 },
  manualOnly: true,
} as const;
