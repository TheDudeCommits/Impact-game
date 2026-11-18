/* The match server's book into the economy world, once: the records the world keeps
 * (book.ts's keys), in signed chunks that fit PlayerTwo's 16 KB messages, applied by the world as they come, and
 * digests of both sides to compare.
 *
 * A chunk: { run, n, of, exp, z, mac }. `z` is the chunk's records ([key, value] pairs, JSON) deflated and base64url;
 * `mac` is HMAC-SHA256 with P2ROOM_KEY over "<run>.<n>.<of>.<exp>.<z>" (the bundle's key: only the operator's tool can
 * make one, and a page only carries it). A chunk sets its keys and nothing else, so one sent twice changes nothing and
 * the chunks may come in any order. The world takes them only for the import run the operator began (admin import-begin)
 * and only while it isn't open to pages.
 *
 * A digest: for a key prefix, how many keys the world holds under it and SHA-256 of "<key>\n<value as JSON>\n" for
 * each in key order: the tool works out the same from its own records, prefix by prefix, so a difference is found to
 * a few hundred keys. */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { sha256 } from '../engine/sim/hash';
import type { KV } from './kv';

export type Record_ = [key: string, value: unknown];
export interface Chunk { run: string; n: number; of: number; exp: number; z: string; mac: string }
/** The most a chunk's message may be (PlayerTwo takes 16 KB; the envelope's own keys are the rest). */
export const CHUNK_MAX = 15_000;
/** How long the chunks of a run are good for. */
export const CHUNK_MS = 24 * 3600_000;

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (text: string) => { const s = atob(text.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
const keys = new Map<string, Promise<CryptoKey>>();
const keyOf = (secret: string) => { let k = keys.get(secret); if (!k) { k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); keys.set(secret, k); } return k; };
const signed = (c: Omit<Chunk, 'mac'>) => `${c.run}.${c.n}.${c.of}.${c.exp}.${c.z}`;
async function macOf(secret: string, text: string) { return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await keyOf(secret), enc.encode(text)))); }

/** Records into chunks, each at most CHUNK_MAX as a message: as many records as deflate into it. */
export async function chunksOf(records: readonly Record_[], secret: string, run: string, now = Date.now()): Promise<Chunk[]> {
  const exp = now + CHUNK_MS, groups: string[] = [];
  const pack = (list: readonly Record_[]) => b64url(deflateSync(strToU8(JSON.stringify(list)), { level: 9 }));
  /* greedy by raw size, then halved until each fits */
  const split = (list: readonly Record_[]) => {
    const z = pack(list);
    if (z.length <= CHUNK_MAX - 200 || list.length === 1) { if (z.length > CHUNK_MAX - 200) throw new Error(`a record (${list[0][0].slice(0, 2)}…) is too big for a chunk`); groups.push(z); return; }
    split(list.slice(0, list.length >> 1)); split(list.slice(list.length >> 1));
  };
  let at = 0;
  while (at < records.length) {
    let raw = 0, end = at;
    while (end < records.length && (raw < 90_000 || end === at)) raw += JSON.stringify(records[end++]).length + 1;
    split(records.slice(at, end));
    at = end;
  }
  const of = groups.length, out: Chunk[] = [];
  for (let n = 0; n < of; n++) { const c = { run, n, of, exp, z: groups[n] }; out.push({ ...c, mac: await macOf(secret, signed(c)) }); }
  return out;
}

/** A chunk checked against the key and the run the world expects: its records, or why not. */
export async function openChunk(secret: string, chunk: unknown, run: string | undefined, now = Date.now()): Promise<Record_[] | string> {
  const c = chunk as Chunk | null;
  if (!c || typeof c !== 'object' || typeof c.z !== 'string' || typeof c.mac !== 'string' || typeof c.run !== 'string' || !Number.isInteger(c.n) || !Number.isInteger(c.of) || typeof c.exp !== 'number') return 'not a chunk';
  if (!secret) return 'this world has no key';
  if (!run || c.run !== run) return 'not this import\'s chunk';
  if (c.exp < now) return 'this chunk has run out';
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await keyOf(secret), unb64url(c.mac), enc.encode(signed(c))); } catch { ok = false; }
  if (!ok) return 'this chunk is not signed with our key';
  try {
    const list = JSON.parse(strFromU8(inflateSync(unb64url(c.z)))) as Record_[];
    if (!Array.isArray(list) || list.some(r => !Array.isArray(r) || typeof r[0] !== 'string' || r[0].length > 512)) return 'this chunk does not read';
    return list;
  } catch { return 'this chunk does not read'; }
}

/** The world's digest of a slice: a prefix (its keys; the world's own, under ~, left out), or "=<key>", one key. The
 *  same as digestOf, with Web Crypto's SHA-256 (native: a slice of a few hundred accounts is a few hundred KB). */
export async function digestKV(kv: KV, slice: string, limit = 5000): Promise<{ count: number; hash: string }> {
  let records: Record_[];
  if (slice.startsWith('=')) { const key = slice.slice(1), v = kv.get(key); records = v === undefined ? [] : [[key, v]]; }
  else {
    const list = kv.keys(slice, limit + 1).filter(key => !key.startsWith('~'));
    if (list.length > limit) return { count: -1, hash: '' };
    records = list.map(key => [key, kv.get(key)] as Record_);
  }
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(textOf(records))));
  return { count: records.length, hash: [...bytes].map(b => b.toString(16).padStart(2, '0')).join('') };
}
const textOf = (records: readonly Record_[]) => [...records].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([k, v]) => `${k}\n${JSON.stringify(v)}\n`).join('');
/** The same digest of records in hand (sorted by key, as the store sorts them). */
export function digestOf(records: readonly Record_[]): { count: number; hash: string } {
  return { count: records.length, hash: sha256(textOf(records)) };
}
/** Slices that cover these keys, each at most `max` keys, none overlapping: prefixes (a trie cut where it is small
 *  enough), and "=<key>" for a key that is itself a prefix of others cut further. */
export function slicesOf(keys: readonly string[], max = 300): string[] {
  const out: string[] = [];
  const cut = (prefix: string, list: readonly string[]) => {
    if (list.length <= max) { if (list.length) out.push(prefix); return; }
    const by = new Map<string, string[]>();
    for (const key of list) {
      if (key.length === prefix.length) { out.push(`=${key}`); continue; }
      const next = key.slice(0, prefix.length + 1), part = by.get(next);
      if (part) part.push(key); else by.set(next, [key]);
    }
    for (const next of [...by.keys()].sort()) cut(next, by.get(next)!);
  };
  cut('', keys);
  return out;
}
/** The records of one slice. */
export function sliceOf(records: readonly Record_[], slice: string): Record_[] {
  return slice.startsWith('=') ? records.filter(([k]) => k === slice.slice(1)) : records.filter(([k]) => k.startsWith(slice));
}

export { sha256 };
