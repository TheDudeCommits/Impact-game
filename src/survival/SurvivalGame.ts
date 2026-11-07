import { ArenaSimulation, type CombatMods } from '../game/simulation';
import { MAX_HP, type MoveDefinition } from '../game/moves';
import { STAGES, type StageId } from '../game/stages';
import type { AttackSlot, CollisionWorld, CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState, Vec3 } from '../game/types';
import { enemy, kitOf, type EnemyDefinition, type EnemyMove, type Rain } from './enemies';
import { EnemyBrain, TokenPool, type BrainWorld } from './brains';
import { StyleMeter, RANKS as STYLE_RANKS } from './style';
import { lens } from './lens';
import { runStats, offer, upgrade, burnAt, BASE_STATS, UPGRADES, type RunStats } from './upgrades';
import { botPick, lockOf, refundLock } from './skillTree';
import { Horde, GS, GF, type HordeHero, type HordeWorld } from './horde/Horde';
import { GRUNTS, GRUNT_INDEX } from './horde/kinds';
import { armyFor, bossEntry, doubleBoss, drawBoss, loopOf, rankFor, BOSSES, RANKS, RANK_DAMAGE, RANK_HORDE, RANK_HP, RESTING, ESCORTS, type BossEntry, type Escort, type EscortId, type Rank } from './bosses';
import { locationFor, dungeonFor, FINAL_ROUND } from './locations';
import { riftWorld } from './riftWorld';
import { riftLayout, type RiftPropKind } from '../game/riftLayouts';
import { moveFor } from '../game/awakening';
import { Signatures, awakeningOf, FORMS_OF_THEIR_OWN, type SigBoss, type SigHero } from './signatures';
import { PATHS, PATH_RULES, PATH_SECONDS, PATH_REACH, TIMED_PATHS, drawPaths, type PathKind } from './paths';
import { RELIC_LEAVE, RELIC_SLOTS, RELICS, giveCard, givenOf, relicOf, relicScale } from './relics';
import { PlaceRules } from './placeRules';
import { depthMods, MAX_DEPTH, type DepthMods } from './depth';

export const PLAYER_ID = 'you';
export const HERO = 'hero';
export const RIFT = 'rift';
export const MAX_PARTY = 4;
/** The most skill points a fighter's mastery starts a run with (progress.ts MASTERY_REWARDS gives two). */
const MAX_BONUS_POINTS = 2;
/** Momentum's steps: one every ten hits of a combo. */
const MOMENTUM_STEPS = 5;
const DT = 1 / 60;
/** Arena actors: the party, the round's bosses, champions and rivals. */
const CAPACITY = 24;
/** A fallen ally is helped up by standing over them this long, and from this close. */
export const RESCUE_SECONDS = 3;
export const RESCUE_REACH = 2.4;
/** Lifesteal and healing on kills are paid out at most this share of maximum
 *  health a second. Both scale with how much a fighter hits and kills, and
 *  arts hit dozens at a time: uncapped, a build out-healed anything the rift
 *  could throw at it, which is no last stand at all. */
const LEECH_RATE = .05;
/** A fighter's own partner is never their boss. */
const PARTNERS: Partial<Record<string, readonly string[]>> = { konta: ['kurobi'] };
/** ...and less of it the higher the rank, as the round's closing heal and the
 *  orbs are rationed too: a built fighter's lifesteal and kill-heals poured
 *  back 5% of their health a second through everything, and S-rank finales
 *  were fought at full health ("no danger at any rank"). */
/** (Loosened when the arts went: they did most of the hitting a build's
 *  lifesteal and kill-heals were paid from, and without them the headless
 *  fighter bled out at D against rations cut for a build that fed itself.) */
const LEECH_BY_RANK: Record<Rank, number> = { F: 1, E: 1, D: 1, C: 1, B: .95, A: .85, S: .72 };
/** A round's closing heal, by rank. */
const ROUND_HEAL: Record<Rank, number> = { F: .35, E: .35, D: .35, C: .32, B: .3, A: .26, S: .2 };
/** Seconds between health orbs at least, by rank: dropped per kill, a crowd
 *  dying ten a second at S rained them. (None below C: a new fighter's kills
 *  come in bursts, and rationed there, the E rounds killed.) */
const HEAL_GAP: Record<Rank, number> = { F: 0, E: 0, D: 0, C: 1.5, B: 2, A: 3, S: 4 };
const HOLD_MAX = .24, HOLD_REFILL = .45;
/** The spirit blades that circled a fighter are gone with the arts; the view keeps its field for the client. */
const NO_BLADES: readonly Vec3[] = [];
/** A special's techniques (KI): how often each may go off for one fighter. */
const KI_GAP = { burst: .12, blaze: .55, storm: .4, vortex: .7 } as const;
/** A boss's flash-steps come this much sooner than its definition's clock: it
 *  closes on a fighter who runs rather than walking after them. */
const BLINK_PACE = .65;
/** The rift tears open, then the boss steps out of it. */
const RIFT_OPENS = 1.5;
/** A boss holds its entrance pose - the card, the roar - before it moves. */
const ENTRANCE_HOLD = 2.2;
/** The boss has the stage to itself this long before its army comes through. */
const ESCORT_DELAY = 1.5;
/** The breath between a boss's fall and the next rift. */
const INTERLUDE = 5.5;
/** An elite pack's grunts over the horde's: how near another pack must stand
 *  to be roused with it, their health, blows and experience. */
const PACK_CHAIN = 12;
const PACK_HP = 2.2, PACK_DAMAGE = 1.55;
const PACK_XP = 3;
/** A dungeon's rift: the kills (by each grunt's worth, `cost`) that fill its
 *  bar and bring its guardian - more as the road goes on, since a grown build
 *  kills faster (about a minute of horde at every rank). */
export const riftNeed = (round: number) => Math.round(120 + round * 40 + round * round * 2.5);
/** A dungeon's horde lasts this long at most: then its guardian comes anyway
 *  (a party that cannot cut the bar full is not held there for ever). */
const hordeLimit = (round: number) => 100 + round * 4;
/** Where on the bar an elite pack comes, by rank (none in the first dungeon). */
const ELITES_AT: Record<Rank, readonly number[]> = { F: [.55], E: [.3, .7], D: [.3, .7], C: [.25, .55, .8], B: [.25, .55, .8], A: [.2, .45, .7, .85], S: [.2, .45, .7, .85] };
/** A fighter in the tree holds a party's run this long at most. */
export const TREE_SECONDS = 60;
/** An elite pack's affix, as Diablo's champions have them: a MOLTEN leader
 *  erupts where it falls; a STORMCALLER and a FROSTCALLER bring their element
 *  down round the fighter they fight, ringed a second ahead; a HASTED pack
 *  comes faster. (Their order is the affix's number on the wire.) */
export const AFFIXES = ['molten', 'storm', 'frost', 'hasted'] as const;
export type Affix = (typeof AFFIXES)[number];
export const AFFIX_NAMES: Record<Affix, string> = { molten: 'MOLTEN', storm: 'STORMCALLER', frost: 'FROSTCALLER', hasted: 'HASTED' };
const AFFIX_ELEMENT: Record<Affix, string> = { molten: 'fire', storm: 'lightning', frost: 'ice', hasted: 'steel' };
/** A boss's second wind by rank (see `wrath`): from C, its element falls round
 *  the fighter - more, faster and wider as the rank climbs. After the roar. */
const WRATH: Partial<Record<Rank, Rain>> = {
  C: { count: 8, every: .55, lead: 1.1, spread: 5, radius: 1.8, damage: 30, start: 1.2, knockback: 6 },
  B: { count: 10, every: .48, lead: 1.1, spread: 5.5, radius: 1.9, damage: 34, start: 1.2, knockback: 7 },
  A: { count: 14, every: .42, lead: 1.05, spread: 6, radius: 2, damage: 38, start: 1.2, knockback: 7 },
  S: { count: 16, every: .38, lead: 1.05, spread: 6, radius: 2, damage: 40, start: 1.2, knockback: 8 },
};
const LAST_STAND_RAIN: Rain = { count: 22, every: .3, lead: 1, spread: 6.5, radius: 2.1, damage: 42, start: 1.3, knockback: 8 };
/** What an S boss takes of each blow while it roars its last stand. */
const LAST_STAND_ARMOUR = .33;
/** The horde's blows by rank, on top of the round's climb. */
/** (Raised from E up with the hunts: fewer grunts at a time, and a growing
 *  build, and the headless fighter never fell under 60% after rank F. Lowered
 *  again when the arts went: nothing cuts the crowd down but the fighter now,
 *  and the headless one fell at F and E to the ring's blows.) */
const GRUNT_RANK_DAMAGE: Record<Rank, number> = { F: .52, E: .65, D: .84, C: .9, B: 1.02, A: 1.18, S: 1.45 };
/** The breath a party gets as a dungeon's guardian comes, by rank: a minute
 *  of its horde, then its master, and a new fighter came to it half dead. */
const GUARDIAN_HEAL: Record<Rank, number> = { F: .3, E: .26, D: .22, C: .2, B: .17, A: .14, S: .1 };
/** And their bodies by rank: at A and S a built fighter's arts cut the fodder
 *  down faster than the rifts could send it (18 a second, a thin field, the
 *  fighter at full health through the climax). Tougher, they stood long enough
 *  to fill the field and press in. With the arts gone the fighter's own blows
 *  are all that kill them: softer early, and less hard at the top. */
/** What the style meter's gains are worth by rank (see StyleMeter.worth). */
const STYLE_WORTH: Record<Rank, number> = { F: .6, E: .7, D: .8, C: .9, B: 1, A: 1.15, S: 1.3 };
const GRUNT_RANK_HP: Record<Rank, number> = { F: .46, E: .48, D: .5, C: .52, B: .55, A: .6, S: .72 };
/** How often a grunt's death drops health, by rank: the top of the road has
 *  a crowd dying ten a second, and at the old rate that healed faster than
 *  S could hurt (a levelled fighter never fell under 79% there). */
const HEAL_DROP: Record<Rank, number> = { F: .045, E: .045, D: .044, C: .04, B: .036, A: .03, S: .024 };
/** A level's moment before its draft: the light going up, time slowing. */
const LEVEL_BEAT = .55;
/** The ending's breath before the Rift takes the run back, on top of the interlude. */
const FINALE_HOLD = 4.5;
const FINISH_WINDOW = 5.5;
/** What a boss held at the brink is kept at: its blows chip one point each
 *  (what it takes of anything is BRINK_SKIN of it). */
const BRINK_HP = 400, BRINK_SKIN = 1e-6;
/** Two fighters' ultimates on one boss this close together are a team ultimate. */
const TEAM_WINDOW = 1.1;
/** How long a kill stays in the view for the kill effects (a co-op client hears the room a few times a second), and how many at most. */
const SLAIN_WINDOW = .5, SLAIN_MAX = 48;

export type SurvivalPhase = 'lobby' | 'intro' | 'fight' | 'draft' | 'travel' | 'over';
export type RoundState = 'horde' | 'entrance' | 'battle' | 'interlude';
export type EventKind = 'surge' | 'siege' | 'eclipse' | 'storm' | 'elites' | 'hoarder';

export interface Orb { id: number; kind: 'xp' | 'heal' | 'meter' | 'magnet' | 'bomb' | 'chest'; value: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; born: number; pulled: boolean;
  /** Who it is flying to, once pulled. */
  to?: string }
export type FeedKind = 'location' | 'round' | 'rift' | 'boss' | 'enraged' | 'down' | 'event' | 'event-end' | 'level' | 'pickup' | 'spawn'
  /** A fighter's emote (`hero`; `value` its place in the economy's catalogue): lettered over them on every screen. */
  | 'emote'
  | 'shockwave' | 'crescent' | 'rend' | 'echo' | 'chain' | 'burst' | 'will' | 'revive' | 'bonus' | 'break' | 'rout' | 'counter' | 'meter' | 'hazard' | 'blink'
  | 'chest' | 'bomb' | 'magnet' | 'learn'
  /** A dungeon's horde begins (`value` the kills its bar wants), an elite
   *  pack is slain, and the guardian comes. */
  | 'hunt' | 'pack' | 'lair'
  /** An elite pack roused: `text` its affix's name. */
  | 'elite'
  /** The KI techniques' strikes, drawn as the arts once were: bolts from the
   *  sky (Storm Ki), a vortex (Ki Vortex), fire from the ground (Blazing Ki), a
   *  cut through space (Cinder Step); `meteor` and `frost` are no longer thrown;
   *  and the HOUND ARMOR taking over (`value` 1) or letting go (0). */
  | 'smite' | 'whirl' | 'pillar' | 'meteor' | 'frost' | 'slash' | 'rage'
  /** The last S-rank boss has fallen: the rift is sealed - for now. */
  | 'finale'
  /** A piece of the stage smashed: `value` is its tag in the stage's layout
   *  (riftLayouts.ts), which the renderer folds away. */
  | 'smash'
  /** Co-op: a fighter down, a fighter helped up, a fighter back for the next round. */
  | 'fallen' | 'rescued' | 'regroup'
  /** A boss's signature (signatures.ts): its name called out, and what it
   *  puts on the field - ground that burns (`until` it fades), a line torn
   *  (`points`), a ring rolling out, a charge (`value` when it lands) and its
   *  end (`value` 1 broken, 0 let go), Mirabel's homies, an aura, a black
   *  hole, an iron body, an illusion shattering. */
  | 'signature' | 'pool' | 'fissure' | 'wave' | 'charge' | 'charge-end' | 'orbit' | 'aura' | 'pull' | 'iron' | 'shatter'
  /** A boss held at the brink - FINISH IT (`value` when the window closes) -
   *  and the finisher that ends it (`value` 2 when two fighters' ultimates
   *  did); two fighters' ultimates landing on one boss together. */
  | 'finish' | 'finisher' | 'team'
  | 'paths' | 'path'
  /** The nodes bought with shards: Momentum a step higher (`value` 1-5), Second Wind catching a fall. */
  | 'momentum' | 'second-wind'
  /** A boss's relic (relics.ts): left where it fell (`sub` 'taken' into a slot, 'waiting' on a choice;
   *  `text` its id, `value` when it is shown), and one going off (`sub` its beat: 'howl', 'claws', 'nightfang',
   *  'iron-shock', 'foresight', 'mochi', 'frost', 'quake', 'stop', 'shrine', 'cut'; `text` its id). */
  | 'relic'
  /** Co-op drop-in: a fighter joined and waits in a rift (`value` 0), and comes out (1). */
  | 'challenger';
/** One thing that happened, for the HUD and the effects: shown once each, in id order.
 *  A `hazard` is a strike falling from the sky: `value` is when it lands,
 *  `text` its element. A `blink` is a body gone from `points[0]` to `points[1]`.
 *  A `boss` item is an entrance: `rank`, `sub` (the epithet) and `universe`
 *  are for its card. `hero` names the fighter an item belongs to. */
export interface FeedItem { id: number; at: number; kind: FeedKind; text?: string; sub?: string; enemy?: string; value?: number;
  x?: number; y?: number; z?: number; radius?: number; points?: Vec3[]; boss?: boolean; hero?: string; rank?: Rank; universe?: string; actor?: string;
  /** When what it put down is gone (a pool, a wave's last reach). */
  until?: number;
  /** A signature's element, for how it is drawn and heard. */
  element?: string }

export interface RunResult {
  fighter: FighterId;
  /** The round reached, and (for the records) the same as `wave`. */
  round: number; wave: number; rank: Rank; act: number;
  score: number; kills: number; seconds: number; level: number;
  bestRank: number; bestCombo: number; damageDealt: number; damageTaken: number; bosses: number; picks: string[];
  /** The run beat rank S and sealed the rift before the Rift took it back. */
  sealed?: boolean;
  /** It ended there, by choice: banked at the seal rather than fallen. */
  victory?: boolean;
  /** Co-op: how many fought, and this fighter's own knockouts. */
  party?: number; ownKills?: number;
  /** Bosses this fighter finished, and ultimates landed with a friend's. */
  finishers?: number; teamUltimates?: number;
  /** What this fighter's damage came from (the run summary). */
  dealtBy?: DealtBy;
  /** Every boss the run beat, in order: whether it was finished, and how long it took. */
  bossLog?: { id: string; name: string; rank: Rank; finished: boolean; seconds: number }[];
  /** The places the run fought in (LocationDefinition ids), charges this fighter broke,
   *  bosses beaten without this fighter taking a blow, cursed rounds cleared, how deep it went. */
  places?: string[]; breaks?: number; flawless?: number; cursed?: number; loop?: number;
  /** A probe's run (a fighter who barely feels a blow, weakened bosses, a start further in): it earns no progress. */
  probe?: boolean;
  /** The boss relics this fighter held at the end (relics.ts). */
  relics?: string[];
  /** The Rift Depth it was fought at (depth.ts), when below the surface. */
  depth?: number;
}
/** A fighter's damage by where it came from. */
export interface DealtBy { blows: number; specials: number; ultimates: number; techniques: number; team: number }

/** A fighter in the run, as the party panel shows them. */
export interface PartyMember { id: string; name: string; fighter: FighterId; hp: number; maxHp: number; down: boolean; rescue: number; picks: number;
  /** What they wear on the body (economy/catalog.ts wornOf reads it). */
  look?: readonly number[];
  /** HOUND ARMOR has them. */
  rage?: boolean;
  /** Awakened: on the inked page the Rift's colour comes back while they are (render/rift/ink.ts). */
  awake?: boolean;
  /** Their place in the party in the order it came together, the same for every
   *  fighter in it: what colour their frame, marker and map arrow are. */
  seat?: number;
  /** Dropped in mid-round: waiting in a rift for the round's end. */
  joining?: boolean;
  /** Their knockouts this run, and their style's rank (0 D - 6 SSS): what reactive items grow with. */
  kills?: number; style?: number }

/** A boss or champion standing, with its own bar. */
export interface BossView { id: string; enemy: string; name: string; title?: string; rank?: Rank; universe?: string; hp: number; maxHp: number; poise?: number; phase: number; champion: boolean;
  /** Where it stands, for the map. */
  x?: number; z?: number;
  /** Its awakened form's name, once it has awakened. */
  form?: string;
  /** How far a charge it is gathering has been broken (0-1), while it gathers. */
  charge?: number;
  /** Held at the brink: seconds left to finish it. */
  brink?: number;
  /** One of Shiun's copies: drawn and marked as the boss, with no bar. */
  illusion?: boolean }
/** A pack of the round's hunt, as the map shows it. */
export interface PackView { x: number; z: number; left: number; size: number; elite: boolean; awake: boolean;
  /** An elite pack's affix (AFFIXES' order, from 1). */
  affix?: number }
export interface SurvivalView {
  phase: SurvivalPhase; phaseLeft: number; time: number;
  round: number; roundState: RoundState; rank: Rank; loop: number;
  /** The round being arrived at, while the run travels or its intro plays (`round` is the one before it). */
  coming?: number;
  /** Sealed, and its question not yet answered: the run stands still. */
  held?: boolean;
  /** Kept for the records and the co-op wire: the round. */
  wave: number;
  location: { index: number; name: string; subtitle: string; kanji: string; loop: number; stage: StageId;
    /** How far into its stay the run is here: 0 on arrival, 1 on its last round. */
    progress?: number };
  score: number; kills: number; level: number; xp: number; xpNext: number; pending: number;
  style: { rank: number; letter: string; word: string; fill: number; multiplier: number; best: number };
  bosses: BossView[];
  event?: { kind: EventKind; name: string; left: number; total: number };
  /** 0-1: how far the blood eclipse has the sky. */
  eclipse: number;
  horde: number;
  /** Boss models the client should have ready (see SurvivalGame.upcoming). */
  upcoming: string[];
  draft?: { cards: string[]; legendary: boolean; finale?: boolean; relic?: string };
  /** Boss relics this fighter holds (relics.ts), and how ready each is to go off again (0-1). */
  relics?: string[]; relicCharge?: number[];
  /** Stopped time (HUSH): seconds of it left. */
  stopped?: number;
  /** The horde and the champions cut down in the last half-second, and by whom, for the kill
   *  effects the party wears (economy/catalog.ts, render/cosmetics/kills.ts): four numbers each -
   *  a serial, the killer's seat in the party (+8 for an elite or a champion), and where it fell
   *  (x, z, in tenths of a metre). */
  slain?: number[];
  /** The Ashen Wastes' vents (placeRules.ts), while the round is fought there. */
  vents?: { x: number; z: number }[];
  /** The Rift Depth the run is fought at (depth.ts), when below the surface. */
  depth?: number;
  /** THE WARD's round (paths.ts): the circle to hold, and whether anyone stands in it. */
  ward?: { x: number; z: number; radius: number; held: boolean };
  /** New hands of cards this fighter may still draw. */
  rerolls: number;
  orbs: readonly Orb[]; blades: readonly Vec3[]; feed: readonly FeedItem[]; picks: readonly string[];
  /** Skill points waiting, and whether this fighter has the tree open. */
  points: number; treeOpen: boolean;
  result?: RunResult; stats: RunStats; timeScale: number;
  /** Everyone in the run, this fighter first. */
  party: PartyMember[];
  /** Where each of them stands and faces, in the party's order (the map). */
  spots: { x: number; z: number; yaw: number }[];
  /** The dungeon: how full the rift's bar is (0-1; the guardian comes at 1)
   *  while its horde is fought, and its elite packs still standing (the map). */
  dungeon?: { progress?: number; elites: PackView[] };
  /** The stage the next dungeon is on (the client builds it ahead). */
  next?: StageId;
  /** Co-op: who has the skill tree open (the run waits for all of them). */
  upgrading?: string[];
  /** The floor's half-size, for the map. */
  bounds: { halfX: number; halfZ: number };
  /** The universe of the round's boss - the one on its way, before it comes:
   *  the score follows it (musicTracks.riftMoment). */
  guardian?: string;
  forks?: { kind: PathKind; x: number; z: number; votes: number }[];
  forkLeft?: number;
  path?: PathKind; pathNext?: PathKind;
  /** Co-op: fighters still choosing a card. */
  choosing?: number; draftEnds?: number;
}

/** What the HUD and the effects draw a run from: a solo run's own view, or a
 *  co-op frame's (whose orbs travel without their physics), with what only a
 *  co-op room adds. */
export type RunView = Omit<SurvivalView, 'orbs'> & { orbs: readonly Pick<Orb, 'id' | 'kind' | 'value' | 'x' | 'y' | 'z' | 'pulled'>[] }
  & Partial<{ run: number; host: boolean; draftLeft: number; treeLeft: number; loading: number }>;

interface EnemyRecord { id: string; def: EnemyDefinition; brain: EnemyBrain; boss: boolean; champion: boolean; rank?: Rank; entry?: BossEntry;
  diedAt?: number; burn?: { until: number; dps: number; next: number; by: string }; bladeHit?: number; executed?: boolean; nextBlink?: number; transformed?: boolean;
  anchor?: { x: number; z: number; at: number }; sidestep?: { x: number; z: number; until: number };
  target?: string; retargetAt?: number; lastHitBy?: string;
  /** An S boss's last stand: while it roars it takes a third of the damage. */
  armouredUntil?: number;
  /** Awakened (signatures.ts AWAKENINGS), and when. */
  awakened?: boolean;
  /** One of a boss's copies (Shiun's): whose, and until when. */
  illusion?: { of: string; until: number };
  /** Held at the brink of death, FINISH IT: until when; whose ultimate is
   *  finishing it (and whose joined in); done once it has fallen. */
  brink?: { until: number; executing?: { hero: string; until: number; with: Set<string> }; done?: boolean };
  /** The last fighter's blow on it: its slot, its contact and when (an ultimate that fells a boss is its finisher). */
  lastBlow?: { slot: AttackSlot; contact: number; at: number };
  /** Its damage taken or dealt multiplied until a moment (the awakening's
   *  entry, a broken charge), put back when it passes. */
  temp?: { until: number; key: 'damageIn' | 'damageOut'; factor: number }[] }
interface Raining { source: string; enemy: string; move: EnemyMove; rain: Rain; left: number; next: number }
interface Strike { source: string; enemy: string; at: Vec3; lands: number; radius: number; move: MoveDefinition;
  /** An elite's own storm: its pack is not struck by it. */
  spare?: boolean }
interface RunningEvent { kind: EventKind; until: number; total: number; next: number; side: number; spawned: number }
/** Something an art or a strike leaves behind: burning ground. */
interface Zone { x: number; z: number; radius: number; until: number; next: number; damage: number; by: string;
  /** MAGMA FIST's (relics.ts): a fighter's own are counted. */
  magma?: boolean }
/** Scenery the fighting smashes: a cart, a crate, a grave (riftLayouts.ts). */
interface Breakable { tag: number; kind: RiftPropKind; x: number; z: number; r: number; hp: number }
/** How much of a beating each kind of prop takes. */
const PROP_HP: Partial<Record<RiftPropKind, number>> = { cart: 160, hay: 60, barrel: 50, crate: 70, fence: 90, grave: 110, sword: 40, cage: 140, bones: 30, rock: 200, corpse: 45 };
/** A body an art can strike: one of the horde (by slot) or an arena actor. */
interface Foe { id: string; slot?: number; x: number; y: number; z: number; d: number; height: number }

const EVENT_NAMES: Record<EventKind, string> = {
  surge: 'HORDE SURGE', siege: 'SIEGE', eclipse: 'BLOOD ECLIPSE', storm: 'RIFT STORM', elites: 'ELITE HUNT', hoarder: 'TREASURE HOARDER',
};
const EVENT_SUBS: Record<EventKind, string> = {
  surge: 'A WALL OF THEM, FROM ONE SIDE', siege: 'BRUTES AND ARCHERS AT THE LINE', eclipse: 'THE HORDE IS ENRAGED — DOUBLE EXPERIENCE',
  storm: 'THE SKY FALLS ON EVERYONE', elites: 'CHAMPIONS OF THE DARK — THEY CARRY TREASURE', hoarder: 'IT FLEES WITH THE LOOT — CATCH IT',
};

/** Everything one fighter carries through a run. */
export class Hero {
  readonly style = new StyleMeter();
  /** What they wear on the body (HeroSeat.look). */
  look?: readonly number[];
  picks: string[] = [];
  stats: RunStats = { ...BASE_STATS };
  /** Bosses' blows are still rationed per fighter (see TokenPool). */
  readonly tokens = new TokenPool({ melee: 7, shots: 4, brutes: 3 });
  revivesUsed = 0;
  reviveAt = -1;
  hits = 0; bestCombo = 0; kills = 0;
  /** Everything this fighter's blows and upgrades dealt (the sim counts only
   *  its own moves, not what its techniques add). */
  dealt = 0;
  lastSafe?: Vec3; last?: { x: number; z: number };
  velocity = { x: 0, z: 0 };
  pending = 0; pendingLegendary = 0;
  /** Skill points to spend in the tree (skillTree.ts): one a level, one a chest. */
  points = 0;
  /** Maximum health already granted by purchased ranks: refunds never farm healing. */
  healthGranted = 0;
  /** The nodes this fighter's player has bought with shards (progress.ts), open in their tree. */
  unlocked: readonly string[] = [];
  /** Second Wind: the round it last caught this fighter. */
  windRound = -1;
  /** Co-op drop-in: in the run, but held in a rift beside the party - untouchable,
   *  still, watching - until the round's boss falls (SurvivalGame.dropIn). */
  joining = false;
  /** Momentum: the step of it the moment's mods hold. */
  momentum = 0;
  /** The tree is open (a solo run stands still while it is). */
  treeOpen = false;
  draft?: { cards: string[]; legendary: boolean; finale?: boolean; relic?: string };
  downAt = -1; rescue = 0;
  /** Boss relics held (relics.ts), in the order taken, and those left for
   *  them while their three slots were full, each waiting on a choice. */
  relics: string[] = [];
  relicsWaiting: string[] = [];
  /** When each relic last went off. */
  readonly relicAt = new Map<string, number>();
  /** FUTURE SIGHT: the next blow at them is seen coming. */
  foresight = false;
  /** 'IRON SHOCK': the dash watched for its end (its start, -1 none), and where it faces. */
  relicDash = -1; relicDashYaw = 0;
  /** 'MIRROR MERE': open until, and when it next cuts. */
  shrineUntil = 0; shrineNext = 0;
  /** AVALANCHE: the combo count it last tore at. */
  clawAt = 0;
  result?: RunResult;
  /** The combo count the last crescent was cut at (Flying Slash). */
  crescentAt = 0;
  /** When each KI technique last went off (KI_GAP), and the ultimate cast whose meter was given back. */
  kiAt = { burst: -1, blaze: -1, storm: -1, vortex: -1 };
  refundCast = -1;
  /** Overflow: the special cast whose meter was poured in. */
  overflowCast = -1;
  /** 'Cinder Step': the dash being cut through (its start), where it began, and who it has cut. */
  dash?: { started: number; from: Vec3; cut: Set<string> };
  /** The mods the build gives, before the moment adjusts them (a special, the awakening). */
  baseMods: Partial<CombatMods> = {};
  private modsKey = '';
  /** True when the mods the moment wants differ from what the arena holds. */
  modsChanged(key: string) { if (key === this.modsKey) return false; this.modsKey = key; return true; }
  /** HOUND ARMOR has them. */
  raging = false;
  /** Draws of a new hand of cards left: one to start, one more per boss. */
  rerolls = 1;
  /** Health owed by lifesteal and kills, paid out no faster than LEECH_RATE. */
  leech = 0;
  /** Bosses finished, and ultimates landed together with a friend's. */
  finishers = 0; teamUltimates = 0;
  /** Damage by source, charges broken, bosses beaten without a scratch (for the run's summary and challenges). */
  readonly dealtBy: DealtBy = { blows: 0, specials: 0, ultimates: 0, techniques: 0, team: 0 };
  breaks = 0; flawless = 0;
  /** The damage this fighter had taken when each standing boss came out. */
  readonly takenAt = new Map<string, number>();
  constructor(readonly id: string, readonly fighter: FighterId, readonly name: string) { this.tokens.gaps = { melee: .3, shots: .6, brutes: .8 }; }
  get down() { return this.downAt >= 0; }
}

export interface HeroSeat { id: string; fighter: FighterId; name?: string;
  /** What the player brings from their progress (progressStore.carried): nodes
   *  bought with shards, and the skill points their fighter's mastery starts them with. */
  unlocked?: readonly string[]; bonus?: number;
  /** What they wear on the body, as the catalogue's places (economy/catalog.ts lookOf): the party sees it. */
  look?: readonly number[];
  /** The shop's outfit they wear for their fighter (economy/outfits.ts): on their body, for every screen. */
  outfit?: string }
export interface SurvivalOptions { fighter?: FighterId; name?: string; seed?: number; collision?: CollisionWorld;
  /** The solo fighter's progress (HeroSeat's). */
  unlocked?: readonly string[]; bonus?: number;
  /** Start at this round (a probe; the stage is the round's). */
  round?: number; wave?: number; picks?: string[];
  heroes?: HeroSeat[]; lobby?: boolean;
  slowMotion?: boolean;
  /** Probes: a boss for the first round, the share of health bosses arrive with, a fighter that barely feels a blow, no horde. */
  spawn?: string[]; bossHp?: number; god?: boolean; quiet?: boolean;
  /** Bots: spend every skill point as it comes (skillTree.botPick). */
  autoLearn?: boolean;
  /** A probe's relics to start with (relics.ts ids). */
  relics?: string[];
  lockCombat?: boolean;
  /** A probe's door for its first round (paths.ts). */
  path?: PathKind;
  /** The Rift Depth the run is fought at (depth.ts): 0 the surface. */
  depth?: number;
  /** Off: every round opens straight on its boss with the field kept full,
   *  on the old road of places (probes and tests). */
  hunt?: boolean }

const PROC = new Set(['Shockwave', 'Flying Slash', 'Rending Cut', 'Afterimage', 'Thunder Chain', 'Chain Reaction', 'Counter Blast', 'Burn', 'Rout', 'Rising Will', 'Rift Bomb', 'Rift Strike',
  'Burning Ground', 'Shatter', 'Cinder Step', 'Burst Point', 'Storm Ki', 'Ultimate Echo', 'Awakening Nova', 'Team Ultimate', 'Finisher', 'Condemned',
  'Quake', 'Black Crescent', 'Long Winter', 'Molten Rake', 'Funeral Howl', 'Stilling Palm', 'Tar Thrust', 'Hex Slashes']);
export const isProc = (move?: string) => move !== undefined && PROC.has(move);
/** Blows whose victims make no sound or number of their own: a burn, a rout,
 *  and every art - an art is heard once, as itself, when it is thrown
 *  (audio/survival/RiftAudio), not as a hit on each of the thirty grunts it lands on. */
const QUIET = new Set(['Burn', 'Rout', 'Burning Ground', 'Shatter', 'Condemned']);
export const isQuiet = (move?: string) => move !== undefined && QUIET.has(move);
/** A blow thrown by the run rather than a move: a technique's, a hazard's, a
 *  burst's. No impact freeze on either body - these land many to a second,
 *  and their freezes were what held bosses and fighters in the air. */
const procMove = (name: string, damage: number, extra: Partial<MoveDefinition> = {}): MoveDefinition => ({
  name, duration: .1, contacts: [0], damage, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: .3, knockback: 4, style: 'melee', hitstop: 0, ...extra });

/** Boss relics (relics.ts). A relic is shown this long after its boss falls
 *  (DEFEATED has the screen first); each waits its gap before going off again. */
const RELIC_SHOWN = 2.1;
const RELIC_GAP: Record<string, number> = Object.fromEntries(RELICS.map(relic => [relic.id, relic.gap]));
/** WOLF HOWL: how many close in (within 3.5 m) before it howls, and how fast its ring rolls out. */
const HOWL_CROWD = 7, HOWL_SPEED = 18;
/** 'MIRROR MERE': seconds between its cuts. 'HUSH': seconds time stands still. */
const SHRINE_EVERY = .4, WORLD_SECONDS = 2;

/** Experience to the next level from `level`, for a party of one: the first
 *  card inside a quarter-minute, then one every twenty seconds or so, the
 *  gaps widening as a build fills and the horde (and what it drops) grows. */
/** Experience to the next level. Twice what it was: a level is a skill point
 *  said in a corner now, not three cards dealt over the fight, and it came "too
 *  often" - about thirty-five in a run, not eighty (a boss felled is a point too). */
export const xpNeeded = (level: number) => Math.round((8 + level * 12 + level * level * .55) * 2);

/** A party asks more of the rift than one fighter does. Every factor is 1 for
 *  a single fighter; each fighter past the first brings a bigger horde, bosses
 *  and champions that last (everyone's damage lands on them), and experience
 *  that comes slower (the bigger horde hands out more of it). Blows land as
 *  hard as ever: what grows is the fight, not the price of one mistake. */
export function partyScale(size: number) {
  const extra = Math.max(0, Math.min(3, Math.round(size) - 1));
  return { horde: 1 + extra * .45, hp: 1 + extra * .12, elite: 1 + extra * .45, boss: 1 + extra * .7, xp: 1 + extra * .5, squad: extra };
}

export class SurvivalGame {
  readonly sim: ArenaSimulation;
  readonly horde: Horde;
  readonly heroes = new Map<string, Hero>();
  phase: SurvivalPhase = 'intro';
  private phaseUntil = 0;
  round = 0;
  roundState: RoundState = 'entrance';
  private roundAt = 0;
  private serial = 0;
  private enemies = new Map<string, EnemyRecord>();
  private idleTokens = new TokenPool({ melee: 0, shots: 0, brutes: 0 });
  private orbs: Orb[] = [];
  private orbSerial = 0;
  private feed: FeedItem[] = [];
  private feedSerial = 0;
  private pendingEvents: CombatEvent[] = [];
  private random: () => number;
  kills = 0; level = 1; xp = 0;
  /** The run's score: it stops when the run does (the HUD behind the results
   *  card kept counting the last blows and disagreed with the card). */
  private points = 0;
  get score() { return this.points; }
  set score(value: number) { if (this.phase !== 'over') this.points += (value - this.points) * (this.path === 'cursed' && value > this.points ? PATH_RULES.cursedScore : 1); }
  private overAt = -1;
  private bosses = 0;
  private bossesMet: string[] = [];
  /** The round's bosses (arena ids), and the rift they come out of. */
  private roundBosses: string[] = [];
  private riftAt?: Vec3;
  /** The dungeon's elite packs, and whether rounds are dungeons at all. */
  private packs: { id: number; x: number; z: number; size: number; left: number; elite: boolean; awake: boolean;
    /** An elite pack's affix, its leader (by serial) and when its leader next calls its element down. */
    affix?: Affix; leader?: number; nextCast: number }[] = [];
  private packSerial = 0;
  private packsSlain = 0;
  private readonly hunting: boolean;
  /** The run's seed (its dungeons' order), the kills the rift's bar has and
   *  wants, and where on it the next elite packs come. */
  private readonly seed: number;
  private riftKills = 0;
  /** The Rift Depth (depth.ts) and what its rules come to. */
  readonly depth: number = 0;
  private readonly depthMods: DepthMods = depthMods(0);
  /** THE WARD's round: where its circle is, and whether anyone stands in it. */
  private ward?: { x: number; z: number; radius: number; held: boolean };
  private riftWant = 1;
  private hordeUntil = 0;
  private elitesDue: number[] = [];
  private pendingBoss: BossEntry[] = [];
  /** Drawn a round ahead, so the client can load them before their rift opens. */
  private nextBosses: BossEntry[] = [];
  /** When the next health orb may drop (HEAL_GAP). */
  private nextHealOrb = 0;
  private nextChampion?: BossEntry;
  private escort: Escort = ESCORTS.marines;
  /** The army each round has fielded, in order (bosses.ts armyFor). */
  private armies: EscortId[] = [];
  private escortQueue = 0;
  private escortTotal = 0;
  private nextEscort = 0;
  private nextSquad = 0;
  private nextEvent = Infinity;
  private event?: RunningEvent;
  private lastEvent?: EventKind;
  private eclipse = 0;
  private startedAt = 0;
  private rains: Raining[] = [];
  private strikes: Strike[] = [];
  private probe: string[] = [];
  private probeBossHp = 1;
  private probeGod = false;
  private quiet = false;
  private readonly slowMotion: boolean;
  private begun = false;
  private partyAtStart = 1;
  timeScale = 1;
  private slowUntil = -1;
  /** Set when a location ends: the stage the run travels to next. */
  travelTo?: StageId;
  result?: RunResult;
  private collision?: CollisionWorld & { penetration?(position: Vec3, margin?: number): number };
  private heroList: HordeHero[] = [];
  /** Something that happens a moment later: a card's second beat, a strike landing. */
  private later: { at: number; run: () => void }[] = [];
  /** HUSH (relics.ts): time stands still for everything but the fighters until then. */
  private stoppedUntil = 0;
  /** The run began with relics or on a door of its own (a probe's ?relics=, ?path=). */
  private probeStart = false;
  private zones: Zone[] = [];
  /** The stage's breakable props still standing. */
  private breakables: Breakable[] = [];
  /** Every boss's set piece (signatures.ts). */
  private readonly signatures: Signatures;
  /** The fighters standing, for the signatures, gathered once a tick. */
  private sigHeroList: SigHero[] = [];
  /** A boss held at the brink fell and got up in the same tick: the client
   *  sees neither (by event id, and the getting up by who). */
  private readonly unseen = new Set<number>();
  private readonly quietRespawn = new Set<string>();
  /** Ultimates landed lately on each boss, and when it may next take a team ultimate. */
  private readonly ultimates = new Map<string, { hero: string; at: number }[]>();
  private readonly teamReady = new Map<string, number>();
  /** Bosses finished this run. */
  finished = 0;
  /** The universe of this round's boss. */
  private guardian?: string;
  /** For the run's summary: the bosses it beat, the places it fought in, the cursed rounds it cleared. */
  private readonly bossLog: NonNullable<RunResult['bossLog']> = [];
  private readonly placesSeen = new Set<string>();
  private cursedCleared = 0;
  /** When each boss came out, for how long its fight took. */
  private readonly bossBorn = new Map<string, number>();
  /** The road's fork (paths.ts): its rifts while they are open, when they
   *  close on their own, whether this round's were offered and when one was
   *  taken; the path this round came by, and the one taken for the next. */
  private forks: { kind: PathKind; x: number; z: number; votes: number }[] = [];
  private forkUntil = 0;
  private forkOffered = false;
  private forkTaken = -1;
  path?: PathKind;
  private pathNext?: PathKind;

  private readonly autoLearnOn: boolean;
  /** The place's own rule (placeRules.ts): the Wastes' vents, the Hill's lightning, the Village's falling beams. */
  private readonly places: PlaceRules;
  /** The round the run started at (a probe's `?round=` starts further in). */
  private readonly firstRound: number;
  constructor(options: SurvivalOptions) {
    this.autoLearnOn = !!options.autoLearn;
    this.depth = Math.max(0, Math.min(MAX_DEPTH, Math.floor(options.depth ?? 0) || 0));
    this.depthMods = depthMods(this.depth);
    // A boss asked for by name, or no horde at all, is a probe: straight to it.
    this.hunting = options.hunt !== false && !options.quiet && !options.spawn?.length;
    let state = (options.seed ?? (Math.random() * 0x7fffffff | 0)) || 1;
    this.seed = state;
    this.random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
    const first = Math.max(1, options.round ?? options.wave ?? 1);
    this.round = first - 1; this.firstRound = first;
    const { location } = this.dungeon(first);
    this.collision = options.collision;
    this.slowMotion = options.slowMotion ?? true;
    this.sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, respawn: false, capacity: CAPACITY,
      stage: location.stage, collision: options.collision, seed: Math.floor(this.random() * 0x7fffffff) || 1, ...(options.lockCombat ? { lockCombat: true } : {}) });
    this.horde = new Horde(this.random, {
      strike: (gruntId, heroId, move, origin, heavy) => this.sim.strike(gruntId, heroId, heavy ? 'heavy' : 'light', move, origin, !heavy, true),
      killed: (slot, killer) => this.gruntKilled(slot, killer),
      summon: (slot, count) => this.summoned(slot, count),
    });
    this.horde.setWorld(riftWorld(location.stage));
    this.loadProps(location.stage);
    this.sim.external = this.horde;
    this.sim.assist = { magnet: 2.2 };
    this.signatures = new Signatures({
      now: () => this.now,
      random: () => this.random(),
      body: id => this.body(id),
      heroes: () => this.sigHeroList,
      bounds: () => this.sim.bounds,
      push: item => this.push(item),
      strike: (source, hero, move, from) => { if (this.phase === 'fight') this.sim.strike(source, hero, 'heavy', move, from); },
      burn: (source, hero, amount, name) => { if (this.phase === 'fight') this.sim.damage(hero, amount, source, name); },
      hazard: (source, enemy, at, lands, radius, move, element, look) => {
        this.strikes.push({ source, enemy, at, lands, radius, move });
        this.push({ kind: 'hazard', enemy, x: at.x, y: at.y, z: at.z, radius, value: lands, text: element, sub: look });
      },
      crowd: (x, z, radius, damage) => this.hordeInRadius(x, z, radius, slot => this.horde.damage(slot, damage)),
      summon: (kinds, count, around, hasted) => this.summonFor(kinds, count, around, hasted),
      place: (id, at, face) => this.placeBoss(id, at, face),
      clear: at => this.clear(at),
      hold: (id, seconds) => this.enemies.get(id)?.brain.still(this.now, seconds),
      force: (id, slot) => this.enemies.get(id)?.brain.force(this.now, slot),
      clone: (id, at, life) => this.spawnIllusion(id, at, life),
      armour: (id, factor) => this.sim.setMods(id, { damageIn: this.sim.mods(id).damageIn * factor }),
      empower: (id, factor) => this.sim.setMods(id, { damageOut: this.sim.mods(id).damageOut * factor }),
      damageOut: id => this.sim.mods(id).damageOut,
      party: () => this.heroes.size,
      broken: (id, seconds) => { const record = this.enemies.get(id); if (!record) return; record.brain.still(this.now, seconds); this.tempMod(record, 'damageIn', 1.3, this.now + seconds); },
      broke: hero => { const who = this.heroes.get(hero); if (who) { who.breaks++; who.style.earned(120, this.now); } },
    });
    // What the place itself does to the fight (placeRules.ts): its strikes land on everyone.
    this.places = new PlaceRules({
      now: () => this.now,
      random: () => this.random(),
      bounds: () => this.sim.bounds,
      fighters: () => { const out: Vec3[] = []; for (const hero of this.heroes.values()) { const body = hero.joining ? undefined : this.standing(hero); if (body) out.push({ x: body.x, y: body.y, z: body.z }); } return out; },
      swords: () => this.breakables.filter(prop => prop.kind === 'sword').map(prop => ({ x: prop.x, y: 0, z: prop.z })),
      clear: at => this.clear(at),
      strike: (at, lands, radius, damage, name, element, look) => {
        this.strikes.push({ source: 'rift', enemy: 'rift', at, lands, radius, move: procMove(name, damage, { knockback: 7, stun: .5, radius, style: 'bomb' }) });
        this.push({ kind: 'hazard', enemy: 'rift', x: at.x, y: at.y, z: at.z, radius, value: lands, text: element, sub: look });
      },
    });
    this.signatures.pace = this.depthMods.sigPace;
    this.probe = [...options.spawn ?? []];
    this.probeBossHp = options.bossHp && options.bossHp > 0 ? options.bossHp : 1;
    this.probeGod = !!options.god;
    this.quiet = !!options.quiet;
    const seats = options.heroes ?? (options.fighter ? [{ id: PLAYER_ID, fighter: options.fighter, name: options.name ?? 'You', unlocked: options.unlocked, bonus: options.bonus }] : []);
    for (const seat of seats) this.addHero(seat, options.picks);
    if (options.path && PATHS.includes(options.path)) { this.pathNext = options.path; this.probeStart = true; }
    if (options.relics?.length) { this.probeStart = true; for (const hero of this.heroes.values()) hero.relics = [...new Set(options.relics.filter(id => relicOf(id)))].slice(0, RELIC_SLOTS); }
    if (options.lobby) { this.enterPhase('lobby'); return; }
    this.begin();
  }

  private get now() { return this.sim.serverTime; }
  /** The place a round is fought: the run's dungeon for it, or - with the
   *  dungeons off - the old road's. */
  dungeon(round: number) { return this.hunting ? dungeonFor(this.seed, round) : locationFor(round); }
  get fighter(): FighterId { return this.heroes.values().next().value?.fighter ?? 'taisei'; }
  private get lead() { return this.heroes.values().next().value as Hero | undefined; }
  /** The stage the run stands on. */
  get stage() { return this.sim.stage; }
  /** Kept for the co-op room and the records: the round. */
  get wave() { return Math.max(1, this.round); }

  addHero(seat: HeroSeat, picks: readonly string[] = []) {
    if (this.heroes.has(seat.id) || this.heroes.size >= MAX_PARTY || this.begun) return false;
    const hero = new Hero(seat.id, seat.fighter, seat.name ?? 'Fighter');
    hero.look = seat.look;
    // A build to start from (a probe's ?picks=, a co-op seat): only real cards.
    hero.picks = picks.filter(id => UPGRADES.some(def => def.id === id));
    // What their progress brings: bought nodes (only real ones), a mastery's skill points.
    hero.unlocked = (seat.unlocked ?? []).filter(id => UPGRADES.some(def => def.id === id && def.bought));
    hero.points += Math.max(0, Math.min(MAX_BONUS_POINTS, Math.floor(seat.bonus ?? 0)));
    this.heroes.set(seat.id, hero);
    this.sim.addPlayer(seat.id, seat.fighter, hero.name, false, this.startPoint(this.heroes.size - 1));
    this.sim.setTeam(seat.id, HERO);
    this.setOutfit(seat.id, seat.outfit);
    this.applyStats(hero, true);
    this.refreshHeroList();
    return true;
  }

  /** A fighter joining a run already under way (co-op drop-in). Between rounds
   *  they are in at once; mid-round they are held in a rift beside the party -
   *  untouchable, still, watching, their tree open to them - until the round's
   *  boss falls, then A NEW CHALLENGER. They bring skill points to match the
   *  party's biggest build, and their own progress (bought nodes, mastery points). */
  dropIn(seat: HeroSeat) {
    if (!this.begun || this.phase === 'over' || this.phase === 'lobby' || this.heroes.has(seat.id) || this.heroes.size >= MAX_PARTY) return false;
    const party = [...this.heroes.values()];
    const hero = new Hero(seat.id, seat.fighter, seat.name ?? 'Fighter');
    hero.look = seat.look;
    hero.unlocked = (seat.unlocked ?? []).filter(id => UPGRADES.some(def => def.id === id && def.bought));
    hero.points = Math.max(0, ...party.map(each => each.picks.length + each.points)) + Math.max(0, Math.min(MAX_BONUS_POINTS, Math.floor(seat.bonus ?? 0)));
    hero.joining = true;
    this.heroes.set(seat.id, hero);
    const beside = party.map(each => this.standing(each)).find(Boolean) ?? (this.lead ? this.body(this.lead.id) : undefined);
    const at = beside ? this.clear({ x: beside.x + 2.2, y: 0, z: beside.z + 1.4 }) ?? { x: beside.x, y: 0, z: beside.z } : this.startPoint(this.heroes.size - 1);
    this.sim.addPlayer(seat.id, seat.fighter, hero.name, false, at);
    this.setOutfit(seat.id, seat.outfit);
    this.sim.setTeam(seat.id, HERO);
    this.applyStats(hero, true);
    this.refreshHeroList();
    this.hold(hero);
    this.push({ kind: 'challenger', value: 0, text: `${hero.name.toUpperCase()} JOINS THE RUN`, sub: 'IN WHEN THIS ROUND\'S BOSS FALLS', hero: hero.id, x: at.x, y: 0, z: at.z });
    // Between rounds already: straight in.
    if (this.roundState === 'interlude' || this.phase === 'intro' || this.phase === 'travel') this.letIn(hero);
    return true;
  }
  /** Held: nothing lands on them, and they stand where the rift put them. */
  private hold(hero: Hero) {
    const actor = this.sim.actors.get(hero.id);
    if (actor) actor.evadeUntil = this.now + 1e6;
    this.sim.clearPlayerInput(hero.id);
  }
  /** Out of the rift and into the fight (`rescue`: the party fell, and they came to save it). */
  private letIn(hero: Hero, rescue = false) {
    if (!hero.joining) return;
    hero.joining = false;
    const actor = this.sim.actors.get(hero.id);
    if (actor) actor.evadeUntil = this.now + 1.5;
    const state = this.body(hero.id);
    this.push({ kind: 'challenger', value: 1, text: 'A NEW CHALLENGER', sub: rescue ? `${hero.name.toUpperCase()} COMES TO SAVE THE RUN` : hero.name.toUpperCase(), hero: hero.id, x: state?.x, y: state?.y, z: state?.z });
    // Their tree, still open, holds the party as anyone's does.
    if (hero.treeOpen && this.phase === 'fight') this.enterPhase('draft');
  }

  /** What a fighter wears, told after they sat down (a co-op room learns it from their account). */
  setLook(id: string, look: readonly number[] | undefined) { const hero = this.heroes.get(id); if (hero) hero.look = look; }
  /** The shop's outfit a hero wears for their fighter (economy/outfits.ts), read from their account by the room:
   *  on their body, which every screen draws. */
  setOutfit(id: string, outfit: string | undefined) { const body = this.body(id); if (body) { if (outfit) body.outfit = outfit; else delete body.outfit; } }
  /** A fighter's emote, for every screen in the party (`place`: its place in the economy's catalogue). */
  emote(id: string, place: number) { if (this.heroes.has(id)) this.push({ kind: 'emote', hero: id, value: place }); }

  removeHero(id: string) {
    const hero = this.heroes.get(id);
    if (!hero) return;
    this.heroes.delete(id);
    this.sim.removePlayer(id);
    this.refreshHeroList();
    for (const record of this.enemies.values()) if (record.target === id) { record.target = undefined; record.retargetAt = 0; }
    for (const orb of this.orbs) if (orb.to === id) { orb.to = undefined; orb.pulled = false; }
    if (!this.heroes.size) return;
    if (this.phase === 'draft' && !this.choosing()) this.resume();
    if (this.phase !== 'over' && this.phase !== 'lobby' && this.allDown() && !this.lastStand()) this.gameOver();
  }

  private refreshHeroList() {
    this.heroList = [...this.heroes.values()].map(hero => ({ id: hero.id, x: 0, y: 0, z: 0, standing: false, airborne: false }));
    this.horde.heroes = this.heroList;
    this.horde.forgetTargets();
  }

  begin() {
    if (this.begun || !this.heroes.size) return;
    this.begun = true;
    this.partyAtStart = this.heroes.size;
    this.startedAt = this.now;
    if (this.phase === 'lobby') { let seat = 0; for (const hero of this.heroes.values()) { this.sim.place(hero.id, this.startPoint(seat++), Math.PI); this.sim.heal(hero.id, Infinity); } }
    const { location } = this.dungeon(this.round + 1);
    if (!this.probe.some(id => bossEntry(id))) this.nextBosses = this.drawSet(this.round + 1);
    // A party gathered somewhere else is teleported into its first dungeon.
    if (location.stage !== this.sim.stage) { this.travelTo = location.stage; this.enterPhase('travel'); return; }
    this.enterPhase('intro', 3);
    this.push({ kind: 'location', text: location.name, sub: location.subtitle });
    this.placesSeen.add(location.id);
    this.places.begin(this.quiet ? '' : location.id);
  }

  private startPoint(seat = 0): Vec3 {
    const offset = seat === 0 ? 0 : (seat % 2 ? -1 : 1) * Math.ceil(seat / 2) * 2.6;
    const { halfZ } = STAGES[this.sim.stage];
    return { x: offset, y: 0, z: -Math.min(8, halfZ * .3) };
  }

  private applyStats(hero: Hero, initial = false) {
    hero.stats = runStats(hero.picks);
    const s = hero.stats;
    // HOUND ARMOR, while it has them: harder, faster, and it drinks.
    const rage = hero.raging && s['grave-hound'] ? 1 : 0;
    const mods: Partial<CombatMods> = { damageOut: s.damage * (1 + rage * .5), damageIn: s.damageIn, speed: s.speed * (1 + rage * .2), cooldown: s.cooldown, stamina: s.stamina, staminaRegen: s.staminaRegen,
      // Lifesteal is the run's to pay out (see `leech`), not the arena's.
      meterGain: s.meterGain, awakenGain: s.awakenGain, awakenSeconds: s.awakenSeconds, lifesteal: 0, crit: s.crit, critDamage: s.critDamage };
    if (this.probeGod) mods.damageIn = .02;
    hero.baseMods = mods; hero.modsChanged('');
    this.sim.setMods(hero.id, mods);
    this.sim.setMaxHp(hero.id, MAX_HP + s.maxHp, initial ? 0 : Math.max(0, s.maxHp - hero.healthGranted));
    hero.healthGranted = Math.max(hero.healthGranted, s.maxHp);
    if (initial) this.sim.heal(hero.id, MAX_HP + s.maxHp);
  }

  private enterPhase(phase: SurvivalPhase, seconds = 0) { this.phase = phase; this.phaseUntil = this.now + seconds; }
  private push(item: Omit<FeedItem, 'id' | 'at'>) {
    this.feed.push({ ...item, id: ++this.feedSerial, at: this.now });
    if (this.feed.length > 96) this.feed.splice(0, this.feed.length - 96);
    // A boss's (or a champion's) card holds the screen for its entrance.
    if (item.kind === 'boss') this.entranceUntil = this.now + 4;
  }
  /** Until then no draft opens: a treasure draft opened under Gantry's
   *  card, and the two covered each other. */
  private entranceUntil = 0;

  /** Frozen while cards are being chosen, between stages, and once it is over. */
  get frozen() { return this.phase === 'draft' || this.phase === 'travel' || (this.phase === 'over' && this.now >= this.overAt + 2.6); }

  tick(input: PlayerInput) {
    if (this.frozen) return;
    const lead = this.lead;
    if (lead) this.sim.submitInput(lead.id, input);
    this.step();
  }

  submit(id: string, input: PlayerInput) {
    const hero = this.heroes.get(id);
    if (!hero) return;
    // One held in their rift stands still (the command is still taken, so its acknowledgement flows).
    this.sim.submitInput(id, hero.joining ? { seq: input.seq, moveX: 0, moveZ: 0, yaw: input.yaw } : input);
  }

  step(waiting?: ReadonlySet<string>) {
    if (this.frozen) return;
    this.watchHeroes();
    this.think();
    this.horde.aggression = Math.min(1.3, (this.round - 1) / 9 + this.eclipse * .4) + loopOf(Math.max(1, this.round)) * .15;
    // A summoner calls no more once the field is as full as the director would keep it.
    if (this.sim.tick % 30 === 0) this.horde.summonCap = Math.min(this.horde.capacity - 40, this.crowdWanted(this.now) + 8);
    this.horde.step(DT, this.now);
    this.sim.step(DT, waiting);
    this.governHolds();
    const events = this.sim.drainEvents();
    this.consume(events);
    this.procs();
    this.upkeep();
    if (this.autoLearnOn) this.autoLearn();
    this.hazards();
    // The place's own rule, while its fight is on (not over a boss's entrance, the seal's hold or stopped time).
    this.places.step(this.phase === 'fight' && (this.roundState === 'horde' || this.roundState === 'battle') && !this.sealHold && this.now >= this.entranceUntil && this.now >= this.stoppedUntil, Math.max(1, this.round));
    this.sigHeroList = this.standingHeroes();
    this.signatures.step(this.sigBosses(), this.phase === 'fight' && this.roundState === 'battle' && !this.sealHold);
    this.resolveTechniques();
    this.updateOrbs();
    const worth = STYLE_WORTH[rankFor(Math.max(1, this.round))];
    for (const hero of this.heroes.values()) { hero.style.worth = worth; hero.style.update(DT, this.now); }
    this.direct();
    // A crowd's blows passing through one dodge are one dodge heard, not twenty.
    // And one sweep through a crowd is heard as one blow landing on a few, not
    // a hundred copies of the same thud in the same instant: past the sixth
    // grunt a blow strikes in 50 ms of the wall clock, the rest land quietly
    // (no sound, number or shake of their own - the damage is the same). The
    // wall clock, not the tick: a client catching up after a hitch runs thirty
    // ticks in one frame, and six a tick let 180 copies of one thud through at once.
    const wall = typeof performance === 'object' ? performance.now() : Date.now();
    for (const event of events) {
      // A boss held at the brink did not fall, and did not get up.
      if (this.unseen.delete(event.id)) continue;
      if (event.kind === 'respawn' && this.quietRespawn.delete(event.actorId)) continue;
      if (event.kind === 'dodge') {
        const key = event.targetId ?? '';
        if (this.now < (this.dodgeHeard.get(key) ?? 0)) continue;
        this.dodgeHeard.set(key, this.now + .3);
      }
      // (A grunt is anything neither a fighter nor a boss: one already gone -
      // the seal clears the field in the tick its last blows land - counts too.
      // Only live ones counted, and 211 copies of one thud started at the seal.)
      if (event.kind === 'hit' && event.move && !isQuiet(event.move) && event.targetId && !this.heroes.has(event.targetId) && !this.enemies.has(event.targetId)) {
        const key = `${event.actorId}|${event.move}`;
        let heard = this.struck.get(key);
        if (!heard || wall - heard.at > 50) { heard = { at: wall, n: 0 }; this.struck.set(key, heard); }
        if (++heard.n > 6) { this.pendingEvents.push({ ...event, move: 'Rout' }); continue; }
      }
      // A blow on a giant is shown where a fighter's blade can reach, not at its
      // chest: numbers anchored above the frame were all clamped to one line
      // under the boss bar and printed over each other ("12121").
      if (event.kind === 'hit' && event.endpoint && event.targetId && this.enemies.has(event.targetId)) {
        const target = this.body(event.targetId);
        if (target && event.endpoint.y > target.y + 2.2) { this.pendingEvents.push({ ...event, endpoint: { ...event.endpoint, y: target.y + 1.4 + Math.random() * .8 } }); continue; }
      }
      this.pendingEvents.push(event);
    }
    if (this.pendingEvents.length > 768) this.pendingEvents.splice(0, this.pendingEvents.length - 768);
    // The seal's choice, once its card has played.
    if (this.finaleChoiceAt && this.now >= this.finaleChoiceAt && this.phase === 'fight') {
      this.finaleChoiceAt = 0;
      for (const hero of this.heroes.values()) hero.draft = { cards: [...SurvivalGame.FINALE_CARDS], legendary: false, finale: true };
      this.enterPhase('draft');
    }
    // A level is a card - after its moment: the light goes up, time slows, then the fight stops for it.
    // (Not while the seal holds: a treasure draft opened over its card. They wait for GO DEEPER.)
    if (this.phase === 'fight' && this.roundState !== 'entrance' && !this.sealHold && this.now >= this.levelBeat && this.now >= this.entranceUntil && this.openDrafts()) this.enterPhase('draft');
  }

  // ---- who is standing -------------------------------------------------------
  private body(id: string) { return this.sim.actors.get(id)?.state; }
  private standing(hero: Hero) { const state = this.body(hero.id); return state?.alive && !hero.down && !hero.joining ? state : undefined; }
  private allDown() {
    for (const hero of this.heroes.values()) if (this.standing(hero) || hero.reviveAt > 0) return false;
    return true;
  }
  /** The party is down: anyone waiting in a rift comes out now, to save the run. */
  private lastStand() {
    let any = false;
    for (const hero of this.heroes.values()) if (hero.joining) { this.letIn(hero, true); any = true; }
    return any;
  }
  /** The horde's view of the party, refreshed each tick. */
  private watchHeroes() {
    let i = 0;
    for (const hero of this.heroes.values()) {
      const view = this.heroList[i++], state = this.body(hero.id);
      if (!view) continue;
      view.x = state?.x ?? 0; view.y = state?.y ?? 0; view.z = state?.z ?? 0;
      view.standing = !!state?.alive && !hero.down && !hero.joining && this.phase !== 'lobby';
      view.airborne = !!state && !state.grounded;
    }
  }
  /** Someone to open a rift beside: whoever has the fewest of the horde on them. */
  private anchor(): Hero | undefined {
    if (this.heroes.size <= 1) return this.lead;
    const load = new Map<string, number>();
    const heroes = [...this.heroes.values()];
    for (const hero of heroes) if (this.standing(hero)) load.set(hero.id, 0);
    if (!load.size) return this.lead;
    for (let i = 0; i < this.horde.capacity; i++) {
      if (!this.horde.isAlive(i)) continue;
      const target = heroes[this.horde.target[i]];
      if (target && load.has(target.id)) load.set(target.id, load.get(target.id)! + 1);
    }
    const least = Math.min(...load.values());
    const idle = [...load.keys()].filter(id => load.get(id) === least);
    return this.heroes.get(idle[Math.floor(this.random() * idle.length)]);
  }
  private targetOf(record: EnemyRecord, self: PlayerState): Hero | undefined {
    if (this.heroes.size <= 1) { const lead = this.lead; if (lead && record.target !== lead.id) record.target = lead.id; return lead; }
    const now = this.now, current = record.target ? this.heroes.get(record.target) : undefined;
    if (current && this.standing(current) && now < (record.retargetAt ?? 0)) return current;
    let best: Hero | undefined, gap = Infinity;
    for (const hero of this.heroes.values()) {
      const state = this.standing(hero);
      if (!state) continue;
      const d = Math.hypot(state.x - self.x, state.z - self.z) * (hero === current ? .7 : 1);
      if (d < gap) { gap = d; best = hero; }
    }
    if (best !== current) { current?.tokens.release(record.id); record.target = best?.id; }
    record.retargetAt = now + (record.boss ? 4 + this.random() * 4 : 1.2 + this.random() * 1.5);
    return best;
  }

  // ---- the bosses' and champions' brains -----------------------------------------
  private think() {
    for (const hero of this.heroes.values()) {
      const state = this.body(hero.id);
      if (!state?.alive) continue;
      if (state.grounded && state.y > -.2) hero.lastSafe = { x: state.x, y: state.y, z: state.z };
      else if (state.y < -1 && hero.lastSafe) {
        const from = { x: state.x, y: state.y, z: state.z };
        this.sim.place(hero.id, hero.lastSafe, state.yaw);
        this.sim.damage(hero.id, state.maxHp * .1, hero.id, 'Fall');
        this.push({ kind: 'blink', x: hero.lastSafe.x, y: hero.lastSafe.y, z: hero.lastSafe.z, points: [from, hero.lastSafe] });
      }
    }
    if (!this.enemies.size) return;
    const crowd: PlayerState[] = [];
    for (const record of this.enemies.values()) { const state = this.body(record.id); if (state?.alive) crowd.push(state); }
    const base: Omit<BrainWorld, 'target' | 'tokens'> = { sim: this.sim, now: this.now, random: this.random, crowd, wave: Math.min(30, this.round * 2) };
    for (const record of this.enemies.values()) {
      const state = this.body(record.id);
      this.expire(record);
      if (!state?.alive || record.def.rival) continue;
      // A copy lasts its while, and not a moment past the boss it copies.
      if (record.illusion && (this.now >= record.illusion.until || !this.standingBoss(record.illusion.of))) { this.shatter(record); continue; }
      // At the brink: nothing but the finish (see `brink`).
      if (record.brink) { this.atBrink(record); continue; }
      const hero = this.targetOf(record, state);
      const target = hero ? this.body(hero.id) : undefined;
      if (record.armouredUntil && this.now >= record.armouredUntil) {
        record.armouredUntil = 0;
        this.sim.setMods(record.id, { damageIn: this.sim.mods(record.id).damageIn / LAST_STAND_ARMOUR });
      }
      // An S boss's last quarter: it roars, takes a third of the damage while
      // it does, calls the rest of its army and brings the sky down again,
      // harder - the climax is a third fight, not the second one going on.
      if (record.boss && record.rank === 'S' && record.brain.phase === 1 && state.hp < state.maxHp * .25) {
        record.brain.enterPhase(2, this.now);
        const mods = this.sim.mods(record.id);
        this.sim.setMods(record.id, { speed: Math.min(1.35, mods.speed * 1.08), damageOut: mods.damageOut * 1.12, damageIn: mods.damageIn * LAST_STAND_ARMOUR });
        record.armouredUntil = this.now + 2.6;
        this.push({ kind: 'enraged', text: 'LAST STAND', sub: record.def.name.toUpperCase(), enemy: record.def.id, actor: record.id, rank: record.rank, value: 2, x: state.x, y: state.y, z: state.z });
        if (this.riftAt && !this.quiet) { this.escortQueue += Math.round(10 * partyScale(this.heroes.size).horde); this.escortTotal = Math.max(this.escortTotal, this.escortQueue); this.nextEscort = this.now + .8; }
        this.wrath(record, 2);
      }
      if (record.boss && !record.illusion && record.brain.phase === 0 && state.hp < state.maxHp * this.depthMods.awaken) {
        record.brain.enterPhase(1, this.now);
        this.wrath(record, 1);
        // Half its health gone, it stops holding back - the higher its rank, the more.
        const fury = record.rank === 'S' ? 1.3 : record.rank === 'A' ? 1.22 : 1.15;
        this.sim.setMods(record.id, { speed: this.sim.mods(record.id).speed * Math.min(1.2, fury), damageOut: this.sim.mods(record.id).damageOut * fury });
        // (Its AWAKENING, as a fighter's is: a boss with a second body of its own rises as that instead.)
        if (FORMS_OF_THEIR_OWN.has(record.def.id)) this.push({ kind: 'enraged', text: record.rank === 'S' || record.rank === 'A' ? 'UNLEASHED' : 'ENRAGED', sub: record.def.name.toUpperCase(), enemy: record.def.id, actor: record.id, rank: record.rank, x: state.x, y: state.y, z: state.z });
        else this.awaken(record, state);
        // A top-rank boss's second wind calls its escort back through the rift.
        if ((record.rank === 'S' || record.rank === 'A') && this.riftAt && !this.quiet) { this.escortQueue += Math.round(8 * partyScale(this.heroes.size).horde); this.escortTotal = Math.max(this.escortTotal, this.escortQueue); this.nextEscort = this.now + .6; }
      }
      if (record.def.blink && target?.alive && this.now >= record.brain.roaring) this.blink(record, state, target);
      const command = record.brain.think(state, { ...base, target: hero?.down ? undefined : target, tokens: hero?.tokens ?? this.idleTokens, rank: loopOf(Math.max(1, this.round)) ? 6 : RANKS.indexOf(record.rank ?? rankFor(Math.max(1, this.round))) });
      if (target?.alive) this.unstick(record, state, target, command);
      this.sim.command(record.id, command);
    }
  }

  private blink(record: EnemyRecord, self: PlayerState, target: PlayerState) {
    const now = this.now, spec = record.def.blink!;
    record.nextBlink ??= now + spec.every * BLINK_PACE * (.5 + this.random() * .5);
    if (now < record.nextBlink || (self.action !== 'idle' && self.action !== 'run') || !self.grounded) return;
    if (Math.hypot(target.x - self.x, target.z - self.z) < spec.beyond) return;
    const behind = target.yaw + Math.PI + (this.random() - .5) * 1.8;
    for (let attempt = 0; attempt < 5; attempt++) {
      const angle = attempt === 0 ? behind : behind + (attempt % 2 ? 1 : -1) * attempt * .7;
      const r = 2.2 + (record.def.size ?? 1) * .5;
      const at = this.clear({ x: target.x + Math.sin(angle) * r, y: target.y, z: target.z + Math.cos(angle) * r });
      if (!at) continue;
      const from = { x: self.x, y: self.y, z: self.z };
      this.sim.place(record.id, at, Math.atan2(target.x - at.x, target.z - at.z));
      record.nextBlink = now + spec.every * BLINK_PACE * (.8 + this.random() * .4);
      record.brain.hurry(now);
      this.push({ kind: 'blink', enemy: record.def.id, x: at.x, y: at.y, z: at.z, points: [from, at], boss: record.boss });
      return;
    }
    record.nextBlink = now + 1;
  }

  private unstick(record: EnemyRecord, self: PlayerState, target: PlayerState, command: { moveX: number; moveZ: number }) {
    const now = this.now, wants = Math.hypot(command.moveX, command.moveZ) > .3 && self.grounded && (self.action === 'run' || self.action === 'idle');
    if (!wants) { record.anchor = undefined; return; }
    if (!record.anchor || Math.hypot(self.x - record.anchor.x, self.z - record.anchor.z) > .6) { record.anchor = { x: self.x, z: self.z, at: now }; return; }
    const stuck = now - record.anchor.at;
    if (record.sidestep && now < record.sidestep.until) { command.moveX = record.sidestep.x; command.moveZ = record.sidestep.z; return; }
    if (stuck > 5) {
      const at = this.spawnAround(6, 1.2, 9, record.target ? this.heroes.get(record.target) : undefined, record.def.size ?? 1);
      this.push({ kind: 'spawn', enemy: record.def.id, x: at.x, y: at.y, z: at.z, radius: 1.6, value: 1 });
      this.sim.place(record.id, at, Math.atan2(target.x - at.x, target.z - at.z));
      record.anchor = undefined; record.sidestep = undefined;
      return;
    }
    if (stuck > .5) {
      const side = this.random() < .5 ? 1 : -1, n = Math.hypot(command.moveX, command.moveZ) || 1;
      record.sidestep = { x: -command.moveZ / n * side, z: command.moveX / n * side, until: now + .9 };
      command.moveX = record.sidestep.x; command.moveZ = record.sidestep.z;
    }
  }

  // ---- awakenings, signatures, copies, the finish -----------------------------------
  /** Its damage taken or dealt multiplied until `until`, and put back after. */
  private tempMod(record: EnemyRecord, key: 'damageIn' | 'damageOut', factor: number, until: number) {
    this.sim.setMods(record.id, { [key]: this.sim.mods(record.id)[key] * factor });
    (record.temp ??= []).push({ until, key, factor });
  }
  private expire(record: EnemyRecord) {
    if (!record.temp?.length) return;
    for (let i = record.temp.length - 1; i >= 0; i--) {
      const mod = record.temp[i];
      if (this.now < mod.until) continue;
      record.temp.splice(i, 1);
      this.sim.setMods(record.id, { [mod.key]: this.sim.mods(record.id)[mod.key] / mod.factor });
    }
  }

  private awaken(record: EnemyRecord, state: PlayerState) {
    const form = awakeningOf(record.def.id, record.def.color);
    record.awakened = true;
    this.tempMod(record, 'damageIn', .15, this.now + 1.4);
    this.push({ kind: 'enraged', value: 3, text: form.name, sub: record.def.name.toUpperCase(), enemy: record.def.id, actor: record.id, rank: record.rank, boss: true,
      x: state.x, y: state.y, z: state.z, radius: 6.5 });
    this.later.push({ at: this.now + .6, run: () => {
      const self = this.body(record.id);
      if (!self?.alive) return;
      const move = procMove('Awakening', 36, { knockback: 13, stun: .45, style: 'bomb' });
      for (const hero of this.heroes.values()) {
        const p = this.standing(hero);
        if (p && Math.hypot(p.x - self.x, p.z - self.z) < 6.5) this.sim.strike(record.id, hero.id, 'heavy', move, { x: self.x, y: self.y + .5, z: self.z });
      }
    } });
    this.signatures.awaken(this.sigBoss(record, state));
  }

  private sigBoss(record: EnemyRecord, state: PlayerState): SigBoss {
    return { id: record.id, enemy: record.def.id, name: record.def.name, state, awakened: !!record.awakened, since: 0, target: record.target, size: record.def.size ?? 1, height: record.def.height, rank: record.rank };
  }
  /** The bosses a signature may come from this tick: fighting, not at the brink, not copies. */
  private sigBosses(): SigBoss[] {
    const out: SigBoss[] = [];
    for (const record of this.enemies.values()) {
      if (!record.boss || record.illusion || record.brink || record.diedAt !== undefined) continue;
      const state = this.body(record.id);
      if (state?.alive) out.push(this.sigBoss(record, state));
    }
    return out;
  }
  private standingHeroes(): SigHero[] {
    const out: SigHero[] = [];
    for (const hero of this.heroes.values()) { const state = this.standing(hero); if (state) out.push({ id: hero.id, state, velocity: hero.velocity }); }
    return out;
  }

  /** A boss's own come through a rift beside it (a signature's summons). */
  private summonFor(kinds: readonly string[], count: number, around: Vec3, hasted: boolean) {
    const beside = this.anchor();
    const centre = this.scatter({ x: around.x, y: 0, z: around.z }, 3);
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const type = GRUNT_INDEX.get(kinds[i % kinds.length]);
      if (type === undefined) continue;
      if (this.spawnGrunt(type, this.scatter(centre, 1.6 + count * .2), false, beside, undefined, hasted) !== undefined) placed++;
    }
    if (placed) this.push({ kind: 'spawn', x: centre.x, y: 0, z: centre.z, radius: 2 + placed * .15, value: placed });
    return placed;
  }

  /** A boss gone from where it stood and at `at` (a signature's blink). */
  private placeBoss(id: string, at: Vec3, face: Vec3) {
    const record = this.enemies.get(id), self = this.body(id);
    if (!record || !self?.alive) return false;
    const spot = this.clear(at) ?? this.clear({ x: at.x + 1.2, y: 0, z: at.z }) ?? this.clear({ x: at.x - 1.2, y: 0, z: at.z });
    if (!spot) return false;
    const from = { x: self.x, y: self.y, z: self.z };
    this.sim.place(id, spot, Math.atan2(face.x - spot.x, face.z - spot.z));
    this.push({ kind: 'blink', enemy: record.def.id, x: spot.x, y: spot.y, z: spot.z, points: [from, spot], boss: record.boss });
    return true;
  }

  /** One of a boss's copies (Shiun's False Encore): its body, its moves,
   *  a sliver of its health and less than half its weight - drawn and
   *  marked as the boss, with no bar of its own. */
  private spawnIllusion(ofId: string, at: Vec3, life: number) {
    const real = this.enemies.get(ofId), body = this.body(ofId);
    if (!real || !body?.alive || this.sim.actors.size >= CAPACITY) return undefined;
    const id = `e${++this.serial}`;
    const facing = this.anchor(), player = (facing ? this.body(facing.id) : undefined) ?? { x: 0, z: 0 };
    this.addActor(id, real.def, at, player, Math.max(80, body.maxHp * .035), this.sim.mods(ofId).damageOut * .45, false);
    this.enemies.set(id, { id, def: real.def, brain: new EnemyBrain(id, real.def, this.now + .5, this.random), boss: false, champion: false, rank: real.rank, entry: real.entry,
      illusion: { of: ofId, until: this.now + life } });
    // (`text` is whose copy it is: it wears that one's awakening too.)
    this.push({ kind: 'spawn', enemy: real.def.id, x: at.x, y: at.y, z: at.z, radius: 1.8, value: 1, actor: id, sub: 'illusion', text: ofId });
    return id;
  }
  /** A copy struck down or run out: it breaks like glass, and is gone. */
  private shatter(record: EnemyRecord) {
    const body = this.body(record.id);
    if (body) this.push({ kind: 'shatter', enemy: record.def.id, actor: record.id, x: body.x, y: body.y, z: body.z, radius: record.def.height });
    this.retire(record.id);
  }

  /** Whether a boss's fall is held for its finish: a boss (not a copy, a
   *  champion or a form that rises again), once, while the fight is on. */
  private canFinish(record: EnemyRecord) {
    if (!record.boss || record.illusion || record.brink || (record.def.transform && !record.transformed) || this.phase !== 'fight') return false;
    for (const hero of this.heroes.values()) if (this.standing(hero)) return true;
    return false;
  }
  /** FINISH IT: the blow that would have felled it leaves it on its knees
   *  instead, a moment, with every fighter's ultimate filled - the one that
   *  lands on it is the finisher. Its army holds its breath; nothing else it
   *  takes can fell it (a point a blow); unfinished, it falls anyway. */
  private brink(record: EnemyRecord, killerId: string) {
    const now = this.now;
    this.sim.revive(record.id, BRINK_HP);
    const actor = this.sim.actors.get(record.id);
    if (actor) actor.evadeUntil = now;
    this.quietRespawn.add(record.id);
    this.sim.setMods(record.id, { damageIn: BRINK_SKIN });
    record.lastHitBy = this.heroes.has(killerId) ? killerId : record.lastHitBy;
    record.brink = { until: now + FINISH_WINDOW };
    record.brain.still(now, FINISH_WINDOW + 2);
    this.signatures.end(record.id);
    this.rains = this.rains.filter(rain => rain.source !== record.id);
    this.horde.holdUntil = Math.max(this.horde.holdUntil, now + FINISH_WINDOW);
    // Everyone's ultimate filled and ready: any of them can be the finisher.
    for (const hero of this.heroes.values()) {
      if (!this.standing(hero)) continue;
      this.sim.addMeter(hero.id, 100);
      const state = this.sim.actors.get(hero.id)?.state;
      if (state) state.cooldowns.ultimate = Math.min(state.cooldowns.ultimate, now);
    }
    this.slow(.45, 1);
    const body = this.body(record.id);
    // An ultimate was the blow that felled it: that ultimate is its finisher.
    const blow = record.lastBlow, killer = this.heroes.get(killerId);
    if (killer && blow?.slot === 'ultimate' && now - blow.at < .05) this.finishing(record, killer, blow.contact);
    this.push({ kind: 'finish', text: 'FINISH IT', sub: record.def.name.toUpperCase(), enemy: record.def.id, actor: record.id, rank: record.rank, boss: true, value: record.brink.until,
      x: body?.x, y: body?.y, z: body?.z });
  }
  /** A boss at the brink, every tick: finished once the ultimate on it has
   *  landed its last blow, or fallen when the window runs out. */
  private atBrink(record: EnemyRecord) {
    const brink = record.brink!;
    if (brink.done) return;
    const executing = brink.executing;
    if (executing && this.now >= executing.until) this.execute(record, executing.hero, executing.with);
    else if (!executing && this.now >= brink.until) {
      brink.done = true;
      this.sim.damage(record.id, BRINK_HP / BRINK_SKIN * 2, record.lastHitBy ?? this.lead?.id ?? PLAYER_ID, 'Condemned');
    }
  }
  /** An ultimate landed on a boss at the brink: it is finishing it (and a
   *  friend's landing with it makes it a team finisher). */
  private finishing(record: EnemyRecord, hero: Hero, contact: number) {
    const brink = record.brink!;
    const move = moveFor(hero.fighter, 'ultimate', !!this.body(hero.id)?.awakened);
    const last = contact >= move.contacts.length - 1;
    const rest = last ? .05 : Math.min(2.6, Math.max(.05, (move.contacts[move.contacts.length - 1] ?? 0) - (move.contacts[contact] ?? 0)) + .08);
    if (!brink.executing) brink.executing = { hero: hero.id, until: this.now + rest, with: new Set() };
    else if (brink.executing.hero !== hero.id) brink.executing.with.add(hero.id);
    else if (last) brink.executing.until = Math.min(brink.executing.until, this.now + .05);
  }
  /** The finisher: the boss ends on it - a bigger fall, a skill point for
   *  whoever landed it, and the announcer's word for it. */
  private execute(record: EnemyRecord, heroId: string, friends: ReadonlySet<string>) {
    const brink = record.brink!;
    brink.done = true;
    const hero = this.heroes.get(heroId), team = friends.size > 0, body = this.body(record.id);
    this.finished++;
    if (hero) { hero.finishers++; hero.points++; hero.style.earned(team ? 320 : 260, this.now); }
    for (const id of friends) { const friend = this.heroes.get(id); if (friend) { friend.finishers++; friend.style.earned(200, this.now); } }
    this.score += Math.round(3000 * Math.max(1, RANKS.indexOf(record.rank ?? 'F')) * (team ? 1.5 : 1));
    const names = [hero, ...[...friends].map(id => this.heroes.get(id))].filter((each): each is Hero => !!each).map(each => this.label(each));
    this.push({ kind: 'finisher', text: team ? 'TEAM FINISHER' : 'FINISHER', sub: `${names.join(' & ')} · ${record.def.name.toUpperCase()}`, enemy: record.def.id, actor: record.id, hero: heroId,
      value: team ? 2 : 1, rank: record.rank, boss: true, x: body?.x, y: body?.y, z: body?.z });
    this.slow(.3, 1.4);
    this.sim.damage(record.id, BRINK_HP / BRINK_SKIN * 2, heroId, 'Finisher');
  }

  /** A fighter as the stamps name them: their name, or their fighter's when they have none of their own. */
  private label(hero: Hero) { return (/^(you|fighter)$/i.test(hero.name.trim()) ? hero.fighter : hero.name).toUpperCase(); }

  /** Ultimates from two fighters landing on one boss a moment apart: a team
   *  ultimate - a blow of its own on top of both, and the crowd round it thrown. */
  private teamUltimate(record: EnemyRecord, hero: Hero) {
    const now = this.now;
    const list = (this.ultimates.get(record.id) ?? []).filter(each => now - each.at <= TEAM_WINDOW);
    const partner = list.find(each => each.hero !== hero.id);
    list.push({ hero: hero.id, at: now });
    this.ultimates.set(record.id, list);
    if (!partner || now < (this.teamReady.get(record.id) ?? 0)) return;
    const other = this.heroes.get(partner.hero), body = this.body(record.id);
    if (!other || !body?.alive) return;
    this.teamReady.set(record.id, now + 8);
    hero.teamUltimates++; other.teamUltimates++;
    hero.style.earned(150, now); other.style.earned(150, now);
    this.score += 4000 * Math.max(1, RANKS.indexOf(record.rank ?? 'F'));
    const a = this.body(hero.id), b = this.body(other.id);
    this.push({ kind: 'team', text: 'TEAM ULTIMATE', sub: `${this.label(other)} & ${this.label(hero)}`, actor: record.id, enemy: record.def.id, hero: hero.id,
      x: body.x, y: body.y, z: body.z, points: [a ? { x: a.x, y: a.y, z: a.z } : { x: body.x, y: body.y, z: body.z }, b ? { x: b.x, y: b.y, z: b.z } : { x: body.x, y: body.y, z: body.z }] });
    const from = { x: body.x, y: body.y + 1, z: body.z };
    this.sim.damage(record.id, Math.round(body.maxHp * .06), hero.id, 'Team Ultimate');
    const blast = procMove('Team Ultimate', 260 + this.round * 30, { knockback: 10, stun: .6, style: 'bomb' });
    this.hordeInRadius(body.x, body.z, 8, slot => { this.passiveStrike(true, hero.id, this.horde.ids[slot], 'ultimate', blast, from); });
  }

  // ---- techniques ------------------------------------------------------------------
  private techniques: { kind: 'rend' | 'echo'; ultimate?: boolean; hero: string; target: string; at: Vec3; due: number; damage: number; radius: number }[] = [];
  /** The cuts burst and the afterimages strike, where their bodies are now. */
  private resolveTechniques() {
    for (let i = this.techniques.length - 1; i >= 0; i--) {
      const t = this.techniques[i];
      if (this.now < t.due) continue;
      this.techniques.splice(i, 1);
      const hero = this.heroes.get(t.hero);
      if (!hero || this.phase !== 'fight') continue;
      const at = this.positionOf(t.target) ?? t.at;
      const name = t.kind === 'rend' ? 'Rending Cut' : t.ultimate ? 'Ultimate Echo' : 'Afterimage';
      const move = procMove(name, t.damage, { knockback: t.kind === 'rend' ? 5.5 : t.ultimate ? 7 : 3, stun: .35, style: 'melee' });
      const from = { x: at.x, y: at.y + 1, z: at.z };
      for (const record of this.enemies.values()) {
        const body = this.body(record.id);
        if (body?.alive && Math.hypot(body.x - at.x, body.z - at.z) <= t.radius + (body.size ?? 1) * .45) this.passiveStrike(false, hero.id, record.id, 'heavy', move, from);
      }
      this.hordeInRadius(at.x, at.z, t.radius, slot => { this.passiveStrike(true, hero.id, this.horde.ids[slot], 'heavy', move, from); });
      this.push({ kind: t.kind, x: at.x, y: at.y + 1.1, z: at.z, radius: t.radius, value: t.ultimate ? 2 : 1, hero: hero.id });
    }
  }

  // ---- hazards ------------------------------------------------------------------
  /** From rank C up a boss's second wind - and an S boss's last stand - brings
   *  its element down out of the sky round the fighter, a strike every half
   *  second or so, each ringed on the floor a second before it lands: the
   *  fight turns, where every boss from F to S had been the same minute. */
  private wrath(record: EnemyRecord, stage: 1 | 2) {
    const rain = stage === 2 ? LAST_STAND_RAIN : WRATH[record.rank ?? 'F'];
    const base = record.def.moves.find(move => move.element) ?? record.def.moves[0];
    if (!rain || !base || this.quiet) return;
    this.startRain(record, { ...base, rain });
  }

  private startRain(record: EnemyRecord, move: EnemyMove) {
    const rain = move.rain!;
    this.rains.push({ source: record.id, enemy: record.def.id, move, rain, left: rain.count, next: this.now + (rain.start ?? .2) });
  }

  /** Rains call their strikes down, and strikes land - on fighters, and on
   *  whatever of the horde is standing under them too. */
  private hazards() {
    const now = this.now;
    for (const hero of this.heroes.values()) {
      const state = this.body(hero.id);
      if (!state) continue;
      if (hero.last) {
        const k = Math.min(1, DT * 8);
        hero.velocity.x += ((state.x - hero.last.x) / DT - hero.velocity.x) * k;
        hero.velocity.z += ((state.z - hero.last.z) / DT - hero.velocity.z) * k;
      }
      hero.last = { x: state.x, z: state.z };
    }
    const { halfX, halfZ } = this.sim.bounds;
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const raining = this.rains[i], rain = raining.rain;
      const source = this.body(raining.source);
      const record = this.enemies.get(raining.source);
      const hero = record?.target ? this.heroes.get(record.target) : this.lead;
      const player = hero ? this.standing(hero) : undefined;
      if (!source?.alive || !player || raining.left <= 0 || this.phase !== 'fight') { this.rains.splice(i, 1); continue; }
      while (raining.left > 0 && now >= raining.next) {
        const first = raining.left === rain.count;
        raining.left--; raining.next += rain.every;
        const r = first ? 0 : rain.spread * Math.sqrt(this.random()), a = this.random() * Math.PI * 2;
        const lead = first ? 0 : rain.lead * .6;
        const at = { x: Math.max(-halfX + 1, Math.min(halfX - 1, player.x + hero!.velocity.x * lead + Math.sin(a) * r)), y: player.grounded ? player.y : source.y,
          z: Math.max(-halfZ + 1, Math.min(halfZ - 1, player.z + hero!.velocity.z * lead + Math.cos(a) * r)) };
        const lands = now + rain.lead;
        this.strikes.push({ source: raining.source, enemy: raining.enemy, at, lands, radius: rain.radius,
          move: procMove(raining.move.name, rain.damage, { knockback: rain.knockback ?? 6, stun: .5, radius: rain.radius, style: 'bomb' }) });
        this.push({ kind: 'hazard', enemy: raining.enemy, x: at.x, y: at.y, z: at.z, radius: rain.radius, value: lands, text: raining.move.element ?? 'steel' });
      }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const strike = this.strikes[i];
      if (now < strike.lands) continue;
      this.strikes.splice(i, 1);
      if (this.phase !== 'fight') continue;
      for (const hero of this.heroes.values()) {
        const player = this.standing(hero);
        if (!player) continue;
        if (Math.hypot(player.x - strike.at.x, player.z - strike.at.z) > strike.radius + .35 || player.y - strike.at.y > 2.4) continue;
        this.sim.strike(strike.source, hero.id, 'heavy', strike.move, { x: strike.at.x, y: strike.at.y + .4, z: strike.at.z });
      }
      // The sky does not pick sides, and it does not spare the scenery.
      if (!strike.spare) this.hordeInRadius(strike.at.x, strike.at.z, strike.radius + .4, slot => {
        this.horde.damage(slot, strike.move.damage * 1.5);
      });
      this.smashAt(strike.at.x, strike.at.z, strike.radius, 999);
    }
  }

  // ---- the director ------------------------------------------------------------------
  private direct() {
    const now = this.now;
    if (this.slowUntil > 0 && now >= this.slowUntil) { this.timeScale = 1; this.slowUntil = -1; }
    for (const hero of this.heroes.values()) if (hero.reviveAt > 0 && now >= hero.reviveAt) this.rise(hero);
    for (const [id, record] of this.enemies) if (record.diedAt !== undefined && now - record.diedAt > 2.6) this.retire(id);
    if (this.phase === 'over' || this.phase === 'lobby') return;
    if (this.heroes.size > 1) this.rescues();
    if (this.phase === 'intro' && now >= this.phaseUntil) { this.enterPhase('fight'); this.startRound(); return; }
    if (this.phase !== 'fight') return;
    this.eclipse = Math.max(0, Math.min(1, this.eclipse + DT * (this.event?.kind === 'eclipse' ? .5 : -.35)));
    // Sealed and not yet answered: nothing moves on - no next round, no horde, no event.
    if (this.sealHold) return;
    if (this.packs.length) this.tallyPacks();
    if (this.roundState === 'horde') this.hordePhase();
    else if (this.roundState === 'entrance') this.entrance(now);
    else if (this.roundState === 'battle') this.battle(now);
    else if (this.fork(now)) this.afterRound();
    // The field is kept full through a dungeon's horde; its guardian comes
    // with a finite retinue. (With the dungeons off, as before: all round.)
    const field = this.hunting ? this.roundState === 'horde' : this.roundState !== 'interlude' || now - this.roundAt < INTERLUDE - 1;
    if (field && now >= this.roundAt) this.keepFieldFull(now);
    this.runEvent(now);
  }

  private release(id: string) { for (const hero of this.heroes.values()) hero.tokens.release(id); }
  /** Remove an encounter's transient state with its body, not at the end of
   * the whole run. Transformed forms also leave here, without a bossDown. */
  private retire(id: string) {
    this.sim.removePlayer(id); this.enemies.delete(id); this.release(id);
    this.bossBorn.delete(id); this.ultimates.delete(id); this.teamReady.delete(id); this.holds.delete(id);
    for (const hero of this.heroes.values()) hero.takenAt.delete(id);
  }
  /** A round's boss still in the fight. A fallen one's record is cleared a
   *  few seconds after it falls - a boss that transformed falls long before
   *  its round is over - so a missing record is a fallen boss, not a standing one. */
  private standingBoss(id: string) { const record = this.enemies.get(id); return !!record && record.diedAt === undefined; }

  private rescues() {
    for (const hero of this.heroes.values()) {
      if (!hero.down || hero.reviveAt > 0) continue;
      const fallen = this.body(hero.id);
      if (!fallen) continue;
      const helpers: Hero[] = [];
      for (const ally of this.heroes.values()) {
        if (ally === hero) continue;
        const state = this.standing(ally);
        if (state && Math.hypot(state.x - fallen.x, state.z - fallen.z) <= RESCUE_REACH) helpers.push(ally);
      }
      hero.rescue = helpers.length ? Math.min(1, hero.rescue + DT / RESCUE_SECONDS * (1 + (helpers.length - 1) * .5)) : Math.max(0, hero.rescue - DT / 6);
      if (hero.rescue < 1) continue;
      this.standUp(hero, .35);
      for (const ally of helpers) ally.style.bonus(40, this.now);
      this.push({ kind: 'rescued', text: `${helpers.map(ally => ally.name.toUpperCase()).join(' & ')} REVIVED ${hero.name.toUpperCase()}`, hero: hero.id, x: fallen.x, y: fallen.y, z: fallen.z });
    }
  }

  private standUp(hero: Hero, share: number) {
    hero.downAt = -1; hero.rescue = 0;
    const state = this.body(hero.id);
    if (state) this.sim.revive(hero.id, state.maxHp * share);
  }

  /** A round's boss, and in the Rift perhaps a second. */
  private drawSet(round: number): BossEntry[] {
    const first = drawBoss(round, this.bossesMet, this.random, this.partners);
    const set = [first];
    this.bossesMet.push(first.id);
    // (Depth 12: two at a time from rank A, before the Rift's own loops.)
    if (doubleBoss(round, this.random) || (!loopOf(round) && RANKS.indexOf(rankFor(round)) >= this.depthMods.doubleFrom)) {
      const second = drawBoss(round, this.bossesMet, this.random, this.partners);
      if (second.id !== first.id) { set.push(second); this.bossesMet.push(second.id); }
    }
    return set;
  }

  /** Every boss model the client should have loaded: this round's, the
   *  next round's and the elite hunt's champion. The last two are asked for
   *  once this round's boss has been out a few seconds (or is down): asked
   *  for as the round began, their loading - parsing, compiling, uploading -
   *  landed on the frames of its entrance. */
  upcoming(): string[] {
    const ids = new Set<string>();
    const settled = this.round === 0 || this.roundState === 'interlude' || (this.roundState === 'battle' && this.now - this.roundAt >= 4);
    for (const entry of [...this.pendingBoss, ...(settled ? this.nextBosses : [])]) ids.add(entry.id);
    if (this.nextChampion && settled) ids.add(this.nextChampion.id);
    for (const record of this.enemies.values()) if (record.diedAt === undefined) ids.add(record.def.id);
    for (const id of [...ids]) { const into = enemy(id).transform?.into; if (into) ids.add(into); }
    return [...ids];
  }

  /** A new round: its boss is chosen, and a rift tears open in front of the party. */
  private startRound() {
    this.round++;
    this.roundState = 'entrance'; this.roundAt = this.now;
    // The path the party took to get here is this round's.
    this.path = this.pathNext; this.pathNext = undefined;
    this.forkOffered = false; this.forkTaken = -1; this.forks = [];
    if (this.path === 'spring') for (const hero of this.heroes.values()) { if (hero.down) this.standUp(hero, 1); const state = this.body(hero.id); if (state?.alive) this.sim.heal(hero.id, state.maxHp); }
    const probe = this.probe.splice(0).filter(id => bossEntry(id));
    this.pendingBoss = probe.length ? [bossEntry(probe[0])!] : this.nextBosses.length ? this.nextBosses : this.drawSet(this.round);
    const first = this.pendingBoss[0];
    this.guardian = first?.universe;
    // The next round's, and this one's champion, drawn now for the loader.
    this.nextBosses = this.drawSet(this.round + 1);
    this.nextChampion = this.lesserBoss();
    const army = armyFor(first, this.round, this.armies, this.random);
    this.armies.push(army);
    this.escort = ESCORTS[army];
    const rank = rankFor(this.round);
    this.push({ kind: 'round', text: `ROUND ${this.round}`, sub: `RANK ${loopOf(this.round) ? 'RIFT' : rank}`, value: RANKS.indexOf(rank) });
    for (const hero of this.heroes.values()) if (hero.stats.waveMeter) this.sim.addMeter(hero.id, hero.stats.waveMeter);
    if (this.hunting) {
      this.roundState = 'horde'; this.roundAt = this.now;
      this.packs = []; this.packsSlain = 0; this.riftKills = 0;
      this.riftWant = Math.round(riftNeed(this.round) * partyScale(this.heroes.size).horde);
      this.hordeUntil = this.now + hordeLimit(this.round);
      // The round types (paths.ts): the bar is a ward held or a night survived, not kills.
      this.ward = undefined;
      if (this.path === 'ward') {
        const at = this.inView(this.anchor()) ?? this.spawnAround(7, .6, 9, this.anchor(), 2, false);
        this.ward = { x: at.x, z: at.z, radius: PATH_RULES.wardRadius, held: false };
        this.riftWant = PATH_RULES.wardSeconds; this.hordeUntil = this.now + PATH_RULES.wardSeconds * 3;
      }
      if (this.path === 'night') { this.riftWant = PATH_RULES.nightSeconds; this.hordeUntil = this.now + PATH_RULES.nightSeconds + 1; }
      this.elitesDue = this.round >= 2 ? [...ELITES_AT[rank]] : [];
      // An elite trial: more of them, through the middle of the bar.
      if (this.path === 'trial') { for (let i = 0; i < PATH_RULES.elites; i++) this.elitesDue.push(.35 + i * .22); this.elitesDue.sort((a, b) => a - b); }
      // Depth 3: one more, two-thirds through the bar.
      if (this.depthMods.elites && this.round >= 2) { this.elitesDue.push(.66); this.elitesDue.sort((a, b) => a - b); }
      if (this.path === 'treasure') this.later.push({ at: this.now + 1.5, run: () => this.layTreasure() });
      this.nextEvent = this.now + 18 + this.random() * 10;
      this.push({ kind: 'hunt', ...(this.path === 'ward' ? { text: 'HOLD THE WARD', sub: 'STAND IN IT UNTIL THEIR MASTER COMES FOR IT' }
        : this.path === 'night' ? { text: 'THE LONG NIGHT', sub: 'SURVIVE THEM ALL FOR A MINUTE' } : { text: 'THE HORDE COMES', sub: 'CUT THROUGH THEM TO DRAW OUT THEIR MASTER' }), value: this.riftWant });
      return;
    }
    this.openLair();
  }

  /** The boss's lair opens: a rift tears in front of the party. */
  private openLair() {
    this.roundState = 'entrance'; this.roundAt = this.now;
    const first = this.pendingBoss[0];
    const beside = this.anchor();
    // In front of the camera where there is one, else ahead of the fighter -
    // never behind: a boss stepping out behind the lens arrived unseen.
    this.riftAt = this.inView(beside) ?? this.spawnAround(12, .5, 15, beside, 2, false);
    if (first) this.push({ kind: 'rift', x: this.riftAt.x, y: this.riftAt.y, z: this.riftAt.z, radius: 3.4, enemy: first.id, value: RANKS.indexOf(first.rank) });
    // A round's event comes 12-20 s after its boss (from the second round on):
    // at 28-42 s most bosses were already down, and the first two places had none.
    this.nextEvent = this.now + 12 + this.random() * 8;
  }

  /** An elite pack comes for the party, out of a rift a little way off: its
   *  leader carries an affix (F and E meet only the plainer two). */
  private elitePack() {
    const round = Math.max(1, this.round), rank = RANKS.indexOf(rankFor(round)), party = partyScale(this.heroes.size);
    const beside = this.anchor();
    const centre = this.spawnAround(16, 1.2, 22, beside, 2);
    const id = ++this.packSerial;
    const pool: readonly Affix[] = rank <= 1 ? ['molten', 'hasted'] : AFFIXES;
    const affix = pool[Math.floor(this.random() * pool.length)];
    const size = Math.round((4 + rank * .5 + this.random() * 2) * party.horde);
    let placed = 0, leader: number | undefined;
    for (let i = 0; i < size; i++) {
      const head = i === 0;
      const slot = this.spawnGrunt(this.pickKind(this.escort, false), this.scatter(centre, 1.4 + size * .14), head, beside,
        { pack: id, dormant: false, affix: head ? AFFIXES.indexOf(affix) + 1 : 0, hasted: affix === 'hasted' });
      if (slot === undefined) continue;
      placed++;
      if (head) leader = this.horde.serial[slot];
    }
    if (!placed) return;
    this.packs.push({ id, x: centre.x, z: centre.z, size: placed, left: placed, elite: true, awake: true, affix, leader, nextCast: this.now + 3 });
    this.push({ kind: 'spawn', x: centre.x, y: 0, z: centre.z, radius: 2.6, value: placed });
    this.push({ kind: 'elite', text: `${AFFIX_NAMES[affix]} ELITE`, x: centre.x, y: 0, z: centre.z, value: AFFIXES.indexOf(affix) + 1 });
  }

  /** A dungeon's horde: elite packs as its bar fills, and at full its guardian -
   *  the horde (but what is on the party already) burns back into the rift. */
  private hordePhase() {
    // The round types fill the bar with time: a night by the clock, a ward while anyone stands in it
    // (giving it back a quarter as fast while no one does).
    if (this.path === 'night') this.riftKills = Math.min(this.riftWant, this.riftKills + DT);
    if (this.path === 'ward' && this.ward) {
      const ward = this.ward;
      ward.held = [...this.heroes.values()].some(hero => { const body = hero.joining ? undefined : this.standing(hero); return !!body && Math.hypot(body.x - ward.x, body.z - ward.z) <= ward.radius; });
      this.riftKills = Math.max(0, Math.min(this.riftWant, this.riftKills + (ward.held ? DT : -DT * .25)));
    }
    const progress = this.riftKills / Math.max(1, this.riftWant);
    while (this.elitesDue.length && progress >= this.elitesDue[0]) { this.elitesDue.shift(); this.elitePack(); }
    if (progress < 1 && this.now < this.hordeUntil) return;
    this.push({ kind: 'lair', text: 'THE GUARDIAN COMES', sub: progress < 1 ? 'IT WILL NOT WAIT ANY LONGER' : 'THE HORDE FALLS BACK FOR ITS MASTER' });
    // A ward held pays a chest for each fighter, where it stood.
    if (this.path === 'ward' && this.ward && progress >= 1) {
      for (let i = 0; i < this.heroes.size; i++) this.orb('chest', 1, { x: this.ward.x, y: .2, z: this.ward.z });
      this.push({ kind: 'bonus', text: 'THE WARD HELD', sub: `· ${this.heroes.size === 1 ? 'A CHEST' : `${this.heroes.size} CHESTS`}` });
    }
    this.ward = undefined;
    if (this.event) {
      const ended = this.event; this.event = undefined;
      this.push({ kind: 'event-end', text: EVENT_NAMES[ended.kind], sub: ended.kind === 'hoarder' ? (this.hoarder ? 'IT GOT AWAY' : 'CAUGHT — THE LOOT IS YOURS') : 'SURVIVED' });
      if (ended.kind === 'hoarder') this.hoarder = 0;
    }
    const breath = this.depthMods.roundHeal ? GUARDIAN_HEAL[rankFor(Math.max(1, this.round))] * this.depthMods.heal : 0;
    for (const hero of this.heroes.values()) { const state = this.standing(hero); if (state && breath) this.sim.heal(hero.id, state.maxHp * breath); }
    const h = this.horde;
    for (let i = 0; i < h.capacity; i++) {
      if (!h.isAlive(i) || h.pack[i] >= 0 || h.flags[i] & GF.ELITE) continue;
      const near = this.nearestHero(h.x[i], 0, h.z[i], 7);
      if (!near) h.recall(i);
    }
    this.openLair();
  }

  /** The packs, every tick while any stand: a roused pack rouses those
   *  beside it, and each one down is paid for. */
  private tallyPacks() {
    for (const id of this.horde.roused()) {
      const pack = this.packs.find(each => each.id === id);
      if (!pack) continue;
      pack.awake = true;
      pack.nextCast = Math.max(pack.nextCast, this.now + 2.5);
      for (const other of this.packs) if (!other.awake && other.left > 0 && Math.hypot(other.x - pack.x, other.z - pack.z) < PACK_CHAIN) this.horde.wake(other.id);
    }
    for (const pack of this.packs) if ((pack.affix === 'storm' || pack.affix === 'frost') && pack.awake && pack.left > 0) this.eliteCast(pack);
    if (this.sim.tick % 6 === 0) for (const pack of this.packs) {
      if (pack.left <= 0) continue;
      const { left } = this.horde.packCount(pack.id);
      if (left > 0) { pack.left = left; continue; }
      pack.left = 0; this.packsSlain++;
      this.score += (pack.elite ? 2500 : 1000) * Math.max(1, RANKS.indexOf(rankFor(Math.max(1, this.round))));
      // A health globe where it fell, as Diablo pays a pack.
      this.orb('heal', pack.elite ? .1 : .06, { x: pack.x, y: .5, z: pack.z });
      this.push({ kind: 'pack', text: pack.elite ? 'ELITE PACK SLAIN' : 'PACK SLAIN', sub: `${this.packsSlain} / ${this.packs.length}`, value: this.packsSlain, radius: this.packs.length, x: pack.x, y: 0, z: pack.z });
    }
  }

  /** A Stormcaller's or Frostcaller's call: its element down round the
   *  nearest fighter within reach, a strike a quarter-second apart, each
   *  ringed a second ahead (the bosses' rains, on a smaller scale). */
  private eliteCast(pack: SurvivalGame['packs'][number]) {
    const now = this.now, h = this.horde;
    if (now < pack.nextCast || pack.leader === undefined) return;
    const slot = h.slotOf(pack.leader);
    if (slot === undefined || !h.isAlive(slot) || h.dormant[slot]) return;
    const near = this.nearestHero(h.x[slot], 0, h.z[slot], 18);
    if (!near) { pack.nextCast = now + 1; return; }
    const storm = pack.affix === 'storm', round = Math.max(1, this.round);
    pack.nextCast = now + (storm ? 4.2 : 5.4);
    const count = (storm ? 3 : 2) + (round >= 9 ? 1 : 0), radius = storm ? 1.7 : 2.2;
    const { halfX, halfZ } = this.sim.bounds;
    for (let i = 0; i < count; i++) {
      const lead = i ? .7 : 0, r = i ? 1 + this.random() * 2.2 : 0, a = this.random() * Math.PI * 2;
      const at = { x: Math.max(-halfX + 1, Math.min(halfX - 1, near.state.x + near.hero.velocity.x * lead + Math.sin(a) * r)), y: near.state.grounded ? near.state.y : 0,
        z: Math.max(-halfZ + 1, Math.min(halfZ - 1, near.state.z + near.hero.velocity.z * lead + Math.cos(a) * r)) };
      const lands = now + 1.05 + i * .25;
      this.strikes.push({ source: h.ids[slot], enemy: GRUNTS[h.kind[slot]].id, at, lands, radius, spare: true,
        move: procMove(storm ? 'Stormcall' : 'Frostcall', 16 + round * 2.4, { knockback: storm ? 5 : 2, stun: storm ? .45 : 1.1, radius, style: 'bomb' }) });
      this.push({ kind: 'hazard', enemy: GRUNTS[h.kind[slot]].id, x: at.x, y: at.y, z: at.z, radius, value: lands, text: AFFIX_ELEMENT[pack.affix!] });
    }
  }
  /** A molten elite falls, and the ground where it fell erupts a moment later. */
  private erupt(slot: number) {
    const h = this.horde, pack = this.packs.find(each => each.id === h.pack[slot]);
    if (pack?.affix !== 'molten' || pack.leader !== h.serial[slot]) return;
    const at = { x: h.x[slot], y: 0, z: h.z[slot] }, lands = this.now + 1.1, radius = 3.4, round = Math.max(1, this.round);
    this.strikes.push({ source: h.ids[slot], enemy: GRUNTS[h.kind[slot]].id, at, lands, radius, spare: true,
      move: procMove('Molten Burst', 30 + round * 3.5, { knockback: 8, stun: .6, radius, style: 'bomb' }) });
    this.push({ kind: 'hazard', enemy: GRUNTS[h.kind[slot]].id, x: at.x, y: 0, z: at.z, radius, value: lands, text: 'magma' });
  }

  private entrance(now: number) {
    if (now - this.roundAt < RIFT_OPENS || !this.pendingBoss.length) return;
    const at = this.riftAt ?? this.spawnAround(12, .5, 15, this.anchor(), 2);
    this.roundBosses = [];
    let offset = 0;
    for (const entry of this.pendingBoss.splice(0)) {
      const def = enemy(entry.id);
      const spot = this.clear({ x: at.x + offset, y: 0, z: at.z }) ?? at;
      offset += 3.5;
      const id = this.spawnBoss(def, entry, spot);
      if (!id) continue;
      this.roundBosses.push(id);
      this.push({ kind: 'boss', text: def.name.toUpperCase(), sub: entry.epithet, enemy: def.id, boss: true, rank: entry.rank, universe: entry.universe,
        value: RANKS.indexOf(entry.rank), actor: id, x: spot.x, y: spot.y, z: spot.z });
    }
    // Its army holds its blows while it steps out: the fight's breath to look at it.
    if (this.roundBosses.length) this.horde.holdUntil = now + 1.8;
    // His army comes through behind him.
    this.escortQueue = this.escortTotal = Math.round((10 + Math.min(14, this.round * 1.5)) * partyScale(this.heroes.size).horde);
    this.roundState = 'battle'; this.roundAt = now;
  }

  private battle(now: number) {
    // The escort pours out of the rift once the boss has made its entrance -
    // behind it, as the fighters see it, so the army never stands between the
    // lens and the boss it came with.
    if (this.escortQueue > 0 && this.riftAt && !this.quiet && now - this.roundAt >= ESCORT_DELAY && now >= this.nextEscort) {
      const rift = this.riftAt, beside = this.anchor(), hero = beside ? this.body(beside.id) : undefined;
      const away = hero ? Math.atan2(rift.x - hero.x, rift.z - hero.z) : 0;
      if (this.escortQueue === this.escortTotal) this.push({ kind: 'spawn', x: rift.x + Math.sin(away) * 3, y: 0, z: rift.z + Math.cos(away) * 3, radius: 3.2, value: this.escortQueue });
      const burst = Math.min(this.escortQueue, 3);
      for (let i = 0; i < burst; i++) {
        const back = 2.5 + this.random() * 3, side = (this.random() - .5) * 8;
        const at = { x: rift.x + Math.sin(away) * back + Math.cos(away) * side, y: 0, z: rift.z + Math.cos(away) * back - Math.sin(away) * side };
        this.spawnGrunt(this.pickKind(this.escort, true), this.clear(at) ?? this.scatter(rift, 2.2), false);
      }
      this.escortQueue -= burst;
      this.nextEscort = now + .12;
    }
    if (this.roundBosses.length && !this.roundBosses.some(id => this.standingBoss(id))) {
      this.roundState = 'interlude'; this.roundAt = now;
      // The boss down, its round's event is over too (it ran on into the lull).
      if (this.event) {
        const ended = this.event; this.event = undefined; this.nextEvent = now + 26;
        this.push({ kind: 'event-end', text: EVENT_NAMES[ended.kind], sub: ended.kind === 'hoarder' ? (this.hoarder ? 'IT GOT AWAY' : 'CAUGHT — THE LOOT IS YOURS') : 'SURVIVED' });
        if (ended.kind === 'hoarder') this.hoarder = 0;
      }
      if (this.round === FINAL_ROUND && !this.sealed) this.seal();
    }
  }

  // ---- the road's fork (paths.ts) ----------------------------------------------------
  private fork(now: number) {
    const since = now - this.roundAt;
    // (The old road has no fork; nor does a probe's.)
    if (!this.hunting || this.quiet) return since >= INTERLUDE;
    if (!this.forkOffered) { if (since >= 2.8) this.offerForks(); return false; }
    if (this.forks.length) { this.watchForks(now); return false; }
    return this.forkTaken >= 0 && now - this.forkTaken >= 1.2;
  }
  /** Three rifts open in front of the party, each saying what is behind it
   *  (a cursed door only from the third round). What is left of the horde
   *  goes back through its own. */
  private offerForks() {
    this.forkOffered = true;
    let hurt = false, critical = false;
    for (const hero of this.heroes.values()) {
      const state = this.body(hero.id);
      if (hero.down || state && state.hp < state.maxHp * .5) critical = true;
      if (state && state.hp < state.maxHp) hurt = true;
    }
    const kinds = drawPaths(this.round, this.depthMods.springs, this.path, critical ? 'critical' : hurt ? 'hurt' : 'healthy', this.random);
    const beside = this.anchor(), hero = beside ? this.body(beside.id) : undefined;
    const view = lens(), yaw = view ? Math.atan2(view.fx, view.fz) : hero?.yaw ?? 0;
    const { halfX, halfZ } = this.sim.bounds;
    this.forks = [];
    kinds.forEach((kind, i) => {
      const side = (i - (kinds.length - 1) / 2) * 5.2;
      for (let attempt = 0; attempt < 6; attempt++) {
        const reach = 7.5 - attempt * .6, spread = side * (1 - attempt * .08);
        const at = { x: Math.max(-halfX + 2, Math.min(halfX - 2, (hero?.x ?? 0) + Math.sin(yaw) * reach + Math.cos(yaw) * spread)), y: 0,
          z: Math.max(-halfZ + 2, Math.min(halfZ - 2, (hero?.z ?? 0) + Math.cos(yaw) * reach - Math.sin(yaw) * spread)) };
        const placed = this.clear(at);
        if (placed) { this.forks.push({ kind, x: placed.x, z: placed.z, votes: 0 }); break; }
      }
    });
    if (!this.forks.length) { this.forkTaken = this.now; return; }
    this.forkUntil = this.now + PATH_SECONDS;
    for (let i = 0; i < this.horde.capacity; i++) if (this.horde.isAlive(i)) this.horde.recall(i);
    this.push({ kind: 'paths', text: this.forks.map(each => each.kind).join(','), points: this.forks.map(each => ({ x: each.x, y: 0, z: each.z })), value: this.forkUntil });
  }
  /** Who stands in which rift: all of the party in one takes it (one fighter
   *  alone, at once); when the rift will not wait, the most of them does, or
   *  the rift chooses. Bots take one after a breath. */
  private watchForks(now: number) {
    const standing = [...this.heroes.values()].filter(hero => this.standing(hero));
    for (const fork of this.forks) fork.votes = 0;
    for (const hero of standing) {
      const state = this.body(hero.id)!;
      const fork = this.forks.find(each => Math.hypot(each.x - state.x, each.z - state.z) <= PATH_REACH);
      if (fork) fork.votes++;
    }
    const top = [...this.forks].sort((a, b) => b.votes - a.votes)[0];
    if (standing.length && top.votes >= standing.length) return this.takeFork(top.kind);
    if (this.autoLearnOn && now - (this.forkUntil - PATH_SECONDS) > 1.5) return this.takeFork(this.forks[Math.floor(this.random() * this.forks.length)].kind);
    if (now >= this.forkUntil) this.takeFork(top.votes > 0 ? top.kind : this.forks[Math.floor(this.random() * this.forks.length)].kind);
  }
  private takeFork(kind: PathKind) {
    const fork = this.forks.find(each => each.kind === kind);
    this.pathNext = kind; this.forks = []; this.forkTaken = this.now;
    this.push({ kind: 'path', text: kind, x: fork?.x, y: 0, z: fork?.z });
  }
  /** A treasure path's chests, laid about the place, away from the party. */
  private layTreasure() {
    for (let i = 0; i < PATH_RULES.chests; i++) {
      const at = this.spawnAround(12 + i * 4, 3, 22 + i * 4, this.anchor(), 1);
      this.orb('chest', 1, at);
    }
    this.push({ kind: 'bonus', text: 'TREASURE PATH', sub: `· ${PATH_RULES.chests} CHESTS IN THIS PLACE` });
  }

  /** After a boss: teleported into the next dungeon (on the old road, only
   *  when the place changes). */
  private afterRound() {
    const next = this.dungeon(this.round + 1).location.stage;
    if (next !== this.sim.stage) {
      this.travelTo = next;
      this.enterPhase('travel');
      return;
    }
    this.startRound();
  }

  /** The next stage's world is ready: move the fight there. */
  arrive(collision?: CollisionWorld) {
    if (this.phase !== 'travel' || !this.travelTo) return;
    const stage = this.travelTo;
    this.travelTo = undefined;
    this.collision = collision;
    for (const id of this.enemies.keys()) this.retire(id);
    this.horde.clear(); this.packs = [];
    this.orbs.length = 0; this.rains.length = 0; this.strikes.length = 0; this.event = undefined; this.eclipse = 0; this.later.length = 0; this.zones.length = 0;
    this.signatures.clear(); this.ultimates.clear(); this.teamReady.clear();
    this.sim.setStage(stage, collision);
    this.horde.setWorld(riftWorld(stage));
    this.loadProps(stage);
    let seat = 0;
    for (const hero of this.heroes.values()) {
      this.sim.place(hero.id, this.startPoint(seat++), 0); hero.lastSafe = undefined;
      if (hero.down) this.standUp(hero, .5);
    }
    const { location } = this.dungeon(this.round + 1);
    this.push({ kind: 'location', text: location.name, sub: location.subtitle });
    this.placesSeen.add(location.id);
    this.places.begin(this.quiet ? '' : location.id);
    this.enterPhase('intro', 3);
  }

  /** How many of the horde the director keeps on the field right now. */
  private crowdWanted(now: number) {
    const minutes = (now - this.startedAt) / 60;
    const loop = loopOf(Math.max(1, this.round));
    const rank = rankFor(Math.max(1, this.round));
    const base = Math.min(135, 26 + this.round * 4.2 + minutes * 2.8 + loop * 14) * RANK_HORDE[rank];
    // The faster they are cut down, the more come: a strong build fights a
    // bigger horde instead of an emptier screen (up to half as many again).
    const pressure = 1 + Math.min(.5, Math.max(0, this.killRate() - 2) * .06);
    return Math.round(Math.min(this.horde.capacity - 40, base * pressure * partyScale(this.heroes.size).horde * this.depthMods.crowd));
  }
  /** Grunts killed a second, over the last few seconds. */
  private killRate() {
    const now = this.now;
    while (this.recentKills.length && now - this.recentKills[0] > 6) this.recentKills.shift();
    return this.recentKills.length / 6;
  }
  private readonly recentKills: number[] = [];
  /** Kills in the last half-second, and by whom (view.slain). */
  private readonly slainLog: { serial: number; code: number; x: number; z: number; at: number }[] = [];
  private slainSerial = 0;
  /** A kill logged for its killer's kill effect (none for a kill no fighter made). */
  private slay(killerId: string | undefined, x: number, z: number, big: boolean) {
    if (!killerId) return;
    let seat = 0;
    for (const id of this.heroes.keys()) { if (id === killerId) break; seat++; }
    if (seat >= this.heroes.size) return;
    const log = this.slainLog;
    while (log.length && (this.now - log[0].at > SLAIN_WINDOW || log.length >= SLAIN_MAX)) log.shift();
    log.push({ serial: ++this.slainSerial, code: seat + (big ? 8 : 0), x: Math.round(x * 10), z: Math.round(z * 10), at: this.now });
  }
  /** When each fighter's next dodge may be passed on to be heard. */
  private readonly dodgeHeard = new Map<string, number>();
  /** Blows heard lately, by striker and move (see `step`). */
  private readonly struck = new Map<string, { at: number; n: number }>();

  /** The horde never thins out for long: squads keep coming out of rifts. */
  /** From rank A on, now and then an elite walks with a squad: harder, and it pays in treasure. */
  private eliteChance() {
    const rank = RANKS.indexOf(rankFor(Math.max(1, this.round))), base = rank >= 5 ? (rank === 6 ? .06 : .035) + loopOf(Math.max(1, this.round)) * .015 : 0;
    // (Depth 14: twice as many, and some from the road's first ranks.)
    return this.depthMods.eliteChance > 1 ? Math.max(base, .015) * this.depthMods.eliteChance : base;
  }

  private keepFieldFull(now: number) {
    if (this.quiet || now < this.nextSquad) return;
    const want = Math.round(this.crowdWanted(now) * (this.path === 'night' && this.roundState === 'horde' ? PATH_RULES.nightCrowd : 1));
    const alive = this.horde.alive;
    if (alive >= want) { this.nextSquad = now + .5; return; }
    const beside = this.anchor();
    const rank = RANKS.indexOf(rankFor(Math.max(1, this.round)));
    const size = Math.min(want - alive, 3 + Math.floor(this.random() * 4) + Math.floor(this.round / 3) + (rank === 6 ? 3 : rank === 5 ? 1 : 0) + partyScale(this.heroes.size).squad);
    const centre = this.spawnAround(14, 1.6, 21, beside, 1);
    this.push({ kind: 'spawn', x: centre.x, y: centre.y, z: centre.z, radius: 1.8 + size * .2, value: size });
    const elites = this.eliteChance();
    for (let i = 0; i < size; i++) this.spawnGrunt(this.pickKind(this.escort, false), this.scatter(centre, 1.5 + size * .15), this.random() < elites, beside);
    this.nextSquad = now + (alive < want * .5 ? .45 : .9 + this.random() * .6);
  }

  private pickKind(escort: Escort, fromRift: boolean): number {
    const roll = this.random();
    // More of the heavy hitters as the ranks climb: a fighter mid-swing shrugs
    // off the fodder's chip, not a brute's blow.
    const bruteShare = this.round >= 2 ? Math.min(.17, .03 + this.round * .01) : 0;
    const gunnerShare = Math.min(.24, .12 + this.round * .008);
    // Shields, healers, summoners, snipers and divers, from the second round on.
    const specialShare = escort.specials && this.round >= 2 ? Math.min(.14, .05 + this.round * .01) : 0;
    const table = roll < bruteShare && !fromRift ? escort.brutes : roll < bruteShare + gunnerShare ? escort.gunners
      : roll < bruteShare + gunnerShare + specialShare ? escort.specials! : escort.fodder;
    const total = table.reduce((sum, [, w]) => sum + w, 0);
    let r = this.random() * total;
    const id = table.find(([, w]) => (r -= w) <= 0)?.[0] ?? table[0][0];
    return GRUNT_INDEX.get(id) ?? 0;
  }

  private scatter(centre: Vec3, spread: number): Vec3 {
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = this.random() * Math.PI * 2, r = Math.sqrt(this.random()) * spread;
      const at = this.clear({ x: centre.x + Math.sin(a) * r, y: 0, z: centre.z + Math.cos(a) * r });
      if (at) return at;
    }
    return centre;
  }

  /** Probes (`?kinds=`): a few of each named grunt kind ahead of the lead fighter, to look at. */
  probeSpawn(kinds: readonly string[], each = 2) {
    const lead = this.lead, body = lead ? this.body(lead.id) : undefined;
    if (!body || this.phase !== 'fight') return 0;
    let n = 0;
    kinds.forEach((id, i) => {
      const type = GRUNT_INDEX.get(id);
      if (type === undefined) return;
      for (let k = 0; k < each; k++) {
        const a = (i / Math.max(1, kinds.length) - .5) * 1.6 + k * .18, r = 8 + k * 1.5;
        const at = this.clear({ x: body.x + Math.sin(body.yaw + a) * r, y: 0, z: body.z + Math.cos(body.yaw + a) * r }) ?? { x: body.x, y: 0, z: body.z + r };
        if (this.spawnGrunt(type, at, false, lead) !== undefined) n++;
      }
    });
    return n;
  }

  /** One grunt, scaled to the run: health and blows climb with the rounds. */
  private spawnGrunt(type: number, at: Vec3, elite: boolean, beside?: Hero, pack?: { pack: number; dormant: boolean; affix?: number; hasted?: boolean }, hasted = false) {
    const loop = loopOf(Math.max(1, this.round));
    const round = Math.max(1, this.round);
    const party = partyScale(this.heroes.size);
    const enraged = this.eclipse > .5;
    const heroes = [...this.heroes.keys()];
    const target = beside ? heroes.indexOf(beside.id) : -1;
    const player = beside ? this.body(beside.id) : this.lead ? this.body(this.lead.id) : undefined;
    const slot = this.horde.spawn(type, at.x, at.z, {
      // Past S the Rift compounds: every loop is a harder one than the last.
      hp: (1 + (round - 1) * .15) * GRUNT_RANK_HP[rankFor(round)] * Math.pow(1.3, loop) * party.hp * (pack ? PACK_HP : 1) * (this.path === 'cursed' ? PATH_RULES.cursedHorde : 1) * this.depthMods.hordeHp,
      // Their blows climb with the rank as well as the round: S is the most dangerous stretch of the road.
      // (Round 1's a little softer: a fighter with nothing yet fell to a quarter of their health to its crowd.)
      damage: (.5 + (round - 1) * .05) * GRUNT_RANK_DAMAGE[rankFor(round)] * Math.pow(1.18, loop) * (enraged ? 1.25 : 1) * (round === 1 ? .88 : 1) * (pack ? PACK_DAMAGE : 1) * (this.path === 'cursed' ? PATH_RULES.cursedHorde : 1) * this.depthMods.hordeDamage,
      speed: Math.min(1.25, 1 + (round - 1) * .012) * (enraged ? 1.15 : 1) * (pack?.hasted || hasted ? 1.3 : 1) * this.depthMods.hordeSpeed,
      elite, target, yaw: pack?.dormant ? this.random() * Math.PI * 2 : player ? Math.atan2(player.x - at.x, player.z - at.z) : 0,
      pack: pack?.pack, dormant: pack?.dormant, affix: pack?.affix,
    });
    if (slot !== undefined && enraged) this.horde.flags[slot] |= GF.ENRAGED;
    return slot;
  }

  private spawnBoss(def: EnemyDefinition, entry: BossEntry, at: Vec3): string | undefined {
    if (this.sim.actors.size >= CAPACITY) return undefined;
    const id = `e${++this.serial}`;
    const facing = this.anchor(), player = (facing ? this.body(facing.id) : undefined) ?? { x: 0, z: 0 };
    const loop = loopOf(Math.max(1, this.round));
    const party = partyScale(this.heroes.size);
    const surge = Math.pow(1.08, loop);
    // The first boss of a run meets a fighter with nothing yet: gentler (with
    // round 1's openers the run's lowest health came in its first minute).
    const opener = this.round === 1 ? .8 : 1;
    const cursed = this.path === 'cursed' ? PATH_RULES.cursedBoss : 1;
    const hp = RANK_HP[entry.rank] * (def.hp / Math.max(1, def.role === 'boss' ? 7000 : 2200)) ** .35 * (1 + loop * .45) * party.boss * surge * opener * cursed * this.depthMods.bossHp;
    const damage = RANK_DAMAGE[entry.rank] * (1 + loop * .2) * surge * (this.round === 1 ? .7 : 1) * cursed * this.depthMods.bossDamage;
    this.addActor(id, def, at, player, hp, damage, true);
    if (this.probeBossHp < 1) this.sim.actors.get(id)!.state.hp = Math.round(hp * this.probeBossHp);
    this.enemies.set(id, { id, def, brain: new EnemyBrain(id, def, this.now + ENTRANCE_HOLD, this.random), boss: true, champion: false, rank: entry.rank, entry });
    this.bossBorn.set(id, this.now);
    for (const hero of this.heroes.values()) hero.takenAt.set(id, this.body(hero.id)?.damageTaken ?? 0);
    const body = this.body(id);
    if (body && !this.quiet) this.signatures.begin({ id, enemy: def.id, name: def.name, state: body, awakened: false, since: this.now, size: def.size ?? 1, height: def.height, rank: entry.rank });
    return id;
  }

  /** A champion: a lesser boss walking the field with its own bar. */
  private spawnChampion(def: EnemyDefinition, at: Vec3, rank: Rank): string | undefined {
    if (this.sim.actors.size >= CAPACITY) return undefined;
    const id = `e${++this.serial}`;
    const facing = this.anchor(), player = (facing ? this.body(facing.id) : undefined) ?? { x: 0, z: 0 };
    const party = partyScale(this.heroes.size);
    const hp = RANK_HP[rank] * .55 * party.elite * this.depthMods.bossHp;
    this.addActor(id, def, at, player, hp, RANK_DAMAGE[rank] * .9 * this.depthMods.bossDamage, false);
    this.enemies.set(id, { id, def, brain: new EnemyBrain(id, def, this.now + 1, this.random), boss: false, champion: true, rank });
    return id;
  }

  private addActor(id: string, def: EnemyDefinition, at: Vec3, player: { x: number; z: number }, hp: number, damage: number, boss: boolean) {
    if (def.rival) {
      this.sim.addPlayer(id, def.rival, def.name, true, at);
      this.sim.setTeam(id, RIFT);
      this.sim.setMaxHp(id, Math.round(hp));
      this.sim.setMods(id, { damageOut: damage * .55, speed: 1 });
      return;
    }
    this.sim.addCombatant(id, { team: RIFT, enemy: def.id, name: def.name, kit: kitOf(def), maxHp: Math.round(hp), size: def.size,
      poise: def.poise ? def.poise * (boss ? 1.4 : 1) : undefined, breaker: def.breaker ?? true,
      spawn: at, yaw: Math.atan2(player.x - at.x, player.z - at.z), armour: true, anchored: def.anchored, girth: def.girth,
      mods: { damageOut: damage, speed: def.speed, damageIn: def.damageIn ?? 1, knockbackIn: def.knockbackIn ?? 1, stunIn: def.stunIn ?? 1 } });
  }

  // ---- events -------------------------------------------------------------------------
  private runEvent(now: number) {
    const event = this.event;
    if (!event) {
      if (this.roundState !== (this.hunting ? 'horde' : 'battle') || now < this.nextEvent || this.quiet || this.round < 2 || this.eventRound === this.round) return;
      // Not into a fight about to end: every boss of the round still has more
      // than 45% of its health. (A dungeon's events run in its horde, before
      // its guardian; this is the old road's.)
      if (!this.hunting && (!this.roundBosses.some(id => this.standingBoss(id)) || this.roundBosses.some(id => { const body = this.body(id); return !!body && body.alive && body.hp < body.maxHp * .45; }))) return;
      this.eventRound = this.round;
      const pool: EventKind[] = ['surge', 'siege', 'eclipse', 'storm', 'elites', 'hoarder'];
      // (No champion in the last round: the run is sealed on its S-rank boss, not on an elite. And no
      // storm before rank D: on an E boss's round it killed a new fighter at level 11.)
      const allowed = pool.filter(kind => kind !== this.lastEvent && (kind !== 'siege' || this.round >= 2) && (kind !== 'elites' || (this.round >= 2 && this.round !== FINAL_ROUND)) && (kind !== 'storm' || this.round >= 5));
      const kind = allowed[Math.floor(this.random() * allowed.length)];
      const total = { surge: 22, siege: 26, eclipse: 30, storm: 20, elites: 40, hoarder: 25 }[kind];
      this.event = { kind, until: now + total, total, next: now, side: this.random() * Math.PI * 2, spawned: 0 };
      this.lastEvent = kind;
      this.push({ kind: 'event', text: EVENT_NAMES[kind], sub: EVENT_SUBS[kind], value: total });
      this.startEvent(this.event);
      return;
    }
    if (now >= event.until) {
      this.event = undefined;
      this.nextEvent = now + 26 + this.random() * 16;
      // A hoarder's chase ends caught or not; every other event is survived.
      const outcome = event.kind === 'hoarder' ? (this.hoarder ? 'IT GOT AWAY' : 'CAUGHT — THE LOOT IS YOURS') : 'SURVIVED';
      this.push({ kind: 'event-end', text: EVENT_NAMES[event.kind], sub: outcome });
      if (event.kind === 'hoarder') this.hoarder = 0;
      return;
    }
    if (event.kind === 'surge' && now >= event.next && event.spawned < this.surgeSize()) {
      // A wall of them from one side, a rank at a time.
      event.next = now + .35;
      const beside = this.anchor(), hero = beside ? this.body(beside.id) : undefined;
      if (!hero) return;
      // The wall comes from one side, held inside the field: a line of them
      // 19 m out, or as far as the field goes that way.
      const { halfX, halfZ } = this.sim.bounds;
      const reach = Math.min(19, Math.max(8, Math.min((halfX - 2 - Math.abs(hero.x)) / Math.max(.2, Math.abs(Math.sin(event.side))), (halfZ - 2 - Math.abs(hero.z)) / Math.max(.2, Math.abs(Math.cos(event.side))))));
      const cx = hero.x + Math.sin(event.side) * reach, cz = hero.z + Math.cos(event.side) * reach;
      const across = event.side + Math.PI / 2;
      for (let i = 0; i < 7; i++) {
        const t = (i / 6 - .5) * 18;
        const at = { x: Math.max(-halfX + 1.5, Math.min(halfX - 1.5, cx + Math.sin(across) * t)), y: 0, z: Math.max(-halfZ + 1.5, Math.min(halfZ - 1.5, cz + Math.cos(across) * t)) };
        const placed = this.clear(at) ?? this.scatter(at, 2.5);
        if (this.spawnGrunt(this.pickKind(this.escort, true), placed, false, beside) !== undefined) event.spawned++;
      }
    }
    if (event.kind === 'storm' && now >= event.next) {
      event.next = now + .32;
      const heroes = [...this.heroes.values()].filter(hero => this.standing(hero));
      const hero = heroes[Math.floor(this.random() * heroes.length)];
      const state = hero ? this.body(hero.id) : undefined;
      if (!state) return;
      const { halfX, halfZ } = this.sim.bounds;
      const a = this.random() * Math.PI * 2, r = 2 + this.random() * 13;
      const at = { x: Math.max(-halfX + 1, Math.min(halfX - 1, state.x + Math.sin(a) * r)), y: 0, z: Math.max(-halfZ + 1, Math.min(halfZ - 1, state.z + Math.cos(a) * r)) };
      const lands = now + 1.1;
      this.strikes.push({ source: 'rift', enemy: 'rift', at, lands, radius: 2.4, move: procMove('Rift Strike', 70 * (1 + this.round * .05), { knockback: 8, stun: .5, radius: 2.4, style: 'bomb' }) });
      this.push({ kind: 'hazard', enemy: 'rift', x: at.x, y: at.y, z: at.z, radius: 2.4, value: lands, text: 'dark' });
    }
  }
  private surgeSize() { return Math.round((44 + this.round * 3.5) * partyScale(this.heroes.size).horde); }

  private startEvent(event: RunningEvent) {
    const beside = this.anchor(), hero = beside ? this.body(beside.id) : undefined;
    if (!hero) return;
    if (event.kind === 'siege') {
      const cx = hero.x + Math.sin(event.side) * 17, cz = hero.z + Math.cos(event.side) * 17;
      const brutes = Math.min(4, 2 + Math.floor(this.round / 5));
      for (let i = 0; i < brutes; i++) this.spawnGrunt(this.kindFrom(this.escort.brutes), this.scatter({ x: cx, y: 0, z: cz }, 4), false, beside);
      for (let i = 0; i < 8; i++) this.spawnGrunt(this.kindFrom(this.escort.gunners), this.scatter({ x: cx, y: 0, z: cz }, 6), false, beside);
      this.push({ kind: 'spawn', x: cx, y: 0, z: cz, radius: 5, value: brutes + 8 });
    }
    if (event.kind === 'elites') {
      for (let i = 0; i < 3; i++) {
        const at = this.spawnAround(13, 2.4, 18, beside, 1);
        const slot = this.spawnGrunt(this.pickKind(this.escort, true), at, true, beside);
        if (slot !== undefined) this.push({ kind: 'spawn', x: at.x, y: at.y, z: at.z, radius: 2.2, value: 1 });
      }
      // A lesser boss walks with them, with a bar of its own.
      const lesser = this.nextChampion ?? this.lesserBoss();
      this.nextChampion = undefined;
      if (lesser) this.championsMet.add(lesser.id);
      if (lesser) {
        const at = this.spawnAround(14, 1.2, 18, beside, 2);
        const id = this.spawnChampion(enemy(lesser.id), at, lesser.rank);
        // It is fought: the round lasts until it falls too (announced as its
        // round's boss fell, one vanished with the place it was sent to).
        if (id) this.roundBosses.push(id);
        if (id) this.push({ kind: 'boss', text: lesser.id ? enemy(lesser.id).name.toUpperCase() : '', sub: lesser.epithet, enemy: lesser.id, rank: lesser.rank, universe: lesser.universe, actor: id, x: at.x, y: at.y, z: at.z });
      }
    }
    if (event.kind === 'hoarder') {
      const at = this.spawnAround(10, 2.4, 14, beside, 1);
      const slot = this.spawnGrunt(GRUNT_INDEX.get('husk') ?? 0, at, true, beside);
      if (slot !== undefined) { this.horde.flags[slot] |= GF.ARMOURED; this.hoarder = this.horde.serial[slot]; }
    }
  }
  /** The loot-runner of a hoarder event, by serial. */
  private hoarder = 0;
  /** The round that has had its event (one a round). */
  private eventRound = 0;
  /** When an elite last dropped a chest. */
  private lastChest = -99;
  private kindFrom(table: readonly (readonly [string, number])[]) {
    const total = table.reduce((sum, [, w]) => sum + w, 0);
    let r = this.random() * total;
    const id = table.find(([, w]) => (r -= w) <= 0)?.[0] ?? table[0][0];
    return GRUNT_INDEX.get(id) ?? 0;
  }
  /** A boss two ranks below the round's, for an elite hunt's champion. */
  private lesserBoss(): BossEntry | undefined {
    const rank = RANKS.indexOf(rankFor(Math.max(1, this.round)));
    const fresh = (entry: BossEntry) => !this.roundBosses.some(id => this.enemies.get(id)?.def.id === entry.id);
    // One the run has not met as a champion yet, from two ranks down - or
    // one rank down when those are spent (Harrow came twice in one run, the
    // second time at D, and fell in seconds).
    // (Nor one fought as a round's boss: Rime came back as a champion five rounds on.)
    for (const r of [Math.max(0, rank - 2), Math.max(0, rank - 1)]) {
      const pool = this.bossPool(RANKS[r]).filter(entry => fresh(entry) && !this.championsMet.has(entry.id) && !this.bossesMet.includes(entry.id) && !this.partners.has(entry.id));
      if (pool.length) return pool[Math.floor(this.random() * pool.length)];
    }
    const pool = this.bossPool(RANKS[Math.max(0, rank - 2)]).filter(fresh);
    return pool[Math.floor(this.random() * pool.length)];
  }
  /** Champions the run has fought (lesserBoss draws others). */
  private readonly championsMet = new Set<string>();
  /** Bosses who are a fighter's own partner, never sent against them (Kurobi
   *  killed Konta in a capture). */
  private get partners(): ReadonlySet<string> {
    const set = new Set<string>();
    for (const hero of this.heroes.values()) for (const id of PARTNERS[hero.fighter] ?? []) set.add(id);
    return set;
  }
  private bossPool(rank: Rank) { return BOSSES.filter(entry => entry.rank === rank && !RESTING.has(entry.id)); }

  // ---- placing things -------------------------------------------------------------------
  /** A spot for a boss's rift in front of the local camera: out past the
   *  fighter along the lens's line, a little to either side (undefined when
   *  there is no lens - a match server - or nowhere clear there). */
  private inView(beside = this.anchor()): Vec3 | undefined {
    const view = lens(), player = beside ? this.body(beside.id) : undefined;
    if (!view || !player) return undefined;
    const { halfX, halfZ } = this.sim.bounds, facing = Math.atan2(view.fx, view.fz);
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = facing + (this.random() - .5) * (.6 + attempt * .12), r = 10 + this.random() * 3 - attempt * .3;
      const at = { x: Math.max(-halfX + 4, Math.min(halfX - 4, player.x + Math.sin(angle) * r)), y: 0, z: Math.max(-halfZ + 4, Math.min(halfZ - 4, player.z + Math.cos(angle) * r)) };
      if (Math.hypot(at.x - player.x, at.z - player.z) < 6) continue;
      const placed = this.clear(at);
      if (placed) return placed;
    }
    return undefined;
  }

  private spawnAround(distance: number, spread = 1.4, far = distance + 4, beside = this.anchor(), size = 1, behind = true): Vec3 {
    const player = (beside ? this.body(beside.id) : undefined) ?? { x: 0, y: 0, z: 0, yaw: 0 };
    const { halfX, halfZ } = this.sim.bounds;
    for (let attempt = 0; attempt < 14; attempt++) {
      const ahead = !behind || this.random() < .62 || spread === 0;
      const angle = player.yaw + (ahead ? (this.random() - .5) * spread * 2 : Math.PI + (this.random() - .5) * 2);
      const r = distance + this.random() * (far - distance) * (attempt < 7 ? 1 : .4);
      const margin = 2 * size;
      const at = { x: Math.max(-halfX + margin, Math.min(halfX - margin, player.x + Math.sin(angle) * r)), y: 0,
        z: Math.max(-halfZ + margin, Math.min(halfZ - margin, player.z + Math.cos(angle) * r)) };
      if (Math.hypot(at.x - player.x, at.z - player.z) < Math.min(7, distance * .6)) continue;
      if (this.heroes.size > 1 && [...this.heroes.values()].some(hero => { const s = this.body(hero.id); return !!s && Math.hypot(at.x - s.x, at.z - s.z) < Math.min(6, distance * .5); })) continue;
      const placed = this.clear(at);
      if (placed) return placed;
    }
    return { x: -Math.sign(player.x || 1) * halfX * .5, y: 0, z: -Math.sign(player.z || 1) * halfZ * .5 };
  }

  private clear(at: Vec3): Vec3 | undefined {
    const { halfX, halfZ } = this.sim.bounds;
    if (Math.abs(at.x) > halfX - 1 || Math.abs(at.z) > halfZ - 1) return undefined;
    if (this.collision?.penetration && this.collision.penetration(at, .2) > 0) return undefined;
    const world = this.horde.world;
    for (const c of world.circles) if (Math.hypot(at.x - c.x, at.z - c.z) < c.r + .6) return undefined;
    for (const b of world.boxes) if (Math.abs(at.x - b.x) < b.hx + .6 && Math.abs(at.z - b.z) < b.hz + .6) return undefined;
    return { x: at.x, y: 0, z: at.z };
  }

  // ---- drafting -------------------------------------------------------------------------
  private openDrafts() {
    for (const hero of this.heroes.values()) if (!hero.draft) this.offerTo(hero);
    return this.choosing() > 0;
  }
  private offerTo(hero: Hero) {
    while (hero.pending > 0 || hero.pendingLegendary > 0) {
      const legendary = hero.pendingLegendary > 0;
      const cards = offer(hero.picks, this.random, legendary, this.round / 2, hero.unlocked);
      if (cards.length) { hero.draft = { cards, legendary }; return; }
      if (legendary) hero.pendingLegendary = 0; else hero.pending = 0;
    }
    // A relic left while all three slots were full: which one to give up for it, or leave it.
    while (hero.relicsWaiting.length) {
      const relic = hero.relicsWaiting.shift()!;
      if (hero.relics.includes(relic)) continue;
      if (hero.relics.length < RELIC_SLOTS) { hero.relics.push(relic); this.push({ kind: 'relic', sub: 'taken', text: relic, hero: hero.id, value: this.now }); continue; }
      hero.draft = { cards: [...hero.relics.map(giveCard), RELIC_LEAVE], legendary: false, relic };
      return;
    }
  }
  choosing() { let n = 0; for (const hero of this.heroes.values()) if (hero.draft || (hero.treeOpen && !hero.joining)) n++; return n; }
  /** A card is waiting on someone (the seal's question). */
  get drafting() { for (const hero of this.heroes.values()) if (hero.draft) return true; return false; }
  /** Anyone in the tree (the room's clock on a party's pause). */
  get upgradingNow() { for (const hero of this.heroes.values()) if (hero.treeOpen && !hero.joining) return true; return false; }
  /** Every tree closed at once: the room's clock ran out on them. */
  closeTrees() {
    for (const hero of this.heroes.values()) hero.treeOpen = false;
    if (this.phase === 'draft' && !this.choosing()) this.resume();
  }

  /** The skill tree through the draft's channel (a card id is a string all the
   *  way to a co-op room): `tree:open`, `tree:close`, `tree:<node>`. The run
   *  stands still while anyone has it open. (Opened on a chapter card, the
   *  fight holds the moment it would begin: `openDrafts` counts the tree.) */
  private tree(hero: Hero, what: string) {
    // Closing remains valid after a draft/death/phase transition. A late close
    // must not strand the party behind a tree that the browser already hid.
    if (what === 'close') {
      hero.treeOpen = false;
      if (this.phase === 'draft' && !this.choosing()) this.resume();
      return;
    }
    if (!['intro', 'fight', 'draft'].includes(this.phase) || hero.draft || !this.body(hero.id)?.alive) return;
    if (what === 'open') {
      hero.treeOpen = true;
      if (this.phase === 'fight' && !hero.joining) this.enterPhase('draft');
      return;
    }
    if (!hero.treeOpen) return;
    if (what === 'reset') {
      if (!hero.picks.length) return;
      hero.points += hero.picks.length; hero.picks = [];
      this.applyStats(hero);
      this.push({ kind: 'learn', text: 'BUILD RESET · POINTS RETURNED', hero: hero.id });
      return;
    }
    if (what.startsWith('refund:')) {
      const id = what.slice(7);
      if (refundLock(hero.picks, id, hero.unlocked)) return;
      hero.picks.splice(hero.picks.lastIndexOf(id), 1); hero.points++;
      // Consumed revives, Second Wind, cooldowns and meter deliberately persist.
      this.applyStats(hero);
      this.push({ kind: 'learn', text: `${upgrade(id).name.toUpperCase()} · POINT RETURNED`, hero: hero.id });
      return;
    }
    this.learn(hero, what);
  }
  /** A point into a node of the tree, if it can take one. */
  learn(hero: Hero, id: string) {
    if (hero.points <= 0 || lockOf(hero.picks, id, hero.unlocked)) return false;
    hero.points--;
    hero.picks.push(id); this.applyStats(hero);
    this.push({ kind: 'learn', text: upgrade(id).name.toUpperCase(), hero: hero.id });
    return true;
  }
  private autoLearn() {
    for (const hero of this.heroes.values()) {
      while (hero.points > 0) { const id = botPick(hero.picks); if (!id || !this.learn(hero, id)) break; }
    }
  }

  choose(id?: string, heroId?: string) {
    const hero = heroId ? this.heroes.get(heroId) : this.lead;
    if (hero && id?.startsWith('tree:')) { this.tree(hero, id.slice(5)); return; }
    if (this.phase !== 'draft' || !hero?.draft) return;
    // The seal's choice is the party's: whoever answers first answers for everyone.
    if (hero.draft.finale) {
      for (const each of this.heroes.values()) if (each.draft?.finale) each.draft = undefined;
      if (id === 'finale-end') { this.gameOver(true); return; }
      // Deeper: a breath of THE RIFT STIRS…, then the next round.
      this.sealHold = false; this.roundState = 'interlude'; this.roundAt = this.now - INTERLUDE + 3;
      for (const each of this.heroes.values()) this.offerTo(each);
      if (!this.choosing()) this.resume();
      return;
    }
    // A relic's question: one held given up for it, or the new one left where it fell.
    if (hero.draft.relic) {
      const relic = hero.draft.relic, given = id && hero.draft.cards.includes(id) ? givenOf(id) : undefined;
      hero.draft = undefined;
      if (given) this.swapRelic(hero, relic, given);
      else this.push({ kind: 'relic', sub: 'left', text: relic, hero: hero.id });
      this.offerTo(hero);
      if (!this.choosing()) this.resume();
      return;
    }
    if (id && hero.draft.cards.includes(id)) { hero.picks.push(id); this.applyStats(hero); }
    if (hero.draft.legendary) hero.pendingLegendary--; else hero.pending--;
    hero.draft = undefined;
    this.offerTo(hero);
    if (!this.choosing()) this.resume();
  }
  /** Back into the fight once every card is chosen. */
  private resume() { if (this.phase === 'draft') this.enterPhase('fight'); }

  /** A fresh hand for a fighter who spends a reroll: three cards, none of the
   *  ones just turned down while anything else is left. */
  reroll(heroId?: string) {
    const hero = heroId ? this.heroes.get(heroId) : this.lead;
    if (this.phase !== 'draft' || !hero?.draft || hero.draft.relic || hero.draft.finale || hero.rerolls <= 0) return false;
    const { cards: shown, legendary } = hero.draft;
    let cards = offer([...hero.picks], this.random, legendary, this.round / 2, hero.unlocked);
    for (let attempt = 0; attempt < 6 && cards.some(id => shown.includes(id)); attempt++) {
      const fresh = offer([...hero.picks, ...shown.filter(id => !hero.picks.includes(id))], this.random, legendary, this.round / 2, hero.unlocked);
      if (fresh.length >= Math.min(3, cards.length)) { cards = fresh; break; }
    }
    if (!cards.length) return false;
    hero.rerolls--;
    hero.draft = { cards, legendary };
    return true;
  }

  /** The room's clock ran out on a question (the seal's, now the only draft
   *  a party is asked): answered for whoever has not. Skill points stay
   *  theirs to spend. */
  autoChoose(only?: string) {
    const rank = { common: 0, rare: 1, epic: 2, legendary: 3 } as Record<string, number>;
    for (let guard = 0; this.phase === 'draft' && guard < 64; guard++) {
      const hero = [...this.heroes.values()].find(each => each.draft && (only === undefined || each.id === only));
      if (!hero?.draft) break;
      // Nobody answered the seal's question: the Rift takes the party on.
      if (hero.draft.finale) { if (only !== undefined) break; this.choose('finale-deeper', hero.id); continue; }
      // Nobody answered a relic's: what they hold, they keep.
      if (hero.draft.relic) { this.choose(RELIC_LEAVE, hero.id); continue; }
      const best = [...hero.draft.cards].sort((a, b) => (rank[upgrade(b).rarity] ?? 0) - (rank[upgrade(a).rarity] ?? 0))[0];
      this.choose(best, hero.id);
    }
  }

  /** Couch co-op (survival/LocalArena.ts): one hero's question answered for them, as the clock answers a party's. */
  autoChooseFor(heroId: string) { const hero = this.heroes.get(heroId); if (hero?.draft && !hero.draft.finale) this.autoChoose(heroId); }

  // ---- what happened ----------------------------------------------------------------------
  private consume(events: CombatEvent[]) {
    const now = this.now, solo = this.heroes.size <= 1 ? this.lead : undefined;
    for (const event of events) {
      const proc = event.move !== undefined && PROC.has(event.move);
      const by = this.heroes.get(event.actorId), on = event.targetId ? this.heroes.get(event.targetId) : undefined;
      if (event.kind === 'cast' && !by) {
        const record = this.enemies.get(event.actorId);
        const move = record?.def.moves.find(m => m.name === event.move);
        if (record && move?.rain) this.startRain(record, move);
      }
      if (event.kind === 'hit' && by && event.targetId) {
        const target = this.enemies.get(event.targetId);
        const grunt = target ? undefined : this.horde.slotOf(event.targetId);
        const damage = event.damage ?? 0;
        if (target) {
          target.lastHitBy = by.id;
          if (!proc) target.lastBlow = { slot: event.slot ?? 'light', contact: event.contactIndex ?? 0, at: now };
          if (target.boss && !target.illusion) this.signatures.struck(target.id, by.id, damage);
          // An ultimate on a boss at the brink finishes it; two landing on one boss together are a team's.
          if (event.slot === 'ultimate' && !proc) {
            if (target.brink && !target.brink.done) this.finishing(target, by, event.contactIndex ?? 0);
            else if ((target.boss || target.champion) && !target.illusion && this.heroes.size > 1) this.teamUltimate(target, by);
          }
        }
        by.dealt += damage;
        const source = event.move === 'Team Ultimate' || event.move === 'Finisher' ? 'team' : proc ? 'techniques' : event.slot === 'special' ? 'specials' : event.slot === 'ultimate' ? 'ultimates' : 'blows';
        by.dealtBy[source] += damage;
        this.score += Math.round(damage * .5 * by.style.multiplier);
        const action = proc ? 'proc' : event.slot === 'area' ? 'special' : (event.slot ?? 'light');
        const airborne = target ? !this.body(event.targetId)?.grounded : grunt !== undefined && this.horde.state[grunt] === GS.AIR;
        by.style.hit(action, now, !!airborne, event.reaction === 'launched', !!event.critical);
        const combo = this.body(by.id)?.combo ?? 0;
        by.bestCombo = Math.max(by.bestCombo, combo);
        const steal = by.stats.lifesteal + (by.raging && by.stats['grave-hound'] ? .08 : 0);
        if (steal > 0) by.leech += damage * steal;
        if (event.endpoint) this.smashAt(event.endpoint.x, event.endpoint.z, 1.3, damage);
        if (!proc) this.onHeroHit(by, event.targetId, grunt, event.slot ?? 'light', damage);
      }
      if (event.kind === 'hit' && on && (event.damage ?? 0) > 0) on.style.hurt(event.damage!, now, this.horde.slotOf(event.actorId) !== undefined, this.body(on.id)?.maxHp ?? MAX_HP);
      if (event.kind === 'blocked' && on) on.style.bonus(2, now);
      if (event.kind === 'just-guard' && on) {
        on.style.bonus(28, now);
        // A parried grunt reels.
        const slot = this.horde.slotOf(event.actorId);
        if (slot !== undefined) this.horde.stagger(slot, 1.4);
        if (on.stats.parryBlast) this.blast(on, on.stats.parryBlast, 4.2, 'Counter Blast', 7, 'counter');
      }
      if (event.kind === 'vanish' && by) by.style.bonus(18, now);
      if (event.kind === 'dodge' && on) on.style.bonus(5, now);
      if (event.kind === 'awaken' && by) { by.style.bonus(30, now); if (by.stats.nova) this.nova(by); }
      // Their relics answer a fighter's own moments (relics.ts).
      if (on && (event.kind === 'dodge' || event.kind === 'just-guard')) this.relicEvent(on, event);
      if (by && (event.kind === 'cast' || event.kind === 'awaken')) this.relicEvent(by, event);
      if (event.kind === 'wall-splat' && this.enemies.has(event.actorId)) (this.heroes.get(this.enemies.get(event.actorId)!.lastHitBy ?? '') ?? solo)?.style.bonus(6, now);
      if (event.kind === 'poise-break') {
        const record = this.enemies.get(event.actorId);
        if (record) {
          (this.heroes.get(event.targetId ?? '') ?? solo)?.style.earned(record.boss ? 60 : 30, now);
          this.push({ kind: 'break', text: 'BREAK', enemy: record.def.id, x: event.origin?.x, y: event.origin?.y, z: event.origin?.z, boss: record.boss });
        }
      }
      if (event.kind === 'eliminated' && event.targetId) {
        if (on) this.down(on);
        else {
          const record = this.enemies.get(event.targetId);
          // A boss's last blow holds it at the brink instead: FINISH IT.
          if (record && record.diedAt === undefined && this.canFinish(record)) { this.brink(record, event.actorId); this.unseen.add(event.id); }
          else if (record && record.diedAt === undefined) this.killed(record, event.actorId);
        }
      }
    }
  }

  private onHeroHit(hero: Hero, targetId: string, grunt: number | undefined, slot: AttackSlot, damage: number) {
    const s = hero.stats;
    hero.hits++;
    // Techniques (upgrades.ts): the fighter's own heavies leave cuts that burst,
    // their specials strike again as afterimages - a handful at once, at most.
    if (s.rend && slot === 'heavy' && damage > 0 && this.techniques.filter(t => t.kind === 'rend').length < 6) {
      const at = this.positionOf(targetId);
      if (at) {
        this.techniques.push({ kind: 'rend', hero: hero.id, target: targetId, at: { ...at }, due: this.now + .7, damage: damage * s.rend, radius: 1.5 + s.rend * .6 });
        this.push({ kind: 'rend', x: at.x, y: at.y + 1.1, z: at.z, value: 0, hero: hero.id });
      }
    }
    if (s.echo && slot === 'special' && damage > 0 && this.techniques.filter(t => t.kind === 'echo').length < 8) {
      const at = this.positionOf(targetId);
      if (at) this.techniques.push({ kind: 'echo', hero: hero.id, target: targetId, at: { ...at }, due: this.now + .5, damage: damage * s.echo, radius: 1.1 });
    }
    if ((slot === 'special' || slot === 'ultimate') && damage > 0) this.kiHit(hero, targetId, grunt, slot, damage);
    if (hero.relics.length && damage > 0) this.relicHit(hero, targetId, slot, damage);
    if (s.shockwaveEvery && hero.hits % s.shockwaveEvery === 0) this.blast(hero, s.shockwaveDamage, 3.6, 'Shockwave', 6.5, 'shockwave');
    // The combo's own reward: every Nth hit of one unbroken string (once per count).
    if (s.crescentEvery) {
      const combo = this.body(hero.id)?.combo ?? 0;
      if (combo >= s.crescentEvery && combo % s.crescentEvery === 0 && combo !== hero.crescentAt) { hero.crescentAt = combo; this.crescent(hero); }
      else if (combo < hero.crescentAt) hero.crescentAt = 0;
    }
    if (s.chainChance && this.random() < s.chainChance) this.arc(hero, targetId, s.chain, s.chainDamage);
    if (s.burn) {
      const dps = burnAt(s.burn, this.level);
      if (grunt !== undefined) this.horde.ignite(grunt, dps, 3, hero.id);
      else { const target = this.enemies.get(targetId); if (target) target.burn = { until: this.now + 3, dps, next: Math.min(target.burn?.next ?? Infinity, this.now + .5), by: hero.id }; }
    }
  }

  /** Every grunt within `radius` of a point, alive. */
  private hordeInRadius(x: number, z: number, radius: number, fn: (slot: number) => void) {
    const h = this.horde;
    for (let i = 0; i < h.capacity; i++) {
      if (!h.isAlive(i)) continue;
      if (Math.abs(h.x[i] - x) > radius || Math.abs(h.z[i] - z) > radius) continue;
      if (Math.hypot(h.x[i] - x, h.z[i] - z) <= radius + GRUNTS[h.kind[i]].radius * .5) fn(i);
    }
  }

  private blast(hero: Hero, damage: number, radius: number, name: string, knockback: number, kind: FeedKind | undefined, extra: Partial<MoveDefinition> = {}, value?: number) {
    const player = this.body(hero.id);
    if (!player?.alive) return;
    const move = procMove(name, damage, { knockback, stun: .45, ...extra });
    const from = { x: player.x, y: player.y + 1, z: player.z };
    for (const record of this.enemies.values()) {
      const body = this.body(record.id);
      if (!body?.alive || Math.hypot(body.x - player.x, body.z - player.z) > radius + (body.size ?? 1) * .45) continue;
      this.passiveStrike(false, hero.id, record.id, 'heavy', move, from);
    }
    this.hordeInRadius(player.x, player.z, radius, slot => { this.passiveStrike(true, hero.id, this.horde.ids[slot], 'heavy', move, from); });
    this.smashAt(player.x, player.z, radius, damage);
    if (kind) this.push({ kind, x: player.x, y: player.y, z: player.z, radius, hero: hero.id, value });
  }

  /** A crescent cut along the fighter's facing: everything in a band nine
   *  metres ahead and three wide takes it - cut through, as a sword's blow
   *  cuts (Flying Slash). */
  private crescent(hero: Hero) {
    const player = this.body(hero.id);
    if (!player?.alive) return;
    const reach = 9, half = 1.5, dx = Math.sin(player.yaw), dz = Math.cos(player.yaw);
    const move = procMove('Flying Slash', hero.stats.crescentDamage, { knockback: 4.5, stun: .4, style: 'melee' });
    const from = { x: player.x, y: player.y + 1, z: player.z };
    const within = (x: number, z: number, size: number) => { const rx = x - player.x, rz = z - player.z, along = rx * dx + rz * dz; return along > -.5 && along < reach && Math.abs(rx * dz - rz * dx) < half + size * .45; };
    for (const record of this.enemies.values()) {
      const body = this.body(record.id);
      if (body?.alive && within(body.x, body.z, body.size ?? 1)) this.passiveStrike(false, hero.id, record.id, 'heavy', move, from);
    }
    this.hordeInRadius(player.x + dx * reach * .5, player.z + dz * reach * .5, reach * .6, slot => {
      if (within(this.horde.x[slot], this.horde.z[slot], 1)) this.passiveStrike(true, hero.id, this.horde.ids[slot], 'heavy', move, from);
    });
    this.push({ kind: 'crescent', x: player.x, y: player.y + 1.1, z: player.z, radius: reach, value: player.yaw, hero: hero.id });
  }

  /** Lightning from one struck body to its nearest neighbours, horde or champion. */
  private arc(hero: Hero, fromId: string, jumps: number, damage: number) {
    const start = this.positionOf(fromId);
    if (!start) return;
    const struck = new Set([fromId]);
    const points: Vec3[] = [{ x: start.x, y: start.y + 1.1, z: start.z }];
    let at = start;
    for (let jump = 0; jump < jumps; jump++) {
      let best: { id: string; x: number; y: number; z: number } | undefined, gap = 6.5;
      for (const record of this.enemies.values()) {
        const body = this.body(record.id);
        if (!body?.alive || struck.has(record.id)) continue;
        const d = Math.hypot(body.x - at.x, body.z - at.z);
        if (d < gap) { gap = d; best = body; }
      }
      this.hordeInRadius(at.x, at.z, gap, slot => {
        const id = this.horde.ids[slot];
        if (struck.has(id)) return;
        const d = Math.hypot(this.horde.x[slot] - at.x, this.horde.z[slot] - at.z);
        if (d < gap) { gap = d; best = { id, x: this.horde.x[slot], y: this.horde.y[slot], z: this.horde.z[slot] }; }
      });
      if (!best) break;
      struck.add(best.id);
      points.push({ x: best.x, y: best.y + 1.1, z: best.z });
      const move = procMove('Thunder Chain', damage, { knockback: 1.5, stun: .5 });
      if (this.enemies.has(best.id)) this.passiveStrike(false, hero.id, best.id, 'special', move, { x: at.x, y: at.y + 1, z: at.z });
      else this.passiveStrike(true, hero.id, best.id, 'special', move, { x: at.x, y: at.y + 1, z: at.z });
      at = best;
    }
    if (points.length > 1) this.push({ kind: 'chain', points, hero: hero.id });
  }

  private positionOf(id: string): Vec3 | undefined {
    const body = this.body(id);
    if (body) return { x: body.x, y: body.y, z: body.z };
    const slot = this.horde.slotOf(id);
    return slot !== undefined ? { x: this.horde.x[slot], y: this.horde.y[slot], z: this.horde.z[slot] } : undefined;
  }

  /** A summoner's rift call: its army's rank and file out of a rift beside it. */
  private summoned(slot: number, count: number) {
    if (this.phase !== 'fight' || this.quiet) return;
    const h = this.horde, at = { x: h.x[slot], y: 0, z: h.z[slot] }, beside = this.anchor();
    let placed = 0;
    for (let i = 0; i < count; i++) if (this.spawnGrunt(this.kindFrom(this.escort.fodder), this.scatter(at, 2.4), false, beside) !== undefined) placed++;
    if (placed) this.push({ kind: 'spawn', x: at.x, y: 0, z: at.z, radius: 1.8, value: placed });
  }

  /** A grunt down. */
  private gruntKilled(slot: number, killerId: string | undefined) {
    const h = this.horde, kind = GRUNTS[h.kind[slot]];
    const at = { x: h.x[slot], y: h.y[slot], z: h.z[slot] };
    const elite = !!(h.flags[slot] & GF.ELITE);
    const killer = killerId ? this.heroes.get(killerId) : undefined;
    this.kills++;
    this.recentKills.push(this.now);
    if (elite && h.pack[slot] >= 0) this.erupt(slot);
    if (this.roundState === 'horde' && !(this.path && TIMED_PATHS.has(this.path))) this.riftKills += kind.cost * (elite ? 5 : 1);
    this.score += Math.round(kind.score * (elite ? 4 : 1) * (killer?.style.multiplier ?? 1));
    // The fighter's own blow, or their upgrades' (an art, a blade, a chain, a burn).
    const passive = !h.lastMove[slot] || PROC.has(h.lastMove[slot]);
    if (killer) { killer.kills++; killer.style.kill(this.now, elite || kind.role === 'brute', passive); }
    this.slay(killer?.id, at.x, at.z, elite);
    // Drops: experience always; now and then something better.
    const xp = kind.xp * (elite ? 6 : 1) * (this.eclipse > .5 ? 2 : 1) * (h.pack[slot] >= 0 ? PACK_XP : 1);
    this.orb('xp', xp, at);
    const r = this.random();
    if (elite || h.serial[slot] === this.hoarder) {
      // A chest from an elite at most every six seconds (the hoarder's always):
      // an Elite Hunt at S dropped one a second, and every chest is a draft -
      // a fight became a queue of cards. Between them, an elite pays in experience.
      const hoard = h.serial[slot] === this.hoarder;
      if (hoard || this.now - this.lastChest >= 6 || (this.path === 'trial' && h.pack[slot] >= 0)) { this.orb('chest', 1, at); this.lastChest = this.now; }
      else for (let i = 0; i < 3; i++) this.orb('xp', kind.xp * 3, at);
      for (let i = 0; i < (hoard ? 10 : 3); i++) this.orb('xp', kind.xp * 3, at);
      if (h.serial[slot] === this.hoarder) { this.hoarder = 0; if (this.event?.kind === 'hoarder') this.event.until = this.now; }
    } else {
      const rank = rankFor(Math.max(1, this.round)), heal = this.now >= this.nextHealOrb ? HEAL_DROP[rank] : 0;
      if (r < heal) { this.orb('heal', .07, at); this.nextHealOrb = this.now + HEAL_GAP[rank]; }
      else if (r < heal + .02) this.orb('meter', 14, at);
      else if (r < heal + .0235) this.orb('magnet', 1, at);
      else if (r < heal + .0265) this.orb('bomb', 1, at);
    }
    if (killer?.stats.healOnKill) killer.leech += (this.body(killer.id)?.maxHp ?? MAX_HP) * killer.stats.healOnKill;
    if (killer?.stats.killBlast) {
      const move = procMove('Chain Reaction', Math.round(h.maxHp[slot] * killer.stats.killBlast), { knockback: 5, stun: .35 });
      const from = { x: at.x, y: at.y + 1, z: at.z };
      this.hordeInRadius(at.x, at.z, 3, other => { if (other !== slot) this.passiveStrike(true, killer.id, h.ids[other], 'heavy', move, from); });
      this.push({ kind: 'burst', x: at.x, y: at.y, z: at.z, radius: 3, hero: killer.id });
    }
  }

  private killed(record: EnemyRecord, killerId: string) {
    const now = this.now;
    // A copy breaks, and is worth a little: it was never there.
    if (record.illusion) { this.score += 200; this.heroes.get(killerId)?.style.bonus(20, now); this.shatter(record); return; }
    record.diedAt = now;
    if (record.boss) this.signatures.end(record.id);
    this.release(record.id);
    this.kills++;
    const body = this.body(record.id);
    const def = record.def;
    const killer = this.heroes.get(killerId) ?? this.heroes.get(record.lastHitBy ?? '') ?? (this.heroes.size <= 1 ? this.lead : undefined);
    this.score += Math.round(def.score * (killer?.style.multiplier ?? 1));
    if (killer) { killer.kills++; killer.style.kill(now, true); }
    if (!record.boss && body) this.slay(killer?.id, body.x, body.z, true);
    if (killer?.stats.healOnKill) killer.leech += (this.body(killer.id)?.maxHp ?? MAX_HP) * killer.stats.healOnKill * 10;
    if (record.boss && record.def.transform && !record.transformed && body && this.transform(record, body)) return;
    if (body) {
      for (let i = 0; i < (record.boss ? 16 : 8); i++) this.orb('xp', def.xp * (record.boss ? 2.2 : 1.4) / 4, body);
      this.orb('heal', record.boss ? .35 : .15, body);
      this.orb('chest', 1, body);
    }
    if (record.boss) this.bossDown(record, killer);
    else this.push({ kind: 'down', text: `${def.name.toUpperCase()} DEFEATED`, enemy: def.id, boss: false });
    // A champion felled in a dungeon's horde is a big step toward its guardian.
    if (record.champion && this.roundState === 'horde' && !(this.path && TIMED_PATHS.has(this.path))) this.riftKills += this.riftWant * .15;
  }

  private transform(record: EnemyRecord, body: PlayerState) {
    record.transformed = true;
    const next = enemy(record.def.transform!.into);
    const at = this.clear({ x: body.x, y: 0, z: body.z }) ?? this.spawnAround(6, .5, 9);
    const entry = record.entry ?? { id: next.id, rank: record.rank ?? 'S', escort: 'beasts', epithet: next.title?.toUpperCase() ?? '', universe: next.series.toUpperCase() } as BossEntry;
    const spawned = this.spawnBoss(next, { ...entry, id: next.id }, at);
    if (!spawned) return false;
    this.roundBosses.push(spawned);
    this.slow(.35, 1.4);
    this.push({ kind: 'spawn', enemy: next.id, x: at.x, y: at.y, z: at.z, radius: 4, value: 1 });
    this.push({ kind: 'boss', text: next.name.toUpperCase(), sub: next.title?.toUpperCase() ?? '', enemy: next.id, boss: true, rank: entry.rank, universe: entry.universe, value: RANKS.indexOf(entry.rank), actor: spawned, x: at.x, y: at.y, z: at.z });
    // Its card holds the screen (as long as SurvivalHud shows it for the rank): no draft opens over it.
    this.levelBeat = Math.max(this.levelBeat, this.now + (entry.rank === 'S' ? 3.5 : entry.rank === 'F' || entry.rank === 'E' || entry.rank === 'D' ? 2.1 : 2.9));
    return true;
  }

  private bossDown(record: EnemyRecord, killer?: Hero) {
    this.bosses++;
    this.bossLog.push({ id: record.def.id, name: record.def.name, rank: record.rank ?? 'F', finished: !!record.brink?.executing, seconds: Math.round(this.now - (this.bossBorn.get(record.id) ?? this.now)) });
    for (const hero of this.heroes.values()) {
      const before = hero.takenAt.get(record.id);
      if (before !== undefined && (this.body(hero.id)?.damageTaken ?? 0) - before < 1 && !hero.down) hero.flawless++;
      hero.takenAt.delete(record.id);
    }
    if (this.path === 'cursed' && !this.roundBosses.some(id => id !== record.id && this.standingBoss(id))) this.cursedCleared++;
    // A boss felled is a skill point for everyone who fought it.
    for (const hero of this.heroes.values()) { hero.style.earned(200, this.now); hero.rerolls = Math.min(3, hero.rerolls + 1); hero.points += 1 + (this.path === 'cursed' ? PATH_RULES.cursedPoints : 0); }
    // And what it leaves behind: its power, for everyone who fought it.
    this.leaveRelic(record);
    this.score += 5000 * this.bosses;
    this.push({ kind: 'down', text: `${record.def.name.toUpperCase()} DEFEATED`, enemy: record.def.id, boss: true, rank: record.rank });
    this.slow(.35, 2.2);
    // Its fall has the screen to itself: DEFEATED, then the levels it paid
    // for as one stamp, and only then a draft (SurvivalHud holds the stamp).
    this.levelBeat = Math.max(this.levelBeat, this.now + 2.8);
    // Its army breaks: most of what stands goes down with it.
    if (this.roundBosses.some(id => id !== record.id && this.standingBoss(id))) return;
    let routed = 0;
    const by = killer?.id ?? this.lead?.id ?? PLAYER_ID;
    for (let i = 0; i < this.horde.capacity; i++) {
      if (!this.horde.isAlive(i) || this.random() > .6) continue;
      this.horde.damage(i, this.horde.hp[i] + 1, by);
      routed++;
    }
    if (routed) this.push({ kind: 'rout', value: routed });
    // Anyone the round put down is back for the next; anyone waiting in a rift comes in.
    for (const hero of this.heroes.values()) {
      if (hero.joining) { this.letIn(hero); continue; }
      if (hero.down) { this.standUp(hero, .5); this.push({ kind: 'regroup', text: `${hero.name.toUpperCase()} IS BACK`, hero: hero.id }); continue; }
      const state = this.body(hero.id);
      if (state?.alive && this.depthMods.roundHeal) this.sim.heal(hero.id, state.maxHp * ROUND_HEAL[rankFor(Math.max(1, this.round))] * this.depthMods.heal);
    }
    for (const orb of this.orbs) if (orb.kind === 'xp') orb.pulled = true;
  }

  /** Rank S is beaten: the rift closes over the offering - the run's ending -
   *  and every fighter stands up whole. It does not stay closed: after a
   *  longer breath the Rift drags them in, and the run goes on as deep as
   *  they can go. */
  private seal() {
    this.sealed = true; this.sealHold = true;
    this.roundAt = this.now + FINALE_HOLD;
    this.score += 50000 * this.heroes.size;
    // The last boss's fall has the screen first - DEFEATED, the slow motion -
    // and the seal's card comes after it (on the same frame, it covered the kill).
    const card = this.now + 2.6;
    this.later.push({ at: card, run: () => {
      this.push({ kind: 'finale', text: 'THE RIFT IS SEALED', sub: 'FOR NOW', value: this.bosses });
      // The field falls silent: what was left of the horde goes back through.
      this.rains.length = 0; this.strikes.length = 0;
      this.horde.clear();
    } });
    // Once the card has had its moment, the choice: end it here, or go deeper.
    // (After the card has gone: at 4.2 s the question opened under a card held for 6.2.)
    this.finaleChoiceAt = card + 5;
    if (this.event) { this.event = undefined; this.nextEvent = this.now + 60; }
    for (const hero of this.heroes.values()) {
      if (hero.down) this.standUp(hero, 1);
      const state = this.body(hero.id);
      if (state?.alive) this.sim.heal(hero.id, state.maxHp);
      hero.rerolls = Math.min(3, hero.rerolls + 2);
    }
  }
  /** Set once rank S is beaten. */
  sealed = false;
  /** From the seal until its question is answered: the run stands still - no
   *  next round (its drums sounded behind the victory card), no THE RIFT
   *  STIRS…, and the last fight's experience left lying, so its levels come
   *  only to a run that goes deeper. */
  private sealHold = false;
  /** When the sealed run is asked whether to end or go deeper (0: not pending). */
  private finaleChoiceAt = 0;
  /** The two cards of that choice, as a draft. */
  static readonly FINALE_CARDS = ['finale-end', 'finale-deeper'] as const;
  /** When the current level's moment ends and its draft may open. */
  private levelBeat = 0;

  private slow(scale: number, seconds: number) { if (!this.slowMotion) return; this.timeScale = scale; this.slowUntil = this.now + seconds * scale; }

  private down(hero: Hero) {
    if (hero.stats.revives > hero.revivesUsed) {
      hero.revivesUsed++;
      hero.reviveAt = this.now + 1.4;
      this.push({ kind: 'revive', text: 'UNDYING WILL', hero: hero.id });
      return;
    }
    if (this.phase === 'over') return;
    hero.downAt = this.now; hero.rescue = 0;
    const state = this.body(hero.id);
    if (this.heroes.size > 1) this.push({ kind: 'fallen', text: `${hero.name.toUpperCase()} IS DOWN`, hero: hero.id, x: state?.x, y: state?.y, z: state?.z });
    if (this.allDown() && !this.lastStand()) this.gameOver();
  }

  private gameOver(victory = false) {
    if (this.phase === 'over') return;
    this.enterPhase('over');
    this.forks = [];
    this.overAt = this.now;
    if (!victory) this.slow(.4, 1.6);
    for (const hero of this.heroes.values()) hero.result = { ...this.resultFor(hero), ...(victory ? { victory: true } : {}) };
    this.result = this.lead?.result;
  }

  private resultFor(hero: Hero): RunResult {
    const state = this.body(hero.id);
    const round = Math.max(1, this.round);
    // Alone, KNOCKOUTS are the fighter's own (with their upgrades'), beside what
    // they dealt: the run's total counted the horde's other deaths too, and a
    // fighter who never struck read 20 knockouts and 0 damage.
    const party = this.partyAtStart > 1 || this.heroes.size > 1;
    return { sealed: this.sealed, fighter: hero.fighter, round, wave: round, rank: rankFor(round), act: this.dungeon(round).index, score: this.score, kills: party ? this.kills : hero.kills,
      seconds: Math.round(this.now - this.startedAt), level: this.level, bestRank: hero.style.best, bestCombo: hero.bestCombo,
      damageDealt: Math.round(Math.max(hero.dealt, state?.damageDealt ?? 0)), damageTaken: Math.round(state?.damageTaken ?? 0), bosses: this.bosses, picks: [...hero.picks], relics: [...hero.relics], ...(this.depth ? { depth: this.depth } : {}),
      finishers: hero.finishers, teamUltimates: hero.teamUltimates, dealtBy: { ...hero.dealtBy }, bossLog: [...this.bossLog], places: [...this.placesSeen],
      breaks: hero.breaks, flawless: hero.flawless, cursed: this.cursedCleared, loop: loopOf(round),
      ...(this.probeGod || this.probeBossHp < 1 || this.firstRound > 1 || this.probeStart ? { probe: true } : {}),
      ...(party ? { party: Math.max(this.partyAtStart, this.heroes.size), ownKills: hero.kills } : {}) };
  }

  private rise(hero: Hero) {
    hero.reviveAt = -1;
    const player = this.body(hero.id);
    if (!player) return;
    this.sim.revive(hero.id, player.maxHp * .5);
    this.blast(hero, 60, 5.5, 'Rising Will', 10, 'will');
  }

  // ---- drops ---------------------------------------------------------------------------------
  private orb(kind: Orb['kind'], value: number, at: Vec3) {
    // Too many on the floor: experience merges into the nearest gem instead.
    if (kind === 'xp' && this.orbs.length > 180) {
      let near: Orb | undefined, gap = 4;
      for (const orb of this.orbs) { if (orb.kind !== 'xp' || orb.pulled) continue; const d = Math.hypot(orb.x - at.x, orb.z - at.z); if (d < gap) { gap = d; near = orb; } }
      if (near) { near.value += value; return; }
    }
    const angle = this.random() * Math.PI * 2, speed = 1.6 + this.random() * 2.4;
    this.orbs.push({ id: ++this.orbSerial, kind, value, x: at.x, y: at.y + 1, z: at.z, vx: Math.sin(angle) * speed, vy: 3.5 + this.random() * 2, vz: Math.cos(angle) * speed, born: this.now, pulled: false });
    if (this.orbs.length > 260) { const i = this.orbs.findIndex(orb => orb.kind === 'xp'); this.orbs.splice(i >= 0 ? i : 0, 1); }
  }

  private nearestHero(x: number, y: number, z: number, reach?: number): { hero: Hero; state: PlayerState; d: number } | undefined {
    let best: { hero: Hero; state: PlayerState; d: number } | undefined;
    for (const hero of this.heroes.values()) {
      const state = this.standing(hero);
      if (!state) continue;
      const d = Math.hypot(state.x - x, state.y + 1 - y, state.z - z);
      if (d < (reach ?? hero.stats.magnet) && (!best || d < best.d)) best = { hero, state, d };
    }
    return best;
  }

  private updateOrbs() {
    if (!this.heroes.size) return;
    const now = this.now;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      // At the seal the last fight's experience lies where it fell until the
      // question is answered (it is only worth levels to a run going deeper).
      const held = this.sealHold && orb.kind === 'xp';
      if (held) orb.pulled = false;
      // A chest is walked over, not pulled across the field.
      const reach = orb.kind === 'chest' ? 1.6 : undefined;
      if (!held && !orb.pulled && now - orb.born > .45) { const near = this.nearestHero(orb.x, orb.y, orb.z, reach); if (near) { orb.pulled = true; orb.to = near.hero.id; } }
      if (orb.pulled) {
        let hero = orb.to ? this.heroes.get(orb.to) : undefined;
        let state = hero ? this.standing(hero) : undefined;
        if (!state) { const near = this.nearestHero(orb.x, orb.y, orb.z, Infinity); hero = near?.hero; state = near?.state; orb.to = hero?.id; }
        if (hero && state) {
          const tx = state.x - orb.x, ty = state.y + 1 - orb.y, tz = state.z - orb.z, d = Math.hypot(tx, ty, tz);
          const speed = 10 + (now - orb.born) * 6;
          const step = Math.min(d, speed * DT);
          orb.x += tx / (d || 1) * step; orb.y += ty / (d || 1) * step; orb.z += tz / (d || 1) * step;
          if (d < .7) { this.collect(orb, hero); this.orbs.splice(i, 1); }
          continue;
        }
      }
      orb.vy -= 18 * DT;
      orb.x += orb.vx * DT; orb.y += orb.vy * DT; orb.z += orb.vz * DT;
      const floor = .35;
      if (orb.y < floor) { orb.y = floor; orb.vy = 0; orb.vx *= .8; orb.vz *= .8; }
      if (orb.kind === 'xp' && now - orb.born > 60) this.orbs.splice(i, 1);
    }
  }

  xpNext(level = this.level) { return Math.round(xpNeeded(level) * partyScale(this.heroes.size).xp); }

  private collect(orb: Orb, hero: Hero) {
    const player = this.body(hero.id)!;
    if (orb.kind === 'xp') {
      this.xp += orb.value * hero.stats.xpGain * (this.path === 'night' ? PATH_RULES.nightXp : 1);
      while (this.xp >= this.xpNext()) {
        this.xp -= this.xpNext(); this.level++;
        for (const each of this.heroes.values()) each.points++;
        this.push({ kind: 'level', text: `LEVEL ${this.level}`, x: player.x, y: player.y, z: player.z, hero: hero.id });
      }
    } else if (orb.kind === 'heal') { this.sim.heal(hero.id, player.maxHp * orb.value * this.depthMods.heal); this.push({ kind: 'pickup', text: 'HEAL', value: orb.value, hero: hero.id }); }
    else if (orb.kind === 'meter') { this.sim.addMeter(hero.id, orb.value, orb.value * .4); this.push({ kind: 'meter', value: orb.value, hero: hero.id }); }
    else if (orb.kind === 'magnet') {
      for (const each of this.orbs) if (each.kind === 'xp') { each.pulled = true; each.to = hero.id; }
      this.push({ kind: 'magnet', hero: hero.id, x: player.x, y: player.y, z: player.z });
    } else if (orb.kind === 'bomb') {
      const move = procMove('Rift Bomb', 400 + this.round * 60, { knockback: 12, stun: .6 });
      const from = { x: player.x, y: player.y + 1, z: player.z };
      this.hordeInRadius(player.x, player.z, 16, slot => { this.passiveStrike(true, hero.id, this.horde.ids[slot], 'ultimate', move, from); });
      this.push({ kind: 'bomb', hero: hero.id, x: player.x, y: player.y, z: player.z, radius: 16 });
    } else if (orb.kind === 'chest') {
      // A chest is a card of the rarer kind for whoever opens it - two at most
      // waiting; past that it is paid in score and a breath of health.
      // (A chest is a skill point for whoever opens it now, and a little score.)
      hero.points++;
      this.score += 1000 * Math.max(1, RANKS.indexOf(rankFor(Math.max(1, this.round))));
      this.push({ kind: 'chest', hero: hero.id, x: player.x, y: player.y, z: player.z });
    }
  }

  // ---- procs ---------------------------------------------------------------------------------
  private procs() {
    const now = this.now;
    let execute = 0;
    for (const hero of this.heroes.values()) execute = Math.max(execute, hero.stats.execute);
    for (const record of this.enemies.values()) {
      const body = this.body(record.id);
      if (!body?.alive) continue;
      if (record.burn && now >= record.burn.next) {
        if (now > record.burn.until) record.burn = undefined;
        else { record.burn.next = now + .5; this.sim.damage(record.id, record.burn.dps * .5, record.burn.by, 'Burn'); }
      }
      if (execute && !record.executed && body.hp < body.maxHp * .3) {
        record.executed = true;
        this.sim.setMods(record.id, { damageIn: this.sim.mods(record.id).damageIn * (1 + execute) });
      }
    }
  }

  // ---- the stage comes apart -----------------------------------------------------------------
  private loadProps(stage: StageId) {
    this.breakables = [];
    riftLayout(stage).props.forEach((prop, i) => {
      if (prop.breakable) this.breakables.push({ tag: i + 1, kind: prop.kind, x: prop.x, z: prop.z, r: Math.max(prop.w, prop.d) / 2, hp: PROP_HP[prop.kind] ?? 60 });
    });
  }

  /** Every breakable prop within `radius` of (x, z) takes `damage`; what
   *  breaks flies apart (a `smash` in the feed) and now and then leaves
   *  something behind. */
  private smashAt(x: number, z: number, radius: number, damage: number) {
    if (!this.breakables.length) return;
    for (let i = this.breakables.length - 1; i >= 0; i--) {
      const prop = this.breakables[i];
      if (Math.abs(prop.x - x) > radius + prop.r || Math.abs(prop.z - z) > radius + prop.r) continue;
      if (Math.hypot(prop.x - x, prop.z - z) > radius + prop.r) continue;
      prop.hp -= damage;
      if (prop.hp > 0) continue;
      this.breakables.splice(i, 1);
      this.push({ kind: 'smash', value: prop.tag, text: prop.kind, x: prop.x, y: 0, z: prop.z, radius: prop.r });
      const at = { x: prop.x, y: .2, z: prop.z }, roll = this.random();
      if (roll < .06) this.orb('heal', .06, at);
      else if (roll < .5) for (let k = 0; k < 2; k++) this.orb('xp', 1, at);
    }
  }

  // ---- upkeep ---------------------------------------------------------------------------------
  /** What each fighter carries tick to tick: the lifesteal owed paid out, the
   *  HOUND ARMOR taking hold, the mods of the moment (a special's KI, an
   *  awakening's), a Cinder Step's cut; and the strikes due later, and the
   *  burning ground. */
  private upkeep() {
    const now = this.now;
    for (const hero of this.heroes.values()) {
      const player = this.standing(hero);
      if (hero.leech > 0) {
        if (player) {
          hero.leech = Math.min(hero.leech, player.maxHp * .3);
          const heal = Math.min(hero.leech, player.maxHp * LEECH_RATE * LEECH_BY_RANK[rankFor(Math.max(1, this.round))] * DT);
          this.sim.heal(hero.id, heal * this.depthMods.heal); hero.leech -= heal;
        } else hero.leech = 0;
      }
      if (hero.stats['grave-hound']) {
        const raging = !!player && player.hp < player.maxHp * .5;
        if (raging !== hero.raging) {
          hero.raging = raging; this.applyStats(hero);
          if (player) this.push({ kind: 'rage', value: raging ? 1 : 0, hero: hero.id, x: player.x, y: player.y, z: player.z });
        }
      }
      if (!player) continue;
      // Second Wind: once a round, the fall under a quarter of health caught.
      if (hero.stats.secondWind && hero.windRound !== this.round && player.hp > 0 && player.hp < player.maxHp * .25 && this.phase === 'fight') {
        hero.windRound = this.round;
        this.sim.heal(hero.id, player.maxHp * hero.stats.secondWind);
        this.push({ kind: 'second-wind', hero: hero.id, x: player.x, y: player.y, z: player.z, value: 0 });
      }
      this.kiMoment(hero, player);
      if (hero.stats.flashCut && this.phase === 'fight') this.cinderStep(hero, player);
      this.relicUpkeep(hero, player);
    }
    for (let i = this.later.length - 1; i >= 0; i--) {
      if (now < this.later[i].at) continue;
      const job = this.later[i];
      this.later.splice(i, 1);
      if (this.phase === 'fight') job.run();
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i];
      if (now >= zone.until) { this.zones.splice(i, 1); continue; }
      if (now < zone.next) continue;
      zone.next = now + .5;
      const move = procMove('Burning Ground', zone.damage, { knockback: 0, stun: .1, detached: true, style: 'field' });
      for (const foe of this.foes(zone.x, zone.z, zone.radius, 64)) {
        if (foe.slot !== undefined) { this.horde.damage(foe.slot, zone.damage, zone.by); this.horde.ignite(foe.slot, zone.damage * .6, 1.2, zone.by); }
        else this.passiveStrike(false, zone.by, foe.id, 'light', move, { x: zone.x, y: foe.y + 1, z: zone.z });
      }
    }
  }

  /** The hold on every body's impact freezes (HOLD_MAX): a body held its
   *  allowance at a stretch is let go, and is not held again until some of it
   *  has come back. A time stop is not an impact freeze, and stays. */
  private readonly holds = new Map<string, number>();
  private governHolds() {
    const t = this.sim.serverTime;
    for (const [id, actor] of this.sim.actors) {
      let left = this.holds.get(id) ?? HOLD_MAX;
      if (t < actor.hitstopUntil) {
        left -= DT;
        if (left <= 0) { actor.hitstopUntil = t; left = 0; }
      } else left = Math.min(HOLD_MAX, left + DT * HOLD_REFILL);
      this.holds.set(id, left);
    }
    if (this.holds.size > this.sim.actors.size + 32) for (const id of this.holds.keys()) if (!this.sim.actors.has(id)) this.holds.delete(id);
  }

  // ---- KI: what the fighter's own specials, ultimate, dash and awakening do -------------------
  /** The mods of the moment: a special or an ultimate hits harder (Ki Surge);
   *  awakened, the moves recharge faster (Limitless) and less gets through
   *  (Ki Armor, which heals as well). Sent to the arena only when they change. */
  private kiMoment(hero: Hero, player: PlayerState) {
    const s = hero.stats, base = hero.baseMods;
    const casting = player.action === 'special' || player.action === 'ultimate';
    const awake = !!player.awakened;
    const surge = casting && s.kiDamage > 0, limit = awake && s.limitless > 1, armour = awake && s.kiArmor < 1;
    // Momentum: every ten hits of an unbroken combo, a step harder (five at most).
    const step = s.momentum ? Math.min(MOMENTUM_STEPS, Math.floor((player.combo ?? 0) / 10)) : 0;
    if (armour) hero.leech += player.maxHp * .02 * DT;
    if (step > hero.momentum && player) this.push({ kind: 'momentum', value: step, hero: hero.id, x: player.x, y: player.y, z: player.z });
    hero.momentum = step;
    if (!hero.modsChanged(`${surge}|${limit}|${armour}|${step}`)) return;
    this.sim.setMods(hero.id, {
      damageOut: (base.damageOut ?? 1) * (surge ? 1 + s.kiDamage : 1) * (1 + step * s.momentum),
      cooldown: (base.cooldown ?? 1) / (limit ? s.limitless : 1),
      damageIn: (base.damageIn ?? 1) * (armour ? s.kiArmor : 1),
    });
  }

  /** A special or an ultimate landed: its techniques go off where it landed. */
  private kiHit(hero: Hero, targetId: string, grunt: number | undefined, slot: AttackSlot, damage: number) {
    const s = hero.stats, now = this.now, at = this.positionOf(targetId);
    if (!at) return;
    const ready = (key: keyof typeof KI_GAP) => { if (now - hero.kiAt[key] < KI_GAP[key]) return false; hero.kiAt[key] = now; return true; };
    if (slot === 'special') {
      // Overflow: a special that lands pours into the ultimate, once a cast.
      if (s.overflow) {
        const player = this.body(hero.id), cast = player?.actionStarted ?? -1;
        if (cast !== hero.overflowCast) { hero.overflowCast = cast; this.sim.addMeter(hero.id, s.overflow); this.push({ kind: 'meter', value: s.overflow, hero: hero.id, x: player?.x, y: player?.y, z: player?.z }); }
      }
      // Burst Point: the blow bursts round what it struck.
      if (s.burst && ready('burst')) {
        const radius = 1.9 + s.burst * 2;
        this.burstAt(hero, at, damage * s.burst, radius, 'Burst Point', targetId);
        this.push({ kind: 'burst', x: at.x, y: at.y, z: at.z, radius, hero: hero.id });
      }
      // Blazing Ki: fire out of the ground where it landed, and the ground left burning.
      if (s.blaze && ready('blaze')) {
        const dps = burnAt(s.blaze, this.level);
        this.zones.push({ x: at.x, z: at.z, radius: 2.1, until: now + 3, next: now + .1, damage: Math.round(dps * .5), by: hero.id });
        this.push({ kind: 'pillar', x: at.x, y: 0, z: at.z, radius: 1.9, value: 3, hero: hero.id });
      }
      // Storm Ki: lightning down on the ones round what it struck.
      if (s.storm && ready('storm')) {
        const move = procMove('Storm Ki', s.stormDamage, { knockback: 2.5, stun: .5, detached: true, style: 'beam' });
        const struck = this.foes(at.x, at.z, 7, s.storm + 1).filter(foe => foe.id !== targetId).slice(0, s.storm);
        const points: Vec3[] = [];
        for (const foe of struck) { this.smack(hero, foe, move, 'special', { x: foe.x, y: foe.y + 6, z: foe.z }); points.push({ x: foe.x, y: foe.y, z: foe.z }); }
        if (points.length) this.push({ kind: 'smite', points, hero: hero.id, value: 0 });
      }
      // Ki Vortex: the crowd round it dragged in toward the blow.
      if (s.vortex && ready('vortex')) {
        const h = this.horde;
        this.hordeInRadius(at.x, at.z, s.vortex, other => {
          if (other === grunt) return;
          const dx = at.x - h.x[other], dz = at.z - h.z[other], d = Math.hypot(dx, dz) || 1;
          const pull = Math.min(11, 4 + d * 1.6) / GRUNTS[h.kind[other]].mass;
          h.kx[other] += dx / d * pull; h.kz[other] += dz / d * pull;
        });
        this.push({ kind: 'whirl', x: at.x, y: at.y, z: at.z, radius: s.vortex * .55, hero: hero.id, value: 0 });
      }
    }
    if (slot === 'ultimate') {
      // Ultimate Echo: every blow of it again, a moment later, where the body is then.
      if (s.ultEcho && this.techniques.filter(t => t.kind === 'echo').length < 12) {
        this.techniques.push({ kind: 'echo', ultimate: true, hero: hero.id, target: targetId, at: { ...at }, due: now + .75, damage: damage * s.ultEcho, radius: 1.6 });
      }
      // Ultimate Rush: the meter back, once a cast.
      const player = this.body(hero.id), cast = player?.actionStarted ?? -1;
      if (s.ultRefund && cast !== hero.refundCast) { hero.refundCast = cast; this.sim.addMeter(hero.id, s.ultRefund); this.push({ kind: 'meter', value: s.ultRefund, hero: hero.id, x: player?.x, y: player?.y, z: player?.z }); }
    }
  }

  /** Everything within `radius` of `at` takes `damage` (but what it came from). */
  private burstAt(hero: Hero, at: Vec3, damage: number, radius: number, name: string, except?: string) {
    const move = procMove(name, Math.round(damage), { knockback: 5, stun: .35, style: 'bomb' });
    const from = { x: at.x, y: at.y + 1, z: at.z };
    for (const foe of this.foes(at.x, at.z, radius, 48)) if (foe.id !== except) this.smack(hero, foe, move, 'heavy', from);
    this.smashAt(at.x, at.z, radius, damage);
  }

  /** Awakening Nova: the awakening bursts out of the fighter. */
  private nova(hero: Hero) {
    const player = this.body(hero.id);
    if (!player?.alive) return;
    this.blast(hero, hero.stats.nova, 9, 'Awakening Nova', 11, 'will', { stun: .9 });
    this.hordeInRadius(player.x, player.z, 9, slot => this.horde.stagger(slot, 1.5));
  }

  /** 'Cinder Step': a dash cuts every enemy it passes, once each, and draws the
   *  cut along its path when it ends. */
  private cinderStep(hero: Hero, player: PlayerState) {
    const dashing = player.action === 'dash';
    if (!dashing) {
      const dash = hero.dash;
      if (dash) { hero.dash = undefined; if (dash.cut.size) this.push({ kind: 'slash', points: [{ ...dash.from, y: dash.from.y + 1.1 }, { x: player.x, y: player.y + 1.1, z: player.z }], hero: hero.id, value: 1 }); }
      return;
    }
    if (!hero.dash || hero.dash.started !== player.actionStarted) hero.dash = { started: player.actionStarted, from: { x: player.x, y: player.y, z: player.z }, cut: new Set() };
    const dash = hero.dash, move = procMove('Cinder Step', hero.stats.flashCut, { knockback: 3.5, stun: .45, style: 'melee' });
    for (const foe of this.foes(player.x, player.z, 1.7, 24)) {
      if (dash.cut.has(foe.id)) continue;
      dash.cut.add(foe.id);
      this.smack(hero, foe, move, 'heavy', { x: player.x, y: player.y + 1, z: player.z });
    }
  }

  // ---- relics: a boss's power, bent to the fighter who beat it (relics.ts) -------------------------
  /** A boss's relic, left for everyone who fought it: into a free slot, or -
   *  three held - waiting on the choice of which to give up for it (the draft
   *  opens once its fall has had the screen). One already held is not left twice. */
  private leaveRelic(record: EnemyRecord) {
    const relic = relicOf(record.def.id);
    if (!relic) return;
    const body = this.body(record.id), shown = this.now + RELIC_SHOWN;
    for (const hero of this.heroes.values()) {
      // (One still waiting in a rift to drop in did not fight it.)
      if (hero.joining || hero.relics.includes(relic.id) || hero.relicsWaiting.includes(relic.id)) continue;
      const free = hero.relics.length < RELIC_SLOTS;
      if (free) hero.relics.push(relic.id); else hero.relicsWaiting.push(relic.id);
      this.push({ kind: 'relic', sub: free ? 'taken' : 'waiting', text: relic.id, hero: hero.id, value: shown, x: body?.x, y: body?.y, z: body?.z });
    }
  }
  /** A relic into the place of one given up for it. */
  private swapRelic(hero: Hero, relic: string, given: string) {
    const at = hero.relics.indexOf(given);
    if (at < 0 || hero.relics.includes(relic)) return;
    hero.relics[at] = relic;
    hero.relicAt.delete(given); hero.relicAt.delete(relic);
    if (given === 'kuromitsu') hero.foresight = false;
    if (given === 'magatsu') hero.shrineUntil = 0;
    this.push({ kind: 'relic', sub: 'taken', text: relic, enemy: given, hero: hero.id, value: this.now });
  }
  /** How ready a relic is to go off again, 0-1 (the HUD's seals fill with it). */
  private relicCharge(hero: Hero, id: string) {
    if (id === 'kuromitsu') return hero.foresight ? 1 : Math.min(1, (this.now - (hero.relicAt.get(id) ?? -1e9)) / RELIC_GAP.kuromitsu) * .99;
    if (id === 'magatsu') return hero.shrineUntil > this.now ? 1 : .5;
    const gap = RELIC_GAP[id] ?? 0, last = hero.relicAt.get(id);
    return !gap || last === undefined ? 1 : Math.round(Math.min(1, (this.now - last) / gap) * 100) / 100;
  }
  /** Whether a relic may go off now (its gap since it last did), marking it gone off if so. */
  private relicReady(hero: Hero, id: string, gap: number) {
    const last = hero.relicAt.get(id);
    if (last !== undefined && this.now - last < gap) return false;
    hero.relicAt.set(id, this.now);
    return true;
  }
  /** What a relic's blow is worth at the run's level. */
  private relicDamage(base: number) { return Math.round(base * relicScale(this.level)); }
  /** A blow landed: the relics its kind sets off. */
  private relicHit(hero: Hero, targetId: string, slot: AttackSlot, damage: number) {
    const at = this.positionOf(targetId);
    if (!at) return;
    for (const id of hero.relics) {
      if (slot === 'heavy' && id === 'caldera' && this.relicReady(hero, id, RELIC_GAP.caldera)) this.magma(hero, at, damage);
      else if (slot === 'heavy' && id === 'haldor' && this.relicReady(hero, id, RELIC_GAP.haldor)) this.quake(hero, at, damage);
      else if (slot === 'special' && id === 'nightfall' && this.relicReady(hero, id, RELIC_GAP['nightfall'])) this.nightfang(hero, at, damage);
      else if (slot === 'special' && id === 'rime' && this.relicReady(hero, id, RELIC_GAP.rime)) this.winterSleep(hero, at, damage);
      else if (id === 'zarek') {
        const combo = this.body(hero.id)?.combo ?? 0;
        if (combo < hero.clawAt) hero.clawAt = 0;
        if (combo >= 8 && combo % 8 === 0 && combo !== hero.clawAt) { hero.clawAt = combo; if (this.relicReady(hero, id, RELIC_GAP.zarek)) this.claws(hero); }
      }
    }
  }
  /** Tick to tick: the relics a fighter's state sets off - a crowd closing in,
   *  a dash ending, a blow foreseen, an open domain. */
  private relicUpkeep(hero: Hero, player: PlayerState) {
    if (!hero.relics.length || this.phase !== 'fight') return;
    const now = this.now;
    for (const id of hero.relics) {
      if (id === 'harrow' && this.sim.tick % 6 === 0 && this.foes(player.x, player.z, 3.5, HOWL_CROWD).length >= HOWL_CROWD && this.relicReady(hero, id, RELIC_GAP.harrow)) this.howl(hero, player);
      else if (id === 'kade') {
        if (player.action === 'dash') { if (hero.relicDash !== player.actionStarted) { hero.relicDash = player.actionStarted; hero.relicDashYaw = player.yaw; } }
        else if (hero.relicDash >= 0) { hero.relicDash = -1; if (this.relicReady(hero, id, RELIC_GAP.kade)) this.ironShock(hero, player); }
      }
      else if (id === 'kuromitsu') {
        const last = hero.relicAt.get(id);
        if (!hero.foresight && (last === undefined || now - last >= RELIC_GAP.kuromitsu)) { hero.foresight = true; this.push({ kind: 'relic', sub: 'foresight', text: id, hero: hero.id, x: player.x, y: player.y, z: player.z }); }
        // Armed, tick to tick: the next blow at them this tick misses.
        const actor = this.sim.actors.get(hero.id);
        if (hero.foresight && actor) actor.evadeUntil = Math.max(actor.evadeUntil, now + DT * 1.5);
      }
      else if (id === 'magatsu' && hero.shrineUntil > now) {
        if (!player.awakened) { hero.shrineUntil = 0; continue; }
        if (now >= hero.shrineNext) { hero.shrineNext = now + SHRINE_EVERY; this.dismantle(hero, player); }
      }
    }
  }
  /** A fighter's own event: a blow dodged while foreseen, a just guard, the ultimate cast, the awakening. */
  private relicEvent(hero: Hero, event: CombatEvent) {
    if (!hero.relics.length || this.phase !== 'fight') return;
    if (event.kind === 'dodge' && hero.foresight && hero.relics.includes('kuromitsu')) {
      hero.foresight = false; hero.relicAt.set('kuromitsu', this.now);
      this.mochi(hero, event.actorId);
    }
    else if (event.kind === 'just-guard' && hero.relics.includes('kuromitsu') && this.relicReady(hero, 'kuromitsu-guard', 1)) this.mochi(hero, event.actorId);
    else if (event.kind === 'cast' && event.slot === 'ultimate' && hero.relics.includes('oro')) this.stopTime(hero, WORLD_SECONDS);
    else if (event.kind === 'awaken' && hero.relics.includes('magatsu')) {
      const player = this.body(hero.id);
      hero.shrineUntil = player?.awakenedUntil ?? this.now + 10; hero.shrineNext = this.now + .25;
      this.push({ kind: 'relic', sub: 'shrine', text: 'magatsu', hero: hero.id, value: hero.shrineUntil, x: player?.x, y: player?.y, z: player?.z });
    }
  }

  /** MAGMA FIST: magma where the heavy blow landed, burning what stands in it (four of a fighter's own at once). */
  private magma(hero: Hero, at: Vec3, damage: number) {
    const mine = this.zones.filter(zone => zone.magma && zone.by === hero.id);
    if (mine.length >= 4) this.zones.splice(this.zones.indexOf(mine[0]), 1);
    const now = this.now, until = now + 4;
    this.zones.push({ x: at.x, z: at.z, radius: 2.3, until, next: now + .15, damage: Math.max(4, Math.round(damage * .18)), by: hero.id, magma: true });
    this.push({ kind: 'pool', element: 'magma', x: at.x, y: 0, z: at.z, radius: 2.3, value: now, until, hero: hero.id, text: 'caldera' });
  }
  /** QUAKE: the ground splits six ways from the blow. */
  private quake(hero: Hero, at: Vec3, damage: number) {
    const lands = this.now + .12, turn = this.random() * Math.PI, hit = new Set<string>();
    const move = procMove('Quake', Math.round(damage * .7) + this.relicDamage(40), { knockback: 6, stun: .5, style: 'bomb' });
    const lines: [Vec3, Vec3][] = [];
    for (let i = 0; i < 6; i++) {
      const a = turn + i / 6 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      const from = { x: at.x + dx * .6, y: 0, z: at.z + dz * .6 }, to = this.inBounds({ x: at.x + dx * 10, y: 0, z: at.z + dz * 10 });
      lines.push([from, to]);
      this.push({ kind: 'fissure', element: 'sound', points: [from, to], radius: 1.1, value: lands, hero: hero.id, text: 'haldor' });
    }
    this.later.push({ at: lands, run: () => {
      for (const [from, to] of lines) this.alongLine(from, to, 1.1, foe => { if (hit.has(foe.id)) return; hit.add(foe.id); this.smack(hero, foe, move, 'heavy', { x: at.x, y: 1, z: at.z }); });
    } });
    this.push({ kind: 'relic', sub: 'quake', text: 'haldor', hero: hero.id, x: at.x, y: at.y, z: at.z, points: lines.map(([, to]) => to) });
  }
  /** 'SCORCHED EARTH': a black Nightfang from the fighter on toward what the special struck. */
  private nightfang(hero: Hero, at: Vec3, damage: number) {
    const player = this.body(hero.id);
    if (!player) return;
    let dx = at.x - player.x, dz = at.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < .5) { dx = Math.sin(player.yaw); dz = Math.cos(player.yaw); } else { dx /= d; dz /= d; }
    const from = { x: player.x + dx * .8, y: 0, z: player.z + dz * .8 }, to = this.inBounds({ x: player.x + dx * 16, y: 0, z: player.z + dz * 16 });
    const move = procMove('Black Crescent', Math.round(damage * 1.2), { knockback: 5, stun: .45, style: 'beam' });
    this.alongLine(from, to, 1.5, foe => this.smack(hero, foe, move, 'special', { x: player.x, y: player.y + 1, z: player.z }));
    this.push({ kind: 'fissure', element: 'blood', points: [from, to], radius: 1.5, value: this.now, hero: hero.id, text: 'nightfall' });
    this.push({ kind: 'relic', sub: 'nightfang', text: 'nightfall', hero: hero.id, x: player.x, y: player.y + 1.1, z: player.z, value: Math.atan2(dx, dz), radius: 16 });
  }
  /** 'WINTER SLEEP': the ground round the blow frozen, and all on it frozen solid. */
  private winterSleep(hero: Hero, at: Vec3, damage: number) {
    const radius = 4.5, move = procMove('Long Winter', Math.round(damage * .4), { knockback: 0, stun: .2, style: 'field' });
    const t = this.sim.serverTime;
    for (const foe of this.foes(at.x, at.z, radius, 64)) {
      this.smack(hero, foe, move, 'special', { x: at.x, y: 1, z: at.z });
      if (foe.slot !== undefined) { this.horde.chill(foe.slot, 2.2); continue; }
      const record = this.enemies.get(foe.id), actor = this.sim.actors.get(foe.id);
      if (!record || !actor || record.brink) continue;
      actor.freezeUntil = Math.max(actor.freezeUntil, t + (record.boss ? .6 : 1.2)); actor.state.timeStopped = true;
    }
    this.push({ kind: 'frost', x: at.x, y: 0, z: at.z, radius, hero: hero.id, text: 'rime' });
    this.push({ kind: 'pool', element: 'ice', x: at.x, y: 0, z: at.z, radius: radius * .8, value: this.now, until: this.now + 2.2, hero: hero.id, text: 'rime' });
  }
  /** AVALANCHE: five claws of light fanned out ahead. */
  private claws(hero: Hero) {
    const player = this.body(hero.id);
    if (!player) return;
    const lands = this.now + .15, hit = new Set<string>(), lines: [Vec3, Vec3][] = [];
    const move = procMove('Molten Rake', this.relicDamage(55), { knockback: 4, stun: .4, style: 'melee' });
    for (let i = -2; i <= 2; i++) {
      const a = player.yaw + i * .21, dx = Math.sin(a), dz = Math.cos(a);
      const from = { x: player.x + dx * .6, y: 0, z: player.z + dz * .6 }, to = this.inBounds({ x: player.x + dx * 12, y: 0, z: player.z + dz * 12 });
      lines.push([from, to]);
      this.push({ kind: 'fissure', element: 'ki', points: [from, to], radius: .75, value: lands, hero: hero.id, text: 'zarek' });
    }
    this.later.push({ at: lands, run: () => {
      for (const [from, to] of lines) this.alongLine(from, to, .75, foe => { if (hit.has(foe.id)) return; hit.add(foe.id); this.smack(hero, foe, move, 'heavy', { x: player.x, y: 1, z: player.z }); });
    } });
    this.push({ kind: 'relic', sub: 'claws', text: 'zarek', hero: hero.id, x: player.x, y: player.y, z: player.z, value: player.yaw });
  }
  /** WOLF HOWL: a ring of sound rolling out from a fighter the crowd has closed on, throwing it down. */
  private howl(hero: Hero, player: PlayerState) {
    const x = player.x, z = player.z, now = this.now, hit = new Set<string>();
    const move = procMove('Funeral Howl', this.relicDamage(55), { knockback: 7, stun: .8, style: 'bomb' });
    for (const [inner, outer] of [[0, 3], [3, 6], [6, 9]] as const) {
      this.later.push({ at: now + outer / HOWL_SPEED, run: () => {
        for (const foe of this.foes(x, z, outer, 64)) {
          if (foe.d < inner - .5 || hit.has(foe.id)) continue;
          hit.add(foe.id);
          this.smack(hero, foe, move, 'heavy', { x, y: 1, z });
          if (foe.slot !== undefined) this.horde.stagger(foe.slot, 1.2);
        }
      } });
    }
    this.push({ kind: 'wave', element: 'sound', x, y: player.y, z, radius: 9, sub: String(HOWL_SPEED), value: now, hero: hero.id, text: 'harrow' });
    this.push({ kind: 'relic', sub: 'howl', text: 'harrow', hero: hero.id, x, y: player.y, z });
  }
  /** 'IRON SHOCK': the dash's end, and the shock on through everything ahead. */
  private ironShock(hero: Hero, player: PlayerState) {
    const yaw = player.yaw, dx = Math.sin(yaw), dz = Math.cos(yaw);
    const from = { x: player.x, y: 0, z: player.z }, to = this.inBounds({ x: player.x + dx * 7, y: 0, z: player.z + dz * 7 });
    const move = procMove('Stilling Palm', this.relicDamage(95), { knockback: 9, stun: .6, style: 'bomb' });
    this.alongLine(from, to, 1.2, foe => this.smack(hero, foe, move, 'heavy', { x: player.x, y: player.y + 1, z: player.z }));
    this.push({ kind: 'relic', sub: 'iron-shock', text: 'kade', hero: hero.id, x: player.x, y: player.y + 1, z: player.z, value: yaw, radius: 7 });
  }
  /** FUTURE SIGHT's answer: a mochi thrust through whoever struck, and the line behind them. */
  private mochi(hero: Hero, attacker: string) {
    const player = this.body(hero.id), at = this.positionOf(attacker);
    if (!player?.alive) return;
    let dx = at ? at.x - player.x : Math.sin(player.yaw), dz = at ? at.z - player.z : Math.cos(player.yaw);
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const reach = Math.min(9, (at ? d : 0) + 4);
    const from = { x: player.x + dx * .5, y: 0, z: player.z + dz * .5 }, to = this.inBounds({ x: player.x + dx * reach, y: 0, z: player.z + dz * reach });
    const move = procMove('Tar Thrust', this.relicDamage(150), { knockback: 9, stun: .8, style: 'melee' });
    this.alongLine(from, to, 1.6, foe => this.smack(hero, foe, move, 'heavy', { x: player.x, y: player.y + 1, z: player.z }));
    this.push({ kind: 'relic', sub: 'mochi', text: 'kuromitsu', hero: hero.id, points: [{ x: player.x, y: player.y + 1.1, z: player.z }, { x: to.x, y: player.y + 1.1, z: to.z }] });
  }
  /** 'MIRROR MERE': the domain cuts the nearest of what stands in it. */
  private dismantle(hero: Hero, player: PlayerState) {
    const move = procMove('Hex Slashes', this.relicDamage(45), { knockback: 1.5, stun: .3, style: 'melee' });
    const points: Vec3[] = [];
    for (const foe of this.foes(player.x, player.z, 7, 3)) {
      this.smack(hero, foe, move, 'heavy', { x: player.x, y: player.y + 1, z: player.z });
      const a = this.random() * Math.PI, h = foe.y + foe.height * (.35 + this.random() * .4), r = .5 + foe.height * .25;
      points.push({ x: foe.x - Math.cos(a) * r, y: h + (this.random() - .5) * .6, z: foe.z - Math.sin(a) * r }, { x: foe.x + Math.cos(a) * r, y: h + (this.random() - .5) * .6, z: foe.z + Math.sin(a) * r });
    }
    if (points.length) this.push({ kind: 'relic', sub: 'cut', text: 'magatsu', hero: hero.id, points });
  }
  /** 'HUSH': time stops for everything but the fighters - the horde where it
   *  stands, every boss and champion held in the arena's own time stop, the
   *  strikes hanging over the field gone and the rains held back. */
  private stopTime(hero: Hero, seconds: number) {
    const now = this.now, until = now + seconds;
    if (until <= this.stoppedUntil) return;
    const extra = until - Math.max(now, this.stoppedUntil);
    this.stoppedUntil = until;
    this.horde.freeze({ x: 0, y: 0, z: 0 }, 1e4, seconds);
    this.horde.holdUntil = Math.max(this.horde.holdUntil, until);
    const t = this.sim.serverTime;
    for (const record of this.enemies.values()) {
      const actor = this.sim.actors.get(record.id);
      // (One at the brink is already held for its finisher.)
      if (!actor || record.diedAt !== undefined || record.brink) continue;
      actor.freezeUntil = Math.max(actor.freezeUntil, t + seconds); actor.state.timeStopped = true;
      record.brain.still(now, seconds);
    }
    this.strikes = this.strikes.filter(strike => strike.lands > until);
    for (const rain of this.rains) rain.next += extra;
    const player = this.body(hero.id);
    this.push({ kind: 'relic', sub: 'stop', text: 'oro', hero: hero.id, value: until, x: player?.x, y: player?.y, z: player?.z });
  }
  /** A point pulled inside the floor. */
  private inBounds(at: Vec3): Vec3 {
    const { halfX, halfZ } = this.sim.bounds;
    return { x: Math.max(-halfX + .5, Math.min(halfX - .5, at.x)), y: at.y, z: Math.max(-halfZ + .5, Math.min(halfZ - .5, at.z)) };
  }

  private passiveStrike(external: boolean, attackerId: string, targetId: string, slot: AttackSlot, move: MoveDefinition, from?: Vec3) {
    const actor = this.sim.actors.get(attackerId);
    const combo = actor?.state.combo, until = actor?.comboUntil ?? 0;
    const landed = external ? this.sim.strikeExternal(attackerId, targetId, slot, move, from) : this.sim.strike(attackerId, targetId, slot, move, from);
    if (actor) { actor.state.combo = combo; actor.comboUntil = until; }
    return landed;
  }

  /** A blow from an art on one foe, horde or arena. */
  private smack(hero: Hero, foe: Foe, move: MoveDefinition, slot: AttackSlot, from: Vec3) {
    if (foe.slot !== undefined) this.passiveStrike(true, hero.id, foe.id, slot, move, from);
    else this.passiveStrike(false, hero.id, foe.id, slot, move, from);
  }

  /** Up to `count` foes nearest (x, z) within `radius`, the horde's and the
   *  arena's, nearest first - bosses and champions first of all when `bosses`. */
  private foes(x: number, z: number, radius: number, count: number, bosses = false): Foe[] {
    const list: Foe[] = [];
    const h = this.horde;
    for (let i = 0; i < h.capacity; i++) {
      if (!h.isAlive(i) || h.state[i] === GS.SPAWN) continue;
      const dx = h.x[i] - x, dz = h.z[i] - z;
      if (Math.abs(dx) > radius || Math.abs(dz) > radius) continue;
      const d = Math.hypot(dx, dz);
      if (d <= radius) list.push({ id: h.ids[i], slot: i, x: h.x[i], y: h.y[i], z: h.z[i], d, height: GRUNTS[h.kind[i]].height });
    }
    for (const record of this.enemies.values()) {
      const body = this.body(record.id);
      if (!body?.alive || record.diedAt !== undefined) continue;
      const d = Math.hypot(body.x - x, body.z - z);
      if (d <= radius + (body.size ?? 1) * .4) list.push({ id: record.id, x: body.x, y: body.y, z: body.z, d: bosses && (record.boss || record.champion) ? -1 : d, height: 1.8 * (body.size ?? 1) });
    }
    list.sort((a, b) => a.d - b.d);
    if (list.length > count) list.length = count;
    return list;
  }

  /** Every foe within `width` of the segment a-b (on the floor plan). */
  private alongLine(a: Vec3, b: Vec3, width: number, fn: (foe: Foe) => void) {
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, reach = Math.hypot(b.x - a.x, b.z - a.z) / 2 + width + 1;
    const abx = b.x - a.x, abz = b.z - a.z, len = abx * abx + abz * abz || 1;
    for (const foe of this.foes(mx, mz, reach, 96)) {
      const t = Math.max(0, Math.min(1, ((foe.x - a.x) * abx + (foe.z - a.z) * abz) / len));
      if (Math.hypot(a.x + abx * t - foe.x, a.z + abz * t - foe.z) <= width + (foe.slot === undefined ? .5 : .2)) fn(foe);
    }
  }

  /** Where a blast of `radius` would catch the most of the horde within
   *  `reach` of (x, z): a boss counts for a crowd. */
  private densest(x: number, z: number, reach: number, radius: number): Vec3 | undefined {
    const near = this.foes(x, z, reach, 160);
    let best: Vec3 | undefined, most = 0;
    for (const a of near) {
      let n = a.slot === undefined ? 6 : 0;
      for (const b of near) if (Math.abs(b.x - a.x) <= radius && Math.abs(b.z - a.z) <= radius && Math.hypot(b.x - a.x, b.z - a.z) <= radius) n++;
      if (n > most) { most = n; best = { x: a.x, y: 0, z: a.z }; }
    }
    return best;
  }

  // ---- what the client reads --------------------------------------------------------------------
  snapshot(drain = true): GameSnapshot {
    const events = (drain ? this.pendingEvents : []).map(event => {
      const record = this.enemies.get(event.actorId);
      if (record && !record.def.rival) return { ...event, fighter: undefined, enemy: record.def.id };
      // A grunt's blow carries its kind, never a fighter.
      if (event.actorId.charCodeAt(0) === 103 && !this.heroes.has(event.actorId)) {
        const slot = this.horde.slotOf(event.actorId);
        return { ...event, fighter: undefined, enemy: slot !== undefined ? GRUNTS[this.horde.kind[slot]].id : 'grunt' };
      }
      return event;
    });
    if (drain) this.pendingEvents = [];
    return { players: this.sim.playerStates(), events, serverTime: this.now, roomMode: 'training', stage: this.sim.stage, ...(this.sim.lockCombat ? { lockCombat: true as const } : {}),
      status: 'active', winnerId: null, tick: this.sim.tick };
  }

  party(first?: string): PartyMember[] {
    const members: PartyMember[] = [];
    let seat = 0;
    for (const hero of this.heroes.values()) {
      const state = this.body(hero.id);
      members.push({ id: hero.id, name: hero.name, fighter: hero.fighter, hp: Math.round(state?.hp ?? 0), maxHp: state?.maxHp ?? MAX_HP,
        down: hero.down, rescue: hero.rescue, picks: hero.picks.length, seat: seat++, ...(hero.raging ? { rage: true } : {}), ...(this.body(hero.id)?.awakened ? { awake: true } : {}), ...(hero.joining ? { joining: true } : {}),
        ...(hero.look?.some(place => place >= 0) ? { look: hero.look } : {}), ...(hero.kills ? { kills: hero.kills } : {}), ...(hero.style.rank ? { style: hero.style.rank } : {}) });
    }
    if (first) members.sort((a, b) => (a.id === first ? -1 : 0) - (b.id === first ? -1 : 0));
    return members;
  }

  view(heroId?: string): SurvivalView {
    const hero = (heroId ? this.heroes.get(heroId) : undefined) ?? this.lead;
    const round = Math.max(1, this.round);
    const { location, index, loop, progress } = this.dungeon(this.phase === 'intro' || this.phase === 'travel' || this.phase === 'lobby' ? this.round + 1 : round);
    const style = hero?.style ?? new StyleMeter(), rank = style.rank;
    const bosses: BossView[] = [];
    for (const record of this.enemies.values()) {
      if (!record.boss && !record.champion && !record.illusion) continue;
      const body = this.body(record.id);
      if (!body || (record.diedAt !== undefined && this.now - record.diedAt > 1.6)) continue;
      const brink = record.brink && !record.brink.done ? Math.max(0, Math.round((record.brink.until - this.now) * 10) / 10) : undefined;
      bosses.push({ id: record.id, enemy: record.def.id, name: record.def.name, title: record.entry?.epithet ?? record.def.title, rank: record.rank, universe: record.entry?.universe,
        hp: body.hp, maxHp: body.maxHp, poise: body.poise, phase: record.brain.phase, champion: !record.boss && !record.illusion, x: Math.round(body.x * 10) / 10, z: Math.round(body.z * 10) / 10,
        ...(record.awakened ? { form: awakeningOf(record.def.id, record.def.color).name } : {}),
        ...(record.boss ? { charge: this.signatures.chargeOf(record.id) } : {}),
        ...(brink !== undefined ? { brink } : {}), ...(record.illusion ? { illusion: true } : {}) });
    }
    return {
      phase: this.phase, phaseLeft: Math.max(0, this.phaseUntil - this.now), time: this.now,
      round, roundState: this.roundState, held: this.sealHold, rank: rankFor(round), loop: loopOf(round), wave: round,
      ...(this.phase === 'intro' || this.phase === 'travel' ? { coming: this.round + 1 } : {}),
      location: { index, name: location.name, subtitle: location.subtitle, kanji: location.kanji, loop, stage: location.stage, progress },
      score: this.score, kills: this.kills, level: this.level, xp: this.xp, xpNext: this.xpNext(), pending: (hero?.pending ?? 0) + (hero?.pendingLegendary ?? 0),
      style: { rank, letter: STYLE_RANKS[rank].letter, word: STYLE_RANKS[rank].word, fill: style.fill, multiplier: style.multiplier, best: style.best },
      bosses, event: this.event ? { kind: this.event.kind, name: EVENT_NAMES[this.event.kind], left: Math.max(0, this.event.until - this.now), total: this.event.total } : undefined,
      eclipse: this.eclipse, horde: this.horde.alive, upcoming: this.upcoming(),
      draft: hero?.draft, ...(hero?.relics.length ? { relics: [...hero.relics], relicCharge: hero.relics.map(id => this.relicCharge(hero, id)) } : {}),
      ...(this.stoppedUntil > this.now ? { stopped: Math.round((this.stoppedUntil - this.now) * 100) / 100 } : {}),
      ...(this.slainLog.length && this.now - this.slainLog[this.slainLog.length - 1].at <= SLAIN_WINDOW ? { slain: this.slainView() } : {}),
      ...(this.depth ? { depth: this.depth } : {}),
      ...(this.ward ? { ward: { ...this.ward, x: Math.round(this.ward.x * 10) / 10, z: Math.round(this.ward.z * 10) / 10 } } : {}),
      ...(this.places.vents.length ? { vents: this.places.vents.map(vent => ({ x: Math.round(vent.x * 10) / 10, z: Math.round(vent.z * 10) / 10 })) } : {}),
      rerolls: hero?.rerolls ?? 0, orbs: this.orbs, blades: NO_BLADES, feed: this.feed, picks: hero?.picks ?? [],
      points: hero?.points ?? 0, treeOpen: !!hero?.treeOpen,
      result: hero?.result ?? this.result, stats: hero?.stats ?? { ...BASE_STATS }, timeScale: this.timeScale,
      party: this.party(hero?.id), choosing: this.heroes.size > 1 && this.phase === 'draft' ? this.choosing() : undefined,
      spots: this.spots(hero?.id), dungeon: this.dungeonView(), bounds: { halfX: this.sim.bounds.halfX, halfZ: this.sim.bounds.halfZ },
      next: this.round >= 1 ? this.dungeon(this.round + 1).location.stage : undefined,
      guardian: this.phase === 'intro' || this.phase === 'travel' || this.phase === 'lobby' ? this.nextBosses[0]?.universe ?? this.guardian : this.guardian,
      ...(this.forks.length ? { forks: this.forks.map(each => ({ ...each })), forkLeft: Math.max(0, this.forkUntil - this.now) } : {}),
      ...(this.path ? { path: this.path } : {}), ...(this.pathNext ? { pathNext: this.pathNext } : {}),
      upgrading: this.heroes.size > 1 ? [...this.heroes.values()].filter(each => each.treeOpen).map(each => each.name) : undefined,
    };
  }
  private slainView() {
    const out: number[] = [];
    for (const kill of this.slainLog) if (this.now - kill.at <= SLAIN_WINDOW) out.push(kill.serial, kill.code, kill.x, kill.z);
    return out;
  }
  private spots(first?: string) {
    const out: { x: number; z: number; yaw: number }[] = [];
    for (const member of this.party(first)) { const body = this.body(member.id); if (body) out.push({ x: Math.round(body.x * 10) / 10, z: Math.round(body.z * 10) / 10, yaw: Math.round(body.yaw * 100) / 100 }); }
    return out;
  }
  private dungeonView(): SurvivalView['dungeon'] {
    const elites = this.packs.filter(pack => pack.left > 0);
    if (!elites.length && this.roundState !== 'horde') return undefined;
    return { progress: this.roundState === 'horde' ? Math.min(1, Math.round(this.riftKills / Math.max(1, this.riftWant) * 1000) / 1000) : undefined,
      elites: elites.map(pack => ({ x: Math.round(pack.x), z: Math.round(pack.z), left: pack.left, size: pack.size, elite: true, awake: true,
        ...(pack.affix ? { affix: AFFIXES.indexOf(pack.affix) + 1 } : {}) })) };
  }

  rivals() { const ids: string[] = []; for (const record of this.enemies.values()) if (record.def.rival && record.diedAt === undefined) ids.push(record.id); return ids; }
  isBoss(id: string) { return !!this.enemies.get(id)?.boss; }
  /** (A copy of a boss is one to the lock-on, as to the eye: which of them is real is the question.) */
  isChampion(id: string) { const record = this.enemies.get(id); return !!record && (record.boss || record.champion || !!record.illusion); }
  marked() {
    const bosses: string[] = [], champions: string[] = [];
    for (const record of this.enemies.values()) {
      if (record.diedAt !== undefined) continue;
      if (record.boss) bosses.push(record.id);
      if (record.boss || record.champion || record.illusion) champions.push(record.id);
    }
    return { bosses, champions, rivals: this.rivals() };
  }
  dispose() { this.sim.dispose(); this.enemies.clear(); this.orbs.length = 0; this.horde.clear(); }
}

export type { AttackSlot };
