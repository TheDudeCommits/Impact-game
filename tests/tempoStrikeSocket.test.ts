import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { moveFor, rushMove } from '../src/game/awakening';
import type { PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';

/** The exported jab was correct, but its generic charge/trail sampled the
 * opposite hand. Keep actual gameplay pose direction covered with an opponent
 * and the impact layer enabled: contact settling must not turn the fist back. */
describe.skipIf(!!ORIGINALS.tempo)('Tempo authored striking hands', () => {
  it.each([false,true])('keeps the left jab ahead of its shoulder with impact=%s', async impact => {
    const source=await loadRig(FIGHTERS.tempo.model);
    const state={...base('tempo'),id:'tempo',yaw:-3.1151555753,x:.04039228,y:.01,z:1.52743423};
    const target={...base('basilissa'),id:'rose',x:0,y:.01,z:0};
    const actor=new Fighter(state,source),other=new Fighter(target,await loadRig(FIGHTERS['basilissa'].model));
    actor.prepareRush();actor.targetPoint=new THREE.Vector3(0,1.45,0);
    other.targetPoint=new THREE.Vector3(state.x,1.45,state.z);actor.targetDistance=other.targetDistance=1.53;
    try {
      for(let i=0;i<60;i++){actor.update(1/60,state,true);other.update(1/60,target,true);Fighter.settleContacts();}
      for(let i=0;i<=18;i++){
        if(i===18&&impact){
          actor.impact(false,'light',undefined,undefined,new THREE.Vector3(0,0,-1),23);
          other.impact(true,'light','melee',0,new THREE.Vector3(0,0,-1),23,1.4);
        }
        actor.update(.01,{...state,action:'light',actionStarted:2,actionSeq:1,actionDuration:.42,actionTime:i*.01/.42},true);
        other.update(.01,target,true);Fighter.settleContacts();
      }
      expect(actor.motionEvidence().clip).toBe('Street Jab');
      const hand=actor.joints.get('LeftHand')!.getWorldPosition(new THREE.Vector3());
      const shoulder=actor.joints.get('LeftArm')!.getWorldPosition(new THREE.Vector3());
      const towardTarget=new THREE.Vector3(target.x-state.x,0,target.z-state.z).normalize();
      expect(hand.clone().sub(shoulder).dot(towardTarget)).toBeGreaterThan(.35);
      expect(hand.distanceTo(actor.handR)).toBeGreaterThan(.4);
      const point=new THREE.Vector3();
      expect(actor.meleeContactPoint(0,point)).toBe(true);
      expect(point.distanceTo(hand)).toBeLessThan(1e-5);
      expect(actor.chargePosition(point).distanceTo(hand)).toBeLessThan(1e-5);
      expect(actor.strikePoint(point).distanceTo(hand)).toBeLessThan(1e-5);
    } finally {actor.dispose();other.dispose();}
  });
  it.each([
    {action:'light',grounded:true,chain:1,clip:'Rush 1',joint:'RightHand',index:0},
    {action:'light',grounded:true,chain:2,clip:'Rush 2',joint:'RightHand',index:0},
    {action:'light',grounded:true,chain:3,clip:'Rush 3',joint:'RightHand',index:0},
    {action:'light',grounded:false,chain:0,clip:'Rising Beat',joint:'RightHand',index:0},
    {action:'light',grounded:false,chain:1,clip:'Body Shot',joint:'RightHand',index:0},
    {action:'light',grounded:false,chain:2,clip:'Elbow Drop',joint:'RightHand',index:0},
    {action:'ultimate',grounded:true,chain:0,clip:'Perfect Timing',joint:'RightHand',index:0},
    {action:'ultimate',grounded:true,chain:0,clip:'Perfect Timing',joint:'LeftHand',index:1},
    {action:'ultimate',grounded:true,chain:0,clip:'Perfect Timing',joint:'LeftHand',index:7},
  ] as const)('$clip contact $index follows $joint for charge, trail and hit', async entry => {
    const fighter=new Fighter(base('tempo'),await loadRig(FIGHTERS.tempo.model));fighter.prepareRush();
    const move=entry.action==='light'?rushMove('tempo',entry.chain,false):moveFor('tempo',entry.action,false);
    const contact=move.contacts[entry.index];
    const state:PlayerState={...base('tempo'),action:entry.action,grounded:entry.grounded,chain:entry.chain,
      y:entry.grounded?0:1.4,actionStarted:1,actionSeq:1,actionDuration:move.duration,actionTime:0};
    try {
      const count=Math.ceil(contact*60);
      for(let i=0;i<=count;i++)fighter.update(1/60,{...state,actionTime:Math.min(contact,i/60)/move.duration},true);
      expect(fighter.motionEvidence().clip).toBe(entry.clip);
      const hand=fighter.joints.get(entry.joint)!.getWorldPosition(new THREE.Vector3()),point=new THREE.Vector3();
      expect(fighter.meleeContactPoint(entry.index,point)).toBe(true);
      expect(point.distanceTo(hand)).toBeLessThan(1e-5);
      expect(fighter.chargePosition(point).distanceTo(hand)).toBeLessThan(1e-5);
      expect(fighter.strikePoint(point).distanceTo(hand)).toBeLessThan(1e-5);
    } finally {fighter.dispose();}
  });
});
