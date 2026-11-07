// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { NORMAL_TRANSFORM_GLSL } from '../../effects/NormalTransform';
import { NormalBlending, AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, ShaderMaterial, TorusGeometry, Vector3 } from 'three';
import type { AbilityCastContext } from '../Ability';
import { VisualOwner, clamp01, ease, hash } from './ElementalVisuals';

/** Closed bevelled crescent, with eight facets across its curved cutting profile. */
export function crescentGeometry(segments = 36): BufferGeometry {
  const p: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, a = (t - .5) * 3.7, width = .025 + Math.pow(Math.sin(t * Math.PI), .7) * .52;
    for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4, r = 2.5 + Math.cos(b) * width; p.push(Math.sin(a) * r, Math.cos(a) * r - 1.1, Math.sin(b) * width * .23); uv.push(t, j / 8); }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < 8; j++) { const a = i * 8 + j, b = i * 8 + (j + 1) % 8; idx.push(a, a + 8, b, b, a + 8, b + 8); }
  for (let j = 1; j < 7; j++) { idx.push(0, j + 1, j); const o = segments * 8; idx.push(o, o + j, o + j + 1); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export function shardGeometry(): BufferGeometry {
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute([0,1.8,0, -.4,.15,-.2, .27,.05,-.3, .42,-.2,.12, -.2,-.1,.35, .02,-1,0],3));
  g.setIndex([0,2,1,0,3,2,0,4,3,0,1,4,5,1,2,5,2,3,5,3,4,5,4,1]);
  // Independent face vertices retain hard shard edges instead of averaging into a smooth pebble.
  const faceted = g.toNonIndexed(); g.dispose(); faceted.computeVertexNormals(); return faceted;
}
/** Shared small-object shading; separate instances preserve each spell's palette and ownership. */
export function packMaterial(color: string, glass = false): ShaderMaterial {
  return new ShaderMaterial({ transparent: true, depthWrite: !glass, side: DoubleSide,
    uniforms: { uColor: { value: new Color(color) }, uTime: { value: 0 }, uFade: { value: 1 }, uEnergy: { value: .25 }, uGlass: { value: glass ? 1 : 0 } },
    vertexShader: `${NORMAL_TRANSFORM_GLSL}varying vec3 vLocal,vWorld,vNormal;void main(){vLocal=position;vec4 p=vec4(position,1.);vec3 n=normal;
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;n=normalForTransform(instanceMatrix,n);
      #endif
      vec4 w=modelMatrix*p;vWorld=w.xyz;vNormal=normalize(normalForTransform(modelMatrix,n));gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `varying vec3 vLocal,vWorld,vNormal;uniform vec3 uColor;uniform float uTime,uFade,uEnergy,uGlass;
      void main(){vec3 n=normalize(vNormal),eye=normalize(cameraPosition-vWorld);float fres=pow(1.-abs(dot(n,eye)),3.);float light=.25+.75*abs(dot(n,normalize(vec3(-.5,.8,.3))));float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.5,.8,.3)),n),eye)),48.);float vein=pow(max(0.,sin(vLocal.y*19.+vLocal.x*11.+sin(vLocal.z*13.)*2.)),14.);vec3 col=uColor*light*(.65+sin(vLocal.x*23.+vLocal.y*31.)*.12);col+=uColor*vein*uEnergy+vec3(.74,.84,.9)*spec*(.1+uGlass*.9);col+=fres*mix(uColor,vec3(.8,.94,1.),uGlass)*(.2+uEnergy*.25);vec3 prism=.5+.5*cos(vec3(0.,2.,4.)+dot(n,eye)*13.+uTime*.3);col+=prism*spec*uGlass*.18;gl_FragColor=vec4(col,uFade*mix(1.,.38+fres*.4+spec*.2,uGlass));}` });
}
/** Fixed-size sand/mote buffers with spell-specific spiral, suction, and burst trajectories. */
export class PackParticles {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  private readonly dummy = new Object3D();
  constructor(owner: VisualOwner, maximum: number, color: string, readonly style: 'sand' | 'gravity' | 'spore', readonly dust = false) {
    this.material = owner.material(new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: dust ? NormalBlending : AdditiveBlending,
      uniforms: { uColor: { value: new Color(color) }, uFade: { value: 1 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform vec3 uColor;uniform float uFade;void main(){float a=pow(max(0.,1.-dot(vUv*2.-1.,vUv*2.-1.)),2.);if(a<.01)discard;gl_FragColor=vec4(uColor,a*uFade);}' }));
    this.mesh = new InstancedMesh(owner.geometry(new PlaneGeometry(1,1)), this.material, maximum); this.mesh.frustumCulled = false; owner.root.add(this.mesh);
  }
  update(t: number, count: number, burst: number, fade: number, context: AbilityCastContext): void {
    this.mesh.count = count; this.material.uniforms.uFade.value = fade * (this.dust ? .34 : .8); this.mesh.visible = t >= .25; const d = this.dummy;
    const compress = ease((t - (this.style === 'sand' ? 3.4 : 2.1)) / (this.style === 'sand' ? 1 : 1.65));
    for (let i = 0; i < count; i++) {
      const seed = hash(i+17), a = i*2.39996+t*(this.style === 'gravity' ? 1.2+compress*4 : .65), age = t-burst-seed*.2;
      if (age < 0) { let r = 1+seed*5, y = ((t*(1.3+seed)+hash(i+63)*7)%8); if (this.style === 'sand') { r *= .5+y*.08; r *= 1-compress*.82; y *= 1-compress*.62; } else if (this.style === 'gravity') { r *= 1-compress*.94; y = 3+Math.sin(a*.7+i)*r*.7; } else { y *= ease((t-.4)/2); r *= 1.3; } d.position.set(Math.cos(a)*r,y,Math.sin(a)*r); }
      else { const speed = this.dust ? 3+seed*3 : 5+seed*11, r = age*speed; let y = this.dust ? 1+seed*3+age*.5 : 1+(5+seed*9)*age-4.5*age*age; if (this.style === 'spore') y = 2+seed*5-age*.8+Math.sin(age+i)*.3; d.position.set(Math.cos(a-t*.5)*r,Math.max(.08,y),Math.sin(a-t*.5)*r); }
      d.quaternion.copy(context.camera.quaternion); const s = (this.dust ? .8+seed*1.8 : .035+seed*.095)*fade; d.scale.set(s,s*(this.style === 'sand'&&!this.dust?1.7:1),s); d.updateMatrix(); this.mesh.setMatrixAt(i,d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
/** Lifecycle and tiny hand attachment only; each spell owns its distinct attack choreography. */
export abstract class PackEffect {
  protected readonly owner = new VisualOwner();
  protected readonly aura = new Group();
  protected readonly hand = new Vector3();
  protected readonly point = new Vector3();
  protected readonly light: PointLight;
  protected age = 0;
  private disposed = false;
  private readonly events = new Set<number>();
  private readonly motes: InstancedMesh;
  private readonly rings: Mesh[] = [];
  private readonly dummy = new Object3D();
  protected constructor(protected readonly context: AbilityCastContext, protected readonly target: Vector3, color: string, auraGeometry: BufferGeometry) {
    this.owner.root.position.copy(target); context.scene.add(this.owner.root); this.owner.root.add(this.aura);
    const mat = this.owner.material(packMaterial(color,true)); this.motes = new InstancedMesh(this.owner.geometry(auraGeometry),mat,14); this.motes.frustumCulled=false; this.aura.add(this.motes);
    const ringMat = this.owner.material(new MeshBasicMaterial({ color,transparent:true,opacity:.6,depthWrite:false,blending:AdditiveBlending }));
    const ring = this.owner.geometry(new TorusGeometry(.29,.008,5,40)); for(let i=0;i<2;i++){const m=new Mesh(ring,ringMat);m.rotation.x=i*Math.PI*.5;this.rings.push(m);this.aura.add(m);}
    this.light=new PointLight(color,0,28,2);this.light.position.y=3;this.owner.root.add(this.light);
  }
  protected tick(delta: number, lifetime: number): boolean {
    if(this.disposed)return false;this.age+=Math.max(0,Number.isFinite(delta)?delta:0);if(this.age>=lifetime)return false;
    const t=this.age;this.context.player.visual.getRightHandWorldPosition(this.hand);this.aura.position.copy(this.hand).sub(this.target);this.aura.visible=t<.85;this.aura.scale.setScalar(Math.max(.001,ease(t/.15)*(1-ease((t-.45)/.4))));
    this.rings.forEach((m,i)=>m.rotation.set(t*(2+i),t*(1+i),t*2));
    for(let i=0;i<14;i++){const a=i*2.39996+t*3,d=this.dummy;d.position.set(Math.cos(a)*.3,Math.sin(a*1.7)*.2,Math.sin(a)*.3);d.rotation.set(t+i,t*2+i, i);d.scale.setScalar(.018+hash(i)*.025);d.updateMatrix();this.motes.setMatrixAt(i,d.matrix);}this.motes.instanceMatrix.needsUpdate=true;
    return true;
  }
  protected ripple(id: number, threshold: number, strength: number, duration: number, speed: number, radius=1, x=0,z=0): boolean {
    if(this.age<threshold||this.events.has(id))return false;this.events.add(id);this.point.copy(this.target);this.point.x+=x;this.point.z+=z;
    this.context.water?.addRipple({position:this.point,strength,duration,waveSpeed:speed,wavelength:.75,radius},this);return true;
  }
  protected lighting(energy: number): void {this.light.visible=this.context.quality.preset!=='LOW'&&energy>.001;this.light.intensity=this.light.visible?energy:0;}
  dispose(): void {if(this.disposed)return;this.disposed=true;this.context.water?.removeOwner(this);this.owner.dispose();}
}
export { clamp01, ease, hash };
