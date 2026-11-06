import { FIGHTERS } from '../../config';
import { HELD } from '../../game/economy/fighters';
import { isReleasedFighter } from '../../game/rosterAvailability';
import type { FighterId } from '../../game/types';
import type { PadFamily, UiAction } from '../../input/gamepad';
import { padKey } from '../../input/glyphs';
import { homeAnimeOptions, homeRosterWip, homeSeries } from '../HomeRosterOrder';
import type { InkSelect } from '../inkSelect';
import '../inkSelect';
import { fighterCaption, HOME_ROSTER, HOME_VOLUMES, mangaPortrait } from '../MangaHome';
import { currentDevice, promptKey, type PromptDevice } from '../prompts';
import { nearest, type Direction } from '../spatialFocus';
import { randomFighter, swapRoster, type SwapSide } from './trainingSwap';
import './trainingSwap.css';


/** What main.ts asks of the picker without holding it: whether it is up, a pad's menu presses, and closing it. */
export const swapPicker: { open: boolean; controller(action: UiAction): boolean; close(): void } = { open: false, controller: () => false, close: () => {} };

/** Who each side may become, in the home page's order (its volumes, wing by wing): PREVIOUS and NEXT walk this too. */
const ORDER: readonly FighterId[] = HOME_VOLUMES.flat().filter(id => isReleasedFighter(id));
export const swapOrder = (side: SwapSide): FighterId[] => swapRoster(side, ORDER, HELD);

const PAD_MOVES: Partial<Record<UiAction, Direction>> = { previous: 'up', next: 'down', left: 'left', right: 'right' };
const KEY_MOVES: Readonly<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const TITLES: Readonly<Record<SwapSide, string>> = { self: 'SELECT YOUR FIGHTER', opponent: 'SELECT THE OPPONENT' };
const SIDE_WORDS: Readonly<Record<SwapSide, string>> = { self: 'YOU', opponent: 'OPPONENT' };
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const key = (name: string) => `<kbd>${escape(name)}</kbd>`;

export interface SwapPickerHost {
  /** Who each side is now, as the room has it. */
  pair(): Partial<Record<SwapSide, FighterId>>;
  /** The fighter a side is waiting for (chosen, its body on the way), if any. */
  pending(side: SwapSide): FighterId | undefined;
  /** The choice: the room is asked (TrainingHud sends the training command). */
  choose(side: SwapSide, fighter: FighterId, random: boolean): void;
}

export class TrainingSwapPicker {
  readonly node = document.createElement('div');
  private side: SwapSide = 'self';
  private anime = '';
  private built = '';
  private marked = '';
  private hints = '';
  private typed = ''; private typedAt = 0;
  /** What held the pointer when the picker opened (the fight's canvas): given back when it closes by a press. */
  private lock: Element | null = null;
  private readonly sheet: HTMLElement; private readonly title: HTMLElement; private readonly grid: HTMLElement; private readonly foot: HTMLElement;
  private readonly filter: InkSelect;
  private readonly cells = new Map<FighterId, HTMLButtonElement>();

  constructor(private readonly host: SwapPickerHost) {
    const node = this.node;
    node.className = 'training-swap'; node.hidden = true;
    node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true');
    node.innerHTML = `<div class="ts-backdrop" data-ts-close></div><section class="ts-sheet">
      <header class="ts-head"><h2 class="ts-title"></h2>
        <div class="ts-sides" role="group" aria-label="Whose fighter">${(['self', 'opponent'] as const).map(side => `<button type="button" data-ts-side="${side}" aria-pressed="false"><b>${SIDE_WORDS[side]}</b><small></small></button>`).join('')}</div>
        <button type="button" class="ts-random" data-ts-random><span class="ink-pick-art" aria-hidden="true"><b>?</b></span><b>RANDOM</b></button>
        <ink-select class="ts-anime" label="Filter series"><option value="" selected>All series (${ORDER.length})</option>${homeAnimeOptions(ORDER).map(anime => `<option value="${escape(anime.id)}">${escape(anime.label)}</option>`).join('')}</ink-select>
        <button type="button" class="ts-close" data-ts-close aria-label="Close the picker">CLOSE ✕</button></header>
      <div class="ts-grid" data-layout="faces" role="listbox"></div>
      <footer class="ts-foot" aria-hidden="true"></footer></section>`;
    this.sheet = node.querySelector<HTMLElement>('.ts-sheet')!; this.title = node.querySelector<HTMLElement>('.ts-title')!;
    this.grid = node.querySelector<HTMLElement>('.ts-grid')!; this.foot = node.querySelector<HTMLElement>('.ts-foot')!;
    this.filter = node.querySelector<InkSelect>('.ts-anime')!;
    this.filter.addEventListener('change', () => { this.anime = this.filter.value; this.build(); this.mark(true); });
    node.addEventListener('click', event => {
      const target = event.target as Element;
      // (The series filter's own button and list are the filter's.)
      if (target.closest('ink-select')) return;
      const cell = target.closest<HTMLElement>('[data-ts-fighter]'), side = target.closest<HTMLElement>('[data-ts-side]');
      if (cell) this.choose(cell.dataset.tsFighter as FighterId, false);
      else if (target.closest('[data-ts-random]')) this.random();
      else if (side) this.show(side.dataset.tsSide as SwapSide);
      else if (target.closest('[data-ts-close]')) this.close();
      // A click on the paper itself leaves the keys with the roster.
      else if (!this.sheet.contains(document.activeElement)) this.focusCurrent();
    });
    swapPicker.controller = action => this.controller(action);
    swapPicker.close = () => this.close();
  }

  get open() { return !this.node.hidden; }
  get showing(): SwapSide { return this.side; }

  /** Opens on a side - or, already open on it, closes (the bar's button and its key are toggles). */
  toggle(side: SwapSide) { if (this.open && this.side === side) this.close(); else this.show(side); }
  show(side: SwapSide) {
    const opening = !this.open;
    this.side = side;
    if (opening) {
      // The mouse is the picker's while it is up (in a fight it turns the view).
      this.lock = document.pointerLockElement;
      if (this.lock) document.exitPointerLock?.();
      this.node.hidden = false; swapPicker.open = true;
    }
    this.build(); this.mark(true); this.drawHints(true);
  }
  /** `back`: the pointer goes back to the fight if the fight had it (a press closed the picker: the browser allows it). */
  close(back = true) {
    if (!this.open) return;
    this.node.hidden = true; swapPicker.open = false;
    const active = document.activeElement as HTMLElement | null;
    if (active && this.node.contains(active)) active.blur();
    const lock = this.lock; this.lock = null;
    if (back && lock?.isConnected) { try { (lock.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* a click on the fight takes it again */ } }
  }
  dispose() {
    this.close(false);
    swapPicker.controller = () => false; swapPicker.close = () => {};
    this.node.remove();
  }

  /** Every HUD tick while it is up: who is who (a switch may land, or the room's pair change, while it is open). */
  update() { if (this.open) { this.mark(false); this.drawHints(false); } }

  private choose(fighter: FighterId, random: boolean) {
    const side = this.side;
    this.close();
    this.host.choose(side, fighter, random);
  }
  /** RANDOM: anyone but who the side is now (or is about to be), and never the fighter across the room. */
  private random() {
    const pair = this.host.pair(), across: SwapSide = this.side === 'self' ? 'opponent' : 'self';
    const fighter = randomFighter(swapOrder(this.side), [this.host.pending(this.side) ?? pair[this.side], this.host.pending(across) ?? pair[across]]);
    if (fighter) this.choose(fighter, true);
  }

  /** The roster's cells, made when the side's list or the filter changes: a volume to a heading, or one series' fighters. */
  private build() {
    const roster = swapOrder(this.side), key = `${roster.length}|${this.anime}`;
    if (key === this.built) return;
    this.built = key; this.marked = ''; this.cells.clear();
    const allowed = new Set(roster);
    const cell = (id: FighterId) => `<button type="button" class="ink-pick-option" role="option" aria-selected="false" data-ts-fighter="${id}" aria-label="${escape(FIGHTERS[id].name)}"><span class="ink-pick-art">${mangaPortrait(id)}</span><span class="ink-pick-text">${escape(fighterCaption(id))}</span>${homeRosterWip(id) ? '<i class="ts-wip" aria-hidden="true">WIP</i>' : ''}</button>`;
    const group = (label: string, ids: readonly FighterId[]) => ids.length ? `<div class="ink-pick-group" role="group" aria-label="${escape(label)}"><b class="ink-pick-head" aria-hidden="true">${escape(label)}</b>${ids.map(cell).join('')}</div>` : '';
    this.grid.innerHTML = this.anime
      ? group(this.anime, roster.filter(id => homeSeries(id) === this.anime))
      : HOME_VOLUMES.map((ids, i) => group(`VOL.${i + 1}`, ids.filter(id => allowed.has(id)))).join('')
        // (Anyone the home's volumes do not list, as the LABORATORY's OPPONENT has them.)
        + group('OTHER FIGHTERS', roster.filter(id => !HOME_ROSTER.includes(id)));
    for (const node of this.grid.querySelectorAll<HTMLButtonElement>('[data-ts-fighter]')) this.cells.set(node.dataset.tsFighter as FighterId, node);
    this.grid.scrollTop = 0;
  }

  /** Who is who on the sheet: the side's own fighter in red, the one on its way marked, the fighter across the room
   *  tagged; the tabs say both names. Written only when something moved. `focus`: the keys start on the side's fighter. */
  private mark(focus: boolean) {
    const pair = this.host.pair(), across: SwapSide = this.side === 'self' ? 'opponent' : 'self';
    const now = pair[this.side], coming = this.host.pending(this.side), other = this.host.pending(across) ?? pair[across];
    const state = `${this.side}|${now}|${coming}|${other}|${this.host.pending('self')}|${pair.self}|${pair.opponent}|${this.host.pending('opponent')}`;
    if (state !== this.marked) {
      this.marked = state;
      this.node.dataset.side = this.side;
      this.node.setAttribute('aria-label', TITLES[this.side]);
      this.grid.setAttribute('aria-label', TITLES[this.side]);
      if (this.title.textContent !== TITLES[this.side]) this.title.textContent = TITLES[this.side];
      for (const tab of this.node.querySelectorAll<HTMLElement>('[data-ts-side]')) {
        const side = tab.dataset.tsSide as SwapSide, fighter = this.host.pending(side) ?? pair[side];
        tab.setAttribute('aria-pressed', String(side === this.side));
        const name = tab.querySelector('small')!, text = fighter ? fighterCaption(fighter) : '';
        if (name.textContent !== text) name.textContent = text;
        tab.hidden = !pair[side];
      }
      for (const [id, node] of this.cells) {
        const selected = id === (coming ?? now);
        if ((node.getAttribute('aria-selected') === 'true') !== selected) node.setAttribute('aria-selected', String(selected));
        const tag = id === other ? SIDE_WORDS[across] : undefined;
        if (node.dataset.tsTag !== tag) { if (tag) node.dataset.tsTag = tag; else delete node.dataset.tsTag; }
      }
    }
    if (focus) this.focusCurrent();
  }
  private focusCurrent() {
    const fighter = this.host.pending(this.side) ?? this.host.pair()[this.side];
    this.reveal((fighter && this.cells.get(fighter)) || this.cells.values().next().value || this.node.querySelector<HTMLElement>('[data-ts-close]')!);
  }
  /** Focus a control, and scroll the roster to it (only the roster: nothing behind the sheet moves). */
  private reveal(node: HTMLElement | undefined) {
    if (!node) return;
    node.focus({ preventScroll: true });
    if (!this.grid.contains(node)) return;
    const top = node.offsetTop - this.grid.offsetTop - 26, bottom = node.offsetTop - this.grid.offsetTop + node.offsetHeight + 8;
    if (top < this.grid.scrollTop) this.grid.scrollTop = Math.max(0, top); else if (bottom > this.grid.scrollTop + this.grid.clientHeight) this.grid.scrollTop = bottom - this.grid.clientHeight;
  }

  /** The line under the roster: this device's own presses, and how to step without the picker. */
  private drawHints(force: boolean) {
    const { device, family } = currentDevice(), other: SwapSide = this.side === 'self' ? 'opponent' : 'self', state = `${device}|${family}|${this.side}`;
    if (!force && state === this.hints) return;
    this.hints = state;
    this.foot.innerHTML = hintsHtml(device, family, other);
  }

  /* ---------------------------------------------------------------- the keys and the pad */

  private controls() { return [...this.sheet.querySelectorAll<HTMLElement>('button:not([hidden]):not(:disabled)')].filter(node => node.offsetParent !== null && !node.closest('.ink-pick-list')); }
  private move(direction: Direction) {
    const controls = this.controls(), from = controls.find(node => node === document.activeElement);
    if (!from) { this.focusCurrent(); return; }
    const to = nearest(from.getBoundingClientRect(), controls.map(node => node.getBoundingClientRect()), direction);
    if (to >= 0) this.reveal(controls[to]);
  }
  /** A letter jumps to the next fighter whose name starts with what was typed (as the game's other face lists do). */
  private seek(letter: string) {
    const now = performance.now(); this.typed = (now - this.typedAt < 700 ? this.typed : '') + letter.toLowerCase(); this.typedAt = now;
    // A first letter moves on to the next name that starts with it; more letters narrow from the cell they have reached.
    const cells = [...this.cells.values()], at = cells.indexOf(document.activeElement as HTMLButtonElement), from = this.typed.length > 1 ? Math.max(0, at) : at + 1, order = [...cells.slice(from), ...cells.slice(0, from)];
    const starts = (text: string) => order.find(node => (node.getAttribute('aria-label') ?? '').toLowerCase().startsWith(text) || (node.textContent ?? '').trim().toLowerCase().startsWith(text));
    this.reveal(starts(this.typed) ?? (this.typed.length > 1 ? undefined : starts(letter.toLowerCase())));
  }
  /** A key while the picker is up (TrainingHud's own listener hands every one over). True: it was the picker's. */
  key(event: KeyboardEvent): boolean {
    if (!this.open) return false;
    const target = event.target as HTMLElement | null;
    // The series filter's list has the keys while it is open, and its button its own.
    if (target?.closest?.('.ink-pick-list')) return false;
    const code = event.code, plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (code === 'Escape') { this.close(); }
    else if (KEY_MOVES[code] && plain) { if (target?.closest?.('ink-select') && (code === 'ArrowUp' || code === 'ArrowDown')) return false; this.move(KEY_MOVES[code]); }
    else if ((code === 'Digit6' || code === 'Numpad6') && plain) { if (!event.repeat) this.toggle('self'); }
    else if ((code === 'Digit7' || code === 'Numpad7') && plain) { if (!event.repeat && this.host.pair().opponent) this.toggle('opponent'); }
    else if (code === 'Home' || code === 'End') this.reveal(code === 'Home' ? this.cells.values().next().value : [...this.cells.values()].at(-1));
    else if (code === 'Tab') {
      // Round the sheet's own controls, never out to the fight behind it.
      const controls = this.controls(), at = controls.indexOf(document.activeElement as HTMLElement);
      this.reveal(controls[(at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]);
    }
    else if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && !this.sheet.contains(document.activeElement)) this.focusCurrent();
    else if (event.key.length === 1 && plain && /\S/.test(event.key) && !target?.closest?.('ink-select')) this.seek(event.key);
    else return false;
    event.preventDefault(); event.stopPropagation();
    return true;
  }
  /** A pad's menu presses (main.ts input.onUiAction, after an open list's own): the D-pad or the stick moves, the
   *  south button picks, the east closes, the north shows the other side. */
  controller(action: UiAction): boolean {
    if (!this.open) return false;
    const direction = PAD_MOVES[action];
    if (direction) this.move(direction);
    else if (action === 'confirm') { const active = document.activeElement as HTMLElement | null; if (active && this.sheet.contains(active)) active.click(); else this.focusCurrent(); }
    else if (action === 'back') this.close();
    // Y, or LB / RB as the picker's two tabs: the other side.
    else if (action === 'extra' || action === 'tabPrevious' || action === 'tabNext') { const other: SwapSide = this.side === 'self' ? 'opponent' : 'self'; if (this.host.pair()[other]) this.show(other); }
    return true;
  }
}

/** The foot line's words for a device: the picker's own presses first, then how to step without it. */
export function hintsHtml(device: PromptDevice, family: PadFamily, other: SwapSide): string {
  const item = (keys: string, words: string) => `<span>${keys}<b>${words}</b></span>`;
  if (device === 'controller') {
    const pad = (control: Parameters<typeof padKey>[1]) => padKey(family, control);
    return [item(pad('dpad'), 'MOVE'), item(promptKey('confirm', { device, family }), 'PICK'), item(promptKey('back', { device, family }), 'CLOSE'), item(pad('north'), SIDE_WORDS[other]),
      `<span class="ts-foot-fight"><i>IN THE FIGHT</i>${pad('select')}<em>+</em>${pad('left')}${pad('right')}<b>PREVIOUS / NEXT FIGHTER</b>${pad('select')}<em>+</em>${pad('up')}${pad('down')}<b>OPPONENT</b></span>`].join('');
  }
  if (device === 'touch') return item('', 'TAP A FIGHTER') + `<span class="ts-foot-fight"><i>IN THE FIGHT</i><b>‹ › ON THE BAR: PREVIOUS / NEXT</b></span>`;
  return [item(key('←') + key('↑') + key('↓') + key('→'), 'MOVE'), item(key('Enter'), 'PICK'), item(key('Esc'), 'CLOSE'), item(key(other === 'self' ? '6' : '7'), SIDE_WORDS[other]),
    `<span class="ts-foot-fight"><i>IN THE FIGHT</i>${key('9')}${key('0')}<b>PREVIOUS / NEXT FIGHTER</b>${key('−')}${key('=')}<b>OPPONENT</b></span>`].join('');
}
