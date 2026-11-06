import * as THREE from 'three';
import {beforeAll, expect, it} from 'vitest';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter} from '../src/render/Fighter';
import {SwordStandEffects, STAND_USERS} from '../src/render/SwordStandEffects';
import {KINU_REFERENCE_RETURN} from '../src/render/signature/KinuContactReference';
import {FIGHTERS} from '../src/config';
import {MOVES} from '../src/game/moves';
import type {FighterId, PlayerState} from '../src/game/types';
import {base, loadRig} from './rigHarness';

type ReturnState = {referenceReturn?:number; referenceFrom?:THREE.Vector3};
type Inner = {sources:Map<FighterId, GLTF>; stands:Map<string, Fighter>; looms:Map<string, ReturnState>};
let human:GLTF, source:GLTF, opponent:GLTF;
beforeAll(async()=>{
  [human,source,opponent]=await Promise.all([
    loadRig(FIGHTERS.kinu.model), loadRig(STAND_USERS.kinu!.asset), loadRig(FIGHTERS.shakugo.model),
  ]);
});

function fixture(){
  const state={...base('kinu'),id:'owner',target:'foe',awakened:true,awakenedUntil:100};
  const owner=new Fighter(state,human),foe=new Fighter({...base('shakugo'),id:'foe',z:2,yaw:Math.PI},opponent);
  const scene=new THREE.Scene();scene.add(owner.group,foe.group);owner.prepareRush();
  owner.targetPoint=new THREE.Vector3(0,1.2,2);owner.targetDistance=2;
  const effects=new SwordStandEffects(scene),inner=effects as unknown as Inner;
  inner.sources.set('kinu',source);
  const fighters=new Map([['owner',owner],['foe',foe]]);
  const camera=new THREE.PerspectiveCamera(46,16/9,.01,100);
  camera.position.set(-3.25,1.7,2.6);camera.lookAt(0,1.1,.6);camera.updateMatrixWorld(true);
  let time=0;
  const tick=(s:PlayerState)=>{
    time+=1/60;owner.update(1/60,s,true);foe.update(1/60,foe.state,true);
    effects.update(time,1/60,fighters,1,camera);
    return inner.stands.get('owner')!;
  };
  for(let i=0;i<120;i++)tick(state);
  return {state,owner,effects,inner,tick,dispose(){effects.dispose();owner.dispose();foe.dispose();}};
}

it.each(['special','ultimate'] as const)('visible %s partner returns continuously after the final native pose',slot=>{
  const f=fixture();
  try{
    const move=MOVES.kinu[slot];
    for(let i=0;i<=Math.ceil(move.duration*60);i++)f.tick({...f.state,action:slot,actionSeq:2,actionStarted:2,actionDuration:move.duration,actionTime:Math.min(1,i/60/move.duration),confirmedAt:slot==='ultimate'?2.5:undefined});
    let previous=f.inner.stands.get('owner')!.group.position.clone(),began=false,finished=false,maximum=0,firstDelta=Infinity;
    for(let i=0;i<75;i++){
      const stand=f.tick({...f.state,action:'idle',actionSeq:3,actionStarted:10});
      const returning=f.inner.looms.get('owner')!.referenceReturn!==undefined;
      const delta=stand.group.position.distanceTo(previous);
      if(returning&&!began){began=true;firstDelta=delta;}
      if(began){maximum=Math.max(maximum,delta);if(!returning)finished=true;}
      previous.copy(stand.group.position);
    }
    expect(began,'actual command-to-idle transition should start the return').toBe(true);
    expect(firstDelta,'the first idle frame retains the previous displayed root').toBeLessThan(1e-6);
    expect(maximum,'no single-frame lane teleport during the return').toBeLessThan(.26);
    expect(finished).toBe(true);
    expect(f.inner.looms.get('owner')!.referenceReturn).toBeUndefined();
    expect(KINU_REFERENCE_RETURN).toBeLessThan(.5);
  }finally{f.dispose();}
});

it('a new manual command cancels the return and reuses the entry vector',()=>{
  const f=fixture();
  try{
    const move=MOVES.kinu.special;
    for(let i=0;i<70;i++)f.tick({...f.state,action:'special',actionSeq:2,actionStarted:2,actionDuration:move.duration,actionTime:i/60/move.duration});
    for(let i=0;i<6;i++)f.tick({...f.state,action:'idle',actionSeq:3,actionStarted:4});
    const loom=f.inner.looms.get('owner')!,vector=loom.referenceFrom;
    expect(loom.referenceReturn).toBeDefined();
    f.tick({...f.state,action:'special',actionSeq:4,actionStarted:5,actionDuration:move.duration,actionTime:0});
    expect(loom.referenceReturn).toBeUndefined();
    expect(loom.referenceFrom).toBe(vector);
    f.effects.reset();expect(f.inner.looms.size).toBe(0);
  }finally{f.dispose();}
});
