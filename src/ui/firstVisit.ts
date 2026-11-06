import './firstVisit.css';
import { CONTACT, CREDITS_PAGE, FAN_MADE, GAME_NAME, PRIVACY_PAGE, TERMS_PAGE } from './legalLinks';
import { UI_DIRECTION, type UiAction } from '../input/gamepad';
import { nearest } from './spatialFocus';
import { openPage } from './pageViewer';

export const NOTICE_KEY = 'jump-fan-notice';
/** '2' on 12 October 2026: the notice gained its line about the terms of use. */
export const NOTICE_VERSION = '2';

export const NOTICE_LINES = {
  fan: `${GAME_NAME} is a free, open-source arena fighter with a cast of original fighters made for it.`,
  free: 'The game is open source. It has no monetization whatsoever, and it never will, in any form or shape.',
  takedown: 'If you are an IP owner, or someone whose models, effects or other assets have been used in the game, and you would like them removed, email',
  promise: 'and they will be removed promptly.',
  /** Under the small print (12 October 2026): its last three words are the link to public/terms.html. */
  terms: 'By playing you accept the',
} as const;

/** Whether the notice is due: every time the page opens, when somebody is there to read it (or it was asked for). */
export function noticeDue(at: { webdriver: boolean; forced: boolean }): boolean {
  return at.forced || !at.webdriver;
}

/** The dialog's inside. */
export function noticeHtml(): string {
  const out = (href: string, label: string, focus: string) => `<a class="first-visit-link" href="${href}" target="_blank" rel="noopener" data-focus="${focus}">${label} <span aria-hidden="true">↗</span></a>`;
  return `<p class="first-visit-eyebrow">BEFORE YOU PLAY</p>
    <h2 id="first-visit-title">A FAN GAME, MADE WITH LOVE</h2>
    <p>${NOTICE_LINES.fan}</p>
    <p>${NOTICE_LINES.free}</p>
    <p class="first-visit-takedown">${NOTICE_LINES.takedown} <a href="mailto:${CONTACT}">${CONTACT}</a> ${NOTICE_LINES.promise}</p>
    <p class="first-visit-small">${FAN_MADE}</p>
    <p class="first-visit-small first-visit-terms">${NOTICE_LINES.terms} <a href="${TERMS_PAGE}" target="_blank" rel="noopener" data-focus="notice-terms">terms of use</a>.</p>
    <nav class="first-visit-links" aria-label="More about the project">${out(PRIVACY_PAGE, 'LEGAL &amp; PRIVACY', 'notice-legal')}${out(CREDITS_PAGE, 'CREDITS', 'notice-credits')}</nav>
    <button type="button" class="first-visit-go" data-focus="notice-go" data-pad-default>GOT IT, LET'S PLAY</button>`;
}

const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* a private window */ } };

/** Shows the notice if it is due and returns its dialog (undefined where it is not). */
export function mountFirstVisit(doc: Document = document): HTMLDialogElement | undefined {
  const forced = new URLSearchParams(doc.defaultView?.location.search ?? '').has('notice');
  if (!noticeDue({ webdriver: !!doc.defaultView?.navigator.webdriver, forced }) || doc.getElementById('first-visit')) return undefined;
  const dialog = doc.createElement('dialog');
  dialog.id = 'first-visit'; dialog.className = 'first-visit'; dialog.setAttribute('aria-labelledby', 'first-visit-title');
  dialog.innerHTML = noticeHtml();
  doc.body.append(dialog);
  const go = dialog.querySelector<HTMLButtonElement>('.first-visit-go')!;
  go.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { write(NOTICE_KEY, NOTICE_VERSION); dialog.remove(); if (notice === dialog) notice = undefined; }, { once: true });
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  go.focus({ preventScroll: true });
  notice = dialog;
  return dialog;
}

/** The notice on screen, for the pad (main.ts gives it the pad's presses before any screen under it). */
let notice: HTMLDialogElement | undefined;
export const noticeOpen = () => !!notice?.open;
export function noticeController(action: UiAction): boolean {
  const dialog = notice;
  if (!dialog?.open) return false;
  if (action === 'back') { dialog.close(); return true; }
  const items = [...dialog.querySelectorAll<HTMLElement>('a[href]:not([href^="mailto:"]), button')].filter(el => el.getClientRects().length > 0);
  const active = document.activeElement as HTMLElement | null;
  if (!active || !items.includes(active)) { dialog.querySelector<HTMLElement>('.first-visit-go')?.focus({ preventScroll: true }); return true; }
  if (action === 'confirm') {
    if (active instanceof HTMLAnchorElement) openPage(active.href, (active.textContent ?? '').replace(/[↗→]/g, '').trim().toUpperCase(), true);
    else active.click();
    return true;
  }
  const direction = UI_DIRECTION[action];
  if (direction) { const to = nearest(active.getBoundingClientRect(), items.map(el => el.getBoundingClientRect()), direction); if (to >= 0) items[to].focus(); }
  return true;
}
/** START on the notice: read, and closed. */
export function closeNotice() { if (!notice?.open) return false; notice.close(); return true; }
