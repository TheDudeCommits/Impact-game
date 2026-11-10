import {GOAL_RULES, type BallTeam} from '../../game/ball/model';
import type {PlayerState} from '../../game/types';

/** The scorer's team-mates run to them, on the page only: through a goal's sequence the room
 *  holds every body where it stood (the bots stand, a person's page holds their input for the close-up), so the page
 *  draws the scorer's side running in to them instead - each after its own breath of RUN_AFTER, at RUN_SPEED, easing to
 *  a stop at its place beside the scorer and turning to them - until the replay or the kickoff puts every body back
 *  where the room has it. A body too far off is seen still running in when the sequence ends.
 *
 *  Each one's place is beside the scorer and a step behind them, as the close-up's lens looks (BallCeremony `closeUp`:
 *  SPOT_OFF off the line from the lens through the scorer, SPOT_REACH from them), so the close-up has the scorer in front
 *  and their side round them, nobody between the lens and the scorer. */
export const RUN_AFTER = [.12, .26] as const, RUN_SPEED = 7.5, SPOT_REACH = 1.75, SPOT_OFF = 1.05;
const SETTLE = .8;

interface Mate { id: string; fromX: number; fromZ: number; spotX: number; spotZ: number; after: number; state: PlayerState | null }

/** Where a team-mate's run has them `t` seconds after the goal (pure, for the checks): from (fx, fz) toward the spot, at
 *  RUN_SPEED once `after` has passed, easing into it over its last SETTLE metres; and whether they are still running. */
export function runAt(fx: number, fz: number, sx: number, sz: number, after: number, t: number) {
  const dx = sx - fx, dz = sz - fz, d = Math.hypot(dx, dz), go = Math.max(0, t - after) * RUN_SPEED;
  if (d < 1e-3) return {x: sx, z: sz, running: false, dx: 0, dz: 0};
  // The run at speed, then the last SETTLE metres eased (a quarter-sine to a stop).
  const flat = Math.max(0, d - SETTLE), covered = go <= flat ? go : flat + SETTLE * Math.sin(Math.min(1, (go - flat) / (SETTLE * Math.PI / 2)) * Math.PI / 2);
  const k = Math.min(1, covered / d);
  return {x: fx + dx * k, z: fz + dz * k, running: k < 1 && go > 0, dx: dx / d, dz: dz / d};
}

/** The scorer's place among their side: each team-mate's spot round the scorer at (x, z), for a lens at heading `lens`
 *  (the way the lens looks at the scorer, radians as the simulation's yaw), kept inside the pitch's walls. */
export function spotsFor(x: number, z: number, lens: number, count: number, out: {x: number; z: number}[]) {
  const away = lens; // straight on from the lens, past the scorer
  const R = GOAL_RULES, wx = R.halfX - .8, wz = R.halfZ - .6;
  for (let i = 0; i < count; i++) {
    const a = away + (i % 2 ? -1 : 1) * SPOT_OFF * (1 + Math.floor(i / 2) * .5);
    const p = out[i] ?? (out[i] = {x: 0, z: 0});
    p.x = Math.max(-wx, Math.min(wx, x + Math.sin(a) * SPOT_REACH));
    p.z = Math.max(-wz, Math.min(wz, z + Math.cos(a) * SPOT_REACH));
  }
  return out;
}

/**
 * The run in, for BallCeremony: begun at a goal with where the scorer's side stood, aimed when the close-up's lens is
 * known, and asked for each body as the page draws it (`posed`). Nothing allocates in a frame once a goal has begun (each
 * body's drawn state is one kept object, refilled).
 */
export class GoalHuddle {
  private mates: Mate[] = [];
  private scorer = ''; private at = -Infinity; private on = false;
  private sx = 0; private sz = 0;
  private readonly spots: {x: number; z: number}[] = [];

  /** A goal at page time `page`: the scorer and their side as the room has them now. */
  begin(scorer: PlayerState, team: BallTeam, players: readonly PlayerState[], seats: readonly {id: string; team: BallTeam}[], page: number) {
    this.mates.length = 0; this.scorer = scorer.id; this.at = page; this.on = true; this.sx = scorer.x; this.sz = scorer.z;
    let n = 0;
    for (const seat of seats) {
      if (seat.team !== team || seat.id === scorer.id) continue;
      const p = players.find(q => q.id === seat.id);
      if (!p || !p.alive) continue;
      this.mates.push({id: seat.id, fromX: p.x, fromZ: p.z, spotX: p.x, spotZ: p.z, after: RUN_AFTER[n++ % 2], state: null});
    }
    // (Until the close-up says where its lens is: the scorer's front, as its first try is.)
    this.aim(scorer.yaw + Math.PI);
  }
  /** The close-up's lens: looking at the scorer along heading `lens`. */
  aim(lens: number) {
    spotsFor(this.sx, this.sz, lens, this.mates.length, this.spots);
    this.mates.forEach((m, i) => { m.spotX = this.spots[i].x; m.spotZ = this.spots[i].z; });
  }
  /** The ones running in, for the close-up's check that nobody stands between it and the scorer: their places. */
  spotOf(id: string) { const m = this.mates.find(q => q.id === id); return m ? this.spots[this.mates.indexOf(m)] : undefined; }
  get active() { return this.on; }
  stop() { this.on = false; }

  /** A body as the page draws it now (`page` seconds): a team-mate on their run, everyone else as given. */
  posed(id: string, state: PlayerState, page: number): PlayerState {
    if (!this.on) return state;
    let m: Mate | undefined;
    for (let i = 0; i < this.mates.length; i++) if (this.mates[i].id === id) { m = this.mates[i]; break; }
    if (!m) return state;
    const run = runAt(m.fromX, m.fromZ, m.spotX, m.spotZ, m.after, page - this.at);
    const out = m.state ?? (m.state = {...state});
    Object.assign(out, state);
    out.x = run.x; out.z = run.z;
    // Facing the way they run, then the scorer.
    out.yaw = run.running ? Math.atan2(run.dx, run.dz) : Math.atan2(this.sx - run.x, this.sz - run.z);
    return out;
  }
}
