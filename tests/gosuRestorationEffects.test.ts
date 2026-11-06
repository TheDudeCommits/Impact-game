import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { GOSU_MOVES } from '../src/game/fighters/gosu';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { GosuRestoration, GOSU_RESTORATION_LIMITS } from '../src/render/signature/GosuRestoration';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'gosu' as FighterId, ULT = GOSU_MOVES.ultimate, SPECIAL = GOSU_MOVES.special, LAST = ULT.contacts.length - 1;
/** A stand-in body whose strike point is the Stand's knuckle beside him. */
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), strikePoint: (out: THREE.Vector3) => out.set(.9, 1.3, 1.5),
    state: { id, fighter: id === 'gosu' ? ID : 'taisei', alive: true, action: 'idle', actionSeq: 3, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'gosu', targetId: 'foe', actionSeq: 3, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
/** The module stages on the scene's shared MoveStage: the test holds it too, to read what is drawn. */
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new GosuRestoration(scene, { budget }), gosu = body('gosu', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['gosu', gosu], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  return { scene, stage, fx, gosu, foe, fighters, flights, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Gosu manually triggered restoration presentation', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('leaves idle and unconfirmed input silent, and never writes a state', () => {
    const h = setup(); try {
      const before = JSON.stringify(h.gosu.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.gosu.state)).toBe(before);
      Object.assign(h.gosu.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('anchors a heavy to the authoritative endpoint, breaks the floor there, and mends it; replayed receipts count once', () => {
    const h = setup({ action: 'heavy', actionDuration: GOSU_MOVES.heavy.duration, actionTime: GOSU_MOVES.heavy.contacts[0] / GOSU_MOVES.heavy.duration }); try {
      const hit = event({ id: 7, kind: 'hit', slot: 'heavy', contactIndex: 0, serverTime: 10.48, endpoint: { x: 4, y: 1.2, z: 9 } });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.55, h.fighters, h.flights);
      // burst, the cracks, the ring: once each; not yet mending.
      expect(h.stage.counts.shots).toBe(3);
      const cracks = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA');
      // (A crack starts where the simulation said the blow landed, a step past it along the blow, on the floor.)
      const first = new THREE.Vector3(cracks.getX(0), cracks.getY(0), cracks.getZ(0));
      expect(Math.hypot(first.x - 4, first.z - 9)).toBeLessThan(1); expect(first.y).toBeCloseTo(.06, 5);
      Object.assign(h.gosu.state, { action: 'idle', actionTime: 0 });
      h.fx.update(11, h.fighters, h.flights);
      // The break has gone and the mending is drawn: closing cracks, pieces drawn back, motes.
      expect(h.stage.counts.shots).toBe(0); expect(h.stage.counts.bolts).toBeGreaterThan(9); expect(h.stage.counts.glows).toBeGreaterThanOrEqual(9);
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('draws the rush only while its blows go on', () => {
    const h = setup({ action: 'special', actionDuration: SPECIAL.duration, actionTime: .7 / SPECIAL.duration }); try {
      h.fx.update(10.7, h.fighters, h.flights);
      // Ten fists, each a streak doubled.
      expect(h.stage.counts.bolts).toBe(20); expect(h.stage.counts.lights).toBe(1);
      h.gosu.state.actionTime = 1.3 / SPECIAL.duration;
      h.fx.update(11.3, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires the confirm, then cracks the floor and the air wider with every blow that has landed', () => {
    const h = setup({ action: 'ultimate', actionTime: 1 / ULT.duration }); try {
      h.fx.update(11, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      const reach = (t: number) => { h.gosu.state.actionTime = t / ULT.duration; h.fx.update(10 + t, h.fighters, h.flights); const a = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA'), b = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aB'); let far = 0; for (let i = 0; i < 40; i++) far = Math.max(far, Math.hypot(b.getX(i) - a.getX(0), b.getZ(i) - a.getZ(0))); return far; };
      const early = reach(1), late = reach(2.4);
      expect(late).toBeGreaterThan(early * 1.5); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a pending break on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration }); try {
      h.fx.handle(event(), h.fighters); h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.gosu.state.action = 'hurt';
      if (reason === 'new action') h.gosu.state.actionSeq = 4;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.01, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('releases only a final hit that was confirmed, restores what it broke, bounds a crowd and disposes once', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration }); try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      // burst, the air broken, the floor broken, the ring; the glow of the mending waits its half second.
      expect(h.stage.counts.shots).toBe(5); expect(h.stage.counts.shells).toBe(0);
      Object.assign(h.gosu.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 1, h.fighters, h.flights);
      // Restoring: the shell of light drawing in, the cracks closing.
      expect(h.stage.counts.shells).toBe(1); expect(h.stage.counts.bolts).toBeGreaterThan(14);
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      for (let i = 0; i < 400; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', contactIndex: 0, serverTime: 20 }), h.fighters);
      h.fx.update(20.5, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots); expect(GOSU_RESTORATION_LIMITS.marks).toBe(10);
      h.fx.dispose(); h.fx.dispose();
    } finally { h.end(); }
  });
});
