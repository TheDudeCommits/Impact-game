/** The game's name, its public address and its contacts, in one place.
 *
 *  Change anything here and everything follows: index.html (the tab title, the description, the canonical link and the
 *  social-preview tags), public/privacy.html, public/terms.html and public/site.webmanifest, which
 *  scripts/build/brandPlugin.ts fills from this file when Vite builds or serves them; invite links, the share card, the
 *  result link, the first-visit notice, the CREDITS & LEGAL panel (src/ui/legal.ts) and every in-game line that names
 *  the game.
 *
 *  What depends on where the game is deployed comes from the environment (Vite's VITE_* variables, or the same names in
 *  process.env for the build plugins and tests), with defaults for a local checkout:
 *    VITE_SERVER_HOST     who hosts the game server, as the privacy page names it (default: none named)
 *    VITE_DISCORD_INVITE  the community invite behind the party page's Discord button (default: no button)
 *  Where a build is served is not among them: nothing a build shows names it (code that needs it reads the page's own
 *  `location`).
 *
 *  src/game, src/survival and src/server must not import this file (the match server builds them alone). */
export interface BrandValues {
  /** The game's name, written exactly so (a wordmark may set it in capitals). Plain words: some screens set it into their markup as it is. */
  TITLE: string;
  /** The label under an installed icon (best kept to about 12 characters). */
  SHORT_TITLE: string;
  /** The game's public address, without a trailing slash: the only address any build shows, says, prints or tags - the
   *  canonical link, the share previews, the legal pages, the share card, invites and the result link. Where the build is
   *  served is never written into it: code that needs that takes it from the page's own `location`. */
  PUBLIC_URL: string;
  /** One line for search results and shared links. */
  DESCRIPTION: string;
  /** The link-preview card, a 1200x630 JPEG at the site's root, or null for none. */
  OG_IMAGE: string | null;
  /** What the preview card shows, for screen readers (og:image:alt). */
  OG_IMAGE_ALT: string;
  /** The party page's Discord invite, or null for no Discord button anywhere. */
  DISCORD_INVITE: string | null;
  /** Where the game server runs (its matches, parties and accounts), as the privacy page names its host, or null. */
  SERVER_HOST: string | null;
  /** Where takedown requests and questions about players' data go: an email address or a https:// page, or null. */
  CONTACT: string | null;
}

const viteEnv = (typeof import.meta.env === 'object' ? import.meta.env : {}) as Record<string, string | undefined>;
const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
/** A setting from Vite's environment, else the process's, else undefined (blank counts as unset). */
const setting = (name: string) => (viteEnv[name] ?? nodeEnv[name])?.trim() || undefined;

export const BRAND: Readonly<BrandValues> = {
  TITLE: 'Impact', SHORT_TITLE: 'Impact',
  PUBLIC_URL: 'https://playertwo.plus/game/impact',
  DESCRIPTION: 'A free arena fighter in your browser, with a cast of original characters made for it. Pick a fighter and jump in.',
  OG_IMAGE: '/og-image-impact.jpg',
  OG_IMAGE_ALT: 'The IMPACT wordmark beside four of its original fighters, drawn in colour over a red ink burst.',
  DISCORD_INVITE: setting('VITE_DISCORD_INVITE') ?? null,
  SERVER_HOST: setting('VITE_SERVER_HOST') ?? null,
  CONTACT: 'Hello@Dude.work',
};

export const TITLE = BRAND.TITLE;
export const SHORT_TITLE = BRAND.SHORT_TITLE;
export const PUBLIC_URL = BRAND.PUBLIC_URL;
/** PUBLIC_URL as it is written for people to read and type: without its scheme (playertwo.plus/game/impact). */
export const PUBLIC_ADDRESS = PUBLIC_URL.replace(/^https?:\/\//, '');
export const DESCRIPTION = BRAND.DESCRIPTION;
export const OG_IMAGE: string | null = BRAND.OG_IMAGE;
export const OG_IMAGE_ALT = BRAND.OG_IMAGE_ALT;
export const DISCORD_INVITE: string | null = BRAND.DISCORD_INVITE;
export const SERVER_HOST: string | null = BRAND.SERVER_HOST;
export const CONTACT: string | null = BRAND.CONTACT;

/** CONTACT as a link target: a page as it is, an address as mailto:. */
export const contactHref = (contact: string) => /^https?:\/\//i.test(contact) ? contact : `mailto:${contact}`;
