import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ORIGINAL_FINISHER_PROP } from '../../originals/hourBell';

/** MIDNIGHT's finisher: the hour of ruin, dropped out of the stopped sky onto
 *  the victim and crushing them as the clock starts again.
 *
 *  Round 3b. The blind critic saw it "for about 0.3 s as a silhouette": it
 *  fell from seven metres over the last half second - above the frame for
 *  most of it - and faded as it landed, under the finisher's manga flash. Now
 *  it has three beats, timed off the finisher F (the one tick every victim
 *  takes, where the crash sound already sits - sfxPlan's fx-hour-of-ruin):
 *
 *  drop   F-1 .. F     in from above, stopped over the victim's head -
 *                      thrown in stopped time, it stops, as his knives do -
 *                      in the top of the frame, and slammed down in the
 *                      last 0.15 s;
 *  crush  F            it lands as time resumes - squashed, the floor
 *                      thrown up round it, a gold burst on the MIDNIGHT
 *                      beat - and holds there, crushed and smoking;
 *  break  F+0.55 ..    it comes apart, the drum, cab and wheels thrown off
 *         F+1.0        and fading.
 *
 *  On screen for about 1.9 s against 0.3 before, most of it inside the frame.
 *
 *  It is drawn as a manga prop rather than a lit metal box: flat toon bands
 *  from a fixed key, so it reads in any arena's light, a yellow body over
 *  dark iron, and an ink hull. In stopped time the grade prints the world
 *  two-tone and keeps only pure black as ink: the paint goes pale, the iron
 *  teal and the outline stays, so the roller reads there too. Nothing is
 *  built mid-fight: one roller is made and drawn under the floor at load
 *  (linking its two programs), and it is the first one handed out. */

/** Seconds before the finisher it comes into the stop, the height it comes
 *  in from, the height it is held at over the victim and how long before the
 *  finisher it is held from; how long it takes to slam down, how long it
 *  holds crushed and how long it takes to come apart. */
export const ROLLER_TIMING = { drop: 1, from: 6.5, held: 2.3, hold: .7, settle: 1.95, slam: .15, wreck: .55, breakUp: .45 } as const;

export interface RollerPose {
  /** Metres over the victim's floor. */
  height: number;
  /** Nose-down pitch, radians: thrown, then levelling as it falls. */
  tilt: number;
  /** Vertical squash: 1 in the air, crushed flat on landing. */
  squash: number;
  /** Seconds since it landed (negative while falling). */
  since: number;
  /** 0..1 through coming apart. */
  broken: number;
  opacity: number;
}

/** Where the roller is `elapsed` seconds into an ultimate whose finisher
 *  lands at `finisher`; undefined when it is not in the scene.
 *
 *  Thrown in stopped time, it stops where LORD ORO lets go of it - the thing his
 *  knives do - hanging over the victim's head where the camera can see it,
 *  sinking a little, and slams down as the clock starts again. */
export function rollerAt(elapsed: number, finisher: number): RollerPose | undefined {
  const T = ROLLER_TIMING, since = elapsed - finisher;
  if (since < -T.drop || since >= T.wreck + T.breakUp) return undefined;
  if (since < -T.hold) {
    // Coming in fast from above and stopping short, easing out.
    const e = 1 - (since + T.drop) / (T.drop - T.hold);
    return { height: T.held + (T.from - T.held) * e * e, tilt: .12 + .26 * e, squash: 1, since, broken: 0, opacity: 1 };
  }
  if (since < -T.slam) {
    const e = (since + T.hold) / (T.hold - T.slam);
    return { height: T.held + (T.settle - T.held) * e, tilt: .12 * (1 - e) + .05 * e, squash: 1, since, broken: 0, opacity: 1 };
  }
  if (since < 0) {
    const e = 1 + since / T.slam;
    return { height: T.settle * (1 - e * e), tilt: .05 * (1 - e), squash: 1, since, broken: 0, opacity: 1 };
  }
  // Crushed on landing - flattened hard for a tenth of a second, then it
  // settles a little, and stays crushed.
  const squash = .8 + .1 * THREE.MathUtils.smoothstep(since, 0, .12);
  const broken = THREE.MathUtils.clamp((since - T.wreck) / T.breakUp, 0, 1);
  return { height: 0, tilt: 0, squash, since, broken, opacity: 1 - THREE.MathUtils.smoothstep(broken, .3, 1) };
}

const TOON_VERTEX = /* glsl */`
varying vec3 vN;varying vec3 vV;varying vec2 vUv;
void main(){
  vec4 world=modelMatrix*vec4(position,1.);
  vN=normalize(mat3(modelMatrix)*normal);vV=cameraPosition-world.xyz;vUv=uv;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
/** Two toon bands and a highlight from a fixed key over the front, a rim of
 *  the lit colour, and hatching in the shade. Round 3c: over a painted map -
 *  the sourced roller's own paint, or a white texel for the primitives it
 *  replaces while it loads - so both are one program, linked at load. */
const TOON_FRAGMENT = /* glsl */`
uniform vec3 uLit;uniform vec3 uShade;uniform float uOpacity;uniform sampler2D uMap;
varying vec3 vN;varying vec3 vV;varying vec2 vUv;
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  // The sourced paint is a Substance olive-yellow made for PBR light: lifted
  // (a power under one) and its saturated texels warmed from olive toward
  // hour of ruin yellow. White - the primitives' map - is left exactly white.
  vec3 paint=pow(texture2D(uMap,vUv).rgb,vec3(.7));
  float pmax=max(paint.r,max(paint.g,paint.b)),psat=(pmax-min(paint.r,min(paint.g,paint.b)))/max(pmax,1e-3);
  paint.g*=mix(1.,.86,psat);
  float l=dot(n,normalize(vec3(.35,.85,.45)));
  float lit=smoothstep(.02,.12,l),high=smoothstep(.72,.8,l);
  vec3 col=mix(uShade,uLit,lit)*paint+uLit*paint*high*.25;
  float rim=smoothstep(.62,.8,1.-abs(dot(n,v)));
  col=mix(col,uLit*paint*1.1+.04,rim*.35);
  vec2 f=gl_FragCoord.xy;
  col*=1.-.3*smoothstep(.8,.97,sin((f.x-f.y)*.6))*(1.-lit);
  gl_FragColor=vec4(col*uOpacity,uOpacity);
}`;
const INK_FRAGMENT = /* glsl */`uniform float uOpacity;void main(){gl_FragColor=vec4(vec3(0.),uOpacity);}`;
const premultiplied = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;

export const ROLLER_ASSET = '/assets/props/steamroller1.glb';
export const HOUR_OF_RUIN_ASSETS = [ROLLER_ASSET] as const;
/** How each piece of the sourced roller flies when it comes apart: the drums
 *  roll off front and back, the hood and the roll bar go up, the rest scatters. */
const PIECES: Record<string, { fly: [number, number, number]; spin: [number, number, number] }> = {
  'drum-front': { fly: [0, 2.2, 5.5], spin: [9, 0, 0] },
  'drum-rear': { fly: [.3, 2.4, -4.8], spin: [-9, 0, 1] },
  hood: { fly: [.8, 5.2, 2.6], spin: [3, 1, 2] },
  engine: { fly: [-.6, 4.2, -2], spin: [-2, 1.5, 1] },
  seat: { fly: [-1.4, 6.2, -.4], spin: [-3, 2, 2.5] },
  rollbar: { fly: [1.4, 7.5, -1.8], spin: [4, -3, 3] },
  chassis: { fly: [.4, 2, .3], spin: [1, .5, -1] },
};
/** The sourced paint (sRGB, decoded by the texture unit): lit it prints as
 *  painted, shaded it goes a cool, dark version of itself. */
const SOURCED = { lit: new THREE.Color(1.6, 1.55, 1.2), shade: new THREE.Color(.6, .58, .76) };
/** A white texel: the primitives' paint is their colour alone. */
const WHITE = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();

/** A part: its geometry, its paint, where it sits on the roller, and which
 *  way it is thrown when the roller comes apart (metres a second, and a spin). */
export interface PartSpec { geometry: THREE.BufferGeometry; paint: 'yellow' | 'iron' | 'glass' | 'tyre' | 'sourced' | (string & {}); at: THREE.Matrix4; fly: THREE.Vector3; spin: THREE.Vector3 }
const PAINT = {
  yellow: [new THREE.Color(1, .74, .06), new THREE.Color(.62, .3, .02)],
  iron: [new THREE.Color(.36, .38, .44), new THREE.Color(.09, .095, .12)],
  glass: [new THREE.Color(.34, .5, .62), new THREE.Color(.06, .1, .14)],
  tyre: [new THREE.Color(.17, .17, .19), new THREE.Color(.045, .045, .05)],
} as const;
const at = (x: number, y: number, z: number, rx = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)).setPosition(x, y, z);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The parts, in the roller's own metres (it is drawn 1.5x): a steel drum in
 *  front under a yellow yoke, the engine body behind it, a cab with dark
 *  windows on top, an exhaust stack, and two big rear tyres. */
function buildParts(): PartSpec[] {
  const drum = new THREE.CylinderGeometry(.56, .56, 1.5, 22), rim = new THREE.CylinderGeometry(.6, .6, .1, 22);
  const yoke = new THREE.BoxGeometry(1.62, .22, .7), body = new THREE.BoxGeometry(1.25, .78, 1.55), hood = new THREE.BoxGeometry(1.1, .2, 1.1);
  const cab = new THREE.BoxGeometry(1.02, .7, .82), roof = new THREE.BoxGeometry(1.16, .08, .96), glass = new THREE.BoxGeometry(1.04, .38, .84);
  const stack = new THREE.CylinderGeometry(.06, .07, .55, 8), tyre = new THREE.CylinderGeometry(.46, .46, .32, 16), hub = new THREE.CylinderGeometry(.2, .2, .34, 10);
  const side = Math.PI / 2;
  return [
    { geometry: drum, paint: 'iron', at: at(0, .56, .98, 0, side), fly: v(0, 2.2, 5.5), spin: v(9, 0, 0) },
    { geometry: rim, paint: 'yellow', at: at(.74, .56, .98, 0, side), fly: v(2.6, 3, 4.5), spin: v(8, 0, 2) },
    { geometry: rim, paint: 'yellow', at: at(-.74, .56, .98, 0, side), fly: v(-2.6, 3, 4.5), spin: v(8, 0, -2) },
    { geometry: yoke, paint: 'yellow', at: at(0, 1.2, .95), fly: v(.6, 5, 2.4), spin: v(3, 1, 2) },
    { geometry: body, paint: 'yellow', at: at(0, .98, -.28), fly: v(-.4, 3.4, -1.6), spin: v(-1.5, .8, 1) },
    { geometry: hood, paint: 'iron', at: at(0, 1.47, -.45), fly: v(.8, 5.5, -1.2), spin: v(2, 3, -2) },
    { geometry: cab, paint: 'yellow', at: at(0, 1.72, -.52), fly: v(-1, 6.2, -2.4), spin: v(-3, 2, 2.5) },
    { geometry: glass, paint: 'glass', at: at(0, 1.8, -.52), fly: v(-1, 6.2, -2.4), spin: v(-3, 2, 2.5) },
    { geometry: roof, paint: 'yellow', at: at(0, 2.11, -.52), fly: v(1.4, 7.5, -1.8), spin: v(4, -3, 3) },
    { geometry: stack, paint: 'iron', at: at(.42, 1.75, .2), fly: v(2.4, 6.5, .6), spin: v(6, 0, 5) },
    { geometry: tyre, paint: 'tyre', at: at(.66, .46, -.92, 0, side), fly: v(4.4, 2.4, -2), spin: v(0, 0, 11) },
    { geometry: tyre, paint: 'tyre', at: at(-.66, .46, -.92, 0, side), fly: v(-4.4, 2.4, -2), spin: v(0, 0, -11) },
    { geometry: hub, paint: 'yellow', at: at(.7, .46, -.92, 0, side), fly: v(4.4, 2.4, -2), spin: v(0, 0, 11) },
    { geometry: hub, paint: 'yellow', at: at(-.7, .46, -.92, 0, side), fly: v(-4.4, 2.4, -2), spin: v(0, 0, -11) },
  ];
}

const SCALE = 1.5, GRAVITY = 16, INK = 1.05;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _spin = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _squash = new THREE.Matrix4(), HULL = new THREE.Matrix4().makeScale(INK, INK, INK);

/** One hour of ruin: a group of parts, each a painted mesh with an ink hull. */
export class HourOfRuin {
  readonly group = new THREE.Group();
  private opacity = { value: 1 };
  private materials: THREE.ShaderMaterial[] = [];
  private paints = new Map<string, THREE.ShaderMaterial>();
  private ink: THREE.ShaderMaterial;
  private parts: { spec: PartSpec; mesh: THREE.Mesh; ink: THREE.Mesh }[] = [];
  /** Who it falls on, where it landed, and which way it faces, latched as it
   *  appears; the one-shot beats already thrown. */
  target?: string; yaw = 0; landed = false; broke = false; live = false; nextSmoke = 0;
  readonly spot = new THREE.Vector3();
  constructor(specs: PartSpec[], map?: THREE.Texture) {
    this.group.name = 'hour-of-ruin'; this.group.visible = false;
    for (const [name, [lit, shade]] of Object.entries({ ...PAINT, ...ORIGINAL_FINISHER_PROP.paints })) this.paints.set(name, this.paint(lit, shade, ORIGINAL_FINISHER_PROP.maps?.[name]?.() ?? WHITE));
    this.paints.set('sourced', this.paint(SOURCED.lit, SOURCED.shade, map ?? WHITE));
    this.ink = new THREE.ShaderMaterial({ name: 'HourOfRuinInk', vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: INK_FRAGMENT,
      side: THREE.BackSide, transparent: true, ...premultiplied, uniforms: { uOpacity: this.opacity } });
    this.materials.push(this.ink);
    this.build(specs);
  }
  private paint(lit: THREE.Color, shade: THREE.Color, map: THREE.Texture) {
    const m = new THREE.ShaderMaterial({ name: 'HourOfRuinToon', vertexShader: TOON_VERTEX, fragmentShader: TOON_FRAGMENT, transparent: true, toneMapped: false, ...premultiplied,
      uniforms: { uLit: { value: lit.clone() }, uShade: { value: shade.clone() }, uOpacity: this.opacity, uMap: { value: map } } });
    this.materials.push(m);
    return m;
  }
  /** (Re)build the parts - the primitives, then the sourced model when it
   *  arrives. The same two programs either way. */
  build(specs: PartSpec[], map?: THREE.Texture) {
    if (map) (this.paints.get('sourced')!.uniforms.uMap as { value: THREE.Texture }).value = map;
    for (const part of this.parts) part.mesh.removeFromParent(), part.ink.removeFromParent();
    this.parts = [];
    for (const spec of specs) {
      const mesh = new THREE.Mesh(spec.geometry, this.paints.get(spec.paint)!), hull = new THREE.Mesh(spec.geometry, this.ink);
      mesh.name = 'hour-of-ruin-part'; hull.name = 'hour-of-ruin-ink';
      mesh.matrixAutoUpdate = hull.matrixAutoUpdate = false; mesh.frustumCulled = hull.frustumCulled = false;
      this.group.add(mesh, hull); this.parts.push({ spec, mesh, ink: hull });
    }
    this.pose({ height: 0, tilt: 0, squash: 1, since: -1, broken: 0, opacity: 1 }, 0);
  }
  /** Whether the sourced model is what this roller is drawing. */
  get sourced() { return this.parts.some(p => p.spec.paint === 'sourced'); }
  /** Place the parts for `pose`; `shake` metres of jitter from the pounding. */
  pose(p: RollerPose, shake: number) {
    this.opacity.value = p.opacity;
    const flight = p.broken * ROLLER_TIMING.breakUp;
    // Crushed from the floor up: the height squashes, the footprint spreads a little.
    _squash.makeScale(1 + (1 - p.squash) * .35, p.squash, 1 + (1 - p.squash) * .35);
    for (const part of this.parts) {
      _m.copy(part.spec.at);
      if (flight > 0) {
        _m.decompose(_p, _q, _s);
        const f = part.spec.fly, w = part.spec.spin;
        _p.set(_p.x + f.x * flight, Math.max(.1, _p.y + f.y * flight - .5 * GRAVITY * flight * flight), _p.z + f.z * flight);
        _q.premultiply(_spin.setFromEuler(_e.set(w.x * flight, w.y * flight, w.z * flight)));
        _m.compose(_p, _q, _s);
      }
      part.mesh.matrix.multiplyMatrices(_squash, _m);
      // The hull scales about the part's own centre: every part is built centred.
      part.ink.matrix.multiplyMatrices(part.mesh.matrix, HULL);
    }
    this.group.scale.setScalar(SCALE);
    this.group.rotation.set(p.tilt, this.yaw, 0, 'YXZ');
    this.group.position.set(this.spot.x + (shake ? (Math.random() - .5) * shake : 0), this.spot.y + p.height + (shake ? Math.random() * shake : 0), this.spot.z);
  }
  dispose() { this.group.removeFromParent(); for (const m of this.materials) m.dispose(); }
}

/** The rollers of a match: one per LORD ORO, built from shared geometry, the
 *  first of them made and drawn at load. */
export class HourOfRuins {
  private specs = ORIGINAL_FINISHER_PROP.parts?.() ?? buildParts();
  private pool = new Map<string, HourOfRuin>();
  private spare: HourOfRuin[] = [];
  private map?: THREE.Texture;
  constructor(private scene: THREE.Scene) {
    // Drawn once under the floor at load, so its programs are linked before
    // the first MIDNIGHT; then it is the first roller handed out.
    const warm = this.make();
    this.warmUp(warm);
    this.spare.push(warm);
    // The sourced model comes in behind the primitives (round 3c). In the
    // browser only: the tests build rollers with no network.
    if (typeof document !== 'undefined' && ORIGINAL_FINISHER_PROP.fetch !== false) void this.load();
  }
  private warm?: THREE.Object3D;
  /** Draw a roller once under the floor, then hide it: links its programs
   *  (and, once the sourced model is in, uploads its paint) at load rather
   *  than on the first MIDNIGHT. */
  private warmUp(roller: HourOfRuin) {
    this.settle();
    roller.group.visible = true; roller.spot.set(0, -60, 0); roller.pose({ height: 0, tilt: 0, squash: 1, since: -1, broken: 0, opacity: 1 }, 0);
    this.warm = roller.group.children[0];
    this.warm.onAfterRender = () => { roller.group.visible = false; this.settle(); };
  }
  /** The warm-up's hook comes off once it has drawn, or once the roller is handed out. */
  private settle() { if (this.warm) { this.warm.onAfterRender = () => {}; this.warm = undefined; } }
  private make() { const roller = new HourOfRuin(this.specs, this.map); this.scene.add(roller.group); return roller; }
  /** Load the sourced roller and rebuild every roller from it. A missing or
   *  broken file leaves the primitives: the roller is dressing. */
  async load() {
    try {
      const gltf = await new GLTFLoader().loadAsync(ROLLER_ASSET);
      gltf.scene.updateMatrixWorld(true);
      const specs: PartSpec[] = [];
      let map: THREE.Texture | undefined;
      gltf.scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const piece = PIECES[mesh.name.replace(/^roller-/, '')] ?? PIECES.chassis;
        map ??= (mesh.material as THREE.MeshStandardMaterial).map ?? undefined;
        specs.push({ geometry: mesh.geometry, paint: 'sourced', at: mesh.matrixWorld.clone(), fly: new THREE.Vector3(...piece.fly), spin: new THREE.Vector3(...piece.spin) });
      });
      if (!specs.length) return;
      const old = this.specs;
      this.specs = specs; this.map = map;
      for (const roller of [...this.pool.values(), ...this.spare]) roller.build(specs, map);
      for (const geometry of new Set(old.map(s => s.geometry))) geometry.dispose();
      const idle = this.spare[this.spare.length - 1];
      if (idle) this.warmUp(idle);
    } catch (error) { console.warn('Hour of Ruin model did not load; drawing the primitives', error); }
  }
  for(id: string) {
    let roller = this.pool.get(id);
    if (!roller) { this.settle(); roller = this.spare.pop() ?? this.make(); roller.live = false; roller.group.visible = false; this.pool.set(id, roller); }
    return roller;
  }
  get(id: string) { return this.pool.get(id); }
  release(id: string) { const roller = this.pool.get(id); if (!roller) return; roller.group.visible = false; roller.live = false; this.pool.delete(id); this.spare.push(roller); }
  reset() { for (const id of [...this.pool.keys()]) this.release(id); }
  dispose() {
    for (const roller of [...this.pool.values(), ...this.spare]) roller.dispose();
    this.pool.clear(); this.spare = [];
    for (const spec of new Set(this.specs.map(s => s.geometry))) spec.dispose();
    this.map?.dispose();
  }
}
