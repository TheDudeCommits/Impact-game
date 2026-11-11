import * as THREE from 'three';
import type {Fighter} from '../Fighter';

/**
 * Goal Rush's SPORT mode (`?football`; game/ball/football.ts): a kick on the run shows a kick. The match plays the ball
 * itself and the body runs on through the touch, so a whole-body take would slide its feet along the floor; instead the
 * kit's take (the side-foot pass, SHOOT's snap, the DRIVE) is laid over the body's own run as an additive layer on the
 * striking leg, the hips and the spine only - each bone's turn away from the take's own first pose, added on top of
 * what the run cycle drew this frame - the other bones (the planted leg, the arms, the head) left to the run.
 *
 * Timed on the drawn clock: the take's contact lands as the drawn ball leaves (the event's `at` against the page's drawn
 * server time), weighted in over LAYER.in before the contact, held LAYER.hold after it and blended out over LAYER.out.
 * Applied every frame after the bodies are posed (main.ts `kickLayer.apply`), before the frame is drawn; nothing is
 * allocated in a frame once a take's tracks are read.
 */
/** `trunk`: the share of the take's hips and spine laid on (the leg carries the kick; the trunk only leans - all of it
 *  folded a running shot nearly flat for a frame, filmed). */
export const LAYER = {in: .1, hold: .08, out: .2, lead: .25, trunk: .2} as const;
const LEG = /(up.?leg|thigh|upper.?leg|leg|knee|calf|shin|foot|toe|ankle)/i, CORE = /(hip|pelvis|spine|chest|torso|waist|abdomen)/i;
const RIGHT = /(right|(^|[^a-z])r([^a-z]|$))/i, LEFT = /(left|(^|[^a-z])l([^a-z]|$))/i;

const interp = (t: THREE.KeyframeTrack) => new THREE.QuaternionLinearInterpolant(t.times, t.values, 4, new Float32Array(4));
interface Track { node: THREE.Object3D; sample: THREE.Interpolant; ref: THREE.Quaternion; share: number }
interface Layer { tracks: Track[]; at: number; contact: number; duration: number }
const read = new WeakMap<THREE.AnimationClip, {tracks: {name: string; track: THREE.QuaternionKeyframeTrack}[]}>();
const layers = new Map<Fighter, Layer>();
const _q = new THREE.Quaternion(), _d = new THREE.Quaternion(), _id = new THREE.Quaternion();

/** The take's tracks the layer moves: the hips and spine, and the striking leg - the side whose thigh and shin turn the
 *  most about the contact. */
function tracksOf(clip: THREE.AnimationClip, contact: number) {
  let got = read.get(clip);
  if (got) return got;
  const quats = clip.tracks.filter((t): t is THREE.QuaternionKeyframeTrack => t instanceof THREE.QuaternionKeyframeTrack || t.ValueTypeName === 'quaternion') as THREE.QuaternionKeyframeTrack[];
  const nameOf = (t: THREE.KeyframeTrack) => THREE.PropertyBinding.parseTrackName(t.name).nodeName;
  const motion = (t: THREE.QuaternionKeyframeTrack) => {
    const s = interp(t), a = new THREE.Quaternion().fromArray(s.evaluate(Math.max(0, contact - .15)) as unknown as number[]), b = new THREE.Quaternion().fromArray(s.evaluate(contact) as unknown as number[]);
    return a.angleTo(b);
  };
  let right = 0, left = 0;
  for (const t of quats) { const n = nameOf(t); if (!LEG.test(n)) continue; if (RIGHT.test(n)) right += motion(t); else if (LEFT.test(n)) left += motion(t); }
  const side = right >= left ? RIGHT : LEFT;
  got = {tracks: quats.filter(t => { const n = nameOf(t); return CORE.test(n) || (LEG.test(n) && side.test(n)); }).map(track => ({name: nameOf(track), track}))};
  read.set(clip, got);
  return got;
}

/** A kick on the run: `clip` (the take fitted to this body's rig), its contact (seconds into it), and the event's server
 *  time - the moment the drawn ball leaves. */
export function startKick(body: Fighter, clip: THREE.AnimationClip, contact: number, at: number) {
  const tracks: Track[] = [];
  for (const {name, track} of tracksOf(clip, contact).tracks) {
    const node = body.model.getObjectByName(name);
    if (!node) continue;
    const sample = interp(track);
    tracks.push({node, sample, ref: new THREE.Quaternion().fromArray(sample.evaluate(0) as unknown as number[]).invert(), share: CORE.test(name) && !LEG.test(name) ? LAYER.trunk : 1});
  }
  if (tracks.length) layers.set(body, {tracks, at, contact, duration: clip.duration});
  return tracks.length;
}
/** How much of the layer is on `t` s from the contact (negative: before it). */
const weight = (t: number) => t < -LAYER.in ? 0 : t < 0 ? THREE.MathUtils.smoothstep(t, -LAYER.in, 0) : t < LAYER.hold ? 1 : 1 - THREE.MathUtils.smoothstep(t, LAYER.hold, LAYER.hold + LAYER.out);

/** Every frame, after the bodies are posed: each layer at the drawn clock `drawn` (server seconds). */
export function applyKicks(drawn: number) {
  for (const [body, layer] of layers) {
    const t = drawn - layer.at, w = weight(t);
    if (t > LAYER.hold + LAYER.out || t < -LAYER.lead - 1) { layers.delete(body); continue; }
    if (w <= 0) continue;
    const time = Math.max(0, Math.min(layer.duration, layer.contact + t));
    for (const tr of layer.tracks) {
      _q.fromArray(tr.sample.evaluate(time) as unknown as number[]);
      _d.copy(tr.ref).multiply(_q);
      _id.identity().slerp(_d, w * tr.share);
      tr.node.quaternion.multiply(_id);
    }
  }
}
/** For the checks: how many bodies have a layer on now. */
export const kicksOn = () => layers.size;
export function clearKicks() { layers.clear(); }
