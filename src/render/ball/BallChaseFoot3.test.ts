import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BallChase, type ChaseFrame } from './BallChase';
import { GOAL_RULES } from '../../game/ball/model';

/** Goal Rush's SPORT camera at the walls and in the corners - the glass and the stands
 *  about a fifth of the whole frame there too, the body and the ball kept in it, and the frame never turned by itself
 *  to do it. */
const camera = (aspect = 16 / 9) => new THREE.PerspectiveCamera(64, aspect, .1, 500);
const frame = (o: Partial<ChaseFrame> = {}): ChaseFrame => ({ self: new THREE.Vector3(), heading: 0, ball: new THREE.Vector3(0, .3, 2), fight: false, mode: 'goal-rush', boosting: false, shake: 0, football: true, ...o });
const run = (rig: BallChase, cam: THREE.PerspectiveCamera, f: ChaseFrame, frames: number) => { for (let i = 0; i < frames; i++) rig.aim(cam, 1 / 60, true, f); };
const R = GOAL_RULES;
/** The share of the whole frame (a 24 x 14 grid) that is not the pitch's floor inside its walls or a goal's mouth. */
function stands(cam: THREE.PerspectiveCamera) {
  const v = new THREE.Vector3(), o = cam.position;
  let miss = 0, n = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 14; j++) {
    v.set((i + .5) / 12 - 1, (j + .5) / 7 - 1, .5).unproject(cam).sub(o); n++;
    if (v.y >= -1e-5) { miss++; continue; }
    const t = -o.y / v.y, x = Math.abs(o.x + v.x * t), z = Math.abs(o.z + v.z * t);
    if (!((x <= R.halfX && z <= R.halfZ && x + z <= R.halfX + R.halfZ - R.corner) || (x <= R.goalHalfWidth && z <= R.halfZ + R.goalDepth))) miss++;
  }
  return miss / n;
}
const onScreen = (cam: THREE.PerspectiveCamera, p: THREE.Vector3) => { const v = p.clone().project(cam); return v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 ? v : null; };
const yawOf = (cam: THREE.PerspectiveCamera) => { const d = new THREE.Vector3(); cam.getWorldDirection(d); return Math.atan2(d.x, d.z); };

describe("Goal Rush's SPORT camera: walls and corners", () => {
  const spots: [number, number, number, string][] = [
    [9.5, 14.5, Math.PI / 4, 'running into a corner'],
    [-11.5, 4, 0, 'along a side wall'],
    [0, 16, 0, 'at the end wall, facing it'],
    [9, -16.5, Math.PI, 'into the other corner'],
    [0, 0, 0, 'in the middle'],
  ];
  for (const [x, z, heading, what] of spots) it(`keeps the stands to about a fifth of the frame ${what}, the body and the ball in it`, () => {
    for (const aspect of [16 / 9, 844 / 390]) {
      const rig = new BallChase(), cam = camera(aspect), self = new THREE.Vector3(x, 0, z), ball = new THREE.Vector3(x + Math.sin(heading) * 1.2, .3, z + Math.cos(heading) * 1.2);
      run(rig, cam, frame({ self, heading, ball }), 180);
      // (A phone on its side sees wider: a little more of the side glass.)
      expect(stands(cam)).toBeLessThanOrEqual(aspect > 2 ? .3 : .25);
      expect(onScreen(cam, self)).not.toBeNull();
      expect(onScreen(cam, ball)).not.toBeNull();
    }
  });
  it('keeps a ball run in behind the body - between it and the lens - in frame by tilting down for it', () => {
    for (const aspect of [16 / 9, 844 / 390]) {
      const rig = new BallChase(), cam = camera(aspect), self = new THREE.Vector3(0, 0, 0), f = frame({ self, heading: 0, ball: new THREE.Vector3(0, .3, 2) });
      run(rig, cam, f, 90);
      f.ball = new THREE.Vector3(.5, .3, -3.2);
      run(rig, cam, f, 90);
      expect(onScreen(cam, f.ball as THREE.Vector3)).not.toBeNull();
      expect(onScreen(cam, self)).not.toBeNull();
    }
  });
  it('keeps a ball beside the body in a corner in frame by opening the lens, never turning the frame', () => {
    for (const aspect of [16 / 9, 844 / 390]) {
      const rig = new BallChase(), cam = camera(aspect), self = new THREE.Vector3(10.8, 0, 16), f = frame({ self, heading: Math.PI / 4, ball: new THREE.Vector3(10.8, .3, 17) });
      run(rig, cam, f, 120);
      const yaw = yawOf(cam);
      // (The ball rolled round beside the body, the heading held: the frame's own heading does not move.)
      for (let i = 0; i < 90; i++) { const a = Math.PI / 4 - 1.6 * i / 90; f.ball = new THREE.Vector3(self.x + Math.sin(a) * 2.2, .3, self.z + Math.cos(a) * 2.2); rig.aim(cam, 1 / 60, true, f); }
      expect(Math.abs(Math.atan2(Math.sin(yawOf(cam) - yaw), Math.cos(yawOf(cam) - yaw)))).toBeLessThan(.12);
      expect(onScreen(cam, f.ball as THREE.Vector3)).not.toBeNull();
    }
  });
});
