import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEffects } from '../src/render/CombatEffects';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../src/game/types';

/**
 * Round 3c, LOCK: a beam's damage and its drawn beam agree.
 *
 * The second critic saw Royal Aurora deal its damage with no beam on screen.
 * Two things did that. The beam's volume was measured from the caster's
 * centre, so bodies beside and behind Ouga took the blast without the beam
 * going near them (lockAim.test.ts). And the renderer matched a beam's
 * `release` to its cast on time alone - within 0.06 s of the move's nominal
 * contact - while the simulation holds a cast's clock whenever its thrower's
 * commands arrive late (up to 0.35 s) and through an impact freeze: a 0.25 s
 * hitch in the charge, measured in the browser, and Royal Aurora and
 * Sunpalm Cannon burned their victims with not one frame of beam drawn. A late
 * release is now the beam's release, and its burn moves with it.
 */
const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const event = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'a', ...props });
function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}, hand = new THREE.Vector3(0, 1.2, .4)): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const geometry = new THREE.BoxGeometry(.4, 1.6, .3, 1, 4, 1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const hips = new THREE.Bone(); hips.position.y = 1;
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); mesh.name = 'body'; mesh.add(hips); mesh.bind(new THREE.Skeleton([hips]));
  group.add(mesh);
  const handR = hand.clone(), handL = hand.clone().setX(hand.x - .3);
  return { state, group, velocity: new THREE.Vector3(), handR, handL, bones: new Map(), joints: new Map([['Hips', hips]]), armed: false,
    chargePosition(out: THREE.Vector3) { return out.copy(handR); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(handR); } } as unknown as Fighter;
}
const drawn = (fx: CombatEffects) => (fx.kit.beams.tube.material.uniforms.uState.value as THREE.Vector4[]).filter(s => s.w > 0).length;

/** A beam cast at t = 1, released `late` seconds after its nominal contact:
 *  whether a beam is drawn at each of `probes` (seconds after the release). */
function burn(fighter: FighterId, slot: AttackSlot, late: number, probes: number[]) {
  const scene = new THREE.Scene(), fx = new CombatEffects(scene), move = MOVES[fighter][slot];
  const caster = body('a', fighter, { action: slot, actionStarted: 1, actionDuration: move.duration, actionSeq: 7 }), victim = body('b', 'ouga', { z: 6 });
  const fighters = new Map([['a', caster], ['b', victim]]);
  try {
    for (const f of fighters.values()) scene.add(f.group);
    scene.updateMatrixWorld(true);
    fx.handle([event({ id: 10, kind: 'cast', fighter, slot, actionSeq: 7, origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.2, z: move.range } })], fighters);
    const release = 1 + move.contacts[0] + late;
    // Charging until the release comes: no beam yet.
    fx.update(release - .02, 1 / 60, fighters);
    const before = drawn(fx);
    fx.handle([event({ id: 11, kind: 'release', fighter, slot, serverTime: release, origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.2, z: move.range } })], fighters);
    fx.handle([event({ id: 12, kind: 'hit', targetId: 'b', fighter, slot, damage: move.damage, serverTime: release, origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.05, z: 6 } })], fighters);
    return { before, after: probes.map(t => { fx.update(release + t, 1 / 60, fighters); return drawn(fx); }) };
  } finally { fx.dispose(); }
}

describe('a beam is drawn when its damage lands', () => {
  it('keeps Tsubute ranged confirmation free of the generic sustained laser', () => {
    const r = burn('tsubute', 'ultimate', 0, [.02, .5, 1.5, 2.5]);
    expect(r.before).toBe(0); expect(r.after).toEqual([0, 0, 0, 0]);
  });
  const BEAMS: [FighterId, AttackSlot][] = [['ouga', 'ultimate'], ['ouga', 'special'], ['taisei', 'special'], ['kuon', 'special']];
  it.each(BEAMS)('%s %s: on time, as before', (fighter, slot) => {
    const r = burn(fighter, slot, 0, [.02, .5]);
    expect(r.before).toBe(0);
    expect(r.after).toEqual([1, 1]);
  });

  it.each(BEAMS)('%s %s: released late by a held cast, still drawn, for its whole burn', (fighter, slot) => {
    const move = MOVES[fighter][slot], burnFor = move.duration - move.contacts[0];
    for (const late of [.1, .25, .35, .7]) {
      const r = burn(fighter, slot, late, [.02, burnFor * .5, burnFor - .1, burnFor + .2]);
      expect(r.before, `late ${late}: nothing drawn before it comes`).toBe(0);
      expect(r.after, `late ${late}`).toEqual([1, 1, 1, 0]);
    }
  });

  it('the simulation releases a held beam late - which is what the renderer now accepts', () => {
    // Royal Aurora with the caster's commands missing for 0.25 s of its charge:
    // the release comes about that much after the nominal contact. Round 3d:
    // the beam is let go at 0.52 now, so the stall sits inside that, and the
    // release read is the beam's own - the cinematic's beats release too.
    const sim = new ArenaSimulation({ trainingBot: false, seed: 2 });
    try {
      sim.addPlayer('me', 'ouga', 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('foe', 'taisei', 'Foe', false, { x: 0, y: 0, z: 3 });
      sim.trainingCommand('me', 'awakening');
      let seq = 0, cast: CombatEvent | undefined, release: CombatEvent | undefined;
      for (let tick = 0; tick < 60 * 4; tick++) {
        const starved = tick >= 12 && tick < 27;
        if (!starved) sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', lock: false, attack: tick === 1 ? 'ultimate' : undefined });
        sim.step(1 / 60, new Set(starved ? ['me'] : []));
        for (const e of sim.drainEvents()) {
          if (e.kind === 'cast' && e.actorId === 'me') cast = e;
          if (e.kind === 'release' && e.actorId === 'me') release ??= e;
        }
      }
      const late = release!.serverTime - cast!.serverTime - MOVES.ouga.ultimate.contacts[0];
      expect(late).toBeGreaterThan(.2);
      expect(late).toBeLessThan(.3);
      expect(sim.getPlayer('foe')!.hp).toBeLessThan(1000);
    } finally { sim.dispose(); }
  });
});
