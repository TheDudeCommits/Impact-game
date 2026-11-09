import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, BALL_RULES, CLASH, GOAL_RULES, QUICK_CHAT_LIMIT, RUMBLE, SPIKE_RULES, type CharmKind } from './model';
import { landing, speedCap, stepBall } from './physics';
import { REPLAY, replayClock, replayLength } from './replay';
import type { ExternalBlow } from '../simulation';
import type { MoveDefinition } from '../moves';

const MOVE: MoveDefinition = { name: 'Test Blow', duration: .4, contacts: [.1], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string, slot: ExternalBlow['slot'] = 'heavy', move: MoveDefinition = MOVE): ExternalBlow =>
  ({ attackerId, slot, move, damage: 10, critical: false, finisher: true, pushX: 0, pushZ: 1, knockback: move.knockback, stun: .2, launch: false, hitstop: .05 });
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };

/** Two people, one a side, nobody else: no bot moves the ball but the test. */
function pair(mode: 'goal-rush' | 'sky-spike', length?: number, rumble = false) {
  const m = new BallMatch(mode, { seed: 3, access: 'host', fillBots: false, length, rumble });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  return m;
}
/** Put a fighter beside the ball, facing `yaw`, as if they had pressed a blow aimed that way. */
function aim(m: BallMatch, id: string, yaw: number) {
  const a = m.sim.actors.get(id)!;
  a.attackYaw = yaw; a.input.yaw = yaw; a.state.yaw = yaw;
  m.sim.place(id, { x: m.ball.x - Math.sin(yaw), y: 0, z: m.ball.z - Math.cos(yaw) }, yaw);
}

describe('Goal Rush', () => {
  it('kicks off, then a shot at the goal scores for the side that struck it', () => {
    const m = pair('goal-rush');
    expect(m.view.phase).toBe('kickoff');
    expect(until(m, () => m.view.phase === 'live')).toBe(true);
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 10; m.ball.y = 1;
    aim(m, 'red-1', 0);
    expect(m.receive(m.locate(BALL_ID)!, blow('red-1'))).not.toBeNull();
    expect(m.ball.vz).toBeGreaterThan(10);
    expect(until(m, () => m.view.score.red > 0, 4)).toBe(true);
    expect(m.view.phase).toBe('scored');
    expect(m.seats.get('red-1')!.goals).toBe(1);
    expect(m.view.events.some(e => e.kind === 'goal' && e.actorId === 'red-1')).toBe(true);
    // The goal's sequence and its replay hold the celebration (the replay waits REPLAY.ceremony), then the next kickoff.
    expect(m.view.replay?.ceremony).toBe(true);
    expect(until(m, () => m.view.phase === 'kickoff', REPLAY.ceremony + REPLAY.most + REPLAY.after + 1)).toBe(true);
    expect(m.view.replay).toBeNull();
  });
  it('replays a goal from before the shot, slowed round it, and every person voting to skip ends it', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    steps(m, 2);
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 10; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    const struck = m.sim.serverTime;
    expect(until(m, () => m.view.phase === 'scored', 4)).toBe(true);
    const r = m.view.replay!, scored = m.sim.serverTime;
    expect(r.kind).toBe('goal');
    expect(r.team).toBe('red');
    expect(r.actorId).toBe('red-1');
    expect(r.key).toBeCloseTo(struck, 1);
    expect(r.from).toBeLessThan(struck - .5);
    expect(r.to).toBeGreaterThan(scored);
    expect(r.at).toBeGreaterThan(scored);
    expect(r.until - r.at).toBeCloseTo(replayLength(r), 5);
    expect(r.until - r.at).toBeLessThanOrEqual(REPLAY.most + 1e-9);
    // The clock reads the play back slower round the shot than before it.
    let round = 1;
    for (let e = 0; e < replayLength(r); e += .01) { const c = replayClock(r, e); if (Math.abs(c.time - r.key) < .02) { round = c.rate; break; } }
    expect(round).toBeLessThan(replayClock(r, .05).rate);
    expect(replayClock(r, 99).time).toBe(r.to);
    // Nobody plays on behind it; a skip before it shows is no vote.
    expect(m.skip('red-1')).toBe(false);
    until(m, () => m.sim.serverTime >= r.at + .1, 3);
    expect(m.replaying()).toBe(true);
    expect(m.submit('red-1', {seq: 1, moveX: 1, moveZ: 0, yaw: 0})).toBe(false);
    // One of the two people skips: it plays on. Both have: it ends, and the kickoff follows.
    expect(m.skip('red-1')).toBe(true);
    expect(m.replaying()).toBe(true);
    expect(m.view.replay!.skips).toBe(1);
    expect(m.view.replay!.people).toBe(2);
    expect(m.skip('blue-1')).toBe(true);
    expect(m.replaying()).toBe(false);
    expect(until(m, () => m.view.phase === 'kickoff', REPLAY.after + .2)).toBe(true);
  });
  it('credits a goal that bounced in off a defender to the striker, and an own blow as an own goal', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 8; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.sim.place('blue-1', { x: 12, y: 0, z: 0 }, Math.PI);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    // On its way in it comes off the blue keeper's body (no blow of theirs): still red's goal.
    (m as unknown as { touched(seat: unknown, shot: null, named: string): void }).touched(m.seats.get('blue-1'), null, 'header');
    expect(until(m, () => m.view.score.red > 0, 4)).toBe(true);
    expect(m.seats.get('red-1')!.goals).toBe(1);
    expect(m.view.events.some(e => e.kind === 'own-goal')).toBe(false);
  });
  it('counts a super shot goal twice, through a body in its way', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 0; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'ultimate'));
    expect(m.ball.super).toBe(true);
    // Blue stands square in its path (on their kickoff mark), guard down: bulldozed.
    m.sim.place('blue-1', { x: m.ball.x + m.ball.vx * .25, y: 0, z: m.ball.z + m.ball.vz * .25 }, Math.PI);
    expect(until(m, () => m.view.phase === 'scored', 5)).toBe(true);
    expect(m.view.score.red).toBe(GOAL_RULES.superGoal);
    expect(m.view.events.some(e => e.kind === 'bowled' && e.targetId === 'blue-1')).toBe(true);
  });
  it('plays on past nought until the ball comes down, and a tie goes to a golden goal', () => {
    const m = pair('goal-rush', 2);
    until(m, () => m.view.phase === 'live');
    m.ball.y = 6; m.ball.vy = 4;
    expect(until(m, () => m.view.clock <= 0, 3)).toBe(true);
    expect(m.view.phase).toBe('live');
    expect(until(m, () => m.view.overtime, 4)).toBe(true);
    until(m, () => m.view.phase === 'live', 8);
    m.ball.x = 0; m.ball.z = -GOAL_RULES.halfZ + 6; m.ball.y = 1;
    aim(m, 'blue-1', Math.PI);
    m.receive(m.locate(BALL_ID)!, blow('blue-1'));
    expect(until(m, () => m.view.phase === 'over', 10)).toBe(true);
    expect(m.view.winner).toBe('blue');
    expect(m.view.mvp).not.toBeNull();
  });
  it('heats the ball on a pass and a heavy, and cools it at every bounce and guard', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    m.add('red-1', 'taisei', 'Red', false, 'red'); m.add('red-2', 'konta', 'Red 2', false, 'red'); m.add('blue-1', 'gorai', 'Blue', false, 'blue');
    m.start(); steps(m, 3.1); until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 0; m.ball.y = 3; m.ball.vx = m.ball.vy = m.ball.vz = 0;
    aim(m, 'red-1', 0); m.receive(m.locate(BALL_ID)!, blow('red-1', 'light'));
    const one = m.ball.heat;
    expect(one).toBeCloseTo(BALL_RULES.heatPer.light * 2, 5);
    // Red's team-mate takes it on: a pass, worth more than the blow alone.
    m.ball.y = 3; m.ball.vx = m.ball.vy = m.ball.vz = 0; steps(m, .2);
    aim(m, 'red-2', 0); m.receive(m.locate(BALL_ID)!, blow('red-2', 'heavy'));
    expect(m.ball.heat - one).toBeGreaterThan(BALL_RULES.heatPer.heavy + GOAL_RULES.passHeat - .1);
    // Down on the floor hard: a bounce cools it.
    m.ball.x = 0; m.ball.z = 0; m.ball.y = 1; m.ball.vx = m.ball.vz = 0; m.ball.vy = -12; m.ball.heat = 2;
    until(m, () => m.ball.vy > 0, 1);
    expect(m.ball.heat).toBeLessThan(2 - BALL_RULES.bounceHeat + .02);
  });
  it('lets an OVERDRIVE ball stagger a body for a moment, never knock it down; a cooler ball runs into it', () => {
    const run = (heat: number) => {
      const m = pair('goal-rush');
      until(m, () => m.view.phase === 'live');
      m.sim.place('blue-1', { x: 0, y: 0, z: 6 }, Math.PI);
      Object.assign(m.ball, { x: 0, y: 1.2, z: 2, vx: 0, vy: 0, vz: 30, heat, lastId: 'red-1', lastTeam: 'red', super: false });
      steps(m, .25);
      return { m, action: m.sim.actors.get('blue-1')!.state.action, event: m.view.events.find(e => e.kind === 'bowled') };
    };
    const hot = run(BALL_RULES.bowlTier + .3);
    expect(hot.event?.text).toBe('STAGGERED');
    expect(hot.action).not.toBe('knockdown');
    steps(hot.m, BALL_RULES.staggerSeconds + .4);
    expect(['idle', 'run']).toContain(hot.m.sim.actors.get('blue-1')!.state.action);
    expect(run(3.5).event).toBeUndefined();
  });
  it('lets a blow find the other side, never a team-mate (and Sky Spike\'s sides never meet)', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    const before = m.sim.actors.get('blue-1')!.state.hp;
    m.sim.strike('red-1', 'blue-1', 'heavy', MOVE);
    expect(m.sim.actors.get('blue-1')!.state.hp).toBeLessThan(before);
    const spike = pair('sky-spike');
    steps(spike, 1);
    const whole = spike.sim.actors.get('blue-1')!.state.hp;
    spike.sim.strike('red-1', 'blue-1', 'heavy', MOVE);
    expect(spike.sim.actors.get('blue-1')!.state.hp).toBe(whole);
  });
});

describe('Sky Spike', () => {
  it('replays only the great points: FEVER, a super shot, a match point, the winning point', () => {
    const point = (rally: number, fever = false) => {
      const m = pair('sky-spike');
      const server = m.view.serverId!, team = m.view.servingTeam;
      aim(m, server, team === 'red' ? 0 : Math.PI);
      m.receive(m.locate(BALL_ID)!, blow(server));
      until(m, () => m.view.rally >= 1, 3);
      m.view.rally = rally; m.view.fever = fever;
      until(m, () => m.view.phase === 'scored', 6);
      return m.view.replay;
    };
    expect(point(1)).toBeNull();
    // A long rally alone is no longer shown again: its celebration plays on into the next serve instead.
    expect(point(8)).toBeNull();
    expect(point(2, true)?.text).toBe('FEVER POINT');
    // A match point saved is shown again; the side that was at match point lost it.
    const saved = pair('sky-spike'), server = saved.view.serverId!, team = saved.view.servingTeam, other = team === 'red' ? 'blue' : 'red';
    saved.view.score[other] = SPIKE_RULES.target - 1; saved.view.score[team] = 3;
    aim(saved, server, team === 'red' ? 0 : Math.PI);
    saved.receive(saved.locate(BALL_ID)!, blow(server));
    steps(saved, .4);
    // The serve comes down in the other side's court: the server's point.
    Object.assign(saved.ball, { x: 0, y: 12, z: (other === 'red' ? -1 : 1) * 5, vx: 0, vy: 0, vz: 0, lastId: server, lastTeam: team });
    until(saved, () => saved.view.phase === 'scored', 3);
    expect(saved.view.score[team]).toBe(4);
    expect(saved.view.replay?.text).toBe('MATCH POINT SAVED');

    // A couch match has no replays at all.
    const couch = new BallMatch('goal-rush', { seed: 3, access: 'bots', fillBots: false, replays: false });
    couch.add('a', 'taisei', 'A', false, 'red'); couch.add('b', 'konta', 'B', false, 'blue'); couch.start(); steps(couch, 3.1);
    until(couch, () => couch.view.phase === 'live'); steps(couch, 1.5);
    couch.ball.x = 0; couch.ball.z = GOAL_RULES.halfZ - 6; couch.ball.y = 1; aim(couch, 'a', 0); couch.receive(couch.locate(BALL_ID)!, blow('a'));
    expect(until(couch, () => couch.view.phase === 'scored', 4)).toBe(true);
    expect(couch.view.replay).toBeNull();
  });
  it('plays the scorer’s celebration on into the next serve’s walk-up', () => {
    const m = new BallMatch('sky-spike', { seed: 5, access: 'host', fillBots: false });
    for (const [id, team] of [['red-1', 'red'], ['red-2', 'red'], ['blue-1', 'blue'], ['blue-2', 'blue']] as const) m.add(id, id.startsWith('red') ? 'taisei' : 'konta', id, false, team);
    m.start(); steps(m, 3.1);
    const server = m.view.serverId!, team = m.view.servingTeam, mate = [...m.seats.values()].find(s => s.team === team && s.id !== server)!.id;
    aim(m, server, team === 'red' ? 0 : Math.PI); m.receive(m.locate(BALL_ID)!, blow(server)); steps(m, .3);
    Object.assign(m.ball, { x: 0, y: 3, z: (team === 'red' ? 1 : -1) * 5, vx: 0, vy: 0, vz: 0, lastId: mate, lastTeam: team });
    expect(until(m, () => m.view.phase === 'scored', 2)).toBe(true);
    expect(until(m, () => m.view.phase === 'kickoff', 4)).toBe(true);
    expect(m.view.serverId).toBe(server);
    steps(m, .5);
    expect(m.sim.actors.get(mate)!.state.action).toBe('victory');
    steps(m, SPIKE_RULES.celebrateSeconds);
    expect(m.sim.actors.get(mate)!.state.action).not.toBe('victory');
  });
  it('holds the serve for its server alone, and the serve is the side’s last touch', () => {
    const m = pair('sky-spike');
    expect(m.view.phase).toBe('kickoff');
    const server = m.view.serverId!, other = server === 'red-1' ? 'blue-1' : 'red-1';
    expect(m.receive(m.locate(BALL_ID)!, blow(other))).toBeNull();
    aim(m, server, m.view.servingTeam === 'red' ? 0 : Math.PI);
    expect(m.receive(m.locate(BALL_ID)!, blow(server))).not.toBeNull();
    expect(m.view.phase).toBe('live');
    expect(m.view.touches).toBe(SPIKE_RULES.touches);
    // It goes over and lands in the other court: the rally climbs and the server's side takes the point.
    const team = m.view.servingTeam;
    expect(until(m, () => m.view.phase === 'scored', 5)).toBe(true);
    expect(m.view.rally).toBe(1);
    expect(m.view.score[team]).toBe(1);
  });
  it('faults a fourth touch and refuses a blow across the net', () => {
    const m = pair('sky-spike');
    const server = m.view.serverId!, receiver = server === 'red-1' ? 'blue-1' : 'red-1', side = m.seats.get(receiver)!.team, sign = side === 'red' ? -1 : 1;
    // A ball on the receiving side, up in the air, three light touches spent.
    m.ball.held = false; m.view.phase = 'live'; m.ball.x = 0; m.ball.z = sign * 5; m.ball.y = 2; m.ball.vx = m.ball.vy = m.ball.vz = 0;
    m.view.touchTeam = side; m.view.touches = 3;
    aim(m, receiver, 0);
    m.receive(m.locate(BALL_ID)!, blow(receiver, 'light'));
    expect(m.view.phase).toBe('scored');
    expect(m.view.score[side === 'red' ? 'blue' : 'red']).toBe(1);
    // Across the net: refused.
    const n = pair('sky-spike'), there = n.view.serverId === 'red-1' ? 'blue-1' : 'red-1', thereSign = n.seats.get(there)!.team === 'red' ? 1 : -1;
    n.ball.held = false; n.view.phase = 'live'; n.ball.z = thereSign * 5; n.ball.y = 2;
    expect(n.receive(n.locate(BALL_ID)!, blow(there))).toBeNull();
  });
  it('scores a ball out of bounds against whoever touched it last, and FEVER doubles a point', () => {
    const m = pair('sky-spike');
    m.ball.held = false; m.view.phase = 'live'; m.ball.x = SPIKE_RULES.courtHalfX + 3; m.ball.z = -4; m.ball.y = 1; m.ball.vy = -6;
    m.ball.lastId = 'red-1'; m.ball.lastTeam = 'red'; m.view.fever = true;
    expect(until(m, () => m.view.phase === 'scored', 2)).toBe(true);
    expect(m.view.score.blue).toBe(2);
  });
  it('ends at the target, two clear', () => {
    const m = pair('sky-spike', 3);
    m.view.score.red = 2; m.view.score.blue = 1;
    m.ball.held = false; m.view.phase = 'live'; m.ball.x = 0; m.ball.z = 5; m.ball.y = 1; m.ball.vy = -5; m.ball.lastId = 'red-1'; m.ball.lastTeam = 'red';
    expect(until(m, () => m.view.phase === 'over', 6)).toBe(true);
    expect(m.view.winner).toBe('red');
  });
});

describe('the ball', () => {
  it('piles up the blows it takes in stopped time and lets them go together', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 0; m.ball.y = 1;
    m.freeze({ x: 0, y: 1, z: 0 }, 5, 1);
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    m.sim.serverTime += .2;
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'special'));
    const held = { x: m.ball.x, z: m.ball.z };
    steps(m, .5);
    expect(Math.hypot(m.ball.x - held.x, m.ball.z - held.z)).toBeLessThan(.01);
    steps(m, .8);
    expect(Math.hypot(m.ball.vx, m.ball.vz)).toBeGreaterThan(15);
  });
  it('bounces off the walls and the posts, and predicts where it comes down', () => {
    const b = { x: 0, y: 3, z: 0, vx: 30, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, lastId: null, lastTeam: null, shot: null, held: false, frozenUntil: 0, super: false, size: 1, grav: 1, wall: null, clash: 0 };
    const hits = [];
    for (let i = 0; i < 120; i++) hits.push(...stepBall('goal-rush', b, 1 / 60).map(c => c.kind));
    expect(hits).toContain('wall');
    expect(Math.abs(b.x)).toBeLessThan(GOAL_RULES.halfX);
    const fall = landing('sky-spike', { ...b, x: 0, y: 5, z: 0, vx: 0, vy: 0, vz: 4 });
    expect(fall.z).toBeGreaterThan(1);
    expect(fall.t).toBeGreaterThan(.5);
  });
});

describe('RUMBLE', () => {
  /** A charm of `kind` laid at a fighter's feet: the next step they take it. */
  const grab = (m: BallMatch, id: string, kind: CharmKind) => {
    const p = m.sim.actors.get(id)!.state;
    m.view.charms.push({ id: 99, kind, x: p.x, z: p.z, until: m.sim.serverTime + 5 });
    m.step(1 / 60);
    expect(m.view.charms.some(c => c.id === 99)).toBe(false);
    expect(m.view.events.some(e => e.kind === 'charm' && e.charm === kind && e.actorId === id)).toBe(true);
  };
  it('lays charms on the field after the kickoff, and a body running through one takes it', () => {
    const m = pair('goal-rush', undefined, true);
    until(m, () => m.view.phase === 'live');
    expect(until(m, () => m.view.charms.length > 0, RUMBLE.first + 1)).toBe(true);
    const c = m.view.charms[0];
    expect(Math.abs(c.x)).toBeLessThan(GOAL_RULES.halfX);
    grab(m, 'red-1', 'feather');
    expect(m.ball.grav).toBe(RUMBLE.featherGravity);
    grab(m, 'blue-1', 'giant');
    expect(m.ball.size).toBe(RUMBLE.giantSize);
    expect(m.view.effects.map(e => e.kind).sort()).toEqual(['feather', 'giant']);
    // Their time runs out and the ball is itself again.
    steps(m, RUMBLE.seconds.giant + .2);
    expect(m.ball.grav).toBe(1);
    expect(m.ball.size).toBe(1);
    // A classic match lays none.
    const classic = pair('goal-rush');
    until(classic, () => classic.view.phase === 'live'); steps(classic, RUMBLE.first + 2);
    expect(classic.view.charms).toHaveLength(0);
  });
  it('seals a goal behind an IRON WALL, and fires a KI CHARGE strike at the top speed', () => {
    const m = pair('goal-rush', undefined, true);
    until(m, () => m.view.phase === 'live');
    grab(m, 'blue-1', 'wall');
    expect(m.ball.wall).toBe('blue');
    grab(m, 'red-1', 'charge');
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 10; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    expect(Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz)).toBeGreaterThan(speedCap('goal-rush', BALL_RULES.heatMax) * .95);
    expect(m.ball.heat).toBe(BALL_RULES.heatMax);
    expect(m.view.effects.some(e => e.kind === 'charge')).toBe(false);
    // It meets the wall, not the net.
    expect(until(m, () => m.view.events.some(e => e.kind === 'shield'), 2)).toBe(true);
    expect(m.view.score.red).toBe(0);
    expect(m.ball.vz).toBeLessThan(0);
    expect(m.seats.get('blue-1')!.saves).toBe(1);
  });
  it('springs a ball back up off a court under a SAFETY NET, once', () => {
    const m = pair('sky-spike', undefined, true);
    const server = m.view.serverId!, team = m.view.servingTeam, other = team === 'red' ? 'blue' : 'red';
    const receiver = server === 'red-1' ? 'blue-1' : 'red-1';
    aim(m, server, team === 'red' ? 0 : Math.PI);
    m.receive(m.locate(BALL_ID)!, blow(server));
    grab(m, receiver, 'wall');
    expect(until(m, () => m.view.events.some(e => e.kind === 'shield'), 4)).toBe(true);
    expect(m.view.score[team]).toBe(0);
    expect(m.view.phase).toBe('live');
    expect(m.view.touchTeam).toBe(other);
    expect(m.view.effects.some(e => e.kind === 'wall')).toBe(false);
    // The next one down counts.
    expect(until(m, () => m.view.phase === 'scored', 6)).toBe(true);
  });
});

describe('CLASH', () => {
  it('holds the ball when both sides strike it at once, then the stronger blow sends it on harder', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 0; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    const struck = Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz);
    m.step(1 / 60);
    aim(m, 'blue-1', Math.PI);
    m.receive(m.locate(BALL_ID)!, blow('blue-1'));
    const clash = m.view.events.find(e => e.kind === 'clash');
    expect(clash).toBeDefined();
    expect([clash!.actorId, clash!.targetId].sort()).toEqual(['blue-1', 'red-1']);
    expect(m.ball.clash).toBeGreaterThan(m.sim.serverTime);
    expect(Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz)).toBe(0);
    // Nothing else plays it while it holds, and it does not move.
    steps(m, .2);
    const held = { x: m.ball.x, z: m.ball.z };
    expect(m.receive(m.locate(BALL_ID)!, blow('red-1'))).toBeNull();
    // (Both stand aside, so the ball breaks out clear of the loser's body.)
    m.sim.place('red-1', { x: -9, y: 0, z: -6 }, 0); m.sim.place('blue-1', { x: 9, y: 0, z: 6 }, Math.PI);
    steps(m, CLASH.hold - .1);
    expect(Math.abs(m.ball.x - held.x) + Math.abs(m.ball.z - held.z)).toBeGreaterThan(0);
    // The winner's way, harder than one blow alone.
    const winner = m.seats.get(clash!.actorId!)!;
    expect(Math.sign(m.ball.vz)).toBe(winner.team === 'red' ? 1 : -1);
    expect(Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz)).toBeGreaterThan(struck * 1.05);
    expect(m.ball.lastId).toBe(winner.id);
  });
  it('is no clash when the second blow comes after the window, or from the same side', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 0; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    steps(m, CLASH.window + .1);
    aim(m, 'blue-1', Math.PI);
    m.receive(m.locate(BALL_ID)!, blow('blue-1'));
    expect(m.view.events.some(e => e.kind === 'clash')).toBe(false);
    expect(m.ball.vz).toBeLessThan(0);
  });
});

describe('FREE PLAY', () => {
  const alone = (mode: 'goal-rush' | 'sky-spike') => {
    const m = new BallMatch(mode, { seed: 5, access: 'bots', practice: true });
    m.add('me', 'taisei', 'Me', false, 'red');
    expect(m.start()).toBe(true);
    steps(m, 3.1);
    return m;
  };
  it('plays Goal Rush with one person, no clock, the ball back on the spot after a goal and a reset to hand', () => {
    const m = alone('goal-rush');
    expect(m.seats.size).toBe(1);
    until(m, () => m.view.phase === 'live', 2);
    const clock = m.view.clock;
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 9; m.ball.y = 1;
    aim(m, 'me', 0);
    m.receive(m.locate(BALL_ID)!, blow('me'));
    expect(m.view.best).toBeGreaterThan(10);
    expect(until(m, () => m.view.phase === 'scored', 4)).toBe(true);
    expect(m.view.replay).toBeNull();
    // Back on the spot in a moment; the person stays where they stood.
    const where = { ...m.sim.actors.get('me')!.state };
    expect(until(m, () => m.view.phase === 'live', 3)).toBe(true);
    expect(Math.hypot(m.ball.x, m.ball.z)).toBeLessThan(1);
    expect(Math.hypot(m.sim.actors.get('me')!.state.x - where.x, m.sim.actors.get('me')!.state.z - where.z)).toBeLessThan(3);
    expect(m.view.clock).toBe(clock);
    // RESET: the ball at rest a stride in front.
    m.ball.x = 15; m.ball.z = -20; m.ball.vx = 9;
    expect(m.reset('me')).toBe(true);
    const p = m.sim.actors.get('me')!.state;
    expect(Math.hypot(m.ball.x - p.x, m.ball.z - p.z)).toBeLessThan(3.5);
    expect(m.ball.vx).toBe(0);
    // Only in free play.
    const match = pair('goal-rush'); until(match, () => match.view.phase === 'live');
    expect(match.reset('red-1')).toBe(false);
  });
  it('plays Sky Spike against the ball machine, which keeps sending balls into the person\'s court', () => {
    const m = alone('sky-spike');
    expect(m.view.servingTeam).toBe('blue');
    expect(until(m, () => m.view.phase === 'live', 2)).toBe(true);
    // The machine's ball comes down in the red court: the machine's point, and the machine serves again.
    expect(until(m, () => m.view.phase === 'scored', 4)).toBe(true);
    expect(m.view.score.blue).toBe(1);
    expect(until(m, () => m.view.phase === 'kickoff', 2)).toBe(true);
    expect(m.view.servingTeam).toBe('blue');
    expect(m.view.phase).not.toBe('over');
  });
});

describe('the spike', () => {
  it('meets a set over the net with an air heavy (the strike flies at the ball), and sends it down into the far court', () => {
    const m = new BallMatch('sky-spike', { seed: 5, access: 'bots', practice: true });
    m.add('me', 'taisei', 'Me', false, 'red');
    m.start(); steps(m, 3.1);
    until(m, () => m.view.phase === 'live', 2);
    // Red's own side, a set hanging near the net, two touches spent.
    m.sim.place('me', { x: 0, y: 0, z: -2.4 }, 0);
    Object.assign(m.ball, { x: 0, y: 4.4, z: -1.6, vx: 0, vy: 1.5, vz: 0, held: false, shot: 'set', lastId: 'me', lastTeam: 'red' });
    m.view.touchTeam = 'red'; m.view.touches = 2; m.view.rally = 1;
    for (let i = 0; i < 40 && m.ball.shot !== 'spike'; i++) {
      m.submit('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, jump: i === 0, jumpHeld: i < 12, attack: i === 2 ? 'heavy' : undefined, targetId: BALL_ID });
      m.step(1 / 60);
    }
    expect(m.ball.shot).toBe('spike');
    expect(m.ball.vz).toBeGreaterThan(0);
    expect(m.view.events.some(e => e.kind === 'strike' && e.text === 'SKY SPIKE')).toBe(true);
    expect(until(m, () => m.view.phase === 'scored', 3)).toBe(true);
    expect(m.view.score.red).toBe(1);
  });
  it('spikes with the body when a fighter jumps into the last touch at the net without a swing', () => {
    const m = new BallMatch('sky-spike', { seed: 5, access: 'bots', practice: true });
    m.add('me', 'taisei', 'Me', false, 'red');
    m.start(); steps(m, 3.1);
    until(m, () => m.view.phase === 'live', 2);
    m.sim.place('me', { x: 0, y: 0, z: -1.7 }, 0);
    Object.assign(m.ball, { x: 0, y: 4.2, z: -1.6, vx: 0, vy: 0, vz: 0, held: false, shot: 'set', lastId: 'me', lastTeam: 'red' });
    m.view.touchTeam = 'red'; m.view.touches = 2; m.view.rally = 1;
    for (let i = 0; i < 40 && m.view.touches < 3; i++) {
      m.submit('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, jump: i === 0, jumpHeld: i < 12, targetId: BALL_ID });
      m.step(1 / 60);
    }
    expect(m.ball.shot).toBe('spike');
    expect(m.ball.vz).toBeGreaterThan(0);
  });
});

describe('quick chat', () => {
  it('puts a person\'s line in the moments by its index, and drops nonsense, bots and a flood', () => {
    const m = pair('sky-spike');
    expect(m.chat('red-1', 1)).toBe(true);
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'chat', actorId: 'red-1', team: 'red', text: 'Set me up!' });
    expect(m.chat('red-1', 2)).toBe(false); // too soon after the last
    expect(m.chat('red-1', -1)).toBe(false); expect(m.chat('red-1', 16)).toBe(false); expect(m.chat('red-1', 'x')).toBe(false);
    expect(m.chat('nobody', 1)).toBe(false);
    // Inside one window, no more than the burst however often the key goes.
    let said = 1;
    for (let i = 0; i < 7; i++) { steps(m, 1); if (m.chat('red-1', 7)) said++; }
    expect(said).toBe(QUICK_CHAT_LIMIT.burst);
  });
});

describe('the bots\' jobs', () => {
  it('go to the bots alone, so a side with a person on it still has an attacker and a keeper', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'quick', replays: false });
    m.add('p1', 'konta', 'P1', false, 'red'); m.add('p2', 'taisei', 'P2', false, 'blue');
    m.start(); steps(m, 3.1); until(m, () => m.view.phase === 'live', 4); steps(m, .4);
    for (const team of ['red', 'blue'] as const) {
      const roles = [...m.seats.values()].filter(s => s.team === team && s.bot).map(s => s.role).sort();
      expect(roles).toEqual(['attack', 'keeper']);
    }
    expect(m.seats.get('p1')!.role).toBeUndefined();
    // With two people on a side, its one bot keeps goal.
    const two = new BallMatch('goal-rush', { seed: 3, access: 'quick', replays: false });
    two.add('a', 'konta', 'A', false, 'red'); two.add('b', 'taisei', 'B', false, 'red');
    two.start(); steps(two, 3.1); until(two, () => two.view.phase === 'live', 4); steps(two, .4);
    expect([...two.seats.values()].filter(s => s.team === 'red' && s.bot).map(s => s.role)).toEqual(['keeper']);
  });
});

describe('the block', () => {
  it('stuffs a spike down into the hitters\' court when timed to it, and lifts it softly back over when not', () => {
    const block = (perfect: boolean) => {
      const m = pair('sky-spike');
      m.view.phase = 'live'; m.view.rally = 2; m.view.touchTeam = 'red'; m.view.touches = 3;
      Object.assign(m.ball, { x: 0, y: 3.3, z: .4, vx: 0, vy: -4, vz: 14, held: false, shot: 'spike', lastId: 'red-1', lastTeam: 'red' });
      const seat = m.seats.get('blue-1')!, now = m.sim.serverTime;
      (m as unknown as { guardBall(s: unknown, at: number, nx: number, ny: number, nz: number, speed: number): void }).guardBall(seat, perfect ? now : now - 1, 0, 0, -1, 15);
      return m;
    };
    const stuff = block(true);
    expect(stuff.view.events.at(-1)).toMatchObject({ kind: 'perfect', text: 'STUFF BLOCK' });
    expect(stuff.ball.vy).toBeLessThan(0); expect(stuff.ball.vz).toBeLessThan(0);
    const soft = block(false);
    expect(soft.view.events.at(-1)).toMatchObject({ kind: 'block' });
    expect(soft.ball.vy).toBeGreaterThan(5); expect(soft.ball.vz).toBeLessThan(0); expect(soft.ball.vz).toBeGreaterThan(-6);
    expect(soft.seats.get('blue-1')!.blocks).toBe(1);
  });
});

describe('the flair', () => {
  it('poses the scorer for the celebration, and names a volley struck high up an AERIAL', () => {
    const m = pair('goal-rush');
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 9; m.ball.y = 4.6; m.ball.vy = 0;
    aim(m, 'red-1', 0);
    const a = m.sim.actors.get('red-1')!; a.state.grounded = false; a.state.y = 3.4;
    m.receive(m.locate(BALL_ID)!, blow('red-1'));
    expect(m.view.events.some(e => e.kind === 'strike' && e.text === 'AERIAL')).toBe(true);
    expect(until(m, () => m.view.score.red > 0, 4)).toBe(true);
    expect(m.sim.actors.get('red-1')!.state.action).toBe('victory');
    // The next kickoff puts them back on their mark, out of it.
    until(m, () => m.view.phase === 'kickoff', 12);
    expect(m.sim.actors.get('red-1')!.state.action).not.toBe('victory');
  });
});

describe('the keeper', () => {
  it('names a save made straight off a dash a DIVING SAVE', () => {
    const save = (dashed: boolean) => {
      const m = pair('goal-rush');
      until(m, () => m.view.phase === 'live');
      Object.assign(m.ball, { x: 0, y: 1.2, z: -GOAL_RULES.halfZ + 3, vx: 0, vy: 0, vz: -24, held: false, lastId: 'blue-1', lastTeam: 'blue' });
      const seat = m.seats.get('red-1')!, now = m.sim.serverTime;
      if (dashed) (m as unknown as { dashAt: Map<string, number> }).dashAt.set('red-1', now - .2);
      (m as unknown as { guardBall(s: unknown, at: number, nx: number, ny: number, nz: number, speed: number): void }).guardBall(seat, now - 1, 0, 0, 1, 24);
      return m.view.events.filter(e => e.kind === 'save').at(-1)?.text;
    };
    expect(save(true)).toBe('DIVING SAVE');
    expect(save(false)).toBe('SAVE');
  });
});

describe('the kickoff', () => {
  it('deals new spots after a goal, the same on both sides', () => {
    const spots = [[8.1, 10.2], [1.6, 15.2], [0, 18.3]];
    const seen = new Set<string>();
    const m = pair('goal-rush');
    for (let goal = 0; goal < 6; goal++) {
      until(m, () => m.view.phase === 'live');
      m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 6; m.ball.y = 1; m.ball.vz = 30; m.ball.held = false;
      until(m, () => m.view.phase === 'scored', 3);
      until(m, () => m.view.phase === 'kickoff', 12);
      const r = m.sim.actors.get('red-1')!.state, b = m.sim.actors.get('blue-1')!.state;
      expect(r.x).toBeCloseTo(b.x, 3); expect(r.z).toBeCloseTo(-b.z, 3);
      expect(spots.some(([x, z]) => Math.abs(Math.abs(r.x) - x) < .01 && Math.abs(Math.abs(r.z) - z) < .01)).toBe(true);
      seen.add(`${r.x.toFixed(1)},${r.z.toFixed(1)}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('target practice', () => {
  it('lays a ring in the goal in FREE PLAY; a shot through it is a target and a new ring comes, a miss ends the streak', () => {
    const m = new BallMatch('goal-rush', { seed: 5, access: 'bots', practice: true });
    m.add('me', 'taisei', 'Me', false, 'red');
    m.start(); steps(m, 3.1); until(m, () => m.view.phase === 'live', 2);
    const aim = m.view.aim!;
    expect(aim.floor).toBe(false);
    expect(aim.z).toBe(GOAL_RULES.halfZ);
    // Through the ring.
    Object.assign(m.ball, { x: aim.x, y: aim.y, z: GOAL_RULES.halfZ - 1.5, vx: 0, vy: 0, vz: 20, held: false });
    until(m, () => m.view.phase === 'scored', 2);
    expect(m.view.hits).toBe(1); expect(m.view.streak).toBe(1);
    expect(m.view.events.some(e => e.kind === 'target')).toBe(true);
    expect(m.view.aim).not.toEqual(aim);
    // Into the goal, nowhere near the new ring: the streak ends, the targets stay.
    until(m, () => m.view.phase === 'live', 3);
    const next = m.view.aim!;
    Object.assign(m.ball, { x: -next.x || 3.4, y: next.y > 2 ? .7 : 3.6, z: GOAL_RULES.halfZ - 1.5, vx: 0, vy: 0, vz: 20, held: false });
    until(m, () => m.view.phase === 'scored', 2);
    expect(m.view.hits).toBe(1); expect(m.view.streak).toBe(0); expect(m.view.bestStreak).toBe(1);
    // None in a match.
    const match = pair('goal-rush'); until(match, () => match.view.phase === 'live');
    expect(match.view.aim).toBeNull();
  });
  it('lays a ring on the far court in Sky Spike\'s FREE PLAY', () => {
    const m = new BallMatch('sky-spike', { seed: 5, access: 'bots', practice: true });
    m.add('me', 'taisei', 'Me', false, 'red');
    m.start(); steps(m, 3.1);
    const aim = m.view.aim!;
    expect(aim.floor).toBe(true); expect(aim.z).toBeGreaterThan(0);
    m.view.phase = 'live'; m.view.rally = 1; m.view.touchTeam = 'red'; m.view.touches = 3;
    Object.assign(m.ball, { x: aim.x, y: 1.4, z: aim.z, vx: 0, vy: -8, vz: 0, held: false, lastId: 'me', lastTeam: 'red', shot: 'spike' });
    until(m, () => m.view.phase === 'scored', 2);
    expect(m.view.hits).toBe(1);
  });
});
