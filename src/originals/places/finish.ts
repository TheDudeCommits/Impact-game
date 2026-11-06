import * as THREE from 'three';
import { addShaderPatch } from '../../render/look/shaderPatch';
import type { Surface } from './cc0';

/** A Forge mesh by its material's key (the Forge names each `<stage>:<forge> <key>`). */
export function forged(meshes: readonly THREE.Mesh[], key: string) {
  return meshes.find(m => m.name.endsWith(` ${key}`));
}

/** The geometry's normals averaged over every corner it shares with a face less than `crease` degrees off (area-weighted),
 *  in place. Positions, UVs and colours are untouched (a Forge mesh: non-indexed, mapped and tinted per triangle). */
export function smooth(geometry: THREE.BufferGeometry, crease = 55) {
  const p = geometry.getAttribute('position') as THREE.BufferAttribute, n = p.count;
  const fx = new Float32Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let t = 0; t < n / 3; t++) {
    a.fromBufferAttribute(p, t * 3); b.fromBufferAttribute(p, t * 3 + 1); c.fromBufferAttribute(p, t * 3 + 2);
    e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
    fx[t * 3] = e1.x; fx[t * 3 + 1] = e1.y; fx[t * 3 + 2] = e1.z;
  }
  const key = (i: number) => `${Math.round(p.getX(i) * 1e3)},${Math.round(p.getY(i) * 1e3)},${Math.round(p.getZ(i) * 1e3)}`;
  const corners = new Map<string, number[]>();
  for (let i = 0; i < n; i++) { const k = key(i), list = corners.get(k); if (list) list.push(i); else corners.set(k, [i]); }
  const out = new Float32Array(n * 3), cos = Math.cos(crease * Math.PI / 180), own = new THREE.Vector3(), other = new THREE.Vector3(), sum = new THREE.Vector3();
  for (const list of corners.values()) for (const i of list) {
    const t = Math.floor(i / 3);
    own.set(fx[t * 3], fx[t * 3 + 1], fx[t * 3 + 2]);
    const ol = own.length() || 1;
    sum.set(0, 0, 0);
    for (const j of list) {
      const u = Math.floor(j / 3);
      other.set(fx[u * 3], fx[u * 3 + 1], fx[u * 3 + 2]);
      if (u === t || other.dot(own) / ((other.length() || 1) * ol) >= cos) sum.add(other);
    }
    if (sum.lengthSq() < 1e-12) sum.copy(own);
    sum.normalize();
    out[i * 3] = sum.x; out[i * 3 + 1] = sum.y; out[i * 3 + 2] = sum.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geometry;
}

/** A surface's maps set to tile (each a copy, so the place's own repeat never touches another's). */
export function tiled(s: Surface): Surface {
  const t = (x: THREE.Texture) => { const y = x.clone(); y.wrapS = y.wrapT = THREE.RepeatWrapping; y.repeat.set(1, 1); y.needsUpdate = true; return y; };
  return { map: t(s.map), normalMap: t(s.normalMap), roughnessMap: t(s.roughnessMap) };
}

const NOISE = /* glsl */`
  float pfHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float pfNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
    return mix( mix( pfHash( i ), pfHash( i + vec2( 1., 0. ) ), f.x ), mix( pfHash( i + vec2( 0., 1. ) ), pfHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }`;

export interface FloorOver {
  /** The surface let in (grass, moss, snow), tiled every `tile` metres. */
  surface: Surface; tile: number;
  /** How much of the floor it takes (0..1) where the mask is middling; `edge` [from, to] metres off the centre (the larger
   *  of |x| and |z|) adds up to `edgeAmount` more toward the edges; `cracks` how much it gathers in the base's dark joints. */
  amount: number; edge?: [number, number]; edgeAmount?: number; cracks?: number;
  /** The mask's patch size in metres. */
  scale?: number;
  /** Linear colour multiplier on the surface let in. */
  tint?: THREE.ColorRepresentation;
  /** Never inside this half-square round the centre (metres): the fight's own floor kept clear. */
  clear?: number;
}

/** A floor laid with a photographed surface in world metres (x, z over `tile`), whatever its own UVs, with its relief and
 *  roughness; with `over`, a second surface let into it by a soft mask and the base's dark cracks. The material's colour is
 *  kept (it multiplies, as the map it replaces did). In place. */
export function worldFloor(material: THREE.MeshStandardMaterial, base: Surface, tile: number, o: { over?: FloorOver; normalScale?: number; tint?: THREE.ColorRepresentation } = {}) {
  const b = tiled(base);
  material.map = b.map; material.normalMap = b.normalMap; material.roughnessMap = b.roughnessMap;
  material.normalScale.set(o.normalScale ?? 1, o.normalScale ?? 1);
  material.roughness = 1;
  if (o.tint !== undefined) material.color.set(o.tint);
  const over = o.over, s = over ? tiled(over.surface) : undefined;
  const uniforms = {
    uPfTile: { value: tile }, uPfOverTile: { value: over?.tile ?? 1 }, uPfAmount: { value: over?.amount ?? 0 },
    uPfEdge: { value: new THREE.Vector3(over?.edge?.[0] ?? 1e4, over?.edge?.[1] ?? 2e4, over?.edgeAmount ?? 0) },
    uPfCracks: { value: over?.cracks ?? 0 }, uPfScale: { value: over?.scale ?? 9 }, uPfClear: { value: over?.clear ?? -1 },
    uPfTint: { value: new THREE.Color(over?.tint ?? 0xffffff) },
    uPfMap: { value: s?.map ?? null }, uPfNor: { value: s?.normalMap ?? null }, uPfRough: { value: s?.roughnessMap ?? null },
  };
  addShaderPatch(material, `places-finish-floor-${over ? 'over' : 'plain'}-v1`, shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vPfW;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	vPfW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`);
    const swap = (chunk: string, from: RegExp) => (THREE.ShaderChunk as Record<string, string>)[chunk].replace(from, 'pfUv');
    let f = shader.fragmentShader;
    f = `varying vec3 vPfW;\nuniform float uPfTile, uPfOverTile, uPfAmount, uPfCracks, uPfScale, uPfClear;\nuniform vec3 uPfEdge, uPfTint;\n${over ? 'uniform sampler2D uPfMap, uPfNor, uPfRough;\n' : ''}${NOISE}\n` + f;
    f = f.replace('void main() {', `void main() {
	vec2 pfUv = vPfW.xz / uPfTile; vec2 pfOverUv = vPfW.xz / uPfOverTile; float pfOver = 0.;`);
    f = f.replace('#include <map_fragment>', `#ifdef USE_MAP
	vec4 pfBase = texture2D( map, pfUv );
	${over ? `vec2 pfP = vPfW.xz / uPfScale;
	float pfN = pfNoise( pfP ) * .6 + pfNoise( pfP * 2.7 + 11.3 ) * .28 + pfNoise( pfP * 7.9 - 4.1 ) * .12;
	float pfEdgeD = max( abs( vPfW.x ), abs( vPfW.z ) );
	float pfLum = dot( pfBase.rgb, vec3( .2126, .7152, .0722 ) );
	float pfCrack = 1. - smoothstep( .025, .09, pfLum );
	pfOver = smoothstep( 1. - uPfAmount - .12, 1. - uPfAmount + .12, pfN + smoothstep( uPfEdge.x, uPfEdge.y, pfEdgeD ) * uPfEdge.z );
	pfOver = clamp( max( pfOver, pfCrack * uPfCracks * smoothstep( .25, .6, pfN + .2 ) ), 0., 1. );
	if ( uPfClear > 0. ) pfOver *= smoothstep( uPfClear, uPfClear + 4., pfEdgeD );
	vec4 pfTop = texture2D( uPfMap, pfOverUv ) * vec4( uPfTint, 1. );
	diffuseColor *= mix( pfBase, pfTop, pfOver );` : 'diffuseColor *= pfBase;'}
#endif`);
    f = f.replace('#include <roughnessmap_fragment>', swap('roughnessmap_fragment', /vRoughnessMapUv/g)
      + (over ? '\n\troughnessFactor = mix( roughnessFactor, texture2D( uPfRough, pfOverUv ).g, pfOver );' : ''));
    f = f.replace('#include <normal_fragment_begin>', swap('normal_fragment_begin', /vNormalMapUv/g));
    f = f.replace('#include <normal_fragment_maps>', over
      ? swap('normal_fragment_maps', /vNormalMapUv/g).replace('vec3 mapN = texture2D( normalMap, pfUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = mix( texture2D( normalMap, pfUv ).xyz, texture2D( uPfNor, pfOverUv ).xyz, pfOver ) * 2.0 - 1.0;')
      : swap('normal_fragment_maps', /vNormalMapUv/g));
    shader.fragmentShader = f;
  });
  material.needsUpdate = true;
  return material;
}
