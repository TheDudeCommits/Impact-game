import { describe, expect, it } from 'vitest';
import { deflateSync } from 'three/examples/jsm/libs/fflate.module.js';
import { pack } from 'msgpackr';
import { seal, unseal } from '../src/server/economy/p2roomSigned';
import { p2roomComplete, p2roomPass, P2RoomRefusal, slimAccount } from '../src/server/economy/p2room';
import { ZReader } from '../src/p2room/zreader';
import { p2Mode, P2_KINDS } from '../src/p2room/protocol';
import { isP2Code, P2ColyseusRoom, rateOf, type P2LiveRoom } from '../src/network/p2Room';
import { PassEconomy } from '../src/p2room/economy';
import type { Account } from '../src/game/economy/account';

/** Impact's rooms on PlayerTwo: the signed notes, the economy's routes, the page's reader. */
const KEY = 'test-key-0123456789';
const env = { P2ROOM_KEY: KEY };
const account = { pk: 'pk-1', name: 'Kenji', xp: 1200, items: { 'fighter-a': { at: 5, serial: 3 } }, worn: { outfits: {}, emotes: ['e1'] }, balance: 999, earned: 1, spent: 0, bought: 0, created: 1, feats: [], stats: {} } as unknown as Account;

describe('PlayerTwo rooms: signed notes', () => {
  it('opens what it sealed, and nothing tampered with, signed with another key, or expired', async () => {
    const token = await seal(KEY, { k: 'pass', pk: 'a', exp: Date.now() + 1000 });
    expect(await unseal(KEY, token)).toMatchObject({ k: 'pass', pk: 'a' });
    expect(await unseal('other', token)).toBeUndefined();
    const [body, mac] = token.split('.');
    expect(await unseal(KEY, `${body}x.${mac}`)).toBeUndefined();
    expect(await unseal(KEY, token, Date.now() + 5000)).toBeUndefined();
    expect(await unseal(KEY, 42)).toBeUndefined();
  });
});

describe('PlayerTwo rooms: the economy routes', () => {
  const economy = { book: { find: (t: unknown) => t === 'secret' ? account : undefined }, completed: [] as unknown[], complete(pk: string, report: unknown) { this.completed.push([pk, report]); return { matchId: 'm', pk }; } };
  const roomName = (_t: unknown, typed: unknown, max: number) => `${String(typed)}:${max}`;
  it('signs a pass with only what rooms read of the account, and says whether rooms are on', async () => {
    const a = await p2roomPass(economy, 'secret', 'Typed', roomName, env) as { rooms: boolean; pass: string };
    expect(a.rooms).toBe(true);
    const pass = await unseal<{ account: Record<string, unknown>; names: Record<number, string>; pk: string; exp?: number }>(KEY, a.pass);
    expect(pass?.pk).toBe('pk-1');
    expect(pass?.names).toEqual({ 18: 'Typed:18', 20: 'Typed:20' });
    expect(pass?.account).toEqual({ pk: 'pk-1', name: 'Kenji', xp: 1200, items: { 'fighter-a': { at: 0 } }, worn: { outfits: {}, emotes: ['e1'] } });
    expect(JSON.stringify(slimAccount(account))).not.toContain('999');
    expect(await p2roomPass(economy, 'unknown', 'x', roomName, env)).toEqual({ rooms: true, pass: null });
    expect(await p2roomPass(economy, 'secret', 'x', roomName, { ...env, P2ROOMS: '0' })).toEqual({ rooms: false });
    expect(await p2roomPass(economy, 'secret', 'x', roomName, {})).toEqual({ rooms: false });
  });
  it('settles a result a room signed, and refuses one it did not', async () => {
    const done = await seal(KEY, { k: 'done', pk: 'pk-1', report: { id: 'm1', mode: 'duel' }, exp: Date.now() + 60_000 });
    expect(await p2roomComplete(economy, done, env)).toEqual({ completion: { matchId: 'm', pk: 'pk-1' } });
    expect(economy.completed).toEqual([['pk-1', { id: 'm1', mode: 'duel' }]]);
    await expect(p2roomComplete(economy, await seal('forged', { k: 'done', pk: 'pk-1', report: {}, exp: Date.now() + 1000 }), env)).rejects.toBeInstanceOf(P2RoomRefusal);
    await expect(p2roomComplete(economy, await seal(KEY, { k: 'pass', pk: 'pk-1', exp: Date.now() + 1000 }), env)).rejects.toBeInstanceOf(P2RoomRefusal);
  });
});

describe('PlayerTwo rooms: the room-side economy', () => {
  it('finds an account by its pass, names it, and sends a completion to its page signed, once every 5 s at most', async () => {
    const economy = new PassEconomy(); economy.secret = KEY;
    const sent: { pk: string; key: string; done: string }[] = [];
    economy.route = (pk, note) => { sent.push({ pk, ...note }); return true; };
    const token = economy.keep({ k: 'pass', pk: 'pk-1', account: slimAccount(account), names: { 18: 'A', 20: 'B' }, exp: Date.now() + 1000 });
    expect(token).toBe('pass:pk-1');
    expect(economy.book.find(token)?.pk).toBe('pk-1');
    expect(economy.book.find('secret')).toBeUndefined();
    expect(economy.name(token, 20)).toBe('Kenji');
    expect(economy.complete('pk-1', { id: 'm2' } as never)).toBeUndefined();
    expect(economy.complete('pk-1', { id: 'm2' } as never)).toBeUndefined();
    await new Promise(r => setTimeout(r, 20));
    expect(sent.length).toBe(1);
    expect(await unseal(KEY, sent[0].done)).toMatchObject({ k: 'done', pk: 'pk-1', report: { id: 'm2' } });
    economy.settle(sent[0].key, { matchId: 'm2', pk: 'pk-1' });
    expect(economy.book.completions.get('m2:pk-1')).toEqual({ matchId: 'm2', pk: 'pk-1' });
    expect(economy.complete('pk-1', { id: 'm2' } as never)).toEqual({ matchId: 'm2', pk: 'pk-1' });
  });
});

describe('PlayerTwo rooms: the page reads its packed messages', () => {
  const frame = (kind: number, stream: number, n: number, z: Uint8Array) => { const out = new Uint8Array(9 + z.length), v = new DataView(out.buffer); out[0] = kind; v.setUint32(1, stream); v.setUint32(5, n); out.set(z, 9); return out; };
  it('inflates each with the one before as its dictionary, and asks for a new stream after a gap', () => {
    const r = new ZReader(), a = pack({ status: 'active', players: [1, 2] }), b = pack({ status: 'active', players: [1, 2, 3] });
    expect(r.read(frame(0, 7, 0, deflateSync(a)))).toEqual({ type: 'snapshot', message: { status: 'active', players: [1, 2] } });
    expect(r.read(frame(1, 7, 1, deflateSync(b, { dictionary: a })))).toEqual({ type: 'input-resync', message: { status: 'active', players: [1, 2, 3] } });
    expect(r.read(frame(0, 7, 3, deflateSync(b)))).toBe('gap');
    expect(r.read(frame(0, 7, 4, deflateSync(b)))).toBe('skip');
    expect(r.read(frame(0, 9, 0, deflateSync(b)))).toEqual({ type: 'snapshot', message: { status: 'active', players: [1, 2, 3] } });
  });
});

describe('PlayerTwo rooms: names and codes', () => {
  it('names every kind as PlayerTwo takes a mode, and tells its codes from the match server\'s', () => {
    for (const kind of P2_KINDS) expect(p2Mode(kind, ['goal-rush', 'playlist', 'Big Heads!'])).toMatch(/^[a-z0-9][a-z0-9_-]{0,31}$/i);
    expect(p2Mode('duel_arena')).toBe('i1-duel');
    expect(isP2Code('K7Q2PX')).toBe(true);
    expect(isP2Code('123456')).toBe(false);
    expect(isP2Code('K7Q2P1')).toBe(false);
  });
});

describe('PlayerTwo rooms: the page keeps to its room\'s allowance', () => {
  const room = (rate?: number) => {
    const sent: string[] = [];
    const live = { id: 'r', code: null, me: 'p', scripted: true, rate, send: (type: string) => { sent.push(type); }, on: () => undefined, leave: () => {} } as unknown as P2LiveRoom;
    const r = new P2ColyseusRoom(live); r.connection.isOpen = true;
    return { r, sent };
  };
  it('reads the rate the studio set, within PlayerTwo\'s 10 to 240, else 240', () => {
    expect(rateOf({ rate: 240 })).toBe(240);
    expect(rateOf({ rate: 999 })).toBe(240);
    expect(rateOf({ rate: 3 })).toBe(10);
    expect(rateOf({})).toBe(240);
    expect(rateOf({ rate: Number.NaN })).toBe(240);
  });
  it('at 240 a burst of 300 inputs goes one by one; at 60 it pairs them once low', () => {
    const fast = room(240), slow = room(60);
    for (let i = 0; i < 300; i++) { fast.r.send('input', { i }); slow.r.send('input', { i }); }
    expect(fast.sent.filter(t => t === 'input').length).toBe(300);
    expect(fast.sent).not.toContain('inputs');
    { const singles = slow.sent.filter(t => t === 'input').length; expect(singles).toBeGreaterThanOrEqual(96); expect(singles).toBeLessThan(110); }
    expect(slow.sent).toContain('inputs');
    expect(slow.sent.length).toBeLessThan(210);
  });
});

describe('PlayerTwo rooms: codes as players type them', () => {
  it('keeps letters and digits in capitals, and takes six digits or a PlayerTwo code', async () => {
    const { cleanCode, isRoomCode } = await import('../src/ui/roomCode');
    expect(cleanCode(' yqt-vqr7 ')).toBe('YQTVQR');
    expect(isRoomCode('123456')).toBe(true);
    expect(isRoomCode('YQTVQR')).toBe(true);
    expect(isRoomCode('yqtvqr')).toBe(false);
    expect(isRoomCode('YQTVQ')).toBe(false);
    expect(isRoomCode('YQTVQI')).toBe(false);
    expect(isRoomCode(null)).toBe(false);
  });
});

describe('PlayerTwo rooms: RANKED and rivalries from the pass, results to the world', () => {
  it('reads a standing and a record from a pass, and sends a ranked change and a rivalry signed to the page', async () => {
    const { passEconomy } = await import('../src/p2room/economy');
    const { ranked } = await import('../src/p2room/stubs/ranked');
    const { rivalries } = await import('../src/p2room/stubs/rivalries');
    const sent: { pk: string; key: string; done: string }[] = [];
    passEconomy.secret = KEY; passEconomy.route = (pk, note) => { sent.push({ pk, ...note }); return true; };
    passEconomy.keep({ k: 'pass', pk: 'pk-a', account: slimAccount(account), names: {}, ranked: { 'goal-rush': { rating: 1234, games: 9 } }, rivals: { 'pk-b': [3, 1] }, exp: Date.now() + 60_000 });
    expect((await ranked()!.rating('pk-a', 'goal-rush')).rating).toBe(1234);
    expect((await ranked()!.rating('pk-z', 'goal-rush')).games).toBe(0);
    expect(await rivalries()!.between('pk-a', 'pk-b')).toEqual([3, 1]);
    expect(await rivalries()!.between('pk-b', 'pk-a')).toEqual([1, 3]);
    await ranked()!.apply('pk-a', 'goal-rush', -12, false, 'room:9');
    rivalries()!.record('pk-a', 'pk-b', 'duel');
    await new Promise(r => setTimeout(r, 20));
    expect(sent.map(s => s.pk)).toEqual(['pk-a', 'pk-a']);
    expect(await unseal(KEY, sent[0].done)).toMatchObject({ k: 'rank', pk: 'pk-a', mode: 'goal-rush', delta: -12, won: false, id: 'room:9' });
    expect(await unseal(KEY, sent[1].done)).toMatchObject({ k: 'rival', winner: 'pk-a', loser: 'pk-b' });
  });
});
