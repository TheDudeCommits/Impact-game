/** A fighter's face lit as one form.
 *  The toon ramp lit a face from its mesh's own normals, so a nose, a brow and the eye sockets threw blotchy shadow
 *  shapes across it in a close moment (an intro, the knockout's painting, a transformation). A cel face is drawn with
 *  one clean shadow shape that wraps the head. Here the face's lighting normal is bent toward the sphere round the
 *  head's own centre - where a fragment rides the head bone wholly, faces the front and sits under the brow, so hair,
 *  ears and the back of the head keep their own shading.
 *
 *  Nothing is fitted by hand per fighter: FaceRig calibrates each fighter once, from the vertices that ride its head
 *  (their trimmed centroid and spread, so a mane of spikes does not drag the centre), with the body's facing and the
 *  neck-to-head line for forward and up, all kept in the head bone's own frame so the sphere turns with the head.
 *  ?ab=face lights faces as before. */
import * as THREE from 'three';
import { addShaderPatch, replaceOnce } from './shaderPatch';
import { abOff, onAbChange } from './abSwitch';

/** How far the face's normal is bent toward the sphere (0..1): the face's own form kept under it. */
export const FACE_LIGHT = { amount: .7 };
/** Every fighter's switch at once (?ab=face, and the probe's flip, which draws without a fighter's update). */
const faceOn = { value: abOff('face') ? 0 : 1 };
onAbChange(() => { faceOn.value = abOff('face') ? 0 : 1; });

export interface FaceLight {
  /** xyz: the head's centre (world); w: the face's reach (m). */
  uFaceCenter: { value: THREE.Vector4 };
  uFaceForward: { value: THREE.Vector3 };
  uFaceUp: { value: THREE.Vector3 };
  /** 0 until the fighter's head is calibrated (and with ?ab=face). */
  uFaceAmount: { value: number };
}
export function faceLightUniforms(): FaceLight {
  return { uFaceCenter: { value: new THREE.Vector4(0, 0, 0, 1) }, uFaceForward: { value: new THREE.Vector3(0, 0, 1) }, uFaceUp: { value: new THREE.Vector3(0, 1, 0) }, uFaceAmount: { value: 0 } };
}

/** The patch, on a fighter's toon body material (after look/toonShading's: it reads vLookHead, vLookWorld and
 *  LOOK_FACE). Each fighter's materials carry its own uniforms; the program is shared. */
export function applyFaceLight(material: THREE.Material, u: FaceLight) {
  addShaderPatch(material, 'look-face-light-v1', shader => {
    Object.assign(shader.uniforms, u);
    shader.uniforms.uFaceOn = faceOn;
    shader.fragmentShader = 'uniform vec4 uFaceCenter;\nuniform vec3 uFaceForward;\nuniform vec3 uFaceUp;\nuniform float uFaceAmount;\nuniform float uFaceOn;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	if ( uFaceAmount * uFaceOn > 0.0 ) {
		// the face's light from the sphere round the head's centre, where the fragment rides the head wholly,
		// faces the front, sits under the brow and inside the head's reach (the hair, the ears, the back of the head
		// keep their own).
		vec3 lookFrom = vLookWorld - uFaceCenter.xyz;
		float lookDist = length( lookFrom );
		vec3 lookDir = lookFrom / max( lookDist, 1e-4 );
		float lookFace = smoothstep( .85, .98, vLookHead ) * LOOK_FACE * uFaceAmount * uFaceOn
			* smoothstep( .05, .45, dot( lookDir, uFaceForward ) )
			* ( 1.0 - smoothstep( .3, .65, dot( lookFrom, uFaceUp ) / uFaceCenter.w ) )
			* ( 1.0 - smoothstep( 1.15, 1.6, lookDist / uFaceCenter.w ) );
		vec3 lookSphere = normalize( ( viewMatrix * vec4( lookDir, 0.0 ) ).xyz );
		// never past where the face's own normal and the sphere's disagree by about a right angle: a lit plane is never
		// turned into the shade by a sphere that fits it badly
		lookFace *= smoothstep( -.1, .35, dot( normal, lookSphere ) );
		if ( lookFace > 0.0 ) normal = normalize( mix( normal, lookSphere, lookFace ) );
	}`, 'face light');
  });
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _inv = new THREE.Matrix4();

/** One fighter's head, calibrated once from its vertices, then followed each frame. */
export class FaceRig {
  private readonly center = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private reach = 0;
  /** true once calibrated; false for a body with no head to find (its faces keep their own light). */
  ready = false;
  private tried = false;
  /** Calibrates from `meshes` (their `lookHead` attribute: the head weight) in the pose they stand in, the body facing
   *  `facing` (world). Once: answers whether a head was found. */
  calibrate(meshes: readonly THREE.Mesh[], head: THREE.Object3D, neck: THREE.Object3D | undefined, facing: THREE.Vector3) {
    if (this.tried) return this.ready;
    this.tried = true;
    head.updateWorldMatrix(true, false);
    const joint = head.getWorldPosition(new THREE.Vector3());
    const up = neck ? joint.clone().sub(neck.getWorldPosition(_q)) : new THREE.Vector3(0, 1, 0);
    if (up.lengthSq() < 1e-10) return false;
    up.normalize();
    const points: THREE.Vector3[] = [];
    for (const mesh of meshes) {
      const weights = mesh.geometry.getAttribute('lookHead');
      if (!weights) continue;
      mesh.updateWorldMatrix(true, false);
      const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? mesh as THREE.SkinnedMesh : undefined;
      const count = weights.count, step = Math.max(1, Math.floor(count / 3000));
      for (let i = 0; i < count; i += step) {
        if (weights.getX(i) < .98) continue;
        if (skinned) skinned.getVertexPosition(i, _p); else _p.fromBufferAttribute(mesh.geometry.getAttribute('position'), i);
        points.push(_p.clone().applyMatrix4(mesh.matrixWorld));
      }
    }
    if (points.length < 24) return false;
    // A trimmed centre: the points nearest the joint, then nearest their own mean, so a mane of spikes does not drag it.
    const nearest = (from: THREE.Vector3, share: number) => {
      const d = points.map(p => p.distanceTo(from)).sort((a, b) => a - b);
      const r = d[Math.min(d.length - 1, Math.floor(d.length * share))];
      const c = new THREE.Vector3(); let n = 0;
      for (const p of points) if (p.distanceTo(from) <= r) { c.add(p); n++; }
      return { c: n ? c.divideScalar(n) : from.clone(), r };
    };
    const first = nearest(joint, .5), second = nearest(first.c, .6);
    let reach = nearest(second.c, .7).r;
    if (!(reach > 1e-4)) return false;
    const forward = facing.clone().addScaledVector(up, -facing.dot(up));
    if (forward.lengthSq() < 1e-10) return false;
    forward.normalize();
    // The centre kept inside a skull round the joint, in the neck's lengths (or the reach's, with no neck): a face's
    // dense mesh drew a plain centroid forward toward the face itself (Kagari: 0.85 forward, 0.18 up), and a sphere
    // centred near the surface turns the face's lower half away from every light.
    const unit = neck ? joint.distanceTo(neck.getWorldPosition(_q)) : reach;
    const offset = second.c.clone().sub(joint), along = THREE.MathUtils.clamp(offset.dot(forward) / unit, -.15, .35), rise = THREE.MathUtils.clamp(offset.dot(up) / unit, .4, .9);
    second.c.copy(joint).addScaledVector(forward, along * unit).addScaledVector(up, rise * unit);
    reach = THREE.MathUtils.clamp(reach / unit, .8, 1.3) * unit;
    _inv.copy(head.matrixWorld).invert();
    this.center.copy(second.c).applyMatrix4(_inv);
    this.forward.copy(forward).transformDirection(_inv);
    this.up.copy(up).transformDirection(_inv);
    this.reach = reach;
    this.ready = true;
    return true;
  }
  /** The uniforms from the head as it stands (its world matrix as last updated). */
  update(u: FaceLight, head: THREE.Object3D) {
    if (!this.ready) { u.uFaceAmount.value = 0; return; }
    const m = head.matrixWorld;
    _p.copy(this.center).applyMatrix4(m);
    u.uFaceCenter.value.set(_p.x, _p.y, _p.z, this.reach);
    u.uFaceForward.value.copy(this.forward).transformDirection(m);
    u.uFaceUp.value.copy(this.up).transformDirection(m);
    u.uFaceAmount.value = FACE_LIGHT.amount;
  }
}
