import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MOVES } from '../src/game/moves';
import { CombatEffects, FOXFIRE_ORB } from '../src/render/CombatEffects';
import { applyToonShading, toonKind } from '../src/render/look/toonShading';
import { SIGNATURE, gradeLocal, gradeOnce, SPECIAL_GRADE, GRADE } from '../src/render/signature/context';
import { HOUR_OF_RUIN_ASSETS, ROLLER_ASSET } from '../src/render/signature/HourOfRuin';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

/** Round 3c (FORMS): the second blind critic's form, fidelity and VFX items. */
type Shader = THREE.WebGLProgramParametersWithUniforms;
const compile = (material: THREE.Material) => {
  const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.toon.vertexShader, fragmentShader: THREE.ShaderLib.toon.fragmentShader, defines: {} } as unknown as Shader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
};
const glb = (path: string) => {
  const file = fs.readFileSync(`public${path}`);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
  const bin = file.subarray(20 + file.readUInt32LE(12) + 8);
  return { json, bin };
};
/** An embedded image's PNG header: width, height and colour type (6 = RGBA). */
const png = (path: string, name: string) => {
  const { json, bin } = glb(path);
  const image = json.images.find((i: { name: string }) => i.name === name), view = json.bufferViews[image.bufferView];
  const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colourType: data[25] };
};

describe('Gaunt in steel: the toon model\'s metal mask', () => {
  it('draws Gaunt\'s kit and the GRAVEDIGGER as metal, and nothing else', () => {
    expect(toonKind('mdl_gaunt', 'mat_dvl_mdl_gaunt')).toBe('metal');
    expect(toonKind('weapon_gravedigger_hand', 'mat_dvl_mdl_sword')).toBe('metal');
    // His skin (its own material over the same atlas) and the GRAVE PLATE's body are not.
    expect(toonKind('mdl_gaunt_skin', 'mat_dvl_mdl_gaunt_skin')).toBe('body');
    expect(toonKind('grave_plate', 'mat_dvl_mdl_gaunt02')).toBe('body');
    expect(toonKind('Object_7', 'MI_CP_051_00_Hair')).toBe('hair');
  });
  it('reads the mask from the map\'s alpha and shades steel neutral, in a program of its own', () => {
    const metal = new THREE.MeshToonMaterial(), cloth = new THREE.MeshToonMaterial();
    applyToonShading(metal, 'metal'); applyToonShading(cloth, 'body');
    const m = compile(metal), c = compile(cloth);
    expect(m.defines!.LOOK_METAL).toBe('');
    expect(c.defines!.LOOK_METAL).toBeUndefined();
    expect(m.fragmentShader).toMatch(/lookMetal = smoothstep\( \.15, \.65, diffuseColor\.a/);
    expect(metal.customProgramCacheKey()).not.toBe(cloth.customProgramCacheKey());
  });
});

describe('ordinary specials grade a pool round their caster', () => {
  const stub = () => { const calls: unknown[][] = []; SIGNATURE.screen = { techniqueGrade: (...args: unknown[]) => { calls.push(args); } }; SIGNATURE.localId = undefined; return calls; };
  it('gradeLocal passes a point and a reach, lighter and shorter than asked; gradeOnce stays whole-frame', () => {
    const calls = stub();
    try {
      gradeLocal('a', 1, GRADE.ki, .5, 3, { x: 1, y: 0, z: 2 }, 'a');
      gradeLocal('a', 1, GRADE.ki, .5, 3, { x: 1, y: 0, z: 2 }, 'a');
      expect(calls, 'once per cast').toHaveLength(1);
      const [color, strength, seconds, at, reach] = calls[0] as [number, number, number, { x: number }, number];
      expect(color).toBe(GRADE.ki); expect(strength).toBeCloseTo(.5 * SPECIAL_GRADE.strength); expect(seconds).toBe(SPECIAL_GRADE.hold);
      expect(at.x).toBe(1); expect(reach).toBe(SPECIAL_GRADE.reach);
      gradeOnce('b', 1, GRADE.void, .5, 2.6, 'b');
      expect(calls[1]).toHaveLength(3);
    } finally { SIGNATURE.screen = undefined; }
  });
  it('a special cast through CombatEffects grades locally and briefly; an ultimate the whole frame for its length', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), grades: unknown[][] = [];
    fx.screen = { impactFrame() {}, chromaticPulse() {}, speedLines() {}, techniqueGrade: (...args: unknown[]) => { grades.push(args); } };
    fx.localId = 'a';
    const state = { id: 'a', name: 'A', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'special', actionStarted: 1, actionDuration: 2, actionTime: 0,
      target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as PlayerState;
    const group = new THREE.Group(), taisei = { state, group, handR: new THREE.Vector3(.3, 1.3, .4), handL: new THREE.Vector3(-.3, 1.3, .4), bones: new Map(), joints: new Map(),
      chargePosition(out: THREE.Vector3) { return out.set(0, 1.3, .5); }, meleeContactPoint() { return false; } } as unknown as Fighter;
    const cast = (id: number, slot: 'special' | 'ultimate'): CombatEvent => ({ id, kind: 'cast', serverTime: id, actorId: 'a', fighter: 'taisei' as FighterId, slot, origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 8 } });
    try {
      fx.handle([cast(1, 'special')], new Map([['a', taisei]]));
      expect(grades).toHaveLength(1);
      const special = grades[0] as [number, number, number, THREE.Vector3, number];
      expect(special[3], 'at the caster').toBe(group.position); expect(special[4]).toBeGreaterThan(1);
      expect(special[2], 'to the release and a little after, not the whole move').toBeLessThan(MOVES.taisei.special.duration);
      state.action = 'ultimate';
      fx.handle([cast(2, 'ultimate')], new Map([['a', taisei]]));
      const ultimate = grades[1];
      expect(ultimate, 'whole frame').toHaveLength(3);
      expect(ultimate[2]).toBe(MOVES.taisei.ultimate.duration);
    } finally { fx.dispose(); }
  });
});

describe('the Azure Foxfire and the hour of ruin', () => {
  it('holds an Azure Foxfire near the size of what it hits', () => {
    const move = MOVES.konta.ultimate;
    expect(FOXFIRE_ORB.held * 2, 'Konta\'s ball is taller than he is').toBeGreaterThan(3.5);
    expect(FOXFIRE_ORB.kurobi).toBeGreaterThan(FOXFIRE_ORB.held);
    // Round 3e (ULTFIX): the burst is drawn at the blast's radius, which is
    // at least the ball it bursts from - Kurobi's too, as it flies (0.9 of it).
    expect(move.radius, 'the blast at least the ball').toBeGreaterThanOrEqual(FOXFIRE_ORB.held);
    expect(move.radius).toBeGreaterThanOrEqual(FOXFIRE_ORB.kurobi * .9);
  });
});
