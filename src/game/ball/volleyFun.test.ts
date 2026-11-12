import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, CLASSIC_COURT, SPIKE_RULES, VOLLEY_COURT, onCourt, sameCourt, spikeCourt, type BallState, type BallTeam } from './model';
import { courtSide, freshBall, stepBall } from './physics';
import { VOLLEY, brought, walked } from './volley';

// Sky Spike on the volleyball rules with the person at its heart - the side's hitter in every rally,
// brought to the attack and to the block - on a court sized for three a side. Everything here is the volleyball rules'
// only: the classic match (and its 16-seed sims) is untouched.
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
let seq = 100;
const send = (m: BallMatch, id: string, stick = { x: 0, z: 0 }, extra: Record<string, unknown> = {}) =>
  m.submit(id, { seq: ++seq, moveX: stick.x, moveZ: stick.z, yaw: 0, targetId: BALL_ID, ...extra });
const touches = (m: BallMatch, id: string) => m.view.events.filter(e => e.kind === 'touch' && e.actorId === id);
/** A BOTS match on the volleyball rules: the person red, two bots with them, three against. */
function bots(seed = 3) {
  const m = new BallMatch('sky-spike', { seed, access: 'bots', replays: false, volleyball: true, difficulty: 'normal' });
  m.add('me', 'konta', 'Me', false, 'red');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  return m;
}
function rally(m: BallMatch, team: BallTeam, touches: number, ball: Partial<BallState>) {
  m.view.phase = 'live'; m.view.rally = 1; m.view.touchTeam = team; m.view.touches = touches;
  Object.assign(m.ball, { held: false, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: .5, shot: 'bump' }, ball);
}
const botsOf = (m: BallMatch, team: BallTeam) => [...m.seats.values()].filter(s => s.bot && s.team === team).map(s => s.id);

describe('volleyball: a court for three a side', () => {
  it('is carried on the ball of a volleyball match and its LEARN TO PLAY - not the classic\'s, nor FREE PLAY\'s', () => {
    expect(new BallMatch('sky-spike', { seed: 3, access: 'bots', volleyball: true }).ball.court).toBe(VOLLEY_COURT);
    expect(new BallMatch('sky-spike', { seed: 3, access: 'bots' }).ball.court).toBeUndefined();
    expect(new BallMatch('sky-spike', { seed: 3, access: 'bots', volleyball: true, practice: true, lesson: true }).ball.court).toBe(VOLLEY_COURT);
    expect(new BallMatch('sky-spike', { seed: 3, access: 'bots', volleyball: true, practice: true }).ball.court).toBeUndefined();
    expect(new BallMatch('sky-spike', { seed: 3, access: 'bots', practice: true, lesson: true }).ball.court).toBeUndefined();
    // About 9 m wide and 16 m long, inside the classic's 15 x 21 m; SPIKE_RULES is the classic's to the digit.
    expect(VOLLEY_COURT.x * 2).toBe(9); expect(VOLLEY_COURT.z * 2).toBe(16);
    expect([SPIKE_RULES.courtHalfX, SPIKE_RULES.courtHalfZ, SPIKE_RULES.halfX, SPIKE_RULES.halfZ]).toEqual([7.5, 10.5, 15, 18.5]);
    expect(spikeCourt(freshBall())).toBe(CLASSIC_COURT);
    expect(onCourt(CLASSIC_COURT, 5.2, 8.6)).toEqual({ x: 5.2, z: 8.6 });
    expect(sameCourt({ ...VOLLEY_COURT }, VOLLEY_COURT)).toBe(true); expect(sameCourt(undefined, VOLLEY_COURT)).toBe(false);
  });
  it('calls a ball in or out by its own lines, and rebounds off its own barrier', () => {
    expect(courtSide(6, -4)).toBe('red');
    expect(courtSide(6, -4, VOLLEY_COURT)).toBeUndefined();
    expect(courtSide(4, 7.9, VOLLEY_COURT)).toBe('blue');
    // A ball rolling at the side wall meets it at the court's barrier, not the classic dome's.
    const b: BallState = { ...freshBall(), held: false, x: 7.9, y: 1, z: 0, vx: 20, court: VOLLEY_COURT }, out = stepBall('sky-spike', b, 1 / 60);
    expect(out.some(c => c.kind === 'wall')).toBe(true);
    const c: BallState = { ...freshBall(), held: false, x: 7.9, y: 1, z: 0, vx: 20 };
    expect(stepBall('sky-spike', c, 1 / 60).some(k => k.kind === 'wall')).toBe(false);
  });
  it('puts the server behind its own baseline and every spike, serve and tip inside its lines', () => {
    const m = bots();
    expect(m.view.phase).toBe('kickoff');
    const server = m.sim.actors.get(m.view.serverId!)!.state;
    expect(Math.abs(server.z)).toBeCloseTo(VOLLEY_COURT.z + 1.4, 1);
    // (The person's seat played by the bots, so the match runs on.)
    m.pilot('me');
    const seen = new Set<number>();
    let landed = 0, inside = 0;
    for (let i = 0; i < 60 * 150 && m.view.phase !== 'over'; i++) {
      m.step(1 / 60);
      for (const e of m.view.events) if ((e.kind === 'kill' || e.kind === 'ace') && !seen.has(e.id)) { seen.add(e.id); landed++; if (Math.abs(e.x) <= VOLLEY_COURT.x + .3 && Math.abs(e.z) <= VOLLEY_COURT.z + .3) inside++; }
    }
    expect(landed).toBeGreaterThan(3);
    expect(inside).toBe(landed);
  }, 40000);
});

describe('volleyball: the person is the hitter', () => {
  it('is set by the bot setter whenever they can get to a set spot - from across their court too', () => {
    for (const at of [{ x: 0, z: -6 }, { x: -3.5, z: -2.8 }, { x: 3, z: -7 }]) {
      const m = bots();
      const setter = m.volley!.setter.red!, other = botsOf(m, 'red').find(id => id !== setter)!;
      m.sim.place(setter, { x: 1.2, y: 0, z: -1.8 }, 0); m.sim.place('me', { ...at, y: 0 }, 0); m.sim.place(other, { x: -3.5, y: 0, z: -1.6 }, 0);
      rally(m, 'red', 1, { x: 1.2, y: VOLLEY.ideal.set + .5, z: -1.8, vy: -2, lastId: other, lastTeam: 'red' });
      for (let i = 0; i < 90 && !touches(m, setter).length; i++) { send(m, 'me'); m.step(1 / 60); }
      expect(m.volley!.lastSet?.hitter, JSON.stringify(at)).toBe('me');
    }
  });
  it('sets a person\'s own first touch back to them', () => {
    const m = bots();
    const setter = m.volley!.setter.red!;
    m.sim.place(setter, { x: 1, y: 0, z: -1.8 }, 0); m.sim.place('me', { x: 0, y: 0, z: -5 }, 0);
    rally(m, 'red', 0, { x: 0, y: 3, z: -5, vy: -1, lastId: botsOf(m, 'blue')[0], lastTeam: 'blue', shot: 'pop' });
    send(m, 'me', { x: 0, z: 0 }, { attack: 'light' });
    for (let i = 0; i < 200 && !m.volley!.lastSet; i++) { send(m, 'me'); m.step(1 / 60); }
    expect(touches(m, 'me')[0]?.text).toMatch(/^RECEIVE/);
    expect(touches(m, setter).length).toBe(1);
    expect(m.volley!.lastSet?.hitter).toBe('me');
  });
  it('leaves the second touch to a bot while one can get there', () => {
    const m = bots();
    const setter = m.volley!.setter.red!;
    // The person nearer the pass than the setter: still the setter's ball.
    m.sim.place(setter, { x: 2.5, y: 0, z: -2 }, 0); m.sim.place('me', { x: 1.4, y: 0, z: -2 }, 0);
    rally(m, 'red', 1, { x: 1.2, y: 4, z: -2, vy: 2, lastId: botsOf(m, 'red').find(id => id !== setter)!, lastTeam: 'red' });
    for (let i = 0; i < 5; i++) { send(m, 'me'); m.step(1 / 60); }
    expect(m.view.volley!.touch).toBe(2);
    expect(m.view.volley!.owner).toBe(setter);
    // (And the person is not told to SET it: they are its hitter.)
    expect(m.view.volley!.prompt.me).toBeUndefined();
  });
});

describe('volleyball: the walk brings a person to the attack and the block', () => {
  it('walks a stick at rest to the spot at a run and eases in, turns a stick near it onto it, and never goes against one', () => {
    const at = brought({ x: 0, z: 0 }, { x: 0, z: 4 });
    expect(at.helped).toBe(true); expect(Math.hypot(at.x, at.z)).toBeCloseTo(1, 6);
    expect(Math.hypot(brought({ x: 0, z: 0 }, { x: 0, z: .4 }).z, 0)).toBeLessThan(1);
    expect(brought({ x: .8, z: .5 }, { x: 0, z: 4 })).toEqual(walked({ x: .8, z: .5 }, { x: 0, z: 4 }));
    const away = brought({ x: 0, z: -1 }, { x: 0, z: 4 });
    expect(away).toEqual({ x: 0, z: -1, helped: false });
  });
  it('brings a person at rest to the set laid for them, and to the net as the other side\'s set goes up', () => {
    const m = bots();
    const setter = m.volley!.setter.red!;
    m.sim.place(setter, { x: 1.2, y: 0, z: -1.8 }, 0); m.sim.place('me', { x: 2, y: 0, z: -6.5 }, 0);
    rally(m, 'red', 1, { x: 1.2, y: VOLLEY.ideal.set + .5, z: -1.8, vy: -2, lastId: botsOf(m, 'red').find(id => id !== setter)!, lastTeam: 'red' });
    for (let i = 0; i < 90 && !m.volley!.lastSet; i++) { send(m, 'me'); m.step(1 / 60); }
    const set = m.volley!.lastSet!;
    expect(set.hitter).toBe('me');
    for (let i = 0; i < 50; i++) { send(m, 'me'); m.step(1 / 60); }
    const p = m.sim.actors.get('me')!.state;
    expect(Math.hypot(p.x - set.x, p.z - set.z)).toBeLessThan(.6);
    expect(m.view.volley!.prompt.me).toMatch(/JUMP|SPIKE/);
    // Their set up: to the net in front of it, the prompt BLOCK on the way.
    const n = bots(5), their = botsOf(n, 'blue');
    n.sim.place('me', { x: 0, y: 0, z: -6 }, 0);
    rally(n, 'blue', 1, { x: -1.2, y: VOLLEY.ideal.set + .5, z: 1.8, vy: -2, lastId: their[0], lastTeam: 'blue' });
    for (let i = 0; i < 90 && !(n.volley!.lastSet?.team === 'blue'); i++) { send(n, 'me'); n.step(1 / 60); }
    expect(n.volley!.lastSet?.team).toBe('blue');
    for (let i = 0; i < 6; i++) { send(n, 'me'); n.step(1 / 60); }
    expect(n.view.volley!.prompt.me).toBe('BLOCK');
    for (let i = 0; i < 50; i++) { send(n, 'me'); n.step(1 / 60); }
    const q = n.sim.actors.get('me')!.state;
    expect(Math.abs(q.z)).toBeLessThan(VOLLEY.block.net);
  });
});

describe('volleyball: a person\'s block always answers', () => {
  /** Their set held over their net, then their spike; the person at the net goes up `lead` s before it (null: no jump),
   *  with the jump or with PLAY. */
  function block(lead: number | null, play = false, perfect = false) {
    const m = bots(7), hitter = botsOf(m, 'blue')[0];
    for (const id of [...botsOf(m, 'red'), ...botsOf(m, 'blue')]) m.sim.place(id, { x: id === hitter ? 0 : 3, y: 0, z: id === hitter ? 5 : (m.seats.get(id)!.team === 'red' ? -6 : 6) }, 0);
    m.sim.place('me', { x: 0, y: 0, z: -.7 }, 0);
    rally(m, 'blue', 2, { x: 0, y: 7, z: 3, lastId: botsOf(m, 'blue')[1], lastTeam: 'blue', shot: 'set' });
    const t0 = m.now() + .8;
    let spiked = false, jumped = false;
    for (let i = 0; i < 150; i++) {
      const t = m.now() - t0;
      if (!spiked && t >= 0) {
        spiked = true; m.view.touches = 3;
        // (Struck as volleyball's jump strikes it - a raised hand a metre over the band, a stride off the net.)
        Object.assign(m.ball, { held: false, x: 0, y: 3.7, z: 1.2, vx: 0, vy: -5, vz: -22, sx: 0, sy: 0, sz: 0, lastId: hitter, lastTeam: 'blue', shot: 'spike' });
        if (perfect) (m.volley as unknown as { hotSpike: boolean }).hotSpike = true;
      }
      if (!spiked) Object.assign(m.ball, { x: 0, y: 7, z: 3, vx: 0, vy: 0, vz: 0 });
      const go = lead !== null && !jumped && t >= -lead; if (go) jumped = true;
      send(m, 'me', { x: 0, z: 0 }, go ? (play ? { attack: 'light' } : { jump: true, jumpHeld: true }) : jumped ? { jumpHeld: true } : {});
      m.step(1 / 60);
      const e = touches(m, 'me')[0];
      if (e) return e.text ?? '';
      if (spiked && m.ball.z < -2) break;
    }
    return 'none';
  }
  it('meets the spike from anywhere in the jump: a STUFF BLOCK at its top, a soft block or a BLOCK TOUCH lower', () => {
    // (The block's hop - model.ts VOLLEY_JUMP.hop - tops out a third of a second after it leaves.)
    expect(block(.32)).toBe('STUFF BLOCK · PERFECT');
    for (const lead of [.1, .2, .5]) expect(block(lead), `${lead} s`).toMatch(/^(BLOCK · GOOD|BLOCK TOUCH · LATE)$/);
    expect(block(.15, false, true)).toMatch(/BLOCK/);
    expect(block(null)).toBe('none');
  });
  it('is PLAY at the net as they attack: the jump at once, the block it makes', () => {
    expect(block(.32, true)).toMatch(/BLOCK/);
  });
});
