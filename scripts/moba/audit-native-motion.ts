import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MotionLibrary,BONE} from '../../src/render/horde/motion';
import {tripoClips} from '../../src/render/moba/tripoMotion';
import {RIFT_TROOP_MODELS} from '../../src/render/moba/troopAssets';
// Strip only materials/images in this CPU-only audit; rig, skin and animation
// bytes are the actual shipped GLB. No browser or headless canvas required.
export async function nativeRig(file:string){
 const bytes=readFileSync(file),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
 delete json.images;delete json.textures;delete json.materials;for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const source=Buffer.from(JSON.stringify(json)),size=Math.ceil(source.length/4)*4,body=bytes.subarray(20+length),out=Buffer.alloc(20+size+body.length,32);
 bytes.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(size,12);out.writeUInt32LE(0x4e4f534a,16);source.copy(out,20);body.copy(out,20+size);
 return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
export function palettePoint(motion:MotionLibrary,row:number,bone:number){
 const d=motion.texture.image.data as Float32Array,width=motion.texture.image.width,o=(row*width+bone*3)*4,p=motion.rest[bone];
 return new THREE.Vector3(d[o]*p.x+d[o+1]*p.y+d[o+2]*p.z+d[o+3],d[o+4]*p.x+d[o+5]*p.y+d[o+6]*p.z+d[o+7],d[o+8]*p.x+d[o+9]*p.y+d[o+10]*p.z+d[o+11]);
}
export async function audit(){
 const templates=['idle','walk','run','slash','roar','hit','die'].map(name=>new THREE.AnimationClip(name,1,[])),source={animations:templates} as MotionLibrary;
 const result=[];
 for(const url of new Set(Object.values(RIFT_TROOP_MODELS).filter(p=>p.startsWith('/assets/moba/')))){
  const gltf=await nativeRig('public'+url),motion=MotionLibrary.native(gltf.scene,tripoClips(gltf.scene,gltf.animations,source));
  const clips=[];for(const clip of motion.clips.values()){
   const min:number[]=[],max:number[]=[],travel:number[]=[];
   for(let f=0;f<clip.frames;f++){const row=clip.row+f,feet=[BONE.LeftFoot,BONE.RightFoot,BONE.LeftToeBase,BONE.RightToeBase].map(b=>palettePoint(motion,row,b));const hip=palettePoint(motion,row,BONE.Hips);min.push(Math.min(...feet.map(p=>p.y))/motion.height);max.push(Math.max(...feet.map(p=>p.y))/motion.height);travel.push(Math.hypot(hip.x-motion.rest[BONE.Hips].x,hip.z-motion.rest[BONE.Hips].z)/motion.height);}
   clips.push({name:clip.name,feetMin:Math.min(...min),feetMax:Math.max(...min),rootTravel:Math.max(...travel)});
  }result.push({url,height:motion.height,clips});motion.texture.dispose();
 }return result;
}
if(process.argv[1]?.endsWith('audit-native-motion.ts')){const rows=await audit();const out=process.env.QA_OUT??'output/playwright/native-motion';mkdirSync(out,{recursive:true});writeFileSync(out+'/motion.json',JSON.stringify(rows,null,2));for(const r of rows)console.log(r.url,r.clips.map(c=>`${c.name}: floor ${c.feetMin.toFixed(2)}..${c.feetMax.toFixed(2)}, drift ${c.rootTravel.toFixed(2)}`).join('; '));}
