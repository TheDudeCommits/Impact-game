import * as THREE from 'three';
import { MOVES } from '../game/moves';
import type { CombatEvent, FighterId, PlayerState } from '../game/types';
import { strikeOffsets } from '../engine/sim/areaDamage';
import type { Fighter } from '../render/Fighter';
import { MoveStage, stageLook, type StageLook } from '../render/signature/MoveStage';
import { GLOW, RING, STAR } from '../render/signature/GlowBatch';
import { BLOOD } from '../render/signature/FlameSprites';
import type { VfxKit } from '../render/vfx/VfxKit';
import { AREA_CASTS } from './areaCasts';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const clamp = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a: number, b: number, x: number) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
/** The strike as drawn: the damage frame comes this long after the simulation's strike time. */
const LAG = .02;


/** One cast of an authored fighter's area move, as the events give it. */
interface Cast { actorId: string; fighter: FighterId; at: THREE.Vector3; cast: number; due?: number; strikes: number[]; until: number }
const CASTS: Cast[] = [];
/** The moves' strike offsets from their first strike (areaDamage.ts, as the server times them). */
const offsetsOf = (fighter: FighterId) => { const move = MOVES[fighter]?.area; return move ? strikeOffsets(move) : [0]; };
const releaseOf = (fighter: FighterId) => MOVES[fighter]?.area?.contacts[0] ?? .38;

/** AreaTelegraph hands every area event it draws: a cast of an authored fighter's move is kept for its effects. */
export function noteAreaCast(event: CombatEvent, players: ReadonlyMap<string, PlayerState>) {
  if (event.slot !== 'area' || !event.endpoint || (event.kind !== 'cast' && event.kind !== 'release' && event.kind !== 'impact')) return;
  const fighter = (event.body ?? players.get(event.actorId)?.fighter ?? event.fighter) as FighterId | undefined;
  if (!fighter || !DRAWN.has(fighter) || event.fighter !== undefined && event.fighter !== fighter) return;
  const e = event.endpoint;
  let cast = CASTS.find(c => c.actorId === event.actorId && Math.hypot(c.at.x - e.x, c.at.z - e.z) < .05 && event.serverTime < c.until);
  if (!cast) {
    const at = new THREE.Vector3(e.x, e.y ?? 0, e.z), start = event.kind === 'cast' ? event.serverTime : event.serverTime - releaseOf(fighter);
    cast = { actorId: event.actorId, fighter, at, cast: start, strikes: [], until: start + (AREA_CASTS[fighter]?.base?.seconds ?? 2.5) + 2.5 };
    CASTS.push(cast); if (CASTS.length > 16) CASTS.shift();
  }
  if (event.kind === 'release' || event.kind === 'impact' && cast.due === undefined) {
    const due = event.kind === 'release' ? event.due ?? event.serverTime + .75 : event.serverTime;
    cast.due = due; cast.strikes = offsetsOf(fighter).map(o => due + o + LAG);
    cast.until = Math.max(cast.until, cast.strikes[cast.strikes.length - 1] + 2);
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _f = new THREE.Vector3(), _g = new THREE.Vector3(), _h = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _s = new THREE.Vector3(1, 1, 1);

/** Where a joint of the drawn body is (the form's, when the form is drawn), or false. */
function joint(f: Fighter, name: string, out: THREE.Vector3) { const j = f.drawnJoint(name); if (!j) return false; j.getWorldPosition(out); return true; }
/** The take's own clock while the drawn body plays it, else undefined. */
function takeTime(f: Fighter | undefined, fighter: FighterId): number | undefined {
  if (!f) return undefined;
  const cast = AREA_CASTS[fighter], name = f.displayedClipName;
  return name && (name === cast?.base?.clip || name === cast?.form?.clip) ? f.displayedClipTime : undefined;
}
/** The circle's centre at a body's chest. */
const chestOf = (c: Cast, out: THREE.Vector3) => out.copy(c.at).setY(c.at.y + 1.05);

type Draw = (fx: AreaCastFx, c: Cast, f: Fighter | undefined, time: number, take: number | undefined) => void;

// ------------------------------------------------------------------------------------------------------------ Madake
/** Madake's air: white, warmed at its rim by his red. */
const AIR: StageLook = { ...stageLook(0xffffff, 0xe8eef8, 0xc33e37), main: lin(2.2, .75, .5), core: lin(2.9, 2.6, 2.4) };
/** Each punch lands on its strike (the take's keys, author_area_casts.py): right, left, right, left, right. */
const STAG_FISTS = ['RightHand', 'LeftHand', 'RightHand', 'LeftHand', 'RightHand'];
const STAG_PUNCHES = [1.08, 1.28, 1.47, 1.63, 1.73].map(s => s + LAG);
const stag: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, target = chestOf(c, _b);
  for (let i = 0; i < STAG_PUNCHES.length; i++) {
    // Off the fist while the take plays; off the chest once he has moved on (the strike lands regardless).
    const at = c.strikes[i] ?? c.cast + STAG_PUNCHES[i], age = time - at + .03;
    if (age < 0 || age > .32) continue;
    let from = false;
    if (f && take !== undefined && joint(f, STAG_FISTS[i], _a)) from = true;
    if (!from) { if (!f) continue; _a.copy(f.group.position).setY(f.group.position.y + 1.25); }
    _c.subVectors(target, _a); const span = _c.length(); if (span < .3) continue; _c.divideScalar(span);
    const k = 1 - age / .32, last = i === STAG_PUNCHES.length - 1 ? 1.4 : 1;
    // A tunnel of air rings driven from the fist to the circle in a fifteenth of a second, each fading as it goes.
    for (let r = 0; r < 6; r++) {
      const s = r / 5, born = s * .07; if (age < born) continue;
      const life = clamp(1 - (age - born) / .24);
      st.glow(_d.copy(_a).addScaledVector(_c, span * s), (.22 + .55 * s) * last * (1 + .4 * (1 - life)), r === 0 ? AIR.core : AIR.main, .9 * life * last, RING, .05, i * 7 + r, .82);
    }
    // The air the fist split, a white stroke to the circle; a flash on the knuckles.
    st.streak(_a, _e.copy(_a).addScaledVector(_c, span * clamp(age / .07)), .05 * last * k, AIR.main, 1.3 * k);
    st.glow(_a, .32 * last, AIR.core, 1.1 * clamp(1 - age / .12), STAR, .2, i);
  }
};

// ----------------------------------------------------------------------------------------------------------- Magatsu
/** Magatsu's flame: a pale-rose heart, crimson body, black edge (his pyre's colours, houseKits.json magatsu). */
const PYRE: StageLook = { ...stageLook(0xffc2cc, 0xdc2337, 0x1a0204, { flame: BLOOD }), core: lin(3.0, 1.15, 1.25) };
/** His fireball's body: a sphere of black-crimson flame with a burning rose rim (MoveStage's ball, an EnergySphere). */
const PYRE_BALL: StageLook = { ...PYRE, dark: true, sphere: { body: lin(.05, .004, .008), core: lin(.9, .06, .1), rimA: lin(3.2, .75, .85), rimB: lin(2.1, .14, .24), spin: 2.2 } };
/** The take's beats (author_area_casts.py calamity_pyre): the bow catches (0.3-0.5), the string nocked (0.45), the
 *  arrow laid on (0.6), full draw (0.95-1.10), the loose (1.10); the strike at 1.25; the bow burns away by 1.6. */
const PYRE_TAKE = { kindle: [.04, .34], bow: [.28, .5], nock: .45, arrow: [.58, .8], loose: 1.1, burn: [1.18, 1.62] } as const;
const PYRE_FLIGHT = .15;
const pyre: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.25, target = chestOf(c, _b);
  const hands = !!f && take !== undefined && joint(f, 'LeftHand', _g) && joint(f, 'RightHand', _h);
  if (hands && take! < PYRE_TAKE.burn[1]) {
    const t = take!, L = _g, R = _h;
    // The kindling in the left palm.
    if (t < PYRE_TAKE.bow[1]) st.charge(L, PYRE, .16, smooth(PYRE_TAKE.kindle[0], PYRE_TAKE.kindle[1], t) * (1 - smooth(.42, .55, t) * .6), 3);
    // The bow: perpendicular to the line from the draw hand to the bow hand, its limbs swept back toward him, flexing as he
    // draws; it catches from the hand outward, and burns away from the tips after the loose.
    const grow = smooth(PYRE_TAKE.bow[0], PYRE_TAKE.bow[1], t), burn = smooth(PYRE_TAKE.burn[0], PYRE_TAKE.burn[1], t), live = grow * (1 - burn);
    if (live > .02) {
      const dir = _c.subVectors(L, R); if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1); dir.normalize();
      const axis = _d.copy(UP).addScaledVector(dir, -UP.dot(dir)); if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0); axis.normalize();
      const draw = t < PYRE_TAKE.loose ? smooth(.5, .95, t) : 1 - smooth(PYRE_TAKE.loose, PYRE_TAKE.loose + .06, t);
      const half = 1.0 * grow, flex = .22 + .24 * draw, n = 11;
      let px = 0, py = 0, pz = 0;
      for (let i = -n; i <= n; i++) {
        const u = i / n, reach = Math.abs(u); if (reach > grow + .02 || reach > 1 - burn * 1.05) { px = NaN; continue; }
        const x = L.x + axis.x * half * u - dir.x * flex * u * u, y = L.y + axis.y * half * u - dir.y * flex * u * u, z = L.z + axis.z * half * u - dir.z * flex * u * u;
        _e.set(x, y, z);
        if (!Number.isNaN(px) && i > -n) { _f.set(px, py, pz); st.streak(_f, _e, .07 * live, PYRE.main, 1.5 * live); st.streak(_f, _e, .022 * live, PYRE.core, 1.3 * live); }
        st.tongue(_e, _f.copy(axis).multiplyScalar(u < 0 ? -.35 : .35).addScaledVector(UP, .9).normalize(), .1 * live, .3 * live, PYRE, .6 + .4 * live, i + 11);
        if ((i & 3) === 0) st.glow(_e, .28 * live, PYRE.main, .45 * live);
        px = x; py = y; pz = z;
      }
      const tipA = _e.copy(L).addScaledVector(axis, half).addScaledVector(dir, -flex), tipB = _f.copy(L).addScaledVector(axis, -half).addScaledVector(dir, -flex);
      st.glow(L, .3, PYRE.main, .6 * live);
      // The string, from tip to tip through the draw hand once nocked; straight again after the loose.
      if (t > PYRE_TAKE.nock && grow > .9) {
        const sk = smooth(PYRE_TAKE.nock, PYRE_TAKE.nock + .08, t) * (1 - burn);
        if (t < PYRE_TAKE.loose + .02) { st.streak(tipA, R, .012, PYRE.core, 1.4 * sk); st.streak(tipB, R, .012, PYRE.core, 1.4 * sk); }
        else st.streak(tipA, tipB, .012, PYRE.core, 1.1 * sk);
      }
      // The arrow laid on the string: a shaft of flame from the draw hand past the bow, its head burning hotter at full draw.
      if (t > PYRE_TAKE.arrow[0] && t < PYRE_TAKE.loose + .015) {
        const ak = smooth(PYRE_TAKE.arrow[0], PYRE_TAKE.arrow[1], t), hot = smooth(.9, 1.08, t);
        const head = _a.copy(L).addScaledVector(dir, .32);
        st.streak(R, head, .03 * ak, PYRE.main, 1.5 * ak); st.streak(R, head, .012 * ak, PYRE.core, 1.4 * ak);
        st.glow(head, .2 + .22 * hot, PYRE.core, (.6 + .8 * hot) * ak, STAR, .25, 5);
        st.glow(head, .45 + .35 * hot, PYRE.main, (.4 + .5 * hot) * ak);
        for (let i = 0; i < 4; i++) st.tongue(_e.copy(head).addScaledVector(dir, -.06 * i), _f.copy(dir).multiplyScalar(-.6).addScaledVector(UP, .8).normalize(), (.08 + .05 * hot) * ak, (.22 + .14 * hot) * ak, PYRE, .8, 30 + i);
        st.light(head, 2.4 + 1.4 * hot, PYRE, (.25 + .35 * hot) * ak);
      }
    }
  }
  // The arrow's flight: from the bow hand (or his chest, if he has moved on) to the circle, landing on the strike.
  const fly = (time - (strike - PYRE_FLIGHT)) / PYRE_FLIGHT;
  if (fly >= 0 && fly < 1 && f) {
    if (hands && take! > PYRE_TAKE.loose - .1) _a.copy(_g); else _a.copy(f.group.position).setY(f.group.position.y + 1.3);
    _c.subVectors(target, _a); const span = _c.length(); if (span > .2) {
      _c.divideScalar(span);
      const s = fly * fly * (3 - 2 * fly) * .25 + fly * .75, at = _d.copy(_a).addScaledVector(_c, span * s);
      st.orb(at, _c, .24, PYRE, 7);
      st.streak(_e.copy(_a).addScaledVector(_c, span * Math.max(0, s - .35)), at, .05, PYRE.main, 1.4);
    }
  }
  // The fireball: a sphere of black-crimson flame swelling over the one inside, its rim burning rose (the pyre stands up
  // through it), licked by tongues, then collapsing into smoke.
  const age = time - strike;
  if (age >= 0 && age < 1.15) {
    if (!fx.fired(c, 0)) {
      st.burst(target, PYRE, 1.7, strike, { floor: c.at.y });
      st.erupt(_a.copy(c.at), UP, PYRE, 1.0, 4.6, strike, .85);
      st.shock(_a.copy(c.at), PYRE, 4.4, strike, .6);
    }
    const swell = 1 - Math.pow(1 - smooth(0, .14, age), 2), fall = smooth(.62, 1.1, age), r = (.6 + 1.35 * swell) * (1 + .08 * Math.sin(age * 31)) * (1 - .55 * fall);
    _a.copy(target).setY(target.y + .5 + .5 * smooth(.1, 1, age));
    if (r > .05) st.ball(_a, r, PYRE_BALL, 9, 1 - fall);
    st.glow(_a, r * 1.9, PYRE.main, .75 * (1 - fall) * swell);
    st.glow(_a, r * 1.25, PYRE.core, .55 * swell * (1 - smooth(.08, .4, age)));
    st.glow(_a, r * 1.4, PYRE.core, .6 * (1 - fall), RING, .04, Math.floor(time * 30), .9);
    for (let i = 0, n = st.n(18, 9); i < n; i++) {
      const az = i * 2.399963 + age * 1.5, el = -.4 + 1.25 * hash(i * 3.1), len = r * (.6 + .4 * hash(i + 2.2));
      _d.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      st.tongue(_e.copy(_a).addScaledVector(_d, r * .92), _d.lerp(UP, .3).normalize(), len * .5 * (1 - fall), len * (1 - fall), PYRE, .85 * (1 - fall), 50 + i);
    }
    st.light(_a, 7 + 3 * swell, PYRE, 1.15 * (1 - fall) * swell);
  }
};

// ---------------------------------------------------------------------------------------------------------- Lord ORO
/** Lord ORO's gold: white-gold glints, the gilt, a deep bronze. */
const GILT: StageLook = stageLook(0xfff4c8, 0xf2b632, 0x5a3608);
/** The take's beats (author_area_casts.py knife_rain): the fans (0.1-0.39), flung up (0.39), the hover until the finger
 *  comes down on the strike; the second fan (1.7-2.05), flung (2.05), the second strike. */
const KNIFE_TAKE = { fan1: [.08, .3], throw1: .39, fan2: [1.66, 1.92], throw2: 2.05 } as const;
const HOVER = { up: 2.35, radius: 1.35, count: 16, fly: .2, fall: .085, stand: .7 } as const;
const knives: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, mesh = fx.knifeMesh(); if (!mesh) return;
  const s1 = c.strikes[0] ?? c.cast + 1.1, s2 = c.strikes[1] ?? c.cast + 2.43, floor = c.at.y;
  // The fans in his hands while the take plays: four knives in each hand's spread fingers (the second fan, the right only).
  if (f && take !== undefined) {
    const fan = (t0: number, t1: number, thrown: number, sides: readonly string[]) => {
      if (take < t0 || take > thrown) return;
      const k = smooth(t0, t1, take);
      for (const side of sides) {
        // The blades point on from the forearm through the hand (the fingers they are held between), fanned across it.
        if (!joint(f, `${side}Hand`, _a) || !joint(f, `${side}ForeArm`, _b)) continue;
        _c.subVectors(_a, _b); if (_c.lengthSq() < 1e-6) continue; _c.normalize();
        const across = _e.copy(Math.abs(_c.y) < .85 ? UP : _d.set(Math.cos(f.group.rotation.y), 0, -Math.sin(f.group.rotation.y))).addScaledVector(_c, -(Math.abs(_c.y) < .85 ? UP : _d).dot(_c)).normalize();
        for (let i = 0; i < 4; i++) {
          const spread = (i - 1.5) * .3 * k;
          _f.copy(_c).multiplyScalar(Math.cos(spread)).addScaledVector(across, Math.sin(spread)).normalize();
          fx.knife(_g.copy(_a).addScaledVector(_c, .07).addScaledVector(across, (i - 1.5) * .025), _f, .85 * k);
        }
        if (take > t1 - .05 && take < t1 + .1) st.glow(_a, .25, GILT.core, .7, STAR, .2, side === 'Right' ? 1 : 2);
      }
    };
    fan(KNIFE_TAKE.fan1[0], KNIFE_TAKE.fan1[1], KNIFE_TAKE.throw1, ['Right', 'Left']);
    fan(KNIFE_TAKE.fan2[0], KNIFE_TAKE.fan2[1], KNIFE_TAKE.throw2, ['Right']);
  }
  // Each volley: flung up from his hands into a ring over the circle, hung there still, then dropped on the strike to stand
  // in the stone round the one inside.
  const volley = (thrown: number, strike: number, n: number, seed: number) => {
    const fallFrom = strike - HOVER.fall;
    if (time < thrown || time > strike + HOVER.stand) return;
    const src = f ? _a.copy(f.group.position).setY(f.group.position.y + 1.5) : _a.copy(c.at).setY(floor + 1.5);
    for (let i = 0; i < n; i++) {
      const az = (i / n) * TAU + seed, ring = HOVER.radius * (.35 + .65 * hash(i * 1.7 + seed)), lift = HOVER.up + .45 * hash(i * 2.3 + seed);
      const hover = _b.set(c.at.x + Math.cos(az) * ring, floor + lift, c.at.z + Math.sin(az) * ring);
      // Where it stands in the stone: closer in, leaning out.
      const land = _c.set(c.at.x + Math.cos(az) * ring * .55, floor + .1, c.at.z + Math.sin(az) * ring * .55);
      const down = _d.set(c.at.x - hover.x, -lift, c.at.z - hover.z).normalize();
      if (time < thrown + HOVER.fly) {
        const u = (time - thrown) / HOVER.fly, e = 1 - (1 - u) * (1 - u);
        _e.copy(src).lerp(hover, e); _e.y += Math.sin(Math.PI * u) * 1.2;
        _f.subVectors(hover, src).normalize().lerp(down, e).normalize();
        fx.knife(_e, _f, 1);
      } else if (time < fallFrom) {
        // Hung: still, a glint running round them.
        fx.knife(hover, down, 1);
        if (((Math.floor(time * 9) + i) % 7) === 0) st.glow(_e.copy(hover).addScaledVector(down, .2), .22, GILT.core, .7, STAR, .2, i + seed);
      } else if (time < strike) {
        const u = (time - fallFrom) / HOVER.fall;
        _e.copy(hover).lerp(land, u * u);
        fx.knife(_e, _f.subVectors(land, hover).normalize(), 1);
        st.streak(hover, _e, .02, GILT.main, .9 * u);
      } else {
        const sink = clamp((time - strike) / HOVER.stand), shrink = 1 - smooth(.7, 1, sink);
        fx.knife(_e.copy(land).addScaledVector(down, .1 * sink), _f.subVectors(land, hover).normalize(), shrink);
      }
    }
    if (time >= strike && !fx.fired(c, seed > 1 ? 2 : 1)) {
      st.burst(_g.copy(c.at).setY(floor + .6), GILT, 1.7, strike, { floor });
      st.shock(_g.copy(c.at), GILT, 3.6, strike, .5);
    }
    if (time >= strike && time < strike + .25) st.light(_g.copy(c.at).setY(floor + .8), 5, GILT, 1 - (time - strike) / .25);
  };
  volley(c.cast + KNIFE_TAKE.throw1, s1, HOVER.count, .3);
  volley(c.cast + KNIFE_TAKE.throw2, s2, 10, 2.1);
};


// ------------------------------------------------------------------------------------------------------------- Murex
/** Murex's core: violet-white neon (his A.T. frames' colours). */
const CORE: StageLook = stageLook(0xf2e6ff, 0x8a42d6, 0x24083e);
const FLARES = [1.18, 1.62, 2.0, 2.38].map(s => s + LAG);
/** The core charges in his laid-on palms while he aims (0.38 on), and each flare leaves them on its strike: a beam to the
 *  circle, a flash on the hands. */
const flare: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, target = chestOf(c, _b);
  const hands = !!f && take !== undefined && joint(f, 'LeftHand', _g) && joint(f, 'RightHand', _h);
  if (hands) {
    _a.copy(_g).lerp(_h, .35);
    const k = smooth(.3, 1.0, take!) * (1 - smooth(2.45, 2.6, take!));
    st.charge(_a, CORE, .2, k, 4);
  }
  for (let i = 0; i < FLARES.length; i++) {
    const at = c.strikes[i] ?? c.cast + FLARES[i], age = time - at + .04;
    if (age < 0 || age > .2) continue;
    if (hands) _a.copy(_g).lerp(_h, .35); else if (f) _a.copy(f.group.position).setY(f.group.position.y + .9); else continue;
    const last = i === FLARES.length - 1 ? 1.4 : 1;
    st.beam(_a, target, .11 * last, CORE, age / .2, 3 + i, 1);
    st.glow(_a, .45 * last, CORE.core, 1.2 * (1 - age / .2), STAR, .2, i);
  }
};

// -------------------------------------------------------------------------------------------------------------- Nigo
/** Nigo's brand: an ember orange burning down to ash black. */
const BRAND: StageLook = stageLook(0xffe2b8, 0xe2702a, 0x1a0a04, { flame: BLOOD });
/** The cleaver held over his shoulder burns (0.5-1.08); the second cut throws the cross: two strokes crossing, flown from his
 *  hand to the circle and landing on the strike. */
const brand: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.15, target = chestOf(c, _b);
  const hand = !!f && take !== undefined && joint(f, 'RightHand', _g);
  if (hand) {
    const k = smooth(.5, .95, take!) * (1 - smooth(1.05, 1.12, take!));
    st.charge(_g, BRAND, .22, k, 6);
    for (let i = 0; i < 3 && k > .05; i++) st.tongue(_e.copy(_g).addScaledVector(UP, .05 * i), UP, .1 * k, .3 * k, BRAND, .8, 70 + i);
  }
  const fly = (time - (strike - .1)) / .1;
  if (fly >= 0 && fly < 1.6 && f) {
    if (hand) _a.copy(_g); else _a.copy(f.group.position).setY(f.group.position.y + 1.2);
    const u = Math.min(1, fly), at = _d.copy(_a).lerp(target, u), size = .5 + 1.1 * u, k = fly < 1 ? 1 : 1 - (fly - 1) / .6;
    _c.subVectors(target, _a).normalize();
    const side = _e.crossVectors(_c, UP).normalize();
    for (const sgn of [1, -1]) {
      _f.copy(at).addScaledVector(side, size * sgn).addScaledVector(UP, size);
      _h.copy(at).addScaledVector(side, -size * sgn).addScaledVector(UP, -size);
      st.streak(_f, _h, .09 * k, BRAND.main, 1.6 * k); st.streak(_f, _h, .03 * k, BRAND.core, 1.4 * k);
    }
    st.light(at, 4, BRAND, .6 * k);
  }
};

// --------------------------------------------------------------------------------------------------------- Shirokane
/** Shirokane's ash: pale grey-blue dust. */
const ASH: StageLook = { ...stageLook(0xf4f8fa, 0x88b9ca, 0x2a3a42), core: lin(2.4, 2.5, 2.55) };
/** Ash gathers in his hands through the seals; thrown up over his head it climbs into the sky (1.0-1.12), and falls on the
 *  strike as the look's fall lands. */
const dust: Draw = (fx, c, f, time, take) => {
  const st = fx.stage;
  const hands = !!f && take !== undefined && joint(f, 'LeftHand', _g) && joint(f, 'RightHand', _h);
  if (hands) {
    _a.copy(_g).lerp(_h, .5);
    st.charge(_a, ASH, .16, smooth(.3, .95, take!) * (1 - smooth(1.0, 1.1, take!)), 8);
    const up = smooth(1.0, 1.08, take!) * (1 - smooth(1.18, 1.4, take!));
    if (up > .02) { _e.copy(_a).setY(_a.y + 6); st.streak(_a, _e, .08 * up, ASH.main, 1.3 * up); st.glow(_a, .4, ASH.core, .8 * up, STAR, .2, 3); }
  }
  const strike = c.strikes[0] ?? c.cast + 1.15;
  if (time >= strike && !fx.fired(c, 0)) st.burst(_b.copy(c.at).setY(c.at.y + .5), ASH, 1.5, strike, { floor: c.at.y });
};

// ----------------------------------------------------------------------------------------------------------- Oyashio
/** Oyashio's current: sea blue, a white crest, the deep. */
const CURRENT: StageLook = stageLook(0xe8fbff, 0x42c4df, 0x062a3a);
/** The current gathers round his gripping hands through the haul (0.6-1.15); thrown over his shoulder on the strike, it arcs
 *  from his hands up and over onto the circle, and bursts there. */
const current: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.2, target = chestOf(c, _b);
  const hands = !!f && take !== undefined && joint(f, 'RightHand', _g) && joint(f, 'LeftHand', _h);
  if (hands) { _a.copy(_g).lerp(_h, .5); st.charge(_a, CURRENT, .24, smooth(.55, 1.05, take!) * (1 - smooth(1.18, 1.26, take!)), 12); }
  const fly = (time - (strike - .12)) / .12;
  if (fly >= 0 && fly < 1.5 && f) {
    if (hands) _a.copy(_g).lerp(_h, .5); else _a.copy(f.group.position).setY(f.group.position.y + 1.6);
    const k = fly < 1 ? 1 : 1 - (fly - 1) / .5, u = Math.min(1, fly);
    for (let i = 0; i < 10; i++) {
      const s0 = i / 10 * u, s1 = (i + 1) / 10 * u;
      _e.copy(_a).lerp(target, s0); _e.y += Math.sin(Math.PI * s0) * 2.2;
      _f.copy(_a).lerp(target, s1); _f.y += Math.sin(Math.PI * s1) * 2.2;
      st.streak(_e, _f, .14 * k, CURRENT.main, 1.4 * k); st.streak(_e, _f, .05 * k, CURRENT.core, 1.2 * k);
    }
  }
  if (time >= strike && !fx.fired(c, 0)) st.burst(target, CURRENT, 1.8, strike, { floor: c.at.y });
};

// ------------------------------------------------------------------------------------------------------------ Yodaka
/** Yodaka's watch-fire: white-gold heart, flame orange, ember red. */
const WATCH: StageLook = { ...stageLook(0xfff0c0, 0xf36c27, 0x5a1004, { flame: BLOOD }), flame: 0 };
/** The flame gathers on the hand that holds the blade low behind him through the long telegraph (0.72-2.5); the rising cut
 *  throws an arc of fire up through the circle on the strike. */
const watch: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 2.59, target = chestOf(c, _b);
  const hand = !!f && take !== undefined && joint(f, 'RightHand', _g);
  if (hand) {
    const k = smooth(.6, 2.3, take!) * (1 - smooth(2.55, 2.7, take!));
    st.charge(_g, WATCH, .2 + .12 * k, k, 14);
    for (let i = 0; i < 4 && k > .05; i++) st.tongue(_e.copy(_g).addScaledVector(UP, .06 * i), UP, .12 * k, .4 * k, WATCH, .85, 80 + i);
  }
  const age = time - strike + .06;
  if (age >= 0 && age < .45 && f) {
    if (hand) _a.copy(_g); else _a.copy(f.group.position).setY(f.group.position.y + .6);
    const k = 1 - age / .45;
    for (let i = 0; i < 12; i++) {
      const s0 = i / 12, s1 = (i + 1) / 12;
      _e.copy(_a).lerp(target, s0); _e.y += s0 * 1.8 - .6 * (1 - s0);
      _f.copy(_a).lerp(target, s1); _f.y += s1 * 1.8 - .6 * (1 - s1);
      st.streak(_e, _f, .16 * k, WATCH.main, 1.5 * k); st.tongue(_e, UP, .12 * k, .38 * k, WATCH, .9 * k, 90 + i);
    }
  }
};

// ------------------------------------------------------------------------------------------------------------ Mikage
/** Mikage's flash: violet lightning with a white heart. */
const FLASH: StageLook = { ...stageLook(0xf6eeff, 0xa663ee, 0x220a40), heart: .5 };
/** Lightning crawls over the raised claw through the stalk (0.3-0.95); the swipe on the strike rakes three marks of it
 *  through the circle. */
const claw: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.0, target = chestOf(c, _b);
  const hand = !!f && take !== undefined && joint(f, 'RightHand', _g);
  if (hand) st.charge(_g, FLASH, .16, smooth(.25, .9, take!) * (1 - smooth(.98, 1.05, take!)), 16);
  const age = time - strike + .03;
  if (age >= 0 && age < .35) {
    const k = 1 - age / .35, side = _c.set(1, 0, 0);
    if (f) { _d.subVectors(target, f.group.position).setY(0).normalize(); side.crossVectors(_d, UP).normalize(); }
    for (let i = -1; i <= 1; i++) {
      _e.copy(target).addScaledVector(side, i * .28 - .5).setY(target.y + .9);
      _f.copy(target).addScaledVector(side, i * .28 + .5).setY(target.y - .7);
      st.streak(_e, _f, .07 * k, FLASH.main, 1.6 * k, .5); st.streak(_e, _f, .025 * k, FLASH.core, 1.4 * k);
    }
  }
};

// ------------------------------------------------------------------------------------------------------------ Psyche
/** Psyche's bloom: blossom pink, a white heart. */
const BLOOM: StageLook = stageLook(0xfff0f6, 0xd58db8, 0x3a1028);
/** A bloom of light over her crossed hands while the hands grow in the circle (0.38-1.18); on the strike, as her fingers
 *  close, it flares. */
const bloom: Draw = (fx, c, f, time, take) => {
  const st = fx.stage;
  const hands = !!f && take !== undefined && joint(f, 'RightHand', _g) && joint(f, 'LeftHand', _h);
  if (hands) {
    _a.copy(_g).lerp(_h, .5);
    st.charge(_a, BLOOM, .18, smooth(.3, .9, take!) * (1 - smooth(1.25, 1.5, take!)), 18);
    const flare = 1 - Math.min(1, Math.abs(take! - 1.2) / .1);
    if (flare > 0) st.glow(_a, .6, BLOOM.core, flare, STAR, .25, 7);
  }
};

// ---------------------------------------------------------------------------------------------------------- Shanxiao
/** Shanxiao's peak: lime-white heart, his green, the deep. */
const PEAK: StageLook = stageLook(0xf2ffd0, 0x91d844, 0x10300a);
/** The mass he gathers over his head grows between his raised hands (0.38-1.18), and is hurled down onto the circle on the
 *  strike. */
const peak: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.25, target = chestOf(c, _b);
  const hands = !!f && take !== undefined && joint(f, 'RightHand', _g) && joint(f, 'LeftHand', _h);
  let k = 0;
  if (hands) {
    _a.copy(_g).lerp(_h, .5); _a.y += .35;
    k = smooth(.3, 1.1, take!) * (1 - smooth(1.12, 1.18, take!));
    if (k > .01) { st.orb(_a, UP, .25 + .55 * k, PEAK, 20); st.light(_a, 4 + 3 * k, PEAK, .6 * k); }
  }
  const fly = (time - (strike - .12)) / .12;
  if (fly >= 0 && fly < 1 && f) {
    if (hands) { _a.copy(_g).lerp(_h, .5); _a.y += .35; } else _a.copy(f.group.position).setY(f.group.position.y + 2.4);
    _c.subVectors(target, _a).normalize();
    st.orb(_e.copy(_a).lerp(target, fly), _c, .75, PEAK, 21);
  }
  if (time >= strike && !fx.fired(c, 0)) st.burst(target, PEAK, 2.0, strike, { floor: c.at.y });
};

// ----------------------------------------------------------------------------------------------------------- Shijima
/** Shijima's blue pyre: white-blue heart, ice blue, the deep. */
const PYRE_BLUE: StageLook = { ...stageLook(0xf0faff, 0x5aa8ff, 0x061a3a, { flame: BLOOD }), flame: -1 };
/** Blue fire gathers in her set palm through the hymn (0.38-1.05) and leaves it on the strike: a beam to the circle. */
const hymn: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.1, target = chestOf(c, _b);
  const palm = !!f && take !== undefined && joint(f, 'LeftHand', _g);
  if (palm) st.charge(_g, PYRE_BLUE, .2, smooth(.3, 1.0, take!) * (1 - smooth(1.08, 1.14, take!)), 22);
  const age = time - strike + .05;
  if (age >= 0 && age < .25 && f) {
    if (palm) _a.copy(_g); else _a.copy(f.group.position).setY(f.group.position.y + 1.2);
    st.beam(_a, target, .16, PYRE_BLUE, age / .25, 23, 1);
  }
};

// ----------------------------------------------------------------------------------------------------------- Suzuran
/** Suzuran's soft palm: lilac with a white heart. */
const LILAC: StageLook = stageLook(0xfaf2ff, 0xdca4f4, 0x2c1438);
/** A soft light on both palms through the flurry (0.5-1.1), a flash on each palm as it lands, and a ring off both palms
 *  driven out together on the strike. */
const PALM_BEATS = [.56, .635, .705, .77, .83, .885, .935];
const lilac: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.1;
  const hands = !!f && take !== undefined && joint(f, 'RightHand', _g) && joint(f, 'LeftHand', _h);
  if (!hands) return;
  const t = take!, k = smooth(.4, .6, t) * (1 - smooth(1.3, 1.5, t));
  st.glow(_g, .2, LILAC.main, .5 * k); st.glow(_h, .2, LILAC.main, .5 * k);
  PALM_BEATS.forEach((b, i) => { const a = 1 - Math.abs(t - b) / .05; if (a > 0) st.glow(i % 2 ? _h : _g, .38, LILAC.core, a, STAR, .2, i); });
  const age = time - strike + .02;
  if (age >= 0 && age < .3) { _a.copy(_g).lerp(_h, .5); st.glow(_a, .5 + 1.6 * age / .3, LILAC.core, 1 - age / .3, RING, .05, 3, .85); }
};

// ------------------------------------------------------------------------------------------------------------ Tobari
/** Tobari's ember: a white-gold heart, his crimson, soot. */
const EMBER: StageLook = { ...stageLook(0xfff0c8, 0xd42a3c, 0x1c0406), flame: 0 };
/** The breath: from 0.8, fire poured from his mouth through the ring of his fingers at the circle, feeding the fireball the
 *  look swells there until the strike (1.25), tapering after. */
const ember: Draw = (fx, c, f, time, take) => {
  const st = fx.stage;
  if (!f || take === undefined || !joint(f, 'Head', _g)) return;
  const k = smooth(.78, .86, take) * (1 - smooth(1.32, 1.55, take));
  if (k < .02) return;
  const target = chestOf(c, _b);
  _c.subVectors(target, _g); const span = _c.length(); _c.divideScalar(span);
  _a.copy(_g).addScaledVector(_c, .25); _a.y -= .08;
  st.column(_a, _c, .22 + .25 * k, span * Math.min(1, smooth(.78, .95, take) * 1.05), EMBER, k, 31);
};

// ----------------------------------------------------------------------------------------------------------- Torsion
/** Torsion's grip: psychic green with a white heart. */
const GRIP: StageLook = stageLook(0xeefff6, 0x65edb0, 0x0a3020);
/** A psychic glow round the raised hand (0.38 on), flaring as each twist lands. */
const grip: Draw = (fx, c, f, time, take) => {
  const st = fx.stage;
  if (!f || take === undefined || !joint(f, 'RightHand', _g)) return;
  const t = take;
  st.charge(_g, GRIP, .18, smooth(.3, .6, t) * (1 - smooth(2.15, 2.35, t)), 33);
  for (const s of [1.2, 1.97]) { const a = 1 - Math.abs(t - s) / .08; if (a > 0) { st.glow(_g, .55, GRIP.core, a, STAR, .25, 4); st.glow(_g, .9, GRIP.main, .6 * a, RING, .05, 5, .85); } }
};

// ----------------------------------------------------------------------------------------------------------- Wataame
/** What he tosses: a little black bomb, its fuse spitting (a dark ball with a hot rim, and the spark). */
const FUSE: StageLook = stageLook(0xfff2c8, 0xff9a3a, 0x3a1004);
const BOMB: StageLook = { ...FUSE, dark: true, sphere: { body: lin(.02, .02, .025), core: lin(.06, .06, .07), rimA: lin(.8, .5, .3), rimB: lin(.3, .2, .12), spin: .4 } };
/** Tossed underhand from his hand on the release (0.38), it lands in the circle and lies there spitting until the strike. */
const bomb: Draw = (fx, c, f, time, take) => {
  const st = fx.stage, strike = c.strikes[0] ?? c.cast + 1.1, toss = c.cast + .4;
  if (time < toss || time >= strike) return;
  const land = _b.copy(c.at).setY(c.at.y + .14);
  let at: THREE.Vector3;
  const u = (time - toss) / .3;
  if (u < 1 && f) {
    if (take !== undefined && joint(f, 'LeftHand', _g)) _a.copy(_g); else _a.copy(f.group.position).setY(f.group.position.y + 1);
    at = _e.copy(_a).lerp(land, u); at.y += Math.sin(Math.PI * u) * 1.1;
  } else at = land;
  st.ball(at, .13, BOMB, 41);
  _f.copy(at).setY(at.y + .16);
  st.glow(_f, .14 + .06 * Math.sin(time * 60), FUSE.core, .9, STAR, .2, Math.floor(time * 30));
  st.light(_f, 1.6, FUSE, .3);
};

// ------------------------------------------------------------------------------------------------------------ Wuming
/** Wuming's lotus: rose pink with a white heart. */
const LOTUS: StageLook = stageLook(0xfff0fa, 0xff5fcf, 0x3a0a2c);
/** A lotus of light opens in his upturned palm (0.38-1.1): a heart and eight petals turning round it; pressed down on the
 *  strike, it flares. */
const lotus: Draw = (fx, c, f, time, take) => {
  const st = fx.stage;
  if (!f || take === undefined || !joint(f, 'RightHand', _g)) return;
  const t = take, k = smooth(.3, .7, t) * (1 - smooth(1.18, 1.26, t));
  _a.copy(_g); _a.y += .12;
  if (k > .02) {
    st.glow(_a, .25, LOTUS.core, .9 * k); st.glow(_a, .5, LOTUS.main, .5 * k);
    for (let i = 0; i < 8; i++) { const az = i * TAU / 8 + t * 1.2; _e.set(_a.x + Math.cos(az) * .2 * k, _a.y + .04, _a.z + Math.sin(az) * .2 * k); st.glow(_e, .1, LOTUS.main, .8 * k); }
  }
  const a = 1 - Math.abs(t - 1.2) / .08;
  if (a > 0) st.glow(_g, .7, LOTUS.core, a, STAR, .25, 6);
};

// -------------------------------------------------------------------------------------------------------------- Rook
/** Rook's shadow: violet-black. */
const SHADE: StageLook = { ...stageLook(0xd8c8ff, 0x7a4dff, 0x08041a), dark: true, sphere: { body: lin(.01, .006, .03), core: lin(.2, .1, .5), rimA: lin(1.6, .9, 3.0), rimB: lin(.7, .35, 1.8), spin: 1.2 } };
/** Shadow pools under the hand he drives at the ground (0.38-1.1) and climbs after it as he draws it up into a fist. */
const shade: Draw = (fx, c, f, time, take) => {
  const st = fx.stage;
  if (!f || take === undefined || !joint(f, 'RightHand', _g)) return;
  const t = take, k = smooth(.35, .6, t) * (1 - smooth(1.1, 1.3, t));
  if (k > .02) st.pool(_a.copy(_g).setY(f.group.position.y), 1.4, SHADE, k, 51, .8);
  st.charge(_g, SHADE, .16, smooth(.35, 1.0, t) * (1 - smooth(1.2, 1.45, t)), 52);
};

// ------------------------------------------------------------------------------------------------------------------
/** Each authored fighter's drawing, one line each. */
const DRAWS: Partial<Record<FighterId, Draw>> = {
  'madake': stag,
  magatsu: pyre,
  oro: knives,
  murex: flare,
  nigo: brand,
  shirokane: dust,
  oyashio: current,
  yodaka: watch,
  mikage: claw,
  'psyche': bloom,
  shanxiao: peak,
  shijima: hymn,
  suzuran: lilac,
  tobari: ember,
  torsion: grip,
  wataame: bomb,
  'wuming': lotus,
  'rook': shade,
};
const DRAWN: ReadonlySet<FighterId> = new Set(Object.keys(DRAWS) as FighterId[]);

/** A dagger, tip along +y: a flat blade, a guard, a grip; vertex colours (the edge glints over the bloom threshold). */
function knifeGeometry() {
  const g = new THREE.BufferGeometry();
  const P: number[] = [], C: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number[], cb: number[]) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); C.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb); };
  const tri = (a: number[], b: number[], c: number[], col: number[]) => { P.push(...a, ...b, ...c); C.push(...col, ...col, ...col); };
  const edge = [2.4, 2.0, 1.2], gilt = [1.25, .82, .2], dark = [.32, .18, .05];
  // Blade (diamond section): tip at y .36, base at y .06, half-width .028, a ridge down the middle.
  for (const s of [1, -1]) {
    tri([0, .36, 0], [.028, .08, 0], [0, .08, .008 * s], s > 0 ? edge : gilt);
    tri([0, .36, 0], [0, .08, .008 * s], [-.028, .08, 0], s > 0 ? gilt : edge);
  }
  quad([-.028, .08, 0], [.028, .08, 0], [.028, .055, 0], [-.028, .055, 0], gilt, gilt);
  // Guard and grip.
  quad([-.05, .06, 0], [.05, .06, 0], [.05, .045, 0], [-.05, .045, 0], gilt, gilt);
  quad([-.012, .045, 0], [.012, .045, 0], [.012, -.06, 0], [-.012, -.06, 0], dark, dark);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

export class AreaCastFx {
  readonly stage: MoveStage;
  private knives?: THREE.InstancedMesh;
  private knifeCount = 0;
  private readonly firedKeys = new Map<Cast, number>();
  constructor(private readonly scene: THREE.Scene, readonly kit: VfxKit) { this.stage = MoveStage.for(scene, kit); }
  /** A room's fighters: Lord ORO's knives are built now, drawn at nothing, so the first cast builds nothing. */
  load(ids: readonly FighterId[]) { if (ids.includes('oro') && !this.knives) this.knifeMesh(true); }
  /** The knives' mesh (built on demand when `build`). */
  knifeMesh(build = false) {
    if (!this.knives && build) {
      const mesh = new THREE.InstancedMesh(knifeGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }), 48);
      mesh.name = 'area-cast-knives'; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setMatrixAt(0, _m.makeScale(0, 0, 0)); mesh.count = 1; mesh.renderOrder = 3;
      this.scene.add(mesh); this.knives = mesh;
    }
    return this.knives;
  }
  /** One knife this frame at `at`, its tip along `dir`, at `scale`. */
  knife(at: THREE.Vector3, dir: THREE.Vector3, scale: number) {
    const mesh = this.knives; if (!mesh || this.knifeCount >= mesh.instanceMatrix.count || scale <= .01) return;
    _q.setFromUnitVectors(UP, dir); _s.setScalar(scale * 1.5);
    mesh.setMatrixAt(this.knifeCount++, _m.compose(at, _q, _s));
  }
  /** Whether a one-shot of a cast was laid already (a burst is laid once). */
  fired(c: Cast, bit: number) { const mask = this.firedKeys.get(c) ?? 0; if (mask & (1 << bit)) return true; this.firedKeys.set(c, mask | (1 << bit)); return false; }

  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    this.knifeCount = 0;
    if (CASTS.length) {
      this.stage.open(time);
      for (let i = CASTS.length - 1; i >= 0; i--) {
        const c = CASTS[i];
        if (time > c.until || time < c.cast - 1) { CASTS.splice(i, 1); this.firedKeys.delete(c); continue; }
        const f = fighters.get(c.actorId);
        DRAWS[c.fighter]?.(this, c, f, time, takeTime(f, c.fighter));
      }
      this.stage.close();
    }
    const mesh = this.knives;
    if (mesh) {
      if (this.knifeCount === 0) { mesh.setMatrixAt(0, _m.makeScale(0, 0, 0)); this.knifeCount = 1; }
      mesh.count = this.knifeCount; mesh.instanceMatrix.needsUpdate = true;
    }
  }
  reset() { CASTS.length = 0; this.firedKeys.clear(); }
  dispose() {
    this.reset();
    if (this.knives) { this.knives.removeFromParent(); this.knives.geometry.dispose(); (this.knives.material as THREE.Material).dispose(); this.knives = undefined; }
  }
}
