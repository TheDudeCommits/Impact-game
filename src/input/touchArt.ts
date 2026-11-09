import type { PlayerState } from '../game/types';
import { slotNames } from '../engine/client/transplant';
import { MoveCardArt } from '../ui/moveCardArt';
import { MoveSheet, moveSheetOf, moveSheetsFor, moveSheetUrl } from '../ui/moveSheet';
import { moveArtSource } from '../ui/hud/moveCards';
import { mangaPortrait } from '../ui/MangaHome';

/** The skill buttons' slots and their move sheets' panels (inked.ts ART_X; the area move's own picture is panel 4). */
const SKILLS = [['heavy', 1], ['special', 2], ['ultimate', 3], ['area', 4]] as const;

/**
 * The fighter's own art on the touch buttons (input/touch.ts): HEAVY, SPECIAL, ULT and AREA show their move's picture -
 * the move cards' (hud/moveCards.ts), which a touch screen does not show (handheld.css) - and AWAKEN the fighter's face,
 * the home's head. A borrowed move (the Forge, engine/client/transplant.ts) shows the move it is; a form with a kit of its
 * own (Kurobi, the YUGE) shows its sheet once decoded (moveSheet.ts). The sheets are the cards' own images, held
 * decoded once (decodeMoveArt): nothing more is fetched. Written only when something changed.
 */
export class TouchArt {
  private readonly sheet: MoveSheet;
  private readonly artists = new Map<string, MoveCardArt>();
  private fighter = '';
  private sheetShown = '';
  /** `more`: a second button showing a slot's art - the ball modes' set (input/sportTouch.ts) shows HEAVY's and ULT's in
   *  Goal Rush's FIGHT stance. */
  constructor(root: HTMLElement, private readonly buttons: (id: string) => HTMLElement | undefined, private readonly face: HTMLElement | undefined, private readonly more: (id: string) => HTMLElement | undefined = () => undefined) {
    this.sheet = new MoveSheet(sheet => root.style.setProperty('--move-sheet', `url('${moveSheetUrl(sheet)}')`));
  }
  update(self: PlayerState) {
    const fighter = self.fighter, awakened = !!self.awakened, sheet = moveSheetOf(fighter, awakened);
    if (fighter !== this.fighter) {
      this.fighter = fighter; this.sheetShown = sheet; this.sheet.now(sheet);
      for (const form of moveSheetsFor(fighter)) this.sheet.warm(form);
      if (this.face) this.face.innerHTML = mangaPortrait(fighter);
    } else if (sheet !== this.sheetShown) { this.sheetShown = sheet; this.sheet.want(sheet); }
    for (const [slot, panel] of SKILLS) for (const [key, node] of [[slot, this.buttons(slot)], [`${slot}+`, this.more(slot)]] as const) {
      if (!node) continue;
      let artist = this.artists.get(key);
      if (!artist) { artist = new MoveCardArt(node); this.artists.set(key, artist); }
      artist.show(...moveArtSource(panel, fighter, slotNames(self, slot), awakened));
    }
  }
}
