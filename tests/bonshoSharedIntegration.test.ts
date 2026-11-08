import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import * as THREE from 'three';
import fs from 'node:fs';import {createHash}from 'node:crypto';
import {afterEach,beforeAll,describe,expect,it,vi}from 'vitest';import {GLTFLoader,type GLTF}from 'three/addons/loaders/GLTFLoader.js';
import {Fighter,AIR_STRING_CLIPS}from '../src/render/Fighter';import {CombatEffects,FLIGHTS}from '../src/render/CombatEffects';
import {FIGHTERS}from '../src/config';import {MOVES}from '../src/game/moves';import {rushMove,AWAKENING_ENTRY}from '../src/game/awakening';import {comboMove,type ComboKey}from '../src/game/combos';import {ArenaSimulation}from '../src/game/simulation';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS}from '../src/game/rosterAvailability';import {ROSTER_PROTOCOL}from '../src/game/rosterProtocol';import {mayPlay}from '../src/game/economy/fighters';import {factionOf,isBadBloodFighter}from '../src/game/objectives/model';import {planCombatAudio}from '../src/audio/cuePlan';
import {bonshoStrikeJoint}from '../src/game/fighters/bonsho';import {BONSHO_SKIN_CONTACTS}from '../src/render/signature/BonshoContactSurface';import {bonshoDrawnPalmPoint,bonshoDrawnPalmCount}from '../src/render/signature/BonshoBodhisattva';
import type{PlayerState,CombatEvent,AttackSlot}from '../src/game/types';import {base,loadRig}from './rigHarness';
import { fighterShown } from '../src/originals/launch';
import { ORIGINALS } from '../src/originals/roster';
const id='bonsho';let model:GLTF;beforeAll(async()=>{model=await loadRig(FIGHTERS[id].model);});
function actor(){const f=new Fighter(base(id),model);f.prepareRush();f.targetPoint=new THREE.Vector3(0,1.2,2.6);f.targetDistance=2.6;for(let i=0;i<60;i++)f.update(1/120,base(id),true);return f;}
function advance(f:Fighter,state:PlayerState,end:number){const from=f.state.action===state.action&&f.state.actionSeq===state.actionSeq?f.state.actionTime*f.state.actionDuration:0;for(let t=from;t<end+1/120;t+=1/120)f.update(1/120,{...state,actionTime:Math.min(end,t)/state.actionDuration},true);}
function expected(f:Fighter){const mesh=f.model.getObjectByName('body_bonsho')as THREE.SkinnedMesh,clip=f.motionEvidence().clip,joint=bonshoStrikeJoint(f.state.action,clip);return mesh.getVertexPosition(BONSHO_SKIN_CONTACTS[joint],new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);}
afterEach(()=>vi.restoreAllMocks());
describe.skipIf(!!ORIGINALS['bonsho'])('Bonsho human and native Bodhisattva actual shared laboratory integration',()=>{
 it('keeps84/v16 and exact accepted native body/home surfaces in Dawn reviewed release',()=>{expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);expect(LABORATORY_FIGHTERS).not.toContain(id);expect(mayPlay(id,{items:{},allAccess:true})).toBe(fighterShown(id));expect(isBadBloodFighter(id)).toBe(true);expect(factionOf(id)).toBe('heroes');const contract=JSON.parse(fs.readFileSync('docs/roster-expansion/bonsho-model.json','utf8'));expect(FIGHTERS[id].height).toBe(1.68);expect(createHash('sha256').update(fs.readFileSync('public'+FIGHTERS[id].model)).digest('hex')).toBe('b0516fac6f962ca370542451726c9f38870c2d7f98807cee9accfed0205d9dd0');expect(contract).toBeTruthy();const row=JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json','utf8')).fighters.find((r:{id:string})=>r.id===id);expect(row.frames).toHaveLength(row.frameCount??16);for(const[k,h]of[['file','sha256'],['poster','posterSha256']]as const)expect(createHash('sha256').update(fs.readFileSync('public/assets/home/sprites/'+row[k])).digest('hex')).toBe(row[h]);expect(FIGHTERS[id].shortMoves!.every(s=>s.length<=16)).toBe(true);});
 it('full unique gratitude prayer uses same human body and source clock',()=>{const f=actor();try{expect(f.armed).toBe(false);expect(f.model.scale.toArray()).toEqual([1,1,1]);advance(f,{...base(id),action:'awaken',awakened:true,awakenedUntil:20,actionDuration:AWAKENING_ENTRY,actionStarted:1,actionSeq:1},.65);expect(f.motionEvidence().clip).toBe('GREAT BELL');expect(f.motionEvidence().formVisible).toBe(false);const duration=model.animations.find(c=>c.name==='GREAT BELL')!.duration;expect(Math.abs(f.motionEvidence().clipTime!/duration-.65/.9)).toBeLessThan(.015);}finally{f.dispose();}});
 it.each([false,true])('every manual primary/rush/branch contact uses shown native skin; awakened=%s',awakened=>{const cases=[...(['light','heavy','special']as const).map(slot=>({slot})),...(['lh','llh','lllh','llls','airHeavy','airSpecial']as const).map(branch=>({slot:branch==='llls'||branch==='airSpecial'?'special':'heavy',branch})),...[1,2,3].map(chain=>({slot:'light',chain}))];for(const c of cases){const f=actor();try{const slot=c.slot as AttackSlot,branch='branch'in c?c.branch as ComboKey:undefined,chain='chain'in c?c.chain as number:undefined,m=branch?comboMove(id,branch)!:chain?rushMove(id,chain,awakened):MOVES[id][slot];advance(f,{...base(id),action:slot,awakened,awakenedUntil:20,branch,chain,actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);const p=new THREE.Vector3();expect(f.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(expected(f))).toBeLessThan(1e-6);expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected(f))).toBeLessThan(1e-6);expect(f.chargePosition(new THREE.Vector3()).distanceTo(expected(f))).toBeLessThan(1e-6);expect(f.motionEvidence().formVisible).toBe(false);}finally{f.dispose();}}});
 it.each([false,true])('all three aerial stages use full native clips; awakened=%s',awakened=>{for(let chain=0;chain<3;chain++){const f=actor(),m=rushMove(id,chain,awakened);try{advance(f,{...base(id),awakened,awakenedUntil:20,action:'light',chain,y:2,grounded:false,actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);const clip=['Rising Bell Palm','Bead Turn','Bronze Breaker'][chain];expect(f.motionEvidence().clip).toBe(clip);expect(AIR_STRING_CLIPS[id]![chain].span).toBeCloseTo(model.animations.find(c=>c.name===clip)!.duration,6);expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected(f))).toBeLessThan(1e-6);}finally{f.dispose();}}});
 it('manual simulation lands26+36+39+51+138, and whiff/awakened idle/guard create no autonomous damage',()=>{for(const mode of['confirm','miss','idle','guard']){const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:81});sim.addPlayer('a',id,'A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:mode==='miss'?18:2});const a=sim.actors.get('a')!.state;a.ultimate=100;if(mode==='idle'||mode==='guard'){a.awakened=true;a.awakenedUntil=100;}const events:CombatEvent[]=[];try{for(let i=0;i<360;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:mode==='confirm'?'b':null,guard:mode==='guard',attack:i===0&&(mode==='confirm'||mode==='miss')?'ultimate':undefined});sim.step(1/60);events.push(...sim.drainEvents());}const hits=events.filter(e=>e.actorId==='a'&&e.kind==='hit');expect(hits.reduce((n,e)=>n+(e.damage??0),0)).toBe(mode==='confirm'?290:0);if(mode==='confirm')expect(hits.map(e=>e.damage)).toEqual([26,36,39,51,138]);else expect(events.some(e=>e.kind==='confirm')).toBe(false);}finally{sim.dispose();}}});
 // (The reviewed kit's own rows: the lines cut for the voice situations come from another recording and are held by tests/voiceSituations.test.ts.)
 it('whole genuine speech remains intact; rationed short light effort and no unconfirmed ultimate line',()=>{const rows=JSON.parse(fs.readFileSync('public/assets/audio/v2/voice/manifest.json','utf8')).assets.filter((r:{fighter:string;plays?:string;situation?:string})=>r.fighter===id&&!r.plays?.startsWith('area:')&&!r.situation);expect(rows).toHaveLength(9);for(const r of rows)expect(createHash('sha256').update(fs.readFileSync('public'+r.file)).digest('hex')).toBe(r.runtimeSha256);const cast:CombatEvent={id:1,kind:'cast',fighter:id,actorId:'a',slot:'ultimate',serverTime:2};expect(planCombatAudio(cast).filter(l=>l.bus==='voice')).toHaveLength(0);expect(planCombatAudio({...cast,kind:'confirm',castAge:.533}).filter(l=>l.bus==='voice').map(l=>l.cue)).toEqual(['vo-bonsho-great-bell']);expect(rows.find((r:{id:string})=>r.id==='vo-bonsho-effort-b').duration).toBeLessThanOrEqual(.4);expect(rows.some((r:{id:string})=>r.id==='vo-bonsho-zero')).toBe(false);});

});

// Full24 strict facing-target physical probes remain held verbatim in external evidence.

describe.skipIf(!!ORIGINALS['bonsho'])('Bonsho current native palms across real effect event ordering',()=>{
 it('prepares each confirmed native contact before the normal effect update and rejects stale/foreign clocks',async()=>{
  const statue=await loadRig('/assets/fighters/bonsho-bodhisattva1.glb'),targetRig=await loadRig(FIGHTERS.minase.model);
  vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(statue);
  const f=actor(),o=new Fighter({...base('minase'),id:'b',z:2,yaw:Math.PI},targetRig),scene=new THREE.Scene(),fx=new CombatEffects(scene),bodies=new Map([['m',f],['b',o]]),m=MOVES[id].ultimate;
  const command:CombatEvent={id:9100,kind:'confirm',actorId:'m',targetId:'b',fighter:id,slot:'ultimate',actionSeq:1,serverTime:1.533,endpoint:{x:0,y:1.1,z:2}};
  try{
   await fx.load([id]);expect(scene.children.filter(o=>o.name.startsWith('bonsho-'))).toHaveLength(7);
   for(let i=0;i<60;i++)o.update(1/60,{...base('minase'),id:'b',z:2,yaw:Math.PI},true);
   advance(f,{...base(id),action:'ultimate',actionDuration:m.duration,actionSeq:1,actionStarted:1},m.contacts[0]);
   const p=new THREE.Vector3();expect(f.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(expected(f))).toBeLessThan(1e-6);
   fx.handle([command],bodies);
   for(let index=1;index<5;index++){
    advance(f,{...base(id),action:'ultimate',actionDuration:m.duration,actionSeq:1,actionStarted:1,confirmedAt:1.533},m.contacts[index]);
    expect(f.motionEvidence().formVisible).toBe(false);
    expect(Math.abs(f.motionEvidence().clipTime!/model.animations.find(c=>c.name==='Hundred and Eight Tolls')!.duration-[.13,.34,.46,.60,.84][index])).toBeLessThan(.003);
    expect(bonshoDrawnPalmPoint(f,index,p)).toBe(false);
    const contact=vi.spyOn(f,'meleeContactPoint');
    fx.handle([{...command,id:9100+index,kind:'hit',contactIndex:index,damage:[26,36,39,51,138][index],serverTime:1+m.contacts[index]}],bodies);
    // CombatEffects.handle resolves feedback before CombatEffects.update.
    expect(contact.mock.results.some(r=>r.value===true)).toBe(true);contact.mockRestore();
    expect(bonshoDrawnPalmCount(f,index)).toBe(index===4?2:1);
    expect(f.meleeContactPoint(index,p)).toBe(true);
    const expectedPalm=new THREE.Vector3();expect(bonshoDrawnPalmPoint(f,index,expectedPalm)).toBe(true);expect(p.distanceTo(expectedPalm)).toBeLessThan(1e-8);
    expect(p.distanceTo(f.handR)).toBeGreaterThan(.3);expect(p.distanceTo(f.handL)).toBeGreaterThan(.3);
    fx.update(1+m.contacts[index],1/60,bodies);expect(bonshoDrawnPalmPoint(f,index,expectedPalm)).toBe(true);
    expect(bonshoDrawnPalmPoint({state:f.state}as Fighter,index,expectedPalm)).toBe(false);
    f.state.actionTime+=.0001;expect(bonshoDrawnPalmPoint(f,index,expectedPalm)).toBe(false);f.state.actionTime-=.0001;
   }
   fx.handle([{...command,id:9200,kind:'respawn',actorId:'b'}],bodies);expect(bonshoDrawnPalmCount(f,4)).toBe(0);
   expect(f.meleeContactPoint(4,p)).toBe(false);fx.reset();expect(bonshoDrawnPalmCount(f,4)).toBe(0);
   await fx.load(['taisei']);expect(scene.children.some(o=>o.name.startsWith('bonsho-'))).toBe(false);
  }finally{fx.dispose();f.dispose();o.dispose();}
 });
 it('publishes only actual released First Toll Flight and includes the sculpture in the asset graph',async()=>{
  const statue=await loadRig('/assets/fighters/bonsho-bodhisattva1.glb');vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(statue);
  const f=actor(),scene=new THREE.Scene(),fx=new CombatEffects(scene),bodies=new Map([['m',f]]),m=MOVES[id].special,cast:CombatEvent={id:9300,kind:'cast',fighter:id,actorId:'m',slot:'special',serverTime:10,actionSeq:2,origin:{x:0,y:1.1,z:0},endpoint:{x:0,y:1.1,z:18}};
  try{await fx.load([id]);advance(f,{...base(id),action:'special',actionDuration:m.duration,actionStarted:10,actionSeq:2},.1);fx.handle([cast],bodies);fx.update(10.1,1/60,bodies);expect([...FLIGHTS.values()].some(f=>f.fighter===id&&f.released)).toBe(false);
   fx.handle([{...cast,id:9301,kind:'release',serverTime:10+m.contacts[0]}],bodies);advance(f,{...base(id),action:'special',actionDuration:m.duration,actionStarted:10,actionSeq:2},.94);fx.update(10.94,1/60,bodies);
   const flight=[...FLIGHTS.values()].find(f=>f.fighter===id)!;expect(flight.released).toBe(true);expect(flight.position.distanceTo(flight.origin!)).toBeGreaterThan(1);expect((scene.getObjectByName('bonsho-BodhiRightHand')as THREE.InstancedMesh).count).toBeGreaterThan(0);expect(scene.getObjectByName('cast-9300')?.visible).toBe(false);
   const origin=flight.origin!.clone();fx.update(10.98,1/60,bodies);expect(flight.origin!.equals(origin)).toBe(true);expect(fs.readFileSync('scripts/package_vercel_preview.ts','utf8')).toContain('...BONSHO_BODHISATTVA_ASSETS.map');fx.reset();expect([...FLIGHTS.values()].some(f=>f.fighter===id)).toBe(false);
  }finally{fx.dispose();f.dispose();}
 });
});
