import type {BallTeam, ShotKind} from './model';

/** A goal's replay, and a great point's (a FEVER point, a super shot, a saved match point, the match's last).
 *  The room picks the window of play to show and when every page shows it; each page plays it from the snapshots it
 *  kept (render/ball/BallReplay.ts), slowed round the strike that decided it, while the room holds the celebration. */
export interface BallReplay {
  kind: 'goal' | 'point';
  /** The play shown, in server seconds: from a little before the decisive strike to just after the ball went in. */
  from: number; to: number;
  /** The strike that decided it (server seconds): the replay slows right down round it. */
  key: number;
  /** When the pages show it, and when they stop (server seconds). Everyone voting to skip brings `until` forward. */
  at: number; until: number;
  team?: BallTeam; actorId?: string; shot?: ShotKind; speed?: number; text?: string;
  /** The skip vote: how many of the match's people have voted, of how many. */
  skips?: number; people?: number;
  /** A goal, or a Sky Spike kill on match point: the pages play its sequence first (the burst, the net, the lights, the
   *  scorer's close-up: render/ball/BallCeremony.ts), so the replay waits REPLAY.ceremony rather than REPLAY.delay. */
  ceremony?: boolean;
}

export const REPLAY = {
  /** Seconds of play before the goal, and after it. */
  lead: 2.6, tail: .6,
  /** The celebration seen live before the replay begins, and the beat after it before the next kickoff. */
  delay: 1.4, after: .5,
  /** The wait before a goal's replay (and a Sky Spike match point's kill): its burst and the scorer's close-up. */
  ceremony: 3,
  /** The replay's pace, and its slow motion round the decisive strike: so long before it and after it. */
  rate: .85, slow: .38, slowBefore: .25, slowAfter: .45,
  /** No replay runs longer than this; a long window plays a little quicker. */
  most: 5.2,
  /** Sky Spike's last point's beat before the results (its celebration, and its replay's wait). Its highlights are
   *  any FEVER point, super shot, match point and the match's last (BallMatch point; a long rally alone no longer). */
  lastPoint: 3.2,
} as const;

/** The replay's three stretches: before the decisive strike, round it (slowed), after it; each as its play length and
 *  its playback rate. */
function stretches(r: Pick<BallReplay, 'from' | 'to' | 'key'>) {
  const key = Math.min(r.to, Math.max(r.from, r.key));
  const a = Math.max(r.from, key - REPLAY.slowBefore), b = Math.min(r.to, key + REPLAY.slowAfter);
  const parts = [{span: a - r.from, rate: REPLAY.rate as number}, {span: b - a, rate: REPLAY.slow as number}, {span: r.to - b, rate: REPLAY.rate as number}];
  let length = parts.reduce((sum, p) => sum + p.span / p.rate, 0);
  if (length > REPLAY.most) { const k = length / REPLAY.most; for (const p of parts) p.rate *= k; length = REPLAY.most; }
  return {parts, length};
}

/** How long a window takes to play, in seconds. */
export const replayLength = (r: Pick<BallReplay, 'from' | 'to' | 'key'>) => stretches(r).length;

/** The play's time (server seconds) `elapsed` seconds into the replay, and the pace it is playing at there. */
export function replayClock(r: Pick<BallReplay, 'from' | 'to' | 'key'>, elapsed: number): {time: number; rate: number} {
  const {parts} = stretches(r);
  let left = Math.max(0, elapsed), time = r.from;
  for (const p of parts) {
    const seconds = p.span / p.rate;
    if (left <= seconds) return {time: time + left * p.rate, rate: p.rate};
    left -= seconds; time += p.span;
  }
  return {time: r.to, rate: parts[2].rate};
}
