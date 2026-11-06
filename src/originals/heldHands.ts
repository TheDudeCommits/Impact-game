import type * as THREE from 'three';
import type { FighterId } from '../game/types';
import { ORIGINALS } from './roster';

const HELD: Partial<Record<FighterId, { readonly clips: readonly string[]; readonly joints: readonly string[] }>> = {
  gaunt: {
    clips: ['Crossbow Uppercut', 'Gaunt Air', 'Leap Cannon', 'Spin Bomb'],
    joints: ['LeftHand', 'RightHand', 'L_ForearmTwist01', 'L_ForearmTwist02', 'R_ForearmTwist01', 'R_ForearmTwist02'],
  },
};

/** The rows above applied to a body's clips, in place; anything not listed is left as it is. Returns the channels dropped. */
export function releaseHeldJoints(fighter: FighterId, clips: readonly THREE.AnimationClip[]): number {
  const row = ORIGINALS[fighter] ? HELD[fighter] : undefined;
  if (!row) return 0;
  let dropped = 0;
  for (const clip of clips) {
    if (!row.clips.includes(clip.name)) continue;
    const kept = clip.tracks.filter(track => {
      const dot = track.name.lastIndexOf('.');
      return !(track.name.slice(dot + 1) === 'quaternion' && row.joints.includes(track.name.slice(0, dot)));
    });
    dropped += clip.tracks.length - kept.length;
    clip.tracks = kept;
  }
  return dropped;
}
