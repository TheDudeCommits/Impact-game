// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';
import { seed, type MoonfallConfig } from './AbyssalMoonfallConfig';

const craters=Array.from({length:19},(_,i)=>({direction:new Vector3(Math.cos(i*2.39996)*Math.sqrt(1-(1-2*(i+.5)/19)**2),1-2*(i+.5)/19,Math.sin(i*2.39996)*Math.sqrt(1-(1-2*(i+.5)/19)**2)),radius:.13+seed(i+17)*.2}));
/** Macro features are deterministic and identical across LODs; texture noise never moves the rock. */
export function moonSurfaceRadius(n:Vector3,c:Readonly<MoonfallConfig>):number {
  let r=1+c.displacementScale*(Math.sin(n.x*9+n.z*4)*Math.cos(n.y*7)+Math.sin(n.z*21+n.y*13)*.27);
  for(const crater of craters){const d=Math.acos(Math.max(-1,Math.min(1,n.dot(crater.direction))))/crater.radius;
    if(d<1.45)r+=-c.craterDepth*Math.exp(-d*d*3.7)+c.craterDepth*.43*Math.exp(-(((d-.95)/.17)**2));}
  const fault=Math.min(Math.abs(n.x+.22*n.z),Math.abs(n.y*.7-n.z*.4-.13));
  r-=.025*Math.exp(-fault*fault/.0008); return Math.max(.7,r);
}
/** Twenty closed shell volumes. GPU assembly/breakup moves these actual matching pieces. */
export function createAbyssalMoonGeometry(c:Readonly<MoonfallConfig>, subdivisions:number):BufferGeometry {
  const base=new IcosahedronGeometry(1,0),bp=base.getAttribute('position');
  const positions:number[]=[],plates:number[]=[],identities:number[]=[],surfaces:number[]=[];
  const a=new Vector3(),b=new Vector3(),d=new Vector3(),direction=new Vector3(),normal=new Vector3();
  for(let face=0;face<20;face++) {
    a.fromBufferAttribute(bp,face*3);b.fromBufferAttribute(bp,face*3+1);d.fromBufferAttribute(bp,face*3+2);direction.copy(a).add(b).add(d).normalize();
    const grid:Vector3[][]=[];
    for(let i=0;i<=subdivisions;i++){grid[i]=[];for(let j=0;j<=subdivisions-i;j++){
      const n=a.clone().multiplyScalar(1-(i+j)/subdivisions).addScaledVector(b,i/subdivisions).addScaledVector(d,j/subdivisions).normalize();
      grid[i][j]=n.multiplyScalar(moonSurfaceRadius(n,c));}}
    const emit=(x:Vector3,y:Vector3,z:Vector3,surface:number)=>{
      for(const v of [x,y,z]){positions.push(v.x,v.y,v.z);plates.push(direction.x,direction.y,direction.z);identities.push(face/20);surfaces.push(surface);}
    };
    for(let i=0;i<subdivisions;i++)for(let j=0;j<subdivisions-i;j++){
      const x=grid[i][j],y=grid[i+1][j],z=grid[i][j+1];
      normal.subVectors(y,x).cross(z.clone().sub(x));
      if(normal.dot(x)<0)emit(x,z,y,1);else emit(x,y,z,1);
      if(j<subdivisions-i-1){const w=grid[i+1][j+1];normal.subVectors(w,y).cross(z.clone().sub(y));if(normal.dot(y)<0)emit(y,z,w,1);else emit(y,w,z,1);}
    }
    const center=direction.clone().multiplyScalar(.36);
    const boundaries=[Array.from({length:subdivisions+1},(_,i)=>grid[i][0]),Array.from({length:subdivisions+1},(_,j)=>grid[subdivisions-j][j]),Array.from({length:subdivisions+1},(_,j)=>grid[0][subdivisions-j])];
    // Every outer edge closes against an inset tip, exposing solid fractured interiors on separation.
    for(const edge of boundaries)for(let i=0;i<subdivisions;i++)emit(edge[i+1],edge[i],center,0);
  }
  base.dispose();const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('aPlate',new Float32BufferAttribute(plates,3));g.setAttribute('aIdentity',new Float32BufferAttribute(identities,1));g.setAttribute('aSurface',new Float32BufferAttribute(surfaces,1));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
/** Closed angular volumetric slabs, not particle spheres; hard-cut faces reveal their thickness. */
export function createLunarShard(variant:number):BufferGeometry {
  const g=new IcosahedronGeometry(1,0),p=g.getAttribute('position'),cache=new Map<string,Vector3>();
  for(let i=0;i<p.count;i++){
    const n=new Vector3().fromBufferAttribute(p,i),key=n.toArray().map(v=>v.toFixed(5)).join(',');let v=cache.get(key);
    if(!v){const h=seed(n.x*41+n.y*73+n.z*19+variant*8);v=n.multiplyScalar(.65+h*.5);v.x*=variant%2===0?1.6:.8;v.y*=variant===1?.32:variant===2?.62:1;v.z*=variant===3?.4:1;cache.set(key,v);}p.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
/** Three-dimensional beveled trapezoidal voussoir; rings are separated stone segments. */
export function createOrbitalSegment():BufferGeometry {
  const pos:number[]=[],uv:number[]=[];
  const corners=[[-.92,-.28,-.58],[.92,-.28,-.58],[1,-.28,.58],[-1,-.28,.58],[-.78,.28,-.43],[.78,.28,-.43],[.85,.28,.43],[-.85,.28,.43]];
  for(const face of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){
    for(const j of [0,2,1,0,3,2]){pos.push(...corners[face[j]]);uv.push(j===1||j===2?1:0,j>1?1:0);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
