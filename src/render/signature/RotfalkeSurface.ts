import * as THREE from 'three';
import type {Fighter} from '../Fighter';

/** Exterior native sole/palm triangles in the accepted war-frame exports. The
 * white-eye material split removes88 eye vertices from Sync's body primitive;
 * its separately recorded indices address the identical native surfaces. */
export const ROTFALKE_SURFACE_TRIANGLES=Object.freeze({
 node:'body_rotfalke_eva02',
 base:{vertices:16333,rightHeel:[9069,9068,9078] as const,leftPalm:[15051,15055,15969] as const},
 sync:{vertices:16245,rightHeel:[8981,8980,8990] as const,leftPalm:[14963,14967,15881] as const},
});
type SurfaceSpec=typeof ROTFALKE_SURFACE_TRIANGLES.base|typeof ROTFALKE_SURFACE_TRIANGLES.sync;
const meshes=new WeakMap<object,{mesh:THREE.SkinnedMesh;spec:SurfaceSpec}>();
const sample=new THREE.Vector3();
export function rotfalkeSurfacePoint(f:Pick<Fighter,'shownBody'>,surface:'rightHeel'|'leftPalm',out:THREE.Vector3):boolean{
 const body=f.shownBody;let entry=meshes.get(body);
 if(!entry){
  const node=body.model?.getObjectByName(ROTFALKE_SURFACE_TRIANGLES.node);
  node?.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh))return;const count=o.geometry.attributes.position.count;
   const spec=count===ROTFALKE_SURFACE_TRIANGLES.base.vertices?ROTFALKE_SURFACE_TRIANGLES.base:count===ROTFALKE_SURFACE_TRIANGLES.sync.vertices?ROTFALKE_SURFACE_TRIANGLES.sync:undefined;
   if(spec)entry={mesh:o,spec};
  });
  if(!entry)return false;meshes.set(body,entry);
 }
 out.set(0,0,0);
 for(const index of entry.spec[surface]){entry.mesh.getVertexPosition(index,sample);out.add(sample);}
 out.multiplyScalar(1/3).applyMatrix4(entry.mesh.matrixWorld);return true;
}
