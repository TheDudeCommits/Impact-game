import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { BALL_ID, BALL_SPORT, SPIKE_RULES, VOLLEY_COURT, VOLLEY_JUMP, ballAssist } from './model';
import { VOLLEY, hopArc, volleyArc } from './volley';
import { jumpArc } from '../moves';

// So the spike is not struck seven metres up against the crowd, as a fighting game's would be: on the volleyball rules
// every jump is volleyball's, with a little anime lift - the spiker's raised hand meets the set a little over the net's
// band, the blocker's hands just over it. Nothing here reaches a classic match.
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };
let seq = 7000;
const send = (m: BallMatch, id: string, extra: Record<string, unknown> = {}) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: BALL_ID, ...extra });
const NET = SPIKE_RULES.netHeight;

/** The highest a body standing at `z` gets off one held jump in a match of these rules (or the classic's). */
function peak(volleyball: boolean, z: number, fighter = 'konta') {
  const m = new BallMatch('sky-spike', { seed: 5, access: 'host', replays: false, volleyball, fillBots: false });
  m.add('me', fighter as 'konta', 'Me', false, 'red'); m.add('them', 'taisei', 'Them', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  m.view.phase = 'live'; m.ball.held = false; m.ball.x = 6; m.ball.z = -7; m.ball.y = .4;
  m.sim.place('me', { x: 0, y: 0, z }, 0);
  steps(m, .3);
  let top = 0;
  send(m, 'me', { jump: true, jumpHeld: true });
  for (let i = 0; i < 90; i++) { send(m, 'me', { jumpHeld: true }); m.step(1 / 60); top = Math.max(top, m.sim.actors.get('me')!.state.y); }
  return top;
}

describe('volleyball\'s jump', () => {
  it('is a volleyball jump with a little lift on the volleyball rules, the fighter\'s own seven metres on the classic\'s', () => {
    const vb = peak(true, -5), cl = peak(false, -5);
    expect(vb).toBeGreaterThan(1.3); expect(vb).toBeLessThan(1.75);
    expect(cl).toBeGreaterThan(5);
    // (Every fighter's within a hand of the roster's middle: a giant a little lower, an acrobat a little higher.)
    for (const f of ['gorai', 'setsu', 'kenzo'] as const) { const a = volleyArc(f); expect(a.apex).toBeGreaterThan(1.3); expect(a.apex).toBeLessThan(1.7); expect(a.rise).toBeGreaterThan(.38); expect(a.rise).toBeLessThan(.5); }
    // The classic's movement is the classic's to the digit; the volleyball rules' carries the jump.
    expect(ballAssist('sky-spike').sport).toBe(BALL_SPORT['sky-spike']);
    expect(ballAssist('sky-spike').sport?.jumpTo).toBeUndefined();
    expect(ballAssist('sky-spike', true).sport?.jumpTo).toBe(VOLLEY_JUMP);
    expect(ballAssist('goal-rush', true).sport).toBe(BALL_SPORT['goal-rush']);
    expect(jumpArc('konta').apex).toBeGreaterThan(5);
  });
  it('is the block\'s hop at the net: the hands just over the band', () => {
    const hop = peak(true, -.7);
    expect(hop).toBeGreaterThan(.6); expect(hop).toBeLessThan(1.05);
    expect(hopArc('konta').apex).toBeCloseTo(VOLLEY_JUMP.hop.apex, 1);
    // (Arms straight up are about 2.3 m over the feet: the hands 0.3-0.6 m over the band at the hop's top.)
    expect(hopArc('konta').apex + 2.3 - NET).toBeGreaterThan(.2); expect(hopArc('konta').apex + 2.3 - NET).toBeLessThan(.7);
  });
  it('lays a set to the raised hand at the top of the jump - about a metre over the band, no more than 1.5', () => {
    const top = volleyArc('konta').apex + VOLLEY.set.reach;
    expect(top - NET).toBeGreaterThan(.5); expect(top - NET).toBeLessThan(1.5);
    expect(VOLLEY.air.hand).toBe(VOLLEY.set.reach);
  });
});

describe('volleyball\'s touches where they are played', () => {
  it('spikes from a little over the band, blocks just over it, over a match of bots', () => {
    const m = new BallMatch('sky-spike', { seed: 11, access: 'bots', replays: false, volleyball: true, difficulty: 'normal' });
    m.add('me', 'konta', 'Me', false, 'red');
    expect(m.start()).toBe(true);
    m.pilot('me');
    const seen = new Set<number>(), spikes: number[] = [], blocks: number[] = [], feet: number[] = [];
    let top = 0;
    for (let i = 0; i < 60 * 150 && m.view.phase !== 'over'; i++) {
      m.step(1 / 60);
      for (const s of m.seats.values()) top = Math.max(top, m.sim.actors.get(s.id)!.state.y);
      for (const e of m.view.events) {
        if (seen.has(e.id) || e.kind !== 'touch') continue;
        seen.add(e.id);
        const label = (e.text ?? '').split(' · ')[0];
        if (label === 'SPIKE') { spikes.push(e.y); feet.push(m.sim.actors.get(e.actorId!)!.state.y); }
        if (e.shot === 'block') blocks.push(e.y);
      }
    }
    expect(spikes.length).toBeGreaterThan(8);
    const med = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    expect(med(spikes) - NET).toBeGreaterThan(.5); expect(med(spikes) - NET).toBeLessThan(1.5);
    expect(Math.max(...spikes) - NET).toBeLessThan(1.9);
    expect(med(feet)).toBeLessThan(1.8);
    expect(top).toBeLessThan(2.2);
    if (blocks.length) expect(med(blocks) - NET).toBeLessThan(1.2);
  }, 40000);
});

describe('a person\'s block touch is no free counterattack', () => {
  it('sends some out, some back over, some down fast into their own court - and lets some spikes slip by', () => {
    const out = {out: 0, back: 0, own: 0, slip: 0, other: 0};
    for (let seed = 1; seed <= 80; seed++) {
      const m = new BallMatch('sky-spike', { seed, access: 'bots', replays: false, volleyball: true, difficulty: 'normal' });
      m.add('me', 'konta', 'Me', false, 'red');
      expect(m.start()).toBe(true);
      steps(m, 3.1);
      const blue = [...m.seats.values()].filter(s => s.team === 'blue').map(s => s.id);
      for (const s of m.seats.values()) if (s.id !== 'me') m.sim.place(s.id, { x: 3, y: 0, z: s.team === 'red' ? -6 : 6 }, 0);
      m.sim.place('me', { x: 0, y: 0, z: -.7 }, 0);
      m.view.phase = 'live'; m.view.rally = 1; m.view.touchTeam = 'blue'; m.view.touches = 2;
      Object.assign(m.ball, { held: false, x: 0, y: 4.2, z: 1.2, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, lastId: blue[1], lastTeam: 'blue', shot: 'set' });
      const seen = new Set(m.view.events.map(e => e.id));
      let kind = '';
      for (let i = 0; i < 200 && !kind; i++) {
        if (i < 30) Object.assign(m.ball, { x: 0, y: 4.2, z: 1.2, vx: 0, vy: 0, vz: 0 });
        if (i === 30) { m.view.touches = 3; Object.assign(m.ball, { x: 0, y: 3.7, z: 1.2, vx: 0, vy: -5, vz: -22, lastId: blue[0], lastTeam: 'blue', shot: 'spike' }); }
        send(m, 'me', i === 25 ? { jump: true, jumpHeld: true } : { jumpHeld: true });
        m.step(1 / 60);
        for (const e of m.view.events) {
          if (seen.has(e.id) || kind) continue; seen.add(e.id);
          if (e.kind === 'touch' && e.actorId === 'me') { if (!/BLOCK TOUCH/.test(e.text ?? '')) kind = 'other'; else kind = 'touched'; }
          else if (e.kind === 'touch' && e.team === 'red' && i > 30) kind = 'slip';
          else if (['kill', 'point', 'out'].includes(e.kind) && i > 30) kind = 'slip';
        }
        if (kind === 'touched') {
          // (Where the touch sends it: on until the next touch or the floor.)
          let next = '';
          for (let k = 0; k < 120 && !next; k++) {
            send(m, 'me'); m.step(1 / 60);
            for (const e of m.view.events) {
              if (seen.has(e.id)) continue; seen.add(e.id);
              if (e.kind === 'out') next = 'out'; else if (e.kind === 'touch') next = e.team === 'blue' ? 'back' : 'own'; else if (e.kind === 'kill' || e.kind === 'point') next = m.ball.z > 0 ? 'back' : 'own';
            }
          }
          kind = next || 'own';
        }
      }
      (out as Record<string, number>)[kind || 'other']++;
    }
    const touches = out.out + out.back + out.own;
    expect(touches, JSON.stringify(out)).toBeGreaterThan(10);
    for (const k of ['out', 'back', 'own', 'slip'] as const) expect(out[k], JSON.stringify(out)).toBeGreaterThan(0);
    expect(out.own / touches, JSON.stringify(out)).toBeLessThan(.75);
  }, 120000);
});
