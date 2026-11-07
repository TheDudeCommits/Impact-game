// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Mesh,SphereGeometry,Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,SurfacePulse} from '../elemental/ElementalVisuals';
import {ElectricArcRenderer} from '../lightning/ElectricArcRenderer';
import {AstralParticles,ease,hash} from '../elemental/AstralVisuals';
import {thunderMaterial} from './ThunderMaterials';
export class ElectricCage{
  readonly arcs=new ElectricArcRenderer(1500);
  readonly surface=new ElectricArcRenderer(900);
  readonly sparks:AstralParticles;
  readonly pulse:SurfacePulse;
  readonly flash:Mesh;
  readonly nodes:Mesh[]=[];
  private readonly material;
  private readonly a=new Vector3();
  private readonly b=new Vector3();
  private readonly c=new Vector3();
  constructor(owner:VisualOwner){
    for(const renderer of [this.arcs,this.surface]){owner.geometry(renderer.geometry);owner.material(renderer.material);owner.root.add(renderer.mesh);}
    this.sparks=new AstralParticles(owner,500,'#b5f2ff','electric');this.pulse=new SurfacePulse(owner,true);this.material=owner.material(thunderMaterial());this.material.uniforms.uGrowth.value=1;
    const g=owner.geometry(new SphereGeometry(1,12,8));this.flash=new Mesh(g,this.material);owner.root.add(this.flash);for(let i=0;i<16;i++){const m=new Mesh(g,this.material);this.nodes.push(m);owner.root.add(m);}
  }
  update(t:number,cage:number,branches:number,sparks:number,detail:number,fade:number,context:AbilityCastContext):void{
    const impact=t-2.05,overload=t-4.15,grow=ease((t-2.15)/.7),compress=ease((t-3.8)/.35),residual=1-ease((t-4.5)/1.7);
    const path=this.arcs.path;path.clear(401+Math.floor(t*22));
    if(t>=2.05&&t<5.3){const radius=(5+Math.sin(t*3)*.25)*(1-compress*.82);for(let i=0;i<cage;i++){const angle=i*Math.PI*2/cage,theta=angle+.4+hash(i+Math.floor(t*8))*.8,height=3.8+hash(i+8)*3;
        this.a.set(Math.cos(angle)*radius,.1,Math.sin(angle)*radius);this.b.set(Math.cos(theta)*radius*.35,height*grow*(1-compress*.6),Math.sin(theta)*radius*.35);this.c.set(Math.cos(angle+1.3)*radius,.15,Math.sin(angle+1.3)*radius);
        path.channel(this.a,this.b,12,.21,.65,0);path.channel(this.b,this.c,12,.19,.75,1);const node=this.nodes[i];node.position.copy(this.b);node.scale.setScalar(.045+(compress*.06));
        if(i%2===0){this.c.set(-this.b.z,this.b.y*.7,this.b.x);path.channel(this.b,this.c,8,.09,.55,2);}}
      if(impact<.5){this.a.set(0,.1,0);this.b.set(0,7*(1-impact/.6),0);path.channel(this.a,this.b,18,.45,.45,0);}
    }
    this.arcs.commit();this.arcs.update(t,grow*fade*(1-ease((t-4.15)/1.1)),1.1,1+compress*.6,detail);
    this.nodes.forEach((m,i)=>m.visible=i<cage&&t>=2.2&&t<4.3);
    const sp=this.surface.path;sp.clear(877+Math.floor(t*17));
    if(t>=2.05){const power=overload>=0?1:grow,reach=4+(overload>=0?Math.min(15,overload*15):Math.min(5,impact*2));for(let i=0;i<branches;i++){const a=i*2.39996+Math.floor(t*10)*.04,r=reach*(.55+hash(i+7)*.45);this.a.set(0,.12,0);this.b.set(Math.cos(a)*r,.12,Math.sin(a)*r);const offset=sp.count;sp.channel(this.a,this.b,detail===1?9:15,.2*power,.65,0);for(let k=offset;k<sp.count;k++){sp.data[k*10+1]=.1+hash(k)*.06;sp.data[k*10+4]=.1+hash(k+1)*.06;}this.a.copy(this.b).multiplyScalar(.55);this.a.y=.12;this.c.set(this.a.x+Math.cos(a+1)*r*.35,.12,this.a.z+Math.sin(a+1)*r*.35);sp.channel(this.a,this.c,6,.085,.3,1);}}
    this.surface.commit();this.surface.update(t,t>=2.05?fade*residual*.8:0,1.1,1,detail);
    this.sparks.update(t,sparks,4.15,3,ease((t-3.8)/.35),fade*ease((t-2.05)/.25),context,2.05);
    const flashAge=overload>=0?overload:impact;this.flash.visible=flashAge>=0&&flashAge<.45;this.flash.position.y=.8;const size=.5+Math.max(0,flashAge)*13;this.flash.scale.set(size,size*.5,size);this.material.uniforms.uTime.value=t;this.material.uniforms.uFade.value=flashAge<.45?Math.max(0,1-flashAge/.45)*fade:.5*fade;this.material.uniforms.uEnergy.value=1.5;
    this.pulse.update(Math.max(0,flashAge),flashAge>=0?(1-ease(flashAge/2))*fade:0,3+Math.max(0,flashAge)*16);
  }
}
