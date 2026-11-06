import * as THREE from 'three';

/**
 * A painted panorama behind a battle royale place (Round 4b, MAPS) - the Last
 * Stand village's painted dusk is the bar. Drawn the way the look's own sky
 * is (look/SkyDome.ts): one triangle over the whole screen, its direction per
 * pixel from the camera, so it is never clipped by the far plane, never
 * reached however far the lens swings, and costs only the pixels the sky is
 * seen in. It sits a hair in front of the look's sky and draws just before
 * it, so the look's sky is rejected wherever the painting is, while the look's
 * sky still lights the stage (its image light is rendered from it alone).
 *
 * The picture is an equirectangular 2:1 panorama (scripts/build_br_skies.py)
 * with its horizon at the middle. A slow drift turns it a little over a match.
 */
export interface PaintedSkyOptions {
  /** Turn of the panorama, radians: where its middle faces. */
  rotation?: number;
  /** Multiplies the painting (linear), for the stage's exposure. */
  exposure?: number;
  /** A tint multiplied in (sRGB hex). */
  tint?: number;
  /** Radians a second the clouds drift round. */
  drift?: number;
  /** Lifts (+) or lowers the painted horizon, as a share of the half sphere. */
  horizon?: number;
}

export class PaintedSky {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly drift: number;
  private readonly turn: number;

  constructor(map: THREE.Texture, options: PaintedSkyOptions = {}) {
    map.colorSpace = THREE.SRGBColorSpace;
    // The painting is magnified on screen everywhere (2048 texels round 360
    // degrees), so it needs no mipmaps - and an equirectangular lookup with
    // them shows a seam where the longitude wraps.
    map.generateMipmaps = false; map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter;
    map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping;
    this.turn = options.rotation ?? 0; this.drift = options.drift ?? .0012;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const material = new THREE.ShaderMaterial({
      name: 'PaintedSky',
      uniforms: {
        uMap: { value: map }, uTurn: { value: this.turn / (Math.PI * 2) },
        uExposure: { value: options.exposure ?? 1 }, uTint: { value: new THREE.Color(options.tint ?? 0xffffff) },
        uHorizon: { value: options.horizon ?? 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vec4 view = inverse( projectionMatrix ) * vec4( position.xy, 1.0, 1.0 );
          vDir = transpose( mat3( viewMatrix ) ) * ( view.xyz / view.w );
          gl_Position = vec4( position.xy, .99998, 1.0 );
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        uniform float uTurn, uExposure, uHorizon;
        uniform vec3 uTint;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize( vDir );
          float u = atan( d.x, -d.z ) * .15915494 + .5 + uTurn;
          float v = clamp( ( asin( clamp( d.y, -1., 1. ) ) * .63661977 - uHorizon ) * .5 + .5, .002, .998 );
          vec3 colour = texture2D( uMap, vec2( u, v ) ).rgb * uTint * uExposure;
          gl_FragColor = vec4( colour, 1. );
        }`,
      depthWrite: true, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Painted sky';
    this.mesh.frustumCulled = false;
    // Just before the look's sky (1,000,000): it is drawn last of the opaque
    // things, over only what nothing else covered.
    this.mesh.renderOrder = 999_999;
  }

  static async load(url: string, options: PaintedSkyOptions = {}) {
    const map = await new THREE.TextureLoader().loadAsync(url);
    return new PaintedSky(map, options);
  }

  update(time: number) {
    this.mesh.material.uniforms.uTurn.value = (this.turn + time * this.drift) / (Math.PI * 2);
  }
}
