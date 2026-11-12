import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {FOOT_KIT, FOOT_SAND_RED, KIT, TeamTrimmer, VOLLEY_KIT, type TrimBody} from './TeamTrim';
import {BallChase} from './BallChase';
import {BALL_TEAM_COLOURS, type BallSeat, type BallView} from '../../game/ball/model';
import {SELF_MARK} from './footballPage';

/** Football: the bodies' lines thinner and the red side crimson on the sand; the SPORT
 *  camera closer, trucked toward a ball beside you rather than turned; the person's own mark bolder. */
const seat = (id: string, team: 'red' | 'blue', keeper = false) => ({id, team, fighter: 'taisei', name: id, bot: true, ...(keeper ? {keeper: true} : {})}) as unknown as BallSeat;
const match = (seats: BallSeat[], o: Partial<BallView> = {}) => ({kind: 'ball', mode: 'goal-rush', phase: 'live', seats, ...o}) as unknown as BallView;
const body = () => { const b = {ink: new THREE.Color(), rim: new THREE.Color(), widen: -1, setTeamTrim(ink: THREE.Color, rim: THREE.Color, _a: number, _r: number, widen = 0) { b.ink.copy(ink); b.rim.copy(rim); b.widen = widen; }}; return b; };

describe('football: the bodies', () => {
  it("draws football's side lines thin - volleyball's and the rest's as they were", () => {
    const trim = new TeamTrimmer(), a = body(), bodies: Record<string, TrimBody> = {a};
    trim.update(match([seat('a', 'red')], {football: {} as never}), id => bodies[id], null, null, true);
    expect(a.widen).toBe(FOOT_KIT.widen);
    expect(FOOT_KIT.widen).toBeLessThan(KIT.widen / 2);
    trim.update(match([seat('a', 'red')], {mode: 'sky-spike', volley: {} as never}), id => bodies[id], null, null, true);
    expect(a.widen).toBe(VOLLEY_KIT.widen);
  });
  it('draws the red side crimson on the sand only - a darker, cooler line than its own red', () => {
    const trim = new TeamTrimmer(), a = body(), k = body(), bodies: Record<string, TrimBody> = {a, k};
    trim.update(match([seat('a', 'red'), seat('k', 'red', true)], {football: {} as never, arena: 'dust-yard'}), id => bodies[id], null, null, true);
    const sand = a.ink.clone(), keeper = k.ink.clone();
    expect(sand.getHex()).toBe(FOOT_SAND_RED.ink);
    // (Darker than the sand's orange and bluer than the match's red.)
    const own = new THREE.Color(BALL_TEAM_COLOURS.red), hs = {h: 0, s: 0, l: 0}, ho = {h: 0, s: 0, l: 0};
    sand.getHSL(hs); own.getHSL(ho);
    expect(hs.l).toBeLessThan(ho.l);
    expect(hs.h).toBeGreaterThan(.9);
    // (The keeper keeps its own kit; elsewhere the red is the match's own.)
    expect(keeper.getHex()).not.toBe(FOOT_SAND_RED.ink);
    trim.update(match([seat('a', 'red')], {football: {} as never, arena: 'ink-bowl'}), id => bodies[id], null, null, true);
    expect(a.ink.getHex()).not.toBe(FOOT_SAND_RED.ink);
  });
  it("marks the person with one bolder arrow", () => {
    expect(SELF_MARK.w).toBeGreaterThanOrEqual(34); expect(SELF_MARK.h).toBeGreaterThanOrEqual(26);
  });
});

describe('football: the SPORT camera', () => {
  const camera = () => new THREE.PerspectiveCamera(50, 16 / 9, .1, 500);
  const frame = (o: Record<string, unknown> = {}) => ({self: new THREE.Vector3(0, 0, -4), heading: 0, ball: new THREE.Vector3(0, .3, -2.8), fight: false, mode: 'goal-rush', boosting: false, shake: 0, football: true, ...o}) as never;
  const run = (rig: BallChase, cam: THREE.PerspectiveCamera, f: never, n: number) => { for (let i = 0; i < n; i++) rig.aim(cam, 1 / 60, true, f); };
  it('stands close: a body over 135 px tall in a 720 px frame', () => {
    const rig = new BallChase(), cam = camera(), f = frame({mine: true});
    run(rig, cam, f, 240);
    const feet = new THREE.Vector3(0, 0, -4).project(cam), head = new THREE.Vector3(0, 1.8, -4).project(cam);
    // (At 720 px tall: a lens 8 m back and 8 m up drew a 1.8 m body about 110 px tall here.)
    expect(Math.abs(head.y - feet.y) / 2 * 720).toBeGreaterThan(135);
  });
  it('frames a ball beside the body by sliding the lens across toward it, not by turning', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ball: new THREE.Vector3(5.5, .3, -4)});
    run(rig, cam, f, 240);
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    // (Still looking along the heading.)
    expect(Math.abs(Math.atan2(d.x, d.z))).toBeLessThan(.05);
    // (The lens slid toward the ball's side: a +z heading's right is -x, so the ball at +x is on the left, and the lens
    // stands further that way than with the ball at the feet.)
    const still = new BallChase(), c2 = camera(); run(still, c2, frame({ball: new THREE.Vector3(0, .3, -2.8)}), 240);
    expect(cam.position.x).toBeGreaterThan(c2.position.x + 1.5);
    const b = new THREE.Vector3(5.5, .3, -4).project(cam);
    expect(Math.abs(b.x)).toBeLessThan(1);
  });
});
