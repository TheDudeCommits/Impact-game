// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {BufferGeometry,Float32BufferAttribute,InstancedBufferAttribute} from 'three';
/** Closed tapered diamonds intersect into a luminous cruciform with real depth in both axes. */
export function celestialSwordGeometry(capacity:number,secondary=true):BufferGeometry{
  const p:number[]=[],uv:number[]=[],part:number[]=[],idx:number[]=[];
  const diamond=(axis:'x'|'y'|'z',negative:number,positive:number,width:number,depth:number,cy:number,tag:number):void=>{
    const offset=p.length/3,points=[[0,positive,0],[-width,0,0],[0,0,depth],[width,0,0],[0,0,-depth],[0,negative,0]];
    for(const [x,y,z] of points){const a=axis==='x'?y:x,b=axis==='x'?x:axis==='z'?z:y,c=axis==='z'?y:z;p.push(a,b+cy,c);uv.push((y-negative)/(positive-negative),Math.abs(x)/Math.max(.001,width));part.push(tag);}
    for(const n of [0,1,2,0,2,3,0,3,4,0,4,1,5,2,1,5,3,2,5,4,3,5,1,4])idx.push(offset+n);
  };
  diamond('y',-2.4,3.8,.17,.13,0,0);
  diamond('x',-1.05,1.05,.16,.105,0,1);
  diamond('z',-.74,.74,.1,.11,0,1);
  diamond('y',-.42,.42,.28,.22,0,2);
  if(secondary){diamond('x',-.52,.52,.075,.055,1.65,3);diamond('z',-.34,.34,.055,.05,1.65,3);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('aPart',new Float32BufferAttribute(part,1));g.setIndex(idx);g.computeVertexNormals();
  g.setAttribute('aLife',new InstancedBufferAttribute(new Float32Array(capacity*4),4));g.setAttribute('aVariant',new InstancedBufferAttribute(new Float32Array(capacity),1));return g;
}
