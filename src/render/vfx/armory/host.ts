import * as THREE from 'three';
import { sceneShown } from '../../emptyInstances';
import { frame } from './withheld';
import { LAYER } from './withheld';
import { ParticleEngine } from './withheld';
import { DecalSystem } from './withheld';
import { BurstSystem } from './withheld';
import { FissureSystem } from './withheld';
import { sceneHooks } from './withheld';
import { settings } from './withheld';
import { patchOnBeforeCompile } from './withheld';
import { noiseGLSL } from './withheld';
import type { EffectLayer } from '../engine/Effect';
import type { Fighter } from '../../Fighter';
import { effekseerLoaded } from './effekseer';
import { skipHiddenChildren } from '../../hiddenMatrices';
import { VFX } from '../../vfxLevel';
import type { ArmoryContext, ArmoryFlashApi, ArmoryLightHandle, ArmoryLightsApi, ArmoryShakeApi } from './types';


/** The game camera's layer: everything an Armory effect draws is moved onto it. */
export const GAME_LAYER = 0;

/** The Armory frames its effects from eleven metres back; the game's camera rides a few metres behind the fighter, so
 *  a flash at the caster, a sphere round it or a ball flying past is right at its lens and fills the screen. Every
 *  see-through Armory material fades out over these distances from the camera (metres, near to far), as the game's own
 *  dash afterimages do. */
const LENS = { value: new THREE.Vector2(.5, 2.2) };
const MAIN = /void\s+main\s*\(\s*(?:void\s*)?\)/;
/** The Armory's noise library (snoise, fbm3, curlNoise...): in the Armory a scene-wide patch on every standard material
 *  (its scene hooks' ageing) brings it, and a few effects' patches (the verdant growth, hail) call it without including
 *  it themselves. The game installs no such patch, so a material that calls it without it gets it here. */
const NOISE_FNS = [...String(noiseGLSL).matchAll(/\b(?:float|vec[234])\s+(\w+)\s*\(/g)].map(m => m[1]);
const NOISE_DEFINED = new RegExp(`\\b(?:float|vec[234])\\s+(?:${NOISE_FNS.join('|')})\\s*\\(`);
function ensureNoise(shader: { vertexShader: string; fragmentShader: string }) {
  for (const stage of ['vertexShader', 'fragmentShader'] as const) {
    const src = shader[stage];
    if (src.includes('#include <common>') && NOISE_FNS.some(fn => src.includes(`${fn}(`)) && !NOISE_DEFINED.test(src)) shader[stage] = src.replace('#include <common>', `#include <common>\n${noiseGLSL}`);
  }
}

/** The fade, wrapped round a fragment shader's own main (whatever order its functions are in). */
function lensFade(shader: { uniforms: Record<string, unknown>; fragmentShader: string }) {
  const src = shader.fragmentShader;
  if (!MAIN.test(src) || !(src.includes('gl_FragColor') || src.includes('_fragment>'))) return;
  shader.uniforms.armoryLens = LENS;
  shader.uniforms.armoryNear = frame.uCameraNear;
  shader.uniforms.armoryFar = frame.uCameraFar;
  shader.fragmentShader = `uniform vec2 armoryLens;\nuniform float armoryNear;\nuniform float armoryFar;\n${src.replace(MAIN, 'void armoryLensMain()')}
void main() {
  armoryLensMain();
  float armoryDepth = (armoryNear * armoryFar) / (armoryFar - gl_FragCoord.z * (armoryFar - armoryNear));
  gl_FragColor *= smoothstep(armoryLens.x, armoryLens.y, armoryDepth);
}
`;
}
const GAME_MASK = 1 << GAME_LAYER, DISTORTION_MASK = 1 << LAYER.DISTORTION;

/** Make one node the Armory built draw in the game: onto the game camera's layer (the distortion proxies stay off it),
 *  double-sided transparents in one pass (three r186 otherwise draws them twice and flips `needsUpdate` every frame),
 *  and its materials on `clock` (a space's), each patched once (`adapted`). */
function adaptNode(node: THREE.Object3D, adapted: WeakSet<object>, clock?: { value: number }, delta?: { value: number }) {
  const mask = node.layers.mask;
  if (mask !== GAME_MASK && mask !== DISTORTION_MASK) node.layers.set(GAME_LAYER);
  const mesh = node as THREE.Mesh;
  if (!mesh.material) return;
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    if (adapted.has(material)) continue;
    adapted.add(material);
    if (material.transparent && material.side === THREE.DoubleSide) material.forceSinglePass = true;
    // (A raw shader writes its own output, an opaque one would only go black, and a screen overlay drawn without the
    // depth test, the ki lens, is the screen's own: none is faded.)
    if (material.transparent && material.depthTest !== false && !(material as THREE.RawShaderMaterial).isRawShaderMaterial) patchOnBeforeCompile(material, lensFade);
    if (!(material as THREE.RawShaderMaterial).isRawShaderMaterial && !(material as THREE.ShaderMaterial).isShaderMaterial) patchOnBeforeCompile(material, ensureNoise);
    const uniforms = (material as THREE.ShaderMaterial).uniforms;
    if (uniforms && clock && delta) {
      if (uniforms.uTime === frame.uTime) uniforms.uTime = clock;
      if (uniforms.uDelta === frame.uDelta) uniforms.uDelta = delta;
    }
  }
}

/** Renderers an Armory kit keeps for all of its effects, one a page, which it puts in the scene of whichever effect it
 *  was built for last: three.quarks' BatchedRenderer (the fxlib `qk_*` pack's QuarksSystem), which draws every system
 *  of every space in one batch, at the world's origin. In the game the host keeps it (`ArmoryHost.share`). */
const SHARED = new Set(['fxlib:QuarksBatch']);
/** A shared renderer's own `update`, before the host made it once a frame. */
const OWN_UPDATE = Symbol('armory.ownUpdate');

const hosts = new WeakMap<THREE.Scene, ArmoryHost>();
const hooked = new WeakSet<THREE.Scene>();
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector2();

/** The scene's own onBeforeRender, chained once a scene (as ground/frame.ts and the cosmetics layer chain it): the
 *  renderer and camera of the frame, for the camera stand-in and the screen size. */
function hook(scene: THREE.Scene) {
  if (hooked.has(scene)) return;
  hooked.add(scene);
  const before = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, s, camera, geometry, material, group) {
    before.call(this, renderer, s, camera, geometry, material, group);
    hosts.get(scene)?.seen(renderer, camera);
  };
}

/** One light the Armory asked for: where, what colour, how strong (eased as the Armory's LightPool eases). */
interface LightSlot { inUse: boolean; target: number; intensity: number; distance: number; readonly position: THREE.Vector3; readonly color: THREE.Color }
const LIGHT_SLOTS = 4;

/** `ctx.lights` for one space: the Armory's LightPool API, with no light of its own. `flush` asks the game's pool. */
export class SpaceLights implements ArmoryLightsApi {
  readonly slots: LightSlot[] = Array.from({ length: LIGHT_SLOTS }, () => ({ inUse: false, target: 0, intensity: 0, distance: 1, position: new THREE.Vector3(), color: new THREE.Color() }));
  acquire(): ArmoryLightHandle {
    for (const slot of this.slots) if (!slot.inUse) { slot.inUse = true; slot.target = 0; slot.intensity = 0; return slot; }
    return null;
  }
  set(handle: ArmoryLightHandle, position: THREE.Vector3, color: THREE.Color, intensity: number, distance: number, dt: number) {
    const slot = handle as LightSlot | null;
    if (!slot) return;
    slot.position.copy(position); slot.color.copy(color);
    slot.target = intensity * settings.global.lightIntensity;
    slot.intensity = THREE.MathUtils.lerp(slot.target, slot.intensity, Math.pow(.0005, dt));
    slot.distance = distance * settings.global.lightRadius;
  }
  release(handle: ArmoryLightHandle) { const slot = handle as LightSlot | null; if (slot) { slot.inUse = false; slot.target = 0; } }
  /** Released lights fade instead of cutting (the Armory's). */
  update(dt: number) { for (const slot of this.slots) if (!slot.inUse && slot.intensity > .001) slot.intensity = THREE.MathUtils.lerp(0, slot.intensity, Math.pow(.0001, dt)); }
  reset() { for (const slot of this.slots) { slot.inUse = false; slot.target = 0; slot.intensity = 0; } }
  dispose() { this.reset(); }
  /** Ask the game's pool for every light still burning, placed through `matrix` (the space's), scaled by `gain`. */
  flush(matrix: THREE.Matrix4, request: ((x: number, y: number, z: number, hex: number, intensity: number, distance: number) => void) | undefined, gain = 1, reach = 1) {
    if (!request) return;
    for (const slot of this.slots) {
      if (slot.intensity <= .02) continue;
      _v.copy(slot.position).applyMatrix4(matrix);
      request(_v.x, _v.y, _v.z, slot.color.getHex(), slot.intensity * gain, slot.distance * reach);
    }
  }
}


/** The fighters an instance's cast sees this frame, and who threw it (effect.ts sets them as it places and steps it):
 *  what the extended pack's practice targets stand in for (extendedField.ts). */
export interface SpaceBodies { fighters: ReadonlyMap<string, Fighter>; actor?: string }
const spacesByContext = new WeakMap<object, ArmorySpace>();
/** The space an ability's context belongs to. */
export function spaceOfContext(ctx: object): ArmorySpace | undefined { return spacesByContext.get(ctx); }

/** One effect instance's own Armory world. Built once, at load; reused for every cast of its instance. */
export class ArmorySpace {
  /** Placed by the instance every frame (`place`): the Armory's world into the game's. */
  readonly root = new THREE.Group();
  readonly ctx: ArmoryContext;
  readonly particles: { flush(): void; reset(): void; dispose(): void; systems: Map<string, unknown> };
  readonly decals: { spawn(type: unknown, position: THREE.Vector3, options?: Record<string, unknown>): unknown; update(dt: number): void; clear(): void; dispose(): void; pools: Map<unknown, { free: { mesh: THREE.Object3D }[] }>; group: THREE.Group; _poolFor(type: unknown): { acquire(): { mesh: THREE.Object3D }; release(item: unknown): void; free: unknown[] } };
  readonly bursts: { spawn(mode: unknown, position: THREE.Vector3, options?: Record<string, unknown>): unknown; update(dt: number): void; clear(): void; dispose(): void; pools: Map<unknown, { free: { mesh: THREE.Object3D }[] }>; group: THREE.Group; _poolFor(mode: unknown): { acquire(): { mesh: THREE.Object3D }; release(item: unknown): void; free: unknown[] } };
  readonly fissures: { update(dt: number): void; clear(): void; dispose(): void; pool: { acquire(): { group: THREE.Object3D }; release(item: unknown): void; free: { group: THREE.Object3D }[] }; group: THREE.Group };
  readonly lights = new SpaceLights();
  /** This space's `uTime` and `uDelta`: every material in it reads them instead of the Armory's global boxes. */
  readonly clock = { value: 0 };
  readonly delta = { value: 0 };
  /** The game camera, as seen from this space's frame (the Armory reads `ctx.camera`; it never gets the real one). */
  readonly camera = new THREE.PerspectiveCamera();
  /** Where the instance would like a screen flash to go (effect.ts sets it per cast); none: no flash. */
  flashTo?: (color: THREE.Color, strength: number) => void;
  /** A hit the effect made (a burst, a flash, a shake), at the Armory sound director's intensity: its sound (effect.ts). */
  onHit?: (intensity: number) => void;
  /** The fighters its cast sees, and its thrower (effect.ts). */
  bodies?: SpaceBodies;
  /** The Armory frames its effects from eleven metres up and back; the game's camera rides a few metres behind the
   *  fighter. An impact shell (BurstSphere) at the Armory's size fills the game's frame, so a space draws its bursts'
   *  radii and opacity, and its ground decals' radii, at these scales (effect.ts sets them per cast). */
  burstScale = 1;
  burstOpacity = 1;
  decalScale = 1;
  private readonly burstOptions: Record<string, unknown> = {};
  private readonly decalOptions: Record<string, unknown> = {};
  private readonly held: { release(): void }[] = [];
  private readonly adapted = new WeakSet<object>();
  /** The three.quarks emitters (the fxlib `qk_*` pack's) built in this space, and whether they are drawn now. */
  private readonly emitters = new Set<THREE.Object3D>();
  private drawing = false;

  constructor(readonly host: ArmoryHost, name: string) {
    this.root.name = `armory-space:${name}`;
    this.root.matrixAutoUpdate = false;
    this.root.visible = false;
    host.root.add(this.root);
    this.particles = new ParticleEngine(this.root);
    this.decals = new DecalSystem(this.root);
    this.bursts = new BurstSystem(this.root);
    this.fissures = new FissureSystem(this.root);
    const spawnBurst = this.bursts.spawn.bind(this.bursts), spawnDecal = this.decals.spawn.bind(this.decals);
    this.bursts.spawn = (mode, position, options = {}) => {
      this.onHit?.(.5);
      const o = this.burstOptions;
      for (const key in o) delete o[key];
      Object.assign(o, options);
      o.radius = ((options.radius as number | undefined) ?? .4) * this.burstScale;
      o.endRadius = ((options.endRadius as number | undefined) ?? 3) * this.burstScale;
      o.opacity = ((options.opacity as number | undefined) ?? 1) * this.burstOpacity;
      return spawnBurst(mode, position, o);
    };
    this.decals.spawn = (type, position, options = {}) => {
      const o = this.decalOptions;
      for (const key in o) delete o[key];
      Object.assign(o, options);
      o.radius = ((options.radius as number | undefined) ?? 2) * this.decalScale;
      return spawnDecal(type, position, o);
    };
    const flash: ArmoryFlashApi = { trigger: (color, strength) => { this.onHit?.(Math.min(3, strength ?? 0)); this.flashTo?.(color, strength); }, update() {}, reset() {} };
    // The Armory's camera shake: the game has no shake an effect may add to (see the header), so it moves nothing; it
    // only tells the sound of a hit, as the Armory's director hears one.
    const shake: ArmoryShakeApi = { add: amount => this.onHit?.(Math.min(3, amount ?? 0)), rumble() {}, update() {}, reset() {} };
    // The Armory's environment, as its effects use it: the scene they draw in, and its shadow-caster hooks (the Armory's
    // own only patch the material's shader; the game's lighting is its own). No HDR to borrow (`equirect`).
    const environment = {
      scene: this.root, equirect: null,
      registerShadowCaster: <M>(material: M) => material,
      registerShadowCasterWithPatch: <M>(material: M, patch: unknown) => { patchOnBeforeCompile(material, patch); patchOnBeforeCompile(material, ensureNoise); return material; },
    };
    this.ctx = {
      scene: this.root, camera: this.camera, environment,
      particles: this.particles, lights: this.lights, decals: this.decals, fissures: this.fissures, bursts: this.bursts,
      shake, flash,
    };
    spacesByContext.set(this.ctx, this);
  }

  /** Make what the Armory built in this space draw in the game (`adaptNode`). The layers are put right every time (the
   *  p27 pack moves its whole group back onto the Armory's VFX layer each update); a material is patched once. A kit's
   *  renderer for all its effects (`SHARED`) is handed to the host, and the three.quarks systems found here are drawn
   *  while the space is (`show`). */
  adapt() {
    for (const child of this.root.children) if (SHARED.has(child.name)) { this.host.share(child); break; }
    this.root.traverse(node => {
      adaptNode(node, this.adapted, this.clock, this.delta);
      if (node.type === 'ParticleEmitter' && !this.emitters.has(node)) this.emitters.add(node);
    });
    this.syncEmitters();
    this.host.adaptShared();
  }

  /** Shown for a cast, hidden between casts. */
  show(visible: boolean) {
    this.root.visible = visible;
    this.syncEmitters();
    // (Its empty pools left out of the frame's draw from the next frame: emptyInstances.ts.)
    if (visible) sceneShown();
  }

  /** The shared three.quarks batch draws every system whose emitter is visible, wherever its space is: a space's
   *  emitters are shown and hidden with it (the warm instance's cast left standing, or a space between casts, draws
   *  nothing there), and the batch is drawn only while a space with some is shown. */
  private syncEmitters() {
    for (const emitter of this.emitters) emitter.visible = this.root.visible;
    const drawing = this.root.visible && this.emitters.size > 0;
    if (drawing !== this.drawing) { this.drawing = drawing; this.host.drawShared(drawing ? 1 : -1); }
  }

  /** The Armory's per-frame order after its abilities' update: particles, decals, fissures, bursts, lights. */
  step(dt: number) {
    this.particles.flush();
    this.decals.update(dt);
    this.fissures.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);
  }

  /** Keep one of every decal, burst and fissure the dry run made in the scene, hidden, so the room's load-time compile
   *  links their programs (a released one is taken out of the scene). Given back with `unhold`. */
  hold() {
    const keep = (pool: { acquire(): unknown; release(item: unknown): void; free: unknown[] }, object: (item: unknown) => THREE.Object3D, parent: THREE.Object3D) => {
      if (!pool.free.length) return;
      const item = pool.acquire(), o = object(item);
      o.visible = false; parent.add(o);
      this.held.push({ release: () => pool.release(item) });
    };
    for (const type of this.decals.pools.keys()) keep(this.decals._poolFor(type), item => (item as { mesh: THREE.Object3D }).mesh, this.decals.group);
    for (const mode of this.bursts.pools.keys()) keep(this.bursts._poolFor(mode), item => (item as { mesh: THREE.Object3D }).mesh, this.bursts.group);
    keep(this.fissures.pool, item => (item as { group: THREE.Object3D }).group, this.fissures.group);
    this.adapt();
  }
  unhold() { for (const h of this.held.splice(0)) h.release(); }

  /** Everything this space drew, gone at once (a cast cut short, a room reset). */
  clear() {
    this.particles.reset();
    this.decals.clear();
    this.bursts.clear();
    this.fissures.clear();
    this.lights.reset();
  }

  /** Point `camera` at the game camera as seen from this space (its inverse placement). */
  see(game: THREE.Camera | undefined) {
    if (!game) return;
    _m.copy(this.root.matrixWorld).invert().multiply(game.matrixWorld);
    _m.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
    const p = game as THREE.PerspectiveCamera;
    if (p.isPerspectiveCamera) { this.camera.fov = p.fov; this.camera.aspect = p.aspect; this.camera.near = p.near; this.camera.far = p.far; }
    this.camera.projectionMatrix.copy(game.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(game.projectionMatrixInverse);
    this.camera.updateMatrixWorld(true);
  }

  dispose() {
    this.unhold();
    this.clear();
    this.particles.dispose(); this.decals.dispose(); this.bursts.dispose(); this.fissures.dispose();
    // Out of the shared batch too, which outlives the scene (it is the kit's): it would keep them, and this space, alive.
    this.show(false);
    for (const emitter of this.emitters) (emitter as THREE.Object3D & { system?: { dispose?(): void } }).system?.dispose?.();
    this.emitters.clear();
    // What the ability built straight into this space (its meshes' buffers and materials): the systems above dispose their
    // own. A buffer or material another space still draws is uploaded again at its next draw (three).
    this.root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine) return;
      mesh.geometry?.dispose();
      for (const material of [mesh.material].flat()) material?.dispose();
    });
    this.root.removeFromParent();
  }
}

/** A stand-in for the Armory's character (`window.__armory.app.character`, which the ext pack's self-buffs read through
 *  their CharacterLink): the fighter being drawn, in the space's frame, set while its instance updates. */
export interface ArmoryCharacter { position: THREE.Vector3; facing: number; height: number; model: THREE.Object3D | null; root: THREE.Object3D | null }

export class ArmoryHost implements EffectLayer {
  /** The scene's host, built by the first to ask; each `for` is matched by a `dispose`. */
  static for(scene: THREE.Scene) {
    let host = hosts.get(scene);
    if (!host) { host = new ArmoryHost(scene); hosts.set(scene, host); }
    host.refs++;
    return host;
  }
  readonly root = new THREE.Group();
  /** The scene's `armory/<id>` types (runtime.ts), made once each and gone with the host. */
  readonly types = new Map<string, unknown>();
  /** The game camera and renderer of the last frame drawn (none before the first). */
  gameCamera?: THREE.Camera;
  renderer?: THREE.WebGLRenderer;
  /** "Nothing in front": the soft particles' depth, as the game has no depth prepass. */
  readonly depth: THREE.DataTexture;
  readonly character: ArmoryCharacter = { position: new THREE.Vector3(), facing: 0, height: 1.8, model: null, root: null };
  private refs = 0;
  private readonly begun = new Set<object>();
  /** Frames begun (`begin`), for the shared renderers' once-a-frame step. */
  private frames = 0;
  private readonly shared = new Set<THREE.Object3D>();
  private readonly sharedAdapted = new WeakSet<object>();
  /** Spaces shown now with systems drawn through the shared renderers: drawn only while there are any. */
  private sharedDrawn = 0;
  private key?: THREE.DirectionalLight;
  private keySearch = 0;
  private readonly spaces = new Set<ArmorySpace>();

  private constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'armory';
    // A space between its casts (and the warm one, always) is hidden and nobody reads into it: the frame's matrix pass
    // leaves it alone (hiddenMatrices.ts). In a twelve-fighter royale the spaces held 3,100 of the scene's 6,700 nodes.
    // Shown for a cast, a space is recomputed whole by the next pass; the matrices the cast's first step reads before
    // that are the ones kept by hand (a space's root, the caster stand-in's joints: effect.ts).
    skipHiddenChildren(this.root);
    scene.add(this.root);
    hook(scene);
    this.depth = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.depth.needsUpdate = true;
    frame.uSceneDepth.value = this.depth;
    // Nothing of the game's world is lent to the Armory's scene hooks (see the header).
    sceneHooks.install({});
    if (typeof window === 'object' && window) {
      const w = window as unknown as { __armory?: { app?: { character?: ArmoryCharacter } } };
      // Only where the Armory's own page isn't (it owns `__armory` there).
      if (!w.__armory) w.__armory = { app: { character: this.character } };
    }
  }

  /** A new space for an instance (at load). */
  space(name: string) { const space = new ArmorySpace(this, name); this.spaces.add(space); return space; }
  /** A space let go (ArmoryEffectType.dispose): no longer reset or disposed with the host. */
  dropSpace(space: ArmorySpace) { this.spaces.delete(space); }

  /** The effect types an earlier room built and this one does not draw (`keep`: the ids it does), let go - each type's pool and
   *  warm instance disposed, space by space (ArmoryEffectType.dispose) - and out of `types`. Returns the ids dropped. Called
   *  as a room is entered (never in a fight: a cast in the air would lose its meshes); a type wanted again is built again
   *  (runtime.ts, fxStage.ts), its chunk from the module cache. After five twelve-fighter matches in one page the host held 46
   *  types and 222 instances, 15,200 scene objects, 49 MB of heap and the buffers of 53 geometries more than three matches
   *  needed (scripts/night/load_hitches.mjs `chain --gc`). */
  retainTypes(keep: ReadonlySet<string>): string[] {
    const dropped: string[] = [];
    for (const [id, type] of [...this.types]) {
      if (keep.has(id)) continue;
      try { (type as { dispose?(): void }).dispose?.(); } catch (error) { console.warn(`armory: ${id} could not be let go`, error); }
      this.types.delete(id); dropped.push(id);
    }
    return dropped;
  }

  /** A kit's renderer for all its effects (`SHARED`), out of the space that built an effect into the host's root: at the
   *  world's origin (it draws in world space) and always in the scene, while each space hides its own systems
   *  (`ArmorySpace.show`). It steps once a frame: the kit steps it from every cast it has playing, which it tells apart
   *  by the clock, and each space here keeps its own. */
  share(object: THREE.Object3D) {
    this.root.add(object);
    object.visible = this.sharedDrawn > 0;
    if (this.shared.has(object)) return;
    this.shared.add(object);
    const o = object as THREE.Object3D & { update?: (dt: number) => void; [OWN_UPDATE]?: (dt: number) => void };
    const own = o[OWN_UPDATE] ??= o.update;
    if (typeof own !== 'function') return;
    let stepped = -1;
    o.update = (dt: number) => { if (stepped === this.frames) return; stepped = this.frames; own.call(o, dt); };
  }

  /** A space with systems in the shared renderers shown (1) or hidden (-1). */
  drawShared(change: number) {
    this.sharedDrawn = Math.max(0, this.sharedDrawn + change);
    for (const object of this.shared) object.visible = this.sharedDrawn > 0;
  }

  /** The shared renderers' meshes onto the game camera's layer, every time (the kit puts them back on its own each
   *  step), their materials patched as a space's are (they keep no Armory clock). */
  adaptShared() { for (const object of this.shared) object.traverse(node => adaptNode(node, this.sharedAdapted)); }

  /** What the effects built in this scene still load (their images, an Effekseer effect's files): resolved when it is
   *  all in, or after `cap` milliseconds. The Forge's first try of an effect waits for it (fxStage.ts), so the effect
   *  plays whole instead of popping in (or, an Effekseer one, missing its moment). */
  loaded(cap: number, effekseer = true): Promise<void> {
    // `effekseer: false`: images only. The Effekseer runtime starts on the first frame drawn with the game's camera, so a
    // room's load (no frame yet) would wait out the whole cap for it (fxStage.ts `warm`).
    const waits: Promise<unknown>[] = effekseer ? [effekseerLoaded(this, performance.now() + cap)] : [], seen = new WeakSet<object>();
    const image = (value: unknown) => {
      const texture = value as { isTexture?: boolean; image?: unknown } | null | undefined;
      if (!texture?.isTexture || seen.has(texture)) return;
      seen.add(texture);
      const img = texture.image as { complete?: boolean; addEventListener?: (type: string, f: () => void, o: object) => void } | undefined;
      if (img?.complete === false && typeof img.addEventListener === 'function')
        waits.push(new Promise<void>(resolve => { img.addEventListener!('load', resolve, { once: true }); img.addEventListener!('error', resolve, { once: true }); }));
    };
    this.root.traverse(node => {
      const material = (node as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const value of Object.values(m)) image(value);
        for (const uniform of Object.values((m as THREE.ShaderMaterial).uniforms ?? {})) {
          const value = (uniform as { value?: unknown } | undefined)?.value;
          if (Array.isArray(value)) value.forEach(image); else image(value);
        }
      }
    });
    return Promise.race([Promise.all(waits).then(() => undefined), new Promise<void>(resolve => setTimeout(resolve, cap))]);
  }

  /** The renderer's frame, from the scene's onBeforeRender. */
  seen(renderer: THREE.WebGLRenderer, camera: THREE.Camera) { this.renderer = renderer; this.gameCamera = camera; }

  /** Once a frame, however many registries draw Armory effects: the frame uniforms, as the Armory's App sets them before
   *  its abilities update (the clock is each space's own). */
  begin(_time: number, owner: object = this) {
    if (this.begun.size !== 0 && !this.begun.has(owner)) { this.begun.add(owner); return; }
    this.begun.clear(); this.begun.add(owner);
    this.frames++;
    if (this.renderer) { this.renderer.getDrawingBufferSize(_s); if (_s.x > 0) frame.uResolution.value.set(_s.x, _s.y); }
    const camera = this.gameCamera as THREE.PerspectiveCamera | undefined;
    if (camera?.isPerspectiveCamera) { frame.uCameraNear.value = camera.near; frame.uCameraFar.value = camera.far; }
    frame.uShaderIntensity.value = settings.global.shaderIntensity;
    // VISUAL EFFECTS (render/vfxLevel.ts): the level's share of the effects' glow, and of their opacity where they read
    // the global one; 1 at Full. (Their lights reach the game's light pool, which takes the level's share of them.)
    frame.uGlobalGlow.value = settings.global.glow * VFX.glow;
    settings.global.opacity = VFX.armoryOpacity;
    frame.uSceneDepth.value = this.depth;
    // The key light's direction, wherever the stage's look put it (VfxKit finds it the same way).
    if (!this.key && (this.keySearch++ % 120) === 0) this.scene.traverse(o => { if (!this.key && (o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow) this.key = o as THREE.DirectionalLight; });
    if (this.key) { _v.copy(this.key.position).sub(this.key.target.position); if (_v.lengthSq() > 1e-6) frame.uLightDir.value.copy(_v.normalize()); }
    // The scene hooks' lease sweep (nothing is installed, so nothing in the world changes).
    sceneHooks.apply();
  }
  end(_owner?: object) {}
  /** A room reset: every space emptied. */
  reset() { for (const space of this.spaces) space.clear(); }
  dispose() {
    if (--this.refs > 0) return;
    hosts.delete(this.scene);
    for (const space of this.spaces) space.dispose();
    this.spaces.clear();
    this.types.clear();
    for (const object of this.shared) object.removeFromParent();
    this.shared.clear();
    this.root.removeFromParent();
    this.depth.dispose();
  }
}
