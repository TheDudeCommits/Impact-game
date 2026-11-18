import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../src/originals/launch';
import { lockedOut } from '../src/game/economy/fighters';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { seal, unseal } from '../src/server/economy/p2roomSigned';
import { slimAccount } from '../src/server/economy/p2room';
import { ZReader } from '../src/p2room/zreader';
import type { Account } from '../src/game/economy/account';
import type { FighterId } from '../src/game/types';

/** The room bundle itself (src/p2room/build.mjs --node), seated as PlayerTwo's harness seats a room.js: a page's pass
 *  checked before a locked fighter is let in, a Duel played on 60 Hz ticks, its snapshots read back whole. */
const KEY = 'bundle-test-key';
let mod: Record<string, (...a: unknown[]) => unknown>;
beforeAll(async () => {
  const out = mkdtempSync(join(tmpdir(), 'p2room-test-'));
  execFileSync(process.execPath, ['src/p2room/build.mjs', out, '--node'], { env: { ...process.env, P2ROOM_KEY: KEY }, stdio: 'ignore' });
  mod = await import(join(out, 'room.node.mjs'));
}, 120_000);

function harness() {
  const heard = new Map<string, [string, unknown][]>();
  const room = {
    id: `r24/impact/t/m-${Math.random().toString(36).slice(2)}`, players: [] as { id: string; ping: number }[], kicked: [] as string[], closed: null as string | null, opened: [] as boolean[],
    player(id: string) { return this.players.find(p => p.id === id) ?? null; },
    send(type: string, data: unknown, o?: { to?: string | string[] }) { for (const id of o?.to === undefined ? this.players.map(p => p.id) : ([] as string[]).concat(o.to)) { const l = heard.get(id) ?? []; l.push([type, data]); heard.set(id, l); } },
    kick(id: string) { this.kicked.push(id); }, close(why: string) { this.closed = why; }, open(on: boolean) { this.opened.push(on); }, log() {},
  };
  const join = async (id: string, kind: string, options: Record<string, unknown>, pass?: string, code = '') => {
    const p = { id, ping: 60 }; room.players.push(p);
    await mod.onJoin(room, p);
    await mod.onMessage(room, p, '$join', { kind, options: { rosterProtocol: ROSTER_PROTOCOL, assetGate: false, readyGate: false, mode: 'match', name: id, ...options }, pass: pass ?? null, code });
    /* (the call that makes a room seats its maker on the room's next tick, room.ts make) */
    await mod.onTick(room, 1 / 60, {});
    return heard.get(id) ?? [];
  };
  return { room, heard, join };
}

const locked = RELEASED_FIGHTERS.find(f => lockedOut(f as FighterId, undefined)) as FighterId;
const free = RELEASED_FIGHTERS.find(f => !lockedOut(f as FighterId, undefined)) as FighterId;

describe('the room bundle', () => {
  it('takes a PlayerTwo party to its match: the leader opens it, its code goes back by the party, the others join by it', async () => {
    const party = harness(), wait = () => new Promise(r => setTimeout(r, 30));
    const said = (id: string, type: string) => (party.heard.get(id) ?? []).filter(([t]) => t === type).map(([, d]) => d as Record<string, any>);
    /* (each page in a PlayerTwo party sends a creation token: the first one's opens the room) */
    expect((await party.join('lead', 'party', { fighter: free, creationToken: crypto.randomUUID() })).map(([t]) => t)).toContain('$joined');
    expect((await party.join('mate', 'party', { fighter: free, creationToken: crypto.randomUUID() })).map(([t]) => t)).toContain('$joined');
    const mate = party.room.player('mate')!, lead = party.room.player('lead')!;
    await mod.onMessage(party.room, mate, 'party-ready', true);
    await mod.onMessage(party.room, lead, 'party-launch', null); await wait();
    const [ticket] = said('lead', 'party-travel');
    expect(ticket?.reservation?.p2).toMatchObject({ kind: 'private_arena', options: { access: 'host', party: 2 } });
    expect(ticket.reservation.p2.code).toBeUndefined();
    expect(said('mate', 'party-travel')).toEqual([]);
    await mod.onMessage(party.room, lead, 'party-p2-room', { id: ticket.id, code: 'K7Q2PX' });
    await mod.onMessage(party.room, lead, 'party-arrived', ticket.id); await wait();
    const [theirs] = said('mate', 'party-travel');
    expect(theirs?.reservation?.p2).toMatchObject({ kind: 'private_arena', code: 'K7Q2PX' });
    /* the match: the leader's page made it with its ticket, the other joined by the code */
    const match = harness();
    expect((await match.join('lead', 'private_arena', ticket.reservation.p2.options, undefined, 'K7Q2PX')).map(([t]) => t)).toContain('$joined');
    expect((await match.join('mate', 'private_arena', theirs.reservation.p2.options, undefined, 'K7Q2PX')).map(([t]) => t)).toContain('$joined');
  });
  it('seats a friend in a room its host made, by the code PlayerTwo joined them with', async () => {
    for (const [kind, options] of [['private_duel', {}], ['private_arena', { players: 4 }]] as const) {
      const h = harness(), code = 'K7Q2PX';
      expect((await h.join('host', kind, { fighter: free, creationToken: crypto.randomUUID(), ...options }, undefined, code)).map(([t]) => t)).toContain('$joined');
      expect((await h.join('friend', kind, { fighter: free }, undefined, code)).map(([t]) => t)).toContain('$joined');
    }
  });
  it('lets a locked fighter in only with a pass that owns them, signed with its key', async () => {
    expect(locked && free).toBeTruthy();
    const item = Object.keys(slimAccount({ pk: 'x', items: {}, worn: {}, xp: 0 } as unknown as Account).items);
    expect(item).toEqual([]);
    const owner = { pk: 'pk-own', xp: 0, items: {}, allAccess: true, worn: { outfits: {}, emotes: [] } } as unknown as Account;
    const pass = await seal(KEY, { k: 'pass', pk: owner.pk, account: slimAccount(owner), names: { 18: 'Owner', 20: 'Owner' }, exp: Date.now() + 60_000 });
    const forged = await seal('another-key', { k: 'pass', pk: owner.pk, account: slimAccount(owner), names: {}, exp: Date.now() + 60_000 });
    const a = harness();
    expect((await a.join('without', 'bot_arena', { fighter: locked, players: 4 })).map(([t]) => t)).toEqual(['$refused']);
    const b = harness();
    expect((await b.join('forged', 'bot_arena', { fighter: locked, players: 4 }, forged)).map(([t]) => t)).toEqual(['$refused']);
    const c = harness();
    const said = await c.join('owner', 'bot_arena', { fighter: locked, players: 4 }, pass);
    expect(said[0][0]).toBe('$joined');
    expect(said.some(([t]) => t === '$z')).toBe(true);
  });

  it('plays an online Duel on 60 Hz ticks: both pages read every snapshot, and the room closes to matching at the start', async () => {
    const h = harness();
    await h.join('one', 'duel_arena', { fighter: free });
    await h.join('two', 'duel_arena', { fighter: free });
    for (let t = 0; t < 60 * 6; t++) {
      for (const id of ['one', 'two']) await mod.onMessage(h.room, h.room.player(id), 'input', { seq: t + 1, moveX: 0.5, moveZ: 0, yaw: 0 });
      await mod.onTick(h.room, 1 / 60, {});
      await new Promise(r => setTimeout(r, 1000 / 60));
    }
    for (const id of ['one', 'two']) {
      const z = new ZReader(); let n = 0, last: { status?: string; players?: unknown[] } = {};
      for (const [type, data] of h.heard.get(id)!) if (type === '$z') { const r = z.read(data); expect(r).not.toBe('gap'); if (typeof r === 'object') { n++; last = r.message as typeof last; } }
      expect(n).toBeGreaterThan(120);
      expect(last.status).toBe('active');
      expect(last.players).toHaveLength(2);
    }
    expect(h.room.opened).toContain(false);
  }, 60_000);

  it('refuses a page of another kind in a matched room, and tells pages of a lost fight as a server update', async () => {
    const h = harness();
    await h.join('one', 'duel_arena', { fighter: free });
    expect((await h.join('two', 'arena', { fighter: free })).map(([t]) => t)).toEqual(['$refused']);
    const restarted = { ...h.room, id: `${h.room.id}-moved`, players: [{ id: 'one', ping: 50 }] };
    let closed: string | undefined; const told: unknown[] = [];
    await mod.onStart({ ...restarted, send: (_t: string, d: unknown) => told.push(d), close: (why: string) => { closed = why; } });
    expect(closed).toBe('4001');
    expect(told).toEqual([{ code: 4001 }]);
    expect(await unseal(KEY, 'nothing')).toBeUndefined();
  });
});
