import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { CombatEffects, FINISHERS, LONG_STRING, PANEL_REST } from '../src/render/CombatEffects';
import { Fighter, type TouchMark } from '../src/render/Fighter';
import { SPRITE } from '../src/render/vfx/SparkField';
import { mangaImpactProfile } from '../src/ui/MangaImpact';
import { DamageNumbers } from '../src/ui/DamageNumbers';
import { MOVES } from '../src/game/moves';
import { loadRig, base } from './rigHarness';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

/** Round 3b (HITFEEL): the rest of what makes a blow sell and a string read
 *  as its fighter's own - the manga panel rationed and every finisher drawn
 *  and lettered as its own, a blow's spark struck on the frame it lands,
 *  counts across a crowd that do not print over each other, and a victim a
 *  big blow rocks without knocking down that reels instead of standing. */
const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const event = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'a', ...props });
/** The little of a Fighter the effects read (as tests/r2vfx.test.ts). */
function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  const hips = new THREE.Bone(); hips.position.y = 1; group.add(hips);
  const hand = new THREE.Vector3(0, 1.2, .4);
  return { state, group, velocity: new THREE.Vector3(), handR: hand.clone(), handL: hand.clone(), bones: new Map(), joints: new Map([['Hips', hips]]), armed: false,
    chargePosition(out: THREE.Vector3) { return out.copy(hand); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(hand); } } as unknown as Fighter;
}
/** Sprites of one kind born between `from` and `to` (the field's record). */
function born(fx: CombatEffects, kind: number, from: number, to: number) {
  const field = fx.kit.sparks as unknown as { data: Float32Array; epoch: number };
  let n = 0;
  for (let o = 0; o < field.data.length; o += 32) { const at = field.epoch + field.data[o + 3]; if (field.data[o + 20] === kind && field.data[o + 7] > 0 && at >= from - 1e-6 && at <= to + 1e-6) n++; }
  return n;
}
/** Sprites of one kind alive at `time` (the field's own record). */
function sprites(fx: CombatEffects, kind: number, time: number) {
  const field = fx.kit.sparks as unknown as { data: Float32Array; epoch: number };
  let n = 0;
  for (let o = 0; o < field.data.length; o += 32) { const age = time - field.epoch - field.data[o + 3]; if (field.data[o + 20] === kind && age >= 0 && age < field.data[o + 7]) n++; }
  return n;
}
const blow = (props: Partial<CombatEvent>) => event({ targetId: 'b', fighter: 'taisei', slot: 'light', damage: 30, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 1 }, ...props });

describe('the manga panel, rationed', () => {
  it('no longer prints on every rush finisher; an ultimate still prints it, a special only now and then', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    let panels = 0;
    fx.screen = { impactFrame() { panels++; }, chromaticPulse() {}, speedLines() {}, techniqueGrade() {} };
    fx.localId = 'a';
    const fighters = new Map([['a', body('a', 'taisei')], ['b', body('b', 'ouga', { z: 1 })]]);
    try {
      // Five strings' finishers, a second apart in the effects' clock.
      for (let i = 0; i < 5; i++) fx.handle([blow({ id: 10 + i, chain: 3, damage: 60, serverTime: 2 + i, combo: 4 })], fighters);
      expect(panels, 'rush finishers').toBe(0);
      fx.handle([blow({ id: 30, slot: 'ultimate', damage: 290, serverTime: 9 })], fighters);
      expect(panels, 'an ultimate').toBe(1);
      // A special straight after it has to wait its turn (PANEL_REST).
      fx.handle([blow({ id: 31, slot: 'special', damage: 138, serverTime: 9.6 })], fighters);
      expect(panels).toBe(1);
      expect(PANEL_REST).toBeGreaterThanOrEqual(3);
      expect(LONG_STRING).toBeGreaterThan(4);
    } finally { fx.dispose(); }
  });

  it('draws every finisher as its own fighter\'s, and the roster\'s finishers differ', () => {
    const shapes = new Set(Object.values(FINISHERS).map(f => f.shape));
    expect(Object.keys(FINISHERS).sort()).toEqual(Object.keys(MOVES).sort());
    expect(shapes.size, 'distinct finisher shapes across sixteen fighters').toBeGreaterThanOrEqual(12);
    // Each one draws something over and above the blow's own spark, and each
    // prints its own word.
    const words = new Set<string>();
    for (const id of Object.keys(MOVES) as FighterId[]) {
      const count = (chain: number) => {
        const scene = new THREE.Scene(), fx = new CombatEffects(scene);
        const fighters = new Map([['a', body('a', id)], ['b', body('b', 'ouga', { z: 1 })]]);
        try {
          fx.handle([blow({ fighter: id, chain, damage: 60 })], fighters);
          return ([SPRITE.ring, SPRITE.streak, SPRITE.flare, SPRITE.core, SPRITE.burst, SPRITE.szstar, SPRITE.bolt, SPRITE.crescent, SPRITE.flame, SPRITE.bubble] as number[]).reduce((n, k) => n + sprites(fx, k, 1.03), 0)
            + (fx.kit.dust as unknown as { data: Float32Array }).data.filter((_, i) => i % 32 === 7).filter(v => v > 0).length;
        } finally { fx.dispose(); }
      };
      expect(count(3), `${id}'s finisher adds to its spark`).toBeGreaterThan(count(1));
      words.add(mangaImpactProfile(blow({ fighter: id, chain: 3, damage: 60 }))!.word);
    }
    expect(words.size, 'finisher words').toBeGreaterThanOrEqual(15);
  });
});

describe('a blow\'s spark on the frame it lands', () => {
  it('strikes the spark when the fist reaches the body, and not again when its event arrives', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const fighters = new Map([['a', body('a', 'taisei')], ['b', body('b', 'ouga', { z: 1 })]]);
    try {
      const mark: TouchMark = { serial: (Fighter.touchLog.at(-1)?.serial ?? 0) + 1000, victim: 'b', attacker: 'a', fighter: 'taisei', slot: 'light', chain: 1, damage: 28, x: 0, y: 1.3, z: .8, hx: 0, hz: 1, guarded: false };
      Fighter.touchLog.push(mark);
      fx.update(1, 1 / 60, fighters);
      expect(born(fx, SPRITE.burst, 1, 1) + born(fx, SPRITE.szstar, 1, 1), 'the spark, drawn on the touch').toBeGreaterThan(0);
      // The event, a network delay later: no second spark.
      fx.handle([blow({ id: 50, chain: 1, damage: 28, serverTime: 1.12 })], fighters);
      expect(born(fx, SPRITE.burst, 1.1, 1.2) + born(fx, SPRITE.szstar, 1.1, 1.2)).toBe(0);
      // A blow nobody touched still gets its spark from its event.
      fx.handle([blow({ id: 51, chain: 2, damage: 30, serverTime: 2 })], fighters);
      expect(born(fx, SPRITE.burst, 2, 2) + born(fx, SPRITE.szstar, 2, 2)).toBeGreaterThan(0);
    } finally { fx.dispose(); Fighter.touchLog.length = 0; }
  });
});

describe('counts across a crowd', () => {
  it('prints three counts that would land on one spot on three lines', () => {
    const parent = { append() {} } as unknown as HTMLElement;
    const elements: { style: Record<string, string>; textContent: string }[] = [];
    const doc = globalThis as unknown as { document?: unknown; innerWidth?: number; innerHeight?: number };
    const saved = { document: doc.document, w: doc.innerWidth, h: doc.innerHeight };
    doc.document = { createElement: () => { const e = { style: {} as Record<string, string>, textContent: '' }; elements.push(e); return e; } };
    doc.innerWidth = 1600; doc.innerHeight = 900;
    try {
      const numbers = new DamageNumbers(parent);
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100); camera.position.set(0, 1.6, -3); camera.lookAt(0, 1.4, 5); camera.updateMatrixWorld(true);
      // Three bodies in a line down the lens: every count projects to one spot.
      for (const [i, z] of [2, 3.5, 5].entries()) numbers.show(285, new THREE.Vector3(0, 1.05, z), true, () => new THREE.Vector3(0, 1.05, z), `v${i}`);
      numbers.update(camera);
      const shown = elements.filter(e => e.style.display === 'block').map(e => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top) }));
      expect(shown).toHaveLength(3);
      shown.sort((a, b) => a.y - b.y);
      for (let i = 1; i < shown.length; i++) expect(shown[i].y - shown[i - 1].y, 'a line apart, pixels').toBeGreaterThan(40);
    } finally { doc.document = saved.document; doc.innerWidth = saved.w; doc.innerHeight = saved.h; }
  });
});

describe('a big blow that does not knock its victim down rocks them', () => {
  const rigs = new Map<FighterId, GLTF>();
  beforeAll(async () => { rigs.set('koko', await loadRig(FIGHTERS.koko.model)); }, 120_000);
  it('reels, then doubles over, dazed, for the rest of the hold (Shirokane\'s Static Scarecrow)', () => {
    const victim = new Fighter(base('koko'), rigs.get('koko')!);
    try {
      const s0 = base('koko'), stun = MOVES.shirokane.special.stun, dt = 1 / 60;
      for (let i = 0; i < 20; i++) victim.update(dt, s0, true, dt);
      const standing = victim.joints.get('Head')!.getWorldPosition(new THREE.Vector3()).y;
      victim.impact(true, 'special', 'projectile', 0, new THREE.Vector3(0, 0, -1), MOVES.shirokane.special.damage, 1.3, { reaction: 'hurt' });
      const clips = new Set<string>(); let lowest = Infinity;
      for (let f = 0; f * dt < stun; f++) {
        victim.update(dt, { ...s0, action: 'hurt', actionStarted: 1, actionDuration: stun, actionTime: f * dt / stun }, true, dt);
        victim.group.updateMatrixWorld(true);
        clips.add(String(victim.motionEvidence().clip));
        if (f * dt > .6) lowest = Math.min(lowest, victim.joints.get('Head')!.getWorldPosition(new THREE.Vector3()).y);
      }
      expect([...clips], 'the recoil, then the daze').toEqual(expect.arrayContaining(['Hit 01', 'stun']));
      expect(standing - lowest, 'the head down with the body doubled over, metres').toBeGreaterThan(.2);
    } finally { victim.dispose(); }
  }, 120_000);
});
