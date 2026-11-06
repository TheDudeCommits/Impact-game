import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { privateCodes } from '../src/server/privateCodes';
import { decode, SURVIVAL_PROTOCOL, DRAFT_SECONDS, TRAVEL_SECONDS, type CoopFrame } from '../src/survival/coopNet';
import { HordeFrame } from '../src/survival/horde/frame';

afterEach(() => vi.restoreAllMocks());
const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
type Mock = Client & { frames: CoopFrame[] };
const client = (sessionId: string) => {
  const frames: CoopFrame[] = [];
  return { sessionId, frames, send: vi.fn(), sendBytes: vi.fn((_type: string, bytes: Uint8Array) => frames.push(decode(bytes))) } as unknown as Mock;
};
async function fixture() {
  const room = new SurvivalRoom(); let tick!: FixedTimestepCallback, frame = 0;
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN });
  const code = room.roomId.replace('coop-', '');
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const join = (id: string, fighter = 'kenzo') => { const c = client(id); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, code, fighter: fighter as never, name: id }); return c; };
  const last = (c: Mock) => c.frames[c.frames.length - 1];
  return { room, code, advance, join, last };
}

describe('co-op survival room', () => {
  it('is a private room behind a six-digit code, waiting in a lobby for its host', async () => {
    const { room, code, join, advance, last } = await fixture();
    try {
      expect(code).toMatch(/^\d{6}$/);
      expect(() => room.onAuth(client('intruder'), {rosterProtocol:ROSTER_PROTOCOL, code: '000000' === code ? '111111' : '000000' })).toThrow('room code');
      const host = join('host'); join('guest', 'taisei');
      advance(2);
      const frame = last(host);
      expect(frame.survival.phase).toBe('lobby');
      // The waiting room reads as a private room still waiting, for the HUD's panel.
      expect(frame.status).toBe('waiting');
      expect(frame.lobby).toMatchObject({ visibility: 'private', code, hostId: 'host', canStart: true });
      expect(frame.survival.host).toBe(true);
      expect(last(room.clients[1] as Mock).survival.host).toBe(false);
      expect(frame.survival.party.map(member => member.id)).toEqual(['host', 'guest']);
      expect(room.setPrivate).toHaveBeenCalledWith(true);
    } finally { room.onDispose(); }
    expect(privateCodes.has(code)).toBe(false);
  });

  it('starts for the host only, holds four, and turns a fifth fighter away', async () => {
    const { room, join, advance, last } = await fixture();
    try {
      const host = join('host');
      for (const id of ['b', 'c', 'd']) join(id, 'taisei');
      expect(() => join('e')).toThrow('full');
      room.clients.pop();
      room.start(room.clients[1]);
      expect(room.game.phase).toBe('lobby');
      room.start(host);
      expect(room.game.phase).toBe('intro');
      // The room stays open (friends drop in between rounds) - but not past four.
      expect(room.lock).not.toHaveBeenCalled();
      expect(() => room.onAuth(client('late'), {rosterProtocol:ROSTER_PROTOCOL, code: room.roomId.replace('coop-', '') })).toThrow('full');
      advance(4 * 60);
      expect(last(host).survival.phase).toBe('fight');
      expect(last(host).status).toBe('active');
      // Every frame carries the horde, packed, with what it did since the last.
      advance(8 * 60);
      const packed = last(host).horde!;
      expect(packed).toBeInstanceOf(Uint8Array);
      const horde = new HordeFrame();
      horde.unpack(packed);
      expect(horde.n).toBeGreaterThan(10);
      expect(horde.n).toBe([...Array(room.game.horde.capacity).keys()].filter(slot => room.game.horde.state[slot] !== 0).length);
      // ...and the dungeon's horde and its bar, for everyone.
      expect(last(host).survival.roundState).toBe('horde');
      expect(last(host).survival.dungeon!.progress).toBeGreaterThanOrEqual(0);
      expect(last(host).survival.spots).toHaveLength(room.game.heroes.size);
    } finally { room.onDispose(); }
  });

  it('takes a friend with the code into a run under way: held in a rift until the round ends', async () => {
    const { room, code, join, advance, last } = await fixture();
    try {
      const host = join('host');
      room.start(host);
      advance(6 * 60);
      expect(room.game.phase).toBe('fight');
      expect(room.onAuth(client('late'), {rosterProtocol:ROSTER_PROTOCOL, code })).toBe(true);
      const late = join('late', 'taisei');
      advance(2);
      expect(room.game.heroes.get('late')!.joining).toBe(true);
      expect(last(late).survival.party[0]).toMatchObject({ id: 'late', joining: true });
      expect(last(host).survival.party.map(member => member.id)).toEqual(['host', 'late']);
      // A run that has just ended takes nobody.
      (room.game as unknown as { gameOver(): void }).gameOver();
      expect(() => room.onAuth(client('later'), {rosterProtocol:ROSTER_PROTOCOL, code })).toThrow('just ended');
    } finally { room.onDispose(); }
  });

  it('opens a quick room anyone is matched into, whose lobby starts on its own clock', async () => {
    const room = new SurvivalRoom(); let tick!: FixedTimestepCallback, frame = 0;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, quick: true });
    try {
      expect(room.setPrivate).not.toHaveBeenCalled();
      expect(room.roomId ?? '').not.toMatch(/^coop-/);
      expect(() => room.onAuth(client('stranger'), {rosterProtocol:ROSTER_PROTOCOL,})).not.toThrow();
      const a = client('a'); room.clients.push(a); room.onJoin(a, {rosterProtocol:ROSTER_PROTOCOL, quick: true, fighter: 'kenzo', name: 'A' });
      tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
      const lobby = a.frames[a.frames.length - 1].lobby!;
      expect(lobby).toMatchObject({ code: 'QUICK', startsAt: 20, expiresAt: null });
      for (let i = 0; i < 21 * 60 && room.game.phase === 'lobby'; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
      expect(room.game.phase).not.toBe('lobby');
    } finally { room.onDispose(); }
  });

  it('closes a draft on time, taking the rarest card for anyone still choosing', async () => {
    const { room, join, advance } = await fixture();
    try {
      const host = join('host'); const guest = join('guest', 'taisei');
      room.start(host);
      advance(5);
      for (const hero of room.game.heroes.values()) hero.pending = 1;
      const director = room.game as unknown as { openDrafts(): boolean; enterPhase(phase: string): void };
      director.openDrafts(); director.enterPhase('draft');
      expect(room.game.phase).toBe('draft');
      room.choose(host, room.game.heroes.get('host')!.draft!.cards[0]);
      advance(5);
      expect(room.game.phase).toBe('draft');
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + (DRAFT_SECONDS + 1) * 1000);
      advance(2);
      expect(room.game.phase).not.toBe('draft');
      expect(room.game.heroes.get('guest')!.picks).toHaveLength(1);
      void guest;
    } finally { room.onDispose(); }
  });

  it('moves the fight to the next act once every browser has it loaded, or after the wait', async () => {
    const { room, join, advance, last } = await fixture();
    try {
      const host = join('host'); const guest = join('guest', 'taisei');
      room.start(host); advance(2);
      const game = room.game as unknown as { travelTo?: string; phase: string };
      game.travelTo = 'cinder-flats'; game.phase = 'travel';
      advance(3);
      expect(room.game.phase).toBe('travel');
      expect(last(host).survival.loading).toBe(2);
      const run = last(host).survival.run;
      room.loadedBy(host, run); advance(2);
      expect(room.game.phase).toBe('travel');
      expect(last(guest).survival.loading).toBe(1);
      room.loadedBy(guest, run); advance(2);
      expect(room.game.phase).toBe('intro');
      expect(room.game.sim.stage).toBe('cinder-flats');
      // A browser that never says so is not waited on for ever.
      game.travelTo = 'harbor'; game.phase = 'travel'; advance(2);
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + (TRAVEL_SECONDS + 1) * 1000);
      advance(2);
      expect(room.game.sim.stage).toBe('harbor');
    } finally { room.onDispose(); }
  });

  it('takes the party back to the lobby after a run, and hands hosting on when the host leaves', async () => {
    const { room, join, advance, last } = await fixture();
    try {
      const host = join('host'); const guest = join('guest', 'taisei');
      room.start(host); advance(2);
      for (const hero of room.game.heroes.values()) room.game.sim.damage(hero.id, 1e6, 'e0', 'Test');
      advance(2);
      expect(room.game.phase).toBe('over');
      room.backToLobby(guest);
      expect(room.game.phase).toBe('over');
      const firstRun = last(host).survival.run;
      room.backToLobby(host);
      advance(2);
      expect(room.game.phase).toBe('lobby');
      expect(last(guest).survival.run).toBe(firstRun + 1);
      expect(room.game.heroes.size).toBe(2);
      expect(room.unlock).toHaveBeenCalled();
      room.clients.splice(0, 1); room.onLeave(host); advance(2);
      expect(last(guest).lobby?.hostId).toBe('guest');
      expect(room.game.heroes.has('host')).toBe(false);
    } finally { room.onDispose(); }
  });
});


it('rejects stale rendered Arcade clients and binds rank refunds to their own seat', async () => {
  const {room,code,join,advance}=await fixture();
  try {
    expect(()=>room.onAuth(client('old'),{rosterProtocol:ROSTER_PROTOCOL,code,assetGate:true})).toThrow('Refresh the page');
    expect(room.onAuth(client('new'),{rosterProtocol:ROSTER_PROTOCOL,code,assetGate:true,survivalProtocol:SURVIVAL_PROTOCOL})).toBe(true);
    const host=join('host'),guest=join('guest','taisei');room.start(host);advance(240);
    const a=room.game.heroes.get('host')!,b=room.game.heroes.get('guest')!;a.points=4;b.points=4;
    room.choose(host,'tree:open');room.choose(host,'tree:iron-fist');room.choose(guest,'tree:refund:iron-fist');
    expect(a.picks).toEqual(['iron-fist']);expect(a.points).toBe(3);expect(b.points).toBe(4);
    room.choose(host,'tree:refund:iron-fist');expect(a.points).toBe(4);expect(a.picks).toEqual([]);
    room.choose(host,'tree:close');room.choose(host,'tree:iron-fist');expect(a.picks).toEqual([]);
  } finally {room.onDispose();}
});
