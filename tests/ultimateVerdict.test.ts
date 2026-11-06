import { describe, expect, it } from 'vitest';
import { Packr, unpack } from 'msgpackr';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState } from '../src/game/types';

/**
 * Round 3e (ULTFIX): every ultimate resolves into a clear confirm or a clear
 * whiff - on the server, and on the thrower's own screen.
 *
 * The third blind critic, on the hosted Preview: "LORD ORO, Setsu and Gummy can
 * fizzle silently: the tint plays, nothing lands, no whiff is reported, and
 * the meter is spent." The server always called it; the thrower's screen did
 * not follow. Its copy of the arena (the prediction) sees every other
 * fighter a round trip late, so a victim who stepped out of the opener was
 * still inside it there: the copy confirmed, played the cinematic's grade,
 * camera and time stop - and when the server's whiff came back, kept its own
 * confirm mark, because the server's state had never carried one to write
 * over it. A client's copy now leaves the verdict to the server, and the
 * marks are read off the cast.
 */
const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;
const CONFIRM = (Object.keys(MOVES) as FighterId[]).filter(f => MOVES[f].ultimate.confirm);
const DT = 1 / 60;

/** The thrower on a client `lag` ticks from the server each way (snapshots
 *  every third tick), a victim 2.2 m off who acts on the server the moment
 *  the press reaches it. What the thrower's screen showed, frame by frame. */
function laggy(fighter: FighterId, victimMoves: { moveX: number; moveZ: number }, lag = 6, gap = 2.2) {
  const server = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5, stage: 'proving-hall' });
  server.addPlayer('me', fighter, 'Me', false, { x: -3, y: 0, z: 3.4 });
  server.addPlayer('a', fighter === 'gummy' ? 'konta' : 'gummy', 'A', false, { x: -3 + gap, y: 0, z: 3.4 });
  server.actors.get('me')!.state.ultimate = 100;
  const prediction = new Prediction();
  prediction.start('me', wire(server.snapshot(false, true)));
  const inbox: { at: number; snapshot: GameSnapshot }[] = [], queue: PlayerInput[] = [], events: CombatEvent[] = [];
  const frames: { t: number; confirmed: boolean; whiffed: boolean; action: string }[] = [];
  let latest: GameSnapshot | undefined, aSeq = 0;
  try {
    for (let seq = 0; seq < 60 * 4; seq++) {
      const input: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw: Math.PI / 2, targetId: 'a', lock: true, attack: seq === 0 ? 'ultimate' : undefined };
      prediction.submit(input); queue.push(input);
      while (queue.length && queue[0].seq <= seq - lag) server.submitInput('me', queue.shift()!);
      const moving = seq >= lag && seq < lag + 90;
      server.submitInput('a', { seq: ++aSeq, moveX: moving ? victimMoves.moveX : 0, moveZ: moving ? victimMoves.moveZ : 0, yaw: -Math.PI / 2 });
      server.step(); events.push(...server.drainEvents());
      if (seq % 3 === 0) inbox.push({ at: seq + lag, snapshot: wire<GameSnapshot>(server.snapshot(false, true)) });
      while (inbox.length && inbox[0].at <= seq) { latest = inbox.shift()!.snapshot; prediction.reconcile(latest); }
      const drawn = latest ? prediction.sample(DT, latest.players.find(p => p.id === 'me')!, 1) as PlayerState | null : null;
      if (drawn) frames.push({ t: seq * DT, confirmed: drawn.action === 'ultimate' && drawn.confirmedAt !== undefined, whiffed: drawn.action === 'ultimate' && drawn.whiffedAt !== undefined, action: drawn.action });
    }
  } finally { prediction.stop(); server.dispose(); }
  const verdict = events.find(e => (e.kind === 'confirm' || e.kind === 'whiff') && e.actorId === 'me')?.kind;
  return { verdict, frames, events };
}

describe('the thrower\'s screen shows the server\'s verdict, never its own guess', () => {
  it.each(CONFIRM.flatMap(f => [[f, 'flees'], [f, 'sidesteps']] as [FighterId, string][]))('%s: the victim %s, over a 200 ms round trip', (fighter, how) => {
    const { verdict, frames } = laggy(fighter, how === 'flees' ? { moveX: 1, moveZ: 0 } : { moveX: 0, moveZ: 1 });
    expect(verdict, 'the server called it').toBeDefined();
    const confirmed = frames.filter(f => f.confirmed), whiffed = frames.filter(f => f.whiffed);
    if (verdict === 'whiff') expect(confirmed, 'no cinematic for a whiff').toHaveLength(0);
    else expect(whiffed, 'no whiff for a confirm').toHaveLength(0);
    // Shown, and soon: within a round trip and a snapshot of the server's word.
    expect((verdict === 'whiff' ? whiffed : confirmed).length).toBeGreaterThan(0);
    expect(frames.filter(f => f.confirmed && f.whiffed), 'never both at once').toHaveLength(0);
  });

  it('the fighter is its own again when the server says so, not later', () => {
    // Kosho's kick, the victim running: a whiff. The recovery ends on the
    // server's clock; the screen does not hold the pose past it. (Ward's palm
    // was this test's whiff until round 7: his Crossmatch catches a runner
    // still inside his ROOM.)
    const { verdict, frames, events } = laggy('kosho', { moveX: 1, moveZ: 0 });
    expect(verdict).toBe('whiff');
    const whiff = events.find(e => e.kind === 'whiff')!;
    const over = frames.find(f => f.t > .3 && f.action !== 'ultimate')!;
    expect(over.t, 'recovered').toBeLessThan((whiff.castAge ?? 0) + MOVES.kosho.ultimate.confirm!.recovery + .45);
  });
});

describe('a client\'s copy holds the beat until the verdict arrives', () => {
  it('decides nothing itself, throws nothing after the opener, and plays the server\'s verdict once it has it', () => {
    for (const fighter of ['kosho', 'oro', 'shiden'] as FighterId[]) {
      const setup = (sim: ArenaSimulation) => {
        sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
        sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 2 });
        sim.actors.get('me')!.state.ultimate = 100;
      };
      const server = new ArenaSimulation({ trainingBot: false, seed: 3 }), copy = new ArenaSimulation({ trainingBot: false, seed: 3 });
      setup(server); setup(copy);
      try {
        const press: PlayerInput = { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'ultimate' };
        server.submitInput('me', press); copy.submitInput('me', press);
        server.step(); copy.step();
        // The copy is handed the server's state as the cast begins - which
        // makes it a follower - and then runs on alone past the opener.
        copy.restorePrediction('me', wire(server.predictionCheckpoint('me')!));
        const copyEvents: CombatEvent[] = [];
        for (let i = 0; i < 90; i++) { server.step(); copy.step(); copyEvents.push(...copy.drainEvents()); }
        expect(copyEvents.filter(e => e.kind === 'confirm' || e.kind === 'whiff'), fighter).toHaveLength(0);
        const move = MOVES[fighter].ultimate;
        const after = copyEvents.filter(e => e.kind === 'hit' && e.actorId === 'me' && (e.contactIndex ?? 0) > (move.timeStop?.contact ?? 0));
        expect(after, `${fighter}: nothing past the opener`).toHaveLength(0);
        expect(copy.getPlayer('me')!.action, fighter).toBe('ultimate');
        expect(copy.getPlayer('me')!.confirmedAt).toBeUndefined();
        // The server's verdict arrives: the copy plays it out with it.
        expect(server.getPlayer('me')!.confirmedAt, `${fighter}: the server confirmed`).toBeDefined();
        const snapshot = wire(server.snapshot(false, true));
        for (const p of snapshot.players) if (p.id !== 'me') Object.assign(copy.actors.get(p.id)!.state, p, { cooldowns: { ...p.cooldowns } });
        for (const [id, reaction] of Object.entries(snapshot.reactions ?? {})) if (id !== 'me') Object.assign(copy.actors.get(id)!, reaction);
        copy.restorePrediction('me', wire(server.predictionCheckpoint('me')!));
        copy.serverTime = server.serverTime;
        expect(copy.getPlayer('me')!.confirmedAt === undefined, 'the mark follows on the next tick').toBe(true);
        server.step(); copy.step();
        expect(copy.getPlayer('me')!.confirmedAt).toBe(server.getPlayer('me')!.confirmedAt);
        for (let i = 0; i < 60 * 4; i++) { server.step(); copy.step(); }
        expect(copy.getPlayer('b')!.hp, fighter).toBe(server.getPlayer('b')!.hp);
        expect(server.getPlayer('b')!.hp, fighter).toBeLessThan(1000);
      } finally { server.dispose(); copy.dispose(); }
    }
  });

  it('a cast put back from the server\'s whiff takes the copy\'s confirm mark with it', () => {
    // The copy confirmed on its own (a victim standing in front of it); the
    // server's cast whiffed (its victim had gone). Restoring the server's
    // cast over the copy's must not leave the copy's confirm behind.
    const server = new ArenaSimulation({ trainingBot: false, seed: 3 }), copy = new ArenaSimulation({ trainingBot: false, seed: 3 });
    server.addPlayer('me', 'kosho', 'Me', false, { x: 0, y: 0, z: 0 }); server.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 14 });
    copy.addPlayer('me', 'kosho', 'Me', false, { x: 0, y: 0, z: 0 }); copy.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 2 });
    for (const sim of [server, copy]) sim.actors.get('me')!.state.ultimate = 100;
    try {
      for (const sim of [server, copy]) sim.submitInput('me', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'ultimate' });
      for (let i = 0; i < 50; i++) { server.step(); copy.step(); }
      expect(copy.getPlayer('me')!.confirmedAt, 'the copy (not yet a follower) confirmed').toBeDefined();
      expect(server.getPlayer('me')!.whiffedAt, 'the server whiffed').toBeDefined();
      copy.restorePrediction('me', wire(server.predictionCheckpoint('me')!));
      copy.serverTime = server.serverTime;
      copy.step();
      expect(copy.getPlayer('me')!.confirmedAt).toBeUndefined();
      expect(copy.getPlayer('me')!.whiffedAt).toBe(server.getPlayer('me')!.whiffedAt);
    } finally { server.dispose(); copy.dispose(); }
  });
});
