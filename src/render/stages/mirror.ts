import * as THREE from 'three';
import type { DressContext } from './dressing';

/**
 * Round 2 of the stages (24 October 2026): a polished floor's reflections of
 * the bright things over it - a stadium's screens and floods in its ring, a
 * city's signs in its wet street - at the cost of a few draws, with no second
 * render of the scene.
 *
 * Each source mesh is drawn again mirrored in the floor's plane, after the
 * floor itself and before everything else (renderOrder), with the depth test
 * turned round (GreaterDepth): a mirrored fragment lies below the plane, so
 * it passes only where the floor in the depth buffer is in front of it - on
 * the floor, never on the sky past it, and never where the joints between
 * slabs (another material, drawn later) are. The fighters, drawn after, cover
 * it where they stand. Its light is added, faded by the Fresnel term of the
 * floor point the ray crosses (a glossy floor mirrors most at a grazing look
 * and little straight down), by how far below the plane the mirrored point
 * lies (a gloss, not a mirror: a tall screen's top reflects faint and soft),
 * and by a polish that varies over the floor.
 *
 * What it costs: one draw per source mesh, an unlit fragment per covered
 * pixel. The fighters are not mirrored (they would need their skinned meshes
 * drawn twice); the reflections are soft enough that nothing is missed.
 */
export interface MirrorSource {
  mesh: THREE.Mesh;
  /** The map the source draws; unset, its material's own. */
  map?: THREE.Texture | null;
  /** Linear colour multiplier on top of the map (the source's own brightness). */
  tint?: THREE.ColorRepresentation;
  strength?: number;
  /** Screens that turn between their two frames every ten seconds (v halves swapped). */
  cycle?: boolean;
  /** The LED bands scroll along u. */
  scroll?: number;
  /** Fade the reflection toward the edges of the source's picture, a share of it (0..0.5): a glossy floor blurs a
   *  screen's outline, and the quad's own hard edge read as an overlay plane. `cells` pictures stacked in v. */
  edge?: { u: number; v: number; cells?: number };
}

export interface MirrorOptions {
  /** The floor's meshes: drawn first, so the reflections test against them alone. */
  floor: readonly THREE.Mesh[];
  /** The plane's height. */
  y?: number;
  /** The whole reflection's strength (0..1 of the source's light at a full Fresnel). */
  strength: number;
  /** The floor's reflectance looked at straight down (Fresnel F0). */
  f0?: number;
  /** Metres below the plane over which a reflection falls to a third. */
  fade: number;
  /** Mip bias on the source's map: its blur. */
  blur?: number;
  /** The polish's patches: their size (m) and how much they vary the reflection (0..1). */
  polish?: { size: number; amount: number };
  /** Only within this half-extent of the plane's origin (x, z), the rest culled. */
  extent?: [number, number];
  /** The streak's step down the source's picture (uv), at the plane; 0 none. */
  smear?: number;
}

const VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = /* glsl */`
  uniform sampler2D map; uniform vec3 uTint; uniform float uStrength; uniform float uF0; uniform float uFade; uniform float uBlur;
  uniform float uY; uniform vec2 uPolish; uniform vec2 uExtent; uniform float uTime; uniform float uCycle; uniform float uScroll;
  uniform vec3 uEdge; uniform float uSmear;
  varying vec2 vUv; varying vec3 vWorld;
  float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mHash(i), mHash(i + vec2(1., 0.)), f.x), mix(mHash(i + vec2(0., 1.)), mHash(i + vec2(1., 1.)), f.x), f.y); }
  void main() {
    // Where the ray from the lens to this mirrored point crosses the floor.
    vec3 ray = vWorld - cameraPosition;
    float t = (cameraPosition.y - uY) / max(cameraPosition.y - vWorld.y, 1e-3);
    vec3 floorPoint = cameraPosition + ray * t;
    if (abs(floorPoint.x) > uExtent.x || abs(floorPoint.z) > uExtent.y) discard;
    float cosView = clamp((cameraPosition.y - uY) / max(length(cameraPosition - floorPoint), 1e-3), 0., 1.);
    float fresnel = uF0 + (1. - uF0) * pow(1. - cosView, 5.);
    float depth = max(uY - vWorld.y, 0.);
    float fade = exp(-depth / uFade * 1.1);
    float polish = 1. - uPolish.y + uPolish.y * (.35 + .65 * mNoise(floorPoint.xz / uPolish.x) * mNoise(floorPoint.xz / uPolish.x * 2.7 + 13.));
    vec2 uv = vUv;
    // The picture's own edges, softened (before the screens' frames swap, so the fade stays on the quad).
    float edge = 1.;
    if (uEdge.x > 0.) {
      float fv = fract(vUv.y * uEdge.z);
      edge = smoothstep(0., uEdge.x, vUv.x) * smoothstep(1., 1. - uEdge.x, vUv.x) * smoothstep(0., uEdge.y, fv) * smoothstep(1., 1. - uEdge.y, fv);
    }
    if (uCycle > .5 && fract(uTime / 20.) > .5) uv.y = uv.y >= .5 ? uv.y - .5 : uv.y + .5;
    uv.x += uTime * uScroll;
    // A rough polish streaks a reflection toward the viewer: five taps down the picture's v, wider the deeper it lies.
    float bias = uBlur + depth * .08, smear = uSmear * (1. + depth * .1);
    vec3 col = (texture2D(map, uv, bias).rgb * .3 + (texture2D(map, uv + vec2(0., smear), bias).rgb + texture2D(map, uv - vec2(0., smear), bias).rgb) * .22
      + (texture2D(map, uv + vec2(0., smear * 2.), bias).rgb + texture2D(map, uv - vec2(0., smear * 2.), bias).rgb) * .13) * uTint;
    float k = uStrength * fresnel * fade * polish * edge;
    gl_FragColor = vec4(col * k, 1.);
  }`;

/** The sources, mirrored in the floor's plane: one draw each, added to the stage's root. */
export function mirrorBright(c: DressContext, sources: readonly MirrorSource[], o: MirrorOptions) {
  const y = o.y ?? 0;
  for (const floor of o.floor) floor.renderOrder = Math.min(floor.renderOrder, -2);
  // y -> 2y0 - y about the plane.
  const reflect = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 2 * y, 0, 0, 1, 0, 0, 0, 0, 1);
  const out: THREE.Mesh[] = [];
  for (const s of sources) {
    const source = s.mesh.material as THREE.MeshBasicMaterial;
    const map = s.map ?? source.map;
    if (!map) continue;
    const material = new THREE.ShaderMaterial({
      name: `${source.name} mirrored`,
      uniforms: {
        map: { value: map }, uTint: { value: new THREE.Color(s.tint ?? 0xffffff) }, uStrength: { value: o.strength * (s.strength ?? 1) },
        uF0: { value: o.f0 ?? .05 }, uFade: { value: o.fade }, uBlur: { value: o.blur ?? 2 }, uY: { value: y },
        uPolish: { value: new THREE.Vector2(o.polish?.size ?? 3, o.polish?.amount ?? .5) },
        uExtent: { value: new THREE.Vector2(...(o.extent ?? [1e5, 1e5])) },
        uTime: c.ambient.time, uCycle: { value: s.cycle ? 1 : 0 }, uScroll: { value: s.scroll ?? 0 },
        uEdge: { value: new THREE.Vector3(s.edge?.u ?? 0, s.edge?.v ?? 0, s.edge?.cells ?? 1) }, uSmear: { value: o.smear ?? 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      // In the opaque list (so renderOrder places it between the floor and the rest), its light added.
      transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, depthFunc: THREE.GreaterDepth,
      side: THREE.FrontSide, fog: false,
    });
    const mesh = new THREE.Mesh(s.mesh.geometry, material);
    mesh.name = `${s.mesh.name} mirrored`;
    s.mesh.updateWorldMatrix(true, false);
    mesh.matrixAutoUpdate = false;
    // The mirror's determinant is negative: three turns the winding round itself, so front faces stay front.
    mesh.matrix.multiplyMatrices(reflect, s.mesh.matrixWorld);
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    c.root.add(mesh);
    out.push(mesh);
  }
  return out;
}
