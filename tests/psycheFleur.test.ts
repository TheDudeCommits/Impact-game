import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {CombatEvent} from '../src/game/types';
import type {Fighter} from '../src/render/Fighter';
import type {Flight} from '../src/render/CombatEffects';
import {PsycheFleur,PSYCHE_FLEUR_LIMITS} from '../src/render/signature/PsycheFleur';
import {psycheArmPose,psycheStrikePoint,robinArmPose,ROBIN_COMMANDS} from '../src/render/signature/PsycheBloomPose';
import {PSYCHE_MOVES} from '../src/game/fighters/psyche';
import {psycheReceiverArm} from '../src/render/signature/PsycheReceiver';
import {loadRig} from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';

let original:GLTF;
beforeAll(async()=>{
 const bytes=fs.readFileSync('public/assets/fighters/psyche-grown-arm1.glb'),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size).toString());
 doc.materials=doc.materials.map((m:{name:string})=>({name:m.name}));delete doc.images;delete doc.textures;delete doc.samplers;
 const json=Buffer.from(JSON.stringify(doc)),pad=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),tail=bytes.subarray(20+size),all=Buffer.alloc(20+pad.length+tail.length);
 all.writeUInt32LE(0x46546c67);all.writeUInt32LE(2,4);all.writeUInt32LE(all.length,8);all.writeUInt32LE(pad.length,12);all.writeUInt32LE(0x4e4f534a,16);pad.copy(all,20);tail.copy(all,20+pad.length);
 original=await new GLTFLoader().parseAsync(all.buffer.slice(all.byteOffset,all.byteOffset+all.byteLength),'');
 vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async()=>({...original,scene:original.scene.clone(true)}));
});
afterAll(()=>vi.restoreAllMocks());
async function setup(budget=1){
 const scene=new T.Scene(),group=new T.Group();group.updateMatrixWorld(true);
 const state={id:'robin',fighter:'psyche',alive:true,action:'idle',actionTime:0,actionDuration:.52,actionSeq:1,yaw:0};
 const f={group,model:group,state,displayedClipName:'Moth Palm',displayedClipTime:0}as unknown as Fighter&{displayedClipName:string;displayedClipTime:number};
 const targetGroup=new T.Group();targetGroup.position.z=1.30;targetGroup.updateMatrixWorld(true);const victim={group:targetGroup,state:{id:'target',fighter:'taisei',alive:true}}as unknown as Fighter;
 const fighters=new Map([['robin',f],['target',victim]]),fx=new PsycheFleur(scene,{budget});await fx.load(['psyche']);
 return{scene,f,victim,fighters,fx,mesh:(name='grown-arms')=>scene.getObjectByName('psyche-'+name)as T.InstancedMesh};
}
const event=(kind:string,extra={})=>({id:1,kind,fighter:'psyche',actorId:'robin',targetId:'target',slot:'ultimate',serverTime:1,actionSeq:1,...extra}as unknown as CombatEvent);
function vertex(a:Awaited<ReturnType<typeof setup>>,instance:number){const mesh=a.mesh(),sample=(original.scene.getObjectByName('Robin_Grown_Arm')as T.Mesh).clone(),m=new T.Matrix4(),out=new T.Vector3();mesh.getMorphAt(instance,sample);mesh.getMatrixAt(instance,m);sample.getVertexPosition(551,out);return out.applyMatrix4(m);}
describe('Robin native manual limb presentation',()=>{
 it.skipIf(!!ORIGINALS['psyche'])('keeps ordinary palms on the real receiver-facing skin with one bounded selection per command',async()=>{
  const model=await loadRig('/assets/fighters/minase-ff1.glb'),group=new T.Group();group.add(model.scene);const mixer=new T.AnimationMixer(model.scene),idle=model.animations.find(c=>c.name==='_Idle');if(idle){mixer.clipAction(idle).play();mixer.setTime(.2);}group.updateMatrixWorld(true);
  const joints=new Map<string,T.Object3D>();model.scene.traverse(o=>{if((o as T.Bone).isBone)joints.set(o.name,o);});const receiver={state:{alive:true},group,model:model.scene,drawnJoint:(name:string)=>joints.get(name)}as unknown as Fighter;Object.defineProperty(receiver,'shownBody',{get:()=>receiver});
  const a=await setup();a.f.state.yaw=Math.PI;a.f.group.position.z=1.12;a.f.group.rotation.y=Math.PI;a.f.group.updateMatrixWorld(true);Object.defineProperty(a.f,'displayedOpponent',{get:()=>receiver});
  const spies:ReturnType<typeof vi.spyOn>[]=[];model.scene.traverse(o=>{if(o instanceof T.SkinnedMesh)spies.push(vi.spyOn(o,'getVertexPosition'));});const calls=()=>spies.reduce((n,s)=>n+s.mock.calls.length,0),root=new T.Vector3(),end=new T.Vector3();
  try{
   expect(psycheReceiverArm(a.f,receiver,'Moth Palm',0,root,end)).toBe(true);expect(calls()).toBeLessThanOrEqual(66);const first=calls();
   expect(psycheReceiverArm(a.f,receiver,'Moth Palm',1,root,end)).toBe(true);expect(calls()-first).toBe(2);
   const chest=joints.get('Spine2')!.getWorldPosition(new T.Vector3());expect(end.z).toBeGreaterThan(chest.z);expect(root.z).toBeGreaterThan(chest.z);
   for(const clip of['Moth Palm','Clasping Wings','Rising Swarm']){const c=ROBIN_COMMANDS[clip];Object.assign(a.f.state,{action:'heavy',actionSeq:(a.f.state.actionSeq??0)+1});a.f.displayedClipName=clip;a.f.displayedClipTime=c.duration*c.peak;a.fx.update(1,a.fighters,new Map());const contact=new T.Vector3();psycheStrikePoint(a.f,contact,clip,a.f.displayedClipTime);expect(vertex(a,0).distanceTo(contact)).toBeLessThan(1e-6);expect(contact.z).toBeGreaterThan(chest.z);}
   // Preserve the explicitly accepted ultimate instead of silently changing
   // its three-contact geometry with the ordinary receiver attachment.
   const withReceiver=robinArmPose(),withoutReceiver=robinArmPose();psycheArmPose(a.f,withReceiver,'Silk Cocoon',3.75*.82);psycheArmPose({state:a.f.state,group:a.f.group},withoutReceiver,'Silk Cocoon',3.75*.82);expect(withReceiver.matrix.elements).toEqual(withoutReceiver.matrix.elements);
  }finally{for(const s of spies)s.mockRestore();a.fx.dispose();mixer.stopAllAction();}
 });
 it('warms the native morph texture once and uploads it only while arms are visible',async()=>{const a=await setup();try{
  const mesh=a.mesh(),texture=mesh.morphTexture!,version=texture.version;expect(version).toBeGreaterThan(0);
  a.fx.update(0,a.fighters,new Map());expect(mesh.visible).toBe(true);expect(texture.version).toBe(version);(mesh.onAfterRender as()=>void)();
  a.fx.update(.1,a.fighters,new Map());expect(mesh.visible).toBe(false);expect(texture.version).toBe(version);
  for(const time of[1,2]){Object.assign(a.f.state,{action:'light',actionTime:.44});a.f.displayedClipTime=.22;a.fx.update(time,a.fighters,new Map());
   expect(mesh.visible).toBe(true);expect(mesh.count).toBe(2);expect(mesh.instanceMatrix.updateRanges).toEqual([{start:0,count:32}]);const activeVersion=texture.version;
   expect(activeVersion).toBeGreaterThan(version);mesh.instanceMatrix.clearUpdateRanges();a.f.state.action='idle';a.fx.update(time+.1,a.fighters,new Map());expect(mesh.visible).toBe(false);expect(texture.version).toBe(activeVersion);
  }
 }finally{a.fx.dispose();}});
 it('keeps the confirmed primary palm continuous across ultimate stage boundaries',async()=>{const a=await setup();try{const p=robinArmPose(),before=new T.Vector3();for(const boundary of[.285,.625]){psycheArmPose(a.f,p,'Silk Cocoon',(boundary-.0001)*3.75);before.copy(p.palm);psycheArmPose(a.f,p,'Silk Cocoon',(boundary+.0001)*3.75);expect(before.distanceTo(p.palm)).toBeLessThan(.001);expect(p.presence).toBe(1);}}finally{a.fx.dispose();}});
 it.skipIf(!!ORIGINALS['psyche'])('has actual seven-target anatomy, allocates all24 morph rows and stays absent at idle',async()=>{const a=await setup();try{a.fx.update(1,a.fighters,new Map());expect(a.mesh().count).toBe(0);expect(a.mesh().morphTexture?.image.height).toBe(24);expect(a.mesh().geometry.morphAttributes.position).toHaveLength(7);expect(a.mesh().geometry.index!.count/3).toBe(1556);}finally{a.fx.dispose();}});
 it.skipIf(!!ORIGINALS['psyche'])('uses the identical animated native palm surface for drawing and contact',async()=>{const a=await setup();try{for(const clip of['Moth Palm','Clasping Wings','Rush 2','Rising Swarm','Moth Descent']){
  const command=ROBIN_COMMANDS[clip];Object.assign(a.f.state,{action:'heavy',actionTime:command.peak});a.f.displayedClipName=clip;a.f.displayedClipTime=command.duration*command.peak;
  a.fx.update(1,a.fighters,new Map());const contact=new T.Vector3();expect(psycheStrikePoint(a.f,contact,clip,a.f.displayedClipTime)).toBe(true);expect(vertex(a,0).distanceTo(contact)).toBeLessThan(1e-6);
  const pose=robinArmPose();psycheArmPose(a.f,pose,clip,a.f.displayedClipTime);expect(pose.weights.reduce((sum,v)=>sum+v,0)).toBeLessThanOrEqual(1.00001);
 }}finally{a.fx.dispose();}});
 it('requires an ultimate confirmation for the limb surround and deduplicates it',async()=>{const a=await setup();try{Object.assign(a.f.state,{action:'ultimate',actionDuration:3.75,actionTime:2/3.75});a.f.displayedClipName='Silk Cocoon';a.f.displayedClipTime=2;a.fx.handle(event('cast'),a.fighters);a.fx.update(2,a.fighters,new Map());expect(a.mesh().count).toBe(0);a.fx.handle(event('confirm'),a.fighters);a.fx.handle(event('confirm'),a.fighters);a.fx.update(2,a.fighters,new Map());expect(a.mesh().count).toBe(8);a.victim.state.alive=false;a.fx.update(2.01,a.fighters,new Map());expect(a.mesh().count).toBe(0);}finally{a.fx.dispose();}});
 it('clears whiffs, rejected casts, action changes, death and resets without idle recasts',async()=>{const a=await setup();try{Object.assign(a.f.state,{action:'light',actionTime:.44});a.f.displayedClipTime=.22;a.fx.update(1,a.fighters,new Map());expect(a.mesh().count).toBe(2);a.fx.handle(event('rejected',{slot:'light'}),a.fighters);a.fx.update(1.01,a.fighters,new Map());expect(a.mesh().count).toBe(0);a.f.state.actionSeq=2;a.fx.update(1.02,a.fighters,new Map());expect(a.mesh().count).toBe(2);a.f.state.action='hurt';a.fx.update(1.03,a.fighters,new Map());expect(a.mesh().count).toBe(0);a.f.state.action='light';a.f.state.alive=false;a.fx.update(1.04,a.fighters,new Map());expect(a.mesh().count).toBe(0);a.fx.reset();expect(a.scene.children.filter(o=>o.name.startsWith('psyche-')).every(o=>(o as T.InstancedMesh).count===0)).toBe(true);}finally{a.fx.dispose();}expect(a.scene.children).toHaveLength(0);});
 it.skipIf(!!ORIGINALS['psyche'])('places the actual palm at the released authoritative Flight and removes it with the flight',async()=>{const a=await setup();try{const flight={fighter:'psyche',slot:'special',released:false,position:new T.Vector3(0,1.2,3),origin:new T.Vector3(0,1.2,1.2),heading:new T.Vector3(0,0,1)}as unknown as Flight;const flights=new Map([['real-flight',flight]]);a.fx.update(1,a.fighters,flights);expect(a.mesh().count).toBe(0);flight.released=true;a.fx.update(1.01,a.fighters,flights);expect(a.mesh().count).toBe(1);expect(vertex(a,0).distanceTo(flight.position)).toBeLessThan(1e-6);a.fx.update(1.02,a.fighters,new Map());expect(a.mesh().count).toBe(0);}finally{a.fx.dispose();}});
 it.skipIf(!!ORIGINALS['psyche'])('keeps the final neck restraint fixed after the authoritative hit rather than following a moving victim',async()=>{const a=await setup();try{Object.assign(a.f.state,{action:'ultimate',actionDuration:3.75,actionTime:.82});a.f.displayedClipName='Silk Cocoon';a.f.displayedClipTime=3.75*.82;a.fx.handle(event('confirm'),a.fighters);a.fx.update(3,a.fighters,new Map());const before=vertex(a,1);a.fx.handle(event('hit',{id:2,contactIndex:2,endpoint:{x:0,y:1,z:1.30}}),a.fighters);a.fx.update(3,a.fighters,new Map());const held=vertex(a,1);expect(before.distanceTo(held)).toBeLessThan(1e-6);a.victim.group.position.set(3,2,4);a.victim.group.updateMatrixWorld(true);a.fx.update(3.01,a.fighters,new Map());expect(vertex(a,1).distanceTo(held)).toBeLessThan(1e-6);}finally{a.fx.dispose();}});
 it('bounds all crowd pools and contains no damage-bearing awakening',async()=>{const a=await setup(.4);try{for(let i=0;i<50;i++){const group=new T.Group();group.updateMatrixWorld(true);const f={...a.f,group,state:{...a.f.state,id:'r'+i,action:'awaken',actionTime:.64,actionSeq:i,actionDuration:.9},displayedClipName:'VIOLET SWARM',displayedClipTime:2.3*.64}as unknown as Fighter;a.fighters.set('r'+i,f);}a.fx.update(1,a.fighters,new Map());expect(a.mesh().count).toBeLessThanOrEqual(PSYCHE_FLEUR_LIMITS.arms);expect(a.mesh('fleur-petals').count).toBeLessThanOrEqual(256);expect(a.mesh('fleur-births').count).toBeLessThanOrEqual(24);expect(PSYCHE_MOVES.ultimate.schedule).toEqual([35,66,238]);expect(35*2+PSYCHE_MOVES.ultimate.finisherDamage!).toBe(290);}finally{a.fx.dispose();}});
});
