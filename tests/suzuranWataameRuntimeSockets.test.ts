import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import { ORIGINALS } from '../src/originals/roster';
import {Fighter} from '../src/render/Fighter';
import {FIGHTERS} from '../src/config';
import {MOVES} from '../src/game/moves';
import type {PlayerState} from '../src/game/types';
import {base,loadRig} from './rigHarness';
import { hasAsset } from './assets';
function advance(actor:Fighter,state:PlayerState,end:number){for(let i=0;i<=Math.ceil(end*120);i++)actor.update(1/120,{...state,actionTime:Math.min(end,i/120)/state.actionDuration},true);}
describe('new native palm and bokken sockets through actual Fighter layers',()=>{
 it.each(([['suzuran','light','Left'],['suzuran','heavy','Both'],['suzuran','special','Right'],['oyashio','light','Right'],['oyashio','heavy','Left']]as const).filter(([id])=>id!=='oyashio'||hasAsset('/assets/fighters/oyashio-night1.glb')))('%s %s uses the posed %s palm',async(id,slot,side)=>{
  // Oyashio plays his baked takes over the body's own clips, as FighterLibrary lays the night file on (15 October: his first
  // light is Jirenga's jab under Tide Palm, thrown with the right; scripts/night/anim/picks.json, src/engine/client/sockets.ts).
  const rig=await loadRig(FIGHTERS[id].model);if(id==='oyashio'){const night=await loadRig('/assets/fighters/oyashio-night1.glb'),names=new Set(night.animations.map(clip=>clip.name));rig.animations=[...rig.animations.filter(clip=>!names.has(clip.name)),...night.animations];}
  const state=base(id),actor=new Fighter(state,rig);actor.prepareRush();actor.targetPoint=new THREE.Vector3(0,1.3,4);actor.targetDistance=4;
  try{for(let i=0;i<60;i++)actor.update(1/60,state,true);const m=MOVES[id][slot];advance(actor,{...state,action:slot,actionSeq:1,actionStarted:1,actionDuration:m.duration},m.contacts[0]);
   const l=actor.joints.get('LeftHand')!.getWorldPosition(new THREE.Vector3()),r=actor.joints.get('RightHand')!.getWorldPosition(new THREE.Vector3()),expected=side==='Both'?l.clone().lerp(r,.5):side==='Left'?l:r,p=new THREE.Vector3();
   expect(actor.chargePosition(p).distanceTo(expected)).toBeLessThan(1e-5);expect(actor.strikePoint(p).distanceTo(expected)).toBeLessThan(1e-5);expect(actor.meleeContactPoint(0,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-5);
   if(id==='oyashio'&&slot==='light')expect(expected.distanceTo(l)).toBeGreaterThan(.4);
  }finally{actor.dispose();}
 });
 it('retains Suzuran’s actual alternating palms and final twin contact in her six-hit ultimate',async()=>{
  const state=base('suzuran'),actor=new Fighter(state,await loadRig(FIGHTERS.suzuran.model));actor.prepareRush();
  try{const m=MOVES.suzuran.ultimate,sides=['Left','Right','Left','Right','Left','Both'];
   for(let index=0;index<m.contacts.length;index++){advance(actor,{...state,action:'ultimate',actionSeq:1,actionStarted:1,actionDuration:m.duration},m.contacts[index]);const left=actor.joints.get('LeftHand')!.getWorldPosition(new THREE.Vector3()),right=actor.joints.get('RightHand')!.getWorldPosition(new THREE.Vector3()),expected=sides[index]==='Both'?left.clone().lerp(right,.5):sides[index]==='Left'?left:right,p=new THREE.Vector3();expect(actor.meleeContactPoint(index,p)).toBe(true);expect(p.distanceTo(expected)).toBeLessThan(1e-5);}
  }finally{actor.dispose();}
 });
 it.skipIf(!!ORIGINALS.wataame).each(['light','heavy','special','ultimate']as const)('Wataame %s keeps the physical strike point on his actual wooden blade',async slot=>{
  const state=base('wataame'),actor=new Fighter(state,await loadRig(FIGHTERS.wataame.model));actor.prepareRush();actor.targetPoint=new THREE.Vector3(0,1.4,4);actor.targetDistance=4;
  try{for(let i=0;i<60;i++)actor.update(1/60,state,true);const m=MOVES.wataame[slot];advance(actor,{...state,action:slot,actionSeq:1,actionStarted:1,actionDuration:m.duration},m.contacts.at(-1)!);const blade=actor.model.getObjectByName('Wataame_LakeToya')as THREE.SkinnedMesh,p=new THREE.Vector3(),v=new THREE.Vector3();actor.strikePoint(p);let nearest=Infinity;
   for(let i=0;i<blade.geometry.attributes.position.count;i++){blade.getVertexPosition(i,v).applyMatrix4(blade.matrixWorld);nearest=Math.min(nearest,p.distanceTo(v));}
   expect(actor.armed).toBe(true);expect(nearest).toBeLessThan(.016);expect(p.distanceTo(actor.handR)).toBeGreaterThan(.7);expect(actor.chargePosition(v).distanceTo(p)).toBeLessThan(1e-5);
  }finally{actor.dispose();}
 });
});
