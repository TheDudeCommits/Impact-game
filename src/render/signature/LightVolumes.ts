import * as THREE from 'three';
import { VFX } from '../vfxLevel';

/** Light from a technique without adding a light to the scene.
 *
 *  Three recompiles every lit program when the number of lights changes, and
 *  every light costs every lit fragment, so a Lightning Cut cannot bring a point
 *  light with it. This fakes one after the opaque pass instead: a sphere of
 *  the light's radius is drawn by its back faces with the depth test
 *  inverted, which passes exactly where some surface sits in front of the
 *  sphere's far side - the floor under the hand, the arm, the face, the
 *  opponent - and never on the sky. The blend is DST_COLOR + ONE, so that
 *  surface is multiplied by (1 + light): a lit wall brightens by its own
 *  albedo, the way a light would, rather than being painted over with a
 *  coloured disc. The falloff is taken across the view ray from the centre.
 *
 *  Draw it before the other effects (renderOrder -2) so the glows themselves
 *  are not multiplied. One instanced draw per layer; fixed capacity. */
const vertex = /* glsl */`
varying vec3 vView;varying vec3 vCenter;varying float vRadius;varying vec3 vLight;
void main(){
  vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);
  vView=mv.xyz;
  vCenter=(modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  vRadius=length(instanceMatrix[0].xyz);
  vLight=instanceColor;
  gl_Position=projectionMatrix*mv;
}`;
const fragment = /* glsl */`
varying vec3 vView;varying vec3 vCenter;varying float vRadius;varying vec3 vLight;
void main(){
  vec3 dir=normalize(vView);
  vec3 closest=dir*dot(vCenter,dir);
  float lateral=length(vCenter-closest)/vRadius;
  float f=clamp(1.-lateral*lateral,0.,1.);
  gl_FragColor=vec4(vLight*f*f,0.);
}`;

export class LightVolumes {
  readonly mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private transform = new THREE.Object3D();
  private color = new THREE.Color();
  count = 0;
  /** Held visible until drawn once, so the program is linked at load, not mid-fight. */
  private drawn = false;
  constructor(readonly capacity: number, name: string) {
    const material = new THREE.ShaderMaterial({
      name: 'SignatureLightVolume', vertexShader: vertex, fragmentShader: fragment,
      transparent: true, depthWrite: false, depthTest: true, depthFunc: THREE.GreaterEqualDepth, side: THREE.BackSide, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), material, capacity);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = -2;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.color.setRGB(0, 0, 0)); this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.onAfterRender = () => { this.drawn = true; };
  }
  begin() { this.count = 0; }
  /** A light of `radius` metres; `color` times `intensity` is what a fully
   *  lit surface is multiplied by on top of itself (0.8 = +80%). */
  add(position: THREE.Vector3, radius: number, color: THREE.Color, intensity: number) {
    if (this.count >= this.capacity || intensity <= .005 || radius <= .01) return;
    this.transform.position.copy(position); this.transform.scale.setScalar(radius); this.transform.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.transform.matrix);
    this.mesh.setColorAt(this.count++, this.color.copy(color).multiplyScalar(intensity * VFX.lights)); // (VISUAL EFFECTS: the level's share)
  }
  end() {
    this.mesh.count = this.count; this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}
