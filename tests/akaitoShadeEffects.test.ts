import * as THREE from 'three';
import { describe,expect,it,vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { AkaitoShade } from '../src/render/signature/AkaitoShade';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId,PlayerState,CombatEvent } from '../src/game/types';
import type { Flight } from '../src/render/CombatEffects';
const AKAITO='akaito' as FighterId;
function harness(){const scene=new THREE.Scene(),fx=new AkaitoShade(scene,{budget:1});const make=(id:string):Fighter=>({group:new THREE.Group(),handL:new THREE.Vector3(-.2,1.2,.1),handR:new THREE.Vector3(.2,1.2,.1),state:{id,fighter:id==='akaito'?AKAITO:'taisei',alive:true,action:'idle',actionSeq:2,actionTime:0,actionDuration:3.2}as PlayerState}as unknown as Fighter);const akaito=make('akaito'),foe=make('foe');foe.group.position.z=2;const fighters=new Map([['akaito',akaito],['foe',foe]]),flights=new Map<string,Flight>();const beam=scene.getObjectByName('akaito-fated-knot-beams')as THREE.InstancedMesh;return{scene,fx,akaito,foe,fighters,flights,beam};}
const event=(patch:Partial<CombatEvent>={}):CombatEvent=>({id:1,kind:'confirm',fighter:AKAITO,actorId:'akaito',targetId:'foe',actionSeq:2,slot:'ultimate',serverTime:10.576,...patch});
describe('Akaito manual Red Thread Shade contract',()=>{
 it('cannot create damage or a beam while idle, awakening, or without a confirmed opener',()=>{const h=harness();try{for(const action of ['idle','awaken','ultimate']as const){Object.assign(h.akaito.state,{action,actionTime:.85});const before=JSON.stringify(h.akaito.state);h.fx.update(12.7,h.fighters,h.flights);expect(h.beam.count).toBe(0);expect(JSON.stringify(h.akaito.state)).toBe(before);}}finally{h.fx.dispose();}});
 it.each(['whiff','interrupt','new sequence','victim gone','reset'])('cancels confirmed presentation on%s',reason=>{const h=harness();try{Object.assign(h.akaito.state,{action:'ultimate',actionTime:2.7/3.2});h.fx.handle(event(),h.fighters);h.fx.update(12.7,h.fighters,h.flights);expect(h.beam.count).toBe(3);if(reason==='whiff')h.fx.handle(event({id:2,kind:'whiff'}),h.fighters);if(reason==='interrupt')h.akaito.state.action='hurt';if(reason==='new sequence')h.akaito.state.actionSeq=3;if(reason==='victim gone')h.foe.state.alive=false;if(reason==='reset')h.fx.reset();h.fx.update(12.71,h.fighters,h.flights);expect(h.beam.count).toBe(0);}finally{h.fx.dispose();}});
 it('keeps an authoritative lethal endpoint only through the short visual beam tail',()=>{const h=harness();try{Object.assign(h.akaito.state,{action:'ultimate',actionTime:2.7/3.2});h.fx.handle(event(),h.fighters);h.fx.handle(event({id:2,kind:'hit',contactIndex:2}),h.fighters);h.foe.state.alive=false;h.fx.handle(event({id:3,kind:'eliminated',actorId:'foe',fighter:'taisei'}),h.fighters);h.fighters.delete('foe');h.fx.update(12.7,h.fighters,h.flights);expect(h.beam.count).toBe(3);h.akaito.state.actionTime=3.1/3.2;h.fx.update(13.1,h.fighters,h.flights);expect(h.beam.count).toBe(0);}finally{h.fx.dispose();}});
 it.each(['expiry','interruption','new cast','death','reset'])('manual awakening tail is bounded and cancels on %s',async reason=>{
  const h=harness();vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue({scene:new THREE.Group(),animations:[]}as unknown as GLTF);
  const visible=()=>h.scene.children.filter(o=>o.name==='akaito-shade-manual-manifestation'&&o.visible&&!o.userData.warming).length; // (not one standing unseen for its one load-time draw)
  try{await h.fx.load(['akaito']);Object.assign(h.akaito.state,{awakened:true,action:'idle'});h.fx.update(10,h.fighters,h.flights);expect(visible()).toBe(0); // Idle never seeds a manifestation.
   Object.assign(h.akaito.state,{action:'awaken',actionTime:.7/.9,actionDuration:.9});h.fx.update(10.7,h.fighters,h.flights);expect(visible()).toBe(1);
   h.akaito.state.action='idle';const before=JSON.stringify(h.akaito.state);h.fx.update(11.03,h.fighters,h.flights);expect(visible()).toBe(1);expect(h.beam.count).toBe(0);expect(JSON.stringify(h.akaito.state)).toBe(before);
   if(reason==='interruption')h.akaito.state.action='hurt';if(reason==='new cast')h.akaito.state.actionSeq=3;if(reason==='death')h.akaito.state.alive=false;if(reason==='reset')h.fx.reset();
   h.fx.update(reason==='expiry'?11.5:11.1,h.fighters,h.flights);expect(visible()).toBe(0);expect(h.beam.count).toBe(0);
   Object.assign(h.akaito.state,{alive:true,action:'idle'});h.fx.update(12,h.fighters,h.flights);expect(visible()).toBe(0);
  }finally{h.fx.dispose();vi.restoreAllMocks();}
 });
 it('loads no Red Thread Shade asset for unrelated rooms and idempotently disposes owned effects',async()=>{const h=harness();await h.fx.load(['taisei','konta']);h.fx.dispose();h.fx.dispose();expect(h.scene.children).toHaveLength(0);});
});
