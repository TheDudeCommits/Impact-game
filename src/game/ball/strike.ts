import type {AttackSlot, Vec3} from '../types';
import type {MoveDefinition} from '../moves';
import {BALL_RULES, GOAL_RULES, SPIKE_RULES, heatTier, type BallModeId, type BallState, type BallTeam, type ShotKind} from './model';
import {goalZ, speedCap} from './physics';

/** Who struck the ball, as the strike needs them: where they stand, whether they are off the floor, where they aimed
 *  (the view's yaw at the press, as every attack aims), how they held the stick against that aim (`forward` toward it,
 *  `lateral` across it, each -1..1), awakened or not, which stage of a light string the blow was. */
export interface Striker extends Vec3 {
  id: string; team: BallTeam; grounded: boolean; aimYaw: number; forward: number; lateral: number; awakened: boolean; chain: number;
}
export interface StrikeContext {
  mode: BallModeId;
  slot: AttackSlot; move: Pick<MoveDefinition, 'style' | 'outcome' | 'name'> & {contacts?: readonly number[]}; knockback: number; launch: boolean; finisher: boolean;
  /** The blow's own drive along the floor (from its origin to the ball), for shots that fly where they were fired. */
  pushX: number; pushZ: number;
  striker: Striker;
  /** Goal Rush: the striker's team-mates (where they are and where they are running), for a pass's lead. */
  mates?: readonly {x: number; z: number; vx: number; vz: number}[];
  /** Sky Spike: this side's touches including this one; a serve; where the other side stands (a super shot finds the gap). */
  touches?: number; serve?: boolean; rivals?: readonly Vec3[];
  /** The ball's share of its gravity all match (a mutator's LOW GRAVITY; 1 unset), so the help on target arcs it right. */
  gravity?: number;
  /** How the striker was moving along the floor (m/s): a blow struck on the run carries some of it (MOMENTUM). */
  run?: {vx: number; vz: number};
  /** Sky Spike: a PERFECT SPIKE (BallMatch: struck from the top of the striker's jump, at the net) - it flies faster
   *  (PERFECT_SPIKE.speed) and one heat tier over the ball's cap. A JUMP SERVE struck from the top of the jump is perfect
   *  the same way. Goal Rush: a PERFECT STRIKE (BallMatch PERFECT_STRIKE: a ball coming in, met just as it
   *  arrived) - faster (PERFECT_SHOT), a heat tier over the cap, and truer; only a committed shot (PERFECT_KINDS) is one. */
  perfect?: boolean;
  /** Goal Rush: a HEADER (BallMatch HEADER) - the ball met by the top of a body, headed on - and how fast it
   *  came in (m/s; a share of it goes back out). */
  header?: boolean; incoming?: number;
  /** A SCUFF - the blow came out of a flurry of presses (BallMatch MASHED) - and how far off its aim it goes (radians,
   *  BallMatch's draw). It flies SCUFF.speed as fast, the way it was mis-hit, with no help on target, no pass's lead,
   *  nothing of the run carried and never a PERFECT; `off` (-1..1) is the same mis-hit as a share, which way and how
   *  far a Sky Spike keep lands off its spot. */
  scuff?: {yaw: number; off: number};
  /** Sky Spike: an off-time JUMP SERVE's error, metres off the spot it was aimed at (BallMatch rolls it from how
   *  far under the top of the jump it was struck: SERVE_RULES.spray). */
  spray?: {x: number; z: number};
  /** Sky Spike: where a QUICK SET goes (the team-mate nearest the net, or absent: in front of the setter); a
   *  FLOAT SERVE's reception, off line by this much (BallMatch SERVE_RULES.shank). */
  quickTo?: {x: number}; shank?: {x: number; z: number};
}
/** `perfect`: the strike was a PERFECT one (StrikeContext.perfect, on a shot that can be). `style`: Sky Spike's choice the
 *  strike made, named for the screen and the caller (FLOAT SERVE, JUMP SERVE - PERFECT SERVE from the top of the
 *  jump - QUICK SET, BACK SET; a TIP is its own shot, its strike's text TIP). Absent: the shot as it always was. */
export interface StrikeResult { vx: number; vy: number; vz: number; sx: number; sy: number; sz: number; shot: ShotKind; heat: number; super: boolean; perfect: boolean; style?: SpikeStyle }
export type SpikeStyle = 'FLOAT SERVE' | 'JUMP SERVE' | 'QUICK SET' | 'BACK SET';

const DEG = Math.PI / 180;
/** Sky Spike's floating set: the second touch climbs to about 7 m and comes down onto the net at
 *  `height` (`z` metres off it) after `seconds`, slowly enough to be read from the floor. A jumping fighter meets it
 *  at the top of their jump (4.8-5.5 m up), which is where a spike is PERFECT. It came down at 4.3 m after 1.15 s, under
 *  a body still climbing: every spike was struck on the way up, the jump braked by the swing. */
export const SPIKE_SET = {height: 5.9, z: 1.7, seconds: 1.35} as const;
/** A first touch off a hard ball (`from` m/s and over: a spike, a drive) is a DIG: up high to the middle of the court,
 *  `height` metres at `z` off the net after `seconds`, so the side has time to get under it and set (BallMatch counts
 *  it as a dig at the same speed). A bump's ordinary arc came down at 2.6 m after 1.2 s, too low and quick for a save
 *  off a spike to become an attack. */
export const SPIKE_DIG = {from: 17, height: 3.6, z: 4.6, seconds: 1.5} as const;
/** A PERFECT SPIKE's flight: this much faster than a spike's. */
export const PERFECT_SPIKE_SPEED = 1.12;
/** Goal Rush's PERFECT STRIKE (BallMatch PERFECT_STRIKE says when one is struck): the shots that can be one, and
 *  how they fly - `speed` times faster (and a heat tier over the cap), helped onto the frame from `reach` half-lengths
 *  out and `wide` metres either side of the posts (a shot's help: 1.1 and 3), and laid `inset` metres deeper into the
 *  corner it was aimed at. A HEADER is helped from `headerReach` and `headerWide`, and laid low (`headerY`), as a header
 *  is aimed down. */
export const PERFECT_KINDS: ReadonlySet<ShotKind> = new Set(['power', 'volley', 'spike', 'curve', 'sinker', 'header']);
export const PERFECT_SHOT = {speed: 1.15, reach: 1.45, wide: 5, inset: .3, headerReach: 1.3, headerWide: 4, headerY: 1.1, headerBack: .3, headerBackMost: 8} as const;
/** Sky Spike's choices, each read by the other side and each with its answer.
 *  - Serves (SERVE_STYLE): a FLOAT SERVE (a light from the floor) is safe and placed: flat, slower, and it drifts late
 *    (sidespin `drift`), never a fault. A JUMP SERVE (jump in the walk-up, the ball is tossed with you, and swing a heavy
 *    or special at the top) flies at `jump` m/s with topspin, deep; struck from the top of the jump it goes where it was
 *    aimed, struck early it sprays (BallMatch SERVE_RULES) and lands long or wide - an ACE or a fault. A heavy from the
 *    floor is the old DRIVE.
 *  - Sets (SPIKE_QUICK): the floating set (a light from the floor) is the PERFECT SPIKE's, but the block has 1.35 s to
 *    read it and get there. A QUICK SET (a light struck in the air: the jump set) is at the hitter's hand on the way up
 *    in `seconds` - no time for the block, and no PERFECT SPIKE off it. A light with the stick held across goes to that
 *    wing; across the court from the setter it is a BACK SET (`back` m from the setter or more), flatter and quicker
 *    (`backSeconds`) to the same height: the block that shadowed the setter has the whole net to cross.
 *  - Attacks (SPIKE_TIP): a light from the air on the attacking touch is a TIP: soft, high over the block's hands and
 *    down short behind it, into the emptiest part of that zone - against a side braced for the spike. The defender who
 *    reads it and comes up short plays it; it never beats a back row that stayed home short. */
export const SERVE_STYLE = {float: 14, floatTime: 1.25, drift: 3.2, drive: 19, jump: 27, jumpDeep: 10.2, floatDeep: 7.8, heat: 1.05, topspin: .12} as const;
export const SPIKE_QUICK = {height: 4.5, z: 1.3, seconds: .62, wing: 4.6, back: 4, backSeconds: 1.05} as const;
export const SPIKE_TIP = {near: 1.9, far: 3.7, seconds: .8, height: .5} as const;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Skill against mashing: a SCUFF, a blow out of a flurry of presses (BallMatch MASHED), comes off the boot at `speed`
 *  of the shot it would have been, off its aim, unhelped. Sky Spike's scuffed keep (a bump or a set) lands `keep` metres
 *  off the spot it is laid for, either way, and a scuffed hit over flies `speed` as fast. In the headless sims with
 *  scripted players (playerModels.ts), without it a masher's side scored more and conceded less than a casual
 *  player's. */
export const SCUFF = {speed: .6, keep: 2.6} as const;
/** Every touch carries momentum: a shot struck on the run - a sprint, a boost, a
 *  dash into it - flies this share of the striker's speed along the aim faster (never past its heat's cap). Not a tap's
 *  pass or a Sky Spike keep, which are laid to land where they were meant to. */
export const MOMENTUM = .5;
/** The striker's run along the aim (x, z), as MOMENTUM carries it into the shot. */
const carried = (c: StrikeContext, dx: number, dz: number) => Math.max(0, (c.run?.vx ?? 0) * dx + (c.run?.vz ?? 0) * dz) * MOMENTUM;

/** How a blow drives the ball. The direction is the striker's aim (the view they pressed with: a ball goes where it was
 *  aimed, never where an animation happened to point: a ball game's lesson), helped on target the way the arcade sports
 *  games help it: a Goal Rush shot near the frame is put in the frame, a pass near a team-mate finds their run, a Sky
 *  Spike attack into the far half comes down inside the court. What the blow was decides the shot: a light taps or
 *  bumps, a heavy drives, a launcher pops it into the sky, an air blow volleys or spikes, a special bends it, a shot or
 *  beam blasts it along its line, an area move erupts under it, an ultimate is a super shot. */
export function strikeBall(ball: BallState, c: StrikeContext): StrikeResult {
  const kind = classify(ball, c);
  // (Sky Spike's perfect is a spike's or a jump serve's; Goal Rush's a committed shot's.)
  const perfect = !!c.perfect && !c.scuff && (c.mode === 'sky-spike' ? kind === 'spike' || kind === 'serve' : PERFECT_KINDS.has(kind));
  const heatAdd = c.slot === 'ultimate' ? BALL_RULES.heatMax : (BALL_RULES.heatPer[c.slot] ?? .3) * (c.finisher && c.slot === 'light' ? 2 : 1) * (c.mode === 'sky-spike' ? SPIKE_RULES.heatShare : 1);
  let heat = Math.min(BALL_RULES.heatMax, ball.heat + heatAdd);
  // (A JUMP SERVE leaves the hand warm: its flight is the hardest a cold ball takes.)
  if (c.mode === 'sky-spike' && kind === 'serve' && !c.striker.grounded && c.slot !== 'light') heat = Math.max(heat, SERVE_STYLE.heat);
  const power = (1 + .1 * heat) * (c.striker.awakened ? 1.12 : 1);
  // A hotter ball may fly faster, never faster than its heat allows (a perfect one a tier over).
  const cap = c.slot === 'ultimate' ? speedCap(c.mode, BALL_RULES.heatMax) : speedCap(c.mode, perfect ? heat + 1 : heat);
  const out = c.mode === 'goal-rush' ? goalShot(ball, {...c, perfect}, kind, power, cap) : spikeShot(ball, c, kind, power, cap);
  const s = Math.hypot(out.vx, out.vy, out.vz);
  if (s > cap) { const k = cap / s; out.vx *= k; out.vy *= k; out.vz *= k; }
  return {vx: out.vx, vy: out.vy, vz: out.vz, sx: out.sx, sy: out.sy, sz: out.sz, shot: out.shot ?? kind, heat: heat - ball.heat, super: kind === 'super', perfect, ...('style' in out && out.style ? {style: out.style} : {})};
}

function classify(ball: BallState, c: StrikeContext): ShotKind {
  const s = c.striker, air = !s.grounded;
  if (c.slot === 'ultimate') return 'super';
  if (c.header && c.mode === 'goal-rush') return 'header';
  if (c.mode === 'sky-spike' && c.serve) return 'serve';
  if (c.slot === 'area') return 'eruption';
  // Sky Spike: anything struck from the air above the net is a spike, a beam or a bomb as much as a kick; a light there
  // on the attacking touch is a TIP.
  if (c.mode === 'sky-spike' && air && c.slot !== 'light' && ball.y > SPIKE_RULES.netHeight) return 'spike';
  if (c.mode === 'sky-spike' && air && c.slot === 'light' && (c.touches ?? 1) >= SPIKE_RULES.touches && ball.y > SPIKE_RULES.netHeight) return 'tip';
  if (c.move.style === 'projectile' || c.move.style === 'beam' || c.move.style === 'bomb' || c.move.style === 'field') return 'blast';
  // Only a move made to launch (a string's launcher ender, a rising strike) pops the ball into the sky.
  const launcher = c.move.outcome === 'launch' || c.move.outcome === 'hop';
  if (air && (c.slot === 'heavy' || c.slot === 'special') && ball.y < s.y + 2.4) return 'spike';
  if (launcher) return 'pop';
  if (air) return c.slot === 'light' ? 'volley' : 'spike';
  if (c.slot === 'special') return s.forward > .5 ? 'sinker' : 'curve';
  if (c.slot === 'heavy') return 'power';
  // A light string's last blow drives (its fourth stage, or a many-blow light's last). In Goal Rush a light of one blow
  // was its own last too, which made every light a drive (99 of 100 fighters' lights have one blow) and the tap and its
  // pass unreachable: there it counts as a tap. (Sky Spike keeps its third-touch drive.)
  const last = c.finisher && (c.mode !== 'goal-rush' || (c.move.contacts?.length ?? 1) > 1);
  return last || s.chain >= 3 ? 'drive' : 'tap';
}

/** The ballistic velocity that carries the ball from `from` to land at `to` (height `toY`) in `t` seconds, drag made
 *  up for roughly. */
function arc(from: Vec3, toX: number, toY: number, toZ: number, t: number, g: number, drag: number) {
  const k = 1 + drag * t * .5;
  return {vx: (toX - from.x) / t * k, vy: ((toY - from.y) + .5 * g * t * t) / t, vz: (toZ - from.z) / t * k};
}

type Flight = {vx: number; vy: number; vz: number; sx: number; sy: number; sz: number; shot?: ShotKind; style?: SpikeStyle};

function goalShot(ball: BallState, c: StrikeContext, kind: ShotKind, power: number, cap = Infinity): Flight {
  const R = GOAL_RULES, s = c.striker, g = R.gravity * (c.gravity ?? 1);
  // A blast from a shot or a beam goes where its thrower aimed, as every other strike does. (A SCUFF goes off it.)
  const yaw = s.aimYaw + (c.scuff?.yaw ?? 0);
  const enemy = s.team === 'red' ? 'blue' : 'red', gz = goalZ(enemy);
  // [speed, lift in degrees, side spin, top spin] by shot.
  const table: Record<string, [number, number, number, number]> = {
    tap: [13, 9, 0, 0], drive: [20, 10, 0, 0], power: [25, 11, 0, 0], volley: [22, -2, 0, 0], spike: [27, -22, 0, 0],
    curve: [24, 9, 15, 0], sinker: [25, 17, 0, 17], blast: [24, 6, 0, 0], header: [18, 6, 0, 0],
  };
  let vx: number, vy: number, vz: number, sx = 0, sy = 0, sz = 0;
  if (kind === 'pop' || kind === 'eruption') {
    const up = (kind === 'eruption' ? 17.5 : 15) * Math.min(1.25, Math.sqrt(power)), fwd = kind === 'eruption' ? 7 : 4.5;
    return {vx: Math.sin(yaw) * fwd, vy: up, vz: Math.cos(yaw) * fwd, sx: 0, sy: 0, sz: 0};
  }
  if (kind === 'super') {
    // The super shot goes for the frame wherever it was struck from: the far side of the mouth from the keeper's end, low.
    const inside = R.goalHalfWidth - R.ballRadius - .5;
    const tx = Math.max(-inside, Math.min(inside, ball.x + Math.sin(yaw) * Math.abs(gz - ball.z) * .35));
    const d = Math.hypot(tx - ball.x, gz - ball.z), speed = R.speedCap[4] * .96, t = Math.max(.25, d / speed);
    const v = arc(ball, tx, 1.6, gz, t, g, R.drag);
    return {...v, sx: 0, sy: 0, sz: 0};
  }
  const [base, lift, side, top] = table[kind] ?? table.tap;
  // (Never faster than the ball's tier lets it fly: a shot helped on target is aimed for the speed it will really have,
  // or a cool ball's shot would sink under the height it was laid for.)
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  let speed = Math.min(cap, base * power * (c.perfect ? PERFECT_SHOT.speed : 1) + (kind === 'power' ? Math.min(6, c.knockback * .35) : 0) + (kind === 'tap' || c.scuff ? 0 : carried(c, dx, dz))
    // (A header sends back a share of how hard the ball came in.)
    + (kind === 'header' ? Math.min(PERFECT_SHOT.headerBackMost, (c.incoming ?? 0) * PERFECT_SHOT.headerBack) : 0));
  if (c.scuff) speed *= SCUFF.speed;
  // A tap toward a team-mate is a pass to where they are running.
  if (kind === 'tap' && c.mates?.length && !c.scuff) {
    let best: {x: number; z: number; t: number} | undefined, bestCos = Math.cos(28 * DEG);
    for (const m of c.mates) {
      const ex = m.x - ball.x, ez = m.z - ball.z, d = Math.hypot(ex, ez);
      if (d < 3 || d > R.halfZ) continue;
      const cos = (ex * dx + ez * dz) / d;
      if (cos <= bestCos) continue;
      const t = d / (speed * .9);
      best = {x: m.x + m.vx * t * .8, z: m.z + m.vz * t * .8, t}; bestCos = cos;
    }
    if (best) {
      const d = Math.hypot(best.x - ball.x, best.z - ball.z), t = Math.max(.35, d / (speed * .9));
      const v = arc(ball, best.x, R.ballRadius + .4, best.z, t, g, R.drag);
      return {...v, sx: 0, sy: 0, sz: 0};
    }
  }
  // A shot whose line runs near the enemy frame is put on target: its line through the goal mouth (the corner it was
  // aimed at, kept), and a height under the bar when it gets there.
  const toward = Math.sign(gz - ball.z);
  // (A light string's drive is a shot of its own: only a committed blow is helped on target - and a PERFECT drive.)
  if (kind !== 'tap' && (kind !== 'drive' || c.perfect) && !c.scuff && dz * toward > (c.perfect ? .05 : .2)) {
    const t = (gz - ball.z) / dz, hitX = ball.x + dx * t, d = Math.abs(t);
    // (From within 1.1 half-lengths of the goal: 21 m on the 38 m pitch; a PERFECT STRIKE and a header further.)
    const reach = kind === 'header' ? PERFECT_SHOT.headerReach : c.perfect ? PERFECT_SHOT.reach : 1.1, wide = kind === 'header' ? PERFECT_SHOT.headerWide : c.perfect ? PERFECT_SHOT.wide : 3;
    if (d < R.halfZ * reach && Math.abs(hitX) < R.goalHalfWidth + wide) {
      // (The corner is laid as far out as it was for the old 0.62 m ball: the ball's own radius in from the post's middle;
      // a PERFECT STRIKE deeper in it, past a keeper's reach.)
      const inset = R.ballRadius + (c.perfect ? PERFECT_SHOT.inset : 0), tx = Math.max(-R.goalHalfWidth + inset, Math.min(R.goalHalfWidth - inset, hitX));
      const flat = Math.hypot(tx - ball.x, gz - ball.z);
      dx = (tx - ball.x) / flat; dz = (gz - ball.z) / flat;
      const aimY = kind === 'spike' ? 1 : kind === 'header' ? PERFECT_SHOT.headerY : kind === 'sinker' ? 1.4 : 2.1;
      let time = Math.max(.2, flat / speed), v = arc(ball, tx, aimY, gz, time, g, R.drag);
      // The flight as a whole (its lift included) stays under the tier's cap: a flight over it would be slowed by the
      // match and come in low, so a longer, slower one is laid instead.
      for (let i = 0; i < 4 && Math.hypot(v.vx, v.vy, v.vz) > cap * .99; i++) { time *= Math.hypot(v.vx, v.vy, v.vz) / (cap * .97); v = arc(ball, tx, aimY, gz, time, g, R.drag); }
      // A curve still bends: aimed off the post it was, it swings back across.
      // (The aim is laid off the far side of the target by as much as the spin will bend it back: the bend is the Magnus
      // pull, spin across the flight, over the flight's time, its spin dying a little on the way - physics.ts's flight.)
      if (kind === 'curve') { const sign = s.lateral < -.2 ? -1 : 1; sy = sign * side * .55; const bend = .5 * .018 * Math.abs(sy) * Math.hypot(v.vx, v.vz) * time * time * .8, back = sign * Math.min(3, bend); v.vx += -dz * back / time; v.vz += dx * back / time; }
      if (kind === 'sinker') { sx = -dz * top * .5; sz = dx * top * .5; }
      return {vx: v.vx, vy: v.vy, vz: v.vz, sx, sy, sz};
    }
  }
  const elevation = lift * DEG, flatSpeed = speed * Math.cos(elevation);
  vx = dx * flatSpeed; vz = dz * flatSpeed; vy = speed * Math.sin(elevation);
  if (kind === 'spike' && ball.y < 1.2) vy = Math.max(vy, 2);
  if (side) { const sign = s.lateral < -.2 ? -1 : 1; sy = sign * side; }
  // Topspin: about the axis across the flight, so the flight dips.
  if (top) { sx = -dz * top; sz = dx * top; }
  return {vx, vy, vz, sx, sy, sz};
}

/** Sky Spike. A light keeps the ball on its side - a bump to the middle of the court, a set up at the net - until the
 *  third touch, which has to go over; anything heavier goes over at once: a spike if struck from the air, a drive or a
 *  lob from the floor, a bending shot, a super shot into the court's emptiest corner. */
function spikeShot(ball: BallState, c: StrikeContext, kind: ShotKind, power: number, cap = Infinity): Flight {
  const R = SPIKE_RULES, s = c.striker, own = s.team, sign = own === 'red' ? -1 : 1, g = R.gravity * (c.gravity ?? 1);
  const touches = c.touches ?? 1;
  const keep = !c.serve && touches < R.touches && (c.slot === 'light' || (kind === 'eruption' && touches < 2)) && kind !== 'spike';
  if (keep) {
    // First touch: up and toward the middle of this side (a hard ball's, higher: the DIG). Second: a floating set at the
    // net for a spiker to meet at the top of their jump (SPIKE_SET); struck in the air, a QUICK SET at the hitter's hand
    // (SPIKE_QUICK); with the stick across, to that wing (a BACK SET when it crosses the court).
    const set = touches >= 2, dig = !set && kind !== 'eruption' && Math.hypot(ball.vx, ball.vy, ball.vz) >= SPIKE_DIG.from;
    const quick = set && kind !== 'eruption' && !s.grounded;
    // (The stick across the aim, as the world's x: the screen's left or right on the broadcast camera.)
    const across = -s.lateral * Math.cos(s.aimYaw), wing = set && !quick && kind !== 'eruption' && Math.abs(s.lateral) > .55;
    let style: SpikeStyle | undefined;
    let tx = Math.max(-R.courtHalfX + 1.2, Math.min(R.courtHalfX - 1.2, set ? ball.x * .5 + Math.sin(s.aimYaw) * 2 : ball.x * (dig ? .3 : .4)));
    if (quick) { tx = Math.max(-R.courtHalfX + 1, Math.min(R.courtHalfX - 1, c.quickTo?.x ?? ball.x + Math.sin(s.aimYaw) * 1.2)); style = 'QUICK SET'; }
    else if (wing) { tx = Math.sign(across || 1) * SPIKE_QUICK.wing; if (Math.abs(tx - ball.x) >= SPIKE_QUICK.back) style = 'BACK SET'; }
    let tz = sign * (quick ? SPIKE_QUICK.z : set ? SPIKE_SET.z : dig ? SPIKE_DIG.z : 5.2);
    if (c.shank && !set) { tx = Math.max(-R.courtHalfX + .8, Math.min(R.courtHalfX - .8, tx + c.shank.x)); tz += sign * c.shank.z; }
    // (A SCUFF lands off its spot, across the court, and short of it: a set off the net, a bump nobody stands under.)
    if (c.scuff) { tx += c.scuff.off * SCUFF.keep; tz -= sign * Math.abs(c.scuff.off) * SCUFF.keep * .5; style = undefined; }
    const t = kind === 'eruption' ? 1.7 : quick ? SPIKE_QUICK.seconds : style === 'BACK SET' ? SPIKE_QUICK.backSeconds : set ? SPIKE_SET.seconds : dig ? SPIKE_DIG.seconds : 1.2;
    const v = arc(ball, tx, quick ? SPIKE_QUICK.height : set ? SPIKE_SET.height : dig ? SPIKE_DIG.height : 2.6, tz, t, g, R.drag);
    return {...v, sx: 0, sy: 0, sz: 0, shot: kind === 'eruption' ? 'eruption' : set ? 'set' : 'bump', style};
  }
  const yaw = s.aimYaw + (c.scuff?.yaw ?? 0);
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  // The serve's three (SERVE_STYLE): a light FLOAT SERVE, a heavy's DRIVE from the floor, a JUMP SERVE from the air.
  const jumpServe = kind === 'serve' && !s.grounded && c.slot !== 'light', floatServe = kind === 'serve' && c.slot === 'light';
  if (kind === 'tip') return tip(ball, c, g);
  // The other side's court: [how far past the net it lands, flight time per metre, landing height].
  const deep = kind === 'spike' ? 4.8 : jumpServe ? SERVE_STYLE.jumpDeep : floatServe ? SERVE_STYLE.floatDeep : kind === 'serve' ? 7.4 : kind === 'volley' ? 7 : kind === 'super' ? 0 : 7.8;
  const speedOf: Record<string, number> = {spike: 22, serve: jumpServe ? SERVE_STYLE.jump : floatServe ? SERVE_STYLE.float : SERVE_STYLE.drive, volley: 17, drive: 20, power: 21, curve: 19, sinker: 20, blast: 21, tap: 12, pop: 10, eruption: 11, super: 38};
  const intoFar = dz * -sign > .25;
  let tx: number, tz: number;
  if (kind === 'super') {
    // The emptiest point of the other court.
    let best = {x: 0, z: -sign * 5, d: -1};
    for (let ix = -2; ix <= 2; ix++) for (let iz = 1; iz <= 4; iz++) {
      const x = ix * (R.courtHalfX - 1) / 2, z = -sign * iz * (R.courtHalfZ - .8) / 4;
      const d = Math.min(...(c.rivals?.length ? c.rivals.map(r => Math.hypot(r.x - x, r.z - z)) : [9]));
      if (d > best.d) best = {x, z, d};
    }
    tx = best.x; tz = best.z;
  } else if (intoFar) {
    const reach = (Math.abs(ball.z) + deep) / Math.max(.25, Math.abs(dz));
    // (A SCUFF goes where it was mis-hit, inside the lines or not.)
    tx = c.scuff ? ball.x + dx * reach : Math.max(-R.courtHalfX + .7, Math.min(R.courtHalfX - .7, ball.x + dx * reach));
    tz = -sign * Math.max(1.2, Math.min(R.courtHalfZ - .7, deep + (kind === 'spike' || jumpServe ? 0 : -Math.abs(dx) * 1.5)));
  } else {
    // Aimed away from the other court: it flies the way it was aimed, and is probably out.
    tx = ball.x + dx * 9; tz = ball.z + dz * 9;
  }
  // An off-time JUMP SERVE sprays off the spot it was aimed at (perhaps out: the risk of the power).
  if (jumpServe && c.spray) { tx += c.spray.x; tz += -sign * c.spray.z; }
  const flat = Math.hypot(tx - ball.x, tz - ball.z);
  // (Laid for the speed it will really have: a flight laid faster than the ball's cap lets it fly was slowed after and
  // came down short: JUMP SERVEs into the net.)
  const speed = Math.min(cap * .97, (speedOf[kind] ?? 18) * power * (c.perfect && (kind === 'spike' || jumpServe) ? PERFECT_SPIKE_SPEED : 1) * (c.scuff ? SCUFF.speed : 1) + (kind === 'serve' || kind === 'super' || flat < 1e-3 || c.scuff ? 0 : carried(c, (tx - ball.x) / flat, (tz - ball.z) / flat)));
  let t = floatServe ? SERVE_STYLE.floatTime : Math.max(.28, flat / speed);
  let v = arc(ball, tx, R.ballRadius, tz, t, g, R.drag);
  // It has to clear the net (a spike from too low becomes a tip that does): the slowest flight that does.
  // (Under the ball's cap first; a JUMP SERVE clears by more, its topspin dipping it a few tenths before the net.)
  for (let tries = 0; tries < 6 && Math.hypot(v.vx, v.vy, v.vz) > cap * .99; tries++) { t *= Math.hypot(v.vx, v.vy, v.vz) / (cap * .97); v = arc(ball, tx, R.ballRadius, tz, t, g, R.drag); }
  if (intoFar || kind === 'super') {
    for (let tries = 0; tries < 24 && !clears(ball, v, g, jumpServe ? .7 : .15); tries++) { t *= 1.08; v = arc(ball, tx, R.ballRadius, tz, t, g, R.drag); }
  }
  let sx = 0, sy = 0, sz = 0;
  if (kind === 'curve') sy = (s.lateral < -.2 ? -1 : 1) * 6;
  if (kind === 'spike' || kind === 'sinker') { sx = -v.vz * .25; sz = v.vx * .25; }
  // A JUMP SERVE's topspin, which dips it in (the axis across the flight, the ball's top turning forward: physics.ts
  // bends the flight along spin × velocity). (The spike's and the sinker's spin above turns the other way and holds
  // them up a little; the spikes are tuned with it.)
  if (jumpServe) { sx = v.vz * SERVE_STYLE.topspin; sz = -v.vx * SERVE_STYLE.topspin; }
  // The float's drift: a little sidespin, the way it was aimed across (or away from the middle), so it moves late.
  if (floatServe) sy = (Math.abs(s.lateral) > .2 ? Math.sign(-s.lateral) : tx >= 0 ? -1 : 1) * SERVE_STYLE.drift * -sign;
  return {vx: v.vx, vy: v.vy, vz: v.vz, sx, sy, sz, style: jumpServe ? 'JUMP SERVE' : floatServe ? 'FLOAT SERVE' : undefined};
}

/** Sky Spike's TIP (SPIKE_TIP): soft, up over the block's hands and down short behind it, `near`-`far` metres
 *  past the net, into the spot of that zone farthest from the other side (leaning the way it was aimed). */
function tip(ball: BallState, c: StrikeContext, g: number): Flight {
  const R = SPIKE_RULES, s = c.striker, far = s.team === 'red' ? 1 : -1, lean = Math.sin(s.aimYaw) * far;
  let best = {x: 0, z: far * SPIKE_TIP.near, d: -Infinity};
  for (const x of [-5.6, -3.4, -1.2, 1.2, 3.4, 5.6]) for (const z of [SPIKE_TIP.near, (SPIKE_TIP.near + SPIKE_TIP.far) / 2, SPIKE_TIP.far]) {
    const d = Math.min(9, ...(c.rivals?.length ? c.rivals.map(r => Math.hypot(r.x - x, r.z - far * z)) : [9])) + (Math.sign(x) === Math.sign(lean * far) && Math.abs(lean) > .15 ? 1.2 : 0) - Math.abs(x - ball.x) * .08;
    if (d > best.d) best = {x, z: far * z, d};
  }
  let t = SPIKE_TIP.seconds, v = arc(ball, Math.max(-R.courtHalfX + .8, Math.min(R.courtHalfX - .8, best.x)), SPIKE_TIP.height, best.z, t, g, R.drag);
  for (let tries = 0; tries < 12 && !clears(ball, v, g, 1.2); tries++) { t *= 1.06; v = arc(ball, best.x, SPIKE_TIP.height, best.z, t, g, R.drag); }
  return {...v, sx: 0, sy: 0, sz: 0, shot: 'tip'};
}

/** Whether a ball leaving `b` at `v` is over the net (with its radius and a hand's breadth) when it crosses it. */
function clears(b: Vec3, v: {vx: number; vy: number; vz: number}, g: number, over = .15) {
  if (Math.abs(v.vz) < 1e-3 || Math.sign(-b.z) !== Math.sign(v.vz)) return true;
  const t = -b.z / v.vz, y = b.y + v.vy * t - .5 * g * t * t;
  return y > SPIKE_RULES.netHeight + SPIKE_RULES.ballRadius + over;
}

export const tierOf = heatTier;
export const angleBetween = (a: number, b: number) => Math.abs(wrap(a - b));
