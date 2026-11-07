import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import * as THREE from 'three';
import fs from 'node:fs';
import {beforeAll,describe,expect,it}from 'vitest';
import {Fighter}from '../src/render/Fighter';
import {FIGHTERS}from '../src/config';
import {MOVES}from '../src/game/moves';
import {AWAKENING_ENTRY}from '../src/game/awakening';
import {ArenaSimulation}from '../src/game/simulation';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS}from '../src/game/rosterAvailability';
import {ROSTER_PROTOCOL}from '../src/game/rosterProtocol';
import {mayPlay}from '../src/game/economy/fighters';
import {factionOf}from '../src/game/objectives/model';
import {UnariElastic}from '../src/render/signature/UnariElastic';
import {hasRosterSignature}from '../src/render/signature/RosterSignatureSet';
import type{PlayerState,AttackSlot,CombatEvent}from '../src/game/types';
import {base,loadRig}from './rigHarness';
import { fighterShown } from '../src/originals/launch';
let rig:Awaited<ReturnType<typeof loadRig>>;
beforeAll(async()=>{rig=await loadRig(FIGHTERS.unari.model);},120000);
function act(f:Fighter,slot:AttackSlot,time:number,extra:Partial<PlayerState>={}){
 const move=MOVES.unari[slot];for(let i=0;i<=Math.ceil(time*120);i++){const t=Math.min(time,i/120);f.update(1/120,{...base('unari'),target:'foe',action:slot,actionStarted:1,actionSeq:2,actionDuration:move.duration,actionTime:t/move.duration,...extra},true);}
}
describe('Unari laboratory native gestures, card grip and manual receipts',()=>{
 it('admits reviewed Unari in release66/v10',()=>{
  expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);expect(LABORATORY_FIGHTERS).not.toContain('unari');expect(mayPlay('unari',{items:{'fighter-unari':{at:0}}})).toBe(fighterShown('unari'));expect(mayPlay('unari',undefined)).toBe(false);expect(factionOf('unari')).toBe('villains');expect(hasRosterSignature('unari')).toBe(true);
  for(const file of ['fighters/unari.webp','portraits/unari.webp','sprites/unari.webp','sprites/unari-poster.webp'])expect(fs.existsSync('public/assets/home/'+file)).toBe(true);
 });
 it('uses real right card hand and left heavy palm on the final exported rig',()=>{
  const f=new Fighter(base('unari'),rig);f.prepareRush();try{for(const slot of ['light','heavy','special']as const){act(f,slot,MOVES.unari[slot].contacts[0]);const joint=f.joints.get(slot==='heavy'?'LeftHand':'RightHand')!,expected=joint.getWorldPosition(new THREE.Vector3()),p=new THREE.Vector3();expect(f.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-6);expect(f.chargePosition(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-6);expect(f.motionEvidence().clip).toBe(FIGHTERS.unari.clips![(['light','heavy','special']as const).indexOf(slot)]);}
  for(const name of ['RightHandIndex1','RightHandIndex2','RightHandMiddle2'])expect(f.bones.get(name.toLowerCase())).toBeDefined();}finally{f.dispose();}
 });
 it('draws a held card at the actual convergent fingers through idle and entry',()=>{
  const f=new Fighter(base('unari'),rig),scene=new THREE.Scene(),fx=new UnariElastic(scene,{budget:1});
  try{for(const action of ['idle','awaken']as const){for(let i=0;i<60;i++)f.update(1/120,{...base('unari'),action,actionStarted:1,actionSeq:2,actionDuration:action==='awaken'?AWAKENING_ENTRY:0,actionTime:action==='awaken'?i/120/AWAKENING_ENTRY:0},true);
   fx.update(1.5,new Map([['m',f]]));const cards=scene.getObjectByName('unari-cards')as THREE.InstancedMesh;expect(cards.count).toBe(1);const matrix=new THREE.Matrix4();cards.getMatrixAt(0,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix),a=f.bones.get('righthandindex2')!.getWorldPosition(new THREE.Vector3()),b=f.bones.get('righthandmiddle2')!.getWorldPosition(new THREE.Vector3());expect(p.distanceTo(a.lerp(b,.5))).toBeLessThan(.05);
  }}finally{fx.dispose();f.dispose();}
 });
 it('alternates exact native ultimate palms and preserves the left-hand finale',()=>{
  const f=new Fighter(base('unari'),rig);f.prepareRush();try{for(let index=0;index<8;index++){act(f,'ultimate',MOVES.unari.ultimate.contacts[index],index?{confirmedAt:1.58}:{});const p=new THREE.Vector3();expect(f.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(f.joints.get(index%2?'LeftHand':'RightHand')!.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);expect(f.strikePoint(new THREE.Vector3()).distanceTo(p)).toBeLessThan(1e-6);expect(f.motionEvidence().clip).toBe('AYATORI: Cat\'s Cradle');expect(f.motionEvidence().formVisible).toBe(false);}}finally{f.dispose();}
 });
 it('plays card-to-cheek Aura acting with its own body intact',()=>{
  const f=new Fighter(base('unari'),rig);try{const samples:THREE.Vector3[]=[];for(let i=0;i<108;i++){f.update(1/120,{...base('unari'),awakened:true,awakenedUntil:20,action:'awaken',actionStarted:1,actionSeq:2,actionDuration:AWAKENING_ENTRY,actionTime:i/120/AWAKENING_ENTRY},true);if(i>15&&i<90)expect(f.motionEvidence().clip).toBe('Magicians Malice');samples.push(f.handR.clone());}expect(Math.max(...samples.map(p=>p.distanceTo(samples[0])))).toBeGreaterThan(.3);expect(f.motionEvidence().formVisible).toBe(false);expect(f.model.visible).toBe(true);}finally{f.dispose();}
 });
 it.each([['ultimate',2,290],['ultimate',18,0],[undefined,1.3,0]]as const)('manual %s at distance%s produces only its confirmed damage budget', (slot,distance,total)=>{
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:53});sim.addPlayer('a','unari','A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:distance});sim.actors.get('a')!.state.ultimate=100;const events:CombatEvent[]=[];
  try{for(let i=0;i<300;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:distance<9?'b':null,attack:i===0?slot:undefined});sim.step(1/60);events.push(...sim.drainEvents());}const hits=events.filter(e=>e.actorId==='a'&&e.kind==='hit');expect(hits.reduce((sum,e)=>sum+(e.damage??0),0)).toBe(total);if(total)expect(hits.map(e=>e.contactIndex)).toEqual([0,1,2,3,4,5,6,7]);else expect(events.filter(e=>e.kind==='confirm')).toHaveLength(0);}finally{sim.dispose();}
 });
});
