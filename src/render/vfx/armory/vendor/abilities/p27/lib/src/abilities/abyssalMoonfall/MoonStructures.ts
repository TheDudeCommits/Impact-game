// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { DynamicDrawUsage, Group, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import { createLunarShard, createOrbitalSegment } from './MoonGeometry';
import { createMoonMaterial } from './MoonMaterial';
import { seed, smooth, saturate, type MoonfallConfig, type MoonQuality } from './AbyssalMoonfallConfig';

/** Three separately inclined segmented rings plus four instanced rock variants. */
export class MoonStructures {
  readonly root=new Group();readonly ringMaterial=createMoonMaterial('ring');readonly rockMaterial=createMoonMaterial('rock');
  readonly rings:InstancedMesh[]=[];readonly rocks:InstancedMesh[]=[];
  private readonly segment=createOrbitalSegment();private readonly dummy=new Object3D();private readonly axis=new Vector3(0,1,0);
  private readonly tilt=new Quaternion();private readonly p=new Vector3();
  constructor(){
    for(let i=0;i<3;i++){const ring=new InstancedMesh(this.segment,this.ringMaterial.material,36);ring.instanceMatrix.setUsage(DynamicDrawUsage);ring.frustumCulled=false;ring.name=`Lunar orbit ${i+1}`;this.rings.push(ring);this.root.add(ring);}
    for(let i=0;i<4;i++){const rock=new InstancedMesh(createLunarShard(i),this.rockMaterial.material,55);rock.instanceMatrix.setUsage(DynamicDrawUsage);rock.frustumCulled=false;this.rocks.push(rock);this.root.add(rock);}
  }
  update(t:number, center:Vector3, ground:Vector3,c:Readonly<MoonfallConfig>,q:MoonQuality,impactTime:number):void {
    const assembly=smooth((t-1)/2),fracture=smooth((t-5.5)/2),fall=saturate((t-7.5)/c.descentDuration),after=t-impactTime;
    const fade=after<0?1:1-smooth(after/c.aftermathDuration);
    this.ringMaterial.sync(c,t,.25+fracture*.75,q.tier,fade);this.rockMaterial.sync(c,t,fracture,q.tier,fade);
    for(let r=0;r<3;r++) {
      const mesh=this.rings[r],n=q.ringSegments;mesh.count=after>1.5?0:n;mesh.position.copy(center);
      mesh.rotation.set(.5+r*.65,.3*r,t*c.ringRotationSpeed*(r===1?-1:1)*(1-r*.22));
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2,radius=c.moonRadius*(1.3+r*.18)*(1+(1-assembly)*.6+fracture*.18);
        const h=seed(i+r*31),scatter=fracture*Math.max(0,fall)*18;
        this.dummy.position.set(Math.cos(a)*radius,Math.sin(a*3+r)*.8-scatter*h,Math.sin(a)*radius);
        this.dummy.rotation.set(0,-a+Math.PI*.5,fracture*h*fall*2);this.dummy.scale.set(Math.PI*radius/n*.68,1.3,1.5);
        const ringAssembly=t<1?.12*smooth(t/.8):Math.max(.12,assembly);
        this.dummy.scale.multiplyScalar(Math.max(.001,ringAssembly*(1-smooth(Math.max(0,after)/1.5))));this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);
      }mesh.instanceMatrix.needsUpdate=true;
    }
    this.rocks.forEach(m=>m.count=0);
    const count=after<0?q.satellites:q.debris;
    for(let i=0;i<count;i++){
      const variant=i%4,mesh=this.rocks[variant],h=seed(i+21),a=i*2.39996;
      const size=i<8?3+h*4:.6+h*2.2;
      if(after<0){
        const radius=c.moonRadius*(1.2+h*.42),orbit=a+t*(.13+h*.14)*(1+fracture*1.2);
        this.p.set(Math.cos(orbit)*radius,Math.sin(orbit*.8+i)*radius*.38,Math.sin(orbit)*radius);
        this.tilt.setFromAxisAngle(this.axis,i*.67);this.p.applyQuaternion(this.tilt).add(center);
        if(fall>0)this.p.y-=fall*fall*(15+h*50);
      }else{
        const drag=(1-Math.exp(-after*.65))/.65,speed=12+h*24;
        this.p.set(ground.x+Math.cos(a)*speed*drag,ground.y+1+(8+h*23)*after-9.8*after*after,ground.z+Math.sin(a)*speed*drag);
      }
      this.dummy.position.copy(this.p);this.dummy.rotation.set(i*.2+t*(.13+h),i+t*.23,a+t*.17);
      this.dummy.scale.set(size,size,size).multiplyScalar(Math.max(.001,assembly*fade));
      if(after>0&&this.p.y<ground.y-.5)this.dummy.scale.setScalar(.001);
      this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
    }
    this.rocks.forEach(m=>m.instanceMatrix.needsUpdate=true);this.root.visible=t>.15&&fade>0;
  }
  get instanceCount():number{return this.rings.reduce((s,m)=>s+m.count,0)+this.rocks.reduce((s,m)=>s+m.count,0);}
  dispose():void{this.segment.dispose();this.ringMaterial.material.dispose();this.rockMaterial.material.dispose();this.rocks.forEach(m=>{m.geometry.dispose();m.dispose();});this.rings.forEach(m=>m.dispose());this.root.clear();}
}
