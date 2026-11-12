import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import { BOMB_COMMIT, BOMB_DRIFT, BOMB_HOME, BOMB_LEAD, bombLead, homeStep, inRange } from '../src/game/bombAim';
import { prepare, trial, type Behaviour, type Hands, type Room } from '../scripts/gummy/ult_hitrate.mts';
import { CombatEffects } from '../src/render/CombatEffects';
import type { BlastAreas } from '../src/render/signature/BlastArea';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerInput, PlayerState, Vec3 } from '../src/game/types';
import { ROYALE_STAGES, type StageId } from '../src/game/stages';

const BOMBS = ['taisei', 'konta', 'kagari', 'jinlin'] as FighterId[];
const TRIALS = 4, DT = 1 / 60;
const MAIN_ROYALE: StageId[] = ['sunward-summit', 'ashfall-weir', 'mirror-mere', 'hollowmere-quarry', 'ash-colosseum', 'wreckers-causeway'];
beforeAll(async () => { (ROYALE_STAGES as StageId[]).splice(0, ROYALE_STAGES.length, ...MAIN_ROYALE); await prepare(); });
const rate = (fighter: FighterId, spec: { distance: number; behaviour: Behaviour; awakened?: boolean; room?: Room; hands?: Hands }) => {
  let landed = 0;
  for (let variant = 0; variant < TRIALS; variant++) if (trial({ fighter, ...spec, variant }).landed) landed++;
  return landed / TRIALS;
};

describe('the four bombs land whenever they fairly should', () => {
  it('are aimed as they are let go and follow in flight; everything else about them is as it was', () => {
    const was: Record<string, Partial<typeof MOVES.taisei.ultimate>> = {
      taisei: { duration: 2.6, contacts: [1.5], damage: 285, range: 34, radius: 3, speed: 22, cooldown: 20, stun: 2.3, knockback: 16 },
      konta: { duration: 2, contacts: [1], damage: 270, range: 34, radius: 3, speed: 24, cooldown: 20, stun: 2.3, knockback: 16 },
      kagari: { duration: 2.4, contacts: [1.35], damage: 290, range: 16, radius: 3, speed: 16, cooldown: 20, stun: 2.3, knockback: 16, guardBreak: true },
      'jinlin': { duration: 2.6, contacts: [1.45], damage: 290, range: 30, radius: 3.2, speed: 16, cooldown: 20, stun: 2.3, knockback: 16, guardBreak: true },
    };
    for (const f of BOMBS) {
      const move = MOVES[f].ultimate;
      expect(move, f).toMatchObject({ ...was[f], style: 'bomb', aimOnRelease: true });
      if (f === 'taisei' || f === 'konta') expect(move.guardBreak, `${f}: a guard still takes it`).toBeUndefined();
    }
  });

  it.each(BOMBS)('%s: a partner standing, jogging across or circling at a run, 3 to 12 m off, is caught (the stick let go)', fighter => {
    for (const behaviour of ['standing', 'jogging', 'strafing'] as Behaviour[]) for (const distance of [3, 6, 9, 12])
      expect(rate(fighter, { distance, behaviour }), `${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
  });

  it.each(BOMBS)('%s: and with the stick held at them through the wind-up (it walked them out from under it from 3 and 6 m)', fighter => {
    for (const behaviour of ['standing', 'jogging', 'strafing'] as Behaviour[]) for (const distance of [3, 6])
      expect(rate(fighter, { distance, behaviour, hands: 'stick' }), `${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
  });

  it.each(BOMBS)('%s: awakened, and on a royale\'s places, as well', fighter => {
    for (const behaviour of ['jogging', 'strafing'] as Behaviour[]) for (const distance of [6, 12]) {
      expect(rate(fighter, { distance, behaviour, awakened: true }), `awakened, ${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
      expect(rate(fighter, { distance, behaviour, room: 'royale' }), `royale, ${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.75);
    }
  });

  it('lands as hard as it did: its whole damage off a standing partner', () => {
    for (const fighter of BOMBS) for (const distance of [3, 12]) {
      const r = trial({ fighter, distance, behaviour: 'standing' });
      expect(r.verdict, `${fighter} at ${distance} m`).toBe('hit');
      expect(r.damage, `${fighter} at ${distance} m`).toBe(MOVES[fighter].ultimate.damage);
      expect(r.blast!.off, `${fighter} at ${distance} m: on them`).toBeLessThan(.5);
    }
  });
});

/** `fighter` at the origin facing +z with a full bar, Tab-locked on a Gummy `gap` metres in front (a training room, no
 *  world). `b(i, land)` steers Gummy on tick `i`; `land` is the tick the bomb comes down on, once it is in the air. */
function throwAt(fighter: FighterId, gap: number, b: (i: number, land: number) => Partial<PlayerInput> = () => ({}), at: { x: number; z: number } = { x: 0, z: gap }) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'gummy', 'B', false, { x: at.x, y: 0, z: at.z });
  sim.actors.get('a')!.state.ultimate = 100;
  const inner = sim as unknown as { projectiles: Shot[]; serverTime: number };
  const events: CombatEvent[] = [], ends: { tick: number; end: Vec3; left: number }[] = [];
  let land = Infinity, shot: Shot | undefined, kept: Shot | undefined;
  for (let i = 0; i < 60 * 4; i++) {
    sim.submitInput('a', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, attack: i === 0 ? 'ultimate' : undefined });
    sim.submitInput('b', { seq: i + 1, moveX: 0, moveZ: 0, yaw: Math.PI, ...b(i, land) });
    sim.step(DT); events.push(...sim.drainEvents());
    shot = inner.projectiles.find(s => s.actorId === 'a' && s.slot === 'ultimate');
    if (shot) {
      const left = shot.startAt + shot.duration - inner.serverTime;
      if (land === Infinity) { land = i + Math.round(left / DT); kept = shot; }
      ends.push({ tick: i, end: { ...shot.end }, left });
    }
  }
  const mine = events.filter(e => e.actorId === 'a' && e.slot === 'ultimate' && e.targetId === 'b');
  const caught = mine.some(e => e.kind === 'hit' || e.kind === 'blocked' || e.kind === 'guard-break');
  const out = { caught, dodged: mine.some(e => e.kind === 'dodge'), kinds: mine.map(e => e.kind), land, shot: kept, ends,
    release: events.find(e => e.kind === 'release' && e.actorId === 'a')!, b: sim.getPlayer('b')! };
  sim.dispose();
  return out;
}
type Shot = { actorId: string; fighter: FighterId; slot: string; castId?: number; move: { name: string; radius: number; style?: string }; start: Vec3; end: Vec3; startAt: number; duration: number; aimed?: Vec3 };
/** The same throw, dashed out of `before` seconds before it comes down (the stick at (x, z); B faces the thrower). */
function dashed(fighter: FighterId, gap: number, before: number, stick: [number, number]) {
  const land = throwAt(fighter, gap).land, at = land - Math.round(before / DT);
  return throwAt(fighter, gap, i => i === at ? { moveX: stick[0], moveZ: stick[1], dash: true } : {});
}
const SIDESTEP: [number, number] = [1, 0], BACKDASH: [number, number] = [0, 1], DASH: [number, number] = [0, -1];

describe('what still gets out from under one', () => {
  it.each(BOMBS)('%s: standing still is caught; a sidestep a fifth of a second before it lands gets out, from 6, 9 and 12 m', fighter => {
    for (const gap of [6, 9, 12]) {
      expect(throwAt(fighter, gap).caught, `standing, ${gap} m`).toBe(true);
      expect(dashed(fighter, gap, .2, SIDESTEP).caught, `sidestep, ${gap} m`).toBe(false);
    }
  });

  it.each(BOMBS)('%s: a sidestep half a second before it lands is followed, and one on its landing is too late', fighter => {
    expect(dashed(fighter, 9, .5, SIDESTEP).caught, 'too soon').toBe(true);
    expect(dashed(fighter, 9, 0, SIDESTEP).caught, 'too late').toBe(true);
  });

  it('a backdash a fifth of a second before it lands gets out of a 3 m blast; the Drowned Sun\'s 3.2 m only on the evade', () => {
    for (const fighter of ['taisei', 'konta', 'kagari'] as FighterId[]) expect(dashed(fighter, 9, .2, BACKDASH).caught, fighter).toBe(false);
    expect(dashed('jinlin', 9, .2, BACKDASH).caught, 'Jinlin, out of its evade').toBe(true);
    const evade = dashed('jinlin', 9, .05, BACKDASH);
    expect(evade.caught, 'Jinlin, on its evade').toBe(false);
    expect(evade.dodged).toBe(true);
  });

  it.each(BOMBS)('%s: a dash in under it - toward the thrower - gets out, and through its landing on the evade', fighter => {
    expect(dashed(fighter, 9, .3, DASH).caught, 'under it').toBe(false);
    const evade = dashed(fighter, 9, .05, DASH);
    expect(evade.caught).toBe(false);
    expect(evade.dodged, 'through it').toBe(true);
  });

  it.each(BOMBS)('%s: a body that runs across and turns back in flight is still caught', fighter => {
    // Turned a quarter of the way into the flight, at a run; or as it is let go, at a jog. (A sprint turned back the
    // moment it is let go gets out from under the slow two - Kagari's sun and the Drowned Sun, 16 m/s - from 6 m and more.)
    const base = throwAt(fighter, 9, () => ({ moveX: 1 })), quarter = base.land - Math.round((base.land - base.ends[0].tick) * .75);
    expect(throwAt(fighter, 9, i => ({ moveX: i < quarter ? 1 : -1 })).caught, 'at a run').toBe(true);
    expect(throwAt(fighter, 9, (i, land) => ({ moveX: land === Infinity ? .5 : -.5 })).caught, 'at a jog').toBe(true);
  });

  it('a guard still takes Taisei\'s and Konta\'s; Kagari\'s and Jinlin\'s break it', () => {
    for (const fighter of BOMBS) {
      const { kinds } = throwAt(fighter, 9, () => ({ guard: true }));
      expect(kinds, fighter).toContain(MOVES[fighter].ultimate.guardBreak ? 'guard-break' : 'blocked');
    }
  });

  it('thrown at a body in the air, it comes down on the floor under them - not in the air over them', () => {
    // Off the floor as it is let go (a jump a twelfth of a second before), and back down as it lands.
    const release = throwAt('taisei', 9).ends[0].tick;
    const { caught, shot } = throwAt('taisei', 9, i => i === release - 5 ? { jump: true } : {});
    expect(shot!.end.y, 'a standing body\'s middle over the floor').toBeCloseTo(1.05, 1);
    expect(caught).toBe(true);
  });
});

describe('aimed as it leaves the hand, and following in flight', () => {
  it.each(BOMBS)('%s: let go at where a running body will be when it comes down, then after it until it commits', fighter => {
    const move = MOVES[fighter].ultimate;
    // A jog across, from 9 m (at a run, Kagari's 16 m are behind them by the time it lands).
    const run = throwAt(fighter, 9, () => ({ moveX: .5 }));
    expect(run.caught).toBe(true);
    // At the release: ahead of where they were - the run carried over the flight, in part.
    const first = run.ends[0], released = run.release.endpoint!;
    expect(first.end.x, 'aimed ahead of the run').toBeGreaterThan(1);
    expect(Math.hypot(first.end.x - released.x, first.end.z - released.z), 'the release says where').toBeLessThan(.25);
    // In flight: never faster than its rate, never further than BOMB_DRIFT from where it was let go, still after it commits.
    for (let k = 1; k < run.ends.length; k++) {
      const a = run.ends[k - 1].end, b = run.ends[k].end, step = Math.hypot(b.x - a.x, b.z - a.z);
      expect(step, `tick ${run.ends[k].tick}`).toBeLessThanOrEqual(BOMB_HOME * DT + 1e-6);
      expect(Math.hypot(b.x - released.x, b.z - released.z)).toBeLessThanOrEqual(BOMB_DRIFT + 1e-6);
      if (run.ends[k - 1].left <= BOMB_COMMIT) expect(step, 'committed').toBe(0);
    }
    expect(run.ends.at(-1)!.end.x, 'it followed').toBeGreaterThan(first.end.x);
  });

  it('never sets down past its range: Kagari\'s sun inside 16 m of him, whoever it is after', () => {
    // Standing 17 m off - inside its reach, its range and a stride - it comes down at 16 m, and that is near enough.
    const near = throwAt('kagari', 17);
    expect(near.caught).toBe(true);
    for (const { end } of near.ends) expect(Math.hypot(end.x, end.z), 'inside 16 m').toBeLessThanOrEqual(16 + 1e-6);
    // Running on away from him from there: it follows them as far as 16 m, and no further.
    const away = throwAt('kagari', 17, () => ({ moveZ: 1 }));
    expect(away.caught).toBe(false);
    for (const { end } of away.ends) expect(Math.hypot(end.x, end.z), 'inside 16 m').toBeLessThanOrEqual(16 + 1e-6);
  });

  it('keeps every field the pixel fork draws a shot by, `end` moving under them tick by tick', () => {
    const { shot, ends } = throwAt('konta', 9, () => ({ moveX: 1 }));
    expect(shot).toMatchObject({ actorId: 'a', fighter: 'konta', slot: 'ultimate', move: { name: 'Azure Foxfire', radius: 3, style: 'bomb' } });
    expect(typeof shot!.castId).toBe('number');
    for (const key of ['start', 'end'] as const) for (const axis of ['x', 'y', 'z'] as const) expect(typeof shot![key][axis]).toBe('number');
    expect(shot!.duration).toBeGreaterThan(0);
    expect(new Set(ends.map(e => e.end.x.toFixed(4))).size, 'end moved').toBeGreaterThan(3);
  });

  it('the shared helpers: a lead of part of the run and BOMB_LEAD at most, a step of `rate` at most, BOMB_DRIFT at most', () => {
    const out = { x: 0, y: 0, z: 0 };
    const t = bombLead({ x: 0, y: 1.05, z: 0 }, { x: 0, y: 1.05, z: 10 }, 6, 0, 20, out);
    expect(t).toBeGreaterThan(.5); expect(out.x).toBeCloseTo(6 * t * .5, 2); expect(out.z).toBe(10);
    bombLead({ x: 0, y: 1.05, z: 0 }, { x: 0, y: 1.05, z: 30 }, 40, 0, 10, out);
    expect(out.x, 'capped').toBeCloseTo(BOMB_LEAD, 6);
    const end = { x: 0, y: 1, z: 0 };
    homeStep(end, { x: 10, z: 0 }, 12, .1, { x: 0, z: 0 });
    expect(end).toEqual({ x: expect.closeTo(1.2, 6), y: 1, z: 0 });
    for (let i = 0; i < 100; i++) homeStep(end, { x: 10, z: 0 }, 12, .1, { x: 0, z: 0 });
    expect(end.x, 'held to BOMB_DRIFT of where it was thrown').toBeCloseTo(BOMB_DRIFT, 6);
    const far = { x: 20, z: 0 }; inRange(far, { x: 2, z: 0 }, 16);
    expect(far.x).toBeCloseTo(18, 6);
  });
});

describe('drawn where it will come down (CombatEffects)', () => {
  const player = (props: Partial<PlayerState>): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100,
    action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false,
    cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
  const body = (state: PlayerState) => {
    const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
    const hand = new THREE.Vector3(state.x, 1.3, state.z + .4);
    return { state, group, velocity: new THREE.Vector3(), handR: hand, handL: hand.clone(), bones: new Map(), joints: new Map(),
      chargePosition(out: THREE.Vector3) { return out.copy(group.position).add(new THREE.Vector3(0, 1.3, .4)); }, meleeContactPoint() { return false; } } as unknown as Fighter;
  };
  /** `fighter` casting at t = 1 at the origin, locked on a Gummy 9 m in front who runs along +x at `speed` (m/s). */
  function scene(fighter: FighterId, speed: number) {
    const world = new THREE.Scene(), fx = new CombatEffects(world), move = MOVES[fighter].ultimate;
    const caster = body(player({ id: 'a', fighter, action: 'ultimate', actionStarted: 1, actionDuration: move.duration, target: 'b' }));
    const foe = body(player({ id: 'b', fighter: 'gummy', z: 9 }));
    const fighters = new Map([['a', caster], ['b', foe]]);
    fx.handle([{ id: 7, kind: 'cast', serverTime: 1, actorId: 'a', fighter, slot: 'ultimate', origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 9 } }], fighters);
    const ring = () => (fx as unknown as { blast: BlastAreas }).blast.showing()[0];
    let time = 1;
    const run = (until: number) => {
      for (; time < until - 1e-9; time += DT) {
        foe.group.position.x += speed * DT; foe.state.x = foe.group.position.x; foe.velocity.set(speed, 0, 0);
        fx.update(time + DT, DT, fighters);
      }
    };
    return { fx, world, move, foe, fighters, ring, run, release: 1 + move.contacts[0] };
  }

  it.each(BOMBS)('%s: through the wind-up its ring is over where the body it is thrown at will be when it comes down', fighter => {
    const { fx, foe, ring, run, release, move } = scene(fighter, 5);
    try {
      expect(ring().x, 'marked where they stood at the press').toBe(0);
      run(release - .05);
      const flight = Math.hypot(foe.group.position.x, 9) / move.speed!;
      expect(ring().x, 'on them, a part of their run ahead').toBeGreaterThan(foe.group.position.x);
      expect(Math.abs(ring().x - (foe.group.position.x + 5 * flight * .5)), 'eased after it').toBeLessThan(1);
    } finally { fx.dispose(); }
  });

  it.each(BOMBS)('%s: let go, the drawn ball and its ring go where the release says, follow them, and stop as it commits', fighter => {
    const { fx, foe, ring, run, release, move, fighters } = scene(fighter, 6);
    try {
      run(release);
      const said = { x: foe.group.position.x, y: 1.05, z: 9 };
      fx.handle([{ id: 8, kind: 'release', serverTime: release, actorId: 'a', fighter, slot: 'ultimate', origin: { x: 0, y: 1.05, z: 0 }, endpoint: said }], fighters);
      run(release + DT * 2);
      expect(ring().x, 'the release\'s point').toBeCloseTo(said.x, 0);
      const cast = (fx as unknown as { casts: { end: THREE.Vector3; travel: number; release: number }[] }).casts[0];
      const lands = 1 + cast.release + cast.travel;
      expect(ring().due, 'full as it lands').toBeCloseTo(lands, 2);
      // Following at its own rate until BOMB_COMMIT before it lands; still after.
      let last = ring().x;
      run(lands - BOMB_COMMIT - DT);
      expect(ring().x, 'after them').toBeGreaterThan(last);
      expect(ring().x - last).toBeLessThanOrEqual(BOMB_HOME * (lands - BOMB_COMMIT - release) + .05);
      run(lands - BOMB_COMMIT + DT);
      last = ring().x;
      run(lands - .02);
      expect(ring().x, 'committed').toBeCloseTo(last, 6);
      expect(cast.end.x, 'the ball with it').toBeCloseTo(last, 6);
    } finally { fx.dispose(); }
  });

  it('a miss goes off where the drawn ball came down', () => {
    const { fx, world, ring, run, release, fighters } = scene('jinlin', 0);
    try {
      run(release);
      fx.handle([{ id: 8, kind: 'release', serverTime: release, actorId: 'a', fighter: 'jinlin', slot: 'ultimate', origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 1, y: 1.05, z: 9 } }], fighters);
      run(release + .7);
      const burst = world.getObjectByName('combat-ultimate-burst');
      expect(burst, 'it went off').toBeDefined();
      expect(Math.hypot(burst!.position.x - ring().x, burst!.position.z - ring().z), 'where its ring is').toBeLessThan(.05);
    } finally { fx.dispose(); }
  });
});
