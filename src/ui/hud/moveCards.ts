import { FIGHTERS } from '../../config';
import { slotNames } from '../../engine/client/transplant';
import { AWAKENINGS, AWAKENING_COST, AWAKENING_SECONDS, moveFor } from '../../originals/shownAwakening';
import { ULTIMATE_COST } from '../../game/moves';
import type { AttackSlot, FighterId, PlayerState } from '../../game/types';
import { MoveCardArt } from '../moveCardArt';
import { MoveSheet, areaArtUrl, moveSheetOf, moveSheetsFor, moveSheetUrl } from '../moveSheet';
import { areaMoveCard } from './cardNames';
import { shownAreaMove } from '../../originals/area';
import { CooldownShare } from './inked';

const KUROBI_SHORT_MOVES = ['CLAW BARRAGE', 'HOMURA FANG', 'BLACK FLAME', 'FALLOUT BOMB'] as const;
/** The move cards' slots by their data-move (inked.ts cardsHtml): the AREA card is 4, drawn before the ULTIMATE's. */
const MOVE_SLOTS = ['light', 'heavy', 'special', 'ultimate', 'area'] as const;

/**
 * One fighter's move cards (inked.ts cardsHtml, the .move-bar): each card's name and art, its cooldown, and the
 * ultimate's and the awakening's charge. Hud.ts draws the page's own player's; a split screen draws Player 2's the same
 * way in their half (couch/CouchHud.ts, 2 November 2026: "use our normal HUD, just size it"). Written only when a value
 * changes, as the rest of the HUD is.
 */
export class MoveCards {
  readonly slots: HTMLElement[];
  readonly ultimate: HTMLElement;
  private readonly charged: readonly HTMLElement[];
  private readonly awakeningTitle: HTMLElement | null;
  /** The cooled cards' sweep, by slot (light, heavy, special, ultimate, area: data-move). */
  private readonly cooldowns = [0, 1, 2, 3, 4].map(() => new CooldownShare());
  private readonly artists = new Map<HTMLElement, MoveCardArt>();
  /** The move cards' art sheet, swapped only once decoded (see moveSheet). */
  private sheet?: MoveSheet;
  constructor(readonly bar: HTMLElement) {
    this.slots = [...bar.querySelectorAll<HTMLElement>('.move-slot[data-move]')];
    this.ultimate = bar.querySelector<HTMLElement>('#ultimate-card')!;
    this.charged = [this.ultimate, bar.querySelector<HTMLElement>('#awakening-card')!];
    this.awakeningTitle = bar.querySelector<HTMLElement>('#awakening-card-title');
  }
  /** The cards made this fighter's: their art sheet and their names. */
  refighter(fighter: FighterId) {
    const bar = this.bar;
    bar.dataset.artFighter = fighter;
    this.sheet ??= new MoveSheet(sheet => bar.style.setProperty('--move-sheet', `url('${moveSheetUrl(sheet)}')`));
    this.sheet.now(fighter); for (const sheet of moveSheetsFor(fighter)) this.sheet.warm(sheet);
    const labels = FIGHTERS[fighter].shortMoves ?? ['LIGHT', 'HEAVY', 'SPECIAL', 'ULTIMATE'];
    // By each card's slot (data-move): the AREA card (4) stands before the ULTIMATE's; it is named by its move.
    for (const slot of this.slots) { const i = Number(slot.dataset.move); slot.querySelector('.ik-cap')!.textContent = i === 4 ? areaMoveCard(shownAreaMove(fighter, moveFor(fighter, 'area', false))) : labels[i]; }
  }
  /** Every HUD tick. True: the ultimate is ready (inked.ts ultimateTick calls it, over the cards). */
  update(self: PlayerState, serverTime: number): boolean {
    // Ultimate and awakening remain separate server-owned resources. Their
    // artwork reveals its charge inside cards identical to the other moves.
    const awakened = !!self.awakened, left = Math.max(0, (self.awakenedUntil ?? 0) - serverTime), awakening = self.awakening ?? 0;
    const artFighter = moveSheetOf(self.fighter, awakened);
    // Round 3c: the form's art goes on once it can be drawn, never a blank card.
    if (this.bar.dataset.artFighter !== artFighter) { this.bar.dataset.artFighter = artFighter; this.sheet?.want(artFighter); }
    const ultimateReady = self.ultimate >= ULTIMATE_COST, awakeningReady = !awakened && awakening >= AWAKENING_COST;
    const charges = [
      [self.ultimate / ULTIMATE_COST, `${Math.floor(self.ultimate)}%`, ultimateReady, false],
      [awakened ? left / AWAKENING_SECONDS : awakening / AWAKENING_COST, awakened ? `${left.toFixed(1)}s` : `${Math.floor(awakening)}%`, awakeningReady, awakened],
    ] as const;
    charges.forEach(([amount, display, ready, active], k) => {
      const card = this.charged[k], done = Math.max(0, Math.min(1, amount)).toFixed(3);
      if (card.style.getPropertyValue('--done') !== done) card.style.setProperty('--done', done);
      if (card.classList.contains('ready') !== ready) card.classList.toggle('ready', ready);
      if (card.classList.contains('awake') !== active) card.classList.toggle('awake', active);
      // The numeral and its unit (inked.css prints the unit smaller).
      const number = card.querySelector<HTMLElement>('.ik-charge')!, unit = display.endsWith('%') ? '%' : 's';
      if (number.textContent !== display.slice(0, -1)) number.textContent = display.slice(0, -1);
      if (number.dataset.unit !== unit) number.dataset.unit = unit;
      const label = `${k === 0 ? 'Ultimate' : active ? AWAKENINGS[self.fighter].name : 'Awakening'} ${display}${ready ? ' ready' : ''}`;
      if (card.getAttribute('aria-label') !== label) card.setAttribute('aria-label', label);
    });
    const title = awakened ? 'AWAKENED' : 'AWAKENING';
    if (this.awakeningTitle && this.awakeningTitle.textContent !== title) this.awakeningTitle.textContent = title;
    for (const slot of this.slots) {
      const i = Number(slot.dataset.move), key = MOVE_SLOTS[i], area = key === 'area'; const cooldown = Math.max(0, (self.cooldowns[key] ?? 0) - serverTime);
      // VOL.5, the move transplant: a slot carrying another fighter's move (or another of the body's slots) is named,
      // and drawn, as that move (engine/client/transplant.ts slotNames). The area move has no short name on the
      // fighter's card: it is named by the move itself and uses its independent art panel.
      // (A form with a kit of its own carries its own cards: Kurobi's, and the YUGE's - config `formShortMoves`.)
      const formShort = self.awakened ? self.fighter === 'konta' ? KUROBI_SHORT_MOVES : FIGHTERS[self.fighter].formShortMoves : undefined, kurobi = !!formShort, borrowed = slotNames(self, key), own = area ? moveFor(self.fighter, 'area', !!self.awakened).name : undefined;
      const label = borrowed ? borrowed.short : own !== undefined ? areaMoveCard(shownAreaMove(self.fighter, moveFor(self.fighter, 'area', !!self.awakened))) : formShort ? formShort[i] : FIGHTERS[self.fighter].shortMoves?.[i] ?? key.toUpperCase();
      const name = borrowed ? borrowed.name : own ?? (kurobi ? moveFor(self.fighter, key, true).name : FIGHTERS[self.fighter].moves[i]); if (slot.title !== name) slot.title = name;
      this.art(slot, i, self.fighter, borrowed, !!self.awakened);
      const caption = slot.querySelector('.ik-cap')!; if (caption.textContent !== label) caption.textContent = label;
      slot.classList.toggle('unavailable', cooldown > 0.1 && i !== 3); slot.classList.toggle('active', self.action === key);
      slot.classList.toggle('cooling', cooldown > 0.1);
      if (area) { const ready = cooldown <= 0.1 && self.alive; if (slot.classList.contains('ready') !== ready) slot.classList.toggle('ready', ready); }
      // Round 5 (HUDIMPL): the art's colour rises back as the cooldown runs (--done; the ultimate's is its charge, above).
      const share = this.cooldowns[i].of(cooldown);
      if (i !== 3) { const done = share.toFixed(3); if (slot.style.getPropertyValue('--done') !== done) slot.style.setProperty('--done', done); }
      const numeral = slot.querySelector('.ik-cool')!, seconds = cooldown > 0.1 ? cooldown.toFixed(1) : ''; if (numeral.textContent !== seconds) numeral.textContent = seconds;
    }
    return ultimateReady;
  }
  /** Own and transplanted area techniques use separate images; the fifth
   * sheet panel is reserved for awakening. */
  private art(slot: HTMLElement, i: number, fighter: FighterId, borrowed?: { from: FighterId; fromSlot: AttackSlot }, awakened = false) {
    let artist = this.artists.get(slot);
    if (!artist) { artist = new MoveCardArt(slot); this.artists.set(slot, artist); }
    artist.show(...moveArtSource(i, fighter, borrowed, awakened));
  }
}
/** The art a move's slot shows (MoveCardArt.show's arguments): whose sheet or area picture, which panel, and whether it
 *  is the fighter's own sheet. The cards and the touch buttons (input/touchArt.ts) read it alike. */
export function moveArtSource(i: number, fighter: FighterId, borrowed?: { from: FighterId; fromSlot: AttackSlot }, awakened = false): [string, number, boolean] {
  const panel = borrowed ? MOVE_SLOTS.indexOf(borrowed.fromSlot) : i;
  // A form whose area move is its own shows that move's picture where there is one (the YUGE's Rumbling,
  // `area/hawser-colossus`: until 13 October 2026 an awakened fighter's area card kept the base move's art whatever it cast).
  const sheet = moveSheetOf(fighter, awakened), form = !borrowed && panel === 4 && sheet !== fighter && !!areaArtUrl(sheet);
  return [form ? sheet : borrowed?.from ?? fighter, panel, !borrowed];
}
