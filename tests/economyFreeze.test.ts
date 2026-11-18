import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { economyFrozen, mountEconomy } from '../src/server/economy/api';
import type { SurvivalReport } from '../src/game/economy/earn';

/** The match server's economy frozen for its move to PlayerTwo's world: a FROZEN file in
 *  the book's folder, and nothing is written - the routes answer 503 but for what only reads, and a room's pay is
 *  refused - so the copy taken is the whole book. */
const run = (id: string): SurvivalReport => ({ id, mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4 });

describe('the economy frozen for the move', () => {
  it('writes nothing once FROZEN is in its folder, and still answers a known account\'s hello', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-freeze-'));
    const posts = new Map<string, (req: unknown, res: unknown) => void>();
    let gate: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    const economy = mountEconomy({ use: (_path, handler) => { gate = handler as never; }, post: (path, handler) => { posts.set(path, handler as never); } }, { dir });
    const call = (path: string, body: unknown) => new Promise<{ status: number; body: Record<string, unknown> | undefined }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin: 'http://localhost:5173' } as Record<string, string> });
      const res = { statusCode: 0, setHeader: () => {}, removeHeader: () => {}, end: (text?: string) => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : undefined }) };
      gate!(req, res, () => { posts.get(`/api/economy/${path}`)!(req, res); queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); }); });
    });
    try {
      const hello = await call('hello', {});
      const token = hello.body!.token as string, pk = (hello.body!.account as { pk: string }).pk;
      writeFileSync(join(dir, 'FROZEN'), '');
      expect(economyFrozen(dir, Date.now() + 10_000)).toBe(true);
      expect((await call('hello', { token })).status).toBe(200);
      expect((await call('hello', {})).status).toBe(503);
      expect((await call('wear', { token, kind: 'title', item: 'title-rookie' })).status).toBe(503);
      expect((await call('p2room-pass', { token })).status).toBe(200);
      expect(() => economy.complete(pk, run('frozen-run-1'))).toThrow(/moving/);
      rmSync(join(dir, 'FROZEN'));
      expect(economyFrozen(dir, Date.now() + 20_000)).toBe(false);
    } finally { economy.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
