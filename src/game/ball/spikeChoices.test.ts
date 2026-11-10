import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, SPIKE_RULES, type BallTeam } from './model';
import { landing } from './physics';
import { SERVE_STYLE, SPIKE_QUICK, SPIKE_TIP } from './strike';
import { jumpArc, type MoveDefinition } from '../moves';
import type { ExternalBlow } from '../simulation';

// Sky Spike's choices (strike.ts SERVE_STYLE, SPIKE_QUICK, SPIKE_TIP), the PERFECT SPIKE
// through an untimed block, the rules fixed on the way, and the match's swings.
const MOVE: MoveDefinition = { name: 'Test Blow', duration: .4, contacts: [.1], damage: 10, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .2, knockback: 4, style: 'melee' };
const blow = (attackerId: string, slot: ExternalBlow['slot'] = 'heavy'): ExternalBlow =>
  ({ attackerId, slot, move: MOVE, damage: 10, critical: false, finisher: false, pushX: 0, pushZ: 1, knockback: 4, stun: .2, launch: false, hitstop: .05 });
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
type Private = { bodyContacts(dt: number): void; point(winner: BallTeam, why: 'floor' | 'out' | 'touches' | 'serve', byId?: string): void; dashAt: Map<string, number>; hot: boolean };
const inside = (m: BallMatch) => m as unknown as Private;

/** Two people, one a side, nobody else: no bot moves the ball but the test. */
function pair() {
  const m = new BallMatch('sky-spike', { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  return m;
}
/** A seat put somewhere, facing `yaw`, on the floor or up in its jump at `share` of the jump's top, holding the stick. */
function put(m: BallMatch, id: string, at: { x: number; z: number }, yaw: number, share = 0, stick = { x: 0, z: 0 }) {
  const a = m.sim.actors.get(id)!;
  m.sim.place(id, { x: at.x, y: 0, z: at.z }, yaw);
  a.attackYaw = yaw; a.input.yaw = yaw; a.state.yaw = yaw; a.input.moveX = stick.x; a.input.moveZ = stick.z;
  if (share > 0) { a.state.grounded = false; a.state.y = jumpArc(a.state.fighter).apex * share; }
  return a;
}
/** The rally under way on red's side: `touches` of red's touches spent, the ball where it is put. */
function rally(m: BallMatch, touches: number, ball: Partial<typeof m.ball>) {
  m.view.phase = 'live'; m.view.rally = 1; m.view.touchTeam = 'red'; m.view.touches = touches;
  Object.assign(m.ball, { held: false, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, lastId: 'red-1', lastTeam: 'red', heat: .5 }, ball);
}

describe('Sky Spike: the sets', () => {
  it('sets a QUICK SET from the air: at the hitter\'s hand at the net in a breath, announced', () => {
    const m = pair();
    rally(m, 1, { x: 1, y: 2.4, z: -4.5, vy: -2, shot: 'bump' });
    put(m, 'red-1', { x: 1, z: -5 }, 0, .2);
    expect(m.receive(m.locate(BALL_ID)!, blow('red-1', 'light'))).not.toBeNull();
    expect(m.ball.shot).toBe('set');
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'set', text: 'QUICK SET', actorId: 'red-1' });
    const at = landing('sky-spike', m.ball, SPIKE_QUICK.height);
    expect(at.t).toBeGreaterThan(SPIKE_QUICK.seconds - .12); expect(at.t).toBeLessThan(SPIKE_QUICK.seconds + .12);
    expect(Math.abs(at.z + SPIKE_QUICK.z)).toBeLessThan(.6);
  });
  it('sets a BACK SET to the far wing with the stick held across, and the floating set without it', () => {
    const back = pair();
    rally(back, 1, { x: 2.5, y: 2.4, z: -4.5, vy: -2, shot: 'bump' });
    // Red faces +z; the stick held toward -x on the floor: across the court from the setter.
    put(back, 'red-1', { x: 2.5, z: -5 }, 0, 0, { x: -1, z: 0 });
    back.receive(back.locate(BALL_ID)!, blow('red-1', 'light'));
    expect(back.view.events.at(-1)).toMatchObject({ kind: 'set', text: 'BACK SET' });
    expect(landing('sky-spike', back.ball, 5.9).x).toBeLessThan(-3.6);
    const high = pair();
    rally(high, 1, { x: 2.5, y: 2.4, z: -4.5, vy: -2, shot: 'bump' });
    put(high, 'red-1', { x: 2.5, z: -5 }, 0);
    high.receive(high.locate(BALL_ID)!, blow('red-1', 'light'));
    expect(high.ball.shot).toBe('set');
    expect(high.view.events.some(e => e.kind === 'set')).toBe(false);
    // The floating set climbs to about 7 m.
    expect(high.ball.y + high.ball.vy ** 2 / (2 * SPIKE_RULES.gravity)).toBeGreaterThan(6.5);
  });
});

describe('Sky Spike: the attack', () => {
  it('TIPs a light from the air on the attacking touch: soft, short behind the block, into the empty side', () => {
    const m = pair();
    rally(m, 2, { x: 0, y: 5.8, z: -1.3, shot: 'set' });
    put(m, 'red-1', { x: 0, z: -1.9 }, 0, .95);
    // Blue's blocker up at the net in front of the ball.
    put(m, 'blue-1', { x: .2, z: .9 }, Math.PI, .9);
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'light'));
    expect(m.ball.shot).toBe('tip');
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'strike', shot: 'tip', text: 'TIP' });
    expect(Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz)).toBeLessThan(13);
    const down = landing('sky-spike', m.ball);
    expect(down.z).toBeGreaterThan(SPIKE_TIP.near - .6); expect(down.z).toBeLessThan(SPIKE_TIP.far + .8);
    expect(Math.abs(down.x)).toBeGreaterThan(2.5);
    // Over the hands of a blocker up at the net: nothing of blue's in the air there touches it.
    inside(m).bodyContacts(1 / 60);
    expect(m.ball.lastTeam).toBe('red');
  });
  it('sends a PERFECT SPIKE through a block not timed to it, and only a STUFF BLOCK stops it at the net', () => {
    const spike = (timed: boolean) => {
      const m = pair();
      rally(m, 2, { x: 0, y: 5.9, z: -1.4, shot: 'set' });
      put(m, 'red-1', { x: 0, z: -2 }, 0, 1);
      m.receive(m.locate(BALL_ID)!, blow('red-1', 'heavy'));
      expect(m.view.events.some(e => e.kind === 'strike' && e.perfect)).toBe(true);
      expect(inside(m).hot).toBe(true);
      // Blue up at the net with the hands up, right where the spike passes: pressed long ago, or just now.
      const a = put(m, 'blue-1', { x: m.ball.x, z: .5 }, Math.PI, .8);
      a.state.guarding = true; a.guardPressedAt = timed ? m.sim.serverTime : m.sim.serverTime - 1;
      for (let i = 0; i < 20 && m.ball.vz > 0 && Math.abs(m.ball.z) < 3; i++) {
        m.ball.x += m.ball.vx / 60; m.ball.y += m.ball.vy / 60; m.ball.z += m.ball.vz / 60;
        a.state.y = Math.max(a.state.y, m.ball.y - 1.6);
        inside(m).bodyContacts(1 / 60);
      }
      return m;
    };
    const through = spike(false);
    expect(through.view.events.some(e => e.kind === 'block' || e.kind === 'perfect')).toBe(false);
    expect(through.ball.vz).toBeGreaterThan(10);
    const stuffed = spike(true);
    expect(stuffed.view.events.at(-1)).toMatchObject({ kind: 'perfect', text: 'STUFF BLOCK' });
  });
  it('gives the hitters three touches of their own back off a block met before the ball crossed (no FOUR TOUCHES)', () => {
    const m = pair();
    rally(m, 3, { x: 0, y: 3.4, z: -.4, vy: -4, vz: 14, shot: 'spike' });
    const before = m.view.rally;
    (m as unknown as { guardBall(s: unknown, at: number, nx: number, ny: number, nz: number, speed: number): void }).guardBall(m.seats.get('blue-1')!, m.sim.serverTime - 1, 0, 0, -1, 15);
    expect(m.view.events.at(-1)).toMatchObject({ kind: 'block' });
    expect(m.view.touchTeam).toBe('red'); expect(m.view.touches).toBe(0);
    // The block at the net is the rally's exchange.
    expect(m.view.rally).toBe(before + 1);
    put(m, 'red-1', { x: m.ball.x, z: -3 }, 0);
    Object.assign(m.ball, { x: 0, y: 1.5, z: -2.5, vx: 0, vy: -1, vz: -1 });
    m.receive(m.locate(BALL_ID)!, blow('red-1', 'light'));
    expect(m.view.phase).toBe('live'); expect(m.view.touches).toBe(1);
  });
  it('lets a hitter climbing straight up under the set meet it with the swing, not the head', () => {
    // A floating set coming down right over the hitter: jump at once, swing a breath before the top of the jump.
    const perfect = (back: number) => {
      const m = new BallMatch('sky-spike', { seed: 5, access: 'bots', practice: true });
      m.add('me', 'taisei', 'Me', false, 'red');
      m.start(); steps(m, 3.1);
      until(m, () => m.view.phase === 'live', 2);
      const arc = jumpArc('taisei'), g = SPIKE_RULES.gravity, meet = arc.apex + .9;
      // The ball falls through the meeting height as the body reaches the top of its jump, plus the swing's wind-up.
      const fall = arc.rise + .13, y0 = meet + .5 * g * fall * fall;
      m.sim.place('me', { x: 0, y: 0, z: -1.8 - back }, 0);
      Object.assign(m.ball, { x: 0, y: y0, z: -1.8, vx: 0, vy: 0, vz: 0, held: false, shot: 'set', lastId: 'me', lastTeam: 'red', heat: .5 });
      m.view.touchTeam = 'red'; m.view.touches = 2; m.view.rally = 1;
      const swing = Math.round((arc.rise - .1) * 60);
      for (let i = 0; i < 90 && m.ball.shot === 'set'; i++) {
        m.submit('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, jump: i === 0, jumpHeld: i < 40, attack: i === swing ? 'heavy' : undefined, targetId: BALL_ID });
        m.step(1 / 60);
      }
      return !!m.view.events.find(e => e.kind === 'strike' && e.perfect);
    };
    expect(perfect(0)).toBe(true);
    expect(perfect(.7)).toBe(true);
  });
  it('calls a dig off a dash a DIVING DIG only when the dive\'s reach got to it', () => {
    const dig = (off: number) => {
      const m = pair();
      m.view.phase = 'live'; m.view.rally = 2; m.view.touchTeam = 'red'; m.view.touches = 0;
      put(m, 'red-1', { x: off, z: -5.2 }, 0);
      inside(m).dashAt.set('red-1', m.sim.serverTime);
      Object.assign(m.ball, { held: false, x: 0, y: 1.4, z: -3.9, vx: 0, vy: -2, vz: -22, shot: 'spike', lastId: 'blue-1', lastTeam: 'blue', heat: 1 });
      for (let i = 0; i < 12 && m.ball.lastTeam === 'blue'; i++) { m.ball.x += m.ball.vx / 60; m.ball.y += m.ball.vy / 60; m.ball.z += m.ball.vz / 60; inside(m).bodyContacts(1 / 60); }
      return m.view.events.find(e => e.kind === 'dig')?.text;
    };
    expect(dig(0)).toBe('DIG');
    expect(dig(1.45)).toBe('DIVING DIG');
  });
});

describe('Sky Spike: the serve', () => {
  /** A serve's walk-up with the server jumping beside the ball; struck with a heavy once the body is `share` of the way up. */
  const jumpServe = (share: number, seed = 3) => {
    const m = new BallMatch('sky-spike', { seed, access: 'host', fillBots: false });
    m.add('red-1', 'taisei', 'Red', false, 'red'); m.add('blue-1', 'konta', 'Blue', false, 'blue');
    m.start(); steps(m, 3.1);
    expect(m.view.phase).toBe('kickoff');
    const server = m.view.serverId!, a = m.sim.actors.get(server)!, apex = jumpArc(a.state.fighter).apex, rest = m.ball.y;
    const yaw = m.view.servingTeam === 'red' ? 0 : Math.PI;
    let peak = 0;
    for (let i = 0; i < 90 && m.view.phase === 'kickoff'; i++) {
      m.submit(server, { seq: i + 1, moveX: 0, moveZ: 0, yaw, jump: i === 0, jumpHeld: i < 40, targetId: BALL_ID });
      m.step(1 / 60);
      peak = Math.max(peak, m.ball.y);
      if (!a.state.grounded && a.state.y >= apex * share) { a.attackYaw = yaw; m.receive(m.locate(BALL_ID)!, blow(server, 'heavy')); }
    }
    return { m, team: m.view.servingTeam, tossed: peak - rest };
  };
  it('tosses the ball up with a server who jumps, and a JUMP SERVE from the top of the jump goes in, hard and warm', () => {
    const { m, team, tossed } = jumpServe(.96);
    expect(tossed).toBeGreaterThan(2);
    const e = m.view.events.find(x => x.kind === 'strike' && x.shot === 'serve');
    expect(e?.text).toBe('PERFECT SERVE');
    expect(e!.value!).toBeGreaterThan(SERVE_STYLE.drive + 4);
    const down = landing('sky-spike', m.ball), far = team === 'red' ? 1 : -1;
    expect(down.z * far).toBeGreaterThan(5); expect(Math.abs(down.z)).toBeLessThan(SPIKE_RULES.courtHalfZ);
    expect(Math.abs(down.x)).toBeLessThan(SPIKE_RULES.courtHalfX);
  });
  it('sprays a JUMP SERVE struck on the way up: long, often out (the risk of the power)', () => {
    let out = 0, served = 0;
    for (const seed of [3, 5, 8, 11, 13, 21]) {
      const { m } = jumpServe(.6, seed);
      const e = m.view.events.find(x => x.kind === 'strike' && x.shot === 'serve');
      if (!e) continue;
      served++;
      expect(e.text).toBe('JUMP SERVE');
      const down = landing('sky-spike', m.ball);
      if (Math.abs(down.z) > SPIKE_RULES.courtHalfZ || Math.abs(down.x) > SPIKE_RULES.courtHalfX) out++;
    }
    expect(served).toBeGreaterThan(3);
    expect(out).toBeGreaterThan(0);
  });
  it('serves a FLOAT SERVE with a light from the floor, and its reception goes off line', () => {
    const m = pair();
    const server = m.view.serverId!, receiver = server === 'red-1' ? 'blue-1' : 'red-1', yaw = m.view.servingTeam === 'red' ? 0 : Math.PI;
    put(m, server, { x: 0, z: m.ball.z - Math.cos(yaw) * 1.1 }, yaw);
    m.receive(m.locate(BALL_ID)!, blow(server, 'light'));
    expect(m.view.events.find(x => x.kind === 'strike')?.text).toBe('FLOAT SERVE');
    // Received with a bump where it comes down: the bump lands off the spot a bump is laid for.
    const down = landing('sky-spike', m.ball, 1.2), side = m.seats.get(receiver)!.team, sign = side === 'red' ? -1 : 1;
    steps(m, Math.max(0, down.t - .1));
    put(m, receiver, { x: m.ball.x, z: m.ball.z - Math.cos(yaw) * .5 }, yaw + Math.PI);
    m.receive(m.locate(BALL_ID)!, blow(receiver, 'light'));
    expect(m.ball.lastId).toBe(receiver);
    const bump = landing('sky-spike', m.ball, 2.6);
    expect(Math.hypot(bump.x - m.ball.x * .4, bump.z - sign * 5.2)).toBeGreaterThan(.3);
  });
  it('lets nobody block or attack a serve at the net', () => {
    const m = pair();
    m.view.phase = 'live'; m.view.rally = 0; m.view.touchTeam = 'red'; m.view.touches = 3;
    Object.assign(m.ball, { held: false, x: 0, y: 3.6, z: .3, vx: 0, vy: -1, vz: 20, shot: 'serve', lastId: 'red-1', lastTeam: 'red' });
    const a = put(m, 'blue-1', { x: 0, z: 1 }, Math.PI, .5);
    a.state.guarding = true; a.guardPressedAt = m.sim.serverTime;
    inside(m).bodyContacts(1 / 60);
    expect(m.ball.lastTeam).toBe('red');
    expect(m.receive(m.locate(BALL_ID)!, blow('blue-1'))).toBeNull();
  });
});

describe('Sky Spike: the swings', () => {
  it('calls a COMEBACK when a side four down draws level, and DEUCE at ten all', () => {
    const m = pair();
    const point = (team: BallTeam) => { m.view.phase = 'live'; inside(m).point(team, 'out'); };
    for (let i = 0; i < 4; i++) point('red');
    for (let i = 0; i < 4; i++) point('blue');
    expect(m.view.events.filter(e => e.kind === 'comeback')).toHaveLength(1);
    expect(m.view.events.find(e => e.kind === 'comeback')).toMatchObject({ team: 'blue', value: 4, text: 'COMEBACK' });
    for (let i = 0; i < 6; i++) { point('red'); point('blue'); }
    expect(m.view.score).toEqual({ red: 10, blue: 10 });
    expect(m.view.events.filter(e => e.kind === 'deuce').length).toBeGreaterThanOrEqual(1);
    expect(m.view.events.at(-1)?.kind === 'deuce' || m.view.events.some(e => e.kind === 'deuce' && e.value === 10)).toBe(true);
  });
  it('plays its choices in a bots match: every serve, set and attack, and FEVER from the eighth crossing', () => {
    // (Each side of bots plays a plan - BallBrain PLAN - which steers most of its sets, so one match may not
    // show every set: a few seeds, until it has.)
    const texts = new Set<string>(), wants = ['strike:FLOAT SERVE', 'set:QUICK SET', 'set:BACK SET'];
    for (const seed of [8, 11, 21]) {
      const m = new BallMatch('sky-spike', { seed, access: 'bots', replays: false });
      m.add('p', 'konta', 'P', false, 'red'); m.pilot('p'); m.start();
      // (The view keeps the last sixty events: read them as they come.)
      const seen = new Set<number>();
      for (let i = 0; i < 60 * 60 * 8 && m.view.phase !== 'over'; i++) {
        m.step(1 / 60);
        for (const e of m.view.events) if (!seen.has(e.id)) { seen.add(e.id); texts.add(`${e.kind}:${e.text ?? e.shot ?? ''}`); if (e.kind === 'strike' && e.shot === 'tip') texts.add('tip'); }
      }
      expect(m.view.phase).toBe('over');
      m.dispose();
      if (wants.every(w => texts.has(w)) && texts.has('tip')) break;
    }
    for (const want of wants) expect(texts).toContain(want);
    expect([...texts].some(t => t === 'strike:JUMP SERVE' || t === 'strike:PERFECT SERVE')).toBe(true);
    expect(texts).toContain('tip');
    expect(SPIKE_RULES.fever).toBe(8);
  }, 300000); // up to three matches, on a busy machine
});
