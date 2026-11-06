import * as THREE from 'three';
import type { AirLook, LookPreset } from './stageLooks';

/** The air: haze that lies on the distance from just behind the fight (the look plan, stream C).
 *
 *  Each layer of distant scenery should read paler and bluer than the one in front of it, from a few metres
 *  past the fighters. three's linear fog cannot do that: it ramps by smoothstep from `near` to `far`, so with the pass's
 *  near of 22-30 m and far of 300-520 m it laid 3% of its colour on scenery 50 m out and 19% at 100 m - the
 *  distance read as sharp and as saturated as the fight.
 *
 *  So the fog chunk every fogged material shares is reshaped, once, for the whole renderer:
 *  - the air's optical depth grows from `start` metres off the lens, true distance rather than view depth, so it
 *    does not shift as the camera turns;
 *  - it can thin with height above a base (a valley's mist, a cloud sea under a floating platform), integrated
 *    along the ray in closed form;
 *  - its colour is its own (the stage's fog colour unless the look names one: a dusk's air can be lavender under
 *    an orange horizon), warmed toward the sun's on the sun's side (in-scatter);
 *  - the distance loses saturation under it (aerial perspective: contrast and saturation fall off with depth,
 *    done here per fragment, where the true depth is, rather than in a post pass);
 *  - the stage's own linear fog still runs on top, in the fog colour that meets the painted horizon, so distant
 *    scenery fades out before the far plane cuts it.
 *
 *  The fighters (every MeshToonMaterial: the cast, their ink hulls, thrown debris) take their own, gentler share,
 *  so a body across a royale reads against the hazed scenery behind it and a fighter 5-15 m from the lens is
 *  untouched.
 *
 *  The uniforms reach every material through three's own tables: Float32Array values are shared, not cloned,
 *  when three copies a ShaderLib's uniforms for a new material, so one write per stage change reaches every
 *  program. A material whose uniforms lack them (a ShaderMaterial built without UniformsLib.fog) reads zeros, and
 *  zero is the stock fog. A look without `air` (a rift, the lake, Last Stand's places) writes zeros too. */

/** amount (0 = the stock fog), start (m), density (1/m), the most it lays (0..1). */
const STAGE_AIR = new Float32Array(4);
/** The same for the fighters, by their share. */
const FIGHTER_AIR = new Float32Array(4);
/** base height (m), scale height (m; 0 = even), desaturation (0..1), the sun's share of the colour (0..1). */
const SHAPE = new Float32Array(4);
/** toward the sun (unit xyz), and how tightly its warmth gathers round it (a cosine power). */
const SUN = new Float32Array([0, 1, 0, 8]);
/** The air's own colour, and its colour on the sun's side, linear. */
const COLOR = new Float32Array(3);
const SUN_COLOR = new Float32Array(3);

export const airUniforms = {
  uAirFog: { value: STAGE_AIR },
  uAirShape: { value: SHAPE },
  uAirSun: { value: SUN },
  uAirColor: { value: COLOR },
  uAirSunColor: { value: SUN_COLOR },
};

const PARS_VERTEX = /* glsl */`
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vAirRay;
#endif
`;
const VERTEX = /* glsl */`
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	// The lens-to-point ray in world space (the view matrix's rotation, transposed): its length is the true
	// distance, its height the climb.
	vAirRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif
`;
const PARS_FRAGMENT = /* glsl */`
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vAirRay;
	uniform vec4 uAirFog;
	uniform vec4 uAirShape;
	uniform vec4 uAirSun;
	uniform vec3 uAirColor;
	uniform vec3 uAirSunColor;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;
export const AIR_FRAGMENT = /* glsl */`
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	if ( uAirFog.x > 0.0 ) {
		float airDistance = length( vAirRay );
		float airDepth = uAirFog.z * max( airDistance - uAirFog.y, 0.0 );
		if ( uAirShape.y > 0.0 ) {
			// Thinner with height: the mean of exp(-h/H) between the lens's height and the point's.
			float airFrom = max( cameraPosition.y - uAirShape.x, 0.0 ) / uAirShape.y;
			float airTo = max( cameraPosition.y + vAirRay.y - uAirShape.x, 0.0 ) / uAirShape.y;
			airDepth *= abs( airTo - airFrom ) > 1e-3 ? ( exp( - airFrom ) - exp( - airTo ) ) / ( airTo - airFrom ) : exp( - airFrom );
		}
		float air = uAirFog.x * uAirFog.w * ( 1.0 - exp( - airDepth ) );
		vec3 airColor = uAirColor;
		if ( uAirShape.w > 0.0 ) airColor = mix( uAirColor, uAirSunColor, uAirShape.w * pow( max( dot( vAirRay, uAirSun.xyz ) / max( airDistance, 1e-4 ), 0.0 ), uAirSun.w ) );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( dot( gl_FragColor.rgb, vec3( .2126, .7152, .0722 ) ) ), air * uAirShape.z );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, airColor, air );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

let installed = false;
/** Reshape three's fog chunks and hand every fogged material the air's uniforms. Idempotent; runs on import. */
export function installAir() {
  if (installed) return;
  installed = true;
  THREE.ShaderChunk.fog_pars_vertex = PARS_VERTEX;
  THREE.ShaderChunk.fog_vertex = VERTEX;
  THREE.ShaderChunk.fog_pars_fragment = PARS_FRAGMENT;
  THREE.ShaderChunk.fog_fragment = AIR_FRAGMENT;
  for (const [name, lib] of Object.entries(THREE.ShaderLib) as [string, { uniforms: Record<string, THREE.IUniform> }][]) {
    if (!lib.uniforms || !('fogColor' in lib.uniforms)) continue;
    Object.assign(lib.uniforms, airUniforms);
    // The fighters' toon materials: their own share.
    if (name === 'toon') lib.uniforms.uAirFog = { value: FIGHTER_AIR };
  }
  // ShaderMaterials built later from UniformsLib.fog (the places' falls, foam, puffs) take it too.
  Object.assign(THREE.UniformsLib.fog, airUniforms);
}
installAir();

/** The air's quality: 'low' keeps the haze and drops its shaping (height, the sun's side, the colour loss). */
let quality: 'high' | 'medium' | 'low' = 'high';
let current: LookPreset | undefined;
export function setAirQuality(next: 'high' | 'medium' | 'low') { quality = next; if (current) setAirLook(current); }

const scratch = new THREE.Color();
/** Copy a look's air into the shared uniforms; zeros (the stock fog) when it has none. */
export function setAirLook(look: LookPreset) {
  current = look;
  const a = look.air;
  if (!a) { STAGE_AIR.fill(0); FIGHTER_AIR.fill(0); SHAPE.fill(0); return; }
  const density = Math.LN2 / Math.max(1, a.half);
  STAGE_AIR.set([1, a.start, density, a.most]);
  FIGHTER_AIR.set([a.fighters, a.start, density, a.most]);
  const shaped = quality !== 'low';
  SHAPE.set([a.base ?? 0, shaped && a.height ? a.height / Math.LN2 : 0, shaped ? a.desaturate ?? 0 : 0, shaped && a.sun ? a.sun.amount : 0]);
  // Round the sun as it is drawn, where the sky draws it somewhere else than the key light comes from.
  const d = look.sky.sunDir ?? look.key.dir, l = Math.hypot(d[0], d[1], d[2]) || 1;
  SUN.set([d[0] / l, d[1] / l, d[2] / l, a.sun?.power ?? 6]);
  scratch.setHex(a.color ?? look.fog.color);
  COLOR.set([scratch.r, scratch.g, scratch.b]);
  scratch.setHex(a.sun?.color ?? a.color ?? look.fog.color);
  SUN_COLOR.set([scratch.r, scratch.g, scratch.b]);
}

/** How much of its colour the air lays at `distance` metres from the lens - the shader's, on level ground (no
 *  height term) - on the place's surfaces, or with `fighter` on the fighters. */
export function airAt(air: AirLook, distance: number, fighter = false) {
  const depth = Math.LN2 / Math.max(1, air.half) * Math.max(distance - air.start, 0);
  return (fighter ? air.fighters : 1) * air.most * (1 - Math.exp(-depth));
}
