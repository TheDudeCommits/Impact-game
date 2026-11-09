import type {BallModeId} from '../../game/ball/model';

/** Ball modes, sports moves: which of the shared file's takes
 *  (ballMoves.ts, public/assets/fighters/ball-moves.glb) a swing in a ball match is drawn with, or none - the fighter's
 *  own clip. Presentation only: the blow, its timing and what it does to the ball are the simulation's (strike.ts); the
 *  take is chosen to look like what the ball is about to do, read off the slot, the body (on the floor or in the air),
 *  where the ball will be when the blow lands, the mode and the side's touch.
 *
 *  Never chosen: Goal Rush's FIGHT stance (the kit is the opponent's), the ultimate (a SUPER SHOT keeps its own show), a
 *  move of many blows (one take cannot land them all), a move that is not a melee blow (a beam, a shot or a field
 *  blasts the ball along its line and looks like one), and any mode but these two. */
export type BallMoveKey = 'GR.pass' | 'GR.power' | 'GR.volley' | 'GR.head' | 'GR.headAir' | 'GR.keeper'
  | 'SS.dig' | 'SS.set' | 'SS.setAir' | 'SS.spike' | 'SS.wall';

export interface BallMoveAsk {
  mode: BallModeId;
  /** The action starting: an attack slot, or `guard`. */
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
}

/** How far a ball may be (along the floor) and still decide the take: further off, a swing is at nothing, and is drawn
 *  as its slot's usual take on the floor. */
const NEAR = 3.4;
/** Goal Rush's keeper: a guard this close to its own line with the ball coming is the keeper's set. */
const KEEPER = 7;
/** Sky Spike's block: a guard in the air this close to the net. */
const NET = 2.6;

export function chooseBallMove(a: BallMoveAsk): BallMoveKey | null {
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
