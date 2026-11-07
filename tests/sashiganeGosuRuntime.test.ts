import * as THREE from 'three';
import type {GLTF}from 'three/addons/loaders/GLTFLoader.js';
import {beforeAll,describe,expect,it}from 'vitest';
import {Fighter}from '../src/render/Fighter';
import {FIGHTERS}from '../src/config';
import {MOVES}from '../src/game/moves';
import {AWAKENING_ENTRY,rushMove}from '../src/game/awakening';
import {SwordSpiritEffects,SPIRIT_CALLERS}from '../src/render/SwordSpiritEffects';
import type{FighterId,PlayerState,AttackSlot}from '../src/game/types';
import {base,loadRig}from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
const rigs=new Map<string,GLTF>();
beforeAll(async()=>{for(const[id,path]of [['sashigane',FIGHTERS.sashigane.model],['gosu',FIGHTERS.gosu.model],['spirit',SPIRIT_CALLERS.gosu!.asset],['foe',FIGHTERS.taisei.model]])rigs.set(id,await loadRig(path));},120000);
type SpiritInner={sources:Map<FighterId,GLTF>;spirits:Map<string,Fighter>;timeFields:Map<string,unknown>};
function fixture(){
 const scene=new THREE.Scene(),state={...base('gosu'),id:'owner',target:'foe'},owner=new Fighter(state,rigs.get('gosu')!),foe=new Fighter({...base('taisei'),id:'foe',z:2},rigs.get('foe')!);
 owner.prepareRush();scene.add(owner.group,foe.group);owner.targetPoint=new THREE.Vector3(0,1.2,2);owner.targetDistance=2;
 const effects=new SwordSpiritEffects(scene),inner=effects as unknown as SpiritInner;inner.sources.set('gosu',rigs.get('spirit')!);
 const map=new Map([['owner',owner],['foe',foe]]);
 function tick(s:PlayerState,time:number){owner.update(1/120,s,true);foe.update(1/120,foe.state,true);effects.update(time,1/120,map);}
 for(let i=0;i<60;i++)tick(state,i/120);
 return{owner,foe,effects,inner,tick,state,dispose(){effects.dispose();owner.dispose();foe.dispose();}};
}
function sequence(f:ReturnType<typeof fixture>,slot:AttackSlot,end:number,extra:Partial<PlayerState>={}){
 const move=MOVES.gosu[slot];for(let i=0;i<=Math.ceil(end*120);i++){const time=Math.min(end,i/120);f.tick({...f.state,action:slot,actionStarted:1,actionSeq:2,actionDuration:move.duration,actionTime:time/move.duration,...extra},1+time);}
 return f.inner.spirits.get('owner')!;
}
describe('native Ratio blade and manually commanded the mender',()=>{
 it.skipIf(!!ORIGINALS.sashigane)('Sashigane charge and contact stay on the actual rigid wrapped blade',()=>{
  const f=new Fighter(base('sashigane'),rigs.get('sashigane')!);f.prepareRush();
  try{for(const slot of ['light','heavy','special','ultimate']as const){const m=MOVES.sashigane[slot];for(let i=0;i<=60;i++)f.update(1/120,{...base('sashigane'),action:slot,actionStarted:1,actionSeq:2,actionDuration:m.duration,actionTime:i/60*m.contacts[0]/m.duration},true);
   expect(f.armed).toBe(true);const p=f.strikePoint(new THREE.Vector3()),charge=f.chargePosition(new THREE.Vector3()),contact=new THREE.Vector3();expect(f.meleeContactPoint(0,contact)).toBe(true);expect(charge.distanceTo(p)).toBeLessThan(1e-6);expect(contact.distanceTo(p)).toBeLessThan(1e-6);
   expect(p.distanceTo(f.handR)).toBeGreaterThan(.32);expect(p.distanceTo(f.handR)).toBeLessThan(.48);expect(f.motionEvidence().formVisible).toBe(false);
  }}finally{f.dispose();}
 });
 it('stays hidden at idle, then responds to each ordinary heavy input using its native punch',()=>{
  const f=fixture();try{expect(f.inner.spirits.get('owner')!.group.visible).toBe(false);const spirit=sequence(f,'heavy',.48);expect(spirit.group.visible).toBe(true);expect(spirit.motionEvidence().clip).toBe('Gold Seam Hammer');expect(f.owner.motionEvidence().clip).toBe('Gold Seam Hammer');expect(f.inner.timeFields.size).toBe(0);
   for(let i=0;i<90;i++)f.tick({...f.state,action:'idle',actionSeq:3,actionStarted:2},2+i/120);expect(spirit.group.visible).toBe(false);
  }finally{f.dispose();}
 });
 it.each([false,true])('native airborne string and KIN KIN contacts remain manual (awakened=%s)',awakened=>{
  const f=fixture();try{
   for(let stage=0;stage<3;stage++){
    const m=rushMove('gosu',stage,awakened);
    for(let i=0;i<=60;i++){const t=i/60*m.contacts[0];f.tick({...f.state,awakened,awakenedUntil:20,grounded:false,y:1.2,action:'light',chain:stage,actionStarted:2+stage,actionSeq:3+stage,actionDuration:m.duration,actionTime:t/m.duration},2+stage+t);}
    const spirit=f.inner.spirits.get('owner')!;expect(spirit.group.visible).toBe(true);expect(spirit.motionEvidence().clip).toBe(['Rising Seam','Porcelain Hook','Ruin Breaker'][stage]);
   }
   const m=MOVES.gosu.special;
   for(let index=0;index<3;index++){
    const spirit=sequence(f,'special',m.contacts[index],{awakened,awakenedUntil:20,actionSeq:9});expect(spirit.motionEvidence().clip).toBe('KIN KIN Barrage');const p=new THREE.Vector3();f.owner.meleeContactPoint(index,p);expect(p.distanceTo(spirit.joints.get(index%2?'LeftHand':'RightHand')!.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);
   }
  }finally{f.dispose();}
 });
 it('mirrors a missed opener and cancels the native spirit when the actor recovers',()=>{
  const f=fixture();try{const spirit=sequence(f,'ultimate',.65,{whiffedAt:1.55});expect(spirit.state.whiffedAt).toBe(1.55);expect(spirit.state.confirmedAt).toBeUndefined();for(let i=0;i<90;i++)f.tick({...f.state,action:'idle',actionStarted:2,actionSeq:3},2+i/120);expect(spirit.group.visible).toBe(false);expect(f.inner.timeFields.size).toBe(0);}finally{f.dispose();}
 });
 it('awakens with the human hair-check clip and a native spirit without replacing the human body',()=>{
  const f=fixture();try{for(let i=0;i<=180;i++){const t=i/120;f.tick({...f.state,awakened:true,awakenedUntil:20,action:t<AWAKENING_ENTRY?'awaken':'idle',actionStarted:1,actionSeq:2,actionDuration:AWAKENING_ENTRY,actionTime:Math.min(t/AWAKENING_ENTRY,1)},1+t);if(t<.8&&t>.1)expect(f.owner.motionEvidence().clip).toBe('MENDED IN GOLD');}expect(f.inner.spirits.get('owner')!.group.visible).toBe(true);expect(f.owner.model.visible).toBe(true);expect(f.owner.motionEvidence().formVisible).toBe(false);expect(f.inner.timeFields.size).toBe(0);}finally{f.dispose();}
 });
});
