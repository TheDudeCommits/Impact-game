import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { rushMove } from '../src/game/awakening';
import { AIR_NORMAL_FIGHTERS, AIR_RUSH, AIR_RUSH_NAMES, MOVES, RUSH_AIR_STAGES } from '../src/game/moves';
import { ArenaSimulation } from '../src/game/simulation';
import { AIR_STRING_CLIPS, Fighter, bindClips } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import { loadRigWithExtras } from './extraClips';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { HOME_FIGHTERS } from '../src/ui/MangaHome';

/** Round 3b (HITFEEL): the blind critic - "7 fighters (Taisei, Ouga, Konta,
 *  Gummy, Kosho, LORD ORO, KoKo) share the same KNEE HITCH / KICK LOOSE air
 *  follow-up, so strings feel templated" - and the integrator: the stages
 *  after the first were announced as kicks while most of them drew grounded
 *  rush clips. Each of the seven now has an air string of its own moves,
 *  announced by names that say what is drawn. */
const bodies = new Map<FighterId, GLTF>(), rushes = new Map<FighterId, THREE.AnimationClip[]>();
/** Round 4b (COMBAT): every Vol.1 fighter has an air string of their own. */
const VOL1 = HOME_FIGHTERS as readonly FighterId[];
beforeAll(async () => {
  for (const id of VOL1) {
    const body = await loadRigWithExtras(id);
    bodies.set(id, body);
    if (FIGHTERS[id].rushModel) rushes.set(id, bindClips(body.scene, (await loadRig(FIGHTERS[id].rushModel!)).animations, id));
  }
}, 240_000);

/** The simulation's announcements for a string thrown with both bodies held
 *  in the air, as tests/rush.test.ts holds them. */
function airString(fighter: FighterId) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 11 });
  try {
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'kosho', 'B', false, { x: 0, y: 0, z: 1.2 });
    const casts: CombatEvent[] = [];
    for (let i = 0; i < 180; i++) {
      for (const id of ['a', 'b']) { const actor = sim.actors.get(id)!; actor.state.y = 5; actor.state.grounded = false; actor.vy = 0; }
      sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i % 4 === 0 && i < 150 ? 'light' : undefined });
      sim.submitInput('b', { seq: i, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
      sim.step();
      casts.push(...sim.snapshot(true).events.filter(e => e.kind === 'cast' && e.actorId === 'a'));
    }
    return casts;
  } finally { sim.dispose(); }
}

/** What the renderer draws for an airborne rush stage, and how far its knees
 *  are bent on average over its first frames (the tuck folds both; a stance
 *  or a lunge keeps them open). */
function drawn(id: FighterId, stage: number) {
  const body = new Fighter(base(id), bodies.get(id)!, false, rushes.get(id));
  try {
    body.prepareRush();
    const s0 = base(id);
    for (let i = 0; i < 30; i++) body.update(1 / 60, s0, true, 1 / 60);
    const move = stage ? rushMove(id, stage, false) : MOVES[id].light;
    const knees = kneeBend(body, s0, stage, move.duration, 3);
    return { clip: String(body.motionEvidence().clip), knees, time: Number(body.motionEvidence().clipTime) };
  } finally { body.dispose(); }
}

/** The angle at the knee (hip, knee, ankle), degrees, averaged over both
 *  legs and the stage's first twelve frames: 180 is a straight leg. */
function kneeBend(body: Fighter, s0: PlayerState, stage: number, duration: number, y: number) {
  let sum = 0;
  const at = (name: string) => body.joints.get(name)!.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 12; i++) {
    body.update(1 / 60, { ...s0, y, grounded: y <= 0, action: 'light', chain: stage, actionSeq: 5 + stage, actionStarted: 2,
      actionDuration: duration, actionTime: (i + 1) / 60 / duration }, true, 1 / 60);
    body.group.updateMatrixWorld(true);
    for (const side of ['Left', 'Right']) { const knee = at(side + 'Leg'); sum += THREE.MathUtils.radToDeg(at(side + 'UpLeg').sub(knee).angleTo(at(side + 'Foot').sub(knee))); }
  }
  return sum / 24;
}

describe('air strings', () => {
  it('gives each of the seven an air string of its own names, none of them the old shared kicks', () => {
    const seen = new Set<string>();
    for (const id of AIR_NORMAL_FIGHTERS) {
      const own = AIR_RUSH[id];
      expect(own, `${id} has an air string`).toBeDefined();
      for (const stage of [1, 2]) {
        const name = own![stage]!;
        expect(AIR_RUSH_NAMES as readonly string[], `${id} ${stage}`).not.toContain(name);
        expect(seen.has(name), `${name} is ${id}'s alone`).toBe(false);
        seen.add(name);
      }
    }
  });

  it.each(VOL1)('%s: announces its air string by the names of what it draws', id => {
    const casts = airString(id);
    const first = casts.slice(0, RUSH_AIR_STAGES);
    expect(first.map(e => e.chain)).toEqual([0, 1, 2]);
    // Round 4b (COMBAT): every stage, the light off the floor too, by the air string's own name - never the jab's
    // (the round-4 critic: Space+J was listed and announced as J).
    for (const stage of [0, 1, 2] as const) expect(first[stage].move, `${id} air stage ${stage}`).toBe(AIR_RUSH[id]![stage]);
    expect(first[0].move).not.toBe(MOVES[id].light.name);
    const plan = AIR_STRING_CLIPS[id]!;
    for (const stage of [0, 1, 2] as const) {
      const { clip, time } = drawn(id, stage);
      expect(clip, `${id} air stage ${stage} draws what "${AIR_RUSH[id]![stage]}" names`).toBe(plan[stage].clip);
      // A stage played off part of a take plays that part.
      const own = plan[stage];
      if (own.from !== undefined) expect(time, `${id} air stage ${stage}: inside ${own.from}-${own.to}`).toBeGreaterThanOrEqual(own.from - 1e-3);
      if (own.to !== undefined) expect(time, `${id} air stage ${stage}: inside ${own.from}-${own.to}`).toBeLessThanOrEqual(own.to + 1e-3);
    }
  }, 120_000);

  it('never draws Jump + Light with the grounded jab\'s clip (round 4b)', () => {
    // The round-4 critic: Jump + Light was the grounded jab for 11 of 12 fighters - the same clip and segment as L1.
    for (const id of VOL1) {
      const grounded = new Fighter(base(id), bodies.get(id)!, false, rushes.get(id));
      try {
        const s0 = base(id);
        for (let i = 0; i < 30; i++) grounded.update(1 / 60, s0, true, 1 / 60);
        const light = MOVES[id].light;
        for (let i = 0; i < 6; i++) grounded.update(1 / 60, { ...s0, action: 'light', chain: 0, actionSeq: 5, actionStarted: 2, actionDuration: light.duration, actionTime: (i + 1) / 60 / light.duration }, true, 1 / 60);
        const jab = String(grounded.motionEvidence().clip);
        expect(drawn(id, 0).clip, `${id}: Jump + Light`).not.toBe(jab);
      } finally { grounded.dispose(); }
    }
  }, 120_000);

  it('tucks the legs under a blow thrown with the arms in the air, and leaves a kick its own legs', () => {
    // KoKo's air strike is thrown with the arms (tucked); Kosho's with the
    // legs (not). The same blow on the floor keeps the stance its clip draws.
    expect(AIR_STRING_CLIPS.koko![1].tuck).toBe(true);
    expect(AIR_STRING_CLIPS.kosho![1].tuck).toBe(false);
    const tucked = drawn('koko', 1), kicked = drawn('kosho', 1);
    const grounded = new Fighter(base('koko'), bodies.get('koko')!, false, rushes.get('koko'));
    try {
      grounded.prepareRush();
      const s0 = base('koko');
      for (let i = 0; i < 30; i++) grounded.update(1 / 60, s0, true, 1 / 60);
      const standing = kneeBend(grounded, s0, 1, rushMove('koko', 1, false).duration, 0);
      expect(tucked.knees, 'knees folded under the body in the air, degrees').toBeLessThan(standing - 30);
    } finally { grounded.dispose(); }
    expect(kicked.clip).toBe(AIR_STRING_CLIPS.kosho![1].clip);
  }, 120_000);
});
