import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import type { CombatEvent, PlayerInput } from '../src/game/types';
import { ULTIMATE_COST } from '../src/game/moves';
import { LEVEL_TOP } from '../src/game/adaptive';

/** bots that play better rather than hit harder - they punish a swing that is over while
 *  its thrower is still in the recovery (simulation.ts botPunish) and meet a jump at them (botAntiAir). The classic bot
 *  (Actor.botClassic, bot_strength.mts's control) does neither. */
afterEach(() => vi.restoreAllMocks());
type Sim = ArenaSimulation & { actors: Map<string, { botSkill: number; botClassic?: boolean; nextBotThink: number; state: { x: number; z: number; ultimate: number } }> };
function arena(classic: boolean, seed = 11, fighter: 'kenzo' | 'taisei' = 'kenzo') {
  const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, lockCombat: true, seed }) as Sim;
  sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('bot', 'kenzo', 'Bot', true, { x: 0, y: 0, z: -2.8 });
  sim.startMatch();
  // (held at skill 1 - a bot left to the adaptive difficulty takes its level from the player.)
  sim.setBotSkill('bot', 1);
  const bot = sim.actors.get('bot')!; if (classic) bot.botClassic = true;
  let seq = 0;
  // Its thinking clock held off (it would walk in and swing of its own accord): what is measured is the reflex alone.
  const input = (more: Partial<PlayerInput> = {}) => { bot.nextBotThink = Infinity; sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more }); };
  return { sim, input };
}
const presses = () => {
  const proto = ArenaSimulation.prototype as unknown as { botPress: (...args: unknown[]) => boolean };
  const spy = vi.spyOn(proto, 'botPress');
  return spy;
};

describe('bots that play better', () => {
  it('punish a special thrown at nothing, in its recovery; the classic bot never does', () => {
    for (const classic of [false, true]) {
      // Taisei's Sunpalm Cannon, a beam: nothing of it flies on after its blow, so a blow in its recovery is a PUNISH.
      const spy = presses(), { sim, input } = arena(classic, 11, 'taisei');
      const hits: CombatEvent[] = [];
      try {
        // The player faces away from the bot and throws a special at the air, again and again, put back where they stood.
        for (let t = 0; t < 60 * 24; t++) {
          if (t % 150 === 30) { const me = sim.actors.get('me')!, bot = sim.actors.get('bot')!; me.state.x = 0; me.state.z = 0; bot.state.x = 0; bot.state.z = -2.2; input({ attack: 'special', targetId: '' }); }
          else input();
          sim.step();
          for (const e of sim.snapshot(true).events) if (e.kind === 'hit' && e.actorId === 'bot') hits.push(e);
        }
      } finally { sim.dispose(); }
      if (classic) expect(spy, 'the classic bot').not.toHaveBeenCalled();
      else {
        expect(spy.mock.calls.length, 'punishes pressed').toBeGreaterThanOrEqual(4);
        expect(hits.filter(e => e.punish).length, 'and landed, as PUNISH').toBeGreaterThanOrEqual(3);
      }
      spy.mockRestore();
    }
  });
  it('meets a jump at it', () => {
    const spy = presses(), { sim, input } = arena(false, 4);
    try {
      for (let t = 0; t < 60 * 12; t++) {
        // A hop toward the bot from a few metres out, every second and a half.
        if (t % 90 === 20) { const me = sim.actors.get('me')!, bot = sim.actors.get('bot')!; me.state.x = 0; me.state.z = 0; bot.state.x = 0; bot.state.z = -3.2; }
        input(t % 90 === 21 ? { jump: true, moveZ: -1, yaw: Math.PI } : t % 90 > 21 && t % 90 < 50 ? { moveZ: -1, yaw: Math.PI } : {});
        sim.step();
      }
    } finally { sim.dispose(); }
    const anti = spy.mock.calls.filter(call => (call[3] ?? 'n') === 'b' || call[2] === 'light');
    expect(anti.length).toBeGreaterThanOrEqual(2);
  });
  // the top level punishes a recovery with the heaviest blow that lands in it - its
  // ultimate on a full bar - where the skill-1 bot throws a heavy or a light.
  it('punish with the ultimate at the top level, on a full bar; the skill-1 bot does not', () => {
    for (const top of [true, false]) {
      const spy = presses(), { sim, input } = arena(false, 11, 'taisei');
      if (top) sim.setBotLevel('bot', LEVEL_TOP);
      try {
        for (let t = 0; t < 60 * 24; t++) {
          if (t % 150 === 30) { const me = sim.actors.get('me')!, bot = sim.actors.get('bot')!; me.state.x = 0; me.state.z = 0; bot.state.x = 0; bot.state.z = -2.2; bot.state.ultimate = ULTIMATE_COST; input({ attack: 'special', targetId: '' }); }
          else input();
          sim.step();
        }
      } finally { sim.dispose(); }
      const big = spy.mock.calls.filter(call => call[2] === 'ultimate').length;
      if (top) expect(big, 'the top level').toBeGreaterThanOrEqual(1);
      else expect(big, 'the skill-1 bot').toBe(0);
      spy.mockRestore();
    }
  });
});
