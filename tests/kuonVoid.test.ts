import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KuonVoid } from '../src/render/signature/KuonVoid';
import { AwakeningEffects } from '../src/render/AwakeningEffects';
import { VfxKit } from '../src/render/vfx/VfxKit';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'g', name: 'X', fighter: 'kuon', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });

function part(name: string, material: string, skeleton: THREE.Skeleton, size: [number, number, number], at: [number, number, number], segments = 8) {
  const geometry = new THREE.BoxGeometry(...size, segments, segments * 2, segments);
  geometry.translate(...at);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const mat = new THREE.MeshToonMaterial(); mat.name = material;
  const mesh = new THREE.SkinnedMesh(geometry, mat); mesh.name = name;
  mesh.bind(skeleton);
  return mesh;
}

/** The little of Kuon the layer reads: his clothes and hair as skinned parts,
 *  the glasses' frame, the irises, the iris bones in front of the head joint,
 *  and the canonical joints the crackles ride. Facing +z. */
function kuon(id = 'g', props: Partial<PlayerState> = {}, fighter: FighterId = 'kuon') {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const model = new THREE.Group(); group.add(model);
  const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 1;
  const spine = new THREE.Bone(); spine.name = 'Spine2'; spine.position.y = .35; hips.add(spine);
  const head = new THREE.Bone(); head.name = 'Head'; head.position.y = .45; spine.add(head);
  const left = new THREE.Bone(); left.name = 'L_iris_96'; left.position.set(-.032, .08, .1); head.add(left);
  const right = new THREE.Bone(); right.name = 'R_iris_124'; right.position.set(.032, .08, .1); head.add(right);
  const hand = new THREE.Bone(); hand.name = 'RightHand'; hand.position.set(.3, 0, 0); spine.add(hand);
  model.add(hips);
  const skeleton = new THREE.Skeleton([hips, spine, head, left, right, hand]);
  const clothes = part('Object_13', 'MI_CP_051_00_Clothes', skeleton, [.4, 1.4, .3], [0, .8, 0]);
  const hair = part('Object_7', 'MI_CP_051_00_Hair', skeleton, [.26, .26, .26], [0, 1.72, 0]);
  const glass = part('Object_12', 'MI_CP_051_00_Glass_P1', skeleton, [.2, .05, .02], [0, 1.88, .12], 1);
  const lens = part('awaken-off-0', 'MI_CP_051_00_Lens_P1', skeleton, [.18, .04, .01], [0, 1.88, .13], 1);
  const irises = part('Object_11', 'MI_CP_051_00_EyesB', skeleton, [.1, .02, .01], [0, 1.88, .1], 1);
  model.add(clothes, hair, glass, lens, irises);
  const joints = new Map<string, THREE.Bone>([['Hips', hips], ['Spine2', spine], ['Head', head], ['RightHand', hand]]);
  const handR = new THREE.Vector3(.3, 1.35, .2), handL = new THREE.Vector3(-.3, 1.35, .2);
  const fighterLike = { state, group, model, velocity: new THREE.Vector3(), handR, handL, bones: new Map(), joints } as unknown as Fighter;
  return { fighter: fighterLike, glass, lens, irises, clothes, hair };
}
const other = (id: string, fighter: FighterId, props: Partial<PlayerState>) => kuon(id, props, fighter).fighter;
const hit = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'o', targetId: 'g', ...props });
const shells = (scene: THREE.Scene) => scene.children.filter(o => o.name === 'infinity-shell' && o.visible) as THREE.SkinnedMesh[];
const count = (scene: THREE.Scene, name: string) => (scene.getObjectByName(name) as THREE.Mesh<THREE.InstancedBufferGeometry> | undefined)?.geometry.instanceCount ?? 0;

describe('Kuon awakened: the Infinity', () => {
  it('wraps his own skinned body - not his eyes or glasses - only while he is awakened', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 20 });
    const fighters = new Map([['g', g.fighter]]);
    try {
      scene.add(g.fighter.group); scene.updateMatrixWorld(true);
      for (let i = 0; i < 40; i++) fx.update(2 + i / 60, 1 / 60, fighters, 1);
      const drawn = shells(scene);
      expect(drawn.map(s => s.skeleton), 'the clothes and the hair, on the live skeleton').toEqual([g.clothes.skeleton, g.hair.skeleton]);
      expect(drawn.map(s => s.geometry.attributes.position)).toEqual([g.clothes.geometry.attributes.position, g.hair.geometry.attributes.position]);
      expect((drawn[0].material as THREE.Material).side).toBe(THREE.BackSide);
      g.fighter.state.awakened = false;
      for (let i = 0; i < 60; i++) fx.update(3 + i / 60, 1 / 60, fighters, 1);
      expect(shells(scene)).toHaveLength(0);
    } finally { fx.dispose(); }
  });

  it('draws nothing for anyone else, awakened or not', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene);
    const shirokane = other('k', 'shirokane', { awakened: true, awakenedUntil: 20 });
    try {
      scene.add(shirokane.group);
      for (let i = 0; i < 30; i++) fx.update(2 + i / 60, 1 / 60, new Map([['k', shirokane]]), 1);
      expect(shells(scene)).toHaveLength(0);
      expect(count(scene, 'kuon-tengan') + count(scene, 'kuon-infinity-ripple') + count(scene, 'kuon-infinity-crackle')).toBe(0);
    } finally { fx.dispose(); }
  });

  it('takes the glasses off for the window and puts them back after it', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 20 });
    const fighters = new Map([['g', g.fighter]]);
    try {
      scene.add(g.fighter.group);
      fx.update(2, 1 / 60, fighters, 1);
      expect(g.glass.visible, 'the frame is off').toBe(false);
      // The lens is Fighter's to hide (awaken-off): this layer leaves it alone.
      expect(g.lens.visible).toBe(true);
      g.fighter.state.awakened = false;
      fx.update(2.1, 1 / 60, fighters, 1);
      expect(g.glass.visible, 'and back on').toBe(true);
      g.fighter.state.awakened = true;
      fx.update(2.2, 1 / 60, fighters, 1);
      fx.reset();
      expect(g.glass.visible, 'a reset leaves him dressed').toBe(true);
    } finally { fx.dispose(); }
  });

  it('lights the TENGAN toward the lens, not through the back of his head', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 20 });
    const fighters = new Map([['g', g.fighter]]), camera = new THREE.PerspectiveCamera();
    try {
      scene.add(g.fighter.group, camera);
      camera.position.set(0, 1.8, 3); camera.updateMatrixWorld(true);
      for (let i = 0; i < 40; i++) fx.update(2 + i / 60, 1 / 60, fighters, 1, camera);
      expect(count(scene, 'kuon-tengan'), 'a glow on each eye').toBeGreaterThanOrEqual(2);
      expect(g.irises.material as THREE.MeshToonMaterial).toSatisfy((m: THREE.MeshToonMaterial) => m.emissive.b > .5);
      camera.position.set(0, 1.8, -3); camera.updateMatrixWorld(true);
      fx.update(3, 1 / 60, fighters, 1, camera);
      expect(count(scene, 'kuon-tengan'), 'none from behind').toBe(0);
    } finally { fx.dispose(); }
  });

  it('holds a blow short of him in rings, and only when he is awakened', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 20 });
    const foe = other('o', 'taisei', { z: 1.2, yaw: Math.PI });
    const fighters = new Map([['g', g.fighter], ['o', foe]]);
    const ripples = () => {
      const mesh = scene.getObjectByName('kuon-infinity-ripple') as THREE.Mesh<THREE.InstancedBufferGeometry>;
      const data = (mesh.geometry.getAttribute('aC') as THREE.InterleavedBufferAttribute).data.array as Float32Array;
      return Array.from({ length: mesh.geometry.instanceCount }, (_, i) => ({ x: data[i * 12], y: data[i * 12 + 1], z: data[i * 12 + 2], strength: data[i * 12 + 7] }));
    };
    try {
      scene.add(g.fighter.group, foe.group); scene.updateMatrixWorld(true);
      for (let i = 0; i < 40; i++) fx.update(.3 + i / 60, 1 / 60, fighters, 1);
      fx.handle([hit({ id: 5, serverTime: 1, origin: { x: 0, y: 1.1, z: 1.2 }, endpoint: { x: 0, y: 1.1, z: 0 } })], fighters);
      fx.update(1.05, 1 / 60, fighters, 1);
      const [ring] = ripples();
      expect(ring, 'the blow ripples').toBeDefined();
      // Between him and the blow, short of his body, at chest height.
      expect(ring.z).toBeGreaterThan(.3); expect(ring.z).toBeLessThan(.6);
      expect(ring.y).toBeGreaterThan(.8);
      // A fist closing on him ripples before it lands.
      foe.state.action = 'light'; foe.state.target = 'g'; foe.handR.set(0, 1.3, .75); foe.handL.set(-.2, 1.2, 1);
      fx.update(3, 1 / 60, fighters, 1);
      expect(ripples().length, 'the approach').toBeGreaterThan(0);
      // Not awakened: nothing, whatever lands.
      g.fighter.state.awakened = false;
      for (let i = 0; i < 90; i++) fx.update(3.1 + i / 60, 1 / 60, fighters, 1);
      fx.handle([hit({ id: 6, serverTime: 4.7 })], fighters);
      fx.update(4.72, 1 / 60, fighters, 1);
      expect(ripples()).toHaveLength(0);
    } finally { fx.dispose(); }
  });

  // Round 5 (GUARD): a guard is drawn on its orb only (vfx/GuardFx, tests/guardOrb.test.ts) - the rings are a flat
  // quad square to the blow, which inside the orb read as a flat shield of their own.
  it('leaves a guard to its orb: no rings for a block, a parry or a guard break, nor for a fist closing on his guard', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 20, action: 'guard', guarding: true });
    const foe = other('o', 'taisei', { z: 1.2, yaw: Math.PI, action: 'light', target: 'g' });
    foe.handR.set(0, 1.3, .75); foe.handL.set(-.2, 1.2, 1);
    const fighters = new Map([['g', g.fighter], ['o', foe]]);
    try {
      scene.add(g.fighter.group, foe.group); scene.updateMatrixWorld(true);
      for (let i = 0; i < 40; i++) fx.update(.3 + i / 60, 1 / 60, fighters, 1);
      expect(count(scene, 'kuon-infinity-ripple'), 'a fist closing on his guard').toBe(0);
      const at = { origin: { x: 0, y: 1.1, z: 1.2 }, endpoint: { x: 0, y: 1.1, z: 0 } };
      fx.handle([hit({ id: 21, kind: 'blocked', serverTime: 1, ...at }), hit({ id: 22, kind: 'just-guard', serverTime: 1.02, ...at }),
        hit({ id: 23, kind: 'guard-break', serverTime: 1.04, ...at })], fighters);
      for (let i = 0; i < 6; i++) { fx.update(1.05 + i / 60, 1 / 60, fighters, 1); expect(count(scene, 'kuon-infinity-ripple'), 'a guard event').toBe(0); }
      // His guard down, a blow that lands still spends itself in rings.
      g.fighter.state.action = 'hurt'; g.fighter.state.guarding = false; foe.state.action = 'idle';
      fx.handle([hit({ id: 24, serverTime: 1.2, ...at })], fighters);
      fx.update(1.25, 1 / 60, fighters, 1);
      expect(count(scene, 'kuon-infinity-ripple'), 'a landed blow').toBeGreaterThan(0);
    } finally { fx.dispose(); }
  });

  it('puts nothing on the floor: no disc, and its light stops above the knees', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 20 });
    const foe = other('o', 'taisei', { z: 1.2 });
    const fighters = new Map([['g', g.fighter], ['o', foe]]);
    try {
      scene.add(g.fighter.group, foe.group); scene.updateMatrixWorld(true);
      fx.handle([hit({ id: 9, serverTime: 1, origin: { x: 0, y: .2, z: 1.2 } })], fighters);
      for (let i = 0; i < 30; i++) fx.update(1 + i / 60, 1 / 60, fighters, 1);
      const light = scene.getObjectByName('kuon-infinity-light') as THREE.InstancedMesh;
      expect(light.count).toBeGreaterThan(0);
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      for (let i = 0; i < light.count; i++) { light.getMatrixAt(i, m); m.decompose(p, q, s); expect(p.y - s.x, 'the light sphere clears the floor').toBeGreaterThan(.3); }
      // Even a blow from the floor is held at chest height, not laid on the tiles.
      const ripple = scene.getObjectByName('kuon-infinity-ripple') as THREE.Mesh<THREE.InstancedBufferGeometry>;
      const data = (ripple.geometry.getAttribute('aC') as THREE.InterleavedBufferAttribute).data.array as Float32Array;
      for (let i = 0; i < ripple.geometry.instanceCount; i++) expect(data[i * 12 + 1]).toBeGreaterThan(.6);
      // And nothing flat is laid under him.
      scene.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && mesh.visible) expect(mesh.geometry.type).not.toMatch(/Circle|Ring|Plane/); });
    } finally { fx.dispose(); }
  });

  it('allocates nothing new frame after frame once he has been seen', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 60 });
    const foe = other('o', 'taisei', { z: 1.2, action: 'light', target: 'g' });
    const fighters = new Map([['g', g.fighter], ['o', foe]]);
    try {
      scene.add(g.fighter.group, foe.group); scene.updateMatrixWorld(true);
      // In a match MotionFx builds each fighter's afterimage pool the first
      // frame it sees them; the strikes here draw on that pool.
      const kit = VfxKit.for(scene); kit.ghosts.prepare(g.fighter); kit.release();
      for (let i = 0; i < 30; i++) fx.update(1 + i / 60, 1 / 60, fighters, 1);
      const before = scene.children.length;
      for (let i = 0; i < 600; i++) {
        if (i % 20 === 0) fx.handle([hit({ id: 100 + i, serverTime: 1.5 + i / 60, origin: { x: 0, y: 1.1, z: 1.2 } })], fighters);
        g.fighter.state.action = i % 50 < 25 ? 'dash' : 'light'; g.fighter.state.actionStarted = Math.floor(i / 25);
        fx.update(1.5 + i / 60, 1 / 60, fighters, 1);
      }
      expect(scene.children.length, 'no meshes added past the first frames').toBe(before);
      expect(fx.stats.bolts).toBeLessThan(720);
    } finally { fx.dispose(); }
  });

  it('shows the Infinity as a field round him that reads from the lock-on camera, clear of the floor', () => {
    const scene = new THREE.Scene(), fx = new KuonVoid(scene), g = kuon('g', { awakened: true, awakenedUntil: 30 });
    const fighters = new Map([['g', g.fighter]]);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100);
    try {
      scene.add(g.fighter.group); scene.updateMatrixWorld(true);
      camera.position.set(.8, 2.2, -4.6); camera.lookAt(0, 1.2, 0); camera.updateMatrixWorld(true);
      for (let i = 0; i < 90; i++) fx.update(1 + i / 60, 1 / 60, fighters, 1, camera);
      const field = scene.getObjectByName('infinity-field') as THREE.Mesh;
      expect(field.visible, 'the field shows from behind at 4.7 m').toBe(true);
      expect(field.scale.x, 'wider than his shoulders').toBeGreaterThan(.55);
      expect(field.scale.y).toBeGreaterThan(field.scale.x);
      expect(field.position.y - field.scale.y, 'its bottom reaches no lower than his feet').toBeGreaterThan(-.1);
      expect((field.material as THREE.ShaderMaterial).uniforms.uFloor.value, 'and dissolves above his own floor').toBe(0);
      const motes = scene.getObjectByName('kuon-infinity-motes') as THREE.Mesh<THREE.InstancedBufferGeometry>;
      expect(motes.geometry.instanceCount, 'motes caught in it').toBeGreaterThan(6);
      const data = (motes.geometry.getAttribute('aP') as THREE.InterleavedBufferAttribute).data.array as Float32Array;
      for (let i = 0; i < motes.geometry.instanceCount; i++) expect(data[i * 12 + 1], 'no mote below the knees').toBeGreaterThan(.35);
      // The lens inside it: gone.
      camera.position.set(0, 1.6, .9); camera.lookAt(0, 1.6, 0); camera.updateMatrixWorld(true);
      for (let i = 0; i < 5; i++) fx.update(3 + i / 60, 1 / 60, fighters, 1, camera);
      expect(field.visible, 'not in the lens\'s face').toBe(false);
      // Not awakened: nothing.
      camera.position.set(.8, 2.2, -4.6); camera.lookAt(0, 1.2, 0); camera.updateMatrixWorld(true);
      g.fighter.state.awakened = false;
      for (let i = 0; i < 60; i++) fx.update(4 + i / 60, 1 / 60, fighters, 1, camera);
      expect(field.visible).toBe(false);
      expect(count(scene, 'kuon-infinity-motes')).toBe(0);
    } finally { fx.dispose(); }
  });

  it('links its programs at load, from the awakening layer that owns the hook', () => {
    const scene = new THREE.Scene(), fx = new AwakeningEffects(scene);
    try {
      fx.warmup();
      const warm = scene.getObjectByName('infinity-shell-warmup') as THREE.SkinnedMesh;
      expect(warm?.isSkinnedMesh, 'a skinned mesh carries the shell program into the compile').toBe(true);
      for (const name of ['kuon-infinity-crackle', 'kuon-tengan', 'kuon-infinity-ripple', 'kuon-infinity-light', 'kuon-infinity-motes', 'infinity-field-warmup']) expect(scene.getObjectByName(name), name).toBeDefined();
      fx.hideWarmup();
      expect(warm.visible).toBe(false);
    } finally { fx.dispose(); }
  });
});
