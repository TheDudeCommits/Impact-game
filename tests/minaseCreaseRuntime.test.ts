import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {Fighter} from '../src/render/Fighter';
import {FIGHTERS} from '../src/config';
import {headWeights} from '../src/render/look/toonShading';
import {base,loadRig} from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';

describe.skipIf(!!ORIGINALS.minase)('Minase painted folds in the actual Fighter material path',()=>{
 it.each([false,true])('suppresses the measured false crease field without changing skin or silhouette; Sage=%s',async sage=>{
  const rig=await loadRig(sage?FIGHTERS.minase.formModel!:FIGHTERS.minase.model),body=rig.scene.getObjectByName('body_minase')as THREE.SkinnedMesh;
  const expected=headWeights(body.geometry,body.skeleton,rig.scene.getObjectByName('Head')!),positions=Array.from(body.geometry.attributes.position.array),normals=Array.from(body.geometry.attributes.normal.array);
  const originalCreases=Array.from({length:expected.count},(_,i)=>expected.getZ(i)).filter(x=>x>0);expect(originalCreases.length).toBeGreaterThan(500);
  const f=new Fighter(base('minase'),rig);
  try{
   const drawn=f.model.getObjectByName('body_minase')as THREE.SkinnedMesh,look=drawn.geometry.getAttribute('lookHead');
   expect(look.count).toBe(expected.count);
   for(let i=0;i<look.count;i++){expect(look.getX(i)).toBe(expected.getX(i));expect(look.getY(i)).toBe(expected.getY(i));expect(look.getZ(i)).toBe(0);}
   expect(Array.from(drawn.geometry.attributes.position.array)).toEqual(positions);expect(Array.from(drawn.geometry.attributes.normal.array)).toEqual(normals);
   const shell=drawn.getObjectByName('body_minase-ink')!;expect(shell).toBeDefined();expect(shell.visible).toBe(true);expect(drawn.visible).toBe(true);
   // Markings and kunai keep their independent source surfaces/material paths.
   for(const o of f.model.children)if(o.name!=='body_minase'&&o instanceof THREE.Mesh)expect(o.visible).toBe(true);
  }finally{f.dispose();}
 });
});
