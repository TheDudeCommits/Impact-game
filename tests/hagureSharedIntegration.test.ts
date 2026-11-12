import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import * as THREE from 'three';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter,AIR_STRING_CLIPS} from '../src/render/Fighter';
import {CombatEffects,FLIGHTS} from '../src/render/CombatEffects';
import {FIGHTERS} from '../src/config';
import {MOVES} from '../src/game/moves';
import {rushMove,AWAKENING_ENTRY,awakeningSwapAt} from '../src/game/awakening';
import {comboMove,type ComboKey} from '../src/game/combos';
import {ArenaSimulation} from '../src/game/simulation';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS} from '../src/game/rosterAvailability';
import {ROSTER_PROTOCOL} from '../src/game/rosterProtocol';
import {mayPlay} from '../src/game/economy/fighters';
import {factionOf,isBadBloodFighter} from '../src/game/objectives/model';
import {planCombatAudio} from '../src/audio/cuePlan';
import {hagureStrikeJoint} from '../src/render/signature/HagureSnapBite';
import {hagureSurfacePoint} from '../src/render/signature/HagureContactSurface';
import type {PlayerState,CombatEvent,AttackSlot} from '../src/game/types';
import {bigBlowOf,cinematicBlowOf} from '../src/render/bigBlowEvent';
import {base,loadRig} from './rigHarness';
import { fighterShown } from '../src/originals/launch';
import { ORIGINALS } from '../src/originals/roster';
const id='hagure';let model:GLTF,form:GLTF;
beforeAll(async()=>{model=await loadRig(FIGHTERS[id].model);form=await loadRig(FIGHTERS[id].formModel!);});
function actor(){const f=new Fighter(base(id),model);f.attachForm(form);f.prepareRush();f.targetPoint=new THREE.Vector3(0,1.2,2.6);f.targetDistance=2.6;for(let i=0;i<60;i++)f.update(1/120,base(id),true);return f;}
function advance(f:Fighter,state:PlayerState,end:number){const from=f.state.action===state.action&&f.state.actionSeq===state.actionSeq?f.state.actionTime*f.state.actionDuration:0;for(let t=from;t<end+1/120;t+=1/120)f.update(1/120,{...state,actionTime:Math.min(end,t)/state.actionDuration},true);}
function awaken(f:Fighter){advance(f,{...base(id),action:'awaken',awakened:true,awakenedUntil:20,actionStarted:1,actionSeq:1,actionDuration:AWAKENING_ENTRY},.85);}
function nearHandSkin(f:Fighter,p:THREE.Vector3,side:string){let nearest=Infinity;f.group.updateMatrixWorld(true);f.shownBody.model.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh)||o.name.endsWith('-ink'))return;o.skeleton.update();const a=o.geometry.attributes,v=new THREE.Vector3();for(let i=0;i<a.position.count;i++){let w=0;for(let j=0;j<4;j++)if(o.skeleton.bones[a.skinIndex.getComponent(i,j)]?.name.startsWith(side))w+=a.skinWeight.getComponent(i,j);if(w<.65)continue;o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);nearest=Math.min(nearest,v.distanceTo(p));}});return nearest;}
function expected(f:Fighter,index=0){const m=f.motionEvidence(),clip=m.formVisible?m.formClip:m.clip,side=hagureStrikeJoint(f.state.action,clip,index),hand=f.drawnJoint(side)!;return{side,point:hagureSurfacePoint(hand,m.formVisible,f.state.action,clip,index,new THREE.Vector3())};}
describe.skipIf(!!ORIGINALS.hagure)('Hagure shared released integration',()=>{
 it('keeps current roster protocol and reviewed identity-normalized pair/homepage Eclipse released roster',()=>{
  expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);expect(LABORATORY_FIGHTERS).not.toContain(id);expect(mayPlay(id,{items:{},allAccess:true})).toBe(fighterShown(id));expect(isBadBloodFighter(id)).toBe(true);expect(factionOf(id)).toBe('villains');
  for(const[file,sha]of [[FIGHTERS[id].model,'856220a91f011818ee58524cdab1c62bff3ae733dc3670bba28f78d0e67df9c7'],[FIGHTERS[id].formModel!,'2b2b740edd072a671952d8113c00b39c776500dc8818424196b3ca8e3c11de00']])expect(createHash('sha256').update(fs.readFileSync('public'+file)).digest('hex')).toBe(sha);
  const row=JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json','utf8')).fighters.find((r:{id:string})=>r.id===id);expect(row.frames).toHaveLength(row.frameCount??16);for(const[k,h]of [['file','sha256'],['poster','posterSha256']]as const)expect(createHash('sha256').update(fs.readFileSync('public/assets/home/sprites/'+row[k])).digest('hex')).toBe(row[h]);expect(FIGHTERS[id].shortMoves!.every(s=>s.length<=15)).toBe(true);
 });
 it('only manual gathering/unfolding entry reveals the Moonless body at .549s',()=>{
  const f=actor(),s={...base(id),action:'awaken'as const,awakened:true,awakenedUntil:20,actionDuration:AWAKENING_ENTRY,actionStarted:1,actionSeq:1};try{
   expect(f.model.scale.toArray()).toEqual([1,1,1]);expect(awakeningSwapAt(id)).toBe(.549);advance(f,s,.52);expect(f.motionEvidence().formVisible).toBe(false);expect(f.motionEvidence().clip).toBe('MOONLESS');advance(f,s,.85);expect(f.motionEvidence().formVisible).toBe(true);expect(f.motionEvidence().formClip).toBe('MOONLESS');expect(f.shownBody.model.scale.toArray()).toEqual([1,1,1]);expect(f.shownBody.armed).toBe(false);
  }finally{f.dispose();}
 });
 it.each([false,true])('ground/rush/branch sockets touch the actual shown hand skin; moonless=%s',moonless=>{
  const cases=[...(['light','heavy','special']as const).map(slot=>({slot})),...['lh','llh','lllh','llls','airHeavy','airSpecial'].map(branch=>({slot:branch==='llls'||branch==='airSpecial'?'special':'heavy',branch})),...[1,2,3].map(chain=>({slot:'light',chain}))];
  for(const c of cases){const f=actor();try{if(moonless)awaken(f);const slot=c.slot as AttackSlot,branch='branch'in c?c.branch as ComboKey:undefined,chain='chain'in c?c.chain as number:undefined,m=branch?comboMove(id,branch)!:chain?rushMove(id,chain,moonless):MOVES[id][slot];advance(f,{...base(id),awakened:moonless,awakenedUntil:20,action:slot,branch,chain,actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);expect(f.motionEvidence().formVisible).toBe(moonless);const p=new THREE.Vector3(),want=expected(f);expect(f.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(want.point)).toBeLessThan(1e-5);expect(nearHandSkin(f,p,want.side),JSON.stringify(c)).toBeLessThan(.015);expect(f.strikePoint(new THREE.Vector3()).distanceTo(p)).toBeLessThan(1e-5);expect(f.chargePosition(new THREE.Vector3()).distanceTo(p)).toBeLessThan(1e-5);}finally{f.dispose();}}
 });
 it.each([false,true])('keeps all3 native air clips/spans on the shown body; moonless=%s',moonless=>{for(const chain of[0,1,2]){const f=actor(),m=rushMove(id,chain,moonless);try{if(moonless)awaken(f);advance(f,{...base(id),awakened:moonless,awakenedUntil:20,action:'light',chain,y:2,grounded:false,actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);const e=f.motionEvidence(),clip=e.formVisible?e.formClip:e.clip;expect(clip).toBe(['Turnaside Hand','Stray Cross','Howling Break'][chain]);expect(AIR_STRING_CLIPS[id]![chain].span).toBeCloseTo((moonless?form:model).animations.find(c=>c.name===clip)!.duration,6);expect(nearHandSkin(f,f.strikePoint(new THREE.Vector3()),expected(f).side)).toBeLessThan(.015);}finally{f.dispose();}}});
 it.each([false,true])('manual five-contact ultimate keeps its current body and physical hand semantics; moonless=%s',moonless=>{
  const f=actor(),m=MOVES[id].ultimate;try{if(moonless)awaken(f);for(const[index,t]of m.contacts.entries()){advance(f,{...base(id),awakened:moonless,awakenedUntil:20,action:'ultimate',actionStarted:2,actionSeq:2,confirmedAt:index?2+.44:undefined,actionDuration:m.duration},t);const e=f.motionEvidence();expect(e.formVisible).toBe(moonless);expect((moonless?e.formClipTime!:e.clipTime!)/3.7833333333333).toBeCloseTo([.1164021164,.2751322751,.4312169312,.5899470899,.7989417989][index],2);const p=new THREE.Vector3(),want=expected(f,index);expect(want.side).toBe(index%2?'LeftHand':'RightHand');expect(f.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(want.point)).toBeLessThan(1e-5);expect(nearHandSkin(f,p,want.side)).toBeLessThan(.015);}expect(m.duration-m.contacts.at(-1)!).toBeGreaterThan(.6);}finally{f.dispose();}
 });
 it('actual confirmed simulation resolves22+37+46+66+119; miss,guard,idle create no automatic attacks',()=>{
  for(const mode of['confirm','miss','idle','guard']){const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:78});sim.addPlayer('a',id,'A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:mode==='miss'?18:2});const a=sim.actors.get('a')!.state;a.ultimate=100;if(mode==='idle'||mode==='guard'){a.awakened=true;a.awakenedUntil=100;}const events:CombatEvent[]=[];try{for(let i=0;i<360;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:mode==='confirm'?'b':null,guard:mode==='guard',attack:i===0&&(mode==='confirm'||mode==='miss')?'ultimate':undefined});sim.step(1/60);events.push(...sim.drainEvents());}const hits=events.filter(e=>e.actorId==='a'&&e.kind==='hit');expect(hits.reduce((s,e)=>s+(e.damage??0),0)).toBe(mode==='confirm'?290:0);if(mode==='confirm')expect(hits.map(e=>e.damage)).toEqual([22,37,46,66,119]);else expect(events.some(e=>e.kind==='confirm')).toBe(false);}finally{sim.dispose();}}
 });
 // (The reviewed kit's own rows: the lines cut for the voice situations come from another recording and are held by tests/voiceSituations.test.ts.)
 it('keeps eleven genuine voice hashes including the distinct manual G call and confirms ultimate speech before scheduling',()=>{const rows=JSON.parse(fs.readFileSync('public/assets/audio/v2/voice/manifest.json','utf8')).assets.filter((r:{fighter:string;situation?:string})=>r.fighter===id&&!r.situation);expect(rows).toHaveLength(11);for(const r of rows)expect(createHash('sha256').update(fs.readFileSync('public'+r.file)).digest('hex')).toBe(r.runtimeSha256);const cast:CombatEvent={id:1,kind:'cast',fighter:id,actorId:'a',slot:'ultimate',serverTime:2};expect(planCombatAudio(cast).filter(l=>l.bus==='voice')).toHaveLength(0);expect(planCombatAudio({...cast,kind:'confirm',castAge:.44}).filter(l=>l.bus==='voice').map(l=>l.cue)).toEqual(['vo-hagure-ultimate']);expect(planCombatAudio({...cast,slot:'light'}).filter(l=>l.bus==='voice')).toHaveLength(0);});
 it('room-scoped three pools follow confirmed contact endpoints and dispose between rooms',async()=>{
  const mock=vi.spyOn(THREE.TextureLoader.prototype,'loadAsync').mockResolvedValue(new THREE.Texture<HTMLImageElement>()),f=actor(),scene=new THREE.Scene(),fx=new CombatEffects(scene),bodies=new Map([['m',f]]),m=MOVES[id].special,cast:CombatEvent={id:701,kind:'cast',fighter:id,actorId:'m',slot:'special',serverTime:10,actionSeq:2};try{
   await fx.load([id]);expect(scene.children.filter(o=>o.name.startsWith('hagure-'))).toHaveLength(3);fx.handle([cast],bodies);fx.update(10.1,1/60,bodies);expect([...FLIGHTS.values()].some(f=>f.fighter===id)).toBe(false);const rings=scene.getObjectByName('hagure-rings')as THREE.InstancedMesh;expect(rings.count).toBe(0);
   advance(f,{...base(id),action:'special',actionDuration:m.duration,actionStarted:10,actionSeq:2},.55);fx.handle([{...cast,id:702,kind:'hit',serverTime:10.55,targetId:'b',endpoint:{x:3,y:1.2,z:-7}}],bodies);fx.update(10.56,1/60,bodies);expect(rings.count).toBeGreaterThan(0);const matrix=new THREE.Matrix4();rings.getMatrixAt(0,matrix);expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(3,1.2,-7))).toBeLessThan(1e-5);fx.reset();expect(rings.count).toBe(0);await fx.load(['taisei']);expect(scene.children.some(o=>o.name.startsWith('hagure-'))).toBe(false);
  }finally{fx.dispose();f.dispose();mock.mockRestore();}
 });
});
