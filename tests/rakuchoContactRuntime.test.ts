import*as THREE from'three';
import fs from'node:fs';
import{beforeAll,expect,it}from'vitest';
import type{GLTF}from'three/addons/loaders/GLTFLoader.js';
import{Fighter}from'../src/render/Fighter';
import{FIGHTERS}from'../src/config';
import{MOVES}from'../src/game/moves';
import{ArenaSimulation}from'../src/game/simulation';
import{loadRig}from'./rigHarness';
import{nativeJoint}from'./fighterContactGeometry';
let model:GLTF,form:GLTF,targetModel:GLTF;
beforeAll(async()=>{[model,form,targetModel]=await Promise.all([
 loadRig(process.env.RAKUCHO_CONTACT_BASE??FIGHTERS['rakucho'].model),
 loadRig(process.env.RAKUCHO_CONTACT_FORM??FIGHTERS['rakucho'].formModel!),
 loadRig(FIGHTERS.kusushi.model),
]);});
/** The actual deformed surfaces, including fingers and the currently visible body. A rig helper (rfx_*) counts as its native joint, as in fighterContactGeometry. */
function skin(f:Fighter,selection:RegExp){const points:THREE.Vector3[]=[];f.group.updateWorldMatrix(true,true);f.shownBody.model.traverse(o=>{
 if(!(o instanceof THREE.SkinnedMesh)||o.name.endsWith('-ink'))return;o.skeleton.update();const a=o.geometry.attributes,p=new THREE.Vector3();if(!a.skinIndex)return;
 for(let i=0;i<a.position.count;i++){let weight=0;for(let j=0;j<4;j++)if(selection.test(nativeJoint(o.skeleton.bones[a.skinIndex.getComponent(i,j)].name)))weight+=a.skinWeight.getComponent(i,j);
  if(weight<.65)continue;o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld);points.push(p.clone());}
 });return points;}
function distance(a:THREE.Vector3[],b:THREE.Vector3[]){let min=Infinity;for(const p of a)for(const q of b)min=Math.min(min,p.distanceTo(q));return min;}
const TORSO=/^(Hips|Spine\d*|Neck)$/;
/** Kusushi's rig has 1519 of its skin weights relaxed (rest pose untouched: 0 of 10498 vertices and no bone moved), which sets the chest at idle
 * 0.54-0.58 mm further from the fist in all four cases (the gaps before -> after: form=false 1.14 .04347 -> .04401, 2.476 .04516 -> .04572, form=true 1.14 .04255 -> .04312, 2.476 .04452 -> .04510).
 * The .045 line follows the chest back by that 0.6 mm, so each case keeps the margin it had. */
const KUSUSHI_TORSO_BACK=.0006;
it.each([false,true].flatMap(awakened=>[1.14,2.476].map(start=>({awakened,start}))))('actual Rakucho jab skin reaches the opponent under hitstop; form=$awakened start=$start',({awakened,start})=>{
 const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:73});sim.addPlayer('a','rakucho','A',false,{x:0,y:0,z:start});sim.addPlayer('b','kusushi','B',false,{x:0,y:0,z:0});
 const initial=sim.actors.get('a')!.state;initial.yaw=Math.PI;initial.awakened=awakened;initial.awakenedUntil=100;
 const f=new Fighter({...initial},model),o=new Fighter({...sim.actors.get('b')!.state},targetModel);f.attachForm(form);f.prepareRush();let hits=0;
 try{
  for(let i=0;i<60;i++){f.update(1/60,{...initial},true);o.update(1/60,{...sim.actors.get('b')!.state},true);Fighter.settleContacts();}
  for(let i=0;i<40;i++){
   sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:Math.PI,targetId:'b',attack:i===0?'light':undefined});sim.step(1/60);
   const events=sim.drainEvents(),a={...sim.actors.get('a')!.state},b={...sim.actors.get('b')!.state};
   // main.ts presents the attacker impact before its next body update. This
   // holds the pre-contact clock and caught the original unheld-pose false pass.
   for(const event of events)if(event.actorId==='a'&&event.kind==='hit')f.impact(false,'light',undefined,event.contactIndex,new THREE.Vector3(0,0,-1),event.damage);
   f.targetPoint=new THREE.Vector3(b.x,b.y+1.2,b.z);f.targetDistance=Math.hypot(a.x-b.x,a.z-b.z);
   o.update(1/60,{...b,action:'idle',actionTime:0,actionDuration:0},true);f.update(1/60,a,true);Fighter.settleContacts();
   if(!events.some(e=>e.actorId==='a'&&e.kind==='hit'))continue;hits++;
   const target=skin(o,TORSO),knuckleGap=distance(skin(f,/^RightHand/),target),torsoGap=distance(skin(f,TORSO),target),pose=f.motionEvidence();
   expect(pose.formVisible).toBe(awakened);expect(knuckleGap,'physical fist at first damage, after attacker hitstop').toBeLessThan(.045+KUSUSHI_TORSO_BACK);
   expect(torsoGap,'actual torso surfaces remain apart').toBeGreaterThan(.30);
   if(process.env.RAKUCHO_CONTACT_EVIDENCE)fs.writeFileSync(`${process.env.RAKUCHO_CONTACT_EVIDENCE}/contact-${awakened?'form':'base'}-${start}.json`,JSON.stringify({knuckleGap,torsoGap,a,b,pose},null,2));
  }
  expect(hits).toBe(1);expect(MOVES['rakucho'].light.contacts).toEqual([.168]);expect(MOVES['rakucho'].light.damage).toBe(20);expect(MOVES['rakucho'].light.duration).toBe(.47);
 }finally{f.dispose();o.dispose();sim.dispose();}
});
