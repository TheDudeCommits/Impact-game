// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {BufferGeometry,DynamicDrawUsage,Float32BufferAttribute,InstancedBufferAttribute} from 'three';
/** A long bevelled blade with a small swept guard and narrow trailing pommel. */
export function swordRainGeometry(variant:number,capacity:number):BufferGeometry{
  const p:number[]=[],uv:number[]=[],piece:number[]=[],idx:number[]=[];
  const y=[-1.08,-.83,-.2,.05,.3,2.5,3.4],width=[.004,.055,.065,.145,.16,.08,.003],depth=[.003,.035,.04,.075,.065,.035,.003];
  for(let i=0;i<y.length;i++)for(let j=0;j<4;j++){const a=j*Math.PI*.5,x=Math.cos(a)*width[i]*(1+variant*.1),z=Math.sin(a)*depth[i];p.push(x,y[i],z);uv.push((y[i]+1.08)/4.48,j/4);piece.push(0);}
  for(let i=0;i<y.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;idx.push(a,b,a+4,b,b+4,a+4);}
  idx.push(0,2,1,0,3,2,24,25,26,24,26,27);
  const guard=(side:number):void=>{const o=p.length/3,tip=side*(.37+variant*.025),bend=.1+variant*.035;const points=[[0,.03,0],[tip,bend,0],[tip*.66,-.07,.055],[0,-.09,.055],[tip*.66,-.07,-.055],[0,-.09,-.055]];for(const [x,h,z] of points){p.push(x,h,z);uv.push(.25,Math.abs(x));piece.push(1);}for(const n of [0,1,2,0,2,3,0,4,1,0,5,4,1,4,2,2,4,5,2,5,3,0,3,5])idx.push(o+n);};guard(-1);guard(1);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('aPiece',new Float32BufferAttribute(piece,1));g.setIndex(idx);g.computeVertexNormals();g.setAttribute('aRain',new InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(DynamicDrawUsage));return g;
}
