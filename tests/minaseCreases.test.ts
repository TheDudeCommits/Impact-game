import {describe,it,expect} from 'vitest';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {preserveMinasePaintedFolds} from '../src/render/look/minaseCreases';
const body=()=>{const g=new BufferGeometry();g.setAttribute('lookHead',new Float32BufferAttribute([.8,1,1,0,1,.6],3));g.setAttribute('normal',new Float32BufferAttribute([0,0,1,1,0,0],3));return g;};
describe('Minase source-painted garment folds',()=>{
 it('clears only inferred ink while preserving face weights, cel colour and normals',()=>{const g=body();preserveMinasePaintedFolds('minase','body_minase',g);expect(Array.from(g.getAttribute('lookHead').array)).toEqual([expect.closeTo(.8),1,0,0,1,0]);expect(Array.from(g.getAttribute('normal').array)).toEqual([0,0,1,1,0,0]);});
 it.each([['minase','minase_relay_knife'],['minase','minase_sage_eyes'],['konta','body_minase'],['akaito','body_akaito']])('leaves %s/%s intact',(fighter,mesh)=>{const g=body(),before=Array.from(g.getAttribute('lookHead').array);preserveMinasePaintedFolds(fighter,mesh,g);expect(Array.from(g.getAttribute('lookHead').array)).toEqual(before);});
 it('accepts geometry with no optional crease channel',()=>{const g=new BufferGeometry();expect(()=>preserveMinasePaintedFolds('minase','body_minase',g)).not.toThrow();g.setAttribute('lookHead',new Float32BufferAttribute([.4],1));preserveMinasePaintedFolds('minase','body_minase',g);expect(g.getAttribute('lookHead').getX(0)).toBeCloseTo(.4);});
});
