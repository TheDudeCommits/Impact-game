import * as THREE from 'three';
import type { LookPreset } from './stageLooks';

/** The training hall's windows as a light cookie, the clouds' shadows over a sunny place, and the leaves' dappled
 *  shade over a green one, shared by the stage's materials and the fighters' toon shading through one set of
 *  uniforms.
 *
 *  Stage geometry casts no shadows (the sun map is spent on the fighters), so
 *  an interior lit by a low sun would otherwise be lit everywhere at once. A
 *  ray from each shaded point toward the sun is intersected with the window
 *  wall instead; where it passes through a window the key light arrives,
 *  anywhere else the point is in the hall's shade. That gives the concept's
 *  slanted pools of light on the floor and walls for one plane test per
 *  fragment. Off (uCookieOn = 0) on every stage that does not ask for it. */
export const cookieUniforms = {
  uCookieOn: { value: 0 },
  uCookieDir: { value: new THREE.Vector3(0, 1, 0) },
  /** axis (0 = x, 2 = z), plane coordinate, window bottom, window top. */
  uCookiePlane: { value: new THREE.Vector4(2, 0, 0, 1) },
  /** period, offset, duty, floor. */
  uCookieWindow: { value: new THREE.Vector4(1, 0, .5, 0) },
  uCookieFighters: { value: 0 },
  /** The colour pass, iteration eight: cloud shadows drifting over a sunny place (LookPreset.cloudShadows). Size of
   *  a cloud (m), cover (the noise level above which it is shade), edge softness, and the key light left under one. */
  uCloudOn: { value: 0 },
  uCloud: { value: new THREE.Vector4(30, .55, .1, .5) },
  uCloudHeight: { value: 60 },
  /** Metres a second, along x and z. */
  uCloudWind: { value: new THREE.Vector2(1.2, .8) },
  uCloudTime: { value: 0 },
  /** The fighters' share of the clouds' and the leaves' shade. */
  uCloudFighters: { value: 0 },
  /** The look plan's dappled light (LookPreset.leaves): on (1), and the third, finest scale of it (1; 0 on medium
   *  quality). Off on low quality and on every place that does not ask for it. */
  uLeafOn: { value: 0 },
  uLeafDetail: { value: 1 },
  /** A sun fleck's size (m), cover (the noise level above which it is leaf shade), edge softness, and the key light
   *  left in the leaves' shade. */
  uLeaf: { value: new THREE.Vector4(3, .5, .08, .4) },
  /** The canopy's height (m), how far it sways (m), whether it is only over `uLeafSpots` (1) or everywhere (0), and
   *  the soft edge of a spot (a share of its radii). */
  uLeafCanopy: { value: new THREE.Vector4(8, .3, 0, .3) },
  /** Where the canopy is, in its own plane: ellipses (centre x, z; radii along x, z). A zero radius is no spot. */
  uLeafSpots: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
  /** Metres a second the canopy's pattern drifts. */
  uLeafWind: { value: new THREE.Vector2(.15, .1) },
  /** How far a low sun draws the flecks out along its path (1 = round; set from the key's elevation). */
  uLeafStretch: { value: 1 },
};

export const COOKIE_GLSL = /* glsl */`
uniform float uCookieOn;
uniform vec3 uCookieDir;
uniform vec4 uCookiePlane;
uniform vec4 uCookieWindow;
uniform float uCookieFighters;
uniform float uCloudOn;
uniform vec4 uCloud;
uniform float uCloudHeight;
uniform vec2 uCloudWind;
uniform float uCloudTime;
uniform float uCloudFighters;
uniform float uLeafOn;
uniform float uLeafDetail;
uniform vec4 uLeaf;
uniform vec4 uLeafCanopy;
uniform vec4 uLeafSpots[ 6 ];
uniform vec2 uLeafWind;
uniform float uLeafStretch;
float lookCloudHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float lookCloudNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3. - 2. * f );
	return mix( mix( lookCloudHash( i ), lookCloudHash( i + vec2( 1., 0. ) ), u.x ), mix( lookCloudHash( i + vec2( 0., 1. ) ), lookCloudHash( i + vec2( 1., 1. ) ), u.x ), u.y );
}
// Where the ray from p toward the sun crosses the cloud layer, the layer drifting on the wind: shade under a cloud.
float lookClouds( vec3 p ) {
	if ( uCloudOn < .5 ) return 1.;
	float t = ( uCloudHeight - p.y ) / max( uCookieDir.y, .3 );
	vec2 at = ( p.xz + uCookieDir.xz * t - uCloudWind * uCloudTime ) / uCloud.x;
	float n = lookCloudNoise( at ) * .65 + lookCloudNoise( at * 2.07 + 13.7 ) * .35;
	return mix( 1., uCloud.w, smoothstep( uCloud.y - uCloud.z, uCloud.y + uCloud.z, n ) );
}
// The look plan's dappled light: where the ray from p toward the sun crosses the canopy, the crowns' gaps and the
// leaves' flecks - soft sun patches in the leaves' shade - swaying and drifting slowly. Only below the canopy, and
// only over its spots where it has them.
float lookLeaves( vec3 p ) {
	if ( uLeafOn < .5 ) return 1.;
	vec2 at = p.xz + uCookieDir.xz * ( max( uLeafCanopy.x - p.y, 0. ) / max( uCookieDir.y, .25 ) );
	float under = 1. - smoothstep( uLeafCanopy.x - 1.5, uLeafCanopy.x + .5, p.y );
	if ( uLeafCanopy.z > .5 ) {
		float spot = 0.;
		for ( int i = 0; i < 6; i ++ ) {
			vec4 s = uLeafSpots[ i ];
			if ( s.z > 0. ) spot = max( spot, 1. - smoothstep( 1. - uLeafCanopy.w, 1., length( ( at - s.xy ) / s.zw ) ) );
		}
		under *= spot;
	}
	if ( under < .001 ) return 1.;
	vec2 q = ( at + uLeafWind * uCloudTime + uLeafCanopy.y * vec2( sin( uCloudTime * .37 ), cos( uCloudTime * .29 ) ) ) / uLeaf.x;
	// A low sun draws each fleck out along its path, as an evening's sun patches are long.
	vec2 lookSunH = normalize( uCookieDir.xz + vec2( 1e-5 ) );
	q = vec2( dot( q, lookSunH ) / uLeafStretch, dot( q, vec2( - lookSunH.y, lookSunH.x ) ) );
	float n = lookCloudNoise( q * .31 + 5.3 ) * .5 + lookCloudNoise( q + 1.7 ) * .32;
	n += uLeafDetail > .5 ? lookCloudNoise( q * 2.13 + 9.1 ) * .18 : .09;
	return mix( 1., uLeaf.w, smoothstep( uLeaf.y - uLeaf.z, uLeaf.y + uLeaf.z, n ) * under );
}
// The sky's and the trees' shade over a place.
float lookCloud( vec3 p ) { return lookClouds( p ) * lookLeaves( p ); }
float lookWindow( vec3 p ) {
	if ( uCookieOn < .5 ) return 1.;
	bool alongX = uCookiePlane.x < 1.;
	float coord = alongX ? p.x : p.z;
	float dirAxis = alongX ? uCookieDir.x : uCookieDir.z;
	float t = ( uCookiePlane.y - coord ) / ( abs( dirAxis ) > 1e-4 ? dirAxis : 1e-4 );
	if ( t <= 0. ) return 1.;
	vec3 hit = p + uCookieDir * t;
	float across = alongX ? hit.z : hit.x;
	float band = smoothstep( uCookiePlane.z - .12, uCookiePlane.z + .12, hit.y ) * ( 1. - smoothstep( uCookiePlane.w - .12, uCookiePlane.w + .12, hit.y ) );
	float f = fract( ( across - uCookieWindow.y ) / uCookieWindow.x );
	float soft = .035;
	float open = smoothstep( 0., soft, f ) * ( 1. - smoothstep( uCookieWindow.z - soft, uCookieWindow.z, f ) );
	return mix( uCookieWindow.w, 1., band * open );
}
float lookCookie( vec3 p ) { return lookWindow( p ) * lookCloud( p ); }`;

/** The dappled light's quality: high draws all three scales of it, medium two, low none. */
let leafQuality: 'high' | 'medium' | 'low' = 'high';
let current: LookPreset | undefined;
export function setCookieQuality(quality: 'high' | 'medium' | 'low') { leafQuality = quality; if (current) setCookieLook(current); }

export function setCookieLook(look: LookPreset) {
  current = look;
  const c = look.cookie, u = cookieUniforms;
  u.uCookieOn.value = c ? 1 : 0;
  u.uCookieDir.value.set(...look.key.dir).normalize();
  // Every look sets the clouds and the leaves, so a stage without them (a rift, the lake) never inherits the last one's.
  const k = look.cloudShadows, leaves = leafQuality !== 'low' ? look.leaves : undefined;
  u.uCloudOn.value = k ? 1 : 0;
  if (k) {
    u.uCloud.value.set(k.scale, k.cover, k.soft, k.floor);
    u.uCloudHeight.value = k.height ?? 60;
    u.uCloudWind.value.set(k.wind[0], k.wind[1]);
  }
  u.uLeafOn.value = leaves ? 1 : 0;
  u.uLeafDetail.value = leafQuality === 'high' ? 1 : 0;
  if (leaves) {
    u.uLeaf.value.set(leaves.size, leaves.cover, leaves.soft, leaves.floor);
    const spots = leaves.spots ?? [];
    u.uLeafCanopy.value.set(leaves.height, leaves.sway ?? .3, spots.length ? 1 : 0, leaves.edge ?? .3);
    u.uLeafSpots.value.forEach((v, i) => { const s = spots[i]; if (s) v.set(s[0], s[1], s[2], s[3] ?? s[2]); else v.set(0, 0, 0, 0); });
    u.uLeafWind.value.set(...(leaves.wind ?? [.15, .1]));
    // Half-way to the true 1/sin(elevation): a 15 degree sun draws the flecks out 2.4 times, a noon sun not at all.
    const up = u.uCookieDir.value.y;
    u.uLeafStretch.value = 1 + (1 / Math.max(up, .2) - 1) * .5;
  }
  // The fighters' share of the shade overhead: the clouds' where there are clouds, else the leaves'.
  u.uCloudFighters.value = k ? k.fighters : leaves?.fighters ?? 0;
  if (!c) return;
  u.uCookiePlane.value.set(c.axis, c.plane, c.bottom, c.top);
  u.uCookieWindow.value.set(c.period, c.offset, c.duty, c.floor);
  u.uCookieFighters.value = c.fighters;
}
/** The clouds' clock (seconds): GameRenderer moves it every frame. */
export function setCloudTime(seconds: number) { cookieUniforms.uCloudTime.value = seconds; }
