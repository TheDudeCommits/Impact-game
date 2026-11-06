import * as THREE from 'three';
import { GROUND_NOISE, GROUND_WIND } from './glsl';
import { edit, groundMaterial, withLookHead } from './toon';
import type { GroundFrame, GroundTick } from './frame';
import type { GroundTier } from './quality';
import { DENSITY, HEIGHT, type GroundField, type Rect, type TerrainField } from './mask';
import { ClumpGrid, CLUMP_FETCH, type ClumpBand } from './clumps';
import { seeded } from '../stages/ambient';

/** A grass field's look: its height at mask height 1 (m), its colours (sRGB
 *  hex) - the dark roots, a cool leaf green and a yellow-green the world-space
 *  noise moves between - and how wide its blades are. */
export interface GrassLook {
  height: number;
  root: number; cool: number; warm: number;
  /** The sunlit tips (sRGB hex): warmer than the body, so a blade runs from a
   *  cool base through its green to a yellow-green tip, as painted grass does. */
  tip?: number;
  /** How much of the field is the warm green, 0..1 (the noise's threshold). */
  warmth?: number;
  /** Blade width (m) at the root, near the lens. */
  width?: number;
  /** Wind response, 0..1.5 (1 = the place's wind). */
  sway?: number;
}

/** One ring of clumps round the lens: its cell (m), the blades a clump and
 *  their segments, how wide a clump spreads and its blades are (multiples of
 *  the nearest ring's), and the band of distance it is drawn over. */
export interface Ring extends ClumpBand { cell: number; blades: number; segments: number; spread: number; width: number }

/** Every grass layer's colour uniforms, for the dev probe's live palette (build.ts): dev builds only. */
export const PALETTES = new Set<{ uRoot: { value: THREE.Color }; uCool: { value: THREE.Color }; uWarm: { value: THREE.Color }; uTip?: { value: THREE.Color }; uEarth?: { value: THREE.Color }; uWarmth: { value: number } }>();

/** Up to this many points press the grass flat: each fighter's feet and, when
 *  low, their pelvis. */
export const PRESS_POINTS = 24;

/** The rings each quality draws, nearest first: dense, many-bladed clumps by
 *  the lens, fewer and wider ones further out, handing over across each
 *  band's dithered fade; past the last, the ground sheet's painted grass is
 *  the field. Each clump the lens cannot see is culled on the CPU before the
 *  GPU spends anything on it (clumps.ts). */
export function grassRings(tier: GroundTier): Ring[] {
  if (tier.blades <= 0) return [];
  if (tier.blades >= 1) return [
    { cell: .3, blades: 6, segments: 3, spread: 1, width: 1.15, fadeIn: [0, 0], fadeOut: [8.5, 10.5] },
    { cell: .6, blades: 4, segments: 2, spread: 1.35, width: 2, fadeIn: [8.5, 10.5], fadeOut: [18, 21] },
    { cell: 1.2, blades: 3, segments: 1, spread: 1.9, width: 3.2, fadeIn: [18, 21], fadeOut: [tier.reach - 5, tier.reach] },
  ];
  // Medium: about half the blade work - fewer clumps a square metre, fewer segments, two rings, a shorter reach.
  return [
    { cell: .42, blades: 6, segments: 2, spread: 1.1, width: 1.3, fadeIn: [0, 0], fadeOut: [8.5, 10.5] },
    { cell: .84, blades: 4, segments: 1, spread: 1.5, width: 2.2, fadeIn: [8.5, 10.5], fadeOut: [tier.reach - 5, tier.reach] },
  ];
}

/** The most clumps a ring draws at once: its band's area at its density, and
 *  a margin (the lens sees a part of it; the most is a view straight down). */
export function ringCapacity(ring: Ring) {
  const area = Math.PI * (ring.fadeOut[1] ** 2 - ring.fadeIn[0] ** 2);
  return Math.ceil(area / (ring.cell * ring.cell) * .75);
}

/** A clump of blades at unit height: each blade a tapering strip of
 *  `segments`, rooted in a little disc and fanning out. Per vertex:
 *  `position` (the blade's side offset in x/z, and how far up the blade, 0..1,
 *  in y), `aRoot` (the root's offset in the clump), `aLean` (the tip's lean,
 *  x/z, and the blade's height, a share of the clump's), `aRand`. */
export function clumpGeometry(blades: number, segments: number, spread: number, width: number, seed = 7) {
  const rng = seeded(seed);
  const position: number[] = [], root: number[] = [], lean: number[] = [], rand: number[] = [], normal: number[] = [], uv: number[] = [], index: number[] = [];
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * .085 * spread;
    const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
    // Fanned outward from the clump's middle, with a twist of its own.
    const out = Math.atan2(rz, rx) + (rng() - .5) * 1.2, l = .12 + rng() * .3;
    const lx = Math.cos(out) * l, lz = Math.sin(out) * l;
    const facing = out + Math.PI / 2 + (rng() - .5) * .9;
    const sx = Math.cos(facing), sz = Math.sin(facing);
    const height = .62 + rng() * .38, w = (.034 + rng() * .022) * width, br = rng();
    const first = position.length / 3;
    for (let k = 0; k <= segments; k++) {
      const t = k / segments;
      // Widest a little above the root, then tapering to the tip.
      const half = k === segments ? 0 : w * .5 * (1 - Math.pow(t, 1.35)) * (k === 0 ? .8 : 1);
      for (const side of k === segments ? [0] : [-1, 1]) {
        position.push(sx * half * side, t, sz * half * side);
        root.push(rx, rz); lean.push(lx, lz, height); rand.push(br);
        normal.push(-sz, 0, sx); uv.push(side * .5 + .5, t);
      }
    }
    for (let k = 0; k < segments; k++) {
      const i = first + k * 2;
      if (k === segments - 1) index.push(i, i + 1, i + 2);
      else index.push(i, i + 1, i + 3, i, i + 3, i + 2);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aRoot', new THREE.Float32BufferAttribute(root, 2));
  g.setAttribute('aLean', new THREE.Float32BufferAttribute(lean, 3));
  g.setAttribute('aRand', new THREE.Float32BufferAttribute(rand, 1));
  g.setIndex(index);
  return withLookHead(g);
}

const GRASS_VERTEX = /* glsl */`
attribute vec2 aRoot;
attribute vec3 aLean;
attribute float aRand;
uniform float uTime;
uniform float uSpread;
uniform float uBladeWidth;
uniform float uHeight;
uniform float uSway;
uniform float uWarmth;
uniform vec4 uPress[ ${PRESS_POINTS} ];
uniform vec3 uRoot;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uTip;
varying vec3 vGrassColor;
${GROUND_NOISE}
${GROUND_WIND}
${CLUMP_FETCH}
`;

const GRASS_PLACE = /* glsl */`
	vec3 grassWorld;
	vec3 grassNormal;
	{
		// The clump this instance draws, as the CPU culled it: where, on what floor, how tall.
		vec4 clump = groundClump();
		vec2 base = clump.xz;
		float baseY = clump.y;
		float clumpHeight = uHeight * clump.w;
		float yaw = groundHash( base * 7.31 + 5.37 ) * 6.2832;
		float c = cos( yaw ), s = sin( yaw );
		mat2 turn = mat2( c, s, -s, c );
		float bladeHeight = clumpHeight * aLean.z;
		vec2 local = turn * ( aRoot * uSpread + position.xz * uBladeWidth );
		vec2 lean = turn * aLean.xy * bladeHeight;
		// The wind, and every fighter standing near pressing the blades away
		// from their feet (and flat under a body lying in it).
		vec2 bend = groundWind( base, uTime ) * uSway * ( .7 + aRand * .6 );
		vec2 press = vec2( 0. );
		for ( int i = 0; i < ${PRESS_POINTS}; i ++ ) {
			vec4 p = uPress[ i ];
			if ( p.w <= 0. ) continue;
			vec2 away = base + aRoot * uSpread - p.xz;
			float d = length( away );
			if ( d > p.w || abs( p.y - baseY ) > 1.6 ) continue;
			float k = 1. - smoothstep( p.w * .3, p.w, d );
			press += ( d > 1e-3 ? away / d : vec2( .7, .7 ) ) * k * 1.35;
		}
		bend += press;
		vec2 tip = lean + bend * bladeHeight;
		// The blade keeps its length: the further its tip leans, the lower it stands.
		float reach = length( tip ), most = bladeHeight * .96;
		if ( reach > most ) { tip *= most / reach; reach = most; }
		float rise = sqrt( max( bladeHeight * bladeHeight - reach * reach, 1e-4 ) );
		float t = position.y;
		grassWorld = vec3( base.x + local.x + tip.x * t * t, baseY + rise * t, base.y + local.y + tip.y * t * t );
		// Lit as the ground it covers, each blade tilted a little its own way:
		// under a low sun a blade's own face - or any normal leaning far from
		// up - crosses the cel edge, and a field seen toward the sun went black.
		vec2 tilt = turn * normal.xz * ( aRand - .5 ) * .3 + normalize( tip + vec2( 1e-4 ) ) * min( reach / max( bladeHeight, 1e-3 ), 1. ) * t * .12;
		grassNormal = normalize( vec3( tilt.x, 1., tilt.y ) );
		// Colour: a cool leaf green to a yellow-green by world-space noise; darker
		// clumps and patches through it (the ground sheet shares the patches);
		// dark roots, sunlit tips; a tenth of the colour taken back, so the lit
		// field is green and not neon.
		float drift = groundFbm( base * .055 + 3.7 );
		float fine = groundNoise( base * .7 + aRand * 3. );
		vec3 green = mix( uCool, uWarm, smoothstep( uWarmth - .22, uWarmth + .22, drift ) );
		float value = groundPatchValue( base ) * ( .82 + .26 * groundHash( base * 3.17 + 1.9 ) );
		green *= value * ( .9 + .2 * fine ) + ( aRand - .5 ) * .1;
		vec3 colour = mix( mix( uRoot * value, green, smoothstep( 0., .55, t ) ), uTip * value * ( .88 + .24 * fine ), smoothstep( .55, 1., t ) * .8 );
		vGrassColor = mix( vec3( dot( colour, vec3( .2126, .7152, .0722 ) ) ), colour, .9 );
	}
	objectNormal = grassNormal;`;

/**
 * Grass: GPU-instanced clumps of blades in rings round the lens, dense near
 * the fight and thinning with distance, laid by the field's density mask. The
 * clumps are laid out once on the CPU (clumps.ts) and each frame only those
 * the lens can see are drawn. Wind sways it; every fighter presses it away
 * from their feet; it is lit in the fighters' two cel tones. It never collides
 * and casts no shadow - the sun's shadow map is the fight's - but takes the
 * fighters' shadows.
 */
export class GrassField {
  readonly root = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly grids: { grid: ClumpGrid; ring: Ring; reach: number }[] = [];
  private readonly press = Array.from({ length: PRESS_POINTS }, () => new THREE.Vector4());

  /** `field` and `floor` are the CPU's copies of the mask and the floor's
   *  heights; `region` is where the lens can be (the place's play area and a
   *  margin): a ring's clumps are laid out within its reach of it. */
  constructor(private readonly frame: GroundFrame, private readonly field: { cpu: GroundField; floor: TerrainField | number; region: Rect }, private readonly look: GrassLook, name = 'grass') {
    this.root.name = name;
    this.build(frame.tier);
    frame.add(this);
  }

  /** Rebuilt for a new quality: the rings change. */
  setQuality(tier: GroundTier) {
    this.clear();
    this.build(tier);
    this.culled = false;
  }

  private clear() {
    for (const mesh of this.meshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); this.root.remove(mesh); }
    for (const g of this.grids) g.grid.dispose();
    this.meshes.length = 0; this.grids.length = 0;
  }

  private build(tier: GroundTier) {
    const rings = grassRings(tier), { cpu, floor, region } = this.field, look = this.look;
    const floorAt = typeof floor === 'number' ? () => floor : (x: number, z: number) => floor.sample(x, z);
    rings.forEach((ring, k) => {
      const out = ring.fadeOut[1], r = cpu.rect;
      const grid = new ClumpGrid({
        region: { x0: Math.max(r.x0, region.x0 - out), z0: Math.max(r.z0, region.z0 - out), x1: Math.min(r.x1, region.x1 + out), z1: Math.min(r.z1, region.z1 + out) },
        cell: ring.cell, block: Math.max(3, ring.cell * 12), salt: 101 + k * 17, capacity: ringCapacity(ring), top: look.height * 1.35,
        clump: (x, z, h1, h2) => h1 < cpu.sample(DENSITY, x, z) ? cpu.sample(HEIGHT, x, z) * (.72 + .56 * h2) : 0,
        floor: floorAt,
      });
      const geometry = clumpGeometry(ring.blades, ring.segments, 1, 1, 11 + k);
      geometry.instanceCount = 0;
      const mesh = new THREE.Mesh(geometry, this.material(ring, grid));
      mesh.name = `${this.root.name}:ring${k}`;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true; mesh.castShadow = false;
      this.frame.drive(mesh);
      this.meshes.push(mesh);
      this.grids.push({ grid, ring, reach: .3 + ring.spread * .12 + look.height * .5 });
      this.root.add(mesh);
    });
  }

  private material(ring: Ring, grid: ClumpGrid) {
    const look = this.look;
    const lin = (hex: number) => new THREE.Color(hex);
    const uniforms = {
      uTime: this.frame.time, uWind: this.frame.wind, uClumps: { value: grid.texture },
      uSpread: { value: ring.spread }, uBladeWidth: { value: ring.width * (look.width ?? .05) / .045 },
      uHeight: { value: look.height }, uSway: { value: look.sway ?? 1 }, uWarmth: { value: look.warmth ?? .5 },
      uPress: { value: this.press },
      uRoot: { value: lin(look.root) }, uCool: { value: lin(look.cool) }, uWarm: { value: lin(look.warm) }, uTip: { value: lin(look.tip ?? look.warm) },
    };
    if (import.meta.env?.DEV) PALETTES.add(uniforms);
    return groundMaterial(`${this.root.name} blades`, 'ground-grass-v2', shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = GRASS_VERTEX + shader.vertexShader;
      shader.vertexShader = edit(shader.vertexShader, '#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + GRASS_PLACE, 'grass placement');
      shader.vertexShader = edit(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = grassWorld;', 'grass position');
      shader.fragmentShader = 'varying vec3 vGrassColor;\n' + shader.fragmentShader;
      shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vGrassColor;', 'grass colour');
      // Both faces lit as the face toward the lens (the vertex turned it).
      shader.fragmentShader = edit(shader.fragmentShader, '#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );\n\tnonPerturbedNormal = normal;', 'grass normal');
    }, { side: THREE.DoubleSide });
  }

  /** Clumps drawn this frame, by ring (the dev probe's). */
  get drawn() { return this.grids.map(g => g.grid.drawn); }

  private culled = false;

  tick(t: GroundTick) {
    // Culled again only when the view moved (or the rings were rebuilt): a
    // still lens keeps the last frame's clumps and uploads nothing.
    if (t.viewMoved || !this.culled) {
      const c = t.camera.position;
      this.grids.forEach(({ grid, ring, reach }, k) => {
        (this.meshes[k].geometry as THREE.InstancedBufferGeometry).instanceCount = grid.cull(c.x, c.z, t.frustum, ring, 'grass', reach);
        // Uploaded now, before the scene's passes, not when the ring is drawn.
        if (grid.drawn) t.renderer.initTexture(grid.texture);
      });
      this.culled = true;
    }
    pressPoints(t.bodies, this.press);
  }

  /** The clump textures (the stage's release disposes the meshes themselves). */
  dispose() { for (const g of this.grids) g.grid.dispose(); }
}

/** Fill the press points from the bodies: feet (a radius a standing body
 *  needs) and, for a body down or low (knocked down, crouched in a slide),
 *  its pelvis with a wider one. Unused points have a zero radius. */
export function pressPoints(bodies: readonly { x: number; y: number; z: number; hx: number; hy: number; hz: number }[], out: THREE.Vector4[]) {
  let n = 0;
  for (const b of bodies) {
    if (n >= out.length) break;
    // In the air a body presses nothing; landing, it does again.
    if (b.y > 1.2) continue;
    out[n++].set(b.x, b.y, b.z, .62);
    const low = b.hy - b.y < .7;
    if (low && n < out.length) out[n++].set(b.hx, b.y, b.hz, 1.05);
  }
  for (; n < out.length; n++) out[n].w = 0;
}
