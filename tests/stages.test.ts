import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTER_SERIES, ROYALE_STAGES, STAGES, chooseStage, dealRoyaleStage, seriesStage, type StageId } from '../src/game/stages';
import { FIGHTERS } from '../src/config';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { PLAYER_RADIUS } from '../src/game/moves';
import { ORIGINALS } from '../src/originals/roster';
async function loadStage(path: string): Promise<GLTF> {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  delete json.images; delete json.textures; delete json.samplers;
  const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const tail = file.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}

const themed = ((Object.keys(STAGES) as StageId[]).filter(id => STAGES[id].model)).filter(id => !!STAGES[id].model);

describe('stage registry', () => {

  it('keeps fog inside the far plane so distance fades instead of clipping', () => {
    for (const stage of Object.values(STAGES)) {
      expect(stage.fog[0]).toBeLessThan(stage.fog[1]);
      expect(stage.fog[1]).toBeLessThanOrEqual(stage.cameraFar);
    }
  });

  it('agrees with the roster about which series each fighter is from', () => {
    // The match server ships src/game only, so stages.ts carries its own copy.
    for (const [id, definition] of Object.entries(FIGHTERS)) {
      if (ORIGINALS[id as keyof typeof ORIGINALS]) continue;
      expect(FIGHTER_SERIES[id as keyof typeof FIGHTER_SERIES]).toBe(definition.series);
    }
    expect(Object.keys(FIGHTER_SERIES).sort()).toEqual(Object.keys(FIGHTERS).sort());
  });

  it('leaves room to spawn twelve fighters inside the play bounds', () => {
    for (const stage of Object.values(STAGES)) {
      expect(stage.spawnRadius).toBeLessThan(stage.halfX - PLAYER_RADIUS * 2);
    }
  });
});

describe('stage selection', () => {
  it('uses the Proving Hall for training and for a one-on-one', () => {
    expect(chooseStage(['taisei'], 'training')).toBe('proving-hall');
    expect(chooseStage(['gummy', 'konta'], 'training')).toBe('proving-hall');
    expect(chooseStage(['gummy', 'nigo'], 'match')).toBe('proving-hall');
    expect(chooseStage(['konta', 'shiden'], 'match')).toBe('proving-hall');
  });

  it('sends a Taisei–Ouga duel to the Zenith Coliseum', () => {
    expect(chooseStage(['taisei', 'ouga'], 'match')).toBe('zenith-coliseum');
    // One Last Sun fighter is not a Last Sun duel.
    expect(chooseStage(['taisei', 'kenzo'], 'match')).toBe('proving-hall');
  });


  it('never sends a royale to the harbour by default', () => {
    for (const roster of [[], ['taisei'], ['gummy', 'konta', 'taisei', 'nigo', 'koko', 'ouga'], ['gummy', 'kenzo', 'konta', 'shiden']] as Parameters<typeof chooseStage>[0][]) {
      const stage = chooseStage(roster, 'match');
      expect(stage).not.toBe('harbor');
      expect(ROYALE_STAGES).toContain(stage);
    }
  });


  it('is deterministic regardless of join order', () => {
    const roster: Parameters<typeof chooseStage>[0] = ['nigo', 'gummy', 'kenzo', 'kosho'];
    const shuffled: Parameters<typeof chooseStage>[0] = ['kosho', 'nigo', 'kenzo', 'gummy'];
    expect(chooseStage(shuffled, 'match')).toBe(chooseStage(roster, 'match'));
  });
});


describe('stage bounds are authoritative', () => {
  it.each(themed)('%s keeps a sprinting fighter on its floor', async id => {
    const stage = STAGES[id];
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: id,
      collision: await createRapierCollision(id) });
    try {
      sim.addPlayer('a', 'taisei', 'Runner');
      for (let i = 0; i < 400; i++) {
        sim.submitInput('a', { seq: i + 1, moveX: 1, moveZ: 1, yaw: 0 });
        sim.step(1 / 60);
      }
      const runner = sim.getPlayer('a')!;
      expect(Math.abs(runner.x)).toBeLessThanOrEqual(stage.halfX - PLAYER_RADIUS + 1e-6);
      expect(Math.abs(runner.z)).toBeLessThanOrEqual(stage.halfZ - PLAYER_RADIUS + 1e-6);
      // Standing on the stage floor, not sunk into it or falling through.
      expect(runner.y).toBeGreaterThan(-0.2);
      expect(runner.y).toBeLessThan(0.6);
      expect(runner.alive).toBe(true);
    } finally { sim.dispose(); }
  }, 60_000);

  it('has no ring on the wire or in the rules', async () => {
    const sim = new ArenaSimulation({ roomMode: 'match', stage: 'zenith-coliseum',
      collision: await createRapierCollision('zenith-coliseum') });
    try {
      sim.addPlayer('a', 'taisei'); sim.addPlayer('b', 'ouga');
      sim.startMatch();
      for (let i = 0; i < 60 * 70; i++) sim.step();
      expect('ring' in sim.snapshot()).toBe(false);
      for (const p of sim.snapshot().players) expect(p.hp, `${p.id} took nothing from a storm`).toBe(p.maxHp);
    } finally { sim.dispose(); }
  });

  it('swaps collision with the stage so the harbour is not left standing', async () => {
    const sim = new ArenaSimulation({ roomMode: 'match', collision: await createRapierCollision('harbor') });
    try {
      expect(sim.stage).toBe('harbor');
      const { buildCollision } = await import('../src/game/rapierCollision');
      sim.setStage('proving-hall', buildCollision('proving-hall'));
      sim.addPlayer('a', 'taisei'); sim.addPlayer('b', 'konta');
      sim.startMatch();
      for (const player of sim.snapshot().players) {
        expect(Math.abs(player.x)).toBeLessThanOrEqual(STAGES['proving-hall'].halfX);
        expect(Math.abs(player.z)).toBeLessThanOrEqual(STAGES['proving-hall'].halfZ);
      }
    } finally { sim.dispose(); }
  });
});
