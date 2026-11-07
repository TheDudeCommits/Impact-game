import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIGHTERS } from '../config';
import { AUDIO_CUES } from '../audio/cueTypes';
import { STAGES, type StageId } from '../game/stages';
import type { FighterId } from '../game/types';
import { IDLE_PROFILES } from '../render/idle/profile';
import { ENEMIES } from '../survival/enemies';
import AUDIO_MANIFEST from '../../public/assets/audio/v2/manifest.json';
import VOICE_MANIFEST from '../../public/assets/audio/v2/voice/manifest.json';
import HOME_VOICE_MANIFEST from '../../public/assets/audio/home/manifest.json';
import { ALL_FIGHTERS, cueFighter, fighterShown, gateFighterManifest, hordeOpen, modeOpen, originalMusic, pageShipped, raidersOpen, stageSafe } from './launch';
import { OWN_ART } from './ownArt';
import { MAIN_EFFECT_FILES } from './effects';
import { UNSHIPPED_ARMORY_FILES } from './credits';
import { WITHHELD_GRUNT_FILES } from './survival';
import { ORIGINALS } from './roster';
import { readTakePackJson, takePackUrl } from '../engine/client/takePacks';
import { BUILT_PLACES, WITHHELD_SKIES, RETIRED_FILES, RETIRED_KIT, STAGE_SKIES, stageSky } from './stages';

/** Every /assets/ path a value names, as a package path (no leading slash), whatever field holds it. */
function pathsIn(value: unknown, into = new Set<string>()) {
  if (typeof value === 'string') { if (value.startsWith('/assets/')) into.add(value.slice(1).split(/[?#]/, 1)[0]); }
  else if (Array.isArray(value)) for (const each of value) pathsIn(each, into);
  else if (value && typeof value === 'object') for (const each of Object.values(value)) pathsIn(each, into);
  return into;
}

/** The files a fighter is drawn and heard with, by its definition and by the id-named files the game reads. */
function fighterFiles(id: FighterId) {
  const files = pathsIn(FIGHTERS[id]);
  pathsIn(IDLE_PROFILES[id]?.model, files);
  for (const file of [`assets/home/fighters/${id}.webp`, `assets/home/portraits/${id}.webp`, `assets/home/sprites/${id}.webp`,
    `assets/home/sprites/${id}-poster.webp`, `assets/ui/moves/${id}.webp`, `assets/audio/home/${id}.m4a`]) files.add(file);
  for (let page = 1; page <= 8; page++) files.add(`assets/home/sprites/${id}-p${page}.webp`);
  for (const [cue, file] of Object.entries(AUDIO_CUES as Record<string, string>)) if (cueFighter(cue) === id) files.add(`assets/audio/v2/${file}`);
  return files;
}

const UNCLEARED = new Set(([...AUDIO_MANIFEST.assets, ...VOICE_MANIFEST.assets] as { file: string; license?: string }[])
  .filter(asset => /not cleared/i.test(String((asset as { license?: string }).license ?? ''))).map(asset => asset.file.slice(1)));

/** Arcade Survival's own pictures, shipped whole by the packager: the draft's cards and the intro's panels (the sign-in
 *  dialog's picture and the Rift's display face live among them and stay). */
const SURVIVAL_ART = [/^assets\/survival\/cards\//, /^assets\/survival\/intro\/\d+\.webp$/];
/** Rift War's own units, structures and floor (src/render/moba; the packager lists the folders whole): nothing else loads them,
 *  and they ship once the mode opens (loose ends, 3 November 2026: the remaining-items audit, section 6). */
const RIFT_WAR_FILES = [/^assets\/moba\//, /^assets\/environment\/rift-war\//];
/** The Rift's horde, which Arcade Survival and Last Stand field: the bosses' entrance portraits and their voices. */
const HORDE_ART = [/^assets\/survival\/portraits\//, /^assets\/audio\/survival\/boss-/];
const RAIDERS = /^assets\/objectives\/enemies\//;
const PROVENANCE = new Set(['assets/audio/home/manifest.json', 'assets/music/manifest.json', 'assets/audio/v2/manifest.json',
  'assets/home/manifest.json', 'assets/ui/manifest.json',
  'assets/environment/br/skies.json']);

const MAIN_OG_IMAGE = '95c3845cff33e8a6ad295f60b870898f79bac6e40f5579007b6e86eb79c5938b';
const mainOgImage = (file: string) => file === 'og-image.jpg' && existsSync('public/og-image.jpg')
  && createHash('sha256').update(readFileSync('public/og-image.jpg')).digest('hex') === MAIN_OG_IMAGE;

const WITHHELD_PROPS = new Set(['assets/props/steamroller1.glb']);

const OWN_ART_DIRS: [RegExp, Record<string, string>][] = [[/^assets\/hud\/busts\/([^/]+)$/, OWN_ART.busts], [/^assets\/ui\/moves\/area\/([^/]+)$/, OWN_ART.areaCards],
  [/^assets\/home\/modes\/(rift-war\.webp)$/, OWN_ART.modeTiles]];
function withheldArt(file: string) {
  for (const [folder, own] of OWN_ART_DIRS) {
    const name = folder.exec(file)?.[1];
    if (name === undefined) continue;
    const listed = own[name], at = `public/${file}`;
    return !(listed && existsSync(at) && createHash('sha256').update(readFileSync(at)).digest('hex') === listed);
  }
  return false;
}

export function takePackOwner(id: FighterId): 'own' | 'stale' | 'other' | 'none' {
  const at = `public${takePackUrl(id)}`;
  if (!existsSync(at)) return 'none';
  const bytes = readFileSync(at);
  let json: { fighter?: string; files?: Record<string, string> };
  try { json = readTakePackJson(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).json; } catch { return 'other'; }
  const def = FIGHTERS[id];
  const urls = [...new Set([def.model, def.rushModel, ...def.extraModels ?? [], IDLE_PROFILES[id]?.model, def.formModel, ...def.formExtraModels ?? [], def.openHandsModel]
    .filter((url): url is string => !!url))];
  const recorded = json.files ?? {};
  if (!fighterShown(id) || !ORIGINALS[id] || json.fighter !== id || Object.keys(recorded).sort().join() !== [...urls].sort().join()) return 'other';
  for (const url of urls) {
    const file = `public${url}`;
    if (!existsSync(file) || createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12) !== recorded[url]) return 'stale';
  }
  return 'own';
}

/** The files to leave out of the package, of those `files` holds. */
export function launchUnshipped(files: Iterable<string>): string[] {
  const shown = new Set<string>(), hidden = new Set<string>();
  for (const id of ALL_FIGHTERS) for (const file of fighterFiles(id)) (fighterShown(id) ? shown : hidden).add(file);
  // A home line of a fighter the game has not built (the manifest's Yodaka and Shanxiao) is nobody's.
  for (const asset of HOME_VOICE_MANIFEST.assets) if (!fighterShown(asset.fighter)) hidden.add(asset.file.slice(1));
  for (const id of ALL_FIGHTERS) if (takePackOwner(id) !== 'own') hidden.add(`assets/fighters/takes/${id}.bin`);
  if (!fighterShown('sorayomi')) hidden.add('assets/fighters/sorayomi-storm.webp');
  for (const [id, file] of [['shakugo', 'shakugo-hound-projectile.glb'], ['psyche', 'psyche-grown-arm1.glb']] as const) if (!fighterShown(id)) hidden.add(`assets/fighters/${file}`);
  for (const [id, field] of [['bonsho', 'sculpture'], ['akaito', 'spirit']] as const) {
    const own = ORIGINALS[id]?.[field];
    if (own && !fighterShown(id)) hidden.add(own.slice(1));
  }
  for (const id of ['kinu', 'gosu'] as const) {
    const own = ORIGINALS[id]?.companion;
    if (own && !fighterShown(id)) for (const each of [own.model, own.punches]) if (each) hidden.add(each.slice(1));
  }
  for (const [id, file] of [['shakugo', 'shakugo-magma1.glb']] as const) if (!fighterShown(id)) hidden.add(`assets/fighters/${file}`);
  for (const file of MAIN_EFFECT_FILES) hidden.add(file);
  // The Armory's dragon, CC BY-NC (non-commercial only): the Forge no longer offers it (src/originals/credits.ts).
  for (const file of UNSHIPPED_ARMORY_FILES) hidden.add(file);
  for (const file of WITHHELD_GRUNT_FILES) hidden.add(file);
  for (const id of Object.keys(STAGES) as StageId[]) if (!stageSafe(id)) for (const end of ['', '-thumb']) hidden.add(`assets/stages/previews/${id}${end}.webp`);
  for (const stage of Object.values(STAGES)) if (stage.model && !stageSafe(stage.id as StageId)) hidden.add(stage.model.slice(1));
  for (const id of Object.keys(BUILT_PLACES) as StageId[]) {
    const model = STAGES[id].model;
    if (!model) continue;
    hidden.add(model.slice(1));
  }
  for (const file of RETIRED_FILES) hidden.add(file);
  for (const file of RETIRED_KIT) hidden.add(file);
  for (const id of Object.keys(STAGES) as StageId[]) if (!stageSafe(id) && !STAGE_SKIES[id]) hidden.add(stageSky(id).slice(1));
  for (const file of WITHHELD_SKIES) hidden.add(`assets/environment/br/${file}`);
  if (!hordeOpen()) for (const enemy of Object.values(ENEMIES)) if (enemy.model) hidden.add(enemy.model.slice(1));
  const out: string[] = [];
  for (const file of files) {
    const away = (hidden.has(file) && !shown.has(file)) || !pageShipped(file) || UNCLEARED.has(file)
      || (file.startsWith('assets/music/') && /\.(m4a|mp3|ogg|wav|aac)$/.test(file) && !originalMusic(`/${file}`))
      || (!modeOpen('arcade') && SURVIVAL_ART.some(dir => dir.test(file))) || (!hordeOpen() && HORDE_ART.some(dir => dir.test(file)))
      || (!raidersOpen() && RAIDERS.test(file)) || (!modeOpen('rift-war') && RIFT_WAR_FILES.some(dir => dir.test(file)))
      || mainOgImage(file) || PROVENANCE.has(file) || WITHHELD_PROPS.has(file) || withheldArt(file);
    if (away) out.push(file);
  }
  return out;
}

export function launchFighterManifest(manifest: Record<string, unknown>) {
  for (const key of Object.keys(manifest)) if (!['version', 'units', 'up', 'forward'].includes(key)) delete manifest[key];
  Object.assign(manifest, { note: "Originals fork: the fighters' bodies are recorded in docs/originals/LEDGER.md.", fighters: {} });
  return manifest;
}

/** The package's per-fighter manifests, rewritten in place (the packager calls this once its files are copied, before it
 *  lists and hashes them): each shipped JSON file that holds entries for fighters (gateFighterManifest: the home pose
 *  sheets' manifest, the home lines' when it ships) loses every hidden fighter's entry, and keeps every other entry and
 *  its indentation. Returns the files it rewrote. */
export function launchManifests(destination: string, files: Iterable<string>): string[] {
  const rewritten: string[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const at = path.join(destination, file);
    if (!existsSync(at)) continue;
    const text = readFileSync(at, 'utf8');
    let manifest: unknown;
    try { manifest = JSON.parse(text); } catch { continue; }
    const gated = gateFighterManifest(manifest);
    if (gated === manifest) continue;
    const indent = /^[{[]\r?\n([ \t]+)/.exec(text)?.[1] ?? '';
    writeFileSync(at, JSON.stringify(gated, null, indent || undefined) + (text.endsWith('\n') ? '\n' : ''));
    rewritten.push(file);
  }
  return rewritten;
}
