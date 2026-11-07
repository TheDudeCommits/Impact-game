// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {Group,Mesh,SphereGeometry} from 'three';
import type {VisualOwner} from '../elemental/ElementalVisuals';
import {gridGeometry} from '../elemental/ElementalVisuals';
import {brokenRingGeometry,flareMaterial,ease} from '../elemental/AstralVisuals';
import {solarMaterial} from './SolarMaterials';
export class SolarCore{
  readonly root=new Group();
  readonly core:Mesh;
  readonly surface:Mesh;
  readonly corona:Mesh;
  readonly rings:Mesh[]=[];
  readonly flares:Mesh[]=[];
  private readonly white;
  private readonly surfaceMaterial;
  private readonly coronaMaterial;
  private readonly ringMaterial;
  private readonly flareMaterial;
  private readonly geometries:SphereGeometry[];
  constructor(owner:VisualOwner){
    this.white=owner.material(solarMaterial(0));this.surfaceMaterial=owner.material(solarMaterial(1));this.coronaMaterial=owner.material(solarMaterial(2));this.ringMaterial=owner.material(solarMaterial(3));this.flareMaterial=owner.material(flareMaterial('#f7e8ab'));
    this.geometries=[24,40,64].map(n=>owner.geometry(new SphereGeometry(1,n,Math.round(n*.65))));this.core=new Mesh(this.geometries[1],this.white);this.core.scale.setScalar(2.6);this.surface=new Mesh(this.geometries[1],this.surfaceMaterial);this.surface.scale.setScalar(3.7);this.corona=new Mesh(this.geometries[1],this.coronaMaterial);this.corona.scale.setScalar(4.4);this.root.add(this.core,this.surface,this.corona);owner.root.add(this.root);
    const ring=owner.geometry(brokenRingGeometry(5,96));for(let i=0;i<5;i++){const m=new Mesh(ring,this.ringMaterial);m.scale.setScalar(1+i*.07);this.rings.push(m);this.root.add(m);}
    const strip=owner.geometry(gridGeometry(72,6));for(let i=0;i<9;i++){const m=new Mesh(strip,this.flareMaterial);const a=i*2.39996;m.position.set(Math.cos(a)*2.6,Math.sin(i*1.7)*1.9,Math.sin(a)*2.6);m.rotation.set(i*.49,a,i*.3);m.scale.set(1+i%3*.15,1+i%2*.25,1);m.frustumCulled=false;this.flares.push(m);this.root.add(m);}
  }
  update(t:number,rings:number,flares:number,detail:number,fade:number):void{
    const build=ease((t-.3)/2.4),compression=ease((t-3.6)/.9),energy=ease((t-2)/2.3);this.root.position.y=2+build*10;this.root.scale.setScalar(Math.max(.006,(.035+build*.965)*(1-compression*.995)));this.root.visible=t>=.3&&t<4.65;
    for(const m of [this.white,this.surfaceMaterial,this.coronaMaterial,this.ringMaterial]){m.uniforms.uTime.value=t;m.uniforms.uFade.value=fade;m.uniforms.uEnergy.value=energy+compression;m.uniforms.uDetail.value=detail;}
    this.core.geometry=this.surface.geometry=this.corona.geometry=this.geometries[detail-1];this.surface.rotation.set(t*.06,t*.12,0);this.corona.rotation.set(t*.08,-t*.06,t*.035);
    this.rings.forEach((m,i)=>{m.visible=i<rings&&t>=1.5;m.rotation.set(.3+i*.65+t*.08,i*.7+t*(.12+i*.03),i*.37+t*.08);});
    this.flares.forEach((m,i)=>{m.visible=i<flares&&t>=1.2;m.rotation.y=i*2.39996+t*(.1+energy*.2);});this.flareMaterial.uniforms.uTime.value=t;this.flareMaterial.uniforms.uFade.value=build*fade*(.55+energy*.45);this.flareMaterial.uniforms.uLength.value=5+energy*2;this.flareMaterial.uniforms.uBend.value=2+energy*1.8;
  }
}
