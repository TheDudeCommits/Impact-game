import * as THREE from 'three';
import { cutawayUniforms } from '../render/CameraCutaway';
import { occlusionUniforms } from '../render/OcclusionFade';
import { stageFadeUniforms } from '../render/StageFade';

/**
 * What a lens leaves behind it in the shaders: the follow camera writes the stage's cutaway round its own position and
 * the fades round its own player into uniforms every program shares (CameraCutaway, OcclusionFade, StageFade). One
 * screen has one lens and that is all it needs. A split screen draws two in one frame, so each half's are saved when its
 * camera has placed itself and put back just before that half is drawn (GameRenderer's `split.before`).
 *
 * Player 2's half has the cutaway of its own camera and the near fade round its own lens; the bodies its player stands
 * behind are faded by Player 1's camera alone (one fader runs: two would fight over the same bodies), so Player 2's half
 * leaves the screen-window fade and the stage-front fade out rather than drawing Player 1's.
 */
type Uniforms = Record<string, { value: unknown }>;
type Saved = Record<string, unknown>;
const copyOf = (value: unknown) => value instanceof THREE.Vector2 || value instanceof THREE.Vector3 || value instanceof THREE.Vector4 ? value.clone() : value;
function save(uniforms: Uniforms, into?: Saved): Saved {
  const out = into ?? {};
  for (const [key, u] of Object.entries(uniforms)) {
    const was = out[key];
    if (was && typeof (was as THREE.Vector3).copy === 'function' && u.value && typeof u.value === 'object') (was as THREE.Vector3).copy(u.value as THREE.Vector3);
    else out[key] = copyOf(u.value);
  }
  return out;
}
function put(uniforms: Uniforms, saved: Saved) {
  for (const [key, u] of Object.entries(uniforms)) {
    if (!(key in saved)) continue;
    const value = saved[key];
    if (u.value && typeof (u.value as THREE.Vector3).copy === 'function' && value && typeof value === 'object') (u.value as THREE.Vector3).copy(value as THREE.Vector3);
    else u.value = value;
  }
}

/** One half's saved lens state. */
export class ViewState {
  private cut?: Saved;
  private occ?: Saved;
  private stage?: Saved;
  /** Saves what the lens just placed (call right after its camera's update). `own`: this half's camera ran its own fader
   *  (Player 1's); otherwise only the near fade is moved to `eye`, and the window and stage fades are left out. */
  capture(own: boolean, eye?: THREE.Vector3) {
    this.cut = save(cutawayUniforms as unknown as Uniforms, this.cut);
    this.occ = save(occlusionUniforms as unknown as Uniforms, this.occ);
    this.stage = save(stageFadeUniforms as unknown as Uniforms, this.stage);
    if (!own) {
      if (eye) (this.occ.uOccEye as THREE.Vector3).copy(eye);
      (this.occ.uOccRect as THREE.Vector4).set(2, 2, 2, 2); this.occ.uOccRectDepth = 0;
      this.stage.uStageOn = 0;
    }
  }
  /** Puts this half's lens state back. */
  apply() {
    if (this.cut) put(cutawayUniforms as unknown as Uniforms, this.cut);
    if (this.occ) put(occlusionUniforms as unknown as Uniforms, this.occ);
    if (this.stage) put(stageFadeUniforms as unknown as Uniforms, this.stage);
  }
}
