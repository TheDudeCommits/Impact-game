// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Group,Mesh,Object3D,Vector3} from 'three';
import type {ShaderMaterial} from 'three';
import type {HandGeometries} from './ShadowHandGeometry';
export interface ShadowFinger{root:Group;joints:Group[];tip:Object3D;thumb:boolean;}
/** One mirrored builder, four fingers plus an opposable thumb, three real hierarchical joints each. */
export class ShadowHandRig{
  readonly root=new Group();
  readonly wrist=new Group();
  readonly fingers:ShadowFinger[]=[];
  private readonly parts:{mesh:Mesh;kind:keyof HandGeometries}[]=[];
  private readonly mirror=new Group();
  constructor(readonly side:-1|1,geometry:HandGeometries,material:ShaderMaterial){
    this.mirror.scale.x=side===1?-1:1;this.root.add(this.mirror);
    const add=(kind:keyof HandGeometries,parent:Group):Mesh=>{const m=new Mesh(geometry[kind],material);m.frustumCulled=false;this.parts.push({mesh:m,kind});parent.add(m);return m;};
    add('arm',this.mirror);this.wrist.position.y=7;this.mirror.add(this.wrist);add('palm',this.wrist);const wrist=add('joint',this.wrist);wrist.position.y=-.15;wrist.scale.set(.95,.8,.66);
    const origins=[[-1.28,3.17,0],[-.43,3.38,-.01],[.45,3.29,-.03],[1.21,2.98,-.04],[-1.34,1.18,.16]],lengths=[[1.35,.92,.68],[1.55,1.04,.74],[1.4,.98,.7],[1.08,.78,.6],[1.12,.83,.5]],radii=[.39,.43,.41,.33,.48];
    for(let f=0;f<5;f++){const root=new Group();root.position.set(...origins[f] as [number,number,number]);this.wrist.add(root);if(f===4){root.rotation.z=.86;root.rotation.y=-.42;}const joints:Group[]=[];let parent=root;
      for(let j=0;j<3;j++){const joint=new Group();if(j>0)joint.position.y=lengths[f][j-1];parent.add(joint);const m=add('segment',joint);const radius=radii[f]*(1-j*.18);m.scale.set(radius,lengths[f][j],radius);joints.push(joint);parent=joint;}
      const tip=new Object3D();tip.position.y=lengths[f][2];parent.add(tip);this.fingers.push({root,joints,tip,thumb:f===4});
      if(f<4){const knuckle=add('joint',root);knuckle.position.set(0,.11,-.05);knuckle.scale.set(radii[f]*1.13,.37,radii[f]*.9);}
    }
  }
  setDetail(geometry:HandGeometries):void{for(const part of this.parts)part.mesh.geometry=geometry[part.kind];}
  tipLocal(index:number,target:Vector3,castTarget:Vector3):Vector3{return this.fingers[index].tip.getWorldPosition(target).sub(castTarget);}
}
