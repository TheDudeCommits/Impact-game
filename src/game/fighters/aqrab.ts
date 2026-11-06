import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
/** Sand is contact presentation: no autonomous tornado, aura ticks or summons. */
export const AQRAB_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Pincer Slash', duration: .47, contacts: [.168], damage: 22, range: 2.65, radius: .78, stamina: 11, cooldown: .47, stun: .33, knockback: 3.6, lunge: 4, style: 'melee' },
  heavy: { name: 'Stinger Line', duration: .96, contacts: [.44], damage: 65, range: 3.05, radius: .96, stamina: 28, cooldown: 1.25, stun: .75, knockback: 8.5, lunge: 3.5, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Thirst Storm', duration: 1.35, contacts: [.58], damage: 118, range: 24, radius: 1.05, stamina: 35, cooldown: 5.2, stun: .8, knockback: 9, speed: 22, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Bone Dry', duration: 3.3, contacts: [.34, 1.315, 2.298], schedule: [45, 65, 239], damage: 45, finisherDamage: 210, range: 3.15, radius: 1.16, stamina: 0, cooldown: 24, stun: 1.2, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.6, close: 6, style: 'melee', guardBreak: true, confirm: { recovery: .57 } },
};
export const AQRAB_COMBOS: ComboRow = {
  lh: { name: 'Golden Pincer', range: 2.8, radius: .84 },
  llh: { name: 'Antlion Pit', range: 2.8, radius: .88 },
  lllh: { name: 'Dune Shackle', range: 3, radius: .97 },
  llls: { name: 'Thirst Burst', range: 3.1, radius: 1 },
  airHeavy: { name: 'Dune Breaker', range: 2.95, radius: .97 },
  airSpecial: { name: 'Stinger Drop', radius: 3.6 },
};
export const AQRAB_AWAKENING = { name: 'DRY SEASON', clip: 'DRY SEASON', duration: 44 / 30, entryDuration: .9, beats: { raise: .25, release: .46, settle: .78 }, manualOnly: true, canonScope: 'Gameplay sand mastery stance; no new physical transformation.' } as const;
export const AQRAB_CONTACTS = { light: .25 / .58, heavy: .44 / 1.1, special: .58 / 1.35, ultimate: [.34 / 4.1, 1.48 / 4.1, 3.10 / 4.1], rush: [.24 / .52, .25 / .58, .36 / .74], combos: { lh: .34 / .76, llh: .38 / .84, lllh: .47, llls: .55 / 1.1, airHeavy: .47, airSpecial: .5 } } as const;
/** Source-native combo A/B lead with left hook; C and bone-dry palms right. */
export function aqrabStrikeSide(action: string, elapsed = 0, clip?: string): 'Left' | 'Right' {
  if (clip && ['Pincer Slash', 'Rush 1', 'Rush 2', 'Golden Pincer', 'Antlion Pit'].includes(clip)) return 'Left';
  if (action === 'special' || action === 'heavy' || action === 'ultimate' && elapsed >= .8 || clip && ['Rush 3', 'Dune Shackle', 'Thirst Burst', 'Dune Breaker', 'Stinger Drop'].includes(clip)) return 'Right';
  return 'Left';
}
