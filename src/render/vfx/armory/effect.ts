import * as THREE from 'three';
import { EffectPool, PooledEffect, type CancelReason, type CueContext, type EffectFrame, type EffectInstance, type EffectType, type Tier } from '../engine/Effect';
import { bodyCentre } from '../VfxKit';
import { SIGNATURE } from '../../signature/context';
import type { Fighter } from '../../Fighter';
import { frame as armoryFrame } from './withheld';
import { settings } from './withheld';
import type { ArmoryHost, ArmorySpace } from './host';
import type { ArmoryAbility, ArmoryAbilityClass } from './types';
import { FITS, HeatRamp, autoFit, guessHeat, type Fit, type Palette } from './fits';
import { macroValue, turnHue, type Macros } from './macros';
import { armorySound, type CastSound, type SoundMode } from './sound';
import { effekseerHost } from './effekseer';


/** How a cast is laid out from the thrower:
 *  - `line`: from the feet along the heading, `reach` metres (a breath, a lash, a flock);
 *  - `target`: from the feet to the body the cue names (a blow that landed): the distance to it;
 *  - `zone`: a far cast, centred on the target's feet, else on the cue's anchor point (an endpoint);
 *  - `around`: a far cast centred on the thrower's own feet;
 *  - `body`: worn by the thrower, following it (an aura). */
export type Lay = 'line' | 'target' | 'zone' | 'around' | 'body';

export interface ArmoryParams {
  lay?: Lay;
  /** Metres to the end of the line (`line`), the least distance for the others. */
  reach?: number;
  /** The look's size against the Armory's 1.8 m caster: the casting's scale times the fighter's height over 1.8. */
  size?: number;
  /** The fighter's colours (casting.json `palette`). */
  palette?: Palette;
  /** The front's speed (metres a second), to arrive with the move's projectile or blow. */
  speed?: number;
  /** Seconds the effect holds after it arrives (the fit's `sustain` key). */
  sustain?: number;
  /** Seconds after which it is wound down whatever its own length (0: its own). */
  hold?: number;
  /** The Armory's clock against the move's (> 1 plays it faster). */
  pace?: number;
  /** A far cast's radius (metres), when the effect has a zone. */
  radius?: number;
  /** Yaw off the heading (radians): one cast of a fan. */
  yaw?: number;
  /** The effect's own settings for this cast (casting.json `settings`), over the fit's. */
  set?: Readonly<Record<string, number | string | boolean>>;
  /** The game's impact frame, at this strength, when the Armory flashes (the local player's cast only; once). */
  impactFrame?: number;
  /** The light it may ask of the game's pool, against the Armory's own candela. */
  light?: number;
  /** The fighter's height (metres): what an aura worn by the body measures it by. */
  height?: number;
  /** It starts at the move's release (its blow, its throw): the effect's own wind-up is cut to nothing. */
  release?: boolean;
  /** A line stops this far past a target it is thrown at (metres); a line with no target keeps its reach. */
  past?: number;
  /** Its impact shells' and ground rings' size against the Armory's (host.ts), over the fit's. */
  bursts?: number;
  decals?: number;
  /** Its sound (sound.ts): the bed (what the game's move sounds don't cover), the whole profile, or none (left out). */
  sound?: SoundMode;
  /** Its own colours turned this many degrees round the wheel (a Forge kit's `hue`), when it has no palette. */
  hue?: number;
  /** The Armory inspector's Essentials dials (macros.ts): Glow, Speed, Power, from each key's shipped value. */
  macros?: Macros;
}

/** The game's camera is close: an impact shell and a ground ring at the Armory's size fill its frame. */
const BURSTS = .42, BURST_OPACITY = .8, DECALS = .7;

const TIER_SCALE: Readonly<Record<Tier, number>> = { low: .45, medium: .7, high: 1 };
/** How much faster a cast cut short plays out, and the longest it may take doing so. */
const WIND_PACE = 4, WIND_MAX = .3;
/** No Armory cast runs longer than this, whatever it says (a stand against a stuck one). */
const HARD_CAP = 14;
/** The ki lens on the game's screen (see the instance's constructor): focus lines at this much, a white-out at most this. */
const LENS_LINES = .6, LENS_WHITE = .3;
/** The blade kit's hit sparks of an effect fitted by name, at this much of their size. */
const SPARK_SCALE = .4;
const UP = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();

type Value = number | string | boolean;

/** The canonical skeleton's parents (render/skeleton.ts names), for the ext auras' bone segments. */
const PARENT: Readonly<Record<string, string | undefined>> = {
  Hips: undefined, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
};
interface BoneStandIn { isBone: true; name: string; parent: BoneStandIn | null; matrixWorld: THREE.Matrix4 }
const skeletons = new WeakMap<Fighter, { traverse(cb: (node: BoneStandIn) => void): void }>();
/** A fighter's joints as the Armory's CharacterLink reads a model's bones (Mixamo names, a parent each), live. */
function skeletonOf(f: Fighter) {
  let s = skeletons.get(f);
  if (!s) {
    const nodes = new Map<string, BoneStandIn>();
    for (const name of Object.keys(PARENT)) {
      const joint = jointOf(f, name);
      if (joint) nodes.set(name, { isBone: true, name, parent: null, matrixWorld: joint.matrixWorld });
    }
    for (const [name, node] of nodes) { const up = PARENT[name]; node.parent = up ? nodes.get(up) ?? null : null; }
    s = { traverse(cb) { for (const node of nodes.values()) cb(node); } };
    skeletons.set(f, s);
  }
  return s;
}

/** A fighter's canonical joint, as drawn (render/skeleton.ts names). */
const jointOf = (f: Fighter | undefined, name: string) =>
  f ? ((f as Fighter & { drawnJoint?(n: string): THREE.Object3D | undefined }).drawnJoint?.(name) ?? f.joints?.get(name as never)) : undefined;

/**
 * The Armory's base caster, as the edge pack finds it by name in its scene (`findCaster`: Character → CharacterTilt → a
 * model holding Mixamo-named bones): a stand-in in the space with one node per canonical joint, each moved to the drawn
 * fighter's every frame, so a finger beam leaves the real finger and a blade the real hand. Nodes only: nothing drawn.
 */
class CasterStandIn {
  private readonly bones = new Map<string, THREE.Object3D>();
  constructor(parent: THREE.Object3D) {
    const root = new THREE.Group(), tilt = new THREE.Group(), model = new THREE.Group();
    root.name = 'Character'; tilt.name = 'CharacterTilt'; model.name = 'armory-caster';
    for (const name of Object.keys(PARENT)) {
      const bone = new THREE.Object3D();
      bone.name = name;
      (bone as THREE.Object3D & { isBone: boolean }).isBone = true;
      // Its world matrix is the joint's, copied every frame: three must not recompute it.
      bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false;
      model.add(bone);
      this.bones.set(name, bone);
    }
    tilt.add(model); root.add(tilt); parent.add(root);
  }
  see(f: Fighter | undefined) {
    if (!f) return;
    for (const [name, bone] of this.bones) { const joint = jointOf(f, name); if (joint) bone.matrixWorld.copy(joint.matrixWorld); }
  }
}

class ArmoryInstance extends PooledEffect<ArmoryParams> {
  /** Its type is let go (ArmoryEffectType.dispose): what it built - its space's systems, the meshes its ability built into the
   *  space - gone from the scene and the card. Never one in the air: types are let go as a room is entered. */
  dispose() {
    try { if (this.ability.isActive) this.ability.destroy(); } catch { /* going anyway */ }
    try { this.space.dispose(); } finally { this.type.host.dropSpace(this.space); }
  }

  readonly space: ArmorySpace;
  readonly ability: ArmoryAbility;
  private cue?: CueContext;
  private p: ArmoryParams = {};
  private readonly values = new Map<string, Value>();
  private globals = { particleCount: 1, emissionRate: 1 };
  private spawned = false;
  private gone = false;
  private winding = false;
  private woundAt = 0;
  private lastAge = -1;
  /** Seconds on the Armory's clock (paced) and on the move's, since the cast began. */
  private clock = 0;
  private moveClock = 0;
  private flashed = false;
  private readonly origin = new THREE.Vector3();
  private readonly dir = new THREE.Vector3(0, 0, 1);
  /** A movable zone's victim's feet when it was laid out: it is moved by how far they have gone since. */
  private readonly laidAt = new THREE.Vector3();
  private following?: string;
  private feet0 = 0;
  private distance = 0;
  private voice?: CastSound;
  private readonly heard = new THREE.Vector3();
  /** The base caster an effect that reads the caster's bones finds in its scene (the edge pack's). */
  private readonly caster?: CasterStandIn;

  constructor(private readonly type: ArmoryEffectType, name: string) {
    super();
    this.space = type.host.space(name);
    // An Effekseer effect finds its runtime through the host building it (effekseer.ts).
    effekseerHost(type.host);
    this.ability = new type.Klass(this.space.ctx);
    // As the Armory's AbilityManager does: the ability's group in its scene (here, its space), hidden until cast.
    this.space.root.add(this.ability.group);
    this.ability.group.visible = false;
    // The edge pack reads the caster's bones (EdgeAbility `_bone`): it gets a stand-in of the drawn fighter's.
    if (typeof (this.ability as unknown as { _bone?: unknown })._bone === 'function') this.caster = new CasterStandIn(this.space.root);
    this.space.adapt();
    this.space.flashTo = (_color, strength) => this.flash(strength);
    // Hits, for the sound: the space's bursts, flashes and shakes, and the blade pack's juice (its own kit per space).
    this.space.onHit = intensity => { this.voice?.event(intensity); this.onStrike?.(intensity); };
    type Juicy = { spawn?: (...a: unknown[]) => unknown; trigger?: (...a: unknown[]) => unknown };
    const juice = (this.ability as unknown as { juice?: { sparks?: Juicy; impact?: Juicy; hitStop?: Juicy; bursts?: Juicy } }).juice;
    // The blade pack's cel bursts (its shells, domes and rings, which the saga, ki and colossus packs' big hits throw too) at
    // the space's burst scale, as the Armory's own impact shells are (host.ts): at the Armory's size a shell round a
    // target metres away engulfs the close camera.
    // Its hit sparks too, a glint drawn over everything (no depth test): the pilot's blade had its own at 40%.
    const spark = juice?.sparks?.spawn;
    if (type.fit.auto && juice?.sparks && typeof spark === 'function') {
      const sized: Record<string, unknown> = {};
      juice.sparks.spawn = (at: unknown, strength: unknown, o?: unknown) => {
        const options = (o ?? {}) as Record<string, unknown>;
        for (const key in sized) delete sized[key];
        Object.assign(sized, options);
        sized.scale = (typeof options.scale === 'number' ? options.scale : 1) * SPARK_SCALE;
        return spark.call(juice.sparks, at, strength, sized);
      };
    }
    // (An effect fitted by hand sized its own already.)
    const celBurst = juice?.bursts?.spawn;
    if (type.fit.auto && juice?.bursts && typeof celBurst === 'function') {
      const scaled: Record<string, unknown> = {};
      juice.bursts.spawn = (look: unknown, at: unknown, o?: unknown) => {
        const options = (o ?? {}) as Record<string, unknown>;
        for (const key in scaled) delete scaled[key];
        Object.assign(scaled, options);
        for (const key of ['radius', 'endRadius']) if (typeof options[key] === 'number') scaled[key] = (options[key] as number) * this.space.burstScale;
        return celBurst.call(juice.bursts, look, at, scaled);
      };
    }
    const tell = (o: Juicy | undefined, method: 'spawn' | 'trigger', intensity: (...a: unknown[]) => number) => {
      const original = o?.[method];
      if (!o || typeof original !== 'function') return;
      o[method] = (...a: unknown[]) => { this.voice?.event(intensity(...a)); return original.apply(o, a); };
    };
    tell(juice?.sparks, 'spawn', (_point, strength) => [.35, .6, .9][Number(strength) | 0] ?? .6);
    tell(juice?.impact, 'trigger', () => 1);
    tell(juice?.hitStop, 'trigger', () => .95);
    // The ki pack's lens (its focus lines, impact frame and white-out, a quad over the whole screen, which the ki, saga,
    // arts and colossus packs drive): the game's impact frame stands in for its own, its white-out is held to a flash and
    // its focus lines softened, and only a cast the local player throws or is hit by draws on the screen at all.
    const overlay = (this.ability as unknown as { overlay?: { set?: (p: Record<string, unknown>) => void } }).overlay;
    const set = overlay?.set;
    if (overlay && typeof set === 'function') {
      const lens: Record<string, unknown> = {};
      overlay.set = p => {
        for (const key in lens) delete lens[key];
        Object.assign(lens, p);
        const local = !!this.cue?.local;
        lens.lines = local ? Number(p.lines ?? 0) * LENS_LINES : 0;
        lens.white = local ? Math.min(LENS_WHITE, Number(p.white ?? 0)) : 0;
        lens.impact = 0;
        set.call(overlay, lens);
      };
    }
  }

  /** At load: one whole cast, hidden, so everything the Armory builds on its first cast exists before the room's
   *  compile. `keep` leaves the cast standing that many seconds into its life (the warm instance).
   *  The Armory's clock runs with it, as it does through a cast (`update`): an effect that steps its own simulation
   *  once a frame, by the frame's time (the fxlib pack's three-nebula rigs: NebulaKit `tick`), stood still on a clock
   *  held at 0, so a meteor shower's dry run dropped no meteor, and the scorch and shock rings they leave were first
   *  built in the fight (Pyroclast's area look: two programs, 62 ms, on his first G).
   *  `set`: values over the fit's own (ArmoryEffectType.warmWith: what a room's kit casts the effect with). */
  dryRun(keep?: number, set?: Readonly<Record<string, Value>>) {
    const fit = this.type.fit;
    this.values.clear();
    for (const [key, value] of Object.entries(fit.set ?? {})) this.values.set(key, value);
    if (fit.holdKey) this.values.set(fit.holdKey, 1.2);
    for (const [key, value] of Object.entries(set ?? {})) this.values.set(key, value);
    this.clock = 0;
    this.enter();
    this.ability.spawn(_o.set(0, 0, 0), _d.set(0, 0, 1), 8);
    this.space.adapt();
    const step = 1 / 20;
    let t = 0;
    for (; t < 10 && this.ability.isActive; t += step) {
      if (keep !== undefined && t >= keep) break;
      this.clock += step;
      this.enter(step);
      this.ability.update(step);
      this.space.step(step);
    }
    this.space.adapt();
    if (keep !== undefined) {
      this.space.hold();
      // Kept standing, never stepped again: what it borrowed from the Armory's global pools (a scene hook's token, for
      // the ki pack's grade) goes back now, or the hooks' lease sweep reclaims it with a warning.
      const borrowed = (this.ability as unknown as { borrowed?: { release?(): void }[] }).borrowed;
      if (borrowed) { for (const handle of borrowed.splice(0)) handle?.release?.(); }
      return;
    }
    if (this.ability.isActive) this.ability.destroy();
    this.space.clear();
    this.space.hold();
    this.space.adapt();
  }

  start(p: ArmoryParams, cue: CueContext) {
    this.reset();
    this.space.unhold();
    this.p = p; this.cue = cue;
    this.lastAge = -1;
  }

  /** The cast laid out on the first frame (the bodies are in `frame`): its origin, heading and length, and every
   *  setting this cast writes. */
  private place(frame: EffectFrame) {
    const cue = this.cue!, p = this.p, fit = this.type.fit, defaults = this.type.defaults;
    const actor = frame.fighters.get(cue.actorId), target = cue.targetId ? frame.fighters.get(cue.targetId) : undefined;
    const feet = actor ? actor.group.position : cue.anchor.point;
    this.dir.copy(cue.heading); if (p.yaw) this.dir.applyAxisAngle(UP, p.yaw);
    const lay = p.lay ?? 'line', least = p.reach ?? 1;
    let distance = p.reach ?? 6;
    this.origin.set(feet.x, 0, feet.z);
    if (lay === 'line' && target && p.past !== undefined) {
      // A line thrown at somebody ends just past them, not at the move's full reach.
      _q.set(target.group.position.x - feet.x, 0, target.group.position.z - feet.z);
      distance = Math.min(distance, Math.max(least, _q.length() + (fit.past ?? p.past)));
    } else if (lay === 'target' && (target || cue.anchor.point)) {
      if (target) bodyCentre(target, _p); else _p.copy(cue.anchor.point);
      _q.set(_p.x - feet.x, 0, _p.z - feet.z);
      const d = _q.length();
      if (d > .2) this.dir.copy(_q).divideScalar(d);
      distance = Math.max(least, d);
    } else if (lay === 'zone') {
      if (target) _p.copy(target.group.position); else _p.copy(cue.anchor.point);
      _q.set(_p.x - feet.x, 0, _p.z - feet.z);
      const d = _q.length();
      if (d > .2) this.dir.copy(_q).divideScalar(d);
      distance = Math.max(.5, d);
      if (target && fit.movable) { this.following = cue.targetId; this.laidAt.copy(target.group.position); }
    } else if (lay === 'around') {
      this.origin.addScaledVector(this.dir, -1); distance = 1;
    } else if (lay === 'body') distance = least;
    this.feet0 = feet.y;
    const size = p.size ?? 1;
    const values = this.values;
    values.clear();
    for (const [key, value] of Object.entries(fit.set ?? {})) values.set(key, value);
    // The launch point: the anchor (a hand, a blade's heel, a joint) as forward, right and up from the feet.
    if (fit.launch && cue.anchor.socket !== 'floor' && cue.anchor.socket !== 'centre') {
      _s.crossVectors(this.dir, UP).normalize();
      _q.subVectors(cue.anchor.point, this.origin);
      if (fit.launch.forward) values.set(fit.launch.forward, Math.max(.1, _q.dot(this.dir)));
      if (fit.launch.side) values.set(fit.launch.side, _q.dot(_s));
      if (fit.launch.height) values.set(fit.launch.height, Math.max(.2, cue.anchor.point.y));
    }
    if (fit.end && lay === 'target' && target) values.set(fit.end, Math.max(.3, bodyCentre(target, _p).y));
    // Sizes and counts scale the game's values where the fit sets them, else the Armory's.
    const base = (key: string) => (fit.set?.[key] ?? defaults[key]) as number;
    for (const key of fit.size ?? []) if (typeof base(key) === 'number') values.set(key, base(key) * size * (fit.sizeScale ?? 1));
    const tier = TIER_SCALE[cue.tier] * Math.max(.3, Math.min(1, cue.density));
    for (const key of fit.counts ?? []) if (typeof base(key) === 'number') {
      const v = base(key) * tier;
      values.set(key, Number.isInteger(base(key)) ? Math.max(1, Math.round(v)) : v);
    }
    if (p.release) for (const key of fit.windup ?? []) values.set(key, .03);
    if (fit.step && p.speed) {
      const [stepKey, countKey] = fit.step, count = Number(values.get(countKey) ?? base(countKey) ?? 8);
      values.set(stepKey, Math.max(.012, distance / Math.max(1, count) / p.speed));
    }
    this.space.burstScale = (p.bursts ?? fit.bursts ?? BURSTS) * Math.max(.6, size);
    this.space.burstOpacity = BURST_OPACITY;
    this.space.decalScale = (p.decals ?? fit.decals ?? DECALS) * Math.max(.6, size);
    for (const [key, perTier] of Object.entries(fit.levels ?? {})) values.set(key, perTier[cue.tier]);
    this.globals = { particleCount: tier, emissionRate: tier };
    for (const key of fit.range ?? []) values.set(key, key.startsWith('min') ? 0 : Math.max(distance + 1, (defaults[key] as number) ?? 0));
    if (fit.speed && p.speed) values.set(fit.speed, p.speed * (fit.speedScale ?? 1));
    if (fit.sustain && p.sustain !== undefined) values.set(fit.sustain, p.sustain);
    if (fit.holdKey) values.set(fit.holdKey, 3600);
    if (fit.zone && p.radius) values.set(fit.zone, p.radius);
    if (fit.pace && p.pace) values.set(fit.pace, p.pace);
    // The fighter's colours, by heat, each key keeping its own brightness; or (a Forge kit's) its own, turned.
    if (p.palette) {
      const ramp = this.type.ramp(p.palette);
      for (const [key, value] of Object.entries(defaults)) {
        if (typeof value !== 'string' || !value.startsWith('#')) continue;
        const heat = fit.colours ? fit.colours[key] : guessHeat(key);
        if (heat !== undefined) values.set(key, ramp.recolour(value, heat));
      }
    } else if (p.hue) {
      for (const [key, value] of Object.entries(defaults)) if (typeof value === 'string' && value.startsWith('#')) values.set(key, turnHue(value, p.hue));
    }
    // The Essentials dials, from each key's value as this cast has it so far.
    if (p.macros) for (const [key, value] of Object.entries(defaults)) {
      const v = macroValue(key, values.get(key) ?? value, p.macros);
      if (v !== undefined) values.set(key, v);
    }
    for (const [key, value] of Object.entries(p.set ?? {})) values.set(key, value);
    this.follow(frame);
    // The space rested while it was hidden (hiddenMatrices.ts: the frame's matrix pass leaves a hidden space alone), and a
    // movable zone's last cast may have left what is under its root a victim's walk away. Brought up to date here, once a
    // cast, so what the effect reads as it spawns (a rig stood under its group, a hull's sync) is what that pass used to
    // leave it; the caster's joints, kept by hand, are copied in after.
    this.space.root.updateMatrixWorld(true);
    this.caster?.see(actor);
    this.see(frame, cue.actorId);
    this.enter();
    this.ability.spawn(this.origin, this.dir, distance);
    this.space.show(true);
    this.space.adapt();
    this.spawned = true;
    this.distance = distance;
    if (p.sound) this.voice = armorySound()?.begin(this.type.effectId, p.sound, this.heardAt());
    return true;
  }

  /** Where its sound is placed: a far cast's zone, else the thrower's feet as it was cast, or the wearer's. */
  private heardAt() {
    const lay = this.p.lay ?? 'line';
    if (lay === 'zone' || lay === 'target') return this.heard.copy(this.origin).addScaledVector(this.dir, this.distance).applyMatrix4(this.space.root.matrixWorld);
    // (An ability worn on the body that keeps no origin of its own - the extended pack's bending auras - is heard where it
    // was placed: reading its missing origin threw, every frame, and the aura was never drawn.)
    return this.heard.copy(lay === 'body' ? this.ability.origin ?? this.origin : this.origin);
  }

  /** The fighters the cast sees and its thrower, for an effect that looks for bodies (the extended pack's targets). */
  private see(frame: EffectFrame, actor: string) {
    const bodies = this.space.bodies ??= { fighters: frame.fighters, actor };
    bodies.fighters = frame.fighters; bodies.actor = actor;
  }

  /** An aura worn by a body: the Armory's caster origin (and its lift off the floor) moved with it. */
  private follow(frame: EffectFrame) {
    const fit = this.type.fit, cue = this.cue!;
    if (!fit.follows) return;
    const body = frame.fighters.get(cue.actorId);
    if (!body) return;
    const feet = body.group.position;
    if (this.spawned) this.ability.origin.set(feet.x, 0, feet.z);
    else this.origin.set(feet.x, 0, feet.z);
    for (const key of fit.lift ?? []) {
      const base = (this.type.defaults[key] as number) * (this.p.size ?? 1);
      this.values.set(key, base + Math.max(0, feet.y));
    }
    const c = this.type.host.character;
    c.position.set(feet.x, feet.y, feet.z);
    c.facing = body.state?.yaw ?? 0;
    c.height = this.p.height ?? 1.8;
    c.model = skeletonOf(body) as unknown as THREE.Object3D;
    c.root = null;
  }

  /** Before the Armory runs this instance: its settings in the effect's block, its clock in the frame's uniforms. */
  private enter(step = 0) {
    const block = this.type.block, defaults = this.type.defaults;
    for (const key of this.type.touched) block[key] = defaults[key];
    for (const [key, value] of this.values) { block[key] = value; this.type.touched.add(key); }
    const g = settings.global as Record<string, number>;
    g.particleCount = this.globals.particleCount; g.emissionRate = this.globals.emissionRate;
    armoryFrame.uTime.value = this.clock; armoryFrame.uDelta.value = step;
    this.space.clock.value = this.clock; this.space.delta.value = step;
    this.space.see(this.type.host.gameCamera);
  }

  /** Told of every hit the effect makes as it plays (a burst, a flash, a shake), at its intensity: the area slot's
   *  strike times are measured from these (FxStage.measure, scripts/area/measureStrikes.mjs). */
  onStrike?: (intensity: number) => void;

  update(age: number, _dt: number, frame: EffectFrame) {
    if (this.gone || !this.cue) return false;
    if (!this.spawned && !this.place(frame)) return false;
    const step = this.lastAge < 0 ? 0 : Math.max(0, Math.min(.1, age - this.lastAge));
    this.lastAge = age;
    const pace = (this.p.pace && !this.type.fit.pace ? this.p.pace : 1) * (this.winding ? WIND_PACE : 1);
    const t = step * pace;
    this.clock += t; this.moveClock += step;
    this.follow(frame);
    this.caster?.see(frame.fighters.get(this.cue.actorId));
    this.see(frame, this.cue.actorId);
    if (this.following) {
      // A movable zone kept under its victim as the cinematic moves them (its shaders all honour the model matrix).
      const victim = frame.fighters.get(this.following);
      if (victim) {
        const root = this.space.root;
        root.matrix.makeTranslation(victim.group.position.x - this.laidAt.x, 0, victim.group.position.z - this.laidAt.z);
        root.matrixWorld.copy(root.matrix); root.matrixWorldNeedsUpdate = true;
      }
    }
    this.enter(t);
    const before = this.ability.phase;
    try { this.ability.update(t); }
    catch (error) { console.warn(`armory/${this.type.effectId}: update failed`, error); return false; }
    if (this.voice) {
      if (this.ability.phase !== before) this.voice.phase(this.ability.phase);
      this.voice.tick(this.heardAt());
    }
    this.space.step(t);
    this.space.adapt();
    if (frame.light) this.space.lights.flush(this.space.root.matrixWorld, frame.light, this.p.light ?? .35);
    if (!this.winding && this.p.hold && this.moveClock > this.p.hold) this.wind();
    if (!this.ability.isActive || this.ability.isFinished) return false;
    if (this.winding && this.clock - this.woundAt > WIND_MAX * WIND_PACE) return false;
    // An aura is worn for as long as its wearer's condition holds (castingSignature.ts takes it off).
    return this.p.lay === 'body' || this.clock < HARD_CAP;
  }

  private wind() { if (!this.winding) { this.winding = true; this.woundAt = this.clock; } }

  /** The Armory's screen flash, as the game's impact frame: the local player's cast only, once, if asked. */
  private flash(strength: number) {
    const cue = this.cue, k = this.p.impactFrame ?? 0;
    if (!cue || this.flashed || k <= 0 || strength < .15 || !cue.local) return;
    this.flashed = true;
    SIGNATURE.screen?.impactFrame?.(k, this.ability.position);
  }

  cancel(reason: CancelReason) {
    if (reason === 'despawn' || !this.spawned) { this.gone = true; return; }
    this.wind();
  }

  protected reset() {
    this.voice?.end(); this.voice = undefined;
    if (this.ability.isActive || this.ability.phase !== 'idle') this.ability.destroy();
    this.space.clear();
    this.space.show(false);
    this.space.root.matrix.identity(); this.space.root.matrixWorld.identity();
    this.following = undefined;
    this.cue = undefined; this.p = {}; this.values.clear();
    this.spawned = false; this.gone = false; this.winding = false; this.woundAt = 0; this.lastAge = -1; this.clock = 0; this.moveClock = 0; this.flashed = false;
  }
}

/** `armory/<id>`: one vendored Armory effect, a fixed pool of instances, each in its own space. */
export class ArmoryEffectType implements EffectType<ArmoryParams> {
  readonly id: string;
  readonly fit: Fit;
  /** The effect's live settings block (the Armory reads it every frame), and its values as vendored. */
  readonly block: Record<string, Value>;
  readonly defaults: Readonly<Record<string, Value>>;
  /** Keys an instance has written: put back before the next one writes its own. */
  readonly touched = new Set<string>();
  private pool?: EffectPool<ArmoryInstance>;
  private warm?: ArmoryInstance;
  private readonly ramps = new Map<string, HeatRamp>();

  /** Measured per effect (fits.ts `cost`), else a guess. */
  readonly cost: { readonly draws: number; readonly gpuMs: number };
  constructor(readonly host: ArmoryHost, readonly effectId: string, readonly Klass: ArmoryAbilityClass, readonly capacity = 3,
    cost?: { draws: number; gpuMs: number }) {
    this.id = `armory/${effectId}`;
    const all = settings as unknown as Record<string, Record<string, Value>>;
    this.block = all[effectId];
    if (!this.block) throw new Error(`armory: no settings block '${effectId}' (vendor it: scripts/engine/armory/vendor.mts)`);
    this.defaults = Object.freeze(structuredClone(this.block));
    // A hand fit, else one from its settings' names (any effect a Forge kit picks).
    this.fit = FITS[effectId] ?? autoFit(this.defaults, effectId);
    this.cost = cost ?? this.fit.cost ?? { draws: 12, gpuMs: .5 };
  }

  /** `quick`: for a type built mid-session (the Forge's): no whole-cast dry run of each instance, which only fills what the
   *  Armory builds lazily ahead of a room's load-time compile; a first cast builds and compiles it then anyway. The warm
   *  instance still stands, so a program is never deleted with its last material. */
  prewarm(_scene: THREE.Scene, quick = false) {
    if (this.pool) return;
    this.pool = new EffectPool(this.capacity, i => new ArmoryInstance(this, `${this.effectId}#${i}`));
    if (!quick) { for (const instance of this.pool.all) instance.dryRun(); this.dried = true; }
    this.warm = new ArmoryInstance(this, `${this.effectId}#warm`);
    this.warm.dryRun(.6);
    this.holdSpares();
    // Back to the vendored values for whatever reads the block next.
    for (const key of this.touched) this.block[key] = this.defaults[key];
  }

  /** What the dry runs built and put away again out of the scene, put back in it, hidden, so the room's compile links
   *  its program. A rollshade move (the extra_* effects: RSRuntime's PrimPool) makes a kind of shape (an arc, a lathe, a
   *  wave, the impact frame's invert) the first time a cast asks for one, and when the cast lets it go takes its mesh out
   *  of the scene and keeps it, material and all, for the next: the dry run made it and no compile ever saw it, so the
   *  real cast's first frame linked its program (Gohaku's Barrage Rush, launch day 15's sweep). The spare is the
   *  pool's own: its next cast takes it, shows it and puts it away again, as before. Duck-typed on the vendored runtime
   *  (`ability.rt.prims.free`, `ability.rt.root`): an effect without one is left alone. */
  private holdSpares() {
    type Spare = { mesh?: THREE.Object3D };
    for (const instance of [...(this.pool?.all ?? []), ...(this.warm ? [this.warm] : [])]) {
      const rt = (instance.ability as unknown as { rt?: { root?: THREE.Object3D; prims?: { free?: unknown } } } | undefined)?.rt;
      const root = rt?.root, free = rt?.prims?.free;
      if (!root?.isObject3D || !(free instanceof Map)) continue;
      let held = 0;
      for (const list of free.values()) if (Array.isArray(list)) for (const spare of list as Spare[]) {
        const mesh = spare?.mesh;
        if (mesh?.isObject3D && !mesh.parent) { mesh.visible = false; root.add(mesh); held++; }
      }
      // And given what the space gives everything in it at a cast (ArmorySpace.adapt: the Armory's clock in its shader), so
      // the program the compile links is the one the cast draws with: without it the lathe the dry run put away was
      // compiled bare and its cast linked the patched one (Gohaku's Barrage Rush).
      if (held) instance.space.adapt();
    }
  }

  /** The warm cast's off-screen simulation run for one step now, with the renderer the room's load has in hand. An
   *  effect that simulates on the GPU (the found pack's Volumetric Inferno: Bellows's area look) draws its passes
   *  itself, from its mesh's onBeforeRender: no scene holds them, so the room's compile never links their programs, and
   *  a held, hidden cast is never drawn. Its seven linked in the fight, on the first cast (a 19-83 ms frame:
   *  scripts/night/load_hitches.mjs). The targets the step made for the warm cast are let go again at once (it is never
   *  drawn); its materials stay, and with them the programs every cast of the type shares. True when a step was run. */
  warmPasses(renderer: THREE.WebGLRenderer): boolean {
    const sim = (this.warm?.ability as unknown as { sim?: Record<string, unknown> & { run?(renderer: THREE.WebGLRenderer, steps: number, step: number, at: (s: number) => number): void; needsClear?: boolean } } | undefined)?.sim;
    if (!sim || typeof sim.run !== 'function') return false;
    try {
      sim.run(renderer, 1, 1 / 120, () => 0);
      sim.needsClear = true;
      for (const value of new Set(Object.values(sim))) if ((value as THREE.WebGLRenderTarget | undefined)?.isWebGLRenderTarget) (value as THREE.WebGLRenderTarget).dispose();
      return true;
    } catch (error) { console.warn(`armory: ${this.effectId}'s off-screen passes were not warmed`, error); return false; }
  }

  /** The sprite atlas of an effect that draws its particles from one (the fxlib pack's three-nebula rigs: NebulaKit),
   *  packed and handed to the GPU now. A rig's renderer packs its atlas on a system update once every sprite's image
   *  has loaded; the dry run's updates come before the image does (it is fetched by the first of them), so the first
   *  cast packed it and its first drawn frame uploaded it: two textures on Pyroclast's first G (his meteor shower), and on
   *  the first awakening of a body that wears the halo seal. For the room's load, after the effects' files are in
   *  (FxStage.effekseer). Returns how many atlases still wait on an image: the caller asks again, and one never
   *  packed here is packed by its first cast, as before. */
  warmAtlases(renderer: THREE.WebGLRenderer): number {
    type Atlas = { needsUpdate?: boolean; update?(): void; atlasTexture?: THREE.Texture; atlasIndex?: THREE.Texture };
    let waiting = 0;
    for (const instance of [...(this.warm ? [this.warm] : []), ...(this.pool?.all ?? [])]) {
      const rigs = (instance.ability as unknown as { rigs?: { points?: { textureAtlas?: Atlas } }[] }).rigs;
      if (!Array.isArray(rigs)) continue;
      for (const rig of rigs) {
        const atlas = rig?.points?.textureAtlas;
        if (!atlas?.needsUpdate || typeof atlas.update !== 'function') continue;
        try {
          atlas.update();
          if (atlas.needsUpdate) { waiting++; continue; }
          for (const texture of [atlas.atlasTexture, atlas.atlasIndex]) if (texture?.image) renderer.initTexture(texture);
        } catch (error) { console.warn(`armory: ${this.effectId}'s sprite atlas was not warmed`, error); }
      }
    }
    return waiting;
  }

  /** The sets of values `warmWith` has cast this type with (each once). */
  private readonly variants = new Set<string>();
  /** At a room's load, for a kit that casts this effect with values of its own (src/engine/sim/houseKits.json: Gohaku
   *  Beast's Barrage Rush in the plain element and a violet of his, not the vendored fire; casting.json's `settings`): one
   *  whole cast, hidden, on one of the pool's own instances, with them laid over the fit's as `start` lays a cast's - the
   *  quality tier's levels, the kit's macros, then its own settings - so what only such a cast builds (a rollshade move
   *  makes a kind of shape, and links its program, the first time a cast asks for one) is built with the room, and held
   *  in its scene for the compile (`holdSpares`). Once a set of values a type. True when a cast was made. */
  warmWith(own: Readonly<Record<string, Value>>, macros: Macros = {}, tier: Tier = 'high') {
    const all = this.pool?.all;
    if (!all?.length) return false;
    const key = JSON.stringify([own, macros, tier]);
    if (this.variants.has(key)) return false;
    const values: Record<string, Value> = { ...(this.fit.set ?? {}) };
    for (const [k, perTier] of Object.entries(this.fit.levels ?? {})) values[k] = perTier[tier];
    for (const [k, value] of Object.entries(this.defaults)) { const v = macroValue(k, values[k] ?? value, macros); if (v !== undefined) values[k] = v; }
    Object.assign(values, own);
    // (Not the pool's first: the warm draw shows that one as its whole dry run left it.)
    const instance = all[1 + this.variants.size % Math.max(1, all.length - 1)] ?? all[0];
    this.variants.add(key);
    try { instance.dryRun(undefined, values); this.holdSpares(); }
    finally { for (const k of this.touched) this.block[k] = this.defaults[k]; }
    return true;
  }

  /** The spaces a load-time warm draw shows once (GameRenderer.warmDraw): the warm cast, standing mid-life, and the
   *  pool's first instance once it has been cast whole in hiding (the one a first cast takes: EffectPool.acquire) - both
   *  as a cast leaves them, so drawable. Never an instance that has not been cast: nothing has drawn one as it was built. */
  warmSpaces(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    if (this.warm) out.push(this.warm.space.root);
    const first = this.dried ? this.pool?.all[0] : undefined;
    if (first) out.push(first.space.root);
    return out;
  }

  private dried = false;
  /** Whether `dryRun` (or a full `prewarm`) has run: what a first cast would have built is built. */
  get warmed() { return this.dried; }
  /** For a type built `quick` (an area look's, a Forge kit's: fxStage.ts) that a room is about to draw: whole casts of
   *  `count` of its instances (the first ones), hidden, so everything the Armory builds on a first cast - its meshes,
   *  buffers and programs, its images - exists before the room's compile and texture upload and not in the fight's
   *  first frame that throws it (a Dragon's 15 programs and 94 MB of images were a 3 s frame). One instance is enough
   *  for the programs and images, which every instance of a type shares (three keeps one program a source and one
   *  texture a source); the others build only their own meshes when first cast. Once. */
  dryRun(count = 1) {
    if (this.dried || !this.pool) return;
    this.dried = true;
    for (const instance of this.pool.all.slice(0, Math.max(1, count))) instance.dryRun();
    this.holdSpares();
    for (const key of this.touched) this.block[key] = this.defaults[key];
  }

  /** Let go: every instance (the pool's and the warm one) disposed, the pool gone - `acquire` answers none from now on. */
  dispose() {
    for (const instance of [...(this.pool?.all ?? []), ...(this.warm ? [this.warm] : [])]) { try { instance.dispose(); } catch (error) { console.warn(`armory: ${this.effectId} instance`, error); } }
    this.pool = undefined; this.warm = undefined; this.variants.clear(); this.ramps.clear();
    for (const key of this.touched) this.block[key] = this.defaults[key];
    this.touched.clear();
  }

  acquire(): EffectInstance<ArmoryParams> | null { return this.pool?.acquire() ?? null; }

  /** A palette's heat ramp, made once. */
  ramp(palette: Palette) {
    const key = `${palette.core}${palette.main}${palette.rim}`;
    let ramp = this.ramps.get(key);
    if (!ramp) { ramp = new HeatRamp(palette); this.ramps.set(key, ramp); }
    return ramp;
  }

  /** Instances running now, and the pool (tests, the capture tools). */
  get live() { return this.pool?.live ?? 0; }
  get instances(): readonly unknown[] { return this.pool?.all ?? []; }
}
