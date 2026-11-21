import { afterEach, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { AREA_COMBO, COMBO_HP, COMBO_STAMINA, MOVES, POP_LAND_STUN, quickArea } from '../src/game/moves';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { HELD } from '../src/game/economy/fighters';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput, StageId } from '../src/game/types';

/** The G in combos (src/game/moves.ts AREA_COMBO): a launch or a wall splat
 *  opens a quick G, thrown as the combo's cancel, whose strike holds the body long enough for a light to follow - once a
 *  combo. Lock combat on, as every Duel plays it; the body the attacker's own fighter, standing there. */
type Actor = { state: { x: number; y: number; z: number; hp: number; stamina: number; maxStamina?: number; grounded: boolean; cooldowns: Record<string, number> };
  reaction: string | null; vy: number; kx: number; kz: number; stunUntil: number; hitstopUntil: number; areaComboUntil: number; areaComboOn: string; areaComboFrom: number;
  areaComboSpent: boolean; botSkill: number; botEase: number; botSharp: number; cast: { id: number; slot: string; start: number; areaCombo?: string; move: { duration: number; contacts: number[] } } | null };
const TICK = 1 / 60, REACT = 12;

function bench(fighter: FighterId = 'taisei', options: { gap?: number; at?: number; stage?: StageId; areaCombo?: boolean; bot?: boolean } = {}) {
  const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 7, maxHp: COMBO_HP, maxStamina: COMBO_STAMINA, lockCombat: true,
    ...(options.stage ? { stage: options.stage } : {}), ...(options.areaCombo === undefined ? {} : { areaCombo: options.areaCombo }) });
  const x = options.at ?? 0;
  sim.addPlayer('a', fighter, 'A', !!options.bot, { x, y: 0, z: 0 });
  sim.addPlayer('b', fighter, 'B', false, { x: x + (options.gap ?? 1.8), y: 0, z: 0 });
  (sim as unknown as { status: string }).status = 'active';
  const actors = (sim as unknown as { actors: Map<string, Actor> }).actors;
  const events: CombatEvent[] = [];
  let seq = 1;
  const tick = (n = 1, cmd: Partial<PlayerInput> = {}) => {
    for (let i = 0; i < n; i++) {
      const A = actors.get('a')!.state, B = actors.get('b')!.state, yaw = Math.atan2(B.x - A.x, B.z - A.z);
      if (!options.bot) sim.submitInput('a', { seq, moveX: 0, moveZ: 0, yaw, targetId: 'b', ...(i === 0 ? cmd : {}) } as PlayerInput);
      sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: yaw + Math.PI } as PlayerInput);
      seq++; sim.step(TICK); events.push(...sim.snapshot(true).events);
    }
  };
  const press = (slot: AttackSlot, extra: Partial<PlayerInput> = {}) => tick(1, { attack: slot, ...extra });
  const until = (test: () => boolean, most = 240) => { for (let i = 0; i < most && !test(); i++) tick(); return test(); };
  const a = () => actors.get('a')!, b = () => actors.get('b')!;
  const open = () => a().areaComboUntil >= sim.serverTime && a().areaComboOn === 'b';
  const hits = (slot?: AttackSlot) => events.filter(e => e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b' && (!slot || e.slot === slot));
  tick(30);
  return { sim, actors, events, tick, press, until, a, b, open, hits };
}
const roster = () => (RELEASED_FIGHTERS as readonly FighterId[]).filter(f => !HELD.has(f));
const rise = { dir: 'b' } as Partial<PlayerInput>;

afterEach(() => { ArenaSimulation.areaComboDefault = true; });

describe('the G in combos: a launch opens a quick G', () => {
  it('thrown inside the window it is the quick G at the launched body: its release at AREA_COMBO.pace of its own, its circle filling AREA_COMBO.telegraph', () => {
    const t = bench('taisei');
    t.press('heavy');
    expect(t.until(t.open, 90)).toBe(true);
    const from = t.sim.serverTime;
    t.press('area');
    expect(t.until(() => t.hits('area').length > 0, 120)).toBe(true);
    const own = MOVES.taisei.area!, quick = quickArea(own);
    const cast = t.events.find(e => e.kind === 'cast' && e.slot === 'area' && e.serverTime >= from)!;
    const release = t.events.find(e => e.kind === 'release' && e.slot === 'area')!;
    expect(release.serverTime - cast.serverTime).toBeCloseTo(own.contacts[0] * AREA_COMBO.pace, 1);
    expect(release.due! - release.serverTime).toBeCloseTo(AREA_COMBO.telegraph, 3);
    expect(quick.duration).toBeCloseTo(own.duration * AREA_COMBO.pace, 4);
    // Its circle went on the body, where the body was at the release.
    const hit = t.hits('area')[0];
    expect(hit.areaCombo).toBe(true);
    expect(Math.hypot(release.endpoint!.x - t.b().state.x, release.endpoint!.z - t.b().state.z)).toBeLessThan(own.radius);
    // Struck from the press about 0.44 s on, where from neutral it was 1.13 s.
    expect(hit.serverTime - cast.serverTime).toBeLessThan(own.contacts[0] + own.area!.telegraph - .5);
  });

  it('from neutral the G is as it was: its own release and fill, where it was aimed, and no hold', () => {
    const t = bench('taisei', { gap: 6 });
    t.press('area', { aim: { x: 6, z: 0 } } as Partial<PlayerInput>);
    t.until(() => t.events.some(e => e.kind === 'impact'), 200);
    const own = MOVES.taisei.area!;
    const cast = t.events.find(e => e.kind === 'cast' && e.slot === 'area')!, release = t.events.find(e => e.kind === 'release')!;
    expect(release.serverTime - cast.serverTime).toBeCloseTo(own.contacts[0], 1);
    expect(release.due! - release.serverTime).toBeCloseTo(own.area!.telegraph, 3);
    expect(t.hits('area').every(e => !e.areaCombo)).toBe(true);
  });

  it('its first strike holds the body on its feet, reeling, for AREA_COMBO.stagger (from its landing, out of the air), and throws it nowhere', () => {
    const t = bench('taisei');
    t.press('heavy'); t.until(t.open, 90); t.press('area');
    t.until(() => t.hits('area').length > 0, 120);
    // In the air at the strike: driven down onto its feet, then held.
    t.until(() => t.b().state.grounded, 60);
    expect(t.b().reaction).toBe('hurt');
    const held = t.b().stunUntil - t.sim.serverTime;
    expect(held).toBeGreaterThan(AREA_COMBO.stagger - .05);
    expect(held).toBeLessThan(AREA_COMBO.stagger + .25);
    expect(held).toBeGreaterThan(POP_LAND_STUN);
    expect(Math.hypot(t.b().kx, t.b().kz)).toBeLessThan(.01);
  });

  it('a light pressed from a person\'s reaction after the strike connects while it holds - the body never free in between', () => {
    for (const fighter of ['taisei', 'kenzo', 'ouga', 'konta', 'gummy', 'akaito'] as FighterId[]) {
      const t = bench(fighter);
      t.press('light', rise); t.until(t.open, 90); t.tick(REACT); t.press('area');
      expect(t.until(() => t.hits('area').length > 0, 120), fighter).toBe(true);
      t.tick(REACT);
      // Pressed as a player presses it - again until it lands - and the body watched for a moment it is free.
      const before = t.hits('light').length;
      let free = false;
      for (let i = 0; i < 8 && t.hits('light').length === before; i++) {
        t.press('light'); for (let k = 0; k < 8; k++) { t.tick(); if (!t.b().reaction && t.hits('light').length === before) free = true; }
      }
      expect(t.hits('light').length, fighter).toBeGreaterThan(before);
      expect(free, fighter).toBe(false);
    }
  });

  it('every released fighter has it from its Rising Strike, and pressed on the window\'s last tick it still strikes the body before it can get up', () => {
    const missed: string[] = [];
    for (const fighter of roster()) for (const opener of ['rise', 'heavy'] as const) {
      const t = bench(fighter);
      if (opener === 'rise') t.press('light', rise); else t.press('heavy');
      if (!t.until(t.open, 90)) { if (opener === 'rise') missed.push(`${fighter}: no window`); continue; }
      // The press is read on the next tick: the last one inside the window.
      t.until(() => t.a().areaComboUntil - t.sim.serverTime < TICK * 2, 120);
      t.press('area');
      if (!t.until(() => t.hits('area').some(e => e.areaCombo), 150)) missed.push(`${fighter}/${opener}`);
    }
    expect(missed).toEqual([]);
  });
});

describe('the G in combos: no loop', () => {
  it('one G a combo: a launch landed again in the same combo opens nothing, its cooldown and stamina put back; a quiet combo opens it again', () => {
    const t = bench('taisei');
    t.press('heavy'); t.until(t.open, 90); t.press('area'); t.until(() => t.hits('area').length > 0, 120);
    expect(t.b().areaComboSpent).toBe(true);
    // Back on the floor and held: the Rising Strike launches it again, inside the combo.
    t.until(() => t.b().state.grounded, 60); t.tick(4);
    t.a().state.cooldowns.area = 0; t.a().state.stamina = t.a().state.maxStamina ?? 225;
    const launches = t.hits().filter(e => e.reaction === 'launched').length;
    t.press('light', rise);
    t.until(() => t.hits().filter(e => e.reaction === 'launched').length > launches, 60);
    expect(t.hits().filter(e => e.reaction === 'launched').length).toBeGreaterThan(launches);
    t.tick(20);
    expect(t.open()).toBe(false);
    t.press('area'); t.tick(60);
    expect(t.hits('area').filter(e => e.areaCombo)).toHaveLength(1);
    // Quiet for longer than a combo lasts: the next launch opens it again.
    t.tick(240);
    t.a().state.cooldowns.area = 0; t.a().state.stamina = t.a().state.maxStamina ?? 225;
    t.until(() => !t.b().reaction, 120);
    t.press('light', rise);
    expect(t.until(t.open, 90)).toBe(true);
  });

  it('nothing is cancelled out of the G, and the G cancels out of no ultimate', () => {
    const t = bench('taisei');
    t.press('heavy'); t.until(t.open, 90); t.press('area');
    t.until(() => t.a().cast?.slot === 'area', 30);
    const cast = t.a().cast!;
    t.press('light'); t.tick(2);
    expect(t.a().cast?.id).toBe(cast.id);
  });
});

describe('the G in combos: the window', () => {
  it('a wall splat opens it (and a wall bounce), for at most AREA_COMBO.splat, and the G pressed on its last tick still lands', () => {
    // The causeway's walls stand 13 m either side: Ouga's heavy launches the body into one, Gummy's blows it back off one.
    for (const [fighter, reaction] of [['ouga', undefined], ['gummy', 'launched']] as const) {
      const t = bench(fighter, { stage: 'wreckers-causeway', at: 10.4, gap: 1.5 });
      t.press('heavy');
      expect(t.until(() => t.events.some(e => e.kind === 'wall-splat'), 120), fighter).toBe(true);
      const splat = t.events.find(e => e.kind === 'wall-splat')!;
      expect(splat.reaction, fighter).toBe(reaction);
      expect(t.a().areaComboFrom, fighter).toBeCloseTo(splat.serverTime, 5);
      expect(t.a().areaComboUntil - t.a().areaComboFrom, fighter).toBeLessThanOrEqual(AREA_COMBO.splat + 1e-9);
      t.until(() => t.a().areaComboUntil - t.sim.serverTime < TICK * 2, 60);
      t.press('area');
      expect(t.until(() => t.hits('area').some(e => e.areaCombo), 120), fighter).toBe(true);
    }
  });

  it('opens on the thrower\'s own clock: its impact freeze holds the window', () => {
    const t = bench('taisei');
    t.press('heavy'); t.until(t.open, 90);
    const opened = t.a().areaComboUntil, frozen = Math.max(0, t.a().hitstopUntil - t.sim.serverTime);
    expect(frozen).toBeGreaterThan(0);
    t.tick(Math.ceil(frozen * 60) + 1);
    expect(t.a().areaComboUntil).toBeGreaterThan(opened + frozen - TICK * 1.5);
  });

  it('the strikes land on the body down on the floor whole - no ground hit - and never through its getting up', () => {
    const t = bench('taisei');
    t.press('heavy'); t.until(t.open, 90);
    // Late in the window, the body comes down before the strike.
    t.until(() => t.a().areaComboUntil - t.sim.serverTime < TICK * 2, 120); t.press('area');
    t.until(() => t.hits('area').length > 0, 150);
    const hit = t.hits('area')[0];
    expect(hit.areaCombo).toBe(true);
    expect(hit.downed).toBeUndefined();
    expect(t.events.some(e => e.kind === 'dodge' && e.slot === 'area')).toBe(false);
  });

  it('off (?ab=gcombo: the page\'s own arenas) no window opens and the G is the neutral one', () => {
    ArenaSimulation.areaComboDefault = false;
    const t = bench('taisei');
    t.press('heavy'); t.tick(60);
    expect(t.a().areaComboUntil).toBe(-Infinity);
    const own = MOVES.taisei.area!;
    t.press('area'); t.until(() => t.events.some(e => e.kind === 'release'), 120);
    const cast = t.events.find(e => e.kind === 'cast' && e.slot === 'area')!, release = t.events.find(e => e.kind === 'release')!;
    expect(release.due! - release.serverTime).toBeCloseTo(own.area!.telegraph, 3);
    expect(release.serverTime - cast.serverTime).toBeCloseTo(own.contacts[0], 1);
  });
});

describe('the G in combos: page and room in step', () => {
  it('the page\'s prediction plays it whatever ?ab=gcombo says of the page\'s own arenas', () => {
    ArenaSimulation.areaComboDefault = false;
    const server = new ArenaSimulation({ trainingBot: false, areaCombo: true });
    server.addPlayer('me', 'taisei', 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('them', 'taisei', 'Them', false, { x: 0, y: 0, z: 1.8 });
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(false, true));
    expect((prediction as unknown as { sim: { areaCombo: boolean } }).sim.areaCombo).toBe(true);
    expect(new ArenaSimulation({ trainingBot: false }).areaCombo).toBe(false);
  });

  it('the rollback checkpoint carries the window and the hold from the start, and the page\'s prediction casts the room\'s quick G', () => {
    const t = bench('taisei');
    const first = t.sim.predictionCheckpoint('a')! as unknown as Record<string, unknown>;
    for (const key of ['areaComboUntil', 'areaComboOn', 'areaComboFrom', 'areaComboFloor', 'areaComboSpent', 'hitBy', 'areaHoldCast', 'areaHoldUntil']) expect(first, key).toHaveProperty(key);
    // A room and a page predicting it, five ticks apart: the page's presses reach the room late, and the room's word comes
    // back with each snapshot. The quick G the room throws is the one the page then plays.
    const room = new ArenaSimulation({ trainingBot: false, lockCombat: true, maxHp: COMBO_HP, maxStamina: COMBO_STAMINA });
    room.addPlayer('me', 'taisei', 'Me', false, { x: 0, y: 0, z: 0 });
    room.addPlayer('them', 'taisei', 'Them', false, { x: 0, y: 0, z: 1.8 });
    const prediction = new Prediction();
    prediction.start('me', room.snapshot(false, true));
    const queue: { at: number; input: PlayerInput }[] = [];
    let seq = 0, tick = 0;
    const frame = (more: Partial<PlayerInput> = {}) => {
      const input = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'them', ...more } as PlayerInput;
      prediction.submit(input); queue.push({ at: tick + 5, input });
      tick++;
      while (queue.length && queue[0].at <= tick) room.submitInput('me', queue.shift()!.input);
      room.submitInput('them', { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI } as PlayerInput);
      room.step();
      prediction.reconcile(room.snapshot(false, true));
    };
    const roomActor = () => (room as unknown as { actors: Map<string, Actor> }).actors.get('me')!;
    const pageActor = () => (prediction as unknown as { sim: { actors: Map<string, Actor> } }).sim.actors.get('me')!;
    for (let i = 0; i < 20; i++) frame();
    frame({ attack: 'heavy' });
    for (let i = 0; i < 90 && !(roomActor().areaComboUntil >= room.serverTime); i++) frame();
    expect(roomActor().areaComboOn).toBe('them');
    frame({ attack: 'area' });
    for (let i = 0; i < 30 && roomActor().cast?.slot !== 'area'; i++) frame();
    expect(roomActor().cast?.areaCombo).toBe('them');
    for (let i = 0; i < 8; i++) frame();
    expect(pageActor().cast?.slot).toBe('area');
    expect(pageActor().cast?.areaCombo).toBe('them');
    expect(pageActor().cast!.move.duration).toBeCloseTo(roomActor().cast!.move.duration, 6);
    expect(pageActor().cast!.start).toBeCloseTo(roomActor().cast!.start, 6);
  });
});

describe('the G in combos: bots', () => {
  const launched = (t: ReturnType<typeof bench>) => {
    // The body thrown, as the bot's own launch would throw it, and the bot's window opened by the simulation's own rule.
    const b = t.b(); b.reaction = 'launched'; b.vy = 6.6; b.state.grounded = false; b.stunUntil = t.sim.serverTime + 1;
    (t.sim as unknown as { openAreaCombo(by: unknown, on: unknown, left: number, most: number, floor: number): void })
      .openAreaCombo(t.a(), b, 2 * 6.6 / (23 * .68) + .36, AREA_COMBO.launch, 0);
    return t.sim.serverTime;
  };
  it('a skilled bot throws its G into its own launch, a person\'s reaction after it (never before), its circle on the body', () => {
    let thrown = 0;
    for (let seed = 0; seed < 8; seed++) {
      const t = bench('taisei', { bot: true });
      t.sim.setBotSkill('a', 1); t.a().botEase = 0; t.a().botSharp = 0;
      t.a().state.stamina = t.a().state.maxStamina ?? 225;
      (t.sim as unknown as { randomState: number }).randomState = 1000 + seed;
      const from = launched(t);
      t.until(() => t.a().cast?.slot === 'area', 45);
      const cast = t.a().cast;
      if (cast?.slot !== 'area') continue;
      thrown++;
      expect(cast.areaCombo).toBe('b');
      expect(cast.start - from).toBeGreaterThanOrEqual(.1);
    }
    expect(thrown).toBeGreaterThan(2);
  });
  it('at full ease it never does', () => {
    for (let seed = 0; seed < 8; seed++) {
      const t = bench('taisei', { bot: true });
      t.sim.setBotSkill('a', 1); t.a().botEase = 1; t.a().botSharp = 0;
      (t.sim as unknown as { randomState: number }).randomState = 2000 + seed;
      launched(t);
      t.until(() => t.a().cast?.slot === 'area', 45);
      expect(t.a().cast?.areaCombo).toBeUndefined();
    }
  });
});
