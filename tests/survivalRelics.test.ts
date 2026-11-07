import { describe, expect, it } from 'vitest';
import { SurvivalGame, PLAYER_ID, isProc } from '../src/survival/SurvivalGame';
import { BOSSES } from '../src/survival/bosses';
import { SIGNATURES } from '../src/survival/signatures';
import { RELICS, RELIC_LEAVE, RELIC_SLOTS, giveCard, givenOf, relicOf } from '../src/survival/relics';
import type { CombatEvent } from '../src/game/types';

/** Boss relics (relics.ts): the overhaul's Phase 4, item 2. */
const idle = (() => { let seq = 0; return () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); })();
const call = <T,>(game: SurvivalGame, name: string, ...args: unknown[]) => (game as unknown as Record<string, (...a: unknown[]) => T>)[name](...args);
type Record_ = { id: string; boss: boolean; illusion?: object; def: { id: string } };
const records = (game: SurvivalGame) => (game as unknown as { enemies: Map<string, Record_> }).enemies;
const bossOf = (game: SurvivalGame) => [...records(game).values()].find(record => record.boss && !record.illusion)!;
const fight = (boss: string, relics?: string[], quiet = true) => {
  const game = new SurvivalGame({ fighter: 'taisei', seed: 7, round: 9, spawn: [boss], god: true, slowMotion: false, quiet, ...(relics ? { relics } : {}) });
  for (let t = 0; t < 60 * 6 && !game.view().bosses.length; t++) game.tick(idle());
  return game;
};
const relicFeed = (game: SurvivalGame, sub: string) => game.view().feed.filter(item => item.kind === 'relic' && item.sub === sub);
const event = (kind: CombatEvent['kind'], actorId: string, extra: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1e6 + Math.floor(Math.random() * 1e6), kind, serverTime: 0, actorId, ...extra });

describe('boss relics', () => {
  it('gives ten bosses of the road a relic of their own signature', () => {
    expect(RELICS.length).toBe(10);
    expect(new Set(RELICS.map(relic => relic.id)).size).toBe(RELICS.length);
    for (const relic of RELICS) {
      expect(BOSSES.some(entry => entry.id === relic.id), relic.id).toBe(true);
      expect(SIGNATURES[relic.id]?.length, relic.id).toBeGreaterThan(0);
      expect(relic.text.length, relic.id).toBeLessThan(140);
    }
    for (const rank of ['F', 'E', 'D', 'C', 'B', 'A', 'S']) expect(RELICS.some(relic => BOSSES.find(entry => entry.id === relic.id)?.rank === rank), rank).toBe(true);
    for (const id of ['caldera', 'oro', 'kuromitsu']) expect(relicOf(id), id).toBeTruthy();
    expect(givenOf(giveCard('oro'))).toBe('oro');
    expect(givenOf(RELIC_LEAVE)).toBeUndefined();
  });

  it('leaves a fallen boss relic in a free slot, once', () => {
    const game = fight('caldera');
    const hero = game.heroes.get(PLAYER_ID)!;
    call(game, 'bossDown', bossOf(game), hero);
    expect(hero.relics).toEqual(['caldera']);
    const left = relicFeed(game, 'taken');
    expect(left.length).toBe(1);
    expect(left[0].text).toBe('caldera');
    expect(left[0].x).toBeDefined();
    // Met again (the Rift's depths), it is not left twice.
    call(game, 'bossDown', bossOf(game), hero);
    expect(hero.relics).toEqual(['caldera']);
    expect(game.view().relics).toEqual(['caldera']);
    game.dispose();
  }, 60000);

  it('asks which of three to give up for a fourth, or leaves it', () => {
    const game = fight('caldera', ['oro', 'kuromitsu', 'magatsu']);
    const hero = game.heroes.get(PLAYER_ID)!;
    expect(hero.relics.length).toBe(RELIC_SLOTS);
    call(game, 'bossDown', bossOf(game), hero);
    expect(hero.relics).not.toContain('caldera');
    expect(hero.relicsWaiting).toEqual(['caldera']);
    // The draft opens once the fall has had the screen.
    for (let t = 0; t < 60 * 5 && game.phase !== 'draft'; t++) game.tick(idle());
    expect(game.phase).toBe('draft');
    const draft = game.view().draft!;
    expect(draft.relic).toBe('caldera');
    expect(draft.cards).toEqual([giveCard('oro'), giveCard('kuromitsu'), giveCard('magatsu'), RELIC_LEAVE]);
    // No reroll on it.
    expect(game.reroll()).toBe(false);
    game.choose(giveCard('kuromitsu'));
    expect(hero.relics).toEqual(['oro', 'caldera', 'magatsu']);
    expect(game.phase).toBe('fight');
    expect(relicFeed(game, 'taken').some(item => item.text === 'caldera' && item.enemy === 'kuromitsu')).toBe(true);
    game.dispose();
  }, 60000);

  it('keeps what is held when the question goes unanswered', () => {
    const game = fight('caldera', ['oro', 'kuromitsu', 'magatsu']);
    const hero = game.heroes.get(PLAYER_ID)!;
    call(game, 'bossDown', bossOf(game), hero);
    for (let t = 0; t < 60 * 5 && game.phase !== 'draft'; t++) game.tick(idle());
    game.autoChoose();
    expect(hero.relics).toEqual(['oro', 'kuromitsu', 'magatsu']);
    expect(relicFeed(game, 'left').length).toBe(1);
    expect(game.phase).toBe('fight');
    game.dispose();
  }, 60000);

  it('counts a run begun with relics as a probe', () => {
    const game = fight('caldera', ['oro']);
    expect(call<{ probe?: boolean }>(game, 'resultFor', game.heroes.get(PLAYER_ID)).probe).toBe(true);
    game.dispose();
  }, 60000);

  it('sets its powers off on what the fighter does, and never on its own blows', () => {
    for (const name of ['Quake', 'Black Crescent', 'Long Winter', 'Molten Rake', 'Funeral Howl', 'Stilling Palm', 'Tar Thrust', 'Hex Slashes']) expect(isProc(name), name).toBe(true);
    const game = fight('lumen', ['caldera', 'haldor', 'rime']);
    const hero = game.heroes.get(PLAYER_ID)!, boss = bossOf(game);
    const zones = () => (game as unknown as { zones: { magma?: boolean }[] }).zones;
    // MAGMA FIST and QUAKE on a heavy blow; each waits its gap.
    call(game, 'onHeroHit', hero, boss.id, undefined, 'heavy', 200);
    expect(zones().filter(zone => zone.magma).length).toBe(1);
    expect(relicFeed(game, 'quake').length).toBe(1);
    expect(game.view().feed.filter(item => item.kind === 'fissure' && item.hero === PLAYER_ID).length).toBe(6);
    call(game, 'onHeroHit', hero, boss.id, undefined, 'heavy', 200);
    expect(zones().filter(zone => zone.magma).length).toBe(1);
    // WINTER SLEEP on a special: the boss held a moment.
    call(game, 'onHeroHit', hero, boss.id, undefined, 'special', 200);
    expect(game.view().feed.some(item => item.kind === 'frost' && item.hero === PLAYER_ID)).toBe(true);
    const actor = game.sim.actors.get(boss.id)!;
    expect(actor.freezeUntil).toBeGreaterThan(game.sim.serverTime);
    // The magma burns what stands in it.
    const before = game.view().bosses[0].hp;
    for (let t = 0; t < 90; t++) game.tick(idle());
    expect(game.view().bosses[0].hp).toBeLessThan(before);
    game.dispose();
  }, 60000);

  it('stops time on the ultimate (HUSH)', () => {
    const game = fight('lumen', ['oro'], false);
    for (let t = 0; t < 60 * 4 && game.horde.alive < 5; t++) game.tick(idle());
    const hero = game.heroes.get(PLAYER_ID)!, boss = bossOf(game);
    call(game, 'relicEvent', hero, event('cast', PLAYER_ID, { slot: 'ultimate' }));
    expect(game.view().stopped).toBeGreaterThan(1.9);
    expect(relicFeed(game, 'stop').length).toBe(1);
    expect(game.sim.actors.get(boss.id)!.freezeUntil).toBeGreaterThan(game.sim.serverTime + 1.9);
    const h = game.horde as unknown as { stopUntil: Float64Array; capacity: number; isAlive(i: number): boolean };
    let held = 0;
    for (let i = 0; i < h.capacity; i++) if (h.isAlive(i) && h.stopUntil[i] > game.sim.serverTime + 1.5) held++;
    expect(held).toBeGreaterThan(0);
    for (let t = 0; t < 130; t++) game.tick(idle());
    expect(game.view().stopped).toBeUndefined();
    game.dispose();
  }, 60000);

  it('sees the next blow coming and answers it (FUTURE SIGHT)', () => {
    const game = fight('lumen', ['kuromitsu']);
    const hero = game.heroes.get(PLAYER_ID)!, boss = bossOf(game);
    game.tick(idle());
    expect(hero.foresight).toBe(true);
    expect(game.sim.actors.get(PLAYER_ID)!.evadeUntil).toBeGreaterThan(game.sim.serverTime);
    call(game, 'relicEvent', hero, event('dodge', boss.id, { targetId: PLAYER_ID }));
    expect(hero.foresight).toBe(false);
    expect(relicFeed(game, 'mochi').length).toBe(1);
    // A just guard answers too.
    call(game, 'relicEvent', hero, event('just-guard', boss.id, { targetId: PLAYER_ID }));
    expect(relicFeed(game, 'mochi').length).toBe(2);
    game.dispose();
  }, 60000);

  it('opens the dome with the awakening and cuts while it is open (MIRROR MERE)', () => {
    const game = fight('lumen', ['magatsu']);
    const hero = game.heroes.get(PLAYER_ID)!;
    const me = game.sim.actors.get(PLAYER_ID)!;
    me.state.awakened = true; me.state.awakenedUntil = game.sim.serverTime + 8;
    call(game, 'relicEvent', hero, event('awaken', PLAYER_ID));
    expect(relicFeed(game, 'shrine').length).toBe(1);
    const boss = bossOf(game), body = game.sim.playerStates().find(p => p.id === boss.id)!;
    game.sim.place(PLAYER_ID, { x: body.x + 3, y: 0, z: body.z });
    for (let t = 0; t < 60; t++) game.tick(idle());
    expect(relicFeed(game, 'cut').length).toBeGreaterThan(0);
    game.dispose();
  }, 60000);

  it('howls when the crowd closes in, and ends a dash in a stilling palm', () => {
    const game = fight('lumen', ['harrow', 'kade', 'zarek']);
    const hero = game.heroes.get(PLAYER_ID)!;
    const me = game.sim.playerStates().find(p => p.id === PLAYER_ID)!;
    call(game, 'howl', hero, me);
    expect(game.view().feed.some(item => item.kind === 'wave' && item.hero === PLAYER_ID)).toBe(true);
    call(game, 'relicUpkeep', hero, { ...me, action: 'dash', actionStarted: 5 });
    call(game, 'relicUpkeep', hero, { ...me, action: 'idle', actionStarted: 6 });
    expect(relicFeed(game, 'iron-shock').length).toBe(1);
    // AVALANCHE on the 8th hit of a combo.
    game.sim.actors.get(PLAYER_ID)!.state.combo = 8;
    call(game, 'onHeroHit', hero, bossOf(game).id, undefined, 'light', 40);
    expect(relicFeed(game, 'claws').length).toBe(1);
    game.dispose();
  }, 60000);
});
