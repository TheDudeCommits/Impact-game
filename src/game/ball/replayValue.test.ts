import { describe, expect, it } from 'vitest';
import { BallMatch, DRILL_RIVAL } from './BallMatch';
import { hasStances } from './stance';
import { BALL_ID, GOAL_RULES, RUMBLE, SPIKE_RULES } from './model';
import { BALL_MUTATORS, MUTATOR_RULES, isMutator, weeklyMutator, weeklyTurnover } from './mutators';
import { BALL_TRAITS, TRAIT_RULES, traitOf, withTrait } from './traits';
import { DRILLS, DRILL_IDS, MODE_DRILLS, medalFor, type DrillId } from './drills';
import { speedCap } from './physics';
import type { ExternalBlow } from '../simulation';
import type { MoveDefinition } from '../moves';
import type { FighterId } from '../types';
import { MOVES } from '../moves';

const MOVE: MoveDefinition = { name: 'Test Blow', duration: .4, contacts: [.1], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string, slot: ExternalBlow['slot'] = 'heavy'): ExternalBlow =>
  ({ attackerId, slot, move: MOVE, damage: 10, critical: false, finisher: true, pushX: 0, pushZ: 1, knockback: 4, stun: .2, launch: false, hitstop: .05 });
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
function pair(mode: 'goal-rush' | 'sky-spike', mutator: BallMatch['view']['mutator'], rumble = false) {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false, mutator, rumble });
  m.add('red-1', 'taisei', 'Red', false, 'red'); m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  return m;
}
function aim(m: BallMatch, id: string, yaw: number) {
  const a = m.sim.actors.get(id)!;
  a.attackYaw = yaw; a.input.yaw = yaw; a.state.yaw = yaw;
  m.sim.place(id, { x: m.ball.x - Math.sin(yaw), y: 0, z: m.ball.z - Math.cos(yaw) }, yaw);
}

describe('mutators', () => {
  it('rotates one featured mutator a week, the same for everyone, turning over at midnight UTC on Monday', () => {
    const monday = Date.UTC(2026, 10, 9), sunday = Date.UTC(2026, 10, 15, 23, 59);
    expect(weeklyMutator(monday)).toBe(weeklyMutator(sunday));
    expect(weeklyMutator(monday + 7 * 86_400_000)).not.toBe(weeklyMutator(monday));
    expect(weeklyTurnover(monday)).toBe(Date.UTC(2026, 10, 16));
    expect(new Set(Array.from({ length: 4 }, (_, i) => weeklyMutator(monday + i * 7 * 86_400_000)))).toEqual(new Set(BALL_MUTATORS));
    expect(isMutator('two-balls')).toBe(false); expect(isMutator('heat-rush')).toBe(true);
  });
  it('HEAT RUSH starts every kickoff and serve at tier 3, and the ball never cools below 2', () => {
    const m = pair('goal-rush', 'heat-rush');
    expect(m.ball.heat).toBe(MUTATOR_RULES.heatStart);
    until(m, () => m.view.phase === 'live');
    steps(m, 12);
    expect(m.ball.heat).toBeGreaterThanOrEqual(MUTATOR_RULES.heatFloor);
    expect(m.ball.heat).toBeLessThan(MUTATOR_RULES.heatStart);
    const s = pair('sky-spike', 'heat-rush');
    expect(s.ball.heat).toBe(MUTATOR_RULES.heatStart);
  });
  it('LOW GRAVITY lightens the ball all match, and a shot on target still finds the goal', () => {
    const m = pair('goal-rush', 'low-gravity');
    expect(m.ball.grav).toBe(MUTATOR_RULES.gravity);
    until(m, () => m.view.phase === 'live');
    // (Just past blue's kickoff mark, half the half-length out.)
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 8.5; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    expect(until(m, () => m.view.score.red > 0, 4)).toBe(true);
  });
  it('GIANT BALL keeps the ball 1.6 times its size, and RUMBLE\'s GIANT BALL charm lapses back to it', () => {
    const m = pair('goal-rush', 'giant-ball', true);
    expect(m.ball.size).toBe(MUTATOR_RULES.size);
    expect(m.ball.y).toBeCloseTo(GOAL_RULES.ballRadius * MUTATOR_RULES.size + .02, 5);
    // (A mutator and RUMBLE are one choice on the sheet; the rules still hold each other's ball right.)
    m.view.rumble = true;
    until(m, () => m.view.phase === 'live');
    m.view.charms.push({ id: 99, kind: 'giant', x: m.sim.actors.get('red-1')!.state.x, z: m.sim.actors.get('red-1')!.state.z, until: m.sim.serverTime + 9 });
    steps(m, .1);
    expect(m.ball.size).toBe(RUMBLE.giantSize);
    steps(m, RUMBLE.seconds.giant + .2);
    expect(m.ball.size).toBe(MUTATOR_RULES.size);
  });
  it('SUDDEN DEATH in Goal Rush: a minute, then the next goal wins whoever scores it', () => {
    const m = pair('goal-rush', 'sudden-death');
    expect(m.view.clock).toBe(MUTATOR_RULES.suddenSeconds);
    until(m, () => m.view.phase === 'live');
    // Red leads 2-0 when the minute is up...
    m.view.score.red = 2; m.view.clock = .05;
    expect(until(m, () => m.view.overtime, 6)).toBe(true);
    expect(m.view.events.some(e => e.kind === 'overtime' && /NEXT GOAL WINS/.test(e.text ?? ''))).toBe(true);
    expect(m.view.phase).not.toBe('over');
    // ...and blue's next goal takes the match.
    until(m, () => m.view.phase === 'live', 8);
    m.ball.x = 0; m.ball.z = -GOAL_RULES.halfZ + 10; m.ball.y = 1;
    aim(m, 'blue-1', Math.PI);
    m.receive(m.locate(BALL_ID)!, blow('blue-1'));
    expect(until(m, () => m.view.phase === 'over', 12)).toBe(true);
    expect(m.view.winner).toBe('blue');
  });
  it('SUDDEN DEATH in Sky Spike: every point is a FEVER point, worth two', () => {
    const m = pair('sky-spike', 'sudden-death');
    expect(m.view.fever).toBe(true);
    const before = m.view.score.red + m.view.score.blue;
    expect(until(m, () => m.view.phase === 'scored', 15)).toBe(true);
    expect(m.view.score.red + m.view.score.blue - before).toBe(2);
  });
  it('lets a private room\'s host pick a mutator in the lobby, and only the host', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    m.add('h', 'taisei', 'H', false, 'red'); m.add('g', 'konta', 'G', false, 'blue');
    expect(m.setMutator('g', 'giant-ball')).toBe(false);
    expect(m.setMutator('h', 'nonsense')).toBe(false);
    expect(m.setMutator('h', 'sudden-death')).toBe(true);
    expect(m.view.clock).toBe(MUTATOR_RULES.suddenSeconds);
    expect(m.setRumble('h', true)).toBe(true);
    expect(m.view.mutator).toBeNull(); expect(m.view.clock).toBe(GOAL_RULES.matchSeconds);
  });
});

describe('fighter ball traits', () => {
  it('reads one trait off every fighter\'s kit, and every trait has fighters', () => {
    const seen = new Map<string, number>();
    for (const id of Object.keys(MOVES) as FighterId[]) seen.set(traitOf(id), (seen.get(traitOf(id)) ?? 0) + 1);
    for (const trait of BALL_TRAITS) expect(seen.get(trait), trait).toBeGreaterThan(5);
    // A kit whose heavy launches is a AERIALIST's; the seat carries it.
    const launcher = (Object.keys(MOVES) as FighterId[]).find(id => MOVES[id].heavy.outcome === 'launch')!;
    expect(traitOf(launcher)).toBe('aerialist');
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    expect(m.add('a', launcher, 'A').trait).toBe('aerialist');
  });
  it('keeps each edge to a few percent, and never past the speed the heat allows', () => {
    const shot = (kind: 'power' | 'spike' | 'tap', speed: number) => ({ vx: 0, vy: 0, vz: speed, heat: .8, shot: kind, super: false });
    expect(withTrait('striker', 'goal-rush', 0, shot('power', 20)).vz).toBeCloseTo(20 * TRAIT_RULES.groundSpeed, 5);
    expect(withTrait('striker', 'goal-rush', 0, shot('spike', 20)).vz).toBe(20);
    expect(withTrait('aerialist', 'goal-rush', 0, shot('spike', 20)).vz).toBeCloseTo(20 * TRAIT_RULES.airSpeed, 5);
    const cap = speedCap('goal-rush', .8);
    expect(withTrait('striker', 'goal-rush', 0, shot('power', cap)).vz).toBe(cap);
    expect(withTrait('playmaker', 'goal-rush', 0, shot('tap', 13)).heat).toBeCloseTo(.8 + TRAIT_RULES.passHeat, 5);
    expect(withTrait('playmaker', 'goal-rush', 0, shot('power', 13)).heat).toBe(.8);
    expect(withTrait('wall', 'goal-rush', 0, { ...shot('power', 20), super: true }).vz).toBe(20);
  });
  it('lets a WALL\'s guard meet the ball a little further out', () => {
    const reachOf = (trait: 'wall' | undefined) => {
      const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
      m.add('k', 'taisei', 'K', false, 'red').trait = trait; m.add('s', 'konta', 'S', false, 'blue'); m.start(); steps(m, 3.1);
      until(m, () => m.view.phase === 'live');
      const p = m.sim.actors.get('k')!.state;
      m.sim.place('k', { x: 0, y: 0, z: -10 }, 0);
      for (let i = 0; i < 20; i++) { m.submit('k', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, guard: true, targetId: BALL_ID }); m.step(1 / 60); }
      // The ball flying at the keeper from 3 m: where it is when it is first turned back.
      Object.assign(m.ball, { x: 0, y: 1, z: -7, vx: 0, vy: 0, vz: -9, lastTeam: 'blue', held: false });
      for (let i = 0; i < 60 && m.ball.vz < 0; i++) { m.submit('k', { seq: 30 + i, moveX: 0, moveZ: 0, yaw: 0, guard: true, targetId: BALL_ID }); m.step(1 / 60); }
      return m.ball.z - p.z;
    };
    expect(reachOf('wall')).toBeCloseTo(reachOf(undefined) + TRAIT_RULES.guardReach, 1);
  });
});

describe('training drills', () => {
  const drill = (id: DrillId) => {
    const m = new BallMatch(DRILLS[id].mode, { seed: 7, access: 'bots', practice: true, drill: id });
    m.add('me', 'taisei', 'Me', false, 'red');
    m.start();
    return m;
  };
  /** Steps until the machine feeds the next ball; returns its number. */
  const nextBall = (m: BallMatch) => { const was = m.view.drill!.ball; until(m, () => m.view.drill!.ball > was && m.view.drill!.state === 'live', 30); return m.view.drill!.ball; };
  it('has six drills a mode, ten balls each, and bronze, silver and gold within them', () => {
    expect(MODE_DRILLS['goal-rush']).toHaveLength(6); expect(MODE_DRILLS['sky-spike']).toHaveLength(6);
    for (const id of DRILL_IDS) {
      const [b, s, g] = DRILLS[id].medals;
      expect(b).toBeGreaterThan(0); expect(s).toBeGreaterThan(b); expect(g).toBeGreaterThan(s); expect(g).toBeLessThanOrEqual(DRILLS[id].balls);
      expect(medalFor(id, b - 1)).toBeNull(); expect(medalFor(id, b)).toBe('bronze'); expect(medalFor(id, s)).toBe('silver'); expect(medalFor(id, DRILLS[id].balls)).toBe('gold');
    }
  });
  it('feeds all ten balls of every drill and ends it, whatever the person does', () => {
    for (const id of DRILL_IDS) {
      const m = drill(id);
      expect(until(m, () => m.view.drill!.state === 'over', 180), id).toBe(true);
      expect(m.view.drill!.results, id).toHaveLength(10);
      // No match result: a drill pays nothing, as FREE PLAY pays nothing.
      expect(m.view.phase, id).not.toBe('over');
      expect(m.snapshot().ball.drill?.state, id).toBe('over');
    }
  });
  it('CURVE INTO THE TOP CORNER: a SPECIAL bent through the ring counts, and gold for ten', () => {
    const m = drill('gr-curve');
    for (let n = 1; n <= 10; n++) {
      expect(nextBall(m)).toBe(n);
      const a = m.sim.actors.get('me')!, ring = m.view.aim!, yaw = Math.atan2(ring.x - m.ball.x, ring.z - m.ball.z);
      a.attackYaw = yaw; a.input.yaw = yaw;
      m.receive(m.locate(BALL_ID)!, blow('me', 'special'));
      expect(m.ball.shot).toBe('curve');
    }
    until(m, () => m.view.drill!.state === 'over', 20);
    expect(m.view.drill!.done).toBe(10); expect(m.view.drill!.medal).toBe('gold');
  });
  it('KEEPER SAVES: the machine shoots at the person\'s goal, and a guard in its way is a save', () => {
    const m = drill('gr-keeper');
    nextBall(m);
    expect(m.ball.lastTeam).toBe('blue');
    expect(m.ball.vz).toBeLessThan(-10);
    // A low one (the machine's corners can be over a body's head), and the person in its path, guarding.
    const a = m.sim.actors.get('me')!;
    Object.assign(m.ball, { x: 1, y: .8, z: -10, vx: 0, vy: 0, vz: -22 });
    m.sim.place('me', { x: 1, y: 0, z: -GOAL_RULES.halfZ + 1.5 }, 0);
    void a;
    for (let i = 0; i < 120 && m.view.drill!.results.length === 0; i++) { m.submit('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, guard: true, targetId: BALL_ID }); m.step(1 / 60); }
    expect(m.view.drill!.results).toEqual([true]);
  });
  it('JUMP SPIKE TO A TARGET: the set hangs at the net; a spike onto the far court\'s ring counts', () => {
    const m = drill('ss-spike');
    nextBall(m);
    expect(m.view.touches).toBe(2); expect(m.view.aim?.floor).toBe(true);
    // Up off the floor as the floating set tops out, an air heavy aimed at the ring near the top of the jump.
    until(m, () => m.ball.vy < 1, 2);
    const ring = m.view.aim!, yaw = Math.atan2(ring.x - m.ball.x, ring.z - m.ball.z);
    m.sim.place('me', { x: m.ball.x, y: 0, z: m.ball.z - .8 }, yaw);
    for (let i = 0; i < 60 && m.ball.shot !== 'spike'; i++) {
      m.submit('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw, jump: i === 0, jumpHeld: i < 30, attack: i === 16 ? 'heavy' : undefined, targetId: BALL_ID });
      m.step(1 / 60);
    }
    expect(m.ball.shot).toBe('spike');
    expect(m.view.events.some(e => e.kind === 'strike' && e.text === 'SKY SPIKE' && e.perfect)).toBe(true);
    until(m, () => m.view.drill!.results.length > 0, 4);
    expect(m.view.events.some(e => e.kind === 'kill' && e.actorId === 'me')).toBe(true);
  });
  it('DIG A SERVE: a driven serve met by the body is kept up on the person\'s side', () => {
    const m = drill('ss-dig');
    nextBall(m);
    expect(m.ball.shot).toBe('serve'); expect(m.view.touchTeam).toBe('blue');
    // Into the serve's path on the red side.
    const down = { x: m.ball.x, z: m.ball.z };
    for (let i = 0; i < 90 && m.ball.z > -4; i++) m.step(1 / 60);
    void down;
    m.sim.place('me', { x: m.ball.x + m.ball.vx * .05, y: 0, z: m.ball.z + m.ball.vz * .05 }, 0);
    until(m, () => m.view.drill!.results.length > 0, 3);
    expect(m.view.drill!.results[0]).toBe(true);
    expect(['dig', 'bump']).toContain(m.ball.shot);
  });
  it('STUFF BLOCK: the machine sets then spikes from its side, down into the person\'s court', () => {
    const m = drill('ss-block');
    nextBall(m);
    expect(m.ball.z).toBeGreaterThan(0);
    expect(until(m, () => m.ball.shot === 'spike', 2)).toBe(true);
    expect(m.ball.vz).toBeLessThan(0);
    expect(until(m, () => m.view.drill!.results.length > 0, 4)).toBe(true);
    expect(m.view.drill!.results[0]).toBe(false);
  });
  it('TACKLE: a bot of the other side runs the ball at the person\'s goal; locked on, a knockdown wins it', () => {
    const m = drill('gr-tackle');
    // The drill fights (GOAL_FIGHT): the carrier is a seat of the other side, and the stances are on.
    const rival = m.view.seats.find(s => s.id === DRILL_RIVAL)!;
    expect(rival).toMatchObject({ bot: true, team: 'blue' });
    expect(hasStances(m.snapshot().ball)).toBe(true); expect(hasStances(drill('gr-long').snapshot().ball)).toBe(false);
    nextBall(m);
    const r = () => m.sim.actors.get(DRILL_RIVAL)!.state, me = () => m.sim.actors.get('me')!.state;
    // It runs at red's goal (-z) with the ball at its feet.
    const z0 = r().z; until(m, () => false, .6);
    expect(r().z).toBeLessThan(z0 - 2); expect(Math.hypot(m.ball.x - r().x, m.ball.z - r().z)).toBeLessThan(1.6); expect(m.ball.lastId).toBe(DRILL_RIVAL);
    // Locked on (FIGHT), run in and string lights until it is down.
    let seq = 0, last = -1;
    for (let i = 0; i < 300 && m.view.drill!.results.length === 0; i++) {
      const dx = r().x - me().x, dz = r().z - me().z, d = Math.hypot(dx, dz), now = m.sim.serverTime;
      const attack = d < 2.2 && now - last > .2 ? 'light' as const : undefined; if (attack) last = now;
      m.submit('me', { seq: ++seq, moveX: dx / Math.max(1, d), moveZ: dz / Math.max(1, d), yaw: Math.atan2(dx, dz), guard: false, targetId: DRILL_RIVAL, lock: true, attack } as never);
      m.step(1 / 60);
    }
    expect(m.view.drill!.results).toEqual([true]);
    expect(m.view.events.some(e => e.kind === 'tackle' && e.actorId === 'me')).toBe(true);
  });
  it('TACKLE: left alone, the carrier shoots from in front of the goal - the ball is lost', () => {
    const m = drill('gr-tackle');
    nextBall(m);
    expect(until(m, () => m.view.drill!.results.length > 0, 8)).toBe(true);
    expect(m.view.drill!.results[0]).toBe(false);
    expect(m.ball.lastId).toBe(DRILL_RIVAL);
  });
  it('PERFECT SPIKE: the machine sets; a jump as it peaks and a swing at the top counts, a swing on takeoff does not', () => {
    const attempt = (swingAfter: number) => {
      const m = drill('ss-perfect');
      nextBall(m);
      expect(m.ball.shot).toBe('set'); expect(m.view.touches).toBe(2); expect(m.view.aim).toBeNull();
      until(m, () => m.ball.vy < 1, 2);
      for (let i = 0; i < 70 && m.view.drill!.results.length === 0; i++) {
        m.submit('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, jump: i === 0, jumpHeld: i < 30, attack: i === Math.round(swingAfter * 60) ? 'heavy' : undefined, targetId: BALL_ID });
        m.step(1 / 60);
      }
      until(m, () => m.view.drill!.results.length > 0, 3);
      return m.view.drill!.results[0];
    };
    expect(attempt(.3)).toBe(true);
    expect(attempt(.05)).toBe(false);
  });
  it('takes no FREE PLAY reset during a drill, and keeps its ring where it put it', () => {
    const m = drill('gr-curve');
    nextBall(m);
    const ring = { ...m.view.aim! };
    expect(m.reset('me')).toBe(false);
    expect(m.view.aim).toEqual(ring);
  });
});

describe('rules a mode sheet can mix', () => {
  it('runs a drill under a mutator: LOW GRAVITY\'s machine still feeds its balls where it means to', () => {
    const m = new BallMatch('sky-spike', { seed: 7, access: 'bots', practice: true, drill: 'ss-spike', mutator: 'low-gravity' });
    m.add('me', 'taisei', 'Me', false, 'red'); m.start();
    until(m, () => m.view.drill!.state === 'live', 10);
    expect(m.ball.grav).toBe(MUTATOR_RULES.gravity);
    // The set comes onto the net at about the height it always does.
    until(m, () => m.ball.vy < 0 && Math.abs(m.ball.z) < 2.2, 3);
    expect(m.ball.y).toBeGreaterThan(SPIKE_RULES.netHeight + .8);
  });
});

describe('the ball gear a seat wears', () => {
  it('keeps only items of each slot\'s kind, and only what the account owns', async () => {
    const { lookOfWorn, cleanLook, celebrationOf } = await import('./look');
    const worn = { ball: 'ball-jade', balltrail: 'balltrail-petals', goalburst: 'goalburst-thunder', celebration: 'celebration-spin', skin: 'skin-sumi-e' };
    expect(lookOfWorn(worn, id => id !== 'goalburst-thunder')).toEqual({ ball: 'ball-jade', trail: 'balltrail-petals', celebration: 'celebration-spin' });
    expect(lookOfWorn(worn, () => false)).toBeUndefined();
    expect(cleanLook({ ball: 'balltrail-petals', trail: 'balltrail-petals', burst: 7, celebration: 'celebration-showboat' })).toEqual({ trail: 'balltrail-petals', celebration: 'celebration-showboat' });
    expect(cleanLook('nonsense')).toBeUndefined();
    expect(celebrationOf(undefined)).toBe('classic'); expect(celebrationOf({ celebration: 'celebration-stand-tall' })).toBe('stand-tall');
  });
  it('holds the scorer\'s celebration until the next kickoff: the pose, a spin, a stand, a swing first', () => {
    const scoreWith = (celebration: string | undefined) => {
      const m = pair('goal-rush', null);
      m.setLook('red-1', celebration ? { celebration } : undefined);
      until(m, () => m.view.phase === 'live');
      m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 9; m.ball.y = 1;
      aim(m, 'red-1', 0);
      m.receive(m.locate(BALL_ID)!, blow('red-1'));
      until(m, () => m.view.score.red > 0, 4);
      const a = m.sim.actors.get('red-1')!.state, yaw = a.yaw, seen: string[] = [];
      for (let i = 0; i < 90; i++) { m.step(1 / 60); if (i % 15 === 0) seen.push(a.action); }
      return { m, seen, turned: Math.abs(a.yaw - yaw) };
    };
    expect(new Set(scoreWith(undefined).seen)).toEqual(new Set(['victory']));
    const spin = scoreWith('celebration-spin');
    expect(new Set(spin.seen)).toEqual(new Set(['victory'])); expect(spin.turned).toBeGreaterThan(Math.PI * 3.5);
    expect(new Set(scoreWith('celebration-stand-tall').seen)).toEqual(new Set(['guard']));
    const showboat = scoreWith('celebration-showboat').seen;
    expect(showboat[0]).toBe('heavy'); expect(showboat.at(-1)).toBe('victory');
    // The next kickoff puts the scorer back on their mark, out of it.
    const { m } = scoreWith('celebration-spin');
    until(m, () => m.view.phase === 'kickoff', 12);
    expect(m.sim.actors.get('red-1')!.state.action).not.toBe('victory');
  });
});
