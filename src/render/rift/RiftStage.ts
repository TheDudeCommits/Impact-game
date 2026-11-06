/** Arcade survival's last stands, built entirely in code: the ground, what
 *  stands on it (riftLayouts, the same list the collision is built from),
 *  what burns, and the sky's wound. No model is downloaded for any of it.
 *
 *  Everything static is merged by material (Sculpt), so a stage is a few
 *  dozen draws however much stands on it. The scenery the fighting smashes -
 *  carts, crates, gravestones - is merged too, each piece tagged, and a
 *  smashed one is folded away in the vertex shader (see `smash`). */
import * as THREE from 'three';
import { STAGES } from '../../game/stages';
import { riftLayout, type RiftProp, type RiftStageId } from '../../game/riftLayouts';
import { lookStageMaterial } from '../look/stageMaterials';
import { addShaderPatch, replaceOnce } from '../look/shaderPatch';
import { installCameraCutaway } from '../CameraCutaway';
import { Sculpt, type Bucket } from './sculpt';
import { detailTexture } from './textures';
import { FireField, type FireSpot } from './fire';
import { TOPPLE_PARS, fallAngle } from './topple';
import { corpse, type CorpsePose } from './corpses';
import { stoneHand, colossalSword } from './landmarks';
import { meshAhead } from './fleshAhead';
import { Rain, WEATHER } from './rain';
import { dressFor, fitOf, loadPropModels, propModel, propModelsSettled, type Fit } from './propModels';
// The Rift's own light, registered over the shared table's first versions.
import './looks';
import { RIFT_LOOKS } from './looks';
import { INK_ON, inkMaterial, inkSkyMesh, inkStageMaterial, setInkPage, setInkResolution, updateInkSky } from './ink';
import { riftPlaceBeyond, riftPlaceGround, riftPlaceProp, riftPlaceTear, riftPlaceWater } from '../../originals/places/riftPlaces';

/** Fires one stage can light. */
const FIRES = 128;

/** Breakable props a stage can tag (one texel each in the "broken" texture). */
const TAGS = 512;
/** A smashed prop toppling over its foot toward its fall line, gathering
 *  speed, then caving into a low heap where it lies (0-1 back: how far). */

interface Palette {
  ground: [number, number, number, number]; // base, mud, dust, detail
  kind: number; // 0 village dirt + cobbles, 1 hillside, 2 flagstones, 3 blood rock with veins
  hills: number; horizon: number;
  /** Its ground painted (a tiling texture, shipped with the motion library), the metres one tile covers, and how much lighter it is laid (the Hill's, dark earth under a night sky, was all but black). */
  paint: string; tile: number; gain: number;
}
const PALETTES: Record<RiftStageId, Palette> = {
  'rift-village': { ground: [0x6e5842, 0x42342a, 0x8e785c, 0x80705e], kind: 0, hills: 0x3a241c, horizon: 0x6a2e1a, paint: 'ground-village', tile: 5.5, gain: 1.05 },
  'rift-swords': { ground: [0x4a4a3e, 0x2e2e28, 0x6a6a5c, 0x3a3e30], kind: 1, hills: 0x1a1a1e, horizon: 0x2a2a30, paint: 'ground-swords', tile: 6, gain: 1.6 },
  'rift-fortress': { ground: [0x3e3e46, 0x24242a, 0x5a5a64, 0x48484e], kind: 2, hills: 0x0a0c14, horizon: 0x10141e, paint: 'ground-fortress', tile: 4.5, gain: 1.15 },
  'rift-eclipse': { ground: [0x3a1a1a, 0x1a0808, 0x5a2a24, 0x2a1010], kind: 3, hills: 0x0e0204, horizon: 0x3a0608, paint: 'ground-eclipse', tile: 6, gain: 1 },
  // The places added on 30 September (riftLayouts: frost, grove, wastes, harbor).
  'rift-frost': { ground: [0xc4ccd6, 0x7c8698, 0xeef2f8, 0x9aa6b6], kind: 1, hills: 0x6a7486, horizon: 0x3a4a66, paint: 'ground-frost', tile: 9, gain: 1.05 },
  'rift-grove': { ground: [0x3e2a20, 0x221410, 0x5e3a28, 0x4a1612], kind: 1, hills: 0x0c140c, horizon: 0x3a0a12, paint: 'ground-grove', tile: 6.5, gain: 1.2 },
  'rift-wastes': { ground: [0x5e5a58, 0x2e2a28, 0x7e7874, 0x3a2a24], kind: 3, hills: 0x1c1816, horizon: 0x6a2a10, paint: 'ground-wastes', tile: 7.5, gain: 1 },
  'rift-harbor': { ground: [0x5e584c, 0x3a3630, 0x7e7666, 0x4a463e], kind: 0, hills: 0x121a1c, horizon: 0x2a3a3c, paint: 'ground-harbor', tile: 6, gain: 1.1 },
};

const GROUND_PARS = /* glsl */`
uniform vec3 uGroundBase;
uniform vec3 uGroundMud;
uniform vec3 uGroundDust;
uniform vec3 uGroundDetail;
uniform float uGroundKind;
uniform float uGroundTime;
uniform sampler2D uGroundMap;
uniform float uGroundTile;
uniform float uGroundPainted;
uniform float uGroundGain;
varying vec3 vGroundWorld;
// Where the ground is stained with blood (the inked page draws it red).
float groundStain = 0.0;
float gHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float gNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( gHash( i ), gHash( i + vec2( 1, 0 ) ), f.x ), mix( gHash( i + vec2( 0, 1 ) ), gHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float gFbm( vec2 p ) { float v = 0.0, a = .5; for ( int i = 0; i < 5; i ++ ) { v += a * gNoise( p ); p = mat2( 1.6, 1.2, -1.2, 1.6 ) * p; a *= .5; } return v; }
// Distance to the nearest cell edge of a jittered grid: cobbles, flagstones, cracks.
float gCells( vec2 p, float jitter ) {
	vec2 i = floor( p ), f = fract( p ); float best = 8.0, second = 8.0;
	for ( int y = -1; y <= 1; y ++ ) for ( int x = -1; x <= 1; x ++ ) {
		vec2 o = vec2( float( x ), float( y ) );
		vec2 c = o + .5 + ( vec2( gHash( i + o ), gHash( i + o + 13.1 ) ) - .5 ) * jitter;
		float d = length( c - f );
		if ( d < best ) { second = best; best = d; } else if ( d < second ) second = d;
	}
	return second - best;
}
// The painted ground: its tile,
// and - but on the flagstones, whose rows must line up - a second look at it,
// turned and at another scale, blended in by the broad noise so the repeat
// does not show. (Both sampled either way: a sample in a branch loses its mip level.)
vec3 groundPaint( vec2 p, float broad ) {
	vec2 uv = p / uGroundTile;
	vec3 a = texture2D( uGroundMap, uv ).rgb;
	vec3 b = texture2D( uGroundMap, vec2( uv.y, -uv.x ) * .71 + .37 ).rgb;
	return uGroundKind > 1.5 && uGroundKind < 2.5 ? a : mix( a, b, smoothstep( .38, .62, broad ) );
}
vec3 groundColor( vec3 w, out float glow ) {
	vec2 p = w.xz;
	float broad = gFbm( p * .035 ), mid = gFbm( p * .16 + 7.0 ), fine = gFbm( p * 1.3 - 3.0 );
	vec3 c = mix( uGroundMud, uGroundBase, smoothstep( .3, .7, broad ) );
	c = mix( c, uGroundDust, smoothstep( .55, .85, mid ) * .6 );
	c *= .82 + .36 * fine;
	glow = 0.0;
	vec3 paint = groundPaint( p, broad );
	if ( uGroundPainted > .5 ) {
		// The paint, a little lighter and darker in broad drifts (one tile's light, repeated, was flat).
		c = paint * uGroundGain * ( .82 + .36 * mid );
		// (The Offering goes on to its own splits: its painted ones, fine as they
		// are, averaged away past a few metres - the field read as dark red noise.)
		if ( uGroundKind > .5 && uGroundKind < 2.5 ) return c;
	}
	if ( uGroundKind < .5 ) {
		// The village square: cobbles worn into the mud toward the middle.
		float square = 1.0 - smoothstep( 9.0, 15.0, length( p ) + ( mid - .5 ) * 6.0 );
		if ( uGroundPainted < .5 ) {
			float edge = gCells( p * 1.35, .8 );
			vec3 cobble = uGroundDetail * ( .8 + .4 * gHash( floor( p * 1.35 ) ) );
			c = mix( c, mix( uGroundMud * .5, cobble, smoothstep( .04, .12, edge ) ), square * .9 );
			// Cart ruts through it.
			c *= 1.0 - .25 * smoothstep( .9, 1.0, abs( sin( p.x * .35 + mid * 2.0 ) ) ) * ( 1.0 - square );
		}
		// And the war over it: ash drifted across the stones with embers still
		// alive in it, black scorch where burning roofs came down, old blood
		// (the square was "a clean orange hex floor with no ash, blood or
		// burning wreckage").
		float ash = smoothstep( .48, .78, gFbm( p * .085 + 31.0 ) );
		c = mix( c, vec3( .2, .18, .17 ) * ( .8 + .5 * fine ), ash * .45 );
		float scorch = smoothstep( .7, .82, gNoise( p * .19 + 5.3 ) + ( fine - .5 ) * .25 );
		c *= 1.0 - scorch * .5;
		float blood = smoothstep( .8, .88, gNoise( p * .55 + 17.0 ) + ( fine - .5 ) * .3 ) * square;
		c = mix( c, vec3( .16, .015, .018 ), blood * .75 );
		groundStain = blood * .75;
		vec2 speck = floor( p * 5.0 );
		glow = max( ash, scorch ) * step( .985, gHash( speck ) ) * ( .45 + .55 * sin( uGroundTime * 2.6 + gHash( speck + 3.7 ) * 40.0 ) );
	} else if ( uGroundKind < 1.5 ) {
		// The hill: dead grass in clumps over bare earth and stone.
		float grass = smoothstep( .45, .7, gFbm( p * .5 + 2.0 ) );
		c = mix( c, uGroundDetail * ( .7 + .5 * fine ), grass * .75 );
	} else if ( uGroundKind < 2.5 ) {
		// The courtyard: square flagstones, cracked and sunk.
		vec2 q = p * .5;
		vec2 tile = abs( fract( q + vec2( floor( q.y ) * .5, 0.0 ) ) - .5 );
		float seam = smoothstep( .47, .49, max( tile.x, tile.y ) );
		vec3 flag = uGroundDetail * ( .75 + .45 * gHash( floor( q + vec2( floor( q.y ) * .5, 0.0 ) ) ) );
		c = mix( mix( flag, c, .35 ), uGroundMud * .45, seam );
		c *= 1.0 - .35 * smoothstep( .02, 0.0, gCells( p * .4, 1.0 ) );
	} else {
		// The Offering's ground: black rock, split, with the rift's red in the splits.
		float crack = gCells( p * .22 + gFbm( p * .1 ) * 2.0, 1.0 );
		c = mix( c, uGroundMud * .4, smoothstep( .1, .02, crack ) );
		float vein = smoothstep( .035, .0, crack ) * ( .6 + .4 * sin( uGroundTime * 1.7 + p.x * .3 + p.y * .2 ) );
		// And under the rift's splits, the paint's own: its hot orange smoulders.
		vein = max( vein, uGroundPainted * smoothstep( .18, .5, paint.r - paint.b ) * smoothstep( .25, .6, paint.r ) * .45 );
		// The red is the field's: on the hills the rock goes black and its splits
		// all but dark (floor, slopes and horizon were one red crack pattern,
		// and every figure on it drowned in the same red).
		float hill = smoothstep( .4, 5.0, w.y );
		c *= 1.0 - hill * .35;
		glow = vein * ( 1.0 - hill * .9 );
	}
	return c;
}`;

const BLANK = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
BLANK.needsUpdate = true;
const PAINTS = new Map<string, Promise<THREE.Texture>>();
/** A place's painted ground, loaded once. */
function paintOf(name: string) {
  let paint = PAINTS.get(name);
  if (!paint) {
    paint = new THREE.TextureLoader().loadAsync(`/assets/survival/motion/${name}.jpg`).then(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      return texture;
    });
    paint.catch(error => console.warn(`Rift: ground ${name} did not load; it stays the code's`, error));
    PAINTS.set(name, paint);
  }
  return paint;
}

/** Settle the assets that otherwise attach after stage construction. The
 * ground is an injected shader uniform, so return it for explicit GPU warm-up.
 * Failed art retains the same procedural fallback as ordinary stage loading. */
export async function preloadRiftAssets(stage:RiftStageId):Promise<THREE.Texture[]>{
  const [paint]=await Promise.all([paintOf(PALETTES[stage].paint).catch(()=>undefined),loadPropModels()]);
  return paint?[paint]:[];
}

/** The ground: a wide plane, flat where the fighting is, rising into hills
 *  beyond the bounds so the world closes round the arena. */
/** The height of a place's ground at (x, z): flat over the field, rising
 *  into hills beyond it. Everything set on the slope stands on this. */
function groundAt(stage: RiftStageId, x: number, z: number) {
  const { halfX, halfZ } = STAGES[stage];
  { const own = riftPlaceGround(stage, x, z, halfX, halfZ); if (own !== undefined) return own; }
  if (stage === 'rift-harbor' && z > halfZ + 1) return -Math.min(6, (z - halfZ - 1) * .35);
  const out = Math.max(Math.abs(x) - halfX - 3, Math.abs(z) - halfZ - 3, 0);
  const n = Math.sin(x * .05) * Math.cos(z * .045) * .5 + .5;
  return Math.pow(Math.min(1, out / 55), 1.6) * (16 + n * 22) - (out > 0 ? 0 : .002);
}
function groundMesh(stage: RiftStageId, palette: Palette, time: { value: number }) {
  const size = 300, seg = 120;
  const geometry = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, groundAt(stage, p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals();
  const material = INK_ON ? inkStageMaterial({ color: 0xffffff }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0 });
  material.name = `rift-ground-${stage}`;
  const [base, mud, dust, detail] = palette.ground;
  const uniforms = { uGroundBase: { value: new THREE.Color(base) }, uGroundMud: { value: new THREE.Color(mud) }, uGroundDust: { value: new THREE.Color(dust) },
    uGroundDetail: { value: new THREE.Color(detail) }, uGroundKind: { value: palette.kind }, uGroundTime: time,
    uGroundMap: { value: BLANK as THREE.Texture }, uGroundTile: { value: palette.tile }, uGroundPainted: { value: 0 }, uGroundGain: { value: palette.gain } };
  // Painted once it is in (until then, and if it never comes, the ground is the code's).
  paintOf(palette.paint).then(texture => { uniforms.uGroundMap.value = texture; uniforms.uGroundPainted.value = 1; }, () => {});
  addShaderPatch(material, INK_ON && palette.kind === 0 ? 'rift-ground-v4-ink' : 'rift-ground-v4', shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vGroundWorld;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', 'vGroundWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n#include <project_vertex>', 'ground world');
    shader.fragmentShader = GROUND_PARS + "\n" + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', `#include <map_fragment>
	float groundGlow;
	diffuseColor.rgb *= groundColor( vGroundWorld, groundGlow );`, 'ground albedo');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += vec3( 2.2, .25, .08 ) * groundGlow${INK_ON && palette.kind === 0 ? ' * 0.0' : ''};`, 'ground veins');
  });
  const looked = INK_ON ? material : lookStageMaterial(material, stage, 'ground');
  inkMaterial(looked, { local: .4, stain: 'groundStain' });
  const mesh = new THREE.Mesh(geometry, looked);
  mesh.name = 'rift-ground'; mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return mesh;
}

const TEAR_VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TEAR_FRAGMENT = /* glsl */`
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
float h( float n ) { return fract( sin( n ) * 43758.5453 ); }
float n1( float x ) { float i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f ); return mix( h( i ), h( i + 1.0 ), f ); }
void main() {
	// A jagged vertical wound in the sky, its edges crawling, light pouring out.
	float y = vUv.y, x = vUv.x * 2.0 - 1.0;
	float jag = ( n1( y * 14.0 + uTime * .6 ) - .5 ) * .22 + ( n1( y * 41.0 - uTime * 1.3 ) - .5 ) * .08;
	float width = uOpen * ( .16 + .1 * n1( y * 6.0 + uTime * .2 ) ) * smoothstep( 0.0, .25, y ) * smoothstep( 1.0, .6, y );
	float d = abs( x - jag );
	float core = smoothstep( width, width * .15, d );
	float halo = smoothstep( width * 5.0, width, d ) * .35;
	if ( core + halo < .01 ) discard;
	vec3 color = mix( vec3( .9, .08, .18 ) * 3.0, vec3( 4.0, 2.4, 3.6 ), core * core );
	gl_FragColor = vec4( color * ( core + halo ), 1.0 );
}`;

/** The same wound on the inked page: a black crack in the paper of the sky,
 *  as the Village's chapter panel draws it, the Rift's red burning along its
 *  edges - the one colour up there. */
const TEAR_INK_FRAGMENT = /* glsl */`
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
float h( float n ) { return fract( sin( n ) * 43758.5453 ); }
float n1( float x ) { float i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f ); return mix( h( i ), h( i + 1.0 ), f ); }
void main() {
	float y = vUv.y, x = vUv.x * 2.0 - 1.0;
	float jag = ( n1( y * 14.0 + uTime * .6 ) - .5 ) * .22 + ( n1( y * 41.0 - uTime * 1.3 ) - .5 ) * .08;
	float width = uOpen * ( .12 + .08 * n1( y * 6.0 + uTime * .2 ) ) * smoothstep( 0.0, .25, y ) * ( 1.0 - smoothstep( .6, 1.0, y ) );
	float d = abs( x - jag );
	float core = 1.0 - smoothstep( width * .4, width, d );
	float rim = ( 1.0 - smoothstep( width, width * 2.6, d ) ) * ( 1.0 - core );
	if ( core + rim < .01 ) discard;
	gl_FragColor = vec4( mix( vec3( 2.1, .12, .08 ), vec3( .008, .0, .006 ), core ), max( core, rim * rim ) );
}`;

/** The rift stage on screen (the last one restored), for survival's own
 *  effects to reach without a hook in the shared stage code. */
let ACTIVE: RiftStage | undefined;
export const activeRift = () => ACTIVE;

/** A place's geometry, built ahead: every prop and the surroundings sculpted
 *  into their buckets, the fires placed, the breakables tagged. Building it
 *  is the costly part of a stage (10-50 ms on the main thread once its dead
 *  and landmarks are meshed - fleshAhead - and up to half a second when they
 *  are not), so a run builds the next place while the game is paused on a
 *  draft (prebuildRiftStage) and the arrival only turns it into meshes. */
interface Prebuilt { sculpt: Sculpt; fires: FireSpot[]; breakables: Map<number, RiftProp>; pieces: SetPiece[]; dressed: Dressed[] }
/** Something that wears a generated model (propModels.ts), set on its own
 *  once the models are in: where it stands, what it is fitted to (a
 *  footprint, a height, or - a stretch of wall - a whole box), its tag, and
 *  how it is built in code if its model never comes. */
interface Dressed extends Fit {
  id: string; tag: number;
  /** Beyond the field: the model's coarse copy, and no shadow (the sun map is spent round the fight). */
  far?: boolean;
  x: number; y: number; z: number; yaw: number; tilt?: readonly [number, number];
  code: (k: Sculpt) => void;
}
/** A piece of the place beyond the field that comes down as the fight there
 *  worsens: a house of the burning town, a stretch of curtain wall, a spire. */
interface SetPiece { tag: number; x: number; z: number; angle: number; size: number; height: number; rigid?: boolean; y?: number }
/** Set pieces take tags from here up (the field's props use the ones below). */
const PIECE_TAGS = 400;
const PREBUILT = new Map<RiftStageId, Prebuilt>();
const BUILT = new Set<RiftStageId>();
function sculptStage(stage: RiftStageId): Prebuilt {
  const layout = riftLayout(stage), palette = PALETTES[stage];
  const sculpt = new Sculpt(stage.length * 97);
  const fires: FireSpot[] = [], breakables = new Map<number, RiftProp>(), dressed: Dressed[] = [];
  // (What a prop wearing a model lights, it lights all the same: built into
  // a sculpt thrown away, for its fires.)
  const aside = new Sculpt(1);
  layout.props.forEach((prop, i) => {
    const tag = prop.breakable ? i + 1 : 0;
    if (tag) breakables.set(tag, prop);
    sculpt.tag(tag);
    const lit = fires.length;
    const dress = dressFor(stage, prop);
    if (dress) dressed.push({ ...dress, tag, x: prop.x, y: -(dress.sink ?? 0), z: prop.z, yaw: prop.rot, code: k => buildProp(k, prop, stage, []) });
    buildProp(dress ? aside : sculpt, prop, stage, fires);
    if (tag) for (let f = lit; f < fires.length; f++) fires[f].tag = tag;
  });
  sculpt.tag(0);
  const pieces: SetPiece[] = [];
  buildSurroundings(sculpt, stage, palette, fires, pieces, dressed);
  sculpt.tag(0);
  // Nearest first: what comes down first is what the fight can see.
  pieces.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  return { sculpt, fires, breakables, pieces, dressed };
}
function takePrebuilt(stage: RiftStageId): Prebuilt {
  const ready = PREBUILT.get(stage) ?? sculptStage(stage);
  PREBUILT.delete(stage); BUILT.add(stage);
  return ready;
}
/** Sculpt a place before it is needed (once; a stage already on the GPU is skipped). */
export function prebuildRiftStage(stage: RiftStageId) {
  if (BUILT.has(stage) || PREBUILT.has(stage)) return false;
  PREBUILT.set(stage, sculptStage(stage));
  return true;
}

export class RiftStage {
  readonly root = new THREE.Group();
  /** Invisible boxes the chase camera must not pass through. */
  readonly occluders: THREE.Object3D[] = [];
  readonly fire: FireField;
  private readonly time = { value: 0 };
  private readonly broken: THREE.DataTexture;
  private readonly materials: THREE.Material[] = [];
  private readonly tear?: THREE.Mesh;
  private readonly tearOpen = { value: 1 };
  readonly props: readonly RiftProp[];
  /** Where each breakable prop is, by its tag, for the debris when it goes. */
  readonly breakables = new Map<number, RiftProp>();

  constructor(readonly stage: RiftStageId) {
    // The places after this one: their dead and their landmarks meshed meanwhile, in a worker.
    meshAhead();
    this.root.name = `Stage:${stage}`;
    if (INK_ON) setInkPage(stage, RIFT_LOOKS[stage]);
    // Per tag: when it broke (+1; 0 standing), where it stands (x, z), and
    // which way it falls - so a smashed prop topples over, not just vanishes.
    this.broken = new THREE.DataTexture(new Float32Array(TAGS * 4 * 2), TAGS, 2, THREE.RGBAFormat, THREE.FloatType);
    this.broken.needsUpdate = true;
    // Fires on what falls, fall with it.
    // (The burning village lights 117: at 96 the last score of them, the far
    // ring's, were dropped with a warning every run.)
    this.fire = new FireField(FIRES, { uBroken: { value: this.broken }, uRiftTime: this.time });
    const palette = PALETTES[stage];
    this.root.add(groundMesh(stage, palette, this.time));
    const layout = riftLayout(stage);
    this.props = layout.props;
    const { sculpt, fires, breakables, pieces, dressed } = takePrebuilt(stage);
    for (const [tag, prop] of breakables) { this.breakables.set(tag, prop); this.pivot(tag, prop.x, prop.z, prop.seed * Math.PI * 2); }
    this.pieces = pieces;
    for (const piece of pieces) this.pivot(piece.tag, piece.x, piece.z, fallAngle(piece.angle, piece.rigid ?? false), piece.y);
    this.buckets = this.bucketMaterials();
    this.addMeshes(sculpt.build(this.buckets));
    this.dress(dressed);
    if (fires.length > FIRES) console.warn(`Rift stage ${stage}: ${fires.length} fires, ${FIRES} drawn`);
    this.fire.set(fires);
    this.root.add(this.fire.root);
    // The wound in the sky, ahead of where the fight begins.
    const tearMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: this.time, uOpen: this.tearOpen }, vertexShader: TEAR_VERTEX, fragmentShader: INK_ON ? TEAR_INK_FRAGMENT : TEAR_FRAGMENT,
      transparent: true, depthWrite: false, blending: INK_ON ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, toneMapped: false, side: THREE.DoubleSide });
    this.materials.push(tearMaterial);
    this.tear = new THREE.Mesh(new THREE.PlaneGeometry(90, 260), tearMaterial);
    this.tear.position.set(stage === 'rift-eclipse' ? 60 : -40, 150, -235); this.tear.rotation.set(0, .15, stage === 'rift-eclipse' ? -.25 : .12); riftPlaceTear(stage, this.tear);
    this.tear.renderOrder = -5; this.tear.frustumCulled = false;
    this.root.add(this.tear);
    // The page's own sky, over the shared one (rift/ink.ts).
    if (INK_ON) { const sky = inkSkyMesh(); this.materials.push(sky.material as THREE.Material); this.root.add(sky); }
    // Over the Fortress, the rain its panel is drawn in.
    // And the new places' own air: snow on the Shrine, crimson leaves in the Grove, ash on the Wastes, the Harbour's drizzle.
    const air = stage === 'rift-fortress' ? WEATHER.rain : stage === 'rift-frost' ? WEATHER.snow : stage === 'rift-grove' ? WEATHER.leaves
      : stage === 'rift-wastes' ? WEATHER.ash : stage === 'rift-harbor' ? WEATHER.drizzle : undefined;
    if (air) { this.rain = new Rain(this.time, air); this.materials.push(this.rain.mesh.material as THREE.Material); this.root.add(this.rain.mesh); }
    // The Harbour's sea, out past the piers: dark, still, catching the lamps.
    if (stage === 'rift-harbor') {
      const water = INK_ON ? inkStageMaterial({ color: 0x0c1a1e }) : new THREE.MeshStandardMaterial({ color: 0x0c1a1e, roughness: .12, metalness: .2 });
      water.name = 'rift-water';
      const looked = INK_ON ? water : lookStageMaterial(water, stage, 'water');
      inkMaterial(looked, { water: true });
      this.materials.push(looked);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 180).rotateX(-Math.PI / 2), looked);
      sea.position.set(0, -.7, STAGES[stage].halfZ + 92); sea.name = 'rift-sea'; sea.receiveShadow = true;
      this.root.add(sea);
    }
    riftPlaceWater(stage, this.root, this.materials);
    const wall = new THREE.MeshBasicMaterial({ visible: false });
    this.materials.push(wall);
    // (At 6.6 m out, a fight at the field's edge put the boom against a slab
    // and the lens into the fighter's shoulders: "the camera pushes into the
    // fighter's body". Ten clears the boom's reach behind a fighter at the edge.)
    const { halfX, halfZ } = STAGES[stage], out = 10;
    for (const [x, z, w, d] of [[-halfX - out, 0, 1, halfZ * 2 + out * 2], [halfX + out, 0, 1, halfZ * 2 + out * 2], [0, -halfZ - out, halfX * 2 + out * 2, 1], [0, halfZ + out, halfX * 2 + out * 2, 1]]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 14, d), wall);
      slab.position.set(x, 7, z); slab.visible = false; this.root.add(slab); this.occluders.push(slab);
    }
  }

  private buckets: Partial<Record<Bucket, THREE.Material>> = {};
  private disposed = false;
  private addMeshes(meshes: THREE.Mesh[]) {
    for (const mesh of meshes) {
      // (Not the dead: 80-140 thousand triangles of bodies lying flat - and the
      // the Dead Sun's far stone hand - drawn a second time into the shadow map for
      // shadows no one could see.)
      mesh.castShadow = !/ground|glow|flesh/.test(mesh.name); mesh.receiveShadow = true;
      // Its shadow falls with it (the default depth pass left a smashed
      // house's shadow standing where the house had been).
      if (mesh.castShadow) mesh.customDepthMaterial = this.depth;
      this.root.add(mesh);
    }
  }

  /** The props that wear generated models, set on the collision's own
   *  footprints, tagged as before (what breaks still topples) - now, or the
   *  moment the models are in; a model that never came leaves its prop code-built. */
  private dress(list: readonly Dressed[]) {
    if (!list.length) return;
    const place = () => {
      if (this.disposed) return;
      const near = new Sculpt(this.stage.length * 131), far = new Sculpt(this.stage.length * 137), worn = new Set<string>();
      for (const d of list) {
        const k = d.far ? far : near;
        k.tag(d.tag);
        const model = propModel(d.id);
        if (!model) { d.code(k); continue; }
        const { scale, turn } = fitOf(d, model), [tx, tz] = d.tilt ?? [0, 0];
        worn.add(d.id);
        k.use(`model:${d.id}`, 0xffffff, .12).add(d.far ? model.far : model.geometry, d.x, d.y, d.z, tx, d.yaw + turn, tz, scale.x, scale.y, scale.z);
      }
      near.tag(0); far.tag(0);
      const materials: Partial<Record<Bucket, THREE.Material>> = { ...this.buckets };
      for (const id of worn) materials[`model:${id}`] = this.modelMaterial(id);
      this.addMeshes(near.build(materials));
      const beyond = far.build(materials);
      this.addMeshes(beyond);
      for (const mesh of beyond) { mesh.castShadow = false; mesh.customDepthMaterial = undefined; }
    };
    if (propModelsSettled()) place(); else void loadPropModels().then(place);
  }

  private modelMaterial(id: string) {
    const material = INK_ON ? inkStageMaterial({ vertexColors: true, map: propModel(id)!.texture }) : new THREE.MeshStandardMaterial({ vertexColors: true, map: propModel(id)!.texture, roughness: .9, metalness: 0 });
    material.name = `rift-model-${id}`;
    const looked = INK_ON ? material : lookStageMaterial(material, this.stage, `model-${id}`);
    // (A model's faces are its own: no ruled lines, a contour where it turns away.)
    inkMaterial(looked);
    this.tagged(looked);
    installCameraCutaway(looked);
    this.materials.push(looked);
    return looked;
  }

  private bucketMaterials(): Partial<Record<Bucket, THREE.Material>> {
    const lit = (bucket: Bucket, detail: Parameters<typeof detailTexture>[0], roughness = .92) => {
      const material = INK_ON ? inkStageMaterial({ vertexColors: true, map: detailTexture(detail) }) : new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(detail), roughness, metalness: 0 });
      material.name = `rift-${bucket}`;
      const looked = INK_ON ? material : lookStageMaterial(material, this.stage, bucket);
      // (The dead are sculpted, not built of boxes: a contour, no ruled faces.)
      inkMaterial(looked, { faces: bucket !== 'flesh' });
      this.tagged(looked);
      installCameraCutaway(looked);
      this.materials.push(looked);
      return looked;
    };
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    glow.name = 'rift-glow'; this.tagged(glow); this.materials.push(glow);
    return {
      stone: lit('stone', 'stone'), wood: lit('wood', 'wood'), plaster: lit('plaster', 'plaster'), thatch: lit('thatch', 'thatch', .98),
      metal: lit('metal', 'metal', .55), cloth: lit('cloth', 'plaster'), bone: lit('bone', 'plaster'), flesh: lit('flesh', 'plaster'), dark: lit('dark', 'stone'), glow,
    };
  }

  /** A smashed prop's vertices fold to nothing: no split of the merge. */
  private tagged(material: THREE.Material) {
    addShaderPatch(material, 'rift-broken-v4', shader => {
      shader.uniforms.uBroken = { value: this.broken }; shader.uniforms.uRiftTime = this.time;
      shader.vertexShader = 'attribute float aTag;\n' + TOPPLE_PARS + 'varying float vRiftBroken;\nvarying vec3 vRiftWorld;\n' + shader.vertexShader;
      shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>
	vRiftBroken = riftTopple( transformed, aTag );
	vRiftWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`, 'broken props');
      shader.fragmentShader = 'varying float vRiftBroken;\nvarying vec3 vRiftWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
	diffuseColor.rgb *= 1.0 - vRiftBroken * .55;
	// Whatever is within a few metres of the lens thins away (a dither, so no
	// sorting): pressed against a house, half the frame was its plaster wall.
	{
		float riftGap = distance( vRiftWorld, cameraPosition );
		if ( riftGap < 3.8 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( .06711056, .00583715 ) ) ) ) > smoothstep( 1.4, 3.8, riftGap ) ) discard;
	}`, 'broken props charred');
    });
  }

  /** A breakable prop is smashed: it topples and caves in (see TOPPLE_PARS). */
  smash(tag: number) {
    if (tag <= 0 || tag >= TAGS) return;
    const data = this.broken.image.data as Float32Array;
    if (data[tag * 4] > 0) return;
    data[tag * 4] = this.time.value + 1;
    this.broken.needsUpdate = true;
  }
  /** Where a tag stands (its foot `y` high) and which way it will fall. */
  private pivot(tag: number, x: number, z: number, angle: number, y = 0) {
    const data = this.broken.image.data as Float32Array;
    data[tag * 4 + 1] = x; data[tag * 4 + 2] = z; data[tag * 4 + 3] = angle;
    data[(TAGS + tag) * 4] = y;
  }
  /** Everything standing again (a new run on the same stage), and the fires
   *  back to where a place starts. */
  restore() {
    const data = this.broken.image.data as Float32Array;
    for (let i = 0; i < TAGS; i++) data[i * 4] = 0;
    this.broken.needsUpdate = true; this.escalation = 0; this.fire.level.value = 0; this.fallen = 0; this.collapses.length = 0; ACTIVE = this;
    if (INK_ON) setInkPage(this.stage, RIFT_LOOKS[this.stage]);
  }
  /** The shadow pass, toppling with the rest. */
  private readonly depth: THREE.MeshDepthMaterial = (() => {
    const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    material.onBeforeCompile = shader => {
      shader.uniforms.uBroken = { value: this.broken }; shader.uniforms.uRiftTime = this.time;
      shader.vertexShader = 'attribute float aTag;\n' + TOPPLE_PARS + shader.vertexShader;
      shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>
	riftTopple( transformed, aTag );`, 'broken props depth');
    };
    material.customProgramCacheKey = () => 'rift-broken-depth-v1';
    return material;
  })();

  /** How far the fight in this place has gone (0 its first round, 1 its
   *  last and after): more of it burns, the flames stand taller, the wound
   *  in the sky opens wider. Eased toward, so a change reads as the world turning worse. */
  escalate(level: number, dt: number) {
    this.escalation += (Math.max(0, Math.min(1.4, level)) - this.escalation) * Math.min(1, dt * .4);
    this.fire.level.value = this.escalation;
    // And the place comes down around the fight, a piece at a time.
    const due = Math.min(this.pieces.length, Math.floor(Math.max(0, this.escalation - .22) / .11));
    while (this.fallen < due) {
      const piece = this.pieces[this.fallen++];
      this.smash(piece.tag);
      this.collapses.push(piece);
    }
  }
  private escalation = 0;
  private pieces: SetPiece[] = [];
  private fallen = 0;
  private readonly collapses: SetPiece[] = [];
  /** The set pieces that came down since the last look (for their dust and noise). */
  takeCollapses(): readonly Readonly<SetPiece>[] { return this.collapses.splice(0); }

  private rain?: Rain;
  /** 0-1: a bolt's flash (SurvivalFx.mood), lighting the rain. */
  set lightning(flash: number) { if (this.rain) this.rain.flash = flash; }

  update(time: number) {
    const dt = Math.max(0, Math.min(.1, time - this.time.value));
    this.time.value = time;
    // (The page's dots and lines hold their size on screen, whatever the quality setting draws it at.)
    if (INK_ON) { setInkResolution(); updateInkSky(time, dt, RIFT_LOOKS[this.stage].sky.cloudSpeed); }
    this.fire.update(time);
    this.tearOpen.value = (.85 + .15 * Math.sin(time * .7)) * (1 + this.escalation * .6);
  }

  dispose() {
    this.disposed = true;
    if (ACTIVE === this) ACTIVE = undefined;
    this.root.traverse(node => { const mesh = node as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
    for (const material of this.materials) material.dispose();
    this.broken.dispose();
    this.fire.dispose();
    this.root.removeFromParent();
  }
}

// ---- the props -------------------------------------------------------------------------------
const WOOD = 0x5a3e28, DARK_WOOD = 0x2e2014, CHAR = 0x1a1210, PLASTER = 0xb8ab94, STONE = 0x6a6660, THATCH = 0x6a5430;
/** A ship's hull, lying on its side: a sphere to be stretched. */
const HULL = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .62);

function local(p: RiftProp, lx: number, lz: number): [number, number] {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
}

function buildProp(k: Sculpt, p: RiftProp, stage: RiftStageId, fires: FireSpot[]) {
  if (riftPlaceProp(k, p, stage, fires)) return;
  const r = p.seed;
  switch (p.kind) {
    case 'house': case 'ruin': house(k, p, fires, p.kind === 'ruin'); break;
    case 'tower': tower(k, p, stage, fires); break;
    case 'well': {
      k.use('stone', STONE).cylinder(p.x, 0, p.z, p.w / 2, .9, 14, 0, 0, 0, .98);
      k.use('dark', 0x08080a).cylinder(p.x, .02, p.z, p.w / 2 - .25, .9, 12);
      k.use('wood', DARK_WOOD);
      for (const side of [-1, 1]) k.box(p.x + side * (p.w / 2 - .1), 0, p.z, .16, 2.3, .16);
      k.box(p.x, 2.2, p.z, p.w + .2, .14, .16).use('wood', CHAR).gable(p.x, 2.3, p.z, p.w + .6, 1.2, .7);
      break;
    }
    case 'cart': {
      k.use('wood', WOOD).box(p.x, .55, p.z, p.w, .2, p.d, p.rot).box(p.x, .75, p.z, p.w, .5, .06, p.rot);
      for (const [lx, lz] of [[-p.w * .35, p.d / 2], [-p.w * .35, -p.d / 2], [p.w * .35, p.d / 2], [p.w * .35, -p.d / 2]]) {
        const [wx, wz] = local(p, lx, lz);
        k.use('wood', DARK_WOOD).cylinder(wx, .45, wz, .45, .1, 10, p.rot, 0, Math.PI / 2);
      }
      if (r > .5) k.use('thatch', THATCH).box(p.x, .75, p.z, p.w * .8, .5, p.d * .8, p.rot + .1);
      break;
    }
    case 'hay': k.use('thatch', 0x8a7040).cylinder(p.x, 0, p.z, p.w / 2, p.h, 12, p.rot, 0, 0, .92); break;
    case 'barrel': k.use('wood', WOOD).cylinder(p.x, 0, p.z, p.w / 2, p.h, 12, 0, 0, 0, .9).use('metal', 0x2a2a2e).cylinder(p.x, p.h * .2, p.z, p.w / 2 + .02, .06, 12).cylinder(p.x, p.h * .75, p.z, p.w / 2 * .96, .06, 12); break;
    case 'crate': k.use('wood', 0x6a4c30).box(p.x, 0, p.z, p.w, p.h, p.d, p.rot).use('wood', DARK_WOOD).box(p.x, 0, p.z, p.w + .04, .12, p.d + .04, p.rot).box(p.x, p.h - .12, p.z, p.w + .04, .12, p.d + .04, p.rot); break;
    case 'fence': {
      k.use('wood', WOOD);
      for (let i = 0; i < 4; i++) { const [x, z] = local(p, (i / 3 - .5) * p.w, 0); k.box(x, 0, z, .14, p.h, .14, p.rot + (r - .5) * .2); }
      const [x, z] = local(p, 0, 0);
      k.box(x, p.h * .45, z, p.w, .1, .08, p.rot).box(x, p.h * .8, z, p.w, .1, .08, p.rot + .05);
      break;
    }
    case 'stake': {
      k.use('wood', DARK_WOOD).cylinder(p.x, 0, p.z, .09, p.h, 6, 0, (r - .5) * .2, (r - .5) * .2, .2);
      // Some carry what the rift left on them.
      if (r > .45) impaled(k, p.x, p.z, p.h, r);
      break;
    }
    case 'pyre': {
      k.use('wood', CHAR);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; k.cylinder(p.x + Math.cos(a) * .6, .1, p.z + Math.sin(a) * .6, .12, 1.5, 6, a, 1.1, 0); }
      k.use('wood', DARK_WOOD).cylinder(p.x, 0, p.z, .1, 3.4, 6);
      impaled(k, p.x, p.z, 3.2, r);
      fires.push({ x: p.x, y: .2, z: p.z, size: 2.2, smoke: 1, seed: r * 10 });
      break;
    }
    case 'rock': k.use('stone', STONE).rock(p.x, 0, p.z, p.w, p.h, p.d, p.rot); break;
    case 'tree': {
      // Dead, black, twisted.
      k.use('wood', 0x1e1814).cylinder(p.x, 0, p.z, p.w * .45, p.h * .6, 7, p.rot, .05, 0, .6);
      for (let i = 0; i < 5; i++) {
        const a = p.rot + i * 1.3, lift = .4 + i * .09;
        k.cylinder(p.x + Math.sin(a) * .2, p.h * lift, p.z + Math.cos(a) * .2, .14, p.h * .45, 5, a, .9 + (i % 2) * .3, 0, .15);
      }
      if (r > .5) k.use('cloth', 0x2a2420).box(p.x + 1.2, p.h * .5, p.z, .1, 1.2, .1);
      break;
    }
    case 'torii': {
      // A gate the fight runs under: two posts, the tie beam, the black-capped
      // lintel - lacquer red, darker with frost on the Shrine, and snow on it.
      const red = stage === 'rift-frost' ? 0x6a1810 : 0x8a160e;
      k.use('wood', red, .06);
      for (const side of [-1, 1]) { const [x, z] = local(p, side * p.w * .4, 0); k.cylinder(x, 0, z, .24, p.h * .95, 10, p.rot, 0, 0, .88); }
      const [cx, cz] = local(p, 0, 0);
      k.box(cx, p.h * .7, cz, p.w * 1.02, .28, .3, p.rot).box(cx, p.h * .88, cz, p.w * 1.16, .2, .34, p.rot);
      k.use('dark', 0x120806, .05).box(cx, p.h * .95, cz, p.w * 1.34, .34, .44, p.rot);
      if (stage === 'rift-frost') k.use('plaster', 0xe6ecf4, .04).box(cx, p.h * .95 + .33, cz, p.w * 1.3, .1, .46, p.rot);
      break;
    }
    case 'lantern': {
      // A stone lantern: its foot, shaft, fire box, roof - and the light in it
      // (cold at the Shrine, the Grove's red).
      const cold = stage === 'rift-frost';
      k.use('stone', cold ? 0x8a929c : 0x5a5650, .08)
        .cylinder(p.x, 0, p.z, .36, .2, 6).cylinder(p.x, .2, p.z, .14, .86, 6).box(p.x, 1.06, p.z, .58, .12, .58, p.rot)
        .box(p.x, 1.18, p.z, .46, .4, .46, p.rot).cone(p.x, 1.58, p.z, .52, .34, 4, p.rot + Math.PI / 4);
      k.use('glow', cold ? 0x5aa8ff : 0xff4a22).box(p.x, 1.24, p.z, .3, .28, .48, p.rot).box(p.x, 1.24, p.z, .48, .28, .3, p.rot);
      if (!cold && r > .4) fires.push({ x: p.x, y: 1.3, z: p.z, size: .35, smoke: .1, seed: r * 10 });
      if (cold) k.use('plaster', 0xe6ecf4, .04).cone(p.x, 1.62, p.z, .44, .16, 4, p.rot + Math.PI / 4);
      break;
    }
    case 'shrine': {
      // A shrine's hall on its stone plinth: dark timbers, a deep roof in two
      // tiers (snowed white on the Shrine), the rope over its door.
      const frost = stage === 'rift-frost';
      k.use('stone', 0x4a4a50, .06).box(p.x, 0, p.z, p.w + 1.4, .8, p.d + 1.4, p.rot);
      k.use('wood', stage === 'rift-grove' ? 0x4a100c : 0x2a1a14, .08).box(p.x, .8, p.z, p.w, p.h * .42, p.d, p.rot);
      k.use('wood', 0x160c08, .05);
      for (const [lx, lz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [0, .5], [0, -.5]]) { const [x, z] = local(p, lx * (p.w - .3), lz * (p.d - .3)); k.cylinder(x, .8, z, .2, p.h * .46, 8); }
      k.use(frost ? 'plaster' : 'dark', frost ? 0xdce4ee : 0x16161c, .05).gable(p.x, .8 + p.h * .42, p.z, p.w + 2.6, p.d + 2.4, p.h * .3, p.rot);
      k.gable(p.x, .8 + p.h * .68, p.z, p.w * .64, p.d * .64 + .9, p.h * .26, p.rot);
      const [dx, dz] = local(p, 0, p.d / 2 + .05);
      k.use('cloth', 0xd8c8a0, .06).box(dx, .8 + p.h * .36, dz, p.w * .7, .18, .18, p.rot);
      k.use('glow', frost ? 0x5aa8ff : 0xff5a2a).box(dx, 1.2, dz, 1.6, 1.6, .05, p.rot);
      break;
    }
    case 'ice': {
      // Ice the rift froze out of the ground: a cluster of shards, glassy and
      // pale, a cold light down in the heart of it.
      k.use('metal', 0xa8d0ee, .1);
      const n = 5 + Math.floor(r * 4);
      for (let i = 0; i < n; i++) {
        const a = r * 20 + i * 2.4, off = (i ? .35 + (i % 3) * .22 : 0) * p.w * .5, x = p.x + Math.cos(a) * off, z = p.z + Math.sin(a) * off;
        const tall = p.h * (i ? .38 + ((r * 7 + i * .37) % 1) * .55 : 1), lean = i ? .22 + (i % 2) * .16 : .04;
        k.cone(x, -.25, z, p.w * (i ? .15 : .24), tall, 5, a, Math.cos(a) * lean, Math.sin(a) * lean);
      }
      k.use('glow', 0x2a6aa8).cone(p.x, -.1, p.z, p.w * .1, p.h * .6, 5, r * 3);
      break;
    }
    case 'bamboo': {
      // A stand of bamboo: a dozen stalks at their own leans, their joints,
      // and the dark leaves at the crown (the Grove's gone the colour of blood).
      const n = 8 + Math.floor(r * 6), crimson = stage === 'rift-grove';
      for (let i = 0; i < n; i++) {
        const a = r * 30 + i * 2.39996, off = Math.sqrt((i + .5) / n) * p.w * .5, x = p.x + Math.cos(a) * off, z = p.z + Math.sin(a) * off;
        const tall = p.h * (.7 + ((r * 11 + i * .61) % 1) * .3), lx = (((r * 5 + i * .3) % 1) - .5) * .14, lz = (((r * 3 + i * .7) % 1) - .5) * .14;
        k.use('wood', crimson ? 0x3a4424 : 0x4a5a30, .14).cylinder(x, 0, z, .075 + (i % 3) * .018, tall, 6, a, lx, lz, .75);
        k.use('wood', 0x1e2410, .05);
        for (const at of [.3, .55, .8]) k.cylinder(x - Math.sin(lz) * tall * at, tall * at, z + Math.sin(lx) * tall * at, .1 + (i % 3) * .018, .06, 6, a);
      }
      k.use('cloth', crimson ? 0x4a0c0a : 0x24321a, .2);
      for (let i = 0; i < 7; i++) { const a = r * 9 + i * .9, x = p.x + Math.cos(a) * p.w * .4, z = p.z + Math.sin(a) * p.w * .4; k.rock(x, p.h * (.72 + (i % 3) * .08), z, p.w * .32, p.w * .18, p.w * .3, a); }
      break;
    }
    case 'ribs': {
      // A fallen god's ribs: its spine along the ground, and pairs of great
      // curved bones rising from it and bending in over the field, the tips
      // not quite meeting - a hall of bone the fight runs through.
      const pairs = 6, bone = 0xb4aa92, d = p.d / 2, h = p.h;
      k.use('bone', bone, .1);
      for (let i = 0; i < 14; i++) { const [x, z] = local(p, (i / 13 - .5) * p.w, 0); k.sphere(x, .35, z, .6 - Math.abs(i / 13 - .5) * .3, .7); }
      for (let i = 0; i < pairs; i++) {
        const t = (i / (pairs - 1) - .5) * p.w * .82, scale = 1 - Math.abs(i / (pairs - 1) - .5) * .5;
        for (const side of [-1, 1]) {
          // Out from the spine, up, and in over the top (an arc of short bones).
          let pu = 0, py = .3;
          for (let j = 1; j <= 6; j++) {
            const phi = j / 6 * Math.PI * .88;
            const nu = side * d * scale * Math.sin(phi), ny = .3 + h * scale * (1 - Math.cos(phi)) / 2;
            const [ax, az] = local(p, t, pu);
            k.cylinder(ax, py, az, .34 * scale * (1 - j * .08), Math.hypot(nu - pu, ny - py) + .12, 7, p.rot, Math.atan2(nu - pu, ny - py), 0, .85);
            pu = nu; py = ny;
          }
        }
      }
      break;
    }
    case 'skull': {
      // Its skull, the size of a house, facing into the field: the vault, the
      // muzzle, the black holes of the eyes, the teeth, the horns.
      const s = p.h / 5.5;
      k.use('bone', 0xb4aa92, .08).sphere(p.x, p.h * .5, p.z, p.w * .45, .88);
      const [jx, jz] = local(p, 0, p.d * .3); k.box(jx, 0, jz, p.w * .56, p.h * .34, p.d * .42, p.rot);
      k.use('dark', 0x0a0606);
      for (const side of [-1, 1]) { const [ex, ez] = local(p, side * p.w * .19, p.d * .33); k.sphere(ex, p.h * .56, ez, p.w * .12, 1); }
      const [nx, nz] = local(p, 0, p.d * .42); k.sphere(nx, p.h * .38, nz, p.w * .07, 1.3);
      k.use('bone', 0xd4caae, .06);
      for (let i = 0; i < 8; i++) { const [tx, tz] = local(p, (i / 7 - .5) * p.w * .48, p.d * .5); k.cone(tx, p.h * .08, tz, .18 * s, .6 * s, 4); }
      k.use('bone', 0x6a6050, .06);
      for (const side of [-1, 1]) { const [hx, hz] = local(p, side * p.w * .36, -.2); k.cone(hx, p.h * .78, hz, .55 * s, p.h * .85, 6, p.rot, -.45, side * -.7); }
      break;
    }
    case 'mast': {
      // A ship's mast, snapped and driven into the sand: the pole, its yard,
      // a rag of sail still on it.
      k.use('wood', DARK_WOOD, .1).cylinder(p.x, -.4, p.z, p.w * .34, p.h, 8, p.rot, (r - .5) * .16, (r - .5) * .16, .7);
      k.box(p.x, p.h * .72, p.z, 5.2, .22, .22, p.rot + r * 2, 0, (r - .5) * .3);
      if (r > .3) k.use('cloth', 0x3e3c34, .14).box(p.x, p.h * .34, p.z, 4.6, p.h * .36, .04, p.rot + r * 2, (r - .5) * .3, 0);
      break;
    }
    case 'hull': {
      // A hull on its side in the sand, a third of it sunk: dark planking, the
      // keel along its top, broken ribs where the planks are gone.
      k.use('wood', 0x3a2a1c, .1).add(HULL, p.x, -p.h * .3, p.z, 0, p.rot, .45, p.w * .5, p.h * .78, p.d * .5);
      k.use('wood', 0x1a120c, .06);
      for (let i = 0; i < 8; i++) { const [x, z] = local(p, (i / 7 - .5) * p.w * .74, p.d * .18); k.cylinder(x, 0, z, .13, p.h * .95, 5, p.rot, .55, 0, .6); }
      const [kx, kz] = local(p, 0, -p.d * .22); k.box(kx, p.h * .6, kz, p.w * 1.04, .36, .36, p.rot, 0, .45);
      break;
    }
    case 'pier': {
      // A pier's planks over the sand, some gone, on their posts.
      const planks = Math.max(4, Math.round(p.d / .5));
      k.use('wood', 0x4a3a2a, .16);
      for (let i = 0; i < planks; i++) {
        if (((r * 37 + i * .31) % 1) < .1) continue;
        const [x, z] = local(p, 0, (i / (planks - 1) - .5) * (p.d - .4));
        k.box(x, .02, z, p.w * (.9 + ((i * .17) % 1) * .14), .12, .42, p.rot + (((i * .13) % 1) - .5) * .06);
      }
      k.use('wood', DARK_WOOD, .08);
      for (let i = 0; i < 6; i++) for (const side of [-1, 1]) { const [x, z] = local(p, side * p.w * .5, (i / 5 - .5) * p.d); k.cylinder(x, -.6, z, .16, 1.5 + ((i * .29) % 1) * .8, 6); }
      break;
    }
    case 'grave': k.use('stone', stage === 'rift-frost' ? 0x7a808a : 0x5a5850).box(p.x, 0, p.z, p.w, p.h, p.d, p.rot, (r - .5) * .3, (r - .5) * .25); break;
    case 'sword': {
      const tilt = (r - .5) * .7;
      k.use('metal', 0x8a8e96).box(p.x, -.2, p.z, .07, p.h, .018, p.rot, tilt, (r - .5) * .4).use('metal', 0x3a3a3e).box(p.x, p.h * .8, p.z, .32, .06, .06, p.rot, tilt);
      k.use('cloth', 0x2a1a14).box(p.x, p.h * .85, p.z, .05, .3, .05, p.rot, tilt);
      break;
    }
    case 'statue': statue(k, p, stage, fires); break;
    case 'brazier': {
      k.use('metal', 0x2a2622).cylinder(p.x, 0, p.z, .12, 1.2, 6).cylinder(p.x, 1.15, p.z, .55, .35, 10, 0, 0, 0, 1.3);
      k.use('glow', 0xff8a3a).cylinder(p.x, 1.35, p.z, .5, .08, 10);
      fires.push({ x: p.x, y: 1.4, z: p.z, size: 1.1, smoke: .35, seed: r * 10 });
      break;
    }
    case 'pillar': {
      const h = p.h * (.45 + r * .55);
      k.use('stone', 0x54525a).cylinder(p.x, 0, p.z, p.w / 2 * 1.15, .6, 10).cylinder(p.x, .6, p.z, p.w / 2, h - .6, 12, r * 3, 0, 0, .92);
      if (h < p.h * .8) k.rock(p.x + .8, 0, p.z + .4, 1.2, .7, 1, r * 5);
      break;
    }
    case 'altar': {
      k.use('stone', 0x3a3438).cylinder(p.x, 0, p.z, p.w / 2, .5, 8).cylinder(p.x, .5, p.z, p.w / 2 * .8, .9, 8, .4);
      k.use('glow', 0xff2a1a);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box(p.x + Math.cos(a) * .62, 1.41, p.z + Math.sin(a) * .62, .28, .02, .1, Math.PI / 2 - a); }
      break;
    }
    case 'stone': {
      if (stage === 'rift-eclipse') {
        // The ring round the altar is not stones but the sacrificed: stakes
        // taller than a house, each with its body, black against the red sky
        // on every side of the fight (grey blocks there read as masonry).
        const tall = p.h + 1.5;
        // (Upright: a leaning stake put its body beside its tip.)
        k.use('wood', DARK_WOOD, .1).cylinder(p.x, 0, p.z, .16, tall, 6, 0, 0, 0, .15);
        k.use('flesh', 0xffffff, .08).add(corpse('impaled', Math.floor(r * 4)), p.x, tall - 2.05, p.z, 0, p.rot + r * 3, 0, 1.15, 1.15, 1.15, true);
        if (r > .55) k.add(corpse('hanged', Math.floor(r * 9) + 1), p.x + Math.cos(p.rot) * .35, tall - 4.4, p.z - Math.sin(p.rot) * .35, 0, p.rot + 1.3, 0, 1, 1, 1, true);
        break;
      }
      k.use('stone', 0x46424a).box(p.x, 0, p.z, p.w, p.h, p.d, p.rot, (r - .5) * .12, (r - .5) * .1); break;
    }
    case 'bones': {
      k.use('bone', 0xc8bca0);
      for (let i = 0; i < 5; i++) { const a = r * 20 + i * 1.7; k.box(p.x + Math.cos(a) * .5, .05, p.z + Math.sin(a) * .5, .5, .07, .07, a); }
      k.sphere(p.x, .12, p.z, .13, .9);
      break;
    }
    case 'cage': {
      k.use('metal', 0x2a2826);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box(p.x + Math.cos(a) * p.w / 2, 0, p.z + Math.sin(a) * p.w / 2, .05, p.h, .05); }
      k.cylinder(p.x, p.h - .06, p.z, p.w / 2, .08, 10).cylinder(p.x, 0, p.z, p.w / 2, .08, 10);
      if (r > .4) impaled(k, p.x, p.z, 1.4, r, true);
      break;
    }
    case 'banner': {
      k.use('wood', DARK_WOOD).cylinder(p.x, 0, p.z, .06, p.h, 6).box(p.x, p.h - .1, p.z, 1.2, .06, .06, p.rot);
      k.use('cloth', r > .5 ? 0x5a0e14 : 0x141418).box(p.x, p.h - 1.9, p.z, 1.1, 1.8, .03, p.rot, 0, (r - .5) * .1);
      break;
    }
    case 'corpse': {
      // A body where it fell, or a heap of them (seed past .8).
      const pose: CorpsePose = r > .8 ? 'heap' : r > .4 ? 'back' : 'face';
      k.use('flesh', 0xffffff, .1).add(corpse(pose, Math.floor(r * 40)), p.x, 0, p.z, 0, p.rot, 0, 1, 1, 1, true);
      break;
    }
    case 'gallows': {
      // Two posts, a beam, a brace - and whoever was left on it.
      k.use('wood', DARK_WOOD, .12);
      for (const side of [-1, 1]) { const [x, z] = local(p, side * p.w / 2, 0); k.box(x, 0, z, .22, p.h, .22, p.rot); }
      k.box(p.x, p.h - .1, p.z, p.w + .5, .22, .22, p.rot);
      for (const side of [-1, 1]) { const [x, z] = local(p, side * (p.w / 2 - .45), 0); k.box(x, p.h - .6, z, .12, .9, .12, p.rot, 0, side * .75); }
      const bodies = r > .5 ? 2 : 1;
      for (let i = 0; i < bodies; i++) {
        const [x, z] = local(p, bodies === 1 ? 0 : (i - .5) * p.w * .5, 0);
        k.use('flesh', 0xffffff, .08).add(corpse('hanged', Math.floor(r * 7) + i), x, p.h - 2.35, z, 0, p.rot + (i - .5) * .5, (r - .5) * .1, 1, 1, 1, true);
      }
      break;
    }
    case 'wall': {
      k.use('stone', 0x3a3a42).box(p.x, 0, p.z, p.w, p.h, p.d, p.rot);
      for (let i = 0; i < 5; i++) { const [x, z] = local(p, (i / 4 - .5) * (p.w - .6), 0); k.box(x, p.h, z, .6, .7, p.d, p.rot); }
      if (stage === 'rift-fortress') {
        // The fortress hangs its dead from its walls, on the courtyard's side:
        // gibbet arms at a height the fight's own frame reaches, a body on each
        // (they come down with the wall).
        const [ax, az] = local(p, 0, p.d / 2), [bx, bz] = local(p, 0, -p.d / 2);
        const inward = Math.hypot(ax, az) < Math.hypot(bx, bz) ? 1 : -1, arm = Math.min(p.h - 1, 5.4);
        for (const u of [-.28, .3]) {
          const [x, z] = local(p, u * p.w, inward * (p.d / 2 + .45)), [cx, cz] = local(p, u * p.w, inward * (p.d / 2 + .2));
          k.use('wood', DARK_WOOD, .12).box(cx, arm, cz, .16, .16, .7, p.rot);
          k.use('flesh', 0xffffff, .08).add(corpse('hanged', Math.floor(r * 9 + u * 7) & 3), x, arm - 2.3, z, 0, p.rot + u * 1.7 + (inward < 0 ? Math.PI : 0), (r - .5) * .12, 1, 1, 1, true);
        }
      }
      break;
    }
    default: break;
  }
}

/** A body on a stake or in a cage: the rift's first work (corpses.ts). */
function impaled(k: Sculpt, x: number, z: number, h: number, r: number, slumped = false) {
  if (slumped) { k.use('flesh', 0xffffff, .08).add(corpse('slumped', Math.floor(r * 4)), x, 0, z, 0, r * 6, 0, 1, 1, 1, true); return; }
  // The stake's top is where the body was driven down onto it.
  k.use('flesh', 0xffffff, .08).add(corpse('impaled', Math.floor(r * 4)), x, h - 2, z, 0, r * 6, 0, 1, 1, 1, true);
}

/** A timber-framed house - or what the fire and the rift left of one. */
function house(k: Sculpt, p: RiftProp, fires: FireSpot[], ruined: boolean) {
  const { w, d, h, rot, seed: r } = p;
  // Four houses in five burn from the start (a third stood unlit, and the
  // village read as lit windows, not a town on fire); the rest catch later.
  const burning = ruined || r > .2;
  const wallH = ruined ? h * (.5 + r * .3) : h * .62;
  // Stone footing, plaster walls, dark beams.
  k.use('stone', 0x4a4640).box(p.x, 0, p.z, w + .2, .6, d + .2, rot);
  // A burning house is sooted dark (in pale plaster behind lit windows it
  // read as a lamp-lit home on a warm evening).
  k.use('plaster', burning ? 0x4e443a : PLASTER, .1).box(p.x, .6, p.z, w, wallH - .6, d, rot);
  k.use('wood', burning ? CHAR : DARK_WOOD, .15);
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { const [x, z] = local(p, lx, lz); k.box(x, .6, z, .22, wallH - .5, .22, rot); }
  for (const side of [-1, 1]) {
    const [x, z] = local(p, 0, side * (d / 2 + .02));
    k.box(x, wallH * .55, z, w, .16, .1, rot).box(x, wallH - .1, z, w, .16, .1, rot);
    for (const t of [-.3, .3]) { const [bx, bz] = local(p, t * w, side * (d / 2 + .03)); k.box(bx, .7, bz, .14, wallH * .7, .08, rot, 0, t > 0 ? .5 : -.5); }
  }
  // Windows lit from inside: the fire is in there.
  const glow = burning ? 0xff7a2a : 0xffb060;
  for (const side of [-1, 1]) for (const t of [-.25, .25]) {
    const [x, z] = local(p, t * w, side * (d / 2 + .06));
    k.use('glow', glow).box(x, wallH * .62, z, .7, .8, .04, rot);
    // Soot licked up the wall from it to the eaves.
    if (burning) { const [sx, sz] = local(p, t * w, side * (d / 2 + .07)); k.use('wood', CHAR, .05).box(sx, wallH * .62 + .45, sz, .62, wallH * .38 - .45, .03, rot, 0, (r - .5) * .12); }
    // Flames out of the windows, and smoke off them: the roofs burned above
    // the fight's frame, and from where it is watched the village looked lit, not burning.
    if (burning) fires.push({ x, y: wallH * .45, z, size: 1.25, smoke: .3, seed: r * 20 + t * 3 + side });
  }
  // And at its foot, what fell from it burning in the street.
  if (burning) { const [gx, gz] = local(p, (r - .5) * w * .6, (r > .5 ? 1 : -1) * (d / 2 + .9)); fires.push({ x: gx, y: .1, z: gz, size: 1.5 + r, smoke: .6, seed: r * 47 + 9 }); }
  if (!ruined) {
    // The roof, thatch or dark tile - and on half of those burning, burned
    // through: its two ends left standing, charred rafters over the gap and
    // the fire coming out of it.
    const roof = r > .6 ? 'stone' : 'thatch', colour = r > .6 ? 0x2e2a2c : burning ? 0x3a2c1c : THATCH;
    if (burning && r > .45) {
      const span = w + .9, end = span * .34;
      for (const e of [-1, 1]) { const [ex, ez] = local(p, e * (span / 2 - end / 2), 0); k.use(roof, colour, .12).gable(ex, wallH, ez, end, d + .8, h * .55, rot); }
      k.use('wood', CHAR, .1);
      for (let i = 0; i < 3; i++) { const [bx, bz] = local(p, (i - 1) * span * .11, 0); k.box(bx, wallH + h * (.18 + (i % 2) * .12), bz, .16, .16, d + .5, rot, (i - 1) * .35, 0); }
    } else k.use(roof, colour, .12).gable(p.x, wallH, p.z, w + .9, d + .8, h * .55, rot + Math.PI / 2 * 0);
    const [cx, cz] = local(p, w * .3, 0);
    k.use('stone', 0x3a3632).box(cx, wallH, cz, .6, h * .6, .6, rot);
    // The ones not burning yet catch as the place's rounds go on.
    const from = burning ? 0 : r < .1 ? .5 : .95;
    fires.push({ x: p.x, y: wallH + h * .35, z: p.z, size: 2.4 + r * 1.4, smoke: 1, seed: r * 31, from });
    const [fx, fz] = local(p, -w * .3, 0);
    fires.push({ x: fx, y: wallH + h * .2, z: fz, size: 1.8, smoke: .6, seed: r * 17 + 4, from: from ? from + .1 : 0 });
  } else {
    // Charred rafters over the broken walls, still burning.
    k.use('wood', CHAR, .1);
    for (let i = 0; i < 4; i++) { const [x, z] = local(p, (i / 3 - .5) * w * .8, 0); k.box(x, wallH, z, .2, .2, d + .6, rot, (i % 2 - .5) * .3); }
    fires.push({ x: p.x, y: wallH * .5, z: p.z, size: 2.6, smoke: 1, seed: r * 13 });
  }
}

function tower(k: Sculpt, p: RiftProp, stage: RiftStageId, fires: FireSpot[]) {
  const { w, h } = p;
  k.use('stone', stage === 'rift-fortress' ? 0x3a3a44 : 0x5a5650, .06).box(p.x, 0, p.z, w, h, w, p.rot);
  // Crenellations, and a lit slit window on each face.
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const a = (i / 3 - .5) * (w - .7);
    k.box(p.x + a, h, p.z + side * (w / 2 - .3), .7, .8, .6, p.rot).box(p.x + side * (w / 2 - .3), h, p.z + a, .6, .8, .7, p.rot);
  }
  if (stage === 'rift-village') {
    // The bell tower: a peaked roof and the bell in its arch.
    k.use('stone', 0x2a2628).cone(p.x, h + .8, p.z, w * .75, 4.5, 4, Math.PI / 4);
    k.use('metal', 0x6a5a3a).cylinder(p.x, h - 2.6, p.z, .7, 1.4, 12, 0, 0, 0, .55);
    fires.push({ x: p.x, y: h + 1, z: p.z, size: 2.8, smoke: 1, seed: 7 });
  }
  for (const side of [-1, 1]) k.use('glow', 0xff8a3a).box(p.x + side * (w / 2 + .01), h * .7, p.z, .04, 1.2, .3, 0);
  if (stage === 'rift-fortress') {
    // The fortress's towers burn: from the top from the start, and out of the
    // windows on the courtyard's side as the siege goes on - low enough for
    // the fight's own frame (fire at eighteen metres was above every shot).
    fires.push({ x: p.x, y: h + .8, z: p.z, size: 3.2, smoke: 1, seed: p.x * .7 + p.z });
    const sx = -Math.sign(p.x) || 1, sz = -Math.sign(p.z) || 1;
    fires.push({ x: p.x + sx * (w / 2 + .35), y: h * .42, z: p.z, size: 2.2, smoke: .7, seed: p.x + 3, from: .5 },
      { x: p.x, y: h * .58, z: p.z + sz * (w / 2 + .35), size: 2, smoke: .7, seed: p.z + 5, from: .95 });
  }
}

function statue(k: Sculpt, p: RiftProp, stage: RiftStageId, fires: FireSpot[]) {
  if (stage === 'rift-swords') {
    // A sword the size of a man twice over, driven into a cairn: a
    // plain, heavy slab of iron.
    k.use('stone', 0x4a4844).rock(p.x, 0, p.z, 4.2, 1.8, 4, .3);
    k.use('metal', 0x3c3e44).box(p.x, .8, p.z, .55, p.h, .16, .2, .06).box(p.x, p.h * .92, p.z, 1.9, .3, .3, .2, .06);
    k.use('cloth', 0x2a1a16).box(p.x, p.h + .2, p.z, .3, 1.4, .3, .2, .06);
    return;
  }
  // A knight on a plinth, headless now.
  k.use('stone', 0x4a4852).box(p.x, 0, p.z, p.w, 1.6, p.w, p.rot);
  k.box(p.x, 1.6, p.z, 1.3, 2.8, .8, p.rot).box(p.x - .9, 3.2, p.z, .45, 1.6, .45, p.rot, 0, .3).box(p.x + .9, 3.2, p.z, .45, 1.6, .45, p.rot, 0, -.3);
  k.use('metal', 0x2e2e34).box(p.x + 1.2, 1.8, p.z, .18, 3.4, .1, p.rot, 0, -.1);
  void fires;
}

/** The world round the arena: hills, silhouettes, and what burns beyond the bounds. */
function buildSurroundings(k: Sculpt, stage: RiftStageId, palette: Palette, fires: FireSpot[], pieces: SetPiece[], dressed: Dressed[]) {
  const { halfX, halfZ } = STAGES[stage];
  /** What follows (until the next call, or tag 0) is one set piece: it stands
   *  at (x, z) and falls toward `angle`. */
  const piece = (x: number, z: number, angle: number, size: number, height: number, rigid = false, y = 0) => {
    const tag = PIECE_TAGS + pieces.length;
    if (tag >= TAGS) { k.tag(0); return 0; }
    pieces.push({ tag, x, z, angle, size, height, rigid, y }); k.tag(tag);
    return tag;
  };
  const at = (x: number, z: number) => groundAt(stage, x, z);
  let seed = stage.length * 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Distant ridges: a ring of dark crags, fogged into the horizon.
  k.use('dark', palette.hills, .1);
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2 + rnd() * .1, r = 150 + rnd() * 40;
    // (Not out to sea at the Harbour: that horizon is the wave's. Its draws are still taken, so
    // nothing after it in the place moves.)
    if (stage === 'rift-harbor' && Math.sin(a) > .12) { rnd(); rnd(); rnd(); rnd(); continue; }
    k.rock(Math.cos(a) * r, -4, Math.sin(a) * r, 40 + rnd() * 30, 30 + rnd() * 55, 30 + rnd() * 20, rnd() * 6);
  }
  if (riftPlaceBeyond(k, stage, { halfX, halfZ, fires, piece, at })) return;
  if (stage === 'rift-village') {
    // A palisade of sharpened stakes round the village, and beyond it more
    // of the town, burning.
    k.use('wood', 0x3a2818, .15);
    const ring = Math.max(halfX, halfZ) + 3.5;
    for (let i = 0; i < 150; i++) {
      const a = i / 150 * Math.PI * 2, r = ring + rnd() * .8;
      k.cone(Math.cos(a) * r, at(Math.cos(a) * r, Math.sin(a) * r) - .2, Math.sin(a) * r, .22, 3.2 + rnd() * 1.2, 5, 0, (rnd() - .5) * .15, (rnd() - .5) * .15);
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = ring + 10 + rnd() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r, w = 6 + rnd() * 4, h = 4 + rnd() * 4;
      const g = at(x, z) - .3, tag = piece(x, z, Math.atan2(x, z) + (rnd() - .5) * .8, w, h * 1.6, false, g);
      // The town beyond: burning houses and the ruins of them (a box under a gable, if their models never come).
      dressed.push({ id: ['house-a', 'house-b', 'ruin'][i % 3], tag, far: true, x, y: g, z, yaw: a, w, d: w * .8,
        code: s => s.use('plaster', 0x3a3028, .1).box(x, g, z, w, h + .3, w * .8, a).use('thatch', 0x2a2014, .1).gable(x, g + h + .3, z, w + .8, w * .8 + .6, h * .6, a) });
      k.tag(0);
      const lit = rnd();
      fires.push({ x, y: g + h + .8, z, size: 3 + rnd() * 3, smoke: 1, seed: rnd() * 50, from: lit < .55 ? 0 : lit < .8 ? .5 : .95, tag });
    }
  } else if (stage === 'rift-swords') {
    // Swords to the horizon: the whole hillside is graves. Thickest just past
    // the field's edge and bigger the further up the slope, so they still read
    // as blades from the fight (at eight centimetres wide they were a haze of
    // nothing); each a blade and its cross-guard, planted at a lean.
    const edge = Math.max(halfX, halfZ), lean = new THREE.Euler(0, 0, 0, 'YXZ'), up = new THREE.Vector3();
    // (600 of them, the far ones without guards: 1,100 thin blades, most of
    // them slivers under a pixel at the slope's distance, cost 5 ms a frame.)
    for (let i = 0; i < 600; i++) {
      const a = rnd() * Math.PI * 2, out = Math.pow(rnd(), 1.9) * 72, r = edge + 1.5 + out, x = Math.cos(a) * r, z = Math.sin(a) * r;
      // (On the ground as it is: a radial guess floated the diagonals' blades metres up.)
      const lift = groundAt(stage, x, z);
      const size = 1 + out / 26, tall = (1.7 + rnd() * 1.1) * size, yaw = rnd() * 6, rx = (rnd() - .5) * .5, rz = (rnd() - .5) * .45, foot = lift - .35 * size;
      k.use('metal', rnd() < .7 ? 0x5a5c62 : 0x3c3a3e, .2).box(x, foot, z, .13 * size, tall, .035 * size, yaw, rx, rz);
      if (out < 24) {
        up.set(0, tall * .8, 0).applyEuler(lean.set(rx, yaw, rz, 'YXZ'));
        k.use('metal', 0x2e2c30, .1).box(x + up.x, foot + up.y, z + up.z, .5 * size, .07 * size, .09 * size, yaw, rx, rz);
      }
    }
    // The sword the hill is named for: planted on the horizon, against the low
    // sun - and two lesser giants on the crest behind the field, where the
    // fight's own frame reaches them.
    // (Each the giant sword's model, blade, cross and cairn - its code-built slab if the model never comes.)
    const giant = (x: number, y: number, z: number, yaw: number, scale: number, lean: number) =>
      dressed.push({ id: 'giant-sword', tag: 0, far: true, x, y: y - 4 * scale, z, yaw, tilt: [lean, 0], h: 66 * scale, code: s => colossalSword(s, x, y, z, yaw, scale, lean) });
    { const sun = new THREE.Vector3(.72, 0, -.68).normalize(), far = 150, x = sun.x * far, z = sun.z * far;
      giant(x, 16, z, Math.atan2(-x, -z), 1.05, .1); }
    // And four giants driven into the slope round the field, near enough that
    // whichever way the fight faces one stands in the frame (the Hill "shrank
    // to dark slopes with thin sticks" in play - its sword was on the horizon).
    // (Leaning hard, their guards and hilts come down into the frame: upright,
    // the lens pitched at the fight saw only dark poles.)
    for (const [az, far, scale, tilt] of [[.4, 44, .46, .42], [1.95, 47, .52, -.38], [3.15, 43, .44, .45], [4.7, 48, .5, -.4]] as const) {
      const x = Math.cos(az) * far, z = Math.sin(az) * far;
      giant(x, groundAt(stage, x, z) - 2, z, Math.atan2(-x, -z) + .3, scale, tilt);
    }
    for (const [az, far, scale, tilt] of [[3.6, 78, .5, .16], [5.4, 84, .42, -.12]] as const) {
      const x = Math.cos(az) * far, z = Math.sin(az) * far;
      giant(x, groundAt(stage, x, z) - 1.5, z, Math.atan2(-x, -z) + .4, scale, tilt);
    }
    k.use('wood', 0x1a1612);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, r = Math.max(halfX, halfZ) + 6 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const tall = 8 + rnd() * 6, g = at(x, z) - .4;
      piece(x, z, rnd() * Math.PI * 2, 3, tall, true, g);
      k.cylinder(x, g, z, .5, tall, 6, rnd() * 6, (rnd() - .5) * .2, 0, .3);
      k.tag(0);
    }
    // The dry grass of the hill takes fire as the fighting goes on: a line of
    // it creeping along the slope, then the crown.
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + rnd() * .2, r = Math.max(halfX, halfZ) + 4 + rnd() * 18, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const lift = groundAt(stage, x, z);
      fires.push({ x, y: lift, z, size: 1.6 + rnd() * 1.8, smoke: .8, seed: rnd() * 60, from: i % 2 ? .5 : .95 });
    }
  } else if (stage === 'rift-fortress') {
    // The curtain wall itself, all the way round, and the keep beyond.
    k.use('stone', 0x2c2c34, .05);
    // In stretches of about eight metres, each able to come down on its own.
    const stretches: { x: number; z: number; along: boolean; part: number; tag: number }[] = [];
    // Standing nine metres out, its inner face past where the camera may go
    // (6.6 m beyond the field): at 2.5 m the lens pressed into it and its dark
    // face filled a third of the frame.
    const gap = 9;
    for (const [x, z, w, d] of [[-halfX - gap, 0, 4, halfZ * 2 + gap * 2 + 4], [halfX + gap, 0, 4, halfZ * 2 + gap * 2 + 4], [0, -halfZ - gap, halfX * 2 + gap * 2 + 4, 4], [0, halfZ + gap, halfX * 2 + gap * 2 + 4, 4]]) {
      const along = w > d, length = along ? w : d, parts = Math.max(1, Math.round(length / 8)), part = length / parts;
      for (let j = 0; j < parts; j++) {
        const t = (j + .5) / parts * length - length / 2, cx = along ? x + t : x, cz = along ? z : z + t;
        const tag = piece(cx, cz, Math.atan2(cx, cz), part, 12, true);
        stretches.push({ x: cx, z: cz, along, part, tag });
        // A stretch of the curtain wall: its model filling the stretch's whole box (the stone and its battlements in code, if it never comes).
        const deep = along ? d : w;
        dressed.push({ id: 'curtain-wall', tag, far: true, x: cx, y: 0, z: cz, yaw: along ? 0 : Math.PI / 2, w: part - .04, d: deep, h: 12.4,
          code: s => {
            s.use('stone', 0x2c2c34, .05).box(cx, 0, cz, along ? part - .04 : w, 11, along ? d : part - .04);
            const n = Math.round(part / 1.6);
            for (let i = 0; i < n; i++) { const u = (i / Math.max(1, n - 1) - .5) * (part - .8); s.box(along ? cx + u : cx, 11, along ? cz : cz + u, along ? .8 : w, 1, along ? d : .8); }
          } });
        k.tag(0);
        // Inside it, hidden while it stands: the broken stump a breach leaves,
        // jagged teeth of wall a man's height or two.
        const across = (along ? d : w) - .3;
        for (let i = 0; i < 5; i++) {
          const u = (i / 4 - .5) * (part - 1.2), tooth = 1.2 + rnd() * 2.6, lean = (rnd() - .5) * .25;
          k.box(along ? cx + u : cx, 0, along ? cz : cz + u, along ? part / 4.2 : across, tooth, along ? across : part / 4.2, 0, along ? 0 : lean, along ? lean : 0);
        }
      }
    }
    // (Stood on the hill it is built on: at zero it was sunk nine metres into it.)
    const keep = at(0, halfZ + 20) - 1;
    // (The spikes' lean drawn up front, so the rest of the place is the same whether the keep is a model or code.)
    const thorns = Array.from({ length: 28 + 16 }, () => [rnd(), rnd(), rnd()] as const);
    dressed.push({ id: 'fortress-keep', tag: 0, far: true, x: 0, y: keep, z: halfZ + 30, yaw: Math.PI, w: 54, d: 26,
      code: s => {
        s.use('stone', 0x1c1c24).box(0, keep, halfZ + 30, 26, 38, 20).cone(0, keep + 38, halfZ + 30, 12, 16, 4, Math.PI / 4);
        s.box(-22, keep, halfZ + 26, 8, 30, 8).box(22, keep, halfZ + 26, 8, 30, 8);
        // Spiked, as its panel draws it: iron thorns along the keep's crown and
        // its towers' tops, raking outward.
        s.use('metal', 0x16141a, .06);
        for (let i = 0; i < 28; i++) {
          const t = i / 28, edge = Math.floor(t * 4), u = (t * 4 - edge) - .5, [r1, r2, r3] = thorns[i];
          const [sx, sz, ox, oz] = [[u * 26, -10, 0, -1], [13, u * 20, 1, 0], [-u * 26, 10, 0, 1], [-13, -u * 20, -1, 0]][edge];
          s.cone(sx, keep + 38, halfZ + 30 + sz, .45 + r1 * .3, 3 + r2 * 4, 4, 0, oz * (.35 + r3 * .35), -ox * (.35 + r3 * .35));
        }
        for (const [j, x] of [-22, 22].entries()) for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2, [r1, r2] = thorns[28 + j * 8 + i];
          s.cone(x + Math.cos(a) * 3.6, keep + 30, halfZ + 26 + Math.sin(a) * 3.6, .35 + r1 * .2, 2.5 + r2 * 2.5, 4, 0, Math.sin(a) * .5, -Math.cos(a) * .5);
        }
      } });
    for (const x of [-22, 22]) fires.push({ x, y: keep + 30.5, z: halfZ + 26, size: 3, smoke: .8, seed: x });
    // The keep catches, then the walls: siege fire climbing the stone.
    fires.push({ x: 0, y: keep + 38, z: halfZ + 24, size: 5, smoke: 1, seed: 3, from: .5 }, { x: -6, y: keep + 30, z: halfZ + 21, size: 3.4, smoke: 1, seed: 9, from: .95 }, { x: 7, y: keep + 26, z: halfZ + 21, size: 3, smoke: .9, seed: 13, from: .95 });
    // Siege fires along the foot of the walls inside, catching as the fight worsens.
    for (let i = 0; i < 12; i++) {
      const side = i % 4, t = (rnd() - .5) * halfX * 1.6, inset = halfX - 1.5 - rnd() * 2.5;
      const [fx, fz] = [[-inset, t], [inset, t], [t, -inset], [t, inset]][side];
      fires.push({ x: fx, y: 0, z: fz, size: 1.4 + rnd(), smoke: .8, seed: rnd() * 90, from: i < 4 ? 0 : i < 8 ? .5 : .95 });
    }
    for (let i = 0; i < 10; i++) {
      const on = stretches[Math.floor(rnd() * stretches.length)], t = (rnd() - .5) * (on.part - 1.6);
      fires.push({ x: on.along ? on.x + t : on.x, y: 11.5, z: on.along ? on.z : on.z + t, size: 1.8 + rnd() * 1.2, smoke: .8, seed: rnd() * 70, from: i < 5 ? .5 : .95, tag: on.tag });
    }
  } else if (stage === 'rift-frost') {
    // The mountain round the shrine: snowed-under crags close in, dead pines,
    // the shrine's outer wall with its lanterns, and pagodas beyond it that
    // come down as the fight goes on.
    const edge = Math.max(halfX, halfZ);
    k.use('plaster', 0xdfe6ee, .06);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + rnd() * .2, r = edge + 22 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
      k.rock(x, at(x, z) - 2, z, 10 + rnd() * 14, 8 + rnd() * 16, 9 + rnd() * 10, rnd() * 6);
    }
    // The wall: a low stone ring with a lantern at every pier of it.
    k.use('stone', 0x6a707a, .05);
    const ring = edge + 4.5;
    for (let i = 0; i < 44; i++) {
      const a = i / 44 * Math.PI * 2, x = Math.cos(a) * ring, z = Math.sin(a) * ring;
      k.box(x, at(x, z) - .2, z, 4.4, 1.6, .9, Math.PI / 2 - a);
      if (i % 4 === 0) { k.use('glow', 0x5aa8ff).box(x, at(x, z) + 1.5, z, .4, .4, .4, -a); k.use('stone', 0x6a707a, .05); }
    }
    k.use('plaster', 0xe6ecf4, .04);
    for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, x = Math.cos(a) * ring, z = Math.sin(a) * ring; k.box(x, at(x, z) + 1.4, z, 4.5, .14, 1, Math.PI / 2 - a); }
    // Pagodas beyond it: storeys of dark timber under snowed roofs.
    for (let i = 0; i < 7; i++) {
      const a = (i + .5) / 7 * Math.PI * 2 + rnd() * .3, r = edge + 16 + rnd() * 26, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const storeys = 3 + Math.floor(rnd() * 3), w = 5 + rnd() * 2, g = at(x, z) - .3;
      const tag = piece(x, z, a + Math.PI, w * 1.2, storeys * 3.4 + 2, true, g);
      for (let f = 0; f < storeys; f++) {
        const fw = w * (1 - f * .13), y = g + f * 3.4;
        k.use('wood', 0x2a1812, .08).box(x, y, z, fw * .8, 2.6, fw * .8, a);
        k.use('plaster', 0xdce4ee, .05).gable(x, y + 2.6, z, fw * 1.2, fw * 1.2, .9, a);
      }
      k.use('metal', 0x2a2420).cone(x, g + storeys * 3.4, z, .3, 3.2, 6);
      k.tag(0);
      if (rnd() < .5) fires.push({ x, y: g + 2, z, size: 2.2, smoke: .8, seed: rnd() * 40, from: .95, tag });
    }
    // Dead pines between them, black against the snow.
    k.use('wood', 0x1a1410, .1);
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, r = edge + 7 + rnd() * 34, x = Math.cos(a) * r, z = Math.sin(a) * r, tall = 7 + rnd() * 9, g = at(x, z) - .3;
      k.cylinder(x, g, z, .3, tall, 6, rnd() * 6, (rnd() - .5) * .12, (rnd() - .5) * .12, .25);
      for (let b = 0; b < 3; b++) k.box(x, g + tall * (.45 + b * .15), z, 2.4 - b * .6, .12, .12, rnd() * 6, 0, (rnd() - .5) * .6);
    }
    // Braziers at the shrine's steps: the only warm light up here.
    for (const x of [-7, 7]) fires.push({ x, y: 1.6, z: 17, size: 1.4, smoke: .6, seed: x + 50 });
  } else if (stage === 'rift-grove') {
    // Bamboo walls the forest in, thick past the clearing and taller the
    // further in, paper lanterns hung in it, and great stands that fall.
    const edge = Math.max(halfX, halfZ);
    for (let i = 0; i < 520; i++) {
      const a = rnd() * Math.PI * 2, out = Math.pow(rnd(), 1.6) * 38, r = edge + 1.5 + out, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const tall = 10 + rnd() * 9 + out * .2, g = at(x, z) - .2;
      k.use('wood', rnd() < .5 ? 0x2e3a1c : 0x3a4422, .12).cylinder(x, g, z, .09 + rnd() * .08, tall, 5, rnd() * 6, (rnd() - .5) * .1, (rnd() - .5) * .1, .7);
    }
    // The leaves up in it: ragged clumps, not discs.
    k.use('cloth', 0x3a0a08, .22);
    for (let i = 0; i < 150; i++) {
      const a = rnd() * Math.PI * 2, r = edge + 3 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
      k.rock(x, at(x, z) + 10 + rnd() * 9, z, 1.4 + rnd() * 1.8, .7 + rnd() * .9, 1.4 + rnd() * 1.8, rnd() * 6);
    }
    // Lanterns hung in the stalks, some still lit.
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = edge + 2 + rnd() * 16, x = Math.cos(a) * r, z = Math.sin(a) * r, y = at(x, z) + 3 + rnd() * 3;
      k.use('glow', 0xff3a1a).cylinder(x, y, z, .32, .6, 8, 0, 0, 0, .8);
      if (rnd() < .4) fires.push({ x, y: y + .3, z, size: .5, smoke: .2, seed: rnd() * 90 });
    }
    // Giant stands beyond: they come down as the grove is fought through.
    for (let i = 0; i < 10; i++) {
      const a = (i + rnd() * .6) / 10 * Math.PI * 2, r = edge + 6 + rnd() * 10, x = Math.cos(a) * r, z = Math.sin(a) * r, tall = 16 + rnd() * 8, g = at(x, z) - .2;
      piece(x, z, rnd() * Math.PI * 2, 3, tall, true, g);
      k.use('wood', 0x2a3418, .1);
      for (let j = 0; j < 5; j++) k.cylinder(x + (j - 2) * .45, g, z + ((j * 7) % 3 - 1) * .4, .2, tall - j * .8, 6, j, (j - 2) * .03, 0, .7);
      k.tag(0);
    }
    // The shrine's fires, and the grove's lamps at the clearing's edge.
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2, x = Math.cos(a) * (edge + 1), z = Math.sin(a) * (edge + 1); fires.push({ x, y: at(x, z) + .3, z, size: 1.2, smoke: .5, seed: i * 13, from: i % 2 ? .5 : 0 }); }
  } else if (stage === 'rift-wastes') {
    // Ash to the horizon, and the rest of the god: tusks and ribs of bone
    // breaking the ground, spires of rock, the volcano it fell against.
    const edge = Math.max(halfX, halfZ);
    k.use('bone', 0x9a9282, .1);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, r = edge + 8 + rnd() * 44, x = Math.cos(a) * r, z = Math.sin(a) * r, g = at(x, z) - 1;
      const tall = 8 + rnd() * 18, lean = [(rnd() - .5) * .9, (rnd() - .5) * .9] as const;
      const tag = piece(x, z, rnd() * Math.PI * 2, 2.4, tall, true, g);
      k.cone(x, g, z, 1 + rnd() * 1.4, tall, 7, rnd() * 6, lean[0], lean[1]);
      k.tag(0);
    }
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, r = edge + 10 + rnd() * 46, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const base = 2 + rnd() * 3, tall = 12 + rnd() * 24, g = at(x, z) - .6, yaw = rnd() * 6, lean = [(rnd() - .5) * .3, (rnd() - .5) * .3] as const;
      const tag = piece(x, z, rnd() * Math.PI * 2, base * 1.6, tall, true, g);
      dressed.push({ id: 'rock-spire', tag, far: true, x, y: g, z, yaw, tilt: lean, h: tall, code: s => s.use('dark', 0x1a1614, .1).cone(x, g, z, base, tall, 5, yaw, lean[0], lean[1]) });
      k.tag(0);
    }
    // The volcano, glowing at its lip.
    k.use('dark', 0x16100e, .06).cone(-40, -8, 175, 70, 62, 12);
    k.use('glow', 0xff5a14).cylinder(-40, 50, 175, 9, 3, 12);
    fires.push({ x: -40, y: 54, z: 175, size: 12, smoke: 1, seed: 7 });
    // Fires in the ash: what still burns where the god came down.
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, r = edge + 3 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
      fires.push({ x, y: at(x, z), z, size: 1.8 + rnd() * 2.4, smoke: 1, seed: rnd() * 80, from: i < 6 ? 0 : i < 12 ? .5 : .95 });
    }
  } else if (stage === 'rift-harbor') {
    // The port: warehouses along the shore behind the field, a lighthouse on
    // its rock, and out on the water the ships the rift wrecked, burning.
    k.use('dark', palette.hills, .1);
    for (let i = 0; i < 24; i++) {
      const a = Math.PI + (i / 23 - .5) * Math.PI * 1.1, r = halfZ + 12 + rnd() * 14, x = Math.cos(a) * r * 1.2, z = -Math.abs(Math.sin(a)) * r - 6 + (i % 2) * 5;
      const w = 7 + rnd() * 4, h = 5 + rnd() * 4, g = at(x, z) - .3, tag = piece(x, z, Math.atan2(x, z), w, h * 1.5, false, g);
      dressed.push({ id: ['house-a', 'house-b', 'ruin'][i % 3], tag, far: true, x, y: g, z, yaw: Math.atan2(x, z), w, d: w * .75,
        code: s => s.use('plaster', 0x3a3632, .1).box(x, g, z, w, h, w * .75, Math.atan2(x, z)).use('wood', 0x241c16, .1).gable(x, g + h, z, w + .8, w * .75 + .6, h * .5, Math.atan2(x, z)) });
      k.tag(0);
      if (rnd() < .45) fires.push({ x, y: g + h + .6, z, size: 2.6 + rnd() * 2, smoke: 1, seed: rnd() * 50, from: rnd() < .5 ? .5 : .95, tag });
    }
    // The harbour's light on its rock, off to one side: a tower in bands of ink and
    // paper (scripts/survival/landmarks: a stone cylinder, if its model never comes),
    // its lamp lit.
    const light = { x: 56, z: halfZ + 30 };
    dressed.push({ id: 'lighthouse', tag: 0, far: true, x: light.x, y: -2.4, z: light.z, yaw: -.6, h: 50,
      code: s => s.use('stone', 0x5a5850).cylinder(light.x, -1, light.z, 3.2, 40, 10, 0, 0, 0, .7) });
    k.use('glow', 0xfff2c8).cylinder(light.x, 39.6, light.z, 1.55, 3.3, 8);
    fires.push({ x: light.x, y: 41, z: light.z, size: 3.4, smoke: .3, seed: 4 });
    // What the wave did to the ships in port: their fore halves, thrown up on the
    // shallows and burning, a mast and its rags standing over each.
    const wrecks: readonly [x: number, z: number, yaw: number, pitch: number, roll: number, tall: number][] = [
      [-40, 30, .45, .2, -.3, 38], [26, 46, 2.5, -.16, .34, 42], [-8, 74, 1.15, .3, .12, 48], [74, 70, -2.2, .12, -.4, 40], [-82, 62, .9, -.22, .2, 40]];
    wrecks.forEach(([x, dz, yaw, pitch, roll, tall], i) => {
      const z = halfZ + dz;
      dressed.push({ id: 'wreck', tag: 0, far: true, x, y: -5.5, z, yaw, tilt: [pitch, roll], h: tall, code: s => {
        s.use('wood', 0x241a12, .1).add(HULL, x, -2.2, z, 0, yaw, roll, tall * .45, 4.2, 3.2);
        s.use('wood', 0x1a120c, .08).cylinder(x, -1, z, .35, tall * .6, 7, yaw, pitch, roll, .7);
      } });
      fires.push({ x, y: 2, z, size: 3 + rnd() * 3, smoke: 1, seed: rnd() * 70, from: i < 2 ? 0 : i < 4 ? .5 : .95 });
    });
    // And the wave itself, standing over the harbour where the sea meets the sky:
    // the tide that brought the dead back in (after Hokusai: its crest hooked over in
    // claws of foam). A hundred and forty metres from the field's middle, sixty high.
    dressed.push({ id: 'great-wave', tag: 0, far: true, x: 12, y: -4, z: halfZ + 112, yaw: 0, h: 60, code: () => {} });
  } else {
    // The far ground: spires of black rock, and a tall black tower with iron bands and stays.
    k.use('dark', 0x160a0c, .1);
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, r = Math.max(halfX, halfZ) + 8 + rnd() * 50, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const base = 2 + rnd() * 3, tall = 10 + rnd() * 26, g = at(x, z) - .6;
      const tag = piece(x, z, rnd() * Math.PI * 2, base * 1.6, tall, true, g), yaw = rnd() * 6, lean = [(rnd() - .5) * .3, (rnd() - .5) * .3] as const;
      // A spire of black rock, split with the rift's red (a cone, if its model never comes).
      dressed.push({ id: 'rock-spire', tag, far: true, x, y: g, z, yaw, tilt: lean, h: tall, code: s => s.use('dark', 0x160a0c, .1).cone(x, g, z, base, tall, 5, yaw, lean[0], lean[1]) });
      k.tag(0);
    }
    k.use('dark', 0x2c2024, .03).box(0, 2, 138, 8, 58, 8, Math.PI / 4, 0, 0).cone(0, 60, 138, 5.8, 9, 4, Math.PI / 4, 0, 0);
    k.use('metal', 0x1a1416, .2);
    for (const h of [14, 31, 46]) k.box(0, 2 + h, 138, 9.6, 1.6, 9.6, Math.PI / 4, 0, 0);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) k.box(dx * 13, 0, 138 + dz * 13, .9, 36, .9, Math.atan2(dx, dz), -Math.atan2(13, 30) , 0);
    // Fires on the ground round the field.
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, r = Math.max(halfX, halfZ) + 3 + rnd() * 26;
      fires.push({ x: Math.cos(a) * r, y: at(Math.cos(a) * r, Math.sin(a) * r), z: Math.sin(a) * r, size: 2 + rnd() * 2.5, smoke: 1, seed: rnd() * 80, from: i < 8 ? .5 : .95 });
    }
  }
}
