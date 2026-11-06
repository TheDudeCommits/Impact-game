import * as THREE from 'three';
import type { Sculpt } from '../../render/rift/sculpt';
import type { FireSpot } from '../../render/rift/fire';
import type { Dress } from '../../render/rift/propModels';
import type { RiftProp, RiftStageId } from '../../game/riftLayouts';
import { INK_ON, inkMaterial, inkStageMaterial } from '../../render/rift/ink';
import { lookStageMaterial } from '../../render/look/stageMaterials';
import { addShaderPatch, replaceOnce } from '../../render/look/shaderPatch';
import { ARMOURY_WATER, STILL_WATER, armouryBeyond, armouryGround, armouryProp, type Beyond } from './drownedArmoury';
import { STAR_TEAR, starBeyond, starGround, starProp } from './fallenStar';

export function riftPlaceGround(stage: RiftStageId, x: number, z: number, halfX: number, halfZ: number): number | undefined {
  if (stage === 'rift-swords') return armouryGround(x, z, halfX, halfZ);
  if (stage === 'rift-eclipse') return starGround(x, z, halfX, halfZ);
  return undefined;
}

/** A prop of a rebuilt place, drawn its way. False: main draws it. */
export function riftPlaceProp(k: Sculpt, p: RiftProp, stage: RiftStageId, fires: FireSpot[]): boolean {
  if (stage === 'rift-swords') return armouryProp(k, p, fires);
  if (stage === 'rift-eclipse') return starProp(k, p, fires);
  return false;
}

const ARMOURY_OWN = new Set<RiftProp['kind']>(['statue', 'rock', 'sword', 'grave', 'stake']);
const STAR_OWN = new Set<RiftProp['kind']>(['stone', 'altar', 'stake', 'rock', 'grave']);
export function riftPlaceDress(stage: RiftStageId, p: RiftProp): Dress | undefined | 'main' {
  if (stage === 'rift-swords' && ARMOURY_OWN.has(p.kind)) return undefined;
  if (stage === 'rift-eclipse' && STAR_OWN.has(p.kind)) return undefined;
  return 'main';
}

export function riftPlaceBeyond(k: Sculpt, stage: RiftStageId, b: Beyond): boolean {
  if (stage === 'rift-swords') { armouryBeyond(k, b); return true; }
  if (stage === 'rift-eclipse') { starBeyond(k, b); return true; }
  return false;
}

/** A rebuilt place's water, where main lays the Harbour's sea: the Armoury's lake at the fight's floor. */
export function riftPlaceWater(stage: RiftStageId, root: THREE.Object3D, materials: THREE.Material[]) {
  if (stage !== 'rift-swords') return;
  const { size, y, color } = ARMOURY_WATER;
  const water = INK_ON ? inkStageMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: .1, metalness: .25 });
  water.name = 'rift-water';
  const looked = INK_ON ? water : lookStageMaterial(water, stage, 'water');
  inkMaterial(looked, { water: true });
  if (INK_ON) addShaderPatch(looked, 'armoury-still-water-v1', shader => {
    const at = 'outgoingLight = inkPage( inkValueHere, diffuseColor.rgb, inkLine, inkAway );';
    shader.fragmentShader = replaceOnce(shader.fragmentShader, at, STILL_WATER + '\n\t\t' + at, 'the armoury\'s still water');
  });
  materials.push(looked);
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), looked);
  lake.position.y = y; lake.name = 'rift-lake'; lake.receiveShadow = true;
  lake.matrixAutoUpdate = false; lake.updateMatrix();
  root.add(lake);
}

/** The sky's wound over a rebuilt place, moved where its concept tears it. */
export function riftPlaceTear(stage: RiftStageId, tear: THREE.Object3D) {
  if (stage !== 'rift-eclipse') return;
  tear.position.set(STAR_TEAR.x, STAR_TEAR.y, STAR_TEAR.z); tear.rotation.set(0, STAR_TEAR.yaw, STAR_TEAR.roll);
}
