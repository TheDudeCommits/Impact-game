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

// ---- Dust Sea: the Salt Court ----------------------------------------------------------------
// Every code-built look below is drawn after the kind's own model (src/originals/survival.ts MODES_HORDES / OWN_GRUNT_MODELS),
// for when a model is off (?nomodels) or fails to load.
const SALT = 0xc4baa2, SALT_DARK = 0xa49a82, SALT_CRUST = 0xeee8d8;
function saltGuard(f: Flesh, bandolier = false) {
  sculptBody(f, { bulk: 1.05, limb: 1, belly: 1, skin: 0x6e5a4c, top: SALT, bottom: SALT_DARK, boots: 0x5a4a38, hands: 0x6e5a4c, sleeves: 'long', legs: 'trousers', hunch: .3 });
  // The robe to the shins, torn at the hem.
  f.soft(.05).on(BONE.Hips).color(SALT_DARK).capsule(f.at(BONE.Hips, 0, .06, .01), f.at(BONE.Hips, 0, -.7, .02), .18, .25);
  f.kit.on(BONE.Hips).color(0x8a8068);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; f.kit.cone(f.kit.at(BONE.Hips, Math.cos(a) * .23, -.62, Math.sin(a) * .2), f.kit.at(BONE.Hips, Math.cos(a) * .25, -.8, Math.sin(a) * .22), .04, 4); }
  // Salt crusted on the chest and the skirts; the rope belt.
  f.soft(.008).on(BONE.Spine01, GROUP.UPPER).color(SALT_CRUST);
  for (const [x, y] of [[.08, .06], [-.06, .1], [.02, -.02], [-.1, -.04]]) f.ellipsoid(f.at(BONE.Spine01, x, y, .15), .035, .025, .015);
  f.soft(.01).on(BONE.Hips).color(0x6a5236).torus(f.at(BONE.Hips, 0, .09, .004), .16, .018);
  f.kit.on(BONE.Hips).color(0x6a5236).limb(f.kit.at(BONE.Hips, .06, .08, .15), f.kit.at(BONE.Hips, .08, -.2, .17), .012, .01, 5);
  // The cowl over the head and shoulders.
  f.soft(.03).on(BONE.Spine, GROUP.UPPER).color(SALT).ellipsoid(f.at(BONE.Spine, 0, .1, -.02), .21, .08, .16);
  f.soft(.025).on(BONE.Head, GROUP.HEAD).head().color(SALT).ellipsoid(f.at(BONE.Head, 0, .12, -.03), .125, .145, .13);
  // The mask: a plain disc of iron, two eye holes; the eyes burn through.
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0x3c3c40).ellipsoid(f.kit.at(BONE.Head, 0, .115, .1), .085, .1, .022, 6, 14).color(0x0a0a0c)
    .ellipsoid(f.kit.at(BONE.Head, .033, .125, .118), .016, .011, .006, 4, 8).ellipsoid(f.kit.at(BONE.Head, -.033, .125, .118), .016, .011, .006, 4, 8);
  eyes(f, 0xff5a2a, .125, .033, .121, .012);
  // Wrapped shins.
  for (const s of [L, R]) { const j = side(s); for (let i = 0; i < 3; i++) f.soft(.006).on(j.leg).color(0x8a7a5e).torus(f.between(j.leg, j.foot, .35 + i * .18), .06, .012); }
  if (bandolier) {
    f.soft(.008).on(BONE.Spine01, GROUP.UPPER).color(0x4a3220).capsule(f.at(BONE.Spine, .14, .06, .12), f.at(BONE.Spine02, -.13, -.02, .14), .02, .02);
    f.kit.on(BONE.Spine01, GROUP.UPPER).color(0xb08a3a);
    for (let i = 0; i < 5; i++) { const t = i / 4; const a = f.kit.between(BONE.Spine, BONE.Spine02, t, .12 - t * .24, .02, .15); f.kit.box(a, .02, .04, .02); }
    f.soft(.01).on(BONE.Hips).color(0x4a3220).box(f.at(BONE.Hips, -.15, .02, .06), .08, .1, .06, 0, 0, 0, .01);
  }
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

function saltEngine(f: Flesh) {
  // A cast-iron executioner engine: riveted plates streaked with salt, a box head whose face is a furnace grate, huge forearms.
  sculptBody(f, { bulk: 1.6, limb: 1.4, belly: 1.1, skin: 0x2e2a28, top: 0x34302c, bottom: 0x2e2a28, boots: 0x1c1a18, hands: 0x3a3632, sleeves: 'long', legs: 'trousers', hunch: .25 });
  f.soft(.01).on(BONE.Head, GROUP.HEAD).head().color(0x3a3430).box(f.at(BONE.Head, 0, .12, 0), .25, .27, .24, 0, 0, 0, .025);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0x141210).box(k.at(BONE.Head, 0, .11, .125), .19, .17, .02, 0, 0, 0, .1).color(0xff7a1a).glow(.9);
  for (let i = 0; i < 4; i++) k.box(k.at(BONE.Head, 0, .05 + i * .04, .13), .16, .012, .012, 0, 0, 0, .2);
  k.glow(0);
  // The plates and their rivets; salt down the seams.
  f.soft(.012).on(BONE.Spine01, GROUP.UPPER).color(0x4a403a).box(f.at(BONE.Spine01, 0, .04, .16), .3, .26, .05, 0, 0, 0, .02);
  k.on(BONE.Spine01, GROUP.UPPER).color(0x8a7a6a);
  for (const [x, y] of [[-.13, .15], [.13, .15], [-.13, -.07], [.13, -.07], [0, .15]]) k.ellipsoid(k.at(BONE.Spine01, x, y, .19), .014, .014, .01, 4, 6);
  f.soft(.006).color(0xd8d2c4).capsule(f.at(BONE.Spine01, .06, .14, .19), f.at(BONE.Spine01, .07, -.08, .19), .01, .006);
  for (const s of [L, R]) {
    const j = side(s);
    f.soft(.02).on(j.arm, j.group).color(0x4a403a).ellipsoid(f.at(j.arm, s * .02, .06, 0), .12, .08, .11);
    f.soft(.02).on(j.fore, j.group).color(0x3e3834).capsule(f.at(j.fore, s * .02, 0, 0), f.at(j.hand, -s * .02, 0, 0), .085, .1);
    for (let i = 0; i < 3; i++) f.soft(.006).color(0x24201e).torus(f.between(j.fore, j.hand, .2 + i * .28), .095, .012, 0, 0, Math.PI / 2);
  }
}

// ---- Dust Sea: the Stitched Grafters ----------------------------------------------------------
function graftRaider(f: Flesh) {
  // A ram's skull stitched over his face, a crab's claw sewn on for a left arm, a dust scarf and a ragged tunic.
  sculptBody(f, { bulk: 1.1, limb: 1.05, belly: 1, skin: 0x8a6a50, top: 0x8a7454, bottom: 0x5e4c38, boots: 0x3a2a1e, sleeves: 'short', legs: 'trousers' });
  f.soft(.05).on(BONE.Hips).color(0x7a664a).capsule(f.at(BONE.Hips, 0, .05, .01), f.at(BONE.Hips, 0, -.36, .02), .17, .21);
  f.soft(.025).on(BONE.Spine, GROUP.UPPER).color(0xa08a66).torus(f.at(BONE.Spine, 0, .1, -.01), .12, .045);
  f.soft(.02).on(BONE.Head, GROUP.HEAD).head().color(0xa08a66).ellipsoid(f.at(BONE.Head, 0, .12, -.05), .12, .13, .1);
  f.soft(.015).color(0xe6dcc4).ellipsoid(f.at(BONE.Head, 0, .11, .055), .085, .1, .075).ellipsoid(f.at(BONE.Head, 0, .05, .12), .045, .05, .05);
  sockets(f, .12, .036, .12, 1);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0xcfc2a2).torus(k.at(BONE.Head, .11, .13, -.01), .055, .02, [1, 0, 0], 5, 14).torus(k.at(BONE.Head, -.11, .13, -.01), .055, .02, [1, 0, 0], 5, 14);
  eyes(f, 0xffb020, .12, .036, .118);
  // The rusted plate over the right shoulder; the claw on the left.
  f.soft(.012).on(BONE.RightArm, GROUP.ARM_R).color(0x7a4a2a).ellipsoid(f.at(BONE.RightArm, -.02, .06, 0), .09, .04, .09);
  f.soft(.02).on(BONE.LeftForeArm, GROUP.ARM_L).color(0x9a3e24).capsule(f.at(BONE.LeftForeArm, .02, 0, 0), f.at(BONE.LeftHand, 0, 0, 0), .07, .085);
  const c = grip(k, BONE.LeftHand, .02);
  k.on(BONE.LeftHand, GROUP.ARM_L).color(0xa8482a).blade([c[0], c[1] + .03, c[2]], [1, .25, 0], .3, .12, .05, .5, [0, 0, 1])
    .color(0x8a3820).blade([c[0], c[1] - .03, c[2]], [1, -.15, 0], .22, .08, .04, .5, [0, 0, 1]);
  falchion(k);
}
/** A heavy curved blade. */
function falchion(k: GruntKit) {
  const p = grip(k, BONE.RightHand, .07, -.012, .01);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x3a2a1a).limb([p[0], p[1], p[2] - .05], [p[0], p[1], p[2] + .06], .018, .018, 6).color(0xa0a6b0).blade([p[0], p[1], p[2] + .07], [0, .3, 1], .7, .11, .014, .3);
}

function ironWarden(f: Flesh) {
  // An undead pike guard of a ruined fortress: blackened plate over rusted mail, a flat-topped bucket helm with a slit and a
  // horsehair plume, a torn oxblood surcoat.
  sculptBody(f, { bulk: 1, limb: 1, belly: .95, skin: 0x3a3634, top: 0x2a2a2c, bottom: 0x4a4440, boots: 0x1e1e20, hands: 0x2a2a2c, sleeves: 'long', legs: 'trousers' });
  f.soft(.012).on(BONE.Spine01, GROUP.UPPER).color(0x5a1a1a).box(f.at(BONE.Spine01, 0, -.04, .14), .26, .36, .03, 0, 0, 0, .01).box(f.at(BONE.Spine01, 0, -.04, -.13), .26, .36, .03, 0, 0, 0, .01);
  f.soft(.02).on(BONE.Hips).color(0x5a1a1a).capsule(f.at(BONE.Hips, 0, .02, .01), f.at(BONE.Hips, 0, -.42, .02), .17, .2);
  f.kit.on(BONE.Hips).color(0x3a1010);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; f.kit.cone(f.kit.at(BONE.Hips, Math.cos(a) * .19, -.38, Math.sin(a) * .17), f.kit.at(BONE.Hips, Math.cos(a) * .2, -.52, Math.sin(a) * .18), .035, 4); }
  for (const s of [L, R]) { const j = side(s); f.soft(.014).on(j.arm, j.group).color(0x232325).ellipsoid(f.at(j.arm, s * .02, .06, 0), .1, .06, .1); }
  f.soft(.008).on(BONE.Spine01, GROUP.UPPER).color(0x6a3a22);
  for (const [x, y] of [[.1, .1], [-.08, -.02]]) f.ellipsoid(f.at(BONE.Spine01, x, y, .158), .03, .02, .01);
  f.soft(.01).on(BONE.Head, GROUP.HEAD).head().color(0x2a2a2c).box(f.at(BONE.Head, 0, .13, 0), .22, .27, .23, 0, 0, 0, .03);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0x080808).box(k.at(BONE.Head, 0, .13, .118), .16, .022, .01, 0, 0, 0, .2).color(0xd8d2c0);
  for (let i = 0; i < 5; i++) k.cone(k.at(BONE.Head, (i - 2) * .02, .27, -.02), k.at(BONE.Head, (i - 2) * .03, .2, -.3), .02, 4);
  eyes(f, 0xff4020, .13, .03, .12, .01);
  pike(k);
}
/** The pike, carried forward like the rifles. */
function pike(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x2a1a10).limb([h[0], h[1] + .01, h[2] - .45], [h[0], h[1] + .02, h[2] + 1.15], .017, .015, 6)
    .color(0xb0b6c0).blade([h[0], h[1] + .02, h[2] + 1.13], [0, 0, 1], .3, .05, .012);
}

function graftBrute(f: Flesh) {
  // A bull's horned head with a rhino's horn on a bear's furred body, sewn with black thread, broken manacles, a leather kilt.
  sculptBody(f, { bulk: 1.6, limb: 1.45, belly: 1.25, skin: 0x4a3a30, top: 0x4a3a30, bottom: 0x3a2a1e, boots: 0x2a2018, sleeves: 'none', legs: 'bare', barefoot: true, hunch: .5 });
  f.soft(.04).on(BONE.Spine, GROUP.UPPER).color(0x3a2c22).ellipsoid(f.at(BONE.Spine, .17, .07, -.04), .12, .1, .12).ellipsoid(f.at(BONE.Spine, -.17, .07, -.04), .12, .1, .12).ellipsoid(f.at(BONE.Spine, 0, .05, -.14), .2, .12, .08);
  f.soft(.03).on(BONE.Hips).color(0x5a3e28).capsule(f.at(BONE.Hips, 0, .05, .01), f.at(BONE.Hips, 0, -.34, .02), .2, .24);
  f.soft(.04).on(BONE.Head, GROUP.HEAD).head().color(0x3e2e24).ellipsoid(f.at(BONE.Head, 0, .12, .01), .12, .115, .125)
    .ellipsoid(f.at(BONE.Head, 0, .07, .12), .085, .07, .08).color(0x1e1610).ellipsoid(f.at(BONE.Head, 0, .06, .19), .06, .045, .02);
  sockets(f, .13, .06, .1, 1.1);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0xd8ccb0).cone(k.at(BONE.Head, .1, .17), k.at(BONE.Head, .28, .2, .1), .042, 7).cone(k.at(BONE.Head, -.1, .17), k.at(BONE.Head, -.28, .2, .1), .042, 7)
    .color(0xcabfa0).cone(k.at(BONE.Head, 0, .1, .17), k.at(BONE.Head, 0, .25, .25), .035, 7);
  eyes(f, 0xff4a1a, .13, .06, .115, .018);
  k.on(BONE.Spine01, GROUP.UPPER).color(0x0e0a08);
  for (let i = 0; i < 6; i++) k.box(k.at(BONE.Spine01, -.12 + i * .05, .12 - i * .03, .19), .006, .04, .006, 0, 0, .6);
  for (const s of [L, R]) { const j = side(s); k.on(j.hand, j.group).color(0x6a4a30).torus(grip(k, j.hand, -.04), .07, .02, [1, 0, 0], 5, 12).color(0x5a5048).torus(grip(k, j.hand, -.04, -.08), .025, .008, [0, 0, 1], 4, 8); }
  mastBreaker(k);
}
/** A heavy spiked iron club. */
function mastBreaker(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .08);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x2e2624).limb([h[0], h[1], h[2] - .06], [h[0], h[1] + .08, h[2] + .95], .04, .1, 9);
  k.color(0x7a7a80);
  for (let i = 0; i < 9; i++) { const t = .32 + i * .075, a = i * 2.1; k.cone([h[0], h[1] + .08 * t, h[2] + .95 * t], [h[0] + Math.cos(a) * .15, h[1] + .08 * t + Math.sin(a) * .15, h[2] + .95 * t], .026, 4); }
}

// ---- Cinder Requiem: the ash wraiths -----------------------------------------------------------------------
/** Violet light in the cracks of an ash body: glowing slivers on a bone. */
function cracks(f: Flesh, bone: number, group: number | undefined, color: number, spots: readonly (readonly [number, number, number, number])[]) {
  f.kit.on(bone, group).color(color).glow(.8);
  for (const [x, y, z, roll] of spots) f.kit.box(f.kit.at(bone, x, y, z), .008, .07, .006, 0, 0, roll, .3);
  f.kit.glow(0);
}
function ashWraith(f: Flesh, caster = false, scale = 1) {
  // A tall gaunt ghoul of grey ash, ribs and spine under cracked skin, violet light deep in the cracks; a hood and mantle of
  // burnt cloth; long black hooked claws; its face its own. The caster: a tattered robe and a ragged high collar, two charred
  // antler-horns, violet sigils down its cheeks, chains on its forearms.
  sculptBody(f, { bulk: .85 * scale, limb: .85 * scale, belly: .75, skin: 0x6a6660, top: 0x6a6660, bottom: 0x3a3634, boots: 0x3a3634, sleeves: 'none', legs: 'bare', barefoot: true, starved: true, hunch: .55 });
  cracks(f, BONE.Spine01, GROUP.UPPER, 0xa050ff, [[.06, .05, .13, .4], [-.08, .1, .12, -.3], [.02, -.06, .14, .1]]);
  for (const s of [L, R]) { const j = side(s); cracks(f, j.arm, j.group, 0xa050ff, [[s * .05, .0, .03, .5]]); }
  sculptHead(f, 0x5a5650, 1, .95, true);
  f.soft(.025).on(BONE.Head, GROUP.HEAD).head().color(0x2a2624).ellipsoid(f.at(BONE.Head, 0, .14, -.04), .12, .13, .12);
  f.soft(.03).on(BONE.Spine, GROUP.UPPER).color(0x2a2624).ellipsoid(f.at(BONE.Spine, 0, .07, -.03), .22, .08, .16);
  eyes(f, 0xc080ff, .108, .036, .095, .014);
  claws(f, 0x0e0c0c, .15);
  if (!caster) return;
  f.soft(.05).on(BONE.Hips).color(0x34302c).capsule(f.at(BONE.Hips, 0, .06, .01), f.at(BONE.Hips, 0, -.72, .02), .17, .25);
  const k = f.kit;
  k.on(BONE.Spine, GROUP.UPPER).color(0x2a2624);
  for (let i = 0; i < 8; i++) { const a = Math.PI * (.15 + i / 7 * .7) + Math.PI; k.cone(k.at(BONE.Spine, Math.cos(a) * .12, .12, Math.sin(a) * -.1), k.at(BONE.Spine, Math.cos(a) * .17, .3, Math.sin(a) * -.14), .03, 4); }
  k.on(BONE.Head, GROUP.HEAD).head().color(0x2a201a);
  for (const s of [1, -1]) {
    k.cone(k.at(BONE.Head, s * .06, .2, -.02), k.at(BONE.Head, s * .16, .38, -.08), .02, 5);
    k.cone(k.at(BONE.Head, s * .12, .3, -.05), k.at(BONE.Head, s * .2, .34, .02), .012, 4);
  }
  k.color(0xa050ff).glow(.8);
  for (const s of [1, -1]) k.box(k.at(BONE.Head, s * .05, .07, .095), .006, .05, .004, 0, 0, s * .2, .3);
  k.glow(0);
  for (const s of [L, R]) { const j = side(s); for (let i = 0; i < 3; i++) f.soft(.006).on(j.fore, j.group).color(0x5a4a6a).torus(f.between(j.fore, j.hand, .2 + i * .25), .05, .01, 0, 0, Math.PI / 2); }
}

// ---- Last Sun: the Sunburnt Legion ------------------------------------------------------------------
function cinderImp(f: Flesh) {
  // A small hunched imp of cracked charred skin, molten light in every crack and a bright belly, like a coal about to burst;
  // big pointed ears, yellow eyes, long clawed arms.
  sculptBody(f, { bulk: .9, limb: .95, belly: 1.2, skin: 0x2a1a14, top: 0x2a1a14, bottom: 0x2a1a14, boots: 0x2a1a14, sleeves: 'none', legs: 'bare', barefoot: true, neck: false, hunch: .6 });
  f.kit.on(BONE.Spine02, GROUP.UPPER).color(0xffa040).glow(.9).ellipsoid(f.kit.at(BONE.Spine02, 0, .02, .14), .09, .1, .03, 5, 10).glow(0);
  cracks(f, BONE.Spine01, GROUP.UPPER, 0xff6a1a, [[.08, .08, .13, .5], [-.07, .02, .14, -.4], [.0, .12, .12, .1]]);
  for (const s of [L, R]) { const j = side(s); cracks(f, j.arm, j.group, 0xff6a1a, [[s * .06, 0, .03, .3]]); cracks(f, j.up, undefined, 0xff6a1a, [[0, -.1, .07, .2]]); }
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0x2a1a14).ellipsoid(f.at(BONE.Head, 0, .11, .02), .11, .1, .11).ellipsoid(f.at(BONE.Head, 0, .05, .09), .06, .045, .05);
  sockets(f, .12, .045, .115, 1.15);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0x22140f);
  for (const s of [1, -1]) f.kit.cone(f.kit.at(BONE.Head, s * .09, .13, -.01), f.kit.at(BONE.Head, s * .25, .2, -.07), .035, 5);
  eyes(f, 0xffd02a, .12, .045, .11, .02, -.008);
  claws(f, 0x1a0e0a, .15);
}

function sunTrooper(f: Flesh) {
  // Cracked dark red ceramic plate with bronze trim over a black bodysuit; a round bronze sun-disc over the whole face.
  sculptBody(f, { bulk: 1.05, limb: 1, belly: 1, skin: 0x1a1416, top: 0x121014, bottom: 0x121014, boots: 0x5a1a14, hands: 0x121014, sleeves: 'long', legs: 'trousers' });
  f.soft(.015).on(BONE.Spine01, GROUP.UPPER).color(0x6a1c16).capsule(f.at(BONE.Spine01, 0, -.03), f.at(BONE.Spine, 0, .05), .175, .19);
  f.on(BONE.Spine02, GROUP.UPPER).color(0xa07a3a).torus(f.at(BONE.Spine02, 0, .02), .15, .016);
  for (const s of [L, R]) {
    const j = side(s);
    f.soft(.012).on(j.arm, j.group).color(0x6a1c16).ellipsoid(f.at(j.arm, s * .03, .06, 0), .1, .04, .09, 0, 0, s * -.25);
    f.soft(.01).on(j.leg).color(0x6a1c16).capsule(f.between(j.leg, j.foot, .15, 0, 0, .03), f.between(j.leg, j.foot, .7, 0, 0, .03), .045, .04);
  }
  f.soft(.02).on(BONE.Head, GROUP.HEAD).head().color(0x6a1c16).ellipsoid(f.at(BONE.Head, 0, .12, -.01), .11, .13, .115);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0xb08a3a).ellipsoid(k.at(BONE.Head, 0, .11, .1), .095, .095, .02, 6, 16).color(0x7a5a24);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box(k.at(BONE.Head, Math.cos(a) * .06, .11 + Math.sin(a) * .06, .118), .006, .03, .004, 0, 0, a - Math.PI / 2, .3); }
  k.color(0xff8a2a).glow(.6).box(k.at(BONE.Head, 0, .12, .121), .07, .006, .004, 0, 0, 0, .3).glow(0);
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x4a1612).box([h[0], h[1] + .02, h[2] + .08], .07, .07, .22).color(0xa07a3a).box([h[0], h[1] + .06, h[2] + .1], .03, .02, .16);
}

function sunBrood(f: Flesh) {
  // A wiry spawn of burnt black plated skin with thin ember cracks, a blank bronze faceplate, short black spines on the
  // shoulders and forearms.
  sculptBody(f, { bulk: .88, limb: .9, belly: .9, skin: 0x161214, top: 0x161214, bottom: 0x161214, boots: 0x161214, hands: 0x161214, sleeves: 'none', legs: 'bare', barefoot: true, hunch: .35 });
  cracks(f, BONE.Spine01, GROUP.UPPER, 0xff5a1a, [[.07, .06, .13, .5], [-.06, -.02, .14, -.3]]);
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0x161214).ellipsoid(f.at(BONE.Head, 0, .11, 0), .095, .11, .1);
  const k = f.kit;
  k.on(BONE.Head, GROUP.HEAD).head().color(0xa07a3a).ellipsoid(k.at(BONE.Head, 0, .1, .085), .075, .09, .03, 6, 14);
  k.on(BONE.Spine, GROUP.UPPER).color(0x0a0808);
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) k.cone(k.at(BONE.Spine, s * (.12 + i * .04), .1, -.04), k.at(BONE.Spine, s * (.14 + i * .05), .22, -.08), .018, 4);
  for (const s of [L, R]) { const j = side(s); k.on(j.fore, j.group).color(0x0a0808); for (let i = 0; i < 3; i++) { const a = k.between(j.fore, j.hand, .2 + i * .25, 0, .04); k.cone(a, [a[0], a[1] + .08, a[2] - .03], .014, 4); } }
}

// ---- Ashwood -----------------------------------------------------------------------------------
function paleSapling(f: Flesh) {
  // Grown, not born: a revenant of pale birch bark, black streaks across it, a crown of bare twigs, moss on the shoulders.
  sculptBody(f, { bulk: .9, limb: .9, belly: .85, skin: 0xcfc8b4, top: 0xcfc8b4, bottom: 0xbfb8a2, boots: 0xb0a892, sleeves: 'none', legs: 'bare', barefoot: true, starved: true, hunch: .3 });
  f.soft(.008).color(0x2a2622);
  for (const [bone, x, y, z] of [[BONE.Spine01, .06, .1, .14], [BONE.Spine01, -.07, .02, .15], [BONE.Spine02, .05, -.02, .14], [BONE.Spine, -.1, .03, .1], [BONE.LeftUpLeg, .04, -.1, .07], [BONE.RightUpLeg, -.03, -.2, .07], [BONE.LeftArm, .1, 0, .04], [BONE.RightForeArm, -.1, 0, .04]] as const)
    f.on(bone).capsule(f.at(bone, x - .03, y, z), f.at(bone, x + .03, y + .005, z), .008, .008);
  f.soft(.02).on(BONE.Spine, GROUP.UPPER).color(0x5a6a3a).ellipsoid(f.at(BONE.Spine, .15, .08, 0), .07, .04, .07).ellipsoid(f.at(BONE.Spine, -.13, .07, -.02), .06, .035, .06);
  f.soft(.03).on(BONE.Head, GROUP.HEAD).head().color(0xd8d2be).ellipsoid(f.at(BONE.Head, 0, .12, .0), .095, .12, .1);
  sockets(f, .12, .036, .09, 1.1);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0x5a4a38);
  for (let i = 0; i < 6; i++) { const a = (i / 5 - .5) * 2.2; f.kit.cone(f.kit.at(BONE.Head, Math.sin(a) * .07, .2, -.02), f.kit.at(BONE.Head, Math.sin(a) * .16, .38, -.06), .012, 4); }
  eyes(f, 0xffb84a, .12, .036, .09, .014);
  thorn(f.kit);
}
/** A long thorn carried as a knife. */
function thorn(k: GruntKit) {
  const h = grip(k, BONE.RightHand, .05);
  k.on(BONE.RightHand, GROUP.ARM_R).color(0x4a3a28).cone([h[0], h[1], h[2] - .04], [h[0], h[1], h[2] + .26], .02, 5);
}
interface Knife { at: number; length: number; width: number; thickness: number; steel: number; grip: number }
const CUTTHROAT_KNIFE: Knife = { at: .07, length: .22, width: .04, thickness: .01, steel: 0x8a8e96, grip: 0x3a2418 };
/** A straight throwing knife, its leather-wrapped grip in the fist. */
function knife(k: GruntKit, o: Knife) {
  const h = grip(k, BONE.RightHand, o.at);
  k.on(BONE.RightHand, GROUP.ARM_R).color(o.grip).limb([h[0], h[1], h[2] - .05], [h[0], h[1], h[2] + .03], .013, .013, 6)
    .color(o.steel).blade([h[0], h[1], h[2] + .03], [0, 0, 1], o.length, o.width, o.thickness, .3);
}

function cutthroat(f: Flesh) {
  // A gaunt undead knife-thrower deserter: shaved head and one long braid, a ragged indigo sleeveless wrap-coat to the knees
  // under a knotted red rope sash, a bandolier of throwing knives, black bracers and boots.
  sculptBody(f, { bulk: .85, limb: .9, belly: .8, skin: 0x8a7e72, top: 0x2a2e4a, bottom: 0x2a2e4a, boots: 0x111114, hands: 0x8a7e72, sleeves: 'none', legs: 'trousers', starved: true, hunch: .3 });
  f.soft(.04).on(BONE.Hips).color(0x262a44).capsule(f.at(BONE.Hips, 0, .06, .01), f.at(BONE.Hips, 0, -.5, .02), .17, .22);
  f.soft(.01).on(BONE.Hips).color(0x8a1e1a).torus(f.at(BONE.Hips, 0, .12, .004), .155, .022);
  f.kit.on(BONE.Hips).color(0x8a1e1a).limb(f.kit.at(BONE.Hips, -.08, .1, .15), f.kit.at(BONE.Hips, -.1, -.15, .17), .014, .01, 5);
  f.soft(.008).on(BONE.Spine01, GROUP.UPPER).color(0x3a2a1e).capsule(f.at(BONE.Spine, -.14, .06, .12), f.at(BONE.Spine02, .13, -.02, .14), .02, .02);
  f.kit.on(BONE.Spine01, GROUP.UPPER).color(0x8a8e96);
  for (let i = 0; i < 4; i++) { const t = .15 + i * .22; const a = f.kit.between(BONE.Spine, BONE.Spine02, t, -.12 + t * .24, .02, .16); f.kit.blade(a, [0, 1, 0], .08, .02, .006, .3, [0, 0, 1]); }
  for (const s of [L, R]) { const j = side(s); f.soft(.008).on(j.fore, j.group).color(0x111114).capsule(f.between(j.fore, j.hand, .35), f.between(j.fore, j.hand, .9), .042, .038); }
  sculptHead(f, 0x7e7266, 1, .95);
  f.kit.on(BONE.Head, GROUP.HEAD).head().color(0x141010);
  for (let i = 0; i < 6; i++) f.kit.ellipsoid(f.kit.at(BONE.Head, 0, .14 - i * .07, -.11 - Math.min(i, 2) * .01), .02, .03, .02, 4, 6);
  eyes(f, 0xff3a2a);
  knife(f.kit, CUTTHROAT_KNIFE);
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

function riftSpawn(f: Flesh) {
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
  'tribunal-guard': f => { saltGuard(f); cutlass(f.kit); },
  'tribunal-guard-rifle': f => { saltGuard(f, true); musket(f.kit); },
  automaton: saltEngine,
  'graft-raider': graftRaider,
  'iron-warden': ironWarden,
  'graft-brute': graftBrute,
  'ash-wraith': f => ashWraith(f),
  'ash-caster': f => ashWraith(f, true),
  'great-wraith': f => ashWraith(f, true, 1.4),
  'cinder-imp': cinderImp,
  'jinlin-soldier': sunTrooper,
  'brood-spawn': sunBrood,
  'pale-sapling': paleSapling,
  'cutthroat': cutthroat,
  husk,
  'rift-spawn': riftSpawn,
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
  'graft-leaper': falchion,
  'graft-doctor': k => staff(k, 0x3a2418, 0x5aff8a),
  'iron-bulwark': k => { pike(k); towerShield(k, 0x1a1a1e, 0xe8e0d0); },
  'iron-chaplain': k => staff(k, 0x1a1a1e, 0xfff2a0, true),
  'wraith-caller': k => glowingHands(k, 0xa040ff, .08),
  'jinlin-sniper': k => longRifle(k, 0x4a1612, 0x8a6a3a, 0xff8a2a, 1),
  'cutthroat-mender': k => glowingHands(k, 0x5aff8a),
  'cutthroat-caller': k => { knife(k, CUTTHROAT_KNIFE); glowingHands(k, 0xff8a2a, .05); },
  'husk-priest': k => staff(k, 0x1a1414, 0xb040ff),
  'tribunal-guard': k => cutlass(k),
  'tribunal-guard-rifle': musket,
  'graft-raider': falchion,
  'iron-warden': pike,
  'graft-brute': mastBreaker,
  'pale-sapling': thorn,
  'cutthroat': k => knife(k, CUTTHROAT_KNIFE),
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
