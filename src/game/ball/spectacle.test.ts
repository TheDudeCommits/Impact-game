import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, GOAL_RULES } from './model';
import { INTRO, PODIUM, podiumOf } from './ceremony';
import { DUEL, LINK, SIGNATURE_FIGHTERS, SIGNATURE_SHOTS, superShotName } from './superShots';
import { isReleasedFighter } from '../rosterAvailability';
import type { ExternalBlow } from '../simulation';
import type { MoveDefinition } from '../moves';

const MOVE: MoveDefinition = { name: 'Test Blow', duration: .4, contacts: [.1], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string, slot: ExternalBlow['slot'] = 'heavy', finisher = true): ExternalBlow =>
  ({ attackerId, slot, move: MOVE, damage: 10, critical: false, finisher, pushX: 0, pushZ: 1, knockback: MOVE.knockback, stun: .2, launch: false, hitstop: .05 });
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
function aim(m: BallMatch, id: string, yaw: number) {
  const a = m.sim.actors.get(id)!;
  a.attackYaw = yaw; a.input.yaw = yaw; a.state.yaw = yaw;
  m.sim.place(id, { x: m.ball.x - Math.sin(yaw), y: 0, z: m.ball.z - Math.cos(yaw) }, yaw);
}
/** People only (no bot moves the ball but the test): two on red, one on blue. */
function trio(intro = false) {
  const m = new BallMatch('goal-rush', { seed: 5, access: 'host', fillBots: false, intro });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('red-2', 'konta', 'Red Two', false, 'red');
  m.add('blue-1', 'gummy', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  return m;
}

describe('the signature super shots', () => {
  it('names eight released fighters, each once, in capital letters', () => {
    expect(SIGNATURE_FIGHTERS).toHaveLength(8);
    const names = SIGNATURE_FIGHTERS.map(f => SIGNATURE_SHOTS[f]!.name);
    expect(new Set(names).size).toBe(8);
    for (const f of SIGNATURE_FIGHTERS) {
      expect(isReleasedFighter(f), f).toBe(true);
      expect(SIGNATURE_SHOTS[f]!.name).toMatch(/^[A-Z]{4,12}$/);
      expect(SIGNATURE_SHOTS[f]!.kanji.length).toBeGreaterThan(0);
    }
    expect(superShotName('taisei')).toBe(SIGNATURE_SHOTS.taisei!.name);
    expect(superShotName('kagari')).toBe('SUPER SHOT');
  });
});

describe('the intro', () => {
  it('holds the countdown for the intro, and the one person here skipping it brings the kickoff', () => {
    const m = trio(true);
    expect(m.view.intro?.seconds).toBe(INTRO.seconds);
    expect((m.view.startsAt ?? 0) - m.sim.serverTime).toBeCloseTo(INTRO.seconds, 3);
    steps(m, 3.5);
    expect(m.view.phase).toBe('countdown');
    expect(m.skip('red-1')).toBe(true);
    expect(m.view.intro).toMatchObject({ skips: 1, people: 3 });
    expect(m.view.phase).toBe('countdown');
    m.skip('red-2'); m.skip('blue-1');
    expect(m.view.intro?.skipped).toBe(true);
    expect(until(m, () => m.view.phase === 'kickoff', INTRO.skipTo + .1)).toBe(true);
  });
  it('has none in FREE PLAY, nor unless asked', () => {
    expect(trio().view.intro).toBeUndefined();
    const m = new BallMatch('sky-spike', { seed: 2, access: 'bots', practice: true, intro: true });
    m.add('me', 'taisei', 'Me', false, 'red');
    expect(m.start()).toBe(true);
    expect(m.view.intro).toBeUndefined();
  });
});

describe('the LINK SHOT', () => {
  it('is a team-mate\'s tap finished first time inside the window: a tier hotter, both named, an accolade', () => {
    const m = trio();
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 0; m.ball.y = .62;
    aim(m, 'red-1', 0);
    expect(m.receive(m.locate(BALL_ID)!, blow('red-1', 'light', false))).not.toBeNull();
    expect(m.ball.shot).toBe('tap');
    steps(m, .15);
    const before = m.ball.heat;
    aim(m, 'red-2', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-2'));
    const strike = [...m.view.events].reverse().find(e => e.kind === 'strike');
    expect(strike).toMatchObject({ actorId: 'red-2', assistId: 'red-1', text: 'LINK SHOT' });
    expect(m.ball.link).toBe('red-1');
    expect(m.ball.heat - before).toBeGreaterThanOrEqual(LINK.heat);
    expect(m.seats.get('red-2')!.feats).toContain('LINK SHOT');
    // Any touch after it ends the link.
    aim(m, 'blue-1', Math.PI);
    m.receive(m.locate(BALL_ID)!, blow('blue-1'));
    expect(m.ball.link).toBeNull();
  });
  it('is not one past the window, nor off the striker\'s own tap', () => {
    const late = trio();
    until(late, () => late.view.phase === 'live');
    late.ball.x = 0; late.ball.z = 0; late.ball.y = .62;
    aim(late, 'red-1', 0);
    late.receive(late.locate(BALL_ID)!, blow('red-1', 'light', false));
    steps(late, LINK.window['goal-rush'] + .2);
    aim(late, 'red-2', 0);
    late.receive(late.locate(BALL_ID)!, blow('red-2'));
    expect(late.view.events.some(e => e.text === 'LINK SHOT')).toBe(false);
    const own = trio();
    until(own, () => own.view.phase === 'live');
    own.ball.x = 0; own.ball.z = 0; own.ball.y = .62;
    aim(own, 'red-1', 0);
    own.receive(own.locate(BALL_ID)!, blow('red-1', 'light', false));
    steps(own, .2);
    aim(own, 'red-1', 0);
    own.receive(own.locate(BALL_ID)!, blow('red-1'));
    expect(own.view.events.some(e => e.text === 'LINK SHOT')).toBe(false);
  });
});

describe('the TECHNIQUE DUEL', () => {
  type Duel = { duel(seat: unknown, actor: unknown, speed: number): void; rng: () => number };
  function shoot(keeperWins: boolean) {
    const m = trio();
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 6; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'ultimate'));
    expect(m.ball.super).toBe(true);
    // (The striker well away, as on a pitch: the dead ball pops up in front of the keeper.)
    m.sim.place('red-1', { x: 12, y: 0, z: -10 }, 0);
    (m as unknown as Duel).rng = () => keeperWins ? 0 : .999;
    (m as unknown as Duel).duel(m.seats.get('blue-1'), m.sim.actors.get('blue-1'), 40);
    return m;
  }
  it('holds the ball for its beat, then the keeper who wins it kills the shot', () => {
    const m = shoot(true);
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'duel', actorId: 'blue-1', targetId: 'red-1', value: DUEL.hold });
    expect(m.ball.clash).toBeGreaterThan(m.sim.serverTime);
    steps(m, DUEL.hold + .05);
    expect(m.view.events.some(e => e.kind === 'duel-won' && e.actorId === 'blue-1' && e.text === 'SHOT STOPPED')).toBe(true);
    expect(m.ball.super).toBe(false);
    expect(m.ball.heat).toBeLessThan(1);
    expect(m.ball.lastTeam).toBe('blue');
    expect(m.seats.get('blue-1')!.feats).toContain('TECHNIQUE DUEL');
  });
  it('or the shot breaks through, and flies on', () => {
    const m = shoot(false);
    steps(m, DUEL.hold + .05);
    expect(m.view.events.some(e => e.kind === 'duel-won' && e.actorId === 'red-1' && e.text === 'BREAKS THROUGH')).toBe(true);
    expect(m.ball.super).toBe(true);
    expect(m.ball.vz).toBeGreaterThan(10);
  });
});

describe('the podium', () => {
  it('stands the winners on it, their best in the middle, the ball beside it', () => {
    const m = trio();
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = GOAL_RULES.halfZ - 10; m.ball.y = 1;
    aim(m, 'red-2', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-2'));
    until(m, () => m.view.phase === 'scored', 4);
    (m as unknown as { finish(w: string, r: string): void }).finish('red', 'Full time.');
    const layout = podiumOf('goal-rush', 'red'), best = m.sim.winnerId!;
    expect(best).toBe('red-2');
    const top = m.sim.actors.get(best)!.state;
    expect(top.x).toBeCloseTo(layout.spots[0].x, 3); expect(top.z).toBeCloseTo(layout.spots[0].z, 3); expect(top.y).toBeCloseTo(PODIUM.heights[0], 3);
    const side = m.sim.actors.get('red-1')!.state;
    expect(side.y).toBeCloseTo(PODIUM.heights[1], 3);
    expect(Math.hypot(side.x - layout.x, side.z - layout.z)).toBeCloseTo(PODIUM.spacing, 3);
    expect(Math.hypot(m.ball.x - layout.ball.x, m.ball.z - layout.ball.z)).toBeLessThan(.01);
    expect(m.sim.actors.get(best)!.state.action).toBe('victory');
  });
});
