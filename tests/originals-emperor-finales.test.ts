import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import { MoveStage, STAGE_LIMITS } from '../src/render/signature/MoveStage';
import { EmperorFinales, FINALES } from '../src/originals/emperorFinales';
import { ORIGINALS } from '../src/originals/roster';

type Pool = 'flames' | 'glows' | 'bolts' | 'lights' | 'discs' | 'shells' | 'shots';
const POOLS: readonly Pool[] = ['flames', 'glows', 'bolts', 'lights', 'discs', 'shells', 'shots'];
function body(id: string, fighter: FighterId, z = 0): Fighter {
  const group = new THREE.Group(); group.position.z = z;
  return { group, handR: new THREE.Vector3(.3, 1.3, z + .2), handL: new THREE.Vector3(-.3, 1.3, z + .2),
    state: { id, fighter, alive: true, action: 'idle', actionSeq: 2, actionTime: 0, actionDuration: 1, yaw: 0 } as PlayerState } as unknown as Fighter;
}
function run(fighter: FighterId) {
  const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = new EmperorFinales(scene), move = MOVES[fighter].ultimate;
  const actor = body('a', fighter), foe = body('v', 'taisei', 2.2), fighters = new Map([['a', actor], ['v', foe]]);
  const peak: Record<Pool, number> = { flames: 0, glows: 0, bolts: 0, lights: 0, discs: 0, shells: 0, shots: 0 };
  const hit = (contactIndex: number, id: number): CombatEvent => ({ id, kind: 'hit', fighter, actorId: 'a', targetId: 'v', actionSeq: 2, slot: 'ultimate', contactIndex, serverTime: 10 + move.contacts[contactIndex] } as CombatEvent);
  let landed = 0, drawnAfterLast = 0;
  try {
    for (let frame = 0; frame <= (move.duration + 3.5) * 60; frame++) {
      const t = frame / 60;
      if (t <= move.duration) Object.assign(actor.state, { action: 'ultimate', actionDuration: move.duration, actionTime: t / move.duration });
      else Object.assign(actor.state, { action: 'idle', actionTime: 0 });
      while (landed < move.contacts.length && t >= move.contacts[landed]) { fx.handle(hit(landed, 10 + landed), fighters); fx.handle(hit(landed, 10 + landed), fighters); landed++; }
      fx.update(10 + t, fighters);
      for (const pool of POOLS) peak[pool] = Math.max(peak[pool], stage.counts[pool]);
      if (landed === move.contacts.length && t < move.contacts[landed - 1] + 1) drawnAfterLast = Math.max(drawnAfterLast, stage.counts.bolts);
    }
    return { peak, drawnAfterLast, after: stage.counts };
  } finally { fx.dispose(); stage.release(); expect(scene.children).toHaveLength(0); }
}

describe('the originals\' emperor-slot finales', () => {
  it('are only for originals in the earlier emperor slots', () => {
    for (const id of Object.keys(FINALES) as FighterId[]) { expect(ORIGINALS[id], id).toBeTruthy(); expect(MOVES[id].ultimate.contacts.length, id).toBeGreaterThanOrEqual(2); }
    expect(Object.keys(FINALES)).toContain('sekka');
  });
  it.each(Object.keys(FINALES) as FighterId[])('%s: a storm after the last blow, under half of every shared pool, all spent after', fighter => {
    const { peak, drawnAfterLast, after } = run(fighter);
    expect(drawnAfterLast, 'the storm draws after the last blow').toBeGreaterThan(20);
    for (const pool of POOLS) expect(peak[pool], `${fighter} ${pool} ${JSON.stringify(peak)}`).toBeLessThanOrEqual(STAGE_LIMITS[pool] / 2);
    expect(after.shots).toBe(0); expect(after.bolts).toBe(0);
  });
  it('draws nothing for a slot it does not hold, and nothing for a whiff', () => {
    const scene = new THREE.Scene(), stage = MoveStage.for(scene, { budget: 1 }), fx = new EmperorFinales(scene);
    const actor = body('a', 'taisei'), fighters = new Map([['a', actor]]);
    fx.handle({ id: 1, kind: 'hit', fighter: 'taisei', actorId: 'a', slot: 'ultimate', contactIndex: 1, serverTime: 10 } as CombatEvent, fighters);
    fx.handle({ id: 2, kind: 'whiff', fighter: 'sekka', actorId: 'a', slot: 'ultimate', serverTime: 10 } as CombatEvent, fighters);
    fx.update(10.1, fighters);
    expect(stage.counts.shots).toBe(0); expect(stage.counts.bolts).toBe(0);
    fx.dispose(); stage.release();
  });
});
