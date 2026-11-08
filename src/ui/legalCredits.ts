/** The credits the CREDITS & LEGAL page shows (src/ui/legal.ts), kept apart from it (it brings its stylesheet and the
 *  page viewer) so other pages and tests can read the same lists. */
import { DISCORD_INVITE } from '../originals/brand';
import { ORIGINAL_SFX_CREDITS } from '../originals/sfx';
import { ARMORY_OPEN_WORKS, ORIGINAL_OPEN_CREDITS, SOUNDTRACK_CREDITS, STAGE_CC0_WORKS } from '../originals/credits';

export const MADE_HERE: readonly { what: string; how: string }[] = [
  { what: 'Fighters', how: 'Designed for this game. Their 2D art was drawn with AI image models (Gemini 3 Pro and GPT Image 2 through Tripo, and an OpenAI image model), and their 3D bodies and rigs were made with Tripo from the game\'s own concept art.' },
  { what: 'Voices', how: 'Japanese lines written for each character, voiced with text-to-speech: Qwen3-TTS VoiceDesign, run locally, and Qwen TTS preset voices on Higgsfield. Each voice was designed from a written description; none was cloned from, or made to imitate, an actor.' },
  { what: 'Music', how: 'The home screen\'s theme, the fighters\' world themes and the Rift\'s are original pieces written note by note for this game and played through the GeneralUser GS SoundFont by S. Christian Collins.' },
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
  { work: '“Hell” and “Murder of Crows” from the Horror Sound Effects Library', by: 'by Little Robot Sound Factory', sources: [['littlerobotsoundfactory.com', 'https://littlerobotsoundfactory.com'], ['OpenGameArt', 'https://opengameart.org/content/horror-sound-effects-library']], licence: 'CC BY 3.0', licenceUrl: CC_BY_3, changes: 'cut and levelled', files: ['assets/audio/ambience/hell.m4a', 'assets/audio/ambience/crows.m4a'] },
  ...ORIGINAL_SFX_CREDITS,
  ...ORIGINAL_OPEN_CREDITS,
  ...SOUNDTRACK_CREDITS,
];

/** Works free of any condition (CC0) or under an open licence, credited with thanks. */
export const OPEN_WORKS: readonly Credit[] = [
  { work: 'Stylized Asia Environment Megapack', by: 'by RG Poly', sources: [['itch.io', 'https://rg-poly.itch.io/stylized-asia-enviroment-megapack-unity-urp']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/asian/', 'assets/environment/br/'] },
  { work: 'Pirate Kit, Fantasy Town Kit, Impact Sounds, Interface Sounds, Sci-Fi Sounds and RPG Audio', by: 'by Kenney', sources: [['www.kenney.nl', 'https://www.kenney.nl']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/harbor/', 'assets/environment/br/', 'assets/audio/v2/'] },
  { work: 'Pavement 01', by: 'by Rob Tuytel', sources: [['Poly Haven', 'https://polyhaven.com/a/pavement_01']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/paving/'] },
  { work: 'Kloofendal 48d Partly Cloudy (Pure Sky)', by: 'by Greg Zaal and Jarod Guest', sources: [['Poly Haven', 'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky']], licence: 'CC0', licenceUrl: CC0, files: ['assets/environment/sky/partly-cloudy-2k.hdr'] },
  { work: 'Crowd Shouting Ambience', by: 'by StarNinjas', sources: [['OpenGameArt', 'https://opengameart.org']], licence: 'CC0', licenceUrl: CC0, files: ['assets/audio/ambience/crowd.m4a'] },
  { work: 'The recordings layered into its sound effects', by: 'by their authors', sources: [['Freesound', 'https://freesound.org']], licence: 'CC0', licenceUrl: CC0, files: ['assets/audio/v2/sfx/', 'assets/audio/v2/cc0/'] },
  { work: 'Universal Animation Library and Universal Animation Library 2', by: 'by Quaternius', sources: [['quaternius.com', 'https://quaternius.com/packs/universalanimationlibrary.html']], licence: 'CC0', licenceUrl: CC0, files: ['assets/fighters/wukong-tr1.glb', 'assets/fighters/wukong-rush1.glb', 'assets/fighters/shiden-tr1.glb', 'assets/fighters/shiden-rush1.glb'] },
  { work: 'Barlow and Barlow Condensed', by: '© 2017 The Barlow Project Authors', sources: [['GitHub', 'https://github.com/jpt/barlow']], licence: 'SIL Open Font License 1.1', licenceUrl: 'https://openfontlicense.org', files: ['assets/ui/hud/fonts/'] },
  { work: 'The libraries three.js, Rapier and Colyseus', sources: [['three.js', 'https://threejs.org'], ['Rapier', 'https://rapier.rs'], ['Colyseus', 'https://colyseus.io']], licence: 'MIT and Apache 2.0', files: [] },
  ...STAGE_CC0_WORKS,
  ...ARMORY_OPEN_WORKS,
  ...(DISCORD_INVITE ? [{ work: 'The Discord mark', by: 'from Phosphor Icons', sources: [['phosphoricons.com', 'https://phosphoricons.com']] as const, licence: 'MIT', files: [] }] : []),
];

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** Sources a visitor cannot open, named as text rather than linked: the repository below answers 404. */
export const UNOPENABLE_SOURCES: ReadonlySet<string> = new Set(['https://github.com/itzmitto/Ability-ThreeJS-Project']);
const link = (href: string, text: string) => UNOPENABLE_SOURCES.has(href) ? esc(text) : `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;

/** One credit as a line: the work, its author and source, its licence, and what was changed. */
export function creditLine(c: Credit) {
  const sources = c.sources.map(([label, url]) => link(url, label)).join(', ');
  const licence = c.licenceUrl ? link(c.licenceUrl, c.licence) : esc(c.licence);
  const by = !c.by ? '' : c.by.startsWith('©') ? `, ${esc(c.by)}` : ` ${esc(c.by)}`;
  return `<li>${esc(c.work)}${by} (${sources}), ${licence}${c.changes ? `: ${esc(c.changes)}` : ''}.</li>`;
}
