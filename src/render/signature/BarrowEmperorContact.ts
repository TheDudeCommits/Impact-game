/** What the engine asks of BarrowEmperor.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). BarrowEmperor.ts re-exports it. */
import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
/** Exact source-native contacts differ between the two costume performances.
 * Resolved from skinned contact renders, never inferred from move labels. */
export type BarrowSocket = 'LeftHand' | 'RightHand' | 'LeftToeBase' | 'RightToeBase' | 'Both';
export function barrowStrikeSocket(action: string, elapsed: number, clip?: string, contactIndex?: number, outfitId?: string): BarrowSocket {
  const original = outfitId === 'outfit-barrow-classic';
  if (clip === 'Jettison: Full Hold' || action === 'ultimate' && !clip) {
    const contact = contactIndex ?? (elapsed < .95 ? 0 : elapsed < 2.9 ? 1 : 2);
    return contact === 2 ? 'Both' : contact === 0 ? original ? 'LeftHand' : 'RightHand' : original ? 'RightHand' : 'LeftToeBase';
  }
  if (clip === 'Glutton Heel') return 'LeftToeBase';
  if (clip === 'Tremor Uppercut') return original ? 'RightToeBase' : 'LeftToeBase';
  if (clip === 'Rush 3') return 'LeftToeBase';
  if (clip === 'Stolen Quake' || clip === 'Reef Breaker' || action === 'heavy' && !clip) return original ? 'RightHand' : 'LeftToeBase';
  if (clip === 'Tarfall') return original ? 'RightHand' : 'Both';
  if (clip === 'Pitch Backfist' || clip === 'Tar Jab' || clip === 'Rush 1' || action === 'light' && !clip) return original ? 'LeftHand' : 'RightHand';
  return 'RightHand';
}
export function barrowAuthoredKick(clip?: string, outfitId?: string, elapsed = 0): boolean {
  const original = outfitId === 'outfit-barrow-classic';
  if (clip === 'Rush 3' || clip === 'Tremor Uppercut' || clip === 'Glutton Heel') return true;
  if (original) return false;
  return clip === 'Stolen Quake' || clip === 'Reef Breaker' || clip === 'Jettison: Full Hold' && elapsed > .95 && elapsed < 2.15;
}
/** Optional clip/index are supplied by Fighter's active action; the state-only
 * fallback keeps the presentation helper independent of private mixer state. */
export function barrowStrikePoint(fighter: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, contactIndex?: number): THREE.Vector3 {
  const s = fighter.state;
  if (!clip && isEnderKey(s.branch)) clip = ({ lh: 'Pitch Backfist', llh: 'Tremor Uppercut', lllh: 'Reef Breaker', llls: 'Sinkhole Crash', airHeavy: 'Glutton Heel', airSpecial: 'Tarfall' } as const)[s.branch];
  if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  const socket = barrowStrikeSocket(s.action, sourceTime ?? s.actionTime * s.actionDuration, clip, contactIndex, fighter.outfitId ?? s.outfit);
  if (socket === 'Both') return out.copy(fighter.handL).lerp(fighter.handR, .5);
  if (socket.endsWith('ToeBase')) {
    const bone = fighter.bones?.get(socket.toLowerCase()) ?? fighter.bones?.get(socket.replace('ToeBase', 'Foot').toLowerCase());
    if (bone) return bone.getWorldPosition(out);
  }
  return out.copy(socket === 'LeftHand' ? fighter.handL : fighter.handR);
}
