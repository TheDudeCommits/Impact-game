// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * CharacterLink — what the ported self-buffs need from the character.
 *
 * Ported into VFX Armory (ext pack). The three buffs from
 * achrefelouafi/LinearAbilityExtThreeJS (MIT, Copyright (c) 2026
 * mohamedachrefelouafi) are worn by the body: they read its feet, facing and
 * height, hang flames on its skeleton (`writeBoneSegments`, from the source
 * repo's CharacterController) and shade its own materials with a fresnel
 * charge (`materials/FresnelAura.js`). The Armory's shared CharacterController
 * has the first three and not the last two, and the ability context carries no
 * character at all — so this adapter finds the live character on the app and
 * adds the skeleton list and the material patch from the outside, leaving the
 * shared core untouched.
 *
 * Until the app has booted (or if there is no rig), it answers with a 1.8 m
 * stand-in at the origin, so a buff never throws.
 */
import { Vector3 } from 'three';
import { applyFresnelAura } from './FresnelAura.js';

/** Same table as the source repo's CharacterController. */
const BONE_SEGMENTS = [
  { bone: 'Spine', weight: 2, radius: 0.085 },
  { bone: 'Spine1', weight: 2, radius: 0.09 },
  { bone: 'Spine2', weight: 2, radius: 0.09 },
  { bone: 'Neck', weight: 1, radius: 0.055 },
  { bone: 'Head', weight: 2, radius: 0.05 },
  { bone: 'LeftShoulder', weight: 1, radius: 0.05 },
  { bone: 'RightShoulder', weight: 1, radius: 0.05 },
  { bone: 'LeftArm', weight: 1, radius: 0.045 },
  { bone: 'RightArm', weight: 1, radius: 0.045 },
  { bone: 'LeftForeArm', weight: 2, radius: 0.04 },
  { bone: 'RightForeArm', weight: 2, radius: 0.04 },
  { bone: 'LeftHand', weight: 2, radius: 0.033 },
  { bone: 'RightHand', weight: 2, radius: 0.033 },
  { bone: 'LeftUpLeg', weight: 1, radius: 0.06 },
  { bone: 'RightUpLeg', weight: 1, radius: 0.06 },
  { bone: 'LeftLeg', weight: 2, radius: 0.056 },
  { bone: 'RightLeg', weight: 2, radius: 0.056 },
  { bone: 'LeftFoot', weight: 2, radius: 0.042 },
  { bone: 'RightFoot', weight: 2, radius: 0.042 },
  { bone: 'LeftToeBase', weight: 1, radius: 0.035 },
  { bone: 'RightToeBase', weight: 1, radius: 0.035 }
];

const shortBoneName = (name) => name.split(':').pop().replace(/^mixamorig/i, '');
const _joint = new Vector3();
const _origin = new Vector3();

/** Materials already carrying the aura patch — shared by every buff. */
const patched = new WeakSet();

export class CharacterLink {
  constructor(environment) {
    this.environment = environment;
    this._model = null;
    this.boneSegments = [];
  }

  /** The Armory's live CharacterController, once the app exists. */
  get rig() {
    return (typeof window !== 'undefined' && (window.__armory?.app?.character ?? window.app?.character)) || null;
  }

  get position() {
    return this.rig?.position ?? _origin;
  }

  get facing() {
    return this.rig?.facing ?? 0;
  }

  get height() {
    return this.rig?.height ?? 1.8;
  }

  /**
   * Make sure the rig is patched and measured. Cheap after the first call;
   * re-runs only if the model object changes.
   */
  sync() {
    const model = this.rig?.model;
    if (!model || model === this._model) return;
    this._model = model;

    // Fresnel aura on the body's own materials. Patched after the fact, so the
    // material is flagged for a recompile — a one-off hitch on the first buff.
    model.traverse((node) => {
      if (!node.isMesh && !node.isSkinnedMesh) return;
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of list) {
        if (!material || patched.has(material) || !material.isMeshStandardMaterial) continue;
        patched.add(material);
        applyFresnelAura(material, this.environment);
        material.needsUpdate = true;
      }
    });

    // The skeleton as weighted limb segments.
    const bones = new Map();
    model.traverse((node) => {
      if (!node.isBone) return;
      const short = shortBoneName(node.name);
      if (!bones.has(short)) bones.set(short, node);
    });
    this.boneSegments = [];
    const height = this.height;
    for (const entry of BONE_SEGMENTS) {
      const bone = bones.get(entry.bone);
      if (!bone || !bone.parent?.isBone) continue;
      for (let i = 0; i < entry.weight; i++) {
        this.boneSegments.push({ bone, parent: bone.parent, radius: entry.radius * height });
      }
    }
  }

  /** Same contract as the source repo's CharacterController#writeBoneSegments. */
  writeBoneSegments(a, b) {
    this.sync();
    const count = Math.min(this.boneSegments.length, a.length, b.length);
    if (count > 0) this.rig?.root?.updateMatrixWorld(true);
    for (let i = 0; i < count; i++) {
      const segment = this.boneSegments[i];
      _joint.setFromMatrixPosition(segment.parent.matrixWorld);
      a[i].set(_joint.x, _joint.y, _joint.z, segment.radius);
      _joint.setFromMatrixPosition(segment.bone.matrixWorld);
      b[i].set(_joint.x, _joint.y, _joint.z, 0);
    }
    return count;
  }
}
