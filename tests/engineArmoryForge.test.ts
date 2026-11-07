import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import { armoryRuntime, setActiveKit } from '../src/engine/client/forgeLive';
import type { ForgeKit } from '../src/engine/sim/forge';
import { ARMORY_MANIFEST } from '../src/render/vfx/armory/vendor/manifest';
import { ARMORY_EFFECTS } from '../src/render/vfx/armory/vendor/forgeCatalog';
import { settings } from '../src/render/vfx/armory/vendor/config/settings.js';
import { classifyKey, macroValue, splitSettings, turnHue, ESSENTIALS } from '../src/render/vfx/armory/macros';
import { UNSHIPPED_ARMORY } from '../src/originals/credits'; // originals fork: effects whose files' licences keep them out
import { autoFit } from '../src/render/vfx/armory/fits';
import { bodySlotOf, eventFx, kitSlots } from '../src/render/vfx/armory/fxLookup';
import { fxCues } from '../src/render/vfx/armory/castingSignature';
import { ForgeFxDirector } from '../src/render/vfx/armory/forgeFx';
import { armoryDraws, fxDraws } from '../src/render/vfx/armory/drawn';

const own = (fighter: FighterId) => ({ light: { from: fighter }, heavy: { from: fighter }, special: { from: fighter }, ultimate: { from: fighter } });
const kitFor = (body: FighterId, patch: Partial<ForgeKit> = {}, slots: Partial<ForgeKit['slots']> = {}): ForgeKit =>
  ({ forge: 1, name: 'test', body, slots: { ...own(body), ...slots }, ...patch } as ForgeKit);
function body(id: string, fighter: FighterId, state: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group();
  return { group, joints: new Map(), bodyFighter: fighter, handR: new THREE.Vector3(.3, 1.3, .2), handL: new THREE.Vector3(-.3, 1.3, .2),
    state: { id, fighter, alive: true, action: 'idle', yaw: 0, ...state } as PlayerState } as unknown as Fighter;
}
const event = (e: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'cast', serverTime: 0, actorId: 'p', ...e } as CombatEvent);

afterEach(() => { for (const f of ['bellows', 'kagari', 'hinomoto'] as FighterId[]) setActiveKit(undefined, f); });

describe('every cleared Armory effect in the game, for the Forge', () => {
  it('lists every vendored effect, each with a thumbnail on disk', () => {
    expect(ARMORY_EFFECTS.map(e => e.id).sort()).toEqual(Object.keys(ARMORY_MANIFEST).sort());
    expect(ARMORY_EFFECTS.length).toBeGreaterThanOrEqual(200);
    const missing = ARMORY_EFFECTS.filter(e => !UNSHIPPED_ARMORY.has(e.id) && (!e.thumb || !fs.existsSync(path.join('public', e.thumb)))); // the dragon ships no thumbnail (src/originals/credits.ts)
    expect(missing.map(e => e.id)).toEqual([]);
  });
  it('loads an effect with its settings block, and every other block its code reads', async () => {
    const all = settings as unknown as Record<string, unknown>;
    await ARMORY_MANIFEST.ext_aether.load();
    expect(all.ext_aether).toBeTruthy();
    expect(all.ext_earth).toBeTruthy();
  });
  it('registers the live Forge\'s runtime: every effect with its Essentials, and the ICE kit\'s', () => {
    // forgeFx.ts registers it on import (RosterSignatureSet imports it in every build).
    expect(ForgeFxDirector).toBeTruthy();
    const runtime = armoryRuntime()!;
    expect(runtime).toBeTruthy();
    const effects = runtime.effects();
    expect(effects.length).toBe(ARMORY_EFFECTS.length - UNSHIPPED_ARMORY.size + 5); // originals fork: less the CC BY-NC dragon
    const fist = effects.find(e => e.id === 'colossus_flamefist')!;
    expect(fist).toMatchObject({ label: 'Forge Giant Fist', cast: 'line' }); // originals fork: named as the fork shows it (src/originals/forgeLabels.ts)
    expect(fist.thumb).toMatch(/\.webp$/);
    expect(fist.essentials.map(e => e.key)).toEqual(ESSENTIALS.map(e => e.key));
    expect(effects.filter(e => e.id.startsWith('ice/')).length).toBe(5);
  });
});

describe('a Forge kit\'s effect on a slot', () => {
  it('is found by the body the move sits in, a borrowed move by its pick', () => {
    setActiveKit(kitFor('bellows', {}, { special: { from: 'kagari', fx: { effect: 'colossus_flamefist' } }, heavy: { from: 'bellows', fx: { effect: 'ki_wave' } } }));
    const owner = { fighter: 'bellows' as FighterId };
    // His own heavy: the event names him.
    expect(bodySlotOf(owner, event({ fighter: 'bellows', slot: 'heavy' }))).toBe('heavy');
    // Kagari's special in his special slot: the transplant presents the event as Kagari's, with Bellows the body.
    expect(bodySlotOf(owner, event({ fighter: 'kagari', slot: 'special', body: 'bellows' }))).toBe('special');
    // Combo enders and a rush's later stages are the body's own moves.
    expect(bodySlotOf(owner, event({ fighter: 'bellows', slot: 'heavy', branch: 'launcher' as CombatEvent['branch'] }))).toBeUndefined();
    expect(bodySlotOf(owner, event({ fighter: 'bellows', slot: 'light', chain: 2 }))).toBeUndefined();
    const fighters = new Map<string, Fighter>([['p', body('p', 'bellows')]]);
    expect(eventFx(event({ fighter: 'kagari', slot: 'special', body: 'bellows' }), fighters)?.effect).toBe('colossus_flamefist');
    expect(eventFx(event({ fighter: 'bellows', slot: 'heavy' }), fighters)?.effect).toBe('ki_wave');
    expect(eventFx(event({ fighter: 'bellows', slot: 'ultimate' }), fighters)).toBeUndefined();
    // While a borrowed move is thrown the body's state reads as the move's fighter: the kit is still the body's.
    const viewed = new Map<string, Fighter>([['p', body('p', 'bellows', { fighter: 'kagari' as FighterId })]]);
    (viewed.get('p') as unknown as { bodyFighter: FighterId }).bodyFighter = 'bellows';
    expect(eventFx(event({ fighter: 'kagari', slot: 'special', body: 'bellows' }), viewed)?.effect).toBe('colossus_flamefist');
    // As the events name the moves: Bellows's heavy, Kagari's special, and his house kit's area look (houseKits.json).
    expect([...kitSlots(fighters.get('p')!)].map(s => s.key).sort()).toEqual(['bellows:area', 'bellows:heavy', 'kagari:special']);
  });
  it('plays as cues on the move\'s own clock, sized by the body, in its own colours turned', () => {
    const cues = fxCues('bellows', 'kagari', 'special', { effect: 'colossus_flamefist', scale: 1.5, hue: 90, settings: { _glow: 1.4, fistSize: 2 } });
    expect(cues.length).toBe(1);
    expect(cues[0]).toMatchObject({ slot: 'special', type: 'armory/colossus_flamefist' });
    const p = cues[0].params as { size: number; hue: number; macros: { glow: number }; set: Record<string, number>; palette?: unknown; sound: string };
    expect(p.hue).toBe(90);
    expect(p.macros.glow).toBe(1.4);
    expect(p.set).toEqual({ fistSize: 2 });
    expect(p.palette).toBeUndefined();
    expect(p.sound).toBe('bed');
    const plain = fxCues('bellows', 'kagari', 'special', { effect: 'colossus_flamefist' })[0].params as { size: number };
    expect(p.size).toBeCloseTo(plain.size * 1.5);
    expect(fxCues('bellows', 'bellows', 'special', { effect: 'ice/crystal-field' })[0]?.type).toBe('ice/crystal-field');
    expect(fxCues('bellows', 'bellows', 'special', { effect: 'nothing/like-this' })).toEqual([]);
  });
  it('marks the moves it draws, for the layers that would draw them otherwise, and lets go of them', () => {
    setActiveKit(kitFor('hinomoto', {}, { special: { from: 'hinomoto', fx: { effect: 'saga_void_ray' } } }));
    const director = new ForgeFxDirector(new THREE.Scene(), { quality: 'high', density: 1 } as never);
    const stage = { ready: (id: string) => id === 'saga_void_ray', broken: () => false, ensure: async () => true, update() {}, handle() {}, reset() {}, dispose() {} };
    (director as unknown as { stage: typeof stage }).stage = stage;
    const fighters = new Map<string, Fighter>([['p', body('p', 'hinomoto')]]);
    director.update(0, fighters, new Map());
    expect(fxDraws('hinomoto', 'special')).toBe(true);
    expect(armoryDraws('hinomoto', 'special')).toBe(true);
    expect(fxDraws('hinomoto', 'heavy')).toBe(false);
    // A player's own: another Hinomoto in the room, with no kit, keeps his common effects for the same move.
    expect(fxDraws('hinomoto', 'special', undefined, 'p')).toBe(true);
    expect(armoryDraws('hinomoto', 'special', undefined, 'p')).toBe(true);
    expect(fxDraws('hinomoto', 'special', undefined, 'q')).toBe(false);
    expect(armoryDraws('hinomoto', 'special', undefined, 'q')).toBe(false);
    expect(director.covers(event({ fighter: 'hinomoto', slot: 'special' }), fighters)).toBe(true);
    expect(director.covers(event({ fighter: 'hinomoto', slot: 'heavy' }), fighters)).toBe(false);
    setActiveKit(undefined, 'hinomoto');
    director.update(.1, fighters, new Map());
    expect(fxDraws('hinomoto', 'special')).toBe(false);
    director.dispose();
  });
});

describe('the Essentials and a fit by name', () => {
  it('maps the Armory inspector\'s dials onto an effect\'s keys from their shipped values', () => {
    expect(classifyKey('ballRadius', 4)).toBe('size');
    expect(classifyKey('flameGlow', 1.6)).toBe('glow');
    expect(classifyKey('speed', 30)).toBe('speed');
    expect(classifyKey('fadeTime', .4)).toBe('dur');
    expect(classifyKey('sparkCount', 60)).toBe('power');
    expect(classifyKey('range', 20)).toBeNull();
    expect(classifyKey('noiseScale', 2)).toBeNull();
    expect(macroValue('flameGlow', 1.5, { glow: 2 })).toBe(3);
    expect(macroValue('fadeTime', .4, { speed: 2 })).toBeCloseTo(.2);
    // A count is never raised above its shipped value (some effects size buffers from it).
    expect(macroValue('sparkCount', 60, { power: 2 })).toBe(60);
    expect(macroValue('sparkCount', 60, { power: .5 })).toBe(30);
    expect(splitSettings({ _glow: 1.2, _speed: .8, ringSize: 2, _odd: 3 })).toEqual({ macros: { glow: 1.2, speed: .8 }, own: { ringSize: 2 } });
    const turned = new THREE.Color(turnHue('#ff0000', 120));
    expect(turned.g).toBeGreaterThan(.9);
    expect(turnHue('#808080', 90)).toBe('#808080');
  });
  it('fits an effect from its settings\' names: hand, range, speed, wind-up, sizes, the screen tricks off', () => {
    const fit = autoFit({ handForward: .9, handHeight: 1.3, range: 20, minRange: 2, speed: 30, charge: .45, ballRadius: 4, sparkCount: 60, ifFrames: 3, gradeWeight: .5, lines: .6, colorCore: '#ffffff' });
    expect(fit.launch).toMatchObject({ forward: 'handForward', height: 'handHeight' });
    expect(fit.range).toEqual(['range', 'minRange']);
    expect(fit.speed).toBe('speed');
    expect(fit.windup).toEqual(['charge']);
    expect(fit.size).toEqual(['ballRadius']);
    expect(fit.counts).toEqual(['sparkCount']);
    expect(fit.set).toEqual({ ifFrames: 0, gradeWeight: 0, lines: 0 });
    expect(fit.sizeScale).toBeLessThan(1);
  });
});
