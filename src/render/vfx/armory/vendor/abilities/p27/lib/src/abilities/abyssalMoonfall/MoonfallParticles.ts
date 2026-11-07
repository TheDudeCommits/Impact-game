// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three';
import { frostNoise } from '../frostLance/FrostLanceNoise';
import { seed, type MoonfallConfig, type MoonQuality } from './AbyssalMoonfallConfig';

/** Two bounded GPU layers: normal-blended dust/spray and additive angular energy grains. */
export class MoonfallParticles {
  readonly root=new Group();private readonly geometry=new BufferGeometry();private readonly materials:ShaderMaterial[]=[];
  private count=0;
  private readonly uniforms={uTime:{value:0},uImpact:{value:10},uCenter:{value:new Vector3()},uGround:{value:new Vector3()},uRadius:{value:35},uStormRadius:{value:48},uSpray:{value:1},uTier:{value:0},uFade:{value:1}};
  constructor(){
    const data=new Float32Array(6000*4);
    for(let i=0;i<6000;i++){data[i*4]=seed(i+1);data[i*4+1]=seed(i+7000);data[i*4+2]=seed(i+21000);data[i*4+3]=i%5;}
    this.geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(6000*3),3));this.geometry.setAttribute('aData',new Float32BufferAttribute(data,4));
    for(let layer=0;layer<2;layer++){
      const mat=new ShaderMaterial({transparent:true,depthWrite:false,blending:layer?AdditiveBlending:NormalBlending,
        uniforms:{...this.uniforms,uLayer:{value:layer}},vertexShader:`
          uniform float uTime,uImpact,uRadius,uStormRadius,uSpray,uTier,uFade;uniform vec3 uCenter,uGround;attribute vec4 aData;
          varying float vFade,vKind;varying vec3 vColor;
          ${frostNoise}
          void main(){float h=aData.x,s=aData.y,k=aData.w,a=s*6.283185+uTime*(.25+h*.5);
            float after=uTime-uImpact;vec3 p;vKind=k;float rise=fract(h+uTime*.12);
            float radius=uStormRadius*(.2+.8*s)*(1.-rise*.45);
            vec3 base=mix(uGround,vec3(uCenter.x,uGround.y,uCenter.z),smoothstep(1.,3.,uTime));
            p=base+vec3(cos(a)*radius,rise*max(5.,uCenter.y-uGround.y-uRadius*.6),sin(a)*radius);
            vFade=smoothstep(0.,1.,uTime)*(1.-smoothstep(.8,1.,rise))*.22;
            if(k<.5){p.x+=sin(p.y*.2+uTime)*2.;p.z+=cos(p.y*.25+uTime*.7)*2.;}
            else if(k<1.5){p=mix(uGround,uCenter,rise)+vec3(cos(a)*5.,0.,sin(a)*5.);vFade*=1.3;}
            else if(k<2.5){p=uCenter+vec3(cos(a)*uRadius*1.18,sin(a*1.3+h*10.)*uRadius*.9,sin(a)*uRadius*1.18);vFade*=2.;}
            else vFade=0.;
            if(after>=0.){float age=max(0.,after-h*.2),drag=(1.-exp(-age*.7))/.7;
              float speed=14.+s*38.;a=aData.y*6.283185;
              p=uGround+vec3(cos(a)*speed*drag,1.+(8.+h*24.)*age-6.*age*age,sin(a)*speed*drag);
              vFade=(1.-smoothstep(1.1,3.5,age))*.38;
              if(k>3.5){p.y=1.+s*5.+sin(age*2.+a)*.6;p.xz*=1.;vFade*=.45;}
              if(k>2.5&&k<3.5){p.y=1.+(13.+h*28.)*age-10.*age*age;vFade*=uSpray;}
              if(p.y<uGround.y-.3)vFade=0.;
            }
            float turbulence=uTier<.5?snoise(p*.045+vec3(0,uTime*.1,0)):fbm3(p*.045+vec3(0,uTime*.1,0));
            p.x+=sin(p.z*.08+uTime*.6+h*10.)*2.+turbulence*3.;p.z+=cos(p.x*.08+uTime*.7+s*10.)*2.-turbulence*2.;
            vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
            float size=k<.5||k>3.5?(.9+h*1.5):k>2.5?.22+h*.3:.13+h*.18;
            gl_PointSize=clamp(size*550./max(1.,-mv.z),1.,k<.5||k>3.5?28.:10.);
            vFade*=uFade;
            vColor=k<.5?vec3(.085,.06,.12):k>3.5?vec3(.22,.3,.38):k>2.5?vec3(.52,.65,.75):mix(vec3(.35,.2,.75),vec3(.7,.78,1.),h);
            if(vFade<.001)gl_Position=vec4(2.,2.,2.,1.);
          }`,fragmentShader:`uniform float uLayer,uTime;varying float vFade,vKind;varying vec3 vColor;
            void main(){if((uLayer<.5&&(vKind> .5&&vKind<2.5))||(uLayer>.5&&(vKind<.5||vKind>2.5)))discard;
              vec2 p=gl_PointCoord*2.-1.;float a;
              if(vKind<.5||vKind>3.5)a=exp(-dot(p,p)*5.)*(1.-smoothstep(.6,1.,length(p)));
              else if(vKind>2.5)a=(1.-smoothstep(.06,.16,abs(p.x)))*(1.-smoothstep(.2,1.,abs(p.y)));
              else a=1.-smoothstep(.18,.3,abs(p.x)+abs(p.y)*.5);
              if(a*vFade<.005)discard;gl_FragColor=vec4(vColor,a*vFade);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`});
      const points=new Points(this.geometry,mat);points.frustumCulled=false;points.renderOrder=layer?5:3;this.materials.push(mat);this.root.add(points);
    }
  }
  update(t:number,impact:number,center:Vector3,ground:Vector3,c:Readonly<MoonfallConfig>,q:MoonQuality):void{
    this.count=q.particles;this.geometry.setDrawRange(0,this.count);this.uniforms.uTime.value=t;this.uniforms.uImpact.value=impact;
    this.uniforms.uCenter.value.copy(center);this.uniforms.uGround.value.copy(ground);this.uniforms.uRadius.value=c.moonRadius;
    this.uniforms.uStormRadius.value=c.stormRadius;this.uniforms.uSpray.value=c.sprayIntensity;this.uniforms.uTier.value=q.tier;
    this.uniforms.uFade.value=t<impact?1:Math.max(0,1-(t-impact)/c.aftermathDuration);this.root.visible=t>0&&this.uniforms.uFade.value>0;
  }
  get particleCount():number{return this.root.visible?Math.round(this.count*(this.uniforms.uTime.value<this.uniforms.uImpact.value?.6:1)):0;}
  dispose():void{this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.root.clear();}
}
