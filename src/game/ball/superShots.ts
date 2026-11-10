import type {FighterId} from '../types';
import type {BallModeId, ShotKind} from './model';

/** Every fighter's ultimate on the ball is their own named SUPER SHOT. This is the one table of the names.
 *
 *  The eight with a bespoke shot are the home rail's headliners - the first page of the roster, the fighters a new
 *  player meets first and the game's default picks (the repo holds no usage numbers to rank them by). Each has a name,
 *  its kanji and what it says, and a motif: what the ball wears in flight besides the fighter's own ultimate colours
 *  (render/ball/superShotLooks.ts). Every other fighter's ultimate is a SUPER SHOT in their own ultimate colours, with
 *  their bust in the cut-in.
 *
 *  The names are original Japanese technique words, fierce and short, as every technique's: no pun,
 *  and none taken from another work. Data only, as everything under src/game. */
export type SignatureMotif = 'sun' | 'foxfire' | 'tide' | 'sand-cut' | 'feast' | 'crown' | 'sickle' | 'storm';

export interface SignatureShot {
  /** On screen, in capitals: the cut-in, the banner, the ticker. */
  name: string;
  /** How it is written, and what it says (never shown). */
  kanji: string; meaning: string;
  /** What the ball throws off in flight (render/ball/superShotLooks.ts). */
  motif: SignatureMotif;
}

export const SIGNATURE_SHOTS: Readonly<Partial<Record<FighterId, SignatureShot>>> = {
  taisei: {name: 'RAKUJITSU', kanji: '落日', meaning: 'the setting sun: the last sun brought down on the goal', motif: 'sun'},
  konta: {name: 'KOENBAKU', kanji: '狐焔爆', meaning: 'fox-flame blast', motif: 'foxfire'},
  gummy: {name: 'TAKASHIO', kanji: '高潮', meaning: 'the storm surge', motif: 'tide'},
  kenzo: {name: 'SAKAIWARI', kanji: '砂海割', meaning: 'splitting the sand sea', motif: 'sand-cut'},
  kosho: {name: 'HIUTAGE', kanji: '火宴', meaning: 'the fire feast', motif: 'feast'},
  ouga: {name: 'OUKODAN', kanji: '王煌弾', meaning: "the king's blazing shot", motif: 'crown'},
  shirokane: {name: 'KUKARI', kanji: '空刈', meaning: 'reaping the void', motif: 'sickle'},
  shiden: {name: 'SHIRANSEN', kanji: '紫嵐閃', meaning: 'the purple-storm flash', motif: 'storm'},
};

/** The eight with a bespoke shot, in the home rail's order. */
export const SIGNATURE_FIGHTERS = Object.keys(SIGNATURE_SHOTS) as FighterId[];
/** Every other fighter's ultimate on the ball. */
export const GENERIC_SUPER = 'SUPER SHOT';
export const signatureShot = (fighter: FighterId | string | undefined): SignatureShot | undefined => fighter ? SIGNATURE_SHOTS[fighter as FighterId] : undefined;
/** The name a fighter's super shot goes by on screen. */
export const superShotName = (fighter: FighterId | string | undefined) => signatureShot(fighter)?.name ?? GENERIC_SUPER;

/** A LINK SHOT: a team-mate's set (a tap or pass, a bump or set, a pop) finished first time by another within `window`
 *  seconds of it - both fighters' colours in the trail, the ball a heat tier hotter, a name in the ticker, an accolade and
 *  the caller's moment.
 *
 *  Tuned on bot matches (seeds 3, 8, 11, 21). Goal Rush: nearly every first-time finish of a team-mate's tap comes inside
 *  0.6 s, one or two a match. Sky Spike: the usual set climbs for 1-1.4 s before the hitter meets it, so its link is the
 *  quick attack - struck within half a second of the set or bump, on the rise: 0-9 a match, a person's timing more than
 *  a bot's. */
export const LINK = {
  window: {'goal-rush': .6, 'sky-spike': .5} as Record<BallModeId, number>,
  /** The heat it adds: one tier. */
  heat: 1,
  /** (Its points to the finisher, with the accolade's own, and to the setter: BallMatch MVP.link, MVP.linkSetter.) */
  /** The touches that set it up, and the strikes that finish it. */
  sets: new Set<ShotKind>(['tap', 'bump', 'set', 'pop']),
  finishes: new Set<ShotKind>(['power', 'volley', 'spike', 'curve', 'sinker', 'blast', 'eruption', 'super', 'drive']),
};

/** A TECHNIQUE DUEL: a PERFECT guard meeting a SUPER SHOT. The ball hangs `hold` seconds between them (the clash's beat),
 *  then the keeper wins `keeper` of the time (more awakened, less against an awakened striker) and the shot dies, or it
 *  breaks through and the keeper goes down (the winner's points: BallMatch MVP.duel, half to a striker breaking through). */
export const DUEL = {hold: .7, keeper: .55, awakened: .15} as const;
