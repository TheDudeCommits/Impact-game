// The dude-world cartridge build (from the site's tools/cartridge/vite.cartridge.config.ts template): src/cartridge/index.ts
// into dist-cartridge/cartridge.js (+ chunks/ and assets/), one ES module the world imports at run time. `import 'three'`
// resolves to src/cartridge/three-shim.js (copied from the site), so the game runs on the world's own three.js and
// renderer; everything else it imports (rapier, its own code) is bundled in. The game's own pass for the world
// (scripts/build/cartridgePlugin.ts) points its page globals at the cartridge runtime and scopes its stylesheets, and the
// demo's gate is on (VITE_DEMO, src/originals/demo.ts) with no match server (VITE_MATCH_SERVER *.invalid: nothing online).
//   npm run build:cartridge   (builds, then scripts/build/cartridgeShip.mjs copies it and the demo's files into the site)
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { STRIPPED_JSON, runtimeAssetManifest } from './scripts/build/provenance';
import originalsLaunch from './scripts/build/launchPlugin.ts';
import cartridgePlugin, { scopeCss } from './scripts/build/cartridgePlugin.ts';

const shim = fileURLToPath(new URL('./src/cartridge/three-shim.js', import.meta.url));
const root = fileURLToPath(new URL('.', import.meta.url));
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commit = git('rev-parse', '--short=12', 'HEAD'), branch = git('rev-parse', '--abbrev-ref', 'HEAD');

// The demo: its gate, and no match server (launch.ts LAUNCH.online is false for an .invalid host).
process.env.VITE_DEMO = 'dude-world';
process.env.VITE_MATCH_SERVER = 'https://offline.invalid';

/** As the game's own build (vite.config.ts): the JSON it bundles from public/assets loses its provenance fields. */
const stripProvenance: Plugin = { name: 'impact-strip-provenance', apply: 'build', enforce: 'pre', transform(code, id) {
  if (id.includes('?') || !STRIPPED_JSON.test(id)) return null;
  return { code: JSON.stringify(runtimeAssetManifest(JSON.parse(code), id)), map: null };
} };

export default defineConfig({
  base: './',               // emitted asset URLs resolve against cartridge.js, wherever the world serves it
  publicDir: false,         // the demo's run-time files are copied by build:cartridge (scripts/build/cartridgeShip.mjs)
  resolve: { alias: [{ find: /^three$/, replacement: shim }] },
  define: {
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(commit),
    __IMPACT_SOURCE__: JSON.stringify(`github.com/TheDudeCommits/Impact-game, branch ${branch}, commit ${commit}`),
  },
  // Every JSON module as an object, so the cartridge pass sees its '/assets/' strings (never one JSON.parse string).
  json: { stringify: false },
  css: { postcss: { plugins: [scopeCss()] } },
  plugins: [originalsLaunch(), stripProvenance, ...cartridgePlugin(root)],
  build: {
    outDir: 'dist-cartridge', emptyOutDir: true, target: 'es2022', sourcemap: false, modulePreload: false, chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/cartridge/index.ts', import.meta.url)),
      preserveEntrySignatures: 'strict',
      output: { format: 'es', entryFileNames: 'cartridge.js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]', comments: { legal: true } },
    },
  },
});
