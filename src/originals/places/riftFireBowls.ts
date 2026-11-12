/** The Rift's stone fire bowls: THE FROZEN SHRINE's approach and graves and THE CRIMSON GROVE's clearing set stone lights
 *  along the fight (src/render/rift/RiftStage.ts, the `lantern` prop). Each is a stone fire bowl on a foot and a shaft, on
 *  the prop's footprint (the layout, its collision and what breaks are RiftStage's): a wide shallow bowl, its embers in it -
 *  the Shrine's cold, the Grove's red, and a small fire in the Grove's. */
import type { Sculpt } from '../../render/rift/sculpt';
import type { FireSpot } from '../../render/rift/fire';
import type { RiftProp, RiftStageId } from '../../game/riftLayouts';

/** A Shrine's or Grove's `lantern` prop drawn as a stone fire bowl; false: not one of theirs. */
export function fireBowl(k: Sculpt, p: RiftProp, stage: RiftStageId, fires: FireSpot[]): boolean {
  if (p.kind !== 'lantern' || (stage !== 'rift-frost' && stage !== 'rift-grove')) return false;
  const cold = stage === 'rift-frost';
  k.use('stone', cold ? 0x8a929c : 0x5a5650, .08)
    .cylinder(p.x, 0, p.z, .36, .2, 6).cylinder(p.x, .2, p.z, .14, .86, 6).cylinder(p.x, 1.02, p.z, .2, .12, 8)
    .cylinder(p.x, 1.14, p.z, .26, .24, 10, p.rot, 0, 0, .46 / .26);
  k.use('glow', cold ? 0x5aa8ff : 0xff4a22).cylinder(p.x, 1.32, p.z, .38, .05, 10);
  if (!cold && p.seed > .4) fires.push({ x: p.x, y: 1.36, z: p.z, size: .45, smoke: .12, seed: p.seed * 10 });
  return true;
}
