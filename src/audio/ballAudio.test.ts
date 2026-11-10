import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BALL_LOOPS, BALL_SFX, BallAudio, ballSoundFiles, ballTension, type BallMixer, type BallMusic } from './ballAudio';
import { BORROWED, BallCaller, CALLER, GAP, SPACING, allCallerFiles, callerFiles, callerLines, setCommentary, type CallerMoment } from './ballCaller';
import { GOAL_RULES, type BallEvent, type BallState, type BallView } from '../game/ball/model';
import type { GameSnapshot } from '../game/types';

const ball = (over: Partial<BallState> = {}): BallState => ({ x: 0, y: 3, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, lastId: null, lastTeam: null,
  shot: null, held: false, frozenUntil: 0, super: false, size: 1, grav: 1, wall: null, clash: 0, ...over });
const view = (over: Partial<BallView> = {}): BallView => ({ kind: 'ball', mode: 'goal-rush', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true,
  startsAt: 0, startedAt: 1, endsAt: 0, phaseUntil: 0, seats: [{ id: 'me', name: 'Me', fighter: 'taisei', team: 'red', bot: false, goals: 0, assists: 0, saves: 0, shots: 0, touches: 0,
    kills: 0, aces: 0, blocks: 0, digs: 0, points: 0 }], score: { red: 0, blue: 0 }, ball: ball(), clock: 200, overtime: false, touchTeam: null, touches: 0, rally: 0,
  servingTeam: 'red', serverId: null, target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [],
  practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...over });
const snap = (v: BallView, time: number) => ({ serverTime: time, players: [], events: [], ball: v }) as unknown as GameSnapshot;
const event = (id: number, kind: BallEvent['kind'], over: Partial<BallEvent> = {}): BallEvent => ({ id, at: 10, kind, x: 0, y: 1, z: 0, ...over });

function rig(seconds = 1.2) {
  const played: string[] = [], stands: string[] = [], said: string[] = [], loops: Record<string, number> = {};
  let clock = 100;
  const mixer: BallMixer = {
    sample: (url) => { played.push(url.split('/').pop()!.replace('.m4a', '')); },
    centred: (url) => { played.push(url.split('/').pop()!.replace('.m4a', '')); },
    stands: (url) => { stands.push(url.split('/').pop()!.replace('.m4a', '')); },
    loopAt: (key, _url, gain) => { loops[key] = gain; },
    crowdTension: vi.fn(), soften: vi.fn(), cheer: vi.fn(), preload: vi.fn(),
    announce: (url) => { said.push(url); }, sampleSeconds: () => seconds,
  };
  const music: BallMusic = { peak: vi.fn(), heat: vi.fn(), punch: vi.fn() };
  const audio = new BallAudio(mixer, music, () => 0, () => clock);
  return { audio, mixer, music, played, stands, said, loops, tick: (s: number) => { clock += s; } };
}

describe('the ball modes\' sound', () => {
  it('ships every sound it plays, listed with a public-safe licence and its CC0 sources, levelled by family', () => {
    const manifest = JSON.parse(fs.readFileSync('public/assets/audio/ball/manifest.json', 'utf8')) as { assets: { id: string; file: string; license: string; family: string;
      loop?: number[]; sources: { file: string; license: string; sha256?: string }[]; lufsMomentaryMax: number; truePeakDbfs: number }[] };
    const listed = new Map(manifest.assets.map(a => [a.file, a]));
    expect(ballSoundFiles().length).toBeGreaterThanOrEqual(40);
    for (const file of ballSoundFiles()) {
      expect(fs.existsSync(`public${file}`), file).toBe(true);
      const row = listed.get(file)!;
      expect(row, file).toBeDefined();
      expect(['original', 'CC0-derived'], file).toContain(row.license);
      for (const source of row.sources) expect(['CC0 1.0', 'original'], `${file} ${source.file}`).toContain(source.license);
      for (const source of row.sources.filter(s => s.file.startsWith('kenney'))) expect(source.sha256, source.file).toMatch(/^[0-9a-f]{64}$/);
      expect(row.truePeakDbfs, file).toBeLessThan(-.5);
    }
    // Nothing on disk is left out of the table, and the loops loop where the files say.
    expect(fs.readdirSync('public/assets/audio/ball').filter(f => f.endsWith('.m4a')).map(f => `/assets/audio/ball/${f}`).sort()).toEqual([...ballSoundFiles()].sort());
    for (const [id, loop] of Object.entries(BALL_LOOPS)) expect(listed.get(`/assets/audio/ball/${id}.m4a`)!.loop, id).toEqual([...loop!]);
  });

  it('hears a goal: the net, the whistle, the burst and the horn, the stands roaring, the music dipping under it, and the caller', () => {
    const { audio, played, stands, music, said } = rig();
    audio.update(snap(view(), 10), 'me');
    const scored = view({ events: [event(1, 'goal', { team: 'red', actorId: 'me', z: GOAL_RULES.halfZ, text: 'SUPER GOAL', value: 40 })], score: { red: 2, blue: 0 }, phase: 'scored' });
    audio.update(snap(scored, 10.05), 'me');
    expect(played).toEqual(expect.arrayContaining(['goal-net', 'whistle-goal', 'goal-burst', 'goal-horn']));
    expect(stands).toContain('crowd-roar-2');
    expect(music.punch).toHaveBeenCalled();
    // The default voice's own recorded lines for the moment (src/audio/data/ballCaller.json), else a borrowed one.
    const own = callerLines('super-goal');
    expect(said).toHaveLength(1);
    expect(own.length ? own : [BORROWED['super-goal']![0]]).toContain(said[0]);
    // Each event once: the snapshot after repeats it.
    const before = played.length;
    audio.update(snap(scored, 10.1), 'me');
    expect(played.length).toBe(before);
  });

  it('makes the other side\'s goal smaller in the stands, and groans', () => {
    const { audio, stands } = rig();
    audio.update(snap(view(), 10), 'me');
    audio.update(snap(view({ events: [event(1, 'goal', { team: 'blue', actorId: 'them', z: -GOAL_RULES.halfZ })] }), 10.05), 'me');
    expect(stands).toEqual(['crowd-roar-1', 'crowd-groan']);
  });

  it('finds bounces in the ball\'s own flight - the turf, the glass - with no event for them', () => {
    const { audio, played } = rig();
    audio.update(snap(view({ ball: ball({ y: .8, vy: -12, lastId: 'me', shot: 'power' }) }), 10), 'me');
    audio.update(snap(view({ ball: ball({ y: 1.1, vy: 7, lastId: 'me', shot: 'power' }) }), 10 + 1 / 30), 'me');
    expect(played).toContain('bounce-turf-hard');
    audio.update(snap(view({ ball: ball({ x: GOAL_RULES.halfX - .9, y: 3, vx: 14, lastId: 'me', shot: 'power' }) }), 11), 'me');
    audio.update(snap(view({ ball: ball({ x: GOAL_RULES.halfX - 1, y: 3, vx: -10, lastId: 'me', shot: 'power' }) }), 11 + 1 / 30), 'me');
    expect(played.some(id => id.startsWith('bounce-glass'))).toBe(true);
  });

  it('hears a tap the room names no event for, and never twice a strike that has one', () => {
    const { audio, played } = rig();
    audio.update(snap(view({ ball: ball({ y: 3, vx: 2, lastId: 'a', shot: 'tap' }) }), 10), 'me');
    audio.update(snap(view({ ball: ball({ y: 3, vx: -6, vy: 3, lastId: 'b', shot: 'tap' }) }), 10 + 1 / 30), 'me');
    expect(played.filter(id => id.startsWith('strike-tap'))).toHaveLength(1);
    audio.update(snap(view({ events: [event(5, 'strike', { shot: 'power', value: 30 })], ball: ball({ y: 3, vx: 25, lastId: 'a', shot: 'power' }) }), 10 + 2 / 30), 'me');
    expect(played.filter(id => id.startsWith('strike-'))).toEqual([expect.stringMatching(/^strike-tap-/), expect.stringMatching(/^strike-power-/)]);
  });

  it('hears a Sky Spike kill come down on the planks, and a ball out on the stone, though the room holds the ball that tick', () => {
    const { audio, played } = rig();
    audio.update(snap(view({ mode: 'sky-spike', ball: ball({ y: 2, vy: -14 }) }), 10), 'me');
    audio.update(snap(view({ mode: 'sky-spike', phase: 'scored', ball: ball({ y: .5, held: true }), events: [event(1, 'kill', { team: 'red', x: 2, z: 5 })] }), 10.03), 'me');
    expect(played).toEqual(expect.arrayContaining(['bounce-wood-hard', 'whistle-point']));
    audio.update(snap(view({ mode: 'sky-spike', phase: 'scored', ball: ball({ held: true }), events: [event(2, 'out', { team: 'blue', x: 12, z: 5 })] }), 12), 'me');
    expect(played).toContain('bounce-dome');
  });

  it('lays the boom under the big hits, slams a kill into the planks and hears a wipe-out', () => {
    const { audio, played, stands } = rig();
    audio.update(snap(view({ events: [event(1, 'strike', { shot: 'drive', value: 14 })] }), 10), 'me');
    expect(played).not.toContain('impact-boom');
    audio.update(snap(view({ events: [event(2, 'strike', { shot: 'power', value: 34 })] }), 10.1), 'me');
    expect(played).toContain('impact-boom');
    played.length = 0;
    audio.update(snap(view({ mode: 'sky-spike', ball: ball({ y: 2, vy: -14 }) }), 11), 'me');
    audio.update(snap(view({ mode: 'sky-spike', phase: 'scored', ball: ball({ y: .5, held: true }), events: [event(3, 'kill', { team: 'red', x: 2, z: 5 })] }), 11.03), 'me');
    expect(played).toEqual(expect.arrayContaining(['spike-slam', 'impact-boom', 'bounce-wood-hard']));
    played.length = 0; stands.length = 0;
    audio.update(snap(view({ events: [event(4, 'wipeout', { team: 'blue', targetId: 'me', x: 1, y: 1, z: 1, value: 3 })] }), 12), 'me');
    expect(played).toEqual(expect.arrayContaining(['wipeout-hit', 'impact-boom']));
    expect(stands).toContain('crowd-gasp');
    audio.update(snap(view({ events: [event(5, 'demo', { team: 'red', x: 1, y: 1, z: 1, value: 14 })] }), 12.1), 'me');
    expect(played).toContain('bowled');
  });

  it('calls the stance fights, the saves on the line and the spikes, and the stands react to them', () => {
    const lines = (moment: CallerMoment) => callerLines(moment);
    // A TAKEDOWN and its own wipe-out, the same step: the whole bowl gasps once, the caller says TAKEDOWN, never the wipe-out.
    let r = rig(.8);
    r.audio.update(snap(view(), 10), 'me');
    r.audio.update(snap(view({ events: [event(1, 'tackle', { team: 'red', actorId: 'me', targetId: 'them', text: 'TAKEDOWN' }), event(2, 'wipeout', { team: 'red', actorId: 'me', targetId: 'them', value: 3 })] }), 10.05), 'me');
    expect(r.stands.filter(s => s === 'crowd-gasp')).toHaveLength(1);
    expect(r.stands).toContain('crowd-roar-1');
    expect(r.said).toHaveLength(1); expect(lines('takedown')).toContain(r.said[0]);
    // A plain wipe-out is called as one; a save OFF THE LINE has its gasp, its "ooh" and its own call.
    r = rig(.8);
    r.audio.update(snap(view(), 10), 'me');
    r.audio.update(snap(view({ events: [event(1, 'wipeout', { team: 'blue', targetId: 'me', value: 3 })] }), 10.05), 'me');
    expect(lines('wipeout')).toContain(r.said[0]);
    r.tick(20); r.stands.length = 0;
    r.audio.update(snap(view({ events: [event(2, 'save', { team: 'red', actorId: 'me', text: 'OFF THE LINE', shot: 'save' })] }), 30), 'me');
    expect(r.stands).toEqual(expect.arrayContaining(['crowd-gasp', 'crowd-ooh-1', 'crowd-applause']));
    expect(lines('off-the-line')).toContain(r.said[1]);
    // A PERFECT SPIKE: the crack, its own call, a breath from the stands, and their biggest roar when it is put away.
    r = rig(.8);
    r.audio.update(snap(view({ mode: 'sky-spike' }), 10), 'me');
    r.audio.update(snap(view({ mode: 'sky-spike', events: [event(1, 'strike', { team: 'red', actorId: 'me', shot: 'spike', value: 30, text: 'SKY SPIKE', perfect: true, at: 10 })] }), 10.05), 'me');
    expect(r.played).toContain('spike-crack');
    expect(lines('perfect-spike')).toContain(r.said[0]);
    r.audio.update(snap(view({ mode: 'sky-spike', phase: 'scored', rally: 1, ball: ball({ held: true }), events: [event(2, 'kill', { team: 'red', x: 2, z: 5, at: 10.6 })] }), 10.6), 'me');
    expect(r.stands).toContain('crowd-roar-2');
    // A DIVING DIG is called; a Goal Rush strike timed perfectly, or one named PERFECT SET, waits for its moment's lines.
    r = rig(.8);
    r.audio.update(snap(view({ mode: 'sky-spike' }), 10), 'me');
    r.audio.update(snap(view({ mode: 'sky-spike', events: [event(1, 'dig', { team: 'red', actorId: 'me', text: 'DIVING DIG', value: 20 })] }), 10.05), 'me');
    expect(lines('diving-dig')).toContain(r.said[0]);
    r = rig(.8);
    r.audio.update(snap(view(), 10), 'me');
    r.audio.update(snap(view({ events: [event(1, 'strike', { team: 'red', actorId: 'me', shot: 'power', value: 32, perfect: true })] }), 10.05), 'me');
    expect(lines('perfect-strike')).toContain(r.said[0]);
    r.tick(20);
    r.audio.update(snap(view({ events: [event(2, 'strike', { team: 'red', actorId: 'me', shot: 'pop', value: 9, text: 'PERFECT SET' })] }), 30), 'me');
    expect(lines('clever-touch')).toContain(r.said[1]);
  });

  it('lights the heat tier by tier and holds OVERDRIVE\'s roar on the ball, let go when it cools', () => {
    const { audio, played, loops } = rig();
    audio.update(snap(view({ ball: ball({ heat: .5 }) }), 10), 'me');
    audio.update(snap(view({ ball: ball({ heat: 2.1 }) }), 10.03), 'me');
    expect(played).toContain('heat-2');
    audio.update(snap(view({ ball: ball({ heat: 4, vx: 30 }) }), 10.06), 'me');
    expect(played).toContain('heat-4');
    expect(loops['ball-overdrive']).toBeGreaterThan(0);
    audio.update(snap(view({ ball: ball({ heat: 3.5 }) }), 10.09), 'me');
    expect(loops['ball-overdrive']).toBe(0);
  });

  it('wants the stands loud near a goal and in overtime, quiet in midfield and in FREE PLAY', () => {
    const mid = ballTension(view()), near = ballTension(view({ ball: ball({ z: GOAL_RULES.halfZ - 3 }) }));
    const overtime = ballTension(view({ ball: ball({ z: GOAL_RULES.halfZ - 3, heat: 3 }), overtime: true }));
    expect(near).toBeGreaterThan(mid * 3);
    expect(overtime).toBeGreaterThan(near);
    expect(ballTension(view({ practice: true, ball: ball({ z: GOAL_RULES.halfZ - 3 }) }))).toBeLessThan(mid + .05);
    expect(ballTension(view({ mode: 'sky-spike', rally: 12, fever: true, ball: ball({ y: 4 }) }))).toBeGreaterThan(ballTension(view({ mode: 'sky-spike', ball: ball({ z: 8 }) })));
  });

  it('puts the music on its climax in overtime and heats it, and the stands chant under pressure', () => {
    const { audio, music, loops, tick } = rig();
    const ot = view({ overtime: true, ball: ball({ z: GOAL_RULES.halfZ - 4, heat: 2 }) });
    for (let i = 0; i < 4; i++) { audio.update(snap(ot, 10 + i), 'me'); tick(1); }
    expect(music.peak).toHaveBeenLastCalledWith(true);
    expect(music.heat).toHaveBeenLastCalledWith(.8);
    expect(loops['ball-chant']).toBeGreaterThan(0);
  });
});

describe('the caller (ballCaller.ts)', () => {
  const voice = (seconds = 1) => { const said: string[] = []; return { said, voice: { announce: (url: string) => { said.push(url); }, sampleSeconds: () => seconds, preload: vi.fn() } }; };
  it('never talks over himself or every second: small moments wait, bigger ones cut, each moment rests', () => {
    let now = 0;
    const { said, voice: v } = voice(1.5), caller = new BallCaller(v, () => 0, () => now);
    expect(caller.say('sky-spike')).toBeTruthy();
    now = .5; expect(caller.say('stuff-block')).toBeUndefined(); // still talking, and not two priorities up
    now = .6; expect(caller.say('super-goal')).toBeTruthy(); // two up: cuts
    now = 2.4; expect(caller.say('sky-spike')).toBeUndefined(); // resting
    now = 2.4 + GAP; expect(caller.say('new-record')).toBeUndefined(); // small, inside SPACING of the last line
    now = .6 + SPACING + 1.6; expect(caller.say('new-record')).toBeTruthy();
    expect(said).toHaveLength(3);
  });
  it('queues a follow-up behind the line being said, and skips a line not loaded yet', () => {
    let now = 0;
    const { said, voice: v } = voice(1), caller = new BallCaller(v, () => 0, () => now);
    caller.say('overtime');
    expect(caller.say('match-point')).toBeUndefined();
    expect(caller.say('match-point', { queue: true })).toBeTruthy();
    const quiet = new BallCaller({ announce: vi.fn(), sampleSeconds: () => undefined, preload: vi.fn() }, () => 0, () => now);
    expect(quiet.say('overtime')).toBeUndefined();
    expect(said).toHaveLength(2);
  });
  it('leaves out the lines asked (a FEVER point double to the side behind alone is not "every point")', () => {
    let now = 0;
    const { said, voice: v } = voice(.5), caller = new BallCaller(v, Math.random, () => now);
    const lines = callerLines('fever'), avoid = /\/fever-[14]\.[a-z0-9]+$/;
    expect(lines.filter(url => avoid.test(url))).toHaveLength(2);
    for (let i = 0; i < 12; i++) { now += 60; caller.say('fever', { avoid }); }
    expect(said).toHaveLength(12);
    expect(said.every(url => !avoid.test(url))).toBe(true);
    // Each voice's two lines that say so (its manifest).
    for (const voice of ['grandpa', 'arena']) {
      const book = JSON.parse(fs.readFileSync(`public/assets/audio/ball/caller/${voice}/manifest.json`, 'utf8')) as { assets: { id: string; text: string }[] };
      expect(book.assets.filter(l => /^fever-[14]$/.test(l.id)).every(l => /double/i.test(l.text)), voice).toBe(true);
      expect(book.assets.filter(l => /^fever-[23]$/.test(l.id)).some(l => /double/i.test(l.text)), voice).toBe(false);
    }
  });
  it('has a rule for every moment, and every line it can say is on disk', () => {
    for (const moment of Object.keys(CALLER) as CallerMoment[]) expect(CALLER[moment].priority, moment).toBeGreaterThan(0);
    for (const file of allCallerFiles()) expect(fs.existsSync(`public${file}`), file).toBe(true);
    // Each voice's lines (its manifest) name every moment, once each.
    for (const voice of ['grandpa', 'arena']) {
      const book = JSON.parse(fs.readFileSync(`public/assets/audio/ball/caller/${voice}/manifest.json`, 'utf8')) as { assets: { id: string; moment: string; text: string }[] };
      expect(new Set(book.assets.map(l => l.moment)), voice).toEqual(new Set(Object.keys(CALLER)));
      expect(book.assets.length, voice).toBeGreaterThanOrEqual(120);
      expect(new Set(book.assets.map(l => l.id)).size, voice).toBe(book.assets.length);
    }
  });
  it('plays each sound at a gain the mixer can take', () => {
    for (const [id, gain] of Object.entries(BALL_SFX)) { expect(gain, id).toBeGreaterThan(0); expect(gain, id).toBeLessThanOrEqual(1); }
  });
});

describe('the commentary choice (Settings: COMMENTARY)', () => {
  it('speaks as the grandfather by default, as the arena caller when picked, and not at all when off', () => {
    setCommentary(undefined);
    const grandpa = callerLines('goal'), arena = callerLines('goal', 'arena');
    expect(grandpa.length).toBeGreaterThan(0);
    expect(grandpa.every(f => f.includes('/caller/grandpa/'))).toBe(true);
    expect(arena.every(f => f.includes('/caller/arena/'))).toBe(true);
    setCommentary('arena'); expect(callerLines('goal')).toEqual(arena);
    setCommentary('off'); expect(callerLines('goal')).toEqual([]); expect(callerFiles()).toEqual([]);
    // The package ships both voices whatever is picked.
    expect(allCallerFiles()).toEqual(expect.arrayContaining([...grandpa, ...arena]));
    setCommentary('grandpa');
  });
});
