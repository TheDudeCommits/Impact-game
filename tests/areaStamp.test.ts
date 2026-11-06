import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { FIGHTER_IDS, moveProblems } from '../src/engine/sim';
import { areaAnimOf, areaJaOf, ELEMENT_JA } from '../src/engine/sim/areaMoves';
import { EMBLEMS, emblemText } from '../src/render/area/emblems';
import { SYMBOLS } from '../src/render/area/symbols';
import { wantedChars } from '../src/render/area/sealChars';
import { ringLatin, type GlyphSet } from '../src/render/area/glyphText';
import glyphs from '../src/render/area/glyphs.json';
import { AreaTelegraph, sealColour } from '../src/render/AreaTelegraph';
import { SIGNATURE } from '../src/render/signature/context';
import { planVoice } from '../src/audio/voicePlan';
import { AUDIO_CUES } from '../src/audio/cueTypes';
import clips from '../src/engine/client/clips.json';

const SET = glyphs as unknown as GlyphSet;

describe('the seals', () => {
  it('has an emblem for every fighter: a drawn symbol, or one to four brush kanji', () => {
    expect(Object.keys(EMBLEMS).sort()).toEqual([...FIGHTER_IDS].sort());
    for (const id of FIGHTER_IDS) {
      const e = EMBLEMS[id];
      expect(e.why.trim().length, id).toBeGreaterThan(2);
      if ('symbol' in e) expect(SYMBOLS[e.symbol], id).toBeDefined();
      else expect([...e.glyph].length, id).toBeGreaterThanOrEqual(1), expect([...e.glyph].length, id).toBeLessThanOrEqual(4);
      expect(sealColour(id), id).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(EMBLEMS.taisei).toMatchObject({ glyph: '大聖' });
    expect(EMBLEMS.gummy).toMatchObject({ glyph: '潮' });
    expect(EMBLEMS.kagari).toMatchObject({ glyph: '篝' });
    expect(EMBLEMS.ward).toMatchObject({ glyph: '病棟' });
    expect(['shakugo', 'senko', 'tokan'].map(id => emblemText(EMBLEMS[id as FighterId]))).toEqual(['刑', '輝', '霜']);
  });

  it('draws its symbols as plain polygons inside their 100-unit box', () => {
    for (const [name, d] of Object.entries(SYMBOLS)) {
      expect(d, name).toMatch(/^M/);
      expect(/[^MLZ0-9 .-]/.test(d), name).toBe(false);
      for (const n of d.match(/-?\d+(\.\d+)?/g)!.map(Number)) { expect(n, name).toBeGreaterThanOrEqual(-1); expect(n, name).toBeLessThanOrEqual(101); }
    }
  });

  it('carries every character the seals and rings draw, baked (npx tsx scripts/area/bakeGlyphs.mts)', () => {
    expect(SET.fonts).toEqual({ ja: 'Yuji Boku', latin: 'Barlow Condensed Black' });
    const missing = wantedChars().filter(c => !SET.glyphs[c]);
    expect(missing).toEqual([]);
    for (const [c, [d, adv]] of Object.entries(SET.glyphs)) { expect(d, c).toMatch(/^M/); expect(adv, c).toBeGreaterThan(0); }
    expect(ringLatin('Brasier: Salamandre')).toBe('BRASIER: SALAMANDRE');
  });

  it("names every area move in Japanese on its ring: its own, else its element's word", () => {
    for (const id of FIGHTER_IDS) expect(areaJaOf(id, MOVES[id].area).length, id).toBeGreaterThan(0);
    expect(areaJaOf('bellows', { ...MOVES.bellows.area, area: { ...MOVES.bellows.area.area!, ja: '赫灼熱拳' } })).toBe('赫灼熱拳');
    expect(Object.values(ELEMENT_JA).every(Boolean)).toBe(true);
  });
});

describe('the cast: animation and voice', () => {
  it('reads every form of area.anim, and draws the wind-up only unless it is `full`', () => {
    expect(areaAnimOf('taisei', undefined)).toEqual({ fighter: 'taisei', slot: 'special', full: false });
    const move = (anim: unknown) => ({ ...MOVES.taisei.area, area: { ...MOVES.taisei.area.area!, anim } }) as typeof MOVES.taisei.area;
    expect(areaAnimOf('taisei', move('heavy'))).toEqual({ fighter: 'taisei', slot: 'heavy', full: false });
    expect(areaAnimOf('taisei', move({ from: 'ouga', slot: 'ultimate', full: true }))).toEqual({ fighter: 'ouga', slot: 'ultimate', full: true });
    expect(areaAnimOf('taisei', move({ clip: 'last-sun' }))).toEqual({ fighter: 'taisei', slot: 'special', clip: 'last-sun', full: false });
    const errors = (anim: unknown) => moveProblems(move(anim), 'x').errors.join(' | ');
    expect(errors({ slot: 'area' })).toMatch(/not light, heavy, special or ultimate/);
    expect(errors({ from: 'Ouga!' })).toMatch(/is not a fighter id/);
    expect(errors({ from: 'ouga', clip: 'x' })).toMatch(/not by clip/);
    expect(errors({ slot: 'heavy', speed: 2 })).toMatch(/area.anim.speed is not/);
    expect(moveProblems({ ...MOVES.taisei.area, area: { ...MOVES.taisei.area.area!, voice: 'Not A Cue' } }, 'x').errors.join()).toMatch(/is not a voice cue id/);
  });


  it("says an area move's own line on the cast (a registered cue), and none without one: no line reused by default", () => {
    for (const id of FIGHTER_IDS) {
      const cue = MOVES[id].area.area?.voice as keyof typeof AUDIO_CUES | undefined;
      if (cue !== undefined) expect(AUDIO_CUES[cue], `${id}: ${cue}`).toBeDefined();
    }
    const cast = (fighter: FighterId): CombatEvent => ({ id: 1, kind: 'cast', serverTime: 1, actorId: 'a', fighter, slot: 'area', move: MOVES[fighter].area.name });
    expect(planVoice(cast('taisei')).map(layer => layer.cue)).toEqual([MOVES.taisei.area.area!.voice]);
    const silent = FIGHTER_IDS.filter(id => !MOVES[id].area.area?.voice);
    for (const id of silent) expect(planVoice(cast(id)), id).toEqual([]);
  });
});

describe('the stamp on the floor', () => {
  const player = (id: string, over: Partial<PlayerState> = {}): PlayerState => ({ id, name: id, fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
    stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
    guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0, area: 0 }, ...over });
  const event = (over: Partial<CombatEvent>): CombatEvent => ({ id: Math.random(), kind: 'cast', serverTime: 0, actorId: 'foe', fighter: 'taisei', slot: 'area', move: MOVES.taisei.area.name, ...over });
  const shown = (scene: THREE.Scene) => { let n = 0; scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible) n++; }); return n; };
  afterEach(() => { SIGNATURE.screen = undefined; SIGNATURE.localId = undefined; });

  it("slams an opponent's seal down with its warning rim, fills it over the telegraph and burns it away after the strike", () => {
    const scene = new THREE.Scene(), fx = new AreaTelegraph(scene), at = { x: 2, y: 0, z: 7 };
    const players = [player('me', { x: 2, z: 7, fighter: 'gummy' }), player('foe', { z: -3 })];
    const frame = vi.fn(); SIGNATURE.screen = { impactFrame: frame }; SIGNATURE.localId = 'me';
    const rest = fx.handle([event({ endpoint: at, radius: 4 }), event({ kind: 'hit', targetId: 'me', endpoint: at })], 'me', players);
    expect(rest.map(e => e.kind)).toEqual(['hit']);
    fx.handle([event({ kind: 'release', serverTime: 1, due: 1.75, endpoint: at, radius: 4 })], 'me', players);
    fx.update(1.05, undefined, players[0], () => 0);
    const stamp = scene.getObjectByName('area-telegraph')!.children.find(o => o.visible && (o as THREE.Mesh).material instanceof THREE.ShaderMaterial
      && ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uThreat) as THREE.Mesh;
    const u = (stamp.material as THREE.ShaderMaterial).uniforms;
    expect(u.uThreat.value).toBe(1);
    expect(stamp.position.y).toBeGreaterThan(.1);            // still coming down
    fx.update(1.5, undefined, players[0], () => 0);
    expect(u.uSlam.value).toBeGreaterThan(0); expect(u.uFill.value).toBeGreaterThan(.3); expect(u.uFill.value).toBeLessThan(1);
    expect(stamp.position.y).toBeLessThan(.1);
    fx.handle([event({ kind: 'impact', serverTime: 1.75, endpoint: at, radius: 4, contactIndex: 0 })], 'me', players);
    expect(frame).toHaveBeenCalled();                          // the player stood in it
    fx.update(1.8, undefined, players[0], () => 0);
    expect(u.uFlash.value).toBeGreaterThan(0);
    fx.update(2.2, undefined, players[0], () => 0);
    expect(u.uBurn.value).toBeGreaterThan(0);
    fx.update(2.6, undefined, players[0], () => 0);
    expect(shown(scene)).toBe(0);
  });

  it("aims with the player's own seal, and reuses its stamps", () => {
    const scene = new THREE.Scene(), fx = new AreaTelegraph(scene), me = player('me');
    fx.update(0, { active: true, source: 'pad', x: 0, z: 8, fromX: 0, fromZ: 0, range: 14, radius: 4, valid: true }, me, () => 0);
    expect(shown(scene)).toBe(2);                               // the seal, and the range ring
    fx.update(.1, { active: false, x: 0, z: 8, fromX: 0, fromZ: 0, range: 14, radius: 4, valid: true }, me, () => 0);
    expect(shown(scene)).toBe(0);
    const before = scene.getObjectByName('area-telegraph')!.children.length;
    for (let k = 0; k < 3; k++) {
      fx.handle([event({ kind: 'release', serverTime: k * 3, due: k * 3 + .7, endpoint: { x: k, y: 0, z: 5 }, radius: 4 })], 'me', [me]);
      fx.handle([event({ kind: 'impact', serverTime: k * 3 + .7, endpoint: { x: k, y: 0, z: 5 }, radius: 4 })], 'me', [me]);
      fx.update(k * 3 + 2, undefined, me, () => 0);
    }
    expect(scene.getObjectByName('area-telegraph')!.children.length).toBe(before + 1);
  });
});
