import { describe, expect, it } from 'vitest';
import { RiftMatch } from '../src/game/moba/RiftMatch';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';
import { SurvivalGame } from '../src/survival/SurvivalGame';
import { ArenaSimulation } from '../src/game/simulation';
import { LOCK_BOT_ESCAPE } from '../src/game/lockCombat';
import type { CombatEvent, PlayerInput } from '../src/game/types';

describe('lock combat in every mode', () => {
  it('Rift War', () => {
    for (const lock of [false, true]) {
      const game = new RiftMatch({ seed: 3, lockCombat: lock });
      try { expect(game.sim.lockCombat).toBe(lock); expect(game.snapshot().lockCombat).toBe(lock ? true : undefined); } finally { game.dispose(); }
    }
  });
  it('the objectives', () => {
    for (const kind of ['bad-blood', 'last-stand'] as const) for (const lock of [false, true]) {
      const game = new ObjectiveMatch(kind, undefined, 3, 'bots', 1, undefined, lock);
      try { expect(game.sim.lockCombat, kind).toBe(lock); expect(game.snapshot().lockCombat, kind).toBe(lock ? true : undefined); } finally { game.dispose(); }
    }
  });
  it('co-op survival', () => {
    for (const lock of [false, true]) {
      const game = new SurvivalGame({ heroes: [{ id: 'p1', fighter: 'kenzo', name: 'Kenzo' }], seed: 3, slowMotion: false, lockCombat: lock });
      expect(game.sim.lockCombat).toBe(lock);
      expect(game.snapshot().lockCombat).toBe(lock ? true : undefined);
    }
  });

  it('lets a bot its mode\'s brain drives escape no more often than the simulation\'s own bots do', () => {
    // A brain-driven defender (external, a bot) with its guard pressed in every round's window: it gets out of a round at
    // most as often as LOCK_BOT_ESCAPE allows, where a person pressing so escapes every time.
    let rounds = 0, escapes = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const sim = new ArenaSimulation({ trainingBot: false, seed, lockCombat: true, maxStamina: 225 });
      sim.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'konta', 'B', true, { x: 0, y: 0, z: 1.6 });
      const b = sim.actors.get('b')!; b.external = true;
      let seq = 0, pressAt = Infinity, held = 0;
      const send = (id: string, more: Partial<PlayerInput> = {}) => sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
      for (let i = 0; i < 60 * 3; i++) {
        if (i % 6 === 0) send('a', { attack: 'light' }); else send('a');
        if (sim.serverTime >= pressAt && held < 6) { send('b', { guard: true }); held++; } else send('b');
        sim.step();
        for (const e of sim.snapshot(true).events as CombatEvent[]) {
          if (e.kind === 'lock-gap') { rounds++; pressAt = e.serverTime + .1; held = 0; }
          if (e.kind === 'lock-escape' && e.actorId === 'b' && !e.reason) escapes++;
        }
      }
    }
    expect(rounds).toBeGreaterThan(20);
    expect(escapes / rounds).toBeLessThanOrEqual(LOCK_BOT_ESCAPE[1] + .1);
  });
});
