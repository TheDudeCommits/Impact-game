import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MUREX_MOVES, MUREX_AWAKENING, murexStrikeJoint } from '../src/game/fighters/murex';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { MurexBarrier, MUREX_AT_LIMITS } from '../src/render/signature/MurexBarrier';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'murex' as FighterId, ULT = MUREX_MOVES.ultimate, LAST = ULT.contacts.length - 1;
function body(id: string, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.5, 1.7, .4), handL: new THREE.Vector3(-.5, 1.7, .4), strikePoint: (out: THREE.Vector3) => out.set(-.5, 1.7, .4),
    state: { id, fighter: id === 'murex' ? ID : 'taisei', alive: true, action: 'idle', actionSeq: 1, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'murex', targetId: 'foe', actionSeq: 1, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
/** The module stages on the scene's shared MoveStage: the test holds it too, to read what is drawn. */
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new MurexBarrier(scene, { budget }), murex = body('murex', patch), foe = body('foe'); foe.group.position.z = 2;
  const fighters = new Map([['murex', murex], ['foe', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells + c.shots; };
  const starts = () => { const p = (scene.getObjectByName('stage-bolts') as THREE.Mesh).geometry.getAttribute('aA'); return Array.from({ length: stage.counts.bolts }, (_, i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))); };
  return { scene, stage, fx, murex, foe, fighters, flights, drawn, starts, end() { fx.dispose(); stage.release(); } };
}

describe('Murex manually commanded A.T. fields', () => {
  it('stages his own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('does not create idle or unconfirmed ultimate fields', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.murex.state);
      h.fx.update(10, h.fighters, h.flights); expect(h.drawn()).toBe(0); expect(JSON.stringify(h.murex.state)).toBe(before);
      Object.assign(h.murex.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.handle(event({ kind: 'cast' }), h.fighters);
      h.fx.update(12, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires confirmation, deduplicates and clears interrupted field rupture', () => {
    const h = setup({ action: 'ultimate', actionTime: 2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.handle(event(), h.fighters);
      h.fx.update(12, h.fighters, h.flights);
      // The victim's Field in two halves: six rings of four sides each, twice; the tear's light, the strain's two
      // bolts of five, the charge's streaks.
      const torn = h.stage.counts.bolts;
      expect(torn).toBeGreaterThanOrEqual(48 + 2 + 10); expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
      // The halves stand to either side of where the victim is, further apart as it builds.
      const spread = () => { const xs = h.starts().slice(0, 48).map(p => p.x); return Math.max(...xs) - Math.min(...xs); };
      const early = spread(); h.murex.state.actionTime = 2.9 / ULT.duration; h.fx.update(12.9, h.fighters, h.flights);
      expect(spread()).toBeGreaterThan(early);
      h.murex.state.action = 'hurt';
      h.fx.update(12.92, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it.each(['new action', 'whiff', 'target death', 'reset'])('cancels a confirmed rupture on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'new action') h.murex.state.actionSeq = 2;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('charges the palm that strikes, then dresses only actual released flights', () => {
    const move = MUREX_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: .4 / move.duration });
    try {
      h.fx.update(10.4, h.fighters, h.flights);
      const glow = (h.scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP');
      // (The charge's first glow is on the palm; his Field opens a step ahead of it.)
      expect(new THREE.Vector3(glow.getX(0), glow.getY(0), glow.getZ(0)).distanceTo(new THREE.Vector3(-.5, 1.7, .4))).toBeLessThan(1e-6);
      expect(h.stage.counts.bolts).toBeGreaterThan(16);
      h.murex.state.action = 'idle';
      const flight = { fighter: ID, slot: 'special', released: false, actorId: 'murex', position: new THREE.Vector3(0, 1.5, 4), heading: new THREE.Vector3(0, 0, 1) } as unknown as Flight;
      h.flights.set('f', flight);
      h.fx.update(10.8, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      flight.released = true;
      h.fx.update(10.82, h.fighters, h.flights);
      // Five rings of eight sides and two smaller walls of two behind them, all across the way it flies.
      expect(h.stage.counts.bolts).toBe(40 + 16 + 16); expect(h.stage.counts.lights).toBe(1);
      for (const p of h.starts().slice(0, 40)) expect(p.z).toBeCloseTo(4, 5);
    } finally { h.end(); }
  });

  it('keeps the confirmed final rupture at its authoritative endpoint after recoil, once, and lets it end', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST], endpoint: { x: 0, y: 1.4, z: 2 } });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights); expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.group.position.set(5, 0, 9); h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .2, h.fighters, h.flights);
      // shatter, burst, the pillar, shock, scar: once each; the bar of the cross where the blow landed, not where the victim went.
      expect(h.stage.counts.shots).toBe(5);
      const bar = h.starts().at(-1)!; expect(bar.z).toBeCloseTo(2, 5); expect(Math.abs(bar.x)).toBeLessThan(6.1);
      Object.assign(h.murex.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('bounds crowd records and frees every scene resource', () => {
    for (const budget of [.35, 1]) {
      const h = setup({}, budget);
      try {
        for (let i = 0; i < 1000; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), h.fighters);
        h.fx.update(12.05, h.fighters, h.flights);
        // Fourteen struck Fields at most, three rings of eight sides each.
        expect(h.stage.counts.bolts).toBe(MUREX_AT_LIMITS.marks * 24); expect(h.stage.counts.shots).toBeLessThanOrEqual(STAGE_LIMITS.shots);
        h.fx.reset(); expect(h.drawn()).toBe(0);
      } finally { h.end(); }
      expect(h.scene.children).toHaveLength(0);
    }
  });

  it('maps physical hands and leaves awakening nonautonomous', () => {
    expect(ULT.contacts[0]).toBeLessThanOrEqual(.6); expect(ULT.damage + ULT.finisherDamage!).toBe(290); expect(MUREX_MOVES.special.aimOnRelease).toBe(true);
    expect(murexStrikeJoint('special', 'Flinch Wave')).toBe('LeftHand'); expect(murexStrikeJoint('special', 'Mantis Drop')).toBe('BothHands'); expect(murexStrikeJoint('heavy', 'Armored Hammer')).toBe('BothHands');
    expect(murexStrikeJoint('ultimate', 'Spinestorm', 0)).toBe('LeftHand'); expect(murexStrikeJoint('ultimate', 'Spinestorm', 1)).toBe('RightHand');
    expect(MUREX_AWAKENING.runtimeDuration).toBe(.9); expect(MUREX_AWAKENING.manualOnly).toBe(true); expect(MUREX_AWAKENING.sameBody).toBe(true);
    const h = setup({ action: 'awaken', actionDuration: .9, actionTime: .5 });
    try {
      const before = JSON.stringify(h.murex.state);
      h.fx.update(10.45, h.fighters, h.flights);
      expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.bolts).toBe(16 + 8); expect(JSON.stringify(h.murex.state)).toBe(before);
    } finally { h.end(); }
  });
});
