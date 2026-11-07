// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {BufferGeometry,Float32BufferAttribute,InstancedBufferAttribute,DynamicDrawUsage} from 'three';
/** Closed, asymmetric six/eight-sided crystal with bevel shoulders and an offset pointed crown. */
export function crystalSpikeGeometry(variant:number,capacity:number,facets=6):BufferGeometry{
  const p:number[]=[],uv:number[]=[],indices:number[]=[];
  const levels=[0,.075,.43,.78,.88],radii=[.67,.91,1,.79,.55];
  for(let row=0;row<levels.length;row++)for(let j=0;j<facets;j++){
    const a=j/facets*Math.PI*2+(variant%2)*.13,y=levels[row],width=radii[row]*(1+.1*Math.sin(j*3+variant));
    const bendX=.1*variant*y*y,bendZ=Math.sin(variant+1)*.13*y*y;
    const chip=row===3&&j===(variant+2)%facets?.78:1;
    p.push(Math.cos(a)*width*chip+bendX,y+((row>0&&row<4)?Math.sin(j*2+variant)*.02:0),Math.sin(a)*width*(.72+variant*.055)*chip+bendZ);uv.push(j/facets,y);
  }
  const tip=p.length/3;p.push(.07+variant*.09,1.03+variant*.018,Math.sin(variant+1)*.15);uv.push(.5,1);
  const bottom=p.length/3;p.push(0,0,0);uv.push(.5,0);
  for(let row=0;row<levels.length-1;row++)for(let j=0;j<facets;j++){const a=row*facets+j,b=row*facets+(j+1)%facets;indices.push(a,b,a+facets,b,b+facets,a+facets);}
  for(let j=0;j<facets;j++){indices.push((levels.length-1)*facets+j,(levels.length-1)*facets+(j+1)%facets,tip);indices.push((j+1)%facets,j,bottom);}
  const indexed=new BufferGeometry();indexed.setAttribute('position',new Float32BufferAttribute(p,3));indexed.setAttribute('uv',new Float32BufferAttribute(uv,2));indexed.setIndex(indices);
  const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();
  geometry.setAttribute('aCrystal',new InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(DynamicDrawUsage));return geometry;
}
