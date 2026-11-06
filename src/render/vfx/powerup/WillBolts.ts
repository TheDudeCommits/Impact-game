import * as THREE from 'three';
import { BoltBatch } from '../../signature/BoltBatch';
import { LightningPainter, type BoltStyle } from '../../signature/Lightning';

/** The power-up pass: Crimson Command as Dust Sea draws it - lightning that is black, not light: a jagged ink stroke
 *  outlined in crimson, crackling round a sovereign, across the floor and into the air.
 *
 *  The signature kit's bolts (BoltBatch) are light: a white-hot core blended by MAX, which can only brighten. These are
 *  the same capsule segments and the same painter (LightningPainter: midpoint displacement, re-forked on a seed), drawn
 *  three times from the one instance buffer. First the glow, blended by MAX as the kit's is, so a bolt's overlapping
 *  segments read as one stroke; then the edge's colour as a flat band over it; then the black inside that. The band
 *  and the ink are printed, not added, and each in a pass of its own: a flat colour over itself is the same colour, so
 *  the joints do not show, and no segment's band is laid over its neighbour's ink. (Until 12 October it was one
 *  premultiplied pass whose glow added: every joint of a bolt glowed twice and a bolt read as a chain of beads; in
 *  two passes, band and ink together, it read as a chain of links.) The segments' vertex program and its viewport
 *  uniform are the batch's own. Three draw calls. */
const SHAPE = /* glsl */`
varying vec3 vShape;varying vec3 vColor;varying float vCore;varying float vI;
float across(){float ax=max(0.,max(-vShape.x,vShape.x-vShape.z));return length(vec2(ax,vShape.y));}`;
const GLOW = /* glsl */`${SHAPE}
void main(){
  float r=across();
  if(r>=1.)discard;
  gl_FragColor=vec4(vColor*pow(1.-r,1.5)*1.2*min(1.,vI),1.);
}`;
/** `uPart`: x how far across the segment this pass prints, as a multiple of the ink's width (the band 1.6, the ink 1);
 *  y how much of the edge's colour it prints in (the band .72, the ink none). */
const STROKE = /* glsl */`${SHAPE}
uniform vec2 uPart;
void main(){
  float r=across(),aa=fwidth(r)*1.2,k=min(1.,vI);
  float cover=1.-smoothstep(vCore*uPart.x-aa,vCore*uPart.x+aa,r);
  if(cover<=.003)discard;
  gl_FragColor=vec4(mix(vec3(.016,.0,.01),vColor,uPart.y)*cover*k,cover*k);
}`;

export const WILL = { glow: new THREE.Color(1.7, .06, .14), deep: new THREE.Color(.55, .01, .05) };
/** A Will's glow and the deep light it throws on the floor, from the colour its edge runs (sRGB hex): the hue kept, as
 *  bright as the crimson (over the bloom's threshold by the same margin) and as dark. */
export function willEdge(hex: number) {
  const glow = new THREE.Color(hex), peak = Math.max(glow.r, glow.g, glow.b, 1e-3);
  glow.multiplyScalar(1.7 / peak);
  return { glow, deep: glow.clone().multiplyScalar(.32) };
}

export class WillBolts {
  readonly batch: BoltBatch;
  readonly painter: LightningPainter;
  /** The stroke: the batch's own instances drawn twice more over its glow, the edge's band and then the ink. */
  private strokes: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>[];
  private style: BoltStyle = { width: .04, color: WILL.glow, levels: 4, jag: .36, branches: 2, branchLength: .5, taper: .35, core: .5 };
  constructor(scene: THREE.Scene, capacity = 2400) {
    this.batch = new BoltBatch(capacity, 'will-bolts', 1.5);
    const light = this.batch.mesh.material;
    // The batch's own vertex program and uniforms (its viewport height is set on them before each draw), and its
    // blending for the glow.
    this.batch.mesh.material = new THREE.ShaderMaterial({
      name: 'WillGlow', vertexShader: light.vertexShader, fragmentShader: GLOW, uniforms: light.uniforms,
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    light.dispose();
    this.strokes = [new THREE.Vector2(1.6, .72), new THREE.Vector2(1, 0)].map((part, i) => {
      const mesh = new THREE.Mesh(this.batch.mesh.geometry, new THREE.ShaderMaterial({
        name: i ? 'WillInk' : 'WillEdge', vertexShader: light.vertexShader, fragmentShader: STROKE, uniforms: { ...light.uniforms, uPart: { value: part } },
        transparent: true, depthWrite: false, toneMapped: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      }));
      mesh.name = i ? 'will-ink' : 'will-edge'; mesh.frustumCulled = false; mesh.renderOrder = this.batch.mesh.renderOrder + 1 + i;
      return mesh;
    });
    this.painter = new LightningPainter(this.batch, 96);
    scene.add(this.batch.mesh, ...this.strokes);
  }
  begin() { this.batch.begin(); }
  end() { this.batch.end(); for (const mesh of this.strokes) mesh.visible = this.batch.mesh.visible; }
  /** One jagged black bolt from a to b, `width` the glow's half-width (m), re-forked by `seed`. `edge` is the colour
   *  round the stroke: crimson unless a fighter's Will runs another (willEdge). */
  bolt(a: THREE.Vector3, b: THREE.Vector3, seed: number, width: number, intensity = 1, branches = 2, edge: THREE.Color = WILL.glow, levels = 4) {
    const s = this.style; s.width = width; s.intensity = intensity; s.branches = branches; s.color = edge; s.levels = levels;
    this.painter.bolt(a, b, seed, s);
  }
  dispose() { for (const mesh of this.strokes) { mesh.removeFromParent(); mesh.material.dispose(); } this.batch.dispose(); }
}
