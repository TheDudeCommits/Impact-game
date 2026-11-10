import {describe, expect, it} from 'vitest';
import {BallMatch} from './BallMatch';
import {TouchForecaster, type LocalFighter} from './touchForecast';
import {BALL_ID, type BallModeId, type BallState} from './model';
import type {ExternalBlow} from '../simulation';
import type {PlayerInput} from '../types';

/** The page's forecast of its own touch (touchForecast.ts) against what the room makes of the same touch. A
 *  FREE PLAY match with one seat played by a bot (so the ball's every change is that seat's), the forecaster run beside
 *  the room on the room's own ball and body, tick by tick, as the page runs it beside its prediction. Each touch the
 *  room makes is compared with the forecast's: the velocity it sends the ball off with. (The room's rolls - an off-time
 *  JUMP SERVE's spray, a shank - are the forecast's middle of the roll, so those miss by design and are counted apart.) */
function compare(mode: BallModeId, seconds: number, seed: number, fighter = 'konta', practice = true) {
  const m = new BallMatch(mode, {seed, access: 'bots', intro: false, practice} as never);
  m.add('p', fighter as never, 'P', false, 'red'); m.pilot('p'); m.start();
  const M = m as unknown as {sim: {serverTime: number; actors: Map<string, LocalFighter>; playerStates(): import('../types').PlayerState[]}; ball: BallState; view: import('./model').BallView;
    received(blow: ExternalBlow, claim?: unknown): unknown; bodyContacts(dt: number): void; last: Map<string, {vx: number; vz: number}>};
  const f = new TouchForecaster(), me = () => M.sim.actors.get('p')!, world = () => ({view: M.view, selfId: 'p', players: M.sim.playerStates(), run: (id: string) => M.last.get(id)});
  const rows: {kind: string; forecast: boolean; dv: number; speed: number; rolled: boolean; strike?: 'tap' | 'charge'; clash?: boolean}[] = [];
  const received = M.received.bind(m);
  M.received = (blow, claim) => {
    if (blow.attackerId !== 'p') return received(blow, claim);
    const before = {...M.ball}, fc = f.blow(me(), blow, M.sim.serverTime, before, world()), out = received(blow, claim), b = M.ball;
    const rolled = before.held && mode === 'sky-spike' && !me().state.grounded || before.shot === 'serve';
    if (out && Math.hypot(b.vx - before.vx, b.vy - before.vy, b.vz - before.vz) > .5) rows.push({kind: 'blow', forecast: !!fc, dv: fc ? Math.hypot(fc.ball.vx - b.vx, fc.ball.vy - b.vy, fc.ball.vz - b.vz) : NaN, speed: Math.hypot(b.vx, b.vy, b.vz), rolled, strike: blow.strike, clash: b.clash > M.sim.serverTime});
    return out;
  };
  const body = M.bodyContacts.bind(m);
  M.bodyContacts = dt => {
    const before = {...M.ball}, fc = f.after(me(), M.sim.serverTime, dt, before, world());
    body(dt);
    const b = M.ball, changed = Math.hypot(b.vx - before.vx, b.vy - before.vy, b.vz - before.vz) > 1.5;
    if (practice && (changed || fc)) rows.push({kind: fc?.kind ?? 'body?', forecast: !!fc, dv: fc ? Math.hypot(fc.ball.vx - b.vx, fc.ball.vy - b.vy, fc.ball.vz - b.vz) : NaN, speed: Math.hypot(b.vx, b.vy, b.vz), rolled: before.shot === 'serve'});
  };
  for (let i = 0; i < seconds * 60; i++) { if (me()) f.before(me()); m.step(1 / 60); }
  return rows;
}

describe('the page\'s forecast of its own touch', () => {
  for (const mode of ['goal-rush', 'sky-spike'] as const) it(`sends the ball where the room sends it (${mode})`, () => {
    // (FREE PLAY, the seat alone with the ball; and a match of bots, three a side - its passes lead running team-mates.)
    const rows = [...compare(mode, 50, 3), ...compare(mode, 50, 8, 'gorai'), ...compare(mode, 50, 11, 'taisei'), ...compare(mode, 60, 21, 'konta', false)];
    const blows = rows.filter(r => r.kind === 'blow' && !r.rolled), body = rows.filter(r => r.kind !== 'blow' && !r.rolled);
    const close = (r: typeof rows[number]) => r.forecast && r.dv < .05;
    const share = (a: typeof rows) => a.length ? a.filter(close).length / a.length : 1;
    const summary = {mode, blows: blows.length, blowsRight: +share(blows).toFixed(2), body: body.length, bodyRight: +share(body).toFixed(2),
      bodyMissed: body.filter(r => !r.forecast).length, bodyFalse: body.filter(r => r.forecast && r.dv > 1).length};
    expect(blows.length, JSON.stringify(summary)).toBeGreaterThan(20);
    expect(share(blows), JSON.stringify(summary)).toBeGreaterThan(.9);
    expect(share(body), JSON.stringify(summary)).toBeGreaterThan(.75);
  }, 120_000);
});

/** A guard met by the ball, staged: Sky Spike's blocker at the net with a spike coming at the hands, Goal Rush's keeper on
 *  the line with a shot coming at them - the guard pressed just before (a STUFF BLOCK, a PERFECT SAVE) or long before
 *  (a BLOCK, a save) - forecast beside the room and compared. (A soft BLOCK's lob is the middle of the room's roll.) */
function guarded(mode: BallModeId, sinceGuard: number) {
  const m = new BallMatch(mode, {seed: 3, access: 'bots', intro: false, practice: true} as never);
  m.add('p', 'konta', 'P', false, 'red'); m.start();
  const M = m as unknown as {sim: {serverTime: number; actors: Map<string, LocalFighter>; playerStates(): import('../types').PlayerState[]}; ball: BallState; view: import('./model').BallView; bodyContacts(dt: number): void};
  const f = new TouchForecaster(), me = () => M.sim.actors.get('p')!, world = () => ({view: M.view, selfId: 'p', players: M.sim.playerStates()});
  for (let i = 0; i < 400 && M.view.phase !== 'live'; i++) m.step(1 / 60);
  const spike = mode === 'sky-spike', at = spike ? {x: 0, z: -1.15} : {x: 0, z: -17.6};
  (m as unknown as {sim: {place(id: string, at: {x: number; y: number; z: number}, yaw: number): void}}).sim.place('p', {...at, y: 0}, 0);
  let seq = 0, out: {room: BallState; forecast: BallState | null} | null = null;
  const body = M.bodyContacts.bind(m);
  M.bodyContacts = dt => {
    const before = {...M.ball}, fc = f.after(me(), M.sim.serverTime, dt, before, world());
    body(dt);
    if (!out && (fc || Math.hypot(M.ball.vx - before.vx, M.ball.vy - before.vy, M.ball.vz - before.vz) > 1.5)) out = {room: {...M.ball}, forecast: fc?.ball ?? null};
  };
  // (The guard goes up `sinceGuard` before the ball is let go at the hands - a few ticks from them - and stays up.)
  const tick = (guard: boolean) => { m.submit('p', {seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, guard} as never); f.before(me()); m.step(1 / 60); };
  for (let i = 0; i < 20; i++) tick(false);
  for (let i = 0; i < Math.round(sinceGuard * 60); i++) tick(true);
  m.feed(spike ? {ball: {x: 0, y: 3, z: -.1, vx: 0, vy: -2, vz: -10}, team: 'blue', touchTeam: 'blue', touches: 3}
    : {ball: {x: 0, y: 1.2, z: -14, vx: 0, vy: 1, vz: -18}, team: 'blue'});
  for (let i = 0; i < 90 && !out; i++) tick(true);
  return out as {room: BallState; forecast: BallState | null} | null;
}

/** SHOOT's two ways (model.ts SHOOT), staged in FREE PLAY - the ball held still a stride ahead on the floor
 *  (or, `air`, level with the chest of a body on its way up) - the key let go at once (the quick strike) or kept down
 *  `held` ticks (the fighter's own heavy, wound up as far as the key stayed down); the forecast of the blow beside the
 *  room's own strike of it. */
function shoot(mode: BallModeId, fighter: string, held: number, air = false) {
  const m = new BallMatch(mode, {seed: 3, access: 'bots', intro: false, practice: true} as never);
  m.add('p', fighter as never, 'P', false, 'red'); m.start();
  const M = m as unknown as {sim: {serverTime: number; actors: Map<string, LocalFighter>; playerStates(): import('../types').PlayerState[]; place(id: string, at: {x: number; y: number; z: number}, yaw: number): void; clearPlayerInput(id: string): void};
    ball: BallState; view: import('./model').BallView; received(blow: ExternalBlow, claim?: unknown): unknown; bodyContacts(dt: number): void; last: Map<string, {vx: number; vz: number}>};
  const f = new TouchForecaster(), me = () => M.sim.actors.get('p')!, world = () => ({view: M.view, selfId: 'p', players: M.sim.playerStates(), run: (id: string) => M.last.get(id)});
  for (let i = 0; i < 600 && M.view.phase !== 'live'; i++) m.step(1 / 60);
  // (The forecaster's own bookkeeping each tick, as the page's prediction runs it: the body's run among it.)
  const body = M.bodyContacts.bind(m);
  M.bodyContacts = dt => { f.after(me(), M.sim.serverTime, dt, {...M.ball}, world()); body(dt); };
  const radius = mode === 'goal-rush' ? .8 : .5, z0 = mode === 'goal-rush' ? -6 : -5, b = M.ball;
  M.sim.place('p', {x: 0, y: 0, z: z0}, 0); M.sim.clearPlayerInput('p');
  m.feed({ball: {x: 0, y: radius, z: z0 + 2, vx: 0, vy: 0, vz: 0}, team: 'red', touchTeam: 'red', touches: 2});
  let out = null as {room: BallState; forecast: BallState | null; strike?: string; charge?: number} | null;
  const received = M.received.bind(m);
  M.received = (blow, claim) => {
    const before = {...M.ball}, fc = !out && blow.attackerId === 'p' ? f.blow(me(), blow, M.sim.serverTime, before, world()) : null, result = received(blow, claim);
    if (!out && blow.attackerId === 'p' && result) out = {room: {...M.ball}, forecast: fc?.ball ?? null, strike: blow.strike, charge: blow.charge};
    return result;
  };
  const hang = () => { const p = me().state; Object.assign(b, air ? {x: p.x, y: p.y + 1.3, z: p.z + 1.9} : {x: 0, y: radius, z: z0 + 2}, {vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0}); };
  let seq = 5000;
  const tick = (input: Partial<PlayerInput>) => { if (!out) hang(); m.submit('p', {seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, ...input} as PlayerInput); f.before(me()); m.step(1 / 60); };
  if (air) for (let i = 0; i < 9; i++) tick({jump: i === 0, jumpHeld: true});
  for (let i = 0; i < 100 && !out; i++) tick({attack: i === 0 ? 'heavy' : undefined, heavyHeld: i < held, jumpHeld: air});
  return out;
}

describe('the page\'s forecast of SHOOT', () => {
  it('forecasts the quick strike and the charged shot - at the charge its key reached - as the room strikes them', () => {
    for (const mode of ['goal-rush', 'sky-spike'] as const) for (const fighter of ['gorai', 'kubiwa', 'tsubute']) for (const [held, air] of [[0, false], [20, false], [200, false], [0, true], [200, true]] as const) {
      const r = shoot(mode, fighter, held, air), label = `${mode} ${fighter} held ${held}${air ? ' air' : ''}`;
      expect(r, label).not.toBeNull();
      expect(r!.strike, label).toBe(held > 12 ? 'charge' : 'tap');
      expect(r!.forecast, label).not.toBeNull();
      expect(Math.hypot(r!.forecast!.vx - r!.room.vx, r!.forecast!.vy - r!.room.vy, r!.forecast!.vz - r!.room.vz), `${label} ${JSON.stringify(r)}`).toBeLessThan(.05);
    }
  }, 120_000);
});

describe('the page\'s forecast of its own guard', () => {
  it('blocks and saves as the room does', () => {
    for (const mode of ['sky-spike', 'goal-rush'] as const) for (const since of [.08, .6]) {
      const r = guarded(mode, since), label = `${mode} ${since}`;
      expect(r, label).not.toBeNull();
      expect(r!.forecast, label).not.toBeNull();
      const soft = mode === 'sky-spike' && since > .25;
      // (The soft block's lob is rolled by the room: its height and length the forecast's middle, its line the room's.)
      expect(Math.hypot(r!.forecast!.vx - r!.room.vx, r!.forecast!.vy - r!.room.vy, r!.forecast!.vz - r!.room.vz), `${label} ${JSON.stringify(r)}`).toBeLessThan(soft ? 2 : .05);
    }
  });
});
