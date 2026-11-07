import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import { CombatEffects } from '../src/render/CombatEffects';
import type { BlastAreas } from '../src/render/signature/BlastArea';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerInput, PlayerState } from '../src/game/types';

const BOMBS = (['taisei', 'konta', 'kagari'] as FighterId[]);
const AREAS = [...BOMBS, 'kuon'] as FighterId[];
const DT = 1 / 60;
const reachOf = (f: FighterId) => MOVES[f].ultimate.timeStop?.radius ?? MOVES[f].ultimate.radius;

/** Round 8 (ULT AIM): how long until `actorId`'s ultimate thrown as a ball comes down - the simulation's own shot in
 *  the air - or undefined while there is none. */
function untilLanding(sim: ArenaSimulation, actorId: string) {
  const s = sim as unknown as { projectiles: { actorId: string; slot: string; startAt: number; duration: number }[]; serverTime: number };
  const shot = s.projectiles.find(p => p.actorId === actorId && p.slot === 'ultimate');
  return shot ? shot.startAt + shot.duration - s.serverTime : undefined;
}

/** `fighter` at `at` facing +x in the practice hall, locked on A; A and a
 *  bystander where they are put. `aMoves(t)` steers A, seconds from the press.
 *  Round 8: `land` is when the bomb came down, seconds from the press. */
function scene(fighter: FighterId, a: { x: number; z: number }, aMoves: (t: number) => Partial<PlayerInput> = () => ({}), me = { x: -3, z: 3.4 }) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11, stage: 'proving-hall' });
  sim.addPlayer('me', fighter, 'Me', false, { x: me.x, y: 0, z: me.z });
  sim.addPlayer('a', 'gummy', 'A', false, { x: a.x, y: 0, z: a.z });
  sim.addPlayer('bot', 'kosho', 'Bystander', false, { x: 0, y: 0, z: -2.75 });
  sim.actors.get('me')!.state.ultimate = 100;
  const seq: Record<string, number> = { me: 0, a: 0, bot: 0 }, events: CombatEvent[] = [];
  let land = Infinity;
  for (let i = 0; i < 60 * 3.5; i++) {
    const t = i * DT;
    sim.submitInput('me', { seq: ++seq.me, moveX: 0, moveZ: 0, yaw: Math.PI / 2, targetId: 'a', lock: true, attack: i === 0 ? 'ultimate' : undefined });
    sim.submitInput('a', { seq: ++seq.a, moveX: 0, moveZ: 0, yaw: -Math.PI / 2, ...aMoves(t) });
    sim.submitInput('bot', { seq: ++seq.bot, moveX: 0, moveZ: 0, yaw: 0 });
    sim.step(DT);
    events.push(...sim.drainEvents());
    const left = land === Infinity ? untilLanding(sim, 'me') : undefined;
    if (left !== undefined) land = t + DT + left;
  }
  const hp = Object.fromEntries(['a', 'bot'].map(id => [id, sim.getPlayer(id)!.hp]));
  const out = { taken: (id: string) => 1000 - hp[id], events, cast: events.find(e => e.kind === 'cast' && e.actorId === 'me')!, land };
  sim.dispose();
  return out;
}

describe('stepping out of the ring gets you out of the blast', () => {
  it('kuon: a sidestep to the practice hall\'s wall (the critic\'s trial) escapes the dome', () => {
    // A 2.2 m in front, running at right angles on the press: the north wall
    // stops them 3.2 m on.
    const { taken } = scene('kuon', { x: -.8, z: 3.4 }, t => t < 1.5 ? { moveZ: 1 } : {});
    expect(taken('a'), 'A got out').toBe(0);
    expect(taken('bot'), 'and the bystander 6.8 m off was never in it').toBe(0);
  });

  it.each(BOMBS)('%s: the critic\'s trial - a run to the practice hall\'s wall is followed (Round 8); a sidestep off it as it comes down gets out', fighter => {
    // The run alone: the bomb comes down where A got to, the wall (it was let go at where A stood at the press).
    const run = scene(fighter, { x: -.8, z: 3.4 }, t => t < 1.5 ? { moveZ: 1 } : {});
    expect(run.taken('a'), 'caught at the wall').toBeGreaterThan(0);
    expect(run.taken('bot'), 'and the bystander 6.8 m off was never in it').toBe(0);
    // The same run, and a sidestep back off the wall into the hall a fifth of a second before it lands (from 3.8 m the
    // Kitsunebi-Dama is in the air for 0.18 s: a sidestep timed onto it, not one in answer to it).
    const out = scene(fighter, { x: -.8, z: 3.4 }, t => Math.abs(t - (run.land - .2)) < DT / 2 ? { moveZ: -1, dash: true } : t < 1.5 ? { moveZ: 1 } : {});
    expect(out.taken('a'), 'A got out').toBe(0);
    expect(out.taken('bot')).toBe(0);
  });

  it.each(AREAS)('%s: whoever stands in it and waits is hit', fighter => {
    const { taken } = scene(fighter, { x: -.8, z: 3.4 });
    expect(taken('a')).toBeGreaterThan(0);
    expect(taken('bot')).toBe(0);
  });

  it.each(BOMBS)('%s: standing on the very spot it was thrown at, a run out is followed (Round 8); a sidestep back as it comes down gets out', fighter => {
    // The worst place to be: under the aim point. A third of a second to
    // react, then a run straight out of the ring - across the open floor of
    // the arena, not into the practice hall's wall. Round 3e: that got out.
    // Round 8 (ULT AIM): the bomb is let go at where the run takes them and
    // follows it; a sidestep back the way they came, a fifth of a second
    // before it lands, is what gets out from under it.
    const run = (sidestepAt?: number) => {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
      sim.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('a', 'gummy', 'A', false, { x: 0, y: 0, z: 6 });
      sim.actors.get('me')!.state.ultimate = 100;
      let land = Infinity;
      for (let i = 0; i < 60 * 3.5; i++) {
        const t = i * DT, dash = sidestepAt !== undefined && Math.abs(t - sidestepAt) < DT / 2;
        sim.submitInput('me', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'a', lock: true, attack: i === 0 ? 'ultimate' : undefined });
        sim.submitInput('a', { seq: i + 1, moveX: dash ? -1 : t >= .3 ? 1 : 0, moveZ: 0, yaw: Math.PI, dash });
        sim.step(DT);
        const left = land === Infinity ? untilLanding(sim, 'me') : undefined;
        if (left !== undefined) land = t + DT + left;
      }
      const taken = 1000 - sim.getPlayer('a')!.hp;
      sim.dispose();
      return { taken, land };
    };
    const followed = run();
    expect(followed.taken, 'the run is followed').toBeGreaterThan(0);
    expect(run(followed.land - .2).taken, 'the sidestep gets out').toBe(0);
  });

  it('the dome: from arm\'s length, a human reaction and a run away gets out before it closes', () => {
    const { taken, events } = scene('kuon', { x: -1.8, z: 3.4 }, t => t >= .3 && t < 1.5 ? { moveX: 1 } : {});
    expect(taken('a')).toBe(0);
    expect(events.some(e => e.kind === 'whiff' && e.actorId === 'me'), 'a dome that closes on nobody is a whiff').toBe(true);
  });

  it('the radii fit what the practice hall allows, and the dome closes with a window', () => {
    for (const f of BOMBS) expect(MOVES[f].ultimate.radius, f).toBeLessThanOrEqual(3);
    const kuon = MOVES.kuon.ultimate;
    expect(kuon.timeStop!.radius).toBeLessThanOrEqual(3.5);
    expect(kuon.contacts[kuon.timeStop!.contact], 'closes after 0.6 s: time to see it and move').toBeGreaterThanOrEqual(.6);
    for (const f of BOMBS) expect(MOVES[f].ultimate.contacts[0], `${f}: let go after a second, and then it has to fly`).toBeGreaterThanOrEqual(1);
  });
});

describe('what is drawn is what hits', () => {
  const stateOf = (fighter: FighterId): PlayerState => ({ id: 'me', name: 'Me', fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
    action: 'ultimate', actionStarted: 1, actionDuration: MOVES[fighter].ultimate.duration, actionTime: 0, target: 'a', alive: true, isBot: false, grounded: true,
    guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
  const body = (state: PlayerState) => ({ state, group: new THREE.Group(), handR: new THREE.Vector3(.3, 1.3, .4), handL: new THREE.Vector3(-.3, 1.3, .4), bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.set(0, 1.3, .5); }, meleeContactPoint() { return false; } }) as unknown as Fighter;

  it.each(AREAS)('%s: the ring goes down on the cast at the radius it hits with, full when it goes off', fighter => {
    const fx = new CombatEffects(new THREE.Scene());
    try {
      const move = MOVES[fighter].ultimate;
      const cast: CombatEvent = { id: 7, kind: 'cast', serverTime: 1, actorId: 'me', fighter, slot: 'ultimate', origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 5 } };
      fx.handle([cast], new Map([['me', body(stateOf(fighter))]]));
      const rings = (fx as unknown as { blast: BlastAreas }).blast.showing();
      expect(rings, 'marked from the cast').toHaveLength(1);
      expect(rings[0].radius).toBeCloseTo(reachOf(fighter), 6);
      if (move.timeStop) {
        expect(rings[0].x, 'round Kuon').toBe(0); expect(rings[0].z).toBe(0);
        expect(rings[0].due, 'full as the dome closes').toBeCloseTo(1 + move.contacts[move.timeStop.contact], 6);
      } else {
        expect(rings[0].z, 'round the spot it was thrown at').toBe(5);
        const flight = Math.hypot(0, 5) / (move.speed ?? 20);
        expect(rings[0].due, 'full as it lands').toBeCloseTo(1 + move.contacts[0] + flight, 1);
      }
    } finally { fx.dispose(); }
  });

  it.each(BOMBS)('%s: the burst is drawn at the blast\'s radius', fighter => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    try {
      const move = MOVES[fighter].ultimate;
      const hit: CombatEvent = { id: 9, kind: 'hit', serverTime: 2, actorId: 'me', targetId: 'a', fighter, slot: 'ultimate', damage: move.damage,
        origin: { x: 0, y: 1.05, z: 5 }, endpoint: { x: 0, y: 1.05, z: 5 } };
      const victim = body({ ...stateOf('gummy'), id: 'a', action: 'launched', z: 5 });
      fx.handle([hit], new Map([['me', body(stateOf(fighter))], ['a', victim]]));
      const burst = scene.getObjectByName('combat-ultimate-burst');
      expect(burst, 'it went off').toBeDefined();
      let shell = 0;
      burst!.traverse(o => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry instanceof THREE.SphereGeometry && o.visible) shell = Math.max(shell, o.scale.x); });
      expect(shell).toBeCloseTo(move.radius, 6);
    } finally { fx.dispose(); }
  });
});
