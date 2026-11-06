import * as THREE from 'three';
import { GROUND_NOISE } from './glsl';
import { edit, groundMaterial, withLookHead } from './toon';
import type { GroundFrame, GroundTick } from './frame';
import type { GroundTier } from './quality';
import { DENSITY, GroundField, SPARE, type Rect } from './mask';
import { WaveField, type Impulse } from './waves';
import { addShaderPatch } from '../look/shaderPatch';

/** How water looks (sRGB hex): a crest's highlight and its foam, laid on the
 *  water's own colour. A surface drawn with the place's own water material
 *  (WaterPlan `source`) keeps that material's colour, light and flow, and
 *  needs no more; one without draws its own body: `deep` to `shallow`, with
 *  `map` (painted water) laid every `tile` metres and drifting along `flow`
 *  (m/s), its light and dark carried into those colours by `mapAmount`. */
export interface WaterLook {
  crest: number; foam: number;
  deep?: number; shallow?: number;
  map?: THREE.Texture | null; tile?: number; flow?: [number, number]; mapAmount?: number;
}

/** Dev builds: `window.__water.sim(false)` holds every wave field still (its
 *  steps not run), for costing the simulation apart from the surface;
 *  `__water.extra(n)` runs n more steps a frame (the waves run on faster), for
 *  costing a step above the noise of other work on the machine. */
const WATER_DEV = { paused: false, extra: 0, cell: 0, live: new Set<WaterSurface>() };
if (import.meta.env?.DEV && typeof window === 'object') (window as unknown as { __water?: unknown }).__water = {
  sim: (on: boolean) => { WATER_DEV.paused = !on; }, extra: (n: number) => { WATER_DEV.extra = n; },
  /** Every surface's grid at `cell` metres (0: its tier's), for costing the grid. */
  cell: (cell: number) => { WATER_DEV.cell = cell; for (const w of WATER_DEV.live) w.regrid(); },
  /** Each surface up now: whether its waves run, at what grid and rate, and its mesh's vertices. */
  state: () => [...WATER_DEV.live].map(w => w.state()),
};

/** A water surface with a wave field: its rectangle of floor and level, the
 *  stretch the waves are simulated over (inside it), which ends of that stretch
 *  are open water, the banks and whatever stands in the water (painted into a
 *  mask, DENSITY 1 a wall), its look, and the waves' speed and damping. */
export interface WaterPlan {
  name: string;
  /** The surface's rectangle of floor, for a surface of its own (no `source`). */
  rect?: Rect; level: number;
  sim: Rect;
  /** Which ends of the simulated stretch are open water: its z ends (a
   *  river's up and down), then its x ends (a lake's sides). */
  open?: readonly [boolean, boolean, boolean?, boolean?];
  walls: (field: GroundField) => void;
  wallTexel?: number;
  look: WaterLook;
  /** The place's own water surface, when it has one: the waves are drawn on
   *  it, as one more edit of its material's shader - its painted water, its
   *  flow, its light and every look the place's other layers gave it kept, and
   *  no new draw. */
  source?: THREE.Mesh;
  speed?: number; damping?: number;
  /** How far the waves tilt the surface's light (the slope's gain, 6 by
   *  default): less on a glossy surface, where the sun's glint off every
   *  wave front would wash out the water's own colour. */
  slope?: number;
  /** Water falling in: a push at the foot of each, about every `every` seconds. */
  sources?: { x: number; z: number; radius: number; depth: number; every: number }[];
}

const WATER_VERTEX = /* glsl */`
uniform sampler2D uWaves;
uniform vec4 uSimRect;
uniform float uWaveOn;
uniform float uWaveLift;
varying vec3 vWaterWorld;`;

/** What every surface's fragments share: the field, the banks, and the waves'
 *  marks on the water worked out once a fragment (in color_fragment) and laid
 *  on its colour and its glow alike (`waterTone`). */
const WATER_FRAGMENT = /* glsl */`
uniform sampler2D uWaves;
uniform sampler2D uWalls;
uniform vec4 uSimRect;
uniform vec2 uWaveTexel;
uniform float uWaveOn;
uniform float uWaveSlope;
uniform vec3 uCrest;
uniform vec3 uFoam;
uniform float uWaterTime;
varying vec3 vWaterWorld;
${GROUND_NOISE}
float waterH( vec2 uv ) { return texture2D( uWaves, uv ).r; }
float waterRaise, waterLower, waterTrough, waterRing, waterFoam;
vec3 waterTone( vec3 c, vec3 light ) {
	c = mix( c, uCrest * light, waterRaise );
	c *= 1. - waterLower;
	c = mix( c, c * .3, waterTrough );
	c = mix( c, uCrest * light * 1.1, waterRing );
	return mix( c, uFoam * light, waterFoam );
}`;

/** A surface's own body, when it has no material of the place's to draw with. */
const WATER_BODY = /* glsl */`
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec2 uWaterFlow;
uniform float uWaterTile;
uniform float uMapAmount;
uniform sampler2D uWaterMap;
uniform float uWaterMapOn;`;

/** The waves' marks, worked out in color_fragment (the colour comes before the
 *  normal in three's shaders): the field's height and slope here, then
 *  ripples drawn as thin light rings on the water, contour lines
 *  on the wave field a pixel or two wide whatever the wave's size (fwidth) -
 *  over a soft tone, crests a little lighter and troughs deeper; and foam where
 *  the tallest crests break and along the banks, breathing. */
const WATER_MARKS = /* glsl */`
	// Inside the field, tested here per pixel: a place's own flat surface is a
	// few big triangles, its corners far outside the field.
	vec2 waterRel = ( vWaterWorld.xz - uSimRect.xy ) / uSimRect.zw;
	float waterInside = step( 0., waterRel.x ) * step( waterRel.x, 1. ) * step( 0., waterRel.y ) * step( waterRel.y, 1. );
	vec2 waterUv = clamp( waterRel, 0., 1. );
	float waterOn = uWaveOn * waterInside;
	float waterHere = waterOn * waterH( waterUv );
	// (Out of any branch: a derivative needs its neighbours to have run it.)
	float waterStep = max( fwidth( waterHere ), 1e-5 );
	vec2 waterSlope = vec2( 0. );
	waterRaise = 0.; waterLower = 0.; waterTrough = 0.; waterRing = 0.; waterFoam = 0.;
	if ( waterOn > .5 ) {
		waterSlope = vec2( waterH( waterUv + vec2( uWaveTexel.x, 0. ) ) - waterH( waterUv - vec2( uWaveTexel.x, 0. ) ),
			waterH( waterUv + vec2( 0., uWaveTexel.y ) ) - waterH( waterUv - vec2( 0., uWaveTexel.y ) ) ) / ( 2. * uWaveTexel * uSimRect.zw );
		// Only where the surface moves: a flat river draws no line.
		float moving = smoothstep( .04, .2, length( waterSlope ) * 6. );
		float near = 1. - smoothstep( 1.2, 2.4, abs( waterHere - .005 ) / waterStep );
		float high = 1. - smoothstep( 1.2, 2.4, abs( waterHere - .024 ) / waterStep );
		waterRing = max( near, high ) * moving * .95;
		waterTrough = ( 1. - smoothstep( 1.2, 2.4, abs( waterHere + .006 ) / waterStep ) ) * moving * .8;
		waterRaise = smoothstep( .004, .06, waterHere ) * .35;
		waterLower = smoothstep( .002, .04, - waterHere ) * .3;
	}
	{
		vec2 p = vWaterWorld.xz;
		float breakUp = groundNoise( p * 3.1 + uWaterTime * .35 ) * .6 + groundNoise( p * 7.7 - uWaterTime * .5 ) * .4;
		float crestFoam = smoothstep( .08, .13, waterHere ) * smoothstep( .35, .6, breakUp );
		// The banks' band (worked out once, into the mask's alpha).
		float shore = waterInside > .5 ? texture2D( uWalls, waterUv ).a : 0.;
		float shoreFoam = shore * smoothstep( .3, .55, breakUp + sin( uWaterTime * 1.3 + p.x * .7 + p.y * .5 ) * .12 );
		waterFoam = max( crestFoam, shoreFoam ) * .92;
	}`;

/** The body a surface draws when the place has no water material for it: the
 *  painted water drifting two ways at once (ambient.ts flowWater's look) over
 *  a deep-to-shallow ramp. */
const WATER_OWN_BODY = /* glsl */`
	{
		vec2 p = vWaterWorld.xz;
		float paint = .5;
		if ( uWaterMapOn > .5 ) {
			vec3 a = texture2D( uWaterMap, p / uWaterTile + uWaterFlow * uWaterTime ).rgb, b = texture2D( uWaterMap, p / uWaterTile * 1.31 + vec2( .37, .11 ) + uWaterFlow * uWaterTime * 1.7 ).rgb;
			paint = dot( mix( a, b, .45 ), vec3( .2126, .7152, .0722 ) );
		}
		float ripple = groundNoise( p * .9 + uWaterFlow * uWaterTime * 6. ) * .5 + groundNoise( p * 2.3 - uWaterFlow * uWaterTime * 9. ) * .5;
		diffuseColor.rgb = mix( uDeep, uShallow, clamp( mix( ripple, paint * 1.6, uMapAmount ), 0., 1. ) );
	}`;

/**
 * A water surface with real waves: a grid over the water, its middle dense
 * where the wave field runs, lifted by the field's height and lit off the
 * waves' own slopes, with ripple rings, troughs and foam drawn on it. Drawn
 * with the place's own water material where it has one (its painted water,
 * flow and light kept: the waves are laid on the place's own look), else with
 * the fighters' cel shading over a body of its own. Every splash the game
 * throws (VfxKit.splash: a step, a dash, a landing, a fall, a blow into the
 * floor) pushes the field; so does every body wading through it, and water
 * falling in. 'low' draws the still surface.
 */
export class WaterSurface {
  readonly mesh: THREE.Mesh;
  readonly walls: THREE.DataTexture;
  waves?: WaveField;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly tier: { sim: boolean; cell: number; rate: number };
  private sourceClock: number[] = [];
  private readonly wakes = new Map<string, { x: number; z: number }>();
  private renderer?: THREE.WebGLRenderer;
  private unsupported = false;

  constructor(private readonly frame: GroundFrame, readonly plan: WaterPlan) {
    const mask = new GroundField(plan.sim, plan.wallTexel ?? .25);
    plan.walls(mask);
    // The banks' foam band, worked out once here rather than in every pixel:
    // the water within 0.7 m of a wall (SPARE: the texture's alpha).
    const wall = (x: number, z: number) => mask.sample(DENSITY, x, z);
    mask.map(SPARE, (_, x, z) => Math.max(wall(x + .7, z), wall(x - .7, z), wall(x, z + .7), wall(x, z - .7)) * (1 - wall(x, z)));
    this.walls = new THREE.DataTexture(mask.bytes(), mask.width, mask.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.walls.minFilter = this.walls.magFilter = THREE.LinearFilter; this.walls.needsUpdate = true; this.walls.name = `${plan.name} banks`;
    const s = plan.sim, look = plan.look;
    this.tier = { ...frame.tier.water };
    this.uniforms = {
      uWaves: { value: null }, uWalls: { value: this.walls },
      uSimRect: { value: new THREE.Vector4(s.x0, s.z0, s.x1 - s.x0, s.z1 - s.z0) },
      uWaveTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
      uWaveOn: { value: 0 }, uWaveLift: { value: .8 }, uWaveSlope: { value: plan.slope ?? 6 },
      uCrest: { value: new THREE.Color(look.crest) }, uFoam: { value: new THREE.Color(look.foam) },
      uWaterTime: frame.time,
    };
    const source = plan.source;
    if (source) {
      // The place's own surface draws the waves: one more edit of its
      // material's shader, and it drives the ground's tick.
      for (const material of Array.isArray(source.material) ? source.material : [source.material]) addShaderPatch(material, 'ground-water-waves-v1', shader => this.patch(shader, false));
      this.mesh = source;
    } else {
      if (!plan.rect) throw new Error(`${plan.name}: a water surface of its own needs its rect`);
      Object.assign(this.uniforms, {
        uDeep: { value: new THREE.Color(look.deep ?? 0x1c3048) }, uShallow: { value: new THREE.Color(look.shallow ?? 0x3e6c88) },
        uWaterFlow: { value: new THREE.Vector2(...(look.flow ?? [0, 0])) }, uWaterTile: { value: look.tile ?? 6 },
        uMapAmount: { value: look.mapAmount ?? .6 }, uWaterMap: { value: look.map ?? this.walls }, uWaterMapOn: { value: look.map ? 1 : 0 },
      });
      const material = groundMaterial(`${plan.name} surface`, 'ground-water-v2', shader => this.patch(shader, true));
      this.mesh = new THREE.Mesh(waterGeometry(plan.rect, plan.sim, plan.level, meshCell(frame.tier.water)), material);
      this.mesh.name = plan.name; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    }
    frame.drive(this.mesh);
    frame.add(this);
    this.setQuality(frame.tier);
    if (import.meta.env?.DEV) WATER_DEV.live.add(this);
  }

  /** What the dev probe reports of it. */
  state() {
    const w = this.waves;
    return { name: this.plan.name, sim: !!w, cell: w ? this.tier.cell : null, rate: w ? this.tier.rate : null, field: w ? [w.width, w.height] : null, vertices: this.mesh.geometry.getAttribute('position').count, own: !!this.plan.source };
  }

  /** The waves' edit of the surface's shader: the lift, the marks laid on its
   *  colour and its glow, and its normal off the waves' slopes; `body` draws
   *  the water's own colour first (a surface with no material of the place's). */
  private patch(shader: THREE.WebGLProgramParametersWithUniforms, body: boolean) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = WATER_VERTEX + shader.vertexShader;
    shader.vertexShader = edit(shader.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>
	{
		vWaterWorld = ( modelMatrix * vec4( transformed, 1. ) ).xyz;
		vec2 suv = ( vWaterWorld.xz - uSimRect.xy ) / uSimRect.zw;
		// A grid of its own is lifted by the waves (a place's own flat surface
		// has its corners outside the field: the waves are drawn on it).
		float inside = step( 0., suv.x ) * step( suv.x, 1. ) * step( 0., suv.y ) * step( suv.y, 1. );
		float lift = uWaveOn * inside * texture2D( uWaves, clamp( suv, 0., 1. ) ).r * uWaveLift;
		transformed.y += lift; vWaterWorld.y += lift;
	}`, 'water lift');
    shader.fragmentShader = WATER_FRAGMENT + (body ? WATER_BODY : '') + shader.fragmentShader;
    shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
${body ? WATER_OWN_BODY : ''}
${WATER_MARKS}
	diffuseColor.rgb = waterTone( diffuseColor.rgb, vec3( 1. ) );`, 'water colour');
    // The glow too (painted water glows with its own colours, as its emissive
    // map; a dark lake glows with the sky it mirrors), the
    // rings and foam glowing at least a little whatever the water's own glow,
    // so they read on dark water. Laid after every glow the material's other
    // edits add (they go under emissivemap_fragment), before the lights' maps.
    shader.fragmentShader = edit(shader.fragmentShader, '#include <lights_fragment_maps>', `totalEmissiveRadiance = waterTone( totalEmissiveRadiance, max( emissive, vec3( .3 ) ) );
#include <lights_fragment_maps>`, 'water glow');
    shader.fragmentShader = edit(shader.fragmentShader, '#include <normal_fragment_begin>', `#include <normal_fragment_begin>
	{
		vec3 waterN = normalize( vec3( - waterSlope.x * uWaveSlope, 1., - waterSlope.y * uWaveSlope ) );
		normal = normalize( ( viewMatrix * vec4( waterN, 0. ) ).xyz );
		nonPerturbedNormal = normal;
	}`, 'water normal');
  }

  setQuality(tier: GroundTier) {
    const want = this.unsupported ? { ...tier.water, sim: false } : tier.water;
    const changed = !!this.waves !== want.sim || (this.waves && Math.abs(this.tier.cell - want.cell) > 1e-6);
    Object.assign(this.tier, want);
    if (!changed) return;
    this.waves?.dispose(); this.waves = undefined;
    if (want.sim) {
      this.waves = new WaveField(this.plan.sim, this.walls, { cell: want.cell, rate: want.rate, speed: this.plan.speed ?? 3.2, damping: this.plan.damping ?? .45, open: this.plan.open });
      this.uniforms.uWaveTexel.value.copy(this.waves.texel);
    }
    this.uniforms.uWaveOn.value = this.waves ? 1 : 0;
    // A disposed field's texture is never bound again (a still surface reads none).
    this.uniforms.uWaves.value = this.waves?.state.value ?? null;
    this.regrid();
  }

  /** A surface of its own: its grid follows the field's (a still surface is a coarse one). */
  regrid() {
    if (this.plan.source || !this.plan.rect) return;
    const geometry = waterGeometry(this.plan.rect, this.plan.sim, this.plan.level, WATER_DEV.cell || meshCell(this.waves ? this.tier : { sim: false, cell: 0 }));
    this.mesh.geometry.dispose(); this.mesh.geometry = geometry;
  }

  /** A push from outside (a splash). */
  push(p: Impulse) { this.waves?.push(p); }

  tick(t: GroundTick) {
    if (!this.renderer) {
      this.renderer = t.renderer;
      // The field draws to half-float targets: without them, the still surface.
      if (!t.renderer.extensions.has('EXT_color_buffer_float') && !t.renderer.extensions.has('EXT_color_buffer_half_float')) {
        this.waves?.dispose(); this.waves = undefined; this.uniforms.uWaveOn.value = 0; this.uniforms.uWaves.value = null; this.unsupported = true; this.regrid();
      }
    }
    const waves = this.waves;
    if (!waves) return;
    const level = this.plan.level;
    // Bodies wading leave a wake (a run's steps splash, and push the water through VfxKit.splashed too).
    for (const b of t.bodies) {
      if (Math.abs(b.y - level) > .3) { this.wakes.delete(b.id); continue; }
      const speed = Math.hypot(b.vx, b.vz), last = this.wakes.get(b.id);
      if (speed > .4 && last && Math.hypot(b.x - last.x, b.z - last.z) > .35) {
        waves.push({ x: b.x, z: b.z, radius: .45, depth: Math.min(.006, .0015 + speed * .0006) });
        last.x = b.x; last.z = b.z;
      } else if (!last) this.wakes.set(b.id, { x: b.x, z: b.z });
    }
    // Water falling in.
    (this.plan.sources ?? []).forEach((s, i) => {
      this.sourceClock[i] = (this.sourceClock[i] ?? Math.random() * s.every) - t.dt;
      if (this.sourceClock[i] > 0) return;
      this.sourceClock[i] = s.every * (.6 + Math.random() * .8);
      const a = Math.random() * Math.PI * 2, r = Math.random() * s.radius;
      waves.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, radius: .5 + Math.random() * .6, depth: s.depth * (.6 + Math.random() * .7) });
    });
    if (!WATER_DEV.paused) {
      waves.step(t.renderer, t.dt);
      for (let i = 0; i < WATER_DEV.extra; i++) waves.step(t.renderer, 1 / this.tier.rate);
    }
    this.uniforms.uWaves.value = waves.state.value;
  }

  dispose() { this.waves?.dispose(); this.walls.dispose(); WATER_DEV.live.delete(this); }
}

/** The surface's grid for a tier's water: a little coarser than the wave
 *  field it is lifted by (the pixels read the field's slopes for their light),
 *  and coarse where the water is still. */
export function meshCell(water: { sim: boolean; cell: number }) { return water.sim ? Math.max(.25, water.cell * 1.4) : 2; }

/** A grid over the water: `cell` metres apart over the simulated stretch, and
 *  four times that beyond it (the surface there is still). */
export function waterGeometry(rect: Rect, sim: Rect, level: number, cell: number) {
  const axis = (a0: number, a1: number, s0: number, s1: number) => {
    const out: number[] = [];
    const coarse = cell * 4;
    for (let v = a0; v < s0 - 1e-6; v = Math.min(s0, v + coarse)) out.push(v);
    for (let v = Math.max(a0, s0); v < Math.min(a1, s1) - 1e-6; v += cell) out.push(v);
    for (let v = Math.min(a1, s1); v < a1 - 1e-6; v = Math.min(a1, v + coarse)) out.push(v);
    out.push(a1);
    return out;
  };
  const xs = axis(rect.x0, rect.x1, sim.x0, sim.x1), zs = axis(rect.z0, rect.z1, sim.z0, sim.z1);
  const position = new Float32Array(xs.length * zs.length * 3), index: number[] = [];
  let k = 0;
  for (const z of zs) for (const x of xs) { position[k++] = x; position[k++] = level; position[k++] = z; }
  for (let j = 0; j + 1 < zs.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
    const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const normal = new Float32Array(position.length);
  for (let i = 1; i < normal.length; i += 3) normal[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return withLookHead(g);
}

/** Lay the place's walls into a mask: everything of the model standing more
 *  than `above` metres over the water's level, as seen from above. */
export function wallsFromModel(field: GroundField, triangles: Iterable<readonly [number, number, number, number, number, number, number, number, number]>, level: number, above = .15) {
  const r = field.rect, sx = (r.x1 - r.x0) / field.width, sz = (r.z1 - r.z0) / field.height;
  for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of triangles) {
    if (Math.max(ay, by, cy) < level + above) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - r.x0) / sx)), i1 = Math.min(field.width - 1, Math.floor((Math.max(ax, bx, cx) - r.x0) / sx));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - r.z0) / sz)), j1 = Math.min(field.height - 1, Math.floor((Math.max(az, bz, cz) - r.z0) / sz));
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = r.x0 + (i + .5) * sx, z = r.z0 + (j + .5) * sz;
      const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      if (w0 * ay + w1 * by + w2 * cy > level + above) field.data[(j * field.width + i) * 4 + DENSITY] = 1;
    }
  }
  return field;
}
