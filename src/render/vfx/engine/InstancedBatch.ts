import * as THREE from 'three';

/**
 * One fixed-capacity instanced draw, refilled every frame: the batch the signature modules each paste in.
 *
 * Fifty-six signature modules carry their own copy of this class (IceBatch in TokanIce, StokedBatch in
 * BellowsStoked, FrostBatch, PhosphorBatch...): a per-instance vec4 tint (colour and alpha) on the geometry,
 * `begin` / `add` / `end`, a capacity it never passes, frustum culling off (the instances are placed in world space),
 * `dispose`. This is that class once, with the best of the copies folded in:
 *  - only the occupied prefix is uploaded each frame (update ranges, as SignaturePoolUpload and GlowBatch do);
 *  - an empty batch is hidden once it has been drawn once (kept visible until then, so its program is linked at load
 *    and its first real frame is not its first draw), so an idle batch costs no draw call;
 *  - an optional second per-instance vec4 (`data`) for seeds, birth flashes and modes;
 *  - an optional clock uniform set by `begin(time)`.
 * The modules are not moved onto it here; new effects (render/vfx/engine/) use it.
 */
export interface InstancedBatchOptions {
  /** The mesh's name (`ice-crystals`): what the scene and the tests find it by. */
  name: string;
  geometry: THREE.BufferGeometry;
  /** Reads the tint as `attribute vec4 <tint>`, and the data as `attribute vec4 <data>` when there is one. */
  material: THREE.ShaderMaterial;
  capacity: number;
  /** The tint attribute's name in the shader. Default `batchTint`. */
  tint?: string;
  /** A second per-instance vec4's name, if the shader wants one. */
  data?: string;
  /** A uniform `begin(time)` sets, e.g. `uTime`. */
  clock?: string;
  /** Default 3, with the other signature batches: after the room and the fighters. */
  renderOrder?: number;
  /** Instances fainter than this are skipped. Default .003. */
  minAlpha?: number;
  /** Whether disposing the batch disposes the geometry and the material too (default true: it owns them). */
  owns?: boolean;
}

export class InstancedBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly capacity: number;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly data?: THREE.InstancedBufferAttribute;
  private readonly attributes: THREE.BufferAttribute[];
  private readonly ranges: { start: number; count: number }[];
  private readonly matrix = new THREE.Matrix4();
  private readonly size = new THREE.Vector3();
  private readonly clock?: THREE.IUniform;
  private readonly minAlpha: number;
  private readonly owns: boolean;
  private used = 0;
  private drawn = false;
  private disposed = false;
  constructor(parent: THREE.Object3D | null, options: InstancedBatchOptions) {
    const { geometry, material } = options;
    this.capacity = Math.max(1, Math.floor(options.capacity));
    this.minAlpha = options.minAlpha ?? .003;
    this.owns = options.owns ?? true;
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(options.tint ?? 'batchTint', this.tint);
    if (options.data) {
      this.data = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(options.data, this.data);
    }
    material.forceSinglePass = true;
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.name = options.name;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = options.renderOrder ?? 3;
    this.mesh.count = 0;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.mesh.onAfterRender = () => { this.drawn = true; };
    this.clock = options.clock ? material.uniforms[options.clock] : undefined;
    this.attributes = [this.mesh.instanceMatrix, this.tint, ...(this.data ? [this.data] : [])];
    this.ranges = this.attributes.map(() => ({ start: 0, count: 0 }));
    parent?.add(this.mesh);
  }

  /** How many instances this frame has added so far. */
  get count() { return this.used; }
  get full() { return this.used >= this.capacity; }

  /** Start a frame: empty, and the clock set. */
  begin(time?: number) {
    this.used = 0;
    if (time !== undefined && this.clock) this.clock.value = time;
  }

  /** One instance at `p`, turned `q`, scaled (sx, sy, sz), in `color` (linear) at `alpha`, with the data vec4 when the
   *  batch has one. False when it was not added: the batch is full, or the instance is invisible. */
  add(p: THREE.Vector3, q: THREE.Quaternion, sx: number, sy: number, sz: number, color: { r: number; g: number; b: number }, alpha: number, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
    if (this.used >= this.capacity || !(alpha >= this.minAlpha) || !(Math.min(sx, sy, sz) > 0)) return false;
    const i = this.used++;
    this.matrix.compose(p, q, this.size.set(sx, sy, sz));
    this.mesh.setMatrixAt(i, this.matrix);
    this.tint.setXYZW(i, color.r, color.g, color.b, alpha > 1 ? 1 : alpha);
    this.data?.setXYZW(i, d0, d1, d2, d3);
    return true;
  }

  /** One instance from a matrix already composed. */
  addMatrix(matrix: THREE.Matrix4, color: { r: number; g: number; b: number }, alpha: number, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
    if (this.used >= this.capacity || !(alpha >= this.minAlpha)) return false;
    const i = this.used++;
    this.mesh.setMatrixAt(i, matrix);
    this.tint.setXYZW(i, color.r, color.g, color.b, alpha > 1 ? 1 : alpha);
    this.data?.setXYZW(i, d0, d1, d2, d3);
    return true;
  }

  /** Close the frame: draw what was added, upload only that. */
  end() {
    const count = this.used;
    this.mesh.count = count;
    this.mesh.visible = count > 0 || !this.drawn;
    if (count === 0) return;
    for (let i = 0; i < this.attributes.length; i++) {
      const attribute = this.attributes[i], range = this.ranges[i];
      range.start = 0; range.count = count * attribute.itemSize;
      attribute.clearUpdateRanges(); attribute.updateRanges.push(range); attribute.needsUpdate = true;
    }
  }

  /** Nothing drawn. */
  clear() { this.begin(); this.end(); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    if (this.owns) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
  }
}
