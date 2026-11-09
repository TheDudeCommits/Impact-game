import {Vector4} from 'three';

/** How worked up the Ink Bowl's crowd is (0 calm, 1 on its feet): BallField raises it on the match's moments (a goal, a
 *  clash, a save off the line) and lets it settle; BallArena's crowd shader reads it as a uniform, to jump and throw its
 *  arms up. One for the page: there is one ball match at a time. */
export const crowdHype = {value: 0};
/** The match at its peak (0 to 1, eased): a Sky Spike FEVER rally, a Goal Rush overtime. BallField sets it from the view;
 *  BallArena's petals storm and turn gold on it, and the Ink Bowl's crowd stays on its feet. */
export const arenaMood = {value: 0};
/** Where a goal's ball met its net and when (xyz world metres, w the arena's clock in seconds, as BallArena's
 *  `update` is fed: performance.now() / 1000), and how far it bulges there (m). BallCeremony sets it on a goal; the goal
 *  nets' shader (BallArena) pushes the net out round that point and lets it spring back. */
export const goalNetHit = {value: new Vector4(0, 0, 0, -1e4)};
export const goalNetPower = {value: 0};
