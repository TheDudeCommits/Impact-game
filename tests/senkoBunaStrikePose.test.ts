import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ORIGINALS } from '../src/originals/roster';
import { Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import type { PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';

function advance(actor: Fighter, state: PlayerState, end: number, lunge = 0) {
  const count = Math.ceil(end * 120);
  for (let i = 0; i <= count; i++) {
    const elapsed = Math.min(end, i / 120);
    actor.update(1 / 120, { ...state, z: state.z + lunge * Math.min(1, elapsed / .35), actionTime: elapsed / state.actionDuration }, true);
  }
}
function visibleHands(actor: Fighter) {
  const names: string[] = [];
  actor.model.traverseVisible(mesh => { if (/^Senko_Hand_(Left|Right)_(Open|Point|Beads)$/.test(mesh.name)) names.push(mesh.name); });
  return names.sort();
}

describe('Senko actual kick and gesture integration', () => {
  it.each(['light', 'heavy'] as const)('%s retains its raised native striking foot through an approach lunge', async slot => {
    const idle = base('senko'), actor = new Fighter(idle, await loadRig(FIGHTERS.senko.model));
    actor.prepareRush(); actor.targetPoint = new THREE.Vector3(0, 1.5, 6); actor.targetDistance = 6;
    try {
      for (let i = 0; i < 60; i++) actor.update(1 / 60, idle, true);
      // Approach overlays must remain usable for a finger cast before a kick.
      advance(actor, { ...idle, action: 'special', actionStarted: 1, actionSeq: 1, actionDuration: 1.05 }, .2, .6);
      const move = MOVES.senko[slot];
      advance(actor, { ...idle, z: .6, action: slot, actionStarted: 2, actionSeq: 2, actionDuration: move.duration }, move.contacts[0], 1.5);
      const joint = slot === 'light' ? 'RightFoot' : 'LeftFoot';
      const foot = actor.joints.get(joint)!.getWorldPosition(new THREE.Vector3());
      const hip = actor.joints.get('Hips')!.getWorldPosition(new THREE.Vector3());
      // The heavy is a horizontal heel at hip height; compare the native
      // clip rather than demanding the light kick's higher target height.
      const native = await loadRig(FIGHTERS.senko.model);
      const mixer = new THREE.AnimationMixer(native.scene);
      const clip = native.animations.find(c => c.name === FIGHTERS.senko.clips![slot === 'light' ? 0 : 1])!;
      mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
      mixer.setTime(actor.motionEvidence().clipTime!); native.scene.updateMatrixWorld(true);
      const nativeFoot = native.scene.getObjectByName(joint)!.getWorldPosition(new THREE.Vector3());
      const nativeHip = native.scene.getObjectByName('Hips')!.getWorldPosition(new THREE.Vector3());
      expect(Math.abs((foot.y - hip.y) - (nativeFoot.y - nativeHip.y))).toBeLessThan(.08);
      expect(foot.y).toBeGreaterThan(1.05);
      mixer.stopAllAction(); mixer.uncacheRoot(native.scene);
      expect(foot.z - hip.z).toBeGreaterThan(.75);
      expect((actor as unknown as {stride: number}).stride).toBe(0);
      const point = new THREE.Vector3();
      expect(actor.meleeContactPoint(0, point)).toBe(true);
      expect(point.distanceTo(foot)).toBeLessThan(1e-5);
      expect(actor.chargePosition(point).distanceTo(foot)).toBeLessThan(1e-5);
    } finally { actor.dispose(); }
  });
  it.skipIf(!!ORIGINALS.senko)('shows exactly one native hand per side through laser, confirmed barrage and interruption', async () => {
    const idle = base('senko'), actor = new Fighter(idle, await loadRig(FIGHTERS.senko.model)); actor.prepareRush();
    try {
      advance(actor, { ...idle, action: 'special', actionStarted: 1, actionSeq: 1, actionDuration: 1.05 }, .4515);
      expect(visibleHands(actor)).toEqual(['Senko_Hand_Left_Open', 'Senko_Hand_Right_Point']);
      const laser = actor.chargePosition(new THREE.Vector3());
      const pointHand = actor.model.getObjectByName('Senko_Hand_Right_Point') as THREE.SkinnedMesh;
      let closest = Infinity; const vertex = new THREE.Vector3();
      for (let i = 0; i < pointHand.geometry.attributes.position.count; i++) {
        pointHand.getVertexPosition(i, vertex).applyMatrix4(pointHand.matrixWorld);
        closest = Math.min(closest, vertex.distanceTo(laser));
      }
      expect(closest).toBeLessThan(1e-5);
      expect(laser.distanceTo(actor.handR)).toBeGreaterThan(.12);
      expect(laser.distanceTo(actor.handR)).toBeLessThan(.3);
      advance(actor, { ...idle, action: 'ultimate', actionStarted: 2, actionSeq: 2, actionDuration: 3.45 }, 1.92);
      expect(actor.motionEvidence().clip).toBe('Troop of a Hundred Lights');
      expect(visibleHands(actor)).toEqual(['Senko_Hand_Left_Beads', 'Senko_Hand_Right_Beads']);
      actor.update(1 / 60, { ...idle, action: 'hurt', actionStarted: 3, actionSeq: 3, actionDuration: .5 }, true);
      expect(visibleHands(actor)).toEqual(['Senko_Hand_Left_Open', 'Senko_Hand_Right_Open']);
    } finally { actor.dispose(); }
  });
});

describe.skipIf(!!ORIGINALS.buna)('Buna actual animated mast-breaker integration', () => {
  it('keeps effects on the native weapon during the left-hand transfer and release', async () => {
    const idle = base('buna'), actor = new Fighter(idle, await loadRig(FIGHTERS.buna.model)); actor.prepareRush();
    actor.targetPoint = new THREE.Vector3(0, 1.5, 8); actor.targetDistance = 8;
    try {
      for (let i = 0; i < 60; i++) actor.update(1 / 60, idle, true);
      const mesh = actor.model.getObjectByName('weapon_buna_right_hand') as THREE.SkinnedMesh;
      const point = new THREE.Vector3(), vertex = new THREE.Vector3();
      for (const fraction of [.417, .458, .66 / 1.3, .75]) {
        advance(actor, { ...idle, action: 'special', actionStarted: 1, actionSeq: 1, actionDuration: 1.3 }, fraction * 1.3);
        actor.chargePosition(point);
        let nearest = Infinity;
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld); nearest = Math.min(nearest, point.distanceTo(vertex));
        }
        expect(nearest, 'actual mast-breaker at ' + fraction).toBeLessThan(.005);
        const strike = actor.strikePoint(new THREE.Vector3());
        expect(point.distanceTo(strike)).toBeLessThan(1e-5);
        expect(actor.meleeContactPoint(0, vertex)).toBe(true);
        expect(vertex.distanceTo(point)).toBeLessThan(1e-5);
        expect(point.distanceTo(actor.handR)).toBeGreaterThan(.3);
      }
    } finally { actor.dispose(); }
  });
});
