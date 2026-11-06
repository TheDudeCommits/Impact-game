import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRig } from './rigHarness';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { SHAKUGO_HOUND_ASSET, SHAKUGO_FIST_SOURCE, SHAKUGO_MAGMA_LIMITS, ShakugoMagma, shakugoMagmaContact, shakugoMagmaSocket, bakeShakugoMeteorFist } from '../src/render/signature/ShakugoMagma';
import { SHAKUGO_MOVES } from '../src/game/fighters/shakugo';
import { damageScale } from '../src/game/moves';
import { SIGNATURE } from '../src/render/signature/context';

const SHAKUGO = 'shakugo' as FighterId;
async function nativeAssets() {
  const [hound, body] = await Promise.all([loadRig(SHAKUGO_HOUND_ASSET), loadRig(SHAKUGO_FIST_SOURCE)]);
  const close = [vi.fn(), vi.fn()], textures = [new THREE.Texture(), new THREE.Texture()];
  for (const [i, gltf] of [hound, body].entries()) {
    textures[i].source.data = { close: close[i] };
    gltf.scene.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) (material as THREE.MeshBasicMaterial).map = textures[i];
    });
  }
  return { hound, body, textures, close };
}
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group(), model = new THREE.Group(); group.add(model);
  const state = { id, fighter: id === 'shakugo' ? SHAKUGO : 'taisei', alive: true, action: 'idle', actionSeq: 1,
    actionTime: 0, actionDuration: 3.95, actionStarted: 10, grounded: true, ...patch } as PlayerState;
  const left = new THREE.Bone(), right = new THREE.Bone(), leftFore = new THREE.Bone(), rightFore = new THREE.Bone();
  left.name = 'LArm_Upper_Palm_Magma_041'; right.name = 'RArm_Upper_Palm_Magma_054';
  leftFore.name = 'LArm_Upper_Fore_Magma_038'; rightFore.name = 'RArm_Upper_Fore_Magma_051';
  left.position.set(-.4, 1.6, .65); right.position.set(.4, 1.65, .55);
  leftFore.position.set(-.4, 1.5, .2); rightFore.position.set(.4, 1.5, .2);
  model.add(left, right, leftFore, rightFore); group.updateMatrixWorld(true);
  return { group, model, state, handL: new THREE.Vector3(-.3, 1.3, .2), handR: new THREE.Vector3(.3, 1.3, .2), joints: new Map() } as unknown as Fighter;
}
function fixture(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), fx = new ShakugoMagma(scene, { budget });
  const actor = body('shakugo', patch), victim = body('victim'); victim.group.position.set(0, 0, 2);
  const fighters = new Map([['shakugo', actor], ['victim', victim]]);
  const mesh = (name: string) => scene.getObjectByName(`shakugo-magma-${name}`) as THREE.InstancedMesh | undefined;
  const own = () => scene.children.filter(child => child.name.startsWith('shakugo-'));
  return { scene, fx, actor, victim, fighters, mesh, own };
}
const receipt = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'cast', serverTime: 10.44,
  actorId: 'shakugo', targetId: 'victim', fighter: SHAKUGO, slot: 'ultimate', actionSeq: 1,
  endpoint: { x: 0, y: 1.05, z: 2 }, ...patch });
async function preload(fx: ShakugoMagma) {
  const assets = await nativeAssets();
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(path => Promise.resolve(path === SHAKUGO_HOUND_ASSET ? assets.hound : assets.body));
  await fx.load([SHAKUGO]); return { ...assets, load };
}
afterEach(() => vi.restoreAllMocks());

describe('Shakugo manual magma presentation', () => {
  it('bakes the native knuckle geometry and UVs into a bounded +Z meteor fist', async () => {
    const gltf = await loadRig(SHAKUGO_FIST_SOURCE), mesh = gltf.scene.getObjectByName('Shakugo_Magma_Left') as THREE.Mesh;
    const fist = bakeShakugoMeteorFist(gltf);
    try {
      expect(fist.getAttribute('position').count).toBe(mesh.geometry.getAttribute('position').count);
      expect(fist.getAttribute('uv').array).toEqual(mesh.geometry.getAttribute('uv').array);
      expect(fist.getAttribute('skinWeight')).toBeUndefined();
      expect(fist.index!.count).toBeGreaterThan(300);
      expect(fist.boundingBox!.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-5);
      const size = fist.boundingBox!.getSize(new THREE.Vector3());
      expect(size.z).toBeCloseTo(1.7); expect(size.x).toBeGreaterThan(.3); expect(size.x).toBeLessThan(1.8);
      expect(size.y).toBeGreaterThan(.3); expect(size.y).toBeLessThan(1.8);
    } finally { fist.dispose(); }
  });

  it('loads both native assets once and only for a room containing Shakugo', async () => {
    const f = fixture(), assets = await nativeAssets();
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(path => Promise.resolve(path === SHAKUGO_HOUND_ASSET ? assets.hound : assets.body));
    try {
      await f.fx.load(['kagari']); expect(load).not.toHaveBeenCalled(); expect(f.scene.children).toHaveLength(3);
      await Promise.all([f.fx.load([SHAKUGO]), f.fx.load([SHAKUGO])]); expect(load).toHaveBeenCalledTimes(2);
      expect(f.mesh('crimson-hounds')).toBeDefined(); expect(f.mesh('meteor-fists')).toBeDefined();
      expect(f.own()).toHaveLength(5);
      await f.fx.load([SHAKUGO]); expect(load).toHaveBeenCalledTimes(2);
    } finally { f.fx.dispose(); }
  });

  it('uses the live native magma sockets and respects right-handed source takes', () => {
    const actor = body('shakugo', { action: 'heavy' }), p = new THREE.Vector3();
    shakugoMagmaSocket(actor, 'Left', p); expect(p.toArray()).toEqual([-.4, 1.6, .65]);
    shakugoMagmaContact(actor, p, 'Cinder Backfist'); expect(p.toArray()).toEqual([.4, 1.65, .55]);
    actor.model.getObjectByName('RArm_Upper_Palm_Magma_054')!.position.x = 1.2; actor.group.updateMatrixWorld(true);
    shakugoMagmaContact(actor, p, 'Fissure Uppercut'); expect(p.x).toBeCloseTo(1.2);
    shakugoMagmaContact(actor, p, 'Fissure Blast'); expect(p.x).toBeCloseTo(-.4);
  });

  it('anchors the native volley and crust to visible hands rather than stretched hidden magma bones', () => {
    const f = fixture({ action: 'ultimate', actionTime: 1.51 / 3.95 });
    const hand = new THREE.Bone(), fore = new THREE.Bone(), point = new THREE.Vector3();
    hand.position.set(-.5, 2.1, .1); fore.position.set(-.4, 1.8, .1);
    f.actor.model.add(hand, fore); f.actor.joints.set('LeftHand', hand); f.actor.joints.set('LeftForeArm', fore);
    f.actor.model.getObjectByName('LArm_Upper_Palm_Magma_041')!.position.set(-.5, 13, .1);
    f.actor.group.updateMatrixWorld(true);
    try {
      shakugoMagmaSocket(f.actor, 'Left', point); expect(point.toArray()).toEqual([-.5, 2.1, .1]);
      // The opposite ordinary joint is absent: use the cached visible hand,
      // never fall back to the hidden elongated magma chain.
      shakugoMagmaSocket(f.actor, 'Right', point); expect(point).toEqual(f.actor.handR);
      f.fx.update(11.51, f.fighters, new Map());
      const crust = f.mesh('basalt')!, matrix = new THREE.Matrix4();
      expect(crust.count).toBeGreaterThan(0);
      for (let i = 0; i < crust.count; i++) {
        crust.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix); expect(point.y).toBeLessThan(2.4);
      }
      f.actor.state.actionTime = 3.15 / 3.95;
      shakugoMagmaSocket(f.actor, 'Left', point); expect(point.y).toBe(13);
    } finally { f.fx.dispose(); }
  });

  it('never launches a hound from a canceled windup or an unreleased tracker', async () => {
    const f = fixture({ action: 'special', actionTime: .6 / 1.65, actionDuration: 1.65 });
    const flight: Flight = { fighter: SHAKUGO, slot: 'special', position: new THREE.Vector3(2, 1.6, 3), heading: new THREE.Vector3(1, 0, 0), since: 10.74, released: false };
    try {
      await preload(f.fx); f.fx.handle(receipt({ slot: 'special' }), f.fighters);
      f.fx.update(10.7, f.fighters, new Map([['hound', flight]])); expect(f.mesh('crimson-hounds')!.count).toBe(0);
      f.actor.state.action = 'hurt'; f.fx.update(10.8, f.fighters, new Map());
      expect(f.mesh('crimson-hounds')!.count).toBe(0); expect(f.mesh('basalt')!.count).toBe(0);
    } finally { f.fx.dispose(); }
  });

  it('follows the authoritative released hound position/heading and disappears with its flight', async () => {
    const f = fixture();
    const flight: Flight = { fighter: SHAKUGO, slot: 'special', position: new THREE.Vector3(2, 1.6, 3), heading: new THREE.Vector3(1, 0, 0), since: 10.74, released: true };
    const flights = new Map([['hound', flight]]), matrix = new THREE.Matrix4();
    try {
      await preload(f.fx); f.fx.update(10.9, f.fighters, flights);
      const hounds = f.mesh('crimson-hounds')!; expect(hounds.count).toBe(1);
      hounds.getMatrixAt(0, matrix);
      expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(flight.position)).toBeLessThan(1e-6);
      expect(new THREE.Vector3(0, 0, 1).transformDirection(matrix).distanceTo(flight.heading)).toBeLessThan(1e-6);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(.52);
      flights.clear(); f.fx.update(11, f.fighters, flights); expect(hounds.count).toBe(0);
    } finally { f.fx.dispose(); }
  });

  it('does not turn an ultimate cast/release/block or whiff into a sky-fist sequence', async () => {
    const f = fixture({ action: 'ultimate', actionTime: 1.7 / 3.95 });
    try {
      await preload(f.fx);
      for (const kind of ['cast', 'release', 'blocked', 'whiff'] as const) f.fx.handle(receipt({ kind }), f.fighters);
      f.fx.update(11.7, f.fighters, new Map()); expect(f.mesh('meteor-fists')!.count).toBe(0);
      expect(f.mesh('pressure')!.count).toBe(0);
    } finally { f.fx.dispose(); }
  });

  it('sends native fists upward after confirmation, then down toward the same target on the action clock', async () => {
    const f = fixture({ action: 'ultimate', actionTime: 1.55 / 3.95, confirmedAt: 10.44 });
    const matrix = new THREE.Matrix4(), direction = new THREE.Vector3();
    try {
      await preload(f.fx); f.fx.handle(receipt({ kind: 'confirm' }), f.fighters); f.fx.update(11.55, f.fighters, new Map());
      const fists = f.mesh('meteor-fists')!; expect(fists.count).toBe(6);
      fists.getMatrixAt(0, matrix); direction.set(0, 0, 1).transformDirection(matrix); expect(direction.y).toBeGreaterThan(.7);
      f.actor.state.actionTime = 2.75 / 3.95; f.fx.update(12.75, f.fighters, new Map());
      expect(fists.count).toBe(6); fists.getMatrixAt(0, matrix); direction.set(0, 0, 1).transformDirection(matrix); expect(direction.y).toBeLessThan(-.95);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix); expect(position.y).toBeLessThan(4.5);
      const before = matrix.clone(); f.fx.update(90, f.fighters, new Map()); fists.getMatrixAt(0, matrix);
      expect(matrix.elements).toEqual(before.elements); // A stalled action clock cannot complete the meteor.
      f.actor.state.actionTime = 3.16 / 3.95; f.fx.update(13.16, f.fighters, new Map());
      expect(fists.count).toBe(0); expect(f.mesh('pressure')!.count).toBe(0); // No invented final impact.
    } finally { f.fx.dispose(); }
  });

  it.each(['interrupt', 'sequence', 'whiff', 'victim-death', 'reset'] as const)('cancels the confirmed volcano on %s', async reason => {
    const f = fixture({ action: 'ultimate', actionTime: 1.55 / 3.95, confirmedAt: 10.44 });
    try {
      await preload(f.fx); f.fx.handle(receipt({ kind: 'confirm' }), f.fighters); f.fx.update(11.55, f.fighters, new Map());
      expect(f.mesh('meteor-fists')!.count).toBeGreaterThan(0);
      if (reason === 'interrupt') f.actor.state.action = 'hurt';
      if (reason === 'sequence') f.actor.state.actionSeq = 2;
      if (reason === 'whiff') f.fx.handle(receipt({ kind: 'whiff', id: 2 }), f.fighters);
      if (reason === 'victim-death') f.victim.state.alive = false;
      if (reason === 'reset') f.fx.reset();
      f.fx.update(11.56, f.fighters, new Map()); expect(f.mesh('meteor-fists')!.count).toBe(0);
    } finally { f.fx.dispose(); }
  });

  it('fractures once on a final hit receipt and bounds repeated impacts', async () => {
    const f = fixture({ action: 'ultimate', actionTime: 3.15 / 3.95, confirmedAt: 10.44 });
    const old = SIGNATURE.screen, impactFrame = vi.fn(); SIGNATURE.screen = { impactFrame };
    try {
      await preload(f.fx);
      const event = receipt({ kind: 'hit', contactIndex: 2, serverTime: 13.15 });
      f.fx.handle(event, f.fighters); f.fx.handle(event, f.fighters); f.fx.update(13.25, f.fighters, new Map());
      expect(impactFrame).toHaveBeenCalledTimes(1); expect(f.mesh('pressure')!.count).toBe(1);
      for (let id = 2; id < 800; id++) f.fx.handle({ ...event, id }, f.fighters);
      f.fx.update(13.25, f.fighters, new Map()); expect(f.own()).toHaveLength(5);
      expect(f.mesh('basalt')!.count).toBeLessThanOrEqual(SHAKUGO_MAGMA_LIMITS.basalt);
      expect(f.mesh('pressure')!.count).toBeLessThanOrEqual(SHAKUGO_MAGMA_LIMITS.impacts);
      f.fx.update(13.72, f.fighters, new Map()); expect(f.mesh('pressure')!.count).toBe(0);
    } finally { SIGNATURE.screen = old; f.fx.dispose(); }
  });

  it('keeps a received distant hound impact after its caster recovers or begins another move', () => {
    const f = fixture({ action: 'idle', actionSeq: 2 });
    try {
      f.fx.handle(receipt({ kind: 'hit', slot: 'special', serverTime: 12, actionSeq: 1 }), f.fighters);
      f.fx.update(12.05, f.fighters, new Map());
      expect(f.mesh('pressure')!.count).toBe(1);
      expect(f.mesh('basalt')!.count).toBeGreaterThan(0);
      f.actor.state.action = 'light'; f.actor.state.actionSeq = 3;
      f.fx.update(12.10, f.fighters, new Map()); expect(f.mesh('pressure')!.count).toBe(1);
      f.fx.update(12.31, f.fighters, new Map()); expect(f.mesh('pressure')!.count).toBe(0);
    } finally { f.fx.dispose(); }
  });

  it('uses the native activation release beat and persistent forearm focus without modifying gameplay', () => {
    const f = fixture({ action: 'awaken', actionDuration: .9, actionTime: .34 / .9, awakened: true, awakenedUntil: 20 });
    const before = JSON.stringify(f.victim.state);
    try {
      f.fx.update(10.34, f.fighters, new Map()); expect(f.mesh('pressure')!.count).toBe(0);
      f.actor.state.actionTime = .45 / .9; f.fx.update(10.45, f.fighters, new Map()); expect(f.mesh('pressure')!.count).toBe(1);
      f.actor.state.action = 'idle'; f.fx.update(12, f.fighters, new Map());
      expect(f.mesh('basalt')!.count).toBe(8); expect(f.mesh('pressure')!.count).toBe(0);
      expect(f.mesh('crimson-hounds')).toBeUndefined(); expect(JSON.stringify(f.victim.state)).toBe(before);
      f.fx.update(20.01, f.fighters, new Map()); expect(f.mesh('basalt')!.count).toBe(0);
    } finally { f.fx.dispose(); }
  });

  it('keeps four native meteor fists in low detail', async () => {
    const f = fixture({ action: 'ultimate', actionTime: 1.55 / 3.95, confirmedAt: 10.44 }, .3);
    try {
      await preload(f.fx); f.fx.handle(receipt({ kind: 'confirm' }), f.fighters); f.fx.update(11.55, f.fighters, new Map());
      expect(f.mesh('meteor-fists')!.count).toBe(4);
    } finally { f.fx.dispose(); }
  });

  it('cleans up a partially failed preload and permits a fresh retry', async () => {
    const f = fixture(), assets = await nativeAssets();
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(path => path === SHAKUGO_HOUND_ASSET ? Promise.resolve(assets.hound) : Promise.reject(new Error('missing fist')));
    try {
      await expect(f.fx.load([SHAKUGO])).rejects.toThrow('missing fist'); expect(assets.close[0]).toHaveBeenCalledTimes(1);
      expect(f.own()).toHaveLength(3);
      const fresh = await nativeAssets(); load.mockImplementation(path => Promise.resolve(path === SHAKUGO_HOUND_ASSET ? fresh.hound : fresh.body));
      await f.fx.load([SHAKUGO]); expect(f.own()).toHaveLength(5);
    } finally { f.fx.dispose(); }
  });

  it('releases late assets rather than reviving a disposed renderer', async () => {
    const f = fixture(), assets = await nativeAssets(), finish = new Map<string, (gltf: GLTF) => void>();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(path => new Promise(resolve => { finish.set(path, resolve); }));
    const loading = f.fx.load([SHAKUGO]); f.fx.dispose();
    finish.get(SHAKUGO_HOUND_ASSET)!(assets.hound); finish.get(SHAKUGO_FIST_SOURCE)!(assets.body); await loading;
    expect(f.scene.children).toHaveLength(0); expect(assets.close[0]).toHaveBeenCalledTimes(1); expect(assets.close[1]).toHaveBeenCalledTimes(1);
  });

  it('releases pooled GPU resources and native textures exactly once', async () => {
    const f = fixture(), assets = await preload(f.fx);
    const disposal = f.own().flatMap(o => {
      const mesh = o as THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      return [vi.spyOn(mesh, 'dispose'), vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material, 'dispose')];
    });
    const textures = assets.textures.map(t => vi.spyOn(t, 'dispose'));
    f.fx.dispose(); f.fx.dispose(); f.fx.update(11, f.fighters, new Map());
    expect(f.scene.children).toHaveLength(0);
    for (const spy of [...disposal, ...textures, ...assets.close]) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('checks the prepared three-contact ultimate using runtime damage scaling', () => {
    const move = SHAKUGO_MOVES.ultimate;
    expect(move.contacts).toEqual([.44, 1.51, 3.15]);
    expect(move.schedule!.reduce((sum, hit, i) => sum + Math.round(hit * damageScale(i + 1)), 0)).toBe(299);
  });
});
