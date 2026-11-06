import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Manual Snowfall sword dances. The frost is hit presentation;
 * it never creates persistent damage, autonomous summons or an auto attack. */
export const SHIJIMA_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Frostnote Cut', duration: .44, contacts: [.168], damage: 19, range: 2.45, radius: .62,
    stamina: 9, cooldown: .44, stun: .3, knockback: 3.2, lunge: 3.8, style: 'melee' },
  heavy: { name: 'First Carol: Snow Halo', duration: .94, contacts: [.51], damage: 59, range: 2.75, radius: .9,
    stamina: 24, cooldown: 1.35, stun: .76, knockback: 7.8, lunge: 3.4, style: 'melee', outcome: 'launch', lift: 5.8 },
  special: { name: 'Second Carol: Hoarfrost', duration: 1.12, contacts: [.64], damage: 119, range: 25, radius: 1.15,
    stamina: 32, cooldown: 4.7, stun: .84, knockback: 8.8, speed: 29, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Last Carol: Stillness', duration: 3.15, contacts: [.54, 1.58, 2.54], schedule: [54, 54, 228],
    damage: 54, finisherDamage: 182, range: 2.9, radius: .95, stamina: 0, cooldown: 23,
    stun: 1.25, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.8, close: 5.8,
    style: 'melee', guardBreak: true, confirm: { recovery: .48 } },
};
export const SHIJIMA_COMBOS: ComboRow = {
  lh: { name: 'Turning Descant', range: 2.55, radius: .72 },
  llh: { name: 'Rising Descant', range: 2.55, radius: .75 },
  lllh: { name: 'Falling Hush', range: 2.65, radius: .84 },
  llls: { name: 'Third Carol: Icebound Blade', range: 2.7, radius: .8 },
  airHeavy: { name: 'Falling Frostnote', range: 2.6, radius: .8 },
  airSpecial: { name: 'Graveside Snowfall', radius: 3.2 },
};
/** The transform swap's beats, in seconds. */
export const SHIJIMA_AWAKEN_BEATS = Object.freeze({ still: .18, lift: .36, release: .585, settle: .81 });
