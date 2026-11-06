import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
import type { AwakeningDefinition } from '../awakening';

/** Hakuda pressure and ASHSTEP closing speed. HACKLES UP is a manual combat state:
 * the shoulder corona never searches for victims, ticks damage or attacks. */
export const MIKAGE_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Velvet Palm', duration: .42, contacts: [.152], damage: 23,
    range: 1.85, radius: .64, stamina: 9, cooldown: .42, stun: .29,
    knockback: 2.5, lunge: 3.5, style: 'melee' },
  heavy: { name: 'Pounce Heel', duration: .78, contacts: [.4212], damage: 65,
    range: 2.15, radius: .75, stamina: 24, cooldown: 1.18, stun: .65,
    knockback: 8.5, lunge: 4.5, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Static Claw', duration: 1.08, contacts: [.594], damage: 118,
    range: 2.25, radius: .85, stamina: 31, cooldown: 4.4, stun: .7,
    knockback: 9, lunge: 12, close: 6, style: 'melee' },
  ultimate: { name: 'Ninth Life: Thunder Pounce', duration: 3, contacts: [.42, 1.05, 1.62, 2.34],
    schedule: [32, 55, 56, 222], damage: 32, finisherDamage: 194,
    range: 2.25, radius: .85, stamina: 0, cooldown: 23, stun: 1.05,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 6.5, lunge: 11, style: 'melee', guardBreak: true,
    confirm: { recovery: .48 } },
};
export const MIKAGE_COMBOS: ComboRow = {
  lh: { name: 'Velvet Elbow', range: 1.95, radius: .7 },
  llh: { name: 'Rising Pounce', range: 2.1, radius: .72 },
  lllh: { name: 'Tailwhip Heel', range: 2.2, radius: .78 },
  llls: { name: 'Static Palm', range: 2.2, radius: .8 },
  airHeavy: { name: 'Aerial Pounce Heel', range: 2.15, radius: .78 },
  airSpecial: { name: 'Cat\'s Landing', radius: 3.1 },
};
export const MIKAGE_CONTACTS = {
  light: .44, heavy: .54, special: .55, ultimate: [.14, .35, .54, .78],
  rush: [.44, .48, .54],
  combos: { lh: .48, llh: .52, lllh: .54, llls: .55, airHeavy: .54, airSpecial: .54 },
} as const;
/** Authored breath, crossed-wrist compression, then palms peeling apart.
 * Entries are retimed to the common .9-second runtime, so swapAt is seconds. */
export const MIKAGE_AWAKENING: AwakeningDefinition = {
  name: 'HACKLES UP', kind: 'aura', aura: [0xf4eaff, 0xa663ee], auraGlow: .22,
  clips: ['HACKLES UP Release'], swapAt: .486,
};
