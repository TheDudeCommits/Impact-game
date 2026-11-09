import { FinisherCuts } from './FinisherCuts';
import {castThreat} from './ThreatOutline';
import {ENEMIES} from '../survival/enemies';
import * as THREE from 'three';
import {setCameraCutaway,resetCameraCutaway,coverStage} from './CameraCutaway';
import {dampedVector} from './dampedSpring';
import {CameraDirector,bodyBulk,drawnBulk} from './CameraDirector';
import type {StageRoom} from './StageFade';
import {OcclusionFader} from './OcclusionFade';
import {loomTop} from './loomRegistry';
import {BODY_SIZE,LAUNCH_GRAVITY,MOVES,RUSH_STAGES} from '../game/moves';
import {CameraBrain,ShotGate,across,brainInput,playShape,subject,GROUP_BOOM,GROUP_FOV,GROUP_LIFT,PLAY_LENGTH,SIDE_LIFT,type PlayKind,type Subject} from './CameraBrain';
import {CameraFocus} from './CameraFocus';
import {SmartRig,type SmartInput,type SmartThreat} from './SmartCamera';
import type {Fighter} from './Fighter';
import type {CameraMode,CameraStyle} from '../config';
import {closeStyleGoal,closeStyleRig,closeStyleFov,CLOSE_STYLE,CLOSE_RATE,GHOST_FADE} from './closeStyle';
import type {ActionKind,AttackSlot,FighterId} from '../game/types';

const UP=new THREE.Vector3(0,1,0),ZERO=new THREE.Vector3();
const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const blend=(rate:number,dt:number)=>1-Math.exp(-rate*dt);
const smooth=THREE.MathUtils.smoothstep;

type Rig={boom:number;lift:number;shoulder:number;focus:number};
const FOX:Readonly<Rig>={boom:8,lift:3.3,shoulder:2.2,focus:1.3},LARGE:Readonly<Rig>={boom:7.5,lift:3,shoulder:1.7,focus:1.7},NORMAL:Readonly<Rig>={boom:4.5,lift:1.65,shoulder:1.15,focus:1.05};
// Native petite body: focus below its ears while retaining the normal arena reach.
// (Round 4b: not Gummy any more - SUNRISE is his own size; Full Swell was a large form.)
const LARGE_FORMS:ReadonlySet<FighterId>=new Set<FighterId>(['shiden','shirokane','tobari','akagane','gaku']);
/** The lock-on rig. Round one stood the lens 4.5 m back and 2.5 m up, which
 *  drew the player at 37% of the frame's height and the opponent smaller
 *  still (measured on probe_shot; both blind critics called it too far), and
 *  the concept frames have the attacker at 55-75%. So locked on, the lens
 *  comes in over the shoulder at chest height: LOCK_BOOM nearer, the lens
 *  1.45 m up (LOCK_FOCUS + LOCK_LIFT on the free rig's 2.7), looking 6-7
 *  degrees down past LOCK_AHEAD - the player about 60% of the frame at
 *  fighting range, crown to feet, with the opponent's feet clear of the key
 *  cards. It still stands back and rises as the pair separate (FAR_*) and
 *  for a launched opponent (AIR_*), as round one's did. Everything scales
 *  with a form's size. */
const LOCK_BOOM=-1.4,LOCK_LIFT=-1.11,LOCK_FOCUS=-.14,LOCK_SHOULDER=-.1,LOCK_AHEAD=1.6;
const _comboDir=new THREE.Vector3(),_comboChest=new THREE.Vector3(),_comboHips=new THREE.Vector3(),_comboFrom=new THREE.Vector3(),_comboEyeA=new THREE.Vector3(),_comboEyeB=new THREE.Vector3();
/** The Chase style's combo shot (FollowCamera.comboFrame), in metres and per second. */
const COMBO_BACK=1.8,COMBO_SIDE=1.75,COMBO_HEIGHT=1.3,COMBO_CHEST=1,COMBO_LOOK=.85,COMBO_RATE=3.5,COMBO_FOLLOW=7,COMBO_PUNCH=.32,COMBO_PUNCH_SECONDS=.4,COMBO_PUNCH_HOLD=.24,COMBO_DRIFT=1.9,COMBO_SWAY=.3,COMBO_ANGLE=.9,COMBO_SETTLE=.3,COMBO_REACH=3,COMBO_RISE=.15,COMBO_AIR=.45,COMBO_SIGHT=.1,COMBO_NEAR=.35,COMBO_FLIP=.8,COMBO_HIPS=1.05,COMBO_DRAWN=.6,COMBO_CLUTTER=1.6;
const FAR_BOOM=1.6,FAR_LIFT=.8,AIR_BOOM=1.3,AIR_LIFT=.25,AIR_FOCUS=1.05,AIR_NEAR=3,AIR_FAR=7;
/** Round 3c: close in, the lens stands back. The second blind critic: "at
 *  about 1 m the camera is jammed against both fighters' backs" - the lens
 *  3.1 m behind the player at chest height put the two bodies at the pushbox
 *  distance crown to feet down the whole frame, the victim's hair at 0.67-0.74
 *  of the half-height (measured in training, close:ouga), under the health
 *  bars and with no room over the head for the reticle (see MARKER_LIFT). So
 *  as the pair close from CLOSE_FAR to CLOSE_NEAR metres the lens stands back
 *  CLOSE_BOOM more and rises CLOSE_LIFT (times the rig's scale): at arm's
 *  length the player 46% of the frame's height instead of 58%, the victim 39%
 *  instead of 46%, both crowns at 0.43-0.46 of the half-height instead of
 *  0.53-0.60, whole and apart, with the room over the victim's head the
 *  reticle needs. From 2.5 m out the shot is the one it was. Taken up at
 *  CLOSE_IN and given back at CLOSE_OUT, so a dash in is a move of the lens,
 *  not a jolt, and a string's step back and forth does not breathe the shot.
 *  Only for the opponent the shot is framing. */
const CLOSE_NEAR=1.25,CLOSE_FAR=2.6,CLOSE_BOOM=.7,CLOSE_LIFT=.25,CLOSE_IN=4,CLOSE_OUT=1.5;

const DRAWN_TOP=1.9,DRAWN_BACK=.6,DRAWN_EVERY=.25,BACK_MOST=3.5,DRAWN_RISE=.4,DRAWN_RATE=3,DRAWN_SAMPLES=160,SCALE_MOST=2.4;
/** Round 3c: the second blind critic, awakened Konta locked on: "The Kurobi
 *  form fills about half the frame" - and the target, eight metres on past
 *  the fox, was a figure at the far wall. Round 3b grew the whole rig with the
 *  body (and stood it back past the tails), which puts the lens behind all of
 *  a 1.8x fox and everything in front of it far away: measured in training, a
 *  target 1.5-6 m from Kurobi was 14-16% of the frame's height, from Full
 *  Swell 20-29%, against 21-37% for a normal body. Now each part of the rig
 *  grows by its own share of the body's growth (g, the rig's scale less one):
 *  the stand-back FORM_BOOM of it and FORM_BACK of the length behind the
 *  root, the lens FORM_LIFT of it higher and FORM_RISE metres per unit more -
 *  over the form's shoulder, looking down past its head - the shoulder
 *  FORM_SIDE and the look FORM_FOCUS of it, the look's reach FORM_AHEAD. The
 *  target 17-22% of the frame from Kurobi, 25-34% from Full Swell. A normal
 *  body (g = 0) is the rig it always was. */
const FORM_BOOM=.45,FORM_BACK=.3,FORM_LIFT=1.2,FORM_RISE=1.5,FORM_SIDE=.85,FORM_FOCUS=1,FORM_AHEAD=1.3;
/** Round 3e (CAM4): Kurobi, the third time a blind critic flagged it - "in
 *  full-Kurobi form the player sees a paw in the corner". The fox is not a
 *  tall body: it prowls, its head 0.55 m off the floor and 1.5 m in front of
 *  Konta's root, its back rising to 2 m at the shoulders and 2.2 at the
 *  haunches, its tails to 2.9 m and 8.2 m behind the root (measured in the
 *  client). The form terms above stood the lens 4.3 m up and 5.4 m back -
 *  over the haunches, looking down past the back of the fox's head: the body
 *  under the frame, and of the fox only the ears, a foreleg and a sweep of
 *  tail at the frame's foot (the fox 20% inside the frame; tried in
 *  training, scripts/capture_camera_r3e.mjs kurobi). So while the fox shows,
 *  the lock-on rig eases (at FOX_RATE) to its own: FOX_LOCK - down at the
 *  height of its back and out past its right flank, a three-quarter view
 *  from behind the haunches - with the opponent held FOX_FOE right of
 *  centre instead of FOE_ANGLE, so the fox has the left of the frame: its
 *  head, shoulders and forelegs at eye level, the tails fanned behind (the
 *  near ones clear themselves, see Fighter's FOX_CLEAR) and the opponent
 *  whole in front of its snout. The stand-backs for distance, a juggle, a
 *  strain and close quarters ride on it as on any rig. */
const FOX_LOCK:Readonly<Rig>&{ahead:number}={boom:5.6,lift:.5,shoulder:2.5,focus:1.45,ahead:1.9},FOX_FOE=.3,FOX_RATE=2;
/** Lock-on framing. The opponent is held FOE_ANGLE right of the centre line
 *  (about +0.12 of the half-width at 16:9) while the shoulder offset keeps
 *  the player on the left third: the arena-fighter composition, with both
 *  bodies in the frame and apart. The heading that achieves it is solved from
 *  the rig's own geometry every frame (see `framingHeading`). With the lens
 *  this close the line between the fighters then runs 20-35 degrees off the
 *  view at fighting range (3-5 m) and opens as they close, capped at
 *  MAX_OFFSET - and, while the player is swinging at an opponent within
 *  ENGAGE_RANGE, ENGAGE_OFFSET further: round one's cap was 43 degrees and
 *  its assist let go inside 1.2 m, so at the 1.1 m the pushboxes hold two
 *  fighters apart the lens sat straight behind the attacker and their back
 *  hid the victim (taisei, konta, shirokane and gummy's engaged frames; the
 *  heavy and rush sheets). The swing eases in at ENGAGE_IN and out at
 *  ENGAGE_OUT, and the assist turns the heading after it within its limits. */
const FOE_ANGLE=.1,MAX_OFFSET=.8,ENGAGE_OFFSET=.2,ENGAGE_RANGE=3,ENGAGE_IN=6,ENGAGE_OUT=1.5;
const SWINGS:ReadonlySet<ActionKind>=new Set<ActionKind>(['light','heavy','special']);
/** How the assist turns the heading: never faster than ASSIST_SPEED (rad/s,
 *  about 150 deg/s), never changing that speed faster than ASSIST_ACCEL
 *  (rad/s^2), braking so it arrives without overshoot, and settling the last
 *  few degrees exponentially at ASSIST_GAIN so a held framing never buzzes.
 *  Integrated in 120 Hz substeps so a slow frame is the same motion sampled
 *  coarsely, not a different one. */
const ASSIST_SPEED=2.6,ASSIST_ACCEL=9,ASSIST_GAIN=3.2,ASSIST_STEP=1/120;
/** A dash round the opponent turns the bearing at 300-1000 deg/s, which no
 *  heading limited to 150 can follow: the opponent crosses the frame and
 *  can end up beside or behind the player for a second while the heading
 *  comes round (measured on probe_shot_live's in-and-out fight). While the
 *  heading is further than STRAIN_FROM off the framing - all of it by
 *  STRAIN_TO - the lens stands back STRAIN_BOOM and rises STRAIN_LIFT, the
 *  wider shot that keeps both bodies in view while it swings; it takes that
 *  up at STRAIN_IN and gives it back at STRAIN_OUT. */
const STRAIN_FROM=.45,STRAIN_TO=1.1,STRAIN_BOOM=1.4,STRAIN_LIFT=.7,STRAIN_IN=4,STRAIN_OUT=1.2;
/** The player's own mouse or stick always wins: the assist lets go on the
 *  frame they turn, and eases back in between YIELD_AFTER and
 *  YIELD_AFTER+YIELD_OVER seconds after the last turn. */
const YIELD_AFTER=1,YIELD_OVER=.5;
/** Inside DEAD_ZONE metres (horizontally) the bearing to the opponent swings
 *  faster than anybody moves - and directly above or below it has no meaning
 *  at all - so the assist holds still, and it ramps back to full by
 *  FULL_ASSIST. Round one held still inside 1.2 m, which is further than two
 *  grounded fighters ever get from each other (the pushboxes are 0.55 m
 *  each), so it never steered in a close exchange at all; now only a body
 *  over or under the player's own is inside it. */
const DEAD_ZONE=.45,FULL_ASSIST=.9;
/** The auto-selected opponent is framed only while they are near enough to be
 *  the fight; a Tab lock holds to the edge of the lock's own range. */
const SOFT_NEAR=14,SOFT_FAR=22,HARD_NEAR=34,HARD_FAR=44;
/** The opponent must be seen, not merely framed. Each body's drawn bounds are
 *  a capsule: its torso (the hips-to-head midpoint, which a lunge carries
 *  well clear of the root) TORSO metres round times its bulk, crown to feet
 *  off its joints (see HEAD_PAD); a spirit in the fight is one more. When
 *  more than COVER_ENTER of the opponent's box on screen is behind the boxes
 *  of bodies nearer the lens - the player's back, their spirit, a third
 *  fighter - the heading turns away: the least turn, searched DODGE_STEP at a
 *  time out to DODGE_MOST either way (the side the victim already stands
 *  toward first), that brings it under COVER_EXIT - or, with none that
 *  clear, the one that hides least if that is under DODGE_SETTLE of
 *  COVER_ENTER. It is let go the same way,
 *  a step at a time and no sooner than DODGE_WAIT apart, only while the step
 *  back is clear too - the gap between the two thresholds is what stops it
 *  hunting - and the turn itself follows at DODGE_SPEED, braking at
 *  DODGE_ACCEL, before the assist turns the heading after it at its own
 *  limits. */
const MELEE_COVER_ENTER=.2,MELEE_COVER_EXIT=.1;
const TORSO=.3,COVER_ENTER=.4,COVER_EXIT=.15,DODGE_SETTLE=.75,DODGE_STEP=.06,DODGE_MOST=.72,DODGE_WAIT=.12,DODGE_SPEED=1.6,DODGE_ACCEL=8,DODGE_GAIN=5,NEAR_DEPTH=.4;
/** Melee homes on the chosen target inside an 80-degree cone off the view
 *  heading. The framing stays within 57 degrees, lock-on's and the dynamic
 *  camera's alike (launch night: a close dynamic duel prepared 72 on approach
 *  and 79 through a windup - see MELEE_COVER_ENTER). A measured turn away from a
 *  blocker may open further, but never past ALPHA_MOST, the cone's edge.
 *  A spirit at its user's right shoulder needs about75 degrees to clear. */
const ALPHA_MOST=1.4;
/** Where a spirit's user's spirit is drawn while it fights, as SwordSpiritEffects
 *  places it: in front of the user by the separation less 1.35 m, between
 *  SPIRIT_NEAR and SPIRIT_FAR, and SPIRIT_SIDE to their right; KoKo's heavy
 *  (Needle Finger) summons it, LORD ORO's (the knives) does not. Those constants are
 *  private to SwordSpiritEffects, so they are repeated here; keep the two in
 *  step. The spirit is broader and taller than its user - SPIRIT_RADIUS round,
 *  SPIRIT_HEIGHT tall: taken at a body's size, Iron Spirit's barrage hid
 *  most of Ward in the real client while the camera measured 0.27-0.37 of
 *  him covered, under COVER_ENTER. Awakened (round 3d, SPIRITS), the spirit
 *  looms 1.5x over its user - 0.55 m behind and 0.6 m to their left, its head
 *  bent over their shoulder - so it is never between the over-the-shoulder
 *  lens and the victim; it sizes the rig (loomRegistry, see measureDrawn) and
 *  its crown is held in the frame with the user's (round 3c, see
 *  measure). */
const SPIRIT_NEAR=.25,SPIRIT_FAR=.7,SPIRIT_SIDE=.75,SPIRIT_RADIUS=.36,SPIRIT_HEIGHT=2.15,SPIRIT_HEAVY:Partial<Record<FighterId,boolean>>={koko:true,oro:false};
/** Locked on, both bodies stay inside the frame, crown to feet, clear of the
 *  HUD. The composition above tilts by a fixed amount for a launched
 *  opponent, which a juggle outgrows: a chase and an air light re-launch the
 *  target 2.9 m up at 1.4 m while the player lands. So the vertical framing
 *  is also solved: every crown (CROWN metres over the feet, scaled by the
 *  body) must sit under FRAME_TOP of the half-height - the bottom of the
 *  health bars - and the player's feet over -MY_BOTTOM (the key strip along
 *  the bottom left), the opponent's over -FOE_BOTTOM, or over -CARD_TOP
 *  where the opponent stands over the skill cards (centred right of
 *  CARD_LEFT, eased over CARD_EASE either side). When
 *  the shot as composed does not manage it, the look tilts by the least that
 *  does (never more than TILT_UP or TILT_DOWN) and, if tilting cannot fit
 *  both bodies, the lens first stands back by the least that lets it (up to
 *  PULL_MAX). The two follow those goals the way the heading assist follows
 *  its own: speed and acceleration limited, braking to arrive, settling
 *  exponentially - and letting go LET_GO times as fast as they take up, so a
 *  juggle does not bob the shot on every bounce, and not at all for
 *  LAND_HOLD after the body lands: the landing is held a beat. On the ground,
 *  and whenever the shot already holds the pair, both goals are zero and the
 *  shot is exactly the one above. */
const FRAME_TOP=.62,MY_BOTTOM=.8,FOE_BOTTOM=.88,CARD_TOP=.43,CARD_LEFT=.06,CARD_EASE=.04,CROWN=1.95,TILT_UP=.45,TILT_DOWN=.3,PULL_MAX=4,LAND_HOLD=.35;
/** A launch is quicker than the tilt and the stand-back can be: the lens
 *  sits close, and a launch clip carries the victim's head a metre up in a
 *  tenth of a second. So what they have not caught up with yet is widened
 *  for, up to WIDEN_MOST degrees, taken up at WIDEN_SPEED (braking at
 *  WIDEN_ACCEL) and let go at LET_GO of that as the tilt and the pull
 *  arrive. They are solved as though it were not there, so there is no loop
 *  between them. */
const WIDEN_MOST=12,WIDEN_SPEED=90,WIDEN_ACCEL=1500,WIDEN_GAIN=12;
/** The field of view, in degrees, that puts a point `height` over the lens
 *  and `reach` in front of it inside `share` of the half-height, for a look
 *  pitched `look` up; zero when it is already under the centre line. */
function widenFor(height:number,reach:number,look:number,share:number){
  const above=Math.atan2(height,Math.max(reach,.3))-look;
  return above>0?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(above,1.4))/share)):0;
}
/** What a body spans is read off its pose where the rig has one - its head
 *  and its feet, whichever way up it is, HEAD_PAD over the head joint and
 *  SOLE_PAD under the feet - because a launch clip throws the body clear of
 *  its root: measured in training, a juggled Kosho's feet were 0.96 m over his
 *  root at the top of the arc, and a crown taken from the root put his head
 *  behind the HUD. A body without the joints, or showing a form's model
 *  instead of its own, spans its root to CROWN over it. */
const HEAD_PAD=.24,SOLE_PAD=.06,SPAN_JOINTS=['Head','LeftFoot','RightFoot','LeftToeBase','RightToeBase'] as const;
/** Round 3c: the lock-on reticle over the target's head (see aboveHead). The
 *  HUD draws it 78 px tall, centred on the point it is given, with the
 *  nameplate hung 6 px under it (about 20 px tall): MARKER_LIFT pixels over
 *  the crown puts the plate's lower edge a few pixels clear of the hair. The
 *  second blind critic found both on the target's face at close range. Never
 *  above MARKER_TOP pixels from the top of the frame, where the HUD would take
 *  it for a target outside the frame and draw an arrow instead. */
const MARKER_LIFT=74,MARKER_TOP=62;
/** Round 3c: a spirit looming over its awakened user (round 3d, SPIRITS) is
 *  framed with them. loomRegistry gives the height of its neck over the
 *  user's root; its bowed head and hair reach LOOM_CROWN over that (a 1.5x
 *  head), and it hovers LOOM_BACK behind its user and LOOM_LEFT to their left
 *  - nearer the over-the-shoulder lens than they are. SwordSpiritEffects'
 *  LOOM.back and LOOM.side, repeated so the camera does not import the
 *  effects: keep them in step. Measured in training before this: at 4.2 m
 *  Iron Spirit's head at 0.56 of the half-height and its hair at 0.87, Dead
 *  Stop's at 0.69 and 0.89 - under the health bars. */
const LOOM_CROWN=.45,LOOM_BACK=.55,LOOM_LEFT=.6;
/** A body the joints show lying down - knocked down, splatted to the floor,
 *  tumbling flat through a launch - spans what it spans, never less than
 *  LIE_SPAN metres (times its bulk). It used to be taken for a body standing
 *  on its root whenever the joints spanned less than half a metre, so a
 *  victim on the floor was framed as though their crown were 1.95 m up and
 *  their feet on the root: the shot held a head that was not there under the
 *  health bars and let the body that was there sink behind the skill cards
 *  (measured in training: a knocked-down Gaunt at 0.44 of the half-height
 *  under the centre, right of the cards' edge, for a third of a second). */
const LIE_SPAN=.45;
/** A victim going down - on the floor from a knockdown, a splat or a get-up,
 *  or falling the last LIE_AHEAD metres of a launch - lies at floor level,
 *  chest and all, where a standing body only has its feet: the floor under
 *  them is held LIE_MARGIN of the half-height clear of the skill cards and
 *  the frame's foot, and the framing starts on it while they are still
 *  falling (eased in at LIE_RATE), because the tilt cannot arrive in the
 *  three frames a launched body takes to drop flat. */
const LIE_AHEAD=1.3,LIE_MARGIN=.14,LIE_RATE=10;
/** Round 3e (CAM4): the player's own body on the floor. The third blind
 *  critic: "low-angle reaction shots leave the player half off-screen" -
 *  measured in training, Gaunt knocked down by Kosho's air string: the look
 *  tilted 8 degrees up for the kicker in the air, and the player lying on the
 *  floor at the frame's foot, 40% of them in the frame and most of that under
 *  the key strip. The player's feet were held over the key strip at their
 *  root's depth; a body lying toward the lens reaches a metre and more nearer
 *  and so lower on screen. So as the joints spread along the floor (from
 *  SPREAD_FROM, all of it by SPREAD_FULL metres from the body's middle) the
 *  player's lowest point is taken at the near end of them, and their breadth
 *  across the frame is widened for as the victim's is. And a tilt the
 *  player's own body needs undone - their feet under the key strip or their
 *  crown over the bars - goes at the full rate, not the slow let-go a juggle's
 *  settling takes. */
const SPREAD_FROM=.45,SPREAD_FULL=.8;
const SIDE_SHARE=.9;
/** The framing looks LEAD seconds ahead, so the tilt has begun before a body
 *  reaches the top line instead of after it: a rising opponent is framed at
 *  the top of its arc if that comes within the lead (an airborne body falls
 *  at the simulation's 23 m/s^2 times LAUNCH_GRAVITY), and a player coming
 *  down - whom the lens follows, so their fall is the whole frame dropping -
 *  is taken to have fallen as far as the lead carries them, never below the
 *  floor they last stood on. Rises are read off the positions, eased at
 *  RISE_RATE. */
const LEAD=.3,RISE_RATE=20,LAUNCH_FALL=23*LAUNCH_GRAVITY;
/** The tilt's own limits, and the pull's. The tilt shares the aim's
 *  acceleration with the heading assist, out of SHARED of ASSIST_ACCEL, so a
 *  combined turn is never harder than the heading alone may turn. */
const TILT_SPEED=1.2,TILT_ACCEL=7.5,TILT_GAIN=6,PULL_SPEED=12,PULL_ACCEL=90,PULL_GAIN=10,LET_GO=.4,SHARED=.95;
type Room=StageRoom;
const roomBox=new THREE.Box3();
/** The room an enclosed stage's camera walls make: the slabs StageEnvironment
 *  stands on the play bound, thin one way and long the other, one on each
 *  side; their inner faces. Undefined for a stage without them (the town's
 *  occluders are its instanced buildings). */
export function roomOf(occluders:readonly THREE.Object3D[]):Room|undefined{
  let xLow:THREE.Box3|undefined,xHigh:THREE.Box3|undefined,zLow:THREE.Box3|undefined,zHigh:THREE.Box3|undefined;
  const lx=new THREE.Box3(),hx=new THREE.Box3(),lz=new THREE.Box3(),hz=new THREE.Box3();
  for(const object of occluders){
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||(mesh as THREE.InstancedMesh).isInstancedMesh||!(mesh.geometry instanceof THREE.BoxGeometry)||mesh.name==='stage-landmark-occluder')continue;
    mesh.updateWorldMatrix(true,false);roomBox.setFromObject(mesh);
    const sx=roomBox.max.x-roomBox.min.x,sz=roomBox.max.z-roomBox.min.z,cx=(roomBox.max.x+roomBox.min.x)/2,cz=(roomBox.max.z+roomBox.min.z)/2;
    if(sx<=2.5&&sz>=6){
      if(!xLow||cx<(xLow.max.x+xLow.min.x)/2)xLow=lx.copy(roomBox);
      if(!xHigh||cx>(xHigh.max.x+xHigh.min.x)/2)xHigh=hx.copy(roomBox);
    }else if(sz<=2.5&&sx>=6){
      if(!zLow||cz<(zLow.max.z+zLow.min.z)/2)zLow=lz.copy(roomBox);
      if(!zHigh||cz>(zHigh.max.z+zHigh.min.z)/2)zHigh=hz.copy(roomBox);
    }
  }
  if(!xLow||!xHigh||!zLow||!zHigh||xLow===xHigh||zLow===zHigh)return undefined;
  const room={x0:xLow.max.x,x1:xHigh.min.x,z0:zLow.max.z,z1:zHigh.min.z};
  return room.x1-room.x0>2&&room.z1-room.z0>2?room:undefined;
}
/** A scalar the vertical framing moves: where it is and how fast. */
type Follower={value:number;velocity:number};
/** A body's drawn bounds (see TORSO): a vertical capsule's axis at (x, z)
 *  from `low` to `high`, `radius` round. */
type Capsule={x:number;z:number;low:number;high:number;radius:number;spread:number};
const capsule=():Capsule=>({x:0,z:0,low:0,high:0,radius:0,spread:0});
/** The heading assist's integrator for a scalar: toward `goal` never faster
 *  than `speed`, never changing speed faster than `accel`, braking so it
 *  arrives without overshoot and settling the last of it at `gain`. With
 *  `shared`, the heading's own acceleration in each substep, it spends only
 *  what the heading has left of ASSIST_ACCEL: the aim is one direction, and
 *  a tilt that starts while the heading is already swinging at its limit is
 *  an acceleration the assist itself was never allowed. */
function approach(state:Follower,goal:number,dt:number,speed:number,accel:number,gain:number,shared?:Float64Array,count=0){
  let k=0;
  for(let left=dt;left>1e-9;left-=ASSIST_STEP,k++){
    const h=Math.min(ASSIST_STEP,left),error=goal-state.value,size=Math.abs(error);
    const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*accel*size),gain*size);
    const limit=shared&&k<count?Math.min(accel,Math.sqrt(Math.max(0,(SHARED*ASSIST_ACCEL)**2-shared[k]*shared[k]))):accel;
    state.velocity+=THREE.MathUtils.clamp(wanted-state.velocity,-limit*h,limit*h);
    state.value+=state.velocity*h;
  }
  if(Math.abs(goal)<1e-7&&Math.abs(state.value)<1e-5&&Math.abs(state.velocity)<1e-4)state.value=state.velocity=0;
}

/** The impact camera, at the default shake setting (0.5; the setting scales
 *  all of it, and 0 turns it off).
 *
 *  The kick: the lens is struck along the blow's heading, reaching
 *  KICK_PEAK * weight^1.5 metres within a couple of frames (a critically
 *  damped move at KICK_OUT rad/s), held there for the hit freeze, and let go
 *  on a softer spring (KICK_BACK, about a fifth of a second). Travel across
 *  and up the frame also turns the lens after the blow, KICK_TURN radians per
 *  metre (plus KICK_ROLL of roll); travel along the view dips it. A heavy
 *  lands at about 5 cm and 0.8 degrees, an ultimate at 15 cm and 2.4 - the
 *  old rotation-only shake peaked at 0.11 degrees, which nobody could see.
 *
 *  The punch-in: heavy, special and a rush finisher/ultimate involving the
 *  local player narrow the lens by PUNCH[tier] degrees in about 30 ms, hold it
 *  through the freeze and release it over about 0.4 s. Repeated hits hold
 *  it rather than pumping it. NOISE is the trauma shake riding on top. */
const KICK_PEAK=.2,KICK_OUT=55,KICK_BACK=16,KICK_TURN=.28,KICK_ROLL=.14,KICK_MIN_HOLD=.05;
const PUNCH=[0,2.2,3.4] as const,NOISE=.045;
const CALM_FROM=.3,CALM_FULL=.55,CALM_SHARE=.7,CALM_PUNCH=2;
/** Which impact camera a connected hit earns: 0 a light (kick only), 1 a
 *  heavy or special, 2 a rush finisher or an ultimate. */
export function hitTier(slot?:AttackSlot,chain?:number):0|1|2{
  if(slot==='ultimate'||(slot==='light'&&(chain??0)>=RUSH_STAGES-1))return 2;
  return slot==='heavy'||slot==='special'?1:0;
}

/** Round 4 (CAMERA): the dynamic camera (Settings.cameraMode 'dynamic'),
 *  whose decisions are CameraBrain's. A turn of the player's own forgives an
 *  authored shot up to DIRECTOR_TURN radians within about TURN_MEMORY seconds
 *  before the shot hands back: a nudge to look round is not a request to leave
 *  it (any turn at all ends one in the other modes). The player's travel is
 *  read off the presented root, eased at VELOCITY_RATE; a jump of more than
 *  TELEPORT metres in a frame is a reset, not travel. Bodies further than
 *  SUBJECT_RANGE are nobody the shot is about. */
const DIRECTOR_TURN=.35,TURN_MEMORY=.5,VELOCITY_RATE=10,TELEPORT=2,SUBJECT_RANGE=14;
/** Round 4b (TARGETING), the blind critic: "the held W never re-steers after
 *  the camera turns itself, so the player runs in place for 12 s". In dynamic
 *  mode a run is still read against the view as it was when the keys went
 *  down while the camera turns by itself (round 4's basis), but once that
 *  turning has settled - under SETTLED_SPEED rad/s for SETTLED_AFTER seconds,
 *  no switch under way - the basis comes round to the view at BASIS_CATCH/s,
 *  and a player held up (the movement keys down, travelling under
 *  BLOCKED_SPEED m/s in a run for BLOCKED_AFTER seconds) gets the view at once.
 *  Only the turning that frames an opponent settles into the basis: with
 *  nobody about, the lens comes round behind a held run by itself, and a held
 *  strafe read against the view that recentre made would turn the run after
 *  it, round and round (round 4's reason for the basis). */
const SETTLED_SPEED=.12,SETTLED_AFTER=.3,BASIS_CATCH=3,BLOCKED_SPEED=.6,BLOCKED_AFTER=.3;
const RUNNING:ReadonlySet<ActionKind>=new Set<ActionKind>(['run','idle','dash']);
/** Round 4b, the critic: on Wreckers' Causeway's bridge "the boom sits OUTSIDE the
 *  stage bounds". On an open stage - not one that encloses the fight, whose
 *  walls fade instead (StageFade; a stage carrying its own `background` or
 *  modelled `doubleSided` as an interior) - the dynamic lens is kept
 *  BOUND_MARGIN inside the play bounds by moving it along its own line of
 *  sight: nearer the player, the view's direction and so the movement basis
 *  exactly as they were; never nearer the look point than BOUND_NEAREST, and
 *  again after the cosmetic layers (a shot's pull-back, a blow's kick), at
 *  most BOUND_AFTER more. */
const BOUND_MARGIN=.25,BOUND_NEAREST=1.6,BOUND_AFTER=1.5;
const ENCLOSED_OUT=1.4;
export const SMALL_FLOOR=15;
/** Whether a stage's floor is small (see SMALL_FLOOR). */
export function smallFloor(bounds?:{halfX:number;halfZ:number}){return !!bounds&&Math.min(bounds.halfX,bounds.halfZ)<SMALL_FLOOR;}
const OPEN_EDGE:Readonly<Record<string,number>>={
  'ashfall-weir':1.4,'drifting-isle':1.4,'cinder-flats':1.4,'warlords-roof':1.4,'hollowmere-quarry':1.4,'mirror-mere':1.4,'sunward-summit':1.4,
};
/** How far past the stage's bounds the dynamic lens may stand (negative: inside them): an enclosed hall's
 *  ENCLOSED_OUT, and a small floor's (SMALL_FLOOR) the same; a floor with room whose edge is open, what OPEN_EDGE
 *  says - not in a mode whose view is the squad's (`squad`: Arcade Survival, the objectives, the rift), whose camera
 *  stays as it is; any other BOUND_MARGIN inside. */
/** The ball modes' places (render/ball/BallArena.ts): their walls are glass and their stands start six to seven metres
 *  past them, so the lens may stand out there - a view held inside the glass squeezed down onto the player's head at
 *  every wall. */
const BALL_OUT=5;
/** How far past the end walls the ball cam may stand (FollowCamera.keepInView): not at all, the goal's netting is there. */
const BALL_CAM_ENDS=-.4;
const boundOut=(b:{halfX:number;halfZ:number;doubleSided?:boolean;background?:number;id?:string},squad=false)=>b.id==='ball-pitch'||b.id==='ball-court'?BALL_OUT:b.doubleSided||b.background!==undefined||smallFloor(b)?ENCLOSED_OUT:(b.id!==undefined&&!squad?OPEN_EDGE[b.id]:undefined)??-BOUND_MARGIN;
/** When a stage boundary prevents the boom moving back, a local jump needs
 * vertical room instead. Ease this in over the last metre before the lens
 * reaches the boundary, not after the wall has already shortened the shot.
 * The lift follows the jump itself and remains inside the horizontal bounds. */
const EDGE_NEAR=.1,EDGE_CLEAR=1,EDGE_AIR_SHARE=1.2,EDGE_AIR_MAX=6,EDGE_RATE=16;
const SQUEEZE_MOST=.85,SQUEEZE_SIDE=1.3,SQUEEZE_AHEAD=.7,SQUEEZE_SOFT=.8,SQUEEZE_EARLY=.5,SQUEEZE_IN=14,SQUEEZE_OUT=1.2,SQUEEZE_RISE=8;
/** Launch night, second pass: the Close style is all there under the first of these squeezes and all Classic from the
 *  second (see `update`: styleGoal). */
const SQUEEZE_CLASSIC=[.06,.3] as const;
/** Launch night, second pass: how much wider than WIDEN_MOST the vertical framing may open the lens at a full squeeze,
 *  degrees (see `frame`: widenGoal). At the half squeeze of a fighter with their back to a room's wall, five more. */
const SQUEEZE_WIDEN=10;
/** Launch night: the most a run's look-ahead may carry the rig toward its shoulder's side, as where it leaves the
 *  player's own fighter across the frame (a share of its half-width; see `update`). */
const LEAD_SIDE=.8;
const ARENA={boom:.15,back:.5,lift:.25,side:.26,foe:.2,meleeLift:.45,meleeSide:1,apart:.15,
  near:1.8,far:4.2,inner:.3,behind:.2,show:.6,outer:1.15,flip:.2,hand:.5,sideTime:.6,sideRest:1.2,idle:.05,
  speed:3.6,fast:5.2,accel:11,fastAccel:24,gain:5,lead:.85,away:3,pan:2.4,panAccel:9,panFor:1.2,
  slideStep:.07,slideMost:1.85,slideEdge:.7,slideTight:.4,slideSoft:.8,slideSide:2.3,slideOver:.25,slideBack:.4,slideNear:.5,rise:.3,crop:.55,group:.25,pull:.3,sink:.45,strain:.25,tilt:.8} as const;
/** Round 4b: the stage's props are checked for the cutaway again this long after the stage arrives (CameraCutaway coverStage). */
const COVER_AGAIN=2;
/** 24 October 2026, the Smart camera (see `weighThreat` and SmartCamera.ts): how much each other body matters - attacking
 *  the player, having hit them within SMART_HIT_FOR seconds, near - fading out from SMART_FROM to SMART_RANGE metres; a
 *  body lying down counts SMART_DOWN of itself. The look point's height over the root for the cutaway (CHEST_SMART), and
 *  the level pitch the input is handed back (SMART_PITCH): the rig keeps the player's tilt itself. */
const SMART_ATTACK=.8,SMART_PRESS=.9,SMART_HIT=.6,SMART_HIT_FOR=2.5,SMART_NEAR=.22,SMART_FROM=7,SMART_RANGE=14,SMART_DOWN=.35,CHEST_SMART=1.05,SMART_PITCH=.2,HEIGHT_MOST=14,HEIGHT_DECAY=.25;
/** Round 4b: tall jumps. The dynamic lens climbs with the player's first
 *  AIR_FREE metres off the floor they last stood on and AIR_SHARE of the rest,
 *  so a 5 m jump reads as one - the body rises up the frame - and the lens
 *  does not ride the whole lift (scripts/probe_air_r4b.mts). (Followed more
 *  slowly in the air, it lagged and then caught up fast on landing.) */
const AIR_FREE=.6,AIR_SHARE=.5;
/** And a big body in the air - Gorai, a form (the JUMP stream: "Gorai and
 *  Kurobi fill the lens at the top of a jump") - takes the lens up with it all
 *  the way, and stands it BIG_AIR_BOOM metres further back and BIG_AIR_LIFT
 *  higher, looking down past it, at full height (BIG_AIR_HIGH metres off the
 *  floor); a big body is one drawn BIG_FROM..BIG_FULL times a normal one (or
 *  Kurobi). */
const BIG_FROM=1.15,BIG_FULL=1.6,BIG_AIR_BOOM=3.4,BIG_AIR_LIFT=1.6,BIG_AIR_HIGH=3;
/** Round 4b, the blind critic: "Big forms aren't reframed: Kurobi fills ~40%
 *  of the frame and its head leaves the shot ... Scale distance and field of
 *  view by the form's size." The dynamic shot stands FORM_DYN_BOOM metres
 *  further back and FORM_DYN_FOV degrees wider per unit the drawn body is
 *  bigger than a normal one (DRAWN_TOP), the field at most FORM_DYN_FOV_MOST
 *  wider - on top of the lock-on rig's own sizing for it. */
const FORM_DYN_BOOM=.6,FORM_DYN_FOV=4.5,FORM_DYN_FOV_MOST=6;
const ATTACKS:ReadonlySet<ActionKind>=new Set<ActionKind>(['light','heavy','special','ultimate']);
const REACTIONS:ReadonlySet<ActionKind>=new Set<ActionKind>(['flinch','hurt','launched','knockdown','getup','stun','splat']);
/** The player's own ground smash (combos.ts `airSpecial`) still falling. */
const plunging=(s:{action:ActionKind;branch?:string;grounded:boolean})=>s.action==='special'&&s.branch==='airSpecial'&&!s.grounded;

/** The heading that puts an opponent `distance` metres off at `bearing` on
 *  FOE_ANGLE, for a lens `shoulder` right of the heading line and `back`
 *  behind the anchor, looking along the heading. From the lens the opponent
 *  sits at atan2(d sin(off) - s, d cos(off) + b); setting that to FOE_ANGLE
 *  gives d sin(off - FOE_ANGLE) = s cos(FOE_ANGLE) + b sin(FOE_ANGLE). The
 *  offset - the angle between the view and the line from the player to the
 *  opponent - is capped at `most`. */
export function framingHeading(bearing:number,distance:number,shoulder:number,back:number,most=MAX_OFFSET,foe=FOE_ANGLE){
  const reach=shoulder*Math.cos(foe)+back*Math.sin(foe);
  const offset=foe+Math.asin(Math.min(reach/Math.max(distance,1e-3),Math.sin(most-foe)));
  return bearing+offset;
}

/** Player-anchored orbit. Translation follows the same presented root as the
 * player, so acceleration cannot leave the camera chasing the fighter or
 * rotate the input basis.
 *
 * Four modes (`Settings.cameraMode`). **arena** (launch day, the default): the dynamic camera's rig with the
 * opponent held in frame, and the keys read against the line to them; see
 * ARENA and `steerArena`. **dynamic** (round 4, the default until launch day): the
 * lock-on composition with CameraBrain deciding what the shot is about - the
 * opponent, a group closing in, the run ahead - and turning, standing back and
 * widening for it; see `steerDynamic`. **free**: input owns azimuth; targets and
 * attack clips never do. **lockon**: the same anchored orbit, closer and at
 * chest height, but its heading is steered - rate limited, and never while
 * the player is turning it - so the current opponent stays framed right of
 * centre and in sight with the player in the left foreground. The camera
 * never lags the player's travel in either mode; only the heading is
 * assisted, and `inputYaw` hands the assisted heading back to the input
 * accumulator so the next mouse delta is relative to what is on screen. */
export class FollowCamera {
  /** Extra breathing room for squad modes. Zero preserves the established duel/Survival rig. */
  battlefield = false;
  /** Metres of extra boom (and a share of it in lift) for a mode that wants the field seen from further back and above:
   *  Goal Rush and Sky Spike (main.ts), so the ball and the far side are in view rather than the player's back. */
  wide = 0;
  /** A point the lens tilts up to keep in the frame (the ball modes' ball camera sets it to the ball, render/ball/
   *  BallCam.ts): the look rises after it - never so far that the player's own feet leave the bottom of the frame - and
   *  only up and down, so the heading and every direction the keys point stay exactly what they were. Null: no tilt. */
  keepInView:THREE.Vector3|null=null;
  /** Degrees the lens opens past its own for a sport (the ball modes' ball cam, render/ball/BallCam.ts): more of the
   *  pitch round the player and the ball, and speed read off the floor. 0 everywhere else. */
  sportFov=0;
  private keepTilt=0;
  yaw=Math.PI;
  /** Horizontal view direction before cosmetic shake, used only to map input. */
  movementYaw=Math.PI;
  /** Written by main.ts from the live settings object every frame. The class
   *  default is the pre-overhaul behaviour, which is what a bare instance in a
   *  test or probe gets. */
  mode:CameraMode='free';
  /** The camera's look (Settings.cameraStyle, 'classic' unless the player chose Close), written by main.ts with `mode`.
   *  'classic' is everything below as it always was; 'close' dresses the same rig closer, lower, narrower and to one
   *  side (closeStyle.ts). The class default is the one a bare instance in a test or probe gets: Classic. */
  style:CameraStyle='classic';
  /** How far into the Close style the rig is, 0..1: eased like the lock-on blend, so a change of style - or a
   *  crowd arriving - is a move and not a cut. Zero on a small floor, which is filmed in Classic (see SMALL_FLOOR).
   *  Read-only. */
  styleBlend=0;
  /** The Close style's weight for the movement basis alone (`resample`, the bounded latch): `styleBlend` as it would
   *  be but for a small floor, so a player who chose Close steers exactly as before everywhere; only the look falls
   *  back to Classic there. */
  private latchBlend=0;
  /** What main.ts writes back into `input.yaw` after each update. In free mode
   *  it is exactly the yaw it was handed, so the write-back is a no-op; locked
   *  on it is the assisted heading, so the accumulator the next mouse delta is
   *  added to is the heading the player is looking along. */
  inputYaw=Math.PI;
  /** How hard the lock-on assist may steer this frame, 0..1 (range, dead zone
   *  and the player's own turning folded together). Read-only. */
  assist=0;
  private initialized=false;
  private subject='';
  private anchor=new THREE.Vector3();
  private focus=new THREE.Vector3();
  private desired=new THREE.Vector3();
  private right=new THREE.Vector3();
  private forward=new THREE.Vector3();
  private probe=new THREE.Vector3();
  private boom=4.5;
  private lift=1.65;
  private shoulder=1.15;
  private focusHeight=1.05;
  private size:Rig={boom:4.5,lift:1.65,shoulder:1.15,focus:1.05};
  private trauma=0;
  private age=0;
  /** Lock-on state: the heading the assist steers (the presented `yaw` eases
   *  to it at the same rate free mode eases to the mouse), its angular
   *  velocity, when the player last turned, and how far into the lock-on
   *  composition the rig is (0 free, 1 locked on), so a settings change is a
   *  move rather than a cut. `far` and `air` are the smoothed separation and
   *  height the composition opens up for; `hold` is the hit freeze;
   *  `engage` how far into the close-quarters swing (see ENGAGE_OFFSET). */
  private heading=Math.PI;
  private assistVelocity=0;
  private lastTurn=-Infinity;
  private lockBlend=0;
  private lockLook=0;
  private lockAhead=0;
  private far=0;
  private air=0;
  private airLanded=LAND_HOLD;
  private hold=0;
  private engage=0;
  private strain=0;
  /** How far into the close-quarters stand-back the rig is (see CLOSE_BOOM). */
  private close=0;
  /** The turn away from whatever hides the opponent (see COVER_ENTER), on
   *  top of the framing: where it is going, where it is, how long until it
   *  may step again, and which side of its biggest blocker the opponent was
   *  on the last time anybody looked. */
  private dodge:Follower={value:0,velocity:0};
  /** The framing's angle off the line to the opponent this frame (see
   *  ALPHA_MOST). */
  private offAxis=0;
  /** Dynamic framing base after close-duel preparation, before the signed
   *  coverage dodge. Retained for exact camera capture diagnostics. */
  private framingGoal=NaN;
  /** Round 3e: of the opponent's box on screen, how much the player's own
   *  body alone hides (see `coverage`), for the fade's window (see
   *  OcclusionFader.selfCover). */
  private coverMine=0;
  /** Round 3e: the room the stage's camera walls make (see `roomOf`), and
   *  for which occluder list. */
  private room?:Room;private roomSource?:readonly THREE.Object3D[];
  private dodgeGoal=0;
  private dodgeWait=0;
  private awayFrom=0;
  /** Launch night: the view as it stands hides the opponent, so the brain's window is shut (see `steerDynamic`). */
  private uncover=false;
  /** Drawn bounds this frame: the player's, the opponent's, and every body
   *  that might stand between them and the lens (the first is always the
   *  player). Grown, never shrunk, so a frame allocates nothing. */
  private meBox=capsule();
  private foeBox=capsule();
  private blockers:Capsule[]=[capsule(),capsule(),capsule(),capsule()];
  private blockerCount=0;
  private gatherSelf?:Fighter;
  private gatherFoe?:Fighter;
  /** The lens the coverage is judged from, as the rig last placed it: its
   *  height, the look's pitch, and the field. Scratch for one projection. */
  private lensY=0;
  private lookPitch=0;
  private tanV=Math.tan(THREE.MathUtils.degToRad(25));
  private tanH=Math.tan(THREE.MathUtils.degToRad(25))*16/9;
  private rX0=0;private rX1=0;private rY0=0;private rY1=0;private rDepth=0;
  /** The vertical framing (see FRAME_TOP): the look's tilt in radians and the
   *  lens's stand-back in metres, each with its speed; how much the opponent
   *  is the fight (the heading assist's range, without its dead zone or the
   *  player's turning, since straight overhead is exactly when a launched
   *  body needs framing); and the pitch bounds `bounds` leaves behind. */
  private tilt:Follower={value:0,velocity:0};
  private pull:Follower={value:0,velocity:0};
  private widen:Follower={value:0,velocity:0};
  private framed=0;
  private edgeRoom=0;
  /** Launch night: how far the rig is squeezed toward the player's body by the stage's bound (see SQUEEZE_MOST), 0..1,
   *  and the rise for it, in metres (eased: SQUEEZE_RISE). */
  private squeeze=0;private squeezeLift=0;
  private landed=LAND_HOLD;
  /** The heading assist's acceleration in each 120 Hz substep of this frame
   *  (rad/s^2), which the tilt shares its budget with; see `approach`. */
  private turning=new Float64Array(32);
  private turnSteps=0;
  private riseFoe=0;private lastFoe=NaN;private lastBody?:Fighter;
  /** How far the opponent is into lying down (see LIE_MARGIN), and the floor
   *  they last stood on. */
  private down=0;private floorFoe=0;
  private spanX=new Float64Array(SPAN_JOINTS.length);private spanZ=new Float64Array(SPAN_JOINTS.length);
  private joint=new THREE.Vector3();private riseMe=0;private lastMe=NaN;private floorMe=0;
  private reachMe=0;private lowMe=0;private highMe=0;private reachFoe=0;private lowFoe=0;private highFoe=0;
  /** The player's lowest point's reach along the view (see SPREAD_FROM), and
   *  how far they are lying down. */
  private reachMeLow=0;private lyingMe=0;
  private fromMe=0;private toMe=0;private fromFoe=0;private toFoe=0;
  /** The impact camera (see KICK_PEAK): the lens offset, its velocity, where
   *  the current blow is throwing it and for how long more it is held there;
   *  the punch-in and its goal, in degrees; and the lens's own field of view
   *  before either, which is what the pre-overhaul code eased on
   *  `camera.fov` itself. */
  private kick=new THREE.Vector3();
  private kickVelocity=new THREE.Vector3();
  private kickGoal=new THREE.Vector3();
  private kickHold=0;
  private punch=0;
  private punchGoal=0;
  private baseFov:number;
  private axis=new THREE.Vector3();
  /** The authored shots (Settings.cinematics, written by main.ts every
   *  frame; off by default for a bare instance). They are laid over the
   *  gameplay shot after `movementYaw` is taken from it. */
  readonly director=new CameraDirector();
  /** The feel pass: the finisher's cuts (FinisherCuts), on where main.ts turns them on (with the cinematic
   *  camera, and the pass); off, the director films the ultimate as it always has. */
  readonly cuts=new FinisherCuts();
  finisherCuts=false;
  /** Occlusion fading (see OcclusionFade): anybody between the lens and the
   *  people the shot is about dithers out while they block the view. It only
   *  changes what is drawn, never where the lens is. */
  readonly fader=new OcclusionFader();
  cinematics=false;
  /** Whether this camera fades what stands between its lens and its people (`fader`). A couch's split screen films its
   *  second half with a second camera, which leaves the fading to the first: the faded bodies and the shared fade
   *  uniforms are the scene's, and two faders would fight over them (couch/viewState.ts). */
  fading=true;
  /** Round 4: the dynamic camera's brain (see CameraBrain), what it is told
   *  each frame and the bodies it is told about (grown, never shrunk, so a
   *  frame allocates nothing), and how far into the dynamic rig the camera is
   *  (0 in the other modes, eased like `lockBlend`). */
  readonly brain=new CameraBrain();
  private brainIn=brainInput();
  private subjects:Subject[]=[];
  private subjectCount=0;
  private dynBlend=0;
  /** What main.ts writes back into `input.pitch` after each update: exactly
   *  the pitch it was handed except in dynamic mode, which levels the pitch
   *  once the player has left it alone (CameraBrain PITCH_*). */
  inputPitch=.02;
  /** The player's travel, off the presented root (see VELOCITY_RATE). */
  private travel=new THREE.Vector3();private lastRoot=new THREE.Vector3();private rooted=false;
  /** How much the player has turned the view lately (see DIRECTOR_TURN). */
  private turnMemory=0;
  /** The movement basis (see `movementBasis`): the turning the dynamic camera
   *  has done by itself since the movement keys last changed, as the heading
   *  took it and as the presented view (eased after the heading) shows it;
   *  and which keys. */
  private autoTurn=0;private autoShown=0;private basisMask=0;
  /** The gameplay shot on screen (CameraBrain PLAY_*), how far into it, and the
   *  ration they are dealt out on; whether the player was mid ground smash. */
  private play:PlayKind|null=null;private playT=0;private readonly shots=new ShotGate();private wasPlunging=false;
  /** Round 4b: which side of the view the body a shot follows through went (+1 right). */
  private playSide=1;
  /** Round 4b (TARGETING): the challenger CameraFocus is weighing, which
   *  main.ts hands over every frame for the brain to hold in the shot as its
   *  case grows (CameraBrain PENDING_*); empty for none. */
  readonly focusHint={pending:'',share:0};
  /** Round 4b: who the dynamic shot is about (main.ts runs it in the main
   *  game and hands its pick in as the opponent); reset with the camera. */
  readonly picker=new CameraFocus();
  /** Additional objective enemies, reused directly from the horde renderer. */
  extraSubjects?:ReadonlyMap<string,Pick<Fighter,'state'|'group'>>;
  /** Round 4b: the stage's play bounds - half extents round the origin - the
   *  dynamic lens is kept inside (BOUND_*); main.ts sets them per stage. */
  stageBounds?:{halfX:number;halfZ:number;doubleSided?:boolean;background?:number;id?:string};
  private settledFor=0;private blockedFor=0;private focusOf='';private coverAt=Infinity;
  /** Launch day, the arena camera (see ARENA). How far into it the rig is (0 in the other modes and where the view is
   *  the squad's, eased like `dynBlend`). */
  private arenaBlend=0;
  /** main.ts: the match has exactly one opponent - a Duel, Training, the last two of a royale - and the arena camera
   *  holds them at any distance. */
  sole=false;
  /** Who is held this frame ('' for nobody), how much (the framing's range, 0..1) and the line from the player to them
   *  (kept where it last meant something: inside DEAD_ZONE a bearing is noise). */
  private holdId='';private holding=0;private holdBearing=0;
  /** The player's own look-away: how far their mouse or stick has the view off the camera's own composition (radians;
   *  given back at ARENA.away once they leave the view alone), and the camera's own part of the view, off the line to the
   *  opponent (signed: positive with the opponent right of the middle, the lens over the right shoulder). */
  private away=0;private own=0;
  /** The movement basis in the arena (`movementBasis`): who the keys were read against when they went down, the
   *  look-away as it was then (plus the player's own turning since) and the basis last handed out, which a run keeps if
   *  the one it was read against is no longer held. */
  private basisFoe='';private awayBasis=0;private basisHeld=NaN;
  /** Which shoulder (+1 right), when it last changed, and the shoulder as the rig has it (eased over ARENA.sideTime). */
  private arenaSide=1;private sideAt=-Infinity;private sideFrom=1;private sideEase=1;
  /** The line's own turning (rad/s, fed forward at range), and how far the opponent is outside the frame (0..1, eased). */
  private bearingRate=0;private lastBearing=NaN;private urgent=0;
  /** How long the opponent has stood behind the player's own body as the lens has it (ARENA.behind), whether the view is
   *  turning out for it, and when who is held last changed hands (a pan: ARENA.pan). */
  private behindFor=0;private showing=false;private changedAt=-Infinity;
  /** How much further toward the opponent's side the lens stands for a bound that turned the view past the window's own
   *  edge (metres: ARENA.slideSide), and as much of it as the rig has eased into. */
  private slideSide=0;private slideNow=0;private slideEase:Follower={value:0,velocity:0};private sliding=false;
  /** What the simulation aims by (main.ts: `command.yaw`): in the arena camera with an opponent held, the line to them
   *  with the player's own look-away on it - a swing, a guard and a dash with no direction go at the opponent - and the
   *  view itself otherwise, as it always was. */
  get aimYaw(){if(this.smartOn)return this.smartHeld?this.smart.foeBearing+this.smart.away:this.movementYaw;return this.arenaBlend>.5&&this.holding>.5?this.holdBearing+this.away:this.movementYaw;}
  /** 24 October 2026, the Smart camera (Settings.cameraMode 'smart', SmartCamera.ts): its rig, and whether it has the view
   *  - the main game's own modes only; where the view is the squad's (Arcade Survival, the objectives, the rift) it is the
   *  dynamic camera those modes were made with. Nothing of it is read in any other mode. */
  readonly smart=new SmartRig();
  get smartOn(){return this.mode==='smart'&&!this.battlefield;}
  /** Whether the last frame was the Smart camera's (a switch either way is a cut), whether it holds an opponent - the aim
   *  then goes to them (the keys are read against the view: `movementBasis`) - and whom. */
  private smartWas=false;private smartHeld=false;private smartFoe='';
  private smartIn:SmartInput={dt:0,placed:true,me:{x:0,y:0,z:0,high:CROWN,lying:false,airborne:false,vx:0,vz:0,floor:0,scale:1},foe:undefined,sole:false,threats:[],threatCount:0,manual:0,manualTilt:0,aspect:16/9,bound:undefined,frozen:false};
  private smartFoeBody={id:'',x:0,y:0,z:0,high:CROWN,lying:false,airborne:false,vx:0,vz:0};
  private smartBound={halfX:0,halfZ:0,out:0};
  private smartThreats:SmartThreat[]=[];private smartThreatCount=0;
  /** The opponent's own travel (eased, as the player's: VELOCITY_RATE), and the floor the player last stood on. */
  private foeTravel=new THREE.Vector3();private foeLast=new THREE.Vector3();private foeTracked='';private smartFloor=0;
  /** When each body was last seen attacking the player (see SMART_PRESS); pruned with the match (`reset`). */
  private readonly smartPressed=new Map<string,number>();
  /** Round 4b: the player has been held up with the movement keys down (BLOCKED_*). */
  get blocked(){return this.blockedFor>=BLOCKED_AFTER;}
  private bodyFocus=new THREE.Vector3();
  /** The run's look-ahead as it was laid on the rig this frame (CameraBrain LEAD_*, held to the frame: see LEAD_SIDE). */
  private leadNow=new THREE.Vector3();
  /** Round 3c: where the lock-on reticle goes (see MARKER_LIFT). main.ts has
   *  projected the target's middle, raised 0.65 m - the face - into `ndc`; this
   *  moves it over the crown as drawn, so the reticle and its nameplate sit
   *  above the head instead of on it. `height` is the viewport's, in the CSS
   *  pixels the HUD places the reticle in. A body that is not a fighter (an
   *  arcade enemy) keeps the point it was given; so does one behind the lens,
   *  which the HUD pins to the frame's edge. */
  aboveHead(ndc:THREE.Vector3,body:Fighter|undefined,height:number){
    if(!body||!(height>0))return;
    const crown=this.crown,head=body.model?.visible!==false?body.joints?.get('Head'):undefined;
    if(head){head.getWorldPosition(crown);crown.y+=HEAD_PAD;}
    else crown.copy(body.group.position).y+=CROWN*drawnBulk(body);
    crown.project(this.camera);
    if(!(crown.z<1)||!Number.isFinite(crown.y))return;
    ndc.set(crown.x,Math.min(crown.y+2*MARKER_LIFT/height,1-2*MARKER_TOP/height),crown.z);
  }
  private crown=new THREE.Vector3();
  /** Round 3c: the crown of a spirit looming over the player this frame, in
   *  world metres (see LOOM_CROWN); -Infinity with none. */
  private loomHigh=-Infinity;
  private cutFocus=new THREE.Vector3();
  /** The opponent's chest, for the scenery cutaway's second aperture: locked
   *  on, the lens looks past the player at them. */
  private cutTarget=new THREE.Vector3();
  private cutTargeting=false;
  /** Read-only state for the evidence captures, on `camera.userData.rig`:
   *  one object, updated in place. `cover` is how much of the opponent is
   *  hidden from the lens as placed (see COVER_ENTER). */
  /** Round 3e: how far into the fox's own rig the lock-on is (see FOX_LOCK). */
  private foxness=0;
  /** The body as drawn, locked on (see DRAWN_TOP): the rig's scale and the
   *  stand-back, eased, what they are heading for, and when it was measured. */
  private drawnScale=1;private drawnBack=0;private drawnScaleGoal=1;private drawnBackGoal=0;private drawnAt=-Infinity;private drawnOf='';
  private drawnTop=-Infinity;private drawnMin=Infinity;private drawnInverse=new THREE.Matrix4();private drawnCorner=new THREE.Vector3();
  private readonly rig={styleBlend:0,mode:'free' as CameraMode,assist:0,heading:0,shot:'none' as string,shotWeight:0,punch:0,kick:0,tilt:0,pull:0,widen:0,cover:0,dodge:0,engage:0,faded:0,fadeMost:0,fadeWindow:0,fadeTwinned:0,fadeRoom:0,stageFront:0,stageTarget:0,awaken:undefined as undefined|Readonly<CameraDirector['awakenFrame']>,
    // Round 4: the dynamic camera's state (CameraBrain), for the captures.
    brain:'idle' as string,yieldTo:0,group:0,side:1,play:'none' as string,fov:50,
    // Round 4b: who the shot is about, the switch's breath, the lens kept in bounds (metres moved).
    focus:'' as string,switching:0,bounded:0,covered:0,
    // The edge lift (EDGE_*), 0..1, and whether the floor is a small one (SMALL_FLOOR).
    edge:0,small:false,
    // Launch night: how far the rig is squeezed toward the player's body by the stage's bound (SQUEEZE_*), 0..1.
    squeeze:0,
    // Launch day, the arena camera (ARENA): how far into it, how much an opponent is held, the camera's own angle off
    // the line to them and the player's own look-away (radians).
    arena:0,hold:0,own:0,away:0};
  constructor(readonly camera:THREE.PerspectiveCamera){this.baseFov=camera.fov;camera.userData.rig=this.rig;
    // Round 3f (CAM5): the awakening shot's framing, for the evidence captures.
    this.rig.awaken=this.director.awakenFrame;}
  reset(){resetCameraCutaway();this.sportFov=0;this.fader.stage.off();this.initialized=false;this.subject='';this.trauma=0;this.boom=4.5;this.lift=1.65;this.shoulder=1.15;this.focusHeight=1.05;
    this.assistVelocity=0;this.lastTurn=-Infinity;this.far=0;this.close=0;this.air=0;this.airLanded=LAND_HOLD;this.hold=0;this.framed=0;this.engage=0;this.strain=0;this.landed=LAND_HOLD;
    this.tilt.value=this.tilt.velocity=this.pull.value=this.pull.velocity=this.widen.value=this.widen.velocity=0;this.squeeze=this.squeezeLift=0;
    this.dodge.value=this.dodge.velocity=0;this.dodgeGoal=0;this.dodgeWait=0;this.uncover=false;this.foxness=0;this.framingGoal=NaN;this.fader.closeManual=0;
    this.kick.set(0,0,0);this.kickVelocity.set(0,0,0);this.kickGoal.set(0,0,0);this.kickHold=0;this.punch=0;this.punchGoal=0;this.director.reset();this.cuts.reset();
    this.brain.reset();this.subjectCount=0;this.rooted=false;this.travel.set(0,0,0);this.turnMemory=0;this.autoTurn=this.autoShown=0;this.play=null;this.playT=0;this.shots.reset();this.wasPlunging=false;
    this.settledFor=this.blockedFor=0;this.focusOf='';this.focusHint.pending='';this.focusHint.share=0;this.picker.reset();
    this.holdId='';this.holding=0;this.away=this.own=0;this.basisFoe='';this.awayBasis=0;this.basisHeld=NaN;this.arenaSide=this.sideFrom=this.sideEase=1;this.sideAt=-Infinity;this.bearingRate=0;this.lastBearing=NaN;this.urgent=0;this.slideSide=this.slideNow=0;this.slideEase.value=this.slideEase.velocity=0;this.sliding=false;this.behindFor=0;this.showing=false;this.changedAt=-Infinity;
    this.smart.reset();this.smartHeld=false;this.smartFoe='';this.foeTracked='';this.smartPressed.clear();this.smartHeights.clear();}
  /** A hit. `weight` is the trauma main.ts derives from the damage (0..1);
   *  `direction` the world heading the blow travelled, which the lens is
   *  thrown along; `tier` (hitTier) is non-zero only for a hit the local
   *  player is part of, and buys the punch-in. */
  impact(weight:number,direction?:THREE.Vector3,tier:0|1|2=0){
    if(this.smartOn)return;
    // Launch night: in the dynamic mode an ordinary hit does not move the lens (see CALM_FROM). Not where the view is
    // the squad's (Arcade Survival, the objectives, the rift), whose camera stays as it is.
    const calm=this.battlefield?0:this.dynBlend;
    if(calm>0&&Number.isFinite(weight))weight*=1-calm*(1-CALM_SHARE*smooth(weight,CALM_FROM,CALM_FULL));
    this.trauma=Math.min(.8,Math.max(this.trauma,weight));
    const w=THREE.MathUtils.clamp(Number.isFinite(weight)?weight:0,0,1);
    if(direction&&direction.lengthSq()>1e-8&&w>0){
      // Thrown further along the new blow, never further than one blow can
      // throw it: a barrage holds the lens out rather than walking it away.
      this.kickGoal.addScaledVector(direction,KICK_PEAK*Math.pow(w,1.5)/direction.length());
      const most=KICK_PEAK*1.2;if(this.kickGoal.lengthSq()>most*most)this.kickGoal.setLength(most);
      this.kickHold=Math.max(this.kickHold,KICK_MIN_HOLD);
    }
    if(tier>0)this.punchGoal=Math.max(this.punchGoal,THREE.MathUtils.lerp(PUNCH[tier],tier>1?CALM_PUNCH:0,calm));
  }
  /** The hit freeze the local player is part of: the kick and the punch-in
   *  hold for it, and the lock-on assist brakes through it. */
  holdFor(weight=0){
    const w=Math.min(1,Math.max(0,weight));
    // (The freeze's own tremor is the other modes': the dynamic lens holds still through it.)
    this.trauma=Math.max(this.trauma,Math.min(.25,weight*.2)*(this.battlefield?1:this.smartOn?0:1-this.dynBlend));
    this.hold=Math.max(this.hold,.045+.1*w);this.kickHold=Math.max(this.kickHold,this.hold);
  }
  /** The countdown sweep and the victory orbit are CameraDirector shots: with
   *  cinematics off they never show, and either way they only move the
   *  picture - the navigation heading underneath stays the player's. */
  intro(seconds:number){this.director.intro(seconds);}
  /** A change of subject is a cut, not a swoop. A shot in progress keeps
   *  going round its own subject. */
  cut(){this.initialized=false;}
  /** Launch day (12 October 2026): the view at the start of a match or a round is this heading from its first frame - a
   *  cut to behind the player, looking where they face (the room seats every fighter facing the closest opponent:
   *  ArenaSimulation.startMatch) - and so is everything of the camera that is read before that frame is laid: main.ts
   *  asks the focus who the shot is about, and stamps the input it sends, against `movementYaw` first. Left holding the
   *  heading the lens had come to in the waiting room, a royale's first pick was whoever stood nearest that old view,
   *  and the lens then turned from the opponent in front of the player round to them (scripts/night/camera/start.mts).
   *  The caller hands the same heading to the input (`input.yaw`), as with any view it sets; nothing else of the rig is
   *  touched (`reset` first for a new fight). */
  lookAlong(yaw:number){this.initialized=false;this.heading=this.yaw=this.movementYaw=this.inputYaw=yaw;this.smart.lookAlong(yaw);}
  victory(winner:Fighter,seconds:number){this.director.victory(winner,seconds);}
  /** Round 4: the heading main.ts reads the movement keys against. The view's
   *  own (`movementYaw`) less whatever the dynamic camera has turned by itself
   *  since the movement keys last changed, so a camera turning on its own -
   *  after an opponent, round behind a run - never bends a run already in
   *  progress; the player's own turning (mouse, stick, view keys) still
   *  steers it, as it always has. The RiftCamera basis pattern
   *  (survival/riftCamera.ts), for the main game. `mask` is the movement keys
   *  held (viewKeys.movementMask; zero for none, or for a stick, whose run
   *  turns with the view); a change of it hands the run the view as it is.
   *  In the other modes exactly `movementYaw`.
   *
   *  Launch day, the arena camera (ARENA): with an opponent held as the keys go down, the run is read against the line
   *  to them instead - W closes, S opens, A and D circle, as a stick does under a lock-on - turned by
   *  whatever the player's own mouse or stick has the view off the camera's composition (their look-away as it was then,
   *  and their turning since: the mouse still steers a run, the camera coming back to its composition does not). It is
   *  read against that opponent until the keys change, whoever the shot has gone to meanwhile; and once they are no
   *  longer held at all, against the last line it had. A stick has no keys to change: its run is against whoever is
   *  held now, as it has always turned with the view. */
  movementBasis(mask:number){
    if(this.smartOn){
      if(mask!==this.basisMask||mask===0){this.basisMask=mask;this.autoTurn=0;}
      return this.movementYaw-this.autoTurn;
    }
    // From here the view's turning is the player's own, less what the heading
    // already holds that the view has yet to ease into (the camera's, if it
    // was turning as the keys went down).
    if(mask!==this.basisMask||mask===0){this.basisMask=mask;this.autoTurn=wrapped(this.heading-this.yaw);this.autoShown=0;
      this.basisFoe=this.arenaBlend>.5&&this.holding>.5?this.holdId:'';this.awayBasis=this.away;this.basisHeld=NaN;}
    if(this.basisFoe){
      if(this.basisFoe===this.holdId&&this.holding>0)this.basisHeld=this.holdBearing+this.awayBasis;
      if(Number.isFinite(this.basisHeld))return this.basisHeld;
    }
    return this.dynBlend>0?this.movementYaw-this.autoShown:this.movementYaw;
  }

  /** The Chase camera style (Settings.cameraStyle 'chase'): the page says when an exchange between the player and their
   *  one opponent is on (main.ts), and the lens comes in for it (comboFrame). Classic and Close never set it. */
  comboShot=false;
  private comboBlend=0;private comboSide=1;private comboKick=0;private comboDrift=0;
  /** The Chase style: a finisher of the player's own string punches the combo shot in (COMBO_PUNCH), easing back out. */
  comboPunch(){this.comboKick=1;this.comboHeld=COMBO_PUNCH_HOLD;}
  /** The Chase shot as it stands, for the measuring tools (arenaEvidence.combo). */
  comboEvidence(){return {shot:this.comboShot,blend:+this.comboBlend.toFixed(3),pull:+this.comboPull.toFixed(3),clear:+this.comboClear.toFixed(3),side:this.comboSide,held:+this.comboHeld.toFixed(3),kick:+this.comboKick.toFixed(3)};}
  private comboHeld=0;private readonly comboEye=new THREE.Vector3();private readonly comboLook=new THREE.Vector3();
  private comboSightAge=Infinity;private comboFlipAge=Infinity;private comboClear=1;private comboPull=1;private readonly comboRay=new THREE.Raycaster();private readonly comboHits:THREE.Intersection[]=[];
  private comboFrame(dt:number,placed:boolean,self:Fighter,foe:Fighter|undefined,occluders:readonly THREE.Object3D[]){
    const goal=this.comboShot&&foe?1:0;
    this.comboBlend=placed?goal:this.comboBlend+(goal-this.comboBlend)*blend(goal>this.comboBlend?COMBO_RATE:COMBO_RATE*.6,dt);
    if(this.comboBlend<1e-3){this.comboBlend=0;return;}
    if(!foe)return;
    const me=self.group.position,them=foe.group.position;
    let fx=them.x-me.x,fz=them.z-me.z;const flat=Math.hypot(fx,fz);
    if(flat<.2)return;
    fx/=flat;fz/=flat;
    // The side the lens is on as the shot comes in (a flip would be a cut): right of the line from the player to the
    // opponent or left. Kept after that, unless it runs off the floor or into the stage (see below).
    if(placed||this.comboBlend<.05){const cam=this.camera.position,cross=(cam.x-me.x)*fz-(cam.z-me.z)*fx;if(Math.abs(cross)>.3)this.comboSide=cross>0?1:-1;}
    // Held in on the blow (COMBO_PUNCH_HOLD), the beat after a finisher, then eased back out.
    if(this.comboHeld>0)this.comboHeld=Math.max(0,this.comboHeld-dt);else this.comboKick=Math.max(0,this.comboKick-dt/COMBO_PUNCH_SECONDS);
    // A slow drift round the pair while the string runs, the lens always moving (COMBO_DRIFT, swinging
    // between +-COMBO_SWAY radians), so a string is never filmed from a fixed spot. A finisher's blow settles it: the
    // drift stops, the shot holds where it is through the punch-in's hold and follows at COMBO_SETTLE of its pace until
    // the punch-in has eased out (the critic, rounds 4 and 5: "nothing settles after the finisher" - the lens swung
    // 30-40 degrees after the thrown body, where it should stay behind Taisei, turning no more than about 10).
    const settling=this.comboHeld>0||this.comboKick>0;
    if(!settling)this.comboDrift+=dt*COMBO_DRIFT;
    // Off the line from the player to the opponent by COMBO_ANGLE, give or take the drift, never nearer it than about 34
    // degrees: at 15 the opponent stood behind the player's back for whole strings (the critic, round 6).
    const bearing=COMBO_ANGLE+Math.sin(this.comboDrift)*COMBO_SWAY,far=Math.hypot(COMBO_BACK,COMBO_SIDE);
    const b=this.stageBounds,edge=.6;
    const eyeOn=(side:number,out:THREE.Vector3)=>out.set(me.x+(-fx*Math.cos(bearing)+fz*side*Math.sin(bearing))*far,0,me.z+(-fz*Math.cos(bearing)-fx*side*Math.sin(bearing))*far);
    // How far past the floor's edge a lens there would stand.
    const outside=(at:THREE.Vector3)=>b?Math.max(0,Math.abs(at.x)-(b.halfX-edge))+Math.max(0,Math.abs(at.z)-(b.halfZ-edge)):0;
    const chest=_comboChest.set(me.x,me.y+1.1,me.z);
    // How much of the way from the player's chest to a lens there is clear of the stage.
    const clearTo=(at:THREE.Vector3)=>{
      if(!occluders.length)return 1;
      _comboDir.set(at.x,chest.y+COMBO_HEIGHT-COMBO_CHEST,at.z).sub(chest);const span=_comboDir.length();if(span<.3)return 1;
      this.comboRay.set(chest,_comboDir.divideScalar(span));this.comboRay.far=span;
      this.comboHits.length=0;this.comboRay.intersectObjects(occluders as THREE.Object3D[],true,this.comboHits);
      return this.comboHits.length?THREE.MathUtils.clamp((this.comboHits[0].distance-.3)/span,0,1):1;
    };
    const clutter=(at:THREE.Vector3)=>{
      if(!occluders.length)return Infinity;
      let nearest=Infinity;
      const from=_comboFrom.set(at.x,chest.y+COMBO_HEIGHT-COMBO_CHEST,at.z),toward=Math.atan2(them.x-at.x,them.z-at.z);
      for(const turn of [-.35,.35]){
        this.comboRay.set(from,_comboDir.set(Math.sin(toward+turn),-.15,Math.cos(toward+turn)).normalize());this.comboRay.far=COMBO_CLUTTER*2;
        this.comboHits.length=0;this.comboRay.intersectObjects(occluders as THREE.Object3D[],true,this.comboHits);
        if(this.comboHits.length)nearest=Math.min(nearest,this.comboHits[0].distance);
      }
      return nearest;
    };
    // Looked at every COMBO_SIGHT seconds - the stage's meshes are not cheap to ray every frame. The lens crosses to the
    // other side of the line when its own side runs off the floor or into the stage and the other has room (the critic,
    // round 7: along the training hall's wall the floor's edge held the lens on the line, behind Taisei's back, and Ouga
    // was out of sight for whole strings); at most once every COMBO_FLIP seconds, so it never hunts between them.
    this.comboSightAge+=dt;this.comboFlipAge+=dt;
    if(this.comboSightAge>=COMBO_SIGHT){
      this.comboSightAge=0;
      const mine=eyeOn(this.comboSide,_comboEyeA),theirs=eyeOn(-this.comboSide,_comboEyeB);
      const here=outside(mine);this.comboClear=clearTo(mine);
      // And the stage in the foreground: the nearest thing a lens there sees a fifth of a turn either side of the pair,
      // nearer than COMBO_CLUTTER (round 9: the training hall's rock filled the left half of the finisher's shot, clear
      // of the line to either fighter).
      const near=clutter(mine);
      if(this.comboFlipAge>=COMBO_FLIP&&(here>.35||this.comboClear<.6||near<COMBO_CLUTTER)){
        const there=outside(theirs),open=clearTo(theirs),far=clutter(theirs);
        if(there<here-.3||here<=.35&&there<.2&&(open>this.comboClear+.25||open>=.6&&far>near+.5)){this.comboSide=-this.comboSide;this.comboClear=open;this.comboFlipAge=0;}
      }
      this.comboClear=Math.max(COMBO_NEAR,this.comboClear);
    }
    const lens=eyeOn(this.comboSide,_comboEyeA),eyeX=lens.x,eyeZ=lens.z;
    // Up and down with the player first: their leap or air string keeps them in the frame, clear of the HUD across its
    // top (the critic, rounds 4 and 5: Taisei's head went up behind the training bar on his leaping wind-up and in the
    // air strings) - lifted COMBO_AIR more while they are off the floor, so the pair sits lower in the frame - and the
    // opponent's rise only a little (a body knocked up is let go out of the top of the shot, not followed up).
    // (And the player's own body as drawn: a leap that is the clip's alone - Taisei's Skyfall Smash - leaves the body the
    // server holds on the floor, and went up behind the HUD on every finisher: the critic, rounds 4-8.)
    const hips=self.joints.get('Hips'),drawn=hips?Math.max(0,hips.getWorldPosition(_comboHips).y-me.y-COMBO_HIPS*drawnBulk(self)):0;
    // Only COMBO_DRAWN of it, and the air's lift only past half a metre: the whole of it framed the smash itself in the
    // bottom third of the shot, under the move's name (round 9).
    const base=Math.min(me.y,them.y),up=me.y-base+drawn*COMBO_DRAWN,rise=them.y-base,air=self.state.grounded&&drawn<.5?0:COMBO_AIR;
    const goalEye=new THREE.Vector3(b?THREE.MathUtils.clamp(eyeX,-b.halfX+edge,b.halfX-edge):eyeX,base+COMBO_HEIGHT+up*(1+COMBO_RISE)+rise*.25+air,b?THREE.MathUtils.clamp(eyeZ,-b.halfZ+edge,b.halfZ-edge):eyeZ);
    // Looking out toward the opponent no further than COMBO_REACH: a thrown body is left to fly out of the shot, not chased.
    const reach=Math.min(flat,COMBO_REACH)*COMBO_LOOK;
    const goalLook=new THREE.Vector3(me.x+fx*reach,base+COMBO_CHEST+up*.85+rise*.2+air,me.z+fz*reach);
    // Nothing of the stage between the lens and the player (the critic, round 5: the training hall's rock filled 45-60%
    // of the frame and pushed the fighters to its edges): where the other side is no better, the lens comes in toward
    // them on its bearing to the last clear point (comboClear, above), never nearer than COMBO_NEAR of the way, quickly in
    // and slowly back out. (Toward the player, not along the line to where it looks: that put the lens on the player's
    // back and the opponent behind them - round 6.)
    this.comboPull=placed?this.comboClear:this.comboPull+(this.comboClear-this.comboPull)*blend(this.comboClear<this.comboPull?10:2,dt);
    goalEye.set(me.x+(goalEye.x-me.x)*this.comboPull,goalEye.y,me.z+(goalEye.z-me.z)*this.comboPull);
    if(placed||this.comboBlend<.02){this.comboEye.copy(goalEye);this.comboLook.copy(goalLook);}
    else{
      // Up and down faster than round: a leap is quick, and the HUD is right above it. Held through the punch-in's hold
      // round the pair, not up and down: a smash that comes down out of a leap is followed down (round 9: held where the
      // leap had taken it, the shot framed the smash in the bottom third) - slowly, so the beat after it stays calm (round 10).
      const k=this.comboHeld>0?0:blend(COMBO_FOLLOW*(settling?COMBO_SETTLE:1),dt),ky=blend(COMBO_FOLLOW*(settling?.6:1.8),dt);
      this.comboEye.set(this.comboEye.x+(goalEye.x-this.comboEye.x)*k,this.comboEye.y+(goalEye.y-this.comboEye.y)*ky,this.comboEye.z+(goalEye.z-this.comboEye.z)*k);
      this.comboLook.set(this.comboLook.x+(goalLook.x-this.comboLook.x)*k,this.comboLook.y+(goalLook.y-this.comboLook.y)*ky,this.comboLook.z+(goalLook.z-this.comboLook.z)*k);
    }
    const w=this.comboBlend*this.comboBlend*(3-2*this.comboBlend);
    this.camera.position.lerp(this.comboEye,w);
    this.probe.lerp(this.comboLook,w);
    // A finisher's punch-in (comboPunch): the lens driven toward the blow on the frame, not eased - the kick is the shot.
    const kick=Math.sin(Math.PI*.5*this.comboKick)*w;
    if(kick>0)this.camera.position.lerp(this.probe,COMBO_PUNCH*kick);
    this.camera.lookAt(this.probe);
  }
  update(dt:number,self:Fighter,yaw:number,pitch:number,occluders:THREE.Object3D[],shake:number,opponent?:Fighter,locked=false){
    dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.25);
    // 24 October 2026: the Smart camera has a frame of its own (see `updateSmart`); leaving it is a cut.
    if(this.smartOn){this.updateSmart(dt,self,yaw,pitch,occluders,shake,opponent,locked);return;}
    if(this.smartWas){this.smartWas=false;this.smartHeld=false;this.initialized=false;}
    const position=self.group.position;
    const placed=!this.initialized||self.state.id!==this.subject||this.anchor.distanceToSquared(position)>100;
    // The player moved the view this frame: `inputYaw` is what the input was
    // left holding after the last update, in either mode.
    const turned=this.initialized&&Math.abs(wrapped(yaw-this.inputYaw))>1e-6;
    // And tilted it (round 4: the dynamic camera levels a pitch left alone).
    const tilted=this.initialized&&Math.abs(pitch-this.inputPitch)>1e-6;
    // Launch day: the arena camera is the dynamic rig, held as an arena fighter's lock holds (ARENA). Where the view is
    // the squad's (Arcade Survival, the objectives, the rift) it is the dynamic camera those modes were made with.
    const lockon=this.mode==='lockon',arena=this.mode==='arena'&&!this.battlefield,dynamic=this.mode==='dynamic'||this.mode==='arena',composed=lockon||dynamic;
    // The composition blends between the two rigs, so switching mode in the
    // settings mid-fight is a move, not a cut. Free mode at rest runs exactly
    // the pre-overhaul arithmetic below; nothing lock-on touches it. Round 4:
    // the dynamic camera is the lock-on composition with its own offsets laid
    // over it (`dynBlend`), so lock-on itself runs exactly as it did too.
    this.lockBlend=placed?(composed?1:0):this.lockBlend+((composed?1:0)-this.lockBlend)*blend(4,dt);
    if(!composed&&this.lockBlend<1e-3)this.lockBlend=0;
    this.dynBlend=placed?(dynamic?1:0):this.dynBlend+((dynamic?1:0)-this.dynBlend)*blend(4,dt);
    if(!dynamic&&this.dynBlend<1e-3)this.dynBlend=0;
    this.arenaBlend=placed?(arena?1:0):this.arenaBlend+((arena?1:0)-this.arenaBlend)*blend(4,dt);
    if(!arena&&this.arenaBlend<1e-3)this.arenaBlend=0;
    const latchGoal=arena?0:closeStyleGoal(this.style,this.battlefield,this.brain.group*this.dynBlend),styleGoal=smallFloor(this.stageBounds)?0:latchGoal*(1-smooth(this.squeeze,SQUEEZE_CLASSIC[0],SQUEEZE_CLASSIC[1]));
    this.styleBlend=placed?styleGoal:this.styleBlend+(styleGoal-this.styleBlend)*blend(CLOSE_RATE,dt);
    if(styleGoal===0&&this.styleBlend<1e-3)this.styleBlend=0;
    this.latchBlend=placed?latchGoal:this.latchBlend+(latchGoal-this.latchBlend)*blend(CLOSE_RATE,dt);
    if(latchGoal===0&&this.latchBlend<1e-3)this.latchBlend=0;
    // The poses a dash leaves fade near the Close lens (closeStyle.ts, GHOST_FADE) by how far into it the camera is: none in Classic.
    GHOST_FADE.value.x=this.styleBlend;
    const foe=opponent?.state.alive?opponent:undefined;
    // What each body spans and who could stand in front of the opponent,
    // read once for the heading and the vertical framing alike.
    if(this.lockBlend>0){this.measure(self,drawnBulk(self),this.meBox);
      // Round 3c: the spirit looming over an awakened user (SPIRITS) is framed
      // with them, crown and all (see LOOM_CROWN) - the rig grew for it, but
      // only the user's own head was held under the HUD's bars.
      const loom=loomTop(self.state.id);this.loomHigh=loom>0?self.group.position.y+loom+LOOM_CROWN:-Infinity;
      if(foe){this.measure(foe,drawnBulk(foe),this.foeBox);this.gather(self,foe);}else this.blockerCount=0;}
    if(lockon)this.steer(dt,placed,self,yaw,pitch,foe,locked);
    else if(dynamic){if(arena)this.steerArena(dt,placed,self,yaw,pitch,tilted,foe,locked);else this.steerDynamic(dt,placed,self,yaw,pitch,tilted,foe,locked);pitch=this.inputPitch;this.resample(dt,self);}
    else{this.heading=yaw;this.inputYaw=yaw;this.assistVelocity=0;this.assist=0;this.framed=0;this.strain-=this.strain*blend(STRAIN_OUT,dt);}
    if(!dynamic){this.inputPitch=pitch;this.turnMemory=0;}
    if(!arena){this.holding=0;this.holdId='';this.away=0;}
    this.cutTargeting=composed&&this.lockBlend>.5&&!!foe;
    if(foe)this.cutTarget.set(foe.group.position.x,foe.group.position.y+1.1,foe.group.position.z);
    if(placed){this.yaw=composed?this.heading:yaw;this.anchor.copy(position);this.autoShown=this.autoTurn;}
    else{
      this.yaw+=wrapped((composed?this.heading:yaw)-this.yaw)*blend(32,dt);
      // The view eases after the heading; so does its share of the dynamic
      // camera's own turning, so the movement basis takes exactly that out.
      this.autoShown+=(this.autoTurn-this.autoShown)*blend(32,dt);
      // X/Z travel exactly with the player. Only vertical landing noise is
      // eased; this never feeds back into simulation or directional input.
      this.anchor.x=position.x;this.anchor.z=position.z;
      // Round 4b: the dynamic lens climbs less than a tall jump does (AIR_*) - all the way with a big body (BIG_*).
      const rise=this.dynBlend>0&&Number.isFinite(this.floorMe)?position.y-this.floorMe:0;
      const climb=rise>AIR_FREE?position.y-(rise-AIR_FREE)*(1-AIR_SHARE)*(1-this.bigness())*this.dynBlend:position.y;
      this.anchor.y=THREE.MathUtils.lerp(this.anchor.y,climb,blend(24,dt));
    }
    // Round 4: the dynamic camera looks ahead of a run (CameraBrain LEAD_*) by
    // carrying the whole rig - lens and look alike - across with it, so the
    // view's heading, and with it the movement basis, is exactly what it was.
    if(this.dynBlend>0){
      // Launch night: never so far across that the player's own fighter leaves the frame. The carry is up to 1.1 m
      // (CameraBrain LEAD_MOST), which Classic's lens has room for; the Close lens stands nearer, narrower and further
      // over the shoulder, and a run toward the shoulder's side carried the rig out past the fighter - holding one
      // direction with nobody near put the player's own body off the edge of the frame (measured, scripts/night/camera:
      // out of it for 22% of a run round the Sunward Summit). The fighter's middle is kept inside LEAD_SIDE of the frame's
      // half-width; a carry the other way brings them toward the middle and is all there.
      let lx=this.brain.leadX*this.dynBlend,lz=this.brain.leadZ*this.dynBlend;
      const rx=-Math.cos(this.yaw),rz=Math.sin(this.yaw),across=lx*rx+lz*rz,side=Math.sign(this.shoulder)||1;
      const most=Math.max(0,LEAD_SIDE*this.boom*this.tanH-Math.abs(this.shoulder));
      if(across*side>most){const k=most/(across*side);lx*=k;lz*=k;}
      this.anchor.x+=lx;this.anchor.z+=lz;this.leadNow.set(lx,0,lz);
    }else this.leadNow.set(0,0,0);
    this.subject=self.state.id;
    const awakened=!!self.state.awakened;
    const fox=awakened&&self.state.fighter==='konta';
    // A body drawn bigger than the roster's (BODY_SIZE: Gorai at 3.2 m) is framed as a large form is, all the time.
    const large=awakened&&LARGE_FORMS.has(self.state.fighter)||!!BODY_SIZE[self.state.fighter];
    const bodyRig=NORMAL;
    const from=fox?FOX:large?LARGE:bodyRig,size=this.size;
    size.boom=from.boom;size.lift=from.lift;size.shoulder=from.shoulder;size.focus=from.focus;
    const alpha=placed?1:blend(7,dt);
    if(occluders!==this.roomSource){this.roomSource=occluders;this.room=roomOf(occluders);this.coverAt=this.age+COVER_AGAIN;this.rig.covered=coverStage(occluders);}
    // Round 4b: once more a little later, for props that loaded after the stage (see coverStage).
    else if(this.age>=this.coverAt){this.coverAt=Infinity;this.rig.covered+=coverStage(occluders);}
    if(this.lockBlend>0){
      // The lock-on rig (see LOCK_BOOM): in over the shoulder at chest
      // height, looking along the heading rather than back in at the player,
      // so the player holds the left third and the opponent has the right of
      // the frame. It stands back as the pair separate and for a launched
      // opponent, within limits.
      const k=this.lockBlend;
      // Sized by the body as drawn (see DRAWN_TOP): the normal rig scaled by
      // how tall it is, and stood back by what it carries behind it.
      this.measureDrawn(dt,placed,self,size.boom/4.5);
      // Each part of the rig grows with the body by its own share of that
      // (see FORM_BOOM): a form is framed from over its shoulder, not from
      // behind all of it.
      const scale=this.drawnScale,g=scale-1,back=this.drawnBack*FORM_BACK;
      const sb=1+g*FORM_BOOM,sl=1+g*FORM_LIFT,ss=1+g*FORM_SIDE,sf=1+g*FORM_FOCUS,sa=1+g*FORM_AHEAD;
      size.boom=THREE.MathUtils.lerp(size.boom,bodyRig.boom*sb+back,k);
      size.lift=THREE.MathUtils.lerp(size.lift,bodyRig.lift*sl+back*DRAWN_RISE+g*FORM_RISE,k);
      size.shoulder=THREE.MathUtils.lerp(size.shoulder,bodyRig.shoulder*ss,k);
      size.focus=THREE.MathUtils.lerp(size.focus,bodyRig.focus*sf,k);
      // A juggle raises the point the lens looks at further than the lens
      // itself, so the view tilts up after the body instead of rising with it.
      // (Launch day: the arena camera stands back ARENA.apart of this for distance.)
      const apart=this.far*(1-this.arenaBlend*(1-ARENA.apart));
      const apartStrain=this.strain*(1-this.arenaBlend*(1-ARENA.strain));
      const standBoom=apart*FAR_BOOM+this.air*AIR_BOOM+apartStrain*STRAIN_BOOM+this.close*CLOSE_BOOM;
      const standLift=apart*FAR_LIFT-this.air*AIR_LIFT+apartStrain*STRAIN_LIFT+this.close*CLOSE_LIFT;
      size.boom+=k*(LOCK_BOOM+standBoom)*sb;
      size.lift+=k*(LOCK_LIFT+standLift)*sl;
      size.shoulder+=k*LOCK_SHOULDER*ss;
      size.focus+=k*(LOCK_FOCUS+this.air*AIR_FOCUS)*sf;
      this.lockLook=k;this.lockAhead=k*LOCK_AHEAD*sa;
      // Kurobi has a rig of its own (round 3e, see FOX_LOCK), eased in as the
      // fox shows and out as it goes.
      const foxShown=fox&&self.model?.visible===false;
      this.foxness=placed?(foxShown?1:0):this.foxness+((foxShown?1:0)-this.foxness)*blend(FOX_RATE,dt);
      if(this.foxness<1e-3)this.foxness=0;
      if(this.foxness>0){
        const w=this.foxness*k;
        size.boom=THREE.MathUtils.lerp(size.boom,FOX_LOCK.boom+standBoom*sb,w);
        size.lift=THREE.MathUtils.lerp(size.lift,FOX_LOCK.lift+standLift*sl,w);
        size.shoulder=THREE.MathUtils.lerp(size.shoulder,FOX_LOCK.shoulder,w);
        size.focus=THREE.MathUtils.lerp(size.focus,FOX_LOCK.focus+this.air*AIR_FOCUS*sf,w);
        this.lockAhead=THREE.MathUtils.lerp(this.lockAhead,k*FOX_LOCK.ahead,this.foxness);
      }
      // Round 4: the dynamic camera's own offsets (CameraBrain): wider than
      // lock-on's, back and up for a group, a run, a juggle, a ground smash or
      // a body on the floor, and over whichever shoulder it has chosen.
      if(this.dynBlend>0){
        const d=this.dynBlend,b=this.brain,a=this.arenaBlend;
        const high=Number.isFinite(this.floorMe)?smooth(self.group.position.y-this.floorMe,AIR_FREE,BIG_AIR_HIGH):0;
        const bigAir=this.bigness()*high*Math.max(1,scale-1);
        // Launch day, the arena camera (ARENA): its own stand-back, height and shoulder over the dynamic rig's - further
        // back in the Classic style, higher and all but off the shoulder at arm's length - with a share of the group's
        // stand-back and none of the brain's own change of shoulder (the arena's side is `sideEase`). Zero in every other
        // mode, where these are the dynamic rig's offsets to the digit.
        const boom=b.boom+a*(ARENA.boom+(this.style!=='close'?ARENA.back:0)-b.group*GROUP_BOOM*(1-ARENA.group));
        const lift=b.lift+a*(ARENA.lift+this.close*ARENA.meleeLift+(1-Math.abs(this.sideEase))*SIDE_LIFT-b.group*GROUP_LIFT*(1-ARENA.group)-(1-Math.abs(b.side))*SIDE_LIFT);
        size.boom+=d*(boom*sb+FORM_DYN_BOOM*Math.max(0,g)+BIG_AIR_BOOM*bigAir);size.lift+=d*(lift*sl+BIG_AIR_LIFT*bigAir);size.focus+=d*b.focus*sf;
        const own=size.shoulder*(1+(b.side-1)*d);
        size.shoulder=a>0?THREE.MathUtils.lerp(own,(size.shoulder+(ARENA.side-this.close*ARENA.meleeSide)*ss+this.slideEase.value)*this.sideEase,a):own;this.lockAhead+=d*b.ahead*sa;
      }
    }else{this.lockLook=0;this.lockAhead=0;this.foxness=0;}
    if(this.battlefield){size.boom+=1.5;size.lift+=.15;size.focus+=.3;}
    // The ball modes' broadcast lift (main.ts sets it): further back and higher, looking down on the play.
    if(this.wide>0){size.boom+=this.wide;size.lift+=this.wide*.55;size.focus+=this.wide*.12;}
    if(this.styleBlend>0)closeStyleRig(size,this.styleBlend,Math.tan(THREE.MathUtils.degToRad(this.baseFov)/2)*this.camera.aspect);
    this.boom=THREE.MathUtils.lerp(this.boom,size.boom,alpha);
    this.lift=THREE.MathUtils.lerp(this.lift,size.lift,alpha);
    this.shoulder=THREE.MathUtils.lerp(this.shoulder,size.shoulder,alpha);this.slideNow=THREE.MathUtils.lerp(this.slideNow,this.slideEase.value*this.arenaBlend,alpha);
    this.focusHeight=THREE.MathUtils.lerp(this.focusHeight,size.focus,alpha);
    this.forward.set(Math.sin(this.yaw),0,Math.cos(this.yaw));
    this.right.set(-Math.cos(this.yaw),0,Math.sin(this.yaw));
    this.focus.copy(this.anchor).addScaledVector(UP,this.focusHeight);
    // Launch night: where the stage's bound leaves no room behind, the dynamic rig is squeezed toward the player's
    // own body (SQUEEZE_*) - the stand-back, the shoulder and the look's reach together, so the look still runs along
    // the heading. Zero in the other modes, with room, and where the view is the squad's (Arcade Survival, the
    // objectives, the rift: their camera stays as it is): the arithmetic below is then exactly what it was.
    const keep=1-(this.dynBlend>0&&!this.battlefield?this.squeezeFor(dt,placed,pitch):(this.squeeze=0)),boom=keep<1?this.boom*keep:this.boom,shoulder=keep<1?this.shoulder*Math.pow(keep,SQUEEZE_SIDE):this.shoulder;
    this.desired.copy(this.focus).addScaledVector(this.forward,-boom*Math.cos(pitch))
      .addScaledVector(this.right,shoulder).addScaledVector(UP,this.lift+Math.sin(pitch)*boom);
    // Maintain a readable full-body distance even in corners. Scenery
    // between this position and the player receives a local render cutaway.
    this.camera.position.copy(this.desired);
    // Fixed shoulder composition does not chase an opponent or move on a punch.
    // Navigation uses this exact horizontal view, before cosmetic shake.
    // Locked on, the look runs parallel to the heading (the full shoulder
    // across, and ahead of the player), so the view direction IS the heading.
    this.probe.copy(this.focus).addScaledVector(this.right,shoulder*.25);
    if(this.lockLook>0)this.probe.addScaledVector(this.right,shoulder*.75*this.lockLook).addScaledVector(this.forward,keep<1?this.lockAhead*(1-SQUEEZE_AHEAD*(1-keep)):this.lockAhead);
    // The room can shorten the boom substantially. Frame from that actual
    // lens, rather than solving a distant shot and then pushing through it.
    this.rig.bounded=this.dynBlend>0?this.keepInside():0;
    // The ball cam (keepInView) never stands behind an end wall, where the goal's netting filled the view: it comes in
    // along its line of sight (the side walls' glass it may still stand past).
    if(this.keepInView)this.rig.bounded+=this.keepInside(false,1,BALL_CAM_ENDS);
    this.desired.copy(this.camera.position);
    let edgeGoal=0;
    if(this.dynBlend>0&&this.stageBounds){
      const b=this.stageBounds,out=boundOut(b,this.battlefield);
      const clearance=Math.min(b.halfX+out-Math.abs(this.desired.x),b.halfZ+out-Math.abs(this.desired.z));
      edgeGoal=(1-smooth(clearance,EDGE_NEAR,EDGE_CLEAR))*this.dynBlend;
    }
    this.edgeRoom=placed?edgeGoal:this.edgeRoom+(edgeGoal-this.edgeRoom)*blend(EDGE_RATE,dt);
    if(this.edgeRoom<1e-4){this.edgeRoom=0;this.squeezeLift=0;}
    if(this.edgeRoom>0){
      const rise=Math.max(0,position.y-this.floorMe);
      const tight=this.edgeRoom;
      const climb=position.y-Math.max(0,rise-AIR_FREE)*(1-AIR_SHARE)*(1-this.bigness())*this.dynBlend;
      // Near the wall the lens cannot use distance to hide vertical lag.
      // Cancel only that lag, including the landing frame, to keep the feet.
      const lag=(climb-this.anchor.y)*tight;
      const reach=(position.x-this.desired.x)*this.forward.x+(position.z-this.desired.z)*this.forward.z;
      // Launch night: what the stand-back lost is risen for at SQUEEZE_RISE a second, not on the frame. Backing toward
      // the edge of a floor with room at a run takes the room at 7 m/s, and the lens, risen as fast, pitched down 35
      // degrees in an eighth of a second (measured, scripts/night/camera: the aim at 400 deg/s). A jump's own rise is
      // still followed at once, as it was.
      const compressed=Math.max(0,(NORMAL.boom+LOCK_BOOM)*(1+(CLOSE_STYLE.boom-1)*this.styleBlend)-reach);
      this.squeezeLift=placed||this.battlefield?compressed:this.squeezeLift+(compressed-this.squeezeLift)*blend(SQUEEZE_RISE,dt);
      // (Launch day: the arena camera turns along a wall before it squeezes, and rises ARENA.rise of this for what is left.)
      const lift=Math.min(EDGE_AIR_MAX,this.squeezeLift*(1-this.arenaBlend*(1-ARENA.rise))+rise*EDGE_AIR_SHARE)*tight;
      this.desired.y+=lift+lag;this.camera.position.y+=lift+lag;this.probe.y+=lag;
    }
    // Locked on, the pair is held inside the frame vertically too. It moves
    // the lens only along the heading and the look only up or down, so the
    // view direction below is still the heading.
    if(this.lockBlend>0)this.frame(dt,placed,self,foe,fox?8/4.5:large?7.5/4.5:1);
    else{this.tilt.value=this.tilt.velocity=this.pull.value=this.pull.velocity=this.widen.value=this.widen.velocity=0;}
    // Round 4b: inside the play bounds on an open stage (BOUND_*), along the line of sight.
    this.rig.bounded+=this.dynBlend>0?this.keepInside():0;
    this.movementYaw=Math.atan2(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z);
    this.tiltFor(dt,placed,position);
    this.camera.lookAt(this.probe);
    // Lock combat's preview (game/lockCombat.ts): an exchange filmed close on the pair (see comboFrame).
    this.comboFrame(dt,placed,self,foe,occluders);
    // Round 4: the dynamic camera's field moves gently with a dash, a run and
    // a group (CameraBrain BASE_FOV); every other mode keeps the fixed 50.
    if(this.dynBlend>0)this.baseFov=THREE.MathUtils.lerp(this.baseFov,closeStyleFov(50+this.sportFov+(this.brain.fov-50-this.arenaBlend*this.brain.group*GROUP_FOV*(1-ARENA.group)+Math.min(FORM_DYN_FOV_MOST,FORM_DYN_FOV*Math.max(0,this.drawnScale-1)))*this.dynBlend,this.styleBlend),placed?1:blend(3,dt));
    else this.baseFov=THREE.MathUtils.lerp(this.baseFov,closeStyleFov(50+this.sportFov,this.styleBlend),placed?1:blend(10,dt));
    if(this.lockBlend>0){
      // The lens the next frame's occlusion check is judged from.
      this.lensY=this.camera.position.y;
      this.lookPitch=Math.atan2(this.probe.y-this.camera.position.y,Math.hypot(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z));
      this.tanV=Math.tan(THREE.MathUtils.degToRad(this.baseFov)/2);this.tanH=this.tanV*this.camera.aspect;
      this.rig.cover=foe&&this.framed>0?this.coverage(this.yaw,pitch):0;
      if(!(foe&&this.framed>0))this.coverMine=0;
    }else{this.rig.cover=0;this.coverMine=0;}
    this.director.enabled=this.cinematics;
    // (Launch day: the arena camera has no Close lens, but its Close style keeps the awakening's close-up.)
    this.director.closeStyle=this.styleBlend>.5||(this.arenaBlend>.5&&this.style==='close');
    // The finisher's shot (FinisherCuts) has the view from the confirm until it has handed it back: the director stands aside.
    this.director.ceded=this.cuts.owns;
    const lens=this.baseFov+this.widen.value*this.lockBlend;
    // The shots are sized for the body as drawn, a form shown for one move
    // included (see drawnBulk); the gameplay rig above keeps the size the
    // owner approved.
    // Round 4: in dynamic mode only a real turn hands an authored shot back
    // (see DIRECTOR_TURN), not a nudge.
    let shot=this.director.apply(dt,this.camera,self,this.desired,this.probe,lens,occluders,drawnBulk(self),this.dynBlend>.5?this.turnMemory>DIRECTOR_TURN:turned,foe);
    // The feel pass: an ultimate's cinema (FinisherCuts) - the bars and the grade, and a hit-confirmed
    // ultimate's finisher filmed in one move; the cosmetic layers below still shake it.
    this.cuts.enabled=this.cinematics&&this.finisherCuts;
    const filmed=this.cuts.apply(dt,this.camera,self,this.director.crowd,occluders,drawnBulk(self));
    if(filmed)shot=1;
    // The aperture runs from wherever the lens is to what it is looking at,
    // so a shot from the front of the fighter keeps its own line clear. Round
    // 4: from the player's own body, not the rig a run's look-ahead carried.
    const at=this.dynBlend>0?this.bodyFocus.set(this.focus.x-this.leadNow.x,this.focus.y,this.focus.z-this.leadNow.z):this.focus;
    setCameraCutaway(this.camera.position,shot>0?this.cutFocus.lerpVectors(at,filmed?this.cuts.pivot:this.director.pivot,shot):at,position.y,fox?3.8:large?2.7:1.35,this.cutTargeting&&shot<.5?this.cutTarget:undefined);
    // Everything below is cosmetic: it moves the picture, never movementYaw.
    const scale=THREE.MathUtils.clamp(Number.isFinite(shake)?shake*2:0,0,2);
    const frozen=this.hold>0||!!self.state.hitstop;
    this.hold=Math.max(0,this.hold-dt);
    if(!frozen)this.punchGoal*=Math.exp(-8*dt);
    this.punch+=(this.punchGoal-this.punch)*blend(this.punch<this.punchGoal?35:14,dt);
    if(this.punchGoal<1e-3&&this.punch<1e-3)this.punch=this.punchGoal=0;
    // Round 4: the dynamic camera's gameplay shots (CameraBrain PLAY_*).
    const played=this.dynBlend>0?this.playShots(dt,self,shot):(this.director.cueCount=0);
    this.camera.fov=(shot>0?this.camera.fov:lens)-this.punch*scale+played;
    this.camera.updateProjectionMatrix();
    if(this.kickHold>0){this.kickHold=Math.max(0,this.kickHold-dt);dampedVector(this.kick,this.kickVelocity,this.kickGoal,KICK_OUT,dt);}
    else{this.kickGoal.set(0,0,0);dampedVector(this.kick,this.kickVelocity,ZERO,KICK_BACK,dt);}
    if(scale>0&&this.kick.lengthSq()>1e-10){
      // Across and up the frame the lens turns after the blow; along the view
      // it dips, which is what a blow driven straight away from the camera
      // - the commonest hit there is - reads as.
      const q=this.camera.quaternion;
      const across=this.kick.dot(this.axis.set(1,0,0).applyQuaternion(q)),up=this.kick.dot(this.axis.set(0,1,0).applyQuaternion(q)),along=this.kick.dot(this.axis.set(0,0,-1).applyQuaternion(q));
      this.camera.position.addScaledVector(this.kick,scale);
      this.camera.rotateY(-across*KICK_TURN*scale);this.camera.rotateX((up-along)*KICK_TURN*scale);this.camera.rotateZ(-across*KICK_ROLL*scale*(1-this.comboBlend));
    }else if(this.kick.lengthSq()<=1e-10){this.kick.set(0,0,0);this.kickVelocity.set(0,0,0);}
    // Round 4b: and inside the bounds still, after the cosmetic layers (BOUND_*).
    if(this.dynBlend>0&&shot<.5)this.rig.bounded+=this.keepInside(true);
    this.age+=dt;this.trauma=Math.max(0,this.trauma-dt*3);
    const amount=this.trauma*this.trauma*shake*NOISE;
    // (The Chase combo shot shakes without the roll: the critic read it as the lens rolling after the finisher.)
    if(amount>1e-5){this.camera.rotateX(Math.sin(this.age*31)*amount);this.camera.rotateZ(Math.sin(this.age*27)*amount*.5*(1-this.comboBlend));}
    this.camera.updateMatrixWorld();this.initialized=true;
    // What stands in the way of who the shot is about thins out of it.
    this.fader.shotVictim=this.director.shotVictim;this.fader.shotHidden=this.director.victimBehindCaster;
    this.fader.selfCover=this.coverMine*this.lockBlend;
    // At first contact simulation may mark a victim launched while the drawn
    // body is held on the floor. Keep that exact hitstop window eligible;
    // an actual airborne body or an authored shot retains ordinary fading.
    const groundedFoe=!!foe&&(foe.state.grounded||!!foe.state.hitstop&&Math.abs(this.foeBox.low-this.meBox.low)<.18&&Math.abs(foe.group.position.y-position.y)<.2);
    this.fader.closeManual=dynamic&&locked&&this.brain.mode==='duel'&&self.state.grounded&&groundedFoe&&SWINGS.has(self.state.action)&&shot===0&&this.director.kind==='none'&&!this.cuts.owns&&foe
      ?1-smooth(Math.hypot(foe.group.position.x-position.x,foe.group.position.z-position.z),CLOSE_FAR,ENGAGE_RANGE):0;
    this.fader.stage.room=this.room;
    if(this.fading)this.fader.update(dt,this.camera,this.director.crowd,self,foe,this.director.focus);
    const rig=this.rig;rig.mode=this.mode;rig.assist=this.assist;rig.heading=this.heading;rig.shot=this.director.phase;rig.shotWeight=shot;rig.punch=this.punch*scale;rig.kick=this.kick.length()*scale;
    rig.tilt=this.tilt.value*this.lockBlend;rig.pull=this.pull.value*this.lockBlend;rig.widen=this.widen.value*this.lockBlend;rig.dodge=this.dodge.value;rig.engage=this.engage;rig.faded=this.fader.state.faded;rig.fadeMost=this.fader.state.most;rig.fadeWindow=this.fader.state.window;rig.fadeTwinned=this.fader.state.twinned;rig.fadeRoom=this.fader.state.room;rig.stageFront=this.fader.stage.state.front;rig.stageTarget=this.fader.stage.state.target;
    rig.brain=this.dynBlend>0?this.brain.mode:'off';rig.yieldTo=this.brain.yieldTo*this.dynBlend;rig.group=this.brain.group*this.dynBlend;rig.side=this.dynBlend>0?(this.arenaBlend>.5?this.sideEase:this.brain.side):1;rig.play=this.play??'none';rig.fov=this.baseFov;
    rig.focus=foe?.state.id??'';rig.styleBlend=this.styleBlend;rig.switching=this.brain.switching*this.dynBlend;rig.edge=this.edgeRoom;rig.small=smallFloor(this.stageBounds);rig.squeeze=this.squeeze;
    rig.arena=this.arenaBlend;rig.hold=this.holding*this.arenaBlend;rig.own=this.own;rig.away=this.away;
  }

  /** Raises the look (the probe, only in height) so `keepInView` sits inside the top of the frame, as far as the player's
   *  feet allow; eased, so a ball bouncing about does not shake the view. */
  private tiltFor(dt:number,placed:boolean,feet:THREE.Vector3){
    const k=this.keepInView,c=this.camera.position,p=this.probe;
    let want=0;
    const flat=Math.hypot(p.x-c.x,p.z-c.z);
    if(k&&flat>.5){
      const fx=(p.x-c.x)/flat,fz=(p.z-c.z)/flat,ahead=(k.x-c.x)*fx+(k.z-c.z)*fz;
      if(ahead>.5){
        const half=THREE.MathUtils.degToRad(this.camera.fov)/2,look=Math.atan2(p.y-c.y,flat);
        const ball=Math.atan2(k.y-c.y,Math.max(.5,Math.hypot(k.x-c.x,k.z-c.z))),floor=Math.atan2(feet.y-c.y,flat);
        // The ball inside the top of the frame; the player's feet no lower than its bottom edge.
        want=THREE.MathUtils.clamp(ball-half*.7-look,0,Math.max(0,floor+half*.97-look));
      }
    }
    this.keepTilt=placed?want:this.keepTilt+(want-this.keepTilt)*blend(want>this.keepTilt?5:2.5,dt);
    if(this.keepTilt<1e-4){this.keepTilt=0;return;}
    p.y=c.y+Math.tan(Math.atan2(p.y-c.y,flat)+this.keepTilt)*flat;
  }

  /** 24 October 2026: the Smart camera's frame (SmartCamera.ts). Its rig decides where the lens stands, what it looks at
   *  and its field; everything laid over the gameplay shot afterwards - the director's authored shots, the finisher's cuts,
   *  the scenery cutaway, the impact camera, the gameplay shots, the occlusion fade - is the one every mode shares, run as
   *  `update` runs it. The other modes' blends rest at nothing meanwhile, and a switch either way is a cut. */
  private updateSmart(dt:number,self:Fighter,yaw:number,pitch:number,occluders:THREE.Object3D[],shake:number,opponent?:Fighter,locked=false){
    const position=self.group.position;
    const placed=!this.initialized||!this.smartWas||self.state.id!==this.subject||this.anchor.distanceToSquared(position)>100;
    // The player's own turn and tilt this frame: what the input holds past what this camera last handed back.
    const manual=placed?0:wrapped(yaw-this.inputYaw),tilt=placed?0:pitch-this.inputPitch;
    this.smartWas=true;
    this.lockBlend=this.dynBlend=this.arenaBlend=this.styleBlend=this.latchBlend=0;GHOST_FADE.value.x=0;
    this.assist=0;this.framed=0;this.squeeze=this.squeezeLift=this.edgeRoom=0;this.holding=0;this.holdId='';this.away=0;
    this.turnMemory=this.turnMemory*Math.exp(-dt/TURN_MEMORY)+Math.abs(manual);
    const foe=opponent?.state.alive?opponent:undefined;
    this.trackVelocity(dt,placed,position);
    if(placed||self.state.grounded)this.smartFloor=position.y;
    // The opponent's travel, off the presented root as the player's is.
    if(foe){
      const p=foe.group.position;
      if(placed||foe.state.id!==this.foeTracked||!(dt>0)){this.foeTravel.set(0,0,0);this.foeTracked=foe.state.id;}
      else{const dx=p.x-this.foeLast.x,dz=p.z-this.foeLast.z;if(dx*dx+dz*dz>TELEPORT*TELEPORT)this.foeTravel.set(0,0,0);else{const k=blend(VELOCITY_RATE,dt);this.foeTravel.x+=(dx/dt-this.foeTravel.x)*k;this.foeTravel.z+=(dz/dt-this.foeTravel.z)*k;}}
      this.foeLast.copy(p);
    }else this.foeTracked='';
    // Everybody else worth weighing (a royale's crowd, see `weighThreat`).
    this.smartThreatCount=0;this.gatherSelf=self;this.gatherFoe=foe;this.director.crowd?.forEach(this.weighThreat);this.gatherSelf=this.gatherFoe=undefined;
    const awakened=!!self.state.awakened,fox=awakened&&self.state.fighter==='konta',large=awakened&&LARGE_FORMS.has(self.state.fighter)||!!BODY_SIZE[self.state.fighter];
    const scale=Math.max(drawnBulk(self),BODY_SIZE[self.state.fighter]??1);
    const frozen=this.hold>0||!!self.state.hitstop;
    const i=this.smartIn,me=i.me,s=self.state;
    i.dt=dt;i.placed=placed;i.manual=manual;i.manualTilt=tilt;i.aspect=this.camera.aspect;i.frozen=frozen;i.sole=this.sole||locked;i.latched=this.basisMask>0;
    me.x=position.x;me.y=position.y;me.z=position.z;me.vx=this.travel.x;me.vz=this.travel.z;me.floor=this.smartFloor;me.scale=scale;me.high=this.drawnHeight(self);
    me.lying=s.action==='knockdown'||s.action==='getup'||(s.action==='splat'&&!!s.grounded);me.airborne=!s.grounded;
    if(foe){
      const f=this.smartFoeBody,p=foe.group.position,fs=foe.state;
      f.id=fs.id;f.x=p.x;f.y=p.y;f.z=p.z;f.vx=this.foeTravel.x;f.vz=this.foeTravel.z;f.high=this.drawnHeight(foe);
      f.lying=fs.action==='knockdown'||fs.action==='getup'||(fs.action==='splat'&&!!fs.grounded);f.airborne=!fs.grounded;i.foe=f;
    }else i.foe=undefined;
    i.threats=this.smartThreats;i.threatCount=this.smartThreatCount;
    if(this.stageBounds){const b=this.smartBound;b.halfX=this.stageBounds.halfX;b.halfZ=this.stageBounds.halfZ;b.out=boundOut(this.stageBounds,false);i.bound=b;}else i.bound=undefined;
    const rig=this.smart;rig.update(i);
    this.smartFoe=foe?.state.id??'';this.smartHeld=!!foe&&rig.engaged>.5;
    // The lens and the look as the rig has them. The view's heading is the horizontal line from the lens to the look.
    this.camera.position.set(rig.lensX,rig.lensY,rig.lensZ);this.probe.set(rig.lookX,rig.lookY,rig.lookZ);
    this.desired.copy(this.camera.position);this.camera.lookAt(this.probe);
    const before=this.movementYaw;
    this.heading=this.yaw=rig.heading;this.inputYaw=rig.heading;
    // The tilt is taken as a change each frame and the rig keeps its own: the input is handed back level.
    this.inputPitch=SMART_PITCH;
    this.movementYaw=Math.atan2(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z);
    // (The view's own turning since the keys went down, for a run read against the view: see `movementBasis`. The view's,
    // not the rig's heading: the hard limit drawing the look toward the player turns the view too, and until 25 October
    // 2026 that bent a run held on the keys - 42-101 deg/min in the harness's held directions, now none.)
    if(this.basisMask>0&&!placed)this.autoTurn+=wrapped(this.movementYaw-before-manual);
    this.forward.set(Math.sin(this.movementYaw),0,Math.cos(this.movementYaw));this.right.set(-Math.cos(this.movementYaw),0,Math.sin(this.movementYaw));
    this.anchor.copy(position);this.subject=s.id;this.lastBody=foe;
    this.baseFov=rig.fov;
    this.focus.set(position.x,position.y+CHEST_SMART*scale,position.z);
    if(occluders!==this.roomSource){this.roomSource=occluders;this.room=roomOf(occluders);this.coverAt=this.age+COVER_AGAIN;this.rig.covered=coverStage(occluders);}
    else if(this.age>=this.coverAt){this.coverAt=Infinity;this.rig.covered+=coverStage(occluders);}
    this.cutTargeting=!!foe&&rig.engaged>.5;
    if(foe)this.cutTarget.set(foe.group.position.x,foe.group.position.y+1.1,foe.group.position.z);
    this.rig.cover=0;this.coverMine=0;
    // The shared layers, as `update` lays them.
    this.director.enabled=this.cinematics;
    this.director.closeStyle=this.style==='close';
    this.director.ceded=this.cuts.owns;
    const lens=this.baseFov;
    let shot=this.director.apply(dt,this.camera,self,this.desired,this.probe,lens,occluders,drawnBulk(self),this.turnMemory>DIRECTOR_TURN,foe);
    this.cuts.enabled=this.cinematics&&this.finisherCuts;
    const filmed=this.cuts.apply(dt,this.camera,self,this.director.crowd,occluders,drawnBulk(self));
    if(filmed)shot=1;
    setCameraCutaway(this.camera.position,shot>0?this.cutFocus.lerpVectors(this.focus,filmed?this.cuts.pivot:this.director.pivot,shot):this.focus,position.y,fox?3.8:large?2.7:1.35,this.cutTargeting&&shot<.5?this.cutTarget:undefined);
    const amp=THREE.MathUtils.clamp(Number.isFinite(shake)?shake*2:0,0,2);
    this.hold=Math.max(0,this.hold-dt);
    if(!frozen)this.punchGoal*=Math.exp(-8*dt);
    this.punch+=(this.punchGoal-this.punch)*blend(this.punch<this.punchGoal?35:14,dt);
    if(this.punchGoal<1e-3&&this.punch<1e-3)this.punch=this.punchGoal=0;
    const played=this.playShots(dt,self,shot);
    this.camera.fov=(shot>0?this.camera.fov:lens)-this.punch*amp+played;
    this.camera.updateProjectionMatrix();
    if(this.kickHold>0){this.kickHold=Math.max(0,this.kickHold-dt);dampedVector(this.kick,this.kickVelocity,this.kickGoal,KICK_OUT,dt);}
    else{this.kickGoal.set(0,0,0);dampedVector(this.kick,this.kickVelocity,ZERO,KICK_BACK,dt);}
    if(amp>0&&this.kick.lengthSq()>1e-10){
      const q=this.camera.quaternion;
      const across=this.kick.dot(this.axis.set(1,0,0).applyQuaternion(q)),up=this.kick.dot(this.axis.set(0,1,0).applyQuaternion(q)),along=this.kick.dot(this.axis.set(0,0,-1).applyQuaternion(q));
      this.camera.position.addScaledVector(this.kick,amp);
      this.camera.rotateY(-across*KICK_TURN*amp);this.camera.rotateX((up-along)*KICK_TURN*amp);this.camera.rotateZ(-across*KICK_ROLL*amp);
    }else if(this.kick.lengthSq()<=1e-10){this.kick.set(0,0,0);this.kickVelocity.set(0,0,0);}
    this.age+=dt;this.trauma=Math.max(0,this.trauma-dt*3);
    const amount=this.trauma*this.trauma*shake*NOISE;
    if(amount>1e-5){this.camera.rotateX(Math.sin(this.age*31)*amount);this.camera.rotateZ(Math.sin(this.age*27)*amount*.5);}
    this.camera.updateMatrixWorld();this.initialized=true;
    this.fader.shotVictim=this.director.shotVictim;this.fader.shotHidden=this.director.victimBehindCaster;
    this.fader.selfCover=rig.selfCover;this.fader.closeManual=0;
    this.fader.stage.room=this.room;
    if(this.fading)this.fader.update(dt,this.camera,this.director.crowd,self,foe,this.director.focus);
    const r=this.rig;r.mode=this.mode;r.assist=rig.engaged;r.heading=rig.heading;r.shot=this.director.phase;r.shotWeight=shot;r.punch=this.punch*amp;r.kick=this.kick.length()*amp;
    r.tilt=rig.state.tilt;r.pull=rig.state.dolly;r.widen=0;r.dodge=0;r.engage=0;r.faded=this.fader.state.faded;r.fadeMost=this.fader.state.most;r.fadeWindow=this.fader.state.window;r.fadeTwinned=this.fader.state.twinned;r.fadeRoom=this.fader.state.room;r.stageFront=this.fader.stage.state.front;r.stageTarget=this.fader.stage.state.target;
    r.brain='smart';r.yieldTo=0;r.group=rig.state.group;r.side=Math.sign(rig.shoulder)||1;r.play=this.play??'none';r.fov=this.baseFov;
    r.focus=foe?.state.id??'';r.styleBlend=0;r.switching=0;r.edge=0;r.small=smallFloor(this.stageBounds);r.squeeze=0;r.bounded=rig.state.bounded;
    r.arena=0;r.hold=rig.engaged;r.own=rig.state.phi;r.away=rig.away;
    (r as Record<string,unknown>).smart={dolly:rig.state.dolly,need:rig.state.need,squeeze:rig.state.bounded,hard:rig.state.hard,meHigh:me.high,foeHigh:i.foe?.high??0,lo:rig.state.lo,hi:rig.state.hi};
  }
  /** How tall a body is as drawn, metres over its root (the Smart camera's fit): its crown off its joints (see `measure`),
   *  or - a form shown as its own model, a mech, a spirit looming - the top of its visible skinned meshes' own bounds, at
   *  most every DRAWN_EVERY seconds a body. The first blind critic of the Smart camera: a giant opponent "headless behind
   *  the health bar", framed as though it stood 1.95 m. */
  private drawnHeight(body:Fighter){
    const id=body.state.id,cached=this.smartHeights.get(id);
    if(cached&&this.age-cached.at<DRAWN_EVERY)return cached.high;
    const p=body.group.position,own=body.model?.visible!==false&&!!body.joints?.get('Head');
    let high:number;
    if(own){
      // The body's own model, posed: its crown off its head joint (see `measure`). (Its skinned meshes' bind-pose bounds are
      // no measure: Gummy's read 3.2 m, and the fit stood the lens back to its limit for a crown that was not there.)
      this.measure(body,drawnBulk(body),this.heightBox);high=this.heightBox.high-p.y;
    }else{
      // A form shown as its own model (Kurobi, a Colossus, a mech): what its visible skinned meshes reach.
      this.meshTopY=-Infinity;body.group.updateWorldMatrix(true,true);body.group.traverseVisible(this.meshTop);
      high=Number.isFinite(this.meshTopY)?this.meshTopY-p.y:CROWN*drawnBulk(body);
    }
    high=THREE.MathUtils.clamp(Number.isFinite(high)?high:CROWN,.5,HEIGHT_MOST);
    // Held at its peak and let down at HEIGHT_DECAY metres a second: a crouch, a swing or a blow's fold is a pose, not a
    // smaller body, and a fit that followed it would breathe with every animation.
    if(cached){cached.high=Math.max(high,cached.high-HEIGHT_DECAY*(this.age-cached.at));cached.at=this.age;return cached.high;}
    this.smartHeights.set(id,{at:this.age,high});
    return high;
  }
  private heightBox=capsule();private meshTopY=-Infinity;private meshBox=new THREE.Box3();
  private readonly smartHeights=new Map<string,{at:number;high:number}>();
  private meshTop=(o:THREE.Object3D)=>{
    const m=o as THREE.SkinnedMesh;if(!m.isSkinnedMesh||!m.geometry)return;
    if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
    this.meshBox.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);this.meshTopY=Math.max(this.meshTopY,this.meshBox.max.y);
  };
  /** The Smart camera's weighing of a body besides the one the shot is about (SmartCamera THREAT_*): attacking the player
   *  (Targeting's rule: aimed at them, mid-swing, within the move's range and three metres) SMART_ATTACK; having hit them
   *  lately up to SMART_HIT; simply near, up to SMART_NEAR - all of it fading from SMART_FROM to SMART_RANGE metres, and a
   *  body on the floor counting SMART_DOWN of itself. */
  private weighThreat=(body:Fighter)=>{
    const self=this.gatherSelf;
    if(!self||body===self||body===this.gatherFoe||!body.state.alive||!body.group.visible)return;
    if(self.state.team!==undefined&&body.state.team===self.state.team)return;
    const st=body.state,p=body.group.position,q=self.group.position,d=Math.hypot(p.x-q.x,p.z-q.z);
    if(d>SMART_RANGE)return;
    const attacking=ATTACKS.has(st.action)&&st.target===self.state.id&&d<(castThreat(st).move?.range??3)+3;
    // An attack counts in full for SMART_PRESS seconds after it was last seen and fades over as many again (CameraFocus's
    // ATTACK_HOLD), so a string's gaps between blows - or fighters taking turns - do not flicker the weights.
    if(attacking)this.smartPressed.set(st.id,this.age);
    const since=this.smartPressed.get(st.id),pressing=since===undefined?0:1-smooth(this.age-since,SMART_PRESS,SMART_PRESS*2);
    const hit=this.director.hitAgo(st.id);
    let w=SMART_ATTACK*pressing;
    if(hit<SMART_HIT_FOR)w=Math.max(w,SMART_HIT*(1-smooth(hit,SMART_HIT_FOR*.5,SMART_HIT_FOR)));
    w=Math.max(w,SMART_NEAR*(1-smooth(d,3,SMART_FROM)));
    w*=1-smooth(d,SMART_FROM,SMART_RANGE);
    const lying=st.action==='knockdown'||st.action==='getup'||(st.action==='splat'&&!!st.grounded);
    if(lying)w*=SMART_DOWN;
    if(w<.03)return;
    if(this.smartThreatCount>=this.smartThreats.length)this.smartThreats.push({id:'',x:0,y:0,z:0,high:CROWN,lying:false,airborne:false,weight:0});
    const t=this.smartThreats[this.smartThreatCount++];
    t.id=st.id;t.x=p.x;t.y=p.y;t.z=p.z;t.high=CROWN*drawnBulk(body);t.lying=lying;t.airborne=!st.grounded;t.weight=w;
  };

  private measureDrawn(dt:number,placed:boolean,self:Fighter,least:number){
    const other=!!self.state.awakened||self.model?.visible===false||!!BODY_SIZE[self.state.fighter],key=self.state.id;
    if(!other){this.drawnScaleGoal=least;this.drawnBackGoal=0;}
    else if(placed||key!==this.drawnOf||this.age-this.drawnAt>=DRAWN_EVERY){
      this.drawnAt=this.age;this.drawnOf=key;this.drawnTop=-Infinity;this.drawnMin=Infinity;
      self.group.updateWorldMatrix(true,false);this.drawnInverse.copy(self.group.matrixWorld).invert();
      self.group.traverseVisible(this.drawnMesh);
      // Round 3d: and the spirit looming over an awakened spirit's user (SPIRITS).
      this.drawnTop=Math.max(this.drawnTop,loomTop(key)||-Infinity);
      if(Number.isFinite(this.drawnTop)){
        this.drawnScaleGoal=THREE.MathUtils.clamp(this.drawnTop/DRAWN_TOP,least,Math.max(least,SCALE_MOST));
        this.drawnBackGoal=THREE.MathUtils.clamp(-this.drawnMin-DRAWN_BACK,0,BACK_MOST);
      }else{this.drawnScaleGoal=least;this.drawnBackGoal=0;}
    }
    if(placed||key!==this.subject){this.drawnScale=this.drawnScaleGoal;this.drawnBack=this.drawnBackGoal;}
    else{const k=blend(DRAWN_RATE,dt);this.drawnScale+=(this.drawnScaleGoal-this.drawnScale)*k;this.drawnBack+=(this.drawnBackGoal-this.drawnBack)*k;}
  }
  private drawnMesh=(object:THREE.Object3D)=>{
    const mesh=object as THREE.SkinnedMesh,position=mesh.geometry?.getAttribute('position');
    if(!mesh.isSkinnedMesh||!position||/-ink$|occlusion-warm/.test(mesh.name))return;
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    // A ghost - the Guardian round its user, a spirit, a clone - is drawn over
    // what is behind it without depth, and fades near the lens by itself: the
    // rig is the body's (round 3c; counted, the Guardian held its user's rig at
    // SCALE_MOST).
    if(!material||(material.transparent&&material.opacity<.5)||material.userData?.ink||material.depthWrite===false)return;
    const stride=Math.max(1,Math.floor(position.count/DRAWN_SAMPLES));
    for(let i=0;i<position.count;i+=stride){
      mesh.getVertexPosition(i,this.drawnCorner);mesh.localToWorld(this.drawnCorner).applyMatrix4(this.drawnInverse);
      this.drawnTop=Math.max(this.drawnTop,this.drawnCorner.y);this.drawnMin=Math.min(this.drawnMin,this.drawnCorner.z);
    }
  };
  /** `classic` as it is, or `close` as far into the Close style as the rig is. */
  private styleMix(classic:number,close:number){return this.styleBlend>0?classic+(close-classic)*this.styleBlend:classic;}
  /** The vertical framing, locked on (see FRAME_TOP). The goals are solved
   *  from the shot as composed - never from the tilt and pull already on it,
   *  so there is no loop to ring - and the least that works: first the tilt
   *  alone, and only when no tilt holds both bodies, the least stand-back that
   *  lets one. With no room for both even then, the player's own body wins. */
  private frame(dt:number,placed:boolean,self:Fighter,opponent:Fighter|undefined,bulk:number){
    const eye=this.desired,probe=this.probe,f=this.forward;
    const pitch=Math.atan2(probe.y-eye.y,Math.hypot(probe.x-eye.x,probe.z-eye.z));
    // The Close style (closeStyle.ts) keeps the promise - both bodies held, the opponent never lost - with the
    // room a bigger player needs; Classic's limits are the constants.
    // (Launch day: with the opponent in the air the arena camera lets the player's own feet sink, ARENA.sink - and at a
    // bound it could not turn along, ARENA.crop: the fighter cropped rather than the lens stood on end.)
    const frameTop=this.styleMix(FRAME_TOP,CLOSE_STYLE.top),myBottom=this.styleMix(MY_BOTTOM,CLOSE_STYLE.myBottom)+this.arenaBlend*(this.air*ARENA.sink+this.squeeze*ARENA.crop),foeBottom=this.styleMix(FOE_BOTTOM,CLOSE_STYLE.foeBottom),cardTop=this.styleMix(CARD_TOP,CLOSE_STYLE.cardTop);
    let tiltGoal=0,pullGoal=0;
    // How fast each body is rising, off the positions themselves, and the
    // floor the player last stood on.
    const me=self.group.position;
    if(placed||!(dt>0)||opponent!==this.lastBody){this.lastFoe=NaN;this.riseFoe=0;this.lastBody=opponent;}
    if(placed||!(dt>0)){this.lastMe=NaN;this.riseMe=0;}
    if(placed||self.state.grounded)this.floorMe=me.y;
    if(dt>0){
      this.riseMe=Number.isFinite(this.lastMe)?this.riseMe+((me.y-this.lastMe)/dt-this.riseMe)*blend(RISE_RATE,dt):0;this.lastMe=me.y;
      // The opponent's rise is its drawn crown's: a launch clip throws the
      // body up off its root as the root itself rises, and a head a metre
      // over the root climbs half again as fast as the root does.
      if(opponent){const y=this.foeBox.high;this.riseFoe=Number.isFinite(this.lastFoe)?this.riseFoe+((y-this.lastFoe)/dt-this.riseFoe)*blend(RISE_RATE,dt):0;this.lastFoe=y;}
    }
    let weight=0,shareFoe=foeBottom;
    if(opponent){
      const them=opponent.group.position,s=opponent.state;
      if(s.grounded)this.floorFoe=them.y;
      const lying=s.action==='knockdown'||s.action==='getup'||(s.action==='splat'&&s.grounded)||(s.action==='launched'&&!s.grounded&&this.riseFoe<0&&them.y-this.floorFoe<LIE_AHEAD);
      this.down=placed?(lying?1:0):this.down+((lying?1:0)-this.down)*blend(LIE_RATE,dt);
      this.reachMe=(me.x-eye.x)*f.x+(me.z-eye.z)*f.z;this.reachFoe=(them.x-eye.x)*f.x+(them.z-eye.z)*f.z;
      // An opponent level with the lens or behind it is not in this shot at
      // all; the heading assist brings them round first.
      weight=this.framed*smooth(this.reachFoe,2,3.5);
      if(weight>0){
        const tan=Math.tan(THREE.MathUtils.degToRad(this.baseFov)/2),up=Math.atan(frameTop*tan);
        // The opponent's feet keep clear of the skill cards only where the
        // opponent stands over them - a body centred in the gap between the
        // key strip and the cards shows its feet there, as the concept's
        // does - eased across the cards' edge so the limit never steps.
        // Judged by the part of them furthest right, not their middle: a body
        // lying on the floor spans a metre and more across the frame, and its
        // middle a hand left of the cards' edge left its hips behind them.
        const box=this.foeBox,side=(box.x-eye.x)*this.right.x+(box.z-eye.z)*this.right.z+box.spread,depth=Math.max(.5,(box.x-eye.x)*f.x+(box.z-eye.z)*f.z);
        const card=smooth(side/(depth*tan*this.camera.aspect),CARD_LEFT-CARD_EASE,CARD_LEFT+CARD_EASE);
        shareFoe=THREE.MathUtils.lerp(foeBottom,cardTop,card)-LIE_MARGIN*this.down;
        const downMe=Math.atan(myBottom*tan),downFoe=Math.atan(shareFoe*tan);
        this.lowMe=this.meBox.low-eye.y;this.highMe=this.meBox.high-eye.y;
        // Lying along the floor, the near end of the body is the low point
        // on screen (see SPREAD_FROM).
        // (Launch day: in the arena camera only a body that is down - struck, launched, on the floor - is taken to lie along
        // it. A run's stride spreads the feet as far, and with the fighter a third of the way in from the frame's side -
        // further still where a bound has turned the lens - the breadth below was widened for at every step: filmed
        // along the Proving Hall's wall, the field breathing between 50 and 62 degrees.)
        const mb=this.meBox;this.lyingMe=smooth(mb.spread,SPREAD_FROM,SPREAD_FULL)*(REACTIONS.has(self.state.action)?1:1-this.arenaBlend);
        this.reachMeLow=Math.max(.5,THREE.MathUtils.lerp(this.reachMe,(mb.x-eye.x)*f.x+(mb.z-eye.z)*f.z-mb.spread,this.lyingMe));
        // A spirit looming over the player: its crown where it hovers (see
        // LOOM_CROWN), taken at their depth for the same angle.
        if(Number.isFinite(this.loomHigh)){
          const yaw=self.state.yaw,sx=me.x-Math.sin(yaw)*LOOM_BACK+Math.cos(yaw)*LOOM_LEFT,sz=me.z-Math.cos(yaw)*LOOM_BACK-Math.sin(yaw)*LOOM_LEFT;
          const reach=Math.max(.5,(sx-eye.x)*f.x+(sz-eye.z)*f.z);
          this.highMe=Math.max(this.highMe,(this.loomHigh-eye.y)*Math.max(this.reachMe,.5)/reach);
        }
        // A body on its way up is in the air, so it is falling as it rises:
        // the top of its arc, if that comes within LEAD. A player coming down
        // drops the lens with them, which lifts the opponent in the frame.
        const rise=this.riseFoe,drop=self.state.grounded?0:THREE.MathUtils.clamp(.5*LAUNCH_FALL*LEAD*LEAD-this.riseMe*LEAD,0,Math.max(0,me.y-this.floorMe));
        const lead=(rise<=0?0:rise<LAUNCH_FALL*LEAD?rise*rise/(2*LAUNCH_FALL):rise*LEAD-.5*LAUNCH_FALL*LEAD*LEAD)+drop;
        this.lowFoe=box.low-eye.y;this.highFoe=box.high-eye.y+lead;
        // (Launch day: the arena camera stands back ARENA.pull of this at most. With the opponent overhead the camera
        // looks up and lets the player's own fighter sink in the frame; a lens six metres off made them a quarter of it.)
        let back=0;const most=PULL_MAX*(1-this.arenaBlend*(1-ARENA.pull));
        if(!this.bounds(0,up,downMe,downFoe)){
          if(!this.bounds(most,up,downMe,downFoe))back=most;
          else{let lo=0,hi=most;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(this.bounds(mid,up,downMe,downFoe))hi=mid;else lo=mid;}back=hi;}
        }
        // The tilt is solved against the stand-back the lens actually has,
        // not the one it is heading for: the pull is the slower of the two,
        // and a tilt that counted on all of it would drop the player's feet
        // out of the frame while it arrived.
        this.bounds(this.pull.value*this.lockBlend,up,downMe,downFoe);
        const lower=Math.max(this.fromMe,this.fromFoe),upper=Math.min(this.toMe,this.toFoe);
        const want=lower<=upper?THREE.MathUtils.clamp(pitch,lower,upper):THREE.MathUtils.clamp(THREE.MathUtils.clamp(pitch,this.fromFoe,this.toFoe),this.fromMe,this.toMe);
        tiltGoal=weight*THREE.MathUtils.clamp(want-pitch,-TILT_DOWN,TILT_UP);
        // A pull through the wall would be removed again after framing and
        // invalidate these angles. The constrained shot uses the lift above.
        pullGoal=this.edgeRoom>0?0:weight*back;
      }
    }
    if(placed){this.tilt.value=tiltGoal;this.pull.value=pullGoal;this.tilt.velocity=this.pull.velocity=0;this.landed=LAND_HOLD;}
    else{
      // The landing is held a beat (LAND_HOLD) before any of it is let go,
      // and then it is let go slowly: a body bouncing through a juggle does
      // not bob the shot with it.
      if(tiltGoal!==0||pullGoal!==0)this.landed=0;else this.landed+=dt;
      if(this.landed>0&&this.landed<LAND_HOLD&&weight>0){tiltGoal=this.tilt.value;pullGoal=this.pull.value;}
      // Letting go is slow; a goal on the other side of level is not letting
      // go but a new take-up - the body that was held up in the air now
      // lying on the floor under the cards - and goes at the full rate.
      // Unless the player's own body is out as the lens now stands (see
      // SPREAD_FROM): that is not a juggle settling.
      const now=pitch+this.tilt.value*this.lockBlend,meOut=weight>0&&(now>this.toMe+.01||now<this.fromMe-.01);
      const easeTilt=!meOut&&Math.abs(tiltGoal)<Math.abs(this.tilt.value)&&tiltGoal*this.tilt.value>=0?LET_GO:1,easePull=pullGoal<this.pull.value?LET_GO:1;
      approach(this.tilt,tiltGoal,dt,TILT_SPEED*easeTilt,TILT_ACCEL,TILT_GAIN*easeTilt,this.turning,this.turnSteps);
      // (Launch day, the arena camera: and never past what a goal can be, whatever carried it there.)
      if(this.arenaBlend>0&&(this.tilt.value<-TILT_DOWN||this.tilt.value>TILT_UP)){this.tilt.value=THREE.MathUtils.clamp(this.tilt.value,-TILT_DOWN,TILT_UP);this.tilt.velocity=0;}
      approach(this.pull,pullGoal,dt,PULL_SPEED*easePull,PULL_ACCEL,PULL_GAIN*easePull);
    }
    // Applied as far into the lock-on as the rig is, so a change of mode
    // carries it out with the rest of the composition.
    const k=this.lockBlend,tilt=this.tilt.value*k,pull=this.pull.value*k;
    if(tilt!==0||pull!==0){
      eye.addScaledVector(f,-pull);this.camera.position.copy(eye);
      probe.y=eye.y+Math.hypot(probe.x-eye.x,probe.z-eye.z)*Math.tan(pitch+tilt);
    }
    // Whatever the tilt and the stand-back have not caught up with yet, the
    // lens widens for (see WIDEN_MOST): the field that holds both bodies'
    // crowns under the HUD's bars and their feet in the frame with the lens
    // where it is now. The skill cards are the tilt's business alone: the
    // tilt lets a juggle go slowly, and a widen that made up for its last
    // degrees on the ground held the lens wide for a second after landing.
    // Except for a victim lying down (see LIE_MARGIN): the tilt takes a
    // quarter of a second to turn from holding a juggle up to holding a body
    // on the floor down, and for that quarter second the body lay behind the
    // cards (measured in training: Ouga's rush, 0.37 s). The widen covers
    // it, and lets go as they get up.
    let widenGoal=0;
    if(weight>0){
      const floorShare=THREE.MathUtils.lerp(foeBottom,Math.min(foeBottom,shareFoe),this.down);
      // How far across the frame the victim reaches from the view (see
      // SIDE_SHARE), from the lens where it now stands.
      const box=this.foeBox,bx=box.x-eye.x,bz=box.z-eye.z,ahead=bx*f.x+bz*f.z;
      const across=Math.abs(bx*this.right.x+bz*this.right.z)+box.radius+box.spread;
      const side=ahead>.3?THREE.MathUtils.radToDeg(2*Math.atan(across/ahead/(SIDE_SHARE*this.camera.aspect))):0;
      // And the player's own breadth, as far as they lie along the floor (see
      // SPREAD_FROM): what that needs past the lens's own field, in degrees.
      let sideMe=0;
      if(this.lyingMe>0){
        const mb=this.meBox,mx=mb.x-eye.x,mz=mb.z-eye.z,front=mx*f.x+mz*f.z;
        if(front>.3)sideMe=this.lyingMe*Math.max(0,THREE.MathUtils.radToDeg(2*Math.atan((Math.abs(mx*this.right.x+mz*this.right.z)+mb.radius+mb.spread)/front/(SIDE_SHARE*this.camera.aspect)))-this.baseFov);
      }
      const look=pitch+tilt,need=Math.max(side,
        widenFor(this.highFoe,this.reachFoe+pull,look,frameTop),widenFor(this.highMe,this.reachMe+pull,look,frameTop),
        widenFor(-this.lowFoe,this.reachFoe+pull,-look,floorShare),widenFor(-this.lowMe,this.reachMeLow+pull,-look,myBottom));
      // Launch night, second pass: and up to SQUEEZE_WIDEN degrees more as the stage's bound squeezes the rig. With the
      // fighter's back to a wall the lens stands two metres behind and nearly three up: their feet are 55 degrees
      // under the horizon and the crown of an opponent across the room 5 - a span of 50 degrees, where the frame holds
      // 46 between the HUD's bands at WIDEN_MOST (measured in the Proving Hall: the opponent's head under the health bars or
      // out of the top). No height of lens closes it (42 to 50 degrees from a metre and a half up to three and a half);
      // a wider lens does.
      widenGoal=weight*THREE.MathUtils.clamp(Math.max(need-this.baseFov,sideMe),0,WIDEN_MOST+SQUEEZE_WIDEN*this.squeeze);
    }
    if(placed){this.widen.value=widenGoal;this.widen.velocity=0;}
    else{const ease=widenGoal<this.widen.value?LET_GO:1;approach(this.widen,widenGoal,dt,WIDEN_SPEED*ease,WIDEN_ACCEL,WIDEN_GAIN*ease);}
  }
  /** The drawn bounds of `body` this frame into `out` (see TORSO and
   *  HEAD_PAD): its torso's centre off the hips and head, what it spans off
   *  its head and feet, whichever way up it is; a body without the joints, or
   *  showing a form's model, is its root to CROWN over it. */
  private measure(body:Fighter,bulk:number,out:Capsule){
    const joints=body.joints,p=body.group.position;let low=Infinity,high=-Infinity;
    out.x=p.x;out.z=p.z;out.radius=TORSO*bulk;out.spread=0;
    if(joints&&body.model?.visible!==false){
      let seen=0;
      for(let i=0;i<SPAN_JOINTS.length;i++){
        const name=SPAN_JOINTS[i],bone=joints.get(name);if(!bone)continue;
        bone.getWorldPosition(this.joint);const pad=name==='Head'?HEAD_PAD*bulk:SOLE_PAD;
        low=Math.min(low,this.joint.y-pad);high=Math.max(high,this.joint.y+pad);
        if(name==='Head'){out.x=this.joint.x;out.z=this.joint.z;}
        this.spanX[seen]=this.joint.x;this.spanZ[seen++]=this.joint.z;
      }
      const hips=joints.get('Hips');
      if(hips&&joints.get('Head')){hips.getWorldPosition(this.joint);out.x=(out.x+this.joint.x)/2;out.z=(out.z+this.joint.z)/2;}
      else{out.x=p.x;out.z=p.z;}
      // How far across the floor the body reaches from that axis: a hand's
      // breadth standing, a body's length lying down.
      for(let i=0;i<seen;i++)out.spread=Math.max(out.spread,Math.hypot(this.spanX[i]-out.x,this.spanZ[i]-out.z));
    }
    if(!(high>=low)){low=p.y;high=p.y+CROWN*bulk;}
    else if(high-low<LIE_SPAN*bulk)high=low+LIE_SPAN*bulk;
    out.low=low;out.high=high;
  }
  /** The pitches that hold each body with the lens stood back `back` more:
   *  from its crown's angle less `up` to its feet's plus its own `down`.
   *  True when one pitch holds both. */
  private bounds(back:number,up:number,downMe:number,downFoe:number){
    this.fromMe=Math.atan2(this.highMe,this.reachMe+back)-up;this.toMe=Math.atan2(this.lowMe,this.reachMeLow+back)+downMe;
    this.fromFoe=Math.atan2(this.highFoe,this.reachFoe+back)-up;this.toFoe=Math.atan2(this.lowFoe,this.reachFoe+back)+downFoe;
    return Math.max(this.fromMe,this.fromFoe)<=Math.min(this.toMe,this.toFoe);
  }

  /** The lock-on heading for this frame. `yaw` is the input accumulator, which
   *  main.ts refills from `inputYaw` after every update, so whatever it has
   *  gained since is the player's own turning - applied in full, at once. */
  private steer(dt:number,placed:boolean,self:Fighter,yaw:number,pitch:number,foe:Fighter|undefined,locked:boolean){
    const turn=placed?0:wrapped(yaw-this.inputYaw);
    if(placed){this.heading=yaw;this.assistVelocity=0;}
    else if(Math.abs(turn)>1e-6){this.heading+=turn;this.lastTurn=this.age;}
    const position=self.group.position;
    let gain=0,base=NaN;
    if(foe){
      const at=foe.group.position,dx=at.x-position.x,dz=at.z-position.z,distance=Math.hypot(dx,dz);
      this.far+=(smooth(distance,7,16)-this.far)*blend(3,dt);
      // Quick to follow a launch up, slow to let it go - and not at all for
      // a beat after the landing - so a juggle does not bob the shot on
      // every bounce. A body thrown far as well as high is framed by its
      // distance alone (AIR_NEAR to AIR_FAR): the lens backing off for a
      // launch 7 m away drew both fighters at a fifth of the frame.
      const air=THREE.MathUtils.clamp((at.y-position.y-.3)/2.2,0,1)*(1-smooth(distance,AIR_NEAR,AIR_FAR));
      if(air>=this.air-1e-6)this.airLanded=0;else this.airLanded+=dt;
      if(air>this.air||this.airLanded>=LAND_HOLD)this.air+=(air-this.air)*blend(air>this.air?9:3,dt);
      const range=locked?1-smooth(distance,HARD_NEAR,HARD_FAR):1-smooth(distance,SOFT_NEAR,SOFT_FAR);
      this.framed=range;
      // Close in, the lens stands back (see CLOSE_BOOM).
      const close=range*(1-smooth(distance,CLOSE_NEAR,CLOSE_FAR));
      this.close=placed?close:this.close+(close-this.close)*blend(close>this.close?CLOSE_IN:CLOSE_OUT,dt);
      gain=range*smooth(distance,DEAD_ZONE,FULL_ASSIST)*smooth(this.age-this.lastTurn,YIELD_AFTER,YIELD_AFTER+YIELD_OVER);
      // Swinging at somebody close, the shot opens further to the side.
      const swinging=SWINGS.has(self.state.action)&&distance<ENGAGE_RANGE;
      this.engage+=((swinging?1:0)-this.engage)*blend(swinging?ENGAGE_IN:ENGAGE_OUT,dt);
      // Kurobi's opponent is held further right (see FOX_FOE).
      if(distance>1e-3){const bearing=Math.atan2(dx,dz);base=framingHeading(bearing,distance,this.shoulder,this.boom*Math.cos(pitch),MAX_OFFSET+ENGAGE_OFFSET*this.engage,THREE.MathUtils.lerp(FOE_ANGLE,FOX_FOE,this.foxness));this.offAxis=base-bearing;}
    }else{this.far-=this.far*blend(3,dt);this.close-=this.close*blend(CLOSE_OUT,dt);this.air-=this.air*blend(5,dt);this.framed=0;this.engage-=this.engage*blend(ENGAGE_OUT,dt);}
    // A hit freeze holds the shot: the assist brakes to a stop for the beat
    // the bodies are frozen on, as hard as its acceleration limit allows -
    // stopping dead on the frame would be a jolt of its own, and a freeze is
    // over before a full-speed swing could be undone anyway. The player's own
    // turn above still applies.
    if(this.hold>0||self.state.hitstop)gain=0;
    // Whatever hides the opponent is looked past (see COVER_ENTER): judged
    // while the assist is steering, held through a freeze or the player's
    // own turn, and let go once there is nobody to frame.
    if(foe&&Number.isFinite(base)){if(gain>0)this.clearView(dt,base,pitch);}
    else{this.dodgeGoal=0;approach(this.dodge,0,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);}
    const want=Number.isFinite(base)?base+this.dodge.value:this.heading;
    // Letting go is immediate in effect: a turn kills the assist's own swing
    // within a few frames instead of braking it at the acceleration limit
    // while the player is already steering somewhere else.
    const before=this.assistVelocity;
    if(this.age-this.lastTurn<YIELD_AFTER)this.assistVelocity*=Math.exp(-25*dt);
    this.assist=gain;this.turnSteps=0;
    if(!placed){
      let last=before;
      let error=wrapped(want-this.heading);
      // An opponent passing straight behind puts the error near a half turn,
      // where the shortest way round flips side with every centimetre they
      // move. Once a swing has begun it finishes the way it started.
      if(Math.abs(error)>2.6&&Math.abs(this.assistVelocity)>.2&&Math.sign(error)!==Math.sign(this.assistVelocity))error+=Math.sign(this.assistVelocity)*Math.PI*2;
      // Far off the framing, the wider shot while the heading comes round
      // (see STRAIN_FROM); none while the player is steering.
      const strain=gain*smooth(Math.abs(error),STRAIN_FROM,STRAIN_TO);
      this.strain+=(strain-this.strain)*blend(strain>this.strain?STRAIN_IN:STRAIN_OUT,dt);
      for(let left=dt;left>1e-9;left-=ASSIST_STEP){
        const h=Math.min(ASSIST_STEP,left),size=Math.abs(error);
        const wanted=gain*Math.sign(error)*Math.min(ASSIST_SPEED,Math.sqrt(1.8*ASSIST_ACCEL*size),ASSIST_GAIN*size);
        this.assistVelocity+=THREE.MathUtils.clamp(wanted-this.assistVelocity,-ASSIST_ACCEL*h,ASSIST_ACCEL*h);
        if(this.turnSteps<this.turning.length)this.turning[this.turnSteps++]=Math.abs(this.assistVelocity-last)/h;
        last=this.assistVelocity;
        const step=this.assistVelocity*h;this.heading+=step;error-=step;
      }
    }
    else this.strain=0;
    this.inputYaw=this.heading;
  }

  /** Round 4: the dynamic camera's heading for this frame (see CameraBrain).
   *  The player's own turning lands first, 1:1 and at once, as lock-on's does;
   *  then the brain decides what the shot is about, the turn away from
   *  whatever hides the target is laid on its goal exactly as lock-on lays it
   *  on the framing (see COVER_ENTER), and the brain's controller turns the
   *  heading after it. The composition's own terms - the stand-backs for
   *  distance, a juggle, close quarters and a strain, the close-quarters swing
   *  and how much the target is the fight - are kept as `steer` keeps them,
   *  so the vertical framing, the occlusion and the HUD bands all work on the
   *  dynamic shot unchanged. Whatever the controller turns by itself is
   *  counted for the movement basis (see `movementBasis`); the player's own
   *  turning is not. And a pitch the player has left alone is levelled
   *  (CameraBrain PITCH_*) into `inputPitch`. */
  private steerDynamic(dt:number,placed:boolean,self:Fighter,yaw:number,pitch:number,tilted:boolean,foe:Fighter|undefined,locked:boolean){
    const turn=placed?0:wrapped(yaw-this.inputYaw);
    if(placed){this.heading=yaw;this.brain.reset();this.autoTurn=this.autoShown=0;this.inputPitch=pitch;}
    else if(Math.abs(turn)>1e-6){this.heading+=turn;this.lastTurn=this.age;}
    this.turnMemory=this.turnMemory*Math.exp(-dt/TURN_MEMORY)+Math.abs(turn);
    const position=self.group.position;
    let bearing=NaN,closeMelee=false;
    if(foe){
      const at=foe.group.position,dx=at.x-position.x,dz=at.z-position.z,distance=Math.hypot(dx,dz);
      closeMelee=!!self.state.grounded&&!!foe.state.grounded&&distance<ENGAGE_RANGE;
      this.far+=(smooth(distance,7,16)-this.far)*blend(3,dt);
      const air=THREE.MathUtils.clamp((at.y-position.y-.3)/2.2,0,1)*(1-smooth(distance,AIR_NEAR,AIR_FAR));
      if(air>=this.air-1e-6)this.airLanded=0;else this.airLanded+=dt;
      if(air>this.air||this.airLanded>=LAND_HOLD)this.air+=(air-this.air)*blend(air>this.air?9:3,dt);
      const range=locked?1-smooth(distance,HARD_NEAR,HARD_FAR):1-smooth(distance,SOFT_NEAR,SOFT_FAR);
      this.framed=range;
      const close=range*(1-smooth(distance,CLOSE_NEAR,CLOSE_FAR));
      this.close=placed?close:this.close+(close-this.close)*blend(close>this.close?CLOSE_IN:CLOSE_OUT,dt);
      const swinging=SWINGS.has(self.state.action)&&distance<ENGAGE_RANGE;
      this.engage+=((swinging?1:0)-this.engage)*blend(swinging?ENGAGE_IN:ENGAGE_OUT,dt);
      if(distance>1e-3)bearing=Math.atan2(dx,dz);
    }else{this.far-=this.far*blend(3,dt);this.close-=this.close*blend(CLOSE_OUT,dt);this.air-=this.air*blend(5,dt);this.framed=0;this.engage-=this.engage*blend(ENGAGE_OUT,dt);}
    this.trackVelocity(dt,placed,position);
    // What the brain is told: the player, the lens as it stands, the turning
    // and who is about.
    const i=this.brainIn,s=self.state;
    i.dt=placed?0:dt;i.x=position.x;i.y=position.y;i.z=position.z;i.vx=this.travel.x;i.vz=this.travel.z;
    i.grounded=!!s.grounded;i.dashing=s.action==='dash';i.plunging=plunging(s);i.reacting=REACTIONS.has(s.action);i.basisHeld=this.basisMask>0;
    // (Launch night: the lens as the rig stands it, without the vertical framing's stand-back for a launch or a jump
    // and without the squeeze a wall puts on it: the composition - and with it the heading, and every direction the
    // keys point - does not turn because the lens was moved along it.)
    i.heading=this.heading;i.back=Math.max(.5,this.boom*Math.cos(pitch));i.shoulder=this.shoulder;i.tanH=this.tanH;
    // (Second pass: and where the lens really stands, for the brain's test of whether the opponent is in the frame.)
    if(this.squeeze>0){const keep=1-this.squeeze;i.lensBack=Math.max(.5,this.boom*keep*Math.cos(pitch));i.lensShoulder=this.shoulder*Math.pow(keep,SQUEEZE_SIDE);}else i.lensBack=i.lensShoulder=NaN;
    i.manual=turn;i.tilted=tilted;i.locked=locked;i.engage=this.engage;i.foe=THREE.MathUtils.lerp(FOE_ANGLE,FOX_FOE,this.foxness);
    // Round 4b: the challenger the focus is weighing, the floor they last stood on.
    i.pending=this.focusHint.pending;i.pendingShare=this.focusHint.share;i.floor=Number.isFinite(this.floorMe)?this.floorMe:position.y;i.form=this.foxness;
    // A new opponent: the turn away from whatever hid the last one starts over.
    const focusOf=foe?.state.id??'';if(focusOf!==this.focusOf){if(this.focusOf&&focusOf)this.dodgeGoal=0;this.focusOf=focusOf;}
    this.gatherSubjects(self,foe);
    const b=this.brain;b.think(i);
    // A hit freeze holds the shot (see `steer`); whatever hides the target is
    // looked past, judged while the brain is turning after them.
    const frozen=this.hold>0||!!s.hitstop;
    const closeDuel=closeMelee&&b.mode==='duel'&&this.director.kind==='none'&&!this.cuts.owns;
    let base=b.goal;
    if(foe&&Number.isFinite(base)&&Number.isFinite(bearing)){
      this.offAxis=wrapped(base-bearing);
      // (Launch night: the view is no longer turned 72-79 degrees off the line to prepare for a lunge - see
      // MELEE_COVER_ENTER. Measured coverage still turns it, by the least that clears, and chooses the way.)
      if(b.gain>0&&!frozen)this.clearView(dt,base,pitch,closeDuel);
    }
    else{this.dodgeGoal=0;approach(this.dodge,0,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);}
    this.framingGoal=base;
    // A turn away from a body in the way is measured at the composition itself, so while there is one the brain's
    // window (CameraBrain CALM_*) is shut: the heading goes to that turn, not to some rest short of it. And it is shut
    // while the view as it stands hides the opponent (more than MELEE_COVER_ENTER of them, until it is under
    // MELEE_COVER_EXIT): the heading then makes for the composition, and rests again as soon as they are in the clear -
    // the least turn that shows them.
    const hidden=this.rig.cover;
    this.uncover=!!foe&&!frozen&&(hidden>MELEE_COVER_ENTER||(this.uncover&&hidden>MELEE_COVER_EXIT));
    if(this.uncover||this.dodgeGoal!==0||Math.abs(this.dodge.value)>.02)b.exact(this.uncover);
    let want=Number.isFinite(base)?base+this.dodge.value:NaN;
    // A dodge chosen before the approach widened must still fit the same
    // homing cone. Bound its goal, not the rendered heading or its velocity.
    if(closeDuel&&Math.abs(this.offAxis)<=ALPHA_MOST)want=base+THREE.MathUtils.clamp(this.dodge.value,-ALPHA_MOST-this.offAxis,ALPHA_MOST-this.offAxis);
    const before=this.heading;this.turnSteps=0;
    if(!placed){this.heading=b.steer(this.heading,want,dt,frozen,this.turning);this.turnSteps=b.traced;}
    if(this.basisMask>0)this.autoTurn+=this.heading-before;
    // Far off what it is making for, the wider shot while the heading comes
    // round (see STRAIN_FROM), as lock-on has it. (Launch night: what it is making for is the window's edge
    // (CameraBrain CALM_*), not the composition in its middle - at rest in the window there is nothing to strain for.
    // Measured against the middle, the lens stood back and came in again by a metre as an opponent moved about
    // inside the window.)
    const strain=placed?0:b.gain*smooth(Number.isFinite(want)?Math.abs(b.past(wrapped(want-this.heading))):0,STRAIN_FROM,STRAIN_TO);
    this.strain=placed?0:this.strain+(strain-this.strain)*blend(strain>this.strain?STRAIN_IN:STRAIN_OUT,dt);
    this.assist=b.gain;
    this.inputYaw=this.heading;
    if(!placed)this.inputPitch=Number.isFinite(b.pitchGoal)?THREE.MathUtils.clamp(pitch+(b.pitchGoal-pitch)*blend(b.pitchRate,dt),-.28,.72):pitch;
  }
  /** Launch day: the arena camera's heading for this frame (see ARENA). The player's own turning lands first, 1:1 and
   *  at once, as in every mode, and is kept as their look-away (`away`): the view is theirs while they turn it and for
   *  YIELD_AFTER after, and then comes back to the camera's own composition. That composition is the line to the
   *  opponent with the view `own` radians off it: exactly the framing's angle from ARENA.far metres on, and at arm's
   *  length anywhere the opponent is in the frame (the window: up to ARENA.outer either side, no nearer the player's own
   *  body than hides them) - narrowed by the stage's bound to what stands the rig inside it (`slideAlong`). The heading
   *  goes there speed and acceleration limited, braking to arrive, with the line's own turning fed forward at range, and
   *  faster after an opponent outside the frame. The composition's own terms - the stand-backs for distance, a juggle,
   *  close quarters and a strain, how much the opponent is the fight - are kept as `steer` keeps them, so the vertical
   *  framing, the occlusion and the HUD bands work on this shot unchanged; the brain is still told everything and still
   *  gives the rig its offsets for a run, a juggle, a ground smash, a crowd and tall air, and levels the pitch - only its
   *  heading is not taken. */
  private steerArena(dt:number,placed:boolean,self:Fighter,yaw:number,pitch:number,tilted:boolean,foe:Fighter|undefined,locked:boolean){
    const turn=placed?0:wrapped(yaw-this.inputYaw);
    if(placed){this.heading=yaw;this.brain.reset();this.autoTurn=this.autoShown=0;this.inputPitch=pitch;this.assistVelocity=0;this.away=this.awayBasis=0;this.urgent=0;this.bearingRate=0;this.lastBearing=NaN;this.sideFrom=this.sideEase=this.arenaSide;this.behindFor=0;this.showing=false;this.sideAt=-Infinity;}
    else if(Math.abs(turn)>1e-6){
      this.heading+=turn;
      // (A hand resting on the mouse - under ARENA.idle radians a second, the brain's YIELD_FROM - is not a look away:
      // the view takes it and the composition takes it back, and neither the hold nor a run is the player's to lose to it.)
      if(Math.abs(turn)>ARENA.idle*dt){this.awayBasis+=turn;this.basisHeld+=turn;this.lastTurn=this.age;}
    }
    this.turnMemory=this.turnMemory*Math.exp(-dt/TURN_MEMORY)+Math.abs(turn);
    const position=self.group.position;
    let bearing=NaN,distance=0;
    if(foe){
      const at=foe.group.position,dx=at.x-position.x,dz=at.z-position.z;distance=Math.hypot(dx,dz);
      this.far+=(smooth(distance,7,16)-this.far)*blend(3,dt);
      const air=THREE.MathUtils.clamp((at.y-position.y-.3)/2.2,0,1)*(1-smooth(distance,AIR_NEAR,AIR_FAR));
      if(air>=this.air-1e-6)this.airLanded=0;else this.airLanded+=dt;
      if(air>this.air||this.airLanded>=LAND_HOLD)this.air+=(air-this.air)*blend(air>this.air?9:3,dt);
      // The only opponent there is, is held wherever they are (a hard lock); a Tab lock to its own range.
      const range=this.sole?1:locked?1-smooth(distance,HARD_NEAR,HARD_FAR):1-smooth(distance,SOFT_NEAR,SOFT_FAR);
      this.framed=range;
      const close=range*(1-smooth(distance,CLOSE_NEAR,CLOSE_FAR));
      this.close=placed?close:this.close+(close-this.close)*blend(close>this.close?CLOSE_IN:CLOSE_OUT,dt);
      const swinging=SWINGS.has(self.state.action)&&distance<ENGAGE_RANGE;
      this.engage+=((swinging?1:0)-this.engage)*blend(swinging?ENGAGE_IN:ENGAGE_OUT,dt);
      if(distance>=DEAD_ZONE)bearing=Math.atan2(dx,dz);
    }else{this.far-=this.far*blend(3,dt);this.close-=this.close*blend(CLOSE_OUT,dt);this.air-=this.air*blend(5,dt);this.framed=0;this.engage-=this.engage*blend(ENGAGE_OUT,dt);}
    this.trackVelocity(dt,placed,position);
    // What the brain is told, as `steerDynamic` tells it: its presences and the rig's offsets are still its own.
    const i=this.brainIn,s=self.state;
    i.dt=placed?0:dt;i.x=position.x;i.y=position.y;i.z=position.z;i.vx=this.travel.x;i.vz=this.travel.z;
    i.grounded=!!s.grounded;i.dashing=s.action==='dash';i.plunging=plunging(s);i.reacting=REACTIONS.has(s.action);i.basisHeld=this.basisMask>0;
    i.heading=this.heading;i.back=Math.max(.5,this.boom*Math.cos(pitch));i.shoulder=this.shoulder;i.tanH=this.tanH;i.lensBack=i.lensShoulder=NaN;
    i.manual=turn;i.tilted=tilted;i.locked=locked||this.sole;i.engage=this.engage;i.foe=ARENA.foe;
    i.pending=this.focusHint.pending;i.pendingShare=this.focusHint.share;i.floor=Number.isFinite(this.floorMe)?this.floorMe:position.y;i.form=this.foxness;
    this.gatherSubjects(self,foe);
    const b=this.brain;b.think(i);b.settle();
    const frozen=this.hold>0||!!s.hitstop,id=foe?.state.id??'';
    // A new opponent: the line's own rate starts over, and so does whatever of the composition was theirs.
    if(id!==this.holdId){if(id&&this.holdId&&!placed)this.changedAt=this.age;this.holdId=id;this.lastBearing=NaN;this.bearingRate=0;this.behindFor=0;this.showing=false;}
    this.holding=foe?this.framed:0;
    if(Number.isFinite(bearing)){
      if(Number.isFinite(this.lastBearing)&&dt>0){const jump=wrapped(bearing-this.lastBearing);this.bearingRate=Math.abs(jump)<.6?this.bearingRate+(THREE.MathUtils.clamp(jump/dt,-ARENA.fast,ARENA.fast)-this.bearingRate)*blend(8,dt):0;}
      this.lastBearing=bearing;this.holdBearing=bearing;
    }else this.bearingRate=0;
    const held=foe&&Number.isFinite(bearing)?this.framed*smooth(distance,DEAD_ZONE,FULL_ASSIST):0;
    // The view is the player's while they turn it and for a beat after (YIELD_*, lock-on's own).
    const mine=smooth(this.age-this.lastTurn,YIELD_AFTER,YIELD_AFTER+YIELD_OVER),before=this.heading;
    let error=0,gain=0,speed:number=ARENA.speed,accel:number=ARENA.accel,lead=0;
    this.turnSteps=0;
    if(held>0&&foe){
      // (The shoulder as the composition has it: without what a bound has added to it, see `slideAlong`.)
      const melee=1-smooth(distance,ARENA.near,ARENA.far),shoulder=Math.max(1e-3,Math.abs(this.shoulder)-this.slideNow),back=Math.max(.5,this.boom*Math.cos(pitch));
      // The framing's own angle off the line (lock-on's formula, the opponent ARENA.foe across the middle).
      const alpha=framingHeading(0,distance,shoulder,back,MAX_OFFSET+ENGAGE_OFFSET*this.engage,ARENA.foe);
      // The view as the camera itself has it - the player's own look-away taken off - against the line.
      let own=placed?this.arenaSide*alpha:wrapped(this.heading-this.away-bearing);
      const way=Math.sign(own)||this.arenaSide;
      // Which side of the line the view is on is the side the composition is made on: an opponent who has passed behind
      // the player is framed the shorter way round, and the shoulder goes with them, a rest after its last change. While
      // the shoulder is a real one the opponent is always composed on its side - the other way round the player's own
      // body stands between the lens and them - so a change that has to wait is the heading's to make instead. At arm's
      // length, where it is a hand's breadth (ARENA.hand), the opponent steps back and forth across the player's front
      // and neither the lens nor the shoulder follows.
      const hand=shoulder<ARENA.hand,wanted=Math.abs(own)>ARENA.flip?way:this.arenaSide;
      if(!placed&&!hand&&wanted!==this.arenaSide&&this.age-this.sideAt>=ARENA.sideRest){this.sideFrom=this.sideEase;this.arenaSide=wanted;this.sideAt=this.age;}
      const side=hand?wanted:this.arenaSide;
      // The window (see ARENA): shut on the framing's own angle from ARENA.far on; at arm's length open from the middle
      // of the frame to ARENA.outer on whichever side of it the opponent stands - and from ARENA.inner once they have
      // stood behind the player's own body for ARENA.behind seconds, until they are clear of it.
      this.behindFor=melee>0&&Math.abs(own)<ARENA.inner&&!frozen?this.behindFor+dt:0;
      this.showing=melee>0&&Math.abs(own)<(this.showing?ARENA.show:ARENA.inner)&&(this.showing||this.behindFor>=ARENA.behind);
      const lo=THREE.MathUtils.lerp(alpha,this.showing?Math.min(alpha,ARENA.show):0,melee),hi=THREE.MathUtils.lerp(alpha,Math.max(alpha,ARENA.outer),melee);
      own=side*THREE.MathUtils.clamp(side*own,lo,hi);
      // And inside the stage: the heading slides along a bound rather than the lens rising over it.
      if(this.stageBounds&&!this.battlefield)own=this.slideAlong(position,bearing,own,lo,hi,distance,back,shoulder);else{this.slideSide=0;this.sliding=false;}
      this.own=own;
      if(placed)this.heading=bearing+own;
      // While the view is the player's, whatever they have it off the composition is their look-away; left alone, it is given back.
      if(mine<1&&!placed)this.away=wrapped(this.heading-bearing-own);
      else{this.away-=this.away*blend(ARENA.away,dt);if(Math.abs(this.away)<1e-4)this.away=0;}
      if(this.basisMask===0)this.awayBasis=this.away;
      error=wrapped(bearing+own+this.away-this.heading);
      // An opponent outside the frame - a vanish, a cross-up, a new one behind - is turned to faster (ARENA.fast).
      const x=across(foe.group.position.x,foe.group.position.z,position.x,position.z,this.heading,back,this.shoulder,this.tanH);
      this.urgent+=((Math.abs(x)<=1?0:1)-this.urgent)*blend(Math.abs(x)<=1?6:8,dt);
      speed=ARENA.speed+(ARENA.fast-ARENA.speed)*this.urgent;accel=ARENA.accel+(ARENA.fastAccel-ARENA.accel)*this.urgent;
      // A change of who is held is a pan, not a turn to somebody lost: at ARENA.pan, easing back to the pace above.
      const pan=1-smooth(this.age-this.changedAt,ARENA.panFor*.5,ARENA.panFor);
      if(pan>0){speed=THREE.MathUtils.lerp(speed,Math.min(speed,ARENA.pan),pan);accel=THREE.MathUtils.lerp(accel,Math.min(accel,ARENA.panAccel),pan);}
      gain=held*mine;
      // At range the composition turns with the line: its rate is fed forward, so a circling pair is held, not trailed.
      lead=melee<=0?ARENA.lead*this.bearingRate*held*mine:0;
    }else{
      // Nobody held: the view is the player's alone, there is no look-away to give back, and the lens comes back to
      // the right shoulder. (An opponent standing on the player - inside DEAD_ZONE - is still held: the line is the last
      // one that meant anything, and nothing turns.)
      this.urgent-=this.urgent*blend(6,dt);this.slideSide=0;this.sliding=false;this.behindFor=0;this.showing=false;
      if(!foe){
        this.away=this.own=0;if(this.basisMask===0)this.awayBasis=0;
        if(this.arenaSide!==1&&this.age-this.sideAt>=ARENA.sideRest){this.sideFrom=this.sideEase;this.arenaSide=1;this.sideAt=this.age;}
      }
    }
    this.sideEase=this.sideFrom+(this.arenaSide-this.sideFrom)*smooth(this.age-this.sideAt,0,ARENA.sideTime);
    // (What a bound adds to the shoulder is taken up and given back as a move with a beginning and an end, not a step.)
    if(placed){this.slideEase.value=this.slideSide;this.slideEase.velocity=0;}else approach(this.slideEase,this.slideSide,dt,3,14,6);
    // The assist's integrator (see `steer`), at the arena's limits. A hit freeze holds the shot; the player's own turn
    // kills the camera's swing within a few frames.
    if(this.age-this.lastTurn<YIELD_AFTER)this.assistVelocity*=Math.exp(-25*dt);
    if(!placed){
      for(let left=dt;left>1e-9;left-=ASSIST_STEP){
        const h=Math.min(ASSIST_STEP,left),size=Math.abs(error),last=this.assistVelocity;
        const wanted=frozen?0:gain*THREE.MathUtils.clamp(Math.sign(error)*Math.min(speed,Math.sqrt(1.8*accel*size),ARENA.gain*size)+lead,-speed,speed);
        this.assistVelocity+=THREE.MathUtils.clamp(wanted-this.assistVelocity,-accel*h,accel*h);
        // (The tilt shares the heading's acceleration budget - `approach` - as a share of the heading's own limit,
        // whatever that is, and never all of it: ARENA.tilt of the budget at most. Lock-on's assist turns for a moment and
        // may take the whole budget meanwhile; this heading can be at its limit for a second on end going round a
        // corner, and a tilt with no acceleration left kept the speed it had - filmed in the scripted fights, the look
        // running on down to the floor at the lens's own feet for 1.3 s with the fighter out of the frame.)
        if(this.turnSteps<this.turning.length)this.turning[this.turnSteps++]=Math.abs(this.assistVelocity-last)/h/accel*ARENA.tilt*SHARED*ASSIST_ACCEL;
        const step=this.assistVelocity*h;this.heading+=step;error-=step;
      }
    }
    // What the camera turned by itself is not the run's to follow (see `movementBasis`): a run read against the view -
    // begun with nobody held - keeps its direction while the lens comes round to a new opponent.
    if(this.basisMask>0)this.autoTurn+=this.heading-before;
    this.dodgeGoal=0;approach(this.dodge,0,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);
    this.offAxis=this.own;this.framingGoal=Number.isFinite(bearing)?bearing+this.own:NaN;
    const strain=placed?0:gain*smooth(Math.abs(error),STRAIN_FROM,STRAIN_TO);
    this.strain=placed?0:this.strain+(strain-this.strain)*blend(strain>this.strain?STRAIN_IN:STRAIN_OUT,dt);
    this.assist=held;
    this.inputYaw=this.heading;
    if(!placed)this.inputPitch=Number.isFinite(b.pitchGoal)?THREE.MathUtils.clamp(pitch+(b.pitchGoal-pitch)*blend(b.pitchRate,dt),-.28,.72):pitch;
  }
  /** Launch day (ARENA): the stage's bound and the arena camera's heading. How far past where the stage lets the lens
   *  stand (metres; ARENA.slideSoft short of it) the rig would be, the player at `p`, looking `off` radians off the
   *  line `bearing` with the player's look-away on it - the lens `back` behind them and `shoulder` to the side `off` is on. */
  private pastBound(p:THREE.Vector3,bearing:number,off:number,back:number,shoulder:number,spare=0){
    const b=this.stageBounds!,out=boundOut(b,this.battlefield)-ARENA.slideSoft-spare,h=bearing+off+this.away,sh=Math.sin(h),ch=Math.cos(h),s=shoulder*(Math.sign(off)||this.arenaSide);
    return Math.max(0,Math.abs(p.x-sh*back-ch*s)-(b.halfX+out),Math.abs(p.z-ch*back+sh*s)-(b.halfZ+out));
  }
  /** Launch day (ARENA): the shoulder with the view `off` radians off the line to an opponent `gap` metres away: the
   *  composition's own (`shoulder`) inside the window (to `hi`), and past it - a view a bound has turned - toward half
   *  the gap as seen from there (the pair's middle on the centre line), no more than ARENA.slideSide. */
  private shoulderAt(off:number,hi:number,gap:number,shoulder:number){
    const size=Math.abs(off),over=smooth(size,hi,hi+ARENA.slideOver);
    return over>0?shoulder+Math.max(0,Math.min(ARENA.slideSide,gap/2*Math.sin(Math.min(size,Math.PI/2)))-shoulder)*over:shoulder;
  }
  /** Launch day (ARENA): `own` - the view's angle off the line to the opponent, as the composition wants it - turned
   *  along the stage's bound by the least that stands the whole rig inside it, ARENA.slideSoft clear (the squeeze's own
   *  margin: at rest there the rig is not squeezed at all). Outward from the angle wanted, either way, ARENA.slideStep at
   *  a time and then to the edge of what fits; never past ARENA.slideMost, nor further than leaves the opponent - `gap`
   *  metres off - inside ARENA.slideEdge of the frame's half-width, nor nearer the line than `lo`. With no angle that
   *  fits, the one that leaves the least outside: the squeeze has the rest. Leaves in `slideSide` what the shoulder is
   *  to grow by there (`shoulderAt`). */
  private slideAlong(p:THREE.Vector3,bearing:number,own:number,lo:number,hi:number,gap:number,back:number,shoulder:number){
    this.slideSide=0;
    // (Turned along a bound, the lens comes back to the composition only with ARENA.slideBack metres to spare: where
    // the rig just fits and just does not from one frame to the next - a corner, the stand-back easing - the two answers
    // are a long way round from each other.)
    let least=this.pastBound(p,bearing,own,back,shoulder,this.sliding?ARENA.slideBack:0);
    if(least<=0){this.sliding=false;return own;}
    this.sliding=true;least=this.pastBound(p,bearing,own,back,shoulder);
    const first=Math.sign(own)||this.arenaSide;
    // (Inside the frame's edge: the opponent's place across it from a lens there, as a share of its half-width.)
    const across=(off:number,s:number)=>Math.abs(off)<=Math.max(hi,Math.abs(own))?0:(gap*Math.sin(Math.abs(off))-s)/((back+gap*Math.cos(Math.abs(off)))*this.tanH);
    // The side of the line the view is on first, all of it: the nearest angle there that fits. Then the other side -
    // across the player's back - unless this one all but fits (ARENA.slideNear metres outside at the least: the
    // squeeze has that). A corner has an answer on each side and the rig only just fits either; taken strictly, the
    // lens went from one to the other and back as its own stand-back eased (filmed: fifty degrees there and back in a
    // second and a half).
    let best=own,side=shoulder,near=Infinity,nearOff=own,nearSide=shoulder,other=NaN,otherSide=shoulder;
    for(let k=1;k*ARENA.slideStep<=2*ARENA.slideMost+1e-9;k++)for(let way=1;way>=-1;way-=2){
      const off=own+way*first*k*ARENA.slideStep,size=Math.abs(off),same=Math.sign(off)===first;
      if(size>ARENA.slideMost||size<lo||(!same&&Number.isFinite(other)))continue;
      const s=this.shoulderAt(off,hi,gap,shoulder),at=across(off,s);
      if(at>ARENA.slideEdge)continue;
      const past=this.pastBound(p,bearing,off,back,s);
      if(past<=0){
        // To the edge of what fits, between this step and the one before it (on the same side of the line).
        let out=off-way*first*ARENA.slideStep,inside=off;
        if(Math.sign(out)===Math.sign(inside))for(let n=0;n<8;n++){const mid=(out+inside)/2;if(this.pastBound(p,bearing,mid,back,this.shoulderAt(mid,hi,gap,shoulder))<=0)inside=mid;else out=mid;}
        if(same){this.slideSide=this.shoulderAt(inside,hi,gap,shoulder)-shoulder;return inside;}
        other=inside;otherSide=this.shoulderAt(inside,hi,gap,shoulder);continue;
      }
      if(same&&past<near){near=past;nearOff=off;nearSide=s;}
      // (What is still outside is squeezed, and a squeezed lens sees less to either side: with nothing that fits, the
      // angle that leaves the least outside among those with the opponent well inside the frame, ARENA.slideTight.)
      if(past<least&&at<=ARENA.slideTight){least=past;best=off;side=s;}
    }
    if(near<=ARENA.slideNear){this.slideSide=nearSide-shoulder;return nearOff;}
    if(Number.isFinite(other)){this.slideSide=otherSide-shoulder;return other;}
    this.slideSide=side-shoulder;
    return best;
  }
  /** Round 4b: how much the drawn body is a big one (BIG_*), 0..1. */
  private bigness(){return Math.max(this.foxness,smooth(this.drawnScale,BIG_FROM,BIG_FULL));}
  /** Round 4b: the movement basis comes round to the view once the camera's
   *  own turning has settled, and at once for a player held up (see
   *  SETTLED_* and BLOCKED_*). */
  private resample(dt:number,self:Fighter){
    if(this.basisMask===0){this.settledFor=this.blockedFor=0;return;}
    const s=self.state,speed=Math.hypot(this.travel.x,this.travel.z);
    this.blockedFor=s.grounded&&RUNNING.has(s.action)&&speed<BLOCKED_SPEED?this.blockedFor+dt:0;
    if(this.blockedFor>=BLOCKED_AFTER){
      // Close style: the held-up run comes round to the view over a few frames, not in one (a jump of up to 150 degrees in the direction held).
      if(this.latchBlend>0)this.autoTurn-=this.autoTurn*blend(CLOSE_STYLE.blockRate,dt);else this.autoTurn=this.autoShown=0;
      this.settledFor=0;return;
    }
    const framing=this.brain.mode==='duel'||this.brain.mode==='group';
    // (Launch day: the arena camera turns its own heading - `assistVelocity`, as lock-on's assist does - not the brain's.)
    this.settledFor=framing&&Math.abs(this.arenaBlend>.5?this.assistVelocity:this.brain.velocity)<SETTLED_SPEED&&!this.brain.switchActive?this.settledFor+dt:0;
    if(this.settledFor>=SETTLED_AFTER){this.autoTurn-=this.autoTurn*blend(BASIS_CATCH,dt);if(Math.abs(this.autoTurn)<1e-4)this.autoTurn=0;}
    // Close style: while an opponent is framed the latch is bounded (see CLOSE_STYLE.latchMost) - a held key never strays further than that
    // from the direction it points on the screen, however far the camera has swung since it went down.
    if(this.latchBlend>0&&framing){const over=Math.abs(this.autoTurn)-CLOSE_STYLE.latchMost;if(over>0)this.autoTurn-=Math.sign(this.autoTurn)*over*blend(CLOSE_STYLE.latchRate,dt);}
  }
  /** Launch night: how far the dynamic rig is squeezed toward the player's body this frame (SQUEEZE_*): the share of
   *  the stand-back - and of the shoulder with it - given up so that the lens stands inside the stage's bounds, taken
   *  up at once (and a little before the bound), given back slowly. */
  private squeezeFor(dt:number,placed:boolean,pitch:number){
    const b=this.stageBounds;if(!b)return this.squeeze=0;
    const out=boundOut(b,this.battlefield),hard=this.squeezeNeed(b.halfX+out,b.halfZ+out,pitch),soft=this.squeezeNeed(b.halfX+out-SQUEEZE_SOFT,b.halfZ+out-SQUEEZE_SOFT,pitch)*SQUEEZE_EARLY;
    const goal=Math.max(hard,soft)*this.dynBlend;
    this.squeeze=placed?goal:Math.max(hard*this.dynBlend,this.squeeze+(goal-this.squeeze)*blend(goal>this.squeeze?SQUEEZE_IN:SQUEEZE_OUT,dt));
    if(this.squeeze<1e-4)this.squeeze=0;
    return this.squeeze;
  }
  /** The least squeeze that stands the lens inside a floor `hx` by `hz` half-extents: none with room, SQUEEZE_MOST when
   *  even that does not (the fighter's own middle past the bound). */
  private squeezeNeed(hx:number,hz:number,pitch:number){
    const f=this.forward,r=this.right,o=this.focus,back=this.boom*Math.cos(pitch),side=this.shoulder;
    const inside=(keep:number)=>{const k=Math.pow(keep,SQUEEZE_SIDE);return Math.abs(o.x-f.x*back*keep+r.x*side*k)<=hx&&Math.abs(o.z-f.z*back*keep+r.z*side*k)<=hz;};
    if(inside(1))return 0;
    let lo=1-SQUEEZE_MOST,hi=1;if(!inside(lo))return SQUEEZE_MOST;
    for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(inside(mid))lo=mid;else hi=mid;}
    return 1-lo;
  }
  /** Round 4b: keep the dynamic lens inside the stage's play bounds (BOUND_*)
   *  by moving it along its line of sight toward the look point. (Launch night: the rig is squeezed toward the
   *  player's body first, see SQUEEZE_MOST; this is what is left for a lens that still stands outside - a fighter
   *  hard against the bound, a blow's kick.) */
  private keepInside(after=false,weight=this.dynBlend,ends?:number){
    const b=this.stageBounds,eye=this.camera.position;if(!b)return 0;
    // (Where the view is the squad's - Arcade Survival fights on the Drifting Isle, Cinder Flats and Warlord's Roof too -
    // the lens keeps the bound it always had: OPEN_EDGE is the main game's.)
    const out=boundOut(b,this.battlefield);
    const hx=b.halfX+out,hz=b.halfZ+(ends??out);
    if(Math.abs(eye.x)<=hx&&Math.abs(eye.z)<=hz)return 0;
    let ux:number,uy:number,uz:number,length:number;
    if(after){this.camera.getWorldDirection(this.axis);ux=this.axis.x;uy=this.axis.y;uz=this.axis.z;length=BOUND_AFTER+BOUND_NEAREST;}
    else{const dx=this.probe.x-eye.x,dy=this.probe.y-eye.y,dz=this.probe.z-eye.z;length=Math.hypot(dx,dy,dz);if(!(length>1e-6))return 0;ux=dx/length;uy=dy/length;uz=dz/length;}
    let need=0;
    if(eye.x>hx){if(ux<-1e-4)need=Math.max(need,(eye.x-hx)/-ux);else return 0;}
    else if(eye.x<-hx){if(ux>1e-4)need=Math.max(need,(-hx-eye.x)/ux);else return 0;}
    if(eye.z>hz){if(uz<-1e-4)need=Math.max(need,(eye.z-hz)/-uz);else return 0;}
    else if(eye.z<-hz){if(uz>1e-4)need=Math.max(need,(-hz-eye.z)/uz);else return 0;}
    const move=Math.min(need,Math.max(0,length-BOUND_NEAREST))*weight;
    eye.x+=ux*move;eye.y+=uy*move;eye.z+=uz*move;
    return move;
  }
  /** Round 4: everybody the dynamic shot may be about, into `subjects`: the
   *  target first, then every other hostile body alive and drawn within
   *  SUBJECT_RANGE (main.ts's fighters, the director's crowd). */
  private gatherSubjects(self:Fighter,foe:Fighter|undefined){
    this.subjectCount=0;
    if(foe)this.fillSubject(this.nextSubject(),foe,self,true);
    const crowd=this.director.crowd;
    this.gatherSelf=self;this.gatherFoe=foe;
    crowd?.forEach(this.gatherSubject);this.extraSubjects?.forEach(this.gatherSubject);
    this.gatherSelf=this.gatherFoe=undefined;
    this.brainIn.subjects=this.subjects;this.brainIn.count=this.subjectCount;
  }
  private gatherSubject=(body:Pick<Fighter,'state'|'group'>)=>{
    const self=this.gatherSelf;
    if(!self||body===self||body===this.gatherFoe||!body.state.alive||!body.group.visible)return;
    if(self.state.team!==undefined&&body.state.team===self.state.team)return;
    const p=body.group.position,q=self.group.position;
    if(Math.hypot(p.x-q.x,p.z-q.z)>SUBJECT_RANGE)return;
    this.fillSubject(this.nextSubject(),body,self,false);
  };
  private nextSubject(){
    if(this.subjectCount>=this.subjects.length)this.subjects.push(subject());
    return this.subjects[this.subjectCount++];
  }
  private fillSubject(out:Subject,body:Pick<Fighter,'state'|'group'>,self:Fighter,target:boolean){
    const s=body.state,p=body.group.position,q=self.group.position,enemy=s.enemy?ENEMIES[s.enemy]:undefined;
    const bulk=enemy?enemy.height/CROWN:bodyBulk(s),distance=Math.hypot(p.x-q.x,p.z-q.z);
    out.id=s.id;out.x=p.x;out.y=p.y;out.z=p.z;out.high=CROWN*bulk;out.radius=TORSO*bulk;out.target=target;
    // Targeting's attacker rule: aiming at the player, mid-swing, within the
    // move's range and three metres.
    const swing=ATTACKS.has(s.action);
    out.attacking=swing&&s.target===self.state.id&&distance<(castThreat(s).move?.range??3)+3;
    out.hitAgo=this.director.hitAgo(s.id);
    out.airborne=!s.grounded;out.lying=s.action==='knockdown'||s.action==='getup'||(s.action==='splat'&&s.grounded);out.launched=s.action==='launched';
  }
  /** Round 4: the player's travel along the floor, off the presented root
   *  (see VELOCITY_RATE): what a run is looked ahead of and turned behind. */
  private trackVelocity(dt:number,placed:boolean,p:THREE.Vector3){
    if(placed||!this.rooted){this.travel.set(0,0,0);this.lastRoot.copy(p);this.rooted=true;return;}
    if(!(dt>0))return;
    const dx=p.x-this.lastRoot.x,dz=p.z-this.lastRoot.z;this.lastRoot.copy(p);
    if(dx*dx+dz*dz>TELEPORT*TELEPORT){this.travel.set(0,0,0);return;}
    const k=blend(VELOCITY_RATE,dt);this.travel.x+=(dx/dt-this.travel.x)*k;this.travel.z+=(dz/dt-this.travel.z)*k;
  }
  /** Round 4: the dynamic camera's gameplay shots (CameraBrain PLAY_*): a
   *  launch's lift, a knockdown's or a splat's punch-in (cued by the director
   *  off the player's own hits), a ground smash's pull-back (off the player's
   *  own landing). Laid over the frame after the director's, as much as it
   *  leaves of the gameplay shot, and after `movementYaw` is taken: cosmetic,
   *  like the impact camera. Returns the field it adds, in degrees. */
  private playShots(dt:number,self:Fighter,shot:number){
    const falling=plunging(self.state);
    if(this.wasPlunging&&!falling&&self.state.action==='special')this.cuePlay('smash',true,self);
    this.wasPlunging=falling;
    const director=this.director;
    for(let k=0;k<director.cueCount;k++)this.cuePlay(director.cues[k].kind,director.cues[k].ender,self);
    director.cueCount=0;
    if(!this.play)return 0;
    this.playT+=dt;
    if(this.playT>=PLAY_LENGTH[this.play]){this.play=null;return 0;}
    const s=playShape(this.play,this.playT),w=(1-shot)*(this.smartOn?0:this.dynBlend);
    if(!(w>0))return 0;
    this.camera.getWorldDirection(this.axis);
    this.camera.position.addScaledVector(this.axis,-s.back*w).addScaledVector(UP,s.up*w);
    if(s.tilt!==0)this.camera.rotateX(-s.tilt*w);
    // Round 4b: the follow-through, toward the side the body went.
    if(s.turn!==0)this.camera.rotateY(-s.turn*this.playSide*w);
    return s.fov*w;
  }
  /** A gameplay shot asked for: played if cinematics are on and the ration
   *  allows (CameraBrain ShotGate): never two within SHOT_GAP, never inside
   *  the player's own string unless it is the string's ender, never over an
   *  authored shot. */
  private cuePlay(kind:PlayKind,ender:boolean,self:Fighter){
    if(!this.cinematics||this.smartOn||this.dynBlend<.5)return;
    if(!this.shots.allow(this.age,self.state.action==='light',ender,this.director.kind!=='none'))return;
    this.play=kind;this.playT=0;
    // Which side of the view the target is on: a knockdown's follow-through turns that way.
    const foe=this.lastBody;if(foe){const p=foe.group.position,c=this.camera.position;this.playSide=(p.x-c.x)*this.right.x+(p.z-c.z)*this.right.z>=0?1:-1;}
    const trauma=playShape(kind,0).trauma;if(trauma>0)this.trauma=Math.min(.8,Math.max(this.trauma,trauma));
  }

  /** Turn the framing away from whatever hides the opponent. Near a grounded
   *  dynamic duel, start during approach/windup, before hitstop holds the rig.
   *  Judge the rendered heading as well as its goal: lag must not release a
   *  useful dodge or keep pushing a goal that already gives a clear view. */
  private clearView(dt:number,base:number,pitch:number,closeMelee=false){
    this.dodgeWait=Math.max(0,this.dodgeWait-dt);
    if(closeMelee&&Math.abs(this.offAxis)<=ALPHA_MOST)this.dodgeGoal=THREE.MathUtils.clamp(this.dodgeGoal,
      Math.max(-DODGE_MOST,-ALPHA_MOST-this.offAxis),Math.min(DODGE_MOST,ALPHA_MOST-this.offAxis));
    const enter=closeMelee?MELEE_COVER_ENTER:COVER_ENTER,exit=closeMelee?MELEE_COVER_EXIT:COVER_EXIT;
    const current=closeMelee?this.coverage(this.yaw,pitch):0;
    const goal=base+this.dodgeGoal,goalCover=this.coverage(goal,pitch);
    if(goalCover>enter||(closeMelee&&current>enter&&goalCover>exit)){
      // The nearest heading that shows them, outward from where the dodge
      // already is: its own way first, else the way that carries the
      // opponent further from the body in front of them.
      // With none that clear in reach, the one that hides the least of
      // them, if that is a real improvement (a spirit at its user's shoulder
      // cannot always be looked past inside the homing cone).
      const way=this.dodgeGoal!==0?Math.sign(this.dodgeGoal):this.awayFrom>=0?1:-1;
      // If the cone cannot fully clear a close contact, still take a
      // measured reduction of at least25%; the old fixed .15 fallback could
      // reject every useful remaining angle when the goal covered .33.
      let found=false,best=this.dodgeGoal,least=closeMelee?goalCover*DODGE_SETTLE:Math.min(goalCover,enter*DODGE_SETTLE);
      for(let k=1;k*DODGE_STEP<=2*DODGE_MOST+1e-9&&!found;k++){
        for(let side=0;side<2&&!found;side++){
          const offset=this.dodgeGoal+(side?-way:way)*k*DODGE_STEP;
          if(!this.dodgeAllowed(offset))continue;
          const hidden=this.coverage(base+offset,pitch);
          if(hidden<exit){this.dodgeGoal=offset;found=true;}
          else if(hidden<least){least=hidden;best=offset;}
        }
      }
      if(!found)this.dodgeGoal=best;
      this.dodgeWait=DODGE_WAIT;
    }else if(this.dodgeGoal!==0&&this.dodgeWait<=0&&(!closeMelee||current<exit)&&this.coverage(this.heading,pitch)<exit){
      // Let go a step at a time, only while the step back is clear too - and
      // never while the heading, still on its way, has them hidden: in the
      // real client a strafe at arm's length outran the heading, and a turn
      // let go because the framing it was making for was clear left the
      // victim behind the player's back for half a second.
      const back=this.dodgeGoal-Math.sign(this.dodgeGoal)*Math.min(DODGE_STEP,Math.abs(this.dodgeGoal));
      if(this.coverage(base+back,pitch)<exit){this.dodgeGoal=Math.abs(back)<1e-9?0:back;this.dodgeWait=DODGE_WAIT;}
    }
    approach(this.dodge,this.dodgeGoal,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);
  }
  /** Whether a turn away of `offset` is one to make: within DODGE_MOST of
   *  the framing, and leaving the opponent within ALPHA_MOST of the view. */
  private dodgeAllowed(offset:number){return Math.abs(offset)<=DODGE_MOST+1e-9&&Math.abs(this.offAxis+offset)<=ALPHA_MOST;}
  /** Every body that might stand between the lens and the opponent, into
   *  `blockers`: the player, their spirit while it fights (see SPIRIT_SIDE),
   *  and everybody else alive and drawn (from the root: a third body only
   *  needs to be roughly right). */
  private gather(self:Fighter,foe:Fighter){
    this.blockerCount=0;
    const mine=this.nextBlocker();mine.x=this.meBox.x;mine.z=this.meBox.z;mine.low=this.meBox.low;mine.high=this.meBox.high;mine.radius=this.meBox.radius;
    const s=self.state,heavy=SPIRIT_HEAVY[s.fighter];
    // A combo ender (combos.ts; Fighter.ender's rule, repeated so the camera
    // does not import the renderer) is a move of its own, not the spirit's.
    const ender=!!s.branch&&(s.action==='heavy'||s.action==='special');
    if(heavy!==undefined&&s.alive&&!s.awakened&&!ender&&(s.action==='special'||s.action==='ultimate'||(s.action==='heavy'&&heavy))){
      const p=self.group.position,q=foe.group.position,forward=THREE.MathUtils.clamp(Math.hypot(q.x-p.x,q.z-p.z)-1.35,SPIRIT_NEAR,SPIRIT_FAR);
      const spirit=this.nextBlocker();spirit.x=p.x+Math.sin(s.yaw)*forward-Math.cos(s.yaw)*SPIRIT_SIDE;spirit.z=p.z+Math.cos(s.yaw)*forward+Math.sin(s.yaw)*SPIRIT_SIDE;
      spirit.low=p.y;spirit.high=p.y+SPIRIT_HEIGHT;spirit.radius=SPIRIT_RADIUS;
    }
    const crowd=this.director.crowd;
    if(crowd&&crowd.size>2){this.gatherSelf=self;this.gatherFoe=foe;crowd.forEach(this.gatherOne);this.gatherSelf=this.gatherFoe=undefined;}
  }
  private gatherOne=(body:Fighter)=>{
    if(body===this.gatherSelf||body===this.gatherFoe||!body.state.alive||!body.group.visible)return;
    const p=body.group.position,bulk=bodyBulk(body.state),box=this.nextBlocker();
    box.x=p.x;box.z=p.z;box.low=p.y;box.high=p.y+CROWN*bulk;box.radius=TORSO*bulk;
  };
  private nextBlocker(){
    if(this.blockerCount>=this.blockers.length)this.blockers.push(capsule());
    return this.blockers[this.blockerCount++];
  }
  /** How much of the opponent's box on screen (0..1) is behind the boxes of
   *  bodies nearer the lens, for the lens the rig would place looking along
   *  `heading` (the one it placed last frame, turned). Records in `awayFrom`
   *  which side of the biggest of them the opponent is on. */
  private coverage(heading:number,pitch:number){
    const sh=Math.sin(heading),ch=Math.cos(heading),back=this.boom*Math.cos(pitch)+this.pull.value*this.lockBlend,a=this.anchor;
    const ex=a.x-sh*back-ch*this.shoulder,ez=a.z-ch*back+sh*this.shoulder,ey=this.lensY;
    const cp=Math.cos(this.lookPitch),sp=Math.sin(this.lookPitch);
    this.coverMine=0;
    if(!this.rect(this.foeBox,ex,ey,ez,sh,ch,cp,sp))return 0;
    const x0=this.rX0,x1=this.rX1,y0=this.rY0,y1=this.rY1,depth=this.rDepth,area=(x1-x0)*(y1-y0);
    if(!(area>1e-9))return 0;
    let covered=0,biggest=0;
    for(let i=0;i<this.blockerCount;i++){
      if(!this.rect(this.blockers[i],ex,ey,ez,sh,ch,cp,sp)||this.rDepth>=depth)continue;
      const w=Math.min(x1,this.rX1)-Math.max(x0,this.rX0),h=Math.min(y1,this.rY1)-Math.max(y0,this.rY0);
      if(w<=0||h<=0)continue;
      covered+=w*h;
      // The first blocker is always the player's own body.
      if(i===0)this.coverMine=Math.min(1,w*h/area);
      if(w*h>biggest){biggest=w*h;this.awayFrom=(x0+x1)/2-(this.rX0+this.rX1)/2;}
    }
    return Math.min(1,covered/area);
  }
  /** Project a capsule for a lens at (ex, ey, ez) looking along the heading
   *  whose sine and cosine are `sh`, `ch`, pitched by the angle whose are
   *  `sp`, `cp`: its box in normalised screen units into rX0..rY1 and its
   *  depth into rDepth. False when it is not in front of the lens. */
  private rect(box:Capsule,ex:number,ey:number,ez:number,sh:number,ch:number,cp:number,sp:number){
    const dx=box.x-ex,dz=box.z-ez,flat=dx*sh+dz*ch,across=dz*sh-dx*ch;
    const top=box.high-ey,low=box.low-ey,mid=(top+low)/2;
    const depth=flat*cp+mid*sp;if(depth<NEAR_DEPTH)return false;
    const dTop=Math.max(NEAR_DEPTH,flat*cp+top*sp),dLow=Math.max(NEAR_DEPTH,flat*cp+low*sp);
    const yTop=(top*cp-flat*sp)/(dTop*this.tanV),yLow=(low*cp-flat*sp)/(dLow*this.tanV);
    this.rX0=(across-box.radius)/(depth*this.tanH);this.rX1=(across+box.radius)/(depth*this.tanH);
    this.rY0=Math.min(yTop,yLow);this.rY1=Math.max(yTop,yLow);this.rDepth=depth;
    return true;
  }
}
