import fs from 'node:fs';
import {describe,it,expect}from 'vitest';
import * as THREE from 'three';
import {GLTFLoader}from 'three/addons/loaders/GLTFLoader.js';
import {FIGHTERS}from '../src/config';
import {Fighter}from '../src/render/Fighter';
import {MOVES}from '../src/game/moves';
import {ArenaSimulation}from '../src/game/simulation';
import type{PlayerState,AttackSlot}from '../src/game/types';
import {LUCY_TIDE}from '../src/originals/lucyTide';
async function asset(filePath:string){
  const file = fs.readFileSync(`public${filePath}`), length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  delete json.images; delete json.textures; delete json.samplers;
  const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const tail = file.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
  return await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
}
const state:PlayerState={id:'gummy',name:'Gummy',fighter:'gummy',x:0,y:0,z:0,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:100,action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,cooldowns:{light:0,heavy:0,special:0,ultimate:0}};
describe('Gummy sourced rigs and four signature moves',()=>{
 it('plays a distinct authored clip per slot and keeps the arm attached',async()=>{
  // His forearm was once skinned to the Rubber stretch chain, which pulls away
  // from the elbow and left the fist floating in every attack; the body's build
  // binds it to the elbow and hand. A rigid elbow-to-hand span is the
  // regression guard for that, so assert it at every contact.
  const source=await asset(FIGHTERS.gummy.model),f=new Fighter({...state},source);
  // The clip's own arm: the Rubber stretch at the blow is procedural now
  // and has its own guard (tests/gummyStretch.test.ts). What this asserts is
  // that the forearm the clips drive stays whole - the regression it was
  // written for - so the procedural layer is off here.
  f.dynamics=false;
  try{
   const clips=new Set<string>(),spans:number[]=[];
   // The ultimate's cinematic is SUNRISE's (the base body is hidden for it), so its clip is the form's,
   // asserted below; the base body's own three are distinct.
   for(const slot of ['light','heavy','special'] as AttackSlot[]){
    const move=MOVES.gummy[slot];
    // The ultimate's own clip is its cinematic's (the opener is thrown with
    // the Bazooka's): sampled on its finisher, landed.
    const at=slot==='ultimate'?move.contacts[move.contacts.length-1]:move.contacts[0];
    f.update(.2,{...state,action:slot,actionStarted:1,actionDuration:move.duration,actionTime:at/move.duration,...(slot==='ultimate'?{confirmedAt:1+move.contacts[0]}:{})},true);
    clips.add(f.motionEvidence().clip!);
    const elbow=f.bones.get('rightforearm')!.getWorldPosition(new THREE.Vector3());
    const hand=f.bones.get('righthand')!.getWorldPosition(new THREE.Vector3());
    spans.push(elbow.distanceTo(hand));
    // A hand that is scaled is a hand being stretched by a chain that no
    // longer drives geometry.
    expect(f.bones.get('righthand')!.getWorldScale(new THREE.Vector3()).toArray().every(v=>v>.9&&v<1.1)).toBe(true);
   }
   expect(clips.size).toBe(3);
   // Same rest span at every contact: the forearm follows the arm, not the
   // stretch chain.
   expect(Math.max(...spans)-Math.min(...spans)).toBeLessThan(.02);
   // The striking hand still leads the body on the grounded melee slots.
   // The light's. The heavy is the Bazooka: both palms, its reach the rubber's - tests/gummyRound5.test.ts.
   for(const slot of ['light'] as AttackSlot[]){
    const move=MOVES.gummy[slot];
    f.update(.2,{...state,action:slot,actionStarted:1,actionDuration:move.duration,actionTime:move.contacts[0]/move.duration},true);
    // The root clamp trades some of the clip's authored lunge for staying near
    // the gameplay position; the fist still clearly leads the body.
    expect(f.handR.z).toBeGreaterThan(2);
    expect(f.handR.z).toBeLessThanOrEqual(MOVES.gummy[slot].range+2);
   }
   const form=await asset(FIGHTERS.gummy.formModel!);f.attachForm(form);
   // The form is the cinematic's: SUNRISE, playing its own SPRING TIDE take, on from the first frame
   // (render/gummy/spring-tide.ts), and throwing the opener too.
   f.update(.2,{...state,action:'ultimate',actionStarted:2,actionDuration:MOVES.gummy.ultimate.duration,actionTime:.01},true);expect(f.model.visible,'Gummy himself, on the press').toBe(true);
   if(LUCY_TIDE){ // Gummy throws Spring Tide in his own body, his own take through the confirm
    f.update(.2,{...state,action:'ultimate',actionStarted:2,actionDuration:MOVES.gummy.ultimate.duration,actionTime:.1},true);expect(f.model.visible,'Gummy himself, the opener his own').toBe(true);
    f.update(.2,{...state,action:'ultimate',actionStarted:2,actionDuration:MOVES.gummy.ultimate.duration,actionTime:.6,confirmedAt:2.55},true);expect(f.model.visible).toBe(true);expect((f as unknown as {awakenedForm:Fighter}).awakenedForm.group.visible,'no form for it').toBe(false); // (its take is lucy-pxtide1.glb's, an extra file this body is loaded without)
   }else{
   f.update(.2,{...state,action:'ultimate',actionStarted:2,actionDuration:MOVES.gummy.ultimate.duration,actionTime:.1},true);expect(f.model.visible,'and SUNRISE at once, the opener its own').toBe(false);
   f.update(.2,{...state,action:'ultimate',actionStarted:2,actionDuration:MOVES.gummy.ultimate.duration,actionTime:.6,confirmedAt:2.55},true);expect(f.model.visible).toBe(false);
   const shown=(f as unknown as {awakenedForm:Fighter}).awakenedForm;expect(shown.group.visible).toBe(true);expect(shown.motionEvidence().clip).toBe('Sunrise Tide');
   }
   f.update(.2,{...state},true);expect(f.model.visible).toBe(true);
  }finally{f.dispose();}
 });
 for(const slot of ['light','heavy','special','ultimate']as AttackSlot[])it(slot+' only damages at its authoritative contact and whiffs beyond reach',()=>{
  for(const hit of [true,false]){
   const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:7}),move=MOVES.gummy[slot];sim.addPlayer('a','gummy','Gummy',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','Taisei',false,{x:0,y:0,z:hit?2:slot==='special'?move.range+4:12});sim.actors.get('a')!.state.ultimate=100;
   sim.submitInput('a',{seq:1,moveX:0,moveZ:0,yaw:0,attack:slot});
   // Round 4b (GUMMY): the special is a line of fists out to 16 m: beyond reach is past that, and the window holds
   // its first fist alone (the next is 0.09 s on).
   for(let t=0;t<Math.floor((move.contacts[0]-.03)*60);t++)sim.step();expect(sim.getPlayer('b')!.hp).toBe(1000);
   for(let t=0;t<(slot==='special'?4:10);t++)sim.step();expect(sim.getPlayer('b')!.hp).toBe(hit?1000-move.damage:1000);
  }
 });
});
