import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SpikeCues, SPIKE_TIMING, jumpIn, untilDown, type SpikeCueTick } from './SpikeCues';
import { freshBall } from '../../game/ball/physics';
import { SPIKE_RULES, type BallView } from '../../game/ball/model';
import { SPIKE_SET } from '../../game/ball/strike';
import { jumpArc } from '../../game/moves';
import type { PlayerState } from '../../game/types';

const view = (o: Partial<BallView> = {}): BallView => ({
  kind: 'ball', mode: 'sky-spike', phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 0, phaseUntil: 0,
  seats: [
    { id: 'me', name: 'Me', fighter: 'taisei', team: 'red', bot: false, goals: 0, assists: 0, saves: 0, shots: 0, touches: 0, kills: 0, aces: 0, blocks: 0, digs: 0, points: 0 },
    { id: 'foe', name: 'Foe', fighter: 'konta', team: 'blue', bot: true, goals: 0, assists: 0, saves: 0, shots: 0, touches: 0, kills: 0, aces: 0, blocks: 0, digs: 0, points: 0 },
  ],
  score: { red: 0, blue: 0 }, ball: { ...freshBall(), held: false }, clock: 0, overtime: false, touchTeam: 'red', touches: 2, rally: 1, servingTeam: 'red', serverId: null,
  target: 11, fever: false, winner: null, reason: '', mvp: null, events: [], replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0, ...o });
const player = (id: string, fighter: 'taisei' | 'konta') => ({ id, fighter, grounded: true }) as unknown as PlayerState;

describe("Sky Spike's timing cues", () => {
  it('times the jump to meet a floating set at the top of the jump, and a low ball on the way up', () => {
    const arc = jumpArc('taisei'), g = SPIKE_RULES.gravity;
    // A floating set leaving the setter's hands for about 7 m: the jump goes the rise plus the swing's wind-up before it
    // comes through the hitting height (the jump's top and a reach) - while the set is still climbing.
    const vy = Math.sqrt(2 * g * 5.5), t = jumpIn({ y: 1.5, vy }, arc), down = untilDown(1.5, vy, arc.apex + SPIKE_TIMING.reach, g);
    expect(t).toBeCloseTo(down - (arc.rise - SPIKE_TIMING.swing + SPIKE_TIMING.contact), 6);
    expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(vy / g + .1);
    // A QUICK SET that never climbs that high: a breath before it comes through the low hitting height.
    expect(jumpIn({ y: 4.6, vy: .5 }, arc)).toBeCloseTo(untilDown(4.6, .5, SPIKE_TIMING.low, g) - SPIKE_TIMING.lowLead, 6);
    expect(Number.isNaN(untilDown(3, 0, 6, g))).toBe(true);
    expect(SPIKE_SET.height).toBeGreaterThan(SPIKE_TIMING.low);
  });

  it('ticks the jump on your side\'s set, then flares the glint as you cross into the PERFECT window near the ball', () => {
    const cues = new SpikeCues(new THREE.Scene()), ticks: SpikeCueTick[] = [];
    cues.onTick = k => ticks.push(k);
    const arc = jumpArc('taisei'), me = new THREE.Vector3(0, 0, -2.2), players = [player('me', 'taisei'), player('foe', 'konta')];
    const at = (id: string) => id === 'me' ? me : new THREE.Vector3(0, 0, 4);
    // The set leaving the setter's hands and climbing to about 7 m at the net over you, two touches spent: the jump's beat
    // lands once, as the ring closes - and none again as the ball comes on down.
    const g = SPIKE_RULES.gravity, vy0 = Math.sqrt(2 * g * 5.5);
    const b = { ...freshBall(), held: false, x: 0, y: 1.5, z: -1.8, vy: vy0, shot: 'set' as const, lastTeam: 'red' as const, lastId: 'mate' };
    const v = view({ ball: b });
    let jumped = NaN, shown = 0;
    for (let i = 0; i < 150; i++) {
      const t = i / 60;
      b.y = 1.5 + vy0 * t - .5 * g * t * t; b.vy = vy0 - g * t;
      if (b.y < .5) break;
      cues.update(1 / 60, v, 'me', players, at, new THREE.Vector3(b.x, b.y, b.z), true);
      shown = Math.max(shown, cues.count);
      if (ticks.includes('jump') && Number.isNaN(jumped)) jumped = t;
    }
    expect(ticks).toEqual(['jump']);
    expect(Math.abs(jumped - jumpIn({ y: 1.5, vy: vy0 }, arc))).toBeLessThan(.05);
    expect(shown).toBeGreaterThan(0);
    // Up in the jump, the ball above at the net: no glint on the way up, one as the body crosses 92% of the top.
    const ball = new THREE.Vector3(0, arc.apex + 1.6, -1.6);
    for (const share of [.3, .6, .85, .9]) { me.y = arc.apex * share; cues.update(1 / 60, v, 'me', players, at, ball, true); expect(cues.state.window).toBe(false); }
    me.y = arc.apex * .95; cues.update(1 / 60, v, 'me', players, at, ball, true);
    expect(cues.state.window).toBe(true);
    expect(ticks).toEqual(['jump', 'apex']);
    // Held in the window: no second tick.
    me.y = arc.apex; cues.update(1 / 60, v, 'me', players, at, ball, true);
    expect(ticks).toEqual(['jump', 'apex']);
  });

  it('flares the other side\'s hitter at the top in their colour, with the block\'s tick for you at the net', () => {
    const cues = new SpikeCues(new THREE.Scene()), ticks: SpikeCueTick[] = [];
    cues.onTick = k => ticks.push(k);
    const arc = jumpArc('konta'), foe = new THREE.Vector3(.5, 0, 2), me = new THREE.Vector3(.3, 0, -1);
    const at = (id: string) => id === 'me' ? me : foe, players = [player('me', 'taisei'), player('foe', 'konta')];
    const v = view({ touchTeam: 'blue', touches: 2, ball: { ...freshBall(), held: false, x: .5, y: 6, z: 1.6, shot: 'set', lastTeam: 'blue' } });
    const ball = new THREE.Vector3(.5, arc.apex + 1.5, 1.6);
    foe.y = arc.apex * .5; cues.update(1 / 60, v, 'me', players, at, ball, true);
    expect(ticks).toEqual([]);
    foe.y = arc.apex * .97; cues.update(1 / 60, v, 'me', players, at, ball, true);
    expect(ticks).toEqual(['block']);
    expect(cues.count).toBeGreaterThan(0);
  });

  it('points a dive at a hard ball passing beyond your reach but inside a dive\'s, and nothing at one straight at you', () => {
    const dive = (off: number) => {
      const cues = new SpikeCues(new THREE.Scene()), ticks: SpikeCueTick[] = [];
      cues.onTick = k => ticks.push(k);
      const me = new THREE.Vector3(off, 0, -6), players = [player('me', 'taisei'), player('foe', 'konta')];
      const v = view({ touchTeam: 'red', touches: 0, ball: { ...freshBall(), held: false, x: 0, y: 2.2, z: -2, vx: 0, vy: -3, vz: -20, shot: 'spike', lastTeam: 'blue', lastId: 'foe' } });
      cues.update(1 / 60, v, 'me', players, id => id === 'me' ? me : new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 2.2, -2), true);
      return { ticks, dive: cues.state.dive };
    };
    expect(dive(1.3)).toEqual({ ticks: ['dive'], dive: true });
    expect(dive(0)).toEqual({ ticks: [], dive: false });
    expect(dive(4)).toEqual({ ticks: [], dive: false });
  });

  it('shows nothing outside Sky Spike, behind a replay, or between points', () => {
    const cues = new SpikeCues(new THREE.Scene());
    const me = new THREE.Vector3(0, 4, -2), at = () => me, players = [player('me', 'taisei')], ball = new THREE.Vector3(0, 6, -1.6);
    for (const [v, show] of [[view({ mode: 'goal-rush' }), true], [view(), false], [view({ phase: 'scored' }), true]] as const) {
      cues.update(1 / 60, v, 'me', players, at, ball, show);
      expect(cues.count).toBe(0);
    }
  });
});
