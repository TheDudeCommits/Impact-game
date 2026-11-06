import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { JUMP_BEFORE, JUMP_HANG_SPEED, JUMP_SCALE, LAUNCH_GRAVITY, MOVES, jumpArc } from '../src/game/moves';

/**
 * A jump comes down faster than it goes up.
 *
 * Gravity was symmetric, so every jump was one 1.68 m, 0.77 s arc with the
 * same float on the way down as on the way up. Only a fighter who JUMPED
 * falls at FALL_GRAVITY, and only on the descent: a launch keeps
 * LAUNCH_GRAVITY, and a body the reaction owns is not jumping.
 *
 * Round 4b (JUMP): every fighter jumps 2.5-3.5x the old 1.61 m now
 * (JUMP_SCALE; tests/jumpArc.test.ts holds the whole roster to it), on the
 * stylised arc - a fast rise, a hang at the top, a hard fall - rather than three
 * times the height under the old gravity, which was 1.7x the airtime.
 */
function flight(sim: ArenaSimulation, id: string, maxTicks = 240) {
  const actor = sim.actors.get(id)!;
  let rise = 0, fall = 0, peak = 0, left = false, hang = 0, early = 0;
  for (let i = 0; i < maxTicks; i++) {
    sim.step();
    const p = actor.state;
    if (!p.grounded) {
      left = true; peak = Math.max(peak, p.y); if (actor.vy > 0) rise++; else fall++;
      if (Math.abs(actor.vy) <= JUMP_HANG_SPEED) hang++;
      if (rise + fall === 6) early = p.y;
    }
    else if (left) break;
  }
  return { rise, fall, peak, hang, early };
}

describe('the shape of a jump', () => {
  it('rises fast, hangs at the top and comes down harder', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
    // Held: a jump whose button is let go of is the short hop below.
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, jump: true, jumpHeld: true });
    const { rise, fall, peak, hang, early } = flight(sim, 'a');
    // Taisei's 3.1x of the old jump's 1.61 m, as the 60 Hz step samples both.
    expect(peak).toBeCloseTo(jumpArc('taisei').apex, 2);
    expect(peak).toBeCloseTo(JUMP_SCALE.taisei * JUMP_BEFORE.apex, 1);
    // A fast rise: two fifths of the height in the first tenth of a second.
    expect(early / peak, `${early.toFixed(2)} m up after 0.1 s`).toBeGreaterThan(.4);
    expect(rise, 'a real rise').toBeGreaterThan(20);
    // A hang: a tenth of a second or more crossing the top of the arc.
    expect(hang, `${hang} ticks at the top`).toBeGreaterThanOrEqual(6);
    // A hard fall: down in fewer ticks than it took to go up.
    expect(fall, `fell in ${fall} ticks against a ${rise}-tick rise`).toBeLessThan(rise);
    // Three times the height under the old gravity would have been 1.76x the
    // airtime: this is no float.
    const air = (rise + fall) / 60;
    expect(air / JUMP_BEFORE.air, `${air.toFixed(2)} s against ${JUMP_BEFORE.air.toFixed(2)}`).toBeLessThan(1.45);
    expect(air / JUMP_BEFORE.air).toBeGreaterThan(1.15);
    sim.dispose();
  });

  it('is a hop when the button is tapped and a jump when it is held', () => {
    // The client sends jump as an edge and the held bit alongside it. A
    // jump whose button is up once it is JUMP_CUT_AFTER old rises under
    // JUMP_CUT_GRAVITY: about half the height, over in two thirds of the
    // time. Nothing about the full jump changes.
    const hop = new ArenaSimulation({ trainingBot: false, seed: 5 });
    hop.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
    hop.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, jump: true });
    const tapped = flight(hop, 'a');
    const full = new ArenaSimulation({ trainingBot: false, seed: 5 });
    full.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
    full.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, jump: true, jumpHeld: true });
    const held = flight(full, 'a');
    expect(tapped.peak, `a tap reached ${tapped.peak.toFixed(2)} m against ${held.peak.toFixed(2)} held`).toBeLessThan(held.peak * .6);
    // Round 4b (JUMP): still a real hop, not a stumble - higher than the old
    // full jump, at about the share of it the old hop was.
    expect(tapped.peak, 'still a real hop, not a stumble').toBeGreaterThan(Math.max(JUMP_BEFORE.apex, held.peak * .4));
    expect(tapped.rise + tapped.fall, 'and over sooner').toBeLessThan((held.rise + held.fall) * .8);
    // Letting go on the way DOWN changes nothing.
    const late = new ArenaSimulation({ trainingBot: false, seed: 5 });
    late.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
    late.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, jump: true, jumpHeld: true });
    const actor = late.actors.get('a')!;
    let peak = 0, ticks = 0;
    for (let i = 0; i < 240; i++) { late.step(); ticks++; peak = Math.max(peak, actor.state.y); if (actor.vy < 0) actor.input.jumpHeld = false; if (ticks > 3 && actor.state.grounded) break; }
    expect(peak).toBeCloseTo(held.peak, 2);
    hop.dispose(); full.dispose(); late.dispose();
  });

  it('leaves a launched fighter\'s hang time alone', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 1.6 });
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'heavy', targetId: 'b' });
    for (let i = 0; i < 120 && sim.getPlayer('b')!.grounded; i++) sim.step();
    const victim = sim.actors.get('b')!;
    expect(victim.state.action).toBe('launched');
    const v0 = victim.vy;
    // The launch arc is symmetric: LAUNCH_GRAVITY on the way up and the way
    // down. Counted in ticks the body is actually moving - the impact freeze
    // holds it mid-air with its velocity intact for a tenth of a second.
    let rise = 0, fall = 0;
    for (let i = 0; i < 240 && !victim.state.grounded; i++) {
      if (!victim.state.hitstop) { if (victim.vy > 0) rise++; else fall++; }
      sim.step();
    }
    expect(victim.state.grounded).toBe(true);
    const expected = v0 / (23 * LAUNCH_GRAVITY) * 60;
    expect(Math.abs(rise - expected), `rose for ${rise} ticks against ${expected.toFixed(1)} analytic`).toBeLessThan(3);
    expect(fall, `fell for ${fall} ticks against ${rise} up`).toBeGreaterThan(rise * .9);
    expect(fall).toBeLessThan(rise * 1.1);
    sim.dispose();
  });

  it('is not a jump any more once a hit has landed', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'kenzo', 'B', false, { x: 0, y: 0, z: 1.6 });
    // The swing is already on its way, and the jump leaves the floor just
    // before it lands - so the blow catches a body a few centimetres up,
    // where a jab can still reach it. Round 4b (JUMP): a tick before it, not
    // two: the rise is three times as fast, and two ticks off the floor is
    // already over a jab's head.
    sim.submitInput('b', { seq: 1, moveX: 0, moveZ: 0, yaw: Math.PI, attack: 'light', targetId: 'a' });
    for (let i = 0; i < Math.round(MOVES.kenzo.light.contacts[0] * 60) - 1; i++) sim.step();
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, jump: true });
    sim.step();
    const jumper = sim.actors.get('a')!;
    expect(jumper.state.grounded).toBe(false);
    expect(jumper.jumping).toBe(true);
    let hit = false;
    for (let i = 0; i < 30 && !hit; i++) { sim.step(); hit = sim.getPlayer('a')!.hp < 1000; }
    expect(hit, 'the jab connected').toBe(true);
    expect(jumper.jumping, 'the body belongs to the reaction now').toBe(false);
    sim.dispose();
  });
});
