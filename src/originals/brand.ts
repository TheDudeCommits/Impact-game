/** The game's name, its site and its contacts, in one place.
 *
 *  Change anything here and everything follows: index.html (the tab title, the description, the canonical link and the
 *  social-preview tags), public/privacy.html, public/terms.html and public/site.webmanifest, which
 *  scripts/build/brandPlugin.ts fills from this file when Vite builds or serves them; invite links, the first-visit
 *  notice, the CREDITS & LEGAL panel (src/ui/legal.ts) and every in-game line that names the game.
 *
 *  What depends on where the game is deployed comes from the environment (Vite's VITE_* variables, or the same names in
 *  process.env for the build plugins and tests), with defaults for a local checkout:
 *    VITE_SITE_URL        where the game is served (default http://localhost:5173)
 *    VITE_SERVER_HOST     who hosts the game server, as the privacy page names it (default: none named)
 *    VITE_DISCORD_INVITE  the community invite behind the party page's Discord button (default: no button)
 *
 *  src/game, src/survival and src/server must not import this file (the match server builds them alone). */
export interface BrandValues {
  /** The game's name, written exactly so (a wordmark may set it in capitals). Plain words: some screens set it into their markup as it is. */
  TITLE: string;
  /** The label under an installed icon (best kept to about 12 characters). */
  SHORT_TITLE: string;
  /** Where the game is served, without a trailing slash: the canonical link and the shared link's address. */
  SITE_URL: string;
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
  SITE_URL: (setting('VITE_SITE_URL') ?? 'http://localhost:5173').replace(/\/+$/, ''),
  DESCRIPTION: 'A free arena fighter in your browser, with a cast of original characters made for it. Pick a fighter and jump in.',
  OG_IMAGE: '/og-impact.jpg',
  OG_IMAGE_ALT: 'An in-game frame of Impact: Konta and his clones landing a blow in the Proving Hall, rubble flying.',
  DISCORD_INVITE: setting('VITE_DISCORD_INVITE') ?? null,
  SERVER_HOST: setting('VITE_SERVER_HOST') ?? null,
  CONTACT: 'Hello@Dude.work',
};

export const TITLE = BRAND.TITLE;
export const SHORT_TITLE = BRAND.SHORT_TITLE;
export const SITE_URL = BRAND.SITE_URL;
export const DESCRIPTION = BRAND.DESCRIPTION;
export const OG_IMAGE: string | null = BRAND.OG_IMAGE;
export const OG_IMAGE_ALT = BRAND.OG_IMAGE_ALT;
export const DISCORD_INVITE: string | null = BRAND.DISCORD_INVITE;
export const SERVER_HOST: string | null = BRAND.SERVER_HOST;
export const CONTACT: string | null = BRAND.CONTACT;

/** CONTACT as a link target: a page as it is, an address as mailto:. */
export const contactHref = (contact: string) => /^https?:\/\//i.test(contact) ? contact : `mailto:${contact}`;
