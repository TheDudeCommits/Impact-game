import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CREDITS_PAGE, PRIVACY_PAGE, REPO_PAGE, TERMS_PAGE } from '../src/ui/legalLinks';
import { ATTRIBUTIONS, OPEN_WORKS, UNOPENABLE_SOURCES, creditLine } from '../src/ui/legalCredits';
import { legalPage } from '../src/ui/legal';
import { noticeHtml } from '../src/ui/firstVisit';
import { pagesInGame, withBase } from '../src/ui/pageViewer';
import { creditsPage, readCredits } from '../scripts/build/credits';
import { brandPrivacyHtml, brandTermsHtml } from '../scripts/build/brandPlugin';
import { BYTES_TOKEN, MARK_FILE, bootBytes, markData } from '../scripts/build/bootPlugin';
import { siteUrl } from '../src/loading/siteBase';

/** The pages beside the game work wherever the build is served: at a site's root, and under a folder of its own, as
 *  Player Two serves each build (`/~<build>/`, where a root address like `/privacy.html` leaves the build). */
const P2 = 'https://impact.playertwo.cc/~b1/index.html', SITE = 'https://play.example.com/';
const credits = creditsPage({ date: '9 November 2026', software: [] }, readCredits());
const pages = { privacy: brandPrivacyHtml(readFileSync('public/privacy.html', 'utf8')), terms: brandTermsHtml(readFileSync('public/terms.html', 'utf8')), credits };
/** Every address a page names, but its own anchors, e-mail and other sites. */
const ownAddresses = (html: string) => [...html.matchAll(/(?:href|src)="([^"]*)"|url\('([^']*)'\)/g)].map(m => m[1] ?? m[2])
  .filter(url => !/^(#|mailto:|https?:)/.test(url));

describe('the pages beside the game resolve inside the build wherever it is served', () => {
  it('names each page relative to the game\'s own page', () => {
    for (const page of [PRIVACY_PAGE, TERMS_PAGE, CREDITS_PAGE]) {
      expect(page).not.toMatch(/^\//);
      expect(new URL(page, P2).href).toBe(`https://impact.playertwo.cc/~b1/${page}`);
      expect(new URL(page, SITE).href).toBe(`${SITE}${page}`);
    }
  });
  it('writes no root address in the static pages: their links, styles, fonts and icon are relative, BACK TO THE GAME is index.html', () => {
    for (const [name, html] of Object.entries(pages)) {
      const own = ownAddresses(html);
      expect(own.filter(url => url.startsWith('/')), name).toEqual([]);
      expect(own, name).toContain('index.html');
      for (const url of own) expect(new URL(url, P2).pathname, `${name}: ${url}`).toMatch(/^\/~b1\//);
    }
  });
  it('opens the game\'s pages over the game where the host will not show them as pages (Player Two, or a /~build/ copy)', () => {
    expect(pagesInGame({ hostname: 'impact.playertwo.cc', pathname: '/~b1/index.html' })).toBe(true);
    expect(pagesInGame({ hostname: '127.0.0.1', pathname: '/~test/index.html' })).toBe(true);
    expect(pagesInGame({ hostname: 'play.example.com', pathname: '/' })).toBe(false);
    expect(pagesInGame({ hostname: 'localhost', pathname: '/index.html' })).toBe(false);
    // (Read with the game's own request and shown as the frame's document, its relative addresses kept on its own.)
    expect(withBase('<!doctype html><html><head><meta charset="utf-8"></head>', 'https://x.test/~b/terms.html')).toBe('<!doctype html><html><head><base href="https://x.test/~b/terms.html"><meta charset="utf-8"></head>');
  });
});

describe('SOURCE CODE beside LEGAL & PRIVACY and CREDITS', () => {
  it('is the game\'s repository, on the notice and on Options\' CREDITS & LEGAL page, in the same style', () => {
    expect(REPO_PAGE).toBe('https://github.com/TheDudeCommits/Impact-game');
    expect(noticeHtml()).toContain(`<a class="first-visit-link" href="${REPO_PAGE}" target="_blank" rel="noopener" data-focus="notice-source">SOURCE CODE <span aria-hidden="true">↗</span></a>`);
    expect(legalPage()).toMatch(/<button type="button" class="home-legal-privacy" data-open-source data-focus="source">SOURCE CODE <span aria-hidden="true">↗<\/span><\/button>/);
    expect(readFileSync('src/ui/legal.ts', 'utf8')).toMatch(/closest\('\[data-open-source\]'\)\) openPage\(REPO_PAGE, 'SOURCE CODE'\)/);
  });
  it('is in the footers of the privacy page, the terms and the credits page', () => {
    for (const [name, html] of Object.entries(pages)) expect(/<footer>[^]*<\/footer>/.exec(html)![0], name).toContain(`<a href="${REPO_PAGE}">Source code</a>`);
  });
});

describe('the credits', () => {
  it('link every source a visitor can open, and name the ones they cannot as text', () => {
    const lines = [...ATTRIBUTIONS, ...OPEN_WORKS].map(creditLine).join('');
    for (const page of [lines, credits]) {
      const hrefs = [...page.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
      for (const dead of UNOPENABLE_SOURCES) expect(hrefs).not.toContain(dead);
      expect(hrefs.filter(h => /www\.littlerobotsoundfactory/.test(h))).toEqual([]);
    }
    expect(lines).toContain('Ability-ThreeJS-Project');
    expect(lines).toContain('href="https://littlerobotsoundfactory.com"');
  });
});

/** The loading page: index.html's #boot, inline, painted with the page's first bytes. */
describe('the loading page', () => {
  const index = readFileSync('index.html', 'utf8');
  const boot = index.slice(index.indexOf('<style>'), index.indexOf('<div id="app"'));
  it('is inline, asks for nothing before it paints but the font the page preloads anyway, and stays a few KB without its mark', () => {
    expect(index.indexOf('<div id="boot"')).toBeLessThan(index.indexOf('<div id="app"')); // before the stylesheet the build puts after #app
    const urls = [...boot.matchAll(/url\(([^)]*)\)/g)].map(m => m[1].replace(/['"]/g, ''));
    expect(urls.sort()).toEqual(['/*BOOT_MARK*/', '/assets/home/fonts/electroharmonix.otf'].sort());
    expect(index).toContain('<link rel="preload" href="/assets/home/fonts/electroharmonix.otf" as="font" type="font/otf" crossorigin>');
    // (Without the comments to its editors: what the page sends, its mark apart.)
    expect(Buffer.byteLength(boot.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\/\/.*$/gm, ''))).toBeLessThan(5000);
    expect(readFileSync(MARK_FILE).length).toBeLessThan(12_000);
  });
  it('draws the mark from a sharp source, inlined at build, crisp at three device pixels to one', () => {
    const mark = readFileSync(MARK_FILE);
    expect(mark.subarray(0, 4).toString()).toBe('RIFF');
    expect(mark.subarray(8, 12).toString()).toBe('WEBP');
    expect(markData()).toMatch(/^data:image\/webp;base64,/);
    // VP8 (lossy) frame header: the picture is 384 px square (the mark is drawn at most 132 CSS px wide).
    const at = mark.indexOf('VP8 ') + 8 + 6;
    expect([mark.readUInt16LE(at) & 0x3fff, mark.readUInt16LE(at + 2) & 0x3fff]).toEqual([384, 384]);
    expect(boot).toMatch(/\.boot-mark\{width:clamp\(88px,15vmin,132px\)/);
  });
  it('follows the real load: the sizes of the files the page loads before the game, counted as each completes', () => {
    const html = '<script type="module" crossorigin src="/assets/index-AAAA1111.js"></script><link rel="modulepreload" crossorigin href="/assets/three-BBBB2222.js"><link rel="stylesheet" crossorigin href="/assets/index-CCCC3333.css">';
    const sizes: Record<string, number> = { 'index-AAAA1111.js': 4_700_000, 'three-BBBB2222.js': 740_000, 'index-CCCC3333.css': 160_000 };
    // (In the page's order, by position: the page names its entry once, in its module script.)
    expect(bootBytes(html, file => sizes[file])).toEqual([4_700_000, 740_000, 160_000]);
    expect(bootBytes(html.replace(/"\/assets\//g, '"./assets/'), file => sizes[file])).toEqual([4_700_000, 740_000, 160_000]);
    expect(index).toContain("document.querySelectorAll('script[type=\"module\"][src],link[rel=\"modulepreload\"][href],link[rel=\"stylesheet\"][href]')");
    expect(index).toContain(BYTES_TOKEN);
    expect(index).toMatch(/new PerformanceObserver\(/);
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/hud\.ready\(\);bootDone\(\);/);
  });
  it('keeps still for prefers-reduced-motion, never takes a click, and gives way to an error', () => {
    expect(boot).toMatch(/@media \(prefers-reduced-motion:reduce\)\{#boot \*\{animation:none!important\}/);
    expect(boot).toMatch(/#boot\{[^}]*pointer-events:none/);
    expect(index).toMatch(/addEventListener\('error',function\(\)\{if\(!boot\.dataset\.done\)window\.__bootDone\(\);\}\)/);
  });
});

/** Under a folder of its own the host answers every root address (`/assets/...`) with a redirect into the build, never
 *  cached. The bundle's addresses are relative, and the game's own asset addresses go inside the page's folder. */
describe('inside the build: relative bundle, asset addresses in the page\'s folder', () => {
  it('builds with a relative base, and still moves the stylesheet after #app', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toMatch(/\n  base: '\.\/',\n/);
    expect(config).toContain('href="\\.?\\/assets\\/[^"]+\\.css"');
  });
  it('puts a root asset address inside the page\'s folder, and changes nothing at a site\'s root', () => {
    expect(siteUrl('/assets/fighters/taisei.glb', '/')).toBe('/assets/fighters/taisei.glb');
    expect(siteUrl('/assets/fighters/taisei.glb', '/~b1/')).toBe('/~b1/assets/fighters/taisei.glb');
    expect(siteUrl('/assets/home/fighters/x.webp?v=abc', '/~b1/')).toBe('/~b1/assets/home/fighters/x.webp?v=abc');
    expect(siteUrl('/~b1/assets/x.glb', '/~b1/')).toBe('/~b1/assets/x.glb'); // already inside: as it is
    expect(siteUrl('/index.html', '/~b1/')).toBe('/index.html'); // the stale-build probes ask the root on purpose
    expect(siteUrl('/matchmake', '/~b1/')).toBe('/matchmake');
    expect(siteUrl('https://elsewhere.test/assets/x.png', '/~b1/')).toBe('https://elsewhere.test/assets/x.png');
  });
  it('asks for every /assets/ file inside the build under a folder of its own, and never for the version list there', async () => {
    const seen: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL) => { seen.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); return new Response('ok'); });
    try {
      vi.stubGlobal('window', { fetch }); vi.stubGlobal('location', new URL(P2));
      vi.resetModules();
      const { versioned } = await import('../src/loading/assetVersions');
      const w = (globalThis as unknown as { window: { fetch: typeof globalThis.fetch } }).window;
      await w.fetch('/assets/fighters/taisei-kr1.glb'); await w.fetch('/api/economy/me');
      expect(seen).toEqual(['/~b1/assets/fighters/taisei-kr1.glb', '/api/economy/me']);
      expect(versioned('/assets/x.png')).toBe('/~b1/assets/x.png');
      const { mediaArt } = await import('../src/ui/mediaArt');
      expect(mediaArt('/assets/home/portraits/taisei.webp')).toMatch(/^\/~b1\/assets\/home\/portraits\/taisei\.webp/);
    } finally { vi.unstubAllGlobals(); vi.resetModules(); }
  });
  it('reads the version list at a site\'s root as before, its preload made by the page at the root only', async () => {
    const seen: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL) => { const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url; seen.push(url);
      return url === '/asset-versions.json' ? new Response(JSON.stringify({ files: { 'assets/x.glb': 'abc123' } }), { headers: { 'content-type': 'application/json' } }) : new Response('ok'); });
    try {
      vi.stubGlobal('window', { fetch }); vi.stubGlobal('location', new URL(SITE));
      vi.resetModules();
      await import('../src/loading/assetVersions');
      const w = (globalThis as unknown as { window: { fetch: typeof globalThis.fetch } }).window;
      await w.fetch('/assets/x.glb');
      expect(seen).toEqual(['/asset-versions.json', '/assets/x.glb?v=abc123']);
    } finally { vi.unstubAllGlobals(); vi.resetModules(); }
    expect(readFileSync('index.html', 'utf8')).toContain("if(sizes.length&&location.pathname.lastIndexOf('/')===0){var pre=document.createElement('link');pre.rel='preload';pre.as='fetch';pre.crossOrigin='anonymous';pre.href='asset-versions.json';");
  });
});
