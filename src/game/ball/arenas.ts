import type {BallModeId} from './model';

/** The ball modes' arenas: each mode has three places to play in, all the same size
 *  and shape for the rules (the walls, goals, net and bounds never move), each with a look of its own and one twist on
 *  the ball's flight. The renderer builds each (src/render/ball), the match reads its twist (BallMatch, physics.ts).
 *
 *  Their stage ids stay the two the modes always had ('ball-pitch', 'ball-court'): an arena is the place's dressing and
 *  the ball's ground, not a new stage. */
export type BallArenaId = 'ink-bowl' | 'dust-yard' | 'rain-roof' | 'sky-court' | 'tide-court' | 'ember-rim';

export interface BallArenaDef {
  id: BallArenaId;
  mode: BallModeId;
  /** On screen: the place's name (no lettering in the place itself). */
  name: string;
  /** One line for the mode sheet and the loading screen. */
  blurb: string;
  /** The twist, as multipliers on the mode's own numbers (1 = as the mode always was). */
  twist: {
    /** The ball's rolling and sliding loss on the ground (sand drags, rain skids). */
    groundFriction: number;
    /** How much speed a bounce off the ground keeps. */
    groundBounce: number;
    /** A steady wind, m/s² across the place (x, z), turned by the match between points. */
    wind?: number;
    /** Heat the ball starts each kickoff or serve with (0..4). */
    startHeat?: number;
    /** Heat the ball never cools below here (the place itself keeps it warm). */
    heatFloor?: number;
  };
}

export const BALL_ARENAS: Readonly<Record<BallArenaId, BallArenaDef>> = {
  'ink-bowl': {id: 'ink-bowl', mode: 'goal-rush', name: 'The Ink Bowl', blurb: 'A floodlit night in a bowl of carved stone.',
    twist: {groundFriction: 1, groundBounce: 1}},
  'dust-yard': {id: 'dust-yard', mode: 'goal-rush', name: 'The Wreck Yard', blurb: 'Sand inside a ring of beached hulls: the ball drags and dies.',
    twist: {groundFriction: 1.7, groundBounce: .78}},
  'rain-roof': {id: 'rain-roof', mode: 'goal-rush', name: 'Rain Roof', blurb: 'A rooftop over the city in the rain: the ball skids and runs.',
    twist: {groundFriction: .55, groundBounce: .92}},
  'sky-court': {id: 'sky-court', mode: 'sky-spike', name: 'The Sky Court', blurb: 'Above the clouds at sunset.',
    twist: {groundFriction: 1, groundBounce: 1}},
  'tide-court': {id: 'tide-court', mode: 'sky-spike', name: 'Tide Court', blurb: 'A beach at dusk: the sea wind carries every ball.',
    twist: {groundFriction: 1.3, groundBounce: .85, wind: 1.6}},
  'ember-rim': {id: 'ember-rim', mode: 'sky-spike', name: 'Ember Rim', blurb: 'On the lip of a volcano: the ball starts hot.',
    twist: {groundFriction: 1, groundBounce: 1.05, startHeat: 1.6, heatFloor: 1.1}},
};

/** Each mode's arenas, its first the one it always had. */
export const MODE_ARENAS: Readonly<Record<BallModeId, readonly BallArenaId[]>> = {
  'goal-rush': ['ink-bowl', 'dust-yard', 'rain-roof'],
  'sky-spike': ['sky-court', 'tide-court', 'ember-rim'],
};

/** The arena a match plays in when nobody picked one: the mode's arenas in turn, by the match's seed. */
export function arenaFor(mode: BallModeId, seed: number): BallArenaId {
  const list = MODE_ARENAS[mode];
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export const isBallArena = (value: unknown): value is BallArenaId => typeof value === 'string' && value in BALL_ARENAS;
