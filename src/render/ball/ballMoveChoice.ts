import type {BallModeId} from '../../game/ball/model';

/** Ball modes, sports moves: which of the shared file's takes
 *  (ballMoves.ts, public/assets/fighters/ball-moves.glb) a swing in a ball match is drawn with, or none - the fighter's
 *  own clip. Presentation only: the blow, its timing and what it does to the ball are the simulation's (strike.ts); the
 *  take is chosen to look like what the ball is about to do, read off the slot, the body (on the floor or in the air),
 *  where the ball will be when the blow lands, the mode and the side's touch.
 *
 *  Never chosen: Goal Rush's FIGHT stance (the kit is the opponent's), the ultimate (a SUPER SHOT keeps its own show), a
 *  move of many blows (one take cannot land them all), a move that is not a melee blow (a beam, a shot or a field
 *  blasts the ball along its line and looks like one), and any mode but these two.
 *
 *  The sport kit: with the kit on (`kit`: `?ballmoves`, or ballMoves.ts BALL_KIT_DEFAULT)
 *  the chooser knows the whole kit - the charged DRIVE, the overhead kick, the TRAP, the carry's run, the TACKLE's
 *  shoulder charge and slide (the FIGHT stance's one blow at the one on the ball), the keeper's dives and parry, Sky
 *  Spike's diving dig, the BACK SET, three spiking arms by the stick as PLACEMENT reads it, the TIP, both serves - and
 *  the six celebrations. Without it the choice is the prototype's, as it ships for SHOOT's quick strike. */
export type BallMoveKey = 'GR.pass' | 'GR.power' | 'GR.volley' | 'GR.head' | 'GR.headAir' | 'GR.keeper'
  | 'SS.dig' | 'SS.set' | 'SS.setAir' | 'SS.spike' | 'SS.wall'
  | 'GR.drive' | 'GR.bicycle' | 'GR.trap' | 'GR.carry' | 'GR.shoulder' | 'GR.slide' | 'GR.diveL' | 'GR.diveR' | 'GR.parry'
  | 'SS.pancake' | 'SS.pancakeUp' | 'SS.backSet' | 'SS.spikeCut' | 'SS.spikeRoll' | 'SS.tip' | 'SS.float' | 'SS.jumpServe'
  | 'C.slide' | 'C.pump' | 'C.flex' | 'C.point' | 'C.leap' | 'C.bow'
  // (The football takes: the SPORT mode's, which the chooser never picks - its rules ask for them.)
  | 'GR.stridePass' | 'GR.strideShot' | 'GR.poke' | 'GR.catch' | 'GR.slideUp';

export interface BallMoveAsk {
  mode: BallModeId;
  /** The action starting: an attack slot, `guard`; with the kit, `dash`, `run` and `victory` too. */
  action: string;
  grounded: boolean;
  /** The move's style and how many blows it lands (the simulation's move for this action on this body). */
  style?: string; blows: number;
  /** Goal Rush: the seat's FIGHT-stance lock (absent: the BALL stance). */
  lock?: string;
  /** The ball where the blow will land, in the body's own frame: metres ahead of it, to its left, and over its feet;
   *  and its radius. Absent: no ball in play (a kickoff's ball is held, which is still a ball). */
  ball?: {ahead: number; left: number; up: number; radius: number};
  /** The body's height (metres, its size taken in). */
  height: number;
  /** Sky Spike: which touch of its side this is (1 to 3; a ball coming over is the first). */
  touch?: number;
  /** Goal Rush: how far the body stands from its own goal line (metres), and whether the ball is coming at that goal. */
  fromGoal?: number; incoming?: boolean;
  /** Sky Spike: how far the body stands from the net (metres). */
  fromNet?: number;
  // ─── The kit's ───
  /** SHOOT (model.ts): a tap's quick strike or a held key's charge. */
  strike?: 'tap' | 'charge';
  /** Goal Rush, a guard by its own goal: where the ball coming crosses the body's line (metres to its left) and in how
   *  long (seconds). */
  shot?: {left: number; eta: number};
  /** Goal Rush, a guard elsewhere: a ball coming to the body and near it (a TRAP's: BallMatch TRAP). */
  arriving?: boolean;
  /** Goal Rush, the FIGHT stance: the one locked on - how far off, and whether they are on the ball (carrying it, or
   *  nearest it, as BallMatch's TACKLE asks). */
  foe?: {distance: number; onBall: boolean};
  /** Goal Rush: this body carries the ball (BallState.carry). */
  carrying?: boolean;
  /** Sky Spike: a dash at a ball the other side sent, near and low enough to dive for (BallMatch DIG_DIVE). */
  diving?: boolean;
  /** Sky Spike: this body's serve (the ball held for it). */
  serve?: boolean;
  /** Sky Spike: a light from the air that is a TIP (strike.ts: the attacking touch, the ball over the net). */
  tip?: boolean;
  /** Sky Spike: the stick as PLACEMENT reads it (strike.ts `placement`; known for the page's own body only). */
  place?: {a: number; f: number};
  /** Sky Spike: a set the stick sends across the court (strike.ts: a BACK SET; the page's own body only). */
  backSet?: boolean;
  /** A body striking its victory pose: for a goal, a point or the podium; and a number that picks among them. */
  celebrate?: 'goal' | 'point' | 'podium'; seed?: number;
}

/** How far a ball may be (along the floor) and still decide the take: further off, a swing is at nothing, and is drawn
 *  as its slot's usual take on the floor. */
const NEAR = 3.4;
/** Goal Rush's keeper: a guard this close to its own line with the ball coming is the keeper's set. */
const KEEPER = 7;
/** Sky Spike's block: a guard in the air this close to the net. */
const NET = 2.6;
/** The kit's keeper: a ball crossing this far or more to one side dives that way; one this close in time is parried. */
const DIVE = .9, PARRY = .45;
/** The kit's TACKLE: the one on the ball this close is met with the shoulder, further off with a slide. */
const CHARGE = 1.9;
/** The kit's overhead kick: from the air, a ball whose underside is over this share of the body and no further ahead
 *  than this share of its height. */
const OVERHEAD = {low: .5, ahead: .3} as const;
/** The six celebrations, by the moment: each a goal's scorer, a point's scorer, the podium deals from by `seed`. */
export const CELEBRATIONS: Readonly<Record<'goal' | 'point' | 'podium', readonly BallMoveKey[]>> = {
  goal: ['C.slide', 'C.pump', 'C.flex'], point: ['C.leap', 'C.point', 'C.pump'], podium: ['C.bow', 'C.flex', 'C.point'],
};
const SWINGS = new Set(['light', 'heavy', 'special']);

export function chooseBallMove(a: BallMoveAsk, kit = false): BallMoveKey | null {
  if (kit) return chooseKit(a);
  if (a.action === 'ultimate' || a.lock) return null;
  if (a.action === 'guard') {
    if (a.mode === 'goal-rush') return a.grounded && (a.fromGoal ?? Infinity) < KEEPER && a.incoming ? 'GR.keeper' : null;
    return !a.grounded && (a.fromNet ?? Infinity) < NET ? 'SS.wall' : null;
  }
  if (a.action !== 'light' && a.action !== 'heavy' && a.action !== 'special') return null;
  if (a.blows !== 1 || (a.style !== undefined && a.style !== 'melee')) return null;
  const near = a.ball && Math.hypot(a.ball.ahead, a.ball.left) < NEAR + a.ball.radius ? a.ball : undefined;
  // The height of the ball's underside, as a share of the body's.
  const low = near ? (near.up - near.radius) / a.height : 0;
  if (a.mode === 'goal-rush') {
    if (!a.grounded) return low > .35 ? 'GR.headAir' : 'GR.volley';
    // A ball whose underside is over the shoulders is headed; one round the knees and below is kicked.
    if (low > .62) return 'GR.head';
    return a.action === 'light' ? 'GR.pass' : 'GR.power';
  }
  // Sky Spike: an air blow over the net is a spike; a light keeps the ball on the side - a dig low, a set high.
  if (!a.grounded) return a.action === 'light' ? 'SS.setAir' : 'SS.spike';
  if (a.action !== 'light') return low < .4 ? 'GR.power' : null;
  if ((a.touch ?? 1) === 2 || low > .7) return 'SS.set';
  return 'SS.dig';
}

/** The kit's choice: the prototype's, and every move the kit adds. */
function chooseKit(a: BallMoveAsk): BallMoveKey | null {
  if (a.action === 'victory') return a.celebrate ? CELEBRATIONS[a.celebrate][Math.abs(Math.floor(a.seed ?? 0)) % 3] : null;
  if (a.action === 'ultimate') return null;
  // The carry: a run with the ball at the feet.
  if (a.action === 'run') return a.mode === 'goal-rush' && a.carrying && a.grounded ? 'GR.carry' : null;
  // Sky Spike's DIVE is its dash at a ball coming over: the diving dig (BallMatch DIG_DIVE). A dash to get somewhere -
  // the bots' most - keeps its own: drawn as dives, the court was full of bodies on the floor (33 in 45 s of bots).
  if (a.action === 'dash') return a.mode === 'sky-spike' && a.grounded && a.diving ? 'SS.pancake' : null;
  const melee = a.blows === 1 && (a.style === undefined || a.style === 'melee');
  if (a.lock) {
    // The FIGHT stance keeps its own kit, but for the TACKLE: one blow at the one on the ball.
    if (!SWINGS.has(a.action) || !melee || !a.grounded || !a.foe?.onBall) return null;
    return a.foe.distance <= CHARGE ? 'GR.shoulder' : 'GR.slide';
  }
  if (a.action === 'guard') {
    if (a.mode === 'sky-spike') return !a.grounded && (a.fromNet ?? Infinity) < NET ? 'SS.wall' : null;
    if (!a.grounded) return null;
    if ((a.fromGoal ?? Infinity) < KEEPER && a.incoming) {
      // The keeper: a ball crossing wide is dived at, one about to arrive at the body is punched clear, else the set.
      if (a.shot && Math.abs(a.shot.left) >= DIVE) return a.shot.left > 0 ? 'GR.diveL' : 'GR.diveR';
      return a.shot && a.shot.eta <= PARRY ? 'GR.parry' : 'GR.keeper';
    }
    return a.arriving ? 'GR.trap' : null;
  }
  if (!SWINGS.has(a.action) || !melee) return null;
  const near = a.ball && Math.hypot(a.ball.ahead, a.ball.left) < NEAR + a.ball.radius ? a.ball : undefined;
  const low = near ? (near.up - near.radius) / a.height : 0;
  if (a.mode === 'goal-rush') {
    if (!a.grounded) {
      // A ball above and behind, in the air: the overhead kick.
      if (near && low > OVERHEAD.low && near.ahead < OVERHEAD.ahead * a.height) return 'GR.bicycle';
      return low > .35 ? 'GR.headAir' : 'GR.volley';
    }
    if (low > .62) return 'GR.head';
    if (a.action === 'light') return 'GR.pass';
    // SHOOT: the tap's quick strike, or the charge's DRIVE (a heavy pressed outside SHOOT is the drive too).
    return a.strike === 'tap' ? 'GR.power' : 'GR.drive';
  }
  // Sky Spike: the serve; an air blow over the net is a spike (its arm by PLACEMENT), a light there a TIP or a jump set.
  if (a.serve) return a.grounded ? 'SS.float' : 'SS.jumpServe';
  if (!a.grounded) {
    if (a.action === 'light') return a.tip ? 'SS.tip' : 'SS.setAir';
    const p = a.place;
    if (p && p.f < 0 && -p.f >= Math.abs(p.a)) return 'SS.spikeRoll';
    if (p && p.a !== 0) return 'SS.spikeCut';
    return 'SS.spike';
  }
  if (a.action !== 'light') return low < .4 ? 'GR.power' : null;
  if ((a.touch ?? 1) === 2 || low > .7) return a.backSet ? 'SS.backSet' : 'SS.set';
  return 'SS.dig';
}
