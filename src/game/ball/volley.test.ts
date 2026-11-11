import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BallMatch, TOUCH_RULES } from './BallMatch';
import { BALL_ID, SPIKE_RULES, type BallState, type BallTeam } from './model';
import { VOLLEY, tierOf, volleyballWanted, walked } from './volley';
import { jumpArc } from '../moves';
import { jumpIn } from '../../render/ball/SpikeCues';

// VOLLEYBALL (volley.ts): one PLAY a touch, the walk to the spot, timing for how good a touch is - never
// whether it happens - and the classic match untouched without the option.
const steps = (m: BallMatch, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60); };

/** Two people, one a side, nobody else, the rules on, the serve's walk-up under way. */
function pair(volleyball = true) {
  const m = new BallMatch('sky-spike', { seed: 3, access: 'host', fillBots: false, replays: false, volleyball });
  m.add('red-1', 'taisei', 'Red', false, 'red');
  m.add('blue-1', 'konta', 'Blue', false, 'blue');
  expect(m.start()).toBe(true);
  steps(m, 3.1);
  return m;
}
/** The rally under way on `team`'s side, `touches` spent, the ball put (last touched by a team-mate not in the match). */
function rally(m: BallMatch, team: BallTeam, touches: number, ball: Partial<BallState>) {
  m.view.phase = 'live'; m.view.rally = 1; m.view.touchTeam = team; m.view.touches = touches;
  Object.assign(m.ball, { held: false, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, lastId: `${team}-2`, lastTeam: team, heat: .5, shot: 'bump' }, ball);
}
let seq = 10;
/** A person's frame as their page sends it: the stick, the aim, PLAY or not. */
function send(m: BallMatch, id: string, stick = { x: 0, z: 0 }, play = false, yaw = 0) {
  m.submit(id, { seq: ++seq, moveX: stick.x, moveZ: stick.z, yaw, targetId: BALL_ID, ...(play ? { attack: 'light' as const } : {}) });
}
const touches = (m: BallMatch, id: string) => m.view.events.filter(e => e.kind === 'touch' && e.actorId === id);

describe('volleyball: the switch', () => {
  it('is `?volleyball` in the address, on any host', () => {
    expect(volleyballWanted({ search: '?volleyball' })).toBe(true);
    expect(volleyballWanted({ search: '?ballmoves&volleyball' })).toBe(true);
    expect(volleyballWanted({ search: '?ballmoves' })).toBe(false);
    expect(volleyballWanted(undefined)).toBe(false);
  });
  it('is off without the option: no rules, no view field, the ball as big as ever', () => {
    const m = pair(false);
    expect(m.volley).toBeUndefined();
    expect(m.view.volley).toBeUndefined();
    expect(m.ball.size).toBe(1);
    expect(Object.keys(TOUCH_RULES)).not.toContain('VOLLEY');
  });
  it('is never set by the online room (nothing under src/server names it)', () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
    walk(join(__dirname, '../../server'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toMatch(/volleyball|volley\.ts|Volley\b/);
  });
  it('is on with it: a smaller ball and the page told whose it is', () => {
    const m = pair();
    expect(m.volley).toBeDefined();
    expect(m.ball.size).toBeCloseTo(VOLLEY.size, 6);
    expect(m.view.volley).toBeDefined();
  });
});

describe('volleyball: timing decides how good, not whether', () => {
  it('names the tiers by how far off the best moment a press is', () => {
    expect(tierOf(0)).toBe('PERFECT');
    expect(tierOf(-.06)).toBe('PERFECT');
    expect(tierOf(.05)).toBe('PERFECT');
    expect(tierOf(-.15)).toBe('GOOD');
    expect(tierOf(.09)).toBe('GOOD');
    expect(tierOf(-.3)).toBe('EARLY');
    expect(tierOf(.15)).toBe('LATE');
  });
  it('plays every press near a falling ball, early, on time or late, and tiers it', () => {
    const seen = new Set<string>();
    for (const at of [-.4, -.25, -.12, -.05, 0, .04, .08, .12]) {
      for (const off of [0, .8, 1.6, 2.1]) {
        const m = pair();
        const a = m.sim.actors.get('red-1')!;
        m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
        // A lob coming down beside the body: through the receive's height in 0.6 s.
        const g = SPIKE_RULES.gravity, t = .6, y0 = VOLLEY.ideal.receive + .5 * g * t * t + 1 * t;
        rally(m, 'blue', 3, { x: off, y: y0, z: -6, vy: -1, lastId: 'blue-1', lastTeam: 'blue', shot: 'pop' });
        m.view.touchTeam = 'red'; m.view.touches = 0;
        // (The best moment as the rules have it: the ball down through the receive's height, less the swing.)
        send(m, 'red-1'); m.step(1 / 60);
        const best = m.volley!.plan!.at - VOLLEY.contact;
        let pressed = false;
        for (let i = 0; i < 90 && !touches(m, 'red-1').length; i++) {
          const play = !pressed && m.now() >= best + at - 1e-6;
          if (play) pressed = true;
          send(m, 'red-1', { x: 0, z: 0 }, play);
          m.step(1 / 60);
        }
        const e = touches(m, 'red-1');
        expect(e.length, `pressed ${at} s off, ${off} m off`).toBe(1);
        seen.add(e[0].text!.split(' · ')[1]);
        void a;
      }
    }
    expect([...seen]).toEqual(expect.arrayContaining(['PERFECT', 'GOOD', 'EARLY', 'LATE']));
  });
  it('answers a press with the ball already at its moment in the swing\'s own time (7 ticks)', () => {
    const m = pair();
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    rally(m, 'red', 0, { x: .4, y: .95, z: -6, vy: -.5, lastId: 'blue-1', lastTeam: 'blue' });
    m.ball.grav = .05;
    send(m, 'red-1', { x: 0, z: 0 }, true);
    let ticks = 0;
    for (; ticks < 30 && !touches(m, 'red-1').length; ticks++) { m.step(1 / 60); send(m, 'red-1'); }
    expect(ticks).toBe(Math.ceil(VOLLEY.contact * 60 - 1e-6));
  });
  it('leaves a ball nobody pressed for to the body under it: FLUBBED, still in play', () => {
    const m = pair();
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    rally(m, 'red', 0, { x: .2, y: 3, z: -6, vy: -2, lastId: 'blue-1', lastTeam: 'blue' });
    for (let i = 0; i < 90 && !touches(m, 'red-1').length; i++) { send(m, 'red-1'); m.step(1 / 60); }
    const e = touches(m, 'red-1');
    expect(e).toHaveLength(1);
    expect(e[0].text).toBe('RECEIVE · FLUBBED');
    expect(m.view.phase).toBe('live');
    expect(m.view.touches).toBe(1);
    expect(m.ball.vy).toBeGreaterThan(0);
  });
  it('lets no fighter\'s blow play the ball', () => {
    const m = pair();
    m.sim.place('red-1', { x: 0, y: 0, z: -6 }, 0);
    rally(m, 'red', 0, { x: 0, y: 1.2, z: -5.2, lastId: 'blue-1', lastTeam: 'blue' });
    const blow = { attackerId: 'red-1', slot: 'heavy', move: { name: 'X', duration: .4, contacts: [.1], damage: 1, range: 2, radius: 1, stamina: 0, cooldown: 0, stun: 0, knockback: 1, style: 'melee' }, damage: 1, critical: false, finisher: false, pushX: 0, pushZ: 1, knockback: 1, stun: 0, launch: false, hitstop: 0 };
    expect(m.receive({ id: BALL_ID, x: 0, y: 1.2, z: -5.2, radius: 1, height: 1, airborne: false }, blow as never)).toBeNull();
  });
});

describe('volleyball: the walk', () => {
  it('turns a stick near the spot onto it, eases it in, and never turns one against itself', () => {
    let helped = 0;
    for (let i = 0; i < 4000; i++) {
      const a = (i * 2.399) % (Math.PI * 2), m = (i % 7) / 6, b = (i * 1.13) % (Math.PI * 2), d = .05 + (i % 11) * .4;
      const raw = { x: Math.sin(a) * m, z: Math.cos(a) * m }, to = { x: Math.sin(b) * d, z: Math.cos(b) * d };
      const w = walked(raw, to);
      if (w.helped) helped++;
      if (Math.hypot(raw.x, raw.z) >= VOLLEY.walk.dead) expect(w.x * raw.x + w.z * raw.z).toBeGreaterThan(0);
      else expect(w).toEqual({ x: raw.x, z: raw.z, helped: false });
      expect(Math.hypot(w.x, w.z)).toBeLessThanOrEqual(Math.max(1, Math.hypot(raw.x, raw.z)) + 1e-9);
    }
    expect(helped).toBeGreaterThan(500);
  });
  it('leaves a stick held well off the spot alone', () => {
    expect(walked({ x: 1, z: 0 }, { x: -2, z: 0 })).toEqual({ x: 1, z: 0, helped: false });
    expect(walked({ x: 0, z: 1 }, { x: 3, z: .2 }).helped).toBe(false);
    const w = walked({ x: .9, z: .3 }, { x: 3, z: 0 });
    expect(w.helped).toBe(true);
    expect(w.z).toBeCloseTo(0, 6);
  });
});

describe('volleyball: the sets a person is laid', () => {
  it('gives each kind time to reach the ball and jump: the JUMP cue fires after the set, before the best moment', () => {
    const arc = jumpArc('konta');
    for (const [kind, seconds, stick] of [['high', VOLLEY.set.seconds, { x: -1, z: 0 }], ['back', VOLLEY.set.back, { x: 1, z: 0 }], ['quick', VOLLEY.set.quick, { x: 0, z: 1 }]] as const) {
      const m = new BallMatch('sky-spike', { seed: 3, access: 'host', fillBots: false, replays: false, volleyball: true });
      m.add('red-1', 'taisei', 'Setter', false, 'red'); m.add('red-2', 'konta', 'Hitter', false, 'red'); m.add('blue-1', 'konta', 'Blue', false, 'blue');
      m.start(); steps(m, 3.1);
      m.sim.place('red-1', { x: 1.2, y: 0, z: -1.8 }, 0);
      const spot = kind === 'quick' ? { x: 0, z: -1.3 } : kind === 'back' ? { x: 4.6, z: -1.6 } : { x: -4.6, z: -1.6 };
      m.sim.place('red-2', { x: spot.x, y: 0, z: spot.z - 1 }, 0);
      rally(m, 'red', 1, { x: 1.2, y: VOLLEY.ideal.set + .3, z: -1.8, vy: -2, lastId: 'red-2', lastTeam: 'red' });
      for (let i = 0; i < 60 && !touches(m, 'red-1').length; i++) { send(m, 'red-1', stick, i === 0); send(m, 'red-2'); m.step(1 / 60); }
      const set = m.view.volley && m.volley!.lastSet;
      expect(set?.kind, kind).toBe(kind);
      expect(set?.hitter).toBe('red-2');
      if (kind !== 'quick') expect(set!.best - set!.at).toBeCloseTo(seconds, 6);
      else expect(set!.best - set!.at).toBeGreaterThan(seconds);
      // The cue's moment to leave the floor, from the ball as it left the setter's hands.
      const jump = jumpIn(m.ball, arc);
      expect(jump, kind).toBeGreaterThan(.15);
      expect(jump).toBeLessThan(set!.best - set!.at);
    }
  });
});

describe('volleyball: scoring', () => {
  it('counts every point one, FEVER or not', () => {
    const m = pair();
    m.view.fever = true; m.view.score = { red: 3, blue: 7 };
    rally(m, 'blue', 3, { x: 0, y: .6, z: -6, vy: -8, lastId: 'blue-1', lastTeam: 'blue', shot: 'spike' });
    m.view.touchTeam = 'red'; m.view.touches = 0;
    m.sim.place('red-1', { x: 6, y: 0, z: -1 }, 0);
    for (let i = 0; i < 30 && m.view.phase === 'live'; i++) { send(m, 'red-1'); m.step(1 / 60); }
    expect(m.view.score).toEqual({ red: 3, blue: 8 });
  });
});
