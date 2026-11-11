import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_FILES } from '../scripts/build/brandFiles';
import { HOME_ASSETS } from '../src/ui/MangaHome';
import { ROSTER_REFRESH_MESSAGE } from '../src/game/rosterProtocol';
import { joinFailure } from '../src/network';
import { brandIndexHtml, brandManifest, brandPrivacyHtml } from '../scripts/build/brandPlugin';
import { CONTACT, DESCRIPTION, OG_IMAGE, OG_IMAGE_ALT, PUBLIC_URL, SHORT_TITLE, TITLE } from '../src/originals/brand';

const html = brandIndexHtml(fs.readFileSync('index.html', 'utf8'));
const meta = (attr: 'name' | 'property', key: string) => html.match(new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`))?.[1];
const png = (file: string) => { const b = fs.readFileSync(file); expect(b.subarray(1, 4).toString()).toBe('PNG'); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
function jpeg(file: string) {
  const b = fs.readFileSync(file);
  for (let i = 2; i < b.length;) { const marker = b[i + 1], length = b.readUInt16BE(i + 2); if (marker >= 0xc0 && marker <= 0xc2) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) }; i += 2 + length; }
  throw new Error('no frame header');
}

describe('the name, the metadata and the icons (brand.ts)', () => {
  it('names the game by brand.ts where a player sees it, and no longer Rift Arena', () => {
    expect(html).toContain(`<title>${TITLE}</title>`);
    for (const file of ['index.html', 'src/ui/BugReport.ts']) expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/Rift Arena|RIFT ARENA|Manga Impact<\/title>/);
  });
  it('describes it for search and for a shared link, with a preview image of its real size', () => {
    expect(meta('name', 'description')).toMatch(/arena fighter/i);
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:url')).toBe(PUBLIC_URL);
    expect(meta('property', 'og:site_name')).toBe(TITLE);
    expect(meta('property', 'og:title')).toBe(TITLE);
    expect(meta('property', 'og:description')).toBe(DESCRIPTION);
    // (Relative to the page: a host would be an address besides the public one.)
    expect(meta('property', 'og:image')).toBe(OG_IMAGE ? OG_IMAGE.slice(1) : undefined);
    expect(meta('property', 'og:image:alt')).toBe(OG_IMAGE ? OG_IMAGE_ALT : undefined);
    if (OG_IMAGE) expect(jpeg(`public${OG_IMAGE}`)).toEqual({ width: 1200, height: 630 });
    expect([meta('property', 'og:image:width'), meta('property', 'og:image:height')]).toEqual(OG_IMAGE ? ['1200', '630'] : [undefined, undefined]);
    if (OG_IMAGE) expect(fs.statSync(`public${OG_IMAGE}`).size).toBeLessThan(300 * 1024);
    expect(meta('name', 'twitter:card')).toBe(OG_IMAGE ? 'summary_large_image' : 'summary');
    expect(meta('name', 'twitter:image')).toBe(meta('property', 'og:image'));
    expect(meta('name', 'twitter:title')).toBe(TITLE);
    for (const key of ['theme-color', 'application-name', 'apple-mobile-web-app-title']) expect(meta('name', key), key).toBeTruthy();
  });
  it('has its tab icon, touch icon and manifest at the root, each one a file that ships', () => {
    const linked = [...html.matchAll(/<link [^>]*href="\/([^"]+)"/g)].map(m => m[1]);
    expect(linked).toEqual(expect.arrayContaining(['favicon.svg', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'site.webmanifest']));
    expect(html).not.toMatch(/rel="icon" href="data:/);
    const manifest = JSON.parse(brandManifest(fs.readFileSync('public/site.webmanifest', 'utf8')));
    expect(manifest).toMatchObject({ name: TITLE, short_name: SHORT_TITLE, start_url: '/' });
    const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];
    expect(icons.find(i => i.purpose === 'maskable')?.src).toBe('/icon-maskable-512.png');
    for (const icon of icons.filter(i => i.sizes !== 'any')) { const [w, h] = icon.sizes.split('x').map(Number); expect(png(`public${icon.src}`), icon.src).toEqual({ width: w, height: h }); }
    expect(png('public/favicon-16.png')).toEqual({ width: 16, height: 16 });
    expect(png('public/favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(png('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    const ico = fs.readFileSync('public/favicon.ico');
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 3]);
    const svg = fs.readFileSync('public/favicon.svg', 'utf8');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* viewBox="0 0 64 64"/);
    expect(svg.length).toBeLessThan(2048);
    const home = HOME_ASSETS.map(url => url.split(/[?#]/, 1)[0].slice(1));
    for (const file of [...linked, ...icons.map(i => i.src.slice(1)), ...(OG_IMAGE ? [new URL(meta('property', 'og:image')!, 'https://play.example.com/').pathname.slice(1)] : [])]) {
      if (file.startsWith('assets/')) expect(home, file).toContain(file);
      else expect(BRAND_FILES, file).toContain(file);
      expect(fs.existsSync(`public/${file}`), file).toBe(true);
    }
  });
});

describe('the title, in every page title', () => {
  it('says so in the title of the privacy page', () => {
    expect(brandPrivacyHtml(fs.readFileSync('public/privacy.html', 'utf8'))).toContain(`<title>Privacy — ${TITLE}</title>`);
  });
});

describe('the game is named by brand.ts', () => {
  const files = (dir: string): string[] => fs.readdirSync(dir).flatMap(name => { const path = `${dir}/${name}`; return fs.statSync(path).isDirectory() ? (name === 'vendor' ? [] : files(path)) : /\.(ts|css|html|webmanifest|json)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : []; });
  /** A source file without its comments (the history the comments tell keeps the old name). */
  const spoken = (file: string) => { const text = fs.readFileSync(file, 'utf8'); return /\.(ts|css)$/.test(file) ? text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1') : text; };
  const privacy = brandPrivacyHtml(fs.readFileSync('public/privacy.html', 'utf8'));

  it('says brand.ts\'s title in the title, the tags, the manifest and the privacy page', () => {
    expect(html).toContain(`<title>${TITLE}</title>`);
    expect(meta('name', 'application-name')).toBe(TITLE);
    expect(meta('name', 'apple-mobile-web-app-title')).toBe(SHORT_TITLE);
    for (const [attr, key] of [['property', 'og:site_name'], ['property', 'og:title'], ['name', 'twitter:title']] as const) expect(meta(attr, key), key).toBe(TITLE);
    expect(privacy).toMatch(new RegExp(`<p class="eyebrow">${TITLE.toUpperCase()} / `));
    expect(privacy).toContain(`<p class="intro">${TITLE} is a free, open-source browser game.`);
    expect(privacy).toContain(`<footer>${TITLE} · `);
  });


  // The pages name the public address (brand.ts PUBLIC_URL) wherever they write one, and the game's own site nowhere: no
  // host under the contact address's domain, and no Player Two address.
  it('names the public address wherever these pages write an address, and keeps the repository and the saved keys', () => {
    expect(meta('property', 'og:url')).toBe(PUBLIC_URL);
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC_URL}">`);
    const siteHost = new RegExp(`[a-z0-9-]+\\.${CONTACT!.split('@')[1].replace(/\./g, '\\.')}|playertwo`, 'i');
    for (const file of ['index.html', 'public/privacy.html', 'public/site.webmanifest']) expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(siteHost);
    // The one GitHub address the pages carry is the game's own repository (legalLinks.ts REPO_PAGE).
    expect(fs.readFileSync('src/ui/legalLinks.ts', 'utf8')).toMatch(/export const REPO_PAGE = 'https:\/\/github\.com\/TheDudeCommits\/Impact-game';/);
    for (const file of ['public/privacy.html', 'public/terms.html']) expect([...fs.readFileSync(file, 'utf8').matchAll(/https:\/\/github\.com[^"' <]*/g)].map(m => m[0]).every(url => url === 'https://github.com/TheDudeCommits/Impact-game'), file).toBe(true);
    expect(fs.readFileSync('src/ui/firstVisit.ts', 'utf8')).not.toMatch(/github\.com/i); // (through REPO_PAGE)
    expect(fs.readFileSync('src/ui/firstVisit.ts', 'utf8')).toContain("NOTICE_KEY = 'jump-fan-notice'");
  });

  it('asks for a refresh without naming a title, on the server and in the page', () => {
    expect(ROSTER_REFRESH_MESSAGE).toBe('Refresh the page to load the updated fighter roster.');
    expect(joinFailure(new Error(ROSTER_REFRESH_MESSAGE))).toBe(ROSTER_REFRESH_MESSAGE);
    for (const file of ['src/server/SurvivalRoom.ts', 'src/server/social/PartyRoom.ts', 'src/server/moba/RiftRoom.ts', 'src/server/moba/publicMatchmaker.ts', 'src/server/objectives/ObjectiveRoom.ts']) {
      expect(spoken(file), file).toMatch(/[Rr]efresh the page /);
      expect(spoken(file), file).not.toMatch(/[Rr]efresh Impact /);
    }
  });

  it('draws the name as brand.ts has it where it is drawn: the boot text, the share card and the sign-in panel', () => {
    expect(html).toContain(`<b class="boot-word">${TITLE.toUpperCase()}</b>`);
    expect(html).toContain(`<div id="app" data-brand="${TITLE.toUpperCase()}"></div>`);
    expect(fs.readFileSync('src/ui/survival/shareCard.ts', 'utf8')).toMatch(/fillText\(TITLE\.toUpperCase\(\),/);
    expect(fs.readFileSync('src/ui/shop/privy.ts', 'utf8')).toContain('landingHeader: `Sign in to ${TITLE}`');
  });
});
