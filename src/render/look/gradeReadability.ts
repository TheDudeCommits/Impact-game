import * as THREE from 'three';
import { frameUniforms, toonUniforms } from './toonShading';

/** Round 3b (CAMERA): the fighters stay readable under a technique's grade.
 *
 *  The blind critic: "Ultimate colour grades (Shiden purple, Gaunt dark red,
 *  Ward sepia) swallow dark-costumed characters. Characters should stay
 *  rim-lit and readable." The grade drains, dims and tints the whole frame;
 *  the fighters gave back half the dimming and took the technique's own hue
 *  as a rim - a violet line on a violet room, a crimson line on black armour
 *  in a crimson room, which is no line at all. Measured on the lock-on view
 *  (scripts/probe_grade_readability.mjs): under Ikazuchi Arrow's grade Shiden
 *  kept 59% of his separation from the room behind him, Gaunt under his own
 *  57%.
 *
 *  So while a grade holds, scaled by how far in it is:
 *  - the rim the fighters take is the technique's hue RIM_WHITE of the way to
 *    white - a pale edge that parts from the tinted room instead of melting
 *    into it - and its fresnel wash reaches RIM_WIDEN further round;
 *  - the fighters' own shade lifts: their ambient by AMBIENT_LIFT, and the
 *    floor under near-black cloth to at least FLOOR (linear), so a black coat
 *    comes up navy-grey with its folds rather than one mass.
 *  None of it touches the room, and none of it outlasts the grade: with no
 *  grade every value is exactly the stage look's own (re-read whenever the
 *  stage writes it, see `ease`). Nothing here changes a program. */
const RIM_WHITE = .6, RIM_WIDEN = .2, AMBIENT_LIFT = .35;
const FLOOR = new THREE.Color(.06, .06, .07);

const WHITE = new THREE.Color(1, 1, 1);
/** The stage's own values, as last seen without a grade, and what this last
 *  wrote (a stage change writes new ones, which then become the base). */
const base = { ambient: 0, rimWidth: 0, floor: new THREE.Color() };
const wrote = { ambient: NaN, rimWidth: NaN, floor: new THREE.Color(-1, -1, -1) };
let lifted = false;

/** Called by the renderer every frame after it has written the grade's level
 *  (0..1) and hue (unit luminance) into the fighters' frame uniforms. */
export function liftFightersUnderGrade(level: number, hue: THREE.Color) {
  const t = toonUniforms;
  // Whatever the stage wrote since the last frame is the new base.
  if (t.uToonAmbient.value !== wrote.ambient) base.ambient = t.uToonAmbient.value;
  if (t.uRimWidth.value !== wrote.rimWidth) base.rimWidth = t.uRimWidth.value;
  if (!t.uToonFloor.value.equals(wrote.floor)) base.floor.copy(t.uToonFloor.value);
  frameUniforms.uLookTechColor.value.copy(hue).lerp(WHITE, RIM_WHITE);
  if (!(level > 0)) {
    if (lifted) { t.uToonAmbient.value = base.ambient; t.uRimWidth.value = base.rimWidth; t.uToonFloor.value.copy(base.floor); lifted = false; }
    wrote.ambient = t.uToonAmbient.value; wrote.rimWidth = t.uRimWidth.value; wrote.floor.copy(t.uToonFloor.value);
    return;
  }
  const k = Math.min(1, level);
  t.uToonAmbient.value = base.ambient * (1 + AMBIENT_LIFT * k);
  t.uRimWidth.value = base.rimWidth + RIM_WIDEN * k;
  t.uToonFloor.value.setRGB(Math.max(base.floor.r, FLOOR.r * k), Math.max(base.floor.g, FLOOR.g * k), Math.max(base.floor.b, FLOOR.b * k));
  wrote.ambient = t.uToonAmbient.value; wrote.rimWidth = t.uRimWidth.value; wrote.floor.copy(t.uToonFloor.value);
  lifted = true;
}
