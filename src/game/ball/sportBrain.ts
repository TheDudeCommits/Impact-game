import type {PlayerInput, PlayerState} from '../types';
import {BALL_ID, GOAL_RULES, type BallSeat, type BallState, type BallTeam, type BallView} from './model';
import {BallBrain, type BotLevel} from './BallBrain';
import {FOOTBALL, laneOpen, passPick, type Mate} from './football';
import type {BotPlan} from './BallBrain';

type Command = Omit<PlayerInput, 'seq'> & {lightHeld?: boolean};
const gap = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How the SPORT bots play (football.ts), by level: `think` s between looks at the game (a pass to a caller is looked
 *  for every tick), `aim` rad of error on a shot, `shoot` m from goal it shoots inside, `hold` s it carries before it
 *  looks to pass with nobody on it, `press` m an opponent on it counts as pressure, `read` s before the other side's
 *  pass is read and chased. The chance a tenth of a second that a TACKLE in reach is pressed (`tackle`, a
 *  SLIDE from behind `slide`), that a carrier met head on tries the TRICK (`trick`), that the right ball is met first
 *  time (`first`), and that a bot a person fights guards against a blow coming (`guard`); `err` m either way its poke's
 *  timing is off by (tuned so about half the pokes win between equal bots). */
export const SPORT_BOT: Readonly<Record<BotLevel, {think: number; aim: number; shoot: number; hold: number; press: number; read: number; tackle: number; slide: number; trick: number; first: number; guard: number; err: number}>> = {
  easy: {think: .3, aim: .2, shoot: 14, hold: 3, press: 2.2, read: .5, tackle: .035, slide: .025, trick: .07, first: .35, guard: .2, err: .85},
  normal: {think: .18, aim: .13, shoot: 16, hold: 2.6, press: 2.6, read: .35, tackle: .05, slide: .04, trick: .1, first: .65, guard: .4, err: .62},
  hard: {think: .1, aim: .08, shoot: 18, hold: 2.2, press: 3, read: .2, tackle: .065, slide: .055, trick: .13, first: .85, guard: .55, err: .45},
};
/** A team-mate who is a person is worth this much more as a pass (one person among bots is never a spectator); one in a
 *  good spot (open, not behind the ball) is passed to after `personAfter` s on the ball. A call (FOOTBALL.call) is
 *  answered the first tick a lane to them is open. */
const PERSON = {bonus: 5, personAfter: .8, open: 3} as const;
/** A shot is taken at this chance or better (spChance: about 7 m out, central, a line to goal) - SHOT_GREAT within
 *  SHOT_AGAIN s of the side's last - and a carrier makes for the edge of the box, BOX_EDGE m out, rather than the net. */
/** The attacker's run in behind (spShape): for `for` s, `beyond` m past their last field player, `wide` m off the middle;
 *  once every `again` s. */
const RUN = {for: 1.6, again: 3.5, beyond: 3, wide: 4.5} as const;
/** Spacing: a support covers `cover` m off the ball toward its goal; a marker stands no nearer the ball
 *  than `standOff`; an offer stands `offer` m from the ball and `mate` m from a team-mate. */
const SPACE = {cover: 8.5, standOff: 7.5, offer: 9, mate: 6, jockey: 1.9} as const;
/** A body's bounds (PLAYER_RADIUS): a TACKLE's reach is from them. */
const PLAYER_REACH = .45;
/** The chance a bot with nobody near plays a pass on first time into a team-mate's run well ahead (spFirst). */
const FIRST_ON = .45;
const SHOT_CHANCE = .12, SHOT_GREAT = .38, SHOT_AGAIN = 5, BOX_EDGE = 7.5;

/**
 * A bot of Goal Rush's SPORT mode (football.ts): it presses only what a person can - the stick, the view, PASS with the
 * stick at a team-mate, SHOOT tapped or held, SPRINT - and plays by the match's own rules (possession, the pass's lead,
 * the shot's help). So far: a carrier who dribbles at goal, passes under pressure or to the
 * better-placed team-mate (a person first), and shoots in range; team-mates who offer (one ahead on a wing, one behind),
 * a chaser for a loose ball (the side's quickest to it), a presser who meets a carrier from in front, markers goal-side,
 * and today's keeper role on its line. The tackle, the trick and the shape's runs are still to come.
 * Its own random stream, seeded from its seat, so nothing of a classic match's draws moves.
 */
export class SportBrain extends BallBrain {
  private lvl: BotLevel = 'normal';
  private nextThink = 0;
  private sportCall: {id: string; until: number} | null = null;
  private holdTo = 0; private holdAim = 0;
  private dashAt = 0;
  private since = -Infinity;
  private seedS: number;
  private rnd = () => { let x = this.seedS; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seedS = x >>> 0 || 1; return this.seedS / 0x100000000; };

  constructor(id: string, index: number, rng: () => number) {
    super(id, 'goal-rush', index, rng);
    let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    this.seedS = (h ^ (index * 40503)) >>> 0 || 1;
  }
  override levelled(level: BotLevel, composed: boolean, plan?: {plan: BotPlan; wing: 1 | -1}) { super.levelled(level, composed, plan); this.lvl = level; }
  override called(id: string, until: number) { super.called(id, until); this.sportCall = {id, until}; }

  override command(me: PlayerState, seat: BallSeat, players: readonly PlayerState[], view: BallView, now: number): Command {
    const input: Command = {moveX: 0, moveZ: 0, yaw: me.yaw, targetId: BALL_ID, lock: true};
    if (!me.alive || view.phase === 'over' || view.phase === 'countdown' || view.phase === 'scored' || view.phase === 'kickoff') { this.holdTo = 0; return input; }
    const b = view.ball, team = seat.team, dir = team === 'red' ? 1 : -1, ownZ = -dir * GOAL_RULES.halfZ;
    const seatOf = (id: string) => view.seats.find(s => s.id === id);
    const mates: PlayerState[] = [], foes: PlayerState[] = [];
    for (const q of players) { if (q.id === me.id || !q.alive) continue; const s = seatOf(q.id); if (!s || s.out !== undefined) continue; (s.team === team ? mates : foes).push(q); }
    this.clock = now;
    // A lofted PASS: the key held past a tap's, the stick and the view on the team-mate.
    if (now < this.loftTo && b.carry === me.id) { input.lightHeld = true; input.yaw = this.loftAim; input.moveX = Math.sin(this.loftAim); input.moveZ = Math.cos(this.loftAim); return input; }
    this.loftTo = 0;
    // A SHOOT held on: the key down, the view on the shot's line, until it is let go.
    if (now < this.holdTo && b.carry === me.id) { input.heavyHeld = true; input.yaw = this.holdAim; input.moveX = Math.sin(this.holdAim); input.moveZ = Math.cos(this.holdAim); return input; }
    this.holdTo = 0;
    // A person locked on this bot in the FIGHT stance: it answers in kind, then back to the ball once the lock lets go.
    const hunter = view.seats.find(s => !s.bot && s.team !== team && s.lock === me.id && s.out === undefined);
    if (hunter) return this.spFight(me, players.find(p => p.id === hunter.id), input, now);
    if (b.carry === me.id) { if (this.since === -Infinity) this.since = now; return this.spOnBall(me, seat, mates, foes, view, b, now, input, dir); }
    this.since = -Infinity;
    const role = seat.role ?? 'attack';
    const carrier = b.carry ? players.find(p => p.id === b.carry) : undefined, theirs = carrier ? seatOf(carrier.id)?.team !== team : false;
    if (role === 'keeper' && !this.spKeeperOut(me, b, mates, ownZ)) return this.spKeep(me, b, input, now, ownZ, dir);
    // A pass on its way to this bot: meet it.
    const pass = [...view.events].reverse().find(e => e.kind === 'pass' && now - e.at < 2.5);
    if (!carrier && pass?.targetId === me.id && b.lastId === pass.actorId) return this.spFirst(me, seat, b, mates, foes, input, now, dir, this.spMeet(me, b, input, now, 1));
    // (The other side's pass is read a moment after it is struck: until then this bot holds its place.)
    if (!carrier && pass && pass.team !== team && b.lastId === pass.actorId && now - pass.at < SPORT_BOT[this.lvl].read) return this.spShape(me, seat, b, b, mates, input, now, dir, ownZ, false);
    // (Its own pass or shot on its way: this bot lets it go and takes its place.)
    if (!carrier && b.lastId === me.id && pass?.actorId === me.id && now - pass.at < 1.5) return this.spShape(me, seat, b, b, mates, input, now, dir, ownZ, true);
    if (!carrier) {
      // A loose ball: the side's quickest to it goes; the rest take their places.
      const mine = this.spReach(me, b), quickest = mates.every(q => seatOf(q.id)?.role === 'keeper' || this.spReach(q, b) >= mine - .05);
      if (quickest) return this.spMeet(me, b, input, now, 1.1);
      return this.spShape(me, seat, b, b, mates, input, now, dir, ownZ, false);
    }
    if (!theirs) return this.spShape(me, seat, carrier, b, mates, input, now, dir, ownZ, true, foes);
    // Their carrier: the nearest of this side (not the keeper) meets them from in front; the rest stand goal-side.
    const mineD = gap(me, carrier), nearest = mates.every(q => seatOf(q.id)?.role === 'keeper' || gap(q, carrier) >= mineD - .05);
    if (nearest) {
      const gx = 0 - carrier.x, gz = ownZ - carrier.z, gd = Math.hypot(gx, gz) || 1;
      // (Jockeyed, a stride off in front of them - SPACE.jockey m - the poke made from there.)
      this.spGo(me, {x: carrier.x + gx / gd * SPACE.jockey, z: carrier.z + gz / gd * SPACE.jockey}, input, now, 6, .1);
      // (The TACKLE - a POKE with the ball in reach, a SLIDE on the boost from behind - pressed by the level's
      // chance a tenth of a second, as a person's eye and thumb would.)
      const L = SPORT_BOT[this.lvl], db = gap(me, b);
      if (now >= this.tackleAt && now >= this.lookAt) {
        this.lookAt = now + .1;
        // (The press is timed with an error by level - SPORT_BOT.err m of the ball's reach, either way: early it misses
        // out of reach, and a poke from beside a carrier turned away is shielded.)
        if (Number.isNaN(this.pokeErr)) this.pokeErr = (this.rnd() * 2 - 1) * L.err;
        if (me.boost && db < PLAYER_REACH + FOOTBALL.tackle.slide.reach - .3 + this.pokeErr && this.rnd() < L.slide) { input.guard = true; this.tackleAt = now + FOOTBALL.tackle.again + .3; this.pokeErr = NaN; }
        else if (!me.boost && db < PLAYER_REACH + FOOTBALL.tackle.reach + this.pokeErr && this.rnd() < L.tackle) { input.guard = true; this.tackleAt = now + FOOTBALL.tackle.again + 1.4; this.pokeErr = NaN; }
      }
      return input;
    }
    // (Spacing: one presses; a support covers - on the line from the ball to its goal, COVER m off the
    // ball - and an attacker marks the nearest of theirs off the ball, goal-side, never nearer the ball than STAND_OFF.)
    if ((seat.role ?? 'attack') === 'support') {
      const cx = 0 - b.x, cz = ownZ - b.z, cd = Math.hypot(cx, cz) || 1, k = Math.min(SPACE.cover, cd * .6) / cd;
      return this.spGo(me, {x: b.x + cx * k, z: b.z + cz * k}, input, now, 9, .6);
    }
    let mark: PlayerState | undefined, best = Infinity;
    for (const f of foes) { if (f.id === carrier.id) continue; const d = gap(f, me); if (d < best) { best = d; mark = f; } }
    const m = mark ?? carrier, mx = 0 - m.x, mz = ownZ - m.z, md = Math.hypot(mx, mz) || 1;
    const spot = {x: m.x + mx / md * 2.5, z: m.z + mz / md * 2.5}, off = gap(spot, b);
    if (off < SPACE.standOff) { const ux = (spot.x - b.x) / (off || 1), uz = (spot.z - b.z) / (off || 1); spot.x = b.x + ux * SPACE.standOff; spot.z = b.z + uz * SPACE.standOff; }
    return this.spGo(me, spot, input, now, 9, .6);
  }

  /** With the ball: answer a call, pass under pressure or to a better place (a person first), shoot in range, or dribble
   *  at goal (sprinting into open grass). */
  private spOnBall(me: PlayerState, seat: BallSeat, mates: PlayerState[], foes: PlayerState[], view: BallView, b: BallState, now: number, input: Command, dir: number): Command {
    const L = SPORT_BOT[this.lvl], gz = dir * GOAL_RULES.halfZ, toGoal = Math.hypot(0 - me.x, gz - me.z), seatOf = (id: string) => view.seats.find(s => s.id === id);
    const pressure = foes.reduce((m, f) => Math.min(m, gap(f, me)), Infinity), held = now - this.since;
    const person = (id: string) => { const s = seatOf(id); return !!s && !s.bot; };
    const option = (q: PlayerState) => {
      const open = foes.reduce((m, f) => Math.min(m, gap(f, q)), Infinity), lane = laneOpen(b, q, foes), d = gap(q, me);
      if (d < FOOTBALL.pass.near + .5 || d > FOOTBALL.pass.far - 4) return {q, score: -Infinity, lane, open};
      const ahead = (q.z - me.z) * dir;
      return {q, lane, open, score: (lane ? 0 : -8) + ahead * .5 + Math.min(open, 7) * 1.1 - d * .08 + (person(q.id) ? PERSON.bonus : 0) - (seatOf(q.id)?.role === 'keeper' ? 6 : 0)};
    };
    // (Met head on by one of theirs closing, the TRICK - by the level's chance a tenth of a second.)
    // (Only with a tackler closing: in front, within 2.4 m, coming at this bot.)
    const facing = foes.find(f => { const d = gap(f, me); if (d > 2.4 || ((f.x - me.x) * Math.sin(me.yaw) + (f.z - me.z) * Math.cos(me.yaw)) <= 0) return false; const was = this.closeSeen.get(f.id); this.closeSeen.set(f.id, d); return was !== undefined && was - d > .02; });
    if (facing && now >= this.trickAt && now >= this.lookAt) { this.lookAt = now + .1; if (this.rnd() < L.trick) { this.trickAt = now + FOOTBALL.trick.again + .3; input.attack = 'special'; input.moveX = Math.sin(me.yaw); input.moveZ = Math.cos(me.yaw); return input; } }
    // The call: the first tick a lane to the caller is open, the ball goes.
    const call = this.sportCall && now < this.sportCall.until ? mates.find(q => q.id === this.sportCall!.id) : undefined;
    if (call && held > .05 && laneOpen(b, call, foes) && gap(call, me) > FOOTBALL.pass.near) { this.sportCall = null; return this.spPassTo(me, call, input, false); }
    if (now >= this.nextThink) {
      this.nextThink = now + L.think * (.8 + this.rnd() * .4);
      // Shoot when the chance is good - near enough, central enough, a line to goal past the field players - and no
      // team-mate's is better; else the pass (A team's shots, twenty to thirty a match, not one every few seconds).
      const keeperOf = foes.reduce<PlayerState | undefined>((k, f) => !k || Math.abs(f.z - gz) < Math.abs(k.z - gz) ? f : k, undefined);
      const field = foes.filter(f => f !== keeperOf), mine0 = this.spChance(me, gz, dir, field);
      let mateBest = 0, mateQ: PlayerState | undefined;
      for (const q of mates) { if (seatOf(q.id)?.role === 'keeper' || !laneOpen(b, q, foes)) continue; const c = this.spChance(q, gz, dir, field); if (c > mateBest) { mateBest = c; mateQ = q; } }
      // (A side that has just shot works the ball again first: another inside SHOT_AGAIN s only from a great chance.)
      const lately = view.events.some(e => e.kind === 'strike' && e.team === seat.team && now - e.at < SHOT_AGAIN);
      if (mine0 >= (lately ? SHOT_GREAT : SHOT_CHANCE) && mine0 >= mateBest - .05 && (held > .45 || pressure < 2)) {
        const side = keeperOf && keeperOf.x > 0 ? -1 : 1, tx = side * (GOAL_RULES.goalHalfWidth - .9) * (.6 + .4 * this.rnd());
        const aim = Math.atan2(tx - me.x, gz - me.z) + (this.rnd() * 2 - 1) * L.aim;
        input.yaw = aim; input.attack = 'heavy'; input.moveX = Math.sin(aim); input.moveZ = Math.cos(aim);
        if (toGoal > 8 && pressure > 2.5) { input.heavyHeld = true; this.holdTo = now + .25 + this.rnd() * .3; this.holdAim = aim; }
        return input;
      }
      if (mateQ && mateBest > mine0 + .1 && held > .2) return this.spPassTo(me, mateQ, input, false);
      const options = mates.map(option).sort((x, y) => y.score - x.score), top = options[0];
      const mine = Math.min(foes.reduce((m, f) => Math.min(m, gap(f, me)), Infinity), 7) * 1.1;
      const personSpot = options.find(o => person(o.q.id) && o.lane && o.open > PERSON.open && (o.q.z - me.z) * dir > -3);
      if (personSpot && held > PERSON.personAfter && (pressure < 5 || (personSpot.q.z - me.z) * dir > 4)) return this.spPassTo(me, personSpot.q, input, false);
      // (A touch to settle it first, unless somebody is on top of this bot already.)
      // (The keeper gives it to a team-mate at once; anyone on it too long gives it to the best there is.)
      const keeper = seat.role === 'keeper', long = held > (keeper ? .5 : 4);
      // (Space ahead: carry it on - a pass is for pressure, a better place, or a carry gone on long enough.)
      if (top && top.score > -Infinity && (long || (held > .6 || pressure < 1.2) && (pressure < L.press && top.score > -4 || held > L.hold && top.score > mine + 2))) return this.spPassTo(me, top.q, input, !top.lane && gap(top.q, me) > 9);
    }
    // Dribble at goal, edging away from the nearest opponent in front; sprint into open grass. Toward the edge of the
    // box (BOX_EDGE m out), not into the net, unless their keeper is off its line and the goal is open.
    const keeperHome = foes.some(f => Math.hypot(f.x, f.z - gz) < 5), to = keeperHome ? {x: me.x * .5, z: gz - dir * BOX_EDGE} : {x: 0, z: gz};
    let ax = to.x - me.x, az = to.z - me.z;
    // (At the edge with no shot on: hold it up and lay it off - the next look passes it (`long`).)
    if (keeperHome && Math.hypot(ax, az) < 1.2) { this.since = Math.min(this.since, now - 2.6); input.yaw = Math.atan2(-me.x, gz - me.z); return input; }
    const ad = Math.hypot(ax, az) || 1; ax /= ad; az /= ad;
    for (const f of foes) {
      const fx = f.x - me.x, fz = f.z - me.z, d = Math.hypot(fx, fz);
      if (d >= 4 || fx * ax + fz * az <= 0) continue;
      // (Round them on the open side: a step across the line to them, more the closer they are.)
      const side = fx * az - fz * ax > 0 ? -1 : 1, w = .8 * (4 - d) / 4, nx = ax + az * side * w, nz = az - ax * side * w, k = Math.hypot(nx, nz) || 1;
      ax = nx / k; az = nz / k;
    }
    input.moveX = ax; input.moveZ = az; input.yaw = Math.atan2(ax, az);
    const clear = foes.every(f => { const fx = f.x - me.x, fz = f.z - me.z; return Math.hypot(fx, fz) > 7 || fx * ax + fz * az < 0; });
    if (clear && toGoal > 12 && now >= this.dashAt && me.stamina > 50) { input.dash = true; this.dashAt = now + 1.6 + this.rnd(); }
    if (me.boost && (!clear || toGoal < 11)) { input.moveX *= .45; input.moveZ *= .45; }
    return input;
  }
  /** A pass on its way to this bot: met first time, now and then - a SHOOT pressed as it comes (FOOTBALL.press.buffer)
   *  in range of goal with a line to it, or a PASS on to an open team-mate with one of theirs closing - else taken. */
  private spFirst(me: PlayerState, seat: BallSeat, b: BallState, mates: PlayerState[], foes: PlayerState[], input: Command, now: number, dir: number, met: Command): Command {
    const d = gap(me, b), closing = (b.vx * (me.x - b.x) + b.vz * (me.z - b.z)) / Math.max(d, 1e-3), eta = closing > 1 ? d / closing : Infinity;
    if (eta > FOOTBALL.press.buffer * .8 || this.firstFor === b.lastId + b.x.toFixed(0)) return met;
    this.firstFor = b.lastId + b.x.toFixed(0);
    if (this.rnd() > SPORT_BOT[this.lvl].first) return met;
    const gz = dir * GOAL_RULES.halfZ, toGoal = Math.hypot(me.x, gz - me.z);
    if (toGoal < SPORT_BOT[this.lvl].shoot + 2 && (gz - me.z) * dir > 3) {
      const aim = Math.atan2((this.rnd() * 2 - 1) * (GOAL_RULES.goalHalfWidth - 1) - me.x, gz - me.z);
      met.attack = 'heavy'; met.yaw = aim; return met;
    }
    // (A lay-off: one of theirs on this bot as the ball comes, an open team-mate ahead - it goes on first time.)
    // (Or a ball played on into a team-mate's run well ahead - the wall pass - now and then with nobody near.)
    const near = foes.some(f => gap(f, me) < 3.5), open = mates.find(q => seat.role !== 'keeper' && laneOpen(me, q, foes) && (q.z - me.z) * dir > (near ? 0 : 6) && gap(q, me) > 5);
    if (open && (near || this.rnd() < FIRST_ON)) { const yaw = Math.atan2(open.x - me.x, open.z - me.z); met.attack = 'light'; met.yaw = yaw; met.moveX = Math.sin(yaw); met.moveZ = Math.cos(yaw); }
    return met;
  }
  private firstFor = '';
  /** How good a shot from `p` would be (0-1): its distance inside the level's range, how central, and whether a line to
   *  goal is open past the field players (`field`). */
  private spChance(p: {x: number; z: number}, gz: number, dir: number, field: readonly PlayerState[]) {
    const ahead = (gz - p.z) * dir, d = Math.hypot(p.x, gz - p.z), range = SPORT_BOT[this.lvl].shoot;
    if (ahead < 2 || d > range) return 0;
    return (1 - d / range) * (1 - Math.min(1, Math.abs(p.x) / d * 1.2)) * (laneOpen(p, {x: 0, z: gz}, field, 1.2) ? 1 : .55);
  }
  /** A PASS at a team-mate: the stick and the view at their run  /** A PASS at a team-mate: the stick and the view at their run (the match leads it), lofted over a blocked lane. */
  private spPassTo(me: PlayerState, q: PlayerState, input: Command, lofted: boolean): Command {
    const yaw = Math.atan2(q.x - me.x, q.z - me.z);
    input.attack = 'light'; input.yaw = yaw; input.moveX = Math.sin(yaw); input.moveZ = Math.cos(yaw);
    // (A loft is a held PASS: the key said down this tick, up the next - FOOTBALL.press.tap is read on the match's
    // clock, so a bot's loft is the key held over it.)
    if (lofted) { input.lightHeld = true; this.loftTo = this.clock + FOOTBALL.press.tap + .05; this.loftAim = yaw; }
    return input;
  }
  private loftTo = 0; private loftAim = 0; private clock = 0;
  /** How long until this body could be at the ball's next spot (rough: straight line at a run). */
  private spReach(p: PlayerState, b: BallState) { return gap(p, this.spAhead(b, .4)) / 9.5; }
  /** Where the ball rolls to in `t` s (along the floor, slowing). */
  private spAhead(b: BallState, t: number) {
    const s = Math.hypot(b.vx, b.vz), a = GOAL_RULES.roll * (b.ground ?? 1), tt = Math.min(t, s / Math.max(a, .1)), k = s > 1e-3 ? (s * tt - .5 * a * tt * tt) / s : 0;
    return {x: b.x + b.vx * k, z: b.z + b.vz * k};
  }
  /** To the ball: the first spot along its roll this body gets to in time. */
  private spMeet(me: PlayerState, b: BallState, input: Command, now: number, lead: number): Command {
    let to = {x: b.x, z: b.z};
    for (let t = .1; t <= 2.5; t += .1) { const p = this.spAhead(b, t * lead); if (gap(me, p) <= 9.5 * t) { to = p; break; } to = p; }
    return this.spGo(me, to, input, now, 8, .05);
  }
  /** Off the ball with the side in possession (or a loose ball the side is not chasing): an attacker offers ahead on a
   *  wing, a support behind and across; the keeper keeps. */
  private spShape(me: PlayerState, seat: BallSeat, at: {x: number; z: number}, b: BallState, mates: PlayerState[], input: Command, now: number, dir: number, ownZ: number, ours: boolean, foes: readonly PlayerState[] = []): Command {
    const role = seat.role ?? 'attack', side = at.x > 0 ? -1 : 1, R = GOAL_RULES;
    // (The run: the side on the ball, its carrier turned up the pitch - the attacker goes in behind their last
    // field player for RUN.for s, on the far side of the ball from the carrier, then offers again; once in RUN.again s.)
    if (ours && role === 'attack' && foes.length) {
      const carrierRun = (b.vx * 0 + b.vz) * dir, keeperZ = dir * R.halfZ;
      const field = foes.filter(f => Math.abs(f.z - keeperZ) > 3), last = field.length ? Math.max(...field.map(f => f.z * dir)) : at.z * dir + 6;
      if (now >= this.runAgain && carrierRun > 3 && me.z * dir < last + 1) { this.runUntil = now + RUN.for; this.runAgain = now + RUN.again; }
      if (now < this.runUntil) {
        const z = clamp((last + RUN.beyond) * dir, -R.halfZ + 3, R.halfZ - 3), x = clamp(side * RUN.wide, -R.halfX + 2, R.halfX - 2);
        return this.spGo(me, {x, z}, input, now, 4, .6);
      }
    }
    const ahead = role === 'attack' || role === 'front' ? (ours ? 9 : 4) : (ours ? -7 : -8);
    const x = clamp(role === 'attack' || role === 'front' ? side * 6.5 : at.x * .3 - side * 4, -R.halfX + 1.5, R.halfX - 1.5);
    const z = clamp(at.z + dir * ahead, -R.halfZ + 2, R.halfZ - 2), spot = {x, z};
    // (Never on top of the ball or a team-mate: an offer stands SPACE.offer m from the ball, and steps off a team-mate
    // nearer than SPACE.mate m.)
    const off = gap(spot, at);
    if (off < SPACE.offer) { const ux = off > .1 ? (spot.x - at.x) / off : side, uz = off > .1 ? (spot.z - at.z) / off : 0; spot.x = clamp(at.x + ux * SPACE.offer, -R.halfX + 1.5, R.halfX - 1.5); spot.z = clamp(at.z + uz * SPACE.offer, -R.halfZ + 2, R.halfZ - 2); }
    for (const q of mates) { const d = gap(q, spot); if (d < SPACE.mate && d > .01) { spot.x = clamp(spot.x + (spot.x - q.x) / d * (SPACE.mate - d), -R.halfX + 1.5, R.halfX - 1.5); spot.z = clamp(spot.z + (spot.z - q.z) / d * (SPACE.mate - d), -R.halfZ + 2, R.halfZ - 2); } }
    void b; void ownZ;
    return this.spGo(me, spot, input, now, 10, .8);
  }
  /** Locked on by a person in the FIGHT stance: this bot locks back on them, closes, strikes when in reach and guards
   *  against a blow coming by the level's chance (SPORT_BOT.guard) - the fight is the person's choice, never one-sided. */
  private spFight(me: PlayerState, q: PlayerState | undefined, input: Command, now: number): Command {
    if (!q) return input;
    input.targetId = q.id; input.lock = true;
    this.spGo(me, q, input, now, 8, 1.6);
    const d = gap(me, q), coming = q.action === 'light' || q.action === 'heavy' || q.action === 'special';
    if (now < this.guardUntil) { input.guard = true; return input; }
    if (d < 2.4 && now >= this.fightAt) {
      this.fightAt = now + .35 + this.rnd() * .3;
      if (coming && this.rnd() < SPORT_BOT[this.lvl].guard) { this.guardUntil = now + .45; input.guard = true; }
      else input.attack = this.rnd() < .7 ? 'light' : 'heavy';
    }
    return input;
  }
  private readonly closeSeen = new Map<string, number>();
  private pokeErr = NaN; private tackleAt = 0; private lookAt = 0; private trickAt = 0; private fightAt = 0; private guardUntil = 0; private runUntil = 0; private runAgain = 0;
  /** The keeper: on the line from the ball to the middle of its goal, a stride or three off it, inside the posts. */
  private spKeep(me: PlayerState, b: BallState, input: Command, now: number, ownZ: number, dir: number): Command {
    const R = GOAL_RULES, d = Math.hypot(b.x, b.z - ownZ), out = clamp(1 + d * .08, 1, 3), k = out / Math.max(d, 1e-3);
    const x = clamp(b.x * k, -R.goalHalfWidth + .5, R.goalHalfWidth - .5), z = ownZ + dir * Math.max(1, Math.abs((b.z - ownZ) * k));
    this.spGo(me, {x, z}, input, now, 99, .25);
    input.yaw = Math.atan2(b.x - me.x, b.z - me.z);
    return input;
  }
  /** A loose ball in the keeper's box that the keeper is nearest: it comes off its line for it. */
  private spKeeperOut(me: PlayerState, b: BallState, mates: PlayerState[], ownZ: number) {
    if (b.carry || Math.abs(b.z - ownZ) > 7 || Math.abs(b.x) > 8 || Math.hypot(b.vx, b.vz) > 12) return false;
    const d = gap(me, b);
    return mates.every(q => gap(q, b) > d);
  }
  /** Run to a spot: the stick and the view at it, a sprint when it is far. */
  private spGo(me: PlayerState, to: {x: number; z: number}, input: Command, now: number, sprint: number, stop: number): Command {
    const dx = to.x - me.x, dz = to.z - me.z, d = Math.hypot(dx, dz);
    if (d > stop) { input.moveX = dx / d; input.moveZ = dz / d; input.yaw = Math.atan2(dx, dz); }
    if (d > sprint && now >= this.dashAt && me.grounded && me.stamina > 40) { input.dash = true; this.dashAt = now + 1.2 + this.rnd(); }
    if (me.boost && d < 3 && d > stop) { input.moveX = dx / d * .45; input.moveZ = dz / d * .45; }
    if (d < 1.2 && d > stop) { input.moveX *= d / 1.2; input.moveZ *= d / 1.2; }
    return input;
  }
}
export type {Mate, BallTeam};
export {passPick};
