import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FighterId } from '../../game/types';
import { styleOf, type TechniqueKey } from '../../game/techniques';
import type { BodyType } from '../sim/archetypes';
import { Fighter, clipMotionTable } from '../../render/Fighter';
import { findClipIn } from '../../render/clipMatch';
import { retarget, rigOf, type Rig } from './retarget';
import { FIGHTERS } from '../../config';
import contactFrames from '../../game/data/contactFrames.json';
import type { Canonical } from '../../render/skeleton';

/** Techniques (game/techniques.ts, 2 November 2026): each style's takes, fitted to every body that throws them (retarget.ts),
 *  as borrowedStrikes.ts fits lock combat's borrowed strikes. The takes are Meshy library actions cut round their strike
 *  (scripts/combos/techniques_pack.py: one file, a stub skin and an action a take, read against its combat stance `Idle`),
 *  fetched the first time a body throws a technique, and fitted once per body and take. A body with no fit yet - the file
 *  still coming, or a fit the retarget refused - throws its button's own clip, timed to the technique (Fighter's
 *  enderClip). Presentation only: the moves are the simulation's. */
export const TECHNIQUE_TAKES = '/assets/fighters/techniques.glb';

/** A take: its name in the file, where its blow lands as a share of the take (its fastest hand or foot, read off the
 *  Meshy action: scripts/combos/cutfind.py), and whether it is thrown in the air off a take that leaps (`level`: the
 *  body stays at the height the jump has it at, rather than leaping a second time). */
export interface StyleTake { take: string; contact: number; level?: boolean }
const t = (take: string, contact: number, level?: boolean): StyleTake => ({ take, contact, ...(level ? { level } : {}) });
export const STYLE_TAKES: Readonly<Record<BodyType, Readonly<Record<TechniqueKey, readonly StyleTake[]>>>> = {
  fists: {
    rush: [t('F.straight', 0.44), t('F.jab', 0.48)], rise: [t('F.upL', 0.35)], slip: [t('F.dodge', 0.42)],
    hh: [t('F.hook', 0.41)], hhh: [t('F.both', 0.46), t('F.combo1', 0.41)], charge: [t('F.knee', 0.41), t('F.frontkick', 0.41)],
    counter: [t('F.counterB', 0.41), t('F.counterA', 0.64)], delay: [t('F.hookL', 0.39), t('F.shorthook', 0.42)],
    airRush: [t('F.airpunch', 0.49, true)], dashStrike: [t('F.combo1', 0.41), t('F.combo3', 0.41)], wakeUp: [t('F.combo5', 0.46), t('F.combo3', 0.41)],
    airRise: [t('F.upL', 0.35)],
  },
  kicks: {
    rush: [t('K.simple', 0.58)], rise: [t('K.high', 0.53)], slip: [t('K.round', 0.5)], hh: [t('K.spin', 0.52)], hhh: [t('K.stepin', 0.49)],
    charge: [t('K.front', 0.41)], counter: [t('K.spin', 0.52)], delay: [t('K.round', 0.5)], airRush: [t('K.flying', 0.71, true)],
    dashStrike: [t('K.simple', 0.58)], wakeUp: [t('K.front', 0.41)], airRise: [t('K.high', 0.53)],
  },
  blade: {
    rush: [t('B.thrust', 0.32)], rise: [t('B.triple0', 0.53), t('B.reapup', 0.41)], slip: [t('B.wcombo2b', 0.44)],
    hh: [t('B.wcombo2a', 0.71)], hhh: [t('B.reap', 0.71)], charge: [t('B.chargedfull', 0.53)], counter: [t('B.iai2', 0.72)],
    delay: [t('B.triple1b', 0.52)], airRush: [t('B.thrust', 0.47)], dashStrike: [t('B.wcombo1', 0.42)],
    wakeUp: [t('B.wcombo', 0.68)], airRise: [t('B.reapup', 0.41), t('B.triple0', 0.53)],
  },
  polearm: {
    rush: [t('B.thrust', 0.32)], rise: [t('B.reapup', 0.41)], slip: [t('B.wcombo2b', 0.44)], hh: [t('B.wcombo2a', 0.71)], hhh: [t('B.reap', 0.71)],
    charge: [t('B.chargedfull', 0.53)], counter: [t('B.iai2', 0.72)], delay: [t('B.triple1b', 0.52)], airRush: [t('B.thrust', 0.47)],
    dashStrike: [t('B.wcombo1', 0.42)], wakeUp: [t('B.wcombo', 0.68)], airRise: [t('B.reapup', 0.41)],
  },
  caster: {
    rush: [t('C.cast', 0.41)], rise: [t('C.charged1', 0.41)], slip: [t('F.dodge', 0.42)], hh: [t('C.push', 0.32)], hhh: [t('C.slam', 0.56)],
    charge: [t('C.charged', 0.41)], counter: [t('C.cast2', 0.41)], delay: [t('C.cast3', 0.41)], airRush: [t('C.cast', 0.41)],
    dashStrike: [t('C.cast2', 0.41)], wakeUp: [t('C.cast3', 0.41)], airRise: [t('C.charged1', 0.41)],
  },
  giant: {
    rush: [t('F.straight', 0.44)], rise: [t('F.upL', 0.35)], slip: [t('F.dodge', 0.42)], hh: [t('F.hook', 0.41)], hhh: [t('C.slam', 0.56)],
    charge: [t('F.knee', 0.41)], counter: [t('F.counterB', 0.41)], delay: [t('F.both', 0.46)], airRush: [t('F.airpunch', 0.49, true)],
    dashStrike: [t('F.combo1', 0.41)], wakeUp: [t('F.combo5', 0.46)], airRise: [t('F.upL', 0.35)],
  },
};
/** Which of a style's takes a fighter throws, by its name: the same every time, and spread over the style. */
export function variantOf(fighter: FighterId, takes: readonly StyleTake[]): StyleTake {
  let h = 0;
  for (let i = 0; i < fighter.length; i++) h = (h * 31 + fighter.charCodeAt(i)) >>> 0;
  return takes[h % takes.length];
}
/** A fighter's own take for a technique, where its style's tips its body over (off the roster sheets). */
export const FIGHTER_TAKES: Readonly<Partial<Record<FighterId, Partial<Record<TechniqueKey, StyleTake>>>>> = {
  // Bellows's and Jirenga's bulk leans into the double-fisted punch until they tip 40 degrees off their feet.
  bellows: { hhh: t('F.combo1', 0.41) },
  jirenga: { hhh: t('F.combo1', 0.41) },
};
export function styleTake(fighter: FighterId, key: TechniqueKey): StyleTake { return FIGHTER_TAKES[fighter]?.[key] ?? variantOf(fighter, STYLE_TAKES[styleOf(fighter)][key]); }

/** Which way the takes' blows travel and which way a body faces in the game. The takes' rig throws its jabs and straights
 *  46 degrees round from its file's +Z (measured off the takes, scripts/combos/cutfind.py); every fighter's model faces
 *  its opponent down +Z (Fighter places it unturned). Hips-to-hips (retarget's estimate) sent the blows 15 to 40 degrees
 *  wide on a body that stands side-on. */
const FACING = { source: -46 * Math.PI / 180, target: 0 };
/** How much of a take's back the body takes, on its own stance (retarget's ownBack): the arms and legs throw the blow
 *  whole; the back bends and turns two thirds as far, so a brawler already standing bent does not bow. */
const BACK = .65;
/** How far a take may carry the body along the floor, in its hip heights: the technique's lunge is the simulation's. */
const TRAVEL = .35;
/** A weapon fighter's grip: each hand's turn on its forearm at the blow of the fighter's own heavy (contactFrames.json),
 *  where its blade or staff is held to strike - its stance's grip rests a GRAVEDIGGER on a shoulder, and a take's arm
 *  thrust at the opponent then points the blade at the sky. */
const ARMED: ReadonlySet<BodyType> = new Set<BodyType>(['blade', 'polearm']);
function strikeGrip(rig: Rig, clips: readonly THREE.AnimationClip[], fighter: FighterId): Partial<Record<Canonical, THREE.Quaternion>> | undefined {
  if (!ARMED.has(styleOf(fighter))) return undefined;
  const name = FIGHTERS[fighter]?.clips?.[1], clip = name ? findClipIn(clips, [name]) : undefined;
  if (!clip) return undefined;
  const at = clip.duration * ((contactFrames as Partial<Record<FighterId, { heavy?: number }>>)[fighter]?.heavy ?? .5), grip: Partial<Record<Canonical, THREE.Quaternion>> = {};
  for (const hand of ['LeftHand', 'RightHand'] as const) {
    const index = rig.joints.get(hand); if (index === undefined) continue;
    const node = rig.nodes[index].name, track = clip.tracks.find(t => t.name.endsWith('.quaternion') && THREE.PropertyBinding.parseTrackName(t.name).nodeName === node);
    if (track) grip[hand] = new THREE.Quaternion().fromArray((track as THREE.KeyframeTrack & { createInterpolant(): { evaluate(t: number): ArrayLike<number> } }).createInterpolant().evaluate(at) as number[]).normalize();
  }
  return grip;
}
/** Bodies that throw their buttons' own clips for every technique (Fighter's enderClip) rather than the style's takes,
 *  off the roster sheets (2 November 2026): Strappado's feather coat balloons into a disc whenever a take lifts his
 *  arms, and Shakudo's arm blade belongs to his own clips only. */
export const OWN_CLIPS_ONLY: ReadonlySet<FighterId> = new Set<FighterId>(['strappado', 'shakudo']);
/** A body's reference for fitting: its idle as it stands in the game (as borrowedStrikes.ts reads one). */
const REFERENCE = ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle'];
interface Takes { rig: Rig; clips: Map<string, THREE.AnimationClip> }
let load: () => Promise<Takes | undefined> = async () => {
  const file = await new GLTFLoader().loadAsync(TECHNIQUE_TAKES);
  const idle = file.animations.find(c => c.name === 'Idle');
  return { rig: rigOf(file.scene, idle), clips: new Map(file.animations.map(c => [c.name, c])) };
};
let takes: Takes | null | undefined;
let fetching: Promise<Takes | undefined> | undefined;
function fetchTakes() {
  fetching ??= load().then(found => { takes = found ?? null; return found; }, error => {
    console.info(`Techniques: the style takes are unavailable (${(error as Error).message}); each button's own clip stands in.`);
    takes = null; return undefined;
  });
  return fetching;
}
/** Each body's fitted takes, by take name (null: refused). */
let fits = new WeakMap<THREE.Object3D, Map<string, THREE.AnimationClip | null>>();
const report = new Map<string, { ok: boolean; reason?: string; stray?: number }>();
export const styleReport = () => Object.fromEntries(report);
/** What fitting has cost this page (milliseconds, fits), for the probes (window.styleFits). */
export const fitCost = { ms: 0, fits: 0 };
if (typeof window === 'object') (window as unknown as { styleFits?: typeof fitCost }).styleFits = fitCost;

/** Fighter.styleMove: `fighter`'s take for `key` fitted to the rig of `scene`, with its blow's share; undefined while the
 *  takes are coming (ask again), null where the fit refused it. */
export function styleMove(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId, key: TechniqueKey): { clip: THREE.AnimationClip; contact: number } | null | undefined {
  if (OWN_CLIPS_ONLY.has(fighter)) return null;
  return fitTake(scene, clips, fighter, key, styleTake(fighter, key));
}
/** `pick` fitted to the rig of `scene` (styleMove, for the take the fighter throws; tools/technique_sheet.ts, for any). */
export function fitTake(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId, key: TechniqueKey, pick: StyleTake): { clip: THREE.AnimationClip; contact: number } | null | undefined {
  if (takes === undefined) { void fetchTakes(); return undefined; }
  if (takes === null) return null;
  let byTake = fits.get(scene);
  if (!byTake) fits.set(scene, byTake = new Map());
  const fit = pick.level ? `${pick.take} level` : pick.take;
  let fitted = byTake.get(fit);
  if (fitted === undefined) {
    const source = takes.clips.get(pick.take);
    if (!source) { byTake.set(fit, fitted = null); }
    else {
      const t0 = performance.now();
      const body = rigOf(scene, findClipIn(clips, REFERENCE));
      const result = retarget(takes.rig, source, body, 60, { ownBack: BACK, facing: FACING, level: pick.level, ownHands: true, grip: strikeGrip(body, clips, fighter), travel: TRAVEL });
      fitCost.ms += performance.now() - t0; fitCost.fits++;
      const label = `${fighter} ${key}: ${pick.take}`;
      if (result.clip) { result.clip.name = `technique ${pick.take}`; clipMotionTable(result.clip); }
      else console.info(`Techniques: ${label} refused: ${result.reason}.`);
      report.set(label, result.clip ? { ok: true, stray: +(result.stray ?? 0).toFixed(1) } : { ok: false, reason: result.reason });
      fitted = result.clip ?? null;
      byTake.set(fit, fitted);
    }
  }
  return fitted ? { clip: fitted, contact: pick.contact } : null;
}
/** The shared take an action falls back to on a body with no clip of its own for it (Fighter.fallbackTake): the library's
 *  idle, and a plain strike for each attack slot. The takes are the project's own (TECHNIQUE_TAKES). */
export const FALLBACK_TAKES: Readonly<Record<string, StyleTake>> = {
  idle: { take: 'Idle', contact: 0 }, guard: { take: 'Idle', contact: 0 }, victory: { take: 'C.charged1', contact: .5 },
  light: { take: 'F.jab', contact: .45 }, heavy: { take: 'F.straight', contact: .5 }, special: { take: 'C.cast', contact: .5 },
  ultimate: { take: 'C.charged', contact: .6 }, area: { take: 'C.slam', contact: .55 }, awaken: { take: 'C.charged1', contact: .5 },
};
/** Fighter.fallbackTake: `action`'s shared take fitted to the rig of `scene`; undefined while the takes load or where none fits. */
export function fallbackTake(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], fighter: FighterId, action: string): THREE.AnimationClip | undefined {
  const pick = FALLBACK_TAKES[action];
  if (!pick) return undefined;
  return fitTake(scene, clips, fighter, `fallback ${action}` as TechniqueKey, pick)?.clip ?? undefined;
}
/** Installs the hook. `from` loads the takes another way (the tests read the file off the disk); resolves once they are in. */
export function installStyleMoves(from?: () => Promise<Takes | undefined>) {
  if (from) { load = from; takes = undefined; fetching = undefined; }
  Fighter.styleMove = styleMove;
  Fighter.styleLegs = (fighter, key) => !OWN_CLIPS_ONLY.has(fighter) && (styleOf(fighter) === 'kicks' || !!styleTake(fighter, key).level);
  // (Fetched as the first body is made - FighterLibrary.create - not with the page: the home screen never needs it.)
  Fighter.stylesAhead = () => { void fetchTakes(); };
  Fighter.fallbackTake = fallbackTake;
  return from ? fetchTakes() : Promise.resolve(undefined);
}
/** The takes in hand (or known to be missing): main.ts waits on it beside a room's other files, so every body built behind
 *  the loading screen fits its techniques there (Fighter.prepareMoves) rather than on its first technique mid-fight. */
export function stylesReady(): Promise<unknown> { return Fighter.styleMove ? fetchTakes().catch(() => undefined) : Promise.resolve(); }
/** For tests: forget the takes and every fit, and take the hook out. */
export function resetStyleMoves() { takes = undefined; fetching = undefined; fits = new WeakMap(); report.clear(); Fighter.styleMove = undefined; Fighter.stylesAhead = undefined; Fighter.styleLegs = undefined; Fighter.fallbackTake = undefined; }
