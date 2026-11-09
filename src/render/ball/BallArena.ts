import * as THREE from 'three';
import {arenaMood,crowdHype} from './hype';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BALL_TEAM_COLOURS,GOAL_RULES,SPIKE_RULES} from '../../game/ball/model';
import type {StageId} from '../../game/stages';
import {stageMaterial} from '../stages/build';
import {addShaderPatch} from '../look/shaderPatch';
import {noiseTexture} from '../vfx/noiseTexture';

export type BallStage=Extract<StageId,'ball-pitch'|'ball-court'>;
type V2=readonly [number,number];
type V3=readonly [number,number,number];

const RED=new THREE.Color(BALL_TEAM_COLOURS.red),BLUE=new THREE.Color(BALL_TEAM_COLOURS.blue);
/** An sRGB hex as the linear vec3 a shader works in. */
const lin=(hex:number)=>{const c=new THREE.Color(hex);return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;};
const num=(n:number)=>n.toFixed(4);
const fogged=(uniforms:Record<string,THREE.IUniform>)=>({...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),...uniforms});
const rng=(seed:number)=>{let s=seed;return ()=>(s=(s*16807)%2147483647)/2147483647;};

/** Antialiased line and box distances, shared by the painted floors. */
const FLOOR_GLSL=`
  float ballLine(float d,float w){float f=max(fwidth(d),1e-4);return 1.-smoothstep(w-f,w+f,abs(d));}
  float ballBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
  float ballEnso(vec2 p,float radius,float width){
    // A brush circle left open at one end, thickest halfway round: the ink mark of the place.
    float a=atan(p.y,p.x),t=fract((a+3.14159)/6.28318+.15);
    float w=width*pow(max(sin(min(t/.9,1.)*3.14159),0.),.55)*step(t,.9);
    return ballLine(length(p)-radius,w);
  }`;

/** Quads gathered into one flat geometry: corners a b c d in order round each quad, a uv per corner, and per-quad
 *  values - a colour, a team (0 red, 1 blue). Built once, so its small allocations never reach a frame. */
class Quads{
  private readonly position:number[]=[];private readonly normal:number[]=[];private readonly uv:number[]=[];
  private readonly color:number[]=[];private readonly team:number[]=[];private readonly panel:number[]=[];
  private readonly ab=new THREE.Vector3();private readonly ad=new THREE.Vector3();
  add(a:V3,b:V3,c:V3,d:V3,o:{uv?:readonly [number,number,number,number];color?:THREE.Color;team?:number}={}){
    const [u0,v0,u1,v1]=o.uv??[0,0,1,1],corners=[a,b,c,d],uvs:V2[]=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],panels:V2[]=[[0,0],[1,0],[1,1],[0,1]];
    this.ab.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);this.ad.set(d[0]-a[0],d[1]-a[1],d[2]-a[2]);const n=this.ab.cross(this.ad).normalize();
    for(const i of [0,1,2,0,2,3]){
      this.position.push(...corners[i]);this.normal.push(n.x,n.y,n.z);this.uv.push(...uvs[i]);this.panel.push(...panels[i]);
      const c=o.color??RED;this.color.push(c.r,c.g,c.b);this.team.push(o.team??0);
    }
  }
  geometry(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.normal,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(this.color,3));
    g.setAttribute('aTeam',new THREE.Float32BufferAttribute(this.team,1));g.setAttribute('aPanel',new THREE.Float32BufferAttribute(this.panel,2));
    g.computeBoundingSphere();return g;
  }
}

interface Part{geometry:THREE.BufferGeometry;color?:THREE.Color;bob?:number;
  /** A colour for each face, by its lowest corner's height (a floating island's moss over its rock). */
  faces?:(lowest:number)=>THREE.Color}
const WHITE=new THREE.Color(1,1,1);
/** Solid pieces merged into one draw: position and normal only, or with a colour (and a bob phase) each when the
 *  material reads them. */
function bake(parts:Part[],withColor=false,withBob=false){
  const flat=parts.map(({geometry,color,bob,faces})=>{
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();
    for(const key of Object.keys(g.attributes))if(key!=='position'&&key!=='normal')g.deleteAttribute(key);
    const p=g.getAttribute('position'),n=p.count;
    if(withColor){
      const data=new Float32Array(n*3);
      for(let i=0;i+2<n;i+=3){const c=faces?faces(Math.min(p.getY(i),p.getY(i+1),p.getY(i+2))):color??WHITE;for(let k=0;k<3;k++)data.set([c.r,c.g,c.b],(i+k)*3);}
      g.setAttribute('color',new THREE.BufferAttribute(data,3));
    }
    if(withBob)g.setAttribute('aBob',new THREE.BufferAttribute(new Float32Array(n).fill(bob??0),1));
    geometry.dispose();return g;
  });
  const merged=mergeGeometries(flat)!;flat.forEach(g=>g.dispose());return merged;
}

/** A box along the floor run a→b, from y0 to y1 and `depth` thick, its inner face `out` metres outside the run (the
 *  interior is on the run's left, as the pitch's runs go round it). */
function beam(a:V2,b:V2,y0:number,y1:number,depth:number,out=0){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=dz/len,nz=-dx/len;
  return new THREE.BoxGeometry(len,y1-y0,depth).rotateY(Math.atan2(-dz,dx))
    .translate((a[0]+b[0])/2+nx*(out+depth/2),(y0+y1)/2,(a[1]+b[1])/2+nz*(out+depth/2));
}
/** A cylinder from p to q. */
function rod(p:V3,q:V3,radius:number,sides=8,radius2=radius){
  const from=new THREE.Vector3(...p),to=new THREE.Vector3(...q),dir=to.clone().sub(from),len=dir.length();
  const g=new THREE.CylinderGeometry(radius2,radius,len,sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));
  return g.translate((p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2);
}
/** A convex outline pushed out by `d`, its corners mitred. Points in order with the interior on their left. */
function offsetRing(points:readonly V2[],d:number):V2[]{
  return points.map((p,i)=>{
    const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
    const e0x=p[0]-a[0],e0z=p[1]-a[1],l0=Math.hypot(e0x,e0z),e1x=b[0]-p[0],e1z=b[1]-p[1],l1=Math.hypot(e1x,e1z);
    const n0x=e0z/l0,n0z=-e0x/l0,n1x=e1z/l1,n1z=-e1x/l1,k=d/(1+n0x*n1x+n0z*n1z);
    return [p[0]+(n0x+n1x)*k,p[1]+(n0z+n1z)*k] as V2;
  });
}

/** A see-through wall: faint glass with a manga screentone thickening toward its foot, a fresnel edge, a slow sheen
 *  running along it, and each half's colour in its foot. Not a camera occluder: the lens sees through it. */
function glassMaterial(time:{value:number},height:number){
  return new THREE.ShaderMaterial({
    name:'Ball arena glass',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
    uniforms:fogged({uTime:time,uRed:{value:RED.clone()},uBlue:{value:BLUE.clone()},uHeight:{value:height}}),
    vertexShader:`attribute float aTeam;varying vec2 vUv;varying float vTeam;varying vec3 vN;varying vec3 vView;
      #include <fog_pars_vertex>
      void main(){vUv=uv;vTeam=aTeam;vec4 world=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vView=cameraPosition-world.xyz;
        vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform float uTime,uHeight;uniform vec3 uRed,uBlue;varying vec2 vUv;varying float vTeam;varying vec3 vN;varying vec3 vView;
      #include <fog_pars_fragment>
      void main(){
        vec3 team=mix(uRed,uBlue,vTeam);
        float y=clamp(vUv.y/uHeight,0.,1.);
        float facing=abs(dot(normalize(vN),normalize(vView)));
        float fres=pow(1.-facing,3.);
        vec2 g=fract(vUv*vec2(2.4,2.4))-.5;
        float dotR=.34*(1.-y)*(1.-y);
        float tone=1.-smoothstep(dotR-.05,dotR+.05,length(g));
        float sheen=smoothstep(.93,1.,1.-abs(fract((vUv.x+vUv.y*.7)*.035-uTime*.06)-.5)*2.);
        float foot=1.-smoothstep(.0,.16,y);
        vec3 col=mix(vec3(.72,.82,1.),team,.45+foot*.4);
        float a=.035+tone*.12+fres*.22+sheen*.18+foot*.16;
        gl_FragColor=vec4(col*(1.+sheen*.8+foot*.6),min(a,.6));
        #include <fog_fragment>
      }`,
  });
}

/** The two ball arenas (game/ball): Goal Rush's Ink Bowl and Sky Spike's Sky Court, built whole in code - nothing to
 *  download. Every measure the ball is judged by comes from GOAL_RULES and SPIKE_RULES (game/ball/model.ts), so a wall,
 *  a post or a line on the floor stands exactly where game/ball/physics.ts has the ball meet it. Drawn only: the walls
 *  and the net the ball bounces off live in the sim. The camera is kept out of the stands alone; the glass and the net
 *  are for seeing through. The sky is the stage's look (look/stageLooks.ts), painted by the renderer's dome. */
export class BallArena {
  readonly root=new THREE.Group();
  /** What the chase camera must not pass: the Ink Bowl's stand fronts (never the pitch glass); none on the court. */
  readonly occluders:THREE.Object3D[]=[];
  private readonly time={value:0};
  private built=false;
  constructor(readonly stage:BallStage){this.root.name=stage==='ball-pitch'?'Goal Rush · The Ink Bowl':'Sky Spike · The Sky Court';}

  async load(){
    if(this.built)return;this.built=true;
    if(this.stage==='ball-pitch'){this.turf();this.pitchWalls();this.goals();this.bowl();this.floodlights();}
    else{this.platform();this.net();this.barrier();this.trees();this.petals();this.cloudSea();this.islands();this.banners();this.lanterns();}
    this.root.updateMatrixWorld(true);
  }
  /** The petals' own clock: it runs faster in a FEVER rally (arenaMood), and a clock rather than a scaled time so the
   *  storm builds without a jump. */
  private readonly petalTime={value:0};private lastTime=NaN;
  update(time:number){
    const dt=Number.isFinite(this.lastTime)?Math.max(0,Math.min(.1,time-this.lastTime)):0;this.lastTime=time;
    this.time.value=time;this.petalTime.value+=dt*(1+arenaMood.value*2.4);
  }
  /** Everything here is the arena's own (the noise texture is shared and stays). Safe to call twice, and alongside
   *  StageEnvironment's own release of the root. */
  dispose(){
    this.root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.dispose();for(const m of [mesh.material].flat())m.dispose();});
  }

  private add(mesh:THREE.Mesh,name:string,shadow=false){mesh.name=name;mesh.receiveShadow=shadow;mesh.castShadow=false;this.root.add(mesh);return mesh;}

  // ---------------------------------------------------------------- The Ink Bowl (Goal Rush)

  /** The pitch's eight runs of wall, in order with the interior on their left: the long sides, the chamfered corners
   *  (GOAL_RULES.corner along each axis) and the end walls with the goals' mouths in them. */
  private static pitchRing():V2[]{
    const {halfX:X,halfZ:Z,corner:C}=GOAL_RULES;
    return [[X,-Z+C],[X,0],[X,Z-C],[X-C,Z],[-X+C,Z],[-X,Z-C],[-X,0],[-X,-Z+C],[-X+C,-Z],[X-C,-Z]];
  }

  private turf(){
    const {halfX:X,halfZ:Z,corner:C,goalHalfWidth:G,goalDepth:D}=GOAL_RULES;
    // The outline with both goals' floors in it, in the floor plane (a shape's y is world -z).
    const outline:V2[]=[[X,-Z+C],[X,Z-C],[X-C,Z],[G,Z],[G,Z+D],[-G,Z+D],[-G,Z],[-X+C,Z],[-X,Z-C],[-X,-Z+C],[-X+C,-Z],[-G,-Z],[-G,-Z-D],[G,-Z-D],[G,-Z],[X-C,-Z]];
    const geometry=new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z)))).rotateX(-Math.PI/2);
    const material=stageMaterial('ball-pitch','Ink Bowl turf',{color:0xffffff,roughness:.95});
    addShaderPatch(material,'ball-turf-v1',shader=>{
      shader.uniforms.uBallNoise={value:noiseTexture()};
      shader.vertexShader='varying vec3 vBallWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBallWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='varying vec3 vBallWorld;\nuniform sampler2D uBallNoise;\n'+FLOOR_GLSL+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 bp=vBallWorld.xz;
        // Mown stripes across the pitch and a fainter cross-cut, broken by the grass's own grain.
        float bStripe=mod(floor(bp.y/3.25+100.),2.),bCross=mod(floor(bp.x/3.6+100.),2.);
        float bGrain=texture2D(uBallNoise,bp*.045).r*.6+texture2D(uBallNoise,bp*.31).b*.4;
        vec3 bTurf=mix(${lin(0x255c2b)},${lin(0x3a8a3a)},bStripe*.78+bCross*.22)*(.84+bGrain*.3);
        // Each half faintly its side's colour, more toward its end, the goal floors most.
        vec3 bTeam=mix(${lin(BALL_TEAM_COLOURS.red)},${lin(BALL_TEAM_COLOURS.blue)},step(0.,bp.y));
        float bEnd=smoothstep(${num(Z-12)},${num(Z)},abs(bp.y))*.14+step(${num(Z)},abs(bp.y))*.3;
        bTurf=mix(bTurf,bTurf*(.5+bTeam*1.1),.08+bEnd);
        // The chalk: a border inside the walls, halfway line, centre circle and spot, both boxes, spots and arcs.
        float bW=.075+(texture2D(uBallNoise,bp*.7).a-.5)*.03;
        float bSd=max(max(abs(bp.x)-${num(X)},abs(bp.y)-${num(Z)}),(abs(bp.x)+abs(bp.y)-${num(X+Z-C)})*.70710678);
        float bIn=step(bSd,-.8),bR=length(bp);
        float bMarks=ballLine(bSd+.8,bW)*step(abs(bp.y),${num(Z)});
        bMarks=max(bMarks,ballLine(bp.y,bW)*bIn);
        bMarks=max(bMarks,ballLine(bR-6.,bW));
        bMarks=max(bMarks,1.-smoothstep(.22,.27,bR));
        float bIntoPitch=${num(Z-.8)}-abs(bp.y);
        bMarks=max(bMarks,ballLine(ballBox(vec2(bp.x,bIntoPitch-5.6),vec2(12.,5.6)),bW));
        bMarks=max(bMarks,ballLine(ballBox(vec2(bp.x,bIntoPitch-2.3),vec2(7.,2.3)),bW));
        bMarks=max(bMarks,1.-smoothstep(.2,.25,length(vec2(bp.x,bIntoPitch-8.))));
        bMarks=max(bMarks,ballLine(length(vec2(bp.x,bIntoPitch-8.))-5.,bW)*step(11.2,bIntoPitch));
        bMarks=max(bMarks,ballLine(abs(bp.y)-${num(Z)},bW)*step(abs(bp.x),${num(G)}));
        // The ink mark at the kickoff, under the chalk.
        bTurf=mix(bTurf,${lin(0x07080a)},ballEnso(bp,3.9,.42+(texture2D(uBallNoise,bp*.25).g-.5)*.15)*.72);
        bTurf=mix(bTurf,${lin(0xf2f0e8)},bMarks*.93);
        diffuseColor.rgb*=bTurf;`);
    });
    this.add(new THREE.Mesh(geometry,material),'Ink Bowl turf',true);
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(520,520).rotateX(-Math.PI/2),stageMaterial('ball-pitch','Ink Bowl concourse',{color:0x1a1c22}));
    apron.position.y=-.04;this.add(apron,'Ink Bowl concourse',true);
  }

  private pitchWalls(){
    const {halfZ:Z,goalHalfWidth:G,goalHeight:GH,wall:W}=GOAL_RULES;
    const ring=BallArena.pitchRing();
    // Each run of glass round the pitch, split at the halfway line so each half wears its colour; over each goal's
    // mouth the glass starts at the crossbar.
    const runs:{a:V2;b:V2;y0:number}[]=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      if(Math.abs(a[1])===Z&&a[1]===b[1]){const s=Math.sign(a[0]-b[0]);runs.push({a,b:[s*G,a[1]],y0:0},{a:[s*G,a[1]],b:[-s*G,a[1]],y0:GH},{a:[-s*G,a[1]],b,y0:0});}
      else runs.push({a,b,y0:0});
    }
    const glass=new Quads();let along=0;
    for(const {a,b,y0} of runs){
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]),team=(a[1]+b[1])/2<0?0:1;
      glass.add([a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],W,b[1]],[a[0],W,a[1]],{uv:[along,y0,along+len,W],team});along+=len;
    }
    const pane=this.add(new THREE.Mesh(glass.geometry(),glassMaterial(this.time,W)),'Ink Bowl glass');pane.renderOrder=2;
    // The ink-black frame outside the glass: a kickboard, the top rail, posts at every corner and every few metres.
    const frame:{geometry:THREE.BufferGeometry}[]=[],trim:{geometry:THREE.BufferGeometry;color:THREE.Color}[]=[];
    const glow=(team:number)=>(team?BLUE:RED).clone().multiplyScalar(1.9);
    for(const {a,b,y0} of runs){
      const team=(a[1]+b[1])/2<0?0:1,foot=y0>0?GH+.3:0;
      frame.push({geometry:beam(a,b,foot,foot+.55,.3)},{geometry:beam(a,b,W-.3,W+.15,.45)});
      trim.push({geometry:beam(a,b,foot+.55,foot+.66,.08),color:glow(team)},{geometry:beam(a,b,W-.44,W-.3,.08),color:glow(team)});
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]),posts=Math.max(1,Math.ceil(len/7));
      for(let k=0;k<posts;k++){
        const t=k/posts,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,ux=(b[0]-a[0])/len*.18,uz=(b[1]-a[1])/len*.18;
        // Not beside a goal's post, where it would stand in the mouth (the post is the frame there).
        if(y0===0&&Math.abs(Math.abs(x)-G)<.01&&Math.abs(Math.abs(z)-Z)<.01)continue;
        frame.push({geometry:beam([x-ux,z-uz],[x+ux,z+uz],y0,W,.34)});
      }
    }
    this.add(new THREE.Mesh(bake(frame),stageMaterial('ball-pitch','Ink Bowl frame',{color:0x111216,roughness:.6})),'Ink Bowl frame');
    this.add(new THREE.Mesh(bake(trim,true),new THREE.MeshBasicMaterial({vertexColors:true,name:'Ink Bowl trim'})),'Ink Bowl trim');
  }

  private goals(){
    const {halfZ:Z,goalHalfWidth:G,goalHeight:GH,goalDepth:D,post:P}=GOAL_RULES;
    const white:{geometry:THREE.BufferGeometry}[]=[],bands:{geometry:THREE.BufferGeometry;color:THREE.Color}[]=[],nets=new Quads();
    for(const sz of [-1,1]){
      const z=sz*Z,back=sz*(Z+D),team=sz<0?0:1,colour=(team?BLUE:RED).clone().multiplyScalar(1.7);
      // The frame the ball rings off (physics.ts: the posts and the bar are capsules of radius GOAL_RULES.post).
      for(const sx of [-1,1]){
        white.push({geometry:rod([sx*G,0,z],[sx*G,GH,z],P,14)});
        // The back frame, thin: uprights, the floor bar and the roof bars.
        white.push({geometry:rod([sx*G,0,back],[sx*G,GH,back],.09)},{geometry:rod([sx*G,GH,z],[sx*G,GH,back],.09)},{geometry:rod([sx*G,.05,z],[sx*G,.05,back],.07)});
        for(const y of [.35,1.1])bands.push({geometry:rod([sx*G,y,z],[sx*G,y+.32,z],P+.02,14),color:colour});
      }
      white.push({geometry:rod([-G-P,GH,z],[G+P,GH,z],P,14)},{geometry:rod([-G,GH,back],[G,GH,back],.09)},{geometry:rod([-G,.05,back],[G,.05,back],.07)});
      bands.push({geometry:rod([-.8,GH,z],[.8,GH,z],P+.02,14),color:colour});
      // The nets: the back, both sides and the roof, in the goal's own colour.
      nets.add([-G,0,back],[G,0,back],[G,GH,back],[-G,GH,back],{uv:[-G,0,G,GH],team});
      for(const sx of [-1,1])nets.add([sx*G,0,z],[sx*G,0,back],[sx*G,GH,back],[sx*G,GH,z],{uv:[0,0,D,GH],team});
      nets.add([-G,GH,z],[G,GH,z],[G,GH,back],[-G,GH,back],{uv:[-G,0,G,D],team});
    }
    const frame=this.add(new THREE.Mesh(bake(white),stageMaterial('ball-pitch','Goal frame',{color:0xf4f1ea,roughness:.5})),'Goal frames');frame.castShadow=true;
    this.add(new THREE.Mesh(bake(bands,true),new THREE.MeshBasicMaterial({vertexColors:true,name:'Goal bands'})),'Goal bands');
    const net=new THREE.ShaderMaterial({
      name:'Goal nets',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
      uniforms:fogged({uTime:this.time,uRed:{value:RED.clone()},uBlue:{value:BLUE.clone()}}),
      vertexShader:`attribute float aTeam;attribute vec2 aPanel;varying vec2 vUv;varying float vTeam;varying float vDeep;varying float vLens;
        uniform float uTime;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vTeam=aTeam;vec3 p=position;
          // A slow billow, pinned at every edge of its panel.
          float free=sin(aPanel.x*3.14159)*sin(aPanel.y*3.14159);
          p+=normal*free*(sin(uTime*1.3+uv.x*.9)*.06+.05);vDeep=free;
          vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;vLens=-mvPosition.z;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform vec3 uRed,uBlue;varying vec2 vUv;varying float vTeam;varying float vDeep;varying float vLens;
        #include <fog_pars_fragment>
        void main(){
          vec2 d=vec2(vUv.x+vUv.y,vUv.x-vUv.y)*2.6;
          vec2 q=abs(fract(d)-.5),fw=fwidth(d);
          float cord=max(smoothstep(.5-.07-fw.x,.5-.07,q.x),smoothstep(.5-.07-fw.y,.5-.07,q.y));
          cord=mix(cord,.3,clamp((max(fw.x,fw.y)-.2)*2.5,0.,1.));
          vec3 team=mix(uRed,uBlue,vTeam);
          // Close to the lens (a camera behind the goal, past the glass) the net all but goes, so it never fills the view.
          gl_FragColor=vec4(mix(team*1.5,vec3(1.),cord*.35),(cord*.85+.07+vDeep*.05)*(.08+.92*smoothstep(1.5,6.,vLens)));
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(nets.geometry(),net),'Goal nets').renderOrder=2;
  }

  /** The stadium bowl: stepped stands round the pitch at a distance, a crowd on every tread, a canopy over the top
   *  row, and a ribbon of light along the stand fronts and the canopy's edge. */
  private bowl(){
    const ring=BallArena.pitchRing(),TIERS=14,FRONT=6.5,TREAD=1.55,RISE=1.05,BASE=1.5;
    const tier=(k:number)=>({d:FRONT+k*TREAD,h:BASE+k*RISE});
    const rings=Array.from({length:TIERS+1},(_,k)=>offsetRing(ring,tier(k).d));
    const stands=new Quads(),ink=new THREE.Color(0x15161b),concrete=new THREE.Color(0x2b2d33);
    const seat=(z:number,k:number)=>new THREE.Color(z<0?0x55161f:0x14264f).lerp(concrete,k%4===3?.7:.15);
    // The front wall from the concourse up to the first row, facing the pitch.
    const ribbon=new Quads(),board=offsetRing(ring,FRONT-.04);let along=0;
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,a=rings[0][i],b=rings[0][j],ra=board[i],rb=board[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]),team=(a[1]+b[1])/2<0?0:1;
      stands.add([b[0],0,b[1]],[a[0],0,a[1]],[a[0],BASE,a[1]],[b[0],BASE,b[1]],{color:ink});
      ribbon.add([rb[0],.35,rb[1]],[ra[0],.35,ra[1]],[ra[0],1.25,ra[1]],[rb[0],1.25,rb[1]],{uv:[along+len,0,along,1],team});along+=len;
    }
    for(let k=0;k<TIERS;k++){
      const {h}=tier(k),next=tier(k+1).h;
      for(let i=0;i<ring.length;i++){
        const j=(i+1)%ring.length,a0=rings[k][i],b0=rings[k][j],a1=rings[k+1][i],b1=rings[k+1][j];
        stands.add([b0[0],h,b0[1]],[a0[0],h,a0[1]],[a1[0],h,a1[1]],[b1[0],h,b1[1]],{color:seat((a0[1]+b0[1])/2,k)});
        stands.add([b1[0],h,b1[1]],[a1[0],h,a1[1]],[a1[0],next,a1[1]],[b1[0],next,b1[1]],{color:ink});
      }
    }
    // The back wall and the canopy, sloping in over the top rows; its fascia carries the second ribbon.
    const top=tier(TIERS).h,wallTop=top+5,lip=offsetRing(ring,tier(TIERS).d-10),fascia=offsetRing(ring,tier(TIERS).d-10.04),outer=rings[TIERS];along=0;
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,a=outer[i],b=outer[j],la=lip[i],lb=lip[j],len=Math.hypot(lb[0]-la[0],lb[1]-la[1]),team=(a[1]+b[1])/2<0?0:1;
      stands.add([b[0],top,b[1]],[a[0],top,a[1]],[a[0],wallTop,a[1]],[b[0],wallTop,b[1]],{color:ink});
      stands.add([b[0],wallTop,b[1]],[a[0],wallTop,a[1]],[la[0],wallTop+3,la[1]],[lb[0],wallTop+3,lb[1]],{color:concrete});
      stands.add([lb[0],wallTop+1.6,lb[1]],[la[0],wallTop+1.6,la[1]],[la[0],wallTop+3,la[1]],[lb[0],wallTop+3,lb[1]],{color:ink});
      const fa=fascia[i],fb=fascia[j];
      ribbon.add([fb[0],wallTop+1.8,fb[1]],[fa[0],wallTop+1.8,fa[1]],[fa[0],wallTop+2.8,fa[1]],[fb[0],wallTop+2.8,fb[1]],{uv:[along+len,0,along,1],team});along+=len;
    }
    this.add(new THREE.Mesh(stands.geometry(),stageMaterial('ball-pitch','Ink Bowl stands',{vertexColors:true,side:THREE.DoubleSide,roughness:.9})),'Ink Bowl stands');
    const led=new THREE.ShaderMaterial({
      name:'Ink Bowl ribbon boards',side:THREE.DoubleSide,fog:true,
      uniforms:fogged({uTime:this.time,uRed:{value:RED.clone()},uBlue:{value:BLUE.clone()}}),
      vertexShader:`attribute float aTeam;varying vec2 vUv;varying float vTeam;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vTeam=aTeam;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uTime;uniform vec3 uRed,uBlue;varying vec2 vUv;varying float vTeam;
        #include <fog_pars_fragment>
        void main(){
          // Chevrons racing round the bowl in each half's colour, over ink.
          vec3 team=mix(uRed,uBlue,vTeam);
          float x=vUv.x*.9-uTime*3.,chev=fract(x+abs(vUv.y-.5)*.9);
          float on=smoothstep(.55,.6,chev)*(1.-smoothstep(.85,.9,chev));
          float pulse=.5+.5*sin(vUv.x*.08-uTime*1.7);
          float edge=smoothstep(.0,.08,vUv.y)*(1.-smoothstep(.92,1.,vUv.y));
          vec3 col=mix(vec3(.01,.012,.02),team*(1.4+pulse),on*edge)+vec3(1.4)*on*edge*step(.82,pulse);
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(ribbon.geometry(),led),'Ink Bowl ribbon boards');
    this.crowd(rings,tier,TIERS);
    // The camera stays on the pitch side of the stand fronts.
    const wall=new THREE.MeshBasicMaterial({visible:false}),front=offsetRing(ring,FRONT-.5);
    for(let i=0;i<front.length;i++){
      const a=front[i],b=front[(i+1)%front.length],mesh=new THREE.Mesh(beam(a,b,-2,48,1),wall);
      mesh.visible=false;mesh.name='Ink Bowl stand front (camera)';this.root.add(mesh);this.occluders.push(mesh);
    }
  }

  /** One instanced draw of painted fans, a card each turned to the lens about its upright: the home end in crimson, the
   *  away end in azure, a Mexican wave running round the bowl, camera flashes popping in the dark. */
  private crowd(rings:V2[][],tier:(k:number)=>{d:number;h:number},tiers:number){
    const random=rng(4219),spots:number[]=[],shirts:number[]=[],info:number[]=[],c=new THREE.Color();
    const white=new THREE.Color(0xe8e6e0),black=new THREE.Color(0x1d1d22);
    for(let k=0;k<tiers;k++){
      const {h}=tier(k),inner=rings[k],outer=rings[k+1];
      for(let i=0;i<inner.length;i++){
        const j=(i+1)%inner.length;
        const ax=(inner[i][0]*.42+outer[i][0]*.58),az=(inner[i][1]*.42+outer[i][1]*.58),bx=(inner[j][0]*.42+outer[j][0]*.58),bz=(inner[j][1]*.42+outer[j][1]*.58);
        const len=Math.hypot(bx-ax,bz-az),n=Math.floor(len/.74);
        for(let s=0;s<n;s++){
          if(random()<.13)continue;
          const t=(s+.5+(random()-.5)*.3)/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
          spots.push(x,h,z,random());
          const roll=random(),home=z<0?RED:BLUE;
          c.copy(roll<.72?home:roll<.86?white:black).multiplyScalar(.75+random()*.35);
          shirts.push(c.r,c.g,c.b);info.push(Math.atan2(x,z),random());
        }
      }
    }
    const card=new THREE.PlaneGeometry(1,1).translate(0,.5,0),geometry=new THREE.InstancedBufferGeometry();
    geometry.index=card.index;geometry.setAttribute('position',card.getAttribute('position'));geometry.setAttribute('uv',card.getAttribute('uv'));
    geometry.setAttribute('aSpot',new THREE.InstancedBufferAttribute(new Float32Array(spots),4));
    geometry.setAttribute('aShirt',new THREE.InstancedBufferAttribute(new Float32Array(shirts),3));
    geometry.setAttribute('aInfo',new THREE.InstancedBufferAttribute(new Float32Array(info),2));
    geometry.instanceCount=spots.length/4;
    const material=new THREE.ShaderMaterial({
      name:'Ink Bowl crowd',fog:true,side:THREE.DoubleSide,
      uniforms:fogged({uTime:this.time,uHype:crowdHype}),
      vertexShader:`attribute vec4 aSpot;attribute vec3 aShirt;attribute vec2 aInfo;uniform float uTime,uHype;
        varying vec2 vUv;varying vec3 vShirt;varying float vArms;varying float vFlash;
        #include <fog_pars_vertex>
        void main(){
          vUv=uv;vShirt=aShirt;
          float wave=smoothstep(.6,1.,cos(aInfo.x-uTime*.5));
          // On its feet after a goal (uHype): jumping, arms up, the calm bob and the wave under it.
          float bob=max(0.,sin(uTime*(4.+aInfo.y*3.+uHype*6.)+aInfo.y*40.))*(.07+uHype*.42)+wave*.5;
          vArms=max(max(wave,step(.93,fract(aInfo.y*13.7+floor(uTime*.4+aInfo.y)*.37))),step(1.-uHype*.9,fract(aInfo.y*7.3)));
          vec3 base=(modelMatrix*vec4(aSpot.xyz,1.)).xyz;base.y+=bob;
          vec3 toLens=cameraPosition-base;toLens.y=0.;
          vec3 side=normalize(vec3(toLens.z,0.,-toLens.x)+vec3(1e-5,0.,0.));
          vec3 world=base+side*position.x*.66+vec3(0.,position.y*(1.+vArms*.35),0.);
          vFlash=step(.9985,fract(sin(aInfo.y*917.3+floor(uTime*9.)*.731)*43758.5453));
          vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`varying vec2 vUv;varying vec3 vShirt;varying float vArms;varying float vFlash;
        #include <fog_pars_fragment>
        float ballRound(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
        void main(){
          // A seated fan, head and shoulders; arms up (the card grows to hold them) when the wave passes.
          vec2 q=vec2(vUv.x,vUv.y*(1.+vArms*.35));
          float head=length((q-vec2(.5,.74))*vec2(1.,1.15))-.15;
          float body=ballRound(q-vec2(.5,.3),vec2(.27,.3))-.08;
          float arms=vArms>.5?ballRound(vec2(abs(q.x-.5)-.27,q.y-.9),vec2(.05,.35)):1.;
          float d=min(head,min(body,arms));
          if(d>0.)discard;
          vec3 col=d>-.035?vec3(.01):head<min(body,arms)?vec3(.06,.05,.05):vShirt*(vUv.x<.5?1.:.72);
          col=mix(col,vec3(6.),vFlash*step(head,0.));
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    const mesh=this.add(new THREE.Mesh(geometry,material),'Ink Bowl crowd');mesh.frustumCulled=false;
    card.dispose();
  }

  /** Four towers in the corners beyond the stands, each a bank of lamps that glares, with a short beam of haze coming
   *  off it toward the pitch. No real lights: the look's key is the floodlight. */
  private floodlights(){
    const {halfX:X,halfZ:Z}=GOAL_RULES,HEIGHT=46,towers:{geometry:THREE.BufferGeometry}[]=[],panels=new Quads(),cones:THREE.BufferGeometry[]=[];
    const heads:number[]=[];
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const x=sx*(X+24),z=sz*(Z+24),head=new THREE.Vector3(x*.97,HEIGHT,z*.97);
      towers.push({geometry:rod([x,0,z],[x,HEIGHT-2,z],1.15,4,.6)});
      // The lamp bank faces the centre spot, tipped down toward it.
      const toward=new THREE.Vector3(-x,-HEIGHT*.8,-z).normalize(),right=new THREE.Vector3().crossVectors(toward,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,toward).normalize();
      const corner=(u:number,v:number):V3=>{const p=head.clone().addScaledVector(right,u).addScaledVector(up,v).addScaledVector(toward,.46);return [p.x,p.y,p.z];};
      towers.push({geometry:new THREE.BoxGeometry(8.2,5,.8).applyMatrix4(new THREE.Matrix4().makeBasis(right,up,toward.clone().negate()).setPosition(head))});
      panels.add(corner(3.7,-2.2),corner(-3.7,-2.2),corner(-3.7,2.2),corner(3.7,2.2),{uv:[0,0,1,1]});
      const cone=new THREE.ConeGeometry(11,30,20,1,true).translate(0,-15,0);
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),toward)).translate(head.x,head.y,head.z);cones.push(cone);
      heads.push(head.x+toward.x*.8,head.y+toward.y*.8,head.z+toward.z*.8);
    }
    this.add(new THREE.Mesh(bake(towers),stageMaterial('ball-pitch','Floodlight towers',{color:0x14151a,roughness:.7})),'Floodlight towers');
    const lamps=new THREE.ShaderMaterial({
      name:'Floodlight lamps',side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;void main(){
        vec2 g=fract(vUv*vec2(7.,4.))-.5;float lamp=1.-smoothstep(.3,.38,length(g));
        gl_FragColor=vec4(mix(vec3(.02,.025,.04),vec3(7.,7.4,8.),lamp),1.);}`,
    });
    this.add(new THREE.Mesh(panels.geometry(),lamps),'Floodlight lamps');
    const beams=new THREE.ShaderMaterial({
      name:'Floodlight haze',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,
      vertexShader:`varying float vAlong;varying float vFace;void main(){vAlong=1.-uv.y;vec4 mv=modelViewMatrix*vec4(position,1.);
        vec3 n=normalize(normalMatrix*normal);vFace=abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float vAlong;varying float vFace;void main(){
        float a=pow(1.-vAlong,1.6)*pow(vFace,1.4)*.075;gl_FragColor=vec4(vec3(.8,.86,1.)*a,1.);}`,
    });
    const flatCones=cones.map(c=>c.toNonIndexed()),haze=this.add(new THREE.Mesh(mergeGeometries(flatCones)!,beams),'Floodlight haze');haze.renderOrder=3;[...cones,...flatCones].forEach(c=>c.dispose());
    // The glare over each bank: a star with long rays, always turned to the lens.
    const quad=new THREE.PlaneGeometry(2,2),glare=new THREE.InstancedBufferGeometry();
    glare.index=quad.index;glare.setAttribute('position',quad.getAttribute('position'));
    glare.setAttribute('aSpot',new THREE.InstancedBufferAttribute(new Float32Array(heads),3));glare.instanceCount=4;
    const flare=new THREE.ShaderMaterial({
      name:'Floodlight glare',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{uTime:this.time},
      vertexShader:`attribute vec3 aSpot;varying vec2 vP;void main(){vP=position.xy;vec4 c=viewMatrix*modelMatrix*vec4(aSpot,1.);c.xy+=position.xy*14.;gl_Position=projectionMatrix*c;}`,
      fragmentShader:`uniform float uTime;varying vec2 vP;void main(){
        float r=length(vP);float ray=max(0.,1.-abs(vP.y)*40.-abs(vP.x)*.9)+max(0.,1.-abs(vP.x)*40.-abs(vP.y)*.9);
        vec2 d=vec2(vP.x+vP.y,vP.x-vP.y)*.7071;ray+=.5*(max(0.,1.-abs(d.y)*55.-abs(d.x)*1.6)+max(0.,1.-abs(d.x)*55.-abs(d.y)*1.6));
        float core=exp(-r*9.)*1.6+exp(-r*3.)*.25;
        gl_FragColor=vec4(vec3(.85,.9,1.)*(ray*.8+core)*(.92+.08*sin(uTime*13.)),1.);}`,
    });
    const glow=this.add(new THREE.Mesh(glare,flare),'Floodlight glare');glow.frustumCulled=false;glow.renderOrder=4;quad.dispose();
  }

  // ---------------------------------------------------------------- The Sky Court (Sky Spike)

  /** The platform's half-size beyond the dome's walls (SPIKE_RULES.halfX/halfZ): a stone rim where the trees stand. */
  private static readonly PLATFORM={x:SPIKE_RULES.halfX+4,z:SPIKE_RULES.halfZ+4,round:6};
  private static readonly TREES:V2[]=[[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx,sz])=>[sx*(SPIKE_RULES.halfX+1.6),sz*(SPIKE_RULES.halfZ+1.7)] as V2);

  private platform(){
    const R=SPIKE_RULES,{x:PX,z:PZ,round:r}=BallArena.PLATFORM,[TX,TZ]=BallArena.TREES[0];
    const shape=new THREE.Shape();
    shape.moveTo(-PX+r,-PZ);shape.lineTo(PX-r,-PZ);shape.absarc(PX-r,-PZ+r,r,-Math.PI/2,0,false);shape.lineTo(PX,PZ-r);shape.absarc(PX-r,PZ-r,r,0,Math.PI/2,false);
    shape.lineTo(-PX+r,PZ);shape.absarc(-PX+r,PZ-r,r,Math.PI/2,Math.PI,false);shape.lineTo(-PX,-PZ+r);shape.absarc(-PX+r,-PZ+r,r,Math.PI,Math.PI*1.5,false);
    const material=stageMaterial('ball-court','Sky Court floor',{color:0xffffff,roughness:.9});
    addShaderPatch(material,'ball-court-v1',shader=>{
      shader.uniforms.uBallNoise={value:noiseTexture()};
      shader.vertexShader='varying vec3 vBallWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBallWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='varying vec3 vBallWorld;\nuniform sampler2D uBallNoise;\n'+FLOOR_GLSL+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 bp=vBallWorld.xz,ba=abs(bp);
        float bCourt=step(ba.x,${num(R.courtHalfX)})*step(ba.y,${num(R.courtHalfZ)});
        float bZone=step(ba.x,${num(R.halfX)})*step(ba.y,${num(R.halfZ)});
        float bGrain=texture2D(uBallNoise,vec2(bp.x*1.6,bp.y*.07)).b*.6+texture2D(uBallNoise,bp*.2).r*.4;
        // The court: lacquered planks down its length, each side's half in its colour.
        float bPlank=floor(bp.x/.26),bTone=fract(sin(bPlank*12.9898)*43758.5453);
        float bSeam=1.-smoothstep(.006,.012+fwidth(bp.x),abs(fract(bp.x/.26+.5)-.5)*.26);
        float bJoint=1.-smoothstep(.008,.016+fwidth(bp.y),abs(fract((bp.y+bTone*3.1)/3.1+.5)-.5)*3.1);
        vec3 bWood=${lin(0xc8935a)}*(.8+bTone*.3)*(.88+bGrain*.24)*(1.-(bSeam+bJoint)*.35);
        vec3 bPaint=mix(${lin(BALL_TEAM_COLOURS.red)},${lin(BALL_TEAM_COLOURS.blue)},step(0.,bp.y));
        vec3 bCol=mix(bWood,bWood*bPaint*2.2,.6);
        bCol=mix(bCol,${lin(0x0a0a0d)},ballEnso(vec2(bp.x,ba.y-6.6),1.9,.26)*.42);
        // The free zone: ink-blue stone raked round the court like a temple garden.
        float bRake=.5+.5*sin(ballBox(bp,vec2(${num(R.courtHalfX)},${num(R.courtHalfZ)}))*17.);
        vec3 bFree=${lin(0x1f2d46)}*(.86+bGrain*.18)*(.84+bRake*.24);
        // The rim beyond the barrier: weathered tiles, petals fallen under the trees.
        vec2 bTile=abs(fract(bp/1.6+.5)-.5)*1.6;
        vec3 bRim=${lin(0x8a8174)}*(.85+bGrain*.25)*(1.-(1.-smoothstep(.02,.04,min(bTile.x,bTile.y)))*.4);
        float bPetal=step(.7,texture2D(uBallNoise,bp*.85).a)*(1.-smoothstep(2.5,6.5,length(ba-vec2(${num(TX)},${num(TZ)}))));
        bRim=mix(bRim,${lin(0xffb3cc)},bPetal*.85);
        vec3 bFloor=mix(bRim,mix(bFree,bCol,bCourt),bZone);
        // The lines: the court, the centre line under the net, service circles, quarter circles at the net, the
        // attack lines dashed, and a gold line round the free zone.
        float bL=ballLine(ballBox(bp,vec2(${num(R.courtHalfX)},${num(R.courtHalfZ)})),.055);
        bL=max(bL,ballLine(bp.y,.055)*step(ba.x,${num(R.courtHalfX)}));
        bL=max(bL,ballLine(length(vec2(bp.x,ba.y-${num(R.courtHalfZ-2.45)}))-.45,.05));
        bL=max(bL,ballLine(length(vec2(ba.x-${num(R.courtHalfX)},bp.y))-1.5,.05)*step(ba.x,${num(R.courtHalfX)}));
        bL=max(bL,ballLine(ba.y-3.3,.045)*step(ba.x,${num(R.courtHalfX)})*step(.45,fract(bp.x*.9)));
        bFloor=mix(bFloor,${lin(0xf6f2e6)},bL*.95);
        bFloor=mix(bFloor,${lin(0xd9a441)},ballLine(ballBox(bp,vec2(${num(R.halfX)},${num(R.halfZ)}))+.3,.07));
        diffuseColor.rgb*=bFloor;`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.4,bCourt);`);
    });
    this.add(new THREE.Mesh(new THREE.ShapeGeometry(shape,8).rotateX(-Math.PI/2),material),'Sky Court floor',true);
    // The platform's edge, and the rock it is carved from hanging over the clouds.
    const edge=new Quads(),points=shape.getPoints(8),stone=new THREE.Color(0x5e5156);
    for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];edge.add([a.x,0,-a.y],[b.x,0,-b.y],[b.x,-1.8,-b.y],[a.x,-1.8,-a.y],{color:stone});}
    const rock=new THREE.CylinderGeometry(1,.06,1,30,8,true).toNonIndexed(),pos=rock.getAttribute('position'),random=rng(77);
    const jitter=new Map<string,number>();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),key=`${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      if(!jitter.has(key))jitter.set(key,random());
      const n=jitter.get(key)!,depth=.5-y,a=Math.atan2(z,x),k=1+(Math.sin(a*5+y*7)*.12+(n-.5)*.22)*Math.min(1,depth*3);
      pos.setXYZ(i,x*k*PX*1.12,-1.6-depth*depth*34-n*3*depth,z*k*PZ*1.12);
    }
    rock.computeVertexNormals();
    this.add(new THREE.Mesh(edge.geometry(),stageMaterial('ball-court','Sky Court edge',{vertexColors:true,side:THREE.DoubleSide})),'Sky Court edge');
    this.add(new THREE.Mesh(rock,stageMaterial('ball-court','Sky Court rock',{color:0x6a585c,flatShading:true,side:THREE.DoubleSide})),'Sky Court rock');
  }

  /** The net, where the sim has it (physics.ts court): across z = 0 and SPIKE_RULES.netPost past each sideline, its cord
   *  at netHeight, its posts the capsules the ball rings off. The fighters' wall over it is the server's (STAGE_LANDMARKS). */
  private net(){
    const R=SPIKE_RULES,NX=R.courtHalfX+R.netPost,NH=R.netHeight,mesh=new Quads();
    mesh.add([-NX,0,0],[NX,0,0],[NX,NH,0],[-NX,NH,0],{uv:[-NX,0,NX,NH]});
    const material=new THREE.ShaderMaterial({
      name:'Sky Court net',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
      uniforms:fogged({uTime:this.time}),
      vertexShader:`uniform float uTime;varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vec3 p=position;p.z+=sin(uTime*1.6+p.x*.7)*.03*sin(clamp(p.y/${num(NH)},0.,1.)*3.14159);
          vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){
          vec2 d=vec2(vUv.x+vUv.y,vUv.x-vUv.y)/.13;
          vec2 q=abs(fract(d)-.5),fw=fwidth(d);
          float cord=max(smoothstep(.5-.09-fw.x,.5-.09,q.x),smoothstep(.5-.09-fw.y,.5-.09,q.y));
          float knot=(1.-smoothstep(.0,.12,abs(.5-q.x)))*(1.-smoothstep(.0,.12,abs(.5-q.y)));
          cord=mix(max(cord,knot),.34,clamp((max(fw.x,fw.y)-.22)*2.4,0.,1.));
          float tape=step(${num(NH-.13)},vUv.y)+step(vUv.y,.07);
          float side=1.-smoothstep(.035,.06,abs(abs(vUv.x)-${num(R.courtHalfX)}));
          float white=clamp(tape+side,0.,1.);
          float a=max(cord*.92,white);
          if(a<.02)discard;
          gl_FragColor=vec4(mix(vec3(.018,.016,.02),vec3(.95,.93,.88),white),a);
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(mesh.geometry(),material),'Sky Court net').renderOrder=2;
    const black:{geometry:THREE.BufferGeometry}[]=[],gold:{geometry:THREE.BufferGeometry;color:THREE.Color}[]=[];
    black.push({geometry:rod([-NX,NH,0],[NX,NH,0],.05,6)});
    for(const sx of [-1,1]){
      black.push({geometry:rod([sx*NX,0,0],[sx*NX,NH+.3,0],.12,12)},{geometry:new THREE.CylinderGeometry(.34,.4,.12,12).translate(sx*NX,.06,0)});
      gold.push({geometry:new THREE.SphereGeometry(.17,12,8).translate(sx*NX,NH+.34,0),color:new THREE.Color(0xd9a441).multiplyScalar(1.4)});
      // The antennae over the court's sidelines, red and white.
      for(let k=0;k<8;k++)gold.push({geometry:rod([sx*R.courtHalfX,NH+k*.11,0],[sx*R.courtHalfX,NH+(k+1)*.11,0],.022,6),color:k%2?new THREE.Color(0xf2f0ea):RED.clone().multiplyScalar(1.3)});
    }
    const posts=this.add(new THREE.Mesh(bake(black),stageMaterial('ball-court','Net posts',{color:0x101014,roughness:.6})),'Net posts');posts.castShadow=true;
    this.add(new THREE.Mesh(bake(gold,true),new THREE.MeshBasicMaterial({vertexColors:true,name:'Net caps'})),'Net caps');
  }

  /** Waist-high glass along the dome's walls (SPIKE_RULES.halfX/halfZ, where the ball rebounds), framed in ink. */
  private barrier(){
    const {halfX:X,halfZ:Z}=SPIKE_RULES,H=1.15,ring:V2[]=[[X,-Z],[X,0],[X,Z],[0,Z],[-X,Z],[-X,0],[-X,-Z],[0,-Z]],glass=new Quads();
    const frame:{geometry:THREE.BufferGeometry}[]=[],trim:{geometry:THREE.BufferGeometry;color:THREE.Color}[]=[];let along=0;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),team=(a[1]+b[1])/2<0?0:1;
      glass.add([a[0],0,a[1]],[b[0],0,b[1]],[b[0],H,b[1]],[a[0],H,a[1]],{uv:[along,0,along+len,H],team});along+=len;
      frame.push({geometry:beam(a,b,H-.05,H+.08,.16)},{geometry:beam(a,b,0,.18,.14)});
      trim.push({geometry:beam(a,b,.18,.24,.05),color:(team?BLUE:RED).clone().multiplyScalar(1.8)});
      const posts=Math.ceil(len/3);
      for(let k=0;k<posts;k++){const t=k/posts,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;frame.push({geometry:new THREE.BoxGeometry(.16,H+.2,.16).translate(x,(H+.2)/2,z)});}
    }
    this.add(new THREE.Mesh(glass.geometry(),glassMaterial(this.time,H)),'Sky Court barrier').renderOrder=2;
    this.add(new THREE.Mesh(bake(frame),stageMaterial('ball-court','Barrier frame',{color:0x121216,roughness:.6})),'Barrier frame');
    this.add(new THREE.Mesh(bake(trim,true),new THREE.MeshBasicMaterial({vertexColors:true,name:'Barrier trim'})),'Barrier trim');
  }

  /** A cherry tree on each corner of the rim, leaning out over the clouds: ink-dark limbs and clouds of blossom that
   *  sway, two draws for all four. */
  private trees(){
    const random=rng(913),limbs:{geometry:THREE.BufferGeometry}[]=[],blossom:{geometry:THREE.BufferGeometry;color:THREE.Color}[]=[];
    const pale=new THREE.Color(0xffd3e1),deep=new THREE.Color(0xe77fa6),c=new THREE.Color();
    for(const [x,z] of BallArena.TREES){
      const ox=Math.sign(x)*.5,oz=Math.sign(z)*.5,path:V3[]=[[x,-.2,z],[x+ox*.4,1.6,z+oz*.3],[x+ox*1.1,3.1,z+oz*.9],[x+ox*1.6,4.3,z+oz*1.5]];
      for(let i=0;i<path.length-1;i++)limbs.push({geometry:rod(path[i],path[i+1],.42-i*.1,7,.34-i*.1)});
      const top=path[path.length-1],tips:V3[]=[];
      for(let b=0;b<4;b++){
        const a=b*Math.PI/2+random()*.8+Math.atan2(oz,ox),reach=2.2+random()*1.2,tip:V3=[top[0]+Math.cos(a)*reach,top[1]+1+random()*1.4,top[2]+Math.sin(a)*reach];
        limbs.push({geometry:rod(top,tip,.17,6,.07)});tips.push(tip);
      }
      for(const tip of [...tips,[top[0],top[1]+2,top[2]] as V3])for(let k=0;k<3;k++){
        const s=1.2+random()*1.1,ball=new THREE.IcosahedronGeometry(s,1);
        ball.scale(1,.78,1).translate(tip[0]+(random()-.5)*1.8,tip[1]+(random()-.2)*1.1,tip[2]+(random()-.5)*1.8);
        blossom.push({geometry:ball,color:c.copy(deep).lerp(pale,.25+random()*.75).clone()});
      }
    }
    this.add(new THREE.Mesh(bake(limbs),stageMaterial('ball-court','Cherry limbs',{color:0x2a1c1d})),'Cherry limbs');
    const material=stageMaterial('ball-court','Cherry blossom',{vertexColors:true,flatShading:true});
    material.emissive.setHex(0x5a2236);
    addShaderPatch(material,'ball-blossom-sway',shader=>{
      shader.uniforms.uBallTime=this.time;
      shader.vertexShader='uniform float uBallTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float bSway=max(0.,position.y-3.)*.05;
        transformed.x+=sin(uBallTime*1.1+position.y*.6+position.z*.3)*bSway;transformed.z+=cos(uBallTime*.9+position.x*.4)*bSway;`);
    });
    this.add(new THREE.Mesh(bake(blossom,true),material),'Cherry blossom');
  }

  /** Petals drifting over the court from the trees: one instanced draw animated on the GPU alone, each petal tumbling
   *  on its own axis and fading at the ends of the box it falls through. */
  private petals(){
    const COUNT=240,random=rng(5150),seeds=new Float32Array(COUNT*4);for(let i=0;i<seeds.length;i++)seeds[i]=random();
    const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
    geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));geometry.setAttribute('uv',quad.getAttribute('uv'));
    geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=COUNT;
    const material=new THREE.ShaderMaterial({
      name:'Sky Court petals',side:THREE.DoubleSide,fog:true,
      uniforms:fogged({uTime:this.petalTime,uMood:arenaMood,uMin:{value:new THREE.Vector3(-26,0,-30)},uSize:{value:new THREE.Vector3(52,15,60)}}),
      vertexShader:`attribute vec4 aSeed;uniform float uTime;uniform vec3 uMin,uSize;varying vec2 vUv;varying float vTone;
        #include <fog_pars_vertex>
        mat3 rotAxis(vec3 a,float t){float c=cos(t),s=sin(t),k=1.-c;return mat3(c+a.x*a.x*k,a.y*a.x*k+a.z*s,a.z*a.x*k-a.y*s,a.x*a.y*k-a.z*s,c+a.y*a.y*k,a.z*a.y*k+a.x*s,a.x*a.z*k+a.y*s,a.y*a.z*k-a.x*s,c+a.z*a.z*k);}
        void main(){
          vUv=uv;vTone=aSeed.w;
          vec3 f=fract(aSeed.xyz+vec3(.45,-.8,.12)*(.6+aSeed.w*.7)*uTime/uSize);
          vec3 p=uMin+f*uSize;
          p.x+=sin(uTime*1.3+aSeed.x*40.)*.7;p.z+=cos(uTime*1.1+aSeed.y*40.)*.6;
          vec3 edge=min(f,1.-f)*uSize;float fade=smoothstep(0.,1.5,min(min(edge.x,edge.z),edge.y*2.));
          vec3 axis=normalize(aSeed.yzx-.5+vec3(0.,.01,0.));
          vec3 local=rotAxis(axis,uTime*(1.4+aSeed.z*2.)+aSeed.x*30.)*vec3(position.xy*.17*fade,0.);
          vec4 mvPosition=viewMatrix*modelMatrix*vec4(p+local,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uMood;varying vec2 vUv;varying float vTone;
        #include <fog_pars_fragment>
        void main(){
          vec2 p=vUv*2.-1.;
          float d=length(p*vec2(1.65,1.))-.92;
          d=max(d,.2-length(p-vec2(0.,1.02)));
          if(d>0.)discard;
          vec3 col=mix(vec3(1.,.55,.7),vec3(1.,.86,.92),vTone*.6+(1.-length(p))*.4);
          // A FEVER rally turns the storm to gold.
          col=mix(col,mix(vec3(1.,.72,.25),vec3(1.,.92,.55),vTone),uMood*.85);
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    const mesh=this.add(new THREE.Mesh(geometry,material),'Sky Court petals');mesh.frustumCulled=false;quad.dispose();
  }

  /** The sea of cloud far below, cel-banded in the sunset's colours, and towers of cloud standing out of it - flat
   *  cut-outs turned to the lens, slowly wheeling. */
  private cloudSea(){
    const sea=new THREE.ShaderMaterial({
      name:'Cloud sea',fog:true,
      uniforms:fogged({uTime:this.time,uNoise:{value:noiseTexture()}}),
      vertexShader:`varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform sampler2D uNoise;uniform float uTime;varying vec3 vWorld;
        #include <fog_pars_fragment>
        void main(){
          vec2 p=vWorld.xz;
          float n=texture2D(uNoise,p*.0021+vec2(uTime*.0012,0.)).r*.55+texture2D(uNoise,p*.0083-vec2(0.,uTime*.002)).g*.3+texture2D(uNoise,p*.031+uTime*.003).b*.15;
          float band=smoothstep(.42,.46,n)*.5+smoothstep(.56,.6,n)*.5;
          vec3 col=mix(${lin(0x6d4f86)},${lin(0xe39a9a)},band);
          col=mix(col,${lin(0xffd7b0)},smoothstep(.68,.72,n));
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600).rotateX(-Math.PI/2),sea);plane.position.y=-62;this.add(plane,'Cloud sea');
    const COUNT=64,random=rng(3303),data=new Float32Array(COUNT*4),seed=new Float32Array(COUNT*2);
    for(let i=0;i<COUNT;i++){
      const a=random()*Math.PI*2,far=i<44,d=far?150+random()*190:55+random()*80;
      data.set([Math.cos(a)*d,far?-40+random()*50:-52+random()*16,Math.sin(a)*d,far?28+random()*40:14+random()*16],i*4);seed.set([random(),random()],i*2);
    }
    const quad=new THREE.PlaneGeometry(2,2),geometry=new THREE.InstancedBufferGeometry();
    geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));
    geometry.setAttribute('aCloud',new THREE.InstancedBufferAttribute(data,4));geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seed,2));geometry.instanceCount=COUNT;
    const puff=new THREE.ShaderMaterial({
      name:'Cloud towers',fog:true,
      uniforms:fogged({uTime:this.time,uNoise:{value:noiseTexture()}}),
      vertexShader:`attribute vec4 aCloud;attribute vec2 aSeed;uniform float uTime;varying vec2 vP;varying vec2 vSeed;
        #include <fog_pars_vertex>
        void main(){vP=position.xy;vSeed=aSeed;
          float a=uTime*.004*(aSeed.x-.4);float c=cos(a),s=sin(a);
          vec3 centre=vec3(aCloud.x*c-aCloud.z*s,aCloud.y,aCloud.x*s+aCloud.z*c);
          vec4 mvPosition=viewMatrix*modelMatrix*vec4(centre,1.);mvPosition.xy+=position.xy*aCloud.w*vec2(1.5,1.);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform sampler2D uNoise;varying vec2 vP;varying vec2 vSeed;
        #include <fog_pars_fragment>
        void main(){
          vec2 p=vP*vec2(1.5,1.);
          // Billows on a flat foot: five round heads, the middle ones tallest, the noise breaking their edges.
          float h=0.;
          for(int i=0;i<5;i++){
            float fi=float(i),k=fract(sin(fi*12.9898+vSeed.x*78.233)*43758.5453);
            vec2 c=vec2((fi-2.)*.5+(k-.5)*.18,-.18+(.32-abs(fi-2.)*.12)*(.6+k*.6));
            h=max(h,1.-length(p-c)/(.38+.14*k));
          }
          h+=(texture2D(uNoise,p*.35+vSeed).g-.5)*.18;
          if(h<0.||p.y<-.48)discard;
          float lit=smoothstep(.0,.6,p.y+.2-p.x*.25);
          vec3 col=mix(${lin(0x7a5b93)},${lin(0xf2a9a2)},smoothstep(.45,.55,lit));
          col=mix(col,${lin(0xffe0bd)},smoothstep(.82,.86,lit)*step(.12,h));
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    const clouds=this.add(new THREE.Mesh(geometry,puff),'Cloud towers');clouds.frustumCulled=false;quad.dispose();
  }

  /** A few islands of rock floating round the court, flat-topped and mossy, two with a little cherry tree and one with
   *  a red gate, each bobbing on its own beat: one draw. */
  private islands(){
    const random=rng(808),parts:Part[]=[];
    const rock=new THREE.Color(0x6b5759),moss=new THREE.Color(0x87915a),pink=new THREE.Color(0xf09ab9),gate=new THREE.Color(0xc8283a),wood=new THREE.Color(0x2a1c1d);
    const spots:[number,number,number,number][]=[[-58,-6,-40,7],[64,4,-70,10],[-90,12,60,13],[48,-14,58,6],[110,20,10,12],[-36,26,-130,15],[-130,-4,-20,9]];
    spots.forEach(([x,y,z,s],i)=>{
      // Flat on top, a cone of crag below: the same displacement for every copy of a corner, so no cracks.
      const g=new THREE.IcosahedronGeometry(1,2),p=g.getAttribute('position'),bob=i/spots.length;
      for(let v=0;v<p.count;v++){
        let px=p.getX(v),py=p.getY(v),pz=p.getZ(v);const n=Math.sin(px*7.1+pz*5.3+i)*.5+.5;
        if(py>.15)py=.15+(py-.15)*.12;else{py*=1.5+n*.6;const k=1-(.15-py)*.12;px*=k;pz*=k;}
        p.setXYZ(v,px*s*(1+n*.12),py*s,pz*s*(1+n*.12));
      }
      g.translate(x,y,z);g.computeVertexNormals();
      parts.push({geometry:g,bob,faces:lowest=>lowest>y+s*.12?moss:rock});
      const deck=y+s*.15;
      if(i===1||i===4){
        parts.push({geometry:rod([x,deck,z],[x+1,deck+s*.35,z],s*.06,6),color:wood,bob});
        for(let k=0;k<3;k++)parts.push({geometry:new THREE.IcosahedronGeometry(s*(.16+random()*.08),1).translate(x+1+(random()-.5)*s*.3,deck+s*(.4+random()*.12),z+(random()-.5)*s*.3),color:pink,bob});
      }
      if(i===2){
        const w=s*.32,h=s*.42;
        for(const sx of [-1,1])parts.push({geometry:new THREE.BoxGeometry(s*.05,h,s*.05).translate(x+sx*w/2,deck+h/2,z),color:gate,bob});
        parts.push({geometry:new THREE.BoxGeometry(w*1.45,s*.05,s*.07).translate(x,deck+h,z),color:gate,bob},{geometry:new THREE.BoxGeometry(w*1.1,s*.035,s*.05).translate(x,deck+h*.8,z),color:gate,bob});
      }
    });
    const material=stageMaterial('ball-court','Floating islands',{vertexColors:true,flatShading:true});
    addShaderPatch(material,'ball-island-bob',shader=>{
      shader.uniforms.uBallTime=this.time;
      shader.vertexShader='attribute float aBob;\nuniform float uBallTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=sin(uBallTime*.35+aBob*6.2832)*.9;');
    });
    this.add(new THREE.Mesh(bake(parts,true,true),material),'Floating islands');
  }

  /** Each side's colours on tall poles behind its baseline, waving. */
  private banners(){
    const {halfZ:Z}=SPIKE_RULES,poles:{geometry:THREE.BufferGeometry}[]=[],flags:THREE.BufferGeometry[]=[];
    for(const sz of [-1,1])for(const sx of [-1,1]){
      const x=sx*5,z=sz*(Z+2.6),team=sz<0?RED:BLUE;
      poles.push({geometry:rod([x,0,z],[x,7.6,z],.09,8)},{geometry:new THREE.SphereGeometry(.16,10,6).translate(x,7.7,z)});
      const flag=new THREE.PlaneGeometry(2.4,3.6,12,2).translate(sx*1.2,0,0);
      const p=flag.getAttribute('position'),reach=new Float32Array(p.count),colors=new Float32Array(p.count*3),ink=new THREE.Color(0x0c0c10);
      for(let i=0;i<p.count;i++){const t=Math.abs(p.getX(i))/2.4;reach[i]=t;const c=t>.18&&t<.3?ink:team;colors.set([c.r,c.g,c.b],i*3);}
      flag.setAttribute('aReach',new THREE.BufferAttribute(reach,1));flag.setAttribute('color',new THREE.BufferAttribute(colors,3));
      flag.deleteAttribute('uv');flag.translate(x,5.7,z);flags.push(flag.toNonIndexed());flag.dispose();
    }
    this.add(new THREE.Mesh(bake(poles),stageMaterial('ball-court','Banner poles',{color:0x15151a})),'Banner poles');
    const material=stageMaterial('ball-court','Banners',{vertexColors:true,side:THREE.DoubleSide});
    material.emissive.setHex(0x1a0a10);
    addShaderPatch(material,'ball-banner-wave',shader=>{
      shader.uniforms.uBallTime=this.time;
      shader.vertexShader='attribute float aReach;\nuniform float uBallTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(aReach*5.-uBallTime*4.+position.x*.3)*.28*aReach;transformed.y-=aReach*aReach*.25;');
    });
    const merged=mergeGeometries(flags)!;flags.forEach(f=>f.dispose());
    this.add(new THREE.Mesh(merged,material),'Banners');
  }

  /** Sky lanterns rising far off in the dusk: warm glowing cards, one draw. */
  private lanterns(){
    const COUNT=32,random=rng(2718),seeds=new Float32Array(COUNT*4);for(let i=0;i<seeds.length;i++)seeds[i]=random();
    const quad=new THREE.PlaneGeometry(1,1.3),geometry=new THREE.InstancedBufferGeometry();
    geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));geometry.setAttribute('uv',quad.getAttribute('uv'));
    geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=COUNT;
    const material=new THREE.ShaderMaterial({
      name:'Sky lanterns',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:true,
      uniforms:fogged({uTime:this.time}),
      vertexShader:`attribute vec4 aSeed;uniform float uTime;varying vec2 vUv;varying float vFade;
        #include <fog_pars_vertex>
        void main(){vUv=uv;
          float a=aSeed.x*6.2832+uTime*.006,d=48.+aSeed.y*130.,rise=mod(aSeed.z*90.+uTime*(.6+aSeed.w*.8),90.);
          vFade=smoothstep(0.,10.,rise)*(1.-smoothstep(70.,90.,rise));
          vec3 centre=vec3(cos(a)*d,-34.+rise,sin(a)*d);
          vec4 mvPosition=viewMatrix*modelMatrix*vec4(centre,1.);mvPosition.xy+=position.xy*(1.1+aSeed.w*.6);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`varying vec2 vUv;varying float vFade;
        #include <fog_pars_fragment>
        void main(){vec2 p=vUv*2.-1.;vec2 q=abs(p)-vec2(.55,.75);float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.2;
          float body=1.-smoothstep(-.05,.05,d);float glow=exp(-max(d,0.)*5.)*.35;
          vec3 col=mix(vec3(1.6,.62,.18),vec3(3.,2.2,1.),smoothstep(.2,-.9,p.y))*body+vec3(1.,.45,.15)*glow;
          gl_FragColor=vec4(col*vFade,1.);
          #include <fog_fragment>
        }`,
    });
    const mesh=this.add(new THREE.Mesh(geometry,material),'Sky lanterns');mesh.frustumCulled=false;mesh.renderOrder=3;quad.dispose();
  }
}
