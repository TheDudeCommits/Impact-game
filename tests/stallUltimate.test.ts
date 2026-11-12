import { describe, expect, it } from 'vitest';
import { Packr, unpack } from 'msgpackr';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { catchUp } from '../src/game/catchUp';
import { MOVES } from '../src/game/moves';
import type { FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

/**
 * Round 3c, LOCK: a brief client stall never costs an ultimate.
 *
 * The second blind critic's harness took screenshots through Gummy's and
 * Nigo's ultimates, and both did nothing; without the screenshots both hit
 * for 295. A page that stops sending stops feeding the server's queue for
 * that player, and the server holds their personal clock meanwhile - the
 * running move's with it - so that one command stays one tick. That hold is
 * bounded (0.35 s, so withholding packets cannot freeze a wind-up), and past
 * the bound the move was THROWN AWAY: a 0.4 s hitch, or four 0.15 s ones
 * spread over Spring Tide's five-second wind-up, and the ultimate - its bar
 * already spent - was gone. Past the bound the move now plays out on the
 * world's clock instead, and a press waiting for the move to end waits with
 * it.
 */
const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;
const HP = 1000;

function duel(fighter: FighterId, distance = 2.2) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 4 });
  sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('foe', 'konta', 'Foe', false, { x: 0, y: 0, z: distance });
  sim.trainingCommand('me', 'awakening');
  return sim;
}
/** Server-side: one command a tick, except through the stalls (tick ranges
 *  in which nothing arrives and the server waits on this player). */
function serve(sim: ArenaSimulation, ticks: number, press: Record<number, PlayerInput['attack']>, stalls: [number, number][] = [], lock = false) {
  let seq = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const starved = stalls.some(([from, to]) => tick >= from && tick < to);
    if (!starved) sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', lock, attack: press[tick] });
    sim.step(1 / 60, new Set(starved ? ['me'] : []));
  }
}
const hp = (sim: ArenaSimulation, id: string) => sim.getPlayer(id)!.hp;
const ULTIMATES: FighterId[] = ['gummy', 'nigo', 'ouga', 'kenzo', 'gaunt', 'taisei'];

describe('an ultimate is never lost to a client stall', () => {
  it.each(ULTIMATES)('%s: landed without a stall (the reference)', fighter => {
    const sim = duel(fighter);
    try { serve(sim, 60 * 9, { 2: 'ultimate' }); expect(hp(sim, 'foe')).toBeLessThan(HP); } finally { sim.dispose(); }
  });

  for (const ms of [200, 400, 800])
    it.each(ULTIMATES)(`%s: a ${ms} ms stall just after the press`, fighter => {
      const reference = duel(fighter), sim = duel(fighter);
      try {
        serve(reference, 60 * 9, { 2: 'ultimate' });
        // Three commands of warm buffer reach the server before the gap.
        serve(sim, 60 * 9, { 2: 'ultimate' }, [[5, 5 + Math.round(ms * .06)]]);
        expect(hp(sim, 'foe'), 'the ultimate still lands, whole').toBe(hp(reference, 'foe'));
        expect(sim.getPlayer('me')!.ultimate, 'and the bar it cost stays spent').toBe(0);
      } finally { reference.dispose(); sim.dispose(); }
    });

  it.each(ULTIMATES)('%s: four 0.15 s stalls through the wind-up (screenshots)', fighter => {
    const reference = duel(fighter), sim = duel(fighter);
    try {
      serve(reference, 60 * 9, { 2: 'ultimate' });
      serve(sim, 60 * 9, { 2: 'ultimate' }, [[20, 29], [50, 59], [80, 89], [110, 119]]);
      expect(hp(sim, 'foe')).toBe(hp(reference, 'foe'));
    } finally { reference.dispose(); sim.dispose(); }
  });

  it('a press waiting on a move that is held for the network waits with it, and still goes off', () => {
    // Nigo swings at the air (the foe is 5 m off), presses NIGHTFALL in the
    // swing, and the page stalls: the light is held, then plays out, and
    // the ultimate follows it.
    for (const stall of [[12, 24], [12, 60]] as [number, number][]) {
      const sim = duel('nigo', 5);
      try {
        serve(sim, 60 * 8, { 2: 'light', 8: 'ultimate' }, [stall]);
        expect(hp(sim, 'foe'), `stall ${stall}`).toBeLessThan(HP);
      } finally { sim.dispose(); }
    }
  });

  it('withholding packets still cannot freeze a wind-up: past 0.35 s the move runs on the world\'s clock', () => {
    const sim = duel('gummy'), a = sim.actors.get('me')!;
    try {
      serve(sim, 3, { 1: 'ultimate' });
      const cast = a.cast!;
      expect(cast.move.name).toBe(MOVES.gummy.ultimate.name);
      for (let i = 0; i < 60 * 3; i++) sim.step(1 / 60, new Set(['me']));
      expect(a.cast, 'still running').toBe(cast);
      expect(cast.networkHold!, 'held no longer than the bound').toBeLessThanOrEqual(.35 + 1e-9);
      // Round 3d: the opener lands at 0.5 and the cinematic's blows follow,
      // so the move's clock is also held for their impact freezes - which
      // are the fighter's own frozen time less the network's.
      const freezes = (a.state.actionFrozen ?? 0) - cast.networkHold!;
      expect(freezes).toBeLessThan(.6);
      expect(sim.serverTime - cast.start, 'and the rest of the gap spent on the move').toBeGreaterThan(3 - .35 - .05 - freezes);
    } finally { sim.dispose(); }
  });

  it('a stalled client and the server agree on the ultimate after the burst (rollback replay)', () => {
    // The page stops for 0.4 s after pressing Spring Tide, sends a catch-up
    // burst, and goes on. The server's queue, the local prediction and the
    // reconcile run as in the browser.
    for (const fighter of ['gummy', 'nigo'] as FighterId[]) {
      const server = duel(fighter), prediction = new Prediction(), queue = new InputQueue();
      prediction.start('me', wire(server.snapshot(false, true)));
      const local = (prediction as unknown as { sim: ArenaSimulation }).sim;
      try {
        let seq = 0, backlog = 0;
        const upload: { at: number; input: PlayerInput }[] = [], download: { at: number; s: GameSnapshot }[] = [];
        for (let tick = 0; tick < 60 * 10; tick++) {
          // The browser: stalled from tick 8 to 32 (0.4 s); afterwards the
          // missed time is caught up in whole ticks (catchUp).
          const stalled = tick >= 8 && tick < 32;
          if (!stalled) {
            const due = catchUp(backlog, tick === 32 ? .4 + 1 / 60 : 1 / 60);
            backlog = due.backlog;
            for (let k = 0; k < due.steps; k++) {
              const n = seq++;
              const input: PlayerInput = { seq: n, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', lock: false, attack: n === 4 ? 'ultimate' : undefined };
              prediction.submit(input); upload.push({ at: tick + 4, input });
            }
          }
          while (upload.length && upload[0].at <= tick) queue.push(upload.shift()!.input);
          const next = queue.take();
          if (next) server.submitInput('me', next);
          server.step(1 / 60, new Set(next ? [] : ['me']));
          if (tick % 2 === 0) download.push({ at: tick + 4, s: wire(server.snapshot(false, true)) });
          while (download.length && download[0].at <= tick && !stalled) prediction.reconcile(download.shift()!.s);
        }
        expect(hp(server, 'foe'), `${fighter}: the server lands it`).toBeLessThan(HP);
        const reference = duel(fighter);
        serve(reference, 60 * 10, { 4: 'ultimate' });
        expect(hp(server, 'foe'), `${fighter}: for its whole damage`).toBe(hp(reference, 'foe'));
        expect(hp(local, 'foe'), `${fighter}: and the local copy agrees`).toBe(hp(server, 'foe'));
        reference.dispose();
      } finally { prediction.stop(); server.dispose(); }
    }
  });
});
