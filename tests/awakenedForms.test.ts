import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LimbFire, ALL_ABLAZE, FeuBleu } from '../src/render/signature/FeuBleu';
import { Setsuna } from '../src/render/signature/Setsuna';
import { ScrubbedIn } from '../src/render/signature/ScrubbedIn';
import { GhostShell } from '../src/render/signature/GhostShell';
import { AwakeningEffects } from '../src/render/AwakeningEffects';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';

/**
 * Round 3b: five awakenings the blind critic found did not change the
 * silhouette - "Kosho: only blue flames on the shins. Ward: the model is
 * unchanged. Shirokane: only a faint outline. Kagari: a flame shell. Setsu:
 * lightning arcs in the hair." Each now reads as a new form on the fighter.
 */
const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'f', name: 'X', fighter: 'kagari', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });

function biped(id: string, fighter: FighterId, props: Partial<PlayerState> = {}, extras = false) {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const model = new THREE.Group(); group.add(model);
  const bone = (name: string, x: number, y: number, parent?: THREE.Bone) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, 0); parent?.add(b); return b; };
  const hips = bone('Hips', 0, 1), spine = bone('Spine2', 0, .4, hips), head = bone('Head', 0, .45, spine);
  const shL = bone('LeftShoulder', .12, .05, spine), armL = bone('LeftArm', .1, 0, shL), foreL = bone('LeftForeArm', .28, 0, armL), handL = bone('LeftHand', .25, 0, foreL);
  const shR = bone('RightShoulder', -.12, .05, spine), armR = bone('RightArm', -.1, 0, shR), foreR = bone('RightForeArm', -.28, 0, armR), handR = bone('RightHand', -.25, 0, foreR);
  const upL = bone('LeftUpLeg', .12, -.05, hips), kneeL = bone('LeftLeg', 0, -.45, upL), footL = bone('LeftFoot', 0, -.42, kneeL);
  const upR = bone('RightUpLeg', -.12, -.05, hips), kneeR = bone('RightLeg', 0, -.45, upR), footR = bone('RightFoot', 0, -.42, kneeR);
  model.add(hips);
  const bones = [hips, spine, head, shL, armL, foreL, handL, shR, armR, foreR, handR, upL, kneeL, footL, upR, kneeR, footR];
  const skeleton = new THREE.Skeleton(bones);
  model.updateMatrixWorld(true);
  const at = bones.map(b => b.getWorldPosition(new THREE.Vector3()));
  const skin = (geometry: THREE.BufferGeometry, name: string, material: THREE.Material) => {
    const pos = geometry.attributes.position, ids: number[] = [], weights: number[] = [], p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      let best = 0; for (let j = 1; j < at.length; j++) if (at[j].distanceToSquared(p) < at[best].distanceToSquared(p)) best = j;
      ids.push(best, 0, 0, 0); weights.push(1, 0, 0, 0);
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ids, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = name; model.add(mesh); mesh.bind(skeleton); return mesh;
  };
  const body = new THREE.BoxGeometry(.5, 1.8, .3, 4, 36, 4); body.translate(0, .9, 0);
  const arms = new THREE.BoxGeometry(1.4, .12, .12, 28, 2, 2); arms.translate(0, 1.45, 0);
  const merged = new THREE.BufferGeometry();
  const a = body.toNonIndexed(), b = arms.toNonIndexed();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const x = a.getAttribute(name).array as Float32Array, y = b.getAttribute(name).array as Float32Array, out = new Float32Array(x.length + y.length);
    out.set(x); out.set(y, x.length); merged.setAttribute(name, new THREE.BufferAttribute(out, a.getAttribute(name).itemSize));
  }
  const hair = new THREE.MeshToonMaterial(); hair.name = 'setsu_hair';
  skin(merged, 'body', new THREE.MeshToonMaterial());
  const top = new THREE.BoxGeometry(.3, .3, .3, 8, 8, 8); top.translate(0, 1.95, 0); skin(top, 'hair', hair);
  if (extras) {
    const blade = new THREE.BoxGeometry(.03, 1.3, .06, 1, 20, 1); blade.translate(-.8, 2.05, 0);
    const weapon = new THREE.MeshToonMaterial(); weapon.name = 'lancet_weapon';
    skin(blade, 'weapon_lancet_blade_hand_r', weapon);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5), new THREE.MeshToonMaterial({ transparent: true, opacity: .26 })); dome.name = 'awaken-on-0'; model.add(dome);
  }
  const joints = new Map<string, THREE.Bone>(bones.map(bb => [bb.name, bb]));
  return { state, group, model, velocity: new THREE.Vector3(), handR: new THREE.Vector3(), handL: new THREE.Vector3(), bones: new Map(), joints, hair } as unknown as Fighter & { hair: THREE.MeshToonMaterial };
}
const flameCards = () => { const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), 256); mesh.count = 0; return mesh; };
const visible = (scene: THREE.Scene, name: string) => scene.children.filter(o => o.name === name && o.visible);

describe('Kagari awakened: the ALL ABLAZE burns in his arms', () => {
  it('stands fire up his arms and over his shoulders, the arms themselves alight, only while awakened', () => {
    const scene = new THREE.Scene(), fx = new LimbFire(scene, ALL_ABLAZE), kagari = biped('a', 'kagari', { awakened: true, awakenedUntil: 20 });
    const cards = flameCards(), eye = new THREE.Vector3(0, 1.6, 4);
    try {
      scene.add(kagari.group); scene.updateMatrixWorld(true);
      let n = 0;
      for (let i = 0; i < 40; i++) n = fx.update(2 + i / 60, 1 / 60, new Map([['a', kagari]]), 1, cards, 0, 256, eye);
      expect(n, 'cards along both arms').toBeGreaterThanOrEqual(16);
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      let wide = 0;
      for (let i = 0; i < n; i++) {
        cards.getMatrixAt(i, m); m.decompose(p, q, s);
        expect(p.y - s.y / 2, 'on the arms, not the legs or the floor').toBeGreaterThan(1.2);
        wide = Math.max(wide, Math.abs(p.x));
        expect(Math.abs(q.x) + Math.abs(q.z), 'upright').toBeLessThan(1e-6);
      }
      expect(wide, 'out to the hands').toBeGreaterThan(.55);
      expect(visible(scene, 'all-ablaze').length, 'the burn round the arms').toBe(1);
      expect(visible(scene, 'all-ablaze-heat').length, 'the arms alight').toBe(1);
      kagari.state.awakened = false;
      for (let i = 0; i < 60; i++) n = fx.update(3 + i / 60, 1 / 60, new Map([['a', kagari]]), 1, cards, 0, 256, eye);
      expect(n).toBe(0);
      expect(visible(scene, 'all-ablaze-heat').length).toBe(0);
    } finally { fx.dispose(); }
  });

  it('lights Kosho\'s legs from within as well, and links both fires\' programs at load', () => {
    const scene = new THREE.Scene(), fx = new FeuBleu(scene), kosho = biped('s', 'kosho', { awakened: true, awakenedUntil: 20 });
    try {
      scene.add(kosho.group);
      for (let i = 0; i < 30; i++) fx.update(2 + i / 60, 1 / 60, new Map([['s', kosho]]), 1);
      const heat = visible(scene, 'feu-bleu-heat') as THREE.SkinnedMesh[];
      expect(heat).toHaveLength(1);
      const material = heat[0].material as THREE.ShaderMaterial;
      expect(material.blending).toBe(THREE.AdditiveBlending);
      expect(material.fragmentShader, 'alpha 1, or the additive blend adds nothing').toMatch(/vec4\(uHeat \* heat, 1\.0\)/);
    } finally { fx.dispose(); }
    const scene2 = new THREE.Scene(), effects = new AwakeningEffects(scene2);
    try {
      effects.warmup();
      for (const name of ['feu-bleu-warmup', 'feu-bleu-heat-warmup', 'all-ablaze-warmup', 'all-ablaze-heat-warmup', 'setsuna-shell-warmup', 'k-room-warmup', 'room-membrane-warmup', 'room-scan-warmup', 'crossmatch-cubes'])
        expect(scene2.getObjectByName(name), name).toBeDefined();
    } finally { effects.dispose(); }
  });
});

describe('Setsu awakened: SETSUNA is a body of lightning', () => {
  it('runs live current round his own outline and discharges off standard joints, lighting his hair', () => {
    const scene = new THREE.Scene(), fx = new Setsuna(scene), setsu = biped('k', 'setsu', { awakened: true, awakenedUntil: 30 });
    const fighters = new Map([['k', setsu]]);
    try {
      scene.add(setsu.group);
      let discharge = 0;
      for (let i = 0; i < 180; i++) { fx.update(1 + i / 60, fighters, 1); discharge = Math.max(discharge, fx.discharge); }
      expect(fx.shellCount, 'the live outline on both skinned parts').toBe(2);
      const shell = visible(scene, 'setsuna-shell')[0] as THREE.SkinnedMesh;
      expect(shell.skeleton, 'on his own live skeleton').toBe((setsu.model.getObjectByName('body') as THREE.SkinnedMesh).skeleton);
      expect(discharge, 'discharges standing still').toBeGreaterThan(0);
      expect(setsu.hair.emissive.b, 'the hair lit').toBeGreaterThan(.3);
      setsu.state.awakened = false;
      for (let i = 0; i < 60; i++) fx.update(4 + i / 60, fighters, 1);
      expect(fx.shellCount).toBe(0);
      expect(fx.discharge).toBe(0);
    } finally { fx.dispose(); }
  });
});

describe('Ward awakened: the ROOM on Ward', () => {
  it('sheathes LANCET in a SHEATH DOME, films his outline and turns Crossmatch cubes round him - under the dome, off the floor', () => {
    const scene = new THREE.Scene(), fx = new ScrubbedIn(scene), ward = biped('l', 'ward', { awakened: true, awakenedUntil: 30 }, true);
    const fighters = new Map([['l', ward]]);
    try {
      scene.add(ward.group); scene.updateMatrixWorld(true);
      for (let i = 0; i < 60; i++) fx.update(1 + i / 60, 1 / 60, fighters, 1);
      const { film, membrane, scan, cubes } = fx.showing;
      expect(film, 'the blade').toBe(1);
      expect(membrane, 'his body, not the dome or the blade').toBe(2);
      // Round 3c: the ROOM on his own surfaces - the same parts, drawn over
      // themselves (depth-equal), not pushed off him.
      expect(scan, 'his body scanned').toBe(2);
      const over = visible(scene, 'room-scan')[0] as THREE.SkinnedMesh, overMaterial = over.material as THREE.ShaderMaterial;
      expect(overMaterial.uniforms.uThick.value).toBe(0); expect(overMaterial.uniforms.uPush.value).toBe(0);
      expect(overMaterial.depthFunc).toBe(THREE.LessEqualDepth); expect(overMaterial.side).toBe(THREE.FrontSide);
      expect(cubes).toBe(6);
      const blade = visible(scene, 'k-room')[0] as THREE.SkinnedMesh;
      expect(blade.geometry.getAttribute('position').array, 'the blade\'s own buffers').toBe((ward.model.getObjectByName('weapon_lancet_blade_hand_r') as THREE.SkinnedMesh).geometry.getAttribute('position').array);
      for (const name of ['k-room', 'room-membrane', 'room-scan', 'crossmatch-cubes']) expect(scene.getObjectByName(name)!.renderOrder, name).toBeLessThan(0);
      const cube = scene.getObjectByName('crossmatch-cubes') as THREE.InstancedMesh, m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (let i = 0; i < cube.count; i++) { cube.getMatrixAt(i, m); p.setFromMatrixPosition(m); expect(p.y, 'at chest height, off the floor').toBeGreaterThan(1); expect(Math.hypot(p.x, p.z), 'round him, clear of his body').toBeGreaterThan(.8); }
      ward.state.awakened = false;
      for (let i = 0; i < 60; i++) fx.update(3 + i / 60, 1 / 60, fighters, 1);
      expect(fx.showing).toEqual({ film: 0, membrane: 0, scan: 0, cubes: 0 });
    } finally { fx.dispose(); }
  });
});

describe('Shirokane awakened: a Guardian solid enough to see', () => {
  it('fills a worn shell\'s body in with the lens\'s distance: the outline up close, the armour at a fight\'s distance', () => {
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()); root.add(mesh);
    const shell = new GhostShell(root, 0x2a6ad8, 0x86d0ff, .9, 0x020818, 2, true); shell.enabled = true;
    const anchor = new THREE.Object3D(); shell.fadeNear(anchor, 3.2, 6.8);
    const camera = new THREE.PerspectiveCamera();
    const fill = (distance: number) => { camera.position.set(0, 0, distance); camera.updateMatrixWorld(true); mesh.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), camera, mesh.geometry, shell.body, null as unknown as THREE.Group); return shell.body.uniforms.uFill.value as number; };
    try {
      expect(fill(3.4), 'the lens close in: the outline').toBeLessThan(.05);
      expect(fill(6), 'the lock-on distance: filled').toBeGreaterThan(.9);
      expect(fill(8)).toBe(1);
      expect(shell.body.fragmentShader).toMatch(/uFill/);
    } finally { shell.dispose(); }
  });
});
