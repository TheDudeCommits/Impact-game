import * as THREE from 'three';
import type {BallView} from '../../game/ball/model';
import {SPIKE_RULES} from '../../game/ball/model';

/**
 * VOLLEYBALL (game/ball/volley.ts; `?volleyball`): the score bug fades to a ghost while the ball is behind
 * it. From Sky Spike's stable camera the high set and the far side's spike - struck about 6.4 m up, the jump's top -
 * climb under the bug (the highest point in sight over the far wing is 6.0 m at 1280 x 720, 3.8 m on a phone), and
 * neither the lens nor the jump changes. So while the drawn ball overlaps the bug, the page's #interface carries
 * `data-ball-behind` and ballHud.css fades it; it comes back the moment the ball is clear. (The line under it names
 * points only under the flag - a touch's tier is a word over the fighter, touchWord.ts - and is left as it is.)
 * Nothing new is drawn. The bug's box is read a few times a second (a layout read), the ball projected every frame.
 */
const READ_MS = 300, PAD = 6;
export class GhostBug {
  private box = {l: 0, t: 0, r: 0, b: 0, ok: false};
  private readAt = -Infinity; private behind = false;
  private readonly v = new THREE.Vector3();
  /** Whether the ball is behind the bug this frame (for the measures). */
  get on() { return this.behind; }
  update(view: BallView | undefined, ball: THREE.Vector3 | null, camera: THREE.Camera, now: number) {
    const root = typeof document === 'object' ? document.getElementById('interface') : null;
    if (!root) return;
    const want = !!view?.volley && !!ball && view.phase !== 'over' && this.over(ball, camera, now);
    if (want === this.behind) return;
    this.behind = want;
    if (want) root.dataset.ballBehind = '1'; else delete root.dataset.ballBehind;
  }
  private over(ball: THREE.Vector3, camera: THREE.Camera, now: number) {
    if (now - this.readAt > READ_MS) {
      this.readAt = now;
      const els = document.querySelectorAll<HTMLElement>('#interface .bh-board');
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      els.forEach(e => { const q = e.getBoundingClientRect(); if (q.width && q.height) { l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); } });
      this.box = {l, t, r, b, ok: Number.isFinite(l)};
    }
    if (!this.box.ok) return false;
    const W = innerWidth, H = innerHeight, v = this.v.copy(ball).project(camera);
    if (v.z > 1) return false;
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    const top = this.v.copy(ball).setY(ball.y + SPIKE_RULES.ballRadius).project(camera), rad = Math.abs(((1 - top.y) / 2 * H) - y) + PAD;
    const B = this.box;
    return x + rad > B.l && x - rad < B.r && y + rad > B.t && y - rad < B.b;
  }
}
