import * as THREE from 'three';
import type { DressContext } from '../../render/stages/dressing';
import { addShaderPatch } from '../../render/look/shaderPatch';

export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

/** A scanned surface's three maps (colour, relief, roughness), tiling; the Forge lays them in world metres. */
export async function surface(c: DressContext, name: string): Promise<Surface> {
  const at = (part: string) => `/assets/environment/cc0/tex/${name}-${part}.webp`;
  const [map, normalMap, roughnessMap] = await Promise.all([
    c.texture(at('diff'), { repeat: 1 }), c.texture(at('nor'), { repeat: 1, srgb: false }), c.texture(at('rough'), { repeat: 1, srgb: false })]);
  return { map, normalMap, roughnessMap };
}

/** Several surfaces at once, by name. */
export async function surfaces<K extends string>(c: DressContext, names: readonly K[]): Promise<Record<K, Surface>> {
  const got = await Promise.all(names.map(name => surface(c, name)));
  return Object.fromEntries(names.map((name, i) => [name, got[i]])) as Record<K, Surface>;
}

/** A centrepiece lit from the cameras' side as well as by the place's light (as main lit its hall's statue): a prop
 *  standing against the light would read as a dark cut-out. Adds its own colour, keyed by how it faces the key. */
export function keyLit(materials: readonly THREE.Material[], key = new THREE.Color(1, .93, .84).multiplyScalar(.8), dir = new THREE.Vector3(.35, .55, .76).normalize()) {
  for (const material of new Set(materials)) addShaderPatch(material, 'cc0-key-lit-v1', shader => {
    shader.uniforms.uKeyLit = { value: key };
    shader.uniforms.uKeyDir = { value: dir };
    shader.fragmentShader = 'uniform vec3 uKeyLit;\nuniform vec3 uKeyDir;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += diffuseColor.rgb * uKeyLit * ( .12 + max( dot( normal, normalize( ( viewMatrix * vec4( uKeyDir, 0.0 ) ).xyz ) ), 0.0 ) );`);
  });
}
