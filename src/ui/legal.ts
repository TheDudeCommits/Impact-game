import './legal.css';
import { CREDITS_PAGE, PRIVACY_PAGE, TERMS_PAGE } from './legalLinks';
import { openPage } from './pageViewer';
import { CONTACT, DISCORD_INVITE, TITLE, contactHref } from '../originals/brand';
import { ORIGINAL_SFX_CREDITS } from '../originals/sfx';
import { ARMORY_OPEN_WORKS, ORIGINAL_OPEN_CREDITS, SOUNDTRACK_CREDITS, STAGE_CC0_WORKS } from '../originals/credits';

export { CONTACT, CREDITS_PAGE, PRIVACY_PAGE, TERMS_PAGE };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const link = (href: string, text: string) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;

export const MADE_HERE: readonly { what: string; how: string }[] = [
  { what: 'Fighters', how: 'Designed for this game. Their 2D art was drawn with AI image models (Gemini 3 Pro and GPT Image 2 through Tripo, and an OpenAI image model), and their 3D bodies and rigs were made with Tripo from the game\'s own concept art.' },
  { what: 'Voices', how: 'Japanese lines written for each character, voiced with text-to-speech: Qwen3-TTS VoiceDesign, run locally, and Qwen TTS preset voices on Higgsfield. Each voice was designed from a written description; none was cloned from, or made to imitate, an actor.' },
  { what: 'Music', how: 'The fighters\' world themes and the Rift\'s are original pieces written note by note for this game and played through the GeneralUser GS SoundFont by S. Christian Collins.' },
  { what: 'Scenery and sound', how: 'Some props, statues, skies and paintings were made for this game with Tripo, with Meshy and with AI image models; some of its ambient sounds were synthesised for it.' },
];

/** A work the game ships under its author's licence, credited as the licence asks (CC BY: the title, the author, where it
 *  is from, the licence and what was changed). `work` and `by` read as they are shown. `files`: what of it ships (under
 *  public/), so the list can be checked against the package - a credit for something the package leaves out comes off. */
export interface Credit { work: string; by?: string; sources: readonly (readonly [label: string, url: string])[]; licence: string; licenceUrl?: string; changes?: string; files: readonly string[] }
const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/', CC_BY_3 = 'https://creativecommons.org/licenses/by/3.0/', CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

/** The works whose licences ask for a credit (the LICENSE files beside each kit under public/assets/environment,
 *  environment/br/parts.json, src/audio/data/ambience.json). */
export const ATTRIBUTIONS: readonly Credit[] = [
  { work: '“Kokura Castle”', by: 'by AVATTA', sources: [['Sketchfab', 'https://sketchfab.com/3d-models/kokura-castle-aba23531911c45439067a6e0aaccad07']], licence: 'CC BY 4.0', licenceUrl: CC_BY_4, changes: 'cropped to its keep, simplified and retextured', files: ['assets/environment/kokura-keep/'] },
  { work: '“Stone Bridges Pack 01”, Bridge.09', by: 'by Creative Trio / Katsukagi', sources: [['creativetrio.art', 'https://creativetrio.art/2021/03/11/stone-bridges-pack-01/']], licence: 'CC BY 4.0', licenceUrl: CC_BY_4, changes: 'converted, re-pivoted, roughness and metalness cleaned up', files: ['assets/environment/stone-arch/'] },
  { work: '“Winter Wind”, “Large Bonfire” and “Campfire Crackling” from Nature Ambient Pack Vol 1', by: 'by JC Sounds', sources: [['OpenGameArt', 'https://opengameart.org/content/jc-sounds-nature-ambient-pack-vol-1']], licence: 'CC BY 4.0', licenceUrl: CC_BY_4, changes: 'cut, looped and levelled', files: ['assets/audio/ambience/wind.m4a', 'assets/audio/ambience/fire.m4a', 'assets/audio/ambience/crackle.m4a'] },
  { work: '“Hell” and “Murder of Crows” from the Horror Sound Effects Library', by: 'by Little Robot Sound Factory', sources: [['www.littlerobotsoundfactory.com', 'https://www.littlerobotsoundfactory.com'], ['OpenGameArt', 'https://opengameart.org/content/horror-sound-effects-library']], licence: 'CC BY 3.0', licenceUrl: CC_BY_3, changes: 'cut and levelled', files: ['assets/audio/ambience/hell.m4a', 'assets/audio/ambience/crows.m4a'] },
  ...ORIGINAL_SFX_CREDITS,
  ...ORIGINAL_OPEN_CREDITS,
  ...SOUNDTRACK_CREDITS,
];

/** Works free of any condition (CC0) or under an open licence, credited with thanks. */
export const OPEN_WORKS: readonly Credit[] = [
  { work: 'Stylized Asia Environment Megapack', by: 'by RG Poly', sources: [['itch.io', 'https://rg-poly.itch.io/stylized-asia-enviroment-megapack-unity-urp']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/asian/', 'assets/environment/br/'] },
  { work: 'Pirate Kit, Fantasy Town Kit, Impact Sounds, Sci-Fi Sounds and RPG Audio', by: 'by Kenney', sources: [['www.kenney.nl', 'https://www.kenney.nl']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/harbor/', 'assets/environment/br/', 'assets/audio/v2/'] },
  { work: 'Pavement 01', by: 'by Rob Tuytel', sources: [['Poly Haven', 'https://polyhaven.com/a/pavement_01']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/paving/'] },
  { work: 'Kloofendal 48d Partly Cloudy (Pure Sky)', by: 'by Greg Zaal and Jarod Guest', sources: [['Poly Haven', 'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/sky/partly-cloudy-2k.hdr'] },
  { work: 'Crowd Shouting Ambience', by: 'by StarNinjas', sources: [['OpenGameArt', 'https://opengameart.org']], licence: 'CC0', licenceUrl: CC0, files: ['assets/audio/ambience/crowd.m4a'] },
  { work: 'The recordings layered into its sound effects', by: 'by their authors', sources: [['Freesound', 'https://freesound.org']], licence: 'CC0', licenceUrl: CC0, files: ['assets/audio/v2/sfx/'] },
  { work: 'Universal Animation Library and Universal Animation Library 2', by: 'by Quaternius', sources: [['quaternius.com', 'https://quaternius.com/packs/universalanimationlibrary.html']], licence: 'CC0', licenceUrl: CC0, files: ['assets/fighters/wukong-tr1.glb', 'assets/fighters/wukong-rush1.glb', 'assets/fighters/shiden-tr1.glb', 'assets/fighters/shiden-rush1.glb'] },
  { work: 'Barlow and Barlow Condensed', by: '© 2017 The Barlow Project Authors', sources: [['GitHub', 'https://github.com/jpt/barlow']], licence: 'SIL Open Font License 1.1', licenceUrl: 'https://openfontlicense.org', files: ['assets/ui/hud/fonts/'] },
  { work: 'The libraries three.js, Rapier and Colyseus', sources: [['three.js', 'https://threejs.org'], ['Rapier', 'https://rapier.rs'], ['Colyseus', 'https://colyseus.io']], licence: 'MIT and Apache 2.0', files: [] },
  ...STAGE_CC0_WORKS,
  ...ARMORY_OPEN_WORKS,
  ...(DISCORD_INVITE ? [{ work: 'The Discord mark', by: 'from Phosphor Icons', sources: [['phosphoricons.com', 'https://phosphoricons.com']] as const, licence: 'MIT', files: [] }] : []),
];

/** One credit as a line: the work, its author and source, its licence, and what was changed. */
function creditLine(c: Credit) {
  const sources = c.sources.map(([label, url]) => link(url, label)).join(', ');
  const licence = c.licenceUrl ? link(c.licenceUrl, c.licence) : esc(c.licence);
  const by = !c.by ? '' : c.by.startsWith('©') ? `, ${esc(c.by)}` : ` ${esc(c.by)}`;
  return `<li>${esc(c.work)}${by} (${sources}), ${licence}${c.changes ? `: ${esc(c.changes)}` : ''}.</li>`;
}

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
    <div class="home-legal-pages"><button type="button" class="home-legal-privacy" data-open-terms data-focus="terms">TERMS OF USE <span aria-hidden="true">↗</span></button><button type="button" class="home-legal-privacy" data-open-privacy data-focus="privacy">PRIVACY <span aria-hidden="true">↗</span></button></div>
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
});
