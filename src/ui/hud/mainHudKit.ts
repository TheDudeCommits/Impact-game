import { BINDINGS_EVENT } from '../../input/bindings';
import type { ModeHudFrame } from './modeHud';

/**
 * Round 5, WP2: the small pieces the three main-game HUDs (Duel, Royale, Training) share. Every node is built once at
 * mount; afterwards only text, a flag or a transform is written, and only when its value changes. (The newcomer's
 * controls strip and the look hint are WP1's, for every layout: src/ui/modes/HudPrompts.ts and LookHint.ts.)
 */

/** One element, built once. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}
/** Text, written only when it changes. */
export function setText(node: Element, value: string) { if (node.textContent !== value) node.textContent = value; }
/** Markup, written only when it changes (prompts: their keys follow the device). */
export function setHtml(node: HTMLElement & { _html?: string }, value: string) { if (node._html !== value) { node._html = value; node.innerHTML = value; } }
/** A boolean data attribute (`data-<name>`), written only when it changes. */
export function flag(node: HTMLElement, name: string, on: boolean) {
  if (on === (name in node.dataset)) return;
  if (on) node.dataset[name] = ''; else delete node.dataset[name];
}
/** A data attribute with a value, written only when it changes; undefined removes it. */
export function attr(node: HTMLElement, name: string, value: string | undefined) {
  if (node.dataset[name] === value) return;
  if (value === undefined) delete node.dataset[name]; else node.dataset[name] = value;
}
/** Shown or hidden through the `hidden` attribute, written only when it changes. */
export function show(node: HTMLElement, on: boolean) { if (node.hidden === on) node.hidden = !on; }

/** Bumped whenever the player remaps a key, so prompts drawn from the bindings are drawn again. */
let bindingsVersion = 0;
if (typeof window === 'object') window.addEventListener(BINDINGS_EVENT, () => { bindingsVersion++; });
/** Says when the prompts must be redrawn: the device, the pad's family or a binding changed. */
export class PromptWatch {
  private key = '';
  changed(frame: Pick<ModeHudFrame, 'input' | 'family'>) {
    const key = `${frame.input}|${frame.family}|${bindingsVersion}`;
    if (key === this.key) return false;
    this.key = key; return true;
  }
  reset() { this.key = ''; }
}

/** The fighter a player is known by in a feed or on a marker: the fighter's name for a bot, the player's own name for a
 *  person who chose one, YOU for the player. */
export function callName(player: { id: string; name: string; isBot: boolean; fighter: string }, selfId: string, fighterName: (id: string) => string) {
  if (player.id === selfId) return 'YOU';
  const name = player.name?.trim();
  return (player.isBot || !name || name === 'Fighter' ? fighterName(player.fighter) : name).toUpperCase();
}

/** RoaN's moments own the middle of the screen: a cut-in or finisher cut (#interface[data-cinema], host.ts), the VS
 *  page or the FIGHT! card (.vs-splash), and the HUD's own call-out (#action-message). A transient banner waits while
 *  any of them is up. MangaImpact's K.O. lettering (1.25 s, for a knockout the player dealt or took) carries no class:
 *  a banner a knockout raised waits KO_SECONDS instead. */
export const KO_SECONDS = 1.3;
export function centreBusy(root: HTMLElement) {
  if ('cinema' in root.dataset) return true;
  const splash = document.querySelector<HTMLElement>('.vs-splash');
  if (splash && !splash.hidden) return true;
  const message = root.querySelector('#action-message');
  return !!message?.textContent;
}
