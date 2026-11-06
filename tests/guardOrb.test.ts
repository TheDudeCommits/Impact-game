import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEffects } from '../src/render/CombatEffects';
import { ClashEffects } from '../src/render/ClashEffects';
import { VfxKit } from '../src/render/vfx/VfxKit';
import { SPRITE } from '../src/render/vfx/SparkField';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';


const player = (props: Partial<PlayerState>): PlayerState => ({ id: 'x', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null, alive: true, isBot: false, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const body = (id: string, fighter: FighterId, props: Partial<PlayerState> = {}): Fighter => {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  const hand = new THREE.Vector3(state.x, 1.3, state.z);
  return { state, group, velocity: new THREE.Vector3(), handR: hand, handL: hand.clone(), bones: new Map(), joints: new Map(), armed: false,
    chargePosition(out: THREE.Vector3) { return out.copy(hand); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(hand); } } as unknown as Fighter;
};

/** Every guard event the game sends: blocks of every weight (a string's finisher among them, and one from behind),
 *  Perfect Parries of a blow and of a shot, and a guard break - from melee, a shot and a beam. */
const GUARD_EVENTS: Partial<CombatEvent>[] = [
  { kind: 'blocked', fighter: 'kenzo', slot: 'light', damage: 1 },
  { kind: 'blocked', fighter: 'kenzo', slot: 'light', chain: 3, damage: 2 },
  { kind: 'blocked', fighter: 'gummy', slot: 'heavy', damage: 3 },
  { kind: 'blocked', fighter: 'ouga', slot: 'special', damage: 12 },
  { kind: 'blocked', fighter: 'taisei', slot: 'light', damage: 1, fromBehind: true, origin: { x: 0, y: 1.05, z: 3.4 } },
  { kind: 'just-guard', fighter: 'kenzo', slot: 'light', damage: 20 },
  { kind: 'just-guard', fighter: 'kagari', slot: 'special', damage: 124, reason: 'deflect', origin: { x: 0, y: 1.3, z: -9 } },
  { kind: 'just-guard', fighter: 'kuon', slot: 'special', damage: 126, reason: 'deflect', origin: { x: 0, y: 1.3, z: -10 } },
  { kind: 'guard-break', fighter: 'ward', slot: 'special', damage: 74 },
  { kind: 'guard-break', fighter: 'kagari', slot: 'special', damage: 74, origin: { x: 0, y: 1.3, z: -8 } },
];

/** The sprites alive at `time` in one of the kit's fields, by kind and how they are laid. */
function live(field: unknown, time: number) {
  const f = field as { data: Float32Array; epoch: number };
  const out: { kind: number; orient: number; ax: number; ay: number; az: number; size: number }[] = [];
  for (let o = 0; o < f.data.length; o += 32) {
    const age = time - f.epoch - f.data[o + 3];
    if (!(age >= 0 && age < f.data[o + 7])) continue;
    const raw = f.data[o + 21], orient = Math.round(raw - 4 * Math.floor(raw / 4 + 1e-3));
    out.push({ kind: Math.round(f.data[o + 20]), orient, ax: f.data[o + 24], ay: f.data[o + 25], az: f.data[o + 26], size: Math.max(f.data[o + 8], f.data[o + 9]) });
  }
  return out;
}
/** Every visible mesh in the scene drawn on a flat geometry: a plane, a ring, a circle, a shape. */
function flatMeshes(scene: THREE.Scene) {
  const found: string[] = [];
  scene.traverse(o => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g || !(o as THREE.Mesh).isMesh || !o.visible) return;
    let shown = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) shown = false;
    if (shown && /^(PlaneGeometry|RingGeometry|CircleGeometry|ShapeGeometry)$/.test(g.type)) found.push(`${o.name || o.type}:${g.type}`);
  });
  return found.sort();
}

describe('the guard is drawn on its orb, and nothing flat', () => {
  it('has no hex shield to draw: not in the kit, not among the sprites, not in the sprite shader', () => {
    expect('shield' in (VfxKit.prototype as unknown as Record<string, unknown>), 'VfxKit.shield').toBe(false);
    expect('shield' in SPRITE, 'SPRITE.shield').toBe(false);
    const scene = new THREE.Scene(), kit = VfxKit.for(scene);
    try {
      const shader = (kit.sparks.mesh.material as THREE.ShaderMaterial).fragmentShader;
      expect(shader).not.toMatch(/shieldShape|hexDist/);
    } finally { kit.release(); }
  });

  for (const [who, local] of [['the local fighter guarding', 'd'], ['a remote fighter guarding', 'z'], ['a guard the local fighter struck', 'a']] as const) {
    it(`draws no flat shield, disc or ring for ${who}, from any guard event`, () => {
      for (const props of GUARD_EVENTS) {
        const scene = new THREE.Scene(), fx = new CombatEffects(scene), clash = new ClashEffects(scene);
        const attacker = body('a', (props.fighter ?? 'kenzo') as FighterId, { z: -1.4, action: 'light' });
        const defender = body('d', 'taisei', { guarding: true, action: 'guard', yaw: Math.PI, stamina: props.kind === 'guard-break' ? 0 : 60 });
        const fighters = new Map([['a', attacker], ['d', defender]]);
        fx.localId = local;
        try {
          fx.update(.9, 1 / 60, fighters);
          const before = flatMeshes(scene);
          const event = { id: 7, serverTime: 1, actorId: 'a', targetId: 'd', origin: { x: 0, y: 1.05, z: -1.4 }, endpoint: { x: 0, y: 1.05, z: 0 }, ...props } as CombatEvent;
          const label = `${who}: ${event.kind} ${event.fighter} ${event.slot}${event.reason ? ' ' + event.reason : ''}`;
          fx.handle([event], fighters); clash.handle([event]);
          for (const t of [1.0, 1.02, 1.05, 1.1, 1.2, 1.35]) {
            fx.update(t, 1 / 60, fighters); clash.update(t, undefined, 1);
            for (const field of [fx.kit.sparks, fx.kit.dust]) for (const s of live(field, t)) {
              // The old flat blue hex shield, by its sprite kind (6), whatever its colour or size.
              expect(s.kind, `${label}: the hex shield sprite`).not.toBe(6);
              // A disc, a ring, a flash or a panel standing on its own - flat on a level axis, or facing the camera.
              // What may come off the orb: sparks (streaks), shards and the dust of the shove.
              expect([SPRITE.streak, SPRITE.shard, SPRITE.puff] as number[], `${label}: a ${Object.entries(SPRITE).find(([, k]) => k === s.kind)?.[0] ?? s.kind} sprite`).toContain(s.kind);
              if (s.orient === 2) expect(Math.abs(s.ay), `${label}: a standing plane`).toBeGreaterThan(.8);
            }
            expect(flatMeshes(scene), `${label}: a flat mesh shown`).toEqual(before);
          }
        } finally { fx.dispose(); clash.dispose(); }
      }
    });
  }

  it('carries every guard event on the orb: the block\'s dent, the parry\'s flare and snap, the shot\'s hit point, the break', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const attacker = body('a', 'kagari', { z: -1.4 }), defender = body('d', 'taisei', { guarding: true, action: 'guard', yaw: Math.PI });
    const fighters = new Map([['a', attacker], ['d', defender]]);
    const orb = scene.getObjectByName('guard-aura') as THREE.InstancedMesh;
    const attr = (name: string) => orb.geometry.getAttribute(name).array as Float32Array;
    const scale = () => { const m = new THREE.Matrix4(); orb.getMatrixAt(0, m); return new THREE.Vector3().setFromMatrixScale(m).x; };
    const send = (id: number, t: number, props: Partial<CombatEvent>) =>
      fx.handle([{ id, serverTime: t, actorId: 'a', targetId: 'd', origin: { x: 0, y: 1.05, z: -1.4 }, endpoint: { x: 0, y: 1.05, z: 0 }, ...props } as CombatEvent], fighters);
    try {
      fx.update(.9, 1 / 60, fighters);
      const rest = scale();
      // A block: the orb's hit point, toward the blow, weighted by it.
      send(1, 1, { kind: 'blocked', slot: 'light', damage: 1 }); fx.update(1.01, 1 / 60, fighters);
      const light = attr('aHit')[3];
      expect(attr('aHit')[2], 'the hit point faces the blow').toBeLessThan(-.8);
      send(2, 1.5, { kind: 'blocked', slot: 'special', damage: 12 }); fx.update(1.51, 1 / 60, fighters);
      expect(attr('aHit')[3], 'a heavier blow lands heavier on the orb').toBeGreaterThan(light);
      // A Perfect Parry: the orb flares and snaps outward.
      send(3, 2, { kind: 'just-guard', slot: 'light' }); fx.update(2.05, 1 / 60, fighters);
      expect(attr('aFace')[2], 'the flare').toBeGreaterThan(.8);
      expect(scale(), 'the snap outward').toBeGreaterThan(rest * 1.15);
      fx.update(2.7, 1 / 60, fighters);
      expect(scale(), 'and back').toBeCloseTo(rest, 2);
      // A deflected shot: its hit point on the orb, in the shot's own colour.
      send(4, 3, { kind: 'just-guard', fighter: 'kagari', slot: 'special', reason: 'deflect', origin: { x: 0, y: 1.3, z: -9 } }); fx.update(3.01, 1 / 60, fighters);
      expect(attr('aTint')[3], 'a deflected shot').toBe(2);
      expect(attr('aTint')[0], 'in Taimatsu\'s fire').toBeGreaterThan(attr('aTint')[2]);
      // A guard break: the orb shatters - cells falling away - and is gone.
      defender.state.guarding = false; defender.state.action = 'stun';
      send(5, 4, { kind: 'guard-break', slot: 'special' }); fx.update(4.1, 1 / 60, fighters);
      expect(attr('aFace')[3], 'shattering').toBeGreaterThan(.1);
      expect(attr('aGuard')[0], 'cracked through').toBeLessThan(.05);
      fx.update(4.6, 1 / 60, fighters);
      expect(orb.count, 'gone').toBe(0);
    } finally { fx.dispose(); }
  });

  it('keeps the parry legible with reduced motion: a smaller snap, no wobble', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    fx.guard.reduced = true;
    const fighters = new Map([['a', body('a', 'kenzo', { z: -1.4 })], ['d', body('d', 'taisei', { guarding: true, action: 'guard', yaw: Math.PI })]]);
    const orb = scene.getObjectByName('guard-aura') as THREE.InstancedMesh;
    const scale = () => { const m = new THREE.Matrix4(); orb.getMatrixAt(0, m); return new THREE.Vector3().setFromMatrixScale(m).x; };
    try {
      fx.update(.9, 1 / 60, fighters);
      const rest = scale();
      fx.handle([{ id: 1, kind: 'just-guard', serverTime: 1, actorId: 'a', targetId: 'd', slot: 'light', origin: { x: 0, y: 1.05, z: -1.4 }, endpoint: { x: 0, y: 1.05, z: 0 } } as CombatEvent], fighters);
      let most = 0, least = Infinity;
      for (let t = 1; t < 1.6; t += 1 / 60) { fx.update(t, 1 / 60, fighters); most = Math.max(most, scale() / rest); least = Math.min(least, scale() / rest); }
      expect(most, 'it still snaps').toBeGreaterThan(1.05);
      expect(most, 'but gently').toBeLessThan(1.15);
      expect(least, 'with no overshoot back inside itself').toBeGreaterThanOrEqual(.999);
    } finally { fx.dispose(); }
  });
});
