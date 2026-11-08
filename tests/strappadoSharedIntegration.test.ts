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
beforeAll(async()=>{rig=await loadRig(FIGHTERS.strappado.model);},120000);
function fixture(){const f=new Fighter(base('strappado'),rig);f.prepareRush();f.targetPoint=new THREE.Vector3(0,1.3,2.2);f.targetDistance=2.2;for(let i=0;i<60;i++)f.update(1/120,base('strappado'),true);return f;}
function act(f:Fighter,slot:AttackSlot,time:number,extra:Partial<PlayerState>={}){
 const move=MOVES.strappado[slot],duration=extra.actionDuration??move.duration;
 for(let i=0;i<=Math.ceil(time*120);i++){const t=Math.min(time,i/120);f.update(1/120,{...base('strappado'),target:'foe',action:slot,actionStarted:1,actionSeq:2,actionDuration:duration,actionTime:t/duration,...extra},true);}
}
const event=(kind:CombatEvent['kind'],slot:AttackSlot='ultimate'):CombatEvent=>({id:4,kind,fighter:'strappado',slot,actorId:'a',serverTime:1,castAge:kind==='confirm'?.58:undefined});
describe('Strappado native laboratory integration',()=>{
 it.skipIf(!!ORIGINALS.strappado)('admits the reviewed fighter in release66/v10',()=>{
  expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);expect(LABORATORY_FIGHTERS).not.toContain('strappado');expect(mayPlay('strappado',undefined)).toBe(true);expect(factionOf('strappado')).toBe('villains');expect(hasRosterSignature('strappado')).toBe(true);
  expect(createHash('sha256').update(fs.readFileSync('public'+FIGHTERS.strappado.model)).digest('hex')).toBe('8fb07731f194893d00e38210e65f2d628987b8cd41f07c267d85a3103b59a2df');
  for(const file of ['home/fighters/strappado.webp','home/portraits/strappado.webp','home/sprites/strappado.webp','home/sprites/strappado-poster.webp','ui/moves/strappado.webp'])expect(fs.existsSync('public/assets/'+file),file).toBe(true);
  const sprites=JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json','utf8')).fighters.find((r:{id:string})=>r.id==='strappado');expect(sprites.frames).toHaveLength(sprites.frameCount??16);for(const[key,hash]of [['file','sha256'],['poster','posterSha256']]as const)expect(createHash('sha256').update(fs.readFileSync('public/assets/home/sprites/'+sprites[key])).digest('hex')).toBe(sprites[hash]);
 });
 it('uses the real hand, left-foot native kick and emission hand, preserving the raised leg',()=>{
  for(const[slot,socket]of [['light','RightHand'],['heavy','LeftToeBase'],['special','RightHand']]as const){const f=fixture();try{act(f,slot,MOVES.strappado[slot].contacts[0]);const p=new THREE.Vector3(),expected=f.joints.get(socket)!.getWorldPosition(new THREE.Vector3());expect(f.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-6);expect(f.chargePosition(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-6);expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-6);expect(f.motionEvidence().clip).toBe(FIGHTERS.strappado.clips![['light','heavy','special'].indexOf(slot)]);if(slot==='heavy')expect(expected.y-f.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(.2);}finally{f.dispose();}}
 });
 it('uses right/right/both native contact sockets throughout the confirmed Curtain Call montage',()=>{
  const f=fixture();try{for(let index=0;index<3;index++){act(f,'ultimate',MOVES.strappado.ultimate.contacts[index],index?{confirmedAt:1.56}:{});const expected=index===2?f.handL.clone().lerp(f.handR,.5):f.handR,p=new THREE.Vector3();expect(f.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-6);expect(f.motionEvidence().clip).toBe('Curtain Call');expect(f.motionEvidence().formVisible).toBe(false);}}finally{f.dispose();}
 });
 it('retains named manual branch clips and the airborne left-foot ender',()=>{
  const rows=[['lh','Marionette Reversal','LeftHand'],['llh','Wire Guillotine','RightHand'],['lllh','Spool Burst','RightHand'],['llls','Puppeteer\'s Snare','Both'],['airHeavy','Highwire Heel','LeftToeBase'],['airSpecial','Trapdoor Drop','Both']]as const;
  for(const[branch,clip,socket]of rows){const f=fixture(),m=comboMove('strappado',branch)!;try{act(f,COMBO_SLOT[branch],m.contacts[0],{branch,actionDuration:m.duration,grounded:!branch.startsWith('air'),y:branch.startsWith('air')?1.2:0});expect(f.motionEvidence().clip).toBe(clip);const expected=socket==='Both'?f.handL.clone().lerp(f.handR,.5):f.joints.get(socket)!.getWorldPosition(new THREE.Vector3());expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-6);}finally{f.dispose();}}
 });
 it('plays its own SHOWSTOPPER entry with moving hands and no body swap',()=>{
  const f=fixture(),samples:THREE.Vector3[]=[];try{for(let i=0;i<108;i++){f.update(1/120,{...base('strappado'),awakened:true,awakenedUntil:20,action:'awaken',actionStarted:1,actionSeq:2,actionDuration:AWAKENING_ENTRY,actionTime:i/120/AWAKENING_ENTRY},true);if(i>15&&i<90)expect(f.motionEvidence().clip).toBe('SHOWSTOPPER');samples.push(f.handR.clone());expect(f.motionEvidence().formVisible).toBe(false);}expect(Math.max(...samples.map(p=>p.distanceTo(samples[0])))).toBeGreaterThan(.3);}finally{f.dispose();}
 });
 it.each([['ultimate',2,300],['ultimate',18,0],[undefined,1.3,0]]as const)('manual%s at distance%s emits only its confirmed damage', (slot,distance,total)=>{
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:53});sim.addPlayer('a','strappado','A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:distance});sim.actors.get('a')!.state.ultimate=100;const events:CombatEvent[]=[];
  try{for(let i=0;i<330;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:distance<9?'b':null,attack:i===0?slot:undefined});sim.step(1/60);events.push(...sim.drainEvents());}const hits=events.filter(e=>e.actorId==='a'&&e.kind==='hit');expect(hits.reduce((sum,e)=>sum+(e.damage??0),0)).toBe(total);if(total)expect(hits.map(e=>e.contactIndex)).toEqual([0,1,2]);else expect(events.filter(e=>e.kind==='confirm')).toHaveLength(0);}finally{sim.dispose();}
 });
});
