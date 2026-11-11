import { describe, expect, it } from 'vitest';
import contactFrames from '../src/game/data/contactFrames.json';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { sceneJoints, strikeFraction } from '../src/render/characterMotion';
import { resolveSkeleton } from '../src/render/skeleton';
import { loadRig } from './rigHarness';
import { guardTakes, type Take } from './takeGuard';
import { COMBO_CLIPS } from '../src/render/comboClips';
import { MOVES } from '../src/game/moves';
import * as THREE from 'three';
import { buildBody, localRun } from './reactHarness';
import { ORIGINALS } from '../src/originals/roster';

/** The feel pass: the most-used strings hand-posed (scripts/fanim/lights.py) - each fighter's light and its
 *  three rush stages, replacing the clips of the same names. Presentation only: each take keeps the length of the clip
 *  it replaces, so every contact fraction (src/game/data/contactFrames.json) and every hit's timing is what it was.
 *
 *  And each take keys the joints above the hips wherever the body has a clip that turns them: the export leaves out a
 *  channel held at rest, and in the game a joint no playing clip keys keeps the last pose another clip gave it. Nigo's
 *  own clips turn his Biped root a hundred degrees where his rush file holds it at rest, so a `Rush 1` without the root
 *  channel stood him on his head after `Haizan Cut` (scripts/fanim/restore_still.py puts such channels back). The
 *  guard is tests/takeGuard.ts's, which the heavies' (tests/heavyTakes.test.ts) share. */
const TAKES: Take[] = [
  ['taisei', 'taisei-fanim1.glb', ['taisei-grounded-rock', 'Rush 1', 'Rush 2', 'Rush 3']],
  ['gummy', 'gummy-fanim1.glb', ['Snapback Jab', 'Rush 1', 'Rush 2', 'Rush 3'], ['gummy-rush1.glb']],
  ['shiden', 'shiden-fanim3.glb', ['Habakiri Cut', 'Rush 1', 'Rush 2', 'Rush 3'], ['shiden-rush1.glb']],
  ['nigo', 'nigo-fanim5.glb', ['Haizan Cut', 'Rush 1', 'Rush 2', 'Rush 3'], ['nigo-fanim1.glb', 'nigo-rush1.glb']],
  ['kenzo', 'kenzo-fanim1.glb', ['Fang Crossing', 'Rush 1', 'Rush 2', 'Rush 3'], ['kenzo-rush1.glb']],
  ['ouga', 'ouga-fanim6.glb', ['Ki Straight', 'Rush 1', 'Rush 2', 'Rush 3'], ['ouga-straight1.glb', 'ouga-fanim1.glb', 'ouga-rush1.glb']],
  ['shirokane', 'shirokane-fanim2.glb', ['Scrap Kunai', 'Rush 1', 'Rush 2', 'Rush 3'], ['shirokane-rush1.glb']],
  ['kuon', 'kuon-fanim1.glb', ['Hex Strike', 'Rush 1', 'Rush 2', 'Rush 3'], ['kuon-rush1.glb']],
  // Kosho's Rush 1 (the handstand split kick) already landed at full length, and Setsu's light is drawn by
  // characterMotion.ts, not by a clip: neither is in its take.
  ['kosho', 'kosho-fanim4.glb', ['Amuse-Bouche', 'Rush 2', 'Rush 3'], ['kosho-enders1.glb', 'kosho-fmoves1.glb', 'kosho-fanim1.glb']],
  ['kagari', 'kagari-fanim1.glb', ['Hinoko', 'Rush 1', 'Rush 2', 'Rush 3'], ['kagari-rush1.glb']],
  ['setsu', 'setsu-fanim2.glb', ['Rush 1', 'Rush 2', 'Rush 3'], ['setsu-rush2.glb']],
  ['ward', 'ward-fanim1.glb', ['Lancet Slash', 'Rush 1', 'Rush 2', 'Rush 3'], ['ward-rush1.glb']],
  // Iteration fifteen. KoKo's and LORD ORO's own blows, thrown awakened or in the air (grounded, their spirits throw theirs:
  // a fanim script since retired): KoKo's light and his finisher, LORD ORO's light - their Rush 1 and 2 already landed a
  // full-length straight or a kick. Gaunt' Rising Hack, which came down; his other three cut through as named.
  ['koko', 'koko-fanim5.glb', ['Straight Punch', 'Rush 3'], ['koko-enders1.glb', 'koko-fanim4.glb', 'koko-rush1.glb']],
  ['oro', 'oro-fanim5.glb', ['Gilded Punch'], ['oro-enders1.glb', 'oro-fanim4.glb', 'oro-rush1.glb']],
  ['gaunt', 'gaunt-fanim2.glb', ['Rush 2']],
  ['magatsu', 'magatsu-fanim2.glb', ['Flaying Cut', 'Hex Slash', 'Hex Rise']],
  ['imago', 'imago-fanim3.glb', ['Chitin Jab', 'Mantis Hook', 'Rising Barb'], ['imago-fanim2.glb']],
  ['gaku', 'gaku-fanim3.glb', ['Lion Fist', 'Cub Jab', 'Rising Paw'], ['gaku-fanim2.glb']],
  ['akagane', 'akagane-fanim3.glb', ['Warlord Jab', 'Warlord Rise', 'War Fan Sweep']],
  ['tobari', 'tobari-fanim3.glb', ['Kunai Slash', 'Quill Slice', 'Rookwing Rise']],
  ['shiun', 'shiun-fanim3.glb', ['Hymn Palm', 'Presence Turn', 'Flash Dash', 'Relic Rise'], ['shiun-fanim2.glb']],
  ['rook', 'rook-fanim2.glb', ['Talon Cut', 'Shadow Cut', 'Raven Rise']],
  ['gohaku', 'gohaku-fanim2.glb', ['Long-Arm Fist', 'Beast Rush 2']],
  ['wuming', 'wuming-fanim2.glb', ['Lightless Strike', 'Dusk Rush 2']],
  // Iteration sixteen: the blades that landed a beat early or late - Asahi's light and Rising Slash (his Ember Chop is
  // pinned instead, below), Gorai's light (his Rush 2 plays it too), Levin's light, Nick and Lift Off - and
  // Akagane's War Fan Sweep (above), its spin taken out.
  ['asahi', 'asahi-fanim2.glb', ['Ripple Cut', 'Rising Slash']],
  ['gorai', 'gorai-fanim3.glb', ['Mast Breaker'], ['gorai-fanim2.glb']],
  ['levin', 'levin-fanim2.glb', ['Shave', 'Nick', 'Lift Off']],
  // Vesper's (7 October 2026, scripts/fanim/vesper.py): a lunging thrust, a forehand and a backhand carried across
  // by the turn of his body, and a rising cut - the library's cuts spun him round, his back to them on three of four.
  ['vesper', 'vesper-fanim4.glb', ['Quill Thrust', 'Feather Slash', 'Reverse Quill', 'Updraft']],
];

guardTakes('the hand-posed light strings', TAKES);

const TABLE = contactFrames as Partial<Record<FighterId, Record<string, number>>>;
const PINNED: [FighterId, string][] = [
  ['magatsu', 'Hex Slash'], ['magatsu', 'Hex Rise'], ['imago', 'Chitin Jab'], ['imago', 'Mantis Hook'], ['imago', 'Rising Barb'],
  ['gaku', 'Cub Jab'], ['gaku', 'Rising Paw'], ['akagane', 'Warlord Jab'], ['akagane', 'Warlord Rise'], ['tobari', 'Quill Slice'],
  ['shiun', 'Presence Turn'], ['shiun', 'Flash Dash'], ['shiun', 'Relic Rise'], ['rook', 'Shadow Cut'], ['rook', 'Raven Rise'],
  ['gohaku', 'Beast Rush 2'], ['wuming', 'Dusk Rush 2'],
  ['asahi', 'Rising Slash'], ['levin', 'Nick'], ['levin', 'Lift Off'],
  ['tobari', 'Rookwing Rise'],
  ['vesper', 'Feather Slash'], ['vesper', 'Reverse Quill'], ['vesper', 'Updraft'],
];
describe('the re-posed shop stages stay drawn where they were first drawn', () => {
  it.each(PINNED.filter(([id]) => !ORIGINALS[id]))('%s: %s', async (id, name) => {
    const rig = await loadRig(FIGHTERS[id].model), clip = rig.animations.find(c => c.name === name);
    expect(clip, `${id} ${name}`).toBeDefined();
    expect(FIGHTERS[id].rushClips, `${id}: a rush stage`).toContain(name);
    const measured = strikeFraction(rig.scene, clip!, sceneJoints(rig.scene, resolveSkeleton));
    expect(measured, `${id} ${name}: measured off the rip`).toBeDefined();
    expect(TABLE[id]?.[name], `${id} ${name}: pinned`).toBeCloseTo(measured!, 3);
  }, 60_000);
  it.skipIf(!!ORIGINALS.asahi)('asahi: Ember Chop, drawn where its blade is furthest out', async () => {
    expect(FIGHTERS.asahi.rushClips).toContain('Ember Chop');
    const body = await buildBody('asahi', 'a') as unknown as { clips: THREE.AnimationClip[]; model: THREE.Object3D; group: THREE.Group;
      joints: Map<string, THREE.Bone>; rightReach?: THREE.Vector3; rightBone?: THREE.Bone; dispose(): void };
    try {
      const clip = body.clips.find(c => c.name === 'Ember Chop')!, mixer = new THREE.AnimationMixer(body.model), action = mixer.clipAction(clip).play();
      expect(body.rightReach && body.rightBone, 'his katana').toBeTruthy();
      const n = 400;
      let best = -Infinity, at = 0;
      for (let i = Math.ceil(.12 * n); i <= Math.floor(.88 * n); i++) {
        action.time = clip.duration * i / n; mixer.update(0); body.model.updateMatrixWorld(true);
        const tip = body.group.worldToLocal(body.rightReach!.clone().applyMatrix4(body.rightBone!.matrixWorld));
        const hips = body.group.worldToLocal(body.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()));
        if (tip.z - hips.z > best) { best = tip.z - hips.z; at = i / n; }
      }
      expect(TABLE.asahi?.['Ember Chop'], `the blade furthest out at ${at.toFixed(3)}`).toBeCloseTo(at, 2);
    } finally { body.dispose(); }
  }, 60_000);
});

const ON_RIP: Partial<Record<FighterId, string[]>> = { tobari: ['llh'] };
/** The clip of a name as FighterLibrary binds it: the body's, an extra file's in its place, the rush file's only for a name
 *  nothing else carries. */
async function played(id: FighterId, name: string) {
  const def = FIGHTERS[id];
  let found: THREE.AnimationClip | undefined;
  for (const url of [def.model, ...def.extraModels ?? []]) found = (await loadRig(url)).animations.find(c => c.name === name) ?? found;
  if (!found && def.rushModel) found = (await loadRig(def.rushModel)).animations.find(c => c.name === name);
  return found!;
}
describe('the combo enders that play a re-posed clip land on its blow', () => {
  for (const [id, take, clips] of TAKES) {
    for (const [key, row] of Object.entries(COMBO_CLIPS[id] ?? {})) {
      if (!row || row.span !== undefined || !clips.includes(row.clip)) continue;
      if (ON_RIP[id]?.includes(key)) {
        it.skipIf(!!ORIGINALS[id])(`${id} ${key}: ${row.clip}, the reference over all it plays`, async () => {
          const rip = (await loadRig(FIGHTERS[id].model)).animations.find(c => c.name === row.clip)!;
          const mine = (await loadRig(`/assets/fighters/${take}`)).animations.find(c => c.name === row.clip)!;
          const a = new THREE.Quaternion(), b = new THREE.Quaternion();
          let worst = 0, where = '';
          for (const track of mine.tracks) {
            if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
            const theirs = rip.tracks.find(t => t.name === track.name);
            if (!theirs) continue;
            // (createInterpolant is on the base track at runtime, not in the typings.)
            type Sampler = { createInterpolant(): { evaluate(t: number): ArrayLike<number> } };
            const ours = (track as unknown as Sampler).createInterpolant(), them = (theirs as unknown as Sampler).createInterpolant();
            for (let t = row.from ?? 0; t <= (row.to ?? mine.duration); t += 1 / 120) {
              a.fromArray(Array.from(ours.evaluate(t))); b.fromArray(Array.from(them.evaluate(t)));
              const angle = THREE.MathUtils.radToDeg(a.angleTo(b));
              if (angle > worst) { worst = angle; where = `${track.name} at ${t.toFixed(3)} s`; }
            }
          }
          expect(worst, `the take against the rip, worst ${where}`).toBeLessThan(2);
        }, 60_000);
        continue;
      }
      it(`${id} ${key}: ${row.clip}`, async () => {
        const light = MOVES[id].light;
        const blow = TABLE[id]?.[row.clip] ?? (row.clip === FIGHTERS[id].clips?.[0] ? TABLE[id]?.light ?? light.contacts[0] / light.duration : undefined);
        expect(blow, `${id} ${row.clip}: the take's blow`).toBeDefined();
        // (An original carries its take in its own files, at the take's length (tests/originals.test.ts), so the clip is the one
        // its body plays.)
        const clip = ORIGINALS[id] ? await played(id, row.clip) : (await loadRig(`/assets/fighters/${take}`)).animations.find(c => c.name === row.clip)!;
        expect(clip, `${id} ${row.clip}: a clip the body plays`).toBeDefined();
        const at = row.from !== undefined ? (row.from + (row.contact ?? .5) * (row.to! - row.from)) / clip.duration : row.contact ?? .5;
        expect(at, `${id} ${key}: drawn at`).toBeCloseTo(blow!, 2);
      }, 60_000);
    }
  }
});

/** After iteration sixteen: Tobari's Rookwing Rise is shown from where its wind-up starts (0.65 of the clip, paced by its
 *  motion), turned away and diving, and the stage's blend swung him round from Shadow Kick's finish in 90 ms - his hand
 *  68-74 cm in a frame, five seeds. The take begins from the pose Shadow Kick leaves him in and carries him round
 *  through the wind-up (scripts/fanim/lights.py ROOKWING_RISE): measured 29-33. Held under 40 cm a frame (the critic's
 *  step, a sixtieth of a second) through the stage's first fourteen frames, with presses mashed and spaced. */
describe('Tobari\'s Rookwing Rise opens without swinging him round', () => {
  it.each([[7, 9], [8, 9], [7, 20]])('seed %i, a press every %i ticks', async (seed, every) => {
    const body = await buildBody('tobari', 'a'), other = await buildBody('taisei', 'b');
    try {
      const presses = [0, 1, 2, 3].map(k => ({ tick: 30 + k * every, attack: 'light' as const }));
      const samples = localRun(body, other, presses, 230 + 3 * (every - 9), 3.5, { seed });
      const first = samples.findIndex(s => s.clip === 'Rookwing Rise');
      expect(first, 'the string reached Rookwing Rise').toBeGreaterThan(0);
      let worst = 0;
      for (let i = first; i < Math.min(samples.length, first + 14); i++) {
        const [p, q] = [samples[i - 1], samples[i]], dt = (q.t - p.t) * 1000;
        worst = Math.max(worst, Math.hypot(q.hand[0] - p.hand[0], q.hand[1] - p.hand[1], q.hand[2] - p.hand[2]) * 100 * 16.67 / Math.max(8, dt));
      }
      expect(worst, 'the hand, cm a sixtieth of a second').toBeLessThan(40);
    } finally { body.dispose(); other.dispose(); }
  }, 120_000);
});
