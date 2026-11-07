// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, MeshStandardMaterial, Object3D, Points, ShaderMaterial, Vector3, DynamicDrawUsage } from 'three';
import { hash } from '../elemental/ElementalVisuals';
import { createChainFragmentGeometry } from './AstralChainGeometry';
/** Fixed GPU spark/rune buffer and two lit instanced steel debris batches. */
export class AstralChainParticles {
  readonly root=new Group();
  private readonly geometry=new BufferGeometry();private readonly births=new Float32Array(900*4).fill(-999);private readonly motions=new Float32Array(900*4);
  private readonly shapes=new Float32Array(900*2);private readonly material:ShaderMaterial;private readonly points:Points;
  private readonly shards:InstancedMesh[];private readonly steel=new MeshStandardMaterial({color:'#718594',metalness:.88,roughness:.3,emissive:'#183140',emissiveIntensity:.2,flatShading:true});
  private readonly fragmentData=Array.from({length:84},()=>({p:new Vector3(),v:new Vector3(),birth:-999,seed:0,size:0}));
  private readonly dummy=new Object3D();private readonly temp=new Vector3();private cursor=0;private high=0;private fragmentCount=0;private active=0;private dirty=false;
  constructor(){
    this.geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(900*3),3));
    this.geometry.setAttribute('aBirth',new BufferAttribute(this.births,4).setUsage(DynamicDrawUsage));this.geometry.setAttribute('aMotion',new BufferAttribute(this.motions,4).setUsage(DynamicDrawUsage));this.geometry.setAttribute('aShape',new BufferAttribute(this.shapes,2).setUsage(DynamicDrawUsage));
    this.material=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{uTime:{value:0},uColor:{value:new Color('#91f2ff')}},
      vertexShader:`attribute vec4 aBirth,aMotion;attribute vec2 aShape;uniform float uTime;varying float vFade,vKind;
      void main(){float age=uTime-aBirth.w,life=max(.01,aMotion.w);float t=max(0.,age),drag=(1.-exp(-t*1.8))/1.8;
      vec3 p=aBirth.xyz+aMotion.xyz*drag;p.y-=1.9*t*t;p.x+=sin(t*5.+aShape.y*20.)*t*.12;p.z+=cos(t*4.+aShape.y*31.)*t*.12;
      vFade=step(0.,age)*(1.-smoothstep(life*.4,life,age));vKind=aShape.y;
      vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aShape.x*450./max(1.,-mv.z),2.,20.)*vFade;
      if(p.y<-.15||vFade<.001)gl_Position=vec4(2.,2.,2.,1.);}`,
      fragmentShader:`uniform vec3 uColor;varying float vFade,vKind;void main(){vec2 p=gl_PointCoord*2.-1.;float d;
      if(vKind>.65){d=min(abs(p.x)+max(0.,abs(p.y)-.7),abs(p.y-p.x*.6)+max(0.,abs(p.x)-.6));}
      else d=abs(p.x)*2.8+abs(p.y)*.4;
      float a=(1.-smoothstep(.08,.28,d))*(1.-smoothstep(.65,1.,max(abs(p.x),abs(p.y))));if(a*vFade<.01)discard;
      gl_FragColor=vec4(mix(uColor,vec3(.9,.97,1.),step(.9,vKind)),a*vFade*.65);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    this.points=new Points(this.geometry,this.material);this.points.frustumCulled=false;this.points.renderOrder=4;this.root.add(this.points);
    this.shards=[0,1].map(i=>{const mesh=new InstancedMesh(createChainFragmentGeometry(i),this.steel,42);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.root.add(mesh);return mesh;});
  }
  emit(time:number,p:Vector3,v:Vector3,budget:number,size=.055,life=.65,glyph=false):void {
    const i=this.cursor++%Math.max(1,budget),k=i*4;this.high=Math.max(this.high,i+1);
    this.births[k]=p.x;this.births[k+1]=p.y;this.births[k+2]=p.z;this.births[k+3]=time;
    this.motions[k]=v.x;this.motions[k+1]=v.y;this.motions[k+2]=v.z;this.motions[k+3]=life;this.shapes[i*2]=size;this.shapes[i*2+1]=glyph?.84:hash(i+time*17);
    this.dirty=true;
  }
  burst(time:number,p:Vector3,count:number,budget:number):void {
    this.fragmentCount=count;
    for(let i=0;i<Math.min(budget,420);i++){const a=i*2.39996,s=hash(i+37);this.temp.set(Math.cos(a)*(3+s*11),2+s*8,Math.sin(a)*(3+s*11));this.emit(time,p,this.temp,budget,.035+s*.05,.6+s*.8);}
    for(let i=0;i<count;i++){const r=this.fragmentData[i],a=i*2.39996,s=hash(i+88);r.p.copy(p);r.v.set(Math.cos(a)*(3+s*8),3+s*6,Math.sin(a)*(3+s*8));r.birth=time;r.seed=s;r.size=.12+s*.22;}
  }
  update(time:number,budget:number):void {
    this.material.uniforms.uTime.value=time;this.geometry.setDrawRange(0,Math.min(this.high,budget));this.active=0;
    for(let i=0;i<Math.min(this.high,budget);i++)if(time>=this.births[i*4+3]&&time-this.births[i*4+3]<this.motions[i*4+3])this.active++;
    this.points.visible=this.active>0;if(this.dirty){for(const name of ['aBirth','aMotion','aShape'])this.geometry.getAttribute(name).needsUpdate=true;this.dirty=false;}
    this.shards.forEach(mesh=>mesh.count=0);
    for(let i=0;i<this.fragmentCount;i++) {
      const r=this.fragmentData[i],t=time-r.birth;if(t<0||t>1.45)continue;const drag=(1-Math.exp(-t*1.3))/1.3;
      this.dummy.position.copy(r.p).addScaledVector(r.v,drag);this.dummy.position.y-=5*t*t;
      if(this.dummy.position.y<r.p.y-.1)continue;
      this.dummy.rotation.set(t*(3+r.seed*8),r.seed*6+t*2,t*4);this.dummy.scale.setScalar(r.size*(1-Math.max(0,t-1)/.45));this.dummy.updateMatrix();
      const mesh=this.shards[i%2];mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
    }
    this.shards.forEach(mesh=>{mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;});
  }
  get particleCount():number{return this.active;}
  get instanceCount():number{return this.shards.reduce((n,m)=>n+m.count,0);}
  reset():void{this.cursor=this.high=this.fragmentCount=this.active=0;this.births.fill(-999);this.dirty=true;this.points.visible=false;this.shards.forEach(m=>m.count=0);}
  dispose():void{this.root.removeFromParent();this.geometry.dispose();this.material.dispose();this.shards.forEach(m=>{m.dispose();m.geometry.dispose();});this.steel.dispose();this.root.clear();}
}
