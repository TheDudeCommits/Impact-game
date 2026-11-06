import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { StageId } from '../game/stages';
import { BUILT_PLACES } from './stages';

export function ownStageModel(stage: StageId): Promise<GLTF> | undefined {
  if (!BUILT_PLACES[stage]) return undefined;
  const scene = new THREE.Group();
  scene.name = `${stage}: built in code`;
  return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' }, parser: undefined as never, userData: {} } as unknown as GLTF);
}
