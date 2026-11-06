import refreshedArt from './moveArtVersions.json';
import { areaCardWithheld } from '../originals/ownArt';
import type { FighterId } from '../game/types';
import { packArt } from '../engine/packs/active';

/** Round 3c (CAM3). The move cards draw their art from one sheet per fighter
 *  (`--move-sheet`), and a transformation that changes the moves changes the
 *  sheet: Konta's Kurobi cards. The HUD used to swap the URL on the frame the
 *  form arrived, and until the new sheet had loaded and decoded the cards were
 *  five empty panels - about a second, measured on the second blind critic's
 *  capture (h1/konta, sheet-13-awaken). So a sheet is only put on the cards
 *  once it is decoded; until then the cards keep the art they have. And the
 *  sheets a fighter can transform into are fetched and decoded as the match
 *  starts, so the swap is immediate when the form arrives. */

/** A form whose moves are its own has a sheet of its own: Kurobi's, and Hawser's YUGE's (13 October 2026). */
const FORM_SHEETS: Partial<Record<FighterId, string>> = { konta: 'konta-kurobi', hawser: 'hawser-colossus' };
/** The sheet the cards show for `fighter`, awakened or not. */
export function moveSheetOf(fighter: FighterId, awakened: boolean) {
  return awakened ? FORM_SHEETS[fighter] ?? fighter : fighter;
}
/** Every sheet a fighter's cards may need during a match. */
export function moveSheetsFor(fighter: FighterId) {
  const base = moveSheetOf(fighter, false), awake = moveSheetOf(fighter, true);
  return awake === base ? [base] : [base, awake];
}
export const moveSheetUrl = (sheet: string) => packArt(sheet, 'moves') ?? `/assets/ui/moves/${sheet}.webp${sheet in refreshedArt?'?v='+refreshedArt[sheet as keyof typeof refreshedArt]:''}`;

/** Only published area illustrations have a version entry. Unreviewed fighters
 * keep the reticle without making a speculative request that would 404. */
export function areaArtUrl(fighter: string): string | undefined {
  const key = `area/${fighter}`;
  if (areaCardWithheld(fighter)) return undefined;
  const version = (refreshedArt as Record<string, string>)[key];
  return version ? `/assets/ui/moves/${key}.webp?v=${version}` : undefined;
}

export function warmAreaArt(fighter: string) {
  const url = areaArtUrl(fighter);
  if (url) void decodeMoveArt(url).catch(() => undefined);
}

/** Fetch and decode an image; resolves when it can be drawn without waiting.
 *  Kept alive in `held`, so the decoded copy stays in the memory cache the
 *  cards' background draws from. */
const held = new Map<string, HTMLImageElement>();
export function decodeMoveArt(url: string): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  let image = held.get(url);
  if (!image) { image = new Image(); image.decoding = 'async'; image.src = url; held.set(url, image); }
  return image.decode();
}

/** Which sheet the cards show, swapped only once the wanted one is decoded.
 *  `apply` puts a sheet on the cards; `load` resolves when a sheet can be drawn
 *  (the browser's decode by default - injectable for the tests). */
export class MoveSheet {
  /** The sheet on the cards now, and the one they are waiting for. */
  shown = '';
  private wanted = '';
  private ready = new Set<string>();
  private loading = new Map<string, Promise<void>>();
  constructor(private readonly apply: (sheet: string) => void, private readonly load: (sheet: string) => Promise<void> = sheet => decodeMoveArt(moveSheetUrl(sheet)).catch(() => undefined)) {}
  /** Start fetching a sheet the cards will need, without showing it. */
  warm(sheet: string) { void this.fetch(sheet); warmAreaArt(sheet); }
  /** A new match: its fighter's sheet goes on at once - the last match's art
   *  is not something to keep - and draws as it arrives. */
  now(sheet: string) { this.wanted = sheet; this.put(sheet); void this.fetch(sheet); }
  /** Mid-match (a transformation, or its end): show `sheet` as soon as it can
   *  be drawn - at once when it already can, otherwise when it has decoded,
   *  unless something else is wanted by then. The cards keep the art they
   *  have meanwhile. */
  want(sheet: string) {
    this.wanted = sheet;
    if (sheet === this.shown) return;
    if (this.ready.has(sheet) || !this.shown) { this.now(sheet); return; }
    void this.fetch(sheet).then(() => { if (this.wanted === sheet && this.shown !== sheet) this.put(sheet); });
  }
  private put(sheet: string) { this.shown = sheet; this.apply(sheet); }
  private fetch(sheet: string) {
    let pending = this.loading.get(sheet);
    if (!pending) { pending = this.load(sheet).then(() => { this.ready.add(sheet); }); this.loading.set(sheet, pending); }
    return pending;
  }
}
