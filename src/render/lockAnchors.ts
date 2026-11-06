import * as THREE from 'three';
import { drawnBulk } from './CameraDirector';
import type { FighterId } from '../game/types';

/**
 * Round 4 (LOCKON): where the lock-on reticle goes on screen.
 *
 * The old reticle was a fixed 58x78 px box floating 74 px over the crown,
 * framing empty background. The new one hugs the body: four brackets on the
 * box the target's joints project to - crown to soles, shoulder to shoulder -
 * and a pin over the crown. This file measures that box once a frame, with no
 * allocations, and holds the pure box arithmetic the view and the tests share.
 *
 * The joints are read the way FollowCamera reads them (`measure`, `aboveHead`):
 * the head joint plus HEAD_PAD for the crown, the feet less SOLE_PAD for the
 * soles, the shown body's joints (a form's while one stands in for the
 * fighter), and a body without joints - or whose model is hidden - spans its
 * root to CROWN over it. The constants are FollowCamera's, repeated so the HUD
 * does not import the camera: keep them in step.
 */
const HEAD_PAD = .24, SOLE_PAD = .06, CROWN = 1.95;
/** The joints that make the box. Shoulders and the tops of the arms give the
 *  width; hands and forearms are left out, so a punch does not stretch it. */
const BOX_JOINTS = ['Head', 'Hips', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'] as const;
/** A non-fighter (a horde enemy, a grunt) stands this many metres tall per
 *  unit of `size`, with its reported centre this far up it. */
const ENEMY_HEIGHT = 1.8, ENEMY_CENTRE = .55;

/** What the measurement reads off a drawn fighter. `Fighter` satisfies it. */
export interface LockBody {
  readonly group: THREE.Object3D;
  readonly model?: { visible: boolean };
  readonly joints?: ReadonlyMap<string, THREE.Object3D>;
  /** The body drawn now: a replacement form's while one stands in. */
  readonly shownBody?: LockBody;
  readonly state: { fighter: FighterId; awakened?: boolean; alive?: boolean };
}

/** One frame's measurement, in CSS pixels. Reused: `lockFrame()` once. */
export interface LockFrame {
  /** A box was measured (some of the body is in front of the lens). */
  ok: boolean;
  /** The anchor (the hips, or the centre) is in front of the lens. */
  inFront: boolean;
  /** The anchor on screen while in front. */
  ax: number; ay: number;
  /** From the middle of the screen toward the anchor, in pixels, valid in
   *  front of the lens and behind it alike (the off-screen arrow's bearing). */
  dx: number; dy: number;
  /** The body's box on screen, unpadded: crown to soles, shoulder to shoulder. */
  l: number; t: number; r: number; b: number;
  /** The crown on screen (head joint plus pad). */
  cx: number; cy: number;
}
export const lockFrame = (): LockFrame => ({ ok: false, inFront: false, ax: 0, ay: 0, dx: 0, dy: 1, l: 0, t: 0, r: 0, b: 0, cx: 0, cy: 0 });

const _p = new THREE.Vector3(), _v = new THREE.Vector3();
let _depth = 0;
/** `p` (world) to CSS pixels in `_v`; false behind the lens (or on it). */
function toScreen(p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) {
  _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
  _depth = -_v.z;
  if (!(_depth > .05)) return false;
  _v.applyMatrix4((camera as THREE.PerspectiveCamera).projectionMatrix);
  if (!Number.isFinite(_v.x) || !Number.isFinite(_v.y)) return false;
  _v.set((_v.x * .5 + .5) * w, (-_v.y * .5 + .5) * h, _depth);
  return true;
}
function include(out: LockFrame, x: number, y: number) {
  if (x < out.l) out.l = x; if (x > out.r) out.r = x;
  if (y < out.t) out.t = y; if (y > out.b) out.b = y;
}
/** The anchor: on screen in front of the lens, and the bearing toward it
 *  either way. Behind the lens the perspective divide mirrors a point through
 *  the middle of the screen; the bearing is taken before the divide instead,
 *  which points the true way (the same answer placeMarker's flip gives). */
function anchor(out: LockFrame, p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) {
  const m = (camera as THREE.PerspectiveCamera).projectionMatrix.elements;
  _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
  out.dx = m[0] * _v.x * w / 2; out.dy = -m[5] * _v.y * h / 2;
  if (out.dx === 0 && out.dy === 0) out.dy = 1;
  out.inFront = toScreen(p, camera, w, h);
  if (out.inFront) { out.ax = _v.x; out.ay = _v.y; out.dx = _v.x - w / 2; out.dy = _v.y - h / 2; }
}

/**
 * Measure `body` (a drawn fighter) or, for anything else, a target standing
 * round `centre` and `size` units tall, into `out`. `camera` must be the one
 * the frame is drawn with, its matrices current (FollowCamera has updated
 * them by the time the HUD runs).
 */
export function measureLock(out: LockFrame, body: LockBody | undefined, centre: THREE.Vector3 | undefined, size: number, camera: THREE.Camera, w: number, h: number): LockFrame {
  out.ok = false; out.l = out.t = Infinity; out.r = out.b = -Infinity; out.cx = out.cy = NaN;
  const shown = body?.shownBody ?? body;
  const joints = shown && shown.model?.visible !== false ? shown.joints : undefined;
  const head = joints?.get('Head'), hips = joints?.get('Hips');
  if (body && shown && joints && head && hips) {
    const bulk = drawnBulk(body);
    hips.getWorldPosition(_p); anchor(out, _p, camera, w, h);
    for (let i = 0; i < BOX_JOINTS.length; i++) {
      const name = BOX_JOINTS[i], bone = joints.get(name); if (!bone) continue;
      bone.getWorldPosition(_p);
      if (name === 'Head') _p.y += HEAD_PAD * bulk; else if (i >= 2 && i <= 5) _p.y -= SOLE_PAD;
      if (!toScreen(_p, camera, w, h)) continue;
      include(out, _v.x, _v.y);
      if (name === 'Head') { out.cx = _v.x; out.cy = _v.y; }
    }
    // The crown behind the lens with the rest in front (the camera inside the
    // head): the top of the box stands in for it.
    if (out.r >= out.l && !(out.cy >= out.t && out.cy <= out.b && out.cx >= out.l && out.cx <= out.r)) { out.cx = (out.l + out.r) / 2; out.cy = out.t; }
  } else {
    // Root to crown: a fighter with no joints to read, or a model hidden
    // behind a form that has none; else the centre and size of an enemy.
    let height: number;
    if (body) { _p.copy(body.group.position); height = CROWN * drawnBulk(body); }
    else if (centre) { height = ENEMY_HEIGHT * Math.max(.2, size); _p.copy(centre); _p.y -= ENEMY_CENTRE * height; }
    else return out;
    const bottomY = _p.y;
    _p.y = bottomY + height / 2; anchor(out, _p, camera, w, h);
    _p.y = bottomY; if (toScreen(_p, camera, w, h)) include(out, _v.x, _v.y);
    _p.y = bottomY + height; if (toScreen(_p, camera, w, h)) { include(out, _v.x, _v.y); out.cx = _v.x; out.cy = _v.y; }
    else if (out.r >= out.l) { out.cx = (out.l + out.r) / 2; out.cy = out.t; }
  }
  out.ok = out.r >= out.l && out.b >= out.t;
  return out;
}

/** A screen box in CSS pixels. */
export interface Box { l: number; t: number; r: number; b: number }
export const box = (): Box => ({ l: 0, t: 0, r: 0, b: 0 });
/** The brackets stand this far outside the joints' box: the joints are bone
 *  origins inside the silhouette, so the sides need a shoulder's breadth and
 *  the ends a little (the crown already carries HEAD_PAD, the soles SOLE_PAD). */
export const PAD_SIDE = .13, PAD_END = .055, PAD_MIN = 6;
/** Never narrower than half its height: a body seen end-on (feet together,
 *  shoulders edge-on) would otherwise be framed as a post. */
export const MIN_ASPECT = .5;
/** Never smaller than this, so a fighter across the arena still reads. */
export const MIN_BOX = 26;
/** The joints' box padded out to where the brackets go. A body lying down is
 *  wide and short and stays so: only the narrow side is widened. */
export function padBox(l: number, t: number, r: number, b: number, out: Box): Box {
  let w = Math.max(0, r - l), h = Math.max(0, b - t);
  const cx = (l + r) / 2, cy = (t + b) / 2, size = Math.max(w, h);
  w += 2 * Math.max(PAD_MIN, PAD_SIDE * size); h += 2 * Math.max(PAD_MIN, PAD_END * size);
  w = Math.max(w, MIN_ASPECT * h, MIN_BOX); h = Math.max(h, MIN_BOX);
  out.l = cx - w / 2; out.r = cx + w / 2; out.t = cy - h / 2; out.b = cy + h / 2;
  return out;
}
/** The length of each bracket's arms. */
export const bracketArm = (w: number, h: number) => Math.max(10, Math.min(36, .2 * Math.min(w, h)));
/** The brackets give way once the box stands taller than about 60% of the
 *  view (a fighter in the player's face is not lost); the pin stays. */
export const FADE_FROM = .52, FADE_TO = .64;
export function bracketFade(boxHeight: number, viewHeight: number) {
  const k = (boxHeight / Math.max(1, viewHeight) - FADE_FROM) / (FADE_TO - FADE_FROM);
  if (k <= 0) return 1; if (k >= 1) return 0;
  return 1 - k * k * (3 - 2 * k);
}
/** The pin's width in pixels: 24 for a body about 185 px tall, gently larger
 *  near and smaller far, never outside 16-28. */
export const PIN_W = 24, PIN_H = 20;
export const pinWidth = (boxHeight: number) => Math.max(16, Math.min(28, PIN_W * Math.pow(Math.max(1, boxHeight) / 185, .45)));
