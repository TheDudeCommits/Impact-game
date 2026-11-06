import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { moveFor } from '../src/game/awakening';
import { base, loadRig } from './rigHarness';
import type { PlayerState } from '../src/game/types';

describe('Mikage authored striking limbs', () => {
  it.each([
    { action:'heavy', grounded:true, chain:0, clip:'Pounce Heel', joint:'RightFoot' },
    { action:'light', grounded:false, chain:2, clip:'Tailwhip Heel', joint:'LeftFoot' },
  ] as const)('$clip keeps charge, contact and trail on the striking foot', async entry => {
    const fighter = new Fighter(base('mikage'), await loadRig(FIGHTERS.mikage.model));
    const move = moveFor('mikage', entry.action, false);
    const state:PlayerState = {...base('mikage'), action:entry.action, grounded:entry.grounded,
      chain:entry.chain, y:entry.grounded?0:1.4, actionStarted:1, actionSeq:1, actionDuration:move.duration, actionTime:0};
    try {
      for(let i=0;i<=24;i++)fighter.update(1/60,{...state,actionTime:i/48},true);
      expect(fighter.motionEvidence().clip).toBe(entry.clip);
      const foot=fighter.model.getObjectByName(entry.joint)!.getWorldPosition(new THREE.Vector3());
      const point=new THREE.Vector3();
      expect(fighter.meleeContactPoint(0,point)).toBe(true);
      expect(point.distanceTo(foot)).toBeLessThan(1e-5);
      expect(fighter.chargePosition(point).distanceTo(foot)).toBeLessThan(1e-5);
      expect(fighter.strikePoint(point).distanceTo(foot)).toBeLessThan(1e-5);
      expect(point.distanceTo(fighter.handR)).toBeGreaterThan(.2);
    } finally { fighter.dispose(); }
  });
});
