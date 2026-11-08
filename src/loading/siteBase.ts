/**
 * The folder the game's page is served from: `/` on play.example.com, a dev server or any copy at a site's root;
 * `/~<build>/` on Player Two, whose host keeps each build under a folder of its own and answers a root address of a file
 * (`/assets/x.glb`) with a redirect into the build its Referer names - a redirect that is never cached, costing a round trip
 * on every request of every visit, and a stale tab's lazy file looked for in the newest build (loading/staleBuild.ts). The
 * bundle's own addresses are relative (vite.config.ts `base`); the game's root-absolute asset addresses (`/assets/...`,
 * written all through the code) are put inside the build here, where they are asked for: every fetch
 * (loading/assetVersions.ts) and the media addresses (ui/mediaArt.ts). At a site's root this changes nothing at all.
 */
const page = typeof location === 'object' ? location.pathname : '/';
/** `/` or `/~<build>/`: the page's own folder (its address only ever changes its query and fragment). */
export const SITE_BASE = page.replace(/[^/]*$/, '') || '/';

/** A same-origin root address under /assets/ (or the version list), put inside the page's folder; any other as it is. */
export function siteUrl(url: string, base = SITE_BASE): string {
  if (base === '/' || typeof url !== 'string') return url;
  if (url.startsWith('/assets/') || url === '/asset-versions.json') return `${base}${url.slice(1)}`;
  if (typeof location !== 'object' || !/^https?:/i.test(url)) return url;
  let u: URL; try { u = new URL(url); } catch { return url; }
  if (u.origin !== location.origin || !(u.pathname.startsWith('/assets/') || u.pathname === '/asset-versions.json')) return url;
  return `${u.origin}${base}${u.pathname.slice(1)}${u.search}${u.hash}`;
}
