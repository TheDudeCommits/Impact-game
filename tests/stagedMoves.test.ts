import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import type { VfxKit } from '../src/render/vfx/VfxKit';
import { HOME_EXPANSION_FIGHTERS } from '../src/ui/HomeRosterOrder';
import { LABORATORY_FIGHTERS } from '../src/game/rosterAvailability';
import { MoveStage } from '../src/render/signature/MoveStage';
import { RosterSignatureSet } from '../src/render/signature/RosterSignatureSet';
import { STAGED_BY_MODULE, StagedMoves, lookOf, stagedBaseline } from '../src/render/signature/StagedMoves';
import { elementFor } from '../src/render/vfx/palette';

const WIP = 'yodaka' as FighterId;
function body(id: string, fighter: FighterId, patch: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2), state: { id, fighter, alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 1, yaw: 0, ...patch } as PlayerState } as unknown as Fighter;
}
function setup(fighter: FighterId = WIP) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), staging = new StagedMoves(fighter, scene, { budget: 1 }), actor = body('a', fighter), foe = body('v', 'taisei'); foe.group.position.z = 3;
  const fighters = new Map([['a', actor], ['v', foe]]), flights = new Map<string, Flight>();
  const drawn = () => { const c = stage.counts; return c.flames + c.glows + c.bolts + c.discs + c.shells; };
  return { scene, stage, staging, actor, foe, fighters, flights, drawn, end() { staging.dispose(); stage.release(); } };
}
const hit = (patch: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', fighter: WIP, actorId: 'a', targetId: 'v', actionSeq: 2, slot: 'special', serverTime: 10, ...patch });

describe('the baseline staging of the WIP fighters (docs/engine/VFX_BAR.md)', () => {
  it('is for the WIP fighters whose modules do not stage themselves, and never an original', () => {
    for (const id of ['taisei', 'gummy', 'konta', 'kenzo', 'nigo'] as FighterId[]) expect(stagedBaseline(id), id).toBe(false);
    for (const id of STAGED_BY_MODULE) { expect([...HOME_EXPANSION_FIGHTERS, ...LABORATORY_FIGHTERS] as readonly string[]).toContain(id); expect(stagedBaseline(id), id).toBe(false); }
    expect(HOME_EXPANSION_FIGHTERS.filter(id => stagedBaseline(id)).length).toBe(HOME_EXPANSION_FIGHTERS.length - HOME_EXPANSION_FIGHTERS.filter(id => STAGED_BY_MODULE.has(id)).length);
  });

  it('draws nothing for an idle fighter, a jab or another fighter\'s move, and writes no state', () => {
    const h = setup();
    try {
      const before = JSON.stringify(h.actor.state);
      h.staging.update(10, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      h.staging.handle(hit({ slot: 'light' }), h.fighters); h.staging.handle(hit({ id: 2, fighter: 'taisei' as FighterId }), h.fighters);
      h.staging.update(10.05, h.fighters, h.flights);
      expect(h.drawn()).toBe(0); expect(h.stage.counts.shots).toBe(0); expect(JSON.stringify(h.actor.state)).toBe(before);
    } finally { h.end(); }
  });

  it('charges the hand through a special\'s wind-up and stops at its release', () => {
    const h = setup(), move = MOVES[WIP].special;
    try {
      Object.assign(h.actor.state, { action: 'special', actionDuration: move.duration, actionTime: move.contacts[0] * .6 / move.duration });
      h.staging.update(10, h.fighters, h.flights);
      expect(h.stage.counts.glows).toBeGreaterThan(1); expect(h.stage.counts.bolts).toBeGreaterThan(3); expect(h.stage.counts.lights).toBe(1);
      h.actor.state.actionTime = (move.contacts[0] + .05) / move.duration;
      h.staging.update(10.3, h.fighters, h.flights);
      expect(h.drawn()).toBe(0);
      // A whiffed move and a combo ender get none.
      Object.assign(h.actor.state, { actionTime: .1, whiffedAt: 10 }); h.staging.update(10.4, h.fighters, h.flights); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('lights a shot in flight and blasts where a special lands, once, leaving a burn', () => {
    const h = setup();
    try {
      h.flights.set('shot', { fighter: WIP, slot: 'special', actorId: 'a', released: true, since: 10, position: new THREE.Vector3(0, 1.2, 2), heading: new THREE.Vector3(0, 0, 1) } as Flight);
      h.staging.update(10.1, h.fighters, h.flights);
      expect(h.stage.counts.lights).toBe(1); expect(h.stage.counts.glows).toBe(2);
      h.flights.clear();
      const e = hit({ serverTime: 10.2 }); h.staging.handle(e, h.fighters); h.staging.handle(e, h.fighters);
      h.staging.update(10.3, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(2); // the blast and the burn, not two of each
      h.staging.update(11.2, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(1); // the burn outlives the blast
      h.staging.update(13, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(0); expect(h.drawn()).toBe(0);
    } finally { h.end(); }
  });

  it('makes an ultimate\'s last blow its biggest', () => {
    const h = setup(), last = MOVES[WIP].ultimate.contacts.length - 1;
    try {
      h.staging.handle(hit({ slot: 'ultimate', contactIndex: 0, serverTime: 10 }), h.fighters);
      h.staging.update(10.02, h.fighters, h.flights);
      expect(h.stage.counts.shots).toBe(last ? 1 : 3);
      if (last) { h.staging.handle(hit({ id: 2, slot: 'ultimate', contactIndex: last, serverTime: 10.1 }), h.fighters); h.staging.update(10.12, h.fighters, h.flights); expect(h.stage.counts.shots).toBe(4); }
    } finally { h.end(); }
  });

  it('takes each move\'s colours from what its hit sparks are drawn in, and burns only the roster\'s fire', () => {
    expect(lookOf(elementFor('bellows', 'special')).flame).toBeGreaterThanOrEqual(0);
    const quake = lookOf(elementFor('barrow', 'heavy'));
    expect(quake.flame).toBe(-1); expect(quake.dark).toBe(false);
    expect(Math.max(quake.main.r, quake.main.g, quake.main.b)).toBeGreaterThan(1.5);
    expect(lookOf(elementFor('barrow', 'heavy'))).toBe(quake);
  });

  it('rides with the room: made for a WIP fighter the room holds, let go with it, never for a staged one or an original', async () => {
    const scene = new THREE.Scene(), effects = new RosterSignatureSet(scene, { budget: 1 } as VfxKit);
    const staged = () => (effects as unknown as { staged: Map<string, unknown> }).staged;
    try {
      // (Whoever of the WIP fighters still gets the baseline: the roster is being staged fighter by fighter - yodaka,
      // this file's example, on 12 October 2026 - and when the last of them is, nobody rides.)
      const unstaged = HOME_EXPANSION_FIGHTERS.find(id => stagedBaseline(id));
      await effects.load(['taisei', 'bellows', WIP, ...(unstaged ? [unstaged] : [])]);
      expect([...staged().keys()]).toEqual(unstaged ? [unstaged] : []);
      await effects.load(['taisei']);
      expect(staged().size).toBe(0);
    } finally { effects.dispose(); }
  });
});
