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
export const LAYER = {in: .1, hold: .08, out: .2, lead: .25, trunk: .2,
  /** The side-foot pass, faint seen from behind: its striking leg's turn laid on wider (`leg` times the take's), and
   *  the hips' turn (`hips`) more than the spine's, which is the side-foot's swing. */
  pass: {leg: 1.35, hips: .5}, tackle: .45} as const;
const HIPS = /(hip|pelvis)/i;
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
export function startKick(body: Fighter, clip: THREE.AnimationClip, contact: number, at: number, pass = false, tackle = false) {
  const tracks: Track[] = [];
  for (const {name, track} of tracksOf(clip, contact).tracks) {
    const node = body.model.getObjectByName(name);
    if (!node) continue;
    const sample = interp(track);
    const trunk = CORE.test(name) && !LEG.test(name);
    // (A TACKLE's take - the shoulder charge, the slide - leans the trunk more than a kick does: LAYER.tackle of it.)
    const share = trunk ? (tackle ? LAYER.tackle : pass && HIPS.test(name) ? LAYER.pass.hips : LAYER.trunk) : pass ? LAYER.pass.leg : 1;
    tracks.push({node, sample, ref: new THREE.Quaternion().fromArray(sample.evaluate(0) as unknown as number[]).invert(), share});
  }
  if (tracks.length) layers.set(body, {tracks, at, contact, duration: clip.duration});
  return tracks.length;
}
/** How much of the layer is on `t` s from the contact (negative: before it). */
const weight = (t: number) => t < -LAYER.in ? 0 : t < 0 ? THREE.MathUtils.smoothstep(t, -LAYER.in, 0) : t < LAYER.hold ? 1 : 1 - THREE.MathUtils.smoothstep(t, LAYER.hold, LAYER.hold + LAYER.out);

/** Every frame, after the bodies are posed: each layer at the drawn clock `drawn` (server seconds). */
export function applyKicks(drawn: number) {
  applyFull(drawn);
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

/**
 * The football takes (made for SPORT: the pass and the shot in stride, the poke, the keeper's catch, the
 * slide's get-up), laid FULL BODY over what the body drew this frame - each bone turned toward the take's pose by the
 * layer's weight, its run cycle underneath - on the same drawn clock. A press is answered at once (the ball leaves on the
 * press's tick), so a take cannot be started early: it is entered at its contact frame less what the page's display
 * delay leaves before the drawn ball goes (the event is heard before the drawn clock reaches it), weighted in over
 * TAKE.in, played on at `rate` (a stride take's cycle matched to the body's own run), and blended back to the run over
 * TAKE.out from `end` (a stride take: TAKE.after past the contact, before its follow-through slows and the feet would
 * slide). `hold` keeps it on its last frame (the keeper's catch, while it holds the ball); `then` plays a second take
 * straight after (the slide's get-up); `wind` is a held SHOOT's wind-up - the take's lead-in run by how far it is wound
 * (0-1), up to TAKE.wind s before the contact - until the shot's own event takes it on from there.
 */
export const TAKE = {in: .08, out: .2, after: .3, wind: .45} as const;
interface FullTrack { node: THREE.Object3D; sample: THREE.Interpolant; lower: boolean }
interface Full {
  tracks: FullTrack[]; clip: THREE.AnimationClip; at: number; contact: number; rate: number; end: number;
  first: number; hold?: () => boolean; then?: {clip: THREE.AnimationClip; tracks: FullTrack[]}; wind?: () => number | undefined;
  /** How much of the lead-in a wind-up runs (s; TAKE.wind unless set - a tap's is shorter). */
  lead?: number;
  /** Volleyball's ready pose (ballMoves.ts volleyPose): the take run up to here (s into the clip) and held there
   *  until the swing that plays the ball begins (`releaseTake`). */
  ready?: number;
  /** Let go (`dropTake`) at this drawn time (NaN: the next frame's), blended out over TAKE.out where it stands. */
  dropped?: number;
  /** How much of the take the hips and legs take (0-1, every frame; absent: all of it) - a ready pose on a body
   *  still running to the ball keeps its own stride under it, so its feet never slide. */
  legs?: () => number;
  /** Volleyball's ready stance between touches (ballMoves.ts STANCE): the held pose's weight shifting - the upper
   *  body swaying `sway` radians at most round the spine, side to side and turning a little, on its own beat (`phase`). */
  sway?: {amount: number; phase: number; node?: THREE.Object3D | null};
  /** The follow-through held - `after` s past the contact the take stands still for `hold` s, then runs on
   *  (the kick's top, held a beat: seen at play distance). */
  peak?: {after: number; hold: number};
}
const full = new Map<Fighter, Full>();
const tracksFull = (body: Fighter, clip: THREE.AnimationClip): FullTrack[] => {
  const out: FullTrack[] = [];
  for (const t of clip.tracks) {
    if (!(t instanceof THREE.QuaternionKeyframeTrack) && t.ValueTypeName !== 'quaternion') continue;
    const node = body.model.getObjectByName(THREE.PropertyBinding.parseTrackName(t.name).nodeName);
    if (node) { const name = node.name; out.push({node, sample: interp(t), lower: HIPS.test(name) || (LEG.test(name) && !/spine|chest|neck|head|arm|hand|shoulder/i.test(name))}); }
  }
  return out;
};
/** A football take on `body`, full body (see TAKE). `at`: the event's server time (NaN: now, entered just before the
 *  contact); `contact` s into the clip; `end` s into it where it blends back (default: its end). */
export function startTake(body: Fighter, clip: THREE.AnimationClip, o: {at: number; contact: number; rate?: number; end?: number; hold?: () => boolean; then?: THREE.AnimationClip; wind?: () => number | undefined; lead?: number; ready?: number; legs?: () => number; sway?: number; peak?: {after: number; hold: number}}) {
  const tracks = tracksFull(body, clip);
  if (!tracks.length) return 0;
  layers.delete(body);
  // (A shot's own event after its wind-up carries on from where the wind-up stands: no blend in again.)
  const was = full.get(body), carried = !!was?.wind && !o.wind && was.clip === clip;
  full.set(body, {tracks, clip, at: o.at, contact: o.contact, rate: o.rate ?? 1, end: Math.min(clip.duration, o.end ?? clip.duration), first: carried ? -Infinity : NaN, hold: o.hold, wind: o.wind, lead: o.lead,
    then: o.then ? {clip: o.then, tracks: tracksFull(body, o.then)} : undefined, ready: o.ready, legs: o.legs, peak: o.peak,
    sway: o.sway ? {amount: o.sway, phase: Math.random() * 6.283, node: tracks.find(t => !t.lower && /spine|chest/i.test(t.node.name))?.node ?? null} : undefined});
  return tracks.length;
}
/** The ready pose's swing begun - the take runs on from where it stands to its contact at `at` (server s). */
export function releaseTake(body: Fighter, at: number) {
  const f = full.get(body);
  if (!f) return false;
  f.at = at; f.ready = undefined;
  return true;
}
/** A ready pose's moment moved (the room's forecast refined it): its contact now at `at` (server s). */
export function retakeAt(body: Fighter, at: number) {
  const f = full.get(body);
  if (f && f.ready !== undefined && f.dropped === undefined) f.at = at;
}
/** A take let go (blended out from now, over TAKE.out). */
export function dropTake(body: Fighter) {
  const f = full.get(body);
  if (f && !f.wind && f.dropped === undefined) f.dropped = NaN;
}
export const takeOn = (body: Fighter) => full.get(body);
function applyFull(drawn: number) { for (const [body, f] of full) stepFull(body, f, drawn); }
function stepFull(body: Fighter, f: Full, drawn: number) {
  if (Number.isNaN(f.first)) f.first = drawn;
  if (!Number.isFinite(f.at)) f.at = drawn + .05;
  let time: number, w = THREE.MathUtils.smoothstep(drawn - f.first, 0, TAKE.in);
  if (f.wind) {
    const share = f.wind();
    if (share === undefined) { full.delete(body); return; }
    time = Math.max(0, f.contact - (f.lead ?? TAKE.wind) * (1 - share));
  } else {
    let since = drawn - f.at;
    if (f.peak && since > f.peak.after) since = since < f.peak.after + f.peak.hold ? f.peak.after : since - f.peak.hold;
    time = Math.max(0, Math.min(f.clip.duration, f.contact + since * f.rate));
    if (f.ready !== undefined) time = Math.min(time, f.ready);
    if (f.dropped !== undefined) {
      if (Number.isNaN(f.dropped)) f.dropped = drawn;
      const k = (drawn - f.dropped) / TAKE.out;
      if (k >= 1) { full.delete(body); return; }
      f.ready ??= time; w = Math.min(w, 1 - THREE.MathUtils.smoothstep(k, 0, 1));
    }
    const holding = !!f.hold?.();
    if (!holding && time >= f.end) {
      const out = (time - f.end) / f.rate;
      // (A second take straight after - the slide's get-up - from the frame the first ends on, drawn this same frame.)
      if (f.then) { const next: Full = {tracks: f.then.tracks, clip: f.then.clip, at: drawn, contact: 0, rate: 1, end: f.then.clip.duration, first: -Infinity}; full.set(body, next); stepFull(body, next, drawn); return; }
      if (out >= TAKE.out) { full.delete(body); return; }
      w = Math.min(w, 1 - THREE.MathUtils.smoothstep(out, 0, TAKE.out));
    }
    if (holding) time = Math.min(time, f.clip.duration - 1e-3);
  }
  const lw = f.legs ? w * THREE.MathUtils.clamp(f.legs(), 0, 1) : w;
  for (const tr of f.tracks) { _q.fromArray(tr.sample.evaluate(time) as unknown as number[]); tr.node.quaternion.slerp(_q, tr.lower ? lw : w); }
  // (A ready stance's weight shifting, on the spine over the held pose.)
  const sw = f.sway;
  if (sw?.node && f.ready !== undefined) {
    const a = sw.amount * w, t = drawn * 1.9 + sw.phase;
    _e.set(Math.sin(t * .5) * a * .25, Math.sin(t * .37 + 1) * a, Math.sin(t) * a * .6);
    sw.node.quaternion.multiply(_s.setFromEuler(_e));
  }
}
const _e = new THREE.Euler(), _s = new THREE.Quaternion();
/** For the checks: how many bodies have a layer or a take on now. */
export const kicksOn = () => layers.size + full.size;
export function clearKicks() { layers.clear(); full.clear(); }
