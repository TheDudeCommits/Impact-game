import * as THREE from 'three';

const FRONT_GAP=.35,FRONT_SOFT=.9,FRONT_RATE=8,BOX_GAP=.12,BOX_SOFT=.35,FIGHT_NEAR=9,FIGHT_FAR=15,TARGET_IN=10,TARGET_OUT=4,ROOM_WALL=.9;
/** The boxes are cut as ellipses: all of it inside WINDOW_ROUND of the way
 *  out to the box's edge midpoints (the box is the padded joints, so the
 *  crown, the feet and the hands are inside), none past WINDOW_FEATHER more. */
const WINDOW_ROUND=1.1,WINDOW_FEATHER=.35;
/** A room: its walls' inner faces. */
export interface StageRoom{x0:number;x1:number;z0:number;z1:number}

/** The uniforms every stage material shares (see installCameraCutaway). */
export const stageFadeUniforms={
  uStageOn:{value:0},
  uStageFloor:{value:0},
  /** x: the depth from the lens nearer than which all of it goes, y: past
   *  which none of it does. */
  uStageFront:{value:new THREE.Vector2(0,0)},
  /** Boxes on screen (normalised device coordinates) and, for each, the depth
   *  nearer than which all of it goes, past which none does, and how much. */
  uStageBoxA:{value:new THREE.Vector4(2,2,2,2)},uStageDepthA:{value:new THREE.Vector3(0,0,0)},
  uStageBoxB:{value:new THREE.Vector4(2,2,2,2)},uStageDepthB:{value:new THREE.Vector3(0,0,0)},
  /** The room (x0, z0, x1, z1 of its walls' inner faces; x0 > x1 for none)
   *  and the lens. */
  uStageRoom:{value:new THREE.Vector4(1,1,-1,-1)},uStageEye:{value:new THREE.Vector3()},
};

/** The vertex half: the clip position, for the depth and the place on screen. */
export const STAGE_FADE_VERTEX='\n   vStageClip=gl_Position.xyw;';
/** The fragment half: `stageDrop(world)` is how much of the fragment at
 *  `world` goes (0..1), to be compared with a dither. */
export const STAGE_FADE_FRAGMENT=/* glsl */`
uniform float uStageOn,uStageFloor;
uniform vec2 uStageFront;
uniform vec4 uStageBoxA,uStageBoxB;
uniform vec3 uStageDepthA,uStageDepthB;
uniform vec4 uStageRoom;
uniform vec3 uStageEye;
varying vec3 vStageClip;
float stageBox(vec4 box,vec3 depth,vec2 ndc,float d){
 if(depth.z<=0.)return 0.;
 // An ellipse round the box, WINDOW_ROUND of it out to the box's own edge
 // midpoints and feathered past them: a window, not a slot cut in the wall.
 vec2 centre=(box.xy+box.zw)*.5,extent=max((box.zw-box.xy)*.5,vec2(.02));
 float r=length((ndc-centre)/extent);
 return depth.z*(1.-smoothstep(${WINDOW_ROUND.toFixed(2)},${(WINDOW_ROUND+WINDOW_FEATHER).toFixed(2)},r))*(1.-smoothstep(depth.x,depth.y,d));
}
float stageDrop(vec3 world){
 if(uStageOn<.5||world.y<=uStageFloor+.035||vStageClip.z<=.05)return 0.;
 float d=vStageClip.z;vec2 ndc=vStageClip.xy/d;
 float drop=1.-smoothstep(uStageFront.x,uStageFront.y,d);
 if(drop>0.&&uStageRoom.x<uStageRoom.z){
  const float W=${ROOM_WALL.toFixed(2)};
  if((world.x<uStageRoom.x+W&&uStageEye.x>uStageRoom.x)||(world.x>uStageRoom.z-W&&uStageEye.x<uStageRoom.z)
   ||(world.z<uStageRoom.y+W&&uStageEye.z>uStageRoom.y)||(world.z>uStageRoom.w-W&&uStageEye.z<uStageRoom.w))drop=0.;
 }
 drop=max(drop,stageBox(uStageBoxA,uStageDepthA,ndc,d));
 return max(drop,stageBox(uStageBoxB,uStageDepthB,ndc,d));
}
`;

/** A body the fade is about, as OcclusionFade measured it this frame: its box
 *  on screen, its nearest padded joint's depth and its middle's. */
export interface StageSubject{x0:number;y0:number;x1:number;y1:number;near:number;mid:number;seen:boolean}

/** Works out, every frame, what of the stage goes (see the notes above) and
 *  writes it to the shared uniforms. Allocation-free. */
export class StageFade{
  /** Read-only, for the evidence captures: the front plane, and the target
   *  window's amount. */
  readonly state={front:0,target:0};
  /** The room the stage's walls make, if they make one (FollowCamera's
   *  `roomOf`), written every frame. */
  room?:StageRoom;
  private front=NaN;private floor=NaN;private target=0;private targetOf:unknown=undefined;
  /** `self` the player (or who the camera follows), `target` the body framed
   *  against them (or an authored shot's victim), `nearest` the nearest depth
   *  of every body the shot is about; `grounded`/`y` the player's feet;
   *  `apart` the metres between the player and the target. */
  update(dt:number,eye:THREE.Vector3,self:StageSubject|undefined,target:StageSubject|undefined,targetKey:unknown,nearest:number,y:number,grounded:boolean,apart:number){
    const u=stageFadeUniforms;
    dt=Math.min(Math.max(Number.isFinite(dt)?dt:0,0),.1);
    if(!self||!self.seen){this.off();return;}
    u.uStageOn.value=1;u.uStageEye.value.copy(eye);
    const room=this.room;
    if(room)u.uStageRoom.value.set(room.x0,room.z0,room.x1,room.z1);else u.uStageRoom.value.set(1,1,-1,-1);
    this.floor=grounded||!Number.isFinite(this.floor)?y:Math.min(this.floor,y);
    u.uStageFloor.value=this.floor;
    const goal=Number.isFinite(nearest)?nearest-FRONT_GAP:0;
    this.front=Number.isFinite(this.front)?this.front+(goal-this.front)*(1-Math.exp(-FRONT_RATE*dt)):goal;
    u.uStageFront.value.set(this.front-FRONT_SOFT,this.front);
    u.uStageBoxA.value.set(self.x0,self.y0,self.x1,self.y1);
    u.uStageDepthA.value.set(self.mid-BOX_GAP-BOX_SOFT,self.mid-BOX_GAP,1);
    if(targetKey!==this.targetOf){this.targetOf=targetKey;this.target=0;}
    const want=target&&target.seen?1-THREE.MathUtils.smoothstep(apart,FIGHT_NEAR,FIGHT_FAR):0;
    this.target+=(want-this.target)*(1-Math.exp(-(want>this.target?TARGET_IN:TARGET_OUT)*dt));
    if(want===0&&this.target<1e-3)this.target=0;
    if(target&&target.seen&&this.target>1e-3){
      u.uStageBoxB.value.set(target.x0,target.y0,target.x1,target.y1);
      u.uStageDepthB.value.set(target.mid-BOX_GAP-BOX_SOFT,target.mid-BOX_GAP,this.target);
    }else u.uStageDepthB.value.set(0,0,0);
    this.state.front=this.front;this.state.target=this.target;
  }
  /** Nothing of the stage fades (no camera running, a reset). */
  off(){
    const u=stageFadeUniforms;
    u.uStageOn.value=0;u.uStageDepthA.value.set(0,0,0);u.uStageDepthB.value.set(0,0,0);
    this.front=NaN;this.floor=NaN;this.target=0;this.targetOf=undefined;this.state.front=0;this.state.target=0;
  }
}
