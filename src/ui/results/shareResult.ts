import { FIGHTERS } from '../../config';
import type { FighterId } from '../../game/types';
import { RIFT_TEAM_NAMES, type RiftSeat, type RiftView } from '../../game/moba/model';
import type { UiAction } from '../../input/gamepad';
import { MODES, type ModeId } from '../modes/catalogue';
import { cardBlob, drawCard, type CardSpec } from '../survival/shareCard';
import { canShareFile, copyText, shareFileWith } from '../../social/share';
import { prefetchResultLink, resultLink } from './resultLink';
import { TITLE } from '../../originals/brand';
import { clock } from './ResultsFrame';
import './shareResult.css';

/** A result as the card says it. */
export interface ResultCard {
  mode: string; way: string; where: string; fighter: FighterId;
  kicker: string; outcome: string; line: string;
  key: { value: string; label: string };
  stats: [string, string][];
  tone: 'win' | 'loss' | 'draw';
  /** The mode's home card art (/assets/home/modes/), behind the fighter. */
  art?: string;
}
const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const ART: Partial<Record<string, string>> = Object.fromEntries(Object.values(MODES).map(m => [m.name, `/assets/home/modes/${m.art}.webp`]));
const modeArt = (name: string, mode?: ModeId) => (mode && MODES[mode] ? `/assets/home/modes/${MODES[mode].art}.webp` : undefined) ?? ART[name];

/** The result a results frame (ResultsFrame.ts) shows, read from it: whatever mode drew it, the slots are the same. */
export function readResultCard(card: HTMLElement, mode?: ModeId): ResultCard | undefined {
  const text = (selector: string) => tidy(card.querySelector(selector)?.textContent);
  const fighter = card.querySelector<HTMLElement>('[data-results-bust]')?.dataset.resultsBust as FighterId | undefined;
  if (!fighter || !FIGHTERS[fighter]) return undefined;
  const [modeName = '', ...way] = text('.results-masthead span').split(' · ');
  if (/^TRAINING/.test(modeName)) return undefined;
  const stats = [...card.querySelectorAll('.results-stats > div')].map(cell => [tidy(cell.querySelector('strong')?.textContent), tidy(cell.querySelector('span')?.textContent)] as [string, string]);
  return {
    mode: modeName, way: way.join(' · '), where: text('.results-masthead b'), fighter,
    kicker: text('.results-headline small'), outcome: text('.results-headline h2'), line: text('.results-headline .results-line'),
    key: { value: text('.results-key strong'), label: text('.results-key span') }, stats,
    tone: card.classList.contains('is-victory') ? 'win' : card.classList.contains('is-draw') ? 'draw' : 'loss',
    art: modeArt(modeName, mode),
  };
}

const RIFT_WAYS: Record<RiftView['access'], string> = { bots: 'BOTS', solo: 'SOLO', quick: 'ONLINE', host: 'FRIENDS', join: 'FRIENDS' };
/** Rift War's result (its own panel, RiftWarUI), as the card says it. */
export function riftResultCard(view: RiftView, seat: RiftSeat): ResultCard {
  const tone = view.winner === null ? 'draw' : view.winner === seat.team ? 'win' : 'loss', name = FIGHTERS[seat.fighter]?.name ?? seat.fighter;
  return {
    mode: 'RIFT WAR', way: RIFT_WAYS[view.access] ?? '', where: `THE TORN PLAIN · ${clock(view.endsAt - view.startedAt)}`, fighter: seat.fighter,
    kicker: `${seat.name && seat.name !== 'Fighter' ? `${seat.name} · ` : ''}${name.toUpperCase()} · ${RIFT_TEAM_NAMES[seat.team]}`,
    outcome: tone === 'win' ? 'VICTORY' : tone === 'draw' ? 'DRAW' : 'DEFEAT', line: view.reason || 'The opposing core has fallen.',
    key: { value: `${seat.kills}/${seat.deaths}/${seat.assists}`, label: 'K / D / A' },
    stats: [[String(seat.lastHits), 'LAST HITS'], [String(seat.structures), 'STRUCTURES'], [String(seat.level), 'FINAL LEVEL']],
    tone, art: modeArt('RIFT WAR', 'rift-war'),
  };
}

const ACCENT = { win: '#d91e36', loss: '#27304d', draw: '#5f5b55' } as const;
/** The card's parts for a result (survival/shareCard.ts drawCard). */
export function cardSpec(r: ResultCard): CardSpec {
  const label = /^OF \d+/.test(r.key.label) ? `PLACE · ${r.key.label}` : r.key.label;
  return {
    art: r.art, fighter: r.fighter, accent: ACCENT[r.tone],
    corner: [r.mode, r.way], key: { label, value: r.key.value },
    heading: r.kicker || FIGHTERS[r.fighter].name.toUpperCase(), title: r.outcome, sub: r.line, epitaph: r.where,
    // Under the numbers, the mode's own art; at the foot, where anyone who sees the card can play it.
    stats: r.stats.slice(0, 4), lower: { label: `${r.mode}${r.way ? ` · ${r.way}` : ''}`, faces: [], more: 0 },
    footer: 'PLAY FREE IN YOUR BROWSER',
  };
}
/** What a shared result says beside its picture: "Victory in Duel as Konta Whirl Clan (2–1, 3 KOs)." */
export function resultWords(r: ResultCard): { title: string; text: string } {
  const title = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), mode = title(r.mode), fighter = FIGHTERS[r.fighter]?.name ?? r.fighter;
  const [value, label] = r.stats[0] ?? ['', ''], facts = [r.key.value, value && `${value} ${/[a-z]/.test(label) ? label : label.toLowerCase()}`].filter(Boolean).join(', ');
  return { title: `${r.outcome} · ${mode} · ${TITLE}`, text: `${title(r.outcome)} in ${mode} as ${fighter}${facts ? ` (${facts})` : ''}. Play ${TITLE} free in your browser.` };
}

const fileName = (r: ResultCard) => `impact-${r.mode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${r.fighter}.png`;
interface Drawn { key: string; card: ResultCard; file?: File; url?: string }

/** The SHARE CARD button on each results card, and the picture's own small dialog. */
export class ResultShare {
  private dialog?: HTMLDialogElement;
  private drawn?: Drawn;
  private drawing?: Promise<Drawn>;
  private timer = 0;

  constructor(root: ParentNode = document) {
    // One press for every card: a results frame's button reads its card; Rift War's carries its own result.
    root.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLElement>('[data-share-result]');
      if (!b || (b as HTMLButtonElement).disabled) return;
      const given = b.dataset.shareResult, frame = b.closest<HTMLElement>('.results-frame');
      let card: ResultCard | undefined;
      try { card = given ? JSON.parse(given) as ResultCard : frame ? readResultCard(frame, b.dataset.mode as ModeId | undefined) : undefined; } catch { card = undefined; }
      if (card) this.open(card, b);
    });
  }
  /** ResultsShell.fill, for each results frame on screen: its SHARE CARD (once), before HOME, and the picture drawn
   *  ahead so the press shows it at once. Not on Arcade's (its own SHARE CARD) or Training's. */
  decorate(card: HTMLElement, mode?: ModeId) {
    if (card.closest('#sv-results, .hidden')) return;
    const actions = card.querySelector('.results-actions');
    if (!actions || actions.querySelector('[data-share-result]')) return;
    const result = readResultCard(card, mode);
    if (!result) return;
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.shareResult = ''; if (mode) b.dataset.mode = mode;
    b.innerHTML = '<span>SHARE CARD</span><small>PICTURE + LINK</small>';
    actions.insertBefore(b, actions.lastElementChild);
    // Drawn once the card has slammed in, while the player reads it.
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { prefetchResultLink(); void this.draw(result).catch(() => undefined); }, 900);
  }
  /** Rift War's panel: its button, with the result in it. */
  static riftButton(view: RiftView, seat: RiftSeat | undefined, escape: (s: string) => string) {
    return seat ? `<button type="button" data-share-result="${escape(JSON.stringify(riftResultCard(view, seat)))}">SHARE CARD</button>` : '';
  }

  private draw(card: ResultCard): Promise<Drawn> {
    const key = JSON.stringify(card);
    if (this.drawn?.key === key) return Promise.resolve(this.drawn);
    if (this.drawing) return this.drawing.then(done => done.key === key ? done : this.draw(card));
    this.drawing = (async () => {
      const blob = await cardBlob(await drawCard(cardSpec(card)));
      if (this.drawn?.url) URL.revokeObjectURL(this.drawn.url);
      this.drawn = { key, card, file: blob ? new File([blob], fileName(card), { type: 'image/png' }) : undefined, url: blob ? URL.createObjectURL(blob) : undefined };
      return this.drawn;
    })().finally(() => { this.drawing = undefined; });
    return this.drawing;
  }

  private build() {
    const d = document.createElement('dialog');
    d.className = 'result-share'; d.setAttribute('aria-label', 'Share your result');
    d.innerHTML = `<div class="result-share-card"><div class="result-share-picture"><img alt="Your result as a picture" hidden><p data-rs-wait>DRAWING YOUR CARD…</p></div>
      <p class="result-share-note" data-rs-note role="status" aria-live="polite"></p>
      <div class="result-share-actions"><button type="button" class="is-primary" data-rs="share">SHARE</button><a data-rs="save" href="#" download>SAVE PICTURE</a><button type="button" data-rs="copy">COPY LINK</button><button type="button" data-rs="close">CLOSE</button></div></div>`;
    d.addEventListener('click', event => {
      const target = event.target as HTMLElement, b = target.closest<HTMLElement>('[data-rs]');
      if (target === d) { this.close(); return; }
      if (!b) return;
      const what = b.dataset.rs;
      if (what === 'close') this.close();
      else if (what === 'share') this.share();
      else if (what === 'copy') void copyText(resultLink()).then(done => this.note(done ? 'Link copied.' : `Copy this link: ${resultLink()}`));
      else if (what === 'save' && !this.drawn?.url) event.preventDefault();
    });
    // Escape shuts the picture, not the results under it (input.ts reads Escape on the window as the menu key).
    d.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); } });
    d.addEventListener('close', () => { this.returnTo?.focus({ preventScroll: true }); this.returnTo = undefined; });
    document.body.append(d);
    return d;
  }
  private returnTo?: HTMLElement;
  private showing?: ResultCard;
  private note(text: string) { const el = this.dialog?.querySelector('[data-rs-note]'); if (el) el.textContent = text; }
  private open(card: ResultCard, from: HTMLElement) {
    const d = this.dialog ??= this.build();
    this.returnTo = from; this.showing = card; this.note('');
    prefetchResultLink();
    const img = d.querySelector('img')!, wait = d.querySelector<HTMLElement>('[data-rs-wait]')!, save = d.querySelector<HTMLAnchorElement>('[data-rs="save"]')!, share = d.querySelector<HTMLButtonElement>('[data-rs="share"]')!;
    const ready = this.drawn?.key === JSON.stringify(card);
    img.hidden = !ready; wait.hidden = ready; share.disabled = !ready;
    if (!d.open) d.showModal();
    const fill = (drawn: Drawn) => {
      if (this.showing !== card || !drawn.url) return;
      img.src = drawn.url; img.hidden = false; wait.hidden = true;
      save.href = drawn.url; save.download = drawn.file?.name ?? 'impact.png';
      // SHARE where the device's sheet takes pictures; elsewhere SAVE PICTURE and COPY LINK carry it.
      share.hidden = !drawn.file || !canShareFile(drawn.file); share.disabled = false;
      (share.hidden ? save : share).focus({ preventScroll: true });
    };
    void this.draw(card).then(fill).catch(() => { wait.textContent = 'The picture could not be drawn. COPY LINK still works.'; });
  }
  /** SHARE: the picture, its words and the link, all at hand, so the sheet opens inside the press. */
  private share() {
    const drawn = this.drawn;
    if (!drawn?.file || !this.showing) return;
    void shareFileWith(drawn.file, { ...resultWords(drawn.card), url: resultLink() }).then(result => {
      if (result === 'shared') this.note('Shared.');
      else if (result === 'failed') this.note('Sharing did not open here. SAVE PICTURE, then COPY LINK.');
    });
  }
  /** Shut the picture (a pad's back or menu, HomeShell.back): true if it was open. */
  close() { if (!this.dialog?.open) return false; this.dialog.close(); return true; }
  /** The pad, while the picture is open: back shuts it, confirm presses, the rest moves along its buttons. */
  controller(action: UiAction) {
    const d = this.dialog;
    if (!d?.open) return false;
    if (action === 'back') { this.close(); return true; }
    const items = [...d.querySelectorAll<HTMLElement>('[data-rs]')].filter(el => !(el as HTMLButtonElement).disabled && !el.hidden && el.getClientRects().length);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (action === 'confirm') { (at >= 0 ? items[at] : items[0])?.click(); return true; }
    const step = action === 'left' || action === 'previous' ? -1 : action === 'right' || action === 'next' ? 1 : 0;
    if (step) items[(Math.max(0, at) + step + items.length) % items.length]?.focus();
    return true;
  }
}
