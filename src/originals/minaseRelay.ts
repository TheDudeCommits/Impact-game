import * as THREE from 'three';
import type { SphereStyle } from '../render/signature/EnergySphere';
import { stageLook, type StageLook } from '../render/signature/MoveStage';
import { originalBody } from './launch';

export const MINASE = originalBody('minase');

export const GALE_SPHERE: SphereStyle = { body: new THREE.Color(1.55, .8, .1), core: new THREE.Color(2.9, 2.55, 1.7), rimA: new THREE.Color(2.7, 1.55, .3), rimB: new THREE.Color(2.9, 2.3, 1.1), spin: 1.25 };
/** The gale palm's look on the stage (burst, dome, shock, scar, light): white into gold into amber. */
export const GALE: StageLook = stageLook(0xfff3d2, 0xffb21f, 0x8a4c08, { sphere: GALE_SPHERE });

export interface RelayBatch { add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, c: THREE.Color, gain: number): void }

const GOLD = new THREE.Color(2.6, 1.55, .25), PALE = new THREE.Color(3, 2.6, 1.6), AMBER = new THREE.Color(2.2, 1.0, .12), STEEL = new THREE.Color(2.3, 2.4, 2.6);
const UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
/** How many flecks of ash can turn at once, over every sphere on screen. */
const ASH = 96;

export class MinaseRelay {
  /** The ash: dark flecks, drawn over the glowing sphere with ordinary blending (light can't draw a dark fleck). */
  private readonly ash: THREE.InstancedMesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  private count = 0; private readonly o = new THREE.Object3D();
  private readonly q = new THREE.Quaternion(); private readonly q2 = new THREE.Quaternion(); private readonly p = new THREE.Vector3(); private readonly d = new THREE.Vector3();
  private readonly flat = new THREE.Quaternion().setFromAxisAngle(X, -Math.PI / 2);
  constructor(scene: THREE.Scene) {
    const material = new THREE.MeshBasicMaterial({ color: 0x2b2622, transparent: true, opacity: .85, depthWrite: false, toneMapped: false });
    this.ash = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), material, ASH);
    this.ash.name = 'minase-ash'; this.ash.frustumCulled = false; this.ash.renderOrder = 7; this.ash.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // (Held drawable from the start, one fleck at no size, so its program links in the room's load.)
    this.o.scale.setScalar(0); this.o.updateMatrix(); this.ash.setMatrixAt(0, this.o.matrix); this.ash.count = 1;
    scene.add(this.ash);
  }
  begin() { this.count = 0; }
  end() {
    if (!this.count) { this.o.scale.setScalar(0); this.o.updateMatrix(); this.ash.setMatrixAt(0, this.o.matrix); }
    this.ash.count = Math.max(1, this.count); this.ash.instanceMatrix.needsUpdate = true;
  }

  gyre(arcs: RelayBatch, at: THREE.Vector3, radius: number, fade: number, time: number, seed: number, spin = 1, detail = 1) {
    if (fade <= .02 || radius <= .02) return;
    const count = detail >= .65 ? 6 : 4;
    for (let j = 0; j < count; j++) {
      const i = j % 3, half = Math.floor(j / 3);
      // Three axes a third of a turn apart, each ring spinning about its own normal as the axis itself precesses.
      this.q.setFromAxisAngle(UP, seed + i * TAU / 3 + time * (1.1 + .3 * i) * spin);
      this.q2.setFromAxisAngle(X, .55 + .45 * i + Math.sin(time * 2.3 + i) * .25); this.q.multiply(this.q2);
      this.q2.setFromAxisAngle(Z, time * (7 + 2.5 * i) * spin + half * Math.PI); this.q.multiply(this.q2);
      const r = radius * (1.28 + .14 * i);
      arcs.add(at, this.q, r, r, r * .45, i === 1 ? PALE : GOLD, fade * (.8 - .1 * i));
    }
    const n = Math.round((detail >= .65 ? 14 : 9) * Math.min(1.6, .6 + radius * 2.2));
    for (let i = 0; i < n && this.count < ASH; i++) {
      const k = hash(seed + i * 3.7), orbit = radius * (.55 + .7 * hash(seed + i * 1.3)), ang = time * (5 + 4 * k) * spin + i * 2.399963 + seed;
      const tilt = (hash(seed + i * 5.1) - .5) * 2.2;
      this.p.set(Math.cos(ang) * orbit, Math.sin(ang * .7 + i) * orbit * .45 + tilt * orbit * .3, Math.sin(ang) * orbit).add(at);
      const s = radius * (.07 + .07 * hash(seed + i * 9.2)) * Math.min(1, fade * 1.4);
      this.o.position.copy(this.p); this.o.rotation.set(ang * 1.3, ang, i); this.o.scale.set(s, s * .55, s * .8); this.o.updateMatrix();
      this.ash.setMatrixAt(this.count++, this.o.matrix);
    }
  }

  station(rings: RelayBatch, strokes: RelayBatch, at: THREE.Vector3, radius: number, gain: number, time: number) {
    if (gain <= .01 || radius <= .02) return;
    this.d.copy(at).setY(at.y + .05);
    rings.add(this.d, this.flat, radius, radius, 1, GOLD, gain);
    rings.add(this.d, this.flat, radius * .52, radius * .52, 1, PALE, gain * .7);
    for (let i = 0; i < 12; i++) {
      const ang = i * TAU / 12 + time * .25;
      this.d.set(at.x + Math.sin(ang) * radius * .95, at.y + .05 + radius * .04, at.z + Math.cos(ang) * radius * .95); this.q.setFromAxisAngle(UP, ang);
      strokes.add(this.d, this.q, radius * .07, radius * .08, radius * .07, PALE, gain);
    }
  }

  knife(strokes: RelayBatch, tip: THREE.Vector3, along: THREE.Vector3, gain: number, size = 1) {
    this.q.setFromUnitVectors(UP, along);
    strokes.add(this.p.copy(tip).addScaledVector(along, -.12 * size), this.q, .034 * size, .24 * size, .01, STEEL, gain);
    strokes.add(this.p.copy(tip).addScaledVector(along, -.3 * size), this.q, .022 * size, .12 * size, .022, AMBER, gain);
    strokes.add(this.p.copy(tip).addScaledVector(along, -.4 * size), this.q, .045 * size, .06 * size, .014 * size, GOLD, gain);
  }

  /** The hem of his coat left behind at the afterimage for a breath: a ring of his amber band at knee height. */
  hem(rings: RelayBatch, at: THREE.Vector3, gain: number) {
    if (gain <= .02) return;
    this.d.copy(at).setY(at.y + .5);
    rings.add(this.d, this.flat, .34, .34, 1, AMBER, gain * .8);
  }

  reset() { this.begin(); this.end(); }
  dispose() { this.ash.removeFromParent(); this.ash.dispose(); this.ash.geometry.dispose(); this.ash.material.dispose(); }
}
