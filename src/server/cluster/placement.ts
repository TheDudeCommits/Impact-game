import type { Presence } from 'colyseus';
import type { ClusterRole } from './link';

export const LOAD_KEY = 'impact:load';
/** What a process says of itself. */
export interface Load { role: ClusterRole; index: number; busy: number; shedding: boolean; rooms: number; at: number }

/** The process a new room goes to, from every process's last word; undefined when no room process has spoken lately. */
export function choose(roomName: string, loads: Record<string, string>, now = Date.now()): string | undefined {
  const fresh = Object.entries(loads).flatMap(([processId, raw]) => {
    try { const load = JSON.parse(raw) as Load; return load.role === 'rooms' && now - load.at < 10_000 ? [{ processId, ...load }] : []; } catch { return []; }
  });
  const pool = roomName === 'rift_war' ? fresh.filter(load => load.index === 1) : fresh;
  pool.sort((a, b) => Number(a.shedding) - Number(b.shedding) || a.busy - b.busy || a.rooms - b.rooms || a.index - b.index);
  return pool[0]?.processId;
}

/** Say how this process is doing, every two seconds, until it ends. */
export function reportLoad(presence: Presence, processId: string, role: ClusterRole, index: number, read: () => { tickMsTotal: number; shedding: boolean; rooms: number }) {
  let last = read().tickMsTotal, lastAt = performance.now();
  const say = () => {
    const now = performance.now(), sample = read();
    const busy = Math.max(0, (sample.tickMsTotal - last) / Math.max(1, now - lastAt));
    last = sample.tickMsTotal; lastAt = now;
    const load: Load = { role, index, busy: Math.round(busy * 1000) / 1000, shedding: sample.shedding, rooms: sample.rooms, at: Date.now() };
    void Promise.resolve(presence.hset(LOAD_KEY, processId, JSON.stringify(load))).catch(() => {});
  };
  say();
  const timer = setInterval(say, 2000); timer.unref?.();
  return () => { clearInterval(timer); void Promise.resolve(presence.hdel(LOAD_KEY, processId)).catch(() => {}); };
}

/** Colyseus's `selectProcessIdToCreateRoom` for the cluster. */
export const selectProcess = (presence: Presence) => async (roomName: string): Promise<string> => {
  const chosen = choose(roomName, await presence.hgetall(LOAD_KEY) ?? {});
  // (No room process has spoken in ten seconds: they are starting or restarting. The page shows these words as they are.)
  if (!chosen) throw new Error('The arenas are starting. Try again in a moment.');
  return chosen;
};
