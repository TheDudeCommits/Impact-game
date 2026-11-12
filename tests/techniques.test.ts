import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { COMBO_HP, COMBO_STAMINA } from '../src/game/moves';
import { STYLE_NAMES, TECHNIQUE_KEYS, stickDir, styleScale, techniqueMove, type TechniqueKey } from '../src/game/techniques';
import { comboMove } from '../src/game/combos';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput } from '../src/game/types';

type Dir = NonNullable<PlayerInput['dir']>;
/** Two fighters standing `gap` metres apart on the training floor's open middle, facing each other; `b` passive. */
async function pair(a: FighterId = 'taisei', b: FighterId = 'konta', gap = 1.8, lock = true) {
  const { createRapierCollision } = await import('../src/game/rapierCollision');
  const sim = new ArenaSimulation({ roomMode: 'match', stage: 'sunfall-arena', collision: await createRapierCollision('sunfall-arena'), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, seed: 3, ...(lock ? { lockCombat: true } : {}) });
  sim.addPlayer('a', a, 'A'); sim.addPlayer('b', b, 'B');
  expect(sim.startMatch()).toBe(true);
  const actors = (sim as unknown as { actors: Map<string, { state: { x: number; z: number; yaw: number } }> }).actors;
  actors.get('a')!.state.x = 0; actors.get('a')!.state.z = -gap / 2; actors.get('a')!.state.yaw = 0;
  actors.get('b')!.state.x = 0; actors.get('b')!.state.z = gap / 2; actors.get('b')!.state.yaw = Math.PI;
  let seq = 1;
  const events: CombatEvent[] = [];
  const tick = (a?: Partial<PlayerInput>, b?: Partial<PlayerInput>) => {
    sim.submitInput('a', { seq: seq, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, ...a });
    sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a', lock: true, ...b });
    sim.step(1 / 60);
    events.push(...sim.drainEvents());
  };
  const run = (ticks: number, a?: Partial<PlayerInput>, b?: Partial<PlayerInput>) => { for (let i = 0; i < ticks; i++) tick(a, b); };
  const press = (attack: AttackSlot, dir: Dir = 'n', ticks = 1) => { tick({ attack, dir }); run(ticks - 1); };
  return { sim, events, tick, run, press, casts: () => events.filter(e => e.kind === 'cast' && e.actorId === 'a') };
}

describe('techniques: data', () => {
  it('gives every released fighter all twelve, named, in its style, with sane timing', () => {
    for (const id of RELEASED_FIGHTERS) for (const key of TECHNIQUE_KEYS) {
      const move = comboMove(id, key)!;
      expect(move, `${id} ${key}`).toBeDefined();
      expect(move.name.length, `${id} ${key}`).toBeGreaterThan(2);
      expect(move.contacts[0]).toBeGreaterThan(.1);
      expect(move.contacts[0]).toBeLessThan(move.duration);
      expect(move.duration).toBeLessThan(1.4);
      expect(move.damage).toBeGreaterThan(20);
    }
    // Each style names all nine, differently.
    for (const names of Object.values(STYLE_NAMES)) expect(new Set(Object.values(names)).size).toBe(TECHNIQUE_KEYS.length);
    expect(techniqueMove('kenzo', 'rush').name).not.toBe(techniqueMove('ippon', 'rush').name);
  });
  it('reads the stick against the line to the opponent', () => {
    expect(stickDir(0, 0, 0, 1)).toBe('n');
    expect(stickDir(0, 1, 0, 1)).toBe('f');
    expect(stickDir(0, -1, 0, 1)).toBe('b');
    expect(stickDir(1, 0, 0, 1)).toBe('s');
    expect(stickDir(.2, .1, 0, 1)).toBe('n'); // a drifting stick is no press
  });
  it('makes a combo of more kinds worth more, up to a cap', () => {
    expect(styleScale(1)).toBe(1);
    expect(styleScale(3)).toBeCloseTo(1.2);
    expect(styleScale(9)).toBeCloseTo(1.4);
  });
});

describe('techniques: the stick openers', () => {
  const opener = async (attack: AttackSlot, dir: Dir) => { const t = await pair(); t.press(attack, dir, 40); return t.casts()[0]; };
  it('toward + light is the rush, away the rising strike, across the sidestep; neutral the plain light', async () => {
    expect((await opener('light', 'f')).branch).toBe('rush');
    expect((await opener('light', 'b')).branch).toBe('rise');
    expect((await opener('light', 's')).branch).toBe('slip');
    expect((await opener('light', 'n')).branch).toBeUndefined();
  });
  it('toward + heavy is the charge, away the counter stance; neutral the plain heavy', async () => {
    expect((await opener('heavy', 'f')).branch).toBe('charge');
    expect((await opener('heavy', 'b')).branch).toBe('counter');
    expect((await opener('heavy', 'n')).branch).toBeUndefined();
  });
  it('the rush opens the light string: the next light is its second stage', async () => {
    const t = await pair();
    t.press('light', 'f', 14); t.press('light', 'f', 30);
    const [first, second] = t.casts();
    expect(first.branch).toBe('rush');
    expect(second.branch).toBeUndefined();
    expect(second.chain).toBe(1);
  });
  it('the rising strike launches, and a light after it is the chase, not a string on the floor', async () => {
    const t = await pair();
    t.press('light', 'b', 30);
    expect(t.events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.branch === 'rise')).toBe(true);
    const sim = t.sim as unknown as { actors: Map<string, { state: { grounded: boolean } }> };
    expect(sim.actors.get('b')!.state.grounded).toBe(false);
  });
  it('the sidestep slips a blow thrown into it', async () => {
    const t = await pair();
    // B swings first; A's sidestep a beat later is still inside its evade when B's blow lands.
    t.tick(undefined, { attack: 'light', dir: 'n' });
    t.tick({ attack: 'light', dir: 's' });
    t.run(30);
    expect(t.events.some(e => e.kind === 'dodge' && e.targetId === 'a')).toBe(true);
  });
  it('a technique from neutral waits on its own cooldown: pressed again at once it is the plain move', async () => {
    const t = await pair('taisei', 'konta', 2.2);
    t.press('light', 'b', 50); t.press('light', 'b', 40);
    const branches = t.casts().map(c => c.branch);
    expect(branches[0]).toBe('rise');
    expect(branches.filter(b => b === 'rise').length).toBe(1);
  });
});

describe('techniques: out of a dash, off the floor, back up in the air', () => {
  it('a light inside its own dash is the Dash Strike', async () => {
    // (A dash waits 0.35 s after the last one ended - the first moments of a match included.)
    const t = await pair('taisei', 'konta', 3.5);
    t.run(30); t.tick({ dash: true, moveZ: 1 }); t.tick({ attack: 'light', dir: 'n', moveZ: 1 }); t.run(40);
    expect(t.casts()[0].branch).toBe('dashStrike');
  });
  it('a light pressed as the fighter gets up off the floor is the Wake-up Strike', async () => {
    const t = await pair();
    const actor = (t.sim as unknown as { actors: Map<string, { reaction: string | null; stunUntil: number; risenAt: number }> }).actors.get('a')!;
    actor.reaction = 'getup'; actor.stunUntil = t.sim.serverTime + .05;
    t.run(5); t.press('light', 'n', 40);
    expect(t.casts()[0].branch).toBe('wakeUp');
  });
  it('in the air, away + light is the Air Rise; toward, the air rush', async () => {
    const up = await pair('taisei', 'konta', 2);
    up.tick({ jump: true, jumpHeld: true }); up.run(12, { jumpHeld: true });
    up.press('light', 'b', 30);
    expect(up.casts()[0].branch).toBe('airRise');
    const on = await pair('taisei', 'konta', 3);
    on.tick({ jump: true, jumpHeld: true }); on.run(12, { jumpHeld: true });
    on.press('light', 'f', 30);
    expect(on.casts()[0].branch).toBe('airRush');
  });
});

describe('techniques: the heavy string and the delay', () => {
  it('heavy, heavy, heavy is the heavy string, and its third blow breaks a guard', async () => {
    // (Gaunt's heavy is a plain cleave on the floor; Taisei's is Cloudstep, which ends in the air.)
    const t = await pair('gaunt');
    t.press('heavy', 'n', 20); t.press('heavy', 'n', 26); t.press('heavy', 'n', 70);
    expect(t.casts().map(c => c.branch ?? c.slot)).toEqual(['heavy', 'hh', 'hhh']);
    expect(comboMove('taisei', 'hhh')!.guardBreak).toBe(true);
  });
  it('every released fighter reaches the heavy string\'s third blow, a heavy that launches too', async () => {
    // Fourteen fighters' heavies launch (Konta's Kazeyose, Taisei's Cloudstep, Ouga's Crown Burst...):
    // the second blow rises to meet the body thrown, and until 2 November the third press up there was the air heavy -
    // their Crushing Blow could not be thrown. Each press made as a player makes it: once the blow before has landed.
    const missed: string[] = [];
    for (const id of RELEASED_FIGHTERS) {
      const t = await pair(id, 'taisei', 1.6);
      const actor = (t.sim as unknown as { actors: Map<string, { cast?: { branch?: string; connected: boolean }; heavyChainUntil: number }> }).actors.get('a')!;
      const landed = (branch?: string) => (actor.cast && actor.cast.branch === branch && actor.cast.connected) || (!actor.cast && t.sim.serverTime <= actor.heavyChainUntil);
      t.press('heavy');
      for (let i = 0; i < 120 && !landed(undefined); i++) t.tick();
      t.press('heavy');
      for (let i = 0; i < 150 && !landed('hh'); i++) t.tick();
      t.press('heavy', 'n', 80);
      const casts = t.casts().map(c => c.branch ?? c.slot).join(' ');
      if (casts !== 'heavy hh hhh') missed.push(`${id}: ${casts}`);
    }
    expect(missed).toEqual([]);
  }, 300000);
  it('light, light, a beat, light is the Delayed Strike; pressed in time it is the string\'s third stage', async () => {
    const quick = await pair();
    quick.press('light', 'n', 9); quick.press('light', 'n', 9); quick.press('light', 'n', 40);
    expect(quick.casts().map(c => c.branch ?? `l${c.chain}`)).toEqual(['l0', 'l1', 'l2']);
    // Held back: the second blow run to its end, then a beat past the window that would carry the string on.
    const held = await pair();
    held.press('light', 'n', 9); held.press('light', 'n', 1);
    const actor = (held.sim as unknown as { actors: Map<string, { cast: unknown }> }).actors.get('a')!;
    for (let i = 0; i < 120 && (held.casts().length < 2 || actor.cast); i++) held.tick();
    held.run(26);
    held.press('light', 'n', 40);
    expect(held.casts().map(c => c.branch ?? `l${c.chain}`)).toEqual(['l0', 'l1', 'delay']);
    // Inside the window it would have been the third stage, and long after it a new string.
    const late = await pair();
    late.press('light', 'n', 9); late.press('light', 'n', 1);
    const lateActor = (late.sim as unknown as { actors: Map<string, { cast: unknown }> }).actors.get('a')!;
    for (let i = 0; i < 120 && (late.casts().length < 2 || lateActor.cast); i++) late.tick();
    late.run(70);
    late.press('light', 'n', 40);
    expect(late.casts().map(c => c.branch ?? `l${c.chain}`)[2]).toBe('l0');
  });
});

describe('techniques: armour, counters and style', () => {
  it('the charge rides through a light under lock combat', async () => {
    const t = await pair('taisei', 'konta', 3);
    t.press('heavy', 'f', 12);
    t.tick(undefined, { attack: 'light' });
    t.run(60);
    const charged = t.events.find(e => e.kind === 'hit' && e.actorId === 'a' && e.branch === 'charge');
    expect(charged).toBeDefined();
  });
  it('a counter stance met by a blow answers it: the blow is undone and the stance\'s strike lands for more', async () => {
    const t = await pair();
    t.press('heavy', 'b', 4);
    t.tick(undefined, { attack: 'light' });
    t.run(60);
    expect(t.events.some(e => e.kind === 'counter' && e.actorId === 'a' && e.targetId === 'b')).toBe(true);
    const strike = t.events.find(e => e.kind === 'hit' && e.actorId === 'a' && e.branch === 'counter');
    expect(strike).toBeDefined();
    expect(strike!.damage!).toBeGreaterThan(comboMove('taisei', 'counter')!.damage * 1.5);
    expect(t.events.some(e => e.kind === 'hit' && e.actorId === 'b' && e.targetId === 'a')).toBe(false);
  });
  it('a combo of several kinds is worth more blow by blow than one string', async () => {
    const t = await pair();
    // Rush in, the string, then the knockdown ender: three kinds.
    t.press('light', 'f', 12); t.press('light', 'n', 10); t.press('light', 'n', 10); t.press('heavy', 'n', 60);
    const styles = t.events.filter(e => e.kind === 'hit' && e.actorId === 'a').map(e => e.style ?? 1);
    expect(Math.max(...styles)).toBeGreaterThanOrEqual(1.2);
  });
});

describe('techniques: bots', () => {
  it('a bot throws techniques in its own duels', async () => {
    const { createRapierCollision } = await import('../src/game/rapierCollision');
    const thrown = new Set<string>();
    for (let seed = 1; seed <= 3; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'match', stage: 'sunfall-arena', collision: await createRapierCollision('sunfall-arena'), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, seed, lockCombat: true });
      sim.addPlayer('x', 'taisei', 'X', true); sim.addPlayer('y', 'kenzo', 'Y', true);
      sim.startMatch();
      for (let i = 0; i < 60 * 40 && sim.status === 'active'; i++) { sim.step(1 / 60); for (const e of sim.drainEvents()) if (e.kind === 'cast' && e.branch) thrown.add(e.branch); }
      sim.dispose?.();
    }
    const techniques = [...thrown].filter(b => (TECHNIQUE_KEYS as readonly string[]).includes(b)) as TechniqueKey[];
    expect(techniques.length).toBeGreaterThanOrEqual(3);
  });
});
