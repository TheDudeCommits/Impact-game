import * as THREE from 'three';
import {bodyBulk} from './CameraDirector';
import {StageFade} from './StageFade';
import type {Fighter} from './Fighter';

/** Occlusion fading (round 3b, the blind critic: "nothing fades out when it
 *  gets between camera and action: capes, hair and bystanders fill 30-50% of
 *  the frame").
 *
 *  A fighter that has to thin out is drawn, for as long as it does, with a
 *  twin of each of its materials that carries one ordered-dither test: a
 *  fragment is dropped - a 4x4 screen-door, so the body thins evenly and the
 *  room shows through - by the largest of three amounts:
 *
 *  body    the whole fighter, for a bystander (neither the player nor the
 *          target, nor anybody an authored shot is about) that stands nearer
 *          the lens than one of them and hides COVER_FROM..COVER_FULL of them
 *          on screen, or that fills CROWD_FROM..CROWD_FULL of the frame from
 *          nearer than all of them - the Konta torso over Royal Aurora, the
 *          hair over half the screen after Kenzo's ultimate. Up to FADE_MOST: a
 *          trace is left, so nobody vanishes from a fight;
 *  window  the player's own body where it passes in front of the target on
 *          screen (a cape, a coat, a sword swung across them) once it hides
 *          WINDOW_FROM of them, up to WINDOW_MOST, feathered at the
 *          target's edges, and let go at SUBJECT_OUT;
 *  near    anything of anybody within NEAR_CLEAR of the lens, all of it by
 *          NEAR_GONE: a lens that ends up inside a body - a Full Swell arm,
 *          a victim thrown past the shot - sees through it, not its inside.
 *
 *  Only while a fighter needs it: a shader that may discard costs Apple's
 *  hidden-surface removal everything drawn behind it (measured on the M4, Full
 *  Swell's giant fist with the test on every fighter all the time: 8.3-9.3 ms of GPU a
 *  frame against 6.8-7.3, p95 15.4 against 8.6). The twins are compiled with
 *  the load-time warm-up - the warm-up fighters carry hidden proxies drawn
 *  with them - so swapping one in never links a program mid-match. While it is
 *  shown, a twin copies what the fighter's own code sets on the original each
 *  frame (opacity, colour, glow, visibility).
 *
 *  Each amount eases in at FADE_IN and out at FADE_OUT (1/s): a fade is a
 *  fade and never a pop - except that a faded bystander who becomes the
 *  target (the player turns and swings at them) comes back at SUBJECT_OUT.
 *  The shadow pass keeps its own materials, so a faded body still casts its
 *  shadow.
 *
 *  And one thing more on its own: Ward's surgery (the model's own
 *  translucent sphere, `awaken-on`, 2.4 m across round him). From inside it
 *  every pixel looks through its far wall, and the whole view was tinted
 *  blue for its 18 s; from the lock-on lens just outside it, Ward himself was
 *  only ever seen through its near wall. So its faces toward the lens keep
 *  SURGERY_CLEAR of their tint with the lens inside and SURGERY_OUTSIDE of the way
 *  there from outside, and only its grazing edges keep all of it: the dome
 *  reads as a dome round the fight - a bright rim - rather than a filter. */
const NEAR_GONE=.3,NEAR_CLEAR=.75;
/** Goal Rush's SPORT camera stands about ten metres off the body it follows, high and
 *  behind (render/ball/BallChase.ts FOOT), so a body between it and the play - a team-mate's cape or wings, a big body run
 *  past the lens - is within a few metres of it, not inside it: with `OcclusionFader.wideNear` the near band is
 *  WIDE_GONE..WIDE_CLEAR m (all of it gone, none of it). */
const WIDE_GONE=2.2,WIDE_CLEAR=4.4;
/** So a body between the camera and the person never turns into a fading dot pattern that reads as noise: under that
 *  camera (`wideNear`) a body is thinned as GLASS - evenly, the whole of it at
 *  once (its nearest joint's distance from the lens, never fragment by fragment), on a pixel-fine two-by-two screen at
 *  most GLASS_MOST of it gone (every other pixel: an even half), its ink outline dropped (no dark dots) and what is left of
 *  it lifted GLASS_LIFT toward white - a light, see-through ghost of the body. */
const GLASS_MOST=.55,GLASS_LIFT=.6;
const FADE_MOST=.82,WINDOW_MOST=.55,WINDOW_FROM=.35;
/** Round 3c: through an authored shot about the victim (see shotVictim) the
 *  player's own body opens its window over the victim once it hides
 *  WINDOW_SHOT_FROM of them, up to WINDOW_SHOT_MOST - the second blind
 *  critic's "fade the caster's coat or cape": measured in training, Gaunt'
 *  cape hid 23-86% of the victim through the swing and the release. */
const WINDOW_SHOT_FROM=.12,WINDOW_SHOT_MOST=.72;
const COVER_FROM=.06,COVER_FULL=.3,CROWD_FROM=.1,CROWD_FULL=.24,FADE_IN=9,FADE_OUT=3.5,SUBJECT_OUT=14;
const SELF_FROM=.1,SELF_FULL=.4,SELF_MOST=.8,SELF_IN=30;
/** In an ordinary close manual duel, padded joint rectangles overstate an
 *  overlap by including extended arms/coat edges. Preserve the local face
 *  and torso at moderate coverage; genuine torso occlusion still reaches
 *  the original strong window. This never changes the near-lens test. */
const DUEL_WINDOW=.15,DUEL_COVER_FROM=.45,DUEL_COVER_FULL=.65;
/** A body counts as in front of a subject when it is at least AHEAD metres
 *  nearer the lens than the subject's middle. */
const AHEAD=.35;
/** Each body is taken as its joints (see JOINTS) padded by PAD times its
 *  bulk: a joint is inside the silhouette, not on it. A body without them, or
 *  showing a form's model, is its root to CROWN over it (times its bulk). A
 *  body whose padded joints come within NEAR_REACH of the near band is drawn
 *  with its twins, so the band can clear what reaches into it. */
const PAD=.32,CROWN=1.9,NEAR_REACH=.45;
const JOINTS=['Head','Hips','LeftFoot','RightFoot','LeftHand','RightHand','LeftShoulder','RightShoulder'] as const;
/** Ward's SURGERY: its faces toward a lens inside it keep SURGERY_CLEAR of their
 *  tint (eased in over the last SURGERY_EDGE of the radius), toward a lens
 *  outside it SURGERY_OUTSIDE of the way to that; its grazing edges all of it. */
const SURGERY_CLEAR=.12,SURGERY_EDGE=.25,SURGERY_OUTSIDE=.6;

/** The uniforms every twin shares: the lens, the near band, the target's box
 *  on screen (normalised device coordinates) and its depth from the lens. */
const shared={
  uOccEye:{value:new THREE.Vector3(0,-1e4,0)},
  uOccNear:{value:new THREE.Vector2(NEAR_GONE,NEAR_CLEAR)},
  uOccRect:{value:new THREE.Vector4(2,2,2,2)},
  uOccRectDepth:{value:0},
  /** 1 while the football camera films (GLASS), else 0. */
  uOccGlass:{value:0},
};
/** The fade's lens-bound uniforms (the eye, the target's window), as the split screen saves and puts back each half's
 *  (couch/viewState.ts). */
export const occlusionUniforms=shared;
const PARS=/* glsl */`
uniform vec2 uOccFade;
uniform vec3 uOccEye;
uniform vec2 uOccNear;
uniform vec4 uOccRect;
uniform float uOccRectDepth;
uniform float uOccGlass;
uniform float uOccInk;
float occDrop = 0.0;
varying vec3 vOccWorld;
varying vec3 vOccClip;
const float OCC_BAYER[16] = float[16]( 0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5. );
bool occlusionDropped() {
	float drop = max( uOccFade.x, uOccGlass > .5 ? 0.0 : 1.0 - smoothstep( uOccNear.x, uOccNear.y, distance( vOccWorld, uOccEye ) ) );
	if ( uOccFade.y > 0.0 && vOccClip.z > 0.05 && vOccClip.z < uOccRectDepth ) {
		vec2 ndc = vOccClip.xy / vOccClip.z;
		vec2 feather = max( ( uOccRect.zw - uOccRect.xy ) * .18, vec2( .02 ) );
		vec2 inside = smoothstep( uOccRect.xy - feather, uOccRect.xy + feather, ndc ) * ( 1.0 - smoothstep( uOccRect.zw - feather, uOccRect.zw + feather, ndc ) );
		drop = max( drop, uOccFade.y * inside.x * inside.y );
	}
	occDrop = drop;
	if ( drop <= .004 ) return false;
	if ( uOccGlass > .5 ) {
		if ( uOccInk > .5 && drop > .12 ) return true;
		ivec2 c2 = ivec2( mod( gl_FragCoord.xy, 2.0 ) );
		float th = c2.y == 0 ? ( c2.x == 0 ? .125 : .625 ) : ( c2.x == 0 ? .875 : .375 );
		return th < drop;
	}
	ivec2 cell = ivec2( mod( gl_FragCoord.xy, 4.0 ) );
	return ( OCC_BAYER[ cell.y * 4 + cell.x ] + .5 ) / 16. < drop;
}
`;
const KEY='occlusion-fade-v3',ROOM_KEY='occlusion-room-v1';
/** The dither, into a shader about to compile (see PARS). */
function ditherShader(shader:THREE.WebGLProgramParametersWithUniforms,fade:{value:THREE.Vector2},ink:{value:number}){
  Object.assign(shader.uniforms,shared);shader.uniforms.uOccFade=fade;shader.uniforms.uOccInk=ink;
  shader.vertexShader='varying vec3 vOccWorld;\nvarying vec3 vOccClip;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n\tvOccWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n\tvOccClip = gl_Position.xyw;');
  shader.fragmentShader=PARS+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n\tif ( occlusionDropped() ) discard;');
  // (GLASS: what is left of a thinned body lifted toward white - light, not a dark half-tone - in its light, before the
  // finish: every lit material and the toon finish end on opaque_fragment.)
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if ( uOccGlass > .5 && occDrop > .004 ) outgoingLight = mix( outgoingLight, vec3( 1.0 ), ${GLASS_LIFT.toFixed(3)} * min( 1.0, occDrop / ${GLASS_MOST.toFixed(3)} ) );\n\t#include <opaque_fragment>`);
}
const twins=new WeakSet<THREE.Material>();
/** A material's twin: the same material, the same edits, and the dither. */
function twinOf(original:THREE.Material,fade:{value:THREE.Vector2},ink=false){
  const twin=original.clone(),compile=original.onBeforeCompile,inkFlag={value:ink?1:0};
  twin.onBeforeCompile=function(shader,renderer){compile.call(original,shader,renderer);ditherShader(shader,fade,inkFlag);};
  // The default key is onBeforeCompile's source, which is now this one's.
  const inherited=original.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey?compile.toString():undefined;
  twin.customProgramCacheKey=()=>`${inherited??original.customProgramCacheKey()}|${KEY}`;
  twins.add(twin);
  return twin;
}

interface Twin{mesh:THREE.Mesh;slot:number;original:THREE.Material;twin:THREE.Material}
interface FadeState{
  /** x: the whole body, y: the window over the target (see WINDOW_MOST). */
  fade:{value:THREE.Vector2};
  body:number;window:number;
  /** This frame's box on screen (normalised device coordinates), its depth
   *  from the lens (the nearest point and the middle), how near the lens its
   *  nearest padded joint comes, and whether it is in front of the lens. */
  x0:number;y0:number;x1:number;y1:number;near:number;mid:number;lens:number;seen:boolean;
  twins:Twin[];swapped:boolean;
  /** Ward's SURGERY, if the fighter has one: its mesh and how far inside it the
   *  lens is. */
  room?:THREE.Mesh;inside:{value:number};
}
const records=new WeakMap<object,FadeState>();

/** Give `fighter` - its body, its ink, a form it carries - a twin of every
 *  material it draws with, on one fade of its own (see the notes above). Call
 *  it once, when the fighter is built; a warm-up fighter (`warm-*`) also gets
 *  hidden proxies of its meshes drawn with the twins, so the load-time
 *  compile links their programs. */
export function installOcclusionFade(fighter:Fighter){
  if(records.has(fighter))return;
  const record:FadeState={fade:{value:new THREE.Vector2()},body:0,window:0,x0:0,y0:0,x1:0,y1:0,near:0,mid:0,lens:Infinity,seen:false,twins:[],swapped:false,inside:{value:0}};
  records.set(fighter,record);
  const meshes:THREE.Mesh[]=[];
  fighter.group.traverse(object=>{if((object as THREE.Mesh).isMesh)meshes.push(object as THREE.Mesh);});
  const warm=fighter.state.id.startsWith('warm-');
  for(const mesh of meshes){
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    // The contact shadow keeps its own material: Fighter writes its opacity
    // through the mesh every frame, and a shadow stays with a faded body.
    if(mesh.name==='contact-shadow')continue;
    // A translucent shell (the worn Guardian, Ward's SURGERY) fades on its own.
    const translucent=list.some(m=>m&&m.transparent&&m.opacity<1);
    if(translucent){if(mesh.name.startsWith('awaken-on')&&fighter.state.fighter==='ward'){record.room=mesh;for(const m of list)if(m)roomShader(m,record.inside);}continue;}
    const made:THREE.Material[]=[];
    list.forEach((material,slot)=>{
      if(!material||(material as THREE.ShaderMaterial).isShaderMaterial){made.push(material);return;}
      // (An ink outline - a back-face hull, or an authored outline mesh - is dropped whole under GLASS.)
      const ink=material.side===THREE.BackSide||!!material.userData?.ink||/outline/i.test(mesh.name);
      const twin=twinOf(material,record.fade,ink);made.push(twin);
      record.twins.push({mesh,slot:Array.isArray(mesh.material)?slot:-1,original:material,twin});
    });
    if(warm&&made.some((m,i)=>m!==list[i])){
      const proxy=mesh.clone(false);
      proxy.material=Array.isArray(mesh.material)?made:made[0];
      proxy.name=mesh.name+'-occlusion-warm';proxy.visible=false;proxy.castShadow=false;proxy.receiveShadow=false;
      proxy.position.set(0,0,0);proxy.quaternion.identity();proxy.scale.set(1,1,1);proxy.matrixAutoUpdate=false;proxy.updateMatrix();
      mesh.add(proxy);
    }
  }
}
/** Whether a material is a fade twin, and a fighter's twins (for the tests). */
export function isOcclusionTwin(material:THREE.Material){return twins.has(material);}
export function occlusionTwins(fighter:Fighter):readonly {original:THREE.Material;twin:THREE.Material}[]{return records.get(fighter)?.twins??[];}
/** Ward's SURGERY: clear toward the lens while the lens is inside (see SURGERY_CLEAR). */
function roomShader(material:THREE.Material,inside:{value:number}){
  const previous=material.onBeforeCompile,inherited=material.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey?previous.toString():undefined;
  const key=inherited!==undefined?()=>inherited:material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.uOccInside=inside;
    shader.fragmentShader='uniform float uOccInside;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if ( uOccInside > 0.0 ) {
		float occFacing = abs( dot( normalize( normal ), normalize( vViewPosition ) ) );
		diffuseColor.a *= mix( 1.0, mix( ${SURGERY_CLEAR.toFixed(3)}, 1.0, smoothstep( .45, .92, 1.0 - occFacing ) ), uOccInside );
	}
	#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>`${key()}|${ROOM_KEY}`;
  material.needsUpdate=true;
}

/** Decides, every frame, how faded every fighter is (see FADE_MOST), from the
 *  lens as placed and who the shot is about, and swaps the twins in and out.
 *  Allocation-free: the crowd is walked with a bound callback over scratch
 *  fields. */
export class OcclusionFader{
  /** Read-only, for the evidence captures: how many bodies are fading this
   *  frame, the most faded one's amount, the player's own window, how many
   *  fighters are drawn with their twins, and how far inside a SURGERY the lens
   *  is. */
  readonly state={faded:0,most:0,window:0,twinned:0,room:0};
  /** Round 3c: who an authored shot on screen is about besides the player -
   *  the victim of the release, the impact or a time stop's field - written
   *  by FollowCamera every frame. The player's window opens over them, and
   *  sooner (see WINDOW_SHOT_FROM). Undefined for the gameplay shot. */
  shotVictim?:Fighter;
  /** Round 3c: the director's word that the player's body as drawn - a cape
   *  flung out beside them, a coat's tails - stands on the lens's sight line
   *  to shotVictim this frame. Their joints' box, which the window is
   *  otherwise judged by, leaves a cape out; with this the window opens all
   *  the same. */
  shotHidden=false;
  /** Round 3e: how much of the target the player's own torso hides as the
   *  lens stands (FollowCamera's capsule coverage, 0..1; see SELF_FROM),
   *  written every frame. */
  selfCover=0;
  /** FollowCamera writes a fresh 0..1 eligibility weight each frame: close,
   *  grounded, locked manual duel, no authored shot. Zero keeps the original
   *  window policy. It fades out toward the edge of close range. */
  closeManual=0;
  /** Round 3e (CAM4): the static stage in front of the fight, faded in its own
   *  programs from the boxes measured here (see StageFade). */
  readonly stage=new StageFade();
  /** The wide near band (WIDE_GONE, WIDE_CLEAR) for this frame - main.ts sets it while Goal Rush's SPORT
   *  camera films; off, the band is NEAR_GONE..NEAR_CLEAR as ever. */
  wideNear=false;
  private camera?:THREE.PerspectiveCamera;
  private self?:Fighter;
  private target?:Fighter;
  private focus:readonly (Fighter|undefined)[]=[];
  private dt=0;
  private point=new THREE.Vector3();
  private view=new THREE.Vector3();
  private sphere=new THREE.Sphere();
  /** The subjects' boxes this frame, for the bystanders' test. */
  private subjectCount=0;
  private subjects:FadeState[]=[];
  private nearest=Infinity;
  private sum=0;private count=0;private pad=0;

  /** `self` is who the camera follows, `target` who it frames against them;
   *  `focus` anybody an authored shot is about (the caster and victims of an
   *  ultimate). With no crowd there is nothing to fade. */
  update(dt:number,camera:THREE.PerspectiveCamera,crowd:ReadonlyMap<string,Fighter>|undefined,self:Fighter,target:Fighter|undefined,focus:readonly (Fighter|undefined)[]){
    shared.uOccEye.value.copy(camera.position);
    shared.uOccNear.value.set(this.wideNear?WIDE_GONE:NEAR_GONE,this.wideNear?WIDE_CLEAR:NEAR_CLEAR);shared.uOccGlass.value=this.wideNear?1:0;
    this.dt=Math.min(Math.max(Number.isFinite(dt)?dt:0,0),.1);this.camera=camera;this.self=self;this.target=target;this.focus=focus;
    const st=this.state;st.faded=0;st.most=0;st.window=0;st.twinned=0;st.room=0;
    camera.updateMatrixWorld();
    // The subjects first: their boxes are what the others are judged against.
    this.subjectCount=0;this.nearest=Infinity;
    this.subject(self);if(target&&target!==self)this.subject(target);
    for(let i=0;i<focus.length;i++){const f=focus[i];if(f&&f!==self&&f!==target)this.subject(f);}
    // The target's box is the window the player's own body is thinned over -
    // or, through a shot about the victim, theirs.
    const victim=this.shotVictim&&this.shotVictim!==self&&this.shotVictim.state.alive?this.shotVictim:undefined;
    if(victim&&victim!==target&&!focus.includes(victim))this.subject(victim);
    const windowed=victim??target,t=windowed&&windowed.state.alive?records.get(windowed):undefined;
    if(t&&t.seen&&t.x1>-1&&t.x0<1&&t.y1>-1&&t.y0<1){shared.uOccRect.value.set(t.x0,t.y0,t.x1,t.y1);shared.uOccRectDepth.value=t.mid-AHEAD;}
    else{shared.uOccRect.value.set(2,2,2,2);shared.uOccRectDepth.value=0;}
    if(crowd)crowd.forEach(this.visit);
    // The player's own body opens a window only where it is in front of the
    // target on screen.
    const own=records.get(self);
    if(own){
      let window=0,into=FADE_IN;
      if(t&&own.seen&&shared.uOccRectDepth.value>0&&own.near<shared.uOccRectDepth.value){
        const w=Math.min(own.x1,t.x1)-Math.max(own.x0,t.x0),h=Math.min(own.y1,t.y1)-Math.max(own.y0,t.y0);
        if((w>0&&h>0&&w*h>=(victim?WINDOW_SHOT_FROM:WINDOW_FROM)*(t.x1-t.x0)*(t.y1-t.y0))||(victim&&this.shotHidden))window=victim?WINDOW_SHOT_MOST:WINDOW_MOST;
        // The torso over the target (round 3e): more of it, and at once.
        const torso=victim?0:SELF_MOST*THREE.MathUtils.smoothstep(this.selfCover,SELF_FROM,SELF_FULL);
        if(torso>window){window=torso;into=SELF_IN;}
      }
      if(!victim&&this.closeManual>0&&Number.isFinite(this.selfCover)){
        const covered=THREE.MathUtils.smoothstep(this.selfCover,DUEL_COVER_FROM,DUEL_COVER_FULL);
        const cap=THREE.MathUtils.lerp(SELF_MOST,THREE.MathUtils.lerp(DUEL_WINDOW,SELF_MOST,covered),THREE.MathUtils.clamp(this.closeManual,0,1));
        window=Math.min(window,cap);
      }
      // Let go quickly: drawing the player with their twins costs the GPU
      // what is behind them, so they are not kept a moment longer than needed.
      this.ease(own,0,window,SUBJECT_OUT,into);this.room(self,own);st.window=own.window;
    }
    // The stage (round 3e): in front of the nearest body the shot is about,
    // and over the player and the one framed against them.
    let nearest=own&&own.seen?own.near:Infinity;
    for(let i=0;i<this.subjectCount;i++)nearest=Math.min(nearest,this.subjects[i].near);
    const p=self.group.position,q=windowed?.group.position;
    this.stage.update(this.dt,camera.position,own,windowed&&windowed!==self?t:undefined,windowed,nearest,p.y,self.state.grounded,q?Math.hypot(q.x-p.x,q.z-p.z):Infinity);
  }
  /** Measure a subject's box and keep it for the bystanders' test. */
  private subject(body:Fighter){
    const r=records.get(body);if(!r)return;
    this.measure(body,r);
    if(!r.seen||!body.state.alive)return;
    if(this.subjectCount>=this.subjects.length)this.subjects.push(r);else this.subjects[this.subjectCount]=r;
    this.subjectCount++;this.nearest=Math.min(this.nearest,r.mid);
  }
  private visit=(body:Fighter)=>{
    const r=records.get(body);if(!r||body===this.self)return;
    // Somebody the shot is about comes back at once: a bystander the player
    // turns and swings at is the target from that frame on.
    if(body===this.target||this.focus.includes(body)){this.ease(r,0,0,SUBJECT_OUT);this.room(body,r);return;}
    let goal=0;
    if(body.state.alive&&body.group.visible){
      this.measure(body,r);
      if(r.seen){
        // Hiding somebody the shot is about.
        for(let i=0;i<this.subjectCount;i++){
          const s=this.subjects[i];
          if(r.near>=s.mid-AHEAD)continue;
          const w=Math.min(r.x1,s.x1)-Math.max(r.x0,s.x0),h=Math.min(r.y1,s.y1)-Math.max(r.y0,s.y0);
          if(w<=0||h<=0)continue;
          const share=w*h/Math.max((s.x1-s.x0)*(s.y1-s.y0),1e-6);
          goal=Math.max(goal,THREE.MathUtils.smoothstep(share,COVER_FROM,COVER_FULL));
        }
        // Filling the frame from in front of them all.
        if(r.near<this.nearest){
          const w=Math.min(r.x1,1)-Math.max(r.x0,-1),h=Math.min(r.y1,1)-Math.max(r.y0,-1);
          if(w>0&&h>0)goal=Math.max(goal,THREE.MathUtils.smoothstep(w*h/4,CROWD_FROM,CROWD_FULL));
        }
      }
    }else r.lens=Infinity;
    // (GLASS: the near band's thinning is the whole body's, by its nearest joint, and never past GLASS_MOST.)
    if(this.wideNear){goal=Math.max(goal,1-THREE.MathUtils.smoothstep(r.lens,WIDE_GONE,WIDE_CLEAR));this.ease(r,Math.min(GLASS_MOST,goal*FADE_MOST),0);this.room(body,r);return;}
    this.ease(r,goal*FADE_MOST,0);this.room(body,r);
  };
  /** Ease a body's amounts toward their goals, hand them to its twins, and
   *  draw it with them only while anything is to be thinned. */
  private ease(r:FadeState,body:number,window:number,out=FADE_OUT,into=FADE_IN){
    r.body=this.toward(r.body,body,out);r.window=this.toward(r.window,window,out,into);
    r.fade.value.set(r.body,r.window);
    this.swap(r,r.body>.004||r.window>.004||r.lens<(this.wideNear?WIDE_CLEAR:NEAR_CLEAR)+NEAR_REACH);
    if(r.body>.01){this.state.faded++;this.state.most=Math.max(this.state.most,r.body);}
    if(r.swapped)this.state.twinned++;
  }
  private toward(now:number,goal:number,out:number,into=FADE_IN){
    const next=now+(goal-now)*(1-Math.exp(-(goal>now?into:out)*this.dt));
    return goal===0&&next<1e-3?0:next;
  }
  /** Swap a fighter's twins in (`on`) or back out; while they are in, copy
   *  onto them what the fighter's own code sets on its materials. A slot some
   *  other layer has put its own material in is left alone. */
  private swap(r:FadeState,on:boolean){
    if(!on&&!r.swapped)return;
    for(let i=0;i<r.twins.length;i++){
      const t=r.twins[i],list=t.slot>=0?t.mesh.material as THREE.Material[]:undefined,current=list?list[t.slot]:t.mesh.material;
      if(on){
        if(current===t.original){if(list)list[t.slot]=t.twin;else t.mesh.material=t.twin;}
        if(current===t.original||current===t.twin)copyLook(t.original,t.twin);
      }else if(current===t.twin){if(list)list[t.slot]=t.original;else t.mesh.material=t.original;}
    }
    r.swapped=on;
  }
  /** Ward's SURGERY round the lens (see SURGERY_CLEAR). */
  private room(body:Fighter,r:FadeState){
    const mesh=r.room;if(!mesh)return;
    let inside=0;
    if(mesh.visible&&body.state.alive){
      const geometry=mesh.geometry;
      if(!geometry.boundingSphere)geometry.computeBoundingSphere();
      this.sphere.copy(geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
      const d=this.sphere.center.distanceTo(this.camera!.position),radius=this.sphere.radius;
      inside=1-THREE.MathUtils.smoothstep(d,radius*(1-SURGERY_EDGE),radius);
    }
    const goal=mesh.visible?Math.max(SURGERY_OUTSIDE,inside):0;
    r.inside.value+=(goal-r.inside.value)*(1-Math.exp(-6*this.dt));
    if(r.inside.value<1e-3&&goal===0)r.inside.value=0;
    this.state.room=Math.max(this.state.room,inside);
  }
  /** `body`'s box on screen, its depth from the lens and its nearest joint's
   *  distance to it (see PAD), into `r`. */
  private measure(body:Fighter,r:FadeState){
    const joints=body.joints,bulk=bodyBulk(body.state);
    r.x0=r.y0=Infinity;r.x1=r.y1=-Infinity;r.near=Infinity;r.mid=0;r.lens=Infinity;r.seen=false;this.sum=0;this.count=0;this.pad=PAD*bulk;
    if(joints&&body.model?.visible!==false){
      for(let i=0;i<JOINTS.length;i++){const bone=joints.get(JOINTS[i]);if(bone){bone.getWorldPosition(this.point);this.add(r);}}
    }
    if(!this.count){
      // A form's model, or no joints: the root to its crown.
      const p=body.group.position;
      for(let k=0;k<3;k++){this.point.set(p.x,p.y+CROWN*bulk*k/2,p.z);this.add(r);}
    }
    if(!this.count)return;
    r.mid=this.sum/this.count;r.seen=true;
  }
  /** One point of a body (in `point`) into its box, padded at its depth. */
  private add(r:FadeState){
    const camera=this.camera!,e=camera.projectionMatrix.elements;
    r.lens=Math.min(r.lens,this.point.distanceTo(camera.position)-this.pad);
    this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);
    const depth=-this.view.z;if(depth<.05)return;
    this.point.project(camera);
    const up=this.pad/depth*e[5],across=this.pad/depth*e[0];
    r.x0=Math.min(r.x0,this.point.x-across);r.x1=Math.max(r.x1,this.point.x+across);r.y0=Math.min(r.y0,this.point.y-up);r.y1=Math.max(r.y1,this.point.y+up);
    r.near=Math.min(r.near,depth-this.pad);this.sum+=depth;this.count++;
  }
}

/** What the fighter's own code changes on its materials from frame to frame
 *  (the awakening glow, the Kurobi reveal's opacity, visibility), copied onto
 *  a twin while it stands in. Nothing that would change its program. */
function copyLook(from:THREE.Material,to:THREE.Material){
  to.opacity=from.opacity;to.visible=from.visible;
  const a=from as THREE.MeshToonMaterial,b=to as THREE.MeshToonMaterial;
  if(a.color&&b.color)b.color.copy(a.color);
  if(a.emissive&&b.emissive){b.emissive.copy(a.emissive);b.emissiveIntensity=a.emissiveIntensity;}
}
