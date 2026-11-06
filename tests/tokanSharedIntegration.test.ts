import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import * as THREE from 'three';
import fs from 'node:fs';
import {createHash}from 'node:crypto';
import {beforeAll,describe,expect,it}from 'vitest';
import {Fighter}from '../src/render/Fighter';
import {FIGHTERS}from '../src/config';
import {MOVES}from '../src/game/moves';
import {comboMove,COMBO_SLOT}from '../src/game/combos';
import {AWAKENING_ENTRY}from '../src/game/awakening';
import {ArenaSimulation}from '../src/game/simulation';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS}from '../src/game/rosterAvailability';
import {ROSTER_PROTOCOL}from '../src/game/rosterProtocol';
import {mayPlay}from '../src/game/economy/fighters';
import {factionOf}from '../src/game/objectives/model';
import {hasRosterSignature}from '../src/render/signature/RosterSignatureSet';
import {planCombatAudio,cueDuration}from '../src/audio/cuePlan';
import {planSfx}from '../src/audio/sfxPlan';
import type{PlayerState,AttackSlot,CombatEvent}from '../src/game/types';
import {base,loadRig}from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
let rig:Awaited<ReturnType<typeof loadRig>>;
beforeAll(async()=>{rig=await loadRig(FIGHTERS.tokan.model);},120000);
function fixture(){const f=new Fighter(base('tokan'),rig);f.prepareRush();f.targetPoint=new THREE.Vector3(0,1.3,2.2);f.targetDistance=2.2;for(let i=0;i<60;i++)f.update(1/120,base('tokan'),true);return f;}
function act(f:Fighter,slot:AttackSlot,time:number,extra:Partial<PlayerState>={}){
 const move=MOVES.tokan[slot],duration=extra.actionDuration??move.duration;
 for(let i=0;i<=Math.ceil(time*120);i++){const t=Math.min(time,i/120);f.update(1/120,{...base('tokan'),target:'foe',action:slot,actionStarted:1,actionSeq:2,actionDuration:duration,actionTime:t/duration,...extra},true);}
}
const event=(kind:CombatEvent['kind'],slot:AttackSlot='ultimate'):CombatEvent=>({id:4,kind,fighter:'tokan',slot,actorId:'a',serverTime:1,castAge:kind==='confirm'?.58:undefined});
describe('Tokan native laboratory integration',()=>{
 it.skipIf(!!ORIGINALS.tokan)('admits the reviewed fighter in release66/v10',()=>{
  expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);expect(LABORATORY_FIGHTERS).not.toContain('tokan');expect(mayPlay('tokan',undefined)).toBe(true);expect(factionOf('tokan')).toBe('villains');expect(hasRosterSignature('tokan')).toBe(true);
  expect(createHash('sha256').update(fs.readFileSync('public'+FIGHTERS.tokan.model)).digest('hex')).toBe('3f637d362bd7b181c2823ec35156f75f48404467a4b371c09fda76787bf2b3d1');
  for(const file of ['home/fighters/tokan.webp','home/portraits/tokan.webp','home/sprites/tokan.webp','home/sprites/tokan-poster.webp','ui/moves/tokan.webp'])expect(fs.existsSync('public/assets/'+file),file).toBe(true);
  const sprites=JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json','utf8')).fighters.find((r:{id:string})=>r.id==='tokan');expect(sprites.frames).toHaveLength(sprites.frameCount??16);for(const[key,hash]of [['file','sha256'],['poster','posterSha256']]as const)expect(createHash('sha256').update(fs.readFileSync('public/assets/home/sprites/'+sprites[key])).digest('hex')).toBe(sprites[hash]);
 });
 const saber=(f:Fighter)=>new THREE.Vector3(...[-2.359993817035999e-7,2.8975778887385673e-8,2.280358785851126]as[number,number,number]).applyMatrix4(f.joints.get('TokanSaber')!.matrixWorld);
 const variants=(f:Fighter)=>['Tokan_Closed_Left','Tokan_Open_Left','Tokan_Closed_Right','Tokan_Open_Right','Tokan_Frostbite_Cut'].filter(n=>f.model.getObjectByName(n)?.visible);
 it.skipIf(!!ORIGINALS.tokan)('uses the real saber tip, left-foot kick and bare emission hand without a sword through the leg',()=>{
  for(const slot of ['light','heavy','special']as const){const f=fixture();try{act(f,slot,MOVES.tokan[slot].contacts[0]);const expected=slot==='light'?saber(f):slot==='heavy'?f.joints.get('LeftFoot')!.getWorldPosition(new THREE.Vector3()):f.handR,p=new THREE.Vector3();expect(f.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-6);expect(f.chargePosition(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-6);expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-6);expect(f.motionEvidence().clip).toBe(FIGHTERS.tokan.clips![['light','heavy','special'].indexOf(slot)]);
   expect(variants(f)).toEqual(slot==='light'?['Tokan_Open_Left','Tokan_Closed_Right','Tokan_Frostbite_Cut']:slot==='heavy'?['Tokan_Open_Left','Tokan_Closed_Right']:['Tokan_Open_Left','Tokan_Open_Right']);if(slot==='heavy')expect(expected.y-f.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(.1);
  }finally{f.dispose();}}
 });
 it.skipIf(!!ORIGINALS.tokan)('uses saber, native left kick then open palm at the confirmed Winter Sleep contacts',()=>{
  const f=fixture();try{for(let index=0;index<3;index++){act(f,'ultimate',MOVES.tokan.ultimate.contacts[index],index?{confirmedAt:.46}:{});const expected=index===0?saber(f):index===1?f.joints.get('LeftFoot')!.getWorldPosition(new THREE.Vector3()):f.handR,p=new THREE.Vector3();expect(f.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-6);expect(f.motionEvidence().clip).toBe('Winter Sleep');expect(f.model.getObjectByName('Tokan_Frostbite_Cut')!.visible).toBe(index===0);}}finally{f.dispose();}
 });
 it.skipIf(!!ORIGINALS.tokan)('preserves named branch and airborne kicks and restores the saber after recovery',()=>{
  for(const[branch,clip]of [['lh','Icicle Thrust'],['llh','Snowdrift Rise'],['lllh','Floe Cleave'],['llls','Plume Follow-up'],['airHeavy','Aerial Frostbite'],['airSpecial','Floe Descent']]as const){const f=fixture(),m=comboMove('tokan',branch)!;try{act(f,COMBO_SLOT[branch],m.contacts[0],{branch,actionDuration:m.duration,grounded:!branch.startsWith('air'),y:branch.startsWith('air')?1.2:0});expect(f.motionEvidence().clip).toBe(clip);expect(f.model.getObjectByName('Tokan_Frostbite_Cut')!.visible).toBe(!['llh','llls','airSpecial'].includes(branch));for(let i=0;i<40;i++)f.update(1/120,base('tokan'),true);expect(variants(f)).toEqual(['Tokan_Open_Left','Tokan_Closed_Right','Tokan_Frostbite_Cut']);}finally{f.dispose();}}
 });
 it.each([['ultimate',2,300],['ultimate',18,0],[undefined,1.3,0]]as const)('manual%s at distance%s emits only its confirmed damage', (slot,distance,total)=>{
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:53});sim.addPlayer('a','tokan','A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:distance});sim.actors.get('a')!.state.ultimate=100;const events:CombatEvent[]=[];
  try{for(let i=0;i<330;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:distance<9?'b':null,attack:i===0?slot:undefined});sim.step(1/60);events.push(...sim.drainEvents());}const hits=events.filter(e=>e.actorId==='a'&&e.kind==='hit');expect(hits.reduce((sum,e)=>sum+(e.damage??0),0)).toBe(total);if(total)expect(hits.map(e=>e.contactIndex)).toEqual([0,1,2]);else expect(events.filter(e=>e.kind==='confirm')).toHaveLength(0);}finally{sim.dispose();}
 });
});
