import type {PlayerInput, PlayerState} from '../types';
import {BALL_ID, GOAL_RULES, type BallSeat, type BallState, type BallTeam, type BallView} from './model';
import {BallBrain, type BotLevel} from './BallBrain';
import {FOOTBALL, laneOpen, passPick, type Mate} from './football';
import type {BotPlan} from './BallBrain';

type Command = Omit<PlayerInput, 'seq'> & {lightHeld?: boolean};
const gap = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
/** Whether a pass's lane from `a` to `b` is clear of `foes` by `clear` m the whole way - from the ball's
 *  own spot (laneOpen leaves the first stretch out, so a presser stood in front of the ball was never in the way). */
const laneFrom = (a: {x: number; z: number}, b: {x: number; z: number}, foes: readonly {x: number; z: number}[], clear: number) => {
  const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1e-6;
  for (const f of foes) { const t = clamp(((f.x - a.x) * ex + (f.z - a.z) * ez) / L2, 0, 1); if (t < .95 && Math.hypot(a.x + ex * t - f.x, a.z + ez * t - f.z) < clear) return false; }
  return true;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How the SPORT bots play (football.ts), by level: `think` s between looks at the game (a pass to a caller is looked
 *  for every tick), `aim` rad of error on a shot, `shoot` m from goal it shoots inside, `hold` s it carries before it
 *  looks to pass with nobody on it, `press` m an opponent on it counts as pressure, `read` s before the other side's
 *  pass is read and chased. The chance a tenth of a second that a TACKLE in reach is pressed (`tackle`, a
 *  SLIDE from behind `slide`), that a carrier met head on tries the TRICK (`trick`), that the right ball is met first
 *  time (`first`), and that a bot a person fights guards against a blow coming (`guard`); `err` m either way its poke's
 *  timing is off by (tuned so about half the pokes win between equal bots). `carry` s it keeps the ball with nobody
 *  on it (drawn from the range each time), `person` its share of the TACKLE's chance on a person carrying it,
 *  `markPerson` m goal-side it marks a person from. `shoot` is 12 / 13.5 / 14.5 (it was 14 / 16 / 18): the keepers
 *  dive (football.ts FOOTBALL.fun2.keeper), and HARD's long shots were saved - it shot itself out of its matches. */
export const SPORT_BOT: Readonly<Record<BotLevel, {think: number; aim: number; shoot: number; hold: number; press: number; read: number; tackle: number; slide: number; trick: number; first: number; guard: number; err: number; carry: readonly [number, number]; person: number; markPerson: number}>> = {
  easy: {think: .3, aim: .2, shoot: 12, hold: 3, press: 2.2, read: .5, tackle: .035, slide: .025, trick: .07, first: .35, guard: .2, err: .85, carry: [1.2, 3], person: .12, markPerson: 4.2},
  normal: {think: .16, aim: .13, shoot: 14.5, hold: 2.6, press: 2.6, read: .35, tackle: .05, slide: .04, trick: .1, first: .65, guard: .4, err: .62, carry: [1.1, 2.8], person: .55, markPerson: 3.6},
  hard: {think: .1, aim: .08, shoot: 15.5, hold: 2.2, press: 3, read: .2, tackle: .065, slide: .055, trick: .13, first: .85, guard: .55, err: .45, carry: [1.1, 2.6], person: 1, markPerson: 2.7},
};
/** Football, with the person at the heart of it.
 *  - A carrier keeps it `carry` s (SPORT_BOT, drawn each time it has the ball: dribbling, turning, looking) before it
 *    passes with nobody on it; one of theirs within `tight` m is on it, and it looks to pass after `tightAfter` s. A
 *    lane is clear by `lane` m plus `lanePerM` a metre of the pass (a long ball is longer in the air to be read).
 *  - The person's side feeds the person: an open person (nobody of theirs within `open` m, the lane clear by `lane` m all
 *    the way from the ball) gets it after `feed` s (to `feedTo`), before the other bot; the side's bots shoot only from
 *    a clear chance (spChance `clear`), else they look for the person; its keeper finds the person first.
 *  - A bot's TACKLE on a person carrying it is pressed at SPORT_BOT `person` of its level's chance (the person on the
 *    ball is the game: pressed, rarely robbed on NORMAL).
 *  - First time, a bot plays it on only toward a person or into a run well ahead (`firstOn` of the time with nobody
 *    near).
 *  - The cover: with the one pressing beaten, or the carrier within `danger` m of goal, the nearest still goal-side
 *    presses too; one the ball has gone past sprints back from `recover` m out.
 *  - A person free (nobody within `open` m) but with one of theirs in the lane: chipped to over the one on the ball
 *    (all in the way within `chipNear` m of it, the person `chipFrom` m off or more), else the carrier slides across
 *    the lane to open the angle.
 *  - A bot kicking off plays the kickoff's pass to a team-mate after `kickPass` s.
 *  - A loose ball a person could reach within `defer` s of a bot is left to the person (0: off - tried at .35, the
 *    person's side lost the loose balls its person did not go for, and the play stood still round them). */
export const FUN = {tight: 1.5, tightAfter: .55, open: 2.6, lane: 1.4, lanePerM: .07, feed: .45, feedTo: .85, clear: .45, firstOn: .15, danger: 17, recover: 4, kickPass: .35, defer: 0, chipNear: 3, chipFrom: 8,
  /** A presser's error in its reach for the ball is drawn again every `errAgain` s; a carrier held at the
   *  edge of the box with no pass on shoots after `edgeHold` s past its carry. */
  errAgain: 1.2, edgeHold: 1.2,
  /** The chance a side of bots alone shoots from (spChance), by level (SHOT_CHANCE, 0.12, for every level, left them
   *  shy or wasteful). */
  chance: {easy: .16, normal: .09, hard: .07}} as const;
/** A team-mate who is a person is worth this much more as a pass (one person among bots is never a spectator); an open
 *  one is fed (FUN). A call (FOOTBALL.call) is answered the first tick a lane to them is open. */
const PERSON = {bonus: 5} as const;
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
    this.since = -Infinity; this.carryFor = NaN;
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
      // (A person about as near - FUN.defer s - is left to it: the loose ball is theirs to win.)
      const mine = this.spReach(me, b), quickest = mates.every(q => seatOf(q.id)?.role === 'keeper' || this.spReach(q, b) >= mine - .05 && !(seatOf(q.id)?.bot === false && this.spReach(q, b) < mine + FUN.defer));
      if (quickest) return this.spMeet(me, b, input, now, 1.1);
      return this.spShape(me, seat, b, b, mates, input, now, dir, ownZ, false);
    }
    if (!theirs) return this.spShape(me, seat, carrier, b, mates, input, now, dir, ownZ, true, foes);
    // Their carrier: the nearest of this side (not the keeper) meets them from in front; the rest stand goal-side.
    const mineD = gap(me, carrier), nearest = mates.every(q => seatOf(q.id)?.role === 'keeper' || gap(q, carrier) >= mineD - .05);
    // (The cover - when the one pressing has been beaten (no longer between the carrier and goal) or the
    // carrier is in range of goal (FUN.danger m), the nearest of this side still goal-side steps in too.)
    const goalSide = (q: {z: number}) => (carrier.z - q.z) * dir > .5, field = mates.filter(q => seatOf(q.id)?.role !== 'keeper');
    const first = field.reduce<PlayerState | undefined>((f, q) => !f || gap(q, carrier) < gap(f, carrier) ? q : f, undefined);
    const danger = Math.hypot(carrier.x, carrier.z - ownZ) < FUN.danger;
    const cover = !nearest && !!first && goalSide(me) && (!goalSide(first) || danger) && field.every(q => q === first || !goalSide(q) || gap(q, carrier) >= mineD - .05);
    if (nearest || cover) {
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
        // (Drawn again every FUN.errAgain s - one drawn short of the ball's reach would have a presser stand off a
        // carrier stood still for good, and the match stand still with them.)
        if (Number.isNaN(this.pokeErr) || now >= this.pokeErrAt) { this.pokeErr = (this.rnd() * 2 - 1) * L.err; this.pokeErrAt = now + FUN.errAgain; }
        // (On a person carrying it, at the level's share of the chance - SPORT_BOT.person.)
        const k = seatOf(carrier.id)?.bot === false ? L.person : 1;
        if (me.boost && db < PLAYER_REACH + FOOTBALL.tackle.slide.reach - .3 + this.pokeErr && this.rnd() < L.slide * k) { input.guard = true; this.tackleAt = now + FOOTBALL.tackle.again + .3; this.pokeErr = NaN; }
        else if (!me.boost && db < PLAYER_REACH + FOOTBALL.tackle.reach + this.pokeErr && this.rnd() < L.tackle * k) { input.guard = true; this.tackleAt = now + FOOTBALL.tackle.again + 1.4; this.pokeErr = NaN; }
      }
      return input;
    }
    // (Spacing: one presses; a support covers - on the line from the ball to its goal, COVER m off the
    // ball - and an attacker marks the nearest of theirs off the ball, goal-side, never nearer the ball than STAND_OFF.)
    if ((seat.role ?? 'attack') === 'support') {
      // (Near its box the support marks space, not the ball - the edge of the box on the far side of the
      // ball, no nearer it than FOOTBALL.fun2.support.off: at most two go to the ball there, the one pressing and its cover.)
      const S = FOOTBALL.fun2.support;
      if (Math.hypot(b.x, b.z - ownZ) < S.box) {
        const spot = {x: clamp(-Math.sign(b.x || me.x || 1) * S.far, -GOAL_RULES.halfX + 2, GOAL_RULES.halfX - 2), z: ownZ + dir * S.edge}, off = gap(spot, b);
        if (off < S.off) { const ux = off > .1 ? (spot.x - b.x) / off : 0, uz = off > .1 ? (spot.z - b.z) / off : dir; spot.x = clamp(b.x + ux * S.off, -GOAL_RULES.halfX + 1.5, GOAL_RULES.halfX - 1.5); spot.z = clamp(b.z + uz * S.off, -GOAL_RULES.halfZ + 1.5, GOAL_RULES.halfZ - 1.5); }
        return this.spGo(me, spot, input, now, 9, .6);
      }
      const cx = 0 - b.x, cz = ownZ - b.z, cd = Math.hypot(cx, cz) || 1, k = Math.min(SPACE.cover, cd * .6) / cd;
      // (The ball past this body toward its goal - it sprints back, FUN.recover m out.)
      return this.spGo(me, {x: b.x + cx * k, z: b.z + cz * k}, input, now, goalSide(me) ? 9 : FUN.recover, .6);
    }
    let mark: PlayerState | undefined, best = Infinity;
    for (const f of foes) { if (f.id === carrier.id) continue; const d = gap(f, me); if (d < best) { best = d; mark = f; } }
    const m = mark ?? carrier, mx = 0 - m.x, mz = ownZ - m.z, md = Math.hypot(mx, mz) || 1;
    // (A person is marked from further off - SPORT_BOT.markPerson m by level - so they can get free.)
    const markGap = seatOf(m.id)?.bot === false ? SPORT_BOT[this.lvl].markPerson : 2.5;
    const spot = {x: m.x + mx / md * markGap, z: m.z + mz / md * markGap}, off = gap(spot, b);
    if (off < SPACE.standOff) { const ux = (spot.x - b.x) / (off || 1), uz = (spot.z - b.z) / (off || 1); spot.x = b.x + ux * SPACE.standOff; spot.z = b.z + uz * SPACE.standOff; }
    return this.spGo(me, spot, input, now, goalSide(me) ? 9 : FUN.recover, .6);
  }

  /** With the ball (FUN): answer a call; feed an open person; shoot from a chance (a person's side: a clear
   *  one only); keep it a while - dribbling at goal, shielding it from one of theirs on it - then pass, the person first. */
  private spOnBall(me: PlayerState, seat: BallSeat, mates: PlayerState[], foes: PlayerState[], view: BallView, b: BallState, now: number, input: Command, dir: number): Command {
    const L = SPORT_BOT[this.lvl], gz = dir * GOAL_RULES.halfZ, toGoal = Math.hypot(0 - me.x, gz - me.z), seatOf = (id: string) => view.seats.find(s => s.id === id);
    const pressure = foes.reduce((m, f) => Math.min(m, gap(f, me)), Infinity), held = now - this.since;
    const person = (id: string) => { const s = seatOf(id); return !!s && !s.bot; };
    // (The carry's length and the feed's moment, drawn as the ball comes to this bot.)
    if (Number.isNaN(this.carryFor)) { this.carryFor = L.carry[0] + (L.carry[1] - L.carry[0]) * this.rnd(); this.feedAt = FUN.feed + (FUN.feedTo - FUN.feed) * this.rnd(); }
    const lane = (q: {x: number; z: number}) => laneFrom(b, q, foes, FUN.lane + FUN.lanePerM * gap(b, q));
    const option = (q: PlayerState) => {
      const open = foes.reduce((m, f) => Math.min(m, gap(f, q)), Infinity), clear = lane(q), d = gap(q, me);
      if (d < FOOTBALL.pass.near + .5 || d > FOOTBALL.pass.far - 4) return {q, score: -Infinity, lane: clear, open};
      const ahead = (q.z - me.z) * dir;
      return {q, lane: clear, open, score: (clear ? 0 : -8) + ahead * .5 + Math.min(open, 7) * 1.1 - d * .08 + (person(q.id) ? PERSON.bonus : 0) - (seatOf(q.id)?.role === 'keeper' ? 6 : 0)};
    };
    // (Met head on by one of theirs closing, the TRICK - by the level's chance a tenth of a second.)
    // (Only with a tackler closing: in front, within 2.4 m, coming at this bot.)
    const facing = foes.find(f => { const d = gap(f, me); if (d > 2.4 || ((f.x - me.x) * Math.sin(me.yaw) + (f.z - me.z) * Math.cos(me.yaw)) <= 0) return false; const was = this.closeSeen.get(f.id); this.closeSeen.set(f.id, d); return was !== undefined && was - d > .02; });
    if (facing && now >= this.trickAt && now >= this.lookAt) { this.lookAt = now + .1; if (this.rnd() < L.trick) { this.trickAt = now + FOOTBALL.trick.again + .3; input.attack = 'special'; input.moveX = Math.sin(me.yaw); input.moveZ = Math.cos(me.yaw); return input; } }
    // The call: the first tick a lane to the caller is open, the ball goes.
    const call = this.sportCall && now < this.sportCall.until ? mates.find(q => q.id === this.sportCall!.id) : undefined;
    if (call && held > .05 && laneOpen(b, call, foes) && gap(call, me) > FOOTBALL.pass.near) { this.sportCall = null; return this.spPassTo(me, call, input, false); }
    // (An open person - nobody of theirs within FUN.open m, the lane clear - is fed, before the other bot.)
    const p = mates.find(q => person(q.id)), personSide = !!p;
    // (The person is worth the risk: their lane is clear by FUN.lane m however long the pass.)
    const pOpen = !!p && foes.every(f => gap(f, p) > FUN.open) && laneFrom(b, p, foes, FUN.lane) && gap(p, me) > FOOTBALL.pass.near + .5 && gap(p, me) < FOOTBALL.pass.far - 6;
    const keeper = seat.role === 'keeper';
    if (p && pOpen && held > (keeper ? .3 : this.feedAt)) return this.spPassTo(me, p, input, false);
    // (Free, but one of theirs in the lane: chipped over the one on the ball when that is all that is in the way and the
    // person is far enough off for a loft; else the carrier slides the ball across to open the angle, FUN.shift.)
    let shift: {x: number; z: number} | undefined;
    const pd = p ? gap(p, me) : 0;
    if (p && !pOpen && !keeper && foes.every(f => gap(f, p) > FUN.open) && pd > FOOTBALL.pass.near + .5 && pd < FOOTBALL.pass.far - 6) {
      const ex = p.x - b.x, ez = p.z - b.z, L2 = ex * ex + ez * ez || 1e-6;
      const block = foes.filter(f => { const t = clamp(((f.x - b.x) * ex + (f.z - b.z) * ez) / L2, 0, 1); return t < .95 && Math.hypot(b.x + ex * t - f.x, b.z + ez * t - f.z) < FUN.lane; });
      if (block.length && block.every(f => gap(f, b) < FUN.chipNear) && pd > FUN.chipFrom && held > this.feedAt) return this.spPassTo(me, p, input, true);
      if (block.length) { const f = block[0], side = (f.x - b.x) * ez - (f.z - b.z) * ex > 0 ? -1 : 1, k = Math.sqrt(L2); shift = {x: ez / k * side, z: -ex / k * side}; }
    }
    // (A bot kicking off plays the kickoff's pass - to a team-mate with a lane, after FUN.kickPass s - as
    // a side does, rather than running the ball through a side still on its marks.)
    if (!keeper && held > FUN.kickPass && view.events.some(e => e.kind === 'kickoff' && now - e.at < GOAL_RULES.kickoffSeconds + 1.5 && this.since <= e.at + GOAL_RULES.kickoffSeconds + .05)) {
      const to = mates.filter(q => seatOf(q.id)?.role !== 'keeper' && lane(q) && gap(q, me) > FOOTBALL.pass.near + .5).sort((x, y) => gap(x, me) - gap(y, me))[0];
      if (to) return this.spPassTo(me, to, input, false);
    }
    if (now >= this.nextThink) {
      this.nextThink = now + L.think * (.8 + this.rnd() * .4);
      // Shoot when the chance is good - near enough, central enough, a line to goal past the field players - and no
      // team-mate's is better; else the pass (A team's shots, twenty to thirty a match, not one every few seconds).
      // (On a person's side, only from a clear chance - FUN.clear.)
      const keeperOf = foes.reduce<PlayerState | undefined>((k, f) => !k || Math.abs(f.z - gz) < Math.abs(k.z - gz) ? f : k, undefined);
      const field = foes.filter(f => f !== keeperOf), mine0 = this.spChance(me, gz, dir, field);
      let mateBest = 0, mateQ: PlayerState | undefined;
      for (const q of mates) { if (seatOf(q.id)?.role === 'keeper' || !lane(q)) continue; const c = this.spChance(q, gz, dir, field); if (c > mateBest) { mateBest = c; mateQ = q; } }
      // (A side that has just shot works the ball again first: another inside SHOT_AGAIN s only from a great chance.)
      const lately = view.events.some(e => e.kind === 'strike' && e.team === seat.team && now - e.at < SHOT_AGAIN);
      // (A side of bots alone shoots from a chance by its level - FUN.chance: at one bar for all, NORMAL and HARD sides
      // took two to six shots a match and never ran a match close.)
      const bar = personSide ? Math.max(FUN.clear, lately ? SHOT_GREAT : 0) : lately ? SHOT_GREAT : FUN.chance[this.lvl] ?? SHOT_CHANCE;
      if (!keeper && mine0 >= bar && mine0 >= mateBest - .05 && (held > .45 || pressure < 2)) {
        const side = keeperOf && keeperOf.x > 0 ? -1 : 1, tx = side * (GOAL_RULES.goalHalfWidth - .9) * (.6 + .4 * this.rnd());
        const aim = Math.atan2(tx - me.x, gz - me.z) + (this.rnd() * 2 - 1) * L.aim;
        input.yaw = aim; input.attack = 'heavy'; input.moveX = Math.sin(aim); input.moveZ = Math.cos(aim);
        if (toGoal > 8 && pressure > 2.5) { input.heavyHeld = true; this.holdTo = now + .25 + this.rnd() * .3; this.holdAim = aim; }
        return input;
      }
      // (A team-mate with a better chance gets it - on a person's side, only the person.)
      if (mateQ && mateBest > mine0 + .1 && held > .2 && (!personSide || person(mateQ.id))) return this.spPassTo(me, mateQ, input, false);
      // (Only a pass with a lane - or one long enough to loft over the one in the way.)
      const options = mates.map(option).filter(o => o.lane || gap(o.q, me) > 9).sort((x, y) => y.score - x.score), top = options[0];
      const tight = pressure < FUN.tight;
      // (One of theirs on it: a pass once it has had a moment; the keeper gives it to a team-mate at once; otherwise kept
      // FUN carry's s - dribbled, turned, looked up - before it goes to the best there is.)
      const due = keeper ? held > .5 : tight ? held > FUN.tightAfter : held > this.carryFor;
      if (due && top && top.score > (tight || keeper ? -6 : -4)) return this.spPassTo(me, top.q, input, !top.lane && gap(top.q, me) > 9);
      // (Shielded long enough - FOOTBALL.fun2.shield.most - it goes on whatever: the best there is, else
      // lofted on into space up the pitch.)
      if (tight && held > FOOTBALL.fun2.shield.most) {
        const any = mates.filter(q => gap(q, me) > FOOTBALL.pass.near + .5).sort((x, y) => option(y).score - option(x).score)[0];
        if (any) return this.spPassTo(me, any, input, !lane(any));
        const yaw = Math.atan2(-me.x * .4, gz - me.z); input.attack = 'light'; input.lightHeld = true; input.yaw = yaw; input.moveX = Math.sin(yaw); input.moveZ = Math.cos(yaw);
        this.loftTo = this.clock + FOOTBALL.press.tap + .05; this.loftAim = yaw; return input;
      }
      if (due && !tight) this.carryFor = held + .6;
    }
    // Dribble at goal, edging away from the nearest opponent in front; sprint into open grass. Toward the edge of the
    // box (BOX_EDGE m out), not into the net, unless their keeper is off its line and the goal is open.
    const keeperHome = foes.some(f => Math.hypot(f.x, f.z - gz) < 5), to = keeperHome ? {x: me.x * .5, z: gz - dir * BOX_EDGE} : {x: 0, z: gz};
    let ax = to.x - me.x, az = to.z - me.z;
    // (At the edge with no shot on: hold it up and lay it off - the next look passes it.)
    // (Held there FUN.edgeHold s with no pass on, it is shot - one stood still at the edge of the box, nobody pressing
    // it, would hold the match up for minutes.)
    if (keeperHome && Math.hypot(ax, az) < 1.2 && held > this.carryFor + FUN.edgeHold && !seat.keeper) {
      const keeperOf = foes.reduce<PlayerState | undefined>((k, f) => !k || Math.abs(f.z - gz) < Math.abs(k.z - gz) ? f : k, undefined);
      const side = keeperOf && keeperOf.x > me.x ? -1 : 1, aim = Math.atan2(side * (GOAL_RULES.goalHalfWidth - 1) - me.x, gz - me.z) + (this.rnd() * 2 - 1) * L.aim;
      input.yaw = aim; input.attack = 'heavy'; input.moveX = Math.sin(aim); input.moveZ = Math.cos(aim);
      return input;
    }
    if (keeperHome && Math.hypot(ax, az) < 1.2) { this.carryFor = Math.min(this.carryFor, held); input.yaw = Math.atan2(-me.x, gz - me.z); return input; }
    const ad = Math.hypot(ax, az) || 1; ax /= ad; az /= ad;
    // (The angle opened for the person - across the lane, a little forward.)
    if (shift) { const nx = shift.x * .85 + ax * .35, nz = shift.z * .85 + az * .35, k = Math.hypot(nx, nz) || 1; input.moveX = nx / k * .85; input.moveZ = nz / k * .85; input.yaw = Math.atan2(nx, nz); return input; }
    // (One of theirs right on it from in front - the run turned away from them, the ball shielded with the
    // body until the pass is on.)
    const onIt = foes.find(f => gap(f, me) < FUN.tight + .6 && ((f.x - me.x) * ax + (f.z - me.z) * az) > 0);
    if (onIt) {
      const fx = onIt.x - me.x, fz = onIt.z - me.z, fd = Math.hypot(fx, fz) || 1, side = fx * az - fz * ax > 0 ? -1 : 1;
      const nx = -fx / fd * .7 + az * side * .7, nz = -fz / fd * .7 - ax * side * .7, k = Math.hypot(nx, nz) || 1;
      input.moveX = nx / k * .8; input.moveZ = nz / k * .8; input.yaw = Math.atan2(nx, nz);
      return input;
    }
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
  private carryFor = NaN; private feedAt = 0;
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
    // (With nobody near, only toward a person or into a run well ahead, FUN.firstOn of the time.)
    const near = foes.some(f => gap(f, me) < 3.5), open = mates.find(q => seat.role !== 'keeper' && laneOpen(me, q, foes) && (q.z - me.z) * dir > (near ? 0 : 6) && gap(q, me) > 5);
    if (open && (near || this.rnd() < FUN.firstOn)) { const yaw = Math.atan2(open.x - me.x, open.z - me.z); met.attack = 'light'; met.yaw = yaw; met.moveX = Math.sin(yaw); met.moveZ = Math.cos(yaw); }
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
  private pokeErr = NaN; private pokeErrAt = 0; private tackleAt = 0; private lookAt = 0; private trickAt = 0; private fightAt = 0; private guardUntil = 0; private runUntil = 0; private runAgain = 0;
  /** The keeper: on the line from the ball to the middle of its goal, a stride or three off it, inside the posts. */
  private spKeep(me: PlayerState, b: BallState, input: Command, now: number, ownZ: number, dir: number): Command {
    // (Set for a shot on its way at its goal - it stands, and its dive is the reach: FOOTBALL.fun2.keeper.)
    if (b.carry === undefined && b.lastTeam !== null && b.lastTeam !== (dir > 0 ? 'red' : 'blue') && (b.shot === 'drive' || b.shot === 'power') && (b.vz * dir) < -FOOTBALL.fun2.keeper.from) { input.yaw = Math.atan2(b.x - me.x, b.z - me.z); return input; }
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
