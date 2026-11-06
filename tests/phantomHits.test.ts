import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { rushStages } from './extraClips';
import { FIGHTERS } from '../src/config';
import { rushMove } from '../src/game/awakening';
import { MOVES } from '../src/game/moves';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { Prediction } from '../src/game/prediction';
import { LANDED, LandedBlows, REPLAY_PAST, RESOLVE_TICKS } from '../src/game/landedBlows';
import { Fighter, type TouchMark } from '../src/render/Fighter';
import { CombatEffects } from '../src/render/CombatEffects';
import { SPRITE } from '../src/render/vfx/SparkField';
import { loadRig } from './rigHarness';
import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState } from '../src/game/types';

/** Round 3c (FEEDBACK). The second blind critic's phantom hit: "Gaunt' 'Butcher Cleave':
 *  the blade passes through the hard-locked Ouga at 2.7 m. You see a slash,
 *  a flash, an impact ring and dust, but there is no damage number, no HP
 *  change and no flinch." Round 3b answered any striking surface that reached
 *  a body inside a contact window as the blow itself. Now only a blow the
 *  simulation landed is answered where it is drawn (src/game/landedBlows.ts):
 *  the local fighter's from the local copy of the simulation, on the tick it
 *  lands there; a remote fighter's from the server's snapshots, which arrive
 *  before the timeline draws the swing. A predicted hit the server refuses is
 *  let go of. The bodies here are real rigs driven by the real simulation the
 *  way main.ts drives them: the local attacker drawn from its prediction now,
 *  everything else - and every event - through the timeline LAG ticks late,
 *  and the server's snapshots in RAW ticks after the prediction. */
const LAG = 7, RAW = 3, dt = 1 / 60;

const hit = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'me', targetId: 'them', slot: 'light', actionSeq: 7, contactIndex: 0, ...props });
const snapshot = (events: CombatEvent[], ack?: number): GameSnapshot => ({ serverTime: 1, events,
  players: ack === undefined ? [] : [{ id: 'me', ackSeq: ack } as PlayerState] } as unknown as GameSnapshot);

describe('the ledger of blows landed', () => {
  it('holds the local copy\'s hits until the server lands them, and refuses the ones it goes past', () => {
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5 })], 'me', 20);
    const refused = ledger.blow('me', 7, 'them', 0)!;
    expect(refused.predicted && !refused.confirmed).toBe(true);
    // The server has consumed the inputs up to the one before the verdict is due.
    ledger.authoritative(snapshot([], 20 + RESOLVE_TICKS - 1), 'me');
    expect(refused.rejected, 'still inside the contact\'s active frames on the server').toBe(false);
    ledger.authoritative(snapshot([], 20 + RESOLVE_TICKS), 'me');
    expect(refused.rejected, 'gone past it without landing').toBe(true);
    // One the server does land is confirmed and stays so.
    ledger.predict([hit({ id: 6, actionSeq: 9 })], 'me', 40);
    ledger.authoritative(snapshot([hit({ id: 60, actionSeq: 9, serverTime: 2 })], 44), 'me');
    ledger.authoritative(snapshot([], 90), 'me');
    const landed = ledger.blow('me', 9, 'them', 0)!;
    expect([landed.confirmed, landed.rejected]).toEqual([true, false]);
    expect(ledger.landed('me', 9, 'them', 0)).toBe(true);
    expect(ledger.landed('me', 7, 'them', 0), 'a refused prediction landed nothing').toBe(false);
  });

  it('gives a prediction up when a replay from the server\'s newer state no longer lands it', () => {
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5 })], 'me', 20);
    // A replay of inputs 18 to 26 that lands it again: kept, on its first tick.
    ledger.predict([hit({ id: 9, serverTime: 1.02 })], 'me', 26, 18);
    const blow = ledger.blow('me', 7, 'them', 0)!;
    expect([blow.rejected, blow.tick]).toEqual([false, 20]);
    // One that has not run far enough past it to be sure: kept.
    ledger.predict([], 'me', 20 + REPLAY_PAST - 1, 19);
    expect(blow.rejected).toBe(false);
    // One that ran past it and did not land it: given up.
    ledger.predict([], 'me', 26, 19);
    expect(blow.rejected).toBe(true);
    // A replay that starts after a blow says nothing about it.
    ledger.predict([hit({ id: 6, actionSeq: 8 })], 'me', 30);
    ledger.predict([], 'me', 40, 31);
    expect(ledger.blow('me', 8, 'them', 0)!.rejected).toBe(false);
  });

  it('takes the server\'s hit under another input edge for the prediction of the same blow, and keeps it', () => {
    // The local copy's stage came from one press and the server's from the
    // next (an earlier stage hit on one and missed on the other).
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5, actionSeq: 7, serverTime: 1 })], 'me', 20);
    ledger.authoritative(snapshot([hit({ id: 50, actionSeq: 8, serverTime: 1.05 })], 21), 'me');
    const predicted = ledger.blow('me', 7, 'them', 0)!, served = ledger.blow('me', 8, 'them', 0)!;
    expect(ledger.same(predicted, served), 'one blow').toBe(true);
    ledger.authoritative(snapshot([], 20 + RESOLVE_TICKS + 5), 'me');
    expect(ledger.refused(predicted), 'not refused once the server has gone past its own edge').toBe(false);
    // A server hit on another body, or too far apart in time, is another blow.
    ledger.predict([hit({ id: 6, actionSeq: 30, serverTime: 3 })], 'me', 60);
    ledger.authoritative(snapshot([hit({ id: 51, actionSeq: 31, serverTime: 3.05, targetId: 'else' }), hit({ id: 52, actionSeq: 32, serverTime: 3.6 })], 61), 'me');
    expect(ledger.blow('me', 30, 'them', 0)!.standsFor).toBeUndefined();
    ledger.authoritative(snapshot([], 60 + RESOLVE_TICKS), 'me');
    expect(ledger.refused(ledger.blow('me', 30, 'them', 0))).toBe(true);
  });

  it('takes a replay that lands the same blow under another input edge for it', () => {
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5, actionSeq: 7, serverTime: 1 })], 'me', 20);
    ledger.predict([hit({ id: 9, actionSeq: 9, serverTime: 1.03 })], 'me', 26, 18);
    const first = ledger.blow('me', 7, 'them', 0)!, again = ledger.blow('me', 9, 'them', 0)!;
    expect([ledger.refused(first), ledger.same(first, again)]).toEqual([false, true]);
    // And falls with it when the server refuses that one too.
    ledger.authoritative(snapshot([], 26 + RESOLVE_TICKS), 'me');
    expect(ledger.refused(first)).toBe(true);
  });

  it('refuses a prediction on the snapshot where the server turns it away, oldest first, once', () => {
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5, actionSeq: 7 })], 'me', 20);
    ledger.predict([hit({ id: 6, actionSeq: 8 })], 'me', 29);
    const dodge: CombatEvent = { id: 40, kind: 'dodge', serverTime: 1.3, actorId: 'me', targetId: 'them', slot: 'light', contactIndex: 0 };
    ledger.authoritative(snapshot([dodge], 21), 'me');
    expect(ledger.blow('me', 7, 'them', 0)!.rejected, 'the swing the server dodged').toBe(true);
    expect(ledger.blow('me', 8, 'them', 0)!.rejected, 'not the one after it').toBe(false);
    // The same event again, as the timeline hands it over: nothing more.
    ledger.deliver([dodge]);
    ledger.authoritative(snapshot([dodge], 22), 'me');
    expect(ledger.blow('me', 8, 'them', 0)!.rejected).toBe(false);
    // A guard the local copy did not know about turns the next one away.
    ledger.authoritative(snapshot([{ ...dodge, id: 41, kind: 'blocked' }], 30), 'me');
    expect(ledger.blow('me', 8, 'them', 0)!.rejected).toBe(true);
    expect(ledger.guarded('me', 'them', 'light', 0, 1), 'and is kept as a guard').toBe(true);
  });

  it('hands the server\'s hits over in order, once each, and none the timeline has not reached', () => {
    const ledger = new LandedBlows();
    ledger.authoritative(snapshot([hit({ id: 1, actorId: 'r1', actionSeq: 3, serverTime: 1 }), hit({ id: 2, actorId: 'r2', actionSeq: 8, serverTime: 1.05 })]), 'me');
    ledger.clock = .5;
    expect(ledger.pair('them', 'light', 0), 'not handed over yet').toBeUndefined();
    ledger.clock = 1;
    expect(ledger.pair('them', 'light', 0)?.attacker).toBe('r1');
    expect(ledger.pair('them', 'light', 0)?.attacker).toBe('r2');
    expect(ledger.pair('them', 'light', 0)).toBeUndefined();
    expect(ledger.pair('them', 'heavy', 0), 'another slot').toBeUndefined();
    expect(ledger.blow('r1', 3, 'them', 0)!.delivered).toBe(true);
    // The timeline's own record marks it handed over as well.
    ledger.deliver([hit({ id: 3, actorId: 'r3', actionSeq: 1, serverTime: 1.1 })]);
    expect(ledger.blow('r3', 1, 'them', 0)!.delivered).toBe(true);
  });

  it('keeps guards by contact, from the swing\'s start', () => {
    const ledger = new LandedBlows();
    ledger.predict([{ id: 3, kind: 'blocked', serverTime: 2, actorId: 'me', targetId: 'them', slot: 'heavy', contactIndex: 0 }], 'me', 5);
    expect(ledger.guarded('me', 'them', 'heavy', 0, 1.9)).toBe(true);
    expect(ledger.guarded('me', 'them', 'heavy', 0, 2.1), 'a later swing').toBe(false);
    expect(ledger.guarded('me', 'them', 'light', 0, 1.9), 'another slot').toBe(false);
    expect(ledger.landed('me', 99, 'them', 1.9), 'a guarded swing still landed on the body').toBe(true);
  });

  it('ignores the client\'s own predicted events, and starts over for another fighter', () => {
    const ledger = new LandedBlows();
    ledger.deliver([hit({ id: 1_000_000_123 })]);
    expect(ledger.blow('me', 7, 'them', 0)).toBeUndefined();
    ledger.predict([hit({})], 'me', 1);
    ledger.predict([], 'someone', 2);
    expect(ledger.blow('me', 7, 'them', 0)).toBeUndefined();
  });
});

/** A server and the client's prediction of it, `latency` ticks each way;
 *  `them` dashes away just before the server's first contact when told to. */
function wire(latency: number, attacker: FighterId, gap: number) {
  const server = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 4242 });
  server.addPlayer('me', attacker, 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('them', 'ouga', 'Them', false, { x: 0, y: 0, z: gap });
  server.startMatch();
  const prediction = new Prediction();
  prediction.start('me', server.snapshot(false, true));
  return { server, prediction };
}

describe('the prediction fills it', () => {
  function swing(dodge: boolean) {
    LANDED.reset();
    const L = 3, press = 10;
    const { server, prediction } = wire(L, 'kenzo', 1.3);
    // The server's first contact: the press, a latency later, then the swing's contact.
    const contact = press + L + Math.round(MOVES.kenzo.light.contacts[0] * 60);
    const inputs: { at: number; input: PlayerInput }[] = [], snapshots: { at: number; s: GameSnapshot }[] = [];
    const serverEvents: CombatEvent[] = [];
    let theirs = 0;
    for (let tick = 0; tick < 70; tick++) {
      const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'them', attack: tick === press ? 'light' : undefined };
      prediction.submit(input);
      inputs.push({ at: tick + L, input });
      while (inputs.length && inputs[0].at <= tick) server.submitInput('me', inputs.shift()!.input);
      const away = dodge && tick >= contact - 5 && tick < contact - 1;
      server.submitInput('them', { seq: theirs++, moveX: 0, moveZ: away ? 1 : 0, yaw: Math.PI, dash: dodge && tick === contact - 5 });
      server.step();
      const s = server.snapshot(true, true);
      serverEvents.push(...s.events);
      snapshots.push({ at: tick + L, s });
      while (snapshots.length && snapshots[0].at <= tick) prediction.reconcile(snapshots.shift()!.s);
    }
    return { blow: LANDED.blow('me', press, 'them', 0), serverHits: serverEvents.filter(e => e.kind === 'hit' && e.targetId === 'them') };
  }

  it('with the local fighter\'s hit on the tick the local copy lands it, confirmed when the server does', () => {
    const { blow, serverHits } = swing(false);
    expect(serverHits.length).toBe(1);
    expect(blow?.predicted, 'predicted').toBe(true);
    expect(blow?.confirmed, 'and landed by the server').toBe(true);
    expect(blow?.rejected).toBe(false);
  });

  it('and refuses it once the server has gone past it without landing (the body dodged)', () => {
    const { blow, serverHits } = swing(true);
    expect(serverHits.length, 'the server landed nothing').toBe(0);
    expect(blow?.predicted, 'the local copy did not know about the dash').toBe(true);
    expect(blow?.rejected).toBe(true);
  });
});

const rigs = new Map<FighterId, { rig: GLTF; rush: THREE.AnimationClip[] }>();
let collision: Awaited<ReturnType<typeof createRapierCollision>>;
beforeAll(async () => {
  collision = await createRapierCollision('proving-hall');
  for (const id of ['gaunt', 'kenzo', 'taisei', 'kosho', 'ouga', 'konta'] as FighterId[]) {
    const rig = await loadRig(FIGHTERS[id].model);
    rigs.set(id, { rig, rush: await rushStages(id, rig) });
  }
}, 180_000);
afterAll(() => LANDED.reset());
const body = (id: FighterId, state: PlayerState) => { const r = rigs.get(id)!; const f = new Fighter({ ...state }, r.rig, false, r.rush); f.prepareRush(); return f; };

/** The critic's layouts, the attacker at the origin facing the bot. 'side':
 *  the bot 1.1 m ahead, Dummy A (Ouga) 2.7 m to the right and hard-locked,
 *  the press heading between them. 'close': the bot ahead and locked, Dummy
 *  A 1.25 m ahead-right, a bystander beside the blow's path. */
const LAYOUTS = {
  side: { bodies: [{ id: 'bot', fighter: 'konta', x: 0, z: 1.1 }, { id: 'A', fighter: 'ouga', x: -2.7, z: .2 }], lock: 'A', heading: -Math.PI / 4 },
  close: { bodies: [{ id: 'bot', fighter: 'konta', x: 0, z: 1.1 }, { id: 'A', fighter: 'ouga', x: -.95, z: .85 }], lock: 'bot', heading: 0 },
} as const;
type Play = { attacker: FighterId; plan: 'rush' | 'light' | 'heavy'; layout: keyof typeof LAYOUTS; dodge?: boolean; remote?: boolean; raw?: number; reseq?: number };
type Answer = { body: string; hits: number; touches: number; reactions: number; pushCm: number; lags: number[] };

/** One of the critic's layouts, played through. For every body: the blows
 *  the simulation landed on it, the blows answered as touches, the reactions
 *  started, the furthest it was shoved, and for each landed blow how many
 *  frames after the attacker's drawn contact its body began to answer it. `remote`: the attacker is somebody else's fighter, drawn from the
 *  timeline, and the server's verdicts come in `raw` ticks after the fact
 *  (Infinity: never, as in the arcade). */
function play(p: Play) {
  const L = LAYOUTS[p.layout], raw = p.raw ?? RAW;
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: 'proving-hall', collision, seed: 4242 });
  sim.addPlayer('a', p.attacker, 'A', false, { x: 0, y: 0, z: 0 });
  for (const b of L.bodies) sim.addPlayer(b.id, b.fighter, b.id, false, { x: b.x, y: 0, z: b.z });
  sim.startMatch();
  LANDED.reset();
  const bodies = new Map<string, Fighter>([['a', body(p.attacker, sim.getPlayer('a')!)]]);
  for (const b of L.bodies) bodies.set(b.id, body(b.fighter, sim.getPlayer(b.id)!));
  const slot: AttackSlot = p.plan === 'heavy' ? 'heavy' : 'light';
  const START = 20, presses = p.plan === 'rush' ? Array.from({ length: 6 }, (_, k) => START + k * 9) : [START];
  const firstContact = START + Math.round(MOVES[p.attacker][slot].contacts[0] * 60);
  const history: GameSnapshot[] = [], raws: GameSnapshot[] = [];
  const events: { tick: number; e: CombatEvent }[] = [];
  const frames: { tick: number; reactions: Record<string, number>; push: Record<string, number> }[] = [];
  const touches: { tick: number; victim: string }[] = [];
  let seen = Fighter.touchLog.at(-1)?.serial ?? 0;
  try {
    for (let i = 0; i < START + 140; i++) {
      const pa = sim.getPlayer('a')!;
      sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: L.heading, targetId: L.lock, lock: true, attack: presses.includes(i) ? slot : undefined });
      for (const b of L.bodies) {
        const q = sim.getPlayer(b.id)!, face = Math.atan2(pa.x - q.x, pa.z - q.z), away = !!p.dodge && b.id === L.lock && i >= firstContact - 5 && i < firstContact - 2;
        sim.submitInput(b.id, { seq: i, moveX: away ? -Math.sin(face) : 0, moveZ: away ? -Math.cos(face) : 0, yaw: face, targetId: 'a', dash: away && i === firstContact - 5 });
      }
      sim.step(dt);
      const now = structuredClone(sim.snapshot(true));
      history.push(now);
      for (const e of now.events) events.push({ tick: i, e });
      // `reseq`: the local copy's swings carry other input edges than the
      // server's (its stage came from another press), by this much.
      const own = (e: CombatEvent) => p.reseq && e.actorId === 'a' && e.actionSeq !== undefined ? { ...e, actionSeq: e.actionSeq + p.reseq } : e;
      if (!p.remote) LANDED.predict(now.events.map(own), 'a', i);
      raws.push(now); if (raws.length > raw) LANDED.authoritative(raws.shift()!, p.remote ? 'viewer' : 'a');
      const late = history.length > LAG ? history[history.length - 1 - LAG] : undefined;
      const drawn = (id: string) => (id === 'a' && !p.remote ? now : late ?? history[0]).players.find(q => q.id === id)!;
      for (const e of late?.events ?? []) if ((e.kind === 'hit' || e.kind === 'blocked') && e.endpoint && e.damage) {
        const heading = e.origin ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
        const style = e.fighter && e.slot ? (e.slot === 'light' && (e.chain ?? 0) > 0 ? rushMove(e.fighter, e.chain!, false) : MOVES[e.fighter][e.slot]).style : undefined;
        bodies.get(e.targetId!)?.impact(true, e.slot, style, e.contactIndex, heading, e.kind === 'hit' ? e.damage : e.damage * 2.2, 1.2, { chain: e.chain, reaction: e.reaction });
        bodies.get(e.actorId)?.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, { chain: e.chain });
      }
      for (const [id, f] of bodies) {
        const shown = drawn(id), target = id === 'a' ? drawn(L.lock) : drawn('a');
        const state = id === 'a' && p.reseq && !p.remote && shown.actionSeq !== undefined ? { ...shown, actionSeq: shown.actionSeq + p.reseq } : shown;
        f.targetDistance = Math.hypot(target.x - state.x, target.z - state.z);
        f.targetPoint = (f.targetPoint ?? new THREE.Vector3()).set(target.x, target.y + 1.45, target.z);
        f.update(dt, state, true, dt);
      }
      LANDED.deliver(late?.events ?? []);
      Fighter.settleContacts();
      if (late) LANDED.clock = late.serverTime;
      for (const mark of Fighter.touchLog) if (mark.serial > seen) { seen = mark.serial; if (!mark.guarded) touches.push({ tick: i, victim: mark.victim }); }
      const reactions: Record<string, number> = {}, push: Record<string, number> = {};
      for (const [id, f] of bodies) { reactions[id] = (f as unknown as { hitCount: number }).hitCount; push[id] = f.push.length(); }
      frames.push({ tick: i, reactions, push });
    }
  } finally { for (const f of bodies.values()) f.dispose(); }
  // Per body, over the whole run: every reaction started, paired in order
  // with the blows landed on it, and how far it was ever shoved.
  return L.bodies.map(b => {
    const hits = events.filter(x => x.e.kind === 'hit' && x.e.actorId === 'a' && x.e.targetId === b.id);
    const started: number[] = [];
    for (let n = 1; n < frames.length; n++) for (let k = frames[n - 1].reactions[b.id]; k < frames[n].reactions[b.id]; k++) started.push(frames[n].tick);
    // The drawn contact: the tick it landed, drawn LAG later for a remote attacker.
    const lags = hits.map((h, n) => started[n] === undefined ? NaN : started[n] - (h.tick + (p.remote ? LAG : 0)));
    return { body: b.id, hits: hits.length, touches: touches.filter(t => t.victim === b.id).length, reactions: started.length,
      pushCm: Math.round(Math.max(0, ...frames.map(f => f.push[b.id])) * 100), lags } satisfies Answer;
  });
}

describe('only a blow the simulation lands is answered where it is drawn', () => {
  // (Round 4b, FMOVES: Gaunt' Cleave sends a wave after them now - a dash is no dodge of a shot aimed as it leaves - so
  // the critic's swing is thrown with Kosho's Hachoir, a heavy that is still one blow of the body.)
  it('a heavy through the hard-locked Ouga who dodged it (the critic\'s Cleave): no spark, no flinch, no shove on him', () => {
    const dodged = play({ attacker: 'kosho', plan: 'heavy', layout: 'side', dodge: true });
    expect(dodged.find(b => b.body === 'A')!.hits, 'the server landed nothing on him').toBe(0);
    // Nobody the blow did not land on answers it, whoever the lock sends it at.
    for (const b of dodged) if (!b.hits) expect([b.touches, b.reactions, b.pushCm], `touches, reactions, shove (cm) on ${b.body}`).toEqual([0, 0, 0]);
    else expect([b.touches, b.reactions], `${b.body}, hit`).toEqual([b.hits, b.hits]);
    // Undodged, the blow on him is answered once, on the attacker's frame.
    const ouga = play({ attacker: 'kosho', plan: 'heavy', layout: 'side' }).find(b => b.body === 'A')!;
    expect([ouga.hits, ouga.touches, ouga.reactions]).toEqual([1, 1, 1]);
    expect(ouga.lags, 'frames after the attacker\'s contact').toEqual([0]);
  }, 120_000);

  it('Kenzo\'s swing at the far locked target: the bot in the blade\'s path is left alone', () => {
    const [bot, target] = play({ attacker: 'kenzo', plan: 'light', layout: 'side' });
    expect(bot.hits).toBe(0);
    expect([bot.touches, bot.reactions, bot.pushCm], 'touches, reactions, shove (cm) on the bot').toEqual([0, 0, 0]);
    expect([target.hits, target.touches, target.reactions]).toEqual([1, 1, 1]);
    expect(target.lags).toEqual([0]);
  }, 120_000);

  it.each(['taisei', 'kosho', 'kenzo'] as FighterId[])('%s\'s rush: the bystander beside it is never answered, the target once per blow on the attacker\'s frame', id => {
    const [target, bystander] = play({ attacker: id, plan: 'rush', layout: 'close' });
    expect(bystander.hits).toBe(0);
    expect([bystander.touches, bystander.reactions, bystander.pushCm], 'touches, reactions, shove (cm) on the bystander').toEqual([0, 0, 0]);
    expect(target.hits, 'the string landed').toBeGreaterThanOrEqual(3);
    expect([target.touches, target.reactions], 'one touch and one reaction per blow').toEqual([target.hits, target.hits]);
    expect(target.lags.every(l => l === 0), `answered on the attacker's contact frame: ${target.lags}`).toBe(true);
  }, 120_000);

  it('a remote attacker\'s blows are answered where the fist arrives, once each: the server\'s verdict is in before the swing is drawn', () => {
    const [target, bystander] = play({ attacker: 'taisei', plan: 'rush', layout: 'close', remote: true });
    expect(target.hits).toBeGreaterThanOrEqual(3);
    // A fist at the skin before the contact is answered there; one that is not
    // is answered by its event, handed over on the frame of the drawn contact.
    expect(target.touches, 'some answered where the fist arrived').toBeGreaterThan(0);
    expect(target.reactions, 'the events confirm them, never a second reaction').toBe(target.hits);
    expect(target.lags.every(l => l <= 0), `never after the drawn contact: ${target.lags}`).toBe(true);
    expect([bystander.touches, bystander.reactions, bystander.pushCm]).toEqual([0, 0, 0]);
  }, 120_000);

  it('a blow the local copy and the server land under different input edges is answered once', () => {
    const [target, bystander] = play({ attacker: 'taisei', plan: 'rush', layout: 'close', reseq: 1000 });
    expect(target.hits).toBeGreaterThanOrEqual(3);
    expect([target.touches, target.reactions], 'one touch and one reaction per blow, none withdrawn').toEqual([target.hits, target.hits]);
    expect(target.lags.every(l => l === 0), `on the attacker's contact frame: ${target.lags}`).toBe(true);
    expect([bystander.touches, bystander.reactions, bystander.pushCm]).toEqual([0, 0, 0]);
  }, 120_000);

  it('with no verdict ahead of the event (the arcade), each blow is answered once, by its event', () => {
    const [target, bystander] = play({ attacker: 'taisei', plan: 'rush', layout: 'close', remote: true, raw: Infinity });
    expect(target.hits).toBeGreaterThanOrEqual(3);
    expect([target.touches, target.reactions]).toEqual([0, target.hits]);
    expect(target.lags.every(l => l === 0), `on the drawn contact: ${target.lags}`).toBe(true);
    expect([bystander.touches, bystander.reactions, bystander.pushCm]).toEqual([0, 0, 0]);
  }, 120_000);
});

describe('a predicted hit the server refuses', () => {
  /** The local fighter's jab at a body that, on the server, dashes out of it:
   *  the prediction lands it, the server does not. Drawn as main.ts draws it:
   *  the attacker from the prediction, the struck body and every event from
   *  the server's snapshots LAG ticks late, reconciled L ticks late. */
  function refused(dodge: boolean) {
    LANDED.reset();
    const L = 3, press = 12;
    const { server, prediction } = wire(L, 'taisei', 1.15);
    const contact = press + L + Math.round(MOVES.taisei.light.contacts[0] * 60);
    const attacker = body('taisei', server.getPlayer('me')!), victim = body('ouga', server.getPlayer('them')!);
    const inputs: { at: number; input: PlayerInput }[] = [], snapshots: { at: number; s: GameSnapshot }[] = [], history: GameSnapshot[] = [];
    const out: { tick: number; touched: boolean; shown: number; sell: number; push: number; withdrawn: boolean; claimed: boolean }[] = [];
    let theirs = 0, seen = Fighter.touchLog.at(-1)?.serial ?? 0, touched = false, hits = 0;
    try {
      for (let tick = 0; tick < 90; tick++) {
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'them', attack: tick === press ? 'light' : undefined };
        prediction.submit(input);
        inputs.push({ at: tick + L, input });
        while (inputs.length && inputs[0].at <= tick) server.submitInput('me', inputs.shift()!.input);
        const away = dodge && tick >= contact - 5 && tick < contact - 1;
        server.submitInput('them', { seq: theirs++, moveX: 0, moveZ: away ? 1 : 0, yaw: Math.PI, dash: dodge && tick === contact - 5 });
        server.step();
        const s = server.snapshot(true, true);
        history.push(structuredClone(s));
        snapshots.push({ at: tick + L, s });
        while (snapshots.length && snapshots[0].at <= tick) prediction.reconcile(snapshots.shift()!.s);
        const late = history.length > LAG ? history[history.length - 1 - LAG] : history[0];
        for (const e of late.events) if (e.kind === 'hit' && e.targetId === 'them' && e.endpoint && e.origin) {
          hits++;
          victim.impact(true, e.slot, 'melee', e.contactIndex, new THREE.Vector3(e.endpoint.x - e.origin.x, 0, e.endpoint.z - e.origin.z), e.damage, 1.2, { chain: e.chain, reaction: e.reaction });
        }
        const me = prediction.sample(dt, late.players.find(q => q.id === 'me')!) ?? late.players.find(q => q.id === 'me')!, them = late.players.find(q => q.id === 'them')!;
        for (const [f, state, other] of [[attacker, me, them], [victim, them, me]] as const) {
          f.targetDistance = Math.hypot(other.x - state.x, other.z - state.z);
          f.targetPoint = (f.targetPoint ?? new THREE.Vector3()).set(other.x, other.y + 1.45, other.z);
          f.update(dt, state, true, dt);
        }
        LANDED.deliver(late.events);
        Fighter.settleContacts();
        LANDED.clock = late.serverTime;
        for (const mark of Fighter.touchLog) if (mark.serial > seen) { seen = mark.serial; if (mark.victim === 'them' && !mark.guarded) touched = true; }
        // What the reaction layer still shows of the blow, and of its shove.
        const inner = victim as unknown as { hits: { at: number; scale: number; gone: number }[]; reactTime: number; sellNow: number; touches: { withdrawn?: boolean; claimed: boolean }[] };
        const shown = inner.hits.reduce((n, h) => n + (h.gone === Infinity ? h.scale : h.scale * Math.max(0, 1 - (inner.reactTime - h.gone) / .1)), 0);
        out.push({ tick, touched, shown, sell: inner.sellNow, push: victim.push.length(), withdrawn: inner.touches.some(t => t.withdrawn), claimed: inner.touches.some(t => t.claimed && !t.withdrawn) });
      }
    } finally { attacker.dispose(); victim.dispose(); }
    return { out, hits };
  }

  it('answers it on the frame it is predicted, then lets go of it: no reaction or shove is left once the server has said no', () => {
    const { out, hits } = refused(true);
    expect(hits, 'the server never landed it').toBe(0);
    const first = out.findIndex(f => f.touched);
    expect(first, 'the predicted hit was answered').toBeGreaterThanOrEqual(0);
    const let_go = out.findIndex(f => f.withdrawn);
    expect(let_go, 'and let go of').toBeGreaterThan(first);
    // The server's verdict is due RESOLVE_TICKS after the predicted contact,
    // a round trip later: gone within that and the fade.
    expect(let_go - first).toBeLessThanOrEqual(2 * 3 + RESOLVE_TICKS + 2);
    const after = out.slice(let_go + 7);
    expect(Math.max(...after.map(f => f.shown)), 'reaction left').toBe(0);
    expect(Math.max(...after.map(f => f.sell)), 'shove left').toBe(0);
    expect(out.at(-1)!.push, 'the body back where it stands').toBeLessThan(.005);
  }, 120_000);

  it('and one the server lands is confirmed by its event, not answered twice', () => {
    const { out, hits } = refused(false);
    expect(hits).toBe(1);
    expect(out.some(f => f.withdrawn)).toBe(false);
    expect(out.at(-1)!.claimed, 'its event claimed the touch').toBe(true);
  }, 120_000);
});

describe('an event takes only its own record', () => {
  it('a guard\'s event leaves another attacker\'s hit on the same body waiting for its own', () => {
    LANDED.reset();
    const victim = body('ouga', { id: 'v', name: 'V', fighter: 'ouga', x: 0, y: 0, z: 1, yaw: Math.PI, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'guard', actionStarted: 0, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
    try {
      LANDED.authoritative(snapshot([hit({ id: 70, actorId: 'y', targetId: 'v', actionSeq: 4, serverTime: 1 })]), 'me');
      LANDED.clock = 1;
      // X's blow, turned away by the guard: its event carries no reaction.
      victim.impact(true, 'light', 'melee', 0, new THREE.Vector3(0, 0, 1), 30, 1.2, { chain: 0 });
      expect(LANDED.blow('y', 4, 'v', 0)!.delivered, 'Y\'s hit still to be handed over').toBe(false);
      // Y's hit's own event takes it.
      victim.impact(true, 'light', 'melee', 0, new THREE.Vector3(0, 0, -1), 30, 1.2, { chain: 0, reaction: 'hurt' });
      expect(LANDED.blow('y', 4, 'v', 0)!.delivered).toBe(true);
    } finally { victim.dispose(); LANDED.reset(); }
  });
});

describe('a blow\'s spark, claimed by its own event', () => {
  const player = (id: string, fighter: FighterId, z = 0): PlayerState => ({ id, name: id, fighter, x: 0, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
  const stub = (state: PlayerState) => {
    const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
    const hips = new THREE.Bone(); hips.position.y = 1; group.add(hips);
    const hand = new THREE.Vector3(0, 1.2, .4);
    return { state, group, velocity: new THREE.Vector3(), handR: hand.clone(), handL: hand.clone(), bones: new Map(), joints: new Map([['Hips', hips]]), armed: false,
      chargePosition(out: THREE.Vector3) { return out.copy(hand); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(hand); } } as unknown as Fighter;
  };
  const bursts = (fx: CombatEffects, from: number, to: number) => {
    const field = fx.kit.sparks as unknown as { data: Float32Array; epoch: number };
    let n = 0;
    for (let o = 0; o < field.data.length; o += 32) { const at = field.epoch + field.data[o + 3]; if ((field.data[o + 20] === SPRITE.burst || field.data[o + 20] === SPRITE.szstar) && field.data[o + 7] > 0 && at >= from - 1e-6 && at <= to + 1e-6) n++; }
    return n;
  };
  it('however late it arrives, and only its own', () => {
    const fx = new CombatEffects(new THREE.Scene());
    const fighters = new Map([['a', stub(player('a', 'taisei'))], ['b', stub(player('b', 'ouga', 1))]]);
    const mark = (serial: number, seq: number): TouchMark => ({ serial, victim: 'b', attacker: 'a', fighter: 'taisei', slot: 'light', chain: 1, damage: 28, x: 0, y: 1.3, z: .8, hx: 0, hz: 1, guarded: false, seq, index: 0 });
    const blow = (id: number, seq: number, serverTime: number): CombatEvent => ({ id, kind: 'hit', serverTime, actorId: 'a', targetId: 'b', fighter: 'taisei', slot: 'light', chain: 1, damage: 28, actionSeq: seq, contactIndex: 0, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 1 } });
    try {
      const base = (Fighter.touchLog.at(-1)?.serial ?? 0) + 5000;
      Fighter.touchLog.push(mark(base + 1, 4)); fx.update(1, dt, fighters);
      Fighter.touchLog.push(mark(base + 2, 5)); fx.update(1.3, dt, fighters);
      expect(bursts(fx, 1, 1.3), 'both drawn on their touches').toBeGreaterThan(0);
      // Their events, well past the old half-second match window, newest first.
      fx.handle([blow(70, 5, 2)], fighters);
      fx.handle([blow(71, 4, 2.1)], fighters);
      expect(bursts(fx, 1.9, 2.2), 'neither drawn twice').toBe(0);
      // A blow no touch answered still gets its spark from its event.
      fx.handle([blow(72, 6, 2.4)], fighters);
      expect(bursts(fx, 2.4, 2.4)).toBeGreaterThan(0);
    } finally { fx.dispose(); Fighter.touchLog.length = 0; }
  });
});
