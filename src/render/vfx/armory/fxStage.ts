import * as THREE from 'three';
import type { CombatEvent, FighterId } from '../../../game/types';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { VfxKit } from '../VfxKit';
import { bodyCentre } from '../VfxKit';
import { EffectRegistry, type CueContext, type EffectAnchor, type EffectFrame, type EffectInstance, type EffectType, type Tier } from '../engine/Effect';
import { CueDirector, type CueTrack } from '../engine/cues';
import { registerIce, definePreset, presetFromPalette } from '../engine/ice';
import { involvesLocal } from '../../signature/context';
import type { ForgeFx } from '../../../engine/sim/forge';
import { auraFx, eventFx, kitOwner } from './fxLookup';
import { FIGHTERS } from '../../../config';
import { ArmoryHost } from './host';
import { ArmoryEffectType, type ArmoryParams } from './effect';
import { ARMORY_MANIFEST } from './vendor/manifest';
import { ARMORY_CASTINGS } from './vendor/castings';
import { AURA_SCALE, fxCues, type MoveSlot } from './castingSignature';
import { splitSettings, type Macros } from './macros';
import { soundBank } from './sound';
import { armorySoundOut } from './soundOut';
import { prefetchEffekseer, startEffekseer } from './effekseer';

/**
 * A Forge kit's Armory effects in one scene (forgeFx.ts loads this the first time a kit or the Forge asks for one):
 * every effect fetched, built and prewarmed on demand into the scene's Armory host, its moves' cues played by a cue
 * director whose track is the thrower's kit, its aura worn, and previews thrown at the Forge's word.
 *
 * An effect built here mid-match compiles its programs on the spot (a hitch the first time, in the Forge); `prepare`
 * lets the Forge build it before it is first thrown.
 */

const MOVE_SLOTS: readonly MoveSlot[] = ['light', 'heavy', 'special', 'ultimate'];
const NATIVE_IDS = new Set(['ice/crystal-field', 'ice/lance', 'ice/freeze', 'ice/floor-freeze', 'ice/pheasant']);
/** How many of one effect may run at once from Forge kits and previews. */
const CAPACITY = 4;
/** The most a first try waits for what a new effect still loads (ms): its images, an Effekseer effect's runtime and
 *  files (the runtime, 1.5 MB, once a page). Long enough for a warm cache; on a cold one the rest comes in during the
 *  throw rather than holding it (the transplant's EFFECTS_GRACE, docs/engine/ENGINE.md). */
const LOAD_CAP = 150;
/** A previewed aura is worn this long; a previewed move's effect is left to end on its own (at most this). */
const PREVIEW_AURA = 3, PREVIEW_MAX = 8;
const STILL_ELEMENT = Object.freeze({ spike: 0xffffff, rim: 0xffffff, light: 0xffffff, ink: 0 });
const heightOf = (fighter: FighterId) => (FIGHTERS as Record<string, { height?: number }>)[fighter]?.height ?? 1.7;
const _p = new THREE.Vector3(), _q = new THREE.Vector3();

/** What a kit casts an effect with besides its fit's values (houseKits.json `settings`, split: macros.ts splitSettings). */
export interface KitValues { own: Record<string, number | string | boolean>; macros: Macros }

interface Worn {
  instance: EffectInstance<ArmoryParams>; ctx: CueContext & { anchor: EffectAnchor }; born: number; effect: string; key: string; ending: boolean;
  /** An area look (round 3): how far it has been played, kept up with the clock through a stall (see update). */
  played?: number;
}

export class FxStage {
  readonly host: ArmoryHost;
  readonly registry = new EffectRegistry();
  private readonly director: CueDirector;
  private readonly loads = new Map<string, Promise<boolean>>();
  private readonly built = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly tracks = new Map<string, CueTrack>();
  private readonly presets = new Set<string>();
  private iced = false;
  private fighters: ReadonlyMap<string, Fighter> = new Map();
  private readonly auras = new Map<string, Worn>();
  private readonly previews: Worn[] = [];
  /** The last area looks laid and the hits each made as it played (the page's clock, ms; `start` where its own time
   *  began, pre-roll and all; round 3): what the proof tools hold the simulation's strikes against
   *  (window.arenaEvidence.areaLooks, scripts/area/damage_proof.mjs). */
  readonly laidLooks: { effect: string; casterId: string; start: number; hits: { at: number; intensity: number }[] }[] = [];
  private readonly frame: EffectFrame & { time: number; fighters: ReadonlyMap<string, Fighter>; flights: ReadonlyMap<string, Flight> };
  private last?: number;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, private readonly kit: Pick<VfxKit, 'quality' | 'density' | 'lights'>) {
    this.host = ArmoryHost.for(scene);
    this.registry.layer(this.host);
    const light = kit.lights ? (x: number, y: number, z: number, hex: number, intensity: number, distance: number) => kit.lights!.request(x, y, z, hex, intensity, distance, 1.5) : undefined;
    this.director = new CueDirector({
      registry: this.registry,
      tracks: (_fighter: FighterId, event: CombatEvent) => this.trackOf(event),
      tier: () => (this.kit.quality ?? 'high') as Tier,
      density: () => this.kit.density ?? 1,
      light,
    });
    this.frame = { time: 0, fighters: new Map(), flights: new Map(), locate: (anchor, out) => { const f = anchor.fighter ? this.frame.fighters.get(anchor.fighter) : undefined; if (!f) { out.copy(anchor.point); return false; } bodyCentre(f, out); return true; }, light };
  }

  /** The scene's Effekseer runtime (the `efk_*` effects, 5 of the 94 house kits' area looks and 21 castings' picks) started
   *  now and waited for, up to `cap` ms: it starts by itself on the first frame drawn with the game's camera, and its
   *  WebAssembly and each effect's files then arrive in the fight's first seconds (a 133 ms and a 477 ms frame on a first
   *  Effekseer cast: scripts/night/load_hitches.mjs). A room that has none resolves at once. */
  async effekseer(renderer: THREE.WebGLRenderer, camera: THREE.Camera, cap = 2500) {
    this.host.seen(renderer, camera);
    // (And what a built effect simulates off screen, linked now rather than on its first cast: effect.ts `warmPasses`.)
    for (const type of this.host.types.values()) (type as { warmPasses?(renderer: THREE.WebGLRenderer): boolean }).warmPasses?.(renderer);
    await this.host.loaded(cap);
    // (And the sprite atlases a first cast would pack and upload: effect.ts `warmAtlases`. A rig's sprite is fetched by its
    // first dry run and no scene holds it, so `loaded` cannot wait for it: asked again, for up to a second.)
    for (let tries = 0; tries < 20 && !this.disposed; tries++) {
      let waiting = 0;
      for (const type of this.host.types.values()) waiting += (type as { warmAtlases?(renderer: THREE.WebGLRenderer): number }).warmAtlases?.(renderer) ?? 0;
      if (!waiting) break;
      await new Promise<void>(resolve => setTimeout(resolve, 50));
    }
  }

  /** The Effekseer runtime's own files asked for now, if an effect built here uses it (effekseer.ts prefetchEffekseer); with the
   *  renderer and the game's camera, the runtime itself started and every effect's files with it (startEffekseer). */
  prefetchEffekseer(renderer?: THREE.WebGLRenderer, camera?: THREE.Camera) {
    prefetchEffekseer(this.host);
    if (renderer && camera) { this.host.seen(renderer, camera); startEffekseer(this.host); }
  }

  /** What a load-time warm draw shows of every effect built in this scene (GameRenderer.warmDraw): each type's warm cast
   *  and its first pooled instance (ArmoryEffectType.warmSpaces). The draw shows a shadow caster with everything it
   *  hangs from, so it is handed the spaces that are safe to draw and not the whole Armory. */
  warmRoots(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const type of this.host.types.values()) out.push(...((type as { warmSpaces?(): THREE.Object3D[] }).warmSpaces?.() ?? []));
    return out;
  }

  /** The effects of rooms past let go (ArmoryHost.retainTypes): everything built here that `keep` does not name - the room's
   *  area looks, kit picks and auras, and what its signatures' castings draw - out of this stage's registry and records, so a
   *  later room that wants one builds it again. Only as a room is entered: a cast of one in the air would lose its meshes. */
  retain(keep: ReadonlySet<string>): string[] {
    for (const id of [...this.built, ...this.failed]) {
      if (keep.has(id) || NATIVE_IDS.has(id)) continue;
      this.built.delete(id); this.failed.delete(id); this.loads.delete(id);
      this.registry.unregister(`armory/${id}`);
    }
    for (const id of [...this.loads.keys()]) if (!keep.has(id) && !NATIVE_IDS.has(id) && !this.built.has(id)) this.loads.delete(id);
    const dropped = this.host.retainTypes(keep);
    // Their sound too: the files their casts played, decoded in the game's audio, and no longer wanted by any effect built.
    try { const files = soundBank().retain(keep); if (files.length) armorySoundOut()?.release?.(files); } catch (error) { console.warn('armory: sound of earlier rooms could not be let go', error); }
    return dropped;
  }

  /** Whether an effect is built here and plays from the next event. */
  ready(id: string) { return this.built.has(id); }
  /** Whether an effect could not be built (not vendored, or it failed). */
  broken(id: string) { return this.failed.has(id); }

  /** Fetch and build an effect (its chunk, its type, its pool prewarmed, its sound), once. */
  ensure(id: string): Promise<boolean> {
    if (this.built.has(id)) return Promise.resolve(true);
    let load = this.loads.get(id);
    if (!load) {
      load = this.build(id).then(ok => { if (ok) this.built.add(id); else this.failed.add(id); return ok; }, error => { console.warn(`armory: ${id} could not be built`, error); this.failed.add(id); return false; });
      this.loads.set(id, load);
    }
    return load;
  }

  /** An effect a room is about to draw (area looks, a kit's picks; roomFx.ts), made ready for its load-time compile and
   *  texture upload: built (`ensure`), then one instance cast whole in hiding (ArmoryEffectType.dryRun) so the meshes,
   *  buffers, programs and images a first cast builds exist now, and what that asked for waited on (up to `cap` ms).
   *  Without it a house kit's area move built its effect in the fight's first frames and compiled it on its first draw:
   *  3 s for a Dragon, 1-2 s for a Rollshade move, in a twelve-fighter match (scripts/night/load_hitches.mjs). */
  async warm(id: string, cap = 4000, variants: readonly KitValues[] = []): Promise<boolean> {
    if (!(await this.ensure(id)) || this.disposed) return false;
    const type = (this.host.types as Map<string, ArmoryEffectType>).get(id);
    if (!type) return true;
    // (And once a set of values, a whole cast with what the room's kits cast it with: ArmoryEffectType.warmWith.)
    const tier = (this.kit.quality ?? 'high') as Tier, own = variants.filter(v => Object.keys(v.own).length || Object.keys(v.macros).length);
    if (type.warmed && !own.length) return true;
    await this.host.loaded(cap, false);
    if (this.disposed) return false;
    if (!type.warmed) { type.dryRun(1); await this.host.loaded(cap, false); if (this.disposed) return false; }
    let cast = false;
    for (const v of own) { try { cast = type.warmWith(v.own, v.macros, tier) || cast; } catch (error) { console.warn(`armory: ${id} was not warmed with its kit's values`, error); } }
    if (cast) await this.host.loaded(cap, false);
    return !this.disposed;
  }

  private async build(id: string): Promise<boolean> {
    if (NATIVE_IDS.has(id)) {
      if (!this.iced) { registerIce(this.registry, this.scene); this.registry.prewarm(this.scene); this.iced = true; }
      return true;
    }
    const entry = ARMORY_MANIFEST[id];
    if (!entry) return false;
    const types = this.host.types as Map<string, ArmoryEffectType>;
    let type = types.get(id);
    if (!type) {
      performance.mark(`armory:fetch:${id}`);
      const Klass = await entry.load();
      if (this.disposed) return false;
      type = types.get(id);
      if (!type) {
        performance.mark(`armory:build:${id}`);
        type = new ArmoryEffectType(this.host, id, Klass, CAPACITY); types.set(id, type);
        // Built mid-session: no dry runs (effect.ts `prewarm`), so the first try comes sooner.
        type.prewarm(this.scene, true);
        performance.mark(`armory:load:${id}`);
        // What it still loads (its images, an Effekseer effect's files), so its first try plays whole.
        await this.host.loaded(LOAD_CAP);
        try {
          performance.measure(`armory:fetch ${id}`, `armory:fetch:${id}`, `armory:build:${id}`);
          performance.measure(`armory:build ${id}`, `armory:build:${id}`, `armory:load:${id}`);
          performance.measure(`armory:load ${id}`, `armory:load:${id}`);
        } catch { /* marks cleared */ }
        if (this.disposed) return false;
      }
    }
    this.registry.register(type as EffectType<unknown>);
    const bank = soundBank();
    bank.need(id, 'bed'); bank.need(id, 'full');
    void bank.prepare();
    return true;
  }

  /** The thrower's kit's cues for this event's move, once its effect is built: the move as the event names it (a
   *  borrowed one's own fighter and slot, for its timing), sized by the body that throws it. */
  private trackOf(event: CombatEvent): CueTrack | undefined {
    if (!event.slot || event.branch !== undefined) return undefined;
    const owner = kitOwner(this.fighters.get(event.actorId));
    const fx = owner ? eventFx(event, this.fighters) : undefined;
    if (!owner || !fx || !this.built.has(fx.effect)) return undefined;
    const slot = event.slot as MoveSlot, moveFighter = (event.fighter ?? owner.fighter) as FighterId;
    const key = `${owner.fighter}|${moveFighter}|${slot}|${JSON.stringify(fx)}`;
    let track = this.tracks.get(key);
    if (!track) {
      this.preset(owner.fighter, fx.effect);
      track = Object.freeze(fxCues(owner.fighter, moveFighter, slot, fx));
      if (this.tracks.size > 128) this.tracks.clear();
      this.tracks.set(key, track);
    }
    return track;
  }

  /** A native (ICE) effect's look for a body: its casting palette's (every fighter has one). */
  private preset(body: FighterId, effect: string) {
    if (!effect.startsWith('ice/') || this.presets.has(body)) return;
    const palette = ARMORY_CASTINGS[body]?.palette;
    if (palette) definePreset(presetFromPalette(`ice/${body}`, palette));
    this.presets.add(body);
  }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (fighters) this.fighters = fighters;
    this.director.handle(event, fighters);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    const dt = this.last === undefined ? 0 : Math.max(0, Math.min(.1, time - this.last));
    this.last = time;
    this.fighters = fighters;
    this.frame.time = time; this.frame.fighters = fighters; this.frame.flights = flights;
    this.director.update(time, fighters, flights);
    this.wearAuras(time, dt, fighters);
    for (let i = this.previews.length - 1; i >= 0; i--) {
      const p = this.previews[i];
      let alive = true;
      try {
        // An area look's strikes are the simulation's (round 3), so it keeps time through a stall: an effect steps at
        // most 0.1 s a frame, and a longer frame (a first draw's shaders, a busy page) would leave its strikes behind.
        if (p.played !== undefined) for (; alive && time - p.born - p.played > .1;) { p.played += .1; alive = p.instance.update(p.played, .1, this.frame); }
        if (alive) { alive = p.instance.update(time - p.born, dt, this.frame); if (p.played !== undefined) p.played = time - p.born; }
      } catch (error) { console.warn('armory preview failed', error); alive = false; }
      if (alive && !p.ending && time - p.born > (p.key === 'aura' ? PREVIEW_AURA : PREVIEW_MAX)) { p.ending = true; p.instance.cancel('interrupt'); }
      if (!alive) { (p.instance as { onStrike?: unknown }).onStrike = undefined; p.instance.release(); this.previews.splice(i, 1); }
    }
  }

  /** Every body whose kit gives it an aura wears it (built on demand), for as long as the kit does and it lives. */
  private wearAuras(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>) {
    for (const [id, f] of fighters) {
      const state = f.state, owner = kitOwner(f);
      const fx = state && state.alive !== false ? auraFx(f) : undefined;
      const worn = this.auras.get(id);
      const key = fx ? JSON.stringify(fx) : '';
      if (worn && !worn.ending && worn.key !== key) { worn.ending = true; worn.instance.cancel(state?.alive === false ? 'despawn' : 'interrupt'); }
      if (fx && (!worn || worn.ending) && !this.auras.has(id)) {
        if (!this.built.has(fx.effect)) { void this.ensure(fx.effect); continue; }
        const instance = this.acquire(fx.effect);
        if (!instance) continue;
        const ctx = this.context(id, f, undefined);
        instance.start(this.auraParams(owner!.fighter, fx), ctx);
        this.auras.set(id, { instance, ctx, born: time, effect: fx.effect, key, ending: false });
      }
    }
    for (const [id, worn] of this.auras) {
      let alive = this.frame.fighters.has(id);
      if (alive) { try { alive = worn.instance.update(time - worn.born, dt, this.frame); } catch (error) { console.warn('armory aura failed', error); alive = false; } }
      if (!alive) { worn.instance.release(); this.auras.delete(id); }
    }
  }

  private auraParams(body: FighterId, fx: ForgeFx): ArmoryParams {
    const height = heightOf(body), { macros, own } = splitSettings(fx.settings);
    return { lay: 'body', size: AURA_SCALE.small * height / 1.8 * (fx.scale ?? 1), height, light: .25, sound: 'bed',
      ...(fx.hue ? { hue: fx.hue } : {}), macros, ...(Object.keys(own).length ? { set: own } : {}) };
  }

  private acquire(id: string) {
    const type = this.registry.get(NATIVE_IDS.has(id) ? id : `armory/${id}`) as EffectType<ArmoryParams> | undefined;
    return type?.acquire() ?? null;
  }

  /** Throws an effect from a player now, at its nearest opponent, without assigning it: the Forge's TRY. */
  async preview(playerId: string, fx: ForgeFx) {
    if (!(await this.ensure(fx.effect)) || this.disposed) return false;
    const f = this.fighters.get(playerId);
    if (!f?.state) return false;
    const entry = ARMORY_MANIFEST[fx.effect];
    // An ICE effect plays from the kit's own cues on the next throw; a preview is for the Armory's.
    if (!entry) return false;
    const target = this.nearest(playerId, f);
    const instance = this.acquire(fx.effect);
    if (!instance) return false;
    const aura = (entry as { aura?: boolean }).aura === true;
    const ctx = this.context(playerId, f, target);
    const { macros, own } = splitSettings(fx.settings);
    const height = heightOf(kitOwner(f)?.fighter ?? f.state.fighter), size = (aura ? AURA_SCALE.small : .82) * height / 1.8 * (fx.scale ?? 1);
    let reach = 7;
    if (target) { _q.subVectors(target.group.position, f.group.position); _q.y = 0; reach = Math.max(2, _q.length() + 1.2); }
    const params: ArmoryParams = aura
      ? { lay: 'body', size, height, light: .25, sound: 'full', ...(fx.hue ? { hue: fx.hue } : {}), macros, ...(Object.keys(own).length ? { set: own } : {}) }
      : { lay: entry.cast === 'zone' ? 'zone' : 'line', reach, past: 1.2, size, height, speed: 36, sustain: .8, hold: 3, light: .35, sound: 'full', impactFrame: 0,
        ...(fx.hue ? { hue: fx.hue } : {}), macros, ...(Object.keys(own).length ? { set: own } : {}) };
    instance.start(params, ctx);
    this.previews.push({ instance, ctx, born: this.frame.time, effect: fx.effect, key: aura ? 'aura' : 'move', ending: false });
    return true;
  }

  /** The area slot (docs/engine/AREA.md): `fx` laid on the floor at a circle's centre now, sized to the circle - the
   *  thrower's kit's pick for its area slot, or the look the matcher found for its area move (areaLooks.json). A zone
   *  effect is laid across the circle; a line effect is thrown from the caster to it. `preroll` seconds of it are played
   *  at once (round 3: a look whose first strike comes later than the telegraph allows starts that far in, so its
   *  strikes land with the simulation's); so is any time spent fetching it. */
  async zone(casterId: string, fx: ForgeFx, at: THREE.Vector3, radius: number, preroll = 0): Promise<boolean> {
    const asked = this.frame.time;
    if (!(await this.ensure(fx.effect)) || this.disposed) return false;
    const entry = ARMORY_MANIFEST[fx.effect];
    const instance = entry ? this.acquire(fx.effect) : null;
    if (!entry || !instance) return false;
    const { params, ctx } = this.zoneCast(casterId, fx, at, radius);
    const late = Math.min(PREVIEW_MAX / 2, Math.max(0, preroll) + Math.max(0, this.frame.time - asked));
    const now = () => typeof performance === 'object' ? performance.now() : 0;
    const laid = { effect: fx.effect, casterId, start: now() - late * 1000, hits: [] as { at: number; intensity: number }[] };
    this.laidLooks.push(laid);
    if (this.laidLooks.length > 12) this.laidLooks.shift();
    (instance as { onStrike?: (intensity: number) => void }).onStrike = intensity => { if (laid.hits.length < 400) laid.hits.push({ at: now(), intensity: +intensity.toFixed(2) }); };
    instance.start(params, ctx);
    // Its first step from 0, as FxStage.measure timed it (an effect's first update only starts its clock), then the
    // pre-roll in quick steps.
    let alive = true;
    try {
      alive = instance.update(0, 0, this.frame);
      for (let age = 0; alive && age < late - 1e-4;) { const dt = Math.min(1 / 30, late - age); age += dt; alive = instance.update(age, dt, this.frame); }
    } catch (error) { console.warn('armory: laying', fx.effect, error); alive = false; }
    if (!alive) { (instance as { onStrike?: unknown }).onStrike = undefined; instance.release(); return false; }
    this.previews.push({ instance, ctx, born: this.frame.time - late, effect: fx.effect, key: 'move', ending: false, played: late });
    return true;
  }
  /** When an effect laid as an area strike hits, in seconds from its start: it is played off the floor's sight, as zone()
   *  lays it, stepped through to its end in one go, and every hit it makes (a burst, a flash, a shake) is noted with
   *  its intensity. scripts/area/measureStrikes.mjs writes src/engine/sim/areaStrikes.json from these. */
  async measure(id: string, radius = 4, seconds = 5): Promise<[number, number][] | undefined> {
    if (!(await this.ensure(id)) || this.disposed) return undefined;
    const instance = ARMORY_MANIFEST[id] ? this.acquire(id) as (ReturnType<FxStage['acquire']> & { onStrike?: (intensity: number) => void }) : null;
    if (!instance) return undefined;
    const { params, ctx } = this.zoneCast('area-measure', { effect: id }, new THREE.Vector3(0, -400, 0), radius);
    delete (params as { sound?: unknown }).sound;
    const hits: [number, number][] = [], frame = { ...this.frame, fighters: new Map(), flights: new Map() } as typeof this.frame;
    let age = 0;
    instance.onStrike = intensity => hits.push([+age.toFixed(3), +intensity.toFixed(2)]);
    try {
      instance.start(params, ctx);
      for (let k = 0; k < seconds * 60; k++) { frame.time = age; if (!instance.update(age, 1 / 60, frame)) break; age += 1 / 60; }
    } catch (error) { console.warn('armory: measuring', id, error); }
    instance.onStrike = undefined;
    try { instance.cancel('despawn'); } catch { /* already over */ }
    instance.release();
    return hits;
  }
  /** How zone() lays an effect at a circle's centre: its cue and its look, sized to the circle. */
  private zoneCast(casterId: string, fx: ForgeFx, at: THREE.Vector3, radius: number) {
    const entry = ARMORY_MANIFEST[fx.effect]!;
    const f = this.fighters.get(casterId), body = (f ? kitOwner(f)?.fighter ?? f.state?.fighter : undefined) ?? 'taisei';
    const heading = new THREE.Vector3(at.x - (f?.group.position.x ?? at.x), 0, at.z - (f?.group.position.z ?? at.z - 1));
    if (heading.lengthSq() < 1e-4) heading.set(0, 0, 1); else heading.normalize();
    const { macros, own } = splitSettings(fx.settings), height = heightOf(body);
    const ctx: CueContext & { anchor: EffectAnchor } = {
      seed: [...casterId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11), palette: STILL_ELEMENT, preset: `armory/${body}`,
      anchor: { point: at.clone(), fighter: casterId, socket: 'centre', follow: false, floor: at.y },
      tier: (this.kit.quality ?? 'high') as Tier, density: this.kit.density ?? 1, local: involvesLocal(casterId, undefined), actorId: casterId, heading,
    };
    const params: ArmoryParams = { lay: entry.cast === 'zone' ? 'zone' : 'target', reach: 1, radius, size: Math.max(.7, radius / 2.2) * height / 1.8 * (fx.scale ?? 1),
      height, speed: 40, sustain: .6, hold: 2.4, light: .4, sound: 'full', release: true, ...(fx.hue ? { hue: fx.hue } : {}), macros, ...(Object.keys(own).length ? { set: own } : {}) };
    return { params, ctx };
  }

  private nearest(playerId: string, f: Fighter) {
    let best: Fighter | undefined, d = Infinity;
    for (const [id, other] of this.fighters) {
      if (id === playerId || other.state?.alive === false) continue;
      const dist = other.group.position.distanceToSquared(f.group.position);
      if (dist < d) { d = dist; best = other; }
    }
    return best;
  }

  /** A cast from a body's hand (or worn on it), toward `target` or the way it faces. */
  private context(id: string, f: Fighter, target: Fighter | undefined): CueContext & { anchor: EffectAnchor } {
    const yaw = f.state?.yaw ?? 0, heading = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    if (target) { _q.subVectors(target.group.position, f.group.position); _q.y = 0; if (_q.lengthSq() > 1e-4) heading.copy(_q.normalize()); }
    const hand = (f as Fighter & { handR?: THREE.Vector3 }).handR;
    if (target && hand) _p.copy(hand); else bodyCentre(f, _p);
    const targetId = target ? [...this.fighters].find(([, other]) => other === target)?.[0] : undefined;
    return {
      seed: [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7), palette: STILL_ELEMENT, preset: `armory/${f.state?.fighter ?? 'forge'}`,
      anchor: { point: _p.clone(), fighter: id, socket: target && hand ? 'hand' : 'centre', follow: !target, floor: f.group.position.y },
      tier: (this.kit.quality ?? 'high') as Tier, density: this.kit.density ?? 1, local: involvesLocal(id, targetId), actorId: id, targetId, heading,
    };
  }

  reset() {
    this.director.reset();
    for (const worn of [...this.auras.values(), ...this.previews]) { worn.instance.cancel('despawn'); worn.instance.release(); }
    this.auras.clear(); this.previews.length = 0;
    this.last = undefined;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    this.director.dispose();
    this.registry.dispose();
  }
}

/** The slots a kit can give an effect, in order (forgeFx.ts reads them every frame for the drawn marks). */
export const FX_SLOTS = MOVE_SLOTS;
