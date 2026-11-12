import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SecondaryMotion, SPRING_PROFILES, type SpringProfile } from '../src/render/SecondaryMotion';
import { LAUNCHED_COAT, coatFlownWhileDown } from '../src/originals/apply';
import { ORIGINALS } from '../src/originals/roster';
import type { FighterId } from '../src/game/types';

/** A root, hips `height` m up, two legs held out in front, and a three-link coat chain hung from behind the hips. */
function rig(height = 1) {
  const root = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.set(0, height, 0); root.add(hips);
  for (const [side, x] of [['Left', .1], ['Right', -.1]] as const) {
    const up = new THREE.Bone(); up.name = `${side}UpLeg`; up.position.set(x, -.05, 0); hips.add(up);
    // (Legs out in front, as a launch folds them: the feet are no lower than the hips, so the floor the ground settings take
    // is the root's plane.)
    const knee = new THREE.Bone(); knee.name = `${side}Leg`; knee.position.set(0, 0, .45); up.add(knee);
    const foot = new THREE.Bone(); foot.name = `${side}Foot`; foot.position.set(0, 0, .42); knee.add(foot);
  }
  let parent: THREE.Object3D = hips;
  const links: THREE.Bone[] = [];
  for (let k = 0; k < 4; k++) {
    const link = new THREE.Bone(); link.name = `Detail_CLOTH_Coat_0_${k}`;
    link.position.set(0, k ? -.2 : -.02, k ? 0 : -.2); parent.add(link); links.push(link); parent = link;
  }
  root.updateMatrixWorld(true);
  return { root, hips, links };
}

const coat = (launched?: SpringProfile['launched']): Partial<SpringProfile> => ({ chains: [{ match: /^Detail_CLOTH_Coat_/, profile: {
  stiffness: 22, drag: .72, gravity: 2.8, maxAngle: 12, tipLoose: 1.25, spread: .2, hang: .75, droop: 62,
  legs: { thigh: .12, shin: .11, floor: .015 }, launched } }] });

/** Fly the rig: `frames` frames of 60 Hz, the root `rise` m up, the hips turned `turn` radians about the side axis. */
function fly(profile: Partial<SpringProfile>, opts: { launched: boolean; rise: number; turn: number; frames?: number; hips?: number }) {
  const key = 'cloth2-test' as FighterId;
  SPRING_PROFILES[key] = profile;
  const { root, hips, links } = rig(opts.hips);
  const springs = new SecondaryMotion(root, key);
  const tip = new THREE.Vector3(), head = new THREE.Vector3(), up = new THREE.Vector3();
  const lowest: number[] = [], off: number[] = [];
  for (let i = 0; i < (opts.frames ?? 90); i++) {
    const k = Math.min(1, i / 30);
    root.position.y = opts.rise * Math.sin(Math.PI * Math.min(1, i / 80));
    hips.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), opts.turn * k);
    root.updateMatrixWorld(true);
    springs.launch(opts.launched ? 1 : 0, 0);
    springs.update(1 / 60);
    root.updateMatrixWorld(true);
    links[3].getWorldPosition(tip); links[0].getWorldPosition(head);
    lowest.push(tip.y - root.position.y);
    // The chain's line against where the hips would carry it rigidly (its bind line, straight down from the hips).
    up.set(0, -1, 0).applyQuaternion(hips.quaternion);
    off.push(THREE.MathUtils.radToDeg(tip.clone().sub(head).angleTo(up)));
  }
  delete SPRING_PROFILES[key];
  return { lowest, off };
}

describe('a launched coat (cloth2)', () => {
  it('runs a garment without `launched` exactly as before, however the fighter is thrown', () => {
    const a = fly(coat(), { launched: false, rise: 1.2, turn: Math.PI });
    const b = fly(coat(), { launched: true, rise: 1.2, turn: Math.PI });
    expect(b.lowest).toEqual(a.lowest);
    expect(b.off).toEqual(a.off);
  });

  it('changes nothing on the ground: a coat with air settings, never launched, moves exactly as one without', () => {
    // (The idle, the run, the strings: every frame the fighter is not launched. Turned and lifted as a run, a jump or a lunge
    // would, the solve is the same number for number.)
    for (const turn of [0, 1.2, Math.PI]) {
      const a = fly(coat(), { launched: false, rise: .6, turn });
      const b = fly(coat(LAUNCHED_COAT), { launched: false, rise: .6, turn });
      expect(b.lowest).toEqual(a.lowest);
      expect(b.off).toEqual(a.off);
    }
  });

  it('hangs below the flying body, not pressed flat on a floor at its own height', () => {
    // Thrown 1.2 m up with the hips low over the root (a launch clip lies the body out level with its origin): on the ground
    // settings the floor is the root, which flies with the body, so the hem is pushed up onto it.
    const ground = fly(coat(), { launched: false, rise: 1.2, turn: 0, hips: .3 });
    const air = fly(coat(LAUNCHED_COAT), { launched: true, rise: 1.2, turn: 0, hips: .3 });
    const mid = 40;
    expect(ground.lowest[mid]).toBeGreaterThan(-.01);   // on the fake floor
    expect(air.lowest[mid]).toBeLessThan(-.2);         // hangs below it, as on the ground before the throw
  });

  it('flies with an upside-down body instead of turning over its torso', () => {
    const ground = fly(coat(), { launched: false, rise: 1.2, turn: Math.PI });
    const air = fly(coat(LAUNCHED_COAT), { launched: true, rise: 1.2, turn: Math.PI });
    const late = (list: number[]) => Math.max(...list.slice(35, 70));
    expect(late(ground.off)).toBeGreaterThan(100);     // turned over toward the floor (through the trunk)
    expect(late(air.off)).toBeLessThan(80);            // with the body, curled a little toward the flight's wind
  });

  it('is on the originals’ coats and capes it filmed better on, and never on Kenzo’s (his oni form shares his springs)', () => {
    let on = 0;
    for (const [id, original] of Object.entries(ORIGINALS)) {
      if (!original || (!original.coat && !original.cape)) continue;
      const chains = SPRING_PROFILES[id as FighterId]?.chains ?? [];
      const own = chains.filter(c => /Detail_CLOTH_(Coat|Cape)_/.test(String(c.match)));
      expect(own.length, id).toBeGreaterThan(0);
      if (own.some(c => c.profile.launched)) on++;
      if (id === 'kenzo') for (const c of own) expect(c.profile.launched, id).toBeUndefined();
    }
    expect(on).toBeGreaterThanOrEqual(29);
  });
});

describe('Banjaku\'s robe on the floor and in the stride (polish7)', () => {
  it('clears his trousers, keeps off the floor, and keeps its air settings down; no other coat does', () => {
    const coat = SPRING_PROFILES.banjaku?.chains?.find(c => String(c.match).includes('Detail_CLOTH_Coat_'))?.profile;
    expect(coat?.legs).toEqual({ thigh: .18, shin: .17, floor: .04 });
    expect(coat?.launched).toEqual(LAUNCHED_COAT);
    expect(coatFlownWhileDown('banjaku')).toBe(true);
    const floored = Object.entries(ORIGINALS).filter(([id]) => coatFlownWhileDown(id)).map(([id]) => id);
    expect(floored).toEqual(['banjaku']);
    // Kenzo (his oni form shares his springs) and Barrow are never touched.
    expect(coatFlownWhileDown('kenzo')).toBe(false);
    expect(coatFlownWhileDown('barrow')).toBe(false);
    for (const [id, original] of Object.entries(ORIGINALS)) if (original?.coat && id !== 'banjaku')
      expect(SPRING_PROFILES[id as FighterId]?.chains?.find(c => String(c.match).includes('Detail_CLOTH_Coat_'))?.profile.legs?.floor, id).toBe(.015);
  });
});
