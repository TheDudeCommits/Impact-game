import fs from 'node:fs';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { bindClips } from '../src/render/Fighter';
import type { FighterId } from '../src/game/types';
import { loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';

/** A fighter's shipped body with the clips shipped beside it joined in, the
 *  way FighterLibrary.load does it (round 3's `extraModels`): bound by bone
 *  name onto the body, a clip named like one of the body's replacing it. */
export async function loadRigWithExtras(fighter: FighterId): Promise<GLTF> {
  const rig = await loadRig(FIGHTERS[fighter].model);
  const rush = ORIGINALS[fighter] && FIGHTERS[fighter].rushModel ? [FIGHTERS[fighter].rushModel!] : [];
  for (const url of [...rush, ...FIGHTERS[fighter].extraModels ?? []]) {
    const clips = bindClips(rig.scene, (await loadRig(url)).animations, fighter);
    const names = new Set(clips.map(clip => clip.name));
    rig.animations = [...rig.animations.filter(clip => !names.has(clip.name)), ...clips];
  }
  return rig;
}

/** The JSON chunk of a GLB, for checking what a file carries. */
export function glbJson(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  return JSON.parse(file.subarray(20, 20 + length).toString()) as {
    nodes: { name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; mesh?: number }[];
    animations?: { name: string; channels: { sampler: number; target: { node: number; path: string } }[] }[];
    skins?: { joints: number[] }[]; meshes?: unknown[]; materials?: unknown[]; images?: unknown[];
  };
}

export async function rushStages(fighter: FighterId, rig: GLTF) {
  const def = FIGHTERS[fighter];
  if (def.rushModel) return bindClips(rig.scene, (await loadRig(def.rushModel)).animations, fighter);
  const stages = new Map<string, ReturnType<typeof bindClips>[number]>();
  for (const url of def.extraModels ?? []) for (const clip of bindClips(rig.scene, (await loadRig(url)).animations, fighter)) if (def.rushClips?.includes(clip.name)) stages.set(clip.name, clip);
  return [...stages.values()];
}
