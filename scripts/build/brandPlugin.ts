import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import * as brand from '../../src/originals/brand.ts';

/** What the pages name (brand.ts by default; a test may pass others). */
export interface Brand { TITLE: string; SHORT_TITLE: string; PUBLIC_URL: string; DESCRIPTION: string; OG_IMAGE: string | null; OG_IMAGE_ALT: string; CONTACT: string | null; DISCORD_INVITE: string | null; SERVER_HOST: string | null }

const html = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const json = (s: string) => JSON.stringify(s).slice(1, -1);

/** The plain values a page may name (escaped for the file they go in). */
const plain = (b: Brand): Record<string, string> => ({
  TITLE: b.TITLE, TITLE_UPPER: b.TITLE.toUpperCase(), SHORT_TITLE: b.SHORT_TITLE, DESCRIPTION: b.DESCRIPTION,
  // The public address (brand.ts PUBLIC_URL), the only one a page names; the site the build is served from has no token.
  PUBLIC_URL: b.PUBLIC_URL, PUBLIC_ADDRESS: b.PUBLIC_URL.replace(/^https?:\/\//, ''),
});

/** Fills `text`'s tokens: `markup` ones as they are, the plain ones through `escape`. Throws on a token it doesn't know. */
export function fill(text: string, file: string, escape: (s: string) => string, markup: Record<string, string> = {}, b: Brand = brand) {
  const values = plain(b);
  const out = text.replace(/\{\{([A-Z_]+)\}\}/g, (token, key: string) => key in markup ? markup[key] : key in values ? escape(values[key]) : token);
  const left = out.match(/\{\{[A-Z_]+\}\}/);
  if (left) throw new Error(`${file}: unknown brand token ${left[0]} (scripts/build/brandPlugin.ts)`);
  return out;
}

/** The link-preview card's tags, or none while brand.ts has no card (twitter:card then falls back to 'summary').
 *  The card is named relative to the page: a host would be an address besides the public one, and a preview of this
 *  page reads it from wherever the page is served. */
function socialImage(b: Brand) {
  if (!b.OG_IMAGE) return '';
  const url = html(b.OG_IMAGE.replace(/^\//, '')), alt = html(b.OG_IMAGE_ALT);
  return `<meta property="og:image" content="${url}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n`
    + `<meta property="og:image:alt" content="${alt}"><meta name="twitter:image" content="${url}"><meta name="twitter:image:alt" content="${alt}">\n`;
}

/** CONTACT as a link. */
const contactLink = (contact: string) => `<a href="${html(brand.contactHref(contact))}">${html(contact.replace(/^mailto:/i, ''))}</a>`;
/** How to reach whoever runs the site, as a sentence, or a line saying contact details will be added. */
export function contactSentence(b: Brand) {
  return b.CONTACT ? `For anything about this page or your data, write to ${contactLink(b.CONTACT)}.` : 'Contact details will be added to this page.';
}
/** How a player who can no longer reach their account has it deleted. */
const contactDelete = (b: Brand) => b.CONTACT
  ? `write to ${contactLink(b.CONTACT)} with the account ID shown under ACCOUNT, or with how you signed in, and it will be deleted for you.`
  : 'a way to have it deleted for you will be added to this page.';
/** Who hosts the game server (brand.ts SERVER_HOST), or word that it will be named. */
const serverLine = (b: Brand) => b.SERVER_HOST
  ? `<strong>${html(b.SERVER_HOST)}</strong> hosts the game server, which runs the online matches and parties and keeps the accounts.`
  : '<strong>A hosting provider</strong> runs the game server, which runs the online matches and parties and keeps the accounts. Its name will be added to this page.';

/** The pages' own notes for whoever edits them (`<!-- note: ... -->`) never ship. */
const unnoted = (text: string) => text.replace(/[ \t]*<!-- note:[^]*?-->\r?\n?/g, '');

export const brandIndexHtml = (text: string, b: Brand = brand) =>
  fill(unnoted(text), 'index.html', html, { SOCIAL_IMAGE: socialImage(b), TWITTER_CARD: b.OG_IMAGE ? 'summary_large_image' : 'summary' }, b);
/** The privacy page's Discord line: only while the game shows a Discord button (brand.ts DISCORD_INVITE). */
const discordLine = (b: Brand) => b.DISCORD_INVITE
  ? '<li><strong>Discord</strong> hosts the community that the party page\'s DISCORD button opens, on Discord\'s own site in a new tab. The game sends Discord nothing; Discord\'s own privacy policy covers what it keeps.</li>'
  : '';
export const brandPrivacyHtml = (text: string, b: Brand = brand) =>
  fill(unnoted(text), 'privacy.html', html, { CONTACT: contactSentence(b), CONTACT_DELETE: contactDelete(b), SERVER: serverLine(b), DISCORD: discordLine(b) }, b);
export const brandTermsHtml = (text: string, b: Brand = brand) => fill(unnoted(text), 'terms.html', html, {}, b);
export function brandManifest(text: string, b: Brand = brand) {
  const out = fill(text, 'site.webmanifest', json, {}, b);
  JSON.parse(out);
  return out;
}

/** The public files filled here, by their address on the site. */
const PUBLIC: Record<string, { fill: (text: string) => string; type: string }> = {
  'privacy.html': { fill: text => brandPrivacyHtml(text), type: 'text/html; charset=utf-8' },
  'site.webmanifest': { fill: text => brandManifest(text), type: 'application/manifest+json; charset=utf-8' },
  'terms.html': { fill: text => brandTermsHtml(text), type: 'text/html; charset=utf-8' },
};

export function fillPublicPages(outDir: string) {
  for (const [name, page] of Object.entries(PUBLIC)) {
    const file = path.join(outDir, name);
    if (existsSync(file)) writeFileSync(file, page.fill(readFileSync(file, 'utf8')));
  }
}

export default function originalsBrand(): Plugin {
  let publicDir = '', outDir = '';
  return {
    name: 'impact-brand',
    configResolved(config) { publicDir = config.publicDir; outDir = path.resolve(config.root, config.build.outDir); },
    transformIndexHtml: { order: 'pre', handler: text => brandIndexHtml(text) },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? '').split(/[?#]/, 1)[0].replace(/^\//, ''), page = PUBLIC[name];
        if (!page || !publicDir || !existsSync(path.join(publicDir, name))) return next();
        res.setHeader('Content-Type', page.type);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(page.fill(readFileSync(path.join(publicDir, name), 'utf8')));
      });
    },
    // (Vite copies public/ into dist/ before it writes the bundle; a build without public/ has nothing to fill: fillPublicPages.)
    writeBundle() { fillPublicPages(outDir); },
  };
}
