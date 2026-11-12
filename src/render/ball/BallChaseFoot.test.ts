import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BallChase, type ChaseFrame } from './BallChase';
import { GOAL_RULES } from '../../game/ball/model';
import { SPORT_VFX, VFX, VFX_PROFILES, setVfxLevel, setVfxSport } from '../vfxLevel';

/** Goal Rush's SPORT stance on the sport rules is filmed from higher and further back,
 *  tilted down so the pitch fills the frame - the stands a fifth of it or less - damped, never swung round the body by
 *  the walls, pulled in and up in a corner; and its effects are the SPORT profile's. */
const camera = (aspect = 16 / 9) => new THREE.PerspectiveCamera(64, aspect, .1, 500);
const frame = (o: Partial<ChaseFrame> = {}): ChaseFrame => ({ self: new THREE.Vector3(), heading: 0, ball: new THREE.Vector3(0, .3, 2), fight: false, mode: 'goal-rush', boosting: false, shake: 0, football: true, ...o });
const run = (rig: BallChase, cam: THREE.PerspectiveCamera, f: ChaseFrame, frames: number) => { for (let i = 0; i < frames; i++) rig.aim(cam, 1 / 60, true, f); };
const R = GOAL_RULES;
const pitchOf = (cam: THREE.PerspectiveCamera) => { const d = new THREE.Vector3(); cam.getWorldDirection(d); return Math.atan2(d.y, Math.hypot(d.x, d.z)); };
/** The share of the frame's centre column (bottom up) that is the pitch's floor inside its walls. */
function floorShare(cam: THREE.PerspectiveCamera) {
  const v = new THREE.Vector3(), o = cam.position;
  let floor = 0;
  for (let i = 0; i < 60; i++) {
    v.set(0, -1 + (i + .5) / 30, .5).unproject(cam).sub(o).normalize();
    const tx = Math.abs(v.x) > 1e-6 ? ((v.x > 0 ? R.halfX : -R.halfX) - o.x) / v.x : Infinity, tz = Math.abs(v.z) > 1e-6 ? ((v.z > 0 ? R.halfZ : -R.halfZ) - o.z) / v.z : Infinity;
    if (v.y < 0 && -o.y / v.y < Math.min(tx, tz)) floor++;
  }
  return floor / 60;
}
const onScreen = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => { const v = p.clone().project(cam); return v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 ? v : null; };

describe("Goal Rush's SPORT camera", () => {
  it('stands high behind the body, tilted down: the pitch is four fifths of the frame or more, the body in its lower half', () => {
    for (const [z, heading] of [[-12, 0], [0, 0], [8, 0], [0, Math.PI]] as const) {
      const rig = new BallChase(), cam = camera(), f = frame({ self: new THREE.Vector3(0, 0, z), heading, ball: new THREE.Vector3(0, .3, z + Math.cos(heading) * 2) });
      run(rig, cam, f, 120);
      expect(cam.position.y).toBeGreaterThan(5.5);
      expect(pitchOf(cam)).toBeLessThan(-15 * Math.PI / 180);
      expect(floorShare(cam)).toBeGreaterThanOrEqual(.77);
      const feet = onScreen(cam, f.self);
      expect(feet).not.toBeNull();
      expect(feet!.y).toBeLessThan(0);
      expect(feet!.y).toBeGreaterThan(-.7);
    }
  });
  it('a phone on its side (844 x 390) keeps the pitch, the body and the ball in frame', () => {
    const rig = new BallChase(), cam = camera(844 / 390), f = frame({ self: new THREE.Vector3(3, 0, -4) });
    run(rig, cam, f, 120);
    expect(floorShare(cam)).toBeGreaterThanOrEqual(.75);
    expect(onScreen(cam, f.self)).not.toBeNull();
    expect(onScreen(cam, f.ball as THREE.Vector3)).not.toBeNull();
  });
  it('is damped: a lob over the body and the heading turning never tilt it faster than FOOT.pitchSpeed', () => {
    const rig = new BallChase(), cam = camera(), f = frame();
    run(rig, cam, f, 90);
    let last = pitchOf(cam), worst = 0;
    for (let i = 0; i < 120; i++) {
      const t = i / 60;
      f.ball = new THREE.Vector3(0, Math.max(.3, .3 + 14 * t - 6.5 * t * t), 3 + 8 * t);
      f.heading = Math.sin(t * 2) * .6;
      rig.aim(cam, 1 / 60, true, f);
      const p = pitchOf(cam); worst = Math.max(worst, Math.abs(p - last) * 60); last = p;
    }
    // (The tilt's own cap, with the heading's roll into it on the frame's measure.)
    expect(worst).toBeLessThan(.7);
  });
  it('backed into a corner or against the glass it pulls in and up, inside the walls, never swung round the body', () => {
    for (const [x, z, heading] of [[9.5, -15, -.6], [0, -R.halfZ + 1, 0], [-R.halfX + 1, 0, Math.PI / 2]] as const) {
      const rig = new BallChase(), cam = camera(), f = frame({ self: new THREE.Vector3(x, 0, z), heading, ball: new THREE.Vector3(x + Math.sin(heading) * 2, .3, z + Math.cos(heading) * 2) });
      run(rig, cam, f, 180);
      const p = cam.position;
      expect(Math.abs(p.x)).toBeLessThanOrEqual(R.halfX - .2);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(R.halfZ - .2);
      expect(Math.abs(p.x) + Math.abs(p.z)).toBeLessThanOrEqual(R.halfX + R.halfZ - R.corner + .1);
      expect(p.y).toBeGreaterThan(6);
      // (Still looking along the heading, give or take the turn to the play ahead a moved lens makes.)
      const d = new THREE.Vector3(); cam.getWorldDirection(d);
      expect(Math.abs(Math.atan2(Math.sin(Math.atan2(d.x, d.z) - heading), Math.cos(Math.atan2(d.x, d.z) - heading)))).toBeLessThan(.6);
      expect(onScreen(cam, f.self)).not.toBeNull();
    }
  });
  it('the FIGHT stance and the classic rules keep their own framing', () => {
    const a = new BallChase(), b = new BallChase(), ca = camera(), cb = camera();
    run(a, ca, frame({ football: false }), 90); run(b, cb, frame({ football: true, fight: true }), 90);
    expect(ca.position.y).toBeLessThan(5);
    expect(cb.position.y).toBeLessThan(5);
  });
});

describe("Goal Rush's SPORT effects", () => {
  it('caps every factor at the SPORT profile while on, and gives the level back off', () => {
    setVfxLevel('full'); setVfxSport(true);
    expect(VFX.speedLines).toBe(0);
    expect(VFX.spriteSize).toBe(SPORT_VFX.spriteSize);
    expect(VFX.lettering).toBe('tags');
    setVfxSport(false);
    expect(VFX.speedLines).toBe(VFX_PROFILES.full.speedLines);
    setVfxLevel('minimal'); setVfxSport(true);
    expect(VFX.spriteSize).toBe(Math.min(VFX_PROFILES.minimal.spriteSize, SPORT_VFX.spriteSize));
    setVfxSport(false); setVfxLevel('full');
    expect(VFX.level).toBe('full');
  });
});
