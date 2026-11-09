import { ROSTER_PROTOCOL } from '../../game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { BallRoom } from './BallRoom';
import { BALL_PROTOCOL, type BallModeId, type BallSnapshot } from '../../game/ball/model';

const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
afterEach(() => vi.restoreAllMocks());

async function fixture(access: 'host' | 'quick' = 'host', ball: BallModeId = 'goal-rush') {
  const room = new BallRoom(); let tick!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { tick = fn; });
  vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
  await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, access, creationToken: TOKEN, ballProtocol: BALL_PROTOCOL, ball });
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
    } finally { f.room.onDispose(); }
  }, 30000); // a whole match with its replays, on a busy machine
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
      // A goal's replay: both people skip, and it ends.
      const g = f.room.game;
      for (let i = 0; i < 60 * 30 && !g.replaying(); i++) {
        if (g.view.phase === 'live' && i % 30 === 0) { g.ball.x = 0; g.ball.z = 20; g.ball.y = 1; g.ball.vz = 30; g.ball.held = false; }
        f.advance(1 / 60);
      }
      expect(g.replaying()).toBe(true);
      f.send(host, 'ball-skip');
      expect(g.replaying()).toBe(true);
      f.send(guest, 'ball-skip');
      expect(g.replaying()).toBe(false);
    } finally { f.room.onDispose(); }
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
