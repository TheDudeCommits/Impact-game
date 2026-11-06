import data from './clips.json';
import type { FighterId } from '../../game/types';

/** One body's map: the file it was written for (for the reader), the clips it was written for, and what it plays. */
export interface BodyClipMap {
  readonly body: string;
  readonly fingerprint: string;
  readonly clips: Readonly<Record<string, string | null>>;
}
export interface FighterClipMap extends BodyClipMap { readonly form?: BodyClipMap }

export const CLIP_MAP = data as unknown as Readonly<Partial<Record<FighterId, FighterClipMap>>>;

/** A body's clips by name and length (to the millisecond; a clip with no length of its own, 0), in the order it holds
 *  them, as one FNV-1a hash. */
export function clipFingerprint(clips: readonly { readonly name: string; readonly duration: number }[]): string {
  let hash = 0x811c9dc5;
  for (const clip of clips) {
    const text = `${clip.name}\u0000${Number.isFinite(clip.duration) ? Math.round(clip.duration * 1000) : 0}\n`;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  }
  return `${clips.length}:${hash.toString(16).padStart(8, '0')}`;
}

/** The clip fighter `fighter`'s own body (its awakened form's, with `form`) plays for `key`, as its map writes it down,
 *  whichever body asks: a borrowed move (the transplant) asks for the clip of the fighter it came from while another
 *  body draws it. `key` is an action standing ('light', 'heavy', 'special', 'ultimate', 'idle', 'victory', 'hurt'...),
 *  a light or heavy off the floor ('air light'), a rush stage ('rush 1'..'rush 3': the stage the fighter names, else
 *  the one the renderer picked; 'rush air 1'), an air-string stage ('air 0'), a combo ender ('ender lh'), the
 *  ultimate's opener ('opener') or a moment of Fighter.CLIP_RULES ('fall', 'reaction hurt'...). The clip's name; null
 *  where that body has none; undefined where its map has no entry for `key` (or there is no map). */
export function clipNameFor(fighter: FighterId, key: string, form = false): string | null | undefined {
  const entry = CLIP_MAP[fighter], clips = (form ? entry?.form : entry)?.clips;
  if (!clips) return undefined;
  if (key in clips) return clips[key];
  const stage = /^rush (\d)$/.exec(key);
  return stage ? clips[`rush fill ${stage[1]}`] : undefined;
}

/** The map of a fighter's body (`form`: its awakened form's), if it was written for exactly these clips. */
export function clipMapFor(fighter: FighterId, form: boolean, clips: readonly { readonly name: string; readonly duration: number }[]): BodyClipMap | undefined {
  const entry = CLIP_MAP[fighter], map = form ? entry?.form : entry;
  return map && map.fingerprint === clipFingerprint(clips) ? map : undefined;
}
