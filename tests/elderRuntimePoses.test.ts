import * as THREE from 'three';
import {describe,expect,it}from 'vitest';
import {Fighter}from '../src/render/Fighter';
import {FIGHTERS}from '../src/config';
import {MOVES}from '../src/game/moves';
import {rushMove,awakeningSwapAt,AWAKENING_ENTRY}from '../src/game/awakening';
import {HAKUSHI_MOUTH_OFFSET}from '../src/game/fighters/hakushi';
import type{PlayerState}from '../src/game/types';
import {base,loadRig}from './rigHarness';
async function actor(id:'kusushi'|'hakushi'){
 const state=base(id),f=new Fighter(state,await loadRig(FIGHTERS[id].model));f.attachForm(await loadRig(FIGHTERS[id].formModel!));f.prepareRush();f.targetDistance=4;f.targetPoint=new THREE.Vector3(0,1.3,4);
 for(let i=0;i<60;i++)f.update(1/60,state,true);return f;
}
function advance(f:Fighter,state:PlayerState,end:number,lunge=0){for(let i=0;i<=Math.ceil(end*120);i++){const t=Math.min(end,i/120);f.update(1/120,{...state,z:lunge*t/end,actionTime:t/state.actionDuration},true);}}
function joint(f:Fighter,name:string){return f.shownBody.joints.get(name)!.getWorldPosition(new THREE.Vector3());}
function mouth(f:Fighter){return joint(f,'Head').addScaledVector(new THREE.Vector3(0,0,1).transformDirection(f.shownBody.group.matrixWorld),HAKUSHI_MOUTH_OFFSET.forward*f.shownBody.group.getWorldScale(new THREE.Vector3()).x).addScaledVector(new THREE.Vector3(0,1,0),HAKUSHI_MOUTH_OFFSET.up*f.shownBody.group.getWorldScale(new THREE.Vector3()).x);}
describe('Elder visible-body native strikes and transformations',()=>{
 it.each(['kusushi','hakushi']as const)('%s plays its entry and the exact named rush on its replacement body',async id=>{
  const f=await actor(id),state=base(id);
  try{
   const entry={...state,awakened:true,action:'awaken' as const,actionDuration:AWAKENING_ENTRY,actionStarted:1,actionSeq:1};
   advance(f,entry,awakeningSwapAt(id)-.01);expect(f.motionEvidence().formVisible).toBe(false);
   advance(f,entry,.85);expect(f.motionEvidence().formVisible).toBe(true);expect(f.motionEvidence().formClip).toBe(id==='kusushi'?'YOKOZUNA':'THE OLD LION');
   for(let stage=1;stage<=3;stage++){
    const m=rushMove(id,stage,true);advance(f,{...state,awakened:true,action:'light',chain:stage,actionDuration:m.duration,actionStarted:2+stage,actionSeq:2+stage},m.contacts[0]);
    expect(f.motionEvidence().formVisible).toBe(true);expect(f.motionEvidence().formClip).toBe(`Rush ${stage}`);
    const side=id==='kusushi'?(stage===1?'LeftHand':'RightHand'):(stage===2?'LeftHand':'RightHand');
    expect(f.strikePoint(new THREE.Vector3()).distanceTo(joint(f,side))).toBeLessThan(.00001);
   }
  }finally{f.dispose();}
 });
 it.each([false,true])('Kusushi authored overhead heel survives approach stride (awakened=%s)',async awakened=>{
  const f=await actor('kusushi'),state={...base('kusushi'),awakened};
  try{
   for(let i=0;i<60;i++)f.update(1/60,{...state,action:'run',z:i/60*3},true);
   const m=MOVES.kusushi.heavy;let peak=-Infinity;
   // Contact retiming changes when the source lift is seen: sample the full
   // wind-up rather than assuming source fraction .42 equals runtime .42s.
   for(let i=0;i<=72;i++){
    f.update(1/120,{...state,action:'heavy',actionDuration:m.duration,actionStarted:2,actionSeq:2,z:3+i/72*1.5,actionTime:i/120/m.duration},true);
    peak=Math.max(peak,joint(f,'RightFoot').y-joint(f,'Head').y);
    const p=f.strikePoint(new THREE.Vector3());expect(p.distanceTo(joint(f,'RightFoot'))).toBeLessThan(.00001);
   }
   expect(peak).toBeGreaterThan(.04);
  }finally{f.dispose();}
 });
 it('Kusushi keeps a base ultimate in base and maps right/left/heel confirmed contacts',async()=>{
  const f=await actor('kusushi'),s=base('kusushi'),m=MOVES.kusushi.ultimate;
  try{for(const[index,bone]of ['RightHand','LeftHand','RightFoot'].entries()){
   advance(f,{...s,action:'ultimate',actionDuration:m.duration,actionStarted:2,actionSeq:2,confirmedAt:2+m.contacts[0],target:'b'},m.contacts[index]);
   expect(f.motionEvidence().formVisible).toBe(false);const p=new THREE.Vector3();expect(f.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(joint(f,bone))).toBeLessThan(.00001);
  }}finally{f.dispose();}
 });
 it('Hakushi opens with a base palm, reveals Sage only after confirm, and returns after completion',async()=>{
  const f=await actor('hakushi'),s=base('hakushi'),m=MOVES.hakushi.ultimate;
  try{
   const u={...s,action:'ultimate' as const,actionDuration:m.duration,actionStarted:1,actionSeq:1};
   advance(f,u,.5);expect(f.motionEvidence().formVisible).toBe(false);const p=new THREE.Vector3();f.meleeContactPoint(0,p);expect(p.distanceTo(joint(f,'LeftHand'))).toBeLessThan(.00001);
   advance(f,{...u,confirmedAt:1.52,target:'b'},1.82);expect(f.motionEvidence().formVisible).toBe(true);expect(f.motionEvidence().formClip).toBe('Lion Dance: Over the Cliff');f.meleeContactPoint(1,p);expect(p.distanceTo(mouth(f))).toBeLessThan(.00001);
   advance(f,{...s,action:'idle',actionDuration:1,actionStarted:5,actionSeq:2},.2);expect(f.motionEvidence().formVisible).toBe(false);
  }finally{f.dispose();}
 });
 it.each([false,true])('Hakushi Flame Bomb uses the shown mouth (awakened=%s)',async awakened=>{
  const f=await actor('hakushi'),s={...base('hakushi'),awakened},m=MOVES.hakushi.special;
  try{advance(f,{...s,action:'special',actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);expect(f.chargePosition(new THREE.Vector3()).distanceTo(mouth(f))).toBeLessThan(.00001);expect(f.strikePoint(new THREE.Vector3()).distanceTo(mouth(f))).toBeLessThan(.00001);}finally{f.dispose();}
 });
 it('a missed Hakushi ultimate never reveals Sage',async()=>{const f=await actor('hakushi'),m=MOVES.hakushi.ultimate;try{for(let i=0;i<360;i++){f.update(1/120,{...base('hakushi'),action:'ultimate',actionDuration:m.duration,actionTime:i/120/m.duration,actionSeq:1,actionStarted:1,whiffedAt:.6},true);expect(f.motionEvidence().formVisible).toBe(false);}}finally{f.dispose();}});
});
