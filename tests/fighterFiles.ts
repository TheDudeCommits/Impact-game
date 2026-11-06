import fs from 'node:fs';
import { glbHeader, type FighterFiles, type GlbHeader } from '../src/engine/client/fighterCheck';

/** The engine's fighter check (src/engine/client/fighterCheck.ts) reading public/: a GLB by its header alone (the JSON
 *  chunk, never the geometry), any other file by whether it is there. */
const headers = new Map<string, GlbHeader | undefined>();
export const publicFiles: FighterFiles = {
  glb(url) {
    if (headers.has(url)) return headers.get(url);
    let header: GlbHeader | undefined;
    const file = `public${url.split('?')[0]}`;
    if (fs.existsSync(file)) {
      const fd = fs.openSync(file, 'r');
      try {
        const head = Buffer.alloc(20);
        fs.readSync(fd, head, 0, 20, 0);
        const bytes = Buffer.alloc(20 + head.readUInt32LE(12));
        fs.readSync(fd, bytes, 0, bytes.length, 0);
        header = glbHeader(bytes);
      } finally { fs.closeSync(fd); }
    }
    headers.set(url, header);
    return header;
  },
  exists: url => fs.existsSync(`public${url.split('?')[0]}`),
};
