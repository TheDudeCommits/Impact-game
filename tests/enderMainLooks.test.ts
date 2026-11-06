import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoveDefinition } from '../src/game/moves';

// Until a fighter's own row is written its enders are drawn on a stand-in move of the same role (Gaku's), so every one
// of the main game's sixteen can be walked through the decorations; a written row takes precedence.
vi.mock('../src/game/combos', async original => {
  const real = await original<typeof import('../src/game/combos')>();
  // Ouga's Light, Heavy stands in for a thrown ender (a blast, as combosShop's `blast` makes one) whatever his row says.
  const thrown = new Map<string, MoveDefinition>();
  return { ...real, comboMove: (fighter: Parameters<typeof real.comboMove>[0], key: Parameters<typeof real.comboMove>[1], awakened = false): MoveDefinition | undefined => {
    const move = real.comboMove(fighter, key, awakened) ?? real.comboMove('gaku', key, awakened);
    if (fighter !== 'ouga' || key !== 'lh' || !move) return move;
    const id = `${awakened}`; let blast = thrown.get(id);
    if (!blast) { blast = { ...move, style: 'projectile', range: 10, speed: 32, radius: 1, lunge: 0 }; thrown.set(id, blast); }
    return blast;
  } };
});
const { EmperorEffects } = await import('../src/render/EmperorEffects');
const { VfxKit } = await import('../src/render/vfx/VfxKit');
const { comboMove, COMBO_KEYS, COMBO_SLOT } = await import('../src/game/combos');
const { body } = await import('./enderHarness');
import type { ComboKey } from '../src/game/combos';
import type { CombatEvent, FighterId } from '../src/game/types';

/**
 * The main game's sixteen's enders are decorated as the shop's are - the blowback's shock, the launcher's column, the
 * knockdown's crater, the stun's ring, the spike's cut, the ground smash's ring - in their own element, with the
 * weight and the element's own read on top (EmperorEffects `mainAccent`, `flavour`), and a string's stun dazes whom it
 * holds. Before COMBOS-DATA's rows land nothing of this can be drawn in the game: this walks the drawing itself.
 */
const VOL1: readonly FighterId[] = ['taisei', 'konta', 'gummy', 'kosho', 'ouga', 'shirokane', 'shiden', 'kenzo', 'koko', 'nigo', 'kagari', 'ward', 'kuon', 'oro', 'gaunt', 'setsu'];
const RING_WHITE = new THREE.Color(2, 2.4, 2.8);
afterEach(() => vi.restoreAllMocks());

function stage(fighter: FighterId, key: ComboKey) {
  const scene = new THREE.Scene(), fx = new EmperorEffects(scene), move = comboMove(fighter, key)!;
  const actor = body('a', fighter, { action: COMBO_SLOT[key], branch: key, actionStarted: 1, actionDuration: move.duration, target: 'b' });
  const victim = body('b', 'gorai', { z: 1.6, yaw: Math.PI });
  scene.add(actor.group, victim.group);
  return { scene, fx, move, actor, victim, fighters: new Map([['a', actor], ['b', victim]]) };
}

describe('the main game\'s enders are decorated in their own element', () => {
  for (const fighter of VOL1) it(`${fighter}: all six land as themselves, with weight`, () => {
    for (const key of COMBO_KEYS) {
      const { scene, fx, move, actor, fighters } = stage(fighter, key);
      try {
        const contact = move.contacts[0], at = (elapsed: number) => { actor.state.actionTime = elapsed / move.duration; fx.update(1 + elapsed, fighters, 1); };
        // Counted a moment after the blow: the dust is thrown over the 30 ms after it.
        // A cut of the layer's own (Kenzo's three swords, Ward's LANCET) counts as much as a handful of sprites.
        const probe = 1 + (contact + .045), cuts = () => (fx as unknown as { cuts: { active: boolean }[] }).cuts.filter(c => c.active).length;
        const live = (kit: ReturnType<typeof VfxKit.for>) => kit.sparks.live(probe) + kit.dust.live(probe) + 4 * cuts();
        at(contact - .05);
        const kit = VfxKit.for(scene), before = live(kit);
        at(contact + .01);
        const after = live(kit);
        // (A thrown ender only leaves the hand here: its weight lands with its hit, below.)
        const heavy = (key === 'airSpecial' || key === 'lllh') && move.style !== 'projectile';
        expect(after - before, `${fighter} ${key}: the element's sprites at the blow`).toBeGreaterThan(heavy ? 12 : 2);
        // Its rings are in its element, never the shop's white-blue.
        const rings = scene.children.filter(o => o.name === 'emperor-ring' && o.visible) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
        for (const ring of rings) expect(ring.material.color.equals(RING_WHITE), `${fighter} ${key} ring colour`).toBe(false);
        if ((key === 'llh' || key === 'lllh' || key === 'airSpecial') && move.style !== 'projectile') expect(rings.length, `${fighter} ${key}: a ring on the floor`).toBeGreaterThan(0);
        kit.release();
      } finally { fx.dispose(); }
    }
  });

  it('waits for the floor before the ground smash lands, and lands it once', () => {
    const { scene, fx, move, actor, fighters } = stage('taisei', 'airSpecial');
    try {
      const kit = VfxKit.for(scene), contact = move.contacts[0];
      actor.state.grounded = false; actor.group.position.y = 3;
      for (let e = 0; e < contact + .2; e += 1 / 60) { actor.state.actionTime = e / move.duration; fx.update(1 + e, fighters, 1); }
      const rubble0 = (kit.debris as unknown as { active: number }).active;
      expect(rubble0, 'nothing while falling').toBe(0);
      actor.state.grounded = true; actor.group.position.y = 0; actor.state.actionStarted = 1.2; actor.state.actionTime = contact / move.duration;
      fx.update(1.2 + contact, fighters, 1);
      const rubble = (kit.debris as unknown as { active: number }).active;
      expect(rubble, 'rubble out of the crater').toBeGreaterThan(10);
      actor.state.actionTime = (contact + .05) / move.duration; fx.update(1.25 + contact, fighters, 1);
      expect((kit.debris as unknown as { active: number }).active, 'landed once').toBe(rubble);
      kit.release();
    } finally { fx.dispose(); }
  });

  it('dazes whom a string\'s stun holds, over the head, for as long as it holds them', () => {
    const { scene, fx, fighters, victim } = stage('shirokane', 'llls');
    try {
      const hit: CombatEvent = { id: 40, kind: 'hit', serverTime: 2, actorId: 'a', targetId: 'b', fighter: 'shirokane', slot: 'special', branch: 'llls', outcome: 'dizzy', endpoint: { x: 0, y: 1.05, z: 1.6 } };
      fx.handle([hit], fighters);
      const glows = () => (scene.children.find(o => o.name === 'emperor-bolts-glow') as THREE.Mesh & { geometry: THREE.InstancedBufferGeometry }).geometry.instanceCount;
      victim.state.action = 'stun';
      fx.update(2.5, fighters, 1);
      expect(glows(), 'the stars over the head').toBeGreaterThanOrEqual(4);
      victim.state.action = 'idle';
      fx.update(2.6, fighters, 1); fx.update(2.62, fighters, 1);
      expect(glows(), 'gone once they are out of it').toBe(0);
    } finally { fx.dispose(); }
  });

  it('decorates a thrown ender where it lands, not on the target as it leaves the hand', () => {
    const { fx, move, actor, fighters } = stage('ouga', 'lh');
    try {
      expect(move.style).toBe('projectile');
      const flashes = () => (fx as unknown as { flashes: { active: boolean; center: THREE.Vector3 }[] }).flashes.filter(f => f.active);
      const contact = move.contacts[0];
      actor.state.actionTime = (contact + .01) / move.duration; fx.update(1 + (contact + .01), fighters, 1);
      expect(flashes().length, 'a burst as it leaves the hand').toBeGreaterThan(0);
      for (const f of flashes()) expect(f.center.z, 'at the hand, not on the target 1.6 m off').toBeLessThan(1.1);
      const hit: CombatEvent = { id: 51, kind: 'hit', serverTime: 1.6, actorId: 'a', targetId: 'b', fighter: 'ouga', slot: 'heavy', branch: 'lh', actionSeq: 4, damage: 46,
        origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.05, z: 1.6 } };
      fx.handle([hit, { ...hit, id: 52 }], fighters);
      fx.update(1.61, fighters, 1);
      const landed = flashes().filter(f => f.center.z > 1.2);
      expect(landed.length, 'decorated on the body it hit, once for the throw').toBe(1);
    } finally { fx.dispose(); }
  });

  // Round 5 (GUARD): a guard is drawn on its orb only (vfx/GuardFx, tests/guardOrb.test.ts). The shock in the plane of
  // the blow and the crack in the air, drawn at a raised guard, read as a flat shield of their own there.
  it('decorates nothing at a raised guard - its orb takes the blow - and still decorates the same blow landing', () => {
    const standing = (kit: ReturnType<typeof VfxKit.for>, time: number) => {
      const f = kit.sparks as unknown as { data: Float32Array; epoch: number };
      let n = 0;
      for (let o = 0; o < f.data.length; o += 32) {
        const age = time - f.epoch - f.data[o + 3];
        if (!(age >= 0 && age < f.data[o + 7])) continue;
        const raw = f.data[o + 21], orient = Math.round(raw - 4 * Math.floor(raw / 4 + 1e-3));
        if (orient === 2 && Math.abs(f.data[o + 25]) < .8) n++;
      }
      return n;
    };
    let landedShocks = 0;
    for (const fighter of VOL1) for (const key of ['lh', 'llh', 'llls', 'airHeavy'] as ComboKey[]) for (const guarding of [true, false]) {
      const { scene, fx, move, actor, victim, fighters } = stage(fighter, key);
      if (move.style === 'projectile') { fx.dispose(); continue; }
      if (guarding) { victim.state.action = 'guard'; victim.state.guarding = true; }
      const kit = VfxKit.for(scene);
      try {
        const contact = move.contacts[0];
        for (const e of [contact - .05, contact + .01, contact + .05]) { actor.state.actionTime = e / move.duration; fx.update(1 + e, fighters, 1); }
        const inside = fx as unknown as { cracks: { active: boolean }[]; flashes: { active: boolean; center: THREE.Vector3 }[] };
        const shocks = standing(kit, 1 + contact + .06), cracks = inside.cracks.filter(c => c.active).length;
        const atBody = inside.flashes.filter(f => f.active && f.center.z > 1.2).length;
        if (guarding) {
          expect(shocks, `${fighter} ${key}: a disc standing at the guard`).toBe(0);
          expect(cracks, `${fighter} ${key}: a crack in the air at the guard`).toBe(0);
          expect(atBody, `${fighter} ${key}: a flash on the guarding body`).toBe(0);
        } else landedShocks += shocks;
      } finally { kit.release(); fx.dispose(); }
    }
    expect(landedShocks, 'the blowback\'s shock still stands in the plane of a blow that lands').toBeGreaterThan(8);
  });

  it('adds nothing to the scene for them: the shop\'s pools and the shared kit draw it all', () => {
    const scene = new THREE.Scene(), fx = new EmperorEffects(scene);
    try { expect(scene.children.every(o => !/main|ender|daze/i.test(o.name))).toBe(true); } finally { fx.dispose(); }
  });
});
