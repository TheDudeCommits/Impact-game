/** What the engine asks of ShibuichiBastion.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). ShibuichiBastion.ts re-exports it. */
import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import { shibuichiStrikeJoint } from '../../game/fighters/shibuichi';
import type { Fighter } from '../Fighter';
const BRANCH = Object.freeze({ lh: 'Backhand Peen', llh: 'Raised Seam', lllh: 'Elbow Peen', llls: 'Ground Quench', airHeavy: 'Heel Set', airSpecial: 'Falling Mantle' });
export function shibuichiStrikePoint(f: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, index?: number) {
  const s = f.state; if (!clip && isEnderKey(s.branch)) clip = BRANCH[s.branch]; if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  if (!clip) clip = s.action === 'heavy' ? 'Billet Ram' : s.action === 'special' ? 'Quench Palm' : s.action === 'ultimate' ? 'KINTSUGI: Golden Seam' : 'Planish';
  const i = index ?? ((sourceTime ?? s.actionTime * s.actionDuration) > 3.2 ? 2 : (sourceTime ?? s.actionTime * s.actionDuration) > 1 ? 1 : 0);
  const joint = shibuichiStrikeJoint(clip, i); if (joint === 'BothHands') return out.copy(f.handL).lerp(f.handR, .5);
  if (joint === 'RightHand' || joint === 'LeftHand') return out.copy(joint === 'RightHand' ? f.handR : f.handL);
  const bone = f.bones?.get(joint.toLowerCase()); if (bone) return bone.getWorldPosition(out); return out.copy(f.handR);
}
