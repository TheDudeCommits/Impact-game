import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {loadRig} from './rigHarness';
import {HAKUSHI_MOVES} from '../src/game/fighters/hakushi';
import { ORIGINALS } from '../src/originals/roster';
import { hasAsset } from './assets';

describe('Hakushi candidate model and manual kit',()=>{
 for(const path of ['/assets/fighters/hakushi-elder1.glb','/assets/fighters/hakushi-sage1.glb']){
  it.skipIf(!!ORIGINALS.hakushi)(`${path} has finite bounded skin, complete actions and grounded contacts`,async()=>{
   const g=await loadRig(path),mixer=new THREE.AnimationMixer(g.scene),bones:THREE.Bone[]=[],skins:THREE.SkinnedMesh[]=[];
   g.scene.traverse(o=>{if((o as THREE.Bone).isBone)bones.push(o as THREE.Bone);if((o as THREE.SkinnedMesh).isSkinnedMesh)skins.push(o as THREE.SkinnedMesh);});
   expect(bones.length).toBeLessThanOrEqual(84);expect(skins.length).toBeLessThanOrEqual(2);
   expect(skins.reduce((n,s)=>n+(s.geometry.index?.count??s.geometry.attributes.position.count)/3,0)).toBeLessThan(32000);
   for(const n of ['_Idle','Run','Walk','Dash','Block','Hit 01','Die fall','Landing','jump','Jump Fall','Flourish Palm','Lion\'s Pearl','Flame Bomb','Lion Dance: Over the Cliff','THE OLD LION','Rush 1','Rush 2','Rush 3'])expect(g.animations.some(c=>c.name===n),n).toBe(true);
   const p=new THREE.Vector3(),head=new THREE.Vector3(),hip=new THREE.Vector3();
   for(const clip of g.animations){
    mixer.stopAllAction();mixer.clipAction(clip).reset().play();
    for(const phase of [0,.2,.5,.8,.999]){
     mixer.setTime(clip.duration*phase);g.scene.updateMatrixWorld(true);let lo=Infinity,hi=-Infinity;
     for(const skin of skins)for(let i=0;i<skin.geometry.attributes.position.count;i++){skin.getVertexPosition(i,p).applyMatrix4(skin.matrixWorld);expect(Number.isFinite(p.length())).toBe(true);lo=Math.min(lo,p.y);hi=Math.max(hi,p.y);}
     expect(lo,`${clip.name}@${phase} sole`).toBeGreaterThan(-.03);expect(lo,`${clip.name}@${phase} floating`).toBeLessThan(.06);expect(hi-lo).toBeLessThan(2.8);
     if(clip.name==='Run'||clip.name==='_Idle'){g.scene.getObjectByName('Head')!.getWorldPosition(head);g.scene.getObjectByName('Hips')!.getWorldPosition(hip);expect(head.y-hip.y,clip.name).toBeGreaterThan(.40);}
    }
   }
  },20000);
  it.skipIf(!hasAsset(path))(`${path} keeps the palm-sphere hand in front and distinct awakening hand choreography`,async()=>{
   const g=await loadRig(path),m=new THREE.AnimationMixer(g.scene),hand=g.scene.getObjectByName('RightHand')!,head=g.scene.getObjectByName('Head')!,a=new THREE.Vector3(),b=new THREE.Vector3();
   const heavy=g.animations.find(c=>c.name==='Lion\'s Pearl')!;m.clipAction(heavy).play();m.setTime(heavy.duration*.58);g.scene.updateMatrixWorld(true);hand.getWorldPosition(a);head.getWorldPosition(b);expect(a.z-b.z).toBeGreaterThan(.18);
   m.stopAllAction();const awake=g.animations.find(c=>c.name==='THE OLD LION')!;m.clipAction(awake).play();m.setTime(awake.duration*.35);g.scene.updateMatrixWorld(true);hand.getWorldPosition(a);m.setTime(awake.duration*.64);g.scene.updateMatrixWorld(true);hand.getWorldPosition(b);expect(a.distanceTo(b),'seal to kabuki release must actually move').toBeGreaterThan(.24);
  });
 }
 it('never creates passive damage or an autonomous summon',()=>{
  expect(HAKUSHI_MOVES.ultimate.confirm).toBeDefined();expect(HAKUSHI_MOVES.ultimate.contacts).toEqual([.52,1.82,2.6]);
  for(const move of Object.values(HAKUSHI_MOVES)){expect(move.contacts.every(t=>t>0&&t<move.duration)).toBe(true);expect(move.cooldown).toBeGreaterThan(0);expect(move.style).not.toBe('field');expect(move.detached).not.toBe(true);}
 });
});
