import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { Fighter, bindClips } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';
import { loadRigWithExtras } from './extraClips';
import { base, loadRig } from './rigHarness';
import { REHIT, allPops, buildBody, criticPops, victimRun, type Press, type ReactSample } from './reactHarness';
import { guardNewTakes, guardTakes, type Take } from './takeGuard';
import { ORIGINALS } from '../src/originals/roster';

const SHOP: FighterId[] = ['gaunt', 'gorai', 'haldor', 'sorrel', 'dorado', 'shiun', 'magatsu', 'vesper', 'imago', 'jirenga',
  'ippon', 'sekka', 'tobari', 'akagane', 'asahi', 'levin', 'gaku', 'gohaku', 'wuming', 'jinlin', 'rook'];
/** The shop rigs whose hurt was the slow 1.3 s turn, or restarted its pose from the stance at each blow (Gorai's,
 *  Sorrel'). */
const TURNING = new Set<FighterId>(['vesper', 'imago', 'gaku', 'rook', 'gorai', 'sorrel']);
/** Iteration fifteen: the shop rigs whose hurt was the arms-flung twist eleven of them share, still swinging at the
 *  recoil's peak (the hand at 3-4 heights a second at 0.19 s, every other hurt in the game under 1.2 but Gaunt'), so the
 *  hold froze it mid-swing and the play-out set it going again: the recoil now. */
const FLUNG = new Set<FighterId>(['magatsu', 'jirenga', 'ippon', 'sekka', 'tobari', 'akagane', 'asahi', 'levin', 'gohaku', 'wuming', 'jinlin']);
/** And the hurts kept as drawn, begun part-way into the pose they strike (reactions.py `lead`). */
const LED: FighterId[] = ['koko', 'oro', 'kuon', 'nigo', 'gummy', 'shiun', 'haldor'];
const rekeyed = (id: FighterId) => TURNING.has(id) || FLUNG.has(id) || LED.includes(id);
const shopTake = (id: FighterId) => `${id}-fanim${id === 'tobari' || id === 'akagane' ? 2 : 1}.glb`;
// Konta's hurt and flinch are on his canonical rig now (konta-takes1.glb): tests/kontaCanon.test.ts.
const TAKES: Take[] = [
  ['taisei', 'taisei-fanim3.glb', ['shake']],
  ['gummy', 'gummy-fanim3.glb', ['Hit 01']],
  ...SHOP.map(id => [id, shopTake(id), rekeyed(id) ? ['Hit 01', 'shake'] : ['shake']] as Take),
];
guardTakes('the hit reactions', TAKES);
// The downed poses.
guardNewTakes('the downed poses', [
  // Gaunt' rig has its own.
  ...SHOP.filter(id => id !== 'gaunt').map(id => [id, shopTake(id), [['down_lp', 0, .05]]] as [FighterId, string, [string, number, number][]]),
]);

/** Each re-keyed clip on its body: [fighter, clip, how far the chest is turned at the peak against the clip's last
 *  frame - the stance it settles in - at the least, degrees]. */
const STRUCK: [FighterId, string, number][] = [
  ['konta', 'Hit 01', 25], ['konta', 'shake', 12], ['taisei', 'shake', 12], ['shiden', 'shake', 12], ['nigo', 'shake', 12],
  ['ouga', 'shake', 12], ['shirokane', 'shake', 12], ['kagari', 'Hit 01', 25],
  ['ward', 'Hit 01', 20], ['kuon', 'shake', 12], ['setsu', 'shake', 12],
  ['kosho', 'Hit 01', 25], ['koko', 'shake', 12], ['oro', 'shake', 12],
  ...SHOP.flatMap(id => [[id, 'shake', 10] as [FighterId, string, number], ...(TURNING.has(id) || FLUNG.has(id) ? [[id, 'Hit 01', 20] as [FighterId, string, number]] : [])]),
];
describe('a reaction strikes its pose at the recoil\'s peak and settles back into the stance', () => {
  it.each(STRUCK)('%s %s', async (fighter, name, least) => {
    const body = new Fighter(base(fighter), await loadRigWithExtras(fighter));
    try {
      const clip = body.clips.find(c => c.name === name)!;
      expect(clip, name).toBeDefined();
      const chest = (body.joints.get('Spine2') ?? body.joints.get('Spine1'))!, head = body.joints.get('Head')!;
      const mixer = new THREE.AnimationMixer(body.model), action = mixer.clipAction(clip).play();
      const at = (t: number) => { action.time = t; mixer.update(0); body.model.updateMatrixWorld(true); return [chest, head].map(b => b.getWorldQuaternion(new THREE.Quaternion())); };
      const settled = at(clip.duration), peak = at(Math.min(.2, .3 * clip.duration));
      const turned = (a: THREE.Quaternion, b: THREE.Quaternion) => THREE.MathUtils.radToDeg(a.angleTo(b));
      expect(turned(peak[0], settled[0]), `${fighter} ${name}: the chest at the peak`).toBeGreaterThan(least);
      expect(turned(peak[1], settled[1]), `${fighter} ${name}: the head at the peak`).toBeGreaterThan(least);
      // The stance it ends in is the one it began from, as far as the start's share of the pose allows.
      const first = at(0);
      expect(turned(first[0], settled[0]), `${fighter} ${name}: the chest's way back`).toBeLessThan(turned(peak[0], settled[0]));
      mixer.stopAllAction();
    } finally { body.dispose(); }
  }, 60_000);
});

describe('a hurt kept as drawn begins part-way into the pose it strikes', () => {
  const kept = LED.filter(id => !ORIGINALS[id]);
  if (!kept.length) it.skip('every fighter listed is an original', () => {});
  it.each(kept)('%s', async fighter => {
    const own = (await loadRig(FIGHTERS[fighter].model)).animations.find(c => c.name === 'Hit 01')!;
    const body = new Fighter(base(fighter), await loadRigWithExtras(fighter));
    try {
      const clip = body.clips.find(c => c.name === 'Hit 01')!;
      expect(Math.abs(clip.duration - own.duration), 'its length').toBeLessThan(1 / 30);
      const joints = [(body.joints.get('Spine2') ?? body.joints.get('Spine1'))!, body.joints.get('Head')!];
      const mixer = new THREE.AnimationMixer(body.model);
      const pose = (c: THREE.AnimationClip, t: number) => {
        mixer.stopAllAction(); const action = mixer.clipAction(c).play(); action.time = t; mixer.update(0); body.model.updateMatrixWorld(true);
        return joints.map(b => b.getWorldQuaternion(new THREE.Quaternion()));
      };
      const peak = Math.min(.2, .3 * clip.duration), deg = (a: THREE.Quaternion, b: THREE.Quaternion) => THREE.MathUtils.radToDeg(a.angleTo(b));
      const was = pose(own, 0), wasPeak = pose(own, peak), now = pose(clip, 0), nowPeak = pose(clip, peak);
      for (const k of [0, 1]) {
        const what = k ? 'the head' : 'the chest';
        // The pose it strikes is its own; its first frame is under half as far from it as the stance it began in.
        expect(deg(nowPeak[k], wasPeak[k]), `${fighter}: ${what} at the peak`).toBeLessThan(2);
        expect(deg(now[k], nowPeak[k]), `${fighter}: ${what}'s way in`).toBeLessThan(.5 * deg(was[k], wasPeak[k]) + .5);
      }
      mixer.stopAllAction();
    } finally { body.dispose(); }
  }, 60_000);
});

type Script = [FighterId, string, Press[], number, FighterId, number?];
const STRING: Press[] = [0, 9, 18, 27].map(t => ({ tick: 30 + t, attack: 'light' }));
const HEAVY: Press[] = [{ tick: 30, attack: 'heavy' }];
const striker = (id: FighterId): FighterId => id === 'taisei' ? 'konta' : 'taisei';
const MAIN: FighterId[] = ['konta', 'taisei', 'gummy', 'kenzo', 'shiden', 'nigo', 'ouga', 'shirokane', 'kagari', 'ward', 'kuon', 'setsu', 'kosho', 'koko', 'oro'];
/** Iteration fifteen: [the body, the string that stepped its hand or head furthest in 'Hit 01' before, the seed] - then
 *  the arm fling's turn-over (Fighter.ts `hitReact`), late in a long hurt, on the bodies it stepped 7-10 cm, the
 *  server's restart after a touch, and a launch out of the recoil. */
const WORST: [FighterId, FighterId, number][] = [
  ['magatsu', 'kosho', 8], ['jirenga', 'kosho', 8], ['ippon', 'kosho', 8], ['sekka', 'nigo', 8], ['tobari', 'kosho', 8],
  ['akagane', 'kosho', 8], ['asahi', 'jirenga', 8], ['levin', 'koko', 8], ['gohaku', 'jirenga', 8], ['wuming', 'imago', 7],
  ['jinlin', 'haldor', 8], ['koko', 'imago', 7], ['oro', 'kosho', 8], ['kuon', 'kosho', 8], ['nigo', 'gaunt', 8],
  ['gummy', 'shirokane', 8], ['shiun', 'kosho', 7], ['haldor', 'koko', 8],
  ['kagari', 'shirokane', 7], ['dorado', 'koko', 8], ['sorrel', 'koko', 8], ['gorai', 'shirokane', 7], ['kenzo', 'koko', 8],
  // And the server's restart after a touch (Fighter.ts, struck again): Gummy's led hurt, a head 15 cm.
  ['gummy', 'haldor', 7],
  // And a launch out of the recoil (Fighter.ts, LAUNCH_ENTRY_MAX): Akagane thrown by Sekka's finisher, his arms half a turn
  // from the launch's flail, a hand 26.6 cm in one frame of a tenth-of-a-second blend.
  ['akagane', 'sekka', 7],
  // Iteration sixteen, the short recoils' let-go (reactions.py `blow_keys`, one even release): what it caught before -
  // Gohaku's hand 14 cm under Gaunt' string, Kagari's 8.0-8.1 under six - and what a let-go reaching its speed too soon caught
  // instead (Shiden's string on Gohaku and Akagane, 11.6 and 12.5).
  ['gohaku', 'gaunt', 8], ['kagari', 'ouga', 8], ['kagari', 'kuon', 8], ['kagari', 'sorrel', 8], ['kagari', 'levin', 8], ['kagari', 'shiun', 8],
  ['kagari', 'magatsu', 8], ['gohaku', 'shiden', 7], ['akagane', 'shiden', 7],
  // Iteration seventeen, the pops that were not re-hits: Dorado's get-up (a head 11-12 cm under sixteen strings) and his
  // launch's tumble (18 cm under five), Konta's and Gaunt' slams in the air (10-14 cm under ten) - each on the string
  // and seed that showed it worst.
  ['dorado', 'jinlin', 7], ['dorado', 'tobari', 8], ['dorado', 'kosho', 7], ['dorado', 'setsu', 7], ['dorado', 'sekka', 8],
  ['konta', 'kagari', 8], ['konta', 'tobari', 7], ['gaunt', 'konta', 8], ['gaunt', 'gorai', 7],
];
const SCRIPTS: Script[] = [
  ...[...MAIN, ...SHOP].flatMap(id => [
    [id, 'a light string', STRING, 30 + 200, striker(id)] as Script,
    [id, 'a heavy, the knockdown and the get-up', HEAVY, 30 + 330, striker(id)] as Script]),
  // Konta's string, whose multi-hit stages flinch (Taisei's lights are each a hurt).
  ...(['ouga', 'shirokane', 'kagari', 'ward', 'setsu', 'kosho', 'vesper', 'gorai'] as FighterId[])
    .map(id => [id, 'Konta\'s light string', STRING, 30 + 200, 'konta'] as Script),
  ...[...FLUNG, ...LED].flatMap(id => [7, 8].map(seed => [id, `Konta's light string, seed ${seed}`, STRING, 30 + 200, 'konta', seed] as Script)),
  ...WORST.map(([id, by, seed]) => [id, `${by}'s light string, seed ${seed}`, STRING, 30 + 200, by, seed] as Script),
  // The re-hits on a body still reeling (reactClips.test.ts holds Gummy's, Taisei's and Kenzo's).
  ...(['konta', 'shiden', 'nigo', 'kagari', 'ward', 'kosho', 'gaku'] as FighterId[]).map(id => [id, 'seven lights, a launch, a juggle and a second launch', REHIT, 30 + 400, 'taisei'] as Script),
];
/** A pop the body had before the takes, in a clip they leave as it was. None now: the re-hit allowances iteration
 *  fourteen kept - a head 8-10 cm in the frame a second blow restarts 'Hit 01' on KoKo, LORD ORO, Sekka, Tobari, Akagane,
 *  Wuming and Emperor Jinlin - went with the re-hits (iteration fifteen), and Gaunt' own slam, a head 12-13.9 cm in the
 *  air under Taisei's and Konta's strings, with its motion rounded (iteration seventeen, reactions.py `smooth`). */
const KNOWN: Partial<Record<FighterId, RegExp>> = {
  ...(ORIGINALS.imago ? { imago: /^head 6(\.\d)? cm knockdown->knockdown down_lp->down_lp$/ } : {}),
};
/** The rigs given a downed pose, by the name of it. */
const DOWNED: Partial<Record<FighterId, string>> = {
  ...Object.fromEntries(SHOP.filter(id => id !== 'gaunt').map(id => [id, 'down_lp'])),
};
describe('a body taking blows in the new reactions never jumps a frame', () => {
  it.each(SCRIPTS)('%s, %s', async (id, _what, presses, ticks, by, seed = 7) => {
    const victim = await buildBody(id, 'b'), attacker = await buildBody(by, 'a');
    try {
      const { samples, events } = victimRun(victim, attacker, presses, ticks, { seed });
      expect(events.filter(e => e.kind === 'hit' && e.targetId === 'b').length, 'the blows landed').toBeGreaterThan(0);
      // The critic's measure (tests/reactHarness.ts): a hand over 8 cm or a head over 6 cm in a frame, three times the
      // frames around it. Measured before the takes: none; Konta's first recoil, let go of in a sixth of a second,
      // swung a flung hand 26 cm.
      const pops = allPops(samples).map(p => `${p.key} ${p.cm} cm ${p.action} ${p.clip}`), known = KNOWN[id];
      expect(pops.filter(p => !known?.test(p))).toEqual([]);
      expect(pops.filter(p => known?.test(p)).length, `${id}: the pop its own hurt had before`).toBeLessThanOrEqual(1);
      const downed = DOWNED[id];
      if (downed && presses === HEAVY) {
        // Down, it stays down: the downed pose, the hips on the floor, and the get-up out of that same pose.
        const lying = samples.filter(s => s.action === 'knockdown' && s.grounded && s.clip === downed);
        expect(lying.length, `${id} lay in the downed pose`).toBeGreaterThan(5);
        const settled = lying[Math.min(lying.length - 1, 8)].hips![1];
        for (const s of lying.slice(8)) expect(s.hips![1] - settled, 'the hips while down, metres').toBeLessThan(.05);
        const last = samples.indexOf(lying[lying.length - 1]), up = samples[last + 1];
        expect(up.action).toBe('getup');
        expect(Math.abs(up.hips![1] - lying[lying.length - 1].hips![1]), 'into the get-up, metres').toBeLessThan(.05);
      }
    } finally { victim.dispose(); attacker.dispose(); }
  }, 120_000);
});

type Form = [FighterId, string, string | null, string | null, string | null, boolean, boolean];
const FORMS: Form[] = [
  // BLACK TIDE's hurt is the shop's arms-flung twist (iteration fifteen): the recoil.
];
/** The form body as FighterLibrary assembles it, with what its own file brings. */
async function formOf(id: FighterId, take: string) {
  const form = await loadRig(FIGHTERS[id].formModel!), own = new Map(form.animations.map(c => [c.name, c.duration]));
  let mine: THREE.AnimationClip[] = [];
  for (const url of FIGHTERS[id].formExtraModels ?? []) {
    const clips = bindClips(form.scene, (await loadRig(url)).animations, `${id} form`);
    if (url.endsWith('/' + take)) mine = clips;
    const names = new Set(clips.map(c => c.name));
    form.animations = [...form.animations.filter(c => !names.has(c.name)), ...clips];
  }
  if (ORIGINALS[id]) {
    const taken = (await loadRig(`/assets/fighters/${take}`)).animations, names = new Set(taken.map(c => c.name));
    mine = form.animations.filter(c => names.has(c.name));
    for (const c of taken) if (!own.has(c.name)) own.set(c.name, c.duration);
  }
  return { form, own, mine };
}
type Shown = { awakenedForm?: { motionEvidence(): ReturnType<Fighter['motionEvidence']>; joints: Map<string, THREE.Bone>; group: THREE.Group } };
const CORE = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
describe.skipIf(!FORMS.length)('an awakened form takes a blow in its own new reactions', () => {
  it.each(FORMS)('%s (%s)', async (id, take, flinch, downed, getup, hurt, floats) => {
    if (!ORIGINALS[id]) expect(FIGHTERS[id].formExtraModels, `${id}: the form binds the file`).toContain(`/assets/fighters/${take}`);
    const { form, own, mine } = await formOf(id, take);
    // What the file brings: the flinch replacing the form's own at its length; the downed pose and the get-up new to it.
    expect(mine.map(c => c.name).sort()).toEqual([flinch, downed, getup, hurt ? 'Hit 01' : null].filter((n): n is string => !!n).sort());
    if (hurt) expect(Math.abs(mine.find(c => c.name === 'Hit 01')!.duration - own.get('Hit 01')!), 'the hurt\'s length').toBeLessThan(1 / 30);
    if (flinch) expect(Math.abs(mine.find(c => c.name === flinch)!.duration - own.get(flinch)!), `${flinch}'s length`).toBeLessThan(1 / 30);
    if (!ORIGINALS[id]) for (const name of [downed, getup]) if (name) expect(own.has(name), `the form had no ${name}`).toBe(false);
    const body = new Fighter(base(id), await loadRigWithExtras(id));
    body.attachForm(form as GLTF);
    try {
      const awake: PlayerState = { ...base(id), awakened: true };
      for (let f = 0; f < 90; f++) body.update(1 / 60, awake, true, 1 / 60);
      const g5 = (body as unknown as Shown).awakenedForm!;
      // Every clip it brings keys the body's core joints (restore_still), so none keeps another clip's pose.
      for (const clip of mine) {
        const keyed = new Set(clip.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName));
        const loose = CORE.map(k => g5.joints.get(k)?.name).filter((n): n is string => !!n && !keyed.has(n));
        expect(loose, `${id} ${clip.name}: core joints left unkeyed`).toEqual([]);
      }
      const sample = (t: number): ReactSample => { const e = g5.motionEvidence(); return { t, action: String(e.action), clip: String(e.clip), ct: Number(e.clipTime), el: Number(e.elapsed), head: e.head ?? [0, 0, 0], hand: e.handR ?? [0, 0, 0], group: g5.group.position.toArray(), grounded: true }; };
      const samples: ReactSample[] = [];
      let t = 0;
      if (flinch) {
        const chest = g5.joints.get('Spine2') ?? g5.joints.get('Spine1'), hold = chest!.getWorldQuaternion(new THREE.Quaternion());
        // Six light blows a barrage apart (each a 0.2 s flinch, the next landing before it ends), then the flinch let go of.
        const lifts: number[] = [], clips = new Set<string>();
        let turned = 0, started = -1;
        for (let f = 0; f < 6 * 9 + 60; f++) {
          if (f % 9 === 0 && f < 6 * 9) { body.impact(true, 'light', 'melee', 0, new THREE.Vector3(0, 0, -1), 15, 1.2, { chain: (f / 9) % 3 }); started = t; }
          const flinching = started >= 0 && t - started < .2;
          body.update(1 / 60, flinching ? { ...awake, action: 'flinch', actionStarted: 100 + started, actionDuration: .2, actionTime: (t - started) / .2 } : awake, true, 1 / 60);
          t += 1 / 60;
          if (flinching) { clips.add(String(g5.motionEvidence().clip)); lifts.push(Number(body.motionEvidence().formLift)); turned = Math.max(turned, THREE.MathUtils.radToDeg(chest!.getWorldQuaternion(new THREE.Quaternion()).angleTo(hold))); }
          samples.push(sample(t));
        }
        expect([...clips], `what the ${id} form flinched in`).toEqual([flinch]);
        // The cringe is struck: the chest turned off the stance it stood in.
        expect(turned, 'the chest\'s turn, degrees').toBeGreaterThan(10);
        const grounded = id === 'gummy' && !!ORIGINALS.gummy;
        if (floats && !grounded) expect(Math.min(...lifts), 'the float under the flinch, metres').toBeGreaterThan(.2);
      }
      if (downed) {
        // Knocked down (0.62 s, KNOCKDOWN_SECONDS) and up (0.4 s, GETUP_SECONDS): lying still in the downed pose, and
        // the get-up out of it, never jumping a frame between.
        const hips = g5.joints.get('Hips')!, height = () => g5.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).y;
        const lying: number[] = [], up = new Set<string>();
        for (let f = 0; f < 37 + 24; f++) {
          const down = f < 37, u = down ? f / 60 : (f - 37) / 60;
          body.update(1 / 60, { ...awake, action: down ? 'knockdown' : 'getup', actionStarted: down ? 200 : 300, actionDuration: down ? .62 : .4, actionTime: down ? u / .62 : u / .4 }, true, 1 / 60);
          t += 1 / 60;
          const clip = String(g5.motionEvidence().clip);
          if (down && f > 12) { expect(clip, `${id}: down`).toBe(downed); lying.push(height()); }
          if (!down) up.add(clip);
          samples.push(sample(t));
        }
        expect(Math.max(...lying) - Math.min(...lying), `${id}: the hips while down, metres`).toBeLessThan(.05);
        if (getup) expect([...up], `${id}: the get-up`).toEqual([getup]);
      }
      const kipUp = (p: { cm: number; action: string }) => id === 'nigo' && !!ORIGINALS.nigo && /getup$/.test(p.action) && p.cm < 26.5;
      const pops = [...criticPops(samples, 'hand', 8).filter(p => !kipUp(p)), ...criticPops(samples, 'head', 6)].map(p => `${p.cm} cm ${p.action} ${p.clip}`);
      expect(pops).toEqual([]);
    } finally { body.dispose(); }
  }, 120_000);
});
