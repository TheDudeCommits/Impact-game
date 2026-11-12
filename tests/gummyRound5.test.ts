import fs from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { bindClips, Fighter } from '../src/render/Fighter';
import { bindFormExtras, SUNRISE_FLOAT } from '../src/render/gummy/sunrise';
import { closedFist, openHandName } from '../src/render/gummy/openHands';
import { SPRING_TIDE_TAKE } from '../src/render/gummy/spring-tide';
import { planVoice, resetVoiceMemory } from '../src/audio/voicePlan';
import voiceDurations from '../src/audio/data/voiceDurations.json';
import contactFrames from '../src/game/data/contactFrames.json';
import type { AttackSlot, CombatEvent, PlayerState } from '../src/game/types';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { base, loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
import { LUCY_TIDE } from '../src/originals/lucyTide';

async function gummy(): Promise<{ body: GLTF; form: GLTF }> {
  const def = FIGHTERS.gummy, body = await loadRig(def.model);
  for (const url of def.extraModels ?? []) {
    const clips = bindClips(body.scene, (await loadRig(url)).animations, 'Gummy'), names = new Set(clips.map(c => c.name));
    body.animations = [...body.animations.filter(c => !names.has(c.name)), ...clips];
  }
  const form = await loadRig(def.formModel!);
  await bindFormExtras({ loadAsync: (url: string) => loadRig(url) } as unknown as GLTFLoader, def, body, form, bindClips);
  return { body, form };
}
let assets: { body: GLTF; form: GLTF };
beforeAll(async () => { assets = await gummy(); }, 120_000);
const state = (over: Partial<PlayerState> = {}): PlayerState => ({ ...base('gummy'), id: 'gummy', ultimate: 100, ...over });
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('Rubber no Bazooka', () => {
  it('is its own take, landing its blow on the move\'s contact', () => {
    const take = assets.body.animations.find(c => c.name === 'Rogue Wave')!;
    expect(take.duration, 'his own take, not the earlier flip kick (1.29 s)').toBeCloseTo(.9, 2);
    expect((contactFrames as Record<string, Record<string, number>>).gummy.heavy * MOVES.gummy.heavy.duration).toBeCloseTo(MOVES.gummy.heavy.contacts[0], 2);
    // SUNRISE throws it too, on his own body.
    expect(assets.form.animations.find(c => c.name === 'Rogue Wave')!.duration).toBeCloseTo(.9, 2);
  });

  it.skipIf(!!ORIGINALS.gummy)('throws both arms back behind him, then both palms out together, side by side, and opens his hands for it', () => {
    const f = new Fighter(state(), assets.body);
    try {
      const move = MOVES.gummy.heavy, hands = { L: f.model.getObjectByName(openHandName('gummy', 'L'))!, R: f.model.getObjectByName(openHandName('gummy', 'R'))! };
      const fists = { L: closedFist(assets.body, f.model, 'L')!, R: closedFist(assets.body, f.model, 'R')! };
      expect(hands.L && hands.R && fists.L && fists.R, 'the open hands are on the body, beside its fists').toBeTruthy();
      expect((hands.R as THREE.SkinnedMesh).skeleton, 'skinned as the fist is').toBe(fists.R.skeleton);
      f.update(1 / 60, state(), true);
      expect(hands.R.visible || hands.L.visible).toBe(false);
      let back = { L: Infinity, R: Infinity }, out = { L: -Infinity, R: -Infinity }, apart = Infinity;
      for (let t = 0; t <= move.duration; t += 1 / 60) {
        f.update(1 / 60, state({ action: 'heavy', actionStarted: 1, actionDuration: move.duration, actionTime: t / move.duration }), true);
        expect(hands.L.visible && hands.R.visible && !fists.L.visible && !fists.R.visible, `the palms at ${t.toFixed(2)} s`).toBe(true);
        const l = world(f.bones.get('lefthand')!), r = world(f.bones.get('righthand')!);
        if (t > .2 && t < .34) { back.L = Math.min(back.L, l.z); back.R = Math.min(back.R, r.z); }
        if (t > move.contacts[0] && t < move.contacts[0] + .1) { out.L = Math.max(out.L, l.z); out.R = Math.max(out.R, r.z); apart = Math.min(apart, Math.abs(l.x - r.x)); }
      }
      // Facing +z from the origin: drawn out behind him on the wind-up, a metre and more, both arms...
      expect(back.L, 'left hand behind him').toBeLessThan(-.9);
      expect(back.R, 'right hand behind him').toBeLessThan(-.9);
      // ...and both out in front together on the blow, the heels of the hands a hand's width apart.
      expect(out.L, 'left palm out').toBeGreaterThan(1.4);
      expect(out.R, 'right palm out').toBeGreaterThan(1.4);
      expect(apart).toBeGreaterThan(.04);
      expect(apart).toBeLessThan(.4);
      f.update(1 / 60, state(), true);
      expect(fists.R.visible && !hands.R.visible, 'his fists back after it').toBe(true);
    } finally { f.dispose(); }
  });

  it.skipIf(!!ORIGINALS.gummy)('keeps his fists for an ender thrown in the heavy\'s slot', () => {
    const f = new Fighter(state(), assets.body);
    try {
      f.update(1 / 60, state({ action: 'heavy', branch: 'lh', actionStarted: 1, actionDuration: .9, actionTime: .3 }), true);
      expect(f.model.getObjectByName(openHandName('gummy', 'R'))!.visible).toBe(false);
    } finally { f.dispose(); }
  });
});

describe('SUNRISE floats', () => {
  const settle = (f: Fighter, over: Partial<PlayerState>, frames = 150) => { for (let i = 0; i < frames; i++) f.update(1 / 60, state({ awakened: true, ...over }), true); };
  it.skipIf(!!ORIGINALS.gummy)('hangs his feet the float\'s height over the floor standing, gliding and swinging, in his own float and glide takes', () => {
    const f = new Fighter(state(), assets.body);
    f.attachForm(assets.form);
    try {
      const form = (f as unknown as { awakenedForm: Fighter }).awakenedForm;
      for (const [action, clip] of [['idle', SUNRISE_FLOAT.idle], ['run', SUNRISE_FLOAT.run]] as const) {
        settle(f, { action });
        expect(form.motionEvidence().clip, action).toBe(clip);
        const soles: number[] = [];
        for (let i = 0; i < 150; i++) { f.update(1 / 60, state({ awakened: true, action }), true); soles.push(f.formSole()!); }
        expect(Math.min(...soles), `${action}: never on the floor`).toBeGreaterThan(SUNRISE_FLOAT.lift - .1);
        expect(Math.max(...soles), `${action}: a little over it, not up in the air`).toBeLessThan(SUNRISE_FLOAT.lift + .12 + (action === 'run' ? .3 : 0) + (ORIGINALS.gummy && action === 'run' ? .01 : 0));
        expect(Math.max(...soles) - Math.min(...soles), `${action}: it bobs`).toBeGreaterThan(.02);
      }
      // Through a swing a little lower, so his blows meet a standing body.
      settle(f, { action: 'heavy', actionStarted: 1, actionDuration: .9, actionTime: .2 }, 60);
      expect(f.motionEvidence().formLift).toBeLessThan(SUNRISE_FLOAT.lift);
      expect(f.formSole()!).toBeGreaterThan(SUNRISE_FLOAT.striking - .12);
      // Knocked down, he comes down to the floor.
      settle(f, { action: 'knockdown', actionStarted: 5, actionDuration: 1, actionTime: .5 }, 90);
      expect(Math.abs(f.motionEvidence().formLift)).toBeLessThan(.05);
    } finally { f.dispose(); }
  });
});

describe.skipIf(!ORIGINALS.gummy)('SUNRISE stands', () => {
  it('keeps his soles on the floor standing and running', () => {
    const f = new Fighter(state(), assets.body);
    f.attachForm(assets.form);
    try {
      const form = (f as unknown as { awakenedForm: Fighter }).awakenedForm;
      for (const action of ['idle', 'run'] as const) {
        for (let i = 0; i < 150; i++) f.update(1 / 60, state({ awakened: true, action }), true);
        expect(form.motionEvidence().clip, action).not.toBe(action === 'idle' ? SUNRISE_FLOAT.idle : SUNRISE_FLOAT.run);
        const soles: number[] = [];
        for (let i = 0; i < 150; i++) { f.update(1 / 60, state({ awakened: true, action }), true); soles.push(f.formSole()!); }
        soles.sort((a, b) => a - b);
        expect(soles[Math.floor(soles.length / 2)], `${action}: on the floor`).toBeLessThan(.06);
        expect(soles[Math.floor(soles.length / 2)], `${action}: not through it`).toBeGreaterThan(-.08);
      }
    } finally { f.dispose(); }
  });
});

describe('Spring Tide, one take from its first frame', () => {
  const move = MOVES.gummy.ultimate;
  const at = (f: Fighter, t: number, over: Partial<PlayerState> = {}) =>
    f.update(1 / 60, state({ action: 'ultimate', actionStarted: 1, actionDuration: move.duration, actionTime: t / move.duration, ...over }), true);
  it.skipIf(LUCY_TIDE)('goes into SUNRISE on its first frame, throws no jab and plays one take through the confirm', () => {
    const f = new Fighter(state(), assets.body);
    f.attachForm(assets.form);
    try {
      const form = (f as unknown as { awakenedForm: Fighter }).awakenedForm;
      at(f, .02);
      expect(f.model.visible, 'Gummy on the press').toBe(true);
      let last = 0;
      for (let t = SPRING_TIDE_TAKE.swap + .02; t < move.contacts[0] + .1; t += 1 / 60) {
        at(f, t);
        expect(f.model.visible, `his body at ${t.toFixed(2)}`).toBe(false);
        const e = form.motionEvidence();
        expect(e.clip, `the opener at ${t.toFixed(2)}`).toBe(SPRING_TIDE_TAKE.open.clip);
        expect(e.clipTime!).toBeGreaterThanOrEqual(last - 1e-6); last = e.clipTime!;
      }
      // Still in the crouch the take goes on from when the confirm comes...
      const open = form.clips.find(c => c.name === SPRING_TIDE_TAKE.open.clip)!;
      expect(last / open.duration).toBeGreaterThan(SPRING_TIDE_TAKE.open.at - .05);
      expect(last).toBeLessThan(.7);
      // ...and on the confirm the take itself from that crouch: no other clip, never back up out of it.
      const confirmedAt = 1 + move.contacts[0] + .1;
      let first: number | undefined;
      for (let t = move.contacts[0] + .1; t <= move.contacts[move.contacts.length - 1]; t += 1 / 60) {
        at(f, t, { confirmedAt });
        const e = form.motionEvidence();
        expect(e.clip).toBe('Sunrise Tide');
        if (first === undefined) first = e.clipTime!;
      }
      const take = form.clips.find(c => c.name === 'Sunrise Tide')!;
      expect(first! / take.duration, 'from the crouch the opener held').toBeCloseTo(SPRING_TIDE_TAKE.cine.from, 1);
    } finally { f.dispose(); }
  });

  it.skipIf(LUCY_TIDE)('awakened, never switches body, and its opener is the same take', () => {
    const f = new Fighter(state({ awakened: true }), assets.body);
    f.attachForm(assets.form);
    try {
      const form = (f as unknown as { awakenedForm: Fighter }).awakenedForm;
      for (let t = 0; t < .6; t += 1 / 30) { at(f, t, { awakened: true }); expect(f.model.visible).toBe(false); expect(form.motionEvidence().clip).toBe(SPRING_TIDE_TAKE.open.clip); }
    } finally { f.dispose(); }
  });

  it.skipIf(LUCY_TIDE)('missed, comes out of the form as the whiff\'s recovery ends, not the move\'s', () => {
    const f = new Fighter(state(), assets.body);
    f.attachForm(assets.form);
    try {
      const whiffedAt = 1 + move.contacts[0] + .1;
      at(f, .7, { whiffedAt });
      expect(f.model.visible, 'SUNRISE while it recovers').toBe(false);
      at(f, whiffedAt - 1 + .5 - .2, { whiffedAt });
      expect(f.model.visible, 'Gummy again before it ends').toBe(true);
    } finally { f.dispose(); }
  });
});

describe('his lines', () => {
  let id = 1;
  const cast = (slot: AttackSlot, kind: CombatEvent['kind'] = 'cast', extra: Partial<CombatEvent> = {}): CombatEvent =>
    ({ id, actionSeq: id++, kind, serverTime: id, actorId: 'p1', fighter: 'gummy', slot, chain: 0, ...extra });
  beforeEach(() => resetVoiceMemory());
  it('peaks "BAZOOKA!" on the palms', () => {
    const [line] = planVoice(cast('heavy'), false);
    expect(line.cue).toBe('vo-gummy-rogue-wave');
    expect((line.delay ?? 0) + .39).toBeCloseTo(MOVES.gummy.heavy.contacts[0], 2);
  });
  it('calls the SPRING TIDE: "Rubber no!" on the press, "...GUN!" on the fist', () => {
    expect(planVoice(cast('ultimate'), false).map(l => l.cue)).toContain('vo-gummy-come-sea');
    const confirm = .6, [line] = planVoice(cast('ultimate', 'confirm', { castAge: confirm }), false);
    expect(line.cue).toBe('vo-gummy-spring-tide');
    expect(confirm + (line.delay ?? 0) + .82).toBeCloseTo(move().contacts[move().contacts.length - 1], 2);
    for (const cue of ['vo-gummy-sunset-barrage', 'vo-gummy-come-sea', 'vo-gummy-spring-tide'])
      expect((voiceDurations as Record<string, number>)[cue], cue).toBeGreaterThan(.5);
  });
  const move = () => MOVES.gummy.ultimate;
});

/** The feel pass's rule (tests/takeGuard.ts): the export leaves out a channel held at rest, and in the game a
 *  joint no playing clip keys keeps the last pose another clip gave it - SUNRISE floating on with a Spring Tide fist, or with
 *  the arms of the dawn barrage before it. So each round-5 take keys, at the rest it was posed at, every channel that
 *  some clip its body plays moves off that rest (scripts/gummy/hold_rest.py). Read from the files as the game lists them. */
describe('his round-5 takes hold what they leave at rest', () => {
  type Channels = Map<string, number[][]>;
  const WIDTH: Record<string, number> = { rotation: 4, translation: 3, scale: 3 };
  const REST: Record<string, number[]> = { rotation: [0, 0, 0, 1], translation: [0, 0, 0], scale: [1, 1, 1] };
  const file = (url: string) => {
    const data = fs.readFileSync(`public${url}`), length = data.readUInt32LE(12), at = 20 + length;
    const json = JSON.parse(data.subarray(20, at).toString()), bin = data.subarray(at + 8, at + 8 + data.readUInt32LE(at));
    const names: string[] = json.nodes.map((n: { name?: string }) => n.name ?? '');
    const values = (index: number) => {
      const a = json.accessors[index], v = json.bufferViews[a.bufferView], w = WIDTH[a.type === 'VEC4' ? 'rotation' : 'scale'];
      const stride = v.byteStride ?? 4 * w, from = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), out: number[][] = [];
      for (let i = 0; i < a.count; i++) out.push(Array.from({ length: w }, (_, j) => bin.readFloatLE(from + i * stride + j * 4)));
      return out;
    };
    const clips = new Map<string, Channels>();
    for (const anim of json.animations ?? []) {
      const channels: Channels = new Map();
      for (const c of anim.channels) if (c.target.node !== undefined && WIDTH[c.target.path]) channels.set(`${names[c.target.node]}.${c.target.path}`, values(anim.samplers[c.sampler].output));
      clips.set(anim.name, channels);
    }
    const rest = new Map<string, number[]>();
    json.nodes.forEach((n: Record<string, number[]>, i: number) => { for (const path in WIDTH) rest.set(`${names[i]}.${path}`, n[path] ?? REST[path]); });
    return { clips, rest };
  };
  const off = (key: string, value: number[], rest: number[]) => key.endsWith('.rotation')
    ? 2 * Math.acos(Math.min(1, Math.abs(value.reduce((sum, x, i) => sum + x * rest[i], 0)))) > .2 * Math.PI / 180
    : Math.hypot(...value.map((x, i) => x - rest[i])) > .0015;
  const def = FIGHTERS.gummy, idle = IDLE_PROFILES.gummy?.model;
  const bodies: [string, string, string[]][] = [
    ['Gummy', def.model, [...(def.rushModel ? [def.rushModel] : []), ...(def.extraModels ?? []), ...(idle ? [idle] : [])]],
    ['SUNRISE', def.formModel!, def.formExtraModels ?? []],
  ];
  for (const [label, model, others] of bodies) it.skipIf(!!ORIGINALS.gummy)(`${label}: every channel a take leaves out, no clip of the body moves`, () => {
    const body = file(model), takes = others.filter(url => url.includes('gummy-r5-'));
    expect(takes.length, label).toBeGreaterThan(0);
    const moved = new Set<string>();
    for (const url of [model, ...others]) for (const channels of file(url).clips.values()) for (const [key, keys] of channels) {
      const rest = body.rest.get(key);
      if (rest && keys.some(value => off(key, value, rest))) moved.add(key);
    }
    for (const url of takes) for (const [name, channels] of file(url).clips) {
      const missing = [...moved].filter(key => !channels.has(key));
      expect(missing, `${label} ${name}`).toEqual([]);
    }
  });
});
