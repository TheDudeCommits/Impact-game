import type * as THREE from 'three';
import { stageLook, type MoveStage } from '../render/signature/MoveStage';
import { ORIGINALS } from './roster';

/** Her lilac (roster colour #dca4f4): a white heart, the lilac body and a violet rim, in the stage's bloom range. */
const LILAC = stageLook(0xfff3ff, 0xdca4f4, 0x8a4fd0);

/** On the frame Kyoumei-Ha lands: `ground` is the floor under the blast, `born` the hit's time, `big` the module's own scale
 *  for this throw (a branch or an Armory casting draws it a little smaller). */
export function suzuranAfterRing(st: MoveStage, ground: THREE.Vector3, born: number, big: number) {
  if (!ORIGINALS.suzuran) return;
  // The stone the blast struck, left glowing lilac and fading over two and a half seconds.
  st.scar(ground, LILAC, 2.6 * big, born + .12, 2.5);
  // The after-ring: three rings over the floor, each a beat later, wider and slower than the one before.
  for (let i = 0; i < 3; i++) st.shock(ground, LILAC, (4.2 + 1.6 * i) * big, born + .22 + .34 * i, .75 + .15 * i);
}
