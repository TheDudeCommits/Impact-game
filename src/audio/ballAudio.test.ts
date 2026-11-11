import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BALL_LOOPS, BALL_SFX, BallAudio, ballSoundFiles, ballTension, nextContact, type BallMixer, type BallMusic } from './ballAudio';
import { DOUBLE } from '../game/ball/BallMatch';
import { BORROWED, BallCaller, CALLER, GAP, SPACING, allCallerFiles, callerFiles, callerLines, setCommentary, type CallerMoment } from './ballCaller';
import { GOAL_RULES, type BallEvent, type BallState, type BallView } from '../game/ball/model';
import type { TouchForecast } from '../game/ball/touchForecast';
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
  /** (Each one-shot and stands' reaction with its owner, and each taken back: owner, or owner and file.) */
  const owned: string[] = [], taken: string[] = [], timed: [string, string, number][] = [];
  let clock = 100;
  const id = (url: string) => url.split('/').pop()!.replace('.m4a', '');
  const mixer: BallMixer = {
    sample: (url, _at, _gain, _rate, owner, _priority, delay) => { played.push(id(url)); owned.push(`${owner}:${id(url)}`); timed.push([id(url), owner ?? '', delay ?? 0]); },
    centred: (url) => { played.push(id(url)); },
    stands: (url, _gain, _delay, _rate, owner) => { stands.push(id(url)); owned.push(`${owner ?? 'stands'}:${id(url)}`); },
    loopAt: (key, _url, gain) => { loops[key] = gain; },
    crowdTension: vi.fn(), soften: vi.fn(), cheer: vi.fn(), preload: vi.fn(),
    announce: (url) => { said.push(url); }, sampleSeconds: () => seconds,
    takeBack: (owner, url) => { taken.push(url ? `${owner}:${url.includes('/audio/ball/') && !url.includes('/caller/') ? id(url) : url}` : owner); },
  };
  const music: BallMusic = { peak: vi.fn(), heat: vi.fn(), punch: vi.fn() };
  const audio = new BallAudio(mixer, music, () => 0, () => clock);
  return { audio, mixer, music, played, stands, said, loops, owned, taken, timed, tick: (s: number) => { clock += s; } };
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

  it('hears Goal Rush\'s TRAP as a soft thud on the turf, nothing more, and a PERFECT GUARD as its block', () => {
    const r = rig(), at = { team: 'red' as const, actorId: 'me', shot: 'save' as const };
    r.audio.update(snap(view({ ball: ball({ y: .8, vz: -9, lastId: 'mate', lastTeam: 'red', shot: 'tap' }) }), 10 - 1 / 30), 'me');
    r.audio.update(snap(view({ events: [event(5, 'perfect', { ...at, text: 'TRAP' })], ball: ball({ y: .8, lastId: 'me', lastTeam: 'red', shot: 'save', carry: 'me' }) }), 10), 'me');
    expect(r.played).toEqual(['bounce-turf-soft']); expect(r.stands).toEqual([]); expect(r.said).toEqual([]);
    const guard = rig();
    guard.audio.update(snap(view({ ball: ball({ y: 2, vz: -9, lastId: 'mate', lastTeam: 'red', shot: 'tap' }) }), 10 - 1 / 30), 'me');
    guard.audio.update(snap(view({ events: [event(5, 'perfect', { ...at, text: 'PERFECT GUARD' })], ball: ball({ y: 2, vy: 8, vz: 11, lastId: 'me', lastTeam: 'red', shot: 'save' }) }), 10), 'me');
    expect(guard.played).toEqual(['block']);
  });
  it('hears no touch in a carried ball turning and stopping at its carrier\'s feet (BallMatch CARRY)', () => {
    const { audio, played } = rig(), at = (t: number, vx: number, vz: number, carry?: string) => audio.update(snap(view({ ball: ball({ y: .8, vx, vz, lastId: 'me', lastTeam: 'red', shot: 'save', carry }) }), t), 'me');
    at(10, 0, 7, 'me'); at(10 + 1 / 30, 6, 2, 'me'); at(10 + 2 / 30, 0, 0, 'me');
    expect(played).toEqual([]);
    // (A ball nobody carries that turns as sharply is a touch, as ever.)
    at(11, 0, 7); at(11 + 1 / 30, 6, 2);
    expect(played.filter(id => id.startsWith('strike-'))).toHaveLength(1);
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

describe('the page\'s own touch heard at once', () => {
  const touch = (ev: TouchForecast['event'] | undefined, room: number, over: Partial<BallState> = {}): TouchForecast =>
    ({ ball: ball({ y: 4, vz: 20, lastId: 'me', lastTeam: 'red', shot: 'spike', ...over }), kind: 'strike', room, event: ev });
  const spike = { kind: 'strike', team: 'red', actorId: 'me', x: 0, y: 4, z: -.5, shot: 'spike', value: 30, text: 'SKY SPIKE', perfect: true } as const;
  const sky = (over: Partial<BallView> = {}) => view({ mode: 'sky-spike', ball: ball({ z: -6 }), ...over });

  it('plays a PERFECT SPIKE at once - the contact, the crack, the boom, the stands and the caller - and nothing of it again when the room\'s word comes', () => {
    const r = rig(.8);
    r.audio.update(snap(sky(), 10), 'me');
    r.audio.own(touch(spike, 10.2), ball({ y: 4, vy: 2, lastId: 'mate', lastTeam: 'red', shot: 'set' }));
    expect(r.played).toEqual(expect.arrayContaining(['strike-volley', 'spike-crack', 'impact-boom']));
    expect(r.owned.filter(o => o.startsWith('own1:'))).toHaveLength(r.played.length);
    expect(r.stands).toEqual(['crowd-ooh-2']); expect(r.owned).toContain('own1r:crowd-ooh-2');
    expect(callerLines('perfect-spike')).toContain(r.said[0]);
    const heard = { played: r.played.length, stands: r.stands.length, said: r.said.length };
    // The room's own, a round trip and more later, a tick after the forecast's time for it: heard already.
    const word = sky({ events: [event(7, 'strike', { ...spike, at: 10.217 })], ball: ball({ y: 4, vz: 20, lastId: 'me', lastTeam: 'red', shot: 'spike' }) });
    r.audio.listen(snap(word, 10.25), 'me');
    r.audio.update(snap(word, 10.25), 'me');
    expect({ played: r.played.length, stands: r.stands.length, said: r.said.length }).toEqual(heard);
    expect(r.taken).toEqual([]);
    // Its point still brings the house down (the room's event keeps what the forecast only played).
    r.audio.update(snap(sky({ phase: 'scored', rally: 1, ball: ball({ held: true }), events: [event(8, 'kill', { team: 'red', x: 2, z: 5, at: 10.8 })] }), 10.8), 'me');
    expect(r.stands).toContain('crowd-roar-2');
  });

  it('plays a touch the room names no event for (a set) at once, and skips the room\'s flight finding it', () => {
    const r = rig();
    r.audio.update(snap(sky({ ball: ball({ y: 2, vy: 6, vz: -3, lastId: 'mate', lastTeam: 'red', shot: 'bump' }) }), 10), 'me');
    r.audio.own({ ...touch(undefined, 10.05, { vy: 9, vz: -1, shot: 'set' }), kind: 'strike' }, ball({ y: 2, vy: 6, vz: -3, lastId: 'mate', lastTeam: 'red', shot: 'bump' }));
    expect(r.owned).toEqual([expect.stringMatching(/^own1:strike-tap-/)]);
    r.audio.update(snap(sky({ ball: ball({ y: 2.1, vy: 9, vz: -1, lastId: 'me', lastTeam: 'red', shot: 'set' }) }), 10 + 2 / 30), 'me');
    expect(r.played).toHaveLength(1);
    // Somebody else's touch after it is heard as ever.
    r.audio.update(snap(sky({ ball: ball({ y: 3, vy: -2, vz: 8, lastId: 'mate', lastTeam: 'red', shot: 'set' }) }), 10 + 4 / 30), 'me');
    expect(r.played).toHaveLength(2);
  });

  it('hears a touch once when the room\'s word on it comes before the page\'s own forecast of it', () => {
    const r = rig(.8);
    r.audio.update(snap(sky(), 10), 'me');
    r.audio.update(snap(sky({ events: [event(4, 'perfect', { team: 'red', actorId: 'me', shot: 'block', text: 'STUFF BLOCK', at: 10.02 })] }), 10.03), 'me');
    const n = { played: r.played.length, stands: r.stands.length, said: r.said.length };
    expect(r.played).toContain('block-stuff');
    r.audio.own({ ...touch({ kind: 'perfect', team: 'red', actorId: 'me', x: 0, y: 3.2, z: -.4, shot: 'block', text: 'STUFF BLOCK' }, 10.08), kind: 'guard' }, null);
    expect({ played: r.played.length, stands: r.stands.length, said: r.said.length }).toEqual(n);
  });

  it('hears a body\'s touch and the swing landing on it a breath later as one touch, the swing\'s (BallMatch DOUBLE)', () => {
    const r = rig();
    const bumped = ball({ y: 2.4, vy: 5, vz: -1, lastId: 'me', lastTeam: 'red', shot: 'bump' }), before = ball({ y: 2.6, vy: -6, vz: -4, lastId: 'them', lastTeam: 'blue', shot: 'spike' });
    r.audio.update(snap(sky({ ball: before }), 10), 'me');
    // The body bumps it with the fighter's own set due in 0.05 s: its tap waits that long, and a tick.
    r.audio.own({ ball: bumped, kind: 'bump', room: 10.05 }, before, .05);
    expect(r.timed).toEqual([[expect.stringMatching(/^strike-tap-/), 'own1', expect.closeTo(.05 + 1 / 60, 3)]]);
    // The set lands: the touch is the set's - the bump's tap, still to come, is taken back; the set is heard at once.
    r.audio.own({ ball: ball({ y: 2.5, vy: 9, vz: -2, lastId: 'me', lastTeam: 'red', shot: 'set' }), kind: 'strike', room: 10.1 }, bumped, Infinity);
    expect(r.taken).toEqual(['own1']);
    expect(r.timed[1]).toEqual([expect.stringMatching(/^strike-tap-/), 'own2', 0]);
    // A body's touch with no swing about to land (or one landing past the window) is heard at once.
    const q = rig();
    q.audio.update(snap(sky({ ball: before }), 10), 'me');
    q.audio.own({ ball: bumped, kind: 'bump', room: 10.05 }, before, DOUBLE.window + .05);
    expect(q.timed).toEqual([[expect.stringMatching(/^strike-tap-/), 'own1', 0]]);
    expect(nextContact([.18, .4], .1)).toBeCloseTo(.08, 6); expect(nextContact([.18], .2)).toBe(0); expect(nextContact([.18], .3)).toBe(Infinity);
  });

  it('on this device too: the room\'s body touch a breath before its fighter\'s swing lands is heard as the swing (DOUBLE)', () => {
    const r = rig();
    // (main.ts hands update how soon the page's own swing under way lands: its cast's move, castMove.)
    r.audio.update(snap(sky({ ball: ball({ y: 2.6, vy: -6, vz: -4, lastId: 'them', lastTeam: 'blue', shot: 'spike' }) }), 10), 'me', .07);
    // The ball comes off the fighter's body with its set 0.05 s off: the tap waits that long, and a tick or two.
    r.audio.update(snap(sky({ ball: ball({ y: 2.4, vy: 5, vz: -1, lastId: 'me', lastTeam: 'red', shot: 'bump' }) }), 10 + 1 / 60), 'me', .05);
    expect(r.timed).toEqual([[expect.stringMatching(/^strike-tap-/), 'late1', expect.closeTo(.05 + 2.5 / 60, 3)]]);
    // The set lands on it - the body's tap still to come is taken back, and the set heard at once.
    r.audio.update(snap(sky({ ball: ball({ y: 2.5, vy: 9, vz: -2, lastId: 'me', lastTeam: 'red', shot: 'set' }) }), 10 + 4 / 60), 'me', 0);
    expect(r.taken).toEqual(['late1']);
    expect(r.timed[1]).toEqual([expect.stringMatching(/^strike-tap-/), 'ball', 0]);
    // A swing's own touch (its contact landing now) is never held back.
    const q = rig();
    q.audio.update(snap(sky({ ball: ball({ y: 2.6, vy: -6, vz: -4, lastId: 'them', lastTeam: 'blue', shot: 'spike' }) }), 10), 'me', .02);
    q.audio.update(snap(sky({ ball: ball({ y: 2.5, vy: 9, vz: -2, lastId: 'me', lastTeam: 'red', shot: 'set' }) }), 10 + 1 / 60), 'me', 0);
    expect(q.timed).toEqual([[expect.stringMatching(/^strike-tap-/), 'ball', 0]]);
  });

  it('hears the ball riding the guard after a STUFF BLOCK heard at once as that block, not another', () => {
    const r = rig(.8);
    r.audio.update(snap(sky({ ball: ball({ y: 3.4, vz: -18, vy: -6, z: 1, lastId: 'them', lastTeam: 'blue', shot: 'spike' }) }), 10), 'me');
    r.audio.own({ ...touch({ kind: 'perfect', team: 'red', actorId: 'me', x: 0, y: 3.2, z: -.4, shot: 'block', text: 'STUFF BLOCK' }, 10.05, { vz: 9, vy: -8, shot: 'block' }), kind: 'guard' }, null);
    const n = r.played.length;
    // The room's block, then its flight finding the ball on the guard again a tick or two after.
    const blocked = (t: number, vz: number, id: number[]) => sky({ events: id.map(i => event(i, 'perfect', { team: 'red', actorId: 'me', shot: 'block', text: 'STUFF BLOCK', at: 10.067 })), ball: ball({ y: 3, z: .4, vz, vy: -8, lastId: 'me', lastTeam: 'red', shot: 'block' }) });
    r.audio.update(snap(blocked(10.1, 9, [5]), 10.1), 'me');
    r.audio.update(snap(blocked(10.13, 2, [5]), 10.13), 'me');
    expect(r.played).toHaveLength(n);
    // Its own touch a while later is a touch again.
    r.audio.update(snap(sky({ ball: ball({ y: 1.2, z: -2, vz: 2, vy: -4, lastId: 'mate', lastTeam: 'red', shot: 'block' }) }), 10.77), 'me');
    r.audio.update(snap(sky({ ball: ball({ y: 1, z: -2, vz: -6, vy: 5, lastId: 'me', lastTeam: 'red', shot: 'bump' }) }), 10.8), 'me');
    expect(r.played).toHaveLength(n + 1);
  });

  it('waits for the room to hear the stands and the caller where the touch alone does not name the moment, and plays only what the forecast did not', () => {
    const r = rig(.8);
    r.audio.update(snap(sky(), 10), 'me');
    // A plain SKY SPIKE: the room may name it a ROLL SPIKE or a LINK SHOT.
    r.audio.own(touch({ ...spike, perfect: undefined }, 10.2), null);
    expect(r.played).toEqual(expect.arrayContaining(['strike-volley', 'spike-crack', 'impact-boom']));
    expect(r.stands).toEqual([]); expect(r.said).toEqual([]);
    const n = r.played.length;
    r.audio.listen(snap(sky({ events: [event(7, 'strike', { ...spike, perfect: undefined, text: 'ROLL SPIKE', at: 10.2 })], ball: ball({ lastId: 'me' }) }), 10.24), 'me');
    r.audio.update(snap(sky({ events: [event(7, 'strike', { ...spike, perfect: undefined, text: 'ROLL SPIKE', at: 10.2 })] }), 10.24), 'me');
    // The ROLL SPIKE's crack and boom were heard with the touch; its call is the room's.
    expect(r.played).toHaveLength(n);
    expect(callerLines('roll-spike')).toContain(r.said[0]);
    expect(r.taken).toEqual([]);
  });

  it('takes a refused touch back - its hits, the stands, the caller\'s line - and never plays it twice', () => {
    const r = rig(.8);
    r.audio.update(snap(sky(), 10), 'me');
    r.audio.own({ ...touch({ kind: 'perfect', team: 'red', actorId: 'me', x: 0, y: 3, z: -.4, shot: 'block', text: 'STUFF BLOCK' }, 10.2), kind: 'guard' }, null);
    expect(r.played).toContain('block-stuff'); expect(r.stands).toContain('crowd-roar-1');
    const said = r.said[0];
    expect(callerLines('stuff-block')).toContain(said);
    // The newest snapshots: somebody else's touch, and nothing of this page's fighter's.
    r.audio.listen(snap(sky({ ball: ball({ lastId: 'them', lastTeam: 'blue' }) }), 10.3), 'me');
    expect(r.taken).toEqual([]);
    r.audio.listen(snap(sky({ ball: ball({ lastId: 'them', lastTeam: 'blue' }) }), 10.46), 'me');
    expect(r.taken).toEqual(expect.arrayContaining(['own1', 'own1r', `announcer:${said}`]));
    // The room's flight with the ball sent on by somebody else: nothing of this page's played.
    const n = r.played.length;
    r.audio.update(snap(sky({ ball: ball({ y: 3, vz: -9, lastId: 'them', lastTeam: 'blue', shot: 'spike' }) }), 10.5), 'me');
    expect(r.played.slice(n).filter(id => id === 'block-stuff' || id === 'block')).toEqual([]);
  });

  it('takes back the stands and the caller heard for another moment than the room\'s, and plays the room\'s', () => {
    const r = rig(.8);
    r.audio.update(snap(view(), 10), 'me');
    const perfect = { kind: 'strike', team: 'red', actorId: 'me', x: 0, y: 1, z: 0, shot: 'power', value: 32, text: 'PERFECT STRIKE', perfect: true } as const;
    r.audio.own(touch(perfect, 10.2, { shot: 'power', y: 1 }), null);
    expect(r.played).toEqual(expect.arrayContaining(['impact-boom'])); expect(r.stands).toContain('crowd-ooh-2');
    const said = r.said[0];
    // The room timed it a tick late: a plain power shot.
    const word = view({ events: [event(9, 'strike', { ...perfect, text: undefined, perfect: undefined, at: 10.21 })] });
    r.audio.listen(snap(word, 10.25), 'me'); r.audio.update(snap(word, 10.25), 'me');
    expect(r.taken).toEqual(expect.arrayContaining(['own1r', `announcer:${said}`, 'own1:impact-boom']));
    expect(r.played.filter(id => id.startsWith('strike-power'))).toHaveLength(1);
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
