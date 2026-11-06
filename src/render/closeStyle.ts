import * as THREE from 'three';

export interface CloseStyleRig {
  /** Stand-back, the lens's height over the look point, the look point's height and the shoulder offset, each as a
   *  multiple of the Classic rig's value for the same frame. */
  boom: number; lift: number; focus: number; shoulder: number;
  /** The most the shoulder may put the fighter's centre off the middle of the frame, as a share of its half-width
   *  (the screen's own measure: the offset in metres is `sideMost` x the field's horizontal tangent x the stand-back). */
  sideMost: number;
  /** The base field of view in degrees (Classic: 50), and how much of the dynamic brain's own change to the field
   *  (a dash, a run, a group) is kept on top of it. */
  fov: number; fovKeep: number;
  /** The vertical framing limits, as shares of the frame's half-height (Classic: FRAME_TOP .62 for both crowns,
   *  MY_BOTTOM .8 and FOE_BOTTOM .88 for the feet, CARD_TOP .43 for the opponent's feet over the skill cards). The
   *  stand-back and widening that hold both bodies when a lens this close cannot (PULL_MAX, WIDEN_MOST) are Classic's. */
  top: number; myBottom: number; foeBottom: number; cardTop: number;
  /** The movement basis (FollowCamera.resample): how far it may lag the view in radians, how fast it is pulled back
   *  beyond that (per second), and how fast a held-up run takes the view (per second). */
  latchMost: number; latchRate: number; blockRate: number;
}
export const CLOSE_STYLE: CloseStyleRig = {
  boom: .84, lift: .77, focus: .72, shoulder: 1.4, sideMost: .66,
  fov: 42, fovKeep: .6,
  top: .64, myBottom: .84, foeBottom: .9, cardTop: .7,
  latchMost: .45, latchRate: 24, blockRate: 6,
};
/* The movement basis in the Close style (FollowCamera.resample; latchMost, latchRate, blockRate above). Classic reads a
 * held direction against the view as it was when the key went down, however far the camera then turns by itself to
 * frame the opponent - up to 160 degrees in a fight (tests/cameraStyle.test.ts measures it) - and hands the run the
 * view in one frame when the player is held up. On a lens this close, with a fighter this big, every degree of that
 * shows as the character veering against the keys. So with an opponent framed the latch is bounded: the basis may lag
 * the view by `latchMost` radians and no more (pulled back at `latchRate` per second beyond it, so a quick swing still
 * leaves a small lag), and a player held up gets the view over 1/`blockRate` seconds rather than at once. A held key
 * therefore always runs within about 30 degrees of the direction it points on the screen - toward the opponent for
 * forward, round them for a strafe. With nobody framed (the lens coming round behind a held run by itself) the latch
 * is whole, as in Classic, which is what stops a strafe being turned after by that recentre. */

/** How the group framing hands the camera back to Classic: a crowd (a free-for-all, a brawl with a second opponent
 *  close) is framed wide by the dynamic brain, and a close chase camera would lose half of it, so the style fades out
 *  as the brain's group share goes from CLOSE_GROUP_FROM to CLOSE_GROUP_TO. */
export const CLOSE_GROUP_FROM = .2, CLOSE_GROUP_TO = .7;
/** The blend's rate (per second): a settings change, or a crowd arriving, is a move and not a cut. */
export const CLOSE_RATE = 4;

export const GHOST_GONE = 2.2, GHOST_CLEAR = 4.4;
export const GHOST_FADE = { value: new THREE.Vector3(0, GHOST_GONE, GHOST_CLEAR) };
/** A pose's body scale for the fade: its height over a normal body's 1.9 m, no less than 1 and no more than 2. */
export function ghostScale(height?: number) { return THREE.MathUtils.clamp((height ?? 1.9) / 1.9, 1, 2); }
/** What the shader leaves of a pose `distance` metres from the lens (1 whole, 0 gone): the Close weight `weight` of the way from
 *  whole to GHOST_GONE..GHOST_CLEAR (x scale), by a smoothstep. */
export function ghostLensFade(distance: number, scale: number, weight: number) {
  return 1 - weight * (1 - THREE.MathUtils.smoothstep(distance, GHOST_GONE * scale, GHOST_CLEAR * scale));
}

/** The Close weight this frame, 0 (Classic) to 1: the style chosen, and not in a mode whose view is the squad's
 *  (`battlefield`: survival, the objectives, the rift) nor with a crowd to frame (`group`, 0..1). */
export function closeStyleGoal(style: 'classic' | 'close' | 'chase', battlefield: boolean, group: number) {
  if (style !== 'close' || battlefield) return 0;
  return 1 - THREE.MathUtils.smoothstep(group, CLOSE_GROUP_FROM, CLOSE_GROUP_TO);
}

/** The Close rig over a Classic one, `w` of the way (0 leaves `size` exactly as it is). `tanH` is the field's horizontal
 *  half-tangent (tan of half the field x the aspect), which bounds how far to one side the shoulder may put the fighter. */
export function closeStyleRig(size: { boom: number; lift: number; shoulder: number; focus: number }, w: number, tanH: number) {
  if (!(w > 0)) return;
  // Well to one side, but not off the screen: no further than `sideMost` of the half-width at the Close stand-back, and never
  // less than Classic's own angle off the line (its shoulder over its stand-back) - the cap only holds the fighter in, at a
  // narrow window, it does not tuck them behind the opponent.
  const shoulder = Math.min(size.shoulder * CLOSE_STYLE.shoulder, CLOSE_STYLE.sideMost * tanH * size.boom * CLOSE_STYLE.boom);
  size.shoulder += (Math.max(shoulder, size.shoulder * CLOSE_STYLE.boom) - size.shoulder) * w;
  size.boom *= 1 + (CLOSE_STYLE.boom - 1) * w;
  size.lift *= 1 + (CLOSE_STYLE.lift - 1) * w;
  size.focus *= 1 + (CLOSE_STYLE.focus - 1) * w;
}

/** The base field the lens eases to, from the Classic target (50, plus the brain's dash/run/group change). */
export function closeStyleFov(classic: number, w: number) {
  return w > 0 ? classic + ((CLOSE_STYLE.fov - 50) + (classic - 50) * (CLOSE_STYLE.fovKeep - 1)) * w : classic;
}

/** The awakening's close-up (CameraDirector 'awaken', local player only, with the cinematic camera on). The existing
 *  shot's machinery runs it - the wall search for a clear bearing, the blend from wherever the gameplay lens is, the
 *  hand-back, the body keep-out, the head follow and the beat (awakenBeat.ts: the gather, the burst's kick back and
 *  widening, the settle) - with these in place of the Classic framing:
 *
 *  - `angle`: it starts that many radians off the fighter's front, on the nearest side, and swings `orbit` radians
 *    more toward it over the entry: a front three-quarter view that settles nearly face on;
 *  - `reach`: the lens stands that many metres (times the body's size) from the fighter's chest - outside the
 *    power-up's aura column, which a lens nearer swallows - and the beat's push (awakenBeat.ts, a seventh of it as the
 *    power builds) is taken `push` times, and its zoom (the lens narrowing as the power builds) `zoom` times;
 *  - `low`: the lens's height over the chest (negative: knee height, looking up - the low angle);
 *  - `fov`: the field the close-up opens on (the beat's zoom narrows it further, its kick widens it);
 *  - `atX`, `atY`: where the head sits in the frame (Classic: -.15, .2); `hold` is the height over the root (the chest,
 *    not the hips as in Classic) that is kept over `floor`, the lowest it may fall - the legs are cropped, not the lens widened;
 *  - `in`, `out`: seconds to take the frame and to hand it back. The shot is the entry (AWAKENING_ENTRY, 0.9 s,
 *    the power-up's burst inside it) plus `out`: 1.35 s. */
export const CLOSE_SHOT = {
  angle: .7, orbit: .5, reach: 3.4, push: 1, zoom: .5, low: -.45, fov: 30, atX: -.1, atY: .34, hold: 1.3, floor: -.8,
  in: .3, out: .45,
};
