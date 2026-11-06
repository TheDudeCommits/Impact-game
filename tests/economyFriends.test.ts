import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { Economy, mountEconomy } from '../src/server/economy/api';
import { RoomRewards } from '../src/server/economy/RoomRewards';
import { RiftRoom } from '../src/server/moba/RiftRoom';
import { ArenaSimulation } from '../src/game/simulation';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';
import { RIFT_PROTOCOL, type RiftSnapshot } from '../src/game/moba/model';
import type { RiftMatch } from '../src/game/moba/RiftMatch';
import { LocalDuel } from '../src/game/duel/LocalDuel';
import { LocalRift } from '../src/game/moba/LocalRift';
import { SECOND } from '../src/game/couchSeat';
import { MOVES } from '../src/game/moves';
import type { ExternalBlow } from '../src/game/simulation';
import { DeviceRun, deviceId, deviceReports } from '../src/game/economy/device';
import { PAY, payFor, plausible, type MatchReport, type Report, type SurvivalReport } from '../src/game/economy/earn';
import type { Account, Settlement } from '../src/game/economy/account';
import type { GameSnapshot } from '../src/game/types';

vi.mock('../src/game/rapierCollision', async original => ({ ...await original<object>(), createRapierCollision: vi.fn(async () => undefined) }));
const sum = (lines: { amount: number }[]) => lines.reduce((n, line) => n + line.amount, 0);
const own = (report: Report, lines: { label: string; amount: number }[]) => { const labels = new Set(payFor(report).map(line => line.label)); return lines.filter(line => labels.has(line.label)); };
const bout = (over: Partial<MatchReport> = {}): MatchReport => ({ id: deviceId(), mode: 'bots', fighter: 'taisei', seconds: 240, place: 2, players: 8, kos: 3, ...over });
const war = (over: Partial<MatchReport> = {}): MatchReport => ({ id: deviceId(), mode: 'rift-war', fighter: 'taisei', seconds: 720, place: 1, players: 10, kos: 4, assists: 3, towers: 2, ...over });
const clock = (start = Date.UTC(2026, 10, 2, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
type Answer = { account: Account; token: string; settlement?: Settlement };
const paid = (answer: unknown) => answer as Answer;
const guest = (e: Economy) => e.hello(undefined) as unknown as Answer;
const FRIEND = 'Played with a friend';

describe('what a match with a friend pays', () => {
  it('pays a private room or a bots match with a friend in full, and the friend\'s line besides; alone, half', () => {
    const alone = bout(), friends = bout({ friends: true });
    expect(sum(payFor(alone))).toBe((8 + 12 + 6) * PAY.practice);
    expect(payFor(friends)).toContainEqual({ label: FRIEND, amount: PAY.friend });
    expect(sum(payFor(friends))).toBe(8 + 12 + 6 + PAY.friend);
    expect(sum(payFor(bout({ mode: 'private', friends: true })))).toBe(sum(payFor(bout({ mode: 'match' }))) + PAY.friend);
    // The couch is a friend: the royale on one device says so.
    const couch = payFor(bout({ couch: true }));
    expect(couch[0]).toEqual({ label: 'Couch match', amount: 8 }); expect(couch).toContainEqual({ label: FRIEND, amount: PAY.friend });
    // A Duel, a Last Stand and a Bad Blood at the practice rate pay in full with a friend.
    for (const mode of ['duel', 'last-stand', 'bad-blood'] as const) {
      const base = bout({ mode, practice: true, place: 1, players: mode === 'duel' ? 2 : 4 });
      expect(sum(payFor({ ...base, friends: true }))).toBe(sum(payFor({ ...base, practice: false })) + PAY.friend);
    }
    // A run with friends: the line, and nothing else changes.
    const run: SurvivalReport = { id: deviceId(), mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2e6, kills: 1800, style: 4 };
    expect(sum(payFor({ ...run, friends: true }))).toBe(sum(payFor(run)) + PAY.friend);
    expect(PAY.friend).toBeGreaterThan(0); expect(PAY.friend).toBeLessThanOrEqual(8);
  });

  it('keeps what a report says of its company through the rules, and adds nothing to a report from before', () => {
    const checked = plausible(bout({ couch: true }), false);
    if ('refused' in checked) throw new Error(checked.refused);
    expect(checked.report).toMatchObject({ friends: true, couch: true });
    const old = plausible(bout(), false);
    if ('refused' in old) throw new Error(old.refused);
    expect('friends' in old.report || 'couch' in old.report || 'towers' in old.report).toBe(false);
  });
});

describe('what a Rift War pays', () => {
  it('pays about two matches for a war, its parts capped, at the practice rate with bots and in full with a friend', () => {
    const full = war({ practice: false });
    expect(payFor(full)).toEqual([{ label: 'War fought', amount: 15 }, { label: 'War won', amount: 20 }, { label: '4 knockouts', amount: 8 }, { label: '3 assists', amount: 3 }, { label: '2 structures brought down', amount: 8 }]);
    expect(sum(payFor(war({ practice: false, kos: 40, assists: 40, towers: 12 })))).toBe(15 + 20 + 12 + 10 + 16);
    expect(sum(payFor(war({ practice: true })))).toBe(sum(payFor(full)) * PAY.practice);
    expect(sum(payFor(war({ practice: true, friends: true })))).toBe(sum(payFor(full)) + PAY.friend);
    // A war won is more than a royale won, and less than three of them (it is about three royales long).
    const royale = sum(payFor(bout({ mode: 'match', place: 1, kos: 3 })));
    expect(sum(payFor(full))).toBeGreaterThan(royale); expect(sum(payFor(full))).toBeLessThan(royale * 3);
  });

  it('holds a war on a device to its length: structures and knockouts by time', () => {
    const checked = plausible(war({ seconds: 100, towers: 30, kos: 90 }), false);
    if ('refused' in checked) throw new Error(checked.refused);
    expect(checked.report).toMatchObject({ mode: 'rift-war', towers: 5, kos: 20 });
    expect(plausible(war({ seconds: 30 }), false)).toEqual({ refused: 'A match that short earns nothing.' });
  });
});

describe('on a device: the couch and Rift War, paid within the caps', () => {
  it('pays a couch match in full with the friend\'s line, a claim of friends without the couch at the practice rate, and a war', () => {
    const now = clock(), e = new Economy({ dir: false, now }); try {
      const a = guest(e); now.pass(3600);
      const couch = bout({ mode: 'duel', place: 1, players: 2, kos: 2, seconds: 150, couch: true }), settled = paid(e.report(a.token, couch));
      expect(own(couch, settled.settlement!.lines)).toEqual([{ label: 'Best-of-three set completed', amount: 8 }, { label: 'Set victory', amount: 12 }, { label: '2 knockouts', amount: 2 }, { label: FRIEND, amount: PAY.friend }]);
      expect(e.book.completions.get(`${couch.id}:${a.account.pk}`)!.report).toMatchObject({ practice: true, friends: true, couch: true });
      expect(settled.account.stats.modes).toMatchObject({ couch: 1, couchWins: 1, friends: 1, duelWins: 1 });
      expect(settled.settlement!.feats).toEqual(expect.arrayContaining(['friends-1', 'couch-1']));
      // A device has no friends but the couch: "friends" alone is dropped, and the match is paid at the practice rate.
      now.pass(600);
      const claim = bout({ friends: true }), told = paid(e.report(a.token, claim));
      expect(e.book.completions.get(`${claim.id}:${a.account.pk}`)!.report).not.toHaveProperty('friends');
      expect(told.settlement!.lines.some(line => line.label === FRIEND)).toBe(false);
      // A war with bots: at the practice rate; on the couch, in full.
      now.pass(900);
      const bots = war({ seconds: 700 }), fought = paid(e.report(a.token, bots));
      // (Each line paid whole: half of 15 is 8, half of 3 is 2.)
      expect(own(bots, fought.settlement!.lines)).toEqual(payFor({ ...bots, practice: true }).map(line => ({ ...line, amount: Math.round(line.amount) })));
      expect(sum(payFor({ ...bots, practice: true }))).toBe(sum(payFor({ ...bots, practice: false })) * PAY.practice);
      expect(fought.account.stats.modes).toMatchObject({ riftWins: 1, towers: 2 });
      now.pass(900);
      const together = war({ seconds: 700, couch: true }), shared = paid(e.report(a.token, together));
      expect(sum(own(together, shared.settlement!.lines))).toBe(sum(payFor({ ...together, practice: false, couch: false, friends: false })) + PAY.friend);
    } finally { e.close(); }
  });
});

describe('rooms: a private or party room with two people who played pays as friends', () => {
  const lobby = (snapshot: GameSnapshot): GameSnapshot => ({ ...snapshot, lobby: { visibility: 'private', hostId: 'a', canStart: true } as GameSnapshot['lobby'] });
  it('a private royale of two people: both in full, with the line; alone with bots in a private room: half', () => {
    for (const company of [true, false]) {
      const e = new Economy({ dir: false }), sim = new ArenaSimulation({ roomMode: 'match' }); try {
        const a = guest(e), b = guest(e), r = new RoomRewards(() => e);
        sim.addPlayer('a', 'konta', 'A'); sim.addPlayer('b', 'taisei', 'B', !company); sim.addPlayer('c', 'gummy', 'C', true);
        r.bind('a', a.token); if (company) r.bind('b', b.token);
        sim.startMatch(); r.observe(lobby(sim.snapshot()));
        r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); if (company) r.input('b', { seq: 1, moveX: -1, moveZ: 0, yaw: 0 });
        sim.serverTime = 70; sim.damage('c', 1e6, 'a', 'KO'); sim.damage('b', 1e6, 'a', 'KO'); sim.step(); r.observe(lobby(sim.snapshot()));
        const receipt = r.forOwner(sim.snapshot(), 'a').reward!;
        expect(receipt.report).toMatchObject({ mode: 'private', place: 1, ...(company ? { friends: true } : {}) });
        if (company) { expect(receipt.settlement.lines).toContainEqual({ label: FRIEND, amount: PAY.friend }); expect(r.forOwner(sim.snapshot(), 'b').reward?.report).toMatchObject({ friends: true }); }
        else { expect(receipt.report).not.toHaveProperty('friends'); expect(sum(own(receipt.report, receipt.settlement.lines))).toBe(sum(payFor({ ...receipt.report as MatchReport, mode: 'match' })) * PAY.practice); }
      } finally { sim.dispose(); e.close(); }
    }
  });

  it('an Arcade co-op run in a private room of two people carries the friend\'s line; in a quick room, none', () => {
    for (const privateRoom of [true, false]) {
      const e = new Economy({ dir: false }); try {
        const a = guest(e), b = guest(e), r = new RoomRewards(() => e);
        const result = { fighter: 'kenzo', round: 6, wave: 6, rank: 'C', act: 2, score: 5e5, kills: 400, ownKills: 300, seconds: 600, level: 6, bestRank: 3, bestCombo: 20, damageDealt: 3e4, damageTaken: 5e3, bosses: 5, picks: [], finishers: 2, party: 2 };
        const game = { phase: 'lobby', sim: { serverTime: 0 }, view: () => ({ result: game.phase === 'over' ? result : undefined }) };
        r.bind('a', a.token); r.bind('b', b.token);
        game.phase = 'fight'; r.survival(game as never, 1, privateRoom);
        r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); r.input('b', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
        game.phase = 'over'; game.sim.serverTime = 600; r.survival(game as never, 1, privateRoom);
        const receipt = r.forOwner({} as GameSnapshot, 'a').reward!;
        expect(receipt.report).toMatchObject({ mode: 'survival', coop: true });
        expect(!!(receipt.report as SurvivalReport).friends).toBe(privateRoom);
        expect(receipt.settlement.lines.some(line => line.label === FRIEND)).toBe(privateRoom);
      } finally { e.close(); }
    }
  });

  it('a friend who never played is not company: the room pays the practice rate', () => {
    const e = new Economy({ dir: false }), sim = new ArenaSimulation({ roomMode: 'match' }); try {
      const a = guest(e), r = new RoomRewards(() => e);
      sim.addPlayer('a', 'konta', 'A'); sim.addPlayer('b', 'taisei', 'B'); r.bind('a', a.token);
      sim.startMatch(); r.observe(lobby(sim.snapshot())); r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
      sim.serverTime = 70; sim.damage('b', 1e6, 'a', 'KO'); sim.step(); r.observe(lobby(sim.snapshot()));
      expect(r.forOwner(sim.snapshot(), 'a').reward!.report).not.toHaveProperty('friends');
    } finally { sim.dispose(); e.close(); }
  });

  it('a hosted Bad Blood of two people pays in full; a public one stays as it was', () => {
    for (const access of ['host', 'quick'] as const) {
      const e = new Economy({ dir: false }), game = new ObjectiveMatch('bad-blood', undefined, 7, access); try {
        const a = guest(e), b = guest(e), r = new RoomRewards(() => e);
        game.add('a', 'konta', 'A'); game.add('b', 'taisei', 'B'); r.bind('a', a.token); r.bind('b', b.token);
        game.start(); while (game.view.phase !== 'active') game.step(); r.observe(game.snapshot());
        r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); r.input('b', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
        game.sim.serverTime += 30;
        const team = game.seats.get('a')!.team;
        for (const seat of game.seats.values()) if (seat.team !== team) game.sim.damage(seat.id, 1e6, 'a', 'Out');
        for (let i = 0; i < 60 && (game.view.phase as string) !== 'over'; i++) game.step();
        r.observe(game.snapshot());
        const report = r.forOwner(game.snapshot(), 'a').reward!.report as MatchReport;
        expect(report).toMatchObject({ mode: 'bad-blood', practice: access === 'host' });
        expect(!!report.friends).toBe(access === 'host');
      } finally { game.sim.dispose(); e.close(); }
    }
  });
});

describe('Rift War rooms pay (RiftRoom with RoomRewards)', () => {
  afterEach(() => vi.restoreAllMocks());
  const blow = (attackerId: string): ExternalBlow => ({ attackerId, damage: 1e7, slot: 'light', move: MOVES.taisei.light, pushX: 0, pushZ: 0, knockback: 0, stun: 0, launch: false, hitstop: 0, critical: false, finisher: true } as ExternalBlow);
  /** The villains' side brought down by `by`, a structure at a time as each opens, until the core falls. */
  const siege = (g: RiftMatch, by: string) => {
    for (let pass = 0; pass < 20 && g.view.phase !== 'over'; pass++) for (const s of g.view.structures.filter(s => s.team === 'villains' && s.hp > 0 && s.vulnerable)) { const body = g.locate(s.id); if (body) g.receive(body, blow(by)); }
  };
  async function room(access: 'host' | 'quick') {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false });
    const r = new RiftRoom(); let tick!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
    vi.spyOn(r, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(r, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(r, 'broadcast').mockImplementation(() => {});
    vi.spyOn(r, 'lock').mockResolvedValue(undefined); vi.spyOn(r, 'unlock').mockResolvedValue(undefined); vi.spyOn(r, 'setFixedTimestep').mockImplementation(fn => { tick = fn; });
    vi.spyOn(r, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
    await r.onCreate({ rosterProtocol: ROSTER_PROTOCOL, access, creationToken: '01234567-89ab-cdef-0123-456789abcdef', riftProtocol: RIFT_PROTOCOL });
    const code = r.roomId.slice(5);
    const join = (id: string, fighter: string, account: string) => { const c = { sessionId: id, send: vi.fn() } as unknown as Client; r.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter, code, name: id, riftProtocol: RIFT_PROTOCOL, account }); r.clients.push(c); return c; };
    const advance = (seconds: number) => { for (let i = 0; i < seconds * 60; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: i, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const last = (c: Client) => vi.mocked(c.send).mock.calls.filter(call => call[0] === 'snapshot').at(-1)![1] as RiftSnapshot;
    return { economy, r, join, advance, last, send: (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p) };
  }

  it('a private war of two people: each paid in full with the friend\'s line, its receipt on its own field', async () => {
    const f = await room('host'); try {
      const a = guest(f.economy), b = guest(f.economy);
      const host = f.join('h', 'taisei', a.token), friend = f.join('g', 'konta', b.token);
      f.send(host, 'rift-start'); f.advance(3.2);
      f.send(host, 'input', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); f.send(friend, 'input', { seq: 1, moveX: -1, moveZ: 0, yaw: 0 }); f.advance(12);
      siege(f.r.game, 'h'); f.advance(.5);
      expect(f.r.game.view.phase).toBe('over');
      const mine = f.last(host);
      expect(mine.matchId).toBeUndefined(); expect(mine.reward).toBeUndefined();
      const receipt = mine.receipt!;
      expect(receipt.reward!.report).toMatchObject({ id: receipt.matchId, mode: 'rift-war', place: 1, players: 10, friends: true, practice: true });
      expect((receipt.reward!.report as MatchReport).towers).toBeGreaterThanOrEqual(3);
      expect(receipt.reward!.settlement.lines).toContainEqual({ label: FRIEND, amount: PAY.friend });
      expect(receipt.reward!.settlement.lines).toContainEqual({ label: 'War won', amount: PAY.rift.win });
      expect(f.last(friend).receipt!.reward!.report).toMatchObject({ mode: 'rift-war', friends: true, place: 1 });
      expect(f.economy.book.find(a.token)!.stats.modes).toMatchObject({ riftWins: 1, friends: 1 });
      expect(f.economy.book.find(a.token)!.feats).toEqual(expect.arrayContaining(['rift-win', 'friends-1']));
      // Once: more snapshots pay nothing more.
      const balance = f.economy.book.find(a.token)!.balance; f.advance(1); expect(f.economy.book.find(a.token)!.balance).toBe(balance);
    } finally { f.r.onDispose(); f.economy.close(); }
  });

  it('a public war of one person and bots: the practice rate, no friend', async () => {
    const f = await room('quick'); try {
      const a = guest(f.economy), me = f.join('h', 'taisei', a.token);
      f.advance(21); expect(f.r.game.view.phase).not.toBe('lobby'); f.advance(3.2);
      f.send(me, 'input', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); f.advance(12);
      siege(f.r.game, 'h'); f.advance(.5);
      const report = f.last(me).receipt!.reward!.report as MatchReport;
      expect(report).toMatchObject({ mode: 'rift-war', practice: true, place: 1 }); expect(report).not.toHaveProperty('friends');
    } finally { f.r.onDispose(); f.economy.close(); }
  });
});

describe('device reports: the couch and Rift War', () => {
  const sent: Report[] = [];
  beforeEach(() => { sent.length = 0; deviceReports.send = report => { sent.push(report); }; deviceReports.begin = () => {}; });
  afterAll(() => { deviceReports.send = () => {}; deviceReports.begin = () => {}; });

  it('a couch Duel: Player 1\'s set, with a friend once Player 2 has played; a Player 2 who never did is not company', async () => {
    for (const played of [true, false]) {
      sent.length = 0;
      const duel = new LocalDuel(); try {
        await duel.connect('koko', 'You', 'taisei', undefined, true);
        let seq = 0, two = 0; duel.second = () => ({ seq: ++two, moveX: played ? -1 : 0, moveZ: 0, yaw: 0 });
        const step = (moveX = 0) => duel.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
        const round = () => { for (let i = 0; i < 185; i++) step(); step(1); duel.sim!.serverTime += 40; duel.sim!.damage(SECOND, 1e6, 'you', 'KO'); step(); };
        round(); round(); for (let i = 0; i < 120; i++) step();
        expect(duel.snapshot!.duel?.phase).toBe('complete');
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ mode: 'duel', place: 1, players: 2, practice: true });
        if (played) expect(sent[0]).toMatchObject({ friends: true, couch: true }); else expect(sent[0]).not.toHaveProperty('couch');
        expect(plausible(sent[0], false)).not.toHaveProperty('refused');
      } finally { await duel.leave(); }
    }
  }, 60000);

  it('a Rift War with bots on the device: once, when the core falls, its structures and its side\'s win', async () => {
    const rift = new LocalRift(); try {
      await rift.connect('taisei', 'You');
      const g = rift.match!, id = rift.id;
      let seq = 0; const step = (moveX = 0) => rift.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
      for (let i = 0; i < 200; i++) step();
      expect(g.view.phase).toBe('active'); step(1);
      g.sim.serverTime += 90;
      const blow = { attackerId: id, damage: 1e7, slot: 'light', move: MOVES.taisei.light, pushX: 0, pushZ: 0, knockback: 0, stun: 0, launch: false, hitstop: 0, critical: false, finisher: true } as ExternalBlow;
      const team = g.seats.get(id)!.team, enemy = team === 'heroes' ? 'villains' : 'heroes';
      for (let pass = 0; pass < 20 && g.view.phase !== 'over'; pass++) for (const s of g.view.structures.filter(s => s.team === enemy && s.hp > 0 && s.vulnerable)) { const body = g.locate(s.id); if (body) g.receive(body, blow); }
      step(); for (let i = 0; i < 30; i++) step();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ mode: 'rift-war', practice: true, fighter: 'taisei', place: 1, players: 10 });
      const checked = plausible(sent[0], false);
      if ('refused' in checked) throw new Error(checked.refused);
      expect((checked.report as MatchReport).towers).toBeGreaterThanOrEqual(3);
    } finally { await rift.leave(); }
  }, 60000);

  it('a couch run: Player 1\'s, with a friend once Player 2 has played', () => {
    const result = { fighter: 'kenzo', round: 9, wave: 9, rank: 'B', act: 3, score: 9e5, kills: 700, ownKills: 650, seconds: 900, level: 9, bestRank: 3, bestCombo: 20, damageDealt: 5e4, damageTaken: 9e3, bosses: 9, picks: [], finishers: 3, party: 2 } as never;
    const runs: SurvivalReport[] = [];
    for (const played of [true, false]) {
      const run = new DeviceRun(r => { runs.push(r); });
      run.observe('intro', () => undefined, true); run.input({ seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); if (played) run.partnerInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, attack: 'light' });
      run.observe('over', () => result, true);
    }
    expect(runs[0]).toMatchObject({ mode: 'survival', friends: true, couch: true, coop: false }); expect(runs[1]).not.toHaveProperty('couch');
  });
});
