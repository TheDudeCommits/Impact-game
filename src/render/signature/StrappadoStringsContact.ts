/** What the engine asks of StrappadoStrings.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). StrappadoStrings.ts re-exports it. */
import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
/** Native contact selection uses the visible hand or foot, including rushes. */
export function strappadoStrikeSocket(action: string, elapsed: number, clip?: string, contactIndex?: number): 'LeftHand' | 'RightHand' | 'LeftToeBase' | 'Both' {
  if (clip === 'Curtain Call' || action === 'ultimate' && !clip) return (contactIndex ?? (elapsed > 2.85 ? 2 : 0)) === 2 ? 'Both' : 'RightHand';
  if (clip === 'Tightrope Kick' || clip === 'Highwire Heel' || action === 'heavy' && !clip) return 'LeftToeBase';
  if (clip === 'Rush 2' || clip === 'Marionette Reversal') return 'LeftHand';
  if (clip === 'Puppeteer\'s Snare' || clip === 'Trapdoor Drop') return 'Both';
  return 'RightHand';
}
export function strappadoAuthoredKick(clip?: string) { return clip === 'Tightrope Kick' || clip === 'Highwire Heel'; }
export function strappadoStrikePoint(fighter: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, contactIndex?: number): THREE.Vector3 {
  const s = fighter.state;
  if (!clip && isEnderKey(s.branch)) clip = ({ lh: 'Marionette Reversal', llh: 'Wire Guillotine', lllh: 'Spool Burst', llls: 'Puppeteer\'s Snare', airHeavy: 'Highwire Heel', airSpecial: 'Trapdoor Drop' } as const)[s.branch];
  if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  const socket = strappadoStrikeSocket(s.action, sourceTime ?? s.actionTime * s.actionDuration, clip, contactIndex);
  if (socket === 'LeftToeBase') {
    const foot = fighter.bones.get('lefttoebase') ?? fighter.bones.get('leftfoot');
    if (foot) return foot.getWorldPosition(out);
  }
  if (socket === 'Both') return out.copy(fighter.handL).lerp(fighter.handR, .5);
  return out.copy(socket === 'LeftHand' ? fighter.handL : fighter.handR);
}
