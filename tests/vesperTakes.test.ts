import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { Fighter, bindClips, clipAtMotion, clipMotionTable } from '../src/render/Fighter';
import { IDLE_PROFILES, type IdleProfile } from '../src/render/idle/profile';
import { loadRig, base } from './rigHarness';
import { guardNewTakes } from './takeGuard';
import { loadRigWithExtras } from './extraClips';
import { ORIGINALS } from '../src/originals/roster';
import contactFrames from '../src/game/data/contactFrames.json';
import type { AttackSlot, PlayerState } from '../src/game/types';

const ID = 'vesper' as const;
// The special's own clip (it was the light's thrust, frozen 0.4 s): new, of the move's length.
guardNewTakes('Vesper\'s Pale Lance', [[ID, 'vesper-fanim4.glb', [['Pale Lance', 1.19, 1.21]]]]);
const SKIP = /finger|thumb|index|middle|ring|pinky|toe|eye|jaw/i;
let rig: GLTF;
const warnings: string[] = [];
let spy: ReturnType<typeof vi.spyOn> | undefined;
let tracks = { shipped: 0, bound: 0 };

/** The body FighterLibrary.load builds: the GLB, `extraModels` and the idle profile's file, bound by bone name. */
async function assemble() {
  const gltf = await loadRig(FIGHTERS[ID].model);
  for (const url of [...(FIGHTERS[ID].extraModels ?? []), IDLE_PROFILES[ID]?.model]) {
    if (!url) continue;
    const file = await loadRig(url), clips = bindClips(gltf.scene, file.animations, FIGHTERS[ID].name), names = new Set(clips.map(c => c.name));
    if (url === IDLE_PROFILES[ID]?.model) tracks = { shipped: file.animations.reduce((n, c) => n + c.tracks.length, 0), bound: clips.reduce((n, c) => n + c.tracks.length, 0) };
    gltf.animations = [...gltf.animations.filter(c => !names.has(c.name)), ...clips];
  }
  return gltf;
}
/** A body under the shipped profile, or under none (`plain`: the default life on his own `_Idle`). */
function body(plain = false) {
  const saved = IDLE_PROFILES[ID];
  if (plain) (IDLE_PROFILES as Record<string, IdleProfile>)[ID] = {};
  try { return new Fighter(base(ID), rig); } finally { if (plain) (IDLE_PROFILES as Record<string, IdleProfile>)[ID] = saved!; }
}
beforeAll(async () => {
  spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => { warnings.push(args.map(String).join(' ')); });
  rig = await assemble();
}, 240_000);
afterAll(() => spy?.mockRestore());

/** The sabre on a body: the vertices the right hand carries whole, its tip the one furthest from the hand's joint at
 *  rest. `blade()` is its line now, from the hand to the tip, in the fighter's own frame (+z toward the opponent). */
function sabre(fighter: Fighter) {
  let mesh: THREE.SkinnedMesh | undefined;
  fighter.model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh; });
  const skin = mesh!, bones = skin.skeleton.bones, k = bones.findIndex(b => b.name === 'RightHand');
  const at = new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[k].clone().invert());
  const index = skin.geometry.getAttribute('skinIndex'), weight = skin.geometry.getAttribute('skinWeight'), position = skin.geometry.getAttribute('position');
  let tip = -1, far = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    let w = 0;
    for (let j = 0; j < 4; j++) if (index.getComponent(i, j) === k) w += weight.getComponent(i, j);
    if (w < .99) continue;
    const d = v.fromBufferAttribute(position, i).distanceTo(at);
    if (d > far) { far = d; tip = i; }
  }
  const hand = bones[k], local = (p: THREE.Vector3) => fighter.group.worldToLocal(p);
  return {
    length: far,
    blade() {
      fighter.group.updateMatrixWorld(true);
      const h = local(hand.getWorldPosition(new THREE.Vector3())), t = local(skin.getVertexPosition(tip, new THREE.Vector3()).applyMatrix4(skin.matrixWorld));
      const line = t.clone().sub(h);
      return { hand: h, tip: t, dir: line.clone().normalize(), elevation: THREE.MathUtils.radToDeg(Math.asin(line.y / line.length())) };
    },
  };
}
const joint = (fighter: Fighter, name: string) => { fighter.group.updateMatrixWorld(true); return fighter.group.worldToLocal(fighter.joints.get(name)!.getWorldPosition(new THREE.Vector3())); };

describe('Vesper stands en garde', () => {
  it('in the profile\'s idle, every track bound, his body measured on its own idle as before', () => {
    const profile = IDLE_PROFILES[ID]!;
    expect(fs.existsSync(`public${profile.model}`)).toBe(true);
    const names = new Set(rig.animations.map(c => c.name));
    for (const name of [profile.clip, ...(profile.fidgets ?? [])]) expect(names.has(name!), name).toBe(true);
    expect(tracks.bound, `${tracks.bound} of ${tracks.shipped} tracks bound`).toBe(tracks.shipped);
    expect(warnings.filter(w => /binds to nothing|other units|unavailable|not found/i.test(w) && !/rush stage/i.test(w))).toEqual([]);
    const mine = body(), plain = body(true);
    try {
      for (let f = 0; f < 30; f++) mine.update(1 / 60, base(ID), true, 1 / 60);
      expect(mine.motionEvidence().clip).toBe(profile.clip);
      expect(mine.model.scale.x).toBeCloseTo(plain.model.scale.x, 6);
    } finally { mine.dispose(); plain.dispose(); }
  });

  it.skipIf(!!ORIGINALS.vesper)('holds the sabre\'s point up at the opponent, the hand low before him, through the whole loop', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      expect(blade.length, 'the sabre found on his hand').toBeGreaterThan(.6);
      for (let f = 0; f < 6 * 60; f++) {
        fighter.update(1 / 60, base(ID), true, 1 / 60);
        if (f % 30 || f < 60) continue;
        const { hand, dir, elevation } = blade.blade(), hips = joint(fighter, 'Hips'), head = joint(fighter, 'Head');
        expect(elevation, `frame ${f}: the blade's rise`).toBeGreaterThan(18);
        expect(elevation, `frame ${f}: the blade's rise`).toBeLessThan(52);
        expect(dir.z, `frame ${f}: the point toward the opponent`).toBeGreaterThan(.55);
        expect(hand.z - hips.z, `frame ${f}: the hand before him`).toBeGreaterThan(.2);
        expect(hand.y, `frame ${f}: the hand low, under his chest`).toBeLessThan(head.y - .4);
      }
    } finally { fighter.dispose(); }
  }, 60_000);

  it.skipIf(!!ORIGINALS.vesper)('loops on itself, and the salute opens and closes on it with the blade upright before his face between', () => {
    const fighter = body();
    try {
      fighter.dynamics = false;
      const joints = [...fighter.joints].filter(([n]) => !SKIP.test(n)).map(([, j]) => j), blade = sabre(fighter);
      const sample = (name: string, times: number[], each?: (t: number) => void) => {
        const clip = rig.animations.find(c => c.name === name)!;
        fighter.mixer.stopAllAction();
        const action = fighter.mixer.clipAction(clip).play();
        return times.map(t => { action.time = Math.min(t, clip.duration - 1e-6); fighter.mixer.update(0); each?.(t); return joints.map(j => j.quaternion.clone()); });
      };
      const worst = (a: THREE.Quaternion[], b: THREE.Quaternion[]) => Math.max(...a.map((q, i) => THREE.MathUtils.radToDeg(q.angleTo(b[i]))));
      const loop = rig.animations.find(c => c.name === 'Vesper idle')!, salute = rig.animations.find(c => c.name === 'Vesper idle fidget')!;
      const [first, last] = sample(loop.name, [0, loop.duration]);
      expect(worst(first, last), 'the idle wraps').toBeLessThan(.5);
      let upright = 0, face = Infinity;
      const [a, b] = sample(salute.name, [0, salute.duration]);
      sample(salute.name, [1, 1.2, 1.4], () => {
        const { hand, elevation } = blade.blade(), head = joint(fighter, 'Head');
        upright = Math.max(upright, elevation); face = Math.min(face, hand.distanceTo(head));
      });
      expect(worst(a, first), 'the salute opens on the idle').toBeLessThan(1);
      expect(worst(b, first), 'and closes on it').toBeLessThan(1);
      expect(upright, 'the blade upright in the salute').toBeGreaterThan(70);
      expect(face, 'the hilt before his face').toBeLessThan(.4);
    } finally { fighter.dispose(); }
  }, 60_000);
});

describe('Vesper runs and wins with the sabre where a swordsman carries it', () => {
  it.skipIf(!!ORIGINALS.vesper)('runs with it low at his side, the point forward and down, clear of his legs', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      let z = 0, clear = Infinity;
      const segment = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => new THREE.Line3(a, b).closestPointToPoint(p, true, new THREE.Vector3()).distanceTo(p);
      for (let f = 0; f < 150; f++) {
        z += 7.5 / 60;
        fighter.update(1 / 60, { ...base(ID), action: 'run', z }, true, 1 / 60);
        if (f < 40 || f % 3) continue;
        expect(fighter.motionEvidence().clip).toBe('Run');
        const { hand, tip, elevation } = blade.blade(), hips = joint(fighter, 'Hips');
        expect(elevation, `frame ${f}: the point carried low`).toBeLessThan(0);
        expect(elevation, `frame ${f}: and not dragged`).toBeGreaterThan(-45);
        expect(tip.z - hand.z, `frame ${f}: the point forward`).toBeGreaterThan(.3);
        expect(hand.y, `frame ${f}: the hand at his hip`).toBeLessThan(hips.y + .15);
        // The blade's line against each leg's bones, sampled along it.
        for (const side of ['Left', 'Right']) {
          const up = joint(fighter, `${side}UpLeg`), knee = joint(fighter, `${side}Leg`), foot = joint(fighter, `${side}Foot`);
          for (let s = .25; s <= 1; s += .25) {
            const p = hand.clone().lerp(tip, s);
            clear = Math.min(clear, segment(p, up, knee), segment(p, knee, foot));
          }
        }
      }
      expect(clear, 'the blade\'s nearest pass to a leg bone').toBeGreaterThan(.12);
    } finally { fighter.dispose(); }
  }, 60_000);

  it.skipIf(!!ORIGINALS.vesper)('kicks his heel up no higher than under his cape\'s belt, and plants each foot where the clip planted it', async () => {
    // The library's run brought each ankle 15 cm under his hips, into the band under the cape's belt that the hem
    // leaves to the pelvis, and the boot came through the cloth (8 October 2026, scripts/fanim/vesper.py
    // lower_heels). The take turns the thighs and shins; every foot on the floor - the contacts the run is paced and
    // planted by, src/game/data/locomotion.json - stays where the clip had it.
    const own = await loadRig(FIGHTERS[ID].model), take = await loadRigWithExtras(ID);
    // Sampled at the same times in each (the take runs a frame longer than the clip it replaces: its export's last).
    const span = own.animations.find(c => c.name === 'Run')!.duration;
    const ankles = (gltf: GLTF, clip: THREE.AnimationClip) => {
      const mixer = new THREE.AnimationMixer(gltf.scene), action = mixer.clipAction(clip).play(), out: { depth: number; feet: THREE.Vector3[] }[] = [];
      const hips = gltf.scene.getObjectByName('Hips')!, feet = ['LeftFoot', 'RightFoot'].map(n => gltf.scene.getObjectByName(n)!);
      for (let i = 0; i < 64; i++) {
        action.time = span * i / 64;
        mixer.update(0);
        gltf.scene.updateMatrixWorld(true);
        const h = hips.getWorldPosition(new THREE.Vector3()), at = feet.map(f => f.getWorldPosition(new THREE.Vector3()));
        out.push({ depth: Math.min(...at.map(p => h.y - p.y)), feet: at });
      }
      mixer.stopAllAction();
      return out;
    };
    const before = ankles(own, own.animations.find(c => c.name === 'Run')!), after = ankles(take, take.animations.find(c => c.name === 'Run')!);
    expect(Math.min(...before.map(s => s.depth)), 'the library\'s kick').toBeLessThan(.2);
    expect(Math.min(...after.map(s => s.depth)), 'the ankle\'s highest under the hips').toBeGreaterThan(.42);
    const floor = Math.min(...before.flatMap(s => s.feet.map(p => p.y)));
    let planted = 0;
    before.forEach((s, i) => s.feet.forEach((p, k) => {
      if (p.y > floor + .02) return;
      planted++;
      // (The turned joints' channels are the export's, sampled every frame: a planted foot comes back within millimetres.)
      expect(p.distanceTo(after[i].feet[k]), `sample ${i}: a planted foot moved`).toBeLessThan(.005);
    }));
    expect(planted).toBeGreaterThan(10);
  }, 60_000);

  it('wins with his left hand raised to the sky and the sabre lowered at his side', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      for (let f = 0; f < 150; f++) fighter.update(1 / 60, { ...base(ID), action: 'victory', actionStarted: 1 }, true, 1 / 60);
      expect(fighter.motionEvidence().clip).toBe('victory_lp');
      const hand = joint(fighter, 'LeftHand'), head = joint(fighter, 'Head'), { elevation } = blade.blade();
      expect(hand.y - head.y, 'the left hand over his head').toBeGreaterThan(.2);
      expect(elevation, 'the sabre lowered').toBeLessThan(0);
    } finally { fighter.dispose(); }
  }, 60_000);
});

type Step = { action: PlayerState['action']; seconds: number; duration?: number; speed?: number; label: string };
/** The worst joint step in the third of a second after each seam of a script, and the soles through each attack once
 *  its entry blend is done (tests/idleProfilesB.test.ts's drive). */
function drive(plain: boolean, steps: Step[]) {
  const fighter = body(plain);
  fighter.prepareRush();
  fighter.targetPoint = new THREE.Vector3(0, 1.3, 3); fighter.targetDistance = 3;
  const joints = [...fighter.joints].filter(([n]) => !SKIP.test(n)).map(([, j]) => j), previous = joints.map(j => j.quaternion.clone());
  const seams: Record<string, number> = {}, soles: Record<string, number> = {};
  let z = 0;
  try {
    const dt = 1 / 60;
    for (let f = 0; f < 60; f++) fighter.update(dt, base(ID), true, dt);
    joints.forEach((j, i) => previous[i].copy(j.quaternion));
    steps.forEach((step, s) => {
      const duration = step.duration ?? step.seconds, finite = !['idle', 'run', 'guard'].includes(step.action);
      let seam = 0, lowest = Infinity;
      for (let i = 0; i < Math.ceil(step.seconds / dt); i++) {
        z += (step.speed ?? 0) * dt;
        fighter.update(dt, { ...base(ID), z, action: step.action, actionSeq: finite ? 10 + s : undefined, actionStarted: 2 + s,
          actionDuration: finite ? duration : 0, actionTime: finite ? Math.min(.999, i * dt / duration) : 0 }, true, dt);
        let w = 0;
        joints.forEach((j, k) => { w = Math.max(w, THREE.MathUtils.radToDeg(previous[k].angleTo(j.quaternion))); previous[k].copy(j.quaternion); });
        if (i < 20) seam = Math.max(seam, w);
        if (finite && i >= 12) lowest = Math.min(lowest, fighter.motionEvidence().soleGap);
      }
      if (s > 0) seams[step.label] = seam;
      if (finite) soles[step.label] = lowest;
    });
  } finally { fighter.dispose(); }
  return { seams, soles };
}

describe('the new stance against the old', () => {
  const slot = (action: AttackSlot, label: string): Step => ({ action, seconds: MOVES[ID][action].duration, duration: MOVES[ID][action].duration, label });
  const script: Step[] = [{ action: 'idle', seconds: 4, label: 'idle' }, { action: 'run', seconds: 1, speed: 5, label: 'idle>run' }, { action: 'idle', seconds: 3, label: 'run>idle' },
    slot('light', 'idle>light'), { action: 'idle', seconds: 3, label: 'light>idle' }, slot('heavy', 'idle>heavy'), { action: 'idle', seconds: 3, label: 'heavy>idle' },
    slot('special', 'idle>special'), { action: 'idle', seconds: 3, label: 'special>idle' },
    slot('ultimate', 'idle>ultimate'), { action: 'idle', seconds: 3, label: 'ultimate>idle' },
    { action: 'guard', seconds: 1, label: 'idle>guard' }, { action: 'idle', seconds: 2, label: 'guard>idle' }];
  let mine: ReturnType<typeof drive>, plain: ReturnType<typeof drive>;
  beforeAll(() => { mine = drive(false, script); plain = drive(true, script); }, 240_000);
  it('leaves and takes back the stance without a pop', () => {
    // As idleProfilesB.test.ts: a seam may sweep further from a stance further from the move, smoothly; a flip may not.
    for (const [label, after] of Object.entries(mine.seams)) {
      const before = plain.seams[label];
      expect(after, `${label}: ${after.toFixed(1)} against ${before.toFixed(1)} on the old idle`).toBeLessThanOrEqual(Math.max(before * 1.2, before + 4, 38));
    }
  });
  it('keeps his feet under every attack that starts from it', () => {
    for (const [label, lowest] of Object.entries(mine.soles)) {
      expect(lowest, `${label}: the lowest sole ${(lowest * 100).toFixed(1)} cm against ${(plain.soles[label] * 100).toFixed(1)}`).toBeLessThanOrEqual(plain.soles[label] + .015);
    }
  });
});

/** The moves (PR C, vesper-fanim4.glb): each clip drawn at a fraction of itself on the assembled body, the blade and
 *  the joints read in his own frame (+z toward the opponent). */
function drawn(fighter: Fighter, name: string, fraction: number) {
  const clip = rig.animations.find(c => c.name === name)!;
  fighter.mixer.stopAllAction();
  const action = fighter.mixer.clipAction(clip).play();
  action.time = Math.min(clip.duration - 1e-6, fraction * clip.duration);
  fighter.mixer.update(0);
  fighter.model.updateMatrixWorld(true);
}
/** Where his shoulders face: the line from his left shoulder to his right, turned a quarter to the front. */
const facing = (fighter: Fighter) => {
  const l = joint(fighter, 'LeftArm'), r = joint(fighter, 'RightArm');
  return THREE.MathUtils.radToDeg(Math.atan2(r.z - l.z, -(r.x - l.x)));
};
const pin = (contactFrames as Record<string, Record<string, number>>)[ID];

describe('Vesper\'s moves', () => {
  it.skipIf(!!ORIGINALS.vesper)('lands the light\'s thrust at full stretch, the point at their chest', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      fighter.dynamics = false;
      drawn(fighter, 'Quill Thrust', pin.light);
      const { tip, hand, dir, elevation } = blade.blade(), hips = joint(fighter, 'Hips');
      expect(dir.z, 'the point at them').toBeGreaterThan(.85);
      expect(elevation, 'level to their face').toBeGreaterThan(0);
      expect(elevation).toBeLessThan(35);
      expect(hand.z - hips.z, 'the arm out').toBeGreaterThan(.4);
      expect(tip.z - hips.z, 'the reach').toBeGreaterThan(1.1);
    } finally { fighter.dispose(); }
  });

  it.skipIf(!!ORIGINALS.vesper)('faces them through every cut of the string - the library\'s spun him a turn - and each lands in front of him', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      fighter.dynamics = false;
      for (const name of ['Quill Thrust', 'Feather Slash', 'Reverse Quill', 'Updraft', 'Hawks Talon']) {
        for (let k = 0; k <= 20; k++) {
          drawn(fighter, name, k / 20);
          const face = facing(fighter);
          expect(Math.abs(face), `${name} at ${(k / 20).toFixed(2)}: his shoulders ${face.toFixed(0)} degrees from facing them`).toBeLessThan(100);
        }
        drawn(fighter, name, name === 'Hawks Talon' ? pin.heavy : name === 'Quill Thrust' ? pin.light : pin[name]);
        const { tip, hand } = blade.blade(), hips = joint(fighter, 'Hips');
        expect(tip.z - hips.z, `${name}: the blade before him on its blow`).toBeGreaterThan(.55);
        expect(hand.z - hips.z, `${name}: the hand before him`).toBeGreaterThan(.15);
      }
    } finally { fighter.dispose(); }
  });

  it.skipIf(!!ORIGINALS.vesper)('brings Hawk\'s Talon down from over his head into the floor before him', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      fighter.dynamics = false;
      drawn(fighter, 'Hawks Talon', .3);
      const raised = blade.blade(), head = joint(fighter, 'Head');
      expect(raised.hand.y, 'the sabre raised over his head').toBeGreaterThan(head.y);
      drawn(fighter, 'Hawks Talon', pin.heavy);
      const struck = blade.blade(), hips = joint(fighter, 'Hips');
      expect(struck.hand.y, 'driven down').toBeLessThan(hips.y + .15);
      expect(struck.dir.z, 'into them').toBeGreaterThan(.8);
    } finally { fighter.dispose(); }
  });

  it.skipIf(!!ORIGINALS.vesper)('throws the spear with his left hand on its release, the sabre kept in his right', () => {
    const fighter = body();
    try {
      fighter.dynamics = false;
      drawn(fighter, 'Pale Lance', pin.special - .1);
      const wound = joint(fighter, 'LeftHand'), shoulder = joint(fighter, 'LeftArm');
      expect(wound.z, 'drawn back behind him').toBeLessThan(shoulder.z);
      expect(wound.y, 'and high').toBeGreaterThan(shoulder.y);
      drawn(fighter, 'Pale Lance', pin.special);
      const loosed = joint(fighter, 'LeftHand');
      expect(loosed.y, 'let go over the top').toBeGreaterThan(joint(fighter, 'Head').y);
      drawn(fighter, 'Pale Lance', pin.special + .15);
      expect(joint(fighter, 'LeftHand').z, 'driven on down before him').toBeGreaterThan(joint(fighter, 'LeftArm').z + .15);
    } finally { fighter.dispose(); }
  });

  it.skipIf(!!ORIGINALS.vesper)('opens Evensong with the thrust at their chest (the take thrust with his hand behind his hips)', () => {
    const fighter = body(), blade = sabre(fighter);
    try {
      fighter.dynamics = false;
      drawn(fighter, 'Evensong', .157);
      const { tip, hand, dir } = blade.blade(), hips = joint(fighter, 'Hips');
      expect(hand.z - hips.z, 'the hand before him').toBeGreaterThan(.35);
      expect(tip.z - hips.z, 'the point at them').toBeGreaterThan(1);
      expect(dir.z).toBeGreaterThan(.8);
    } finally { fighter.dispose(); }
  });
});

/** Black Vespers's moves (PR D, 8 October 2026: vesper-black-vespers-fanim1.glb, scripts/fanim/vesper.py's `black-vespers` job), bound in
 *  the form's `formExtraModels`. His body as FighterLibrary builds it: the form's file and those, bound by bone name. */
async function blackVespers() {
  const form = await loadRig(FIGHTERS[ID].formModel!);
  for (const url of FIGHTERS[ID].formExtraModels ?? []) {
    const clips = bindClips(form.scene, (await loadRig(url)).animations, 'Black Vespers'), names = new Set(clips.map(c => c.name));
    form.animations = [...form.animations.filter(c => !names.has(c.name)), ...clips];
  }
  return form;
}
// (Vesper's own form carries the eight takes in its own file, so that file is where they are held.)
const BLACK_VESPERS_TAKES = ORIGINALS.vesper ? FIGHTERS[ID].formModel! : '/assets/fighters/vesper-black-vespers-fanim1.glb';
/** Each clip's length in a GLB, read off its key times. */
const durations = (path: string) => {
  const file = fs.readFileSync(`public${path}`);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString()) as {
    accessors: { max?: number[] }[]; animations?: { name: string; samplers: { input: number }[] }[] };
  return new Map((json.animations ?? []).map(a => [a.name, Math.max(...a.samplers.map(s => json.accessors[s.input].max?.[0] ?? 0))]));
};

describe('Black Vespers\'s moves', () => {
  it('throws every slot and each stage of the string on a take of his own', async () => {
    // His string threw the light's thrust three times over (a form picks its rush clips by their names: Fighter.ts
    // FORM_NAMED_RUSH), and his special the idle (he had no Pale Lance).
    const own = durations(BLACK_VESPERS_TAKES), fighter = body();
    try {
      fighter.attachForm(await blackVespers());
      const plays = (state: Partial<PlayerState>, frames: number) => {
        const seen = new Set<string>();
        for (let i = 0; i < frames; i++) {
          fighter.update(1 / 60, { ...base(ID), awakened: true, ...state, actionTime: i / frames } as PlayerState, true, 1 / 60);
          const e = fighter.motionEvidence();
          if (e.formVisible && e.formClip) seen.add(e.formClip);
        }
        for (let i = 0; i < 30; i++) fighter.update(1 / 60, { ...base(ID), awakened: true, action: 'idle' }, true, 1 / 60);
        return [...seen];
      };
      FIGHTERS[ID].rushClips!.forEach((name, k) => {
        const stage = k + 1;
        expect(plays({ action: 'light', chain: stage, actionSeq: 20 + stage, actionStarted: 2 + stage, actionDuration: .3 }, 18), `stage ${stage}`).toEqual([name]);
        expect(own.has(name), `${name} is a take of his`).toBe(true);
      });
      (['light', 'heavy', 'special', 'ultimate'] as const).forEach((slot, k) => {
        const name = FIGHTERS[ID].clips![k], d = MOVES[ID][slot].duration;
        expect(plays({ action: slot, actionSeq: 40 + k, actionStarted: 9 + k, actionDuration: d }, Math.round(d * 60)), slot).toEqual([name]);
        expect(own.has(name), `${name} is a take of his`).toBe(true);
      });
    } finally { fighter.dispose(); }
  }, 120_000);

  it('keeps each clip\'s length (the Pale Lance new, of the move\'s own)', () => {
    const before = durations(FIGHTERS[ID].formModel!), after = durations(BLACK_VESPERS_TAKES);
    const takes = ['Reverse Quill', 'Evensong', 'Raven Dive', 'Feather Slash', 'Hawks Talon', 'Updraft', 'Quill Thrust', 'Pale Lance'];
    // (An original's form file is the takes' own and carries his other clips besides: each take is in it.)
    if (ORIGINALS.vesper) for (const name of [...after.keys()]) if (!takes.includes(name)) after.delete(name);
    expect([...after.keys()].sort()).toEqual(takes.sort());
    for (const [name, seconds] of after) {
      const was = name === 'Pale Lance' ? MOVES[ID].special.duration : before.get(name);
      expect(was, name).toBeDefined();
      expect(Math.abs(seconds - was!), name).toBeLessThan(1e-3);
    }
  });

  /** Black Vespers's body drawn at a fraction of one of his clips, and his left wrist: the auto-rig put his LeftHand joint 32 cm
   *  up his wing, so the wrist is the right's mirrored across him at rest, carried on his left forearm. */
  async function blackVespersBody() {
    const form = await blackVespers(), fighter = new Fighter(base(ID), form, true);
    fighter.dynamics = false;
    // At rest, as loaded (its nodes' rest is the bind pose).
    fighter.model.updateMatrixWorld(true);
    const at = (name: string) => fighter.joints.get(name)!.getWorldPosition(new THREE.Vector3());
    const hips = at('Hips'), right = at('RightHand'), side = at('LeftArm').sub(at('RightArm')).setY(0).normalize();
    const wrist = right.clone().addScaledVector(side, -2 * right.clone().sub(hips).dot(side));
    const fore = fighter.joints.get('LeftForeArm')!, local = fore.worldToLocal(wrist.clone());
    return {
      fighter,
      clips: form.animations,
      draw(name: string, fraction: number) {
        const clip = form.animations.find(c => c.name === name)!;
        fighter.mixer.stopAllAction();
        const action = fighter.mixer.clipAction(clip).play();
        action.time = Math.min(clip.duration - 1e-6, fraction * clip.duration);
        fighter.mixer.update(0);
        fighter.model.updateMatrixWorld(true);
      },
      leftWrist: () => fighter.group.worldToLocal(fore.localToWorld(local.clone())),
    };
  }

  it('faces them through every take, and lands each blow before him with the claw that throws it', async () => {
    const { fighter, draw, leftWrist } = await blackVespersBody();
    try {
      for (const name of ['Quill Thrust', 'Feather Slash', 'Reverse Quill', 'Updraft', 'Hawks Talon', 'Pale Lance']) {
        for (let k = 0; k <= 20; k++) {
          draw(name, k / 20);
          const face = facing(fighter);
          expect(Math.abs(face), `${name} at ${(k / 20).toFixed(2)}: his shoulders ${face.toFixed(0)} degrees from facing them`).toBeLessThan(75);
        }
      }
      const reach = (name: string, fraction: number, hand: () => THREE.Vector3) => { draw(name, fraction); return hand().sub(joint(fighter, 'Hips')); };
      const rightHand = () => joint(fighter, 'RightHand');
      expect(reach('Quill Thrust', pin.light, rightHand).z, 'the light: his right claw out at them').toBeGreaterThan(.5);
      expect(reach('Feather Slash', pin['Feather Slash'], rightHand).z, 'the rake: his right before him').toBeGreaterThan(.4);
      expect(reach('Reverse Quill', pin.ReverseQuill, leftWrist).z, 'the backhand: his left before him').toBeGreaterThan(.25);
      const rising = reach('Updraft', pin['Updraft'], rightHand);
      expect(rising.z, 'the rising claws: before him').toBeGreaterThan(.3);
      expect(rising.y, 'and up past his shoulders').toBeGreaterThan(joint(fighter, 'RightArm').y - joint(fighter, 'Hips').y);
      draw('Hawks Talon', .3);
      expect(joint(fighter, 'RightHand').y, 'the Talon: both fists raised over his head').toBeGreaterThan(joint(fighter, 'Head').y);
      expect(leftWrist().y).toBeGreaterThan(joint(fighter, 'Head').y);
      const talon = reach('Hawks Talon', pin.heavy, rightHand);
      expect(talon.z, 'and brought down before him').toBeGreaterThan(.35);
      expect(talon.y, 'low').toBeLessThan(.3);
    } finally { fighter.dispose(); }
  });

  it('looses the spear straight at them from his open right hand on the frame the simulation lets it go', async () => {
    // A thrown move's clip is drawn in its motion (Fighter.clipMotionTable): the release is where the move's own
    // release time falls in it, and the arm is out straight there, not still coming over by his head.
    const { fighter, draw, clips } = await blackVespersBody();
    try {
      const clip = clips.find(c => c.name === 'Pale Lance')!, move = MOVES[ID].special;
      const at = clipAtMotion(clipMotionTable(clip), move.contacts[0] / move.duration);
      draw('Pale Lance', at);
      const hand = joint(fighter, 'RightHand'), shoulder = joint(fighter, 'RightArm'), head = joint(fighter, 'Head');
      expect(hand.z - shoulder.z, 'the arm out at them').toBeGreaterThan(.35);
      expect(Math.abs(hand.y - shoulder.y), 'straight from the shoulder').toBeLessThan(.25);
      expect(hand.z, 'well before his face').toBeGreaterThan(head.z + .3);
      draw('Pale Lance', at - .1);
      expect(joint(fighter, 'RightHand').z, 'drawn back before it').toBeLessThan(hand.z - .3);
    } finally { fighter.dispose(); }
  });
});
