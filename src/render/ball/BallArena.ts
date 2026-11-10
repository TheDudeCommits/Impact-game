import * as THREE from 'three';
import {arenaMood,crowdHype,goalNetHit,goalNetPower} from './hype';
import {netSheer} from './ballCamChoice';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BALL_TEAM_COLOURS,GOAL_RULES,SPIKE_RULES} from '../../game/ball/model';
import type {StageId} from '../../game/stages';
import {stageMaterial} from '../stages/build';
import {addShaderPatch} from '../look/shaderPatch';
import {noiseTexture} from '../vfx/noiseTexture';
import {MangaScreens} from './MangaScreens';
import type {BallArenaId} from '../../game/ball/arenas';
import {hullGeometry} from '../../originals/places/forge';
import {StageKit} from '../stages/StageKit';
import {BOWL,bowlGuardian,cannonSpot,gateZ,pulled,wreckHullX,wreckShipZ} from './pitchLayout';

export type BallStage=Extract<StageId,'ball-pitch'|'ball-court'>;
type V2=readonly [number,number];
type V3=readonly [number,number,number];

const RED=new THREE.Color(BALL_TEAM_COLOURS.red),BLUE=new THREE.Color(BALL_TEAM_COLOURS.blue);
/** An sRGB hex as the linear vec3 a shader works in. */
const lin=(hex:number)=>{const c=new THREE.Color(hex);return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;};
const num=(n:number)=>n.toFixed(4);
const fogged=(uniforms:Record<string,THREE.IUniform>)=>({...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),...uniforms});
const rng=(seed:number)=>{let s=seed;return ()=>(s=(s*16807)%2147483647)/2147483647;};
/** How many aisles of stairs a run of stand has, by the length of its front row (one every eleven metres). */
const aisles=(a:V2,b:V2)=>Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/11));
/** The crowd: how far apart the fans stand along a row (m); the rows on each tread of a stand (how far back
 *  across the tread, how far up: the back row stands on its seats); a fan's card (m: the drawing's cell is 128 x 160);
 *  and the light on the crowd in each arena (the floodlit night's cool grey, a sunset's warmth, the volcano's glow). */
const CROWD_GAP=.6,CROWD_ROWS:readonly V2[]=[[.3,0],[.8,.45]],CROWD_CARD=[.86,1.075] as const;
const CROWD_LIGHT:Record<BallArenaId,[number,number,number]>={
  'ink-bowl':[.6,.64,.8],'dust-yard':[.94,.77,.6],'rain-roof':[.5,.56,.74],
  'sky-court':[1,.82,.72],'tide-court':[.95,.78,.7],'ember-rim':[.72,.46,.36]};

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
  add(a:V3,b:V3,c:V3,d:V3,o:{uv?:readonly [number,number,number,number];color?:THREE.Color;team?:number;panel?:readonly [number,number,number,number]}={}){
    const [u0,v0,u1,v1]=o.uv??[0,0,1,1],[p0,q0,p1,q1]=o.panel??[0,0,1,1],corners=[a,b,c,d],uvs:V2[]=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],panels:V2[]=[[p0,q0],[p1,q0],[p1,q1],[p0,q1]];
    this.ab.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);this.ad.set(d[0]-a[0],d[1]-a[1],d[2]-a[2]);const n=this.ab.cross(this.ad).normalize();
    for(const i of [0,1,2,0,2,3]){
      this.position.push(...corners[i]);this.normal.push(n.x,n.y,n.z);this.uv.push(...uvs[i]);this.panel.push(...panels[i]);
      const c=o.color??RED;this.color.push(c.r,c.g,c.b);this.team.push(o.team??0);
    }
  }
  /** A quad cut into nu x nv cells (each a quad of its own, its panel place kept): a net that can bulge where it is hit. */
  grid(a:V3,b:V3,c:V3,d:V3,nu:number,nv:number,o:{uv?:readonly [number,number,number,number];team?:number}={}){
    const [u0,v0,u1,v1]=o.uv??[0,0,1,1];
    const at=(s:number,t:number):V3=>{const x=(k:number)=>(a[k]*(1-s)+b[k]*s)*(1-t)+(d[k]*(1-s)+c[k]*s)*t;return [x(0),x(1),x(2)];};
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
      const s0=i/nu,s1=(i+1)/nu,t0=j/nv,t1=(j+1)/nv;
      this.add(at(s0,t0),at(s1,t0),at(s1,t1),at(s0,t1),{team:o.team,uv:[u0+(u1-u0)*s0,v0+(v1-v0)*t0,u0+(u1-u0)*s1,v0+(v1-v0)*t1],panel:[s0,t0,s1,t1]});
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
  /** The Ink Bowl's big screens: the live match drawn as a manga page (MangaScreens). */
  private screens?:MangaScreens;
  /** The arena's generated set pieces (public/assets/environment/own/ball-*.glb), placed through the
   *  places' own kit (their materials in the look, the camera's cutaway). */
  private kit?:StageKit;
  /** The crowd's drawn fans (one picture for every arena), clear until it has loaded. */
  private readonly fans={value:BallArena.clear()};
  private static clear(){const t=new THREE.DataTexture(new Uint8Array(4),1,1);t.needsUpdate=true;return t as THREE.Texture;}
  /** Which of the mode's arenas (game/ball/arenas.ts) this is; the rules' shapes are the same in all. */
  constructor(readonly stage:BallStage,readonly arena:BallArenaId=stage==='ball-pitch'?'ink-bowl':'sky-court'){this.root.name=`${stage==='ball-pitch'?'Goal Rush':'Sky Spike'} · ${arena}`;}

  async load(){
    if(this.built)return;this.built=true;
    if(this.stage==='ball-pitch'){
      this.turf();this.pitchWalls();this.goals();
      if(this.arena==='dust-yard')this.wreckYard();else if(this.arena==='rain-roof')this.rainRoof();else{this.bowl();this.floodlights();}
    }else{
      this.platform();this.net();this.barrier();
      if(this.arena==='tide-court')this.tideCourt();else if(this.arena==='ember-rim')this.emberRim();
      else{this.trees();this.petals();this.cloudSea();this.islands();this.banners();this.waterfalls();this.standIslands();}
    }
    // The crowd's drawn fans. Without them (a failed fetch) the stands stay empty rather than break the place.
    if(typeof document!=='undefined')try{
      const fans=await new THREE.TextureLoader().loadAsync('/assets/environment/own/ball-crowd.webp');
      fans.colorSpace=THREE.SRGBColorSpace;fans.anisotropy=4;this.fans.value.dispose();this.fans.value=fans;
    }catch(error){console.warn('Ball arena crowd failed',this.arena,error);}
    // The set pieces load after the place is whole: a piece that fails leaves the arena as it is.
    try{await this.setPieces();}catch(error){console.warn('Ball arena pieces failed',this.arena,error);}
    this.root.updateMatrixWorld(true);
  }

  /** Each arena's generated set pieces (made with Tripo for the game), where they stand. */
  private async setPieces(){
    if(typeof document==='undefined')return;
    const {halfZ:Z}=GOAL_RULES;
    const kit=new StageKit(this.root,this.stage),place:[string,Parameters<StageKit['place']>[1]][]=[];
    // Every piece is laid from the pitch (pitchLayout.ts); one placed out beyond
    // it keeps its distance from the stands, which come in with the walls.
    if(this.arena==='ink-bowl'){
      // A carved gateway behind each goal (no wider than the end wall's straight run), and a guardian on the canopy at
      // each corner of the bowl.
      for(const sz of [-1,1])place.push(['own/ball-ink-gate',{x:0,z:sz*gateZ(),y:0,width:Math.min(19,(GOAL_RULES.halfX-GOAL_RULES.corner)*2),rot:sz<0?0:Math.PI,shadow:false}]);
      const [gx,gz]=bowlGuardian();
      for(const sx of [-1,1])for(const sz of [-1,1])place.push(['own/ball-ink-guardian',{x:sx*gx,z:sz*gz,y:24.1,height:11,rot:Math.atan2(-sx,-sz),shadow:false}]);
    }
    if(this.arena==='ink-bowl'||this.arena==='rain-roof'){
      // The floodlights' lattice towers under their lamp banks.
      const {halfX:X}=GOAL_RULES;
      for(const sx of [-1,1])for(const sz of [-1,1])place.push(['own/ball-flood-tower',{x:sx*(X+24),z:sz*(Z+24),y:0,height:48,rot:Math.atan2(-sx,-sz),shadow:false}]);
    }
    if(this.arena==='rain-roof'){
      // Water tanks on the roof round the stands.
      for(const [x0,z0,r] of [[-30,-40,.4],[32,-38,2.2],[-34,40,-1.1],[29,44,3.4],[-38,0,1.6],[38,6,-.6]] as const){const [x,z]=pulled(x0,z0);place.push(['own/ball-water-tower',{x,z,y:0,height:13,rot:r,shadow:false}]);}
      // The roof's plant round the stands, and a blank billboard frame over each long side.
      for(const [x0,z0,r] of [[-40,-24,.3],[41,22,2.9],[-42,30,-1.4],[40,-34,1.9]] as const){const [x,z]=pulled(x0,z0);place.push(['own/ball-roof-units',{x,z,y:0,width:9,rot:r,shadow:false}]);}
      for(const sx of [-1,1])place.push(['own/ball-billboard',{x:sx*(GOAL_RULES.halfX+30),z:0,y:3,width:22,rot:sx<0?Math.PI/2:-Math.PI/2,shadow:false}]);
    }else if(this.arena==='dust-yard'){
      place.push(['own/ball-wreck-ship',{x:-6,z:-wreckShipZ(),y:-1.5,width:46,rot:.35,shadow:false}],['own/ball-wreck-ship',{x:8,z:wreckShipZ(),y:-1.5,width:50,rot:Math.PI+.5,shadow:false}]);
      // An anchor and a ship's figurehead in the sand beyond the end stands (clear of the hulls).
      const anchor=pulled(-16,-50),figurehead=pulled(18,50);
      place.push(['own/ball-ship-anchor',{x:anchor[0],z:anchor[1],y:-.6,height:9,rot:.5,tilt:.12,shadow:false}],['own/ball-figurehead',{x:figurehead[0],z:figurehead[1],y:-.3,height:10,rot:-2.6,shadow:false}]);
    }else if(this.arena==='sky-court'){
      place.push(['own/ball-sky-shrine',{x:62,z:-24,y:-14,height:34,rot:-1.2,shadow:false}],['own/ball-sky-shrine',{x:-70,z:36,y:-4,height:26,rot:2.1,shadow:false}]);
      // Two sky-ships drifting past.
      place.push(['own/ball-sky-ship',{x:-48,z:-34,y:16,width:15,rot:1.2,roll:.08,shadow:false}],['own/ball-sky-ship',{x:58,z:44,y:24,width:19,rot:-2.1,roll:-.06,shadow:false}]);
    }else if(this.arena==='tide-court'){
      place.push(['own/ball-tide-arch',{x:44,z:-80,y:-1,height:30,rot:-.3,shadow:false}]);
      // Lifeguard towers either side of the court, and boats pulled up on the sand.
      for(const sx of [-1,1])place.push(['own/ball-lifeguard-tower',{x:sx*27,z:sx*4,y:0,height:8,rot:sx<0?Math.PI/2:-Math.PI/2,shadow:false}]);
      place.push(['own/ball-beached-boat',{x:31,z:-22,y:-.1,width:7,rot:.7,shadow:false}],['own/ball-beached-boat',{x:-33,z:21,y:-.1,width:6,rot:-2.3,shadow:false}]);
    }else if(this.arena==='ember-rim'){
      place.push(['own/ball-ember-colossus',{x:0,z:-92,y:-34,height:78,rot:0,shadow:false}]);
      // Basalt braziers burning at the court's four corners, on the rim beyond the barrier.
      for(const sx of [-1,1])for(const sz of [-1,1])place.push(['own/ball-basalt-brazier',{x:sx*17,z:sz*20.6,y:0,height:3.4,rot:Math.atan2(-sx,-sz),shadow:false}]);
    }
    // The furniture of a place where a sport is played, where the play's own camera looks. Goal Rush: in the
    // walk between the cage and the stands (dugouts and a camera platform on each long side, loudspeakers by the
    // corners, a confetti cannon at each corner: the two at the scorer's end fire on a goal). The Wreck Yard is timber
    // and rope, so its sides get benches, drums and ball carts instead.
    if(this.stage==='ball-pitch'){
      const {halfX:X}=GOAL_RULES,inward=(sx:number)=>sx<0?Math.PI/2:-Math.PI/2,timber=this.arena==='dust-yard';
      for(const sx of [-1,1]){
        for(const sz of [-1,1]){
          place.push([timber?'own/ball-team-bench':'own/ball-dugout',{x:sx*(X+3.3),z:sz*7.4,y:0,width:timber?5.6:7,rot:inward(sx),shadow:true}]);
          place.push([timber?'own/ball-festival-drums':'own/ball-speaker-stack',{x:sx*(X+3.6),z:sz*14.2,y:0,height:timber?1.9:3.4,rot:inward(sx)+sz*sx*.35}]);
          const [cx,cz]=cannonSpot(sx,sz);
          place.push(['own/ball-confetti-cannon',{x:cx,z:cz,y:0,height:2.3,rot:Math.atan2(sx,sz)}]);
        }
        place.push([timber?'own/ball-ball-cart':'own/ball-broadcast-camera',{x:sx*(X+(timber?2.6:3.4)),z:0,y:0,width:timber?1.5:3.6,rot:inward(sx),shadow:true}]);
      }
    }else{
      // Sky Spike: on the rim beyond the barrier (nothing a fighter can run into): the umpire's chair at the net, a bench
      // and a ball cart for each side, the supporters' drums behind each baseline.
      // (On the volcano the timber and canvas are smoke-dark.)
      const {halfX:X,halfZ:Z}=SPIKE_RULES,tint=this.arena==='ember-rim'?0x8f6a5c:undefined;
      place.push(['own/ball-umpire-chair',{x:X+1.9,z:0,y:0,height:4.3,rot:-Math.PI/2,shadow:true,tint}]);
      for(const sz of [-1,1]){
        place.push(['own/ball-team-bench',{x:-(X+2.1),z:sz*7.6,y:0,width:5.4,rot:Math.PI/2,shadow:true,tint}]);
        place.push(['own/ball-ball-cart',{x:-(X+1.6),z:sz*2.4,y:0,width:1.4,rot:Math.PI/2+sz*.5,shadow:true,tint}]);
        for(const sx of [-1,1])place.push(['own/ball-festival-drums',{x:sx*10.4,z:sz*(Z+2.1),y:0,height:1.9,rot:(sz<0?0:Math.PI)-sx*sz*.3,shadow:true,tint}]);
      }
      if(this.arena==='sky-court'){
        // The cherry trees at the rim's corners, in place of the ones drawn in code. Those on the sun's side do not cast:
        // at sunset their shade lay across half the court. (The flag was the wrong way round - the sun
        // stands at -x, and it was those two that cast.)
        for(const [x,z] of BallArena.TREES)place.push(['own/ball-blossom-tree',{x:x+Math.sign(x)*.8,z:z+Math.sign(z)*.8,y:-.5,height:9,rot:Math.atan2(x,z)+.6,shadow:x>0}]);
      }else if(this.arena==='tide-court'){
        // Palms leaning over the sand round the court, and places to sit out of the sun down the open side.
        for(const [x,z,r,h] of [[-23,-25,.4,13],[24,-27,2.2,15],[-25,25,-1.1,14],[23,27,3.4,12],[-29,-2,1.6,16],[30,4,-.6,14],[-21,-13,2.9,11],[26,15,.9,12]] as const)place.push(['own/ball-palm-tree',{x,z,y:-.2,height:h,rot:r}]);
        for(const [x,z,r] of [[24,-9,-1.3],[25,7,-1.9],[-24,10,1.4]] as const)place.push(['own/ball-beach-set',{x,z,y:0,width:5.2,rot:r}]);
      }else if(this.arena==='ember-rim'){
        // Spires of black glass standing up out of the rim all round the court, their cracks alight.
        for(const [x,z,r,h] of [[-22,-21,.4,9],[23,-23,2.2,12],[-24,22,-1.1,11],[22,24,3.4,8],[-25,-3,1.6,13],[26,5,-.6,10],[0,-27,2.9,7],[4,28,.9,9]] as const)place.push(['own/ball-obsidian-spire',{x,z,y:-.6,height:h,rot:r}]);
      }
    }
    if(!place.length)return;
    // Each piece on its own: one that is missing or fails to load is left out, the rest still stand.
    for(const piece of new Set(place.map(([p])=>p)))await kit.load([piece]).catch(error=>console.warn('Ball arena piece failed',piece,error));
    for(const [piece,at] of place)if(kit.has(piece))kit.place(piece,at);
    // And the modelled cherry trees for the ones drawn in code.
    if(kit.has('own/ball-blossom-tree'))for(const name of ['Cherry limbs','Cherry blossom']){const plain=this.root.getObjectByName(name);if(plain)plain.visible=false;}
    // The generated towers stand in for the plain ones.
    if(kit.has('own/ball-flood-tower')){const plain=this.root.getObjectByName('Floodlight towers');if(plain)plain.visible=false;}
    kit.flush();this.kit=kit;
  }
  /** The petals' own clock: it runs faster in a FEVER rally (arenaMood), and a clock rather than a scaled time so the
   *  storm builds without a jump. */
  private readonly petalTime={value:0};private lastTime=NaN;
  update(time:number){
    const dt=Number.isFinite(this.lastTime)?Math.max(0,Math.min(.1,time-this.lastTime)):0;this.lastTime=time;
    this.time.value=time;this.petalTime.value+=dt*(1+arenaMood.value*2.4);
    // A goal's celebration is drawn for the ten seconds after it and not at all otherwise.
    const since=time-goalNetHit.value.w,on=since>=0&&since<10;for(const mesh of this.party)mesh.visible=on;
  }
  /** Everything here is the arena's own (the noise texture is shared and stays). Safe to call twice, and alongside
   *  StageEnvironment's own release of the root. */
  dispose(){
    this.screens?.dispose();this.screens=undefined;
    this.fans.value.dispose();
    this.kit?.dispose();this.kit=undefined;
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
    // The marks scale with the pitch (they were laid for 36 × 52 m): the boxes, the penalty spot and its arc,
    // the great brush circle, the mown bands and the ends' washes, each by the pitch's width (kx), its length (kz) or the
    // smaller of the two (k). The six-yard box stays wider than the goal.
    const kx=X/18,kz=Z/26,k=Math.min(kx,kz),band=num(4*kz);
    const box=[12*kx,5.6*kz],six=[Math.max(G+1.2,7*kx),2.3*kz],spot=8*kz,arc=5*k,enso=6*k;
    // The outline with both goals' floors in it, in the floor plane (a shape's y is world -z).
    const outline:V2[]=[[X,-Z+C],[X,Z-C],[X-C,Z],[G,Z],[G,Z+D],[-G,Z+D],[-G,Z],[-X+C,Z],[-X,Z-C],[-X,-Z+C],[-X+C,-Z],[-G,-Z],[-G,-Z-D],[G,-Z-D],[G,-Z],[X-C,-Z]];
    const geometry=new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z)))).rotateX(-Math.PI/2);
    const material=stageMaterial('ball-pitch','Ink Bowl turf',{color:0xffffff,roughness:.95});
    const ground={
      'ink-bowl':`// The pitch is a sheet of paper. Warm cream, mown in broad bands a shade apart, the paper's grain
        // and fibre in it, and screentone dots in the darker bands (faded out where they would shimmer).
        float bStripe=mod(floor(bp.y/${band}+100.),2.);
        vec3 bTurf=mix(${lin(0xe8dcc0)},${lin(0xd9c9a6)},bStripe)*(.9+bGrain*.14+bFibre*.05);
        vec2 bDotP=mat2(.7071,-.7071,.7071,.7071)*bp*4.2;
        float bDotFw=length(fwidth(bDotP));
        float bTone=(1.-smoothstep(.15,.2,length(fract(bDotP)-.5)))*(1.-smoothstep(.25,.6,bDotFw));
        bTurf*=1.-bTone*.09*bStripe;float bPud=0.;`,
      // The Wreck Yard: packed sand, rippled by the wind.
      'dust-yard':`float bStripe=0.;vec3 bTurf=mix(${lin(0xdcc08f)},${lin(0xc8a46f)},smoothstep(.3,.75,bGrain))*(.92+bFibre*.06);
        float bRip=sin(dot(bp,vec2(.82,.57))*4.2+texture2D(uBallNoise,bp*.06).r*7.);bTurf*=1.-.08*smoothstep(.5,1.,bRip);float bPud=0.;`,
      // Rain Roof: wet slate, puddles darker and glossy, the rain ringing in them.
      'rain-roof':`float bStripe=mod(floor(bp.y/${band}+100.),2.);vec3 bTurf=mix(${lin(0x4a4d55)},${lin(0x3f424a)},bStripe)*(.9+bGrain*.15);
        float bPud=smoothstep(.56,.66,texture2D(uBallNoise,bp*.05).g);bTurf*=1.-bPud*.4;
        vec2 bCell=floor(bp*1.1),bF=fract(bp*1.1)-.5;float bT=fract(uBallTime*.8+fract(sin(dot(bCell,vec2(12.9898,78.233)))*43758.5453));
        bTurf+=vec3(.5,.55,.62)*(1.-smoothstep(0.,.03,abs(length(bF)-bT*.45)))*(1.-bT)*(.2+bPud*.8)*.3;`,
    } as Partial<Record<BallArenaId,string>>;
    const ink=this.arena==='rain-roof'?lin(0xe9e6dc):lin(0x0b0b0e);
    addShaderPatch(material,`ball-turf-v2-${this.arena}`,shader=>{
      shader.uniforms.uBallNoise={value:noiseTexture()};shader.uniforms.uBallTime=this.time;
      shader.vertexShader='varying vec3 vBallWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBallWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='varying vec3 vBallWorld;\nuniform sampler2D uBallNoise;\nuniform float uBallTime;\n'+FLOOR_GLSL+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 bp=vBallWorld.xz;
        float bGrain=texture2D(uBallNoise,bp*.045).r*.6+texture2D(uBallNoise,bp*.31).b*.4;
        float bFibre=texture2D(uBallNoise,bp*1.9).g;
        ${ground[this.arena]??ground['ink-bowl']}
        // Each end washed in its side's colour like watercolour, ragged at its edge, the goal floors most.
        vec3 bTeam=mix(${lin(BALL_TEAM_COLOURS.red)},${lin(BALL_TEAM_COLOURS.blue)},step(0.,bp.y));
        float bRag=(texture2D(uBallNoise,bp*.12).a-.5)*3.;
        float bWash=smoothstep(${num(Z-13*kz)},${num(Z-9*kz)},abs(bp.y)+bRag)*.2+step(${num(Z)},abs(bp.y))*.42;
        bTurf=mix(bTurf,bTurf*(.35+bTeam*1.25),bWash);
        // The lines: ink brush strokes, wider and wobblier than chalk, dry at their edges where the brush ran out.
        float bW=.13+(texture2D(uBallNoise,bp*.21).a-.5)*.06;
        float bSd=max(max(abs(bp.x)-${num(X)},abs(bp.y)-${num(Z)}),(abs(bp.x)+abs(bp.y)-${num(X+Z-C)})*.70710678);
        float bIn=step(bSd,-.8),bR=length(bp);
        float bMarks=ballLine(bSd+.8,bW)*step(abs(bp.y),${num(Z)});
        bMarks=max(bMarks,ballLine(bp.y,bW)*bIn*step(${num(enso*1.1)},abs(bp.x)));
        bMarks=max(bMarks,1.-smoothstep(.3,.36,bR));
        float bIntoPitch=${num(Z-.8)}-abs(bp.y);
        bMarks=max(bMarks,ballLine(ballBox(vec2(bp.x,bIntoPitch-${num(box[1])}),vec2(${num(box[0])},${num(box[1])})),bW));
        bMarks=max(bMarks,ballLine(ballBox(vec2(bp.x,bIntoPitch-${num(six[1])}),vec2(${num(six[0])},${num(six[1])})),bW));
        bMarks=max(bMarks,1.-smoothstep(.24,.3,length(vec2(bp.x,bIntoPitch-${num(spot)}))));
        bMarks=max(bMarks,ballLine(length(vec2(bp.x,bIntoPitch-${num(spot)}))-${num(arc)},bW)*step(${num(box[1]*2)},bIntoPitch));
        bMarks=max(bMarks,ballLine(abs(bp.y)-${num(Z)},bW*1.3)*step(abs(bp.x),${num(G)}));
        float bDry=step(.7,texture2D(uBallNoise,bp*vec2(.9,1.1)).r)*.6;
        bMarks*=1.-bDry*(1.-smoothstep(.35,.95,bMarks));
        // The great brush circle at the heart of the pitch (the centre circle and the kickoff's mark in one), and a
        // second, thinner stroke inside it.
        float bEnso=ballEnso(bp,${num(enso)},.62+(texture2D(uBallNoise,bp*.25).g-.5)*.2);
        bEnso=max(bEnso,ballEnso(vec2(-bp.y,bp.x),${num(enso*.73)},.16)*.8);
        bMarks=max(bMarks,bEnso);
        bTurf=mix(bTurf,${ink},bMarks*.94);
        diffuseColor.rgb*=bTurf;`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.16,bPud);`);
    });
    this.add(new THREE.Mesh(geometry,material),'Ink Bowl turf',true);
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(520,520).rotateX(-Math.PI/2),stageMaterial('ball-pitch','Ink Bowl concourse',{color:this.arena==='dust-yard'?0xa8875c:this.arena==='rain-roof'?0x26282e:0x1a1c22}));
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
    // The cage's frame casts: its posts lie across the pitch's edge in the floodlights.
    this.add(new THREE.Mesh(bake(frame),stageMaterial('ball-pitch','Ink Bowl frame',{color:0x111216,roughness:.6})),'Ink Bowl frame').castShadow=true;
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
      // (Cut into cells, so a goal's ball can bulge the net where it hits: BallCeremony.)
      nets.grid([-G,0,back],[G,0,back],[G,GH,back],[-G,GH,back],12,6,{uv:[-G,0,G,GH],team});
      for(const sx of [-1,1])nets.grid([sx*G,0,z],[sx*G,0,back],[sx*G,GH,back],[sx*G,GH,z],5,6,{uv:[0,0,D,GH],team});
      nets.grid([-G,GH,z],[G,GH,z],[G,GH,back],[-G,GH,back],12,5,{uv:[-G,0,G,D],team});
    }
    const frame=this.add(new THREE.Mesh(bake(white),stageMaterial('ball-pitch','Goal frame',{color:0xf4f1ea,roughness:.5})),'Goal frames');frame.castShadow=true;
    this.add(new THREE.Mesh(bake(bands,true),new THREE.MeshBasicMaterial({vertexColors:true,name:'Goal bands'})),'Goal bands');
    const net=new THREE.ShaderMaterial({
      name:'Goal nets',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
      uniforms:fogged({uTime:this.time,uRed:{value:RED.clone()},uBlue:{value:BLUE.clone()},uHit:goalNetHit,uHitPower:goalNetPower}),
      vertexShader:`attribute float aTeam;attribute vec2 aPanel;varying vec2 vUv;varying float vTeam;varying float vDeep;varying float vLens;
        uniform float uTime;uniform vec4 uHit;uniform float uHitPower;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vTeam=aTeam;vec3 p=position;
          // A slow billow, pinned at every edge of its panel.
          float free=sin(aPanel.x*3.14159)*sin(aPanel.y*3.14159);
          p+=normal*free*(sin(uTime*1.3+uv.x*.9)*.06+.05);vDeep=free;
          // A goal's ball bulges the net out where it hit (uHit, at uHit.w on the arena's clock), and the net
          // springs back, pinned at its frame.
          float since=uTime-uHit.w;
          if(since>0.&&since<2.4){
            vec3 mouth=vec3(0.,${num(GH*.5)},sign(position.z)*${num(Z+D*.5)});
            vec3 out_=normal*sign(dot(normal,position-mouth)+1e-4);
            float d=distance(position,uHit.xyz),reach=exp(-d*d/2.6);
            float pin=smoothstep(0.,.22,min(min(aPanel.x,1.-aPanel.x),min(aPanel.y,1.-aPanel.y)));
            float swing=since<.07?since/.07:exp(-(since-.07)*3.2)*cos((since-.07)*10.);
            p+=out_*uHitPower*reach*pin*swing;vDeep=max(vDeep,reach*pin*abs(swing));
          }
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
          // Ink cords over a wash of the goal's colour. Close to the lens (a camera behind the goal, past the
          // glass) the net all but goes, so it never fills the view.
          gl_FragColor=vec4(mix(team*.9,vec3(.015),cord*.8),(cord*.9+.06+vDeep*.05)*(.08+.92*smoothstep(1.5,6.,vLens)));
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(nets.geometry(),net),'Goal nets').renderOrder=2;
  }

  /** The stadium bowl: stepped stands round the pitch at a distance, a crowd on every tread, a canopy over the top
   *  row, and a ribbon of light along the stand fronts and the canopy's edge. */
  private bowl(o:{tiers?:number;seat?:(z:number,k:number)=>THREE.Color;riser?:number;canopy?:boolean;screens?:boolean;name?:string}={}){
    const ring=BallArena.pitchRing(),TIERS=o.tiers??BOWL.tiers,{front:FRONT,tread:TREAD}=BOWL,RISE=1.05,BASE=1.5;
    const tier=(k:number)=>({d:FRONT+k*TREAD,h:BASE+k*RISE});
    const rings=Array.from({length:TIERS+1},(_,k)=>offsetRing(ring,tier(k).d));
    // Pale carved stone for the treads (the ink crowd reads against it), dark risers, every fourth tread a
    // paler course; the sides' colours are the crowd's scarves.
    const stands=new Quads(),ink=new THREE.Color(o.riser??0x3b3833),concrete=new THREE.Color(0x26252a);
    const seat=o.seat??((_z:number,k:number)=>new THREE.Color(0x8f887a).lerp(new THREE.Color(0xb2aa98),k%4===3?.8:0));
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
    // A lit nosing on every step of every aisle, warm white with a little of the end's colour: the aisles
    // read as stairs running up the stand, and the stands as built.
    const steps=new Quads(),warm=new THREE.Color(0xffe2b0);
    for(let k=0;k<TIERS;k++){
      const y=tier(k+1).h;
      for(let i=0;i<ring.length;i++){
        const j=(i+1)%ring.length,a=rings[k+1][i],b=rings[k+1][j],len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,n=aisles(rings[0][i],rings[0][j]);
        const colour=warm.clone().lerp((a[1]+b[1])/2<0?RED:BLUE,.3).multiplyScalar(1.5);
        for(let m=0;m<n;m++){
          const t=(m+.5)/n,x=a[0]+(b[0]-a[0])*t+uz*.03,z=a[1]+(b[1]-a[1])*t-ux*.03;
          steps.add([x+ux*.5,y-.2,z+uz*.5],[x-ux*.5,y-.2,z-uz*.5],[x-ux*.5,y-.06,z-uz*.5],[x+ux*.5,y-.06,z+uz*.5],{color:colour});
        }
      }
    }
    this.add(new THREE.Mesh(steps.geometry(),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,name:`${o.name??'Ink Bowl'} step lights`})),`${o.name??'Ink Bowl'} step lights`);
    // The back wall and the canopy, sloping in over the top rows; its fascia carries the second ribbon.
    const top=tier(TIERS).h,wallTop=top+5,lip=offsetRing(ring,tier(TIERS).d-10),fascia=offsetRing(ring,tier(TIERS).d-10.04),outer=rings[TIERS];along=0;
    for(let i=0;i<ring.length&&o.canopy!==false;i++){
      const j=(i+1)%ring.length,a=outer[i],b=outer[j],la=lip[i],lb=lip[j],len=Math.hypot(lb[0]-la[0],lb[1]-la[1]),team=(a[1]+b[1])/2<0?0:1;
      stands.add([b[0],top,b[1]],[a[0],top,a[1]],[a[0],wallTop,a[1]],[b[0],wallTop,b[1]],{color:ink});
      stands.add([b[0],wallTop,b[1]],[a[0],wallTop,a[1]],[la[0],wallTop+3,la[1]],[lb[0],wallTop+3,lb[1]],{color:concrete});
      stands.add([lb[0],wallTop+1.6,lb[1]],[la[0],wallTop+1.6,la[1]],[la[0],wallTop+3,la[1]],[lb[0],wallTop+3,lb[1]],{color:ink});
      const fa=fascia[i],fb=fascia[j];
      ribbon.add([fb[0],wallTop+1.8,fb[1]],[fa[0],wallTop+1.8,fa[1]],[fa[0],wallTop+2.8,fa[1]],[fb[0],wallTop+2.8,fb[1]],{uv:[along+len,0,along,1],team});along+=len;
    }
    // Without a canopy, a low back wall closes the top row.
    if(o.canopy===false)for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length,a=outer[i],b=outer[j];stands.add([b[0],top,b[1]],[a[0],top,a[1]],[a[0],top+1.2,a[1]],[b[0],top+1.2,b[1]],{color:ink});}
    this.add(new THREE.Mesh(stands.geometry(),stageMaterial('ball-pitch',`${o.name??'Ink Bowl'} stands`,{vertexColors:true,side:THREE.DoubleSide,roughness:.9})),`${o.name??'Ink Bowl'} stands`);
    const led=new THREE.ShaderMaterial({
      name:'Ink Bowl banners',side:THREE.DoubleSide,fog:true,
      uniforms:fogged({uTime:this.time,uRed:{value:RED.clone()},uBlue:{value:BLUE.clone()},uNoise:{value:noiseTexture()},uHit:goalNetHit}),
      vertexShader:`attribute float aTeam;varying vec2 vUv;varying float vTeam;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vTeam=aTeam;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      // Painted banners in place of the racing chevrons. Panels six metres long drift slowly round the
      // bowl, each one of three: the side's colour with a white brush circle, paper with a black brush sweep, ink with
      // the side's colour slashed across. No lettering.
      fragmentShader:`uniform float uTime;uniform vec3 uRed,uBlue;uniform sampler2D uNoise;uniform vec4 uHit;varying vec2 vUv;varying float vTeam;
        #include <fog_pars_fragment>
        void main(){
          vec3 team=mix(uRed,uBlue,vTeam);
          float x=vUv.x-uTime*.6,cell=floor(x/6.),u=fract(x/6.),v=vUv.y;
          float kind=mod(cell,3.),rough=texture2D(uNoise,vec2(x*.37,v*.9)).r;
          vec2 q=vec2((u-.5)*6.,(v-.5)*1.);
          vec3 paper=vec3(.92,.88,.8),ink=vec3(.015);
          vec3 col;
          if(kind<.5){float r=length(q*vec2(.55,1.))-.3;float w=.07+.04*sin(atan(q.y,q.x)*2.+cell);
            col=mix(team*1.1,paper,(1.-smoothstep(w-.02,w,abs(r)))*step(.25,rough+.1));}
          else if(kind<1.5){float y=.5+.22*sin(u*5.2+cell*1.7)-v;float w=.13*(1.-pow(abs(u-.5)*2.,3.));
            col=mix(paper,ink,(1.-smoothstep(w-.03,w,abs(y)))*step(.2,rough));}
          else{float d=(u*6.-v*1.8)-mod(cell*1.3,3.)-1.;float slash=1.-smoothstep(.18,.24,abs(fract(d*.5)-.5)*2.);
            col=mix(ink,team*1.2,slash*step(.18,rough));}
          // The banner's ink border, top and bottom.
          col=mix(col,ink,step(v,.07)+step(.93,v));
          // A goal runs the scorer's colour round every board for three seconds, in chasing bars.
          float since=uTime-uHit.w,run=step(0.,since)*(1.-smoothstep(2.2,3.2,since));
          col=mix(col,(uHit.z<0.?uBlue:uRed)*2.2,run*step(.5,fract(vUv.x*.16-since*2.4))*step(.07,v)*step(v,.93));
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(ribbon.geometry(),led),'Ink Bowl banners');
    this.crowd(rings,tier,TIERS);this.celebration(TIERS);
    // A big screen over each end, in front of the canopy's lip, tipped down to the pitch.
    if(o.screens===false)return this.standFronts(ring,FRONT);
    const {halfZ:GZ}=GOAL_RULES,screenY=o.canopy===false?top+12:31,screenZ=o.canopy===false?GZ+FRONT+TIERS*TREAD+2:GZ+17.5;
    const spots=[-1,1].map(sz=>{const centre=new THREE.Vector3(0,screenY,sz*screenZ);
      return {centre,width:24,height:13.5,facing:new THREE.Vector3(0,8,0).sub(centre).normalize()};});
    this.screens=new MangaScreens(spots,GZ,this.time,RED,BLUE);this.root.add(this.screens.root);
    this.standFronts(ring,FRONT);
  }

  /** The camera stays on the pitch side of the stand fronts. */
  private standFronts(ring:V2[],FRONT:number){
    const wall=new THREE.MeshBasicMaterial({visible:false}),front=offsetRing(ring,FRONT-.5);
    for(let i=0;i<front.length;i++){
      const a=front[i],b=front[(i+1)%front.length],mesh=new THREE.Mesh(beam(a,b,-2,48,1),wall);
      mesh.visible=false;mesh.name='Ink Bowl stand front (camera)';this.root.add(mesh);this.occluders.push(mesh);
    }
  }

  /** A goal sets the scorer's end off (uHit: the net the ball went into and when, hype.ts): confetti fired
   *  from the top of the end wall back over their own stand, flares lit along it with smoke in the side's colour, and
   *  three rockets bursting over it. Two instanced draws worked out in the shader from the goal's clock, hidden
   *  between goals (update), so a match without a goal pays nothing for them. The place answers, not the screen. */
  private party:THREE.Mesh[]=[];
  private celebration(tiers:number){
    const {halfX:X,halfZ:Z,corner:C,wall:W}=GOAL_RULES,random=rng(7741),quad=new THREE.PlaneGeometry(1,1);
    const SPAN=num(X-C),FRONT=num(Z+BOWL.front),TREAD=num(BOWL.tread),ROWS=num(Math.max(1,tiers-3));
    const build=(name:string,kinds:[number,number,number][],material:THREE.ShaderMaterial)=>{
      // Each piece: four seeds, and what it is (its kind, which of its group's spots it belongs to, its number there).
      const seeds:number[]=[],data:number[]=[];
      for(const [kind,groups,each] of kinds)for(let j=0;j<groups;j++)for(let n=0;n<each;n++){seeds.push(random(),random(),random(),random());data.push(kind,j,n);}
      const g=new THREE.InstancedBufferGeometry();g.index=quad.index;g.setAttribute('position',quad.getAttribute('position'));g.setAttribute('uv',quad.getAttribute('uv'));
      g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),4));g.setAttribute('aData',new THREE.InstancedBufferAttribute(new Float32Array(data),3));
      g.instanceCount=data.length/3;
      const mesh=this.add(new THREE.Mesh(g,material),name);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=6;this.party.push(mesh);
    };
    const HEAD=`attribute vec4 aSeed;attribute vec3 aData;uniform float uTime;uniform vec4 uHit;uniform vec3 uRed,uBlue;
      varying vec2 vUv;varying vec4 vCol;varying float vKind;
      // The scorer's end: blue's stand is at +z, and a ball in the -z net is blue's goal.
      float endOf(){return uHit.z<0.?1.:-1.;}
      vec3 sideColour(){return uHit.z<0.?uBlue:uRed;}`;
    const uniforms=()=>({uTime:this.time,uHit:goalNetHit,uRed:{value:RED.clone()},uBlue:{value:BLUE.clone()}});
    // Confetti: 1,200 pieces from the two cannons at the scorer's end (pitchLayout.ts cannonSpot), thrown up over the cage
    // and back over the stand, slowed by the air to a flutter down onto the crowd.
    const [CX,CZ]=cannonSpot(1,1);
    build('Goal confetti',[[0,2,600]],new THREE.ShaderMaterial({
      name:'Goal confetti',side:THREE.DoubleSide,uniforms:uniforms(),
      vertexShader:`${HEAD}
        void main(){
          float e=endOf(),t=uTime-uHit.w-aSeed.w*.6-aData.y*.12;vUv=uv;vKind=0.;
          float sx=aData.y*2.-1.;
          vec3 from=vec3(sx*${num(CX)},2.2,e*${num(CZ)});
          vec3 v0=vec3(sx*(1.-aSeed.x*13.)*.9,19.+aSeed.y*13.,e*(1.5+aSeed.z*15.)),fall=vec3(0.,-1.7-aSeed.x*.9,0.);
          float k=1.5,ease=(1.-exp(-k*max(t,0.)))/k;
          vec3 p=from+(v0-fall)*ease+fall*max(t,0.);
          p.x+=sin(t*2.3+aSeed.y*40.)*.5*smoothstep(.6,2.,t);p.z+=cos(t*1.9+aSeed.x*40.)*.4*smoothstep(.6,2.,t);
          float spin=t*(5.+aSeed.z*7.)+aSeed.w*40.,show=step(0.,t)*(1.-smoothstep(7.,8.5,t));
          vec4 c=viewMatrix*vec4(p,1.);
          c.xy+=mat2(cos(spin*.37),-sin(spin*.37),sin(spin*.37),cos(spin*.37))*(position.xy*vec2(.44,.3*cos(spin)))*show;
          float pick=fract(aSeed.w*7.31);
          vCol=vec4(pick<.62?sideColour()*1.25:pick<.84?vec3(1.):vec3(1.,.78,.25),show);
          gl_Position=projectionMatrix*c;
        }`,
      fragmentShader:`varying vec4 vCol;void main(){if(vCol.a<.5)discard;gl_FragColor=vec4(vCol.rgb,1.);}`,
    }));
    // The glow: flares along the stand with their smoke (kinds 1 and 2), and the rockets' sparks (3). One blend for
    // all three: colour added, and where a piece has an alpha (the smoke) the scene behind it dimmed by it.
    build('Goal flares',[[1,8,20],[2,8,1],[3,5,150]],new THREE.ShaderMaterial({
      name:'Goal flares',transparent:true,depthWrite:false,uniforms:uniforms(),
      blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
      vertexShader:`${HEAD}
        float hash(float n){return fract(sin(n*91.7)*43758.5453);}
        // A flare's spot in the scorer's stand: spread across the end, each on a row of its own.
        vec3 spot(float j){float row=1.+floor(hash(j+3.)*${ROWS});
          return vec3((j/7.-.5)*2.*${SPAN}*.92,2.6+row*1.05,endOf()*(${FRONT}+row*${TREAD}));}
        void main(){
          float since=uTime-uHit.w,size=0.;vec3 p=vec3(0.);vUv=uv;vKind=aData.x;vCol=vec4(0.);
          vec3 side=sideColour();
          if(aData.x<1.5){
            // Smoke: a puff every third of a second from each flare for six seconds, rising, spreading and thinning.
            float born=.3+aData.y*.12+aData.z*.33,age=since-born,life=4.2+aSeed.x*1.4,a=clamp(age/life,0.,1.);
            p=spot(aData.y)+vec3((aSeed.y-.5)*1.6*a+sin(age*.9+aSeed.z*9.)*.5*a,age*(1.5+aSeed.x*.7)+age*age*.12,endOf()*age*.5);
            size=(1.6+a*4.6)*step(0.,age)*step(age,life);
            vCol=vec4(side*.75*(1.-a*.6),.6)*smoothstep(0.,.1,a)*(1.-a);
          }else if(aData.x<2.5){
            // The flare itself: a point of the side's colour burning white at its heart, for seven seconds.
            float lit=smoothstep(.2,.5,since)*(1.-smoothstep(6.,7.2,since))*step(0.,since);
            p=spot(aData.y)+vec3(0.,.5,0.);size=5.*lit*(.86+.14*sin(uTime*31.+aData.y*5.));
            vCol=vec4(side*3.2+vec3(1.6),0.)*lit;
          }else{
            // Rockets: five shells over the scorer's end, half a second apart, each a ball of sparks that slows and sinks.
            float at=.35+aData.y*.5,age=since-at,life=1.6+aSeed.w*.6,a=clamp(age/life,0.,1.);
            vec3 centre=vec3((hash(aData.y+11.)-.5)*44.,${num(W+26)}+hash(aData.y+5.)*12.,endOf()*${num(Z+BOWL.front+12)});
            float th=aSeed.x*6.2832,ph=acos(aSeed.y*2.-1.);vec3 dir=vec3(sin(ph)*cos(th),cos(ph),sin(ph)*sin(th));
            p=centre+dir*(11.+aSeed.z*7.)*(1.-exp(-2.6*max(age,0.)))-vec3(0.,max(age,0.)*max(age,0.)*1.6,0.);
            size=1.15*step(0.,age)*step(age,life);
            float shell=mod(aData.y,3.);vec3 c=shell<.5?side*2.4+vec3(.5):shell<1.5?vec3(2.6,1.9,.7):vec3(2.4)+side;
            vCol=vec4(c*(1.-a)*(1.-a)*(.7+.3*sin(uTime*40.+aSeed.w*60.)),0.);
          }
          vec4 c=viewMatrix*vec4(p,1.);c.xy+=position.xy*size;gl_Position=projectionMatrix*c;
        }`,
      fragmentShader:`varying vec2 vUv;varying vec4 vCol;varying float vKind;
        void main(){
          float r=length(vUv-.5)*2.,soft=1.-smoothstep(0.,1.,r);
          // Smoke is a soft cloud; a flare and a spark a hot core with a wide soft glow.
          float w=vKind<1.5?soft*soft:exp(-r*r*18.)+soft*soft*.22;
          gl_FragColor=vec4(vCol.rgb*w,vCol.a*w);
        }`,
    }));
    quad.dispose();
  }

  /** One instanced draw of drawn fans, a card each turned to the lens about its upright: the home end in crimson, the
   *  away end in azure, a Mexican wave running round the bowl, camera flashes popping in the dark. Two rows
   *  to a tread, shoulder to shoulder, so the stands read as full. */
  private crowd(rings:V2[][],tier:(k:number)=>{d:number;h:number},tiers:number){
    const random=rng(4219),spots:number[]=[],shirts:number[]=[],info:number[]=[],c=new THREE.Color();
    const white=new THREE.Color(0xe8e6e0),gold=new THREE.Color(0xffcf5a);
    for(let k=0;k<tiers;k++){
      const {h}=tier(k),inner=rings[k],outer=rings[k+1];
      for(const [back,lift] of CROWD_ROWS)for(let i=0;i<inner.length;i++){
        const j=(i+1)%inner.length,front=1-back;
        const ax=(inner[i][0]*front+outer[i][0]*back),az=(inner[i][1]*front+outer[i][1]*back),bx=(inner[j][0]*front+outer[j][0]*back),bz=(inner[j][1]*front+outer[j][1]*back);
        const len=Math.hypot(bx-ax,bz-az),n=Math.floor(len/CROWD_GAP),stairs=aisles(rings[0][i],rings[0][j]);
        for(let s=0;s<n;s++){
          if(random()<.05)continue;
          const t=(s+.5+(random()-.5)*.3)/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
          // An aisle of stairs every eleven metres or so along the stand, at the same share of the way along on every
          // tier, so each runs straight up the stand under its step lights.
          if(Math.abs(((t*stairs)%1)-.5)*len/stairs<.62)continue;
          spots.push(x,h+lift,z,random());
          // The colour is the fan's shirt and scarf (and flag): their end's colour, a few in white or gold.
          const roll=random(),home=z<0?RED:BLUE;
          c.copy(roll<.86?home:roll<.94?white:gold).multiplyScalar(.85+random()*.25);
          shirts.push(c.r,c.g,c.b);info.push(Math.atan2(x,z),random());
        }
      }
    }
    this.crowdMesh('Ink Bowl crowd',spots,shirts,info);
  }

  /** The crowd's one instanced draw, shared by both arenas: a card per fan (x, y, z, a seed), each fan's
   *  shirt colour, and their bearing round the place and a second seed. The fans are drawn people
   *  (public/assets/environment/own/ball-crowd.webp: 24 calm and 24 celebrating, 8 to a row in 128 x 160 px cells, the
   *  clothes in a pure green the shader turns into the fan's side colour): a fan on their feet (the wave, a goal's roar)
   *  is one of the celebrating ones. */
  private crowdMesh(name:string,spots:number[],shirts:number[],info:number[]){
    const card=new THREE.PlaneGeometry(1,1).translate(0,.5,0),geometry=new THREE.InstancedBufferGeometry();
    geometry.index=card.index;geometry.setAttribute('position',card.getAttribute('position'));geometry.setAttribute('uv',card.getAttribute('uv'));
    geometry.setAttribute('aSpot',new THREE.InstancedBufferAttribute(new Float32Array(spots),4));
    geometry.setAttribute('aShirt',new THREE.InstancedBufferAttribute(new Float32Array(shirts),3));
    geometry.setAttribute('aInfo',new THREE.InstancedBufferAttribute(new Float32Array(info),2));
    geometry.instanceCount=spots.length/4;
    const material=new THREE.ShaderMaterial({
      name,fog:true,side:THREE.DoubleSide,alphaToCoverage:true,
      uniforms:fogged({uTime:this.time,uHype:crowdHype,uHit:goalNetHit,uFans:this.fans,uTint:{value:new THREE.Color().setRGB(...CROWD_LIGHT[this.arena])}}),
      vertexShader:`attribute vec4 aSpot;attribute vec3 aShirt;attribute vec2 aInfo;uniform float uTime,uHype;uniform vec4 uHit;
        varying vec2 vUv;varying vec3 vShirt;varying float vFlash;varying float vFlag;varying float vWave;varying vec3 vCell;
        #include <fog_pars_vertex>
        void main(){
          vUv=uv;vShirt=aShirt;
          float wave=smoothstep(.6,1.,cos(aInfo.x-uTime*.5));
          // For eight seconds after a goal (uHit: the net it went into, and when) the roar is the scoring
          // side's end; the end that conceded stays down. (Red defends -z, so its fans stand at that end.)
          float since=uTime-uHit.w,goal=step(0.,since)*step(since,8.),mine=step(0.,-aSpot.z*uHit.z);
          float hype=uHype*mix(1.,mix(.12,1.,mine),goal);
          // On its feet after a goal (uHype): jumping, arms up, the calm bob and the wave under it.
          float bob=max(0.,sin(uTime*(4.+aInfo.y*3.+hype*6.)+aInfo.y*40.))*(.05+hype*.38)+wave*.32;
          float up=max(max(step(.5,wave),step(.93,fract(aInfo.y*13.7+floor(uTime*.4+aInfo.y)*.37))),step(1.-hype*.9,fract(aInfo.y*7.3)));
          // Which of the drawn fans (0-23 calm, 24-47 on their feet), and mirrored or not.
          float who=floor(fract(aInfo.y*57.31+aSpot.w*3.7)*24.)+up*24.;
          vCell=vec3(mod(who,8.),floor(who/8.),step(.5,fract(aSpot.w*91.7)));
          // A fan here and there carries a flag on a pole (a taller, wider card).
          vFlag=step(fract(aInfo.y*31.7),.022);
          vWave=uTime*(2.2+hype*3.)+aInfo.y*30.;
          vec3 base=(modelMatrix*vec4(aSpot.xyz,1.)).xyz;base.y+=bob;
          vec3 toLens=cameraPosition-base;toLens.y=0.;
          vec3 side=normalize(vec3(toLens.z,0.,-toLens.x)+vec3(1e-5,0.,0.));
          vec3 world=base+side*position.x*mix(${num(CROWD_CARD[0])},1.7,vFlag)+vec3(0.,position.y*mix(${num(CROWD_CARD[1])},2.9,vFlag),0.);
          vFlash=step(.9985,fract(sin(aInfo.y*917.3+floor(uTime*9.)*.731)*43758.5453));
          vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform sampler2D uFans;uniform vec3 uTint;
        varying vec2 vUv;varying vec3 vShirt;varying float vFlash;varying float vFlag;varying float vWave;varying vec3 vCell;
        #include <fog_pars_fragment>
        float ballRound(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
        void main(){
          if(vFlag>.5){
            // A flag on its pole over the heads, in the bearer's side colour with a white slash: the bearer is in the crowd.
            float pole=ballRound(vUv-vec2(.3,.5),vec2(.012,.5));
            vec2 c=vUv-vec2(.31,.7);float flap=sin(c.x*9.-vWave)*.05*c.x*3.;
            float flag=ballRound(vec2(c.x-.33,c.y-.08-flap),vec2(.33,.16));
            if(min(pole,flag)>0.)discard;
            vec3 col=flag<pole?mix(vShirt,vec3(.95),step(abs(c.y-.08-flap),.045))*(.8+.2*sin(c.x*9.-vWave+1.2)):vec3(.03);
            gl_FragColor=vec4(col*uTint,1.);
            #include <fog_fragment>
            return;
          }
          vec2 q=vec2(mix(vUv.x,1.-vUv.x,vCell.z),vUv.y);
          vec4 fan=texture2D(uFans,vec2((vCell.x+q.x)*.125,1.-(vCell.y+1.-q.y)*.15625));
          if(fan.a<.3)discard;
          // The drawn clothes are a pure green: the fan's side colour goes in there, the drawing's own shading kept.
          float key=smoothstep(.1,.36,fan.g-max(fan.r,fan.b));
          vec3 col=mix(fan.rgb,vShirt*(.3+fan.g*.9),key)*uTint*mix(.7,1.06,q.y);
          col=mix(col,vec3(6.),vFlash*step(.62,q.y)*step(q.y,.9));
          gl_FragColor=vec4(col,smoothstep(.3,.62,fan.a));
          #include <fog_fragment>
        }`,
    });
    const mesh=this.add(new THREE.Mesh(geometry,material),name);mesh.frustumCulled=false;
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

  // ---------------------------------------------------------------- The Wreck Yard and Rain Roof (Goal Rush)

  /** The Wreck Yard, out on the Dust Sea (the desert of wrecked ships where the ocean dried). Timber
   *  stands knocked together from deck planking, beached hulls rolled on their sides all round, their masts still up
   *  with the sides' sails torn on them, dunes running off to the horizon. */
  private wreckYard(){
    this.bowl({tiers:9,canopy:false,screens:false,riser:0x3a2a1e,name:'Wreck Yard',
      seat:(_z,k)=>new THREE.Color(0x8a6a48).lerp(new THREE.Color(0xae8a5c),k%3===2?.8:0)});
    const {halfX:X,halfZ:Z}=GOAL_RULES,parts:Part[]=[],masts:{geometry:THREE.BufferGeometry}[]=[],sails:THREE.BufferGeometry[]=[];
    const sand=new THREE.Color(0xb08f62),rust=new THREE.Color(0x7b3a26),deep=new THREE.Color(0x4a2219),deck=new THREE.Color(0x2b1e17);
    // x, z, turn, length, beam, depth, roll, how deep in the sand.
    const hulls:[number,number,number,number,number,number,number,number][]=[
      [-wreckHullX(),-4,0,64,14,8.5,.24,3],[wreckHullX(),6,Math.PI,58,13,8,-.2,2.6],
      [-(X+30),-(Z+28),Math.PI/4,36,9,6,.32,2],[X+28,Z+26,-Math.PI*.72,40,10,6.5,-.3,2.2]];
    hulls.forEach(([x,z,turn,L,B,D,roll,sink],i)=>{
      const g=hullGeometry(L,B,D,16,10).rotateZ(roll).rotateY(turn).translate(x,D-sink,z);g.computeVertexNormals();
      parts.push({geometry:g,faces:lowest=>lowest<.9?sand:lowest>D-sink-.6?deck:(Math.floor(lowest*1.3)%3===0?deep:rust)});
      // Two masts on each of the big ones, raked with the roll, a torn sail in the side's colour on each.
      if(i<2)for(const along of [-.18,.2]){
        const up=new THREE.Vector3(Math.sin(-roll),Math.cos(roll),0).applyAxisAngle(new THREE.Vector3(0,1,0),turn);
        const foot=new THREE.Vector3(0,0,along*L).applyAxisAngle(new THREE.Vector3(0,1,0),turn).add(new THREE.Vector3(x,D-sink,z));
        const h=18+i*2,top=foot.clone().addScaledVector(up,h);
        masts.push({geometry:rod([foot.x,foot.y,foot.z],[top.x,top.y,top.z],.32,8,.18)});
        const yard=top.clone().addScaledVector(up,-3),side=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),turn);
        masts.push({geometry:rod([yard.x-side.x*5,yard.y,yard.z-side.z*5],[yard.x+side.x*5,yard.y,yard.z+side.z*5],.16,6)});
        const team=z<0||(z===0&&x<0)?RED:BLUE,sail=new THREE.PlaneGeometry(9,8,10,6).translate(0,-4,0);
        const sp=sail.getAttribute('position'),reach=new Float32Array(sp.count),cols=new Float32Array(sp.count*3),rand=rng(31+i*7);
        for(let v=0;v<sp.count;v++){const t=-sp.getY(v)/8;reach[v]=t;const c=team.clone().multiplyScalar(.75+rand()*.2);cols.set([c.r,c.g,c.b],v*3);}
        sail.setAttribute('aReach',new THREE.BufferAttribute(reach,1));sail.setAttribute('color',new THREE.BufferAttribute(cols,3));sail.deleteAttribute('uv');
        sail.applyMatrix4(new THREE.Matrix4().makeBasis(side,up,new THREE.Vector3().crossVectors(side,up))).translate(yard.x,yard.y,yard.z);
        sails.push(sail.toNonIndexed());sail.dispose();
      }
    });
    // The dunes round the yard: long swells of sand out to the haze.
    const dunes=new THREE.RingGeometry(70,420,72,8).rotateX(-Math.PI/2),dp=dunes.getAttribute('position');
    for(let v=0;v<dp.count;v++){const x=dp.getX(v),z=dp.getZ(v),r=Math.hypot(x,z);dp.setY(v,(Math.sin(x*.035+z*.02)*.5+.5)*Math.min(1,(r-70)/60)*(9+Math.sin(z*.013)*6)-.3);}
    dunes.computeVertexNormals();
    parts.push({geometry:dunes.toNonIndexed(),color:new THREE.Color(0xc6a271)});dunes.dispose();
    this.add(new THREE.Mesh(bake(parts,true),stageMaterial('ball-pitch','Wreck Yard hulls',{vertexColors:true,flatShading:true,roughness:.95,side:THREE.DoubleSide})),'Wreck Yard hulls',true);
    this.add(new THREE.Mesh(bake(masts),stageMaterial('ball-pitch','Wreck Yard masts',{color:0x2a1d16,roughness:.8})),'Wreck Yard masts');
    const material=stageMaterial('ball-pitch','Wreck Yard sails',{vertexColors:true,side:THREE.DoubleSide});
    addShaderPatch(material,'ball-sail-wave',shader=>{
      shader.uniforms.uBallTime=this.time;
      shader.vertexShader='attribute float aReach;\nuniform float uBallTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*sin(aReach*4.-uBallTime*2.6+position.x*.4)*.55*aReach;');
    });
    const merged=mergeGeometries(sails)!;sails.forEach(g=>g.dispose());
    this.add(new THREE.Mesh(merged,material),'Wreck Yard sails');
  }

  /** Rain Roof, a pitch on a tower's roof over the city at night in the rain. Low concrete stands, the
   *  four floodlights, a screen at each end over the stands, the city's towers all round with their windows lit, and
   *  the rain itself falling through the lights. */
  private rainRoof(){
    this.bowl({tiers:6,canopy:false,riser:0x2c2e33,name:'Rain Roof',
      seat:(_z,k)=>new THREE.Color(0x6c6e74).lerp(new THREE.Color(0x868990),k%3===2?.8:0)});
    this.floodlights();
    // The city: towers in rings round the roof, ink-dark, lit windows on their faces.
    const random=rng(5150),towers:THREE.BufferGeometry[]=[];
    for(let k=0;k<70;k++){
      const a=random()*Math.PI*2,r=95+random()*220,w=12+random()*22,d=12+random()*22,h=30+random()*random()*160;
      towers.push(new THREE.BoxGeometry(w,h,d).translate(Math.cos(a)*r,h/2-40,Math.sin(a)*r).toNonIndexed());
    }
    const city=mergeGeometries(towers)!;towers.forEach(g=>g.dispose());
    const windows=new THREE.ShaderMaterial({
      name:'Rain Roof city',fog:true,uniforms:fogged({uTime:this.time}),
      vertexShader:`varying vec3 vWorld;varying vec3 vN;
        #include <fog_pars_vertex>
        void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;vN=normal;vec4 mvPosition=viewMatrix*vec4(vWorld,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uTime;varying vec3 vWorld;varying vec3 vN;
        #include <fog_pars_fragment>
        void main(){
          vec2 f=abs(vN.x)>.5?vWorld.zy:vWorld.xy;
          vec2 cell=floor(f/vec2(3.,3.6)),q=fract(f/vec2(3.,3.6));
          float lit=step(.62,fract(sin(dot(cell,vec2(41.3,289.1))+floor(vWorld.x*.01)*7.)*43758.5));
          float pane=step(.18,q.x)*step(q.x,.82)*step(.25,q.y)*step(q.y,.8);
          vec3 col=vec3(.018,.02,.026)+vec3(1.,.86,.6)*pane*lit*1.4*step(.5,1.-abs(vN.y));
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(city,windows),'Rain Roof city');
    // The rain: streaks falling through a box over the roof, wrapped round it, lit where the floodlights catch them.
    const COUNT=2600,quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry(),seeds=new Float32Array(COUNT*4);
    for(let i=0;i<seeds.length;i++)seeds[i]=random();
    geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));geometry.setAttribute('uv',quad.getAttribute('uv'));
    geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=COUNT;
    const rain=new THREE.ShaderMaterial({
      name:'Rain Roof rain',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:this.time},
      vertexShader:`attribute vec4 aSeed;uniform float uTime;varying vec2 vUv;varying float vFade;
        void main(){vUv=uv;
          vec3 p=vec3((aSeed.x-.5)*90.,mod(aSeed.y*40.-uTime*(24.+aSeed.w*8.),40.)-2.,(aSeed.z-.5)*110.);
          p.x+=p.y*.12;
          vec4 c=viewMatrix*vec4(p,1.);c.xy+=position.xy*vec2(.025,.9);vFade=smoothstep(-90.,-8.,c.z)*(1.-smoothstep(-6.,-1.,c.z));
          gl_Position=projectionMatrix*c;}`,
      fragmentShader:`varying vec2 vUv;varying float vFade;void main(){float a=(1.-abs(vUv.x-.5)*2.)*vUv.y*vFade*.32;gl_FragColor=vec4(vec3(.7,.78,.9)*a,1.);}`,
    });
    const drops=this.add(new THREE.Mesh(geometry,rain),'Rain Roof rain');drops.frustumCulled=false;drops.renderOrder=5;quad.dispose();
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
    const floor={
      // Tide Court: the court and its zone are beach sand, damp and darker toward the rim.
      'tide-court':`vec3 bSand=mix(${lin(0xe2cb9c)},${lin(0xd2b583)},bGrain)*(.92+texture2D(uBallNoise,bp*1.7).g*.08);
        bCol=mix(bSand,bSand*bPaint*2.,.12);bFree=bSand*.93;bRim=bSand*.84;`,
      // Ember Rim: basalt slabs for the court, black glassy rock round it split by cracks of molten light.
      'ember-rim':`vec2 bSlab=abs(fract(bp/2.1+.5)-.5)*2.1;float bJ=1.-smoothstep(.03,.06,min(bSlab.x,bSlab.y));
        vec3 bBasalt=${lin(0x4a4446)}*(.82+bGrain*.3)*(1.-bJ*.5);bCol=mix(bBasalt,bBasalt*bPaint*2.4,.2);
        float bCrack=1.-smoothstep(.0,.016,abs(texture2D(uBallNoise,bp*.07).r-.5));
        bFree=${lin(0x1f1a1b)}*(.85+bGrain*.2);bRim=${lin(0x262021)}*(.85+bGrain*.25);
        bGlow=vec3(2.,.55,.1)*bCrack*(1.-bCourt)*(.25+.75*(1.-bZone))*(.6+.4*sin(uBallTime*1.7+bp.x*.3));`,
    } as Partial<Record<BallArenaId,string>>;
    const courtInk=this.arena==='ember-rim'?lin(0xece6da):lin(0x0b0b0e);
    addShaderPatch(material,`ball-court-v2-${this.arena}`,shader=>{
      shader.uniforms.uBallNoise={value:noiseTexture()};shader.uniforms.uBallTime=this.time;
      shader.vertexShader='varying vec3 vBallWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBallWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='varying vec3 vBallWorld;\nuniform sampler2D uBallNoise;\nuniform float uBallTime;\n'+FLOOR_GLSL+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 bp=vBallWorld.xz,ba=abs(bp);vec3 bGlow=vec3(0.);
        float bCourt=step(ba.x,${num(R.courtHalfX)})*step(ba.y,${num(R.courtHalfZ)});
        float bZone=step(ba.x,${num(R.halfX)})*step(ba.y,${num(R.halfZ)});
        float bGrain=texture2D(uBallNoise,vec2(bp.x*1.6,bp.y*.07)).b*.6+texture2D(uBallNoise,bp*.2).r*.4;
        // The court: lacquered planks down its length, each side's half in its colour.
        float bPlank=floor(bp.x/.26),bTone=fract(sin(bPlank*12.9898)*43758.5453);
        float bSeam=1.-smoothstep(.006,.012+fwidth(bp.x),abs(fract(bp.x/.26+.5)-.5)*.26);
        float bJoint=1.-smoothstep(.008,.016+fwidth(bp.y),abs(fract((bp.y+bTone*3.1)/3.1+.5)-.5)*3.1);
        vec3 bWood=${lin(0xc8935a)}*(.8+bTone*.3)*(.88+bGrain*.24)*(1.-(bSeam+bJoint)*.35);
        vec3 bPaint=mix(${lin(BALL_TEAM_COLOURS.red)},${lin(BALL_TEAM_COLOURS.blue)},step(0.,bp.y));
        vec3 bCol=mix(bWood,bWood*bPaint*2.2,.22);
        bCol=mix(bCol,${lin(0x0a0a0d)},ballEnso(vec2(bp.x,ba.y-6.6),1.9,.26)*.42);
        // The free zone: pale stone raked round the court like a temple garden (paper-pale, so the ink
        // lines and the fighters' shadows read on it).
        float bRake=.5+.5*sin(ballBox(bp,vec2(${num(R.courtHalfX)},${num(R.courtHalfZ)}))*17.);
        vec3 bFree=${lin(0xb3a993)}*(.86+bGrain*.18)*(.88+bRake*.16);
        // The rim beyond the barrier: weathered tiles, petals fallen under the trees.
        vec2 bTile=abs(fract(bp/1.6+.5)-.5)*1.6;
        vec3 bRim=${lin(0x8a8174)}*(.85+bGrain*.25)*(1.-(1.-smoothstep(.02,.04,min(bTile.x,bTile.y)))*.4);
        float bPetal=step(.7,texture2D(uBallNoise,bp*.85).a)*(1.-smoothstep(2.5,6.5,length(ba-vec2(${num(TX)},${num(TZ)}))));
        bRim=mix(bRim,${lin(0xffb3cc)},bPetal*.85);
        ${floor[this.arena]??''}
        vec3 bFloor=mix(bRim,mix(bFree,bCol,bCourt),bZone);
        // The lines: the court, the centre line under the net, service circles, quarter circles at the net, the
        // attack lines dashed, and a gold line round the free zone.
        float bL=ballLine(ballBox(bp,vec2(${num(R.courtHalfX)},${num(R.courtHalfZ)})),.055);
        bL=max(bL,ballLine(bp.y,.055)*step(ba.x,${num(R.courtHalfX)}));
        bL=max(bL,ballLine(length(vec2(bp.x,ba.y-${num(R.courtHalfZ-2.45)}))-.45,.05));
        bL=max(bL,ballLine(length(vec2(ba.x-${num(R.courtHalfX)},bp.y))-1.5,.05)*step(ba.x,${num(R.courtHalfX)}));
        bL=max(bL,ballLine(ba.y-3.3,.045)*step(ba.x,${num(R.courtHalfX)})*step(.45,fract(bp.x*.9)));
        // The lines in ink, a brush's width, dry where the brush ran out.
        bL=max(bL,ballLine(ballBox(bp,vec2(${num(R.courtHalfX)},${num(R.courtHalfZ)})),.085));
        float bDry=step(.64,texture2D(uBallNoise,bp*vec2(2.3,2.9)).r)*.7;
        bFloor=mix(bFloor,${courtInk},bL*.95*(1.-bDry*(1.-smoothstep(.4,.95,bL))));
        bFloor=mix(bFloor,${lin(0xd9a441)},ballLine(ballBox(bp,vec2(${num(R.halfX)},${num(R.halfZ)}))+.3,.07));
        diffuseColor.rgb*=bFloor;`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,.4,bCourt);`).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=bGlow;`);
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
    // The Tide Court lies on the beach itself, with no rock under it.
    if(this.arena==='tide-court'){edge.geometry().dispose();rock.dispose();return;}
    this.add(new THREE.Mesh(edge.geometry(),stageMaterial('ball-court','Sky Court edge',{vertexColors:true,side:THREE.DoubleSide})),'Sky Court edge');
    this.add(new THREE.Mesh(rock,stageMaterial('ball-court','Sky Court rock',{color:this.arena==='ember-rim'?0x231c1d:0x6a585c,flatShading:true,side:THREE.DoubleSide})),'Sky Court rock');
  }

  /** The net, where the sim has it (physics.ts court): across z = 0 and SPIKE_RULES.netPost past each sideline, its cord
   *  at netHeight, its posts the capsules the ball rings off. The fighters' wall over it is the server's (STAGE_LANDMARKS). */
  private net(){
    const R=SPIKE_RULES,NX=R.courtHalfX+R.netPost,NH=R.netHeight,mesh=new Quads();
    mesh.add([-NX,0,0],[NX,0,0],[NX,NH,0],[-NX,NH,0],{uv:[-NX,0,NX,NH]});
    const material=new THREE.ShaderMaterial({
      name:'Sky Court net',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
      uniforms:fogged({uTime:this.time,uSheer:netSheer}),
      vertexShader:`uniform float uTime;varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vec3 p=position;p.z+=sin(uTime*1.6+p.x*.7)*.03*sin(clamp(p.y/${num(NH)},0.,1.)*3.14159);
          vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uSheer;varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){
          // A woven rattan net, square, honey-coloured, black tape top and bottom.
          vec2 d=vUv/.15;
          vec2 q=abs(fract(d)-.5),fw=fwidth(d);
          float cord=max(smoothstep(.5-.09-fw.x,.5-.09,q.x),smoothstep(.5-.09-fw.y,.5-.09,q.y));
          float knot=(1.-smoothstep(.0,.12,abs(.5-q.x)))*(1.-smoothstep(.0,.12,abs(.5-q.y)));
          cord=mix(max(cord,knot),.34,clamp((max(fw.x,fw.y)-.22)*2.4,0.,1.));
          float tape=step(${num(NH-.13)},vUv.y)+step(vUv.y,.07);
          float side=1.-smoothstep(.035,.06,abs(abs(vUv.x)-${num(R.courtHalfX)}));
          float white=clamp(tape+side,0.,1.);
          // (The COURT-SIDE camera looks at the far court through the net (SpikeCam, ballCamChoice.ts netSheer):
          // for it the weave is drawn at about a quarter of its opacity and the tapes at three quarters; at 0, the net as it was.)
          float a=max(cord*.92*(1.-.74*uSheer),white*(1.-.25*uSheer));
          if(a<.02)discard;
          gl_FragColor=vec4(mix(vec3(.62,.42,.2)*(.8+.2*sin(vUv.x*40.)),vec3(.02,.018,.02),white),a);
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(mesh.geometry(),material),'Sky Court net').renderOrder=2;
    const black:{geometry:THREE.BufferGeometry}[]=[],gold:{geometry:THREE.BufferGeometry;color:THREE.Color}[]=[];
    black.push({geometry:rod([-NX,NH,0],[NX,NH,0],.05,6)});
    for(const sx of [-1,1]){
      // Carved stone pillars: a plinth, a shaft with three carved bands, a capstone over the net.
      black.push({geometry:rod([sx*NX,0,0],[sx*NX,NH+.55,0],.2,10)},{geometry:new THREE.CylinderGeometry(.42,.5,.4,10).translate(sx*NX,.2,0)},
        {geometry:new THREE.CylinderGeometry(.34,.26,.3,10).translate(sx*NX,NH+.7,0)});
      for(const y of [.8,1.6,2.35])black.push({geometry:new THREE.CylinderGeometry(.25,.25,.1,10).translate(sx*NX,y,0)});
      gold.push({geometry:new THREE.SphereGeometry(.17,12,8).translate(sx*NX,NH+.95,0),color:new THREE.Color(0xd9a441).multiplyScalar(1.4)});
      // The antennae over the court's sidelines, red and white.
      for(let k=0;k<8;k++)gold.push({geometry:rod([sx*R.courtHalfX,NH+k*.11,0],[sx*R.courtHalfX,NH+(k+1)*.11,0],.022,6),color:k%2?new THREE.Color(0xf2f0ea):RED.clone().multiplyScalar(1.3)});
    }
    const posts=this.add(new THREE.Mesh(bake(black),stageMaterial('ball-court','Net pillars',{color:0x8c8172,roughness:.85,flatShading:true})),'Net pillars');posts.castShadow=true;
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
  private petals(o:{tint?:[string,string];rise?:boolean;glow?:number;name?:string}={}){
    const [ta,tb]=o.tint??['vec3(1.,.55,.7)','vec3(1.,.86,.92)'];
    const COUNT=240,random=rng(5150),seeds=new Float32Array(COUNT*4);for(let i=0;i<seeds.length;i++)seeds[i]=random();
    const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
    geometry.index=quad.index;geometry.setAttribute('position',quad.getAttribute('position'));geometry.setAttribute('uv',quad.getAttribute('uv'));
    geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=COUNT;
    const material=new THREE.ShaderMaterial({
      name:o.name??'Sky Court petals',side:THREE.DoubleSide,fog:true,
      uniforms:fogged({uTime:this.petalTime,uMood:arenaMood,uMin:{value:new THREE.Vector3(-26,0,-30)},uSize:{value:new THREE.Vector3(52,15,60)}}),
      vertexShader:`attribute vec4 aSeed;uniform float uTime;uniform vec3 uMin,uSize;varying vec2 vUv;varying float vTone;
        #include <fog_pars_vertex>
        mat3 rotAxis(vec3 a,float t){float c=cos(t),s=sin(t),k=1.-c;return mat3(c+a.x*a.x*k,a.y*a.x*k+a.z*s,a.z*a.x*k-a.y*s,a.x*a.y*k-a.z*s,c+a.y*a.y*k,a.z*a.y*k+a.x*s,a.x*a.z*k+a.y*s,a.y*a.z*k-a.x*s,c+a.z*a.z*k);}
        void main(){
          vUv=uv;vTone=aSeed.w;
          vec3 f=fract(aSeed.xyz+vec3(.45,${o.rise?'.9':'-.8'},.12)*(.6+aSeed.w*.7)*uTime/uSize);
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
          vec3 col=mix(${ta},${tb},vTone*.6+(1.-length(p))*.4)*${num(o.glow??1)};
          // A FEVER rally turns the storm to gold.
          col=mix(col,mix(vec3(1.,.72,.25),vec3(1.,.92,.55),vTone),uMood*.85);
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    const mesh=this.add(new THREE.Mesh(geometry,material),o.name??'Sky Court petals');mesh.frustumCulled=false;quad.dispose();
  }

  /** The sea of cloud far below, cel-banded in the sunset's colours, and towers of cloud standing out of it - flat
   *  cut-outs turned to the lens, slowly wheeling. */
  private cloudSea(o:{lava?:boolean}={}){
    // The Ember Rim's sea is lava: a dark crust, cracks of molten light between its plates; its cloud
    // towers are smoke.
    const L=o.lava?{low:lin(0x1c0e0b),high:lin(0x3a1611),hot:'vec3(3.2,.9,.18)',smokeLow:lin(0x1e1414),smokeHigh:lin(0x4a3230),smokeTop:lin(0x8a5a40)}
      :{low:lin(0x6d4f86),high:lin(0xe39a9a),hot:lin(0xffd7b0),smokeLow:lin(0x7a5b93),smokeHigh:lin(0xf2a9a2),smokeTop:lin(0xffe0bd)};
    const sea=new THREE.ShaderMaterial({
      name:o.lava?'Lava sea':'Cloud sea',fog:true,
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
          vec3 col=mix(${L.low},${L.high},band);
          col=mix(col,${L.hot},${o.lava?'1.-smoothstep(.0,.025,abs(n-.5))':'smoothstep(.68,.72,n)'});
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
          vec3 col=mix(${L.smokeLow},${L.smokeHigh},smoothstep(.45,.55,lit));
          col=mix(col,${L.smokeTop},smoothstep(.82,.86,lit)*step(.12,h));
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        }`,
    });
    const clouds=this.add(new THREE.Mesh(geometry,puff),'Cloud towers');clouds.frustumCulled=false;quad.dispose();
  }

  /** A few islands of rock floating round the court, flat-topped and mossy, two with a little cherry tree and one with
   *  a red gate, each bobbing on its own beat: one draw. */
  private islands(o:{dark?:boolean}={}){
    const random=rng(808),parts:Part[]=[];
    const rock=new THREE.Color(o.dark?0x221b1c:0x6b5759),moss=new THREE.Color(o.dark?0x3a2420:0x87915a),pink=new THREE.Color(0xf09ab9),gate=new THREE.Color(0xc8283a),wood=new THREE.Color(0x2a1c1d);
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
      if(!o.dark&&(i===1||i===4)){
        parts.push({geometry:rod([x,deck,z],[x+1,deck+s*.35,z],s*.06,6),color:wood,bob});
        for(let k=0;k<3;k++)parts.push({geometry:new THREE.IcosahedronGeometry(s*(.16+random()*.08),1).translate(x+1+(random()-.5)*s*.3,deck+s*(.4+random()*.12),z+(random()-.5)*s*.3),color:pink,bob});
      }
      if(!o.dark&&i===2){
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

  /** Tide Court, a beach at dusk. The court lies in the sand, the sea runs in round three sides with its
   *  foam breaking on the shore, sea stacks and an arch of rock stand out in the water, each side's fans sit on stands
   *  dug into the dunes behind their baseline, and the flags stand out in the sea wind. */
  private tideCourt(){
    const beach=new THREE.Mesh(new THREE.CircleGeometry(150,64).rotateX(-Math.PI/2),stageMaterial('ball-court','Tide Court beach',{color:0xd6bb8a,roughness:1}));
    beach.position.y=-.03;this.add(beach,'Tide Court beach',true);
    const sea=new THREE.ShaderMaterial({
      name:'Tide Court sea',fog:true,transparent:true,depthWrite:false,
      uniforms:fogged({uTime:this.time,uNoise:{value:noiseTexture()}}),
      vertexShader:`varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      // The shore runs round the court at about 46 m, nearer on the open side; the swell's crests come in toward it in
      // bands of foam; out past the breakers the water darkens and takes the dusk's colour.
      fragmentShader:`uniform sampler2D uNoise;uniform float uTime;varying vec3 vWorld;
        #include <fog_pars_fragment>
        void main(){
          vec2 p=vWorld.xz;float r=length(p*vec2(1.,.8))+(texture2D(uNoise,p*.01).r-.5)*10.;
          float shore=46.+sin(atan(p.y,p.x)*3.+.6)*6.;float out_=r-shore;
          if(out_<0.)discard;
          float swell=sin(out_*.55-uTime*1.4+texture2D(uNoise,p*.02).g*4.);
          float foam=smoothstep(.86,.98,swell)*(1.-smoothstep(4.,26.,out_))+(1.-smoothstep(0.,2.2,out_))*.9;
          vec3 deep=mix(${lin(0x2c6f86)},${lin(0x1c3a5e)},smoothstep(5.,60.,out_));
          deep=mix(deep,${lin(0xe0906e)},smoothstep(40.,140.,out_)*.35);
          vec3 col=mix(deep,vec3(.95,.94,.9),foam);
          gl_FragColor=vec4(col,smoothstep(0.,1.2,out_)*.92+.08);
          #include <fog_fragment>
        }`,
    });
    const water=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400).rotateX(-Math.PI/2),sea);water.position.y=.02;this.add(water,'Tide Court sea').renderOrder=1;
    // Sea stacks and an arch out in the water.
    const random=rng(4402),parts:Part[]=[],rockCol=new THREE.Color(0x5a4f4a),moss=new THREE.Color(0x6f7a4c);
    const stack=(x:number,z:number,w:number,h:number,seed:number)=>{
      const g=new THREE.CylinderGeometry(w*.7,w,h,9,5).toNonIndexed(),p=g.getAttribute('position');
      for(let v=0;v<p.count;v++){const y=p.getY(v),k=1+Math.sin(p.getX(v)*3.1+y*1.7+seed)*.12+Math.sin(p.getZ(v)*2.3+seed*3.)*.1;p.setX(v,p.getX(v)*k);p.setZ(v,p.getZ(v)*k);}
      g.translate(x,h/2-1,z);g.computeVertexNormals();parts.push({geometry:g,faces:lowest=>lowest>h-2.5?moss:rockCol});
    };
    stack(-62,-30,6,26,1);stack(-70,-12,4,17,2);stack(58,-46,5,21,3);stack(80,30,7,30,4);stack(-50,58,5,19,5);
    // The arch: two legs and a span.
    stack(30,-78,6,24,6);stack(52,-72,6,22,7);
    const span=new THREE.TorusGeometry(11.5,4.2,8,14,Math.PI).rotateY(-.27).translate(41,20,-75).toNonIndexed();span.computeVertexNormals();
    parts.push({geometry:span,color:rockCol});
    for(let k=0;k<14;k++){const a=random()*Math.PI*2,d=36+random()*10;const g=new THREE.IcosahedronGeometry(1+random()*1.8,1).scale(1,.6,1).translate(Math.cos(a)*d,0,Math.sin(a)*d*.85);parts.push({geometry:g.toNonIndexed(),color:rockCol});g.dispose();}
    this.add(new THREE.Mesh(bake(parts,true),stageMaterial('ball-court','Tide Court rocks',{vertexColors:true,flatShading:true})),'Tide Court rocks');
    this.standIslands({y0:-.2,crag:false,stone:0xc7b089,dark:0x8a7656,name:'Tide Court stands'});
    this.banners();
  }

  /** Ember Rim, a court of basalt on the lip of a volcano. Black rock split with molten cracks, a sea of
   *  lava far below with smoke standing out of it, jagged spires of the crater's rim all round, black rocks floating in
   *  the heat, each side's fans on terraces of black stone, and embers rising past everything. */
  private emberRim(){
    this.cloudSea({lava:true});
    this.islands({dark:true});
    this.standIslands({stone:0x4a4244,dark:0x2a2425,rock:0x1d1718,name:'Ember Rim terraces'});
    this.petals({tint:['vec3(1.,.38,.08)','vec3(1.,.75,.3)'],rise:true,glow:2.4,name:'Ember Rim embers'});
    this.banners();
    // The crater's rim: spires of black rock standing round the court at a distance, glowing at their feet.
    const random=rng(6606),parts:Part[]=[],black=new THREE.Color(0x1b1516),hot=new THREE.Color(0x6a2414);
    for(let k=0;k<26;k++){
      const a=k/26*Math.PI*2+random()*.2,d=58+random()*36,h=18+random()*42,w=3+random()*6;
      const g=new THREE.ConeGeometry(w,h,6,3).toNonIndexed(),p=g.getAttribute('position');
      for(let v=0;v<p.count;v++){const y=p.getY(v),k2=1+Math.sin(p.getX(v)*2.1+y*.9+k)*.18;p.setX(v,p.getX(v)*k2+Math.sin(y*.2+k)*.8);p.setZ(v,p.getZ(v)*k2);}
      g.translate(Math.cos(a)*d,h/2-18,Math.sin(a)*d);g.computeVertexNormals();
      parts.push({geometry:g,faces:lowest=>lowest<-12?hot:black});
    }
    this.add(new THREE.Mesh(bake(parts,true),stageMaterial('ball-court','Ember Rim spires',{vertexColors:true,flatShading:true})),'Ember Rim spires');
  }

  /** Water pouring off the island's edges into the clouds, two at each long side and one at each end:
   *  ribbons that fall and fan out, white water streaking down them, thinning into mist as they reach the cloud sea. */
  private waterfalls(){
    const {x:PX,z:PZ}=BallArena.PLATFORM,falls:THREE.BufferGeometry[]=[];
    const spots:[number,number,number][]=[[PX,-11,1],[PX,9,1],[-PX,-7,-1],[-PX,12,-1]];
    const add=(x:number,z:number,nx:number,nz:number,width:number)=>{
      const g=new THREE.PlaneGeometry(width,70,6,24).translate(0,-35,0),p=g.getAttribute('position');
      for(let i=0;i<p.count;i++){const y=-p.getY(i),t=y/70;p.setX(i,p.getX(i)*(1+t*1.6));p.setZ(i,Math.sqrt(y)*1.1+t*t*6);}
      g.rotateY(Math.atan2(nx,nz)).translate(x,-.3,z);falls.push(g.toNonIndexed());g.dispose();
    };
    for(const [x,z,s] of spots)add(x+s*.1,z,s,0,3.4);
    add(-4,PZ+.1,0,1,4);add(5,-PZ-.1,0,-1,4);
    const geometry=mergeGeometries(falls)!;falls.forEach(f=>f.dispose());
    const material=new THREE.ShaderMaterial({
      name:'Sky Court waterfalls',transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
      uniforms:fogged({uTime:this.time,uNoise:{value:noiseTexture()}}),
      vertexShader:`varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uTime;uniform sampler2D uNoise;varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){
          float fall=1.-vUv.y;
          float streak=texture2D(uNoise,vec2(vUv.x*2.6,vUv.y*.9+uTime*.55)).r*.6+texture2D(uNoise,vec2(vUv.x*6.1,vUv.y*2.2+uTime*1.3)).g*.4;
          float edge=smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x);
          float mist=smoothstep(.55,1.,fall);
          float a=edge*mix(.55+streak*.45,.35*streak,mist)*(1.-smoothstep(.85,1.,fall));
          vec3 col=mix(vec3(.62,.78,.86),vec3(1.),smoothstep(.45,.75,streak)+mist*.5);
          gl_FragColor=vec4(col,a);
          #include <fog_fragment>
        }`,
    });
    this.add(new THREE.Mesh(geometry,material),'Sky Court waterfalls').renderOrder=1;
  }

  /** A floating island behind each baseline, terraced into stone stands and packed with each side's
   *  fans (the ink crowd of the Ink Bowl, in the side's scarves), bobbing a little on the wind. */
  private standIslands(o:{y0?:number;crag?:boolean;stone?:number;dark?:number;rock?:number;name?:string}={}){
    const {z:PZ}=BallArena.PLATFORM,random=rng(9137),parts:Part[]=[],spots:number[]=[],shirts:number[]=[],info:number[]=[];
    const stone=new THREE.Color(o.stone??0x9a907f),dark=new THREE.Color(o.dark??0x4a4440),rock=new THREE.Color(o.rock??0x6a585c);
    const TIERS=7,TREAD=1.5,RISE=1.1,HALF=17,white=new THREE.Color(0xe8e6e0),gold=new THREE.Color(0xffcf5a),c=new THREE.Color();
    for(const sz of [-1,1]){
      const z0=sz*(PZ+11),y0=o.y0??-1.5,team=sz<0?RED:BLUE;
      for(let k=0;k<TIERS;k++){
        const z=z0+sz*k*TREAD,y=y0+k*RISE;
        parts.push({geometry:new THREE.BoxGeometry(HALF*2-k*.6,RISE,TREAD).translate(0,y+RISE/2,z+sz*TREAD/2),color:k%3===2?dark:stone});
        // Two rows to a tread, shoulder to shoulder, as in the bowl.
        for(const [back,lift] of CROWD_ROWS)for(let x=-HALF+1+k*.3;x<HALF-1-k*.3;x+=CROWD_GAP){
          if(random()<.06||Math.abs(x%9)<.9)continue;
          spots.push(x+(random()-.5)*.2,y+RISE+lift,z+sz*TREAD*back,random());
          const roll=random();c.copy(roll<.86?team:roll<.94?white:gold).multiplyScalar(.85+random()*.25);
          shirts.push(c.r,c.g,c.b);info.push(Math.atan2(x,z),random());
        }
      }
      // The crag under the stands.
      if(o.crag===false)continue;
      const g=new THREE.ConeGeometry(1,1,14,4,true).toNonIndexed(),p=g.getAttribute('position');
      for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),zz=p.getZ(i),n=Math.sin(x*9.1+zz*7.3+sz)*.5+.5;
        p.setXYZ(i,x*(HALF+2)*(1+n*.1),y0-(y+.5)*26*(1+n*.25),zz*(TIERS*TREAD*.75)*(1+n*.1)+z0+sz*TIERS*TREAD*.5);}
      g.computeVertexNormals();
      parts.push({geometry:g,color:rock});
    }
    this.add(new THREE.Mesh(bake(parts,true),stageMaterial('ball-court',o.name??'Stand islands',{vertexColors:true,flatShading:true,side:THREE.DoubleSide})),o.name??'Stand islands');
    this.crowdMesh('Sky Court crowd',spots,shirts,info);
  }
}
