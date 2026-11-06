import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { TOKAN_MOVES } from '../src/game/fighters/tokan';
import { TokanIce } from '../src/render/signature/TokanIce';
import { RosterSignatureSet } from '../src/render/signature/RosterSignatureSet';
import type { VfxKit } from '../src/render/vfx/VfxKit';
import { BUILD_LOOK, fxLook, FX_LOOKS, type FxLook } from '../src/render/vfx/engine/flag';
import { TOKAN_TRACKS, TokanEnginePilot, tokanSignature } from '../src/render/vfx/engine/pilots/tokan';
import { ICE, ICE_CAPS, IceKit } from '../src/render/vfx/engine/ice';
import { EffectRegistry } from '../src/render/vfx/engine/Effect';
import { registerIce } from '../src/render/vfx/engine/ice';
import { PHEASANT_FEATHERS } from '../src/render/vfx/engine/ice/IcePheasant';

const AGE = TOKAN_MOVES.ultimate, BEAK = TOKAN_MOVES.special;
const JOINTS = ['Hips', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const AT: Record<string, [number, number, number]> = {
  Hips: [0, 1, 0], Spine1: [0, 1.3, 0], Neck: [0, 1.6, 0], Head: [0, 1.72, 0], LeftArm: [.2, 1.5, 0], LeftForeArm: [.45, 1.3, 0], LeftHand: [.6, 1.1, 0],
  RightArm: [-.2, 1.5, 0], RightForeArm: [-.45, 1.3, 0], RightHand: [-.6, 1.1, 0], LeftUpLeg: [.12, .95, 0], LeftLeg: [.13, .5, 0], LeftFoot: [.14, .08, 0],
  RightUpLeg: [-.12, .95, 0], RightLeg: [-.13, .5, 0], RightFoot: [-.14, .08, 0],
};
function body(id: string, fighter: FighterId, x: number, state: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group(); group.position.set(x, 0, 0);
  const joints = new Map<string, THREE.Bone>();
  for (const name of JOINTS) { const bone = new THREE.Bone(); bone.position.set(AT[name][0] + x, AT[name][1], AT[name][2]); bone.updateMatrixWorld(true); joints.set(name, bone); }
  return { group, joints, handR: new THREE.Vector3(x + .3, 1.4, .2), handL: new THREE.Vector3(x - .3, 1.4, .2), strikePoint: (out: THREE.Vector3) => out.set(x + .5, 1.2, 0),
    state: { id, fighter, alive: true, grounded: true, action: 'idle', actionSeq: 1, actionTime: 0, actionDuration: 1, actionStarted: 0, yaw: Math.PI / 2, ...state } as PlayerState } as unknown as Fighter;
}
const kit = (quality: 'low' | 'medium' | 'high' = 'high') => ({ budget: 1, quality, density: 1 }) as unknown as VfxKit;
const mesh = (scene: THREE.Scene, name: string) => scene.getObjectByName(name) as THREE.InstancedMesh;

/** Tokan's Winter Sleep and Frostplume Flight played through a signature, frame by frame, with the largest instance counts
 *  every ice batch reached. */
function play(signature: { handle(e: CombatEvent, f?: ReadonlyMap<string, Fighter>): void; update(t: number, f: ReadonlyMap<string, Fighter>, fl: ReadonlyMap<string, Flight>): void }, scene: THREE.Scene) {
  const tokan = body('a', 'tokan', 0), gummy = body('l', 'gummy', 2.2, { yaw: -Math.PI / 2 });
  const fighters = new Map<string, Fighter>([['a', tokan], ['l', gummy]]), flights = new Map<string, Flight>();
  const peak: Record<string, number> = {};
  const step = (t: number) => { signature.update(t, fighters, flights); scene.traverse(o => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) peak[o.name] = Math.max(peak[o.name] ?? 0, m.count); }); };
  // Winter Sleep: the cast, the opener's confirm, three contacts; the finisher at 3.0 on the move's clock.
  const start = 10, base = { fighter: 'tokan' as FighterId, actorId: 'a', targetId: 'l', slot: 'ultimate' as const, actionSeq: 1 };
  signature.handle({ ...base, id: 1, kind: 'cast', serverTime: start, seed: 777, origin: { x: 0, y: 1.4, z: 0 }, endpoint: { x: 2.2, y: 1.4, z: 0 } }, fighters);
  for (let t = 0; t <= 6.5; t += 1 / 30) {
    Object.assign(tokan.state, { action: t < AGE.duration ? 'ultimate' : 'idle', actionStarted: start, actionDuration: AGE.duration, actionTime: Math.min(.999, t / AGE.duration), confirmedAt: start + .5 });
    if (Math.abs(t - .5) < 1 / 60) signature.handle({ ...base, id: 2, kind: 'confirm', serverTime: start + .5, castAge: .5 }, fighters);
    AGE.contacts.forEach((c, i) => { if (Math.abs(t - c) < 1 / 60) signature.handle({ ...base, id: 3 + i, kind: 'hit', contactIndex: i, serverTime: start + c, damage: i === 2 ? 200 : 50 }, fighters); });
    step(start + t);
  }
  // Frostplume Flight: charge, release, nine metres of flight, a hit.
  const s = 20, beak = { fighter: 'tokan' as FighterId, actorId: 'a', targetId: 'l', slot: 'special' as const, actionSeq: 2 };
  gummy.group.position.x = 9;
  signature.handle({ ...beak, id: 10, kind: 'cast', serverTime: s, seed: 99, origin: { x: 0, y: 1.4, z: 0 }, endpoint: { x: 9, y: 1.4, z: 0 } }, fighters);
  const flight: Flight = { fighter: 'tokan', slot: 'special', position: new THREE.Vector3(.3, 1.4, 0), heading: new THREE.Vector3(1, 0, 0), origin: new THREE.Vector3(.3, 1.4, 0), released: false, since: s + BEAK.contacts[0] };
  flights.set('10:0', flight);
  for (let t = 0; t <= 4.5; t += 1 / 30) {
    Object.assign(tokan.state, { action: t < BEAK.duration ? 'special' : 'idle', actionSeq: 2, actionStarted: s, actionDuration: BEAK.duration, actionTime: Math.min(.999, t / BEAK.duration) });
    const flown = t - BEAK.contacts[0];
    if (flown >= 0 && flights.has('10:0')) { flight.released = true; flight.position.set(.3 + flown * (BEAK.speed ?? 27), 1.4, 0); }
    if (flown > 8.7 / 27 && flights.has('10:0')) { flights.delete('10:0'); signature.handle({ ...beak, id: 11, kind: 'hit', serverTime: s + t, damage: 110 }, fighters); }
    step(s + t);
  }
  return { peak, tokan, gummy, fighters, flights };
}

describe('which look a build draws', () => {
  it("is the design's pick, ice-a, in a release build; a dev server alone reads ?fx= for the capture tools", () => {
    expect(BUILD_LOOK).toBe('ice-a');
    // A dev server.
    expect(fxLook('?fx=ice-c', true)).toBe('ice-c');
    expect(fxLook('?local-training&fx=ice-b', true)).toBe('ice-b');
    expect(fxLook('?fx=today', true)).toBeUndefined();
    expect(fxLook('?fx=ice-d', true)).toBe('ice-a');
    expect(fxLook('', true)).toBe('ice-a');
    // A built page ignores the address entirely.
    expect(fxLook('?fx=today', false)).toBe('ice-a');
    expect(fxLook()).toBe('ice-a');
  });
});

describe('Tokan pilot (VOL.2): the chosen look in every build, today still one call away', () => {
  it("builds exactly today's TokanIce with no look, and the room's set draws the design's pick", async () => {
    const scene = new THREE.Scene();
    const today = tokanSignature(scene, kit(), null);
    expect(today).toBeInstanceOf(TokanIce);
    expect(scene.children.map(c => c.name).filter(name => !name.startsWith('stage-')).sort()).toEqual(['tokan-ice-birds', 'tokan-ice-crystals', 'tokan-ice-facets', 'tokan-ice-lines', 'tokan-ice-rings']);
    today.dispose(); expect(scene.children).toHaveLength(0);
    // The room's own set builds the pilot in ice-a, with no flag in the address.
    const set = new RosterSignatureSet(scene, kit());
    await set.load(['tokan']);
    expect(scene.children.some(c => !c.name.startsWith('tokan-ice-') && !c.name.startsWith('stage-'))).toBe(true);
    set.dispose();
  });
});

describe.each(FX_LOOKS)('Tokan pilot %s', look => {
  it('prewarms the ice kit at load and keeps the plain moves away from TokanIce', () => {
    const scene = new THREE.Scene(), pilot = tokanSignature(scene, kit(), look) as TokanEnginePilot;
    try {
      expect(pilot).toBeInstanceOf(TokanEnginePilot);
      for (const name of ['ice-crystals', 'ice-shards', 'ice-floor', 'ice-mist']) expect(mesh(scene, name), name).toBeDefined();
      // Every cue names a registered type, and only the plain special and ultimate.
      for (const cue of TOKAN_TRACKS[look]) { expect(Object.values(ICE)).toContain(cue.type); expect(['special', 'ultimate']).toContain(cue.slot); expect(cue.branch).toBeUndefined(); }
      const { peak } = play(pilot, scene);
      // TokanIce drew none of Winter Sleep's floor lines or spires, nor today's bird.
      expect(peak['tokan-ice-lines'] ?? 0).toBe(0);
      expect(peak['tokan-ice-crystals'] ?? 0).toBe(0);
      expect(peak['tokan-ice-birds'] ?? 0).toBe(0);
      // The engine drew ice, within the kit's hard caps.
      expect(peak['ice-crystals']).toBeGreaterThan(10);
      expect(peak['ice-shards']).toBeGreaterThan(5);
      for (const [name, cap] of [['ice-crystals', ICE_CAPS.crystals], ['ice-shards', ICE_CAPS.shards], ['ice-floor', ICE_CAPS.floor], ['ice-mist', ICE_CAPS.mist]] as const) expect(peak[name] ?? 0).toBeLessThanOrEqual(cap);
      if (look !== 'ice-a') expect(peak['ice-floor']).toBeGreaterThan(0);
      // Everything has played out and gone back to its pool.
      expect(pilot.director.live).toBe(0); expect(pilot.director.dropped).toBe(0);
      expect(mesh(scene, 'ice-crystals').count).toBe(0);
    } finally { pilot.dispose(); }
    expect(scene.children).toHaveLength(0);
  });

  it('draws less on Medium than on High, and less again on Low', () => {
    const peaks = (['low', 'medium', 'high'] as const).map(q => { const scene = new THREE.Scene(), pilot = tokanSignature(scene, kit(q), look); try { return play(pilot, scene).peak; } finally { pilot.dispose(); } });
    const total = (p: Record<string, number>) => (p['ice-crystals'] ?? 0) + (p['ice-shards'] ?? 0) + (p['ice-mist'] ?? 0);
    expect(total(peaks[0])).toBeLessThan(total(peaks[1]));
    expect(total(peaks[1])).toBeLessThan(total(peaks[2]));
  });
});

describe('the ICE kit', () => {
  it('is shared by everyone in a scene: one set of batches, disposed with the last owner', () => {
    const scene = new THREE.Scene();
    const a = new EffectRegistry(), b = new EffectRegistry();
    const kitA = registerIce(a, scene), kitB = registerIce(b, scene);
    expect(kitA).toBe(kitB);
    expect(scene.children.filter(c => c.name === 'ice-crystals')).toHaveLength(1);
    a.dispose();
    expect(mesh(scene, 'ice-crystals')).toBeDefined();
    b.dispose();
    expect(scene.children).toHaveLength(0);
    expect(IceKit.DRAWS).toBe(4);
  });

  it('empties once a frame for all its owners, even when the clock stands still (a pause)', () => {
    const scene = new THREE.Scene(), a = new EffectRegistry(), b = new EffectRegistry(), kit = registerIce(a, scene); registerIce(b, scene);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), c = new THREE.Color(1, 1, 1);
    const frame = (time: number, adds: [EffectRegistry, number][]) => { for (const [owner, n] of adds) { owner.begin(time); for (let i = 0; i < n; i++) kit.crystals.add(p, q, 1, 1, 1, c, 1); owner.end(); } return kit.crystals.mesh.count; };
    expect(frame(5, [[a, 3], [b, 2]])).toBe(5);
    // The same time again (paused): a new frame all the same, not 5 more on top.
    expect(frame(5, [[a, 3], [b, 2]])).toBe(5);
    expect(frame(5.1, [[a, 1]])).toBe(1);
    a.dispose(); b.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('lays a cast out the same way on every screen (seeded from the cast)', () => {
    const matrices = () => {
      const scene = new THREE.Scene(), pilot = tokanSignature(scene, kit(), 'ice-a') as TokanEnginePilot;
      const tokan = body('a', 'tokan', 0), gummy = body('l', 'gummy', 2);
      const fighters = new Map<string, Fighter>([['a', tokan], ['l', gummy]]);
      const at = (t: number) => Object.assign(tokan.state, { action: 'ultimate', actionStarted: 1, actionDuration: AGE.duration, actionTime: (t - 1) / AGE.duration });
      at(4);
      pilot.handle({ id: 1, kind: 'cast', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', actionSeq: 1, serverTime: 1, seed: 31337 }, fighters);
      pilot.handle({ id: 2, kind: 'hit', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', actionSeq: 1, contactIndex: 2, serverTime: 4 }, fighters);
      pilot.update(4, fighters, new Map()); at(4.5); pilot.update(4.5, fighters, new Map());
      const m = mesh(scene, 'ice-crystals'), out: number[] = [];
      for (let i = 0; i < m.count; i++) { const x = new THREE.Matrix4(); m.getMatrixAt(i, x); out.push(...x.elements.map(v => Math.round(v * 1e4) / 1e4)); }
      pilot.dispose(); return out;
    };
    const first = matrices();
    expect(first.length).toBeGreaterThan(16 * 10);
    expect(matrices()).toEqual(first);
  });

  it('a field takes its tint from the cue when one is given, else from the preset', () => {
    const scene = new THREE.Scene(), registry = new EffectRegistry(), kit = registerIce(registry, scene);
    const type = registry.get(ICE.field)!;
    const cue = { seed: 5, palette: { spike: 0, rim: 0, light: 0, ink: 0 }, preset: 'ice/tokan', tier: 'high', density: 1, local: false, actorId: 'a', heading: new THREE.Vector3(1, 0, 0),
      anchor: { point: new THREE.Vector3(), follow: false, floor: 0, socket: 'floor' } } as never;
    const tintOf = (tint?: number) => {
      const field = type.acquire()!;
      field.start({ layout: 'ring', reach: 1, count: { low: 4, medium: 4, high: 4 }, spread: 0, ...(tint === undefined ? {} : { tint }) }, cue);
      registry.begin(1); field.update(.3, 1 / 60, { time: 1, fighters: new Map(), flights: new Map(), locate: () => true }); registry.end();
      const a = kit.crystals.mesh.geometry.getAttribute('iceTint') as THREE.InstancedBufferAttribute, out = [a.getX(0), a.getY(0), a.getZ(0)];
      field.release(); return out;
    };
    const [r, g, b] = tintOf(0xff2010), preset = tintOf();
    expect(r).toBeGreaterThan(g); expect(r).toBeGreaterThan(b);
    expect(preset[2]).toBeGreaterThan(preset[0]);
    registry.dispose();
  });

  it('the pheasant is drawn with fewer feathers on lower tiers', () => {
    expect(PHEASANT_FEATHERS.low).toBeLessThan(PHEASANT_FEATHERS.medium);
    expect(PHEASANT_FEATHERS.medium).toBeLessThan(PHEASANT_FEATHERS.high);
  });
});

describe('every look keeps to its own track', () => {
  it('the three looks are three different directions', () => {
    const types = (look: FxLook) => TOKAN_TRACKS[look].map(c => c.type).sort().join();
    expect(new Set(FX_LOOKS.map(types)).size).toBe(3);
    expect(TOKAN_TRACKS['ice-a'].some(c => c.type === ICE.lance)).toBe(true);
    expect(TOKAN_TRACKS['ice-b'].some(c => c.type === ICE.pheasant)).toBe(true);
    expect(TOKAN_TRACKS['ice-b'].some(c => c.type === ICE.freeze)).toBe(true);
    expect(TOKAN_TRACKS['ice-c'].some(c => c.type === ICE.lance) && TOKAN_TRACKS['ice-c'].some(c => c.type === ICE.pheasant)).toBe(true);
  });
});
