/** Every fighter's VFX casting (docs/engine/VFX.md): for its body and its four moves, the Armory effect picked, its
 *  alternates, when and where it plays, at what size, and why, plus the fighter's palette (the look preset the
 *  effects are drawn in). One data file (./casting.json), written by people and agents from the matcher's shortlists
 *  and the stills, and by the workbench; read by the cue tracks the renderer plays, the casting pages, and the sync,
 *  which flags where the Armory's newest effects now outrank a pick.
 *
 *  Pure data and functions: safe for tools and tests. */
import type { FighterId } from '../../game/types';
import { MOVES } from '../../game/moves';
import { FIGHTERS } from '../../config';
import { effectById, tagsOf } from './tags';
import { needOf, rank, worldOf, type CastSlot } from './matcher';
import castingJson from './casting.json';

export const CAST_SLOTS: readonly CastSlot[] = ['body', 'light', 'heavy', 'special', 'ultimate'];
/** The engine's own effect types a casting may pick besides Armory effects: an id with a `/` (VOL.2's kits; the ICE
 *  kit is render/vfx/engine/ice, `ICE`). Ice uses the ICE kit's look (ice-a). */
export const NATIVE_EFFECTS = ['ice/crystal-field', 'ice/lance', 'ice/freeze', 'ice/floor-freeze', 'ice/pheasant'] as const;
export const isNative = (id: string) => id.includes('/');
/** Where on the thrower or the target an effect plays. */
export type Anchor = 'body' | 'hand' | 'feet' | 'weapon' | 'line' | 'target' | 'ground';
/** Which combat event starts it (the cue director's `on`, render/vfx/engine/cues.ts). */
export type CueEvent = 'cast' | 'release' | 'hit' | 'confirm' | 'land';

export interface SlotCasting {
  /** The Armory effect's id, or null: this slot keeps the game's own effect. */
  pick: string | null;
  alt?: string[];
  on?: CueEvent;
  /** For the body: when the aura shows. */
  when?: 'awakened' | 'always' | 'never';
  scale?: 'small' | 'medium' | 'large' | 'huge';
  anchor?: Anchor;
  /** Casts of the pick fanned out from the thrower, one per finger or blade (Slag Lances's five threads of flame):
   *  how many (1 to 7, default 1) and over how many degrees (default 26). */
  fan?: number;
  spread?: number;
  /** Values for the effect's own settings block (the Armory's live sliders, src/config/abilities/<id>.js), over its
   *  defaults: e.g. a prop turned off, an element switched. Colours come from the fighter's palette, not from here. */
  settings?: Record<string, number | string | boolean>;
  /** The Armory effect's own sound (src/engine/vfx/armory/sounds.json), played through the game's effects bus. Left out:
   *  only what the game's own move sounds don't already cover, its sustain and its tail (the fire burning on, then
   *  dying), quietly. `true`: its whole profile, cast and hits included (a slot the game leaves silent). `false`: none. */
  sound?: boolean;
  /** Which form's move it draws: `base` only the unawakened fighter's (a form that throws another move from the slot,
   *  Kurobi's Foxfire Blast for Konta's Galewheel), `awakened` only the form's. Left out, both. */
  form?: 'base' | 'awakened';
  why: string;
}
export interface MoveIdea {
  slot: Exclude<CastSlot, 'body'>;
  /** The move it would replace, and the signature move it would become. */
  now: string; idea: string;
  effect?: string; style?: 'melee' | 'projectile' | 'beam' | 'field' | 'bomb';
  why: string;
}
export interface FighterCasting {
  /** The fighter's effect colours: its hot core, main body and outer rim, as #rrggbb. */
  palette: { core: string; main: string; rim: string; note?: string };
  slots: Record<CastSlot, SlotCasting>;
  moveIdeas?: MoveIdea[];
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
  /** Who cast it, and when (an ISO date). */
  by: string; at: string;
}
export const CASTING = castingJson as unknown as Partial<Record<FighterId, FighterCasting>>;

const HEX = /^#[0-9a-f]{6}$/i;
/** Everything wrong with a fighter's casting, in words a person can act on. */
export function castingProblems(id: FighterId, casting: FighterCasting = CASTING[id]!): string[] {
  const out: string[] = [];
  if (!MOVES[id]) out.push(`${id}: no such fighter`);
  for (const key of ['core', 'main', 'rim'] as const) if (!HEX.test(casting.palette?.[key] ?? '')) out.push(`${id}: palette.${key} must be #rrggbb`);
  const world = worldOf((FIGHTERS as Record<string, { series?: string }>)[id]?.series);
  for (const slot of CAST_SLOTS) {
    const cast = casting.slots?.[slot];
    if (!cast) { out.push(`${id} ${slot}: missing`); continue; }
    if (!cast.why?.trim()) out.push(`${id} ${slot}: say why`);
    if (cast.fan !== undefined && !(Number.isInteger(cast.fan) && cast.fan >= 1 && cast.fan <= 7)) out.push(`${id} ${slot}: fan must be a whole number from 1 to 7`);
    if (cast.spread !== undefined && !(cast.spread > 0 && cast.spread <= 120)) out.push(`${id} ${slot}: spread must be 0 to 120 degrees`);
    if (cast.sound !== undefined && typeof cast.sound !== 'boolean') out.push(`${id} ${slot}: sound must be true or false`);
    if (cast.form !== undefined && cast.form !== 'base' && cast.form !== 'awakened') out.push(`${id} ${slot}: form must be base or awakened`);
    for (const [key, value] of Object.entries(cast.settings ?? {}))
      if (!/^[A-Za-z_][\w.]*$/.test(key) || !['number', 'string', 'boolean'].includes(typeof value)) out.push(`${id} ${slot}: setting "${key}" must be a name with a number, text or true/false`);
    for (const effectId of [cast.pick, ...(cast.alt ?? [])]) {
      if (effectId === null || effectId === undefined) continue;
      if (isNative(effectId)) { if (!(NATIVE_EFFECTS as readonly string[]).includes(effectId)) out.push(`${id} ${slot}: "${effectId}" is no engine effect (${NATIVE_EFFECTS.join(', ')})`); continue; }
      const effect = effectById(effectId);
      if (!effect) { out.push(`${id} ${slot}: "${effectId}" is not in the Armory's catalogue`); continue; }
      if (!effect.licence.ok) out.push(`${id} ${slot}: "${effectId}" is not cleared to ship (${effect.licence.notes[0]})`);
      const worlds = tagsOf(effect).worlds;
      if (worlds.length && (!world || !worlds.includes(world))) out.push(`${id} ${slot}: "${effectId}" belongs to ${worlds.join('/')}, not ${world ?? 'this fighter\'s world'}`);
    }
  }
  for (const idea of casting.moveIdeas ?? []) {
    if (!['light', 'heavy', 'special', 'ultimate'].includes(idea.slot) || !idea.now?.trim() || !idea.idea?.trim() || !idea.why?.trim())
      out.push(`${id}: a move idea needs slot, now, idea and why (${JSON.stringify(idea).slice(0, 80)})`);
    if (idea.effect && !idea.effect.includes('/') && !effectById(idea.effect)) out.push(`${id}: move idea effect "${idea.effect}" is not in the Armory's catalogue`);
  }
  return out;
}

/** For a sync: where a new or changed Armory effect now outranks a fighter's pick, and picks that need a person. */
export function suggestions(change: { added: string[]; changed: string[]; removed: string[] }): string[] {
  const out: string[] = [];
  const fresh = new Set([...change.added, ...change.changed]);
  for (const [id, casting] of Object.entries(CASTING) as [FighterId, FighterCasting][]) {
    const series = (FIGHTERS as Record<string, { series?: string }>)[id]?.series;
    for (const slot of CAST_SLOTS) {
      const cast = casting.slots[slot];
      if (cast.pick && change.removed.includes(cast.pick)) { out.push(`**${id} ${slot}**: its pick \`${cast.pick}\` left the Armory; pick again.`); continue; }
      if (cast.pick && change.changed.includes(cast.pick)) out.push(`${id} ${slot}: its pick \`${cast.pick}\` changed upstream; look at it again.`);
      if (!fresh.size) continue;
      const move = slot === 'body' ? undefined : MOVES[id][slot];
      const ranked = rank(needOf(id, slot, move, series), { limit: 12 });
      const pickRank = ranked.findIndex(m => m.effect.id === cast.pick);
      const better = ranked.filter((m, i) => fresh.has(m.effect.id) && (pickRank < 0 || i < pickRank)).slice(0, 2);
      for (const m of better) out.push(`${id} ${slot} (${move?.name ?? 'body'}): new \`${m.effect.id}\` (${m.effect.label}) ranks above \`${cast.pick ?? 'none'}\` (${m.reasons.join('; ')}).`);
    }
  }
  return out;
}
