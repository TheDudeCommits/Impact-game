import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Every damage contact is a manual attack. Fire is presentation only. */
export const BELLOWS_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Ingot Jab', duration: .45, contacts: [.168], damage: 22, range: 2.45, radius: .65,
    stamina: 11, cooldown: .45, stun: .31, knockback: 3.4, lunge: 4.3, style: 'melee' },
  heavy: { name: 'Smelter\'s Fist', duration: .96, contacts: [.51], damage: 65, range: 2.95, radius: .86,
    stamina: 27, cooldown: 1.24, stun: .73, knockback: 8.4, lunge: 4.9, style: 'melee', outcome: 'launch' },
  special: { name: 'Slag Lances', duration: 1.14, contacts: [.63], damage: 118, range: 25, radius: .95,
    stamina: 33, cooldown: 4.55, stun: .79, knockback: 8.2, speed: 29, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Meltdown', duration: 3.6, contacts: [.47, 1.55, 2.81], schedule: [42, 70, 236],
    damage: 42, finisherDamage: 216, range: 3, radius: 1.08, stamina: 0, cooldown: 24,
    stun: 1.25, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 6, close: 6,
    style: 'melee', guardBreak: true, confirm: { recovery: .56 } },
};
export const BELLOWS_COMBOS: ComboRow = {
  lh: { name: 'Clinker Backfist', range: 2.65, radius: .77 },
  llh: { name: 'Chimney Uppercut', range: 2.6, radius: .88 },
  lllh: { name: 'Steam Hammer', range: 2.85, radius: .96 },
  llls: { name: 'Slag Lance Burst', range: 3.1, radius: .96 },
  airHeavy: { name: 'Falling Smelt', range: 2.7, radius: .92 },
  airSpecial: { name: 'Cast-Iron Landing', radius: 3.45 },
};
export const BELLOWS_AWAKENING = {
  name: 'STOKED', clip: 'STOKED Ignition', duration: 1.5, entryDuration: .9,
  beats: { crossedCharge: .162, compress: .324, fistRaise: .522, release: .60 },
  manualOnly: true,
  canonScope: 'Gameplay STOKED concentration; no new transformation.',
} as const;
