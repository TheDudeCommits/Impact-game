import type * as THREE from 'three';

export function materialTextures(root:THREE.Object3D){
  const found=new Set<THREE.Texture>();
  // A texture with no image yet (a placeholder whose image is still loading: Last Stand's SiegeRoles panels, PR #109)
  // is left to the frame that has it - three would only warn "no image data found" and upload nothing.
  const take=(value:unknown)=>{const t=value as THREE.Texture|null;if(t?.isTexture&&!t.isRenderTargetTexture&&!(t as THREE.VideoTexture).isVideoTexture&&t.version>0&&t.image!=null)found.add(t);};
  root.traverse(object=>{
    const material=(object as THREE.Mesh).material;if(!material)return;
    for(const each of Array.isArray(material)?material:[material]){
      for(const value of Object.values(each))take(value);
      const uniforms=(each as THREE.ShaderMaterial).uniforms;
      if(uniforms)for(const uniform of Object.values(uniforms))take(uniform?.value);
    }
  });
  return found;
}

/** What a load-time warm draw shows (GameRenderer.warmDraw): every shadow caster under `roots`, with every hidden object
 *  it hangs from up to `scene` - all of them, not only an unbroken run of hidden ones from the mesh up: an effect between
 *  casts hides its group and leaves its meshes as they were, and a caster left visible under a hidden group was never
 *  shown (its depth program then linked on the effect's first cast). Each is drawn wherever it lies (not culled for the
 *  one frame: a caster with no instance yet has no bounds, and a place's caster far outside the sun's box round the fight
 *  is drawn into it only when the fight comes to it). Under the `whole` roots (the room's bodies, the place) every mesh
 *  is drawn uncut, so their buffers are sent too. `casters` is how many casters there are; `skeletons` are the skinned
 *  meshes' under the roots that have no bone texture yet, casters or not. `restore` puts back what was changed. */
export function showCasters(roots:readonly THREE.Object3D[],scene:THREE.Object3D,whole:readonly THREE.Object3D[]=[]){
  const shown:THREE.Object3D[]=[],unculled:THREE.Object3D[]=[],skeletons=new Set<THREE.Skeleton>();let casters=0;
  for(const root of [...roots,...whole])root.traverse(o=>{
    const skeleton=(o as THREE.SkinnedMesh).isSkinnedMesh?(o as THREE.SkinnedMesh).skeleton:undefined;
    if(skeleton&&!skeleton.boneTexture)skeletons.add(skeleton);
    if(!(o as THREE.Mesh).isMesh||!o.castShadow)return;
    casters++;
    for(let p:THREE.Object3D|null=o;p&&p!==scene;p=p.parent)if(!p.visible){p.visible=true;shown.push(p);}
    if(o.frustumCulled){o.frustumCulled=false;unculled.push(o);}
  });
  // Under a `whole` root every mesh is drawn, caster or not, wherever the lens is (what is hidden stays hidden, unless a
  // caster under it was shown above): its buffers go to the GPU in this frame, not the one that first turns to it.
  for(const root of whole)root.traverse(o=>{if((o as THREE.Mesh).isMesh&&o.frustumCulled){o.frustumCulled=false;unculled.push(o);}});
  return{shown,unculled,casters,skeletons:[...skeletons],restore(){for(const o of shown)o.visible=false;for(const o of unculled)o.frustumCulled=true;}};
}

const nextFrame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
/** A task's turn: what is queued behind this one (the room's snapshots, a frame) goes first. */
export const nextTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
/** During chapter travel, yield between upload batches instead of sending a
 * whole stage in one frame. A single driver upload cannot be preempted, so
 * this bounds batching work, not the duration of an individual upload.
 * Already-resident textures are cheap and share a batch.
 * `budget` and `pause`: a room's load (behind the loading screen) sends larger batches and waits a task, not a frame, between
 * them (GameRenderer.uploadTexturesInSlices). */
export async function warmTextures(textures:Iterable<THREE.Texture>,upload:(texture:THREE.Texture)=>void,current:()=>boolean,budget=2,pause=nextFrame){
  let until=performance.now()+budget;
  for(const texture of textures){
    if(!current())return;
    if(performance.now()>=until){
      await pause();
      if(!current())return;
      until=performance.now()+budget;
    }
    upload(texture);
  }
}
