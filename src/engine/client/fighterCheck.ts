import { FIGHTERS } from '../../config';
import { AWAKENINGS } from '../../game/awakening';
import { COMBO_KEYS } from '../../game/combos';
import type { ActionKind, AttackSlot, CombatEvent, FighterId } from '../../game/types';
import { IDLE_PROFILES } from '../../render/idle/profile';
import { SPRING_PROFILES, isDynamicBoneName } from '../../render/SecondaryMotion';
import {
  AIR_STRING_CLIPS, AWAKEN_FORM_TAKE, AWAKEN_TAKE, FORM_AIR_STRING_CLIPS, FORM_NAMED_RUSH, Fighter, OWN_BODY_ULTIMATE, SLOT_CLIP_BEFORE, STAND_COMMAND, ULTIMATE_CLIPS,
  VICTORY, VICTORY_ENTRY,
} from '../../render/Fighter';
import { TAISEI_MELEE_CONTACTS, TAISEI_TRANSMISSION } from '../../render/taiseiMeleeContact';
import { SUNRISE_FLOAT } from '../../render/gummy/sunrise';
import { comboClip, comboFormClip } from '../../render/comboClips';
import { authoredClips } from '../../render/characterMotion';
import { appendClips, clipKey, findClipIn, joinClips } from '../../render/clipMatch';
import { CLIP_MAP, clipFingerprint } from './clips';
import { selectMusicTracks } from '../../audio/musicTracks';
import { planVoice } from '../../audio/voicePlan';
import { planSfx } from '../../audio/sfxPlan';
import { AUDIO_CUES } from '../../audio/cueTypes';
import { HOME_VOICES } from '../../audio/HomeVoice';
import { fighterArt, mangaPortrait } from '../../ui/MangaHome';
import { hasPoseSheet, posePoster, spriteArt } from '../../ui/HomePreview';
import { moveSheetUrl, moveSheetsFor } from '../../ui/moveSheet';

// ---------------------------------------------------------------------------------------------------------------------
// The files, by their headers.

/** One clip in a file: its name, its length, and the joints its moves, turns and scales key (by node name, as three.js
 *  names nodes: GLTFLoader's createUniqueName). */
export interface ClipHeader { readonly name: string; readonly duration: number; readonly nodes: readonly string[] }
/** What a GLB holds that decides how its clips play: every node's name, the skins' joints, and its clips. */
export interface GlbHeader { readonly nodes: readonly string[]; readonly joints: readonly string[]; readonly clips: readonly ClipHeader[] }

/** Where the check reads files from: the tests and scripts read public/, a page could read the network. */
export interface FighterFiles {
  /** A GLB's header by its URL (`/assets/...`), or undefined where there is no such file. */
  glb(url: string): GlbHeader | undefined;
  /** Whether a file is shipped, by its URL (a `?v=` suffix is not part of it). */
  exists(url: string): boolean;
}

const sanitize = (name: string) => name.replace(/\s/g, '_').replace(/[[\].:/]/g, '');
const KEYED: Readonly<Record<string, true>> = { translation: true, rotation: true, scale: true };

/** A GLB's header, from its first bytes (the JSON chunk). */
export function glbHeader(bytes: Uint8Array): GlbHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const length = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as {
    nodes?: { name?: string }[];
    skins?: { joints: number[] }[];
    animations?: { name?: string; samplers: { input: number }[]; channels: { sampler: number; target: { node?: number; path: string } }[] }[];
    accessors?: { max?: number[] }[];
  };
  // GLTFLoader's names: sanitised, and a name met again given `_1`, `_2`... (an unnamed node never binds).
  const used = new Map<string, number>();
  const nodes = (json.nodes ?? []).map(node => {
    if (!node.name) return '';
    const name = sanitize(node.name), seen = used.get(name);
    used.set(name, (seen ?? -1) + 1);
    return seen === undefined ? name : `${name}_${seen + 1}`;
  });
  const clips = (json.animations ?? []).map((animation, index) => ({
    name: animation.name ?? `animation_${index}`,
    duration: Math.max(0, ...animation.samplers.map(sampler => json.accessors?.[sampler.input]?.max?.[0] ?? 0)),
    nodes: [...new Set(animation.channels.filter(channel => KEYED[channel.target.path] && channel.target.node !== undefined)
      .map(channel => nodes[channel.target.node!]).filter(Boolean))],
  }));
  const joints = [...new Set((json.skins ?? []).flatMap(skin => skin.joints.map(joint => nodes[joint]).filter(Boolean)))];
  return { nodes, joints, clips };
}

// ---------------------------------------------------------------------------------------------------------------------
// A body's clips, in the order the game holds them.

/** A clip as a body holds it, and the file it came from. */
export interface BodyClip { readonly name: string; readonly duration: number; readonly file: string; readonly nodes: readonly string[] }
/** A file a body loads, and the clips of it that bound to the body. */
interface Loaded { readonly url: string; readonly clips: readonly BodyClip[] }
export interface Body {
  /** In the order the renderer holds them: what `findClip` searches. */
  readonly clips: readonly BodyClip[];
  readonly files: readonly Loaded[];
  readonly problems: readonly FighterProblem[];
}

/** Fighter.ts `bindClips`: a clip keeps the tracks whose joint the body has, and a clip with none left is skipped. */
function bind(nodes: ReadonlySet<string>, clips: readonly ClipHeader[], file: string): BodyClip[] {
  return clips.flatMap(clip => {
    const kept = clip.nodes.filter(node => nodes.has(node));
    return kept.length ? [{ name: clip.name, duration: clip.duration, file, nodes: kept }] : [];
  });
}
const own = (header: GlbHeader, file: string): BodyClip[] => header.clips.map(clip => ({ ...clip, file }));

/** The base body's clips (FighterLibrary.ensure, then the Fighter constructor): the body's own, the extra files' and the
 *  idle's file joined on (a name met again replaces the clip), the clips characterMotion.ts authors, then the rush file's
 *  appended (a name met again keeps the body's). */
export function baseBody(id: FighterId, files: FighterFiles): Body {
  const definition = FIGHTERS[id], problems: FighterProblem[] = [], loaded: Loaded[] = [];
  const header = files.glb(definition.model);
  if (!header) return { clips: [], files: [], problems: [{ kind: 'file', text: `its body ${definition.model} is missing` }] };
  const nodes = new Set(header.nodes.filter(Boolean));
  let clips = own(header, definition.model);
  loaded.push({ url: definition.model, clips });
  const read = (url: string) => {
    const file = files.glb(url);
    if (!file) { problems.push({ kind: 'file', text: `${url} is missing` }); return []; }
    const bound = bind(nodes, file.clips, url);
    if (!bound.length) problems.push({ kind: 'file', text: `${url} binds to nothing on the body` });
    loaded.push({ url, clips: bound });
    return bound;
  };
  const rush = definition.rushModel ? read(definition.rushModel) : undefined;
  for (const url of [...definition.extraModels ?? [], IDLE_PROFILES[id]?.model]) if (url) clips = joinClips(clips, read(url));
  // characterMotion.ts builds its clips on a rig that has an `_Idle` (and the joints its IK needs, which every rig has).
  if (clips.some(clip => clip.name === '_Idle')) clips = [...clips, ...authoredClips(id).map(clip => ({ ...clip, file: 'characterMotion.ts', nodes: [] }))];
  clips = appendClips(clips, rush);
  return { clips, files: loaded, problems };
}

/** The awakened form's clips (Fighter.attachForm): the form's own, its extra files joined on (gummy/sunrise.ts
 *  bindFormExtras), Gummy's authored Gatling, and for a worn shell (`formTint`) the fighter's combo enders' takes it has
 *  none of, bound onto it by joint name. */
export function formBody(id: FighterId, files: FighterFiles, base: Body): Body | undefined {
  const definition = FIGHTERS[id];
  if (!definition.formModel) return undefined;
  const problems: FighterProblem[] = [], loaded: Loaded[] = [];
  const header = files.glb(definition.formModel);
  if (!header) return { clips: [], files: [], problems: [{ kind: 'file', text: `its form ${definition.formModel} is missing` }] };
  const nodes = new Set(header.nodes.filter(Boolean));
  let clips = own(header, definition.formModel);
  loaded.push({ url: definition.formModel, clips });
  for (const url of definition.formExtraModels ?? []) {
    const file = files.glb(url);
    if (!file) { problems.push({ kind: 'file', text: `${url} is missing` }); continue; }
    const bound = bind(nodes, file.clips, url);
    if (!bound.length) problems.push({ kind: 'file', text: `${url} binds to nothing on the form` });
    loaded.push({ url, clips: bound });
    clips = joinClips(clips, bound);
  }
  if (id === 'gummy' && clips.some(clip => clip.name === '_Idle')) clips = [...clips, ...authoredClips(id).map(clip => ({ ...clip, file: 'characterMotion.ts', nodes: [] }))];
  if (AWAKENINGS[id].formTint !== undefined) {
    const enders = new Set(COMBO_KEYS.map(key => comboClip(id, key)?.clip).filter((name): name is string => !!name));
    const carried = base.clips.filter(clip => enders.has(clip.name) && !header.clips.some(mine => mine.name === clip.name));
    clips = appendClips(clips, carried.flatMap(clip => {
      const kept = clip.nodes.filter(node => nodes.has(node));
      return kept.length ? [{ ...clip, nodes: kept }] : [];
    }));
  }
  return { clips, files: loaded, problems };
}

// ---------------------------------------------------------------------------------------------------------------------
// Which clip each action plays (Fighter.clipFor), standing, before any string, not awakened.

export const ATTACKS: readonly AttackSlot[] = ['light', 'heavy', 'special', 'ultimate'];
/** clipFor's names where a fighter's `clips` row names none. */
const FALLBACK: Partial<Record<string, string>> = { idle: '_Idle', run: 'Run', dash: 'Dash', jump: 'jump', guard: 'Block', hurt: 'Hit 01', defeated: 'Die fall' };
/** How the clip was found, in clipFor's order; `first` is the body's first clip, played when nothing answered. */
export type Step = 'melee' | 'entry' | 'opener' | 'command' | 'float' | 'konta' | 'authored' | 'awaken' | 'reaction' | 'config' | 'gummy' | 'taisei' | 'table' | 'table-idle' | 'first';
export interface Resolved { readonly clip?: BodyClip; readonly step: Step }

/** The clip a body plays for an action (Fighter.update: `melee ?? clipFor`), for a fighter standing on the floor, not in
 *  a string or a combo ender, not awakened, its victory not yet held and its ultimate not yet confirmed (`confirmed`
 *  asks for the clip after the confirm). The idle's own loop is `idleClip`'s; enders, rush and air stages have their own
 *  resolution below, as in Fighter.ts. */
export function clipFor(id: FighterId, clips: readonly BodyClip[], action: ActionKind, form = false, confirmed = false): Resolved {
  const exact = (name: string) => clips.find(clip => clip.name === name);
  const find = (patterns: readonly string[]) => findClipIn(clips, patterns);
  const found = (clip: BodyClip | undefined, step: Step): Resolved => clip ? { clip, step } : { clip: clips[0], step: 'first' };
  // Fighter.groundedMelee: Taisei's light and heavy are his measured melee takes, ahead of clipFor.
  if (id === 'taisei' && (action === 'light' || action === 'heavy')) {
    const clip = find([TAISEI_MELEE_CONTACTS[action === 'heavy' ? TAISEI_TRANSMISSION : 0].clip]);
    if (clip) return { clip, step: 'melee' };
  }
  if (action === 'victory') { const entry = exact(VICTORY_ENTRY); if (entry) return { clip: entry, step: 'entry' }; }
  if (action === 'ultimate' && !confirmed) {
    const opener = form ? ULTIMATE_CLIPS[id]?.formOpener : ULTIMATE_CLIPS[id]?.opener;
    const clip = opener ? find([opener.clip]) : undefined;
    if (clip) return { clip, step: 'opener' };
  }
  const command = action === 'light' && !form ? STAND_COMMAND[id] : undefined;
  if (command) { const clip = find([command]); if (clip) return { clip, step: 'command' }; }
  // SUNRISE floats (gummy/sunrise.ts): a form with the float's clip stands, travels and blocks in the air.
  if (form && (action === 'idle' || action === 'run' || action === 'guard') && clips.some(clip => clip.name === SUNRISE_FLOAT.idle)) {
    const clip = find([SUNRISE_FLOAT[action]]);
    if (clip) return { clip, step: 'float' };
  }
  const slot = (ATTACKS as readonly string[]).includes(action);
  if (id === 'konta' && slot) { const clip = find([`${form ? 'Kurobi' : 'Konta'} ${action}`]); if (clip) return { clip, step: 'konta' }; }
  const authored = exact(`Authored ${id} ${action}`);
  if (authored) return { clip: authored, step: 'authored' };
  if (action === 'awaken') {
    const take = form ? AWAKEN_FORM_TAKE[id] : AWAKEN_TAKE[id];
    const clip = find([...(take ? [take] : []), ...(AWAKENINGS[id].clips ?? []), '_Idle', 'Idle', 'stance']);
    if (clip) return { clip, step: 'awaken' };
  }
  const reaction = Fighter.REACTIONS[action];
  if (reaction) { const clip = find(reaction); if (clip) return { clip, step: 'reaction' }; }
  // (A form with a kit of its own names its own slot clips: Fighter.slotClips.)
  const named = form ? FIGHTERS[id].formClips ?? FIGHTERS[id].clips : FIGHTERS[id].clips;
  if (named) {
    const index = ATTACKS.indexOf(action as AttackSlot);
    const name = index >= 0 ? named[index] : (action === 'victory' ? victoryEntry(id, clips)?.clip.name : undefined) ?? FALLBACK[action];
    const before = name ? SLOT_CLIP_BEFORE[id]?.[name] : undefined;
    return found(find(before ? [name!, before.clip] : [name ?? '_Idle']), 'config');
  }
  if (id === 'gummy') {
    const names: Record<string, string[]> = { idle: ['_Idle'], victory: VICTORY, run: ['Run'], dash: ['Dash'], jump: ['jump'], guard: ['Block'], light: ['Snapback Jab'], heavy: ['Rogue Wave'], special: ['SUNSET BARRAGE', 'Punch 01'], ultimate: ['Sunrise Tide', '_Idle'], hurt: ['Hit 01'], defeated: ['Die fall'] };
    return found(find(names[action] ?? ['_Idle']), 'gummy');
  }
  const taisei = id === 'taisei';
  if (taisei && ['dash', 'jump', 'guard', 'light', 'heavy', 'hurt'].includes(action)) {
    const adapted = find(['adapted_' + (action === 'hurt' ? 'hit' : action)]);
    if (adapted) return { clip: adapted, step: 'taisei' };
  }
  const table: Record<string, string[]> = { idle: taisei ? ['taisei-ready', '02-STANCE', 'stance', 'idle'] : ['_Idle', 'Idle'], victory: VICTORY, run: ['Run', 'Walk'], dash: ['Dash', 'Run'], jump: ['jump', 'Jump Fall'], guard: ['Block', 'Guard', '02-STANCE'], light: ['Punch 01', 'Punch', 'Light'], heavy: taisei ? ['Meteor', 'Kick 01', 'Punch 03'] : ['Whirlsphere Attack'], special: taisei ? ['03-SUNPALM-CANNON', 'Sunpalm Cannon'] : ['Whirlsphere Ready', 'Whirlsphere charge'], ultimate: taisei ? ['LAST SUN', 'Ultimate', '01-OSSU'] : ['Whirlsphere charge Clone', 'Whirlsphere charge'], hurt: ['Hit 01', 'Hit', 'Hurt'], defeated: ['Die fall', 'Fall', 'Defeated'] };
  const mine = find(table[action] ?? table.idle);
  if (mine) return { clip: mine, step: 'table' };
  return found(find(table.idle), 'table-idle');
}

/** The idle a body stands in when the match starts (the Fighter constructor): its idle profile's loop by its exact
 *  name, else what clipFor gives the idle. A form has no idle profile. */
export function idleClip(id: FighterId, clips: readonly BodyClip[], form = false): Resolved {
  const profile = form ? undefined : IDLE_PROFILES[id];
  const loop = profile?.clip ? clips.find(clip => clip.name === profile.clip) : undefined;
  return loop ? { clip: loop, step: 'entry' } : clipFor(id, clips, 'idle', form);
}

/** A won match's pose: the VICTORY entry the body first answers to (Full Beam's Lighthouse Salute ahead of the list). */
export function victoryEntry(id: FighterId, clips: readonly BodyClip[]) {
  for (const entry of id === 'full-beam' ? ['Lighthouse Salute', ...VICTORY] : VICTORY) {
    const clip = findClipIn(clips, [entry]);
    if (clip) return { entry, clip };
  }
  return undefined;
}
/** VICTORY's last entries are an idle, not a pose. */
const IDLE_ENTRIES: ReadonlySet<string> = new Set(['_Idle', 'Idle', 'taisei-ready', 'stance']);

/** A clip a table names, found as the renderer finds one there: by its exact name, then by its letters and digits, and
 *  where the table says how long its take is (`span`), only a clip of that length (Fighter.airStageClip, enderClip). */
function namedTake(clips: readonly BodyClip[], name: string, span?: number) {
  const clip = clips.find(each => each.name === name) ?? clips.find(each => clipKey(each.name) === clipKey(name));
  return clip && (span === undefined || Math.abs(clip.duration - span) < .03) ? clip : undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// The check.

export type FighterProblemKind = 'clip' | 'file' | 'victory' | 'form' | 'picture' | 'idle' | 'springs' | 'music' | 'voice' | 'sound';
export const PROBLEM_KINDS: readonly FighterProblemKind[] = ['clip', 'file', 'victory', 'form', 'picture', 'idle', 'springs', 'music', 'voice', 'sound'];
export interface FighterProblem { readonly kind: FighterProblemKind; readonly text: string }

const shown = (clip?: BodyClip) => clip ? `"${clip.name}"` : 'nothing';
const MOVEMENT: readonly ActionKind[] = ['idle', 'run', 'dash', 'jump', 'guard'];
const REACTIONS: readonly string[] = Object.keys(Fighter.REACTIONS);

/** Whether the form throws the ultimate when its fighter is not awakened (Fighter.update's `show`). */
const formThrowsUltimate = (id: FighterId) => !!FIGHTERS[id].formModel && id !== 'konta' && !OWN_BODY_ULTIMATE.has(id) && AWAKENINGS[id].formTint === undefined;
/** A knockout ends an awakening (simulation.ts `eliminate`): the base body falls, never the form. */
const BASE_ONLY_REACTIONS: ReadonlySet<string> = new Set(['defeated', 'downed']);

/** The clip checks on one body (the base, or the form with `form`). */
function clipProblems(id: FighterId, body: Body, form: boolean, formClips?: readonly BodyClip[]): FighterProblem[] {
  const out: FighterProblem[] = [], kind = form ? 'form' : 'clip', clips = body.clips;
  const add = (text: string) => out.push({ kind, text: form ? `form: ${text}` : text });
  if (!clips.length) return out;
  // Every action plays a clip it was given, not the body's first clip.
  for (const action of [...MOVEMENT, ...ATTACKS] as ActionKind[]) {
    const resolved = action === 'idle' ? idleClip(id, clips, form) : clipFor(id, clips, action, form, true);
    if (resolved.step === 'first' || resolved.step === 'table-idle') add(`${action} answers to no clip; it plays ${shown(resolved.clip)}`);
  }
  for (const reaction of REACTIONS) if (!(form && BASE_ONLY_REACTIONS.has(reaction)) && !findClipIn(clips, Fighter.REACTIONS[reaction])) add(`the ${reaction} reaction answers to no clip`);
  // A clip a table names must be on the body: an ultimate's opener on the body that throws it (the form throws the
  // ultimate, unawakened too, where it has its own and is not a worn shell: Fighter.update's `show`).
  const opener = form ? ULTIMATE_CLIPS[id]?.formOpener : ULTIMATE_CLIPS[id]?.opener;
  if (opener && !findClipIn(clips, [opener.clip]) && !(!form && formThrowsUltimate(id) && formClips?.some(clip => clipKey(clip.name).includes(clipKey(opener.clip)))))
    add(`the ultimate's opener names "${opener.clip}", which no clip answers to`);
  const command = form ? undefined : STAND_COMMAND[id];
  if (command && !findClipIn(clips, [command])) add(`the spirit command names "${command}", which no clip answers to`);
  const take = form ? AWAKEN_FORM_TAKE[id] : AWAKEN_TAKE[id];
  if (take && !findClipIn(clips, [take])) add(`the awakening take names "${take}", which no clip answers to`);
  if (!form || FORM_NAMED_RUSH.has(id)) FIGHTERS[id].rushClips?.forEach((name, i) => {
    if (!findClipIn(clips, [name])) add(`rush stage ${i + 1} names "${name}", which no clip answers to`);
  });
  const airOwn = !form || ['hawser', 'rotfalke', 'minase', 'irbis', 'rakucho', 'hagure', 'akayuri', 'madake'].includes(id);
  if (airOwn) ((form ? FORM_AIR_STRING_CLIPS[id] : undefined) ?? AIR_STRING_CLIPS[id])?.forEach((stage, i) => {
    if (stage.clip && !namedTake(clips, stage.clip, stage.span)) add(`air stage ${i} names "${stage.clip}"${stage.span !== undefined ? ` (${stage.span} s)` : ''}, which no clip answers to`);
  });
  // A combo ender's take (comboClips.ts); a form is held only to the rows written for it - with none of its own it throws
  // the slot's clip, timed to the ender, by design (Fighter.enderClip).
  for (const key of COMBO_KEYS) {
    const row = form ? comboFormClip(id, key) : comboClip(id, key);
    if (row && !namedTake(clips, row.clip, row.span) && !(form && namedTake(clips, comboClip(id, key)?.clip ?? '', comboClip(id, key)?.span)))
      add(`the ${key} ender names "${row.clip}"${row.span !== undefined ? ` (${row.span} s)` : ''}, which no clip answers to`);
  }
  if (!form) {
    const profile = IDLE_PROFILES[id];
    for (const [what, name] of [['clip', profile?.clip], ['ready', profile?.ready], ...(profile?.fidgets ?? []).map(name => ['fidget', name])] as const)
      if (name && !clips.some(clip => clip.name === name)) add(`its idle profile's ${what} names "${name}", which is not on the body`);
  }
  // A file it downloads whose clips all lose their names to another's never plays.
  for (const file of body.files.slice(1)) {
    if (!file.clips.length) continue;
    const plays = file.clips.filter(clip => clips.find(each => clipKey(each.name) === clipKey(clip.name)) === clip);
    if (!plays.length) {
      const winners = [...new Set(file.clips.map(clip => clips.find(each => clipKey(each.name) === clipKey(clip.name))?.file).filter(Boolean))];
      out.push({ kind: 'file', text: `${form ? 'form: ' : ''}${file.url} downloads but never plays: ${file.clips.map(clip => clip.name).join(', ')} lose${file.clips.length === 1 ? 's' : ''} to ${winners.join(', ') || 'nothing'}` });
    }
  }
  return out;
}

/** The engine, VOL.7, step four: the body's clip map (clips.ts), which the renderer plays from. It must be written for
 *  the clips the body carries (else the body finds them by name, as before, until scripts/engine/clipMap.mts writes it
 *  again), and every clip it names must be on the body (a `(mirrored)` rush stage is its light's mirror). */
function mapProblems(id: FighterId, body: Body, form: boolean): FighterProblem[] {
  if (!body.clips.length) return [];
  const map = form ? CLIP_MAP[id]?.form : CLIP_MAP[id], kind = form ? 'form' : 'clip', mark = form ? 'form: ' : '';
  if (!map) return [{ kind, text: `${mark}it has no clip map (scripts/engine/clipMap.mts): it finds its clips by name` }];
  const out: FighterProblem[] = [], names = new Set(body.clips.map(clip => clip.name));
  if (map.fingerprint !== clipFingerprint(body.clips)) out.push({ kind, text: `${mark}its clip map was written for other clips (scripts/engine/clipMap.mts): it finds them by name until it is written again` });
  for (const [key, name] of Object.entries(map.clips))
    if (name && !names.has(name) && !(name.endsWith(' (mirrored)') && names.has(name.slice(0, -' (mirrored)'.length))))
      out.push({ kind, text: `${mark}its clip map names "${name}" for ${key}, which is not on the body` });
  return out;
}

/** The won match's pose: its own, not its idle and not another fighter's. */
function victoryProblems(id: FighterId, body: Body, owners: ReadonlyMap<string, readonly FighterId[]>): FighterProblem[] {
  if (!body.clips.length) return [];
  const resolved = clipFor(id, body.clips, 'victory');
  const clip = resolved.clip;
  if (resolved.step !== 'entry') {
    const entry = victoryEntry(id, body.clips)?.entry;
    if (!clip || !entry || IDLE_ENTRIES.has(entry) || resolved.step === 'first') {
      // An entry named for it that its body does not carry (Murex's, before VOL.7).
      const named = VICTORY.filter(name => clipKey(name).startsWith(clipKey(FIGHTERS[id].name.split(' ')[0])));
      return [{ kind: 'victory', text: `no victory pose: it stands in ${shown(clip)}${named.length ? ` though VICTORY names ${named.map(name => `"${name}"`).join(', ')}` : ''}` }];
    }
  }
  const sharers = (owners.get(clip!.file) ?? []).filter(other => other !== id);
  if (sharers.length) return [{ kind: 'victory', text: `its victory ${shown(clip)} comes from ${clip!.file}, which ${sharers.join(', ')} also load${sharers.length === 1 ? 's' : ''}` }];
  return [];
}

const path = (url: string) => url.split('?')[0];
/** Every picture the card and the home draw this fighter with. */
function pictureProblems(id: FighterId, files: FighterFiles): FighterProblem[] {
  const pictures: [string, string][] = [
    ['portrait', FIGHTERS[id].portrait],
    ['full body', fighterArt(id)],
    ['manga portrait', /href="([^"]+)"/.exec(mangaPortrait(id))?.[1] ?? ''],
    ['poster', posePoster(id)],
    ...moveSheetsFor(id).map(sheet => ['move sheet', moveSheetUrl(sheet)] as [string, string]),
  ];
  if (hasPoseSheet(id)) pictures.push(['pose sheet', spriteArt(id)]);
  const out: FighterProblem[] = pictures.filter(([, url]) => !url || !files.exists(path(url))).map(([what, url]) => ({ kind: 'picture', text: `its ${what} ${path(url) || '(none)'} is missing` }));
  if (!hasPoseSheet(id)) out.push({ kind: 'picture', text: 'it has no pose sheet (public/assets/home/sprites/manifest.json)' });
  return out;
}

/** An event as the simulation sends it (simulation.ts emit): a cast names its slot, an awakening its name. */
const event = (fighter: FighterId, kind: 'cast' | 'awaken', slot?: AttackSlot): CombatEvent =>
  ({ id: 1, kind, serverTime: 1, actorId: 'check', fighter, ...(slot ? { slot } : { move: AWAKENINGS[fighter].name }) });
const cueUrl = (cue: string) => `/assets/audio/v2/${AUDIO_CUES[cue as keyof typeof AUDIO_CUES]}`;

/** Its idle's life, its cloth, its music, its voice and its sounds. */
function restProblems(id: FighterId, files: FighterFiles, body: Body): FighterProblem[] {
  const out: FighterProblem[] = [];
  if (!IDLE_PROFILES[id]) out.push({ kind: 'idle', text: 'it has no idle profile (src/render/idle): it stands in DEFAULT_IDLE' });
  // Springs (SecondaryMotion.ts): a rig whose own clips already move its cloth and hair needs a line of its own. The
  // default's loose 34 degree cone, made for chains no clip keys, fights a keyed garment and holds it at the cone's edge
  // (Shakugo's sleeves above his head; Senko's coat 25 degrees off his clip standing still).
  const joints = new Set((files.glb(FIGHTERS[id].model)?.joints ?? []).filter(isDynamicBoneName));
  const keyed = new Set(body.clips.flatMap(clip => clip.nodes.filter(node => joints.has(node))));
  if (!SPRING_PROFILES[id] && keyed.size) out.push({ kind: 'springs', text: `it has no spring profile (SecondaryMotion.ts SPRING_PROFILES): the default spring fights the ${keyed.size} cloth and hair joints its clips key` });
  const music = selectMusicTracks(id, undefined, 'combat');
  if (!music.length) out.push({ kind: 'music', text: 'it has no music (src/audio/musicTracks.ts): its fights are silent unless the opponent brings some' });
  for (const track of music) if (!files.exists(track.url)) out.push({ kind: 'music', text: `its music ${track.url} is missing` });
  const lines = planVoice(event(id, 'awaken')).filter(layer => layer.bus === 'voice');
  if (!lines.length) out.push({ kind: 'voice', text: 'it says nothing as it awakens (src/audio/voicePlan.ts, awakeningLines.ts)' });
  for (const line of lines) if (!files.exists(cueUrl(line.cue))) out.push({ kind: 'voice', text: `its awakening line ${cueUrl(line.cue)} is missing` });
  const home = HOME_VOICES[id];
  if (!home) out.push({ kind: 'voice', text: 'it has no home line (public/assets/audio/home/manifest.json)' });
  else if (!files.exists(home)) out.push({ kind: 'voice', text: `its home line ${home} is missing` });
  for (const slot of ATTACKS) if (!planSfx(event(id, 'cast', slot)).some(layer => layer.phase === 'cast' || layer.phase === 'charge')) out.push({ kind: 'sound', text: `its ${slot} casts with no sound (src/audio/sfxPlan.ts)` });
  if (!planSfx(event(id, 'awaken')).length) out.push({ kind: 'sound', text: 'its awakening makes no sound (src/audio/sfxPlan.ts)' });
  return out;
}

/** Which fighters load each file, so a victory pose can be told apart from one lent by another fighter's file. */
export function fileOwners(): ReadonlyMap<string, readonly FighterId[]> {
  const owners = new Map<string, FighterId[]>();
  for (const id of Object.keys(FIGHTERS) as FighterId[]) {
    const definition = FIGHTERS[id];
    for (const url of new Set([definition.model, definition.rushModel, ...definition.extraModels ?? [], IDLE_PROFILES[id]?.model]))
      if (url) owners.set(url, [...owners.get(url) ?? [], id]);
  }
  return owners;
}

/** Everything wrong with how a fighter moves, wins, looks, stands, sways and sounds, by the game's own rules. */
export function fighterProblems(id: FighterId, files: FighterFiles, owners = fileOwners()): FighterProblem[] {
  const base = baseBody(id, files), form = formBody(id, files, base);
  return [
    ...base.problems, ...clipProblems(id, base, false, form?.clips), ...mapProblems(id, base, false),
    ...victoryProblems(id, base, owners),
    ...form ? [...form.problems, ...clipProblems(id, form, true), ...mapProblems(id, form, true)] : [],
    ...pictureProblems(id, files),
    ...restProblems(id, files, base),
  ];
}
