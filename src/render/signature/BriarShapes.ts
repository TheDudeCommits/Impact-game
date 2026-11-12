import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { noiseGLSL } from '../vfx/noise';
import { skipHiddenChildren } from '../hiddenMatrices';
import { SWAN_HEAD } from '../../originals/effects';

export const WIND = 0, WATER = 1;
export interface FunnelStyle { mode: number; core: THREE.Color; main: THREE.Color; deep: THREE.Color }
export const FUNNEL = {
  // Round 7: Aquilo's wind - Shearwind Gust's drill, Eye of the Gale's bands - is white
  // to pale cyan, never green. Its heart kept near the bloom threshold, and the cyan in its body and shade, because in the
  // stage's bloom a white wind came out "a shapeless white bloom over half the frame" (critic pass 5).
  wind: { mode: WIND, core: new THREE.Color(1.15, 1.42, 1.6), main: new THREE.Color(.42, .78, 1.0), deep: new THREE.Color(.04, .13, .22) },
  // Sylph's: Great Northerly's beam, white at the core and mint at its edges.
  sylph: { mode: WIND, core: new THREE.Color(1.2, 1.75, 1.3), main: new THREE.Color(.22, 1.0, .42), deep: new THREE.Color(.03, .2, .1) },
  water: { mode: WATER, core: new THREE.Color(2.1, 2.6, 3.1), main: new THREE.Color(.22, .78, 1.75), deep: new THREE.Color(.015, .1, .32) },
} satisfies Record<string, FunnelStyle>;

const UP = new THREE.Vector3(0, 1, 0);
const premultiplied = { transparent: true, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;

const funnelVertex = /* glsl */`
uniform float uR0;uniform float uR1;uniform float uLen;uniform float uTime;uniform float uSeed;
varying vec2 vUv;varying vec3 vN;varying vec3 vV;
void main(){
  float y=position.y,a=atan(position.z,position.x);
  float r=mix(uR0,uR1,pow(y,.85));
  // Not a clean cone: the wall breathes and wanders as it turns.
  r*=1.+.1*sin(a*3.+y*11.-uTime*15.+uSeed)+.05*sin(a*5.-y*7.+uTime*9.);
  vec3 p=vec3(position.x*r,y*uLen,position.z*r);
  vec3 n=normalize(vec3(position.x,-(uR1-uR0)/max(uLen,.01),position.z));
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vN=normalize(normalMatrix*n);vV=-mv.xyz;vUv=vec2(a/6.2831853+.5,y);
  gl_Position=projectionMatrix*mv;
}`;
const funnelFragment = /* glsl */`
uniform vec3 uCore;uniform vec3 uMain;uniform vec3 uDeep;uniform float uK;uniform float uTime;uniform float uSeed;uniform float uMode;uniform float uTurns;uniform float uSpin;uniform vec2 uNear;
varying vec2 vUv;varying vec3 vN;varying vec3 vV;
${noiseGLSL}
void main(){
  float facing=abs(dot(normalize(vN),normalize(vV)));
  float rim=pow(1.-facing,1.5);
  float a=vUv.x,y=vUv.y;
  float n=snoise(vec3(a*7.+uSeed,y*5.-uTime*3.,uTime*.8));
  float m=snoise(vec3(a*19.-uSeed,y*13.-uTime*6.,uTime*1.7));
  // Three strands wound along it, turning; a fine fourth between them.
  float s=a*3.+y*uTurns-uTime*uSpin;
  float band=smoothstep(.42,.9,.5+.5*sin(6.2831853*s+n*1.4));
  float fine=smoothstep(.78,.97,.5+.5*sin(6.2831853*(s*2.+.37)+m*1.1));
  // Born at its root, torn at its end.
  float ends=smoothstep(0.,.06,y)*(1.-smoothstep(.72,1.,y+n*.14));
  vec3 rgb;float alpha;
  if(uMode<.5){
    // (Mostly air: the strands carry it - critic pass 4, "a featureless pale-green glowing tube with no swirl".)
    rgb=uDeep*.3+uMain*(.04+.25*rim+.75*band)+uCore*(fine*.9+band*band*.3);
    alpha=.02+.05*rim+.2*band+.12*fine;
  }else{
    rgb=uDeep*(.7+.3*facing)+uMain*(.25+.6*rim+.3*band)+uCore*(band*.25+fine*.7+pow(rim,3.)*.35);
    alpha=.5+.3*rim+.15*band;
  }
  // Thinned to nothing within a couple of metres of the lens: the ultimate's cinema puts the lens beside the pair, and a
  // funnel's wall that near was the whole frame gone white (Aquilo's and Svanhild's ultimates, the first sheets).
  float near=smoothstep(uNear.x,uNear.y,length(vV));
  float seen=ends*uK*near;
  if(seen<.005)discard;
  gl_FragColor=vec4(rgb*seen,alpha*seen);
}`;

function funnelGeometry() {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 30, 24, true);
  geometry.translate(0, .5, 0);
  return geometry;
}

/** Spiralling tubes of wind or water. */
export class Funnels {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private readonly geometry = funnelGeometry();
  private count = 0;
  private drawn = false;
  private readonly q = new THREE.Quaternion();
  constructor(scene: THREE.Scene, capacity = 4, name = 'bc-funnel') {
    const base = new THREE.ShaderMaterial({ name: 'BriarFunnel', vertexShader: funnelVertex, fragmentShader: funnelFragment, side: THREE.DoubleSide, depthWrite: false, ...premultiplied,
      uniforms: { uR0: { value: .1 }, uR1: { value: 1 }, uLen: { value: 1 }, uTime: { value: 0 }, uSeed: { value: 0 }, uCore: { value: new THREE.Color() }, uMain: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uK: { value: 0 }, uMode: { value: 0 }, uTurns: { value: 3 }, uSpin: { value: 4 }, uNear: { value: new THREE.Vector2(2, 4.6) } } });
    this.group.name = name + '-pool';
    skipHiddenChildren(this.group);
    for (let i = 0; i < capacity; i++) {
      const mesh = new THREE.Mesh(this.geometry, i ? base.clone() : base);
      mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = i === 0;
      this.meshes.push(mesh); this.group.add(mesh);
    }
    const first = this.meshes[0]; first.position.set(0, -50, 0); first.scale.setScalar(.001);
    first.onAfterRender = () => { this.drawn = true; };
    scene.add(this.group);
  }
  begin() { this.count = 0; }
  /** One tube from `from` along `axis` (unit) for `length` metres, `r0` to `r1` wide, `turns` twists over its length and
   *  `spin` turns a second; `k` 0..1 how much of it is there; `near` how close to the lens it is gone (metres, a thin
   *  one held in a hand can come nearer than a wide one stood round a fighter). */
  add(from: THREE.Vector3, axis: THREE.Vector3, length: number, r0: number, r1: number, style: FunnelStyle, k: number, time: number, seed = 0, turns = 3, spin = 4, near = 2) {
    if (this.count >= this.meshes.length || k <= .01 || length <= .05) return;
    const mesh = this.meshes[this.count++], u = mesh.material.uniforms;
    mesh.position.copy(from); mesh.quaternion.copy(this.q.setFromUnitVectors(UP, axis)); mesh.scale.setScalar(1); mesh.visible = true;
    u.uR0.value = r0; u.uR1.value = r1; u.uLen.value = length; u.uTime.value = time; u.uSeed.value = seed % 97; u.uK.value = Math.min(1, k);
    u.uMode.value = style.mode; u.uTurns.value = turns; u.uSpin.value = spin; (u.uNear.value as THREE.Vector2).set(near, near * 2.3);
    (u.uCore.value as THREE.Color).copy(style.core); (u.uMain.value as THREE.Color).copy(style.main); (u.uDeep.value as THREE.Color).copy(style.deep);
  }
  end() { for (let i = this.count; i < this.meshes.length; i++) if (i || this.drawn) this.meshes[i].visible = false; }
  dispose() { this.group.removeFromParent(); for (const m of this.meshes) m.material.dispose(); this.geometry.dispose(); }
}

const dragonVertex = /* glsl */`
attribute float _jaw;uniform float uJaw;uniform float uTime;
varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){
  // The lower jaw turns about the hinge (the origin) toward the skull: forward is +z, up +y.
  float a=uJaw*_jaw,c=cos(a),s=sin(a);
  vec3 p=vec3(position.x,position.z*s+position.y*c,position.z*c-position.y*s);
  vec3 n=vec3(normal.x,normal.z*s+normal.y*c,normal.z*c-normal.y*s);
  // Water: the surface runs back over the head.
  p+=n*.016*sin(p.z*16.+uTime*13.+p.y*7.);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vN=normalize(normalMatrix*n);vV=-mv.xyz;vP=p;
  gl_Position=projectionMatrix*mv;
}`;
const dragonFragment = /* glsl */`
uniform vec3 uCore;uniform vec3 uMain;uniform vec3 uDeep;uniform float uK;uniform float uTime;uniform float uSeed;
varying vec3 vN;varying vec3 vV;varying vec3 vP;
${noiseGLSL}
void main(){
  // Round 8 (blind critic 2: "no snout, jaws, teeth, eye or body ... it must read in a single frame"): drawn
  // flat and bold - a sea-blue body lit from above and navy beneath, the shape outlined in white foam
  // (its rim: the teeth, the fins and the crest are thin, so they come out white whole), a few darker blotches. The
  // noise no longer tears it while it is there, only as it comes and goes.
  vec3 n3=normalize(vN),v3=normalize(vV);
  float facing=abs(dot(n3,v3));
  vec3 upV=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);
  float lit=smoothstep(-.25,.35,dot(n3,upV));
  float blot=smoothstep(.15,.55,snoise(vec3(vP*3.2+vec3(uSeed,0.,0.))));
  vec3 rgb=mix(uDeep,uMain*.72,lit)*(1.-.28*blot);
  // (Only the outermost turn of the silhouette: a wider band lit every horn and fin white, a burst of spikes.)
  float rim=smoothstep(.6,.84,1.-facing);
  float sheen=smoothstep(.5,.95,snoise(vec3(vP*9.+vec3(0.,uTime*.8,uTime*1.6))))*lit*.35;
  rgb=mix(rgb,uCore*1.1,max(rim,sheen));
  float n=snoise(vec3(vP*4.5+vec3(uSeed,0.,uTime*3.2)));
  float seen=smoothstep(0.,.2,uK*1.25-.2+(n*.5+.5)*.25)*smoothstep(1.,2.6,length(vV));
  if(seen<.005)discard;
  gl_FragColor=vec4(rgb*seen,.97*seen);
}`;

export const SEA_DRAGON_ASSET = SWAN_HEAD.asset;
export const JAW_OPEN = SWAN_HEAD.jawOpen;
/** Where its eyes are, in the head's own metre (from the hinge: across, up, forward), for the glow in them. */
export const DRAGON_EYES: readonly (readonly [number, number, number])[] = SWAN_HEAD.eyes;
let headGeometry: Promise<THREE.BufferGeometry | undefined> | undefined;
function loadHead() {
  headGeometry ??= new GLTFLoader().loadAsync(SEA_DRAGON_ASSET).then(gltf => {
    let found: THREE.BufferGeometry | undefined;
    gltf.scene.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && !found) found = mesh.geometry; });
    if (found && !found.getAttribute('_jaw')) found.setAttribute('_jaw', new THREE.Float32BufferAttribute(new Float32Array(found.getAttribute('position').count), 1));
    return found;
  }).catch(error => { console.warn('Sea dragon head did not load; the roar is drawn without it', error); return undefined; });
  return headGeometry;
}

/** Svanhild's sea dragon's head, of water. Nothing is drawn until `load` has its file. */
export class SeaDragons {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private count = 0;
  private drawn = false;
  private ready = false;
  private readonly basis = new THREE.Matrix4();
  private readonly x = new THREE.Vector3(); private readonly y = new THREE.Vector3(); private readonly z = new THREE.Vector3();
  constructor(private readonly scene: THREE.Scene, private readonly capacity = 3, private readonly name = 'bc-sea-dragon') {}
  async load() {
    if (this.ready) return;
    const geometry = await loadHead();
    if (!geometry || this.ready) return;
    const base = new THREE.ShaderMaterial({ name: 'BriarSeaDragon', vertexShader: dragonVertex, fragmentShader: dragonFragment, depthWrite: true, ...premultiplied,
      uniforms: { uJaw: { value: 0 }, uTime: { value: 0 }, uSeed: { value: 0 }, uK: { value: 0 }, uCore: { value: FUNNEL.water.core.clone() }, uMain: { value: FUNNEL.water.main.clone() }, uDeep: { value: FUNNEL.water.deep.clone() } } });
    this.group.name = this.name + '-pool';
    skipHiddenChildren(this.group);
    for (let i = 0; i < this.capacity; i++) {
      const mesh = new THREE.Mesh(geometry, i ? base.clone() : base);
      mesh.name = this.name; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = i === 0;
      this.meshes.push(mesh); this.group.add(mesh);
    }
    const first = this.meshes[0]; first.position.set(0, -50, 0); first.scale.setScalar(.001);
    first.onAfterRender = () => { this.drawn = true; };
    this.scene.add(this.group);
    this.ready = true;
  }
  begin() { this.count = 0; }
  /** The head with its hinge at `at`, its snout `size` metres out along `forward` (unit), the skull up as near the
   *  world's up as that allows; `bite` 0 the jaws as wide as they were made, 1 shut, below 0 wider. */
  add(at: THREE.Vector3, forward: THREE.Vector3, size: number, bite: number, k: number, time: number, seed = 0) {
    if (!this.ready || this.count >= this.meshes.length || k <= .01) return;
    const mesh = this.meshes[this.count++], u = mesh.material.uniforms;
    this.z.copy(forward).normalize();
    this.x.crossVectors(UP, this.z); if (this.x.lengthSq() < 1e-6) this.x.set(1, 0, 0); this.x.normalize();
    this.y.crossVectors(this.z, this.x);
    this.basis.makeBasis(this.x, this.y, this.z);
    mesh.position.copy(at); mesh.quaternion.setFromRotationMatrix(this.basis); mesh.scale.setScalar(size); mesh.visible = true;
    u.uJaw.value = JAW_OPEN * bite; u.uTime.value = time; u.uSeed.value = seed % 97; u.uK.value = Math.min(1, k);
  }
  end() { for (let i = this.count; i < this.meshes.length; i++) if (i || this.drawn) this.meshes[i].visible = false; }
  dispose() { this.group.removeFromParent(); for (const m of this.meshes) m.material.dispose(); }
}

/** Starless Cut's torn space (round 7: from the blade's edge a flat wedge of hard-edged colour planes fans
 *  outward - magenta, cyan, deep navy - with a jagged, torn boundary; the blind critic: the ultimate read as
 *  "generic purple magic"). Where the cut runs, a few flat panes of plain colour open off the line like
 *  a pane of the world torn open, and close again in under a second. Unlit and uncoloured by the stage: flat fills
 *  over the scene. */
export class SpaceTears {
  private readonly group = new THREE.Group();
  private readonly panes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly at = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly line = new THREE.Vector3();
  private born = -Infinity;
  private seed = 0;
  constructor(scene: THREE.Scene, name = 'bc-space-tears') {
    this.group.name = name;
    scene.add(this.group);
    for (const colour of [0xd31c8a, 0x1cc4dc, 0x10164a, 0xe03aa0, 0x2ad0e6, 0x0c1240]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      const pane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
      pane.frustumCulled = false; pane.visible = false; pane.renderOrder = 5;
      this.group.add(pane); this.panes.push(pane);
    }
  }
  /** Opens the tear through `at` (the struck body's middle), the cut running across `dir` (the way the blow travelled). */
  open(at: THREE.Vector3, dir: THREE.Vector3, time: number, seed = 0) {
    this.at.copy(at); this.dir.copy(dir).setY(0);
    if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1);
    this.dir.normalize(); this.born = time; this.seed = seed;
  }
  update(time: number) {
    const age = time - this.born;
    if (!(age >= 0 && age < .95)) { for (const pane of this.panes) pane.visible = false; return; }
    const open = THREE.MathUtils.smoothstep(age, 0, .07), fade = 1 - THREE.MathUtils.smoothstep(age, .5, .95);
    this.side.crossVectors(this.dir, UP).normalize();
    // The cut: a line some 7 m long through them, leaning a fifth off upright toward its side.
    this.line.copy(UP).multiplyScalar(Math.cos(.35)).addScaledVector(this.side, Math.sin(.35)).normalize();
    this.panes.forEach((pane, i) => {
      const r = (k: number) => fract(Math.sin((this.seed + i * 7.31 + k) * 12.9898) * 43758.5453);
      const along0 = -3.4 + 6.8 * (i / this.panes.length) + .3 * r(1), along1 = along0 + 1.1 + 1.4 * r(2);
      const out = (i % 2 ? 1 : -1) * (.9 + 1.8 * r(3)) * open, shear = (r(4) - .5) * 1.2;
      const a = this.at.clone().addScaledVector(this.line, along0), b = this.at.clone().addScaledVector(this.line, along1);
      // A torn sliver off the line: two corners on the cut, two out from it, its far edge jagged by the shear.
      const c = b.clone().addScaledVector(this.dir, out).addScaledVector(this.line, shear * .5);
      const d = a.clone().addScaledVector(this.dir, out * (.6 + .4 * r(5))).addScaledVector(this.line, -shear * .4);
      const position = pane.geometry.getAttribute('position') as THREE.BufferAttribute;
      [a, b, c, d].forEach((p, k) => position.setXYZ(k, p.x, p.y, p.z));
      position.needsUpdate = true;
      pane.geometry.computeBoundingSphere();
      pane.material.opacity = .9 * fade;
      pane.visible = fade > .01;
    });
  }
  dispose() {
    this.group.removeFromParent();
    for (const pane of this.panes) { pane.geometry.dispose(); pane.material.dispose(); }
  }
}

function fract(x: number) { return x - Math.floor(x); }
