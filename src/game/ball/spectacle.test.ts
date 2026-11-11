import { describe, expect, it } from 'vitest';
import { BallMatch, SEEN } from './BallMatch';
import { BALL_ID, GOAL_RULES } from './model';
import { INTRO, PODIUM, podiumOf } from './ceremony';
import { DUEL, LINK, SIGNATURE_FIGHTERS, SIGNATURE_SHOTS, duelWinner, superShotName } from './superShots';
import { BallBrain } from './BallBrain';
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
  type Duel = { duel(seat: unknown, actor: unknown, speed: number): void };
  let seq = 1;
  /** A person's press: any strike (or a guard pressed afresh), `view` the room time its page drew. */
  const press = (m: BallMatch, id: string, extra: Record<string, unknown> = { attack: 'heavy' }) => m.submit(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...extra });
  function shoot() {
    const m = trio();
    until(m, () => m.view.phase === 'live');
    m.ball.x = 0; m.ball.z = 6; m.ball.y = 1;
    aim(m, 'red-1', 0);
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'ultimate'));
    expect(m.ball.super).toBe(true);
    // (The striker well away, as on a pitch: the dead ball pops up in front of the keeper.)
    m.sim.place('red-1', { x: 12, y: 0, z: -10 }, 0);
    (m as unknown as Duel).duel(m.seats.get('blue-1'), m.sim.actors.get('blue-1'), 40);
    return m;
  }
  const ended = (m: BallMatch) => m.view.events.find(e => e.kind === 'duel-won');
  it('holds the ball for its beat, then the keeper nearer the mark kills the shot', () => {
    const m = shoot(), start = m.sim.serverTime;
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'duel', actorId: 'blue-1', targetId: 'red-1', value: DUEL.hold });
    expect(m.ball.clash).toBeGreaterThan(m.sim.serverTime);
    steps(m, DUEL.mark - .1); press(m, 'red-1');
    steps(m, .1); press(m, 'blue-1');
    steps(m, DUEL.hold - DUEL.mark - .05);
    expect(ended(m)).toBeUndefined();
    steps(m, .1);
    const e = ended(m)!;
    expect(e).toMatchObject({ actorId: 'blue-1', targetId: 'red-1', text: 'SHOT STOPPED' });
    expect(Math.abs(e.presses!.keeper!)).toBeLessThan(20);
    expect(e.presses!.striker).toBeLessThan(-80);
    // (The beat is as long as it was: the end lands DUEL.hold after the duel began.)
    expect(e.at - start).toBeGreaterThanOrEqual(DUEL.hold - 1e-6);
    expect(e.at - start).toBeLessThan(DUEL.hold + .02);
    expect(m.ball.super).toBe(false);
    expect(m.ball.heat).toBeLessThan(1);
    expect(m.ball.lastTeam).toBe('blue');
    expect(m.seats.get('blue-1')!.feats).toContain('TECHNIQUE DUEL');
  });
  it('the striker nearer the mark breaks through, and the shot flies on', () => {
    const m = shoot();
    steps(m, DUEL.mark - .15); press(m, 'blue-1');
    steps(m, .15); press(m, 'red-1');
    steps(m, DUEL.hold);
    expect(ended(m)).toMatchObject({ actorId: 'red-1', text: 'BREAKS THROUGH' });
    expect(m.ball.super).toBe(true);
    expect(m.ball.vz).toBeGreaterThan(10);
  });
  it('a press beats none, either way; two misses fall back to the striker', () => {
    const keeper = shoot();
    steps(keeper, DUEL.mark + .1); press(keeper, 'blue-1'); steps(keeper, DUEL.hold);
    expect(ended(keeper)).toMatchObject({ actorId: 'blue-1', text: 'SHOT STOPPED' });
    const striker = shoot();
    steps(striker, .05); press(striker, 'red-1'); steps(striker, DUEL.hold);
    expect(ended(striker)).toMatchObject({ actorId: 'red-1', text: 'BREAKS THROUGH' });
    const none = shoot();
    steps(none, DUEL.hold + .05);
    expect(ended(none)).toMatchObject({ actorId: 'red-1', text: 'BREAKS THROUGH', presses: {} });
  });
  it('the first press is the one, a fresh guard is a press, and a press in the beat swings nothing', () => {
    const m = shoot();
    steps(m, DUEL.mark); press(m, 'blue-1', { guard: false }); press(m, 'blue-1', { guard: true });
    steps(m, .1); press(m, 'red-1'); press(m, 'red-1', { attack: 'light' });
    expect(m.sim.actors.get('red-1')!.state.action).not.toBe('heavy');
    steps(m, DUEL.hold);
    const e = ended(m)!;
    expect(Math.abs(e.presses!.keeper!)).toBeLessThan(20);
    expect(e.presses!.striker).toBeGreaterThan(80);
    expect(e.text).toBe('SHOT STOPPED');
  });
  it('a press past DUEL.late is no press: it loses to one in time', () => {
    const m = shoot();
    steps(m, DUEL.mark + DUEL.late + .05); press(m, 'red-1');
    steps(m, .02); press(m, 'blue-1');
    steps(m, DUEL.hold);
    expect(ended(m)).toMatchObject({ text: 'BREAKS THROUGH', presses: {} });
    const k = shoot();
    steps(k, DUEL.mark + DUEL.late + .05); press(k, 'red-1');
    steps(k, .0); press(k, 'blue-1', { guard: true });
    steps(k, DUEL.hold);
    expect(ended(k)?.text).toBe('BREAKS THROUGH');
  });
  it('online, a press counts when its page drew it (SEEN), at most SEEN.most back', () => {
    const m = shoot();
    m.compensate = SEEN.most;
    // (The keeper's page draws the room 0.2 s behind: its press on its own mark is heard 0.2 s after the room's.)
    const view = () => m.sim.serverTime - .2;
    press(m, 'blue-1', { view: view(), moveX: 0 });
    steps(m, DUEL.mark + .2); press(m, 'blue-1', { view: view(), attack: 'heavy' });
    steps(m, DUEL.hold);
    const e = ended(m)!;
    expect(Math.abs(e.presses!.keeper!)).toBeLessThan(20);
    expect(e.text).toBe('SHOT STOPPED');
  });
});

describe('the bots\' duel (BallBrain DUEL_BOT)', () => {
  it('two bots of a level give the striker about the old roll\'s 45%, a sharper keeper more', () => {
    let x = 99;
    const draw = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (x || 1) / 0x100000000; };
    const brain = (level: 'easy' | 'normal' | 'hard') => { const b = new BallBrain('b', 'goal-rush', 0, draw); b.levelled(level, false); return b; };
    const share = (k: 'easy' | 'normal' | 'hard', s: 'easy' | 'normal' | 'hard') => {
      const keeper = brain(k), striker = brain(s);
      let won = 0;
      for (let i = 0; i < 20000; i++) if (duelWinner({ keeper: keeper.duelPress(draw), striker: striker.duelPress(draw) }) === 'striker') won++;
      return won / 20000;
    };
    for (const level of ['easy', 'normal', 'hard'] as const) expect(share(level, level)).toBeGreaterThan(.41), expect(share(level, level)).toBeLessThan(.49);
    expect(share('hard', 'easy')).toBeLessThan(share('easy', 'hard'));
  });
});

describe('duelWinner', () => {
  it('the nearer to the mark, the keeper\'s miss counted at DUEL.keeper of itself', () => {
    expect(duelWinner({ keeper: .05, striker: -.1 })).toBe('keeper');
    expect(duelWinner({ keeper: -.1, striker: .05 })).toBe('striker');
    // (Within the keeper's fifth: .1 counts .08, so .09 loses to it.)
    expect(duelWinner({ keeper: .1, striker: .09 })).toBe('keeper');
    expect(duelWinner({ keeper: .1, striker: .07 })).toBe('striker');
  });
  it('one press beats none; none at all is the striker\'s', () => {
    expect(duelWinner({ keeper: .3 })).toBe('keeper');
    expect(duelWinner({ striker: .3 })).toBe('striker');
    expect(duelWinner({})).toBe('striker');
  });
  it('awakened tilts it, as the roll did', () => {
    expect(duelWinner({ keeper: .1, striker: .07 }, true)).toBe('keeper');
    expect(duelWinner({ keeper: .1, striker: .09 }, false, true)).toBe('striker');
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
