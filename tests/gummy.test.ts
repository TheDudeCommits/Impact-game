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
