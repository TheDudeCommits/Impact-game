import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BallAudio, type BallMixer, type BallMusic } from './ballAudio';
import { VOLLEY_COURT, type BallEvent, type BallState, type BallView } from '../game/ball/model';
import type { GameSnapshot } from '../game/types';

// Every touch plays its sound - the receive, the set, the spike, the TIP, the block, the dive, both serves and the ball
// on the floor - checked by what the audio code is asked to play over a rally: none silent, none a fighting sound. On
// the volleyball rules each touch is heard from its own event, as what it is - never from the flight's guess, never
// twice - and no fighter's swing is heard in it (main.ts quietSwings).
const ball = (over: Partial<BallState> = {}): BallState => ({ x: 0, y: 2, z: -3, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, lastId: null, lastTeam: null,
  shot: null, held: false, frozenUntil: 0, super: false, size: .7, grav: 1, wall: null, clash: 0, court: VOLLEY_COURT, ...over });
const view = (over: Partial<BallView> = {}): BallView => ({ kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true,
  startsAt: 0, startedAt: 1, endsAt: 0, phaseUntil: 0, seats: [{ id: 'me', name: 'Me', fighter: 'taisei', team: 'red', bot: false, goals: 0, assists: 0, saves: 0, shots: 0, touches: 0,
    kills: 0, aces: 0, blocks: 0, digs: 0, points: 0 }], score: { red: 0, blue: 0 }, ball: ball(), clock: 0, overtime: false, touchTeam: null, touches: 0, rally: 1,
  servingTeam: 'red', serverId: null, target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [],
  practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, volley: { owner: null, at: 0, x: 0, z: 0, touch: 0, takes: {}, prompt: {} }, ...over });
const snap = (v: BallView, time: number) => ({ serverTime: time, players: [], events: [], ball: v }) as unknown as GameSnapshot;
const ev = (id: number, kind: BallEvent['kind'], over: Partial<BallEvent> = {}): BallEvent => ({ id, at: 10, kind, x: 0, y: 1, z: -3, ...over });
function rig() {
  const played: string[] = [];
  const id = (url: string) => url.split('/').pop()!.replace('.m4a', '');
  const mixer: BallMixer = {
    sample: url => { played.push(id(url)); }, centred: url => { played.push(id(url)); }, stands: vi.fn(), loopAt: vi.fn(),
    crowdTension: vi.fn(), soften: vi.fn(), cheer: vi.fn(), preload: vi.fn(), announce: vi.fn(), sampleSeconds: () => 1, takeBack: vi.fn(),
  };
  const music: BallMusic = { peak: vi.fn(), heat: vi.fn(), punch: vi.fn() };
  return { audio: new BallAudio(mixer, music, () => 0, () => 100), played };
}
/** What one fresh event (with the ball as the touch left it) is heard as. */
function heard(e: BallEvent, after: Partial<BallState> = {}) {
  const { audio, played } = rig();
  audio.update(snap(view({ ball: ball({ vy: -3, lastId: 'x', shot: 'serve' }) }), 10), 'me');
  played.length = 0;
  audio.update(snap(view({ events: [e], ball: ball({ vy: 6, lastId: e.actorId ?? 'b', shot: 'bump', ...after }) }), 10 + 1 / 30), 'me');
  return played.filter(p => !p.startsWith('crowd') && !p.startsWith('whistle'));
}

describe('volleyball\'s touches, each heard as what it is', () => {
  it('hears the receive and the dig as the forearms, a DIVING DIG with the body on the planks, a set as the fingers, an OVER as the open hand', () => {
    expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: 'RECEIVE · GOOD', shot: 'bump' }))).toEqual(['strike-dig']);
    expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: 'DIG · PERFECT', shot: 'bump' }))).toEqual(['strike-dig']);
    expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: 'DIVING DIG · GOOD', shot: 'bump' }))).toEqual(['strike-dig', 'bounce-wood-soft']);
    for (const set of ['SET · GOOD', 'BACK SET · PERFECT', 'QUICK SET · GOOD']) expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: set, shot: 'set' }), { shot: 'set' }), set).toEqual([expect.stringMatching(/^strike-tap-/)]);
    expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: 'OVER · GOOD', shot: 'pop' }), { shot: 'pop' })).toEqual(['strike-volley']);
    // (A FLUBBED touch is still heard - duller.)
    expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: 'RECEIVE · FLUBBED', shot: 'bump' }))).toEqual(['strike-dig']);
  });
  it('hears the spike, the TIP and both serves from their strikes - a TIP as fingertips, a JUMP SERVE as the hard palm - and a block from its block', () => {
    const spike = heard(ev(5, 'strike', { actorId: 'b', team: 'red', shot: 'spike', value: 24 }), { shot: 'spike' });
    expect(spike).toContain('strike-volley');
    expect(heard(ev(5, 'touch', { actorId: 'b', team: 'red', text: 'SPIKE · GOOD', shot: 'spike' }), { shot: 'spike' })).toEqual([]);
    expect(heard(ev(5, 'strike', { actorId: 'b', team: 'red', shot: 'tip', text: 'TIP', value: 8 }), { shot: 'tip' })).toEqual(['strike-tap-1']);
    expect(heard(ev(5, 'strike', { actorId: 'b', team: 'red', shot: 'serve', text: 'FLOAT SERVE', value: 14 }), { shot: 'serve' })).toEqual(['strike-tap-1']);
    expect(heard(ev(5, 'strike', { actorId: 'b', team: 'red', shot: 'serve', text: 'JUMP SERVE', value: 17 }), { shot: 'serve' })).toEqual(['strike-volley']);
    expect(heard(ev(5, 'block', { actorId: 'b', team: 'red', text: 'BLOCK' }), { shot: 'block' })).toEqual(['block']);
    expect(heard(ev(5, 'perfect', { actorId: 'b', team: 'red', text: 'STUFF BLOCK' }), { shot: 'block' })).toEqual(['block-stuff']);
  });
  it('hears no touch from the flight\'s guess on these rules - only its event - and the classic\'s as before', () => {
    const { audio, played } = rig();
    audio.update(snap(view({ ball: ball({ vy: -3, lastId: 'a', shot: 'bump' }) }), 10), 'me');
    audio.update(snap(view({ ball: ball({ vy: 6, lastId: 'b', shot: 'set' }) }), 10 + 1 / 30), 'me');
    expect(played.filter(p => p.startsWith('strike-'))).toEqual([]);
    const classic = rig();
    classic.audio.update(snap(view({ volley: undefined, ball: ball({ court: undefined, vy: -3, lastId: 'a', shot: 'bump' }) }), 10), 'me');
    classic.audio.update(snap(view({ volley: undefined, ball: ball({ court: undefined, vy: 6, lastId: 'b', shot: 'set' }) }), 10 + 1 / 30), 'me');
    expect(classic.played.filter(p => p.startsWith('strike-'))).toHaveLength(1);
  });
  it('hears the ball come down on the planks for a point', () => {
    const { audio, played } = rig();
    audio.update(snap(view({ ball: ball({ y: 1, vy: -12, lastId: 'a', shot: 'spike' }) }), 10), 'me');
    audio.update(snap(view({ events: [ev(9, 'kill', { team: 'red', x: 1, z: 4, shot: 'spike' })], ball: ball({ y: .3, vy: -12, lastId: 'a', shot: 'spike', z: 4 }) }), 10 + 1 / 30), 'me');
    expect(played).toContain('bounce-wood-hard');
  });
  it('plays no fighter\'s swing in a touch on these rules (the mixer\'s quietSwings, set by the page)', () => {
    const combat = fs.readFileSync('src/audio/CombatAudio.ts', 'utf8'), main = fs.readFileSync('src/main.ts', 'utf8');
    expect(combat).toMatch(/const quiet = \(event\.kind === 'cast' \|\| event\.kind === 'release' \|\| event\.kind === 'impact' \|\| event\.kind === 'confirm' \|\| \(event\.kind === 'hit' && soft !== undefined\)\) && !!this\.quietSwings\?\.\(\);/);
    expect(combat).toMatch(/if \(at && !quiet\) for \(const layer of planCombatAudio/);
    expect(main).toMatch(/audio\.quietSwings=\(\)=>!!ballOf\(network\.snapshot\)\?\.volley;/);
  });
});
