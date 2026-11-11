import * as THREE from 'three';
import type {BallView} from '../../game/ball/model';
import type {SuperCamStyle} from './ballCamChoice';

/** The shot at full scale with the lens riding the ball: an OPTION, off by default (ballCamChoice.ts SUPER SHOT CAMERA,
 *  `?supercam=ride` on this machine). Through a SUPER SHOT's flight the lens rides behind the ball - `back` metres
 *  behind it along its flight on the floor, `up` over it, looking `ahead` metres on down its line - for `most` seconds
 *  at most from the strike, eased in over `in` and handed back over `out` once the flight ends (anybody's touch, a duel,
 *  a goal) or the time is up. It lays itself over whatever the match's own lens did this frame and changes nothing of
 *  it: with the option off it is never asked, and the classic cameras stand bit for bit (camDefaults.test.ts). Not in a
 *  couch split screen, the ceremonies or a replay (main.ts asks only when the match's own lens has the screen), nor
 *  under reduced motion. (First tried 5.2 m back and 1.5 m up: the lens sat in the ball's own trail, which filled the
 *  frame.) */
export const RIDE = {back: 6.8, up: 2.6, ahead: 16, most: 1.4, in: .12, out: .22, slow: 8} as const;

export class SuperRide {
  /** How much of the lens the ride has (0..1), and the flight it rides: the 'super' event's id, and its strike time. */
  weight = 0;
  private flight = -1; private from = 0; private done = true;
  private readonly dir = new THREE.Vector3(1, 0, 0);
  private readonly eye = new THREE.Vector3(); private readonly look = new THREE.Vector3(); private readonly q = new THREE.Quaternion();
  private readonly lens = new THREE.PerspectiveCamera();
  /** After the match's lens is placed (main.ts): `ball` where the page draws it, `now` the presented room time. */
  aim(camera: THREE.PerspectiveCamera, dt: number, view: BallView | undefined, ball: THREE.Vector3 | null | undefined, style: SuperCamStyle, now: number) {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (style !== 'ride' || !view || !ball || reduced) { this.weight = 0; this.done = true; return; }
    // (A new SUPER SHOT struck: its flight is the one ridden.)
    for (let i = view.events.length - 1; i >= 0; i--) {
      const e = view.events[i];
      if (e.kind !== 'super') continue;
      if (e.id !== this.flight && now - e.at < RIDE.most) { this.flight = e.id; this.from = e.at; this.done = false; }
      break;
    }
    const b = view.ball, speed = Math.hypot(b.vx, b.vz);
    const flying = !this.done && b.super && view.phase === 'live' && b.clash <= now && now - this.from < RIDE.most;
    if (!flying) this.done = true;
    if (flying && speed > RIDE.slow) this.dir.set(b.vx / speed, 0, b.vz / speed);
    this.weight = Math.min(1, Math.max(0, this.weight + (flying ? dt / RIDE.in : -dt / RIDE.out)));
    if (this.weight <= 0) return;
    const k = this.weight * this.weight * (3 - 2 * this.weight);
    this.eye.copy(ball).addScaledVector(this.dir, -RIDE.back); this.eye.y = Math.max(.6, ball.y + RIDE.up);
    this.look.copy(ball).addScaledVector(this.dir, RIDE.ahead); this.look.y = Math.max(.4, ball.y * .7);
    this.lens.position.copy(this.eye); this.lens.lookAt(this.look);
    camera.position.lerp(this.eye, k);
    this.q.copy(camera.quaternion).slerp(this.lens.quaternion, k);
    camera.quaternion.copy(this.q);
    camera.updateMatrixWorld();
  }
  reset() { this.weight = 0; this.flight = -1; this.done = true; }
}
