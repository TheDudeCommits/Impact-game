import { ROSTER_PROTOCOL } from '../../game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { BallRoom } from './BallRoom';
import { BALL_PROTOCOL, BALL_SPORT, type BallModeId, type BallSnapshot } from '../../game/ball/model';
import {INTRO, SHORT_INTRO} from '../../game/ball/ceremony';

const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
afterEach(() => vi.restoreAllMocks());

async function fixture(access: 'host' | 'quick' = 'host', ball: BallModeId = 'goal-rush', extra: Record<string, unknown> = {}) {
  const room = new BallRoom(); let tick!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { tick = fn; });
  vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
  await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, access, creationToken: TOKEN, ballProtocol: BALL_PROTOCOL, ball, ...extra });
  const code = room.roomId.slice(5);
  const options = (id: string, fighter = 'taisei') => ({ rosterProtocol: ROSTER_PROTOCOL, fighter, code, name: id, ballProtocol: BALL_PROTOCOL, ball });
  const join = (id: string, fighter = 'taisei') => { const c = client(id); room.onJoin(c, options(id, fighter)); room.clients.push(c); return c; };
  const advance = (seconds: number) => { for (let i = 0; i < seconds * 60; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: i, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const last = (c: Client) => vi.mocked(c.send).mock.calls.filter(call => call[0] === 'snapshot').at(-1)?.[1] as BallSnapshot | undefined;
  return { room, join, advance, code, options, last, send: (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p) };
}

describe('the ball room', () => {
  it('refuses an old page, another mode and a missing code', async () => {
    const f = await fixture();
    try {
      const c = client('x');
      expect(() => f.room.onAuth(c, { ...f.options('x'), ballProtocol: 0 })).toThrow('Refresh');
      // (Protocol 10, the carried ball - a page from before it is told to refresh, as is a room it would open.)
      expect(BALL_PROTOCOL).toBe(10);
      expect(() => f.room.onAuth(c, { ...f.options('x'), ballProtocol: 9 })).toThrow('Refresh');
      await expect(new BallRoom().onCreate({ rosterProtocol: ROSTER_PROTOCOL, access: 'host', creationToken: TOKEN, ballProtocol: 9, ball: 'goal-rush' })).rejects.toThrow('Refresh');
      expect(() => f.room.onAuth(c, { ...f.options('x'), ball: 'sky-spike' })).toThrow('another mode');
      expect(() => f.room.onAuth(c, { ...f.options('x'), code: '000000' })).toThrow('room code');
      expect(f.room.onAuth(c, f.options('x'))).toBe(true);
    } finally { f.room.onDispose(); }
  });
  it('keeps a private room for its host, who can switch sides and start it, bots filling three a side', async () => {
    const f = await fixture('host');
    try {
      const host = f.join('h'), guest = f.join('g', 'konta');
      f.advance(20);
      expect(f.room.game.view.phase).toBe('lobby');
      expect(f.room.game.seats.get('h')!.team).not.toBe(f.room.game.seats.get('g')!.team);
      f.send(guest, 'ball-swap');
      expect(f.room.game.seats.get('g')!.team).toBe(f.room.game.seats.get('h')!.team);
      f.send(guest, 'ball-start');
      expect(f.room.game.view.phase).toBe('lobby');
      f.send(host, 'ball-start');
      expect(f.room.game.seats.size).toBe(6);
      f.advance(4);
      // The match's intro (game/ball/ceremony.ts) holds the countdown; once both people have voted to skip it, the kickoff.
      expect(f.room.game.view.phase).toBe('countdown');
      expect(f.room.game.view.intro?.seconds).toBe(INTRO.seconds);
      f.send(host, 'ball-skip');
      expect(f.room.game.view.intro).toMatchObject({skips: 1, people: 2});
      expect(f.room.game.view.phase).toBe('countdown');
      f.send(guest, 'ball-skip');
      expect(f.room.game.view.intro?.skipped).toBe(true);
      f.advance(1);
      expect(['kickoff', 'live']).toContain(f.room.game.view.phase);
      const snapshot = f.last(host)!;
      expect(snapshot.ball.mode).toBe('goal-rush');
      expect(snapshot.prediction?.h).toBeTruthy();
    } finally { f.room.onDispose(); }
  });
  it('starts a public match by itself after its wait, and plays it to the end', async () => {
    const f = await fixture('quick', 'sky-spike');
    try {
      const a = f.join('a');
      f.advance(12);
      expect(f.room.game.view.phase).toBe('lobby');
      f.advance(6);
      expect(f.room.game.view.phase).not.toBe('lobby');
      f.send(a, 'input', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
      for (let i = 0; i < 120 && f.room.game.view.phase !== 'over'; i++) f.advance(5);
      expect(f.room.game.view.phase).toBe('over');
      expect(f.room.game.view.winner).not.toBeNull();
      f.send(a, 'ball-rematch');
      expect(f.room.game.view.phase).toBe('lobby');
      expect(f.room.game.view.round).toBe(2);
      // The rematch opens with the short intro (ceremony.ts SHORT_INTRO).
      expect(f.room.game.view.intro).toMatchObject({seconds: SHORT_INTRO.seconds, short: true});
    } finally { f.room.onDispose(); }
  }, 30000); // a whole match with its replays, on a busy machine
  it('plays a private room\'s bots at the level its host picked, every round; matchmaking\'s at NORMAL', async () => {
    type Levelled = { difficulty: string };
    const f = await fixture('host', 'sky-spike', { difficulty: 'hard' });
    try {
      const host = f.join('h');
      expect((f.room.game as unknown as Levelled).difficulty).toBe('hard');
      expect(f.room.game.view.level).toBe('hard');
      f.send(host, 'ball-start'); f.advance(2);
      for (let i = 0; i < 120 && f.room.game.view.phase !== 'over'; i++) f.advance(5);
      f.send(host, 'ball-rematch');
      expect(f.room.game.view.round).toBe(2);
      expect((f.room.game as unknown as Levelled).difficulty).toBe('hard');
    } finally { f.room.onDispose(); }
    for (const [access, difficulty] of [['quick', 'hard'], ['host', 'brutal']] as const) {
      const g = await fixture(access, 'goal-rush', { difficulty });
      try { expect((g.room.game as unknown as Levelled).difficulty).toBe('normal'); expect(g.room.game.view.level).toBeUndefined(); } finally { g.room.onDispose(); }
    }
  }, 30000); // a whole match, on a busy machine
  it('lets the host choose RUMBLE in the lobby, relays quick chat, and ends a replay when everyone skips', async () => {
    const f = await fixture('host');
    try {
      const host = f.join('h'), guest = f.join('g', 'konta');
      f.send(guest, 'ball-rumble', true);
      expect(f.room.game.view.rumble).toBe(false);
      f.send(host, 'ball-rumble', true);
      expect(f.room.game.view.rumble).toBe(true);
      f.send(host, 'ball-start'); f.advance(4);
      expect(f.room.game.view.rumble).toBe(true);
      // Quick chat: a line by its index, into the match's moments; nonsense and a flood are dropped.
      f.send(guest, 'ball-chat', 4);
      expect(f.room.game.view.events.some(e => e.kind === 'chat' && e.actorId === 'g' && e.text === 'Nice shot!')).toBe(true);
      f.send(guest, 'ball-chat', 'hello'); f.send(guest, 'ball-chat', 99); f.send(guest, 'ball-chat', 5);
      expect(f.room.game.view.events.filter(e => e.kind === 'chat' && e.actorId === 'g')).toHaveLength(1);
      // A goal's replay (a screamer's, into blue's net, so red scored): the side that conceded skips, and it
      // plays on; the scorers' side skips, and it ends.
      const g = f.room.game;
      for (let i = 0; i < 60 * 30 && !g.replaying(); i++) {
        if (g.view.phase === 'live' && i % 30 === 0) { g.ball.x = 0; g.ball.z = 20; g.ball.y = 1; g.ball.vz = 40; g.ball.heat = 3.5; g.ball.held = false; }
        f.advance(1 / 60);
      }
      expect(g.replaying()).toBe(true);
      const [conceded, scored] = g.seats.get('h')!.team === 'red' ? [guest, host] : [host, guest];
      f.send(conceded, 'ball-skip');
      expect(g.replaying()).toBe(true);
      f.send(scored, 'ball-skip');
      expect(g.replaying()).toBe(false);
    } finally { f.room.onDispose(); }
  }, 30000);
  it("fights in Goal Rush and never in Sky Spike, the sport's movement on, a wipe-out on every page", async () => {
    const f = await fixture('host');
    try {
      const host = f.join('h'), guest = f.join('g', 'konta');
      f.send(host, 'ball-start'); f.send(host, 'ball-skip'); f.send(guest, 'ball-skip');
      const g = f.room.game;
      for (let i = 0; i < 60 * 10 && g.view.phase !== 'live'; i++) f.advance(1 / 60);
      expect(g.view.phase).toBe('live');
      expect(g.sim.assist?.sport).toBe(BALL_SPORT['goal-rush']);
      expect(g.sim.actors.get('h')!.state.team).toBe(g.seats.get('h')!.team);
      g.sim.strike('h', 'g', 'heavy', { name: 'Test Haymaker', duration: .4, contacts: [0], damage: 999, range: 2, radius: .8, stamina: 0, cooldown: 0, stun: .3, knockback: 4, style: 'melee' });
      f.advance(.1);
      const seen = f.last(host)!.ball;
      expect(seen.seats.find(s => s.id === 'g')!.out).toBeGreaterThan(0);
      expect(seen.events.some(e => e.kind === 'wipeout' && e.actorId === 'h' && e.targetId === 'g')).toBe(true);
    } finally { f.room.onDispose(); }
    const spike = await fixture('host', 'sky-spike');
    try {
      spike.join('h'); spike.join('g', 'konta');
      const g = spike.room.game;
      expect(g.sim.assist?.sport).toBe(BALL_SPORT['sky-spike']);
      expect(g.sim.actors.get('h')!.state.team).toBe(g.sim.actors.get('g')!.state.team);
    } finally { spike.room.onDispose(); }
  }, 30000);
  it('contains bad input', async () => {
    const f = await fixture();
    try {
      const host = f.join('h');
      for (let i = 0; i < 100; i++) f.send(host, 'input', {});
      expect(vi.mocked(host.send).mock.calls.filter(c => c[0] === 'input-rejected')).toHaveLength(1);
    } finally { f.room.onDispose(); }
  });
});
