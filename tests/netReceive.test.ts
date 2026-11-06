import { afterEach, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { createRapierCollision } from '../src/game/rapierCollision';
import type { GameSnapshot, PlayerInput } from '../src/game/types';

/** Night net (12 October 2026): how the page takes in the snapshots the wire hands it. A connection that stalls and lets go
 *  of what it held delivers thirty snapshots in one turn of the event loop, and the page used to rewind and replay the
 *  unacknowledged commands (twenty-five at 220 ms) for every one of them: measured, 100-700 ms of one frame. Now the
 *  newest is replayed and the rest ride on it (Prediction.receive / flush). */

/** A server and a client of it. */
function wire(latencyTicks = 8, options: { collision?: Awaited<ReturnType<typeof createRapierCollision>>; serverCollision?: Awaited<ReturnType<typeof createRapierCollision>>; others?: number } = {}) {
  const server = new ArenaSimulation({ trainingBot: false, stage: 'harbor', ...(options.serverCollision ? { collision: options.serverCollision } : {}) });
  server.addPlayer('me', 'kenzo', 'Me', false, { x: 0, y: 0, z: 0 });
  const names = ['taisei', 'konta', 'gummy', 'kosho', 'ouga', 'nigo'] as const;
  for (let i = 0; i < (options.others ?? 1); i++) server.addPlayer(`them${i}`, names[i % names.length], `Them ${i}`, false, { x: (i % 3 - 1) * 4, y: 0, z: 6 + Math.floor(i / 3) * 3 });
  const prediction = new Prediction();
  // A replay that costs nothing: how long one really takes on the machine running the test must not decide how often it replays.
  prediction.clock = () => 0;
  prediction.start('me', server.snapshot(false, true), options.collision);
  let seq = 0, tick = 0;
  const queue: { at: number; input: PlayerInput }[] = [];
  const press = (more: Partial<PlayerInput> = {}) => {
    const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more };
    prediction.submit(input);
    queue.push({ at: tick + latencyTicks, input });
    return input;
  };
  const advance = () => {
    tick++;
    while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
    server.step();
  };
  const snapshot = (): GameSnapshot => server.snapshot(true, true);
  return { server, prediction, press, advance, snapshot };
}

describe('receive replays what it hears well apart exactly as reconcile does', () => {
  it('leaves the local body where reconcile leaves it, snapshot for snapshot', () => {
    const a = wire(), b = wire();
    let now = 0;
    for (let i = 0; i < 120; i++) {
      for (const w of [a, b]) { w.press({ moveZ: 1, moveX: Math.sin(i / 9) }); w.advance(); }
      if (i % 2 === 1) {
        now += 33;
        a.prediction.reconcile(a.snapshot());
        expect(b.prediction.receive(b.snapshot(), now), 'a snapshot heard 33 ms after the last is replayed at once').toBe(true);
        expect(b.prediction.diagnostics.position).toEqual(a.prediction.diagnostics.position);
        expect(b.prediction.diagnostics.offset).toEqual(a.prediction.diagnostics.offset);
      }
    }
    expect(b.prediction.folded).toBe(0);
    expect(b.prediction.replayed).toBe(60);
  });
});

describe('a burst of snapshots is replayed once', () => {
  it('replays the first, folds the rest into the newest, and keeps every event', () => {
    const w = wire();
    const heard: GameSnapshot[] = [];
    for (let i = 0; i < 40; i++) { w.press({ moveZ: 1 }); w.advance(); if (i % 2 === 1) { w.press({ attack: 'light' }); heard.push(w.snapshot()); } }
    expect(heard.length).toBe(20);
    const events = heard.flatMap(s => s.events.map(e => e.id));
    expect(events.length, 'the scenario puts events in the snapshots').toBeGreaterThan(0);
    // Twenty arrive in one turn: the stall let go of them.
    const replayed: GameSnapshot[] = [];
    const reconcile = w.prediction.reconcile.bind(w.prediction);
    w.prediction.reconcile = (s: GameSnapshot) => { replayed.push(s); reconcile(s); };
    for (const s of heard) w.prediction.receive(s, 1000);
    expect(replayed.length, 'only the first replayed on arrival').toBe(1);
    expect(w.prediction.folded).toBe(18);
    // The pump comes round a tick later (and again, if the first was too soon).
    expect(w.prediction.flush(1004), 'too soon after the last').toBe(false);
    expect(w.prediction.flush(1017)).toBe(true);
    expect(replayed.length, 'a burst of twenty is two replays').toBe(2);
    expect(replayed[1].serverTime, 'the newest is what is replayed').toBe(heard.at(-1)!.serverTime);
    expect([...replayed[0].events, ...replayed[1].events].map(e => e.id), 'every event rode on one of the two').toEqual(events);
    expect(w.prediction.flush(1100), 'nothing left').toBe(false);
  });

  it('ends where replaying each in turn ends', () => {
    const a = wire(), b = wire();
    const sa: GameSnapshot[] = [], sb: GameSnapshot[] = [];
    for (let i = 0; i < 60; i++) {
      for (const w of [a, b]) { w.press({ moveZ: 1, moveX: Math.cos(i / 7) }); w.advance(); }
      if (i % 3 === 2) { sa.push(a.snapshot()); sb.push(b.snapshot()); }
    }
    for (const s of sa) a.prediction.reconcile(s);
    for (const s of sb) b.prediction.receive(s, 500);
    b.prediction.flush(520);
    const pa = a.prediction.diagnostics.position!, pb = b.prediction.diagnostics.position!;
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z)).toBeLessThan(1e-9);
    expect(b.prediction.replayed).toBe(2);
    expect(b.prediction.diagnostics.pending).toEqual(a.prediction.diagnostics.pending);
  });

  it('forgets a snapshot it was keeping when it is stopped', () => {
    const w = wire();
    for (let i = 0; i < 10; i++) { w.press(); w.advance(); }
    w.prediction.receive(w.snapshot(), 100);
    w.prediction.receive(w.snapshot(), 101);
    w.prediction.stop();
    expect(w.prediction.flush(200)).toBe(false);
  });
});

describe('a costly replay is spared', () => {
  it('replays no more than every 50 ms once one cost 3 ms, and every snapshot while they are cheap', () => {
    for (const [cost, expectedReplays] of [[5, 5], [1, 10]] as const) {
      const w = wire();
      let t = 0;
      w.prediction.clock = () => (t += cost); // a replay reads it twice: its cost is the step between
      let now = 0;
      for (let i = 0; i < 20; i++) {
        w.press({ moveZ: 1 }); w.advance();
        if (i % 2 === 1) { now += 33; w.prediction.receive(w.snapshot(), now); w.prediction.flush(now + 16); }
      }
      expect(w.prediction.replayed, `at ${cost} ms a replay`).toBe(expectedReplays);
    }
  });
});

describe('a costly replay never spares the snapshot that carries a verdict', () => {
  it('replays at once a snapshot with an event about the local fighter, however dear the last replay was', () => {
    const w = wire();
    let t = 0;
    w.prediction.clock = () => (t += 5); // every replay costs 5 ms: the page is sparing them
    for (let i = 0; i < 8; i++) { w.press({ moveZ: 1 }); w.advance(); }
    expect(w.prediction.receive(w.snapshot(), 1000), 'the first is replayed').toBe(true);
    for (let i = 0; i < 2; i++) { w.press({ moveZ: 1 }); w.advance(); }
    expect(w.prediction.receive(w.snapshot(), 1033), 'a routine one 33 ms later is spared').toBe(false);
    for (let i = 0; i < 2; i++) { w.press({ moveZ: 1 }); w.advance(); }
    // The server says something happened to the fighter: that one is replayed as soon as the gap a burst needs is over.
    const urgent = w.snapshot();
    urgent.events.push({ id: 99999, kind: 'hit', actorId: 'them0', targetId: 'me', serverTime: urgent.serverTime } as never);
    expect(w.prediction.receive(urgent, 1066), 'a hit on the fighter is not spared').toBe(true);
    for (let i = 0; i < 2; i++) { w.press({ moveZ: 1 }); w.advance(); }
    const own = w.snapshot();
    own.events.push({ id: 100000, kind: 'blocked', actorId: 'me', targetId: 'them0', serverTime: own.serverTime } as never);
    expect(w.prediction.receive(own, 1099), 'the verdict on a blow the fighter threw is not spared').toBe(true);
  });
});

describe('a body that is standing still is not asked of the world again', () => {
  const done: Array<() => void> = [];
  afterEach(() => { ArenaSimulation.restShortcut = true; for (const d of done.splice(0)) d(); });

  /** The same match twice - once with the shortcut, once without - and the local body's path through it. */
  async function run(shortcut: boolean) {
    ArenaSimulation.restShortcut = shortcut;
    const world = await createRapierCollision('harbor'), mine = await createRapierCollision('harbor');
    done.push(() => { world.dispose?.(); mine.dispose?.(); });
    const w = wire(8, { serverCollision: world, collision: mine, others: 6 });
    const trace: number[] = [];
    let walker = 0, swing = 0;
    for (let i = 0; i < 540; i++) {
      // One of them walks at the player, one swings at the air beside them, the rest stand.
      w.server.submitInput('them0', { seq: walker++, moveX: Math.sin(i / 60), moveZ: -1, yaw: Math.PI });
      if (i % 90 === 40) w.server.submitInput('them1', { seq: 1000 + swing++, moveX: 0, moveZ: 0, yaw: Math.PI, attack: 'light' });
      // The player runs in a figure of eight through the standing ones, swinging now and then.
      w.press({ moveZ: Math.cos(i / 45), moveX: Math.sin(i / 30), yaw: i / 50, ...(i % 70 === 30 ? { attack: 'light' as const } : {}) });
      w.advance();
      if (i % 2 === 1) w.prediction.reconcile(w.snapshot());
      const p = w.prediction.diagnostics.position!;
      trace.push(p.x, p.y, p.z);
    }
    return { trace, actions: w.prediction.action };
  }

  it('leaves the local body where asking the world would, to a few millimetres', async () => {
    const withShortcut = await run(true), without = await run(false);
    expect(withShortcut.trace.length).toBe(without.trace.length);
    let worst = 0;
    for (let i = 0; i < withShortcut.trace.length; i++) worst = Math.max(worst, Math.abs(withShortcut.trace[i] - without.trace[i]));
    // Not bit for bit: the world's controller settles a standing body by a hair every tick (its skin, a sunk foot lifted),
    // and a local body pressed against one is pushed apart from the hair's difference - 5 mm at the most, over nine
    // seconds of pressing through six of them. The snapshot's own correction moves it ten times that, and the server
    // puts the standing body where the snapshot says.
    expect(worst, `the local body differed by ${worst} m`).toBeLessThan(.01);
    expect(withShortcut.actions).toBe(without.actions);
  }, 120_000);
});
