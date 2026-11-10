import { describe, expect, it } from 'vitest';
import { BallMatch, DOUBLE } from './BallMatch';
import { BALL_ID, SPIKE_RULES, type BallModeId, type BallState, type BallTeam } from './model';
import { stepBall, type BallContact } from './physics';
import { PLACE, SERVE_STYLE, placement, strikeBall } from './strike';
import { TouchForecaster, type LocalFighter } from './touchForecast';
import { jumpArc, type MoveDefinition } from '../moves';
import type { ExternalBlow } from '../simulation';

// The ball modes: the stick read as the button was pressed (simulation attackMoveX/Z, BallMatch received,
// touchForecast blow), a body's touch and its own swing a breath later counted once (BallMatch DOUBLE), and Sky Spike's
// PLACEMENT (strike.ts PLACE) - each in the room and in the page's forecast of it.
const MOVE: MoveDefinition = { name: 'Test Blow', duration: .4, contacts: [.1], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string, slot: ExternalBlow['slot'] = 'heavy'): ExternalBlow =>
  ({ attackerId, slot, move: MOVE, damage: 10, critical: false, finisher: false, pushX: 0, pushZ: 1, knockback: 4, stun: .2, launch: false, hitstop: .05 });
type Inside = { bodyContacts(dt: number): void; last: Map<string, unknown> };
const inside = (m: BallMatch) => m as unknown as Inside;
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };

/** Two people, one a side, nobody else, the ball live: no bot moves the ball but the test. */
function pair(mode: BallModeId) {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false, replays: false });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  for (let i = 0; i < 300 && m.view.phase !== 'live' && mode === 'goal-rush'; i++) m.step(1 / 60);
  m.view.phase = 'live';
  return m;
}
/** A seat put somewhere, facing `yaw`, on the floor or up in its jump at `share` of its top, the stick let go. */
function put(m: BallMatch, id: string, at: { x: number; z: number }, yaw: number, share = 0) {
  const a = m.sim.actors.get(id)!;
  m.sim.place(id, { x: at.x, y: 0, z: at.z }, yaw);
  a.attackYaw = yaw; a.input.yaw = yaw; a.state.yaw = yaw; a.input.moveX = 0; a.input.moveZ = 0;
  if (share > 0) { a.state.grounded = false; a.state.y = jumpArc(a.state.fighter).apex * share; }
  return a;
}
/** The rally under way on `team`'s side: `touches` of its touches spent, the ball where it is put. */
function rally(m: BallMatch, team: BallTeam, touches: number, ball: Partial<BallState>) {
  m.view.phase = 'live'; m.view.rally = 1; m.view.touchTeam = team; m.view.touches = touches;
  // (Last touched by a team-mate who is not in the match: the seat's own swing is never a later contact of its own.)
  Object.assign(m.ball, { held: false, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, lastId: `${team}-2`, lastTeam: team, heat: .5 }, ball);
}
/** A person's press as their page sends it: the attack and the stick, then the stick let go a tick later. */
function press(m: BallMatch, id: string, slot: ExternalBlow['slot'], stick: { x: number; z: number }, yaw: number, seq = 1) {
  m.submit(id, { seq, moveX: stick.x, moveZ: stick.z, yaw, attack: slot as never, targetId: BALL_ID });
  m.submit(id, { seq: seq + 1, moveX: 0, moveZ: 0, yaw, targetId: BALL_ID });
}
/** Where a ball leaving now comes down (its first floor or net contact), flown by the match's own physics. */
function lands(ball: BallState) {
  const b = { ...ball }, contacts: BallContact[] = [];
  for (let t = 0; t < 4; t += 1 / 60) {
    contacts.length = 0; stepBall('sky-spike', b, 1 / 60, contacts);
    const c = contacts.find(k => k.kind === 'floor' || k.kind === 'net');
    if (c) return { x: b.x, z: b.z, kind: c.kind, t };
  }
  return { x: b.x, z: b.z, kind: 'air', t: 4 };
}
/** The forecaster beside the room for one seat, on the room's own ball and body (touchForecast.test's way). */
function forecaster(m: BallMatch, id: string) {
  const f = new TouchForecaster(), M = m as unknown as { sim: { serverTime: number; actors: Map<string, LocalFighter> } };
  const world = () => ({ view: m.view, selfId: id, players: m.sim.playerStates() });
  return {
    body: (dt = 1 / 60) => f.after(M.sim.actors.get(id)!, M.sim.serverTime, dt, { ...m.ball }, world()),
    blow: (b: ExternalBlow) => f.blow(M.sim.actors.get(id)!, b, M.sim.serverTime, { ...m.ball }, world()),
  };
}

describe('the stick as the button was pressed', () => {
  it('Sky Spike: a BACK SET pressed with the stick across is a BACK SET though the stick was let go before the contact, in the room and in the forecast', () => {
    const m = pair('sky-spike');
    rally(m, 'red', 1, { x: 2.5, y: 2.4, z: -4.5, vy: -2, shot: 'bump' });
    const a = put(m, 'red-1', { x: 2.5, z: -5 }, 0);
    // Red faces +z; the stick toward -x as the light is pressed - across the court from the setter - then let go.
    press(m, 'red-1', 'light', { x: -1, z: 0 }, 0);
    expect(a.attackMoveX).toBe(-1); expect(a.input.moveX).toBe(0);
    const fc = forecaster(m, 'red-1').blow(blow('red-1', 'light'));
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'light'));
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'set', text: 'BACK SET', actorId: 'red-1' });
    expect(fc).not.toBeNull();
    expect(Math.hypot(fc!.ball.vx - m.ball.vx, fc!.ball.vy - m.ball.vy, fc!.ball.vz - m.ball.vz)).toBeLessThan(.05);
  });
  it('Sky Spike: the press without the stick is the floating set, though the stick is held across at the contact', () => {
    const m = pair('sky-spike');
    rally(m, 'red', 1, { x: 2.5, y: 2.4, z: -4.5, vy: -2, shot: 'bump' });
    const a = put(m, 'red-1', { x: 2.5, z: -5 }, 0);
    m.submit('red-1', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'light', targetId: BALL_ID });
    m.submit('red-1', { seq: 2, moveX: -1, moveZ: 0, yaw: 0, targetId: BALL_ID });
    expect(a.input.moveX).toBe(-1);
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'light'));
    expect(m.ball.shot).toBe('set');
    expect(m.view.events.some(e => e.kind === 'set')).toBe(false);
  });
  it('Goal Rush: a special curls the way the stick was pressed, whatever it is at the contact', () => {
    const spin = (x: number) => {
      const m = pair('goal-rush');
      put(m, 'red-1', { x: 0, z: -2 }, 0);
      Object.assign(m.ball, { x: 0, y: .4, z: -1.1, vx: 0, vy: 0, vz: 0, held: false, heat: .5, lastId: null, lastTeam: null });
      press(m, 'red-1', 'special', { x, z: 0 }, 0);
      m.receive(m.locate(BALL_ID)!, blow('red-1', 'special'));
      return Math.sign(m.ball.sy);
    };
    const one = spin(1), other = spin(-1);
    expect(one).not.toBe(0); expect(other).toBe(-one);
  });
});

describe('a body\'s touch and its own swing a breath later are one touch (DOUBLE)', () => {
  /** Red's body meets a ball of blue's on its own side (Sky Spike: the automatic bump, red's first touch), then red's
   *  light lands `after` seconds on. */
  function bumpThenSwing(after: number, touches = 0, slot: ExternalBlow['slot'] = 'light', mashing = false) {
    const m = pair('sky-spike'), fc = forecaster(m, 'red-1');
    rally(m, touches ? 'red' : 'blue', touches || 3, { x: 0, y: 1.2, z: -4.3, vz: -5, vy: -.5, shot: touches ? 'set' : 'spike' });
    put(m, 'red-1', { x: 0, z: -5 }, 0);
    const forecastBody = fc.body();
    inside(m).bodyContacts(1 / 60);
    const bumped = { touches: m.view.touches, seat: m.seats.get('red-1')!.touches };
    m.sim.serverTime += after;
    // (A flurry of presses just before: MASHED.)
    if (mashing) (m as unknown as { pressedAt: Map<string, number[]> }).pressedAt.set('red-1', [.3, .2, .1].map(d => m.sim.serverTime - d));
    const forecastBlow = fc.blow(blow('red-1', slot));
    m.receive(m.locate(BALL_ID)!, blow('red-1', slot));
    return { m, bumped, forecastBody, forecastBlow };
  }
  it('Sky Spike: a swing landing just after the body\'s bump is that touch - one of the three, one on the card', () => {
    const { m, bumped } = bumpThenSwing(DOUBLE.window * .7);
    expect(bumped.touches).toBe(1);
    expect(m.view.touches).toBe(1);
    expect(m.seats.get('red-1')!.touches).toBe(bumped.seat);
    // The swing plays the ball: its own keep, the first touch's bump to the middle.
    expect(m.ball.shot).toBe('bump'); expect(m.ball.lastId).toBe('red-1');
  });
  it('Sky Spike: a swing landing later than the window is a touch of its own, as it always was', () => {
    const { m, bumped } = bumpThenSwing(DOUBLE.window + .1);
    expect(m.view.touches).toBe(bumped.touches + 1);
    expect(m.seats.get('red-1')!.touches).toBe(bumped.seat + 1);
  });
  it('Sky Spike: a swing out of a flurry of presses is no part of the body\'s touch - a touch of its own (MASHED)', () => {
    const { m, bumped } = bumpThenSwing(DOUBLE.window * .7, 0, 'light', true);
    expect(m.view.touches).toBe(bumped.touches + 1);
  });
  it('Sky Spike: the body\'s third touch then the hitter\'s own swing is no FOUR TOUCHES - the swing plays the third', () => {
    const { m } = bumpThenSwing(DOUBLE.window * .5, 2, 'heavy');
    expect(m.view.events.some(e => e.kind === 'touches')).toBe(false);
    expect(m.view.touches).toBe(3); expect(m.view.phase).toBe('live');
    // Sent over by the swing: toward blue's court.
    expect(m.ball.vz).toBeGreaterThan(2);
  });
  it('the page\'s forecast counts it once too: its bump, then the swing as that touch, as the room plays it', () => {
    const { m, forecastBody, forecastBlow } = bumpThenSwing(DOUBLE.window * .7);
    expect(forecastBody?.kind).toBe('bump');
    expect(forecastBlow).not.toBeNull();
    expect(Math.hypot(forecastBlow!.ball.vx - m.ball.vx, forecastBlow!.ball.vy - m.ball.vy, forecastBlow!.ball.vz - m.ball.vz)).toBeLessThan(.05);
    const third = bumpThenSwing(DOUBLE.window * .5, 2, 'heavy');
    expect(third.forecastBlow).not.toBeNull();
    expect(Math.hypot(third.forecastBlow!.ball.vx - third.m.ball.vx, third.forecastBlow!.ball.vz - third.m.ball.vz)).toBeLessThan(.05);
  });
  it('Goal Rush: a body\'s bounce then its own strike a breath later is one touch on the card', () => {
    const touches = (after: number) => {
      const m = pair('goal-rush');
      put(m, 'red-1', { x: 0, z: -2 }, 0);
      Object.assign(m.ball, { x: 0, y: 1, z: -1.3, vx: 0, vy: 0, vz: -6, held: false, heat: .5, lastId: 'blue-1', lastTeam: 'blue' });
      inside(m).bodyContacts(1 / 60);
      const body = m.seats.get('red-1')!.touches;
      m.sim.serverTime += after;
      m.receive(m.locate(BALL_ID)!, blow('red-1', 'heavy'));
      return { body, after: m.seats.get('red-1')!.touches };
    };
    const soon = touches(DOUBLE.window * .7), late = touches(DOUBLE.window + .1);
    expect(soon.body).toBe(1); expect(soon.after).toBe(1);
    expect(late.after).toBe(2);
  });
});

describe('Sky Spike\'s PLACEMENT (strike.ts PLACE)', () => {
  const set = { x: 1, y: 4.6, z: -1.2, vx: 0, vy: -1, vz: 0, sx: 0, sy: 0, sz: 0, heat: 1, held: false, frozenUntil: 0, clash: 0, size: 1, lastId: 'red-2', lastTeam: 'red', shot: 'set', super: false, link: null } as unknown as BallState;
  /** Red's spike off a set at the net (or a serve from behind the baseline), the stick (world x, toward the far court)
   *  as pressed. */
  const hit = (stick: { a: number; f: number }, o: { perfect?: boolean; serve?: 'float' | 'jump' } = {}) => {
    const serve = o.serve, ball = serve ? { ...set, x: 0, y: serve === 'jump' ? 4.4 : 1.5, z: -11.6, held: true, shot: null } as unknown as BallState : { ...set };
    const r = strikeBall(ball, { mode: 'sky-spike', slot: serve === 'float' ? 'light' : 'heavy', move: MOVE, knockback: 4, launch: false, finisher: false, pushX: 0, pushZ: 1, touches: 3, serve: !!serve, perfect: o.perfect,
      striker: { id: 'red-1', team: 'red', x: ball.x, y: serve === 'jump' ? 3.2 : serve ? 0 : 3.5, z: ball.z - .6, grounded: serve === 'float', aimYaw: 0, awakened: false, forward: stick.f, lateral: -stick.a, chain: 0 } });
    return { r, at: lands({ ...ball, held: false, vx: r.vx, vy: r.vy, vz: r.vz, sx: r.sx, sy: r.sy, sz: r.sz }) };
  };
  it('reads the stick as a square: a keyboard\'s diagonal reaches its corner, inside the dead zone nothing', () => {
    const s = (mx: number, mz: number) => placement({ id: 'p', team: 'red', x: 0, y: 0, z: 0, grounded: false, aimYaw: 0, awakened: false, forward: mz, lateral: -mx, chain: 0 }, 'red');
    expect(s(Math.SQRT1_2, Math.SQRT1_2)).toEqual({ a: 1, f: 1 });
    expect(s(0, 0)).toBeUndefined(); expect(s(.1, .15)).toBeUndefined();
    // Blue attacks toward -z: its stick toward the far court is -z.
    expect(placement({ id: 'p', team: 'blue', x: 0, y: 0, z: 0, grounded: false, aimYaw: Math.PI, awakened: false, forward: 1, lateral: 0, chain: 0 }, 'blue')).toEqual({ a: expect.closeTo(0, 6), f: 1 });
  });
  it('lands a spike in the zone the stick picked, every one inside the court; let go, where the aim sends it', () => {
    const neutral = hit({ a: 0, f: 0 }).at;
    expect(neutral.kind).toBe('floor'); expect(neutral.z).toBeGreaterThan(3.5); expect(neutral.z).toBeLessThan(6.5); expect(Math.abs(neutral.x - set.x)).toBeLessThan(1);
    for (const perfect of [false, true]) for (const a of [-1, 0, 1]) for (const f of [-1, 0, 1]) {
      if (!a && !f) continue;
      const { at } = hit({ a, f }, { perfect }), tag = JSON.stringify({ a, f, perfect, at });
      expect(at.kind, tag).toBe('floor');
      expect(Math.abs(at.x), tag).toBeLessThan(SPIKE_RULES.courtHalfX - .3); expect(at.z, tag).toBeLessThan(SPIKE_RULES.courtHalfZ - .3); expect(at.z, tag).toBeGreaterThan(1);
      if (a) expect(Math.sign(at.x) === a && Math.abs(at.x) > PLACE.x.spike - 1, tag).toBe(true);
      if (f > 0) expect(at.z, tag).toBeGreaterThan(PLACE.deep.spike - 1);
      if (f < 0) expect(at.z, tag).toBeLessThan(neutral.z - 1);
    }
  });
  it('cuts short as sharply as the height allows, at a spike\'s pace - never a lob to the baseline', () => {
    const cut = hit({ a: 0, f: -1 }), deep = hit({ a: 0, f: 1 });
    expect(cut.at.z).toBeLessThan(4.5);
    expect(Math.hypot(cut.r.vx, cut.r.vy, cut.r.vz)).toBeGreaterThan(18);
    expect(deep.at.t).toBeGreaterThan(cut.at.t);
  });
  it('places a serve the same way, inside the court: deep, short or to a side', () => {
    for (const serve of ['float', 'jump'] as const) for (const a of [-1, 0, 1]) for (const f of [-1, 0, 1]) {
      const { at } = hit({ a, f }, { serve, perfect: serve === 'jump' }), tag = JSON.stringify({ serve, a, f, at });
      expect(at.kind, tag).toBe('floor');
      expect(Math.abs(at.x), tag).toBeLessThan(SPIKE_RULES.courtHalfX); expect(at.z, tag).toBeLessThan(SPIKE_RULES.courtHalfZ); expect(at.z, tag).toBeGreaterThan(1);
      if (a) expect(Math.sign(at.x), tag).toBe(a);
      if (f < 0) expect(at.z, tag).toBeLessThan((serve === 'float' ? SERVE_STYLE.floatDeep : SERVE_STYLE.jumpDeep) - 1);
    }
  });
  it('the room places the person\'s spike as pressed, and the forecast with it', () => {
    const m = pair('sky-spike');
    rally(m, 'red', 2, { x: 0, y: 5.9, z: -1.4, shot: 'set' });
    put(m, 'red-1', { x: 0, z: -2 }, 0, 1);
    // The stick toward the far court's right corner (world +x, +z) as the spike is pressed.
    press(m, 'red-1', 'heavy', { x: Math.SQRT1_2, z: Math.SQRT1_2 }, 0);
    const fc = forecaster(m, 'red-1').blow(blow('red-1', 'heavy'));
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'heavy'));
    const at = lands(m.ball);
    expect(at.x).toBeGreaterThan(PLACE.x.spike - 1); expect(at.z).toBeGreaterThan(PLACE.deep.spike - 1);
    expect(Math.hypot(fc!.ball.vx - m.ball.vx, fc!.ball.vy - m.ball.vy, fc!.ball.vz - m.ball.vz)).toBeLessThan(.05);
  });
});
