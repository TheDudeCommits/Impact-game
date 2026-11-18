import * as THREE from 'three';
import type { StageDefinition } from '../../game/stages';

/**
 * The film look's far view (look/filmLook.ts): painted cards round the horizon - a ring of six painted ranges with a
 * farther, paler four behind their gaps, and six cloud towers above them, each a gouache painting on a magenta key
 * (public/assets/film-far). They stand behind everything the stage builds: drawn among the transparent things
 * with the depth test on and no depth written, they only show where the sky is (the painted sky dome writes no
 * depth). Sized for a 900 m far plane and scaled down with a stage's own, so each keeps its angle on screen.
 */
const VERT = /* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FRAG = /* glsl */`
uniform sampler2D map; uniform float uHaze; uniform vec3 uFog;
varying vec2 vUv;
void main() {
	vec4 t = texture2D( map, vUv );
	// 1 on the key colour, low on the painted pinks and violets
	float mg = min( t.r, t.b ) - t.g;
	float a = 1. - smoothstep( .36, .6, mg );
	// the card's own border feathered, so a cropped painting never shows a straight edge
	vec2 e = smoothstep( vec2( 0. ), vec2( .04 ), vUv ) * smoothstep( vec2( 0. ), vec2( .04 ), 1. - vUv );
	a *= e.x * e.y;
	if ( a < .01 ) discard;
	vec3 c = t.rgb;
	float spill = max( 0., mg - .1 ) * ( 1. - a );
	c.r -= spill; c.b -= spill;
	c = mix( c, uFog, uHaze );
	gl_FragColor = vec4( c, a );
	#include <colorspace_fragment>
}`;

export class PaintedFarView {
  readonly group = new THREE.Group();
  private readonly loader = new THREE.TextureLoader();
  private textures: Record<string, THREE.Texture> = {};
  private readonly fog = { value: new THREE.Color(0xe3a69e) };
  private built = false;
  private stageScale = 1;
  constructor(scene: THREE.Scene) {
    this.group.name = 'film-far-view';
    this.group.visible = false;
    scene.add(this.group);
  }
  private tex(name: string) {
    let t = this.textures[name];
    if (!t) {
      t = this.loader.load(`/assets/film-far/${name}.jpg`);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4;
      this.textures[name] = t;
    }
    return t;
  }
  private card(name: string, aspect: number, az: number, r: number, width: number, bottom: number, flip: boolean, haze: number, order: number) {
    const k = this.stageScale, h = width / aspect;
    const material = new THREE.ShaderMaterial({
      name: 'FilmCard', vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: true, depthWrite: false,
      side: THREE.DoubleSide, fog: false, toneMapped: false,
      uniforms: { map: { value: this.tex(name) }, uHaze: { value: haze }, uFog: this.fog },
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width * k, h * k), material);
    m.position.set(Math.sin(az) * r * k, (bottom + h / 2) * k, -Math.cos(az) * r * k);
    m.lookAt(0, m.position.y, 0); if (flip) m.scale.x = -1;
    m.renderOrder = order; m.frustumCulled = false; m.name = `film-card-${name}`;
    this.group.add(m);
  }
  private build() {
    for (const child of [...this.group.children]) { const m = child as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); this.group.remove(m); }
    // (radius, width, bottom in metres, the haze toward the air's colour, the draw order)
    for (let i = 0; i < 6; i++) this.card('peaks_a', 1792 / 1024, (i / 6) * Math.PI * 2 + .35, 520, 560, -127, i % 2 === 1, .22, -6);
    for (let i = 1; i <= 4; i++) this.card('peaks_a', 1792 / 1024, (i / 6) * Math.PI * 2 + .35 + Math.PI / 6, 600, 560, -185, i % 2 === 0, .5, -6.5);
    const towers: [string, number, number, number, number, number, boolean][] = [
      ['cloud_a', 1536 / 1152, -.25, 760, 520, 20, false], ['cloud_b', 1792 / 1024, .75, 720, 620, 40, false], ['cloud_a', 1536 / 1152, 1.9, 780, 440, 60, true],
      ['cloud_b', 1792 / 1024, 2.9, 740, 560, 10, true], ['cloud_a', 1536 / 1152, 3.9, 760, 600, 0, false], ['cloud_b', 1792 / 1024, 5.0, 720, 520, 70, false],
    ];
    for (const [name, aspect, az, r, w, bottom, flip] of towers) this.card(name, aspect, az, r, w, bottom, flip, .12, -8);
    this.built = true;
  }
  /** A stage's far view: the ring scaled to its far plane (it is laid out for about 800 m of view). */
  setStage(stage: StageDefinition) {
    const scale = Math.min(1, stage.cameraFar * .9 / 800);
    if (scale !== this.stageScale || !this.built) { this.stageScale = scale; if (this.group.visible) this.build(); else this.built = false; }
  }
  set visible(on: boolean) { if (on && !this.built) this.build(); this.group.visible = on; }
  get visible() { return this.group.visible; }
  /** The air the far cards sink into: the stage look's fog colour. */
  setAir(color: THREE.Color) { this.fog.value.copy(color); }
}
