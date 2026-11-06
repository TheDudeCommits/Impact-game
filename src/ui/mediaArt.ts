import versions from './mediaArtVersions.json';

/** Image, SVG and CSS URLs bypass the fetch cache wrapper. Changed media uses its own content hash. */
export function mediaArt(url: string): string {
  const hash = (versions as Record<string, string>)[url];
  return hash ? `${url}?v=${hash}` : url;
}
