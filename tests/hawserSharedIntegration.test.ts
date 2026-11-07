import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import * as THREE from 'three';
import fs from 'node:fs';import {createHash}from 'node:crypto';
import {beforeAll,describe,expect,it,vi}from 'vitest';import type{GLTF}from 'three/addons/loaders/GLTFLoader.js';
import {Fighter,AIR_STRING_CLIPS,FORM_AIR_STRING_CLIPS}from '../src/render/Fighter';import {CombatEffects,FLIGHTS}from '../src/render/CombatEffects';
import {FIGHTERS}from '../src/config';import {MOVES}from '../src/game/moves';import {moveFor,rushMove,AWAKENED_DAMAGE,AWAKENING_ENTRY,awakeningSwapAt}from '../src/game/awakening';import {comboMove,type ComboKey}from '../src/game/combos';import {ArenaSimulation}from '../src/game/simulation';
import {LABORATORY_FIGHTERS,RELEASED_FIGHTERS}from '../src/game/rosterAvailability';import {ROSTER_PROTOCOL}from '../src/game/rosterProtocol';import {mayPlay}from '../src/game/economy/fighters';import {factionOf,isBadBloodFighter}from '../src/game/objectives/model';import {planCombatAudio}from '../src/audio/cuePlan';
import {hawserBlade,hawserTrunkFist,HAWSER_SWORD_SOCKETS,HAWSER_COLOSSUS_KNUCKLES}from '../src/game/fighters/hawser';
import {bodyBulk}from '../src/render/CameraDirector';
import {FollowCamera}from '../src/render/FollowCamera';
import {commandList}from '../src/ui/commandList';import {GUARD_GUIDE}from '../src/ui/guardGuide';import {areaArtUrl,moveSheetsFor,moveSheetUrl}from '../src/ui/moveSheet';
import {emitMote}from '../src/render/vfx/powerup/Motes';import {awakenedPower}from '../src/render/awakenedPower';import {AWAKENING_SECONDS}from '../src/game/awakening';
import type{PlayerState,CombatEvent,AttackSlot}from '../src/game/types';import {base,loadRig}from './rigHarness';import {weightedSkin}from './fighterContactGeometry';
import { fighterShown } from '../src/originals/launch';
import { ORIGINALS } from '../src/originals/roster';
// Two bodies stepped through every move: seconds a test on a quiet machine, and this one is shared.
vi.setConfig({testTimeout:60000});
const id='hawser';let model:GLTF,form:GLTF;beforeAll(async()=>{model=await loadRig(FIGHTERS[id].model);form=await loadRig(FIGHTERS[id].formModel!);});
function actor(){const f=new Fighter(base(id),model);f.attachForm(form);f.prepareRush();f.targetPoint=new THREE.Vector3(0,1.2,2.6);f.targetDistance=2.6;for(let i=0;i<60;i++)f.update(1/120,base(id),true);return f;}
function advance(f:Fighter,state:PlayerState,end:number){const from=f.state.action===state.action&&f.state.actionSeq===state.actionSeq?f.state.actionTime*f.state.actionDuration:0;for(let t=from;t<end+1/120;t+=1/120)f.update(1/120,{...state,actionTime:Math.min(end,t)/state.actionDuration},true);}
function awaken(f:Fighter){advance(f,{...base(id),action:'awaken',awakened:true,awakenedUntil:20,actionStarted:1,actionSeq:1,actionDuration:AWAKENING_ENTRY},.85);}
/** Where the blow is on the body drawn: the YUGE's knuckle, or the tip of the Scout's blade on the blade's own joint. */
function expected(f:Fighter,index?:number){
 const m=f.motionEvidence(),colossus=!!m.formVisible,clip=colossus?m.formClip:m.clip,time=colossus?m.formClipTime:m.clipTime,duration=(colossus?form:model).animations.find(c=>c.name===clip)!.duration;
 if(colossus){const side=hawserTrunkFist(clip!,index,time!/duration);return new THREE.Vector3().fromArray(HAWSER_COLOSSUS_KNUCKLES[side]).applyMatrix4(f.drawnJoint(side)!.matrixWorld);}
 const blade=hawserBlade(clip!,index,time!/duration);return f.shownBody.bones.get(blade.toLowerCase())!.localToWorld(new THREE.Vector3().fromArray(HAWSER_SWORD_SOCKETS[blade].tip));
}
describe.skipIf(!!ORIGINALS.hawser)('Hawser: the Scout and the YUGE, in the shared game',()=>{
 it('clears a transformed native hand smear even on a repeated pose, without changing the Scout\'s repeated smear',()=>{const f=actor();try{awaken(f);type SmearBody={smear:{motion:{value:THREE.Vector4}};smearSeen:boolean;stepRepeat:boolean;updateSmear(state:PlayerState,real:number):void};const colossus=f.shownBody as unknown as SmearBody;expect(f.motionEvidence().formVisible).toBe(true);colossus.smear.motion.value.set(1,0,0,.33);colossus.smearSeen=true;colossus.stepRepeat=true;colossus.updateSmear(f.state,1/60);expect(colossus.smear.motion.value.w).toBe(0);expect(colossus.smearSeen).toBe(false);const scout=f as unknown as SmearBody;scout.smear.motion.value.set(1,0,0,.25);scout.smearSeen=true;scout.stepRepeat=true;scout.updateSmear(base(id),1/60);expect(scout.smear.motion.value.w).toBe(.25);expect(scout.smearSeen).toBe(true);}finally{f.dispose();}});
 it.each(['lockon','dynamic']as const)('%s awakening camera contains the actual Colossus crown after reveal',async(mode)=>{const f=actor(),foe=new Fighter({...base('gorai'),id:'foe',z:3},await loadRig(FIGHTERS.gorai.model)),camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),map=new Map([['m',f],['foe',foe]]);follow.mode=mode;follow.cinematics=true;follow.director.crowd=map;let yaw=0,samples=0;try{for(let i=0;i<135;i++){const t=(i-30)/60,s:PlayerState={...base(id),action:i>=30&&t<.9?'awaken':'idle',actionStarted:2,actionSeq:2,actionDuration:.9,actionTime:Math.max(0,Math.min(.999,t/.9)),awakened:i>=30,awakenedUntil:20};f.update(1/60,s,true);foe.update(1/60,{...foe.state},true);Fighter.settleContacts();follow.director.handle([],'m',key=>map.get(key));follow.update(1/60,f,yaw,0,[],0,foe,true);yaw=follow.inputYaw;camera.updateMatrixWorld();if(t<.62||t>.88)continue;const head=f.drawnJoint('Head')!.getWorldPosition(new THREE.Vector3());head.y+=.15;const p=head.project(camera);if(process.env.HAWSER_CONTACT_PROBE)fs.appendFileSync(process.env.HAWSER_CONTACT_PROBE+'/camera-'+mode+'.jsonl',JSON.stringify({t,head:p.toArray(),eye:camera.position.toArray(),motion:f.motionEvidence()})+'\n');expect(Math.abs(p.x)).toBeLessThan(.95);expect(p.y).toBeGreaterThan(-.85);expect(p.y).toBeLessThan(.85);expect(p.z).toBeLessThan(1);samples++;}expect(samples).toBeGreaterThan(10);}finally{f.dispose();foe.dispose();}});

 it('preserves the pinned roster, the 1.70 m Scout and 3.4 m Colossus pair and his homepage art',()=>{expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);expect(LABORATORY_FIGHTERS).not.toContain(id);expect(mayPlay(id,{items:{},allAccess:true})).toBe(fighterShown(id));expect(isBadBloodFighter(id)).toBe(true);expect(factionOf(id)).toBe('heroes');expect(FIGHTERS[id].height).toBe(1.7);expect(bodyBulk({fighter:id,awakened:true})).toBe(2);expect(bodyBulk({fighter:id})).toBe(1);const row=JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json','utf8')).fighters.find((r:{id:string})=>r.id===id);expect(row.frames).toHaveLength(row.frameCount??16);for(const[k,h]of[['file','sha256'],['poster','posterSha256']]as const)expect(createHash('sha256').update(fs.readFileSync('public/assets/home/sprites/'+row[k])).digest('hex')).toBe(row[h]);});
 it('manual entry keeps both bodies at their own size and reveals the Colossus after the hand bite at .594s',()=>{const f=actor(),s={...base(id),action:'awaken'as const,awakened:true,awakenedUntil:20,actionStarted:1,actionSeq:1,actionDuration:AWAKENING_ENTRY};try{expect(awakeningSwapAt(id)).toBe(.594);
  // (The Scout is sized as Levin is, whose stance he stands in: 1.70 m to the crown in that crouch, so a little over the file's own size.)
  const scale=f.model.scale.x;expect(scale).toBeGreaterThan(1);expect(scale).toBeLessThan(1.08);advance(f,s,.57);expect(f.motionEvidence().formVisible).toBe(false);expect(f.motionEvidence().clip).toBe('Freedom Awakens');advance(f,s,.85);expect(f.motionEvidence().formVisible).toBe(true);expect(f.motionEvidence().formClip).toBe('YUGE Emergence');expect(f.shownBody.model.scale.toArray()).toEqual([1,1,1]);expect(f.model.scale.x).toBe(scale);expect(Math.abs(f.motionEvidence().formClipTime!/1.8666666746139526-.85/.9)).toBeLessThan(1/120/.9+.002);}finally{f.dispose();}});
 it.each([false,true])('every melee slot, stage and ender strikes from the blade or the knuckle of the body drawn; colossus=%s',colossus=>{const cases=[...(['light','heavy','special']as const).map(slot=>({slot})),...['lh','llh','lllh','llls','airHeavy','airSpecial'].map(branch=>({slot:branch==='llls'||branch==='airSpecial'?'special':'heavy',branch})),...[1,2,3].map(chain=>({slot:'light',chain}))];for(const c of cases){const f=actor();try{if(colossus)awaken(f);const slot=c.slot as AttackSlot,branch='branch'in c?c.branch as ComboKey:undefined,chain='chain'in c?c.chain as number:undefined,m=branch?comboMove(id,branch,colossus)!:chain?rushMove(id,chain,colossus):moveFor(id,slot,colossus);advance(f,{...base(id),awakened:colossus,awakenedUntil:20,action:slot,branch,chain,actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);const p=new THREE.Vector3(),label=`${colossus?'colossus':'scout'} ${branch??(chain?'rush '+chain:slot)} (${f.motionEvidence().formVisible?f.motionEvidence().formClip:f.motionEvidence().clip})`;expect(f.motionEvidence().formVisible,label).toBe(colossus);
  // (The Scout's heavy is a Fuse Lance: a shot, with no melee contact to place.)
  if(m.style==='melee'){expect(f.meleeContactPoint(0,p),label).toBe(true);expect(p.distanceTo(expected(f,0)),label).toBeLessThan(1e-6);}
  expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected(f)),label).toBeLessThan(1e-6);expect(f.chargePosition(new THREE.Vector3()).distanceTo(expected(f)),label).toBeLessThan(1e-6);}finally{f.dispose();}}});
 it('the Scout throws his string off the floor with his own clips, as Levin does; the Colossus its three native air takes, whole',()=>{
  expect(AIR_STRING_CLIPS[id]).toBeUndefined();
  for(const colossus of[false,true])for(let chain=0;chain<3;chain++){const f=actor(),m=rushMove(id,chain,colossus);try{if(colossus)awaken(f);advance(f,{...base(id),awakened:colossus,awakenedUntil:20,action:'light',chain,y:2,grounded:false,actionDuration:m.duration,actionStarted:2,actionSeq:2},m.contacts[0]);const e=f.motionEvidence(),clip=e.formVisible?e.formClip:e.clip;expect(e.formVisible).toBe(colossus);
   if(colossus){expect(clip).toBe(['Rebel Uppercut','Defiant Hook','Freedom Hammer'][chain]);expect(FORM_AIR_STRING_CLIPS[id]![chain].span).toBeCloseTo(form.animations.find(c=>c.name===clip)!.duration,6);}
   else expect(clip).toBe(['Fray','Rush 1','Rush 2'][chain]);
   expect(f.strikePoint(new THREE.Vector3()).distanceTo(expected(f))).toBeLessThan(1e-6);}finally{f.dispose();}}});
 it.each([false,true])('every confirmed contact of the ultimate lands on the body that throws it, from its own blade or fist; colossus=%s',colossus=>{const f=actor(),m=moveFor(id,'ultimate',colossus);try{if(colossus)awaken(f);expect(m.contacts).toHaveLength(colossus?4:7);for(const[index,t]of m.contacts.entries()){advance(f,{...base(id),awakened:colossus,awakenedUntil:20,action:'ultimate',actionStarted:2,actionSeq:2,confirmedAt:index?2+m.contacts[0]:undefined,actionDuration:m.duration},t);const e=f.motionEvidence();expect(e.formVisible).toBe(colossus);expect(colossus?e.formClip:e.clip).toBe(colossus?'Advancing Rage':'Slipped Moorings');
  // (The Colossus's four blows where its take draws them; the Scout's seven in the windows of Levin's spin.)
  if(colossus)expect(e.formClipTime!/4.199999809265137).toBeCloseTo([.56/4.2,1.38/4.2,2.32/4.2,3.46/4.2][index],2);else expect(e.clipTime!/2.25).toBeCloseTo([.181,.406,.507,.608,.709,.81,.915][index],1);
  const p=new THREE.Vector3();expect(f.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(expected(f,index))).toBeLessThan(1e-6);}expect(m.duration-m.contacts.at(-1)!).toBeGreaterThan(.6);}finally{f.dispose();}});
 it('the simulation lands the Scout\'s 41+13+11+10+9+8+167 and the Colossus\'s 44+62+83+201; a whiff, an awakened idle and a guard do no damage',()=>{for(const mode of['scout','colossus','miss','idle','guard']){const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed:81});sim.addPlayer('a',id,'A',false,{x:0,y:0,z:0});sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:mode==='miss'?18:2});const a=sim.actors.get('a')!.state;a.ultimate=100;if(mode!=='scout'&&mode!=='miss'){a.awakened=true;a.awakenedUntil=100;}const events:CombatEvent[]=[];try{for(let i=0;i<360;i++){sim.submitInput('a',{seq:i+1,moveX:0,moveZ:0,yaw:0,targetId:mode==='scout'||mode==='colossus'?'b':null,guard:mode==='guard',attack:i===0&&(mode==='scout'||mode==='colossus'||mode==='miss')?'ultimate':undefined});sim.step(1/60);events.push(...sim.drainEvents());}const hits=events.filter(e=>e.actorId==='a'&&e.kind==='hit'),cast=events.find(e=>e.actorId==='a'&&e.kind==='cast');
  if(mode==='scout'){expect(cast!.move).toBe('Slipped Moorings');expect(hits.map(e=>e.damage)).toEqual([41,13,11,10,9,8,167]);}
  else if(mode==='colossus'){expect(cast!.move).toBe('Timberfall');expect(hits.map(e=>e.damage)).toEqual([44,62,83,201]);expect(hits.reduce((s,e)=>s+(e.damage??0),0)).toBe(Math.round(300*AWAKENED_DAMAGE));}
  else{expect(hits).toHaveLength(0);expect(events.some(e=>e.kind==='confirm')).toBe(false);}}finally{sim.dispose();}}});
 it('native soles stay grounded through the Scout\'s standing blows and all four of the Colossus\'s, and the form keeps its height',()=>{for(const colossus of[false,true])for(const slot of(colossus?['light','heavy','special','ultimate']:['light','heavy'])as AttackSlot[]){const f=actor(),m=moveFor(id,slot,colossus);try{if(colossus)awaken(f);advance(f,{...base(id),awakened:colossus,awakenedUntil:20,action:slot,actionDuration:m.duration,actionStarted:2,actionSeq:2,...(slot==='ultimate'?{confirmedAt:2.56}:{})},m.contacts.at(-1)!);const points=weightedSkin(f.shownBody,/^(Left|Right)(Foot|ToeBase)$/),low=Math.min(...points.map(p=>p.y));if(process.env.HAWSER_CONTACT_PROBE)fs.writeFileSync(process.env.HAWSER_CONTACT_PROBE+'/floor-'+colossus+'-'+slot+'.json',JSON.stringify({low,motion:f.motionEvidence()},null,2));expect(low,`${colossus?'colossus':'scout'} ${slot}`).toBeGreaterThan(-.03);expect(low,`${colossus?'colossus':'scout'} ${slot}`).toBeLessThan(.06);}finally{f.dispose();}}});
 it('keeps 6 genuine combat files intact, no effort on rapid lights and confirmed-only ultimate speech on both bodies; the Scout is heard as steel and gear, the Colossus as fists',()=>{
  const rows=JSON.parse(fs.readFileSync('public/assets/audio/v2/voice/manifest.json','utf8')).assets.filter((r:{fighter:string;plays?:string;situation?:string})=>r.fighter===id&&!r.plays?.startsWith('area:')&&!r.situation);expect(rows).toHaveLength(6);for(const r of rows)expect(createHash('sha256').update(fs.readFileSync('public'+r.file)).digest('hex')).toBe(r.runtimeSha256);
  const cast:CombatEvent={id:1,kind:'cast',fighter:id,actorId:'a',slot:'ultimate',serverTime:2},said=(event:CombatEvent,awakened:boolean)=>planCombatAudio(event,awakened).filter(l=>l.bus==='voice').map(l=>l.cue),heard=(event:CombatEvent,awakened:boolean)=>planCombatAudio(event,awakened).filter(l=>l.bus!=='voice').map(l=>l.cue as string);
  for(const awakened of[false,true]){
   expect(said(cast,awakened),'no line until the ultimate lands').toEqual([]);
   expect(said({...cast,kind:'confirm',castAge:moveFor(id,'ultimate',awakened).contacts[0]},awakened)).toEqual(['vo-hawser-eradicate']);
   expect(said({...cast,slot:'light'},awakened)).toEqual([]);
  }
  // Each body's own area line: "Tug of War!" on the Scout's, the uprooting's declaration on the Colossus's.
  expect(said({...cast,slot:'area'},false)).toEqual(['vo-hawser-strike']);expect(said({...cast,slot:'area'},true)).toEqual(['vo-hawser-uprooting']);
  // Steel and the gear for the Scout (Levin's sounds), fists and stone for the Colossus (adult Hawser's, as they were).
  expect(heard({...cast,slot:'light'},false).some(c=>c.startsWith('fx-slash-katana'))).toBe(true);expect(heard({...cast,slot:'light'},true).some(c=>c.startsWith('fx-swing-jab'))).toBe(true);
  expect(heard({...cast,slot:'light',kind:'hit',targetId:'b'},false).some(c=>c.startsWith('fx-cut'))).toBe(true);expect(heard({...cast,slot:'light',kind:'hit',targetId:'b'},true).some(c=>c.startsWith('fx-hit-light'))).toBe(true);
  for(const slot of['special','ultimate']as const){expect(heard({...cast,slot},false),slot).toContain('fx-sig-grapple');expect(heard({...cast,slot},true),slot).not.toContain('fx-sig-grapple');}
  expect(heard({...cast,slot:'heavy'},false).some(c=>c.startsWith('fx-zip'))).toBe(true);
  expect(heard({...cast,slot:'area'},true)).toContain('fx-el-stone-cast');expect(heard({...cast,slot:'area'},false)).not.toContain('fx-el-stone-cast');
  // The awakening: the bolt on the swap.
  const bolt=planCombatAudio({...cast,kind:'awaken',slot:undefined}).find(l=>l.cue==='fx-lightning')!;expect(bolt).toBeDefined();expect(bolt.phase).toBe('release');
 });
 it('the Colossus\'s four bounded room pools follow a landed blow and stay quiet without one; the Scout\'s blows are staged without them',async()=>{
  const f=actor(),scene=new THREE.Scene(),fx=new CombatEffects(scene),bodies=new Map([['m',f]]),own=MOVES[id].special,m=moveFor(id,'special',true),cast:CombatEvent={id:8901,kind:'cast',fighter:id,actorId:'m',slot:'special',serverTime:10,actionSeq:2};
  try{
   await fx.load([id]);const pools=scene.children.filter(o=>o.name.startsWith('hawser-'))as THREE.InstancedMesh[],drawn=()=>pools.reduce((n,p)=>n+p.count,0);expect(pools).toHaveLength(4);
   fx.update(10,1/60,bodies);expect(drawn()).toBe(0);
   // The Scout's Snap Line lands: nothing is thrown through the air, and none of the Colossus's pools draws it.
   advance(f,{...base(id),action:'special',actionDuration:own.duration,actionStarted:10,actionSeq:2},.6);fx.handle([cast],bodies);fx.update(10.6,1/60,bodies);
   expect([...FLIGHTS.values()].some(flight=>flight.fighter===id)).toBe(false);
   fx.handle([{...cast,id:8902,kind:'hit',serverTime:10.6,endpoint:{x:3,y:1.2,z:-7}}],bodies);fx.update(10.61,1/60,bodies);expect(drawn()).toBe(0);
   // Awakened, the Colossus's Burl Fist lands: its pools draw the blow over what stands on its hands; a reset empties
   // them and another room takes them down.
   awaken(f);advance(f,{...base(id),awakened:true,awakenedUntil:60,action:'special',actionDuration:m.duration,actionStarted:20,actionSeq:3},m.contacts[0]);
   fx.handle([{...cast,id:8903,serverTime:20,actionSeq:3}],bodies);fx.update(20+m.contacts[0],1/60,bodies);const standing=drawn();
   fx.handle([{...cast,id:8904,kind:'hit',serverTime:20+m.contacts[0],actionSeq:3,endpoint:{x:3,y:2.2,z:-7}}],bodies);fx.update(20+m.contacts[0]+.01,1/60,bodies);
   expect(drawn()).toBeGreaterThan(standing);
   fx.reset();expect(drawn()).toBe(0);
   await fx.load(['taisei']);expect(scene.children.some(o=>o.name.startsWith('hawser-'))).toBe(false);
  }finally{fx.dispose();f.dispose();}
 });
 it('each body has cards of its own: the Scout\'s sheet and Tug of War, the YUGE\'s sheet and the uprooting, fetched by their files\' hashes',()=>{
  expect(moveSheetsFor(id)).toEqual(['hawser','hawser-colossus']);
  const hashed=(url:string)=>{const[file,version]=url.split('?v=');expect(fs.existsSync('public'+file),file).toBe(true);expect(version,file).toBe(createHash('sha256').update(fs.readFileSync('public'+file)).digest('hex').slice(0,12));};
  for(const sheet of moveSheetsFor(id)){hashed(moveSheetUrl(sheet));const area=areaArtUrl(sheet);expect(area,sheet).toBeDefined();hashed(area!);}
  expect(areaArtUrl('hawser')).not.toBe(areaArtUrl('hawser-colossus'));
 });
 it('while the YUGE is drawn nothing of the Scout is, his blades least of all; when its time runs out both are in his hands again, once each',()=>{
  // (13 October 2026: thin pale lines by the Colossus's legs were read as the Scout's blades left drawn. They were not:
  // this holds that they never are. The lines were the steam's wind: the next test.)
  const f=actor(),drawn=(o:THREE.Object3D)=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const meshes:THREE.Mesh[]=[];f.group.traverse(o=>{if((o as THREE.Mesh).isMesh&&!o.name.endsWith('-ink')&&o.name!=='contact-shadow')meshes.push(o as THREE.Mesh);});
  const names=()=>meshes.filter(drawn).map(m=>m.name).sort(),blades=meshes.filter(m=>m.name==='weapon_grapple_blades');
  try{
   expect(blades).toHaveLength(1);expect(names()).toEqual(['body_hawser_scout','weapon_grapple_blades']);
   // Through the entry: the Scout bites his hand with both blades drawn, then the Colossus stands in his place and he is gone whole.
   const entry:PlayerState={...base(id),action:'awaken',awakened:true,awakenedUntil:1+AWAKENING_SECONDS,actionStarted:1,actionSeq:1,actionDuration:AWAKENING_ENTRY},swap=awakeningSwapAt(id);
   for(let t=0;t<AWAKENING_ENTRY;t+=1/60){
    f.update(1/60,{...entry,actionTime:Math.min(.999,t/AWAKENING_ENTRY)},true);
    const colossus=!!f.motionEvidence().formVisible;
    expect(names().includes('weapon_grapple_blades'),`blades drawn ${t.toFixed(2)} s in, Colossus ${colossus}`).toBe(!colossus);
    expect(names().includes('body_hawser_scout'),`Scout drawn ${t.toFixed(2)} s in`).toBe(!colossus);
    if(t>swap+.05)expect(colossus,`the Colossus stands ${t.toFixed(2)} s in`).toBe(true);
   }
   // Awakened: standing, and through every one of the Colossus's blows (the hidden Scout body plays his own under it).
   const awake={...base(id),awakened:true,awakenedUntil:1+AWAKENING_SECONDS};
   for(let i=0;i<60;i++)f.update(1/60,awake,true);
   expect(names().every(n=>n.startsWith('Object_')),names().join()).toBe(true);expect(names().length).toBeGreaterThan(0);
   for(const slot of['light','heavy','special','ultimate','area']as const){
    const m=moveFor(id,slot,true),state:PlayerState={...awake,action:slot,actionDuration:m.duration,actionStarted:30,actionSeq:10+slot.length};
    for(let t=0;t<m.duration;t+=1/30){f.update(1/30,{...state,actionTime:Math.min(.999,t/m.duration)},true);expect(names().some(n=>!n.startsWith('Object_')),`${slot} at ${t.toFixed(2)} s: ${names().join()}`).toBe(false);}
   }
   // Its time runs out: the Scout again, his body and one pair of blades, each on its joint under its hand.
   for(let i=0;i<60;i++)f.update(1/60,base(id),true);
   expect(f.motionEvidence().formVisible).toBe(false);expect(names()).toEqual(['body_hawser_scout','weapon_grapple_blades']);
   f.group.updateMatrixWorld(true);
   for(const side of['Left','Right']as const){
    const hand=f.bones.get(side.toLowerCase()+'hand')!.getWorldPosition(new THREE.Vector3()),blade=f.bones.get(side.toLowerCase()+'blade')!;
    expect(blade.parent,side).toBe(f.bones.get(side.toLowerCase()+'hand'));expect(blade.getWorldPosition(new THREE.Vector3()).distanceTo(hand),side).toBeLessThan(.12);
   }
  }finally{f.dispose();}
 });
 it('the Colossus\'s steam comes off the Colossus: at its own shoulders and back, with none of the thin pale lines a man\'s steam whips round his feet',()=>{
  // The steam's wind (render/vfx/powerup/Motes.ts) is thin white streaks low round the feet. Round a 3.4 m Colossus
  // they stood at the Scout's height and read as his blades left in the air (13 October 2026). A giant has none.
  const field=()=>{const log:number[]=[];const held:Record<string,unknown>={};const spec:unknown=new Proxy(held,{get:(t,k:string)=>k==='pos'?(_x:number,y:number)=>{t.y=y;return spec;}:k in t?t[k]:()=>spec,set:(t,k:string,v)=>{t[k]=v;return true;}});return{spec,emit:()=>{log.push(held.y as number);},log};};
  const kit=()=>({dust:field(),sparks:field(),smoke:()=>undefined});
  expect(awakenedPower(id)).toMatchObject({motes:['steam',0xffffff,0xc4ccd4],onForm:true});
  const f=actor();
  try{
   awaken(f);for(let i=0;i<60;i++)f.update(1/60,{...base(id),awakened:true,awakenedUntil:20},true);f.group.updateMatrixWorld(true);
   const head=f.drawnJoint('Head')!.getWorldPosition(new THREE.Vector3()).y-f.group.position.y;expect(head,'the Colossus\'s own head, not the hidden Scout\'s').toBeGreaterThan(2.6);
   const colossus=kit();for(let i=0;i<400;i++)emitMote(colossus as never,'steam',f,i*.05,1,0xffffff,0xc4ccd4);
   expect(colossus.sparks.log,'no wind lines round the Colossus').toHaveLength(0);
   expect(colossus.dust.log).toHaveLength(400);
   // Off the Colossus's thighs up to its shoulders and over, where a man's is at his waist to over his head: nothing at the Scout's height alone.
   expect(Math.min(...colossus.dust.log)-f.group.position.y).toBeGreaterThan(.7*head/1.6-.01);expect(Math.max(...colossus.dust.log)-f.group.position.y).toBeGreaterThan(head*.9);
   // And a man's is as it was (the Scout's own body is a man's: the same call on it).
   for(let i=0;i<90;i++)f.update(1/60,base(id),true);f.group.updateMatrixWorld(true);expect(f.motionEvidence().formVisible).toBe(false);
   const man=kit();for(let i=0;i<400;i++)emitMote(man as never,'steam',f,i*.05,1,0xffffff,0xc4ccd4);
   expect(man.sparks.log.length,'a man\'s steam keeps its wind').toBeGreaterThan(150);
   for(const y of man.sparks.log)expect(y-f.group.position.y).toBeLessThan(.6);
   for(const y of man.dust.log){expect(y-f.group.position.y).toBeGreaterThanOrEqual(.7);expect(y-f.group.position.y).toBeLessThanOrEqual(1.7);}
  }finally{f.dispose();}
 });
});
