import { describe, expect, it } from 'vitest';
import { StanceControl, hasStances, lockable, nextFoe, pickFoe } from './stance';
import { freshBall } from './physics';
import { BALL_ID, GOAL_STANCE, type BallSeat, type BallView } from './model';
import type { PlayerState } from '../types';

/** Goal Rush's stances on the page (game/ball/stance.ts): Tab, the pick, the flick, and the lock letting go. */
const seat = (id: string, team: 'red' | 'blue', o: Partial<BallSeat> = {}): BallSeat => ({ id, name: id, fighter: 'taisei', team, bot: true, goals: 0, assists: 0, saves: 0, shots: 0, touches: 0, kills: 0, aces: 0, blocks: 0, digs: 0, points: 0, ...o });
const player = (id: string, x: number, z: number, o: Partial<PlayerState> = {}): PlayerState => ({ id, name: id, fighter: 'taisei', alive: true, isBot: true, x, y: 0, z, yaw: 0, hp: 220, maxHp: 220, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...o } as PlayerState);
function view(o: Partial<BallView> = {}, seats = [seat('me', 'red'), seat('mate', 'red'), seat('a', 'blue'), seat('b', 'blue'), seat('c', 'blue')]): BallView {
  return { kind: 'ball', mode: 'goal-rush', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 240, phaseUntil: 0,
    seats, score: { red: 0, blue: 0 }, ball: { ...freshBall(), held: false }, clock: 200, overtime: false, touchTeam: null, touches: 0, rally: 0, servingTeam: 'red', serverId: null,
    target: 0, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o };
}
// Me at the centre looking up +z; a ahead and near, b ahead and further, c behind, the mate ahead.
const players = () => [player('me', 0, 0), player('mate', 0, 3), player('a', 1, 6), player('b', -6, 10), player('c', 0, -5)];

describe("Goal Rush's stances on the page", () => {
  it('has them in Goal Rush only, outside FREE PLAY', () => {
    expect(hasStances(view())).toBe(true);
    expect(hasStances(view({ mode: 'sky-spike' }))).toBe(false);
    expect(hasStances(view({ practice: true }))).toBe(false);
    expect(hasStances(undefined)).toBe(false);
  });
  it('locks only an opponent in play and within reach', () => {
    const v = view(undefined, [seat('me', 'red'), seat('mate', 'red'), seat('a', 'blue', { out: 5 }), seat('b', 'blue')]), me = player('me', 0, 0);
    expect(lockable(v, me, player('mate', 0, 2))).toBe(false);
    expect(lockable(v, me, player('a', 0, 2))).toBe(false);
    expect(lockable(v, me, player('b', 0, 2))).toBe(true);
    expect(lockable(v, me, player('b', 0, GOAL_STANCE.reach + 1))).toBe(false);
    expect(lockable(v, me, player('b', 0, 2, { alive: false }))).toBe(false);
  });
  it('picks the one on the ball if they are near it, else the nearest in front of the view', () => {
    const v = view(), ps = players();
    // The ball far from everyone: the nearest in front, never the one behind.
    expect(pickFoe(v, ps[0], ps, 0, { x: 15, y: .8, z: 15 })).toBe('a');
    // Looking back down the pitch: the one behind is in front now.
    expect(pickFoe(v, ps[0], ps, Math.PI, { x: 15, y: .8, z: 15 })).toBe('c');
    // b on the ball: b, though a is nearer.
    expect(pickFoe(v, ps[0], ps, 0, { x: -6, y: .8, z: 11 })).toBe('b');
    expect(pickFoe(v, ps[0], [ps[0], ps[1]], 0, null)).toBeNull();
  });
  it('flicks the lock to the next opponent the way the view was swept', () => {
    const v = view(), ps = players();
    // From a (ahead, a little left on screen: world +x is the screen's left looking up +z), a sweep right (the heading
    // shrinking, the mouse moved right) finds b; a sweep left goes on round to c, behind.
    expect(nextFoe(v, ps[0], ps, 'a', -1)).toBe('b');
    expect(nextFoe(v, ps[0], ps, 'a', 1)).toBe('c');
  });
  it('toggles on Tab: the best opponent, then the ball again; nothing to lock is no change', () => {
    const s = new StanceControl(), v = view(), ps = players();
    expect(s.stance).toBe('ball');
    expect(s.targetId()).toBe(BALL_ID);
    expect(s.toggle(v, ps[0], ps, 0, null)).toBe(true);
    expect(s.lock).toBe('a'); expect(s.targetId()).toBe('a'); expect(s.stance).toBe('fight');
    expect(s.toggle(v, ps[0], ps, 0, null)).toBe(true);
    expect(s.lock).toBeNull();
    expect(s.toggle(v, ps[0], [ps[0]], 0, null)).toBe(false);
    // Not in play: no lock.
    expect(s.toggle(view({ phase: 'kickoff' }), ps[0], ps, 0, null)).toBe(false);
  });
  it('takes a couch seat\'s TARGET count, each new press a toggle', () => {
    const s = new StanceControl(), v = view(), ps = players();
    s.pressed(1, v, ps[0], ps, 0, null); expect(s.lock).toBe('a');
    s.pressed(1, v, ps[0], ps, 0, null); expect(s.lock).toBe('a');
    s.pressed(2, v, ps[0], ps, 0, null); expect(s.lock).toBeNull();
    // A new couch counts from nought again.
    s.pressed(0, v, ps[0], ps, 0, null); s.pressed(1, v, ps[0], ps, 0, null); expect(s.lock).toBe('a');
  });
  it('holds a TAKEDOWN a beat, then is the ball again; lets go out of reach, out of play, or when the room never took it', () => {
    const ps = players(), s = new StanceControl();
    const confirmed = (lock: string, o: Partial<BallSeat> = {}) => view(undefined, [seat('me', 'red', { lock }), seat('mate', 'red'), seat('a', 'blue', o), seat('b', 'blue'), seat('c', 'blue')]);
    s.toggle(view(), ps[0], ps, 0, null);
    s.update(1 / 60, confirmed('a', { out: 9 }), ps[0], ps, 0);
    expect(s.lock).toBe('a');
    for (let i = 0; i < 40; i++) s.update(1 / 60, confirmed('a', { out: 9 }), ps[0], ps, 0);
    expect(s.lock).toBeNull(); expect(s.lastChange).toBe('takedown');
    // Out of reach.
    s.toggle(view(), ps[0], ps, 0, null);
    s.update(1 / 60, confirmed('a'), ps[0], [ps[0], player('a', 0, GOAL_STANCE.reach + 2)], 0);
    expect(s.lock).toBeNull(); expect(s.lastChange).toBe('lost');
    // A goal: out of play.
    s.toggle(view(), ps[0], ps, 0, null);
    s.update(1 / 60, view({ phase: 'scored' }), ps[0], ps, 0);
    expect(s.lock).toBeNull(); expect(s.lastChange).toBe('stop');
    // The room never took it (its seat says no lock for a second).
    s.toggle(view(), ps[0], ps, 0, null);
    for (let i = 0; i < 30; i++) s.update(1 / 60, view(), ps[0], ps, 0);
    expect(s.lock).toBe('a');
    for (let i = 0; i < 40; i++) s.update(1 / 60, view(), ps[0], ps, 0);
    expect(s.lock).toBeNull();
  });
  it('moves the lock along on a quick sweep of the view, not on a slow turn', () => {
    const ps = players(), s = new StanceControl(), v = view(undefined, [seat('me', 'red', { lock: 'a' }), seat('mate', 'red'), seat('a', 'blue'), seat('b', 'blue'), seat('c', 'blue')]);
    s.toggle(view(), ps[0], ps, 0, null);
    // A slow turn: half a radian over two seconds.
    for (let i = 0; i < 120; i++) s.update(1 / 60, v, ps[0], ps, .5 / 120);
    expect(s.lock).toBe('a');
    // A flick right: four tenths of a radian in a tenth of a second.
    for (let i = 0; i < 6; i++) s.update(1 / 60, v, ps[0], ps, -.4 / 6);
    expect(s.lock).toBe('b'); expect(s.lastChange).toBe('flick');
  });
});
