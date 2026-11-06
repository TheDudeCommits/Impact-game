// Maker-owned temporary diagnostic with no acceptance assertion: current67-joint canonical Ovid; includes universal-helper skin weights, ledger-fed facing Minase, first contacts only. No gameplay acceptance.
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import {beforeAll,expect,it} from 'vitest';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter} from '../src/render/Fighter';
import {FIGHTERS} from '../src/config';
import {MOVES} from '../src/game/moves';
import {LANDED} from '../src/game/landedBlows';
import {ArenaSimulation} from '../src/game/simulation';
import {bigBlowOf,cinematicBlowOf} from '../src/render/bigBlowEvent';
import {weightedSkin,bodyTriangles,containedBodySamples,contactSurfaceTriangles,skinSurfaceGap} from './ovidContactGeometry';
import {loadRig} from './rigHarness';
import {ovidStrikeJoint} from '../src/game/fighters/ovid';
import { ORIGINALS } from '../src/originals/roster';
const out=process.env.OVID_CONTACT_EVIDENCE;if(out)fs.mkdirSync(out,{recursive:true});
let model:GLTF,form:GLTF,foe:GLTF;
const external=(file:string)=>'/../'+path.relative(process.cwd(),file);
beforeAll(async()=>{[model,form,foe]=await Promise.all([loadRig(process.env.OVID_CONTACT_BASE?external(process.env.OVID_CONTACT_BASE):FIGHTERS['ovid'].model),loadRig(process.env.OVID_CONTACT_FORM?external(process.env.OVID_CONTACT_FORM):FIGHTERS['ovid'].model),loadRig(FIGHTERS[(process.env.OVID_PROBE_TARGET??'minase') as keyof typeof FIGHTERS].model)]);});
function nearest(point:THREE.Vector3,skin:readonly THREE.Vector3[]){let distance=Infinity,pair:number[]=[];for(const p of skin)if(point.distanceTo(p)<distance){distance=point.distanceTo(p);pair=p.toArray();}return{distance,pair};}
function skinGap(a:readonly THREE.Vector3[],b:readonly THREE.Vector3[]){let distance=Infinity;for(const p of a)for(const q of b)distance=Math.min(distance,p.distanceTo(q));return distance;}
function triangleContact(point:THREE.Vector3,triangles:ReturnType<typeof bodyTriangles>){let distance=Infinity,nearest:number[]=[];const triangle=new THREE.Triangle(),p=new THREE.Vector3();for(const [a,b,c]of triangles){triangle.set(a,b,c).closestPointToPoint(point,p);if(p.distanceTo(point)<distance){distance=p.distanceTo(point);nearest=p.toArray();}}return{distance,nearest,contained:containedBodySamples([point],triangles)};}
function frontFace(point:THREE.Vector3,triangles:ReturnType<typeof bodyTriangles>){const ray=new THREE.Ray(new THREE.Vector3(point.x,point.y,3),new THREE.Vector3(0,0,-1)),hit=new THREE.Vector3();let front=-Infinity;for(const[a,b,c]of triangles)if(ray.intersectTriangle(a,b,c,false,hit))front=Math.max(front,hit.z);return{frontZ:front,deltaZ:front-point.z};}
function outwardExit(point:THREE.Vector3,triangles:ReturnType<typeof bodyTriangles>){const ray=new THREE.Ray(point,new THREE.Vector3(0,0,1)),hit=new THREE.Vector3();let distance=Infinity;for(const[a,b,c]of triangles)if(ray.intersectTriangle(a,b,c,false,hit))distance=Math.min(distance,point.distanceTo(hit));return distance;}
const torso=/^(Hips|Spine\d*|Neck)$/,head=/^Head$/;
it.skipIf(!!ORIGINALS['ovid']).each((['light','heavy','special','ultimate']as const).filter(slot=>!process.env.OVID_PROBE_SLOT||slot===process.env.OVID_PROBE_SLOT).flatMap(slot=>[false,true].flatMap(awakened=>[1.14,2.476].map(start=>({slot,awakened,start})))) )('external Ovid $slot contact and noncontained bodies; awakened=$awakened start=$start',({slot,awakened,start})=>{
 LANDED.reset();
 const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:78});sim.addPlayer('a','ovid','A',false,{x:0,y:0,z:start});sim.addPlayer('b',(process.env.OVID_PROBE_TARGET??'minase') as keyof typeof FIGHTERS,'B',false,{x:0,y:0,z:0});
 const initial=sim.actors.get('a')!.state,opponent=sim.actors.get('b')!.state;Object.assign(initial,{yaw:Math.PI,ultimate:100,awakened:awakened,awakenedUntil:100,target:'b'});Object.assign(opponent,{yaw:0,target:'a'});
 const f=new Fighter({...initial},model),o=new Fighter({...opponent},foe);f.prepareRush();let contacts=0;
 try{
  for(let i=0;i<60;i++){f.update(1/60,{...initial},true);o.update(1/60,{...opponent},true);Fighter.settleContacts();}
  for(let i=0;i<(600);i++){
   sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:Math.PI,targetId:'b',attack:i===0?slot:undefined});sim.submitInput('b',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:'a'});sim.step(1/60);
   const events=sim.drainEvents(),a={...sim.actors.get('a')!.state},b={...sim.actors.get('b')!.state},hit=events.find(e=>e.actorId==='a'&&e.kind==='hit'),preSkin=hit?weightedSkin(o):[],preTriangles=hit?contactSurfaceTriangles(o):[];
   LANDED.deliver(events);
   for(const e of events)if(e.actorId==='a'&&e.kind==='hit'){
    const heading=e.origin&&e.endpoint?new THREE.Vector3(e.endpoint.x-e.origin.x,e.endpoint.y-e.origin.y,e.endpoint.z-e.origin.z):new THREE.Vector3(0,0,-1),detail={chain:e.chain,fromBehind:e.fromBehind,reaction:e.reaction,big:bigBlowOf(e)||cinematicBlowOf(e)};
    o.impact(true,e.slot,'melee',e.contactIndex,heading,e.damage,e.endpoint?e.endpoint.y-b.y:undefined,detail);if(e.slot==='light'||e.slot==='heavy')f.impact(false,e.slot,undefined,undefined,heading,e.damage,undefined,detail);
   }
   f.targetPoint=new THREE.Vector3(b.x,b.y+1.2,b.z);f.targetDistance=Math.hypot(a.x-b.x,a.z-b.z);o.targetPoint=new THREE.Vector3(a.x,a.y+1.2,a.z);o.targetDistance=f.targetDistance;
   o.update(1/60,b,true);f.update(1/60,a,true);Fighter.settleContacts();if(!hit)continue;contacts++;
   const endpoint=new THREE.Vector3();f.meleeContactPoint(hit.contactIndex??0,endpoint);const pose=f.motionEvidence(),side=ovidStrikeJoint((pose.formVisible?pose.formClip:pose.clip)??'',hit.contactIndex??0),strikingSkin=weightedSkin(f,new RegExp('^'+side));
   const sourceBody=weightedSkin(f),targetBody=weightedSkin(o),actorTriangles=bodyTriangles(f),targetTriangles=bodyTriangles(o),preContact=nearest(endpoint,preSkin),postContact=nearest(endpoint,targetBody);
   const containment={actorTorso:containedBodySamples(weightedSkin(f,torso),targetTriangles),actorHead:containedBodySamples(weightedSkin(f,head),targetTriangles),targetTorso:containedBodySamples(weightedSkin(o,torso),actorTriangles),targetHead:containedBodySamples(weightedSkin(o,head),actorTriangles)};
   const preSurface=triangleContact(endpoint,preTriangles),postSurface=triangleContact(endpoint,contactSurfaceTriangles(o));
   const fullHandSurface=skinSurfaceGap(strikingSkin,preTriangles); const record={fullHandSurface:{gap:fullHandSurface.gap,handPoint:fullHandSurface.point.toArray(),targetPoint:fullHandSurface.target.toArray(),vertices:strikingSkin.length},ledgerMode:'timeline delivered before impacts/pose/contact solver; attacker impact only light/heavy as main.ts',outwardExit:outwardExit(endpoint,preTriangles),actorGroup:f.group.position.toArray(),actorHip:f.drawnJoint('Hips')?.getWorldPosition(new THREE.Vector3()).toArray(),targetGroup:o.group.position.toArray(),targetHip:o.drawnJoint('Hips')?.getWorldPosition(new THREE.Vector3()).toArray(),preFront:frontFace(endpoint,preTriangles),postFront:frontFace(endpoint,contactSurfaceTriangles(o)),preSurface,postSurface,slot,awakened,start,targetFighter:process.env.OVID_PROBE_TARGET??'minase',preContact,postContact,endpoint:endpoint.toArray(),physicalHandPre:skinGap(strikingSkin,preSkin),physicalHandPost:skinGap(strikingSkin,targetBody),torsoGap:skinGap(sourceBody,targetBody),containment,pose,actor:a,target:b,event:hit};if(out)fs.writeFileSync(out+'/'+slot+'-'+awakened+'-'+start+('-'+hit.contactIndex)+'.json',JSON.stringify(record,null,2));
   expect(b.yaw).toBe(0);expect(pose.formVisible).toBe(false);if(contacts===(slot==='ultimate'?3:1))break;
  }
  expect(contacts).toBe(slot==='ultimate'?3:1);
 }finally{f.dispose();o.dispose();sim.dispose();LANDED.reset();}
});
