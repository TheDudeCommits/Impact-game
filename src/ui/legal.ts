import './legal.css';
import { CREDITS_PAGE, PRIVACY_PAGE, REPO_PAGE, TERMS_PAGE } from './legalLinks';
import { openPage } from './pageViewer';
import { CONTACT, TITLE, contactHref } from '../originals/brand';
import { ATTRIBUTIONS, MADE_HERE, OPEN_WORKS, creditLine, type Credit } from './legalCredits';

export { CONTACT, CREDITS_PAGE, PRIVACY_PAGE, TERMS_PAGE };
export { ATTRIBUTIONS, MADE_HERE, OPEN_WORKS, type Credit };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Where a rights holder or a player writes: brand.ts CONTACT, or word that it is coming. */
const contactLine = () => CONTACT
  ? `<p>Rights holders: to ask for anything to be taken down, write to <a href="${esc(contactHref(CONTACT))}">${esc(CONTACT.replace(/^mailto:/i, ''))}</a>.</p>`
  : '<p>Contact details for rights holders and players will be added here.</p>';

export const legalEntry = () => `<button type="button" class="home-legal-entry" id="home-legal" data-open-legal data-focus="legal"><span>CREDITS & LEGAL<small>CREDITS · PRIVACY</small></span><b aria-hidden="true">→</b></button>`;

/** The page itself. */
export function legalPage(): string {
  return `<section class="home-legal" id="home-legal-page" aria-label="Credits and legal">
    <button type="button" class="home-options-back" data-legal-back data-focus="legal-back">← OPTIONS</button>
    <p class="home-legal-lead">${esc(TITLE)} is a free, open-source browser game. Its fighters are original characters made for it: their names, faces, outfits, voices and themes are the game's own.</p>
    ${contactLine()}
    <h3 class="home-legal-head">MADE FOR THIS GAME</h3>
    <ul class="home-legal-list">${MADE_HERE.map(m => `<li><b>${esc(m.what)}.</b> ${esc(m.how)}</li>`).join('')}</ul>
    <h3 class="home-legal-head">OPEN ASSETS</h3>
    <p class="home-legal-note">Used under their licences. A credit here does not mean its author endorses this game.</p>
    <ul class="home-legal-list">${ATTRIBUTIONS.map(creditLine).join('')}</ul>
    <ul class="home-legal-list home-legal-thanks">${OPEN_WORKS.map(creditLine).join('')}</ul>
    <div class="home-legal-pages"><button type="button" class="home-legal-privacy" data-open-terms data-focus="terms">TERMS OF USE <span aria-hidden="true">↗</span></button><button type="button" class="home-legal-privacy" data-open-privacy data-focus="privacy">PRIVACY <span aria-hidden="true">↗</span></button><button type="button" class="home-legal-privacy" data-open-source data-focus="source">SOURCE CODE <span aria-hidden="true">↗</span></button></div>
  </section>`;
}

/** The page as it is shown: the panel it covers, what that panel's children were, and the dialog's title before it. */
let shown: { host: HTMLElement; kids: HTMLElement[]; title?: string; dialog?: HTMLDialogElement } | undefined;

function open(entry: HTMLElement) {
  close(false);
  const host = entry.closest<HTMLElement>('#home-options-fields') ?? entry.parentElement?.parentElement;
  if (!host) return;
  const kids = [...host.children].filter((kid): kid is HTMLElement => kid instanceof HTMLElement);
  // (Inline and important: the panel's own rules show its nav and grid firmly, and the Options panel is drawn afresh
  // each time it opens, so nothing set here outlives it.)
  for (const kid of kids) kid.style.setProperty('display', 'none', 'important');
  host.insertAdjacentHTML('beforeend', legalPage());
  const title = document.getElementById('home-dialog-title'), dialog = host.closest('dialog') ?? undefined;
  shown = { host, kids, title: title?.textContent ?? undefined, dialog };
  if (title) title.textContent = 'CREDITS & LEGAL';
  dialog?.addEventListener('close', onClose);
  host.querySelector<HTMLElement>('[data-legal-back]')?.focus({ preventScroll: true });
  host.scrollTop = 0; if (dialog) dialog.scrollTop = 0;
}
const onClose = () => close(false);
/** Back to the Options panel (`focus`: its LEGAL row, as CONTROLS' back does). */
function close(focus = true) {
  if (!shown) return;
  const { host, kids, title, dialog } = shown;
  shown = undefined;
  dialog?.removeEventListener('close', onClose);
  host.querySelector('#home-legal-page')?.remove();
  for (const kid of kids) kid.style.removeProperty('display');
  const heading = document.getElementById('home-dialog-title');
  if (heading && title !== undefined) heading.textContent = title;
  if (focus) host.querySelector<HTMLElement>('#home-legal')?.focus({ preventScroll: true });
}

if (typeof document !== 'undefined') document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  const entry = target?.closest<HTMLElement>('[data-open-legal]');
  if (entry) open(entry);
  else if (target?.closest('[data-legal-back]')) close();
  // (In a new tab; pressed on a pad, in the page viewer over the game, which the pad can close: pageViewer.ts.)
  else if (target?.closest('[data-open-terms]')) openPage(TERMS_PAGE, 'TERMS OF USE');
  else if (target?.closest('[data-open-privacy]')) openPage(PRIVACY_PAGE, 'PRIVACY');
  else if (target?.closest('[data-open-credits]')) openPage(CREDITS_PAGE, 'CREDITS');
  // (SOURCE CODE: the game's repository, legalLinks.ts REPO_PAGE.)
  else if (target?.closest('[data-open-source]')) openPage(REPO_PAGE, 'SOURCE CODE');
});
