/** The upscale to the screen's own pixels: sharp on big screens. HIGH caps the scene at 1.5 pixels a CSS pixel and the governor holds a share of that, so on a 2x screen a
 *  desktop drew about 60% of the screen's pixels each way and the browser stretched the canvas bilinearly: the ink lines
 *  and the grain went soft. Now the canvas holds the screen's pixels, the final pass draws the frame at the scene's size
 *  into a target of its own, and this pass takes it to the screen with an edge-adaptive filter - AMD FidelityFX Super
 *  Resolution 1's EASU (MIT licence; the algorithm as published, written here with exact texel reads): twelve taps, a
 *  Lanczos-2 shaped kernel stretched along the local edge, clamped to the four nearest so it never rings. The film
 *  grain stays the final pass's, drawn at the scene's pixels and upscaled with the frame: drawn here at the screen's
 *  (UPSCALE.screenGrain) it cost as much again as the filter at 4K, for a finer grain than the look was approved with.
 *  At one scene pixel a screen pixel the final pass draws to the screen as before and this pass is skipped. */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERTEX = /* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;

/** screenGrain: the film grain drawn after the upscale at the screen's pixels (true) or in the final pass at the scene's,
 *  upscaled with the frame (false). flat: the four nearest's luma spread (the filter's 0..2 luma) under which a pixel is
 *  blended bilinearly and the filter's other eight reads are skipped - at 48/255 the ink lines and silhouettes look as
 *  the whole filter draws them, the grain and the fills as the browser's stretch did, at half the filter's cost (4K on
 *  the M4 under load: 1.2 ms a frame, against 2.4-2.6 for the whole filter everywhere). */
export const UPSCALE = { screenGrain: false, flat: 48 / 255 };

export const UPSCALE_FRAGMENT = /* glsl */`
// The filter's arithmetic in half precision (twice the rate on Apple's GPUs, and exact enough for 8-bit colour); the
// pixel positions and the hashes in full (a 4K screen's coordinates do not fit half precision).
precision mediump float;
uniform mediump sampler2D tSrc;
uniform highp vec2 uSrc, uDst;
uniform highp float uGrain, uTime, uReelStep24;
// The four nearest's luma spread (0..2, the filter's own luma) under which the blend is plain bilinear.
uniform mediump float uFlat;
uniform highp vec4 uReelA, uReelD;
varying vec2 vUv;

highp float hash12( highp vec2 p ) { highp vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float reelVnoise( highp vec2 p ) {
	highp vec2 i = floor( p ); vec2 f = fract( p ); f = f * f * ( 3. - 2. * f );
	float a = hash12( i ), b = hash12( i + vec2( 1., 0. ) ), c = hash12( i + vec2( 0., 1. ) ), d = hash12( i + vec2( 1., 1. ) );
	return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
float luma( vec3 c ) { return dot( c, vec3( .2126, .7152, .0722 ) ); }

vec3 easuTap( ivec2 p, ivec2 hi ) { return texelFetch( tSrc, clamp( p, ivec2( 0 ), hi ), 0 ).rgb; }
// The direction and the edge's length, from the '+' round one of the four nearest (a above, b left, c it, d right, e below).
void easuSet( inout vec2 dir, inout float len, float w, float lA, float lB, float lC, float lD, float lE ) {
	float lenX = max( abs( lD - lC ), abs( lC - lB ) ), dirX = lD - lB;
	dir.x += dirX * w; lenX = clamp( abs( dirX ) / max( lenX, 1e-5 ), 0., 1. ); len += lenX * lenX * w;
	float lenY = max( abs( lE - lC ), abs( lC - lA ) ), dirY = lE - lA;
	dir.y += dirY * w; lenY = clamp( abs( dirY ) / max( lenY, 1e-5 ), 0., 1. ); len += lenY * lenY * w;
}
// One tap: its offset turned into the edge's frame and stretched, weighed by the windowed Lanczos-2 approximation.
void easuTapF( inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len, float lob, float clp, vec3 c ) {
	vec2 v = vec2( dot( off, dir ), dot( off, vec2( -dir.y, dir.x ) ) ) * len;
	float d2 = min( dot( v, v ), clp );
	float wB = .4 * d2 - 1., wA = lob * d2 - 1.;
	wB *= wB; wA *= wA; wB = 1.5625 * wB - .5625;
	float w = wB * wA;
	aC += c * w; aW += w;
}

void main() {
	highp vec2 at = gl_FragCoord.xy * ( uSrc / uDst ) - .5, fp = floor( at );
	vec2 pp = at - fp;
	ivec2 o = ivec2( fp ), hi = ivec2( uSrc ) - 1;
	// The four nearest first: where they are all but flat (the painted fills, the sky, the grain's own grain), a plain
	// bilinear blend of them - what the browser's stretch drew - and the filter's other eight reads are not made. An
	// edge (an ink line, a silhouette) takes the whole filter.
	vec3 fC = easuTap( o, hi ), gC = easuTap( o + ivec2( 1, 0 ), hi ), jC = easuTap( o + ivec2( 0, 1 ), hi ), kC = easuTap( o + ivec2( 1, 1 ), hi );
	float fL = fC.g + .5 * ( fC.r + fC.b ), gL = gC.g + .5 * ( gC.r + gC.b ), jL = jC.g + .5 * ( jC.r + jC.b ), kL = kC.g + .5 * ( kC.r + kC.b );
	vec3 c;
	if ( max( max( fL, gL ), max( jL, kL ) ) - min( min( fL, gL ), min( jL, kL ) ) < uFlat ) c = mix( mix( fC, gC, pp.x ), mix( jC, kC, pp.x ), pp.y );
	else {
	//    b c
	//  e f g h
	//  i j k l
	//    n o
	vec3 bC = easuTap( o + ivec2( 0, -1 ), hi ), cC = easuTap( o + ivec2( 1, -1 ), hi );
	vec3 eC = easuTap( o + ivec2( -1, 0 ), hi ), hC = easuTap( o + ivec2( 2, 0 ), hi );
	vec3 iC = easuTap( o + ivec2( -1, 1 ), hi ), lC = easuTap( o + ivec2( 2, 1 ), hi );
	vec3 nC = easuTap( o + ivec2( 0, 2 ), hi ), oC = easuTap( o + ivec2( 1, 2 ), hi );
	float bL = bC.g + .5 * ( bC.r + bC.b ), cL = cC.g + .5 * ( cC.r + cC.b ), eL = eC.g + .5 * ( eC.r + eC.b );
	float hL = hC.g + .5 * ( hC.r + hC.b ), iL = iC.g + .5 * ( iC.r + iC.b );
	float lL = lC.g + .5 * ( lC.r + lC.b ), nL = nC.g + .5 * ( nC.r + nC.b ), oL = oC.g + .5 * ( oC.r + oC.b );
	vec2 dir = vec2( 0. ); float len = 0.;
	easuSet( dir, len, ( 1. - pp.x ) * ( 1. - pp.y ), bL, eL, fL, gL, jL );
	easuSet( dir, len, pp.x * ( 1. - pp.y ), cL, fL, gL, hL, kL );
	easuSet( dir, len, ( 1. - pp.x ) * pp.y, fL, iL, jL, kL, nL );
	easuSet( dir, len, pp.x * pp.y, gL, jL, kL, lL, oL );
	vec2 dir2 = dir * dir; float dirR = dir2.x + dir2.y; bool zro = dirR < 1. / 32768.;
	dirR = zro ? 1. : inversesqrt( dirR ); dir.x = zro ? 1. : dir.x; dir *= dirR;
	len = len * .5; len *= len;
	float stretch = dot( dir, dir ) / max( abs( dir.x ), abs( dir.y ) );
	vec2 len2 = vec2( 1. + ( stretch - 1. ) * len, 1. - .5 * len );
	float lob = .5 - .29 * len, clp = 1. / lob;
	vec3 min4 = min( min( fC, gC ), min( jC, kC ) ), max4 = max( max( fC, gC ), max( jC, kC ) );
	vec3 aC = vec3( 0. ); float aW = 0.;
	easuTapF( aC, aW, vec2( 0., -1. ) - pp, dir, len2, lob, clp, bC );
	easuTapF( aC, aW, vec2( 1., -1. ) - pp, dir, len2, lob, clp, cC );
	easuTapF( aC, aW, vec2( -1., 1. ) - pp, dir, len2, lob, clp, iC );
	easuTapF( aC, aW, vec2( 0., 1. ) - pp, dir, len2, lob, clp, jC );
	easuTapF( aC, aW, vec2( 0., 0. ) - pp, dir, len2, lob, clp, fC );
	easuTapF( aC, aW, vec2( -1., 0. ) - pp, dir, len2, lob, clp, eC );
	easuTapF( aC, aW, vec2( 1., 1. ) - pp, dir, len2, lob, clp, kC );
	easuTapF( aC, aW, vec2( 2., 1. ) - pp, dir, len2, lob, clp, lC );
	easuTapF( aC, aW, vec2( 2., 0. ) - pp, dir, len2, lob, clp, hC );
	easuTapF( aC, aW, vec2( 1., 0. ) - pp, dir, len2, lob, clp, gC );
	easuTapF( aC, aW, vec2( 1., 2. ) - pp, dir, len2, lob, clp, oC );
	easuTapF( aC, aW, vec2( 0., 2. ) - pp, dir, len2, lob, clp, nC );
	c = min( max4, max( min4, aC / aW ) );
	}
	if ( uGrain > .5 ) {
		// The film look's grain (LookFinalPass's, moved here when the frame is upscaled): the same soft clumps, uReelD.x
		// scene pixels wide (so the same size on the screen), drawn at the screen's pixels.
		highp float s24 = uReelStep24;
		highp vec2 gq = gl_FragCoord.xy / max( uReelD.x * uDst.y / uSrc.y, .5 );
		highp vec2 o1 = vec2( s24 * 7.31, s24 * 3.17 ), o2 = vec2( s24 * 1.93, s24 * 5.41 + 11. );
		float g = ( reelVnoise( gq + o1 ) - .5 ) * 1.6 + ( reelVnoise( gq * 1.9 + o2 ) - .5 ) * .9 + ( hash12( gl_FragCoord.xy + o1 * 13. ) - .5 ) * .45;
		vec3 gc = vec3( reelVnoise( gq + o1 + 17.3 ), reelVnoise( gq + o2 + 31.7 ), reelVnoise( gq * 1.3 + o1 + 5.9 ) ) - .5;
		c += ( vec3( g ) * vec3( 1., .95, 1.05 ) + gc * 1.6 * uReelD.y ) * uReelA.w * ( 1. - abs( luma( c ) * 2. - 1. ) * .55 );
	}
	c += ( hash12( gl_FragCoord.xy + fract( uTime * 7.13 ) * 97. ) - .5 ) / 255.;
	gl_FragColor = vec4( c, 1. );
}`;

/** The upscale's pass: `render` takes a frame the scene's size to the screen. Its grain uniforms are the final pass's
 *  own objects (shared, so the film clock and the grain's settings reach both). */
export class ScreenUpscale {
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly dst = new THREE.Vector2();
  constructor(shared: { uTime: THREE.IUniform; uReelStep24: THREE.IUniform; uReelA: THREE.IUniform; uReelD: THREE.IUniform }) {
    this.uniforms = { tSrc: { value: null }, uSrc: { value: new THREE.Vector2(1, 1) }, uDst: { value: new THREE.Vector2(1, 1) }, uGrain: { value: 0 }, uFlat: { value: UPSCALE.flat }, ...shared };
    this.material = new THREE.ShaderMaterial({ name: 'LookUpscale', uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: UPSCALE_FRAGMENT, depthTest: false, depthWrite: false, toneMapped: false });
    this.quad = new FullScreenQuad(this.material);
  }
  /** `frame` (the scene's size, display-encoded) to the screen; `grain` draws the film grain here. */
  render(renderer: THREE.WebGLRenderer, frame: THREE.WebGLRenderTarget, grain: boolean) {
    renderer.getDrawingBufferSize(this.dst);
    const u = this.uniforms;
    u.tSrc.value = frame.texture; (u.uSrc.value as THREE.Vector2).set(frame.width, frame.height); (u.uDst.value as THREE.Vector2).copy(this.dst);
    u.uGrain.value = grain ? 1 : 0; u.uFlat.value = UPSCALE.flat;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }
  compile(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    const mesh = (this.quad as unknown as { _mesh: THREE.Mesh })._mesh, previous = renderer.getRenderTarget();
    try { renderer.setRenderTarget(null); renderer.compile(mesh, camera); } finally { renderer.setRenderTarget(previous); }
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}
