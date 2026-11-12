import type { FighterId } from '../game/types';
import type { SpringProfile } from '../render/SecondaryMotion';
import { LOCK_NAMES } from './lockNames';
import { ORIGINALS } from './roster';
import { ORIGINAL_WORLDS, SOUNDTRACK, type SoundtrackMode, type SoundtrackTrack } from './score';
import { applyScoreStandIns } from './scoreStandIns';
import VOICES from './voices.json';
import PIXEL_SFX from './pixelSfx.json';

/** src/render/idle/profile.ts IDLE_PROFILES: each original's idle clips, bound on its own body. */
export function applyOriginalIdles<T extends { model?: string }>(profiles: Partial<Record<FighterId, T>>) {
  for (const [id, original] of Object.entries(ORIGINALS) as [FighterId, NonNullable<(typeof ORIGINALS)[FighterId]>][]) {
    const profile = profiles[id];
    if (profile && original.idleModel) profiles[id] = { ...profile, model: original.idleModel };
  }
  return profiles;
}

/** A move, ender, stage or transformation's name as the original fighter is shown calling it. The simulation's own
 *  name is the key; a name the fighter does not rename passes through. */
export function displayMove(fighter: FighterId | string | undefined, name: string): string;
export function displayMove(fighter: FighterId | string | undefined, name: string | undefined): string | undefined;
export function displayMove(fighter: FighterId | string | undefined, name: string | undefined) {
  if (name === undefined || fighter === undefined) return name;
  const original = ORIGINALS[fighter as FighterId];
  // (Lock combat's second rounds, which main names in its own tables: src/originals/lockNames.ts.)
  return original ? original.names[name] ?? LOCK_NAMES[fighter as FighterId]?.[name] ?? name : name;
}

/** A long coat and a cape while their fighter is LAUNCHED (cloth2, 5 November 2026; SecondaryMotion `launched`, eased in on
 *  the throw and out on the landing). On the ground they hang toward the floor (`hang`, `droop`) and are kept off it; thrown
 *  upside down, that turned the coat over the torso and the head as one shell, and pressed its hem flat on a floor that was
 *  the body's own origin, flying with it (a table top, a lampshade: the gauntlet's CLOTH-BOARD on the coated bodies). In the
 *  air the coat flies with the body: no droop, little weight, its floor the real ground, hanging toward the floor only while
 *  the body still carries it hanging (`hang` 0 upside down), each link curling a little toward the wind of the flight (behind
 *  it, and floorward: `sweep`) so the hem trails in an arc, rippling as the body travels. A cape's chains are twice as long
 *  in links, so each turns less. */
export const LAUNCHED_COAT: NonNullable<SpringProfile['launched']> = { hang: 0, droop: 180, gravity: .8, maxAngle: 24, stiffness: 20, tipLoose: .9, flutter: .15, sweep: .6, curl: .6 };
export const LAUNCHED_CAPE: NonNullable<SpringProfile['launched']> = { hang: 0, droop: 180, gravity: .8, maxAngle: 16, stiffness: 18, tipLoose: .8, flutter: .15, sweep: .6, curl: .5 };
const LAUNCHED_KEPT = new Set<string>(['kenzo', 'nigo', 'gorai', 'psyche', 'aquilo', 'bruin', 'sashigane', 'akagane', 'shiun',
  'rook', 'torsion', 'vesper']);

/** polish7 (5 November 2026): the slots whose coat keeps its air settings while the fighter lies after a fall and gets up
 *  (roster.ts `coat.floored`), read by Fighter.ts's launch hook each frame. A slot whose garments keep their ground settings
 *  in the air (LAUNCHED_KEPT) has no air settings to keep. */
const FLOORED_COATS = new Set<string>((Object.entries(ORIGINALS) as [FighterId, NonNullable<(typeof ORIGINALS)[FighterId]>][])
  .filter(([id, original]) => original.coat?.floored && !LAUNCHED_KEPT.has(id)).map(([id]) => id));
export const coatFlownWhileDown = (fighter: string) => FLOORED_COATS.has(fighter);
/** remake-misc (6 November 2026): Madake's coat takes its air settings (LAUNCHED_COAT: no hang toward the floor, no lift cap)
 *  through his two kick enders, Flying Greeting (J J K) and Bamboo Cyclone (J J J K), read by Fighter.ts's launch hook. His
 *  skirt is slit up both sides (scripts/originals/shop/coat_slit_r6.py) and those clips carry the front panel up over the kicking
 *  knee (coat_kick_r6.py); on the ground settings the panel was held hanging (75% toward the floor, never past 62 degrees off
 *  straight down), a sheet in front of the leg from the fight camera. */
export const coatFlownInKick = (state: { fighter: string; action: string; branch?: string }) =>
  state.fighter === 'madake' && state.action === 'heavy' && (state.branch === 'llh' || state.branch === 'lllh');

export const BEARD_SPRINGS: Partial<Record<FighterId, Partial<SpringProfile>>> = {
  kenzo: { stiffness: 60, drag: .7, gravity: 2, maxAngle: 8, spread: .12, trail: .05 },
};

export function applyOriginalSprings(profiles: Partial<Record<string, Partial<SpringProfile>>>) {
  for (const [id, original] of Object.entries(ORIGINALS) as [FighterId, NonNullable<(typeof ORIGINALS)[FighterId]>][]) {
    // kenzo-build: a modelled beard's hanging locks (BEARD_SPRINGS; a body without Detail_CLOTH_Beard bones is untouched).
    const beard = BEARD_SPRINGS[id];
    if (beard) profiles[id] = { ...profiles[id], chains: [{ match: /^Detail_CLOTH_Beard_/, profile: beard }, ...(profiles[id]?.chains ?? [])] };
    // A cape hung from the shoulders (scripts/originals/shop/cape_chains_r6.py, QA round fix-cloth, 3 November 2026): light
    // cloth hung from the chest, its first link mostly toward the floor whatever the chest does, so a lunge or a flying
    // kick no longer stands it out behind as a board; graded loose toward the hem, its chains answering almost alike so it
    // swings as one sheet rather than a fan of slats; trailing a run, never rising past `droop`, kept out of the legs.
    if (original.cape) {
      const c = original.cape;
      // (`thigh: 0`: no capsules - a floor-length cape seated or pooled would be pushed off the floor and fanned into slats.)
      const cape: Partial<SpringProfile> = { stiffness: c.stiffness ?? 18, drag: .7, gravity: 3, maxAngle: c.cone ?? 18, tipLoose: .7, spread: .06,
        hang: c.hang ?? .75, droop: c.droop ?? 70, trail: .06, ...(c.thigh === 0 ? {} : { legs: { thigh: c.thigh ?? .13, shin: c.shin ?? .12, floor: .015 } }),
        launched: LAUNCHED_KEPT.has(id) ? undefined : LAUNCHED_CAPE };
      profiles[id] = { ...profiles[id], chains: [{ match: /^Detail_CLOTH_Cape_/, profile: cape }, ...(profiles[id]?.chains ?? [])] };
    }
    if (!original.coat) continue;
    const coat = { stiffness: 22, drag: .72, gravity: 2.8, maxAngle: original.coat.cone ?? 12, tipLoose: 1.25, spread: .2, hang: .75, droop: 62,
      legs: { thigh: original.coat.thigh, shin: original.coat.shin, floor: original.coat.floor ?? .015 }, launched: LAUNCHED_KEPT.has(id) ? undefined : LAUNCHED_COAT }; // (polish7: `floor`)
    profiles[id] = { ...profiles[id], chains: [{ match: /^Detail_CLOTH_Coat_/, profile: coat }, ...(profiles[id]?.chains ?? [])] };
  }
}

export function applyOriginalHomeArt(assets: string[], windows: Partial<Record<FighterId, string>>, portraitArt: (id: FighterId) => string) {
  for (const id of Object.keys(ORIGINALS) as FighterId[]) {
    if (!ORIGINALS[id]!.homeArt) continue;
    delete windows[id];
    const art = portraitArt(id);
    if (!assets.includes(art)) assets.push(art);
  }
}

/** src/audio/cueTypes.ts: every cue an original speaks plays the original's own line (src/originals/voices.json, made by
 *  scripts/originals/voice/prepare.py), with its own length; the line is trimmed to its voice, so it starts at once. The
 *  cue keys stay the game's (voicePlan.ts schedules them by key, and loads a fighter's by its id's prefix). */
export function applyOriginalCues(cues: Record<string, string>, ...lengths: Record<string, number>[]) {
  const [cueDurations, voiceDurations, onsets] = lengths;
  for (const [cue, line] of Object.entries(VOICES.cues)) {
    cues[cue] = line.file;
    if (cue in voiceDurations) voiceDurations[cue] = line.seconds;
    else cueDurations[cue] = line.seconds;
    if (cue in onsets) onsets[cue] = 0;
  }
  for (const [cue, sound] of Object.entries(PIXEL_SFX.cues as Record<string, { file: string; seconds: number }>)) {
    cues[cue] = sound.file;
    cueDurations[cue] = sound.seconds;
    if (cue in onsets) onsets[cue] = 0;
  }
  return cues;
}

/** src/audio/musicTracks.ts: the soundtrack (src/originals/score.ts SOUNDTRACK, 4 November 2026) as entries of the table, so the
 *  packager ships every track of it: the home songs in the home screen's scope, the rest gameplay tracks. */
export function applyOriginalMusic<T extends { id: string; url: string; title: string; artist: string; scope: string; series: string; category: string }>(tracks: Record<string, T>) {
  const entry = (track: SoundtrackTrack, scope: 'homescreen' | 'gameplay', category: string, flag?: 'stinger' | 'boss') =>
    ({ id: track.id, title: track.title, artist: track.artist, series: 'soundtrack', category, url: track.url, scope, ...(flag ? { [flag]: true } : {}) }) as unknown as T;
  for (const track of SOUNDTRACK.home) tracks[track.id] = entry(track, 'homescreen', 'opening');
  for (const track of SOUNDTRACK.boss) tracks[track.id] = entry(track, 'gameplay', 'score', 'boss');
  for (const track of [...Object.values(SOUNDTRACK.modes).flat(), ...SOUNDTRACK.results.win, ...SOUNDTRACK.results.loss])
    tracks[track.id] ??= entry(track, 'gameplay', 'score');
  for (const track of [SOUNDTRACK.stinger.win, SOUNDTRACK.stinger.loss]) tracks[track.id] = entry(track, 'gameplay', 'score', 'stinger');
  return applyScoreStandIns(tracks); // (the held-back soundtrack's slots play the game's own score: scoreStandIns.ts)
}

/** What a match's music knows of it (4 November 2026): its mode (src/ui/modes/catalogue.ts modeOfSnapshot), how it ended
 *  for this page (src/ui/results/finale.ts finaleMine; an Arcade Survival run's `victory`), and the match's number, which
 *  turns the mode's playlist so the next match opens on its next theme. */
export interface SoundtrackContext { mode?: SoundtrackMode | string; outcome?: 'win' | 'loss'; turn?: number;
  /** The match's climax (the ball modes: CharacterMusic.peak): its fight opens on the mode's SOUNDTRACK.peak. */
  peak?: boolean }

/** src/audio/musicTracks.ts selectMusicTracks (4 November 2026): a match's music by its mode, ahead of the queue the
 *  fighters' worlds make (which keeps playing after it). A fight opens on its mode's battle themes (an Arcade Survival
 *  boss round on the boss themes); the end opens on the victory or defeat sting, then the results themes. With no mode
 *  (a tool's call) the queue is the fighters' alone, as before. `lead` is the pseudo-fighter the music was asked for: an
 *  Arcade Survival run's 'rift:<series>:<moment>:<round>' says whether a boss is being fought. */
export function soundtrackQueue<T extends { id: string; url: string }>(tracks: Record<string, T>, queue: T[], lead: string, phase: 'combat' | 'results', context?: SoundtrackContext): T[] {
  const mode = context?.mode as SoundtrackMode | undefined;
  if (!mode || !(mode in SOUNDTRACK.modes)) return queue;
  const turn = Math.max(0, Math.floor(context?.turn ?? 0));
  const spin = <U,>(list: readonly U[]) => list.map((_, i) => list[(i + turn) % list.length]);
  let first: readonly SoundtrackTrack[];
  if (phase === 'results') {
    const outcome = context?.outcome ?? 'loss';
    first = [SOUNDTRACK.stinger[outcome], ...SOUNDTRACK.results[outcome]];
  } else {
    const boss = lead.startsWith('rift:') && lead.split(':')[2] === 'boss', peak = context?.peak ? SOUNDTRACK.peak[mode] : undefined;
    first = boss ? [...spin(SOUNDTRACK.boss), ...spin(SOUNDTRACK.modes[mode])] : peak ? [peak, ...spin(SOUNDTRACK.modes[mode])] : spin(SOUNDTRACK.modes[mode]);
  }
  const ahead = first.map(track => tracks[track.id]).filter((track): track is T => !!track);
  const seen = new Set(ahead.map(track => track.url));
  return [...ahead, ...queue.filter(track => !seen.has(track.url) && !!seen.add(track.url))];
}

export function applyOriginalSpirits<T extends { asset: string; punches?: string; fistMesh?: string }>(users: Partial<Record<FighterId, T>>) {
  for (const [id, original] of Object.entries(ORIGINALS) as [FighterId, NonNullable<(typeof ORIGINALS)[FighterId]>][]) {
    const user = users[id];
    if (!user || !original.companion) continue;
    users[id] = { ...user, asset: original.companion.model, punches: original.companion.punches, fistMesh: undefined };
  }
}

export function applyOriginalSpiritShells<T extends { print: { glow?: RegExp; glowUv?: readonly number[] } }>(shells: Partial<Record<FighterId, T>>) {
  for (const id of Object.keys(ORIGINALS) as FighterId[]) {
    const shell = shells[id];
    if (!shell || !ORIGINALS[id]!.companion) continue;
    shells[id] = { ...shell, print: { ...shell.print, glow: undefined, glowUv: undefined } };
  }
}

const SERIES_WORLD: Readonly<Record<string, readonly string[]>> = {
  'Last Sun': ['Last Sun', 'Seven Star Saga'], 'Dust Sea': ['Dust Sea', 'Spring Tides', 'Old Growth', 'Stone Ford'], 'Ashwood': ['Ashwood', 'Shinobi Spiral', 'Hundred Bells'], 'Cinder Requiem': ['Cinder Requiem'],
  'Gilded Ruin': ['Gilded Ruin'], 'Hex Fallout': ['Hex Fallout', 'Hexbound'], 'Grave Hound': ['Grave Hound'], 'Salvage Wilds': ['Salvage Wilds', 'Phantom Hunt', 'Paper Sky'],
  'Ropewalk': ['Ironwall', 'Ropewalk'], 'Blast Radius': ['Blast Radius'], 'Black Snow': ['Black Snow'], 'Gatefall': ['Gatefall'],
  'Slag Hill': ['Slag Hill'], 'Crimson Ledger': ['Crimson Ledger'],
  'Beacon Ward': ['Beacon Ward'], 'Scrap Pact': ['Scrap Pact'], 'Ghost Wake': ['Ghost Wake'], 'Red Cradle': ['Red Cradle'],
  'Penance Road': ['Penance Road'], 'Briar Crown': ['Briar Crown'], 'Carcass Coast': ['Carcass Coast'],
};

export const originalWorld = (series: string) => Object.keys(SERIES_WORLD).find(world => SERIES_WORLD[world].includes(series));

export function applyOriginalWorlds<T>(worlds: Record<string, T>) {
  for (const [world, series] of Object.entries(SERIES_WORLD)) for (const own of series)
    if (worlds[world] !== undefined && worlds[own] === undefined) worlds[own] = worlds[world];
  return worlds;
}

export function applyOriginalWorldPatterns<W>(patterns: [RegExp, W][]) {
  for (const [world, series] of Object.entries(SERIES_WORLD)) {
    const id = patterns.find(([pattern]) => pattern.test(world))?.[1];
    if (id !== undefined) for (const own of series) patterns.push([new RegExp(`^${own.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), id]);
  }
  return patterns;
}

export function applyOriginalImpactWords(words: Partial<Record<FighterId, string>>) {
  for (const [id, original] of Object.entries(ORIGINALS) as [FighterId, NonNullable<(typeof ORIGINALS)[FighterId]>][])
    if (original.impactWord) words[id] = original.impactWord;
}

// ---- Team S (round 4): sound and music ----------------------------------------------------------------------------

export function applyOriginalSeries<T extends { id: string; url: string; title: string; artist: string; series: string; category: string; scope: string }>(
  tracks: Record<string, T>, fighterSeries: Record<string, string>, phases: Record<string, { combat: string; results: string }>, scored: Set<string>) {
  for (const world of ORIGINAL_WORLDS) {
    tracks[world.id] = { id: world.id, title: world.title, artist: world.artist, series: world.series, category: 'score', url: world.url, scope: 'gameplay' } as T;
    phases[world.series] = { combat: world.id, results: world.id };
    for (const fighter of world.fighters) { fighterSeries[fighter] = world.series; scored.delete(fighter); }
  }
  return tracks;
}

const UNIVERSES: [RegExp, string][] = [
  [/DUST SEA/, 'dust-sea'], [/LAST SUN/, 'last-sun'], [/ASHWOOD/, 'konta'], [/CINDER REQUIEM/, 'cinder-requiem'],
  [/GILDED RUIN/, 'gilded-ruin'], [/HEX FALLOUT/, 'hex-fallout'], [/GRAVE HOUND/, 'grave-hound'], [/SALVAGE WILDS/, 'salvage-wilds'],
  [/GRAND TIDES/, 'dust-sea'], [/SEVEN STAR SAGA/, 'last-sun'], [/SHINOBI SPIRAL/, 'konta'], [/HEXBOUND/, 'hex-fallout'],
  [/PHANTOM HUNT/, 'salvage-wilds'],
];
export function originalUniverse(universe: string): string | undefined {
  for (const [name, series] of UNIVERSES) if (name.test(universe.toUpperCase())) return series;
  return undefined;
}
