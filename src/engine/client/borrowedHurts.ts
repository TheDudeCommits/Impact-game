import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FighterId } from '../../game/types';
import { DREAM_FLINCH, DREAM_HURTS, Fighter, clipMotionTable } from '../../render/Fighter';
import { findClipIn } from '../../render/clipMatch';
import { loadTakePack } from './takePacks';
import { retarget, rigOf, type Rig } from './retarget';
import { ORIGINAL_HURT_DONOR } from '../../originals/hurts';

/** Whose takes are lent, and the files they are in: the authored hurts (taisei-fanim7), and his fold over a body blow
 *  (taisei-fanim6's `heavy-abdomen-fold`, round 97). */
export const HURT_DONOR: { readonly fighter: FighterId; readonly file: string; readonly files: readonly string[] } = {
  fighter: 'taisei', file: '/assets/fighters/taisei-fanim7.glb', files: ['/assets/fighters/taisei-fanim7.glb', '/assets/fighters/taisei-fanim6.glb'] };
Object.assign(HURT_DONOR, ORIGINAL_HURT_DONOR);
/** CLIP_RULES key -> the take's name. (Round 97: and `abdomen`, the fold a launch opens with - Fighter.ts `reaction`: a
 *  body a blow throws folds over it for the fold's length, then flies; without one of its own it was flung at once into
 *  its knockback's spread arms, the blind critics' "stiff T-pose launch".) */
const TAKES: Readonly<Record<string, string>> = { ...DREAM_HURTS, 'dream flinch': DREAM_FLINCH, abdomen: 'heavy-abdomen-fold' };
/** Bodies whose own acting is kept whatever they lack: Gorai's - his own reaction takes (gorai-wyrm-react1.glb), and at his size the takes' re-strikes in a string swung
 *  his hand 0.7-1.4 m in a frame (tests/reactionTakes, under Shirokane's string). */
const OWN_ACTING: ReadonlySet<FighterId> = new Set<FighterId>(['gorai']);
/** A body's reference for fitting: its idle as it stands in the game (as transplantTakes.ts reads one). */
const REFERENCE = ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle'];

/** The lent takes and the rig they are drawn on. */
export interface HurtDonor { readonly rig: Rig; readonly clips: readonly THREE.AnimationClip[] }
let donor: HurtDonor | undefined;
let loading: Promise<HurtDonor | undefined> | undefined;
/** Fetches the donor: its take pack's rig (one small request, shared with the move transplant) and its takes' file. */
async function fetchDonor(): Promise<HurtDonor | undefined> {
  const loader = new GLTFLoader();
  const [pack, ...files] = await Promise.all([loadTakePack(HURT_DONOR.fighter), ...HURT_DONOR.files.map(url => loader.loadAsync(url))]);
  const rig = pack?.light?.open.rig, names = new Set(Object.values(TAKES));
  return rig ? { rig, clips: files.flatMap(file => file.animations.filter(clip => names.has(clip.name))) } : undefined;
}
let load: () => Promise<HurtDonor | undefined> = fetchDonor;

/** Each source scene's fitted takes, by CLIP_RULES key (null: refused). */
let fits = new WeakMap<THREE.Object3D, Map<string, THREE.AnimationClip | null>>();
/** Whether the donor could not be had: every body keeps its own. */
let failed = false;
/** Scenes asked about before the takes were in: fitted as they arrive. */
const waiting = new Map<THREE.Object3D, { clips: readonly THREE.AnimationClip[]; fighter: FighterId }>();
/** Every fit made on this page ("konta: DZ recoil fold"), for the inspector and the tests. */
const report = new Map<string, { ok: boolean; reason?: string; stray?: number }>();
export const borrowReport = () => Object.fromEntries(report);

function fitAll(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId, from: HurtDonor) {
  let byKey = fits.get(scene);
  if (byKey) return byKey;
  fits.set(scene, byKey = new Map());
  // A body that carries the takes itself is drawn with its own (Fighter.clip asks only for what it lacks).
  const rig = rigOf(scene, findClipIn(clips, REFERENCE)), label = fighter;
  for (const [key, name] of Object.entries(TAKES)) {
    const take = from.clips.find(clip => clip.name === name);
    const result = take ? retarget(from.rig, take, rig) : { reason: `${HURT_DONOR.fighter} has no ${name}` };
    if (result.clip) clipMotionTable(result.clip);
    else if (!report.has(`${label}: ${name}`)) console.info(`Borrowed hurts: ${label} keeps its own hurt for ${name}: ${result.reason}.`);
    report.set(`${label}: ${name}`, result.clip ? { ok: true, stray: +(result.stray ?? 0).toFixed(1) } : { ok: false, reason: result.reason });
    byKey.set(key, result.clip ?? null);
  }
  return byKey;
}
function start() {
  loading ??= load().then(got => {
    donor = got;
    if (got) for (const [scene, { clips, fighter }] of waiting) fitAll(scene, clips, fighter, got);
    else failed = true;
    waiting.clear();
    return got;
  }, error => { console.info(`Borrowed hurts: unavailable (${(error as Error).message}); every body keeps its own.`); failed = true; waiting.clear(); return undefined; });
}
/** Fighter.borrowedHurt: the take for `key` fitted to the rig of `scene`, or nothing yet. */
export function borrowedHurt(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], key: string, fighter: FighterId): THREE.AnimationClip | undefined {
  if (!(key in TAKES) || failed || OWN_ACTING.has(fighter)) return undefined;
  if (!donor) { waiting.set(scene, { clips, fighter }); start(); return undefined; }
  return fitAll(scene, clips, fighter, donor).get(key) ?? undefined;
}
/** Fighter.borrowAhead: fits a fighter's takes as a body of it is made (FighterLibrary.create), or as the donor's arrive. */
export function borrowAhead(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId) {
  if (failed || OWN_ACTING.has(fighter)) return;
  if (donor) { fitAll(scene, clips, fighter, donor); return; }
  waiting.set(scene, { clips, fighter });
  start();
}
/** Installs the hooks (main.ts). `from` loads the donor another way (the tests read it off the disk). */
export function installBorrowedHurts(from?: () => Promise<HurtDonor | undefined>) {
  if (from) load = from;
  Fighter.borrowedHurt = borrowedHurt;
  Fighter.borrowAhead = borrowAhead;
  start();
  return loading!;
}
/** For tests: forget the donor and every fit, and take the hooks out. */
export function resetBorrowedHurts() {
  donor = undefined; loading = undefined; load = fetchDonor; failed = false; fits = new WeakMap(); waiting.clear(); report.clear();
  Fighter.borrowedHurt = undefined; Fighter.borrowAhead = undefined;
}
