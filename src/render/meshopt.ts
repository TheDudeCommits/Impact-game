import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { shareTextures } from './sharedTextures';
import { capTextures, currentTextureCap, decodeCapPlugin } from './textureCap';

type WithDecoder = GLTFLoader & { meshoptDecoder?: unknown };
const parse = GLTFLoader.prototype.parse;
/** The loaders that decode their images at the quality's cap (textureCap.ts decodeCapPlugin): every one, once. */
const decodeCapped = new WeakSet<GLTFLoader>();
if (!(parse as { meshopt?: boolean }).meshopt) {
  const withDecoder = function (this: WithDecoder, ...[data, path, onLoad, onError]: Parameters<GLTFLoader['parse']>) {
    if (!this.meshoptDecoder) this.setMeshoptDecoder(MeshoptDecoder);
    if (!decodeCapped.has(this)) { decodeCapped.add(this); this.register(parser => decodeCapPlugin(parser)); }
    // Images another model already holds are shared with it (src/render/sharedTextures.ts, release 39).
    return parse.call(this, data, path, gltf => {
      try { shareTextures(gltf); } catch (error) { console.warn('[textures] not shared', error); }
      // Medium and Low keep an image no larger than their cap (textureCap.ts); High, none: handed on as it always was.
      if (Number.isFinite(currentTextureCap())) void capTextures(gltf).catch(() => 0).then(() => onLoad(gltf));
      else onLoad(gltf);
    }, onError);
  };
  (withDecoder as { meshopt?: boolean }).meshopt = true;
  GLTFLoader.prototype.parse = withDecoder;
}
