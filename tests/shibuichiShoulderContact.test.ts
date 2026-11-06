import*as THREE from'three';
import{beforeAll,expect,it}from'vitest';
import type{GLTF}from'three/addons/loaders/GLTFLoader.js';
import{Fighter}from'../src/render/Fighter';
import{FIGHTERS}from'../src/config';
import{ArenaSimulation}from'../src/game/simulation';
import type{PlayerState}from'../src/game/types';
import{base,loadRig}from'./rigHarness';
import captured from'./fixtures/shibuichiShoulderApproach.json';
import { ORIGINALS } from '../src/originals/roster';
let model:GLTF,targetModel:GLTF;
beforeAll(async()=>{[model,targetModel]=await Promise.all([loadRig(process.env.SHIBUICHI_CONTACT_MODEL??FIGHTERS['shibuichi'].model),loadRig(FIGHTERS.irbis.model)]);});
const TORSO=/^(Hips|Spine\d*|Neck)$/;
const PAULDRON=/^(LeftArm|LeftShoulder)$|Bip001_L_Clavicle_Bone001_034|L_UpperArm_Bone002_033/;
function skin(f:Fighter,selection:RegExp){const points:THREE.Vector3[]=[];f.group.updateWorldMatrix(true,true);f.model.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh)||o.name.endsWith('-ink'))return;o.skeleton.update();const a=o.geometry.attributes,p=new THREE.Vector3();if(!a.skinIndex)return;for(let i=0;i<a.position.count;i++){let weight=0;for(let j=0;j<4;j++)if(selection.test(o.skeleton.bones[a.skinIndex.getComponent(i,j)].name))weight+=a.skinWeight.getComponent(i,j);if(weight>=.65){o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld);points.push(p.clone());}}});return points;}
function distance(a:THREE.Vector3[],b:THREE.Vector3[]){let min=Infinity;for(const p of a)for(const q of b)min=Math.min(min,p.distanceTo(q));return min;}
function inspect(f:Fighter,o:Fighter){const opponent=skin(o,TORSO),shoulder=skin(f,PAULDRON);let closest=Infinity,pair:number[][]=[];for(const p of shoulder)for(const q of opponent)if(p.distanceTo(q)<closest){closest=p.distanceTo(q);pair=[p.toArray(),q.toArray()];}expect(closest,'actual pauldron surface reaches target skin '+JSON.stringify(pair)).toBeLessThan(.045);expect(distance(skin(f,TORSO),opponent),'central armor and defender bodies remain separated').toBeGreaterThan(.09);}
it.skipIf(!!ORIGINALS['shibuichi'])('preserves real recorded early-hit and held native poses with planted shoulder contact',()=>{
 const initial={...base('shibuichi'),...captured.before.me,id:'a'}as PlayerState,enemy={...base('irbis'),...captured.before.foe,id:'b'}as PlayerState;
 const f=new Fighter(initial,model),o=new Fighter(enemy,targetModel);f.prepareRush();
 // Captures sample the actual rendered source clock. Replay it through the
 // real native pose, root limits, stride and contact layers, not a static rig.
 type ClockHook={contactCurve:(state:PlayerState,clip?:THREE.AnimationClip)=>number|null};
 const hook=f as unknown as ClockHook,original=hook.contactCurve.bind(f);let sourceClock:number|undefined;
 hook.contactCurve=(s,c)=>sourceClock===undefined?original(s,c):sourceClock/(c?.duration??model.animations.find(a=>a.name==='Billet Ram')!.duration);
 let last=0,impact=false,checks=0;
 try{
  for(let i=0;i<60;i++){f.update(1/60,{...initial},true);o.update(1/60,{...enemy},true);Fighter.settleContacts();}
  for(const frame of captured.frames){const dt=Math.max(.001,(frame.ms-last)/1000);last=frame.ms;sourceClock=frame.motion.clipTime??undefined;
   const state={...initial,...frame.me,action:frame.motion.action,actionTime:frame.motion.elapsed/1.14,actionDuration:frame.motion.action==='heavy'?1.14:0,actionStarted:2,actionSeq:2}as PlayerState;
   const target={...enemy,...frame.foe,action:'idle'}as PlayerState;
   f.targetPoint=new THREE.Vector3(target.x,target.y+1.2,target.z);f.targetDistance=Math.hypot(target.x-state.x,target.z-state.z);
   if(frame.foe.hp<1500&&!impact){f.impact(false,'heavy',undefined,0,new THREE.Vector3(0,0,-1),75);impact=true;}
   o.update(dt,target,true);f.update(dt,state,true);Fighter.settleContacts();
   if(frame.file==='0019.jpg'||frame.file==='0020.jpg'||frame.file==='0021.jpg'||frame.file==='0022.jpg'){expect(f.motionEvidence().clipTime).toBeCloseTo(frame.motion.clipTime!,6);inspect(f,o);checks++;}
  }
  expect(checks).toBe(4);
 }finally{f.dispose();o.dispose();}
});
it.skipIf(!!ORIGINALS['shibuichi']).each([1.26,2.447])('authoritative shoulder approach from%s lands on armor under attacker hitstop',start=>{
 const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:78});sim.addPlayer('a','shibuichi','A',false,{x:0,y:0,z:start});sim.addPlayer('b','irbis','B',false,{x:0,y:0,z:0});sim.actors.get('a')!.state.yaw=Math.PI;
 const f=new Fighter({...sim.actors.get('a')!.state},model),o=new Fighter({...sim.actors.get('b')!.state},targetModel);f.prepareRush();let contacts=0;
 try{for(let i=0;i<60;i++){f.update(1/60,{...sim.actors.get('a')!.state},true);o.update(1/60,{...sim.actors.get('b')!.state},true);Fighter.settleContacts();}
  for(let i=0;i<90;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:Math.PI,targetId:'b',attack:i===0?'heavy':undefined});sim.step(1/60);const events=sim.drainEvents(),a={...sim.actors.get('a')!.state},b={...sim.actors.get('b')!.state};
   for(const e of events)if(e.actorId==='a'&&e.kind==='hit')f.impact(false,'heavy',undefined,e.contactIndex,new THREE.Vector3(0,0,-1),e.damage);
   f.targetPoint=new THREE.Vector3(b.x,b.y+1.2,b.z);f.targetDistance=Math.hypot(a.x-b.x,a.z-b.z);o.update(1/60,{...b,action:'idle',actionTime:0,actionDuration:0},true);f.update(1/60,a,true);Fighter.settleContacts();
   if(events.some(e=>e.actorId==='a'&&e.kind==='hit')){inspect(f,o);contacts++;}
  }expect(contacts).toBe(1);
 }finally{f.dispose();o.dispose();sim.dispose();}
});
