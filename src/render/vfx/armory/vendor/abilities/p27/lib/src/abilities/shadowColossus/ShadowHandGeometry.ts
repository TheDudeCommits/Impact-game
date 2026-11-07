// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {BufferGeometry,Float32BufferAttribute,SphereGeometry} from 'three';
import type {VisualOwner} from '../elemental/ElementalVisuals';
export interface HandGeometries{palm:BufferGeometry;arm:BufferGeometry;segment:BufferGeometry;joint:BufferGeometry;}
/** Rounded elliptical/superelliptical lofts. Caps, tapered tips and knuckle bulges are part of the mesh. */
function loft(rows:number,radial:number,kind:'palm'|'arm'|'segment'):BufferGeometry{
  const p:number[]=[],uv:number[]=[],idx:number[]=[],regions:number[]=[];
  for(let i=0;i<=rows;i++){const t=i/rows;
    for(let j=0;j<radial;j++){const a=j/radial*Math.PI*2;let x:number,y:number,z:number;
      if(kind==='palm'){const width=.77+Math.sin(t*Math.PI*.7)*.94,depth=.48+Math.sin(t*Math.PI)*.26,rounded=(t>.9?1-(t-.9)*2.1:1);x=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.78)*width*rounded;y=t*3.65-.18;z=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.72)*depth*rounded;z+=Math.exp(-Math.pow((t-.34)*4.,2.))*Math.max(0.,-Math.cos(a))*.2;}
      else if(kind==='arm'){const width=1.72-t*.7+.07*Math.sin(t*12),ridge=1+.035*Math.cos(a*4)*Math.sin(t*Math.PI);x=Math.cos(a)*width*ridge+.24*Math.sin(t*Math.PI);y=t*7-.85*Math.pow(1-t,3);z=Math.sin(a)*width*.72*ridge+.12*Math.sin(t*5);}
      else{const rounded=Math.sin((.065+t*.87)*Math.PI),r=(.8+.25*Math.exp(-Math.pow((t-.15)*5.,2.)))*Math.pow(Math.max(.06,rounded),.32)*(1-t*.24);x=Math.cos(a)*r;y=t*1.12-.06;z=Math.sin(a)*r*.82;}
      p.push(x,y,z);uv.push(t,j/radial);regions.push(kind==='arm'?0:kind==='palm'?2:3);
    }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<radial;j++){const a=i*radial+j,b=i*radial+(j+1)%radial;idx.push(a,b,a+radial,b,b+radial,a+radial);}
  const lower=p.length/3,upper=lower+1;const firstY=p[1],lastY=p[rows*radial*3+1];p.push(0,firstY,0,kind==='arm'?0:kind==='palm'?0:0,lastY,kind==='arm'?.12*Math.sin(5):0);uv.push(0,.5,1,.5);regions.push(kind==='arm'?0:3,kind==='arm'?1:3);
  for(let j=0;j<radial;j++){idx.push((j+1)%radial,j,lower);const o=rows*radial;idx.push(o+j,o+(j+1)%radial,upper);}
  for(let i=0;i<idx.length;i+=3){const temp=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=temp;}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('aRegion',new Float32BufferAttribute(regions,1));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function handGeometries(owner:VisualOwner,detail:number):HandGeometries{
  const radial=[12,18,26][detail],rows=[12,20,28][detail],joint=owner.geometry(new SphereGeometry(1,radial,Math.round(radial*.65)));joint.setAttribute('aRegion',new Float32BufferAttribute(new Float32Array(joint.getAttribute('position').count).fill(4),1));
  return {palm:owner.geometry(loft(rows,radial,'palm')),arm:owner.geometry(loft(rows+4,radial,'arm')),segment:owner.geometry(loft(Math.max(10,rows-4),radial,'segment')),joint};
}
