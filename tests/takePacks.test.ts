import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { FighterLibrary } from '../src/render/Fighter';
import { CORE_SLOTS, FIGHTER_IDS, ownKit } from '../src/engine/sim';
import { decodeTakePack, forgetTakePacks, readTakePackJson, takePackUrl } from '../src/engine/client/takePacks';
import { readTakes, resetTakes, knownTakes } from '../src/engine/client/transplantTakes';
import { retarget, rigOf } from '../src/engine/client/retarget';
import { findClipIn } from '../src/render/clipMatch';
import { setActiveKit } from '../src/engine/client/forgeLive';
import { installTransplant, prepare, prepareTimings, resetTransplant } from '../src/engine/client/transplant';
import { base, loadRig } from './rigHarness';

/** VOL.5, the move transplant made instant: every fighter's take pack (src/engine/client/takePacks.ts) is current with
 *  the files it was read from, and a move fitted from it is the move fitted from the fighter's whole body. */
const bytesOf = (id: FighterId) => { const file = fs.readFileSync(`public${takePackUrl(id)}`); return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength); };
const filesOf = (id: FighterId) => {
  const def = FIGHTERS[id], urls = [def.model, def.rushModel, ...def.extraModels ?? [], IDLE_PROFILES[id]?.model, def.formModel, ...def.formExtraModels ?? [], def.openHandsModel];
  return Object.fromEntries([...new Set(urls.filter((url): url is string => !!url))].map(url => [url, crypto.createHash('sha256').update(fs.readFileSync(`public${url}`)).digest('hex').slice(0, 12)]));
};

describe('take packs', () => {
  it('every fighter has one, written from the files it loads as they are now', () => {
    const stale: string[] = [];
    for (const id of FIGHTER_IDS) {
      expect(fs.existsSync(`public${takePackUrl(id)}`), `${id} has no take pack`).toBe(true);
      const { json } = readTakePackJson(bytesOf(id));
      expect(json.fighter).toBe(id);
      if (JSON.stringify(json.files) !== JSON.stringify(filesOf(id))) stale.push(id);
      for (const slot of CORE_SLOTS) expect(json.takes[slot]?.open, `${id} ${slot}`).toBeTruthy();
    }
    expect(stale, `stale take packs: ${stale.join(',')}`).toEqual([]);
  });

  it('are small: one request for all four of a fighter\'s moves', () => {
    const sizes = FIGHTER_IDS.map(id => fs.statSync(`public${takePackUrl(id)}`).size);
    // 150 KB: Gaunt's slab, seated once in his fist on every frame of the clean clips, keys every finger
    // and the slab's joints through his long Hound Rampage, and the pack's own key thinning leaves 144 KB; the average stays capped.
    expect(Math.max(...sizes)).toBeLessThan(150 * 1024);
    expect(sizes.reduce((a, b) => a + b, 0) / sizes.length).toBeLessThan(70 * 1024);
  });
});

describe('a move fitted from a take pack', () => {
  const load = GLTFLoader.prototype.loadAsync;
  const library = new FighterLibrary();
  beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url); }; });
  afterAll(() => { GLTFLoader.prototype.loadAsync = load; resetTakes(); });

  it('is the move fitted from the fighter\'s whole body, to a fiftieth of a degree or so', async () => {
    const bodies: FighterId[] = ['bellows'], donors: FighterId[] = ['kagari', 'taisei', 'kenzo', 'kuon', 'gummy', 'madake', 'koko', 'nigo'];
    await library.ensure([...bodies, ...donors]);
    const rigOfBody = (id: FighterId) => { const made = library.create(base(id)), read = made.take(base(id)); made.dispose(); return rigOf(read.scene, findClipIn(read.clips, ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle'])); };
    const q = new THREE.Quaternion(), r = new THREE.Quaternion();
    let worst = 0, compared = 0;
    for (const donor of donors) {
      resetTakes();
      const made = library.create(base(donor)), whole = readTakes(made, donor); made.dispose();
      const packed = decodeTakePack(bytesOf(donor)).takes;
      for (const body of bodies) {
        const target = rigOfBody(body);
        for (const slot of CORE_SLOTS) for (const phase of ['open', 'cine', 'form'] as const) {
          const a = whole[slot][phase], b = packed[slot]?.[phase];
          expect(!!b, `${donor} ${slot} ${phase}`).toBe(!!a);
          if (!a || !b) continue;
          expect(b.clip.name).toBe(a.clip.name);
          expect(b.clip.duration).toBeCloseTo(a.clip.duration, 4);
          expect(b.linear).toBe(a.linear);
          const fa = retarget(a.rig, a.clip, target), fb = retarget(b.rig, b.clip, target);
          expect(fb.reason, `${donor} ${slot} ${phase} on ${body}`).toBe(fa.reason);
          if (!fa.clip || !fb.clip) continue;
          for (const ta of fa.clip.tracks) {
            const tb = fb.clip.tracks.find(t => t.name === ta.name)!;
            expect(tb, ta.name).toBeTruthy();
            if (!ta.name.endsWith('.quaternion')) continue;
            type Sampled = THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant };
            const ia = (ta as Sampled).createInterpolant(), ib = (tb as Sampled).createInterpolant();
            for (let k = 0; k <= 20; k++) {
              const t = fa.clip.duration * k / 20;
              q.fromArray(ia.evaluate(t) as unknown as number[]); r.fromArray(ib.evaluate(t) as unknown as number[]);
              worst = Math.max(worst, q.angleTo(r) * 180 / Math.PI); compared++;
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
    expect(worst, 'the worst joint, degrees').toBeLessThan(1);
  }, 120000);

  it('is ready to throw without the fighter\'s model: one small file', async () => {
    const fetched: string[] = [], native = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input); fetched.push(url);
      return new Response(fs.readFileSync(`public${url}`), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
    }) as typeof fetch;
    const ensured: FighterId[][] = [];
    try {
      resetTakes(); forgetTakePacks(); resetTransplant();
      await library.ensure(['bellows']);
      const body = library.create({ ...base('bellows'), id: 'p1' });
      installTransplant({ ensure: async ids => { ensured.push([...ids]); await library.ensure(ids); }, donor: state => library.has(state.fighter) ? library.create(state) : undefined,
        bodies: () => [body], effects: async () => {}, compile: async () => {} });
      setActiveKit({ ...ownKit('bellows', 'Pack'), slots: { ...ownKit('bellows').slots, special: { from: 'ippon', fromSlot: 'ultimate' } } });
      await prepare('bellows', 'ippon', 'ultimate');
      expect(fetched).toEqual([takePackUrl('ippon')]);
      expect(ensured.flat()).not.toContain('ippon');                    // its model is never asked for
      expect(knownTakes('ippon')?.ultimate.open.clip.name).toBe('Clean Slate');
      expect(prepareTimings().at(-1)?.move).toBe('bellows:ippon:ultimate');
      body.dispose();
    } finally { globalThis.fetch = native; setActiveKit(undefined, 'bellows'); resetTransplant(); forgetTakePacks(); }
  }, 60000);
});


