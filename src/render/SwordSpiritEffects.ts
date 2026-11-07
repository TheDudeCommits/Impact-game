import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter,bindClips} from './Fighter';
import {FIGHTERS} from '../config';
import {MOVES,PLAYER_RADIUS,meleeReach,type MoveDefinition} from '../game/moves';
import {AWAKENINGS,moveFor,rushMove} from '../game/awakening';
import type {CombatEvent,FighterId} from '../game/types';
import {chargeWasCancelled,FLIGHTS} from './CombatEffects';
import {slashWaveMaterial,applySlashStyle,SLASH} from './signature/SlashWave';
import {LightVolumes} from './signature/LightVolumes';
import {BoltBatch} from './signature/BoltBatch';
import {GlowBatch,RING,STAR} from './signature/GlowBatch';
import {UnsealedEffects} from './signature/Unsealed';
import {ThreeBladeEffects,RAKSHASA_ASSET} from './signature/ThreeBlade';
import {applyOriginalSpiritShells,applyOriginalSpirits} from '../originals/apply';
import {ORIGINALS} from '../originals/roster';
import {applyCompanionGlows,applyCompanionShells} from '../originals/companionLooks';
import {GhostShell,warmGhosts,type GhostPrint} from './signature/GhostShell';
import {Steamrollers,rollerAt,ROLLER_TIMING,type RollerPose} from './signature/Steamroller';
import {SIGNATURE} from './signature/context';
import {whiffGone} from './signature/ultimateClock';
import {setLoomTop,clearLoomTops} from './loomRegistry';
import {tourContacts} from '../game/timeStopBarrage';
import {VfxKit} from './vfx/VfxKit';
import {ghostTint} from './vfx/palette';
import type {AttackSlot,PlayerState} from '../game/types';
import {COMBO_KEYS,comboMove} from '../game/combos';
import {comboClip} from './comboClips';
import {KINU_REFERENCE_ENTRY,KINU_REFERENCE_RETURN,kinuContactReference} from './signature/KinuContactReference';
import {KINU_SPIRIT_STAGING,kinuFlankAroundContact,kinuViewFlank,kinuInitialFlank} from './signature/KinuSpiritStaging';

/** A fighter who fights through a spirit, and what draws it.
 *
 *  The spirit is a Fighter of its own, built from `asset` and driven by the
 *  user's own state - so the asset has to carry the user's clip names, which
 *  is why clock-spirit1.glb is built with LORD ORO's whole set (scripts/build_oro.py).
 *  Every branch below that used to read `fighter==='koko'` reads this table
 *  instead; KoKo's row is exactly what the class did before it existed. */
export interface SpiritCaller{
  asset:string;
  /** The spirit's group name in the scene. */
  name:string;
  /** How the heavy is drawn: Iron Spirit's finger extends, LORD ORO throws knives. */
  heavy:'finger'|'knives'|'punch';
  /** A mesh in the asset whose geometry is the barrage's fist trail, taken in
   *  the right hand's bind space. Without one the trail is cut out of the skin:
   *  the triangles weighted to the right hand and its fingers. */
  fistMesh?:string;
  /** Tint of the barrage trail. */
  fist:number;
  /** Round 3b. The user's slot clips the spirit's file lacks, played by one it
   *  has: taking over, the spirit is driven by its user's state, and a light
   *  that finds no clip of its name falls back to the idle - the awakened Iron
   *  Spirit stood still through every light string. */
  aliases?:Readonly<Record<string,string>>;
  punches?:string;
  /** Round 4b (a blind critic: "KoKo's light string is thrown by KoKo himself and Iron Spirit never appears"):
   *  the spirit comes out for the light string as it does for an ender, and throws its blows; its user commands it
   *  (Fighter's SPIRIT_COMMAND). Not awakened: the looming spirit already strikes with every blow then. */
  string?:boolean;
}
const authoredSpirit=(fighter:FighterId)=>fighter==='gosu'||fighter==='kinu';
export const SPIRIT_CALLERS:Partial<Record<FighterId,SpiritCaller>>={
  kinu:{asset:'/assets/fighters/silk-spirit1.glb',name:'silk-spirit',heavy:'punch',fist:0x6fdadd,string:true},
  gosu:{asset:'/assets/fighters/mender-spirit1.glb',name:'mender-spirit',heavy:'punch',fist:0x80dcf2,string:true},
  koko:{asset:'/assets/fighters/iron-spirit1.glb',name:'iron-spirit',heavy:'finger',fistMesh:'iron_closed_Right',fist:0x8962ad,aliases:{'Straight Punch':'Iron Spirit Punch'},punches:'/assets/fighters/iron-spirit-fanim1.glb',string:true},
  oro:{asset:'/assets/fighters/clock-spirit1.glb',name:'clock-spirit',heavy:'knives',fist:0xd9b53c,punches:'/assets/fighters/clock-spirit-fanim1.glb',string:true},
};
applyOriginalSpirits(SPIRIT_CALLERS);
/** Round 4b: where a spirit stands to throw its user's light string - between its user and the victim, a little to the
 *  user's right, so its straight lands on them at full reach: metres short of the victim its chest stays (its reach),
 *  the least and most it is put ahead of its user, and how far to the side. */
const STRING_SPOT={reach:.95,least:.3,most:1.25,side:.28};
/** LORD ORO's thrown knife: the source's own 23 cm prop (scripts/build_oro.py). */
export const KNIFE_ASSET=ORIGINALS.oro?.knife??'/assets/fighters/oro-knife1.glb';
export const SWORD_SPIRIT_ASSETS=[SPIRIT_CALLERS.koko!.asset,SPIRIT_CALLERS.oro!.asset,SPIRIT_CALLERS.gosu!.asset,SPIRIT_CALLERS.kinu!.asset,KNIFE_ASSET,RAKSHASA_ASSET] as const;
type SlashMesh=THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
/** `origin` is where the clock was stopped: the user crosses the field once it
 *  has, and the bubble stays where it was cast, not on him. */
type TimeField={dome:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;still:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;graded?:number;origin:THREE.Vector3;anchored:boolean};
const SPIRIT_OPACITY=.74;
export const LOOM={
  scale:1.5,
  back:.55,side:.6,lift:.18,restLean:.03,bend:.6,strikeBend:.12,tilt:.3,strikeTilt:.05,
  strikeBack:-.12,strikeSide:.56,strikeLift:.1,lean:.2,guard:.3,
  bob:.045,bobRate:.55,breathe:.014,breatheRate:.36,sway:.03,
  turn:7,follow:9,surgeIn:12,surgeOut:4,
  riseFrom:.12,riseTo:1.25,emergeScale:.92,emergeLift:-.25,exit:.9,
  keepTarget:.14,keepUser:.42,near:.9,far:1.8,
};
/** One spirit's own bookkeeping (see LOOM): how far it has risen and come round
 *  to strike, the frame it is placed in, its clock, the state it is drawn
 *  with (rewritten in place, never allocated per frame) and its parts. */
type Loom={referenceSeq?:number;referenceFrom?:THREE.Vector3;referenceYaw?:number;referencePresent?:boolean;referenceActive?:boolean;referenceReturn?:number;stagedYaw?:number;flank?:number;flankGoal?:number;flankView?:number;flankSeq?:number;presence:number;surge:number;bearing:number;height:number;placed:boolean;clock:number;risen:number;state:PlayerState;stare:THREE.Vector3;shadow?:THREE.Object3D;
  /** Where the lens is measured from for the near fade: the chest summoned, the
   *  thighs looming (up to its neck: see GhostShell.fadeRange). */
  anchor?:THREE.Object3D;
  /** The torso bent over its user (see LOOM.bend): the spine and neck bones,
   *  and their clip pose, put back before the next frame's update samples it. */
  bones:(THREE.Bone|undefined)[];rest:THREE.Quaternion[];bent:boolean;
  /** Its parts that cast a shadow: none while it is breaking up (a whole
   *  shadow under a spirit still assembling showed before the spirit did). */
  casters:THREE.Mesh[];casting:boolean};
/** The bones the loom bends: the spine takes the bend in thirds, the neck
 *  gives back BEND_NECK of it, so the spirit glares ahead rather than down. */
const BEND_BONES=['Spine','Spine1','Spine2','Neck'] as const,BEND_NECK=-.55;
/** A time-stop ultimate's timing, read once per fighter (see `ultimate`). */
type UltimateTiming={contacts:readonly number[];stop:NonNullable<MoveDefinition['timeStop']>;stopFrom:number;finisher:number;barrageFrom:number;barrageTo:number};
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
/** Through a time stop's tour the spirit throws its barrage clip from a little
 *  before the tour's first blow to a little after its last, looping the
 *  clip's punches (the first BARRAGE_LOOP of them) at their own pace. */
const BARRAGE_LEAD=.15,BARRAGE_TAIL=.12,BARRAGE_LOOP=4;
/** Whom the spirit strikes: an opponent this far in front of its user at most. */
const SPIRIT_REACH=3.4;
/** The user's moves across the stopped field, drawn as streaks of the spirit's
 *  light: any frame the body moves further than TRAIL_STEP during the tour
 *  leaves one, lasting TRAIL_LIFE, at these heights over the floor. */
const TRAIL_STEP=.25,TRAIL_LIFE=.28,TRAIL_HEIGHTS=[.5,1.05,1.6] as const,TRAILS=24;
/** And a printed ghost of the user every GHOST_STEP metres of a move (VfxKit's
 *  pooled afterimages), so a glide across the field reads as one. */
const GHOST_STEP=.55;
/** A barrage fist fades out between these distances from the lens. */
const FIST_NEAR=3.2,FIST_GONE=1.4;
/** The stopped world's colour when the renderer has no two-tone of its own:
 *  drained toward a cold cyan-grey, never inverted. */
const STILL=new THREE.Color(.62,.74,.84);
const SPIRIT_SHELL:Partial<Record<FighterId,{body:THREE.Color;rim:number;ink:number;print:GhostPrint}>>={
  kinu:{body:new THREE.Color(.38,.82,.75),rim:0xc6ffdf,ink:0x131925,print:{shade:new THREE.Color(.035,.11,.10),light:new THREE.Color(.93,1.1,1.05),line:0x131925,levels:[.12,.9],loom:true}},
  gosu:{body:new THREE.Color(.9,.38,.65),rim:0x9feaff,ink:0x201126,print:{shade:new THREE.Color(.10,.035,.10),light:new THREE.Color(1.1,.95,1.1),line:0x201126,levels:[.12,.9],loom:true}},
  koko:{body:new THREE.Color(.34,.24,1.5),rim:0xc9a8ff,ink:0x080620,print:{shade:new THREE.Color(.03,.018,.15),light:new THREE.Color(1.05,.9,2.3),line:0x0a0624,levels:[.1,.85],glow:/^Material__2$/,loom:true}},
  oro:{body:new THREE.Color(1.25,.85,.12),rim:0xffe28a,ink:0x140c02,print:{shade:new THREE.Color(.16,.07,.01),light:new THREE.Color(2.1,1.8,.75),line:0x1a0e02,levels:[.15,.95],glowUv:[.4,.06,.48,.225],loom:true}},
};
applyOriginalSpiritShells(SPIRIT_SHELL);
applyCompanionShells(SPIRIT_SHELL);
type Slash={event:CombatEvent;root:THREE.Group;meshes:SlashMesh[];hitAt?:number;hitPoint?:THREE.Vector3;light:THREE.Color};
/** How many sword-wave planes can be live at once: Kenzo's ultimate uses five. */
const SLASH_POOL=40;
/** The spirits' own light: Iron Spirit's violet, HUSH's gold. */
const SPIRIT_GLOW:Partial<Record<FighterId,THREE.Color>>={kinu:new THREE.Color(.45,1.1,.9),gosu:new THREE.Color(.65,1.1,1.4),koko:new THREE.Color(.8,.42,1.8),oro:new THREE.Color(1.7,1.2,.3)};
applyCompanionGlows(SPIRIT_GLOW);
const SLASH_LIGHT={strix:new THREE.Color(.3,1.0,.42),kenzo:new THREE.Color(.35,1.1,.45)};
/** Needle Finger in the air: the spirit's finger, drawn from its hand to wherever
 *  the tip has got to. `hitAt` and `hitPoint` are where the server said it
 *  landed, which is where the extension stops and the retract begins. */
type Finger={event:CombatEvent;root:THREE.Group;shaft:THREE.Mesh;core:THREE.Mesh;tip:THREE.Mesh;hitAt?:number;hitPoint?:THREE.Vector3;};
/** How fast the finger comes back. Faster than it went out: the reach is the
 *  blow, the return is a recoil. */
const FINGER_RETRACT=52;
/** How long the tip holds at full reach, or on the body it struck. */
const FINGER_HOLD=.06;
/** Knives in a fan: how many ride one flight, how far apart, how far spread. */
const KNIVES=3,KNIFE_SPREAD=.13,KNIFE_FAN=.09,KNIFE_FLIGHTS=8;
const vertex='varying vec2 p;void main(){p=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);

/** The right fist of a spirit, in the right hand's bind space, for the barrage
 *  trail. From a named mesh where the asset ships one (Iron Spirit's closed
 *  hand), else cut out of the skin by weight. */
function fistGeometry(gltf:GLTF,user:SpiritCaller):THREE.BufferGeometry|undefined{
  let named:THREE.SkinnedMesh|undefined,skin:THREE.SkinnedMesh|undefined;
  gltf.scene.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isSkinnedMesh)return;if(user.fistMesh&&o.name===user.fistMesh)named=m;if(!skin)skin=m;});
  if(named){const index=named.skeleton.bones.findIndex(b=>b.name==='RightHand');if(index<0)return;return named.geometry.clone().applyMatrix4(named.skeleton.boneInverses[index]);}
  if(!skin)return;
  const bones=skin.skeleton.bones,hand=bones.findIndex(b=>b.name==='RightHand');if(hand<0)return;
  const ofHand=new Set<number>();bones.forEach((b,i)=>{for(let p:THREE.Object3D|null=b;p;p=p.parent)if(p===bones[hand]){ofHand.add(i);break;}});
  const g=skin.geometry,position=g.attributes.position,joints=g.attributes.skinIndex.array,weights=g.attributes.skinWeight.array,index=g.index;
  const owned=(v:number)=>{let w=0;for(let k=0;k<4;k++)if(ofHand.has(joints[v*4+k]))w+=weights[v*4+k];return w>.5;};
  const count=index?index.count:position.count,keep:number[]=[];
  for(let t=0;t+2<count;t+=3){const a=index?index.getX(t):t,b=index?index.getX(t+1):t+1,c=index?index.getX(t+2):t+2;if(owned(a)&&owned(b)&&owned(c))keep.push(a,b,c);}
  if(keep.length<3)return;
  const out=new Float32Array(keep.length*3),p=new THREE.Vector3(),toHand=skin.skeleton.boneInverses[hand].clone().multiply(skin.bindMatrix);
  keep.forEach((v,i)=>{p.fromBufferAttribute(position,v).applyMatrix4(toHand);out[i*3]=p.x;out[i*3+1]=p.y;out[i*3+2]=p.z;});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(out,3));return geometry;
}
/** Round 3b: what a spirit needs to fight as its user when it takes over. The
 *  user's slot clips it lacks, aliased onto its own (SpiritCaller.aliases), and
 *  the user's rush-stage clips - the animation-only file the library binds to
 *  the user's body - bound by bone name to the spirit's, as the library does
 *  (Fighter's bindClips). Both spirits are humanoid rigs on the canonical bone
 *  names, so Iron Spirit throws KoKo's rush and HUSH LORD ORO's rather
 *  than idling (KoKo's light) or reaching for its air normals (LORD ORO's rush). */
export function spiritClips(fighter:FighterId,source:GLTF,rush?:THREE.AnimationClip[]){
  const user=SPIRIT_CALLERS[fighter];
  for(const [name,from] of Object.entries(user?.aliases??{})){
    if(source.animations.some(c=>c.name===name))continue;
    const clip=source.animations.find(c=>c.name===from);
    if(clip){const copy=clip.clone();copy.name=name;source.animations.push(copy);}
  }
  return rush?bindClips(source.scene,rush,user?.name??fighter):undefined;
}
/** Its user's combo enders' clips (comboClips.ts), bound by bone name to the spirit as the rush's are: the spirit summoned
 *  for an ender throws the ender's own blow with its user, not its Needle Finger or its barrage. Where the spirit has a clip
 *  of that name already, its own is kept (Fighter's constructor). */
export function spiritEnderClips(fighter:FighterId,owner:Fighter,source:GLTF){
  const names=new Set(COMBO_KEYS.map(key=>comboClip(fighter,key)?.clip).filter((name):name is string=>!!name));
  if(!names.size)return [];
  const own=(owner.clips??[]).filter(c=>names.has(c.name)&&!source.animations.some(a=>a.name===c.name));
  return own.length?bindClips(source.scene,own,SPIRIT_CALLERS[fighter]?.name??fighter):[];
}
/** A spirit's fist in the barrage: the spirit's colour with a burning rim, so
 *  the wall of fists reads as its light rather than as grey rubber. Round 3:
 *  a fist fades out as it nears the lens (under FIST_NEAR metres, gone at
 *  FIST_GONE), so a barrage filmed from over the spirit's shoulder is the
 *  victim being hit, not a screen of knuckles. */
function spiritFistMaterial(body:THREE.Color,rim:number){
  return new THREE.ShaderMaterial({name:'SpiritFist',transparent:true,depthWrite:false,toneMapped:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
    uniforms:{uBody:{value:body.clone()},uRim:{value:new THREE.Color(rim)}},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uBody;uniform vec3 uRim;varying vec3 vN;varying vec3 vV;void main(){float f=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.-f,2.2);float near=smoothstep('+FIST_GONE.toFixed(2)+','+FIST_NEAR.toFixed(2)+',length(vV));float a=(.88+.1*rim)*near;gl_FragColor=vec4((mix(uBody,uRim,.5)*(.5+.5*f)*(.88+.1*rim)+uRim*rim*1.4)*near,a);}'});
}
/** Sourced spirit surface; bounded analytic ink/energy ribbons for sword paths. */
export class SwordSpiritEffects{
  private sources=new Map<FighterId,GLTF>();
  /** Each spirit's copy of its user's rush-stage clips (spiritClips). */
  private rushClips=new Map<FighterId,THREE.AnimationClip[]>();
  private spirits=new Map<string,Fighter>();
  private spiritFades=new Map<string,number>();
  /** Each spirit's LOOM bookkeeping, by its user's id. */
  private looms=new Map<string,Loom>();
  /** What drawing the spirits cost the CPU over the last 120 frames (their
   *  Fighter updates, the loom, the fists), for the probes. */
  private cost=new Float32Array(120);private costAt=0;
  get stats(){const sorted=Float32Array.from(this.cost).sort();return {ms:sorted[sorted.length>>1],worst:sorted[sorted.length-1],mean:this.cost.reduce((a,b)=>a+b,0)/this.cost.length};}
  /** For the cost probe: the spirits are updated as ever but not drawn, so a
   *  GPU timer run with and without them tells what drawing them costs. */
  probeHidden=false;
  private bendAxis=new THREE.Vector3();private bendAcross=new THREE.Vector3();private bendTilt=new THREE.Quaternion();private bendWorld=new THREE.Quaternion();private bendParent=new THREE.Quaternion();private bendLocal=new THREE.Quaternion();
  private ultimates=new Map<FighterId,UltimateTiming[]>();
  /** Each summoned spirit's manifestation shell (signature/GhostShell). */
  private shells=new Map<string,GhostShell>();
  /** The ghost programs, linked at load for every layer that draws a shell. */
  private ghostWarm:ReturnType<typeof warmGhosts>;
  private fists=new Map<FighterId,THREE.InstancedMesh>();
  private fistCounts=new Map<FighterId,number>();
  private fistPose=new THREE.Object3D();
  private slashes:Slash[]=[];
  private fingers:Finger[]=[];
  private fingerGeometry=new THREE.CylinderGeometry(1,1,1,10,1,true);
  private fingerTipGeometry=new THREE.SphereGeometry(1,12,8);
  private fingerMaterial=new THREE.MeshBasicMaterial({color:0x8962ad,transparent:true,opacity:.86,depthWrite:false,toneMapped:false});
  private fingerCoreMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,1.45,2.6),transparent:true,opacity:.95,depthWrite:false,toneMapped:false});
  private fingerFrom=new THREE.Vector3();
  private fingerDir=new THREE.Vector3();
  private fingerTipAt=new THREE.Vector3();
  /** The knives: the sourced prop, or a sliver of a box until it has loaded.
   *  One instanced mesh for every flight in the air. */
  private knifeGeometry:THREE.BufferGeometry=new THREE.BoxGeometry(.018,.005,.24);
  private knifeMaterial:THREE.Material=new THREE.MeshBasicMaterial({color:0xd7dde4,toneMapped:false});
  private knives?:THREE.InstancedMesh;
  private knifePose=new THREE.Object3D();
  private knifeSide=new THREE.Vector3();
  private knifeAim=new THREE.Vector3();
  private knifeGrip=new THREE.Vector3();
  /** MIDNIGHT's steamroller, one per LORD ORO in the match (signature/Steamroller). */
  private rollerSet?:Steamrollers;
  /** Built (and its model fetched) with the first LORD ORO a room has: see load. */
  private get rollers(){return this.rollerSet??=new Steamrollers(this.scene);}
  private kit?:VfxKit;
  private get vfx(){return this.kit??=VfxKit.for(this.scene);}
  private seen=new Set<number>();
  private plane=new THREE.PlaneGeometry(1,1);
  private slashPool:SlashMesh[]=[];
  /** Free wave planes wait here, hidden; drawn once at load so their shared
   *  program is linked before the first Haizan. */
  private slashHolder=new THREE.Group();
  private lights=new LightVolumes(8,'sword-spirit-light');
  private ringGeometry=new THREE.SphereGeometry(1,32,16);
  /** MIDNIGHT's bubble: the sphere of stopped time sweeping out from the
   *  user, drawn as a burning violet edge (additive fresnel, both faces) that
   *  thins to nothing once it has passed. No lines across the frame. */
  private domeMaterial=new THREE.ShaderMaterial({name:'TheHourDome',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending,uniforms:{opacity:{value:0},tint:{value:new THREE.Color(1.2,.8,2.2)}},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying vec3 vN;varying vec3 vV;uniform float opacity;uniform vec3 tint;void main(){float f=1.-abs(dot(normalize(vN),normalize(vV)));gl_FragColor=vec4(tint*pow(f,3.)*opacity,1.);}'});
  private timeFields=new Map<string,TimeField>();
  /** MIDNIGHT's stillness, where the renderer has no timeStop of its own:
   *  a multiply toward a cold grey inside the bubble, drawn by back faces
   *  with no depth test so from inside it covers the frame. The old negative
   *  (an exclusion blend) blew the frame out to white and is gone. */
  private stillMaterial=new THREE.ShaderMaterial({name:'TheHourStill',transparent:true,depthWrite:false,depthTest:false,side:THREE.BackSide,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.DstColorFactor,blendDst:THREE.ZeroFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,
    uniforms:{tint:{value:new THREE.Color(1,1,1)}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;void main(){gl_FragColor=vec4(tint,1.);}'});
  private fieldWarm=new THREE.Group();
  private bolts=new BoltBatch(900,'spirit-barrage-smears');
  private glows=new GlowBatch(64,'spirit-barrage-flash',true);
  /** Nigo's Haizan and NIGHTFALL: see signature/Unsealed. */
  private unsealed:UnsealedEffects;
  /** Kenzo's ultimate cut and the RAKSHASA's nine-sword cut: see signature/ThreeBlade. */
  private threeBlade:ThreeBladeEffects;
  private barrageTarget=new THREE.Vector3();private barrageFrom=new THREE.Vector3();private lift=new THREE.Vector3();private smearTail=new THREE.Vector3();
  /** The tour's streaks (see TRAIL_STEP): a fixed ring, and where each spirit
   *  user was drawn last frame. */
  private trails=Array.from({length:TRAILS},()=>({from:new THREE.Vector3(),to:new THREE.Vector3(),born:-Infinity,fighter:'koko' as FighterId}));
  private trailNext=0;
  private lastAt=new Map<string,THREE.Vector3>();
  private ghostAt=new Map<string,THREE.Vector3>();
  constructor(private scene:THREE.Scene){
    this.unsealed=new UnsealedEffects(scene);this.threeBlade=new ThreeBladeEffects(scene);this.ghostWarm=warmGhosts(scene);
    // Dev only: the probes read the spirits and tune LOOM live.
    if(import.meta.env?.DEV&&typeof window!=='undefined')(window as unknown as {__spirits?:{effects:SwordSpiritEffects;loom:typeof LOOM}}).__spirits={effects:this,loom:LOOM};
    this.slashHolder.name='sword-wave-pool';this.slashHolder.position.set(0,-50,0);scene.add(this.slashHolder,this.lights.mesh,this.bolts.mesh,this.glows.mesh);
    // The time-stop programs are drawn once at load, under the floor and out of shot.
    this.fieldWarm.name='time-stop-warm';this.fieldWarm.position.set(0,-50,0);for(const m of [this.domeMaterial,this.stillMaterial]){const warm=new THREE.Mesh(this.ringGeometry,m);warm.scale.setScalar(.001);warm.frustumCulled=false;this.fieldWarm.add(warm);}this.fieldWarm.children[0].onAfterRender=()=>{this.fieldWarm.visible=false;};scene.add(this.fieldWarm);
    for(let i=0;i<SLASH_POOL;i++){const mesh=new THREE.Mesh(this.plane,slashWaveMaterial());mesh.frustumCulled=false;mesh.renderOrder=4;this.slashHolder.add(mesh);this.slashPool.push(mesh);}
    // Only the first plane is drawn at load; the holder goes dark after that.
    for(let i=1;i<SLASH_POOL;i++)this.slashPool[i].visible=false;
    this.slashPool[0].onAfterRender=()=>{this.slashHolder.visible=false;for(const m of this.slashPool)m.visible=true;this.slashPool[0].onAfterRender=()=>{};};
  }
  private loads=new Map<string,Promise<void>>();
  load(fighters:Iterable<string>){
    const once=(key:string,work:()=>Promise<void>)=>{let loading=this.loads.get(key);if(!loading){loading=work().catch(error=>{this.loads.delete(key);console.warn(`${key} did not load`,error);});this.loads.set(key,loading);}return loading;};
    const jobs:Promise<void>[]=[];
    for(const fighter of new Set(fighters)){
      const user=SPIRIT_CALLERS[fighter as FighterId];
      if(user)jobs.push(once(user.name,()=>this.loadSpirit(fighter as FighterId,user)));
      // MIDNIGHT's roller is built with the first LORD ORO, so its programs link behind the loading screen (Steamrollers).
      if(fighter==='oro'){void this.rollers;jobs.push(once('LORD ORO knife',()=>this.loadKnife()));}
      if(fighter==='kenzo')jobs.push(once('RAKSHASA phantom',()=>this.threeBlade.load()));
    }
    return Promise.all(jobs).then(()=>{});
  }
  private async loadSpirit(fighter:FighterId,user:SpiritCaller){
    const loader=new GLTFLoader();
    const source=await loader.loadAsync(user.asset);source.scene.updateMatrixWorld(true);
    // The user's rush file is a dressing: without it the stages fall back
    // to the spirit's own clips, as a body's do.
    const url=FIGHTERS[fighter].rushModel;let rush:THREE.AnimationClip[]|undefined;
    if(url)try{rush=(await loader.loadAsync(url)).animations;}catch(error){console.warn(`${user.name}: rush clips unavailable (${url})`,error);}
    // Round 4b: the spirit's own takes - its rush stages in place of its user's, the rest in place of its own of the
    // same name (before the aliases are drawn up, so its own light needs none).
    if(user.punches)try{
      const own=(await loader.loadAsync(user.punches)).animations,stages=own.filter(c=>/^Rush \d$/.test(c.name)),staged=new Set(stages.map(c=>c.name));
      const rest=bindClips(source.scene,own.filter(c=>!staged.has(c.name)),user.name),names=new Set(rest.map(c=>c.name));
      source.animations=[...source.animations.filter(c=>!names.has(c.name)),...rest];
      if(stages.length)rush=[...(rush??[]).filter(c=>!staged.has(c.name)),...stages];
    }catch(error){console.warn(`${user.name}: its own takes are unavailable (${user.punches}); it throws its user's`,error);}
    const bound=spiritClips(fighter,source,rush);if(bound)this.rushClips.set(fighter,bound);
    this.sources.set(fighter,source);
    const geometry=authoredSpirit(fighter)?undefined:fistGeometry(source,user);
    if(geometry){if(!geometry.attributes.normal)geometry.computeVertexNormals();const look=SPIRIT_SHELL[fighter];const fists=new THREE.InstancedMesh(geometry,spiritFistMaterial(look?look.body:new THREE.Color(user.fist),look?look.rim:0xffffff),96);fists.count=0;fists.frustumCulled=false;fists.name=fighter==='koko'?'gan-sourced-fist-trails':user.name+'-fist-trails';this.fists.set(fighter,fists);this.scene.add(fists);}
  }
  /** The knife is dressing: a missing file leaves the box sliver in place. */
  private async loadKnife(){
    const knife=await new GLTFLoader().loadAsync(KNIFE_ASSET);let mesh:THREE.Mesh|undefined;knife.scene.traverse(o=>{if(!mesh&&(o as THREE.Mesh).isMesh)mesh=o as THREE.Mesh;});
    if(mesh){this.knifeGeometry.dispose();this.knifeGeometry=mesh.geometry;const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;this.knifeMaterial=new THREE.MeshBasicMaterial({map:material.map??null,color:material.map?0xffffff:0xd7dde4});}
    // The knives' mesh made with the room's load, hidden until a throw, so the room's compile links its program: made at the
    // first throw, its program was linked in that frame (launch day 15, scripts/night/late_sweep.mjs).
    if(!this.knives)this.knifeMesh().visible=false;
  }
  private knifeMesh(){if(!this.knives){this.knives=new THREE.InstancedMesh(this.knifeGeometry,this.knifeMaterial,KNIVES*KNIFE_FLIGHTS);this.knives.count=0;this.knives.frustumCulled=false;this.knives.name='oro-knives';this.scene.add(this.knives);}return this.knives;}
  /** A free wave plane from the pool, or the oldest live one taken back. */
  private slashMesh():SlashMesh{
    let mesh=this.slashPool.pop();
    if(!mesh){const oldest=this.slashes.shift();if(oldest)this.remove(oldest);mesh=this.slashPool.pop()!;}
    mesh.rotation.set(0,0,0);mesh.position.set(0,0,0);mesh.visible=true;return mesh;
  }
  handle(events:CombatEvent[]){this.unsealed.handle(events);this.threeBlade.handle(events);for(const e of events){if(this.seen.has(e.id))continue;this.seen.add(e.id);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
    // Kenzo's light and Mirage Draw draw their cut on a wave plane; his ultimate's cut
    // and the RAKSHASA's cut are signature/ThreeBlade's, Nigo's are Unsealed's.
    // (Not a combo ender thrown in the heavy's slot: it is its own move, drawn as its own - CombatEffects.)
    if(e.kind==='cast'&&e.origin&&e.endpoint&&e.fighter==='kenzo'&&(e.slot==='light'||e.slot==='heavy'&&!e.branch)){
      const root=new THREE.Group(),meshes:SlashMesh[]=[];root.name=e.fighter+'-sword-path';this.scene.add(root);
      const heavy=e.slot==='heavy',count=heavy?1:2;
      // Mirage Draw is one thin, fast draw; the light is two short crescents.
      const arc=heavy?.95:1.3,thick=heavy?.1:.2;
      for(let i=0;i<count;i++){const mesh=this.slashMesh();applySlashStyle(mesh.material,SLASH.kenzo,e.id*7+i*13,arc,thick);mesh.rotation.z=heavy?1.57:i*.85-.5;mesh.position.z=i*.035;root.add(mesh);meshes.push(mesh);}
      this.slashes.push({event:e,root,meshes,light:SLASH_LIGHT.kenzo});if(this.slashes.length>32)this.remove(this.slashes.shift()!);
    }
    // The black greatsword releases one tall green air cut. Build it only from the simulation's
    // release: the player may turn during the wind-up, or the charge may cancel.
    // Paired face/profile planes keep the same crescent legible from either side.
    if(e.kind==='release'&&e.origin&&e.endpoint&&e.fighter==='strix'&&e.slot==='special'&&!e.branch){
      const root=new THREE.Group(),meshes:SlashMesh[]=[];root.name='strix-bearpaw-cut-wave';this.scene.add(root);
      for(let i=0;i<2;i++){const mesh=this.slashMesh();applySlashStyle(mesh.material,SLASH.strix,e.id,1.2,.19,i===1);root.add(mesh);meshes.push(mesh);}
      this.slashes.push({event:e,root,meshes,light:SLASH_LIGHT.strix});
      if(this.slashes.length>32)this.remove(this.slashes.shift()!);
    }
    // Needle Finger: the spirit's finger extends to the tip's live position and
    // comes back. CombatEffects draws no body for KoKo's casts - the spirit
    // is the body - so the projectile is drawn here, from the spirit's hand.
    // LORD ORO's heavy is a fan of knives instead, drawn in update() off the flight
    // CombatEffects keeps for it; there is nothing to make on the cast.
    if(e.kind==='cast'&&e.origin&&e.endpoint&&e.fighter&&SPIRIT_CALLERS[e.fighter]?.heavy==='finger'&&e.slot==='heavy'&&!e.branch){
      const root=new THREE.Group();root.name='needle-finger';root.visible=false;
      const shaft=new THREE.Mesh(this.fingerGeometry,this.fingerMaterial),core=new THREE.Mesh(this.fingerGeometry,this.fingerCoreMaterial),tip=new THREE.Mesh(this.fingerTipGeometry,this.fingerMaterial);
      shaft.name='needle-finger-shaft';core.name='needle-finger-core';tip.name='needle-finger-tip';root.add(shaft,core,tip);this.scene.add(root);
      this.fingers.push({event:e,root,shaft,core,tip});if(this.fingers.length>8)this.removeFinger(this.fingers.shift()!);
    }
    if(['hit','guard-break','blocked'].includes(e.kind)){
      for(const slash of this.slashes)if(slash.event.actorId===e.actorId&&slash.event.slot===e.slot&&e.serverTime>slash.event.serverTime&&slash.hitAt===undefined){slash.hitAt=e.serverTime;if(e.endpoint)slash.hitPoint=new THREE.Vector3(e.endpoint.x,e.endpoint.y,e.endpoint.z);}
      if(e.endpoint)for(const finger of this.fingers)if(finger.event.actorId===e.actorId&&e.slot==='heavy'&&!e.branch&&e.serverTime>finger.event.serverTime&&finger.hitAt===undefined){finger.hitAt=e.serverTime;finger.hitPoint=new THREE.Vector3(e.endpoint.x,e.endpoint.y,e.endpoint.z);}
    }
  }}
  /** Where the finger's tip is at `age` seconds into its cast: out at the
   *  move's own speed to its range or to the body it struck, a beat there, and
   *  back. Exposed for the tests; metres from the hand. */
  static fingerReach(age:number,hitAt?:number){
    const move=MOVES.koko.heavy,contact=move.contacts[0],speed=move.speed??40;
    const out=Math.max(0,age-contact)*speed;
    const stopAt=hitAt!==undefined?Math.min(move.range,Math.max(0,hitAt-contact)*speed):move.range;
    const reachedAt=contact+stopAt/speed;
    if(age<reachedAt)return Math.min(out,stopAt);
    return Math.max(0,stopAt-Math.max(0,age-reachedAt-FINGER_HOLD)*FINGER_RETRACT);
  }
  /** Where the steamroller is `elapsed` seconds into an ultimate whose
   *  finisher lands at `finisher` (signature/Steamroller). Exposed for the tests. */
  static rollerAt(elapsed:number,finisher:number){return rollerAt(elapsed,finisher);}
  private removeFinger(f:Finger){f.root.removeFromParent();}
  /** The opponent a spirit's user is turned to, within SPIRIT_REACH: the one most
   *  squarely in front, nearest first among the equally square. Through a
   *  time stop's tour the simulation turns the user to each victim in turn
   *  (timeStopTour), so this is whoever is being visited. */
  private victimOf(owner:Fighter,fighters:ReadonlyMap<string,Fighter>):Fighter|undefined{
    const s=owner.state,fx=Math.sin(s.yaw),fz=Math.cos(s.yaw);let best:Fighter|undefined,score=-Infinity;
    for(const [id,body] of fighters){const q=body.state;
      if(id===s.id||!q.alive||id.startsWith('warm-')||(s.team!==undefined&&q.team===s.team))continue;
      const dx=q.x-s.x,dz=q.z-s.z,d=Math.hypot(dx,dz);if(d>SPIRIT_REACH||d<1e-3)continue;
      const along=(dx*fx+dz*fz)/d;if(along<.6)continue;
      const value=along*2-d;if(value>score){score=value;best=body;}}
    return best;
  }
  /** The spirit's clock through a tour's barrage: its barrage clip's punches,
   *  looped at their own pace from the tour's first blow to its last, rather
   *  than the whole clip - wind-up and all - stretched across the tour. The
   *  loop is short enough that Fighter reads it as the same action going on
   *  (a clock that runs back more than a quarter of the move is a new one). */
  private barrageState(into:PlayerState,s:PlayerState,fighter:FighterId,elapsed:number,from:number){
    const flurry=MOVES[fighter].special,first=flurry.contacts[0],loop=flurry.contacts[Math.min(BARRAGE_LOOP,flurry.contacts.length-1)]-first,t=elapsed-from;
    const clock=t<BARRAGE_LEAD?first-BARRAGE_LEAD+t:first+(t-BARRAGE_LEAD)%loop;
    into.action='special';into.actionStarted=s.actionStarted+from;into.actionDuration=flurry.duration;into.actionTime=clock/flurry.duration;into.actionSeq=s.actionSeq;into.chain=0;
  }
  /** The time-stop ultimate's numbers for a fighter, base and awakened, read
   *  once: moveFor and tourContacts build objects, and this is every frame. */
  private ultimate(fighter:FighterId,awakened:boolean):UltimateTiming{
    let both=this.ultimates.get(fighter);
    if(!both){both=[false,true].map(a=>{const move=moveFor(fighter,'ultimate',a),stop=move.timeStop!,stopFrom=move.contacts[stop.contact],blows=tourContacts(move);
      return {contacts:move.contacts,stop,stopFrom,finisher:move.contacts[move.contacts.length-1],barrageFrom:(blows?move.contacts[blows.first]:stopFrom)-BARRAGE_LEAD,barrageTo:(blows?move.contacts[blows.last]:stopFrom)+BARRAGE_TAIL};});this.ultimates.set(fighter,both);}
    return both[awakened?1:0];
  }
  /** A spirit's user's spirit, built the first time it is needed: a Fighter of its
   *  own on the spirit's rig, driven by its user's state, drawn in its printed
   *  shell (see SPIRIT_SHELL), with its LOOM bookkeeping. */
  private spiritFor(id:string,owner:Fighter,user:SpiritCaller){
    let spirit=this.spirits.get(id);if(spirit)return spirit;
    const s=owner.state,fighter=s.fighter,source=this.sources.get(fighter);if(!source)return undefined;
    spirit=new Fighter({...s,id:id+'-spirit',awakened:false},source,false,[...this.rushClips.get(fighter)??[],...spiritEnderClips(fighter,owner,source)]);spirit.isSpirit=true;spirit.prepareRush();
    // A manifestation floats: no feet planted on a floor it is not standing
    // on, and no lean, tremor or life layer under the hover LOOM draws.
    spirit.dynamics=false;
    // Turned, then leaned in its own frame (see LOOM.lean).
    spirit.group.rotation.order='YXZ';
    // A part with a morph target (Iron Spirit's pointing hand) is a
    // shadow-map program of its own, which nothing links until the spirit
    // first casts a shadow - the frame it first looms. It casts none.
    spirit.model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m.geometry.morphAttributes.position)m.castShadow=false;});spirit.group.name=user.name;spirit.model.traverse(o=>{if(!(o as THREE.Mesh).isMesh)return;const m=o as THREE.Mesh;for(const mat of Array.isArray(m.material)?m.material:[m.material]){mat.transparent=true;mat.opacity=.94;}});this.spirits.set(id,spirit);this.scene.add(spirit.group);
    this.looms.set(id,{presence:0,surge:0,bearing:s.yaw,height:s.y,placed:false,clock:0,risen:0,state:{...spirit.state},stare:new THREE.Vector3(),shadow:spirit.group.getObjectByName('contact-shadow'),
      bones:BEND_BONES.map(name=>spirit!.joints.get(name) as THREE.Bone|undefined),rest:BEND_BONES.map(()=>new THREE.Quaternion()),bent:false,casters:[],casting:true});
    // A spirit is a manifestation: a translucent shell in its own colour
    // with a burning edge and an ink line, faded as the lens nears.
    spirit.model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m.castShadow)this.looms.get(id)!.casters.push(m);});
    const look=SPIRIT_SHELL[fighter];if(look){const chest=new THREE.Object3D();chest.position.y=1.2;spirit.group.add(chest);this.looms.get(id)!.anchor=chest;const shell=new GhostShell(spirit.model,look.body,look.rim,SPIRIT_OPACITY,look.ink,2.2,false,look.print);shell.fadeNear(chest,1.3,2.6);this.shells.set(id,shell);
      // The loading screen's spirit (a warm fighter's) wears its shell from
      // the start, so the compile links the shell's programs on the spirit's
      // own parts - Iron Spirit's pointing hand carries a morph target,
      // a program variant of its own - and an awakening links nothing.
      if(id.startsWith('warm-'))shell.enabled=true;}
    return spirit;
  }
  /** The spirit draws its user's action, on its user's clock, with its own
   *  clips - or through the tour, the barrage (see barrageState). */
  private mirror(into:PlayerState,s:PlayerState,barrage:boolean,elapsed:number,barrageFrom:number){
    if(barrage){into.branch=undefined;this.barrageState(into,s,s.fighter,elapsed,barrageFrom);return;}
    into.action=s.action;into.actionStarted=s.actionStarted;into.actionDuration=s.actionDuration;into.actionTime=s.actionTime;into.actionSeq=s.actionSeq;into.chain=s.chain;
    // A combo ender: the spirit throws the ender's own clip (spiritEnderClips), on the ender's timing.
    into.branch=s.branch;
  }
  /** One spirit's user's spirit, this frame: summoned for the length of a swing,
   *  or - awakened - looming over its user for the whole window (see LOOM). */
  private drawSpirit(id:string,owner:Fighter,user:SpiritCaller,fighters:ReadonlyMap<string,Fighter>,time:number,dt:number,elapsed:number,barrage:boolean,barrageFrom:number,finisher:number,camera?:THREE.Camera){
    const spirit=this.spiritFor(id,owner,user);if(!spirit)return;
    const s=owner.state,fighter=s.fighter,loom=this.looms.get(id)!,shell=this.shells.get(id),st=loom.state;
    if(fighter==='kinu'&&(s.action==='special'||s.action==='ultimate')&&loom.referenceSeq!==s.actionSeq){
      loom.referenceSeq=s.actionSeq;loom.referencePresent=spirit.group.visible;loom.referenceYaw=spirit.group.rotation.y;
      if(loom.referencePresent)(loom.referenceFrom??=new THREE.Vector3()).copy(spirit.group.position);
    }
    if(fighter==='kinu'){
      const command=s.alive&&(s.action==='special'||s.action==='ultimate');
      const otherStrike=s.action==='light'||s.action==='heavy';
      if(!command&&loom.referenceActive&&s.alive&&s.awakened&&!otherStrike&&spirit.group.visible){
        // The visible partner must return from the attack lane rather than
        // jump to idle. Reuse the entry vector after the command has ended.
        (loom.referenceFrom??=new THREE.Vector3()).copy(spirit.group.position);
        loom.referenceYaw=spirit.group.rotation.y;loom.referenceReturn=0;
      }
      if(command||otherStrike||!s.alive||!s.awakened)loom.referenceReturn=undefined;
      loom.referenceActive=command;
    }
    if(fighter==='kinu'&&loom.stagedYaw!==undefined){spirit.group.rotation.y=loom.stagedYaw;loom.stagedYaw=undefined;}
    if(authoredSpirit(fighter))owner.spiritSource=spirit;
    const awake=!!s.awakened&&s.alive;
    // How far the looming spirit is out: risen out of its user over the
    // transformation, and broken up again as the window runs out (on the
    // server's clock, so it is gone as the window closes) or on a death.
    // Seconds into the awakening: the transformation's own clock while it
    // plays, then counted on (a spirit first seen mid-window rises from then).
    loom.risen=!awake?0:s.action==='awaken'?Math.max(elapsed,loom.risen):loom.risen+dt;
    let goal=0;
    if(awake){
      goal=THREE.MathUtils.smoothstep(loom.risen,LOOM.riseFrom,LOOM.riseTo);
      if(s.awakenedUntil!==undefined)goal=Math.min(goal,THREE.MathUtils.clamp((s.awakenedUntil-time)/LOOM.exit,0,1));
    }
    loom.presence+=(goal-loom.presence)*(1-Math.exp(-dt*(awake?24:5)));
    if(!awake&&loom.presence<.004)loom.presence=0;
    const looming=awake||loom.presence>0;
    // Whom it strikes: the opponent its user is turned to, within reach -
    // through the tour that is each victim in turn - else, outside the
    // tour, the lock. Nobody while the user is crossing the field.
    const struck=this.victimOf(owner,fighters),lock=s.target?fighters.get(s.target):undefined,foe=struck??(barrage?undefined:lock);
    // What the spirit draws: its user's blow, on its user's clock, with its
    // own clips - or through the tour, the barrage (see barrageState).
    st.fighter=fighter;st.team=s.team;st.target=s.target;st.hitstop=s.hitstop;st.actionFrozen=s.actionFrozen;
    // The spirit is the manifestation, not the awakened fighter: it floats and
    // it is not hit; it holds still with its user in somebody else's stopped
    // time (its own user's stop never holds its user).
    st.awakened=false;st.alive=true;st.grounded=authoredSpirit(fighter)?s.grounded:true;st.timeStopped=s.timeStopped;
    if(authoredSpirit(fighter)){st.confirmedAt=s.confirmedAt;st.whiffedAt=s.whiffedAt;}
    let x:number,y:number,z:number,yaw:number,scale=1,lean=0,shown:boolean;
    if(looming){
      const striking=s.alive&&(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate');
      // Its blows are its user's: it comes round and throws each of them,
      // from a little before the first contact to a little after the last.
      let want=0;
      if(striking){
        const ender=Fighter.ender(s),contacts=s.action==='light'?rushMove(fighter,s.chain??0,!!s.awakened).contacts:s.action==='ultimate'?undefined
          :(ender&&comboMove(fighter,ender,!!s.awakened)||moveFor(fighter,s.action as AttackSlot,!!s.awakened)).contacts;
        want=elapsed<(contacts?contacts[contacts.length-1]:finisher)+.3?1:0;
      }else if(s.alive&&s.action==='guard')want=LOOM.guard;
      loom.surge+=(want-loom.surge)*(1-Math.exp(-dt*(want>loom.surge?LOOM.surgeIn:LOOM.surgeOut)));
      if(striking||s.alive&&(s.action==='guard'||s.action==='awaken'))this.mirror(st,s,barrage,elapsed,barrageFrom);
      else{st.action='idle';st.actionStarted=0;st.actionDuration=0;st.actionTime=0;st.actionSeq=undefined;st.chain=0;}
      // Hovering: it breathes, bobs and sways - all of it held in an impact
      // freeze with its user, and quietened while it strikes.
      if(!s.hitstop&&!s.timeStopped)loom.clock+=dt;
      const u=loom.surge,calm=1-u,k=loom.presence,rise=k*k*(3-2*k),c=loom.clock*Math.PI*2;
      const p=owner.group.position;
      if(!loom.placed){loom.bearing=s.yaw;loom.height=p.y;loom.placed=true;}
      loom.bearing+=wrap(s.yaw-loom.bearing)*(1-Math.exp(-dt*LOOM.turn));
      loom.height+=(p.y-loom.height)*(1-Math.exp(-dt*LOOM.follow));
      const back=THREE.MathUtils.lerp(LOOM.back,LOOM.strikeBack,u)*rise,side=(THREE.MathUtils.lerp(LOOM.side,LOOM.strikeSide,u)+Math.sin(c*.21+1.3)*LOOM.sway*calm)*rise;
      const lift=THREE.MathUtils.lerp(LOOM.emergeLift,THREE.MathUtils.lerp(LOOM.lift,LOOM.strikeLift,u)+Math.sin(c*LOOM.bobRate)*LOOM.bob*(1-.7*u),rise);
      const fx=Math.sin(loom.bearing),fz=Math.cos(loom.bearing);
      // Behind its user and to their left: (cos, -sin) of the bearing is left.
      x=p.x-fx*back+fz*side;z=p.z-fz*back-fx*side;y=loom.height+lift;
      yaw=loom.bearing;if(foe&&u>.001)yaw+=wrap(Math.atan2(foe.group.position.x-x,foe.group.position.z-z)-loom.bearing)*u;
      scale=THREE.MathUtils.lerp(LOOM.emergeScale,AWAKENINGS[fighter].formScale??LOOM.scale,rise)*(1+Math.sin(c*LOOM.breatheRate)*LOOM.breathe*(1-.5*u));
      lean=(LOOM.restLean*calm+LOOM.lean*u)*rise;
      shown=true;
      this.spiritFades.set(id,0);
    }else{
      loom.placed=false;loom.surge=0;
      // LORD ORO throws his ordinary knives himself. Summoning HUSH for that
      // pose hid his hands behind a second body and repeated the same throw.
      // A combo ender is the string's big blow, and the spirit comes for it - LORD ORO's too, whose heavy is otherwise his own
      // knives - throwing the ender's own clip with its user (mirror, spiritEnderClips).
      // Round 4b: and for the light string, which it throws while its user commands it (SPIRIT_CALLERS' `string`).
      const string=!!user.string&&s.action==='light'&&(s.grounded||authoredSpirit(fighter));
      const attacking=s.alive&&(string||s.action==='special'||s.action==='ultimate'||(s.action==='heavy'&&(user.heavy==='finger'||user.heavy==='punch'||!!Fighter.ender(s))));
      // In fast, out slow: the heavy lands at 0.3 s (round 3d), and a spirit that is
      // still fading up at the contact reads as having been summoned late.
      const fade=THREE.MathUtils.lerp(this.spiritFades.get(id)??0,attacking?1:0,1-Math.exp(-dt*(attacking?40:18)));this.spiritFades.set(id,fade);
      shown=fade>.015;
      if(attacking)this.mirror(st,s,barrage,elapsed,barrageFrom);
      // Over his shoulder: beside him and a step behind, floating, never on
      // the line between him and his target.
      // Round 4b: for the light string, between him and his victim, its fist landing on them at full reach.
      let forward=-.32,side=.62;
      if(string||authoredSpirit(fighter)&&attacking){const gap=foe?Math.hypot(foe.state.x-s.x,foe.state.z-s.z):STRING_SPOT.reach+STRING_SPOT.most;forward=THREE.MathUtils.clamp(gap-STRING_SPOT.reach,STRING_SPOT.least,STRING_SPOT.most);side=STRING_SPOT.side;}
      x=s.x+Math.sin(s.yaw)*forward+Math.cos(s.yaw)*side;z=s.z+Math.cos(s.yaw)*forward-Math.sin(s.yaw)*side;y=s.y+(string?.12:.3);
      yaw=foe?Math.atan2(foe.state.x-x,foe.state.z-z):s.yaw;
    }
    const nativeKinuStrike=fighter==='kinu'&&s.alive&&(s.action==='light'||s.action==='heavy'||s.action==='special'||s.action==='ultimate');
    if(nativeKinuStrike){
      const gap=foe?Math.hypot(foe.state.x-s.x,foe.state.z-s.z):2;
      const forward=THREE.MathUtils.clamp(gap-.95,.0,1.25),side=.20;
      x=s.x+Math.sin(s.yaw)*forward+Math.cos(s.yaw)*side;
      z=s.z+Math.cos(s.yaw)*forward-Math.sin(s.yaw)*side;
      y=s.y;scale=1;lean=0;yaw=foe?Math.atan2(foe.state.x-x,foe.state.z-z):s.yaw;
    }
    if(fighter==='kinu'&&looming&&!nativeKinuStrike){
      // Her puppet is her partner, not an encompassing copy of her torso.
      // Keep the native source scale and give the complete entry/idle a side lane.
      const rise=loom.presence*loom.presence*(3-2*loom.presence),side=.55+(KINU_SPIRIT_STAGING.idleSide-.55)*rise;
      x=owner.group.position.x+Math.cos(s.yaw)*side-Math.sin(s.yaw)*KINU_SPIRIT_STAGING.idleBack;
      z=owner.group.position.z-Math.sin(s.yaw)*side-Math.cos(s.yaw)*KINU_SPIRIT_STAGING.idleBack;
      y=owner.group.position.y+KINU_SPIRIT_STAGING.idleLift*rise;scale=1;lean=0;yaw=s.yaw;
    }
    spirit.group.visible=shown&&!this.probeHidden;
    if(!shown){if(shell)shell.dissolve=0;setLoomTop(id,0);return;}
    st.x=x;st.y=y;st.z=z;st.yaw=yaw;
    spirit.group.scale.setScalar(scale);
    // The spirit stares its victim down.
    const head=foe?.state.alive?foe.joints.get('Head'):undefined;
    spirit.targetPoint=head?head.getWorldPosition(loom.stare):foe?.state.alive?loom.stare.copy(foe.group.position).setY(foe.group.position.y+1.6):undefined;
    this.unbend(loom);
    spirit.update(dt,st,true);
    spirit.group.rotation.x=lean;
    if(nativeKinuStrike){
      let flank:number=KINU_SPIRIT_STAGING.flankRadians;
      spirit.strikePoint(this.lift);
      const reference=(s.action==='special'||s.action==='ultimate')&&kinuContactReference(spirit.group,spirit.joints.get('Hips'),spirit.displayedClipName,spirit.displayedClipTime,this.lift,this.lift);
      if(camera&&foe&&(s.action==='special'||s.action==='ultimate')){
        const e=camera.matrixWorld.elements,view=Math.atan2(e[0],e[2]);
        const entering=loom.flankSeq!==s.actionSeq;
        if(entering){loom.flankSeq=s.actionSeq;loom.flankView=undefined;loom.flankGoal=kinuInitialFlank(owner.group.position,foe.group.position,camera);}
        if(loom.flankView===undefined||Math.abs(Math.atan2(Math.sin(view-loom.flankView),Math.cos(view-loom.flankView)))>KINU_SPIRIT_STAGING.viewHysteresis){
          loom.flankGoal=kinuViewFlank(spirit.joints,owner.joints,foe.joints,this.lift,camera,loom.flankGoal??flank);loom.flankView=view;
          if(entering)loom.flank=loom.flankGoal;
        }
        const current=loom.flank??flank,step=KINU_SPIRIT_STAGING.turnSpeed*Math.min(.05,Math.max(0,dt));
        flank=current+THREE.MathUtils.clamp((loom.flankGoal??flank)-current,-step,step);loom.flank=flank;
      }
      // Return to this native yaw before the next update; a display offset
      // must never feed back into Fighter's turn interpolation.
      loom.stagedYaw=spirit.group.rotation.y;kinuFlankAroundContact(spirit.group,this.lift,reference?1:THREE.MathUtils.smoothstep(elapsed,0,.065),flank);
      // A hidden summon manifests in its chosen lane. An already-visible
      // partner moves there continuously during anticipation, before contact.
      if(reference&&loom.referencePresent&&loom.referenceFrom&&elapsed<KINU_REFERENCE_ENTRY){
        const u=THREE.MathUtils.smoothstep(elapsed,0,KINU_REFERENCE_ENTRY),from=loom.referenceYaw??spirit.group.rotation.y;
        spirit.group.position.lerpVectors(loom.referenceFrom,spirit.group.position,u);
        spirit.group.rotation.y=from+wrap(spirit.group.rotation.y-from)*u;spirit.group.updateMatrixWorld(true);
      }
    }
    if(fighter==='kinu'&&!nativeKinuStrike&&loom.referenceReturn!==undefined&&loom.referenceFrom){
      const u=THREE.MathUtils.smoothstep(loom.referenceReturn,0,KINU_REFERENCE_RETURN),from=loom.referenceYaw??spirit.group.rotation.y;
      loom.stagedYaw=spirit.group.rotation.y;
      spirit.group.position.lerpVectors(loom.referenceFrom,spirit.group.position,u);
      spirit.group.rotation.y=from+wrap(spirit.group.rotation.y-from)*u;spirit.group.updateMatrixWorld(true);
      if(u===1)loom.referenceReturn=undefined;
      else if(!s.hitstop&&!s.timeStopped)loom.referenceReturn+=Math.max(0,dt);
    }
    if(looming&&fighter!=='kinu'&&!nativeKinuStrike)this.bend(spirit,loom,THREE.MathUtils.lerp(LOOM.bend,LOOM.strikeBend,loom.surge)*loom.presence,THREE.MathUtils.lerp(LOOM.tilt,LOOM.strikeTilt,loom.surge)*loom.presence);
    // How high it reaches over its user, for the lock-on camera (loomRegistry):
    // to its neck, so the lens stands back for its shoulders and bowed head.
    const neck=looming?loom.bones[3]??spirit.joints.get('Head'):undefined;
    setLoomTop(id,neck?(neck.getWorldPosition(this.lift).y-owner.group.position.y)*loom.presence:0);
    if(loom.shadow)loom.shadow.visible=false;
    const casting=!looming||loom.presence>.97;
    if(casting!==loom.casting){loom.casting=casting;for(const m of loom.casters)m.castShadow=casting;}
    if(shell){
      // Round 3 (owner): the Iron Spirit of the awakening is the one that
      // appears for his normal attacks - the same printed shell, rim, ink and
      // glow on the same body. HUSH likewise for LORD ORO.
      shell.enabled=true;shell.opacity=SPIRIT_OPACITY*(looming?1:this.spiritFades.get(id)!);shell.clock=time;
      shell.dissolve=looming?1-loom.presence:0;
      if(loom.anchor)loom.anchor.position.y=looming?.55:1.2;
      if(looming)shell.fadeRange(LOOM.near,LOOM.far,loom.bones[3]);else shell.fadeRange(1.3,2.6);
      // Readable through it (see LOOM.keepTarget): whoever its user is
      // fighting, and - looming - its user; and the local player's own target
      // when that is somebody else.
      const target=lock&&lock!==owner&&lock.state.alive?lock:foe;
      shell.setWindow(0,target,LOOM.keepTarget);
      shell.setWindow(1,looming||fighter==='kinu'?owner:undefined,fighter==='kinu'?KINU_SPIRIT_STAGING.ownerWindow:LOOM.keepUser);
      const local=SIGNATURE.localId===undefined?undefined:fighters.get(SIGNATURE.localId);
      const theirs=local&&local!==owner&&local.state.target?fighters.get(local.state.target):undefined;
      shell.setWindow(2,theirs&&theirs!==target&&theirs!==owner&&theirs.state.alive?theirs:undefined,LOOM.keepTarget);
    }
    this.barrageFists(spirit,fighter,s,foe,elapsed,barrage);
  }
  /** The loom's bend (see LOOM.bend): each spine bone turned about the
   *  spirit's own left-right axis by a third of `amount`, the neck back by
   *  BEND_NECK of it - rotating a bone about its head by a world rotation R is
   *  local = parent^-1 * R * parent * local. The clip's pose is kept, and put
   *  back by `unbend` before the next update, so nothing that blends from the
   *  drawn pose ever sees the bend twice. */
  private bend(spirit:Fighter,loom:Loom,amount:number,tilt=0){
    if(Math.abs(amount)<1e-4&&Math.abs(tilt)<1e-4)return;
    spirit.group.updateMatrixWorld(true);
    spirit.group.getWorldQuaternion(this.bendParent);
    // Forward about its left-right axis, and over toward its user (on its
    // right) about its own forward one.
    const axis=this.bendAxis.set(1,0,0).applyQuaternion(this.bendParent),across=this.bendAcross.set(0,0,1).applyQuaternion(this.bendParent);
    for(let i=0;i<loom.bones.length;i++){
      const bone=loom.bones[i];if(!bone?.parent)continue;
      loom.rest[i].copy(bone.quaternion);
      const share=i<3?1/3:BEND_NECK;
      this.bendWorld.setFromAxisAngle(axis,amount*share).multiply(this.bendTilt.setFromAxisAngle(across,tilt*share));
      bone.parent.getWorldQuaternion(this.bendParent);
      this.bendLocal.copy(this.bendParent).invert().multiply(this.bendWorld).multiply(this.bendParent);
      bone.quaternion.premultiply(this.bendLocal);
      bone.updateMatrixWorld(true);
    }
    loom.bent=true;
    // The hands moved with the torso: where the fists and the finger leave from.
    spirit.bones.get('righthand')?.getWorldPosition(spirit.handR);spirit.bones.get('lefthand')?.getWorldPosition(spirit.handL);
  }
  private unbend(loom:Loom){
    if(!loom.bent)return;
    for(let i=0;i<loom.bones.length;i++)loom.bones[i]?.quaternion.copy(loom.rest[i]);
    loom.bent=false;
  }
  /** GAN / 'GILDED PUNCH': through the special's barrage and the tour's, a wall of fists
   *  converging on the victim from the spirit's hand, each with a smear of its
   *  light, and a flash on every beat the move lands. */
  private barrageFists(spirit:Fighter,fighter:FighterId,s:PlayerState,foe:Fighter|undefined,elapsed:number,barrage:boolean){
    if(authoredSpirit(fighter)){
      // Accents stay on the actual authored fists; no generated wall hides the acting.
      if(s.action!=='light'&&s.action!=='heavy'&&s.action!=='special'&&s.action!=='ultimate')return;
      const slot=s.action as AttackSlot,ender=Fighter.ender(s),move=ender?comboMove(fighter,ender,false):slot==='light'?rushMove(fighter,s.chain??0,false):moveFor(fighter,slot,false);
      if(!move)return;const times=move.contacts,glow=SPIRIT_GLOW[fighter]!;
      for(let i=0;i<times.length;i++){
        if(slot==='ultimate'&&i>0&&s.confirmedAt===undefined)continue;
        const near=1-Math.min(1,Math.abs(elapsed-times[i])/.11);if(near<=0)continue;
        const alternate=!ender&&(slot==='special'||slot==='ultimate');
        const hand=fighter==='kinu'&&spirit.meleeContactPoint(i,this.lift)?this.lift:alternate&&i%2?spirit.handL:spirit.handR;
        this.glows.add(hand,.17+.06*near,glow,.38*near,RING,.025,0);
      }
      return;
    }
    const fists=this.fists.get(fighter);
    // Round 3d (PACE): the special's wall runs from 0.3 s before its first blow
    // to 0.3 s past its last - 0.8 to 2.6 s when those were 1.1 and 2.29.
    const flurry=MOVES[fighter].special;
    // (Not through a combo ender thrown in the special's slot: that is one blow, not the barrage.)
    if(!fists||!foe||!((s.action==='special'&&!Fighter.ender(s)&&elapsed>flurry.contacts[0]-.3&&elapsed<flurry.contacts[flurry.contacts.length-1]+.3)||barrage))return;
    let fistCount=this.fistCounts.get(fighter)??0;const wrist=spirit.bones.get('righthand');const target=this.barrageTarget;target.copy(foe.group.position).add(this.lift.set(0,1.12,0));if(wrist)wrist.getWorldQuaternion(this.fistPose.quaternion);
    // Round 3e (ULTFIX): into the victim only inside the barrage's own reach
    // (meleeReach, from its user): one standing past it - the lock across the
    // room - is not drawn pummelled while it takes nothing; the fists spend
    // themselves at the reach. The tour's victims are always inside it.
    if(!barrage){const reach=meleeReach(fighter,'special',flurry),dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz);if(d>reach){const edge=reach-PLAYER_RADIUS;target.x=s.x+dx/d*edge;target.z=s.z+dz/d*edge;}}
    const glow=SPIRIT_GLOW[fighter]!;
    // A fan of fists from across the spirit's shoulders, bigger than a
    // man's and converging on the target, each with the ghost of where it
    // was an instant ago and a smear of the spirit's light behind it.
    this.barrageFrom.copy(target).sub(spirit.handR).normalize();this.knifeSide.crossVectors(UP,this.barrageFrom).normalize();
    for(let k=0;k<30&&fistCount<94;k++){const phase=(elapsed*5.5+k*.618)%1,lateral=((k%8)/7*2-1)*.95,rise=(((k*3)%5)/4*2-1)*.55,spread=1-.8*phase;
      this.fistPose.position.copy(spirit.handR).lerp(target,phase).addScaledVector(this.knifeSide,lateral*spread).addScaledVector(UP,rise*spread);this.fistPose.scale.setScalar(2.5+phase*.4);this.fistPose.updateMatrix();fists.setMatrixAt(fistCount++,this.fistPose.matrix);
      if(k%2===0){this.smearTail.copy(this.fistPose.position).addScaledVector(this.barrageFrom,-.32);this.fistPose.position.copy(this.smearTail);this.fistPose.scale.setScalar(2.1+phase*.3);this.fistPose.updateMatrix();fists.setMatrixAt(fistCount++,this.fistPose.matrix);}
      this.smearTail.copy(this.fistPose.position).addScaledVector(this.barrageFrom,-(.3+.3*phase));this.bolts.segment(this.smearTail,this.fistPose.position,.06,glow,.5*(1-phase*.4),.12);}
    this.fistCounts.set(fighter,fistCount);
    const beats=barrage?this.ultimate(fighter,!!s.awakened).contacts:MOVES[fighter].special.contacts;let near=0;for(const c of beats)near=Math.max(near,1-Math.min(1,Math.abs(elapsed-c)/.06));
    if(near>0){this.glows.add(target,.9*near,glow,near,STAR,.18,Math.floor(elapsed*30));this.glows.add(target,.7,glow,.6*near,RING,.05,0,.3+.5*(1-near));}
    this.lights.add(target,3,glow,.25+.35*near);
  }
  /** A streak for every frame the user moves further than TRAIL_STEP while
   *  touring a stop: a glide leaves a ribbon of them, a teleport one long one. */
  private trace(id:string,owner:Fighter,fighter:FighterId,touring:boolean,time:number){
    let last=this.lastAt.get(id),ghost=this.ghostAt.get(id);
    if(!last){last=owner.group.position.clone();this.lastAt.set(id,last);}
    if(!ghost){ghost=owner.group.position.clone();this.ghostAt.set(id,ghost);}
    if(touring&&last.distanceToSquared(owner.group.position)>TRAIL_STEP*TRAIL_STEP){
      const trail=this.trails[this.trailNext++%this.trails.length];trail.from.copy(last);trail.to.copy(owner.group.position);trail.born=time;trail.fighter=fighter;
      if(ghost.distanceToSquared(owner.group.position)>GHOST_STEP*GHOST_STEP){VfxKit.for(this.scene).ghosts.spawn(owner,ghostTint(fighter),time,.28,.65);ghost.copy(owner.group.position);}
    }else if(!touring)ghost.copy(owner.group.position);
    last.copy(owner.group.position);
  }
  update(time:number,dt:number,fighters:ReadonlyMap<string,Fighter>,density=1,camera?:THREE.Camera){
    this.unsealed.update(time,dt,fighters,density);this.threeBlade.update(time,dt,fighters,density);
    this.fistCounts.clear();this.lights.begin();this.bolts.begin();this.glows.begin(time);
    let spent=0;
    for(const [id,owner] of fighters){const user=SPIRIT_CALLERS[owner.state.fighter];if(!user)continue;const fighter=owner.state.fighter,s=owner.state,elapsed=s.actionTime*s.actionDuration;
      // Round 3: the ultimate is a tour of the stopped field. The user crosses
      // it to each opponent the stop caught (src/game/timeStopBarrage.ts) and
      // the spirit throws its barrage clip from the tour's first blow to its
      // last, base and awakened alike, at whoever he is turned to.
      if(authoredSpirit(fighter)){
        const started=performance.now(),move=moveFor(fighter,'ultimate',!!s.awakened);
        this.drawSpirit(id,owner,user,fighters,time,dt,elapsed,false,0,move.contacts[move.contacts.length-1],camera);
        if(!id.startsWith('warm-'))spent+=performance.now()-started;
        continue;
      }
      const {stop,stopFrom,finisher,barrageFrom,barrageTo}=this.ultimate(fighter,!!s.awakened);
      // Round 3d (ULTS): the barrage is the stop's cinematic - only once the
      // stop has caught somebody (the thrower's confirm).
      const barrage=s.alive&&s.action==='ultimate'&&s.confirmedAt!==undefined&&elapsed>=barrageFrom&&elapsed<barrageTo;
      const started=performance.now();
      this.drawSpirit(id,owner,user,fighters,time,dt,elapsed,barrage,barrageFrom,finisher,camera);
      if(!id.startsWith('warm-'))spent+=performance.now()-started;
      // The user's moves across the stopped field leave streaks of the spirit's light.
      this.trace(id,owner,fighter,s.alive&&s.action==='ultimate'&&s.confirmedAt!==undefined&&elapsed>stopFrom&&elapsed<finisher+.05,time);
      let field=this.timeFields.get(id);if(!field){const dome=new THREE.Mesh(this.ringGeometry,this.domeMaterial.clone());dome.name='clock-spirit-time-stop';dome.renderOrder=22;dome.frustumCulled=false;const still=new THREE.Mesh(this.ringGeometry,this.stillMaterial.clone());still.name='clock-spirit-stillness';still.renderOrder=21;still.frustumCulled=false;field={dome,still,origin:new THREE.Vector3(),anchored:false};this.timeFields.set(id,field);this.scene.add(dome,still);}
      // The stopped-time shell is drawn from the move's own numbers, so the
      // longer awakened stop does not need a second set of constants here.
      // Round 3d (ULTS): one that caught nobody resumes with the move, half a
      // second after the stop. Round 3e (ULTFIX): at once - the world comes
      // back the moment the whiff is known (whiffGone), not with the move.
      const stopTo=Math.min(stopFrom+stop.duration,whiffGone(s)),stopped=s.action==='ultimate'&&elapsed>=stopFrom&&elapsed<stopTo;
      field.dome.visible=field.still.visible=stopped;
      if(stopped){
        const inside=elapsed-stopFrom,left=stopTo-elapsed;
        // Where the clock stopped, held there while the user crosses the field.
        if(!field.anchored){field.origin.set(s.x,s.y,s.z);field.anchored=true;}
        const origin=field.origin;
        // The bubble sweeps out over the first 0.35 s as a burning edge and
        // is gone; the world then holds two-tone - the renderer's timeStop,
        // cold cyan with the fighters in ink, where there is one - and
        // comes back over the last quarter second.
        const sweep=THREE.MathUtils.smoothstep(inside,0,.35),edge=(1-THREE.MathUtils.smoothstep(inside,.25,.5))+(1-THREE.MathUtils.smoothstep(left,0,.25))*.6;
        const hold=THREE.MathUtils.smoothstep(inside,.2,.45)*THREE.MathUtils.smoothstep(left,.05,.3);
        field.dome.position.set(origin.x,origin.y+1,origin.z);field.still.position.copy(field.dome.position);
        field.dome.scale.setScalar(stop.radius*Math.max(.05,inside<.5?sweep:1));field.dome.visible=edge>.01;field.dome.material.uniforms.opacity.value=edge;
        // Whoever the stop holds - the user, or anyone inside the bubble - sees it.
        const local=SIGNATURE.localId===undefined?undefined:fighters.get(SIGNATURE.localId);
        const held=!local||local===owner||Math.hypot(local.state.x-origin.x,local.state.z-origin.z)<stop.radius;
        const screen=SIGNATURE.screen;
        if(held&&typeof screen?.timeStop==='function'){if(field.graded===undefined)screen.impactFrame?.(1);screen.timeStop(hold);field.still.visible=false;field.graded=hold;}
        else{field.still.scale.setScalar(stop.radius);field.still.visible=hold>.01;(field.still.material.uniforms.tint.value as THREE.Color).setRGB(1,1,1).lerp(STILL,hold);}
      }else{field.anchored=false;if(field.graded!==undefined){SIGNATURE.screen?.timeStop?.(0);field.graded=undefined;}}
      // MIDNIGHT's finisher is a steamroller (signature/Steamroller): it
      // drops through the last 0.8 s of the stop, crushes on the finisher as
      // the clock restarts, holds there crushed and comes apart.
      if(fighter==='oro'){
        const at=s.action==='ultimate'&&s.alive&&s.confirmedAt!==undefined?rollerAt(elapsed,finisher):undefined;
        if(at)this.dropRoller(id,owner,fighters,at,time,stop.radius);
        else if(this.rollerSet?.get(id)?.live)this.rollerSet.release(id);
      }
    }
    // The tour's streaks, fading.
    for(const trail of this.trails){const age=time-trail.born;if(!(age>=0&&age<TRAIL_LIFE))continue;const k=1-age/TRAIL_LIFE,glow=SPIRIT_GLOW[trail.fighter]??SPIRIT_GLOW.koko!;
      for(const h of TRAIL_HEIGHTS){this.smearTail.copy(trail.from);this.smearTail.y+=h;this.barrageFrom.copy(trail.to);this.barrageFrom.y+=h;this.bolts.segment(this.smearTail,this.barrageFrom,.11*k,glow,.6*k,.15);}
      if(age<.12){this.lift.copy(trail.to);this.lift.y+=1.05;this.glows.add(this.lift,1.1*k,glow,.5*k,RING,.05,0,.6);}}
    for(const [fighter,fists]of this.fists){fists.count=this.fistCounts.get(fighter)??0;fists.instanceMatrix.needsUpdate=true;}
    // Knives ride the flights CombatEffects keeps for LORD ORO's heavy: three to a
    // throw, fanned a hand's width apart, pointing where they are going. The
    // flight is deleted when the cast lands or expires, and so are these.
    let knifeCount=0;
    // The same props are visible in the throwing hand during the wind-up.
    // Previously knives first appeared in flight, while empty palms pushed.
    for(const actor of fighters.values()){
      const s=actor.state,elapsed=s.actionTime*s.actionDuration;
      // (A combo ender's own take holds no knives: only one drawn with the throw's clip does - Fighter's slotClip.)
      const ender=Fighter.ender(s),thrown=(ender&&comboMove('oro',ender,!!s.awakened)||MOVES.oro.heavy).contacts[0];
      if(s.fighter!=='oro'||s.action!=='heavy'||!s.alive||ender&&!actor.slotClip(s,['Clock-Hand Knives'])||elapsed>=thrown||knifeCount+KNIVES>KNIVES*KNIFE_FLIGHTS)continue;
      const knives=this.knifeMesh(),hand=actor.joints.get('RightHand');
      const index=hand?.getObjectByName('RightHandIndex2'),middle=hand?.getObjectByName('RightHandMiddle2');
      this.knifePose.position.copy(actor.handR);
      if(index&&middle)this.knifePose.position.copy(index.getWorldPosition(this.knifeAim)).lerp(middle.getWorldPosition(this.knifeSide),.5);
      this.knifeAim.set(Math.sin(s.yaw),.7,Math.cos(s.yaw)).normalize();
      this.knifeSide.crossVectors(UP,this.knifeAim).normalize();
      const grip=this.knifeGrip.copy(this.knifePose.position);
      for(let k=0;k<KNIVES;k++){
        const spread=k-(KNIVES-1)/2;
        this.knifePose.position.copy(grip).addScaledVector(this.knifeSide,spread*.025).addScaledVector(this.knifeAim,.07);
        this.knifePose.quaternion.setFromUnitVectors(FORWARD,this.knifeAim);this.knifePose.updateMatrix();knives.setMatrixAt(knifeCount++,this.knifePose.matrix);
      }
    }
    for(const flight of FLIGHTS.values()){
      if(flight.fighter!=='oro'||flight.slot!=='heavy'||!flight.released||knifeCount>=KNIVES*KNIFE_FLIGHTS)continue;
      const knives=this.knifeMesh();
      this.knifeSide.crossVectors(UP,flight.heading).normalize();
      for(let k=0;k<KNIVES;k++){const spread=k-(KNIVES-1)/2;
        this.knifeAim.copy(flight.heading).addScaledVector(this.knifeSide,spread*KNIFE_FAN).normalize();
        this.knifePose.position.copy(flight.position).addScaledVector(this.knifeSide,spread*KNIFE_SPREAD).addScaledVector(UP,Math.abs(spread)*-.05);
        this.knifePose.quaternion.setFromUnitVectors(FORWARD,this.knifeAim);this.knifePose.updateMatrix();knives.setMatrixAt(knifeCount++,this.knifePose.matrix);}
    }
    if(this.knives){this.knives.count=knifeCount;this.knives.visible=knifeCount>0;if(knifeCount)this.knives.instanceMatrix.needsUpdate=true;}
    for(let i=this.fingers.length-1;i>=0;i--){
      const finger=this.fingers[i],e=finger.event,move=MOVES.koko.heavy,contact=move.contacts[0],age=time-e.serverTime,actor=fighters.get(e.actorId);
      const reach=SwordSpiritEffects.fingerReach(age,finger.hitAt);
      const spent=age>contact+.05&&reach<=0;
      if(spent||age>move.duration+.5||(age<contact&&chargeWasCancelled(e,contact,actor?.state,time))){this.removeFinger(finger);this.fingers.splice(i,1);continue;}
      finger.root.visible=age>=contact&&reach>0;
      if(!finger.root.visible)continue;
      // From the spirit's hand, live: the spirit moves with KoKo and turns to
      // face its target, and a finger anchored to where the cast started would
      // detach from it. Without a spirit (not loaded yet) it is KoKo's hand.
      const spirit=this.spirits.get(e.actorId);
      if(spirit&&spirit.group.visible)this.fingerFrom.copy(spirit.handR);else if(actor)this.fingerFrom.copy(actor.handR);else this.fingerFrom.set(e.origin!.x,e.origin!.y,e.origin!.z);
      const target=finger.hitPoint??this.fingerTipAt.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z);
      this.fingerDir.copy(target).sub(this.fingerFrom);if(this.fingerDir.lengthSq()<1e-6)this.fingerDir.set(Math.sin(e.origin!.y),0,Math.cos(e.origin!.y));this.fingerDir.normalize();
      finger.root.position.copy(this.fingerFrom);finger.root.quaternion.setFromUnitVectors(UP,this.fingerDir);
      // The shaft thins as it reaches, the way a stretched thing does; a
      // spirit looming over its user points a finger as much thicker as it is.
      const width=.075*(1-.35*Math.min(1,reach/move.range))*(spirit&&spirit.group.visible?spirit.group.scale.x:1);
      finger.shaft.position.y=reach/2;finger.shaft.scale.set(width,Math.max(.01,reach),width);
      finger.core.position.y=reach/2;finger.core.scale.set(width*.45,Math.max(.01,reach),width*.45);
      finger.tip.position.y=reach;finger.tip.scale.setScalar(width*1.5);
      // The finger is the spirit's light, stretched: a violet glow along it.
      this.barrageFrom.copy(this.fingerFrom).addScaledVector(this.fingerDir,reach);this.bolts.segment(this.fingerFrom,this.barrageFrom,.16,SPIRIT_GLOW.koko!,.8,.18);this.lights.add(this.barrageFrom,2.5,SPIRIT_GLOW.koko!,.4);
    }
    for(const [id,spirit]of this.spirits)if(!fighters.has(id)&&!id.startsWith('warm-')){setLoomTop(id,0);spirit.dispose();this.spirits.delete(id);this.shells.get(id)?.dispose();this.shells.delete(id);this.looms.delete(id);const field=this.timeFields.get(id);if(field)this.removeField(field);this.timeFields.delete(id);this.rollerSet?.release(id);this.lastAt.delete(id);this.ghostAt.delete(id);}
    for(let i=this.slashes.length-1;i>=0;i--){const slash=this.slashes[i],e=slash.event,move=MOVES[e.fighter!][e.slot!],age=time-e.serverTime,contact=e.kind==='release'?0:move.contacts[0],actor=fighters.get(e.actorId),flight=move.style==='projectile',beam=move.style==='beam',duration=flight?contact+move.range/(move.speed??30):move.duration;
      if(age>duration+.15||(!slash.hitAt&&age<contact&&chargeWasCancelled(e,contact,actor?.state,time))){this.remove(slash);this.slashes.splice(i,1);continue;}
      const active=age>=contact-.12,progress=Math.max(0,age-contact);slash.root.visible=active;
      if(!active)continue;
      const yaw=Math.atan2(e.endpoint!.x-e.origin!.x,e.endpoint!.z-e.origin!.z);slash.root.rotation.set(0,yaw,0);
      if(flight){const distance=Math.min(move.range,progress*(move.speed??30));
        if(e.fighter==='strix'){
          const span=Math.hypot(e.endpoint!.x-e.origin!.x,e.endpoint!.z-e.origin!.z),t=Math.min(1,distance/Math.max(.01,span));
          slash.root.position.set(e.origin!.x+(e.endpoint!.x-e.origin!.x)*t,e.origin!.y+(e.endpoint!.y-e.origin!.y)*t,e.origin!.z+(e.endpoint!.z-e.origin!.z)*t);
          if(slash.hitPoint)slash.root.position.copy(slash.hitPoint);
          slash.root.scale.set(2.5,2.35,1);
        }else{slash.root.position.set(e.origin!.x+Math.sin(yaw)*distance,e.origin!.y+.65,e.origin!.z+Math.cos(yaw)*distance);slash.root.scale.setScalar(e.fighter==='kenzo'?3.3:3.6);}
      }
      else if(beam){slash.root.position.set(e.origin!.x+Math.sin(yaw)*Math.min(move.range,progress*70),e.origin!.y+2.8,e.origin!.z+Math.cos(yaw)*Math.min(move.range,progress*70));slash.root.scale.set(6,7.5,1);}
      else if(actor){slash.root.position.copy(actor.group.position).add(this.knifeAim.set(Math.sin(yaw)*1.25,1.1,Math.cos(yaw)*1.25));slash.root.scale.setScalar(e.slot==='ultimate'?4.2:2);slash.root.rotation.z=progress*10;if(e.fighter==='kenzo'&&e.slot==='heavy')slash.root.scale.y=.45;}
      const fade=slash.hitAt?1-THREE.MathUtils.smoothstep(time-slash.hitAt,0,.2):flight?1-THREE.MathUtils.smoothstep(age,duration-.15,duration+.15):1-THREE.MathUtils.smoothstep(progress,beam?.35:.08,beam?.85:.35);
      for(const m of slash.meshes){m.material.uniforms.uFade.value=fade;m.material.uniforms.uClock.value=time;}
      // The wave lights what it passes: the floor under a flying crescent, the
      // fighter it is cut in front of.
      this.lights.add(slash.root.position,flight?4:beam?7:3,slash.light,fade*(beam?.55:flight?.6:.4));
    }
    this.lights.end();this.bolts.end();this.glows.end();
    this.cost[this.costAt]=spent;this.costAt=(this.costAt+1)%this.cost.length;
  }
  /** One frame of a LORD ORO's steamroller. Whom it falls on is latched as it
   *  appears - the primary target, whom the tour ends on, if the stop caught
   *  them; else whoever LORD ORO is turned to; else the spot in front of him -
   *  and where it lands is latched too, so it stays put when the finisher
   *  launches the victim out from under it. */
  private dropRoller(id:string,owner:Fighter,fighters:ReadonlyMap<string,Fighter>,at:RollerPose,time:number,radius:number){
    const s=owner.state,roller=this.rollers.for(id),kit=this.vfx,glow=SPIRIT_GLOW.oro!;
    if(!roller.live){
      roller.live=true;roller.landed=roller.broke=false;roller.yaw=s.yaw;roller.nextSmoke=0;
      const origin=this.timeFields.get(id)?.origin,primary=s.target?fighters.get(s.target):undefined;
      const caught=primary&&primary.state.alive&&(!origin||Math.hypot(primary.state.x-origin.x,primary.state.z-origin.z)<radius);
      const foe=caught?primary:this.victimOf(owner,fighters);
      roller.target=foe?.state.id;
      if(foe)roller.spot.copy(foe.group.position);else roller.spot.set(s.x+Math.sin(s.yaw)*2.6,s.y,s.z+Math.cos(s.yaw)*2.6);
    }
    // Falling onto whoever it was dropped on: in stopped time they hold still.
    if(at.since<0&&roller.target){const foe=fighters.get(roller.target);if(foe)roller.spot.copy(foe.group.position);}
    roller.group.visible=true;
    // Crushed and still shuddering from the blows, less and less.
    roller.pose(at,at.since>=0&&at.broken===0?.05*Math.exp(-at.since*4):0);
    const p=roller.spot;
    // Coming in and slamming down: speed streaks above it (not while it hangs).
    if(at.since<0&&at.height>.3&&(at.since<-ROLLER_TIMING.hold||at.since>-ROLLER_TIMING.slam))for(let k=0;k<7;k++){const a=k*.9;this.smearTail.set(p.x+Math.cos(a)*1.1,p.y+at.height+2.4+(k%3)*.4,p.z+Math.sin(a)*1.1);this.barrageFrom.copy(this.smearTail);this.barrageFrom.y+=1.4+(k%2)*.8;this.bolts.segment(this.smearTail,this.barrageFrom,.035,glow,.6,.2);}
    // The crush, on the MIDNIGHT beat: the floor thrown up round it, a
    // gold burst and a flare of light that dies over a second.
    if(at.since>=0&&!roller.landed){roller.landed=true;
      kit.groundImpact(p.x,p.y,p.z,0,1,0,3,time,undefined,p.y);
      kit.dustRing(p.x,p.y,p.z,12,1.3,5.5,1.2,time,.9);
      kit.pulse(p.x,p.y+1.6,p.z,0xffc84a,9,9,time,.8,2);}
    if(at.since>=0&&at.since<.4){const k=1-at.since/.4;this.lift.set(p.x,p.y+1.5,p.z);this.glows.add(this.lift,3.6*k,glow,k,STAR,.2,7);this.glows.add(this.lift,2.4,glow,.7*k,RING,.05,0,.2+.8*(1-k));}
    // Smoke off the wreck while it holds.
    if(at.since>=0&&at.broken<.4&&time>=roller.nextSmoke){roller.nextSmoke=time+.07/Math.max(.4,kit.density);
      const a=Math.random()*Math.PI*2,r=.4+Math.random()*.8;kit.smoke(p.x+Math.cos(a)*r,p.y+1.2+Math.random()*1.4,p.z+Math.sin(a)*r,Math.cos(a)*.4,1.4+Math.random(),Math.sin(a)*.4,.5+Math.random()*.4,time,.7);}
    // Coming apart: a spray of wreckage with the parts.
    if(at.broken>0&&!roller.broke){roller.broke=true;kit.debris.burst(kit.n(14,4),p.x,p.y+1,p.z,0,1,0,7,1.1,.14,p.y,2);this.lift.set(p.x,p.y+1.2,p.z);kit.pulse(p.x,p.y+1.2,p.z,0xffc84a,5,6,time,.4,1);}
  }
  private removeField(f:TimeField){for(const m of [f.dome,f.still]){m.removeFromParent();m.material.dispose();}if(f.graded!==undefined)SIGNATURE.screen?.timeStop?.(0);}
  private remove(s:Slash){s.root.removeFromParent();for(const m of s.meshes){m.material.uniforms.uFade.value=0;this.slashHolder.add(m);this.slashPool.push(m);}s.meshes.length=0;}
  reset(){clearLoomTops();this.unsealed.reset();this.threeBlade.reset();for(const s of this.slashes)this.remove(s);this.slashes=[];for(const f of this.fingers)this.removeFinger(f);this.fingers=[];this.seen.clear();for(const [id,s]of this.spirits)if(!id.startsWith('warm-')){s.dispose();this.spirits.delete(id);this.shells.get(id)?.dispose();this.shells.delete(id);this.looms.delete(id);}this.spiritFades.clear();for(const fists of this.fists.values())fists.count=0;if(this.knives)this.knives.count=0;for(const f of this.timeFields.values())this.removeField(f);this.timeFields.clear();this.bolts.begin();this.bolts.end();this.glows.begin(0);this.glows.end();this.rollerSet?.reset();this.lastAt.clear();this.ghostAt.clear();for(const trail of this.trails)trail.born=-Infinity;}
  dispose(){this.reset();this.unsealed.dispose();this.threeBlade.dispose();this.ghostWarm.dispose();for(const s of this.spirits.values())s.dispose();this.spirits.clear();this.looms.clear();for(const shell of this.shells.values())shell.dispose();this.shells.clear();for(const fists of this.fists.values()){fists.removeFromParent();fists.geometry.dispose();(fists.material as THREE.Material).dispose();fists.dispose();}this.fists.clear();if(this.knives){this.knives.removeFromParent();this.knives.dispose();this.knives=undefined;}this.knifeGeometry.dispose();this.knifeMaterial.dispose();this.rollerSet?.dispose();this.rollerSet=undefined;if(this.kit){this.kit.release();this.kit=undefined;}this.plane.dispose();for(const m of this.slashPool)m.material.dispose();this.slashPool=[];this.slashHolder.removeFromParent();this.lights.dispose();this.bolts.dispose();this.glows.dispose();this.fieldWarm.removeFromParent();this.stillMaterial.dispose();this.ringGeometry.dispose();this.domeMaterial.dispose();this.fingerGeometry.dispose();this.fingerTipGeometry.dispose();this.fingerMaterial.dispose();this.fingerCoreMaterial.dispose();}
}
