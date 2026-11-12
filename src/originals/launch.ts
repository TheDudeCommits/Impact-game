import { ITEMS, type Item } from '../game/economy/catalog';
import { HELD, LOCKED } from '../game/economy/fighters';
import { OUTFITS } from '../game/economy/outfits';
import { ROAD } from '../game/economy/unlocks';
import { MOVES } from '../game/moves';
import { ARENAS, DUEL_ARENAS } from '../game/social/custom';
import { HOME_ARENA } from '../game/social/party';
import { sportPage } from '../game/ball/sportRules';
import { FIGHTER_SERIES, ROYALE_STAGES, SMALL_ROYALE_STAGES, STAGES, type StageId } from '../game/stages';
import type { FighterId } from '../game/types';
import { VOICE_CUES } from '../audio/voiceCues';
import { ORIGINALS } from './roster';
import { applyOriginalOutfits } from './outfits';
import { R6P_HOLD } from './shop/r6p';
import { R6B_HOLD } from './shop/r6b';
import { SAFE_STAGES } from './stages';
import { ORIGINAL_SCORE } from './score';
import VOICES from './voices.json';
import { HOME_VOICE_OF } from './homeVoices';

/** The match server this build was made for (Vite's VITE_MATCH_SERVER; nothing under node, where the packager and the
 *  tests import this module without Vite). */
const MATCH_SERVER: string | undefined = typeof import.meta.env === 'object' ? import.meta.env.VITE_MATCH_SERVER : undefined;

export const LAUNCH = {
  survival: 'open' as 'gate' | 'open',
  objectives: 'open' as 'gate' | 'open',
  online: !/\.invalid(?:[:/]|$)/i.test(MATCH_SERVER ?? ''),
  /** The stages team G lists as safe (assets/source/originals/round4/status/stages.md and its hook in src/originals/),
   *  besides the neutral and original ones below. */
  stages: [...SAFE_STAGES] as StageId[],
  hold: [...R6P_HOLD, ...R6B_HOLD] as FighterId[],
  riftWar: 'open' as 'gate' | 'open',
  /** The ball modes, Goal Rush and Sky Spike (src/game/ball), everything in them drawn in code: 'gate' hides both -
   *  their cards, sheets, the party's cards, the server's rooms; 'site' opens them everywhere but Player Two's copy of the
   *  build, where they are hidden as 'gate' hides them (the match server serves their rooms); 'open' opens them there too.
   *  They are open: both show on every build. Their online ways follow the page's rules as well (ballRoomsHere, below). */
  ballModes: 'open' as 'gate' | 'site' | 'open',
};

/** Whether this page is Player Two's copy of the build (the one its player frames; src/boot/playerTwo.ts): never under
 *  node (the match server, the tests). */
const onPlayerTwo = () => typeof location === 'object' && /(?:^|\.)playertwo\.(?:cc|lol)$/i.test(location.hostname);
/** Whether the ball modes show here (LAUNCH.ballModes). */
const ballModesHere = () => LAUNCH.ballModes === 'open' || LAUNCH.ballModes === 'site' && !onPlayerTwo();
const ballMode = (mode: string) => mode === 'goal-rush' || mode === 'sky-spike';
/** Whether a ball mode's rooms on the match server - ONLINE, FRIENDS, the party's card - are offered here. The room
 *  plays the classic rules only, and one card must not play two games, so a page on the sport rules
 *  (game/ball/sportRules.ts: the default; `?classic` for the classic rules) offers none. Under node (the match server:
 *  serverGate.ts) the rules are classic, so nothing there changes. */
const ballRoomsHere = (mode: string) => !ballMode(mode) || !sportPage();

/** The places that are the game's own or neutral: the harbour (RG Poly and AVATTA's kits), the Fallen Citadel (Bad
 *  Blood's courtyard, RG Poly and a CC BY keep) and the Rift's procedural arenas. */
export const NEUTRAL_STAGES: readonly StageId[] = ['harbor', 'blood-citadel', 'rift-village', 'rift-fortress',
  'rift-frost', 'rift-grove', 'rift-wastes', 'rift-harbor', 'ball-pitch', 'ball-court'];
/** Where a mode is fought when the place it would pick is not cleared. */
export const FALLBACK_STAGE: StageId = 'harbor';

// ---- Fighters ---------------------------------------------------------------------------------------------------

/** Every fighter the game knows (the simulation's table), in its order. */
export const ALL_FIGHTERS = Object.keys(MOVES) as FighterId[];

/** The fighter a voice cue belongs to, by its key (`vo-<id>-...` or `<id>-...`, the longest id that fits: wuming's
 *  cues are not Taisei's). */
export function cueFighter(cue: string, ids: readonly string[] = ALL_FIGHTERS): string | undefined {
  const key = cue.replace(/^vo-/, '');
  let best: string | undefined;
  for (const id of ids) if ((key === id || key.startsWith(`${id}-`)) && id.length > (best?.length ?? 0)) best = id;
  return best;
}

const routed = new Set(Object.keys(VOICES.cues));

export function unroutedVoices(id: FighterId): string[] {
  return Object.keys(VOICE_CUES).filter(cue => cueFighter(cue) === id && !routed.has(cue));
}

export const originalBody = (id: FighterId | string) => !!ORIGINALS[id as FighterId];

export const isOriginal = (id: FighterId | string) => !LAUNCH.hold.includes(id as FighterId) && !!ORIGINALS[id as FighterId]
  && unroutedVoices(id as FighterId).length === 0;

/** The fighters the gate lets through, in the game's order. */
export const SHOWN_FIGHTERS: ReadonlySet<FighterId> = new Set(ALL_FIGHTERS.filter(isOriginal));
/** The fighters it hides: every other one. */
export const GATED_FIGHTERS: readonly FighterId[] = ALL_FIGHTERS.filter(id => !SHOWN_FIGHTERS.has(id));
export const fighterShown = (id: FighterId | string | undefined): id is FighterId => !!id && SHOWN_FIGHTERS.has(id as FighterId);
/** A list of fighters as the gate lets it be shown or picked, in its own order. */
export const shownFighters = <T extends FighterId>(ids: readonly T[]): T[] => ids.filter(fighterShown);
/** The fighter to fall back on where a remembered or asked-for one is hidden: the first original of the roster. */
export const firstShown = (): FighterId => ALL_FIGHTERS.find(fighterShown) ?? 'taisei';
/** A remembered or asked-for fighter, or the first original where it is hidden. */
export const shownFighter = (id: FighterId | string | undefined): FighterId => fighterShown(id) ? id : firstShown();

export function itemShown(item: Pick<Item, 'id' | 'kind' | 'fighter'>): boolean {
  if (item.kind === 'fighter' || item.kind === 'outfit') return fighterShown(item.fighter) && !!ORIGINALS[item.fighter!]?.shop?.[item.id];
  return true;
}

export const RENAMED_ITEMS: Readonly<Record<string, string>> = { 'title-dark-choir': 'Hand of Heaven' };

function applyGate() {
  applyOriginalOutfits();
  for (const id of GATED_FIGHTERS) { (HELD as Set<FighterId>).add(id); (LOCKED as Map<FighterId, string>).delete(id); }
  for (const item of ITEMS) {
    if (itemShown(item)) {
      if (item.kind === 'fighter' || item.kind === 'outfit') Object.assign(item, ORIGINALS[item.fighter!]!.shop![item.id]);
      continue;
    }
    item.stage = 'ask';
    if (item.kind === 'fighter' && item.fighter) item.name = ORIGINALS[item.fighter]?.name ?? 'This fighter';
    if (item.kind === 'outfit') delete (OUTFITS as Record<string, unknown>)[item.id];
    if (item.kind === 'fighter' && fighterShown(item.fighter)) (LOCKED as Map<FighterId, string>).delete(item.fighter);
  }
  for (const [id, name] of Object.entries(RENAMED_ITEMS)) { const item = ITEMS.find(each => each.id === id); if (item) item.name = name; }
  // The road (economy/unlocks.ts ROAD: the shop's REWARDS page and the account's next goal list it by level) less what
  // the gate took off the shelves.
  const road = ROAD.filter(step => { const item = ITEMS.find(each => each.id === step.id); return !item || itemShown(item); });
  (ROAD as { level: number; id: string }[]).splice(0, ROAD.length, ...road);
}
applyGate();

// ---- Modes ------------------------------------------------------------------------------------------------------

/** The catalogue's modes (src/ui/modes/catalogue.ts ModeId) and ways to play (VariantId), as strings here so this module
 *  stays below the interface. */
type ModeKey = 'duel' | 'royale' | 'training' | 'arcade' | 'last-stand' | 'bad-blood' | 'rift-war' | 'goal-rush' | 'sky-spike';
type WayKey = 'offline' | 'online' | 'friends';
/** The place each objective mode is fought on (src/game/objectives: Last Stand's village, Bad Blood's citadel), and Rift
 *  War's map (src/game/moba/model.ts RIFT_STAGE: the Torn Plain). */
const MODE_STAGE: Partial<Record<ModeKey, StageId>> = { 'last-stand': 'ashwood', 'bad-blood': 'blood-citadel', 'rift-war': 'rift-war', 'goal-rush': 'ball-pitch', 'sky-spike': 'ball-court' };

export const stageSafe = (stage: StageId | string | undefined) => !!stage && (NEUTRAL_STAGES.includes(stage as StageId) || LAUNCH.stages.includes(stage as StageId));
/** The stage a match is fought on: the one asked for if it is cleared, else `fallback` (the harbour unless a mode asks
 *  for a smaller place: a Duel is fought in the citadel's courtyard). */
export const launchStage = (stage: StageId | undefined, fallback: StageId = FALLBACK_STAGE): StageId => stage && stageSafe(stage) ? stage : fallback;

/** src/game/stages.ts: the places a battle royale is dealt (ROYALE_STAGES, and SMALL_ROYALE_STAGES for a small field;
 *  LocalRoyale deals from them through RoyaleDeck) less those not cleared - the harbour, the royale's own place before
 *  round 4, where none is. */
function gateRoyaleStages() {
  const kept = ROYALE_STAGES.filter(stageSafe);
  (ROYALE_STAGES as StageId[]).splice(0, ROYALE_STAGES.length, ...(kept.length ? kept : [FALLBACK_STAGE]));
  for (const stage of Object.keys(SMALL_ROYALE_STAGES) as StageId[]) if (!stageSafe(stage)) delete SMALL_ROYALE_STAGES[stage];
}
gateRoyaleStages();

function gateSeries() {
  for (const id of ALL_FIGHTERS) { const own = ORIGINALS[id]; if (own) FIGHTER_SERIES[id] = own.series; }
}
gateSeries();

/** Whether a mode shows at all: Arcade Survival by team R's status (LAUNCH.survival); Last Stand and Bad Blood by team
 *  O's (LAUNCH.objectives), and each only once its own place is cleared (Last Stand's village); Rift War by LAUNCH.riftWar
 *  and its map; any other by its stage. */
export function modeOpen(mode: ModeKey | string): boolean {
  if (mode === 'rift-war' && LAUNCH.riftWar !== 'open') return false;
  if (ballMode(mode) && !ballModesHere()) return false;
  if (mode === 'arcade') return LAUNCH.survival === 'open';
  if ((mode === 'last-stand' || mode === 'bad-blood') && LAUNCH.objectives !== 'open') return false;
  const stage = MODE_STAGE[mode as ModeKey];
  return !stage || stageSafe(stage);
}
/** Whether any open mode fields the Rift's horde (src/survival ENEMIES, its bosses' portraits and voices): Arcade
 *  Survival, and Last Stand (src/game/objectives/siegeRoster.ts drafts its armies and bosses from ENEMIES). */
export const hordeOpen = () => modeOpen('arcade') || modeOpen('last-stand');
/** Whether any open mode fields the objective modes' own raiders (src/game/objectives/siegeEnemies.ts). */
export const raidersOpen = () => modeOpen('last-stand') || modeOpen('bad-blood');
/** Whether a way to play a mode shows: the mode's, and a match server's for any way not played on this device (and for
 *  a ball mode, rooms this page's rules may play: ballRoomsHere). */
export const wayOpen = (mode: ModeKey | string, way: WayKey | string, onDevice = way === 'offline') => modeOpen(mode) && (onDevice || LAUNCH.online && ballRoomsHere(mode));

/** The home screen's cards (src/ui/MangaHome.ts HomeMode), as the catalogue's modes and ways (catalogue.ts MODE_OF_HOME):
 *  BR vs Players and Private Room are the royale's ONLINE and FRIENDS, Battle Royale its BOTS. */
const HOME_CARD: Record<string, [ModeKey, WayKey?]> = {
  duel: ['duel'], players: ['royale', 'online'], bots: ['royale'], private: ['royale', 'friends'], training: ['training'],
  arcade: ['arcade'], 'last-stand': ['last-stand'], 'bad-blood': ['bad-blood'], 'rift-war': ['rift-war'],
  'goal-rush': ['goal-rush'], 'sky-spike': ['sky-spike'],
};
export function homeCardOpen(card: string): boolean {
  const [mode, way] = HOME_CARD[card] ?? [card];
  return way ? wayOpen(mode, way) : modeOpen(mode);
}

/** Where an offline Duel is fought when its tournament ring is not cleared: the Fallen Citadel's courtyard, a ring of a
 *  size for two (the harbour's spawn ring would put them seventy metres apart). */
export const DUEL_FALLBACK: StageId = 'blood-citadel';
/** src/game/duel/LocalDuel.ts DUEL_STAGE, through the gate (src/main.ts). */
export const duelStage = (stage: StageId) => launchStage(stage, DUEL_FALLBACK);

/** src/game/social/custom.ts and party.ts: the places a private room's and a party's pickers offer (ARENAS, DUEL_ARENAS,
 *  which party.ts PARTY_ARENAS shares) and a party's default (HOME_ARENA), each less what is not cleared - a royale's
 *  and a duel's keep their fallback place, so a picker always has one. In place: every importer reads the same arrays. */
function gateArenas() {
  const keep = (list: readonly StageId[], fallback?: StageId) => {
    const kept = list.filter(stageSafe);
    (list as StageId[]).splice(0, list.length, ...(kept.length || !fallback ? kept : [fallback]));
  };
  keep(ARENAS.royale, FALLBACK_STAGE); keep(ARENAS['bad-blood']); keep(ARENAS['last-stand']); keep(DUEL_ARENAS, DUEL_FALLBACK);
  for (const mode of Object.keys(HOME_ARENA) as (keyof typeof HOME_ARENA)[]) {
    const stage = HOME_ARENA[mode];
    if (stage && !stageSafe(stage)) HOME_ARENA[mode] = mode === 'duel' ? duelStage(stage) : FALLBACK_STAGE;
  }
}
gateArenas();

export function gateModes<M extends { kicker?: string; variants: Partial<Record<WayKey, { onDevice?: boolean }>> }>(modes: Readonly<Record<string, M>>) {
  for (const [mode, info] of Object.entries(modes)) for (const way of Object.keys(info.variants) as WayKey[])
    if (!wayOpen(mode, way, !!info.variants[way]?.onDevice) && modeOpen(mode)) delete info.variants[way];
  const duel = modes.duel;
  if (duel?.kicker && !stageSafe('sunfall-arena')) duel.kicker = `${STAGES[duelStage('sunfall-arena')].name.toUpperCase()} · 1 V 1`;
  return modes;
}

/** A party's mode (src/game/social/party.ts PARTY_ORDER: 'survival' is Arcade Survival's co-op) as the party may offer
 *  it: an open mode, with a match server to play it on. */
export const partyModeOpen = (mode: string) => LAUNCH.online && modeOpen(mode === 'survival' ? 'arcade' : mode) && ballRoomsHere(mode);

export function launchInvite<T extends { kind: string }>(invite: T | null): T | null {
  if (!invite || !LAUNCH.online) return null;
  return wayOpen(invite.kind === 'duel' ? 'duel' : invite.kind === 'coop' ? 'arcade' : 'royale', 'friends') ? invite : null;
}

// ---- Pages, art, music and voices -------------------------------------------------------------------------------

export const WITHHELD_PAGES = [/^\/?assets\/home\/upcoming\//, /^\/?assets\/home\/manga-home\.png$/, /^\/?assets\/home\/manga-faces\.webp$/];
export const pageShipped = (url: string) => !WITHHELD_PAGES.some(pattern => pattern.test(url.split(/[?#]/, 1)[0]));

export const NO_UPCOMING: { fighters: { assets: Record<string, string> }[] } = { fighters: [] };

/** src/ui/MangaHome.ts HOME_RAIL: the home cards of the modes the gate leaves open. */
export function gateHomeRail(cards: readonly string[]) {
  const kept = cards.filter(homeCardOpen);
  (cards as string[]).splice(0, cards.length, ...kept);
}

/** src/ui/MangaHome.ts: the roster's two volumes and the whole roster, each less the fighters the gate hides (in place:
 *  every importer reads the same arrays). */
export function gateHomeRoster(...lists: readonly (readonly FighterId[])[]) {
  for (const list of lists as FighterId[][]) {
    const kept = list.filter(fighterShown);
    list.splice(0, list.length, ...kept);
  }
}
export function gateHomeAssets(assets: string[]) {
  const kept = assets.filter(pageShipped);
  assets.splice(0, assets.length, ...kept);
}
export const HOME_VOICE_ASSETS: { assets: { fighter: FighterId; file: string; runtimeSha256?: string; durationSeconds?: number }[] } = {
  // (Round 6: a line carries its hash and length, so HomeVoice asks for `<file>?v=<hash>` and a re-recorded line is never served from a
  // returning player's cache; the finale is timed on the length. The table is keyed by the line's VOICE and its file named for it, never
  // for the fighter: the page's bundle holds no main character's name as text. HOME_VOICE_OF finds a slot's line.)
  assets: (Object.entries(HOME_VOICE_OF) as [FighterId, string][]).filter(([id]) => fighterShown(id))
    .flatMap(([fighter, voice]) => { const line = (VOICES.home as Record<string, { file: string; seconds?: number; runtimeSha256?: string } | undefined>)[voice];
      return line ? [{ fighter, file: line.file, ...(line.runtimeSha256 ? { runtimeSha256: line.runtimeSha256 } : {}), ...(line.seconds ? { durationSeconds: line.seconds } : {}) }] : []; }),
};
/** src/audio/HomeVoice.ts HOME_VOICES: the home-screen lines of shown fighters only. */
export function gateHomeVoices(voices: Partial<Record<string, string>>) {
  for (const id of Object.keys(voices)) if (!fighterShown(id)) delete voices[id];
}

/** An original piece of the score (public/assets/music/originals/, provenance in public/assets/music/originals.json). */
export const originalMusic = (url: string) => url.startsWith('/assets/music/originals/');
export function gateMusic<T extends { url: string; title: string; artist: string }>(tracks: Record<string, T>, battle: readonly T[] = []) {
  for (const [id, track] of Object.entries(tracks)) if (!originalMusic(track.url)) delete tracks[id];
  (battle as T[]).forEach((track, i) => {
    if (originalMusic(track.url)) return;
    const piece = ORIGINAL_SCORE[i % ORIGINAL_SCORE.length];
    (battle as T[])[i] = { ...track, url: piece.url, title: piece.title, artist: piece.artist };
  });
  return tracks;
}

// ---- Per-fighter manifests --------------------------------------------------------------------------------------

/** The fighter a manifest entry is about: its `id` in a `fighters` list (public/assets/home/sprites/manifest.json), its
 *  `fighter` in an `assets` list (public/assets/audio/home/manifest.json). */
const entryFighter = (entry: unknown, key: 'id' | 'fighter') =>
  entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>)[key] === 'string' ? (entry as Record<string, string>)[key] : undefined;

export function gateFighterManifest<T>(manifest: T): T {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  const source = manifest as Record<string, unknown>, out: Record<string, unknown> = { ...source };
  let changed = false;
  const keep = (list: unknown, key: 'id' | 'fighter') => {
    if (!Array.isArray(list)) return list;
    const kept = list.filter(entry => { const id = entryFighter(entry, key); return id === undefined || fighterShown(id); });
    if (kept.length !== list.length) changed = true;
    return kept;
  };
  if (Array.isArray(source.fighters)) out.fighters = keep(source.fighters, 'id');
  else if (source.fighters && typeof source.fighters === 'object') {
    const map = source.fighters as Record<string, unknown>, kept = Object.fromEntries(Object.entries(map).filter(([id]) => fighterShown(id)));
    if (Object.keys(kept).length !== Object.keys(map).length) { out.fighters = kept; changed = true; }
  }
  if (Array.isArray(source.assets)) out.assets = keep(source.assets, 'fighter');
  return (changed ? out : manifest) as T;
}
