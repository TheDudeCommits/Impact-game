/** polish8 (5 November 2026): each home figure at Impact's size for its slot (src/originals/homeFigure.ts), as HomePreview.ts asks
 *  for it. A built page's sprite manifest carries each sheet's measure (`figure`, scripts/build/provenance.ts); the repository's, as
 *  the dev server and the tests read it, carries the per-cel bounds the measure is made of. */
import spriteManifest from '../../public/assets/home/sprites/manifest.json';
import type { FighterId } from '../game/types';
import { fitFigure, measureOwnFigure, type FigureRow, type HomeFigureFit } from './homeFigure';

type Row = FigureRow & { figure?: [number, number, number] };
const ROWS = new Map((spriteManifest.fighters as unknown as Row[]).map(row => [row.id, row]));
const OWN = new Map<string, [number, number, number] | null>();
/** The sheet's own drawing: [median standing height, reach, half], pixels of its cel. */
export function ownFigure(id: FighterId): [number, number, number] | null {
  if (!OWN.has(id)) { const row = ROWS.get(id); OWN.set(id, row ? row.figure ?? measureOwnFigure(row) : null); }
  return OWN.get(id)!;
}
export const homeFigureFit = (id: FighterId, box: number, zoom: number, reference: number, width: number, height: number): HomeFigureFit =>
  fitFigure(id, ownFigure(id), box, zoom, reference, width, height, ROWS.get(id)?.cellHeight ?? 512);
