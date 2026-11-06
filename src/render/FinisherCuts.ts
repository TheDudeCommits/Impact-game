import * as THREE from 'three';
import { AWAKENING_ENTRY, moveFor } from '../game/awakening';
import { MOVES } from '../game/moves';
import type { FighterId } from '../game/types';
import type { Fighter } from './Fighter';

export type CinemaKind = 'confirm' | 'charge' | 'theirs' | 'awaken';
type Phase = 'off' | 'glide' | 'hold' | 'out';
interface Cinema { kind: CinemaKind; key: string; thrower: Fighter; t: number; last: number }

/** The bars' share of the frame's height (each), and how long they take to come in and to go, in seconds. */
export const LETTERBOX = .052;
const BARS_IN = .28, BARS_OUT = .4;
/** The grade: held at GRADE_HOLD (of the bars) while the cinema is on, punched to OPEN_PUNCH as it opens (CHARGE_PUNCH
 *  for a charge, opened by the press rather than by a blow) and to HIT_PUNCH on its last blow, a punch let go of at
 *  PUNCH_RATE a second. */
const GRADE_HOLD = .38, OPEN_PUNCH = 1, CHARGE_PUNCH = .55, HIT_PUNCH = .8, PUNCH_RATE = 6;
/** How long the cinema holds past its last blow. */
const FINISH_HOLD = .45;
/** The framing the glide lands on: HERO_ANGLE radians off the line from the pair back to the thrower, on the lens's
 *  side, round the pair's point HERO_TOWARD of the way from the thrower to the victim; the lens HERO_EYE over the
 *  floor looking at HERO_LOOK over it; the field HERO_FOV; the reach fitted to hold the pair across HERO_FILL_X of the
 *  frame and HERO_TALL metres of it up HERO_FILL_Y of it, within HERO_LEAST and HERO_REACH. All times the bodies'
 *  size. */
const HERO_ANGLE = 1.2, HERO_TOWARD = .62, HERO_EYE = .78, HERO_LOOK = 1.25, HERO_FOV = 46, HERO_FILL_X = .72, HERO_FILL_Y = .7,
  HERO_TALL = 2.7, HERO_LEAST = 3.8, HERO_REACH = 9;
/** Ultimates that raise something bigger than the thrower round them or over the victim - the RAKSHASA, a Guardian, a
 *  spirit, a Domain, the BLACK CONFESSIONAL - are framed WIDE times as tall, the look and the lens raised with it (WIDE_LOOK,
 *  WIDE_EYE of the growth), so the summon is seen whole rather than as a mass over the lens; and what comes down from
 *  the sky - the Grand Tide fist, the steamroller, the meteor - TALLER still. */
const WIDE = 1.45, TALLER = 1.7, WIDE_LOOK = .55, WIDE_EYE = .9;
const WIDE_FOR: Partial<Record<FighterId, number>> = {
  ume:WIDE,
  lanthorn:WIDE,
  highsun:WIDE,
  torsion:WIDE,
  kubiwa:WIDE,
  onigawara:WIDE,
  cardo:WIDE,
  minase:WIDE,
  aquilo:WIDE,
  'psyche':TALLER,
  'ovid':TALLER,
  hawser:WIDE,
  rotfalke:TALLER,
  bonsho:WIDE,
  murex:TALLER,
  kinu:WIDE,
  'madake':WIDE,
  akayuri:WIDE,
  hagure:WIDE,
  hisame:WIDE,
  svanhild:WIDE,
  mizuhiki:WIDE,
  'shibuichi':WIDE,
  'rakucho':WIDE,
  irbis:WIDE,
  shidare:WIDE,
  hinomoto:WIDE,
  amagoi:WIDE,
  'shakudo':WIDE,
  hikui:WIDE,
  tokan:WIDE,
  strappado:WIDE,
  unari:WIDE,
  barrow:WIDE,
  sashigane:WIDE,
  gosu:WIDE,
  kusushi:WIDE,
  hakushi:WIDE,
  suzuran:WIDE,wataame:WIDE,bruin:WIDE,
  senko:TALLER,buna:TALLER,oyashio:WIDE,adad:TALLER,
  'full-beam': WIDE, pyroclast: WIDE,akaito: WIDE, shijima: WIDE, tancho: WIDE, bellows: TALLER, mikage: WIDE, shanxiao: WIDE, kenzo: WIDE, shiden: WIDE, shirokane: WIDE, tobari: WIDE, koko: WIDE, kuon: WIDE, magatsu: WIDE, shiun: WIDE, gorai: WIDE,
  gummy: TALLER, oro: TALLER, akagane: TALLER, sorayomi: TALLER, shakugo: TALLER,
  // The native dismount/heel-drop acting rises above a grounded hit capsule.
  // Include the raised hands in the shot that actually owns the finisher lens.
  'basilissa': WIDE,
};
/** A thrower drawn as something far bigger than a body for its ultimate - Gorai's dragon coils round the victim - is
 *  filmed from the far side (FAR_SIDE radians off the line back to it, past side-on): its front to the lens, the
 *  victim in the near side of the frame, rather than its coils across the lens. */
const FAR_SIDE = 1.95;
const ANGLE_FOR: Partial<Record<FighterId, number>> = { gorai: FAR_SIDE };
/** The glide lands GLIDE_LEAD before the last blow and takes GLIDE_LEAST at least; its turn round the pair is held
 *  to what keeps the aim under AIM_SPEED (radians a second) at the ease's peak, 1.875 times its mean. */
const GLIDE_LEAD = .14, GLIDE_LEAST = .35, AIM_SPEED = 5.5;
/** Before the last blow the look keeps to the pair (PAIR_RATE); after it, it follows the victim at FOLLOW_RATE, no
 *  steeper than FOLLOW_UP radians over level, while the field closes HOLD_ZOOM degrees over the hold. */
const PAIR_RATE = 6, FOLLOW_RATE = 7, FOLLOW_UP = .3, HOLD_ZOOM = 2.5;
/** The hand-back takes OUT_LEAST to OUT_MOST seconds, timed by the turn it makes (AIM_SPEED) and the way the lens
 *  goes round the player (LENS_SPEED metres a second at the ease's peak), whichever is the longer. */
const OUT_LEAST = .4, OUT_MOST = .7, LENS_SPEED = 20;
/** The landing is pulled in to the room: no further out along its bearing than the walls leave, ROOM_CLEAR short of
 *  them, and never nearer the pair's point than LEAST_REACH (times the size). The glide's path is then tried at
 *  PATH_SAMPLES points: a lens within BODY_CLEAR (times the size) of the thrower or the victim across the floor rules it
 *  out anywhere along it, and a wall between the lens and what it looks at from WALL_FROM of the way on (it starts
 *  where the gameplay lens is, often behind a wall FollowCamera cuts away for it - in the thirteen-metre Proving Hall,
 *  nearly always - and the same cutaway keeps the way in clear). Tried on the lens's side and the other, then nearer,
 *  then turning less far round (TRIES: the
 *  share of the reach and of the turn). The fallback pushes in PUSH_SHARE of the way toward the pair, never nearer the
 *  thrower than PUSH_CLEAR (times the size) - pushed in from behind them, the thrower's back filled the frame - and
 *  closes PUSH_FOV degrees. */
const ROOM_CLEAR = .45, LEAST_REACH = 2.6, PATH_SAMPLES = 6, WALL_FROM = .8, BODY_CLEAR = .95, PUSH_SHARE = .3, PUSH_CLEAR = 3.2, PUSH_FOV = 5;
const TRIES: readonly { other: boolean; pull: number; turn: number }[] = [
  { other: false, pull: 1, turn: 1 }, { other: true, pull: 1, turn: 1 }, { other: false, pull: .8, turn: 1 }, { other: true, pull: .8, turn: 1 },
  { other: false, pull: .8, turn: .62 }, { other: true, pull: .8, turn: .62 }, { other: false, pull: .64, turn: .62 }, { other: false, pull: .64, turn: .38 },
];

const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smoother = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * t * (t * (t * 6 - 15) + 10); };
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const _ray = new THREE.Raycaster(), _hits: THREE.Intersection[] = [];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _dir = new THREE.Vector3();

/** The last blow of `fighter`'s ultimate (its form's, awakened), cached: moveFor builds an awakened move afresh. */
const lastBlows = new Map<string, number>();
function lastBlow(fighter: FighterId, awakened: boolean) {
  const key = `${fighter}:${awakened ? 1 : 0}`;
  let at = lastBlows.get(key);
  if (at === undefined) { const contacts = moveFor(fighter, 'ultimate', awakened).contacts; at = contacts[contacts.length - 1] ?? 0; lastBlows.set(key, at); }
  return at;
}
const confirms = (fighter: FighterId) => !!MOVES[fighter]?.ultimate?.confirm;
/** A body's size against a normal one, for the framing: its own (Gorai's 1.5) or its form's. */
const sizeOf = (body: Fighter) => Math.max(1, body.state.size ?? 1);

export class FinisherCuts {
  /** Settings.cinematics (and the pass), written by FollowCamera. */
  enabled = false;
  /** The main game's modes (main.ts): the charges, an opponent's ultimate and the transformation get the cinema there. */
  arena = true;
  /** Whether the shot has the lens this frame, and which part of it ('glide', 'hold', 'out'). */
  active = false; kind: Exclude<Phase, 'off'> | 'none' = 'none';
  /** This frame's bars (0..1 of LETTERBOX) and grade (0..1, GameRenderer.cinemaGrade). */
  bars = 0; grade = 0;
  /** Bumped as a cinema opens and as its last blow lands (main.ts hears them), and which kind opened last. */
  opened = 0; struck = 0; openedKind: CinemaKind | 'none' = 'none';
  /** What the shot is about, for the scenery cutaway. */
  readonly pivot = new THREE.Vector3();
  /** Whether the shot has the view, from the confirm until it has given it back: the director stands aside. */
  get owns() { return this.phase !== 'off'; }

  private phase: Phase = 'off';
  private cinemaKey = ''; private struckKey = ''; private shotKey = '';
  private barsT = 0; private punch = 0;
  // The shot: who it is of, its clock (the thrower's action time), and its path round the pair's point.
  private victim?: Fighter;
  private openT = 0; private landT = 0; private lastT = 0;
  private size = 1; private floor = 0; private lookHigh = HERO_LOOK;
  private readonly center = new THREE.Vector3();
  private az0 = 0; private r0 = 0; private y0 = 0; private arc = 0; private r1 = 0; private y1 = 0;
  private push = false; private pushShare = PUSH_SHARE;
  private readonly eye0 = new THREE.Vector3();
  private readonly look0 = new THREE.Vector3();
  private readonly pairLook = new THREE.Vector3();
  private fov0 = 50; private fov1 = HERO_FOV;
  // What is on screen, and the hand-back's start.
  private readonly eye = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private fov = HERO_FOV;
  private readonly outEye = new THREE.Vector3();
  private readonly outLook = new THREE.Vector3();
  private outFov = HERO_FOV; private outClock = 0; private outFor = OUT_LEAST;
  // An opponent's ultimate on the player, found without allocating (see cinemaOf).
  private seek?: Fighter; private seekFor = '';
  private readonly scan = (body: Fighter) => {
    const o = body.state;
    if (this.seek || o.id === this.seekFor || o.action !== 'ultimate' || !o.alive || o.target !== this.seekFor || o.confirmedAt === undefined || !confirms(o.fighter)) return;
    this.seek = body;
  };

  reset() {
    this.phase = 'off'; this.active = false; this.kind = 'none'; this.victim = undefined;
    this.cinemaKey = this.struckKey = this.shotKey = ''; this.barsT = this.bars = this.punch = this.grade = 0;
  }

  /** Decide this frame's cinema and, while the shot has the view, put the lens there. `camera` holds the gameplay
   *  shot (and anything the director laid over it) as FollowCamera placed it; returns whether the shot replaced it. */
  apply(dt: number, camera: THREE.PerspectiveCamera, self: Fighter, crowd: ReadonlyMap<string, Fighter> | undefined, occluders: readonly THREE.Object3D[], bulk = 1) {
    dt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    const cinema = this.enabled ? this.cinemaOf(self, crowd) : undefined;
    if (cinema && cinema.key !== this.cinemaKey) {
      this.cinemaKey = cinema.key; this.opened++; this.openedKind = cinema.kind;
      this.punch = Math.max(this.punch, cinema.kind === 'charge' ? CHARGE_PUNCH : OPEN_PUNCH);
    }
    if (cinema && cinema.kind !== 'awaken' && cinema.t >= cinema.last && this.struckKey !== cinema.key) { this.struckKey = cinema.key; this.struck++; this.punch = Math.max(this.punch, HIT_PUNCH); }
    this.barsT = THREE.MathUtils.clamp(this.barsT + (cinema ? dt / BARS_IN : -dt / BARS_OUT), 0, 1);
    this.bars = smooth(this.barsT);
    this.punch *= Math.exp(-PUNCH_RATE * dt); if (this.punch < .004) this.punch = 0;
    this.grade = this.enabled ? Math.min(1, Math.max(GRADE_HOLD * this.bars, this.punch)) : 0;
    const on = this.film(dt, camera, self, cinema?.kind === 'confirm' ? cinema : undefined, crowd, occluders, bulk);
    this.active = on; this.kind = on ? this.phase as Exclude<Phase, 'off'> : 'none';
    return on;
  }

  /** The cinema the player is in this frame, if any (see the class notes). */
  private cinemaOf(self: Fighter, crowd: ReadonlyMap<string, Fighter> | undefined): Cinema | undefined {
    const s = self.state;
    if (!s.alive) return undefined;
    const t = s.actionTime * s.actionDuration;
    if (s.action === 'awaken') return this.arena && t <= AWAKENING_ENTRY ? { kind: 'awaken', key: `a:${s.actionStarted}`, thrower: self, t, last: AWAKENING_ENTRY } : undefined;
    if (s.action === 'ultimate') {
      const last = lastBlow(s.fighter, !!s.awakened), key = `u:${s.actionSeq ?? s.actionStarted}`;
      if (t > last + FINISH_HOLD) return undefined;
      if (!confirms(s.fighter)) return this.arena && !!s.target && !!crowd?.has(s.target) ? { kind: 'charge', key, thrower: self, t, last } : undefined;
      return s.confirmedAt !== undefined && !!s.target && !!crowd?.get(s.target) ? { kind: 'confirm', key, thrower: self, t, last } : undefined;
    }
    if (!this.arena || !crowd) return undefined;
    this.seek = undefined; this.seekFor = s.id; crowd.forEach(this.scan);
    const them = this.seek as Fighter | undefined; this.seek = undefined;
    if (!them) return undefined;
    const o = them.state, ot = o.actionTime * o.actionDuration, last = lastBlow(o.fighter, !!o.awakened);
    return ot <= last + FINISH_HOLD ? { kind: 'theirs', key: `t:${o.id}:${o.actionSeq ?? o.actionStarted}`, thrower: them, t: ot, last } : undefined;
  }

  /** The player's own hit-confirmed ultimate, filmed: the glide, the hold, the hand-back. */
  private film(dt: number, camera: THREE.PerspectiveCamera, self: Fighter, cinema: Cinema | undefined, crowd: ReadonlyMap<string, Fighter> | undefined, occluders: readonly THREE.Object3D[], bulk: number) {
    if (cinema && cinema.key !== this.shotKey) {
      const victim = crowd?.get(self.state.target ?? '');
      this.shotKey = cinema.key;
      if (victim && victim !== self) {
        // From the view on screen: the gameplay shot, or a hand-back still under way.
        if (this.phase === 'out') { this.eye0.copy(this.eye); _dir.subVectors(this.look, this.eye).normalize(); this.fov0 = this.fov; }
        else { this.eye0.copy(camera.position); camera.getWorldDirection(_dir); this.fov0 = camera.fov; }
        this.begin(camera, self, victim, cinema, occluders, bulk); this.phase = 'glide';
      }
    }
    if ((this.phase === 'glide' || this.phase === 'hold') && (!cinema || cinema.key !== this.shotKey)) this.leave(camera, self);
    if (this.phase === 'off') return false;
    if (this.phase === 'out') return this.handBack(dt, camera, self);
    const t = cinema!.t, victim = this.victim!;
    // The pair's point, as they stand now (the thrower may leap or cross a stopped field), at the planned height.
    const T = self.group.position, V = victim.group.position;
    _a.set(T.x + (V.x - T.x) * HERO_TOWARD, this.floor + this.lookHigh, T.z + (V.z - T.z) * HERO_TOWARD);
    this.pairLook.lerp(_a, 1 - Math.exp(-PAIR_RATE * dt));
    const k = this.landT > this.openT ? (t - this.openT) / (this.landT - this.openT) : 1, e = smoother(k);
    if (this.push) {
      this.eye.lerpVectors(this.eye0, this.look0, this.pushShare * e);
      this.look.copy(this.look0);
      this.fov = this.fov0 - PUSH_FOV * e;
    } else {
      this.lens(e, this.eye);
      // Past the last blow the field closes a little over the hold.
      this.fov = THREE.MathUtils.lerp(this.fov0, this.fov1, e) - HOLD_ZOOM * smooth((t - this.lastT) / FINISH_HOLD);
      // Storm Warning reads as a command from the staff to the overhead
      // storm. Keep that whole composition through its impact; tracking only
      // the thrown target loses both Sorayomi and the cloud at the decisive beat.
      if (t < this.lastT || self.state.fighter === 'sorayomi') this.look.lerpVectors(this.look0, this.pairLook, e);
      else {
        // Past the last blow: held on it, the look after the victim as they are thrown.
        const at = typeof victim.visualCenter === 'function' ? victim.visualCenter(_b) : _b.copy(V).setY(V.y + 1.05 * this.size);
        const flat = Math.hypot(at.x - this.eye.x, at.z - this.eye.z), most = this.eye.y + flat * Math.tan(FOLLOW_UP);
        if (at.y > most) at.y = most;
        this.look.lerp(at, 1 - Math.exp(-FOLLOW_RATE * dt));
      }
    }
    this.phase = k >= 1 ? 'hold' : 'glide';
    this.place(camera);
    return true;
  }

  /** Plan the glide from the lens as it stands (`camera`) to the framing the finisher lands in. */
  private begin(camera: THREE.PerspectiveCamera, self: Fighter, victim: Fighter, cinema: Cinema, occluders: readonly THREE.Object3D[], bulk: number) {
    this.victim = victim; this.push = false;
    const T = self.group.position, V = victim.group.position;
    this.size = Math.max(1, bulk, sizeOf(self), sizeOf(victim));
    this.floor = Math.min(T.y, V.y);
    this.openT = cinema.t; this.lastT = cinema.last;
    this.landT = Math.max(this.openT + GLIDE_LEAST, cinema.last - GLIDE_LEAD);
    // The glide starts where the view is (eye0, fov0 and the direction in _dir, set by the caller): taking over is
    // not a cut.
    const dx = _dir.x, dy = _dir.y, dz = _dir.z;
    let lx = V.x - T.x, lz = V.z - T.z;
    const spread = Math.hypot(lx, lz);
    if (spread > 1e-3) { lx /= spread; lz /= spread; } else { const n = Math.hypot(dx, dz) || 1; lx = -dx / n; lz = -dz / n; }
    this.center.set(T.x + (V.x - T.x) * HERO_TOWARD, this.floor, T.z + (V.z - T.z) * HERO_TOWARD);
    // (The YUGE stands 3.4 m: its rampage is framed taller than the Scout's cuts.)
    const wide = self.state.awakened && self.state.fighter === 'hawser' ? TALLER : WIDE_FOR[self.state.fighter] ?? 1;
    this.lookHigh = HERO_LOOK * this.size * (1 + WIDE_LOOK * (wide - 1));
    this.pairLook.set(this.center.x, this.floor + this.lookHigh, this.center.z);
    // The look at the start: down the view, as far out as the pair's point.
    const out = Math.max(1, (this.pairLook.x - this.eye0.x) * dx + (this.pairLook.y - this.eye0.y) * dy + (this.pairLook.z - this.eye0.z) * dz);
    this.look0.set(this.eye0.x + dx * out, this.eye0.y + dy * out, this.eye0.z + dz * out);
    this.look.copy(this.look0); this.eye.copy(this.eye0); this.fov = this.fov0;
    // Round the pair's point: where the lens stands, and the line back to the thrower.
    const ex = this.eye0.x - this.center.x, ez = this.eye0.z - this.center.z;
    this.az0 = Math.atan2(ex, ez); this.r0 = Math.hypot(ex, ez); this.y0 = this.eye0.y - this.floor;
    const back = Math.atan2(-lx, -lz), side = wrapped(this.az0 - back) >= 0 ? 1 : -1;
    // The reach that holds the pair: across the frame and up it.
    const tanV = Math.tan(THREE.MathUtils.degToRad(HERO_FOV) / 2), tanH = tanV * (camera.aspect || 16 / 9);
    const across = spread * Math.abs(Math.sin(ANGLE_FOR[self.state.fighter] ?? HERO_ANGLE)) + 1.3 * this.size;
    const reach = THREE.MathUtils.clamp(Math.max(HERO_LEAST * this.size, across / (2 * tanH * HERO_FILL_X), HERO_TALL * wide * this.size / (2 * tanV * HERO_FILL_Y)), 0, HERO_REACH * this.size);
    // The turn the glide's time allows (see AIM_SPEED).
    const most = AIM_SPEED * (this.landT - this.openT) / 1.875;
    this.fov1 = HERO_FOV; this.y1 = HERO_EYE * this.size * (1 + WIDE_EYE * (wide - 1));
    const angle = ANGLE_FOR[self.state.fighter] ?? HERO_ANGLE;
    const plan = camera.userData.finisher = { tries: [] as string[], spread: +spread.toFixed(2), reach: +reach.toFixed(2), chosen: -1 };
    for (let i = 0; i < TRIES.length; i++) {
      const each = TRIES[i];
      let arc = wrapped(back + (each.other ? -side : side) * angle - this.az0) * each.turn;
      if (Math.abs(arc) > most) arc = Math.sign(arc) * most;
      this.arc = arc;
      // Pulled in to the room along the landing's bearing.
      const want = reach * each.pull, az1 = this.az0 + arc;
      _b.set(this.center.x + Math.sin(az1) * want, this.floor + this.y1, this.center.z + Math.cos(az1) * want);
      this.r1 = Math.min(want, want * this.freeShare(this.pairLook, _b, occluders) - ROOM_CLEAR);
      const why = this.r1 < LEAST_REACH * this.size ? 'room' : this.pathClear(self, victim, occluders);
      plan.tries.push(why);
      if (why === 'clear') { plan.chosen = i; return; }
    }
    // Nowhere round the pair clear all the way: the view's own push-in toward the pair, kept off the thrower's back.
    this.push = true;
    const toward = this.look0.distanceTo(this.eye0), room = Math.hypot(this.eye0.x - T.x, this.eye0.z - T.z) - PUSH_CLEAR * this.size;
    this.pushShare = toward > 1e-3 ? THREE.MathUtils.clamp(room / toward, 0, PUSH_SHARE) : 0;
  }

  /** The glide's lens `e` of the way along it, into `out`. */
  private lens(e: number, out: THREE.Vector3) {
    const az = this.az0 + this.arc * e, r = THREE.MathUtils.lerp(this.r0, this.r1, e);
    return out.set(this.center.x + Math.sin(az) * r, this.floor + THREE.MathUtils.lerp(this.y0, this.y1, e), this.center.z + Math.cos(az) * r);
  }

  /** Whether the glide planned keeps clear of the walls and of the pair all the way: 'clear', or what is in the way
   *  and where along it (for the evidence: camera.userData.finisher). */
  private pathClear(self: Fighter, victim: Fighter, occluders: readonly THREE.Object3D[]) {
    const T = self.group.position, V = victim.group.position, clear = BODY_CLEAR * this.size;
    for (let i = 1; i <= PATH_SAMPLES; i++) {
      const k = i / PATH_SAMPLES, e = smoother(k), lens = this.lens(e, _b);
      if (Math.hypot(lens.x - T.x, lens.z - T.z) < clear || Math.hypot(lens.x - V.x, lens.z - V.z) < clear) return `body@${i}`;
      if (k < WALL_FROM) continue;
      _c.lerpVectors(this.look0, this.pairLook, e);
      if (this.freeShare(_c, lens, occluders) < 1) return `wall@${i}`;
    }
    return 'clear';
  }

  /** How much of the line from `from` to `to` is clear of the stage before it meets it: 1 for all of it. */
  private freeShare(from: THREE.Vector3, to: THREE.Vector3, occluders: readonly THREE.Object3D[]) {
    if (!occluders.length) return 1;
    _dir.subVectors(to, from); const length = _dir.length();
    if (length < 1e-3) return 1;
    _ray.set(from, _dir.divideScalar(length)); _ray.near = .1; _ray.far = length + ROOM_CLEAR;
    _hits.length = 0; _ray.intersectObjects(occluders as THREE.Object3D[], true, _hits);
    const share = _hits.length ? Math.min(1, _hits[0].distance / length) : 1; _hits.length = 0;
    return share;
  }

  /** The cinema is over: hand the view back from where the shot is now. */
  private leave(camera: THREE.PerspectiveCamera, self: Fighter) {
    this.phase = 'out'; this.outClock = 0;
    this.outEye.copy(this.eye); this.outLook.copy(this.look); this.outFov = this.fov;
    // Timed by the turn to the gameplay shot's heading and the way round the player to its lens (neither moves far
    // in this time).
    camera.getWorldDirection(_dir);
    const turn = Math.abs(wrapped(Math.atan2(this.outLook.x - this.outEye.x, this.outLook.z - this.outEye.z) - Math.atan2(_dir.x, _dir.z)));
    const P = self.group.position, sx = this.outEye.x - P.x, sz = this.outEye.z - P.z, gx = camera.position.x - P.x, gz = camera.position.z - P.z;
    const rs = Math.hypot(sx, sz), rg = Math.hypot(gx, gz);
    const way = Math.abs(wrapped(Math.atan2(gx, gz) - Math.atan2(sx, sz))) * (rs + rg) / 2 + Math.abs(rg - rs) + Math.abs(camera.position.y - this.outEye.y);
    this.outFor = THREE.MathUtils.clamp(1.875 * Math.max(turn / AIM_SPEED, way / LENS_SPEED), OUT_LEAST, OUT_MOST);
  }

  /** The hand-back: from the shot to the view FollowCamera has placed this frame, round the player rather than
   *  through them, eased; false once it is all the gameplay shot's. */
  private handBack(dt: number, camera: THREE.PerspectiveCamera, self: Fighter) {
    this.outClock += dt;
    const w = smoother(this.outClock / this.outFor);
    if (w >= 1) { this.phase = 'off'; this.victim = undefined; return false; }
    const P = self.group.position, gameEye = _a.copy(camera.position);
    camera.getWorldDirection(_dir);
    const sx = this.outEye.x - P.x, sz = this.outEye.z - P.z, gx = gameEye.x - P.x, gz = gameEye.z - P.z;
    const azS = Math.atan2(sx, sz), azG = Math.atan2(gx, gz), az = azS + wrapped(azG - azS) * w;
    const r = THREE.MathUtils.lerp(Math.hypot(sx, sz), Math.hypot(gx, gz), w);
    this.eye.set(P.x + Math.sin(az) * r, THREE.MathUtils.lerp(this.outEye.y, gameEye.y, w), P.z + Math.cos(az) * r);
    _c.copy(gameEye).addScaledVector(_dir, Math.max(1, this.outLook.distanceTo(this.outEye)));
    this.look.lerpVectors(this.outLook, _c, w);
    this.fov = THREE.MathUtils.lerp(this.outFov, camera.fov, w);
    this.place(camera);
    return true;
  }

  private place(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.look);
    camera.fov = this.fov;
    this.pivot.copy(this.look);
  }
}
