import type { ModeId, VariantId } from './catalogue';
import { MODES } from './catalogue';
import { namedPlace, placeForStart, type StageChoice } from '../../game/stageChoice';
import type { StageId } from '../../game/stages';
import { isReleasedFighter } from '../../game/rosterAvailability';

/**
 * Round 5 (UX): what this device remembers about the modes. Each value lives under its own key, and a browser that
 * refuses storage (private mode) simply forgets between visits.
 *   rift-modes-seen   { mode: rulesVersion }   the first-time explainer has been read (or skipped)
 *   rift-mode-prefs   { mode: { variant, ...options } }   the sheet opens where the player left it (the options: the
 *                     royale's fighters and room size, the rival, and the LOCATION - `stage`, 'random' until one is named)
 *   rift-coach        { mode: [tip ids] } and { off: true }   coach tips shown, or switched off in Settings
 *   rift-training-dummy  'passive' | 'combat'   the sparring dummy's behaviour; passive until the player changes it
 *   rift-ball-hints   [hint ids]   the ball modes' first-time hints shown (ui/ball/ballHints.ts; each once per device)
 */
const read = <T>(key: string, fallback: T): T => { try { const raw = globalThis.localStorage?.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* The session keeps it. */ } };

export const SEEN_KEY = 'rift-modes-seen', PREFS_KEY = 'rift-mode-prefs', COACH_KEY = 'rift-coach', DUMMY_KEY = 'rift-training-dummy', BALL_HINTS_KEY = 'rift-ball-hints';

/** The mode's explainer has been seen at its current rules version. */
export function explainerSeen(mode: ModeId) { return (read<Record<string, number>>(SEEN_KEY, {})[mode] ?? 0) >= MODES[mode].rulesVersion; }
export function markExplainerSeen(mode: ModeId) { const seen = read<Record<string, number>>(SEEN_KEY, {}); seen[mode] = MODES[mode].rulesVersion; write(SEEN_KEY, seen); }

export interface ModePrefs { variant?: VariantId; fighters?: number; roomSize?: number; lone?: boolean; /** The ball modes: RUMBLE's charms on (ui: the RULES row), and FREE PLAY instead of a match (the PLAY row, bots only). */ rumble?: boolean; practice?: boolean; /** A mutator for BOTS, COUCH and FRIENDS (game/ball/mutators.ts; RUMBLE and a mutator are one choice), ONLINE's queue, and the PLAY row's DRILLS with the drill chosen. */ mutator?: import('../../game/ball/mutators').BallMutator | null; queue?: 'classic' | 'playlist' | 'ranked'; drills?: boolean; drill?: import('../../game/ball/drills').DrillId; /** The arena picked on the ARENA row (game/ball/arenas.ts id), or none for each in turn. */ arena?: string; /** The BOTS row's level for a match against bots (game/ball/BallBrain.ts BOT_LEVELS), BOTS and COUCH; none: NORMAL. */ difficulty?: import('../../game/ball/BallBrain').BotLevel; rival?: import('../../game/types').FighterId; /** Couch: Player 2's fighter (or RANDOM, ui/modes/partnerPick.ts), and whether the two seats were swapped (couch/couch.ts plannedSeats). */ partner?: import('../../game/types').FighterId | 'random'; couchSwap?: boolean; /** Couch: how the screen is shared (couch/split.ts), and in Bad Blood and the Rift which side Player 2 stands on. */ couchScreen?: import('../../network').CouchScreen; couchSides?: 'same' | 'rivals'; /** The LOCATION chosen on the sheet; absent or 'random': random. One value per mode, whichever way (bots, friends) it was chosen on. */ stage?: StageChoice }
/** A mode's remembered options. A rival or Player 2 that is not a released fighter is left out: this device's storage
 *  can hold another build's (Player Two restores a game's saved data for each player), and a rival no released fighter
 *  answers would stop every bot duel from starting. */
export function modePrefs(mode: ModeId): ModePrefs {
  const kept = read<Record<string, ModePrefs>>(PREFS_KEY, {})?.[mode];
  if (!kept || typeof kept !== 'object') return {};
  const prefs = { ...kept };
  if (prefs.rival !== undefined && !isReleasedFighter(prefs.rival)) delete prefs.rival;
  if (prefs.partner !== undefined && prefs.partner !== 'random' && !isReleasedFighter(prefs.partner)) delete prefs.partner;
  return prefs;
}
export function saveModePrefs(mode: ModeId, prefs: ModePrefs) { const all = read<Record<string, ModePrefs>>(PREFS_KEY, {}); all[mode] = { ...all[mode], ...prefs }; write(PREFS_KEY, all); }
/** The place the player named for this mode's way (bots or friends), or undefined for RANDOM - always undefined for the
 *  online way, whatever was remembered (game/stageChoice.ts). */
export function namedPlaceFor(mode: ModeId, way: VariantId, field?: number): StageId | undefined { return namedPlace(modePrefs(mode).stage, mode, way, field); }
/** Training's place, when local training starts: the one named on its sheet, else one dealt (RANDOM). Undefined keeps the
 *  Proving Hall, as the match server's training room always does (and a browser driven by a tool does). */
export function trainingPlace(): StageId | undefined { return placeForStart(namedPlaceFor('training', 'offline'), 'training', 'offline'); }
/** The Training dummy's fighter chosen on the mode sheet, or none for a random one (network.ts checks it is a fighter). */
export function trainingRival(): string | undefined { const rival = modePrefs('training').rival; return typeof rival === 'string' && rival ? rival : undefined; }

type CoachStore = Record<string, string[]> & { off?: boolean };
export function coachOn() { return !read<CoachStore>(COACH_KEY, {}).off; }
export function setCoachOn(on: boolean) { const store = read<CoachStore>(COACH_KEY, {}); if (on) delete store.off; else store.off = true; write(COACH_KEY, store); }
/** Tips this mode has already given (each is shown once, ever). */
export function coachShown(mode: ModeId): readonly string[] { const list = read<CoachStore>(COACH_KEY, {})[mode]; return Array.isArray(list) ? list : []; }
export function markCoachShown(mode: ModeId, tip: string) { const store = read<CoachStore>(COACH_KEY, {}); const list = Array.isArray(store[mode]) ? store[mode] as string[] : []; if (!list.includes(tip)) store[mode] = [...list, tip]; write(COACH_KEY, store); }

/** The ball modes' first-time hints this device has shown (ui/ball/ballHints.ts): each once, ever; Settings → Coach tips
 *  turns them off with the coach's. */
export function ballHintsShown(): readonly string[] { const list = read<unknown>(BALL_HINTS_KEY, []); return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []; }
export function markBallHint(id: string) { const list = [...ballHintsShown()]; if (!list.includes(id)) write(BALL_HINTS_KEY, [...list, id]); }

/** The training dummy: passive until the player chooses otherwise (the [1] DUMMY toggle, WP2), then remembered. */
export type DummyMode = 'passive' | 'combat';
export function trainingDummy(): DummyMode { return read<string>(DUMMY_KEY, 'passive') === 'combat' ? 'combat' : 'passive'; }
export function setTrainingDummy(mode: DummyMode) { write(DUMMY_KEY, mode); }
