import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE } from '../src/game/rosterProtocol';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalDriver, LocalPresence, Room, matchMaker, type Client, type FixedTimestepCallback } from 'colyseus';
import { PartyRoom } from '../src/server/social/PartyRoom';
import { DuelRoom, PrivateDuelRoom } from '../src/server/ArenaRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { FIGHTERS } from '../src/config';
import { ARENAS, DUEL_ARENAS } from '../src/game/social/custom';
import { ONLINE_DUEL_STAGES } from '../src/game/stages';
import { PARTY_ARENAS, PARTY_MAX, PARTY_MODES, PARTY_ORDER, modeBlocked, partyRules, startCheck, defaultPartyRules } from '../src/game/social/party';
import { PartyStart } from '../src/server/social/PartyStart';
import { loneQueue } from '../src/ui/modes/loneQueue';
import { OBJECTIVE_PROTOCOL } from '../src/game/objectives/model';
import { SURVIVAL_PROTOCOL } from '../src/survival/coopNet';
import { RIFT_PROTOCOL } from '../src/game/moba/model';
import { modeOpen } from '../src/originals/launch';

/** The party room (8 October 2026, before the public launch): one malformed message used to break the party screen for
 *  everyone in it - `fighter: ''` slipped past a truthy check, and every member's PartyUI threw on FIGHTERS['']. A
 *  fighter is a string that names one, or the message is refused; names are the server's display names. */
const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const room = new PartyRoom(), handlers = new Map<string, (c: Client, p?: unknown) => void>();
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
  room.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: TOKEN });
  const join = (id: string, options: Record<string, unknown> = {}) => { const c = { sessionId: id, send: vi.fn(), leave: vi.fn() } as unknown as Client; room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, code: room.view.code, fighter: 'taisei', name: id, ...options } as never); return c; };
  return { room, join, send: (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p) };
}
/** The match server, faked: the room the party opens and the seats it reserves, recorded. */
const mm = vi.hoisted(() => ({ createRoom: vi.fn(), remoteRoomCall: vi.fn(), reserveSeatFor: vi.fn() }));
vi.mock('colyseus', async importOriginal => { const real = await importOriginal<typeof import('colyseus')>(); return { ...real, matchMaker: { ...real.matchMaker, ...mm } }; });
function matchServer() {
  const created: { name: string; options: Record<string, unknown> }[] = [], seats: Record<string, unknown>[] = [];
  mm.createRoom.mockReset().mockImplementation(async (name: string, options: Record<string, unknown>) => { created.push({ name, options }); return { roomId: `${name}-1` }; });
  // A seat is the room's own `_reserveSeat`, asked by the party with the time it is held (PartyRoom's partySeat).
  mm.remoteRoomCall.mockReset().mockImplementation(async (_roomId: string, method: string, args?: unknown[]) => { if (method !== '_reserveSeat') return undefined; seats.push(args![1] as Record<string, unknown>); return true; });
  mm.reserveSeatFor.mockReset().mockImplementation(async (_room: unknown, options: Record<string, unknown>) => { seats.push(options); return { sessionId: String(options.name), room: {} }; });
  return { created, seats };
}
const notices = (c: Client) => vi.mocked(c.send).mock.calls.filter(call => call[0] === 'notice').map(call => (call[1] as { message: string }).message);
const readyOf = (room: PartyRoom) => Object.fromEntries(room.view.members.map(m => [m.id, m.ready]));
/** A party of `ids` (the first leads) with everyone but the leader ready. */
function party(ids: string[], fighters: Record<string, string> = {}) {
  const f = fixture(), clients = ids.map(id => f.join(id, { objectiveProtocol: OBJECTIVE_PROTOCOL, survivalProtocol: SURVIVAL_PROTOCOL, ...(fighters[id] ? { fighter: fighters[id] } : {}) }));
  return { ...f, clients, readyAll: () => { for (const c of clients.slice(1)) f.send(c, 'party-ready', true); } };
}
const drawable = (room: PartyRoom) => room.view.members.every(m => typeof m.fighter === 'string' && Object.hasOwn(FIGHTERS, m.fighter));

describe('party roster compatibility', () => {
  it('refuses a stale profile without changing the member or credentials', () => {
    const f = fixture(), leader = f.join('leader');
    try {
      f.send(leader, 'party-profile', { fighter: 'sorayomi', rosterProtocol: 'old-roster' });
      expect(f.room.view.members[0].fighter).toBe('taisei');
      expect(notices(leader).at(-1)).toBe(ROSTER_REFRESH_MESSAGE);
      f.send(leader, 'party-profile', { fighter: 'sorayomi', rosterProtocol: ROSTER_PROTOCOL });
      expect(f.room.view.members[0].fighter).toBe('sorayomi');
    } finally { f.room.onDispose(); }
  });
  it.each(['duel', 'royale', 'survival', 'last-stand', 'bad-blood', 'rift-war'] as const)('passes the version into %s creation and every private reservation', async mode => {
    const f = party(['leader', 'guest']), server = matchServer(), [leader] = f.clients;
    try {
      for (const c of f.clients) f.send(c, 'party-profile', { rosterProtocol: ROSTER_PROTOCOL, riftProtocol: RIFT_PROTOCOL });
      f.send(leader, 'party-mode', mode); f.readyAll(); await f.room.launch(leader);
      expect(server.created).toHaveLength(1);
      expect(server.created[0].options.rosterProtocol).toBe(ROSTER_PROTOCOL);
      expect(server.seats).toHaveLength(2);
      for (const seat of server.seats) expect(seat.rosterProtocol).toBe(ROSTER_PROTOCOL);
    } finally { f.room.onDispose(); }
  });
  it('rejects stale retained credentials before creating a match', async () => {
    const f = party(['leader', 'guest']), server = matchServer(), [leader, guest] = f.clients;
    try {
      f.readyAll();
      const credentials = (f.room as unknown as { credentials: Map<string, { rosterProtocol?: unknown }> }).credentials;
      credentials.get(guest.sessionId)!.rosterProtocol = undefined;
      await f.room.launch(leader);
      expect(server.created).toHaveLength(0); expect(server.seats).toHaveLength(0);
      expect(f.room.view.launching).toBe(false); expect(notices(leader).at(-1)).toBe(ROSTER_REFRESH_MESSAGE);
    } finally { f.room.onDispose(); }
  });
});

describe('party room', () => {
  it('turns away a join whose fighter is not a fighter id', () => {
    const { room, join } = fixture();
    try {
      for (const fighter of ['', 'not-a-fighter', '__proto__', 42, ['taisei'], null]) {
        const c = { sessionId: 'x', send: vi.fn() } as unknown as Client;
        expect(() => room.onAuth(c, {rosterProtocol:ROSTER_PROTOCOL, code: room.view.code, fighter } as never), JSON.stringify(fighter)).toThrow('Choose a fighter.');
      }
      join('leader'); join('guest', { fighter: undefined });
      expect(room.view.members.map(m => m.fighter)).toEqual(['taisei', 'konta']);
    } finally { room.onDispose(); }
  });

  it('ignores a profile whose fighter is not a fighter id, so every member can still draw the party', () => {
    const { room, join, send } = fixture();
    try {
      const leader = join('leader'), guest = join('guest', { fighter: 'gummy' });
      for (const fighter of ['', 'not-a-fighter', 'constructor', 0, false, ['kenzo'], { id: 'kenzo' }, null]) {
        send(guest, 'party-profile', {rosterProtocol:ROSTER_PROTOCOL, fighter, name: 'Changed' });
        expect(drawable(room), JSON.stringify(fighter)).toBe(true);
      }
      expect(room.view.members.find(m => m.id === 'guest')).toMatchObject({ fighter: 'gummy', name: 'guest' });
      send(guest, 'party-profile', {rosterProtocol:ROSTER_PROTOCOL, fighter: 'kenzo' });
      expect(room.view.members.find(m => m.id === 'guest')!.fighter).toBe('kenzo');
      send(leader, 'party-profile', {rosterProtocol:ROSTER_PROTOCOL, name: 'Thunder Hawk' });
      expect(room.view.members.find(m => m.id === 'leader')).toMatchObject({ fighter: 'taisei', name: 'Thunder Hawk' });
    } finally { room.onDispose(); }
  });



  it('launches a DUEL for exactly two, into the private Duel room on the chosen place', async () => {
    const { room, clients: [leader, guest], send, readyAll } = party(['leader', 'guest']);
    try {
      const server = matchServer();
      send(leader, 'party-mode', 'duel');
      expect(room.view.mode).toBe('duel');
      expect(room.view.rules.arena).toBe('sunfall-arena');
      send(leader, 'party-rules', { arena: 'ashfall-weir' });
      readyAll();
      expect(startCheck(room.view).reason).toBeUndefined();
      await room.launch(leader);
      expect(server.created).toHaveLength(1);
      expect(server.created[0].name).toBe('private_duel');
      // `party`: the members sent, so the duel starts by itself once both are in and loaded (PartyStart).
      expect(server.created[0].options).toMatchObject({ stage: 'ashfall-weir', assetGate: true, readyGate: true, mode: 'match', party: 2 });
      expect(server.seats.map(o => o.name)).toEqual(['leader', 'guest']);
      expect(room.view.members.every(m => m.status === 'travelling')).toBe(true);
      expect(vi.mocked(guest.send).mock.calls.some(c => c[0] === 'party-travel')).toBe(false);
      expect(vi.mocked(leader.send).mock.calls.find(c => c[0] === 'party-travel')?.[1]).toMatchObject({ mode: 'duel' });
      // A Duel's RANDOM is dealt by the party, from the Duel's own places.
      send(leader, 'party-return'); await Promise.resolve();
      send(leader, 'party-rules', { arena: 'random' }); readyAll(); await room.launch(leader);
      expect(DUEL_ARENAS).toContain(server.created[1].options.stage);
    } finally { room.onDispose(); }
  });

  it('refuses a DUEL for one or three, and START says why', async () => {
    const { room, clients: [leader, b, c], send, readyAll, join } = party(['leader', 'b', 'c']);
    try {
      const server = matchServer();
      send(leader, 'party-mode', 'duel');
      expect(room.view.mode).toBe('royale');
      expect(notices(leader).at(-1)).toMatch(/exactly two/);
      // A Duel chosen for two, and a third friend joins: the party stays together, and START waits for a mode that fits.
      room.onLeave(c); room.clients.splice(room.clients.indexOf(c), 1);
      send(leader, 'party-mode', 'duel');
      expect(room.view.mode).toBe('duel');
      const d = join('d'); send(b, 'party-ready', true); send(d, 'party-ready', true);
      expect(room.view.members).toHaveLength(3);
      expect(startCheck(room.view).reason).toMatch(/1 v 1/);
      await room.launch(leader);
      expect(server.created).toHaveLength(0);
      expect(notices(leader).at(-1)).toMatch(/1 v 1/i);
      void readyAll;
    } finally { room.onDispose(); }
  });



  it('honours the place the party chose in every mode that has one, and fixes the others', async () => {
    const { room, clients: [leader], send, readyAll } = party(['leader', 'guest']);
    try {
      const server = matchServer(), go = async () => { readyAll(); await room.launch(leader); const made = server.created.at(-1)!; send(leader, 'party-return'); await Promise.resolve(); return made; };
      send(leader, 'party-rules', { arena: 'sunward-summit', players: 12, difficulty: 'hard', seconds: 300 });
      let made = await go();
      expect(made.name).toBe('private_arena');
      expect(made.options).toMatchObject({ players: 12, party: 2, rules: { arena: 'sunward-summit', difficulty: 'hard', seconds: 300, players: 12 } });
      send(leader, 'party-rules', { arena: 'random' });
      expect((await go()).options).toMatchObject({ rules: { arena: 'auto' } });
      send(leader, 'party-mode', 'bad-blood'); send(leader, 'party-rules', { arena: 'warlords-roof', difficulty: 'easy' });
      made = await go();
      expect(made.name).toBe('objective_arena');
      expect(made.options).toMatchObject({ objective: 'bad-blood', access: 'host', rules: { arena: 'warlords-roof', difficulty: 'easy' } });
      send(leader, 'party-rules', { arena: 'random' });
      expect(ARENAS['bad-blood']).toContain(((await go()).options.rules as { arena: string }).arena);
      // A vote: one per member, the most votes wins.
      send(leader, 'party-rules', { arena: 'vote' });
      send(room.clients[0], 'party-vote', 'drifting-isle'); send(room.clients[1], 'party-vote', 'drifting-isle');
      expect((await go()).options).toMatchObject({ rules: { arena: 'drifting-isle' } });
      // Last Stand's village and the co-op run's worlds are not the party's to choose.
      send(leader, 'party-mode', 'last-stand'); send(leader, 'party-rules', { arena: 'warlords-roof' });
      expect(room.view.rules.arena).toBe('random');
      made = await go();
      expect(made.options).toMatchObject({ objective: 'last-stand', party: 2, fill: false, rules: { arena: 'auto' } });
      // Last Stand's bot allies: chosen in the party now that its room deploys by itself.
      send(leader, 'party-rules', { fill: true, difficulty: 'hard' });
      expect((await go()).options).toMatchObject({ fill: true, rules: { difficulty: 'hard' } });
      send(leader, 'party-rules', { fill: 'yes' }); send(leader, 'party-rules', { fill: 1 });
      expect(room.view.rules.fill).toBe(true);
      send(leader, 'party-mode', 'survival');
      expect(room.view.rules.fill).toBe(false);
      made = await go();
      expect(made.name).toBe('survival_arena');
      expect(made.options).toMatchObject({ party: 2 });
      expect(made.options).not.toHaveProperty('fill');
    } finally { room.onDispose(); }
  });

  it('turns away every value that is not on the list', () => {
    const { room, clients: [leader, guest], send } = party(['leader', 'guest']);
    try {
      const before = structuredClone(room.view);
      for (const mode of ['boss-hunt', 'DUEL', '', 42, null, ['duel'], { mode: 'duel' }, '__proto__']) send(leader, 'party-mode', mode);
      for (const rules of [{ arena: 'harbor' }, { arena: 'hidden-ash' }, { arena: 'rift-village' }, { arena: '__proto__' }, { players: 2 }, { players: 6 }, { players: '8' }, { players: 1e9 }, { seconds: 999 }, { seconds: -180 }, { seconds: '300' }, { difficulty: 'god' }, { difficulty: ['hard'] }, ['arena', 'sunward-summit'], null, 'sunward-summit', 7])
        send(leader, 'party-rules', rules);
      expect(room.view.mode).toBe(before.mode);
      expect(room.view.rules).toEqual(before.rules);
      // Only the leader chooses; a vote only in a vote, and only for one of the mode's places.
      send(guest, 'party-mode', 'duel'); send(guest, 'party-rules', { arena: 'sunward-summit' });
      send(guest, 'party-vote', 'sunward-summit');
      expect(room.view.mode).toBe('royale'); expect(room.view.rules.arena).toBe('random'); expect(room.view.votes).toEqual({});
      send(leader, 'party-rules', { arena: 'vote' });
      for (const vote of ['harbor', 'hidden-ash', 7, null, { stage: 'sunward-summit' }]) send(guest, 'party-vote', vote);
      expect(room.view.votes).toEqual({});
      send(leader, 'party-leader', 'leader'); send(leader, 'party-leader', 'nobody'); send(leader, 'party-leader', 7);
      expect(room.view.leader).toBe('leader');
      // The table itself: each mode's own places, no fixed mode's.
      expect(partyRules('duel', { arena: 'sunward-summit' }).arena).toBe('sunward-summit');
      expect(partyRules('duel', { arena: 'blood-citadel' }).arena).toBe('sunfall-arena');
      expect(partyRules('last-stand', { arena: 'vote' }).arena).toBe('random');
      expect(partyRules('survival', { arena: 'sunward-summit', difficulty: 'hard' })).toEqual(defaultPartyRules('survival'));
      expect(PARTY_ARENAS['last-stand']).toEqual([]);
    } finally { room.onDispose(); }
  });

  it('takes READY back only when the change reaches the players: the mode, the seats, their own fighter', () => {
    const { room, clients: [leader, a, b], send, readyAll, join } = party(['leader', 'a', 'b']);
    try {
      readyAll();
      const ready = { leader: false, a: true, b: true };
      // The place, the bots and the clock: everyone stays ready.
      send(leader, 'party-rules', { arena: 'ashfall-weir' }); send(leader, 'party-rules', { arena: 'vote' }); send(a, 'party-vote', 'hollowmere-quarry');
      send(leader, 'party-rules', { difficulty: 'hard' }); send(leader, 'party-rules', { seconds: 180 });
      expect(readyOf(room)).toEqual(ready);
      // Opening the party again resends the same profile: no change, nobody unready.
      send(a, 'party-profile', {rosterProtocol:ROSTER_PROTOCOL, fighter: 'taisei', name: 'a' });
      expect(readyOf(room)).toEqual(ready);
      // A friend joining or leaving: the others stay ready, the newcomer is not.
      const c = join('c');
      expect(readyOf(room)).toEqual({ ...ready, c: false });
      room.onLeave(c); room.clients.splice(room.clients.indexOf(c), 1);
      expect(readyOf(room)).toEqual(ready);
      // A member's own new fighter: only theirs.
      send(a, 'party-profile', {rosterProtocol:ROSTER_PROTOCOL, fighter: 'gummy' });
      expect(readyOf(room)).toEqual({ ...ready, a: false });
      readyAll();
      // The seats: everyone.
      send(leader, 'party-rules', { players: 12 });
      expect(readyOf(room)).toEqual({ leader: false, a: false, b: false });
      readyAll();
      // The mode: everyone.
      send(leader, 'party-mode', 'bad-blood');
      expect(readyOf(room)).toEqual({ leader: false, a: false, b: false });
      readyAll();
      // A new leader: the old one joins the others unready; everyone else's READY stands.
      send(leader, 'party-leader', 'a');
      expect(room.view.leader).toBe('a');
      expect(readyOf(room)).toEqual({ leader: false, a: false, b: true });
    } finally { room.onDispose(); }
  });

  it("lets friends join beyond a mode's seats, and START names who it waits for", () => {
    const { room, clients: [leader, a], send, join } = party(['leader', 'a'], { a: 'gummy' });
    try {
      send(leader, 'party-mode', 'last-stand');
      for (const id of ['b', 'c', 'd']) join(id);
      expect(room.view.members).toHaveLength(5);
      expect(startCheck(room.view).reason).toBe('4 seats for 5 players: choose another mode');
      send(leader, 'party-mode', 'royale');
      expect(startCheck(room.view)).toMatchObject({ reason: 'Waiting for a, b, c, d' });
      send(a, 'party-ready', true);
      expect(startCheck(room.view).waiting.map(m => m.id)).toEqual(['b', 'c', 'd']);
      // Bad Blood seats six, three a side: five heroes cannot start until some cross over.
      send(leader, 'party-mode', 'bad-blood');
      expect(room.view.mode).toBe('bad-blood');
      expect(startCheck(room.view).reason).toBe('Three heroes at most: swap a fighter');
      for (const [id, fighter] of [['b', 'oro'], ['c', 'shiun']]) send(room.clients.find(c => c.sessionId === id)!, 'party-profile', {rosterProtocol:ROSTER_PROTOCOL, fighter });
      expect(startCheck(room.view).reason).toMatch(/^Waiting for /);
      // Last Stand seats four: five friends cannot choose it.
      send(leader, 'party-mode', 'last-stand');
      expect(room.view.mode).toBe('bad-blood');
    } finally { room.onDispose(); }
  });

  it("never trades a party's match for one on the device (loneQueue)", () => {
    const snapshot = { serverTime: 100, roomMode: 'match', status: 'waiting', players: [{ id: 'me', isBot: false }], lobby: { visibility: 'private', duel: true, startsAt: 100 } } as never;
    for (const mode of ['duel', 'royale', 'bad-blood', 'last-stand', 'survival'] as const) expect(loneQueue(snapshot, 'me', { kind: 'party', travel: { id: 'x', mode, reservation: {} as never } })).toBeUndefined();
  });
});

describe('the rooms a party launches honour its place', () => {
  const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
  async function arena(room: DuelRoom, options: Record<string, unknown>) {
    let step!: FixedTimestepCallback;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { step = fn; });
    vi.spyOn(room, 'onMessage').mockImplementation((() => () => {}) as never);
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,...options} as never); void step; return room;
  }
  it("puts a private Duel where its creator chose, from the Duel's list only", async () => {
    for (const [stage, expected] of [['ashfall-weir', 'ashfall-weir'], ['zenith-coliseum', 'zenith-coliseum'], ['harbor', 'sunfall-arena'], ['hidden-ash', 'sunfall-arena'], [42, 'sunfall-arena'], [undefined, 'sunfall-arena']] as const) {
      const room = await arena(new PrivateDuelRoom(), { creationToken: TOKEN, stage });
      try { expect(room.simulation.stage, String(stage)).toBe(expected); } finally { room.onDispose(); }
    }
    // The public Duel queue is dealt its ring from the duelling rings in turn, whatever a page asks.
    const queue = await arena(new DuelRoom(), { stage: 'ashfall-weir' });
    try { expect(ONLINE_DUEL_STAGES).toContain(queue.simulation.stage); } finally { queue.onDispose(); }
  });
  it('opens a hosted Bad Blood on its named arena, and keeps it for the rematch', async () => {
    const room = new ObjectiveRoom();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined); vi.spyOn(room, 'setFixedTimestep').mockImplementation(() => {});
    vi.spyOn(room, 'onMessage').mockImplementation((() => () => {}) as never);
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, objective: 'bad-blood', access: 'host', creationToken: TOKEN, rules: { arena: 'warlords-roof' } });
    try {
      expect(room.game.sim.stage).toBe('warlords-roof');
      expect(vi.mocked(room.setMetadata).mock.calls.at(-1)?.[0]).toMatchObject({ map: 'warlords-roof' });
      (room as unknown as { rematch(): void }).rematch();
      expect(room.game.sim.stage).toBe('warlords-roof');
    } finally { room.onDispose(); }
    const plain = new ObjectiveRoom();
    vi.spyOn(plain, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(plain, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(plain, 'setFixedTimestep').mockImplementation(() => {});
    vi.spyOn(plain, 'onMessage').mockImplementation((() => () => {}) as never);
    await plain.onCreate({rosterProtocol:ROSTER_PROTOCOL, objective: 'bad-blood', access: 'host', creationToken: TOKEN, rules: { arena: 'harbor' } });
    try { expect(plain.game.sim.stage).toBe('blood-citadel'); } finally { plain.onDispose(); }
  });
});

describe('a party of six', () => {
  /** Who can play what, by the party's size: '' is open, anything else is the card's reason. */
  const table = (count: number) => Object.fromEntries(PARTY_ORDER.map(mode => [mode, modeBlocked(mode, count) ?? '']));
  it('holds up to twelve, and each mode says whether it seats them', () => {
    expect(PARTY_MAX).toBeGreaterThanOrEqual(6);
    expect(table(1)).toEqual({ duel: 'NEEDS 2 PLAYERS', 'goal-rush': '', 'sky-spike': '', royale: '', 'bad-blood': '', 'last-stand': '', survival: '', 'rift-war': '' });
    expect(table(2)).toEqual({ duel: '', 'goal-rush': '', 'sky-spike': '', royale: '', 'bad-blood': '', 'last-stand': '', survival: '', 'rift-war': '' });
    for (const count of [3, 4]) expect(table(count)).toEqual({ duel: '1 V 1 ONLY', 'goal-rush': '', 'sky-spike': '', royale: '', 'bad-blood': '', 'last-stand': '', survival: '', 'rift-war': '' });
    for (const count of [5, 6]) expect(table(count), String(count)).toEqual({ duel: '1 V 1 ONLY', 'goal-rush': '', 'sky-spike': '', royale: '', 'bad-blood': '', 'last-stand': 'UP TO 4 PLAYERS', survival: 'UP TO 4 PLAYERS', 'rift-war': '' });
    for (const count of [7, 8, 9, 10]) expect(table(count), String(count)).toEqual({ duel: '1 V 1 ONLY', 'goal-rush': 'UP TO 6 PLAYERS', 'sky-spike': 'UP TO 6 PLAYERS', royale: '', 'bad-blood': 'UP TO 6 PLAYERS', 'last-stand': 'UP TO 4 PLAYERS', survival: 'UP TO 4 PLAYERS', 'rift-war': '' });
    for (const count of [11, 12]) expect(table(count), String(count)).toEqual({ duel: '1 V 1 ONLY', 'goal-rush': 'UP TO 6 PLAYERS', 'sky-spike': 'UP TO 6 PLAYERS', royale: '', 'bad-blood': 'UP TO 6 PLAYERS', 'last-stand': 'UP TO 4 PLAYERS', survival: 'UP TO 4 PLAYERS', 'rift-war': 'UP TO 10 PLAYERS' });
    expect(Object.keys(PARTY_MODES).sort()).toEqual([...PARTY_ORDER].sort());
  });

  it('lets six friends in by the code, and turns the thirteenth away', () => {
    const f = fixture();
    try {
      for (let i = 0; i < 6; i++) f.join(`p${i}`);
      expect(f.room.view.members).toHaveLength(6);
      for (let i = 6; i < PARTY_MAX; i++) f.join(`p${i}`);
      expect(f.room.view.members).toHaveLength(PARTY_MAX);
      expect(() => f.join('one-too-many')).toThrow('This party is full.');
    } finally { f.room.onDispose(); }
  });

  // Six friends on the first volume's free sixteen (every other fighter is locked until bought, since 28 October 2026):
  // three heroes, and LORD ORO, the sixteen's one villain, three times over.
  const SIX = ['leader', 'a', 'b', 'c', 'd', 'e'], SIDES = { leader: 'taisei', a: 'konta', b: 'nigo', c: 'oro', d: 'oro', e: 'oro' };
  it('refuses the modes that cannot seat six, saying why, and never a field too small for them', () => {
    const { room, clients: [leader], send } = party(SIX, SIDES);
    try {
      for (const [mode, why] of [['last-stand', 'This mode seats up to 4 players.'], ['survival', 'This mode seats up to 4 players.'], ['duel', 'A Duel is for exactly two players.']] as const) {
        send(leader, 'party-mode', mode);
        expect(room.view.mode, mode).toBe('royale');
        expect(notices(leader).at(-1)).toBe(why);
      }
      send(leader, 'party-rules', { players: 4 });
      expect(room.view.rules.players).toBe(8);
      expect(notices(leader).at(-1)).toBe('Choose enough seats for everyone in the party.');
      send(leader, 'party-rules', { players: 12 });
      expect(room.view.rules.players).toBe(12);
      // A field outgrown by friends who joined after it was chosen says how many seats would take them.
      expect(startCheck({ ...room.view, rules: { ...room.view.rules, players: 4 } }).reason).toBe('4 seats for 6 players: choose 8 or 12 fighters');
    } finally { room.onDispose(); }
  });

  it.each([['royale', 'private_arena'], ['bad-blood', 'objective_arena'], ['rift-war', 'rift_war']] as const)('launches %s with all six on board, and its room starts by itself once they are in', async (mode, name) => {
    const f = party(SIX, SIDES), server = matchServer(), [leader] = f.clients;
    try {
      for (const c of f.clients) f.send(c, 'party-profile', { rosterProtocol: ROSTER_PROTOCOL, riftProtocol: RIFT_PROTOCOL });
      if (!modeOpen(mode)) { f.send(leader, 'party-mode', mode); expect(f.room.view.mode).not.toBe(mode); return; }
      f.send(leader, 'party-mode', mode); expect(f.room.view.mode).toBe(mode);
      f.readyAll();
      expect(startCheck(f.room.view)).toEqual({ waiting: [] });
      await f.room.launch(leader);
      expect(server.created).toHaveLength(1);
      expect(server.created[0]).toMatchObject({ name, options: { party: 6 } });
      expect(server.seats.map(seat => seat.name)).toEqual(SIX);
      // The room's own start (PartyStart) arms for six: the royale's eight seats, Bad Blood's six, the Rift War's ten.
      const seats = mode === 'royale' ? f.room.view.rules.players : mode === 'bad-blood' ? 6 : 10;
      expect(new PartyStart(6, seats).seats).toBe(6);
    } finally { f.room.onDispose(); }
  });

  it('keeps a team mode\'s sides as its fighters make them: six in Bad Blood are its three a side', () => {
    const heroes = { leader: 'tempo', a: 'shijima', b: 'suzuran', c: 'sashigane', d: 'oro', e: 'amagoi' };
    const { room, clients: [leader], send } = party(SIX, heroes);
    try {
      send(leader, 'party-mode', 'bad-blood');
      expect(startCheck(room.view).reason).toBe('Three heroes at most: swap a fighter');
      send(room.clients.find(c => c.sessionId === 'c')!, 'party-profile', { rosterProtocol: ROSTER_PROTOCOL, fighter: 'adad' });
      expect(startCheck(room.view).reason).toMatch(/^Waiting for /);
      // Last Stand's four seats never take six: its PartyStart would not arm, so the party never launches it.
      expect(new PartyStart(6, 4).seats).toBe(0);
    } finally { room.onDispose(); }
  });
});

describe('a launch into a match room on another process', () => {
  // (A real room counts its seats in the matchmaker's listing: Colyseus's own in-memory one.)
  beforeAll(() => matchMaker.setup(new LocalPresence(), new LocalDriver()));
  it.each(['last-stand', 'bad-blood', 'duel', 'royale', 'survival', 'rift-war'] as const)('%s: every answer the party asks of the room crosses, and each seat is held 90 s', async mode => {
    const f = party(['leader', 'guest']), [leader, guest] = f.clients;
    const match = new Room(), asked: string[] = [], held: number[] = [];
    const internals = match as unknown as Record<string, unknown> & { _reserveSeat(...args: unknown[]): Promise<boolean>; seatReservationTimeout: number; _reservedSeatTimeouts: Record<string, ReturnType<typeof setTimeout>> };
    internals._listing = { roomId: 'match-1', name: 'objective_arena', processId: 'another-process', clients: 0, maxClients: 12, locked: false };
    const reserve = internals._reserveSeat.bind(match);
    internals._reserveSeat = async (...args: unknown[]) => { held.push((args[3] as number | undefined) ?? internals.seatReservationTimeout); return reserve(...args); };
    mm.createRoom.mockReset().mockResolvedValue({ roomId: 'match-1', name: 'objective_arena', processId: 'another-process' });
    mm.remoteRoomCall.mockReset().mockImplementation(async (_roomId: string, method: string, args?: unknown[]) => {
      asked.push(method);
      const room = match as unknown as Record<string, (...a: unknown[]) => unknown>;
      return structuredClone(await room[method](...structuredClone(args ?? [])));
    });
    try {
      for (const c of f.clients) f.send(c, 'party-profile', { rosterProtocol: ROSTER_PROTOCOL, riftProtocol: RIFT_PROTOCOL });
      f.send(leader, 'party-mode', mode); f.readyAll();
      expect(f.room.view.mode).toBe(mode); // (every mode here is open: src/originals/server.ts partyModeAllowed)
      await f.room.launch(leader);
      expect(f.room.view.members.map(m => m.status)).toEqual(['travelling', 'travelling']);
      expect(vi.mocked(leader.send).mock.calls.find(c => c[0] === 'party-travel')?.[1]).toMatchObject({ mode, reservation: { roomId: 'match-1', processId: 'another-process' } });
      f.send(leader, 'party-arrived', (vi.mocked(leader.send).mock.calls.find(c => c[0] === 'party-travel')![1] as { id: string }).id);
      expect(vi.mocked(guest.send).mock.calls.some(c => c[0] === 'party-travel')).toBe(true);
      expect(held).toEqual([90, 90]);
      expect(asked.every(method => method === '_reserveSeat')).toBe(true);
    } finally { for (const timer of Object.values(internals._reservedSeatTimeouts)) clearTimeout(timer); clearTimeout(internals._autoDisposeTimeout as never); f.room.onDispose(); }
  });
});
