import * as THREE from 'three';
import {Fighter} from '../Fighter';
import type {FighterId, GameSnapshot, PlayerState} from '../../game/types';
import {outfitFor} from '../../game/economy/outfits';
import {otherTeam, type BallTeam, type BallView} from '../../game/ball/model';
import {goalZ} from '../../game/ball/physics';

/** Ball modes, faces. Four
 *  expressions - FOCUS, SHOUT, GRIN, HURT - drawn on a fighter's own face at a goal's sequence and on the podium.
 *
 *  - **The bones the files have.** 130 of the 131 bodies carry a `FacialBone` under their `Head` and an `L_Eye` and an
 *    `R_Eye` under that (the auto-rig's face bones), and the clips hold them at rest - but nothing in any file is skinned
 *    to them: a turn of an eye bone moved no vertex. So the face is given to them here, once per body's geometry, as a
 *    ball match first draws it: the head's own share of each vertex round the painted eyes passed to that eye's bone, and
 *    of the mouth and the jaw under it to the face bone, each with a soft edge (`weigh`). From then on the three bones are
 *    held at their bind's rest on the head whatever a clip writes into them (`faceOf` refuses a body whose bind is not its
 *    rest: none is), so the body draws as before anywhere a face is not asked for, in a ball match or not.
 *  - **Poses by bone offset**: each eye and the mouth scaled about a point of its own and moved (`FACE_POSES`), in the
 *    face's own units - the eyes' spacing, so one table serves every body - and set on the bones as matrices (a squash
 *    in the face's frame is a shear in a bone's own, which a bone's position, turn and scale cannot hold). Eased in and
 *    out on a smoothstep, from whatever the face shows to the next pose: never a pop.
 *  - **On a body only once it has been looked at**: `FACE_FIT` holds each body's measured face (where its painted eyes
 *    and mouth are), and a body missing from it shows none (tools/ball_faces_sheet.html draws every body in every pose).
 *  - **Only in a ball match, only where a face is seen**: the ceremony asks (`faceTheMoment`, from BallCeremony.update):
 *    the scorer shouts, then grins, and the beaten keeper is hurt, through a goal's sequence until its replay; the
 *    podium's winners grin and its MVP shouts. `?faces=0` (localhost) turns them off for a before and after, and
 *    `window.__ballFaces(on)` (localhost) in a running match. */
export type FaceKey = 'focus' | 'shout' | 'grin' | 'hurt';
export const FACE_KEYS: readonly FaceKey[] = ['focus', 'shout', 'grin', 'hurt'];

/** One feature's offset from rest, in the face's units (the painted eyes' spacing): scaled `sx`, `sy` about a point
 *  `px`, `py` off the feature's centre, then moved `tx`, `ty`. For the right eye, mirrored. */
export interface FaceOffset {sx: number; sy: number; px: number; py: number; tx: number; ty: number}
const REST: Readonly<FaceOffset> = {sx: 1, sy: 1, px: 0, py: 0, tx: 0, ty: 0};
/** The four poses: each eye (the brow above it rides along) and the mouth (the jaw under it rides along). */
export const FACE_POSES: Readonly<Record<FaceKey, {eye: FaceOffset; mouth: FaceOffset}>> = {
  // Narrowed from above, the brow down on it; the mouth set.
  focus: {eye: {sx: 1, sy: .66, px: 0, py: -.14, tx: 0, ty: -.04}, mouth: {sx: .9, sy: .85, px: 0, py: 0, tx: 0, ty: 0}},
  // Eyes wide, brows up; the jaw dropped and the mouth's corners pulled down.
  shout: {eye: {sx: 1.05, sy: 1.26, px: 0, py: 0, tx: 0, ty: .05}, mouth: {sx: .92, sy: 1, px: 0, py: 0, tx: 0, ty: -.17}},
  // Smiling eyes - the lower lid pushed up, the eye still open - and the mouth's corners wider and up.
  grin: {eye: {sx: 1.02, sy: .72, px: 0, py: .2, tx: 0, ty: .02}, mouth: {sx: 1.2, sy: .9, px: 0, py: 0, tx: 0, ty: .07}},
  // Screwed shut, the brow down on it; the mouth a wide grimace, its corners down.
  hurt: {eye: {sx: 1.08, sy: .36, px: 0, py: 0, tx: 0, ty: -.05}, mouth: {sx: 1.1, sy: .9, px: 0, py: 0, tx: 0, ty: -.05}},
};

/** A body's face, measured on the sheet, in eye bone spacings from the middle of the two eye bones (up and the body's
 *  left positive): the painted eyes' centre height (`eye`) and half spacing (`apart`; the regions and the poses are drawn
 *  to twice that, the face's own unit), the mouth's line - the top of its opening where it is drawn open - (`mouth`) and
 *  half width (`wide`), the chin (`chin`). `mouthless`: a mouth hidden (a beard, a mask), so only the eyes move;
 *  `eyeless`: eyes behind glasses, which a squint would bend, so only the mouth moves; `only`: the one eye that moves (1
 *  the body's left, -1 its right), the other under a patch. */
export interface FaceFit {eye: number; apart: number; mouth: number; wide: number; chin: number; mouthless?: boolean; eyeless?: boolean; only?: 1 | -1}
/** Bodies switched on, each looked at in every pose on the sheet: by fighter, an awakened form as `<id>:form`. */
export const FACE_FIT: Readonly<Partial<Record<string, FaceFit>>> = {
  adad: {eye: .18, apart: .5, mouth: -.65, wide: .4, chin: -1.35},
  akagane: {eye: -.15, apart: .45, mouth: -1, wide: .55, chin: -1.75},
  akaito: {eye: -.35, apart: .5, mouth: -1.4, wide: .2, chin: -1.95},
  akayuri: {eye: -.14, apart: .53, mouth: -.93, wide: .13, chin: -1.33},
  amagoi: {eye: -.55, apart: .55, mouth: -1.68, wide: .25, chin: -2.05},
  ampere: {eye: -.5, apart: .6, mouth: -1.72, wide: .3, chin: -2.1},
  aqrab: {eye: -.45, apart: .46, mouth: -1.53, wide: .32, chin: -1.95},
  aquilo: {eye: -.32, apart: .55, mouth: -1.42, wide: .3, chin: -1.65},
  asahi: {eye: -.45, apart: .52, mouth: -1.33, wide: .12, chin: -1.7},
  barrow: {eye: -.03, apart: .5, mouth: -.42, wide: .6, chin: -1.1},
  basilissa: {eye: .3, apart: .69, mouth: -.98, wide: .38, chin: -2.66},
  bellows: {eye: -.32, apart: .45, mouth: -1.25, wide: .3, chin: -1.7, mouthless: true},
  bruin: {eye: -.5, apart: .5, mouth: -1.3, wide: .5, chin: -1.8},
  buna: {eye: -.4, apart: .55, mouth: -1.03, wide: .5, chin: -1.65},
  cardo: {eye: -.42, apart: .5, mouth: -1.15, wide: .5, chin: -1.6},
  chohan: {eye: -.47, apart: .5, mouth: -1.2, wide: .2, chin: -1.75},
  dorado: {eye: -.3, apart: .45, mouth: -.88, wide: .45, chin: -1.9},
  'full-beam': {eye: -.15, apart: .4, mouth: -.6, wide: .45, chin: -1},
  gaunt: {eye: -.4, apart: .5, mouth: -1.45, wide: .25, chin: -1.95, only: 1},
  gohaku: {eye: -.45, apart: .45, mouth: -1.25, wide: .15, chin: -1.45},
  gorai: {eye: -.42, apart: .5, mouth: -.9, wide: .5, chin: -1.35},
  gosu: {eye: -.35, apart: .55, mouth: -1.3, wide: .2, chin: -1.75},
  gummy: {eye: -.15, apart: .6, mouth: -.95, wide: .45, chin: -1.6},
  hagure: {eye: -.5, apart: .55, mouth: -1.3, wide: .35, chin: -1.65},
  hakushi: {eye: -.45, apart: .45, mouth: -.85, wide: .55, chin: -1.5},
  haldor: {eye: -.35, apart: .45, mouth: -1.2, wide: .3, chin: -1.5, mouthless: true},
  hawser: {eye: -.4, apart: .55, mouth: -1.28, wide: .2, chin: -1.65},
  highsun: {eye: -.05, apart: .43, mouth: -.75, wide: .3, chin: -1.2, mouthless: true},
  hikui: {eye: -.6, apart: .55, mouth: -1.48, wide: .15, chin: -1.95},
  hinomoto: {eye: -.35, apart: .45, mouth: -1.2, wide: .3, chin: -1.5, mouthless: true},
  hisame: {eye: -.25, apart: .55, mouth: -1.03, wide: .1, chin: -1.45},
  imago: {eye: -.3, apart: .48, mouth: -1.12, wide: .2, chin: -1.55},
  ippon: {eye: -.15, apart: .55, mouth: -1.2, wide: .3, chin: -1.85},
  irbis: {eye: -.75, apart: .5, mouth: -1.1, wide: .3, chin: -1.25, mouthless: true},
  jinlin: {eye: -.1, apart: .55, mouth: -1.03, wide: .4, chin: -1.45},
  jirenga: {eye: -.1, apart: .45, mouth: -.95, wide: .4, chin: -1.5},
  kagari: {eye: -.15, apart: .55, mouth: -.85, wide: .3, chin: -1.35},
  kenzo: {eye: -.35, apart: .45, mouth: -1.25, wide: .25, chin: -1.55, mouthless: true},
  kinu: {eye: -.08, apart: .6, mouth: -1.02, wide: .3, chin: -1.35},
  koko: {eye: -.98, apart: .68, mouth: -2.62, wide: .4, chin: -3.35},
  konta: {eye: -.41, apart: .5, mouth: -1, wide: .38, chin: -1.62},
  kosho: {eye: -.33, apart: .48, mouth: -1.1, wide: .22, chin: -1.55},
  kubiwa: {eye: -.25, apart: .52, mouth: -1, wide: .15, chin: -1.4},
  kuon: {eye: -.25, apart: .5, mouth: -1.18, wide: .25, chin: -1.65},
  kusushi: {eye: -.35, apart: .55, mouth: -1.38, wide: .25, chin: -1.85},
  lanthorn: {eye: -.07, apart: .6, mouth: -.97, wide: .45, chin: -1.47},
  levin: {eye: -.25, apart: .5, mouth: -1.37, wide: .25, chin: -1.8},
  madake: {eye: -.3, apart: .5, mouth: -1.1, wide: .45, chin: -1.75},
  magatsu: {eye: -.35, apart: .48, mouth: -1.3, wide: .35, chin: -1.65},
  mikage: {eye: -.1, apart: .55, mouth: -.85, wide: .35, chin: -1.3},
  minase: {eye: -.3, apart: .5, mouth: -1.15, wide: .3, chin: -1.55},
  mizuhiki: {eye: -.2, apart: .55, mouth: -1.18, wide: .2, chin: -1.45},
  nigo: {eye: -.35, apart: .52, mouth: -1.4, wide: .12, chin: -1.8},
  onigawara: {eye: -.97, apart: .4, mouth: -1.35, wide: .3, chin: -1.7, mouthless: true},
  oro: {eye: -.5, apart: .5, mouth: -1.4, wide: .45, chin: -1.95},
  ouga: {eye: -.65, apart: .5, mouth: -1.55, wide: .35, chin: -2},
  psyche: {eye: -.3, apart: .55, mouth: -1.2, wide: .3, chin: -1.55},
  pyroclast: {eye: -.62, apart: .6, mouth: -1.6, wide: .5, chin: -2.1},
  rakucho: {eye: -.5, apart: .55, mouth: -1.45, wide: .2, chin: -1.8},
  rook: {eye: -.3, apart: .52, mouth: -1.45, wide: .2, chin: -1.9},
  sashigane: {eye: -.45, apart: .46, mouth: -1.2, wide: .3, chin: -1.85, eyeless: true},
  sekka: {eye: -.57, apart: .48, mouth: -1.25, wide: .4, chin: -1.75},
  senko: {eye: .42, apart: .5, mouth: -1, wide: .4, chin: -1.75, mouthless: true},
  setsu: {eye: -.25, apart: .55, mouth: -1.25, wide: .2, chin: -1.55},
  shakudo: {eye: -.1, apart: .55, mouth: -.95, wide: .3, chin: -1.35},
  shiden: {eye: -.4, apart: .47, mouth: -1.35, wide: .2, chin: -1.85},
  shidare: {eye: -.25, apart: .6, mouth: -1.25, wide: .2, chin: -1.75},
  shijima: {eye: -.3, apart: .6, mouth: -1.45, wide: .12, chin: -1.95},
  shiun: {eye: -.55, apart: .53, mouth: -1.37, wide: .3, chin: -1.8, eyeless: true},
  sorayomi: {eye: -.5, apart: .52, mouth: -1.45, wide: .25, chin: -2},
  sorrel: {eye: -.33, apart: .6, mouth: -1.4, wide: .3, chin: -1.95},
  strappado: {eye: -.33, apart: .45, mouth: -1.32, wide: .6, chin: -1.95},
  strix: {eye: -.33, apart: .5, mouth: -1.3, wide: .3, chin: -1.75, mouthless: true},
  suzuran: {eye: -.25, apart: .6, mouth: -1.03, wide: .3, chin: -1.55},
  svanhild: {eye: -.18, apart: .6, mouth: -1.1, wide: .1, chin: -1.6},
  taisei: {eye: -.55, apart: .45, mouth: -.95, wide: .3, chin: -1.35},
  tancho: {eye: -.2, apart: .55, mouth: -1.15, wide: .12, chin: -1.5},
  tempo: {eye: -.5, apart: .52, mouth: -1.4, wide: .4, chin: -1.9},
  tobari: {eye: -.15, apart: .52, mouth: -1.27, wide: .25, chin: -1.75},
  torsion: {eye: -.62, apart: 1, mouth: -2.07, wide: .32, chin: -3.05},
  tsubute: {eye: -.3, apart: .5, mouth: -1.07, wide: .55, chin: -1.75},
  ume: {eye: -.33, apart: .45, mouth: -1.07, wide: .12, chin: -1.5},
  unari: {eye: -.3, apart: .55, mouth: -1.3, wide: .3, chin: -1.95},
  vesper: {eye: -.22, apart: .71, mouth: -1.83, wide: .3, chin: -2.4},
  ward: {eye: .18, apart: .55, mouth: -.6, wide: .3, chin: -1.1, mouthless: true},
  wataame: {eye: -.3, apart: .55, mouth: -1.4, wide: .2, chin: -1.9},
  wuming: {eye: -.6, apart: .55, mouth: -1.65, wide: .12, chin: -2},
  yodaka: {eye: -.4, apart: .45, mouth: -1.37, wide: .33, chin: -1.6},
  // Awakened forms.
  'akayuri:form': {eye: -.14, apart: .53, mouth: -.94, wide: .12, chin: -1.33},
  'ampere:form': {eye: -.15, apart: .55, mouth: -.93, wide: .35, chin: -1.4},
  'gorai:form': {eye: -.9, apart: .4, mouth: -1.5, wide: .4, chin: -1.95},
  'gummy:form': {eye: -.25, apart: .5, mouth: -.93, wide: .4, chin: -1.75},
  'hakushi:form': {eye: -.65, apart: .45, mouth: -.95, wide: .45, chin: -1.4},
  'hawser:form': {eye: -.3, apart: .5, mouth: -.9, wide: .2, chin: -1.37},
  'highsun:form': {eye: -.05, apart: .43, mouth: -.75, wide: .3, chin: -1.2, mouthless: true},
  'hikui:form': {eye: -.6, apart: .55, mouth: -1.5, wide: .15, chin: -1.95},
  'irbis:form': {eye: -.65, apart: .5, mouth: -1.25, wide: .4, chin: -1.8},
  'jinlin:form': {eye: -.3, apart: .55, mouth: -1.25, wide: .35, chin: -1.85},
  'kusushi:form': {eye: -.38, apart: .55, mouth: -1.4, wide: .25, chin: -1.95},
  'lanthorn:form': {eye: -.1, apart: .55, mouth: -.97, wide: .45, chin: -1.5},
  'madake:form': {eye: -.3, apart: .45, mouth: -1, wide: .4, chin: -1.75},
  'minase:form': {eye: -.3, apart: .5, mouth: -1.18, wide: .3, chin: -1.65},
  'nigo:form': {eye: -.6, apart: .55, mouth: -1.75, wide: .15, chin: -2.1},
  'onigawara:form': {eye: -.97, apart: .4, mouth: -1.35, wide: .3, chin: -1.7, mouthless: true},
  'rakucho:form': {eye: -.3, apart: .55, mouth: -1.25, wide: .15, chin: -1.55},
  'shijima:form': {eye: -.05, apart: .65, mouth: -1.22, wide: .15, chin: -2.1},
  'shiun:form': {eye: -.4, apart: .5, mouth: -1.35, wide: .2, chin: -1.75},
  'tobari:form': {eye: -.15, apart: .52, mouth: -1.27, wide: .25, chin: -1.75},
  'ume:form': {eye: -.33, apart: .45, mouth: -1.07, wide: .12, chin: -1.5},
  'vesper:form': {eye: -.22, apart: .62, mouth: -1.65, wide: .28, chin: -2.65},
};

/** How long a face takes to arrive at a pose and to leave it, seconds (an ease in and out either way). */
export const FACE_EASE = {in: .22, out: .35};
/** The edges of the regions given to the bones, in eye spacings: each eye's reach across, up (the brow) and down, and
 *  the soft edges; the mouth's, and how much of the corners' move its middle takes (`centre`: the corners lead, so a
 *  move up is a smile and a move down a shout's); the least a vertex must face forward and how far back it may lie;
 *  and how far in front of a feature's own skin a vertex may stand and still move with it (`proud`: a fringe does not). */
const REGION = {eyeX: .42, eyeUp: .62, eyeDown: .4, eyeSoft: .5, mouthEdge: .07, chinSoft: .3, wideSoft: 1.9, centre: .62, front: .15, depth: -.45, proud: .1};

/** `?faces=0` on this machine: no faces anywhere, for a before and after. */
export function facesWanted(location?: {hostname: string; search: string}): boolean {
  if (!location) return true;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return !(local && new URLSearchParams(location.search).get('faces') === '0');
}
let wanted = facesWanted(typeof location === 'object' ? location : undefined);

/** The fit a body is drawn with (an awakened form's own), or none. */
export function faceFitOf(fighter: FighterId | string, form: boolean): FaceFit | undefined {
  return FACE_FIT[form ? `${fighter}:form` : fighter];
}

interface Feature {from: FaceOffset; now: FaceOffset; to: FaceOffset; t: number; span: number}
interface Rig {
  bones: [THREE.Bone, THREE.Bone, THREE.Bone];
  /** Each bone's bind (bind space from the bone's own) and its inverse, the head's inverse bind. */
  bind: THREE.Matrix4[]; inverse: THREE.Matrix4[]; head: THREE.Matrix4;
  /** The face's frame: face units to bind space, and back. */
  frame: THREE.Matrix4; frameInverse: THREE.Matrix4;
  fit: FaceFit;
  eyes: [Feature, Feature]; mouth: Feature;
  key: FaceKey | null;
}
const NAMES = ['FacialBone', 'L_Eye', 'R_Eye'] as const;
const rigs = new WeakMap<Fighter, Rig | null>();
const weighed = new WeakMap<THREE.BufferGeometry, boolean>();
/** What each face is asked to show now (by player id), and until when on the page's clock (seconds). */
const asks = new Map<string, {key: FaceKey; until: number}>();
/** When the ceremony last asked anything (page seconds): bodies are only readied while a ball match is on. */
let matchSeen = -Infinity;
const clock = () => performance.now() / 1000;
/** What drawing the faces has cost this page, for the probes (window.ballFaceCost): the rigs made and refused and the
 *  weighing's time, the frames a face moved in (`frames`, `frameMs`, `posed`), and the hook's every call (`hookMs`). */
export const ballFaceCost = {rigs: 0, refused: 0, weighMs: 0, frameMs: 0, frames: 0, posed: 0, hookMs: 0, hookCalls: 0};
/** Why a body was refused, by fighter (the probes and the sheet). */
export const faceRefusals = new Map<string, string>();

/** A body's face bones, as its file has them: the skinned mesh that carries them, their indices (the face bone's, the
 *  eyes', the head's), the bones, their binds, and the face's frame - or why there is none. Each bone's bind is checked
 *  against its rest: a face bone off the head's at rest would shift the face the moment anything is weighted to it. */
export function faceOf(model: THREE.Object3D) {
  let skinned: THREE.SkinnedMesh | undefined;
  model.traverse(o => { const m = o as THREE.SkinnedMesh; if (!skinned && m.isSkinnedMesh && NAMES.every(n => m.skeleton.bones.some(b => b.name === n))) skinned = m; });
  if (!skinned) return 'no face bones';
  const skeleton = skinned.skeleton, find = (name: string) => skeleton.bones.findIndex(b => b.name === name);
  const at = [...NAMES.map(find), find('Head')];
  if (at.some(i => i < 0)) return 'no head';
  const bones = at.slice(0, 3).map(i => skeleton.bones[i]) as [THREE.Bone, THREE.Bone, THREE.Bone];
  const head = skeleton.bones[at[3]];
  if (bones[0].parent !== head || bones[1].parent !== bones[0] || bones[2].parent !== bones[0]) return 'face bones not under the head';
  const inverse = at.map(i => skeleton.boneInverses[i].clone()), bind = inverse.map(m => m.clone().invert());
  const eyeL = new THREE.Vector3().setFromMatrixPosition(bind[1]), eyeR = new THREE.Vector3().setFromMatrixPosition(bind[2]);
  const scale = eyeL.distanceTo(eyeR);
  if (!(scale > 1e-4)) return 'eyes on one point';
  // At rest each bone must sit where its bind puts it on the head: the face bone's rest against the head's inverse bind
  // times its own bind, and each eye's through it. (Turns compared as they are, moves in eye spacings.)
  const rest = bones.map(b => new THREE.Matrix4().compose(b.position, b.quaternion, b.scale));
  const restEye = (i: number) => rest[0].clone().multiply(rest[i]);
  const off = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.reduce((m, v, k) => Math.max(m, Math.abs(v - b.elements[k]) / (k >= 12 && k < 15 ? scale : 1)), 0);
  const drift = Math.max(off(inverse[3].clone().multiply(bind[0]), rest[0]), off(inverse[3].clone().multiply(bind[1]), restEye(1)), off(inverse[3].clone().multiply(bind[2]), restEye(2)));
  if (drift > .005) return `bind off rest (${drift.toFixed(4)})`;
  // The face's frame: across from the right eye to the left, up as near the world's as square to that allows, and out
  // of the face; in eye spacings from the middle of the two.
  const x = eyeL.clone().sub(eyeR).normalize(), y = new THREE.Vector3(0, 1, 0).addScaledVector(x, -x.y).normalize(), z = x.clone().cross(y);
  const middle = eyeL.clone().add(eyeR).multiplyScalar(.5);
  if (middle.clone().sub(new THREE.Vector3().setFromMatrixPosition(bind[3])).dot(z) < 0) return 'eyes behind the head';
  const frame = new THREE.Matrix4().makeBasis(x.multiplyScalar(scale), y.multiplyScalar(scale), z.multiplyScalar(scale)).setPosition(middle);
  return {skinned, skeleton, at, bones, bind, inverse, scale, drift, frame, frameInverse: frame.clone().invert()};
}

/** A body's rig, its geometry weighted once: null where it has no face to draw (not on the sheet, or `faceOf` says
 *  why not; faceRefusals keeps the reason). */
export function rigOf(body: Fighter, fighter: string, form: boolean): Rig | null {
  const label = `${fighter}${form ? ':form' : ''}`;
  const refuse = (why: string) => { faceRefusals.set(label, why); ballFaceCost.refused++; return null; };
  const fit = faceFitOf(fighter, form);
  if (!fit) return refuse('not on the sheet');
  const model = (body as unknown as {model: THREE.Object3D}).model, face = faceOf(model);
  if (typeof face === 'string') return refuse(face);
  const rig: Rig = {bones: face.bones, bind: face.bind.slice(0, 3), inverse: face.inverse.slice(0, 3), head: face.inverse[3], frame: face.frame, frameInverse: face.frameInverse, fit,
    eyes: [feature(), feature()], mouth: feature(), key: null};
  const t0 = performance.now();
  model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton === face.skeleton && !weighed.has(m.geometry)) { weighed.set(m.geometry, true); weigh(m, face.at, rig); } });
  ballFaceCost.weighMs += performance.now() - t0; ballFaceCost.rigs++;
  return rig;
}
const feature = (): Feature => ({from: {...REST}, now: {...REST}, to: {...REST}, t: 1, span: FACE_EASE.in});

/** The head's share of each vertex round the eyes and the mouth given to the face's bones (in place: every shell and
 *  copy of the body shares these attributes). `at`: the face bone's, the eyes' and the head's index in the skeleton. */
export function weigh(mesh: THREE.SkinnedMesh, at: number[], rig: Pick<Rig, 'frameInverse' | 'fit'>) {
  const geometry = mesh.geometry, ids = geometry.getAttribute('skinIndex') as THREE.BufferAttribute, amounts = geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute, normals = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!ids || !amounts || !positions) return 0;
  const [faceBone, left, right, head] = at, fit = rig.fit, u = fit.apart / .5;
  // (The regions in the painted eyes' spacing: a body whose eye bones stand closer than its eyes gets them as big.)
  const R = {...REGION}; for (const key of ['eyeX', 'eyeUp', 'eyeDown', 'mouthEdge', 'chinSoft', 'depth', 'proud'] as const) R[key] *= u;
  const toFace = rig.frameInverse.clone().multiply(mesh.bindMatrix), turn = new THREE.Matrix3().getNormalMatrix(toFace);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), slots = [0, 0, 0, 0], shares = [0, 0, 0, 0];
  const headShare = (i: number) => { let own = 0; for (let j = 0; j < 4; j++) if (ids.getComponent(i, j) === head) own += amounts.getComponent(i, j); return own; };
  // How far out of the face each feature's own skin stands (the median depth of the head's vertices on it): anything
  // well in front of that - a fringe, a strand across the brow - keeps to the head.
  const near: number[][] = [[], [], []];
  for (let i = 0; i < positions.count; i++) {
    if (headShare(i) < .3) continue;
    p.fromBufferAttribute(positions, i).applyMatrix4(toFace);
    if (p.z < R.depth) continue;
    for (const [k, cx, cy] of [[0, fit.apart, fit.eye], [1, -fit.apart, fit.eye], [2, 0, fit.mouth]] as const) if (Math.hypot((p.x - cx) / (.22 * u), (p.y - cy) / (.16 * u)) < 1) near[k].push(p.z);
  }
  const surface = near.map(list => { if (!list.length) return Infinity; list.sort((a, b) => a - b); return list[Math.floor(list.length / 2)]; });
  // Shares are split in the file's own steps (a byte's 255ths, mostly), so each vertex's shares still add up to exactly
  // what they did: rounded each on its own, a head's 1.6 m from the floor drifted up to a centimetre at rest.
  const array = (amounts as unknown as {data?: {array: ArrayLike<number>}}).data?.array ?? amounts.array;
  const unit = !amounts.normalized ? 0 : array instanceof Uint8Array ? 255 : array instanceof Uint16Array ? 65535 : array instanceof Uint32Array ? 4294967295 : 0;
  const read = (i: number, j: number) => unit ? Math.round(amounts.getComponent(i, j) * unit) : amounts.getComponent(i, j);
  const part = (x: number) => unit ? Math.round(x) : x;
  const least = unit ? 1 : 1e-4;
  let changed = 0;
  for (let i = 0; i < positions.count; i++) {
    let own = 0, slot = -1, all = 0;
    for (let j = 0; j < 4; j++) { const w = read(i, j); all += w; if (ids.getComponent(i, j) === head && w > 0) { own += w; slot = j; } }
    if (!(all > 0) || own < .3 * all || slot < 0) continue;
    p.fromBufferAttribute(positions, i).applyMatrix4(toFace);
    if (p.z < R.depth) continue;
    if (normals) { n.fromBufferAttribute(normals, i).applyMatrix3(turn).normalize(); if (n.z < R.front) continue; }
    const behind = (k: number) => 1 - THREE.MathUtils.smoothstep(p.z - surface[k], R.proud, R.proud + .12 * u);
    const eye = (side: number) => {
      const dx = (p.x - side * fit.apart) / R.eyeX, dy = (p.y - fit.eye) / (p.y > fit.eye ? R.eyeUp : R.eyeDown);
      return 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dy), R.eyeSoft, 1);
    };
    const wl = fit.eyeless || fit.only === -1 ? 0 : eye(1) * behind(0), wr = fit.eyeless || fit.only === 1 ? 0 : eye(-1) * behind(1);
    let wm = 0;
    if (!fit.mouthless) {
      const down = THREE.MathUtils.smoothstep(-p.y, -(fit.mouth + R.mouthEdge), -(fit.mouth - R.mouthEdge)) * (1 - THREE.MathUtils.smoothstep(-p.y, -(fit.chin + .05 * u), -(fit.chin - R.chinSoft)));
      const ax = Math.abs(p.x), across = (1 - THREE.MathUtils.smoothstep(ax, fit.wide * 1.15, fit.wide * R.wideSoft)) * (R.centre + (1 - R.centre) * THREE.MathUtils.smoothstep(ax, 0, fit.wide));
      wm = down * across * behind(2);
    }
    const total = wl + wr + wm;
    if (total < 1e-3) continue;
    const k = total > 1 ? 1 / total : 1;
    // The head's slot keeps what is left of its share; the rest go to the vertex's free slots, the largest first. (Never
    // to another bone's slot: its share moved to the head would move the vertex at rest.)
    for (let j = 0; j < 4; j++) { slots[j] = ids.getComponent(i, j); shares[j] = read(i, j); }
    let kept = own, gave = 0;
    const gifts = ([[left, wl * k], [right, wr * k], [faceBone, wm * k]] as [number, number][]).sort((x, y) => y[1] - x[1]);
    for (const [bone, w] of gifts) {
      const given = part(w * own);
      if (given < Math.max(least, .02 * own)) continue;
      let to = -1;
      for (let j = 0; j < 4; j++) if (j !== slot && shares[j] <= 0) { to = j; break; }
      if (to < 0) break;
      slots[to] = bone; shares[to] = given; kept -= given; gave++;
    }
    if (!gave) continue;
    shares[slot] = kept;
    for (let j = 0; j < 4; j++) { ids.setComponent(i, j, slots[j]); amounts.setComponent(i, j, unit ? shares[j] / unit : shares[j]); }
    changed++;
  }
  if (changed) { ids.needsUpdate = true; amounts.needsUpdate = true; }
  return changed;
}

/** One feature's offset as a matrix in bind space: about its centre `cx`, `cy` (face units), mirrored for `side` -1. */
function offsetMatrix(rig: Rig, o: FaceOffset, cx: number, cy: number, side: number, out: THREE.Matrix4) {
  const u = rig.fit.apart / .5, px = cx + side * o.px * u, py = cy + o.py * u;
  out.makeTranslation(-px, -py, 0).premultiply(_m.makeScale(o.sx, o.sy, 1)).premultiply(_m.makeTranslation(px + side * o.tx * u, py + o.ty * u, 0));
  return out.premultiply(rig.frame).multiply(rig.frameInverse);
}
const _m = new THREE.Matrix4(), _d = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()], _r = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()], _i = new THREE.Matrix4();

/** The face's pose as it stands set on its bones: each bone's matrix on its parent such that whatever is weighted to it
 *  is the head's, offset in bind space. Held there from the rig's first frame on (at rest, the bind's own rest): the bones
 *  carry part of the face now, and what a clip or a layer writes into their position, turn and scale is not drawn. */
function pose(rig: Rig) {
  const fit = rig.fit;
  offsetMatrix(rig, rig.mouth.now, 0, fit.mouth, 1, _d[0]);
  offsetMatrix(rig, rig.eyes[0].now, fit.apart, fit.eye, 1, _d[1]);
  offsetMatrix(rig, rig.eyes[1].now, -fit.apart, fit.eye, -1, _d[2]);
  // Each bone on the head: the head's inverse bind, the offset, the bone's bind; an eye then on the face bone's.
  for (let b = 0; b < 3; b++) _r[b].copy(rig.head).multiply(_d[b]).multiply(rig.bind[b]);
  _i.copy(_r[0]).invert();
  for (let b = 0; b < 3; b++) {
    const bone = rig.bones[b];
    bone.matrix.copy(b === 0 ? _r[0] : _r[b].premultiply(_i));
    bone.matrixAutoUpdate = false; bone.matrixWorldNeedsUpdate = true;
  }
}

const ease = (t: number) => t * t * (3 - 2 * t);
function step(f: Feature, to: Readonly<FaceOffset>, dt: number, span: number) {
  if (!same(f.to, to)) { Object.assign(f.from, f.now); Object.assign(f.to, to); f.t = 0; f.span = span; }
  if (f.t >= 1) return false;
  f.t = Math.min(1, f.t + dt / f.span);
  const k = ease(f.t);
  for (const key of ['sx', 'sy', 'px', 'py', 'tx', 'ty'] as const) f.now[key] = f.from[key] + (f.to[key] - f.from[key]) * k;
  return true;
}
const same = (a: Readonly<FaceOffset>, b: Readonly<FaceOffset>) => a.sx === b.sx && a.sy === b.sy && a.px === b.px && a.py === b.py && a.tx === b.tx && a.ty === b.ty;
const atRest = (f: Feature) => f.t >= 1 && same(f.to, REST);

/** Each body's mesh that carries the face bones, once looked for (null: none). */
const faceMeshes = new WeakMap<Fighter, THREE.SkinnedMesh | null>();
function faceMeshOf(body: Fighter) {
  let mesh = faceMeshes.get(body);
  if (mesh === undefined) {
    mesh = null;
    (body as unknown as {model: THREE.Object3D}).model.traverse(o => { const m = o as THREE.SkinnedMesh; if (!mesh && m.isSkinnedMesh && m.skeleton.bones.some(b => b.name === NAMES[0])) mesh = m; });
    faceMeshes.set(body, mesh);
  }
  return mesh;
}

/** Fighter.face, every frame for every body drawn: the body's face eased toward what is asked of it. */
export function faceFrame(body: Fighter, state: PlayerState, real: number) {
  const now = clock();
  let rig = rigs.get(body);
  if (rig === undefined) {
    if (!wanted) return;
    // Readied while a ball match is on - and, once a ball match has weighted a body's geometry, for every body sharing
    // it, in a ball match or not, so that its face bones are held at their rest (faceFrame never asks one outside).
    if (now - matchSeen > 2) { const mesh = faceMeshOf(body); if (!mesh || !weighed.has(mesh.geometry)) return; }
    const form = !!(body as unknown as {isForm?: boolean}).isForm;
    // (An outfit on a body of its own has a face of its own, not on the sheet.)
    rig = outfitFor(body.outfitId, state.fighter)?.model ? null : rigOf(body, state.fighter, form);
    rigs.set(body, rig);
    if (rig) pose(rig);
  }
  if (!rig) return;
  // (Switched off on a page that has faces: each face back to rest at once - __ballFaces, for a before and after.)
  if (!wanted) { if (!atRest(rig.mouth) || !atRest(rig.eyes[0]) || !atRest(rig.eyes[1])) { for (const f of [rig.mouth, ...rig.eyes]) { Object.assign(f.from, REST); Object.assign(f.now, REST); Object.assign(f.to, REST); f.t = 1; } pose(rig); } return; }
  const ask = asks.get(state.id), key = ask && ask.until > now ? ask.key : null;
  if (key === null && atRest(rig.mouth) && atRest(rig.eyes[0]) && atRest(rig.eyes[1])) return;
  const t0 = performance.now();
  const dt = Math.min(.1, Math.max(0, real)), span = key ? FACE_EASE.in : FACE_EASE.out;
  const target = key ? FACE_POSES[key] : undefined;
  let moving = step(rig.mouth, target && !rig.fit.mouthless ? target.mouth : REST, dt, span);
  moving = step(rig.eyes[0], target?.eye ?? REST, dt, span) || moving;
  moving = step(rig.eyes[1], target?.eye ?? REST, dt, span) || moving;
  rig.key = key;
  if (moving) { pose(rig); ballFaceCost.posed++; }
  ballFaceCost.frameMs += performance.now() - t0; ballFaceCost.frames++;
}

/** What `id`'s face is asked to show now (the probes and the tests). */
export function faceAsked(id: string): FaceKey | null { const ask = asks.get(id); return ask && ask.until > clock() ? ask.key : null; }
/** Asks `id`'s face to show `key` for the next `seconds` (asked again each frame, it stays). */
export function askFace(id: string, key: FaceKey, seconds = .25) {
  asks.set(id, {key, until: clock() + seconds});
}

/** What the ceremony shows now, as BallCeremony.update has it (one call a frame): the faces it asks for. */
export function faceTheMoment(view: BallView | null | undefined, snapshot: GameSnapshot | null | undefined, show: string | null, sequence: {at: number; scorer?: string; team: BallTeam} | null, podium: readonly string[]) {
  if (!view || !snapshot) return;
  installBallFaces();
  matchSeen = clock();
  const now = snapshot.serverTime;
  // A goal's sequence (a Sky Spike point's on match point), until its replay or the kickoff: the scorer shouts, then
  // grins; the side that conceded's keeper is hurt.
  const replaying = !!view.replay && now >= view.replay.at;
  if (sequence && view.phase === 'scored' && !replaying && now >= sequence.at) {
    if (sequence.scorer) askFace(sequence.scorer, now - sequence.at < SHOUT_FOR ? 'shout' : 'grin');
    const keeper = view.mode === 'goal-rush' ? beaten(view, snapshot, otherTeam(sequence.team)) : undefined;
    if (keeper) askFace(keeper, 'hurt');
  }
  // The podium: the winners grin, the MVP shouts first.
  if (show === 'podium' && view.phase === 'over') {
    const since = now - view.endsAt;
    for (const id of podium) askFace(id, id === view.mvp && since < SHOUT_FOR + .4 ? 'shout' : 'grin');
  }
}
/** How long a scorer (and the podium's MVP) shouts before grinning, seconds. */
export const SHOUT_FOR = 1.3;
/** The keeper beaten: the conceding side's seat the bots made keeper, else the one of them nearest their own goal. */
function beaten(view: BallView, snapshot: GameSnapshot, team: BallTeam) {
  const seats = view.seats.filter(s => s.team === team);
  const keeper = seats.find(s => s.role === 'keeper');
  if (keeper) return keeper.id;
  let best: string | undefined, near = Infinity;
  for (const s of seats) {
    const p = snapshot.players.find(q => q.id === s.id);
    if (!p) continue;
    const d = Math.abs(p.z - goalZ(team));
    if (d < near) { near = d; best = s.id; }
  }
  return best;
}

/** Installs the hook (once, the first time a ball match's ceremony asks): Fighter.face. */
export function installBallFaces() {
  if (installed) return;
  installed = true;
  const before = Fighter.face;
  Fighter.face = (body, state, real) => {
    const t0 = performance.now();
    faceFrame(body, state, real);
    ballFaceCost.hookMs += performance.now() - t0; ballFaceCost.hookCalls++;
    before?.(body, state, real);
  };
  if (typeof window === 'object') Object.assign(window, {ballFaceCost, faceRefusals, faceAsked});
  // (On this machine: faces off and on again in a running match, for a before and after of one moment.)
  if (typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) Object.assign(window, {__ballFaces: (on: boolean) => { wanted = on; }});
}
let installed = false;

/** For the sheet and the tests: a body's face held in `key` at full (null: rest) at once, readied whatever the match. */
export function holdFace(body: Fighter, state: PlayerState, key: FaceKey | null) {
  let rig = rigs.get(body);
  if (rig === undefined) { rig = rigOf(body, state.fighter, !!(body as unknown as {isForm?: boolean}).isForm); rigs.set(body, rig); }
  if (!rig) return false;
  const target = key ? FACE_POSES[key] : undefined;
  for (const [f, o] of [[rig.mouth, target && !rig.fit.mouthless ? target.mouth : REST], [rig.eyes[0], target?.eye ?? REST], [rig.eyes[1], target?.eye ?? REST]] as const) {
    Object.assign(f.from, o); Object.assign(f.now, o); Object.assign(f.to, o); f.t = 1;
  }
  rig.key = key;
  pose(rig);
  return true;
}
/** For the sheet: a fit tried on a body (null: the table's). */
export function tryFit(fighter: string, form: boolean, fit: FaceFit | null) {
  (FACE_FIT as Record<string, FaceFit | undefined>)[form ? `${fighter}:form` : fighter] = fit ?? undefined;
}
/** For tests: every ask and the match's clock forgotten. */
export function resetBallFaces() { asks.clear(); matchSeen = -Infinity; faceRefusals.clear(); }
