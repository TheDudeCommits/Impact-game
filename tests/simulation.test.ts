import { describe, expect, it } from 'vitest';
import { ArenaSimulation, validateInput } from '../src/game/simulation';
import { BREAK_CASTS, BREAK_EVADE, BREAK_FREEZE, JUST_GUARD_WINDOW, MAX_HP, MOVES, RUSH_WINDOW, damageScale } from '../src/game/moves';
/** Read rather than restated. These used to be written out as 964 and 919,
 *  which is a test about contact and guard failing whenever a jab is retuned. */
const JAB = MOVES.taisei.light.damage, AFTER_JAB = 1000 - JAB;
import type { FighterId, PlayerInput } from '../src/game/types';
import { createRapierCollision } from '../src/game/rapierCollision';

function fixture(mode: 'training' | 'match' = 'training', attacker: FighterId = 'taisei') {
  const sim = new ArenaSimulation({ roomMode: mode, trainingBot: false, seed: 5 });
  sim.addPlayer('a', attacker, 'Attacker', false, { x: 0, y: 0, z: 0 });
  // Close combat starts within the bounded opening's physically reachable gap.
  sim.addPlayer('b', 'konta', 'Konta', false, { x: 0, y: 0, z: 1.6 });
  if (mode === 'match') {
    sim.startMatch();
    // This combat fixture deliberately places opponents in striking range
    // after the real match-start reset has allocated their spawn sectors.
    Object.assign(sim.actors.get('a')!.state, { x: 0, y: 0, z: 0 });
    Object.assign(sim.actors.get('b')!.state, { x: 0, y: 0, z: 1.6 });
  }
  let seq = 0;
  const input = (id: string, extra: Partial<PlayerInput> = {}) => sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, ...extra });
  const advance = (seconds: number, held?: () => void) => {
    for (let n = 0; n < Math.ceil(seconds * 60); n++) { if (held && n % 2 === 0) held(); sim.step(); }
  };
  return { sim, input, advance };
}

describe('authoritative fighting simulation', () => {
  it('travels equally forward, sideways and backward relative to the camera', () => {
    const travelled = (moveX: number, moveZ: number) => {
      const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
      sim.addPlayer('a', 'taisei', 'Taisei', false, { x: 0, y: 0, z: 0 });
      // Camera aim stays north while the body turns into travel.
      for (let n = 0; n < 60; n++) { sim.submitInput('a', { seq: n, moveX, moveZ, yaw: 0 }); sim.step(); }
      const p = sim.getPlayer('a')!;
      sim.dispose();
      return Math.hypot(p.x, p.z);
    };
    const forward = travelled(0, 1), sideways = travelled(1, 0), backward = travelled(0, -1);
    expect(forward, 'a fighter who cannot walk forwards').toBeGreaterThan(5);
    expect(sideways).toBeCloseTo(forward, 6);
    expect(backward).toBeCloseTo(forward, 6);
  });

  it('rejects NaN, oversized movement, unknown attacks and stale sequences; client damage fields have no effect', () => {
    const { sim, input, advance } = fixture();
    expect(validateInput({ seq: 1, moveX: NaN, moveZ: 0, yaw: 0 })).toBeNull();
    expect(validateInput({ seq: 1, moveX: 20, moveZ: 0, yaw: 0 })).toBeNull();
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'kill' })).toBeNull();
    expect(input('a')).toBe(true);
    expect(sim.submitInput('a', { seq: 0, moveX: 1, moveZ: 0, yaw: 0 })).toBe(false);
    expect(sim.submitInput('a', { seq: 2, moveX: 0, moveZ: 0, yaw: 0, damage: 9999, hp: 0 })).toBe(true);
    advance(0.2);
    expect(sim.getPlayer('b')?.hp).toBe(1000);
    expect(sim.getPlayer('a')?.hp).toBe(1000);
  });

  it('does not damage before contact, hits once at contact and whiffs outside reach', () => {
    const { sim, input, advance } = fixture();
    input('a', { attack: 'light' });
    advance(0.1);
    expect(sim.getPlayer('b')?.hp).toBe(1000);
    advance(0.4);
    expect(sim.getPlayer('b')?.hp).toBe(AFTER_JAB);
    advance(1);
    expect(sim.getPlayer('b')?.hp).toBe(AFTER_JAB);
    sim.actors.get('b')!.state.z = 10;
    input('a', { attack: 'light' });
    advance(0.6);
    expect(sim.getPlayer('b')?.hp).toBe(AFTER_JAB);
  });

  it('closes a short locked melee gap without lunging through the opponent', () => {
    const { sim, input, advance } = fixture();
    input('a', { attack: 'light', targetId: 'b' });
    advance(.3);
    const a=sim.getPlayer('a')!,b=sim.getPlayer('b')!;
    expect(b.hp).toBe(AFTER_JAB);
    expect(a.z).toBeGreaterThan(.5);
    expect(b.z-a.z).toBeGreaterThanOrEqual(.9);
    const distant=fixture();
    distant.sim.actors.get('b')!.state.z=3;
    distant.input('a',{attack:'light',targetId:'b'});
    distant.advance(.5);
    expect(distant.sim.getPlayer('b')!.hp).toBe(1000);
  });

  it('launches a central ultimate victim along a substantial arc and lands without lingering velocity', () => {
    const { sim, input, advance } = fixture();
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:'ultimate',targetId:'b'});
    let peak=0,firstHitZ:number|undefined,landingRecovery=false,hitAt=0,helplessSeconds=0;
    for(let i=0;i<Math.ceil((MOVES.taisei.ultimate.contacts[0]+4)*60);i++){
      sim.step();const victim=sim.getPlayer('b')!;
      if(victim.hp<1000){
        if(firstHitZ===undefined){firstHitZ=victim.z;hitAt=sim.serverTime;}
        peak=Math.max(peak,victim.y);
        // Airborne from an ultimate is its own reaction, not a generic stagger.
        if(!victim.grounded)expect(victim.action).toBe('launched');
        if(peak>1&&victim.grounded&&victim.action==='knockdown')landingRecovery=true;
        if(victim.action!=='idle')helplessSeconds=sim.serverTime-hitAt;
      }
    }
    const victim=sim.getPlayer('b')!;
    expect(victim.hp).toBe(715);
    expect(peak).toBeGreaterThan(1.8);
    expect(landingRecovery).toBe(true);
    // What an ultimate buys is the whole span the victim is not their own: hang
    // time, the knockdown and getting up. Juggle gravity moved some of it into
    // the air, which is where it is useful, not out of the move.
    expect(helplessSeconds).toBeGreaterThanOrEqual(2.8);
    expect(victim.action).toBe('idle');
    expect(victim.z-firstHitZ!).toBeGreaterThan(4.5);
    expect(victim.z-firstHitZ!).toBeLessThan(6);
    expect(victim.grounded).toBe(true);
    const landings=sim.snapshot().events.filter(e=>e.kind==='land'&&e.actorId==='b');
    expect(landings).toHaveLength(1);
    // The lightweight flat-floor backend admits a 3cm ground-contact skin.
    expect(landings[0].origin?.y).toBeGreaterThanOrEqual(0);
    expect(landings[0].origin?.y).toBeLessThanOrEqual(.03);
    const landedZ=victim.z;advance(1);
    expect(victim.z-landedZ).toBeLessThan(.1);
    expect(sim.snapshot().events.filter(e=>e.kind==='land'&&e.actorId==='b')).toHaveLength(1);
  });

  it('preserves the six-hit escape even when the last hit is an ultimate knockdown', () => {
    const {sim,input,advance}=fixture();
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:'ultimate',targetId:'b'});advance(MOVES.taisei.ultimate.contacts[0]-.1);
    const target=sim.actors.get('b')!;
    // Two counters: the breaker's budget (casts) and the damage scaler
    // (contacts). Five of each: five single-contact casts have landed.
    target.chainHits=5;target.scalingHits=5;target.lastDamageAt=sim.serverTime;
    // Impact freeze pauses the escape window with everything else, so the
    // hand-back lands just after the freeze rather than during it - and the
    // breaker freezes both fighters on top of the ultimate's own stop.
    advance(.62);
    // Five prior hits scale the ultimate down; a long string is worth less than
    // the sum of its moves, which is what stops one opening ending the round.
    expect(target.state.hp).toBe(MAX_HP-Math.round(MOVES.taisei.ultimate.damage*damageScale(6)));
    expect(target.evadeUntil).toBeGreaterThan(sim.serverTime);
    expect(target.stunUntil).toBeLessThan(sim.serverTime);
    expect(target.state.action).not.toBe('hurt');
    input('b',{moveX:1});advance(.1);
    expect(target.state.x).toBeGreaterThan(.1);
  });

  it('answers the sixth hit of a string with a break both fighters can see', () => {
    // The breaker used to happen in silence: the target was handed 0.6 s of
    // evade and the attack passed through a body standing in front of them,
    // which reads as the game dropping a hit rather than as an escape.
    const { sim, input, advance } = fixture();
    const attacker = sim.actors.get('a')!, target = sim.actors.get('b')!;
    target.chainHits = 5; target.lastDamageAt = sim.serverTime;
    input('a', { attack: 'light', targetId: 'b' });
    advance(MOVES.taisei.light.contacts[0] + .05);
    const breaks = sim.snapshot().events.filter(e => e.kind === 'break');
    expect(breaks).toHaveLength(1);
    expect(breaks[0].actorId, 'the fighter who broke out owns the event').toBe('b');
    expect(breaks[0].targetId).toBe('a');
    expect(breaks[0].origin).toBeDefined();
    // Both fighters feel it. The attacker's half is a freeze, so the move they
    // paid for is still theirs when it hands the body back.
    expect(attacker.hitstopUntil).toBeGreaterThan(sim.serverTime);
    expect(target.hitstopUntil).toBeGreaterThan(sim.serverTime);
    expect(attacker.cast, 'a breaker is not a move delete').not.toBeNull();
    // The escape window is what it takes to get out of the swing that is out,
    // not a free half second. Impact freeze holds it with every other timer,
    // so what is left of it here is the window plus the break's own freeze.
    expect(target.evadeUntil - sim.serverTime).toBeLessThanOrEqual(BREAK_EVADE + BREAK_FREEZE);
    const met = target.state.z;
    advance(.4);
    expect(target.state.z, 'and it shoves the pair apart').toBeGreaterThan(met + .2);
  });

  it('charges the breaker once per cast, not once per contact', () => {
    // The budget used to count contacts and read its threshold off whichever
    // move had just landed - `max(6, contacts + 1)` - so Konta's three-hit
    // light tripped it on his second cast, six contacts in, while KoKo
    // could push past the same count by switching into an eight-hit GAN.
    // Two three-contact casts are two charges, and six single-contact casts
    // are six. Damage scaling is the other counter and still counts every
    // contact: it is never reset by the breaker.
    //
    // Each press here waits out the rush window: a light pressed inside it is
    // the string's next stage (see 'rush strings' below), which shares the
    // charge of the stage before it.
    const twice = fixture();
    const light = MOVES.konta.light;
    expect(light.contacts.length, 'the test needs a multi-contact light').toBe(3);
    for (let cast = 0; cast < 2; cast++) {
      twice.input('b', { attack: 'light', targetId: 'a' });
      twice.advance(light.duration + RUSH_WINDOW + .1);
    }
    twice.advance(1);
    const events = twice.sim.snapshot().events;
    expect(events.filter(e => e.kind === 'cast' && e.actorId === 'b').map(e => e.chain), 'two fresh lights').toEqual([0, 0]);
    expect(events.filter(e => e.kind === 'hit' && e.actorId === 'b')).toHaveLength(2 * light.contacts.length);
    expect(events.filter(e => e.kind === 'break'), 'six contacts from two casts are not a string of six').toHaveLength(0);
    const victim = twice.sim.actors.get('a')!;
    expect(victim.chainHits, 'two casts, two charges').toBe(2);
    expect(victim.scalingHits, 'six contacts, six steps of scaling').toBe(2 * light.contacts.length);

    // Six single-contact casts: six fresh jabs, each pressed once the one
    // before has finished and its rush window has shut, a second apart - well
    // inside the 1.2 s of quiet that would reset the count.
    const six = fixture();
    expect(MOVES.taisei.light.contacts, 'the test needs a single-contact light').toHaveLength(1);
    for (let frame = 0; frame < 60 * 6.5; frame++) { if (frame % 60 === 0) six.input('a', { attack: 'light', targetId: 'b' }); six.sim.step(); }
    const jabs = six.sim.snapshot().events;
    expect(jabs.filter(e => e.kind === 'cast' && e.actorId === 'a').every(e => e.chain === 0), 'every one a fresh jab').toBe(true);
    const broke = jabs.find(e => e.kind === 'break');
    expect(broke, 'six single-contact casts do trip it').toBeDefined();
    // The escaped contact still lands - it is announced, and it is the sixth.
    expect(jabs.filter(e => e.kind === 'hit' && e.serverTime <= broke!.serverTime)).toHaveLength(BREAK_CASTS);

    // Mashed, the same button is a rush string now - four stages, the last
    // one a launcher - and a whole string is one cast against the budget. It
    // used to be six jabs into the breaker inside two seconds.
    // Mashing on past the finisher chases it and starts an air string, which
    // is a cast of its own (tests/lightChase.test.ts); this is the string.
    const mash = fixture();
    const finished = () => mash.sim.snapshot().events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.chain === 3);
    for (let frame = 0; frame < 120 && !finished(); frame++) { mash.input('a', { attack: 'light', targetId: 'b' }); mash.sim.step(); }
    const rush = mash.sim.snapshot().events;
    expect(rush.filter(e => e.kind === 'hit' && e.actorId === 'a').map(e => e.chain)).toEqual([0, 1, 2, 3]);
    expect(rush.filter(e => e.kind === 'break')).toHaveLength(0);
    expect(mash.sim.actors.get('b')!.chainHits, 'one string, one charge').toBe(1);
  });

  it('a guard reduces damage from any side, charges more from behind, and repeated heavies break it', () => {
    // Held from before the swing: a jab lands inside a parry window opened on its swing (JUST_GUARD_WINDOW).
    const front = fixture();
    front.advance(JUST_GUARD_WINDOW + .05, () => front.input('b', { guard: true }));
    front.input('a', { attack: 'light' });
    front.advance(0.3, () => front.input('b', { guard: true }));
    expect(front.sim.getPlayer('b')!.hp).toBeGreaterThan(980);
    expect(front.sim.snapshot().events.some(e => e.kind === 'blocked')).toBe(true);
    // Round 5 (PARRY): a held guard covers every side
    // (GUARD_REAR_COST): the blow from behind is blocked too, at a higher price.
    const rear = fixture();
    rear.advance(JUST_GUARD_WINDOW + .05, () => rear.input('b', { guard: true, yaw: 0 }));
    rear.input('a', { attack: 'light' });
    rear.advance(0.3, () => rear.input('b', { guard: true, yaw: 0 }));
    expect(rear.sim.getPlayer('b')!.hp, 'blocked from behind').toBeGreaterThan(AFTER_JAB);
    const blocked = rear.sim.snapshot().events.find(e => e.kind === 'blocked');
    expect(blocked?.fromBehind, 'and the event says where from').toBe(true);
    expect(rear.sim.getPlayer('b')!.stamina, 'at a higher price than a front block').toBeLessThan(front.sim.getPlayer('b')!.stamina);
    // One heavy is blocked. Every heavy in the roster used to carry
    // guardBreak, which made holding guard against one strictly worse than
    // eating it - 60% of the damage and a second of dizzy on top - so the
    // game had no defensive layer a new player could find. It still empties a
    // guard in two, through the stamina it costs.
    // Taisei's heavy is Cloudstep since round 3: it comes back behind
    // the guard, and a held guard turns to meet it. Timed off its own contact.
    // It goes for the lock, which a player always has (or the auto target).
    const heavy = fixture();
    heavy.input('a', { attack: 'heavy', targetId: 'b' });
    heavy.advance(MOVES.taisei.heavy.contacts[0] + .1, () => heavy.input('b', { guard: true }));
    const first = heavy.sim.snapshot().events;
    expect(first.some(e => e.kind === 'blocked'), 'the first heavy is blocked').toBe(true);
    expect(first.some(e => e.kind === 'guard-break'), 'and not a break').toBe(false);
    let broke = false;
    for (let i = 0; i < 8 && !broke; i++) {
      heavy.input('a', { attack: 'heavy', targetId: 'b' });
      heavy.advance(2.2, () => heavy.input('b', { guard: true }));
      broke = heavy.sim.snapshot().events.some(e => e.kind === 'guard-break');
    }
    expect(broke, 'and the guard still opens under repeated pressure').toBe(true);
  });

  it('prevents special spam and spending unavailable stamina or ultimate meter', () => {
    const { sim, input, advance } = fixture();
    input('a', { attack: 'ultimate' });
    advance(0.05);
    expect(sim.snapshot().events.some(e => e.kind === 'cast')).toBe(false);
    input('a', { attack: 'special' });
    advance(2);
    const firstCooldown = sim.getPlayer('a')!.cooldowns.special;
    input('a', { attack: 'special' });
    advance(0.1);
    expect(sim.getPlayer('a')!.cooldowns.special).toBe(firstCooldown);
    expect(sim.snapshot().events.filter(e => e.kind === 'cast' && e.slot === 'special')).toHaveLength(1);
    sim.actors.get('a')!.state.stamina = 0;
    input('a', { attack: 'heavy' });
    advance(0.05);
    expect(sim.snapshot().events.some(e => e.kind === 'cast' && e.slot === 'heavy')).toBe(false);
  });

  it('does not pay out a beam before its contact, or fire a ghost impact', () => {
    // This used to be called cancelling, and measuring it says otherwise: a
    // light does not break a special, so the beam is never cancelled - being
    // hit freezes the caster and the contact simply arrives later. It passed
    // because two seconds happened to fall before that delayed contact, and
    // stopped passing the moment Sunpalm Cannon was sped up. The window is now
    // stated against the move's own contact time instead of a round number.
    const { sim, input, advance } = fixture();
    input('a', { attack: 'special' });
    // Thrown at him, so the lunge closes the last stride. Untargeted, the
    // light only takes its authored step and stops 1.4 m out; it used to
    // land from there because Konta's reach was measured off a trailing
    // limb (1.83 m of hit range for a fist that gets 0.48 m ahead of him).
    input('b', { attack: 'light', targetId: 'a' });
    advance(MOVES.taisei.special.contacts[0] - .2);
    expect(sim.getPlayer('a')!.hp).toBeLessThan(1000);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    expect(sim.snapshot().events.filter(e => e.kind === 'hit' && e.actorId === 'a')).toHaveLength(0);
  });

  it('sweeps a projectile into a target and does not apply instant cast damage', () => {
    const { sim, input, advance } = fixture();
    sim.actors.get('a')!.state.z = -12;
    input('b', { attack: 'special', targetId: 'a' });
    advance(0.7);
    expect(sim.getPlayer('a')!.hp).toBe(1000);
    advance(0.5);
    expect(sim.getPlayer('a')!.hp).toBe(875);
  });

  it('uses authoritative cover for beams and melee visibility', () => {
    const sim = new ArenaSimulation({ trainingBot: false, collision: {
      move: (_id, p, d) => ({...d,y:Math.max(-p.y,d.y)}),
      raycast: (from, to) => to.z > 4 ? { x: from.x, y: from.y, z: 4 } : to,
    } });
    sim.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'konta', 'B', false, { x: 0, y: 0, z: 8 });
    sim.submitInput('a', { seq: 0, moveX: 0, moveZ: 0, yaw: 0, attack: 'special' });
    for (let i = 0; i < 120; i++) sim.step();
    expect(sim.getPlayer('b')!.hp).toBe(1000);
  });

  it('normalizes diagonal travel and stops stale held input after a connection lapse', () => {
    // Measured against a straight run over the same time rather than against a
    // distance: ground speed ramps now, so the number a fighter covers in a
    // fifth of a second is a property of the acceleration curve, while the
    // thing this test is about - that holding two directions is not faster
    // than holding one - is not.
    // Facing along the travel in both, so both are a straight advance: speed
    // depends on the angle between the two now, and the question here is only
    // whether holding a second direction buys distance.
    const straight = (() => {
      const { sim, input, advance } = fixture();
      input('a', { moveZ: -1, yaw: Math.PI });
      advance(0.4);
      const p = sim.getPlayer('a')!;
      return Math.hypot(p.x, p.z);
    })();
    const { sim, input, advance } = fixture();
    input('a', { moveX: 1, moveZ: -1, yaw: Math.atan2(1, -1) });
    advance(0.4);
    const p = sim.getPlayer('a')!;
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(straight, 2);
    expect(straight).toBeGreaterThan(2);
    advance(0.5);
    const stopped = sim.getPlayer('a')!;
    advance(0.5);
    expect(sim.getPlayer('a')!.x).toBe(stopped.x);
    expect(sim.getPlayer('a')!.z).toBe(stopped.z);
  });

  it('spends full ultimate meter and produces a delayed area hit', () => {
    const { sim, input, advance } = fixture();
    sim.actors.get('a')!.state.ultimate = 100;
    input('a', { attack: 'ultimate', targetId: 'b' });
    advance(0.1);
    expect(sim.getPlayer('a')!.ultimate).toBe(0);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    advance(MOVES.taisei.ultimate.contacts[0]+.4);
    expect(sim.getPlayer('b')!.hp).toBe(715);
  });

  it('restarts the recipient reaction at each confirmed combo contact', () => {
    // Konta's barrage: Taisei's heavy was the string here until round 3 made it
    // Cloudstep, a single blow.
    const { sim, input, advance } = fixture('training', 'konta');
    // Timed off the string's own contacts. A fixed 0.3 landed between the
    // first and second blow of the old timing and before the first of the new.
    const string = MOVES.konta.light;
    input('a', { attack: 'light', targetId: 'b' });
    advance(string.contacts[0] + .06);
    const first = sim.getPlayer('b')!;
    // A mid-string tick flinches; only the finisher staggers or launches.
    expect(first.action).toBe('flinch');
    advance(string.contacts[1] - string.contacts[0]);
    const second = sim.getPlayer('b')!;
    // Scaled by the anti-juggle curve, so a little under the table figure.
    const blow = first.hp - second.hp;
    expect(blow, `the second blow took ${blow}`).toBeGreaterThan(string.damage * .8);
    expect(blow, `the second blow took ${blow}`).toBeLessThanOrEqual(string.damage);
    expect(second.actionStarted).toBeGreaterThan(first.actionStarted);
    expect(second.actionTime).toBeLessThan(0.3);
  });

  it('keeps the melee finisher victim reacting through its short launch and landing', () => {
    const {sim,input,advance}=fixture();
    input('a',{attack:'light',targetId:'b'});advance(.8);
    // Past the last contact of the heavy rather than a fixed 0.7 - the point
    // is that the finisher lands, and where it lands is the move table's.
    // Round 3: Taisei's heavy is Cloudstep, one kick in the back.
    const heavy = MOVES.taisei.heavy;
    input('a',{attack:'heavy',targetId:'b'});advance(heavy.contacts[heavy.contacts.length-1]+.04);
    // The kick on top of the jab, scaled by the anti-juggle curve if the two
    // were close enough to count as one string.
    const taken = 1000 - sim.getPlayer('b')!.hp;
    expect(taken, `the jab and the kick took ${taken}`).toBeGreaterThan(JAB + heavy.damage * .8);
    expect(taken, `the jab and the kick took ${taken} unscaled`).toBeLessThanOrEqual(JAB + heavy.damage);
    const kick=sim.getPlayer('b')!;
    // Launch, land, knockdown, get up: the finisher ends in a knockdown rather
    // than a stagger that snaps straight back to idle.
    const seen=new Set<string>();
    for(let frame=0;frame<120;frame++){
      const victim=sim.getPlayer('b')!;
      if(!victim.grounded)expect(victim.action).toBe('launched');
      seen.add(victim.action);
      sim.step();
    }
    expect([...seen]).toEqual(expect.arrayContaining(['launched','knockdown','getup']));
    // Kicked from behind, so away from wherever Taisei came back.
    const landed=sim.getPlayer('b')!;
    expect(Math.hypot(landed.x-kick.x,landed.z-kick.z)).toBeGreaterThan(1.5);
    advance(.6);expect(sim.getPlayer('b')!.action).toBe('idle');
  });

  it('pushes a target at the exact bomb centre along the incoming trajectory', () => {
    const { sim, input, advance } = fixture();
    sim.actors.get('a')!.state.ultimate = 100;
    input('a', { attack: 'ultimate', targetId: 'b' });
    // The bomb travels, and both fighters freeze on impact, so the push is
    // measured after the freeze rather than during it.
    advance(MOVES.taisei.ultimate.contacts[0]+.6);
    const target = sim.getPlayer('b')!;
    expect(target.hp).toBe(715);
    expect(target.z).toBeGreaterThan(3);
    expect(target.y).toBeGreaterThan(0);
    expect(target.x).toBeCloseTo(0);
  });

  it('emits one projectile release for audio at launch and none for an interrupted charge', () => {
    const live=fixture();live.sim.actors.get('a')!.state.ultimate=100;
    live.input('a',{attack:'ultimate',targetId:'b'});live.advance(MOVES.taisei.ultimate.contacts[0]-.1);
    expect(live.sim.snapshot().events.filter(e=>e.kind==='release')).toHaveLength(0);
    live.advance(.15);
    const release=live.sim.snapshot().events.filter(e=>e.kind==='release');
    expect(release).toHaveLength(1);
    expect(release[0].slot).toBe('ultimate');
    live.advance(1);expect(live.sim.snapshot().events.filter(e=>e.kind==='release')).toHaveLength(1);
    // Attack armour: a light trades damage but leaves the ultimate running.
    const traded=fixture();traded.sim.actors.get('a')!.state.ultimate=100;
    traded.input('a',{attack:'ultimate',targetId:'b'});traded.advance(.3);
    traded.input('b',{attack:'light',targetId:'a'});traded.advance(MOVES.taisei.ultimate.duration);
    expect(traded.sim.getPlayer('a')!.hp).toBeLessThan(1000);
    expect(traded.sim.snapshot().events.filter(e=>e.kind==='release'&&e.actorId==='a')).toHaveLength(1);
    // A special trades with a charging ultimate; only another ultimate stops it.
    const survived=fixture();survived.sim.actors.get('a')!.state.ultimate=100;
    survived.input('a',{attack:'ultimate',targetId:'b'});survived.advance(.3);
    survived.input('b',{attack:'special',targetId:'a'});survived.advance(MOVES.taisei.ultimate.duration);
    expect(survived.sim.getPlayer('a')!.hp).toBeLessThan(1000);
    expect(survived.sim.snapshot().events.filter(e=>e.kind==='release'&&e.actorId==='a')).toHaveLength(1);
    const interrupted=fixture();
    interrupted.sim.actors.get('a')!.state.ultimate=100;interrupted.sim.actors.get('b')!.state.ultimate=100;
    interrupted.input('a',{attack:'ultimate',targetId:'b'});interrupted.advance(.3);
    interrupted.input('b',{attack:'ultimate',targetId:'a'});interrupted.advance(MOVES.taisei.ultimate.duration);
    expect(interrupted.sim.getPlayer('a')!.hp).toBeLessThan(1000);
    expect(interrupted.sim.snapshot().events.filter(e=>e.kind==='release'&&e.actorId==='a')).toHaveLength(0);
  });

  it('resolves FFA elimination and winner with no respawn', () => {
    const { sim, input, advance } = fixture('match');
    sim.actors.get('b')!.state.hp = 1;
    input('a', { attack: 'light' });
    advance(4);
    expect(sim.getPlayer('b')!.alive).toBe(false);
    expect(sim.snapshot().status).toBe('finished');
    expect(sim.snapshot().winnerId).toBe('a');
  });

  it('respawns training defeats and clearly identifies the sole default sparring bot', () => {
    const bot = new ArenaSimulation();
    expect(bot.snapshot().players.filter(p => p.isBot).map(p => p.name)).toEqual(['Sparring bot']);
    const { sim, input, advance } = fixture();
    sim.actors.get('b')!.state.hp = 1;
    input('a', { attack: 'light' });
    advance(4);
    expect(sim.getPlayer('b')!.alive).toBe(true);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
  });

  it('replays the same seeded bot simulation and input stream identically', () => {
    const run = () => {
      const sim = new ArenaSimulation({ seed: 33 });
      sim.addPlayer('a');
      for (let i = 0; i < 300; i++) {
        if (i % 2 === 0) sim.submitInput('a', { seq: i, moveX: 0, moveZ: i < 60 ? -1 : 0, yaw: Math.PI, attack: i === 100 ? 'special' : undefined });
        sim.step();
      }
      return sim.snapshot();
    };
    expect(run()).toEqual(run());
  });
});

describe('Rapier environment collision', () => {
  it('keeps a capsule on the floor, stops at a boundary and clips a ray at the wall', async () => {
    const collision = await createRapierCollision();
    const floor = collision.move('a', { x: 0, y: 0.1, z: 0 }, { x: 0, y: -2, z: 0 });
    expect(floor.y).toBeGreaterThan(-0.11);
    const wall = collision.move('a', { x: 79, y: 0.1, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(wall.x).toBeLessThan(0.6);
    const end = collision.raycast!({ x: 79, y: 1, z: 0 }, { x: 100, y: 1, z: 0 });
    expect(end.x).toBeCloseTo(80, 1);
    collision.dispose!();
  });
});

describe('training controls', () => {
  it('keeps practice reset and awakening controls out of battle royale matches', () => {
    const sim=new ArenaSimulation({roomMode:'match'});sim.addPlayer('a');
    for(const command of ['reset','awakening','passive','combat'])expect(sim.trainingCommand('a',command)).toBe(false);
    expect(sim.getPlayer('a')!.ultimate).toBe(0);
    expect(sim.getPlayer('a')!.awakening).toBe(0);
  });
  it('stops the bot and restores practice fighters only for members of a training room', () => {
    const sim=new ArenaSimulation();sim.addPlayer('a');
    expect(sim.trainingCommand('outsider','awakening')).toBe(false);
    expect(sim.trainingCommand('a','passive')).toBe(true);
    const before=sim.getPlayer('sparring-bot')!;
    for(let i=0;i<600;i++)sim.step();
    expect(sim.getPlayer('sparring-bot')!.z).toBe(before.z);
    expect(sim.getPlayer('a')!.hp).toBe(1000);
    expect(sim.trainingCommand('a','awakening')).toBe(true);
    // Both bars: the practice tool fills the ultimate and the awakening.
    expect(sim.getPlayer('a')!.ultimate).toBe(100);
    expect(sim.getPlayer('a')!.awakening).toBe(100);
    sim.trainingCommand('a','reset');
    expect(sim.getPlayer('a')!.ultimate).toBe(0);
    expect(sim.getPlayer('a')!.awakening).toBe(0);
  });
});

describe('harbor traversal',()=>{
  it('supports fighters on a bridge and lets them fall into the open canal',async()=>{
    const world=await createRapierCollision();
    const bridge=world.move('bridge',{x:27,y:.1,z:-35},{x:0,y:-2,z:0});
    const canal=world.move('canal',{x:0,y:.1,z:-35},{x:0,y:-2,z:0});
    expect(bridge.y).toBeGreaterThan(-.11);expect(canal.y).toBeLessThan(-1.8);world.dispose!();
  });
  it('keeps a defeated body on a running clock so it can fall over', async () => {
    // `eliminate()` used to start 'defeated' with the default duration of
    // zero, and the dead branch of the step loop `continue`d before the line
    // that advances actionTime - so a death had no clock at all. The renderer
    // drives every finite action from that clock, so the death clip was held
    // on its first frame, which is a fighter standing up, for the whole three
    // seconds. Both are asserted: a real duration, and a clock that moves.
    const world = await createRapierCollision();
    const sim = new ArenaSimulation({ trainingBot: false, collision: world });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: -35 });
    for (let i = 0; i < 70; i++) sim.step();
    const dead = sim.getPlayer('a')!;
    expect(dead.alive, 'the fighter actually died').toBe(false);
    expect(dead.action).toBe('defeated');
    expect(dead.actionDuration, 'a death with no duration cannot be animated').toBeGreaterThan(0);
    const early = dead.actionTime;
    for (let i = 0; i < 30; i++) sim.step();
    const later = sim.getPlayer('a')!.actionTime;
    expect(later, `the death clock stayed at ${early}`).toBeGreaterThan(early);
    expect(later, 'and it is a fraction of the way through, not past the end').toBeLessThanOrEqual(1);
    sim.dispose();
  });

  it('resolves a water fall as a training elimination',async()=>{
    const world=await createRapierCollision();const sim=new ArenaSimulation({trainingBot:false,collision:world});
    sim.addPlayer('a','taisei','A',false,{x:0,y:0,z:-35});
    for(let i=0;i<70;i++)sim.step();
    expect(sim.getPlayer('a')!.alive).toBe(false);expect(sim.snapshot().events.some(e=>e.kind==='eliminated')).toBe(true);sim.dispose();
  });
});
