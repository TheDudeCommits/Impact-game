// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,Vector3} from 'three';
import type {AbilityCastContext} from '../Ability';
import {VisualOwner,gridGeometry} from '../elemental/ElementalVisuals';
import {ElectricArcRenderer} from '../lightning/ElectricArcRenderer';
import {thunderMaterial,electricRibbonMaterial} from './ThunderMaterials';
import {ease,clamp01,hash} from '../elemental/AstralVisuals';
function spearGeometry(radial:number):BufferGeometry{
  const z=[-4,-3.7,-2,0,1.6,1.9,2.12,2.6,4],r=[.005,.14,.1,.12,.18,.3,.86,.52,.005],p:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<z.length;i++)for(let j=0;j<radial;j++){const a=j/radial*Math.PI*2,fold=j%2===0?1:.72;p.push(Math.cos(a)*r[i]*fold,Math.sin(a)*r[i]*fold,z[i]);uv.push((z[i]+4)/8,j/radial);}
  for(let i=0;i<z.length-1;i++)for(let j=0;j<radial;j++){const a=i*radial+j,b=i*radial+(j+1)%radial;idx.push(a,b,a+radial,b,b+radial,a+radial);}
  for(let j=1;j<radial-1;j++){idx.push(0,j+1,j);const o=(z.length-1)*radial;idx.push(o,o+j,o+j+1);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export class LightningSpear{
  readonly root=new Group();
  readonly shaft:Mesh;
  readonly silhouette:Mesh;
  readonly ribbons:Mesh[]=[];
  readonly ghosts:Mesh[]=[];
  private readonly ghostMaterial;
  readonly trail=new ElectricArcRenderer(1100);
  readonly handArcs=new ElectricArcRenderer(180);
  readonly material;
  readonly outerMaterial;
  readonly ribbonMaterial;
  readonly origin=new Vector3();
  readonly head=new Vector3();
  readonly direction=new Vector3();
  private readonly start=new Vector3();
  private readonly a=new Vector3();
  private readonly b=new Vector3();
  private readonly axis=new Vector3(0,0,1);
  private readonly destination=new Vector3();
  private readonly geometries:BufferGeometry[];
  private released=false;
  private scale=1;
  constructor(owner:VisualOwner){
    this.material=owner.material(thunderMaterial());this.outerMaterial=owner.material(thunderMaterial(true));this.ribbonMaterial=owner.material(electricRibbonMaterial());this.ghostMaterial=owner.material(thunderMaterial(true));this.geometries=[4,8,12].map(n=>owner.geometry(spearGeometry(n)));
    this.shaft=new Mesh(this.geometries[1],this.material);this.silhouette=new Mesh(this.geometries[1],this.outerMaterial);this.silhouette.scale.set(1.6,1.6,1.02);this.root.add(this.shaft,this.silhouette);owner.root.add(this.root);
    for(let i=0;i<3;i++){const m=new Mesh(this.geometries[1],this.ghostMaterial);this.ghosts.push(m);owner.root.add(m);}
    const strip=owner.geometry(gridGeometry(90,4));for(let i=0;i<3;i++){const m=new Mesh(strip,this.ribbonMaterial);m.rotation.z=i*Math.PI*2/3;m.frustumCulled=false;this.ribbons.push(m);this.root.add(m);}
    for(const renderer of [this.trail,this.handArcs]){owner.geometry(renderer.geometry);owner.material(renderer.material);owner.root.add(renderer.mesh);}
    // Fade older trail segments while keeping the moving white core and branching renderer.
    this.trail.material.uniforms.uTail={value:0};this.trail.material.fragmentShader=this.trail.material.fragmentShader.replace('uniform float uTime,uOpacity','uniform float uTail,uTime,uOpacity').replace('float endSoft=0.94+0.06*sin(vUv.x*3.14159);','float endSoft=(0.94+0.06*sin(vUv.x*3.14159))*(.2+.8*smoothstep(uTail,uTail+.28,vReveal));');
  }
  update(t:number,detail:number,branches:number,fade:number,context:AbilityCastContext,target:Vector3):void{
    const growth=ease((t-.35)/.95),flight=clamp01((t-1.5)/.55),progress=flight*flight*(2-flight);
    if(!this.released){context.player.visual.getRightHandWorldPosition(this.origin);this.direction.subVectors(target,this.origin).normalize();this.scale=Math.min(1,Math.max(.06,this.origin.distanceTo(target)/10));this.start.copy(this.origin).addScaledVector(this.direction,4*this.scale).sub(target);this.destination.copy(this.direction).multiplyScalar(-4*this.scale);if(t>=1.5)this.released=true;}
    this.root.position.copy(this.start).lerp(this.destination,progress);this.root.quaternion.setFromUnitVectors(this.axis,this.direction);this.root.rotateZ(flight*.65);this.root.scale.setScalar(Math.max(.001,this.scale*growth));this.root.visible=t>=.35&&t<2.32;this.shaft.geometry=this.geometries[detail-1];this.silhouette.geometry=this.geometries[detail-1];
    for(const mat of [this.material,this.outerMaterial,this.ribbonMaterial]){mat.uniforms.uTime.value=t;mat.uniforms.uGrowth.value=growth;mat.uniforms.uFade.value=fade*(1-ease((t-2.05)/.27));}this.material.uniforms.uEnergy.value=1+ease((t-1.2)/.3);
    this.ghostMaterial.uniforms.uTime.value=t;this.ghostMaterial.uniforms.uGrowth.value=1;this.ghostMaterial.uniforms.uFade.value=fade*(1-ease((t-2.05)/.55))*.45;
    this.ghosts.forEach((m,i)=>{m.visible=t>=1.5&&t<2.6&&progress>(i+1)*.06;m.geometry=this.geometries[detail-1];m.position.copy(this.start).lerp(this.destination,Math.max(0,progress-(i+1)*.065));m.quaternion.copy(this.root.quaternion);m.scale.setScalar(this.scale*(1-i*.1));});
    this.head.copy(this.root.position).addScaledVector(this.direction,4*this.scale*growth);
    const hp=this.handArcs.path;hp.clear(631+Math.floor(t*24));
    if(t<1.5){context.player.visual.getRightHandWorldPosition(this.a);this.a.sub(target);for(let i=0;i<(detail===1?3:7);i++){const angle=i*2.39996+t*3;this.b.copy(this.a);this.b.x+=Math.cos(angle)*.35;this.b.y+=.2+Math.sin(angle)*.3;this.b.z+=Math.sin(angle)*.35;hp.channel(this.a,this.b,7,.09,.16,i%2);}}
    this.handArcs.commit();this.handArcs.update(t,t<1.5?growth:0,1.1,1,detail);
    const path=this.trail.path;path.clear(791+Math.floor(t*27));
    if(t>=1.5&&t<2.9){this.a.copy(this.origin).sub(target);this.b.copy(this.head);path.channel(this.a,this.b,Math.max(12,detail*14),.26,.38+detail*.13,0);
      const trunk=path.count;
      for(let i=0;i<branches;i++){const node=Math.min(trunk-1,Math.floor((.1+hash(i+13)*.85)*(trunk-1)));if(node<0)continue;this.a.fromArray(path.data,node*10+3);const r=1+hash(i+19)*2.4,angle=i*2.39996+t*.4;this.b.copy(this.a);this.b.x+=Math.cos(angle)*r;this.b.y+=Math.sin(angle*1.7)*r*.65;this.b.z+=Math.sin(angle)*r;const rv=(node+1)/trunk;path.channel(this.a,this.b,detail===1?5:8,.12,.4,1,rv,rv+.02);}
    }
    this.trail.commit();this.trail.material.uniforms.uTail.value=Math.max(0,progress-.65);this.trail.update(t,t>=1.5?fade*(1-ease((t-2.05)/.85))*.9:0,1.1,1,detail);
  }
}
