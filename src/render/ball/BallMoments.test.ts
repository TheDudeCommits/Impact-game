import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {BallMoments} from './BallMoments';
import {freshBall} from '../../game/ball/physics';
import type {BallEvent, BallModeId, BallView} from '../../game/ball/model';
import type {FollowCamera} from '../FollowCamera';
import type {GameSnapshot} from '../../game/types';

// The peaks land on the screen (the screen punch), Sky Spike's lens is never shaken,
// a SKY SPIKE struck is no impact frame but the kill it makes is, and a wipe-out prints only for a viewer near it.
const view = (mode: BallModeId, events: BallEvent[]): BallView => ({
  kind: 'ball', mode, phase: 'live', access: 'bots', round: 1, hostId: null, capacity: 6, fillBots: true, startsAt: null, startedAt: 0, endsAt: 240, phaseUntil: 0,
  seats: [], score: {red: 0, blue: 0}, ball: {...freshBall(), held: false}, clock: 200, overtime: false, touchTeam: null, touches: 0, rally: 0, servingTeam: 'red', serverId: null,
  target: 0, fever: false, winner: null, reason: '', mvp: null, events, replay: null, rumble: false, charms: [], effects: [], practice: false, best: 0, aim: null, hits: 0, streak: 0, bestStreak: 0});
const setup = (body = new THREE.Vector3(0, 0, 0)) => {
  const calls: string[] = [], shakes: number[] = [], punches: number[] = [];
  const frame = {impactFrame: () => calls.push('impact'), chromaticPulse: () => calls.push('chroma'), speedLines: () => calls.push('lines'), inkFlash: () => calls.push('ink'), inkKeep: () => {},
    screenPunch: (amount: number) => punches.push(amount)};
  const lens = {impact: (w: number) => shakes.push(w)} as unknown as FollowCamera;
  const moments = new BallMoments(frame, () => [[lens, body]], () => null);
  let id = 0;
  const handle = (mode: BallModeId, events: Partial<BallEvent>[], t = 10) =>
    moments.handle({serverTime: t, players: [], ball: view(mode, events.map(e => ({id: ++id, at: t, kind: 'strike', x: 0, y: 1, z: 0, ...e}) as BallEvent))} as unknown as GameSnapshot);
  return {calls, shakes, punches, handle};
};

describe('the ball moments on the screen', () => {
  it('never shakes Sky Spike\'s lens, and lands its moments on the screen instead', () => {
    const {calls, shakes, punches, handle} = setup();
    handle('sky-spike', [{kind: 'strike', text: 'SKY SPIKE', value: 24}]);
    expect(calls).not.toContain('impact');
    expect(punches).toHaveLength(1);
    handle('sky-spike', [{kind: 'kill', team: 'red', value: 1}, {kind: 'super'}, {kind: 'clash'}, {kind: 'perfect', text: 'STUFF BLOCK'}], 11);
    handle('sky-spike', [], 12);
    expect(shakes).toHaveLength(0);
    expect(calls).toEqual(expect.arrayContaining(['impact', 'ink']));
    expect(punches.length).toBeGreaterThanOrEqual(4);
  });
  it('still shakes Goal Rush\'s lens for a goal, and prints a screamer longer', () => {
    const {shakes, punches, handle} = setup();
    handle('goal-rush', [{kind: 'goal', value: 140}]);
    expect(shakes).toHaveLength(1);
    expect(punches[0]).toBeCloseTo(1, 5);
  });
  it('prints a wipe-out only for a viewer near it', () => {
    const near = setup(new THREE.Vector3(3, 0, 0)), far = setup(new THREE.Vector3(0, 0, 40));
    near.handle('goal-rush', [{kind: 'wipeout', x: 0, y: 1, z: 0}]);
    far.handle('goal-rush', [{kind: 'wipeout', x: 0, y: 1, z: 0}]);
    expect(near.calls).toContain('impact');
    expect(near.punches).toHaveLength(1);
    expect(far.calls).not.toContain('impact');
    expect(far.punches).toHaveLength(0);
  });
  it('punches a power shot but not a pass', () => {
    const {punches, calls, handle} = setup();
    handle('goal-rush', [{kind: 'strike', value: 14}]);
    expect(punches).toHaveLength(0);
    handle('goal-rush', [{kind: 'strike', value: 34}], 11);
    expect(punches).toHaveLength(1);
    expect(calls).not.toContain('impact');
  });
});
