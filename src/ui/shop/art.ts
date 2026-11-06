import type { FighterId } from '../../game/types';
import { mangaPortrait } from '../MangaHome';

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The inside of a card's art panel (and, larger, of the detail's, until the fighter stands there in 3D). */
export function fighterArt(fighter: FighterId, glyph?: string): string {
  return `<span class="shop-art k-fighter" data-art="${fighter}"><span class="shop-art-face">${mangaPortrait(fighter)}</span>${glyph ? `<b>${escape(glyph)}</b>` : ''}</span>`;
}
