import * as THREE from 'three';
import {beforeAll,it,expect} from 'vitest';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter} from '../src/render/Fighter';
import {FIGHTERS} from '../src/config';
import type {PlayerState} from '../src/game/types';
import {base,loadRig} from './rigHarness';
let model:GLTF,hagure:GLTF,moonless:GLTF;
beforeAll(async()=>{[model,hagure,moonless]=await Promise.all([loadRig(FIGHTERS['ovid'].model),loadRig(FIGHTERS.hagure.model),loadRig(FIGHTERS.hagure.formModel!)]);});
type SmearBody={smear:{motion:{value:THREE.Vector4}};smearSeen:boolean;stepRepeat:boolean;updateSmear(state:PlayerState,real:number):void};
it.each([false,true])('Ovid native fist clears stale stepped smear in base/resolve: %s',awakened=>{
 const state={...base('ovid'),awakened,awakenedUntil:awakened?100:undefined},f=new Fighter(state,model);
 try{
  const body=f as unknown as SmearBody;
  body.smear.motion.value.set(1,0,0,.8);body.smearSeen=true;body.stepRepeat=true;
  body.updateSmear(state,1/60);
  expect(body.smear.motion.value.w).toBe(0);expect(body.smearSeen).toBe(false);
 }finally{f.dispose();}
});
it.each([false,true])('Hagure native palm clears stale stepped smear in human/Moonless: %s',form=>{
 const state={...base('hagure'),awakened:form,awakenedUntil:form?100:undefined},f=new Fighter(state,form?moonless:hagure,form);
 try{
  const body=f as unknown as SmearBody;
  body.smear.motion.value.set(1,0,0,.8);body.smearSeen=true;body.stepRepeat=true;
  body.updateSmear(state,1/60);
  expect(body.smear.motion.value.w).toBe(0);expect(body.smearSeen).toBe(false);
 }finally{f.dispose();}
});
