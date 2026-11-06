import type * as THREE from 'three';
import type {GLTFLoaderPlugin,GLTFParser} from 'three/addons/loaders/GLTFLoader.js';

interface BodyMaterial {
  normalTexture?:unknown;occlusionTexture?:unknown;emissiveTexture?:unknown;
  pbrMetallicRoughness?:{metallicRoughnessTexture?:unknown};
}

/** Applied only by EnemyHorde's loader, before material dependencies load.
 * Avoid decoding/retaining PBR images that the toon conversion discards as
 * well as avoiding their GPU uploads. Colour/alpha, UV transforms, material
 * names, sidedness, geometry and animation remain the loader's originals. */
export function retainBodyMaps(json:{materials?:BodyMaterial[]}){
  for(const material of json.materials??[]){
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    if(material.pbrMetallicRoughness)delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
}

export function bodyTexturePlugin(parser:GLTFParser):GLTFLoaderPlugin{
  return {name:'JUMP_enemy_body_maps',beforeRoot:()=>{retainBodyMaps(parser.json);return null;}};
}

/** EnemyBody replaces source PBR materials with toon materials that retain
 * only their colour maps. Upload the same set: normal, metalness, roughness
 * and emissive maps in a source GLB are never sampled by those bodies.
 * Include hidden face/weapon variants because animation can reveal them.
 * Keep this contract in sync with EnemyBody's material conversion. */
export function bodyTextures(root:THREE.Object3D):Set<THREE.Texture>{
  const textures=new Set<THREE.Texture>();
  root.traverse(node=>{
    const material=(node as THREE.Mesh).material;
    for(const each of Array.isArray(material)?material:material?[material]:[]){
      const map=(each as THREE.MeshStandardMaterial).map;
      if(map?.isTexture)textures.add(map);
    }
  });
  return textures;
}
