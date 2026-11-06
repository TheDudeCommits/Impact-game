import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Post-timeskip Sorcery Clima-Tact kit. The weather effects are emitted by
 * deliberate player casts; neither awakening nor idle time creates attacks.
 * Native animation windows and visual contact anchors live beside the model
 * provenance; ordinary staff move names are descriptive gameplay labels. */
export const SORAYOMI_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Vane Thrust', duration: .44, contacts: [.168], damage: 20,
    range: 2.5, radius: .62, stamina: 9, cooldown: .44, stun: .28, knockback: 3,
    lunge: 3.6, style: 'melee' },
  heavy: { name: 'Windcup Crash', duration: .84, contacts: [.462], damage: 58,
    range: 2.6, radius: .82, stamina: 24, cooldown: 1.2, stun: .68, knockback: 8,
    lunge: 4, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Gust Spinner', duration: 1.32, contacts: [.8], damage: 122,
    range: 28, radius: 1.2, stamina: 30, cooldown: 4.6, stun: .75, knockback: 10,
    speed: 24, style: 'projectile', outcome: 'wallBounce', aimOnRelease: true },
  ultimate: { name: 'Storm Warning', duration: 2.75, contacts: [.55, 1.95],
    schedule: [46, 268], damage: 46, finisherDamage: 244, range: 24, radius: 1.15,
    stamina: 0, cooldown: 22, stun: 1.4, finisherStun: 2.3, knockback: 0,
    finisherKnockback: 16, style: 'beam', guardBreak: true, confirm: { recovery: .5 } },
};

export const SORAYOMI_COMBOS: ComboRow = {
  lh: { name: 'Vane Backcut', range: 2.5, radius: .8 },
  llh: { name: 'Rising Vane', range: 2.5, radius: .8 },
  lllh: { name: 'Cloudburst Downstroke', range: 2.6, radius: .85 },
  llls: { name: 'Static Thrust', range: 2.6, radius: .8 },
  airHeavy: { name: 'Descending Vane', range: 2.5, radius: .85 },
  airSpecial: { name: 'Groundstrike', radius: 3.2 },
};

/** Shared renderer integration data: normalized native source contact points.
 * At 30fps, combo_a crosses at16, combo_b descends at19, skill_a releases its
 * sweep at26, skill_b raises the weather charge at18 and commands it down at58.
 * These are measured visual anchors, not hidden source-game hit event data. */
export const SORAYOMI_CONTACTS = {
  light: 9 / 18,
  heavy: 11 / 20,
  special: 26 / 42,
  ultimate: [18 / 81, 58 / 81],
  rush: [11 / 20, 24 / 27, 16 / 24],
  combos: { lh: 9 / 17, llh: 11 / 18, lllh: 11 / 18, llls: 12 / 20,
    airHeavy: 11 / 18, airSpecial: 14 / 23 },
} as const;

/** Awakening is mastery of weather tools, not a Cursed Fruit transformation.
 * Its native crouch/raise/flourish has a dedicated cloud-ring presentation;
 * active weather attacks become stronger, with no automatic damage source. */
export const SORAYOMI_AWAKENING = {
  name: 'EYE OF THE STORM', clip: 'Storm Eye Awakening', duration: 44 / 30,
  beats: { gather: 12 / 30, rise: 24 / 30, release: 32 / 30 },
  manualOnly: true,
} as const;
