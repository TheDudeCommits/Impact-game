import { LANDED } from '../../game/landedBlows';
import type { Fighter } from '../Fighter';

/** Round 3e (ULTFIX): the body a fighter's swing in progress landed on, if
 *  it has - its target, where the ledger of landed blows says the swing
 *  stands on them (LANDED: the prediction's for your own swing, the server's
 *  for everyone else's, a guard that took it included) - or undefined.
 *
 *  A technique's discharge on its contact frame - Storm Talon's and Sickle Bolt's
 *  burst of lightning, Setsu's - used to go off from the hand a metre and
 *  more in every direction whether the blow had landed or not, so a body
 *  standing just out of the blow's reach was drawn engulfed in it and took
 *  nothing (the third critic: "Shiden's Storm Talon: the lightning visibly
 *  engulfs a target at 2.6 m that takes nothing; it only hits at 2.2 m or
 *  closer"). The discharge goes into the body this names; with nobody named,
 *  it fizzles at the hand, inside the blow's own reach. */
export function struckBody(f: Fighter, fighters: ReadonlyMap<string, Fighter>): Fighter | undefined {
  const s = f.state;
  if (!s.target || s.actionSeq === undefined) return undefined;
  const victim = fighters.get(s.target);
  return victim?.state.alive && LANDED.landed(s.id, s.actionSeq, s.target, s.actionStarted) ? victim : undefined;
}
/** How far a discharge that found nobody reaches from the hand, in metres:
 *  the blow's own reach past the striking hand (MELEE_SLACK, 0.2 m) and a
 *  little more, so it reads as the charge spending itself in the air. */
export const FIZZLE_REACH = .32;
