import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { bindClips, Fighter, OWN_BODY_ULTIMATE, ULTIMATE_CLIPS } from '../src/render/Fighter';
import { bindFormExtras } from '../src/render/gummy/sunrise';
import type { AttackSlot, CombatEvent, PlayerState } from '../src/game/types';
import { planCombatAudio } from '../src/audio/cuePlan';
import { lookStrikes } from '../src/engine/sim/areaDamage';
import { ORIGINALS } from '../src/originals/roster';
import fs from 'node:fs';
import { base, loadRig } from './rigHarness';

const glbJson = (file: string) => { const b = fs.readFileSync(`public${file}`), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };
import { LUCY_TIDE, TIDE, TIDE_PLAN, TIDE_CLIP, TIDE_OPEN_CLIP, MONSOON_CLIP, OPEN_LENGTH, MONSOON_ANIM, MONSOONS, castMonsoon, clearMonsoons, isMonsoon } from '../src/originals/lucyTide';

const ult = MOVES.gummy.ultimate, area = MOVES.gummy.area!;
let assets: { body: GLTF; form: GLTF; taisei: GLTF };
beforeAll(async () => {
  const def = FIGHTERS.gummy, body = await loadRig(def.model);
  for (const url of def.extraModels ?? []) {
    const clips = bindClips(body.scene, (await loadRig(url)).animations, 'Lucy'), names = new Set(clips.map(c => c.name));
    body.animations = [...body.animations.filter(c => !names.has(c.name)), ...clips];
  }
  const form = await loadRig(def.formModel!);
  await bindFormExtras({ loadAsync: (url: string) => loadRig(url) } as unknown as GLTFLoader, def, body, form, bindClips);
  assets = { body, form, taisei: await loadRig(FIGHTERS.taisei.model) };
}, 120_000);

/** Lucy at the origin facing +z, a Taisei `gap` metres ahead, Spring Tide thrown at him from 1 s. */
function scene(gap: number, verdict: { confirmed?: boolean; whiffed?: boolean; awakened?: boolean } = {}) {
  const f = new Fighter({ ...base('gummy'), id: 'gummy', ultimate: 100, awakened: !!verdict.awakened }, assets.body);
  f.attachForm(assets.form);
  const victim = new Fighter({ ...base('taisei'), id: 'v', z: gap, yaw: Math.PI }, assets.taisei);
  const decided = 1 + TIDE.grab + 1 / 30;
  const at = (t: number) => {
    const on = 1 + t >= decided;
    victim.update(1 / 60, { ...base('taisei'), id: 'v', z: gap, yaw: Math.PI, action: on && verdict.confirmed ? 'stun' : 'idle' }, true);
    f.targetPoint = new THREE.Vector3(0, 1.45, gap);
    f.update(1 / 60, { ...base('gummy'), id: 'gummy', awakened: !!verdict.awakened, action: 'ultimate', actionStarted: 1, actionDuration: ult.duration,
      actionTime: t / ult.duration, target: 'v', ...(on && verdict.confirmed ? { confirmedAt: decided } : {}), ...(on && verdict.whiffed ? { whiffedAt: decided } : {}) } as PlayerState, true);
    const form = (f as unknown as { awakenedForm: Fighter }).awakenedForm, body = verdict.awakened ? form : f;
    const own = (body.joints.get('Spine2') ?? body.joints.get('Hips'))!.getWorldPosition(new THREE.Vector3());
    return { body, form, own, right: body.joints.get('RightHand')!.getWorldPosition(new THREE.Vector3()), left: body.joints.get('LeftHand')!.getWorldPosition(new THREE.Vector3()), chest: new THREE.Vector3(0, 1.1, gap) };
  };
  return { f, at, dispose: () => { f.dispose(); victim.dispose(); } };
}

describe('Lucy\'s Spring Tide', () => {
  it('is the game\'s, on the move\'s own clock, in his own body', () => {
    expect(LUCY_TIDE).toBe(!!ORIGINALS.gummy);
    expect(LUCY_TIDE).toBe(true);
    expect([TIDE.grab, TIDE.blow, TIDE.length]).toEqual([ult.contacts[0], ult.contacts[ult.contacts.length - 1], ult.duration]);
    expect(ULTIMATE_CLIPS.gummy).toBe(TIDE_PLAN);
    expect(OWN_BODY_ULTIMATE.has('gummy')).toBe(true);
    // The cinematic window is laid linearly: the take plays on the move's clock.
    expect(TIDE_PLAN.cine.windows).toEqual([[TIDE.grab / TIDE.length, 1, TIDE.blow / TIDE.length]]);
  });

  it('has its takes on both his bodies, animation only, at the moves\' own lengths', () => {
    for (const [file, list] of [['/assets/fighters/lucy-pxtide1.glb', FIGHTERS.gummy.extraModels], ['/assets/fighters/sunrise-pxtide1.glb', FIGHTERS.gummy.formExtraModels]] as const) {
      expect(list, file).toContain(file);
      const json = glbJson(file) as unknown as { meshes?: unknown[]; skins?: unknown[]; animations: { name: string; samplers: { input: number }[] }[]; accessors: { max?: number[] }[] };
      expect(json.meshes ?? [], `${file}: no mesh`).toEqual([]);
      const lengths = Object.fromEntries(json.animations.map(a => [a.name, Math.max(...a.samplers.map(s => json.accessors[s.input].max![0]))]));
      expect(lengths[TIDE_CLIP], file).toBeCloseTo(ult.duration, 2);
      expect(lengths[TIDE_OPEN_CLIP], file).toBeCloseTo(OPEN_LENGTH, 2);
      expect(lengths[MONSOON_CLIP], file).toBeCloseTo(area.duration, 2);
    }
  });

  it('never swaps in his awakened body, and plays his own take from the press through the confirm', () => {
    const s = scene(4, { confirmed: true });
    try {
      let last = -1, onBlow: number | undefined;
      for (let t = 0; t < ult.duration - .05; t += 1 / 60) {
        const { form } = s.at(t);
        expect(s.f.model.visible, `his own body at ${t.toFixed(2)}`).toBe(true);
        expect(form.group.visible, `no form at ${t.toFixed(2)}`).toBe(false);
        const e = s.f.motionEvidence();
        if (t > .15 && t < TIDE.grab) expect(e.clip).toBe(TIDE_OPEN_CLIP);
        if (t > TIDE.grab + .2) { expect(e.clip).toBe(TIDE_CLIP); expect(e.clipTime!).toBeGreaterThanOrEqual(last - 1e-6); last = e.clipTime!; }
        if (onBlow === undefined && t >= TIDE.blow) onBlow = e.clipTime;
      }
      // On the move's clock: the blow's frame of the take on the finisher (within the entry blend's frame or two).
      expect(onBlow!).toBeCloseTo(TIDE.blow, 1);
    } finally { s.dispose(); }
  });

  it.each([3, 7])('stretches both arms into the sky, then lays both fists on a body %s m off on the finisher, and lets go', gap => {
    const s = scene(gap, { confirmed: true });
    try {
      for (let t = 0; t < 1.76; t += 1 / 60) s.at(t);
      const sky = s.at(1.76);
      expect(Math.min(sky.right.y, sky.left.y), 'both fists high over his head').toBeGreaterThan(sky.own.y + 2.4);
      for (let t = 1.78; t < TIDE.blow; t += 1 / 60) s.at(t);
      const blow = s.at(TIDE.blow + .02);
      expect(blow.right.distanceTo(blow.chest), 'the right on them').toBeLessThan(.6);
      expect(blow.left.distanceTo(blow.chest), 'the left on them').toBeLessThan(.6);
      let home = Infinity;
      for (let t = TIDE.blow + .04; t < TIDE.blow + .6; t += 1 / 60) { const { right, own } = s.at(t); home = Math.min(home, right.distanceTo(own)); }
      expect(home, 'and back at him').toBeLessThan(1.4);
    } finally { s.dispose(); }
  });

  it('awakened, throws the same take in his awakened body', () => {
    const s = scene(4, { confirmed: true, awakened: true });
    try {
      for (let t = 0; t < TIDE.grab + .4; t += 1 / 30) s.at(t);
      const { form } = s.at(TIDE.grab + .4);
      expect(form.group.visible).toBe(true);
      expect(form.motionEvidence().clip).toBe(TIDE_CLIP);
    } finally { s.dispose(); }
  });

  it('sounds like his: no form cloud, no balloon blown up, no electric bed', () => {
    let id = 1;
    const ev = (kind: CombatEvent['kind'], slot: AttackSlot): CombatEvent => ({ id, actionSeq: id++, kind, serverTime: id, actorId: 'p1', fighter: 'gummy', slot, chain: 0 });
    for (const [awakened, kinds] of [[false, ['cast', 'confirm', 'hit']], [true, ['confirm', 'hit']]] as [boolean, CombatEvent['kind'][]][]) for (const kind of kinds) {
      const cues = planCombatAudio(ev(kind, 'ultimate'), awakened).map(l => l.cue);
      expect(cues.filter(c => /poof|rubber|electric-bed/.test(c)), `${kind}${awakened ? ' awakened' : ''}`).toEqual([]);
    }
  });
});

describe('Lucy\'s Monsoon', () => {
  it('is cast with his own take', () => {
    expect(MONSOON_ANIM).toMatchObject({ fighter: 'gummy', clip: MONSOON_CLIP, full: false });
  });
  it('is his own look only for his own move: a Forge kit\'s other effect is drawn as it says', () => {
    expect(isMonsoon('gummy', 'gummy', 'qk_explosion', 'qk_explosion')).toBe(true);
    expect(isMonsoon('gummy', 'gummy', undefined, undefined)).toBe(true);
    expect(isMonsoon('gummy', 'gummy', 'cosmos_meteorstorm', 'cosmos_meteorstorm')).toBe(false);
    expect(isMonsoon('taisei', 'taisei', 'qk_explosion', undefined)).toBe(false);
  });
  it('lays its sand on the times the server strikes (its look\'s, as areaStrikes.json measured them)', () => {
    clearMonsoons();
    castMonsoon('k', 'p1', { x: 0, y: 0, z: 5 }, 3.8, 10, 10.75, { x: 0, z: 0 }, 3);
    expect(MONSOONS).toHaveLength(1);
    const want = lookStrikes('qk_explosion').map(o => 10.75 + o);
    expect(MONSOONS[0].strikes.map(t => +t.toFixed(3))).toEqual(want.map(t => +t.toFixed(3)));
    castMonsoon('k', 'p1', { x: 0, y: 0, z: 5 }, 3.8, 10, 10.75, undefined, 3);
    expect(MONSOONS, 'once a cast').toHaveLength(1);
    clearMonsoons();
  });
});
