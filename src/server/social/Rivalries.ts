import fs from 'node:fs';
import path from 'node:path';
import type { Link } from '../cluster/link';

/** One pair's record, in the pair's own order: [the first id's wins, the second's]. */
export type Record2 = [number, number];
type Line = { w: string; l: string; m?: string; at: number } | { a: string; b: string; s: Record2 };
/** Once the file holds this many lines more than it has pairs, it is folded at the next start (a line a pair). */
const FOLD_AFTER = 20_000;
const pairKey = (a: string, b: string) => a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
/** A sensible account id: what the economy deals (its `pk`), never anything a page could make long or odd. */
const sane = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200;

export class RivalryBook {
  private readonly pairs = new Map<string, Record2>();
  private readonly file?: string;
  private lines = 0;
  /** `dir` is the economy's folder (DATA_DIR/economy); none keeps the records in memory only. */
  constructor(dir?: string, private readonly now: () => number = Date.now) {
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'rivals.jsonl');
    if (!fs.existsSync(this.file)) return;
    for (const raw of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      try { this.apply(JSON.parse(raw) as Line); this.lines++; } catch { /* a torn last line from a crash: the rest stands */ }
    }
    if (this.lines > this.pairs.size + FOLD_AFTER) this.fold();
  }
  /** `winner` beat `loser` (account ids) in a match of `mode`. The same id twice, or a nonsense one, is no record. */
  record(winner: unknown, loser: unknown, mode?: string) {
    if (!sane(winner) || !sane(loser) || winner === loser) return;
    const line: Line = { w: winner, l: loser, ...(mode ? { m: mode.slice(0, 16) } : {}), at: this.now() };
    if (this.file) { fs.appendFileSync(this.file, `${JSON.stringify(line)}\n`, { flush: true } as fs.WriteFileOptions); this.lines++; }
    this.apply(line);
  }
  /** `a`'s wins over `b`, and `b`'s over `a`. */
  between(a: unknown, b: unknown): Record2 {
    if (!sane(a) || !sane(b) || a === b) return [0, 0];
    const kept = this.pairs.get(pairKey(a, b)) ?? [0, 0];
    return a < b ? [kept[0], kept[1]] : [kept[1], kept[0]];
  }
  get size() { return this.pairs.size; }
  private apply(line: Line) {
    if ('s' in line) { if (sane(line.a) && sane(line.b) && line.a < line.b) this.pairs.set(pairKey(line.a, line.b), [line.s[0] | 0, line.s[1] | 0]); return; }
    if (!sane(line.w) || !sane(line.l) || line.w === line.l) return;
    const key = pairKey(line.w, line.l), kept = this.pairs.get(key) ?? [0, 0];
    kept[line.w < line.l ? 0 : 1]++;
    this.pairs.set(key, kept);
  }
  /** The file again, a line a pair, written beside it and moved over it (a crash part-way leaves the old one whole). */
  private fold() {
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, [...this.pairs].map(([key, s]) => { const [a, b] = key.split('\u0000'); return JSON.stringify({ a, b, s }); }).join('\n') + '\n', { flush: true });
    fs.renameSync(tmp, this.file);
    this.lines = this.pairs.size;
  }
}

/** What a room uses of the rivalries: the book itself (one process, or control), or control's over the link. */
export interface Rivalries {
  record(winner: string, loser: string, mode?: string): void;
  between(a: string, b: string): Promise<Record2>;
}
let service: Rivalries | undefined;
/** This process's rivalries, once mounted (`mountRivalries`) or reached through control (`installRoomRivalries`). */
export const rivalries = () => service;

/** One process, or control: the book in the economy's folder (`dir`; none: memory only). */
export function mountRivalries(dir?: string, now?: () => number): RivalryBook {
  let book: RivalryBook;
  try { book = new RivalryBook(dir, now); } catch (error) { console.error(`[rivals] the rivalries cannot be kept in ${dir}: memory only`, error); book = new RivalryBook(undefined, now); }
  service = { record: (winner, loser, mode) => { try { book.record(winner, loser, mode); } catch (error) { console.error('[rivals] a result could not be written', error); } }, between: async (a, b) => book.between(a, b) };
  return book;
}
/** Control: answer the room processes. */
export function answerRivalries(link: Link) {
  link.handle('rivals.record', (winner, loser, mode) => { service?.record(String(winner), String(loser), typeof mode === 'string' ? mode : undefined); return true; });
  link.handle('rivals.between', (a, b) => service?.between(String(a), String(b)) ?? [0, 0]);
}
/** A room process: ask control (the book's one writer). A call that fails is logged and reads as no record. */
export function installRoomRivalries(link: Link) {
  service = {
    record: (winner, loser, mode) => { void link.call('rpc', 'rivals.record', [winner, loser, mode], 10_000).catch(error => console.error('[rivals] control could not record a result', error instanceof Error ? error.message : error)); },
    between: (a, b) => link.call<Record2>('rpc', 'rivals.between', [a, b], 4000).catch(() => [0, 0] as Record2),
  };
}
/** Tests: a rivalries service of their own (or none). */
export function setRivalries(next: Rivalries | undefined) { service = next; }
