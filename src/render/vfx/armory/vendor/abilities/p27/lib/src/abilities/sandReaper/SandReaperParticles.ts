// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
import { sandHash } from './SandReaperGeometry';
import { createSandReaperMaterial } from './SandReaperMaterial';
import type { SandQuality, SandReaperConfig } from './SandReaperConfig';

type ParticleKind = 'sand' | 'dust' | 'droplet';
/** Fixed ring buffer. Motion, drag, gravity, turbulence, rotation and fades are evaluated on the GPU. */
class SandEmitter {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  private readonly spawn: InstancedBufferAttribute;
  private readonly motion: InstancedBufferAttribute;
  private readonly shape: InstancedBufferAttribute;
  private cursor = 0;
  private highWater = 0;
  private budget: number;
  active = 0;
  constructor(root: Group, readonly maximum: number, readonly kind: ParticleKind) {
    this.budget = maximum;
    const geometry = new PlaneGeometry(1, 1);
    this.spawn = new InstancedBufferAttribute(new Float32Array(maximum * 4).fill(-999), 4).setUsage(DynamicDrawUsage);
    this.motion = new InstancedBufferAttribute(new Float32Array(maximum * 4), 4).setUsage(DynamicDrawUsage);
    this.shape = new InstancedBufferAttribute(new Float32Array(maximum * 4), 4).setUsage(DynamicDrawUsage);
    geometry.setAttribute('aSpawn', this.spawn); geometry.setAttribute('aMotion', this.motion); geometry.setAttribute('aShape', this.shape);
    const dust = kind === 'dust', droplet = kind === 'droplet';
    this.material = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
      uniforms: { uTime: { value: 0 }, uTurbulence: { value: .7 }, uOpacity: { value: dust ? .12 : 1 }, uColor: { value: new Color(droplet ? '#b4c1c9' : '#edc78a') } },
      vertexShader: `attribute vec4 aSpawn,aMotion,aShape; uniform float uTime,uTurbulence;varying vec2 vUv;varying float vAlpha,vSeed;varying vec3 vWorld;
        void main(){float age=max(0.,uTime-aSpawn.w);float life=max(.01,aMotion.w);float f=clamp(age/life,0.,1.);
        float drag=${dust ? '2.3' : droplet ? '.65' : '1.8'};float travel=(1.-exp(-age*drag))/drag;
        vec3 p=aSpawn.xyz+aMotion.xyz*travel;
        p.y+=${dust ? '-.05' : droplet ? '-4.9' : '-.8'}*age*age;
        p.x+=sin(age*4.+aShape.z*29.)*age*.23*uTurbulence;p.z+=cos(age*3.+aShape.z*37.)*age*.23*uTurbulence;
        ${dust ? 'p.y=max(.08,p.y);' : ''}
        float size=aShape.x*${dust ? '(.55+f*2.1)' : '(1.-f*.45)'};
        float angle=aShape.y*age+aShape.z*6.283;vec2 local=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*position.xy*size;
        ${dust ? 'local.y*=.38;' : droplet ? 'local.y*=2.;' : ''}
        vec4 mv=viewMatrix*vec4(p,1.);mv.xy+=local;gl_Position=projectionMatrix*mv;
        vAlpha=step(0.,uTime-aSpawn.w)*(1.-step(life,age))*smoothstep(0.,.08,f)*(1.-smoothstep(.65,1.,f));
        if(p.y<-.1||vAlpha<.001)gl_Position=vec4(2.,2.,2.,1.);
        vUv=uv;vSeed=aShape.z;vWorld=p;}`,
      fragmentShader: `uniform float uTime,uOpacity;uniform vec3 uColor;varying vec2 vUv;varying float vAlpha,vSeed;varying vec3 vWorld;
        ${dust ? frostNoise : ''}
        void main(){vec2 p=vUv*2.-1.;float alpha;
        ${dust ? `float r=dot(p,p);float grain=snoise(vec3(p*5.+vSeed*9.,uTime*.5))*.5+.5;
          float flow=snoise(vWorld*.8+vec3(uTime*.3,0.,0.))*.5+.5;
          alpha=exp(-r*3.)*(1.-smoothstep(.5,1.,r))*smoothstep(.15,.75,grain)*(.7+.3*flow);` : `float diamond=abs(p.x)+abs(p.y)*.8;alpha=1.-smoothstep(.6,.92,diamond);`}
        alpha*=vAlpha*uOpacity;if(alpha<.002)discard;
        vec3 color=uColor*mix(.38,1.05,vSeed);${dust ? '' : 'if(vSeed>.94)color*=1.6;'}
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
    this.mesh = new InstancedMesh(geometry, this.material, maximum); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = dust ? 5 : 4; root.add(this.mesh);
  }
  setBudget(n: number): void { this.budget = Math.max(1, Math.min(this.maximum, Math.round(n))); this.cursor %= this.budget; }
  emit(time: number, p: Vector3, velocity: Vector3, size: number, life: number): void {
    const i = this.cursor, seed = sandHash(i * 13.71 + time * 27.3);
    this.cursor = (i + 1) % this.budget; this.highWater = Math.max(this.highWater, i + 1);
    this.spawn.setXYZW(i, p.x, p.y, p.z, time); this.motion.setXYZW(i, velocity.x, velocity.y, velocity.z, life);
    this.shape.setXYZW(i, size * (.65 + seed * .7), 2 + seed * 7, seed, 0);
    this.spawn.needsUpdate = this.motion.needsUpdate = this.shape.needsUpdate = true;
  }
  update(t: number, c: Readonly<SandReaperConfig>): void {
    this.material.uniforms.uTime.value = t; this.material.uniforms.uTurbulence.value = c.sandTurbulence;
    this.material.uniforms.uOpacity.value = this.kind === 'dust' ? c.dustOpacity : .9;
    this.mesh.count = Math.min(this.highWater, this.budget); this.active = 0;
    for (let i = 0; i < this.mesh.count; i++) if (t >= this.spawn.getW(i) && t - this.spawn.getW(i) < this.motion.getW(i)) this.active++;
    this.mesh.visible = this.active > 0;
  }
  reset(): void { this.cursor = this.highWater = this.active = 0; this.mesh.count = 0; this.mesh.visible = false; this.spawn.array.fill(-999); this.spawn.needsUpdate = true; }
  dispose(): void { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.material.dispose(); }
}
interface Rock { birth: number; life: number; position: Vector3; velocity: Vector3; seed: number; scale: number; }

export class SandReaperParticles {
  readonly root = new Group();
  readonly rocks: InstancedMesh[];
  readonly stone = createSandReaperMaterial(true);
  private readonly sand = new SandEmitter(this.root, 3600, 'sand');
  private readonly dust = new SandEmitter(this.root, 150, 'dust');
  private readonly droplets = new SandEmitter(this.root, 120, 'droplet');
  private readonly records: Rock[] = Array.from({ length: 96 }, (_, i) => ({ birth: -999, life: 0, position: new Vector3(), velocity: new Vector3(), seed: sandHash(i + 9), scale: 0 }));
  private readonly dummy = new Object3D();
  private readonly p = new Vector3();
  private readonly v = new Vector3();
  private readonly radial = new Vector3();
  private rockCursor = 0;
  private rockCount = 0;
  private quality: SandQuality;
  private sandRemainder = 0;
  private dustRemainder = 0;
  private rockRemainder = 0;
  private serial = 0;
  constructor(fragmentGeometry: readonly BufferGeometry[], q: SandQuality) {
    this.quality = q;
    this.rocks = fragmentGeometry.map(g => { const mesh = new InstancedMesh(g, this.stone.material, 24); mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.root.add(mesh); return mesh; });
    this.setQuality(q);
  }
  setQuality(q: SandQuality): void { this.quality = q; this.sand.setBudget(q.grains); this.dust.setBudget(q.dust); this.droplets.setBudget(q.droplets); }
  /** During charge the pieces spiral inward and settle along the crescent, rather than merely fading. */
  assembly(time: number, progress: number, position: Vector3, orientation: Quaternion, c: Readonly<SandReaperConfig>): void {
    const count = this.quality.fragments === 24 ? 12 : this.quality.fragments === 48 ? 20 : 28;
    const radius = c.bladeLength / (2 * Math.sin(c.crescentCurvature));
    const settle = Math.min(1, progress * 1.3), converge = 1 - Math.pow(1 - settle, 3);
    for (const mesh of this.rocks) mesh.count = 0;
    for (let i = 0; i < count; i++) {
      const seed = this.records[i].seed, t = (i + .5) / count, angle = (t * 2 - 1) * c.crescentCurvature;
      this.p.set(radius * (Math.cos(angle) - .22), radius * Math.sin(angle), 0);
      this.p.multiplyScalar(.65 + progress * .35);
      const orbit = time * (6 + seed * 3) + seed * 19, spread = (1 - converge) * (1 + seed * 1.3);
      this.p.x += Math.cos(orbit) * spread; this.p.y += Math.sin(orbit) * spread; this.p.z += (seed - .5) * spread;
      this.p.applyQuaternion(orientation).add(position); this.dummy.position.copy(this.p);
      this.dummy.quaternion.copy(orientation); this.dummy.rotateZ(orbit * (1 - converge));
      this.dummy.scale.setScalar((.09 + seed * .15) * (1 - smooth(.78, 1, progress)));
      this.dummy.updateMatrix(); const mesh = this.rocks[i % 4]; mesh.setMatrixAt(mesh.count++, this.dummy.matrix);
    }
    for (const mesh of this.rocks) mesh.instanceMatrix.needsUpdate = true;
    this.rockCount = count;
  }
  charge(t: number, dt: number, center: Vector3, c: Readonly<SandReaperConfig>): void {
    this.sandRemainder += dt * 260 * c.sandDensity * this.quality.grains / 2400;
    const n = Math.min(80, Math.floor(this.sandRemainder)); this.sandRemainder -= n;
    for (let i = 0; i < n; i++) {
      const seed = sandHash(++this.serial), angle = seed * 6.283 + t * 8, r = .2 + sandHash(this.serial + 5) * .65;
      this.p.copy(center).add(this.radial.set(Math.cos(angle) * r, (sandHash(this.serial + 1) - .5) * .8, Math.sin(angle) * r));
      this.v.subVectors(center, this.p).multiplyScalar(4); this.v.x += Math.sin(angle) * 1.5; this.v.z -= Math.cos(angle) * 1.5;
      this.sand.emit(t, this.p, this.v, .035, .4);
    }
  }
  flight(t: number, dt: number, p: Vector3, previous: Vector3, direction: Vector3, c: Readonly<SandReaperConfig>): void {
    this.sandRemainder += dt * 1050 * c.sandDensity * this.quality.grains / 2400;
    this.dustRemainder += dt * this.quality.dust * .4;
    this.rockRemainder += dt * 12;
    const n = Math.min(100, Math.floor(this.sandRemainder)); this.sandRemainder -= n;
    for (let i = 0; i < n; i++) {
      const seed = sandHash(++this.serial), angle = seed * 6.283;
      this.p.lerpVectors(previous, p, (i + .5) / Math.max(1, n)); this.p.x += Math.cos(angle) * .3; this.p.y += Math.sin(angle) * .3;
      this.v.copy(direction).multiplyScalar(-3 - seed * 3); this.v.y += .3;
      this.sand.emit(t, this.p, this.v, .03 + seed * .045, .6 + seed * .55);
    }
    const d = Math.min(8, Math.floor(this.dustRemainder)); this.dustRemainder -= d;
    for (let i = 0; i < d; i++) { this.p.lerpVectors(previous, p, (i + .5) / Math.max(1, d)); this.v.copy(direction).multiplyScalar(-1); this.dust.emit(t, this.p, this.v, .6, .7); }
    if (this.rockRemainder >= 1) { this.rockRemainder %= 1; this.v.copy(direction).multiplyScalar(-2); this.v.y += 1; this.emitRock(t, p, this.v, .1, 1); }
  }
  private emitRock(t: number, p: Vector3, v: Vector3, scale: number, life: number): void {
    const record = this.records[this.rockCursor]; this.rockCursor = (this.rockCursor + 1) % 96;
    record.birth = t; record.life = life; record.position.copy(p); record.velocity.copy(v); record.scale = scale;
  }
  impact(t: number, p: Vector3, direction: Vector3, c: Readonly<SandReaperConfig>, bladePosition: Vector3, orientation: Quaternion): void {
    this.rockCursor = 0;
    const count = Math.min(this.quality.fragments, c.fragmentCount);
    for (let i = 0; i < count; i++) {
      const seed = sandHash(i * 3.1 + 51), angle = sandHash(i + 91) * 6.283;
      this.v.copy(direction).multiplyScalar(c.fragmentSpeed * (.3 + seed * .55));
      this.v.x += Math.cos(angle) * c.fragmentSpeed * .6; this.v.z += Math.sin(angle) * c.fragmentSpeed * .6;
      this.v.y = 2.2 + seed * 6;
      const fraction = (i + .5) / count, arc = (fraction * 2 - 1) * c.crescentCurvature;
      const radius = c.bladeLength / (2 * Math.sin(c.crescentCurvature));
      this.p.set(radius * (Math.cos(arc) - .22), radius * Math.sin(arc), (seed - .5) * c.bladeThickness);
      this.p.applyQuaternion(orientation).add(bladePosition);
      this.emitRock(t, this.p, this.v, .16 + seed * .6, 1.4 + seed * 1.2);
    }
    const grains = Math.min(this.quality.grains, Math.round(this.quality.grains * .8 * c.sandDensity));
    for (let i = 0; i < grains; i++) {
      const seed = sandHash(i * 7.13), angle = sandHash(i + 271) * 6.283, speed = 3 + seed * c.fragmentSpeed;
      this.v.set(Math.cos(angle) * speed, .5 + seed * 5, Math.sin(angle) * speed).addScaledVector(direction, speed * .6);
      this.sand.emit(t, p, this.v, .025 + seed * .045, 1.2 + seed * 1.35);
    }
    for (let i = 0; i < this.quality.dust; i++) {
      const angle = i * 2.39996, seed = sandHash(i + 38), r = .1 + seed * 1.2;
      this.p.copy(p); this.p.y = .14 + seed * .4; this.p.x += Math.cos(angle) * r; this.p.z += Math.sin(angle) * r;
      this.v.set(Math.cos(angle) * (4 + seed * 9), .1, Math.sin(angle) * (4 + seed * 9)).addScaledVector(direction, 2);
      this.dust.emit(t, this.p, this.v, 1.1 + seed * 1.5, 1.7 + seed * 1);
    }
    for (let i = 0; i < this.quality.droplets; i++) {
      const seed = sandHash(i + 94), angle = i * 2.39996;
      this.p.copy(p); this.p.y = .05; this.v.set(Math.cos(angle) * (2 + seed * 6), 2 + seed * 5, Math.sin(angle) * (2 + seed * 6));
      this.droplets.emit(t, this.p, this.v, .018 + seed * .04, .6 + seed * .7);
    }
  }
  update(t: number, c: Readonly<SandReaperConfig>, assembling: boolean): void {
    this.sand.update(t, c); this.dust.update(t, c); this.droplets.update(t, c); this.stone.sync(c, t, 1, 0, this.quality.detail);
    if (assembling) return;
    for (const mesh of this.rocks) mesh.count = 0;
    this.rockCount = 0;
    for (const r of this.records) {
      const age = t - r.birth; if (age < 0 || age >= r.life) continue;
      const travel = (1 - Math.exp(-age * .35)) / .35;
      this.dummy.position.copy(r.position).addScaledVector(r.velocity, travel); this.dummy.position.y -= 4.9 * age * age;
      if (this.dummy.position.y < -.6) continue;
      this.dummy.rotation.set(r.seed * 7 + age * 4, r.seed * 9 + age * 3, r.seed * 11 + age * 6);
      const size = r.scale * (1 - smooth(r.life * .7, r.life, age));
      this.dummy.scale.set(size, size * (1 + r.seed), size * .65); this.dummy.updateMatrix();
      const mesh = this.rocks[this.rockCount % 4]; if (mesh.count < 24) mesh.setMatrixAt(mesh.count++, this.dummy.matrix); this.rockCount++;
    }
    for (const mesh of this.rocks) { mesh.instanceMatrix.needsUpdate = true; mesh.visible = mesh.count > 0; }
  }
  get particleCount(): number { return this.sand.active + this.dust.active + this.droplets.active; }
  get instanceCount(): number { return this.rockCount; }
  reset(): void { this.sand.reset(); this.dust.reset(); this.droplets.reset(); this.rockCursor = this.rockCount = this.serial = 0; this.sandRemainder = this.dustRemainder = this.rockRemainder = 0; for (const r of this.records) r.birth = -999; for (const m of this.rocks) { m.count = 0; m.visible = true; } }
  dispose(): void { this.sand.dispose(); this.dust.dispose(); this.droplets.dispose(); for (const m of this.rocks) { m.removeFromParent(); m.dispose(); } this.stone.material.dispose(); this.root.removeFromParent(); }
}
function smooth(a: number, b: number, t: number): number { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); }
