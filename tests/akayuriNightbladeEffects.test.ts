import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { AKAYURI_MOVES } from '../src/game/fighters/akayuri';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { AkayuriNightblade, AKAYURI_VFX_LIMITS, AKAYURI_BLADE, akayuriBlade } from '../src/render/signature/AkayuriNightblade';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { STAGED_BY_MODULE } from '../src/render/signature/StagedMoves';

const ID = 'akayuri' as FighterId, ULT = AKAYURI_MOVES.ultimate, LAST = ULT.contacts.length - 1;
/** A stand-in body: a sword bone on a group, nothing skinned. */
function body(id: string, patch: Partial<PlayerState> = {}) {
  const group = new THREE.Group(), sword = new THREE.Bone(); sword.position.set(.3, 1.1, .3); group.add(sword); group.updateMatrixWorld(true);
  const fighter = { group, bones: new Map([['sword', sword]]), handR: new THREE.Vector3(.3, 1.1, .3), handL: new THREE.Vector3(-.3, 1.1, .3), strikePoint: (out: THREE.Vector3) => out.set(.3, 1.1, .9),
    state: { id, fighter: id === 'akayuri' ? ID : 'taisei', alive: true, action: 'idle', actionSeq: 4, actionTime: 0, actionDuration: ULT.duration, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
  return { fighter, sword };
}
const event = (patch: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'confirm', fighter: ID, actorId: 'akayuri', targetId: 'foe', actionSeq: 4, slot: 'ultimate', serverTime: 10 + ULT.contacts[0], ...patch });
/** The module stages on the scene's shared MoveStage: the test holds it too, to read what is drawn. */
function setup(patch: Partial<PlayerState> = {}, budget = 1) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget }), fx = new AkayuriNightblade(scene, { budget }), akayuri = body('akayuri', patch), foe = body('foe').fighter; foe.group.position.z = 2.4;
  const fighters = new Map([['akayuri', akayuri.fighter], ['foe', foe]]), flights = new Map<string, Flight>();
  const ink = () => (scene.getObjectByName('akayuri-curse-ink') as THREE.InstancedMesh).count;
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shots + ink(); };
  return { scene, stage, fx, akayuri: akayuri.fighter, sword: akayuri.sword, foe, fighters, flights, ink, drawn, end() { fx.dispose(); stage.release(); } };
}

describe('Akayuri manual Nightblade presentation', () => {
  it('stages her own moves, so the baseline stands aside', () => { expect(STAGED_BY_MODULE.has(ID)).toBe(true); });

  it('draws nothing while idle or in an unconfirmed ultimate past its opener, and never writes a state', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.akayuri.state);
      h.fx.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(JSON.stringify(h.akayuri.state)).toBe(before);
      Object.assign(h.akayuri.state, { action: 'ultimate', actionTime: 2 / ULT.duration });
      h.fx.update(12, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('lights the edge of the sword that is shown, from its guard to its point', () => {
    const move = AKAYURI_MOVES.heavy, h = setup({ action: 'heavy', actionDuration: move.duration, actionTime: .3 / move.duration });
    try {
      h.sword.position.set(3, 2, 1); h.akayuri.group.updateMatrixWorld(true);
      const root = new THREE.Vector3(), tip = new THREE.Vector3();
      expect(akayuriBlade(h.akayuri, root, tip)).toBe(true);
      expect(tip.distanceTo(new THREE.Vector3(3, 2, 1).add(new THREE.Vector3(...AKAYURI_BLADE.tip)))).toBeLessThan(1e-6);
      h.fx.update(10.3, h.fighters, h.flights);
      const glow = (h.scene.getObjectByName('stage-glow') as THREE.Mesh).geometry.getAttribute('aP');
      // (The first glow asked for is the point's.)
      expect(new THREE.Vector3(glow.getX(0), glow.getY(0), glow.getZ(0)).distanceTo(tip)).toBeLessThan(1e-4);
      expect(h.stage.counts.bolts).toBeGreaterThan(2); expect(h.stage.counts.lights).toBe(2); expect(h.ink()).toBe(0);
      // The reversal's arc at the blow, whether or not it lands: twelve strokes doubled and the edge's two.
      h.akayuri.state.actionTime = (move.contacts[0] + .08) / move.duration;
      h.fx.update(10.64, h.fighters, h.flights);
      expect(h.stage.counts.bolts).toBe(26);
    } finally { h.end(); }
  });

  it('lands Far Shore Thrust once: the lines on the blow, then the curse\'s marks in ink out of the wound', () => {
    const move = AKAYURI_MOVES.special, h = setup({ action: 'special', actionDuration: move.duration, actionTime: move.contacts[0] / move.duration });
    try {
      const hit = event({ id: 7, kind: 'hit', slot: 'special', contactIndex: 0, serverTime: 10.66 });
      h.fx.handle(hit, h.fighters); h.fx.handle(hit, h.fighters);
      h.fx.update(10.68, h.fighters, h.flights);
      // burst, shock, erupt, scar once each; the thrust's line (not the whiff's as well); no mark yet.
      expect(h.stage.counts.shots).toBe(4); expect(h.stage.counts.bolts).toBe(2); expect(h.ink()).toBe(0);
      h.fx.update(11.1, h.fighters, h.flights);
      const marks = h.ink();
      expect(marks).toBeGreaterThan(20); expect(marks).toBeLessThanOrEqual(AKAYURI_VFX_LIMITS.ink);
      // Every mark lies on a line of red light.
      expect(h.stage.counts.bolts).toBeGreaterThanOrEqual(marks);
      h.fx.update(14, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('requires a confirmed hit before Equinox: Lily Field gathers', () => {
    const h = setup({ action: 'ultimate', actionTime: 1.2 / ULT.duration });
    try {
      h.fx.update(11.2, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters);
      h.fx.update(11.2, h.fighters, h.flights);
      // The curse on the floor round the victim, its black flames, the flurry's lines.
      expect(h.stage.counts.discs).toBe(1); expect(h.stage.counts.flames).toBeGreaterThan(8); expect(h.stage.counts.bolts).toBeGreaterThan(6);
      expect(h.stage.counts.lights).toBeLessThanOrEqual(STAGE_LIMITS.lights / 2);
    } finally { h.end(); }
  });

  it.each(['interrupted', 'new action', 'whiff', 'target death', 'reset'])('cancels a confirmed gather on %s', reason => {
    const h = setup({ action: 'ultimate', actionTime: 2.2 / ULT.duration });
    try {
      h.fx.handle(event(), h.fighters); h.fx.update(12.2, h.fighters, h.flights);
      expect(h.drawn()).toBeGreaterThan(0);
      if (reason === 'interrupted') h.akayuri.state.action = 'hurt';
      if (reason === 'new action') h.akayuri.state.actionSeq = 5;
      if (reason === 'whiff') h.fx.handle(event({ id: 2, kind: 'whiff' }), h.fighters);
      if (reason === 'target death') h.foe.state.alive = false;
      if (reason === 'reset') h.fx.reset();
      h.fx.update(12.21, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('gives the last cut nothing without its confirm; with it, the one cut and the curse outlive the victim, and end', () => {
    const h = setup({ action: 'ultimate', actionTime: ULT.contacts[LAST] / ULT.duration });
    try {
      const last = event({ id: 9, kind: 'hit', contactIndex: LAST, serverTime: 10 + ULT.contacts[LAST] });
      h.fx.handle(last, h.fighters);
      h.fx.update(10 + ULT.contacts[LAST] + .02, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.fx.handle(event(), h.fighters); h.fx.handle({ ...last, id: 10 }, h.fighters);
      h.foe.state.alive = false;
      h.fx.update(10 + ULT.contacts[LAST] + .4, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(5); expect(h.ink()).toBeGreaterThan(20);
      Object.assign(h.akayuri.state, { action: 'idle', actionTime: 0 });
      h.fx.update(10 + ULT.contacts[LAST] + 4, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('keeps its ink and its records bounded under a crowd, and draws less on a low budget', () => {
    const full = setup({ action: 'idle' }), low = setup({ action: 'idle' }, .5);
    try {
      for (const h of [full, low]) { for (let i = 0; i < 500; i++) h.fx.handle(event({ id: 100 + i, kind: 'hit', slot: 'heavy', serverTime: 12 }), h.fighters); h.fx.update(12.6, h.fighters, h.flights); }
      expect(full.ink()).toBe(AKAYURI_VFX_LIMITS.ink); expect(low.ink()).toBeLessThan(full.ink());
      expect(full.stage.counts.bolts).toBeLessThanOrEqual(STAGE_LIMITS.bolts);
      full.fx.dispose(); full.fx.dispose();
      expect(full.scene.getObjectByName('akayuri-curse-ink')).toBeUndefined();
    } finally { full.end(); low.end(); }
  });
});
