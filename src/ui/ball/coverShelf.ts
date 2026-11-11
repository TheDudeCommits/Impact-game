import { BALL_TEAMS, type BallModeId, type BallTeam, type BallView } from '../../game/ball/model';
import { BALL_ARENAS, type BallArenaId } from '../../game/ball/arenas';
import { FIGHTERS } from '../../config';
import type { FighterId } from '../../game/types';

/**
 * The cover shelf: a win with an accolade keeps its cover, and your best twenty sit on a shelf in Account - stills
 * kept on the device, no clips. The final whistle's cover (BallCover.ts) is kept here when it is a
 * win on this device with an accolade: its face (the words and numbers it shows) in one index and its still - the
 * frozen frame's crop, a small WebP or JPEG as a data: address - under a key of its own, both in this browser's
 * localStorage. Nothing is sent anywhere, and nothing here is carried to the account (ui/progress/sync.ts never reads
 * these keys). A browser that refuses to keep them (a private window, full storage) keeps none and says nothing: the
 * shelf is a keepsake, never a reason for an error.
 *
 * The best SHELF.keep stay, by coverWorth; a twenty-first takes the place of the least (the older of two equal), or is
 * not kept when it is the least itself. Account draws the shelf (coverShelf), and nothing at all while it is empty.
 */
export const SHELF = {
  /** Covers kept at most. */
  keep: 20,
  /** A still at most, in characters of its data: address (what the browser's storage counts): a 240 x 353 still is
   *  about 15-30k as WebP. Past it the still is encoded smaller (BallCover.still), and never kept above it, so the
   *  shelf's stills are at most 20 x 40k = 800k characters, and its index about 4k more. */
  stillMost: 40_000,
  /** The keys: the index (faces, worths, the volumes counted), and each still's, its id after the colon. */
  key: 'rift-ball-covers', still: 'rift-ball-cover:',
} as const;

/** What a cover shows: the mode (its title), the volume, the arena, the score, the winners and the MVP. */
export interface CoverFace {
  mode: BallModeId;
  /** The volume: this device's finished matches of the mode, this one included (volumeNext). */
  vol: number;
  arena?: BallArenaId;
  score: Record<BallTeam, number>;
  winner: BallTeam | 'draw';
  /** The MVP as the cover names them (a bot, or a person who kept the default name, by the fighter's name), with the
   *  fighter drawn. An online MVP's name is another person's: it stays on this device with the cover, and that is all. */
  mvp: { name: string; fighter: FighterId; team: BallTeam } | null;
}
/** A cover on the shelf: its face, its still's id, when it was kept (ms since 1970) and its worth. */
export interface ShelfCover extends CoverFace { id: string; at: number; worth: number }
interface Index { vols: Partial<Record<BallModeId, number>>; covers: ShelfCover[] }
/** Where it is kept: localStorage, or a stand-in for the tests. */
export type CoverStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const local = (): CoverStore | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

const MODES: readonly BallModeId[] = ['goal-rush', 'sky-spike'];
const isFace = (c: unknown): c is ShelfCover => {
  const o = c as ShelfCover | null;
  return !!o && typeof o.id === 'string' && MODES.includes(o.mode) && Number.isFinite(o.vol) && Number.isFinite(o.at) && Number.isFinite(o.worth)
    && !!o.score && Number.isFinite(o.score.red) && Number.isFinite(o.score.blue) && (o.winner === 'draw' || BALL_TEAMS.includes(o.winner))
    && (o.mvp === null || (!!o.mvp && typeof o.mvp.name === 'string' && !!FIGHTERS[o.mvp.fighter] && BALL_TEAMS.includes(o.mvp.team)))
    && (o.arena === undefined || !!BALL_ARENAS[o.arena]);
};
/** The index as kept (anything that does not read as one is an empty shelf). */
function readIndex(store: CoverStore | null): Index {
  try {
    const raw = store?.getItem(SHELF.key), v = raw ? JSON.parse(raw) as Partial<Index> : null;
    const vols: Index['vols'] = {};
    for (const mode of MODES) { const n = v?.vols?.[mode]; if (typeof n === 'number' && Number.isFinite(n) && n > 0) vols[mode] = Math.floor(n); }
    return { vols, covers: Array.isArray(v?.covers) ? v.covers.filter(isFace).slice(0, SHELF.keep) : [] };
  } catch { return { vols: {}, covers: [] }; }
}
const writeIndex = (store: CoverStore | null, index: Index) => { try { if (!store) return false; store.setItem(SHELF.key, JSON.stringify(index)); return true; } catch { return false; } };

/**
 * What a final whistle's cover is worth to the shelf, or null when it is not kept: only a win on this device with an
 * accolade. `local`: the people this page plays (its own seat; a couch's second). The winners among them must have
 * earned an accolade in it (any of the match's: HAT TRICK, SAVIOR, ON FIRE...), or be its MVP.
 *
 * The worth: 3 for every accolade they earned (HAT TRICK twice is 6) and 3 for the MVP; 3 when a person played on the
 * other side (an online room, a couch's two as rivals), else the bots' level (EASY 0, NORMAL 1, HARD 2); and the
 * margin, 1 a goal or a point, at most 3.
 */
export function coverWorth(view: BallView, local: readonly string[]): number | null {
  const won = view.winner;
  if (view.practice || view.phase !== 'over' || !won || won === 'draw') return null;
  const ours = view.seats.filter(s => local.includes(s.id) && !s.bot && s.team === won);
  if (!ours.length) return null;
  const accolades = ours.reduce((n, s) => n + (s.feats?.length ?? 0), 0), mvp = ours.some(s => s.id === view.mvp);
  if (!accolades && !mvp) return null;
  const people = view.seats.some(s => !s.bot && s.team !== won);
  const margin = Math.min(3, Math.abs(view.score.red - view.score.blue));
  return accolades * 3 + (mvp ? 3 : 0) + (people ? 3 : view.level === 'easy' ? 0 : view.level === 'hard' ? 2 : 1) + margin;
}

/** The next volume of a mode on this device (each final whistle seen is one), counted as it is taken. A browser that
 *  keeps nothing counts for the page's life. */
const counted: Partial<Record<BallModeId, number>> = {};
export function volumeNext(mode: BallModeId, store: CoverStore | null = local()): number {
  const index = readIndex(store);
  let vol = (index.vols[mode] ?? 0) + 1;
  index.vols[mode] = vol;
  if (!writeIndex(store, index)) vol = Math.max(vol, (counted[mode] ?? 0) + 1);
  counted[mode] = vol;
  return vol;
}

/** The covers on the shelf, as kept (best first). */
export const shelfCovers = (store: CoverStore | null = local()): readonly ShelfCover[] => readIndex(store).covers;
/** A still as the shelf keeps it: a WebP or JPEG data: address of base64 alone, within SHELF.stillMost. Checked on the way
 *  in (keepCover) and on the way out (shelfStill): what is read back goes into an <img src>, and storage is anyone's to
 *  edit, so nothing else is let through. */
const STILL_SHAPE = /^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
export const isStill = (data: unknown): data is string => typeof data === 'string' && data.length <= SHELF.stillMost && STILL_SHAPE.test(data);
/** A kept cover's still (a data: address), or null - also for one that does not read as a still (its cover is then left
 *  off the shelf). */
export const shelfStill = (id: string, store: CoverStore | null = local()): string | null => { try { const data = store?.getItem(SHELF.still + id); return isStill(data) ? data : null; } catch { return null; } };
const better = (a: ShelfCover, b: ShelfCover) => b.worth - a.worth || b.at - a.at;

/** The last cover this page kept, by its match (BallCeremony's key for it), for the results to say so. */
let lastKept: { match: string; vol: number } | null = null;
export const keptFor = (match: string) => lastKept?.match === match ? lastKept.vol : 0;

/** Keep a cover: its face, its worth and its still (`match`: whose, for keptFor). The kept entry, or null when it is not
 *  kept - the least of SHELF.keep + 1, a still past SHELF.stillMost, or a browser that refuses (nothing is left
 *  half-written then). */
export function keepCover(face: CoverFace, worth: number, still: string, match = '', store: CoverStore | null = local(), now = Date.now()): ShelfCover | null {
  if (!store || !isStill(still)) return null;
  const index = readIndex(store);
  const cover: ShelfCover = { ...face, id: `${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, at: now, worth };
  const all = [...index.covers, cover].sort(better), kept = all.slice(0, SHELF.keep), dropped = all.slice(SHELF.keep);
  if (!kept.includes(cover)) return null;
  try { store.setItem(SHELF.still + cover.id, still); } catch { return null; }
  if (!writeIndex(store, { ...index, covers: kept })) { try { store.removeItem(SHELF.still + cover.id); } catch { /* Nothing more to undo. */ } return null; }
  for (const gone of dropped) try { store.removeItem(SHELF.still + gone.id); } catch { /* Its still is left unread. */ }
  if (match) lastKept = { match, vol: cover.vol };
  return cover;
}

/** The order on the shelf: each mode's volumes in turn, Goal Rush's first, as a collector shelves two series. */
export const shelfOrder = (covers: readonly ShelfCover[]) => [...covers].sort((a, b) => MODES.indexOf(a.mode) - MODES.indexOf(b.mode) || a.vol - b.vol || a.at - b.at);

// ---- the shelf in Account --------------------------------------------------------------------------------------------

/** Each still as a short blob: address for the page (made once: the panel draws itself again often), the data: address
 *  where the page cannot make one. */
const urls = new Map<string, string>();
function stillUrl(id: string, store: CoverStore | null): string | null {
  const had = urls.get(id);
  if (had) return had;
  const data = shelfStill(id, store);
  if (!data) return null;
  let url = data;
  try {
    const comma = data.indexOf(','), type = data.slice(5, data.indexOf(';')), bytes = atob(data.slice(comma + 1)), raw = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) raw[i] = bytes.charCodeAt(i);
    if (typeof URL.createObjectURL === 'function') url = URL.createObjectURL(new Blob([raw], { type }));
  } catch { url = data; }
  urls.set(id, url);
  return url;
}

/** The shelf, for Account's PROFILE tab: the kept covers in a row (BallCover.ts draws each, over its still), or nothing
 *  at all when none is kept - no empty frames. `draw` draws one cover over its still (BallCover's coverHtml). */
export function shelfHtml(draw: (face: CoverFace, art: string) => string, store: CoverStore | null = local()): string {
  const covers = shelfOrder(shelfCovers(store)).map(c => ({ c, url: stillUrl(c.id, store) })).filter(x => !!x.url);
  if (!covers.length) return '';
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const items = covers.map(({ c, url }) => `<li title="${c.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE'} VOL. ${c.vol} · ${day(c.at)}">${draw(c, `<img alt="" src="${url}" decoding="async" draggable="false">`)}</li>`).join('');
  return `<section class="cover-shelf" aria-label="Your covers"><h3><span>THE SHELF</span><small>${covers.length} ${covers.length === 1 ? 'COVER' : 'COVERS'} · YOUR BEST ${SHELF.keep}, KEPT ON THIS DEVICE</small></h3><ol>${items}</ol></section>`;
}
