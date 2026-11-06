import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
import type { AwakeningDefinition } from '../awakening';

/** Pika Pika pressure: every kick, ray and bead barrage belongs to a manual
 * action. BLINDING NOON is a presentation state with no automatic damage. */
export const SENKO_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Glimmer Kick', duration: .47, contacts: [.168], damage: 21,
    range: 2.35, radius: .65, stamina: 10, cooldown: .47, stun: .31,
    knockback: 3, lunge: 3.8, style: 'melee' },
  heavy: { name: 'Searchlight Heel', duration: .85, contacts: [.46896551724], damage: 65,
    range: 2.55, radius: .78, stamina: 25, cooldown: 1.28, stun: .65,
    knockback: 6.5, lunge: 4, style: 'melee', outcome: 'spin' },
  special: { name: 'Fingertip Glare', duration: 1.05, contacts: [.4515], damage: 118,
    range: 26, radius: .57, stamina: 32, cooldown: 4.4, stun: .7,
    knockback: 8, style: 'beam', outcome: 'wallBounce' },
  ultimate: { name: 'Troop of a Hundred Lights', duration: 3.45, contacts: [.39, 1.32, 1.92, 2.74],
    schedule: [30, 70, 65, 196], damage: 30, finisherDamage: 200,
    range: 2.5, radius: .9, stamina: 0, cooldown: 24, stun: 1.05,
    finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    close: 6.5, lunge: 11, style: 'melee', guardBreak: true,
    confirm: { recovery: .48 } },
};
export const SENKO_COMBOS: ComboRow = {
  lh: { name: 'Prism Roundhouse', range: 2.45, radius: .75 },
  llh: { name: 'Rising Beam', range: 2.5, radius: .75 },
  lllh: { name: 'Glare Heel Drop', range: 2.6, radius: .82 },
  llls: { name: 'Beacon Kick', range: 2.4, radius: .78 },
  airHeavy: { name: 'Aerial Halo Wheel', range: 2.5, radius: .8 },
  airSpecial: { name: 'Noonfall', radius: 3.2 },
};
export const SENKO_CONTACTS = {
  light: 14.5 / 32, heavy: 16 / 29, special: .43,
  ultimate: [.39 / 3.45, 1.32 / 3.45, 1.92 / 3.45, 2.74 / 3.45],
  rush: [14.5 / 31, 16 / 29, 23.5 / 43],
  combos: { lh: 16 / 29, llh: 17 / 30, lllh: 23.5 / 43, llls: 14.5 / 32, airHeavy: 16 / 29, airSpecial: 23.5 / 43 },
} as const;
export const SENKO_AWAKENING: AwakeningDefinition = {
  name: 'BLINDING NOON', kind: 'aura', aura: [0xfffbe4, 0xf9c238], auraGlow: .17,
  clips: ['BLINDING NOON'], swapAt: .36,
};
export const SENKO_CINEMATIC = {
  opener: { clip: 'Troop of a Hundred Lights', at: .39 / 3.45 },
  cine: { from: .66 / 3.45, at: 2.74 / 3.45,
    windows: [[.66 / 3.45, 1.62 / 3.45, 1.32 / 3.45], [1.62 / 3.45, 2.3 / 3.45, 1.92 / 3.45], [2.3 / 3.45, 1, 2.74 / 3.45]] },
} as const;
export type SenkoHand = 'Open' | 'Point' | 'Beads';
/** Mutually exclusive native hand meshes. Use the drawn clip clock after
 * contact warping; all variant geometry is visual-only and has no hitbox. */
export function senkoHandVariants(action: string, elapsed: number, clip?: string): readonly [SenkoHand, SenkoHand] {
  if (action === 'ultimate' && clip === 'Troop of a Hundred Lights' && elapsed >= .86 && elapsed < 2.8) return ['Beads', 'Beads'];
  if (action === 'special' && clip === 'Fingertip Glare') return ['Open', 'Point'];
  if (action === 'awaken') return ['Open', 'Point'];
  return ['Open', 'Open'];
}
/** The native moves use both feet. The ultimate opens with a kick before
 * its hand gesture; read the drawn clip clock rather than the action clock. */
export function senkoStrikeJoint(clip: string | undefined, clipTime = 0, index = 0): string {
  if (clip === 'Glimmer Kick' || clip === 'Rush 1' || clip === 'Rush 3' || clip === 'Glare Heel Drop' || clip === 'Beacon Kick' || clip === 'Noonfall') return 'RightFoot';
  if (clip === 'Searchlight Heel' || clip === 'Rush 2' || clip === 'Prism Roundhouse' || clip === 'Aerial Halo Wheel') return 'LeftFoot';
  if (clip === 'Rising Beam') return 'LeftLeg';
  if (clip === 'Troop of a Hundred Lights') return clipTime < .66 ? 'RightFoot' : index % 2 ? 'LeftHand' : 'RightHand';
  return 'RightHand';
}
export function senkoAuthoredKick(clip: string | undefined, clipTime = 0): boolean {
  const joint = senkoStrikeJoint(clip, clipTime);
  return joint === 'RightFoot' || joint === 'LeftFoot' || joint === 'LeftLeg';
}
