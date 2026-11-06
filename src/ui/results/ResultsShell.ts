import type { Hud } from '../Hud';
import { MODES, type ModeId, type VariantId } from '../modes/catalogue';
import { arcadeFrame } from './arcadeFrame';
import { MISSING_BUSTS, bustPicture } from './ResultsFrame';
import type { FighterId } from '../../game/types';
import type { UiAction } from '../../input/gamepad';
import { attributeChanged } from '../panelFlags';
import { ResultShare } from './shareResult';

/**
 * Round 5 (UX), WP1: the results frame's shared behaviour, whatever drew it (MatchResults for the main game,
 * objectiveResults for the operations). CHANGE MODE goes home and opens the mode's sheet; TRAINING practises the
 * fighter; the masthead names the way to play the sheet started; and the shop's payout - a toast that appears when
 * the result is decided, often before the card - is copied into the card's rewards strip (and kept, so a card that
 * opens later still shows it).
 */
export class ResultsShell {
  private pay = '';
  private payAt = 0;
  private copying = 0;
  /** When a results card last came up (performance.now ms): a confirm mashed into the fight's end is swallowed. */
  private openedAt = -Infinity;
  private open = false;
  /** The mode and way to play the sheet last started (HomeShell). */
  started: () => { mode: ModeId; variant: VariantId } | undefined = () => undefined;
  /** HomeShell: open the mode's sheet. */
  openSheet: (mode: ModeId) => void = () => {};
  /** SHARE CARD on each card, and its picture (shareResult.ts). */
  readonly share = new ResultShare();

  constructor(private readonly root: HTMLElement, private readonly hud: Hud) {
    root.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLElement>('[data-results]');
      if (!b || !b.closest('.results-frame, #sv-results')) return;
      const mode = hud.modes.layout;
      if (b.dataset.results === 'change') { hud.onLeave(); if (mode) queueMicrotask(() => this.openSheet(mode)); }
      else if (b.dataset.results === 'training') hud.onPractice();
    });
    // The payout toast lands on #interface itself (src/ui/shop/boot.ts); the cards in #results and the operations' panel.
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && node.classList.contains('shop-toast')) this.watchToast(node);
    }).observe(root, { childList: true });
    // (Only on a real change: a `class` written with what it already holds is reported too, and `fill` asks the page
    // twice. The HUD wrote the results holder's on every tick of a match: panelFlags.ts `attributeChanged`.)
    const cards = new MutationObserver(records => { if (records.some(record => record.type !== 'attributes' || attributeChanged(record))) this.fill(); });
    for (const holder of root.querySelectorAll('#results, .objective-scrim, #sv-results')) cards.observe(holder, { childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    // Arcade Survival's results on the shared frame (arcadeFrame.ts): laid over its spread as it opens, and again as the
    // spread fills in (the pay, a co-op guest's PLAY AGAIN).
    const arcade = root.querySelector<HTMLElement>('#sv-results'), spread = arcade?.querySelector<HTMLElement>('.sv-results-card');
    if (arcade && spread) {
      const redraw = () => this.arcade(arcade, spread);
      new MutationObserver(redraw).observe(arcade, { attributes: true, attributeFilter: ['class'] });
      new MutationObserver(redraw).observe(spread, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
      arcade.addEventListener('click', event => {
        const b = (event.target as HTMLElement).closest<HTMLElement>('[data-sv-press]');
        if (b && !(b as HTMLButtonElement).disabled) root.querySelector<HTMLElement>(b.dataset.svPress!)?.click();
      });
    }
    // Enter (on keydown) and Space (on keyup) on a card that has just opened: swallowed, as WP2 swallows Enter after
    // its spectator bar (RoyaleHud); the pad's confirm goes through `swallow`.
    const guard = (event: KeyboardEvent) => {
      if ((event.code === 'Enter' && event.type === 'keydown') || (event.code === 'Space' && event.type === 'keyup')) {
        if (this.justOpened() && (event.target as HTMLElement)?.closest?.('.results-frame, #sv-results')) { event.preventDefault(); event.stopImmediatePropagation(); }
      }
    };
    window.addEventListener('keydown', guard, true); window.addEventListener('keyup', guard, true);
    // R1 (12 October 2026, "I like R1, title card"): the keys the card's buttons show - C CHANGE MODE, T TRAINING
    // (Enter presses PLAY AGAIN, which has the focus; Esc goes home, as it did) - and Esc or the pad's back shut the
    // fold (THE FIGHT, FULL STANDINGS) before they leave.
    window.addEventListener('keydown', event => {
      // (Not while a dialog stands over the card - a report's - whose keys are its own.)
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || hud.settingsOpen || document.querySelector('dialog[open]')) return;
      const card = this.openCard();
      if (!card) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (event.code === 'Escape' && this.closeFold()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const key = /^Key([CT])$/.exec(event.code)?.[1]?.toLowerCase();
      const b = key && !typing ? card.querySelector<HTMLButtonElement>(`.results-actions [data-key="${key}"]`) : undefined;
      if (!b || b.disabled) return;
      event.preventDefault(); event.stopImmediatePropagation(); b.click();
    }, true);
    // Your fighter's bust, as the HUD's plates take it (proto.ts): one that is not there gives way to the next picture.
    root.addEventListener('error', event => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.resultsBust) return;
      const src = img.getAttribute('src') ?? '';
      MISSING_BUSTS.add(src);
      const next = bustPicture(img.dataset.resultsBust as FighterId);
      if (next && next !== src) { img.toggleAttribute('data-fallback', next.includes('/assets/home/portraits/')); img.src = next; }
    }, true);
  }
  /** The card on screen (the main game's, an operation's, or the run's over its spread) - drawn, not only unhidden: a run
   *  left for Training hides the survival HUD round its panel, and the panel keeps no .hidden of its own. */
  private openCard() { return [...this.root.querySelectorAll<HTMLElement>('#results:not(.hidden) .results-frame, .objective-scrim:not(.hidden) .results-frame, #sv-results:not(.hidden) .results-frame')].find(card => card.getClientRects().length > 0); }
  /** The fold open on the card on screen, shut (its summary keeps the focus). */
  private closeFold() {
    const fold = this.openCard()?.querySelector<HTMLDetailsElement>('details[open]');
    if (!fold) return false;
    fold.open = false; fold.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    return true;
  }
  private arcadeKey = '';
  private arcadeOpen = false;
  /** The run's results on the shared frame, over the spread (which stays the source of every action). */
  private arcade(panel: HTMLElement, spread: HTMLElement) {
    const open = !panel.classList.contains('hidden');
    if (!open) { this.arcadeOpen = false; this.arcadeKey = ''; return; }
    const fighter = this.hud.modes.frame?.self.fighter ?? this.hud.selected;
    const markup = arcadeFrame(panel, fighter);
    if (markup === this.arcadeKey) return;
    this.arcadeKey = markup;
    let host = panel.querySelector<HTMLElement>(':scope > .ux-sv-frame');
    if (!host) { host = document.createElement('div'); host.className = 'ux-sv-frame'; panel.prepend(host); }
    const expanded = host.querySelector<HTMLDetailsElement>('details')?.open ?? false;
    host.innerHTML = markup;
    if (expanded) host.querySelector('details')?.setAttribute('open', '');
    panel.classList.add('ux-framed');
    // The run's own pay line, inside the card.
    const pay = spread.querySelector<HTMLElement>('#sv-results-pay');
    const slot = host.querySelector<HTMLElement>('[data-results-rewards]');
    if (slot && pay && !pay.classList.contains('hidden') && pay.innerHTML.trim()) slot.innerHTML = pay.innerHTML;
    if (!this.arcadeOpen) {
      this.arcadeOpen = true;
      // PLAY AGAIN under the cursor (HOME for a co-op guest, whose PLAY AGAIN waits for the host).
      const again = host.querySelector<HTMLButtonElement>('.results-again');
      window.setTimeout(() => (again && !again.disabled ? again : host!.querySelector<HTMLElement>('[data-sv-press="#sv-leave"]'))?.focus({ preventScroll: true }), 450);
    }
    this.fill();
  }
  /** A results card came up less than a second ago. */
  justOpened(ms = 1000) { return performance.now() - this.openedAt < ms; }
  /** A pad's confirm in that second is swallowed (HomeShell.controller, ahead of Hud.controllerAction). */
  swallow(action: string) { if (this.share.controller(action as UiAction)) return true; return (action === 'confirm' && this.visibleCard() && this.justOpened()) || (action === 'back' && this.closeFold()); }
  private visibleCard() { return !!this.root.querySelector('#results:not(.hidden) .results-frame, .objective-scrim:not(.hidden) .results-frame, #sv-results:not(.hidden)'); }
  /** A new match: the last one's pay is not this one's. */
  reset() { this.pay = ''; this.payAt = 0; }

  private watchToast(toast: HTMLElement) {
    window.clearInterval(this.copying);
    const copy = () => { if (!toast.isConnected) { window.clearInterval(this.copying); return; } if (toast.innerHTML.trim()) { this.pay = toast.innerHTML; this.payAt = performance.now(); this.fill(); } };
    copy(); this.copying = window.setInterval(copy, 400);
  }
  private fill() {
    const open = this.visibleCard(), was = this.open;
    if (open && !this.open) this.openedAt = performance.now();
    this.open = open;
    // A duel is won or lost: the shop's "Placed 2 of 2" line says it as a duel would (the critic read it as a slight).
    const pay = this.hud.modes.layout === 'duel' ? this.pay.replace(/Placed 2 of 2/g, 'Lost the duel') : this.pay;
    for (const card of this.root.querySelectorAll<HTMLElement>('.results-frame')) {
      // A card drawn again while it is up (a rival asks to run it back, the run's pay arrives): no second slam-in.
      if (!card.dataset.drawn) { card.dataset.drawn = ''; if (was && open && !this.justOpened(600)) card.classList.add('is-settled'); }
      const slot = card.querySelector<HTMLElement>('[data-results-rewards]');
      if (slot && pay && slot.innerHTML !== pay) slot.innerHTML = pay;
      this.share.decorate(card, this.hud.modes.layout ?? undefined);
      const started = this.started(), mast = card.querySelector<HTMLElement>('.results-masthead span'), layout = this.hud.modes.layout;
      if (mast && started && started.mode === layout) {
        const text = `${MODES[started.mode].name} · ${MODES[started.mode].variants[started.variant]?.label ?? ''}`;
        if (mast.textContent !== text) mast.textContent = text;
      }
    }
  }
}
