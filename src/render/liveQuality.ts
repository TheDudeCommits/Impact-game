import { loadSettings, type Settings } from '../config';

/**
 * The graphics quality the page is drawn at now, for the parts of a place built or rebuilt away from the renderer: the
 * ground (render/ground/quality.ts: grass, flowers, water, footprints) and the near scenery (render/stages/near.ts).
 *
 * They read the SAVED settings until November 2026, and a player who never touched OPTIONS has nothing saved: the
 * quality the machine picked (render/qualityTier.ts AUTO: every phone on LOW) never reached them, and a phone drew the
 * High tier's grass (34 m of blades), its GPU water at 60 Hz, its footprints and the whole near scenery. On a phone or a
 * tablet GameRenderer puts its quality here every time it applies one (boot, AUTO's pick, the watch's step down, a menu
 * change), so these read what the renderer draws. Where it has put none - a desktop, which keeps its ground as it was,
 * and the tests - the saved quality, as before.
 */
let live: Settings['quality'] | undefined;
export function setLiveQuality(quality: Settings['quality'] | undefined) { live = quality; }
export function liveQuality(): Settings['quality'] {
  if (live) return live;
  try { return loadSettings().quality; } catch { return 'high'; }
}
