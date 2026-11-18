// Impact's rooms as a PlayerTwo room/ folder (room.ts and what it imports): esbuild with the match server's own room
// classes, `colyseus` and the server-only modules swapped for the room's (colyseus.ts, stubs/), the economy key built in.
//
//   node src/p2room/build.mjs <out folder> [--node] [--release] [--meta]
//
// <out>/room.js, rapier.js and its .wasm beside it (PlayerTwo's `p2.mjs wasm`: a room compiles no WebAssembly from
// bytes), and nothing else: PlayerTwo bundles every file in room/ ({ p2: "room-bundle", modules }; its size is logged). --node: one file,
// <out>/room.node.mjs, Rapier inside it, for the tests (tests/p2room*.test.ts).
// The key: P2ROOM_KEY in the environment, else ~/.config/impact/p2room-key (never in the repo); none, a bundle that
// trusts no pass (every seat plays without its account) — said loudly, and refused by --release. --meta: esbuild's
// metafile beside <out> (what the bundle holds, by source).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const args = process.argv.slice(2), node = args.includes('--node'), release = args.includes('--release');
const out = resolve(args.find(a => !a.startsWith('--')) ?? join(root, 'p2room-out'));
const keyFile = join(homedir(), '.config/impact/p2room-key');
const key = (process.env.P2ROOM_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();
if (!key) { if (release) { console.error('build.mjs --release: no P2ROOM_KEY'); process.exit(1); } console.warn('build.mjs: no P2ROOM_KEY: this bundle trusts no pass (seats play without their accounts)'); }
/* PlayerTwo's CLI (its `p2.mjs`), for the room folder's WebAssembly: P2_CLI, its path */
const p2cli = process.env.P2_CLI ?? '';

/* the server's own modules a room can't run (its disk, its processes, Node's own) -> the room's */
const S = p => join(root, 'src/server', p), R = p => join(here, p);
const SWAP = new Map([
  [S('economy/api.ts'), R('stubs/economyApi.ts')],
  [S('cluster/economyLink.ts'), R('stubs/economyLink.ts')],
  [S('capacity.ts'), R('stubs/capacity.ts')],
  [S('netStats.ts'), R('stubs/netStats.ts')],
  [S('privateCodes.ts'), R('stubs/privateCodes.ts')],
  [S('social/Rivalries.ts'), R('stubs/rivalries.ts')],
  [S('ball/ranked.ts'), R('stubs/ranked.ts')],
]);
const swap = {
  name: 'p2room-swap',
  setup(b) {
    b.onResolve({ filter: /^colyseus$/ }, () => ({ path: R('colyseus.ts') }));
    b.onResolve({ filter: /^node:crypto$|^crypto$/ }, () => ({ path: R('stubs/nodeCrypto.ts') }));
    b.onResolve({ filter: /^\.{1,2}\// }, async a => {
      if (a.pluginData === 'p2room-swap') return undefined;
      const r = await b.resolve(a.path, { resolveDir: a.resolveDir, kind: a.kind, pluginData: 'p2room-swap' });
      const to = SWAP.get(r.path);
      return to ? { path: to } : undefined;
    });
    if (!node) b.onResolve({ filter: /^@dimforge\/rapier3d-compat$/ }, () => ({ path: './rapier.js', external: true }));
  },
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (!node && !p2cli) { console.error('build.mjs: set P2_CLI to the path of PlayerTwo\'s p2.mjs to build the room folder (--node needs none)'); process.exit(1); }
if (!node) execFileSync('node', [p2cli, 'wasm', join(root, 'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs'), out], { stdio: 'inherit' });
const result = await build({
  entryPoints: [R('entry.ts')], outfile: join(out, node ? 'room.node.mjs' : 'room.js'), bundle: true, format: 'esm',
  platform: node ? 'node' : 'neutral', target: 'es2022', mainFields: ['module', 'main'], conditions: ['worker', 'browser'],
  /* a room has no environment: what the server reads of its own is read as its default (LOCK_COMBAT on) */
  define: { 'process.env.LOCK_COMBAT': 'undefined', 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env': '{}', __P2ROOM_KEY__: JSON.stringify(key) },
  inject: [R('stubs/process.ts')], legalComments: 'none', minify: !node, metafile: true, logLevel: 'warning', plugins: [swap],
});
const modules = {};
for (const f of readdirSync(out).sort()) {
  if (f === 'bundle.json' || f.endsWith('.node.mjs') || f.endsWith('.json')) continue;
  const bytes = readFileSync(join(out, f));
  modules[f] = f.endsWith('.wasm') ? { wasm: bytes.toString('base64') } : { js: bytes.toString('utf8') };
}
if (!node) {
  /* (the bundle as PlayerTwo makes it of room/, for its size: not written, since PlayerTwo loads every file in room/) */
  const bundle = JSON.stringify({ p2: 'room-bundle', modules });
  const sizes = Object.entries(modules).map(([f, m]) => `${f} ${((m.js ?? m.wasm).length / 1048576).toFixed(2)} MB`).join(', ');
  console.log(`room/: ${sizes}; bundle ${(bundle.length / 1048576).toFixed(2)} MB, sha256 ${createHash('sha256').update(bundle).digest('hex').slice(0, 16)}`);
} else console.log(`${join(out, 'room.node.mjs')}: ${(readFileSync(join(out, 'room.node.mjs')).length / 1048576).toFixed(2)} MB`);
if (args.includes('--meta')) writeFileSync(join(out, '..', 'p2room-meta.json'), JSON.stringify(result.metafile));
