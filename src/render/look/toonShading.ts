import * as THREE from 'three';
import { DREAM_IMPACT } from '../dreamFlag';
import { addShaderPatch, replaceOnce } from './shaderPatch';
import { COOKIE_GLSL, cookieUniforms } from './lightCookie';
import type { LookPreset } from './stageLooks';
import { roanEnabled } from './roanPass';
import { creaseDepths } from './crease';
import { sparkProfile } from './powerupLook';

/** The fighters' cel look, shared by every toon material through one set of
 *  uniform objects: a stage change rewrites these values once and every
 *  fighter on screen follows on the next frame, with no recompile. */
export const toonUniforms = {
  uToonShadow: { value: new THREE.Color(.62, .58, .86) },
  uToonMid: { value: new THREE.Color(.4, .2, .1) },
  uToonEdge: { value: .02 },
  uToonSoft: { value: .035 },
  uToonFaceSoft: { value: .22 },
  uToonAmbient: { value: 2 },
  uToonFloor: { value: new THREE.Color(0, 0, 0) },
  uToonKey: { value: 1 },
  uToonNeutral: { value: 0 },
  uToonFill: { value: 1 },
  uToonFillFloor: { value: 0 },
  uToonClip: { value: new THREE.Vector2(.5, .74) },
  uRimColor: { value: new THREE.Color(1.2, 1, .8) },
  uRimWidth: { value: .34 },
  uRimDir: { value: new THREE.Vector3(0, .5, -1).normalize() },
  /** The edge rim's width in device pixels (set on resize) and its brightest channel. */
  uRimPx: { value: 3 },
  uRimPeak: { value: .92 },
  uHairSpec: { value: new THREE.Color(.35, .33, .3) },
  uToonSaturation: { value: 1 },
  uToonFlatten: { value: 0 },
};
/** The frame's answers that reach the fighters themselves, written by
 *  GameRenderer every frame (see techniqueGrade, timeStop and impactFrame
 *  there). `uLookTech` is the technique grade's strength and
 *  `uLookTechColor` its hue at unit luminance: the fighters take its light as
 *  a rim all round and give back part of the room's dimming.
 *  `uLookSilhouette` turns every fighter into flat ink - black body, black
 *  outline - with a white edge of `uLookSilhouetteRim`; the final pass keys
 *  on that black to keep them black while it repaints the world. */
export const frameUniforms = {
  uLookTech: { value: 0 },
  uLookTechColor: { value: new THREE.Color(1, 1, 1) },
  uLookSilhouette: { value: 0 },
  uLookSilhouetteRim: { value: 0 },
};
/** Ink: its colour, and its width as a fraction of the viewport height -
 *  2.2 px at 1080p, the same on every fighter at every distance up close. */
export const inkUniforms = {
  uInkColor: { value: new THREE.Color(.012, .008, .01) },
  // The colour pass: a silhouette line a good deal heavier than 2.2 px at
  // 1080p reads better; 3.2 with the same thinning at distance.
  uInkWidth: { value: (roanEnabled() ? 3.2 : 2.2) / 1080 },
};

const celOn = roanEnabled() && (typeof location === 'undefined' || new URLSearchParams(location.search).get('cel') !== '0');
export const celUniforms = {
  uCelFlat: { value: celOn ? 1 : 0 },
  uCelInk: { value: celOn ? 1 : 0 },
  uCelCrease: { value: celOn ? 1 : 0 },
  /** The flattening's reach (mip bias of the cloth's mean) and the colour
   *  distance (OKLab a-b) over which "the same colour" fades out. */
  uCelArea: { value: 4 },
  uCelMatch: { value: new THREE.Vector2(.022, .055) },
  /** The painted ink: how much darker than its surroundings (in lightness,
   *  0-1) a texel starts to be, and is fully, ink; and the mip bias of "round
   *  it". */
  uCelInkRange: { value: new THREE.Vector2(.05, .11) },
  uCelInkReach: { value: 2.3 },
  /** The crease line's half-width in device pixels (set on resize; 1080p's value below). */
  uCreasePx: { value: .7 },
  /** Where the crease ink fades as the body's triangles shrink on screen:
   *  the crease field's change per pixel (its fwidth: 1 / a triangle's
   *  height in pixels) from x to y. */
  uCreaseFade: { value: new THREE.Vector2(1.2, 2.5) },
};
const CREASE_PX = .7;
/** Stream F's own strengths, before a power-up profile scales them (setToonLook). */
const CEL_ON = celOn ? 1 : 0;

/** The power-up pass (look/powerupLook.ts): its shade, sheen, rim wash and tinted ink, set with the look
 *  from the profile chosen with `?look=`. Every default here draws the colour look exactly as it was. */
export const sparkUniforms = {
  /** y: how much of the shade is the cloth's own colour deepened rather than the look's cool tint; z: its brightness
   *  against the look's shade (1 the same); w: how much richer its hue (an exponent; 1 none). x is unused. */
  uSparkShade: { value: new THREE.Vector4(0, 0, 1, 1.4) },
  /** x: the sheen's strength (0 none), y: its sharpness (0 broad .. 1 a point), z: the hair ring's multiple. */
  uSparkSpec: { value: new THREE.Vector3(0, .5, 1) },
  /** The broad fresnel wash's share under the rim (the look's own: .3). */
  uSparkWash: { value: .3 },
  /** How much of the cloth's own colour, deepened, the outline takes (0: the look's ink). */
  uInkTint: { value: 0 },
};
/** The anime finish's cutscene rig (look/powerupLook.ts): lights that exist only in the fighters' shader, placed
 *  relative to the camera - in view space, so every camera, a planned still's or a replay's, lights them the same way
 *  and the stage is untouched. The key comes from the upper side the stage's own key is on (turned toward the lens by
 *  uRig.x, so a stage keeps its sun's side and colour), a cool fill from the other side, and two rims from behind the
 *  fighter: a warm one on the key's side and a cool one opposite. Zero everywhere: the stage's lights as they were. */
export const rigUniforms = {
  /** x: the key turned from the stage's toward the rig's (0..1), y: the fill's, z: the rims' strength, w: how much of
   *  the key's cast shadow the fighters keep (1 all). */
  uRig: { value: new THREE.Vector4(0, 0, 0, 1) },
  /** The rims' and the fill's light (linear). */
  uRigWarm: { value: new THREE.Color(0, 0, 0) },
  uRigCool: { value: new THREE.Color(0, 0, 0) },
  uRigFill: { value: new THREE.Color(0, 0, 0) },
  /** x: the rims' width in device pixels (set on resize), y: how far the shade turns cool, z: its saturation (1 as is). */
  uRigShade: { value: new THREE.Vector4(3, 0, 1, 0) },
};
// A dev build hands these to its capture tools (scripts/roan/cel_capture.mjs
// draws each still with and without, on the same frozen frame).
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __celUniforms: celUniforms, __rigUniforms: rigUniforms });

const linear = (hex: number, scale = 1) => new THREE.Color(hex).multiplyScalar(scale);

let rimPx = 2.4, rigPx = 3, bufferHeight = 1080;
/** The edge rim is specified at 1080p, like the ink; this scales it to the
 *  drawing buffer's height, on every resize and stage change. */
export function setToonResolution(height: number) {
  bufferHeight = height; toonUniforms.uRimPx.value = rimPx * Math.max(.5, height / 1080);
  rigUniforms.uRigShade.value.x = rigPx * Math.max(.5, height / 1080);
  celUniforms.uCreasePx.value = CREASE_PX * Math.max(.5, height / 1080);
}

/** Copy a stage's look into the shared uniforms. */
export function setToonLook(look: LookPreset) {
  const t = look.toon;
  toonUniforms.uToonShadow.value.copy(linear(t.shadow));
  toonUniforms.uToonMid.value.copy(linear(t.mid, t.midStrength));
  toonUniforms.uToonEdge.value = t.edge;
  toonUniforms.uToonSoft.value = t.soft;
  toonUniforms.uToonAmbient.value = t.ambient;
  toonUniforms.uToonFloor.value.copy(linear(t.floor ?? 0));
  toonUniforms.uToonKey.value = t.key ?? 1;
  toonUniforms.uToonNeutral.value = t.neutral ?? 0;
  toonUniforms.uToonFill.value = t.fill ?? 1;
  toonUniforms.uToonFillFloor.value = t.fillFloor ?? 0;
  toonUniforms.uToonClip.value.set(...(t.clip ?? [.5, .74]));
  toonUniforms.uToonSaturation.value = t.saturation ?? 1;
  toonUniforms.uToonFlatten.value = roanEnabled() ? .7 : 0;
  toonUniforms.uRimColor.value.copy(linear(look.rim.color, look.rim.strength));
  toonUniforms.uRimWidth.value = look.rim.width;
  rimPx = look.rim.px ?? 2.4; setToonResolution(bufferHeight);
  toonUniforms.uRimPeak.value = look.rim.peak ?? .92;
  const d = look.rim.dir ?? look.key.dir;
  toonUniforms.uRimDir.value.set(d[0], d[1], d[2]).normalize();
  toonUniforms.uHairSpec.value.copy(linear(look.rim.color, .32));
  inkUniforms.uInkColor.value.copy(linear(t.ink));
  // The power-up pass: the chosen profile's line, cel passes, shade, sheen and wash (none: as above).
  const p = sparkProfile();
  inkUniforms.uInkWidth.value = (p ? p.ink.px : roanEnabled() ? 3.2 : 2.2) / 1080;
  sparkUniforms.uInkTint.value = p?.ink.tint ?? 0;
  celUniforms.uCelFlat.value = CEL_ON * (p?.cel.flat ?? 1);
  celUniforms.uCelInk.value = CEL_ON * (p?.cel.ink ?? 1);
  celUniforms.uCelCrease.value = CEL_ON * (p?.cel.crease ?? 1);
  sparkUniforms.uSparkShade.value.set(0, p?.shade.anime ?? 0, p?.shade.depth ?? 1, p?.shade.richness ?? 1.4);
  sparkUniforms.uSparkSpec.value.set(p?.spec.sheen ?? 0, p?.spec.sharp ?? .5, p?.spec.hair ?? 1);
  sparkUniforms.uSparkWash.value = p?.rim.wash ?? .3;
  // The cutscene rig (none on a look without one: the stage's lights alone).
  const r = look.rig;
  rigUniforms.uRig.value.set(r?.key ?? 0, r?.fill ?? 0, r ? 1 : 0, r?.shadow ?? 1);
  rigUniforms.uRigWarm.value.copy(linear(r?.warm ?? 0, r?.warmStrength ?? 0));
  rigUniforms.uRigCool.value.copy(linear(r?.cool ?? 0, r?.coolStrength ?? 0));
  rigUniforms.uRigFill.value.copy(linear(r?.fillColor ?? 0, r?.fillStrength ?? 0));
  rigUniforms.uRigShade.value.y = r?.shade ?? 0; rigUniforms.uRigShade.value.z = r?.shadeSaturation ?? 1;
  rigPx = r?.px ?? 3; setToonResolution(bufferHeight);
}

export type ToonKind = 'body' | 'hair' | 'metal' | 'matte';
export const TOON_METAL = /^(mat_dvl_mdl_(gaunt|sword)|steel_[a-z0-9_]+)$/;
/** Steel with no shine (Briar Crown round 5): the metal's neutral floor, so a dark blade is not lifted violet, but
 *  no cel highlight and no sky streak - Cardo's Weedcutter lies flat on his shoulder, and the streak on its upturned
 *  face drew it as "a short pale-gold leaf" (critic pass 4). A material named `matte_...`. */
export const TOON_MATTE = /^matte_[a-z0-9_]+$/;
export function toonKind(meshName: string, materialName: string): ToonKind {
  if (TOON_MATTE.test(materialName)) return 'matte';
  if (TOON_METAL.test(materialName)) return 'metal';
  const name = `${meshName} ${materialName}`;
  return /hair/i.test(name) && !/hat/i.test(name) ? 'hair' : 'body';
}

/** Per-vertex weight of the head and everything parented under it, for the
 *  face softening. Zero everywhere when the rig has no resolvable head, and
 *  on rigid props.
 *
 *  Stream F: two more components ride along. A fighter's body (a head is
 *  given: Fighter builds every mesh with its rig's head) carries 1 for the cel
 *  look and its crease field (1 on a crease chain, look/crease.ts), so the
 *  shader's flattening and ink reach fighters only - the survival horde
 *  passes no head, and anything else that wears the toon patch carries no
 *  such attribute (an attribute of fewer components reads 0 in them). */
export function headWeights(geometry: THREE.BufferGeometry, skeleton?: THREE.Skeleton, head?: THREE.Object3D) {
  const count = geometry.getAttribute('position').count, weights = new Float32Array(count * 3);
  const ids = geometry.getAttribute('skinIndex'), amounts = geometry.getAttribute('skinWeight');
  if (skeleton && head && ids && amounts) {
    const inHead = skeleton.bones.map(bone => { for (let node: THREE.Object3D | null = bone; node; node = node.parent) if (node === head) return true; return false; });
    for (let i = 0; i < count; i++) for (let j = 0; j < 4; j++) if (inHead[ids.getComponent(i, j)]) weights[i * 3] += amounts.getComponent(i, j);
  }
  if (head) {
    // Folds belong to a body that bends: a rigid prop (a sword and its wrap,
    // a sheath, a gourd) rides one or two bones, and its small hard details
    // read as dashes of ink, so it gets the cel colour but no creases.
    let bones = 0;
    if (ids && amounts) { const seen = new Set<number>(); for (let i = 0; i < count && seen.size < 4; i++) for (let j = 0; j < 4; j++) if (amounts.getComponent(i, j) > .2) seen.add(ids.getComponent(i, j)); bones = seen.size; }
    const crease = bones >= 4 ? creaseDepths(geometry) : new Float32Array(count);
    for (let i = 0; i < count; i++) { weights[i * 3 + 1] = 1; weights[i * 3 + 2] = crease[i] > 0 ? 1 : 0; }
  }
  return new THREE.BufferAttribute(weights, 3);
}

/** The fighters' light model, replacing MeshToonMaterial's own.
 *
 *  Three's toon ramp is a greyscale lookup of N.L that every light goes
 *  through separately, with cast shadows multiplied into the light colour
 *  afterwards: a grey shadow, a second band for the fill light, and a cast
 *  shadow that is a soft grey smudge rather than a cel edge. Here the key
 *  light (the shadow-casting sun, which three always sorts first) makes one
 *  crisp lit/shadow edge from N.L and its own shadow map together, with a
 *  narrow warm band inside the terminator; every other light - the fill, the
 *  impact point lights - adds a soft wrap instead of another band; and the
 *  ambient is tinted toward the stage's cool shadow colour wherever the key
 *  does not reach, so shadows read violet-blue rather than grey. Heads get a
 *  wider terminator per vertex, because a hard band across a face reads as a
 *  bruise. After lighting, a fresnel rim in the stage's rim colour, strongest
 *  on the side facing the rim direction, and an angel-ring highlight on hair. */
const TOON_PARS = /* glsl */`
varying vec3 vViewPosition;
varying float vLookHead;
uniform vec3 uToonShadow;
uniform vec3 uToonMid;
uniform float uToonEdge;
uniform float uToonSoft;
uniform float uToonFaceSoft;
uniform float uToonAmbient;
uniform float uToonKey;
uniform float uToonNeutral;
uniform float uToonFill;
uniform float uToonFillFloor;
uniform vec4 uSparkShade;
uniform vec4 uRig;
uniform vec3 uRigFill;
uniform vec4 uRigShade;
struct ToonMaterial { vec3 diffuseColor; };
// The stage key's side of the screen (-1 left .. 1 right): the rig's key and warm rim take it, the fill and cool rim the other.
float toonSide = 1.0;
bool toonIsKey = false;
bool toonIsFill = false;
float toonShadowTerm = 1.0;
float toonShade = 0.0;
float toonLit = 1.0;
float lookSilhouetteEdge = 0.0;
// How squarely the surface faces the lens (|N.V|, geometric): the hit flash (applyHitFlash) is a rim, thin on the faces.
float lookFacing = 1.0;
// Round 3c: the metal mask (the texture's alpha on LOOK_METAL materials) and
// the key light, kept for the steel's highlight in the finish.
float lookMetal = 0.0;
vec3 toonKeyDir = vec3( 0.0, 1.0, 0.0 );
vec3 toonKeyLight = vec3( 0.0 );
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	// The cutscene rig (rigUniforms): the key turned toward a camera-relative key from the upper side its own sun is on,
	// the fill toward one from the other side, low and in front. View space, so no camera is needed here.
	vec3 toonL = directLight.direction;
	if ( toonIsKey ) {
		toonSide = clamp( toonL.x * 3.0, -1.0, 1.0 );
		if ( uRig.x > 0.0 ) toonL = normalize( mix( toonL, normalize( vec3( toonSide * .62, .6, .5 + .25 * ( 1.0 - abs( toonSide ) ) ) ), uRig.x ) );
	} else if ( toonIsFill && uRig.y > 0.0 ) toonL = normalize( mix( toonL, normalize( vec3( - toonSide * .72, .12, .68 ) ), uRig.y ) );
	float d = dot( geometryNormal, toonL );
	if ( toonIsKey ) {
		toonIsKey = false;
		float face = vLookHead * LOOK_FACE;
		float soft = mix( uToonSoft, uToonFaceSoft, face );
		float lit = smoothstep( uToonEdge - soft, uToonEdge + soft, d ) * mix( 1.0, smoothstep( .2, .7, toonShadowTerm ), uRig.w );
		// The hall's windows and a passing cloud each reach the fighters by their own share (lightCookie.ts).
		lit *= mix( 1., lookWindow( vLookWorld ), uCookieFighters ) * mix( 1., lookCloud( vLookWorld ), uCloudFighters );
		float band = lit * ( 1.0 - smoothstep( uToonEdge + soft, uToonEdge + soft + .24, d ) );
		toonShade = 1.0 - lit;
		toonLit = lit;
		toonKeyDir = toonL;
		// The fighters take their own share of the key, partly stripped of its
		// colour: the room keeps the amber, the rim carries it, and a costume
		// keeps its own hue on the lit side.
		vec3 keyColor = mix( directLight.color, vec3( dot( directLight.color, vec3( .2126, .7152, .0722 ) ) ), uToonNeutral ) * uToonKey;
		toonKeyLight = keyColor;
		// Steel takes a little less of the key than cloth: its lit planes are a
		// grey sheen, not chalk (round 3c, LOOK_METAL).
		reflectedLight.directDiffuse += ( lit + band * uToonMid * ( 1.0 - face * .6 ) ) * keyColor * BRDF_Lambert( material.diffuseColor ) * ( 1.0 - .3 * lookMetal );
	} else if ( toonIsFill ) {
		toonIsFill = false;
		// The cool fill is the second tone of the shade side: two soft steps
		// toward the fill, mostly gone where the key already lights the
		// surface. Its albedo floor lifts a dark colour along its own hue, so
		// a black coat comes up navy with its folds instead of one crushed
		// mass, and a saturated colour is left alone - a grey floor under an
		// orange gi read as pink.
		// The fill's own blue is halved for them: at full saturation it
		// turned a black cape and dark steel royal blue rather than navy.
		float wrap = mix( .45, 1.0, smoothstep( .05, .3, d ) ) * smoothstep( -.5, -.15, d );
		vec3 fillAlbedo = material.diffuseColor * max( 1.0, uToonFillFloor / max( max( material.diffuseColor.r, max( material.diffuseColor.g, material.diffuseColor.b ) ), .02 ) );
		#ifdef LOOK_MATTE
		// Briar Crown round 7: a matte black keeps its black in the cool fill too (the fill floor lit the Black Snow's
		// flat a sky blue whenever it turned from the key - the blade should read black from every side).
		fillAlbedo = material.diffuseColor * 1.5;
		#endif
		vec3 fillColor = mix( mix( vec3( dot( directLight.color, vec3( .2126, .7152, .0722 ) ) ), directLight.color, .5 ), uRigFill, uRig.y );
		reflectedLight.directDiffuse += wrap * ( 1.0 - .8 * toonLit ) * uToonFill * fillColor * BRDF_Lambert( fillAlbedo );
	} else {
		reflectedLight.directDiffuse += smoothstep( -.25, .6, d ) * directLight.color * BRDF_Lambert( material.diffuseColor );
	}
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	// The stage's ambient mostly sets how bright a fighter's shadow is; its
	// hue comes from the look's shadow tint. Taken at full colour, a cool sky
	// times a violet tint turned skin blue.
	vec3 ambient = mix( vec3( dot( irradiance, vec3( .2126, .7152, .0722 ) ) ), irradiance, .35 );
	// Skin keeps a warm shadow. A violet-blue shade is right for cloth and
	// hair, but on skin it read as lilac - bruised arms and a grey face - so
	// warm, moderately saturated albedo (r > g > b) shades toward peach.
	// Only skin-like warmth: green at least a quarter of red. An orange gi
	// or Kurobi's fur is warm too, and shading those peach turned the gi
	// salmon and flattened the fox into one orange.
	vec3 albedo = material.diffuseColor;
	float skin = smoothstep( .04, .16, albedo.r - albedo.g ) * smoothstep( .01, .06, albedo.g - albedo.b ) * smoothstep( .05, .2, albedo.r )
		* smoothstep( .24, .36, albedo.g / max( albedo.r, 1e-4 ) );
	// Coloured cloth shades to a deeper version of its own hue and only
	// white, grey and black cloth takes the full cool violet: an orange gi
	// under the violet went brick, a blue one went slate.
	float lookSat = ( max( albedo.r, max( albedo.g, albedo.b ) ) - min( albedo.r, min( albedo.g, albedo.b ) ) ) / max( max( albedo.r, max( albedo.g, albedo.b ) ), 1e-4 );
	vec3 cool = mix( uToonShadow, vec3( dot( uToonShadow, vec3( .2126, .7152, .0722 ) ) ), max( smoothstep( .35, .8, lookSat ) * .65, lookMetal * .8 ) );
	vec3 shade = mix( cool, vec3( 1.0, .78, .72 ), skin * .7 );
	// The power-up pass: a painted shade - the cloth's own colour, deeper and richer (a power of
	// its hue: an orange gi shades red-orange, skin salmon), as bright as the look's own shade by uSparkShade.z -
	// rather than one cool tint over every colour.
	if ( uSparkShade.y > 0.0 ) {
		vec3 sparkHue = albedo / max( max( albedo.r, max( albedo.g, albedo.b ) ), 1e-3 );
		vec3 sparkTint = pow( max( sparkHue, vec3( 1e-3 ) ), vec3( uSparkShade.w - 1.0 ) );
		float sparkWant = dot( albedo * shade, vec3( .2126, .7152, .0722 ) ) * uSparkShade.z;
		sparkTint *= sparkWant / max( dot( albedo * sparkTint, vec3( .2126, .7152, .0722 ) ), 1e-4 );
		shade = mix( shade, sparkTint, uSparkShade.y );
	}
	// The anime finish: the shade turned cool and saturated - the cloth's own colour with a violet-blue cast at the same
	// lightness, as a cel painter picks a shadow colour; skin keeps most of its warmth.
	if ( uRigShade.y > 0.0 ) {
		float shadeL = dot( shade, vec3( .2126, .7152, .0722 ) );
		vec3 coolShade = shade * vec3( .84, .9, 1.32 );
		coolShade *= shadeL / max( dot( coolShade, vec3( .2126, .7152, .0722 ) ), 1e-4 );
		coolShade = max( mix( vec3( shadeL ), coolShade, uRigShade.z ), 0.0 );
		shade = mix( shade, coolShade, uRigShade.y * ( 1.0 - skin * .55 ) );
	}
	vec3 tint = mix( vec3( 1.0 ), shade, toonShade * ( 1.0 - vLookHead * LOOK_FACE * .45 ) );
	reflectedLight.indirectDiffuse += ambient * uToonAmbient * tint * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;

const TOON_FINISH = /* glsl */`
{
	vec3 lookN = normalize( normal );
	vec3 lookV = normalize( vViewPosition );
	float lookNdV = saturate( dot( lookN, lookV ) );
	vec3 lookRimDir = normalize( ( viewMatrix * vec4( uRimDir, 0.0 ) ).xyz );
	// Under a technique's grade the fighters give back part of the room's
	// dimming: they are lit by the technique, not swallowed by the dark.
	outgoingLight *= 1.0 + uLookTech * .5;
	// A soft, hue-preserving clip on the fighter's own light: the brightest
	// channel eases from the knee toward the ceiling and the others keep
	// their ratio to it. A hard clip took white armour to a blown cream and
	// tipped an orange gi into salmon as its red channel saturated first.
	// The colour pass: the cast keeps the most colour in the frame.
	outgoingLight = max( mix( vec3( dot( outgoingLight, vec3( .2126, .7152, .0722 ) ) ), outgoingLight, uToonSaturation ), 0.0 );
	float lookPeak = max( max( outgoingLight.r, outgoingLight.g ), max( outgoingLight.b, 1e-4 ) );
	float lookRange = uToonClip.y - uToonClip.x;
	outgoingLight *= lookPeak > uToonClip.x ? ( uToonClip.x + lookRange * ( 1.0 - exp( - ( lookPeak - uToonClip.x ) / lookRange ) ) ) / lookPeak : 1.0;
	#ifdef LOOK_METAL
	// Steel as drawn steel (round 3c): the key's highlight as a hard cel
	// shape rather than a lobe, a pale streak across the planes turned up to
	// the sky and the dark of the ground on the ones turned down - the
	// two-tone every manga plate and blade is inked in. Only where the mask
	// says metal; cloth, leather and the cloak in the same atlas are left to
	// the cloth model.
	#ifdef LOOK_MATTE
	lookMetal = 0.0;
	#endif
	if ( lookMetal > .01 ) {
		vec3 lookH = normalize( toonKeyDir + lookV );
		float lookSpec = smoothstep( .955, .975, saturate( dot( lookN, lookH ) ) ) * toonLit;
		vec3 lookUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
		float lookFacing = dot( lookN, lookUp );
		float lookSky = smoothstep( .3, .6, lookFacing ) * ( 1.0 - smoothstep( .7, .9, lookFacing ) );
		float lookGround = 1.0 - smoothstep( -.5, -.15, lookFacing );
		outgoingLight *= 1.0 - .15 * lookGround * lookMetal;
		outgoingLight += lookMetal * ( lookSpec * min( toonKeyLight * .1, vec3( .25 ) ) + lookSky * vec3( .014, .016, .019 ) * uToonAmbient );
	}
	#endif
	// The power-up pass: muscle and armour catch the light - a cel-hard sheen where the
	// surface turns to the key, on skin (warm albedo, as the shade reads it) and on pale, colourless plate and boots;
	// cloth keeps its painted folds, and a face is never lit this way.
	if ( uSparkSpec.x > 0.0 ) {
		vec3 sparkA = diffuseColor.rgb;
		float sparkSkin = smoothstep( .04, .16, sparkA.r - sparkA.g ) * smoothstep( .01, .06, sparkA.g - sparkA.b ) * smoothstep( .05, .2, sparkA.r ) * smoothstep( .24, .36, sparkA.g / max( sparkA.r, 1e-4 ) );
		float sparkPeak = max( sparkA.r, max( sparkA.g, sparkA.b ) );
		float sparkPlate = smoothstep( .35, .6, sparkPeak ) * ( 1.0 - smoothstep( .08, .22, ( sparkPeak - min( sparkA.r, min( sparkA.g, sparkA.b ) ) ) / max( sparkPeak, 1e-3 ) ) );
		vec3 sparkH = normalize( toonKeyDir + lookV );
		float sparkNdH = saturate( dot( lookN, sparkH ) );
		float sparkSheen = smoothstep( mix( .8, .94, uSparkSpec.y ), mix( .88, .975, uSparkSpec.y ), sparkNdH ) * toonLit * max( sparkSkin, sparkPlate ) * ( 1.0 - vLookHead * LOOK_FACE ) * ( 1.0 - lookMetal );
		outgoingLight += sparkSheen * uSparkSpec.x * min( toonKeyLight, vec3( 1.2 ) ) * ( .2 + .5 * diffuseColor.rgb );
	}
	// Stream F: the folds in ink. vLookCel.y is 1 on a crease chain's
	// vertices and 0 elsewhere (look/crease.ts), so across a triangle it falls
	// away from the chain at a rate fwidth tells in pixels: (1 - x) / fwidth
	// is the distance to the chain in pixels, and a line of uCreasePx either
	// side of it is covered, filtered over the pixel. As the body shrinks on
	// screen its triangles do too; the line is never wider than a share of a
	// triangle, so it thins (and pales, below a pixel) instead of filling
	// them, and is gone once the triangles are smaller than uCreaseFade. Never
	// on a face; in the outline's own ink, with the painted ink beside it.
	{
		float lookCreaseW = max( fwidth( vLookCel.y ), 1e-4 );
		float lookCreaseHalf = min( uCreasePx, .45 / lookCreaseW );
		float lookCreaseInk = clamp( lookCreaseHalf + .5 - ( 1.0 - vLookCel.y ) / lookCreaseW, 0.0, 1.0 );
		// Not on a translucent shell (a worn Guardian, Ward's ROOM): it has no
		// ink outline either.
		lookCreaseInk *= ( 1.0 - smoothstep( uCreaseFade.x, uCreaseFade.y, lookCreaseW ) ) * ( 1.0 - vLookHead * LOOK_FACE ) * ( 1.0 - lookMetal ) * uCelCrease * step( .99, opacity );
		outgoingLight = mix( outgoingLight, uInkColor, max( lookCreaseInk, lookTexInk ) );
	}
	// The rim is a bright edge a few pixels wide just inside the ink, in the
	// rim light's colour, on the side it comes from - KoKo's coat in
	// concept 0. The width is measured in pixels: N.V over its own screen
	// derivative is roughly the distance to where N.V reaches zero, the
	// silhouette, so the edge is as thin on a sleeve as on a back, where a
	// fresnel band was a flat stripe on broad surfaces and nothing on thin
	// ones. The geometric normal, so a normal map cannot break it into grain.
	vec3 lookG = normalize( nonPerturbedNormal );
	float lookGdV = abs( dot( lookG, lookV ) );
	float lookEdgePx = lookGdV / max( fwidth( lookGdV ), 1e-4 );
	// Only where the surface really turns away: a crease facing the lens has
	// a steep derivative too, and without this every fold of a gi sparkled.
	float lookEdge = ( 1.0 - smoothstep( uRimPx * .5, uRimPx * ( 1.0 + uLookTech ), lookEdgePx ) ) * ( 1.0 - smoothstep( .18, .34, lookGdV ) );
	lookSilhouetteEdge = lookEdge;
	lookFacing = lookGdV;
	float lookSide = mix( saturate( dot( lookG, lookRimDir ) * 2.0 + .3 ), 1.0, uLookTech );
	vec3 lookRimColor = mix( uRimColor, uLookTechColor, uLookTech );
	// Kept under the bloom knee so it stays a line rather than a halo - except
	// under a technique, whose light is meant to glow off the silhouette.
	vec3 lookRim = lookRimColor * ( uRimPeak * ( 1.0 + .9 * uLookTech ) / max( max( lookRimColor.r, lookRimColor.g ), max( lookRimColor.b, 1e-4 ) ) );
	// What is left of the old broad fresnel band: a faint wash, so a dark
	// coat still separates from a dark wall between the edges.
	float lookFres = smoothstep( 1.0 - uRimWidth, 1.0 - uRimWidth + .06, 1.0 - lookNdV ) * uSparkWash;
	float lookBroad = 1.0;
	#ifdef LOOK_MATTE
	// Briar Crown round 8 (blind critic 2: Cardo's blade "reads gold, pale blue or silver"): a matte black keeps only the
	// thin edge. The wash and the rig's broad band light the whole of a flat blade turned edge-on to the lens in the rim's
	// warm colour - a pale gold plank in every swing.
	lookBroad = 0.0;
	#endif
	outgoingLight = mix( outgoingLight, max( outgoingLight, lookRim * ( .7 + .3 * diffuseColor.rgb ) ), lookFres * lookSide * lookBroad );
	outgoingLight = mix( outgoingLight, max( outgoingLight, lookRim ), lookEdge * lookSide );
	// The cutscene rig's two rims from behind (rigUniforms): warm on the key's side, cool on the other - a hard band a
	// few pixels wide inside the ink, by the same pixel measure as the edge above, and a crisp fresnel band where a broad
	// surface turns away. Half on a face.
	if ( uRig.z > 0.0 ) {
		vec2 rigOut = lookG.xy / max( length( lookG.xy ), 1e-3 );
		float rigWarm = smoothstep( -.15, .45, dot( rigOut, normalize( vec2( toonSide, .55 ) ) ) );
		float rigCool = smoothstep( .05, .55, dot( rigOut, normalize( vec2( - toonSide, .3 ) ) ) ) * ( 1.0 - rigWarm );
		float rigBand = ( 1.0 - smoothstep( uRigShade.x, uRigShade.x * 1.5 + .5, lookEdgePx ) ) * ( 1.0 - smoothstep( .3, .5, lookGdV ) );
		rigBand = max( rigBand, smoothstep( .68, .75, 1.0 - lookNdV ) * .6 * lookBroad ) * ( 1.0 - vLookHead * LOOK_FACE * .5 ) * step( .99, opacity );
		outgoingLight += ( uRigWarm * rigWarm + uRigCool * rigCool ) * uRig.z * rigBand * ( .6 + .4 * diffuseColor.rgb );
	}
	#ifdef LOOK_HAIR
	float lookBand = smoothstep( .48, .58, lookN.y ) * ( 1.0 - smoothstep( .66, .78, lookN.y ) ) * smoothstep( .45, .8, lookNdV );
	outgoingLight += lookBand * uHairSpec * uSparkSpec.z * ( .35 + toonLit * .65 ) * max( diffuseColor.rgb, vec3( .25 ) );
	#endif
}
#include <opaque_fragment>`;

/** After the fog: a fighter drawn as a silhouette (time stop, impact frame)
 *  is flat ink with its edge in white, whatever the fog or the flash did. */
const TOON_SILHOUETTE = /* glsl */`#include <fog_fragment>
	gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( lookSilhouetteEdge * uLookSilhouetteRim ), uLookSilhouette );`;
const FRAME_PARS = 'uniform float uLookTech;\nuniform vec3 uLookTechColor;\nuniform float uLookSilhouette;\nuniform float uLookSilhouetteRim;\n';
/** Stream F: the cel flattening, the painted ink and the crease ink. */
const CEL_PARS = /* glsl */`varying vec2 vLookCel;
uniform float uCelFlat;
uniform float uCelInk;
uniform float uCelCrease;
uniform float uCelArea;
uniform vec2 uCelMatch;
uniform vec2 uCelInkRange;
uniform float uCelInkReach;
uniform float uCreasePx;
uniform vec2 uCreaseFade;
uniform vec3 uInkColor;
float lookTexInk = 0.0;
vec3 lookOklab( vec3 c ) {
	vec3 lms = pow( max( vec3( dot( c, vec3( .4122214708, .5363325363, .0514459929 ) ), dot( c, vec3( .2119034982, .6806995451, .1073969566 ) ), dot( c, vec3( .0883024619, .2817188376, .6299787005 ) ) ), vec3( 0.0 ) ), vec3( 1.0 / 3.0 ) );
	return vec3( dot( lms, vec3( .2104542553, .793617785, -.0040720468 ) ), dot( lms, vec3( 1.9779984951, -2.428592205, .4505937099 ) ), dot( lms, vec3( .0259040371, .7827717662, -.808675766 ) ) );
}
`;
/** Ink is ink: pure black under a silhouette, fog or no fog. */
const INK_SILHOUETTE = '#include <fog_fragment>\n\tgl_FragColor.rgb *= 1.0 - uLookSilhouette;';

/** The key light's shadow feeds the cel edge instead of darkening the light
 *  colour, and the loop marks which light is the key. Only the directional
 *  loop is touched; three unrolls it and substitutes the index. */
const lightsBegin = () => {
  let chunk = THREE.ShaderChunk.lights_fragment_begin;
  chunk = replaceOnce(chunk, 'getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\ttoonIsKey = UNROLLED_LOOP_INDEX == 0; toonIsFill = UNROLLED_LOOP_INDEX == 1; toonShadowTerm = 1.0;', 'toon key light');
  chunk = replaceOnce(chunk, 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]',
    'toonShadowTerm = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]', 'toon key shadow');
  return chunk;
};
let LIGHTS_BEGIN: string | undefined;

/** Install the fighters' light model on one toon material. Chains with every
 *  other edit on it (crown, Will, garment floor, fox-tail clearance). */
export function applyToonShading(material: THREE.MeshToonMaterial, kind: ToonKind) {
  LIGHTS_BEGIN ??= lightsBegin();
  addShaderPatch(material, `look-toon-${kind}-v6`, shader => {
    Object.assign(shader.uniforms, toonUniforms, cookieUniforms, frameUniforms, celUniforms, sparkUniforms, rigUniforms);
    shader.uniforms.uInkColor = inkUniforms.uInkColor;
    shader.defines = { ...shader.defines, LOOK_FACE: kind === 'hair' ? '0.0' : '1.0', ...(kind === 'hair' ? { LOOK_HAIR: '' } : {}), ...(kind === 'metal' || kind === 'matte' ? { LOOK_METAL: '' } : {}), ...(kind === 'matte' ? { LOOK_MATTE: '' } : {}) };
    // lookHead: the head weight, the cel gate and the crease field (headWeights).
    shader.vertexShader = 'attribute vec3 lookHead;\nvarying float vLookHead;\nvarying vec2 vLookCel;\nvarying vec3 vLookWorld;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n\tvLookHead = lookHead.x;\n\tvLookCel = lookHead.yz;', 'toon head weight');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', 'vLookWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n#include <project_vertex>', 'toon world position');
    shader.fragmentShader = 'varying vec3 vLookWorld;\n' + COOKIE_GLSL + '\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_toon_pars_fragment>', TOON_PARS, 'toon light model');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_fragment_begin>', LIGHTS_BEGIN!, 'toon lights');
    shader.fragmentShader = 'uniform vec3 uRigWarm;\nuniform vec3 uRigCool;\nuniform vec3 uSparkSpec;\nuniform float uSparkWash;\nuniform vec3 uRimColor;\nuniform float uRimWidth;\nuniform vec3 uRimDir;\nuniform float uRimPx;\nuniform float uRimPeak;\nuniform vec2 uToonClip;\nuniform vec3 uHairSpec;\nuniform vec3 uToonFloor;\nuniform float uToonSaturation;\nuniform float uToonFlatten;\n' + FRAME_PARS + CEL_PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
	{
		#ifdef USE_MAP
		// The colour pass: a painted texture's grain and block-compression
		// noise smoothed toward the cloth's flat colour - the map a mip and a
		// half up - only where the two are close (grain), never across a
		// painted line or a colour edge (where they are far apart), and not on
		// the head, where eyes and brows are detail. Cel art is flat colour.
		// Stream F: on a fighter's body (not its face), the cel flattening and
		// the painted ink - see celUniforms.
		float lookCel = vLookCel.x * ( 1.0 - vLookHead * LOOK_FACE ) * step( 1e-4, uCelFlat + uCelInk );
		// Steel keeps its own drawing (round 3c, LOOK_METAL): its painted
		// plates and rivets are what tell one plate from the next, and inked
		// they broke into short black dashes on Gaunt's armour.
		#ifdef LOOK_METAL
		lookCel *= 1.0 - smoothstep( .15, .65, diffuseColor.a / max( opacity, 1e-3 ) );
		#endif
		if ( uToonFlatten > 0.0 || lookCel > 0.0 ) {
			vec3 lookSharp = texture2D( map, vMapUv ).rgb, lookSoft = texture2D( map, vMapUv, 1.6 ).rgb;
			float lookGrain = 1.0 - smoothstep( .05, .16, length( lookSoft - lookSharp ) );
			// The colour as the map paints it: where another edit has already
			// changed it (a Golden's crown, Will, an outfit's hair, the garment
			// floor), that edit's colour is left as it is.
			float lookPlain = 1.0 - smoothstep( .02, .08, length( diffuseColor.rgb - diffuse * lookSharp ) );
			diffuseColor.rgb = max( diffuseColor.rgb + ( lookSoft - lookSharp ) * diffuse * uToonFlatten * lookGrain * ( 1.0 - vLookHead ), 0.0 );
			if ( lookCel > 0.0 ) {
				// The flattening. The cloth's mean round the texel is the map a
				// few mips up (and wider still); where that mean is the texel's
				// own colour (OKLab a-b, so a dark texel's noisy hue does not
				// count), the texel's lightness is drawn to the mean's - linear
				// RGB scaled, so hue and saturation are kept exactly. Only where
				// the map is smooth: a painted line or an edge between parts
				// (sharp far from soft) is left as drawn, and a neighbouring part
				// of another colour (a trim, an emblem, the next UV island) is
				// never averaged in.
				vec3 lookArea = texture2D( map, vMapUv, uCelArea ).rgb, lookWide = texture2D( map, vMapUv, uCelArea + 1.5 ).rgb;
				vec2 lookAb = lookOklab( lookSoft ).yz;
				float lookMatchA = 1.0 - smoothstep( uCelMatch.x, uCelMatch.y, length( lookAb - lookOklab( lookArea ).yz ) );
				float lookMatchW = 1.0 - smoothstep( uCelMatch.x, uCelMatch.y, length( lookAb - lookOklab( lookWide ).yz ) );
				float lookTarget = mix( dot( lookArea, vec3( .2126, .7152, .0722 ) ), dot( lookWide, vec3( .2126, .7152, .0722 ) ), lookMatchW );
				// Painted shading moves a cloth's lightness by a modest factor; a
				// mean far lighter or darker than the texel is another part of
				// the same hue (a tan collar beside a brown coat, the next
				// island of the atlas), so the pull lets go of it.
				float lookRatio = lookTarget / max( dot( lookSoft, vec3( .2126, .7152, .0722 ) ), 1e-3 );
				float lookPull = uCelFlat * lookCel * max( lookMatchA, lookMatchW ) * lookGrain * lookPlain * ( 1.0 - smoothstep( .6, 1.2, abs( log( lookRatio ) ) ) );
				diffuseColor.rgb *= pow( clamp( lookRatio, .3, 3.3 ), lookPull );
				// The painted ink: a texel well darker than the paint round it
				// (relative, so a fold drawn on black cloth counts as one drawn
				// on yellow) is a line the painter drew; it is inked in the
				// finish. Measured a few mips up from where the texel is drawn,
				// so the line stays a line's width on screen at any distance.
				// The drop is measured in lightness (the cube root of luminance,
				// as the eye and OKLab weigh it), so a fold drawn on black cloth
				// counts as one drawn on yellow, while the grain of a dark,
				// noisy paint (a few levels either way) is no line at all.
				// And a fold is a darker shade of its own cloth: a dark line of
				// another colour is a pattern (Sekka's navy markings on his
				// skin, a belt's zigzag) and keeps its colour. A near-black has
				// no hue to tell by, so it counts as grey: black lines on grey
				// or black cloth are inked, a black part on coloured paint is
				// not - a mip of a patchwork atlas (Meshy's) mixes islands that
				// never meet on the body, and Shiun's black sash read as one
				// big line on his white robe.
				vec3 lookRingRgb = texture2D( map, vMapUv, uCelInkReach ).rgb;
				float lookSharpL = pow( dot( lookSharp, vec3( .2126, .7152, .0722 ) ), 1.0 / 3.0 );
				float lookDrop = pow( dot( lookRingRgb, vec3( .2126, .7152, .0722 ) ), 1.0 / 3.0 ) - lookSharpL;
				float lookSum = lookSharp.r + lookSharp.g + lookSharp.b;
				vec3 lookHue = mix( vec3( 1.0 / 3.0 ), lookSharp / max( lookSum, 1e-3 ), smoothstep( .03, .08, lookSum ) );
				float lookShade = 1.0 - smoothstep( .06, .14, length( lookHue - lookRingRgb / max( lookRingRgb.r + lookRingRgb.g + lookRingRgb.b, 1e-3 ) ) );
				// And a line is thin: a mip up it has already paled most of the
				// way to the paint round it, where a dark part (a sash, a strap)
				// is still dark - and a patchwork atlas's island, dark beside
				// light ones, is a part, not a line.
				float lookMid = pow( dot( texture2D( map, vMapUv, 1.0 ).rgb, vec3( .2126, .7152, .0722 ) ), 1.0 / 3.0 ) - lookSharpL;
				float lookThin = smoothstep( .12, .32, lookMid / max( lookDrop, 1e-3 ) );
				lookTexInk = smoothstep( uCelInkRange.x, uCelInkRange.y, lookDrop ) * lookThin * lookShade * uCelInk * lookCel * lookPlain;
			}
		}
		#endif
		float lookPeak = max( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b );
		float lookChroma = ( lookPeak - min( min( diffuseColor.r, diffuseColor.g ), diffuseColor.b ) ) / max( lookPeak, .03 );
		#ifdef USE_MAP
		vec3 lookArea = texture2D( map, vMapUv, 3.0 ).rgb * diffuse;
		float lookAreaPeak = max( max( lookArea.r, lookArea.g ), lookArea.b );
		float lookAreaChroma = ( lookAreaPeak - min( min( lookArea.r, lookArea.g ), lookArea.b ) ) / max( lookAreaPeak, .03 );
		lookChroma = mix( lookAreaChroma, lookChroma, smoothstep( .06, .16, lookPeak ) );
		#endif
		float lookNeutral = ( 1.0 - smoothstep( .2, .45, lookChroma ) ) * ( 1.0 - vLookHead );
		vec3 lookFloor = uToonFloor;
		#ifdef LOOK_METAL
		// The mask rides in the map's alpha; the material is opaque, so the
		// alpha goes nowhere else (three forces it to 1 at the end). Steel takes
		// the floor's value but not its violet.
		lookMetal = smoothstep( .15, .65, diffuseColor.a / max( opacity, 1e-3 ) );
		lookFloor = mix( uToonFloor, vec3( dot( uToonFloor, vec3( .2126, .7152, .0722 ) ) ), lookMetal );
		#endif
		#ifdef LOOK_MATTE
		// Briar Crown round 7: a matte black (Cardo's Black Snow and his wing, Svanhild's wand) takes a third of the
		// floor. At the whole of it the lit flat of the blade - the floor's grey times the stage's warm key - read
		// pale gold from the side, where the blade should read black from every side.
		lookFloor *= .35;
		#endif
		diffuseColor.rgb += lookFloor * ( 1.0 - clamp( lookPeak / .25, 0.0, 1.0 ) ) * lookNeutral;
	}`, 'toon albedo floor');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', TOON_FINISH, 'toon rim');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <fog_fragment>', TOON_SILHOUETTE, 'toon silhouette');
  });
}

/** The colour pass: the body flash. A struck body is painted toward
 *  a flat colour - `flash.value.rgb`, linear, by `flash.value.w` - over its
 *  whole surface for the frames after a blow: every hit flashes
 *  cyan-white strongly enough to replace the body's colours for four to six
 *  frames at 30 fps, which an emissive add (what this replaces, +0.4 at most)
 *  never did on a lit surface. After the fog, so a body across the arena
 *  flashes as clearly as one in the lens; before the silhouette, so an impact
 *  frame's ink still wins. The ink hull is not painted: the outline stays. One
 *  uniform object per body (Fighter.flash), shared by all of its materials. */
/** The dream loop's rim weighting of the hit flash; off with `?dreamoff` (render/dreamFlag.ts). */
const DREAM_FLASH_RIM = DREAM_IMPACT;
export function applyHitFlash(material: THREE.MeshToonMaterial, flash: { value: THREE.Vector4 }, flat: { value: number } = NO_FLAT) {
  addShaderPatch(material, 'look-hit-flash-v3', shader => {
    shader.uniforms.uHitFlash = flash; shader.uniforms.uHitFlat = flat;
    shader.fragmentShader = 'uniform vec4 uHitFlash;\nuniform float uHitFlat;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, 'gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( lookSilhouetteEdge * uLookSilhouetteRim ), uLookSilhouette );',
      `gl_FragColor.rgb = mix( gl_FragColor.rgb, uHitFlash.rgb, uHitFlash.w${DREAM_FLASH_RIM ? ' * mix( mix( .38, 1.0, uHitFlat ), 1.0, 1.0 - smoothstep( .12, .72, lookFacing ) )' : ''} );\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( lookSilhouetteEdge * uLookSilhouetteRim ), uLookSilhouette );`, 'hit flash');
  });
}
const NO_FLAT = { value: 0 };

export function applyLimbSmear(material: THREE.Material, smear: { point: { value: THREE.Vector4 }; motion: { value: THREE.Vector4 }; limb?: { value: THREE.Vector4 } }) {
  const limb = smear.limb;
  addShaderPatch(material, limb ? 'look-limb-smear-v2' : 'look-limb-smear-v1', shader => {
    shader.uniforms.uSmearPoint = smear.point; shader.uniforms.uSmearMotion = smear.motion;
    if (limb) shader.uniforms.uSmearLimb = limb;
    shader.vertexShader = (limb ? 'attribute vec4 smearLimb;\nuniform vec4 uSmearLimb;\n' : '') + 'uniform vec4 uSmearPoint;\nuniform vec4 uSmearMotion;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
	if ( uSmearMotion.w > 0.0 ) {
		vec3 smearWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
		vec3 smearFrom = smearWorld - uSmearPoint.xyz;
		float smearNear = ( 1.0 - smoothstep( uSmearPoint.w * .4, uSmearPoint.w, length( smearFrom ) ) )${limb ? ' * smoothstep( .5, 1.0, dot( smearLimb, uSmearLimb ) )' : ''};
		if ( smearNear > 0.0 ) {
			vec3 smearN = normalize( mat3( modelMatrix ) * objectNormal );
			// The trailing surface stretches; the leading one stays where it is drawn.
			float smearTrail = max( smoothstep( .2, -.6, dot( smearN, uSmearMotion.xyz ) ), smoothstep( .05, -.3, dot( smearFrom, uSmearMotion.xyz ) ) * .55 );
			vec3 smearBy = -uSmearMotion.xyz * uSmearMotion.w * smearNear * smearTrail;
			mvPosition.xyz += ( viewMatrix * vec4( smearBy, 0.0 ) ).xyz;
			gl_Position = projectionMatrix * mvPosition;
		}
	}`, 'limb smear');
  });
}

export function limbWeights(mesh: THREE.Mesh, roots: readonly (THREE.Object3D | undefined)[], held = -1) {
  const geometry = mesh.geometry, count = geometry.getAttribute('position').count, out = new Uint8Array(count * 4);
  const limbOf = (node: THREE.Object3D | null) => { for (let n = node; n; n = n.parent) { const k = roots.indexOf(n); if (k >= 0) return k; } return -1; };
  const ids = geometry.getAttribute('skinIndex'), amounts = geometry.getAttribute('skinWeight'), skin = mesh as THREE.SkinnedMesh;
  if (skin.isSkinnedMesh && ids && amounts) {
    const limbs = skin.skeleton.bones.map(limbOf), share = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      share.fill(0);
      for (let j = 0; j < 4; j++) { const k = limbs[ids.getComponent(i, j)]; if (k >= 0) share[k] += amounts.getComponent(i, j); }
      for (let k = 0; k < 4; k++) out[i * 4 + k] = Math.round(255 * Math.min(1, share[k]));
    }
  } else {
    const k = limbOf(mesh.parent);
    if (k >= 0) for (let i = 0; i < count; i++) out[i * 4 + k] = 255;
  }
  for (let k = 0; k < 4; k++) if (!roots[k] || held === k) for (let i = 0; i < count; i++) out[i * 4 + k] = 255;
  return new THREE.BufferAttribute(out, 4, true);
}

/** The ink hull at a constant screen width.
 *
 *  The hull used to be pushed out by a fixed 3 mm in view space, which is
 *  0.8 px at the normal boom and a hair at any distance - so the outline all
 *  but vanished and, with no anti-aliasing, crawled. The push is now a
 *  fraction of the viewport height at the vertex's own depth (one pixel at
 *  depth z spans 2z / P[1][1] of the view), so it reads the same at every
 *  distance and resolution, thinning a little far away the way a drawn line
 *  would. The fighter's own outlineWidth survives as a multiplier (relative
 *  to the roster's 3 mm), and the view-space depth bias that keeps
 *  zero-thickness cloth from painting shards over a hem is unchanged. The
 *  colour comes from the stage's look rather than the lighting. */
export function applyInkShell(material: THREE.MeshToonMaterial, relativeWidth: number, depthBias: number) {
  addShaderPatch(material, 'look-ink-v2', shader => {
    Object.assign(shader.uniforms, inkUniforms, frameUniforms);
    shader.uniforms.uInkTint = sparkUniforms.uInkTint;
    shader.uniforms.uInkScale = { value: relativeWidth };
    shader.vertexShader = 'uniform float uInkWidth;\nuniform float uInkScale;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
	{
		float inkDepth = max( - mvPosition.z, .05 );
		float inkPixel = 2.0 * inkDepth / projectionMatrix[ 1 ][ 1 ];
		float inkFar = mix( 1.0, .6, smoothstep( 12.0, 45.0, inkDepth ) );
		mvPosition.xyz -= normalize( transformedNormal ) * uInkWidth * uInkScale * inkPixel * inkFar;
		mvPosition.z -= ${depthBias.toFixed(4)};
		gl_Position = projectionMatrix * mvPosition;
	}`, 'ink hull');
    shader.fragmentShader = 'uniform vec3 uInkColor;\nuniform float uInkTint;\n' + FRAME_PARS + shader.fragmentShader;
    // The power-up pass: where the hull carries its body's map (Fighter), the line takes the colour of what it rings -
    // the cloth's own, deep - by uInkTint; otherwise, and at 0, the look's ink.
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', `#ifdef USE_MAP
	outgoingLight = mix( uInkColor, pow( texture2D( map, vMapUv ).rgb, vec3( 1.6 ) ) * .3, uInkTint );
#else
	outgoingLight = uInkColor;
#endif
#include <opaque_fragment>`, 'ink colour');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <fog_fragment>', INK_SILHOUETTE, 'ink silhouette');
  });
}


/** A ball match's sides on the bodies themselves: rings on the floor alone are easier to find than the fighters. A body's own `TeamTrim` - one set of
 *  uniforms per body, shared by all of its materials, as its hit flash and its threat glow are - turns its ink and its
 *  rim light toward its side's colour:
 *  - `ink` (an ink hull, or a body's own flat outline mesh): the line drawn in `inkColor` by `amount.x` - a coloured
 *    line, still a line. Installed between the ink's own patch and the lock's glow (ThreatOutline), so a locked
 *    opponent's threat colour still wins, and a silhouette frame's ink is still black.
 *  - `body` (a toon material, after applyToonShading): the stage's edge rim and its wash, and the anime finish's two rims
 *    from behind, lit in `rimColor` by `amount.y`, each at the brightness it had - the same lights in the side's hue,
 *    no new light. A technique's grade still takes the rim over. A translucent shell, which has no hull, carries its
 *    side on this rim alone.
 *  All zero, which is every body outside a ball match (render/ball/TeamTrim.ts sets them, and clears them), the
 *  shader takes neither branch: the ink and the rims exactly as they were. */
export interface TeamTrim { inkColor: { value: THREE.Color }; rimColor: { value: THREE.Color }; amount: { value: THREE.Vector2 } }
export const teamTrim = (): TeamTrim => ({ inkColor: { value: new THREE.Color(0, 0, 0) }, rimColor: { value: new THREE.Color(0, 0, 0) }, amount: { value: new THREE.Vector2(0, 0) } });
export function applyTeamTrim(material: THREE.Material, trim: TeamTrim, part: 'ink' | 'body') {
  addShaderPatch(material, `look-team-trim-${part}-v1`, shader => {
    shader.uniforms.uTrimInk = trim.inkColor; shader.uniforms.uTrimRim = trim.rimColor; shader.uniforms.uTrim = trim.amount;
    shader.fragmentShader = 'uniform vec3 uTrimInk;\nuniform vec3 uTrimRim;\nuniform vec2 uTrim;\n' + shader.fragmentShader;
    if (part === 'ink') {
      shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', 'if ( uTrim.x > 0.0 ) outgoingLight = mix( outgoingLight, uTrimInk, uTrim.x );\n#include <opaque_fragment>', 'team trim ink');
      return;
    }
    shader.fragmentShader = replaceOnce(shader.fragmentShader, 'vec3 lookRimColor = mix( uRimColor, uLookTechColor, uLookTech );',
      `vec3 lookRimColor = mix( uRimColor, uLookTechColor, uLookTech );
	// The side's trim (applyTeamTrim): the rim in the side's colour, as bright as the stage's own.
	if ( uTrim.y > 0.0 ) lookRimColor = mix( lookRimColor, uTrimRim * max( max( lookRimColor.r, lookRimColor.g ), lookRimColor.b ), uTrim.y * ( 1.0 - uLookTech ) );`, 'team trim rim');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, 'outgoingLight += ( uRigWarm * rigWarm + uRigCool * rigCool ) * uRig.z * rigBand * ( .6 + .4 * diffuseColor.rgb );',
      `vec3 rigLight = uRigWarm * rigWarm + uRigCool * rigCool;
		if ( uTrim.y > 0.0 ) rigLight = mix( rigLight, uTrimRim * max( max( rigLight.r, rigLight.g ), rigLight.b ), uTrim.y );
		outgoingLight += rigLight * uRig.z * rigBand * ( .6 + .4 * diffuseColor.rgb );`, 'team trim rig rims');
  });
}

export function applyAuthoredInk(material: THREE.MeshBasicMaterial) {
  addShaderPatch(material, 'look-authored-ink-v1', shader => {
    Object.assign(shader.uniforms, frameUniforms);
    shader.fragmentShader = FRAME_PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <fog_fragment>', INK_SILHOUETTE, 'authored ink silhouette');
  });
}
