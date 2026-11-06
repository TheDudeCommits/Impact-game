import * as THREE from 'three';
import { Bodies, type Body } from './bodies';
import { GROUND_TIERS, QualityWatch, type GroundQuality, type GroundTier } from './quality';
import { drawingHalf } from '../lenses';

/** What a ground layer is handed every frame. */
export interface GroundTick {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Seconds since the place was built, and since the last tick (clamped). */
  time: number;
  dt: number;
  bodies: readonly Body[];
  /** The lens's view this frame, for culling. */
  frustum: THREE.Frustum;
  /** Whether the view differs from the last tick's (a layer may keep its last cull while it does not). */
  viewMoved: boolean;
}

/** Each scene's ground frames, ticked from the scene's own onBeforeRender:
 *  hooked once a scene (chained, as the cosmetics layer's is), so what a frame
 *  sends the GPU of its own - the clump rows it uploads, the water's steps into
 *  their targets - goes before the scene's passes begin. Sent from inside the
 *  pass (a mesh's onBeforeRender, as the ground first did), it breaks the pass
 *  in two on a tiled GPU: the multisampled frame so far stored out to memory
 *  and loaded back to go on. */
const SCENE_FRAMES = new WeakMap<THREE.Scene, Set<GroundFrame>>();

function sceneFrames(scene: THREE.Scene) {
  let frames = SCENE_FRAMES.get(scene);
  if (frames) return frames;
  const set = frames = new Set<GroundFrame>();
  SCENE_FRAMES.set(scene, set);
  const before = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, s, camera, geometry, material, group) {
    before.call(this, renderer, s, camera, geometry, material, group);
    for (const frame of set) frame.beforeScene(renderer, scene, camera);
  };
  return set;
}

/**
 * A place's ground's clock, its fighters and its quality, ticked once a frame
 * before the scene's passes (its onBeforeRender, found from the ground's first
 * draw), so the ground needs no update call from the match: it runs while it
 * is shown and rests while it is not. Every layer reads the same tick. `time`
 * and `wind` are uniform objects the layers' shaders share.
 */
export class GroundFrame {
  readonly time = { value: 0 };
  /** Heading (x, z), strength, gust speed (m/s). */
  readonly wind = { value: new THREE.Vector4(.8, .6, .22, 3.5) };
  readonly bodies = new Bodies();
  readonly quality = new QualityWatch();
  private readonly layers: { tick(t: GroundTick): void; setQuality?(tier: GroundTier, quality: GroundQuality): void }[] = [];
  private readonly started = performance.now() / 1000;
  private last = -1;
  private frame = -1;
  private readonly tickInfo: GroundTick = { renderer: undefined!, scene: undefined!, camera: undefined!, time: 0, dt: 0, bodies: [], frustum: new THREE.Frustum(), viewMoved: true };
  private readonly view = new THREE.Matrix4();
  private readonly lastView = new THREE.Matrix4();
  /** Off: nothing ticks (a dev switch for costing the ground, see build.ts). */
  enabled = true;

  constructor(wind?: { heading: number; strength: number; gusts?: number }) {
    if (wind) this.wind.value.set(Math.sin(wind.heading), Math.cos(wind.heading), wind.strength, wind.gusts ?? 3.5);
  }

  get tier() { return GROUND_TIERS[this.quality.current]; }

  add(layer: { tick(t: GroundTick): void; setQuality?(tier: GroundTier, quality: GroundQuality): void }) { this.layers.push(layer); return layer; }

  /** The group the ground hangs in: it ticks while that is shown. */
  private owner?: THREE.Object3D;
  private scene?: THREE.Scene;

  watch(owner: THREE.Object3D) { this.owner = owner; }

  /** Dev: off, the ground ticks from its first draw inside the pass (as it
   *  first did), for costing where the work goes. */
  sceneHook = true;

  /** Tick from this object's draws (after whatever hook it already had: a
   *  place's own mesh can drive the ground too). The first draw finds the
   *  scene and ticks; from then on the scene's own hook ticks first, before
   *  the passes, and a draw finds the frame already ticked. */
  drive(object: THREE.Object3D) {
    const before = object.onBeforeRender, frame = this;
    object.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
      if (frame.sceneHook && (scene as THREE.Scene).isScene && scene !== frame.scene) frame.attach(scene as THREE.Scene);
      frame.tick(renderer, scene, camera);
      before.call(this, renderer, scene, camera, geometry, material, group);
    };
  }

  private attach(scene: THREE.Scene) {
    this.detach();
    this.scene = scene;
    sceneFrames(scene).add(this);
  }

  /** Off its scene's hook (the place released). */
  detach() {
    if (this.scene) SCENE_FRAMES.get(this.scene)?.delete(this);
    this.scene = undefined;
  }

  /** From the scene's hook: a tick, if the ground is shown in it. */
  beforeScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    for (let o: THREE.Object3D | null = this.owner ?? null; o; o = o.parent) {
      if (!o.visible) return;
      if (o !== scene) continue;
      this.tick(renderer, scene, camera);
      // A renderer that resets its counts itself does so after this hook, so
      // the draws that follow see the next frame number: they are this tick's.
      if (renderer.info.autoReset) this.frame = renderer.info.render.frame + 1;
      return;
    }
  }

  tick(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    // One tick a render of the scene: every ground mesh drawn in it shares it.
    const frame = renderer.info.render.frame;
    if (frame === this.frame || !this.enabled) return;
    this.frame = frame;
    // A split screen's second half (render/lenses.ts drawingHalf) draws the frame the first ticked, through another lens:
    // its tick is that lens's (what is culled, what is near) and nothing moves on. Reading the bodies again a moment after
    // the first tick found every one standing still, and the grass round the fight barely stirred in Player 2's half.
    const again = drawingHalf() === 1;
    const now = again ? this.time.value : performance.now() / 1000 - this.started;
    const dt = again ? 0 : this.last < 0 ? 1 / 60 : Math.min(.1, Math.max(0, now - this.last));
    if (!again) this.last = now;
    this.time.value = now;
    const rebuilt = !again && this.quality.poll();
    if (rebuilt) for (const layer of this.layers) layer.setQuality?.(this.tier, this.quality.current);
    const t = this.tickInfo;
    t.renderer = renderer; t.scene = scene; t.camera = camera; t.time = now; t.dt = dt;
    this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    t.viewMoved = !this.view.equals(this.lastView);
    if (t.viewMoved) { this.lastView.copy(this.view); t.frustum.setFromProjectionMatrix(this.view); }
    if (rebuilt) { t.viewMoved = true; }
    if (!again) t.bodies = this.bodies.update(scene, now);
    for (const layer of this.layers) layer.tick(t);
    // A layer's own render (the water's step) counts as a render of its own:
    // the rest of this one is still this tick's.
    this.frame = renderer.info.render.frame;
  }
}
