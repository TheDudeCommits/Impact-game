import {siegeAttackTime,siegePhase} from './horde/siegeMotion';
import {applyThreatInk,threatInk} from './ThreatOutline';
import {specialistMove} from '../game/objectives/specialistMoves';
import * as THREE from 'three';
import { uploadInstances } from './horde/instanceUploads';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { shareSkeletons } from './sharedSkeletons';
import { releaseTextures } from './sharedTextures';
import { nearestLens, secondFrustum } from './lenses';
import { applyInkShell, applyToonShading, headWeights } from './look/toonShading';
import { addShaderPatch, replaceOnce } from './look/shaderPatch';
import { FOCUS } from './horde/GruntRenderer';
import { ENEMIES, type EnemyDefinition, type EnemyMove } from '../survival/enemies';
import { isProc } from '../survival/SurvivalGame';
import type { CombatEvent, PlayerState } from '../game/types';
import { resolveSkeleton } from './skeleton';
import { MotionLibrary, type MotionClips } from './horde/motion';
import { CrowdGroup, HiddenPoseClock, jointInAncestor } from './horde/poseBudget';
import { distantGeometry, useDistantMesh } from './horde/meshDetail';
import { bodyTextures, bodyTexturePlugin } from './horde/bodyTextures';
import { INK_ON, INK_PARS, INK_SHIFT_PARS, inkUniforms } from './rift/ink';
import { bossStance } from '../originals/bossStanceSize';

/** The horde's motion library, for a boss rigged to Meshy's skeleton that
 *  carries no clips of its own (enemies.ts `motion: 'humanoid'`), and the
 *  clips only such a boss plays (a bow drawn, a leap brought down, a guard) -
 *  read, not baked: the boss plays them on its own rig. */
let humanoid: Promise<MotionClips[]> | undefined;
const humanoidLibraries = () => humanoid ??= Promise.all([MotionLibrary.clips(), MotionLibrary.clips('/assets/survival/motion/humanoid-boss')]);
/** The library's clips on a rig of the same skeleton: rotations by bone name,
 *  the hips' travel scaled from the library's hip offset to this rig's (as
 *  MotionLibrary.retarget does for a generated grunt). */
function humanoidClips(library: MotionClips, root: THREE.Object3D) {
  const hips = root.getObjectByName('Hips');
  const ratio = (hips ? hips.position.length() : library.hipsRest) / Math.max(1e-6, library.hipsRest);
  return library.animations.filter(clip => !clip.name.includes('|')).map(clip => new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.map(track => {
    if (!track.name.startsWith('Hips.') || !track.name.endsWith('.position')) return track;
    return new THREE.VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(track.values, v => v * ratio));
  })));
}

const JOINT_PATTERNS: Record<string, RegExp> = {
  Hips: /(^|_)(body_)?pelvis|bip0*1[ _]pelvis|(^|:)hips?(_|$)/i,
  Head: /head_face|bip0*1[ _]head$|(^|:|_)head(_\d+)?$/i,
  LeftFoot: /^lfoot_heel|bip0*1[ _]l[ _]foot|left_?foot|^l_ankle|^foot\.l_/i,
  RightFoot: /^rfoot_heel|bip0*1[ _]r[ _]foot|right_?foot|^r_ankle|^foot\.r_/i,
  LeftToeBase: /^lfoot_toe|bip0*1[ _]l[ _]toe|left_?toe/i,
  RightToeBase: /^rfoot_toe|bip0*1[ _]r[ _]toe|right_?toe/i,
};
function jointsOf(model: THREE.Object3D) {
  const bones: THREE.Bone[] = [];
  model.traverse(node => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
  const joints = new Map<string, THREE.Bone>();
  const resolved = resolveSkeleton(bones.map(b => b.name));
  for (const [canonical, actual] of resolved) { const bone = bones.find(b => b.name === actual); if (bone) joints.set(canonical, bone); }
  for (const [canonical, pattern] of Object.entries(JOINT_PATTERNS)) {
    if (joints.has(canonical)) continue;
    const bone = bones.find(b => pattern.test(b.name));
    if (bone) joints.set(canonical, bone);
  }
  return joints;
}

/** Arcade survival's enemies, drawn.
 *
 *  A fighter is the most expensive thing in the game to draw - springs on the
 *  cloth, feet planted, a head that tracks, a pose blended through every seam
 *  - and a horde is thirty of them. An enemy is drawn lean: its own clips on
 *  one mixer, cross-faded, the same cel light and ink line as the roster so
 *  it stands in the same world, a flash and a shudder when it is hit, and an
 *  ink dissolve for coming out of a rift and for going back into one. Every
 *  body is one skinned mesh and its hull, sharing the programs of its kind.
 */

/** The same four-band ramp the fighters are shaded with. */
const RAMP = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([110, 155, 203, 255]), 4, 1, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  return texture;
})();
const INK_DEPTH_BIAS = .035;
const REACTIONS = new Set(['flinch', 'hurt', 'splat']);
const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate']);

/** Per-body shader state: hit flash, the rift dissolve, a rank's tint, and
 *  the mark a standing boss wears (black: none). */
interface BodyUniforms { uEnemyFlash: { value: number }; uEnemyDissolve: { value: number }; uEnemyInked: { value: number }; uEnemyTint: { value: THREE.Color }; uEnemyEdge: { value: THREE.Color }; uFocusView: { value: THREE.Vector3 }; uEnemyMark: { value: THREE.Color }; uEnemyScreen: { value: number }; uEnemyCover: { value: number }; uEnemyNear: { value: THREE.Vector2 } }

/** The bosses standing now, by actor id, and the colour of their rank - set
 *  by the arcade every frame (SurvivalFx). A marked body wears its rank as a
 *  rim all round and stands on a sigil of it: in a crowd of a hundred, through
 *  its own ghost, from across the field, the boss is the boss. */
export const MARKS = new Map<string, number>();
/** What a boss's fight does to its body, by actor id - set from the run's
 *  feed (EnemyTechniques): its awakened form (a tint over its colours, a
 *  size and its aura's rim, from `at`), held at the brink of death (FINISH
 *  IT, until when), a roar while it casts, reeling from a broken charge, an
 *  iron body. */
export interface BodyFx { awakened?: { tint: number; scale: number; rim: number; at: number }; brink?: number; taunt?: number; stun?: number; iron?: number }
export const BODY_FX = new Map<string, BodyFx>();
/** The arcade's bodies standing this frame (for effects that follow a boss
 *  only while it lives: its homies, its pressure). */
export const LIVING = new Set<string>();
/** Set by the arcade once it has the renderer: sends a texture to the GPU.
 *  A boss's model loads a round ahead of it, and its textures go up then -
 *  compiling its programs ahead left the uploads for the frame it arrived on. */
export const UPLOAD: { texture?: (texture: THREE.Texture) => void } = {};

/** The body a camera is shown. The game's camera sizes its shots by the
 *  subject's bulk, which it knows only for the roster (a few awakened forms
 *  are bigger): a four-metre boss was framed like a fighter, its entrance
 *  orbit passing inside it ("a headless torso", "a faceless mass"). A tall
 *  boss is presented as the roster's biggest form, so the orbit and the
 *  lock-on frame it from further out. So is a wide one: Gorm the Glutted is not tall,
 *  but his entrance orbit went through his flank ("a blurred brown mass"). */
const present = (def: EnemyDefinition, state: PlayerState): PlayerState =>
  def.height >= 3 || (def.size ?? 1) >= 1.6 || (def.girth ?? 1) >= 1.4 ? { ...state, fighter: 'konta', awakened: true } as PlayerState : state;
const def0 = (body: { def: EnemyDefinition }) => body.def;
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const DISSOLVE_VERTEX = (s: string) => replaceOnce(s, '#include <begin_vertex>', '#include <begin_vertex>\n\tvEnemyLocal = position;', 'enemy local position');
// The body and outline already disappear when this cutaway reaches one.
// Reject them before skinning; shadow materials and boss entrances keep
// their original path. These uniforms are shared with the fragment stage.
const CULL_PARS = 'uniform float uEnemyCover;\nuniform float uEnemyScreen;\n';
const CULL_MAIN = `void main() {
  if ( uEnemyCover >= 1.0 && uEnemyScreen >= 1.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; } // cutaway-cull
`;
const ENEMY_PARS = `uniform float uEnemyFlash;
uniform vec3 uEnemyMark;
uniform float uEnemyScreen;
uniform float uEnemyCover;
uniform vec2 uEnemyNear;
uniform float uEnemyDissolve;
uniform float uEnemyInked;
uniform vec3 uEnemyTint;
uniform vec3 uEnemyEdge;
uniform vec3 uFocusView;
varying vec3 vEnemyLocal;
float enemyHash( vec3 p ) { p = fract( p * .3183099 + .1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float enemyNoise3( vec3 x ) {
	vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( enemyHash( i ), enemyHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( enemyHash( i + vec3( 0, 1, 0 ) ), enemyHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( enemyHash( i + vec3( 0, 0, 1 ) ), enemyHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( enemyHash( i + vec3( 0, 1, 1 ) ), enemyHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
`;
const DISSOLVE_FRAGMENT = `
	// BEGIN_CROWD_COVERAGE
	// A body in the lens or between it and the fighter is screened out (a
	// giant's legs used to fill the frame): near the camera entirely, and along
	// the line of sight a tube as wide as a fighter. The band where it is
	// thinned is narrow: a metre of it wrapped a boss near the lens in a fog
	// of dots.
	float enemyNear = smoothstep( uEnemyNear.x, uEnemyNear.y, length( vViewPosition ) );
	vec3 enemyP = -vViewPosition;
	float enemyT = clamp( dot( enemyP, uFocusView ) / max( dot( uFocusView, uFocusView ), 1e-3 ), 0.0, 1.0 );
	float enemyLine = length( enemyP - uFocusView * enemyT );
	float enemyHide = ( 1.0 - smoothstep( .9, 1.15, enemyLine ) ) * ( 1.0 - smoothstep( .82, .9, enemyT ) ) * step( .01, dot( uFocusView, uFocusView ) );
	// Cleanly gone where it covers the fighter, not thinned to a dot pattern -
	// and a brute or an elite that covers them goes whole (EnemyHorde.cover).
	enemyNear = min( enemyNear, 1.0 - max( enemyHide, uEnemyCover ) );
	// Not while a boss makes its entrance: the lens circles it close, and it
	// was screened to a ghost through its own arrival.
	enemyNear = mix( 1.0, enemyNear, uEnemyScreen );
	if ( enemyNear < 1.0 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( .06711056, .00583715 ) ) ) ) > enemyNear ) discard;
	// Smooth noise, so it comes and goes through the rift along ragged edges, not in cubes.
	float enemyBurn = 0.0;
	if ( uEnemyDissolve > .001 ) {
		float enemyNoise = enemyNoise3( vEnemyLocal * 5.0 ) * .6 + enemyNoise3( vEnemyLocal * 13.0 + 3.1 ) * .4;
		if ( enemyNoise < uEnemyDissolve ) discard;
		enemyBurn = 1.0 - smoothstep( 0.0, .06, enemyNoise - uEnemyDissolve );
	}
	// END_CROWD_COVERAGE
`;

/** Arriving on the page, a body is drawn before it is coloured (the overhaul's
 *  boss entrance: "colour comes into the boss"): ink, screentone and paper as
 *  the horde is (rift/ink.ts), its own colours rising through it from the foot
 *  of the frame along a ragged front, a line of bare paper at the front's
 *  edge. uEnemyInked: 1 all drawn - 0 all itself. */
const ARRIVAL_INK = `
	if ( uEnemyInked > .001 ) {
		float inkRise = gl_FragCoord.y / ( uInkHalf * 2.0 );
		float inkGrain = enemyNoise3( vEnemyLocal * 5.0 ) * .6 + enemyNoise3( vEnemyLocal * 13.0 + 3.1 ) * .4;
		float inkAt = inkRise * .8 + inkGrain * .2;
		float inkFront = ( 1.0 - uEnemyInked ) * 1.14 - .07;
		float inkDrawn = smoothstep( inkFront - .01, inkFront + .01, inkAt );
		vec3 inkBody = inkPage( inkTone( .2 + .62 * toonLit, diffuseColor.rgb, .8 ), diffuseColor.rgb, 0.0, 0.0 );
		outgoingLight = mix( outgoingLight, inkBody, inkDrawn );
		outgoingLight = mix( outgoingLight, inkPaper() * 1.25, ( 1.0 - smoothstep( 0.0, .022, abs( inkAt - inkFront ) ) ) * .9 );
	}`;
function patchBody(material: THREE.MeshToonMaterial, uniforms: BodyUniforms) {
  addShaderPatch(material, INK_ON ? 'enemy-body-v11-ink' : 'enemy-body-v11', shader => {
    Object.assign(shader.uniforms, uniforms);
    if (INK_ON) Object.assign(shader.uniforms, inkUniforms);
    shader.vertexShader = (INK_ON ? INK_SHIFT_PARS : '') + CULL_PARS + 'varying vec3 vEnemyLocal;\n' + DISSOLVE_VERTEX(shader.vertexShader);
    shader.vertexShader = replaceOnce(shader.vertexShader, 'void main() {', CULL_MAIN, 'enemy cutaway cull');
    if (INK_ON) shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', '#include <project_vertex>\n\tvInkShift = inkShift();', 'enemy ink shift');
    shader.fragmentShader = (INK_ON ? INK_PARS + 'uniform float uInkHalf;\n' : '') + ENEMY_PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= uEnemyTint;', 'enemy tint');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', `${DISSOLVE_FRAGMENT}
${INK_ON ? ARRIVAL_INK : ''}
	// A boss wears its rank: a rim of its colour all round the silhouette.
	{
		float enemyNdV = clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );
		outgoingLight += uEnemyMark * ( 1.0 - smoothstep( .06, .46, enemyNdV ) ) * 1.3;
	}
	// Struck: lit up, but still itself - brighter and warmer, never a flat white cutout.
	outgoingLight = mix( outgoingLight, outgoingLight * 1.7 + vec3( .3, .27, .24 ), uEnemyFlash );
	outgoingLight = mix( outgoingLight, uEnemyEdge * 3.0, enemyBurn * step( .001, uEnemyDissolve ) );
#include <opaque_fragment>`, 'enemy flash and dissolve');
  });
}
function patchInk(material: THREE.MeshToonMaterial, uniforms: BodyUniforms) {
  addShaderPatch(material, 'enemy-ink-v8', shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = CULL_PARS + 'varying vec3 vEnemyLocal;\n' + DISSOLVE_VERTEX(shader.vertexShader);
    shader.vertexShader = replaceOnce(shader.vertexShader, 'void main() {', CULL_MAIN, 'enemy ink cutaway cull');
    shader.fragmentShader = ENEMY_PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', `${DISSOLVE_FRAGMENT}
	outgoingLight = mix( outgoingLight, uEnemyEdge * 2.4, enemyBurn * step( .001, uEnemyDissolve ) );
#include <opaque_fragment>`, 'enemy ink dissolve');
  });
}

interface Template { gltf: GLTF; height: number; centre: THREE.Vector3; clips: THREE.AnimationClip[]; distant: Map<THREE.BufferGeometry, THREE.BufferGeometry> }

const clipLookups = new WeakMap<readonly THREE.AnimationClip[], Map<readonly string[], THREE.AnimationClip | undefined>>();
function findClip(clips: readonly THREE.AnimationClip[], patterns: readonly string[] | undefined) {
  if (!patterns) return undefined;
  let cache = clipLookups.get(clips);
  if (!cache) { cache = new Map(); clipLookups.set(clips, cache); }
  if (cache.has(patterns)) return cache.get(patterns);
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    const hit = clips.find(c => c.name.toLowerCase().endsWith(p)) ?? clips.find(c => c.name.toLowerCase().includes(p));
    if (hit) { cache.set(patterns, hit); return hit; }
  }
  cache.set(patterns, undefined);
  return undefined;
}

const shadowGeometry = new THREE.CircleGeometry(.62, 24);
let shadowMaterial: THREE.MeshBasicMaterial | undefined;
function contactShadow() {
  if (shadowMaterial) return shadowMaterial;
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2, t = Math.max(0, Math.min(1, 1 - d));
    const v = Math.round(255 * t * t * (3 - 2 * t)), i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  const falloff = new THREE.DataTexture(data, size, size); falloff.needsUpdate = true;
  shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x172a32, transparent: true, opacity: .34, depthWrite: false, alphaMap: falloff });
  return shadowMaterial;
}

const _box = new THREE.Box3(), _v = new THREE.Vector3(), _sphere = new THREE.Sphere(), _frustum = new THREE.Frustum(), _matrix = new THREE.Matrix4(), _c = new THREE.Color(), _c2 = new THREE.Color();

const FACE = { normal: /face_normal|normal_face/i, attack: /face_attack|attack_face/i, damage: /face_damage|damage_face/i };
const VARIANT = /face_(attack|damage|sp\d*)|(attack|damage)_face|hand_(open|par|shigan|shugan|hundredLights|yubisashi|hold|sp_?\d+)|_sp\d*_fist|magma|light_(leg|shoes)|wing_open|_ele_|hair_sp|open_watch|tail_hair/i;
type Face = keyof typeof FACE;

class EnemyBody {
  readonly threatInk=threatInk();
  readonly group = new CrowdGroup();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly uniforms: BodyUniforms;
  private actions = new Map<THREE.AnimationClip, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  private currentKey = '';
  /** The clip playing, and how far in (for arenaEvidence.enemies). */
  get playing() { return this.current ? { clip: this.current.getClip().name, time: +this.current.time.toFixed(2) } : undefined; }
  private startedFor = -1;
  private previous = new THREE.Vector3();
  private speed = 0;
  private flash = 0;
  private scale = 1;
  private readonly materials: THREE.Material[] = [];
  readonly hips?: THREE.Object3D;
  /** Canonical joints, for the lock-on camera's framing. */
  readonly joints: Map<string, THREE.Bone>;
  born: number;
  diedAt = -1;
  state: PlayerState;
  /** The rank colour it is marked with (0: none). */
  markHex = 0;
  private shadow: THREE.Mesh;
  /** Swappable parts, by what they are. */
  private faces: Partial<Record<Face, THREE.Object3D[]>> = {};
  private variants: THREE.Object3D[] = [];
  /** Everything else: the parts a move may hide (EnemyMove.conceal). */
  private plain: THREE.Object3D[] = [];
  private face: Face = 'normal';
  private shown?: RegExp;
  private concealed?: RegExp;
  /** Where the hips stand in the body's own frame at rest, and the model's
   *  base offset: the clamp that keeps a clip's travel from carrying the
   *  drawn body away from where the simulation holds it. */
  private hipsRest = new THREE.Vector3();
  private base = new THREE.Vector3();
  /** The same two at the body's own size, and the size an awakening has grown it to. */
  private hipsRestBase = new THREE.Vector3();
  private baseRest = new THREE.Vector3();
  private grown = 1;
  private readonly tint = new THREE.Color();
  private readonly poseClock = new HiddenPoseClock();
  private feet: THREE.Object3D[] = [];
  private footRest = 0;
  private distant = false;
  private readonly levels: { mesh: THREE.Mesh; hull: THREE.Mesh; near: THREE.BufferGeometry; far: THREE.BufferGeometry }[] = [];

  constructor(readonly def: EnemyDefinition, template: Template, state: PlayerState, now: number) {
    this.state = present(def0(this), state); this.born = now;
    this.model = cloneSkinned(template.gltf.scene); shareSkeletons(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.uniforms = { uEnemyFlash: { value: 0 }, uEnemyDissolve: { value: 1 }, uEnemyInked: { value: 0 }, uEnemyTint: { value: new THREE.Color(def.tint ?? 0xffffff) }, uEnemyEdge: { value: new THREE.Color(0x9a4dff) }, uFocusView: FOCUS, uEnemyMark: { value: new THREE.Color(0, 0, 0) }, uEnemyScreen: { value: 1 }, uEnemyCover: { value: 0 },
      // A giant's parts go from further out: Kurobi's tails swept the lens as slabs.
      uEnemyNear: { value: new THREE.Vector2(2.8, 3.4).multiplyScalar(Math.min(1.8, Math.max(1, (def.girth ?? 1) / 1.2, def.height / 3.2))) } };
    // Collected first: each mesh gets an ink hull as a child, and a traverse
    // that is still walking would walk into the hull and dress it too.
    const meshes: THREE.Mesh[] = [];
    this.model.traverse(node => { if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh); });
    for (const mesh of meshes) {
      const name = `${mesh.userData.part ?? ''} ${mesh.name}`;
      for (const face of Object.keys(FACE) as Face[]) if (FACE[face].test(name)) (this.faces[face] ??= []).push(mesh);
      if (VARIANT.test(name) || (def.hide && def.hide.test(name))) { this.variants.push(mesh); mesh.visible = false; }
      else if (!FACE.normal.test(name)) this.plain.push(mesh);
      mesh.frustumCulled = false; mesh.castShadow = def.role === 'boss' || def.role === 'elite' || def.role === 'brute'; mesh.receiveShadow = true;
      const source = mesh.material as THREE.MeshStandardMaterial;
      const skinned = mesh as THREE.SkinnedMesh;
      if (!mesh.geometry.hasAttribute('lookHead')) mesh.geometry.setAttribute('lookHead', headWeights(mesh.geometry, skinned.isSkinnedMesh ? skinned.skeleton : undefined, undefined));
      const toon = new THREE.MeshToonMaterial({ map: source.map ?? null, color: source.color ?? new THREE.Color(1, 1, 1), gradientMap: RAMP, side: source.side,
        alphaTest: source.alphaTest || (source.transparent ? .5 : 0), transparent: false,
        vertexColors: !!source.vertexColors && mesh.geometry.hasAttribute('color') });
      toon.name = source.name;
      applyToonShading(toon, /hair/i.test(`${mesh.name} ${source.name}`) ? 'hair' : 'body');
      patchBody(toon, this.uniforms);
      mesh.material = toon; this.materials.push(toon);
      // The ink hull: the same constant-width line the roster wears.
      const ink = new THREE.MeshToonMaterial({ color: 0x081621, side: THREE.BackSide, depthWrite: false });
      ink.userData.ink = true;
      applyInkShell(ink, 1, INK_DEPTH_BIAS);
      patchInk(ink, this.uniforms);
      applyThreatInk(ink, this.threatInk);
      let shell: THREE.Mesh;
      if (skinned.isSkinnedMesh) { const hull = new THREE.SkinnedMesh(mesh.geometry, ink); hull.bind(skinned.skeleton, skinned.bindMatrix); hull.bindMode = skinned.bindMode; shell = hull; }
      else shell = new THREE.Mesh(mesh.geometry, ink);
      shell.name = mesh.name + '-ink'; shell.frustumCulled = false; shell.matrixAutoUpdate = false; shell.matrix.identity(); shell.castShadow = false;
      mesh.add(shell); this.materials.push(ink);
      const far = template.distant.get(mesh.geometry);
      if (far && !far.hasAttribute('lookHead')) far.setAttribute('lookHead', mesh.geometry.getAttribute('lookHead').clone());
      if (far && def.role !== 'boss' && def.role !== 'elite') this.levels.push({ mesh, hull: shell, near: mesh.geometry, far });
    }
    // Normalised to its definition's height, feet on the floor, centred.
    this.scale = def.height / template.height;
    this.model.scale.multiplyScalar(this.scale);
    this.model.position.set(-template.centre.x * this.scale, -template.centre.y * this.scale, -template.centre.z * this.scale);
    this.model.rotation.y = def.yaw ?? 0;
    this.base.copy(this.model.position); this.baseRest.copy(this.base);
    this.group.add(this.model);
    this.shadow = new THREE.Mesh(shadowGeometry, contactShadow());
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = .015; this.shadow.scale.setScalar(Math.max(.8, def.size ?? 1) * 1.1);
    this.group.add(this.shadow);
    this.group.name = `enemy-${state.id}`;
    this.joints = jointsOf(this.model);
    (this as { hips?: THREE.Object3D }).hips = this.joints.get('Hips') ?? this.hips;
    this.show('normal');
    this.group.position.set(state.x, state.y, state.z);
    this.previous.set(state.x, state.y, state.z);
    this.idle(template);
    if (this.hips) { this.group.updateMatrixWorld(true); this.hips.getWorldPosition(this.hipsRest); this.group.worldToLocal(this.hipsRest); this.hipsRestBase.copy(this.hipsRest); }
    // Only these mode-owned soldiers receive gait support correction. Keep
    // bosses' authored jumps and Arcade's existing body presentation intact.
    if (def.id.startsWith('siege-')) {
      this.feet = ['LeftFoot', 'RightFoot'].flatMap(name => this.joints.get(name) ?? []);
      if (this.feet.length === 2) this.footRest = Math.min(...this.feet.map(foot => jointInAncestor(foot, this.group, new THREE.Vector3()).y));
      else this.feet.length = 0;
    }
  }

  detail(camera: THREE.Camera | undefined) {
    if (!this.levels.length) return;
    const distant = !!camera && !this.markHex && useDistantMesh(nearestLens(camera, this.group.position), this.def.height, this.distant);
    if (distant === this.distant) return;
    this.distant = distant;
    for (const level of this.levels) level.mesh.geometry = level.hull.geometry = distant ? level.far : level.near;
  }

  /** What the fight has done to the body this frame (BODY_FX): grown and
   *  tinted by an awakening, marked by it, pulsing at the brink, iron-grey. */
  private dress(fx: BodyFx | undefined, now: number, mark: number) {
    const awake = fx?.awakened && now >= fx.awakened.at ? fx.awakened : undefined;
    const grow = awake ? 1 + (awake.scale - 1) * Math.min(1, (now - awake.at) / .35) : 1;
    if (Math.abs(grow - this.grown) > 1e-3) {
      this.grown = grow;
      this.model.scale.setScalar(this.scale * grow);
      this.base.copy(this.baseRest).multiplyScalar(grow);
      this.hipsRest.copy(this.hipsRestBase).multiplyScalar(grow);
      if (!this.hips) this.model.position.copy(this.base);
    }
    this.tint.setHex(this.def.tint ?? 0xffffff);
    if (awake) this.tint.lerp(_c2.copy(this.tint).multiply(_c.setHex(awake.tint)), Math.min(1, (now - awake.at) / .35));
    const iron = fx?.iron !== undefined && now < fx.iron;
    if (iron) this.tint.lerp(_c.setHex(0x8e98a6), .75);
    this.uniforms.uEnemyTint.value.copy(this.tint);
    const brink = fx?.brink !== undefined && now < fx.brink;
    const rim = brink ? _c.setHex(0xff1e2e).multiplyScalar(.55 + .45 * Math.sin(now * 14)) : iron ? _c.setHex(0xdfe8ff) : awake ? _c.setHex(awake.rim) : _c.setHex(mark);
    this.uniforms.uEnemyMark.value.copy(rim);
    this.markHex = brink ? 0xff1e2e : awake ? awake.rim : mark;
  }

  private idle(template: Template) {
    const clip = findClip(template.clips, this.def.clips.idle) ?? template.clips[0];
    if (clip) this.play(clip, 'idle', { loop: true, fade: 0 });
    this.mixer.update(0);
  }

  private action(clip: THREE.AnimationClip) {
    let action = this.actions.get(clip);
    if (!action) { action = this.mixer.clipAction(clip); this.actions.set(clip, action); }
    return action;
  }

  /** Switch to `clip` under `key` (a new key restarts it; the same one leaves
   *  it running), cross-faded from whatever was playing. */
  private play(clip: THREE.AnimationClip, key: string, { loop = false, fade = .12, speed = 1 } = {}) {
    if (key === this.currentKey && this.current) { this.current.timeScale = speed; return this.current; }
    const next = this.action(clip);
    next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.timeScale = speed;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); next.clampWhenFinished = !loop;
    if(loop&&this.state.id.startsWith('siege-')&&this.def.role!=='boss')next.time=siegePhase(this.state.id)*clip.duration;
    next.play();
    if (this.current && this.current !== next && fade > 0) next.crossFadeFrom(this.current, fade, false);
    else if (this.current && this.current !== next) this.current.stop();
    this.current = next; this.currentKey = key;
    return next;
  }

  /** A flash, unless the last one is still bright: a string of blows reads as pulses, not a white-out. */
  hit() { if (this.flash < .35) this.flash = 1; }
  /** Held in a roar or a rally until `until`: plays the taunt clip. */
  private tauntUntil = -1;
  taunt(now: number, seconds: number) { this.tauntUntil = now + seconds; }

  /** One face at a time, and a move's own parts while it plays. */
  private show(face: Face, parts?: RegExp, conceal?: RegExp) {
    if (face !== this.face || !this.faces.normal) {
      const want = this.faces[face]?.length ? face : 'normal';
      for (const key of Object.keys(this.faces) as Face[]) for (const mesh of this.faces[key]!) mesh.visible = key === want;
      this.face = face;
    }
    if (parts !== this.shown) {
      this.shown = parts;
      for (const mesh of this.variants) {
        const name = `${mesh.userData.part ?? ''} ${mesh.name}`;
        if (FACE.attack.test(name) || FACE.damage.test(name) || FACE.normal.test(name)) continue;
        mesh.visible = !!parts && parts.test(name);
      }
    }
    if (conceal !== this.concealed) {
      this.concealed = conceal;
      for (const mesh of this.plain) mesh.visible = !conceal || !conceal.test(`${mesh.userData.part ?? ''} ${mesh.name}`);
    }
  }

  /** Keep the drawn hips over the body's position: a clip's own travel -
   *  a lunge, a dash - would otherwise carry the drawn body off and snap it
   *  back when the clip ends, while the simulation moves the body itself. */
  private clampRoot() {
    if (!this.hips) return;
    this.model.position.copy(this.base);
    jointInAncestor(this.hips, this.group, _v);
    this.model.position.x += this.hipsRest.x - _v.x;
    this.model.position.z += this.hipsRest.z - _v.z;
  }

  moveOf(state: PlayerState): EnemyMove | undefined {
    if(state.move==='Mending seal'||state.move==='Breach charge')return specialistMove(this.def,state.move==='Mending seal');
    return this.def.moves.find(move => move.name === state.move) ?? this.def.moves.find(move => move.slot === state.action);
  }

  update(dt: number, state: PlayerState, now: number, template: Template) {
    const mark = state.alive ? MARKS.get(state.id) ?? 0 : 0;
    const fx = state.alive ? BODY_FX.get(state.id) : undefined;
    if (fx || this.grown !== 1) this.dress(fx, now, mark);
    else if (mark !== this.markHex) { this.markHex = mark; this.uniforms.uEnemyMark.value.setHex(mark); this.uniforms.uEnemyTint.value.setHex(this.def.tint ?? 0xffffff); }
    if (fx?.taunt !== undefined && now < fx.taunt && now >= this.tauntUntil) this.taunt(now, fx.taunt - now);
    const reeling = fx !== undefined && ((fx.brink !== undefined && now < fx.brink) || (fx.stun !== undefined && now < fx.stun));
    // A boss's first three seconds are its entrance: seen whole, however close the lens goes round it.
    // (A boss by its role or by the arcade's mark: an elite can lead a round.)
    this.uniforms.uEnemyScreen.value = this.def.role === 'boss' || mark ? Math.min(1, Math.max(0, (now - this.born - 3) / .6)) : 1;
    const moved = _v.set(state.x, state.y, state.z).distanceTo(this.previous);
    if (dt > 0) this.speed += (Math.min(12, moved / dt) - this.speed) * Math.min(1, dt * 10);
    this.previous.set(state.x, state.y, state.z);
    this.state = present(def0(this), state);
    this.group.position.set(state.x, state.y, state.z);
    // Turned toward where it is facing, a little behind it so a pivot eases.
    const yaw = this.group.rotation.y, want = state.yaw;
    const delta = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
    this.group.rotation.y = yaw + delta * Math.min(1, dt * (ATTACKS.has(state.action) ? 30 : 14));
    const clips = this.def.clips, elapsed = Math.max(0, now - state.actionStarted - (state.actionFrozen ?? 0));
    const key = `${state.action}:${state.actionStarted.toFixed(3)}`;
    const frozen = !!state.hitstop || !!state.timeStopped;
    const move = ATTACKS.has(state.action) ? this.moveOf(state) : undefined;
    this.show(!state.alive || REACTIONS.has(state.action) || state.action === 'launched' || state.action === 'stun' || state.action === 'knockdown' ? 'damage' : move ? 'attack' : 'normal', move?.show, move?.conceal);
    const intro = this.def.role === 'boss' && now - this.born < 2.6 && state.alive && !ATTACKS.has(state.action) && !REACTIONS.has(state.action);
    if (!state.alive || state.action === 'defeated') {
      if (this.diedAt < 0) this.diedAt = now;
      const clip = findClip(template.clips, clips.death) ?? findClip(template.clips, clips.down);
      if (clip) this.play(clip, 'defeated', { fade: .08 });
    } else if (reeling && !ATTACKS.has(state.action) && findClip(template.clips, clips.stun ?? clips.hit)) {
      // On its knees at the brink, or reeling from a broken charge.
      this.play(findClip(template.clips, clips.stun ?? clips.hit)!, 'reeling', { loop: true, fade: .12 });
    } else if (intro && findClip(template.clips, clips.intro)) {
      this.play(findClip(template.clips, clips.intro)!, 'intro', { fade: .05 });
    } else if (now < this.tauntUntil && !ATTACKS.has(state.action) && !REACTIONS.has(state.action) && findClip(template.clips, clips.taunt)) {
      this.play(findClip(template.clips, clips.taunt)!, 'taunt', { fade: .1 });
    } else if (ATTACKS.has(state.action) && move?.chain && this.chained(move, template).length) {
      // A move the source cut into parts: each part in turn, in proportion.
      const parts = this.chained(move, template);
      const total = parts.reduce((sum, part) => sum + part.duration, 0);
      let at = Math.min(total - 1e-3, elapsed / Math.max(.05, move.duration) * total), index = 0;
      while (index < parts.length - 1 && at >= parts[index].duration) { at -= parts[index].duration; index++; }
      const action = this.play(parts[index], `${key}:${index}`, { fade: index ? .04 : .08 });
      action.time = Math.min(parts[index].duration - 1e-3, at);
      action.timeScale = 0;
    } else if (ATTACKS.has(state.action)) {
      const clip = move ? findClip(template.clips, move.clip) : undefined;
      if (clip) {
        const action = this.play(clip, key, { fade: .08 });
        // Scrubbed on the move's own clock: the blow lands on the clip's
        // contact frame because the move's contact was measured off it.
        const length = move!.clipSeconds ?? clip.duration;
        const time=this.def.id.startsWith('siege-')?siegeAttackTime(clip.name,elapsed,move!.duration,move!.contacts[0],length):elapsed/Math.max(.05,move!.duration)*length;
        action.time = Math.min(clip.duration - 1e-3,time);
        action.timeScale = 0;
      }
    } else if (REACTIONS.has(state.action)) {
      const clip = findClip(template.clips, clips.hit);
      if (clip) { const action = this.play(clip, key, { fade: .05 }); action.timeScale = frozen ? 0 : clip.duration / Math.max(.2, state.actionDuration * 1.35); }
    } else if (state.action === 'launched') {
      const high = state.y > .25 || !state.grounded;
      const clip = high ? findClip(template.clips, clips.blown ?? clips.hit) : findClip(template.clips, clips.land ?? clips.down);
      if (clip) this.play(clip, high ? 'launched' : 'landed', { loop: high, fade: .1 });
    } else if (state.action === 'knockdown') {
      const clip = findClip(template.clips, clips.land ?? clips.down) ?? findClip(template.clips, clips.down);
      if (clip) this.play(clip, this.currentKey === 'landed' ? 'landed' : 'knockdown', { fade: .1 });
    } else if (state.action === 'getup') {
      const clip = findClip(template.clips, clips.getup);
      if (clip) { const action = this.play(clip, key, { fade: .1 }); action.time = Math.min(clip.duration - 1e-3, clip.duration * .45 + elapsed / Math.max(.1, state.actionDuration) * clip.duration * .55); action.timeScale = 0; }
    } else if (state.action === 'stun') {
      const clip = findClip(template.clips, clips.stun ?? clips.hit);
      if (clip) this.play(clip, 'stun', { loop: true, fade: .12 });
    } else if (state.action === 'dash') {
      const clip = findClip(template.clips, clips.dash);
      if (clip) this.play(clip, key, { fade: .08, speed: 1.4 });
    } else if (state.action === 'jump') {
      const clip = findClip(template.clips, clips.fall ?? clips.jump);
      if (clip) this.play(clip, 'jump', { loop: true, fade: .12 });
    } else if (this.speed > .6 && state.action === 'run') {
      const clip = findClip(template.clips, this.speed < 2.6 ? clips.walk ?? clips.run : clips.run);
      // The stride keeps pace with the ground covered.
      if (clip) this.play(clip, 'run', { loop: true, fade: .15, speed: Math.max(.6, Math.min(1.8, this.speed / ((this.def.runSpeed ?? 5.2) * this.scale / (this.def.height / 1.72)))) });
    } else {
      const clip = findClip(template.clips, clips.idle);
      if (clip) this.play(clip, 'idle', { loop: true, fade: .2 });
    }
    // Held in an impact freeze: the clip stops and the body shudders.
    this.mixer.timeScale = frozen && !REACTIONS.has(state.action) ? 0 : 1;
    const poseDt = this.poseClock.step(dt, this.group.visible || this.def.role === 'boss' || !!mark, `${key}:${frozen}`);
    if (poseDt !== undefined) {
      this.mixer.update(poseDt);
      this.clampRoot();
      // Rest-height normalisation alone lets a retargeted run hover or sink.
      // Put the lower supporting ankle at its idle height, without walking the
      // full hierarchy or altering attack/leap animation and simulation Y.
      if (this.feet.length && state.grounded && ['idle', 'run', 'guard'].includes(state.action)) {
        let lowest = Infinity;
        for (const foot of this.feet) lowest = Math.min(lowest, jointInAncestor(foot, this.group, _v).y);
        this.model.position.y += THREE.MathUtils.clamp(this.footRest * this.grown - lowest, -this.def.height * .16, this.def.height * .16);
      }
      // Crossfades disable the outgoing action but leave its bindings active.
      // Retire completed fades so a long-lived enemy pays for only its live pose.
      for (const action of this.actions.values()) if (action !== this.current && !action.enabled) action.stop();
    }
    if (state.hitstop) {
      const shake = .045 * (state.size ?? 1);
      this.model.position.x += (Math.random() - .5) * shake;
      this.model.position.z += (Math.random() - .5) * shake;
    }
    // Flash on a hit, and the rift dissolve on the way in and out.
    this.flash = Math.max(0, this.flash - dt * 9);
    this.uniforms.uEnemyFlash.value = this.flash * .8;
    const arriving = Math.max(0, 1 - (now - this.born) / .55);
    const leaving = this.diedAt >= 0 ? Math.max(0, Math.min(1, (now - this.diedAt - 1.15) / .9)) : 0;
    this.uniforms.uEnemyDissolve.value = Math.max(arriving, leaving);
    // Drawn before it is coloured: all ink as the rift lets it through and while the lens
    // comes round to it (a boss's entrance orbit takes a second and a bit to frame it), then
    // its colour rises. A lesser arrival's is quicker.
    const lens = this.def.role === 'boss' || this.markHex ? 1.2 : .45;
    // And falling, its colour drains from the head down: it is ink again before the rift takes it.
    const drained = this.diedAt >= 0 ? smoothstep(.05, .7, now - this.diedAt) : 0;
    this.uniforms.uEnemyInked.value = INK_ON ? Math.max(1 - smoothstep(lens, lens + .85, now - this.born), drained) : 0;
    this.shadow.visible = leaving < .5;
    const shadowScale = Math.max(.8, this.def.size ?? 1) * 1.1 * (1 - Math.min(.6, state.y * .15));
    this.shadow.scale.setScalar(shadowScale); this.shadow.position.y = .015 - state.y + (state.grounded ? 0 : 0);
  }

  private chains = new Map<EnemyMove, THREE.AnimationClip[]>();
  private chained(move: EnemyMove, template: Template) {
    let parts = this.chains.get(move);
    if (!parts) {
      parts = move.chain!.map(pattern => findClip(template.clips, [pattern])).filter((clip): clip is THREE.AnimationClip => !!clip);
      this.chains.set(move, parts);
    }
    return parts;
  }

  get finished() { return this.diedAt >= 0 && this.uniforms.uEnemyDissolve.value >= 1; }

  centre(out: THREE.Vector3) {
    if (this.hips) { this.hips.getWorldPosition(out); return out; }
    return out.copy(this.group.position).setY(this.group.position.y + this.def.height * .55);
  }

  dispose() {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    this.group.removeFromParent();
    for (const material of this.materials) material.dispose();
    // Each clone carries its own skeleton, and the renderer gave each one a
    // bone texture: without this every body that ever spawned kept its own.
    const skeletons = new Set<THREE.Skeleton>();
    this.model.traverse(node => { const skinned = node as THREE.SkinnedMesh; if (skinned.isSkinnedMesh) skeletons.add(skinned.skeleton); });
    for (const skeleton of skeletons) skeleton.dispose();
  }
}

/** The ground a marked boss stands on: a circle of its rank's colour with a
 *  ring of runes turning round it, a little wider than the boss. Drawn
 *  additive and faint enough to stay under the bloom; one draw for all. */
class Sigils {
  readonly mesh: THREE.InstancedMesh;
  private readonly time = { value: 0 };
  private readonly colors: THREE.InstancedBufferAttribute;
  private static readonly MAX = 6;
  constructor() {
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(Sigils.MAX * 4), 4);
    plane.setAttribute('aSigil', this.colors);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time },
      vertexShader: /* glsl */`
attribute vec4 aSigil;
varying vec2 vUv;
varying vec4 vSigil;
void main() { vUv = uv * 2.0 - 1.0; vSigil = aSigil; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: /* glsl */`
uniform float uTime;
varying vec2 vUv;
varying vec4 vSigil;
void main() {
	float r = length( vUv );
	if ( r > 1.0 ) discard;
	float a = atan( vUv.y, vUv.x );
	// Two rings, and between them runes: sixteen strokes turning slowly, a gap every fourth.
	float outer = 1.0 - smoothstep( 0.0, .03, abs( r - .93 ) );
	float inner = 1.0 - smoothstep( 0.0, .018, abs( r - .74 ) );
	float turn = a / 6.2831853 * 16.0 + uTime * .35 + vSigil.w;
	float rune = step( .55, fract( turn ) ) * step( .3, fract( turn * .25 ) ) * step( .77, r ) * step( r, .9 );
	// The ground inside darkened a touch, so the circle reads on a lit floor.
	float glow = outer + inner * .75 + rune * .55 + ( 1.0 - smoothstep( .5, .95, r ) ) * .06;
	#ifdef INK
	// On the inked page: drawn in its rank's colour as ink, the runes over it.
	gl_FragColor = vec4( vSigil.rgb * .42, min( 1.0, outer + inner * .8 + rune * .7 ) );
	#else
	gl_FragColor = vec4( vSigil.rgb * glow * .85, 1.0 );
	#endif
}`,
      defines: INK_ON ? { INK: '' } : {},
      transparent: true, depthWrite: false, blending: INK_ON ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.InstancedMesh(plane, material, Sigils.MAX);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = -1; this.mesh.name = 'survival-boss-sigils';
  }
  private readonly m = new THREE.Matrix4();
  private readonly c = new THREE.Color();
  update(bodies: Iterable<EnemyBody>, now: number) {
    this.time.value = now;
    let n = 0;
    for (const body of bodies) {
      if (!body.markHex || n >= Sigils.MAX) continue;
      const g = body.group.position, r = Math.max(1.1, (body.def.size ?? 1) * 1.25 + body.def.height * .18);
      this.m.makeScale(r, 1, r).setPosition(g.x, .035, g.z);
      this.mesh.setMatrixAt(n, this.m);
      this.c.setHex(body.markHex);
      this.colors.setXYZW(n, this.c.r, this.c.g, this.c.b, n * 1.7);
      n++;
    }
    this.mesh.count = n;
    if (n) { uploadInstances(this.mesh.instanceMatrix, n); uploadInstances(this.colors, n); }
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.removeFromParent(); }
}

export class EnemyHorde {
  private sigils = new Sigils();
  private templates = new Map<string, Template>();
  private loading = new Map<string, Promise<Template>>();
  private bodies = new Map<string, EnemyBody>();
  private loader = new GLTFLoader().register(bodyTexturePlugin);
  /** Bosses and brutes, for framing. */
  readonly root = new THREE.Group();
  constructor(private scene: THREE.Scene) { this.root.name = 'enemy-horde'; scene.add(this.root); this.root.add(this.sigils.mesh); }

  /** Load every model a set of enemies needs. Safe to call again. */
  async load(ids: readonly string[], onProgress?: (label: string) => void) {
    const defs = new Map<string, EnemyDefinition>();
    // A shadow rival has no model of its own: it is drawn as its fighter.
    for (const id of ids) { const def = ENEMIES[id]; if (def?.model && !defs.has(def.model)) defs.set(def.model, def); }
    await Promise.all([...defs.values()].map(def => this.template(def.model, onProgress, def.clips.idle, def.motion)));
  }

  private template(url: string, onProgress?: (label: string) => void, idlePatterns?: readonly string[], motion?: EnemyDefinition['motion']) {
    const existing = this.loading.get(url);
    if (existing) return existing;
    const promise = this.loader.loadAsync(url).then(async gltf => {
      // A boss on the horde's skeleton plays the horde's own clips.
      if (motion === 'humanoid') gltf.animations.push(...(await humanoidLibraries()).flatMap(library => humanoidClips(library, gltf.scene)));
      onProgress?.(`Loading ${url.split('/').pop()}…`);
      const json = gltf.parser.json as { meshes?: { name?: string }[] };
      gltf.scene.traverse(node => {
        const index = (gltf.parser.associations.get(node as THREE.Mesh) as { meshes?: number } | undefined)?.meshes;
        if (index !== undefined && json.meshes?.[index]?.name) node.userData.part = json.meshes[index].name;
      });
      gltf.scene.updateMatrixWorld(true);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const idle = findClip(gltf.animations, idlePatterns) ?? gltf.animations.find(c => /idle/i.test(c.name)) ?? gltf.animations[0];
      if (idle) { mixer.clipAction(idle).play(); mixer.update(0); }
      gltf.scene.updateMatrixWorld(true);
      _box.makeEmpty();
      gltf.scene.traverse(node => {
        const mesh = node as THREE.SkinnedMesh;
        if (!mesh.isMesh || VARIANT.test(`${mesh.userData.part ?? ''} ${mesh.name}`) || !mesh.visible) return;
        if (mesh.isSkinnedMesh) { mesh.computeBoundingBox(); _box.union(mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)); }
        else { mesh.geometry.computeBoundingBox(); _box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)); }
      });
      mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
      const size = _box.getSize(new THREE.Vector3());
      const centre = new THREE.Vector3((_box.min.x + _box.max.x) / 2, _box.min.y, (_box.min.z + _box.max.z) / 2);
      const held = bossStance(url); if (held) { size.y = held.height; centre.y = held.floor; }
      const distant = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
      // Mode-owned horde bodies only. Bosses and the shared Arcade models keep
      // their existing presentation and asset policy.
      if (url.startsWith('/assets/objectives/enemies/') || url.startsWith('/assets/survival/motion/grunt-')) {
        const geometries = new Set<THREE.BufferGeometry>();
        gltf.scene.traverse(node => { if ((node as THREE.SkinnedMesh).isSkinnedMesh) geometries.add((node as THREE.Mesh).geometry); });
        for (const geometry of geometries) {
          const coarse = await distantGeometry(geometry);
          if (coarse) distant.set(geometry, coarse);
        }
      }
      const template: Template = { gltf, height: Math.max(1e-5, size.y), centre, clips: gltf.animations, distant };
      this.templates.set(url, template);
      if (UPLOAD.texture) for (const texture of bodyTextures(gltf.scene)) UPLOAD.texture(texture);
      return template;
    });
    this.loading.set(url, promise);
    return promise;
  }

  /** Bodies for every enemy in the snapshot, drawn where it says. */
  /** Read-only live bodies for dynamic crowd framing; no per-frame copying. */
  get cameraBodies(): ReadonlyMap<string,EnemyBody> { return this.bodies; }
  update(players: readonly PlayerState[], dt: number, now: number, camera?: THREE.Camera) {
    const seen = new Set<string>();
    if (camera) {
      camera.updateMatrixWorld();
      _matrix.multiplyMatrices((camera as THREE.PerspectiveCamera).projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_matrix);
    }
    // A split screen's second lens (lenses.ts): a body only Player 2's half shows is drawn as well.
    const second = camera ? secondFrustum() : undefined;
    LIVING.clear();
    for (const state of players) {
      if (!state.enemy) continue;
      seen.add(state.id);
      if (state.alive) LIVING.add(state.id);
      let body = this.bodies.get(state.id);
      const def = ENEMIES[state.enemy];
      if (!body && def) {
        const template = this.templates.get(def.model);
        if (!template) { void this.template(def.model, undefined, def.clips.idle, def.motion); continue; }
        body = new EnemyBody(def, template, state, now);
        this.bodies.set(state.id, body);
        this.root.add(body.group);
      }
      if (body) {
        if (camera) {
          _sphere.center.set(state.x, state.y + body.def.height * .5, state.z);
          _sphere.radius = body.def.height * .9 + 1;
          body.group.visible = _frustum.intersectsSphere(_sphere) || !!second?.intersectsSphere(_sphere);
        } else body.group.visible = true;
        body.update(dt, state, now, this.templates.get(body.def.model)!);
        body.detail(camera);
      }
    }
    let removed=false;
    for (const [id, body] of this.bodies) if (!seen.has(id)) { body.dispose(); this.bodies.delete(id); removed=true; }
    if(removed&&this.retained)this.prune();
    this.sigils.update(this.bodies.values(), now);
    if (camera) this.cover(camera);
  }

  /** A brute or an elite standing between the lens and the fighter, over them
   *  on the screen, goes whole - not the tube through it the shader cuts,
   *  which left the rest of a giant's back filling the frame - and one nearing
   *  the lens goes at a distance its size asks for (as the horde's bodies do,
   *  GruntRenderer). Bosses and the arcade's marked leaders are the fight: never. */
  cover(camera: THREE.Camera) {
    const focus = FOCUS.value, f = Math.max(-focus.z, .05), known = focus.lengthSq() > .01;
    for (const body of this.bodies.values()) {
      const u = body.uniforms.uEnemyCover;
      if (!body.group.visible || body.def.role === 'boss' || body.markHex) { u.value = 0; continue; }
      const tall = body.def.height;
      _v.copy(body.group.position).setY(body.group.position.y + tall * .55).applyMatrix4(camera.matrixWorldInverse);
      const d = Math.max(-_v.z, .05);
      let cover = 0;
      if (known) {
        const ahead = 1 - smoothstep(f - 1.4, f - .7, d);
        const over = Math.max(Math.abs(_v.x / d - focus.x / f) / (tall * .22 / d + .35 / f), Math.abs(_v.y / d - focus.y / f) / (tall * .5 / d + .8 / f));
        cover = ahead * (1 - smoothstep(.8, 1, over));
      }
      u.value = Math.max(cover, 1 - smoothstep(tall * 1.2, tall * 1.6, _v.length()));
    }
  }

  /** A blow landed on an enemy: it flashes - for the fighter's own blows. An
   *  art's or an upgrade's lands dozens of times a second and used to hold a
   *  boss bleached white for seconds on end. */
  handle(events: readonly CombatEvent[]) {
    for (const event of events) if (event.kind === 'hit' && event.targetId && !isProc(event.move)) this.bodies.get(event.targetId)?.hit();
  }

  centre(id: string, out: THREE.Vector3) { const body = this.bodies.get(id); if (!body) return undefined; return body.centre(out); }
  /** For probes: every body's drawn height (skinned, visible parts), where it
   *  stands, and what it is playing. Costly; never call it per frame. */
  evidence() {
    return [...this.bodies.entries()].map(([id, body]) => {
      _box.makeEmpty();
      body.model.updateMatrixWorld(true);
      body.model.traverse(node => {
        const mesh = node as THREE.SkinnedMesh;
        if (!mesh.isMesh || !mesh.visible || mesh.name.endsWith('-ink')) return;
        if (mesh.isSkinnedMesh) { mesh.computeBoundingBox(); _box.union(mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)); }
      });
      const size = _box.getSize(new THREE.Vector3());
      const template = this.templates.get(body.def.model);
      return { id, enemy: body.def.id, templateHeight: template?.height, scale: body.model.scale.x, height: +size.y.toFixed(2), width: +Math.max(size.x, size.z).toFixed(2), x: +body.group.position.x.toFixed(2), z: +body.group.position.z.toFixed(2), action: body.state.action, move: body.state.move, playing: body.playing, visible: body.group.visible };
    });
  }
  has(id: string) { return this.bodies.has(id); }
  body(id: string) { return this.bodies.get(id); }
  get count() { return this.bodies.size; }

  /** Everything the horde draws, compiled now rather than on the frame the
   *  first of each kind walks out of a rift. One hidden body per model is
   *  kept for as long as the model is: compiled (the caller's compileAsync),
   *  never drawn - drawn while its programs were still compiling, it made the
   *  frame wait for them; thrown away after, it let them go, and the real
   *  boss compiled them again as it arrived. The release is kept for the
   *  caller; keepOnly lets a keeper go with its model. */
  warm(scene: THREE.Scene, ids: readonly string[]) {
    for (const id of ids) {
      const def = ENEMIES[id], template = def && this.templates.get(def.model);
      if (!def || !template || this.keepers.has(def.model)) continue;
      const state = { id: 'warm-' + id, x: 0, y: -50, z: 0, yaw: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, alive: true, grounded: true, enemy: id } as unknown as PlayerState;
      const body = new EnemyBody(def, template, state, 0);
      body.uniforms.uEnemyDissolve.value = 0;
      body.group.visible = false;
      scene.add(body.group); this.keepers.set(def.model, body);
    }
    return () => {};
  }
  private keepers = new Map<string, EnemyBody>();

  /** Compile incoming keepers against the scene's lights without walking all
   * the already-resident stage, fighters and effects on every wave change. */
  warmRoots(ids:readonly string[]){
    const models=new Set(ids.map(id=>ENEMIES[id]?.model));
    return [...models].flatMap(model=>{const body=model&&this.keepers.get(model);return body?[body.group]:[];});
  }

  clear() { for (const body of this.bodies.values()) body.dispose(); this.bodies.clear(); }

  /** Let go of every loaded model not needed by `ids` or a body on the stage:
   *  its geometry, materials and textures leave the GPU with it. A run meets
   *  twenty bosses; holding them all was most of what an 8 GB machine ran
   *  out of by the fifth act. */
  private retained:Set<string>|undefined;
  get resources(){return {bodies:this.bodies.size,templates:this.templates.size,keepers:this.keepers.size,loading:this.loading.size};}
  keepOnly(ids: readonly string[]) {
    this.retained=new Set(ids.flatMap(id=>ENEMIES[id]?.model?[ENEMIES[id].model]:[]));this.prune();
  }
  collect(){if(this.retained)this.prune();}
  private prune(){
    const wanted = new Set(this.retained);
    for (const body of this.bodies.values()) wanted.add(body.def.model);
    for (const [url, template] of this.templates) {
      if (wanted.has(url)) continue;
      this.keepers.get(url)?.dispose(); this.keepers.delete(url);
      releaseTextures(template.gltf.scene);
      for (const geometry of template.distant.values()) geometry.dispose();
      template.gltf.scene.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        }
      });
      this.templates.delete(url); this.loading.delete(url);
    }
  }
  dispose() { this.clear(); this.keepOnly([]); for (const body of this.keepers.values()) body.dispose(); this.keepers.clear(); this.sigils.dispose(); this.root.removeFromParent(); }
}
