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
/** Whether the game's own pages must open over the game rather than as pages of their own: on Player Two's host, or any
 *  copy served under a `/~<build>/` folder as it serves one (a local test copy, say). */
export function pagesInGame(at: { hostname: string; pathname: string } | undefined = typeof location === 'object' ? location : undefined): boolean {
  return !!at && (/\.playertwo\.cc$/i.test(at.hostname) || /^\/~[^/]+\//.test(at.pathname));
}
/** Whether an address is one of the game's own pages (same site, not the game's page itself). */
const ownPage = (url: URL) => typeof location === 'object' && url.origin === location.origin && !gamePage(url);
/** The game's own page: BACK TO THE GAME's address (index.html, or the site's root). */
const gamePage = (url: URL) => /(^|\/)(index\.html)?$/.test(url.pathname);
/** A page's title in the viewer's head, from its file. */
const PAGE_TITLES: Record<string, string> = { 'privacy.html': 'PRIVACY', 'terms.html': 'TERMS OF USE', 'credits.html': 'CREDITS' };
const titleOf = (url: URL) => PAGE_TITLES[url.pathname.split('/').pop() ?? ''] ?? (url.pathname.split('/').pop() ?? '').replace(/\.html$/, '').toUpperCase();
/** Whether a press on a link to `url` opens it in the viewer (its own page, where pages open over the game). */
export function opensInGame(url: string): boolean {
  if (typeof location !== 'object') return false;
  try { return pagesInGame() && ownPage(new URL(url, location.href)); } catch { return false; }
}
/** The page's HTML with a base, so its relative links, styles and fonts resolve against its own address in a srcdoc. */
export function withBase(html: string, href: string): string {
  const base = `<base href="${escape(href)}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, tag => `${tag}${base}`) : `${base}${html}`;
}


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
      // (The close event comes a task after close(): a page opened again in between keeps its frame and its way back.)
      if (this.dialog.open) return;
      this.body.replaceChildren();
      const back = this.returnFocus; this.returnFocus = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    });
  }
  get open() { return this.dialog.open; }
  private get body() { return this.dialog.querySelector<HTMLElement>('.page-viewer-body')!; }
  private get frame() { return this.dialog.querySelector('iframe'); }
  show(url: string, title: string, pad = fromPad()) {
    if (!this.open) this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.querySelector('#page-viewer-title')!.textContent = title;
    // The pad's own names for its buttons (Hud writes whose pad it is on #interface[data-pad]); none for a mouse.
    const family = (document.querySelector<HTMLElement>('#interface')?.dataset.pad ?? 'generic') as PadFamily, name = (control: Parameters<typeof padName>[1]) => padName(family, control);
    this.dialog.querySelector('.page-viewer-keys')!.textContent = pad ? `${name('dpad')} SCROLL   ${name('l1')} / ${name('r1')} PAGE   ${name('east')} BACK` : '';
    const here = new URL(url, location.href);
    if (here.origin === location.origin) this.page(here, title);
    else this.body.innerHTML = `<div class="page-viewer-away"><p>This one opens outside the game, in your browser:</p><b>${escape(here.href)}</b><p>Open it on your phone or your computer whenever you like.</p></div>`;
    if (!this.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('.page-viewer-close')!.focus({ preventScroll: true });
  }
  /** One of the game's pages, read with the game's own request and shown as the frame's document, its links kept inside. */
  private page(here: URL, title: string) {
    const frame = document.createElement('iframe');
    frame.title = title; frame.tabIndex = -1;
    this.body.replaceChildren(frame);
    const shown = ++this.shown;
    void fetch(here.href, { credentials: 'same-origin' }).then(r => r.ok ? r.text() : Promise.reject(new Error(String(r.status)))).then(html => {
      if (shown !== this.shown || !frame.isConnected) return;
      // (Hooked on the srcdoc's own load: the frame's first, empty document may fire its load after this.)
      frame.addEventListener('load', () => { if (frame.contentDocument?.URL === 'about:srcdoc') this.keepInside(frame, here); });
      frame.srcdoc = withBase(html, here.href);
    }, () => {
      if (shown !== this.shown || !frame.isConnected) return;
      this.body.innerHTML = `<div class="page-viewer-away"><p>This page did not load. Check the connection and try again:</p><b>${escape(here.href)}</b></div>`;
    });
  }
  private shown = 0;
  /** The page's links, inside the viewer: its own anchors scroll, another of the game's pages opens here, BACK TO THE GAME
   *  closes the viewer, another site opens in a new tab, an email address in the mail app. Escape closes. */
  private keepInside(frame: HTMLIFrameElement, here: URL) {
    const doc = frame.contentDocument;
    if (!doc) return;
    const scrollTo = (hash: string) => { if (!hash) return; try { doc.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(); } catch { /* not an id */ } };
    scrollTo(here.hash);
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); this.close(); } });
    doc.addEventListener('click', event => {
      // (The frame's own elements: not instances of this window's Element, so asked for closest() by name.)
      const target = event.target as Element | null, link = typeof target?.closest === 'function' ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || event.defaultPrevented) return;
      let to: URL; try { to = new URL(link.getAttribute('href')!, here.href); } catch { return; }
      if (to.protocol === 'mailto:') return;
      event.preventDefault();
      if (to.origin !== location.origin) window.open(to.href, '_blank', 'noopener');
      else if (gamePage(to)) this.close();
      else if (to.pathname === here.pathname) scrollTo(to.hash);
      else this.show(to.href, titleOf(to), false);
    });
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
/** Opens a page beside the game: in a new tab (`open`, as it always was), or - pressed on a pad, or one of the game's own
 *  pages where they open over the game (pagesInGame, as on Player Two) - in the viewer. */
export function openPage(url: string, title: string, pad = fromPad(), open: (url: string) => unknown = each => window.open(each, '_blank', 'noopener')) {
  if (typeof document !== 'object' || (!pad && !opensInGame(url))) { open(url); return; }
  (viewer ??= new PageViewer()).show(url, title, pad);
}
/** The pad's presses while the viewer is open (main.ts, before every other screen's). */
export const pageViewerController = (action: UiAction) => !!viewer?.controller(action);
export const pageViewerOpen = () => !!viewer?.open;
export const closePageViewer = () => { if (!viewer?.open) return false; viewer.close(); return true; };
