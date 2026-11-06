import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { CONTACT_GAP, MAX_APPROACH, MOVES, PLAYER_RADIUS, PUSH_RADIUS, meleeReach } from '../src/game/moves';
import { ENVIRONMENT_COLLIDERS, UME_TREES } from '../src/game/environmentLayout';
import type { CombatEvent, FighterId, Vec3 } from '../src/game/types';
import { METEOR_COMBINATION, withMove } from './retiredMoves';

// Round 3: Taisei's heavy is Cloudstep, one kick after a teleport.
// The heavy-string cases below pin the approach Taisei alone makes between the
// blows of a melee string, so they put the retired Meteor Combination back;
// tests/cloudstep.test.ts covers the new move's own approach.

async function fixture(gap = 1.65, fighter: FighterId = 'taisei', origin: Vec3 = { x: 0, y: 0, z: 0 }) {
  const sim = new ArenaSimulation({ trainingBot: false, collision: await createRapierCollision() });
  sim.addPlayer('a', fighter, 'Attacker', false, origin);
  sim.addPlayer('b', 'konta', 'Target', false, { ...origin, z: origin.z + gap });
  return sim;
}
const cast = (sim: ArenaSimulation, attack: 'light' | 'heavy' = 'heavy') => sim.submitInput('a', {
  seq: 0, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack,
});
const separation = (event: CombatEvent) => Math.hypot(event.endpoint!.x - event.origin!.x, event.endpoint!.z - event.origin!.z);

describe('a melee blow lands on a body that is actually there', () => {
  it('reaches the existing capsule minimum at a short light contact without a movement jump', async () => {
    const sim = await fixture();
    try {
      cast(sim, 'light'); let previous = sim.getPlayer('a')!, contact: CombatEvent | undefined;
      for (let frame = 0; frame < 35; frame++) {
        sim.step(); const current = sim.getPlayer('a')!, target = sim.getPlayer('b')!;
        expect(Math.hypot(current.x - previous.x, current.z - previous.z)).toBeLessThanOrEqual(MAX_APPROACH / 60 + .002);
        expect(Math.hypot(target.x - current.x, target.z - current.z)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .002);
        contact ??= sim.snapshot(true).events.find(e => e.kind === 'hit' && e.actorId === 'a'); previous = current;
      }
      expect(contact).toBeDefined(); expect(contact!.contactIndex).toBe(0);
      // Rapier settling can leave centimetres of clearance; physical contact
      // must still be close, not merely inside the old 1.95m attack volume.
      expect(separation(contact!)).toBeGreaterThanOrEqual(.898);
      expect(separation(contact!)).toBeLessThan(PUSH_RADIUS * 2 + .05);
      expect(sim.getPlayer('b')!.hp).toBe(1000 - MOVES.taisei.light.damage);
    } finally { sim.dispose(); }
  });

  it('follows real recoil between later heavy phases and stops approaching after the last contact', () => withMove('taisei', 'heavy', METEOR_COMBINATION, async () => {
    const sim = await fixture();
    try {
      cast(sim); const hits: CombatEvent[] = []; let lastContactAttackerZ: number | undefined, firstContactTargetZ = 0;
      let previous = sim.getPlayer('a')!;
      for (let frame = 0; frame < 70; frame++) {
        sim.step(); const attacker = sim.getPlayer('a')!, target = sim.getPlayer('b')!;
        expect(Math.hypot(attacker.x - previous.x, attacker.z - previous.z)).toBeLessThanOrEqual(MAX_APPROACH / 60 + .002);
        expect(Math.hypot(target.x - attacker.x, target.z - attacker.z)).toBeGreaterThanOrEqual(.898);
        for (const event of sim.snapshot(true).events) if (event.kind === 'hit' && event.actorId === 'a') {
          hits.push(event); if (hits.length === 1) firstContactTargetZ = event.endpoint!.z;
          if (event.contactIndex === 2) lastContactAttackerZ = attacker.z;
        }
        previous = attacker;
      }
      expect(hits.map(e => e.contactIndex)).toEqual([0, 1, 2]);
      // Touching distance, give or take the ease on the approach.
      // The floor is the hitbox, not the pushbox: a lunge arrives inside the
      // push distance and is eased back out over the following frames, so a
      // blow may legitimately land at less than two push radii.
      for (const event of hits) { expect(separation(event)).toBeGreaterThanOrEqual(PLAYER_RADIUS * 2 - .002); expect(separation(event)).toBeLessThan(PUSH_RADIUS * 2 + .05); }
      expect(hits[2].endpoint!.z - firstContactTargetZ).toBeGreaterThan(.2); // target really recoiled
      expect(hits[2].origin!.z - hits[0].origin!.z).toBeGreaterThan(.2); // attacker followed at bounded speed
      expect(sim.getPlayer('a')!.z).toBeCloseTo(lastContactAttackerZ!, 3);
      // The whole three-blow string, each contact scaled by the anti-juggle
      // curve; a function of the move table rather than a number to restate.
      {
        const heavy = MOVES.taisei.heavy, taken = 1000 - sim.getPlayer('b')!.hp;
        expect(taken, `the string took ${taken}`).toBeGreaterThan(heavy.damage * 2);
        expect(taken, `the string took ${taken} unscaled`).toBeLessThanOrEqual(heavy.damage * heavy.contacts.length);
      }
    } finally { sim.dispose(); }
  }));

  it('leaves a distant locked target untouched and does not slide forward for the rest of a whiffed combo', () => withMove('taisei', 'heavy', METEOR_COMBINATION, async () => {
    const sim = await fixture(6);
    try {
      cast(sim); let endOfOpeningZ = 0; const hits: CombatEvent[] = [];
      for (let frame = 0; frame < 75; frame++) {
        sim.step(); hits.push(...sim.snapshot(true).events.filter(e => e.kind === 'hit'));
        // The frame the approach drive stops, which is the move's own first
        // contact - not a fixed 20, which fell inside the opening as soon as
        // the heavy was re-timed.
        if (frame === Math.ceil(MOVES.taisei.heavy.contacts[0] * 60) + 1) endOfOpeningZ = sim.getPlayer('a')!.z;
      }
      expect(hits).toHaveLength(0); expect(sim.getPlayer('b')!.hp).toBe(1000);
      expect(sim.getPlayer('a')!.z).toBeCloseTo(endOfOpeningZ, 3);
      // Round 3e (VARIETY): 1.05, from 1.01. The character controller used
      // to refuse a step along the floor now and then when it carried the
      // tick's fall (rapierCollision.ts), and this opening's step lost its
      // last couple of centimetres to that; the step is taken whole now.
      expect(sim.getPlayer('a')!.z).toBeLessThan(1.05);
    } finally { sim.dispose(); }
  }));

  it('steps into a two-metre opening rather than swinging at the air', async () => {
    const sim = await fixture(2);
    try {
      cast(sim, 'light'); const hits: CombatEvent[] = []; let gap = Infinity;
      for (let frame = 0; frame < 40; frame++) {
        sim.step();
        const found = sim.snapshot(true).events.filter(e => e.kind === 'hit');
        if (found.length && gap === Infinity) {
          const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
          gap = Math.hypot(b.x - a.x, b.z - a.z);
        }
        hits.push(...found);
      }
      // Two metres is a stride, and a fighting game closes it. What used to
      // happen is that the swing played out where it stood and the punch
      // either missed or connected across a metre of nothing.
      expect(hits).toHaveLength(1);
      expect(gap, 'and it landed on him')
        .toBeLessThanOrEqual(meleeReach('taisei', 'light', MOVES.taisei.light) + .05);
    } finally { sim.dispose(); }
  });

  it('will not cross a room to reach somebody', async () => {
    const sim = await fixture(7);
    try {
      cast(sim, 'light'); const hits: CombatEvent[] = [];
      for (let frame = 0; frame < 40; frame++) { sim.step(); hits.push(...sim.snapshot(true).events.filter(e => e.kind === 'hit')); }
      expect(hits, 'a swing thrown at someone seven metres away is a whiff').toHaveLength(0);
      expect(sim.getPlayer('b')!.hp).toBe(1000);
    } finally { sim.dispose(); }
  });

  it('respects a real source prop capsule sweep and wall visibility while a target is selected behind it', () => withMove('taisei', 'heavy', METEOR_COMBINATION, async () => {
    // The trunk of the ume planted at (-34, 36): a post 0.4 m wide and
    // 2.68 m high, read from the collider list rather than restated here,
    // because it stands where the tree's stem is drawn, not on the tree's
    // placement point.
    const tree = UME_TREES.find(t => t.x === -34 && t.z === 36)!;
    const post = [...ENVIRONMENT_COLLIDERS].filter(c => c.halfX < .3)
      .sort((a, b) => Math.hypot(a.x - tree.x, a.z - tree.z) - Math.hypot(b.x - tree.x, b.z - tree.z))[0];
    const face = post.z - post.halfZ - PLAYER_RADIUS;
    const sim = await fixture(2.1, 'taisei', { x: post.x, y: 0, z: face - .43 });
    try {
      cast(sim); const hits: CombatEvent[] = [];
      for (let frame = 0; frame < 70; frame++) {
        sim.step(); hits.push(...sim.snapshot(true).events.filter(e => e.kind === 'hit'));
        expect(sim.getPlayer('a')!.z).toBeLessThan(face + .01);
      }
      expect(hits).toHaveLength(0); expect(sim.getPlayer('b')!.hp).toBe(1000);
      expect(sim.getPlayer('a')!.z).toBeGreaterThan(face - .19);
    } finally { sim.dispose(); }
  }));

  it('does not sweep through a living intervening fighter to reach the locked target', () => withMove('taisei', 'heavy', METEOR_COMBINATION, async () => {
    const sim = await fixture(2.1);
    sim.addPlayer('blocker', 'konta', 'Intervening fighter', false, { x: 0, y: 0, z: 1.05 });
    try {
      // A protected reset-like blocker stays solid even though these hits cannot move it.
      sim.actors.get('blocker')!.evadeUntil = 10;
      cast(sim);
      for (let frame = 0; frame < 70; frame++) {
        sim.step(); const a = sim.getPlayer('a')!, blocker = sim.getPlayer('blocker')!;
        expect(blocker.z - a.z).toBeGreaterThanOrEqual(.898);
        // Never past it. The absolute bound this used to carry was a proxy
        // for that, and it stopped meaning anything once the pushbox got
        // wider than the hitbox: the attacker now shoves the blocker along
        // in front of it, so both slide up the z axis together and the only
        // thing worth asserting is that the order never changes.
        expect(a.z, 'stopped behind the body in the way').toBeLessThan(blocker.z);
      }
      expect(sim.getPlayer('blocker')!.hp).toBe(1000);
    } finally { sim.dispose(); }
  }));

  /** The roster, not just Taisei. Every melee fighter closes to their own
   *  contact distance and lands inside their own measured reach; before this
   *  only Taisei did, and the other nine connected with between one and four
   *  metres of clear air between the two models. */
  for (const fighter of ['konta', 'shiden', 'shirokane', 'koko', 'kenzo', 'nigo', 'kosho', 'ouga', 'setsu', 'oro', 'kagari', 'ward', 'kuon', 'gaunt'] as FighterId[]) {
    it(`${fighter} lands a heavy on a body within reach`, async () => {
      const sim = await fixture(2.4, fighter);
      try {
        cast(sim); let contact: CombatEvent | undefined, gap = Infinity;
        for (let frame = 0; frame < 120; frame++) {
          sim.step();
          const found = sim.snapshot(true).events.find(e => e.kind === 'hit' && e.actorId === 'a');
          if (found && !contact) {
            contact = found;
            const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
            gap = Math.hypot(b.x - a.x, b.z - a.z);
          }
        }
        expect(contact, 'the heavy connected').toBeDefined();
        // Measured on the frame the damage landed, before the knockback has
        // moved anybody: what the player sees at the moment of impact.
        expect(gap, 'the two bodies are not on top of each other').toBeGreaterThan(PUSH_RADIUS * 2 - .05);
        expect(gap, 'and not metres apart').toBeLessThanOrEqual(meleeReach(fighter, 'heavy', MOVES[fighter].heavy) + .05);
        expect(CONTACT_GAP[fighter], 'every melee fighter has a contact distance').toBeGreaterThan(0);
      } finally { sim.dispose(); }
    });
  }
});
