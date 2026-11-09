/** What the engine asks of RakuchoTendrils.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). RakuchoTendrils.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { RAKUCHO, rakuchoTip } from '../../originals/rakuchoRibbons';
/** Actual native front knuckle vertex5013 in RightHand local coordinates. */
export const RAKUCHO_KNUCKLE_LOCAL = Object.freeze([.085805319, -.033871409, -.017292341] as const);
export const RAKUCHO_TIP_LENGTHS = Object.freeze([.17629492282867432, .1773757040500641, .06668964773416519, .06647805869579315] as const);
export function rakuchoStrikeJoint(action: string, clip?: string, contactIndex = 0): string {
  if (action === 'ultimate' && (!clip || clip === 'Last Chapter')) return contactIndex === 0 ? 'RightHand' : contactIndex === 2 ? 'Tendrils2_8' : 'Tendrils1_8';
  if (['Torn Page', 'Rush 1'].includes(clip ?? '') || (!clip && action === 'light')) return 'RightHand';
  return ['Rush 2', 'Silverfish Cross'].includes(clip ?? '') ? 'Tendrils2_8' : 'Tendrils1_8';
}
/** Allow only the bounded authored body step; later Tendrils commands retain the
 * ordinary capsule constraint. Times are source clip seconds, not entry clocks. */
export function rakuchoAuthoredJabStep(clip: string | undefined, sourceSeconds: number): boolean {
  if (!Number.isFinite(sourceSeconds) || sourceSeconds < 0) return false;
  if (clip === 'Torn Page' || clip === 'Rush 1') return sourceSeconds < .60;
  return clip === 'Last Chapter' && sourceSeconds < .8625;
}
/** Native visible appendage tip, including the currently shown awakened body. */
export function rakuchoContactPoint(f: Pick<Fighter, 'shownBody' | 'drawnJoint'>, action: string, clip: string | undefined, index: number, out: THREE.Vector3): boolean {
  const name = rakuchoStrikeJoint(action, clip, index);
  if (name === 'RightHand') { const hand = f.drawnJoint(name); if (!hand) return false; out.set(...RAKUCHO_KNUCKLE_LOCAL); hand.localToWorld(out); return true; }
  const node = f.shownBody.model.getObjectByName(name); if (!node) return RAKUCHO && rakuchoTip(f, name, out); // no tails on Rakucho's bodies; the ribbon doing that tail's work, while it is out
  const tail = Number(name[7]) - 1; out.set(0, RAKUCHO_TIP_LENGTHS[tail] ?? RAKUCHO_TIP_LENGTHS[0], 0); node.localToWorld(out); return true;
}
