// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
import { smooth, type MoonfallConfig } from './AbyssalMoonfallConfig';
/** Sparse winding atmospheric strips with coherent world-space noise; never a filled smoke cylinder. */
export class MoonStorm {
  readonly root=new Group();private readonly geometry=new BufferGeometry();private readonly material:ShaderMaterial;
  constructor(){
    const positions:number[]=[],uv:number[]=[],ids:number[]=[],indices:number[]=[];
    for(let strip=0;strip<5;strip++)for(let i=0;i<=48;i++)for(let side=0;side<2;side++){
      positions.push(0,0,0);uv.push(i/48,side);ids.push(strip);if(i<48&&side===0){const k=strip*98+i*2;indices.push(k,k+1,k+2,k+2,k+1,k+3);}}
    this.geometry.setAttribute('position',new Float32BufferAttribute(positions,3));this.geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));this.geometry.setAttribute('aStrip',new Float32BufferAttribute(ids,1));this.geometry.setIndex(indices);
    this.material=new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
      uniforms:{uTime:{value:0},uRadius:{value:48},uHeight:{value:40},uOpacity:{value:0}},
      vertexShader:`attribute float aStrip;uniform float uTime,uRadius,uHeight;varying vec2 vUv;varying vec3 vWorld;
        void main(){vUv=uv;float a=uv.x*15.+aStrip*1.2566-uTime*.4;float r=uRadius*(1.-uv.x*.58);
          vec3 p=vec3(cos(a)*r,uv.x*uHeight+(uv.y-.5)*2.4,sin(a)*r);vWorld=(modelMatrix*vec4(p,1.)).xyz;
          gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
      fragmentShader:`uniform float uTime,uOpacity;varying vec2 vUv;varying vec3 vWorld;${frostNoise}
        void main(){float n=fbm3(vWorld*.065+vec3(0,uTime*.13,0));float edge=sin(vUv.y*3.14159)*sin(vUv.x*3.14159);
          float a=smoothstep(-.2,.3,n)*edge*uOpacity;if(a<.003)discard;gl_FragColor=vec4(.095,.073,.17,a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    const mesh=new Mesh(this.geometry,this.material);mesh.frustumCulled=false;mesh.renderOrder=2;this.root.add(mesh);
  }
  update(t:number,impact:number,center:Vector3,ground:Vector3,c:Readonly<MoonfallConfig>):void{
    this.root.position.set(center.x,ground.y,center.z);this.material.uniforms.uTime.value=t;this.material.uniforms.uRadius.value=c.stormRadius;
    this.material.uniforms.uHeight.value=Math.max(2,center.y-ground.y-c.moonRadius*.5);
    this.material.uniforms.uOpacity.value=.25*smooth((t-2)/1.5)*(1-smooth((t-impact)/2));
    this.root.visible=t>2&&t<impact+2;
  }
  dispose():void{this.geometry.dispose();this.material.dispose();this.root.clear();}
}
