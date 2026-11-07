import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import type { FighterId, PlayerState } from '../src/game/types';
import { Fighter } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
interface Garment {
  id:FighterId;
  /** The `<garment>` in Detail_CLOTH_<garment>_hem_<sector>_<link>. */
  garment:string;
  chains:number;
  links:number;
  /** Fewest vertices the chains carry. */
  vertices:number;
  /** Leg capsules the measure uses: thigh and shin radii, metres. */
  radii:[number,number];
  /** The movement the drape must clear the legs in (it may not be worse in the other); none for a garment the legs
   *  hardly reach. */
  clears?:'run'|'dash';
  /** The garment is the awakened form's (`formModel`). */
  form?:boolean;
}
const GARMENTS:Garment[]=[
  // An ankle-length coat, open in front and slit up the back.
  {id:'rook',garment:'rook',chains:8,links:4,vertices:3000,radii:[.09,.065],clears:'run'},
  // The armour's skirt, closed, belt to knee, its tassets over it. His run tips the hips 46 degrees forward and lifts the
  // knee over the front hem, which the drape will not raise level over it (no boards): there it only does better.
  {id:'akagane',garment:'akagane',chains:8,links:3,vertices:1200,radii:[.1,.09],clears:'dash'},
  // The sash of Magatsu's four-armed form, flaring out well clear of the hakama: it stretched between the thighs' helper
  // joints; the legs hardly reach it.
  {id:'magatsu',garment:'magatsu-heian',chains:8,links:2,vertices:1000,radii:[.15,.12],form:true},
];
const LEG=/UpLeg|Leg$|Foot|Toe|thigh_twist|leg_twist|^rfx_[LR]_(th|kne|ank)/;
const body=(g:Garment)=>g.form?FIGHTERS[g.id].formModel!:FIGHTERS[g.id].model;

describe('long garments hung off the pelvis (round 5b, RIG3)', () => {
  for(const g of GARMENTS){
    const chain=new RegExp(`^Detail_CLOTH_${g.garment}_hem_\\d+_\\d+$`);
    it.skipIf(!!ORIGINALS[g.id])(`${g.garment}: hangs on ${g.chains} hem chains off the hips, and no vertex on a chain keeps a share of a leg`, async () => {
      const rig=await loadRig(body(g));
      let roots=0,links=0,ends=0,chained=0,onLegs=0;
      rig.scene.traverse(object=>{
        const bone=object as THREE.Bone;
        if(bone.isBone&&chain.test(bone.name)){links++;if(/_0$/.test(bone.name)){roots++;expect(bone.parent?.name).toBe('Hips');}}
        if(bone.isBone&&new RegExp(`^HemEnd_${g.garment}_\\d+$`).test(bone.name))ends++;
        const mesh=object as THREE.SkinnedMesh;
        if(!mesh.isSkinnedMesh)return;
        const bones=mesh.skeleton.bones,index=mesh.geometry.getAttribute('skinIndex'),weight=mesh.geometry.getAttribute('skinWeight');
        for(let v=0;v<index.count;v++){
          let on=0,leg=0;
          for(let k=0;k<4;k++){
            const w=weight.getComponent(v,k),name=bones[index.getComponent(v,k)]?.name??'';
            if(w<=0)continue;
            if(chain.test(name))on+=w;else if(LEG.test(name)||name.startsWith('HemEnd'))leg+=w;
          }
          if(on>.01){chained++;if(leg>.01)onLegs++;}
        }
      });
      expect(roots).toBe(g.chains);
      expect(links).toBe(g.chains*g.links);
      expect(ends).toBe(g.chains);
      expect(chained).toBeGreaterThan(g.vertices);
      expect(onLegs).toBe(0);
    },120_000);

    if(g.clears)it.skipIf(!!ORIGINALS[g.id])(`${g.garment}: keeps the garment out of the legs in a ${g.clears}, which the spring alone does not`, async () => {
      const rig=await loadRig(body(g));
      // Links more than 2 cm inside a thigh (from a quarter of the way down: its top is in the pelvis) or a shin, over
      // 2.2 s, not counting the 12 cm under a chain's head - the band fitted round the hips, left to the belt.
      const run=(drape:boolean,action:'run'|'dash')=>{
        const fighter=new Fighter(base(g.id),rig);
        try {
          const solver=fighter['secondary'] as unknown as {nodes:{bone:THREE.Bone;tail:THREE.Vector3}[];drape?:{garment:string};capsules?:unknown};
          expect(solver.drape?.garment).toBe(g.garment);
          // The spring alone: no drape, and no leg capsules or floor either.
          if(!drape){solver.drape=undefined;solver.capsules=undefined;}
          const by=(name:string)=>fighter.model.getObjectByName(name)!;
          const legs=['Left','Right'].map(side=>[by(`${side}UpLeg`),by(`${side}Leg`),by(`${side}Foot`)]);
          const state:PlayerState=base(g.id),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),head=new THREE.Vector3();
          const p=new THREE.Vector3(),q=new THREE.Vector3(),line=new THREE.Line3(),root=new THREE.Vector3();
          const sprung=new Set(solver.nodes.map(node=>node.bone as THREE.Object3D));
          const tops=solver.nodes.map(node=>{let top:THREE.Object3D=node.bone;while(top.parent&&sprung.has(top.parent))top=top.parent;return top;});
          let x=0,deep=0,worst=0;
          for(let i=0;i<150;i++){
            x+=(action==='dash'?15:7.5)/60;fighter.update(1/60,{...state,action,x,actionTime:(i%30)/60});
            if(i<20)continue;
            for(const [n,node] of solver.nodes.entries()){
              node.bone.getWorldPosition(head);tops[n].getWorldPosition(root);
              let depth=0;
              for(const [hip,knee,ankle] of legs){
                hip.getWorldPosition(a);knee.getWorldPosition(b);ankle.getWorldPosition(c);a.lerp(b,.25);
                for(const [from,to,radius] of [[a,b,g.radii[0]],[b,c,g.radii[1]]] as [THREE.Vector3,THREE.Vector3,number][]){
                  line.set(from,to);
                  for(let k=1;k<=8;k++){p.copy(head).lerp(node.tail,k/8);if(p.distanceTo(root)<.12)continue;line.closestPointToPoint(p,true,q);depth=Math.max(depth,radius-p.distanceTo(q));}
                }
              }
              if(depth>.02)deep++;
              worst=Math.max(worst,depth);
            }
          }
          return {deep,worst};
        } finally { fighter.dispose(); }
      };
      for(const action of ['run','dash'] as const){
        const alone=run(false,action),draped=run(true,action);
        expect(draped.deep,action).toBeLessThanOrEqual(alone.deep);
        if(action!==g.clears)continue;
        expect(alone.deep,action).toBeGreaterThan(100);
        expect(draped.deep,action).toBeLessThan(alone.deep*.35);
        expect(draped.worst,action).toBeLessThan(Math.max(.06,alone.worst*.7));
      }
    },120_000);
  }
});

// Round 5b (RIG3): rigs that carry their own cloth chains under names SecondaryMotion's pattern does not know - keyed by
// their own clips (Sorrel's coat) or by none (Gorai's coat below its shoulders, Asahi's haori and hair) -
// had them sprung by no one: the garment rode the body as a board. Their profiles' `bones` spring them.
describe('a rig’s own cloth chains, sprung (round 5b, RIG3)', () => {
  const OWN:{id:FighterId;chains:RegExp;count:number}[]=[
    {id:'sorrel',chains:/^[CFLR]_Cort0\d_/,count:12},
    {id:'gorai',chains:/^[clr]_coat0\d_/,count:12},
    {id:'asahi',chains:/^Bone_(Skirt|Hair)\d/,count:53},
  ];
  for(const own of OWN)it.skipIf(!!ORIGINALS[own.id])(`${own.id}: springs its ${own.count} cloth links, still standing, trailing a dash, settling after it`, async () => {
    const rig=await loadRig(FIGHTERS[own.id].model);
    const state=base(own.id),fighter=new Fighter({...state},rig);
    try {
      const solver=fighter['secondary'] as unknown as {nodes:{bone:THREE.Bone}[]};
      expect(solver.nodes.filter(node=>own.chains.test(node.bone.name)).length).toBe(own.count);
      let idle=0;
      for(let i=0;i<120;i++){fighter.update(1/60,{...state});if(i>=60)idle=Math.max(idle,fighter.motionEvidence().springSwing);}
      let x=0,peak=0;
      for(let i=0;i<30;i++){x+=15/60;fighter.update(1/60,{...state,action:'dash',x,actionTime:i/60});peak=Math.max(peak,fighter.motionEvidence().springSwing);}
      const after:number[]=[];
      for(let i=0;i<90;i++){fighter.update(1/60,{...state,x});after.push(fighter.motionEvidence().springSwing);}
      expect(idle).toBeLessThan(6);
      expect(peak).toBeGreaterThan(idle+5);
      expect(Math.max(...after.slice(60))).toBeLessThan(peak*.6);
    } finally { fighter.dispose(); }
  },120_000);
});
