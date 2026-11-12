import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Last Watch pressure boxer. Every strike and shockwave requires deliberate
 * player input. The sourced MHUR rig has no native animation: the signature
 * choreography is authored; only movement and reactions have a declared donor. */
export const FULL_BEAM_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Cape Horn Jab', duration: .44, contacts: [.168], damage: 22,
    range: 2.2, radius: .78, stamina: 9, cooldown: .44, stun: .33,
    knockback: 3.5, lunge: 3.4, style: 'melee' },
  heavy: { name: 'Land\'s End Chop', duration: .96, contacts: [.4992], damage: 65,
    range: 2.25, radius: .95, stamina: 25, cooldown: 1.21, stun: .72,
    knockback: 10, lunge: 3, style: 'melee', outcome: 'knockdown' },
  special: { name: 'Foghorn Blast', duration: 1.25, contacts: [.7], damage: 112,
    range: 24, radius: 1.05, stamina: 29, cooldown: 4.6, stun: .72,
    knockback: 10, speed: 28, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'Seven Seas Haymaker', duration: 3.4, contacts: [.51, 1.326, 2.72],
    schedule: [40, 51, 261], damage: 40, finisherDamage: 220,
    range: 2.35, radius: 1, stamina: 0, cooldown: 23, stun: .9,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 7, lunge: 11, style: 'melee', guardBreak: true,
    confirm: { recovery: .65 } },
};

export const FULL_BEAM_COMBOS: ComboRow = {
  lh: { name: 'Keeper\'s Backfist', range: 2.2, radius: .85 },
  llh: { name: 'Keeper\'s Uppercut', range: 2.25, radius: .9 },
  lllh: { name: 'Anchor Hammer', range: 2.3, radius: 1 },
  llls: { name: 'Pressure Front', range: 2.35, radius: .95 },
  airHeavy: { name: 'Aerial Hammer', range: 2.3, radius: .95 },
  airSpecial: { name: 'Meteor Landing', radius: 3.4 },
};


/** Source clip1.5s is driven through the established0.9s entry. These are
 * runtime seconds, including release/swap=.54; none of these beats deal damage. */
export const FULL_BEAM_AWAKENING = {
  name: 'Last Watch', clip: 'Last Watch', sourceDuration: 1.5,
  runtimeDuration: .9, model: '/assets/fighters/full-beam-mhur1.glb', height: 2.2,
  beats: { gather: .162, brace: .333, release: .54, settle: .711 },
  manualOnly: true,
} as const;

/** Renderer follows the confirmed authored timeline; it must not fire the final
 * pressure vortex on a miss, interruption or early target death. One impact
 * receipt owns the finish, with no additional VFX-driven simulation damage. */
export const FULL_BEAM_ULTIMATE_BEATS = {
  confirm: .51, cross: 1.326, gather: 1.734, overhead: 2.142,
  release: 2.72, recover: 3.06, end: 3.4,
} as const;
