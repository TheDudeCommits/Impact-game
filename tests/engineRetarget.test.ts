import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import { Fighter, FighterLibrary } from '../src/render/Fighter';
import { ownKit, type ForgeKit } from '../src/engine/sim';
import { setActiveKit } from '../src/engine/client/forgeLive';
import { installTransplant, prepare, resetTransplant } from '../src/engine/client/transplant';
import { knownTakes, resetTakes } from '../src/engine/client/transplantTakes';
import { retarget, rigOf } from '../src/engine/client/retarget';
import { base, loadRig } from './rigHarness';

/** VOL.5, the move transplant: a borrowed move thrown with its own fighter's take, fitted to the body throwing it
 *  (src/engine/client/retarget.ts, transplantTakes.ts), through the real FighterLibrary and Fighter. */
const load = GLTFLoader.prototype.loadAsync;
beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url); }; });
afterAll(() => { GLTFLoader.prototype.loadAsync = load; });

const library = new FighterLibrary();
const bodies: Fighter[] = [];
beforeAll(() => {
  installTransplant({ ensure: ids => library.ensure(ids), donor: state => library.has(state.fighter) ? library.create(state) : undefined, bodies: () => bodies,
    effects: async () => {}, compile: async () => {} });
});
afterEach(() => { for (const id of ['bellows', 'strix', 'setsu', 'ippon', 'kenzo'] as FighterId[]) setActiveKit(undefined, id); bodies.length = 0; });
afterAll(() => { resetTransplant(); resetTakes(); Fighter.transplant = undefined; });

const kit = (body: FighterId, picks: Partial<Record<AttackSlot, ForgeKit['slots']['light']>>): ForgeKit =>
  ({ ...ownKit(body, 'Transplant'), slots: { ...ownKit(body).slots, ...picks } });
/** A body thrown into `slot` and drawn for `seconds`, frame by frame; the takes it drew. */
function throwMove(body: Fighter, slot: AttackSlot, seconds = MOVES[body.state.fighter][slot].duration) {
  const duration = MOVES[body.state.fighter][slot].duration, drawn = new Set<string>();
  const state: PlayerState = { ...base(body.state.fighter), id: body.state.id, action: slot, actionStarted: 1, actionDuration: duration, actionTime: 0, actionSeq: 1 };
  body.update(1 / 60, { ...state, action: 'idle', actionDuration: 0 }, true);
  for (let t = 0; t <= seconds; t += 1 / 60) {
    body.update(1 / 60, { ...state, actionTime: Math.min(1, t / duration) }, true);
    const clip = (body as unknown as { active?: THREE.AnimationAction }).active?.getClip();
    if (clip) drawn.add(clip.name);
  }
  return [...drawn];
}

describe('the move transplant: fitting a take to another body', () => {
  it("fits a take onto bodies of every rig family, its bones pointing as the source's do", async () => {
    await library.ensure(['kagari', 'bellows', 'strix', 'setsu', 'nigo', 'taisei', 'konta', 'kenzo']);
    const rigOfFighter = (id: FighterId) => { const made = library.create(base(id)), read = made.take(base(id)); made.dispose(); return { scene: read.scene, clips: read.clips }; };
    const kagari = rigOfFighter('kagari'), taimatsu = kagari.clips.find(clip => clip.name === 'Taimatsu') ?? kagari.clips.find(clip => /taimatsu/i.test(clip.name))!;
    expect(taimatsu, "Kagari's Taimatsu take").toBeTruthy();
    const source = rigOf(kagari.scene, kagari.clips.find(clip => clip.name === '_Idle'));
    expect(source.problem).toBeUndefined();
    for (const id of ['bellows', 'strix', 'setsu', 'nigo', 'taisei', 'konta', 'kenzo'] as FighterId[]) {
      const body = rigOfFighter(id), target = rigOf(body.scene, body.clips.find(clip => /^_?idle$/i.test(clip.name)) ?? body.clips[0]);
      const fitted = retarget(source, taimatsu, target);
      expect(fitted.reason, id).toBeUndefined();
      expect(fitted.clip!.duration, id).toBeCloseTo(taimatsu.duration, 5);
      expect(fitted.clip ? fitted.stray : Infinity, id).toBeLessThan(5);
      for (const track of fitted.clip!.tracks) {
        expect(THREE.PropertyBinding.findNode(body.scene, THREE.PropertyBinding.parseTrackName(track.name).nodeName), `${id} ${track.name}`).toBeTruthy();
        expect([...track.values].every(Number.isFinite), `${id} ${track.name}`).toBe(true);
      }
    }
  }, 60000);

  it("throws a borrowed move with its own fighter's take, and the body's own moves with its own", async () => {
    await library.ensure(['bellows', 'kagari']);
    setActiveKit(kit('bellows', { special: { from: 'kagari' } }));
    await prepare('bellows', 'kagari', 'special');
    const take = knownTakes('kagari')!.special.open.clip.name;
    const body = library.create({ ...base('bellows'), id: 'p1' });
    bodies.push(body);
    try {
      expect(throwMove(body, 'special')).toContain(take);
      const own = throwMove(body, 'heavy');
      expect(own).not.toContain(take);
      expect(own).toContain('Smelter\'s Fist');
    } finally { body.dispose(); }
    // Without the kit, the body's own special again.
    setActiveKit(undefined, 'bellows');
    const plain = library.create({ ...base('bellows'), id: 'p2' });
    try { expect(throwMove(plain, 'special')).toContain('Slag Lances'); } finally { plain.dispose(); }
  }, 60000);
});
