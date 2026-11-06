import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { HOME_PAGES, HOME_ROSTER } from '../src/ui/MangaHome';
import { homeRosterPages } from '../src/ui/HomeRosterOrder';
import { poseZoomFor } from '../src/ui/HomePreview';
import spriteManifest from '../public/assets/home/sprites/manifest.json';
import { IMPACT_FIGURE, measureOwnFigure, type FigureRow } from '../src/originals/homeFigure';
import { homeFigureFit, ownFigure } from '../src/originals/homeFigureFit';
import { runtimeAssetManifest } from '../scripts/build/provenance';

describe('the home screen keeps Impact\'s places', () => {
  it('puts every slot on the page, in the wing and in the cell Impact does', () => {
    const impact = homeRosterPages(RELEASED_FIGHTERS);
    expect(HOME_PAGES.map(page => [page.left, page.right])).toEqual(impact.map(page => [page.left, page.right]));
  });
  it('has Impact\'s figure size for every slot on the home, and each original\'s own drawing measured, in the build too', () => {
    // The build ships the sprite manifest without its per-cel bounds (scripts/build/provenance.ts): its projection carries each
    // sheet's measure instead, which must be the one the bounds give.
    const built = new Map((runtimeAssetManifest(spriteManifest, '/r/public/assets/home/sprites/manifest.json') as { fighters: (FigureRow & { figure?: number[] })[] }).fighters.map(row => [row.id, row]));
    const rows = new Map((spriteManifest.fighters as unknown as FigureRow[]).map(row => [row.id, row]));
    for (const id of HOME_ROSTER) {
      expect(IMPACT_FIGURE[id], id).toBeDefined();
      expect(ownFigure(id), id).not.toBeNull();
      expect(built.get(id)?.figure, `${id}: the built manifest's figure`).toEqual(measureOwnFigure(rows.get(id)!));
      expect((built.get(id) as { frames?: unknown }).frames, id).toBeUndefined();
    }
  });
  it('draws each figure at Impact\'s height (or as tall as the preview allows), never past the preview', () => {
    // The desktop preview at 1280 x 720 (HomePreview's canvas: 358 x 406), and a phone's (844 x 390: 198 x 228).
    for (const [width, height] of [[358, 406], [198, 228]]) {
      const reference = Math.min(height, width * 512 / 384);
      for (const id of HOME_ROSTER) {
        const box = reference * Math.min(1, (FIGHTERS[id].height ?? 1.8) / 2.04), zoom = poseZoomFor(id, box, width, height);
        const [median, reach, half] = ownFigure(id as FighterId)!, fit = homeFigureFit(id, box, zoom, reference, width, height), drawn = box * zoom / 512 * fit.scale;
        const top = reach * drawn + fit.lift, side = half * drawn;
        expect(top, `${id}: top`).toBeLessThanOrEqual(.97 * height + 1e-6);
        expect(side, `${id}: side`).toBeLessThanOrEqual(.97 * width / 2 + 1e-6);
        const wanted = IMPACT_FIGURE[id]![0] * reference, got = median * drawn;
        // At Impact's height, or held down by the preview (its tallest cel then reaches the line kept clear at the top or a side).
        if (Math.abs(got - wanted) > .005 * wanted) expect(got < wanted && (top >= .97 * height - .5 || side >= .97 * width / 2 - .5), `${id}: ${got.toFixed(1)} px for ${wanted.toFixed(1)}`).toBe(true);
      }
    }
  });
});
