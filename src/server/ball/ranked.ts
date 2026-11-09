/** Ranked 3 v 3's ratings (the rules are src/game/ball/ranked.ts): a standing per account per mode per season,
 *  written by the match server at a ranked match's end (or a leaver's forfeit), never by a page.
 *
 *  Kept as the rivalries are (social/Rivalries.ts): its own small file beside the economy's book (`ranked.jsonl` in its
 *  folder), a line a rated result - the standing after it, whole - appended synchronously, replayed on start, folded
 *  into one line a standing once it has grown. Nothing in it names anyone: account ids, modes and numbers. A result is
 *  taken once (its match id with the account's), so a room that tells it twice changes nothing.
 *
 *  In the cluster (ROOM_WORKERS) the file has one writer, control, as the book has: the room processes
 *  ask and record over the cluster's link (`installRoomRanked`, `answerRanked`). Pages ask control over HTTP
 *  (`mountRankedRoute`: POST /ball/ranked). */
import fs from 'node:fs';
import path from 'node:path';
import type { Link } from '../cluster/link';
import { BALL_MODES, type BallModeId } from '../../game/ball/model';
import { freshRating, intoSeason, seasonOf, type RankedAnswer, type Rating } from '../../game/ball/ranked';

type Line = { pk: string; m: BallModeId; s: number; r: Rating; id?: string; at: number };
/** Once the file holds this many lines more than it has standings, it is folded at the next start. */
const FOLD_AFTER = 20_000;
/** Results remembered, to take each once (a room tells its end once; a retry after a lost link may tell it again). */
const REMEMBER = 4000;
const sane = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200;
const keyOf = (season: number, mode: BallModeId, pk: string) => `${season}\u0000${mode}\u0000${pk}`;
const clean = (r: Partial<Rating> | undefined): Rating | undefined => r && Number.isFinite(r.rating) ? { rating: Math.round(r.rating!), games: Math.max(0, Math.floor(r.games ?? 0)), wins: Math.max(0, Math.floor(r.wins ?? 0)), peak: Math.round(Math.max(r.peak ?? r.rating!, r.rating!)) } : undefined;

export class RankedBook {
  private readonly standings = new Map<string, Rating>();
  private readonly taken = new Set<string>();
  private readonly file?: string;
  private lines = 0;
  /** `dir` is the economy's folder (DATA_DIR/economy); none keeps the ratings in memory only. */
  constructor(dir?: string, private readonly now: () => number = Date.now) {
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'ranked.jsonl');
    if (!fs.existsSync(this.file)) return;
    for (const raw of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      try { this.take(JSON.parse(raw) as Line); this.lines++; } catch { /* a torn last line from a crash: the rest stands */ }
    }
    if (this.lines > this.standings.size + FOLD_AFTER) this.fold();
  }
  /** `pk`'s standing in `mode` this season: kept, or carried from last season (halfway back to the start), or new. */
  rating(pk: string, mode: BallModeId): Rating {
    const season = seasonOf(this.now()).n, kept = this.standings.get(keyOf(season, mode, pk));
    if (kept) return { ...kept };
    const last = this.standings.get(keyOf(season - 1, mode, pk));
    return last ? intoSeason(last) : freshRating();
  }
  /** A rated result: `delta` on `pk`'s standing in `mode`, a win or not, for match `id`. The standing after it; the one
   *  before it unchanged if the result was already taken (or the account or mode is nonsense). */
  apply(pk: unknown, mode: unknown, delta: unknown, won: unknown, id: unknown): Rating | undefined {
    if (!sane(pk) || !BALL_MODES.includes(mode as BallModeId) || typeof delta !== 'number' || !Number.isFinite(delta) || !sane(id)) return undefined;
    const m = mode as BallModeId, once = `${id}\u0000${pk}`;
    if (this.taken.has(once)) return this.rating(pk, m);
    const before = this.rating(pk, m), rating = Math.round(before.rating + Math.max(-100, Math.min(100, delta)));
    const after: Rating = { rating, games: before.games + 1, wins: before.wins + (won === true ? 1 : 0), peak: Math.max(before.peak, rating) };
    const line: Line = { pk, m, s: seasonOf(this.now()).n, r: after, id, at: this.now() };
    if (this.file) { fs.appendFileSync(this.file, `${JSON.stringify(line)}\n`, { flush: true } as fs.WriteFileOptions); this.lines++; }
    this.take(line);
    return { ...after };
  }
  /** What a page is told of its account's standing. */
  answer(pk: unknown): RankedAnswer {
    const season = seasonOf(this.now());
    const modes: RankedAnswer['modes'] = {};
    if (sane(pk)) for (const mode of BALL_MODES) modes[mode] = this.rating(pk, mode);
    return { season: season.n, ends: season.end, modes };
  }
  get size() { return this.standings.size; }
  private take(line: Line) {
    const r = clean(line?.r);
    if (!sane(line?.pk) || !BALL_MODES.includes(line.m) || !Number.isInteger(line.s) || !r) return;
    this.standings.set(keyOf(line.s, line.m, line.pk), r);
    if (line.id) { this.taken.add(`${line.id}\u0000${line.pk}`); if (this.taken.size > REMEMBER) this.taken.delete(this.taken.values().next().value!); }
  }
  /** The file again, a line a standing, written beside it and moved over it (a crash part-way leaves the old one whole). */
  private fold() {
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, [...this.standings].map(([key, r]) => { const [s, m, pk] = key.split('\u0000'); return JSON.stringify({ pk, m, s: Number(s), r, at: this.now() }); }).join('\n') + '\n', { flush: true });
    fs.renameSync(tmp, this.file);
    this.lines = this.standings.size;
  }
}

/** What a room and the pages' route use of the ratings: the book itself (one process, or control), or control's over the link. */
export interface Ranked {
  rating(pk: string, mode: BallModeId): Promise<Rating>;
  apply(pk: string, mode: BallModeId, delta: number, won: boolean, id: string): Promise<Rating | undefined>;
  answer(pk: string): Promise<RankedAnswer>;
}
let service: Ranked | undefined;
/** This process's ratings, once mounted (`mountRanked`) or reached through control (`installRoomRanked`). */
export const ranked = () => service;

/** One process, or control: the book in the economy's folder (`dir`; none: memory only). */
export function mountRanked(dir?: string, now?: () => number): RankedBook {
  let book: RankedBook;
  try { book = new RankedBook(dir, now); } catch (error) { console.error(`[ranked] the ratings cannot be kept in ${dir}: memory only`, error); book = new RankedBook(undefined, now); }
  service = {
    rating: async (pk, mode) => book.rating(pk, mode),
    apply: async (pk, mode, delta, won, id) => { try { return book.apply(pk, mode, delta, won, id); } catch (error) { console.error('[ranked] a result could not be written', error); return undefined; } },
    answer: async pk => book.answer(pk),
  };
  return book;
}
/** Control: answer the room processes. */
export function answerRanked(link: Link) {
  link.handle('ranked.rating', (pk, mode) => service?.rating(String(pk), mode as BallModeId));
  link.handle('ranked.apply', (pk, mode, delta, won, id) => service?.apply(String(pk), mode as BallModeId, Number(delta), won === true, String(id)));
}
/** A room process: ask control (the book's one writer). A call that fails is logged; a rating that cannot be read is a
 *  new one's, and a result that cannot be told is lost (the match is still played). */
export function installRoomRanked(link: Link) {
  service = {
    rating: (pk, mode) => link.call<Rating>('rpc', 'ranked.rating', [pk, mode], 4000).catch(() => freshRating()),
    apply: (pk, mode, delta, won, id) => link.call<Rating | undefined>('rpc', 'ranked.apply', [pk, mode, delta, won, id], 10_000).catch(error => { console.error('[ranked] control could not record a result', error instanceof Error ? error.message : error); return undefined; }),
    answer: async () => ({ season: seasonOf(Date.now()).n, ends: seasonOf(Date.now()).end, modes: {} }),
  };
}
/** Tests: a ratings service of their own (or none). */
export function setRanked(next: Ranked | undefined) { service = next; }

interface Req { on(event: 'data', listener: (chunk: Buffer) => void): unknown; on(event: 'end' | 'error', listener: (error?: unknown) => void): unknown }
interface Res { statusCode: number; setHeader(name: string, value: string): unknown; end(body?: string): unknown }
/** The pages' ask for their account's standing (ui/ball/ranks.ts): POST /ball/ranked with `{token}`, as plain text (a
 *  simple request, no preflight). It answers ratings and nothing else, so any origin may ask. Control only (the book's
 *  writer answers the pages; the economy's book reads the token). */
export function mountRankedRoute(app: { post(path: string, handler: (req: Req, res: Res) => void): unknown }, findPk: (token: unknown) => string | undefined) {
  app.post('/ball/ranked', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    let body = '', done = false;
    const answer = (status: number, value: unknown) => { if (done) return; done = true; res.statusCode = status; res.end(JSON.stringify(value)); };
    req.on('data', chunk => { body += chunk.toString('utf8'); if (body.length > 2048) answer(413, { error: 'Too long.' }); });
    req.on('error', () => answer(400, { error: 'Unreadable.' }));
    req.on('end', () => {
      let token: unknown;
      try { token = (JSON.parse(body) as { token?: unknown }).token; } catch { answer(400, { error: 'Unreadable.' }); return; }
      const pk = findPk(token), season = seasonOf(Date.now());
      if (!pk || !service) { answer(200, { season: season.n, ends: season.end, modes: {} } satisfies RankedAnswer); return; }
      service.answer(pk).then(value => answer(200, value), () => answer(503, { error: 'Try again in a moment.' }));
    });
  });
}
