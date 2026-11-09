/** What the engine asks of ShakudoAlchemy.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). ShakudoAlchemy.ts re-exports it. */
import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
const BRANCH = Object.freeze({ lh: 'Swage', llh: 'Upset', lllh: 'Drop Forge', llls: 'Stone Breaker', airHeavy: 'Anvil Drop', airSpecial: 'Slag Fall' });
export const SHAKUDO_BLADE_SOCKET = Object.freeze({ joint: 'ShakudoBladeTip', tip: Object.freeze([-.0895596656990405, -.32976020227090624, .11274550202276012]), sourceVertex: 196 });
export function shakudoStrikeSocket(action: string, elapsed: number, clip?: string, index?: number): 'RightHand' | 'LeftHand' | 'LeftToeBase' | 'Both' | 'Blade' {
  if (clip === 'TANREN: White Heat' || action === 'ultimate' && !clip) { const contact = index ?? (elapsed > 2.9 ? 2 : elapsed > .95 ? 1 : 0); return contact === 2 ? 'Both' : contact === 1 ? 'Blade' : 'RightHand'; }
  if (clip === 'Hot Edge' || clip === 'Drop Forge' || action === 'heavy' && !clip) return 'Blade';
  if (clip === 'Bedrock Pike' || clip === 'Stone Breaker' || clip === 'Slag Fall' || action === 'special' && !clip) return 'Both';
  if (clip === 'Anvil Drop') return 'LeftToeBase'; if (clip === 'Rush 2') return 'LeftHand'; return 'RightHand';
}
export function shakudoAuthoredKick(clip?: string) { return clip === 'Anvil Drop'; }
export function shakudoAuthoredGround(clip?: string) { return clip === 'Bedrock Pike' || clip === 'Stone Breaker' || clip === 'Slag Fall' || clip === 'TANREN: White Heat'; }
export function shakudoStrikePoint(f: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, index?: number) {
  const s = f.state; if (!clip && isEnderKey(s.branch)) clip = BRANCH[s.branch]; if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  const joint = shakudoStrikeSocket(s.action, sourceTime ?? s.actionTime * s.actionDuration, clip, index);
  if (joint === 'Both') return out.copy(f.handL).lerp(f.handR, .5);
  if (joint === 'Blade') { const b = f.bones?.get('shakudobladetip'); if (b) return b.localToWorld(out.set(SHAKUDO_BLADE_SOCKET.tip[0], SHAKUDO_BLADE_SOCKET.tip[1], SHAKUDO_BLADE_SOCKET.tip[2])); }
  if (joint === 'LeftToeBase') { const b = f.bones?.get('lefttoebase') ?? f.bones?.get('leftfoot'); if (b) return b.getWorldPosition(out); }
  return out.copy(joint === 'LeftHand' ? f.handL : f.handR);
}
