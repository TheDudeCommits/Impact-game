import * as THREE from 'three';
import capture from './fixtures/umeHeavyApproach.json';
import {it,expect}from 'vitest';
import {Fighter}from '../src/render/Fighter';
import {FIGHTERS}from '../src/config';
import {MOVES}from '../src/game/moves';
import {base,loadRig}from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
function skinFloor(f:Fighter){const lows={RightHand:Infinity,LeftHand:Infinity,sole:Infinity};f.shownBody.group.updateWorldMatrix(true,true);f.shownBody.model.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh)||!o.name.startsWith('body_ume')||/-ink$/.test(o.name))return;const indices=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight,p=new THREE.Vector3();o.skeleton.update();for(let i=0;i<indices.count;i++){const totals={RightHand:0,LeftHand:0,sole:0};for(let j=0;j<4;j++){const n=o.skeleton.bones[indices.getComponent(i,j)].name,w=weights.getComponent(i,j);if(n.startsWith('RightHand'))totals.RightHand+=w;if(n.startsWith('LeftHand'))totals.LeftHand+=w;if(/^(Left|Right)(Foot|Toe)/.test(n))totals.sole+=w;}if(Object.values(totals).some(w=>w>.6)){o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld);for(const key of Object.keys(totals)as(keyof typeof lows)[])if(totals[key]>.6)lows[key]=Math.min(lows[key],p.y);}}});return lows;}

// Actual lunge + opponent + impact: stationary poses missed gait-induced lift.
it.skipIf(!!ORIGINALS.ume)('Ume ground strike retains its native floor contact after a moving approach',async()=>{
const frames=capture.frames,rig=await loadRig(FIGHTERS.ume.model),foeRig=await loadRig(FIGHTERS.sorrel.model);
 const initial={...base('ume'),id:'you',x:.058961677,y:.01,z:2.604360754,yaw:2.997062952};
 const enemy={...base('sorrel'),id:'foe',y:-.053390182};
 const f=new Fighter(initial,rig),other=new Fighter(enemy,foeRig);f.prepareRush();
 try{
 for(let i=0;i<60;i++){f.update(1/60,initial,true);other.update(1/60,enemy,true);Fighter.settleContacts();}
 let hit=false,last=0,contacts=0;
 for(const fr of frames){const elapsed=fr.elapsed;if(elapsed===undefined||elapsed>.94)continue;const dt=Math.max(.001,(fr.ms-last)/1000);last=fr.ms;
 const state={...initial,...fr.me,action:'heavy' as const,actionDuration:MOVES.ume.heavy.duration,actionStarted:2,actionSeq:2,actionTime:elapsed/MOVES.ume.heavy.duration};
 const target={...enemy,...fr.foe,id:'foe'};
 f.targetPoint=new THREE.Vector3(target.x,target.y+1.2,target.z);f.targetDistance=Math.hypot(target.x-state.x,target.z-state.z);
 if(elapsed>=.633&&!hit){f.impact(false,'heavy',undefined,undefined,new THREE.Vector3(0,0,-1),69);hit=true;}
 f.update(dt,state,true);other.update(dt,target,true);Fighter.settleContacts();
 if(elapsed>.65&&elapsed<.69){const skin=skinFloor(f);contacts++;expect(f.motionEvidence().clip).toBe('Magnolia Heel');expect(skin.RightHand,'knuckle above actual arena y=0').toBeLessThan(.085);expect(skin.RightHand-skin.sole,'native relative contact').toBeLessThan(.065);expect(skin.sole).toBeGreaterThan(-.025);}
 }
 expect(contacts).toBe(3);
 }finally{f.dispose();other.dispose();}
});
