import * as THREE from 'three';
import type {GameSnapshot} from '../../game/types';
import {BALL_TEAM_COLOURS,CHARM_COLOURS,GOAL_RULES,SPIKE_RULES,ballOf,ballRadius,heatTier,type BallEvent,type BallModeId,type BallState,type BallTeam,type BallView} from '../../game/ball/model';
import {courtSide,landing,stepBall,type BallContact} from '../../game/ball/physics';
import {noiseTexture} from '../vfx/noiseTexture';
import {VFX} from '../vfxLevel';
import {BallCharms} from './BallCharms';
import {arenaMood,crowdHype} from './hype';

/** Points in the trail, effects in the pool, and the instances drawn each frame beyond the pool (the shadow, the
 *  landing ring, the stopped clock). */
const TRAIL=40,CAP=720,EXTRA=4;
/** One pooled effect's floats: where, its velocity, its age and life, its size from and to, colour and alpha, its
 *  kind, turn and spin, drag, gravity, a seed, how far it stretches and along what, and its flags. */
const F=25,PX=0,PY=1,PZ=2,VX=3,VY=4,VZ=5,AGE=6,LIFE=7,S0=8,S1=9,CR=10,CG=11,CB=12,CA=13,KIND=14,ROT=15,SPIN=16,DRAG=17,GRAV=18,SEED=19,STRETCH=20,FLAGS=21,AX=22,AY=23,AZ=24;
/** What each pooled effect is drawn as (the fragment shader's branches). 20 and up lie flat on the floor. */
const K={spark:0,smoke:1,burst:2,ring:3,petal:4,confetti:5,streak:6,shield:7,chunk:8,glint:9,clock:10,bolt:11,groundRing:20,splat:21,shadow:22,landing:23,dust:24} as const;
/** Stretched along its own flight, stretched along a fixed axis, stopped by the floor, fluttering as paper falls. */
const ALONG_FLIGHT=1,ALONG_AXIS=2,FLOOR=4,FLUTTER=8;
/** Seconds the drawn ball may run ahead of its last snapshot; the time constant a correction is blended out over
 *  (gone by about 80 ms); a jump between snapshots beyond any flight that is a reset (a kickoff, a serve's walk-up). */
const AHEAD=.12,BLEND=.028,SNAP=4;

const TEAM:Record<BallTeam,THREE.Color>={red:new THREE.Color(BALL_TEAM_COLOURS.red),blue:new THREE.Color(BALL_TEAM_COLOURS.blue)};
const NEUTRAL=new THREE.Color(.9,.92,1),WHITE=new THREE.Color(1,1,1),INK=new THREE.Color(.012,.012,.016),GOLD=new THREE.Color(1,.72,.28);
const DUST=new THREE.Color(.42,.38,.33),PINK=new THREE.Color(1,.62,.76),PALE=new THREE.Color(.75,.9,1),WOOD=new THREE.Color(.55,.34,.18),CLOCK=new THREE.Color(.92,.92,.96);
const TREES:readonly (readonly [number,number])[]=[[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx,sz])=>[sx*(SPIKE_RULES.halfX+1.6),sz*(SPIKE_RULES.halfZ+1.7)] as const);

const blankBall=():BallState=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,sx:0,sy:0,sz:0,heat:0,lastId:null,lastTeam:null,shot:null,held:true,frozenUntil:0,super:false,size:1,grav:1,wall:null,clash:0});
function copyBall(to:BallState,from:BallState){
  to.x=from.x;to.y=from.y;to.z=from.z;to.vx=from.vx;to.vy=from.vy;to.vz=from.vz;to.sx=from.sx;to.sy=from.sy;to.sz=from.sz;
  to.heat=from.heat;to.lastId=from.lastId;to.lastTeam=from.lastTeam;to.shot=from.shot;to.held=from.held;to.frozenUntil=from.frozenUntil;to.super=from.super;to.size=from.size??1;to.grav=from.grav??1;to.wall=from.wall??null;to.clash=from.clash??0;
}
const sameBall=(a:BallState,b:BallState)=>a.x===b.x&&a.y===b.y&&a.z===b.z&&a.vx===b.vx&&a.vy===b.vy&&a.vz===b.vz&&a.held===b.held&&a.frozenUntil===b.frozenUntil&&a.heat===b.heat&&a.lastTeam===b.lastTeam&&a.super===b.super&&a.size===b.size&&a.grav===b.grav&&a.wall===b.wall&&a.clash===b.clash;
const PREMULTIPLIED={transparent:true,depthWrite:false,forceSinglePass:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor} as const;
const golden=(1+Math.sqrt(5))/2;
const unit=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).normalize();

/** The trail's history, newest first: where the ball was drawn, when, how wide the ribbon is there and in whose colour. */
class Trail{
  readonly x=new Float32Array(TRAIL);readonly y=new Float32Array(TRAIL);readonly z=new Float32Array(TRAIL);readonly t=new Float32Array(TRAIL);
  readonly w=new Float32Array(TRAIL);readonly r=new Float32Array(TRAIL);readonly g=new Float32Array(TRAIL);readonly b=new Float32Array(TRAIL);
  head=0;count=0;
  slot(i:number){return (this.head-i+TRAIL*2)%TRAIL;}
  set(i:number,p:THREE.Vector3,t:number,w:number,c:THREE.Color){const s=this.slot(i);this.x[s]=p.x;this.y[s]=p.y;this.z[s]=p.z;this.t[s]=t;this.w[s]=w;this.r[s]=c.r;this.g[s]=c.g;this.b[s]=c.b;}
  push(p:THREE.Vector3,t:number,w:number,c:THREE.Color){this.head=(this.head+1)%TRAIL;this.count=Math.min(TRAIL,this.count+1);this.set(0,p,t,w,c);}
}

/** A ribbon laid along the trail broad side to the lens, as a pooled strip of TRAIL pairs of vertices. */
class Ribbon{
  readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
  private readonly position:THREE.BufferAttribute;private readonly colour:THREE.BufferAttribute;
  constructor(material:THREE.ShaderMaterial,name:string){
    const geometry=new THREE.BufferGeometry(),uv=new Float32Array(TRAIL*4),index:number[]=[];
    for(let i=0;i<TRAIL;i++)uv.set([i/(TRAIL-1),0,i/(TRAIL-1),1],i*4);
    for(let i=0;i<TRAIL-1;i++){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
    this.position=new THREE.BufferAttribute(new Float32Array(TRAIL*6),3).setUsage(THREE.DynamicDrawUsage);
    this.colour=new THREE.BufferAttribute(new Float32Array(TRAIL*8),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(index);geometry.setAttribute('position',this.position);geometry.setAttribute('aColor',this.colour);geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geometry.setDrawRange(0,0);
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.name=name;this.mesh.frustumCulled=false;this.mesh.renderOrder=9;
  }
  build(trail:Trail,eye:THREE.Vector3,clock:number,life:number,widthScale:number){
    const n=trail.count,pos=this.position.array as Float32Array,col=this.colour.array as Float32Array;
    if(n<2){this.mesh.geometry.setDrawRange(0,0);return;}
    let sx=0,sy=1,sz=0;
    for(let i=0;i<n;i++){
      const s=trail.slot(i),a=trail.slot(Math.max(0,i-1)),b=trail.slot(Math.min(n-1,i+1));
      const px=trail.x[s],py=trail.y[s],pz=trail.z[s],tx=trail.x[a]-trail.x[b],ty=trail.y[a]-trail.y[b],tz=trail.z[a]-trail.z[b];
      const vx=eye.x-px,vy=eye.y-py,vz=eye.z-pz,cx=ty*vz-tz*vy,cy=tz*vx-tx*vz,cz=tx*vy-ty*vx,cl=Math.hypot(cx,cy,cz);
      if(cl>1e-6){sx=cx/cl;sy=cy/cl;sz=cz/cl;}
      const u=i/(n-1),fade=Math.max(0,1-(clock-trail.t[s])/life),w=trail.w[s]*widthScale*Math.sqrt(1-u)*.5*(.45+.55*fade);
      pos[i*6]=px+sx*w;pos[i*6+1]=py+sy*w;pos[i*6+2]=pz+sz*w;pos[i*6+3]=px-sx*w;pos[i*6+4]=py-sy*w;pos[i*6+5]=pz-sz*w;
      const alpha=fade*(1-u*.4);
      for(let k=0;k<2;k++){const o=i*8+k*4;col[o]=trail.r[s];col[o+1]=trail.g[s];col[o+2]=trail.b[s];col[o+3]=alpha;}
    }
    this.position.clearUpdateRanges();this.position.addUpdateRange(0,n*6);this.position.needsUpdate=true;
    this.colour.clearUpdateRanges();this.colour.addUpdateRange(0,n*8);this.colour.needsUpdate=true;
    this.mesh.geometry.setDrawRange(0,(n-1)*6);
  }
  clear(){this.mesh.geometry.setDrawRange(0,0);}
}

/** Every burst, puff, spark, ring, petal and decal of the ball's moments: one pool, one instanced draw. Each effect
 *  is a card the shader paints by its kind - turned to the lens, stretched along its flight, or laid on the floor -
 *  blended premultiplied, so light adds (sparks, rings) and ink covers (smoke, splats) in the same draw. */
class InkFx{
  readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  readonly data=new Float32Array(CAP*F);
  private cursor=0;private count=0;
  private readonly pos:THREE.InstancedBufferAttribute;private readonly col:THREE.InstancedBufferAttribute;
  private readonly axis:THREE.InstancedBufferAttribute;private readonly misc:THREE.InstancedBufferAttribute;
  private readonly attributes:THREE.InstancedBufferAttribute[];
  constructor(time:{value:number}){
    const quad=new THREE.PlaneGeometry(2,2),geometry=new THREE.InstancedBufferGeometry(),n=CAP+EXTRA;
    geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));
    const attribute=()=>new THREE.InstancedBufferAttribute(new Float32Array(n*4),4).setUsage(THREE.DynamicDrawUsage);
    this.pos=attribute();this.col=attribute();this.axis=attribute();this.misc=attribute();this.attributes=[this.pos,this.col,this.axis,this.misc];
    geometry.setAttribute('aPos',this.pos);geometry.setAttribute('aCol',this.col);geometry.setAttribute('aAxis',this.axis);geometry.setAttribute('aMisc',this.misc);
    geometry.instanceCount=0;
    const material=new THREE.ShaderMaterial({
      name:'Ball moments',...PREMULTIPLIED,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{uTime:time,uNoise:{value:noiseTexture()}},
      vertexShader:`attribute vec4 aPos;attribute vec4 aCol;attribute vec4 aAxis;attribute vec4 aMisc;
        varying vec2 vP;varying vec4 vCol;varying vec4 vMisc;varying vec4 vAxis;
        void main(){
          vP=position.xy;vCol=aCol;vMisc=aMisc;vAxis=aAxis;
          vec3 centre=(modelMatrix*vec4(aPos.xyz,1.)).xyz;
          float c=cos(aMisc.z),s=sin(aMisc.z);
          vec2 q=mat2(c,s,-s,c)*position.xy*aPos.w;
          vec4 mv;
          if(aMisc.x>19.5)mv=viewMatrix*vec4(centre+vec3(q.x,0.,q.y),1.);
          else{
            mv=viewMatrix*vec4(centre,1.);
            if(aAxis.w>0.){
              vec3 d=(viewMatrix*vec4(aAxis.xyz,0.)).xyz;float l=length(d.xy);
              vec2 along=l>1e-4?d.xy/l:vec2(1.,0.),across=vec2(-along.y,along.x);
              mv.xy+=along*position.x*aPos.w*aAxis.w+across*position.y*aPos.w;
            }else mv.xy+=q;
          }
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`uniform sampler2D uNoise;uniform float uTime;
        varying vec2 vP;varying vec4 vCol;varying vec4 vMisc;varying vec4 vAxis;
        float h1(float n){return fract(sin(n)*43758.5453);}
        void main(){
          float kind=vMisc.x,t=vMisc.y,seed=vMisc.w;
          vec2 p=vP;float r=length(p),a=atan(p.y,p.x);
          vec3 col=vCol.rgb;float al=vCol.a;
          vec3 rgb=vec3(0.);float cover=0.;
          if(kind<.5){
            // A spark: a hot streak down its flight.
            float k=(1.-smoothstep(0.,1.,abs(p.y)))*(1.-smoothstep(.15,1.,abs(p.x)));
            rgb=mix(col*1.6,vec3(2.6),k*k)*k*al*(1.-t*t);
          }else if(kind<1.5){
            // Ink smoke: a black cloud broken at its edge, a paler lip on its lit side, swelling as it thins.
            float n=texture2D(uNoise,p*.32+vec2(seed*3.1,seed*7.3)+t*.08).g;
            float edge=.82-t*.18+(n-.5)*.55;
            float body=1.-smoothstep(edge-.05,edge,r);
            float lip=smoothstep(.1,.7,dot(p,vec2(-.6,.8)))*smoothstep(edge-.32,edge-.08,r);
            cover=body*al*(1.-smoothstep(.55,1.,t));
            rgb=(col+vec3(.2)*lip)*cover;
          }else if(kind<2.5){
            // A starburst: spikes round a white-hot heart, an ink edge, hollowing out as it dies.
            float spikes=7.+floor(h1(seed*91.)*5.);
            float s=pow(abs(cos(a*spikes*.5+seed*6.)),5.);
            float jag=texture2D(uNoise,vec2(a*.4+seed,seed*3.)).a;
            float reach=mix(.32,.97,s*(.55+.45*jag))*min(1.,.35+t*7.);
            float shape=1.-smoothstep(reach-.03,reach,r);
            float hole=smoothstep(reach*t*1.05-.04,reach*t*1.05,r);
            vec3 c=mix(vec3(3.),col*1.5,smoothstep(.05,.6,r/max(reach,.01)));
            c=mix(c,vec3(.01),smoothstep(reach-.13,reach-.07,r));
            cover=shape*hole*al*(1.-smoothstep(.65,1.,t));
            rgb=c*cover;
          }else if(kind<3.5){
            // A shockwave ring racing out and thinning.
            float rr=mix(.25,.95,sqrt(t)),w=mix(.2,.025,t);
            rgb=col*(1.-smoothstep(w*.5,w*.5+.04,abs(r-rr)))*al*(1.-t)*1.6;
          }else if(kind<4.5){
            // A cherry petal.
            float d=max(length(p*vec2(1.65,1.))-.92,.2-length(p-vec2(0.,1.02)));
            cover=(1.-smoothstep(-.06,0.,d))*al*(1.-smoothstep(.8,1.,t));
            rgb=mix(col,col+vec3(.25),1.-r)*cover;
          }else if(kind<5.5){
            // Confetti: a paper slip flashing as it turns over.
            cover=step(abs(p.x),.55)*step(abs(p.y),.95)*al*(1.-smoothstep(.85,1.,t));
            rgb=col*(.55+.45*abs(cos(t*30.+seed*12.)))*cover;
          }else if(kind<6.5){
            // A speed streak, tapered at both ends.
            float w=.6*(1.-abs(p.x));
            rgb=col*(1.-smoothstep(w*.4,w,abs(p.y)))*al*(1.-t);
          }else if(kind<7.5){
            // A guard's shield: a hexagon flashing out, cells running through it.
            float hx=max(abs(p.x)*.866+abs(p.y)*.5,abs(p.y)),rr=mix(.55,.95,sqrt(t));
            float edge=1.-smoothstep(.02,.07,abs(hx-rr));
            float cells=step(.9,fract(hx*6.-t*3.))*(1.-smoothstep(0.,rr,hx));
            float flash=(1.-smoothstep(0.,.25,t))*(1.-smoothstep(0.,.9,hx));
            rgb=(col*(edge*1.8+cells*.4)+vec3(2.5)*flash)*al*(1.-t);
          }else if(kind<8.5){
            // Debris: a jagged chip, darker at its rim.
            float rad=.5+.45*texture2D(uNoise,vec2(a*.25+seed,seed)).r;
            cover=step(r,rad)*al*(1.-smoothstep(.75,1.,t));
            rgb=mix(col,col*.4,step(rad-.15,r))*cover;
          }else if(kind<9.5){
            // A glint: a four-point star with fainter diagonals.
            float s=max(0.,1.-abs(p.x)*10.-abs(p.y)*1.1)+max(0.,1.-abs(p.y)*10.-abs(p.x)*1.1);
            vec2 d=vec2(p.x+p.y,p.x-p.y)*.7071;
            s+=.5*(max(0.,1.-abs(d.x)*14.-abs(d.y)*2.)+max(0.,1.-abs(d.y)*14.-abs(d.x)*2.))+1.-smoothstep(0.,.22,r);
            rgb=col*s*al*2.2*(1.-t*t);
          }else if(kind<10.5){
            // A stopped ball's clock: the dial, twelve ticks, a hand (its angle in vAxis.x), the time left an arc.
            float ring=1.-smoothstep(.025,.05,abs(r-.86));
            float tick=(1.-smoothstep(.03,.06,abs(fract(a/6.28318*12.+.5)-.5)))*step(.68,r)*step(r,.84);
            vec2 hd=vec2(cos(vAxis.x),sin(vAxis.x));
            float hand=1.-smoothstep(.03,.06,length(p-hd*clamp(dot(p,hd),0.,.66)));
            float arc=step(fract(.25-a/6.28318),t)*(1.-smoothstep(.035,.065,abs(r-.96)));
            cover=(1.-smoothstep(.8,.9,r))*.28*al;
            rgb=col*(ring+tick+hand+arc*1.5)*al;
          }else if(kind<11.5){
            // Lightning: a jagged bolt along its axis, re-struck many times a second.
            float frame=floor(uTime*24.);
            float off=((texture2D(uNoise,vec2(p.x*.35+seed,frame*.137+seed)).r-.5)*.9+(texture2D(uNoise,vec2(p.x*.9+seed*2.,frame*.31)).g-.5)*.35)*(1.-abs(p.x));
            float l=1.-smoothstep(.03,.14,abs(p.y-off)),core=1.-smoothstep(0.,.05,abs(p.y-off));
            rgb=(col*l*1.8+vec3(2.5)*core)*al*(1.-t)*(1.-smoothstep(.85,1.,abs(p.x)));
          }else if(kind<20.5){
            // A shockwave along the floor.
            float rr=mix(.2,.97,sqrt(t)),w=mix(.24,.03,t);
            rgb=col*(1.-smoothstep(w*.5,w*.5+.03,abs(r-rr)))*al*(1.-t)*1.4;
          }else if(kind<21.5){
            // An ink crater where the ball came down: a black splash with droplets thrown out, rimmed in colour.
            float s=pow(abs(sin(a*3.5+seed*10.)),6.)*(.5+.5*texture2D(uNoise,vec2(a*.5+seed,.3)).b);
            float reach=.4+.42*s,body=1.-smoothstep(reach-.03,reach,r),drops=0.;
            for(int i=0;i<6;i++){float fi=float(i),an=seed*6.28+fi*1.047+h1(seed+fi)*.6,dist=.68+.24*h1(seed*3.+fi);
              drops=max(drops,1.-smoothstep(.05,.08,length(p-dist*vec2(cos(an),sin(an)))));}
            float rim=smoothstep(reach-.16,reach-.07,r)*body;
            float crack=step(.94,fract(a*1.9+seed*3.))*step(r,.34)*step(.1,r);
            vec3 c=mix(vec3(.012),col*1.3,rim);c=mix(c,vec3(.8),crack*.55);
            cover=max(body,drops)*al*(1.-smoothstep(.7,1.,t));
            rgb=c*cover;
          }else if(kind<22.5){
            // The ball's shadow, and a fine ring to find it by when the ball is high (its strength in vAxis.x).
            cover=(1.-smoothstep(.15,1.,r))*al;
            rgb=vec3(.9)*(1.-smoothstep(.02,.05,abs(r-.9)))*vAxis.x;
          }else if(kind<23.5){
            // Where the ball comes down: dashes round a ring, a fainter inner ring, a cross when it lands out.
            float ring=(1.-smoothstep(.05,.09,abs(r-.88)))*step(.45,fract(a/6.28318*14.));
            float inner=1.-smoothstep(.02,.05,abs(r-.42));
            vec2 d=vec2(p.x+p.y,p.x-p.y)*.7071;
            float xmark=vAxis.y*(1.-smoothstep(.04,.08,min(abs(d.x),abs(d.y))))*step(r,.6);
            float fill=(1.-smoothstep(0.,.9,r))*.18;
            cover=fill*al;
            rgb=col*(ring*1.6+inner*.7+xmark*1.4+fill*.5)*al;
          }else{
            // Dust thrown out along the floor in a broken ring.
            float n=texture2D(uNoise,vec2(a*.6+seed,r*.8-t*.5)).g;
            float band=1.-smoothstep(0.,.22+n*.15,abs(r-mix(.25,.92,sqrt(t)))+(n-.5)*.15);
            cover=band*al*(1.-t);
            rgb=col*cover;
          }
          gl_FragColor=vec4(rgb,cover);
        }`,
    });
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.name='Ball moments (pooled)';this.mesh.frustumCulled=false;this.mesh.renderOrder=10;
    quad.dispose();
  }
  /** Live effects in the pool. */
  get alive(){let n=0;for(let i=0;i<CAP;i++)if(this.data[i*F+LIFE]>0)n++;return n;}
  /** Takes the next slot (the oldest effect gives way when the pool is full) and returns its offset for any extras. */
  spawn(kind:number,x:number,y:number,z:number,vx:number,vy:number,vz:number,life:number,size0:number,size1:number,colour:THREE.Color,alpha:number){
    const o=this.cursor*F,d=this.data;this.cursor=(this.cursor+1)%CAP;
    d[o+PX]=x;d[o+PY]=y;d[o+PZ]=z;d[o+VX]=vx;d[o+VY]=vy;d[o+VZ]=vz;d[o+AGE]=0;d[o+LIFE]=life;
    d[o+S0]=size0*VFX.spriteSize;d[o+S1]=size1*VFX.spriteSize;d[o+CR]=colour.r;d[o+CG]=colour.g;d[o+CB]=colour.b;d[o+CA]=alpha;
    d[o+KIND]=kind;d[o+ROT]=Math.random()*Math.PI*2;d[o+SPIN]=0;d[o+DRAG]=0;d[o+GRAV]=0;d[o+SEED]=Math.random();d[o+STRETCH]=0;d[o+FLAGS]=0;d[o+AX]=0;d[o+AY]=0;d[o+AZ]=0;
    return o;
  }
  step(dt:number){
    const d=this.data;
    for(let i=0;i<CAP;i++){
      const o=i*F;if(d[o+LIFE]<=0)continue;
      const age=d[o+AGE]+dt;if(age>=d[o+LIFE]){d[o+LIFE]=0;continue;}d[o+AGE]=age;
      const drag=d[o+DRAG];if(drag>0){const k=Math.max(0,1-drag*dt);d[o+VX]*=k;d[o+VY]*=k;d[o+VZ]*=k;}
      d[o+VY]-=d[o+GRAV]*dt;
      const flags=d[o+FLAGS];
      if(flags&FLUTTER){const s=d[o+SEED]*30;d[o+VX]+=Math.sin(age*5+s)*dt*3;d[o+VZ]+=Math.cos(age*4.3+s)*dt*3;}
      d[o+PX]+=d[o+VX]*dt;d[o+PY]+=d[o+VY]*dt;d[o+PZ]+=d[o+VZ]*dt;d[o+ROT]+=d[o+SPIN]*dt;
      if(flags&FLOOR&&d[o+PY]<.05){d[o+PY]=.05;d[o+VY]=Math.abs(d[o+VY])*.2;d[o+VX]*=.5;d[o+VZ]*=.5;d[o+SPIN]*=.5;}
    }
  }
  begin(){this.count=0;}
  /** One instance outside the pool, this frame only. */
  put(kind:number,x:number,y:number,z:number,size:number,c:THREE.Color,alpha:number,p0=0,p1=0,life01=0,rot=0,seed=0){
    if(this.count>=CAP+EXTRA)return;
    this.write(this.count++,x,y,z,size,c.r,c.g,c.b,alpha,p0,p1,0,0,kind,life01,rot,seed);
  }
  /** The pool's live effects of one layer: 0 the decals on the floor, 1 what covers (ink, paper, petals, chips), 2 the
   *  light. Drawn in that order within the one draw. */
  layer(which:0|1|2){
    const d=this.data;
    for(let i=0;i<CAP&&this.count<CAP+EXTRA;i++){
      const o=i*F;if(d[o+LIFE]<=0)continue;
      const kind=d[o+KIND],flat=kind>19.5,covers=kind===K.smoke||kind===K.petal||kind===K.confetti||kind===K.chunk||kind===K.burst;
      if((which===0)!==flat||(which===1&&!covers)||(which===2&&covers))continue;
      const t=d[o+AGE]/d[o+LIFE],e=1-(1-t)*(1-t),size=d[o+S0]+(d[o+S1]-d[o+S0])*e,flags=d[o+FLAGS];
      let ax=0,ay=0,az=0,stretch=0;
      if(flags&ALONG_FLIGHT){const v=Math.hypot(d[o+VX],d[o+VY],d[o+VZ]);if(v>1e-3){ax=d[o+VX]/v;ay=d[o+VY]/v;az=d[o+VZ]/v;stretch=Math.max(1,d[o+STRETCH]*Math.min(1.5,v/8));}}
      else if(flags&ALONG_AXIS){ax=d[o+AX];ay=d[o+AY];az=d[o+AZ];stretch=d[o+STRETCH];}
      this.write(this.count++,d[o+PX],d[o+PY],d[o+PZ],size,d[o+CR],d[o+CG],d[o+CB],d[o+CA]*VFX.spriteGain,ax,ay,az,stretch,kind,t,d[o+ROT],d[o+SEED]);
    }
  }
  end(){
    const n=this.count;this.mesh.geometry.instanceCount=n;
    for(let i=0;i<this.attributes.length;i++){const attribute=this.attributes[i];attribute.clearUpdateRanges();attribute.addUpdateRange(0,n*4);attribute.needsUpdate=true;}
  }
  clear(){for(let i=0;i<CAP;i++)this.data[i*F+LIFE]=0;this.count=0;this.mesh.geometry.instanceCount=0;}
  private write(i:number,x:number,y:number,z:number,size:number,r:number,g:number,b:number,a:number,ax:number,ay:number,az:number,stretch:number,kind:number,t:number,rot:number,seed:number){
    const k=i*4,pos=this.pos.array as Float32Array,col=this.col.array as Float32Array,axis=this.axis.array as Float32Array,misc=this.misc.array as Float32Array;
    pos[k]=x;pos[k+1]=y;pos[k+2]=z;pos[k+3]=size;col[k]=r;col[k+1]=g;col[k+2]=b;col[k+3]=a;
    axis[k]=ax;axis[k+1]=ay;axis[k+2]=az;axis[k+3]=stretch;misc[k]=kind;misc[k+1]=t;misc[k+2]=rot;misc[k+3]=seed;
  }
}

/** The ball and its moments, drawn from the room's snapshot (game/ball: `snapshot.ball`, ballOf): the ball itself - a
 *  black-and-white ink football for Goal Rush, a woven rattan takraw ball for Sky Spike - spun by its spin and its
 *  roll, burning hotter through its five heat tiers, its ribbon trail in the colour of whoever struck it last, its
 *  shadow and where it will come down, and a pooled burst for every moment the room names (a goal's ink explosion and
 *  confetti, a post's clang, a save's shield, a point's crater). View only: the room owns every bounce and every call.
 *
 *  Snapshots come 30 times a second online and the page draws every frame, so the drawn ball runs on from its last
 *  snapshot along its own flight (the sim's stepBall: its gravity, drag, spin and the walls) for up to AHEAD, and a
 *  correction when the next arrives is blended out rather than jumped. A held ball is not run on; a stopped one
 *  (frozenUntil) stands still, drained to grey, with a clock round it. Everything is built once and pooled: a frame
 *  allocates nothing (save the landing forecast, once a snapshot). */
export class BallField {
  readonly root=new THREE.Group();
  private readonly ball=new THREE.Group();private readonly spinner=new THREE.Group();
  private readonly bodyMaterial:THREE.ShaderMaterial;
  private readonly outlineMaterial=new THREE.MeshBasicMaterial({color:0x050506,side:THREE.BackSide,name:'Ball ink outline'});
  private readonly auraMaterial:THREE.ShaderMaterial;private readonly aura:THREE.Mesh;
  private readonly sphere=new THREE.SphereGeometry(1,40,28);
  private readonly trail=new Trail();private readonly ribbon:Ribbon;private readonly superTrail:Ribbon;
  /** The effects' clock (s): it stands still while the ball's time is stopped. */
  private readonly time={value:0};
  private readonly fx=new InkFx(this.time);
  private mode:BallModeId|null=null;private startedAt=NaN;private lastServer=-Infinity;
  /** The last two balls the room sent, the server time each came under and the page time (s) each arrived. */
  private readonly base=blankBall();private readonly prev=blankBall();private readonly sim=blankBall();
  private baseServer=-1;private prevServer=-1;private baseAt=0;private lastRef:BallState|null=null;
  private readonly drawn=new THREE.Vector3();private readonly offset=new THREE.Vector3();private readonly velocity=new THREE.Vector3();
  private shown=false;private lastEvent=-1;private frozen=false;private freezeFrom=0;private freezeLength=1;
  private readonly charms=new BallCharms();
  private heat=0;private flash=0;private grown=1;private trailClock=0;private pulseAt=0;
  private embers=0;private sparks=0;private bolts=0;private streaks=0;
  private readonly land={x:0,z:0,t:0,show:false,team:null as BallTeam|null};
  private readonly contacts:BallContact[]=[];
  private readonly eye=new THREE.Vector3();private readonly omega=new THREE.Vector3();private readonly axis=new THREE.Vector3();private readonly turn=new THREE.Quaternion();
  private readonly tint=new THREE.Color();

  constructor(scene:THREE.Scene){
    this.root.name='Ball modes · the ball and its moments';this.root.visible=false;scene.add(this.root);this.root.add(this.charms.root);
    // The football's panels: twelve black pentagons on an icosahedron's corners, twenty white hexagons on its faces.
    const ico=[[0,1,golden],[0,1,-golden],[0,-1,golden],[0,-1,-golden],[1,golden,0],[-1,golden,0],[1,-golden,0],[-1,-golden,0],[golden,0,1],[golden,0,-1],[-golden,0,1],[-golden,0,-1]].map(([x,y,z])=>unit(x,y,z));
    const dodeca:THREE.Vector3[]=[];
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])dodeca.push(unit(x,y,z));
    for(const a of [-1/golden,1/golden])for(const b of [-golden,golden])dodeca.push(unit(0,a,b),unit(a,b,0),unit(b,0,a));
    // The takraw's six woven strips, each round the great circle square to one of the icosahedron's six axes.
    const axes=ico.slice(0,1).concat(ico[1],ico[4],ico[5],ico[8],ico[9]);
    const tangents=axes.map(a=>new THREE.Vector3().crossVectors(a,Math.abs(a.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0)).normalize());
    this.bodyMaterial=new THREE.ShaderMaterial({
      name:'Ball body',
      uniforms:{uKind:{value:0},uHeat:{value:0},uFreeze:{value:0},uSuper:{value:0},uFlash:{value:0},uTime:this.time,uTeam:{value:new THREE.Color()},
        uPent:{value:ico},uHexa:{value:dodeca},uAxis:{value:axes},uTan:{value:tangents}},
      vertexShader:`varying vec3 vObj;varying vec3 vN;varying vec3 vV;
        void main(){vObj=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uKind,uHeat,uFreeze,uSuper,uFlash,uTime;uniform vec3 uTeam;
        uniform vec3 uPent[12];uniform vec3 uHexa[20];uniform vec3 uAxis[6];uniform vec3 uTan[6];
        varying vec3 vObj;varying vec3 vN;varying vec3 vV;
        vec3 heatColour(float h){
          vec3 c=mix(vec3(1.,.62,.28),vec3(1.,.4,.06),clamp(h-1.,0.,1.));
          c=mix(c,vec3(1.,.1,.03),clamp(h-2.,0.,1.));
          return mix(c,vec3(.72,.3,1.),clamp(h-3.,0.,1.));
        }
        void main(){
          vec3 n=normalize(vObj),base;float glow=0.;
          if(uKind<.5){
            // Each point takes the panel whose centre is nearest; where the nearest two tie runs an ink seam.
            float b1=-2.,b2=-2.,pent=-2.;
            for(int i=0;i<12;i++){float d=dot(n,uPent[i]);pent=max(pent,d);if(d>b1){b2=b1;b1=d;}else if(d>b2)b2=d;}
            for(int i=0;i<20;i++){float d=dot(n,uHexa[i]);if(d>b1){b2=b1;b1=d;}else if(d>b2)b2=d;}
            float seam=1.-smoothstep(.01,.03,b1-b2);
            base=mix(pent>=b1?vec3(.03,.03,.035):vec3(.93,.92,.89),vec3(.008),seam);glow=seam;
          }else{
            // The strip on top at each point (each rises and dips five times round the ball: the over and under of
            // the weave), its fibres along it and ink at its edges; where no strip passes, the hollow inside.
            float top=-9.,coord=0.,along=0.,cover=0.;
            for(int k=0;k<6;k++){
              float b=dot(n,uAxis[k]);
              if(abs(b)<.21){
                vec3 bt=cross(uAxis[k],uTan[k]);float phi=atan(dot(n,bt),dot(n,uTan[k]));
                float h=sin(phi*5.+float(k)*1.9);cover+=1.;
                if(h>top){top=h;coord=b/.21;along=phi;}
              }
            }
            if(cover<.5){base=vec3(.09,.045,.02);glow=1.;}
            else{
              base=vec3(.82,.55,.22)*(.84+.16*sin(along*90.+coord*2.))*(1.-smoothstep(.62,.9,abs(coord))*.5);
              base=mix(base,vec3(.03,.018,.01),smoothstep(.86,.98,abs(coord)));
              if(cover>1.5)base*=.9;
            }
          }
          vec3 N=normalize(vN),V=normalize(vV),L=normalize(vec3(.35,.8,.48));
          float lit=mix(.58,1.,smoothstep(-.08,.08,dot(N,L))),facing=max(dot(N,V),0.),rim=pow(1.-facing,2.5);
          vec3 c=base*lit+vec3(.25)*rim*(1.-uFreeze);
          // Heat: a warm cast from tier one, glowing seams or holes from two, a burning skin at three, a violet-white
          // heart at four.
          float h=uHeat;vec3 hc=heatColour(h);
          c=mix(c,c*hc*1.4,smoothstep(.6,1.6,h)*.45);
          c+=hc*glow*smoothstep(1.5,2.6,h)*(2.+h);
          c+=hc*rim*smoothstep(.8,3.,h)*2.2;
          c=mix(c,vec3(2.6,2.4,3.),smoothstep(3.5,4.,h)*pow(facing,3.)*.6);
          c+=uTeam*rim*uSuper*(2.+sin(uTime*14.));
          c=mix(c,vec3(3.),uFlash*.7);
          float grey=dot(c,vec3(.3,.59,.11));
          c=mix(c,vec3(1.-min(grey,1.)*.92),uFreeze);
          gl_FragColor=vec4(c,1.);
        }`,
    });
    const body=new THREE.Mesh(this.sphere,this.bodyMaterial),outline=new THREE.Mesh(this.sphere,this.outlineMaterial);
    body.name='Ball';outline.name='Ball ink outline';outline.scale.setScalar(1.075);this.spinner.add(body,outline);
    this.auraMaterial=new THREE.ShaderMaterial({
      name:'Ball heat aura',...PREMULTIPLIED,toneMapped:false,
      uniforms:{uHeat:{value:0},uTime:this.time,uSuper:{value:0},uFreeze:{value:0},uR:{value:.4},uSize:{value:1},uLift:{value:.6},uVel:{value:new THREE.Vector3()},uTeam:{value:new THREE.Color()},uNoise:{value:noiseTexture()}},
      vertexShader:`uniform float uSize,uLift;uniform vec3 uVel;varying vec2 vP;varying vec2 vDir;varying float vSpeed;
        void main(){
          vP=position.xy;
          vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);
          vec3 d=(viewMatrix*vec4(uVel,0.)).xyz;float s=length(d.xy);vDir=s>.01?d.xy/s:vec2(0.,1.);vSpeed=s;
          // Drawn just in front of the ball, so its flames wrap the ball's silhouette.
          c.xyz+=normalize(-c.xyz)*uLift;c.xy+=position.xy*uSize;
          gl_Position=projectionMatrix*c;
        }`,
      fragmentShader:`uniform float uHeat,uTime,uSuper,uFreeze,uR;uniform vec3 uTeam;uniform sampler2D uNoise;
        varying vec2 vP;varying vec2 vDir;varying float vSpeed;
        float h1(float n){return fract(sin(n)*43758.5453);}
        void main(){
          vec2 p=vP;float r=length(p),ang=atan(p.y,p.x),h=uHeat;
          float tail=max(dot(p/max(r,1e-4),-vDir),0.),stretch=clamp(vSpeed/28.,0.,1.);
          float n=texture2D(uNoise,vec2(ang*.32+uTime*.05,r*.9-uTime*1.7)).g,n2=texture2D(uNoise,vec2(ang*.95-uTime*.11,r*2.1-uTime*3.)).b;
          // Flames lick out past the ball and stream back along its flight, longer the hotter and faster it goes.
          float reach=uR*(1.12+h*.1)+tail*tail*stretch*(.25+h*.07)+(n*.65+n2*.35-.5)*(.16+h*.05);
          float flame=1.-smoothstep(reach-.06,reach+.02,r),outside=smoothstep(uR*.82,uR*1.04,r);
          vec3 rgb=vec3(0.);float cover=0.;
          // One: a warm halo.
          rgb+=vec3(1.,.55,.2)*exp(-max(r-uR,0.)*7.)*outside*smoothstep(.6,1.2,h)*(1.-smoothstep(2.,2.6,h))*.8;
          // Two and up: fire, yellow to orange at two, red at three, violet at four.
          vec3 core=mix(vec3(2.4,1.8,.7),vec3(2.6,.9,.25),smoothstep(1.,2.5,h));core=mix(core,vec3(2.6,.45,.18),smoothstep(2.5,3.2,h));core=mix(core,vec3(1.7,.8,3.),smoothstep(3.4,3.9,h));
          vec3 tip=mix(vec3(1.6,.35,.05),vec3(1.2,.06,.03),smoothstep(2.5,3.2,h));tip=mix(tip,vec3(.6,.15,1.6),smoothstep(3.4,3.9,h));
          float k=clamp((r-uR*.9)/max(reach-uR*.9,.01),0.,1.);
          rgb+=mix(core,tip,k)*flame*(.25+.75*outside)*smoothstep(1.6,2.2,h);
          // Three: black ink smoke at the flame's tips and rings of heat shimmer round it.
          float smoke=smoothstep(reach-.14,reach-.02,r)*flame*smoothstep(2.6,3.1,h)*(1.-smoothstep(3.4,3.9,h));
          rgb=mix(rgb,vec3(.02,.01,.01)*smoke,smoke*.8);cover+=smoke*.8;
          rgb+=vec3(1.,.8,.6)*pow(.5+.5*sin((r-uTime*.6)*38.+n*5.),18.)*smoothstep(reach,reach+.05,r)*(1.-smoothstep(.75,.98,r))*smoothstep(2.7,3.2,h)*.35;
          // Four, OVERDRIVE: a white heart and lightning striking out from it.
          float over=smoothstep(3.4,3.9,h);
          if(over>0.){
            float bolts=0.,frame=floor(uTime*18.);
            for(int i=0;i<3;i++){
              float fi=float(i),a0=h1(frame*1.7+fi*13.1)*6.2832;vec2 dir=vec2(cos(a0),sin(a0)),perp=vec2(-dir.y,dir.x);
              float along=dot(p,dir),jag=(texture2D(uNoise,vec2(along*1.3+fi*.37,frame*.073)).r-.5)*.22*along;
              bolts=max(bolts,(1.-smoothstep(.008,.035,abs(dot(p,perp)-jag)))*step(uR,along)*(1.-smoothstep(.75,.95,along)));
            }
            rgb+=vec3(2.2,1.9,3.2)*bolts*over+vec3(2.,1.7,2.8)*exp(-max(r-uR,0.)*14.)*outside*over*.9;
          }
          // A super shot: a pulsing ring and glow in the striker's colour.
          float pulse=.5+.5*sin(uTime*13.);
          rgb+=uTeam*((1.-smoothstep(.03,.09,abs(r-uR*(1.55+.12*pulse))))*2.4+exp(-max(r-uR,0.)*5.)*outside*.9)*uSuper*(1.+pulse*.5);
          rgb*=1.-smoothstep(.9,1.,r);
          rgb=mix(rgb,vec3(dot(rgb,vec3(.3,.59,.11))*.8),uFreeze);
          gl_FragColor=vec4(rgb,cover);
        }`,
    });
    this.aura=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.auraMaterial);this.aura.name='Ball heat aura';this.aura.frustumCulled=false;this.aura.renderOrder=11;this.aura.visible=false;
    this.ball.add(this.spinner,this.aura);this.ball.name='Ball';
    const ribbon=(style:number)=>new THREE.ShaderMaterial({
      name:style?'Ball super trail':'Ball trail',...PREMULTIPLIED,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{uStyle:{value:style},uHeat:{value:0},uTime:this.time,uNoise:{value:noiseTexture()}},
      vertexShader:`attribute vec4 aColor;varying vec4 vColor;varying vec2 vUv;void main(){vColor=aColor;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uStyle,uHeat,uTime;uniform sampler2D uNoise;varying vec4 vColor;varying vec2 vUv;
        void main(){
          float across=abs(vUv.y*2.-1.),a=vColor.a;
          if(uStyle<.5){
            // A solid band in the striker's colour, an ink edge, a white-hot core as the ball heats.
            float body=1.-smoothstep(.9,1.,across),ink=smoothstep(.72,.8,across)*body,core=1.-smoothstep(0.,.18+uHeat*.08,across);
            vec3 c=mix(vColor.rgb*1.35,vec3(2.4,2.3,2.2),core*(.25+uHeat*.15));
            c=mix(c,vColor.rgb*.12,ink*.85);
            float A=body*a;gl_FragColor=vec4(c*A,A);
          }else{
            // The super shot's mantle: flames licking off a band three times as wide, added light.
            float n=texture2D(uNoise,vec2(vUv.x*2.5-uTime*1.6,vUv.y*.7+uTime*.3)).g;
            float flame=1.-smoothstep(.35+n*.55,.5+n*.6,across);
            gl_FragColor=vec4((vColor.rgb*2.2+vec3(.6)*(1.-across))*flame*a,0.);
          }
        }`,
    });
    this.ribbon=new Ribbon(ribbon(0),'Ball trail');this.superTrail=new Ribbon(ribbon(1),'Ball super trail');this.superTrail.mesh.visible=false;
    this.root.add(this.ball,this.ribbon.mesh,this.superTrail.mesh,this.fx.mesh);
  }

  /** Where the ball is drawn now - smoothed and run on from its snapshot - or null when no ball is up. The vector is
   *  this field's own and changes every frame: copy it to keep it. */
  ballPosition():THREE.Vector3|null{return this.shown?this.drawn:null;}

  /** Every frame. `now` is the page's clock in milliseconds (performance.now(), as main.ts passes it); `dt` the frame's
   *  seconds. Hides everything when the snapshot carries no ball. */
  update(snapshot:GameSnapshot|null|undefined,selfId:string,camera:THREE.Camera,dt:number,now:number){
    const view=ballOf(snapshot);
    if(!view||!snapshot){if(this.root.visible||this.shown)this.clear();return;}
    const seconds=now/1000,step=Math.min(Math.max(dt,0),.1),serverTime=snapshot.serverTime;
    if(view.mode!==this.mode||view.startedAt!==this.startedAt||serverTime<this.lastServer-.5)this.restart(view);
    this.lastServer=serverTime;this.root.visible=true;
    this.receive(view.ball,serverTime,seconds);
    this.place(serverTime,seconds);
    this.moments(view,serverTime);
    this.dress(view,selfId,camera,step,seconds,serverTime);
    this.charms.update(view,snapshot.players,this.shown?this.drawn:null,step,serverTime);
    // FEVER (Sky Spike) and OVERTIME (Goal Rush): the place at its peak while they last, the crowd on its feet.
    const peak=(view.mode==='sky-spike'?view.fever:view.overtime)&&view.phase!=='over'?1:0;
    arenaMood.value+=(peak-arenaMood.value)*Math.min(1,step*2.5);
    crowdHype.value=Math.max(arenaMood.value*.45,crowdHype.value-step*.3);
  }

  /** Lets everything go: the ball hidden, every effect and the trail gone, the snapshots forgotten. */
  clear(){
    this.root.visible=false;this.shown=false;this.fx.clear();this.charms.clear();crowdHype.value=0;arenaMood.value=0;this.trail.count=0;this.ribbon.clear();this.superTrail.clear();
    this.mode=null;this.startedAt=NaN;this.lastServer=-Infinity;this.baseServer=-1;this.prevServer=-1;this.lastRef=null;this.lastEvent=-1;
    this.offset.set(0,0,0);this.velocity.set(0,0,0);this.land.show=false;this.frozen=false;this.heat=0;this.flash=0;
  }

  dispose(){
    this.clear();this.charms.dispose();this.root.removeFromParent();
    this.sphere.dispose();this.aura.geometry.dispose();this.fx.mesh.geometry.dispose();this.ribbon.mesh.geometry.dispose();this.superTrail.mesh.geometry.dispose();
    for(const m of [this.bodyMaterial,this.outlineMaterial,this.auraMaterial,this.fx.mesh.material,this.ribbon.mesh.material,this.superTrail.mesh.material])m.dispose();
  }

  /** A new match, or a new mode: the ball at its size and in its make, nothing carried over. */
  private restart(view:BallView){
    this.clear();this.mode=view.mode;this.startedAt=view.startedAt;this.root.visible=true;
    this.ball.scale.setScalar(ballRadius(view.mode));this.bodyMaterial.uniforms.uKind.value=view.mode==='goal-rush'?0:1;
  }

  /** A ball from the room, if it is a new one: kept with the one before it, the drawn ball's lead over it kept as a
   *  correction to blend out, its landing forecast, and any rebound it took read from its change of flight. */
  private receive(b:BallState,serverTime:number,seconds:number){
    if(b===this.lastRef)return;this.lastRef=b;
    // A presented frame can carry the same ball under a later time: nothing new.
    if(this.baseServer>=0&&sameBall(b,this.base))return;
    const had=this.baseServer>=0;
    copyBall(this.prev,this.base);this.prevServer=this.baseServer;
    copyBall(this.base,b);this.baseServer=serverTime;this.baseAt=seconds;
    this.forecast();
    if(!had||!this.shown){this.offset.set(0,0,0);this.drawn.set(b.x,b.y,b.z);return;}
    const p=this.prev,jump=Math.hypot(b.x-p.x,b.y-p.y,b.z-p.z),flight=p.held?0:Math.hypot(p.vx,p.vy,p.vz)*Math.max(.05,serverTime-this.prevServer);
    if(jump>SNAP+flight*1.5){this.offset.set(0,0,0);this.drawn.set(b.x,b.y,b.z);this.trail.count=0;return;}
    this.offset.set(this.drawn.x-b.x,this.drawn.y-b.y,this.drawn.z-b.z);
    if(this.offset.lengthSq()>SNAP*SNAP)this.offset.set(0,0,0);
    this.rebounds();
  }

  /** The drawn ball: the last snapshot run on along its flight by its age, plus what is left of the correction. Its
   *  age is the presented clock's when that runs on (CombatTimeline), else the page's since it arrived. */
  private place(serverTime:number,seconds:number){
    const b=this.base,frozen=b.frozenUntil>serverTime;
    if(frozen&&!this.frozen){this.freezeFrom=serverTime;this.freezeLength=Math.max(.2,b.frozenUntil-serverTime);}
    this.frozen=frozen;
    let x=b.x,y=b.y,z=b.z;
    if(b.held||frozen||b.clash>serverTime)this.velocity.set(0,0,0);
    else{
      const server=serverTime-this.baseServer,age=Math.min(AHEAD,Math.max(0,server>1e-4?server:seconds-this.baseAt));
      copyBall(this.sim,b);this.sim.held=false;
      for(let left=age;left>1e-5;left-=1/60)stepBall(this.mode!,this.sim,Math.min(1/60,left),this.contacts);
      x=this.sim.x;y=this.sim.y;z=this.sim.z;this.velocity.set(this.sim.vx,this.sim.vy,this.sim.vz);
    }
    const k=Math.exp(-Math.max(0,seconds-this.baseAt)/(b.held?.05:BLEND));
    this.drawn.set(x+this.offset.x*k,y+this.offset.y*k,z+this.offset.z*k);
    this.shown=true;
  }

  /** Where a ball in the air will come down (physics.ts landing), once a snapshot: Sky Spike's in whose court. */
  private forecast(){
    const b=this.base,mode=this.mode!,r=ballRadius(mode),land=this.land;
    land.show=false;
    if(b.held||b.y<(mode==='goal-rush'?2:r+.4))return;
    const l=landing(mode,b);
    const R=mode==='goal-rush'?GOAL_RULES:SPIKE_RULES;
    if(l.t<.08||Math.abs(l.x)>R.halfX-r||Math.abs(l.z)>R.halfZ-r)return;
    land.x=l.x;land.z=l.z;land.t=l.t;land.show=true;land.team=mode==='sky-spike'?courtSide(l.x,l.z)??null:null;
  }

  /** A wall, the dome or the floor the ball rebounded off since the last snapshot: its velocity turned round there. */
  private rebounds(){
    const p=this.prev,b=this.base,mode=this.mode!,r=ballRadius(mode),R=mode==='goal-rush'?GOAL_RULES:SPIKE_RULES;
    if(p.held||b.held||Math.hypot(p.vx,p.vy,p.vz)<7)return;
    const dome=mode==='sky-spike',inMouth=!dome&&Math.abs(b.x)<GOAL_RULES.goalHalfWidth&&b.y<GOAL_RULES.goalHeight;
    if(p.vx*b.vx<0&&Math.abs(b.x)>R.halfX-r-.6)this.wall(Math.sign(p.vx)*R.halfX,b.y,b.z,Math.abs(p.vx),dome);
    if(p.vz*b.vz<0&&Math.abs(b.z)>R.halfZ-r-.6&&!inMouth)this.wall(b.x,b.y,Math.sign(p.vz)*R.halfZ,Math.abs(p.vz),dome);
    if(p.vy<-6&&b.vy>0&&b.y<r+.8)this.floor(b.x,b.z,-p.vy);
  }

  private moments(view:BallView,serverTime:number){
    const events=view.events;
    for(let i=0;i<events.length;i++){
      const e=events[i];if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;
      // Only what is happening now: a page that joins late, or hitches, does not replay a backlog.
      if(serverTime-e.at>1.2)continue;
      this.moment(e,view);
    }
  }

  private dress(view:BallView,selfId:string,camera:THREE.Camera,dt:number,seconds:number,serverTime:number){
    // RUMBLE's GIANT BALL swells it (and lets it go) over a few frames.
    this.grown+=((this.base.size||1)-this.grown)*Math.min(1,dt*6);
    const b=this.base,r=ballRadius(view.mode)*this.grown,frozen=this.frozen,speed=this.velocity.length(),fx=this.fx;
    this.ball.scale.setScalar(r);
    if(!frozen)this.time.value+=dt;
    this.heat+=(b.heat-this.heat)*Math.min(1,dt*8);this.flash=Math.max(0,this.flash-dt*6);
    const tier=heatTier(this.heat+.05),team=b.lastTeam?TEAM[b.lastTeam]:NEUTRAL,hot=!frozen&&!b.held;
    this.ball.position.copy(this.drawn);this.ball.visible=true;
    // The spin the room sent, and the roll: on the floor it rolls true (up x v / r), in the air a little topspin.
    if(!frozen){
      if(b.held)this.omega.set(0,1.2,0);
      else{const roll=this.drawn.y<=r+.06?1:.35;this.omega.set(b.sx+this.velocity.z/r*roll,b.sy,b.sz-this.velocity.x/r*roll);}
      const rate=this.omega.length();
      if(rate>1e-4){this.axis.copy(this.omega).divideScalar(rate);this.turn.setFromAxisAngle(this.axis,rate*dt);this.spinner.quaternion.premultiply(this.turn);}
    }
    const u=this.bodyMaterial.uniforms;
    u.uHeat.value=this.heat;u.uFreeze.value=frozen?1:0;u.uSuper.value=b.super?1:0;u.uFlash.value=this.flash;(u.uTeam.value as THREE.Color).copy(team);
    // A CLASH holds it: white-hot and shuddering, throwing both sides' sparks, lightning crawling over it.
    if(b.clash>serverTime){
      u.uFlash.value=Math.max(this.flash,.55+.45*Math.sin(seconds*44));
      this.ball.position.x+=(Math.random()-.5)*r*.18;this.ball.position.y+=(Math.random()-.5)*r*.18;this.ball.position.z+=(Math.random()-.5)*r*.18;
      const n=Math.max(1,Math.round(3*VFX.spriteGain));
      for(let i=0;i<n;i++){const d=this.randomDirection(9+Math.random()*7),o=fx.spawn(K.spark,this.drawn.x,this.drawn.y,this.drawn.z,d.x,d.y,d.z,.35,r*.24,r*.08,Math.random()<.5?TEAM.red:TEAM.blue,1);fx.data[o+DRAG]=2.4;fx.data[o+STRETCH]=3;fx.data[o+FLAGS]=ALONG_FLIGHT;}
      if(Math.random()<.5){const ax=Math.random()-.5,ay=Math.random()-.5,az=Math.random()-.5,l=Math.hypot(ax,ay,az)||1,reach=r*(2+Math.random()*2);
        const o=fx.spawn(K.bolt,this.drawn.x+ax/l*reach*.6,this.drawn.y+ay/l*reach*.6,this.drawn.z+az/l*reach*.6,0,0,0,.08,r*.4,r*.4,WHITE,1);
        fx.data[o+FLAGS]=ALONG_AXIS;fx.data[o+AX]=ax/l;fx.data[o+AY]=ay/l;fx.data[o+AZ]=az/l;fx.data[o+STRETCH]=reach/(r*.4)*.6;}
    }
    this.outlineMaterial.color.setHex(frozen?0xf2f2f4:0x050506);
    const a=this.auraMaterial.uniforms,size=r*(2.8+tier*.5)+(b.super?r*1.2:0);
    this.aura.visible=this.heat>=.9||b.super;
    a.uHeat.value=this.heat;a.uSuper.value=b.super?1:0;a.uFreeze.value=frozen?1:0;a.uSize.value=size;a.uR.value=r/size;a.uLift.value=r*1.05;
    (a.uVel.value as THREE.Vector3).copy(this.velocity);(a.uTeam.value as THREE.Color).copy(team);
    // The trail: a point wherever the ball has gone a fifth of a metre, the newest following it every frame, the
    // oldest let go after its life; wider for a faster, hotter ball, nothing at a roll.
    const life=.3+tier*.06+(b.super?.25:0),width=Math.min(1,Math.max(0,(speed-3)/14))*r*2*(1+tier*.22)*(b.super?1.35:1);
    if(!frozen){
      this.trailClock+=dt;const trail=this.trail;
      if(trail.count<2){trail.push(this.drawn,this.trailClock,width,team);trail.push(this.drawn,this.trailClock,width,team);}
      else{
        const s=trail.slot(1),d=Math.hypot(this.drawn.x-trail.x[s],this.drawn.y-trail.y[s],this.drawn.z-trail.z[s]);
        if(d>.2)trail.push(this.drawn,this.trailClock,width,team);else trail.set(0,this.drawn,this.trailClock,width,team);
      }
      while(trail.count>2&&this.trailClock-trail.t[trail.slot(trail.count-1)]>life)trail.count--;
    }
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    this.ribbon.mesh.material.uniforms.uHeat.value=this.heat/4;
    this.ribbon.build(this.trail,this.eye,this.trailClock,life,1);
    this.superTrail.mesh.visible=b.super;if(b.super)this.superTrail.build(this.trail,this.eye,this.trailClock,life,2.6);
    // What a hot ball throws off: embers from two, sparks from three, lightning at four; white streaks when it flies.
    const vx=this.velocity.x,vy=this.velocity.y,vz=this.velocity.z,{x,y,z}=this.drawn,gain=VFX.spriteGain;
    if(hot){
      this.embers+=(tier>=2?14:0)*dt*gain;this.sparks+=(tier>=3?(tier>=4?70:42):0)*dt*gain;this.bolts+=(tier>=4?16:0)*dt*gain;
      this.streaks+=(speed>16?Math.min(60,(speed-14)*2.2):0)*dt*VFX.speedLines;
      for(;this.embers>=1;this.embers--){const o=fx.spawn(K.spark,x,y,z,-vx*.08+(Math.random()-.5)*2,-vy*.08+Math.random()*2.5,-vz*.08+(Math.random()-.5)*2,.5,r*.22,r*.08,tier>=4?PINK:GOLD,.9);fx.data[o+DRAG]=1.5;}
      for(;this.sparks>=1;this.sparks--){
        const o=fx.spawn(K.spark,x+(Math.random()-.5)*r,y+(Math.random()-.5)*r,z+(Math.random()-.5)*r,-vx*.18+(Math.random()-.5)*7,-vy*.18+(Math.random()-.2)*7,-vz*.18+(Math.random()-.5)*7,.32,r*.2,r*.1,tier>=4?(Math.random()<.5?WHITE:PINK):this.tint.setRGB(1,.35+Math.random()*.4,.1),1);
        fx.data[o+GRAV]=9;fx.data[o+DRAG]=2;fx.data[o+STRETCH]=3;fx.data[o+FLAGS]=ALONG_FLIGHT;
      }
      for(;this.bolts>=1;this.bolts--){
        const ax=Math.random()-.5,ay=Math.random()-.5,az=Math.random()-.5,l=Math.hypot(ax,ay,az)||1,reach=r*(1.6+Math.random()*1.4);
        const o=fx.spawn(K.bolt,x+ax/l*reach*.6,y+ay/l*reach*.6,z+az/l*reach*.6,vx*.6,vy*.6,vz*.6,.09,r*.35,r*.35,this.tint.setRGB(.7,.45,1),1);
        fx.data[o+FLAGS]=ALONG_AXIS;fx.data[o+AX]=ax/l;fx.data[o+AY]=ay/l;fx.data[o+AZ]=az/l;fx.data[o+STRETCH]=reach/(r*.35)*.6;
      }
      for(;this.streaks>=1;this.streaks--){
        // Lines left in the air round the ball's path, square to its flight, the ball rushing on past them.
        const s=Math.max(speed,1),dx=vx/s,dy=vy/s,dz=vz/s;let px=-dz,py=0,pz=dx;if(Math.abs(dy)>.9){px=1;py=0;pz=0;}
        const pl=Math.hypot(px,py,pz)||1,qx=dy*pz/pl-dz*py/pl,qy=dz*px/pl-dx*pz/pl,qz=dx*py/pl-dy*px/pl,an=Math.random()*Math.PI*2,rad=r*(1.3+Math.random()*1.8);
        const o=fx.spawn(K.streak,x+(px/pl*Math.cos(an)+qx*Math.sin(an))*rad-dx*r,y+(py/pl*Math.cos(an)+qy*Math.sin(an))*rad-dy*r,z+(pz/pl*Math.cos(an)+qz*Math.sin(an))*rad-dz*r,0,0,0,.16,r*.09,r*.09,WHITE,.75);
        fx.data[o+FLAGS]=ALONG_AXIS;fx.data[o+AX]=dx;fx.data[o+AY]=dy;fx.data[o+AZ]=dz;fx.data[o+STRETCH]=Math.min(70,speed*.9);
      }
      if(b.super&&this.time.value>=this.pulseAt){this.pulseAt=this.time.value+.14;fx.spawn(K.ring,x,y,z,vx*.3,vy*.3,vz*.3,.42,r*1.2,r*4,team,.9);}
    }else this.embers=this.sparks=this.bolts=this.streaks=0;
    fx.step(frozen?0:dt);
    fx.begin();
    // The shadow straight under the ball, softer and wider the higher it is; a fine ring to find it by when high.
    const height=Math.max(0,y-r);
    fx.put(K.shadow,x,.035,z,r*(1.15+height*.06),INK,.55/(1+height*.22),Math.min(1,Math.max(0,(height-1.5)/4))*.6);
    // Where it comes down, closing in as it falls: Sky Spike's in the colour of the court it lands in (urgent on your
    // own side), a cross when it lands out; Goal Rush's a quiet ring.
    const land=this.land,left=land.t-Math.max(0,seconds-this.baseAt);
    if(land.show&&!b.held&&!frozen&&left>0){
      let mine=false;for(let i=0;i<view.seats.length;i++)if(view.seats[i].id===selfId){mine=!!land.team&&view.seats[i].team===land.team;break;}
      const spike=view.mode==='sky-spike',colour=spike?land.team?TEAM[land.team]:WHITE:PALE,pulse=mine?.75+.25*Math.sin(seconds*22):1;
      fx.put(K.landing,land.x,.045,land.z,(r*1.6+Math.min(left,1.6)*2.2)*(mine?1.12:1),colour,(spike?.95:.5)*pulse,0,spike&&!land.team?1:0,0,seconds*1.4,.5);
    }
    fx.layer(0);fx.layer(1);
    // The stopped clock round a ball whose time has stopped, the time left running down its rim.
    if(frozen)fx.put(K.clock,x,y,z,r*3.2,CLOCK,1,-seconds*6,0,Math.max(0,Math.min(1,(b.frozenUntil-serverTime)/this.freezeLength)),0,0);
    fx.layer(2);fx.end();
  }

  // ---------------------------------------------------------------- moments

  private moment(e:BallEvent,view:BallView){
    // The crowd: on its feet for a goal, up for a clash, a save, a post, a super shot.
    const hype=({goal:1,'own-goal':1,clash:.75,super:.7,save:.55,perfect:.55,post:.5,shield:.6,win:1} as Partial<Record<BallEvent['kind'],number>>)[e.kind];
    if(hype)crowdHype.value=Math.max(crowdHype.value,hype);
    const team=e.team?TEAM[e.team]:WHITE,n=(k:number)=>Math.max(1,Math.round(k*VFX.spriteGain)),r=ballRadius(view.mode);
    switch(e.kind){
      case 'goal':case 'own-goal':{
        // A huge ink explosion at the goal, thrown out toward the pitch, and confetti in the scorers' colour.
        const sz=Math.sign(e.z)||1,x=e.x,y=Math.max(1.4,Math.min(e.y,GOAL_RULES.goalHeight-.6)),z=e.z;
        this.fx.spawn(K.burst,x,y,z,0,0,0,.75,3,11,team,1);this.fx.spawn(K.glint,x,y,z,0,0,0,.4,9,4,WHITE,1);
        this.fx.spawn(K.ring,x,y,z,0,0,0,.6,4,15,WHITE,1);this.fx.spawn(K.ring,x,y,z,0,0,0,.95,6,20,team,1);
        this.fx.spawn(K.groundRing,x,.06,z-sz*2,0,0,0,1.1,3,18,team,1);
        for(let i=0;i<n(26);i++){const a=Math.random()*Math.PI*2,s=4+Math.random()*10,o=this.fx.spawn(K.smoke,x,y*.7,z,Math.cos(a)*s*.8,2+Math.random()*7,-sz*Math.abs(Math.sin(a))*s,1.4+Math.random()*.9,1.6,3.4+Math.random()*1.6,INK,.95);this.fx.data[o+DRAG]=2.2;}
        for(let i=0;i<n(110);i++){
          const roll=Math.random(),o=this.fx.spawn(K.confetti,x+(Math.random()-.5)*4,y,z,(Math.random()-.5)*18,10+Math.random()*11,-sz*(3+Math.random()*10),3+Math.random()*1.6,.16+Math.random()*.08,.16,roll<.6?team:roll<.85?WHITE:GOLD,1);
          const d=this.fx.data;d[o+GRAV]=9;d[o+DRAG]=1.4;d[o+FLAGS]=FLUTTER|FLOOR;d[o+SPIN]=(Math.random()-.5)*14;
        }
        this.chips(x,y,z,n(16),INK,14);this.sparkle(x,y,z,n(24),team,16);
        break;
      }
      case 'post':{
        // The clang: a white glint, sparks flying off the iron, a ring.
        this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.3,2.6,1,WHITE,1);this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.35,.6,3.2,WHITE,1);
        this.sparkle(e.x,e.y,e.z,n(18),GOLD,14);this.puffs(e.x,e.y,e.z,2,INK,.5,1.3,3);this.flash=1;
        break;
      }
      case 'save':case 'perfect':case 'block':{
        // A guard: a white shield flashing out (a perfect one gold, and bigger).
        const perfect=e.kind==='perfect'||e.text==='PERFECT SAVE',c=perfect?GOLD:PALE;
        this.fx.spawn(K.shield,e.x,e.y,e.z,0,0,0,.45,perfect?3.6:2.8,perfect?4.6:3.4,c,1);this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.4,.6,4,WHITE,1);
        this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.25,2.2,.8,WHITE,1);this.sparkle(e.x,e.y,e.z,n(10),WHITE,10);
        if(perfect)this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.35,1.4,3.4,GOLD,1);
        this.flash=1;break;
      }
      case 'clash':{
        // A CLASH: a white-hot flash, both sides' colours thrown out in rings, sparks and ink, the floor shaken.
        const lost=view.seats.find(s=>s.id===e.targetId)?.team,other=lost?TEAM[lost]:WHITE;
        this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.5,4.5,2,WHITE,1);this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.55,1.4,6.5,WHITE,1);
        this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.5,.8,8,team,1);this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.75,.8,11,other,1);
        this.fx.spawn(K.groundRing,e.x,.06,e.z,0,0,0,.9,1.5,13,WHITE,1);
        this.sparkle(e.x,e.y,e.z,n(30),team,18);this.sparkle(e.x,e.y,e.z,n(30),other,18);this.puffs(e.x,e.y,e.z,n(6),INK,.8,2.4,6);this.chips(e.x,e.y,e.z,n(10),INK,12);
        this.flash=1;break;
      }
      case 'charm':case 'shield':{
        // RUMBLE: a charm taken (a burst in its colour where it lay), or an IRON WALL / SAFETY NET holding (a shield).
        const c=new THREE.Color(e.charm?CHARM_COLOURS[e.charm]:0xffffff);
        if(e.kind==='charm'){this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.4,.8,3.2,c,1);this.fx.spawn(K.ring,e.x,.3,e.z,0,0,0,.45,.6,4.2,c,1);this.fx.spawn(K.groundRing,e.x,.06,e.z,0,0,0,.6,1,4.6,c,1);this.sparkle(e.x,e.y,e.z,n(16),c,9);}
        else{this.fx.spawn(K.shield,e.x,Math.max(1,e.y),e.z,0,0,0,.5,3,5.2,team,1);this.fx.spawn(K.ring,e.x,Math.max(1,e.y),e.z,0,0,0,.45,.8,5,WHITE,1);this.sparkle(e.x,Math.max(1,e.y),e.z,n(20),team,13);this.flash=1;}
        break;
      }
      case 'strike':{
        // A blow on the ball: an ink starburst and puffs, bigger for a harder shot.
        const s=Math.min(1.2,Math.max(.2,(e.value??15)/40));
        this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.32,.6,1.2+2.2*s,team,1);this.puffs(e.x,e.y,e.z,n(3+5*s),INK,.5,1.4,4*s);
        if((e.value??0)>24)this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.3,.5,3.5*s,WHITE,.9);
        this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.18,1+s,.4,WHITE,.8);this.flash=Math.max(this.flash,.6);
        break;
      }
      case 'super':{
        // An ultimate on the ball: a big flash, two shockwaves and one along the floor.
        this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.6,2,7,team,1);this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.4,8,3,WHITE,1);
        this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.7,3,16,team,1);this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.5,2,11,WHITE,1);
        this.fx.spawn(K.groundRing,e.x,.06,e.z,0,0,0,.9,2,15,team,1);
        this.sparkle(e.x,e.y,e.z,n(30),team,18);this.puffs(e.x,e.y,e.z,n(10),INK,.9,2.4,7);this.flash=1;
        break;
      }
      case 'bowled':case 'demo':{
        // A body knocked flat by a hot ball: dust thrown out round it, chips, a small white burst.
        this.fx.spawn(K.dust,e.x,.06,e.z,0,0,0,.8,1,5.5,DUST,.9);this.puffs(e.x,.4,e.z,n(10),DUST,.8,2,5);
        this.chips(e.x,.6,e.z,n(10),INK,8);this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.25,.6,2.2,team,1);this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.25,2,.6,WHITE,1);
        break;
      }
      case 'kill':case 'ace':case 'point':{
        // A point won where the ball came down: an ink crater rimmed in the winners' colour, ink thrown up, a ring.
        const big=e.kind==='ace'?1.3:e.kind==='point'?.75:1,x=e.x,z=e.z;
        this.fx.spawn(K.splat,x,.05,z,0,0,0,2.6,4*big,4.6*big,team,1);
        this.fx.spawn(K.groundRing,x,.07,z,0,0,0,.8,1,9*big,team,1);this.fx.spawn(K.burst,x,.7,z,0,0,0,.4,1,3.2*big,team,1);
        for(let i=0;i<n(12*big);i++){const a=Math.random()*Math.PI*2,s=1.5+Math.random()*3,p=this.fx.spawn(K.smoke,x,.4,z,Math.cos(a)*s,3+Math.random()*6,Math.sin(a)*s,1+Math.random()*.4,.5,1.4+Math.random(),INK,.95);this.fx.data[p+DRAG]=2.5;this.fx.data[p+GRAV]=3;}
        this.chips(x,.3,z,n(12*big),view.mode==='sky-spike'?WOOD:INK,7);
        if(e.kind==='ace')this.fx.spawn(K.glint,x,1.2,z,0,0,0,.45,5,2,WHITE,1);
        break;
      }
      case 'out':this.fx.spawn(K.dust,e.x,.06,e.z,0,0,0,.7,.8,3.2,DUST,.8);this.puffs(e.x,.3,e.z,n(4),DUST,.5,1.3,2.5);break;
      case 'net':this.fx.spawn(K.ring,e.x,e.y,0,0,0,0,.35,.4,2.5,WHITE,.9);this.puffs(e.x,e.y,0,n(3),PALE,.3,.9,2);break;
      case 'rally':this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.5,1,4.5,GOLD,1);this.fx.spawn(K.glint,e.x,e.y,e.z,0,0,0,.35,3,1,GOLD,1);break;
      case 'fever':{
        // FEVER: petals burst from the ball and blow in off all four trees.
        this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.8,2,12,PINK,1);
        for(let i=0;i<n(70);i++){const v=this.randomDirection(4+Math.random()*7),o=this.fx.spawn(K.petal,e.x,e.y,e.z,v.x,v.y,v.z,3+Math.random()*1.5,.2,.18,PINK,1);const d=this.fx.data;d[o+DRAG]=1.8;d[o+GRAV]=1.2;d[o+FLAGS]=FLUTTER;d[o+SPIN]=(Math.random()-.5)*8;}
        for(const [tx,tz] of TREES)for(let i=0;i<n(12);i++){const o=this.fx.spawn(K.petal,tx,5+Math.random()*2,tz,-tx*(.2+Math.random()*.25),Math.random(),-tz*(.2+Math.random()*.25),3.5+Math.random(),.2,.18,PINK,1);const d=this.fx.data;d[o+DRAG]=.6;d[o+GRAV]=.8;d[o+FLAGS]=FLUTTER;d[o+SPIN]=(Math.random()-.5)*8;}
        break;
      }
      case 'kickoff':this.fx.spawn(K.groundRing,0,.06,0,0,0,0,1,2,12,WHITE,.8);break;
      case 'serve':this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.35,r*1.5,r*6,WHITE,.8);break;
      case 'win':{
        // The final whistle: confetti over the whole arena in the winners' colour.
        for(let i=0;i<n(140);i++){
          const roll=Math.random(),o=this.fx.spawn(K.confetti,(Math.random()-.5)*20,12+Math.random()*4,(Math.random()-.5)*28,(Math.random()-.5)*10,2+Math.random()*6,(Math.random()-.5)*10,4+Math.random()*2,.18,.18,roll<.65?team:roll<.85?WHITE:GOLD,1);
          const d=this.fx.data;d[o+GRAV]=6;d[o+DRAG]=1.5;d[o+FLAGS]=FLUTTER|FLOOR;d[o+SPIN]=(Math.random()-.5)*14;
        }
        break;
      }
      default:break;
    }
  }

  /** The ball off a wall: a hex ripple where it struck (the Ink Bowl's glass, the Sky Court's unseen dome), a ring. */
  private wall(x:number,y:number,z:number,speed:number,dome:boolean){
    const s=Math.min(1.4,speed/25);
    this.fx.spawn(K.shield,x,y,z,0,0,0,.4,1+s,2+s*2,dome?PINK:PALE,.85);this.fx.spawn(K.ring,x,y,z,0,0,0,.3,.4,1.6+s*2,WHITE,.8);
    this.puffs(x,y,z,Math.max(1,Math.round(2*VFX.spriteGain)),INK,.4,1,2);
  }
  /** The ball off the floor hard: a ring along it and a little dust. */
  private floor(x:number,z:number,speed:number){
    const s=Math.min(1.4,speed/18);
    this.fx.spawn(K.groundRing,x,.06,z,0,0,0,.45,.6,1.6+s*3,WHITE,.7);this.puffs(x,.3,z,Math.max(1,Math.round(3*s*VFX.spriteGain)),DUST,.4,1.1,2.5);
  }
  private puffs(x:number,y:number,z:number,count:number,colour:THREE.Color,size0:number,size1:number,speed:number){
    for(let i=0;i<count;i++){const v=this.randomDirection(speed*(.4+Math.random()*.6)),o=this.fx.spawn(K.smoke,x,y,z,v.x,v.y*.6+speed*.15,v.z,.6+Math.random()*.35,size0,size1*(.8+Math.random()*.4),colour,.95);this.fx.data[o+DRAG]=4;}
  }
  private sparkle(x:number,y:number,z:number,count:number,colour:THREE.Color,speed:number){
    for(let i=0;i<count;i++){const v=this.randomDirection(speed*(.5+Math.random()*.6)),o=this.fx.spawn(K.spark,x,y,z,v.x,v.y,v.z,.35+Math.random()*.2,.16,.06,Math.random()<.5?colour:WHITE,1);const d=this.fx.data;d[o+DRAG]=3;d[o+GRAV]=6;d[o+STRETCH]=3;d[o+FLAGS]=ALONG_FLIGHT;}
  }
  private chips(x:number,y:number,z:number,count:number,colour:THREE.Color,speed:number){
    for(let i=0;i<count;i++){const v=this.randomDirection(speed*(.4+Math.random()*.6)),o=this.fx.spawn(K.chunk,x,y,z,v.x,Math.abs(v.y)+speed*.3,v.z,1+Math.random()*.5,.18+Math.random()*.14,.12,colour,1);const d=this.fx.data;d[o+GRAV]=18;d[o+FLAGS]=FLOOR;d[o+SPIN]=(Math.random()-.5)*16;}
  }
  private readonly direction=new THREE.Vector3();
  private randomDirection(length:number){
    const u=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-u*u);
    return this.direction.set(Math.cos(a)*s*length,u*length,Math.sin(a)*s*length);
  }
}
