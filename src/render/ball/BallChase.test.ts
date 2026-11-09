import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BallChase, type ChaseFrame } from './BallChase';
import { GOAL_RULES } from '../../game/ball/model';

/** Goal Rush's ball cam rig: behind you along the heading, sprung, tilted after high balls, inside the walls,
 *  closer and lower on the opponent locked in the FIGHT stance. */
const camera = () => new THREE.PerspectiveCamera(64, 16 / 9, .1, 500);
const frame = (o: Partial<ChaseFrame> = {}): ChaseFrame => ({ self: new THREE.Vector3(), heading: 0, ball: new THREE.Vector3(0, .8, 10), fight: false, mode: 'goal-rush', boosting: false, shake: 0, ...o });
const run = (rig: BallChase, cam: THREE.PerspectiveCamera, f: ChaseFrame, frames: number, on = true) => { for (let i = 0; i < frames; i++) rig.aim(cam, 1 / 60, on, f); };
const look = (cam: THREE.PerspectiveCamera) => { const d = new THREE.Vector3(); cam.getWorldDirection(d); return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
/** Whether a point is inside the lens's frame (with a margin, as a share of the half-frame). */
function seen(cam: THREE.PerspectiveCamera, p: THREE.Vector3, margin = .95) {
  const v = p.clone().project(cam);
  return v.z < 1 && Math.abs(v.x) < margin && Math.abs(v.y) < margin;
}
const R = GOAL_RULES;
const inside = (p: THREE.Vector3) => (Math.abs(p.z) <= R.halfZ - .5 || (Math.abs(p.x) < R.goalHalfWidth && p.y < R.goalHeight)) && Math.abs(p.x) <= R.halfX - .5
  && Math.abs(p.x) + Math.abs(p.z) <= R.halfX + R.halfZ - R.corner;

describe("Goal Rush's ball cam rig", () => {
  it('stands behind you along the heading, a little over the shoulder, and looks along it with you and the ball in frame', () => {
    const rig = new BallChase(), cam = camera(), f = frame();
    run(rig, cam, f, 90);
    expect(rig.active).toBe(true);
    expect(cam.position.z).toBeLessThan(-4.5);
    expect(cam.position.y).toBeGreaterThan(2.5);
    expect(Math.abs(look(cam).yaw)).toBeLessThan(.12);
    expect(look(cam).pitch).toBeLessThan(0);
    expect(seen(cam, new THREE.Vector3(0, 1.1, 0))).toBe(true);
    expect(seen(cam, f.ball as THREE.Vector3)).toBe(true);
    expect(rig.yaw).toBeCloseTo(look(cam).yaw, 1);
  });
  it('never jumps: a heading that turns, a body that runs at the boost, each moves the lens smoothly', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ self: new THREE.Vector3(0, 0, 3), heading: Math.PI / 2, ball: new THREE.Vector3(10, .8, 3) });
    run(rig, cam, f, 60);
    let last = cam.position.clone(), worst = 0;
    // Round a ring of 9 m at the boost's speed, the heading turning after the ball ahead.
    for (let i = 0; i < 240; i++) {
      const a = i * 13.5 / 60 / 9;
      f.self.set(Math.sin(a) * 9, 0, Math.cos(a) * 9 - 6); f.heading = a + Math.PI / 2;
      (f.ball as THREE.Vector3).set(f.self.x + Math.sin(f.heading) * 10, .8, f.self.z + Math.cos(f.heading) * 10);
      rig.aim(cam, 1 / 60, true, f);
      worst = Math.max(worst, cam.position.distanceTo(last) - 13.5 / 60); last = cam.position.clone();
    }
    expect(worst).toBeLessThan(.45);
  });
  it('tilts up after a high ball, keeping your chest in the frame', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ ball: new THREE.Vector3(0, 1, 12) });
    run(rig, cam, f, 60);
    const flat = look(cam).pitch;
    (f.ball as THREE.Vector3).set(0, 14, 9);
    run(rig, cam, f, 90);
    expect(look(cam).pitch).toBeGreaterThan(flat + .2);
    expect(seen(cam, f.ball as THREE.Vector3)).toBe(true);
    expect(seen(cam, new THREE.Vector3(0, 1.15, 0), 1)).toBe(true);
  });
  it('keeps inside the walls wherever you stand and whichever way you face, and lets a keeper be filmed from the goal mouth, under the bar', () => {
    const rig = new BallChase(), cam = camera();
    for (const [x, z] of [[0, R.halfZ - .6], [R.halfX - .5, 0], [R.halfX - 1, R.halfZ - 4.5], [-R.halfX + .8, -R.halfZ + 5], [6, -R.halfZ + .5], [0, 0]])
      for (let k = 0; k < 8; k++) {
        const f = frame({ self: new THREE.Vector3(x, 0, z), heading: k * Math.PI / 4 });
        f.ball = new THREE.Vector3(x + Math.sin(f.heading) * 8, .8, z + Math.cos(f.heading) * 8);
        rig.cut(); run(rig, cam, f, 120);
        expect(Number.isFinite(cam.position.x + cam.position.y + cam.position.z)).toBe(true);
        expect(inside(cam.position), `at ${x},${z} facing ${k}: ${cam.position.toArray().map(n => n.toFixed(2))}`).toBe(true);
        // Never on top of you: there is a boom's worth of room between you and the lens along the floor.
        expect(Math.hypot(cam.position.x - x, cam.position.z - z), `at ${x},${z} facing ${k}`).toBeGreaterThan(2.4);
      }
    // A keeper on their own line, facing up the pitch: the lens in the goal's mouth behind them, under the bar.
    const f = frame({ self: new THREE.Vector3(0, 0, -R.halfZ + 1.2), heading: 0, ball: new THREE.Vector3(0, .8, -10) });
    rig.cut(); run(rig, cam, f, 120);
    expect(cam.position.z).toBeLessThan(-R.halfZ + .2);
    expect(cam.position.y).toBeLessThan(R.goalHeight);
    expect(Math.abs(look(cam).yaw)).toBeLessThan(.2);
  });
  it('never flips in and out of the goal mouth as a keeper steps along the line', () => {
    // (From a stride and a half outside one post to as far outside the other: the goal's width, whatever the pitch.)
    const out = R.goalHalfWidth + 1.4;
    const rig = new BallChase(), cam = camera(), f = frame({ self: new THREE.Vector3(-out, 0, -R.halfZ + 1.4), heading: 0, ball: new THREE.Vector3(0, .8, -8) });
    run(rig, cam, f, 60);
    let last = cam.position.clone(), worst = 0;
    for (let i = 0; i < 360; i++) {
      f.self.x = -out + 2 * out * i / 360; f.heading = Math.sin(i / 40) * .3;
      rig.aim(cam, 1 / 60, true, f);
      worst = Math.max(worst, cam.position.distanceTo(last)); last = cam.position.clone();
    }
    expect(worst).toBeLessThan(.25);
  });
  it('frames the FIGHT stance closer, lower and narrower than the ball', () => {
    const ball = new BallChase(), fight = new BallChase(), a = camera(), b = camera();
    run(ball, a, frame(), 120);
    run(fight, b, frame({ fight: true, ball: new THREE.Vector3(0, 0, 4) }), 120);
    expect(b.position.distanceTo(new THREE.Vector3())).toBeLessThan(a.position.distanceTo(new THREE.Vector3()));
    expect(b.position.y).toBeLessThan(a.position.y);
    expect(b.fov).toBeLessThan(a.fov);
    expect(seen(b, new THREE.Vector3(0, 1.5, 4))).toBe(true);
  });
  it('hands the view over with a blend, never a cut, when it lets go and takes it back', () => {
    const rig = new BallChase(), cam = camera(), f = frame();
    run(rig, cam, f, 60);
    const held = cam.position.clone();
    // Letting go: the follow camera's frame (here, somewhere else) is eased into.
    cam.position.set(20, 9, 20); rig.aim(cam, 1 / 60, false, f);
    expect(cam.position.distanceTo(held)).toBeLessThan(2);
    for (let i = 0; i < 40; i++) { cam.position.set(20, 9, 20); rig.aim(cam, 1 / 60, false, f); }
    expect(cam.position.distanceTo(new THREE.Vector3(20, 9, 20))).toBeLessThan(.01);
  });
  it('punches the lens a touch and shakes it on a moment, then settles back', () => {
    const rig = new BallChase(), cam = camera(), f = frame({ shake: 1 });
    run(rig, cam, f, 60);
    const fov = cam.fov;
    rig.impact(.8, undefined, 2); rig.aim(cam, 1 / 60, true, f);
    expect(cam.fov).toBeLessThan(fov - 1);
    run(rig, cam, f, 90);
    expect(cam.fov).toBeCloseTo(fov, 1);
  });
});
