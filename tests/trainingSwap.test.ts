import '../src/originals/launch';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { BODY_SIZE, MOVES } from '../src/game/moves';
import { HELD } from '../src/game/economy/fighters';
import { RELEASED_FIGHTERS, isReleasedFighter } from '../src/game/rosterAvailability';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';
import { LocalTraining } from '../src/network';
import { ForgeSession } from '../src/engine/client/forgeSession';
import * as Studio from '../src/engine/client/forgeStudio';
import { modePrefs, saveModePrefs, trainingRival } from '../src/ui/modes/prefs';
import { trialsFor } from '../src/ui/hud/trainingTrials';
import { SWAP_LAB, SWAP_LAPSE_MS, SwapLedger, randomFighter, stepFighter, swapMemory, swapRoster, swapSideOf } from '../src/ui/hud/trainingSwap';
import { hintsHtml, swapOrder } from '../src/ui/hud/TrainingSwapPicker';
import { HOME_VOLUMES } from '../src/ui/MangaHome';
import { readFileSync } from 'node:fs';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';
import { fighterShown } from '../src/originals/launch';
import { displayMove } from '../src/originals/apply';
import { objectiveOf } from '../src/game/objectives/model';

type Room = ReturnType<typeof room>;
function room(self: FighterId = 'konta', seed = 7) {
  const sim = new ArenaSimulation({ roomMode: 'training', seed });
  sim.addPlayer('you', self, 'You'); sim.trainingCommand('you', 'passive');
  let seq = 0;
  const events: CombatEvent[] = [];
  /** One tick: the player's command (facing the dummy down the hall, as Training starts), then every event it made. */
  const tick = (input: Partial<PlayerInput> = {}) => {
    sim.submitInput('you', { seq: ++seq, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'sparring-bot', lock: true, ...input });
    sim.step();
    const made = sim.drainEvents(); events.push(...made);
    return made;
  };
  const run = (ticks: number, input: Partial<PlayerInput> = {}) => { for (let i = 0; i < ticks; i++) tick(input); };
  const lab = (name: string, value?: unknown) => sim.trainingCommand('you', { lab: name, value });
  const you = () => sim.getPlayer('you')!, bot = () => sim.getPlayer('sparring-bot')!;
  /** What the room holds that no snapshot shows: the shots and circles in the air, and a body's cast. */
  const inside = sim as unknown as { projectiles: unknown[]; areas: unknown[]; actors: Map<string, { cast: unknown; state: Record<string, unknown> }> };
  return { sim, tick, run, lab, you, bot, events, inside };
}
const facing = (from: { x: number; z: number }, to: { x: number; z: number }) => Math.atan2(to.x - from.x, to.z - from.z);
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe("Training's switch: the room's rule", () => {
  it('changes the player where they stand: nobody moves, everyone is as RESET leaves them, each faces the other', () => {
    const r = room('konta'); try {
      // A fight in progress, away from the marks: the player has walked, both are hurt, the meters are up.
      r.run(40, { moveX: 1 }); r.run(10);
      r.sim.damage('you', 120, 'sparring-bot', 'test'); r.sim.damage('sparring-bot', 200, 'you', 'test');
      r.sim.trainingCommand('you', 'awakening');
      const at = { you: { x: r.you().x, z: r.you().z }, bot: { x: r.bot().x, z: r.bot().z } }, dummy = r.bot().fighter;
      expect(Math.hypot(at.you.x, at.you.z - 3)).toBeGreaterThan(1);                                    // not on the reset's mark
      expect(r.you().hp).toBeLessThan(r.you().maxHp); expect(r.you().ultimate).toBe(100); expect(r.bot().damageTaken).toBeGreaterThan(0);

      expect(r.lab('swap-self', 'kuon')).toBe(true);
      const you = r.you(), bot = r.bot();
      expect(you.fighter).toBe('kuon'); expect(bot.fighter).toBe(dummy);
      expect(you.id).toBe('you'); expect(you.target).toBe('sparring-bot');
      // Kept: where each stood.
      expect(you.x).toBeCloseTo(at.you.x, 6); expect(you.z).toBeCloseTo(at.you.z, 6);
      expect(bot.x).toBeCloseTo(at.bot.x, 6); expect(bot.z).toBeCloseTo(at.bot.z, 6);
      // Reset, as the practice RESET: full bars, empty meters, no cooldown, no tally, standing.
      for (const p of [you, bot]) {
        expect(p.hp).toBe(p.maxHp); expect(p.stamina).toBe(p.maxStamina); expect(p.ultimate).toBe(0); expect(p.awakening).toBe(0);
        expect(p.alive).toBe(true); expect(p.action).toBe('idle'); expect(p.guarding).toBe(false); expect(!!p.awakened).toBe(false);
        expect(p.damageDealt).toBe(0); expect(p.damageTaken).toBe(0);
        for (const slot of ['light', 'heavy', 'special', 'ultimate'] as const) expect(p.cooldowns[slot]).toBe(0);
      }
      // Each turned to the other.
      expect(turn(you.yaw, facing(you, bot))).toBeLessThan(1e-6);
      expect(turn(bot.yaw, facing(bot, you))).toBeLessThan(1e-6);
      // And it says so the way a reset does: a respawn for each body, where it stands.
      const respawns = r.sim.drainEvents().filter(e => e.kind === 'respawn');
      expect(respawns.map(e => e.actorId).sort()).toEqual(['sparring-bot', 'you']);
      const mine = respawns.find(e => e.actorId === 'you')!;
      expect(mine.origin!.x).toBeCloseTo(at.you.x, 6); expect(mine.origin!.z).toBeCloseTo(at.you.z, 6);
      // The new body fights at once: no hidden invulnerability, and the dummy can be hit.
      r.sim.damage('sparring-bot', 50, 'you', 'test');
      expect(r.bot().hp).toBe(r.bot().maxHp - 50);
    } finally { r.sim.dispose(); }
  });

  it('changes the opponent where it stands, and keeps the behaviour the player had set for it', () => {
    const r = room('taisei'); try {
      r.lab('behaviour', 'guard'); r.lab('speed', .5);
      r.run(60, { moveX: -1 });
      r.sim.trainingCommand('you', 'awakening');
      const at = { x: r.you().x, z: r.you().z }, dummy = { x: r.bot().x, z: r.bot().z };
      expect(r.lab('swap-opponent', 'kenzo')).toBe(true);
      expect(r.bot().fighter).toBe('kenzo'); expect(r.you().fighter).toBe('taisei');
      expect(r.bot().x).toBeCloseTo(dummy.x, 6); expect(r.bot().z).toBeCloseTo(dummy.z, 6);
      expect(r.you().x).toBeCloseTo(at.x, 6); expect(r.you().z).toBeCloseTo(at.z, 6);
      // The switch is a reset for both, the player's meters too.
      expect(r.you().ultimate).toBe(0); expect(r.you().awakening).toBe(0);
      // The lab is as it was set: still blocking, still at half speed.
      expect(r.sim.trainingLab.view()).toMatchObject({ behaviour: 'guard', speed: .5, frozen: false });
      expect(r.sim.snapshot().trainingBotMode).toBe('passive');
      r.run(12);
      expect(r.bot().guarding).toBe(true);
      // FILL METERS still fills the player the room now has.
      r.sim.trainingCommand('you', 'awakening');
      expect(r.you().ultimate).toBe(100);
    } finally { r.sim.dispose(); }
  });

  it('keeps a dummy that fights back fighting back, and one that blocks after a hit waiting for the next hit', () => {
    const r = room('nigo'); try {
      r.sim.trainingCommand('you', 'combat');
      expect(r.lab('swap-self', 'gummy')).toBe(true);
      expect(r.sim.snapshot().trainingBotMode).toBe('combat'); expect(r.sim.trainingLab.view().behaviour).toBe('combat');
      r.lab('behaviour', 'after-hit');
      r.sim.damage('sparring-bot', 30, 'you', 'test'); r.run(30);
      expect(r.bot().guarding).toBe(true);
      // The tallies were cleared with the switch: the dummy lowers its guard until it is hit again.
      expect(r.lab('swap-opponent', 'kosho')).toBe(true);
      r.run(30); expect(r.bot().guarding).toBe(false);
      r.sim.damage('sparring-bot', 30, 'you', 'test'); r.run(30);
      expect(r.bot().guarding).toBe(true);
    } finally { r.sim.dispose(); }
  });

  it('takes the body size with the body', () => {
    const big = (Object.keys(BODY_SIZE) as FighterId[]).find(id => isReleasedFighter(id))!;
    const r = room('konta'); try {
      expect(r.you().size).toBeUndefined();
      expect(r.lab('swap-self', big)).toBe(true); expect(r.you().size).toBe(BODY_SIZE[big]);
      expect(r.lab('swap-self', 'konta')).toBe(true); expect(r.you().size).toBeUndefined(); expect('size' in r.you()).toBe(false);
      expect(r.lab('swap-opponent', big)).toBe(true); expect(r.bot().size).toBe(BODY_SIZE[big]);
    } finally { r.sim.dispose(); }
  });

  it('ends a move in the air: the shot the old body threw never lands', () => {
    // Konta's special leaves the hand and flies for some thirty ticks before it lands (the control run).
    const control = room('konta'); let released = -1, landed = -1;
    try {
      for (let i = 1; i <= 140; i++) for (const e of control.tick({ attack: i === 5 ? 'special' : undefined })) {
        if (e.actorId !== 'you') continue;
        if (e.kind === 'release' && released < 0) released = i;
        if (e.kind === 'hit' && landed < 0) landed = i;
      }
      expect(released).toBeGreaterThan(5); expect(landed).toBeGreaterThan(released + 4);
      expect(control.bot().hp).toBeLessThan(control.bot().maxHp);
    } finally { control.sim.dispose(); }

    const r = room('konta'); try {
      for (let i = 1; i <= released + 2; i++) r.tick({ attack: i === 5 ? 'special' : undefined });
      expect(r.inside.projectiles.length).toBeGreaterThan(0);                                            // in the air now
      expect(r.you().cooldowns.special).toBeGreaterThan(0);
      r.events.length = 0;
      expect(r.lab('swap-self', 'shiden')).toBe(true);
      expect(r.inside.projectiles).toHaveLength(0); expect(r.inside.actors.get('you')!.cast).toBeNull();
      expect(r.you().action).toBe('idle'); expect(r.you().cooldowns.special).toBe(0);
      r.run(landed + 60);
      expect(r.events.filter(e => e.kind === 'hit' || e.kind === 'blocked')).toHaveLength(0);
      expect(r.bot().hp).toBe(r.bot().maxHp); expect(r.you().damageDealt).toBe(0);
      // The new body's own special is its own, at once.
      r.events.length = 0; r.tick({ attack: 'special' });
      const cast = r.events.find(e => e.kind === 'cast' && e.actorId === 'you');
      expect(cast?.fighter).toBe('shiden'); expect(cast?.move).toBe(MOVES.shiden.special.name);
    } finally { r.sim.dispose(); }
  });

  it('ends a wind-up and an area circle too, the opponent\'s as well as the player\'s', () => {
    const r = room('taisei'); try {
      // Mid wind-up of a heavy.
      r.tick({ attack: 'heavy' }); r.run(4);
      expect(r.inside.actors.get('you')!.cast).not.toBeNull();
      expect(r.lab('swap-opponent', 'ouga')).toBe(true);
      expect(r.inside.actors.get('you')!.cast).toBeNull(); expect(r.you().action).toBe('idle');
      // An area move's circle, waiting to strike.
      r.tick({ attack: 'area', aim: { x: 0, z: 0 } }); r.run(34);
      expect(r.inside.areas.length).toBeGreaterThan(0);
      expect(r.lab('swap-self', 'gohaku')).toBe(true);
      expect(r.inside.areas).toHaveLength(0);
      r.events.length = 0; r.run(240);
      expect(r.events.filter(e => e.kind === 'hit')).toHaveLength(0);
      expect(r.bot().hp).toBe(r.bot().maxHp);
    } finally { r.sim.dispose(); }
  });

  it('ends an awakening: the form does not come with the player to the next body', () => {
    const r = room('konta'); try {
      r.sim.trainingCommand('you', 'awakening');
      r.tick({ awaken: true });
      for (let i = 0; i < 240 && !r.you().awakened; i++) r.tick();
      expect(r.you().awakened).toBe(true); expect(r.you().awakenedUntil).toBeGreaterThan(r.sim.serverTime);
      expect(r.lab('swap-self', 'taisei')).toBe(true);
      expect(!!r.you().awakened).toBe(false); expect(r.you().awakenedUntil).toBe(0); expect(r.you().awakening).toBe(0);
      r.run(30); expect(!!r.you().awakened).toBe(false); expect(r.you().action).toBe('idle');
      // In the middle of the transformation itself.
      r.sim.trainingCommand('you', 'awakening'); r.tick({ awaken: true }); r.run(3);
      expect(r.lab('swap-self', 'ouga')).toBe(true);
      r.run(240);
      expect(!!r.you().awakened).toBe(false); expect(r.you().fighter).toBe('ouga');
      // An awakened opponent comes back plain as well.
      const dummy = r.inside.actors.get('sparring-bot')!.state; dummy.awakened = true; dummy.awakenedUntil = r.sim.serverTime + 20;
      expect(r.lab('swap-self', 'kuon')).toBe(true);
      expect(!!r.bot().awakened).toBe(false);
    } finally { r.sim.dispose(); }
  });

  it('off the ground the new body is where the old one was, and comes down from there', () => {
    const r = room('nigo'); try {
      r.tick({ jump: true });
      for (let i = 0; i < 40 && r.you().y < .6; i++) r.tick({ jumpHeld: true });
      const at = { x: r.you().x, y: r.you().y, z: r.you().z };
      expect(at.y).toBeGreaterThan(.5); expect(r.you().grounded).toBe(false);
      expect(r.lab('swap-self', 'setsu')).toBe(true);
      expect(r.you().x).toBeCloseTo(at.x, 6); expect(r.you().y).toBeCloseTo(at.y, 6); expect(r.you().z).toBeCloseTo(at.z, 6);
      expect(r.you().grounded).toBe(false);
      r.run(120);
      expect(r.you().grounded).toBe(true); expect(r.you().y).toBeLessThan(.05);
      expect(Math.hypot(r.you().x - at.x, r.you().z - at.z)).toBeLessThan(.2);
    } finally { r.sim.dispose(); }
  });

  it('a knocked-out player is back on their feet as the new fighter, where they fell', () => {
    const r = room('kenzo'); try {
      r.run(30, { moveX: 1 });
      r.sim.damage('you', 99999, 'sparring-bot', 'test');
      expect(r.you().alive).toBe(false);
      const at = { x: r.you().x, z: r.you().z };
      expect(r.lab('swap-self', 'kosho')).toBe(true);
      expect(r.you().alive).toBe(true); expect(r.you().hp).toBe(r.you().maxHp); expect(r.you().fighter).toBe('kosho');
      expect(r.you().x).toBeCloseTo(at.x, 6); expect(r.you().z).toBeCloseTo(at.z, 6);
      r.run(200); expect(r.you().alive).toBe(true); expect(r.you().fighter).toBe('kosho');
    } finally { r.sim.dispose(); }
  });

  it('keeps the tapes: one being recorded is saved as STOP saves it, one playing goes on from its start', () => {
    const r = room('konta'); try {
      r.lab('record');
      r.run(25, { moveX: 1 });
      expect(r.sim.trainingLab.view()).toMatchObject({ recording: true });
      expect(r.lab('swap-self', 'shirokane')).toBe(true);
      expect(r.sim.trainingLab.view()).toMatchObject({ recording: false, slots: [25, 0, 0] });
      r.lab('play');
      expect(r.sim.trainingLab.view().behaviour).toBe('playback');
      r.run(10); expect(r.sim.trainingLab.view().cursor).toBe(10);
      expect(r.lab('swap-opponent', 'shiden')).toBe(true);
      expect(r.sim.trainingLab.view()).toMatchObject({ behaviour: 'playback', cursor: 0, slots: [25, 0, 0] });
      r.run(5); expect(r.sim.trainingLab.view().cursor).toBe(5);
    } finally { r.sim.dispose(); }
  });

  it('holds through a frozen clock and a drill: the room is as the player set it', () => {
    const r = room('taisei'); try {
      r.lab('behaviour', 'punish'); r.lab('drill-move', 'special');
      r.lab('freeze', true);
      const tick = r.sim.tick;
      expect(r.lab('swap-self', 'gummy')).toBe(true);
      expect(r.you().fighter).toBe('gummy');
      r.run(20); expect(r.sim.tick).toBe(tick);                                                         // still frozen
      expect(r.sim.trainingLab.view()).toMatchObject({ behaviour: 'punish', frozen: true, drill: { move: 'special', attempts: 0, successes: 0 } });
    } finally { r.sim.dispose(); }
  });

  it('what a body brought of its own goes with the body: a forged kit, an outfit', () => {
    const r = room('taisei'); try {
      expect(r.sim.forge('you', { ...MOVES.taisei }, 'abcdef0123456789')).toBe(true);
      r.inside.actors.get('you')!.state.outfit = 'taisei-something';
      expect(r.you().forge).toBe('abcdef0123456789');
      expect(r.lab('swap-self', 'ouga')).toBe(true);
      expect(r.you().forge).toBeUndefined(); expect(r.you().outfit).toBeUndefined();
      expect((r.inside.actors.get('you') as unknown as { forged?: unknown }).forged).toBeUndefined();
    } finally { r.sim.dispose(); }
  });

  it('takes every released fighter for the player, never a held one for the dummy, and nobody else', () => {
    const r = room('konta'); try {
      for (const bad of ['nobody', '', 7, null, undefined, { fighter: 'taisei' }]) {
        expect(isReleasedFighter(bad)).toBe(false);
        expect(r.lab('swap-self', bad), String(bad)).toBe(false); expect(r.lab('swap-opponent', bad), String(bad)).toBe(false);
      }
      expect(r.you().fighter).toBe('konta');
      for (const held of HELD) { expect(r.lab('swap-opponent', held)).toBe(false); if (isReleasedFighter(held)) expect(r.lab('swap-self', held)).toBe(true); }
      // Every released fighter, one after another, each way.
      for (const id of RELEASED_FIGHTERS) {
        expect(r.lab('swap-self', id), id).toBe(true); expect(r.you().fighter).toBe(id);
        if (!HELD.has(id)) { expect(r.lab('swap-opponent', id), id).toBe(true); expect(r.bot().fighter).toBe(id); }
      }
      r.run(10);
      // A mirror is the player's to ask for (the mode sheet lets them).
      if (HELD.has(r.you().fighter)) expect(r.lab('swap-self', 'konta')).toBe(true);
      expect(r.lab('swap-opponent', r.you().fighter)).toBe(true);
    } finally { r.sim.dispose(); }
  });

  it('is a training room\'s alone: a match never changes a fighter, and only a player in the room may ask', () => {
    const match = new ArenaSimulation({ roomMode: 'match', seed: 3 }); try {
      match.addPlayer('you', 'konta', 'You'); match.addPlayer('them', 'taisei', 'Them'); match.startMatch();
      expect(match.trainingCommand('you', { lab: 'swap-self', value: 'kuon' })).toBe(false);
      expect(match.trainingCommand('you', { lab: 'swap-opponent', value: 'kuon' })).toBe(false);
      expect(match.swapFighter('you', 'kuon')).toBe(false);
      expect(match.getPlayer('you')!.fighter).toBe('konta'); expect(match.getPlayer('them')!.fighter).toBe('taisei');
    } finally { match.dispose(); }
    const r = room('konta'); try {
      expect(r.sim.trainingCommand('stranger', { lab: 'swap-self', value: 'kuon' })).toBe(false);
      expect(r.sim.trainingCommand('sparring-bot', { lab: 'swap-self', value: 'kuon' })).toBe(false);
      expect(r.sim.swapFighter('nobody', 'kuon')).toBe(false);
      expect(r.you().fighter).toBe('konta');
    } finally { r.sim.dispose(); }
    // A room with no dummy (arcade survival's arena is a training room without one) has no opponent to change.
    const alone = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 3 }); try {
      alone.addPlayer('you', 'konta', 'You');
      expect(alone.trainingCommand('you', { lab: 'swap-opponent', value: 'kuon' })).toBe(false);
    } finally { alone.dispose(); }
  });

  it('in a room with a second player (a training room on the match server) each changes only their own fighter', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', seed: 5 }); try {
      sim.addPlayer('a', 'konta', 'A'); sim.addPlayer('b', 'taisei', 'B');
      const dummy = sim.getPlayer('sparring-bot')!.fighter;
      expect(sim.trainingCommand('a', { lab: 'swap-self', value: 'kuon' })).toBe(true);
      expect(sim.getPlayer('a')!.fighter).toBe('kuon'); expect(sim.getPlayer('b')!.fighter).toBe('taisei'); expect(sim.getPlayer('sparring-bot')!.fighter).toBe(dummy);
      expect(sim.trainingCommand('b', { lab: 'swap-opponent', value: 'kenzo' })).toBe(true);
      expect(sim.getPlayer('sparring-bot')!.fighter).toBe('kenzo'); expect(sim.getPlayer('a')!.fighter).toBe('kuon'); expect(sim.getPlayer('b')!.fighter).toBe('taisei');
      // Everybody in the room is reset by it, as by the room's own RESET.
      for (const id of ['a', 'b', 'sparring-bot']) expect(sim.getPlayer(id)!.hp).toBe(sim.getPlayer(id)!.maxHp);
    } finally { sim.dispose(); }
  });

  it("leaves the LABORATORY's own OPPONENT command as it was: positions reset", () => {
    const r = room('konta'); try {
      r.run(40, { moveX: 1 });
      expect(Math.abs(r.you().x)).toBeGreaterThan(.5);
      expect(r.lab('opponent', 'taisei')).toBe(true);
      expect(r.bot().fighter).toBe('taisei'); expect(r.you().x).toBeCloseTo(0); expect(r.you().z).toBeCloseTo(3);
    } finally { r.sim.dispose(); }
  });
});

describe("Training's switch on this device (LocalTraining)", () => {
  const neutral = (seq: number): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: Math.PI });
  it('is one training command: the next snapshot has the new fighter where the old one stood', async () => {
    const practice = new LocalTraining();
    try {
      const [self, rival] = (['mizuhiki', 'hawser'] as const).every(fighterShown) ? ['mizuhiki', 'hawser'] as const : ['asahi', 'sekka'] as const;
      await practice.connect('levin', 'Tester');
      const me = () => practice.snapshot!.players.find(p => p.id === practice.id)!, dummy = () => practice.snapshot!.players.find(p => p.isBot)!;
      for (let i = 1; i <= 30; i++) practice.send({ ...neutral(i), moveX: 1 });
      const at = { x: me().x, z: me().z }, stage = practice.snapshot!.stage;
      practice.room!.send('training', { lab: SWAP_LAB.self, value: self });
      practice.send(neutral(31));
      expect(me().fighter).toBe(self); expect(Math.hypot(me().x - at.x, me().z - at.z)).toBeLessThan(.05);
      expect(practice.snapshot!.stage).toBe(stage); expect(practice.id).toBe(LocalTraining.PLAYER);
      practice.room!.send('training', { lab: SWAP_LAB.opponent, value: rival });
      practice.send(neutral(32));
      expect(dummy().fighter).toBe(rival); expect(dummy().id).toBe('sparring-bot'); expect(me().fighter).toBe(self);
      // The room goes on as a room: a press is the new body's.
      practice.press('heavy'); practice.send(neutral(33));
      const cast = practice.snapshot!.events.find(e => e.kind === 'cast' && e.actorId === practice.id);
      expect(cast?.fighter).toBe(self);
    } finally { await practice.leave(); }
  }, 60_000);

  it('takes the Forge studio to the new body: the old body\'s own moves back first, the studio open as it was, the dummy held as it was', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('taisei', 'Tester');
      // The studio as LocalTraining holds it (the real one needs a page): a kit in play for taisei, open, the dummy held.
      const session = new ForgeSession(), own = MOVES.taisei.special;
      const state = Studio.tryItem(Studio.startStudio('taisei', Studio.defaultKitName('Taisei')), 'special', { kind: 'move', from: 'konta', fromSlot: 'special' });
      expect(session.apply(Studio.inPlay(state))).toEqual({ ok: true });
      expect(MOVES.taisei.special).not.toBe(own);
      const made: { body: FighterId; carried: { open?: boolean; dummyWas?: string }; taiseiSpecialWasOwn: boolean }[] = []; let disposed = 0;
      const studio = (carried: { open?: boolean; dummyWas?: string }, onDispose = () => {}) => ({ dispose: () => { disposed++; onDispose(); }, carried: { open: !!carried.open, dummyWas: carried.dummyWas } });
      const inside = practice as unknown as { forge?: ReturnType<typeof studio>; makeForge?: (body: FighterId, carried: { open?: boolean; dummyWas?: string }) => ReturnType<typeof studio> };
      inside.makeForge = (body, carried) => { made.push({ body, carried, taiseiSpecialWasOwn: MOVES.taisei.special === own }); return studio(carried); };
      inside.forge = studio({ open: true, dummyWas: 'combat' }, () => session.restore());

      // Another command, the opponent's switch, a refused switch: the studio stays.
      practice.room!.send('training', 'reset'); practice.room!.send('training', { lab: SWAP_LAB.opponent, value: 'kenzo' }); practice.room!.send('training', { lab: SWAP_LAB.self, value: 'nobody' });
      expect(disposed).toBe(0); expect(made).toHaveLength(0);

      practice.room!.send('training', { lab: SWAP_LAB.self, value: 'ouga' });
      expect(disposed).toBe(1);
      expect(made).toEqual([{ body: 'ouga', carried: { open: true, dummyWas: 'combat' }, taiseiSpecialWasOwn: true }]);
      expect(MOVES.taisei.special).toBe(own);                                                             // the very same object, put back
      expect(practice.sim!.getPlayer(LocalTraining.PLAYER)!.fighter).toBe('ouga');
      // And again: a closed studio is made closed.
      inside.forge = studio({ open: false });
      practice.room!.send('training', { lab: SWAP_LAB.self, value: 'kuon' });
      expect(made[1]).toMatchObject({ body: 'kuon', carried: { open: false, dummyWas: undefined } });
    } finally { await practice.leave(); }
  }, 60_000);
});

describe("Training's switch: the move trials are the new fighter's", () => {
  it('every fighter has trials of their own, by their own moves\' names', () => {
    const taisei = trialsFor('taisei'), kuon = trialsFor('kuon');
    expect(taisei.length).toBeGreaterThan(4); expect(kuon.length).toBeGreaterThan(4);
    expect(kuon.map(t => t.name)).not.toEqual(taisei.map(t => t.name));
    expect(kuon.some(t => t.name === displayMove('kuon', MOVES.kuon.special.name))).toBe(true);
  });
});

describe("Training's switch: who may be chosen, PREVIOUS / NEXT, RANDOM", () => {
  const roster = ['taisei', 'gummy', 'konta', 'nigo', 'kuon'] as FighterId[];
  it('offers the player the whole roster and the dummy everyone but a held fighter', () => {
    expect(swapRoster('self', roster, new Set(['gummy'] as FighterId[]))).toEqual(roster);
    expect(swapRoster('opponent', roster, new Set(['gummy'] as FighterId[]))).toEqual(['taisei', 'konta', 'nigo', 'kuon']);
  });
  it('steps round the roster in its own order', () => {
    expect(stepFighter(roster, 'taisei', 1)).toBe('gummy'); expect(stepFighter(roster, 'gummy', -1)).toBe('taisei');
    expect(stepFighter(roster, 'kuon', 1)).toBe('taisei'); expect(stepFighter(roster, 'taisei', -1)).toBe('kuon');
    // From a fighter the roster does not list: its first, or its last.
    expect(stepFighter(roster, 'kenzo', 1)).toBe('taisei'); expect(stepFighter(roster, 'kenzo', -1)).toBe('kuon'); expect(stepFighter(roster, undefined, 1)).toBe('taisei');
    expect(stepFighter([], 'taisei', 1)).toBeUndefined();
    // Every press lands on somebody else, and a full lap comes back.
    let at: FighterId = 'konta'; const seen: FighterId[] = [];
    for (let i = 0; i < roster.length; i++) { at = stepFighter(roster, at, 1)!; seen.push(at); }
    expect(new Set(seen).size).toBe(roster.length); expect(at).toBe('konta');
  });
  it('RANDOM deals somebody else, and never the fighter across the room', () => {
    for (let i = 0; i < 200; i++) {
      const dealt = randomFighter(roster, ['taisei', 'kuon'], () => i / 200)!;
      expect(roster).toContain(dealt); expect(dealt).not.toBe('taisei'); expect(dealt).not.toBe('kuon');
    }
    expect(randomFighter(roster, ['taisei', 'kuon'], () => 0)).toBe('gummy'); expect(randomFighter(roster, ['taisei', 'kuon'], () => .999)).toBe('nigo');
    // With nobody else to deal, anyone but who the side already is; with nobody at all, nobody.
    expect(randomFighter(['taisei', 'kuon'] as FighterId[], ['taisei', 'kuon'], () => 0)).toBe('kuon');
    expect(randomFighter(['taisei'] as FighterId[], ['taisei', undefined], () => 0)).toBeUndefined();
    expect(randomFighter(roster, [undefined, undefined], () => 0)).toBe('taisei');
  });
  it('knows a switch among the training commands', () => {
    expect(swapSideOf({ lab: 'swap-self', value: 'taisei' })).toBe('self'); expect(swapSideOf({ lab: 'swap-opponent', value: 'taisei' })).toBe('opponent');
    expect(swapSideOf({ lab: 'opponent', value: 'taisei' })).toBe('opponent');                             // the LABORATORY's own list
    for (const other of ['reset', 'awakening', 'passive', { lab: 'behaviour', value: 'guard' }, null, undefined, 3]) expect(swapSideOf(other)).toBeUndefined();
  });
});

describe("Training's switch: the picker's roster and its foot line", () => {
  it('lists the home page\'s roster in the home page\'s order, every released fighter once', () => {
    const mine = swapOrder('self'), theirs = swapOrder('opponent');
    expect(mine).toEqual(HOME_VOLUMES.flat());
    expect([...mine].sort()).toEqual(RELEASED_FIGHTERS.filter(fighterShown).sort());
    expect(theirs).toEqual(mine.filter(id => !HELD.has(id)));
    // PREVIOUS / NEXT walk that order: NEXT from the last fighter of a volume is the first of the next.
    expect(stepFighter(mine, HOME_VOLUMES[0].at(-1), 1)).toBe(HOME_VOLUMES[1][0]);
  });
  it('names this device\'s presses, and how to step without the picker', () => {
    const keys = hintsHtml('keyboard', 'generic', 'opponent');
    for (const word of ['MOVE', 'PICK', 'CLOSE', 'OPPONENT', 'IN THE FIGHT', '<kbd>9</kbd>', '<kbd>0</kbd>', '<kbd>=</kbd>', '<kbd>7</kbd>', '<kbd>Esc</kbd>']) expect(keys).toContain(word);
    expect(hintsHtml('keyboard', 'generic', 'self')).toContain('<kbd>6</kbd>');
    const pad = hintsHtml('controller', 'playstation', 'opponent');
    for (const word of ['CREATE', '✕', '○', '△', 'D ←', 'D ↑', 'PREVIOUS / NEXT FIGHTER']) expect(pad).toContain(word);
    expect(hintsHtml('controller', 'xbox', 'self')).toContain('VIEW');
    expect(hintsHtml('touch', 'generic', 'opponent')).toContain('TAP A FIGHTER');
  });
});

describe("Training's switch: the saved choice", () => {
  const store = new Map<string, string>();
  beforeEach(() => { store.clear(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }; });
  it('remembers the opponent as the mode sheet does (rift-mode-prefs, training.rival), and RANDOM as no choice', () => {
    saveModePrefs('training', { variant: 'offline', stage: 'sunfall-arena' as never });
    saveModePrefs('training', swapMemory('opponent', 'kenzo', false)!);
    expect(trainingRival()).toBe('kenzo');
    expect(JSON.parse(store.get('rift-mode-prefs')!).training).toMatchObject({ rival: 'kenzo', variant: 'offline', stage: 'sunfall-arena' });
    // Dealt by RANDOM: the next Training deals again, and the rest of the sheet's choices stay.
    saveModePrefs('training', swapMemory('opponent', 'kuon', true)!);
    expect(trainingRival()).toBeUndefined();
    expect(modePrefs('training')).toMatchObject({ variant: 'offline', stage: 'sunfall-arena' });
    // The player's own fighter is the home's selection, not a pref of Training's.
    expect(swapMemory('self', 'kuon', false)).toBeUndefined(); expect(swapMemory('self', 'kuon', true)).toBeUndefined();
  });
});

describe("Training's switch: the page's ledger", () => {
  it('a newer choice for a side overtakes one still loading; the other side waits on its own', () => {
    const ledger = new SwapLedger();
    const first = ledger.ask('self', 'kuon', 0), other = ledger.ask('opponent', 'kenzo', 5), second = ledger.ask('self', 'gummy', 10);
    expect(ledger.current(first)).toBe(false); expect(ledger.current(second)).toBe(true); expect(ledger.current(other)).toBe(true);
    expect(ledger.pending('self')).toBe('gummy'); expect(ledger.pending('opponent')).toBe('kenzo');
    expect(ledger.waiting()).toEqual(['gummy', 'kenzo']);                                                 // both on their way: neither's body is let go
    // The overtaken load finishing changes nothing.
    ledger.sent(first, 20); expect(first.sentAt).toBeUndefined();
    ledger.drop('self', first); expect(ledger.pending('self')).toBe('gummy');
    ledger.drop('self', second); expect(ledger.pending('self')).toBeUndefined(); expect(ledger.pending('opponent')).toBe('kenzo');
  });
  it('reads the room\'s answer off its snapshots: settled when the fighter shows, never before it was asked', () => {
    const ledger = new SwapLedger();
    expect(ledger.observe({ self: 'taisei', opponent: 'kenzo' }, 0)).toEqual({ changed: [], settled: [], lapsed: [] });   // the first sight is no change
    const ask = ledger.ask('self', 'kuon', 100);
    expect(ledger.observe({ self: 'taisei', opponent: 'kenzo' }, 150)).toEqual({ changed: [], settled: [], lapsed: [] });
    expect(ledger.pending('self')).toBe('kuon');                                                         // loading: the note stays
    ledger.sent(ask, 1900);
    expect(ledger.observe({ self: 'taisei', opponent: 'kenzo' }, 1905).settled).toHaveLength(0);
    const seen = ledger.observe({ self: 'kuon', opponent: 'kenzo' }, 1920);
    expect(seen.changed).toEqual(['self']); expect(seen.settled).toEqual([ask]); expect(seen.lapsed).toEqual([]);
    expect(ledger.pending('self')).toBeUndefined(); expect(ledger.shown('self')).toBe('kuon');
    expect(ledger.observe({ self: 'kuon', opponent: 'kenzo' }, 1940)).toEqual({ changed: [], settled: [], lapsed: [] });
  });
  it('says when a side is another fighter whoever asked, and lets go of an ask the room never answers', () => {
    const ledger = new SwapLedger();
    ledger.observe({ self: 'taisei', opponent: 'kenzo' }, 0);
    // The LABORATORY's old command on a match server, another tool: nobody asked the ledger.
    expect(ledger.observe({ self: 'taisei', opponent: 'gummy' }, 10).changed).toEqual(['opponent']);
    const ask = ledger.ask('opponent', 'kuon', 20); ledger.sent(ask, 30);
    expect(ledger.observe({ self: 'taisei', opponent: 'gummy' }, 30 + SWAP_LAPSE_MS)).toEqual({ changed: [], settled: [], lapsed: [] });
    expect(ledger.observe({ self: 'taisei', opponent: 'gummy' }, 31 + SWAP_LAPSE_MS)).toEqual({ changed: [], settled: [], lapsed: [ask] });
    expect(ledger.pending('opponent')).toBeUndefined();
    // Out of Training: nothing asked, nobody seen (the next room's first sight is no change).
    ledger.ask('self', 'kuon', 40); ledger.reset();
    expect(ledger.pending('self')).toBeUndefined(); expect(ledger.shown('self')).toBeUndefined();
    expect(ledger.observe({ self: 'konta', opponent: 'shiden' }, 50).changed).toEqual([]);
  });
});

describe("Training's switch stays Training's", () => {
  it('an objective match runs on a training-mode simulation and its snapshots say so: the mode alone is not the practice room', () => {
    const match = new ObjectiveMatch('bad-blood');
    try {
      match.add('h0', 'taisei', 'Hero', 'heroes');
      const snapshot = match.snapshot();
      expect(snapshot.roomMode).toBe('training');
      expect(objectiveOf(snapshot)).toBeTruthy();
      expect(snapshot.players.some(p => p.id === 'sparring-bot')).toBe(false);
    } finally { match.dispose(); }
  });

  it("the page keys the switch's watch, and what it lets go of with the fight on, on the practice room", () => {
    // (The rule's own words in main.ts, and no more of each line than the rule: other work on those lines is not this test's.)
    const main = readFileSync('src/main.ts', 'utf8');
    // Not an objective mode, not Survival: their fights must keep every effect in flight and every voice they loaded.
    expect(main).toMatch(/const practiceRoom=\([^)]*\)=>snapshot\?\.roomMode==='training'&&!survival\(\)&&!objectiveOf\(snapshot\);/);
    expect(main).toMatch(/practiceRoom\(snapshot\)\)watchSwaps\(snapshot\)/);
    expect(main).toMatch(/if\(rebodied\)\{rebodied=false;if\(practiceRoom\(snapshot\)\)\{clearFlights\(\);/);
    expect(main).toMatch(/practiceRoom\(snapshot\)\)audio\.retain\(keep\)/);
    expect(main).toMatch(/!practiceRoom\(room\)[^;\n]*\)return;/);
    // And nothing of the switch keys on the simulation's mode alone any more.
    for (const line of main.split('\n').filter(text => /watchSwaps\(snapshot\)|clearFlights\(\);|audio\.retain\(keep\)/.test(text) && !/^function |^\s*\/\//.test(text)))
      expect(line, line.slice(0, 120)).not.toMatch(/roomMode===?'training'&&!survival\(\)\)/);
    // Out of Training the bench is empty, so the bodies and effects a room keeps are the room's own: emptied when a
    // match is started and when the page goes home.
    expect(main).toMatch(/function resetSwaps\(\)\{[^\n]*trainingBench\.length=0;/);
    expect(main.match(/resetSwaps\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(main).toMatch(/function returnToLobby\([^)]*\)\{[^\n]*resetSwaps\(\);/);
  });
});
