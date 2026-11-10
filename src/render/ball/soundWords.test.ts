import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import {freshBall} from '../../game/ball/physics';
import {CLASH, GOAL_RULES, type BallEvent, type BallModeId, type BallView} from '../../game/ball/model';
import {setVfxLevel} from '../vfxLevel';
import {COUNT_CELLS, MATCH_POINT_CELL, SOUND_ATLAS, SOUND_WORDS, SOUND_WORDS_URL, WORD_CELLS, cellUv, type AtlasCell} from './soundWordAtlas';
import {MOMENT_WORDS, SoundWords, WORD_LIFE, WORD_SCREEN, wordFor, type WordMoment} from './SoundWords';
import {PitchCount, floorMark, matchPointOf} from './PitchCount';

// The drawn lettering. One atlas from one face; the sound words at the five biggest hits, at most
// one on screen; the last ten seconds on Goal Rush's pitch and MATCH POINT on Sky Spike's court.
const view = (mode: BallModeId, events: BallEvent[], more: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode, phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 240, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false}, clock: 200, overtime: false, touchTeam: null, touches: 0, rally: 0, servingTeam: 'red', serverId: null,
  target: 0, fever: false, winner: null, reason: '', mvp: null, events, replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...more});

describe('the lettering atlas', () => {
  it('holds its words and its cells inside its size, none overlapping', () => {
    expect(SOUND_WORDS.length).toBeGreaterThanOrEqual(6); expect(SOUND_WORDS.length).toBeLessThanOrEqual(8);
    for (const w of SOUND_WORDS) expect(w).toMatch(/^[゠-ヿ]+$/);
    expect(SOUND_ATLAS).toEqual({width: 2048, height: 1024});
    expect(WORD_CELLS.length).toBe(SOUND_WORDS.length);
    const cells: AtlasCell[] = [...WORD_CELLS, ...Object.values(COUNT_CELLS), MATCH_POINT_CELL];
    expect(Object.keys(COUNT_CELLS).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const c of cells) { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0); expect(c.x + c.w).toBeLessThanOrEqual(2048); expect(c.y + c.h).toBeLessThanOrEqual(1024); }
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${i} and ${j}`).toBe(false);
    }
    // The UVs of an image loaded the usual way up: the top row of the atlas is v 1.
    expect(cellUv(WORD_CELLS[0], new THREE.Vector4()).toArray()).toEqual([0, 1 - 224 / 1024, .25, 1]);
  });
  it('ships as one WebP of that size, its face\'s licence with the other fonts\'', () => {
    const file = `public${SOUND_WORDS_URL}`, bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF'); expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    // A lossless WebP's header: 14 bits of width - 1, then 14 of height - 1.
    expect(bytes.subarray(12, 16).toString()).toBe('VP8L');
    const bits = bytes.readUInt32LE(21);
    expect([(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]).toEqual([2048, 1024]);
    expect(bytes.length).toBeLessThan(600_000);
    expect(fs.readFileSync('docs/provenance/fonts/OFL-DelaGothicOne.txt', 'utf8')).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/);
    // No font ships for it.
    expect(fs.readdirSync('public/assets/vfx').filter(f => /\.(ttf|otf|woff2?)$/i.test(f))).toEqual([]);
  });
});

describe('the sound words', () => {
  // (The page's clock runs with the room's here: a word's life is the page's.)
  let page = 0;
  beforeEach(() => { vi.spyOn(performance, 'now').mockImplementation(() => page * 1000); });
  afterEach(() => { setVfxLevel('full'); vi.restoreAllMocks(); });
  let id = 0;
  const ev = (kind: BallEvent['kind'], at: number, more: Partial<BallEvent> = {}) => ({id: ++id, at, kind, x: 0, y: 1, z: 0, team: 'red', actorId: 'a', ...more}) as BallEvent;
  const layer = (quality: 'high' | 'low' = 'high') => { const w = new SoundWords(new THREE.Scene(), () => quality), update = w.update.bind(w); w.update = (v, now, hidden) => { page = now; update(v, now, hidden); }; return w; };

  it('stamps one of the moment\'s own words, the same on every page (by the event)', () => {
    for (const moment of Object.keys(MOMENT_WORDS) as WordMoment[]) {
      for (const i of MOMENT_WORDS[moment]) expect(SOUND_WORDS[i]).toBeTruthy();
      expect(wordFor(moment, 7)).toBe(wordFor(moment, 7));
    }
    // Every word in the atlas is one a moment takes.
    expect(new Set(Object.values(MOMENT_WORDS).flat()).size).toBe(SOUND_WORDS.length);
  });
  it('at a SUPER SHOT struck, a goal, a PERFECT SPIKE\'s kill, a STUFF BLOCK and a CLASH as it breaks, and nothing else', () => {
    const w = layer();
    w.update(view('goal-rush', [ev('super', 1)]), 1); expect(w.stampedCount.super).toBe(1);
    w.update(view('goal-rush', [ev('own-goal', 3), ev('strike', 3), ev('save', 3, {text: 'PERFECT SAVE'}), ev('wipeout', 3)]), 3);
    expect(Object.values(w.stampedCount).reduce((a, b) => a + b)).toBe(1);
    w.update(view('goal-rush', [ev('goal', 5)]), 5); expect(w.stampedCount.goal).toBe(1);
    // A goal in FREE PLAY is practice, not a match's.
    w.update(view('goal-rush', [ev('goal', 7)], {practice: true}), 7); expect(w.stampedCount.goal).toBe(1);
    // The CLASH's word waits for the clash to break.
    w.update(view('goal-rush', [ev('clash', 9)]), 9); expect(w.stampedCount.clash).toBe(0);
    w.update(view('goal-rush', []), 9 + CLASH.hold); expect(w.stampedCount.clash).toBe(1);
    const s = layer();
    // A kill is a PERFECT SPIKE's only when its hitter's last strike was one.
    s.update(view('sky-spike', [ev('kill', 1, {actorId: 'b'})]), 1); expect(s.stampedCount.kill).toBe(0);
    s.update(view('sky-spike', [ev('strike', 3, {actorId: 'b', perfect: true, text: 'SKY SPIKE'}), ev('kill', 3.6, {actorId: 'b'})]), 3.6); expect(s.stampedCount.kill).toBe(1);
    s.update(view('sky-spike', [ev('perfect', 6, {text: 'PERFECT GUARD'}), ev('block', 6)]), 6); expect(s.stampedCount.block).toBe(0);
    s.update(view('sky-spike', [ev('perfect', 8, {text: 'STUFF BLOCK', team: 'blue'})]), 8); expect(s.stampedCount.block).toBe(1);
    expect(s.last).toMatchObject({moment: 'block', team: 'blue'});
  });
  it('keeps at most one on screen: a smaller moment\'s word waits for nothing while a bigger one\'s is up', () => {
    const w = layer();
    w.update(view('goal-rush', [ev('goal', 1)]), 1);
    w.update(view('goal-rush', [ev('super', 1.1)]), 1.1);
    expect(w.stampedCount).toMatchObject({goal: 1, super: 0});
    expect(w.last?.moment).toBe('goal');
  });
  it('stays out of the score bug and the banner, about half a second, and is drawn over the world', () => {
    expect(WORD_LIFE).toBeGreaterThanOrEqual(.4); expect(WORD_LIFE).toBeLessThanOrEqual(.6);
    // The top 29% of the screen holds the score bug and the banner under it.
    expect(1 - (WORD_SCREEN.top + 1) / 2).toBeGreaterThanOrEqual(.29);
    const w = layer(), m = w.mesh.material as THREE.ShaderMaterial;
    expect(m.depthTest).toBe(false); expect(m.transparent).toBe(true);
  });
  it('is none on Low with the effects turned down (the atlas is not even asked for), and all on Low at Full', () => {
    setVfxLevel('reduced');
    const low = layer('low');
    low.update(view('goal-rush', [ev('goal', 1)]), 1);
    expect(low.stampedCount.goal).toBe(0); expect((low.mesh.material as THREE.ShaderMaterial).uniforms.uMap.value).toBeNull();
    const high = layer('high');
    high.update(view('goal-rush', [ev('goal', 1)]), 1); expect(high.stampedCount.goal).toBe(1);
    setVfxLevel('full');
    const lowFull = layer('low');
    lowFull.update(view('goal-rush', [ev('goal', 1)]), 1); expect(lowFull.stampedCount.goal).toBe(1);
  });
  it('stamps no backlog for a page that joins late, and starts afresh with a new match', () => {
    const w = layer();
    w.update(view('goal-rush', [ev('goal', 1)]), 3);
    expect(w.stampedCount.goal).toBe(0);
    w.update(view('goal-rush', [ev('goal', 4)], {startedAt: 50}), 4);
    expect(w.stampedCount.goal).toBe(1);
  });
});

describe('the floor\'s lettering', () => {
  const gr = (clock: number, more: Partial<BallView> = {}) => floorMark(view('goal-rush', [], {clock, ...more}));
  it('counts Goal Rush\'s last ten seconds, 10 down to 1, through play and a kickoff, and nothing else', () => {
    expect(gr(10.2)).toBeNull();
    expect(gr(10)).toEqual({kind: 'count', n: 10});
    expect(gr(9.4)).toEqual({kind: 'count', n: 10});
    expect(gr(9)).toEqual({kind: 'count', n: 9});
    expect(gr(.2)).toEqual({kind: 'count', n: 1});
    expect(gr(0)).toBeNull();
    expect(gr(4.5, {phase: 'kickoff'})).toEqual({kind: 'count', n: 5});
    // A goal's sequence, its replay, overtime, the end and FREE PLAY have none.
    expect(gr(4.5, {phase: 'scored'})).toBeNull();
    expect(gr(4.5, {overtime: true})).toBeNull();
    expect(gr(4.5, {phase: 'over'})).toBeNull();
    expect(gr(4.5, {practice: true})).toBeNull();
  });
  it('marks Sky Spike\'s match point for the side one point from the win, and both at the cap\'s last point', () => {
    const at = (red: number, blue: number) => matchPointOf({score: {red, blue}, target: 11});
    expect(at(9, 9)).toBeNull();
    expect(at(10, 8)).toBe('red');
    expect(at(10, 10)).toBeNull();
    expect(at(11, 12)).toBe('blue');
    expect(at(14, 14)).toBe('both');
    expect(at(12, 10)).toBeNull();
    expect(floorMark(view('sky-spike', [], {score: {red: 10, blue: 4}, target: 11, phase: 'kickoff'}))).toEqual({kind: 'match-point', team: 'red'});
    expect(floorMark(view('sky-spike', [], {score: {red: 10, blue: 4}, target: 11, phase: 'scored'}))).toBeNull();
  });
});

describe('the floor\'s lettering, as each lens draws it', () => {
  const lens = (from: [number, number, number], at: [number, number, number]) => {
    const c = new THREE.PerspectiveCamera(55, 16 / 9, .1, 400);
    c.position.set(...from); c.lookAt(...at); c.updateMatrixWorld(); c.updateProjectionMatrix();
    return c;
  };
  it('lies upright for each lens that draws it, each numeral at the spot that lens sees best, kept for its second', () => {
    const count = new PitchCount(new THREE.Scene()), u = (count.mesh.material as THREE.ShaderMaterial).uniforms;
    count.update(view('goal-rush', [], {clock: 9.5}), 1 / 60);
    const draw = (c: THREE.Camera) => { count.mesh.onBeforeRender(null as never, null as never, c, null as never, null as never, null as never); return {face: (u.uFace.value as THREE.Vector2).toArray(), centre: (u.uCentre.value as THREE.Vector3).toArray()}; };
    // Down the pitch from behind the red end, and across it from the side line (the big screens' broadcast camera, say).
    const along = lens([0, 9, -24], [0, 0, -4]), across = lens([22, 9, 0], [0, 0, 0]);
    const a = draw(along), b = draw(across), again = draw(along);
    expect(a.face).toEqual([0, 1]); expect(b.face).toEqual([-1, 0]);
    expect(again).toEqual(a);
    // Each numeral lies at the spot its lens sees nearest the middle of its screen, whole inside the lines.
    const spot = (c: THREE.Camera, at: number[]) => new THREE.Vector3(at[0], 0, at[2]).project(c);
    expect(Math.abs(spot(along, a.centre).x)).toBeLessThan(.8); expect(spot(along, a.centre).y).toBeLessThan(.3);
    expect(Math.abs(spot(across, b.centre).x)).toBeLessThan(.8);
    for (const c of [a.centre, b.centre]) { expect(Math.abs(c[0])).toBeLessThan(GOAL_RULES.halfX); expect(Math.abs(c[2])).toBeLessThan(GOAL_RULES.halfZ - 7); }
    // The next second is placed afresh.
    count.update(view('goal-rush', [], {clock: 8.5}), 1 / 60);
    expect(draw(lens([0, 9, 24], [0, 0, 4])).face).toEqual([0, -1]);
  });
});
