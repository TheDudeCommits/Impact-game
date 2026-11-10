import {describe, expect, it} from 'vitest';
import {BallMatch} from './BallMatch';
import {TouchForecaster, type LocalFighter} from './touchForecast';
import type {BallModeId, BallState} from './model';
import type {ExternalBlow} from '../simulation';

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
  const rows: {kind: string; forecast: boolean; dv: number; speed: number; rolled: boolean}[] = [];
  const received = M.received.bind(m);
  M.received = (blow, claim) => {
    if (blow.attackerId !== 'p') return received(blow, claim);
    const before = {...M.ball}, fc = f.blow(me(), blow, M.sim.serverTime, before, world()), out = received(blow, claim), b = M.ball;
    const rolled = before.held && mode === 'sky-spike' && !me().state.grounded || before.shot === 'serve';
    if (out && Math.hypot(b.vx - before.vx, b.vy - before.vy, b.vz - before.vz) > .5) rows.push({kind: 'blow', forecast: !!fc, dv: fc ? Math.hypot(fc.ball.vx - b.vx, fc.ball.vy - b.vy, fc.ball.vz - b.vz) : NaN, speed: Math.hypot(b.vx, b.vy, b.vz), rolled});
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
