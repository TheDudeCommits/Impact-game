import type {BallModeId, BallTeam} from './model';

/** The match's opening and its end, as the room times them, so
 *  every page of an online match shows them in step. Data and pure layout only; the pages draw them
 *  (render/ball/BallCeremony.ts).
 *
 *  The intro: a match that has one (not FREE PLAY, not a couch split screen) holds its countdown INTRO.seconds instead of
 *  BALL_RULES.countdown - the arena's flyover, then both sides on their marks as a manga splash page, then the whistle -
 *  before the kickoff or the serve. Everyone in the match can vote to skip it, as with a replay. */
export const INTRO = {
  /** Start to whistle, seconds. */
  seconds: 6.4,
  /** When the flyover gives way to the splash page, and when the referee's whistle goes. */
  splash: 4.1, whistle: 6,
  /** Once everyone has voted to skip: the kickoff this soon. */
  skipTo: .45,
} as const;
/** The short intro, for a rematch (PLAY AGAIN with the same
 *  people, a room's next match) or an arena this page has flown over already. No flyover: it is the full intro's tail -
 *  the splash page at once, the whistle, the kickoff - so it holds the countdown this long, and is skipped the same way. */
export const SHORT_INTRO = {seconds: INTRO.seconds - INTRO.splash} as const;

/** The podium at the end (Goal Rush on the centre spot facing the broadcast side line, Sky Spike in the winners' court
 *  with its back to the net): the winners' best in the middle on the top step, the other two either side. The room
 *  stands the bodies on it (BallMatch.finish) and the pages build the steps, the trophy and the lens round it. */
export const PODIUM = {
  /** Each step's top (m): the middle, then the two sides (the generated podium, public/assets/environment/own/ball-podium.glb,
   *  stretched to them: render/ball/BallCeremony.ts). */
  heights: [1.2, .66, .66] as const,
  /** Metres between the middle and each side, and the steps' depth. */
  spacing: 2.1, depth: 2,
  /** Seconds the finale holds the results for it. */
  seconds: 7.4,
  /** Sky Spike: how far into the winners' court it stands. */
  courtZ: 6,
} as const;

export interface PodiumLayout {
  /** Its centre on the floor, and the way it faces (the kernel's yaw: forward is (sin, cos)). */
  x: number; z: number; yaw: number;
  /** Where the bodies stand: the middle, then the two sides. */
  spots: readonly {x: number; y: number; z: number}[];
  /** Where the ball rests, beside it. */
  ball: {x: number; z: number};
}

export function podiumOf(mode: BallModeId, team: BallTeam): PodiumLayout {
  const s = team === 'red' ? -1 : 1;
  const x = 0, z = mode === 'goal-rush' ? 0 : s * PODIUM.courtZ;
  const yaw = mode === 'goal-rush' ? -Math.PI / 2 : s < 0 ? Math.PI : 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const spots = [0, -1, 1].map((k, i) => ({x: x + rx * k * PODIUM.spacing, y: PODIUM.heights[i], z: z + rz * k * PODIUM.spacing}));
  // The ball rests at the end of the lower step on the right, a little forward: in the frame, not in front of anyone.
  const out = PODIUM.spacing * 1.5 + 1.2, ahead = PODIUM.depth * .3;
  return {x, z, yaw, spots, ball: {x: x + rx * out + fx * ahead, z: z + rz * out + fz * ahead}};
}
