/** What every kind of grunt looks like: modelled here, in code, on the motion
 *  skeleton's rest pose (a T-pose, facing +Z, 1.8 m to the crown).
 *
 *  Each is a silhouette first - a tribunal guard's cap and cutlass, a wraith's bone
 *  mask and the hole through its chest, a boar-man's snout and axe - because
 *  a horde is read at a glance, dozens at a time. What the rift has done to
 *  them is the same for all: the faces are in shadow and the eyes burn, and
 *  the burn flares while they wind up a blow (aGlow). */
import * as THREE from 'three';
import { BONE } from './motion';
import { GROUP, GruntKit, type V3 } from './kit';

export interface Look {
  geometry: THREE.BufferGeometry;
  /** The model's standing height, for scaling it to its kind. */
  height: number;
}

type Builder = (k: GruntKit) => void;

// ---- the body every humanoid starts from -------------------------------------------
interface Build { bulk: number; limb: number; belly: number; skin: number; top: number; bottom: number; boots: number; hands?: number; neck?: boolean }

/** Torso, arms and legs in three colours: `top` over the chest and upper
 *  arms, `bottom` on the legs, `boots` below the knee, `skin` on the forearms
 *  (or `hands`). A bulkier build widens the chest and thickens the limbs. */
function body(k: GruntKit, b: Build) {
  const { bulk, limb } = b;
  // Pelvis and belly.
  k.on(BONE.Hips).color(b.bottom).ellipsoid(k.at(BONE.Hips, 0, -.02), .16 * bulk, .12, .12 * bulk * b.belly);
  k.on(BONE.Spine02, GROUP.UPPER).color(b.top).limb(k.at(BONE.Hips, 0, .02), k.at(BONE.Spine01), .15 * bulk * b.belly, .16 * bulk, 10, [1, .8]);
  // Chest, a little barrelled.
  k.on(BONE.Spine01, GROUP.UPPER).limb(k.at(BONE.Spine01, 0, -.04), k.at(BONE.Spine, 0, .05), .17 * bulk, .19 * bulk, 10, [1.1, .78]);
  k.on(BONE.Spine, GROUP.UPPER).ellipsoid(k.at(BONE.Spine, 0, .01, -.005), .2 * bulk, .12, .13 * bulk);
  if (b.neck !== false) k.on(BONE.neck, GROUP.UPPER).color(b.skin).limb(k.at(BONE.neck, 0, -.04), k.at(BONE.Head, 0, .02), .055 * limb, .05 * limb, 8);
  for (const side of [1, -1] as const) {
    const L = side > 0;
    const arm = L ? BONE.LeftArm : BONE.RightArm, fore = L ? BONE.LeftForeArm : BONE.RightForeArm, hand = L ? BONE.LeftHand : BONE.RightHand;
    const group = L ? GROUP.ARM_L : GROUP.ARM_R;
    // Shoulder cap, upper arm, forearm, a fist.
    k.on(L ? BONE.LeftShoulder : BONE.RightShoulder, GROUP.UPPER).color(b.top).ellipsoid(k.at(arm, -side * .02, 0), .075 * bulk, .07 * bulk, .07 * bulk);
    k.on(arm, group).limb(k.at(arm, -side * .03), k.at(fore, side * .02), .058 * limb * bulk, .05 * limb * bulk, 9);
    k.on(fore, group).color(b.hands ?? b.skin).limb(k.at(fore, -side * .02), k.at(hand, side * .01), .05 * limb * bulk, .038 * limb, 9);
    k.on(hand, group).ellipsoid(k.at(hand, side * .06, -.005), .05 * limb, .035 * limb, .045 * limb);
    // Thigh, shin, foot.
    const up = L ? BONE.LeftUpLeg : BONE.RightUpLeg, leg = L ? BONE.LeftLeg : BONE.RightLeg, foot = L ? BONE.LeftFoot : BONE.RightFoot, toe = L ? BONE.LeftToeBase : BONE.RightToeBase;
    k.on(up).color(b.bottom).limb(k.at(up, 0, .06), k.at(leg, 0, -.02), .085 * limb * bulk, .062 * limb * bulk, 9);
    k.on(leg).color(b.boots).limb(k.at(leg, 0, .03), k.at(foot, 0, -.02), .06 * limb * bulk, .045 * limb, 9);
    const f = k.at(foot), t = k.at(toe);
    k.on(foot).box([(f[0] + t[0]) / 2, .055, (f[2] + t[2]) / 2 + .02], .1 * limb, .09, .24, 0, 0, 0, .5);
  }
}

/** Two burning eyes on a face, at `y` above the head joint, `spread` apart. */
function eyes(k: GruntKit, y: number, spread: number, forward: number, color: number, size = .018, slant = 0) {
  k.on(BONE.Head, GROUP.HEAD).head().color(color).glow(1);
  for (const side of [1, -1]) k.ellipsoid(k.at(BONE.Head, side * spread, y + side * slant, forward), size * 1.5, size * .7, size * .6, 4, 8);
  k.glow(0);
}

/** A plain head: an egg of skin, a jaw, a brow in shadow. */
function skull(k: GruntKit, skin: number, scale = 1) {
  k.on(BONE.Head, GROUP.HEAD).head().color(skin)
    .ellipsoid(k.at(BONE.Head, 0, .115 * scale, .005), .1 * scale, .125 * scale, .11 * scale)
    .ellipsoid(k.at(BONE.Head, 0, .045 * scale, .045), .075 * scale, .055 * scale, .07 * scale);
}

// ---- Dust Sea -------------------------------------------------------------------------
const TRIBUNAL_GUARD_WHITE = 0xe6eaf0, TRIBUNAL_GUARD_BLUE = 0x23407e, TRIBUNAL_GUARD_COLLAR = 0x2f63c8;
function guardBase(k: GruntKit) {
  body(k, { bulk: 1, limb: 1, belly: 1, skin: 0xcf9f82, top: TRIBUNAL_GUARD_WHITE, bottom: TRIBUNAL_GUARD_BLUE, boots: 0x1a1a20 });
  skull(k, 0xb88a70);
  // The neckerchief and the sailor collar.
  k.on(BONE.Spine, GROUP.UPPER).color(TRIBUNAL_GUARD_COLLAR).box(k.at(BONE.Spine, 0, .08, -.07), .3, .04, .14, 0, -.25).color(0xd8a030).cone(k.at(BONE.Spine, 0, .06, .1), k.at(BONE.Spine, 0, -.1, .16), .045, 6);
  // The cap: a white crown with a black peak, pulled low - the eyes burn under it.
  k.on(BONE.Head, GROUP.HEAD).head().color(TRIBUNAL_GUARD_WHITE).revolve(k.at(BONE.Head, 0, .14), k.at(BONE.Head, 0, .27), [[0, .118], [.55, .12], [.85, .105], [1, 0]], 12);
  k.color(0x111318).ellipsoid(k.at(BONE.Head, 0, .145, .09), .1, .012, .07);
  k.color(TRIBUNAL_GUARD_COLLAR).torus(k.at(BONE.Head, 0, .165), .118, .012, [0, 1, 0], 4, 14);
  eyes(k, .1, .04, .098, 0xff2a1a);
}
function cutlass(k: GruntKit, hand = BONE.RightHand) {
  const p = k.at(hand, hand === BONE.RightHand ? -.07 : .07, -.005, .01);
  k.on(hand, hand === BONE.RightHand ? GROUP.ARM_R : GROUP.ARM_L).color(0xc8a040).box([p[0], p[1], p[2] + .06], .1, .02, .03)
    .color(0xd8dde6).blade([p[0], p[1], p[2] + .07], [0, .15, 1], .72, .075, .012, .22);
}
const LOOKS_DUST_SEA: Record<string, Builder> = {
  'tribunal-guard': k => { guardBase(k); cutlass(k); },
  'tribunal-guard-rifle': k => {
    guardBase(k);
    // A musket along the right forearm: barrel forward, stock under the arm.
    const h = k.at(BONE.RightHand, -.05);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x6a4428).box([h[0], h[1] - .02, h[2] - .12], .05, .07, .5, 0, .05)
      .color(0x2c2c30).limb([h[0], h[1] + .01, h[2] + .1], [h[0], h[1] + .02, h[2] + .82], .018, .016, 6)
      .color(0xb0b6c0).blade([h[0], h[1] + .02, h[2] + .8], [0, 0, 1], .2, .025, .01);
  },
  automaton: k => {
    body(k, { bulk: 1.45, limb: 1.25, belly: 1.1, skin: 0x5a5048, top: 0x16181e, bottom: 0x16181e, boots: 0x0c0c10, hands: 0x2a2a30 });
    skull(k, 0x6a5a50, 1.1);
    // A cap with round ears, the steel jaw, a reactor in the chest.
    k.on(BONE.Head, GROUP.HEAD).head().color(0x0e0e12).revolve(k.at(BONE.Head, 0, .15), k.at(BONE.Head, 0, .3), [[0, .13], [.6, .13], [1, 0]], 12)
      .ellipsoid(k.at(BONE.Head, .1, .29, 0), .05, .05, .03).ellipsoid(k.at(BONE.Head, -.1, .29, 0), .05, .05, .03)
      .color(0x9aa4b0).box(k.at(BONE.Head, 0, .02, .07), .16, .06, .08);
    eyes(k, .11, .045, .1, 0xff3a2a, .022);
    k.on(BONE.Spine01, GROUP.UPPER).color(0xffb040).glow(.9).ellipsoid(k.at(BONE.Spine01, 0, .02, .2), .05, .05, .02).glow(0)
      .color(0x9aa4b0).torus(k.at(BONE.Spine01, 0, .02, .19), .07, .014, [0, 0, 1], 4, 12);
  },
  'beast-pirate': k => {
    body(k, { bulk: 1.15, limb: 1.1, belly: 1.05, skin: 0xc07a52, top: 0xc07a52, bottom: 0x5a2a6a, boots: 0x2a1a14 });
    // A fur vest over bare skin, a sash, and whatever the bad fruit left: horns.
    k.on(BONE.Spine, GROUP.UPPER).color(0x6a4a2a).box(k.at(BONE.Spine, .13, -.05, 0), .1, .28, .26, 0, 0, .15).box(k.at(BONE.Spine, -.13, -.05, 0), .1, .28, .26, 0, 0, -.15);
    k.on(BONE.Hips).color(0xe8b030).torus(k.at(BONE.Hips, 0, .1), .17, .03, [0, 1, 0], 4, 12, .75);
    skull(k, 0xb06a48);
    k.on(BONE.Head, GROUP.HEAD).head().color(0xe8dcc0).cone(k.at(BONE.Head, .07, .2), k.at(BONE.Head, .16, .34, -.02), .03, 6).cone(k.at(BONE.Head, -.07, .2), k.at(BONE.Head, -.16, .34, -.02), .03, 6);
    eyes(k, .1, .04, .098, 0xffb020);
  },
  'beast-graft-brute': k => {
    body(k, { bulk: 1.6, limb: 1.45, belly: 1.2, skin: 0xa86a4a, top: 0xa86a4a, bottom: 0x3a1a4a, boots: 0x1a1010 });
    skull(k, 0x98603f, 1.1);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x2a1a14).cone(k.at(BONE.Head, 0, .22, .04), k.at(BONE.Head, 0, .42, .16), .06, 7);
    eyes(k, .1, .045, .1, 0xff4a1a, .022);
    // A mast-breaker: a spiked iron club.
    const h = k.at(BONE.RightHand, -.08);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x3a3230).limb([h[0], h[1], h[2] - .05], [h[0], h[1] + .08, h[2] + .9], .04, .09, 8);
    k.color(0x8a8a90);
    for (let i = 0; i < 6; i++) { const t = .35 + i * .1, a = i * 2.1; k.cone([h[0], h[1] + .08 * t, h[2] + .9 * t], [h[0] + Math.cos(a) * .14, h[1] + .08 * t + Math.sin(a) * .14, h[2] + .9 * t], .025, 4); }
  },
};

// ---- Cinder Requiem ----------------------------------------------------------------------------
function wraithBase(k: GruntKit, mouthGlow = 0) {
  body(k, { bulk: .92, limb: .9, belly: .9, skin: 0x121218, top: 0x121218, bottom: 0x121218, boots: 0x121218 });
  // The hole where the heart was.
  k.on(BONE.Spine01, GROUP.UPPER).color(0x030304).ellipsoid(k.at(BONE.Spine01, 0, .02, .17), .07, .07, .02);
  k.color(0xe8e4dc).torus(k.at(BONE.Spine01, 0, .02, .165), .075, .012, [0, 0, 1], 4, 12);
  // The bone mask: a skull face, long and pale, with a jaw of teeth.
  k.on(BONE.Head, GROUP.HEAD).head().color(0x0e0e14).ellipsoid(k.at(BONE.Head, 0, .11, -.01), .1, .12, .11);
  k.color(0xf0ece2).ellipsoid(k.at(BONE.Head, 0, .12, .05), .1, .12, .075).box(k.at(BONE.Head, 0, .02, .09), .12, .06, .06);
  k.color(0xf8f6f0);
  for (let i = -3; i <= 3; i++) k.cone(k.at(BONE.Head, i * .016, .045, .115), k.at(BONE.Head, i * .016, .0, .12), .008, 4);
  eyes(k, .13, .045, .12, mouthGlow ? 0xff2244 : 0xffd21a, .02, .01);
  if (mouthGlow) k.on(BONE.Head, GROUP.HEAD).color(0xff1a3a).glow(mouthGlow).ellipsoid(k.at(BONE.Head, 0, .05, .12), .04, .015, .01).glow(0);
  // Claws.
  for (const [hand, group, side] of [[BONE.LeftHand, GROUP.ARM_L, 1], [BONE.RightHand, GROUP.ARM_R, -1]] as const) {
    k.on(hand, group).color(0xe8e2d6);
    for (let i = -1; i <= 1; i++) k.cone(k.at(hand, side * .09, 0, i * .025), k.at(hand, side * .22, -.03, i * .04), .012, 4);
  }
}
const LOOKS_CINDER_REQUIEM: Record<string, Builder> = {
  'ash-wraith': k => wraithBase(k),
  'hollow-void-ray': k => wraithBase(k, .9),
  'great-wraith': k => {
    // A great wraith: a black robe from shoulder to floor, a long pale nose, spikes at the collar.
    body(k, { bulk: 1.2, limb: 1.1, belly: 1.1, skin: 0x0a0a0e, top: 0x0a0a0e, bottom: 0x0a0a0e, boots: 0x0a0a0e });
    k.on(BONE.Spine, GROUP.UPPER).color(0x0c0c10).sheet(k.at(BONE.LeftArm, 0, .05, .02), k.at(BONE.RightArm, 0, .05, .02), 1.25, [0, -1, .08], [0, 0, 1], .16, 6, 4, 1.5)
      .sheet(k.at(BONE.RightArm, 0, .05, -.05), k.at(BONE.LeftArm, 0, .05, -.05), 1.25, [0, -1, -.08], [0, 0, -1], .16, 6, 4, 1.5);
    k.color(0xe8e4dc);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.cone(k.at(BONE.Spine, Math.cos(a) * .14, .08, Math.sin(a) * .1), k.at(BONE.Spine, Math.cos(a) * .26, .16, Math.sin(a) * .2), .025, 4); }
    k.on(BONE.Head, GROUP.HEAD).head().color(0x0a0a0e).ellipsoid(k.at(BONE.Head, 0, .12), .12, .14, .12);
    k.color(0xf0ece2).ellipsoid(k.at(BONE.Head, 0, .13, .06), .11, .12, .07).cone(k.at(BONE.Head, 0, .09, .1), k.at(BONE.Head, 0, .06, .42), .035, 8);
    eyes(k, .15, .05, .12, 0xffd21a, .018);
  },
};

// ---- Last Sun -------------------------------------------------------------------------
const LOOKS_LAST_SUN: Record<string, Builder> = {
  saibaman: k => {
    body(k, { bulk: .9, limb: .85, belly: 1, skin: 0x4e8a3a, top: 0x4e8a3a, bottom: 0x3f7430, boots: 0x3f7430, neck: false });
    // The bulb of a head, ridged, and a hunched neck.
    k.on(BONE.Head, GROUP.HEAD).head().color(0x3a6a2a).ellipsoid(k.at(BONE.Head, 0, .12, .01), .15, .14, .15);
    k.color(0x2a4a1e);
    for (let i = -2; i <= 2; i++) k.torus(k.at(BONE.Head, 0, .12, .01), .148 - Math.abs(i) * .02, .012, [1, 0, i * .35], 4, 14);
    k.color(0x4e8a3a).ellipsoid(k.at(BONE.Head, 0, .04, .07), .07, .05, .06);
    eyes(k, .1, .06, .13, 0xff2a2a, .026, -.01);
    for (const [hand, group, side] of [[BONE.LeftHand, GROUP.ARM_L, 1], [BONE.RightHand, GROUP.ARM_R, -1]] as const) {
      k.on(hand, group).color(0xd8e0c8);
      for (let i = -1; i <= 1; i++) k.cone(k.at(hand, side * .08, 0, i * .02), k.at(hand, side * .17, -.02, i * .03), .01, 4);
    }
  },
  'jinlin-soldier': k => {
    const skin = 0x8aa84a;
    body(k, { bulk: 1.05, limb: 1, belly: 1, skin, top: 0x3a2a6a, bottom: 0x3a2a6a, boots: 0xf0f0f0, hands: 0xf0f0f0 });
    // Battle armour: a white breastplate and the yellow-tipped shoulder guards.
    k.on(BONE.Spine01, GROUP.UPPER).color(0xf2f2ee).limb(k.at(BONE.Spine01, 0, -.02), k.at(BONE.Spine, 0, .06), .19, .21, 10, [1.1, .82]);
    for (const [bone, side] of [[BONE.LeftArm, 1], [BONE.RightArm, -1]] as const) {
      k.on(BONE.Spine, GROUP.UPPER).color(0xf2f2ee).ellipsoid(k.at(bone, side * .02, .04), .1, .04, .09, 5, 10, 0, 0).color(0xe8c020).ellipsoid(k.at(bone, side * .08, .03), .05, .03, .08, 4, 8);
    }
    skull(k, skin);
    // The lens over one eye.
    k.on(BONE.Head, GROUP.HEAD).head().color(0xe0e0e0).box(k.at(BONE.Head, .1, .12, .02), .03, .06, .08).color(0x3aff6a).glow(.8).box(k.at(BONE.Head, .06, .12, .1), .06, .045, .01).glow(0);
    eyes(k, .1, .04, .098, 0xff3a8a);
  },
  'brood-spawn': k => {
    body(k, { bulk: .85, limb: .85, belly: .9, skin: 0x3a70b8, top: 0x1a2a4a, bottom: 0x3a70b8, boots: 0x1a1a22, hands: 0x3a70b8 });
    k.on(BONE.Spine01, GROUP.UPPER).color(0x2a5a9a);
    for (let i = 0; i < 6; i++) { const a = i * 1.1; k.ellipsoid(k.at(BONE.Spine01, Math.cos(a) * .12, .05 + Math.sin(a) * .08, .15), .025, .025, .01, 3, 6); }
    // The crest and the black wing-shell on its back.
    k.on(BONE.Head, GROUP.HEAD).head().color(0xd0dcc8).ellipsoid(k.at(BONE.Head, 0, .1, .02), .09, .1, .095);
    k.color(0x1a2a4a).cone(k.at(BONE.Head, .05, .18, -.02), k.at(BONE.Head, .14, .34, -.08), .05, 6).cone(k.at(BONE.Head, -.05, .18, -.02), k.at(BONE.Head, -.14, .34, -.08), .05, 6);
    eyes(k, .1, .035, .09, 0xff4ad8, .018);
    k.on(BONE.Spine, GROUP.UPPER).color(0x10161e).sheet(k.at(BONE.Spine, .03, .05, -.12), k.at(BONE.Spine, .3, -.1, -.14), .5, [0, -1, -.2], [0, 0, -1], .05, 3, 3, .5)
      .sheet(k.at(BONE.Spine, -.3, -.1, -.14), k.at(BONE.Spine, -.03, .05, -.12), .5, [0, -1, -.2], [0, 0, -1], .05, 3, 3, .5);
  },
};

// ---- Konta -----------------------------------------------------------------------------
const LOOKS_KONTA: Record<string, Builder> = {
  'white-pale-sapling': k => {
    body(k, { bulk: .95, limb: .95, belly: .95, skin: 0xe8ece6, top: 0xe8ece6, bottom: 0xdfe4dc, boots: 0xd4dad0 });
    k.on(BONE.Head, GROUP.HEAD).head().color(0xeef2ec).ellipsoid(k.at(BONE.Head, 0, .12, .01), .105, .13, .11);
    k.color(0x2a2e28).ellipsoid(k.at(BONE.Head, 0, .05, .1), .04, .012, .01);
    eyes(k, .12, .042, .1, 0xffe07a, .022);
  },
  'rogue-ninja': k => {
    body(k, { bulk: .95, limb: .95, belly: .95, skin: 0xd8a888, top: 0x1c2230, bottom: 0x1c2230, boots: 0x14161c, hands: 0x2a3040 });
    skull(k, 0xc89a7a);
    // The flak vest, the struck-through headband, the mask.
    k.on(BONE.Spine01, GROUP.UPPER).color(0x3a4a3a).limb(k.at(BONE.Spine01, 0, -.02), k.at(BONE.Spine, 0, .05), .19, .205, 10, [1.1, .82]);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x1a1e2a).torus(k.at(BONE.Head, 0, .15), .105, .018, [0, 1, 0], 4, 14)
      .color(0xb8c0cc).box(k.at(BONE.Head, 0, .15, .105), .1, .04, .01).color(0x1a1a1a).box(k.at(BONE.Head, 0, .15, .112), .1, .005, .004)
      .color(0x1a1e2a).ellipsoid(k.at(BONE.Head, 0, .04, .06), .09, .05, .065);
    eyes(k, .1, .04, .1, 0xff3a2a);
    const h = k.at(BONE.RightHand, -.07);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x3a3a40).blade([h[0], h[1], h[2] + .02], [0, 0, 1], .22, .05, .01, .4);
  },
};

// ---- Boar-men ----------------------------------------------------------------------------
const LOOKS_BOAR_MEN: Record<string, Builder> = {
  tusker: k => {
    const skin = 0x6a8a3a;
    body(k, { bulk: 1.4, limb: 1.2, belly: 1.4, skin, top: skin, bottom: 0x4a3a2a, boots: 0x3a2a1a });
    k.on(BONE.Spine, GROUP.UPPER).color(0x5a4028).torus(k.at(BONE.Spine01, 0, 0), .25, .03, [.3, 1, 0], 4, 14);
    // The pig's head: a snout, tusks, small horns.
    k.on(BONE.Head, GROUP.HEAD).head().color(0x5e7e34).ellipsoid(k.at(BONE.Head, 0, .1, .03), .13, .12, .13)
      .ellipsoid(k.at(BONE.Head, 0, .06, .14), .07, .055, .06).color(0x3a4a20).ellipsoid(k.at(BONE.Head, 0, .06, .195), .045, .035, .01)
      .color(0xe8e0c8).cone(k.at(BONE.Head, .045, .02, .15), k.at(BONE.Head, .06, .1, .19), .014, 5).cone(k.at(BONE.Head, -.045, .02, .15), k.at(BONE.Head, -.06, .1, .19), .014, 5)
      .color(0x4a3a2a).cone(k.at(BONE.Head, .08, .2), k.at(BONE.Head, .12, .28, -.03), .025, 5).cone(k.at(BONE.Head, -.08, .2), k.at(BONE.Head, -.12, .28, -.03), .025, 5);
    eyes(k, .13, .05, .115, 0xff5a1a, .016);
    // The axe: a long haft and a crescent head.
    const h = k.at(BONE.RightHand, -.08);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x5a3a22).limb([h[0], h[1] - .02, h[2] - .25], [h[0], h[1] + .05, h[2] + .7], .025, .025, 6)
      .color(0x9aa0a8).blade([h[0], h[1] + .04, h[2] + .55], [0, 1, .15], .3, .28, .03, .3, [0, 0, 1]);
  },
  'skiff-guard': k => {
    body(k, { bulk: 1, limb: 1, belly: 1, skin: 0x8a6a4a, top: 0x5a4a3a, bottom: 0x4a3a2a, boots: 0x2a1e14 });
    k.on(BONE.Head, GROUP.HEAD).head().color(0x7a5a3a).ellipsoid(k.at(BONE.Head, 0, .11, .01), .1, .13, .11);
    for (let i = 0; i < 4; i++) k.torus(k.at(BONE.Head, 0, .05 + i * .035, .01), .1 - i * .005, .008, [0, 1, 0], 3, 12);
    eyes(k, .12, .04, .1, 0xff7a1a);
    const h = k.at(BONE.RightHand, -.05);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x2a2a2e).box([h[0], h[1] + .02, h[2] + .1], .05, .08, .38).color(0x6a6a70).limb([h[0], h[1] + .04, h[2] + .28], [h[0], h[1] + .04, h[2] + .5], .014, .014, 6);
  },
};

// ---- The Rift's own ----------------------------------------------------------------------
const LOOKS_RIFT: Record<string, Builder> = {
  husk: k => {
    // The damned: starved, grey-black, in rags, faceless but for the burn.
    body(k, { bulk: .82, limb: .8, belly: .8, skin: 0x2a2628, top: 0x3a3230, bottom: 0x2a2424, boots: 0x1a1616 });
    k.on(BONE.Hips).color(0x3a3028).sheet(k.at(BONE.Hips, .16, .04, .1), k.at(BONE.Hips, -.16, .04, .1), .4, [0, -1, .1], [0, 0, 1], .05, 4, 3, 1.2);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x1c1a1c).ellipsoid(k.at(BONE.Head, 0, .11, 0), .09, .12, .1).color(0x050404).ellipsoid(k.at(BONE.Head, 0, .03, .085), .04, .03, .02);
    eyes(k, .12, .035, .09, 0xff2a10, .02);
    for (const [hand, group, side] of [[BONE.LeftHand, GROUP.ARM_L, 1], [BONE.RightHand, GROUP.ARM_R, -1]] as const) {
      k.on(hand, group).color(0x1a1414);
      for (let i = -1; i <= 1; i++) k.cone(k.at(hand, side * .08, 0, i * .02), k.at(hand, side * .2, -.04, i * .035), .01, 4);
    }
  },
  'apostle-spawn': k => {
    // A lesser demon: swollen, horned, spined, its maw lit from inside.
    body(k, { bulk: 1.55, limb: 1.4, belly: 1.3, skin: 0x5a1e1e, top: 0x5a1e1e, bottom: 0x3a1414, boots: 0x2a0e0e });
    k.on(BONE.Spine, GROUP.UPPER).color(0x1a0a0a);
    for (let i = 0; i < 6; i++) k.cone(k.at(BONE.Spine02, 0, .05 + i * .07, -.13), k.at(BONE.Spine02, 0, .12 + i * .07, -.32), .035, 5);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x4a1616).ellipsoid(k.at(BONE.Head, 0, .1, .03), .13, .12, .14)
      .color(0x150808).cone(k.at(BONE.Head, .08, .18), k.at(BONE.Head, .24, .38, .05), .04, 6).cone(k.at(BONE.Head, -.08, .18), k.at(BONE.Head, -.24, .38, .05), .04, 6)
      .color(0xff7a1a).glow(.8).ellipsoid(k.at(BONE.Head, 0, .03, .15), .07, .03, .02).glow(0);
    eyes(k, .12, .055, .14, 0xffd01a, .024, .01);
  },
};

export const LOOKS: Record<string, Builder> = { ...LOOKS_DUST_SEA, ...LOOKS_CINDER_REQUIEM, ...LOOKS_LAST_SUN, ...LOOKS_KONTA, ...LOOKS_BOAR_MEN, ...LOOKS_RIFT };

/** Build a kind's geometry on the given rest pose. Unknown kinds get a husk. */
export function buildLook(kind: string, rest: readonly THREE.Vector3[], height: number): Look {
  const k = new GruntKit(rest);
  (LOOKS[kind] ?? LOOKS.husk)(k);
  return { geometry: k.build(), height };
}
export type { V3 };
