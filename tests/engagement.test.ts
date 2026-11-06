import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { CHIP, JUST_GUARD_WINDOW, MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';

/** Two fighters facing each other at `gap` metres, both looking the other way,
 *  so a swing from either of them is a swing at the other one. */
function bout(fighter: FighterId = 'kenzo', other: FighterId = 'taisei', gap = 1.6) {
  const sim = new ArenaSimulation({ trainingBot: false });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput>) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, ...more });
  const step = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(); };
  /** Guard is a held button and the simulation drops held input after a third
   *  of a second of silence, so holding it means saying so every tick. */
  const hold = (id: string, more: Partial<PlayerInput>, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { input(id, more); sim.step(); }
  };
  const events: CombatEvent[] = [];
  const drain = () => { events.push(...sim.snapshot().events); return events; };
  const saw = (kind: CombatEvent['kind']) => drain().some(e => e.kind === kind);
  input('a', { targetId: 'b' }); input('b', { targetId: 'a' });
  return { sim, input, step, hold, saw, drain };
}

describe('blocking is a decision, not a tax', () => {
  it('parries a hit taken on the beat: no chip, no stamina, attacker held', () => {
    const { sim, input, step, saw } = bout('kenzo');
    const light = MOVES.kenzo.light;
    input('a', { attack: 'light', targetId: 'b' });
    // Guard goes up just before the sword arrives, which is the whole skill.
    step(light.contacts[0] - JUST_GUARD_WINDOW * .5);
    const stamina = sim.getPlayer('b')!.stamina;
    input('b', { guard: true, targetId: 'a' });
    step(JUST_GUARD_WINDOW * .5 + .05);
    expect(saw('just-guard'), 'a block on the beat is a parry').toBe(true);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    expect(sim.getPlayer('b')!.stamina).toBeGreaterThanOrEqual(stamina - 1);
    // And the swing is over: the attacker is stood still in front of them.
    // Round 5 (PARRY): reeling, for JUST_GUARD_ADVANTAGE.
    expect(sim.getPlayer('a')!.action).toBe('hurt');
  });

  it('charges a late block chip and stamina instead', () => {
    const { sim, input, step, hold, saw } = bout('kenzo');
    hold('b', { guard: true, targetId: 'a' }, .6);
    const stamina = sim.getPlayer('b')!.stamina;
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.kenzo.light.contacts[0] + .08);
    step(0);
    expect(saw('just-guard'), 'holding guard never re-arms the parry').toBe(false);
    expect(saw('blocked')).toBe(true);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    expect(sim.getPlayer('b')!.stamina).toBeLessThan(stamina);
  });

  it('does not parry for a defender who never let go of the button', () => {
    // The existing "holding guard never re-arms the parry" case takes exactly
    // one hit, so blockstun never runs and the thing that re-armed the window
    // never happened. It takes a STRING.
    //
    // `p.guarding` is derived through `stunUntil`, which every blocked hit
    // raises for the length of blockstun - so a held guard was forced down and
    // back up on each block while the button had not moved, re-stamping a
    // window that belongs to the press. With the attacker plus on block the
    // next light landed inside it. Measured over 600 ticks of a held block,
    // every fighter in the roster blocked nine times and parried seven to ten
    // of them with no input from the defender at all.
    const { sim } = bout('taisei', 'taisei');
    let seq = 1000, blocks = 0, parries = 0;
    for (let i = 0; i < 600; i++) {
      // Held from a moment before the first jab, which would otherwise land inside the press's own window.
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i >= Math.round(JUST_GUARD_WINDOW * 60) + 2 ? 'light' : undefined });
      sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, guard: true, targetId: 'a' });
      sim.step();
      // `snapshot(true)` is the draining form - the plain one leaves the
      // buffer alone, so counting off it re-counts every event on every tick
      // and reports thousands of blocks in six hundred frames.
      for (const e of sim.snapshot(true).events) {
        if (e.kind === 'blocked') blocks++;
        if (e.kind === 'just-guard') parries++;
      }
    }
    expect(blocks, 'the pressure never landed').toBeGreaterThan(5);
    // At most the opening hit: the guard really was pressed from nothing once,
    // and if that first jab arrives inside the window it is a real parry.
    expect(parries, `${parries} parries from ${blocks} blocks, with the button never released`).toBeLessThanOrEqual(1);
  });

  it('will not chip a guard to death with a normal, and will with an ultimate', () => {
    const { sim, input, hold } = bout('kenzo');
    // One point from gone, holding guard: a jab must not finish them.
    (sim as unknown as { actors: Map<string, { state: { hp: number } }> }).actors.get('b')!.state.hp = 1;
    hold('b', { guard: true, targetId: 'a' }, .4);
    input('a', { attack: 'light', targetId: 'b' });
    hold('b', { guard: true, targetId: 'a' }, MOVES.kenzo.light.duration + .1);
    expect(sim.getPlayer('b')!.alive, 'a jab cannot chip someone out').toBe(true);
    expect(sim.getPlayer('b')!.hp).toBe(1);
  });

  it('scales chip by slot', () => {
    expect(CHIP.light).toBeLessThan(CHIP.heavy);
    expect(CHIP.heavy).toBeLessThan(CHIP.special);
    expect(CHIP.special).toBeLessThan(CHIP.ultimate);
  });
});

describe('the arena hits back', () => {
  it('splats a body driven into the stage bound', () => {
    const sim = new ArenaSimulation({ trainingBot: false, stage: 'sunfall-arena' });
    const { halfZ } = sim.bounds;
    // Close enough to the wall that the knockback has nowhere to put them.
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: halfZ - 2.8 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: halfZ - .8 });
    let seq = 0;
    sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'heavy' });
    const events: CombatEvent[] = [];
    for (let i = 0; i < 120; i++) { sim.step(); events.push(...sim.snapshot().events); }
    expect(events.some(e => e.kind === 'wall-splat'), 'a wall is a surface, not scenery').toBe(true);
  });

  it('bounces a juggled fighter off the floor once', () => {
    // Round 3e (VARIETY): Needle Finger pins them standing now (a stagger), so
    // the Haou-Dan - one of the four heavies that still launch - puts
    // them in the air.
    const { sim, input, step, drain } = bout('ouga', 'taisei', 1.4);
    // Put them in the air, then land a finisher on them there.
    input('a', { attack: 'heavy', targetId: 'b' });
    step(MOVES.ouga.heavy.contacts[0] + .15);
    expect(sim.getPlayer('b')!.grounded).toBe(false);
    input('a', { attack: 'heavy', targetId: 'b' });
    step(2.4);
    const bounces = drain().filter(e => e.kind === 'ground-bounce');
    expect(bounces.length, 'once, not a trampoline').toBeLessThanOrEqual(1);
  });
});

describe('two beams cancel each other out', () => {
  it('annihilates a Sunpalm Cannon into a Shikou-Ha: neither one lands', () => {
    const { sim, input, step, saw } = bout('taisei', 'ouga', 6);
    input('a', { attack: 'special', targetId: 'b' });
    input('b', { attack: 'special', targetId: 'a' });
    step(Math.max(MOVES.taisei.special.contacts[0], MOVES.ouga.special.contacts[0]) + .1);
    expect(saw('projectile-clash'), 'the two beams meet and go out').toBe(true);
    expect(sim.getPlayer('a')!.hp, 'neither beam gets through').toBe(1000);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    // And both of them are free again: the cancel is not a hold.
    step(.3);
    expect(sim.getPlayer('a')!.action).not.toBe('special');
    expect(sim.getPlayer('b')!.action).not.toBe('special');
  });

  it('still lets a beam through when nothing is pointed back at it', () => {
    const { sim, input, step, saw } = bout('taisei', 'ouga', 6);
    input('a', { attack: 'special', targetId: 'b' });
    step(MOVES.taisei.special.contacts[0] + .1);
    expect(saw('projectile-clash'), 'one beam is not a clash').toBe(false);
    expect(sim.getPlayer('b')!.hp, 'an unanswered Sunpalm Cannon hits').toBeLessThan(1000);
  });

  it('leaves two swings to trade, because a blade lock is not a thing here', () => {
    const { sim, input, step, saw } = bout('kenzo', 'nigo', 1.5);
    input('a', { attack: 'light', targetId: 'b' });
    input('b', { attack: 'light', targetId: 'a' });
    step(Math.max(MOVES.kenzo.light.contacts[0], MOVES.nigo.light.contacts[0]) + .12);
    expect(saw('projectile-clash'), 'swords are not beams').toBe(false);
    expect(sim.getPlayer('a')!.hp, 'they hit each other instead').toBeLessThan(1000);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
  });

  it('cancels two shots that meet in the air', () => {
    // Two shots with nearly the same wind-up, far enough apart to meet in the
    // middle rather than for one to arrive before the other has left.
    const { sim, input, step, saw } = bout('kenzo', 'nigo', 22);
    input('a', { attack: 'special', targetId: 'b' });
    input('b', { attack: 'special', targetId: 'a' });
    step(3);
    expect(saw('projectile-clash')).toBe(true);
    expect(sim.getPlayer('a')!.hp, 'neither shot gets through').toBe(1000);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
  });
});

describe('a swing goes where the fighter is looking', () => {
  it('turns a melee cast onto someone standing off the aim line', () => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
    // Forty degrees off the nose, inside the sword's reach.
    sim.addPlayer('b', 'taisei', 'B', false, { x: 1.1, y: 0, z: 1.3 });
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    for (let i = 0; i < Math.round((MOVES.kenzo.light.contacts[0] + .1) * 60); i++) sim.step();
    expect(sim.getPlayer('b')!.hp, 'a swing at someone in front of you should reach them').toBeLessThan(1000);
  });

  it('will not turn round to find someone behind', () => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: -1.6 });
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    for (let i = 0; i < Math.round((MOVES.kenzo.light.contacts[0] + .1) * 60); i++) sim.step();
    expect(sim.getPlayer('b')!.hp).toBe(1000);
  });
});
