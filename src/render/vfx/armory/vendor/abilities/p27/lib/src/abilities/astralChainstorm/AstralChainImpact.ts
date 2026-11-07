// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Vector3, DoubleSide } from 'three';
/** Surface fracture strokes and separated pressure crests; never a filled explosion disk. */
export class AstralChainImpact {
  readonly material=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,
    uniforms:{uAge:{value:-1},uColor:{value:new Color('#91f2ff')},uGain:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uAge,uGain;uniform vec3 uColor;
    void main(){vec2 p=(vUv-.5)*18.;float r=length(p),a=atan(p.y,p.x),t=max(0.,uAge);
      float ring=exp(-pow((r-t*13.)/.14,2.))*exp(-t*3.);
      float echo=exp(-pow((r-t*7.)/.24,2.))*exp(-t*2.3)*.4;
      float angular=abs(sin(a*7.+floor(r*1.6)*.8));float crack=(1.-smoothstep(.018,.06,angular))*exp(-r*.65)*exp(-t*5.);
      float flash=exp(-r*3.)*exp(-t*17.)*.5;float fade=1.-smoothstep(1.1,1.45,t);
      float alpha=(ring+echo+crack*.6+flash)*fade*uGain;if(alpha<.004)discard;
      gl_FragColor=vec4(uColor,alpha*.65);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  readonly mesh=new Mesh(new PlaneGeometry(18,18),this.material);
  private readonly flareMaterial=new MeshBasicMaterial({color:'#c8f9ff',transparent:true,depthWrite:false,blending:AdditiveBlending,side:DoubleSide});
  readonly fractures:Mesh;
  constructor(){
    this.mesh.rotation.x=-Math.PI/2;this.mesh.visible=false;this.mesh.renderOrder=3;
    const vertices:number[]=[];
    for(let branch=0;branch<7;branch++){
      const angle=branch/7*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
      for(let j=0;j<4;j++){
        const r=j*.42,y=j*.68+(j%2)*.25,r2=(j+1)*.42,y2=(j+1)*.68+((j+1)%2)*.25,w=.085*(1-j/5);
        const a=[dx*r-dz*w,y,dz*r+dx*w],b=[dx*r+dz*w,y,dz*r-dx*w],c=[dx*r2-dz*w*.6,y2,dz*r2+dx*w*.6],d=[dx*r2+dz*w*.6,y2,dz*r2-dx*w*.6];
        vertices.push(...a,...b,...c,...b,...d,...c);
      }
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeBoundingSphere();
    this.fractures=new Mesh(g,this.flareMaterial);this.fractures.visible=false;this.fractures.renderOrder=4;
  }
  update(age:number,p:Vector3,gain:number):void{
    this.mesh.visible=age>=0&&age<1.5;this.mesh.position.copy(p);this.mesh.position.y+=.09;this.material.uniforms.uAge.value=age;this.material.uniforms.uGain.value=gain;
    this.fractures.visible=age>=0&&age<.6;this.fractures.position.copy(p);this.fractures.position.y+=.04;
    this.fractures.scale.setScalar(Math.min(1,Math.max(.05,age*12)));this.flareMaterial.opacity=Math.exp(-Math.max(0,age)*7)*gain;
  }
  dispose():void{this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();this.fractures.removeFromParent();this.fractures.geometry.dispose();this.flareMaterial.dispose();}
}
