// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { AstralChainstormConfig } from './AstralChainstormConfig';
/** Closed oval sweep. Long axis +Y; alternating links roll around that axis. */
export function createAstralChainLinkGeometry(c:Readonly<AstralChainstormConfig>,segments=32):BufferGeometry {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];const cross=8;
  const b=c.linkLength*.5-c.linkThickness,a=c.linkLength*.22;
  for(let i=0;i<=segments;i++) {
    const t=(i%segments)/segments*Math.PI*2,ct=Math.cos(t),st=Math.sin(t);
    const nx=b*ct,ny=a*st,len=Math.hypot(nx,ny);
    for(let j=0;j<=cross;j++) {
      const v=(j%cross)/cross*Math.PI*2;
      // An octagonal, subtly forged section keeps manufactured bevels visible.
      const wear=1+.018*Math.sin(t*7+v*3),r=c.linkThickness*wear;
      positions.push(a*ct+nx/len*r*Math.cos(v),b*st+ny/len*r*Math.cos(v),r*Math.sin(v));
      uv.push(i/segments,j/cross);
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<cross;j++) {
    const n=i*(cross+1)+j,m=n+cross+1;
    indices.push(n,m,n+1,m,m+1,n+1);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();flat.computeBoundingBox();flat.computeBoundingSphere();return flat;
}
/** Angular closed steel splinters, distinct from the oval primary link. */
export function createChainFragmentGeometry(variant:number):BufferGeometry {
  const p:number[]=[],v:Vector3[]=[];const sides=5;
  v.push(new Vector3(.08,.8+variant*.25,.02));
  for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;v.push(new Vector3(Math.cos(a)*(.26+i%2*.08),-.1,Math.sin(a)*.17));}
  v.push(new Vector3(-.1,-.65,.06));
  for(let i=0;i<sides;i++)for(const ids of [[0,(i+1)%sides+1,i+1],[6,i+1,(i+1)%sides+1]])for(const id of ids)p.push(v[id].x,v[id].y,v[id].z);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
