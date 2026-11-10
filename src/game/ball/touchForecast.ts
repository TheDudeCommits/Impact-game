import type {ExternalBlow} from '../simulation';
import {JUST_GUARD_WINDOW, PLAYER_RADIUS, jumpArc, type MoveDefinition} from '../moves';
import type {AttackSlot, PlayerInput, PlayerState} from '../types';
import {BALL_RULES, GOAL_RULES, SPIKE_RULES, ballRadius, heatTier, type BallEvent, type BallState, type BallTeam, type BallView} from './model';
import {goalZ, sideOf, speedCap} from './physics';
import {SPIKE_DIG, strikeBall, type StrikeContext} from './strike';
import {baseGravity} from './mutators';
import {TRAIT_RULES, withTrait} from './traits';
import {HEADER, MASHED, PERFECT_STRIKE, TOUCH_RULES} from './BallMatch';

/** The page's own fighter as its prediction has it (game/prediction.ts `local`): what a forecast of its touch reads -
 *  the body, the last command, the swing under way and its blow's aim and stick (as pressed), the guard's press. */
export interface LocalFighter {
  state: PlayerState; input: PlayerInput; attackYaw?: number; attackSeq?: number; attackMoveX?: number; attackMoveZ?: number; guardPressedAt: number;
  cast: {id: number; start: number; move: Pick<MoveDefinition, 'style' | 'contacts'>} | null;
}
/** A forecast touch: the ball as the touch sends it (a copy), what kind of touch it was, and the moment the room will
 *  make of it where the room makes one (a strike's, a guard's, a dig's: what the page draws at the contact). */
export interface TouchForecast {
  ball: BallState; kind: 'strike' | 'header' | 'guard' | 'bump' | 'body';
  /** The room's time the touch will be played at (s): the prediction's clock as it made it - the time the room plays the
   *  command it rode on (set by BallTargets). */
  room?: number;
  event?: Pick<BallEvent, 'kind' | 'team' | 'actorId' | 'x' | 'y' | 'z' | 'shot' | 'value' | 'text' | 'perfect'>;
}
/** One seat's side of the match, as the forecast needs it: the side, the ball trait, where the others stand. */
export interface ForecastWorld {
  view: BallView; selfId: string;
  /** Every body in the match as the page has it (the snapshot's), the page's own among them or not (it is skipped). */
  players: readonly PlayerState[];
  /** How each is running along the floor (m/s), where the page knows: a pass leads a running team-mate. */
  run?: (id: string) => {vx: number; vz: number} | undefined;
}

/**
 * The page's own touch of the ball, forecast on the page. Online the room judges a person's swing against the ball where
 * their page drew it (BallMatch SEEN), but the page heard what the swing did a round trip later: the striker saw the
 * ball sit on their body before it flew, the blocker saw it go by their hands and come back. So, as the page predicts
 * its own fighter's moves, it forecasts its own fighter's touches: this mirrors what BallMatch does to the ball for one
 * seat - a blow's strike (`received`), and the body's touches (`bodyContacts`: a guard's block or save, a HEADER, Sky
 * Spike's automatic bump, a body's bounce and dribble) - from the ball as the page draws it and the body as the page's
 * prediction has it. Where the room rolls a die (an off-time JUMP SERVE's spray, a shank, a SCUFF's aim, a soft block's
 * lob) the forecast takes the middle of the roll; what only the room knows (a CLASH, RUMBLE's KI CHARGE, a TECHNIQUE
 * DUEL) it leaves to the room, as anything the room says otherwise is blended in when it comes (render/ball/BallField).
 * Pure but for its own memory of the seat (the room's per-seat bookkeeping: the last strike's cast, the body's last
 * touch, the presses, the swings at nothing), kept per page in BallTargets.
 */
export class TouchForecaster {
  private strikeCast = -1; private strikeAt = -Infinity; private touchCast = -1; private touchedAt = -Infinity;
  private bodyTouch = -Infinity; private guardAt = -Infinity; private dashAt = -Infinity; private whiffAt = -Infinity; private outsideAt = -Infinity;
  private swing = -1; private touchedSwing = -1; private pressSeq = -1; private readonly pressed: number[] = [];
  private castFrom = {id: -1, y: 0}; private pre = {y: 0, cast: -1, vy: 0}; private climbing = false;
  /** BallMatch DOUBLE: when the body last played the ball as a touch, whether it was one of Sky Spike's three,
   *  and which of them - a swing landing just behind it is that touch. */
  private bodyPlayed = {at: -Infinity, three: false, touches: 0};
  private last: {x: number; y: number; z: number; vx: number; vy: number; vz: number} | null = null;

  reset() {
    this.strikeCast = this.touchCast = this.swing = this.touchedSwing = this.pressSeq = -1;
    this.strikeAt = this.touchedAt = this.bodyTouch = this.guardAt = this.dashAt = this.whiffAt = this.outsideAt = -Infinity;
    this.pressed.length = 0; this.castFrom = {id: -1, y: 0}; this.pre = {y: 0, cast: -1, vy: 0}; this.climbing = false; this.last = null;
    this.bodyPlayed = {at: -Infinity, three: false, touches: 0};
  }

  /** Before the prediction's tick: where the swing leaves from (BallMatch's preCast). */
  before(a: LocalFighter) {
    this.pre.y = a.state.y; this.pre.cast = a.cast?.id ?? -1; this.pre.vy = this.last?.vy ?? 0;
  }

  /** After the prediction's tick (`now`: its clock; `ball`: the ball as the page draws it, or null): the room's per-seat
   *  bookkeeping, then the body's touch, if it makes one. */
  after(a: LocalFighter, now: number, dt: number, ball: BallState | null, world: ForecastWorld): TouchForecast | null {
    const p = a.state, prev = this.last;
    const vx = prev ? (p.x - prev.x) / dt : 0, vy = prev ? (p.y - prev.y) / dt : 0, vz = prev ? (p.z - prev.z) / dt : 0;
    this.last = {x: p.x, y: p.y, z: p.z, vx: Math.abs(vx) < 40 ? vx : 0, vy: Math.abs(vy) < 40 ? vy : 0, vz: Math.abs(vz) < 40 ? vz : 0};
    if (a.cast && a.cast.id !== this.pre.cast) this.castFrom = {id: a.cast.id, y: this.pre.vy > -TOUCH_RULES.SWING_TOP ? Math.max(this.pre.y, p.y) : 0};
    if (p.action === 'dash') this.dashAt = now;
    // (MASHED: the attack presses, in the BALL stance.)
    const seq = a.attackSeq ?? -1;
    if (seq !== this.pressSeq) { this.pressSeq = seq; if (seq >= 0 && !this.locked(a, world)) { this.pressed.push(now); if (this.pressed.length > MASHED.presses) this.pressed.shift(); } }
    // (Goal Rush: a swing that ended without touching the ball was one at nothing.)
    if (world.view.mode === 'goal-rush') {
      const id = a.cast?.id ?? -1;
      if (id !== this.swing) { if (this.swing >= 0 && this.touchedSwing !== this.swing) this.whiffAt = now; this.swing = id; }
    }
    if (!ball) return null;
    if (world.view.mode === 'goal-rush' && Math.hypot(ball.x - p.x, ball.y - (p.y + 1), ball.z - p.z) > PERFECT_STRIKE.shell) this.outsideAt = now;
    return this.body(a, now, ball, world);
  }

  /** The page's own blow reaches the ball (BallMatch `received`, for this seat): the ball it sends, or null where the room
   *  would not play it (a FIGHT-stance blow, the far side of the net, a serve not this seat's, the same swing a moment ago). */
  blow(a: LocalFighter, blow: ExternalBlow, now: number, ball: BallState, world: ForecastWorld): TouchForecast | null {
    const {view} = world, mode = view.mode, b = {...ball}, p = a.state, seat = this.seat(world);
    if (!seat || this.locked(a, world) || !strikable(view) || b.clash > now) return null;
    const castId = a.cast?.id ?? -1;
    if (castId === this.strikeCast && now - this.strikeAt < BALL_RULES.restrike) return null;
    // (BallMatch DOUBLE: the body's touch a breath ago, this swing's to play.)
    const body = b.lastId === world.selfId && !b.held && now - this.bodyPlayed.at <= TOUCH_RULES.DOUBLE.window + 1e-6 && !this.mashed(now, blow.slot) ? this.bodyPlayed : undefined;
    if (mode === 'sky-spike') {
      if (sideOf(b.z) !== seat.team && Math.abs(b.z) > .9) return null;
      if (sentBy(view, b, seat.team) && this.touchCast !== castId && !body?.three) return null;
      if (b.held && (view.phase !== 'kickoff' || world.selfId !== view.serverId)) return null;
      if ((b.shot === 'tip' && !p.grounded || overNet(b)) && b.lastTeam !== seat.team && Math.abs(b.z) < 2.4) return null;
    }
    this.strikeCast = castId; this.strikeAt = now; this.bodyTouch = now; this.touchedSwing = castId;
    const yaw = a.attackYaw ?? a.input.yaw, mx = a.attackMoveX ?? a.input.moveX, mz = a.attackMoveZ ?? a.input.moveZ;
    const serve = mode === 'sky-spike' && b.held;
    const again = b.lastId === world.selfId && (this.touchCast === castId || now - this.touchedAt < .3);
    const merged = !again && !serve ? body : undefined;
    if (merged) this.bodyPlayed = {at: -Infinity, three: false, touches: 0};
    this.touchedAt = now;
    if (again && mode === 'sky-spike' && b.shot === 'serve') return null;
    // (Merged with the body's bump, the swing is that touch: the bump's own count, which the room's view may not have yet.)
    const touches = mode === 'sky-spike' ? (serve ? SPIKE_RULES.touches : merged?.three ? merged.touches : (view.touchTeam === seat.team ? view.touches : 0) + (again ? 0 : 1)) : 0;
    this.touchCast = castId;
    const mates = mode === 'goal-rush' ? world.players.filter(q => q.id !== world.selfId && view.seats.some(s => s.id === q.id && s.team === seat.team)).map(q => ({x: q.x, z: q.z, vx: world.run?.(q.id)?.vx ?? 0, vz: world.run?.(q.id)?.vz ?? 0})) : undefined;
    const rivals = mode === 'sky-spike' ? world.players.filter(q => view.seats.some(s => s.id === q.id && s.team !== seat.team)) : undefined;
    const P = TOUCH_RULES.PERFECT_SPIKE, S = TOUCH_RULES.SERVE_RULES;
    const from = this.castFrom, share = p.grounded ? 0 : Math.max(p.y, from.id === castId ? from.y : 0) / Math.max(.1, jumpArc(p.fighter).apex);
    const jumpServe = serve && !p.grounded && blow.slot !== 'light';
    const perfect = mode === 'sky-spike' && !again && (jumpServe ? share >= S.apex : !serve && !p.grounded && blow.slot !== 'light' && b.y > SPIKE_RULES.netHeight
      && Math.abs(b.z) < P.net && b.y > P.ball && share >= P.apex);
    // (An off-time JUMP SERVE sprays long and wide: the forecast takes the middle of the room's roll - long by the most
    // likely, on the line it was aimed along.)
    let spray: {x: number; z: number} | undefined;
    if (jumpServe && !perfect) { const k = Math.min(1, Math.max(0, (S.apex - share) / (S.apex - S.low))); spray = {x: 0, z: S.spray + S.wild * k * .8}; }
    let quickTo: {x: number} | undefined;
    if (mode === 'sky-spike' && touches === 2 && !p.grounded) {
      let best = 4.5;
      for (const q of world.players) if (q.id !== world.selfId && view.seats.some(s => s.id === q.id && s.team === seat.team) && Math.abs(q.z) < best && Math.abs(q.x - p.x) < 7) { best = Math.abs(q.z); quickTo = {x: q.x}; }
    }
    const scuffed = !again && !serve && this.mashed(now, blow.slot);
    const timed = mode === 'goal-rush' && !again && !scuffed && this.timed(a, blow, now, b);
    const moving = this.last;
    const c: StrikeContext = {mode, slot: blow.slot, move: blow.move, knockback: blow.knockback, launch: blow.launch, finisher: blow.finisher, perfect: (perfect || timed) && !scuffed, spray, quickTo,
      scuff: scuffed ? {yaw: 0, off: 0} : undefined, pushX: blow.pushX, pushZ: blow.pushZ, mates, touches, serve, rivals, gravity: baseGravity(view.mutator), run: {vx: moving?.vx ?? 0, vz: moving?.vz ?? 0},
      striker: {id: world.selfId, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: yaw, awakened: !!p.awakened,
        forward: mx * Math.sin(yaw) + mz * Math.cos(yaw), lateral: -mx * Math.cos(yaw) + mz * Math.sin(yaw), chain: p.chain ?? 0}};
    const result = strikeBall(b, c);
    withTrait(seat.trait, mode, b.heat, result);
    const skySpike = mode === 'sky-spike' && !again && !scuffed && result.shot === 'spike' && b.y > (seat.trait === 'aerialist' ? TRAIT_RULES.skySpike : 3.6) && Math.abs(b.z) < 3.6;
    const perfectSpike = perfect && !scuffed && result.shot === 'spike', perfectStrike = timed && result.perfect;
    if (skySpike) result.heat += SPIKE_RULES.skySpikeHeat;
    if (perfectSpike) result.heat += P.heat;
    if (perfectStrike) result.heat += PERFECT_STRIKE.heat;
    const incoming = Math.hypot(b.vx, b.vy, b.vz);
    b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = result.sx; b.sy = result.sy; b.sz = result.sz;
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat); b.super = result.super; b.shot = result.shot;
    if (serve) b.held = false;
    if (result.shot === 'bump' && incoming >= SPIKE_DIG.from) b.shot = 'dig';
    this.touch(b, seat.team, world.selfId);
    const at = {team: seat.team, actorId: world.selfId, x: b.x, y: b.y, z: b.z};
    const event: TouchForecast['event'] = result.super && !again ? {...at, kind: 'super', shot: 'super'}
      : !again && result.shot !== 'tap' && result.shot !== 'bump' && result.shot !== 'set' ? {...at, kind: 'strike', shot: b.shot ?? result.shot, value: Math.round(Math.hypot(b.vx, b.vy, b.vz)),
        text: perfectSpike ? 'SKY SPIKE' : perfectStrike ? (p.grounded ? 'PERFECT STRIKE' : 'PERFECT VOLLEY') : scuffed ? 'SCUFFED' : result.shot === 'tip' ? 'TIP' : skySpike ? 'SKY SPIKE' : undefined, perfect: perfectSpike || perfectStrike || undefined}
      : b.shot === 'dig' ? {...at, kind: 'dig', shot: 'dig', value: Math.round(incoming)} : undefined;
    return {ball: b, kind: 'strike', event};
  }

  /** The body against the ball, for this seat (BallMatch `bodyContacts`): a guard's block or save, a HEADER, Sky Spike's
   *  automatic bump, a bounce off the body and the dribble - or null when the body does not meet it, or only a rule of
   *  the room's own (a SUPER SHOT's bowl, a TECHNIQUE DUEL) decides what it does. */
  private body(a: LocalFighter, now: number, ball: BallState, world: ForecastWorld): TouchForecast | null {
    const {view} = world, mode = view.mode, p = a.state, seat = this.seat(world), T = TOUCH_RULES;
    if (!seat || !strikable(view) || ball.held || !p.alive || ball.frozenUntil > now || ball.clash > now) return null;
    const b = {...ball}, r = ballRadius(mode) * (b.size || 1);
    if (mode === 'sky-spike' && sentBy(view, b, seat.team)) return null;
    if (mode === 'sky-spike' && !p.grounded && a.cast && !b.super) return null;
    if (mode === 'sky-spike' && (b.shot === 'tip' && !p.grounded || overNet(b)) && b.lastTeam !== seat.team && Math.abs(b.z) < 2.4) return null;
    const size = p.size ?? 1, lo = p.y + T.BODY_LOW * size, hi = p.y + T.BODY_HIGH * size, cy = Math.max(lo, Math.min(hi, b.y));
    let nx = b.x - p.x, ny = b.y - cy, nz = b.z - p.z;
    const guarding = p.guarding || p.action === 'guard';
    const guardReach = guarding ? T.GUARD_REACH + (seat.trait === 'wall' ? TRAIT_RULES.guardReach : 0) : 0;
    const dive = mode === 'sky-spike' && !guardReach && b.lastTeam !== null && b.lastTeam !== seat.team && sideOf(b.z) === seat.team
      && now - this.dashAt < T.DIG_DIVE.window && Math.hypot(b.vx, b.vy, b.vz) >= SPIKE_DIG.from ? T.DIG_DIVE.reach : 0;
    const d = Math.hypot(nx, ny, nz), reach = r + PLAYER_RADIUS * size + guardReach + dive;
    if (mode === 'sky-spike' && !b.super && !guardReach && sideOf(b.z) === seat.team && view.touchTeam === seat.team && view.touches === SPIKE_RULES.touches - 1) {
      const up = !p.grounded && b.y > lo && (this.last?.vy ?? 0) > T.CLIMB.rising;
      if (up && d < reach + T.CLIMB.near) { this.climbing = true; return null; }
      if (this.climbing && !p.grounded && d < reach + T.CLIMB.near && this.bodyTouch + .4 <= now) {
        this.climbing = false; this.bodyTouch = now;
        return this.bump(a, b, seat, Math.hypot(b.vx, b.vy, b.vz), world);
      }
      this.climbing = false;
    } else if (p.grounded) this.climbing = false;
    if (d >= reach) return null;
    const hostile = b.lastTeam !== null && b.lastTeam !== seat.team;
    if (b.super && hostile) return null;
    if (d < 1e-5) { nx = Math.sin(p.yaw); ny = 0; nz = Math.cos(p.yaw); } else { nx /= d; ny /= d; nz /= d; }
    b.x = p.x + nx * reach; b.y = Math.max(r, cy + ny * reach); b.z = p.z + nz * reach;
    const v = this.last ?? {vx: 0, vy: 0, vz: 0}, speed = Math.hypot(b.vx, b.vy, b.vz), rel = (b.vx - v.vx) * nx + (b.vy - v.vy) * ny + (b.vz - v.vz) * nz;
    // (One block or save a guard: a ball the room lets ride the guard, blocked again tick after tick - as `guardBall`
    // left it - is drawn blocked once.)
    if (guarding && rel < -1) { if (now - this.guardAt < GUARD_GAP) return null; this.guardAt = now; return this.guard(a, b, seat, now, nx, ny, nz, world); }
    if (mode === 'goal-rush' && rel < -HEADER.from && b.y - p.y > HEADER.head * size && !p.grounded && !T.REELING.has(p.action) && this.bodyTouch + HEADER.gap <= now) {
      this.bodyTouch = now; this.touchedAt = now;
      return this.header(a, b, seat, speed, world);
    }
    const used = view.touchTeam === seat.team ? view.touches : 0;
    if (mode === 'sky-spike' && rel < -1.5 && sideOf(b.z) === seat.team && used < SPIKE_RULES.touches && this.bodyTouch + .4 <= now) {
      this.bodyTouch = now;
      return this.bump(a, b, seat, speed, world);
    }
    if (rel < 0) {
      const e = mode === 'goal-rush' ? T.GOAL_BODY_BOUNCE : T.BODY_BOUNCE;
      b.vx -= (1 + e) * rel * nx; b.vy -= (1 + e) * rel * ny; b.vz -= (1 + e) * rel * nz;
    }
    const run = v.vx * nx + v.vz * nz, ahead = b.vx * nx + b.vz * nz;
    if (run > 1 && ahead < run * 1.15 + .6) { const add = run * 1.15 + .6 - ahead; b.vx += nx * add; b.vz += nz * add; }
    if (mode === 'goal-rush') {
      const after = Math.hypot(b.vx, b.vy, b.vz), cap = Math.max(speed, speedCap(mode, b.heat));
      if (after > cap) { const k = cap / after; b.vx *= k; b.vy *= k; b.vz *= k; }
    }
    if (hostile && speed >= BALL_RULES.bowlSpeed && heatTier(b.heat) >= BALL_RULES.bowlTier) { b.vx *= .62; b.vy *= .62; b.vz *= .62; }
    if (Math.abs(rel) > 1.5 && this.bodyTouch + .35 <= now) { this.bodyTouch = now; this.bodyPlayed = {at: now, three: false, touches: 0}; this.touch(b, seat.team, world.selfId); }
    // (A body that only rests against the ball changes nothing worth drawing ahead of the room; a dribble's every push is.)
    return Math.hypot(b.vx - ball.vx, b.vy - ball.vy, b.vz - ball.vz) < .3 ? null : {ball: b, kind: 'body'};
  }

  /** A guard meets the ball (BallMatch `guardBall`): a block at the net, a save; a STUFF BLOCK or a PERFECT one in the
   *  just-guard window. (A soft block's lob: the middle of the room's roll.) */
  private guard(a: LocalFighter, b: BallState, seat: {team: BallTeam}, now: number, nx: number, ny: number, nz: number, world: ForecastWorld): TouchForecast {
    const perfect = now - a.guardPressedAt <= JUST_GUARD_WINDOW, mode = world.view.mode, at = {team: seat.team, actorId: world.selfId};
    if (mode === 'sky-spike' && Math.abs(b.z) < 2.6 && b.y > SPIKE_RULES.netHeight - .6) {
      const away = seat.team === 'red' ? 1 : -1;
      if (perfect) { b.vz = away * Math.max(7, Math.abs(b.vz) * .95); b.vy = -Math.max(3, Math.abs(b.vy) * .5) - 5; b.vx *= .5; }
      else { b.vz = away * 3.75; b.vy = 7.25; b.vx *= .35; }
      b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat * (perfect ? .5 : 1)); b.shot = 'block'; b.lastId = world.selfId; b.lastTeam = seat.team; b.link = null;
      return {ball: b, kind: 'guard', event: {...at, kind: perfect ? 'perfect' : 'block', x: b.x, y: b.y, z: b.z, shot: 'block', text: perfect ? 'STUFF BLOCK' : 'BLOCK'}};
    }
    const rel = b.vx * nx + b.vy * ny + b.vz * nz, onTarget = mode === 'goal-rush' && headingInto(b, seat.team);
    if (perfect) {
      const yaw = a.input.yaw;
      b.vx = Math.sin(yaw) * 11; b.vz = Math.cos(yaw) * 11; b.vy = 8; b.heat = 0; b.super = false; b.sx = b.sy = b.sz = 0;
    } else {
      b.vx -= 1.45 * rel * nx; b.vy -= 1.45 * rel * ny; b.vz -= 1.45 * rel * nz;
      b.heat = Math.max(0, b.heat - BALL_RULES.guardHeat); b.super = false;
    }
    // (BallMatch `leaveGuard`, GUARD_OFF: the turned ball leaves the guarding body at `leave` m/s at least,
    // along the line from the body to it, against the body's own motion.)
    {
      const n = Math.hypot(nx, ny, nz), v = this.last;
      if (n > 1e-6) {
        const ux = nx / n, uy = ny / n, uz = nz / n;
        const out = (b.vx - (v?.vx ?? 0)) * ux + (b.vy - (v?.vy ?? 0)) * uy + (b.vz - (v?.vz ?? 0)) * uz;
        if (out < TOUCH_RULES.GUARD_OFF.leave) { const k = TOUCH_RULES.GUARD_OFF.leave - out; b.vx += ux * k; b.vy += uy * k; b.vz += uz * k; }
      }
    }
    this.touch(b, seat.team, world.selfId);
    const event: TouchForecast['event'] = onTarget ? {...at, kind: 'save', x: b.x, y: b.y, z: b.z, shot: 'save', text: perfect ? 'PERFECT SAVE' : 'SAVE'}
      : perfect ? {...at, kind: 'perfect', x: b.x, y: b.y, z: b.z, shot: 'save', text: 'PERFECT GUARD'} : undefined;
    return {ball: b, kind: 'guard', event};
  }

  /** Goal Rush's HEADER (BallMatch `header`): on the way the body faces, PERFECT at the top of the jump. */
  private header(a: LocalFighter, b: BallState, seat: {team: BallTeam; trait?: Parameters<typeof withTrait>[0]}, incoming: number, world: ForecastWorld): TouchForecast {
    const p = a.state, v = this.last;
    const dx = p.x - b.x, dy = p.y + 1.5 - b.y, dz = p.z - b.z, toward = (b.vx * dx + b.vy * dy + b.vz * dz) / (Math.hypot(dx, dy, dz) || 1);
    const timed = !p.grounded && Math.abs(v?.vy ?? 0) <= HEADER.apex && toward >= PERFECT_STRIKE.incoming;
    const result = strikeBall(b, {mode: world.view.mode, slot: 'light', move: TOUCH_RULES.HEADED, knockback: 0, launch: false, finisher: false, header: true, incoming, perfect: timed,
      pushX: 0, pushZ: 0, gravity: baseGravity(world.view.mutator), run: {vx: v?.vx ?? 0, vz: v?.vz ?? 0},
      striker: {id: world.selfId, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: p.yaw, awakened: !!p.awakened, forward: 0, lateral: 0, chain: 0}});
    withTrait(seat.trait, world.view.mode, b.heat, result);
    if (result.perfect) result.heat += PERFECT_STRIKE.heat;
    b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = result.sx; b.sy = result.sy; b.sz = result.sz;
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat); b.super = false; b.shot = 'header';
    this.touch(b, seat.team, world.selfId);
    return {ball: b, kind: 'header', event: {team: seat.team, actorId: world.selfId, kind: 'strike', x: b.x, y: b.y, z: b.z, shot: 'header', value: Math.round(Math.hypot(b.vx, b.vy, b.vz)),
      text: result.perfect ? 'PERFECT HEADER' : 'HEADER', perfect: result.perfect || undefined}};
  }

  /** Sky Spike's automatic bump (BallMatch `autoBump`): the body plays the ball - a free ball over on the last touch, a
   *  spike in the air at the net. (A SCUFF's aim, and a shank's: the middle of the roll.) */
  private bump(a: LocalFighter, b: BallState, seat: {team: BallTeam; trait?: Parameters<typeof withTrait>[0]}, incoming: number, world: ForecastWorld): TouchForecast {
    const {view} = world, p = a.state, touches = (view.touchTeam === seat.team ? view.touches : 0) + 1;
    const far = seat.team === 'red' ? 6 : -6, aimYaw = touches >= SPIKE_RULES.touches ? Math.atan2(-b.x * .5, far - b.z) : a.input.yaw;
    const spike = !p.grounded && touches >= SPIKE_RULES.touches && b.y > SPIKE_RULES.netHeight && Math.abs(b.z) < 3.6;
    const scuff = this.mashed(this.touchedAt, 'light') ? {yaw: 0, off: 0} : undefined;
    const result = strikeBall(b, {mode: view.mode, slot: spike ? 'heavy' : 'light', move: TOUCH_RULES.BOWL, knockback: 1, launch: false, finisher: false, pushX: 0, pushZ: 0, touches, scuff, gravity: baseGravity(view.mutator),
      striker: {id: world.selfId, team: seat.team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw, awakened: false, forward: 0, lateral: 0, chain: 0}});
    withTrait(seat.trait, view.mode, b.heat, result);
    b.vx = result.vx; b.vy = result.vy; b.vz = result.vz; b.sx = b.sy = b.sz = 0; b.shot = result.shot;
    b.heat = Math.min(BALL_RULES.heatMax, b.heat + result.heat * .5);
    const dug = result.shot === 'bump' && incoming >= SPIKE_DIG.from;
    if (dug) b.shot = 'dig';
    this.touch(b, seat.team, world.selfId);
    // (Both callers have just set the body's touch to now.)
    this.bodyPlayed = {at: this.bodyTouch, three: true, touches};
    return {ball: b, kind: 'bump', event: dug ? {team: seat.team, actorId: world.selfId, kind: 'dig', x: b.x, y: b.y, z: b.z, shot: 'dig', value: Math.round(incoming)} : undefined};
  }

  /** Goal Rush's PERFECT STRIKE timing (BallMatch `timed`): a melee blow on a ball coming in, inside the shell only a
   *  moment (counted from when the page drew it coming in), the blow's box only just open, no swing at nothing just before. */
  private timed(a: LocalFighter, blow: ExternalBlow, now: number, b: BallState) {
    const p = a.state, cast = a.cast, P = PERFECT_STRIKE;
    if (!cast || blow.move.style !== 'melee' || blow.slot === 'ultimate' || blow.slot === 'area') return false;
    if (now - this.whiffAt < P.clean) return false;
    const dx = p.x - b.x, dy = p.y + 1 - b.y, dz = p.z - b.z, d = Math.hypot(dx, dy, dz) || 1;
    if (d > P.sweet || (b.vx * dx + b.vy * dy + b.vz * dz) / d < P.incoming || now - this.outsideAt > P.arrived) return false;
    const age = now - cast.start;
    let open = -Infinity;
    for (const c of cast.move.contacts) if (c <= age + 1e-6) open = c;
    return age - open <= P.late;
  }
  private mashed(now: number, slot: AttackSlot | string) {
    const list = this.pressed;
    return slot !== 'ultimate' && list.length >= MASHED.presses && now - list[list.length - MASHED.presses] <= MASHED.window;
  }
  private seat(world: ForecastWorld) { return world.view.seats.find(s => s.id === world.selfId); }
  /** Goal Rush's FIGHT stance (the command locked on an opponent): its blows are the fighter's, never the ball's. */
  private locked(a: LocalFighter, world: ForecastWorld) {
    return world.view.mode === 'goal-rush' && !!a.input.lock && typeof a.input.targetId === 'string' && world.view.seats.some(s => s.id === a.input.targetId);
  }
  private touch(b: BallState, team: BallTeam, id: string) { b.lastId = id; b.lastTeam = team; b.link = null; }
}

/** Seconds after a forecast block or save before the guard is forecast to meet the ball again. */
const GUARD_GAP = .3;
const strikable = (view: BallView) => view.phase === 'live' || (view.phase === 'kickoff' && view.mode === 'sky-spike');
const overNet = (b: BallState) => b.shot === 'serve' && b.y > SPIKE_RULES.netHeight;
function sentBy(view: BallView, b: BallState, team: BallTeam) {
  if (view.touchTeam !== team || view.touches < SPIKE_RULES.touches || b.held) return false;
  return Math.sign(b.vz) === (team === 'red' ? 1 : -1) && sideOf(b.z) === team;
}
function headingInto(b: BallState, team: BallTeam, within = 1.8) {
  const R = GOAL_RULES, gz = goalZ(team);
  if (Math.sign(b.vz) !== Math.sign(gz) || Math.abs(b.vz) < 2) return false;
  const t = (gz - b.z) / b.vz;
  if (t < 0 || t > within) return false;
  const x = b.x + b.vx * t, y = b.y + b.vy * t - .5 * R.gravity * (b.grav || 1) * t * t;
  return Math.abs(x) < R.goalHalfWidth + .4 && y < R.goalHeight + .5;
}
