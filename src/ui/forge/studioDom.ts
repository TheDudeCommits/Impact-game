/** The Forge studio's small DOM helpers (src/ui/forge/ForgeStudio.ts): elements, the fighters' faces, and pictures
 *  loaded only as they scroll into view. */
import { FIGHTERS } from '../../config';
import { mediaArt } from '../mediaArt';
import type { AttackSlot, FighterId } from '../../game/types';
import type { StudioTarget } from '../../engine/client/forgeStudio';
import { getBindings, keyName } from '../../input/bindings';

/** An element with its properties set and its children appended. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string | false | undefined)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) if (child !== false && child !== undefined) node.append(child);
  return node;
}
export const button = (text: string, action: () => void, className = '', title = '') => {
  const b = el('button', { type: 'button', textContent: text, className, ...(title ? { title } : {}) });
  b.addEventListener('click', action);
  return b;
};

export const nameOf = (id: FighterId) => FIGHTERS[id]?.name ?? id;
export const SLOT_WORDS: Readonly<Record<AttackSlot, string>> = { light: 'LIGHT', heavy: 'HEAVY', special: 'SPECIAL', ultimate: 'ULTIMATE', area: 'AREA' };
const DEFAULT_KEYS: Readonly<Record<AttackSlot, string>> = { light: 'J', heavy: 'K', special: 'Q', ultimate: 'R', area: 'G' };
/** The key a slot is thrown with: the player's first keyboard binding for it (J, K, Q, R and G unless rebound). */
export function slotKey(slot: AttackSlot): string {
  try { const code = getBindings().keyboard[slot]?.find(each => !each.startsWith('Mouse')); return code ? keyName(code) : DEFAULT_KEYS[slot]; } catch { return DEFAULT_KEYS[slot]; }
}
/** A target as the inspector labels its row and its settings: its key and its word ("J · LIGHT", "G · AREA"), "AURA". */
export const targetLabel = (target: StudioTarget) => target === 'aura' ? 'AURA' : `${slotKey(target)} · ${SLOT_WORDS[target]}`;

/** A fighter's face, best first: the card's own portrait (every fighter has one, and the package ships it: the home's
 *  manga portrait for most, the original art for the first 36), then the HUD's bust. The home's portraits folder lacks
 *  the first 36's, so asking it first answered 16 not-founds on every opening (11 October 2026). */
export const facesOf = (id: FighterId) => [FIGHTERS[id]?.portrait, `/assets/hud/busts/${id}.webp`].filter((each): each is string => !!each).map(mediaArt);

/** Pictures that load only when they scroll near the view of their list (a few hundred rows stay light), each trying
 *  its next picture when one fails, and marked `.fs-noimg` when none loads (the row then shows its letter). */
export class LazyPictures {
  private readonly seen: IntersectionObserver | undefined;
  constructor(root: HTMLElement) {
    this.seen = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) this.load(entry.target as HTMLImageElement); }, { root, rootMargin: '320px 0px' })
      : undefined;
  }
  /** An image that loads `sources` in turn, when it comes near the view. */
  image(sources: readonly string[], className: string, alt = ''): HTMLImageElement {
    const image = el('img', { className, alt, decoding: 'async', draggable: false });
    image.dataset.sources = sources.join('\n');
    image.addEventListener('error', () => this.next(image));
    if (this.seen) this.seen.observe(image); else this.load(image);
    return image;
  }
  /** An image shown at once (the inspector's few). */
  now(sources: readonly string[], className: string, alt = ''): HTMLImageElement {
    const image = el('img', { className, alt, decoding: 'async', draggable: false });
    image.dataset.sources = sources.join('\n');
    image.addEventListener('error', () => this.next(image));
    this.load(image);
    return image;
  }
  private load(image: HTMLImageElement) {
    this.seen?.unobserve(image);
    if (!image.getAttribute('src')) this.next(image);
  }
  private next(image: HTMLImageElement) {
    const [first, ...rest] = (image.dataset.sources ?? '').split('\n').filter(Boolean);
    image.dataset.sources = rest.join('\n');
    if (first) image.src = first; else { image.removeAttribute('src'); image.classList.add('fs-noimg'); }
  }
  dispose() { this.seen?.disconnect(); }
}

/** Whether a key press is typed into a field (where the studio takes no keys). Sliders and boxes are not fields. */
export const typing = (target: EventTarget | null) => {
  const node = target as HTMLElement | null;
  if (!node?.closest) return false;
  if (node.closest('textarea, select, [contenteditable="true"]')) return true;
  const input = node.closest('input') as HTMLInputElement | null;
  return !!input && !['range', 'checkbox', 'radio', 'button'].includes(input.type);
};
