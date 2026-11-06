/** Launch night (12 October 2026): rosterSignatureFlightBridge.test.ts reads Tsubute's and Aqrab's shot off their live Armory castings. This is the same check as it stood before, with the
 *  Armory out of the rollout (`?armory=off` on a dev server: the game as it was before it): with no casting live their modules still publish the manually released shot and dress it in the
 *  same update, the original assertion, whole. */
import * as THREE from 'three';
import {afterEach,describe,expect,it,vi}from 'vitest';
import {CombatEffects,FLIGHTS}from '../src/render/CombatEffects';
import type{CombatEvent,FighterId}from '../src/game/types';
import {MOVES}from '../src/game/moves';
import type{Fighter}from '../src/render/Fighter';
import {base}from './rigHarness';
import {armoryDraws}from '../src/render/vfx/armory/drawn';
vi.mock('../src/render/vfx/armory/rollout',async importOriginal=>({...await importOriginal<typeof import('../src/render/vfx/armory/rollout')>(),armoryRollout:()=>new Set()}));
afterEach(()=>vi.restoreAllMocks());
describe('actual CombatEffects flight publication for room-loaded signatures with no casting live',()=>{
 it.each(['tsubute','aqrab']as const)('%s publishes its manually released shot and dresses it in the same update',async fighter=>{
  vi.spyOn(THREE.TextureLoader.prototype,'loadAsync').mockResolvedValue(new THREE.Texture<HTMLImageElement>());
  const scene=new THREE.Scene(),fx=new CombatEffects(scene),move=MOVES[fighter].special,group=new THREE.Group();
  const hand=new THREE.Vector3(0,1.4,.2);
  const actor={state:{...base(fighter),id:'a',action:'special',actionStarted:10,actionSeq:1,actionDuration:move.duration,actionTime:0},group,velocity:new THREE.Vector3(),joints:new Map(),bones:new Map(),handR:new THREE.Vector3(0,1.4,.2),handL:new THREE.Vector3(0,1.4,.2),chargePosition(out:THREE.Vector3){return out.copy(hand);},strikePoint(out:THREE.Vector3){return out.copy(hand);}}as unknown as Fighter;
  const fighters=new Map([['a',actor]]),cast:CombatEvent={id:100,kind:'cast',fighter,slot:'special',actorId:'a',actionSeq:1,serverTime:10,origin:{x:0,y:1.4,z:0},endpoint:{x:0,y:1.4,z:18}};
  try{
   await fx.load([fighter]);fx.handle([cast],fighters);fx.update(10+.1,1/60,fighters);expect([...FLIGHTS.values()].some(f=>f.fighter===fighter&&f.released)).toBe(false);
   fx.handle([{...cast,id:101,kind:'release',serverTime:10+move.contacts[0]}],fighters);
   actor.state.actionTime=(move.contacts[0]+.12)/move.duration;fx.update(10+move.contacts[0]+.12,1/60,fighters);
   const flight=[...FLIGHTS.values()].find(f=>f.fighter===fighter)!;expect(flight).toBeDefined();expect(flight.released).toBe(true);expect(flight.position.z).toBeGreaterThan(1);expect(flight.position.z).toBeLessThan(18);
   const signatureMeshes:THREE.InstancedMesh[]=[];scene.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o.name.startsWith(fighter+'-'))signatureMeshes.push(o);});expect(armoryDraws(fighter,'special')).toBe(false);expect(signatureMeshes.some(m=>m.count>0)).toBe(true);
   const generic=scene.getObjectByName('cast-100');expect(generic?.visible).toBe(false);
   expect(flight.origin).toBeDefined();expect(flight.position.z).toBeGreaterThan(flight.origin!.z);
   const launch=flight.origin!.clone(),travelled=flight.position.clone();hand.set(3,2,-4);
   actor.state.actionTime=(move.contacts[0]+.15)/move.duration;fx.update(10+move.contacts[0]+.15,1/60,fighters);
   expect(flight.origin!.equals(launch)).toBe(true);expect(flight.position.distanceTo(travelled)).toBeGreaterThan(0);
   fx.reset();expect([...FLIGHTS.values()].filter(f=>f.fighter===fighter)).toHaveLength(0);
  }finally{fx.dispose();}
 });
});
