import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { HISAME_MOVES, HISAME_AWAKENING, HISAME_RAPIER_TIP, hisameStrikeJoint } from '../src/game/fighters/hisame';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { HisameWhiteoutGlassCoffin, HISAME_FROST_LIMITS } from '../src/render/signature/HisameWhiteoutGlassCoffin';
import { SIGNATURE } from '../src/render/signature/context';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'hisame' as FighterId, ULT = HISAME_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.4, 1.3, .3), strikePoint: (out: THREE.Vector3) => out.set(-.4, 1.3, .3),
    state: { id, fighter: id === 'hisame' ? ID : 'taisei', alive: true, action: 'idle', actionSeq: 3, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'hisame', targetId: 'foe', actionSeq: 3, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
/** The module stages on the scene's shared MoveStage: the test holds it too, to read what is drawn. */
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new HisameWhiteoutGlassCoffin(scene, { budget }), hisame = body('hisame', patch), foe = body('foe'); foe.group.position.z = 2.4;
  const fighters = new Map([['hisame', hisame], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  return { scene, stage, fx, hisame, foe, fighters, flights, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Hisame manual frost presentation', () => {
  it('stages her own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('has no idle field and requires a confirmed attack before WHITEOUT: Glass Coffin', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.hisame.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.hisame.state)).toBe(before);
      Object.assign(h.hisame.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.handle(event({ kind: 'cast' }), h.fighters);
      h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('freezes the whole frame for a breath on the confirm, only for someone the move involves, then holds the room still', () => {
    const h = setup({ action: 'ultimate', actionTime: (ULT.contacts[0] + .15) / ULT.duration }), timeStop = vi.fn(), screen = SIGNATURE.screen, local = SIGNATURE.localId;
    try {
      SIGNATURE.screen = { timeStop }; SIGNATURE.localId = 'hisame';
      h.fx.handle(event(), h.fighters); h.fx.handle(event(), h.fighters);
      h.fx.update(10 + ULT.contacts[0] + .15, h.fighters, h.flights);
      expect(timeStop).toHaveBeenCalledTimes(1); expect(timeStop.mock.calls[0][0]).toBeCloseTo(1, 5);
      // The shell and the ring going out (once, whatever is delivered twice), frost on the floor, the victim cased.
      expect(h.stage.counts.shots).toBe(2); expect(h.stage.counts.discs).toBe(2); expect(h.stage.counts.shells).toBe(2);
      expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      SIGNATURE.localId = 'someone-else'; timeStop.mockClear();
      h.fx.update(10 + ULT.contacts[0] + .2, h.fighters, h.flights);
      expect(timeStop).not.toHaveBeenCalled();
      // After the breath: no post pass, the motes fixed where they were, her spears hung one by one.
      SIGNATURE.localId = 'hisame';
      const motes = (t: number) => { h.hisame.state.actionTime = t / ULT.duration; h.fx.update(10 + t, h.fighters, h.flights); const p = (h.scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP'); return [p.getX(0), p.getY(0), p.getZ(0)]; };
      const first = motes(1.6), bolts = h.stage.counts.bolts, later = motes(2.4);
      expect(timeStop).not.toHaveBeenCalled(); expect(later).toEqual(first); expect(h.stage.counts.bolts).toBeGreaterThan(bolts);
    } finally { SIGNATURE.screen = screen; SIGNATURE.localId = local; h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed freeze on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.stage.counts.shells).toBe(1);
      if (reason === 'interrupted') h.hisame.state.action = 'hurt';
      if (reason === 'new action') h.hisame.state.actionSeq = 4;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('grows the lance in the hand that throws it and dresses only a released authoritative flight', () => {
    const move = HISAME_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: .4 / move.duration });
    try {
      h.fx.update(10.4, h.fighters, h.flights);
      const bolt = (h.scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA');
      // (The lance's shaft starts in her left hand.)
      expect(new THREE.Vector3(bolt.getX(0), bolt.getY(0), bolt.getZ(0)).distanceTo(new THREE.Vector3(-.4, 1.3, .3))).toBeLessThan(1e-6);
      h.hisame.state.action = 'idle';
      const flight = { fighter: ID, slot: 'special', released: false, actorId: 'hisame', position: new THREE.Vector3(0, 1.3, 3), heading: new THREE.Vector3(0, 0, 1) } as unknown as Flight;
      h.flights.set('f', flight);
      h.fx.update(10.8, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      flight.released = true;
      h.fx.update(10.82, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(2); expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.lights).toBe(1);
      h.flights.clear();
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.9 });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.95, h.fighters, h.flights);
      // burst, shatter, shock, scar: once each.
      expect(h.stage.counts.shots).toBe(4);
      h.fx.update(14, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last blow nothing without its confirm; with it, the frozen world breaks, outlives the victim, and ends', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(6); expect(h.stage.counts.bolts).toBeGreaterThan(40);
      Object.assign(h.hisame.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('caps a crowd, draws fewer motes on a low budget, and disposes once', () => {
    const full = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration }), low = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration }, .35);
    try {
      for (const h of [full, low]) { h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights); }
      expect(low.stage.counts.glows).toBeLessThan(full.stage.counts.glows);
      for (let i = 0; i < 1000; i++) full.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'special', serverTime: 12.2 }), full.fighters);
      full.fx.update(12.3, full.fighters, full.flights);
      expect(full.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots); expect(full.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts); expect(HISAME_FROST_LIMITS.marks).toBe(10);
      full.fx.dispose(); full.fx.dispose();
    } finally { full.end(); low.end(); }
  });

  it('preserves manual projectile release and a responsive distinct two-hit finale', () => {
    expect(ULT.contacts[0]).toBeLessThanOrEqual(.6); expect(ULT.damage + ULT.finisherDamage!).toBe(290);
    expect(HISAME_MOVES.special.style).toBe('projectile'); expect(HISAME_MOVES.special.aimOnRelease).toBe(true);
    expect(hisameStrikeJoint('special', 'Glacier Javelin')).toBe('LeftHand'); expect(hisameStrikeJoint('heavy', 'Black Ice')).toBe('RightHand');
    expect(hisameStrikeJoint('special', 'Chandelier')).toBe('RightHand'); expect(hisameStrikeJoint('heavy', 'Hoarfrost')).toBe('LeftHand'); expect(hisameStrikeJoint('special')).toBe('LeftHand');
    expect(HISAME_AWAKENING.runtimeDuration).toBe(.9); expect(HISAME_RAPIER_TIP[1]).toBeGreaterThan(.9);
  });
});
