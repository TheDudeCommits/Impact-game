import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { filmOn } from './filmLook';

/**
 * THE PAINTED SET: the film look's stage, painted by hand.
 *
 * A 1980s production shot its figures as cels over backgrounds painted by hand in gouache: flat, crisp, inked bodies over
 * a softer world of brush patches. Impact's stages are drawn in 3D; here, in the film look, the scene pass draws that
 * difference in one frame:
 *   1. the set alone, into a picture of its own drawn once a pixel (it is painted over: multisampling it was spent), its
 *      depth kept (the bodies' contact shadows in its ground; the sun's shadow map drawn in the same call with the bodies
 *      and the effects in it, so their shadows fall on the set as they always did);
 *   2. that picture re-painted at a fraction of its size by a soft-weighted (generalised) Kuwahara filter - each point
 *      takes the colour of the calmest of four patches round it, blended by how calm each is, so it holds still under a
 *      moving lens instead of flickering - with the strokes turning slowly across the canvas;
 *   3. the painting laid over the frame with the set's depth (a darker rim of pigment where one patch meets the next, the
 *      paper's tooth and the wash of a big brush, the set's own dark detail painted back), then the bodies and every
 *      effect drawn crisp over it, multisampled, depth-tested against the set as drawn in 1 - one draw call of the scene.
 *      The frame's multisampled buffers are written once a frame, as without the look (stored, loaded again and resolved
 *      twice, they were most of the look's cost on a sharp screen).
 * Every body and effect is drawn once; the set's ink lines come after, from the depth, in the final pass (LookPost.ts
 * reelInk). Off in the modern look, on a split screen, at LOW quality (a phone's) and when PAINT.on is false
 * (`?paint=0`): then it is three's RenderPass.
 */
export const PAINT = {
  on: (() => { try { return new URLSearchParams(location.search).get('paint') !== '0'; } catch { return true; } })(),
  /** The brush: the patch's reach in the half-size picture (px at 1080p) and how hard the calmest patch wins (the soft
   *  weighting's power: higher is closer to the classic, blockier filter). */
  radius: 2.6, sharpness: 8,
  /** The painting's size, of the frame's, per quality (GameRenderer.applySettings): HIGH half, MEDIUM a little under;
   *  the radius above stays in half-size pixels at 1080p, so a patch is the same size on screen either way. */
  scale: .5, scaleMedium: .4,
  /** ...and never more than this many pixels tall: a sharp screen (a 4K monitor, a Retina laptop at HIGH's 1.5 pixels a
   *  point) paints no finer than a 1440p one - the patches are the same size on screen, only their soft edges are a
   *  little softer, and the set's own detail is painted back from the whole-size picture anyway. */
  maxHeight: 720,
  /** The paint's own saturation. */
  saturation: 1.02,
  /** Pigment pooling at a patch's edge (a darker rim), the paper's tooth, the wash of a big brush. */
  edge: .45, tooth: .1, wash: .08,
  /** The set's own dark detail (cracks, seams, the edge of a stone) laid back over the wash as painted strokes, and how
   *  much of its light detail; 0 a pure wash. */
  detail: .8, lightDetail: .25,
  /** (for measuring) skip the bodies' and effects' draw: wrong alone. */
  debugRedraw: true,
};

const VERT = /* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const NOISE = /* glsl */`
float ph( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float pn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
	return mix( mix( ph( i ), ph( i + vec2( 1., 0. ) ), f.x ), mix( ph( i + vec2( 0., 1. ) ), ph( i + vec2( 1. ) ), f.x ), f.y ); }
float pfbm( vec2 p ) { return pn( p ) * .5 + pn( p * 2.03 + 7.1 ) * .3 + pn( p * 4.01 + 3.3 ) * .2; }
float plum( vec3 c ) { return dot( c, vec3( .2126, .7152, .0722 ) ); }`;

/** Pass 2a: the half-size painting of the set (linear HDR in, linear HDR out). */
const PAINT_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uRes; uniform vec2 uSrcRes; uniform float uRadius; uniform float uSharp; uniform float uSat;
varying vec2 vUv;
${NOISE}
// statistics in a compressed space (c / (1 + c)), so a bright sky or a hot spark does not swamp a patch's spread
vec3 squash( vec3 c ) { c = max( c, 0. ); return c / ( 1. + c ); }
vec3 unsquash( vec3 s ) { s = min( s, vec3( .995 ) ); return s / ( 1. - s ); }
vec3 tapAt( vec2 p ) { return squash( texture2D( tSrc, p ).rgb ); }
// one tap to each of the four patches, with its square for the spread
void add4( inout vec3 m[ 4 ], inout vec3 v[ 4 ], vec3 c0, vec3 c1, vec3 c2, vec3 c3 ) {
	m[ 0 ] += c0; v[ 0 ] += c0 * c0; m[ 1 ] += c1; v[ 1 ] += c1 * c1;
	m[ 2 ] += c2; v[ 2 ] += c2 * c2; m[ 3 ] += c3; v[ 3 ] += c3 * c3;
}
void main() {
	float sc = uRes.y / 540.;
	vec2 px = 1. / uRes;
	// the strokes turn slowly across the canvas (a field of angles, broad, in screen space)
	float ang = ( pn( vUv * vec2( uRes.x / uRes.y, 1. ) * 3.2 ) - .5 ) * 2.2;
	mat2 rot = mat2( cos( ang ), - sin( ang ), sin( ang ), cos( ang ) );
	float R = uRadius * sc;
	vec3 m[ 4 ]; vec3 v[ 4 ];
	for ( int q = 0; q < 4; q ++ ) { m[ q ] = vec3( 0. ); v[ q ] = vec3( 0. ); }
	// four overlapping patches (quadrants of a disc), 3 x 3 taps each less the corner past the disc. Each point is read
	// once: the centre is all four patches' and every tap on an axis is two neighbouring patches' (a patch's row (i, 0) is
	// the next one's column (0, i)), so 21 reads where there were 32, given to each patch in the order it always summed them.
	float A = .5 * R, B = R;
	vec3 ctr = tapAt( vUv );
	vec3 e1 = tapAt( vUv + rot * vec2( A, 0. ) * px ), n1 = tapAt( vUv + rot * vec2( 0., A ) * px );
	vec3 w1 = tapAt( vUv - rot * vec2( A, 0. ) * px ), s1 = tapAt( vUv + rot * vec2( 0., - A ) * px );
	vec3 e2 = tapAt( vUv + rot * vec2( B, 0. ) * px ), n2 = tapAt( vUv + rot * vec2( 0., B ) * px );
	vec3 w2 = tapAt( vUv - rot * vec2( B, 0. ) * px ), s2 = tapAt( vUv + rot * vec2( 0., - B ) * px );
	add4( m, v, ctr, ctr, ctr, ctr );
	add4( m, v, e1, n1, w1, s1 );
	add4( m, v, e2, n2, w2, s2 );
	add4( m, v, n1, w1, s1, e1 );
	add4( m, v, tapAt( vUv + rot * vec2( A, A ) * px ), tapAt( vUv + rot * vec2( - A, A ) * px ), tapAt( vUv - rot * vec2( A, A ) * px ), tapAt( vUv + rot * vec2( A, - A ) * px ) );
	add4( m, v, tapAt( vUv + rot * vec2( B, A ) * px ), tapAt( vUv + rot * vec2( - A, B ) * px ), tapAt( vUv - rot * vec2( B, A ) * px ), tapAt( vUv + rot * vec2( A, - B ) * px ) );
	add4( m, v, n2, w2, s2, e2 );
	add4( m, v, tapAt( vUv + rot * vec2( A, B ) * px ), tapAt( vUv + rot * vec2( - B, A ) * px ), tapAt( vUv - rot * vec2( A, B ) * px ), tapAt( vUv + rot * vec2( B, - A ) * px ) );
	// the generalised Kuwahara's soft choice: each patch weighted by how calm it is (Papari et al. 2007)
	vec3 sum = vec3( 0. ); float wsum = 0.;
	float n = 8.;
	for ( int q = 0; q < 4; q ++ ) {
		vec3 mu = m[ q ] / n;
		vec3 va = abs( v[ q ] / n - mu * mu );
		float s = ( va.r + va.g + va.b ) * 60.;
		float w = 1. / ( 1. + pow( s, uSharp * .5 ) );
		sum += mu * w; wsum += w;
	}
	vec3 c = unsquash( sum / max( wsum, 1e-5 ) );
	float l = plum( c );
	c = max( mix( vec3( l ), c, uSat ), 0. );
	gl_FragColor = vec4( c, 1. );
}`;

/** Pass 2b: the painting laid over the frame at full size (no depth written: the set's depth from pass 1 stays). */
const LAY_FRAG = /* glsl */`
uniform sampler2D tPaint; uniform sampler2D tPaper; uniform sampler2D tOrig; uniform sampler2D tSetDepth; uniform vec2 uRes; uniform vec2 uPaintRes; uniform float uEdge; uniform float uTooth; uniform float uWash;
uniform float uDetail; uniform float uLightDetail;
varying vec2 vUv;
${NOISE}
void main() {
	vec3 c = texture2D( tPaint, vUv ).rgb;
	// pigment pools where one patch meets the next: a darker rim along the painting's own edges
	vec2 t = 1.5 / uPaintRes;
	vec3 n = texture2D( tPaint, vUv + vec2( 0., t.y ) ).rgb, s = texture2D( tPaint, vUv - vec2( 0., t.y ) ).rgb;
	vec3 e = texture2D( tPaint, vUv + vec2( t.x, 0. ) ).rgb, w = texture2D( tPaint, vUv - vec2( t.x, 0. ) ).rgb;
	float lc = plum( c / ( 1. + c ) );
	float grad = abs( plum( n / ( 1. + n ) ) - plum( s / ( 1. + s ) ) ) + abs( plum( e / ( 1. + e ) ) - plum( w / ( 1. + w ) ) );
	float darker = max( 0., ( plum( n / ( 1. + n ) ) + plum( s / ( 1. + s ) ) + plum( e / ( 1. + e ) ) + plum( w / ( 1. + w ) ) ) * .25 - lc );
	c *= 1. - uEdge * smoothstep( .015, .12, grad ) * ( .35 + .65 * smoothstep( 0., .04, darker ) );
	// the paper: its tooth (fine) and the wash of a big brush (broad), at the screen's own scale
	float sc = uRes.y / 1080.;
	vec2 fc = vUv * uRes / sc;
	float tooth = texture2D( tPaper, fc / ( 2.4 * 128. ) ).r - .5;
	float wash = texture2D( tPaper, vUv * vec2( uRes.x / uRes.y, 1. ) * 2.6 / 16. + .37 ).g - .5;
	c *= 1. + tooth * uTooth + wash * uWash * 2.;
	// The set's own structure painted back: where the drawing is darker than its surroundings (a crack, a seam, the
	// shadowed edge of a stone) a dark stroke, where lighter a little light; the wash between is the painting's
	if ( uDetail > 0. ) {
		vec2 p1 = 1.4 / uRes;
		vec3 o = texture2D( tOrig, vUv ).rgb;
		vec3 ob = ( texture2D( tOrig, vUv + vec2( p1.x, 0. ) ).rgb + texture2D( tOrig, vUv - vec2( p1.x, 0. ) ).rgb
			+ texture2D( tOrig, vUv + vec2( 0., p1.y ) ).rgb + texture2D( tOrig, vUv - vec2( 0., p1.y ) ).rgb ) * .25;
		float dl = plum( o / ( 1. + o ) ) - plum( ob / ( 1. + ob ) );
		c *= 1. + clamp( dl, -.25, 0. ) * uDetail * 3.2 + clamp( dl, 0., .2 ) * uLightDetail * 2.;
	}
	// the set's own depth, as drawn in 1, so the bodies and the effects drawn next are hidden behind it where they should be
	gl_FragDepth = texture2D( tSetDepth, vUv ).r;
	gl_FragColor = vec4( c, 1. );
}`;

/** The paper, made once: a tiling 128 x 128 texture, its red channel the tooth (an fbm a few pixels across), its green the
 *  wash of a big brush (an fbm the whole tile across, read stretched). */
function paperTexture(): THREE.DataTexture {
  const N = 128, data = new Uint8Array(N * N * 4);
  const hash = (x: number, y: number, s: number) => { const h = Math.sin((((x % N) + N) % N) * 127.1 + (((y % N) + N) % N) * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x: number, y: number, period: number, s: number) => {
    const fx = x / N * period, fy = y / N * period, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), w = (a: number) => ((a % period) + period) % period * (N / period);
    const a = hash(w(ix), w(iy), s), b = hash(w(ix + 1), w(iy), s), c = hash(w(ix), w(iy + 1), s), d = hash(w(ix + 1), w(iy + 1), s);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tooth = noise(x, y, 53, 1) * .5 + noise(x, y, 107, 2) * .3 + noise(x, y, 128, 3) * .2;
    const wash = noise(x, y, 4, 4) * .55 + noise(x, y, 8, 5) * .3 + noise(x, y, 16, 6) * .15;
    const i = (y * N + x) * 4; data[i] = tooth * 255; data[i + 1] = wash * 255; data[i + 2] = 0; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/** The painting a quality draws (GameRenderer.applySettings): HIGH's, MEDIUM's smaller one, or none (LOW, a phone's; a
 *  crowd fight on a machine that has no time to spare). */
export type PaintTier = 'off' | 'medium' | 'high';

export class PaintedScenePass extends Pass {
  /** As three's RenderPass: clear the target first. */
  clear = true;
  /** Off for a split screen (GameRenderer sets it): the painting is laid over the whole target. */
  allowed = true;
  tier: PaintTier = 'high';
  /** The tier the quality gives, before a phone's or a tablet's ladder took its painting step (mobileLadder.ts 'paint'):
   *  the targets are made for it with the room (compile), so the step given back in a fight allocates nothing. */
  preset: PaintTier = 'high';
  private readonly paintRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly paintMat = new THREE.ShaderMaterial({ name: 'FilmPaint', vertexShader: VERT, fragmentShader: PAINT_FRAG, depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1, 1) }, uSrcRes: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: PAINT.radius }, uSharp: { value: PAINT.sharpness }, uSat: { value: PAINT.saturation } } });
  /** The set as drawn in 1: its colour (painted from, its detail read back) and its depth (laid into the frame with the
   *  painting). Made on the first painted frame in the frame's own colour format, never on a phone (LOW draws no painting). */
  private setRT: THREE.WebGLRenderTarget | null = null;
  private readonly layMat = new THREE.ShaderMaterial({ name: 'FilmLay', vertexShader: VERT, fragmentShader: LAY_FRAG,
    depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true,
    uniforms: { tPaint: { value: this.paintRT.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uPaintRes: { value: new THREE.Vector2(1, 1) },
      uEdge: { value: PAINT.edge }, uTooth: { value: PAINT.tooth }, uWash: { value: PAINT.wash }, tPaper: { value: paperTexture() },
      tOrig: { value: null as THREE.Texture | null }, tSetDepth: { value: null as THREE.Texture | null }, uDetail: { value: PAINT.detail }, uLightDetail: { value: PAINT.lightDetail } } });
  private readonly paintQuad = new FullScreenQuad(this.paintMat);
  /** The painting laid over the frame as the first thing the bodies' draw puts down: the whole frame, drawn before
   *  anything else in it, writing no depth (the set's stays for the bodies to be tested against). */
  private readonly layMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.layMat);
  private readonly set: THREE.Object3D[] = [];
  private readonly fx: THREE.Object3D[] = [];
  /** The bodies' parts (a fighter's children but its contact shadow) and their contact shadows (painted into the
   *  ground with the set, not laid on twice). */
  private readonly parts: THREE.Object3D[] = [];
  private readonly feet: THREE.Object3D[] = [];
  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.Camera, private readonly isSet: (o: THREE.Object3D) => boolean) {
    super();
    // As three's RenderPass: the scene lands in the read buffer, which the next pass reads (no swap).
    this.needsSwap = false;
    this.paintRT.texture.name = 'FilmPaint';
    this.layMesh.name = 'film-lay'; this.layMesh.frustumCulled = false; this.layMesh.renderOrder = -1e9; this.layMesh.matrixAutoUpdate = false;
  }
  private readonly full = new THREE.Vector2(1, 1);
  private paintScale = 0;
  setSize(width: number, height: number) {
    this.full.set(width, height);
    this.layMat.uniforms.uRes.value.set(width, height);
    this.paintScale = 0;
    this.setRT?.setSize(Math.max(1, width), Math.max(1, height));
  }
  /** The set's own target, in the frame's colour format (the composer's: packed 11-11-10 where the GPU can draw into it). */
  private setTarget(frame: THREE.WebGLRenderTarget) {
    const t = frame.texture, w = Math.max(1, this.full.x), h = Math.max(1, this.full.y);
    if (this.setRT && (this.setRT.texture.type !== t.type || this.setRT.texture.format !== t.format)) { this.setRT.dispose(); this.setRT.depthTexture?.dispose(); this.setRT = null; }
    if (!this.setRT) {
      this.setRT = new THREE.WebGLRenderTarget(w, h, { type: t.type, format: t.format as THREE.PixelFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) });
      this.setRT.texture.name = 'FilmSet';
      this.layMat.uniforms.tOrig.value = this.setRT.texture; this.layMat.uniforms.tSetDepth.value = this.setRT.depthTexture;
    } else if (this.setRT.width !== w || this.setRT.height !== h) this.setRT.setSize(w, h);
    return this.setRT;
  }
  private sizePaint(scale: number) {
    const w = Math.max(1, Math.round(this.full.x * scale)), h = Math.max(1, Math.round(this.full.y * scale));
    this.paintRT.setSize(w, h);
    this.paintMat.uniforms.uRes.value.set(w, h); this.paintMat.uniforms.uSrcRes.value.copy(this.full);
    this.layMat.uniforms.uPaintRes.value.set(w, h);
    this.paintScale = scale;
  }
  /** The scene's top-level things sorted for this frame: the set (painted), the effects and the bodies (drawn once, over
   *  it); lights and empty holders are left in both draws. */
  private sort() {
    this.set.length = 0; this.fx.length = 0; this.parts.length = 0; this.feet.length = 0;
    for (const o of this.scene.children) {
      if (!o.visible) continue;
      if (o.name.startsWith('fighter-')) { for (const c of o.children) if (c.visible) (c.name === 'contact-shadow' ? this.feet : this.parts).push(c); continue; }
      if ((o as THREE.Light).isLight) continue;
      if (o.children.length === 0 && !(o as THREE.Mesh).isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine && !(o as THREE.Sprite).isSprite) continue;
      (this.isSet(o) ? this.set : this.fx).push(o);
    }
  }
  private static shown(list: readonly THREE.Object3D[], on: boolean) { for (let i = 0; i < list.length; i++) list[i].visible = on; }
  render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    const target = this.renderToScreen ? null : readBuffer;
    if (!filmOn() || !PAINT.on || !this.allowed || !target || this.tier === 'off') {
      renderer.setRenderTarget(target);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      renderer.render(this.scene, this.camera);
      renderer.autoClear = autoClear;
      return;
    }
    const setRT = this.setTarget(target);
    const scene = this.scene, maps = renderer.shadowMap, drawShadows = maps.render, shadows = maps.autoUpdate, background = scene.background;
    const matrices = scene.matrixWorldAutoUpdate;
    this.sort();
    const { fx, parts, set, feet } = this, shown = PaintedScenePass.shown;
    // The scene's matrices worked out once, with everything shown, before anything is put away: the game's matrix pass
    // leaves hidden things alone (hiddenMatrices.ts), so a horde or an effect hidden for 1 would keep its last frame's
    // place in its shadow and in 3. Neither draw below walks them again.
    if (matrices) scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
    try {
      // 1. the set alone. The sun's shadow map is drawn inside the same call, after three has listed what the camera
      //    draws and before it draws it: the bodies and the effects are shown for that alone, so their shadows fall on
      //    the set (and on each other in 3) as they always did.
      renderer.setRenderTarget(setRT); renderer.clear(true, true, true);
      shown(fx, false); shown(parts, false);
      maps.render = (lights, s, c) => { shown(fx, true); shown(parts, true); try { drawShadows.call(maps, lights, s, c); } finally { shown(fx, false); shown(parts, false); } };
      try { renderer.render(scene, this.camera); }
      finally { maps.render = drawShadows; shown(fx, true); shown(parts, true); }
      // 2. painted at a fraction of the size
      const scale = Math.min(this.tier === 'medium' ? PAINT.scaleMedium : PAINT.scale, PAINT.maxHeight / Math.max(1, this.full.y));
      if (scale !== this.paintScale) this.sizePaint(scale);
      const p = this.paintMat.uniforms, l = this.layMat.uniforms;
      p.tSrc.value = setRT.texture; p.uRadius.value = PAINT.radius; p.uSharp.value = PAINT.sharpness; p.uSat.value = PAINT.saturation;
      l.uEdge.value = PAINT.edge; l.uTooth.value = PAINT.tooth; l.uWash.value = PAINT.wash; l.uDetail.value = PAINT.detail; l.uLightDetail.value = PAINT.lightDetail;
      renderer.setRenderTarget(this.paintRT); this.paintQuad.render(renderer);
      renderer.setRenderTarget(target);
      if (this.clear) renderer.clear(true, true, true);
      if (!PAINT.debugRedraw) return;
      // 3. the painting laid over the frame, then the bodies and the effects, crisp, over it - one draw: the set put
      //    away, the sun's shadows as drawn in 1, and no background (a colour background clears the target on every draw)
      maps.autoUpdate = false; scene.background = null;
      shown(set, false); shown(feet, false);
      scene.add(this.layMesh);
      try { renderer.render(scene, this.camera); }
      finally { scene.remove(this.layMesh); shown(set, true); shown(feet, true); maps.autoUpdate = shadows; scene.background = background; }
    } finally {
      scene.matrixWorldAutoUpdate = matrices;
      renderer.autoClear = autoClear;
    }
  }
  /** The pass's programs linked with the room's (GameRenderer.compilePost: a fight's first frame would link them), each
   *  against the kind of target it draws into, and its two targets made at the frame's size (a fight's first painted
   *  frame would allocate them). */
  compile(renderer: THREE.WebGLRenderer, camera: THREE.Camera, frame: THREE.WebGLRenderTarget) {
    const previous = renderer.getRenderTarget();
    const mesh = (quad: FullScreenQuad) => (quad as unknown as { _mesh: THREE.Mesh })._mesh;
    try {
      if (filmOn() && PAINT.on && this.preset !== 'off') {
        this.sizePaint(Math.min(this.preset === 'medium' ? PAINT.scaleMedium : PAINT.scale, PAINT.maxHeight / Math.max(1, this.full.y)));
        renderer.initRenderTarget(this.paintRT); renderer.initRenderTarget(this.setTarget(frame));
      }
      renderer.setRenderTarget(this.paintRT); renderer.compile(mesh(this.paintQuad), camera);
      renderer.setRenderTarget(frame); renderer.compile(this.layMesh, camera);
    } finally { renderer.setRenderTarget(previous); }
  }
  dispose() { this.paintRT.dispose(); this.paintMat.dispose(); this.layMat.dispose(); this.paintQuad.dispose(); this.setRT?.depthTexture?.dispose(); this.setRT?.dispose(); this.layMesh.geometry.dispose(); }
}
