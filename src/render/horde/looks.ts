/** What every kind of grunt looks like: modelled here, in code, on the motion
 *  skeleton's rest pose (a T-pose, facing +Z, 1.8 m to the crown).
 *
 *  Each is a silhouette first - a salt guard's cowl and iron mask, an ash wraith's
 *  hood and claws, a graft raider's ram skull and crab claw - because
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
// The kit looks (?kitlooks, the last fallback) follow each kind's own model, as fleshLooks.ts's sculpts do.
const SALT = 0xc4baa2, SALT_DARK = 0xa49a82;
function saltBase(k: GruntKit) {
  body(k, { bulk: 1.05, limb: 1, belly: 1, skin: 0x6e5a4c, top: SALT, bottom: SALT_DARK, boots: 0x5a4a38, hands: 0x6e5a4c });
  // The robe to the shins, the rope belt, the cowl and the plain iron mask.
  k.on(BONE.Hips).color(SALT_DARK).revolve(k.at(BONE.Hips, 0, .06), k.at(BONE.Hips, 0, -.72), [[0, .18], [.5, .22], [1, .26]], 12)
    .color(0x6a5236).torus(k.at(BONE.Hips, 0, .08), .17, .018, [0, 1, 0], 4, 12);
  k.on(BONE.Spine, GROUP.UPPER).color(SALT).ellipsoid(k.at(BONE.Spine, 0, .1, -.02), .21, .08, .16);
  k.on(BONE.Head, GROUP.HEAD).head().color(SALT).ellipsoid(k.at(BONE.Head, 0, .12, -.03), .125, .145, .13)
    .color(0x3c3c40).ellipsoid(k.at(BONE.Head, 0, .115, .1), .085, .1, .022, 6, 14);
  eyes(k, .125, .033, .122, 0xff5a2a, .012);
}
function cutlass(k: GruntKit, hand = BONE.RightHand) {
  const p = k.at(hand, hand === BONE.RightHand ? -.07 : .07, -.005, .01);
  k.on(hand, hand === BONE.RightHand ? GROUP.ARM_R : GROUP.ARM_L).color(0xc8a040).box([p[0], p[1], p[2] + .06], .1, .02, .03)
    .color(0xd8dde6).blade([p[0], p[1], p[2] + .07], [0, .15, 1], .72, .075, .012, .22);
}
const LOOKS_DUST_SEA: Record<string, Builder> = {
  'tribunal-guard': k => { saltBase(k); cutlass(k); },
  'tribunal-guard-rifle': k => {
    saltBase(k);
    // A musket along the right forearm: barrel forward, stock under the arm.
    const h = k.at(BONE.RightHand, -.05);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x6a4428).box([h[0], h[1] - .02, h[2] - .12], .05, .07, .5, 0, .05)
      .color(0x2c2c30).limb([h[0], h[1] + .01, h[2] + .1], [h[0], h[1] + .02, h[2] + .82], .018, .016, 6)
      .color(0xb0b6c0).blade([h[0], h[1] + .02, h[2] + .8], [0, 0, 1], .2, .025, .01);
  },
  automaton: k => {
    // A cast-iron engine: a box head whose face is a furnace grate, riveted plates, huge forearms.
    body(k, { bulk: 1.55, limb: 1.4, belly: 1.1, skin: 0x2e2a28, top: 0x34302c, bottom: 0x2e2a28, boots: 0x1c1a18, hands: 0x3e3834 });
    k.on(BONE.Head, GROUP.HEAD).head().color(0x3a3430).box(k.at(BONE.Head, 0, .12), .25, .27, .24, 0, 0, 0, .1).color(0xff7a1a).glow(.9);
    for (let i = 0; i < 4; i++) k.box(k.at(BONE.Head, 0, .05 + i * .04, .125), .16, .012, .012, 0, 0, 0, .2);
    k.glow(0);
    k.on(BONE.Spine01, GROUP.UPPER).color(0x4a403a).box(k.at(BONE.Spine01, 0, .04, .16), .3, .26, .05, 0, 0, 0, .1);
    for (const [fore, hand, group] of [[BONE.LeftForeArm, BONE.LeftHand, GROUP.ARM_L], [BONE.RightForeArm, BONE.RightHand, GROUP.ARM_R]] as const)
      k.on(fore, group).color(0x3e3834).limb(k.at(fore), k.at(hand), .085, .1, 10);
  },
  'graft-raider': k => {
    // A ram's skull over the face, curled horns, a dust scarf, a crab's claw for a left hand.
    body(k, { bulk: 1.1, limb: 1.05, belly: 1, skin: 0x8a6a50, top: 0x8a7454, bottom: 0x5e4c38, boots: 0x3a2a1e });
    k.on(BONE.Spine, GROUP.UPPER).color(0xa08a66).torus(k.at(BONE.Spine, 0, .1), .12, .045, [0, 1, 0], 5, 12);
    k.on(BONE.Head, GROUP.HEAD).head().color(0xa08a66).ellipsoid(k.at(BONE.Head, 0, .12, -.05), .12, .13, .1)
      .color(0xe6dcc4).ellipsoid(k.at(BONE.Head, 0, .11, .055), .085, .1, .075)
      .color(0xcfc2a2).torus(k.at(BONE.Head, .11, .13, -.01), .055, .02, [1, 0, 0], 5, 12).torus(k.at(BONE.Head, -.11, .13, -.01), .055, .02, [1, 0, 0], 5, 12);
    eyes(k, .12, .036, .12, 0xffb020);
    const c = k.at(BONE.LeftHand, .06);
    k.on(BONE.LeftHand, GROUP.ARM_L).color(0xa8482a).blade([c[0], c[1] + .03, c[2]], [1, .25, 0], .3, .12, .05, .5, [0, 0, 1]).blade([c[0], c[1] - .03, c[2]], [1, -.15, 0], .22, .08, .04, .5, [0, 0, 1]);
  },
  'graft-brute': k => {
    // A bull's head with a rhino's horn on a furred body.
    body(k, { bulk: 1.6, limb: 1.45, belly: 1.2, skin: 0x4a3a30, top: 0x4a3a30, bottom: 0x3a2a1e, boots: 0x2a2018 });
    skull(k, 0x3e2e24, 1.1);
    k.on(BONE.Head, GROUP.HEAD).head().color(0xd8ccb0).cone(k.at(BONE.Head, .1, .17), k.at(BONE.Head, .28, .2, .1), .042, 7).cone(k.at(BONE.Head, -.1, .17), k.at(BONE.Head, -.28, .2, .1), .042, 7)
      .color(0xcabfa0).cone(k.at(BONE.Head, 0, .1, .15), k.at(BONE.Head, 0, .25, .24), .035, 7);
    eyes(k, .1, .045, .1, 0xff4a1a, .022);
    // A spiked iron club.
    const h = k.at(BONE.RightHand, -.08);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x3a3230).limb([h[0], h[1], h[2] - .05], [h[0], h[1] + .08, h[2] + .9], .04, .09, 8);
    k.color(0x8a8a90);
    for (let i = 0; i < 6; i++) { const t = .35 + i * .1, a = i * 2.1; k.cone([h[0], h[1] + .08 * t, h[2] + .9 * t], [h[0] + Math.cos(a) * .14, h[1] + .08 * t + Math.sin(a) * .14, h[2] + .9 * t], .025, 4); }
  },
};

// ---- Cinder Requiem ----------------------------------------------------------------------------
function ashBase(k: GruntKit, caster = false, scale = 1) {
  // A gaunt ghoul of grey ash, violet light in its cracks, a hood of burnt cloth, black claws; the caster robed and horned.
  body(k, { bulk: .85 * scale, limb: .85 * scale, belly: .8, skin: 0x6a6660, top: 0x6a6660, bottom: 0x3a3634, boots: 0x3a3634 });
  k.on(BONE.Spine01, GROUP.UPPER).color(0xa050ff).glow(.8).box(k.at(BONE.Spine01, .06, .05, .16), .008, .08, .006, 0, 0, .4).box(k.at(BONE.Spine01, -.07, .1, .15), .008, .07, .006, 0, 0, -.3).glow(0);
  skull(k, 0x5a5650);
  k.on(BONE.Head, GROUP.HEAD).head().color(0x2a2624).ellipsoid(k.at(BONE.Head, 0, .14, -.04), .12, .13, .12);
  eyes(k, .11, .038, .1, 0xc080ff, .016);
  for (const [hand, group, side] of [[BONE.LeftHand, GROUP.ARM_L, 1], [BONE.RightHand, GROUP.ARM_R, -1]] as const) {
    k.on(hand, group).color(0x0e0c0c);
    for (let i = -1; i <= 1; i++) k.cone(k.at(hand, side * .09, 0, i * .025), k.at(hand, side * .24, -.04, i * .04), .012, 4);
  }
  if (!caster) return;
  k.on(BONE.Hips).color(0x34302c).revolve(k.at(BONE.Hips, 0, .06), k.at(BONE.Hips, 0, -.74), [[0, .17], [.5, .21], [1, .25]], 12);
  k.on(BONE.Head, GROUP.HEAD).head().color(0x2a201a);
  for (const s of [1, -1]) k.cone(k.at(BONE.Head, s * .06, .2, -.02), k.at(BONE.Head, s * .16, .38, -.08), .02, 5).cone(k.at(BONE.Head, s * .12, .3, -.05), k.at(BONE.Head, s * .2, .34, .02), .012, 4);
}
const LOOKS_CINDER_REQUIEM: Record<string, Builder> = {
  'ash-wraith': k => ashBase(k),
  'ash-caster': k => ashBase(k, true),
  'great-wraith': k => ashBase(k, true, 1.4),
};

// ---- Last Sun -------------------------------------------------------------------------
const LOOKS_LAST_SUN: Record<string, Builder> = {
  'cinder-imp': k => {
    // A charred hunched imp, molten light in its belly, big pointed ears, long claws.
    body(k, { bulk: .9, limb: .95, belly: 1.2, skin: 0x2a1a14, top: 0x2a1a14, bottom: 0x2a1a14, boots: 0x2a1a14, neck: false });
    k.on(BONE.Spine02, GROUP.UPPER).color(0xffa040).glow(.9).ellipsoid(k.at(BONE.Spine02, 0, .02, .15), .09, .1, .03, 5, 10).glow(0);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x2a1a14).ellipsoid(k.at(BONE.Head, 0, .11, .02), .11, .1, .11);
    for (const s of [1, -1]) k.cone(k.at(BONE.Head, s * .09, .13, -.01), k.at(BONE.Head, s * .25, .2, -.07), .035, 5);
    eyes(k, .12, .045, .11, 0xffd02a, .022, -.008);
    for (const [hand, group, side] of [[BONE.LeftHand, GROUP.ARM_L, 1], [BONE.RightHand, GROUP.ARM_R, -1]] as const) {
      k.on(hand, group).color(0x1a0e0a);
      for (let i = -1; i <= 1; i++) k.cone(k.at(hand, side * .08, 0, i * .02), k.at(hand, side * .22, -.03, i * .03), .01, 4);
    }
  },
  'jinlin-soldier': k => {
    // Dark red ceramic plate over black, a round bronze sun-disc over the face.
    body(k, { bulk: 1.05, limb: 1, belly: 1, skin: 0x1a1416, top: 0x121014, bottom: 0x121014, boots: 0x5a1a14, hands: 0x121014 });
    k.on(BONE.Spine01, GROUP.UPPER).color(0x6a1c16).limb(k.at(BONE.Spine01, 0, -.02), k.at(BONE.Spine, 0, .06), .19, .21, 10, [1.1, .82]);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x6a1c16).ellipsoid(k.at(BONE.Head, 0, .12, -.01), .11, .13, .115)
      .color(0xb08a3a).ellipsoid(k.at(BONE.Head, 0, .11, .1), .095, .095, .02, 6, 16);
  },
  'brood-spawn': k => {
    // Burnt black plated skin, a blank bronze faceplate, short black spines on the shoulders.
    body(k, { bulk: .85, limb: .88, belly: .9, skin: 0x161214, top: 0x161214, bottom: 0x161214, boots: 0x161214, hands: 0x161214 });
    k.on(BONE.Head, GROUP.HEAD).head().color(0x161214).ellipsoid(k.at(BONE.Head, 0, .11, 0), .095, .11, .1).color(0xa07a3a).ellipsoid(k.at(BONE.Head, 0, .1, .085), .075, .09, .03, 6, 14);
    k.on(BONE.Spine, GROUP.UPPER).color(0x0a0808);
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) k.cone(k.at(BONE.Spine, s * (.12 + i * .04), .1, -.04), k.at(BONE.Spine, s * (.14 + i * .05), .22, -.08), .018, 4);
  },
};

// ---- Ashwood -----------------------------------------------------------------------
const LOOKS_ASHWOOD: Record<string, Builder> = {
  'pale-sapling': k => {
    // Pale birch bark streaked black, a crown of bare twigs.
    body(k, { bulk: .9, limb: .9, belly: .85, skin: 0xcfc8b4, top: 0xcfc8b4, bottom: 0xbfb8a2, boots: 0xb0a892 });
    k.on(BONE.Spine01, GROUP.UPPER).color(0x2a2622).box(k.at(BONE.Spine01, .06, .1, .17), .06, .012, .01).box(k.at(BONE.Spine01, -.07, .02, .17), .06, .012, .01);
    k.on(BONE.Head, GROUP.HEAD).head().color(0xd8d2be).ellipsoid(k.at(BONE.Head, 0, .12), .095, .12, .1).color(0x5a4a38);
    for (let i = 0; i < 6; i++) { const a = (i / 5 - .5) * 2.2; k.cone(k.at(BONE.Head, Math.sin(a) * .07, .2, -.02), k.at(BONE.Head, Math.sin(a) * .16, .38, -.06), .012, 4); }
    eyes(k, .12, .036, .095, 0xffb84a, .016);
  },
  'cutthroat': k => {
    // A gaunt deserter: shaved head and one long braid, an indigo wrap-coat, a red rope sash, a throwing knife.
    body(k, { bulk: .85, limb: .9, belly: .8, skin: 0x8a7e72, top: 0x2a2e4a, bottom: 0x2a2e4a, boots: 0x111114, hands: 0x8a7e72 });
    k.on(BONE.Hips).color(0x262a44).revolve(k.at(BONE.Hips, 0, .06), k.at(BONE.Hips, 0, -.5), [[0, .17], [1, .22]], 12).color(0x8a1e1a).torus(k.at(BONE.Hips, 0, .12), .16, .02, [0, 1, 0], 4, 12);
    skull(k, 0x7e7266);
    k.on(BONE.Head, GROUP.HEAD).head().color(0x141010);
    for (let i = 0; i < 6; i++) k.ellipsoid(k.at(BONE.Head, 0, .14 - i * .07, -.11), .02, .03, .02, 4, 6);
    eyes(k, .1, .04, .1, 0xff3a2a);
    const h = k.at(BONE.RightHand, -.07);
    k.on(BONE.RightHand, GROUP.ARM_R).color(0x8a8e96).blade([h[0], h[1], h[2] + .02], [0, 0, 1], .22, .04, .01, .3);
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
  'rift-spawn': k => {
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

export const LOOKS: Record<string, Builder> = { ...LOOKS_DUST_SEA, ...LOOKS_CINDER_REQUIEM, ...LOOKS_LAST_SUN, ...LOOKS_ASHWOOD, ...LOOKS_RIFT };

/** Build a kind's geometry on the given rest pose. Unknown kinds get a husk. */
export function buildLook(kind: string, rest: readonly THREE.Vector3[], height: number): Look {
  const k = new GruntKit(rest);
  (LOOKS[kind] ?? LOOKS.husk)(k);
  return { geometry: k.build(), height };
}
export type { V3 };
