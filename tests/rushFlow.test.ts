import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { MOVES, RUSH_STAGES } from '../src/game/moves';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

/** Round 2: a mashed rush never falls back to the idle stance between its
 *  stages. The review capture caught Gummy standing idle between Stamp and
 *  Rifle while the player mashed: the server saw Stamp miss, so the Rifle it
 *  had already been pressed for came out only when the missed Stamp ended -
 *  later than the client had predicted - and the client's playback clock for
 *  that Rifle, anchored to its own early start, ran out while the corrected
 *  Rifle was still being thrown. The drawn body dropped to idle for the
 *  difference. Separately, every stage that missed handed over to the next
 *  through one tick of idle. */
const ROSTER = Object.keys(MOVES) as FighterId[];


/** The client pipeline of tests/rush.test.ts's rollback case, with the local
 *  fighter's copy of the world a round trip behind the server's. */
function pipeline(fighter: FighterId, delay: number, press: (tick: number) => boolean, meddle?: (server: ArenaSimulation, tick: number) => void) {
  const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
  server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('foe', 'taisei', 'Foe', false, { x: 0, y: 0, z: 1.6 });
  const prediction = new Prediction(), queue = new InputQueue();
  prediction.start('me', server.snapshot(true, true));
  const up: { tick: number; input: PlayerInput }[] = [], down: { tick: number; s: GameSnapshot }[] = [];
  const frames: { tick: number; drawn: string; drawnTime: number; local: string; chain?: number }[] = [];
  const serverEvents: CombatEvent[] = [];
  const local = () => (prediction as unknown as { sim: ArenaSimulation }).sim;
  for (let tick = 0; tick < 170; tick++) {
    const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: press(tick) ? 'light' : undefined };
    prediction.submit(input); up.push({ tick: tick + delay, input });
    while (up.length && up[0].tick <= tick) queue.push(up.shift()!.input);
    const next = queue.take(); if (next) server.submitInput('me', next);
    meddle?.(server, tick);
    server.step(1 / 60, new Set(next ? [] : ['me']));
    if (tick % 2 === 0) { const snapshot = server.snapshot(true, true); serverEvents.push(...snapshot.events); down.push({ tick: tick + delay, s: snapshot }); }
    while (down.length && down[0].tick <= tick) prediction.reconcile(down.shift()!.s);
    const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    frames.push({ tick, drawn: shown.action, drawnTime: shown.actionTime, local: local().actors.get('me')!.state.action, chain: shown.chain });
  }
  prediction.stop(); server.dispose();
  return { frames, serverEvents };
}

describe('a mashed string as the client draws it', () => {
  it('holds a swing the server started late on its last frame instead of dropping to idle while it is still thrown', () => {
    // The first stage lands on the client's copy, which carries the one
    // follow-up press straight into stage 1; on the server the victim has
    // dashed out of it, stage 0 misses, and stage 1 comes out only when it
    // ends - a quarter of a second after the client began drawing it.
    for (const delay of [15, 18]) {
      let foe = 1e6;
      const run = pipeline('gummy', delay, tick => tick === 0 || tick === 4,
        (server, tick) => { if (tick === 16) server.submitInput('foe', { seq: foe++, moveX: 1, moveZ: 0, yaw: Math.PI, dash: true }); });
      const serverHits = run.serverEvents.filter(e => e.kind === 'hit' && e.actorId === 'me');
      expect(serverHits, 'the server saw the stage miss').toHaveLength(0);
      const idleWhileThrown = run.frames.filter(f => f.drawn === 'idle' && f.local === 'light');
      expect(idleWhileThrown.map(f => f.tick), `delay ${delay}: idle drawn while the swing still runs`).toEqual([]);
      // And it is held, not replayed: the drawn clock never runs backwards
      // within the stage.
      for (let i = 1; i < run.frames.length; i++) {
        const [a, b] = [run.frames[i - 1], run.frames[i]];
        if (a.drawn === 'light' && b.drawn === 'light' && a.chain === b.chain && b.drawnTime < a.drawnTime - 1e-9 && b.drawnTime > .05) {
          throw new Error(`delay ${delay}: stage ${b.chain} rewound at tick ${b.tick}`);
        }
      }
    }
  });

  it('never draws the idle stance between two stages of Gummy\'s mashed string when the server sees a stage miss', () => {
    // Pistol, Whip, Stamp, Rifle, mashed at the review capture's rhythm; the
    // victim is knocked clear of Stamp on the server only, so the client has
    // predicted it landing and its Rifle early.
    for (const shoveAt of [34, 40, 46]) {
      const run = pipeline('gummy', 12, tick => tick % 13 === 0 && tick < 120,
        (server, tick) => { if (tick === shoveAt) { const foe = server.actors.get('foe')!; foe.state.x += 3.5; } });
      const stages = run.frames.map(f => f.drawn === 'light' ? `light#${f.chain}` : f.drawn);
      // Between the first and the last stage of the string, nothing but stages.
      const first = stages.indexOf('light#0'), last = stages.lastIndexOf('light#3');
      expect(first).toBeGreaterThanOrEqual(0);
      if (last > first) {
        const between = stages.slice(first, last).filter(s => s === 'idle' || s === 'run');
        expect(between, `shoved at ${shoveAt}: idle between stages`).toEqual([]);
      }
      const idleWhileThrown = run.frames.filter(f => f.drawn === 'idle' && f.local === 'light');
      expect(idleWhileThrown.map(f => f.tick), `shoved at ${shoveAt}`).toEqual([]);
    }
  });
});
