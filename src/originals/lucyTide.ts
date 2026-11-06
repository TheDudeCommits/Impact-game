import * as THREE from 'three';
import { MOVES } from '../game/moves';
import type { PlayerState } from '../game/types';
import { strikeOffsets } from '../engine/sim/areaDamage';
import { ORIGINALS } from './roster';

export const LUCY_TIDE = !!ORIGINALS.gummy;

const ULT = MOVES.gummy.ultimate;
/** The ultimate's clock (moves.ts): the grab's contact, the finisher, the whole move. */
export const TIDE = { grab: ULT.contacts[0], blow: ULT.contacts[ULT.contacts.length - 1], length: ULT.duration } as const;

/** The takes (author_lucy_tide.py): `Grand Tide` is the whole move on the move's own clock (the grab at TIDE.grab, the
 *  blow at TIDE.blow, TIDE.length long); `Grand Tide Open` is its first TIDE.grab seconds and then a whiff's recovery
 *  (the line closing on the air and snapping home), OPEN_LENGTH long. The cinematic window is laid linearly, so the
 *  take plays on the move's clock exactly (Fighter.ultimateCurve, `windows`). */
export const TIDE_CLIP = 'Grand Tide', TIDE_OPEN_CLIP = 'Grand Tide Open', MONSOON_CLIP = 'Monsoon Cast';
export const OPEN_LENGTH = 1.15;
export const TIDE_PLAN = {
  opener: { clip: TIDE_OPEN_CLIP, at: TIDE.grab / OPEN_LENGTH },
  formOpener: { clip: TIDE_OPEN_CLIP, at: TIDE.grab / OPEN_LENGTH },
  cine: { from: TIDE.grab / TIDE.length, at: TIDE.blow / TIDE.length, windows: [[TIDE.grab / TIDE.length, 1, TIDE.blow / TIDE.length]] as [number, number, number][] },
};

/** The area move's cast: his own take, wound to the slam on the release and held there (AreaSpec.anim's `clip`). Only
 *  for his own area move (a Forge kit's borrowed one is drawn as it says). */
export const MONSOON_ANIM = { fighter: 'gummy' as const, slot: 'special' as const, clip: MONSOON_CLIP, full: false };

/** The hammer's beats, seconds into the move: the arms go up into the sky (`up0` to `up1`, `sky` metres over where the
 *  take holds the fists), swing over and down onto the victim (`swing` to the blow, accelerating), hold on them `hold`,
 *  and snap home on the rubber's recoil (`settle`, `ring`: Fighter.ts RUBBER's). */
export const HAMMER = { up0: 1.2, up1: 1.78, sky: 2.7, swing: 1.95, hold: .09, apart: .13, settle: .05, ring: 2 * Math.PI * 5.5 } as const;

const UP = new THREE.Vector3(0, 1, 0);
const _elbow = new THREE.Vector3(), _wrist = new THREE.Vector3(), _goal = new THREE.Vector3(), _pivot = new THREE.Vector3();
const _from = new THREE.Vector3(), _to = new THREE.Vector3(), _dir = new THREE.Vector3(), _side = new THREE.Vector3(), _local = new THREE.Vector3();
const _target = new THREE.Vector3(), _turn = new THREE.Quaternion(), _part = new THREE.Quaternion();
const smooth = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const recoil = (w: number) => Math.exp(-w / HAMMER.settle) * (Math.cos(HAMMER.ring * w) + Math.sin(HAMMER.ring * w) / (HAMMER.ring * HAMMER.settle));

/** Where the hammer is `t` seconds into a confirmed Grand Tide: 0..1 up into the sky, 0..1 over onto the victim, and
 *  how much of the stretch is still out (1 until the hold ends, then the recoil). Undefined outside it. */
export function hammerPhase(t: number): { up: number; over: number; out: number } | undefined {
  if (t < HAMMER.up0 || t > TIDE.blow + HAMMER.hold + .45) return undefined;
  const up = smooth(HAMMER.up0, HAMMER.up1, t), u = Math.min(1, Math.max(0, (t - HAMMER.swing) / (TIDE.blow - HAMMER.swing)));
  const over = u * u * (1.6 - .6 * u);
  const after = t - TIDE.blow - HAMMER.hold;
  return { up, over, out: after <= 0 ? 1 : recoil(after) };
}

/** GRAND TIDE's hammer (Fighter.ts rubberLimbs, on whichever of his bodies is drawn): both hands shot from where the take
 *  holds them over his head up into the sky, then carried over in one arc - about his shoulders, from straight up to
 *  the victim's middle - and laid on them, the forearms stretched behind them as the Gatling's and the grab's are (the
 *  hand bone moved down the line; the sleeve's weights stretch the arm); held, and let go on the rubber's recoil.
 *  `victim` is the body it lands on (its rest centre), or none: then it lands `ahead` in front of him. Returns the
 *  longest stretch, in forearm lengths. */
export function tideHammer(state: PlayerState, joints: ReadonlyMap<string, THREE.Object3D>, group: THREE.Object3D, victim: THREE.Vector3 | undefined): number {
  if (!LUCY_TIDE || state.action !== 'ultimate' || state.confirmedAt === undefined || !state.actionDuration) return 0;
  const t = state.actionTime * state.actionDuration, phase = hammerPhase(t);
  if (!phase) return 0;
  group.updateMatrixWorld(true);
  const left = joints.get('LeftArm'), right = joints.get('RightArm');
  if (!left || !right) return 0;
  // The pivot: between his shoulders. Across: from his left shoulder to his right.
  left.getWorldPosition(_from); right.getWorldPosition(_to);
  _pivot.addVectors(_from, _to).multiplyScalar(.5); _side.subVectors(_to, _from).setY(0);
  if (_side.lengthSq() < 1e-8) _side.set(1, 0, 0); _side.normalize();
  if (victim) _goal.copy(victim);
  else { group.getWorldDirection(_dir).setY(0).normalize(); _goal.copy(_pivot).addScaledVector(_dir, 4).setY(group.position.y + 1); }
  let span = 0;
  for (const [name, across] of [['Right', 1], ['Left', -1]] as const) {
    const fore = joints.get(name + 'ForeArm'), hand = joints.get(name + 'Hand');
    if (!fore || !hand?.parent) continue;
    fore.getWorldPosition(_elbow); hand.getWorldPosition(_wrist);
    const forearm = _elbow.distanceTo(_wrist); if (forearm < 1e-3) continue;
    // Up into the sky from where the take holds the fist.
    _target.copy(_wrist).addScaledVector(UP, HAMMER.sky * phase.up);
    // Over: the arc from the sky to the victim about the shoulders (direction slerped, radius eased), the two fists a
    // hand's width apart across his shoulders' line.
    if (phase.over > 0) {
      _from.subVectors(_target, _pivot); const r0 = _from.length(); _from.normalize();
      _to.copy(_goal).addScaledVector(_side, across * HAMMER.apart).sub(_pivot); const r1 = _to.length(); _to.normalize();
      _turn.setFromUnitVectors(_from, _to); _part.identity().slerp(_turn, phase.over);
      _dir.copy(_from).applyQuaternion(_part);
      _target.copy(_pivot).addScaledVector(_dir, r0 + (r1 - r0) * phase.over);
    }
    // Out, then home on the recoil (from where the take holds it): the overshoot squashes it only a little.
    _local.copy(_target).sub(_wrist).multiplyScalar(phase.out < 0 ? phase.out * .15 : phase.out);
    _wrist.add(_local);
    hand.position.copy(hand.parent.worldToLocal(_local.copy(_wrist)));
    hand.updateMatrixWorld(true);
    span = Math.max(span, _elbow.distanceTo(_wrist) / forearm);
  }
  return span;
}

/** The camera's summons (CameraDirector): the column his arms and the wave stand in, so the cinematic frames them. */
export function tideColumn(t: number): { height: number; back: number } | undefined {
  if (t < .8 || t > TIDE.blow + .2) return undefined;
  return { height: 1.8 + 3.4 * smooth(.8, 1.8, t), back: 2.2 };
}

// ------------------------------------------------------------------------------------------------------- MONSOON
/** One MONSOON, from its release: where it lands, how wide, when its strikes fall (server time), and who threw it from
 *  where. AreaTelegraph pushes them (it owns the area events); lucyTideFx.ts draws them. */
export interface MonsoonCast { key: string; actorId: string; at: THREE.Vector3; radius: number; release: number; strikes: number[]; from: THREE.Vector3; seen: number }
export const MONSOONS: MonsoonCast[] = [];
/** The area move's strikes after the first, seconds (its look's, as the server times them). */
const MONSOON_OFFSETS = strikeOffsets(MOVES.gummy.area ?? ULT);

/** Whether an area cast is Lucy's own MONSOON (his slot, his own move and look: not a Forge kit's other effect). */
export function isMonsoon(fighter: string | undefined, body: string | undefined, look: string | undefined, kitEffect: string | undefined): boolean {
  if (!LUCY_TIDE || fighter !== 'gummy' || (body && body !== 'gummy')) return false;
  return (!kitEffect || kitEffect === 'qk_explosion') && (!look || look === 'qk_explosion');
}

/** A MONSOON's release (AreaTelegraph): its strikes laid from `due` on the look's offsets. */
export function castMonsoon(key: string, actorId: string, at: { x: number; y: number; z: number }, radius: number, release: number, due: number, from: { x: number; y?: number; z: number } | undefined, strikes?: number) {
  if (MONSOONS.some(m => m.key === key)) return;
  const n = Math.max(1, strikes ?? MONSOON_OFFSETS.length), offsets = MONSOON_OFFSETS.length >= n ? MONSOON_OFFSETS.slice(0, n) : Array.from({ length: n }, (_, k) => MONSOON_OFFSETS[k] ?? k * .17);
  MONSOONS.push({ key, actorId, at: new THREE.Vector3(at.x, at.y, at.z), radius, release, strikes: offsets.map(o => due + o), from: new THREE.Vector3(from?.x ?? at.x, from?.y ?? at.y, from?.z ?? at.z), seen: release });
  while (MONSOONS.length > 8) MONSOONS.shift();
}
export function clearMonsoons() { MONSOONS.length = 0; }
