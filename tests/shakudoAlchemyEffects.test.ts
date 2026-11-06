import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { SHAKUDO_MOVES } from '../src/game/fighters/shakudo';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { ShakudoAlchemy, SHAKUDO_ALCHEMY_LIMITS, SHAKUDO_ALCHEMY_BEATS, shakudoStrikePoint } from '../src/render/signature/ShakudoAlchemy';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const id = 'shakudo' as FighterId, ULT = SHAKUDO_MOVES.ultimate, SPECIAL = SHAKUDO_MOVES.special;
/** The module stages on the scene's shared MoveStage: the test holds it too, to read what is drawn. */
function harness(budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new ShakudoAlchemy(scene, { budget });
  function fighter(name: string) {
    const group = new THREE.Group(); return { group, model: new THREE.Group(), bones: new Map(), handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.7, 2),
      state: { id: name, fighter: name === 'shakudo' ? id : 'taisei', alive: true, action: 'idle', yaw: 0, actionTime: 0, actionDuration: ULT.duration, actionSeq: 4 } as PlayerState } as unknown as Fighter;
  }
  const actor = fighter('shakudo'), foe = fighter('foe'); foe.group.position.z = 2;
  const stone = scene.getObjectByName('edward-alchemy-stone') as THREE.InstancedMesh;
  const stones = () => { const m = new THREE.Matrix4(), rows: THREE.Vector3[] = []; for (let i = 0; i < stone.count; i++) { stone.getMatrixAt(i, m); rows.push(new THREE.Vector3().setFromMatrixPosition(m)); } return rows; };
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots + stone.count; };
  return { scene, stage, fx, actor, foe, stone, stones, drawn, fighters: new Map([['shakudo', actor], ['foe', foe]]), flights: new Map<string, Flight>(), end() { fx.dispose(); stage.release(); } };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: id, actorId: 'shakudo', targetId: 'foe', slot: 'ultimate', actionSeq: 4, serverTime: 10 + ULT.contacts[0], ...patch });

describe('Edward manually triggered alchemy presentation', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(id)).toBe(true); });

  it('uses native finger and dual-hand contact without recursive strike queries', () => {
    const h = harness(); try {
      h.actor.strikePoint = () => { throw new Error('Recursive strike query'); };
      h.actor.state.action = 'light'; expect(shakudoStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handR)).toBe(true);
      h.actor.state.action = 'light'; h.actor.state.chain = 2; expect(shakudoStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handL)).toBe(true); h.actor.state.chain = 0;
      h.actor.state.action = 'ultimate'; h.actor.state.actionTime = 3.3 / 4.08;
      expect(shakudoStrikePoint(h.actor, new THREE.Vector3()).equals(h.actor.handL.clone().lerp(h.actor.handR, .5))).toBe(true);
    } finally { h.end(); }
  });

  it('does not mutate simulation state or generate effects from idle awakened state', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { awakened: true });
      const before = JSON.stringify(h.actor.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
    } finally { h.end(); }
  });

  it('claps, then draws the circle and the reaction through a special\'s wind-up, with no stone before the release', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'special', actionDuration: SPECIAL.duration, actionTime: .2 / SPECIAL.duration });
      h.fx.update(10.2, h.fighters, h.flights);
      const before = h.stage.counts.bolts;
      h.actor.state.actionTime = (SHAKUDO_ALCHEMY_BEATS.clap + .25) / SPECIAL.duration;
      h.fx.update(10.55, h.fighters, h.flights);
      // The star, the inner ring, part of the outer one; five bolts off the floor and one from each hand.
      expect(h.stage.counts.bolts).toBeGreaterThan(before + 60); expect(h.stage.counts.lights).toBeGreaterThan(1); expect(h.stone.count).toBe(0);
    } finally { h.end(); }
  });

  it('draws only a released authoritative lance, as the line it has run, and lets the row sink when it is gone', () => {
    const h = harness(); try {
      const flight = { fighter: id, slot: 'special', released: false, actorId: 'shakudo', origin: new THREE.Vector3(0, 1.1, 0), position: new THREE.Vector3(0, 1.1, 4.2), heading: new THREE.Vector3(0, 0, 1) } as unknown as Flight;
      h.flights.set('f', flight);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      flight.released = true;
      h.fx.update(10.02, h.fighters, h.flights);
      // Five spikes along 4.2 m of floor (one every 0.8 m), every one on the line and behind the lance's head.
      const row = h.stones(); expect(row).toHaveLength(5);
      for (const p of row) { expect(Math.abs(p.x)).toBeLessThan(.3); expect(p.z).toBeGreaterThan(.7); expect(p.z).toBeLessThan(4.6); }
      expect(h.stage.counts.lights).toBe(1);
      h.flights.clear();
      h.fx.update(10.3, h.fighters, h.flights); expect(h.stone.count).toBe(5); expect(h.stage.counts.lights).toBe(0);
      h.fx.update(11.2, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('prefers the struck body, and raises one spire where a lance lands, once', () => {
    const h = harness(); try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.9, endpoint: { x: 4, y: 1, z: 9 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(11.1, h.fighters, h.flights);
      // burst, shock, scar: once each. The spire and five smaller stones round its foot, on the floor under the victim.
      expect(h.stage.counts.shots).toBe(3); expect(h.stone.count).toBe(6);
      const spire = h.stones()[0]; expect(spire.x).toBeCloseTo(0, 5); expect(spire.z).toBeCloseTo(2.18, 1); expect(spire.y).toBeCloseTo(1.45, 1);
      h.fx.update(14, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires the confirm, then leaves a caster-facing opening in the wall it raises behind the victim', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 2.6 / ULT.duration });
      h.fx.update(12.6, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(12.6, h.fighters, h.flights);
      const wall = h.stones(); expect(wall).toHaveLength(5);
      // Every slab stands past the victim (z = 2) from where he stands (z = 0): nothing between the pair, or behind him.
      for (const p of wall) expect(p.z).toBeGreaterThan(2.9);
      expect(h.stage.counts.bolts).toBeGreaterThan(60); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      // The victim launches: the wall stays where the blow put them... (it follows the body it boxes in, by design).
      h.actor.state.whiffedAt = 12.61;
      h.fx.update(12.62, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed transmutation on %s', reason => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: 2.2 / ULT.duration });
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.actor.state.action = 'hurt';
      if (reason === 'new action') h.actor.state.actionSeq = 5;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('keeps the final spires fixed where the blow landed while a living target launches, and bounds crowded effects', () => {
    const h = harness(); try {
      Object.assign(h.actor.state, { action: 'ultimate', actionTime: ULT.contacts[2] / ULT.duration });
      const last = event({ id: 9, kind: 'hit', contactIndex: 2, serverTime: 10 + ULT.contacts[2] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[2] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.group.position.set(6, 3, 9);
      h.fx.update(10 + ULT.contacts[2] + .4, h.fighters, h.flights);
      // Five spires and seven stones round them, still where the victim stood (z = 2).
      const spires = h.stones(); expect(spires).toHaveLength(12);
      for (const p of spires) { expect(Math.hypot(p.x, p.z - 2)).toBeLessThan(3.6); }
      expect(h.stage.counts.shots).toBe(4);
      for (let i = 0; i < 400; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10 + ULT.contacts[2] + .4 }), h.fighters);
      h.fx.update(10 + ULT.contacts[2] + .6, h.fighters, h.flights);
      expect(h.stone.count).toBeLessThanOrEqual(SHAKUDO_ALCHEMY_LIMITS.stones); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots);
      h.fx.dispose(); h.fx.dispose(); expect(h.scene.getObjectByName('edward-alchemy-stone')).toBeUndefined();
    } finally { h.end(); }
  });
});
