import { QUICK_CHAT_MENUS, ballOf, quickChat, type BallModeId } from '../../game/ball/model';
import type { GameSnapshot } from '../../game/types';
import { ACTIONS, boundTo } from '../../input/bindings';
import type { PadFamily } from '../../input/gamepad';
import { padKey } from '../../input/glyphs';
import './ballUi.css';

const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'], NUMPAD = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'];
/** The D-pad's up, right, down, left pick the first to fourth (the emote wheel's and prompts.ts's order). */
const DPAD = [12, 15, 13, 14], PAD_GLYPHS = ['up', 'right', 'down', 'left'] as const;
/** The pad's View / Share button opens it (FREE PLAY keeps that button for its reset). */
const PAD_OPEN = 8;
/** It closes by itself after this long untouched (ms). */
const OPEN_MS = 3500;

/**
 * The ball modes' quick chat (set lines, no free text): C (T when C is bound to a move), or the pad's View button, opens four
 * menus - INFO, PRAISE, REACT, SORRY - and 1-4 (the D-pad) picks a menu and then a line. The room relays the line's
 * index into every page's feed (BallHud's, beside the bots' lines). While it is open the keys 1-4 and the D-pad are its,
 * not the emote wheel's (ui/shop/boot.ts canEmote reads `.ball-chat-wheel.open`).
 */
export class QuickChat {
  readonly root: HTMLElement;
  /** A line chosen: its index into quickChat(mode) (main.ts sends the room `ball-chat`). */
  onSend: (index: number) => void = () => {};
  private stage: 'closed' | 'menus' | 'lines' = 'closed';
  private menu = 0; private until = 0; private live = false; private mode: BallModeId = 'goal-rush';
  private padHeld: boolean[] = [];
  private shown = '';
  constructor(private readonly parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-chat-wheel';
    this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey, true);
    // A touch screen: the HUD's CHAT button opens it, and a line is tapped.
    window.addEventListener('ball-chat-open', this.onOpen);
    this.root.addEventListener('pointerdown', event => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (!item) return;
      event.stopPropagation(); event.preventDefault(); this.pick(Number(item.dataset.pick));
    });
  }
  private readonly onOpen = () => { if (!this.live) return; if (this.open) this.close(); else this.show('menus'); };
  get open() { return this.stage !== 'closed'; }
  private get key() { return ACTIONS.some(action => boundTo(action, 'KeyC')) ? 'KeyT' : 'KeyC'; }
  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.live || e.repeat) return;
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
    if (e.code === this.key) { e.preventDefault(); if (this.open) this.close(); else this.show('menus'); return; }
    if (!this.open) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
    let i = KEYS.indexOf(e.code); if (i < 0) i = NUMPAD.indexOf(e.code);
    if (i >= 0) { e.preventDefault(); e.stopImmediatePropagation(); this.pick(i); }
  };

  /** Every frame: whether a match is on to talk in (not FREE PLAY: nobody to hear), the pad's buttons, the timeout. */
  update(snapshot: GameSnapshot | null | undefined) {
    const v = ballOf(snapshot);
    this.live = !!v && !v.practice && v.phase !== 'lobby' && v.phase !== 'over';
    if (v) this.mode = v.mode;
    if (!this.live) { if (this.open) this.close(); this.padHeld.length = 0; return; }
    const pads = typeof navigator === 'object' && navigator.getGamepads ? navigator.getGamepads() : [];
    const held = (i: number) => { for (const pad of pads) if (pad?.connected && pad.buttons[i]?.pressed) return true; return false; };
    const edge = (i: number) => { const now = held(i), was = this.padHeld[i] ?? false; this.padHeld[i] = now; return now && !was; };
    if (edge(PAD_OPEN)) { if (this.open) this.close(); else this.show('menus'); }
    DPAD.forEach((button, i) => { if (edge(button) && this.open) this.pick(i); });
    if (this.open && performance.now() > this.until) this.close();
  }

  private pick(i: number) {
    if (this.stage === 'menus') { this.menu = i; this.show('lines'); return; }
    this.onSend(this.menu * 4 + i);
    this.close();
  }
  private show(stage: 'menus' | 'lines') {
    this.stage = stage; this.until = performance.now() + OPEN_MS;
    const pad = this.parent.dataset.input === 'controller', family = (this.parent.dataset.pad ?? 'generic') as PadFamily;
    const cap = (i: number) => pad ? padKey(family, PAD_GLYPHS[i]) : `<kbd>${i + 1}</kbd>`;
    const lines = quickChat(this.mode);
    const items = stage === 'menus' ? [...QUICK_CHAT_MENUS] : lines.slice(this.menu * 4, this.menu * 4 + 4);
    const title = stage === 'menus' ? 'QUICK CHAT' : QUICK_CHAT_MENUS[this.menu];
    const touch = this.parent.dataset.input === 'touch';
    const html = `<b>${title}</b>${items.map((text, i) => `<span data-pick="${i}">${touch ? '' : cap(i)}${text}</span>`).join('')}`;
    if (html !== this.shown) { this.shown = html; this.root.innerHTML = html; }
    this.root.classList.add('open');
  }
  close() { this.stage = 'closed'; this.root.classList.remove('open'); }
  dispose() { window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('ball-chat-open', this.onOpen); this.root.remove(); }
}
