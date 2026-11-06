import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';
import { Fighter, bindClips } from '../src/render/Fighter';
import { TAISEI_MELEE_CONTACTS, TAISEI_TRANSMISSION } from '../src/render/taiseiMeleeContact';
import { base, loadRig } from './rigHarness';
import { glbJson, loadRigWithExtras } from './extraClips';

/** Round 3: Ouga's Crown Straight and Taisei's Cloudstep
 *  Strike ship as animation-only GLBs beside each body (`extraModels`), bound
 *  by bone name at load. Built by scripts/build_r3_moves.py and
 *  scripts/assemble_r3_moves.py. */
const CASES: { fighter: FighterId; file: string; clip: string; slot: AttackSlot }[] = [
  { fighter: 'taisei', file: '/assets/fighters/wukong-transmission1.glb', clip: 'taisei-cloudstep', slot: 'heavy' },
];
const near = (a: number[] | undefined, b: number[] | undefined, fallback: number[]) =>
  (a ?? fallback).every((v, i) => Math.abs(v - (b ?? fallback)[i]) < 1e-5);

describe('round 3 move clips', () => {
  it.each(CASES)('$fighter: $file is animation only, on the body\'s own skeleton, and keys every joint the body animates', ({ fighter, file, clip }) => {
    if (file !== '/assets/fighters/ouga-straight1.glb') expect(FIGHTERS[fighter].extraModels).toContain(file);
    const extra = glbJson(file), body = glbJson(FIGHTERS[fighter].model);
    expect(extra.meshes ?? [], 'no mesh').toHaveLength(0);
    expect(extra.images ?? [], 'no texture').toHaveLength(0);
    expect(extra.skins ?? [], 'no skin').toHaveLength(0);
    expect(extra.animations!.map(a => a.name)).toEqual([clip]);
    const byName = new Map(body.nodes.map((n, i) => [n.name, i]));
    const parentOf = (json: typeof body, i: number) => json.nodes.findIndex(n => n.children?.includes(i));
    const joints = new Set(body.skins!.flatMap(s => s.joints));
    const keyed = new Set<string>();
    for (const channel of extra.animations![0].channels) {
      const name = extra.nodes[channel.target.node].name!;
      expect(byName.has(name), `${name} is a node of the body`).toBe(true);
      const index = byName.get(name)!, mine = extra.nodes[channel.target.node], theirs = body.nodes[index];
      // Same rest: a track is a local transform, so it only means the same
      // pose on a joint that rests where this one does.
      expect(near(mine.translation, theirs.translation, [0, 0, 0]), `${name} rest translation`).toBe(true);
      expect(near(mine.rotation, theirs.rotation, [0, 0, 0, 1]), `${name} rest rotation`).toBe(true);
      if (joints.has(index)) {
        const p = parentOf(body, index), q = parentOf(extra, channel.target.node);
        if (p >= 0 && joints.has(p)) expect(extra.nodes[q]?.name, `${name}'s parent`).toBe(body.nodes[p].name);
      }
      keyed.add(`${name}.${channel.target.path}`);
    }
    // A mixer switching from a body clip to this one must not leave any joint
    // wherever the last clip put it.
    const animated = new Set(body.animations!.flatMap(a => a.channels.map(c => `${body.nodes[c.target.node].name}.${c.target.path}`)));
    const missing = [...animated].filter(track => !keyed.has(track));
    expect(missing, 'body tracks the clip does not key').toEqual([]);
  });

  it.each(CASES)('$fighter: every track binds onto the body, none dropped', async ({ fighter, file, clip }) => {
    const rig = await loadRig(FIGHTERS[fighter].model), extra = await loadRig(file);
    const bound = bindClips(rig.scene, extra.animations, fighter);
    expect(bound.map(c => c.name)).toEqual([clip]);
    expect(bound[0].tracks.length).toBe(extra.animations[0].tracks.length);
  }, 60_000);
});

describe('the renderer plays them', () => {
  let rigs: Record<'ouga' | 'taisei', GLTF>;
  beforeAll(async () => { rigs = { ouga: await loadRigWithExtras('ouga'), taisei: await loadRigWithExtras('taisei') }; }, 120_000);
  const local = (body: Fighter, bone: THREE.Object3D) => { body.group.updateMatrixWorld(true); return body.group.worldToLocal(bone.getWorldPosition(new THREE.Vector3())); };

  it('throws the Crown Straight for Ouga\'s light, the right fist out in front at the blow', () => {
    const body = new Fighter(base('ouga'), rigs.ouga);
    body.dynamics = false;
    try {
      const light = MOVES.ouga.light;
      const state: PlayerState = { ...base('ouga'), action: 'light', chain: 0, actionSeq: 1, actionStarted: 1, actionDuration: light.duration };
      for (let i = 0; i < 4; i++) body.update(1 / 60, { ...state, actionTime: 0 }, true);
      body.update(1 / 60, { ...state, actionTime: light.contacts[0] / light.duration }, true);
      expect(body.motionEvidence().clip).toBe('Ki Straight');
      const fist = local(body, body.joints.get('RightHand')!), chest = local(body, body.joints.get('Spine2') ?? body.joints.get('Spine1')!);
      expect(fist.z - chest.z, 'the fist is well out in front of the chest').toBeGreaterThan(.45);
      expect(Math.abs(fist.y - chest.y), 'at chest-to-chin height').toBeLessThan(.35);
    } finally { body.dispose(); }
  });

  it('plays Cloudstep on the heavy\'s own clock, the left foot out in front at the kick', () => {
    const body = new Fighter(base('taisei'), rigs.taisei);
    body.dynamics = false;
    try {
      const heavy = MOVES.taisei.heavy, t = heavy.teleport!;
      const state: PlayerState = { ...base('taisei'), action: 'heavy', actionSeq: 1, actionStarted: 1, actionDuration: heavy.duration };
      for (const at of [.02, .12, t.vanish, t.appear, (t.appear + heavy.contacts[0]) / 2, heavy.contacts[0], heavy.duration * .9]) {
        body.update(1 / 60, { ...state, actionTime: at / heavy.duration }, true);
        const evidence = body.motionEvidence();
        expect(evidence.clip, `${at}s`).toBe(TAISEI_MELEE_CONTACTS[TAISEI_TRANSMISSION].clip);
        // The clip is played straight through, across the move: authored on
        // round 3's 1.2 s clock, played at round 3d's (PACE).
        const clip = body.clips.find(c => c.name === evidence.clip)!;
        expect(evidence.clipTime!, `${at}s`).toBeCloseTo(at / heavy.duration * clip.duration, 2);
      }
      body.update(1 / 60, { ...state, actionTime: heavy.contacts[0] / heavy.duration }, true);
      const foot = local(body, body.joints.get('LeftFoot')!), hips = local(body, body.joints.get('Hips')!);
      expect(foot.z - hips.z, 'the kick is out in front').toBeGreaterThan(.6);
      expect(foot.y, 'hip-high or more').toBeGreaterThan(hips.y - .15);
      expect(TAISEI_MELEE_CONTACTS[TAISEI_TRANSMISSION].peak).toBeCloseTo(heavy.contacts[0] / heavy.duration, 6);
    } finally { body.dispose(); }
  });
});
