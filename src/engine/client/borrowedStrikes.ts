import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FighterId } from '../../game/types';
import { LOCK_ROUND_BORROW, type LockBorrow } from '../../game/lockRoundBorrow';
import { Fighter, clipMotionTable } from '../../render/Fighter';
import { findClipIn } from '../../render/clipMatch';
import { loadTakePack } from './takePacks';
import { retarget, rigOf, type Rig } from './retarget';
import { applyOriginalLockTakes } from '../../originals/lockStrikes';

applyOriginalLockTakes();

/** Lock combat's borrowed strikes (game/lockRoundBorrow.ts): the second-round takes of the fighters with none to spare -
 *  another fighter's strike fitted to the body (retarget.ts), as borrowedHurts.ts fits Taisei's hurts to every body. A
 *  donor is fetched the first time a body needs it: its take pack's rig (one small request, shared with the move
 *  transplant) and the small file its take is in; each take is fitted once per rig. Presentation only: the second
 *  round's moves are the simulation's (lockCombat.ts lockRoundName). Installed on the lock combat preview (main.ts). */

/** A body's reference for fitting: its idle as it stands in the game (as borrowedHurts.ts reads one). */
const REFERENCE = ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle'];
export interface StrikeDonor { readonly rig: Rig; readonly clip: THREE.AnimationClip }
/** Loads one donor take; replaced by the tests to read off the disk. */
let load: (borrow: LockBorrow) => Promise<StrikeDonor | undefined> = async borrow => {
  const [pack, file] = await Promise.all([loadTakePack(borrow.from), new GLTFLoader().loadAsync(borrow.file)]);
  const rig = pack?.light?.open.rig, clip = file.animations.find(c => c.name === borrow.clip);
  return rig && clip ? { rig, clip } : undefined;
};
/** Each donor take, by `from:clip`: the fetch, then what it gave (null: none). */
const donors = new Map<string, Promise<StrikeDonor | undefined>>();
const got = new Map<string, StrikeDonor | null>();
/** Each source scene's fitted takes, by stage (null: refused). */
let fits = new WeakMap<THREE.Object3D, (THREE.AnimationClip | null | undefined)[]>();
const report = new Map<string, { ok: boolean; reason?: string; stray?: number }>();
export const strikeReport = () => Object.fromEntries(report);
const keyOf = (b: LockBorrow) => `${b.from}:${b.clip}`;

function fetchDonor(borrow: LockBorrow) {
  const key = keyOf(borrow);
  if (!donors.has(key)) donors.set(key, load(borrow).then(d => { got.set(key, d ?? null); return d; }, error => {
    console.info(`Borrowed strikes: ${key} unavailable (${(error as Error).message}); the first round's take stands in.`);
    got.set(key, null); return undefined;
  }));
  return donors.get(key)!;
}
/** Fighter.borrowedStrike: `fighter`'s second-round take at `stage` fitted to the rig of `scene`; undefined while it is
 *  coming (ask again), null where there is none to borrow or the fit refused it. */
export function borrowedStrike(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId, stage: number): THREE.AnimationClip | null | undefined {
  const borrow = LOCK_ROUND_BORROW[fighter]?.[stage];
  if (!borrow) return null;
  let byStage = fits.get(scene);
  if (!byStage) fits.set(scene, byStage = []);
  if (byStage[stage] !== undefined) return byStage[stage];
  const donor = got.get(keyOf(borrow));
  if (donor === undefined) { void fetchDonor(borrow); return undefined; }
  if (donor === null) return byStage[stage] = null;
  const result = retarget(donor.rig, donor.clip, rigOf(scene, findClipIn(clips, REFERENCE)));
  const label = `${fighter} ${stage}: ${borrow.from} ${borrow.clip}`;
  if (result.clip) { result.clip.name = `lock ${borrow.name}`; clipMotionTable(result.clip); }
  else console.info(`Borrowed strikes: ${label} refused: ${result.reason}.`);
  report.set(label, result.clip ? { ok: true, stray: +(result.stray ?? 0).toFixed(1) } : { ok: false, reason: result.reason });
  return byStage[stage] = result.clip ?? null;
}
/** Fighter.strikesAhead: starts fetching a fighter's donors as a body of it is made, so its second round is in hand. */
export function strikesAhead(fighter: FighterId) {
  for (const borrow of LOCK_ROUND_BORROW[fighter] ?? []) if (borrow) void fetchDonor(borrow);
}
/** Installs the hooks. `from` loads a donor another way (the tests read it off the disk); resolves once given donors
 *  for `fighters` are in, for a test to wait on. */
export function installBorrowedStrikes(from?: (borrow: LockBorrow) => Promise<StrikeDonor | undefined>, fighters: readonly FighterId[] = []) {
  if (from) load = from;
  Fighter.borrowedStrike = borrowedStrike;
  Fighter.strikesAhead = strikesAhead;
  return Promise.all(fighters.flatMap(id => (LOCK_ROUND_BORROW[id] ?? []).flatMap(b => b ? [fetchDonor(b)] : [])));
}
/** For tests: forget every donor and fit, and take the hooks out. */
export function resetBorrowedStrikes() {
  donors.clear(); got.clear(); fits = new WeakMap(); report.clear();
  Fighter.borrowedStrike = undefined; Fighter.strikesAhead = undefined;
}
