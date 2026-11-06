/** The horde sculpted (flesh.ts): every kind of grunt as one continuous
 *  body - muscle, cloth and bone melted together - with its hard parts
 *  (weapons, peaks, eyes) added on single bones. Proportions follow the
 *  motion skeleton's rest pose: a T-pose facing +Z, 1.8 m to the crown,
 *  shoulders at 1.45 m, hips at 1.02 m, knees at 0.51 m.
 *
 *  The rift has had them all: faces sink into shadow under the brow, the
 *  eyes burn in their sockets (and flare with a wind-up, aGlow), and what
 *  they wore is torn and stained. Each is a silhouette first - a tribunal
 *  guard's cap and cutlass, a wraith's mask and the hole through it - because a
 *  horde is read dozens at a time, at a glance. */
import * as THREE from 'three';
import { BONE } from './motion';
import { GROUP, type GruntKit, type V3 } from './kit';
import { Flesh } from './flesh';

type Sculptor = (f: Flesh) => void;

// ---- the body every humanoid starts from ------------------------------------------------
export interface Build {
  /** Chest and shoulder width, limb thickness, belly. */
  bulk: number; limb: number; belly: number;
  skin: number; top: number; bottom: number; boots: number;
  /** Forearms and hands if not skin (gloves, gauntlets). */
  hands?: number;
  /** Sleeves to the elbow, to the wrist, or bare arms. */
  sleeves?: 'none' | 'short' | 'long';
  /** Trousers to the boot, shorts to the knee, or bare legs. */
  legs?: 'trousers' | 'shorts' | 'bare';
  neck?: boolean;
  /** Head and neck pushed forward and down: the starved, the feral. */
  hunch?: number;
  /** Ribs and a sunken belly (the damned). */
  starved?: boolean;
  /** No boots: bare, clawed feet. */
  barefoot?: boolean;
}

const L = 1, R = -1;
export const side = (s: number) => s > 0
  ? { arm: BONE.LeftArm, fore: BONE.LeftForeArm, hand: BONE.LeftHand, shoulder: BONE.LeftShoulder, up: BONE.LeftUpLeg, leg: BONE.LeftLeg, foot: BONE.LeftFoot, toe: BONE.LeftToeBase, group: GROUP.ARM_L }
  : { arm: BONE.RightArm, fore: BONE.RightForeArm, hand: BONE.RightHand, shoulder: BONE.RightShoulder, up: BONE.RightUpLeg, leg: BONE.RightLeg, foot: BONE.RightFoot, toe: BONE.RightToeBase, group: GROUP.ARM_R };

/** Skin first, then what is worn over it a hair larger, so it owns the surface. */
export function sculptBody(f: Flesh, b: Build) {
  const { bulk, limb, belly } = b;
  const hunch = b.hunch ?? 0;
  const wear = .012;
  const top = b.top, bottom = b.bottom;
  // ---- torso: pelvis, belly, ribcage, chest and back muscle ----
  f.soft(.05).on(BONE.Hips).color(bottom).ellipsoid(f.at(BONE.Hips, 0, -.01, -.005), .15 * bulk, .12, .115 * bulk * belly);
  f.on(BONE.Spine02, GROUP.UPPER).color(top).capsule(f.at(BONE.Hips, 0, .05, .005 * belly), f.at(BONE.Spine01, 0, -.02), (b.starved ? .1 : .122) * bulk * belly, .13 * bulk);
  f.on(BONE.Spine01, GROUP.UPPER).ellipsoid(f.at(BONE.Spine01, 0, .055, .008), .16 * bulk, .155, (b.starved ? .1 : .112) * bulk);
  f.on(BONE.Spine, GROUP.UPPER).soft(.035)
    .ellipsoid(f.at(BONE.Spine, .066 * bulk, -.04, .058), .084 * bulk, .062, .048, 0, 0, -.15)
    .ellipsoid(f.at(BONE.Spine, -.066 * bulk, -.04, .058), .084 * bulk, .062, .048, 0, 0, .15)
    // Trapezius and the upper back, rising into the neck.
    .ellipsoid(f.at(BONE.Spine, 0, .035, -.038 - hunch * .03), .142 * bulk, .075 + hunch * .03, .082 * bulk, 0, -hunch * .5);
  if (b.starved) {
    // Ribs pressing through: ridges carved across the flanks.
    f.soft(.008).color(top);
    for (let i = 0; i < 4; i++) for (const s of [L, R]) f.carve().capsule(f.at(BONE.Spine01, s * .06, .11 - i * .045, .1), f.at(BONE.Spine01, s * .16, .085 - i * .045, .045), .009, .007);
    f.soft(.035);
  }
  // ---- neck, and a head pushed forward by the hunch ----
  if (b.neck !== false) f.soft(.035).on(BONE.neck, GROUP.UPPER).color(b.skin).capsule(f.at(BONE.Spine, 0, .02, -.01), f.at(BONE.Head, 0, .03, .01 + hunch * .06), .056 * limb, .048 * limb);
  // ---- arms ----
  for (const s of [L, R]) {
    const j = side(s);
    const upper = b.sleeves === 'none' || !b.sleeves ? b.skin : top;
    // Deltoid over the joint, the upper arm with its biceps, the forearm tapering to the wrist.
    f.soft(.04).on(j.arm, j.group).color(upper).ellipsoid(f.at(j.arm, s * .014, .012, -.004), .066 * bulk, .062 * bulk, .064 * bulk);
    f.soft(.03).capsule(f.at(j.arm, s * .03), f.at(j.fore, 0, 0, .004), .05 * limb * bulk, .04 * limb * bulk);
    f.ellipsoid(f.between(j.arm, j.fore, .45, 0, .01, .012), .075 * limb, .038 * limb * bulk, .039 * limb * bulk);
    const fore = b.hands ?? (b.sleeves === 'long' ? top : b.skin);
    f.soft(.028).on(j.fore, j.group).color(fore).capsule(f.at(j.fore, s * .01), f.at(j.hand, -s * .02), .042 * limb * bulk, .031 * limb);
    f.ellipsoid(f.between(j.fore, j.hand, .28, 0, .006, .006), .07 * limb, .04 * limb * bulk, .041 * limb * bulk);
    // A fist: the palm block, the knuckles, a thumb.
    f.soft(.02).on(j.hand, j.group).color(b.hands ?? b.skin).box(f.at(j.hand, s * .05, -.008, .006), .085 * limb, .06 * limb, .075 * limb, 0, 0, 0, .025)
      .capsule(f.at(j.hand, s * .03, -.01, .045), f.at(j.hand, s * .06, -.035, .06), .016 * limb, .014 * limb);
    if (b.sleeves === 'short') f.soft(.012).on(j.arm, j.group).color(top).capsule(f.at(j.arm, s * .02), f.between(j.arm, j.fore, .55), .064 * limb * bulk, .056 * limb * bulk);
  }
  // ---- legs ----
  for (const s of [L, R]) {
    const j = side(s);
    const thigh = b.legs === 'bare' ? b.skin : bottom;
    f.soft(.04).on(j.up).color(thigh).capsule(f.at(j.up, s * .005, .02), f.at(j.leg, 0, .02), .088 * limb * bulk, .062 * limb);
    f.ellipsoid(f.between(j.up, j.leg, .38, s * .008, 0, .02), .075 * limb * bulk, .13, .068 * limb * bulk);
    const shin = b.legs === 'shorts' || b.legs === 'bare' ? b.skin : bottom;
    f.soft(.03).on(j.leg).color(shin).capsule(f.at(j.leg), f.at(j.foot, 0, .02), .058 * limb, .042 * limb);
    f.ellipsoid(f.between(j.leg, j.foot, .28, 0, 0, -.025), .052 * limb, .1, .055 * limb);
    if (b.barefoot) {
      // A long, clawed foot.
      f.soft(.025).color(b.skin).on(j.foot).box(f.at(j.foot, 0, -.04, .05), .085 * limb, .06, .19, 0, 0, 0, .03);
      f.on(j.toe).box(f.at(j.toe, 0, -.01, .03), .09 * limb, .04, .09, 0, 0, 0, .02);
      f.kit.on(j.toe).color(0x1a1412);
      for (const t of [-1, 0, 1]) f.kit.cone(f.kit.at(j.toe, t * .025, -.01, .07), f.kit.at(j.toe, t * .03, -.03, .12), .01, 4);
    } else {
      // Boots to mid-shin, a foot with a heel and a toe cap.
      f.soft(.02).color(b.boots).capsule(f.between(j.leg, j.foot, .45), f.at(j.foot, 0, .015), .052 * limb + wear, .048 * limb + wear);
      f.on(j.foot).box(f.at(j.foot, 0, -.035, .045), .1 * limb, .085, .2, 0, 0, 0, .035);
      f.on(j.toe).box(f.at(j.toe, 0, -.005, .02), .095 * limb, .06, .09, 0, 0, 0, .028);
    }
  }
  f.soft(.03);
}

/** A head: skull, cheek and jaw, the brow that throws the eyes into shadow,
 *  two sockets carved under it (where the burn goes) and - `snarl` - a mouth
 *  torn open under the nose: a blank face read as a mannequin's. */
export function sculptHead(f: Flesh, skin: number, scale = 1, jaw = 1, snarl = false) {
  const s = scale;
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(skin)
    .ellipsoid(f.at(BONE.Head, 0, .115 * s, -.005), .094 * s, .11 * s, .104 * s)
    .ellipsoid(f.at(BONE.Head, 0, .04 * s, .045 * s), .066 * s * jaw, .05 * s, .062 * s)
    .box(f.at(BONE.Head, 0, .14 * s, .078 * s), .15 * s, .03 * s, .04 * s, 0, .25, 0, .014)
    .ellipsoid(f.at(BONE.Head, 0, .09 * s, .1 * s), .018 * s, .03 * s, .02 * s, 0, -.3);
  sockets(f, .108 * s, .036 * s, .1 * s, s);
  if (snarl) {
    f.soft(.008).on(BONE.Head, GROUP.HEAD).head().color(0x160406);
    f.carve().box(f.at(BONE.Head, 0, .046 * s, .1 * s), .056 * s * jaw, .016 * s, .05 * s, .06, 0, 0, .006);
    // Teeth along the top of it.
    f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xcfc6b0);
    for (const x of [-.018, -.006, .006, .018]) f.kit.cone(f.kit.at(BONE.Head, x * s * jaw, .054 * s, .098 * s), f.kit.at(BONE.Head, x * s * jaw, .04 * s, .1 * s), .005 * s, 4);
  }
  f.soft(.03);
}
/** Two eye sockets carved into whatever face is there. */
export function sockets(f: Flesh, y: number, spread: number, forward: number, s = 1) {
  f.soft(.012).on(BONE.Head, GROUP.HEAD).head().color(0x0a0608);
  for (const x of [spread, -spread]) f.carve().ellipsoid(f.at(BONE.Head, x, y, forward), .027 * s, .017 * s, .03 * s);
  f.soft(.03);
}

/** Two burning eyes in the sockets, flaring on a wind-up. */
export function eyes(f: Flesh, color: number, y = .108, spread = .036, forward = .094, size = .014, slant = 0) {
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(color).glow(1);
  for (const s of [1, -1]) k.ellipsoid(k.at(BONE.Head, s * spread, y + s * slant, forward), size * 1.4, size * .75, size * .5, 4, 8);
  k.glow(0);
}

/** Claws on a hand: three blades curving out past the knuckles. */
function claws(f: Flesh, color: number, length = .13) {
  for (const s of [L, R]) {
    const j = side(s);
    f.kit.on(j.hand, j.group).color(color);
    for (let i = -1; i <= 1; i++) f.kit.cone(f.kit.at(j.hand, s * .085, -.005, i * .024 + .01), f.kit.at(j.hand, s * (.085 + length), -.035, i * .036 + .02), .012, 5);
  }
}

// ---- Dust Sea -------------------------------------------------------------------------------
// The Navy's whites gone grey with soot and worse, on men the rift has had:
// ashen skin, a soldier's build hunched to spring (clean whites on slim pale
// bodies read as "fake", shop mannequins in costume).
const TRIBUNAL_GUARD_WHITE = 0x86827a, TRIBUNAL_GUARD_BLUE = 0x161f40, TRIBUNAL_GUARD_COLLAR = 0x1f3470;
function guard(f: Flesh) {
  sculptBody(f, { bulk: 1.16, limb: 1.12, belly: 1.04, skin: 0x8a6e60, top: TRIBUNAL_GUARD_WHITE, bottom: TRIBUNAL_GUARD_BLUE, boots: 0x121216, sleeves: 'short', legs: 'trousers', hunch: .35 });
  sculptHead(f, 0x7e6356, 1, 1.18, true);
  // The sailor collar over the shoulders, square at the back; the knotted neckerchief.
  f.soft(.012).on(BONE.Spine, GROUP.UPPER).color(TRIBUNAL_GUARD_COLLAR).box(f.at(BONE.Spine, 0, .06, -.07), .3, .022, .16, 0, -.35, 0, .008)
    .box(f.at(BONE.Spine, 0, -.02, .1), .1, .12, .02, 0, .1, 0, .008);
  f.color(0xd29a2a).ellipsoid(f.at(BONE.Spine, 0, .02, .115), .03, .026, .022).capsule(f.at(BONE.Spine, 0, .0, .12), f.at(BONE.Spine, .015, -.12, .13), .016, .008);
  // A belt with its buckle.
  f.soft(.01).on(BONE.Hips).color(0x241a12).torus(f.at(BONE.Hips, 0, .075, .004), .145, .02);
  f.kit.on(BONE.Hips).color(0xb89a4a).box(f.kit.at(BONE.Hips, 0, .075, .15), .06, .045, .02);
  // The cap: a flat white crown on a blue band, the black peak pulled low - the eyes burn under it.
  f.soft(.015).on(BONE.Head, GROUP.HEAD).head().color(TRIBUNAL_GUARD_WHITE)
    .capsule(f.at(BONE.Head, 0, .18, -.005), f.at(BONE.Head, 0, .215, -.005), .108, .112)
    .ellipsoid(f.at(BONE.Head, 0, .245, -.01), .118, .03, .116);
  f.color(TRIBUNAL_GUARD_COLLAR).torus(f.at(BONE.Head, 0, .175, -.005), .106, .013);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0x111318).ellipsoid(f.kit.at(BONE.Head, 0, .168, .095), .092, .012, .065);
  eyes(f, 0xff2a1a, .108, .036, .096, .018);
}
// ---- what they carry: hard parts on one hand, the same on a sculpt and on a generated model ----
const _grip = new THREE.Vector3();
/** Where a hand closes: past the wrist along the forearm. (On the library's
 *  T-pose that is straight out along x; a generated model's arms hang lower,
 *  and its grip follows them.) */
function grip(k: GruntKit, hand: number, along: number, dy = 0, dz = 0): V3 {
  const wrist = k.rest[hand], elbow = k.rest[hand === BONE.RightHand ? BONE.RightForeArm : BONE.LeftForeArm];
  _grip.subVectors(wrist, elbow).normalize().multiplyScalar(along).add(wrist);
  return [_grip.x, _grip.y + dy, _grip.z + dz];
}
function cutlass(k: GruntKit, hand: number = BONE.RightHand) {
  const right = hand === BONE.RightHand;
  const p = grip(k, hand, .07, -.012, .01);
  k.on(hand, right ? GROUP.ARM_R : GROUP.ARM_L).color(0xb8902e).box([p[0], p[1], p[2] + .06], .12, .025, .035)
    .color(0x2a1a10).limb([p[0], p[1], p[2] - .04], [p[0], p[1], p[2] + .05], .016, .016, 6)
    .color(0xc9d0da).blade([p[0], p[1], p[2] + .07], [0, .15, 1], .74, .078, .012, .22);
}
function musket(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x5a3a22).box([h[0], h[1] - .02, h[2] - .12], .05, .075, .5, 0, .05)
    .color(0x2c2c30).limb([h[0], h[1] + .015, h[2] + .1], [h[0], h[1] + .025, h[2] + .84], .02, .017, 7)
    .color(0x8a6a2a).torus([h[0], h[1] + .02, h[2] + .5], .024, .006, [0, 0, 1], 4, 10)
    .color(0xb0b6c0).blade([h[0], h[1] + .025, h[2] + .82], [0, 0, 1], .22, .025, .01);
}

function automaton(f: Flesh) {
  // The automaton's frame: a bear of a body in black, the steel showing where it split.
  sculptBody(f, { bulk: 1.5, limb: 1.3, belly: 1.15, skin: 0x5a5048, top: 0x15171c, bottom: 0x15171c, boots: 0x0b0b0e, hands: 0x2a2a30, sleeves: 'long', legs: 'trousers', hunch: .3 });
  f.soft(.04).on(BONE.Head, GROUP.HEAD).head().color(0x6a5a50).ellipsoid(f.at(BONE.Head, 0, .12, 0), .115, .12, .115)
    .color(0x9aa4b0).box(f.at(BONE.Head, 0, .04, .07), .15, .07, .09, 0, 0, 0, .02);
  sockets(f, .115, .045, .105, 1.1);
  // The cap with its round ears.
  f.soft(.02).color(0x0e0e12).capsule(f.at(BONE.Head, 0, .18, -.005), f.at(BONE.Head, 0, .27, -.01), .125, .1)
    .ellipsoid(f.at(BONE.Head, .1, .29, 0), .05, .05, .032).ellipsoid(f.at(BONE.Head, -.1, .29, 0), .05, .05, .032);
  eyes(f, 0xff3a2a, .115, .045, .11, .018);
  // A reactor showing through the torn chest, ringed in steel; seams of metal down the arms.
  f.soft(.015).on(BONE.Spine01, GROUP.UPPER).color(0x9aa4b0).torus(f.at(BONE.Spine01, 0, .05, .16), .07, .018, 0, Math.PI / 2, 0);
  f.kit.on(BONE.Spine01, GROUP.UPPER).color(0xffb040).glow(.9).ellipsoid(f.kit.at(BONE.Spine01, 0, .05, .175), .05, .05, .02).glow(0);
  for (const s of [L, R]) { const j = side(s); f.soft(.01).on(j.fore, j.group).color(0x8a929c).capsule(f.at(j.fore, 0, .04, .02), f.at(j.hand, -s * .03, .035, .02), .012, .01); }
}

function beastPirate(f: Flesh) {
  // Gorai's crew: an open vest with a fur collar over a scarred chest, a sash,
  // wrapped shins, a bandana - and whatever the bad fruit left: horns.
  const skin = 0x9a5e3e;
  sculptBody(f, { bulk: 1.15, limb: 1.1, belly: 1.05, skin, top: skin, bottom: 0x3a1c4a, boots: 0x241612, sleeves: 'none', legs: 'trousers' });
  f.soft(.014).on(BONE.Spine, GROUP.UPPER).color(0x2a1c14)
    .box(f.at(BONE.Spine, .115, -.07, .01), .1, .32, .27, 0, 0, .1, .035).box(f.at(BONE.Spine, -.115, -.07, .01), .1, .32, .27, 0, 0, -.1, .035);
  f.soft(.03).color(0x6a5238).torus(f.at(BONE.Spine, 0, .06, -.01), .13, .04, 0, .15, 0);
  f.soft(.012).on(BONE.Hips).color(0xd8a028).torus(f.at(BONE.Hips, 0, .1, .005), .158, .032);
  for (const s of [L, R]) { const j = side(s); f.on(j.leg).color(0x8a7a60).capsule(f.between(j.leg, j.foot, .15), f.between(j.leg, j.foot, .5), .062, .056); }
  sculptHead(f, 0x8a5234, 1.02, 1.15);
  f.soft(.012).on(BONE.Head, GROUP.HEAD).head().color(0x6a1a1a).torus(f.at(BONE.Head, 0, .165, -.01), .1, .02, 0, -.15, 0);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xe0d4b4).cone(f.kit.at(BONE.Head, .07, .2, .02), f.kit.at(BONE.Head, .19, .34, -.02), .034, 6).cone(f.kit.at(BONE.Head, -.07, .2, .02), f.kit.at(BONE.Head, -.19, .34, -.02), .034, 6);
  eyes(f, 0xffb020);
  falchion(f.kit);
}
/** A heavy curved blade. */
function falchion(k: GruntKit) {
  const p = grip(k, BONE.RightHand, .07, -.012, .01);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x3a2a1a).limb([p[0], p[1], p[2] - .05], [p[0], p[1], p[2] + .06], .018, .018, 6).color(0xa0a6b0).blade([p[0], p[1], p[2] + .07], [0, .3, 1], .7, .11, .014, .3);
}

function chessSoldier(f: Flesh) {
  // Mirabel's Chess Peacekeepers: a tabard of black and white squares over a
  // lean body, a rook's tower for a helmet with a slit to burn through, a long
  // pike - the Emperor's own, where the Navy had stood at her side.
  sculptBody(f, { bulk: .95, limb: .95, belly: .9, skin: 0xd8b090, top: 0xece6d8, bottom: 0x18181c, boots: 0x0e0e10, hands: 0xece6d8, sleeves: 'long', legs: 'trousers' });
  for (let row = 0; row < 3; row++) for (let col = -1; col <= 1; col++) {
    const dark = Math.abs(row + col) % 2 === 1;
    f.soft(.006).on(BONE.Spine, GROUP.UPPER).color(dark ? 0x131316 : 0xf2eee2)
      .box(f.at(BONE.Spine, col * .088, .08 - row * .1, .118), .084, .094, .02, 0, 0, 0, .005)
      .box(f.at(BONE.Spine, col * .088, .08 - row * .1, -.1), .084, .094, .02, 0, 0, 0, .005);
  }
  sculptHead(f, 0xc89a78);
  // The rook: a tower over the head, its battlements round the top.
  f.soft(.012).on(BONE.Head, GROUP.HEAD).head().color(0xf2eee2)
    .capsule(f.at(BONE.Head, 0, .1, -.005), f.at(BONE.Head, 0, .31, -.005), .118, .104);
  f.color(0x131316).torus(f.at(BONE.Head, 0, .27, -.005), .106, .014);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0xf2eee2);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; k.box(k.at(BONE.Head, Math.sin(a) * .075, .4, Math.cos(a) * .075 - .005), .055, .06, .055); }
  k.color(0x08080a).box(k.at(BONE.Head, 0, .115, .105), .13, .026, .02);
  eyes(f, 0xff4020, .115, .03, .1, .012);
  pike(k);
}
/** The pike, carried forward like the rifles. */
function pike(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x2a1a10).limb([h[0], h[1] + .01, h[2] - .45], [h[0], h[1] + .02, h[2] + 1.15], .017, .015, 6)
    .color(0xb0b6c0).blade([h[0], h[1] + .02, h[2] + 1.13], [0, 0, 1], .3, .05, .012);
}

function beastGraftBrute(f: Flesh) {
  // A Beast-Graft grown huge: a bull's head on a wrestler's body, a mast-breaker in hand.
  sculptBody(f, { bulk: 1.6, limb: 1.45, belly: 1.25, skin: 0x9a5e40, top: 0x9a5e40, bottom: 0x3a1a4a, boots: 0x1a1010, sleeves: 'none', legs: 'trousers', hunch: .5 });
  f.soft(.04).on(BONE.Head, GROUP.HEAD).head().color(0x6a3e28).ellipsoid(f.at(BONE.Head, 0, .12, .01), .12, .115, .125)
    .ellipsoid(f.at(BONE.Head, 0, .07, .12), .085, .07, .08).color(0x2a1810).ellipsoid(f.at(BONE.Head, 0, .06, .19), .06, .045, .02);
  sockets(f, .13, .06, .1, 1.1);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xe0d4b8).cone(f.kit.at(BONE.Head, .1, .17), f.kit.at(BONE.Head, .3, .24, .05), .045, 7).cone(f.kit.at(BONE.Head, -.1, .17), f.kit.at(BONE.Head, -.3, .24, .05), .045, 7)
    .color(0xc8a040).torus(f.kit.at(BONE.Head, 0, .06, .2), .03, .007, [0, 0, 1], 4, 10);
  eyes(f, 0xff4a1a, .13, .06, .115, .018);
  mastBreaker(f.kit);
}
/** A 'mast-breaker': a spiked iron club. */
function mastBreaker(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .08);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x2e2624).limb([h[0], h[1], h[2] - .06], [h[0], h[1] + .08, h[2] + .95], .04, .1, 9);
  k.color(0x7a7a80);
  for (let i = 0; i < 9; i++) { const t = .32 + i * .075, a = i * 2.1; k.cone([h[0], h[1] + .08 * t, h[2] + .95 * t], [h[0] + Math.cos(a) * .15, h[1] + .08 * t + Math.sin(a) * .15, h[2] + .95 * t], .026, 4); }
}

// ---- Cinder Requiem --------------------------------------------------------------------------------------
function wraithBase(f: Flesh, mouthGlow = 0) {
  // A wraith: a lean black body, bone plates on the shoulders and shins, the
  // mask, and the hole where the heart was.
  sculptBody(f, { bulk: .95, limb: .92, belly: .85, skin: 0x121216, top: 0x121216, bottom: 0x121216, boots: 0x121216, sleeves: 'none', legs: 'bare', barefoot: true, hunch: .45 });
  f.soft(.01).on(BONE.Spine01, GROUP.UPPER).color(0x020203).carve().capsule(f.at(BONE.Spine01, 0, .05, -.2), f.at(BONE.Spine01, 0, .05, .2), .055, .055);
  f.soft(.012).color(0xe6e2d8).torus(f.at(BONE.Spine01, 0, .05, .105), .062, .014, 0, Math.PI / 2, 0);
  for (const s of [L, R]) {
    const j = side(s);
    f.soft(.012).on(j.arm, j.group).color(0xe6e2d8).ellipsoid(f.at(j.arm, s * .02, .045, -.01), .075, .03, .07, 0, 0, s * -.35);
    f.on(j.leg).ellipsoid(f.between(j.leg, j.foot, .3, 0, 0, .04), .045, .11, .03);
  }
  // The mask: a long pale skull-face, brow ridge, a jaw of teeth.
  f.soft(.02).on(BONE.Head, GROUP.HEAD).head().color(0x121216).ellipsoid(f.at(BONE.Head, 0, .115, -.015), .095, .11, .1);
  f.color(0xece8dc).ellipsoid(f.at(BONE.Head, 0, .12, .055), .098, .12, .07).box(f.at(BONE.Head, 0, .03, .085), .11, .06, .06, 0, 0, 0, .02)
    .box(f.at(BONE.Head, 0, .155, .11), .14, .028, .03, 0, .2, 0, .01);
  sockets(f, .125, .04, .115, 1);
  f.soft(.006).color(0x050505).carve().box(f.at(BONE.Head, 0, .045, .13), .085, .012, .05);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xf8f6f0);
  for (let i = -3; i <= 3; i++) { f.kit.cone(f.kit.at(BONE.Head, i * .013, .058, .12), f.kit.at(BONE.Head, i * .013, .036, .125), .006, 4); f.kit.cone(f.kit.at(BONE.Head, i * .013, .03, .12), f.kit.at(BONE.Head, i * .013, .048, .125), .006, 4); }
  eyes(f, mouthGlow ? 0xff2244 : 0xffd21a, .125, .04, .11, .016, .006);
  if (mouthGlow) f.kit.on(BONE.Head, GROUP.HEAD).color(0xff1a3a).glow(mouthGlow).ellipsoid(f.kit.at(BONE.Head, 0, .045, .115), .04, .008, .01).glow(0);
  claws(f, 0xe8e2d6, .12);
}

function greatWraith(f: Flesh) {
  // A great wraith: a black robe from shoulder to floor, a ring of spikes at the collar, the long pale nose.
  sculptBody(f, { bulk: 1.2, limb: 1.1, belly: 1.1, skin: 0x0a0a0e, top: 0x0a0a0e, bottom: 0x0a0a0e, boots: 0x0a0a0e, sleeves: 'long', legs: 'trousers' });
  f.soft(.06).on(BONE.Hips).color(0x0c0c10).capsule(f.at(BONE.Hips, 0, .1), f.at(BONE.Hips, 0, -.9), .19, .3);
  f.soft(.04).on(BONE.Head, GROUP.HEAD).head().color(0x0a0a0e).ellipsoid(f.at(BONE.Head, 0, .12), .12, .14, .12);
  f.color(0xece8dc).ellipsoid(f.at(BONE.Head, 0, .13, .06), .11, .12, .07);
  sockets(f, .15, .05, .115, 1.1);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xece8dc).cone(f.kit.at(BONE.Head, 0, .09, .1), f.kit.at(BONE.Head, 0, .06, .44), .035, 8);
  f.kit.on(BONE.Spine, GROUP.UPPER).color(0xe8e4dc);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; f.kit.cone(f.kit.at(BONE.Spine, Math.cos(a) * .15, .07, Math.sin(a) * .11), f.kit.at(BONE.Spine, Math.cos(a) * .3, .17, Math.sin(a) * .23), .026, 4); }
  eyes(f, 0xffd21a, .15, .05, .115, .018);
}

// ---- Last Sun ---------------------------------------------------------------------------------
function saibaman(f: Flesh) {
  sculptBody(f, { bulk: .9, limb: .85, belly: 1, skin: 0x4e8a3a, top: 0x4e8a3a, bottom: 0x3f7430, boots: 0x3f7430, sleeves: 'none', legs: 'bare', barefoot: true, neck: false, hunch: .5 });
  // The bulb of a head, ridged like a seed, and the grinning slit.
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0x3a6a2a).ellipsoid(f.at(BONE.Head, 0, .12, .015), .15, .145, .15);
  f.soft(.01).color(0x22401a);
  for (let i = -2; i <= 2; i++) f.carve().capsule(f.at(BONE.Head, i * .045, .27, -.02), f.at(BONE.Head, i * .06, .06, .16), .01, .01);
  sockets(f, .12, .06, .135, 1.3);
  f.soft(.008).color(0x0a1206).carve().box(f.at(BONE.Head, 0, .045, .15), .09, .012, .06);
  eyes(f, 0xff2a2a, .12, .06, .13, .024, -.01);
  claws(f, 0xd8e0c8, .09);
}

function jinlinSoldier(f: Flesh) {
  const skin = 0x8aa84a;
  sculptBody(f, { bulk: 1.05, limb: 1, belly: 1, skin, top: 0x362660, bottom: 0x362660, boots: 0xeeeeea, hands: 0xeeeeea, sleeves: 'long', legs: 'trousers' });
  // Battle armour: the white breastplate, and the yellow-tipped guards over the shoulders.
  f.soft(.015).on(BONE.Spine01, GROUP.UPPER).color(0xf0f0ec).capsule(f.at(BONE.Spine01, 0, -.03), f.at(BONE.Spine, 0, .05), .175, .19);
  f.on(BONE.Spine02, GROUP.UPPER).color(0x2a2a30).torus(f.at(BONE.Spine02, 0, .02), .15, .022);
  for (const s of [L, R]) {
    const j = side(s);
    f.soft(.012).on(j.arm, j.group).color(0xf0f0ec).ellipsoid(f.at(j.arm, s * .03, .06, 0), .1, .035, .09, 0, 0, s * -.25)
      .color(0xe0b820).ellipsoid(f.at(j.arm, s * .1, .05, 0), .05, .03, .08, 0, 0, s * -.35);
  }
  sculptHead(f, skin, 1.02);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xe0e0e0).box(f.kit.at(BONE.Head, .1, .12, .02), .03, .06, .08).color(0x3aff6a).glow(.8).box(f.kit.at(BONE.Head, .065, .12, .1), .06, .045, .01).glow(0);
  eyes(f, 0xff3a8a);
  const h = grip(f.kit, BONE.RightHand, .05);
  f.kit.on(BONE.RightHand, GROUP.ARM_R).color(0x40404a).box([h[0], h[1] + .02, h[2] + .08], .07, .07, .22);
}

function broodSpawn(f: Flesh) {
  sculptBody(f, { bulk: .88, limb: .88, belly: .9, skin: 0x3a6cb0, top: 0x1a2a4a, bottom: 0x3a6cb0, boots: 0x1a1a22, hands: 0x3a6cb0, sleeves: 'none', legs: 'bare', barefoot: true });
  f.soft(.015).on(BONE.Spine01, GROUP.UPPER).color(0x2a5a9a);
  for (let i = 0; i < 6; i++) { const a = i * 1.1; f.ellipsoid(f.at(BONE.Spine01, Math.cos(a) * .1, .06 + Math.sin(a) * .07, .1), .026, .026, .02); }
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0xcfdac6).ellipsoid(f.at(BONE.Head, 0, .105, .02), .09, .1, .095)
    .color(0x1a2a4a).capsule(f.at(BONE.Head, .05, .17, -.01), f.at(BONE.Head, .15, .34, -.09), .045, .012).capsule(f.at(BONE.Head, -.05, .17, -.01), f.at(BONE.Head, -.15, .34, -.09), .045, .012);
  sockets(f, .1, .035, .1, .9);
  eyes(f, 0xff4ad8, .1, .035, .095, .016);
  // The black wing-shell on its back.
  f.soft(.02).on(BONE.Spine, GROUP.UPPER).color(0x10161e).ellipsoid(f.at(BONE.Spine, .1, -.08, -.13), .1, .2, .04, 0, .2, .25).ellipsoid(f.at(BONE.Spine, -.1, -.08, -.13), .1, .2, .04, 0, .2, -.25);
}

// ---- Konta -----------------------------------------------------------------------------------
function whitePaleSapling(f: Flesh) {
  sculptBody(f, { bulk: .95, limb: .95, belly: .95, skin: 0xd6dacb, top: 0xd6dacb, bottom: 0xcdd1c0, boots: 0xc2c6b4, sleeves: 'none', legs: 'bare', barefoot: true, hunch: .2 });
  // Grown, not born: the wood it was grown from shows through the white as
  // ridges of bark down the trunk and the thighs, and knots where they part
  // (a smooth white body read as a shop's mannequin).
  f.soft(.012).color(0x7e846a);
  for (const a of [-.75, -.4, -.1, .22, .55, .85, 2.6, 3.0, 3.4, 3.75]) {
    const x = Math.sin(a), z = Math.cos(a), w = .018 + Math.abs(Math.sin(a * 3.7)) * .008;
    f.on(BONE.Spine01).capsule(f.at(BONE.Spine, x * .15, -.02, z * .14), f.at(BONE.Spine02, x * .155 + Math.sin(a * 5) * .02, .05, z * .15), w, w * .8);
  }
  for (const s of [L, R]) for (const a of [-.5, .4, 2.9]) f.on(s === L ? BONE.LeftUpLeg : BONE.RightUpLeg).capsule(f.at(s === L ? BONE.LeftUpLeg : BONE.RightUpLeg, Math.sin(a) * .085, -.04, Math.cos(a) * .085), f.at(s === L ? BONE.LeftLeg : BONE.RightLeg, Math.sin(a) * .07, .06, Math.cos(a) * .07), .016, .011);
  f.soft(.015).color(0x6e745c);
  for (const [bone, x, y, z] of [[BONE.Spine01, .08, .1, .13], [BONE.Spine02, -.1, .02, .13], [BONE.LeftArm, .12, .02, .04], [BONE.RightLeg, 0, -.1, .07]] as const) f.on(bone).ellipsoid(f.at(bone, x, y, z), .045, .035, .03);
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0xeef2ec).ellipsoid(f.at(BONE.Head, 0, .12, .01), .105, .13, .11);
  sockets(f, .12, .04, .1, 1.25);
  // The grin: wide and lipless, cut ear to ear, a row of small teeth in it.
  f.soft(.008).color(0x1a1e18).carve().box(f.at(BONE.Head, 0, .05, .11), .11, .02, .06);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xf6f2e2);
  for (let i = -5; i <= 5; i++) f.kit.cone(f.kit.at(BONE.Head, i * .0095, .061, .107 - Math.abs(i) * .002), f.kit.at(BONE.Head, i * .0095, .049, .109 - Math.abs(i) * .002), .0045, 4);
  eyes(f, 0xffe07a, .12, .04, .1, .02);
  kunai(f.kit, PALE_SAPLING_KUNAI);
}
interface Kunai { at: number; length: number; width: number; thickness: number; steel: number; ring: number; ringAt: number; ringRadius: number }
const PALE_SAPLING_KUNAI: Kunai = { at: .06, length: .17, width: .045, thickness: .008, steel: 0x2c2e34, ring: 0x6a5a44, ringAt: .03, ringRadius: .016 };
const NINJA_KUNAI: Kunai = { at: .07, length: .24, width: .055, thickness: .01, steel: 0x3a3a40, ring: 0x8a7a5a, ringAt: .04, ringRadius: .018 };
/** A kunai, reversed in the fist. */
function kunai(k: GruntKit, o: Kunai) {
  const h = grip(k, BONE.RightHand, o.at);
  k.on(BONE.RightHand, GROUP.ARM_R).color(o.steel).blade([h[0], h[1], h[2] + .02], [0, 0, 1], o.length, o.width, o.thickness, .45)
    .color(o.ring).torus([h[0], h[1], h[2] - o.ringAt], o.ringRadius, .005, [0, 0, 1], 4, 8);
}

function rogueNinja(f: Flesh) {
  sculptBody(f, { bulk: .95, limb: .95, belly: .95, skin: 0xd0a080, top: 0x1c2230, bottom: 0x1c2230, boots: 0x14161c, hands: 0x2a3040, sleeves: 'long', legs: 'trousers' });
  // The flak vest with its scroll pockets.
  f.soft(.012).on(BONE.Spine01, GROUP.UPPER).color(0x3a4a36).capsule(f.at(BONE.Spine01, 0, -.03), f.at(BONE.Spine, 0, .04), .168, .18);
  for (const s of [L, R]) f.on(BONE.Spine01, GROUP.UPPER).box(f.at(BONE.Spine01, s * .07, .02, .165), .06, .1, .04, 0, 0, 0, .01);
  sculptHead(f, 0xc08e6e);
  // The mask over the jaw; the headband, its plate scratched through.
  f.soft(.012).on(BONE.Head, GROUP.HEAD).head().color(0x1a1e2a).ellipsoid(f.at(BONE.Head, 0, .045, .05), .075, .055, .07).torus(f.at(BONE.Head, 0, .16, -.005), .1, .018);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xb8c0cc).box(f.kit.at(BONE.Head, 0, .16, .1), .1, .04, .012).color(0x151515).box(f.kit.at(BONE.Head, 0, .16, .107), .1, .005, .004);
  eyes(f, 0xff3a2a);
  kunai(f.kit, NINJA_KUNAI);
}

// ---- Boar-men ----------------------------------------------------------------------------------
function tusker(f: Flesh) {
  const skin = 0x5e7e34;
  sculptBody(f, { bulk: 1.4, limb: 1.2, belly: 1.45, skin, top: skin, bottom: 0x4a3a2a, boots: 0x3a2a1a, sleeves: 'none', legs: 'trousers', hunch: .35 });
  // Leather harness, a spiked collar.
  f.soft(.01).on(BONE.Spine01, GROUP.UPPER).color(0x4a3420).capsule(f.at(BONE.Spine, .16, .05, 0), f.at(BONE.Spine02, -.13, -.02, .02), .022, .022).capsule(f.at(BONE.Spine, -.16, .05, 0), f.at(BONE.Spine02, .13, -.02, .02), .022, .022);
  f.on(BONE.neck, GROUP.UPPER).color(0x3a2a18).torus(f.at(BONE.neck, 0, 0, .01), .085, .025);
  // The pig's head: jowls, a snout, tusks, small horns.
  f.soft(.035).on(BONE.Head, GROUP.HEAD).head().color(0x587630).ellipsoid(f.at(BONE.Head, 0, .1, .03), .13, .12, .13)
    .ellipsoid(f.at(BONE.Head, 0, .05, .1), .1, .07, .08).ellipsoid(f.at(BONE.Head, 0, .065, .16), .065, .05, .05)
    .color(0x3a4a20).ellipsoid(f.at(BONE.Head, 0, .065, .2), .045, .035, .02);
  sockets(f, .14, .05, .12, 1);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0xe8e0c8).cone(f.kit.at(BONE.Head, .045, .02, .15), f.kit.at(BONE.Head, .065, .11, .19), .015, 5).cone(f.kit.at(BONE.Head, -.045, .02, .15), f.kit.at(BONE.Head, -.065, .11, .19), .015, 5)
    .color(0x4a3a2a).cone(f.kit.at(BONE.Head, .08, .2), f.kit.at(BONE.Head, .12, .29, -.03), .025, 5).cone(f.kit.at(BONE.Head, -.08, .2), f.kit.at(BONE.Head, -.12, .29, -.03), .025, 5);
  eyes(f, 0xff5a1a, .14, .05, .125, .015);
  axe(f.kit);
}
/** A long-hafted axe. */
function axe(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .08);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x5a3a22).limb([h[0], h[1] - .02, h[2] - .25], [h[0], h[1] + .05, h[2] + .72], .026, .026, 7)
    .color(0x8e949c).blade([h[0], h[1] + .04, h[2] + .56], [0, 1, .15], .32, .3, .03, .3, [0, 0, 1]);
}

function skiffGuard(f: Flesh) {
  sculptBody(f, { bulk: 1, limb: 1, belly: 1, skin: 0x8a6a4a, top: 0x5a4a3a, bottom: 0x4a3a2a, boots: 0x2a1e14, sleeves: 'long', legs: 'trousers' });
  f.soft(.012).on(BONE.Spine01, GROUP.UPPER).color(0x6a5a44).capsule(f.at(BONE.Spine, .17, .06, 0), f.at(BONE.Spine02, -.14, 0, .02), .03, .03);
  // A head wrapped in cloth bands to the eyes, a leather cap over it.
  f.soft(.02).on(BONE.Head, GROUP.HEAD).head().color(0x7a5a3a).ellipsoid(f.at(BONE.Head, 0, .11, .01), .1, .12, .11);
  for (let i = 0; i < 4; i++) f.soft(.006).color(i % 2 ? 0x8a6a48 : 0x6a4c30).torus(f.at(BONE.Head, 0, .03 + i * .03, .012), .098 - i * .004, .012);
  f.soft(.015).color(0x4a3a28).capsule(f.at(BONE.Head, 0, .19, -.01), f.at(BONE.Head, 0, .23, -.015), .105, .08);
  sockets(f, .12, .038, .105, 1);
  eyes(f, 0xff7a1a, .12, .038, .1);
  blaster(f.kit);
}
/** A blaster rifle, its barrel forward. */
function blaster(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x2a2a2e).box([h[0], h[1] + .02, h[2] + .1], .05, .08, .38).color(0x6a6a70).limb([h[0], h[1] + .04, h[2] + .28], [h[0], h[1] + .04, h[2] + .5], .014, .014, 6);
}

// ---- The Rift's own ----------------------------------------------------------------------------
function husk(f: Flesh) {
  // The damned: starved, grey-black, in rags, faceless but for the burn.
  sculptBody(f, { bulk: .82, limb: .8, belly: .75, skin: 0x2a2628, top: 0x2a2628, bottom: 0x2a2424, boots: 0x1a1616, sleeves: 'none', legs: 'bare', barefoot: true, starved: true, hunch: .7 });
  // A rag of a loincloth, a torn strip over one shoulder.
  f.soft(.01).on(BONE.Hips).color(0x3a3028).capsule(f.at(BONE.Hips, 0, .02, .02), f.at(BONE.Hips, 0, -.22, .07), .15, .08);
  f.on(BONE.Spine, GROUP.UPPER).capsule(f.at(BONE.Spine, .14, .06, 0), f.at(BONE.Spine02, -.12, -.03, .02), .026, .02);
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0x1c1a1c).ellipsoid(f.at(BONE.Head, 0, .11, 0), .09, .115, .1).ellipsoid(f.at(BONE.Head, 0, .04, .04), .06, .05, .06);
  sockets(f, .11, .035, .09, 1.05);
  f.soft(.008).color(0x050303).carve().ellipsoid(f.at(BONE.Head, 0, .03, .1), .035, .03, .03);
  eyes(f, 0xff2a10, .11, .035, .088, .016);
  claws(f, 0x1a1414, .1);
}

function apostleSpawn(f: Flesh) {
  // A lesser demon: swollen, horned, spined, its maw lit from inside.
  sculptBody(f, { bulk: 1.55, limb: 1.4, belly: 1.3, skin: 0x561c1c, top: 0x561c1c, bottom: 0x381212, boots: 0x280c0c, sleeves: 'none', legs: 'bare', barefoot: true, hunch: .6 });
  // Tumorous growths on the shoulders and back.
  f.soft(.04).on(BONE.Spine, GROUP.UPPER).color(0x6a2222).ellipsoid(f.at(BONE.Spine, .16, .06, -.08), .1, .09, .09).ellipsoid(f.at(BONE.Spine, -.14, .02, -.1), .08, .08, .08).ellipsoid(f.at(BONE.Spine01, .04, .02, -.14), .09, .08, .06);
  f.kit.on(BONE.Spine, GROUP.UPPER).color(0x1a0a0a);
  for (let i = 0; i < 7; i++) f.kit.cone(f.kit.at(BONE.Spine02, 0, .02 + i * .065, -.12), f.kit.at(BONE.Spine02, 0, .1 + i * .07, -.34), .035, 5);
  f.soft(.04).on(BONE.Head, GROUP.HEAD).head().color(0x4a1616).ellipsoid(f.at(BONE.Head, 0, .1, .03), .13, .12, .14).ellipsoid(f.at(BONE.Head, 0, .04, .1), .1, .06, .08);
  sockets(f, .13, .055, .13, 1.2);
  f.soft(.01).color(0x2a0404).carve().box(f.at(BONE.Head, 0, .03, .17), .12, .03, .06);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0x150808).cone(f.kit.at(BONE.Head, .08, .18), f.kit.at(BONE.Head, .26, .4, .05), .045, 6).cone(f.kit.at(BONE.Head, -.08, .18), f.kit.at(BONE.Head, -.26, .4, .05), .045, 6)
    .color(0xff7a1a).glow(.8).ellipsoid(f.kit.at(BONE.Head, 0, .03, .165), .06, .014, .02).glow(0);
  f.kit.color(0xe8dcc0);
  for (let i = -3; i <= 3; i++) f.kit.cone(f.kit.at(BONE.Head, i * .016, .046, .17), f.kit.at(BONE.Head, i * .016, .02, .175), .007, 4);
  eyes(f, 0xffd01a, .13, .055, .14, .022, .01);
  claws(f, 0x1a0a0a, .16);
}

export const FLESH_LOOKS: Record<string, Sculptor> = {
  'tribunal-guard': f => { guard(f); cutlass(f.kit); },
  'tribunal-guard-rifle': f => { guard(f); musket(f.kit); },
  automaton,
  'beast-pirate': beastPirate,
  'chess-soldier': chessSoldier,
  'beast-graft-brute': beastGraftBrute,
  'ash-wraith': f => wraithBase(f),
  'hollow-void-ray': f => wraithBase(f, .9),
  greatWraith,
  saibaman,
  'jinlin-soldier': jinlinSoldier,
  'brood-spawn': broodSpawn,
  'white-pale-sapling': whitePaleSapling,
  'rogue-ninja': rogueNinja,
  tusker,
  'skiff-guard': skiffGuard,
  husk,
  'apostle-spawn': apostleSpawn,
};

/** What a kind carries in its hands, for a generated model (modelLooks.ts):
 *  the same arms its sculpt holds, laid on the model's own rest pose. */
// ---- The fifth list's gear: what tells the new kinds from the bodies they wear -------------
/** A round shield strapped to the left forearm, face forward (GROUP.GEAR: it can be broken off). */
function roundShield(k: GruntKit, face: number, rim: number, boss: number, radius = .3) {
  const c = k.between(BONE.LeftForeArm, BONE.LeftHand, .4, 0, 0, .1);
  k.on(BONE.LeftForeArm, GROUP.GEAR).color(face).revolve([c[0], c[1], c[2] - .025], [c[0], c[1], c[2] + .035], [[0, radius * .96], [.4, radius], [.75, radius * .7], [1, 0]], 18)
    .color(rim).torus([c[0], c[1], c[2] - .01], radius, .022, [0, 0, 1], 5, 20)
    .color(boss).ellipsoid([c[0], c[1], c[2] + .045], radius * .22, radius * .22, .03);
}
/** A tower shield: a tall slab on the left forearm. */
function towerShield(k: GruntKit, face: number, trim: number) {
  const c = k.between(BONE.LeftForeArm, BONE.LeftHand, .4, 0, -.08, .11);
  k.on(BONE.LeftForeArm, GROUP.GEAR).color(face).box(c, .46, .86, .045, 0, 0, 0, .12)
    .color(trim).box([c[0], c[1], c[2] + .03], .1, .7, .02).box([c[0], c[1] + .12, c[2] + .03], .36, .07, .02);
}
/** A long rifle, a sniper's: a longer barrel and a scope. */
function longRifle(k: GruntKit, stock: number, barrel: number, scope: number, glow = 0) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(stock).box([h[0], h[1] - .02, h[2] - .14], .05, .075, .52, 0, .05)
    .color(barrel).limb([h[0], h[1] + .015, h[2] + .1], [h[0], h[1] + .025, h[2] + 1.18], .018, .015, 7)
    .color(scope).glow(glow).limb([h[0], h[1] + .08, h[2] + .02], [h[0], h[1] + .08, h[2] + .3], .026, .022, 8).glow(0);
}
/** A healer's staff with a glowing head. */
function staff(k: GruntKit, wood: number, head: number, crook = false) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(wood).limb([h[0], h[1] - .5, h[2] + .02], [h[0], h[1] + .95, h[2] + .02], .018, .016, 7);
  if (crook) k.color(0xe8e0c8).torus([h[0], h[1] + 1.02, h[2] + .1], .1, .018, [1, 0, 0], 5, 14);
  k.color(head).glow(1).ellipsoid([h[0], h[1] + (crook ? .9 : 1.02), h[2] + .02], .07, .07, .07).glow(0);
}
/** Glowing hands: a medic's chi, a caller's rift. */
function glowingHands(k: GruntKit, color: number, size = .06) {
  for (const hand of [BONE.LeftHand, BONE.RightHand]) k.on(hand, hand === BONE.LeftHand ? GROUP.ARM_L : GROUP.ARM_R).color(color).glow(1).ellipsoid(grip(k, hand, .06), size, size, size).glow(0);
}

export const ARMS: Partial<Record<string, (k: GruntKit) => void>> = {
  'tribunal-guard-shield': k => { cutlass(k); towerShield(k, 0x34302c, 0x34302c); },
  'tribunal-guard-sniper': k => longRifle(k, 0x5a3a22, 0x2c2c30, 0x1a1a1e),
  'beast-leaper': falchion,
  'beast-medic': k => staff(k, 0x3a2418, 0x5aff8a),
  'chess-rook': k => { pike(k); towerShield(k, 0x1a1a1e, 0xe8e0d0); },
  'chess-bishop': k => staff(k, 0x1a1a1e, 0xfff2a0, true),
  'hollow-caller': k => glowingHands(k, 0xa040ff, .08),
  'jinlin-sniper': k => longRifle(k, 0x4a1612, 0x8a6a3a, 0xff8a2a, 1),
  'medic-ninja': k => glowingHands(k, 0x5aff8a),
  'summoner-ninja': k => { kunai(k, NINJA_KUNAI); glowingHands(k, 0xff8a2a, .05); },
  'tusker-shield': k => { axe(k); roundShield(k, 0x6a4a2a, 0x3a2a1a, 0x9aa0a8, .36); },
  'skiff-sniper': k => longRifle(k, 0x2a2a2e, 0x6a6a70, 0xff4a2a, 1),
  'husk-priest': k => staff(k, 0x1a1414, 0xb040ff),
  'tribunal-guard': k => cutlass(k),
  'tribunal-guard-rifle': musket,
  'beast-pirate': falchion,
  'chess-soldier': pike,
  'beast-graft-brute': mastBreaker,
  'white-pale-sapling': k => kunai(k, PALE_SAPLING_KUNAI),
  'rogue-ninja': k => kunai(k, NINJA_KUNAI),
  tusker: axe,
  'skiff-guard': blaster,
};

/** The sculpting grid step, metres: finer is rounder and costs triangles. */
export const FLESH_CELL = { value: .036 };

/** A kind's body sculpted, or undefined when it has no sculpt. */
export function sculptLook(kind: string, rest: readonly THREE.Vector3[], cell = FLESH_CELL.value): THREE.BufferGeometry | undefined {
  const sculptor = FLESH_LOOKS[kind];
  if (!sculptor) return undefined;
  const f = new Flesh(rest);
  sculptor(f);
  return f.build({ cell });
}
