import type { PadFamily, UiAction } from '../input/gamepad';
import { padName } from '../input/glyphs';
import './pageViewer.css';


/** Whether the press now opening a page came from a pad: main.ts marks <html> data-focus-by="pad" on each of its
 *  presses (Hud.focusBy), and a key or a click marks it otherwise before theirs land. */
export const fromPad = () => typeof document === 'object' && document.documentElement.dataset.focusBy === 'pad';

/** How far one press scrolls the page: a line of text, or (LB / RB) most of a screen. */
export const SCROLL_STEP = 120;
export function scrollFor(action: UiAction, height: number): number {
  if (action === 'next') return SCROLL_STEP;
  if (action === 'previous') return -SCROLL_STEP;
  if (action === 'tabNext') return Math.max(SCROLL_STEP, height * .85);
  if (action === 'tabPrevious') return -Math.max(SCROLL_STEP, height * .85);
  return 0;
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

class PageViewer {
  readonly dialog = document.createElement('dialog');
  private returnFocus: HTMLElement | null = null;
  constructor() {
    this.dialog.className = 'page-viewer';
    this.dialog.setAttribute('aria-labelledby', 'page-viewer-title');
    this.dialog.innerHTML = '<header class="page-viewer-head"><h2 id="page-viewer-title"></h2><span class="page-viewer-keys" aria-hidden="true"></span><button type="button" class="page-viewer-close" data-pad-default>CLOSE <span aria-hidden="true">✕</span></button></header><div class="page-viewer-body"></div>';
    document.body.append(this.dialog);
    this.dialog.querySelector('.page-viewer-close')!.addEventListener('click', () => this.close());
    // Its own Escape closes it alone, never a menu under it (as the bug report's).
    this.dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
    this.dialog.addEventListener('close', () => {
      this.body.replaceChildren();
      const back = this.returnFocus; this.returnFocus = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    });
  }
  get open() { return this.dialog.open; }
  private get body() { return this.dialog.querySelector<HTMLElement>('.page-viewer-body')!; }
  private get frame() { return this.dialog.querySelector('iframe'); }
  show(url: string, title: string) {
    if (!this.open) this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.querySelector('#page-viewer-title')!.textContent = title;
    // The pad's own names for its buttons (Hud writes whose pad it is on #interface[data-pad]).
    const family = (document.querySelector<HTMLElement>('#interface')?.dataset.pad ?? 'generic') as PadFamily, name = (control: Parameters<typeof padName>[1]) => padName(family, control);
    this.dialog.querySelector('.page-viewer-keys')!.textContent = `${name('dpad')} SCROLL   ${name('l1')} / ${name('r1')} PAGE   ${name('east')} BACK`;
    const here = new URL(url, location.href);
    if (here.origin === location.origin) {
      const frame = document.createElement('iframe');
      frame.src = here.pathname + here.search + here.hash; frame.title = title; frame.tabIndex = -1;
      this.body.replaceChildren(frame);
    } else {
      this.body.innerHTML = `<div class="page-viewer-away"><p>This one opens outside the game, in your browser:</p><b>${escape(here.href)}</b><p>Open it on your phone or your computer whenever you like.</p></div>`;
    }
    if (!this.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('.page-viewer-close')!.focus({ preventScroll: true });
  }
  close() { if (this.open) this.dialog.close(); }
  controller(action: UiAction): boolean {
    if (!this.open) return false;
    if (action === 'back' || action === 'confirm') { this.close(); return true; }
    const view = this.frame?.contentWindow, by = scrollFor(action, this.frame?.clientHeight ?? innerHeight);
    if (by) { try { view?.scrollBy({ top: by, behavior: 'smooth' }); } catch { /* another site's page: it does not scroll from here */ } }
    return true;
  }
}

let viewer: PageViewer | undefined;
/** Opens a page beside the game: in a new tab (`open`, as it always was), or - pressed on a pad - in the viewer. */
export function openPage(url: string, title: string, pad = fromPad(), open: (url: string) => unknown = each => window.open(each, '_blank', 'noopener')) {
  if (!pad || typeof document !== 'object') { open(url); return; }
  (viewer ??= new PageViewer()).show(url, title);
}
/** The pad's presses while the viewer is open (main.ts, before every other screen's). */
export const pageViewerController = (action: UiAction) => !!viewer?.controller(action);
export const pageViewerOpen = () => !!viewer?.open;
export const closePageViewer = () => { if (!viewer?.open) return false; viewer.close(); return true; };
