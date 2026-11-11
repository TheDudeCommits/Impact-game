import type {FighterId} from '../types';
import type {BallEvent, BallModeId, BallView, ShotKind} from './model';

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

/** A TECHNIQUE DUEL: a PERFECT guard meeting a SUPER SHOT. The ball hangs `hold` seconds between them (the clash's beat)
 *  and ends with the shot dying on the guard or breaking through, the keeper going down (the winner's points: BallMatch
 *  MVP.duel, half to a striker breaking through).
 *
 *  The duel is played. It was a roll (the keeper won 55% of the time, 15 points more awakened, 15 less against an
 *  awakened striker): nothing either player did in the beat counted, a big moment made small. Now the beat has a mark, `mark` seconds into it, and each of the two presses
 *  once (any strike or a fresh guard - on a phone the shot's button, which reads DUEL for the beat): the nearer to the
 *  mark wins (`duelWinner`). A press more than `late` seconds after the mark is no press: the beat has moved on. Nobody pressing loses to somebody who did, and two misses fall back to the striker - the
 *  shot was on its way. The keeper's guard was perfect to get here, so their miss counts `keeper` of itself (a fifth
 *  less); awakened, `awakened` of that, and against an awakened striker, the striker's is. Online each press is judged
 *  as its page drew the beat: at the room time its input says the page drew (its view, as SEEN reads it), at most `seen`
 *  seconds back - further than SEEN.most's 0.3 s, which a page at a 120 ms round trip passes (measured: 0.395 s from
 *  the frame a press was made on to the room playing it, through the snapshot delay and the room's input queue). A
 *  view claimed further back gains nothing a press timed on the page could not: nobody's press is seen before the end.
 *  The room decides at the beat's end, which is where it decided before: `hold` is unchanged, so a duel adds no time
 *  to a match. So a press must be heard by then: on the mark from a page `seen` behind (.25 + .45 = .7), and up to
 *  `late` past it from one up to 0.31 s behind. (Played online at 120 ms with the mark at 0.35 s, a press 80 ms late
 *  reached the room after the end.)
 *
 *  Tuned against the old roll: two bots of one level press the mark with BallBrain DUEL_BOT's spread, and with
 *  `keeper` .8 the striker wins 43-48% at each level (the roll gave 45%; EASY's at the top, its late presses missing
 *  more); a person who presses within 40 ms of the mark beats NORMAL's keeper about three times in four and its
 *  striker five times in six (Monte Carlo of the rule, 100,000 duels each). */
export const DUEL = {hold: .7, mark: .25, late: .14, keeper: .8, awakened: .7, seen: .45} as const;
/** The two presses of a duel: seconds from the mark (late is positive), or undefined for no press. */
export interface DuelPresses {keeper?: number; striker?: number}
/** Who wins a duel from its presses (DUEL): the nearer to the mark, the keeper's distance counted at DUEL.keeper of itself
 *  (DUEL.awakened of that again when the keeper is awakened; divided by it when the striker is). One press beats none;
 *  no press at all, the striker. */
export function duelWinner(p: DuelPresses, keeperAwake = false, strikerAwake = false): 'keeper' | 'striker' {
  if (p.keeper === undefined) return 'striker';
  if (p.striker === undefined) return 'keeper';
  const k = DUEL.keeper * (keeperAwake ? DUEL.awakened : 1) / (strikerAwake ? DUEL.awakened : 1);
  return Math.abs(p.keeper) * k < Math.abs(p.striker) ? 'keeper' : 'striker';
}
/** The TECHNIQUE DUEL on now, as a page sees it: its 'duel' event while the ball still hangs in that
 *  beat (BallState.clash is the beat's end) and no end has come since - the keeper, the striker and when it began. A
 *  page draws the mark at `at + DUEL.mark` on its own drawn clock, which is what the room judges a press against. */
export function duelOn(view: Pick<BallView, 'events' | 'ball'> | null | undefined): BallEvent | undefined {
  if (!view?.events || !view.ball) return undefined;
  for (let i = view.events.length - 1; i >= 0; i--) {
    const e = view.events[i];
    if (e.kind === 'duel-won') return undefined;
    if (e.kind === 'duel') return Math.abs(view.ball.clash - (e.at + DUEL.hold)) < 1e-3 ? e : undefined;
  }
  return undefined;
}
