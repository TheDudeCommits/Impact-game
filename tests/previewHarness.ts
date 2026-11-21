import { ArenaSimulation } from '../src/game/simulation';
import { Prediction, impactKey } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { COMBO_STAMINA } from '../src/game/moves';
import type { AttackSlot, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

/** the local fighter's blows presented ahead of the server (Prediction.takeImpacts), and
 *  how many of them the server never lands - the phantoms the `committed` guard is there to keep out. A server with a bot
 *  for the foe (its own guards, escapes and counters, which the page cannot see coming) and a page a round trip away:
 *  commands up through the room's input queue, snapshots down at 30 Hz, both `rttMs / 2` late, lock combat on as every
 *  online room plays it. The page mashes strings at the foe - lights, a heavy now and then, a special. Counts every blow
 *  presented early, every one of those the server confirmed, and every hit the server landed. */
export function previewRun(fighter: FighterId, foe: FighterId, rttMs: number, seconds: number, seed: number) {
  const server = new ArenaSimulation({ roomMode: 'match', maxStamina: COMBO_STAMINA, maxHp: 60000, lockCombat: true, seed });
  server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('foe', foe, 'Foe', true, { x: 0, y: 0, z: 2.4 });
  server.startMatch();
  const prediction = new Prediction(); prediction.lockCombat = true;
  let snapshot: GameSnapshot = server.snapshot(true, true);
  prediction.start('me', snapshot);
  const one = Math.max(1, Math.round(rttMs / 2 / (1000 / 60))), queue = new InputQueue();
  const up: { at: number; input: PlayerInput }[] = [], down: { at: number; s: GameSnapshot }[] = [];
  const presented = new Set<string>(), landed = new Set<string>();
  let s = seed >>> 0 || 1;
  const random = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  let nextPress = 20, echoes = 0;
  try {
    for (let tick = 0; tick < seconds * 60; tick++) {
      const me = snapshot.players.find(p => p.id === 'me')!, them = snapshot.players.find(p => p.id === 'foe')!;
      const dx = them.x - me.x, dz = them.z - me.z, d = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, dz);
      let attack: AttackSlot | undefined;
      if (tick >= nextPress) {
        const roll = random();
        attack = roll < .78 ? 'light' : roll < .92 ? 'heavy' : 'special';
        nextPress = tick + (attack === 'light' ? 5 + Math.floor(random() * 5) : 20 + Math.floor(random() * 20));
      }
      const close = d < 1.8;
      const input: PlayerInput = { seq: tick, moveX: close ? 0 : dx / d, moveZ: close ? 0 : dz / d, yaw, targetId: 'foe', lock: true, ...(attack ? { attack } : {}) };
      prediction.submit(input); up.push({ at: tick + one, input });
      while (up.length && up[0].at <= tick) queue.push(up.shift()!.input);
      const next = queue.take(); if (next) server.submitInput('me', next);
      server.step(1 / 60, new Set(next ? [] : ['me']));
      if (tick % 2 === 0) down.push({ at: tick + one, s: server.snapshot(true, true) });
      while (down.length && down[0].at <= tick) {
        snapshot = down.shift()!.s; prediction.reconcile(snapshot);
        for (const e of snapshot.events) if (e.kind === 'hit' && e.actorId === 'me' && e.actionSeq !== undefined) {
          landed.add(impactKey(e));
          // A blow presented early whose own event the page would answer a second time (main.ts passes over what
          // impactWasPresented says it has shown).
          if (presented.has(impactKey(e)) && !prediction.impactWasPresented(e)) echoes++;
        }
        prediction.markAuthoritativeImpacts(snapshot.events);
      }
      for (const e of prediction.takeImpacts()) presented.add(impactKey(e));
    }
    // What is still in flight when the run ends is given its round trip to land.
    for (let tick = 0; tick < 2 * one + 12; tick++) {
      server.step(1 / 60);
      for (const e of server.snapshot(true, true).events) if (e.kind === 'hit' && e.actorId === 'me' && e.actionSeq !== undefined) landed.add(impactKey(e));
    }
    for (const { s: kept } of down) for (const e of kept.events) if (e.kind === 'hit' && e.actorId === 'me' && e.actionSeq !== undefined) landed.add(impactKey(e));
  } finally { prediction.stop(); server.dispose?.(); }
  let phantoms = 0;
  for (const key of presented) if (!landed.has(key)) phantoms++;
  return { presented: presented.size, phantoms, landed: landed.size, echoes };
}
