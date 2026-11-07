import { describe, expect, it, vi } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { SurvivalGame, PLAYER_ID, HERO, RIFT, AFFIXES } from '../src/survival/SurvivalGame';
import { Autopilot } from '../src/survival/autopilot';
import { ENEMIES, kitOf } from '../src/survival/enemies';
import { UPGRADES, offer, runStats, upgrade } from '../src/survival/upgrades';
import { BOSSES, ESCORTS, OPENERS, RANKS, RESTING, armyFor, drawBoss, rankFor, loopOf, type EscortId } from '../src/survival/bosses';
import { locationFor, dungeonFor, dungeonOrder, LOCATIONS, FINAL_ROUND } from '../src/survival/locations';
import { existsSync } from 'node:fs';
import { GRUNTS, GRUNT_INDEX, WEARS } from '../src/survival/horde/kinds';
import { GF, AFFIX_SHIFT, Horde } from '../src/survival/horde/Horde';
import type { ExternalBlow } from '../src/game/simulation';
import type { MoveDefinition } from '../src/game/moves';
import { StyleMeter } from '../src/survival/style';
import { riftLayout, RIFT_STAGES } from '../src/game/riftLayouts';
import { BOSS_VOICES, BOSS_LINE_FILES, bossLine, moveLine, ownLine } from '../src/audio/bossVoices';
import { RiftTargeting } from '../src/survival/riftTargeting';
import { SKILL_TREE, TREE_NODE, TIER_POINTS, lockOf, botPick, branchPoints, closed } from '../src/survival/skillTree';
import { SIGNATURES, AWAKENINGS, FORMS_OF_THEIR_OWN } from '../src/survival/signatures';

/** Play `seconds` of a run with the autopilot, choosing the first card of
 *  every draft, and report what happened. */
function play(game: SurvivalGame, seconds: number, skill = .7) {
  const pilot = new Autopilot(skill);
  let drafts = 0, maxAlive = 0, ticks = 0;
  for (let t = 0; t < seconds * 60; t++) {
    if (game.phase === 'draft') { const view = game.view(); game.choose(view.draft!.cards[0]); drafts++; continue; }
    if (game.phase === 'travel') { game.arrive(); continue; }
    if (game.frozen) break;
    maxAlive = Math.max(maxAlive, game.horde.alive);
    game.tick(pilot.command(game.sim.playerStates(), game.sim.serverTime, game.horde));
    ticks++;
  }
  return { drafts, maxAlive, ticks };
}
const idle = (() => { let seq = 0; return () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); })();
/** A private method, for the tests that drive the director directly. */
const call = <T,>(game: SurvivalGame, name: string, ...args: unknown[]) => (game as unknown as Record<string, (...a: unknown[]) => T>)[name](...args);

describe('arcade survival', () => {
  it('keeps the arena identical for fighters without a side, kit or mods', () => {
    // The opt-in fields are absent on a roster fighter: two bots in a room
    // resolve exactly as they did before, tick for tick.
    const run = () => {
      const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7 });
      sim.addPlayer('a', 'kenzo', 'A', true, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'gummy', 'B', true, { x: 0, y: 0, z: 3 });
      for (let i = 0; i < 600; i++) sim.step();
      return sim.snapshot().players.map(p => [p.x.toFixed(6), p.z.toFixed(6), p.hp, p.action]);
    };
    expect(run()).toEqual(run());
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7 });
    const state = sim.addPlayer('a', 'kenzo', 'A', true, { x: 0, y: 0, z: 0 });
    expect(state.team).toBeUndefined(); expect(state.enemy).toBeUndefined(); expect(state.size).toBeUndefined();
  });

  it('never lets one side hit its own', () => {
    const swing: MoveDefinition = { name: 'Swing', duration: .6, contacts: [.25], damage: 50, range: 2, radius: .6, stamina: 0, cooldown: .1, stun: .3, knockback: 3, style: 'melee' };
    const kit = { light: swing, heavy: swing, special: swing, ultimate: swing };
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, respawn: false, capacity: 20 });
    sim.addPlayer(PLAYER_ID, 'taisei', 'You', false, { x: 0, y: 0, z: 5 });
    sim.setTeam(PLAYER_ID, HERO);
    sim.addCombatant('e1', { team: RIFT, kit, maxHp: 300, spawn: { x: 0, y: 0, z: 0 }, yaw: 0 });
    sim.addCombatant('e2', { team: RIFT, kit, maxHp: 300, spawn: { x: 0, y: 0, z: 1.2 }, yaw: 0 });
    for (let i = 0; i < 90; i++) { sim.command('e1', { moveX: 0, moveZ: 0, yaw: 0, attack: i % 30 === 0 ? 'light' : undefined }); sim.command('e2', { moveX: 0, moveZ: 0, yaw: Math.PI }); sim.step(); }
    expect(sim.getPlayer('e2')!.hp).toBe(300);
    // ...and does hit the other side.
    sim.place('e1', { x: 0, y: 0, z: 3.6 }, 0);
    for (let i = 0; i < 90; i++) { sim.command('e1', { moveX: 0, moveZ: 0, yaw: 0, targetId: PLAYER_ID, attack: i === 0 ? 'light' : undefined }); sim.step(); }
    expect(sim.getPlayer(PLAYER_ID)!.hp).toBeLessThan(1000);
  });

  it('holds a boss in its poise, then breaks it', () => {
    const swing: MoveDefinition = { name: 'Slam', duration: 1, contacts: [.5], damage: 40, range: 2, radius: .6, stamina: 0, cooldown: .1, stun: .4, knockback: 5, style: 'melee' };
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, respawn: false, capacity: 8 });
    sim.addPlayer(PLAYER_ID, 'kenzo', 'You', false, { x: 0, y: 0, z: 0 });
    sim.setTeam(PLAYER_ID, HERO);
    sim.addCombatant('boss', { team: RIFT, kit: { light: swing, heavy: swing, special: swing, ultimate: swing }, maxHp: 5000, poise: 150, size: 2, spawn: { x: 0, y: 0, z: 2.2 } });
    let breaks = 0, seq = 0;
    for (let i = 0; i < 900; i++) {
      sim.submitInput(PLAYER_ID, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'boss', attack: i % 14 === 0 ? 'light' : undefined });
      sim.command('boss', { moveX: 0, moveZ: 0, yaw: Math.PI });
      sim.step();
      const events = sim.drainEvents();
      breaks += events.filter(e => e.kind === 'poise-break').length;
      const boss = sim.getPlayer('boss')!;
      if (breaks === 0) expect(['idle', 'run']).toContain(boss.action);
    }
    expect(breaks).toBeGreaterThan(0);
  });

  it("lands a crowd's blows whole: no combo scaling, and no breaker for being surrounded", () => {
    const blow: MoveDefinition = { name: 'Claw', duration: .6, contacts: [0], damage: 20, range: 1.5, radius: .5, stamina: 0, cooldown: 0, stun: .3, knockback: 2, style: 'melee' };
    const hits = (crowd: boolean) => {
      const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, respawn: false, capacity: 4 });
      sim.addPlayer(PLAYER_ID, 'kenzo', 'You', false, { x: 0, y: 0, z: 0 });
      const damage: number[] = [];
      for (let i = 0; i < 12; i++) {
        sim.strike(`g${i}`, PLAYER_ID, 'light', blow, { x: 1, y: 1, z: 0 }, true, crowd);
        sim.step();
        for (const event of sim.drainEvents()) if (event.kind === 'hit' && event.targetId === PLAYER_ID) damage.push(event.damage ?? 0);
      }
      return damage;
    };
    const crowd = hits(true), duel = hits(false);
    expect(crowd.length).toBeGreaterThan(8);
    expect(new Set(crowd).size).toBe(1);
    // The same blows as a duel's string scale down after the first few.
    expect(Math.min(...duel)).toBeLessThan(crowd[0]);
  });

  it('opens every round with a boss of its rank, escorted by its own universe', async () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 11, god: true, hunt: false, collision: await createRapierCollision(locationFor(1).location.stage) });
    const seen: string[] = [];
    for (let t = 0; t < 60 * 30 && seen.length < 1; t++) {
      if (game.phase === 'draft') { game.choose(); continue; }
      game.tick(idle());
      const boss = game.view().bosses.find(b => !b.champion);
      if (boss && !seen.includes(boss.enemy)) seen.push(boss.enemy);
    }
    const view = game.view();
    expect(view.round).toBe(1);
    const entry = BOSSES.find(b => b.id === seen[0])!;
    expect(OPENERS.has(entry.id)).toBe(true);
    expect(view.bosses[0].rank).toBe('F');
    expect(view.bosses[0].universe).toBe(entry.universe);
    // His army is his universe's: every grunt standing is of his escort's kinds
    // (or the rift's own, which squads may bring).
    for (let t = 0; t < 60 * 4; t++) game.tick(idle());
    const escort = ESCORTS[entry.escort], allowed = new Set<string>([...escort.fodder, ...escort.gunners, ...escort.brutes].map(([id]) => id));
    let counted = 0;
    for (let i = 0; i < game.horde.capacity; i++) if (game.horde.isAlive(i)) { counted++; expect(allowed.has(GRUNTS[game.horde.kind[i]].id)).toBe(true); }
    expect(counted).toBeGreaterThan(8);
    game.dispose();
  }, 60000);

  it('draws bosses by rank, F to S, without repeating one until its rank is spent', () => {
    for (const rank of RANKS) expect(BOSSES.filter(b => b.rank === rank && ENEMIES[b.id]).length).toBeGreaterThanOrEqual(2);
    expect(rankFor(1)).toBe('F'); expect(rankFor(2)).toBe('F'); expect(rankFor(3)).toBe('E'); expect(rankFor(13)).toBe('S');
    expect(loopOf(14)).toBe(0); expect(loopOf(15)).toBe(1);
    let s = 3; const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const met: string[] = [];
    const first = drawBoss(1, met, random); met.push(first.id);
    const second = drawBoss(2, met, random);
    expect(first.rank).toBe('F'); expect(second.rank).toBe('F');
    expect(second.id).not.toBe(first.id);
    // Past S, the Rift sends A and S.
    for (let i = 0; i < 20; i++) expect(['A', 'S']).toContain(drawBoss(16, [], random).rank);
  });

  it('opens on any of four bosses, Dust Sea or Cinder Requiem, and no army follows itself through ranks F and E', () => {
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      let s = seed; const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let k = 0; k < 4; k++) random(); // (a small seed's first draws are all near zero)
      const met: string[] = [], fielded: EscortId[] = [];
      for (let round = 1; round <= 4; round++) {
        const boss = drawBoss(round, met, random); met.push(boss.id);
        if (round === 1) { firsts.add(boss.id); expect(boss.rank).toBe('F'); }
        const army = armyFor(boss, round, fielded, random);
        if (round > 1) expect(army).not.toBe(fielded[fielded.length - 1]);
        fielded.push(army);
      }
    }
    expect([...firsts].sort()).toEqual([...OPENERS].sort());
    // Past rank E an army is its boss's own again.
    const lumen = BOSSES.find(b => b.id === 'lumen')!;
    expect(armyFor(lumen, 7, ['marines'], Math.random)).toBe('marines');
  });

  it('plays several rounds: bosses fall, the horde never stops, levels, skills and scores', async () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 42, autoLearn: true, collision: await createRapierCollision(dungeonFor(42, 1).location.stage) });
    // (Seven minutes: a dungeon is a minute of its horde, then its guardian, then the teleport.)
    const { drafts, maxAlive } = play(game, 420, .85);
    const view = game.view();
    expect(view.kills).toBeGreaterThan(150);
    expect(view.round).toBeGreaterThan(2);
    expect(view.score).toBeGreaterThan(20000);
    expect(maxAlive).toBeGreaterThan(20);
    // Levels are skill points, spent in the tree: no card is dealt over the fight.
    expect(game.level).toBeGreaterThan(4);
    expect(drafts).toBe(0);
    expect(view.picks.length).toBeGreaterThan(4);
    expect(view.points).toBe(0);
    // Every boss that fell is cleared out of the simulation.
    expect(game.sim.actors.size).toBeLessThan(8);
  }, 120000);

  it('ends a run when the fighter falls, with a result', () => {
    const game = new SurvivalGame({ fighter: 'konta', seed: 3, round: 9 });
    for (let t = 0; t < 60 * 400 && !game.result; t++) {
      if (game.phase === 'draft') { game.choose(); continue; }
      if (game.phase === 'travel') { game.arrive(); continue; }
      game.tick(idle());
    }
    expect(game.result).toBeDefined();
    expect(game.result!.round).toBeGreaterThanOrEqual(9);
    expect(game.phase).toBe('over');
  }, 120000);

  it('folds upgrades into stats, and deals three different cards', () => {
    const stats = runStats(['iron-fist', 'iron-fist', 'keen-eye', 'undying-will', 'ki-surge', 'ki-surge', 'storm-ki']);
    expect(stats.damage).toBeCloseTo(1.45 * 1.3, 5);
    expect(stats.crit).toBeCloseTo(.12, 5);
    expect(stats.revives).toBe(1);
    expect(stats.kiDamage).toBeCloseTo(.24, 5);
    expect(stats.storm).toBe(2);
    let s = 1; const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 60; i++) {
      const legendary = i % 5 === 0;
      const cards = offer([], random, legendary);
      expect(new Set(cards).size).toBe(cards.length);
      expect(cards.length).toBe(3);
      if (legendary) expect(upgrade(cards[0]).rarity).toBe('legendary');
      else expect(cards.every(id => upgrade(id).rarity !== 'legendary')).toBe(true);
    }
    // A card held at its maximum is never offered again.
    const maxed = Array(6).fill('iron-fist');
    for (let i = 0; i < 30; i++) expect(offer(maxed, random)).not.toContain('iron-fist');
  });

  it('has no upgrade that attacks on its own: a fighter who never moves kills nothing', () => {
    for (const id of ['art-smite', 'art-whirlwind', 'art-hellfire', 'art-meteor', 'art-frost', 'art-slash', 'evo-smite', 'spirit-blades', 'sovereign']) {
      expect(UPGRADES.find(u => u.id === id), id).toBeUndefined();
      expect(TREE_NODE.has(id), id).toBe(false);
    }
    // Every upgrade in the tree, maxed, on a fighter who stands still.
    const picks = SKILL_TREE.filter(node => !node.keystone).flatMap(node => Array(upgrade(node.id).max).fill(node.id));
    const game = new SurvivalGame({ fighter: 'taisei', seed: 8, god: true, picks, hunt: false });
    for (let t = 0; t < 60 * 20; t++) {
      if (game.phase === 'draft') { game.choose(); continue; }
      game.tick(idle());
    }
    // (The horde's own blasts may take some of it with them: none of it is the fighter's.)
    expect(game.heroes.get(PLAYER_ID)!.kills).toBe(0);
    expect(game.heroes.get(PLAYER_ID)!.dealt).toBe(0);
    game.dispose();
  }, 60000);

  it("fires a special's KI techniques where it lands", () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 4, god: true, hunt: false, picks: ['burst-point', 'burst-point', 'storm-ki', 'ki-vortex'] });
    const kinds = new Set<string>();
    let lastFeed = 0;
    for (let t = 0; t < 60 * 40; t++) {
      if (game.phase === 'draft') { game.choose(); continue; }
      const target = [...game.horde.ids].find((_, i) => game.horde.isAlive(i));
      game.tick({ ...idle(), attack: t % 20 === 0 ? 'special' : t % 6 === 0 ? 'light' : undefined, targetId: target ?? null });
      for (const item of game.view().feed) if (item.id > lastFeed) { lastFeed = item.id; kinds.add(item.kind); }
    }
    for (const kind of ['burst', 'smite', 'whirl']) expect(kinds.has(kind as never), kind).toBe(true);
    game.dispose();
  }, 60000);

  it('never holds a body in an impact freeze for long, however many blows land', () => {
    const game = new SurvivalGame({ fighter: 'taisei', seed: 3, god: true, quiet: true });
    const actor = game.sim.actors.get(PLAYER_ID)!;
    let held = 0, longest = 0;
    for (let t = 0; t < 60 * 6; t++) {
      // A blow every tick, as a crowd's and a stream of techniques' came.
      (actor as { hitstopUntil: number }).hitstopUntil = Math.max(actor.hitstopUntil, game.sim.serverTime + .12);
      game.tick(idle());
      if (game.sim.serverTime < actor.hitstopUntil) { held++; longest = Math.max(longest, held); } else held = 0;
    }
    expect(longest / 60).toBeLessThan(.3);
    game.dispose();
  }, 30000);

  it("grades the fighter's own fighting above what their upgrades do on their own, and never a massacre dull", () => {
    const passive = new StyleMeter();
    // Forty kills in two seconds by arts: the chain holds C, no more.
    for (let i = 0; i < 40; i++) { passive.kill(i * .05, false, true); passive.update(.05, i * .05); }
    expect(passive.rank).toBe(1);
    // A thousand by arts alone: S at most - SS and SSS are the fighter's own blows'.
    for (let i = 0; i < 1000; i++) { passive.kill(2 + i * .05, false, true); passive.update(.05, 2 + i * .05); }
    expect(passive.rank).toBe(4);
    // The chain broken, the grade drains again (half a minute of nothing).
    for (let i = 0; i < 600; i++) passive.update(.05, 52 + i * .05);
    expect(passive.rank).toBeLessThan(2);
    const own = new StyleMeter();
    // The same forty by the fighter's own blows, varied: the grade climbs.
    const slots = ['light', 'heavy', 'special'] as const;
    for (let i = 0; i < 40; i++) { own.hit(slots[i % 3], i * .05, i % 4 === 0, false, false); own.kill(i * .05); }
    expect(own.rank).toBeGreaterThan(3);
  });

  it('starts a probe build from real cards only', () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 2, quiet: true, picks: ['ki-surge', 'smite', 'iron-fist', 'nonsense'] });
    expect([...game.heroes.get(PLAYER_ID)!.picks]).toEqual(['ki-surge', 'iron-fist']);
    game.dispose();
  });

  it('walks the road F to S through the four places, the climax at the offering, then loops the Rift', () => {
    const at = (round: number) => locationFor(round);
    expect([1, 4].map(r => at(r).location.id)).toEqual(['burning-village', 'burning-village']);
    expect([5, 8].map(r => at(r).location.id)).toEqual(['hill-of-swords', 'hill-of-swords']);
    expect([9, 12].map(r => at(r).location.id)).toEqual(['black-fortress', 'black-fortress']);
    expect([13, FINAL_ROUND].map(r => at(r).location.id)).toEqual(['the-offering', 'the-offering']);
    expect(rankFor(13)).toBe('S'); expect(rankFor(FINAL_ROUND)).toBe('S');
    // Past S: two rounds a place, deeper each time round.
    expect(at(FINAL_ROUND + 1)).toMatchObject({ loop: 1, first: true }); expect(at(FINAL_ROUND + 1).location.id).toBe('burning-village');
    expect(at(FINAL_ROUND + 3).location.id).toBe('hill-of-swords');
    // (Round the eight places now, the four new ones after the road's own.)
    expect(at(FINAL_ROUND + 9).location.id).toBe('frozen-shrine');
    expect(at(FINAL_ROUND + 15).location.id).toBe('drowned-harbor');
    expect(at(FINAL_ROUND + 9)).toMatchObject({ loop: 1 });
    expect(at(FINAL_ROUND + 17)).toMatchObject({ loop: 2 });
    // First rounds are where the run travels; progress runs 0 to 1 through a stay.
    expect([1, 5, 9, 13].every(r => at(r).first)).toBe(true);
    expect(at(1).progress).toBe(0); expect(at(4).progress).toBe(1); expect(at(14).progress).toBe(1);
  });

  it('seals the rift when the last S-rank boss falls, then lets the Rift take the run on', () => {
    const game = new SurvivalGame({ fighter: 'taisei', seed: 5, round: FINAL_ROUND, god: true, bossHp: .02, quiet: true });
    let finale = false;
    for (let t = 0; t < 60 * 90 && game.round <= FINAL_ROUND; t++) {
      if (game.phase === 'draft') { game.choose(); continue; }
      if (game.phase === 'travel') { game.arrive(); continue; }
      // Put the boss down by hand: this checks the ending, not the fight.
      for (const record of (game as unknown as { enemies: Map<string, { id: string; boss: boolean; diedAt?: number }> }).enemies.values()) {
        const body = game.sim.actors.get(record.id)?.state;
        if (record.boss && body?.alive) game.sim.damage(record.id, body.hp + 1, PLAYER_ID, 'test');
      }
      game.tick(idle());
      if (game.view().feed.some(item => item.kind === 'finale')) finale = true;
    }
    expect(finale).toBe(true);
    expect(game.sealed).toBe(true);
    expect(game.round).toBe(FINAL_ROUND + 1);
    expect(game.view().location.loop).toBe(1);
    game.dispose();
  }, 60000);

  it('opens every place as a chapter: a panel on disk and a line for the first time and the next', () => {
    for (const place of LOCATIONS) {
      expect(existsSync(`public/assets/survival/cards/chapter-${place.id}.webp`), place.id).toBe(true);
      expect(place.line.length).toBeGreaterThan(20); expect(place.again.length).toBeGreaterThan(20);
      expect(place.again).not.toBe(place.line);
    }
  });

  it('leaves the dead on every last stand, breakable, and hangs some', () => {
    for (const stage of RIFT_STAGES) {
      const dead = riftLayout(stage).props.filter(p => p.kind === 'corpse');
      expect(dead.length, stage).toBeGreaterThan(8);
      for (const body of dead) { expect(body.breakable).toBe(true); expect(body.solid).toBe(false); }
    }
    expect(riftLayout('rift-fortress').props.filter(p => p.kind === 'gallows').length).toBe(3);
  });

  it('pays lifesteal and healing on kills out no faster than a twentieth of health a second', () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 12, quiet: true });
    const hero = game.heroes.get(PLAYER_ID)!, body = game.sim.actors.get(PLAYER_ID)!.state;
    body.hp = body.maxHp * .2;
    hero.leech = body.maxHp * 5;
    const before = body.hp;
    for (let t = 0; t < 60; t++) game.tick(idle());
    // One second: about five percent back, not the whole bank.
    expect(body.hp - before).toBeGreaterThan(body.maxHp * .04);
    expect(body.hp - before).toBeLessThan(body.maxHp * .06);
    game.dispose();
  });

  it('rerolls a hand once per reroll held', () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 21, quiet: true });
    const hero = game.heroes.get(PLAYER_ID)!;
    hero.pending = 1;
    call(game, 'openDrafts'); call(game, 'enterPhase', 'draft');
    const first = [...hero.draft!.cards];
    expect(hero.rerolls).toBe(1);
    expect(game.reroll()).toBe(true);
    expect(hero.rerolls).toBe(0);
    expect(hero.draft!.cards.length).toBe(3);
    expect(hero.draft!.cards).not.toEqual(first);
    expect(game.reroll()).toBe(false);
    game.dispose();
  });

  it('has a kit for every boss and a model for every one the rounds can draw', () => {
    for (const def of Object.values(ENEMIES)) {
      if (def.rival) continue;
      const kit = kitOf(def);
      for (const move of Object.values(kit)) { expect(move.contacts[0]).toBeLessThan(move.duration); expect(move.damage).toBeGreaterThan(0); }
    }
    for (const entry of BOSSES) if (!RESTING.has(entry.id)) expect(ENEMIES[entry.id]?.model, entry.id).toBeTruthy();
  });

  it('compounds the horde past S, so a run always ends', () => {
    const at = (round: number) => {
      const game = new SurvivalGame({ fighter: 'kenzo', seed: 2, round, quiet: true });
      game.round = round;
      const slot = call<number | undefined>(game, 'spawnGrunt', 0, { x: 5, y: 0, z: 5 }, false)!;
      const hp = game.horde.maxHp[slot], damage = game.horde.damageScale[slot];
      game.dispose();
      return { hp, damage };
    };
    const s = at(14), rift1 = at(16), rift3 = at(20);
    expect(rift1.hp / s.hp).toBeGreaterThan(1.25);
    expect(rift3.hp / rift1.hp).toBeGreaterThan(1.6);
    expect(rift3.damage / rift1.damage).toBeGreaterThan(1.35);
  });

  it('raises a boss with a second form, and ends the round only when the last form falls', () => {
    const game = new SurvivalGame({ fighter: 'taisei', seed: 5, round: 13, spawn: ['gorai'], bossHp: .01, god: true });
    const tick = () => { if (game.phase === 'draft') game.choose(); else game.tick(idle()); };
    for (let t = 0; t < 60 * 8 && !game.view().bosses.length; t++) tick();
    const first = game.view().bosses[0];
    expect(first.enemy).toBe('gorai');
    game.sim.damage(first.id, first.hp + 10, PLAYER_ID, 'Test');
    for (let t = 0; t < 30; t++) tick();
    const second = game.view().bosses.find(b => b.enemy === 'gorai-wyrm')!;
    expect(second).toBeDefined();
    expect(second.id).not.toBe(first.id);
    // The first form's record is cleared a few seconds later; the round must
    // still be the second form's (it used to read the cleared record as a
    // boss still standing, and the round never ended).
    for (let t = 0; t < 60 * 4; t++) tick();
    expect(game.roundState).toBe('battle');
    game.sim.damage(second.id, 1e7, PLAYER_ID, 'Test');
    // The last form's fall is held at the brink for its finish (FINISH IT)...
    for (let t = 0; t < 60; t++) tick();
    expect(game.roundState).toBe('battle');
    expect(game.view().bosses.find(b => b.id === second.id)?.brink).toBeGreaterThan(0);
    // ...and, unfinished, it falls when the window runs out.
    for (let t = 0; t < 60 * 6; t++) tick();
    expect(game.roundState).toBe('interlude');
    game.dispose();
  }, 60000);

  it('never launches an anchored body', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, respawn: false, seed: 3 });
    sim.addPlayer('p', 'kenzo', 'P', false, { x: 0, y: 0, z: 0 });
    const launcher: MoveDefinition = { name: 'Launcher', duration: .5, contacts: [0], damage: 10, range: 2, radius: 1, stamina: 0, cooldown: 0, stun: .5, knockback: 20, style: 'melee' };
    for (const anchored of [false, true]) {
      const id = anchored ? 'giant' : 'plain';
      sim.addCombatant(id, { team: RIFT, kit: kitOf(ENEMIES['tribunal-guard']), maxHp: 5000, spawn: { x: anchored ? 6 : -6, y: 0, z: 1.5 }, anchored, armour: false });
      sim.strike('p', id, 'heavy', launcher, { x: anchored ? 6 : -6, y: 1, z: 0 });
    }
    const states = Object.fromEntries(sim.playerStates().map(p => [p.id, p]));
    expect(states.plain.action).toBe('launched');
    expect(states.giant.action).not.toBe('launched');
  });

  it('calls down a rain of telegraphed strikes', () => {
    const game = new SurvivalGame({ fighter: 'gummy', seed: 4, round: 9, spawn: ['caldera'], bossHp: .4, god: true, quiet: true });
    for (let t = 0; t < 60 * 40 && !game.view().feed.some(item => item.kind === 'hazard'); t++) {
      if (game.phase === 'draft') { game.choose(); continue; }
      game.tick(idle());
    }
    const hazards = game.view().feed.filter(item => item.kind === 'hazard');
    expect(hazards.length).toBeGreaterThan(0);
    // Each is warned ahead of when it lands.
    for (const item of hazards) expect(item.value!).toBeGreaterThan(item.at + .5);
  }, 60000);


  it('gives no boss a withheld voice: every boss speaks the game\'s own lines, or the horde\'s own bank', () => {
    expect(BOSS_LINE_FILES).toEqual([]);
    for (const [id, voice] of Object.entries(BOSS_VOICES)) {
      expect(voice.signatures, id).toBeUndefined();
      expect(voice.timbre, id).not.toBe('fox');
      for (const move of ENEMIES[id]?.moves ?? []) { const said = moveLine(id, move.name); if (said) expect(said, `${id} ${move.name}`).toMatch(/\/assets\/audio\/survival\/voice-/); }
      for (const moment of ['entrance', 'attack', 'hurt', 'rage', 'defeat'] as const) {
        const own = ownLine(id, moment);
        if (own) { expect(own, `${id} ${moment}`).toMatch(/\/assets\/audio\/survival\/voice-/); continue; }
        const line = bossLine(id, moment);
        expect(line && 'url' in line ? line.url : '', `${id} ${moment}`).toMatch(/\/assets\/audio\/survival\/(man|beast|brute)-/);
      }
    }
  });

  it('frames a boss for its entrance, then gives the camera back', () => {
    let now = 1000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const aim = new RiftTargeting(), me = { x: 0, z: 0, yaw: 0 };
    const grunt = { id: 'g1', x: 0, y: 0, z: 1.5, radius: .4, boss: false, elite: false };
    const boss = { id: 'b1', x: 0, y: 0, z: 12, radius: .8, boss: true, elite: false };
    expect(aim.update(me, [grunt])).toBe('g1');
    expect(aim.locked).toBe(false);
    expect(aim.update(me, [grunt, boss])).toBe('b1');
    expect(aim.locked).toBe(true);
    now += 2000; expect(aim.update(me, [grunt, boss])).toBe('b1');
    now += 1500; expect(aim.update(me, [grunt, boss])).toBe('g1');
    expect(aim.locked).toBe(false);
    // Seen once is introduced once.
    now += 5000; aim.update(me, [grunt, boss]); expect(aim.locked).toBe(false);
    clock.mockRestore();
  });

  it('runs a dungeon: its horde fills the rift, then its guardian comes with a finite retinue, then the next dungeon', () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 4, god: true });
    // The run starts in its own first dungeon (drawn from the seed).
    expect(game.stage).toBe(dungeonFor(4, 1).location.stage);
    for (let t = 0; t < 60 * 6 && game.roundState !== 'horde'; t++) game.tick(idle());
    expect(game.roundState).toBe('horde');
    expect(game.view().bosses).toHaveLength(0);
    expect(game.view().dungeon!.progress).toBe(0);
    // Hordes and hordes: the field is kept full, and no boss yet.
    for (let t = 0; t < 60 * 6; t++) game.tick(idle());
    expect(game.horde.alive).toBeGreaterThan(15);
    expect(game.view().bosses.filter(b => !b.champion)).toHaveLength(0);
    // Cut down enough of them and the bar fills.
    const h = game.horde;
    for (let guard = 0; guard < 40 && game.roundState === 'horde'; guard++) {
      for (let i = 0; i < h.capacity; i++) if (h.isAlive(i)) h.damage(i, 1e7, PLAYER_ID);
      for (let t = 0; t < 30; t++) game.tick(idle());
    }
    expect(game.roundState).not.toBe('horde');
    expect(game.view().feed.some(item => item.kind === 'lair')).toBe(true);
    for (let t = 0; t < 60 * 4 && !game.view().bosses.length; t++) game.tick(idle());
    expect(game.view().bosses.length).toBeGreaterThan(0);
    // The guardian's retinue is finite: it comes through, and no more after it.
    for (let t = 0; t < 60 * 8; t++) game.tick(idle());
    const retinue = h.alive;
    for (let i = 0; i < h.capacity; i++) if (h.isAlive(i)) h.damage(i, 1e7, PLAYER_ID);
    for (let t = 0; t < 60 * 6; t++) game.tick(idle());
    expect(retinue).toBeGreaterThan(5);
    expect(h.alive).toBe(0);
    // The guardian down, the party is teleported into the next dungeon - a different place.
    const here = game.stage;
    for (const boss of game.view().bosses) game.sim.damage(boss.id, 1e7, PLAYER_ID, 'Test');
    for (let t = 0; t < 60 * 30 && game.phase !== 'travel'; t++) {
      if (game.phase === 'draft') game.choose(); else game.tick(idle());
      const fork = game.view().forks?.[0];
      if (fork) game.sim.place(PLAYER_ID, { x: fork.x, y: 0, z: fork.z }, 0);
    }
    expect(game.phase).toBe('travel');
    expect(game.travelTo).toBe(dungeonFor(4, 2).location.stage);
    expect(game.travelTo).not.toBe(here);
    game.arrive();
    expect(game.stage).toBe(dungeonFor(4, 2).location.stage);
    expect(game.view().location.name).toBe(dungeonFor(4, 2).location.name);
    game.dispose();
  }, 60000);

  it('draws each run its own order of dungeons, never the same place twice running', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const order = dungeonOrder(seed, 16);
      orders.add(order.slice(0, 4).join(','));
      for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
      // Every place once before any comes round again.
      expect(new Set(order.slice(0, LOCATIONS.length)).size).toBe(LOCATIONS.length);
    }
    expect(orders.size).toBeGreaterThan(3);
  });

  it('sends affixed elite packs as the dungeon bar fills: a stormcaller calls lightning down, a molten one erupts where it falls', () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 6, god: true, round: 5 });
    for (let t = 0; t < 60 * 6 && game.roundState !== 'horde'; t++) { if (game.phase === 'travel') game.arrive(); else game.tick(idle()); }
    expect(game.roundState).toBe('horde');
    type Pack = { id: number; elite: boolean; affix?: string; leader?: number; awake: boolean };
    const internals = game as unknown as { packs: Pack[]; riftKills: number; riftWant: number };
    expect(internals.packs).toHaveLength(0);
    internals.riftKills = internals.riftWant * .35;
    game.tick(idle());
    const elites = internals.packs.filter(pack => pack.elite);
    expect(elites.length).toBe(1);
    expect(game.view().feed.some(item => item.kind === 'elite')).toBe(true);
    const pack = elites[0];
    expect(AFFIXES).toContain(pack.affix);
    const h = game.horde, slot = h.slotOf(pack.leader!)!;
    expect(h.flags[slot] & GF.ELITE).toBeTruthy();
    expect((h.flags[slot] & GF.AFFIX) >> AFFIX_SHIFT).toBe(AFFIXES.indexOf(pack.affix as never) + 1);
    // A stormcaller beside the fighter rings its strikes round them.
    pack.affix = 'storm';
    game.sim.place(PLAYER_ID, { x: h.x[slot] + 4, y: 0, z: h.z[slot] }, 0);
    let seen = 0;
    for (let t = 0; t < 60 * 6; t++) { game.tick(idle()); seen = Math.max(seen, game.view().feed.filter(item => item.kind === 'hazard' && item.text === 'lightning').length); }
    expect(seen).toBeGreaterThanOrEqual(3);
    // A molten one, cut down, leaves the ground to erupt.
    pack.affix = 'molten';
    h.damage(slot, 1e7, PLAYER_ID);
    expect(game.view().feed.some(item => item.kind === 'hazard' && item.text === 'magma')).toBe(true);
    game.dispose();
  }, 60000);

  it('spends skill points in a tree: deeper tiers open with points in their branch', () => {
    // Every upgrade is a node, in one of three branches, four tiers deep.
    for (const def of UPGRADES) expect(TREE_NODE.has(def.id)).toBe(true);
    for (const branch of ['blade', 'ki', 'body'] as const) for (const tier of [0, 1, 2, 3]) expect(SKILL_TREE.some(node => node.branch === branch && node.tier === tier)).toBe(true);
    for (const node of SKILL_TREE) expect(node.line.length).toBeLessThanOrEqual(34);
    expect(lockOf([], 'iron-fist')).toBeUndefined();
    expect(lockOf([], 'burning-blade')).toBe(`${TIER_POINTS[1]} more in BLADE`);
    // Points in another branch open nothing here.
    expect(lockOf(['tough-body', 'tough-body', 'guardian'], 'burning-blade')).toBeDefined();
    expect(lockOf(['iron-fist', 'iron-fist', 'keen-eye'], 'burning-blade')).toBeUndefined();
    expect(lockOf(['iron-fist', 'iron-fist', 'keen-eye', 'burning-blade'], 'thunder-chain')).toMatch(/flame/);
    expect(closed(['burning-blade'], 'thunder-chain')).toBe(true);
    expect(closed(['blazing-ki'], 'storm-ki')).toBe(true);
    expect(closed(['blazing-ki'], 'ki-vortex')).toBe(false);
    const twelve = [...Array(6).fill('iron-fist'), ...Array(4).fill('keen-eye'), 'burning-blade', 'executioner'];
    expect(lockOf(twelve, 'limit-break')).toBeUndefined();
    expect(lockOf([...twelve, 'limit-break'], 'god-speed')).toMatch(/one key passive/);
    for (const fork of new Set(SKILL_TREE.map(node => node.fork).filter(Boolean))) expect(SKILL_TREE.filter(node => node.fork === fork).length).toBe(2);
    // A bot spends by shares, never where it may not.
    const picks: string[] = [];
    for (let i = 0; i < 60; i++) { const id = botPick(picks)!; expect(lockOf(picks, id)).toBeUndefined(); picks.push(id); }
    expect(branchPoints(picks, 'ki')).toBeGreaterThan(12);
    expect(branchPoints(picks, 'blade')).toBeGreaterThan(12);
    expect(branchPoints(picks, 'body')).toBeGreaterThan(8);
  });

  it('holds a solo run while its tree is open, and learns a node only with a point for it', () => {
    const game = new SurvivalGame({ fighter: 'kenzo', seed: 5, god: true });
    for (let t = 0; t < 60 * 12 && game.phase !== 'fight'; t++) { if (game.phase === 'travel') game.arrive(); else game.tick(idle()); }
    expect(game.phase).toBe('fight');
    game.choose('tree:open');
    expect(game.phase).toBe('draft');
    expect(game.view().treeOpen).toBe(true);
    const time = game.sim.serverTime;
    for (let t = 0; t < 30; t++) game.tick(idle());
    expect(game.sim.serverTime).toBe(time);
    // No point, no skill.
    game.choose('tree:iron-fist');
    expect(game.view().picks).toEqual([]);
    const hero = game.heroes.get(PLAYER_ID)!;
    hero.points = 2;
    game.choose('tree:burning-blade');
    expect(game.view().picks).toEqual([]);
    game.choose('tree:iron-fist');
    expect(game.view().picks).toEqual(['iron-fist']);
    expect(game.view().points).toBe(1);
    expect(game.view().feed.some(item => item.kind === 'learn' && item.text === 'IRON FIST')).toBe(true);
    game.choose('tree:close');
    expect(game.phase).toBe('fight');
    game.dispose();
  });

  it('asks a sealed run to end it or go deeper, and ends it as a victory', () => {
    const game = new SurvivalGame({ fighter: 'taisei', seed: 5, round: FINAL_ROUND, god: true, bossHp: .02, quiet: true });
    let asked = false;
    for (let t = 0; t < 60 * 90 && game.phase !== 'over'; t++) {
      if (game.phase === 'draft') {
        const draft = game.view().draft;
        if (draft?.finale) { asked = true; expect(draft.cards).toEqual(['finale-end', 'finale-deeper']); game.choose('finale-end'); continue; }
        game.choose(); continue;
      }
      if (game.phase === 'travel') { game.arrive(); continue; }
      for (const record of (game as unknown as { enemies: Map<string, { id: string; boss: boolean }> }).enemies.values()) {
        const body = game.sim.actors.get(record.id)?.state;
        if (record.boss && body?.alive) game.sim.damage(record.id, body.hp + 1, PLAYER_ID, 'test');
      }
      game.tick(idle());
    }
    expect(asked).toBe(true);
    expect(game.phase).toBe('over');
    expect(game.result?.victory).toBe(true);
    expect(game.result?.sealed).toBe(true);
    // The score stops with the run.
    const score = game.score; game.score += 1000; expect(game.score).toBe(score);
    game.dispose();
  }, 60000);
});

describe('boss signatures, awakenings, finishers and team ultimates (the fifth list)', () => {
  const records = (game: SurvivalGame) => (game as unknown as { enemies: Map<string, { id: string; boss: boolean; brink?: object; illusion?: object; def: { id: string } }> }).enemies;
  const bossOf = (game: SurvivalGame) => [...records(game).values()].find(record => record.boss && !record.illusion)!;
  const fight = (boss: string, extra: Partial<ConstructorParameters<typeof SurvivalGame>[0]> = {}) => {
    const game = new SurvivalGame({ fighter: 'taisei', seed: 7, round: 9, spawn: [boss], god: true, slowMotion: false, ...extra });
    for (let t = 0; t < 60 * 6 && !game.view().bosses.length; t++) game.tick(idle());
    return game;
  };

  it('gives every boss of the road a signature and an awakened form', () => {
    for (const entry of BOSSES) {
      expect(SIGNATURES[entry.id]?.length, entry.id).toBeGreaterThan(0);
      if (!FORMS_OF_THEIR_OWN.has(entry.id)) expect(AWAKENINGS[entry.id]?.name, entry.id).toBeTruthy();
    }
  });

  it('calls a boss signature out and puts it on the field', () => {
    const game = fight('caldera');
    const kinds = new Set<string>();
    for (let t = 0; t < 60 * 30; t++) { game.tick(idle()); for (const item of game.view().feed) kinds.add(item.kind); if (game.phase === 'draft') game.choose(); }
    expect(kinds.has('signature')).toBe(true);
    expect(kinds.has('pool')).toBe(true);
    game.dispose();
  }, 60000);

  it('awakens a boss at half its health: named, and held a moment while it bursts', () => {
    const game = fight('zarek');
    const boss = game.view().bosses[0];
    game.sim.damage(boss.id, boss.maxHp * .55, PLAYER_ID, 'Test');
    for (let t = 0; t < 10; t++) game.tick(idle());
    const view = game.view();
    expect(view.bosses[0].form).toBe(AWAKENINGS.zarek.name);
    expect(view.feed.some(item => item.kind === 'enraged' && item.value === 3 && item.text === AWAKENINGS.zarek.name)).toBe(true);
    game.dispose();
  }, 60000);

  it('holds a boss at the brink on its last blow, and an ultimate on it is its finisher', () => {
    const game = fight('lumen');
    const boss = game.view().bosses[0];
    game.sim.damage(boss.id, boss.hp + 50, PLAYER_ID, 'Test');
    for (let t = 0; t < 5; t++) game.tick(idle());
    let view = game.view();
    expect(view.bosses.find(b => b.id === boss.id)?.brink).toBeGreaterThan(0);
    expect(view.feed.some(item => item.kind === 'finish')).toBe(true);
    // Every fighter's ultimate filled and ready for it.
    const me = game.sim.playerStates().find(p => p.id === PLAYER_ID)!;
    expect(me.ultimate).toBe(100);
    expect(me.cooldowns.ultimate).toBeLessThanOrEqual(game.sim.serverTime);
    // Nothing else fells it.
    game.sim.damage(boss.id, 1e6, PLAYER_ID, 'Test');
    for (let t = 0; t < 5; t++) game.tick(idle());
    expect(game.roundState).toBe('battle');
    // An ultimate landing on it does.
    const record = bossOf(game), hero = game.heroes.get(PLAYER_ID)!;
    call(game, 'finishing', record, hero, 99);
    for (let t = 0; t < 20; t++) game.tick(idle());
    view = game.view();
    expect(view.feed.some(item => item.kind === 'finisher')).toBe(true);
    expect(game.finished).toBe(1);
    expect(hero.finishers).toBe(1);
    game.dispose();
  }, 60000);

  it('lands a team ultimate when two fighters ultimate one boss together', () => {
    const game = new SurvivalGame({ heroes: [{ id: 'a', fighter: 'taisei', name: 'A' }, { id: 'b', fighter: 'gummy', name: 'B' }], seed: 3, round: 9, spawn: ['rime'], god: true, slowMotion: false });
    for (let t = 0; t < 60 * 6 && !game.view().bosses.length; t++) game.step();
    const record = bossOf(game), before = game.view().bosses[0].hp;
    call(game, 'teamUltimate', record, game.heroes.get('a'));
    call(game, 'teamUltimate', record, game.heroes.get('b'));
    const view = game.view();
    expect(view.feed.some(item => item.kind === 'team')).toBe(true);
    expect(view.bosses[0].hp).toBeLessThan(before);
    expect(game.heroes.get('a')!.teamUltimates).toBe(1);
    game.dispose();
  }, 60000);

  it('makes copies of Shiun with no bar of their own, which break like glass', () => {
    const game = fight('shiun');
    const record = bossOf(game), body = game.sim.playerStates().find(p => p.id === record.id)!;
    const copy = call<string>(game, 'spawnIllusion', record.id, { x: body.x + 4, y: 0, z: body.z }, 10);
    const view = game.view();
    expect(view.bosses.find(b => b.id === copy)?.illusion).toBe(true);
    expect(game.isChampion(copy)).toBe(true);
    expect(game.isBoss(copy)).toBe(false);
    game.sim.damage(copy, 1e6, PLAYER_ID, 'Test');
    for (let t = 0; t < 3; t++) game.tick(idle());
    expect(records(game).has(copy)).toBe(false);
    expect(game.view().feed.some(item => item.kind === 'shatter')).toBe(true);
    game.dispose();
  }, 60000);
});

describe("the road's fork after a boss (the fifth list)", () => {
  it('opens three rifts after a boss; walking into one takes it, and the next round is that path', () => {
    const game = new SurvivalGame({ fighter: 'taisei', seed: 21, round: 3, god: true, slowMotion: false });
    const tick = () => { if (game.phase === 'draft') game.choose(); else if (game.phase === 'travel') game.arrive(); else game.tick(idle()); };
    for (let t = 0; t < 60 * 5 && game.roundState !== 'horde'; t++) tick();
    expect(game.roundState).toBe('horde');
    // Its bar full: the guardian comes.
    const internals = game as unknown as { riftKills: number; riftWant: number };
    internals.riftKills = internals.riftWant;
    for (let t = 0; t < 60 * 6 && !game.view().bosses.some(b => !b.champion); t++) tick();
    const boss = game.view().bosses.find(b => !b.champion)!;
    expect(boss).toBeDefined();
    game.sim.damage(boss.id, 1e7, PLAYER_ID, 'Test');
    let view = game.view();
    for (let t = 0; t < 60 * 12 && !view.forks?.length; t++) { tick(); view = game.view(); }
    expect(view.forks?.length).toBe(3);
    expect(view.feed.some(item => item.kind === 'paths')).toBe(true);
    const fork = view.forks![0];
    game.sim.place(PLAYER_ID, { x: fork.x, y: 0, z: fork.z }, 0);
    for (let t = 0; t < 3; t++) tick();
    view = game.view();
    expect(view.feed.some(item => item.kind === 'path' && item.text === fork.kind)).toBe(true);
    expect(view.pathNext).toBe(fork.kind);
    // On to the next place, and its round is that path's.
    for (let t = 0; t < 60 * 10 && game.round < 4; t++) tick();
    expect(game.round).toBe(4);
    expect(game.path).toBe(fork.kind);
    game.dispose();
  }, 60000);

  it('makes a cursed round harder and pays it double', () => {
    const plain = new SurvivalGame({ fighter: 'taisei', seed: 4, round: 6, god: true });
    const cursed = new SurvivalGame({ fighter: 'taisei', seed: 4, round: 6, god: true });
    cursed.path = 'cursed';
    const hp = (game: SurvivalGame) => { const slot = call<number>(game, 'spawnGrunt', 0, { x: 4, y: 0, z: 4 }, false); return game.horde.maxHp[slot]; };
    expect(hp(cursed) / hp(plain)).toBeGreaterThan(1.25);
    const before = cursed.score; cursed.score += 100; expect(cursed.score - before).toBe(200);
    plain.dispose(); cursed.dispose();
  });
});

describe("the fifth list's rank and file: shields, healers, summoners, snipers, divers", () => {
  const make = (hero = { x: 0, z: 0 }) => {
    let seed = 11;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    const struck: string[] = [], summoned: number[] = [];
    const horde = new Horde(random, { strike: (_g, _h, move) => struck.push(move.name), killed: () => {}, summon: (_slot, n) => summoned.push(n) });
    horde.setWorld({ halfX: 40, halfZ: 40, circles: [], boxes: [] });
    horde.heroes = [{ id: 'you', x: hero.x, y: 0, z: hero.z, standing: true, airborne: false }];
    let now = 0;
    const step = (seconds: number) => { for (let t = 0; t < seconds * 60; t++) { now += 1 / 60; horde.step(1 / 60, now); } };
    const spawn = (id: string, x: number, z: number, yaw = 0) => horde.spawn(GRUNT_INDEX.get(id)!, x, z, { yaw, dormant: true, pack: 1 })!;
    return { horde, struck, summoned, step, spawn };
  };
  const blow = (slot: 'light' | 'heavy', pushZ: number): ExternalBlow => ({ attackerId: 'you', slot, move: { name: 'Test', duration: .3, contacts: [0], damage: 50, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: .3, knockback: 3, style: 'melee' },
    damage: 50, critical: false, finisher: false, pushX: 0, pushZ, knockback: 3, stun: .3, launch: false, hitstop: 0 });

  it('blocks what comes at a shield-bearer\'s front, until a heavy breaks the shield', () => {
    const { horde, spawn } = make();
    const slot = spawn('tribunal-guard-shield', 0, 5, Math.PI);
    const body = { id: horde.ids[slot], x: 0, y: 0, z: 5, radius: .5, height: 1.8, airborne: false };
    const before = horde.hp[slot];
    const light = horde.receive(body, blow('light', 1))!;
    expect(light.damage).toBeLessThan(10);
    expect(horde.hp[slot]).toBeGreaterThan(before - 10);
    expect(horde.flags[slot] & GF.BROKEN).toBe(0);
    const heavy = horde.receive(body, blow('heavy', 1))!;
    expect(heavy.reaction).toBe('stun');
    expect(horde.flags[slot] & GF.BROKEN).toBe(GF.BROKEN);
    // From behind, nothing is turned.
    const other = spawn('tribunal-guard-shield', 0, 5, 0);
    expect(horde.receive({ ...body, id: horde.ids[other] }, blow('light', 1))!.damage).toBe(50);
  });

  it('has a healer mend its hurt kind round it', () => {
    const { horde, step, spawn } = make({ x: 0, z: 8 });
    spawn('medic-ninja', 0, 0);
    const hurt = spawn('white-pale-sapling', 1.5, 0);
    horde.wake(1);
    horde.hp[hurt] = horde.maxHp[hurt] * .3;
    step(8);
    expect(horde.hp[hurt]).toBeGreaterThan(horde.maxHp[hurt] * .45);
  });

  it('has a summoner call more of its army through a rift', () => {
    const { horde, summoned, step, spawn } = make({ x: 0, z: 12 });
    spawn('hollow-caller', 0, 0); horde.wake(1);
    step(10);
    expect(summoned.length).toBeGreaterThan(0);
  });

  it('has a sniper take its long shot from far back', () => {
    const { horde, struck, step, spawn } = make({ x: 0, z: 20 });
    spawn('tribunal-guard-sniper', 0, 0); horde.wake(1);
    step(8);
    expect(struck).toContain('Long Shot');
  });

  it('has a diver come down on its fighter out of the air', () => {
    const { horde, struck, step, spawn } = make({ x: 0, z: 7 });
    const slot = spawn('hollow-diver', 0, 0); horde.wake(1);
    let highest = 0;
    for (let t = 0; t < 8 * 60; t++) { step(1 / 60); highest = Math.max(highest, horde.y[slot]); }
    expect(highest).toBeGreaterThan(1);
    expect(struck).toContain('Dive');
  });

  it('gives every army its new ways to fight, and every new kind a body it wears', () => {
    for (const [id, escort] of Object.entries(ESCORTS)) expect(escort.specials?.length, id).toBeGreaterThan(0);
    for (const [kind, body] of Object.entries(WEARS)) { expect(GRUNT_INDEX.has(kind), kind).toBe(true); expect(GRUNT_INDEX.has(body), body).toBe(true); }
  });
});
