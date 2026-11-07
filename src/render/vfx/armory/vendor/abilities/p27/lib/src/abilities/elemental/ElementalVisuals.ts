// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { NormalBlending, AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const ease = (v: number): number => { const p = clamp01(v); return p * p * (3 - 2 * p); };
export const hash = (i: number): number => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
export function groundTarget(context: AbilityCastContext, range: number): Vector3 | null {
  const g = context.groundTarget, p = context.player.position;
  if (!g || ![g.x, g.y, g.z, p.x, p.z].every(Number.isFinite)) return null;
  const target = new Vector3(g.x - p.x, 0, g.z - p.z);
  if (target.lengthSq() > range * range) target.setLength(range);
  return target.add(new Vector3(p.x, 0, p.z));
}
/** Cast-local resource ownership: shared among that cast's meshes, never global materials. */
export class VisualOwner {
  readonly root = new Group();
  private geometries = new Set<BufferGeometry>();
  private materials = new Set<MeshBasicMaterial | ShaderMaterial>();
  geometry<T extends BufferGeometry>(g: T): T { this.geometries.add(g); return g; }
  material<T extends MeshBasicMaterial | ShaderMaterial>(m: T): T { this.materials.add(m); return m; }
  dispose(): void { this.root.removeFromParent(); this.root.traverse(o => { if (o instanceof InstancedMesh) o.dispose(); }); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.root.clear(); }
}
export function gridGeometry(width: number, height: number, layers = 1): BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const offset = positions.length / 3;
    for (let y = 0; y <= height; y++) for (let x = 0; x <= width; x++) { positions.push(x / width, y / height, layer); uv.push(x / width, y / height); }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const a = offset + y * (width + 1) + x, b = a + width + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(indices); return g;
}
/** Fixed instance buffer. Analytic motion avoids emitters, callbacks, and per-frame allocation. */
export class ElementParticles {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  private readonly dummy = new Object3D();
  private readonly inverse = new Quaternion();
  constructor(owner: VisualOwner, readonly maximum: number, readonly water: boolean, readonly dust = false) {
    this.material = owner.material(new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: dust ? NormalBlending : AdditiveBlending,
      uniforms: { uOpacity: { value: 1 }, uColor: { value: new Color(dust ? '#272622' : water ? '#b7f5ff' : '#ffbc50') } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity; void main(){vec2 p=vUv*2.-1.;float a=pow(max(0.,1.-dot(p,p)),2.); if(a<.01)discard;gl_FragColor=vec4(uColor,a*uOpacity);}' }));
    this.mesh = new InstancedMesh(owner.geometry(new PlaneGeometry(1, 1)), this.material, maximum); this.mesh.frustumCulled = false; owner.root.add(this.mesh);
  }
  update(t: number, count: number, impact: number, fade: number, camera: AbilityCastContext['camera']): void {
    this.mesh.count = Math.min(count, this.maximum); this.material.uniforms.uOpacity.value = fade * (this.dust ? .57 : .8);
    const d = this.dummy; this.inverse.copy(this.mesh.parent!.quaternion).invert();
    for (let i = 0; i < this.mesh.count; i++) {
      const a = hash(i + 8) * Math.PI * 2, r = hash(i + 91), s = hash(i + 43), birth = impact + s * .8;
      let age = t - birth;
      if (age >= 0) {
        const speed = (this.dust ? 2 : 5) + r * (this.water ? 12 : 13), radius = 1 + speed * age * (this.dust ? .6 : 1);
        d.position.set(Math.cos(a) * radius, Math.max(.08, (this.dust ? 1 + s * 5 + age * 1.2 : 1 + (5 + s * 11) * age - 5.5 * age * age)), Math.sin(a) * radius);
      } else {
        age = Math.max(0, t - .3); const radius = 3 + r * 7;
        d.position.set(Math.cos(a + t * .2) * radius, .2 + ((age * (1 + s) + r * 3) % 4), Math.sin(a + t * .2) * radius);
      }
      d.quaternion.copy(this.inverse).multiply(camera.quaternion); const scale = (this.dust ? 1 + r * 2.8 + Math.max(0, age) * .5 : .05 + r * .16) * fade;
      d.scale.set(scale, scale * (this.water && !this.dust ? 2.6 : 1), scale); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
/** Layered radial pressure/spray sheet shared by both impacts. */
export class SurfacePulse {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  constructor(owner: VisualOwner, water: boolean) {
    this.material = owner.material(new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uRadius: { value: 1 }, uWater: { value: water ? 1 : 0 } },
      vertexShader: `varying vec2 vUv; uniform float uTime,uPower,uRadius;void main(){vUv=uv;vec2 p=position.xy*2.-1.;float r=length(p);float h=sin(r*28.-uTime*8.)*exp(-pow((r-.65)*5.,2.))*uPower*.6;gl_Position=projectionMatrix*modelViewMatrix*vec4(p.x*uRadius,.06+h,p.y*uRadius,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float uTime,uPower,uWater;void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);float rings=pow(max(0.,sin(r*35.-uTime*8.+sin(a*9.)*.4)),8.);float edge=(1.-smoothstep(.82,1.,r))*smoothstep(.05,.35,r);vec3 col=mix(vec3(.58,.38,.16),vec3(.25,.7,.83),uWater);gl_FragColor=vec4(mix(col,vec3(.8,.92,.94),rings*.5),edge*rings*uPower*.7);}` }));
    this.mesh = new Mesh(owner.geometry(gridGeometry(48, 48)), this.material); this.mesh.frustumCulled = false; owner.root.add(this.mesh);
  }
  update(time: number, power: number, radius: number): void { this.mesh.visible = power > .001; this.material.uniforms.uTime.value = time; this.material.uniforms.uPower.value = power; this.material.uniforms.uRadius.value = radius; }
}
