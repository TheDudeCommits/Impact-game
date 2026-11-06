import type { FighterId } from '../../game/types';
import { mangaPortrait } from '../MangaHome';
import './kit.css';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  // A node put straight into a zone is marked as WP3's, so a shared zone can tell its pieces from another module's.
  if (parent?.dataset.zone) node.dataset.wp3 = '';
  parent?.append(node);
  return node;
}

/**
 * Zone 6, the prompt lane, is shared: the shell's coach (WP1, src/ui/modes/Coach.ts) puts at most one tip there in a
 * player's first matches (the look hint, LookHint.ts, sits below the lane, not in it). The modules put at
 * most one prompt of their own there at a time; the coach's tip wins over an ordinary prompt (`coachShowing`), and the
 * time-critical one - your own down or return dial, which stands in the lane - wins over the coach (`setCritical`:
 * kit.css hides the lane's other pieces while it holds).
 */
export class PromptLane {
  private critical: boolean | undefined;
  constructor(readonly zone: HTMLElement) {}
  setCritical(on: boolean) { if (on !== this.critical) { this.critical = on; this.zone.toggleAttribute('data-critical', on); } }
  /** The coach's tip is showing in the lane now. Read only while one of ours wants the lane. */
  coachShowing(): boolean {
    for (const child of this.zone.children) {
      const node = child as HTMLElement;
      if (!node.classList.contains('coach-tip') || node.hidden) continue;
      const style = getComputedStyle(node);
      if (style.display !== 'none' && style.visibility !== 'hidden' && +style.opacity > .05) return true;
    }
    return false;
  }
  clear() { this.critical = undefined; this.zone.removeAttribute('data-critical'); }
}

/** A text node's value, written only on change. */
export class Text {
  private value: string | undefined;
  constructor(readonly node: HTMLElement) {}
  set(value: string) { if (value !== this.value) { this.value = value; this.node.textContent = value; } }
}
/** A node's markup (a prompt's keycap), written only on change. */
export class Markup {
  private value: string | undefined;
  constructor(readonly node: HTMLElement) {}
  set(value: string) { if (value !== this.value) { this.value = value; this.node.innerHTML = value; } }
}
/** A bar's fill, 0..1, as a scaleX on the node (no layout), written when it moves by a visible step. */
export class Fill {
  private value = -1;
  constructor(readonly node: HTMLElement, private readonly step = .002) {}
  set(share: number) {
    const v = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
    if (Math.abs(v - this.value) < this.step && !(v === 0 && this.value !== 0) && !(v === 1 && this.value !== 1)) return;
    this.value = v; this.node.style.transform = `scaleX(${v.toFixed(4)})`;
  }
}
/** A class (or the `hidden` class) toggled only on change. */
export class Flag {
  private value: boolean | undefined;
  constructor(readonly node: HTMLElement, private readonly name = 'hidden') {}
  set(on: boolean) { if (on !== this.value) { this.value = on; this.node.classList.toggle(this.name, on); } }
  get on() { return !!this.value; }
}
/** A data attribute written only on change. */
export class Data {
  private value: string | undefined;
  constructor(readonly node: HTMLElement, private readonly key: string) {}
  set(value: string) { if (value !== this.value) { this.value = value; this.node.dataset[this.key] = value; } }
}

/** A manga portrait (MangaHome's), swapped only when the fighter changes. */
export class Face {
  private fighter = '';
  constructor(readonly node: HTMLElement) {}
  set(fighter: FighterId) { if (fighter !== this.fighter) { this.fighter = fighter; this.node.innerHTML = mangaPortrait(fighter); } }
  clear() { if (this.fighter) { this.fighter = ''; this.node.replaceChildren(); } }
}

/** Restart a one-shot CSS animation without a reflow: `data-<key>` flips between two values whose rules run the same
 *  keyframes under two names (kit.css), so each flip starts it again. */
export function pulse(node: HTMLElement, key: string) { node.dataset[key] = node.dataset[key] === 'a' ? 'b' : 'a'; }

export const grouped = new Intl.NumberFormat('en-US');
export const clockOf = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/**
 * The plaque (zone 2): the approved centre plaque's shape (.match-status), its main number large and one line under it.
 * `kind` colours the second half of the headline red ("WAVE 3 · <em>24 LEFT</em>").
 */
export class Plaque {
  readonly root: HTMLElement;
  readonly lead: Text; readonly accent: Text; readonly sub: Text;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-plaque ${className}`.trim(), parent);
    const line = el('strong', '', this.root);
    this.lead = new Text(el('span', '', line)); this.accent = new Text(el('em', '', line));
    this.sub = new Text(el('small', '', this.root));
  }
}

/**
 * The wide bar (zone 2b): a paper strip with a label and a value over an ink-bordered, skewed bar (the approved health
 * track's shape), an echo that drains after a hit and a flash where it was struck.
 */
export class WideBar {
  readonly root: HTMLElement;
  readonly label: Text; readonly value: Text; readonly tag: Text;
  private readonly fill: Fill; private readonly echo: Fill;
  private share = -1; private echoShare = 1; private at = 0; private struckAt = 0;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-wide ${className}`.trim(), parent);
    const head = el('div', 'hk-wide-head', this.root);
    this.label = new Text(el('b', '', head)); this.tag = new Text(el('small', '', head)); this.value = new Text(el('span', '', head));
    const track = el('i', 'hk-wide-track', this.root);
    this.echo = new Fill(el('i', 'hk-wide-echo', track)); this.fill = new Fill(el('i', 'hk-wide-fill', track));
  }
  /** `share` 0..1; `now` ms. A drop flashes the bar and leaves the echo to drain behind it. */
  set(share: number, now: number) {
    if (this.share >= 0 && share < this.share - .0005 && now - this.struckAt > 420) { this.struckAt = now; pulse(this.root, 'struck'); }
    if (share > this.echoShare || this.share < 0) this.echoShare = share;
    const dt = this.at ? Math.min(.25, (now - this.at) / 1000) : 0; this.at = now;
    this.echoShare += (share - this.echoShare) * Math.min(1, dt * 2.2);
    this.share = share; this.fill.set(share); this.echo.set(Math.max(share, this.echoShare));
  }
}

/** A small approved plate (zone 3): the ink silhouette, a manga portrait, the name, an HP sliver and a state tag. */
export class MiniPlate {
  readonly root: HTMLElement;
  readonly face: Face; readonly name: Text; readonly state: Text; readonly hp: Fill;
  readonly down: Flag; readonly reviving: Flag; readonly gone: Flag; readonly you: Flag;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-mini ${className}`.trim(), parent);
    this.face = new Face(el('span', 'hk-mini-face', this.root));
    const body = el('div', 'hk-mini-body', this.root);
    this.name = new Text(el('b', '', body));
    const track = el('i', 'hk-mini-track', body);
    this.hp = new Fill(el('i', '', track));
    this.state = new Text(el('small', '', body));
    this.down = new Flag(this.root, 'is-down'); this.reviving = new Flag(this.root, 'is-reviving'); this.gone = new Flag(this.root, 'is-gone'); this.you = new Flag(this.root, 'is-you');
  }
}
