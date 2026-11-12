/** THE MANGA HARBOUR (`harbor`, the stand-in a fight falls back to when its place will not load:
 *  src/render/ArenaEnvironment.ts) with no lanterns: beside each of the street's six wall posters a torch in an iron bracket
 *  on the wall, unlit (a pitch-black head: the harbour's light is the day's), and two cold stone fire bowls standing at the
 *  torii's feet. Nothing here is solid (the collision is ArenaEnvironment's). One hooked line in ArenaEnvironment.ts. */
import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { Forge } from './forge';
import { fireBowl, wallTorch, type FireMats } from './standingFire';

/** The street's posters (x, z, the way their wall faces: +1 toward +x) and the torii's feet; returns what to dispose. */
export function harbourFires(root: THREE.Group, posters: readonly (readonly [number, number])[], torii: { x: number; y: number; z: number }) {
  const f = new Forge({ stage: 'harbor', root } as unknown as DressContext, 'harbour fires');
  f.mat('iron', { roughness: .55, metalness: .45 });
  f.mat('wood', { roughness: .85 });
  f.mat('stone', { roughness: .92 });
  f.mat('ash', { roughness: 1 });
  const m: FireMats = { iron: 'iron', wood: 'wood', stone: 'stone', glow: 'ash' };
  // A torch on the poster's wall, a little to its side, at the height the lantern hung, its head unlit.
  for (const [x, z] of posters) wallTorch(f, m, x, 2.75, z + 1.25, -Math.sign(x), 0, { scale: 1.3, lit: false });
  for (const dx of [-4.8, 4.8]) fireBowl(f, m, torii.x + dx, torii.y, torii.z + 1.4, .5, 1.05, { tint: 0x8a8478, cold: true, square: true });
  const meshes = f.done();
  return { geometries: meshes.map(mesh => mesh.geometry), materials: meshes.map(mesh => mesh.material as THREE.Material) };
}
