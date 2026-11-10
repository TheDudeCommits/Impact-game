import { describe, expect, it } from 'vitest';
import { BallMatch, SEEN } from './BallMatch';
import { BALL_ID, GOAL_RULES, SPIKE_RULES } from './model';
import { MOVES, jumpArc } from '../moves';
import type { PlayerInput } from '../types';

/** The ball modes' timing skills online (the room's own clock against what each page drew). */
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
const ack = (m: BallMatch, id: string) => m.sim.playerStates().find(p => p.id === id)?.ackSeq;

describe('online ball rooms: commands held back are still heard', () => {
  it('acknowledges every command through the countdown, a kickoff and a replay, playing none of them', () => {
    // (A page online stops sending at forty unacknowledged commands: main.ts MAX_IN_FLIGHT. The countdown's three seconds
    // are 180 of them.)
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    m.add('red-1', 'gorai', 'Red', false, 'red');
    m.add('blue-1', 'konta', 'Blue', false, 'blue');
    expect(m.start()).toBe(true);
    expect(m.view.phase).toBe('countdown');
    const at = m.sim.actors.get('red-1')!.state, from = {x: at.x, z: at.z};
    let seq = 0;
    for (let i = 0; i < 90; i++) { expect(m.submit('red-1', { seq: ++seq, moveX: 1, moveZ: 1, yaw: 0, dash: true })).toBe(false); m.step(1 / 60); }
    expect(ack(m, 'red-1')).toBe(seq);
    // (Not played: the body held its mark.)
    const held = m.sim.actors.get('red-1')!.state;
    expect(Math.hypot(held.x - from.x, held.z - from.z)).toBeLessThan(.01);
    expect(until(m, () => m.view.phase === 'kickoff')).toBe(true);
    expect(m.submit('red-1', { seq: ++seq, moveX: 1, moveZ: 0, yaw: 0 })).toBe(false);
    expect(ack(m, 'red-1')).toBe(seq);
    expect(until(m, () => m.view.phase === 'live')).toBe(true);
    expect(m.submit('red-1', { seq: ++seq, moveX: 1, moveZ: 0, yaw: 0 })).toBe(true);
    expect(ack(m, 'red-1')).toBe(seq);
    // An old command is still refused, and acknowledges nothing it should not.
    expect(m.submit('red-1', { seq: seq - 5, moveX: 1, moveZ: 0, yaw: 0 })).toBe(false);
    expect(ack(m, 'red-1')).toBe(seq);
  });
});

/** What a page `lag` seconds behind the room draws: the room's ball as it stood then (every tick kept). */
function page(m: BallMatch) {
  const kept: {t: number; x: number; y: number; z: number; vx: number; vy: number; vz: number}[] = [];
  return {
    keep() { const b = m.ball; kept.push({t: m.sim.serverTime, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz}); },
    drawn(lag: number) { const t = m.sim.serverTime - lag; let i = kept.length - 1; while (i > 0 && kept[i].t > t + 1e-6) i--; return kept[i]; },
  };
}
const SEQ = { n: 1000 };
const send = (m: BallMatch, id: string, lag: number, more: Partial<PlayerInput> = {}) => m.submit(id, { seq: ++SEQ.n, moveX: 0, moveZ: 0, yaw: 0, view: m.sim.serverTime - lag, targetId: BALL_ID, ...more });

/** Goal Rush: a team-mate's pass rolled at red-1 (Gorai, standing at z -6, facing the far goal) at 12 m/s, red-1's page
 *  drawing it `lag` s behind the room; the heavy pressed as the bots time it, on the ball the page draws. */
function strikeOnline(lag: number, compensate: boolean) {
  const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
  m.add('red-1', 'gorai', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  if (compensate) { m.compensate = SEEN.most; m.sim.rewind = SEEN.most; }
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  m.sim.place('blue-1', { x: 10, y: 0, z: 14 }, 0);
  m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
  for (let i = 0; i < 30; i++) { send(m, 'red-1', lag); m.step(1 / 60); }
  Object.assign(m.ball, { x: 0, y: GOAL_RULES.ballRadius, z: 10, vx: 0, vy: 0, vz: -12, heat: 0, lastId: 'red-1', lastTeam: 'red' });
  const view = page(m), heavy = MOVES.gorai.heavy, lands = heavy.contacts[0], lunge = .6 * Math.min(3, (heavy.lunge ?? 3.2) * (lands - (heavy.lungeDelay ?? 0)));
  let pressed = false;
  for (let i = 0; i < 160; i++) {
    view.keep();
    const p = m.sim.actors.get('red-1')!.state, b = view.drawn(lag), d = Math.hypot(b.x - p.x, b.y - (p.y + 1), b.z - p.z), closing = -b.vz;
    const press = !pressed && (d - 2.3 - lunge) / Math.max(1, closing) <= lands;
    if (press) pressed = true;
    send(m, 'red-1', lag, press ? { attack: 'heavy' } : {});
    m.step(1 / 60);
  }
  return m.view.events.filter(e => e.kind === 'strike' && e.actorId === 'red-1');
}

describe('online ball rooms: the timing skills judged as the page drew them (SEEN)', () => {
  it('a PERFECT STRIKE timed on a page a quarter second behind the room is perfect, as on this device', () => {
    expect(strikeOnline(0, false)[0]?.perfect).toBe(true);
    for (const lag of [.1, .2, .28]) {
      // Judged against the room's own present, the ball is on the body before the swing lands.
      expect(strikeOnline(lag, false)[0]?.perfect).toBeUndefined();
      const online = strikeOnline(lag, true);
      expect(online.length).toBe(1);
      expect(online[0].perfect).toBe(true);
    }
  });
  it('bounds the lag a page may claim: at most SEEN.most, never from a view older than one already heard, a jump held to its steady value', () => {
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    m.add('red-1', 'gorai', 'Red', false, 'red');
    m.add('blue-1', 'konta', 'Blue', false, 'blue');
    m.compensate = SEEN.most;
    m.start();
    until(m, () => m.view.phase === 'live');
    for (let i = 0; i < 120; i++) { send(m, 'red-1', .1); m.step(1 / 60); }
    expect(m.lagOf('red-1')).toBeCloseTo(.1, 2);
    // A page that claims a second's lag on one press: held to the steady value and a little over.
    send(m, 'red-1', 1);
    expect(m.lagOf('red-1')).toBeLessThanOrEqual(.1 + SEEN.over + .02);
    // Views never run backwards: a view older than the last only ages it at the clock's pace.
    for (let i = 0; i < 600; i++) { send(m, 'red-1', 5); m.step(1 / 60); }
    expect(m.lagOf('red-1')).toBeLessThanOrEqual(SEEN.most);
    // A bot, and a match with compensation off, have none.
    const off = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    off.add('red-1', 'gorai', 'Red', false, 'red');
    off.add('blue-1', 'konta', 'Blue', false, 'blue');
    off.start();
    send(off, 'red-1', .2);
    expect(off.lagOf('red-1')).toBe(0);
  });
  it('a STUFF BLOCK timed on a page a quarter second behind is a STUFF BLOCK: the spike put back where the page drew it', () => {
    const block = (lag: number, compensate: boolean) => {
      const m = new BallMatch('sky-spike', { seed: 7, access: 'host', fillBots: false, practice: true });
      m.add('red-1', 'taisei', 'Red', false, 'red');
      if (compensate) { m.compensate = SEEN.most; m.sim.rewind = SEEN.most; }
      m.start();
      expect(until(m, () => m.view.phase === 'live' || m.view.phase === 'kickoff')).toBe(true);
      for (let i = 0; i < 60; i++) { send(m, 'red-1', lag); m.step(1 / 60); }
      // The other side's set rising to the net from its own court, and its hitter's spike at the top, straight through
      // red-1's hands at the net (as the STUFF BLOCK drill's machine sets and spikes).
      const g = SPIKE_RULES.gravity, from = { x: .4, y: 1.8, z: 4.5 }, k = 1 + SPIKE_RULES.drag * .5;
      m.feed({ ball: { ...from, vx: -.4 * k, vy: 4.5 - 1.8 + .5 * g, vz: (1.3 - 4.5) * k, shot: 'set' }, team: 'blue', touchTeam: 'blue', touches: 2, at: { x: 0, z: -1.15, yaw: 0 } });
      const view = page(m), fed = m.sim.serverTime;
      let apexAt = -1, jumped = false, guarded = false, spiked = false;
      for (let i = 0; i < 150; i++) {
        view.keep();
        const now = m.sim.serverTime, b = view.drawn(lag), was = view.drawn(lag + 1 / 60);
        if (apexAt < 0 && b.z > 0 && b.y > 3 && b.y <= was.y) apexAt = now;
        const jump = apexAt >= 0 && !jumped && now - apexAt >= .19, guard = apexAt >= 0 && now - apexAt >= .24 && now - apexAt < .74;
        if (jump) jumped = true;
        if (guard) guarded = true;
        send(m, 'red-1', lag, { jump, jumpHeld: jumped && now - apexAt < .9, guard });
        if (!spiked && now - fed >= .95) {
          spiked = true;
          const ball = m.ball, dx = -ball.x, dy = 3.4 - ball.y, dz = -1.15 - ball.z, d = Math.hypot(dx, dy, dz);
          Object.assign(ball, { vx: dx / d * 19, vy: dy / d * 19 + g * (d / 19) * .5, vz: dz / d * 19, shot: 'spike', heat: 1.5 });
          m.view.touchTeam = 'blue'; m.view.touches = 3;
        }
        m.step(1 / 60);
      }
      expect(guarded).toBe(true);
      return m.view.events.filter(e => (e.kind === 'perfect' || e.kind === 'block') && e.actorId === 'red-1').map(e => e.text);
    };
    expect(block(0, false)[0]).toBe('STUFF BLOCK');
    // Judged against the room's present, a block timed on a page a fifth of a second or more behind meets nothing: the
    // spike is past the hands (and down) before the jump and the guard go up.
    for (const lag of [.2, .25, .3]) expect(block(lag, false)).toEqual([]);
    for (const lag of [.15, .2, .25, .3]) expect(block(lag, true)).toEqual(['STUFF BLOCK']);
  });
  it('a JUMP SERVE swung as the APEX cue flares (92% of the top, still rising) is a PERFECT SERVE: struck from where the swing left', () => {
    const m = new BallMatch('sky-spike', { seed: 7, access: 'host', fillBots: false, practice: true });
    m.add('red-1', 'taisei', 'Red', false, 'red');
    m.start();
    expect(until(m, () => m.view.phase === 'live' || m.view.phase === 'kickoff')).toBe(true);
    // The person's own serve (FREE PLAY's machine told to stand on their side), the person beside the hanging ball.
    (m as unknown as {machine: () => string}).machine = () => 'red';
    m.serveNow(); m.view.phaseUntil = m.sim.serverTime + 6;
    const b = m.ball, apex = jumpArc('taisei').apex;
    m.sim.place('red-1', { x: b.x - .6, y: 0, z: b.z - .9 }, 0);
    let jumped = false, swung = false;
    for (let i = 0; i < 120 && !swung; i++) {
      const p = m.sim.actors.get('red-1')!.state, rising = !p.grounded && (m as unknown as {last: Map<string, {vy: number}>}).last.get('red-1')!.vy > 0;
      const swing = jumped && rising && p.y / apex >= .92;
      send(m, 'red-1', 0, { jump: !jumped, jumpHeld: true, attack: swing ? 'heavy' : undefined });
      jumped = true; swung = swing;
      m.step(1 / 60);
    }
    for (let i = 0; i < 60; i++) { send(m, 'red-1', 0, { jumpHeld: true }); m.step(1 / 60); }
    expect(m.view.events.find(e => e.kind === 'strike' && e.actorId === 'red-1')?.text).toBe('PERFECT SERVE');
  });
});
