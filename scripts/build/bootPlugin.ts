/** The loading page's two build-time pieces (index.html #boot).
 *
 *  - `/＊BOOT_MARK＊/` in its inline style becomes the game's mark as a data address (src/boot/art/mark-384.webp: the
 *    1024 px icon at 384 px, so the mark drawn about 110 px wide stays sharp at three device pixels to one), so the mark
 *    paints with the page's first bytes and asks for nothing;
 *  - `/＊BOOT_BYTES＊/[]` in its inline script becomes the size of each file the page loads before the game starts (the
 *    entry, its module preloads, its stylesheet), in the page's order of them, so the progress bar follows the bytes as they
 *    arrive (Resource Timing, each file as it completes). By position, not by name: the page names its entry once.
 *  (The full-width asterisks above keep this comment from being a placeholder itself; the page uses plain ones.) */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const MARK_FILE = 'src/boot/art/mark-384.webp';
export const MARK_TOKEN = '/*BOOT_MARK*/', BYTES_TOKEN = '/*BOOT_BYTES*/[]';

/** The mark as a data address. */
export const markData = (root = process.cwd()) => `data:image/webp;base64,${readFileSync(path.join(root, MARK_FILE)).toString('base64')}`;

/** The sizes of the files the page loads before the game starts, in the page's order of its module script, module
 *  preloads and stylesheets (the order index.html's script reads them in: script[type=module][src],
 *  link[rel=modulepreload][href], link[rel=stylesheet][href]); 0 for one the bundle does not know. */
export function bootBytes(html: string, size: (file: string) => number | undefined): number[] {
  const out: number[] = [];
  for (const m of html.matchAll(/<(script|link)\b[^>]*>/g)) {
    const tag = m[0], url = m[1] === 'script' ? /\btype="module"/.test(tag) && /\bsrc="([^"]+)"/.exec(tag)?.[1] : /\brel="(?:modulepreload|stylesheet)"/.test(tag) && /\bhref="([^"]+)"/.exec(tag)?.[1];
    if (url) out.push(size(url.split(/[?#]/)[0].split('/').pop()!) ?? 0);
  }
  return out;
}

/** Two plugins: the mark before Vite reads the page's inline style (it would drop the comment), the sizes once the bundle
 *  is made. */
export default function originalsBoot(): Plugin[] {
  return [
    { name: 'impact-boot-mark', transformIndexHtml: { order: 'pre', handler: html => html.replace(MARK_TOKEN, markData()) } },
    { name: 'impact-boot-bytes', apply: 'build', transformIndexHtml: { order: 'post', handler: (html, ctx) => {
      if (!html.includes(BYTES_TOKEN)) return html;
      const bundle = ctx.bundle;
      const size = (file: string) => {
        const out = bundle && Object.values(bundle).find(each => each.fileName.split('/').pop() === file);
        if (!out) return undefined;
        return out.type === 'chunk' ? Buffer.byteLength(out.code) : typeof out.source === 'string' ? Buffer.byteLength(out.source) : out.source.byteLength;
      };
      return html.replace(BYTES_TOKEN, JSON.stringify(bootBytes(html, size)));
    } } },
  ];
}
