/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STRIPPED_JSON, runtimeAssetManifest } from './scripts/build/provenance';
import { bundledPackages, creditsPage, declaredPackages, readCredits } from './scripts/build/credits';
import originalsBrand from './scripts/build/brandPlugin.ts'; // the game's name and pages from src/originals/brand.ts
import originalsLaunch from './scripts/build/launchPlugin.ts'; // the launch gate in the bundle (src/originals/launch.ts)
import audioFiles from './scripts/build/audioFiles.ts'; // the sound files this checkout carries

const root = fileURLToPath(new URL('.', import.meta.url));
const heavy = (path: string) => (/[\\/]assets([\\/]|$)/.test(path) && !/[\\/]public[\\/]assets([\\/]|$)/.test(path)) || /[\\/]evidence([\\/]|$)/.test(path);

const sourceCommit=process.env.VITE_BUILD_SHA||execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const builtOn=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

export default defineConfig({
  // originalsBrand fills index.html, privacy.html and site.webmanifest from brand.ts; originalsLaunch bundles no hidden
  // fighter's manifest entry. The JSON the game bundles from public/assets (and the ambience list) loses its provenance
  // fields in a build; the repository keeps them and tests read the files whole.
  plugins: [originalsBrand(), originalsLaunch(), audioFiles(), {
    // The first paint (the performance sweep, 24 October 2026): the entry's stylesheet goes into the body after #app, so the page's
    // inline boot mark (index.html) paints with the page's first bytes instead of waiting for 163 KB of CSS (and, until the
    // sweep, Google's font stylesheet behind it). A stylesheet the parser meets in the body still holds the page's module scripts
    // until it has loaded (HTML: a style sheet that is blocking scripts), so the game never mounts its interface unstyled, and
    // the preload scanner asks for it as early as from the head. The dev server injects its styles by script and is untouched.
    name: 'impact-style-after-app', apply: 'build',
    transformIndexHtml: { order: 'post', handler(html) {
      const links: string[] = [];
      const page = html.replace(/\s*<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/g, tag => { links.push(tag.trim()); return ''; });
      if (!links.length) return html;
      const app = /<div id="app"[^>]*><\/div>/;
      if (!app.test(page)) throw new Error('index.html has no <div id="app"></div> for the stylesheet to follow (vite.config.ts impact-style-after-app)');
      return page.replace(app, tag => `${tag}${links.join('')}`);
    } },
  }, { name: 'impact-strip-provenance', apply: 'build', enforce: 'pre', transform(code, id) {
    if (id.includes('?') || !STRIPPED_JSON.test(id)) return null;
    return { code: JSON.stringify(runtimeAssetManifest(JSON.parse(code), id)), map: null };
  } }, {
    name: 'impact-credits-page',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/credits.html') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(creditsPage({ date: builtOn, commit: sourceCommit, software: declaredPackages(root) }, readCredits(root)));
      });
    },
    generateBundle(_, bundle) {
      const modules = Object.values(bundle).flatMap(out => out.type === 'chunk' ? out.moduleIds : []);
      this.emitFile({ type: 'asset', fileName: 'credits.html', source: creditsPage({ date: builtOn, commit: sourceCommit, software: bundledPackages(modules) }, readCredits(root)) });
    },
  }],
  define: { 'import.meta.env.VITE_BUILD_SHA': JSON.stringify(sourceCommit) },
  optimizeDeps: { entries: ['index.html'] },
  server: { port: 5173, strictPort: true, watch: { ignored: [heavy] }, proxy: {
    '/matchmake': { target: 'http://127.0.0.1:2567', changeOrigin: true },
    '/health': { target: 'http://127.0.0.1:2567', changeOrigin: true },
    '/ws': { target: 'ws://127.0.0.1:2567', ws: true, rewrite: p => p.replace(/^\/ws/, '') }
  } },
  // Third-party notices travel with the code they cover (MIT, BSD, Apache: "this permission notice shall be included in
  // all copies"): a comment marked legal (`/*!`, `@license`) stays in the shipped chunk.
  // Vitest's own temp folder goes when a run ends (tests/setup/vitestTmp.ts).
  test: { globalSetup: ['tests/setup/vitestTmp.ts'], setupFiles: ['tests/setup/heldBack.ts'], testTimeout: 20_000 },
  // The match server's client libraries (Colyseus and msgpackr: 159 KB, 51 KB as sent) in a chunk of their own: inside the
  // page's entry they were downloaded again by every returning player after every release, a release changes the game's code
  // and never theirs; here the chunk keeps its name until they are upgraded (three already has its own two). The performance
  // sweep, 24 October 2026.
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, rolldownOptions: { output: { comments: { legal: true }, codeSplitting: { groups: [{ name: 'net', test: /[\\/]node_modules[\\/](@colyseus|msgpackr)[\\/]/ }] } } } },
});
