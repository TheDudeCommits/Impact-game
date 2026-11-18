import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * THE FILM LOOK'S PAINTED FREEZE (look/filmLook.ts; a harmony freeze, one of the sakuga moments): the knockout that ends a round holds its drawing, re-painted
 * as the hand-painted still that closed a scene in 1980s TV anime, for a second, the lens creeping in on the blow, then
 * the fight is shown again (it ran on underneath). The painting: broad
 * patches of paint on the set (a Kuwahara filter, its strokes turning across the canvas), finer ones round the blow so
 * the bodies keep their drawing and ink, their colour pushed richer and the set's paler, a vignette onto the blow, and
 * the canvas's weave, tooth and the wash of a big brush. The print's grain still runs over it. Taken from the finished
 * frame (display colours), so it is the picture as the player saw it.
 */
const VERT = /* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const NOISE = /* glsl */`
float hh( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
	return mix( mix( hh( i ), hh( i + vec2( 1., 0. ) ), f.x ), mix( hh( i + vec2( 0., 1. ) ), hh( i + vec2( 1. ) ), f.x ), f.y ); }
float fbm2( vec2 p ) { return vn( p ) * .5 + vn( p * 2.03 + 7.1 ) * .3 + vn( p * 4.01 + 3.3 ) * .2; }
float lum( vec3 c ) { return dot( c, vec3( .2126, .7152, .0722 ) ); }`;
const PAINT = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uSeed; uniform vec2 uFocus;
varying vec2 vUv;
${NOISE}
vec3 kuwahara( vec2 uv, float R, float ang ) {
	vec2 px = 1. / uRes;
	vec3 m0 = vec3( 0. ), m1 = vec3( 0. ), m2 = vec3( 0. ), m3 = vec3( 0. ), v0 = vec3( 0. ), v1 = vec3( 0. ), v2 = vec3( 0. ), v3 = vec3( 0. );
	mat2 rot = mat2( cos( ang ), - sin( ang ), sin( ang ), cos( ang ) );
	for ( int j = 0; j < 5; j ++ ) for ( int i = 0; i < 5; i ++ ) {
		vec2 o = vec2( float( i ), float( j ) ) / 4. * R;
		vec3 c;
		c = texture2D( tSrc, uv + rot * o * px ).rgb; m0 += c; v0 += c * c;
		c = texture2D( tSrc, uv + rot * vec2( - o.x, o.y ) * px ).rgb; m1 += c; v1 += c * c;
		c = texture2D( tSrc, uv - rot * o * px ).rgb; m2 += c; v2 += c * c;
		c = texture2D( tSrc, uv + rot * vec2( o.x, - o.y ) * px ).rgb; m3 += c; v3 += c * c;
	}
	m0 /= 25.; m1 /= 25.; m2 /= 25.; m3 /= 25.;
	vec3 s = abs( v0 / 25. - m0 * m0 ); float best = s.r + s.g + s.b; vec3 col = m0;
	s = abs( v1 / 25. - m1 * m1 ); if ( s.r + s.g + s.b < best ) { best = s.r + s.g + s.b; col = m1; }
	s = abs( v2 / 25. - m2 * m2 ); if ( s.r + s.g + s.b < best ) { best = s.r + s.g + s.b; col = m2; }
	s = abs( v3 / 25. - m3 * m3 ); if ( s.r + s.g + s.b < best ) { col = m3; }
	return col;
}
void main() {
	float sc = uRes.y / 1080.;
	vec2 fc = vUv * uRes / sc;
	float ang = ( vn( vUv * uRes / ( 90. * sc ) + uSeed ) - .5 ) * 1.6;
	// how near the blow this point is: the bodies there keep finer patches, their ink and a richer colour
	float r = length( ( vUv - uFocus ) * vec2( uRes.x / uRes.y, 1. ) );
	float near = 1. - smoothstep( .12, .36, r );
	vec3 o0 = texture2D( tSrc, vUv ).rgb;
	vec3 col = kuwahara( vUv, mix( 9., 3.5, near ) * sc, ang );
	if ( lum( o0 ) < lum( col ) * .5 ) col = mix( col, o0, .9 * near );
	float l = lum( col );
	col = mix( vec3( l ), col, mix( 1.0, 1.25, near ) );
	// the darks lifted into a coloured shade (a painter never uses black for cloth), the set washed toward the paper
	col = col * .92 + vec3( .03, .022, .045 );
	col = mix( col, vec3( .9, .83, .82 ), .1 * ( 1. - near ) );
	col *= 1. - .22 * smoothstep( .38, 1.1, r );
	// canvas: a weave and a tooth, and the wash of a big brush
	float weave = sin( fc.x * 1.9 ) * sin( fc.y * 1.9 ) * .5;
	float tooth = fbm2( fc / 2.2 ) - .5;
	float wash = fbm2( vUv * uRes / ( 160. * sc ) + uSeed * 3. ) - .5;
	col *= 1. + weave * .035 + tooth * .1 + wash * .08;
	gl_FragColor = vec4( clamp( col, 0., 1. ), 1. );
}`;
const HOLD = /* glsl */`
uniform sampler2D tSrc; uniform float uZoom; uniform vec2 uFocus; uniform float uStep; uniform vec2 uRes; uniform float uGrain;
varying vec2 vUv;
${NOISE}
void main() {
	vec3 c = texture2D( tSrc, ( vUv - uFocus ) / uZoom + uFocus ).rgb;
	vec2 gq = gl_FragCoord.xy / ( 1.8 * max( 1., uRes.y / 1080. ) );
	float g = ( vn( gq + vec2( uStep * 7.31, uStep * 3.17 ) ) - .5 ) * 1.6 + ( vn( gq * 1.9 + vec2( uStep * 1.93, uStep * 5.41 + 11. ) ) - .5 ) * .9;
	c += g * uGrain * ( 1. - abs( lum( c ) * 2. - 1. ) * .55 );
	gl_FragColor = vec4( c, 1. );
}`;

/** How long the painting holds (s) and how far the lens creeps in on it. */
export const FREEZE = { seconds: 1.15, zoom: .07, grain: .06 };

export class PaintedFreeze {
  private grab: THREE.FramebufferTexture | null = null;
  private paint: THREE.WebGLRenderTarget | null = null;
  private readonly paintMat = new THREE.ShaderMaterial({ name: 'FilmPaint', vertexShader: VERT, fragmentShader: PAINT, depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1, 1) }, uSeed: { value: 0 }, uFocus: { value: new THREE.Vector2(.5, .5) } } });
  private readonly holdMat = new THREE.ShaderMaterial({ name: 'FilmHold', vertexShader: VERT, fragmentShader: HOLD, depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null as THREE.Texture | null }, uZoom: { value: 1 }, uFocus: { value: new THREE.Vector2(.5, .5) }, uStep: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrain: { value: FREEZE.grain } } });
  private readonly paintQuad = new FullScreenQuad(this.paintMat);
  private readonly holdQuad = new FullScreenQuad(this.holdMat);
  private readonly size = new THREE.Vector2();
  /** When the painting was made (renderer seconds), -1 while none is held. */
  private since = -1;
  get holding() { return this.since >= 0; }
  /** Paint the frame just drawn on the canvas (call straight after it is drawn), focused on `focus` (uv). */
  capture(renderer: THREE.WebGLRenderer, time: number, focus: THREE.Vector2) {
    renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.floor(this.size.x)), h = Math.max(1, Math.floor(this.size.y));
    if (!this.grab || this.grab.image.width !== w || this.grab.image.height !== h) {
      this.grab?.dispose(); this.paint?.dispose();
      this.grab = new THREE.FramebufferTexture(w, h);
      this.paint = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
    }
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(null);
    renderer.copyFramebufferToTexture(this.grab);
    const u = this.paintMat.uniforms;
    u.tSrc.value = this.grab; u.uRes.value.set(w, h); u.uSeed.value = (time * 7.31) % 97; u.uFocus.value.copy(focus);
    renderer.setRenderTarget(this.paint); this.paintQuad.render(renderer);
    renderer.setRenderTarget(was);
    const k = this.holdMat.uniforms;
    k.tSrc.value = this.paint!.texture; k.uFocus.value.copy(focus); k.uRes.value.set(w, h);
    this.since = time;
  }
  /** Draw the held painting in place of the frame; false once the hold is over (the frame is then drawn as usual). */
  draw(renderer: THREE.WebGLRenderer, time: number): boolean {
    if (this.since < 0) return false;
    const t = time - this.since;
    if (t > FREEZE.seconds || t < 0) { this.since = -1; return false; }
    const k = Math.min(1, t / FREEZE.seconds), u = this.holdMat.uniforms;
    u.uZoom.value = 1 + FREEZE.zoom * k * (2 - k);
    u.uStep.value = Math.floor(time * 24) % 997;
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(null); this.holdQuad.render(renderer); renderer.setRenderTarget(was);
    return true;
  }
  cancel() { this.since = -1; }
  /** Its two programs linked with the room's (GameRenderer.compilePost): a knockout's frame would link them otherwise. */
  compile(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    const previous = renderer.getRenderTarget(), probe = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const mesh = (quad: FullScreenQuad) => (quad as unknown as { _mesh: THREE.Mesh })._mesh;
    try {
      renderer.setRenderTarget(probe); renderer.compile(mesh(this.paintQuad), camera);
      renderer.setRenderTarget(null); renderer.compile(mesh(this.holdQuad), camera);
    } finally { renderer.setRenderTarget(previous); probe.dispose(); }
  }
}
