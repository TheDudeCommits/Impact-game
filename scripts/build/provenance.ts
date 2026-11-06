
import { measureOwnFigure, type FigureRow } from '../../src/originals/homeFigure';

/** Keys that say where something came from, who made it and under what terms. Technical `source*` fields (a sprite's
 *  `sourceRect`, a voice line's `sourceStart`, `sourceWindow`, ...) are what the game reads and stay. */
const PROVENANCE_KEYS = new Set([
  'source', 'sourceUrl', 'sourceTitle', 'sourceType', 'sourceAsset', 'sourceArchiveSha256', 'sourceSha256', 'sourceFile', 'sourceFiles',
  'sourceUploader', 'sourceActor', 'sourceSpeakerEvidence', 'previousSourceFile', 'metadataFile', 'portraitSource', 'originalSource',
  'subtitleProvenance', 'uploader', 'rights', 'rightsNote', 'license', 'licence', 'licenseUrl', 'licenceUrl', 'author', 'authorUrl',
  'attribution', 'credit', 'credits', 'provenance', 'processing', 'verification', 'sourceZipSha256', 'sourceZipBytes',
  'sources', 'sourcePages', 'voiceSource', 'timingNotes', 'visualReview', 'audioPairing',
]);

// runtimeSha256 is a technical cache key used by HTMLAudioElement, which bypasses the fetch wrapper.
// Preserve it just like sprite sha256/posterSha256 so a production build can invalidate replaced media.

/** A copy of a parsed JSON value without its provenance keys, at any depth. */
export function stripProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripProvenance);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PROVENANCE_KEYS.has(key)).map(([key, item]) => [key, stripProvenance(item)]));
}

/** Homepage sheets keep every authored cel and source receipt in git. The player needs only
 * geometry, timing and cache versions; embedding thousands of review records wastes download
 * and parse time before the menu opens. Keep this projection specific to these two imports. */
export function runtimeAssetManifest(value: unknown, id: string): unknown {
  const manifest = stripProvenance(value) as Record<string, unknown>;
  if (!manifest || typeof manifest !== 'object') return manifest;
  const normalized = id.replaceAll('\\', '/');
  const pick = (row: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
  if (normalized.endsWith('/public/assets/home/sprites/manifest.json') && Array.isArray(manifest.fighters)) {
    return { fighters: manifest.fighters.map(row => ({
      // bodyHeight, reachHeight/Width and posterReachHeight/Width: a sheet drawn with room for a swung weapon or a leap
      // (HomePreview's poseZoom).
      ...pick(row, ['id', 'sha256', 'posterSha256', 'columns', 'frameCount', 'heroFrame', 'bodyHeight', 'reachHeight', 'reachWidth', 'posterReachHeight', 'posterReachWidth']),
      ...(measureOwnFigure(row as FigureRow) ? { figure: measureOwnFigure(row as FigureRow) } : {}),
      ...(row.timing ? { timing: pick(row.timing, ['frameTimesMs', 'loopMs', 'loopStartFrame']) } : {}),
      ...(row.motionTiming ? { motionTiming: pick(row.motionTiming, ['frameTimesMs', 'loopMs', 'loopStartFrame']) } : {}),
      ...(Array.isArray(row.runtimePages) ? { runtimePages: row.runtimePages.map((page: Record<string, unknown>) =>
        pick(page, ['file', 'sha256', 'firstFrame', 'frameCount', 'width', 'height', 'bytes'])) } : {}),
    })) };
  }
  if (normalized.endsWith('/public/assets/audio/home/manifest.json') && Array.isArray(manifest.assets)) {
    return { assets: manifest.assets.map(row => pick(row, ['fighter', 'file', 'runtimeSha256'])) };
  }
  return manifest;
}

/** The bundled JSON whose provenance is taken out at build time: anything imported from public/assets, and the
 *  ambience beds' list (its `source` names each recording's author and licence). */
export const STRIPPED_JSON = /[\\/](public[\\/]assets[\\/].+|src[\\/]audio[\\/]data[\\/]ambience)\.json$/;

/** Provenance manifests the game never fetches (it bundles what it needs of them, stripped). */
const PROVENANCE_MANIFESTS = new Set([
  'assets/fighters/manifest.json', 'assets/audio/home/manifest.json', 'assets/music/manifest.json', 'assets/audio/v2/manifest.json',
  'assets/home/manifest.json', 'assets/home/sprites/manifest.json', 'assets/audio/survival/boss-voices.json', 'assets/environment/br/parts.json',
]);

/** The credits page's path in the package (scripts/build/credits.ts writes it; src/ui/legalLinks.ts links it). */
export const CREDITS_FILE = 'credits.html';

/** Whether a package path is a licence, credit or provenance file, which the public site never carries (the credits
 *  page apart; and robots.txt, the search engines' file, is not a note: 18 October 2026). */
export const isCreditFile = (file: string) => file !== CREDITS_FILE && file !== 'robots.txt' && (/\.(md|txt)$/i.test(file)
  || /(^|\/)(licen[cs]e|credits?|attribution|notice|ofl)[^/]*$/i.test(file)
  || PROVENANCE_MANIFESTS.has(file)
  || /^assets\/(environment|audio|objectives)\/.*manifest[^/]*\.json$/.test(file));

/** What a credit or provenance note looks like inside a published file. */
const MARKERS: readonly [string, RegExp][] = [
  ['a YouTube source', /youtube\.com\/watch|youtu\.be\//i],
  ['a rights note', /rights? not (cleared|established)|licen[cs]e not established|not cleared/i],
  ['a Creative Commons credit', /\bCC[- ]BY\b|Creative Commons|CC Attribution|Sketchfab/],
  ['a provenance field', /"(sourceUrl|sourceTitle|uploader|sourceUploader|rightsNote|attribution)"\s*:/],
];
/** The markers a published text file still carries (empty: clean). The credits page (`file`: CREDITS_FILE) may carry
 *  Creative Commons credits, and nothing else of the kind. */
export const creditMarkers = (text: string, file?: string) =>
  MARKERS.filter(([name, re]) => !(file === CREDITS_FILE && name === 'a Creative Commons credit') && re.test(text)).map(([name]) => name);
