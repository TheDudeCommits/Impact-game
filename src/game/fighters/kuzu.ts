import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Chainsaw hybrid: every saw hit requires player input. The uploaded skin
 * contains no animation; these clips are authored for its arm/head saws.
 * The special closes distance physically and creates no ranged projectile. */
export const KUZU_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Sawtooth Swipe', duration: .42, contacts: [.152], damage: 21,
    range: 2.35, radius: .68, stamina: 9, cooldown: .42, stun: .29,
    knockback: 3, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Dovetail Cut', duration: .85, contacts: [.47], damage: 64,
    range: 2.55, radius: .92, stamina: 25, cooldown: 1.25, stun: .68,
    knockback: 8, lunge: 4.2, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Mad Dog Rush', duration: 1.2, contacts: [1.2 * .7 / 1.15], damage: 124,
    range: 2.65, radius: 1, stamina: 30, cooldown: 4.6, stun: .78,
    knockback: 10, lunge: 11, style: 'melee', outcome: 'wallBounce' },
  ultimate: { name: 'Devil’s Engine', duration: 2.81, contacts: [.48, 1, 1.4, 2.2],
    schedule: [38, 34, 34, 265], damage: 38, finisherDamage: 176,
    range: 2.7, radius: 1.1, stamina: 0, cooldown: 22, stun: .6,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5,
    style: 'melee', guardBreak: true, confirm: { recovery: .5 } },
};

export const KUZU_COMBOS: ComboRow = {
  lh: { name: 'Backtooth Swipe', range: 2.35, radius: .8 },
  llh: { name: 'Rising Tooth', range: 2.4, radius: .82 },
  lllh: { name: 'Dovetail Drop', range: 2.55, radius: .9 },
  llls: { name: 'Mad Dog Drive', range: 2.65, radius: .9 },
  airHeavy: { name: 'Falling Handsaw', range: 2.5, radius: .9 },
  airSpecial: { name: 'Devil’s Landing', radius: 3.1 },
};


/** A deliberate engine restart/rev, not a different four-arm form.
 * Three beats: grip the chest cord, pull it, flare both saw arms. Visual
 * motor heat supports manually cast attacks and has no damage of its own. */
export const KUZU_AWAKENING = {
  name: 'OFF THE LEASH', clip: 'Ripcord Awakening', duration: 2,
  beats: { grip: .4, pull: 1.04, engine: 1.4 }, manualOnly: true,
} as const;
