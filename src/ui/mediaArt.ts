import versions from './mediaArtVersions.json';
import { siteUrl } from '../loading/siteBase';

/** Image, SVG and CSS URLs bypass the fetch cache wrapper. Changed media uses its own content hash. And, like every fetch,
 *  the address is inside the page's own folder (loading/siteBase.ts). */
export function mediaArt(url: string): string {
  const hash = (versions as Record<string, string>)[url];
  return siteUrl(hash ? `${url}?v=${hash}` : url);
}
