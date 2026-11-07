// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
import { smooth, type MoonfallConfig, type MoonQuality } from './AbyssalMoonfallConfig';

function crownGeometry(n:number):BufferGeometry{
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=6;j++)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;positions.push(Math.cos(a),j/6,Math.sin(a));uv.push(i/n,j/6);}
  for(let j=0;j<6;j++)for(let i=0;i<n;i++){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
/** Local pressure/shadow overlay and a GPU-deformed irregular three-dimensional spray crown. */
export class MoonfallWater {
  readonly root=new Group();readonly crown:Mesh;readonly surface:Mesh;
  private readonly lods=[64,96,144].map(crownGeometry);
  private readonly uniforms={uAge:{value:-1},uRadius:{value:85},uHeight:{value:12},uOpacity:{value:0}};
  private readonly water=new MeshStandardMaterial({color:'#183543',roughness:.23,metalness:.1,transparent:true,opacity:.6,depthWrite:false,side:DoubleSide,fog:false});
  private readonly surfaceMaterial=new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,
    uniforms:{uAge:{value:-10},uRadius:{value:85},uSummon:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uAge,uRadius,uSummon;
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p)*uRadius,age=max(0.,uAge);
        float shadow=exp(-r*r/800.)*uSummon*.2;
        float ring=exp(-pow((r-age*32.)/1.5,2.))*exp(-age*.9);
        float secondary=exp(-pow((r-max(0.,age-.4)*23.)/2.5,2.))*exp(-age*.8);
        float flash=exp(-r*r/64.)*exp(-age*12.)*step(0.,uAge);
        float wave=(ring+secondary*.35)*step(0.,uAge);
        float a=max(shadow,(wave*.65+flash*.5));if(a<.002||r>uRadius)discard;
        gl_FragColor=vec4(mix(vec3(.001,.002,.006),vec3(.42,.39,.7),step(.001,wave+flash)),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  constructor(){
    this.water.onBeforeCompile=s=>{
      Object.assign(s.uniforms,this.uniforms);
      s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
        uniform float uAge,uRadius,uHeight;varying vec2 vCrownUv;
        float crownHeight(float a){return uHeight*(.62+.25*sin(a*7.+uAge*2.)+.13*sin(a*17.-uAge*3.));}`)
      .replace('#include <beginnormal_vertex>',`float a=uv.x*6.283185;float h=crownHeight(a);
        vec3 objectNormal=normalize(vec3(cos(a),.65,sin(a)));`)
      .replace('#include <begin_vertex>',`vec3 transformed=vec3(position.x*(uRadius+uv.y*4.),h*pow(sin(uv.y*1.570796),.85),position.z*(uRadius+uv.y*4.));vCrownUv=uv;`);
      s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
        uniform float uAge,uOpacity;varying vec2 vCrownUv;${frostNoise}`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float foam=smoothstep(.65,.95,vCrownUv.y+snoise(vec3(vCrownUv.x*43.,vCrownUv.y*7.,uAge))*.15);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.4,.53,.6),foam*.8);totalEmissiveRadiance+=vec3(.025,.035,.055)*foam;`)
      .replace('#include <opaque_fragment>',`diffuseColor.a*=uOpacity*(1.-smoothstep(.82,1.,vCrownUv.y));
        if(diffuseColor.a<.01)discard;
        #include <opaque_fragment>`);
    };this.water.customProgramCacheKey=()=> 'moonfall-water-crown-v1';
    this.crown=new Mesh(this.lods[0],this.water);this.crown.frustumCulled=false;this.crown.name='Irregular lunar impact water crown';this.crown.renderOrder=2;
    this.surface=new Mesh(new PlaneGeometry(2,2),this.surfaceMaterial);this.surface.rotation.x=-Math.PI/2;this.surface.renderOrder=1;
    this.root.add(this.surface,this.crown);
  }
  update(t:number,after:number,ground:Vector3,c:Readonly<MoonfallConfig>,q:MoonQuality):void{
    this.root.position.copy(ground);this.root.position.y+=.055;this.surface.scale.setScalar(c.shockwaveRadius);
    this.surfaceMaterial.uniforms.uAge.value=after;this.surfaceMaterial.uniforms.uRadius.value=c.shockwaveRadius;
    this.surfaceMaterial.uniforms.uSummon.value=after<0?smooth(t/3):Math.max(0,1-after/3);
    const age=Math.max(0,after);this.crown.visible=after>=0&&after<3;this.crown.geometry=this.lods[q.tier];
    this.uniforms.uAge.value=age;this.uniforms.uRadius.value=Math.min(c.shockwaveRadius,8+age*25);
    this.uniforms.uHeight.value=14*Math.sin(Math.min(1,age/.6)*Math.PI*.5)*Math.exp(-age*.85)*c.sprayIntensity;
    this.uniforms.uOpacity.value=smooth(age/.15)*(1-smooth(age/3));
  }
  dispose():void{this.lods.forEach(g=>g.dispose());this.water.dispose();this.surface.geometry.dispose();this.surfaceMaterial.dispose();this.root.clear();}
}
