import {GOAL_RULES, type BallState, type BallTeam} from './model';
import {PLAYER_RADIUS} from '../moves';
import type {Vec3} from '../types';

/**
 * Goal Rush's SPORT mode: football played by the fighters - in the SPORT stance the buttons are the sport's, in the FIGHT
 * stance their usual fighting buttons. Behind `?football` in the address, in matches on this device only (LocalBall):
 * the online room never sets it, so nothing here is on its wire.
 *
 * Tab still switches the two stances: FIGHT is today's FIGHT stance, unchanged; SPORT replaces the BALL stance. In SPORT
 * no fighting move plays the ball. The match (BallMatch) takes the presses off the command before the combat kernel sees
 * them and plays the ball itself, so the body keeps its run through every touch and nothing it does takes the stick away:
 *
 * - **Possession first.** A body that meets a ball it can control (`controls`: low and slow enough against its own run)
 *   has it at its feet - the carry (BallMatch CARRY), at `pace` of its run and never let go with the stick. A pass coming
 *   in is taken the same way: the first touch is automatic. Sprinting (the boost) knocks it on ahead (`knock`) and back,
 *   looser: an opponent reaching it while it is out takes it. A carried ball is otherwise shielded: only an opponent
 *   meeting it from in front of the carrier (`front`) takes it off them (there is no TACKLE button in SPORT yet).
 * - **PASS** (the light): to the team-mate the stick points at (else the view), led into their run (`passTo`). A tap rolls
 *   along the floor; held `press.tap` s or more it is lofted to the same spot. Without the ball it is a call for it.
 * - **SHOOT** (the heavy): a tap is placed (`shot.tap` m/s); held, it winds up to `shot.full` over `shot.wind` s, the run
 *   slowed to `shot.slow` while the stick still steers. Aimed with the view, the stick across it bending the aim, and put
 *   inside the post when its line is near the frame (`shotAt`).
 * - A press made just before the ball arrives (`press.buffer`) plays it first time.
 */
export const FOOTBALL = {
  /** The ball: 0.6 m across (the classic ball is 1.6 m; a real one 0.22), as a share of the classic radius
   *  (BallState.size, which the physics and the page already scale by), floatier gravity gone (10.5 of 13) and the floor
   *  rolling it shorter (BallState.ground: 3 of 2.4). The page keeps its ground ring lit (BallField). (Started at 0.44 m:
   *  from the chase camera at 35 m it was 6.4 px tall at 1280 x 720 and 3.5 px on a phone at 844 x 390, which did not
   *  read at a glance on the phone; 0.3 m of radius is as large as it may be.) */
  radius: .3, gravity: 10.5, roll: 3,
  /** Control (`controls`): a ball whose centre is at most `low` m over its rest height, coming at the body no faster than
   *  `slow` m/s against the body's own run, or one up to `chest` m high no faster than `chestSlow`, rising or falling no
   *  faster than `lift`. Faster or higher balls bounce off the body as they always have: a block. */
  control: {low: .45, slow: 18, chest: 2.3, chestSlow: 10, lift: 5},
  /** A body controls (and an opponent takes) the ball this much further out than its bounds meet it: four bodies round a
   *  ball at rest stand off it by their own bounds, and none could reach it. */
  reach: .3,
  /** The side's keeper (today's keeper role, a bot, inside its own box: `box` m out from its line, `wide` m either side)
   *  gathers what it reaches: `reach` m out from its bounds, as fast as `slow` m/s (`chestSlow` up to `chest` m, its
   *  hands) - a shot it gets to is caught and is a save. */
  keeper: {reach: .3, slow: 19, chest: 2.6, chestSlow: 17, box: 6, wide: 7},
  /** Each side's keeper is a fourth body the game plays (`on`), stood `line` m off its line at the kickoff -
   *  three a side outfield, so a PASS always has two team-mates to choose from and no person keeps goal. */
  keeper4: {on: true, line: 1.2},
  /** The carry: the body runs at `pace` of its speed (the boost's too), the ball `gap` m in front of it, turned round it at
   *  up to `turn` rad/s toward the stick (`steer` of the stick or more). */
  pace: .94, gap: .12, turn: 12, steer: .3,
  /** Sprinting with it: every `every` s it is knocked `out` m on ahead along a half-sine and comes back to the feet; while it
   *  is more than `live` m out an opponent reaching it takes it. */
  knock: {every: .6, out: 1.5, live: .5},
  /** An opponent meeting a carried ball takes it when they come from within `front` radians of the carrier's heading,
   *  and not in the carrier's first `settle` s on it (a ball just taken is theirs a moment). */
  front: 50 * Math.PI / 180, settle: .35,
  /** A kicker lets its own ball go for `again` s; one who lost it to the other side, `lost` s. */
  again: .25, lost: .5,
  /** A press is kept `buffer` s for a ball still on its way (first time); a key let go inside `tap` s is a tap. A hold is
   *  played as the key comes up, or at `most` s. */
  press: {buffer: .3, tap: .2, most: 1.2},
  /** PASS: along the floor it arrives at `arrive` m/s plus `perM` a metre, never launched faster than `most`; lofted, it
   *  lands at the led spot after `loftT` s plus a metre's `loftPerM`. The team-mate nearest the stick's (or the view's)
   *  line within `cone` radians, `near`-`far` m off; nobody: a pass into space `space` m on. */
  pass: {arrive: 13, perM: .2, most: 26, loftT: .55, loftPerM: 1 / 18, cone: 45 * Math.PI / 180, near: 2.5, far: 32, space: 12, rounds: 3, wall: 1.2},
  /** SHOOT: a tap `tap` m/s; held, `tap` to `full` over `wind` s, the run at `slow` meanwhile. The stick across the view
   *  bends the aim up to `bend` rad. A line within `help` m of the frame and `reach` half-lengths of the goal is laid inside
   *  the post (`inset` m in from it), at `lowY` m (a tap) to `highY` (full), under the bar. The run adds `momentum` of
   *  itself along the aim, at most `runMost`. */
  shot: {tap: 26, full: 34, wind: .7, slow: .85, bend: .2, help: 2.5, reach: 1.25, inset: .15, lowY: .6, highY: 2.2, momentum: .5, runMost: 6.5},
  /** SPRINT is the boost (BALL_SPORT: 13.5 m/s on 42 of the bar a second, the bar 225): the bar comes back `refill`
   *  times as fast as a fighter's stamina does (STAMINA_REGEN 32 a second, so 48), so a two-second run (84 of it) is
   *  back in under two seconds and a full bar in under five. */
  sprint: {refill: 1.5},
  /** TACKLE (the guard's button): pressed with one of the other side carrying the ball, a standing POKE reaches
   *  `reach` m from the tackler's body to the ball for `live` s and wins it clean to the tackler's feet; pressed on the
   *  boost it is a SLIDE - `slide.reach` m, within `slide.cone` rad of the run, for `slide.live` s - that knocks the ball
   *  loose ahead at `slide.pop` m/s, and a slide that wins nothing leaves the slider down `slide.down` s. Again after
   *  `again` s. No fouls. (A short poke is a timing; the slide's reach costs the slider the next moment when it misses.) */
  tackle: {reach: 1.3, live: .15, again: .5, slide: {reach: 2.6, cone: 1.05, live: .35, pop: 6, down: .6},
    /** The contest (steals came too often - about 16 in 80 s of play): a POKE wins only from within `front` rad of
     *  the carrier's run - one who has turned the ball away from the tackler shields it, and the poke misses. A miss (a
     *  poke shielded or out of reach in its time, a slide that wins nothing) costs the tackler `missPace` of its run for
     *  `miss` s and no tackle again for `missAgain` s; the carrier who loses it takes one checked stride - `checkPace` for
     *  `check` s - and lets it go `lost` s. So a miss costs the tackler about four times what a win costs the carrier.
     *  A slide that misses: `slideMissPace` for `slideMiss` s (a stumble, never a knockdown: that is the FIGHT stance's). */
    front: 70 * Math.PI / 180, missPace: .55, miss: .5, missAgain: 1, checkPace: .6, check: .25, slideMissPace: .35, slideMiss: .6},
  /** The TRICK (the special's button, with the ball): the carrier jinks `jink` rad off its run; a TACKLE that lands inside
   *  `window` s of it misses and leaves the tackler BEATEN, unable to tackle again for `beaten` s (the REVERSAL's idea,
   *  in the sport's clothes). Again after `again` s. */
  trick: {window: .25, beaten: .4, again: 1.2, jink: 1.1},
  /** A person's PASS without the ball calls for it: their side's bots carrying it look for them first for `call` s. */
  call: 2.5,
  /** The person at the heart of it.
   *  - `kickoff`: one side kicks off - the person's at the start, then the side that conceded - its taker stood `spot` m
   *    behind the ball, the ball at its feet the moment play is live; on the person's side the person is the taker.
   *  - `kind`: a team-mate's pass meant for a person (`for` s after it is struck) is taken cleanly: met `reach` m further
   *    out, as fast as `slow` m/s against their run (up to `chest` m high at `chestSlow`, rising or falling at `lift`) -
   *    unless one of the other side is within `rival` m of the person; a bot it is meant for takes it as cleanly from its
   *    own reach.
   *  - `tapAim`: a tapped PASS or SHOOT goes where the stick pointed as the key went down (a hold, where it points as the
   *    key comes up) - what you pressed is what you get.
   *  - `keeperOff`: a PASS picks the side's own keeper only when the stick is plainly on them (this many radians further
   *    off than a field player counts).
   *  - `corner`: a person's SHOOT whose line crosses the goal within `within` of its half-width from the middle goes for
   *    the corner away from the keeper, `in` m inside the post's inset (shotAt `open`): the star's finish.
   *  - `fresh`: a person's ball just won (received, tackled, picked up) is theirs `fresh` s by the bots' level - a POKE
   *    in that time is shielded, as one into a bot's is for FOOTBALL.settle s - so it is never poked straight back.
   *  - `full`: a SHOOT held to `charge` or more of its wind-up is a full-power shot - the ball hangs `stop` s at the boot
   *    (the hit-stop), and the page kicks the camera of whoever is near (render/ball/BallMoments.ts). */
  fun: {kickoff: {spot: 1}, kind: {reach: .55, slow: 32, chest: 2.4, chestSlow: 22, lift: 9, rival: 1.1, for: 3}, tapAim: true, keeperOff: .35, corner: {within: .5, in: .3}, full: {charge: .95, stop: .08}, fresh: {easy: 1, normal: .8, hard: .45}},
  /** A match a person can win (keepers that conceded most close shots, passes that were cut out and a person's side that
   *  lost its NORMAL matches before these):
   *  - `keeper`: a keeper in its box (FOOTBALL.keeper) meets a shot on target as fast as `from` m/s or more that will pass
   *    within its dive of its body - `dive` m (by its level) past its catching reach, no higher than `high` m - inside
   *    the next `ahead` s: caught at its feet up to `catch` m/s with the line close to its body (`hands` m past its
   *    bounds), else pushed out wide (`push` m/s across, `up` m/s up, `keep` of its pace back off the line). A shot placed
   *    beyond that - the corner away from it - beats it; one at it, near its body, is saved. The dive comes `react` s after
   *    the shot and is whole `full` s later (a shot from close in meets only the body), and a keeper stands set while a
   *    shot is on its way (sportBrain.ts spKeep): it does not run across with the ball.
   *  - `pass`: a person's PASS (football.ts personPass) goes to the best open team-mate within `cone` rad of the stick (with
   *    nobody there, within `wide`)
   *    (by how far off the stick they are, `blocked` worse with one of theirs in the lane, `marked` worse with one of theirs
   *    within `tight` m of them); with the one in the lane within `chip` m of the ball, and the team-mate `chipFrom` m off
   *    or more, it is chipped over them (lofted); further along, it is led round them - `round` m to one side of the
   *    team-mate, the side the lane clears on, ahead along their run as it is led.
   *  - `aim`: a person's SHOOT from within `range` m of the goal they attack, the view within `within` rad of it, goes on
   *    frame - at the corner the stick is across to (`side` of the stick or more across the view), else the one away from
   *    the keeper (the person aims the corner; the game puts it on target).
   *  - `kick`: a tapped PASS or SHOOT with the ball at the feet leaves `pass` / `shot` s after its key (a first-time one at
   *    once): the wind-up, drawn by the page from BallState.wind (and windTap), then the contact.
   *  - `tackle`: a person's POKE wins from within `front` rad of the carrier's run (by level; a bot's, FOOTBALL.tackle.front):
   *    from beside as well as in front, only from behind is it shielded; a person's missed poke slows them to `missPace`
   *    for `miss` s and no tackle again for `missAgain` s; a person's poke is live `live` s and reaches `reach` m further.
   *  - `shield`: a bot shielding the ball from one of theirs on it plays it on after `most` s whatever the options - the
   *    best there is, else a ball lofted on into space up the pitch (one held it for 50 s against the scripted person).
   *  - `support`: a side's support with the other side on the ball within `box` m of its goal holds the space at the edge
   *    of its box (`edge` m out, `far` m across on the far side of the ball) and stands no nearer the ball than `off` m: at
   *    most two (the one pressing and its cover) go to the ball near the box. */
  fun2: {keeper: {from: 14, dive: {easy: .7, normal: 1.25, hard: 1.95}, react: .06, full: .25, high: 2.5, ahead: .06, catch: 30, hands: .35, push: 9, up: 4.5, keep: .35},
    aim: {range: 20, within: 55 * Math.PI / 180, side: .5},
    kick: {pass: .09, shot: .12},
    tackle: {front: {easy: 125 * Math.PI / 180, normal: 108 * Math.PI / 180, hard: 90 * Math.PI / 180}, miss: .3, missPace: .8, missAgain: .45, live: .3, reach: .25},
    shield: {most: 2.2},
    pass: {cone: 62 * Math.PI / 180, wide: 100 * Math.PI / 180, blocked: .55, marked: .6, tight: 1.8, chip: 3.2, chipFrom: 7, round: [2, 3.2, -2, -3.2]}, support: {box: 15, edge: 7, far: 3.5, off: 6}},
  /** So a person's passes get through and their pokes win (else about half the passes are cut out and a poke wins about
   *  1 in 10):
   *  - `pass`: a person's PASS along the floor leaves quicker (`arrive` m/s plus `perM` a metre, at most `most`), and is
   *    played only where it gets through (personPass, passMargin): along the floor no rival may reach its line before it
   *    passes - a rival `reach` m off it gets there, and one further off runs to it at `run` m/s after `react` s (at once
   *    within `close` m of the ball) - nor stand
   *    within `mark` m of the team-mate as it arrives (the last `near` m of it); lofted, none within `loftMark` m of where
   *    it lands. The pass gets past the one pressing the passer - any of theirs within `atBall` m of the ball as it is
   *    struck lets it by for its first `clear` s (a chip's, `loftClear`: it has left the foot - else the presser takes
   *    it off the boot a tick after it leaves). Of the team-mates the stick is toward, the first played clear of them: straight, led round, or chipped
   *    (from `chipFrom` m); none: another team-mate within the wide cone who can be; none at all, the stick's pick chipped
   *    over them (never rolled into a rival's feet). With nobody near the stick it is a pass into space, as aimed.
   *  - `tackle`: a person's POKE is live `live` s and reaches `reach` m further (by level) than a bot's, and wins from
   *    within `front` rad of the carrier's run (by level: in front and beside it - FOOTBALL.fun2.tackle.front's 125 / 108 /
   *    90 degrees cut the side off) - and against a bot's ball just taken from `settle` s on (a bot's FOOTBALL.settle): a poke timed as the
   *    ball arrives, from in front or beside, lands; from behind it is still shielded.
   *  - `aim`: a person's SHOOT put on frame (FOOTBALL.fun2.aim) goes for the corner `aim` m inside the post's inset by the
   *    other side's level (in place of FOOTBALL.fun.corner.in, 0.3, for all): a HARD keeper's dive reaches what an EASY
   *    one's does not.
   *  - `botHelp`: a bot's SHOOT whose line runs outside the frame is laid inside the post only from this near it (m;
   *    a person's FOOTBALL.shot.help, 2.5): a bot's aim's error by level (sportBrain SPORT_BOT `aim`) is a shot wide or
   *    off the post, not the corner - with a person's help rival bots score 40-60% of their shots, most a corner the help
   *    lays.
   *  - `mates`: a person's team-mates' level by the level picked (BallBrain BOT_LEVELS' `mates`, NORMAL's own on NORMAL,
   *    puts the person on top of an even side: they win nearly every match); their keeper dives as a `matesKeeper` one
   *    (an EASY keeper behind the person concedes every shot it faces). */
  fun3: {pass: {arrive: 15, perM: .25, most: 28, reach: 1.35, atBall: 1.5, clear: .4, loftClear: .4, close: 3, run: 8.5, react: .2, near: 1.8, mark: 1.3, loftMark: 2.2, chipFrom: 5},
    tackle: {live: .42, reach: {easy: .65, normal: .5, hard: .3}, front: {easy: 135 * Math.PI / 180, normal: 122 * Math.PI / 180, hard: 100 * Math.PI / 180}, settle: .12},
    aim: {easy: .3, normal: .4, hard: .65}, botHelp: 0, mates: {easy: 'normal', normal: 'easy', hard: 'easy'}, matesKeeper: 'normal'},
} as const;

/** Whether a body takes a team-mate's pass meant for a person (FOOTBALL.fun.kind) - the person's first
 *  touch, kind. `rel` the ball's speed against the body's run, `r` its radius, `over` its centre over the body's feet. */
export function kindTouch(b: BallState, r: number, rel: number, body: {grounded: boolean; alive: boolean; reeling: boolean; locked: boolean; stunned: boolean; y: number}) {
  const K = FOOTBALL.fun.kind, over = b.y - body.y - r;
  if (b.held || b.super || !body.alive || body.reeling || body.locked || body.stunned || Math.abs(b.vy) > K.lift) return false;
  return over <= FOOTBALL.control.low + .2 ? rel <= K.slow : b.y - body.y <= K.chest && rel <= K.chestSlow;
}

/** The classic ball's radius times this is SPORT's (BallState.size). */
export const FOOTBALL_SIZE = FOOTBALL.radius / GOAL_RULES.ballRadius;

/** Whether a body meeting the ball takes it under control (FOOTBALL.control): `rel` the ball's speed against the body's
 *  run, `r` the ball's radius. */
export function controls(b: BallState, r: number, rel: number, body: {grounded: boolean; alive: boolean; reeling: boolean; locked: boolean; stunned: boolean; y: number}, keeper = false) {
  const C = keeper ? {...FOOTBALL.control, ...FOOTBALL.keeper} : FOOTBALL.control, over = b.y - body.y - r;
  if (b.held || b.super || !body.alive || !body.grounded || body.reeling || body.locked || body.stunned || Math.abs(b.vy) > C.lift) return false;
  return over <= C.low ? rel <= C.slow : b.y - body.y <= C.chest && rel <= C.chestSlow;
}

/** Where a carried ball sits in SPORT: `gap` m in front of the body along `heading`, plus `ahead` m (a sprint's knock-on). */
export function footSpot(p: {x: number; z: number; size?: number}, heading: number, r: number, ahead = 0) {
  const d = PLAYER_RADIUS * (p.size ?? 1) + r + FOOTBALL.gap + ahead;
  return {x: p.x + Math.sin(heading) * d, y: r, z: p.z + Math.cos(heading) * d};
}
/** The knock-on's reach out ahead `t` s into a sprint (FOOTBALL.knock): a half-sine every `every` s. */
export const knockAhead = (t: number) => FOOTBALL.knock.out * Math.sin(Math.PI * ((t % FOOTBALL.knock.every) / FOOTBALL.knock.every));

export interface Mate { id: string; x: number; z: number; vx: number; vz: number; keeper?: boolean }
/** The team-mate a PASS goes to from `from` along `yaw` (the stick's, else the view's): the one nearest that line within
 *  FOOTBALL.pass.cone, by angle first; undefined with nobody there. Shared by the match, the bots and the page's mark. */
export function passPick(from: {x: number; z: number}, yaw: number, mates: readonly Mate[]): Mate | undefined {
  const P = FOOTBALL.pass, ux = Math.sin(yaw), uz = Math.cos(yaw);
  let best: Mate | undefined, score = Infinity;
  for (const m of mates) {
    const ex = m.x - from.x, ez = m.z - from.z, d = Math.hypot(ex, ez);
    if (d < P.near || d > P.far) continue;
    const off = Math.acos(Math.max(-1, Math.min(1, (ex * ux + ez * uz) / d)));
    if (off > P.cone) continue;
    // (The side's keeper only when the stick is plainly on them - FOOTBALL.fun.keeperOff rad further off.)
    const s = off + d * .004 + (m.keeper ? FOOTBALL.fun.keeperOff : 0);
    if (s < score) { score = s; best = m; }
  }
  return best;
}

/** FOOTBALL.fun3.pass: how clear a pass from `from` to `to` is of `foes` (m; under 0, one of them gets to
 *  the ball first) - along the floor, each rival's distance from its line less what it can run before the ball passes it
 *  (and at the team-mate's end, how tightly they are marked); lofted, how near one stands to where it lands. */
export function passMargin(from: {x: number; z: number}, to: {x: number; z: number}, foes: readonly {x: number; z: number}[], lofted: boolean, ground = 1) {
  const F = FOOTBALL.fun3.pass, ex = to.x - from.x, ez = to.z - from.z, L = Math.hypot(ex, ez) || 1e-3;
  let worst = Infinity;
  if (lofted) { for (const f of foes) worst = Math.min(worst, Math.hypot(f.x - to.x, f.z - to.z) - F.loftMark); return worst; }
  const v0 = personGround(L, ground).v0, a = rollOf(ground);
  for (const f of foes) {
    const s = ((f.x - from.x) * ex + (f.z - from.z) * ez) / L;
    if (s < 0) continue;
    if (s > L - F.near) { worst = Math.min(worst, Math.hypot(f.x - to.x, f.z - to.z) - F.mark); continue; }
    // (The one pressing - within `atBall` m of the ball as it is struck - lets it by: BallMatch, it has left the foot.)
    const at = Math.hypot(f.x - from.x, f.z - from.z);
    if (at < F.atBall) continue;
    const q = Math.abs((f.x - from.x) * ez - (f.z - from.z) * ex) / L, k = v0 * v0 - 2 * a * s, t = k <= 0 ? Infinity : (v0 - Math.sqrt(k)) / a;
    // (One near the ball, within `close` m of it, is moving already: no moment to react.)
    const react = at < F.close ? 0 : F.react;
    worst = Math.min(worst, q - F.reach - F.run * Math.max(0, t - react));
  }
  return worst;
}

/** FOOTBALL.fun2.pass and FOOTBALL.fun3.pass: a person's PASS - of the team-mates the stick's
 *  `yaw` is toward (best first: nearest the stick, open, unmarked), the first one a pass gets through to: straight along
 *  the floor, led round one of theirs in the lane (to one side of the team-mate, the side that clears), or chipped over;
 *  none of them, another team-mate within the wide cone who can be reached; nobody at all, the stick's pick chipped.
 *  Nobody near the stick: a pass into space, as aimed. Returns the team-mate as the pass should be
 *  led to and whether it is lofted. */
export function personPass(from: {x: number; z: number}, yaw: number, mates: readonly Mate[], foes: readonly {x: number; z: number}[]): {mate?: Mate; lofted: boolean} {
  const P = FOOTBALL.pass, Q = FOOTBALL.fun2.pass, F = FOOTBALL.fun3.pass, ux = Math.sin(yaw), uz = Math.cos(yaw);
  const ranked: {m: Mate; s: number; off: number; d: number; wide: boolean}[] = [];
  for (const m of mates) {
    const ex = m.x - from.x, ez = m.z - from.z, d = Math.hypot(ex, ez);
    if (d < P.near || d > P.far) continue;
    const off = Math.acos(Math.max(-1, Math.min(1, (ex * ux + ez * uz) / d)));
    if (off > Q.wide) continue;
    const marked = foes.some(f => Math.hypot(f.x - m.x, f.z - m.z) < Q.tight);
    ranked.push({m, off, d, wide: off > Q.cone, s: off + d * .004 + (m.keeper ? FOOTBALL.fun.keeperOff : 0) + (marked ? Q.marked : 0)});
  }
  if (!ranked.length) return {lofted: false};
  // (The cone's first, then the wide cone's - the wide only when the cone has nobody or nobody a pass gets through to.)
  ranked.sort((a, b) => Number(a.wide) - Number(b.wide) || a.s - b.s);
  const options = (r: (typeof ranked)[number]) => {
    const out: {mate: Mate; lofted: boolean; margin: number}[] = [{mate: r.m, lofted: false, margin: passMargin(from, r.m, foes, false)}];
    const nx = (r.m.z - from.z) / (r.d || 1), nz = -(r.m.x - from.x) / (r.d || 1);
    for (const k of Q.round) {
      const to = {...r.m, x: Math.max(-GOAL_RULES.halfX + 1.5, Math.min(GOAL_RULES.halfX - 1.5, r.m.x + nx * k)), z: Math.max(-GOAL_RULES.halfZ + 1.5, Math.min(GOAL_RULES.halfZ - 1.5, r.m.z + nz * k))};
      out.push({mate: to, lofted: false, margin: passMargin(from, to, foes, false)});
    }
    if (r.d >= F.chipFrom) out.push({mate: r.m, lofted: true, margin: passMargin(from, r.m, foes, true)});
    return out;
  };
  let first: ReturnType<typeof options> | undefined;
  for (const r of ranked) {
    const o = options(r);
    first ??= o;
    const clear = o.find(x => x.margin >= 0);
    if (clear) return {mate: clear.mate, lofted: clear.lofted};
  }
  // (Nobody a pass gets through to: the stick's pick chipped over them, never rolled into a rival's feet - too near to
  // chip, the way along the floor least in their way.)
  const o = first!, chip = o.find(x => x.lofted);
  return chip ? {mate: chip.mate, lofted: true} : {mate: o.reduce((a, b) => b.margin > a.margin ? b : a).mate, lofted: false};
}

/** The floor's slowing of a rolling ball (m/s a second) at a ground share (BallState.ground). */
const rollOf = (ground = 1) => GOAL_RULES.roll * ground;
/** How fast a pass along the floor leaves to cover `d` m, and how long it takes (FOOTBALL.pass; `fast`, a person's -
 *  FOOTBALL.fun3.pass). */
export function groundPass(d: number, ground = 1, fast = false) {
  const P = fast ? FOOTBALL.fun3.pass : FOOTBALL.pass, a = rollOf(ground), arrive = P.arrive + P.perM * d;
  const v0 = Math.min(P.most, Math.sqrt(arrive * arrive + 2 * a * d)), end = Math.sqrt(Math.max(0, v0 * v0 - 2 * a * d));
  return {v0, t: Math.max(.15, (v0 - end) / a)};
}
/** A person's pass along the floor (FOOTBALL.fun3.pass). */
export const personGround = (d: number, ground = 1) => groundPass(d, ground, true);
/** The ballistic velocity to land at a point after `t` s (strike.ts arc's, drag made up for roughly). */
export function arcTo(from: Vec3, toX: number, toY: number, toZ: number, t: number, g: number) {
  const k = 1 + GOAL_RULES.drag * t * .5;
  return {vx: (toX - from.x) / t * k, vy: ((toY - from.y) + .5 * g * t * t) / t, vz: (toZ - from.z) / t * k};
}

/** A PASS's flight (FOOTBALL.pass): to `mate` led into their run (their run carried on over the flight, worked out again
 *  `rounds` times, inside the walls by `wall` m), or into space along `yaw` with nobody. Lofted: the same spot, in the air.
 *  `g` the ball's gravity, `r` its radius, `ground` the floor's share (BallState.ground). */
export function passTo(ball: Vec3, yaw: number, mate: Mate | undefined, lofted: boolean, g: number, r: number, ground = 1, fast = false) {
  const P = FOOTBALL.pass, inX = GOAL_RULES.halfX - P.wall, inZ = GOAL_RULES.halfZ - P.wall;
  let tx = mate ? mate.x : ball.x + Math.sin(yaw) * P.space, tz = mate ? mate.z : ball.z + Math.cos(yaw) * P.space;
  const time = (x: number, z: number) => { const d = Math.hypot(x - ball.x, z - ball.z); return lofted ? P.loftT + d * P.loftPerM : groundPass(d, ground, fast).t; };
  if (mate) for (let i = 0; i < P.rounds; i++) { const t = time(tx, tz); tx = mate.x + mate.vx * t; tz = mate.z + mate.vz * t; }
  tx = Math.max(-inX, Math.min(inX, tx)); tz = Math.max(-inZ, Math.min(inZ, tz));
  const d = Math.hypot(tx - ball.x, tz - ball.z) || 1e-3;
  if (lofted) return {...arcTo(ball, tx, r + .3, tz, time(tx, tz), g), tx, tz};
  const v = groundPass(d, ground, fast).v0;
  return {vx: (tx - ball.x) / d * v, vy: 0, vz: (tz - ball.z) / d * v, tx, tz};
}

/** A SHOT's flight (FOOTBALL.shot) at `charge` (0: a tap, 1: full), along `yaw` (the view, bent by the stick), with the
 *  striker's run (`run`) carried. Put inside the post when its line is near the frame. */
export function shotAt(ball: Vec3, yaw: number, charge: number, team: BallTeam, run: {vx: number; vz: number}, g: number, r: number, open?: number, help: number = FOOTBALL.shot.help) {
  const S = FOOTBALL.shot, R = GOAL_RULES, gz = team === 'red' ? R.halfZ : -R.halfZ;
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  const speed = S.tap + (S.full - S.tap) * charge + Math.max(0, Math.min(S.runMost, (run.vx * dx + run.vz * dz) * S.momentum));
  const toward = Math.sign(gz - ball.z);
  if (dz * toward > .2) {
    const t = (gz - ball.z) / dz, hitX = ball.x + dx * t;
    if (Math.abs(t) < R.halfZ * S.reach && Math.abs(hitX) < R.goalHalfWidth + help) {
      const inside = R.goalHalfWidth - r - S.inset, C = FOOTBALL.fun.corner;
      // (A person's shot at the middle of the goal goes for the corner away from the keeper - `open`.)
      const tx = open && Math.abs(hitX) < R.goalHalfWidth * C.within ? Math.sign(open) * (inside - C.in) : Math.max(-inside, Math.min(inside, hitX)), flat = Math.hypot(tx - ball.x, gz - ball.z);
      const y = Math.min(R.goalHeight - r - .15, S.lowY + (S.highY - S.lowY) * charge);
      dx = (tx - ball.x) / flat; dz = (gz - ball.z) / flat;
      return {...arcTo(ball, tx, y, gz, Math.max(.2, flat / speed), g), speed};
    }
  }
  const lift = (5 + 4 * charge) * Math.PI / 180;
  return {vx: dx * speed * Math.cos(lift), vy: speed * Math.sin(lift), vz: dz * speed * Math.cos(lift), speed};
}

/** Whether nobody of `foes` stands within `clear` m of the line from `a` to `b` (its middle stretch): an open lane. */
export function laneOpen(a: {x: number; z: number}, b: {x: number; z: number}, foes: readonly {x: number; z: number}[], clear = 1.6) {
  const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1e-6;
  for (const f of foes) {
    const t = ((f.x - a.x) * ex + (f.z - a.z) * ez) / L2;
    if (t < .08 || t > .95) continue;
    if (Math.hypot(a.x + ex * t - f.x, a.z + ez * t - f.z) < clear) return false;
  }
  return true;
}
