import type {BallTeam, ShotKind} from './model';

/** A goal's replay, and a great point's (a FEVER point, a super shot, a saved match point, the match's last, a PERFECT
 *  SPIKE that ends a rally). Only the goals that earned one (REPLAY.screamer), and from one angle only - the best for
 *  it (render/ball/BallReplay.ts).
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
  /** The skip vote: how many of the match's people have voted, of how many. (Any one of the scoring side's people
   *  ends it at once, as does the one person of a match against bots.) */
  skips?: number; people?: number;
  /** A goal, or a Sky Spike kill on match point: the pages play its sequence first (the burst, the net, the lights, the
   *  scorer's close-up: render/ball/BallCeremony.ts), so the replay waits REPLAY.goalCeremony (a goal) or
   *  REPLAY.ceremony (a kill) rather than REPLAY.delay. */
  ceremony?: boolean;
}

export const REPLAY = {
  /** Seconds of play shown before the goal at least, before the decisive strike at least, and after the goal: the
   *  finish and the touch that set it, not the whole build-up. */
  lead: 1.4, before: .8, tail: .3,
  /** The celebration seen live before the replay begins, and the beat after it before the next kickoff or serve (the
   *  wipe out of a replay reveals the kickoff). */
  delay: .8, after: .1,
  /** The wait before a Sky Spike match point's kill's replay: its burst and the scorer's close-up. */
  ceremony: 1.8,
  /** Goal Rush's own: the wait before a goal's replay - its burst, the net, and the scorer's close-up - and its longest
   *  replay: a goal's sequence and its replay together are under five seconds, and under six with the kickoff after
   *  them. */
  goalCeremony: 1.6, goalMost: 3,
  /** The replay's pace, and its slow motion round the decisive strike: so long before it and after it (the strike is
   *  the replay; the run to it plays nearly at speed). */
  rate: .9, slow: .4, slowBefore: .2, slowAfter: .4,
  /** No replay runs longer than this; a long window plays a little quicker. */
  most: 3.2,
  /** Sky Spike's last point's beat before the results (its celebration, and its replay's wait). Its highlights are
   *  any FEVER point, super shot, match point and the match's last (BallMatch point; a long rally alone no longer), and
   *  a PERFECT SPIKE that ends a rally of `perfectRally` crossings or more. */
  lastPoint: 2.4, perfectRally: 4,
  /** Play back fast: a goal is played again only when it earned it
   *  (BallMatch.earned) - a SUPER GOAL, a PERFECT STRIKE, VOLLEY or HEADER, a flair shot (BICYCLE KICK), a LINK SHOT,
   *  a screamer at `screamer` km/h or more, a BUZZER BEATER, a COMEBACK, a golden goal. About two goals in five, in
   *  the bot sims; every other goal is its sequence (the net, the burst, the lights, the scorer's close-up) and then the
   *  kickoff. */
  screamer: 120,
  /** The skip (BallMatch.skip): a vote counts this long after the goal or point (a press already on its way when the
   *  ball went in is no vote), and once it is in the scoring side's say - any one of its people, or everyone in the
   *  match - the kickoff or serve follows `after` later. */
  skipFrom: .4,
} as const;

/** The replay's three stretches: before the decisive strike, round it (slowed), after it; each as its play length and
 *  its playback rate. A goal's replay is held to REPLAY.goalMost, any other to REPLAY.most. */
function stretches(r: Pick<BallReplay, 'from' | 'to' | 'key'> & {kind?: BallReplay['kind']}) {
  const key = Math.min(r.to, Math.max(r.from, r.key));
  const a = Math.max(r.from, key - REPLAY.slowBefore), b = Math.min(r.to, key + REPLAY.slowAfter);
  const parts = [{span: a - r.from, rate: REPLAY.rate as number}, {span: b - a, rate: REPLAY.slow as number}, {span: r.to - b, rate: REPLAY.rate as number}];
  let length = parts.reduce((sum, p) => sum + p.span / p.rate, 0);
  const most: number = r.kind === 'goal' ? REPLAY.goalMost : REPLAY.most;
  if (length > most) { const k = length / most; for (const p of parts) p.rate *= k; length = most; }
  return {parts, length};
}

/** How long a window takes to play, in seconds. */
export const replayLength = (r: Pick<BallReplay, 'from' | 'to' | 'key'> & {kind?: BallReplay['kind']}) => stretches(r).length;

/** The play's time (server seconds) `elapsed` seconds into the replay, and the pace it is playing at there. */
export function replayClock(r: Pick<BallReplay, 'from' | 'to' | 'key'> & {kind?: BallReplay['kind']}, elapsed: number): {time: number; rate: number} {
  const {parts} = stretches(r);
  let left = Math.max(0, elapsed), time = r.from;
  for (const p of parts) {
    const seconds = p.span / p.rate;
    if (left <= seconds) return {time: time + left * p.rate, rate: p.rate};
    left -= seconds; time += p.span;
  }
  return {time: r.to, rate: parts[2].rate};
}
