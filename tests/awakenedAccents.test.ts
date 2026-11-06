import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FeuBleu } from '../src/render/signature/FeuBleu';
import { Setsuna } from '../src/render/signature/Setsuna';
import { AwakeningEffects } from '../src/render/AwakeningEffects';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 's', name: 'X', fighter: 'kosho', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });

/** A standing biped on the canonical joints: hips at 1 m, knees at .5, ankles
 *  at .08, and one skinned body whose vertices ride the joint nearest them -
 *  so the legs are legs and the chest is not. */
function biped(id: string, fighter: FighterId, props: Partial<PlayerState> = {}) {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const model = new THREE.Group(); group.add(model);
  const bone = (name: string, x: number, y: number, parent?: THREE.Bone) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, 0); parent?.add(b); return b; };
  const hips = bone('Hips', 0, 1), spine = bone('Spine2', 0, .4, hips), head = bone('Head', 0, .45, spine);
  const upL = bone('LeftUpLeg', .12, -.05, hips), kneeL = bone('LeftLeg', 0, -.45, upL), footL = bone('LeftFoot', 0, -.42, kneeL);
  const upR = bone('RightUpLeg', -.12, -.05, hips), kneeR = bone('RightLeg', 0, -.45, upR), footR = bone('RightFoot', 0, -.42, kneeR);
  model.add(hips);
  const bones = [hips, spine, head, upL, kneeL, footL, upR, kneeR, footR];
  const skeleton = new THREE.Skeleton(bones);
  model.updateMatrixWorld(true);
  const geometry = new THREE.BoxGeometry(.5, 1.8, .3, 4, 36, 4); geometry.translate(0, .9, 0);
  const pos = geometry.attributes.position, count = pos.count, ids: number[] = [], weights: number[] = [];
  const at = bones.map(b => b.getWorldPosition(new THREE.Vector3()));
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i), x = pos.getX(i);
    // Legs below the hip, split left and right; the trunk above it.
    const joint = y > .95 ? (y > 1.55 ? 2 : y > 1.25 ? 1 : 0) : (x >= 0 ? (y > .5 ? 3 : y > .1 ? 4 : 5) : (y > .5 ? 6 : y > .1 ? 7 : 8));
    ids.push(joint, 0, 0, 0); weights.push(1, 0, 0, 0); void at;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ids, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshToonMaterial()); mesh.name = 'Object_7';
  model.add(mesh); mesh.bind(skeleton);
  const joints = new Map<string, THREE.Bone>(bones.map(b => [b.name, b]));
  return { state, group, model, velocity: new THREE.Vector3(), handR: new THREE.Vector3(), handL: new THREE.Vector3(), bones: new Map(), joints } as unknown as Fighter;
}
const flameCards = () => { const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), 256); mesh.count = 0; return mesh; };

describe('Kosho awakened: FEU BLEU burns on his legs', () => {
  it('wraps only the legs of his own skinned body, only while he is awakened', () => {
    const scene = new THREE.Scene(), fx = new FeuBleu(scene), kosho = biped('s', 'kosho', { awakened: true, awakenedUntil: 20 });
    try {
      scene.add(kosho.group);
      for (let i = 0; i < 30; i++) fx.update(2 + i / 60, 1 / 60, new Map([['s', kosho]]), 1);
      const shells = scene.children.filter(o => o.name === 'feu-bleu' && o.visible) as THREE.SkinnedMesh[];
      expect(shells).toHaveLength(1);
      const body = kosho.model.getObjectByName('Object_7') as THREE.SkinnedMesh;
      expect(shells[0].skeleton, 'the live skeleton').toBe(body.skeleton);
      const leg = shells[0].geometry.getAttribute('aLeg'), pos = shells[0].geometry.getAttribute('position');
      for (let i = 0; i < leg.count; i++) {
        const y = pos.getY(i);
        if (y > .95) expect(leg.getX(i), `a vertex at ${y.toFixed(2)} m is not leg`).toBe(0);
        if (y > .55 && y <= .95) expect(leg.getX(i), `a vertex at ${y.toFixed(2)} m is thigh`).toBe(0);
        if (y < .5) expect(leg.getX(i), `a vertex at ${y.toFixed(2)} m is calf or foot`).toBe(1);
      }
      kosho.state.awakened = false;
      for (let i = 0; i < 60; i++) fx.update(3 + i / 60, 1 / 60, new Map([['s', kosho]]), 1);
      expect(fx.shellCount).toBe(0);
    } finally { fx.dispose(); }
  });

  it('stands flame tongues up his shins, from the ankle to the knee - and nowhere near the floor', () => {
    const scene = new THREE.Scene(), fx = new FeuBleu(scene), kosho = biped('s', 'kosho', { awakened: true, awakenedUntil: 20 });
    const cards = flameCards(), eye = new THREE.Vector3(0, 1.6, 4);
    try {
      scene.add(kosho.group); scene.updateMatrixWorld(true);
      let n = 0;
      for (let i = 0; i < 40; i++) n = fx.update(2 + i / 60, 1 / 60, new Map([['s', kosho]]), 1, cards, 0, 256, eye);
      expect(n, 'cards on both legs').toBeGreaterThanOrEqual(12);
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        cards.getMatrixAt(i, m); m.decompose(p, q, s);
        expect(p.y - s.y / 2, 'a tongue\'s foot is on the leg, not laid on the tiles').toBeGreaterThan(-.02);
        // The knees are at 0.5 m: a tongue licks no higher than a hand's width over them (it reached his waist).
        expect(p.y + s.y / 2, 'and it stops at the knee').toBeLessThan(.62);
        // Upright: turned about Y only.
        expect(Math.abs(q.x) + Math.abs(q.z)).toBeLessThan(1e-6);
      }
      // Not awakened, no fire; nor for anyone else.
      const shirokane = biped('k', 'shirokane', { awakened: true, awakenedUntil: 20 });
      kosho.state.awakened = false;
      for (let i = 0; i < 60; i++) n = fx.update(3 + i / 60, 1 / 60, new Map([['s', kosho], ['k', shirokane]]), 1, cards, 0, 256, eye);
      expect(n).toBe(0);
    } finally { fx.dispose(); }
  });

  it('draws its tongues in the awakening\'s own flame batch', () => {
    const scene = new THREE.Scene(), fx = new AwakeningEffects(scene), kosho = biped('s', 'kosho', { awakened: true, awakenedUntil: 20 });
    try {
      scene.add(kosho.group);
      for (let i = 0; i < 30; i++) fx.update(2 + i / 60, 1 / 60, new Map([['s', kosho]]), 1);
      expect((scene.getObjectByName('awakening-aura') as THREE.InstancedMesh).count).toBeGreaterThan(0);
    } finally { fx.dispose(); }
  });
});

describe('Setsu awakened: SETSUNA moves as lightning', () => {
  it('trails lightning from where his hips were when he moves fast, on standard joints alone', () => {
    const scene = new THREE.Scene(), fx = new Setsuna(scene), setsu = biped('k', 'setsu', { awakened: true, awakenedUntil: 20 });
    const fighters = new Map([['k', setsu]]);
    try {
      scene.add(setsu.group);
      // Standing still: at most the odd arc to earth.
      let standing = 0;
      for (let i = 0; i < 60; i++) { fx.update(1 + i / 60, fighters, 1); standing = Math.max(standing, fx.segments); }
      // Running at 7 m/s along x.
      (setsu.velocity as THREE.Vector3).set(7, 0, 0);
      let running = 0;
      for (let i = 0; i < 30; i++) { setsu.group.position.x += 7 / 60; setsu.group.updateMatrixWorld(true); fx.update(2 + i / 60, fighters, 1); running = Math.max(running, fx.segments); }
      expect(running, 'the trail').toBeGreaterThan(standing + 8);
      setsu.state.awakened = false;
      fx.update(3, fighters, 1);
      expect(fx.segments).toBe(0);
    } finally { fx.dispose(); }
  });

  it('runs its charge to earth in a thin line, never a lit disc', () => {
    const scene = new THREE.Scene(), fx = new Setsuna(scene), setsu = biped('k', 'setsu', { awakened: true, awakenedUntil: 60 });
    try {
      scene.add(setsu.group);
      let most = 0;
      for (let i = 0; i < 600; i++) { fx.update(1 + i / 60, new Map([['k', setsu]]), 1); most = Math.max(most, fx.segments); }
      expect(most, 'an arc or two').toBeGreaterThan(0);
      expect(most).toBeLessThan(64);
      scene.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && mesh.visible && mesh.name.startsWith('setsuna')) expect(mesh.geometry.type).not.toMatch(/Circle|Ring|Plane/); });
    } finally { fx.dispose(); }
  });
});
