import * as THREE from 'three';
import type { FighterId } from '../game/types';
import type { GhostPrint } from '../render/signature/GhostShell';
import { ORIGINALS } from './roster';

export function applyOriginalGuardianLooks<L extends { body: THREE.Color; rim: number; opacity: number; print: GhostPrint }>(looks: Partial<Record<FighterId, L>>) {
  const look = looks.akagane;
  if (!look || !ORIGINALS.akagane?.guardian) return looks;
  Object.assign(look, { body: new THREE.Color(1.9, .62, .16), rim: 0xffd2a0, opacity: .46 });
  look.print = { ...look.print, base: new THREE.Color(3.2, 3.2, 3.2), bases: undefined, shade: new THREE.Color(.5, .12, .03), light: new THREE.Color(3, 1.7, .8),
    line: 0xb8501e, levels: [.05, .7], flow: 1.6 };
  return looks;
}

/** The ghost EmperorEffects lays over Akagane's worn form while his Guardian stands (GUARDIAN_TINT, "blue, as his is"): Akagane's
 *  in the king's ember. */
export function applyOriginalGuardianTint(tints: Partial<Record<FighterId, { body: number; rim: number }>>) {
  if (ORIGINALS.akagane?.guardian) tints.akagane = { body: 0xd8642a, rim: 0xffc890 };
  return tints;
}
