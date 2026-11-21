import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../src/originals/launch';
import { lockedOut } from '../src/game/economy/fighters';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { RANKED } from '../src/game/ball/ranked';
import { RANKED_DUEL, RANKED_SIGN_IN } from '../src/game/duel/ranked';
import { unseal, type RankNote } from '../src/server/economy/p2roomSigned';
import { WorldEconomy, CFG, type Seat } from '../src/p2world/economy';
import { MemoryKV } from '../src/p2world/kv';
import { ZReader } from '../src/p2room/zreader';
import type { FighterId, GameSnapshot } from '../src/game/types';

/** The ranked Duel end to end on one machine, with no PlayerTwo: the economy world (WorldEconomy over a memory store) signs
 *  each page's pass, the room bundle itself (build.mjs --node) seats the pages as PlayerTwo's harness seats a room.js,
 *  plays the set on 60 Hz ticks, and its signed notes go back to the world the way a page posts them. */
const KEY = 'ranked-bundle-key';
let mod: Record<string, (...a: unknown[]) => unknown>;
beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), 'p2room-ranked-'));
  execFileSync(process.execPath, ['src/p2room/build.mjs', out, '--node'], { env: { ...process.env, P2ROOM_KEY: KEY }, stdio: 'ignore' });
  mod = await import(join(out, 'room.node.mjs'));
}, 120_000);

const free = RELEASED_FIGHTERS.find(f => !lockedOut(f as FighterId, undefined)) as FighterId;
const p2id = () => crypto.randomBytes(16).toString('base64url').slice(0, 22);

describe('a ranked Duel on a local room', () => {
  it('seats two signed-in pages, refuses a guest, rates the set as the rival walks out, and the world takes each note once', async () => {
    // The world, and three players: two signed in with PlayerTwo, one PlayerTwo guest.
    const kv = new MemoryKV(), world = new WorldEconomy(kv, { key: KEY });
    kv.set(CFG, { open: true });
    const call = async (seat: Seat | undefined, path: string, body: Record<string, unknown> = {}) => (await world.route(seat, path, body)).body as Record<string, any>;
    const player = async (kind: string, name: string) => {
      const seat = { id: p2id(), kind }, hello = await call(seat, 'hello');
      if (kind !== 'guest') await call(seat, 'p2-signin', { token: hello.token });
      const pass = (await call(seat, 'p2room-pass', { token: hello.token, name })).pass as string;
      return { seat, pk: hello.account.pk as string, pass };
    };
    const one = await player('full', 'Kite'), two = await player('full', 'Rowan'), visitor = await player('guest', 'Guest');

    // The room, as PlayerTwo seats it: a match's room (its name .../m-<id>), each page's $join with the ranked queue.
    const heard = new Map<string, [string, unknown][]>(), results: unknown[] = [];
    const room = {
      id: `r24/impact/t/m-${Math.random().toString(36).slice(2)}`, players: [] as { id: string; ping: number }[],
      player(id: string) { return this.players.find(p => p.id === id) ?? null; },
      send(type: string, data: unknown, o?: { to?: string | string[] }) { for (const id of o?.to === undefined ? this.players.map(p => p.id) : ([] as string[]).concat(o.to)) { const l = heard.get(id) ?? []; l.push([type, data]); heard.set(id, l); } },
      kick(id: string) { this.players = this.players.filter(p => p.id !== id); }, close() {}, open() {}, log() {},
      result(places: unknown) { results.push(places); },
    };
    const join = async (id: string, pass: string) => {
      const p = { id, ping: 60 }; room.players.push(p);
      await mod.onJoin(room, p);
      await mod.onMessage(room, p, '$join', { kind: 'duel_arena', options: { rosterProtocol: ROSTER_PROTOCOL, assetGate: false, readyGate: false, mode: 'match', name: id, fighter: free, queue: RANKED_DUEL.queue }, pass, code: '' });
      await mod.onTick(room, 1 / 60, {});
      return (heard.get(id) ?? []).map(([t, d]) => [t, (d as { message?: string })?.message]);
    };
    expect((await join('one', one.pass))[0][0]).toBe('$joined');
    expect(await join('visitor', visitor.pass)).toEqual([['$refused', RANKED_SIGN_IN]]);
    expect((await join('two', two.pass))[0][0]).toBe('$joined');

    // The set begins: every page told both standings.
    const snapshots = (id: string) => { const z = new ZReader(), out: GameSnapshot[] = []; for (const [type, data] of heard.get(id) ?? []) if (type === '$z') { const r = z.read(data); if (typeof r === 'object' && r.type === 'snapshot') out.push(r.message as GameSnapshot); } return out; };
    for (let t = 0; t < 60 * 8 && snapshots('one').at(-1)?.status !== 'active'; t++) { await mod.onTick(room, 1 / 60, {}); await new Promise(r => setTimeout(r, 1000 / 60)); }
    /* (the room sees the start in the snapshot it sends: the next one says the set is rated) */
    for (let t = 0; t < 10; t++) { await mod.onTick(room, 1 / 60, {}); await new Promise(r => setTimeout(r, 1000 / 60)); }
    const live = snapshots('one').at(-1)!;
    expect(live.status).toBe('active');
    expect(live.ranked).toMatchObject({ queue: 'ranked', rated: true, seats: { one: { rating: RANKED.start, games: 0 }, two: { rating: RANKED.start, games: 0 } } });

    // The rival walks out (PlayerTwo lets the seat go): rated as beaten, the set forfeited to the one who stayed.
    room.players = room.players.filter(p => p.id !== 'two');
    await mod.onLeave(room, { id: 'two', ping: 60 }, 'left');
    for (let t = 0; t < 30; t++) { await mod.onTick(room, 1 / 60, {}); await new Promise(r => setTimeout(r, 1000 / 60)); }
    const over = snapshots('one').at(-1)!;
    expect(over.duel?.phase).toBe('complete');
    expect(over.ranked?.seats.one).toEqual({ rating: RANKED.start + RANKED.placementK / 2, games: 1, delta: RANKED.placementK / 2 });
    expect(results).toEqual([['one', 'two']]);

    // Both notes came to the page that stayed (the leaver's page is gone), signed; the world takes each once.
    const notes = (heard.get('one') ?? []).filter(([t]) => t === '$settle').map(([, d]) => (d as { done: string }).done);
    const opened = await Promise.all(notes.map(done => unseal<RankNote>(KEY, done)));
    expect(opened.filter(n => n?.k === 'rank').map(n => [n!.pk, n!.mode, n!.won, n!.delta, n!.name]).sort()).toEqual([
      [one.pk, 'duel', true, RANKED.placementK / 2, 'Kite'], [two.pk, 'duel', false, -RANKED.placementK / 2, 'Rowan']].sort());
    for (const done of [...notes, ...notes]) await call(undefined, 'p2room-complete', { done });
    expect(world.rating(one.pk, 'duel')).toMatchObject({ rating: RANKED.start + 24, games: 1, wins: 1 });
    expect(world.rating(two.pk, 'duel')).toMatchObject({ rating: RANKED.start - 24, games: 1, wins: 0 });
  }, 90_000);
});
