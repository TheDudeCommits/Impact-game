import * as THREE from 'three';
import { onLiquid, type LiquidFloor } from '../../game/footing';
import { SparkField, SPRITE, ORIENT, ANCHORS } from './SparkField';
import { GroundMarks, MARK } from './GroundMarks';
import { Debris } from './Debris';
import { LightPool } from './LightPool';
import { Afterimages } from './Afterimages';
import { Beams } from './Beams';
import { VEIL } from './VictimVeil';
import type { Element } from './palette';
import type { Fighter } from '../Fighter';
import { inkImpactsReady } from './SparkField';
import { INK_IMPACTS } from './inkImpactAtlas';
import { roanEnabled } from '../look/roanPass';
import { DREAM_IMPACT } from '../dreamFlag';

/** How loud an impact is. Light jabs are small and snappy; heavies are big;
 *  finishers and specials are huge; ultimates and KOs take the screen. */
export type ImpactClass = 0 | 1 | 2 | 3;
/** The hit spark's radius, its white heart and its life, per class. The
 *  burst stays under about 0.6 of a body's height and the heart no bigger
 *  than a head: it used to be up to 3.7 m across and hid the fighter it hit. */
const BURST = [.3, .38, .46, .56], CORE = [.2, .24, .28, .34], LIFE = [.2, .23, .26, .3], STREAKS = [5, 8, 11, 15];
/** The colour pass: the hand-drawn burst (vfx/inkImpactAtlas.ts) replaces the procedural one once its
 *  flipbooks have loaded - opaque, ragged and big: about 1.6x the old burst on a light blow and 2.5-2.9x from a
 *  heavy up (a heavy starburst as wide as the body it hits), played over INK_LIFE. A blade's blow
 *  draws the slash, energy the blast. */
const INK_SIZE = [.5, .95, 1.25, 1.6], INK_LIFE = [.22, .28, .32, .38], BLAST_SIZE = [.6, 1, 1.4, 1.8];
export type InkLook = 'burst' | 'slash' | 'blast';
/** The dream loop: which finishing blow a hit is, when it is one (a combo ender's kind) - each drawn its
 *  own way: a launch rises, a slam goes into the floor, a finish blows the body away. */
export type HitTier = 'launch' | 'slam' | 'finish';
/** Point-light candela and reach per class, lit from a metre over the blow:
 *  a light at the point of contact is inside a body, and the pool's exposure
 *  limit would all but put it out. */
const LIGHT = [3, 5, 8, 14], REACH = [3.5, 5, 7, 10];
/** Dust in three tones: sunlit cream, a warm middle and a cool violet shadow. */
export const DUST_LIT = 0xf6e9cf, DUST_SHADE = 0xa9a6bb;
/** The dream loop's dust column (groundImpact): earth in mid tones, lit and in shade - under the bloom's knee. */
export const DREAM_EARTH_LIT = 0xb7a58a, DREAM_EARTH_SHADE = 0x5d5466;
/** How far toward the lens a hit spark is drawn: just clear of the struck
 *  body's surface, and no further, so the fist, foot or blade that landed
 *  the blow - which is in front of that surface - is drawn over it. */
const SPARK_BIAS = .05;

const SZ = {
  star: [.62, .76, 1.5, 1.9], life: [.15, .16, .17, .19],
  /** The least a burst takes of the frame, whatever the camera's distance: a share of that distance (the sprite's
   *  radius), so a finisher seen from a far lens still owns the middle of the screen. */
  // (Round 25: a jab keeps a floor too - an air string's sparks at a chase's distance were 25 px.)
  screen: [.04, .05, .17, .21],
  bolts: [3, 3, 4, 5], boltLen: [1.1, 1.5, 2, 2.6], boltW: [.011, .013, .016, .019],
  embers: [8, 10, 14, 18], crescents: [0, 1, 1, 2], arc: [0, 1.05, 1.45, 1.95], near: .42,
  /** Round 31: a heavy blow's big shapes - its stars, the impact frame's, the bloom, the flames, the dome - drawn
   *  this far behind the contact instead (metres from the lens): the biggest bursts go off behind the
   *  thrower and round the body, both drawn over them (the blind critics, every heavy blow: "a single flat starburst
   *  drawn over both bodies for two or three frames - the contact, the limb and the victim's reaction hidden").
   *  The heart, the bolts and the sparks stay in front. Behind the bodies the stars show less of themselves, so they are
   *  drawn `grow` times as big: they go off bigger than both fighters and are read round them. */
  behind: -.3, grow: 1.1,
} as const;
/** Round 67: a light blow's line of light (VfxKit.szImpact) - its length and half-width (m) and life (s) - and the round
 *  embers left drifting with it: how many and how big (m). */
const SZ_JAB_LINE = { length: 1.5, width: .022, life: .1, embers: 2, ember: .09 } as const;
const DIAL = { screen: false, bloom: false, rings: false, arcs: false, glitter: false, dome: false, flame2: false, echo: false } as const;
/** Round 59: the drift every blow leaves hanging round it (VfxKit.szImpact) - how many specks per class, how fast they
 *  are thrown (m/s), how long they hang (s), their size (m) and colours: embers, a pale gold, pink-white confetti. */
// (Round 70: gone in about a third of a second where it was half - a blind critic: "ghosts, dust puffs, ember shards"
// carried "into the pre-contact frames ... so anticipation and contact lose contrast".)
const SZ_DRIFT = { count: [8, 10, 12, 16], speed: 2.4, life: .24, size: .11, colours: [0xffa83a, 0xffe08a, 0xffd0e4, 0xff7a2a, 0xffffff] } as const;
/** Round 57: a thrown body's aftermath (VfxKit.szImpact) - how many glitter specks (a big blow, a knockout), their size
 *  (m) and the span they are born over after the blow (s); the wind sheets' radii (m), life (s), cover and light. */
const SZ_AFTER = { glitter: [60, 90], speck: .085, span: .2, sheet: [1.1, 1.5, 1.3], sheetLife: .26, sheetCover: .16, sheetLight: .28 } as const;
/** Round 56: a big blow's bloom (VfxKit.szImpact): how much earlier than the blow it is born and how long it lasts (s),
 *  its size (of the blow's star), the least share of the camera's distance it takes (SpriteSpec.trail), its colour and
 *  how much light it adds. */
const SZ_BLOOM = { early: .015, life: .14, size: 1.5, share: .5, hot: 0xff6a36, light: .7 } as const;
/** Round 54: a launcher's and a finisher's sweeping arcs (VfxKit.szImpact) - when the first is born after the blow, how
 *  far apart the next ones are and how long each lasts (s); their radii (metres) and the least share of the camera's
 *  distance each takes (SpriteSpec.trail). */
const SZ_ARCS = { at: .05, step: .035, life: .34, radius: [2, 2.5, 3], share: [.42, .5, .58] } as const;
/** Round 27b: a launcher's, a slam's and a finisher's impact frame - one banded star thrown across the screen for its
 *  first six frames, `share` of the camera's distance at the least (past the cap the other stars keep: SparkField),
 *  `size` times the blow's star, its heart opening at once (a heavy's) so the victim reads through it under the veil.
 *  The blind critics, every round: a finisher should flood the frame; ours was a third of it. */
/** The impact frame's star (round 27b): its size against the blow's, its life (s) and the least share of the frame it
 *  takes (its radius over its distance). Round 49: up to SZ_SCREEN.big of the frame - off every edge of it - once in
 *  SZ_SCREEN.gap seconds (the impact frame's own photosensitivity limit, GameRenderer.impactFrame), a
 *  heavy burst bleeds off every frame edge on the contact frame where ours "stays inside the frame at about 60 percent
 *  of its width" (the blind critics on 67 ms close-ups). */
const SZ_SCREEN = { size: 1.6, life: .11, share: .42, big: .75, gap: .4 } as const;
/** Every physical blow is painted in one warm palette whoever throws it - white, yellow, orange, a red
 *  edge - and a blade's in white steel; a fighter's own colour belongs to the techniques (energy keeps its element). */
const SZ_WARM: Element = { spike: 0xffe25a, rim: 0xff6f12, light: 0xffc873, ink: 0x2a0d05 };
const SZ_STEEL: Element = { spike: 0xf4fbff, rim: 0x5fb4ff, light: 0xcfe9ff, ink: 0x0a1830 };
/** Off with `?dreamoff` in the address (the dream loop's before-and-after films): the hit spark as it was. */
export { DREAM_IMPACT };
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _litTone = new THREE.Color(), _shadeTone = new THREE.Color(), _white = new THREE.Color(1, 1, 1);
/** A random unit vector into `out`. */
function randomUnit(out: THREE.Vector3) {
  do out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); while (out.lengthSq() > 1 || out.lengthSq() < .01);
  return out.normalize();
}

interface Pulse { x: number; y: number; z: number; hex: number; peak: number; distance: number; born: number; life: number; priority: number }
interface Anchor { body: Fighter | null; from: THREE.Vector3; until: number }
/** The dream loop, round 38: a body a big blow has thrown, trailing sparks and speed lines while it flies (TRAIL). */
interface Trail { body: Fighter | null; steel: boolean; born: number; until: number; last: THREE.Vector3; seen: boolean }
/** Round 38: how long a thrown body trails (s), the speed under which it sheds nothing (m/s), the specks it sheds a frame
 *  (and their size, m), the share of frames that leave a glint (and its size), and its speed lines' longest length and
 *  width (m). A flung victim rides a dense sparkle cloud along trailing arcs (the
 *  blind critics on v70-v72, every big blow); ours flew clean out of its burst. */
const TRAIL = { life: .3, speed: 3, specks: 2, speck: .1, glints: .2, glint: .26, line: 1.4, lineW: .035 } as const;
const _tr = new THREE.Vector3(), _ts = new THREE.Vector3(), _tu = new THREE.Vector3();

const kits = new WeakMap<THREE.Scene, VfxKit>();
const liquids = new WeakMap<THREE.Scene, LiquidFloor | undefined>();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/** The drawn centre of a body: where its pelvis is on screen, which during a
 *  launch reaction can be a metre from its logical position. */
export function bodyCentre(body: Fighter, out: THREE.Vector3) {
  const drawn = body as unknown as { visualCenter?: (out: THREE.Vector3) => THREE.Vector3 };
  if (typeof drawn.visualCenter === 'function') return drawn.visualCenter(out);
  const hips = body.joints?.get('Hips');
  if (hips) return hips.getWorldPosition(out);
  return out.copy(body.group.position).setY(body.group.position.y + 1.05);
}

/** Every pool the impact language draws with, one set per scene.
 *
 *  CombatEffects, ClashEffects and AwakeningEffects are built separately and
 *  each speak the same language - a ground ring, a spray of
 *  rock - so they share one set of pools rather than each paying for its
 *  own draw calls. The first to ask for a scene's kit builds it; the last to
 *  let go of it disposes it. CombatEffects owns the clock: its `update` runs
 *  the kit's once a frame, and the fixed light pool is flushed there.
 */
export class VfxKit {
  /** The place's liquid floor (game/footing.ts) for `scene`'s kit, now or when it is built; set with the stage by
   *  GameRenderer, which holds no kit of its own. */
  static setLiquid(scene: THREE.Scene, liquid: LiquidFloor | undefined) {
    liquids.set(scene, liquid);
    const kit = kits.get(scene);
    if (kit) kit.liquid = liquid;
  }
  /** The look plan, stream B: whatever answers a splash besides its own spray - the ground's water
   *  (src/render/ground/splashes.ts), whose waves the same steps, dashes, landings, falls and blows push. Additive:
   *  a listener that throws is reported, and the spray and the other listeners go on. */
  static readonly splashed = new Set<(scene: THREE.Scene, x: number, z: number, size: number, dx: number, dz: number) => void>();
  static for(scene: THREE.Scene) {
    let kit = kits.get(scene);
    if (!kit) { kit = new VfxKit(scene); kits.set(scene, kit); }
    kit.refs++;
    return kit;
  }
  readonly sparks: SparkField;
  readonly dust: SparkField;
  readonly marks: GroundMarks;
  readonly debris: Debris;
  readonly lights: LightPool;
  readonly ghosts: Afterimages;
  readonly beams: Beams;
  /** settings.effects, 0.3..1, and the quality preset: what every count and
   *  every optional layer is scaled by. */
  density = 1;
  quality: 'high' | 'medium' | 'low' = 'high';
  /** The colour pass, iteration ten: the place's liquid floor (game/footing.ts), set with the stage. Where it
   *  is, what kicks up dust off the floor anywhere else splashes instead (`splash`). */
  liquid?: LiquidFloor;
  private refs = 0;
  private pulses: Pulse[] = Array.from({ length: 24 }, () => ({ x: 0, y: 0, z: 0, hex: 0, peak: 0, distance: 1, born: -1e9, life: 0, priority: 1 }));
  private pulseCursor = 0;
  private anchors: Anchor[] = Array.from({ length: ANCHORS }, () => ({ body: null, from: new THREE.Vector3(), until: -1e9 }));
  private anchorCursor = 0;
  /** The clock the kit was last run on (`update`'s `time`, the match clock its sprites are
   *  born on), for an effect that has no such clock of its own to hand - the ball's field draws from snapshots a replay
   *  rewinds (render/ball/BallField.ts). */
  now = 0;
  /** Round 49: when an impact frame's star last filled the frame (see SZ_SCREEN.big). */
  private screenAt = -1e9;
  private trails: Trail[] = Array.from({ length: 6 }, () => ({ body: null, steel: false, born: -1e9, until: -1e9, last: new THREE.Vector3(), seen: false }));
  private trailCursor = 0;
  private key?: THREE.DirectionalLight;
  private keySearch = 0;
  private constructor(private scene: THREE.Scene) {
    this.liquid = liquids.get(scene);
    this.dust = new SparkField(scene, 768, 'vfx-dust', 5, VEIL.dust);
    this.sparks = new SparkField(scene, 1536, 'vfx-sparks', 9, VEIL.sparks);
    this.marks = new GroundMarks(scene, 48);
    this.debris = new Debris(scene, 160);
    this.lights = new LightPool(scene, 4);
    this.ghosts = new Afterimages(scene, 5);
    this.beams = new Beams(scene);
  }

  get budget() { return Math.max(.3, Math.min(1, this.density)) * (this.quality === 'low' ? .5 : this.quality === 'medium' ? .8 : 1); }
  /** A count scaled by the budget, never below `floor`. */
  n(count: number, floor = 1) { return Math.max(floor, Math.round(count * this.budget)); }

  /** A light that flares and decays on its own: an impact, a landing. */
  pulse(x: number, y: number, z: number, hex: number, peak: number, distance: number, born: number, life: number, priority = 1) {
    const p = this.pulses[this.pulseCursor]; this.pulseCursor = (this.pulseCursor + 1) % this.pulses.length;
    p.x = x; p.y = y; p.z = z; p.hex = hex; p.peak = peak; p.distance = distance; p.born = born; p.life = life; p.priority = priority;
  }

  /** A slot for sprites that ride `body` for the next `hold` seconds: a hit
   *  spark, its ring and its streaks leave with a launched body rather than
   *  hanging where it was struck. Returns the anchor to put on the sprites. */
  anchorTo(body: Fighter | undefined, time: number, hold = .5) {
    if (!body) return 0;
    this.anchorCursor = this.anchorCursor % (ANCHORS - 1) + 1;
    const a = this.anchors[this.anchorCursor];
    a.body = body; a.until = time + hold; bodyCentre(body, a.from);
    this.sparks.setAnchor(this.anchorCursor, 0, 0, 0); this.dust.setAnchor(this.anchorCursor, 0, 0, 0);
    return this.anchorCursor;
  }

  /** Round 38 (the dream switch only): `body`, just thrown by a big blow, trails sparks and speed lines for TRAIL.life
   *  seconds whenever it flies faster than TRAIL.speed - steel's colours for a blade's blow, the burst's for the rest. A
   *  body thrown again keeps its own trail, begun afresh. */
  trail(body: Fighter | undefined, time: number, steel = false) {
    if (!DREAM_IMPACT || !body) return;
    let t = this.trails.find(each => each.body === body);
    if (!t) { t = this.trails[this.trailCursor]; this.trailCursor = (this.trailCursor + 1) % this.trails.length; t.seen = false; }
    t.body = body; t.steel = steel; t.born = time; t.until = time + TRAIL.life;
  }

  /** Where the fighters stand this frame: the light pool keeps its lights
   *  from burning any of them white. */
  track(fighters: ReadonlyMap<string, Fighter>) {
    let i = 0;
    for (const f of fighters.values()) { const p = f.group.position; this.lights.body(i++, p.x, p.y, p.z); }
    this.lights.bodiesDone(i);
  }

  /** Run once a frame, after every effect has asked for its light. */
  update(time: number, dt: number) {
    this.now = time;
    for (let i = 1; i < ANCHORS; i++) {
      const a = this.anchors[i];
      if (!a.body) continue;
      // Past its hold the anchor stays where it last was; nothing on it is
      // still alive by then.
      if (time > a.until || !a.body.group.parent) { a.body = null; continue; }
      bodyCentre(a.body, _c).sub(a.from);
      this.sparks.setAnchor(i, _c.x, _c.y, _c.z); this.dust.setAnchor(i, _c.x, _c.y, _c.z);
    }
    // The smoke is shaded by the stage's key light, wherever the look put it.
    if (!this.key && (this.keySearch++ % 120) === 0) this.scene.traverse(o => { if (!this.key && (o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow) this.key = o as THREE.DirectionalLight; });
    if (this.key) {
      _c.copy(this.key.position).sub(this.key.target.position);
      if (_c.lengthSq() > 1e-6) { _c.normalize(); this.dust.setKey(_c.x, _c.y, _c.z); this.sparks.setKey(_c.x, _c.y, _c.z); }
    }
    for (const t of this.trails) this.trailOn(t, time, dt);
    this.sparks.update(time); this.dust.update(time); this.marks.update(time); this.debris.update(dt); this.ghosts.update(time);
    for (const p of this.pulses) {
      const age = time - p.born;
      if (age < 0 || age > p.life) continue;
      // A snap up over two frames, then an exponential fall: the light of a
      // blow, not a lamp being switched on and off.
      const k = Math.min(1, age / .03) * Math.exp(-4 * age / p.life) * (1 - age / p.life);
      this.lights.request(p.x, p.y, p.z, p.hex, p.peak * k, p.distance, p.priority);
    }
    this.lights.flush();
  }

  /** Round 38: what a thrown body sheds this frame (see `trail`): specks left where it has just been, hanging and
   *  drifting down as it flies on, and a speed line streaming off behind it along its flight, a few frames long. */
  private trailOn(t: Trail, time: number, dt: number) {
    if (!t.body) return;
    if (time > t.until || !t.body.group.parent) { t.body = null; return; }
    bodyCentre(t.body, _tr);
    if (!t.seen) { t.last.copy(_tr); t.seen = true; return; }
    _ts.subVectors(_tr, t.last); t.last.copy(_tr);
    const d = _ts.length();
    if (dt <= 0 || d < TRAIL.speed * dt) return;
    const f = this.sparks, sp = f.spec, el = t.steel ? SZ_STEEL : SZ_WARM, fade = 1 - (time - t.born) / TRAIL.life;
    _ts.multiplyScalar(1 / d);
    for (let i = 0, n = this.n(TRAIL.specks, 1); i < n; i++) {
      randomUnit(_tu); const back = Math.random() * d, s = TRAIL.speck * (.6 + Math.random() * .8);
      sp.reset(SPRITE.streak, time, .22 + Math.random() * .25).pos(_tr.x - _ts.x * back + _tu.x * .3, _tr.y - _ts.y * back + _tu.y * .35, _tr.z - _ts.z * back + _tu.z * .3)
        .velocity(_tu.x * 1.6, _tu.y * 1.6 + .8, _tu.z * 1.6);
      sp.orient = ORIENT.velocity; sp.sized(s, s * .4, .8); sp.stretch = 1.6; sp.trail = .015; sp.drag = 3; sp.gravity = 3;
      sp.bias = SZ.near * .5; sp.hot(Math.random() < .4 ? 0xfff3c4 : el.spike, 1.6 * (.55 + .45 * fade)).cool(el.rim, 0); f.emit();
    }
    // A glint or two among them: the victim leaves a sparkle in the air behind it, white-hot, a beat long.
    if (Math.random() < TRAIL.glints) {
      randomUnit(_tu); const back = Math.random() * d * 2, g = TRAIL.glint * (.7 + Math.random() * .6) * (.6 + .4 * fade);
      sp.reset(SPRITE.star, time, .12 + Math.random() * .08).pos(_tr.x - _ts.x * back + _tu.x * .35, _tr.y - _ts.y * back + _tu.y * .4, _tr.z - _ts.z * back + _tu.z * .35);
      sp.sized(g, g * .2, .5); sp.rotation = Math.random() * 6.283; sp.bias = SZ.near * .5; sp.hot(0xffffff, 1.8).cool(el.spike, .6); f.emit();
    }
    // And a speed line streaming off behind it along its flight, a few frames long.
    if (this.quality !== 'low') for (let k = 0; k < 2; k++) {
      const len = Math.min(TRAIL.line, d * 6) * (.6 + .4 * fade) * (k ? .65 : 1), w = TRAIL.lineW * (.6 + .4 * fade) * (k ? .7 : 1);
      randomUnit(_tu); _tu.multiplyScalar(.3);
      sp.reset(SPRITE.bolt, time, .09).pos(_tr.x - _ts.x * len * .6 + _tu.x, _tr.y - _ts.y * len * .6 + _tu.y, _tr.z - _ts.z * len * .6 + _tu.z);
      sp.orient = ORIENT.axial; sp.axis(_ts.x, _ts.y, _ts.z); sp.sized(w, w, 1); sp.stretch = len * .5 / w;
      sp.hot(0xffffff, 1.3).cool(el.spike, .9); sp.bias = SZ.near * .6; f.emit();
    }
  }

  /** The hit spark, at the point of contact: a head-sized white-hot heart
   *  that blooms for a frame or two, a burst of inked spikes fanning out along
   *  the blow - away from whoever threw it - a thin ring, and streaks thrown
   *  the same way. It lives a fifth to a third of a second and rides
   *  `anchor`, the struck body, if given. `dir` is the way the blow travelled. */
  hitSpark(x: number, y: number, z: number, el: Element, cls: ImpactClass, born: number, dir?: THREE.Vector3, priority = 1, anchor = 0, look: InkLook = 'burst', tier?: HitTier, ownSteel = false) {
    if (DREAM_IMPACT) { this.szImpact(x, y, z, el, cls, born, dir, priority, anchor, look, tier, ownSteel); return; }
    const s = BURST[cls], life = LIFE[cls], f = this.sparks, sp = f.spec, bias = SPARK_BIAS;
    if (roanEnabled() && inkImpactsReady()) { this.inkSpark(x, y, z, el, cls, born, dir, priority, anchor, look); return; }
    sp.reset(SPRITE.core, born, .07 + cls * .015).pos(x, y, z).sized(CORE[cls] * .7, CORE[cls], .3).hot(0xffffff, 2.6 + cls * .4).cool(el.spike); sp.bias = bias; sp.anchor = anchor; f.emit();
    sp.reset(SPRITE.burst, born, life).pos(x, y, z).sized(s * .4, s, .2).hot(el.spike, 1.15).cool(el.rim, .9);
    if (dir) sp.axis(dir.x, dir.y, dir.z); else sp.axis(0, 0, 0);
    sp.rotation = (Math.random() - .5) * .5; sp.bias = bias; sp.anchor = anchor; f.emit();
    if (cls >= 1) {
      // A smaller white burst inside it, off the same axis, for depth.
      sp.reset(SPRITE.burst, born, life * .7).pos(x, y, z).sized(s * .25, s * .62, .16).hot(0xffffff, 1.4).cool(el.spike, .5);
      if (dir) sp.axis(dir.x, dir.y, dir.z); else sp.axis(0, 0, 0);
      sp.rotation = (Math.random() - .5) * 1.2; sp.bias = bias; sp.anchor = anchor; f.emit();
    }
    // A thin ring racing out, and a second, wider one on the big blows - no
    // wider than the burst's own spikes reach, or it circles the body like a
    // target marker.
    sp.reset(SPRITE.ring, born, .15 + cls * .03).pos(x, y, z).sized(s * .4, s * (1.05 + cls * .1), .5).hot(0xffffff, 1.2).cool(el.rim, .1); sp.bias = bias; sp.anchor = anchor; f.emit();
    if (cls >= 2) { sp.reset(SPRITE.ring, born + .03, .2 + cls * .03).pos(x, y, z).sized(s * .6, s * (1.2 + cls * .1), .6).hot(el.spike, 1.1).cool(el.rim, .06); sp.bias = bias; sp.anchor = anchor; f.emit(); }
    if (cls >= 3) { sp.reset(SPRITE.flare, born, .14).pos(x, y, z).sized(s * .8, s * 1.6, .2).hot(0xffffff, 1).cool(el.spike); sp.rotation = Math.random(); sp.bias = bias; sp.anchor = anchor; f.emit(); }
    this.streaks(x, y, z, el, this.n(STREAKS[cls], 3), 7 + cls * 2.5, .02 + cls * .006, born, dir, 1.1, 7, bias, anchor);
    this.pulse(x, y + 1, z, el.light, LIGHT[cls], REACH[cls], born, .16 + cls * .05, priority);
  }

  explosion(x: number, y: number, z: number, el: Element, size: number, born: number, count = 10) {
    const d = this.dust, ds = d.spec;
    // Saturated: the rim colour lit, a deep shade of it in shadow - pale clouds vanished into the white of a beam.
    const lit = _litTone.setHex(el.rim).lerp(_white, .15).getHex(), shade = _shadeTone.setHex(el.rim).multiplyScalar(.24).getHex();
    for (let i = 0, n = this.n(count, 4); i < n; i++) {
      randomUnit(_v); _v.y = Math.abs(_v.y) * .8 + .1; _v.normalize();
      const r = size * (.1 + Math.random() * .3), v = size * (1.2 + Math.random() * 2.2), ps = size * (.32 + Math.random() * .3);
      ds.reset(SPRITE.cloud, born + Math.random() * .07, .42 + Math.random() * .36).pos(x + _v.x * r, y + _v.y * r, z + _v.z * r).velocity(_v.x * v, _v.y * v + .4, _v.z * v);
      ds.drag = 3.4; ds.gravity = -.5; ds.sized(ps * .45, ps * 1.35, .4).hot(lit, 1).cool(shade, .95); ds.bias = ps * .7; d.emit();
    }
  }

  private szImpact(x: number, y: number, z: number, own: Element, cls: ImpactClass, born: number, dir: THREE.Vector3 | undefined, priority: number, anchor: number, look: InkLook, tier?: HitTier, ownSteel = false) {
    // (`ownSteel`: a blade whose cut is its own colour - Lightless Magic's black and red, Bruin's darkness - drawn as a cut, in that
    // colour rather than the white-blue of bare steel.)
    const el = look === 'blast' || ownSteel ? own : look === 'slash' ? SZ_STEEL : SZ_WARM;
    const f = this.sparks, sp = f.spec, S = SZ.star[cls] * (look === 'slash' ? .9 : 1), near = SZ.near;
    // (Round 31: where a heavy blow's big shapes are drawn - SZ.behind - and a jab's.)
    const deep = cls >= 2 ? SZ.behind : near, grow = cls >= 2 ? SZ.grow : 1;
    // The white heart: never bigger than a head (a finisher's grows the burst, not the white).
    // A heavy blow's layers stay where it landed while the body is thrown out of them (the victim leaves
    // its burst behind); a jab's ride the body for the beat they last.
    const ride = cls >= 2 ? 0 : anchor;
    // (A blade of its own colour has no white heart either: Briar Crown round 22, blind critic 8 on Cardo, "white-hot orbs ... lightless magic
    // gives off no light".)
    sp.reset(SPRITE.core, born, .05 + cls * .01).pos(x, y, z).sized(Math.min(.24, S * .2), Math.min(.32, S * .26), .3).hot(ownSteel ? el.spike : 0xffffff, ownSteel ? .8 : 1.1 + cls * .1).cool(el.spike); sp.bias = near; sp.anchor = ride; f.emit();
    // The red-pink bloom the bursts sit in: a soft glow behind the hard shapes, warmer than the burst.
    // (The extras below are the high quality's: the medium tier skips the halo and the second flame, the low one also the
    // jab's flame, the dome and the crescents' echoes - big, overlapping, see-through sprites are what fill costs.)
    const full = this.quality === 'high', some = this.quality !== 'low';
    // (Round 24: three to five frames, the impact's own. Held for a heavy blow's whole freeze it washed the victim
    // under it pink-white - the critics' "white-lavender smudge".)
    if (full && cls >= 1 && look !== 'slash') { sp.reset(SPRITE.glow, born, .05 + cls * .012).pos(x, y, z).sized(S * .9, S * (1.25 + cls * .12), .3).hot(look === 'blast' ? el.rim : 0xff3d5a, .45 + cls * .08); sp.bias = deep - .05; sp.anchor = ride; f.emit(); }
    // Round 56: whether this blow's impact frame fills the screen (SZ_SCREEN), for its bloom below.
    const lit = DIAL.bloom && cls >= 2 && !!tier && look !== 'slash' && some && born - this.screenAt >= SZ_SCREEN.gap;
    sp.reset(SPRITE.szstar, born, SZ.life[cls]).pos(x, y, z).sized(S * 1.04 * grow, S * .84 * grow, 1).hot(el.spike, 1).cool(el.rim, .96);
    if (dir) sp.axis(dir.x, dir.y, dir.z); else sp.axis(0, 0, 0);
    sp.rotation = (Math.random() - .5) * .6; sp.bias = deep; sp.anchor = ride; sp.trail = SZ.screen[cls] * .8 * grow; f.emit();
    if (DIAL.screen && cls >= 2 && tier && look !== 'slash') {
      sp.reset(SPRITE.szstar, born, SZ_SCREEN.life).pos(x, y, z).sized(S * SZ_SCREEN.size * grow, S * SZ_SCREEN.size * .82 * grow, 1).hot(el.spike, 1).cool(el.rim, .9);
      if (dir) sp.axis(dir.x, dir.y, dir.z); else sp.axis(0, 0, 0);
      const filling = DREAM_IMPACT && born - this.screenAt >= SZ_SCREEN.gap; if (filling) this.screenAt = born;
      sp.rotation = (Math.random() - .5) * .6; sp.bias = deep; sp.anchor = 0; sp.trail = (filling ? SZ_SCREEN.big : SZ_SCREEN.share) * grow; f.emit();
    }
    // Round 56: a big blow lands lit - a soft white-hot bloom going red-orange, as big as the frame's middle, light laid
    // over the hard cel shapes (and the bodies in front of them), so the contact frame is two materials: the blind
    // critics wanted "a lit, two-material hit - a soft white-hot bloom sphere and pink-red flash under
    // hard-edged cel shards", ours "a mostly flat screen-space starburst sprite with the glow arriving 67 ms later ...
    // graphic stickers rather than heavy, lit impacts". Born a beat early so it is full on the contact frame (its glow
    // eases in over a tenth of its life), and only with the impact frame that fills the screen, once in SZ_SCREEN.gap.
    if (lit) {
      sp.reset(SPRITE.glow, born - SZ_BLOOM.early, SZ_BLOOM.life).pos(x, y, z).sized(S * SZ_BLOOM.size, S * SZ_BLOOM.size * 1.08, .2).hot(look === 'blast' ? el.rim : SZ_BLOOM.hot, SZ_BLOOM.light);
      sp.bias = near * .5; sp.trail = SZ_BLOOM.share; f.emit();
    }
    if (cls >= 1) {
      sp.reset(SPRITE.szstar, born + 1 / 60, SZ.life[cls] * .75).pos(x + (Math.random() - .5) * S * .2, y + (Math.random() - .5) * S * .2, z + (Math.random() - .5) * S * .2);
      sp.sized(S * .55, S * .42, 1).hot(el.spike, .95).cool(el.rim, .92); sp.axis(0, 0, 0); sp.rotation = Math.random() * 6.283; sp.bias = deep + .02; sp.anchor = ride; f.emit();
    }
    // The blow's frame: two unit vectors square to it, for the crescents' tilt and the shock cloud's ring.
    if (dir && dir.lengthSq() > 1e-6) _c.copy(dir).normalize(); else _c.set(0, 0, 1);
    _t1.set(Math.abs(_c.y) < .9 ? 0 : 1, Math.abs(_c.y) < .9 ? 1 : 0, 0).cross(_c).normalize(); _t2.crossVectors(_c, _t1);
    const bolts = this.n(SZ.bolts[cls], 2), L = SZ.boltLen[cls], w = SZ.boltW[cls];
    for (let i = 0; i < bolts; i++) {
      randomUnit(_v);
      if (dir && i % 3 !== 2) _v.addScaledVector(_c, i % 3 === 0 ? 1.7 : -1.1).normalize();
      const half = L * (.55 + Math.random() * .7) * .5;
      sp.reset(SPRITE.bolt, born + Math.random() * .02, .1 + cls * .015 + Math.random() * .03).pos(x + _v.x * half, y + _v.y * half, z + _v.z * half);
      sp.orient = ORIENT.axial; sp.axis(_v.x, _v.y, _v.z); sp.sized(w, w, 1); sp.stretch = half / w;
      sp.hot(el.spike, 1.15).cool(el.rim, .9); sp.bias = near * .6; sp.anchor = ride; f.emit();
    }
    for (let i = 0, n = this.n(SZ.embers[cls], 3); i < n; i++) {
      // Most of them sprayed on along the blow, out of the far side of the body.
      randomUnit(_v); if (dir) _v.addScaledVector(_c, i % 4 === 3 ? .3 : 1.8).normalize();
      // Specks a player sees: three to five pixels at a fight's distance (two were lost in the frame).
      const v = (3.5 + Math.random() * 7) * (1 + cls * .15), s = .028 + Math.random() * .03;
      sp.reset(SPRITE.streak, born + Math.random() * .04, .35 + Math.random() * .35).pos(x, y, z).velocity(_v.x * v, _v.y * v + 1.5, _v.z * v);
      sp.orient = ORIENT.velocity; sp.sized(s, s * .5, .8); sp.stretch = 1.4; sp.trail = .012; sp.drag = 2.4; sp.gravity = 9;
      sp.bias = near * .5; sp.hot(Math.random() < .35 ? 0xfff3c4 : el.spike, 1.25).cool(el.rim, 0); f.emit();
    }
    // Round 59: a drift of embers and confetti that hangs round the blow for the 200 ms after it - slow, light, falling
    // only a little - where the embers above are gone out of the shot within a frame or two: a blind critic wanted
    // the 200 ms after every blow filled "with dozens of tiny independent embers, white-pink sparkle confetti", ours "one
    // big flat shape plus a handful of chips and sparkles that thin out by the second frame after impact".
    for (let i = 0, n = this.n(SZ_DRIFT.count[cls], 4); i < n; i++) {
      randomUnit(_v); if (dir) _v.addScaledVector(_c, i % 3 ? 1.1 : .2).normalize();
      const v = SZ_DRIFT.speed * (.4 + Math.random() * .9), d = SZ_DRIFT.size * (.7 + Math.random() * .6), c = SZ_DRIFT.colours[i % SZ_DRIFT.colours.length];
      sp.reset(SPRITE.streak, born + Math.random() * .06, SZ_DRIFT.life * (.7 + Math.random() * .6)).pos(x + _v.x * .12, y + _v.y * .12, z + _v.z * .12).velocity(_v.x * v, _v.y * v + .5, _v.z * v);
      sp.orient = ORIENT.velocity; sp.stretch = 1.1; sp.trail = .006; sp.drag = 3.2; sp.gravity = 1.2; sp.sized(d * .5, d * .3, .5).hot(c, 1.45).cool(el.rim, 0); sp.bias = near * .45; sp.anchor = ride; f.emit();
    }
    // Round 67: a light blow's long streak and round embers - a blind critic asked for "a curved,
    // hot-cored flame burst with one long diagonal streak and round glowing embers that drift for 3-4 frames", ours "a
    // crisp, symmetric nested star with triangular shards ... a graphic stamp rather than a strike with direction and
    // heat". One line of light shot through the blow along it, white-hot in pink, and a few round glowing embers left
    // drifting where it landed. The star stays (round 63's flame in its place lost: "a pale-yellow thin-rayed bloom").
    if (cls < 2 && look !== 'slash' && dir) {
      const half = SZ_JAB_LINE.length * (.85 + Math.random() * .3) * .5;
      sp.reset(SPRITE.bolt, born, SZ_JAB_LINE.life).pos(x + _c.x * .12, y + _c.y * .12, z + _c.z * .12);
      sp.orient = ORIENT.axial; sp.axis(_c.x, _c.y, _c.z); sp.sized(SZ_JAB_LINE.width, SZ_JAB_LINE.width, 1); sp.stretch = half / SZ_JAB_LINE.width;
      // (Laid across the lens: SparkField, a line given a trail.)
      sp.trail = 1; sp.hot(0xfff0f6, 1.3).cool(0xff4f9a, .9); sp.bias = near * .6; sp.anchor = ride; f.emit();
      for (let i = 0, n = this.n(SZ_JAB_LINE.embers, 2); i < n; i++) {
        randomUnit(_v); _v.addScaledVector(_c, .9).normalize();
        const v = .6 + Math.random() * 1.6, g = SZ_JAB_LINE.ember * (.7 + Math.random() * .6);
        sp.reset(SPRITE.glow, born + .01 + Math.random() * .04, .2 + Math.random() * .12).pos(x + _v.x * .15, y + _v.y * .15, z + _v.z * .15).velocity(_v.x * v, _v.y * v + .35, _v.z * v);
        sp.drag = 3; sp.gravity = .6; sp.sized(g, g * .8, .5).hot(i % 2 ? 0xffa23a : 0xffd27a, 1.6); sp.bias = near * .5; sp.anchor = ride; f.emit();
      }
    }
    // Round 24e: jagged yellow shards - solid cel triangles in the spike colour edged in the rim's,
    // thrown out of a heavy blow mostly along it, tumbling down as they go (a blind critic: "no solid shards").
    if (cls >= 2 && look !== 'slash') for (let i = 0, n = this.n(cls >= 3 ? 4 : 3, 2); i < n; i++) {
      randomUnit(_v); if (dir) _v.addScaledVector(_c, 1.3).normalize();
      const v = 5 + Math.random() * 5, s = S * (.07 + Math.random() * .08);
      sp.reset(SPRITE.celshard, born + Math.random() * .03, .3 + Math.random() * .22).pos(x, y, z).velocity(_v.x * v, _v.y * v + 2, _v.z * v);
      sp.orient = ORIENT.velocity; sp.sized(s, s * 1.3, 1); sp.drag = 3; sp.gravity = 7; sp.bias = near * .5;
      sp.hot(el.spike, 1).cool(el.rim, .95); f.emit();
    }
    for (let k = 0; k < SZ.crescents[cls]; k++) {
      const R = SZ.arc[cls] * (.8 + Math.random() * .4);
      // The swoosh traces the limb's path into the blow: its plane holds the blow's direction (square to it and to the
      // up, or the floor for a slam), tilted a little each time, and its centre sits back toward the thrower, so the arc
      // sweeps through the contact rather than circling it.
      randomUnit(_a);
      if (tier === 'slam') _b.set(0, 1, 0).addScaledVector(_a, .15);
      else _b.copy(_t1).addScaledVector(_a, .3);
      if (_b.lengthSq() < 1e-4) _b.set(0, 1, 0);
      _b.normalize();
      // Turned so the arc's middle runs through the blow: the sprite's local frame in its plane (SparkField's plane
      // orientation: t1 = n x up, t2 = n x t1), and the angle of the blow's direction in it.
      const back = R * .85;
      _a.set(0, 1, 0); if (Math.abs(_b.y) > .99) _a.set(1, 0, 0);
      _v.crossVectors(_b, _a).normalize(); _a.crossVectors(_b, _v);
      const rot = Math.atan2(_c.dot(_a), _c.dot(_v)) + (Math.random() - .5) * .5;
      sp.reset(SPRITE.crescent, born + k * .03, .18 + cls * .035).pos(x - _c.x * back, y - _c.y * back, z - _c.z * back).sized(R * .85, R * 1.05, .5).hot(el.spike, .95).cool(el.rim, .96);
      sp.orient = ORIENT.plane; sp.axis(_b.x, _b.y, _b.z); sp.rotation = rot; sp.bias = near * .5; sp.anchor = ride; f.emit();
      // A hairline echo outside it.
      if (some && DIAL.echo) {
        sp.reset(SPRITE.crescent, born + k * .03 + .02, .16 + cls * .03).pos(x - _c.x * back, y - _c.y * back, z - _c.z * back).sized(R * 1.05, R * 1.25, .5).hot(el.spike, .9).cool(el.rim, .7);
        sp.orient = ORIENT.plane; sp.axis(_b.x, _b.y, _b.z); sp.rotation = rot + .3; sp.stretch = 3; sp.bias = near * .5; sp.anchor = ride; f.emit();
      }
    }
    if (some && cls < 2 && look !== 'slash') {
      // A jab's flame: small, quick, along the blow - a light blow burns, it is not only a star.
      sp.reset(SPRITE.flame, born + 1 / 60, .14 + cls * .02).pos(x, y, z).sized(S * .5, S * 1.05, .5).hot(el.spike, .95).cool(el.rim, .96);
      if (dir) sp.axis(_c.x, _c.y, _c.z); else sp.axis(0, 0, 0);
      sp.rotation = (Math.random() - .5) * .8; sp.bias = near - .04; sp.anchor = ride; f.emit();
    }
    if (cls >= 2) {
      // The finisher's flame: jagged tongues shot out past the star, the biggest thing in the frame for a few frames.
      // Streaming the way the blow went (a launch's up it, a slam's out along the floor), drawn at the contact rather than
      // in front of both bodies - the striking limb passes in front of it and the body behind shows through as it
      // opens (SparkField flameBurst): the bodies stay legible through the biggest bursts.
      if (tier === 'launch') _b.set(_c.x * .35, 1, _c.z * .35).normalize(); else if (tier === 'slam') _b.set(_c.x, -.15, _c.z).normalize(); else _b.copy(_c);
      sp.reset(SPRITE.flame, born, .22 + cls * .02).pos(x, y, z).sized(S * (cls >= 3 ? 1.3 : 1.15), S * (cls >= 3 ? 2.4 : 2.1), .55).hot(el.spike, 1).cool(el.rim, .96);
      sp.axis(_b.x, _b.y, _b.z); sp.rotation = (Math.random() - .5) * .5; sp.bias = deep; sp.anchor = ride; sp.trail = SZ.screen[cls]; f.emit();
      // A second flame a beat later, turned, a little smaller: a finisher is layered, not one star.
      if (full && DIAL.flame2) {
        sp.reset(SPRITE.flame, born + .05, .2 + cls * .02).pos(x, y, z).sized(S * .8, S * 1.7, .55).hot(el.spike, 1).cool(el.rim, .96);
        sp.axis(_b.x, _b.y, _b.z); sp.rotation = (Math.random() - .5) * 1.2; sp.bias = deep; sp.anchor = ride; sp.trail = SZ.screen[cls] * .8; f.emit();
      }
      // White sparkles left hanging round the blow, drifting as they go out.
      for (let i = 0, n = this.n(cls >= 3 ? 16 : 10, 4); i < n; i++) {
        // The spray the victim is blasted through: most of it thrown the way the body goes.
        randomUnit(_v); if (tier === 'launch') { _v.y = Math.abs(_v.y) + .6; _v.normalize(); } else if (i % 3) _v.addScaledVector(_c, 1.4).normalize();
        const v = 1.5 + Math.random() * 6.5, s = .045 + Math.random() * .045;
        sp.reset(SPRITE.core, born + Math.random() * .08, .45 + Math.random() * .55).pos(x + _v.x * .3, y + _v.y * .3, z + _v.z * .3).velocity(_v.x * v, _v.y * v + .6, _v.z * v);
        sp.drag = 2.2; sp.gravity = -.4; sp.sized(s, s * .6, .6).hot(0xfff6e0, 1.05).cool(el.spike); sp.bias = near * .4; f.emit();
      }
      // Round 51: later layers, riding the thrown body - two orange rings round its path (round 52: thicker, saturated -
      // they were "thin and pale"), one after the other, and a
      // second spray of sparkles off it - where all of it went off on the contact frame: the blind critics wanted, in the
      // 200 ms after a heavy blow, "a fresh layer [arriving] every frame (white sparkle spray, thin orange ring
      // arcs, tapered crescent slashes)" while ours sits in "one static camera-facing starburst".
      if (DIAL.rings && tier && anchor) {
        for (let k = 0; k < 2; k++) {
          sp.reset(SPRITE.ring, born + .07 * (k + 1), .2).pos(x, y, z).sized(.35, 1.5 + k * .4, .7).hot(0xff7a1a, 1.6).cool(0xff4d0d, .22);
          sp.orient = ORIENT.plane; sp.axis(_c.x, _c.y, _c.z); sp.bias = near * .5; sp.anchor = anchor; f.emit();
        }
        for (let i = 0, n = this.n(cls >= 3 ? 40 : 26, 8); i < n; i++) {
          randomUnit(_v); const v = 1 + Math.random() * 4, s = .025 + Math.random() * .03;
          sp.reset(SPRITE.core, born + .1 + Math.random() * .08, .25 + Math.random() * .3).pos(x + _v.x * .35, y + _v.y * .45, z + _v.z * .35).velocity(_v.x * v, _v.y * v + .4, _v.z * v);
          sp.drag = 2.6; sp.gravity = -.3; sp.sized(s, s * .6, .6).hot(i % 6 === 2 ? 0xffb3d1 : 0xfff6e0, 1.3).cool(el.spike); sp.bias = near * .4; sp.anchor = anchor; f.emit();
        }
      }
      // Round 54: sweeping arcs - in the 133 and 200 ms frames after a launcher or a finisher, long thin
      // orange crescents swing round both fighters, one inside the other, each turned its own way, framing the body as it
      // is thrown, where ours had only the short swooshes at the contact. Drawn facing the lens at a share of its
      // distance (SpriteSpec.trail), so they frame the fight at any lens, and riding the thrown body.
      if (DIAL.arcs && tier && anchor && tier !== 'slam' && look !== 'slash') for (let k = 0, n = cls >= 3 ? 3 : 2; k < n; k++) {
        const R = SZ_ARCS.radius[k];
        sp.reset(SPRITE.crescent, born + SZ_ARCS.at + k * SZ_ARCS.step, SZ_ARCS.life).pos(x, y, z).sized(R * .86, R * 1.06, .6).hot(0xffc23a, 1.45).cool(0xff6a12, .92);
        sp.rotation = Math.random() * 6.283; sp.stretch = 1.6; sp.trail = SZ_ARCS.share[k]; sp.bias = near * .5; sp.anchor = anchor; f.emit();
      }
      // Round 57: the aftermath that wraps the thrown body for the 200 ms after the blow - a dense spray of
      // fine white glitter, born all through it and riding the body, and translucent white wind sheets swept past it -
      // where ours left it "in opaque cartoon dust puffs with a few triangle embers, so the blow stops carrying the
      // victim once the starburst frame is over" (a blind critic).
      if (DIAL.glitter && tier && anchor) {
        for (let i = 0, n = this.n(cls >= 3 ? SZ_AFTER.glitter[1] : SZ_AFTER.glitter[0], 12); i < n; i++) {
          randomUnit(_v); const v = .8 + Math.random() * 3.2, g = SZ_AFTER.speck * (.6 + Math.random() * .8);
          sp.reset(SPRITE.core, born + .02 + Math.random() * SZ_AFTER.span, .12 + Math.random() * .16).pos(x + _v.x * .45, y + _v.y * .6, z + _v.z * .45).velocity(_v.x * v, _v.y * v + .3, _v.z * v);
          sp.drag = 3; sp.gravity = -.2; sp.sized(g, g * .5, .5).hot(i % 7 === 3 ? 0xffc6dc : 0xffffff, 1.5).cool(0xfff3d6); sp.bias = near * .45; sp.anchor = anchor;
          sp.trail = 1; f.emit();
        }
        for (let k = 0, n = this.n(cls >= 3 ? 3 : 2, 1); k < n; k++) {
          const R = SZ_AFTER.sheet[k % SZ_AFTER.sheet.length];
          sp.reset(SPRITE.crescent, born + .03 + k * .045, SZ_AFTER.sheetLife).pos(x, y, z).sized(R * .8, R * 1.1, .55).hot(0xfff4f8, SZ_AFTER.sheetLight).cool(0xf2e6f0, SZ_AFTER.sheetCover);
          sp.rotation = Math.random() * 6.283; sp.bias = near * .4; sp.anchor = anchor; f.emit();
        }
      }
      // Wind: pale shards streaking off the far side of the body, the way it is thrown.
      for (let i = 0, n = this.n(cls >= 3 ? 3 : 2, 1); i < n; i++) {
        const across = (Math.random() - .5) * 1.4, up = (Math.random() - .3) * 1.2, half = .5 + Math.random() * .7, w2 = .03 + Math.random() * .035;
        const cx = x + _t1.x * across + _t2.x * up + _c.x * (half + .2), cy = y + _t1.y * across + _t2.y * up + _c.y * (half + .2), cz = z + _t1.z * across + _t2.z * up + _c.z * (half + .2);
        sp.reset(SPRITE.bolt, born + .02 + Math.random() * .04, .2 + Math.random() * .1).pos(cx, cy, cz);
        sp.orient = ORIENT.axial; sp.axis(_c.x, _c.y, _c.z); sp.sized(w2, w2, 1); sp.stretch = half / w2; sp.hot(0xe8eef8, .3).cool(0xe8eef8, .45); sp.bias = near * .3; f.emit();
      }
      // The dome: pink round a warm blow; the blow's own light round energy. A finish's only - a
      // launch and a slam are their own shapes - and a rim with little fill, so it never milks the bodies out.
      if (DIAL.dome && some && tier !== 'launch' && tier !== 'slam') {
        sp.reset(SPRITE.bubble, born, .16 + cls * .02).pos(x, y, z).sized(S * .35, S * 1.65, 1).hot(look === 'blast' ? el.light : 0xff7aa8, .8).cool(look === 'blast' ? el.rim : 0xff3d7a, .4);
        sp.axis(0, 0, 0); sp.bias = deep; sp.anchor = ride; f.emit();
      }
      // (Round 57: fewer and thinner where the body is thrown with its glitter - three of them, see-through.)
      const thrown = !!tier && !!anchor, d = this.dust, ds = d.spec, puffs = this.n(thrown ? 3 : cls >= 3 ? 7 : 5, 2);
      for (let i = 0; i < puffs; i++) {
        const a = i / puffs * Math.PI * 2 + Math.random() * .5, ca = Math.cos(a), sa = Math.sin(a), v = 3.2 + Math.random() * 2.2;
        const px = _t1.x * ca + _t2.x * sa, py = _t1.y * ca + _t2.y * sa, pz = _t1.z * ca + _t2.z * sa, size = (.3 + Math.random() * .2) * (cls >= 3 ? 1.35 : 1);
        ds.reset(SPRITE.puff, born + .02 + Math.random() * .03, .3 + Math.random() * .15).pos(x + px * .25, y + py * .25, z + pz * .25).velocity(px * v, py * v + .4, pz * v);
        ds.drag = 4.2; ds.gravity = -.4; ds.sized(size * .5, size * 1.15, .45).hot(0xdfe4ee, 1).cool(0x8a92aa, thrown ? .55 : .9); ds.bias = size; ds.anchor = anchor; d.emit();
      }
    }
    this.pulse(x, y + 1, z, el.light, LIGHT[cls] * 1.25, REACH[cls], born, .16 + cls * .05, priority);
  }

  /** The colour pass: the hit spark drawn as a hand-drawn flipbook (burst, slash or blast)
   *  over a white-hot core, a brushed shockwave ring and a glint on the big blows, and the streaks thrown along the
   *  blow. Everything the procedural spark does for the light it gives off (the pulse) it still does. */
  private inkSpark(x: number, y: number, z: number, el: Element, cls: ImpactClass, born: number, dir: THREE.Vector3 | undefined, priority: number, anchor: number, look: InkLook) {
    const f = this.sparks, sp = f.spec, bias = SPARK_BIAS, seq = look === 'slash' ? INK_IMPACTS.slash : look === 'blast' ? INK_IMPACTS.blast : (Math.random() < .5 ? INK_IMPACTS.burst : INK_IMPACTS.burst2);
    const size = (look === 'blast' ? BLAST_SIZE : INK_SIZE)[cls] * (look === 'slash' ? 1.1 : 1), life = INK_LIFE[cls] * (look === 'blast' ? 1.35 : 1);
    // The heart: white and over the bloom, gone in a frame or two.
    sp.reset(SPRITE.core, born, .06 + cls * .015).pos(x, y, z).sized(CORE[cls] * .8, CORE[cls] * 1.2, .3).hot(0xffffff, 2.8 + cls * .4).cool(el.spike); sp.bias = bias; sp.anchor = anchor; f.emit();
    // The flipbook, turned to the blow when it has a direction.
    sp.reset(SPRITE.ink, born, life).pos(x, y, z).sized(size * .9, size, .12).hot(el.spike, 1.6 + cls * .3).cool(el.rim, .96);
    sp.inkCell = seq.start; sp.inkFrames = seq.frames;
    if (seq.directional && dir) { sp.axis(dir.x, dir.y, dir.z); sp.rotation = (Math.random() - .5) * .45; } else { sp.axis(0, 0, 0); sp.rotation = Math.random() * 6.283; }
    sp.bias = bias; sp.anchor = anchor; f.emit();
    if (cls >= 2) {
      // The brushed shockwave a beat later, and the glint.
      sp.reset(SPRITE.ink, born + .03, .3 + cls * .04).pos(x, y, z).sized(size * .9, size * 1.25, .5).hot(el.spike, 1.3).cool(el.rim, .85);
      sp.inkCell = INK_IMPACTS.ring.start; sp.inkFrames = INK_IMPACTS.ring.frames; sp.axis(0, 0, 0); sp.rotation = Math.random() * 6.283; sp.bias = bias; sp.anchor = anchor; f.emit();
      sp.reset(SPRITE.ink, born, .14).pos(x, y, z).sized(size * .55, size * .7, .3).hot(0xffffff, 2.4).cool(el.spike, .5);
      sp.inkCell = INK_IMPACTS.flash.start; sp.inkFrames = INK_IMPACTS.flash.frames; sp.axis(0, 0, 0); sp.rotation = (Math.random() - .5) * .3; sp.bias = bias * 1.5; sp.anchor = anchor; f.emit();
    }
    this.streaks(x, y, z, el, this.n(STREAKS[cls], 3), 8 + cls * 2.5, .024 + cls * .007, born, dir, 1.1, 7, bias, anchor);
    this.pulse(x, y + 1, z, el.light, LIGHT[cls], REACH[cls], born, .16 + cls * .05, priority);
  }

  /** Spark streaks out of a point, biased along `dir` when given. */
  streaks(x: number, y: number, z: number, el: Element, count: number, speed: number, width: number, born: number, dir?: THREE.Vector3, lean = .5, gravity = 7, bias = 0, anchor = 0) {
    const f = this.sparks, sp = f.spec;
    for (let i = 0; i < count; i++) {
      _v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (_v.lengthSq() < .01) _v.set(0, 1, 0);
      _v.normalize();
      if (dir) _v.addScaledVector(dir, lean * 1.6).normalize();
      const v = speed * (.55 + Math.random() * .75);
      sp.reset(SPRITE.streak, born, .16 + Math.random() * .2).pos(x, y, z).velocity(_v.x * v, _v.y * v + 1.2, _v.z * v);
      sp.orient = ORIENT.velocity; sp.sized(width * (.7 + Math.random() * .6), width * .6, .6); sp.stretch = 2.5; sp.trail = .05;
      sp.drag = 3.5; sp.gravity = gravity; sp.bias = bias; sp.anchor = anchor; sp.hot(el.spike, 1.7).cool(el.rim, 0); f.emit();
    }
  }

  /** An expanding ring. Flat on the floor with `flat`, facing the camera
   *  otherwise, or in the plane of (nx,ny,nz). */
  ring(x: number, y: number, z: number, from: number, to: number, born: number, life: number, hot: number, cool: number, cover = .1, orient: 'camera' | 'flat' | 'plane' = 'camera', nx = 0, ny = 1, nz = 0) {
    const sp = this.sparks.spec;
    sp.reset(SPRITE.ring, born, life).pos(x, y, z).sized(from, to, .7).hot(hot, 1.3).cool(cool, cover);
    if (orient === 'flat') { sp.orient = ORIENT.plane; sp.axis(0, 1, 0); } else if (orient === 'plane') { sp.orient = ORIENT.plane; sp.axis(nx, ny, nz); }
    this.sparks.emit();
  }

  /** A ring of dust thrown out along the floor: low, at the feet, and gone
   *  in under half a second. It used to stand a metre tall for most of a
   *  second and swallow the legs of whoever was standing beside it. */
  dustRing(x: number, floor: number, z: number, count: number, radius: number, speed: number, size: number, born: number, life = .75) {
    if (onLiquid(this.liquid, floor)) { this.splash(x, z, Math.min(1.6, .25 + size * .55 + speed * .06 + radius * .3), born); return; }
    const f = this.dust, sp = f.spec, s = size * .5, l = Math.min(.5, life * .62);
    for (let i = 0, n = this.n(count, 2); i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .6, c = Math.cos(a), sn = Math.sin(a), v = speed * .8 * (.6 + Math.random() * .6);
      sp.reset(SPRITE.puff, born + Math.random() * .03, l * (.75 + Math.random() * .5)).pos(x + c * radius, floor + s * .3, z + sn * radius);
      sp.velocity(c * v, .2 + Math.random() * .4, sn * v); sp.drag = 3.6; sp.gravity = -.3;
      // Drawn toward the lens by about its size, or the floor it sits in
      // cuts it off along a straight line.
      sp.sized(s * .4, s * (1 + Math.random() * .35), .5).hot(DUST_LIT, 1).cool(DUST_SHADE, .88); sp.bias = s; f.emit();
    }
  }

  /** Dust kicked out along the floor in one direction, a fan of `spread`
   *  radians about (dx,dz): the dust of a blow goes out of the far side of
   *  the body it hit, not back over the feet of whoever threw it. */
  dustSpray(x: number, floor: number, z: number, dx: number, dz: number, count: number, speed: number, size: number, born: number, life = .45, spread = 1.4) {
    if (onLiquid(this.liquid, floor)) { this.splash(x, z, Math.min(1.4, .3 + size * .8 + speed * .05), born, dx, dz); return; }
    const f = this.dust, sp = f.spec, base = Math.atan2(dz, dx);
    for (let i = 0, n = this.n(count, 2); i < n; i++) {
      const a = base + (n > 1 ? i / (n - 1) - .5 : 0) * spread * 2 + (Math.random() - .5) * .3, c = Math.cos(a), sn = Math.sin(a), v = speed * (.6 + Math.random() * .6);
      sp.reset(SPRITE.puff, born + Math.random() * .03, life * (.75 + Math.random() * .5)).pos(x + c * .35, floor + size * .26, z + sn * .35);
      sp.velocity(c * v, .25 + Math.random() * .4, sn * v); sp.drag = 3.6; sp.gravity = -.3;
      sp.sized(size * .3, size * (1 + Math.random() * .35), .5).hot(DUST_LIT, 1).cool(DUST_SHADE, .88); sp.bias = size; f.emit();
    }
  }

  /** One puff of dust, for kicks, skids and slides. */
  puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, born: number, life = .6, opacity = .62) {
    const sp = this.dust.spec;
    sp.reset(SPRITE.puff, born, Math.min(.5, life)).pos(x, y, z).velocity(vx, vy, vz); sp.drag = 3; sp.gravity = -.5;
    sp.sized(size * .5, size, .5).hot(DUST_LIT, 1).cool(DUST_SHADE, Math.min(1, opacity * 1.35)); sp.bias = size * .8; this.dust.emit();
  }

  /** Whether a foot or a body at height `y` is in the place's liquid floor (not up on a rock standing in it). */
  splashes(y: number) { return onLiquid(this.liquid, y); }
  /** The liquid floor thrown up (the colour pass, iteration ten): drawn as anime-style spray - cel-shaded
   *  clumps in the liquid's two tones lifting and falling back, small drops arcing out under gravity - over ripples
   *  spreading across the surface. `size` runs from a footfall (~.3) to a smash (~1.6); (dx, dz) throws it one way
   *  (a dash's heel, a blow's far side). Nothing where the place has no liquid floor. */
  splash(x: number, z: number, size: number, born: number, dx = 0, dz = 0, ripples = 2) {
    const l = this.liquid;
    if (!l) return;
    const y = l.level, lean = Math.hypot(dx, dz) > .1 ? 1 / Math.hypot(dx, dz) : 0, ux = dx * lean, uz = dz * lean;
    // Clumps: the body of the splash.
    const clumps = this.dust, cs = clumps.spec;
    for (let i = 0, n = this.n(Math.round(2 + size * 5), 1); i < n; i++) {
      const a = Math.random() * Math.PI * 2, out = (.4 + Math.random() * .8) * size, up = (1.4 + Math.random() * 1.6) * (.55 + size * .5);
      const vx = Math.cos(a) * out + ux * size, vz = Math.sin(a) * out + uz * size, s = (.16 + Math.random() * .1) * (.6 + size * .55);
      cs.reset(SPRITE.puff, born + Math.random() * .03, .32 + size * .16 + Math.random() * .1).pos(x + Math.cos(a) * .1 * size, y + s * .3, z + Math.sin(a) * .1 * size);
      cs.velocity(vx, up, vz); cs.drag = 1.6; cs.gravity = 7;
      cs.sized(s * .5, s, .45).hot(l.lit, 1).cool(l.shade, .9); cs.bias = s * .6; clumps.emit();
    }
    // Drops arcing out and falling back: small blobs in the liquid's own two tones (a hot spark's white core read
    // as glitter on blood).
    for (let i = 0, n = this.n(Math.round(3 + size * 10), 2); i < n; i++) {
      const a = Math.random() * Math.PI * 2, out = (.8 + Math.random() * 1.6) * (.5 + size * .6), up = (1.8 + Math.random() * 2.6) * (.5 + size * .55), d = .035 + Math.random() * .03 * (.6 + size * .5);
      cs.reset(SPRITE.puff, born + Math.random() * .05, .4 + Math.random() * .3 + size * .12).pos(x + Math.cos(a) * .12, y + .05, z + Math.sin(a) * .12);
      cs.velocity(Math.cos(a) * out + ux * size * 1.2, up, Math.sin(a) * out + uz * size * 1.2); cs.gravity = 9.8; cs.drag = .4;
      cs.sized(d, d * .7, .3).hot(l.lit, 1).cool(l.shade, .9); cs.bias = d; clumps.emit();
    }
    const drops = this.sparks;
    // Ripples: a ring at once and a wider, slower one after it - dimmer than a shockwave's, mostly see-through, so
    // they read as the surface moving rather than as a mark on it.
    const rs = drops.spec;
    for (let k = 0; k < Math.min(2, ripples); k++) {
      rs.reset(SPRITE.ring, born + k * .09, (k ? .62 : .42) + size * (k ? .25 : .2)).pos(x, y + .02, z);
      rs.sized(k ? .2 + size * .2 : .08 + size * .12, k ? .8 + size * 1.5 : .45 + size * .95, .7).hot(l.lit, k ? .5 : .7).cool(l.shade, .04);
      rs.orient = ORIENT.plane; rs.axis(0, 1, 0); drops.emit();
    }
    for (const listener of VfxKit.splashed) try { listener(this.scene, x, z, size, dx, dz); } catch (error) { console.warn('VfxKit: a splash listener failed', error); }
  }

  /** A cloud of manga smoke: three flat tones lit by the key light, an ink
   *  rim, ragged as it dissolves. For blasts and steam, bigger than dust. */
  smoke(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, born: number, life = .5, lit = DUST_LIT, shade = DUST_SHADE) {
    const sp = this.dust.spec;
    sp.reset(SPRITE.puff, born, life).pos(x, y, z).velocity(vx, vy, vz); sp.drag = 2.4; sp.gravity = -.6;
    sp.sized(size * .55, size, .45).hot(lit, 1).cool(shade, .92); sp.bias = size * .8; this.dust.emit();
  }

  /** Sparks crackling off a length of energy from `a` to `b`: short streaks
   *  thrown out of its surface at `radius`, anywhere along it. */
  crackle(a: THREE.Vector3, b: THREE.Vector3, radius: number, el: Element, count: number, born: number) {
    const sp = this.sparks.spec;
    _a.subVectors(b, a); const span = _a.length(); if (span < .01) return;
    _a.divideScalar(span);
    _b.set(Math.abs(_a.y) < .9 ? 0 : 1, Math.abs(_a.y) < .9 ? 1 : 0, 0).cross(_a).normalize(); _c.crossVectors(_a, _b);
    for (let i = 0; i < count; i++) {
      const t = Math.random() * span, ang = Math.random() * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang);
      const nx = _b.x * cs + _c.x * sn, ny = _b.y * cs + _c.y * sn, nz = _b.z * cs + _c.z * sn, v = 4 + Math.random() * 7;
      sp.reset(SPRITE.streak, born, .1 + Math.random() * .12).pos(a.x + _a.x * t + nx * radius, a.y + _a.y * t + ny * radius, a.z + _a.z * t + nz * radius);
      sp.velocity(nx * v + _a.x * v * .8, ny * v + _a.y * v * .8, nz * v + _a.z * v * .8); sp.orient = ORIENT.velocity;
      sp.sized(.022 + Math.random() * .02, .01, .5); sp.stretch = 3; sp.trail = .05; sp.drag = 5; sp.hot(0xffffff, 2).cool(el.rim, 0); this.sparks.emit();
    }
  }

  /** Rubble out of a surface, a dust ring and a crack: what a blow does to
   *  the floor (normal up) or a wall (its normal). */
  groundImpact(x: number, y: number, z: number, nx: number, ny: number, nz: number, cls: ImpactClass, born: number, el?: Element, floor = y, away?: THREE.Vector3) {
    const big = cls >= 3;
    // A blow into a liquid floor throws up a column of it and rings the surface: no rubble, no crack.
    if (ny > .5 && onLiquid(this.liquid, floor)) {
      this.splash(x, z, big ? 1.6 : cls >= 2 ? 1.15 : .8, born, away?.x ?? 0, away?.z ?? 0);
      this.ring(x, this.liquid!.level + .04, z, .4, big ? 5 : 3, born, big ? .5 : .38, 0xffffff, el?.rim ?? this.liquid!.shade, .16, 'flat');
      return;
    }
    if (cls >= 2) this.debris.burst(this.n(DREAM_IMPACT ? (big ? 26 : 18) : big ? 16 : 7, 2), x, y, z, nx, ny, nz, DREAM_IMPACT ? (big ? 13 : 10) : big ? 9 : 6, ny > .5 ? .9 : .7, DREAM_IMPACT ? (big ? .19 : .15) : big ? .16 : .11, floor, big ? 2.4 : 1.7);
    // Round 59: and flecks of dirt with the rocks - dozens of dark specks thrown up out of the floor and falling back,
    // "dirt flecks" (a blind critic) between the rocks.
    if (DREAM_IMPACT && cls >= 2 && ny > .5) {
      const fs = this.sparks.spec;
      for (let i = 0, n = this.n(big ? 56 : 40, 8); i < n; i++) {
        const a = Math.random() * Math.PI * 2, out = 1.5 + Math.random() * 3.5, up = 3 + Math.random() * 5, d = .045 + Math.random() * .045;
        fs.reset(SPRITE.streak, born + Math.random() * .05, .45 + Math.random() * .4).pos(x + Math.cos(a) * .3, floor + .08, z + Math.sin(a) * .3)
          .velocity(Math.cos(a) * out + (away?.x ?? 0), up, Math.sin(a) * out + (away?.z ?? 0));
        fs.orient = ORIENT.velocity; fs.sized(d, d * .8, .3); fs.stretch = 1.6; fs.drag = 1.2; fs.gravity = 11;
        // (Under half an intensity a streak is ink, its cool colour: SparkField streakShape.)
        fs.hot(0x000000, .4).cool(i % 3 ? DREAM_EARTH_SHADE : 0x2b2420, .96); fs.bias = d; this.sparks.emit();
      }
    }
    if (DREAM_IMPACT && ny > .5 && cls >= 2) {
      // A low ring of it racing out over the floor first, then the column.
      this.dustRing(x, floor, z, big ? 12 : 9, .5, big ? 7 : 5.5, big ? .75 : .6, born, .6);
      const d = this.dust, ds = d.spec;
      // Earth, in mid tones: the cream of the old dust under the bloom turned a column of it into a white-out.
      // Thrown out more than up, from a ring round the impact: the body lying in the middle of it stays in sight.
      for (let i = 0, n = this.n(big ? 8 : 6, 4); i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = .45 + Math.random() * .7, out = (2.4 + Math.random() * 2.8) * (big ? 1.25 : 1), up = (1.2 + Math.random() * 2.2) * (big ? 1.2 : 1);
        const size = (big ? .5 : .4) + Math.random() * (big ? .45 : .3), c = Math.cos(a), sn = Math.sin(a);
        ds.reset(SPRITE.puff, born + Math.random() * .06, .5 + Math.random() * .35).pos(x + c * r, floor + size * .3, z + sn * r).velocity(c * out + (away?.x ?? 0) * 1.5, up, sn * out + (away?.z ?? 0) * 1.5);
        ds.drag = 2.4; ds.gravity = 1.6; ds.sized(size * .45, size * 1.3, .5).hot(DREAM_EARTH_LIT, 1).cool(DREAM_EARTH_SHADE, .94); ds.bias = size * .6; d.emit();
      }
    }
    if (ny > .5) {
      // A blow's dust goes out of the far side of the body it struck; a
      // blast's goes out all round.
      if (away && Math.hypot(away.x, away.z) > .2) this.dustSpray(x, floor, z, away.x, away.z, big ? 6 : 4, big ? 3.6 : 2.8, big ? .55 : .4, born, .42, 1.1);
      else this.dustRing(x, floor, z, big ? 10 : cls >= 2 ? 7 : 5, .3, big ? 4.5 : 3, big ? .9 : .65, born);
      this.ring(x, floor + .05, z, .4, big ? 5 : 3, born, big ? .45 : .34, 0xffffff, el?.rim ?? DUST_SHADE, .18, 'flat');
    } else {
      for (let i = 0; i < this.n(5, 2); i++) this.puff(x + nx * .2, y + (Math.random() - .3) * .8, z + nz * .2, nx * (1.5 + Math.random() * 2) + (Math.random() - .5), Math.random(), nz * (1.5 + Math.random() * 2) + (Math.random() - .5), .6 + Math.random() * .3, born);
      this.ring(x, y, z, .4, 2.8, born, .4, 0xffffff, el?.rim ?? 0xcfd8e2, .15, 'plane', nx, ny, nz);
    }
    if (cls >= 2 && this.quality !== 'low') this.marks.mark(MARK.crack, x, ny > .5 ? floor : y, z, nx, ny, nz, DREAM_IMPACT ? (big ? 4.4 : 2.8) : big ? 3.2 : 1.9, born, big ? 3 : 2.2, el?.light ?? 0xffc873, el ? .5 : 0);
    // The dream loop: a heavy blow into the floor leaves a crater under the cracks - the floor dented, not only drawn on.
    if (DREAM_IMPACT && cls >= 2 && ny > .5 && this.quality !== 'low') this.marks.mark(MARK.scorch, x, floor, z, 0, 1, 0, big ? 2.2 : 1.5, born, big ? 3 : 2.2, 0x000000, 0);
  }

  /** A burn where energy hit a surface. */
  scorch(x: number, y: number, z: number, nx: number, ny: number, nz: number, size: number, born: number, glow: number) {
    if (ny > .5 && onLiquid(this.liquid, y)) { this.splash(x, z, Math.min(1.2, .4 + size * .3), born); return; }
    if (this.quality !== 'low') this.marks.mark(MARK.scorch, x, y, z, nx, ny, nz, size, born, 3, glow, 1.2);
  }

  clear() { this.sparks.clear(); this.dust.clear(); this.marks.clear(); this.debris.clear(); this.ghosts.clear(); this.beams.clear(); this.lights.clear(); for (const p of this.pulses) p.born = -1e9; for (const a of this.anchors) a.body = null; }

  release() {
    if (--this.refs > 0) return;
    kits.delete(this.scene);
    this.sparks.dispose(); this.dust.dispose(); this.marks.dispose(); this.debris.dispose(); this.lights.dispose(); this.ghosts.dispose(); this.beams.dispose();
  }
}
