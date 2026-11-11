import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type * as THREE from 'three';
import { COMBO_KEYS, COMBO_SLOT, type ComboKey } from '../src/game/combos';
import type { PlayerState } from '../src/game/types';
import { Fighter, FighterLibrary } from '../src/render/Fighter';
import { CLIP_MAP, clipNameFor, type BodyClipMap } from '../src/engine/client/clips';
import { FIGHTER_IDS } from '../src/engine/sim';
import { base, loadRig } from './rigHarness';

/** Engine VOL.7, step four: clips as data. Every body plays the clips its map (src/engine/client/clips.ts) writes
 *  down, and the map is what the renderer found by name before it had one (Fighter.ruledClips). For every fighter and
 *  its form, two bodies are built by the real FighterLibrary (its loader pointed at public/): one reading its map,
 *  one built with Fighter.clipMaps off, as every body was before. The map must be written for the body's clips and
 *  equal what the second finds by name, and the two must play the same clip for every action - standing, off the floor,
 *  awakened, the ultimate before and after its confirm, each rush stage, a jump falling, a run at a walk - every
 *  air-string stage, every combo ender (and its row), the rush plan, and every moment the renderer reaches for
 *  (Fighter.CLIP_RULES). */
type Clip = THREE.AnimationClip | undefined;
type Body = {
  clips: THREE.AnimationClip[]; awakenedForm?: Body; clipMap?: BodyClipMap; falling: boolean; walking: boolean;
  rushPlan?: { ground: Clip[]; air: Clip[] }; rushAuthored: Set<THREE.AnimationClip>;
  clipFor(state: PlayerState): Clip; groundedMelee(state: PlayerState): { clip: THREE.AnimationClip } | undefined;
  airStageClip(stage: number): Clip; enderClip(state: PlayerState): { clip: THREE.AnimationClip; own: unknown } | undefined;
  clip(key: string): Clip; ruledClips(): Record<string, string | null>; dispose(): void;
};

const load = GLTFLoader.prototype.loadAsync;
beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url); }; });
afterAll(() => { GLTFLoader.prototype.loadAsync = load; Fighter.clipMaps = true; });

const name = (clip?: { name: string }) => clip?.name ?? null;
const drawn = (body: Body, state: PlayerState) => name(body.groundedMelee(state)?.clip ?? body.clipFor(state));

describe('each body plays the clips its map writes down, as it found them by name before (Engine VOL.7)', () => {
  it.each(FIGHTER_IDS)('%s', async id => {
    const library = new FighterLibrary();
    await library.ensure([id]);
    const mapped = library.create(base(id)) as unknown as Body;
    Fighter.clipMaps = false;
    let ruled: Body;
    try { ruled = library.create(base(id)) as unknown as Body; } finally { Fighter.clipMaps = true; }
    try {
      for (const [form, on, off, map] of [[false, mapped, ruled, CLIP_MAP[id]], [true, mapped.awakenedForm, ruled.awakenedForm, CLIP_MAP[id]?.form]] as const) {
        const what = `${id}${form ? ' form' : ''}`;
        if (!on || !off) { expect(map, `${what}: a map for a form it has not got`).toBeUndefined(); continue; }
        expect(on.clipMap, `${what} reads the map written for it`).toBe(map);
        expect(off.clipMap, `${what}, built without maps`).toBeUndefined();
        // The map is what the body finds by name.
        expect(map!.clips, `${what}: its map is what it finds by name`).toEqual(off.ruledClips());
        // With it or by name, the same clip for everything the body is drawn doing.
        for (const action of Fighter.MAP_ACTIONS) for (const grounded of [true, false]) for (const awakened of [false, true]) {
          const state: PlayerState = { ...base(id), action, grounded, y: grounded ? 0 : 1.2, awakened, awakenedUntil: awakened ? 99 : undefined };
          const variants: Partial<PlayerState>[] = [{}, ...action === 'ultimate' ? [{ confirmedAt: 0 }] : [], ...action === 'light' ? [1, 2, 3].map(chain => ({ chain })) : []];
          for (const variant of variants) {
            const each = { ...state, ...variant };
            expect(drawn(on, each), `${what} ${action} ${JSON.stringify(variant)}${grounded ? '' : ' in the air'}${awakened ? ' awakened' : ''}`).toBe(drawn(off, each));
          }
        }
        for (const [flag, action] of [['falling', 'jump'], ['walking', 'run']] as const) {
          on[flag] = off[flag] = true;
          try { expect(drawn(on, { ...base(id), action }), `${what} ${action}, ${flag}`).toBe(drawn(off, { ...base(id), action })); } finally { on[flag] = off[flag] = false; }
        }
        for (const key of COMBO_KEYS) {
          const state: PlayerState = { ...base(id), action: COMBO_SLOT[key], branch: key as ComboKey }, a = on.enderClip(state), b = off.enderClip(state);
          expect(name(a?.clip), `${what} ender ${key}`).toBe(name(b?.clip));
          expect(a?.own, `${what} ender ${key}: its row`).toBe(b?.own);
        }
        for (let stage = 0; stage < 3; stage++) expect(name(on.airStageClip(stage)), `${what} air ${stage}`).toBe(name(off.airStageClip(stage)));
        expect(on.rushPlan?.ground.map(name), `${what}: the rush on the floor`).toEqual(off.rushPlan?.ground.map(name));
        expect(on.rushPlan?.air.map(name), `${what}: the rush in the air`).toEqual(off.rushPlan?.air.map(name));
        expect([...on.rushAuthored].map(name), `${what}: the stages the fighter names`).toEqual([...off.rushAuthored].map(name));
        for (const key of Object.keys(Fighter.CLIP_RULES)) expect(name(on.clip(key)), `${what} ${key}`).toBe(name(off.clip(key)));
      }
    } finally { mapped.dispose(); ruled.dispose(); }
  }, 60_000);
});

// So the agreement above is not empty: the maps say something for every body.
it('writes down every fighter and form, everything each plays', () => {
  for (const id of FIGHTER_IDS) {
    const map = CLIP_MAP[id];
    expect(map, id).toBeDefined();
    for (const body of [map!, ...map!.form ? [map!.form] : []]) {
      for (const action of Fighter.MAP_ACTIONS) expect(body.clips[action], `${id} ${action}`).toBeTruthy();
      expect(Object.keys(body.clips).length, id).toBeGreaterThan(40);
    }
  }
});

// Another fighter's clip, whichever body asks (the transplant: a borrowed move plays the clip of the fighter it came from).
it('answers any fighter\'s clip for an action, a rush stage or a moment, without a body', () => {
  expect(clipNameFor('kagari', 'heavy')).toBe('Yuragi Blast');
  expect(clipNameFor('kagari', 'guard')).toBe('Authored kagari guard');
  expect(clipNameFor('mizuhiki', 'rush 1')).toBe(CLIP_MAP.mizuhiki!.clips['rush 1']);
  for (const id of FIGHTER_IDS) for (const form of [false, true]) {
    const map = form ? CLIP_MAP[id]?.form : CLIP_MAP[id];
    if (!map) { expect(clipNameFor(id, 'light', form)).toBeUndefined(); continue; }
    for (const stage of [1, 2, 3]) expect(clipNameFor(id, `rush ${stage}`, form), `${id} rush ${stage}`).toBe(map.clips[`rush ${stage}`] ?? map.clips[`rush fill ${stage}`]);
    for (const action of Fighter.MAP_ACTIONS) expect(clipNameFor(id, action, form)).toBe(map.clips[action]);
  }
  expect(clipNameFor('kagari', 'no such moment')).toBeUndefined();
});
