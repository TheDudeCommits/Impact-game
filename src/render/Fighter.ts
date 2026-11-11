import { forgedMoveFor } from '../engine/sim/forgedKits';
import { DREAM_IMPACT } from './dreamFlag';
import { passWhileHidden } from './hiddenMatrices';
import { areaAnimOf } from '../engine/sim/areaMoves';
import {rotfalkeAuthoredKick} from '../game/fighters/rotfalke';
import { preserveAmagoiCloakSurface } from './look/amagoiShell';
import { madakeAuthoredKick,madakeAuthoredRushStep,madakeHandState } from '../game/fighters/madake';
import { mizuhikiAuthoredContactCarry } from '../game/fighters/mizuhiki';
import { shibuichiAuthoredKick,shibuichiAuthoredGround,shibuichiAuthoredShoulderStep } from '../game/fighters/shibuichi';
import { hagureAuthoredContactStep } from './signature/HagureContactStep';
import { hagureStrikeSurface } from './signature/HagureStrikeSurface';
import { applyHagureCosmicLook } from './signature/HagureCosmicLook';
import { rakuchoAuthoredJabStep } from './signature/RakuchoTendrilsContact';
import { preserveMinasePaintedFolds } from './look/minaseCreases';
import { shakudoBladeVisible } from '../game/fighters/shakudo';
import { shakudoAuthoredKick, shakudoAuthoredGround } from './signature/ShakudoAlchemyContact';
import { torsionAuthoredHover } from './signature/TorsionPsychicContact';
import { TorsionFlight } from './signature/TorsionFlight';
import { highsunSunhammerVisible } from '../game/fighters/highsun';
import { tokanMeshState, tokanStrikeJoint } from '../game/fighters/tokan';
import { strappadoAuthoredKick } from './signature/StrappadoStringsContact';
import { barrowAuthoredKick } from './signature/BarrowEmperorContact';
import { kusushiAuthoredKick } from '../game/fighters/kusushi';
import { SUZURAN_CINEMATIC } from '../game/fighters/suzuran';
import { SENKO_CINEMATIC, senkoHandVariants, senkoAuthoredKick } from '../game/fighters/senko';
import { BUNA_CINEMATIC } from '../game/fighters/buna';
import { oyashioHandVariants } from '../game/fighters/oyashio';
import { shakugoArmVariants, SHAKUGO_CINEMATIC } from '../game/fighters/shakugo';
import { RELEASED_FIGHTERS } from '../game/rosterAvailability';
import { rosterPrefetch } from '../loading/rosterPrefetch';
import {PriorityQueue} from '../loading/PriorityQueue';
import * as THREE from 'three';
import { addShaderPatch } from './look/shaderPatch';
import { applyAuthoredInk, applyHitFlash, applyInkShell, applyLimbSmear, applyTeamTrim, applyToonShading, headWeights, limbWeights, teamTrim, toonKind } from './look/toonShading';
import { applyThreatInk, threatInk } from './ThreatOutline';
import { SHADOW_SIDE_FIGHTERS, fixShadowSide } from './look/shadowSide';
import { HAND_SCALE } from './look/proportions';
import { HAND_GRIP, gripPlan } from './look/grip';
import { HANDS, HandLayer } from './look/hands';
import { handRow } from './look/handTable';
import { characterClips, isCharacterMotion, mirrorClip, mirrorSource, sceneJoints, strikeFraction } from './characterMotion';
import { appendClips, clipKey, findClipIn, joinClips } from './clipMatch';
import { clipMapFor, type BodyClipMap } from '../engine/client/clips';
import { FIGHTER_SOCKETS, placeSocket, socketAsk, type SocketAsk, type SocketKind } from '../engine/client/sockets';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ClipPool, shareClips } from './clipShare';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { disposeSkeletons, shareSkeletons } from './sharedSkeletons';
import { releaseTextures } from './sharedTextures';
import { FIGHTERS } from '../config';
import { originalBody, shownFighters } from '../originals/launch';
import { companionPlacement } from '../originals/companionLooks';
import { stanceSize } from '../originals/stanceSize';
import { coatFlownWhileDown, coatFlownInKick } from '../originals/apply';
import { originalAuthoredKick } from '../originals/authoredKicks';
import { EMPTY_HANDED } from '../originals/emptyHands';
import { roundMirror } from '../originals/finisherMirror';
import { releaseHeldJoints } from '../originals/heldHands';
import { seedOriginalClocks } from '../originals/motionClocks';
import { LUCY_TIDE, TIDE_PLAN, TIDE_CLIP, MONSOON_ANIM, tideHammer } from '../originals/lucyTide';
import { areaCastAnim, castHold, newCastHold } from '../originals/areaCasts';
import { resolveSkeleton } from './skeleton';
import { DEFAULT_IDLE, IDLE_PROFILES } from './idle/profile';
import { IdleRig, hashSeed } from './idle/life';
import { Ragdoll, ragdollsReady } from './Ragdoll';
import { COMBO_KEYS, COMBO_SLOT, comboMove, hasCombos, type ComboKey } from '../game/combos';
import { isTechnique, TECHNIQUE_KEYS, TECHNIQUE_SLOT, type TechniqueKey } from '../game/techniques';
import { comboClip, comboFormClip, type ComboClip } from './comboClips';
import { LAUNCH_GRAVITY, MOVES, OUTCOME_LIFT, PUSH_RADIUS, RUSH_STAGES, WHIFF_RECOVERY, meleeReach, type MoveDefinition, type Outcome } from '../game/moves';
import { FALL_GRAVITY, jumpArc } from '../game/moves'; // Round 4b (JUMP): the jump clip paced on each fighter's own arc.
import { AWAKENINGS, AWAKENING_ENTRY, AWAKENING_SWAP, awakeningSwapAt, moveFor as awakenedMoveFor, rushMove as authoredRushMove } from '../game/awakening';
import { lockRoundMove } from '../game/lockCombat';
import { LOCK_ROUND_FILL } from '../game/lockRoundFill';
import { LOCK_ROUND_CLIPS, LOCK_TAKE_LEAD, LOCK_TAKE_TAIL, type LockTake } from './lockRound';
import { standingAura } from './standingAura';
import { OUTFITS, outfitFor, type OutfitDef } from '../game/economy/outfits';
import { applyOutfitPalette } from '../originals/outfitPalette';
import { isSvanhildPlumage, svanhildPlumageFlow } from '../originals/svanhildPlumage';
import { lensFacingNormals, lensNormalPatch } from '../originals/lensNormals';
import { LANDED, type LandedBlow } from '../game/landedBlows';
import { TAISEI_MELEE_CONTACTS, TAISEI_TRANSMISSION } from './taiseiMeleeContact';
import { installOcclusionFade } from './OcclusionFade';
import contactFrames from '../game/data/contactFrames.json';
import locomotion from '../game/data/locomotion.json';
import { SecondaryMotion } from './SecondaryMotion';
import { SUNRISE_FLOAT, bindFormExtras, floatBob, floatLanding, floatTarget } from './gummy/sunrise';
import { aheadLoader } from '../loading/modelFiles';
import { closedFist, openHandName } from './gummy/openHands';
import { GRAND_TIDE_GRAB, GRAND_TIDE_TAKE, grandTideGrab, grandTideOut } from './gummy/grand-tide';
import { CROSSMATCH_TAKE } from './ward/crossmatch';
import type { Transplanted } from '../engine/client/transplantTakes';
import type { AttackSlot, FighterId, PlayerState, ReactionKind } from '../game/types';
import { VFX } from './vfxLevel';

const isTaisei=(state:PlayerState)=>state.fighter==='taisei';
const AIM_YAW=THREE.MathUtils.degToRad(52),AIM_PITCH=THREE.MathUtils.degToRad(24);
const FORWARD=new THREE.Vector3(0,0,1);
// Mobile-game attack clips carry the whole move on the root: Kosho rises 7.9 m
// on COUP DE FEU and Hachoir travels 11.3 m sideways. The server keeps the
// fighter where it is, so the model flies off and snaps home when the clip
// ends. Soft-clamping the root keeps the body near its gameplay position and
// in frame; tanh compresses smoothly, so small authored motion is untouched
// and only the extremes are pulled in.
const INK_DEPTH_BIAS=.035;
/** Round 3f (POPS2): how fast a body a move carried out from where it stands (Mirage Draw leaves Kenzo 1.8 m past his
 *  own feet, a heavy Gummy 2.2 m) is brought home when the next move cuts in, at the blend's steepest, in metres a
 *  second; and the longest that return may take. A light's blend is a twentieth of a second, and the fourth blind
 *  critic's Mirage Draw cancelled into Fang Crossing put Kenzo's head 1.80 m back in one frame. */
const ROOT_RETURN_RATE=5,ROOT_RETURN_MAX=.4;
/** How long a ground smash's blow takes to land once its feet are down, in seconds (see `plunge`). */
const PLUNGE_SLAM=.06;
const ROOT_CLAMPED=['light','heavy','special','ultimate'];
/** What a jump clip is allowed to add to the arc the server is already flying
 *  the body along. Measured, they carry their own leap as well: 0.31 m on
 *  Konta and 0.97 m on Gummy, on top of a 1.61 m simulated jump - which is
 *  why every fighter touched down with their knees still tucked a quarter of a
 *  metre over the floor. A little rise is left so a takeoff still pushes off,
 *  and a little drop so a tuck still tucks. */
const JUMP_ROOT={travel:.5,rise:.06,drop:.14};
const GUARD_ROOT={travel:.3,rise:1,drop:1};
/** What a reaction clip may add to the knockback the server is already
 *  flying the body along. KoKo's `slammed` carries his hips 1.6 m back and
 *  a metre up on top of the simulated launch, so the drawn body flew two
 *  metres from the one the lock-on, the name tag and the hit spark were
 *  placed on. A stagger still staggers and a slam still rises a little; the
 *  drop is free, because lying down is most of what these clips are for. */
const REACTION_ROOT={travel:.55,rise:.35,drop:Infinity};
/** How close the middle of an attacker's drawn torso may come to the middle
 *  of the opponent's, in metres along the ground. Two torsos are about a
 *  quarter of a metre deep each; what is left between them is where the
 *  fist, the foot and the blade land. Seven of the sixteen fighters had no
 *  root cap at all, and the round-1 rush clips carry up to 1.9 m of hips
 *  travel: Shirokane's kunai rush was drawn inside Nigo. */
const DRAWN_GAP=.85;
/** The same for a fighter swinging a blade (round 3b, see TORSO_RADIUS): the
 *  swordsman is held near the distance the simulation strikes from
 *  (CONTACT_GAP) less a hand's breadth, rather than let a lunge carry his
 *  torso to within a metre - which with a two-and-a-half-metre GRAVEDIGGER
 *  put the blade through the middle of the body it cut. Measured, Gaunt's drawn
 *  torso came 1.01 m from his victim's at the simulation's 1.40. */
/** The spring profile a fighter's garment chains borrow (SecondaryMotion.ts SPRING_PROFILES). Round 5b (RIG): none
 *  now - every sprung fighter has a profile line of its own there, so a cape is tuned apart from the coat or the
 *  headband it used to share one with (Ippon's on Konta's, Levin's on Gaunt', the Emperors' and Shiun's on Ward's). */
const GARMENT:Partial<Record<FighterId,FighterId>>={};
const DRAWN_GAP_ARMED:Partial<Record<FighterId,number>>={chohan:1.17,yodaka:1.2,akayuri:1.1,hisame:1.2,svanhild:1.2,mizuhiki:1.15,shidare:1.3,hinomoto:1.35,onigawara:1.35,cardo:1.35,highsun:2,sashigane:1.15,wataame:1.1,bruin:1.1,buna:1.3,kuzu:1.05,sorayomi:1.05,strix:1.25,gaunt:1.25,kenzo:1.15,nigo:1.15,ward:1.2,shiden:.95,shirokane:.95,gorai:1.3,haldor:1.35,sorrel:1.15,dorado:1.15,
  // The shop's swordsmen, a hand's breadth inside the distance each strikes from (CONTACT_GAP): Vesper's sabre, Asahi's
  // Sunsteel katana, Levin's blades, and False Encore in base Shiun's hand (3 October). Without them a lunge drew their
  // torsos to the unarmed 0.85 m and the blade through the body.
  vesper:1.15,asahi:1.1,levin:1.1,shiun:1.15,
  // Scout Hawser's, Levin's kit in his hands (13 October).
  hawser:1.1};
/** The furthest the separation may draw a swing's hips BACK from where the
 *  clip stands them, in metres: two rigs whose idles stand their torsos ahead
 *  of their capsules (Ward's by 0.19 m, Gaunt's by 0.15) meet 0.76 m apart at
 *  the simulation's 1.1, and a lunge's lean takes the chest a fifth of a
 *  metre further - the hips give it back. And how fast, in metres a second,
 *  so the give is a weight shift rather than a hop. */
const ROOM_PULL=.3,ROOM_PULL_RATE=2.5;
// (Round 95: deeper and held on - lead .3 to .42, the torsos to .52, held .12 s past the blow and walked home over .28: the
// blind critics, of the string after round 90, "Tempo hits at full reach ... keeps Konta at about arm's length"; the
// bodies should overlap from blow to blow and the striker drive through the body it hits.)
const DREAM_STEP={lead:.42,gap:.52,rise:.16,hold:.12,out:.28} as const;
/** Bodies whose light blows already step their own measured way in (the authored contact steps: Fighter's
 *  `stepGap`/`stepLead`), and so take no dream step on top. */
const OWN_STEPS=new Set<FighterId>(['murex','madake','rakucho','hagure','mizuhiki','shibuichi','kinu']);
/** And bodies whose light reaches the body it strikes by itself: Gummy's Snapback Jab, the rubber arm stretched to it
 *  (gummy/stretch). Stepped in as well (round 95's deeper step), the arm had nothing left to stretch for and its fist
 *  stopped short inside the body: tests/gummyStretch. */
const REACHING_LIGHTS=new Set<FighterId>(['gummy']);
/** The soft end of the forward cap: travel within this of the cap is eased
 *  into it rather than stopped. The cap used to be `cap*tanh(travel/cap)`
 *  applied once travel passed the cap, which is 0.76 of the cap on the frame
 *  it is crossed - a quarter of the room given back in one frame. */
const ROOM_KNEE=.08;
const softCap=(travel:number,cap:number)=>travel<=cap-ROOM_KNEE?travel:cap-ROOM_KNEE+ROOM_KNEE*Math.tanh((travel-cap+ROOM_KNEE)/ROOM_KNEE);
/** How a move closes the distance, where the simulation does it for the clip
 *  (MoveDefinition in the merged combat contract; read defensively so this
 *  holds on either side of that merge). A charge-in move - Senpugan,
 *  Shrike Bolt, the Sickle Bolt - slides the body back off a target it
 *  started inside and then drives it in over the last third of a second, so
 *  the clip's own lunge is drawn in place rather than fighting the slide
 *  (CHARGE_ROOM). An iai draw dashes three to five metres straight through
 *  the target just before its blow and ends past them, on purpose, so from
 *  THROUGH_LEAD before the blow neither room cap applies. */
type Approach={chargeIn?:number;dashThrough?:boolean};
const CHARGE_ROOM=.1,THROUGH_LEAD=.25;
/** How fast a cap that no longer applies lets go, in metres a second - the
 *  rate the room already opens at, so a released lunge is not a snap. */
const ROOM_RELEASE=5;
/** How far from the logical target point a drawn body may stand and still be
 *  taken for it: the target point is the snapshot and the body is drawn from
 *  an interpolation a few frames behind it. */
const OPPONENT_MATCH=1.2;
/** A cap that is not there: fighters without an authored rootMotion cap are
 *  still stopped at the opponent's body. */
const UNCAPPED={travel:Infinity,rise:Infinity,drop:Infinity};
/** The simulation's gravity, in metres a second squared. Read only, and only
 *  to work out how long a falling body has before the floor arrives, so the
 *  fall clip's compression frames can be put on that frame rather than after
 *  it. Mirrors src/game/simulation.ts; nothing here writes y. */
const JUMP_GRAVITY=23;
const softLimit=(distance:number,cap:number)=>Number.isFinite(cap)?cap>1e-6?cap*Math.tanh(distance/cap):0:distance;
const _rootWorld=new THREE.Vector3(),_rootShift=new THREE.Vector3(),_rootLead=new THREE.Vector3(),_rootOther=new THREE.Vector3();
const _centerTop=new THREE.Vector3(),_rootRaw=new THREE.Vector3(),_rootBasis=new THREE.Vector3();
/** Kurobi's tails clear the camera: hidden within the first distance of
 *  the eye, whole past the second, hash-dithered between (see attachForm). */
const FOX_CLEAR:[number,number]=[2.4,3];
/** Joint names the procedural layers ask for every frame, allocated once. */
const SHOULDERS=['LeftShoulder','RightShoulder'],UPPER_ARMS=['LeftArm','RightArm'],HAND_SIDES=['Right','Left'] as const;
/** A soft limit that is linear near nothing and never passes `limit`. */
const softTo=(v:number,limit:number)=>limit*Math.tanh(v/limit);
/** The axis a turn about which tips a body toward a horizontal heading. */
const tipAxis=(h:THREE.Vector3,out:THREE.Vector3)=>out.set(h.z,0,-h.x).normalize();
/** How a blow's twist, its tip and a launch's fold are shared along the
 *  spine, root first, and each share's total for a chain of that length. */
const TWIST_SHARE=[.2,.25,.3,.25],LEAN_TIP=[.1,.3,.3,.3],FOLD_LAUNCH=[0,.3,.35,.35];
const shareTotals=(shares:number[])=>shares.map((_,n)=>shares.slice(0,n+1).reduce((a,b)=>a+b,0)||1);
const TWIST_TOTAL=shareTotals(TWIST_SHARE),TIP_TOTAL=shareTotals(LEAN_TIP),FOLD_TOTAL=shareTotals(FOLD_LAUNCH);
const _holdForward=new THREE.Vector3(),_holdPoint=new THREE.Vector3(),_holdSide=new THREE.Vector3();
const _rubberTarget=new THREE.Vector3(),_rubberElbow=new THREE.Vector3(),_rubberWrist=new THREE.Vector3(),_rubberAlong=new THREE.Vector3(),_rubberToward=new THREE.Vector3(),_rubberDir=new THREE.Vector3(),_rubberAxis=new THREE.Vector3(),_rubberPelvis=new THREE.Vector3(),_rubberBack=new THREE.Vector3();
const _rubberTurn=new THREE.Quaternion(),_rubberLocal=new THREE.Vector3();
const _tideVictim=new THREE.Vector3();
/** Round 6 (GUMMY ULT): the grab's world forward (Fighter.grandTideGrabStretch). */
const _grabForward=new THREE.Vector3();
const _hitShove=new THREE.Vector3(),_hitLean=new THREE.Vector3(),_hitWhip=new THREE.Vector3(),_hitFling=new THREE.Vector3(),_hitAxisD=new THREE.Vector3(),_hitAxis=new THREE.Vector3(),_hitAxisB=new THREE.Vector3(),_hitAxisC=new THREE.Vector3(),_hitFrom=new THREE.Vector3(),_hitTo=new THREE.Vector3();
const _torsoA=new THREE.Vector3(),_torsoB=new THREE.Vector3(),_torsoH=new THREE.Vector3(),_strikeP=new THREE.Vector3(),_strikeQ=new THREE.Vector3(),_strikeTip=new THREE.Vector3();
const _touchDir=new THREE.Vector3(),_touchPoint=new THREE.Vector3(),_pushWant=new THREE.Vector3(),_pushStep=new THREE.Vector3();
/** The contact solver (see TORSO_RADIUS). A body - a capsule from `a` to
 *  `b`, `radius` round, and a sphere of `headRadius` on `head` - is to be
 *  pushed along the level heading (hx,hz). Every striking surface handed to
 *  `contactSurface` adds the stretch of that push over which it would be
 *  inside the body; `endContact` merges them into runs and returns the least
 *  push that leaves every surface outside. For a fist that is how deep it
 *  sits; for the forte of a blade thrust along the push it is the whole of
 *  the steel in the way, which a point's depth alone would never clear. The
 *  runs stay for `contactPush`, which never lets the body back into one; the
 *  deepest surface, and how deep, stay for the touch. */
const CONTACT={a:new THREE.Vector3(),b:new THREE.Vector3(),radius:0,head:new THREE.Vector3(),headRadius:0,hasHead:false,hx:0,hz:0,
  deepest:0,point:new THREE.Vector3(),enter:new Float64Array(768),exit:new Float64Array(768),count:0,runs:0};
const _cq=new THREE.Vector3(),_cu=new THREE.Vector3();
const _cullCentre=new THREE.Vector3(),_cullInverse=new THREE.Matrix4(),_cullBox=new THREE.Box3(),_viewSphere=new THREE.Sphere();
/** How much bigger than the body as it was posed at setup a culling sphere is: room for a swing, a lunge off the hips
 *  and a weapon's reach (Haldor's bisento held overhead, Magatsu's spear at full length). See `cullBounds`. */
const CULL_PAD=1.5,CULL_REACH=1;
function beginContact(a:THREE.Vector3,b:THREE.Vector3,radius:number,head:THREE.Vector3|undefined,headRadius:number,hx:number,hz:number){
  const c=CONTACT;c.a.copy(a);c.b.copy(b);c.radius=radius;c.hasHead=!!head;if(head)c.head.copy(head);c.headRadius=headRadius;
  c.hx=hx;c.hz=hz;c.deepest=-TOUCH_REACH;c.count=0;c.runs=0;
}
/** The push `t` along the heading for which `t`^2 A - 2 t B + C <= 0: the
 *  stretch over which a surface is inside, kept if any of it lies ahead. */
function contactStretch(A:number,B:number,C:number){
  const c=CONTACT;
  if(A<1e-9||c.count>=c.enter.length)return;
  const disc=B*B-A*C;if(disc<=0)return;
  const root=Math.sqrt(disc),exit=(B+root)/A;if(exit<=0)return;
  c.enter[c.count]=(B-root)/A;c.exit[c.count]=exit;c.count++;
}
/** One striking surface: how deep it is now (for the touch), and - where it
 *  is one the body should be pushed off (`push`) - its stretch. */
function contactSurface(p:THREE.Vector3,push=true){
  const c=CONTACT;
  // The torso: the surface's offset from the nearest point of the spine, and
  // as the body slides along the heading, the same offset across the spine
  // (at the ends of the capsule, what is left of the radius past the end).
  _cu.subVectors(c.b,c.a);const long=_cu.lengthSq();
  const s=long>1e-9?THREE.MathUtils.clamp(_cq.subVectors(p,c.a).dot(_cu)/long,0,1):0;
  _cq.copy(c.a).addScaledVector(_cu,s);_cq.subVectors(p,_cq);
  const inside=c.radius-_cq.length();
  if(inside>c.deepest){c.deepest=inside;c.point.copy(p);}
  if(push){
    if(long>1e-9)_cu.multiplyScalar(1/Math.sqrt(long));else _cu.set(0,1,0);
    const qu=_cq.dot(_cu),hu=c.hx*_cu.x+c.hz*_cu.z;
    const qx=_cq.x-qu*_cu.x,qy=_cq.y-qu*_cu.y,qz=_cq.z-qu*_cu.z,hx=c.hx-hu*_cu.x,hy=-hu*_cu.y,hz=c.hz-hu*_cu.z;
    contactStretch(hx*hx+hy*hy+hz*hz,qx*hx+qy*hy+qz*hz,qx*qx+qy*qy+qz*qz-(c.radius*c.radius-qu*qu));
  }
  if(c.hasHead){
    _cq.subVectors(p,c.head);
    const within=c.headRadius-_cq.length();
    if(within>c.deepest){c.deepest=within;c.point.copy(p);}
    if(push)contactStretch(1,_cq.x*c.hx+_cq.z*c.hz,_cq.lengthSq()-c.headRadius*c.headRadius);
  }
}
/** Sorts and merges the stretches into runs (left in enter/exit[0..runs)),
 *  and returns the least push, from nothing, that is in none of them. */
function endContact(){
  const c=CONTACT,n=c.count,enter=c.enter,exit=c.exit;
  for(let i=1;i<n;i++){const e=enter[i],x=exit[i];let j=i-1;while(j>=0&&enter[j]>e){enter[j+1]=enter[j];exit[j+1]=exit[j];j--;}enter[j+1]=e;exit[j+1]=x;}
  let runs=0;
  for(let i=0;i<n;i++){
    if(runs>0&&enter[i]<=exit[runs-1]+1e-4){if(exit[i]>exit[runs-1])exit[runs-1]=exit[i];continue;}
    enter[runs]=enter[i];exit[runs]=exit[i];runs++;
  }
  c.runs=runs;
  return runs>0&&enter[0]<=1e-4?exit[0]:0;
}
/** Which guarded run a push along the heading of `t` would sit in, or -1. */
function contactRun(t:number){
  for(let i=0;i<GUARD.runs;i++)if(t>GUARD.enter[i]+1e-5&&t<GUARD.exit[i]-1e-5)return i;
  return -1;
}
/** Keeps the solver's runs as the ones the push is guarded by. */
function guardContact(){
  const c=CONTACT;GUARD.hx=c.hx;GUARD.hz=c.hz;GUARD.runs=c.runs;
  for(let i=0;i<c.runs;i++){GUARD.enter[i]=c.enter[i];GUARD.exit[i]=c.exit[i];}
}
/** The leg joints a blow can land with, right side first: the heel, the toes
 *  and the knee. And how far apart a blade is tested along its length. */
const STRIKE_LEGS=[['RightFoot','RightToeBase','RightLeg'],['LeftFoot','LeftToeBase','LeftLeg']] as const,BLADE_STEP=.07;
/** How much of a blade, from the hand, the body is pushed off: the forte,
 *  BLADE_FORTE of its length and never more than BLADE_FORTE_MOST metres.
 *  The rest of the steel cuts across the front of the body the way a sword
 *  does, and still lands the blow; pushing a body clear of a two-metre blade
 *  swung at a metre and a half would throw it further than any reaction.
 *  The blade is tested from BLADE_FROM of its length, past the fist. */
const BLADE_FORTE=.6,BLADE_FORTE_MOST=.75,BLADE_FROM=.08,BLADE_MIN=.45;
const BLADE_BONE=/^(?!.*sheath)(blade|sword|katana|weapon)/i;
const MOUTH_BLADE:Partial<Record<FighterId,{bone:string;at:[number,number,number];turn:[number,number,number,number]}>>={
  kenzo:{bone:'bladea2_joint_07',at:[-.008,-.08,.095],turn:[-.6807,-.7081,-.1388,.1265]}};
const _mouthM=new THREE.Matrix4(),_mouthW=new THREE.Matrix4(),_mouthP=new THREE.Vector3(),_mouthQ=new THREE.Quaternion(),_mouthS=new THREE.Vector3();
/** The runs of the fighter whose blow needs the most push this frame, kept
 *  out of the contact solver's working state (see `contactClear`). */
const GUARD={hx:0,hz:0,enter:new Float64Array(768),exit:new Float64Array(768),runs:0};
const _aimTarget=new THREE.Vector3(),_aimOrigin=new THREE.Vector3(),_aimDirection=new THREE.Vector3();
const _aimSwing=new THREE.Quaternion(),_aimShare=new THREE.Quaternion(),_aimWorld=new THREE.Quaternion();
const _aimGroup=new THREE.Quaternion(),_aimInverse=new THREE.Quaternion(),_aimParent=new THREE.Quaternion();
const _aimParentInverse=new THREE.Quaternion(),_aimLocal=new THREE.Quaternion();
const _leanAxis=new THREE.Vector3(),_leanWorld=new THREE.Quaternion(),_leanShare=new THREE.Quaternion();
const _leanParent=new THREE.Quaternion(),_leanParentInverse=new THREE.Quaternion(),_leanLocal=new THREE.Quaternion();
const _leanPoint=new THREE.Vector3(),_step=new THREE.Vector3(),_foldAxis=new THREE.Vector3();
const _flightSide=new THREE.Vector3(),_flightHeading=new THREE.Vector3(),_flightBody=new THREE.Vector3(),_flightPoint=new THREE.Vector3();
const _handForward=new THREE.Vector3();
let contactFalloff:THREE.DataTexture|undefined;
/** One radial falloff shared by every fighter's contact shadow: dense under
 *  the feet, gone by the rim, so the pool has no edge to read as a circle. */
function contactShadowFalloff(){
  if(contactFalloff)return contactFalloff;
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2,t=Math.max(0,Math.min(1,1-d));
    const v=Math.round(255*t*t*(3-2*t)),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  contactFalloff=new THREE.DataTexture(data,size,size);contactFalloff.needsUpdate=true;
  return contactFalloff;
}
/** Scratch for chargePosition, which the effects read every frame of a charge. */
const _chargeA=new THREE.Vector3(),_chargeB=new THREE.Vector3(),_chargeC=new THREE.Vector3();
const _blendTarget2=new THREE.Vector3();
/** How much a metre of root travel is worth against a radian of joint rotation
 *  when deciding how long a transition should take. */
const ROOT_TRAVEL_WEIGHT=.32;
const _ikA=new THREE.Vector3(),_ikB=new THREE.Vector3(),_ikC=new THREE.Vector3(),_ikT=new THREE.Vector3();
const _ikAB=new THREE.Vector3(),_ikAC=new THREE.Vector3(),_ikAT=new THREE.Vector3(),_ikBA=new THREE.Vector3(),_ikBC=new THREE.Vector3();
const _ikAxis=new THREE.Vector3(),_ikTurn=new THREE.Quaternion(),_ikFoot=new THREE.Quaternion(),_ikAnkle=new THREE.Vector3();
const _blendTarget=new THREE.Quaternion(),_strideFrom=new THREE.Quaternion(),_strideBack=new THREE.Quaternion();
const UP=new THREE.Vector3(0,1,0);
/** How a lean is shared along the spine, root first: the hips give a little,
 *  the chest most of it. Trimmed and renormalised to whatever the rig has. */
const LEAN_SHARE=[.22,.3,.28,.2];
/** The feel pass, iteration twelve (the animation agent's proposal): a turn's bank follows the sideways
 *  force of the path the body takes - its speed times how fast that path bends - at `share` of the lean that force
 *  asks of a runner (atan(a/g)), up to `most`; none on the spot (the hip lead sells a pivot) and none at the hips (the
 *  legs stay under the body). It followed how fast the facing turned, half of it standing still, a fifth of it at the
 *  hips, on top of a sideways lean toward the change in velocity: a body tipping over feet that never stepped out, the
 *  benchmark's "turn lean that reads as skating". */
export const BANK={share:.3,most:THREE.MathUtils.degToRad(5),ease:14};
/** Where a blow landed on the body, in metres above the struck fighter's own
 *  feet. Under the first is a body shot that jackknifes the spine over it;
 *  over the second is a head shot that arches the back away from it. */
/** How far a clip may move a held prop from where the idle puts it before it
 *  is taken to have dropped it rather than moved it. */
const HELD_SLACK=.25;
/** A won match, in preference order. The loop is preferred over the one-shot
 *  because the round is over and he can hold it; four of the ten ship one and
 *  the rest fall back to their idle, which is what all ten did before. */
const VICTORY=['Cardo Victory','Bruin Victory','Aquilo Victory','Svanhild Victory','Chohan Victory','Aqrab Victory','Tsubute Victory','Psyche Victory','Ovid Resolve','Hawser Victory','Colossus Victory','Rotfalke Victory','Bonsho Victory','Pilot Steady','Kinu Victory','Madake Victory','Shakudo Victory','Minase Victory','Onigawara Victory','Kubiwa Victory','Torsion Victory','Highsun Victory','Lanthorn Victory','Hikui Victory','Ume Victory','Tokan Victory','Strappado Victory','Unari Victory','Barrow Victory','Kusushi Victory','Hakushi Victory','Suzuran Victory','Wataame Victory','Senko Victory','Buna Victory','Oyashio Victory','Adad Victory','Shijima Victory','Akaito Victory','Tempo Victory','Tancho Victory','Bellows Victory','Mikage Victory','Old Fire Salute','victory_lp','victory','Konta pose','_Idle','Idle','taisei-ready','stance'];
/** The feel pass, iteration twelve: a victory authored in two parts (scripts/fanim/victories.py) - this,
 *  the move into the pose, played once from the start of the win and held on its last frame, then the pose's own
 *  breathing loop (VICTORY's `victory_lp`), which starts on that frame. A clip that loops replays whatever it opens
 *  with at every seam, and the win is held for as long as the results are up. A body without one plays VICTORY. */
const VICTORY_ENTRY='victory_in';
const FOLD_LOW=1.12,FOLD_HIGH=1.48;
/** The dream loop, round 28 (23 October 2026): a standing body's hurt drawn four ways (scripts/fanim/dream_hurts.py) -
 *  snapped back, doubled over, spun to its left or its right - where it played its one hurt on every blow of a string.
 *  CLIP_RULES key -> clip name. Taisei's and Ouga's (taisei-fanim7, ouga-fanim7); since round 90 a body without them
 *  borrows Taisei's, fitted to its rig (BORROWED_TAKES), and plays its own only where it cannot. */
export const DREAM_HURTS={'dream back':'DZ recoil back','dream fold':'DZ recoil fold','dream spin L':'DZ recoil spin L','dream spin R':'DZ recoil spin R'} as const;
/** And the flinch's: the head knocked back and the arms jolted out, where the roster's cringe snatched them in (on
 *  Ouga's crossed-arm stance they never uncrossed). */
export const DREAM_FLINCH='DZ flinch';
const BORROWED_TAKES=new Set<string>([...Object.keys(DREAM_HURTS),'dream flinch','abdomen']);
/** Which of them a fresh blow is drawn with: a string's stages take turns - snapped back, folded, spun the way the
 *  blow travelled across the body (`side`, + to its left, as the reaction layer turns it: `hitReact`) - so no two blows
 *  in a row are drawn alike; and as the dream string throws them (round 29: DREAM_STAGES): a punch to the face, a knee
 *  into the gut, a kick to the head. (Not by where it landed: the server lands every melee blow at the body's centre,
 *  1.05 m up, under FOLD_LOW - by its height every blow folded.) */
export function dreamHurt(stage:number,side:number,lock=false):keyof typeof DREAM_HURTS{
  const turn=((stage%3)+3)%3;
  if(lock)return turn===0?'dream back':turn===2?'dream fold':side>0?'dream spin L':'dream spin R';
  return turn===0?'dream fold':turn===1?'dream back':side>0?'dream spin L':'dream spin R';
}
/** The dream loop, round 29 (scripts/fanim/dream_strings.py): a string's stages as Taisei throws
 *  them - his second blow a flying knee, his third a roundhouse to the head (taisei-fanim8), where his three-hand string drove an
 *  arm straight out three times. CLIP_RULES key per rush stage (1-based); each posed over the clip its stage plays and
 *  struck on that stage's measured contact (contactFrames.json rush1..), so the game draws it where the stage was. */
const DREAM_STAGES=['DZ Rush 1','DZ Rush 2','DZ Rush 3'] as const;
/** The dream loop, round 42: an ender's row (comboClips.ts) for its authored take (`dream ender <key>`) - the same
 *  seconds and contact under the take's own name. One object a row and name, as the rows themselves are one each. */
const dreamRows=new WeakMap<ComboClip,Map<string,ComboClip>>();
function dreamRow(own:ComboClip,name:string){let rows=dreamRows.get(own);if(!rows)dreamRows.set(own,rows=new Map());let row=rows.get(name);if(!row)rows.set(name,row={...own,clip:name});return row;}
/** While a take plays, how much of the reaction layer's own fold over the blow (`hitFold`: every melee blow lands at
 *  1.05 m, under FOLD_LOW, so it jackknifed every body forward) and of its lean along the blow (the body tipped back,
 *  away from the fist: `leanTilt`, `hitReact`'s lean) stay on top of it - the take is the pose; the layer that bent
 *  every hurt the same way bent the snap-back's arch forward and the fold back upright, and the blind critic read all
 *  four as "the same lean-back family". Eased over TAKE_EASE. */
// (Round 91: and how much of the stun's curl (STUN_HOLD) - the fold's own, none for the snap-back and the spins. Since round
// 90 every body plays the takes, and with the curl on each, the blind critics read a string's three blows as "one in-place
// waist-fold for a face punch, a hook and a high kick"; the victim should be arched back under the straight
// punch, bent over the raised leg, spun.)
const TAKE_SHAPE:Record<keyof typeof DREAM_HURTS,{fold:number;lean:number;hunch:number}>={
  'dream back':{fold:0,lean:1,hunch:0},'dream fold':{fold:1,lean:.3,hunch:1},'dream spin L':{fold:.3,lean:.7,hunch:0},'dream spin R':{fold:.3,lean:.7,hunch:0},
};
const TAKE_EASE=.06;
/** Round 98: a striker's lean into a blow it lands (Fighter.impact, as the attacker): radians along the blow, held `hold`
 *  seconds, then let go at `rate` (1/s) - where a recoil tipped it back off the contact (-0.07) and let go at 13. */
const DRIVE={lean:.32,hold:.1,rate:4} as const;
/** Round 96: how far above the floor a struck foot drawn with an authored take is brought down to it (Fighter.floorFeet),
 *  metres; past it, it is a foot meant to be off the floor. */
const TAKE_PLANT=.12;
/** Round 103: a striker's feet on the floor through a light or heavy thrown on its feet (Fighter.floorFeet) - a sole
 *  under the tile brought up to it, one over it brought down: all the way within `full` metres of it, less and less to
 *  none at `reach` (a kick's foot, or a stride's, rises through the band without a jump). Measured in the Tempo vs Konta
 *  film, his Rush 1 lifted both soles 12 cm off the floor and then sank them 15 cm through it; every blind critic, every
 *  round: "lunges airborne with trailing feet and no planted base", where it should plant a wide stance. */
// (Eased in and out over `ease` seconds - the raise of a sole under the tile with whatever stance or swing comes next - so
// a string's blow going over into an ender, or out of a dash, never jerks a knee: tests/combosVol1Chain. The lights only:
// an ender's spin and jump kicks are their own. Reaching .15 or .2 m brought Tempo's lunge hop down further and turned
// Gaunt's knee 35-63 degrees in a frame going into Spin Bomb and Gaunt Air.)
const STRIKE_PLANT={full:.03,reach:.1,ease:.08} as const;
/** Round 94: how fast an authored hurt plays on once its peak is held (Fighter.recoilClock), of its own pace, and the
 *  takes by clip name, own or borrowed. */
const TAKE_RELEASE=.7;
const DZ_TAKE_CLIPS=new Set<string>([...Object.values(DREAM_HURTS),DREAM_FLINCH]);
/** Round 93: a spin take turns the whole body with it, the feet pivoting - `most` radians the way the take twists (its
 *  left for 'dream spin L'), taken up at `in` and let go at `out` (1/s). Seen from behind the striker, as the game's camera
 *  sees a string, a turn of the trunk alone read as "the same in-place crouch" to the blind critics; a hook should
 *  twist the victim and shove it a step. */
const TAKE_TURN={most:.5,in:14,out:5} as const;
/** How a fold is shared along the same chain, root first. A lean tips the
 *  whole body from the hips; a fold is a spine curl, so the hips barely move
 *  and the chest and the shoulders take nearly all of it. */
const FOLD_SHARE=[.08,.24,.34,.34];
/** Where each attack clip actually lands its blow, as a fraction of the clip,
 *  measured by scripts/measure_contact_frames.py. Playing a clip linearly
 *  across a move's duration puts the visible contact wherever the animator put
 *  it while the damage lands at the move's own contact time; the two are
 *  rarely the same frame. See `contactCurve`. */
const CONTACT_FRACTION=contactFrames as Partial<Record<FighterId,Partial<Record<AttackSlot,number>>>>;
/** The same table read by any key: rush stages are measured under
 *  `rush1`..`rush3` or under the clip's own name. */
const CONTACT_BY_KEY=contactFrames as Partial<Record<FighterId,Record<string,number|undefined>>>;
const ATTACK_SLOTS=new Set<string>(['light','heavy','special','ultimate','area']);
const areaAnim=(state:PlayerState)=>areaCastAnim(state)??(LUCY_TIDE&&state.fighter==='gummy'&&!forgedMoveFor(state)?MONSOON_ANIM:areaAnimOf(state.fighter,forgedMoveFor(state)??MOVES[state.fighter]?.area));
/** Where a stage's blow is drawn in its clip when nothing has measured it:
 *  about two fifths in, which is where a wind-up and a follow-through of
 *  roughly equal weight put it - and the contract's own contact ratio. */
const RUSH_DEFAULT_FRACTION=.4;
/** Clips a rig ships that read as a blow, for a rush stage nobody authored. */
const RUSH_STRIKE=/punch|kick|air attack|strike|slash|attack_|jab|hook|knee|elbow|grounded-(cross|meteor)/i;
/** Never a stage: getting hit, moving, standing, dying, posing. */
const RUSH_NEVER=/idle|run|walk|dash|jump|block|guard|hit|hurt|die|down|slam|stun|shake|shock|blown|victory|lose|opening|flagget|pose|home|ready|stance|fall|spin|charge/i;
/** The most a body joint may turn in a sixtieth of a second of a borrowed
 *  clip's own footage for it to stand in for a rush stage. The air normals
 *  donated across the roster measure 57-60 degrees a frame on every rig but
 *  the one they came from (8-9 on Konta's): a stage is paced faster than
 *  its footage, and a clip that already strobes at its own speed is a strobe
 *  in the string. */
const RUSH_SMOOTH=THREE.MathUtils.degToRad(32);
/** A form that throws its fighter's rush stages by name (FighterDefinition.rushClips) from takes of its own, rather
 *  than picking them from its clips' names as a form otherwise does (planRush): Black Vespers, awakened Vesper (8 October
 *  2026, vesper-black-vespers-fanim1.glb - his rakes and rising claws under the man's stage names). */
const FORM_NAMED_RUSH:ReadonlySet<FighterId>=new Set<FighterId>(['vesper','shanxiao','ampere','shijima','kusushi','hakushi','ume','hikui','lanthorn','highsun','onigawara','minase','irbis','rakucho','hagure','akayuri','madake','rotfalke','hawser']);
/** Round 3b (HITFEEL): each air string (moves.ts AIR_RUSH), as drawn. For
 *  every fighter lent the air kicks: the clip each airborne rush stage plays
 *  and whether its legs are tucked under it while it is thrown (TUCK_AT) - a
 *  blow thrown with the arms, which the grounded clip draws standing; a kick
 *  keeps the clip's own legs. The names in AIR_RUSH describe these clips, and
 *  tests/airNormals.test.ts and tests/airStrings.test.ts hold the two
 *  together.
 *  Round 4b (COMBAT): every Vol.1 fighter's, and stage 0 too - never the
 *  grounded jab (the round-4 critic: Jump + Light was the jab's own clip and
 *  segment for 11 of 12). A stage may play a part of a longer take (`from`/
 *  `to` seconds, its blow at `contact` of what is played, read off a take
 *  `span` long - a body with a clip of the name at another length throws the
 *  slot's), as the combo enders do (comboClips.ts): the parts of the
 *  fighters' round-4 takes their enders leave free, and Gaunt' and Kenzo's own
 *  air takes (scripts/combos/vol1_enders2.py). None is a clip lent across the
 *  roster. */
export type AirStage={clip?:string;tuck:boolean;from?:number;to?:number;contact?:number;span?:number};
/** A form that fights in clips of its own draws an air string of its own, where its fighter's body has none or another:
 *  the YUGE's uppercut, hook and hammer (the takes that were adult Hawser's; the Scout throws Levin's string off
 *  the floor as Levin does, with his light's and his stages' own clips). Read through `airStages`. */
export const FORM_AIR_STRING_CLIPS:Partial<Record<FighterId,readonly [AirStage,AirStage,AirStage]>>={
  hawser:[{clip:"Rebel Uppercut",tuck:false,from:0,to:0.8,contact:0.54,span:0.8},{clip:"Defiant Hook",tuck:true,from:0,to:0.7,contact:0.5,span:0.7},{clip:"Freedom Hammer",tuck:false,from:0,to:1,contact:0.58,span:1}],
};
const air=(clip:string,tuck:boolean,from?:number,to?:number,contact?:number,span?:number):AirStage=>({clip,tuck,...(from!==undefined?{from,to,contact,span}:{})});
export const AIR_STRING_CLIPS:Partial<Record<FighterId,readonly [AirStage,AirStage,AirStage]>>={
  chohan:[air("Upping the Ante",false,0,0.82,0.45,0.82),air("Cheap Shot",false,0,0.7,0.5238095238095238,0.7),air("No Refunds",false,0,0.95,0.5238095238095238,0.95)],
  aqrab:[air("Antlion Pit",false,0,0.9333333333333333,0.5,0.9333333333333333),air("Golden Pincer",false,0,1.0,0.5,1.0),air("Dune Shackle",false,0,1.3,0.5,1.3)],
  tsubute:[air("Leapfrog",true,0,0.82,0.45121951219512196,0.82),air("Plunk",true,0,0.92,0.5,0.92),air("Geode",false,0,1,0.49,1)],
  ume:[air("Rising Magnolia",true,0,0.72,0.54,0.72),air("Magnolia Backfist",true,0,0.65,0.46,0.65),air("Shattering Blossom",true,0,0.98,0.62,0.98)],
  lanthorn:[air("Rising Lamplight",true,0,0.716667,0.51,0.716667),air("Wick Turn",true,0,0.633333,0.5816326530612245,0.633333),air("Tavern Cleaver",true,0,0.916667,0.6,0.916667)],
  highsun:[air("Morning Ascent",true,0,0.800000011920929,0.56,0.800000011920929),air("Lordly Turn",true,0,0.699999988079071,0.53,0.699999988079071),air("Noonday Divide",true,0,1,0.56,1)],
  torsion:[air("Snap Twist",false,0,0.52,0.4807692307692307,0.52),air("About-Face",false,0,0.72,0.4305555555555556,0.72),air("Air Rebuff",false,0,0.86,0.5,0.86)],
  kubiwa:[air("Beckon",true,0,0.7666666666666667,0.53,0.7666666666666667),air("Hold",true,0,0.6666666666666666,0.59,0.6666666666666666),air("Diminuendo",true,0,0.9666666666666667,0.5833333333333333,0.9666666666666667)],
  onigawara:[air("Rising Gore",false,0,0.83,0.4489,0.83),air("Shoulder Reversal",true,0,0.68,0.4,0.68),air("Jagged Finish",false,0,1.03,0.4,1.03)],
  cardo:[air("Rising Unspell",false,0,0.83,0.4489,0.83),air("Headlong Thrust",true,0,0.68,0.4,0.68),air("Thistledown Storm",false,0,1.03,0.4,1.03)],
  minase:[air("Rising Gale",true,0,0.75,0.5,0.75),air("Crossing Relay",true,0,0.6,0.44,0.6),air("Gale Descent",true,0,1.0,0.56,1.0)],
  aquilo:[air("Rising Swallow",true,0,0.75,0.5,0.75),air("Swallowtail Cross",true,0,0.6,0.44,0.6),air("Downdraft",true,0,1.0,0.56,1.0)],
  'psyche':[air("Rising Swarm",false,0,0.8166666666666667,0.52,0.8166666666666667),air("Wing Twist",true,0,0.6833333333333333,0.56,0.6833333333333333),air("Grasping Swarm",false,0,0.9333333333333333,0.56,0.9333333333333333)],
  'ovid':[air("Jackhammer Uppercut",false,0,0.8666666746139526,0.54,0.8666666746139526),air("Glass Hook",true,0,0.7333333492279053,0.5,0.7333333492279053),air("Sledgehammer",false,0,1.05,0.58,1.05)],
  rotfalke:[air("Rush 1",false,0,0.6000000238418579,0.46,0.6000000238418579),air("Rush 2",true,0,0.7833333611488342,0.56,0.7833333611488342),air("Rush 3",false,0,0.8666666746139526,0.58,0.8666666746139526)],
  bonsho:[air("Rising Bell Palm",false,0,0.7833333333333333,0.54,0.7833333333333333),air("Bead Turn",true,0,0.7166666666666667,0.54,0.7166666666666667),air("Bronze Breaker",false,0,0.9833333333333333,0.58,0.9833333333333333)],
  yodaka:[air("Rising Spark",false,0,56/60,28/56,56/60),air("Ember Turn",true,0,49/60,23/49,49/60),air("Watchfire Divide",false,0,67/60,34/67,67/60)],
  murex:[air("Spine Breaker",false,0,0.8666666746139526,0.51,0.8666666746139526),air("Twisting Claw",true,0,0.6333333253860474,0.43,0.6333333253860474),air("Core Ram",false,0,0.949999988079071,0.43,0.949999988079071)],
  kinu:[air("Silk Uppercut",true,0,0.7333333333333333,0.52,0.7333333333333333),air("Whip Stitch",true,0,0.8666666666666667,0.537037037037037,0.8666666666666667),air("Jailbreak Slam",true,0,1,0.537037037037037,1)],
  'madake':[air("Bamboo Straight",false,0,0.5,0.48,0.5),air("Rising Shoot",false,0,0.7833333611488342,0.4615384615384615,0.7833333611488342),air("Descending Fang",false,0,0.9333333373069763,0.4893617021276596,0.9333333373069763)],
  akayuri:[air("Upturned Lily",false,0,0.7833333611488342,0.46,0.7833333611488342),air("Crossing Lilies",false,0,0.7166666666666667,0.56,0.7166666666666667),air("Red Rain Descent",false,0,1,0.56,1)],
  hagure:[air("Turnaside Hand",true,0,0.7333333333333333,0.5377358490566037,0.7333333333333333),air("Stray Cross",true,0,0.85,0.4464285714285714,0.85),air("Howling Break",true,0,1,0.49107142857142855,1)],
  hisame:[air("Borealis",false,0,0.7833333611488342,0.49,0.7833333611488342),air("Sleet Cut",true,0,0.6333333333333333,0.44,0.6333333333333333),air("Coup de Glace",false,0,0.9166666865348816,0.44,0.9166666865348816)],
  svanhild:[air("Reed Snare",false,0,0.7833333611488342,0.49,0.7833333611488342),air("Ripple Riposte",true,0,0.6333333333333333,0.44,0.6333333333333333),air("Highborn Tide",false,0,0.9166666865348816,0.44,0.9166666865348816)],
  mizuhiki:[air("Vaulting Strand",true,0,0.75,0.52,0.75),air("Backtwist",true,0,0.6499999761581421,0.5,0.6499999761581421),air("Shears",true,0,0.8999999761581421,0.56,0.8999999761581421)],
  'shibuichi':[air("Planish",true,0,0.6166666666666667,0.48387096774193544,0.6166666666666667),air("Backhand Peen",true,0,0.8333333333333334,0.4523809523809524,0.8333333333333334),air("Heel Set",false,0,1.0166666666666666,0.5196078431372549,1.0166666666666666)],
  'rakucho':[air("Ribbon Hook",true,0,0.7166666666666667,0.5462962962962963,0.7166666666666667),air("Silverfish Cross",true,0,0.8666666666666667,0.5462962962962963,0.8666666666666667),air("Shredded Chapter",true,0,1.0166666666666666,0.5,1.0166666666666666)],
  irbis:[air("Rising Barb",false,0,0.7666666666666667,0.48,0.7666666666666667),air("Snow-Cat Reversal",true,0,0.6166666746139526,0.43,0.6166666746139526),air("Predator Breaker",false,0,0.8833333333333333,0.43,0.8833333333333333)],
  shidare:[air("Rising Petals",true,0,0.7666666666666667,0.44,0.7666666666666667),air("Crossing Petals",true,0,0.7,0.55,0.7),air("Petal Descent",true,0,0.9666666666666667,0.54,0.9666666666666667)],
  hinomoto:[air("Rising Spark",true,0,0.7833333611488342,0.55,0.7833333611488342),air("Old General's Reversal",true,0,0.699999988079071,0.53,0.699999988079071),air("Ashen Divider",true,0,0.9833333492279053,0.495,0.9833333492279053)],
  amagoi:[air("Rod Sweep",true,0,0.7166666666666667,0.57,0.7166666666666667),air("Rain Rebuff",true,0,0.8333333333333334,0.5446428571428571,0.8333333333333334),air("Iron Rod Judgment",true,0,0.9833333333333333,0.57,0.9833333333333333)],
  'shakudo':[air("Rivet",true,0,0.54,0.48148148148148145,0.54),air("Swage",true,0,0.76,0.4342105263157895,0.76),air("Anvil Drop",false,0,0.92,0.5,0.92)],
  hikui:[air("Rising Witchfire",false,0,0.7,0.51,0.7),air("Turning Ember",true,0,0.58,0.45,0.58),air("Scorch Cross",false,0,0.88,0.58,0.88)],
  tokan:[air("Snowdrift Rise",false,0,1.2,0.3333333333333333,1.2),air("Frostbite Cut",true,0,1.0666666666666667,0.59375,1.0666666666666667),air("Floe Cleave",true,0,1.0666666666666667,0.25,1.0666666666666667)],
  strappado:[air("String Lash",true,0,0.54,0.48148148148148145,0.54),air("Marionette Reversal",true,0,0.72,0.4166666666666667,0.72),air("Highwire Heel",false,0,0.94,0.4893617021276596,0.94)],
  unari:[air("Liftoff",true,0,0.72,0.5,0.72),air("Plummet",true,0,0.82,0.44,0.82),air("Nosedive",true,0,0.9,0.5957446808510639,0.9)],
  barrow:[air("Tar Jab",true,0,0.56,0.4285714285714285,0.56),air("Pitch Backfist",true,0,0.72,0.4166666666666667,0.72),air("Glutton Heel",false,0,0.94,0.4893617021276596,0.94)],
  sashigane:[air("Rising Section",true,0,0.7333333333333333,0.55,0.7333333333333333),air("Cross Section",true,0,0.6333333333333333,0.53,0.6333333333333333),air("Critical Load",true,0,0.8666666666666667,0.56,0.8666666666666667)],
  gosu:[air("Rising Seam",true,0,0.733333,0.52,0.733333),air("Porcelain Hook",true,0,0.616667,0.5217391304347826,0.616667),air("Ruin Breaker",true,0,0.883333,0.5217391304347826,0.883333)],
  kusushi:[air("Rising Thrust",false,0,0.72,0.54,0.72),air("Rib Breaker",true,0,0.65,0.46,0.65),air("Crushing Heel",false,0,0.96,0.6,0.96)],
  hakushi:[air("Mountain Palm",false,0,0.74,0.5,0.74),air("Lion Backhand",true,0,0.64,0.5,0.64),air("Pearl Drive",false,0,0.88,0.58,0.88)],
  suzuran:[air('Handstroke',true,0,.7,.52,.7),air('Backswing',true,0,.6,.54,.6),air('Full Peal',true,0,47/60,.54,47/60)],
  wataame:[air('Stretch',true,0,.766667,.52,.766667),air('Shrug',true,0,.616667,.4444444444444444,.616667),air('Go Dutch',true,0,.9,.6021505376344086,.9)],
  bruin:[air('Back-Blade Sweep',true,0,.766667,.52,.766667),air('Back-Blade Thump',true,0,.616667,.4444444444444444,.616667),air('Deep Woods Cut',true,0,.9,.6021505376344086,.9)],
  senko:[air('Rising Beam',false,0,43/60,17/30,43/60),air('Prism Roundhouse',false,0,.65,16/29,.65),air('Glare Heel Drop',false,0,50/60,23.5/43,50/60)],
  buna:[air('Swathe',true,0,.58,.24/.58,.58),air('Snowbreak',true,0,.72,.31/.72,.72),air('Splitting Wedge',false,0,.92,.5,.92)],
  oyashio:[air('Finback Rise',true,0,28/30,9/28,28/30),air('Swell Uppercut',true,0,1,9/30,1),air('Breaker Hammer',true,0,1.3,16/39,1.3)],
  adad:[air('Ascending Spire',true,0,.966667,.4,.966667),air('Staff Reverse Quill',true,0,.733333,.42,.733333),air('Bolt Downstroke',true,0,1.1,.58,1.1)],
  shijima: [air("Rising Descant",false,0,0.72,0.54255,0.72),air("Turning Descant",true,0,0.6,0.5,0.6),air("Falling Hush",false,0,0.8,0.5,0.8)],
  akaito: [air("Rising Thread",false,0,0.7,0.48,0.7),air("Return Cut",true,0,0.6,0.48,0.6),air("Falling Veil",false,0,0.8166666666666667,0.56,0.8166666666666667)],
  tempo:[air('Rising Beat',true,0,0.716667,0.52,0.716667),air('Body Shot',true,0,0.6,0.48,0.6),air('Elbow Drop',true,0,0.783333,0.55,0.783333)],
  tancho:[air('Icicle Beak',true,0,.76,.55,.76),air('Rime Backhand',true,0,.6,.49,.6),air('Ember Talon',true,0,.94,.57,.94)],
  bellows:[air('Chimney Uppercut',true,0,.78,.53,.78),air('Clinker Backfist',true,0,.63,.46,.63),air('Steam Hammer',true,0,.89,.54,.89)],
  mikage:[air('Rising Pounce',false),air('Velvet Elbow',true),air('Tailwhip Heel',false)],
  // Native blade cuts: the rising strike opens in the air, never his grounded slash or a donated kick.
  'full-beam':[air('Keeper\'s Uppercut',true,0,.75,.52,.75),air('Keeper\'s Backfist',true,0,.72,.48,.72),air('Aerial Hammer',true,0,.85,.54,.85)],
  pyroclast:[air('Rising Vent',true,0,44/60,.54,44/60),air('Spitfire Cross',true,0,35/60,.46,35/60),air('Airburst',true,0,47/60,.52,47/60)],
  ampere:[air('Spark Uppercut',true,0,.72,.51,.72),air('Live Line Cross',true,0,.55,.46,.55),air('Lineman\'s Kick',false,0,.82,.53,.82)],
  shanxiao:[air('Rising Colossus',true,0,.75,.52,.75),air('Mauler Backfist',true,0,19/30,.48,19/30),air('Colossus Hammer',true,0,49/60,.54,49/60)],
  kuzu:[air('Saw Rising Reap',false,0,43/60,.55,43/60),air('Saw Reverse Quill',true,0,.6,.478,.6),air('Saw Downstroke',false,0,47/60,.553,47/60)],
  shakugo:[air('Fissure Uppercut',false,0,20/30,8/20,20/30),air('Cinder Backfist',true,0,23/30,8/23,23/30),air('Slag Descent',false,0,1,10/30,1)],
  'basilissa':[air('Thornrise Heel',false,0,23/30,13/23,23/30),air('Petal Air Kick',false,0,25/30,.48,25/30),air('Crown Heel Drop',false,0,1,1/3,1)],
  sorayomi:[air('Staff Rising Reap',false,0,.6,11/18,.6),air('Staff Reverse Quill',true,0,17/30,9/17,17/30),air('Staff Downstroke',false,0,.6,11/18,.6)],
  strix:[air('Vigil Rising Reap',false,0,.4,.5,.4),air('Vigil Backcut',true,0,.6,7.5/18,.6),air('Gravefall',false,0,.6,11/18,.6)],
  // A knee driven into the jump, the cross with the legs tucked, and the axe kick of his rise-and-axe take.
  taisei:[air('taisei-grounded-meteor',false,0,.667,.42,.667),air('taisei-grounded-cross',true),air('Rising Axe',false,2,2.9,.5,6.042)],
  ouga:[air('Rush 2',true,0,.967,.3,.967),air('Ki Volley',true),air('Rush 3',false)],
  // Konta's rig is where the air attacks came from: his own, not a loan.
  konta:[air('air Attack 01',false),air('air Attack 02',false),air('Rush 3',false)],
  // The jumping punch, the stretched one with the legs tucked, and the leap and double-fisted slam of his slam take.
  gummy:[air('Punch 02',false,0,1,.37,1),air('Punch 01',true),air('Slam Stubborn Headbutt',false,.3,1.15,.75,6.042)],
  kosho:[air('Rush 2',false,0,.967,.3,.967),air('Punch 01',false),air('Rush 1',false)],
  shirokane:[air('Rush 2',false,0,.967,.28,.967),air('Rush 1',false),air('Rush 3',false)],
  // The horizontal cut of his slash-and-palm take, tucked, then two of his own string's cuts.
  shiden:[air('Slash Palm',true,.25,1.05,.46,5.542),air('Rush 2',true),air('Rush 3',false)],
  // His own air take's two-sword cut, the overhead cut of his cut-and-plunge take tucked, and his string's leaping cut.
  kenzo:[air('Kenzo Air',false,.45,1.05,.68,5.042),air('Cut Plunge',true,.45,1.3,.53,6.542),air('Rush 3',false)],
  // His own string's leaping hooks, and the diving straight of his hammer-and-dive take.
  koko:[air('Rush 2',true,0,1.067,.31,1.067),air('Rush 1',true),air('Hammer Dive',false,2.85,3.55,.7,6.542)],
  nigo:[air('skill_3_2',false,0,.458,.2,.458),air('attack_1_1',true),air('attack_1',true)],
  kagari:[air('Punch 01',false,.25,1,.36,1.333),air('Rush 2',true),air('Body Dive',false,2.4,2.95,.67,6.542)],
  ward:[air('Punch 01',false,0,1.167,.23,1.167),air('Rush 2',true),air('Cut Plunge',false,2.85,3.5,.72,6.542)],
  kuon:[air('Punch 01',false,.05,.75,.39,1),air('Rush 2',false),air('Axe Dive',false,2.8,3.45,.72,6.542)],
  // The crushing straight of his straight-and-spear take, tucked, then two of his own string's blows.
  oro:[air('Straight Spear',true,.8,1.9,.62,5.542),air('Rush 1',true),air('Rush 2',false)],
  // His own air take's cleave, the rising swing of his crossbow-and-uppercut take, and the air take's chop as he falls.
  gaunt:[air('Gaunt Air',false,1,1.8,.8,5.042),air('Crossbow Uppercut',false,3.6,4.9,.55,6.042),air('Gaunt Air',false,2.2,3.1,.72,5.042)],
  setsu:[air('Rush 2',false,0,.967,.28,.967),air('Rush 1',true),air('Rush 3',false,.15,.8,.54,1.3)],
};
/** The tuck: the legs of the jump clip at TUCK_AT of it - the knees drawn
 *  up at the top of the leap, on every rig - laid over the legs of an
 *  air-string blow thrown with the arms, eased in and out over about
 *  TUCK_EASE seconds. */
const TUCK_AT=.6,TUCK_EASE=.07;
/** Round 4b (COMBAT): an attack's eased turn (Fighter.attackTurn): none under ATTACK_TURN_MIN radians, otherwise as
 *  long as the turn takes at ATTACK_TURN_RATE rad/s, held between three and five sixtieths of a second. */
const ATTACK_TURN_MIN=.12,ATTACK_TURN_RATE=13,ATTACK_TURN_FRAMES=[3,5] as const;
/** Round 4b (FANIM): the spirit users' light string is thrown by their spirit (SwordSpiritEffects' SPIRIT_CALLERS `string`),
 *  and they command it - KoKo pointing at his victim, LORD ORO with his arms folded (a fanim script since retired,
 *  <id>-fanim1.glb). Not awakened: their looming spirit strikes with their own blows then. */
const SPIRIT_COMMAND:Partial<Record<FighterId,string>>={gosu:'Gosu Command',koko:'Spirit Command',oro:'Spirit Command'};
const clipRoughness=new WeakMap<THREE.AnimationClip,number>();
/** Fighters whose hair is already pale. The crown tint only reaches the dark
 *  vertices of a crown - black hair goes gold, a face stays a face - which on
 *  white hair reaches nothing. Their whole crown takes the tint. */
const PALE_CROWN=new Set<FighterId>(['kuon']);
/** The shape of a melee swing in move time: how much of the wind-up is spent
 *  drawing back into the chamber, how deep that chamber sits as a fraction of
 *  the way to contact, and the slowest the recovery may be played.
 *
 *  A clip mapped straight onto a move spends the whole wind-up creeping
 *  outward, which is what made every attack read as a slow push rather than a
 *  strike. Kenzo's heavy asks for 0.34x on the way out and 1.86x on the way
 *  back; an even 0.34x for 566 ms is a fighter wading through the air. Easing
 *  out into the chamber, holding near it, then driving across the last 120 ms
 *  puts the same keyframes on the same contact time with a snap in them.
 *
 *  The recovery floor is the other half of it: Signal Fire has 13% of its clip
 *  left after contact and 40% of the move to play it in, and a follow-through
 *  at a third speed reads as the game stuttering. Arriving at the last pose and
 *  holding it reads as a fighter recovering their stance. */
/** The shape of a swing before it lands. `DRAW` and `SETTLE` are fractions of
 *  the wind-up's time; `DRAWN` and `COILED` the fractions of the clip's
 *  pre-contact travel reached by the end of each. The draw-back therefore
 *  carries most of the motion, the settle is a beat rather than a wait, and
 *  what is left is spent driving into the blow. */
const STRIKE_DRAW=.45,STRIKE_SETTLE=.74,STRIKE_DRAWN=.56,STRIKE_COILED=.7,RECOVERY_FLOOR=.6;
/** How the drive accelerates into the blow: the power of the way through
 *  it, so its last frame runs at this multiple of the drive's average. It
 *  was a square, which put a 2x frame on every contact on top of whatever
 *  the footage was already doing there. */
const STRIKE_DRIVE=1.6;
/** Below this, a phase of a string has no room for a beat and is swept. */
const STRING_FLOOR=.14;
/** A clip measured by how much it MOVES rather than by how long it is.
 *
 *  `pace` and `strike` shape a swing as shares of "the clip's pre-contact
 *  content": draw back through most of it, settle, drive through the rest.
 *  In clip time that share is footage, and footage is not motion. Fang Crossing
 *  spends its first quarter second barely moving and its cut is four frames
 *  of arm; shaped by footage, the drive lands on those four frames and runs
 *  them at four times speed on top of their own - measured, the worst joint
 *  turned 89 degrees in one sixtieth of a second, and a fighter whose sword
 *  arm does that is a strobe, not a swordsman. Shaped by motion, the drive
 *  is the last share of the ROTATION on the way to the blow, wherever in the
 *  footage it lives, and a static head is crossed rather than stalled in.
 *
 *  The table is the cumulative angle turned by the busiest of the body's
 *  rotation tracks between samples, normalised to [0, 1]; monotone by a hair everywhere so
 *  it inverts exactly. The contact frame lands on the contact time by the
 *  same construction as before: the motion at the measured fraction is the
 *  invariant `pace` steers to, and it is mapped back to footage at the end.
 *  Fingers, toes, eyes, hair and cloth are not motion of the swing. */
const MOTION_SAMPLES=240;
const MOTION_EVEN=.9;
const MOTION_SKIP=/finger|thumb|index|middle|ring|pinky|toe|eye|jaw|hair|cloth|skirt|coat|tail|weapon|sword|prop|bandana|scarf|belt|pouch/i;
const motionTables=new WeakMap<THREE.AnimationClip,Float32Array>();
export const seedMotionTable=(clip:THREE.AnimationClip,table:Float32Array)=>{if(table.length===MOTION_SAMPLES+1)motionTables.set(clip,table);};
/** Each clip's interpolants, by node name and property, shared by the bodies
 *  that play it (see `samplersFor`). */
const clipSamplers=new WeakMap<THREE.AnimationClip,{name:string;property:string;interpolant:THREE.Interpolant}[]>();
export function clipMotionTable(clip:THREE.AnimationClip):Float32Array{
  let table=motionTables.get(clip);
  if(table)return table;
  table=new Float32Array(MOTION_SAMPLES+1);
  const a=new THREE.Quaternion(),b=new THREE.Quaternion();
  // The BUSIEST joint's turn between samples, not the sum over joints. A sum
  // is uniform when the body as a whole moves evenly, which still lets one
  // leg take the whole frame's budget while nothing else moves - measured,
  // Kosho's Amuse-Bouche turned a hip 56 degrees in a frame at the average rate.
  // The largest turn is the thing a strobe is made of, so it is the thing
  // held even.
  for(const track of clip.tracks){
    if(!(track instanceof THREE.QuaternionKeyframeTrack)||MOTION_SKIP.test(track.name)||track.times.length<2)continue;
    const interpolant=(track as unknown as {createInterpolant(result?:unknown):{evaluate(t:number):ArrayLike<number>}}).createInterpolant();
    for(let i=0;i<=MOTION_SAMPLES;i++){
      const values=interpolant.evaluate(clip.duration*i/MOTION_SAMPLES);
      b.set(values[0],values[1],values[2],values[3]);
      if(i>0)table[i]=Math.max(table[i],a.angleTo(b));
      a.copy(b);
    }
  }
  for(let i=1;i<=MOTION_SAMPLES;i++)table[i]+=table[i-1];
  const total=table[MOTION_SAMPLES];
  // Mostly joint travel, with a tenth of source time to keep the inverse
  // defined through still poses. Held chambers keep their explicit timing
  // in contactCurve. Sampling at 240 points also catches the short bursts
  // that the older table could stride past on fast sword/kunai clips.
  for(let i=0;i<=MOTION_SAMPLES;i++)table[i]=(total>1e-6?table[i]/total:i/MOTION_SAMPLES)*MOTION_EVEN+(i/MOTION_SAMPLES)*(1-MOTION_EVEN);
  // Strictly increasing, so a flat stretch of footage still has an inverse.
  for(let i=1;i<=MOTION_SAMPLES;i++)table[i]=Math.max(table[i],table[i-1]+1e-6);
  const top=table[MOTION_SAMPLES];
  for(let i=0;i<=MOTION_SAMPLES;i++)table[i]/=top;
  motionTables.set(clip,table);
  return table;
}
/** Whether a clip's motion table has been built (for the warm-up's test). */
export const motionTableBuilt=(clip:THREE.AnimationClip)=>motionTables.has(clip);
/** How much of the clip's motion has happened by a fraction of its footage. */
export function motionAt(table:Float32Array,fraction:number){
  const x=THREE.MathUtils.clamp(fraction,0,1)*MOTION_SAMPLES,i=Math.min(MOTION_SAMPLES-1,Math.floor(x)),f=x-i;
  return table[i]+(table[i+1]-table[i])*f;
}
/** The footage fraction at which a share of the clip's motion has happened. */
export function clipAtMotion(table:Float32Array,motion:number){
  const m=THREE.MathUtils.clamp(motion,0,1);
  let lo=0,hi=MOTION_SAMPLES;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(table[mid]<=m)lo=mid;else hi=mid;}
  const span=table[hi]-table[lo];
  return (lo+(span>1e-12?THREE.MathUtils.clamp((m-table[lo])/span,0,1):0))/MOTION_SAMPLES;
}
/** The clip-rate band inside which a swing keeps `strike`'s authored pacing:
 *  the clip's pre-contact content divided by the move's wind-up. Outside it the
 *  clip is re-paced in seconds rather than in fractions - see `pace`. Measured
 *  across the forty slots, the ultimates sit at 0.19 to 0.40 (Gummy's Full
 *  Swell ultimate is a 1.88 s clip on a 7.8 s move) and read as quarter speed; two
 *  normals sit at 2.1 and 4.4 and blur. Inside the band the existing shape is
 *  right and is left alone. The top of the band came down from 1.8 in round
 *  14: `strike` runs its draw at up to 1.5x the wind-up's average and its
 *  drive at 2x, so a swing let in at 1.8x peaked at over four times the
 *  footage and the sword arm turned forty to ninety degrees a frame. Above
 *  1.4 the head of the clip is skipped instead, which is a pose the entry
 *  blend can cover. */
const PACE_BAND:[number,number]=[.6,1.4];
const FOOTAGE_TABLE=Float32Array.from({length:MOTION_SAMPLES+1},(_,i)=>i/MOTION_SAMPLES);
/** The shape of a compressed swing's wind-up, as a power of the way through
 *  it. A clip past the top of the band is already running at 1.4x its own
 *  motion; putting `strike`'s draw-settle-drive on top of that peaked at
 *  over three times the footage. This opens from rest, so the blend from
 *  the idle has a slow frame to land on, and arrives at contact at 1.3x -
 *  a lean into the blow rather than a lurch. */
const SKIP_SHAPE=1.3;
/** How long the limbs take to reach a reaction pose on the frame a blow
 *  lands. It was 12 ms - a cut, on the grounds that a reaction is a snap.
 *  It is still a snap: sixty milliseconds is three or four frames, all of
 *  them inside the shortest hitstop, so the body is seen to TAKE the hit
 *  during the freeze rather than to be replaced. Measured with
 *  scripts/probe_pose_continuity.mts, the roster's worst struck seam went
 *  from a hand jumping 1.07 m in one frame (Konta) to 0.35, Shirokane's
 *  0.92 to 0.2. The root already eased over a tenth of a second.
 *
 *  Round 3e (REACT): the third blind critic still counted a hand or a head
 *  crossing 30-180 cm in one frame on the first frames of a reaction - Gaunt
 *  twelve times in 6.5 s of being hit. Four frames were not enough for a
 *  recoil the clip itself runs into at several times its own speed, so the
 *  limbs take a tenth of a second (the reaction layer's own rise, HIT_RISE,
 *  and the recoil's, REACT_IN), and the root STRUCK_ROOT. Every frame of it
 *  is inside the blow's freeze or the recoil it starts: the body still takes
 *  the hit on the frame it lands, it no longer teleports into it. */
const STRUCK_BLEND=.1,STRUCK_ROOT=.14;
/** Round 3e (REACT): how long a standing recoil takes to reach its peak
 *  (`recoilClock`): fast off the blow and easing into the pose the clip
 *  strikes, inside the struck blend, rather than the clip's first fifth laid
 *  across thirty to fifty milliseconds. */
const REACT_IN=.1;
/** Lock combat's preview (Fighter.reelSway): how far past its peak a recoil lets go before it rocks, in seconds of the
 *  clip, and how fast it rocks there. */
const REEL_ROCK=.22,REEL_SWAY_HZ=1.6,REEL_STAGGER=.09,REEL_STAGGER_HZ=2.4;
/** Round 3e (REACT): the blend between two phases of one reaction (the throw
 *  into the somersault, the floor, the get-up), scaled by pose distance
 *  within this band. */
const REACT_PHASE:[number,number]=[.06,.12];
/** Round 3e (REACT): a dash's entry blend - at least the first, at most the
 *  second, as the widest joint's turn needs (ENTRY_STEP) - and the share of
 *  the dash it may take. */
const DASH_ENTRY:[number,number]=[.08,.12],DASH_ENTRY_SHARE=.5;
/** The fastest the gaze may turn, in radians a second: about 500 degrees, a
 *  quick glance rather than a snap. */
const AIM_RATE=8.7;
/** How long the wrap of a gait cycle is blended over. */
const LOOP_BLEND=.07;
/** Below this much of a walk a released foot is not planted again: see the
 *  plant in `footPlanting`. */
const REPLANT_CARRY=.5;
/** How fast the stride's sole minimum is allowed to rise, in metres a second:
 *  slow enough that a step's flight phase (a third of a second) cannot lift
 *  it off the floor a planted foot just stood on. */
const STRIDE_FLOOR_RELAX=.25;
/** The most a joint may turn per frame across a swing's entry blend, and
 *  the longest that blend may be stretched to keep it there. */
const ENTRY_STEP=THREE.MathUtils.degToRad(25),ENTRY_MAX=.14;
/** Round 15 (REHIT): the longest a struck blend into a launch may be
 *  stretched to keep its widest joint under ENTRY_STEP a frame. */
const LAUNCH_ENTRY_MAX=.2;
/** Below SHAPE_FULL the wind-up gets `strike`'s whole shape; from there to
 *  SHAPE_NONE it is flattened toward an even sweep, so a clip that already
 *  runs at the move's pace or faster is not made to peak faster still. The
 *  shape is for the stretched clip, where an even sweep wades. */
const SHAPE_FULL=.7,SHAPE_NONE=1.1;
/** The fastest a clip's follow-through may be run when the move leaves it less
 *  time than it was drawn for. Past this a recovery is a strobe. */
const PACE_TAIL_MAX=2.2;
/** Round 3c: the move clock the clip is drawn from (see `stepMoveClock`).
 *  How hard it is steered onto the move's own clock, a second: a lag left by
 *  a hold closes by a fifth a frame, so the drawn clip runs at most about
 *  1.8x while it catches up and is back on the move within a tenth of a
 *  second. The simulation's tick, and how far off it a tick-stepped clock
 *  may be drawn before it is simply followed. */
const MOVE_CLOCK_GAIN=12,MOVE_TICK=1/60,MOVE_CLOCK_BAND=2/60;
/** A blow the server confirms this long before or after one of the drawn
 *  move's own contacts is that blow, and holds the clip on it (see
 *  `stepMoveClock`); any other confirmation is late news of a blow already
 *  drawn - the predicted swing landed a round trip earlier and froze on the
 *  simulation's own hitstop - and holding the clip for it froze the next
 *  stage's wind-up instead. */
const FREEZE_EARLY=.04,FREEZE_LATE=.08;
/** The follow-through out of a contact (`followThrough`): how long the clip
 *  takes to go from the speed it arrived at to the speed the rest of the
 *  move needs; the slowest that is - the clip's own speed, so a recovery
 *  with time to spare plays as drawn and then holds - and the fastest, in
 *  seconds of clip a second. The recoveries that popped left their contact
 *  at four to six times their own speed. */
const FOLLOW_EASE=.05,FOLLOW_MIN=1,FOLLOW_MAX=3;
/** Round 3d (PACE): the Sunpalm Cannon's push from the charge to the release,
 *  in seconds - the last quarter of round 3's 1.35 s wind-up. */
const SUNPALM_PUSH=.3375;
/** The fastest a dash's sprint clip is played, in seconds of clip a second. */
const DASH_RATE=2.5;
const DASH_CLIP_END:Partial<Record<FighterId,number>>={gummy:.47,kagari:.55};
/** How a chamber that has to be held keeps moving, in clip fractions per
 *  move fraction - the pace an even sweep of the whole clip over the whole
 *  move would have is one. A tenth of that is where a blind critic reads
 *  "frozen" and where tests/bodyDynamics.test.ts draws its line; this is over
 *  it and still reads as a held charge. */
const PACE_CREEP=.14;
/** Where the blows of a string live inside a source clip that carries several
 *  of them. Konta's `Punch 01` is a 4.17 s three-punch combination: dividing
 *  it into equal thirds put the second hit on the clip's rest beat and ran
 *  each third at 5-7x, which on screen was one vibrating blur. Each window is
 *  [start, end, contact] as fractions of the clip; the contact is where the
 *  hand is furthest out inside that window, measured. */
/** Round 3d (ULTS): how each ultimate's clips are laid over its timing.
 *  Every ultimate but the area bombs is a hit-confirm move now (moves.ts,
 *  MoveDefinition.confirm): an opener out within half a second, and a
 *  cinematic that plays only when it lands. The clips were authored for the
 *  old wind-ups - three to seven seconds of charge before one blow - so each
 *  one says where its blow is and what throws the opener:
 *
 *  opener   the clip that throws the opener, from the fighter's own kit (a
 *           lunging iai, a heel dropped like an axe, a palm through the
 *           guard), its blow at `at` of it landed on contact 0 and shaped as
 *           a single swing (`pace`); a whiff plays its follow-through and goes
 *           to the stance. The form a fighter turns into for the cinematic -
 *           the RAKSHASA, SUNRISE, the NIGHTFALL, the HOUND ARMOR - is
 *           not drawn for it; a form already worn for the window throws it
 *           with `formOpener`, a clip of its own body, where it has one.
 *  cine     the cinematic, from the confirm: the ultimate's own clip (the
 *           form's, where there is one) from `from` of it, its blow at `at`
 *           landed on the finisher and the rest of it after. The blows in
 *           between are the effects' and the victim's to sell.
 *           `windows` plays it as a string instead (STRING_WINDOWS), one
 *           window a blow of the cinematic.
 *  release  one clip for the whole move - a beam, a shot, a bomb, all
 *           released on contact 0 - its release at `release` of it: the head
 *           is skipped so the charge runs no faster than PACE_BAND allows,
 *           and the rest plays out over the rest of the move.
 *
 *  The fractions are the measured blows (contactFrames.json), or - for the
 *  area bombs and the beams, which had none - where the old move put its
 *  contact on the clip, so the same frame still carries the release. The
 *  time stops keep their own mapping (a barrage string), and Kuon's and
 *  Setsu's are authored on the move's clock (characterMotion.ts). */
type UltimateClips={opener?:{clip:string;at:number};formOpener?:{clip:string;at:number};cine?:{from:number;at:number;windows?:[number,number,number?][]};release?:number;
  /** The plan is the awakened form's alone: its fighter's own body throws another ultimate, in another clip, laid by
   *  its string windows (Hawser: the Scout's Slipped Moorings; the plan is the YUGE's rampage). */
  formOnly?:true};
/** Round 4b (FMOVES): the clips these slots played before their new takes (`<id>-fmoves1.glb`), and where each lands its
 *  blow, for a body that has not got the new one - Gaunt' HOUND ARMOR throws its own Scrap Cannon Arm, and a costume on a
 *  rig of its own (outfits.ts) its own clips - so it plays what it always did, landing where it always did. */
const SLOT_CLIP_BEFORE:Partial<Record<FighterId,Record<string,{clip:string;contact?:number}>>>={
  kosho:{'COUP DE FEU Spin':{clip:'Brasier: Coup de Feu',contact:.4557},'Banquet Infernal Blaze':{clip:'Banquet Infernal'}},
  kagari:{'Yuragi Blast':{clip:'Yuragi',contact:.866},'Taimatsu TAIMATSU':{clip:'Taimatsu',contact:.72}},
  gaunt:{'Scrap Cannon Arm Recoil':{clip:'Scrap Cannon Arm',contact:.5}},
};
const BRIAR_GLOW:ReadonlySet<string>=new Set(['cardo','bruin','aquilo','svanhild']);
const ULTIMATE_CLIPS:Partial<Record<FighterId,UltimateClips>>={
  chohan:{"opener":{"clip":"The House Wins","at":0.1375},"cine":{"from":0.1375,"at":0.825,"windows":[[0.1375,0.375,0.2875],[0.375,0.55,0.4625],[0.55,0.73125,0.6375],[0.73125,1,0.825]]}},
  aqrab:{"opener":{"clip":"Bone Dry","at":0.0829268292682927},"cine":{"from":0.0829268292682927,"at":0.7560975609756099,"windows":[[0.0829268292682927,0.5609756097560976,0.3609756097560976],[0.5609756097560976,1,0.7560975609756099]]}},
  tsubute:{"opener":{"clip":"INJI: Both Banks","at":0.14516129032258066},"cine":{"from":0.14516129032258066,"at":0.8387096774193549,"windows":[[0.14516129032258066,0.629032258064516,0.4139784946236559],[0.629032258064516,1,0.8387096774193549]]}},
  ume:{"opener":{"clip":"Magnolia Meteor","at":0.17},"cine":{"from":0.17,"at":0.82,"windows":[[0.17,0.58,0.4],[0.58,1,0.82]]}},
  lanthorn:{"opener":{"clip":"Last Call","at":0.14857142857142858},"formOpener":{"clip":"Last Call","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7857142857142857,"windows":[[0.14857142857142858,0.4385714285714285,0.33714285714285713],[0.4385714285714285,0.6628571428571428,0.5399999999999999],[0.6628571428571428,1,0.7857142857142857]]}},
  highsun:{"opener":{"clip":"Sword of the Zenith","at":0.12},"cine":{"from":0.12,"at":0.7625,"windows":[[0.12,0.5,0.34],[0.5,1,0.7625]]},"formOpener":{"clip":"Sword of the Zenith","at":0.12}},
  torsion:{"opener":{"clip":"Full Torque","at":0.12755102040816327},"cine":{"from":0.12755102040816327,"at":0.8010204081632654,"windows":[[0.12755102040816327,0.5357142857142857,0.39540816326530615],[0.5357142857142857,1,0.8010204081632654]]}},
  kubiwa:{"opener":{"clip":"Final Bar","at":0.16338028169014085},"formOpener":{"clip":"Final Bar","at":0.16338028169014085},"cine":{"from":0.16338028169014085,"at":0.7943661971830985,"windows":[[0.16338028169014085,0.4605633802816902,0.34929577464788736],[0.4605633802816902,0.6830985915492958,0.571830985915493],[0.6830985915492958,1,0.7943661971830985]]}},
  onigawara:{"opener":{"clip":"Earthsplitter","at":0.235},"cine":{"from":0.235,"at":0.775,"windows":[[0.235,1,0.775]]}},
  cardo:{"opener":{"clip":"Last Weed Standing","at":0.235},"cine":{"from":0.235,"at":0.8433,"windows":[[0.235,0.3739,0.3267],[0.3739,0.4728,0.4211],[0.4728,0.5906,0.5239],[0.5906,0.7503,0.6572],[0.7503,1,0.8433]]}},
  minase:{"opener":{"clip":"Fifty-Three Stations","at":0.21},"cine":{"from":0.21,"at":0.8,"windows":[[0.21,0.63,0.47],[0.63,1,0.8]]}},
  aquilo:{"opener":{"clip":"Great Migration","at":0.21},"cine":{"from":0.21,"at":0.8,"windows":[[0.21,0.63,0.47],[0.63,1,0.8]]}},
  'psyche':{"opener":{"clip":"Silk Cocoon","at":0.14},"cine":{"from":0.14,"at":0.82,"windows":[[0.14,0.625,0.43],[0.625,1,0.82]]}},
  'ovid':{"opener":{"clip":"Full Demolition","at":0.18},"cine":{"from":0.18,"at":0.81,"windows":[[0.18,0.56,0.415],[0.56,1,0.81]]}},
  hawser:{"formOnly":true,"formOpener":{"clip":"Advancing Rage","at":0.13333333333333333},"cine":{"from":0.13333333333333333,"at":0.8238095238095238,"windows":[[0.13333333333333333,0.43,0.3285714285714285],[0.43,0.69,0.5523809523809523],[0.69,1,0.8238095238095238]]}},
  rotfalke:{opener:{clip:"Ten-Count Talons",at:.14},cine:{from:.14,at:.83,windows:[[.14,.44,.34],[.44,.70,.56],[.70,1,.83]]}},
  bonsho:{"opener":{"clip":"Hundred and Eight Tolls","at":0.13},"cine":{"from":0.13,"at":0.84,"windows":[[0.13,0.4,0.34],[0.4,0.53,0.46],[0.53,0.72,0.6],[0.72,1,0.84]]}},
  yodaka:{opener:{clip:"Ninth Watch: Nighthawk Star",at:.55/4.2},cine:{from:.55/4.2,at:3.5/4.2,windows:[[.55/4.2,.47,89/252],[.47,.71,149/252],[.71,1,3.5/4.2]]}},
  murex:{"opener":{"clip":"Spinestorm","at":0.17},"cine":{"from":0.17,"at":0.81,"windows":[[0.17,1,0.81]]}},
  kinu:{"opener":{"clip":"Broken Shackles","at":0.125},"cine":{"from":0.125,"at":0.795,"windows":[[0.125,0.27875,0.2375],[0.27875,0.36125,0.32],[0.36125,0.44375,0.4025],[0.44375,0.52625,0.485],[0.52625,0.6125,0.5675],[0.6125,0.7262500000000001,0.6575],[0.7262500000000001,1,0.795]]}},
  'madake':{"opener":{"clip":"Midwinter Bamboo","at":0.12562814070351758},"cine":{"from":0.12562814070351758,"at":0.7839195979899498,"windows":[[0.12562814070351758,0.49748743718592964,0.37185929648241206],[0.49748743718592964,1,0.7839195979899498]]},"formOpener":{"clip":"Midwinter Bamboo","at":0.12562814070351758}},
  akayuri:{"opener":{"clip":"Equinox: Lily Field","at":0.18},"cine":{"from":0.18,"at":0.82,"windows":[[0.18,0.65,0.48],[0.65,1,0.82]]}},
  hagure:{"opener":{"clip":"Pack of One","at":0.11640211640211641},"formOpener":{"clip":"Pack of One","at":0.11640211640211641},"cine":{"from":0.11640211640211641,"at":0.798941798941799,"windows":[[0.11640211640211641,0.3531746031746032,0.2751322751322752],[0.3531746031746032,0.5105820105820106,0.4312169312169312],[0.5105820105820106,0.6944444444444444,0.58994708994709],[0.6944444444444444,1,0.798941798941799]]}},
  hisame:{"opener":{"clip":"WHITEOUT: Glass Coffin","at":0.18},"cine":{"from":0.18,"at":0.8,"windows":[[0.18,1,0.8]]}},
  svanhild:{"opener":{"clip":"Tidal Roar","at":0.18},"cine":{"from":0.18,"at":0.8,"windows":[[0.18,1,0.8]]}},
  mizuhiki:{"opener":{"clip":"Bitter End","at":0.13},"cine":{"from":0.13,"at":0.805,"windows":[[0.13,0.3625,0.295],[0.3625,0.515,0.445],[0.515,0.7,0.6],[0.7,1,0.805]]}},
  'shibuichi':{"opener":{"clip":"KINTSUGI: Golden Seam","at":0.1409090909090909},"cine":{"from":0.1409090909090909,"at":0.8090909090909091,"windows":[[0.1409090909090909,0.5,0.40454545454545454],[0.5,1,0.8090909090909091]]}},
  'rakucho':{"opener":{"clip":"Last Chapter","at":0.13333333333333333},"formOpener":{"clip":"Last Chapter","at":0.13333333333333333},"cine":{"from":0.13333333333333333,"at":0.8053333333333333,"windows":[[0.13333333333333333,0.42000000000000004,0.32],[0.42000000000000004,0.6626666666666667,0.52],[0.6626666666666667,1,0.8053333333333333]]}},
  irbis:{"opener":{"clip":"Avalanche Talons","at":0.19},"cine":{"from":0.19,"at":0.64,"windows":[[0.19,1,0.64]]},"formOpener":{"clip":"Avalanche Talons","at":0.19}},
  shidare:{"opener":{"clip":"Last Petal","at":0.18},"cine":{"from":0.18,"at":0.8,"windows":[[0.18,0.635,0.47],[0.635,1,0.8]]}},
  hinomoto:{"opener":{"clip":"Funeral Pyre","at":0.125},"cine":{"from":0.125,"at":0.785,"windows":[[0.125,0.5,0.36],[0.5,1,0.785]]}},
  amagoi:{"opener":{"clip":"Ash Moon","at":0.14210526315789476},"formOpener":{"clip":"Ash Moon","at":0.14210526315789476},"cine":{"from":0.14210526315789476,"at":0.8105263157894738,"windows":[[0.14210526315789476,0.4565789473684211,0.36052631578947375],[0.4565789473684211,0.6815789473684211,0.5526315789473685],[0.6815789473684211,1,0.8105263157894738]]}},
  'shakudo':{"opener":{"clip":"TANREN: White Heat","at":0.13725490196078433},"cine":{"from":0.13725490196078433,"at":0.8088235294117646,"windows":[[0.13725490196078433,0.5269607843137255,0.3995098039215686],[0.5269607843137255,1,0.8088235294117646]]}},
  hikui:{"opener":{"clip":"Violet Balefire","at":0.14},"cine":{"from":0.14,"at":0.79,"windows":[[0.14,0.65,0.51],[0.65,1,0.79]]}},
  tokan:{"opener":{"clip":"Winter Sleep","at":0.1217948717948718},"cine":{"from":0.1217948717948718,"at":0.7698561601000625,"windows":[[0.1217948717948718,0.5897435897435898,0.33760683760683763],[0.5897435897435898,1,0.7698561601000625]]}},
  strappado:{"opener":{"clip":"Curtain Call","at":0.1443298969072165},"cine":{"from":0.1443298969072165,"at":0.8195876288659795,"windows":[[0.1443298969072165,0.58,0.4123711340206186],[0.58,1,0.8195876288659795]]}},
  unari:{"opener":{"clip":"AYATORI: Cat's Cradle","at":0.1611111111111111},"cine":{"from":0.1611111111111111,"at":0.8027777777777778,"windows":[[0.1611111111111111,0.28888888888888886,0.24166666666666667],[0.28888888888888886,0.3833333333333333,0.3361111111111111],[0.3833333333333333,0.47777777777777775,0.4305555555555556],[0.47777777777777775,0.5722222222222222,0.5249999999999999],[0.5722222222222222,0.6597222222222222,0.6194444444444445],[0.6597222222222222,0.7513888888888889,0.7],[0.7513888888888889,1,0.8027777777777778]]}},
  barrow:{"opener":{"clip":"Jettison: Full Hold","at":0.1326530612244898},"cine":{"from":0.1326530612244898,"at":0.8290816326530612,"windows":[[0.1326530612244898,0.58,0.3903061224489796],[0.58,1,0.8290816326530612]]}},
  sashigane:{opener:{clip:"Final Inspection",at:.45/3.8},cine:{from:.45/3.8,at:3.1/3.8,windows:[[.45/3.8,.43,1.2/3.8],[.43,.67,2.05/3.8],[.67,1,3.1/3.8]]}},
  gosu:{"opener":{"clip":"Gilded Scars","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7885714285714285,"windows":[[0.14857142857142858,0.30714285714285716,0.26857142857142857],[0.30714285714285716,0.3842857142857143,0.3457142857142857],[0.3842857142857143,0.4614285714285714,0.4228571428571429],[0.4614285714285714,0.5385714285714286,0.5],[0.5385714285714286,0.6185714285714285,0.5771428571428572],[0.6185714285714285,0.7242857142857142,0.66],[0.7242857142857142,1,0.7885714285714285]]}},
  kusushi:{"opener":{"clip":"Double or Nothing","at":0.17},"cine":{"from":0.17,"at":0.8,"windows":[[0.17,0.55,0.39],[0.55,1,0.8]]}},
  hakushi:{"opener":{"clip":"Lion Dance: Over the Cliff","at":0.16},"cine":{"from":0.16,"at":0.8,"windows":[[0.16,0.66,0.56],[0.66,1,0.8]]}},
  suzuran:{...SUZURAN_CINEMATIC,cine:{...SUZURAN_CINEMATIC.cine,windows:SUZURAN_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  wataame:{"opener":{"clip":"SHIMEKIRI: Past Due","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7942857142857143,"windows":[[0.14857142857142858,0.4514285714285714,0.3485714285714286],[0.4514285714285714,0.6742857142857143,0.5542857142857143],[0.6742857142857143,1,0.7942857142857143]]}},
  bruin:{"opener":{"clip":"Past Due Slash","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7942857142857143,"windows":[[0.14857142857142858,0.4514285714285714,0.3485714285714286],[0.4514285714285714,0.6742857142857143,0.5542857142857143],[0.6742857142857143,1,0.7942857142857143]]}},
  senko:{...SENKO_CINEMATIC,cine:{...SENKO_CINEMATIC.cine,windows:SENKO_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  buna:{...BUNA_CINEMATIC,cine:{...BUNA_CINEMATIC.cine,windows:BUNA_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  oyashio:{opener:{clip:'Grand Gyre',at:(.8*21/26)/3.9},cine:{from:(.8*21/26)/3.9,at:(2.6+1.3*26/55)/3.9,windows:[[(.8*21/26)/3.9,2.6/3.9,(1+1.4*41/58)/3.9],[2.6/3.9,1,(2.6+1.3*26/55)/3.9]]}},
  adad:{opener:{clip:'Firmament Fall',at:.55/3.75},cine:{from:.55/3.75,at:.84,windows:[[.55/3.75,2.5/3.75,1.85/3.75],[2.5/3.75,1,.84]]}},
  shijima: {"opener":{"clip":"White Haze","at":0.17142857142857146},"cine":{"from":0.17142857142857146,"at":0.8063492063492064,"windows":[[0.17142857142857146,0.6095238095238095,0.5015873015873016],[0.6095238095238095,1,0.8063492063492064]]}},
  akaito: {"opener":{"clip":"Pinky Promise","at":0.18},"cine":{"from":0.18,"at":0.81,"windows":[[0.18,0.61,0.45],[0.61,1,0.81]]}},
  tempo:{"opener": {"clip": "Perfect Timing", "at": 0.1264705882352941}, "cine": {"from": 0.1264705882352941, "at": 0.8058823529411766, "windows": [[0.1264705882352941, 0.275, 0.22941176470588237], [0.275, 0.3661764705882353, 0.3205882352941177], [0.3661764705882353, 0.4573529411764706, 0.4117647058823529], [0.4573529411764706, 0.5485294117647059, 0.5029411764705882], [0.5485294117647059, 0.6426470588235295, 0.5941176470588235], [0.6426470588235295, 0.748529411764706, 0.6911764705882354], [0.748529411764706, 1, 0.8058823529411766]]}},
  tancho:{opener:{clip:'Thousand Cranes',at:.155},cine:{from:.155,at:.81,windows:[[.155,.58,.46],[.58,1,.81]]}},
  bellows:{opener:{clip:'Meltdown',at:.13},cine:{from:.13,at:.78,windows:[[.13,.58,.43],[.58,1,.78]]}},
  mikage:{opener:{clip:'Raijin Opener',at:.5},cine:{from:0,at:.78,windows:[[0,.445,.35],[.445,.66,.54],[.66,1,.78]]}},
  // One native take: the opening sweep continues into its leap and landing after confirmation.
  'full-beam':{opener:{clip:'Seven Seas Haymaker',at:.15},cine:{from:.15,at:.8,windows:[[.15,.51,.39],[.51,1,.8]]}},
  pyroclast:{opener:{clip:'Supervolcano',at:.16},cine:{from:.16,at:.78,windows:[[.16,.60,.48],[.60,1,.78]]}},
  ampere:{opener:{clip:'Lights Out Overdrive',at:.19},cine:{from:.19,at:.79,windows:[[.19,.62,.5],[.62,1,.79]]}},
  shanxiao:{opener:{clip:'Sun Chaser',at:.148},cine:{from:.148,at:.77,windows:[[.148,.5,.39],[.5,1,.77]]}},
  kuzu:{opener:{clip:'Bonegrinder',at:.48/2.8},cine:{from:.48/2.8,at:2.2/2.8,windows:[[.48/2.8,1.18/2.8,1/2.8],[1.18/2.8,1.7/2.8,1.4/2.8],[1.7/2.8,1,2.2/2.8]]}},
  shakugo: {...SHAKUGO_CINEMATIC,cine:{...SHAKUGO_CINEMATIC.cine,windows:SHAKUGO_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  'basilissa':{opener:{clip:'Empress Opener',at:12/34},cine:{from:0,at:45/84,windows:[[0,1,45/84]]}},
  sorayomi:{opener:{clip:'Storm Warning',at:18/81},cine:{from:18/81,at:58/81,windows:[[18/81,1,58/81]]}},
  strix:{opener:{clip:'I Wont Hold Back',at:24/92},cine:{from:24/92,at:60/92,windows:[[24/92,1,60/92]]}},
  kenzo:{opener:{clip:'Mirage Draw',at:.2435},cine:{from:0,at:.5085}},
  nigo:{opener:{clip:'Scorched Earth',at:.3824},cine:{from:0,at:.596}},
  shirokane:{opener:{clip:'Sickle Bolt',at:.6143},cine:{from:.25,at:.6291}},
  kosho:{opener:{clip:'Banquet Infernal Open',at:0.6452},cine:{from:0.1271,at:0.7398,windows:[[0.1271,0.2739,0.2259],[0.2739,0.3671,0.3106],[0.3671,0.5506,0.4235],[0.5506,1,0.7398]]}},
  gummy:{opener:GRAND_TIDE_TAKE.open,formOpener:GRAND_TIDE_TAKE.open,cine:GRAND_TIDE_TAKE.cine},
  // Round 7 (WARD ULT): ROOM and Crossmatch are the opener now (ward/crossmatch.ts): his own take (ward-ult1.glb), the left hand
  // up open over the floor as the dome opens off it, turned up for the swap, and out on them on the blow - where his own
  // 'Flatline Shock' holds it through the cinematic, which goes on as it was. (It was the Cautery Blade's thrust.)
  ward:{opener:CROSSMATCH_TAKE.open,cine:CROSSMATCH_TAKE.cine},
  // Hound Rampage is a string of blows (STRING_WINDOWS below): its first
  // is the base body's Cleave, the four after it the armour's.
  gaunt:{opener:{clip:'Butcher Cleave',at:.533},cine:{from:.2593,at:.7346,windows:[[.2593,.3704,.321],[.3951,.4938,.4321],[.4938,.5926,.5432],[.6173,1,.7346]]}},
  ouga:{release:.5417},
  shiden:{release:.6667},
  taisei:{release:.653},
  konta:{release:.5965},
  kagari:{release:.652},
  // The Drowned Sun: his raised hand flung forward at 1.33 s of the 2.3 (scripts/economy/build_fighter.py).
  'jinlin':{release:.58},
  // The Sun-Seizing Spiral: two fingers held at his forehead, then the arm thrown out, straight at .76 of the clip
  // (scripts/economy/build_fighter.py, gohaku-black).
  'gohaku':{release:.76},
};
/** Round 3d (ULTS): an opener's follow-through runs this long past its blow:
 *  its hitbox and a whiff's recovery. */
const OPENER_TAIL=WHIFF_RECOVERY+.12;
/** Round 3d (ULTS): a cinematic's clip is built slowly to CINE_BUILT of the
 *  way to its blow, then driven into it over the last CINE_DRIVE of the
 *  time before the finisher (a fifth), as a swing's drive is (STRIKE_DRIVE). */
const CINE_BUILT=.55,CINE_DRIVE=.2;
/** Round 3d (ULTS): the fastest an opener's wind-up is played against how it
 *  was drawn, before the head of its clip is skipped. */
const OPENER_FASTEST=2.2;
/** Round 3d (ULTS): the ultimate as thrown - the awakened one, for the two
 *  spirit users whose awakened time stop is a longer tour - kept once per fighter
 *  and form, since moveFor builds an awakened move afresh on every call. */
const ULTIMATE_AS_THROWN=new Map<string,MoveDefinition>();
function ultimateMove(fighter:FighterId,awakened:boolean):MoveDefinition{
  const key=fighter+(awakened?'!':'');
  let move=ULTIMATE_AS_THROWN.get(key);
  if(!move){move=awakenedMoveFor(fighter,'ultimate',awakened);ULTIMATE_AS_THROWN.set(key,move);}
  return move;
}
/** An awakened form that fights in clips of its own: where their blows are drawn. A form otherwise shares its
 *  fighter's measured fractions (contactFrames.json) and string windows (STRING_WINDOWS), which were measured on
 *  the base body's clips. Gorai's half-wyrm (gorai-wyrm-br1.glb, scripts/economy/build_fighter.py), off
 *  the mast-breaker's head at 24 frames a second: the lunge's swing at 0.25 s of 0.875, the leaping slam into the floor
 *  at 0.25 of 1.29, the spinning sweep down to the floor at 0.27 of 0.92; TIMBER: The Forest Falls twirls the mast-breaker over
 *  his head - its first pass at 0.42 s is the opener - and brings it down at 1.25 s of 2.25. */
const FORM_CONTACT:Partial<Record<FighterId,Partial<Record<AttackSlot,number>>>>={hawser:{light:.5,heavy:.54,special:.58,ultimate:.13333333333333333},rotfalke:{light:.46,heavy:.56,special:.58,ultimate:.14},'madake':{"light":0.48,"heavy":0.5212765957446809,"special":0.5441176470588235,"ultimate":0.12562814070351758},akayuri:{"light":0.46,"heavy":0.56,"special":0.6,"ultimate":0.18},hagure:{"light":0.4464285714285714,"heavy":0.5377358490566037,"special":0.49107142857142855,"ultimate":0.11640211640211641},'rakucho':{light:.46666666666666673,heavy:.5462962962962963,special:.5,ultimate:.13333333333333333},irbis:{light:.43,heavy:.48,special:.62,ultimate:.19},gorai:{light:.286,heavy:.194,special:.3},
  // Shiun's winged form looses GLASS LANCES where the move's own clock puts it (0.7 s of 1.7): the 0.78 in
  // contactFrames.json is base Shiun's, his sword levelled at 1.4 s of the 1.8 of his own clip (3 October).
  shiun:{special:.412}};
/** A form's stage clips' blows, by the clip's name, where its clips share their names with its fighter's body's and are
 *  other takes (contactFrames.json is read by name): the YUGE's `Rush 1` to `Rush 3` are its hooks, the Scout's
 *  Levin's reverse-quill, kick and rising blade. */
const FORM_CONTACT_BY_KEY:Partial<Record<FighterId,Record<string,number|undefined>>>={hawser:{'Rush 1':.5,'Rush 2':.5,'Rush 3':.54}};
const FORM_STRING_WINDOWS:Partial<Record<FighterId,Partial<Record<AttackSlot,[number,number,number?][]>>>>={gorai:{ultimate:[[0,.32,.187],[.32,1,.556]]},
  // The YUGE's rampage: its four blows in Advancing Rage (the windows that were adult Hawser's).
  hawser:{ultimate:[[0,.23,.13333333333333333],[.23,.43,.3285714285714285],[.43,.69,.5523809523809523],[.69,1,.8238095238095238]]}};
const OWN_BODY_ULTIMATE:ReadonlySet<FighterId>=new Set<FighterId>(['chohan','aqrab','tsubute','yodaka','psyche','ovid','hawser','rotfalke','bonsho','murex','akayuri','hagure','hisame','mizuhiki','shibuichi','rakucho','shidare','hinomoto','amagoi','magatsu','shiun','gaku','vesper','rook','jinlin','kusushi','ume','lanthorn','highsun','minase']);
if(LUCY_TIDE){ULTIMATE_CLIPS.gummy=TIDE_PLAN;(OWN_BODY_ULTIMATE as Set<FighterId>).add('gummy');}
const WHEEL_VIEW=THREE.MathUtils.degToRad(32),WHEEL_NOTCH=.32;
const _wheelAxis=new THREE.Vector3(),_wheelEye=new THREE.Vector3(),_wheelCross=new THREE.Vector3(),_wheelCentre=new THREE.Vector3();
const _wheelTip=new THREE.Quaternion(),_wheelParent=new THREE.Quaternion(),_wheelSpin=new THREE.Quaternion();
const WHEEL_HITS:ReadonlySet<string>=new Set(['hurt','flinch','launched','knockdown','stun']);
const STRING_WINDOWS:Partial<Record<FighterId,Partial<Record<AttackSlot,[number,number,number?][]>>>>={
  chohan:{"ultimate":[[0,0.2125,0.1375],[0.2125,0.375,0.2875],[0.375,0.55,0.4625],[0.55,0.73125,0.6375],[0.73125,1,0.825]]},
  aqrab:{"ultimate":[[0,0.19512195121951223,0.0829268292682927],[0.19512195121951223,0.5609756097560976,0.3609756097560976],[0.5609756097560976,1,0.7560975609756099]]},
  tsubute:{"ultimate":[[0,0.26881720430107525,0.14516129032258066],[0.26881720430107525,0.629032258064516,0.4139784946236559],[0.629032258064516,1,0.8387096774193549]],"special":[[0,1,0.5076923076923077]]},
  ume:{"ultimate":[[0,0.285,0.17],[0.285,0.58,0.4],[0.58,1,0.82]]},
  lanthorn:{"ultimate":[[0,0.24285714285714285,0.14857142857142858],[0.24285714285714285,0.4385714285714285,0.33714285714285713],[0.4385714285714285,0.6628571428571428,0.5399999999999999],[0.6628571428571428,1,0.7857142857142857]]},
  highsun:{"ultimate":[[0,0.23,0.12],[0.23,0.55,0.34],[0.55,1,0.7625]]},
  torsion:{"ultimate":[[0,0.26,0.12755102040816327],[0.26,0.5357142857142857,0.39540816326530615],[0.5357142857142857,1,0.8010204081632654]]},
  kubiwa:{"ultimate":[[0,0.2563380281690141,0.16338028169014085],[0.2563380281690141,0.4605633802816902,0.34929577464788736],[0.4605633802816902,0.6830985915492958,0.571830985915493],[0.6830985915492958,1,0.7943661971830985]]},
  onigawara:{"ultimate":[[0,0.37,0.235],[0.37,1,0.775]]},
  cardo:{"ultimate":[[0,0.2809,0.235],[0.2809,0.3739,0.3267],[0.3739,0.4725,0.4211],[0.4725,0.5906,0.5239],[0.5906,0.7503,0.6572],[0.7503,1,0.8433]]},
  minase:{"ultimate":[[0,0.34,0.21],[0.34,0.635,0.47],[0.635,1,0.8]]},
  aquilo:{"ultimate":[[0,0.34,0.21],[0.34,0.635,0.47],[0.635,1,0.8]]},
  'psyche':{ultimate:[[0,0.285,0.14],[0.285,0.625,0.43],[0.625,1,0.82]]},
  'ovid':{ultimate:[[0,.29,.18],[.29,.56,.415],[.56,1,.81]]},
  // Scout Hawser's Slipped Moorings is Levin's SOJI: Clean Sweep fitted to him: the slash and the spin in the same seven cuts.
  hawser:{ultimate:[[0,.356,.181],[.356,.457,.406],[.457,.558,.507],[.558,.658,.608],[.658,.759,.709],[.759,.86,.81],[.86,1,.915]]},
  rotfalke:{ultimate:[[0,.24,.14],[.24,.44,.34],[.44,.70,.56],[.70,1,.83]]},
  bonsho:{ultimate:[[0,0.23,0.13],[0.23,0.4,0.34],[0.4,0.53,0.46],[0.53,0.72,0.6],[0.72,1,0.84]]},
  yodaka:{ultimate:[[0,.24,.55/4.2],[.24,.47,89/252],[.47,.71,149/252],[.71,1,3.5/4.2]]},
  murex:{ultimate:[[0,0.3,0.17],[0.3,1,0.81]]},
  kinu:{"ultimate":[[0,0.18125,0.125],[0.18125,0.27875,0.2375],[0.27875,0.36125,0.32],[0.36125,0.44375,0.4025],[0.44375,0.52625,0.485],[0.52625,0.6125,0.5675],[0.6125,0.7262500000000001,0.6575],[0.7262500000000001,1,0.795]],"special":[[0,0.3918918918918919,0.2972972972972973],[0.3918918918918919,0.5844594594594594,0.48648648648648646],[0.5844594594594594,1,0.6824324324324325]]},
  'madake':{ultimate:[[0,0.3,0.12562814070351758],[0.3,0.55,0.37185929648241206],[0.55,1,0.7839195979899498]]},
  akayuri:{ultimate:[[0,0.33,0.18],[0.33,0.65,0.48],[0.65,1,0.82]]},
  hagure:{ultimate:[[0,0.19576719576719578,0.11640211640211641],[0.19576719576719578,0.3531746031746032,0.2751322751322752],[0.3531746031746032,0.5105820105820106,0.4312169312169312],[0.5105820105820106,0.6944444444444444,0.58994708994709],[0.6944444444444444,1,0.798941798941799]]},
  hisame:{ultimate:[[0,0.31,0.18],[0.31,1,0.8]]},
  svanhild:{ultimate:[[0,0.31,0.18],[0.31,1,0.8]]},
  mizuhiki:{ultimate:[[0,0.2125,0.13],[0.2125,0.37,0.295],[0.37,0.5225,0.445],[0.5225,0.7025,0.6],[0.7025,1,0.805]]},
  'shibuichi':{ultimate:[[0,.27,0.1409090909090909],[.27,.60,0.40454545454545454],[.60,1,0.8090909090909091]]},
  'rakucho':{ultimate:[[0,0.22666666666666668,0.13333333333333333],[0.22666666666666668,0.42000000000000004,0.32],[0.42000000000000004,0.6626666666666667,0.52],[0.6626666666666667,1,0.8053333333333333]]},
  irbis:{ultimate:[[0,0.3,0.19],[0.3,1,0.64]]},
  shidare:{"ultimate":[[0,0.325,0.18],[0.325,0.635,0.47],[0.635,1,0.8]]},
  hinomoto:{ultimate:[[0,.2425,.125],[.2425,.5725,.36],[.5725,1,.785]]},
  amagoi:{"ultimate":[[0,0.25131578947368427,0.14210526315789476],[0.25131578947368427,0.4565789473684211,0.36052631578947375],[0.4565789473684211,0.6815789473684211,0.5526315789473685],[0.6815789473684211,1,0.8105263157894738]]},
  'shakudo':{"ultimate":[[0,0.26838235294117646,0.13725490196078433],[0.26838235294117646,0.5269607843137255,0.3995098039215686],[0.5269607843137255,1,0.8088235294117646]]},
  hikui:{"ultimate":[[0,0.3,0.14],[0.3,0.65,0.51],[0.65,1,0.79]]},
  tokan:{"ultimate":[[0,0.25641025641025644,0.1217948717948718],[0.25641025641025644,0.5897435897435898,0.33760683760683763],[0.5897435897435898,1,0.7698561601000625]]},
  strappado:{"ultimate":[[0,0.25,0.1443298969072165],[0.25,0.58,0.4123711340206186],[0.58,1,0.8195876288659795]]},
  unari:{"ultimate":[[0,0.2013888888888889,0.1611111111111111],[0.2013888888888889,0.28888888888888886,0.24166666666666667],[0.28888888888888886,0.3833333333333333,0.3361111111111111],[0.3833333333333333,0.47777777777777775,0.4305555555555556],[0.47777777777777775,0.5722222222222222,0.5249999999999999],[0.5722222222222222,0.6597222222222222,0.6194444444444445],[0.6597222222222222,0.7513888888888889,0.7],[0.7513888888888889,1,0.8027777777777778]]},
  barrow:{"ultimate":[[0,0.25,0.1326530612244898],[0.25,0.58,0.3903061224489796],[0.58,1,0.8290816326530612]]},
  sashigane:{ultimate:[[0,.22,.45/3.8],[.22,.43,1.2/3.8],[.43,.67,2.05/3.8],[.67,1,3.1/3.8]]},
  gosu:{"ultimate":[[0,0.20857142857142857,0.14857142857142858],[0.20857142857142857,0.30714285714285716,0.26857142857142857],[0.30714285714285716,0.3842857142857143,0.3457142857142857],[0.3842857142857143,0.4614285714285714,0.4228571428571429],[0.4614285714285714,0.5385714285714286,0.5],[0.5385714285714286,0.6185714285714285,0.5771428571428572],[0.6185714285714285,0.7242857142857142,0.66],[0.7242857142857142,1,0.7885714285714285]],"special":[[0,0.373333,0.286667],[0.373333,0.54,0.46],[0.54,1,0.62]]},
  kusushi:{ultimate:[[0,0.28,0.17],[0.28,0.55,0.39],[0.55,1,0.8]]},
  hakushi:{ultimate:[[0,0.28,0.16],[0.28,0.66,0.56],[0.66,1,0.8]]},
  suzuran:{ultimate:[[0,.17,.10],[.17,.34,.244444],[.34,.48,.383333],[.48,.62,.527778],[.62,.79,.688889],[.79,1,.861111]]},
  wataame:{ultimate:[[0,0.24857142857142858,0.14857142857142858],[0.24857142857142858,0.4514285714285714,0.3485714285714286],[0.4514285714285714,0.6742857142857143,0.5542857142857143],[0.6742857142857143,1,0.7942857142857143]]},
  bruin:{ultimate:[[0,0.24857142857142858,0.14857142857142858],[0.24857142857142858,0.4514285714285714,0.3485714285714286],[0.4514285714285714,0.6742857142857143,0.5542857142857143],[0.6742857142857143,1,0.7942857142857143]]},
  senko:{ultimate:[[0,.66/3.45,.39/3.45],[.66/3.45,1.62/3.45,1.32/3.45],[1.62/3.45,2.3/3.45,1.92/3.45],[2.3/3.45,1,2.74/3.45]]},
  buna:{ultimate:[[0,.26,.54/3.72],[.26,.57,1.54/3.72],[.57,1,3.12/3.72]]},
  oyashio:{ultimate:[[0,.8/3.9,(.8*21/26)/3.9],[.8/3.9,2.6/3.9,(1+1.4*41/58)/3.9],[2.6/3.9,1,(2.6+1.3*26/55)/3.9]]},
  adad:{ultimate:[[0,.32,.55/3.75],[.32,2.5/3.75,1.85/3.75],[2.5/3.75,1,.84]]},
  shijima: {"ultimate":[[0,0.27301587301587305,0.17142857142857146],[0.27301587301587305,0.6095238095238095,0.5015873015873016],[0.6095238095238095,1,0.8063492063492064]]},
  akaito: {"ultimate":[[0,0.3,0.18],[0.3,0.61,0.45],[0.61,1,0.81]]},
  tempo:{"ultimate":[[0,0.17794117647058824,0.1264705882352941],[0.17794117647058824,0.275,0.22941176470588237],[0.275,0.3661764705882353,0.3205882352941177],[0.3661764705882353,0.4573529411764706,0.4117647058823529],[0.4573529411764706,0.5485294117647059,0.5029411764705882],[0.5485294117647059,0.6426470588235295,0.5941176470588235],[0.6426470588235295,0.748529411764706,0.6911764705882354],[0.748529411764706,1,0.8058823529411766]]},
  tancho:{ultimate:[[0,.3,.155],[.3,.58,.46],[.58,1,.81]]},
  bellows:{ultimate:[[0,.27,.13],[.27,.58,.43],[.58,1,.78]]},
  mikage:{ultimate:[[0,.24,.14],[.24,.445,.35],[.445,.66,.54],[.66,1,.78]]},
  // Native skill_b sweep at frame24 and diving landing at60 of the retained92 frames.
  'full-beam':{ultimate:[[0,.27,.15],[.27,.51,.39],[.51,1,.8]]},
  pyroclast:{ultimate:[[0,.30,.16],[.30,.60,.48],[.60,1,.78]]},
  ampere:{ultimate:[[0,.35,.19],[.35,.62,.5],[.62,1,.79]]},
  shanxiao:{ultimate:[[0,.25,.148],[.25,.5,.39],[.5,1,.77]]},
  kuzu:{ultimate:[[0,.72/2.8,.48/2.8],[.72/2.8,1.18/2.8,1/2.8],[1.18/2.8,1.7/2.8,1.4/2.8],[1.7/2.8,1,2.2/2.8]]},
  shakugo:{ultimate:[[0,.82/3.95,.44/3.95],[.82/3.95,2.55/3.95,1.51/3.95],[2.55/3.95,1,3.15/3.95]]},
  'basilissa':{heavy:[[0,20/55,12/55],[20/55,35/55,27/55],[35/55,1,42/55]]},
  sorayomi:{ultimate:[[0,38/81,18/81],[38/81,1,58/81]]},
  strix:{ultimate:[[0,42/92,24/92],[42/92,1,60/92]]},
  // Measured on the rig, hand speed per 0.005 of clip: the first punch is an
  // overhead authored at 20 m/s (0.42 m per 0.005 at 0.130, the hand ends
  // 1.96 m up), the second a slow raise peaking at 0.400, the third a hook
  // whose rise is 0.545-0.565 and which is out from 0.56. Each window is
  // sized so that its share of the move plays it within about 1.6x of the
  // speed it was drawn at: the punches near 1x, the slow drifts between them
  // faster. The one seam that is not contiguous, 0.155 to 0.30, skips a
  // hand drifting down from overhead - measured, a 0.22 m step - because
  // sweeping it at the twelve times the move leaves for it moved the hand
  // 0.88 m in one frame.
  konta:{light:[[.095,.155,.133],[.30,.53,.40],[.535,.66,.56]]},
  // Setsuna: Tsumuji is Shirokane's Void Eye: Sickle Bolt carried onto
  // Setsu: a crouched charge (0-0.52), one strike (the hand shoots from
  // 0.11 m behind the hips to 0.57 m ahead between 0.52 and 0.58), a driven
  // hold to 0.80 and the recovery, measured on the exported GLB (the same
  // donor frames on either Setsu body, so the windows hold for both). The clip
  // has one blow in it and the pacing never rewinds a clip, so replaying
  // the strike for each of the six blows of the blur is not available:
  // instead the blur is the charge - the body low and vibrating with the
  // lightning while the six hits register on the effects - and the one
  // strike the clip does have is the finisher, its frame on the seventh
  // contact and the drive and recovery after it at about the speed drawn.
  setsu:{ultimate:[[0,.14,.10],[.14,.20,.17],[.20,.26,.23],[.26,.32,.29],[.32,.38,.35],[.38,.44,.41],[.44,1,.56]]},
  gaunt:{ultimate:[[0,.2346,.1852],[.2593,.3704,.321],[.3951,.4938,.4321],[.4938,.5926,.5432],[.6173,1,.7346]]},
  // The shop's own clips (3 October, assets/motion/humanoid-shop): each window's blow is where its striking hand or
  // foot - the fastest in the window, relative to the hips - is out at its furthest (the first frame at 95% of it), as
  // the originals' contacts are measured (scripts/measure_contact_frames.py).
  // Vesper's Eclipse, one take: the thrust (through at 0.31 s of the 3.03), the leap, and the sabre driven down as he
  // lands (1.97).
  vesper:{ultimate:[[0,.23,.157],[.23,1,.651]]},
  // Imago's Stinger Storm is the leaping spin (a hand round at 0.92 s of its 2.1) and the kick out of it (1.29); the
  // King's Decree the palm to the chest (0.42 s of 3.53), the blur of fists (1.31) and the slam into the floor (2.21).
  imago:{special:[[0,.5,.456],[.5,1,.615]],ultimate:[[0,.21,.134],[.21,.5,.37],[.5,1,.625]]},
  // Wuming's Heaven's Harvest is his rush's flying kick (the foot out at 0.36 s of the 1.375) joined to both hands
  // drawn up overhead and brought down, the scythe's swing (the hands through at 1.07): scripts/economy/build_fighter.py.
  // The scythe sweeps them once as it forms, a window of its own between (moves.ts: three blows).
  'wuming':{ultimate:[[0,.29,.26],[.29,.55,.45],[.55,1,.776]]},
  // Jirenga's Mountain-Felling Fist is his rush's hook (the fist through at 0.167 s of the 1.75) joined to the whole heavy -
  // the leap, the fist raised, and the diving punch (through at 1.17): hand speed, scripts/economy/build_fighter.py.
  jirenga:{ultimate:[[0,.286,.095],[.286,1,.667]]},
  // Ippon's Clean Slate is one punch (scripts/economy/retime_clip.py, build_ippon.sh): he plants into the end of
  // his draw-back (0.45 s of the 2.29, the opener), holds it, and throws the straight right out of it (through at 1.59).
  ippon:{ultimate:[[0,.218,.196],[.218,1,.694]]},
  sekka:{heavy:[[0,.27,.166],[.27,.46,.372],[.46,.97,.772]],ultimate:[[0,.375,.15],[.375,1,.563]]},
  // Tobari's Red Moon Reverie is the kunai's cut (through at 0.18 s of the 3.73) joined to the one hand raised before his face
  // as the eyes take them (0.96).
  // The five stabs in the illusion are a window each, a sliver of the held hand apiece, so it holds while they land
  // (moves.ts: seven blows; Fighter plays an ultimate's windows only with one a contact).
  tobari:{ultimate:[[0,.188,.047],[.188,.206,.197],[.206,.225,.216],[.225,.243,.234],[.243,.262,.252],[.262,.28,.271],[.28,1,.301]]},
  // Akagane's Heaven's Anvil is his jab (0.43 s of 3.83) joined to the arm thrown up to the sky (1.64); Asahi's
  // Lantern Rite: First Light the turning cut (0.94 s of 3.03) and the overhead blow he lands with (2.41); Levin's Spinning
  // Assault his reverse-quill (0.41 s of 2.25) and the spin's last pass (2.06); Rook's Black Rookery the dagger's cut (0.38 s
  // of 3.58) and the hand thrown up to the sky as the shadows rise (1.55).
  akagane:{ultimate:[[0,.209,.133],[.209,1,.428]]},
  // Each of the blows between (moves.ts) is a window of its own out of the stretch before the last one: Asahi's
  // rising cut as he leaps, Levin's spin in five cuts, the shadows falling on them one by one.
  asahi:{ultimate:[[0,.5,.31],[.5,.62,.56],[.62,1,.794]]},
  levin:{ultimate:[[0,.356,.181],[.356,.457,.406],[.457,.558,.507],[.558,.658,.608],[.658,.759,.709],[.759,.86,.81],[.86,1,.915]]},
  'rook':{ultimate:[[0,.154,.106],[.154,.236,.195],[.236,.318,.277],[.318,.4,.359],[.4,1,.433]]},
  // Magatsu's Mirror Mere, a dome on PLANETARIUM's beat (moves.ts): the hand sign made (together at 0.4 s of
  // the 2.55) as the dome closes, held while its four cuts land - a sliver of the held sign each - and Calamity Pyre's bow,
  // already drawing, loosed (2.02) on the finisher.
  magatsu:{ultimate:[[0,.3,.16],[.3,.37,.335],[.37,.44,.405],[.44,.51,.475],[.51,.57,.54],[.57,1,.79]]},
  // Landslide is the jab that opens it (through at 0.28 s of 2.9), then Rock drawn back to the hip, held while
  // the aura gathers, and driven forward (1.81).
  gaku:{ultimate:[[0,.2414,.106],[.2414,1,.624]]},
};
/** The tremor and the breath a held chamber carries, in radians along the
 *  spine. A five-second wind-up has 1.9 s of clip in it, and the alternative
 *  to holding is quarter speed; a held pose with nothing moving is a statue,
 *  so the hold is given a charge shake and a slow breath by the procedural
 *  layer rather than by scrubbing the clip. */
const CHARGE_TREMOR=.022,CHARGE_BREATH=.016;
/** A cast that holds one pose keeps moving.
 *
 *  A blind critic read Gummy's Grand Tide, Kenzo's, Kuon's and Taisei's
 *  ultimates, Shirokane's seal and Konta's Senpugan as statues: eight to
 *  fourteen captured frames of one pose. Measured (scripts/probe_hold_length),
 *  Grand Tide held 4.2 s with no body joint turning 1.5 degrees in a
 *  frame, Kenzo's Dust Sea Sundered 2.3 s, Kuon's PLANETARIUM 2.2 s. A held
 *  chamber is what those moves are - the clip has 1.9 s of footage for a
 *  7.8 s move - so the hold is kept and given life on top: a breath through
 *  the spine and the shoulders, the weight shifting from foot to foot, the
 *  arms pumping as the power gathers, a tremor through the arms and chest,
 *  the head working, and the hair and cloth lifting in the aura's updraft.
 *
 *  It is keyed off the ANIMATION standing still - the busiest canonical joint
 *  of the clip's own pose, before any procedural layer - so a clip that is
 *  moving is left exactly as it was drawn, and the layer is gone before the
 *  blow: it clears HOLD_CLEAR ahead of the last contact, where the drive
 *  starts. After the last blow the tail of a move holds its end pose too;
 *  that gets the breath and the weight shift of a fighter recovering, without
 *  the pump and the tremor.
 *
 *  Speeds are the animation's busiest joint in radians a second: below
 *  STILL it is holding, above MOVING it is not, and in between it keeps
 *  whichever it was. */
const HOLD_STILL=THREE.MathUtils.degToRad(50),HOLD_MOVING=THREE.MathUtils.degToRad(100);
/** How long the pose has to have been still before the layer starts, and by
 *  when it is at full weight; how fast it eases in and out, a second. */
const HOLD_IN:[number,number]=[.04,.16],HOLD_RISE=10,HOLD_FALL=16;
/** The layer is gone this long before the last blow lands, so nothing of it
 *  rides the drive into contact. */
const HOLD_CLEAR=.15;
/** Amplitudes at full weight, in radians and metres, and rates in hertz.
 *  The tremor is two incommensurate shakes so it never reads as a machine;
 *  the pump is a skewed wave - a quick surge and a slower return. */
const HOLD_BREATH={rate:.9,spine:.05,shoulder:.045,head:.03,dip:.008};
const HOLD_SWAY={rate:.42,shift:.032,roll:.035};
const HOLD_PUMP={rate:1.9,arm:.1,skew:.35};
const HOLD_SHAKE={rates:[7.1,11.3] as [number,number],arm:.036,chest:.02,head:.014};
/** A fighter recovering after the last blow breathes deeper and does not
 *  pump or shake. */
const HOLD_AFTER={breath:1.4,sway:.8};
/** The tail of a move, once its clip is spent and its blow long gone: the
 *  fighter settles back into their own stance while the move still owns the
 *  body. Signal Fire's clip is over 1.4 s before the special is; Grand Tide's
 *  1.6 s before the ultimate. Holding the last frame for that long is a
 *  statue; the stance breathes (and Full Swell bounces). How long after the
 *  clip is spent the stance takes over, and over how long. */
const TAIL_AFTER=.06,TAIL_BLEND=.35;
/** How fast the settling tail may bring the body's root home, metres a
 *  second: a step, not a slide (see `limitRootMotion`). */
const TAIL_ROOT_RATE=3.5;
/** Round 3e (REACT): how fast an attack's drawn root may come down out of a
 *  leap in its clip, metres a second, and how far over the stance it must be
 *  for this to hold (see `limitRootMotion`): a slam landing over a sixth of a
 *  second rather than two frames. */
const ROOT_FALL_RATE=7,ROOT_FALL_FROM=.25;
/** How long a change between a relaxed idle and a fight-ready one takes
 *  (IdleProfile.ready): the two stand their feet up to a quarter of a metre
 *  apart, and over the idle's own quarter second the feet slid at 3 m/s. */
const READY_BLEND=.55;
/** Taking a blow, on top of whatever clip the reaction plays.
 *
 *  Through three of Nigo's sword hits Ouga kept the same upright guard:
 *  a rush stage is a flinch, the flinch clip is a standing shake, and the
 *  lean `bodyDynamics` adds is scaled by damage - 2.6 degrees for a
 *  forty-damage stage. Every blow now whips the head and twists the torso
 *  away from it and tips the body the way it travelled, the knees giving,
 *  the arms flung; a straight blow alternates sides stage by stage, which is
 *  what a string of hooks and crosses looks like. The finisher staggers
 *  furthest.
 *
 *  Each blow is its own envelope: a cosine rise over HIT_RISE - inside the
 *  shortest hitstop, the same beat as STRUCK_BLEND - then the free response
 *  of a damped spring from its peak (no velocity step at the peak), with a
 *  small overshoot. They sum, softly limited, so a barrage builds a stagger
 *  rather than stacking snaps. Amplitudes in radians and metres at scale 1. */
// The dream loop (22 October 2026) tried a quicker rise (0.05 and 0.065 s) and a fifth, then a tenth, more recoil: a
// head jumped 10.7 cm in a frame between two blows of a string and a launch's landing turned a joint 31 and 30 degrees
// in one (tests/reactionTakes, tests/heavyReaction) - the pops those guard against. Both stay as they were; the blow's
// snap is the shake in the hold (HIT_SHAKE) and the burst.
const HIT_RISE=.08,HIT_SETTLE=.14,HIT_SWING=2*Math.PI*1.3,HIT_LIFE=.75;
/** The limbs trail the body: their envelope starts a beat after the blow
 *  and rises slower, which is what trailing is - and it keeps the fling off
 *  the struck frame, which is the snap's own worst frame already. */
const LIMB_LAG=.035,LIMB_RISE=.13;
const RUBBER={out:.08,hold:.045,settle:.05,swing:2*Math.PI*5.5,min:2,max:5.2,pull:.25,squash:.05,aim:THREE.MathUtils.degToRad(55),surface:.2,release:.14};
/** How far the knuckles sit past the hand bone the stretch places: the fist
 *  stops with them at the skin (round 3b, see TORSO_RADIUS). */
const RUBBER_KNUCKLES=.1;
/** Which hand each Rubber blow is thrown with, by slot and rush stage:
 *  measured at the contact frame, the hand furthest ahead of the hips. The
 *  right for all of them - this rig's Rogue Wave lands with the right palm
 *  0.6 m ahead and the left still back at the hip. Stage 1 is the Whip, a
 *  kick. */
const RUBBER_HANDS:Record<string,[string,number][]>={'light0':[['Right',1]],'light2':[['Right',1]],'light3':[['Right',1]],
  // Round 5 (GUMMY): Rogue Wave - both palms (PALMS_WIND).
  'heavy0':[['Right',1],['Left',1]],
  // His combo enders' own takes (comboClips.ts) where the blow is a fist and the take leaves room for the stretch: the
  // Storm's uppercut. (The Beacon Crash's fist is drawn by its effect, and its take's arm crosses the body as the
  // stretch would aim it: re-aimed, the shoulder turned 66 degrees in a frame. The Sickle, the Bell and the Axe are a
  // slam, a stubborn-headbutt and a leg.)
  'ender-llh':[['Right',1]]};
const PALMS_WIND={out:.035,hold:.07,back:4.2,rise:[.05,.22] as const,shake:.025,rate:17,apart:.13};
const JAB_WIND={out:.045,back:2.4,rise:[0,.05] as const,shake:.015,rate:17};
const _palmsSide=new THREE.Vector3(),_palmsFacing=new THREE.Vector3(),_palmsTarget=new THREE.Vector3(),_palmsShoulder=new THREE.Vector3();
/** Round 4b (GUMMY): the Gatling's real fists - the SUNSET BARRAGE's, and SUNRISE's dawn barrage's on the form. On each
 *  contact a hand - right, left, right, as the authored clip throws them (characterMotion.ts `gatling`) - is shot down
 *  its forearm's line turned onto the body it is for (by up to `aim`), out to that body's skin however far off it is -
 *  the move's whole range, not RUBBER's few forearm lengths - held a beat on the blow and snapped back before that
 *  hand's next one. With nobody to aim at they go straight ahead, `ahead` metres. Seconds, radians, metres. The many
 *  fists round them are GummyEffects'. */
const GATLING={out:.045,hold:.02,back:.065,aim:THREE.MathUtils.degToRad(80),ahead:6,min:.35};
/** Round 4b (GUMMY): the GRAND TIDE's leap. SUNRISE's own take of it (ULTIMATE_CLIPS) springs him two body heights
 *  into the sky, hangs him there while the fist is blown up and drops him fist-first onto the floor: his attacks' 0.9 m
 *  rise kept him under the fist he was meant to be over. The rest as his. */
const GRAND_TIDE_LEAP={rise:2.6,drop:.3,travel:2.4};
const HIT_REACT={headYaw:.42,headWhip:.37,twist:.4,lean:.3,arms:.35,dip:.052};
const HIT_LIMIT={headYaw:.65,headWhip:.55,twist:.6,lean:.45,arms:.6,dip:.09};
/** The weight of a blow, 0 for a jab to 1 for the biggest, off the scale it
 *  lands with: HIT_HEAVY[0] (a rush stage) to HIT_HEAVY[1] (a finisher, a
 *  special or an ultimate); a heavy is about two thirds of the way.
 *
 *  The last blind critic: "hits read light". Measured on the rig
 *  (scripts/probe_heavy_reaction.mts), a 90-damage heavy turned the head as
 *  far as the limits allow and let it go again inside 0.15 s, and the hips did
 *  not move at all: every blow was a snap. A heavy one now
 *  - holds the recoil HIT_HOLD seconds at its peak and settles HIT_SLOW times
 *    slower, with less of the rebound;
 *  - may turn the body (not the head: see hitReact) HIT_WIDER further than
 *    a flurry of light ones may;
 *  - drives the hips back along the blow, HIP_SHOVE metres at scale 1 (at
 *    most HIP_SHOVE_MOST), and sinks them into the knees, while the feet keep
 *    the floor they were on: the weight goes back through the hips and the
 *    legs take it, instead of the whole body sliding. The hips rise into it
 *    over HIP_RISE, ahead of the chest (HIT_RISE): the weight arrives at the
 *    top of the body last. */
const HIT_HEAVY:[number,number]=[1,2],HIT_HOLD=.09,HIT_SLOW=.9,HIT_WIDER=.45,HIP_SHOVE=.06,HIP_SHOVE_MOST=.17,HIP_RISE=.06,HEAD_LAG=.065;
/** How many blows the layer answers at once: a heavy one lives a second and a
 *  half, and a string must not push it out of the ring while it still shows. */
const HIT_RING=6;
/** The biggest blows are not only harder: a launch by a special, an
 *  ultimate or a blow across the body corkscrews - LAUNCH_SPIN turns about
 *  the line it flies along, as well as the tumble end over end - and every
 *  launch meets the floor: the body is thrown back up LAND_BOUNCE metres per
 *  metre a second it landed at (LAND_BOUNCE_MOST at most) and comes down
 *  again over LAND_TIME, rolling LAND_ROLL radians on along the throw as it
 *  skids and settling back into the downed pose. Whole turns, so the downed
 *  clip takes a body already lying where it wants it. */
const LAUNCH_SPIN=1,LAUNCH_SPUN=.8,LAND_BOUNCE=.028,LAND_BOUNCE_MOST=.3,LAND_TIME=.42,LAND_ROLL=.55;
/** The dream loop: how far a flung body's arms and legs flail (radians) and how fast (Hz) - Fighter.flail. Under five
 *  degrees a frame at sixty frames a second: a flung body's limbs windmill, where ours were held spread. */
const LAUNCH_FLAIL={arms:.32,legs:.2,rate:2.2} as const;
/** Ground hits (8 October 2026): a blow on a body lying on the floor (ImpactDetail.downed) bounces it there - the
 *  landing's own bounce, as if it had met the floor at FLOOR_BOUNCE_SPEED m/s and FLOOR_BOUNCE_PER more for each point
 *  of damage (FLOOR_BOUNCE_MOST at most: 5 to 11 cm), rolled FLOOR_BOUNCE_ROLL of the landing's roll along the blow -
 *  and flinches at FLOOR_FLINCH of a standing body's (HIT_REACT): bent as far, the spine of a body lying flat folds
 *  through the floor. */
const FLOOR_BOUNCE_SPEED=1.8,FLOOR_BOUNCE_PER=.04,FLOOR_BOUNCE_MOST=4,FLOOR_BOUNCE_ROLL=.5,FLOOR_FLINCH=.4;
/** Stagger steps. A standing body a blow slides back - a light's finisher, a
 *  rush stage, a special short of a launch - glided over the floor on both
 *  feet, because the reaction clips are recoils on the spot and the foot
 *  planter lets go of a body being hit. Faster than SKID_SPEED it still
 *  skids on them - a body blasted back at seven metres a second does, and
 *  no step is that long - and as the blow's push dies below that, it
 *  staggers: each foot is held where it last landed until the body has
 *  carried the clip's own foot STEP_REACH past it, then swings over
 *  STEP_TIME, lifted STEP_LIFT at the top, to where the clip has that foot
 *  STEP_LEAD seconds of travel on - one foot at a time, the one left furthest
 *  behind first, the way a body caught off balance backs away. Under
 *  STEP_SPEED it stops stepping; taken up over STEP_IN (from the clip's own
 *  feet, so there is nothing to jump), let go over STEP_FADE. Travel is the
 *  root's own, frame to frame: the body's velocity is smoothed seventy
 *  milliseconds behind a blow, which is the whole of a light's slide. */
const STEP_SPEED=.9,SKID_SPEED=3.5,STEP_REACH=.15,STEP_TIME=.15,STEP_LIFT=.07,STEP_LEAD=.06,STEP_IN=.04,STEP_FADE=.12;
/** When the push is spent, a foot left more than STEP_SETTLE from where the
 *  clip has it steps home - at most STEP_GATHER such steps - and only then
 *  is the stagger let go: letting go of a foot held a stride away slid it
 *  home over the floor. */
const STEP_SETTLE=.05,STEP_GATHER=2;
/** The reactions a body takes on its feet and can be stepped through. */
const STEPPING_REACTIONS=new Set<string>(['hurt','flinch','stun']);
/** How a blow is scaled: a rush stage is one, the finisher staggers, and a
 *  blow the guard took shoves the guard rather than the head. */
const HIT_SCALE={finisher:1.8,heavy:1.4,big:1.5,guarded:.35};
/** Contact: the fist, the foot or the blade stops at the body it lands on,
 *  and the body answers it on the frame it arrives.
 *
 *  Round 3b's blind critic: "fists sink into torsos and blades pass through
 *  bodies", and "victims barely flinch on light hits". Measured in the real
 *  game (scripts/capture_hitfeel.mjs), both were one fault. The simulation
 *  holds a string 0.9-1.3 m apart, centre to centre, with the striking surface
 *  meant to pass through the target (CONTACT_GAP) - and the struck body is
 *  drawn from the snapshot timeline, so its blow reached it about 117 ms
 *  (seven frames, on localhost; more across the internet) after the attacker's
 *  own predicted swing had landed and frozen in its hitstop. For those frames a
 *  fist sat 5-14 cm deep in a torso that had not noticed it, and the flinch
 *  came after the fist had gone.
 *
 *  So a blow is answered where it is drawn. Every frame, the striking surfaces
 *  of anyone swinging a melee move within CONTACT_REACH - the knuckles, the
 *  elbows, the knees, the feet and the length of a blade - are measured
 *  against this body's torso (a capsule from the hips to the neck,
 *  TORSO_RADIUS round, measured off each fighter's own skin by
 *  scripts/measure_torso_radius.mts) and its head, as the body would be drawn
 *  without the push. How deep the deepest one sits, plus CONTACT_MARGIN, is
 *  how far the body is pushed back along the line from the attacker - on the
 *  frame the surface arrives, up to PUSH_RISE metres a second (a fist's few
 *  centimetres at once; at half the rate a kick sweeping across a body in a
 *  frame outran the push, and a push short of clearing a limb already past
 *  the spine draws it deeper) - and let go at PUSH_FALL once nothing is inside it
 *  (faster while the body's own knockback carries it the same way, so the
 *  hand-back never reads as a step toward the attacker).
 *  A blow's own weight
 *  adds a small shove on top (PUSH_SELL, scaled like the reaction), so a jab
 *  that lands at the skin still moves the body.
 *
 *  The push is presentation: the group is drawn off its logical position by
 *  it, never further than PUSH_MOST (PUSH_MOST_ARMED for a blade, and
 *  PUSH_MOST_HOLD for blades held out through a body for a whole move - the
 *  Dust Sea Sundered's, where the whole blade pushes, not only its forte). The room an
 *  attacker's own swing is given (limitRootMotion) is measured against the
 *  body without it (`restCenter`), so the two cannot chase each other across
 *  the floor.
 *
 *  A blow the simulation landed on this body is answered where it is drawn:
 *  when one of the attacker's surfaces arrives at the skin (within
 *  TOUCH_REACH of it) inside that contact's window - TOUCH_BEFORE ahead of it
 *  to TOUCH_AFTER after - or, where none gets there (a jab whose fist stops
 *  short), once the contact has come due. That is a touch. The reaction layer
 *  answers it there and then, with the envelope `impact` would have started,
 *  and the event that confirms it only tops that envelope up rather than
 *  hitting the body a second time. A blow the guard took is pushed and not
 *  flinched; the event says what the guard did.
 *
 *  Round 3c (FEEDBACK). The second blind critic: "Gaunt' Butcher Cleave: the blade
 *  passes through the hard-locked Ouga at 2.7 m. You see a slash, a flash,
 *  an impact ring and dust, but there is no damage number, no HP change and
 *  no flinch." Round 3b took any surface arriving in a contact window for
 *  the blow, and a drawn swing is not the simulation's: a two-metre blade
 *  sweeps wider than the swing's reach, a kick passes a bystander, a body
 *  dodges, and each was answered - reaction, spark, dust, shove - as a blow
 *  nobody had landed. Now nothing is answered that the ledger
 *  (game/landedBlows.ts, LANDED) does not hold as landed on this body by that
 *  contact of that swing: the local fighter's blows from the local copy of
 *  the simulation, on the tick they land there (the tick its drawn swing
 *  reaches the contact); a remote fighter's from the server's snapshots,
 *  which arrive before the timeline draws the swing. Only a body a swing has
 *  landed on (or a chase is after) is pushed off its surfaces: a blade that
 *  missed a body passes it. A hit the local copy predicted and the server
 *  then resolved without landing is let go of (`withdraw`). */
const TORSO_RADIUS:Record<FighterId,number>={chohan:.18,aqrab:.24,tsubute:.15,yodaka:.17,'psyche':.16,'ovid':.22,hawser:.15,rotfalke:.25,bonsho:.15,murex:.22,kinu:.16,'madake':.17,akayuri:.14,hagure:.18,hisame:.15,svanhild:.15,mizuhiki:.15,'shibuichi':.22,'rakucho':.16,irbis:.16,shidare:.16,hinomoto:.17,amagoi:.17,'shakudo':.15,minase:.16,aquilo:.16,onigawara:.21,cardo:.21,kubiwa:.15,torsion:.12,highsun:.22,lanthorn:.15,ume:.15,hikui:.15,tokan:.18,strappado:.20,unari:.17,barrow:.32,sashigane:.17,gosu:.17,kusushi:.16,hakushi:.18,suzuran:.14,wataame:.17,bruin:.17,senko:.17,buna:.2,oyashio:.32,adad:.17,'full-beam':.23,pyroclast:.16,ampere:.15,akaito:0.16,shijima:0.13,tempo:.17,tancho:.17,bellows:.25,mikage:.155,shanxiao:.24,kuzu:.16,shakugo:.25,'basilissa':.16,sorayomi:.155,strix:.19,kenzo:.178,koko:.159,nigo:.136,shirokane:.17,shiden:.154,kosho:.135,ouga:.152,taisei:.142,
  gummy:.133,konta:.173,kagari:.136,ward:.164,kuon:.146,oro:.159,gaunt:.188,setsu:.136,
  // The shop's fighters, by eye against Gaunt' .188 at their heights (Gorai's .215 at 2.08 m, scaled to his 3.2).
  gorai:.33,haldor:.205,sorrel:.145,dorado:.175,shiun:.15,magatsu:.15,vesper:.145,imago:.15,'wuming':.142,jirenga:.205,'jinlin':.13,'gohaku':.15,ippon:.145,sekka:.14,tobari:.14,akagane:.15,asahi:.13,levin:.13,'rook':.14,gaku:.12};
const HEAD_RADIUS=.12,HEAD_LIFT=.08,CONTACT_REACH=3.6,CONTACT_MARGIN=.015;
const PUSH_RISE=16,PUSH_FALL=.45,PUSH_MOST=.3,PUSH_MOST_ARMED=.5,PUSH_MOST_HOLD=1,PUSH_AFTER=.3;
const TOUCH_BEFORE=.12,TOUCH_AFTER=.2,TOUCH_MERGE=.4,TOUCH_REACH=.04;
/** A body a blow landed on stays that attacker's to push for PUSH_KEEP after
 *  it (a kick still in the body as the next stage takes over), and a blow
 *  withdrawn lets go of its reaction and its shove over WITHDRAW. Seconds. */
const PUSH_KEEP=.45,WITHDRAW=.1;
/** The shove a blow adds of its own, in metres per unit of its reaction
 *  scale (a rush stage lands at about 0.8, a finisher near 2), at most
 *  PUSH_SELL_MOST; up over SELL_RISE, then eased off over SELL_SETTLE. */
const PUSH_SELL=DREAM_IMPACT?.14:.055,PUSH_SELL_MOST=DREAM_IMPACT?.3:.13,SELL_RISE=.045,SELL_SETTLE=DREAM_IMPACT?.3:.16;
/** The dream loop (23 October 2026): the bigger, slower shove above is a heavy blow's. A string's own stages keep the
 *  shove they had (PUSH_SELL_STRING over SELL_SETTLE_STRING), the two blended by how heavy the blow is, and it is
 *  measured before the standing fold (DREAM_STAND) - with both, a jab shoved its body 18 cm and the J-J-K's second fist
 *  met the air 5.6 cm short of the skin (tests/murexChainContactRuntime). */
const PUSH_SELL_STRING=.055,SELL_SETTLE_STRING=.16;
/** The dream loop (22 October 2026): how much further a body on its feet folds under a blow (takeBlow); the shove above
 *  is two and a half times what it was and eases off slower - a victim slides back on every blow. */
const DREAM_STAND=1.55;
/** Actions a touch is not taken in: a dash evades, and a body already down
 *  for good has nothing to answer with. */
const UNTOUCHED=new Set<string>(['dash','defeated']);
/** A launch: the body jack-knifes over the blow - the hips go with it, the
 *  chest and the legs trail, the head whips - then tumbles back through the
 *  arc and lands on its back, which is where the downed clip picks it up.
 *  KoKo used to go up bolt upright, arms out, legs straight: the knockback
 *  clips stand the body upright for the first half second and then snap it
 *  flat in eight frames.
 *
 *  The tumble is not added to the clip, it steers it: the body's pitch is
 *  driven along one path, from wherever the clip had it at the blow to lying
 *  on its back (LAUNCH_LAND) at the landing, and the hips take whatever the
 *  clip's own pitch is short of it, so the clip's snap is absorbed rather
 *  than drawn. A launch off the floor goes over once on the way - a full turn
 *  more, which at the landing is no turn at all, so the downed clip takes a
 *  body already lying where it wants it. How far through the arc the body is
 *  comes from its rise: the fastest seen is the start, zero is the top, as
 *  fast coming down is the landing. */
const LAUNCH_RISE=.09,LAUNCH_SETTLE=.2,LAUNCH_LAND=Math.PI/2;
const LAUNCH_SIDE=.2,LAUNCH_DONE=.8,LAUNCH_HOLD=.12,LAUNCH_HAND=.18;
/** The roster-wide motion pass: a body off its feet - launched, down, getting up off the floor - is held over the floor
 *  it was thrown from, up only, as `supportTransition` holds a stance: lifted by however far its soles are through it,
 *  at most FLOOR_GUARD metres, at up to FLOOR_GUARD_RATE metres a second (let go at FLOOR_GUARD_LET_GO). It was left
 *  out as a reaction, and the downed and get-up clips of some rigs lie under their own floor: KoKo's soles 23 cm,
 *  Rook's and Gaku's 15-16 cm (their hips at it), Dorado's get-up 20 cm; and a knockback clip that ends lying at
 *  its own datum hung its legs through the tile for the last frames of the fall. Not under a floor lower than the one
 *  it left (a ledge): the body's own height is never under that floor's. */
const FLOOR_GUARD=.35,FLOOR_GUARD_RATE=8,FLOOR_GUARD_LET_GO=1.2;
/** Round 98: for the first `within` seconds of a launch the floor guard takes the body up at `rate` metres a second. */
const FLOOR_GUARD_FRESH={within:.15,rate:1.5} as const;
/** Round 3e (REACT): a re-launch (see `launchCarry`) lets go of the launch it
 *  cut short: its jack-knife and trailing limbs decay over LAUNCH_LET_GO (a
 *  time constant) while the new one's rise, and a corkscrew it caught part
 *  way unwinds over LAUNCH_UNWIND. */
const LAUNCH_LET_GO=.12,LAUNCH_UNWIND=.3;
/** Round 3e (REACT): how fast the launch's progress catches up with the fall
 *  once the descent is seen (a time constant, see `hitReact`). */
const LAUNCH_CATCH=.12;
/** Round 3e (REACT): how long before a launch is first drawn its blow may
 *  have started the launch layer and still be this launch's: the blow is
 *  answered on its event, a display delay and a snapshot ahead of the body
 *  it throws. An older start belongs to an earlier launch. */
const LAUNCH_STALE=.5;
/** The rise a launch is assumed to have until the body's own is measured:
 *  a finisher's 7.5 m/s, a little under. */
const LAUNCH_RISE_GUESS=6.5;
const LAUNCH={hips:.35,fold:.95,head:.5,arms:.7,legs:.6,knees:.8,trail:.35};
/** How long one step of each locomotion clip takes, and how fast that clip
 *  carries the fighter, measured by scripts/measure_locomotion.py. Not one
 *  clip in the roster is a real locomotion cycle - the planted foot slides
 *  backwards under the hips at between a seventh and a half of the travel
 *  speed - so these are used to set the cadence, and `footPlanting` makes the
 *  contact itself. */
type Cadence={step:number;speed:number;steps:number;duration:number;phase?:number};
const CADENCE=locomotion as Partial<Record<string,Partial<Record<'run'|'walk'|'dash',Cadence>>>>;
const clean=clipKey;
/** The clip tables the engine's fighter check reads (src/engine/client/fighterCheck.ts), as the game reads them. */
export { VICTORY, VICTORY_ENTRY, FORM_NAMED_RUSH, SPIRIT_COMMAND, SLOT_CLIP_BEFORE, ULTIMATE_CLIPS, OWN_BODY_ULTIMATE, AWAKEN_TAKE, AWAKEN_FORM_TAKE };
/** Geometry a fighter is carrying rather than standing in. Height normalisation
 *  asks how tall the fighter is; a katana worn over the shoulder and a fanned
 *  RAKSHASA blade both reach well above the head, and counting them shrinks the
 *  whole body to fit. Kenzo measured 2.35 m that way and shipped two thirds the
 *  height of everyone else. These still render - they are only not him. Nor
 *  are Shiun's wings, which rise a third of a metre over his head. */
const CARRIED=/weapon|equipment-held|^awaken-on|wings/i;
const HELD=/weapon.*hand|equipment-held/i;
/** Parts of a fighter that are supposed to be black. */
const FEATURE=/face|eye|hair|weapon|equipment/i;
const SHADOW_LIFT:Partial<Record<FighterId,number>>={kenzo:.05,gummy:.05};
/** Scale the albedo so its brightest channel clears the floor. Scaling rather
 *  than adding keeps the hue and the saturation exactly as painted - adding a
 *  grey would turn dark green into grey - and a channel already at 1 is
 *  untouched, so only the crushed end of the range moves. */
const FLOOR_PATCH=(lift:number)=>`
  float peak=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b);
  diffuseColor.rgb*=peak>1e-4?(${lift.toFixed(4)}+(1.0-${lift.toFixed(4)})*peak)/peak:1.0;`;
/** Being hit, in any of its forms. Foot planting and gaze tracking are for a
 *  fighter who is in control of their own body. */
const REACTION_ACTIONS=new Set<string>(['hurt','flinch','launched','knockdown','getup','stun','splat']);
/** A body taking a blow on its feet, whose feet the reaction layer holds
 *  while the hips go back (see HIP_SHOVE). */
const STANDING_REACTIONS=new Set<string>(['hurt','flinch','stun','guard']);
/** Standing on your own two feet, with both of them down. Only these may be
 *  pushed DOWN onto the floor: a leap is meant to leave it, and so is the
 *  flight phase of a run, which is why locomotion is not in the set even
 *  though it is as grounded an action as there is. */
const STANCE_ACTIONS=new Set<string>(['idle','guard']);

// Ward's Block is a whole-body pose like Kosho's: blocking and walking measured
// the planted foot sliding at 98% of travel without the stride.
const GUARD_STRIDE=new Set<FighterId>(['koko','kosho','gummy','ward','kagari']);
/** A touchdown softer than this is a step off a kerb and has nothing to
 *  absorb; above it, the knees give 2.6 cm per metre a second, to a limit.
 *  A jump lands at 8.8 m/s, which is the whole 15 cm. */
const LAND_FLOOR=3,LAND_PER_SPEED=.026,LAND_RANGE:[number,number]=[.03,.15];
/** How long the landing beat takes: down to the bottom, then back up. */
const LAND_FALL=.06,LAND_RISE=.3;
/** A hurt that holds its victim this long or longer is a body rocked (see
 *  `reaction`): the recoil at its own rate for up to ROCKED_REEL seconds,
 *  then the daze. */
const ROCKED_HURT=.85,ROCKED_REEL=.45;
/** How a stagger is read off its clip: snap to the recoil, hold the peak for a
 *  beat, then run at the rate it was drawn at. */
const REACTION_SNAP=.03,REACTION_HOLD=.055,REACTION_PEAK=.2;
// (Round 87: at the take's own share of the fold, .3 at the least - a snap-back of a body still curled over the last blow
// throws the head back, its arch fought by the curl: tests/dreamHurts. Round 91: at the take's own share of the curl -
// TAKE_SHAPE's `hunch`, the fold's alone. A body without the takes: all of it.)
const STUN_HOLD={rate:.15,release:.8,hunch:.42,after:.06,inRate:9,outRate:12} as const;
/** Round 3e (REACT): how much earlier than the reaction the server reports a
 *  blow may have landed on this body and still be the blow it answers: a
 *  touch (see TORSO_RADIUS) answers a local swing a round trip and the
 *  display delay before the victim's own reaction arrives. */
const REACTION_LEAD=.35;
/** Where a knockback clip's airborne half sits, and how long one pass over it
 *  takes in clip lengths. Run back and forth once the clip itself is spent, so
 *  a long flight is a body still turning rather than a frozen pose. */
const AIR_LOOP:[number,number,number]=[.45,.95,1.6];
/** A knockback clip that is a whole flight - thrown, flown back-down, come down on the floor - laid over the launch:
 *  played as drawn up to its first share (the throw), and from there to its second (the body arriving on the floor)
 *  over whatever flight is left, so it meets the floor as the body does. Taisei's (8 October 2026): played as drawn, his
 *  `ultimate-knockback-air` lay him curled on the floor 0.54 s into a 1.0-1.25 s flight, and the somersault that took
 *  over was run backwards to its take-off - he hung upright in the air, feet down, and was then slapped flat by the
 *  knockdown. */
const FLIGHT_SPREAD:Partial<Record<FighterId,readonly [number,number]>>={taisei:[.3,.78]};
const LAUNCH_NO_TURN:ReadonlySet<FighterId>=new Set<FighterId>(['hinomoto']);
/** The most a spread flight's clip runs ahead of its own pace: a low launch (Black Pyre's crumple) has a flight of a
 *  few frames, and spread over that the clip jumped half its length in one. */
const FLIGHT_RATE=2;
const STANDING_RISE=new Set<FighterId>(Object.keys(FIGHTERS) as FighterId[]);
/** A transformation take of a fighter's own, played ahead of the clips AWAKENINGS lists (src/game/awakening.ts, which
 *  the simulation ships). 8 October 2026: Shiden's list names Ikazuchi Arrow, and the entry swept its 4.5 s over 0.9 -
 *  the sword, the bow and the release at five times their pace; his own is the red eye gathered at his eye and the
 *  Guardian burst out of him on the swap. Shirokane's names the Sickle Bolt, a crackling thrust into the air; his own is
 *  his forehead protector pushed up off his left eye on the swap. Each is the entry's length (their -fanim1.glb).
 *  9 October 2026: Setsu's list names his guard (`_Idle`), swept 4 s over 0.9 - his palms held up at nothing at four
 *  times their pace; his own is SETSUNA: the lightning gathered in his hands, thrown off him on the swap, and down into
 *  the crouch he moves from (setsu-fanim5.glb).
 *  9 October: Ippon's list names `awaken-serious`, the clip his heavy plays - which is now the Dust Allergy - so his
 *  own is the glove pulled tight at the wrist, then the stance on the swap (ippon-fanim3.glb). */
const AWAKEN_TAKE:Partial<Record<FighterId,string>>={shiden:'Shiden awaken',shirokane:'Shirokane awaken',setsu:'Setsu awaken',gaunt:'Gaunt awaken',
  koko:'KoKo awaken',
  nigo:'Nigo awaken',
  // LORD ORO's names MIDNIGHT, swept as KoKo's was; his own is KYAHAAA! on the burst as HUSH rises (oro-fanim5.glb).
  oro:'LORD ORO awaken',
  ippon:'Ippon awaken'};
/** The same for a form body that takes over on the swap and plays on to the entry's end (Gaunt' 'HOUND ARMOR': his own
 *  skeleton, so it plays his take - gaunt-fanim3.glb is in both lists). Its row was the ultimate too: Hound Rampage's
 *  6.75 s of swings at seven times their pace. */
const AWAKEN_FORM_TAKE:Partial<Record<FighterId,string>>={hawser:'YUGE Emergence',ampere:'Vigilante Resolve',shanxiao:'Unbound Fury',gaunt:'Gaunt awaken'};
/** A take of a fighter's own (AWAKEN_TAKE) drawn for the default swap (AWAKENING_SWAP), played for a fighter whose swap
 *  is elsewhere (awakeningSwapAt): its drive into the burst - this many seconds of it, ending on the swap it was drawn
 *  for - lands on theirs as drawn, and what leads up to the drive is stretched to fill the entry up to it
 *  (awakenTakeTime). 9 October 2026: Nigo's swap is on the "KAI" of his "BAN... KAI!" (unsealedTiming.ts), 0.74 s in;
 *  his take swings HAIZAN off his shoulder into his Unsealed stance by 0.24 s and drives it out on 0.34
 *  (scripts/jj/author_nigo.py), then draws it back from 0.5. Played as drawn, the burst broke on him half way back to
 *  his idle. Now he comes round into the stance through "BAN..." and drives it out on "KAI". */
const AWAKEN_TAKE_DRIVE:Partial<Record<FighterId,number>>={nigo:.1};
/** Seconds into such a take (AWAKEN_TAKE_DRIVE) at `t` seconds of the entry, for a swap at `swap`. */
function awakenTakeTime(t:number,swap:number,drive:number){
  const from=AWAKENING_SWAP-drive,at=swap-drive;
  return t>=at?t-at+from:t*from/Math.max(1e-3,at);
}
/** The dip at which the knees are taking the whole of it. Below this the hold
 *  is ramping in or out with the dip, which is how it needs no datum of its
 *  own: the foot is put back exactly where the dip moved it from. */
const LAND_HOLD=.012;
const PLANT_BAND=.45,RELEASE_BAND=1.4;
/** How fast the correction fades in when a foot lands and out when it leaves.
 *  Landing is quick - that is the moment the weight arrives - and leaving is
 *  slower, so the last of the plant is let go rather than dropped. */
const PLANT_IN=42,PLANT_OUT=16,PLANT_OUT_STRIKE=60;
/** Above a run there is nothing to plant: a dash or an attack lunge covers
 *  more ground in two frames than a leg is long. */
const PLANT_LIMIT:[number,number]=[8.5,13];
/** Below this a foot is being placed rather than landing, and a step that
 *  close behind the last one on the same foot is the plant detector
 *  chattering rather than a stride. */
const STEP_AUDIBLE=1.4,STEP_GAP=.18;
/** Stop holding a foot once the leg is this far out. Beyond it the knee locks
 *  and the hip is dragged out of the pose, which is worse than the slide. */
const LEG_REACH=.97;
/** The stride the cadence is scaled to reach, as a multiple of leg length, and
 *  the range the clip may be retimed inside to reach it. A clip played much
 *  outside this stops reading as the gait it was drawn as.
 *
 *  A running stride is longer than a leg: at nine tenths of one, a sprint came
 *  out at nine and a half footfalls a second - a machine gun - and the planted
 *  foot had to be let go almost as soon as it landed. At 1.35 the measured
 *  skate is lower too, because a longer plant is a plant that survives. */
const TARGET_STRIDE=1.35,CADENCE_RANGE:[number,number]=[.7,2.2];
/** A run clip whose step carries the planted foot further than TARGET_STRIDE asks of the legs it is on. Taisei's (his
 *  clips retargeted onto Kari's body, 2 October) sweeps it 4.18 m/s at rate 1 against the 3.52 his 0.87 m legs are
 *  played to, and skated at 55% of his travel; played to his own stride it holds. */
// Taisei 1.27 since his new body (10 October): his shorter legs would otherwise quicken the run past the arms' 30-degree-a-frame swing (tests/runTakes.test.ts); the planted foot still slides less than on kr1 at 1.19.
// Kuzu 1.15: his clean run (the library's sprint, on its three-steps-a-cycle row) slid its planted foot 0.39-0.46 of travel
// at 7.5 m/s (30-144 frames a second); at his own stride, 1.15 times the roster's, 0.36-0.37 at every rate, and 0.19-0.24
// where the walk mixes in at 4.5 m/s (0.19-0.28 at the roster's), 3.8 steps a second. The cadence row's other steps and the
// library's jog measured worse.
const STRIDE_SCALE:Partial<Record<FighterId,number>>={taisei:1.27,kuzu:1.15};
/** Where the gait is all walk and where it is all run, in metres a second.
 *  Between them it is a mix of the two read from one stride clock. */
const GAIT_RANGE:[number,number]=[1.6,6];
/** originals fork (fixes-hawser-fox, 8 November 2026): the transformations whose gait is read at the speed the world sees.
 *  A form's own update is handed its speed in its own units (`carriedVelocity`: the parent's over the form's scale, so the
 *  stride clock matches its legs), while GAIT_RANGE, the walk's two thresholds and the two-footfalls-a-second floor are a
 *  man's. HOMURA, Konta's fox drawn 2.8 times over, read its 8.6 m/s run as 3.1 and would have walked through it, and the
 *  floor stepped it faster than it travelled below 4.3 m/s. For these the thresholds take the world's speed and the floor
 *  is divided by the scale. (Every other form is as it was; most are drawn within a quarter of their own size.) */
const WORLD_GAIT_FORMS:ReadonlySet<FighterId>=new Set(['konta']);
/** How much of the recent past the travel speed is read over.
 *
 *  Differentiating a 60 Hz snapshot position against a render frame is not a
 *  velocity: on a 144 Hz display two frames in three see no movement at all
 *  and the third sees two and a half times too much, so the legs strobe. The
 *  window is kept on the source's own clock - one sample per position change,
 *  carrying the time since the previous change. What is left is only the
 *  render frame a change is noticed on being up to one frame late, which over
 *  a window this long measured at worst 7% out across 30, 60, 90 and 144 Hz
 *  against the 33% a single-frame difference gave. Seventy milliseconds is
 *  four snapshots: steady, and short enough not to read a start late. */
const VELOCITY_WINDOW=.07;
/** One leg, with the two rest lengths the IK solves against and the live state
 *  of whatever it is currently standing on. */
type Leg={hip:THREE.Bone;knee:THREE.Bone;ankle:THREE.Bone;upper:number;lower:number;
  planted:boolean;anchor:THREE.Vector3;plantYaw:number;weight:number;low:number;high:number;stepped:number;
  soles:{mesh:THREE.SkinnedMesh;index:number}[]};
/** One animated node's three poses: what the clip sampled this frame, what the
 *  transition is coming from, and what was actually blended out of the two.
 *  The blended one is kept because it is the last state of the animation
 *  system alone - before the lean, the landing dip, the foot planting and the
 *  gaze have written into the same bones. A transition that captures the pose
 *  after all of those has captured them, and they are then applied a second
 *  time on top of the blend. */
type PoseNode={node:THREE.Object3D;samplePosition:THREE.Vector3;sampleRotation:THREE.Quaternion;sampleScale:THREE.Vector3;fromPosition:THREE.Vector3;fromRotation:THREE.Quaternion;fromScale:THREE.Vector3;blendPosition:THREE.Vector3;blendRotation:THREE.Quaternion;blendScale:THREE.Vector3;
  /** The animation-only pose one frame before `blend*`: the outgoing motion's
   *  velocity is read off the two, never off the procedural layers. */
  prevPosition:THREE.Vector3;prevRotation:THREE.Quaternion;
  /** That velocity at the start of a transition: radians a second as a
   *  rotation vector in the parent's frame, and metres a second. */
  sourceSpin:THREE.Vector3;sourceDrift:THREE.Vector3;
  /** Round 3d (PACE): the crossfade's target as last drawn, sign-continuous
   *  (see `crossfade`); all zero until the blend's first frame. */
  crossTarget:THREE.Quaternion};
/** What the combat event says about a blow beyond its direction and worth:
 *  the rush stage that landed it (the last is the finisher), the side it
 *  came from, and the reaction the server chose. All optional - a caller
 *  that has none of them still gets a reaction, read off the direction. */
export type ImpactDetail={chain?:number;fromBehind?:boolean;reaction?:ReactionKind;
  /** Round 3e (REACT, for VARIETY): the blow's outcome (moves.ts Outcome),
   *  where known - off the server's record of the blow (LANDED) when the
   *  caller does not say. */
  outcome?:Outcome;
  /** v70: a true launch's lift (CombatEvent.lift): the arc the body flies, ahead of which it is thrown (moves.ts
   *  LAUNCH_LEAD) - so the tumble is timed by it, not by the faster rise it is seen to make. */
  lift?:number;
  /** The feel pass: one of the big blows (game/bigBlow.ts) - the
   *  struck body snaps into its reaction on the frame it lands, freezes there
   *  shaking through the simulation's longer hold, and flashes in `tint`. */
  big?:boolean;
  /** The flash's colour for a big blow (sRGB hex): the thrower's element. */
  tint?:number;
  /** Ground hits (8 October 2026): the blow found the body down on the floor (the event's `downed`), and it takes it
   *  there - bounced on the floor, flinching less (see FLOOR_BOUNCE_SPEED). */
  downed?:boolean};
/** The feel pass: how long a big blow's flash lasts, how far the
 *  frozen body shakes along the blow (metres, alternating each 30 Hz step, as
 *  a held cel shakes), and how long the hold may outlive a hitstop the drawn
 *  state never showed. */
const BIG_FLASH=.24,BIG_SHAKE=.034,BIG_HOLD_MAX=.6;
const HIT_SHAKE=[.016,.04] as const,HIT_SHAKE_TIME=[.09,.16] as const;
/** Round 25: how long a struck body standing idle stays in its recoil after the server's hitstun (Fighter.reeling),
 *  and the rate its let-go plays on at meanwhile; the recoils it holds; and the red a struck victim flashes. */
const REEL_LINGER=.35,REEL_RATE=.35;
const REEL_ACTIONS=new Set<PlayerState['action']>(['hurt','flinch']);
const DREAM_FLASH_RED=new THREE.Color(1,.3,.24);
/** The dream loop, round 40: the struck body's flash - how long it lasts (s) for a big blow, a finisher and anything
 *  else, how strong it is (a big blow's, then the rest), and how fast it turns from the blow's white to red (its share of
 *  the flash x this). A body that went white for a tenth of a second at a third of full read, beside the burst's yellow,
 *  as "washed pale yellow-white" and vanished into it (the calibration critic, every heavy blow); the victim
 *  should be a flat red/pink hit-flash silhouette from the frame after the blow as it flies off. */
const DREAM_FLASH={big:.22,finisher:.18,light:.14,bigAmount:.6,amount:.32,redden:9,flat:.5,flatLight:.28} as const;
/** (23 October 2026) The shake starts one 30 Hz step after the blow - the contact frame itself shows the fist on the
 *  skin; started on it, its first step threw the body 1.6 cm off the fist (tests/madakeConsecutiveContact) - and only
 *  while the drawn state is held (its hitstop), as BIG_SHAKE: a body sliding back is not shaken across the floor. */
const HIT_SHAKE_DELAY=1/30;
/** The feel pass, iteration four: a big blow's freeze frame (Fighter.impactPose). Radians about the world
 *  axis square to the blow: the spine's three joints bent along it (or curled over it, for a body shot), the neck and
 *  head whipped after them, the upper arms flung back toward the thrower; eased in over IN (the snap's frame) and out over OUT once the hold lets go. */
const IMPACT_POSE={spine:[.14,.12,.12],neck:.16,head:.22,arm:.55,in:1/30,out:.14} as const;
// (A hurt's blow, not a flinch's - a barrage's ticks flinch the body a dozen times a second - and less of it on a body
// taller than `tall` metres: the bend is an angle, and Gorai's 3.2 m put his head 7.5 cm through a frame.)
// (Held `hold` seconds past the freeze, the light blow's freeze being 45-60 ms: let go with it, the bend came and went
// between two 67 ms (15 fps) frames.)
const LIGHT_IMPACT={share:.5,in:.05,hold:.08,tall:1.85} as const;
/** The dream loop (23 October 2026): every blow on a standing body folds it further (DREAM_STAND), so a big blow's
 *  freeze frame bends it further again - still more than an ordinary blow throws it (tests/impactPose). */
const IMPACT_POSE_SCALE=DREAM_IMPACT?1.15:1;
/** Round 26: how much further a knockdown's freeze frame folds the body over and down (see `impactPose`). */
const KNOCK_BEND=1.45;
const _impactAxis=new THREE.Vector3(),_impactLocal=new THREE.Vector3(),_impactParent=new THREE.Quaternion(),_impactTurn=new THREE.Quaternion();
/** A big blow's limbs reach their reaction pose in one frame (the impact
 *  frame), where every other blow's take STRUCK_BLEND. */
const BIG_SNAP=1/60;
export type AnimStyle='twos'|'snap'|'classic';
/** The stepped pose's rate, in poses a second. */
const STEP_RATE=30;
/** The strike: the last ANIME_DRIVE seconds of a swing's drive into contact
 *  (at most ANIME_DRIVE_SHARE of its wind-up) are played in ANIME_SNAP, and
 *  the contact pose is then held ANIME_HOLD (light, heavy, big blow) before
 *  the follow-through catches up over the rest of its window. A window
 *  shorter than ANIME_MIN either side of its contact (a barrage's ticks) is
 *  played as it was. */
// (The dream loop, round 41: a big blow's contact pose is held two frames, not four, and a heavy's two, not three, under
// the dream switch: on top of the thrower's own freeze (the simulation's hitstop) the held pose stood Taisei still through
// three 67 ms close-up frames - "the attacker freezes instead of following through" (the
// calibration critic, every heavy blow), where the attacker should whip through while the victim flies.)
const ANIME_DRIVE=.13,ANIME_DRIVE_SHARE=.42,ANIME_SNAP=.034,ANIME_HOLD=DREAM_IMPACT?{light:.034,heavy:.034,big:.034}:{light:.034,heavy:.05,big:.067},ANIME_MIN=.1;
/** The smear frame (Fighter.updateSmear): from SMEAR_LEAD before a contact to SMEAR_TAIL after it, a strike point moving
 *  faster than SMEAR_SPEED m/s is smeared SMEAR_SECONDS of its motion back along its path, at most SMEAR_MOST metres,
 *  over SMEAR_REACH of the body round it (more for a blade). */
// The dream loop (22 October 2026): the striking limb smeared half as far again - bold smear frames.
const SMEAR_LEAD=.11,SMEAR_TAIL=DREAM_IMPACT?.05:.035,SMEAR_SPEED=3.5,SMEAR_SECONDS=DREAM_IMPACT?.068:.045,SMEAR_MOST=DREAM_IMPACT?1.05:.8,SMEAR_REACH=.62,SMEAR_REACH_ARMED=1.1;
/** A kicking leg's smear (the dream loop, round 29): drawn as far back as a fist's, a whole trouser leg and its boot
 *  were stretched into a flat sheet a metre long on the frame before a kick landed (Taisei's body kick). A leg is a
 *  thick limb: smeared a short way, over less of it. */
const SMEAR_MOST_FOOT=DREAM_IMPACT?.4:SMEAR_MOST,SMEAR_REACH_FOOT=DREAM_IMPACT?.45:SMEAR_REACH;
/** A limb's speed is its own swing: measured against the body (the fighter's group), so a lunge or a blink carrying the
 *  whole body is not a swing, and a foot is only a striking foot once it is off the floor (SMEAR_FOOT_LIFT above the
 *  body's base). Measured on the world, Taisei's Rock lunged at 5-6 m/s and a foot stepping in under it was the fastest
 *  limb: his legs and trousers were smeared 0.67 m back into a sheet for three frames of every jab (8 October 2026). */
const SMEAR_FOOT_LIFT=.25;
const SMEAR_LIMBS=['RightArm','LeftArm','RightUpLeg','LeftUpLeg'] as const;
const heldHand=(name:string)=>{if(!HELD.test(name))return -1;const side=name.replace(/hand/gi,'');return /(^|[^a-z])(r|right)([^a-z]|$)/i.test(side)?0:/(^|[^a-z])(l|left)([^a-z]|$)/i.test(side)?1:-1;};
const _smearVel=new THREE.Vector3(),_smearRoot=new THREE.Vector3(),_smearCarry=new THREE.Vector3(),_smearSocket=new THREE.Vector3();
/** A blow that reached a body where it is drawn, ahead of its event (see
 *  TORSO_RADIUS): who threw it, which of their swings (its input edge) and
 *  which contact, when, the reaction-ring slot it was answered in, whether an
 *  event has confirmed it, and the level heading it travelled. `withdrawn`:
 *  the server resolved it without landing (see LANDED), and the body let go. */
type Touch={from:Fighter;seq:number;index:number;at:number;slot:AttackSlot;ring:number;claimed:boolean;hx:number;hz:number;withdrawn?:boolean};
/** A touch, for the effects that mark a blow on the frame it lands rather
 *  than when its event arrives (CombatEffects). `serial` only grows; `seq`
 *  and `index` are the swing's input edge and the contact, which its event
 *  carries too. */
export type TouchMark={serial:number;victim:string;attacker:string;fighter:FighterId;slot:AttackSlot;chain:number;damage:number;
  x:number;y:number;z:number;hx:number;hz:number;guarded:boolean;seq?:number;index?:number};
/** The kinds of transition, for `Fighter.transitions`. */
export type TransitionKind='attack'|'motion'|'reaction'|'struck'|'loop';
/** The fastest a joint's motion is carried across a transition, in radians a
 *  second: fifteen degrees a frame at sixty. Real limbs in these clips peak
 *  around there; what reads faster is a clip's own discontinuity - Shiden's
 *  Habakiri Cut turns his left hand 123 degrees in one frame at 0.55 s - and
 *  carrying a flip's "velocity" into the next clip replays the flip as a
 *  swing (measured: a 35 degree seam became 140). Positions likewise, in
 *  metres a second. */
const SPIN_CARRY=THREE.MathUtils.degToRad(15)*60,DRIFT_CARRY=6;
/** A joint that turned further than this in the outgoing pose's last frame
 *  was not moving, it was flipping - a clip's own discontinuity - and carries
 *  nothing. Measured on Shiden's rush, carrying even the clamped remainder of
 *  his Habakiri Cut's 123 degree hand flip into the next stage added 3.4
 *  degrees to a seam the flip already owned. */
const FLIP_STEP=THREE.MathUtils.degToRad(45);


const _spin=new THREE.Quaternion(),_spinInverse=new THREE.Quaternion(),_turn=new THREE.Vector3();
/** The rotation vector - axis times angle, in radians - of a unit quaternion,
 *  the short way round. */
function rotationVector(q:THREE.Quaternion,out:THREE.Vector3){
  let x=q.x,y=q.y,z=q.z,w=q.w;
  if(w<0){x=-x;y=-y;z=-z;w=-w;}
  const s=Math.sqrt(x*x+y*y+z*z);
  if(s<1e-9)return out.set(2*x,2*y,2*z);
  return out.set(x,y,z).multiplyScalar(2*Math.atan2(s,w)/s);
}
/** The unit quaternion a rotation vector describes. */
function fromRotationVector(v:THREE.Vector3,out:THREE.Quaternion){
  const angle=v.length();
  if(angle<1e-9)return out.set(v.x*.5,v.y*.5,v.z*.5,1).normalize();
  const s=Math.sin(angle*.5)/angle;
  return out.set(v.x*s,v.y*s,v.z*s,Math.cos(angle*.5));
}
// Four linear irradiance bands retain the source-painted color and modelled form.
// The darkest band used to be 77 - 30% of the lit value - and that is what put
// the whole shaded side of a garment into the floor: at 30% a mid-red cardigan
// panel lands on sRGB 43, which reads as black rather than as red in shadow.
// At 110 the shading still separates the planes and the colour survives it.
const toonGradient=new THREE.DataTexture(new Uint8Array([110,155,203,255]),4,1,THREE.RedFormat);
toonGradient.minFilter=toonGradient.magFilter=THREE.NearestFilter;
toonGradient.generateMipmaps=false;toonGradient.colorSpace=THREE.NoColorSpace;toonGradient.needsUpdate=true;
/** Clips from an animation-only file, kept to the tracks that bind by name to
 *  `scene` - the fighter's own body - so the mixer never binds a track to
 *  nothing (three.js warns on every such binding) and a clip with nothing
 *  left to move is dropped rather than played as a frozen pose. A root
 *  translation two orders of magnitude off the body's own is a file exported
 *  in other units; its translations are dropped and its rotations kept,
 *  because a body flung a hundred metres is worse than a clip without travel. */
export function bindClips(scene:THREE.Object3D,clips:THREE.AnimationClip[],label=''){
  const names:string[]=[];scene.traverse(o=>{if((o as THREE.Bone).isBone)names.push(o.name);});
  const hips=resolveSkeleton(names).get('Hips');
  const rest=hips?scene.getObjectByName(hips)?.position.length()??0:0;
  const out:THREE.AnimationClip[]=[];
  for(const clip of clips){
    let units=true;
    const tracks=clip.tracks.filter(track=>{
      const parsed=THREE.PropertyBinding.parseTrackName(track.name);
      if(!['position','quaternion','scale'].includes(parsed.propertyName))return false;
      if(!THREE.PropertyBinding.findNode(scene,parsed.nodeName))return false;
      if(parsed.propertyName==='position'&&parsed.nodeName===hips&&rest>1e-4){
        const length=Math.hypot(track.values[0],track.values[1],track.values[2]);
        // A hips held at its parent's origin says nothing about units: a
        // Biped export carries the body on the root above them (Nigo).
        if(length>rest*100||length<rest/100&&length>1e-6)units=false;
      }
      return true;
    });
    const kept=units?tracks:tracks.filter(track=>!track.name.endsWith('.position'));
    if(!units)console.warn(`${label}: ${clip.name} carries its root in other units; its translations were dropped`);
    if(!kept.length){console.warn(`${label}: ${clip.name} binds to nothing on the body and was skipped`);continue;}
    out.push(new THREE.AnimationClip(clip.name,clip.duration,kept));
  }
  return out;
}
/** Round 3e (REACT): the reaction clips a rig borrowed from another, held to
 *  this rig's bone lengths.
 *
 *  The third blind critic: "That clip comes from another rig." Measured on
 *  every rig (scripts/audit_reaction_clips.mts), the retargeted slams, shakes,
 *  stuns and get-ups keep the body's proportions, and the hit recoil that
 *  Taisei, Ouga, Shirokane and KoKo play (`adapted_hit`, `Hit 01`) does not:
 *  it carries the translations of the rig it was made on, which pull the right
 *  hand 39-61% into the forearm, the forearms 17-23% and the head 11% out of
 *  true through the back half of the recoil. On a rig whose own idle, run and
 *  dash never change the length of a joint below the hips, a reaction clip's
 *  translations of those joints are held at this rig's own - the motion is in
 *  the rotations, which are untouched. The rigs that stretch
 *  themselves as they move (Gummy, Kenzo, Kagari) are left as drawn. */
const REACTION_CLIP=/hit 01|adapted_hit|slammed|shake|stun|electric_shock|down_end|down_lp|blownback|knockback-air|ground-impact|abdomen-fold|beam-pressure|die fall|jump spin|jump_spin/i;
const OWN_MOTION=/^(_idle|idle|00-idle|taisei-ready|02-stance|stance|run|adapted_run|dash|adapted_dash)$/i;
/** How far a joint's length may move before a clip counts as changing it. */
const RIGID_STRETCH=.03;
const rigidClips=new WeakMap<THREE.AnimationClip,THREE.AnimationClip>();
function rigidReactions(clips:THREE.AnimationClip[],joints:Map<string,THREE.Bone>):THREE.AnimationClip[]{
  const rest=new Map<string,THREE.Vector3>();
  for(const [name,bone] of joints)if(name!=='Hips'&&bone.position.length()>.02)rest.set(bone.name,bone.position);
  const limb=(track:THREE.KeyframeTrack)=>track.name.endsWith('.position')?rest.get(THREE.PropertyBinding.parseTrackName(track.name).nodeName):undefined;
  const stretches=(clip:THREE.AnimationClip)=>clip.tracks.some(track=>{
    const at=limb(track);if(!at)return false;
    const length=at.length(),v=track.values;
    for(let i=0;i+2<v.length;i+=3)if(Math.abs(Math.hypot(v[i],v[i+1],v[i+2])/length-1)>RIGID_STRETCH)return true;
    return false;
  });
  if(clips.some(clip=>OWN_MOTION.test(clip.name)&&stretches(clip)))return clips;
  let changed=false;
  const out=clips.map(clip=>{
    if(!REACTION_CLIP.test(clip.name))return clip;
    let rigid=rigidClips.get(clip);
    if(!rigid){
      rigid=stretches(clip)?new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.map(track=>{
        const at=limb(track);
        return at?new THREE.VectorKeyframeTrack(track.name,[0],[at.x,at.y,at.z]):track;
      })):clip;
      rigidClips.set(clip,rigid);
    }
    if(rigid!==clip)changed=true;
    return rigid;
  });
  return changed?out:clips;
}
/** The state a body built only to be compiled or prepared stands in: far off, idle (FighterLibrary.warmup, prepare). */
const warmState=(fighter:FighterId):PlayerState=>({id:'warm-'+fighter,name:'Warmup',fighter,x:1000,y:0,z:1000,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:100,action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
export class FighterLibrary {
  private sources=new Map<FighterId,GLTF>();
  private warmFighters:Fighter[]=[];
  /** Awakened bodies, by the fighter they belong to. */
  private forms=new Map<FighterId,GLTF>();
  /** Each fighter's rush-stage clips from its animation-only GLB, already cut
   *  down to the tracks that bind to the body. Absent where a fighter has no
   *  such file or it failed to load. */
  private rush=new Map<FighterId,THREE.AnimationClip[]>();
  private loaded=new Set<FighterId>();
  private queue=new PriorityQueue<FighterId>(3);
  /** When each fighter was last asked for (release 38's eviction keeps the most recent). */
  private used=new Map<FighterId,number>();
  background(on:boolean){this.queue.setBackground(on);}
  has(id:FighterId){return this.loaded.has(id);}
  get loadedCount(){return this.loaded.size;}
  ensure(ids:readonly FighterId[],onProgress:(label:string)=>void=()=>{},priority=1){
    if(priority>0)for(const id of ids)this.used.set(id,performance.now());
    return Promise.all([...new Set(ids)].map(id=>this.queue.request(id,async()=>{
      const definition=FIGHTERS[id];
      onProgress(`Loading ${definition.name}`);
      // Independent fighters may download together. Within a fighter, keep
      // the original body → rush → extras/idle → form order and overrides:
      // every file is asked for at once and parsed in that order (loading/modelFiles.ts).
      const loader=aheadLoader(new GLTFLoader(),[this.sources.has(id)?undefined:definition.model,this.rush.has(id)?undefined:definition.rushModel,...(definition.extraModels??[]),IDLE_PROFILES[id]?.model,this.forms.has(id)?undefined:definition.formModel,...(definition.formExtraModels??[]),definition.openHandsModel]);
      let source=this.sources.get(id);
      if(!source){source=await loader.loadAsync(definition.model);this.sources.set(id,source);}
      if(definition.rushModel&&!this.rush.has(id)){
        try{this.rush.set(id,bindClips(source.scene,(await loader.loadAsync(definition.rushModel)).animations,definition.name));}
        catch(error){console.warn(`${definition.name}: rush clips unavailable; using the body's own clips`,error);}
      }
      for(const url of [...(definition.extraModels??[]),IDLE_PROFILES[id]?.model]){
        if(!url)continue;
        try{
          const clips=bindClips(source.scene,(await loader.loadAsync(url)).animations,definition.name);
          source.animations=joinClips(source.animations,clips);
        }catch(error){console.warn(`${definition.name}: extra clips unavailable (${url})`,error);}
      }
      releaseHeldJoints(id,source.animations);
      seedOriginalClocks(id,source.animations,seedMotionTable);
      if(definition.formModel&&!this.forms.has(id))this.forms.set(id,await loader.loadAsync(definition.formModel));
      // Round 5 (GUMMY): the form's own extra takes, and the open hands of body and form (see their FighterDefinition).
      await bindFormExtras(loader,definition,source,this.forms.get(id),bindClips);
      // Launch day 10 (perf4): everything this fighter loads is in; its clips' held channels - two thirds of all their tracks,
      // each with its own arrays - now share them (clipShare.ts: every key stays, so no pose, pacing or hand changes).
      {const pool=new ClipPool(),form=this.forms.get(id);shareClips(source.animations,pool);shareClips(this.rush.get(id),pool);if(form)shareClips(form.animations,pool);}
      // And the loader's parser each file came back with - its JSON, its caches and a second copy of the file's binary chunk,
      // 9 to 14 MB of heap and buffers a fighter (perf4 measured Konta at 14 of his 26 MB) - is let go: a body is drawn from
      // its scene, and the only readers of the file's JSON are Gummy's plain face and open palms (Fighter.ts, gummy/openHands.ts).
      if(id!=='gummy')for(const gltf of [source,this.forms.get(id)])if(gltf)(gltf as {parser?:unknown}).parser=undefined;
      this.loaded.add(id);onProgress(`Fighters ${this.loaded.size}/${Object.keys(FIGHTERS).length} ready`);
    },priority))).then(()=>{});
  }
  async load(onProgress:(label:string)=>void,preferred?:FighterId){
    if(preferred)await this.ensure([preferred],onProgress);
    await this.ensure(rosterPrefetch<FighterId>(shownFighters(RELEASED_FIGHTERS),preferred),onProgress,0);
  }
  releaseGpu(keep:ReadonlySet<FighterId>){
    const released:FighterId[]=[];
    for(const id of this.loaded){
      if(keep.has(id))continue;
      for(const root of [this.sources.get(id)?.scene,this.forms.get(id)?.scene])root?.traverse(o=>{
        const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
        mesh.geometry.dispose();
        for(const material of [mesh.material].flat())for(const value of Object.values(material))if((value as THREE.Texture|null)?.isTexture)(value as THREE.Texture).dispose();
      });
      released.push(id);
    }
    return released;
  }
  /** The bodies themselves past `most`, the longest unasked-for first (never one in `keep`): fetched again, from the
   *  browser's cache, when a room has them. Returns the ones let go. */
  evict(keep:ReadonlySet<FighterId>,most:number):FighterId[]{
    const spare=[...this.loaded].filter(id=>!keep.has(id)).sort((a,b)=>(this.used.get(a)??0)-(this.used.get(b)??0)),gone:FighterId[]=[];
    while(this.loaded.size>most&&spare.length){
      const id=spare.shift()!;
      // Its decoded images closed - one another body or the stage still draws only when that one lets go.
      for(const root of [this.sources.get(id)?.scene,this.forms.get(id)?.scene])if(root)releaseTextures(root);
      this.sources.delete(id);this.forms.delete(id);this.rush.delete(id);this.loaded.delete(id);this.queue.completed.delete(id);
      gone.push(id);
    }
    return gone;
  }
  warmup(scene:THREE.Scene,ids:readonly FighterId[]=[...this.loaded]){
    for(const fighter of ids){const f=this.create(warmState(fighter));this.warmFighters.push(f);scene.add(f.group);f.group.traverse(o=>o.visible=true);}
    return new Map(this.warmFighters.map(f=>[f.state.id,f]));
  }
  /** A loaded fighter's first build, ahead of the room's warm-up (main.ts, as each fighter's files arrive; the performance
   *  sweep, 24 October 2026): a body built and let go, so what a Fighter works out once a model - its clips' tables, its rush,
   *  its hair and cloth - is there when the warm-up builds it again (a pinned royale's twelve first builds were 1.1 s of its
   *  warm-up; the twelve built after them, 0.3 s). Returns its body's and form's scenes, for their images. */
  prepare(id:FighterId):THREE.Object3D[]{
    if(!this.loaded.has(id))return [];
    this.create(warmState(id)).dispose();
    return [this.sources.get(id)?.scene,this.forms.get(id)?.scene].filter((root):root is THREE.Group=>!!root);
  }
  /** The warm-up bodies are only there to have their programs linked. Hidden
   *  in the scene they still cost a matrix walk every frame - three thousand
   *  nodes, the most of any scene - so once compiled they leave it. */
  hideWarmup(){for(const f of this.warmFighters){f.group.visible=false;f.group.removeFromParent();}}
  disposeWarmup(){for(const f of this.warmFighters)f.dispose();this.warmFighters=[];}
  /** Outfits with a body of their own (the shop's: economy/outfits.ts), loaded the first time a player wears one. */
  private outfitBodies=new Map<string,{source:GLTF;rush?:THREE.AnimationClip[]}|'loading'|'failed'>();
  /** The outfit a player can be drawn in now: theirs, if it is one of their fighter's and its body is here (and its
   *  body asked for, if it is not: the player is drawn in the fighter's own until it comes). */
  outfitReady(outfit:string|undefined,fighter:FighterId):string|undefined{
    const def=outfitFor(outfit,fighter);
    if(!def||!outfit)return undefined;
    if(!def.model)return outfit;
    const body=this.outfitBodies.get(outfit);
    if(body===undefined){this.outfitBodies.set(outfit,'loading');void this.loadOutfit(outfit,def);return undefined;}
    return typeof body==='object'?outfit:undefined;
  }
  private async loadOutfit(id:string,def:OutfitDef){
    const loader=new GLTFLoader();
    try{
      const source=await loader.loadAsync(def.model!);
      let rush:THREE.AnimationClip[]|undefined;
      // Its own rush clips, where it ships them; else the rush is cut from its own clips (planRush).
      if(def.rush)try{rush=bindClips(source.scene,(await loader.loadAsync(def.rush)).animations,id);}catch(error){console.warn(`outfit ${id}: rush clips unavailable (${def.rush})`,error);}
      // Its fighter's combo enders' own takes (<id>-enders*.glb, comboClips.ts), bound by bone name as his own body's
      // are: a repaint is his rig, and a costume of the same game his skeleton. Where a body has none of their bones
      // nothing binds and its enders throw the slot's clips, as before.
      // (Round 4b: and their reworked takes, <id>-fanim*.glb - the repaints are their own bodies, repainted.)
      for(const url of FIGHTERS[def.fighter].extraModels??[]){
        // (Round 4b, FMOVES and FANIM: and the slots' own new takes, <id>-fmoves*.glb and <id>-fanim*.glb.)
        if(!/-(enders|fmoves|fanim)\d*\.glb$/.test(url))continue;
        try{const clips=bindClips(source.scene,(await loader.loadAsync(url)).animations,id),names=new Set(clips.map(c=>c.name));source.animations=[...source.animations.filter(c=>!names.has(c.name)),...clips];}
        catch(error){console.warn(`outfit ${id}: ender clips unavailable (${url})`,error);}
      }
      this.outfitBodies.set(id,{source,rush});
    }catch(error){console.warn(`outfit ${id}: its body did not load (${def.model}); the fighter's own is drawn`,error);this.outfitBodies.set(id,'failed');}
  }
  create(state:PlayerState,outfit?:string){
    const body=outfit?this.outfitBodies.get(outfit):undefined,own=typeof body==='object'?body:undefined;
    const source=own?.source??this.sources.get(state.fighter);
    if(!source)throw new Error(`${state.fighter} model is not loaded`);
    const fighter=new Fighter(state,source,false,own?own.rush:this.rush.get(state.fighter),outfit);
    // (Round 90: and any authored hurt it has none of fitted from another fighter's, once per rig - here, where a room's
    // bodies are made behind its loading screen, rather than on its first blow, or for every fighter the roster prefetch
    // loads in the background.)
    Fighter.borrowAhead?.(source.scene,source.animations,state.fighter);
    Fighter.strikesAhead?.(state.fighter);Fighter.stylesAhead?.();
    const form=this.forms.get(state.fighter);
    if(form)fighter.attachForm(form);
    // The rush plan - and the mirrored copy of the light it may need - is
    // built here, which for the roster is the loading screen's warm-up,
    // rather than on the first rush of a match.
    fighter.prepareRush();
    // Round 3b: the camera's occlusion dither, on every material it draws with.
    installOcclusionFade(fighter);
    return fighter;
  }
}

export class Fighter {
  /** The feel pass: how attacks are drawn (see AnimStyle); set from
   *  the settings by main.ts. 'classic' until then, so a body built in a test
   *  is drawn as it always was. */
  static animStyle:AnimStyle='classic';
  /** VOL.5, the move transplant (src/engine/client/transplant.ts): another fighter's move this body throws now, fitted to
   *  its rig - installed by that module; without it (or for the body's own moves) the body draws its own takes. */
  static transplant?:(body:Fighter,state:PlayerState)=>Transplanted|undefined;
  /** The dream loop, round 90 (src/engine/client/borrowedHurts.ts): one of the authored hurts (BORROWED_TAKES) for a body
   *  whose files carry none - another fighter's take fitted to the rig of `scene` (a body's source scene: its file's or
   *  its outfit's) - or nothing, and the body draws its own; and the same fitted ahead, as a body is made. Both
   *  installed by that module; without it every body draws its own, as before. */
  static borrowedHurt?:(scene:THREE.Object3D,clips:readonly THREE.AnimationClip[],key:string,fighter:FighterId)=>THREE.AnimationClip|undefined;
  static borrowAhead?:(scene:THREE.Object3D,clips:readonly THREE.AnimationClip[],fighter:FighterId)=>void;
  /** Lock combat's borrowed strikes (src/engine/client/borrowedStrikes.ts): a second-round take for a fighter with none to
   *  spare, another fighter's strike fitted to the body - undefined while it is coming, null for none - and the fetch of
   *  a fighter's donors ahead, as a body is made. Installed on the lock combat preview only. */
  static borrowedStrike?:(scene:THREE.Object3D,clips:readonly THREE.AnimationClip[],fighter:FighterId,stage:number)=>THREE.AnimationClip|null|undefined;
  static strikesAhead?:(fighter:FighterId)=>void;
  /** Techniques (game/techniques.ts): a style's take for a technique fitted to this body, and its blow's share
   *  (engine/client/styleMoves.ts); undefined while the takes are coming. Installed by main.ts. */
  static styleMove?:(scene:THREE.Object3D,clips:readonly THREE.AnimationClip[],fighter:FighterId,key:TechniqueKey)=>{clip:THREE.AnimationClip;contact:number}|null|undefined;
  static stylesAhead?:()=>void;
  /** Whether a technique's take carries its own legs in the air - a leap's, a kick's - so the air string's tuck
   *  (`airTuck`) leaves them be (engine/client/styleMoves.ts). */
  static styleLegs?:(fighter:FighterId,key:TechniqueKey)=>boolean;
  /** The borrowed takes this body has drawn, each given its pose nodes once (`ensurePoseNodes`). */
  private borrowedSeen?:WeakSet<THREE.AnimationClip>;
  private swap?:Transplanted;
  /** This body's rig - its file's scene, untouched - its clips, and the take it draws `state` with, as `update` would
   *  (Taisei's measured melee first): what the transplant fits another fighter's move from and onto. */
  take(state:PlayerState){return {scene:this.source.scene,clips:this.clips,clip:this.groundedMelee(state)?.clip??this.clipFor(state),form:this.awakenedForm};}
  /** The move `state`'s action is timed by on this body (its rush stage, ender, kit or slot), as `update` reads it: the
   *  ball modes' sports moves (render/ball/ballMoves.ts) land a take of their own on the simulation's contact by it. */
  movePlayed(state:PlayerState):MoveDefinition{return this.moveFor(state);}
  /** The 30 Hz pose grid every body steps on together (see AnimStyle 'twos'):
   *  set once a frame, before the bodies update, by `beginFrame`. */
  static stepTick=0;
  static beginFrame(nowMs:number){Fighter.stepTick=Math.floor(nowMs*STEP_RATE/1000);}
  /** The stepped pose (AnimStyle 'twos'): every bone of the body, and its
   *  local transform as of the last step it was drawn on. */
  private stepNodes?:THREE.Object3D[];private stepPose?:Float32Array;private stepAt=-1;private stepEpoch=-1;
  readonly group=new THREE.Group();
  readonly model:THREE.Object3D;
  readonly mixer:THREE.AnimationMixer;
  readonly bones=new Map<string,THREE.Bone>();
  readonly clips:THREE.AnimationClip[];
  readonly handR=new THREE.Vector3();
  readonly handL=new THREE.Vector3();
  state:PlayerState;
  private active?:THREE.AnimationAction;
  private awakenedForm?:Fighter;
  private carriedVelocity?:THREE.Vector3;
  private formReveal=0;
  private formEye={value:new THREE.Vector3(0,1000,0)};
  private formOpacity={value:1};
  private will={value:0};
  private laughFace?:THREE.Object3D;private plainFace?:THREE.Object3D;
  /** Round 5 (GUMMY): the open hands (gummy/openHands.ts) and the closed fists they stand in for, on this body: the
   *  Rogue Wave is thrown with the palms. */
  private openHands:THREE.Object3D[]=[];private fists:THREE.Object3D[]=[];
  /** Round 6 (GUMMY ULT): which side each of `openHands` (and `fists`) is. */
  private openSides:('L'|'R')[]=[];
  /** Round 5 (GUMMY): SUNRISE in the air (gummy/sunrise.ts SUNRISE_FLOAT): whether this body is the form that floats; and,
   *  on the fighter carrying it, how high it is drawn over its floor (eased, and as drawn this frame with the bob),
   *  when the fighter last landed, the float's own clock and its phase. */
  private floating=false;private formLift=0;private formLiftDrawn=0;private formLandedAt=-9;private formWasGrounded=true;private floatClock=0;private floatPhase=0;
  /** Round 5 (GUMMY): where the floating form's body is placed over its fighter's floor (metres): kept here, since a
   *  form's own update puts its body back at the state it is handed every frame. */
  private floatOffset=0;
  /** 0..1, eased. The transformation is a second long; the body should arrive
   *  with it rather than switch on between two frames. */
  private awaken={value:0};
  targetDistance=Infinity;
  /** World point the fighter should look at, set from the match snapshot. */
  targetPoint?:THREE.Vector3;
  /** Where the camera is, for the worn-form fade. A Guardian is nearly twice the
   *  fighter's height, so in a small stage the chase camera ends up inside it. */
  cameraPoint?:THREE.Vector3;
  private formMaterials:THREE.Material[]=[];
  /** When the shop's worn Guardian last rose round its fighter (the awakening's own action); see the fade below. */
  private risenAt=-9;
  /** The body a transformation swaps in: Full Swell, the NIGHTFALL, the
   *  fox-spirit. Carried as a child fighter with its own rig and clips. */
  attachForm(source:GLTF){
    const look=AWAKENINGS[this.state.fighter];
    // A worn shell (the Guardian) is its fighter's own rig and plays what he plays: his combo enders' own takes
    // (comboClips.ts, his extra files) are bound to it by bone name, or it would throw the slot's clip round a fighter
    // throwing the ender's.
    const worn=look.formTint!==undefined,names=new Set(COMBO_KEYS.map(key=>comboClip(this.state.fighter,key)?.clip).filter((name):name is string=>!!name));
    const carried=worn?this.clips.filter(c=>names.has(c.name)&&!source.animations.some(a=>a.name===c.name)):[];
    this.awakenedForm=new Fighter({...this.state,x:0,y:0,z:0,yaw:0},source,true,carried.length?bindClips(source.scene,carried,`${this.state.fighter} form`):undefined);
    this.awakenedForm.owner=this;
    this.group.add(this.awakenedForm.group);
    this.awakenedForm.group.visible=false;
    const formRoot=this.awakenedForm.group,update=formRoot.updateMatrixWorld;
    formRoot.updateMatrixWorld=function(this:THREE.Object3D,force?:boolean){if(this.visible)update.call(this,force);};
    // Every model is normalised to one height, so without this the awakened
    // body is exactly as big as the base one - and Full Swell is not.
    this.awakenedForm.group.scale.setScalar(look.formScale??1);
    this.awakenedForm.group.position.z=look.formForward??0;
    if(this.state.fighter==='konta'){
      // The surface and both shadow paths use the same dither and main-camera
      // eye. Otherwise invisible tails still cast solid shadows on the floor.
      for(const body of [this,this.awakenedForm])body.model.traverse(object=>{
        const mesh=object as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
        const fox=body===this.awakenedForm;
        if(fox&&!mesh.geometry.hasAttribute('foxTailWeight')){
          const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
          const tail=new Float32Array(indices.count);
          for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)if(/^Tail/i.test(mesh.skeleton.bones[indices.getComponent(i,j)]?.name??''))tail[i]+=weights.getComponent(i,j);
          mesh.geometry.setAttribute('foxTailWeight',new THREE.BufferAttribute(tail,1));
        }
        const materials=Array.isArray(mesh.material)?[...mesh.material]:[mesh.material];
        if(mesh.castShadow){
          mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
          mesh.customDistanceMaterial=new THREE.MeshDistanceMaterial();
          for(const shadow of [mesh.customDepthMaterial,mesh.customDistanceMaterial]){
            // RGBA depth packing and distance shaders ignore Material.opacity.
            // Feed the reveal into fragment alpha explicitly before hashing.
            shadow.onBeforeCompile=shader=>{
              shader.uniforms.uFormShadowOpacity=body.formOpacity;
              shader.fragmentShader='uniform float uFormShadowOpacity;\n'+shader.fragmentShader;
              shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>','diffuseColor.a*=uFormShadowOpacity;\n#include <alphahash_fragment>');
            };
            shadow.customProgramCacheKey=()=> 'konta-reveal-shadow-v1';
          }
          materials.push(mesh.customDepthMaterial,mesh.customDistanceMaterial);
          body.outlineMaterials.push(mesh.customDepthMaterial,mesh.customDistanceMaterial);
        }
        for(const material of materials){
          material.alphaHash=true;material.needsUpdate=true;
          if(!fox)continue;
          const compile=material.onBeforeCompile,cache=material.customProgramCacheKey();
          material.onBeforeCompile=(shader,renderer)=>{
            compile.call(material,shader,renderer);shader.uniforms.uFoxEye=this.formEye;
            shader.vertexShader='attribute float foxTailWeight;uniform vec3 uFoxEye;varying float vFoxTail;varying float vFoxDistance;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvFoxTail=foxTailWeight;vFoxDistance=distance((modelMatrix*vec4(transformed,1.)).xyz,uFoxEye);');
            shader.fragmentShader='varying float vFoxTail;varying float vFoxDistance;\n'+shader.fragmentShader;
            // Only what is actually at the lens clears, over a narrow band:
            // the hashed alpha is a dot pattern, and faded across two metres
            // from 5.5 m out it covered most of the tails behind Kurobi at the
            // chase distance and read as a dotted brown texture on them.
            shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>','diffuseColor.a*=mix(1.,smoothstep('+FOX_CLEAR[0].toFixed(2)+','+FOX_CLEAR[1].toFixed(2)+',vFoxDistance),vFoxTail);\n#include <alphahash_fragment>');
          };
          material.customProgramCacheKey=()=>cache+'-fox-tail-clearance-v3';
        }
      });
    }
    if(look.formTint===undefined){
      this.formHover=this.awakenedForm.restHover();
      this.awakenedForm.group.position.y=-this.formHover;
    }
    // A summon is worn: tinted, translucent, and the fighter stays inside it.
    if(look.formTint!==undefined){
      const tint=new THREE.Color(look.formTint);
      this.awakenedForm.model.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(!mesh.isMesh)return;
        mesh.castShadow=false;
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          const m=material as THREE.MeshToonMaterial;
          if(m.userData.ink){m.visible=false;continue;}
          m.color.copy(tint);m.map=null;m.emissive.copy(tint).multiplyScalar(.25);
          m.transparent=true;m.opacity=look.formOpacity??.6;m.depthWrite=false;
          // The shell is double-sided, and three draws a transparent
          // double-sided surface twice - back faces, then front. Those are two
          // more programs, linked the first time the Guardian is ever drawn,
          // which is the frame the player pressed to summon it. One pass also
          // reads better: the far side of a translucent shell showing through
          // the near side is mud, not depth.
          m.forceSinglePass=true;
          this.formMaterials.push(m);
        }
      });
    }
  }
  /** The lowest this body's soles get over its own idle, relative to its
   *  group: positive is a hover. Sampled off the mixer directly, with the
   *  procedural layer off, so nothing about the live pose leaks into a number
   *  that is meant to describe the rig. */
  private restHover(){
    const clip=this.active?.getClip();
    if(!clip||!this.active)return 0;
    const frames=Math.max(8,Math.ceil(clip.duration*30));
    let lowest=Infinity;
    for(let i=0;i<=frames;i++){
      this.active.time=clip.duration*(i/frames);
      this.mixer.update(0);
      this.group.updateMatrixWorld(true);
      lowest=Math.min(lowest,this.lowestSupport());
    }
    this.active.time=0;this.mixer.update(0);this.group.updateMatrixWorld(true);
    if(!Number.isFinite(lowest))return 0;
    return lowest-this.group.getWorldPosition(this.fallback).y;
  }
  /** Round 5 (GUMMY): SUNRISE floating (gummy/sunrise.ts SUNRISE_FLOAT): the form is placed so its lowest sole hangs the
   *  float's height - eased, bobbing slowly, a little lower through a swing, down into a knockdown, rising into it as
   *  the form arrives, giving under a landing - over the fighter's floor: the body as it would be drawn standing,
   *  lifted, so a take that leaves the floor (the GRAND TIDE's spring into the sky) keeps its height; and higher where
   *  a take hangs a foot lower than standing, so no sole comes within the float of the tile. In the air and being
   *  thrown about, the lifted rest alone. */
  private floatForm(dt:number,real:number,state:PlayerState,elapsed:number){
    const form=this.awakenedForm!;
    if(state.grounded&&!this.formWasGrounded)this.formLandedAt=this.floatClock;
    this.formWasGrounded=state.grounded;this.floatClock+=real;
    const arriving=state.action==='awaken'?THREE.MathUtils.smoothstep(elapsed,awakeningSwapAt(state.fighter),AWAKENING_ENTRY):1;
    this.formLift+=(floatTarget(state)*arriving-this.formLift)*(1-Math.exp(-real*SUNRISE_FLOAT.ease));
    const lift=this.formLift+floatBob(this.floatClock,this.floatPhase)*Math.min(1,this.formLift/SUNRISE_FLOAT.striking)-floatLanding(this.floatClock-this.formLandedAt);
    this.formLiftDrawn=lift;
    if(dt>0){
      // Lifted as a standing body would be drawn - so a take that springs off the floor keeps its spring - and
      // higher wherever a take hangs its feet lower than standing: no sole within `lift` of the tile.
      let target=-this.formHover+lift;
      if(state.grounded&&!REACTION_ACTIONS.has(state.action)){
        form.group.position.y=this.floatOffset;form.group.updateMatrixWorld(true);
        const lowest=form.lowestSupport();
        if(Number.isFinite(lowest))target=Math.max(target,this.floatOffset+this.group.position.y+lift-lowest);
      }
      this.floatOffset+=THREE.MathUtils.clamp((target-this.floatOffset)*(1-Math.exp(-dt*10)),-1.5*dt,3*dt);
    }
    form.group.position.y=this.floatOffset;
  }
  /** Where the transformation's body sits under the fighter, for the tests. */
  get formOffset(){return this.awakenedForm?.group.position.y;}
  /** How far the transformation's lowest sole is off the fighter's floor, as
   *  drawn this frame; undefined while no form is showing. For the tests. */
  formSole(){
    if(!this.awakenedForm||!this.awakenedForm.group.visible)return undefined;
    this.awakenedForm.group.updateMatrixWorld(true);
    const lowest=this.awakenedForm.lowestSupport();
    return Number.isFinite(lowest)?lowest-this.group.getWorldPosition(this.fallback).y:undefined;
  }
  private actionKey='';
  /** The body this fighter was cloned from, untouched: the rest pose the rush
   *  planning mirrors and measures against. */
  private readonly source:GLTF;
  /** Each rush stage's clip on the ground and in the air; index 0 is stage 1. */
  private rushPlan?:{ground:(THREE.AnimationClip|undefined)[];air:(THREE.AnimationClip|undefined)[]};
  /** Stage clips that `rushClips` named, whose measured entries may be keyed
   *  by stage rather than by clip name. */
  private rushAuthored=new Set<THREE.AnimationClip>();
  private rushMoves:MoveDefinition[]=[];
  private rushFractions=new Map<THREE.AnimationClip,number>();
  /** The input edge and the rush stage of the last attack drawn: a new cast
   *  of the same slot is a new move. */
  private lastSeq?:number;
  private lastStage=0;
  private hitFreeze=0;
  private hitFlash=0;
  /** The feel pass: the body flash, one uniform for every toon
   *  material on this body (look/toonShading.ts applyHitFlash) - rgb and how
   *  far toward it the body is painted - and what it fades from. */
  readonly flash={value:new THREE.Vector4(1,1,1,0)};
  /** Round 64: how far a big blow's flash takes the body's faces as well as its edges (toonShading applyHitFlash). */
  readonly flashFlat={value:0};
  /** The feel pass: the smear frame on the striking limb (look/toonShading.ts applyLimbSmear) - the strike
   *  point and the smear's reach round it, the way it is travelling and how far back it is drawn. */
  readonly smear={point:{value:new THREE.Vector4(0,0,0,.6)},motion:{value:new THREE.Vector4(0,1,0,0)},limb:{value:new THREE.Vector4(1,0,0,0)}};
  private smearLimbs?:THREE.Vector3[];private smearPrev?:THREE.Vector3[];private smearPrevRoot=new THREE.Vector3();private smearSeen=false;private smearAt=0;
  /** The frame shows the last step's pose again (AnimStyle 'twos'). */
  private stepRepeat=false;
  private flashTotal=.12;private flashBig=false;private readonly flashTint=new THREE.Color(1,1,1);
  /** A big blow being held (see BIG_SHAKE): wall-clock time left on it, its
   *  snap still to draw, and the level heading it travelled. */
  private bigLeft=0;private bigSnap=false;private bigHx=0;private bigHz=0;private bigStopSeen=false;
  /** Round 26: the big blow running knocks the body down (a slam, an air strike's spike): see `impactPose`. */
  private bigKnock=false;
  /** Any blow's shake (HIT_SHAKE): time left, its whole length, its size and the level heading it travelled. */
  private shakeLeft=0;private shakeTotal=1;private shakeSize=0;private shakeHx=0;private shakeHz=0;
  /** How far into its impact pose the body is (0..1, IMPACT_POSE). */
  private impactWeight=0;
  /** Round 86: whether the freeze pose drawn is a light blow's share (LIGHT_IMPACT) rather than a big blow's. */
  private impactLight=false;
  /** Round 86: how much longer a light blow's bend holds past its freeze (LIGHT_IMPACT.hold). */
  private lightHeld=0;
  /** Each joint the impact pose turned last frame: what it was before, and what the pose left it at - put back first if
   *  nothing has posed it since, so a joint no playing clip keys never collects the turn frame after frame. */
  private impactApplied=new Map<THREE.Object3D,{base:THREE.Quaternion;written:THREE.Quaternion}>();
  private readonly shakeDrawn=new THREE.Vector3();
  private hitSlot?:AttackSlot;
  private hitStyle?:string;
  private hitContactIndex?:number;
  private landingStarted?:number;
  private landingDuration?:number;
  private strikeContact=false;
  private poseNodes:PoseNode[]=[];
  private poseByNode=new Map<THREE.Object3D,PoseNode>();
  private poseSamplers=new Map<THREE.AnimationClip,{node:THREE.Object3D;property:string;interpolant:THREE.Interpolant}[]>();
  private blendTime=0;
  /** Physics, once the server has said he is dead. Never authoritative: see
   *  src/render/Ragdoll.ts. Undefined until a death, and on any client where
   *  Rapier has not finished loading - the authored fall is the fallback. */
  private ragdoll?:Ragdoll;
  /** How far the corpse has been tidied into the authored downed pose, and
   *  how long it has been dead. A ragdoll that has come to rest is a body in
   *  whatever heap the fall left it, which is right for the fall and wrong
   *  for the twenty seconds after: once the physics is asleep the limbs are
   *  blended toward the rig's own downed clip - rotations only, so the body
   *  stays where and how it fell - and the corpse reads as a fighter lying
   *  down rather than as a dropped doll. */
  private deathSettle=0;
  private deathClock=0;
  /** The pelvis dip of a hard stop: a fighter who brakes from a run gives at
   *  the knees for a beat rather than dissolving the run into the idle. */
  private stopDip=0;
  /** World position last frame, so a death inherits the speed it happened at. */
  private lastWorld=new THREE.Vector3();
  private lastWorldAt=-1;
  private deathVelocity=new THREE.Vector3();
  /** Held equipment, and the offset this fighter's own idle gives it. */
  private heldPins:{node:THREE.Object3D;position:THREE.Vector3}[]=[];
  /** Canonical joint name -> this rig's bone, via resolveSkeleton. */
  readonly joints=new Map<string,THREE.Bone>();
  private blendDuration=0;
  /** The root's own transition length, which may be longer than the limbs'.
   *  A reaction snaps the limbs on the frame the blow lands - that is what a
   *  reaction is - but the root of a clip that was carrying the body two
   *  metres into a swing cannot be put back in a sixtieth of a second:
   *  measured, that was a 2.38 m single-frame teleport on Gummy's heavy cut
   *  short by a hit, 2.0 on Kosho and Kenzo. The limbs still snap; the body
   *  comes back over a tenth of a second. */
  private rootBlendDuration=0;
  private rootBlendTime=0;
  /** How far the root's own transition has got, eased: the root clamp comes
   *  in on it. See `limitRootMotion`. */
  private rootGrip=1;
  /** Whether the root clamp moved the root on the last frame drawn, and
   *  whether the transition in flight started from such a frame. */
  private rootClamped=false;
  private rootFromClamped=false;
  /** Where the root was drawn last frame, and where it was when the
   *  transition in flight began, in the body's own frame. */
  private rootDrawnLast=new THREE.Vector3();
  private rootDrawnFrom=new THREE.Vector3();
  private previousAction='idle';
  /** A move's identity for the renderer. Bumped when a genuinely new instance
   *  of an action starts, which is not the same question as whether its
   *  authoritative start time has changed. */
  private actionEpoch=0;
  private previousPhase='';
  /** A blow's identity, and how long ago it landed. Both are counted from the
   *  hit itself rather than from whatever action the server has the body in,
   *  because a reaction changes action several times on its way to the floor. */
  private reactionEpoch=0;
  private blendedEpoch=-1;
  private reactionClock=0;
  /** Round 3e (REACT): when the newest blow landed here, on the reaction
   *  layer's clock (`reactTime`), for `reactionSince`. */
  private blowAt=-Infinity;
  /** Round 3e (REACT): how long the body has been in the air in its current
   *  launch, carried through a blow that re-launches it (see `stepAirClock`),
   *  and how far the somersault that follows the knockback clip has turned,
   *  0 to 1, never backwards; with the frame's step for it. */
  private airClock=0;
  private airTurn=0;
  /** The get-up under way follows a stun, not a fall: the body was on its feet (see STANDING_RISE). */
  private standingRise=false;
  private airStep=0;
  private lastStarted=-1;
  private lastProgress=0;
  private drawnEpoch=-1;
  private drawnProgress=0;
  /** The drawn move clock (see `stepMoveClock`): seconds into the move as
   *  drawn, what it belongs to, the move's own clock last frame, and the
   *  state handed to the pacing with that clock in it. */
  private moveClock=0;
  private clockAction='';
  private clockSeq?:number;
  private clockStage=0;
  private clockStarted=-1;
  private clockTime=0;
  private clockSeconds=0;
  private clockLag=0;
  /** Where in the move the simulation last held it (its hitstop), as drawn. */
  private clockHeldAt=-Infinity;
  private readonly drawn={} as PlayerState;
  /** The impact freeze as last seen, and whether the one running holds the
   *  clip (see FREEZE_EARLY). */
  private freezeSeen=0;
  private freezeHonoured=false;
  private previousPosition=new THREE.Vector3();
  /** Recent position changes and the time between them, newest last. Summed,
   *  they are the travel speed; see `VELOCITY_WINDOW`. */
  private motionWindow:{x:number;y:number;z:number;gap:number}[]=[];
  private motionSpan=0;
  /** Time since the last position change, which is not yet anybody's gap. */
  private motionPending=0;
  private locomotionSpeed=0;
  /** Ground covered since the last frame, which is what a stride clock should
   *  be driven by. Zero across a round reset, which is a teleport, not travel. */
  private travelled=0;
  /** How much of a walking lower body is mixed over an attack, and the stride
   *  clock that drives it. A melee cast solves its own approach - it can cover
   *  three metres of floor between the wind-up and the blow - and while it is
   *  doing that `state.action` is 'light' or 'heavy', so nothing in the
   *  locomotion path runs and the attacker glides in over frozen legs. Its own
   *  clock rather than the gait's: the gait is reset from the mixer whenever
   *  the run clip is playing, and nothing here should be able to disturb that. */
  private stride=0;
  private strideClock=0;
  private legNodes?:Set<THREE.Object3D>;
  private jumpAge=0;
  /** Past the top of the arc, on the way down and playing the fall rather than
   *  the takeoff. The takeoff clip used to be frozen on one frame for between
   *  41% and 64% of the airtime, which is a statue with a shadow under it. */
  private falling=false;
  /** How long the descent had left to run when it began, so the fall clip can
   *  be laid across the whole of it rather than held on its first frame until
   *  the floor is close enough to be worth playing. */
  private fallFrom=0;
  /** Round 4b (JUMP): how far into the jump the fall began (a form's descent is paced by time). */
  private fallAt=0;
  private supportVertices:{mesh:THREE.SkinnedMesh;index:number}[]=[];
  private pelvis?:THREE.Bone;
  private secondary?:SecondaryMotion;
  private rootBone?:THREE.Bone;
  private rootReference=new THREE.Vector3();
  /** Bones parented beside the root instead of under it: held props, mostly. */
  private rootSiblings:THREE.Bone[]=[];
  private rootChain=new Set<THREE.Object3D>();
  private rootOffset=0;
  private aimWeight=0;
  private neckBone?:THREE.Bone;
  private headBone?:THREE.Bone;
  /** A hit, on whichever end of it this fighter is. `direction` is the world
   *  heading the blow travelled in and `damage` is what it was worth, which is
   *  what turns one flinch clip into a hit that came from somewhere and cost
   *  something: the body is bent away from it, harder for a heavier blow. */
  impact(recipient=true,slot?:AttackSlot,style?:string,contactIndex?:number,direction?:THREE.Vector3,damage?:number,height?:number,detail?:ImpactDetail,paired?:LandedBlow|null){
    // A rush's last stage is the finisher: the blow that sends the target
    // away holds both bodies a beat longer, flashes brighter and bends the
    // struck one further, so the string reads as ending rather than stopping.
    const finisher=slot==='light'&&(detail?.chain??0)>=RUSH_STAGES-1;
    this.hitFreeze=recipient?(finisher?.1:.07):(finisher?.07:.05);
    this.struck=true;
    // Which of the server's blows this event hands over, where its record is
    // in (see LANDED): no touch may answer it after this, and the touch that
    // answered it already is known exactly. Only a hit's: a guard's event
    // carries no reaction (as `takeBlow` reads it) and has no record to take.
    // A form standing in for the body is told by the fighter it replaces,
    // which has paired it.
    const blow=!recipient||detail?.reaction===undefined?undefined:paired===undefined?LANDED.pair(this.state.id,slot,contactIndex):paired??undefined;
    // Round 3e (REACT): a blow presented ahead of the server (the Senpugan's
    // preview, Prediction's `takeImpacts`) is the local copy's prediction of
    // it: it answers that prediction - topping up the touch that answered it
    // already, or standing as its touch - and is let go of with it if the
    // server turns it away (`withdrawRejected`), rather than holding its
    // reaction for its whole life.
    const ahead=recipient&&!blow&&paired===undefined&&detail?.reaction!==undefined?LANDED.predictedOn(this.state.id,slot,contactIndex):undefined;
    if(recipient&&ahead){
      let touch:Touch|undefined;
      for(const t of this.touches)if(!t.withdrawn&&t.seq===ahead.seq&&t.index===ahead.contact&&t.from.state.id===ahead.attacker){touch=t;break;}
      const ring=this.takeBlow(slot,style,contactIndex,direction,damage,height,detail,finisher,touch);
      const from=touch?undefined:Fighter.bodyOf(ahead.attacker);
      if(from){this.touches.push({from,seq:ahead.seq,index:ahead.contact,at:this.reactTime,slot:slot??'heavy',ring,claimed:false,hx:direction?.x??0,hz:direction?.z??0});if(this.touches.length>6)this.touches.shift();}
    }else if(recipient){
      // The blow this body already took where it was drawn (see TORSO_RADIUS):
      // the event confirms that one rather than landing a second.
      this.takeBlow(slot,style,contactIndex,direction,damage,height,blow?.outcome&&detail&&!detail.outcome?{...detail,outcome:blow.outcome}:detail,finisher,this.claimTouch(slot,contactIndex,direction,blow));
    }else{
      this.strikeContact=true;
      // The arm that lands a blow is stopped by it too.
      // (Round 98: under the dream switch the body drives on through it instead - leaned into the blow, DRIVE, and let go
      // slower than a recoil: the blind critics, of every string since round 90, "no planted foot or hip drive", "Tempo hits
      // at full reach from a skimming lunge", where the striker should drive hips and shoulders through the body.
      // It tipped the striker back off the contact, four degrees, as if the blow had bounced.)
      // (Not by a body whose blows step their own measured way onto the skin - OWN_STEPS: leaned on through, Madake's
      // second jab sank its fist into the body it struck, tests/madakeConsecutiveContact.)
      // (Nor a blade's: its contact is the steel's, tuned to the forte - leaned on through, Hisame's heavy thrust met the
      // torso 6 cm short at its first damage, tests/hisameSharedIntegration.)
      const drive=DREAM_IMPACT&&!OWN_STEPS.has(this.state.fighter)&&!this.armed&&!this.blades?.length;
      if(direction){_leanAxis.copy(direction).setY(0);if(_leanAxis.lengthSq()>1e-6)this.recoil.copy(_leanAxis.normalize()).multiplyScalar(drive?DRIVE.lean:-.07);}
      this.drove=drive;this.driving=drive?DRIVE.hold:0;
    }
    // A transformation's body IS the fighter while it shows: Full Swell,
    // Kurobi, the NIGHTFALL, the RAKSHASA and the HOUND ARMOR flinch,
    // flash and hold on the blow like the body they replace. They used to
    // take every hit without a twitch, because only the fighter they hang
    // under was ever told about one. A worn Guardian is a shell the fighter
    // stands inside, and the fighter takes the hit.
    if(this.awakenedForm?.group.visible&&AWAKENINGS[this.state.fighter].kind==='form')this.awakenedForm.impact(recipient,slot,style,contactIndex,direction,damage,height,detail,blow??null);
  }
  /** A blow landing on this body: from its event (`impact`), or from the
   *  attacker's striking surface arriving in it where it is drawn (a touch,
   *  see TORSO_RADIUS). `confirms` is the touch an event confirms: the body
   *  has already answered that blow, so its envelope is only topped up to what
   *  the event says it was worth, and the reaction's clocks are left running.
   *  Returns the slot of the reaction ring the blow went into, or -1. */
  private takeBlow(slot:AttackSlot|undefined,style:string|undefined,contactIndex:number|undefined,direction:THREE.Vector3|undefined,damage:number|undefined,height:number|undefined,detail:ImpactDetail|undefined,finisher:boolean,confirms?:Touch,touched=false){
    this.hitByTouch=touched;
    // A fresh blow, which is a different question from a fresh action. A
    // knockdown runs launched into ground-impact into landing into get-up on
    // one action, and every one of those phase changes used to be given the
    // twelve milliseconds that belong to the frame the blow lands.
    if(!confirms){this.reactionEpoch++;this.reactionClock=0;this.blowAt=this.reactTime;
      // The flash: a big blow paints the body most of the way to white and
      // then the thrower's colour, for longer (BIG_FLASH); any other blow a
      // short white-to-cyan flash, so every hit flashes.
      // Round 5 (GUARD): a blow the guard took does not flash the body - it
      // painted the guarding fighter a flat white cut-out inside the orb. The
      // orb's ripple is that blow's flash (vfx/GuardFx).
      const guarded=!detail?.reaction&&(this.state.action==='guard'||!!this.state.guarding);
      if(!guarded){
        // (The dream loop, round 24: a flash of a few frames - the impact's - where a big blow's held a quarter of a
        // second and left the victim white under his own effects.)
        this.flashBig=!!detail?.big;this.flashTotal=this.hitFlash=DREAM_IMPACT?(this.flashBig?DREAM_FLASH.big:finisher?DREAM_FLASH.finisher:DREAM_FLASH.light):this.flashBig?BIG_FLASH:finisher?.17:.12;
        {const worth=THREE.MathUtils.clamp(((damage??40)*(finisher?1.4:1)-20)/120,0,1),flat=direction?Math.hypot(direction.x,direction.z):0;
          this.shakeTotal=this.shakeLeft=THREE.MathUtils.lerp(HIT_SHAKE_TIME[0],HIT_SHAKE_TIME[1],worth)+HIT_SHAKE_DELAY;this.shakeSize=THREE.MathUtils.lerp(HIT_SHAKE[0],HIT_SHAKE[1],worth);
          if(flat>1e-4){this.shakeHx=direction!.x/flat;this.shakeHz=direction!.z/flat;}else{this.shakeHx=-Math.sin(this.facing);this.shakeHz=-Math.cos(this.facing);}}
        // (Round 25: under the dream loop every blow flashes the victim white into red.)
        if(DREAM_IMPACT)this.flashTint.copy(DREAM_FLASH_RED);else if(this.flashBig&&detail?.tint!==undefined)this.flashTint.setHex(detail.tint);else this.flashTint.setRGB(.62,.94,1);
      }
    }
    // A big blow: snapped into, then held (see BIG_SNAP, BIG_SHAKE).
    if(detail?.big){
      this.bigLeft=BIG_HOLD_MAX;if(!confirms)this.bigSnap=true;
      const flat=direction?Math.hypot(direction.x,direction.z):0;
      if(flat>1e-4){this.bigHx=direction!.x/flat;this.bigHz=direction!.z/flat;}else{this.bigHx=-Math.sin(this.facing);this.bigHz=-Math.cos(this.facing);}
      this.bigKnock=detail.outcome==='knockdown'||detail.reaction==='knockdown'||detail.outcome==='groundBounce';
    }
    this.hitSlot=slot;this.hitStyle=style;this.hitContactIndex=contactIndex;
    this.landingStarted=undefined;this.landingDuration=undefined;
    this.hitDamage=(damage??40)*(finisher?1.35:1);
    this.hitBehind=!!detail?.fromBehind;
    let ring=-1;
    if(direction){
      const force=THREE.MathUtils.clamp((damage??40)/260*(finisher?1.4:1),.12,1);
      const rise=direction.lengthSq()>1e-6?direction.y/direction.length():0;
      const facing=this.facing;
      _leanAxis.copy(direction).setY(0);
      if(_leanAxis.lengthSq()>1e-6){
        _leanAxis.normalize();
        // From behind: the blow travels the way the body faces. The event
        // says so where the caller passes it; otherwise it is read here.
        this.hitBehind=detail?.fromBehind??_leanAxis.x*Math.sin(facing)+_leanAxis.z*Math.cos(facing)>.2;
        this.recoil.copy(_leanAxis).multiplyScalar(.30*force);
        // Which side of the struck fighter's own spine it arrived on. A hook
        // across the front of the body wrenches the hips round with it; a
        // straight down the centre line does not. The same blow across the
        // back turns them the other way.
        this.hitTwist=THREE.MathUtils.clamp(
          (_leanAxis.x*Math.cos(facing)-_leanAxis.z*Math.sin(facing))*.42*force*(this.hitBehind?-1:1),-.28,.28);
      }
      // The blow's pitch and its landing height, both of which `setY(0)` used
      // to throw away - which is why a sweep, a gut punch and an uppercut all
      // produced one upright body bent backwards by the same amount. From
      // behind the fold turns over: a blow to the back arches the body off
      // it and one to the back of the head drops the head forward.
      this.hitHeight=height??1.2;
      const high=THREE.MathUtils.clamp((this.hitHeight-FOLD_LOW)/(FOLD_HIGH-FOLD_LOW),0,1);
      this.hitFold=THREE.MathUtils.clamp((THREE.MathUtils.lerp(.36,-.30,high)-rise*.24)*force*(this.hitBehind?-1:1),-.34,.34);
      // The reaction layer; see HIT_REACT. The side a blow turns the body
      // to is the way it was travelling across it, where it was; a blow
      // down the centre line takes the rush stage's side, alternating, or
      // failing that the next side from the last.
      if(_leanAxis.lengthSq()>1e-6){
        const across=_leanAxis.x*Math.cos(facing)-_leanAxis.z*Math.sin(facing);
        const stage=detail?.chain??this.hitCount;
        const side=Math.abs(across)>.35?Math.sign(across):stage%2===0?1:-1;
        // (Round 90: never for a blow from behind - the takes are posed struck from in front, and a snap-back would throw
        // the head back into it; the body's own hurt answers one.)
        if(DREAM_IMPACT&&!confirms)this.hurtTake=Fighter.dreamTakes&&!this.hitBehind?dreamHurt(stage,side,Fighter.lockHurts):undefined;
        const guarded=this.state.action==='guard'&&!detail?.reaction;
        // And by what it was worth, as the lean is: a barrage tick is not a
        // Senpugan.
        const worth=THREE.MathUtils.clamp(.6+(damage??40)/160,.7,1.8);
        const scale=worth*(guarded?HIT_SCALE.guarded:finisher?HIT_SCALE.finisher:slot==='heavy'?HIT_SCALE.heavy:slot==='special'||slot==='ultimate'?HIT_SCALE.big:1)
          *(detail?.downed?FLOOR_FLINCH:1) // Ground hits: lying flat, it flinches less (FLOOR_FLINCH).
          // The dream loop (22 October 2026): a body taking a blow on its feet folds a third further - a
          // victim should fold at the waist on every jab, and a blind critic read ours as "poking a mannequin". Not a launch
          // or a body already down: their turns are the ones the pop guards watch (tests/heavyReaction).
          *(DREAM_IMPACT&&!detail?.downed&&detail?.reaction!=='launched'&&detail?.reaction!=='knockdown'?DREAM_STAND:1);
        // (How heavy a blow is is read off its own scale, before the dream loop's standing fold: a jab stays a jab.)
        const standing=DREAM_IMPACT&&!detail?.downed&&detail?.reaction!=='launched'&&detail?.reaction!=='knockdown'?DREAM_STAND:1;
        const heavy=guarded?0:THREE.MathUtils.smoothstep(scale/standing,HIT_HEAVY[0],HIT_HEAVY[1]);
        const held=confirms?this.hits[confirms.ring]:undefined;
        if(held&&held.at===confirms!.at){
          // Confirmed: the envelope already running is topped up to what the
          // blow was worth, and keeps its side and its clock.
          ring=confirms!.ring;
          if(scale>held.scale){held.scale=scale;held.heavy=Math.max(held.heavy,heavy);}
          this.hitHeavy=Math.max(this.hitHeavy,held.heavy);
        }else{
          this.hitHeavy=heavy;
          ring=this.hitCursor;
          // A big blow's envelope starts already risen: the body is in the
          // pose the blow drives it into on the frame it lands, and holds it
          // through the freeze (the layer's clock waits while it lasts).
          const lead=detail?.big?HIT_RISE*(1+.3*heavy):0;
          this.hits[this.hitCursor]={at:this.reactTime-lead,hx:_leanAxis.x,hz:_leanAxis.z,side,scale,heavy,gone:Infinity,stand:standing};
          this.hitCursor=(this.hitCursor+1)%HIT_RING;this.hitCount++;
        }
        // The blow's own shove (see PUSH_SELL): started by the blow, and only
        // grown - while it is still rising - by the event that confirms it.
        const sell=Math.min(PUSH_SELL_MOST,DREAM_IMPACT?THREE.MathUtils.lerp(PUSH_SELL_STRING*scale/standing,PUSH_SELL*scale,heavy):PUSH_SELL*scale);
        const settle=DREAM_IMPACT?THREE.MathUtils.lerp(SELL_SETTLE_STRING,SELL_SETTLE,heavy):SELL_SETTLE;
        if(!confirms){this.sellAt=this.reactTime;this.sellAmount=sell;this.sellSettle=settle;this.sellDir.set(_leanAxis.x,0,_leanAxis.z);this.sellGone=Infinity;}
        else if(this.reactTime-this.sellAt<=SELL_RISE&&sell>this.sellAmount){this.sellAmount=sell;this.sellSettle=Math.max(this.sellSettle,settle);}
        if(detail?.reaction==='launched')this.startLaunch(detail,slot,finisher,_leanAxis.x,_leanAxis.z,across,side);
        // Ground hits: a body on the floor bounces there (FLOOR_BOUNCE_SPEED), rolled along the blow - the landing's
        // own bounce, started by the blow, whether or not a touch answered it first.
        if(detail?.downed){
          this.landedAt=this.reactTime;this.landRoll=FLOOR_BOUNCE_ROLL;this.launchHeading.set(_leanAxis.x,0,_leanAxis.z);
          this.launchSide=_leanAxis.x*Math.sin(facing)+_leanAxis.z*Math.cos(facing)>LAUNCH_SIDE?-1:1;
          this.landSpeed=Math.min(FLOOR_BOUNCE_MOST,FLOOR_BOUNCE_SPEED+(damage??0)*FLOOR_BOUNCE_PER);
        }
      }
    }
    // Round 3e (REACT): a launch whose blow crossed no ground to arrive (a
    // field or a blast centred on the body: Black Pyre's crumple) starts its
    // layer all the same, thrown back from the way the body faces. It kept
    // the last launch's, landed and done, and laid the body back a quarter
    // turn in one frame: the head dropped 70-100 cm.
    if(detail?.reaction==='launched'&&this.launchAt!==this.reactTime){const facing=this.facing;this.startLaunch(detail,slot,finisher,-Math.sin(facing),-Math.cos(facing),0,1);}
    return ring;
  }
  /** Round 3e (REACT): the launch layer's start (see `hitReact`), for a blow
   *  that launches: thrown along `hx, hz` (the way the blow travelled, on the
   *  ground), `across` the body and to `side` of it. */
  private startLaunch(detail:ImpactDetail|undefined,slot:AttackSlot|undefined,finisher:boolean,hx:number,hz:number,across:number,side:number){
    // Round 3e (REACT): a blow launching a body already in the air
    // carries on from what its launch was doing (see `launchCarry`):
    // the same line of flight, the tumble and the corkscrew where they
    // had got to, the jack-knife and the trailing limbs let go of
    // rather than dropped.
    const again=this.launchWeight>0&&this.launchAt>=0&&!this.state.grounded&&this.state.action==='launched';
    this.launchCarry=again?this.launchPitch:0;this.spinCarry=again?this.lastSpin:0;
    for(let i=0;i<4;i++)this.launchHeld[i]=again?this.launchLast[i]:0;
    // (The roster-wide motion pass, LAUNCH_SIDE: a throw the way the body faces lands feet first along it, on its back
    // as the downed clip lies. A re-launch keeps the line of flight, and the side with it.)
    if(!again){this.launchHeading.set(hx,0,hz);const facing=this.facing;this.launchSide=Math.sin(facing)*hx+Math.cos(facing)*hz>LAUNCH_SIDE*Math.hypot(hx,hz)?-1:1;}
    this.launchAt=this.reactTime;this.launchRise=0;this.launchFrom=NaN;this.launchArc=0;
    // Round 3e (REACT, for VARIETY): a throw the blow's outcome keeps
    // short - a crumple's quarter second, a hop, a wall bounce, a bounce
    // off the floor - is guessed at its own lift, not a launch's, and
    // does not go over: a crumple drawn as a backflip turned half a
    // turn in a third of a second and unwound on the floor.
    const outcome=detail?.outcome,short=!!outcome&&outcome!=='launch'&&outcome!=='stagger'&&outcome!=='spin';
    this.launchGuess=outcome&&outcome!=='stagger'&&outcome!=='spin'&&outcome!=='dizzy'?OUTCOME_LIFT[outcome]:LAUNCH_RISE_GUESS;
    // v70: a launcher's throw runs ahead of its arc (moves.ts LAUNCH_LEAD): the arc is the lift the blow says.
    this.launchLed=!!detail?.lift;if(detail?.lift)this.launchGuess=detail.lift;
    // A body knocked off its feet by a blow worth sending it goes over;
    // one juggled higher while already up does not.
    // (Not a body whose knockback clip draws the whole flight, FLIGHT_SPREAD: Taisei's is thrown back, flies on his back
    // and lands on it. Turned over on top of it, the layer's somersault was still short of its landing at the floor -
    // stood upright, his legs went 20-50 cm through the tile for the last frames before the knockdown laid him flat.)
    // (Nor a body in a floor-length robe weighted to its legs, LAUNCH_NO_TURN: turned over, the robe stood up off the legs.)
    this.launchTurns=!short&&this.state.grounded&&(finisher||slot==='heavy'||slot==='special'||slot==='ultimate')&&!(FLIGHT_SPREAD[this.state.fighter]&&!this.isForm)&&!LAUNCH_NO_TURN.has(this.state.fighter)?1:0;
    // And corkscrews too off the biggest blows and off any that came
    // across the body (see LAUNCH_SPIN), the way the blow turned it.
    this.launchSpin=this.launchTurns&&(slot==='special'||slot==='ultimate'||Math.abs(across)>.5)?LAUNCH_SPIN*side:0;
  }
  /** The touch an event is the confirmation of. With the server's record of
   *  the blow (`blow`, see LANDED) it is exactly the touch that answered it,
   *  however long its event took across the network, or none. Without one
   *  (nothing is predicted in the arcade) it is the newest that could be:
   *  unclaimed, inside TOUCH_MERGE, the same slot and blow, and not from the
   *  other side. A withdrawn touch is claimed already: a server that lands a
   *  blow after all has it answered afresh. */
  private claimTouch(slot:AttackSlot|undefined,contactIndex:number|undefined,direction:THREE.Vector3|undefined,blow?:LandedBlow){
    let best:Touch|undefined;
    if(blow){
      // Its own touch; else the touch of the same blow as the local copy had
      // it under another input edge (see LANDED's standsFor).
      for(const touch of this.touches)if(!touch.claimed&&touch.seq===blow.seq&&touch.index===blow.contact&&touch.from.state.id===blow.attacker){best=touch;break;}
      if(!best)for(const touch of this.touches)if(!touch.claimed&&touch.from.state.id===blow.attacker&&LANDED.same(LANDED.blow(blow.attacker,touch.seq,this.state.id,touch.index),blow)){best=touch;break;}
    }else for(const touch of this.touches){
      if(touch.claimed||this.reactTime-touch.at>TOUCH_MERGE||touch.slot!==slot)continue;
      if(contactIndex!==undefined&&touch.index!==contactIndex)continue;
      if(direction){const flat=Math.hypot(direction.x,direction.z);if(flat>1e-3&&(direction.x*touch.hx+direction.z*touch.hz)/flat<.2)continue;}
      if(!best||touch.at>best.at)best=touch;
    }
    if(best)best.claimed=true;
    return best;
  }
  /** Lets go of every blow answered here that the server has since resolved
   *  without landing (see LANDED): no event may confirm it, and its reaction
   *  and its shove fade out over WITHDRAW. The form standing in for the body
   *  lets go of its own answer too. */
  private withdrawRejected(){
    for(const touch of this.touches){
      if(touch.claimed||touch.withdrawn||!LANDED.refused(LANDED.blow(touch.from.state.id,touch.seq,this.state.id,touch.index)))continue;
      this.withdraw(touch);
      const form=this.drawnBody();
      if(form!==this)for(const inner of form.touches)if(!inner.withdrawn&&inner.from===touch.from&&inner.seq===touch.seq&&inner.index===touch.index)form.withdraw(inner);
    }
  }
  private withdraw(touch:Touch){
    touch.withdrawn=touch.claimed=true;
    const held=this.hits[touch.ring];
    if(held&&held.at===touch.at&&held.gone===Infinity)held.gone=this.reactTime;
    if(this.sellAt===touch.at&&this.sellGone===Infinity)this.sellGone=this.reactTime;
  }
  /** How much of a withdrawn blow is still shown, `t` seconds after it was
   *  withdrawn: all of it until then, none after WITHDRAW. */
  private static letGo(t:number){return t<=0?1:1-THREE.MathUtils.smoothstep(t,0,WITHDRAW);}
  /** Round 3e (REACT): the drawn body of fighter `id`, if any. */
  private static bodyOf(id:string){for(const body of Fighter.drawn)if(body.state.id===id)return body;return undefined;}
  /** The shape of a blow's own shove over time: up over SELL_RISE, eased off
   *  over SELL_SETTLE. */
  private static sellEnvelope(t:number,settle=SELL_SETTLE){
    if(t<=0)return 0;
    if(t<SELL_RISE){const u=t/SELL_RISE;return u*u*(3-2*u);}
    return Math.exp(-(t-SELL_RISE)/settle);
  }
  private started=false;
  /** Whether a clip has been chosen for this body at least once. */
  private posed=false;
  private outlineMaterials:THREE.Material[]=[];
  /** Round 4b (TARGETING): the lock's glow on this body's ink (ThreatOutline); unlit, the ink as it was. */
  readonly threatInk=threatInk();
  /** This body's side in a ball match, on its ink and its rim light (look/toonShading.ts applyTeamTrim;
   *  render/ball/TeamTrim.ts sets it). All zero, as everywhere else: the ink and the rims as they were. */
  readonly teamTrim=teamTrim();
  /** The side's trim on this body and on its transformation's (a form is a body of its own): the ink's colour and the
   *  rim's (linear), and how much of each (0-1). */
  setTeamTrim(ink:THREE.Color,rim:THREE.Color,inkAmount:number,rimAmount:number){
    this.teamTrim.inkColor.value.copy(ink);this.teamTrim.rimColor.value.copy(rim);this.teamTrim.amount.value.set(inkAmount,rimAmount);
    this.awakenedForm?.setTeamTrim(ink,rim,inkAmount,rimAmount);
  }
  private rightBone?:THREE.Bone;
  private leftBone?:THREE.Bone;
  /** The far end of whatever is in that hand, in the hand's own frame. Only
   *  set where something reaches well past the fingers. */
  private rightReach?:THREE.Vector3;
  private leftReach?:THREE.Vector3;
  private blades?:{bone:THREE.Object3D;tip:THREE.Vector3}[];
  /** Root first. A lean is spread along this rather than applied to one joint,
   *  so the body bends instead of pivoting in one place. */
  private leanChain:THREE.Bone[]=[];
  private bodyJoints?:Set<THREE.Object3D>;
  /** The two legs, for foot planting. Empty where a rig has no recognisable
   *  hip-knee-ankle chain, in which case the whole thing is simply off. */
  private legs:Leg[]=[];
  private legPresentation=new Map<THREE.Bone,THREE.Quaternion>();
  /** Hip to ankle in the rest pose: how far a foot can be from its own hip
   *  before the leg is straight, which is what ends a plant. */
  private legLength=0;
  /** Feet that have come down since this was last drained, for the sound.
   *  There were no footsteps in the game; the plant detection is exactly the
   *  trigger one needs, and it was already being computed. */
  readonly steps:{x:number;y:number;z:number;speed:number}[]=[];
  /** The match clock, carried so a step can be rate-limited per foot. */
  private serverTime=0;
  /** The walk clip, if this rig has one. Eight of the ten do not, and asking
   *  for it every frame meant the action key flipped on a clip that was never
   *  going to be found - which restarted the run cycle on every speed change. */
  private walkClip?:THREE.AnimationClip;
  /** The run clip, cached for the same reason and so the gait can blend
   *  between the two rather than swapping from one to the other. */
  private runClip?:THREE.AnimationClip;
  /** Where the fighter is in their own stride, in steps. Both gait clips are
   *  read from it, so blending them is a blend of two poses at the same point
   *  of the same step rather than a mush of two unrelated ones. */
  private gait=0;
  /** How much of the run is in the blend: 0 is a walk, 1 is a run. */
  private gaitBlend=0;
  /** The lower-body stride laid over a guard: which clip it is cycling, where
   *  in that clip it is, and how much of it is showing. */
  private strideClip?:THREE.AnimationClip;
  private strideWalking?:boolean;
  private strideWeight=0;
  private legPhase=0;
  /** Every bone from each hip down, which is what the stride is written to.
   *  Built from the rig rather than from a name pattern: the constructor's own
   *  search accepts `calf` for a knee, and a regex that misses it leaves an
   *  animated thigh and foot around a frozen knee. */
  private legMask?:Set<THREE.Object3D>;
  /** World heading of the last blow, times how far it bent this body. Decays. */
  private recoil=new THREE.Vector3();
  /** The part of a blow that used to be discarded by `setY(0)`. `hitFold` is
   *  positive when the body should jackknife over the blow and negative when
   *  it should arch off it; `hitTwist` is the hips being wrenched around by
   *  one that arrived off the centre line; `hitHeight` is where it landed and
   *  `hitDamage` what it was worth, which is what lets a barrage tick and a
   *  Pearl Drive the same clip at different weights. */
  private hitFold=0;
  /** Round 84: the stun's own curl over the blow (STUN_HOLD.hunch), eased. */
  private stunHunch=0;
  /** How heavy the last blow was (see HIT_HEAVY), for the lean's let-go. */
  private hitHeavy=0;
  private hitTwist=0;
  private hitHeight=1.2;
  /** Whether the newest blow is a touch the server has not yet confirmed (`answerTouch`; `takeBlow`'s `touched`). */
  private hitByTouch=false;
  private hitDamage=40;
  /** The last blow arrived from behind the body. */
  private hitBehind=false;
  /** The dream loop, round 28: which of the body's authored hurts (DREAM_HURTS, scripts/fanim/dream_hurts.py) the
   *  newest blow is drawn with, its CLIP_RULES key - picked once for the blow (`takeBlow`, a fresh one), so a touch and
   *  the event that confirms it never draw it two ways (iteration seventeen's fold, flipped by a confirm: 13-14 cm). */
  private hurtTake?:string;
  /** The take this frame's reaction plays (`reaction`), and the share of the layer's fold and lean kept on top of it,
   *  eased (TAKE_SHAPE). */
  private takeOn?:keyof typeof DREAM_HURTS;
  private takeFold=1;
  private takeLean=1;
  /** Round 98: how long a striker's drive into its blow is held yet (DRIVE), seconds, and whether its last blow drove. */
  private driving=0;
  private drove=false;
  private takeHunch=1;
  /** Round 93: how far the drawn body is turned off its yaw by a spin take (TAKE_TURN), radians. */
  private takeTurn=0;
  /** The fighter a transformation's body hangs under. */
  private owner?:Fighter;
  /** Which way the body faces in the world. A transformation's body hangs
   *  under its fighter at a local yaw of nought, so its own rotation says
   *  nothing about where a blow came from. */
  private get facing(){return this.group.rotation.y+(this.owner?.group.rotation.y??0);}
  /** A transformation's body. It hangs under the fighter it belongs to and is
   *  levelled by that fighter rather than by itself; see the form block in
   *  `update`, which owns the one clamp it gets. */
  private readonly isForm:boolean;
  /** How far the body dips after touching down, in metres: the depth of the
   *  landing, the shape of it, and how long ago the soles arrived. */
  private landDip=0;
  private landPeak=0;
  private landAge=0;
  private landHeld=false;
  /** How long the body has been on the floor. A landing has a short window
   *  in which the clip is still unwinding a tucked pose, and a sole through
   *  the tile in that window is corrected at once rather than at the pace a
   *  sustained stance error is. */
  private sinceGrounded=0;
  /** The clip and clock last drawn, for the loop-wrap blend above `sampleActivePose`. */
  private loopAction:THREE.AnimationAction|null=null;
  private loopTime=0;
  /** Where the gaze is, in the fighter's frame, eased: see aimHead. */
  private aimYaw=0;
  private aimPitch=0;
  /** The lowest sole's running minimum over about a stride: see supportTransition. */
  private strideFloor=Infinity;
  /** How much of a held chamber the swing is in, eased; drives the tremor. */
  private chargeHold=0;
  private chargeWanted=0;
  /** The held-pose layer: the animation's own speed, how long it has been
   *  still, the layer's weight, how much of it is the charge rather than the
   *  recovery, and its clock. See `holdLife`. */
  private animSpeed=0;
  private holdJoints?:Set<THREE.Object3D>;
  private stillFor=0;
  private stillHeld=false;
  private holdWeight=0;
  private holdCharge=1;
  private holdClock=0;
  /** The blows the reaction layer is still answering: when each landed, the
   *  world heading it travelled (horizontal, unit), which side it turns the
   *  body to, how hard, and how heavy (see HIT_HEAVY), and when it was
   *  withdrawn (Infinity until it is: see `withdraw`). A ring of HIT_RING.
   *  See HIT_REACT. */
  /** `stand`: the dream loop's standing fold (DREAM_STAND) that `scale` carries, or 1. */
  private hits:{at:number;hx:number;hz:number;side:number;scale:number;heavy:number;gone:number;stand?:number}[]=[];
  private hitCursor=0;
  private hitCount=0;
  private reactTime=0;
  /** The wall time the current frame will add to `reactTime` once `hitReact` runs, for what reads the clock before it. */
  private reactAhead=0;
  /** Contact (see TORSO_RADIUS): the blows that reached this body where it is
   *  drawn, newest last; how far the body is pushed off them now and how far
   *  it was drawn pushed last frame; and the blow's own shove - when it
   *  started, how far, which way. */
  private touches:Touch[]=[];
  readonly push=new THREE.Vector3();
  private pushDrawn=new THREE.Vector3();
  /** How much further the push may still rise this frame (see PUSH_RISE). */
  private pushBudget=0;
  private sellAt=-10;
  private sellAmount=0;
  /** How long this shove takes to ease off (SELL_SETTLE, or a string stage's SELL_SETTLE_STRING). */
  private sellSettle=SELL_SETTLE;
  private sellNow=0;
  private sellDir=new THREE.Vector3();
  /** Round 103 (STRIKE_PLANT): how much of a striker's sole planting is on - bringing soles down, and up. */
  private plantLower=0;
  private plantRaise=0;
  /** When the blow the shove belongs to was withdrawn (see `withdraw`). */
  private sellGone=Infinity;
  /** The middle-finger (or index) bone of each hand, right first, where the
   *  rig has fingers: a fist lands with its knuckles. Found on first use. */
  private knuckles?:(THREE.Object3D|undefined)[];
  /** Contact on and off, for the probes that measure what it adds. */
  static contact=true;
  /** Touches, newest last, for CombatEffects (see TouchMark). */
  static readonly touchLog:TouchMark[]=[];
  private static touchSerial=0;
  /** The hips' push back along a heavy blow and their sink, last frame, and
   *  the ankles as the clip had them before it (see HIP_SHOVE). */
  private hipShove=new THREE.Vector3();
  private shoveAnkles=[new THREE.Vector3(),new THREE.Vector3()];
  private legAnkles=[new THREE.Vector3(),new THREE.Vector3()];
  /** The corkscrew's turns and direction (see LAUNCH_SPIN), and the landing:
   *  when it came, how hard, and the pose it lands in (see LAND_BOUNCE). */
  private launchSpin=0;
  private landedAt=-1;
  private landSpeed=0;
  /** Ground hits: the share of the landing's roll it rolls (FLOOR_BOUNCE_ROLL for a blow on a body on the floor). */
  private landRoll=1;
  private wasLaunched=false;
  private launchFall=0;
  /** Stagger steps (see STEP_SPEED): how far in they are, and each foot's
   *  anchor on the floor, the swing it is in (-1: planted) and where from. */
  private staggerWeight=0;
  private staggerAt=[new THREE.Vector3(),new THREE.Vector3()];
  private staggerFrom=[new THREE.Vector3(),new THREE.Vector3()];
  private staggerSwing=[-1,-1];
  private staggerTarget=[new THREE.Vector3(),new THREE.Vector3()];
  /** Where the root was last frame, and the travel since, per second. */
  private staggerRoot=new THREE.Vector3(NaN,NaN,NaN);
  private staggerGathered=0;
  private staggerVelocity=new THREE.Vector3();
  /** The launch in flight: when it began, the heading, the fastest rise seen
   *  (to read how far through the arc the body is), and its weight. */
  private launchAt=-1;
  private launchHeading=new THREE.Vector3();
  private launchRise=0;
  private launchWeight=0;
  /** The pitch the clip had the body at when the launch began, and the
   *  whole turns it goes over on the way down. */
  private launchFrom=NaN;
  private launchTurns=0;
  private launchArc=0;
  /** The roster-wide motion pass (see LAUNCH_SIDE): the side of the turn the landing is on (1: head first along the
   *  throw, -1: feet first); the pitch it lands at, and the one it was last drawn at in flight; and when the hand-back
   *  began (-1: none under way) and how long it holds. */
  private launchSide=1;
  private launchLand=NaN;private launchDrawn=NaN;
  /** The landing's rebound drawn this frame (LAND_BOUNCE), which FLOOR_GUARD lifts on top of, not instead of; and how
   *  far the clip alone had the soles under the floor (lifted out whatever the layer then does: a roll lifting the legs
   *  is no reason to leave the body in the floor). */
  private bounceDrawn=0;private clipUnder=0;
  private handAt=-1;private handHold=0;
  /** FLOOR_GUARD's bodies: thrown off their feet - launched, down, getting up off the floor - over the floor they left. */
  private thrown(state:PlayerState){
    return state.alive&&!this.ragdoll&&(state.action==='launched'||state.action==='knockdown'||state.action==='getup'&&!this.standingRise)&&state.y>=this.groundY-.05;
  }
  /** Round 3e (REACT): what the launch in flight was doing to the body on the
   *  frame a blow launched it again - its tumble, its corkscrew, and the raw
   *  jack-knife, head lag, limb swing and trail - which the new launch starts
   *  from instead of from nothing (see `takeBlow`). A juggle hit reset all of
   *  them in one frame: a body half way through its turn was stood upright,
   *  the third blind critic's 133-178 cm one-frame jumps of a hand. */
  private launchCarry=0;
  /** Round 3e (REACT, for VARIETY): the rise the arc is guessed at until the
   *  body's own is read (LAUNCH_RISE_GUESS, or the blow's outcome's lift). */
  private launchGuess=LAUNCH_RISE_GUESS;
  /** v70: the flight is a launcher's throw (ImpactDetail.lift), timed by its lift rather than the rise it is seen to make. */
  private launchLed=false;
  private spinCarry=0;
  private readonly launchLast=[0,0,0,0];
  private readonly launchHeld=[0,0,0,0];
  private lastSpin=0;
  /** The striking arm's elbow-to-hand span this frame, in forearm lengths;
   *  0 when nothing is stretching. For the tests and the evidence. */
  private rubberSpan=0;
  /** The line each hand is stretched along once the fist has arrived. */
  private rubberLine=[new THREE.Vector3(),new THREE.Vector3()];
  private rubberLocked=[false,false];
  /** What the stretch last added - each hand's offset and the body's give,
   *  in world metres - the move it belongs to, and how long it has been
   *  coming back since that move let go of it (-1: it is not). */
  private rubberOffset=[new THREE.Vector3(),new THREE.Vector3()];
  private rubberGive=new THREE.Vector3();
  /** Round 3d (PACE): how much of the accent give is drawn, eased (see
   *  `rubberLimbs`). */
  private rubberGiven=0;
  private rubberEpoch=-1;
  private rubberRelease=-1;
  /** What the tumble last added at the hips, for the hand-back. */
  private launchPitch=0;
  /** The stance mixed under a move's spent tail: how much, since when, and
   *  where in the idle clip it is. See TAIL_AFTER. */
  private tailWeight=0;
  private tailSince=0;
  private tailTime=0;
  private idleClip?:THREE.AnimationClip;
  /** The idle's clip director and life layer; see src/render/idle/life.ts. */
  private idleRig?:IdleRig;
  /** How much floor there is in front of the fighter before the opponent's
   *  body, smoothed, for the root clamp. Infinity with nobody to hit. */
  private roomAhead=Infinity;
  /** The forward cap as drawn, opening no faster than ROOM_RELEASE, and the
   *  move it belongs to (see `limitRootMotion`). */
  private capDrawn=Infinity;
  private capEpoch=-1;
  /** Round 3e (REACT): the move the root's fall was last limited in (see
   *  ROOT_FALL_RATE). */
  private fallEpoch=-1;
  private rootFalling=false;
  /** The same, measured against the opponent's body as drawn. */
  private roomBody=Infinity;
  /** A replacement body's standing offset, measured over its own idle, and
   *  the recent minima of its hover and its penetration that the per-frame
   *  correction is allowed to act on. */
  private formHover=0;
  private formFloat=0;
  private formSink=0;
  /** How far the lowest sole was off the floor last frame, measured on the
   *  finished pose by `supportTransition`. */
  private soleGap=0;
  /** The lift currently applied to put the feet on the floor. Rate limited,
   *  because it feeds the foot planter's own idea of where the ground is. */
  private support=0;
  private fallSpeed=0;
  private wasGrounded=true;
  private previousY=0;
  private previousVelocity=new THREE.Vector3();
  /** How fast the body is travelling, in metres a second. Read by the camera,
   *  which leads the shot with it rather than chasing the body. */
  readonly velocity=new THREE.Vector3();
  private leanRoll=0;
  private leanTilt=new THREE.Vector3();
  /** How far the legs are turned away from the aim, for a step that is not
   *  straight ahead. The chest is counter-turned so the aim survives it. */
  private hipYaw=0;
  /** The heading the feet are travelling, latched while the body is moving.
   *  atan2(0,0) is zero, so a frame that happened to see no movement used to
   *  read as "due north" and invert the whole run cycle for a frame. */
  private runBearing=0;
  /** How fast the drawn body is turning, in radians a second. The hips lead a
   *  turn by it, and a snap is not allowed to drag them round with it. */
  private turnRate=0;
  /** Round 4b (COMBAT): the blind critic saw the first blow of a string turn its thrower 53-64 degrees in one frame
   *  when they were not already facing the target (Kenzo, Gummy, Nigo, Konta, LORD ORO): the simulation aims the swing
   *  on the tick it starts, and the drawn body chased that at 28 rad/s - a 30 fps frame is a whole snap. A new attack
   *  that has to turn now turns over ATTACK_TURN_FRAMES of wall time (three to five sixtieths, by how far), eased in
   *  and out, toward wherever the simulation is aiming it as it goes; the blow lands after it has. */
  private turnFrom=0;private turnAge=0;private turnOver=0;private turnMove=-1;
  private attackTurn(state:PlayerState,diff:number,real:number){
    if(!ATTACK_SLOTS.has(state.action)){this.turnMove=-1;return undefined;}
    if(state.actionStarted!==this.turnMove){
      this.turnMove=state.actionStarted;this.turnAge=0;
      this.turnOver=Math.abs(diff)<ATTACK_TURN_MIN?0:THREE.MathUtils.clamp(Math.abs(diff)/ATTACK_TURN_RATE,ATTACK_TURN_FRAMES[0]/60,ATTACK_TURN_FRAMES[1]/60);
      this.turnFrom=this.group.rotation.y;
    }
    if(this.turnAge>=this.turnOver)return undefined;
    this.turnAge=Math.min(this.turnOver,this.turnAge+real);
    const toward=Math.atan2(Math.sin(state.yaw-this.turnFrom),Math.cos(state.yaw-this.turnFrom)),k=THREE.MathUtils.smoothstep(this.turnAge/this.turnOver,0,1);
    const want=this.turnFrom+toward*k;
    return Math.atan2(Math.sin(want-this.group.rotation.y),Math.cos(want-this.group.rotation.y));
  }
  /** Nought running forward, one backing away, eased between. The two hip
   *  targets are 1.5 rad apart, so switching between them slewed the hips
   *  through eighty-seven degrees in a single frame. */
  private reverseBlend=0;
  /** Below the slow threshold a fighter walks; above the fast one they run.
   *  Two thresholds, because one makes the clip flicker at the boundary. */
  private walking=false;
  /** The victory's entry (VICTORY_ENTRY) has played: its loop is on. */
  private victoryHeld=false;
  /** Whether this action has connected with anything yet. A swing that never
   *  does over-commits on the way out. */
  private struck=false;
  /** The procedural layer on top of the clips: lean, recoil, slide, landing
   *  and the turned legs of a step that is not straight ahead. Off for the
   *  tests that measure a clip's own pose against a hand-driven mixer, which
   *  is a question about the animation rather than about this. */
  dynamics=true;
  private fallback=new THREE.Vector3();
  private groundY=0;
  private heldWeapons:THREE.Object3D[]=[];
  private madakeBodies:THREE.Object3D[]=[];
  private tokanMeshes=new Map<string,THREE.Object3D>();
  private wardSheath:THREE.Object3D[]=[];
  private awakenOn:THREE.Object3D[]=[];
  /** The shop's outfit this body wears (economy/outfits.ts): its id, and what it changes - another body, or the
   *  hair and aura of a form on this one. */
  outfitId?:string;
  /** The fighter this body was built as. `state` is the snapshot's, replaced every frame, so it cannot say: a
   *  player whose fighter changes under the same id (a session's bots are numbered afresh; the sparring bot is
   *  drawn again) keeps this body's model and clips while the server plays the new fighter's moves. */
  readonly bodyFighter:FighterId;
  private outfit?:OutfitDef;
  /** An outfit's hair, worn all the time (not only awakened), and its gold awakening eyes with it. */
  private crownAlways={value:0};
  private irisAlways={value:0};
  private awakenOff:THREE.Object3D[]=[];
  private spiritHands:THREE.Mesh[]=[];
  /** Round 4b (FANIM): a spirit drawn for its user (SwordSpiritEffects), which throws the light string its user commands. */
  isSpirit=false;
  private faceExpressions:{weights:number[];index:number;value:number}[]=[];
  /** Round 3e (MODELS2): morph targets named 'awaken-tuck' (Taisei's fused hair drawn in under the gold awakening hair), set with the swap. */
  private awakenTuck:{weights:number[];index:number}[]=[];
  /** Round 3e (MODELS2): hand bones drawn at HAND_SCALE after the pose (look/proportions.ts). */
  private scaledHands:THREE.Bone[]=[];private handScale=1;
  /** Round 4b (FANIM): a held weapon's hand closed round it after the pose (look/grip.ts). */
  private grips:{bone:THREE.Bone;target:THREE.Quaternion}[]=[];
  /** Launch day (rfhands): the hands of a body whose clips leave the fingers as the mesh was modelled, posed (look/hands.ts). */
  private hands?:HandLayer;
  /** `form` marks a transformation's body. It is a different mesh at a
   *  different scale from the fighter it belongs to, so it takes the runtime's
   *  automatic height unless its own authored normalization is explicit. Using
   *  the base body's normalization for a different form was what
   *  put Shirokane's Guardian half again above Shiden's at the same formScale. */
  constructor(state:PlayerState,source:GLTF,form=false,rush?:THREE.AnimationClip[],outfit?:string){
    this.outfitId=outfit;this.bodyFighter=state.fighter;this.outfit=form?undefined:outfitFor(outfit,state.fighter);
    this.crownAlways.value=this.outfit?.variant?.always?1:0;this.irisAlways.value=this.outfit?.variant?.goldHair?1:0;
    this.isForm=form;this.state=state;this.source=source;this.group.name=`fighter-${state.id}`;this.model=clone(source.scene);shareSkeletons(this.model);this.group.add(this.model);
    // A body's joints are read whether it is drawn or not (another body's contact against a spirit between its summons,
    // the sockets, the camera): the scene's matrix pass, which leaves hidden things alone, keeps walking it (hiddenMatrices.ts).
    passWhileHidden(this.group);
    this.clips=source.animations;this.mixer=new THREE.AnimationMixer(this.model);
    const remove:THREE.Object3D[]=[];
    const boneNames:string[]=[];
    this.model.traverse(o=>{if((o as THREE.Bone).isBone){this.bones.set(clean(o.name),o as THREE.Bone);boneNames.push(o.name);}if((o as THREE.Camera).isCamera||(o as THREE.Light).isLight||/icosphere/i.test(o.name))remove.push(o);});
    // Canonical joint -> this rig's bone. The rigs disagree about spelling -
    // `Hips`, `DEF_Pelvis`, `mixamorig:Hips_01` are the same joint - and
    // asking for a spelling directly returns undefined on the third one
    // without raising anything.
    for(const [canonical,actual] of resolveSkeleton(boneNames)){
      const found=this.bones.get(clean(actual));
      if(found)this.joints.set(canonical,found);
    }
    if(state.fighter==='tokan'){
      const saber=this.model.getObjectByName('RHand_Weapon1_040');if(saber)this.joints.set('TokanSaber',saber as THREE.Bone);
      for(const name of ['Tokan_Closed_Left','Tokan_Open_Left','Tokan_Closed_Right','Tokan_Open_Right','Tokan_Frostbite_Cut']){const mesh=this.model.getObjectByName(name);if(mesh)this.tokanMeshes.set(name,mesh);}
      {const own=this.model.getObjectByName('weapon_icesabre_hand_R');if(own&&!this.tokanMeshes.has('Tokan_Frostbite_Cut'))this.tokanMeshes.set('Tokan_Frostbite_Cut',own);}
    }
    if(state.fighter==='madake')this.model.traverse(o=>{if(/^madake_hands_(open|fists|spread|thumb)$/.test(o.name))this.madakeBodies.push(o);});
    this.clips=characterClips(this.model,source.animations,state.fighter,this.joints,form);
    // The rush stages' own clips, where the fighter has an animation file for
    // them. Appended, so a name the body already answers to keeps the body's.
    // (A worn form is handed its fighter's combo enders' takes here instead: see attachForm.)
    this.clips=appendClips(this.clips,rush);
    // Round 3e (REACT): borrowed reactions on this rig's own bone lengths.
    if(!form)this.clips=rigidReactions(this.clips,this.joints);
    // Engine VOL.7, step four: the clips written down for this body, where it carries the ones they were written for.
    this.clipMap=Fighter.clipMaps?clipMapFor(state.fighter,form,this.clips):undefined;
    remove.forEach(o=>o.removeFromParent());
    // Round 3: the idle profile's own loop where it names one, and the life
    // layer and fidgets on top (src/render/idle). Not on a transformation's
    // body, which is a different rig with clips of its own.
    const profile=form?undefined:IDLE_PROFILES[state.fighter]??DEFAULT_IDLE,named=(name?:string)=>name?this.clips.find(c=>c.name===name):undefined;
    const idle=this.clip('stance');
    if(profile)this.idleRig=new IdleRig(profile,this.joints,named(profile.clip)??this.clipFor({...state,action:'idle'}),(profile.fidgets??[]).map(named).filter((clip):clip is THREE.AnimationClip=>!!clip),hashSeed(state.id+':'+state.fighter),named(profile.ready));
    // Launch day (rfhands): read before any clip is on, while the bones are as the file has them. (Not another body worn as an outfit.)
    {const row=HANDS.on&&!this.outfit?.model?handRow(state.fighter):undefined;if(row){const hands=new HandLayer(row,form,this.joints,this.model,idle);if(hands.rigs.length)this.hands=hands;}}
    if(idle){this.active=this.mixer.clipAction(idle);this.active.play();this.mixer.update(0);}
    const animated=new Set<THREE.Object3D>();
    for(const clip of this.clips)for(const track of clip.tracks){const parsed=THREE.PropertyBinding.parseTrackName(track.name);const node=this.nodeNamed(parsed.nodeName);if(node&&node!==this.model)animated.add(node as THREE.Object3D);}
    for(const node of animated)this.addPoseNode(node);
    // (A finger no clip keys is blended like the ones a clip does.)
    if(this.hands)for(const bone of this.hands.bones)if(!this.poseByNode.has(bone))this.addPoseNode(bone);
    this.previousPosition.set(state.x,state.y,state.z);
    this.model.updateMatrixWorld(true);
    this.model.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)(o as THREE.SkinnedMesh).computeBoundingBox();});
    this.selectShakugoArms(state);this.selectOyashioHands(state);this.selectSenkoHands(state);this.selectTokanMeshes(state);this.selectHighsunSunhammer(state);this.selectShakudoBlade(state);this.selectMadakeBody(state);
    const box=Fighter.silhouette(this.model);const size=box.getSize(new THREE.Vector3());const height=(this.outfit?.model?this.outfit.height:undefined)??FIGHTERS[state.fighter].height??1.7;
    // (Another body brings its own placement, or none: it is measured as it comes.)
    const normalization=companionPlacement(state)??(form?FIGHTERS[state.fighter].formNormalization:this.outfit?.model?this.outfit.normalization:FIGHTERS[state.fighter].normalization);
    const sized=normalization||this.outfit?.model?undefined:stanceSize(state,form);
    if(normalization){
      // A replacement body on the same rig keeps its authored gameplay origin.
      // Recentering a different hair/cloth silhouette would shift every strike.
      this.model.scale.setScalar(normalization.scale);this.model.position.fromArray(normalization.position);
    }else{
      const scale=sized?sized/this.model.scale.x:height/Math.max(.01,size.y);this.model.scale.multiplyScalar(scale);this.model.position.y-=box.min.y*scale;
      this.model.position.x-=((box.min.x+box.max.x)/2)*scale;this.model.position.z-=((box.min.z+box.max.z)/2)*scale;
    }
    this.model.updateMatrixWorld(true);
    const garment=state.fighter==='nigo'&&[...this.bones.keys()].some(name=>name.startsWith('detailbone'))?'nightfall':GARMENT[state.fighter]??state.fighter;
    this.secondary=new SecondaryMotion(this.model,garment);
    this.model.traverse(o=>{if((o as THREE.Mesh).isMesh&&/iron-pointing-hand|iron_closed_Right/.test(o.name))this.spiritHands.push(o as THREE.Mesh);});
    this.model.traverse(o=>{if(o.name.includes('equipment-held'))this.heldWeapons.push(o);});
    if(state.fighter==='ward')this.model.traverse(o=>{if(/^weapon_lancet_sheath/.test(o.name))this.wardSheath.push(o);});
    this.model.traverse(o=>{
      if(!(o as THREE.Mesh).isMesh)return;
      if(o.name.startsWith('awaken-on'))this.awakenOn.push(o);
      else if(o.name.startsWith('awaken-off'))this.awakenOff.push(o);
    });
    for(const mesh of this.awakenOn)mesh.visible=!!this.outfit?.variant?.goldHair;
    for(const mesh of this.awakenOff)mesh.visible=!this.outfit?.variant?.goldHair;
    this.model.traverse(o=>{const m=o as THREE.Mesh;const index=m.isMesh?m.morphTargetDictionary?.['awaken-tuck']:undefined;if(index!==undefined&&m.morphTargetInfluences)this.awakenTuck.push({weights:m.morphTargetInfluences,index});});
    const meshes:THREE.Mesh[]=[];this.model.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
    if(state.fighter==='gummy'&&form){
      this.laughFace=meshes.find(m=>m.name==='g5-laugh'||m.geometry?.name==='g5-laugh'||m.parent?.name==='g5-laugh');
      const json=(this.source as GLTF&{parser?:{json?:{nodes?:{name?:string;mesh?:number}[];meshes?:{name?:string}[]}}}).parser?.json;
      const node=json?.nodes?.find((n:{name?:string;mesh?:number})=>n.mesh!==undefined&&/^face_normal/.test(json.meshes?.[n.mesh]?.name??''))?.name;
      this.plainFace=node?this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(node)):undefined;
      if(this.laughFace)this.laughFace.visible=false;
    }
    if(state.fighter==='gummy'&&!this.outfit){
      // Round 5 (GUMMY): his palms where the body carries them, and the fists they stand in for; and SUNRISE floats
      // where its own float takes are bound (gummy/sunrise.ts).
      for(const side of ['L','R'] as const){const open=this.model.getObjectByName(openHandName(form?'gummy-g5':'gummy',side)),fist=closedFist(this.source,this.model,side);if(open&&fist){this.openHands.push(open);this.fists.push(fist);this.openSides.push(side);}}
      this.floating=form&&this.clips.some(c=>c.name===SUNRISE_FLOAT.idle);
      for(let i=0;i<state.id.length;i++)this.floatPhase=(this.floatPhase*31+state.id.charCodeAt(i))%997;
    }
    {
      // Resolved rather than spelled. This was `bones.get(taisei ? 'defpelvis' :
      // 'hips')`, which is two of the three spellings in the roster and none
      // of the ones a Mixamo export uses - and an undefined pelvis takes the
      // foot planting and every procedural layer with it, silently.
      this.pelvis=this.joints.get('Hips')??this.bones.get(state.fighter==='taisei'?'defpelvis':'hips');
      // The rest pose is the position the clamp pulls back toward.
      this.rootBone=this.pelvis;
      if(this.rootBone){this.model.updateMatrixWorld(true);this.group.worldToLocal(this.rootBone.getWorldPosition(this.rootReference));
        this.rootSiblings=(this.rootBone.parent?.children??[]).filter(child=>child!==this.rootBone&&(child as THREE.Bone).isBone) as THREE.Bone[];
        this.rootChain.add(this.rootBone);for(const sibling of this.rootSiblings)this.rootChain.add(sibling);
        for(let node=this.rootBone.parent;node&&node!==this.model;node=node.parent)if(this.poseByNode.has(node))this.rootChain.add(node);}
      // Sample the boot surface hull once. This is only evaluated during a
      // grounded pose transition; it never shifts a sampled attack contact.
      for(const mesh of meshes){
        // Whole-body hand variants share identical boot geometry; sample one support hull only.
        if(state.fighter==='madake'&&mesh.name!=='madake_hands_open'&&!originalBody('madake'))continue;
        const skinned=mesh as THREE.SkinnedMesh;if(!skinned.isSkinnedMesh)continue;
        const positions=skinned.geometry.attributes.position,indices=skinned.geometry.attributes.skinIndex,weights=skinned.geometry.attributes.skinWeight;
        const feet=new Map<number,number[]>();
        for(let i=0;i<positions.count;i++)for(let j=0;j<4;j++){const bone=indices.getComponent(i,j);if(weights.getComponent(i,j)>.2&&/^(def(foot|toe)|(left|right)(foot|toebase))/.test(clean(skinned.skeleton.bones[bone].name))){if(!feet.has(bone))feet.set(bone,[]);feet.get(bone)!.push(i);}}
        const selected=new Set<number>();
        for(const vertices of feet.values())for(let direction=0;direction<48;direction++){
          const y=1-2*(direction+.5)/48,r=Math.sqrt(1-y*y),phi=direction*2.399963229728653,axis=new THREE.Vector3(Math.cos(phi)*r,y,Math.sin(phi)*r);
          let best=-Infinity,index=vertices[0];for(const v of vertices){const distance=axis.x*positions.getX(v)+axis.y*positions.getY(v)+axis.z*positions.getZ(v);if(distance>best){best=distance;index=v;}}selected.add(index);
        }
        for(const index of selected)this.supportVertices.push({mesh:skinned,index});
      }
    }
    if(state.fighter==='taisei')for(const mesh of meshes){
      if(!mesh.morphTargetDictionary||!mesh.morphTargetInfluences)continue;
      for(const [name,value] of Object.entries({'Upper eye down L':.4,'Upper eye down R':.4,'Lower eye up L':.1,'Lower eye up R':.1})){
        const index=mesh.morphTargetDictionary[name];
        if(index!==undefined)this.faceExpressions.push({weights:mesh.morphTargetInfluences,index,value});
      }
    }
    const authoredOutline=meshes.some(mesh=>/outline/i.test(mesh.name));
    const inkWidth=FIGHTERS[state.fighter].outlineWidth;
    const headJoint=this.joints.get('Head'),smearRoots=SMEAR_LIMBS.map(name=>this.joints.get(name));
    for(const mesh of meshes){
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
      const skin=mesh as THREE.SkinnedMesh;
      // How much of each vertex rides the head, for the look's softer
      // terminator on faces. Zeros on rigid props, so every fighter geometry
      // carries the attribute the toon shading reads.
      if(!mesh.geometry.hasAttribute('lookHead'))mesh.geometry.setAttribute('lookHead',headWeights(mesh.geometry,skin.isSkinnedMesh?skin.skeleton:undefined,headJoint));
      preserveMinasePaintedFolds(state.fighter,mesh.name,mesh.geometry);
      // The roster-wide motion pass: each vertex's share of the four striking limbs, for the smear frame (SMEAR_LIMBS).
      if(!mesh.geometry.hasAttribute('smearLimb'))mesh.geometry.setAttribute('smearLimb',limbWeights(mesh,smearRoots,heldHand(mesh.name+' '+(mesh.geometry.name??''))));
      if(state.fighter==='gummy'&&skin.isSkinnedMesh&&!skin.geometry.hasAttribute('willWeight')){
        const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,a=new Float32Array(ids.count);
        // Round 4b (GUMMY): both arms - the SUNSET BARRAGE hardens both fists (it was Signal Fire's right).
        for(let i=0;i<a.length;i++)for(let j=0;j<4;j++)if(/^(right|left)(forearm|hand)/.test(clean(skin.skeleton.bones[ids.getComponent(i,j)].name)))a[i]+=weights.getComponent(i,j);
        skin.geometry.setAttribute('willWeight',new THREE.BufferAttribute(a,1));
      }
      // The gold awakening is the same body with gold hair. The crown weight marks
      // the head-bone vertices above the joint - hair, brows and pupils - and
      // the shader finishes the job by only tinting the dark ones, so the face
      // and the gi are untouched. Same trick as Gummy's Will attribute.
      const hairTint=this.outfit?.variant?.hair??AWAKENINGS[state.fighter].hair;
      if(hairTint!==undefined&&skin.isSkinnedMesh&&!skin.geometry.hasAttribute('crownWeight')){
        const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,positions=skin.geometry.attributes.position;
        // Resolved, then spelled. `/^(def)?head$/` is `Head` and `DEF_Head`
        // and nothing else - a Mixamo rig calls it `mixamorig:Head_06`, so
        // this found no head, every crown weight stayed zero, and Taisei
        // awakened with the hair he started with.
        const resolvedHead=this.joints.get('Head');
        const head=resolvedHead?skin.skeleton.bones.indexOf(resolvedHead as THREE.Bone):-1;
        const headIndex=head>=0?head:skin.skeleton.bones.findIndex(b=>/^(def)?head$/.test(clean(b.name)));
        const crown=new Float32Array(ids.count);
        if(headIndex>=0){
          const joint=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(skin.skeleton.boneInverses[headIndex]).invert());
          for(let i=0;i<crown.length;i++){
            if(positions.getY(i)<joint.y+.03)continue;
            for(let j=0;j<4;j++)if(ids.getComponent(i,j)===headIndex)crown[i]+=weights.getComponent(i,j);
          }
        }
        skin.geometry.setAttribute('crownWeight',new THREE.BufferAttribute(crown,1));
      }
      // Faces, hair and held steel keep the blacks they were painted with: a
      // pupil is meant to be a hole, and so is the gap between a sheath and its
      // binding. Everything else on these fighters is cloth.
      const lift=SHADOW_LIFT[state.fighter]&&!FEATURE.test(mesh.name)?SHADOW_LIFT[state.fighter]!:0;
      const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const materials=originals.map(material=>{
        const src=material as THREE.MeshStandardMaterial;
        if(/outline/i.test(mesh.name)){const outline=new THREE.MeshBasicMaterial({color:0x0d1b26,side:src.side});applyAuthoredInk(outline);applyTeamTrim(outline,this.teamTrim,'ink');applyThreatInk(outline,this.threatInk,false);this.outlineMaterials.push(outline);return outline;}
        const mat=new THREE.MeshToonMaterial({map:src.map??null,color:src.color??new THREE.Color(1,1,1),gradientMap:toonGradient,normalMap:src.normalMap??null,normalScale:src.normalScale??new THREE.Vector2(1,1),normalMapType:src.normalMapType??THREE.TangentSpaceNormalMap,bumpMap:src.bumpMap??null,bumpScale:src.bumpScale??1,aoMap:src.aoMap??null,aoMapIntensity:src.aoMapIntensity??1,side:src.side,alphaTest:src.alphaTest||0,transparent:src.transparent,opacity:src.opacity});
        mat.name=material.name;
        // An outfit of a blue (or any) gold awakening: the hair the form swaps in, in the outfit's colour, its shading kept.
        if(this.outfit?.variant?.goldHair&&this.outfit.variant.hair!==undefined&&/gold-hair/i.test(material.name)){
          const hue=new THREE.Color(this.outfit.variant.hair);
          addShaderPatch(mat,'outfit-gold-hair-v1',shader=>{shader.uniforms.uGoldHue={value:hue};shader.fragmentShader='uniform vec3 uGoldHue;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=uGoldHue*clamp(l*1.3,0.0,1.35);}');});
        }
        if(this.outfit?.variant?.palette&&skin.isSkinnedMesh&&!/weapon|room|^glow_|awaken/i.test(`${mesh.name} ${src.name??''}`))applyOutfitPalette(mesh,mat,this.outfit.variant.palette);
        if(state.fighter==='ouga'){mat.emissive=src.color.clone();mat.emissiveMap=src.map??null;mat.emissiveIntensity=.2;}
        if(/^glow_/.test(src.name??'')){const own=(src as THREE.MeshStandardMaterial).emissive,unlit=!own||Math.max(own.r,own.g,own.b)<.02;const map=(src as THREE.MeshStandardMaterial).emissiveMap??null;mat.emissive=(unlit&&!map?src.color:own??src.color).clone();mat.emissiveIntensity=unlit&&!map?.9:1.6;mat.emissiveMap=map;}
        if(isSvanhildPlumage(src.name))svanhildPlumageFlow(mat);
        const baseHair=AWAKENINGS[state.fighter].baseHair;
        if(baseHair!==undefined&&/hair/i.test(material.name??'')){
          const hue=new THREE.Color(baseHair);
          addShaderPatch(mat,'base-hair-v1',shader=>{shader.uniforms.uAwaken=this.awaken;shader.uniforms.uBaseHair={value:hue};
            shader.fragmentShader='uniform float uAwaken;uniform vec3 uBaseHair;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(diffuseColor.rgb,uBaseHair*(.35+.9*l),1.0-clamp(uAwaken,0.0,1.0));}');});
        }
        if(hairTint!==undefined&&skin.isSkinnedMesh){
          const gold=new THREE.Color(hairTint),pale=PALE_CROWN.has(state.fighter);
          // Every shader edit on a fighter goes through addShaderPatch, which
          // chains them: assigning onBeforeCompile used to throw away whichever
          // edit had been installed before.
          // Round 3e (MODELS2): the irises are marked in the texture's alpha
          // (scripts/r3e_models2.py; the material is opaque, so the alpha went
          // nowhere) and turn a gold awakening's teal instead of gold.
          addShaderPatch(mat,pale?'pale-crown-v1':'golden-crown-v2',shader=>{shader.uniforms.uAwaken=this.awaken;shader.uniforms.uCrownAlways=this.crownAlways;shader.uniforms.uIrisAlways=this.irisAlways;shader.uniforms.uGold={value:gold};
            shader.vertexShader='attribute float crownWeight;varying float vCrown;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCrown=crownWeight;');
            shader.fragmentShader='uniform float uAwaken;uniform float uCrownAlways;uniform float uIrisAlways;uniform vec3 uGold;varying float vCrown;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat dark='+(pale?'1.0':'1.0-smoothstep(.10,.32,dot(diffuseColor.rgb,vec3(.299,.587,.114)))')+';\n'+(pale?'':'float iris=(1.0-smoothstep(.5,.8,diffuseColor.a))*clamp(vCrown,0.0,1.0);\ndark*=1.0-iris;\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.02,.58,.46),iris*max(uAwaken,uIrisAlways));\n')+'diffuseColor.rgb=mix(diffuseColor.rgb,uGold,clamp(vCrown,0.0,1.0)*dark*max(uAwaken,uCrownAlways));');});
        }
        if(state.fighter==='gummy'&&skin.isSkinnedMesh){
          addShaderPatch(mat,`gummy-will-v3-${lift}`,shader=>{shader.uniforms.uWill=this.will;shader.vertexShader='attribute float willWeight;varying float vWill;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWill=willWeight;');shader.fragmentShader='uniform float uWill;varying float vWill;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(max(diffuseColor.rgb,vec3(.027)),vec3(.035,.009,.013),smoothstep(.1,.85,vWill)*uWill);'+FLOOR_PATCH(lift));});
        }else if(lift>0){
          addShaderPatch(mat,`garment-floor-v1-${lift}`,shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>'+FLOOR_PATCH(lift));});
        }
        // The look's light model goes on last: coloured ramp, rim, hair
        // highlight and face softening (src/render/look/toonShading.ts).
        applyToonShading(mat,toonKind(mesh.name,material.name));
        if(lensFacingNormals(state.fighter))addShaderPatch(mat,'lens-normal-v1',lensNormalPatch);
        applyTeamTrim(mat,this.teamTrim,'body'); // The side's colour on the rim in a ball match (nothing outside one).
        applyHitFlash(mat,this.flash,this.flashFlat);
        applyHagureCosmicLook(mat,state.fighter,this.isForm);
        applyLimbSmear(mat,this.smear);
        this.outlineMaterials.push(mat);return mat;
      });
      mesh.material=Array.isArray(mesh.material)?materials:materials[0];
      // Round 3e (MODELS2): one side into the shadow map, not both (look/shadowSide.ts).
      if(SHADOW_SIDE_FIGHTERS.has(state.fighter))fixShadowSide(mesh);
      // Preserve a source-authored hull where present; other rigs share this ink
      // treatment. An inverted hull needs solid geometry: on zero-thickness cloth
      // the expanded back face lands in front of the front face and paints black
      // shards over the hem, so a fighter can opt out with outlineWidth 0.
      // A translucent transformation shell has no silhouette line: Ward's
      // ROOM is a sphere around him, and its back-face hull would be an
      // opaque black dome behind him.
      const translucentShell=mesh.name.startsWith('awaken-on')&&originals.some(m=>(m as THREE.Material).transparent&&(m as THREE.Material).opacity<1);
      // And it is seen through, not into: the glTF blend material came with
      // depthWrite off and the toon rebuild turned it back on, so the ROOM's
      // near side hid every transparent thing drawn after it inside the dome -
      // hit sparks included. It stays at renderOrder 0, so the layers drawn
      // under it on purpose (OperatingTheatre, -1 and -2) still are. Nor does a
      // glass sphere cast a solid shadow on the floor round him.
      if(translucentShell){for(const m of materials)m.depthWrite=false;mesh.castShadow=false;}
      if(!authoredOutline&&inkWidth>0&&!translucentShell){
        const outline=new THREE.MeshToonMaterial({color:0x081621,side:THREE.BackSide,depthWrite:false});
        outline.userData.ink=true;
        // The power-up pass (look/powerupLook.ts): a line tinted by what it rings reads its body's map - one material's,
        // so a mesh dressed in several (an atlas each) keeps the plain ink. With no tint (uInkTint 0) it is the plain ink.
        const inkBody=materials.length===1?materials[0] as THREE.MeshToonMaterial:undefined;
        if(inkBody?.isMeshToonMaterial&&inkBody.map)outline.map=inkBody.map;
        // BackSide materials flip transformedNormal; subtract it to expand the shell outward.
        // The hull is also pushed away from the camera. Expanding along the
        // normal alone puts the back face of zero-thickness cloth in front of
        // its front face, which paints black shards across a coat hem; a view
        // -space depth bias keeps the hull behind the surface so it only shows
        // where it should, at the silhouette.
        // The push is now a constant screen width (about 2.2 px at 1080p)
        // with the fighter's outlineWidth as a multiplier on the roster's
        // 3 mm, and the ink colour follows the stage; see applyInkShell.
        applyInkShell(outline,inkWidth/.003,INK_DEPTH_BIAS);applyTeamTrim(outline,this.teamTrim,'ink');preserveAmagoiCloakSurface(outline,state.fighter,mesh.name);applyThreatInk(outline,this.threatInk);applyLimbSmear(outline,this.smear);
        const shell=(mesh as THREE.SkinnedMesh).isSkinnedMesh?new THREE.SkinnedMesh(mesh.geometry,outline):new THREE.Mesh(mesh.geometry,outline);
        shell.name=mesh.name+'-ink';shell.frustumCulled=false;shell.matrixAutoUpdate=false;shell.matrix.identity();shell.castShadow=false;shell.receiveShadow=false;
        shell.morphTargetInfluences=mesh.morphTargetInfluences;shell.morphTargetDictionary=mesh.morphTargetDictionary;
        if((shell as unknown as THREE.SkinnedMesh).isSkinnedMesh){const skinned=mesh as THREE.SkinnedMesh;(shell as unknown as THREE.SkinnedMesh).bind(skinned.skeleton,skinned.bindMatrix);(shell as unknown as THREE.SkinnedMesh).bindMode=skinned.bindMode;}
        mesh.add(shell);this.outlineMaterials.push(outline);
      }
    }
    // Culling bounds for the skinned bodies and their ink (see `cullBounds`), measured in the group's own units
    // from the pose the body has now: the sphere's centre off the hips, and its radius.
    this.group.updateMatrixWorld(true);
    {const unit=this.group.matrixWorld.getMaxScaleOnAxis()||1,hips=new THREE.Vector3(),centre=new THREE.Vector3();
      for(const mesh of meshes){
        const skin=mesh as THREE.SkinnedMesh;if(!skin.isSkinnedMesh)continue;
        if(!skin.boundingBox)skin.computeBoundingBox();
        const box=_cullBox.copy(skin.boundingBox!);if(box.isEmpty())continue;
        const anchor=skin.skeleton.bones.find(bone=>!!bone&&/hips|pelvis/i.test(bone.name))??this.pelvis??skin.skeleton.bones.find(Boolean);if(!anchor)continue;
        box.getCenter(centre).applyMatrix4(skin.matrixWorld);
        const reach=box.getSize(hips).length()/2*skin.matrixWorld.getMaxScaleOnAxis();
        anchor.getWorldPosition(hips);
        const radius=((centre.distanceTo(hips)+reach)*CULL_PAD+CULL_REACH)/unit;
        const sphere=new THREE.Sphere(skin.worldToLocal(hips.clone()),radius*unit/skin.matrixWorld.getMaxScaleOnAxis());
        const shells=skin.children.filter(child=>(child as THREE.SkinnedMesh).isSkinnedMesh&&child.name.endsWith('-ink')) as THREE.SkinnedMesh[];
        for(const each of [skin,...shells]){each.boundingSphere=sphere;each.frustumCulled=true;}
        this.culled.push({mesh:skin,sphere,anchor,radius});
      }
    }
    // Canonical first, then the old spellings, then a suffix match. The
    // suffix pass cannot see `mixamorig:LeftHand_011`, whose name ends in its
    // index rather than in the joint.
    const bone=(patterns:string[],canonical?:string)=>(canonical?this.joints.get(canonical):undefined)
      ??patterns.map(pattern=>this.bones.get(pattern)).find(Boolean)
      ??patterns.map(pattern=>[...this.bones.entries()].find(([name])=>name.endsWith(pattern))?.[1]).find(Boolean);
    // (weapon reach is measured after the hands are known, below)
    this.rightBone=bone(['righthand','handr','rhand'],'RightHand');this.leftBone=bone(['lefthand','handl','lhand'],'LeftHand');
    this.neckBone=bone(['neck','defneck'],'Neck');this.headBone=bone(['head','defhead'],'Head');
    {const g=form?undefined:HAND_GRIP[state.fighter],hand=g?this.joints.get(`${g.side}Hand`):undefined;if(g&&hand)this.grips=gripPlan(hand,g.curl,g.thumb,this.joints.get('Hips'));}
    {const k=form?undefined:HAND_SCALE[state.fighter];if(k!==undefined&&k!==1){this.handScale=k;this.scaledHands=[this.joints.get('LeftHand'),this.joints.get('RightHand')].filter((b):b is THREE.Bone=>!!b);}}
    this.leanChain=[bone(['hips','defpelvis']),bone(['spine','defspine001']),bone(['spine1','defspine002']),bone(['spine2','defspine003'])]
      .filter((joint):joint is THREE.Bone=>!!joint);
    // Foot planting needs a hip, a knee and an ankle per side, and the two
    // rest lengths between them. Measured from the bind pose in world units,
    // so the model's own normalisation scale is already in them.
    this.model.updateMatrixWorld(true);
    for(const side of ['left','right']as const){
      const Side=side==='left'?'Left':'Right';
      const hip=bone([side+'upleg','defthigh'+side[0]],Side+'UpLeg'),knee=bone([side+'leg','defcalf'+side[0]],Side+'Leg'),ankle=bone([side+'foot','deffoot'+side[0]],Side+'Foot');
      if(!hip||!knee||!ankle||knee===hip||ankle===knee)continue;
      const a=hip.getWorldPosition(new THREE.Vector3()),b=knee.getWorldPosition(new THREE.Vector3()),c=ankle.getWorldPosition(new THREE.Vector3());
      const upper=a.distanceTo(b),lower=b.distanceTo(c);
      if(upper<.05||lower<.05)continue;
      const footBones=new Set<THREE.Object3D>();ankle.traverse(node=>footBones.add(node));
      const soles=this.supportVertices.filter(({mesh,index})=>{
        const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
        let influence=0;
        for(let j=0;j<4;j++)if(footBones.has(mesh.skeleton.bones[indices.getComponent(index,j)]))influence+=weights.getComponent(index,j);
        return influence>.35;
      });
      this.legs.push({hip,knee,ankle,upper,lower,planted:false,anchor:new THREE.Vector3(),plantYaw:state.yaw,weight:0,low:0,high:.2,stepped:-10,soles});
      this.legLength=Math.max(this.legLength,upper+lower);
    }
    // A rig that only gave up one leg is not worth half a gait.
    if(this.legs.length!==2)this.legs.length=0;
    this.walkClip=this.clip('walk');
    // What this fighter's own idle does with anything he is holding.
    this.findHeldEquipment(this.clip('ready'));
    this.runClip=this.clipFor({...state,action:'run'});
    // A 3ds Max Biped rig parents the clavicles to the neck, so sharing the aim
    // with the neck would swing both arms and every finger with the gaze. Only
    // let the neck take part when it carries the head alone.
    const carriesArms=(joint?:THREE.Bone)=>{let node:THREE.Object3D|null=joint??null;while(node){if(node===this.neckBone)return true;node=node.parent;}return false;};
    if(carriesArms(this.rightBone)||carriesArms(this.leftBone))this.neckBone=undefined;
    // How far past the hand this fighter's steel reaches. Taken from the
    // geometry rather than from a table: whatever is skinned to the hand and
    // sits furthest from its joint is the blade, and on an empty hand it is a
    // fingertip - about a tenth of a metre, which is below the threshold and
    // leaves the hand as the strike point. Trails and hitsparks were being
    // drawn at the grip while the sword swept a metre and a half of air.
    for(const [hand,store] of [[this.rightBone,'right'],[this.leftBone,'left']] as const){
      if(!hand)continue;
      const inverse=new THREE.Matrix4().copy(hand.matrixWorld).invert();
      // Distances are judged in world metres off the hand's own position.
      // They used to be the hand-local length times the model's scale, which
      // assumes the hand's frame is in metres - and Gaunt's rig carries the
      // Sketchfab scale of 8 on its armature node, so his two-metre blade
      // measured 0.22 and he was never armed.
      const palm=hand.getWorldPosition(new THREE.Vector3());
      let best:THREE.Vector3|undefined,reach=0;
      for(const mesh of meshes){
        const skin=mesh as THREE.SkinnedMesh;
        if(!skin.isSkinnedMesh)continue;
        const named=HELD.test(mesh.name)||HELD.test(skin.geometry?.name??'');
        // Anything rigidly carried by that hand, which may be bound to a prop
        // bone under it rather than to the hand itself - a katana usually is.
        const carried=new Set<number>();
        skin.skeleton.bones.forEach((joint,at)=>{
          for(let node:THREE.Object3D|null=joint;node;node=node.parent)if(node===hand){carried.add(at);break;}
        });
        if(!carried.size)continue;
        const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,positions=skin.geometry.attributes.position;
        const local=new THREE.Vector3(),world=new THREE.Vector3();
        for(let i=0;i<positions.count;i++){
          let held=0;
          for(let j=0;j<4;j++)if(carried.has(ids.getComponent(i,j)))held+=weights.getComponent(i,j);
          // Rigid to the hand, not merely influenced by it: a held prop moves
          // with the hand entirely, while a sleeve or a knuckle is shared.
          if(held<.92&&!named)continue;
          skin.getVertexPosition(i,world).applyMatrix4(skin.matrixWorld);
          local.copy(world).applyMatrix4(inverse);
          const distance=world.distanceTo(palm);
          if(distance>reach&&distance<(named?2.8:1.25)){reach=distance;best=local.clone();}
        }
      }
      // A plausible blade: past the fingers, and not so far that what was
      // found is a coat tail or a strand of hair that happens to be pinned.
      if(best&&reach>.32&&!EMPTY_HANDED.has(state.fighter))(store==='right'?this.rightReach=best:this.leftReach=best);
    }
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.62,24),new THREE.MeshBasicMaterial({color:0x172a32,transparent:true,opacity:.3,depthWrite:false,alphaMap:contactShadowFalloff()}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;shadow.name='contact-shadow';this.group.add(shadow);this.contactShadow=shadow;
    this.group.position.set(state.x,state.y,state.z);this.group.rotation.y=state.yaw;
    if(!form)Fighter.drawn.add(this);
    // Everything above is measured on the body's own idle - its size, the
    // root clamp's reference, the soles, the held weapons' reach - because
    // every table and clip was made against it. The profile's loop takes
    // over only now, so a new idle changes none of them.
    const own=named(profile?.clip);
    if(own&&own!==idle){this.active?.stop();this.active=this.mixer.clipAction(own);this.active.play();this.mixer.update(0);}
  }
  /** Every fighter being drawn. A swing stops at the body it swings at as
   *  that body is DRAWN - staggered, launched, lunging back - and not only
   *  where the simulation holds it; see `limitRootMotion`. A transformation's
   *  body is reached through the fighter it belongs to. */
  private static readonly drawn=new Set<Fighter>();
  /** The middle of the body as it is drawn this frame, in world space: half
   *  way from the hips to the base of the neck, or the replacement form's
   *  while one stands in. The group is where the simulation holds the
   *  fighter; a launch, a knockback clip or a lunge can put the body a metre
   *  or more from it, and anything that has to sit ON the body - the lock-on
   *  marker, a name tag, a hit spark - wants this rather than the group. */
  visualCenter(out:THREE.Vector3):THREE.Vector3{
    if(this.awakenedForm?.group.visible&&!this.model.visible&&!this.worn)return this.awakenedForm.visualCenter(out);
    const hips=this.pelvis,top=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
    if(!hips)return out.copy(this.group.position).addScaledVector(UP,1.1);
    hips.getWorldPosition(out);
    return top?out.lerp(top.getWorldPosition(_centerTop),.5):out;
  }
  /** The middle of the body as it would be drawn without the contact push
   *  (see TORSO_RADIUS): what another fighter's swing measures its room
   *  against, so a body pushed off a fist does not hand that fist more room
   *  to push it further. */
  restCenter(out:THREE.Vector3):THREE.Vector3{return this.visualCenter(out).sub(this.push);}
  /** The body being drawn for this fighter: a replacement form's while one
   *  stands in, else its own. A worn shell leaves the fighter drawn. */
  private drawnBody():Fighter{return this.awakenedForm&&this.awakenedForm.group.visible&&!this.model.visible?this.awakenedForm:this;}
  /** The body drawn now: the form's, while it shows (EmperorEffects copies it for False Encore's illusion). */
  get shownBody():Fighter{return this.drawnBody();}
  /** The displayed source clock, shared with native command-driven limbs. */
  get displayedClipName():string|undefined{return this.shownBody.active?.getClip().name;}
  get displayedClipTime():number{return this.shownBody.active?.time??0;}
  /** The same receiver for visible grown limbs and their contact surface. */
  get displayedOpponent():Fighter|undefined{return this.opponentBody();}
  /** The joint of the body being drawn: the form's while a transformation's body stands in for this one. An aura's
   *  crown burns round KOMAINU's head, two and a half metres up, not the boy's he has outgrown. */
  drawnJoint(name:string){return this.drawnBody().joints.get(name)??this.joints.get(name);}
  /** A summoned shell the fighter stands inside, rather than a body that
   *  replaces him. */
  private get worn(){return AWAKENINGS[this.state.fighter].formTint!==undefined;}
  /** The drawn body this fighter's target point belongs to, if one is being
   *  drawn: whoever stands nearest the point, within OPPONENT_MATCH. */
  private opponentBody():Fighter|undefined{
    const point=this.targetPoint??this.owner?.targetPoint;
    if(!point)return undefined;
    const self=this.owner??this;
    let best:Fighter|undefined,nearest=OPPONENT_MATCH*OPPONENT_MATCH;
    for(const other of Fighter.drawn){
      if(other===self)continue;
      const dx=other.group.position.x-point.x,dz=other.group.position.z-point.z,d=dx*dx+dz*dz;
      if(d<nearest){nearest=d;best=other;}
    }
    return best;
  }
  static readonly REACTIONS:Record<string,string[]>={
    flinch:['shake','electric_shock','Hit 01','Hit','Hurt'],
    // Nothing in the roster ships a wall splat, so it borrows the slam, which
    // is a body stopping against something and reads correctly for it.
    splat:['slammed','ultimate-ground-impact','Hit 01','Hit','Hurt'],
    hurt:['Hit 01','Hit','Hurt'],
    launched:['slammed','blownback','ultimate-knockback-air','Jump Fall','Hit 01','Hit'],
    knockdown:['down_lp','down_end','ultimate-ground-impact','Die fall','Hit 01'],
    getup:['down_end','blownback_end','_Idle','Idle'],
    stun:['stun','shake','Hit 01','Hit'],
    // Dying: a body driven into the floor. `Die fall` is the obvious name and
    // the wrong clip - measured across the roster its hips drop 0.03 m on six
    // of the ten rigs and finish at standing height, so most of the cast died
    // on their feet. `slammed` exists on all ten and finishes within a
    // centimetre or two of the downed pose, which is what makes the hold that
    // follows it continuous.
    defeated:['slammed','Die fall','ultimate-ground-impact','Hit 01'],
    // Lying there. `down_lp` is a single-frame hold; where a rig ships no loop
    // the opening frame of the get-up is the same body on the same floor.
    downed:['down_lp','down_end','slammed'],
  };
  /** Engine VOL.7, step four: the clips the renderer reaches for by moment, by key - each body's clip map
   *  (src/engine/client/clips.ts) says which clip it plays for each, and a body the map was not written for finds it by
   *  these names, as findClip finds one (the first pattern any clip answers to). A rule with no names does not apply to
   *  the fighter (or its form). scripts/engine/clipMap.mts writes the maps from them (`ruledClips`). */
  static readonly CLIP_RULES:Readonly<Record<string,(fighter:FighterId,form:boolean)=>readonly string[]>>={
    stance:fighter=>fighter==='taisei'?['02-STANCE','stance','idle']:['_Idle','Idle'],
    ready:fighter=>fighter==='taisei'?['taisei-ready','02-STANCE','stance','idle']:['_Idle','Idle'],
    rest:()=>['_Idle','Idle'],
    walk:()=>['Walk'],
    rise:fighter=>fighter==='taisei'?['adapted_jump']:['jump'],
    fall:fighter=>fighter==='taisei'?['adapted_jump_fall']:['Jump Fall'],
    spin:fighter=>fighter==='taisei'?['adapted_jump_spin']:['Jump spin'],
    hit:fighter=>fighter==='taisei'?['adapted_hit']:['Hit 01'],
    stagger:()=>['shake'],
    daze:()=>['stun','shake'],
    knockback:()=>['ultimate-knockback-air','slammed','blownback','Jump Fall'],
    'ground impact':()=>['ultimate-ground-impact'],
    abdomen:()=>['heavy-abdomen-fold'],
    pressure:()=>['beam-pressure-recovery'],
    ...Object.fromEntries(Object.entries(Fighter.REACTIONS).map(([name,patterns])=>[`reaction ${name}`,()=>patterns])),
    opener:(fighter,form)=>{const opener=form?ULTIMATE_CLIPS[fighter]?.formOpener:ULTIMATE_CLIPS[fighter]?.opener;return opener?[opener.clip]:[];},
    command:(fighter,form)=>!form&&SPIRIT_COMMAND[fighter]?[SPIRIT_COMMAND[fighter]!]:[],
    'float idle':(fighter,form)=>fighter==='gummy'&&form?[SUNRISE_FLOAT.idle]:[],
    'float run':(fighter,form)=>fighter==='gummy'&&form?[SUNRISE_FLOAT.run]:[],
    'float guard':(fighter,form)=>fighter==='gummy'&&form?[SUNRISE_FLOAT.guard]:[],
    ...Object.fromEntries(TAISEI_MELEE_CONTACTS.map((entry,i)=>[`melee ${i}`,(fighter:FighterId)=>fighter==='taisei'?[entry.clip]:[]])),
    'adapted light':fighter=>fighter==='taisei'?['adapted_light']:[],
    'adapted heavy':fighter=>fighter==='taisei'?['adapted_heavy']:[],
    // The dream loop, round 28: the authored hurts (DREAM_HURTS) and flinch.
    ...Object.fromEntries(Object.entries(DREAM_HURTS).map(([key,name])=>[key,()=>[name]])),
    'dream flinch':()=>[DREAM_FLINCH],
    ...Object.fromEntries(DREAM_STAGES.map((name,i)=>[`dream rush ${i+1}`,()=>[name]])),
    // The dream loop, round 42: an ender's authored take where the body has one - `DZ <its own take>` (dream_enders.py).
    ...Object.fromEntries(COMBO_KEYS.map(key=>[`dream ender ${key}`,(fighter:FighterId,form:boolean)=>{const own=form?undefined:comboClip(fighter,key);return own?[`DZ ${own.clip}`]:[];}])),
  };
  /** The actions a clip map writes down, each as clipFor draws it standing (`ruledClip`). */
  static readonly MAP_ACTIONS:readonly PlayerState['action'][]=['idle','run','dash','jump','guard','light','heavy','special','ultimate','awaken','victory','flinch','hurt','stun','splat','launched','knockdown','getup','defeated'];
  /** The box the fighter himself occupies: every mesh except what he carries.
   *  Falls back to the whole model where a body is nothing but equipment. */
  private senkoHands?: THREE.Object3D[];
  private selectMadakeBody(state:PlayerState){
    if(state.fighter!=='madake')return;
    const selected='madake_hands_'+madakeHandState(this.active?.getClip().name??'_Idle',this.isForm);
    for(const mesh of this.madakeBodies)mesh.visible=mesh.name===selected;
  }
  private selectTokanMeshes(state:PlayerState){
    if(state.fighter!=='tokan')return;
    const variant=tokanMeshState(state.action,this.active?.time??0,this.active?.getClip().name);
    for(const [name,mesh] of this.tokanMeshes)mesh.visible=name==='Tokan_Frostbite_Cut'?variant.saber:name===`Tokan_${variant.left}_Left`||name===`Tokan_${variant.right}_Right`;
  }
  private selectSenkoHands(state:PlayerState) {
    if(state.fighter!=='senko')return;
    if(!this.senkoHands){
      this.senkoHands=[];
      this.model.traverse(object=>{if(/^Senko_Hand_(Left|Right)_(Open|Beads|Point)$/.test(object.name))this.senkoHands!.push(object);});
    }
    const [left,right]=senkoHandVariants(state.action,this.active?.time??0,this.active?.getClip().name);
    for(const mesh of this.senkoHands)mesh.visible=mesh.name===`Senko_Hand_Left_${left}`||mesh.name===`Senko_Hand_Right_${right}`;
  }
  private oyashioHands?: THREE.Object3D[];
  private selectOyashioHands(state:PlayerState) {
    if(state.fighter!=='oyashio')return;
    if(!this.oyashioHands){
      this.oyashioHands=[];
      this.model.traverse(object=>{if(/^Oyashio_(Closed|Open)_(Left|Right)$/.test(object.name))this.oyashioHands!.push(object);});
    }
    // 15 October 2026 ("rxc"): Tide Palm is a baked right jab now (Jirenga's Bedrock Jab), its left the hand held back: both fists.
    const clip=this.active?.getClip().name,[left,right]=state.action==='light'&&clip==='Tide Palm'?['Closed','Closed']:oyashioHandVariants(state.action,state.actionTime*state.actionDuration,clip);
    for(const mesh of this.oyashioHands)mesh.visible=mesh.name===`Oyashio_${left}_Left`||mesh.name===`Oyashio_${right}_Right`;
  }
  private shakugoArms?: THREE.Object3D[];
  private selectShakugoArms(state:PlayerState){
    if(state.fighter!=='shakugo')return;
    if(!this.shakugoArms){this.shakugoArms=[];this.model.traverse(o=>{if(/^Shakugo_(Normal|Magma|Hound)_(Left|Right)$/.test(o.name))this.shakugoArms!.push(o);});}
    const [left,right]=shakugoArmVariants(state.action,state.actionTime*state.actionDuration,!!state.awakened,this.active?.getClip().name);
    for(const mesh of this.shakugoArms)mesh.visible=mesh.name===`Shakugo_${left}_Left`||mesh.name===`Shakugo_${right}_Right`;
  }
  private static silhouette(model:THREE.Object3D){
    const box=new THREE.Box3(),one=new THREE.Box3();
    model.traverse(o=>{
      const mesh=o as THREE.Mesh;
      if(!mesh.isMesh||(!mesh.visible&&/^(Shakugo_|Oyashio_|Senko_Hand_)/.test(mesh.name))||CARRIED.test(mesh.name)||CARRIED.test(mesh.geometry?.name??''))return;
      box.union(one.setFromObject(mesh));
    });
    return box.isEmpty()?new THREE.Box3().setFromObject(model):box;
  }
  /** The awakening's aura, core then rim: an outfit's, else the fighter's own. */
  auraColours():readonly [number,number]{return this.outfit?.variant?.aura??AWAKENINGS[this.state.fighter].aura;}
  private outfitAura?:THREE.Color;
  private auraColor(){if(!this.outfit?.variant?.aura)return Fighter.auraColor(this.state.fighter);return this.outfitAura??=new THREE.Color(this.outfit.variant.aura[0]);}
  private static readonly AURA=new Map<FighterId,THREE.Color>();
  /** The transformation's core colour, cached: it is read every frame. */
  static auraColor(fighter:FighterId){
    let colour=Fighter.AURA.get(fighter);
    if(!colour){colour=new THREE.Color(AWAKENINGS[fighter].aura[0]);Fighter.AURA.set(fighter,colour);}
    return colour;
  }
  private findClip(patterns:string[]){return findClipIn(this.clips,patterns);}
  /** Engine VOL.7, step four: the clips written down for this body (src/engine/client/clips.ts), where it carries
   *  the very clips they were written for; and whether bodies read them (scripts/engine/clipMap.mts writes them with it
   *  off). */
  private clipMap?:BodyClipMap;
  static clipMaps=true;
  /** The dream loop, round 28: whether a standing blow is drawn with an authored take (DREAM_HURTS) - off, the body's
   *  own hurt, as before (tests compare the two). */
  static dreamTakes=true;
  /** Lock combat's preview (main.ts sets these on that build): how much harder each blow throws the body (HIT_REACT) and
   *  how much longer a body a string is working on stays in its recoil between blows (REEL_LINGER). A blind critic on our
   *  footage: Ouga "turns from hunched-into-the-hit to upright" between blows and "stands un-staggered"; the victim
   *  should stay bent in stagger, facing Taisei, until the string drops. */
  // (reelHold above 1 also keeps the recoil through a slide: a string's shove moved the body faster than the idle's
  // own walk check, and it dropped to idle facing away - the critic, round 3.)
  static hitReact=1;static reelHold=1;
  /** Lock combat's preview: a recoil's let-go stops REEL_ROCK of the clip past its peak, short of the stance it settles
   *  into, and the body rocks there (REEL_SWAY_HZ, this many seconds of the clip back and forth) for as long as it is
   *  held - the critic, rounds 4 and 5, on Ouga through Taisei's wind-up: "four identical frames", where the victim
   *  should stagger on the spot. 0, the let-go plays out to the clip's end and stands there. */
  static reelSway=0;
  /** Lock combat's preview: a string's blows drawn snap-back, spin, fold (dreamHurt's `lock`), so the round's last blow,
   *  held through the beat, leaves the body bent over facing its thrower, the head in sight - not spun away (the critic,
   *  round 5: Ouga "frozen with his back to Taisei"), nor arched back with the arms flung out (round 6: "reads like an
   *  unanimated default pose", the head hidden behind the chest). */
  static lockHurts=false;
  /** Lock combat's preview: the struck body's flash stays white, and a light blow's is lighter (the critic: "each hit
   *  also flashes Ouga's whole body magenta" - read as a colour flicker, not an impact). */
  static whiteFlash=false;
  /** Lock combat's preview: no smear frame (updateSmear). Filmed, it stretched Taisei's wristband and boot into solid bars a
   *  metre long - the blind critic's "flat, hard-edged planks" - where strikes should leave soft streaks; the speed
   *  afterimages (CombatEffects.lockBlow) draw the motion instead. */
  static noSmear=false;
  /** A clip as the body's clip map has it: the clip, null where the map says the body has none, or undefined where the
   *  map does not say (no map, or none for `key`). */
  private mapped(key:string){const map=this.clipMap?.clips;if(!map||!(key in map))return undefined;const name=map[key];return name?this.clips.find(c=>c.name===name)??null:null;}
  /** The clip this body plays for a moment (CLIP_RULES' `key`): as its clip map says, or found by the rule's names. */
  private clip(key:string){
    const mapped=this.mapped(key),own=mapped!==undefined?mapped??undefined:this.findClip([...Fighter.CLIP_RULES[key]?.(this.state.fighter,this.isForm)??[]]);
    // (Round 90: an authored hurt the body has none of is borrowed, fitted to it - BORROWED_TAKES. Not by a
    // transformation's body, which is drawn by its own rules.)
    if(own||this.isForm||!Fighter.borrowedHurt||!BORROWED_TAKES.has(key)||!DREAM_IMPACT||!Fighter.dreamTakes)return own;
    const borrowed=Fighter.borrowedHurt(this.source.scene,this.clips,key,this.state.fighter);
    if(borrowed&&!(this.borrowedSeen??=new WeakSet()).has(borrowed)){this.borrowedSeen.add(borrowed);this.ensurePoseNodes(borrowed);}
    return borrowed;
  }
  /** The action's clip as the body's clip map has it (`ruledClip` draws the same from names): a light or a heavy thrown
   *  off the floor its own entry (not awakened KoKo's, which are his spirit's moves), a jump falling its fall and a run
   *  at a walk its walk - unless the action's clip is one characterMotion.ts authored for it. */
  private mappedClip(state:PlayerState,map:Readonly<Record<string,string|null>>){
    const named=(key:string)=>{const name=map[key];return name?this.clips.find(c=>c.name===name):undefined;};
    if(!state.grounded&&(state.action==='light'||state.action==='heavy')&&!(state.awakened&&state.fighter==='koko'))return named(`air ${state.action}`)??this.clips[0];
    const own=named(state.action),authored=own?.name===`Authored ${state.fighter} ${state.action}`;
    if(state.action==='jump'&&this.falling&&!authored){const fall=this.fallClip();if(fall)return fall;}
    if(state.action==='run'&&this.walking&&this.walkClip&&!this.blended&&!authored)return this.walkClip;
    return own??this.clips[0];
  }
  /** Engine VOL.7, step four: every clip this body finds by name, as it did before its clip map and as a body the
   *  map was not written for still does - each action standing (MAP_ACTIONS) and a light and a heavy off the floor
   *  (`air light`); each rush stage, on the floor (`rush n` where the fighter's `rushClips` names it, `rush fill n` where
   *  the renderer picked it) and in the air (`rush air n`); each air-string stage (`air n`) and combo ender (`ender lh`)
   *  the fighter has; and each moment of CLIP_RULES. scripts/engine/clipMap.mts writes it down as the body's map, and
   *  tests/fighterClipMap.test.ts holds the map to it. */
  ruledClips(){
    const map=this.clipMap,plan=this.rushPlan,authored=[...this.rushAuthored],air=this.airClips,enders=[...this.enderClips],falling=this.falling,walking=this.walking;
    this.clipMap=undefined;this.rushPlan=undefined;this.rushAuthored.clear();this.airClips=[];this.enderClips.clear();this.falling=false;this.walking=false;
    const out:Record<string,string|null>={},name=(clip?:THREE.AnimationClip)=>clip?.name??null,fighter=this.state.fighter;
    try{
      const drawn=(action:PlayerState['action'],grounded:boolean)=>name(this.ruledClip({...this.state,action,grounded,y:grounded?0:1,awakened:false,branch:undefined,chain:0,confirmedAt:undefined}));
      for(const action of Fighter.MAP_ACTIONS)out[action]=drawn(action,true);
      for(const action of ['light','heavy'] as const)out[`air ${action}`]=drawn(action,false);
      const rush=this.planRush();
      rush.ground.forEach((clip,i)=>{out[clip&&this.rushAuthored.has(clip)?`rush ${i+1}`:`rush fill ${i+1}`]=name(clip);});
      if(this.usesAuthoredAirString){
        rush.air.forEach((clip,i)=>{out[`rush air ${i+1}`]=name(clip);});
        this.airStages(fighter)?.forEach((_,i)=>{out[`air ${i}`]=name(this.airStageClip(i));});
      }
      // (The plain enders without the dream loop's takes - those are `dream ender <key>`, below - so a body under `?dreamoff`
      // finds its own take on the map.)
      const takes=Fighter.dreamTakes;Fighter.dreamTakes=false;this.enderClips.clear();
      try{for(const key of COMBO_KEYS)if((this.isForm&&comboFormClip(fighter,key))||comboClip(fighter,key))out[`ender ${key}`]=name(this.enderClip({...this.state,action:COMBO_SLOT[key],branch:key})?.clip);}
      finally{Fighter.dreamTakes=takes;this.enderClips.clear();}
      for(const [key,rule] of Object.entries(Fighter.CLIP_RULES)){const patterns=rule(fighter,this.isForm);if(patterns.length)out[key]=name(this.findClip([...patterns]));}
    }finally{
      this.clipMap=map;this.rushPlan=plan;this.rushAuthored.clear();for(const clip of authored)this.rushAuthored.add(clip);
      this.airClips=air;this.enderClips.clear();for(const [key,found] of enders)this.enderClips.set(key,found);this.falling=falling;this.walking=walking;
    }
    return out;
  }
  private addPoseNode(node:THREE.Object3D){
    const pose:PoseNode={node,samplePosition:node.position.clone(),sampleRotation:node.quaternion.clone(),sampleScale:node.scale.clone(),fromPosition:node.position.clone(),fromRotation:node.quaternion.clone(),fromScale:node.scale.clone(),blendPosition:node.position.clone(),blendRotation:node.quaternion.clone(),blendScale:node.scale.clone(),
      prevPosition:node.position.clone(),prevRotation:node.quaternion.clone(),sourceSpin:new THREE.Vector3(),sourceDrift:new THREE.Vector3(),crossTarget:new THREE.Quaternion(0,0,0,0)};
    this.poseNodes.push(pose);this.poseByNode.set(node,pose);
  }
  /** A clip built after the constructor - a mirrored stage - may key a node no
   *  other clip does, and a node outside the pose set is never blended. */
  private ensurePoseNodes(clip:THREE.AnimationClip){
    for(const track of clip.tracks){
      const node=this.nodeNamed(THREE.PropertyBinding.parseTrackName(track.name).nodeName);
      if(node&&node!==this.model&&!this.poseByNode.has(node))this.addPoseNode(node);
    }
  }
  /** Which stage of the light rush this is: 0 is the fighter's own light, and
   *  anything that is not a light is 0 as well. */
  private rushStage(state:PlayerState){return state.action==='light'?THREE.MathUtils.clamp(Math.floor(state.chain??0),0,RUSH_STAGES-1):0;}
  /** The move a rush stage is drawn against: the simulation's own stage
   *  (per-fighter timing, awakened overrides), scaled onto whatever duration
   *  the server sent, so the drawn blow lands on the authoritative contact.
   *  One object per stage, rewritten in place, because this is read every
   *  frame. */
  private rushMove(state:PlayerState){
    const stage=this.rushStage(state);
    if(!stage)return undefined;
    const authored=authoredRushMove(state.fighter,stage,!!state.awakened);
    let move=this.rushMoves[stage];
    if(!move||move.name!==authored.name){move={...authored,contacts:[authored.contacts[0]]};this.rushMoves[stage]=move;}
    move.duration=state.actionDuration>0?state.actionDuration:authored.duration;
    move.contacts[0]=authored.contacts[0]*move.duration/authored.duration;
    return move;
  }
  /** The move the current action is timed by, rush stages included. */
  private moveFor(state:PlayerState):MoveDefinition{
    if(this.swap&&state===this.swap.pacedState)return this.swap.move;
    const forged=Fighter.ender(state)?undefined:forgedMoveFor(state);if(forged)return forged;
    // Round 3d (ULTS): the ultimate as thrown, awakened included.
    if(state.action==='ultimate')return ultimateMove(state.fighter,!!state.awakened);
    // A combo ender (game/combos.ts) is timed by its own move.
    const ender=Fighter.ender(state);if(ender){const move=comboMove(state.fighter,ender,!!state.awakened);if(move)return move;}
    return this.lockMove(state)??this.rushMove(state)??MOVES[state.fighter][state.action as AttackSlot];
  }
  /** Lock combat (game/lockCombat.ts): a second round's blow, timed as rushMove times a stage (one object per stage). */
  private lockMove(state:PlayerState){
    if(state.action!=='light'||!state.lockRound)return undefined;
    const stage=this.rushStage(state),authored=lockRoundMove(state.fighter,stage,!!state.awakened);
    if(!authored)return undefined;
    let move=this.lockMoves[stage];
    if(!move||move.name!==authored.name){move={...authored,contacts:[authored.contacts[0]]};this.lockMoves[stage]=move;}
    move.duration=state.actionDuration>0?state.actionDuration:authored.duration;
    move.contacts[0]=authored.contacts[0]*move.duration/authored.duration;
    return move;
  }
  private lockMoves:MoveDefinition[]=[];
  /** Lock combat: a second round's blow on this body - its take (render/lockRound.ts) and the part of it played,
   *  resolved once per stage - or undefined for anything else, a body without the take included. */
  private lockTake(state:PlayerState){
    if(state.action!=='light'||!state.lockRound||!state.grounded||state.awakened||this.isForm)return undefined;
    const stage=this.rushStage(state);
    let found=this.lockTakes[stage];
    if(found===undefined){
      // Hand-picked for the first six (render/lockRound.ts); for everyone else, the stage of their own air string the
      // second round throws (game/lockCombat.ts lockRoundName), drawn on the floor - unless it is a take the string's
      // first round already plays on this body.
      const picked=LOCK_ROUND_CLIPS[state.fighter]?.[stage],fill=picked?undefined:LOCK_ROUND_FILL[state.fighter]?.[stage]??undefined;
      let take:LockTake|undefined=picked??(fill?{clip:fill.clip,from:fill.from,to:fill.to,contact:fill.contact,span:fill.span}:undefined);
      let clip=take?this.clips.find(c=>c.name===take!.clip)??this.clips.find(c=>clean(c.name)===clean(take!.clip)):undefined;
      if(!picked){
        this.rushPlan??=this.planRush();
        const light=this.clipFor({...state,action:'light',chain:0,grounded:true,lockRound:0});
        if(clip&&(this.rushPlan.ground.includes(clip)||clip===light))clip=undefined;
        // None of its own to spare: another fighter's strike fitted to this body (borrowedStrikes.ts) - asked again next
        // time while it is still coming, so the first string before it is in keeps the first round's take.
        if(!clip&&Fighter.borrowedStrike&&!this.isForm){
          const borrowed=Fighter.borrowedStrike(this.source.scene,this.clips,state.fighter,stage);
          if(borrowed===undefined)return undefined;
          if(borrowed){if(!(this.borrowedSeen??=new WeakSet()).has(borrowed)){this.borrowedSeen.add(borrowed);this.ensurePoseNodes(borrowed);}clip=borrowed;take={clip:borrowed.name};}
        }
        // Nothing of its own for this stage: the first round's take thrown by the other side of the body (mirrorClip) - a
        // single blow by an empty hand or a foot (not a barrage, not a blade), and not a take the first round plays.
        const first=stage===0?light:this.rushPlan.ground[stage-1],single=stage>0||MOVES[state.fighter].light.contacts.length===1;
        const own=roundMirror(state.fighter,stage===RUSH_STAGES-1);
        if(!clip&&first&&single&&(own?own.mirror:!this.armed)&&!this.isForm&&!mirrorSource(first)){
          const mirror=mirrorClip(this.source.scene,first,sceneJoints(this.source.scene,resolveSkeleton),own?.slack);
          if(mirror&&!this.rushPlan.ground.includes(mirror)&&mirror!==light){this.ensurePoseNodes(mirror);clip=mirror;take={clip:mirror.name};}
        }
      }
      if(!take||!clip||take.span!==undefined&&Math.abs(clip.duration-take.span)>.03)found=null;
      else if(take.from!==undefined&&take.to!==undefined&&take.contact!==undefined)found={clip,from:take.from,to:take.to,contact:take.contact};
      else{
        // (Where the row gives the blow's share of the whole take, there; else measured as a first-round stage's blow
        // is - off the first round's clips, so asked with no round.)
        const at=(take.contact??this.rushFraction(clip,Math.max(1,stage),{...state,lockRound:0}))*clip.duration;
        const from=Math.max(0,at-LOCK_TAKE_LEAD),to=Math.min(clip.duration,at+LOCK_TAKE_TAIL);
        found={clip,from,to,contact:(at-from)/Math.max(.01,to-from)};
      }
      this.lockTakes[stage]=found;
    }
    return found??undefined;
  }
  private lockTakes:({clip:THREE.AnimationClip;from:number;to:number;contact:number}|null|undefined)[]=[];
  /** Build the rush plan now rather than on the first rush of a match. */
  prepareRush(){this.rushPlan??=this.planRush();this.prepareMoves();this.awakenedForm?.prepareRush();}
  /** Everything a move builds the first time it is drawn, built now - which
   *  for the roster is the loading screen's warm-up, and for a fighter in a
   *  match the frame it arrives - rather than on the frame the move is used.
   *
   *  Round 3c. The second blind critic measured "about 100 ms at the start of
   *  Shirokane's rush and Ward's heavy": a hitch the first time, never after.
   *  Timed headless, the first frame of each move cost 2-31 ms against
   *  0.2-1 ms the second time: the clip's motion table (`clipMotionTable`,
   *  240 samples of every track - 10-16 ms on Konta's 1224-track clips), the
   *  rush stage's measured blow (`strikeFraction`, 1-7 ms), and this body's
   *  own samplers and mixer bindings for the clip. The first two are cached
   *  by clip, so the warm-up body pays for the match's; the rest are this
   *  body's own. */
  private prepareMoves(){
    const clips=new Set<THREE.AnimationClip>(),state=this.state;
    const add=(clip?:THREE.AnimationClip)=>{if(clip)clips.add(clip);};
    for(const action of ['light','heavy','special','ultimate'] as const)for(const grounded of [true,false])add(this.clipFor({...state,action,chain:0,grounded}));
    for(const clip of [...this.rushPlan?.ground??[],...this.rushPlan?.air??[]])add(clip);
    if(state.fighter==='taisei')TAISEI_MELEE_CONTACTS.forEach((_,i)=>add(this.clip(`melee ${i}`)));
    // The combo enders' own clips (comboClips.ts): the first ender of a match built its clip's tables, samplers and
    // mixer binding on the frame it was thrown - the first Light, Heavy of a match hitched where no other did.
    if(hasCombos(state.fighter))for(const key of COMBO_KEYS)add(this.enderClip({...state,action:COMBO_SLOT[key],branch:key,chain:0})?.clip);
    // Techniques (game/techniques.ts): each one's take fitted to this body now (styleMoves.ts) - behind the loading screen,
    // where the takes are already in (main.ts waits for them) - not on the first technique of a fight.
    for(const key of TECHNIQUE_KEYS)add(this.enderClip({...state,action:TECHNIQUE_SLOT[key],branch:key,chain:0,grounded:key!=='airRush'&&key!=='airRise'})?.clip);
    for(const clip of clips){clipMotionTable(clip);this.samplersFor(clip);this.mixer.clipAction(clip);}
    for(let stage=1;stage<RUSH_STAGES;stage++)for(const grounded of [true,false]){
      const staged={...state,action:'light' as const,chain:stage,grounded},clip=this.clipFor(staged);
      // (A stage's dream take, round 29, is none of the plan's: built here as they were above.)
      if(clip){if(!clips.has(clip)){clipMotionTable(clip);this.samplersFor(clip);this.mixer.clipAction(clip);}this.rushFraction(clip,stage,staged);}
    }
    // The clips a body is thrown into and stands in: a first hit, a first
    // fidget, the first time an opponent comes close.
    for(const name of Object.keys(Fighter.REACTIONS)){const clip=this.clip(`reaction ${name}`);if(clip){this.samplersFor(clip);this.mixer.clipAction(clip);}}
    // (The dream loop's hurts and flinch, round 28.)
    for(const key of [...Object.keys(DREAM_HURTS),'dream flinch']){const clip=this.clip(key);if(clip){this.samplersFor(clip);this.mixer.clipAction(clip);}}
    // Round 3e (REACT): the get-up is paced by its motion (see `reaction`).
    {const getup=this.clip('reaction getup');if(getup)clipMotionTable(getup);}
    for(const clip of this.idleRig?.clips??[]){this.samplersFor(clip);this.mixer.clipAction(clip);}
  }
  /** Which clip plays each rush stage, on the ground and in the air.
   *
   *  `rushClips` in the fighter's config wins where it names a clip the body
   *  has (its own, or one carried by `rushModel`). Anything it does not name is
   *  filled from what the rig already ships, so a stage is never a frozen pose
   *  and never the same swing three times over where there is a choice:
   *  the light mirrored onto the other side of the body first - a left after
   *  the right is what a rush is made of - then the rig's unused punches and
   *  kicks, the finisher preferring a kick.
   *
   *  Steel changes the rules. A clip that does not key the nodes the light
   *  keys leaves a sword wherever its rest pose puts it - measured on Kenzo, a
   *  donated kick swung three katanas loose - so a fighter holding a weapon
   *  only takes clips that key what his light keys, and is never mirrored,
   *  which would swing the empty hand and leave the blade in the other. */
  private planRush(){
    // (The first round's clips, asked with no round: a body in a lock string's second round asked lockTake again, which
    // asked for this plan, not yet made - live on 1 November 2026, "Maximum call stack size exceeded" from lockTake,
    // clipFor and planRush: tests/lockTakeRecursion.test.ts.)
    const base:PlayerState={...this.state,action:'light',chain:0,grounded:true,lockRound:0};
    const slots=(['light','heavy','special','ultimate'] as const).map(action=>this.clipFor({...base,action}));
    // Taisei's light is his grounded melee clip, which clipFor never returns.
    const taisei=this.state.fighter==='taisei'?this.clip('melee 0'):undefined;
    const light=taisei??slots[0];
    let steel=this.armed||this.heldWeapons.length>0;
    this.model.traverse(o=>{if((o as THREE.Mesh).isMesh&&/weapon|kunai|knife|sword|blade/i.test(o.name))steel=true;});
    const nodesOf=(clip:THREE.AnimationClip)=>new Set(clip.tracks.map(t=>THREE.PropertyBinding.parseTrackName(t.name).nodeName));
    const lightNodes=light?nodesOf(light):new Set<string>();
    const keyed=(clip:THREE.AnimationClip)=>{
      if(!steel||!lightNodes.size)return true;
      const nodes=nodesOf(clip);let shared=0;for(const node of lightNodes)if(nodes.has(node))shared++;
      return shared>=lightNodes.size*.9;
    };
    // Engine VOL.7, step four: a body's clip map (src/engine/client/clips.ts) says which clip each stage plays - the
    // one the fighter names, or the one picked below - so it picks nothing by name.
    const map=this.clipMap?.clips;
    const pool=map?[]:this.clips.filter(c=>c!==light&&!slots.includes(c)&&RUSH_STRIKE.test(c.name)&&!RUSH_NEVER.test(c.name)&&c.duration>=.25&&c.duration<=4.5&&keyed(c)&&this.roughness(c)<=RUSH_SMOOTH);
    // Not a melee barrage: mirroring three blows does not make one. Not a
    // blade either - a sword swung by the empty hand - but a kunai is small
    // enough that a jab thrown by the other hand while it stays put reads as
    // a jab.
    const lightMove=MOVES[this.state.fighter].light;
    const single=lightMove.contacts.length===1||lightMove.style!=='melee';
    const mirror=!this.armed&&!this.isForm&&single&&light
      ?mirrorClip(this.source.scene,light,sceneJoints(this.source.scene,resolveSkeleton)):undefined;
    if(mirror)this.ensurePoseNodes(mirror);
    const prefer:(RegExp|'mirror')[][]=[
      ['mirror',/jab|cross|punch 0?2/i,/punch/i,/strike|slash|attack_|grounded-cross/i,/kick/i,/air attack/i],
      [/punch 0?2|hook|grounded-cross/i,/kick 0?1|air attack 0?2/i,/punch/i,/kick/i,/strike|slash|attack_/i,/air attack/i,'mirror'],
      [/meteor|kick 0?2|air attack 0?3/i,/kick/i,/air attack/i,/strike|slash|attack_/i,/punch/i,'mirror'],
    ];
    const authored=FIGHTERS[this.state.fighter].rushClips;
    const ground:(THREE.AnimationClip|undefined)[]=[],used=new Set<THREE.AnimationClip>();
    for(let stage=1;stage<RUSH_STAGES;stage++){
      const pattern=this.isForm&&!FORM_NAMED_RUSH.has(this.state.fighter)?undefined:authored?.[stage-1];
      const named=map?this.mapped(`rush ${stage}`)??undefined:pattern?this.findClip([pattern]):undefined;
      if(!map&&pattern&&!named&&!Fighter.warnedRush.has(this.state.fighter+pattern)){
        Fighter.warnedRush.add(this.state.fighter+pattern);
        console.warn(`${FIGHTERS[this.state.fighter].name}: rush stage ${stage} clip "${pattern}" not found; using the body's own clips`);
      }
      if(named){used.add(named);this.rushAuthored.add(named);}
      ground.push(named);
    }
    for(let stage=1;stage<RUSH_STAGES;stage++){
      if(ground[stage-1])continue;
      if(map){const fill=map[`rush fill ${stage}`];ground[stage-1]=fill?this.clips.find(c=>c.name===fill)??(mirror?.name===fill?mirror:undefined):undefined;continue;}
      let chosen:THREE.AnimationClip|undefined;
      for(const want of prefer[Math.min(stage,prefer.length)-1]){
        const found=want==='mirror'?mirror:pool.find(c=>!used.has(c)&&want.test(c.name));
        if(found&&!used.has(found)){chosen=found;break;}
      }
      // Fewer distinct clips than stages: never the same swing twice running.
      // The light and its mirror alternate - right, left, right - which is
      // what a rush of one punch looks like; failing both, repeat rather than
      // freeze.
      const before=stage>1?ground[stage-2]:light;
      chosen??=[mirror,light,...pool].find(c=>c&&c!==before)??pool[0]??mirror??light;
      if(chosen)used.add(chosen);
      ground[stage-1]=chosen;
    }
    // In the air, the air normals where the rig has them - the grounded
    // light's air version is `air Attack 01`, so the stages take the other two
    // and come back round - and where they are smooth enough: donated, they
    // turn a joint 38 to 60 degrees a frame on every rig but Konta's. Any
    // other stage keeps its grounded clip, which is what every armed fighter
    // already does for his air light.
    // Round 3b: a fighter with an air string of its own (AIR_STRING_CLIPS)
    // throws the moves it names.
    const own=this.airStages(this.state.fighter);
    const air=!this.usesAuthoredAirString?[]:map?[1,2,3].map(n=>this.mapped(`rush air ${n}`)??undefined):own?[this.airStageClip(1),this.airStageClip(2),undefined]
      :[2,3,1].map(n=>{const clip=this.findClip([`air Attack 0${n}`]);return clip&&this.roughness(clip)<=RUSH_SMOOTH?clip:undefined;});
    return {ground,air};
  }
  private static warnedRush=new Set<string>();
  /** The largest turn any body joint makes between two sixtieths of a second
   *  of a clip's own footage, in radians. Cached per clip. */
  private roughness(clip:THREE.AnimationClip){
    let worst=clipRoughness.get(clip);
    if(worst!==undefined)return worst;
    worst=0;
    const body=this.bodyJointSet,a=new THREE.Quaternion(),b=new THREE.Quaternion();
    for(const track of this.samplersFor(clip)){
      if(track.property!=='quaternion'||!body.has(track.node)||/finger|thumb|index|middle|ring|pinky|toe|eye|jaw/i.test(track.node.name))continue;
      a.fromArray(track.interpolant.evaluate(0) as unknown as number[]);
      for(let t=1/60;t<=clip.duration+1e-6;t+=1/60){b.fromArray(track.interpolant.evaluate(Math.min(t,clip.duration)) as unknown as number[]);worst=Math.max(worst,a.angleTo(b));a.copy(b);}
    }
    clipRoughness.set(clip,worst);
    return worst;
  }
  /** Where a rush stage's blow is drawn in its clip. A measured entry for the
   *  clip wins, then the stage's own entry for an authored stage clip; a
   *  mirrored or restarted light lands where the light does; Taisei's grounded
   *  clips have their measured peaks; anything else is measured off the rig
   *  (see `strikeFraction`), and failing that sits two fifths in. */
  private rushFraction(clip:THREE.AnimationClip|undefined,stage:number,state:PlayerState){
    if(!clip)return RUSH_DEFAULT_FRACTION;
    const cached=this.rushFractions.get(clip);
    if(cached!==undefined)return cached;
    const formKeys=this.isForm?FORM_CONTACT_BY_KEY[state.fighter]:undefined,table=formKeys?{...CONTACT_BY_KEY[state.fighter],...formKeys}:CONTACT_BY_KEY[state.fighter],source=mirrorSource(clip)??clip;
    const light=MOVES[state.fighter].light;
    const taisei=TAISEI_MELEE_CONTACTS.find(entry=>entry.clip===source.name);
    const lightClip=state.fighter==='taisei'?undefined:this.clipFor({...state,action:'light',chain:0,grounded:true});
    // An authored stage clip's measured entry is the stage it was authored for, whichever stage plays it: the warm-up
    // met some first as an air string's stage (Ouga's and Shirokane's Rush 3 open their air strings) and cached that
    // stage's contact for the clip, so on the ground they showed their blow at 0.49 of the clip instead of 0.40.
    const authoredAt=this.rushAuthored.has(clip)?(this.rushPlan?.ground.indexOf(clip)??-1)+1:0;
    const fraction=table?.[clip.name]??table?.[source.name]
      ??(this.rushAuthored.has(clip)?table?.[`rush${authoredAt||stage}`]:undefined)
      ??taisei?.peak
      ??(source===lightClip?CONTACT_FRACTION[state.fighter]?.light??light.contacts[0]/light.duration:undefined)
      ??strikeFraction(this.source.scene,source,sceneJoints(this.source.scene,resolveSkeleton))
      ??RUSH_DEFAULT_FRACTION;
    this.rushFractions.set(clip,fraction);
    return fraction;
  }
  /** The descent clip, where the rig has one. Every fighter in the roster
   *  ships one and nothing outside a knockdown was reaching for it. */
  private fallClip(){return this.clip('fall');}
  /** How long a falling body has before the floor, on the simulation's own
   *  arc. Solving h - |vy|t - gt^2/2 = 0 for t. Round 4b (JUMP): a jump comes
   *  down at FALL_GRAVITY (3.3x since the jump went to 2.5-3.5x the height); at
   *  plain gravity the fall clip ran a third of the way behind the body. */
  /** The dream loop, round 25 (REEL_LINGER): a body a string is working on stays in its recoil between the blows. The
   *  server hands a struck body back its idle the moment its hitstun ends, and the string's next blow came 0.1-0.3 s
   *  later to a body standing back in its stance - Ouga's arms crossed again before Taisei's launcher (a blind critic:
   *  "the launcher lands on an idle opponent and the exchange reads as three separate moves"). Standing idle within
   *  REEL_LINGER of a standing recoil's end, the body is drawn still in it, its let-go played on at REEL_RATE of its
   *  pace from where the server left it (the recoil reads the presented clock: `reactionSince`); anything it does -
   *  moving, guarding, a move, another blow - ends the hold at once, and the idle's own blend takes it home after. */
  private reeling(state:PlayerState,real:number):PlayerState{
    this.reelClock+=real;
    this.reelHolding=false;
    if(REEL_ACTIONS.has(state.action)&&state.alive&&state.grounded){
      const reel=this.reel?.started===state.actionStarted&&this.reel.action===state.action?this.reel:(this.reel={action:state.action,started:state.actionStarted,duration:state.actionDuration,elapsed:0,ended:-1});
      reel.duration=state.actionDuration;reel.ended=-1;
      return state;
    }
    const reel=this.reel;
    if(!reel)return state;
    if(state.action!=='idle'||!state.grounded||!state.alive||this.locomotionSpeed>.3&&Fighter.reelHold<=1||!(reel.duration>0)){this.reel=undefined;return state;}
    // From the recoil's own clock as it stood on the last frame of the reaction (`lastSince`), so it goes on from there.
    if(reel.ended<0){reel.ended=this.reelClock;reel.elapsed=this.lastSince;}
    const lingered=this.reelClock-reel.ended;
    if(lingered>REEL_LINGER*Fighter.reelHold){this.reel=undefined;return state;}
    this.reelHolding=true;
    return {...state,action:reel.action,actionStarted:reel.started,actionDuration:reel.duration,actionTime:(reel.elapsed+lingered*REEL_RATE)/reel.duration};
  }
  private reel?:{action:PlayerState['action'];started:number;duration:number;elapsed:number;ended:number};
  private readonly castHeld=newCastHold();
  private reelClock=0;
  /** Whether this frame is drawn reeling on (see `reeling`), and the recoil's clock on the last frame drawn. */
  private reelHolding=false;private lastSince=0;
  private timeToGround(state:PlayerState){
    const vy=Math.min(0,this.velocity.y),height=Math.max(0,state.y-this.groundY),g=JUMP_GRAVITY*FALL_GRAVITY;
    return (vy+Math.sqrt(vy*vy+2*g*height))/g;
  }
  /** The part of its clip a combo ender plays, where it plays one part of a longer take (comboClips.ts). */
  private segmentOf(state:PlayerState){
    // Lock combat: a second round's blow, the part of its take that is the blow.
    const second=this.lockTake(state);
    if(second&&this.active?.getClip()===second.clip)return {from:second.from,to:second.to,contact:second.contact};
    const found=this.enderClip(state),own=found?.own;
    if(own&&own.from!==undefined&&own.to!==undefined&&this.active?.getClip()===found.clip)return {from:own.from,to:own.to,contact:own.contact};
    // Round 4b (COMBAT): an air-string stage played off part of a take (AIR_STRING_CLIPS).
    if(state.action!=='light'||state.grounded||!this.usesAuthoredAirString)return undefined;
    const stage=this.rushStage(state),airStage=this.airStages(state.fighter)?.[stage];
    if(airStage?.from===undefined||airStage.to===undefined||this.active?.getClip()!==this.airStageClip(stage))return undefined;
    return {from:airStage.from,to:airStage.to,contact:airStage.contact};
  }
  /** Round 4b (COMBAT): an air-string stage's clip on this body (AIR_STRING_CLIPS), resolved once per stage: by its exact
   *  name and, where the row says how long its take is (`span`), only that take - a form's or an outfit's clip of the
   *  name at another length is another take, whose seconds these are not.
   *  Minase's reviewed Sage body has the identical authored clip set. */
  private get usesAuthoredAirString(){return !this.isForm||this.state.fighter==='hawser'||this.state.fighter==='rotfalke'||this.state.fighter==='minase'||this.state.fighter==='irbis'||this.state.fighter==='rakucho'||this.state.fighter==='hagure'||this.state.fighter==='akayuri'||this.state.fighter==='madake';}
  private airClips:(THREE.AnimationClip|null|undefined)[]=[];
  private airStageClip(stage:number){
    if(!this.usesAuthoredAirString)return undefined;
    let found=this.airClips[stage];
    if(found===undefined){
      // (As the body's clip map has it, where it says: src/engine/client/clips.ts.)
      const mapped=this.mapped(`air ${stage}`),own=this.airStages(this.state.fighter)?.[stage],name=mapped===undefined?own?.clip:undefined;
      const clip=name?this.clips.find(c=>c.name===name)??this.clips.find(c=>clean(c.name)===clean(name)):undefined;
      found=mapped!==undefined?mapped:clip&&(own!.span===undefined||Math.abs(clip.duration-own!.span)<.03)?clip:null;
      this.airClips[stage]=found;
    }
    return found??undefined;
  }
  /** When a ground smash's fall met the floor, in its move's time (-1 until it has), and the swing it was in. */
  private plungeLanded=-1;private plungeEpoch=-1;
  /** A ground smash (the airSpecial ender) on the way down holds the pose just before its blow until its feet are down
   *  - the simulation strikes on landing - and the clock it is drawn on then goes on from that pose: the blow lands over
   *  PLUNGE_SLAM, and the recovery runs over what is left of the move. It used to jump to wherever the move's clock had
   *  got to while it fell, a tenth to a fifth of a second of the take in one frame on the landing. */
  private plunge(state:PlayerState,t:number,at:number){
    if(Fighter.ender(state)!=='airSpecial')return t;
    if(this.plungeEpoch!==this.actionEpoch){this.plungeEpoch=this.actionEpoch;this.plungeLanded=-1;}
    const hold=at*.9;
    if(!state.grounded){this.plungeLanded=-1;return Math.min(t,hold);}
    if(this.plungeLanded<0)this.plungeLanded=t;
    const landed=this.plungeLanded;
    if(landed<=hold)return t;
    const slam=Math.min(.5*(1-landed),PLUNGE_SLAM/Math.max(.05,state.actionDuration||1)),since=t-landed;
    return since<slam?hold+since/slam*(at-hold):at+(since-slam)/Math.max(1e-3,1-landed-slam)*(1-at);
  }
  /** The combo ender (game/combos.ts) a heavy or special is being thrown as, if it is one. */
  static ender(state:PlayerState){return state.branch&&(state.action==='heavy'||state.action==='special'||state.action==='light')?state.branch:undefined;}
  /** Each ender's clip on this body, resolved once (it is read every frame): null where the body has none. */
  private enderClips=new Map<ComboKey,{clip:THREE.AnimationClip;own:ComboClip}|null>();
  /** The clip a combo ender is drawn with on this body, and its row (comboClips.ts): the take it names, by its exact name
   *  - a substring would hand an ender some other clip - and, where the row says how long the take it was read off is
   *  (`span`), only that take. A form's or an outfit's body with a clip of the same name at another length has another
   *  take under it, whose seconds are not these. A form's own row (COMBO_FORM_CLIPS) comes first. A body with none
   *  throws the slot's clip, timed to the ender (`moveFor`). */
  private enderClip(state:PlayerState){
    const ender=Fighter.ender(state);
    if(!ender)return undefined;
    let found=this.enderClips.get(ender);
    if(found===undefined){
      found=null;
      // The dream loop, round 42: the ender's authored take where the body has one (`dream ender <key>`), on its own
      // take's row - the same seconds and contact, the take re-posed over a copy of itself (scripts/fanim/dream_enders.py).
      if(DREAM_IMPACT&&Fighter.dreamTakes&&!this.isForm){
        const own=comboClip(state.fighter,ender),dream=own?this.clip(`dream ender ${ender}`):undefined;
        if(own&&dream&&(own.span===undefined||Math.abs(dream.duration-own.span)<.03))found={clip:dream,own:dreamRow(own,dream.name)};
      }
      // The clip as the body's clip map has it, where it says (src/engine/client/clips.ts), and the row it is the take of.
      const mapped=this.mapped(`ender ${ender}`);
      for(const own of found?[]:[this.isForm?comboFormClip(state.fighter,ender):undefined,comboClip(state.fighter,ender)]){
        if(!own)continue;
        const clip=mapped!==undefined?(mapped&&(mapped.name===own.clip||clean(mapped.name)===clean(own.clip))?mapped:undefined):this.clips.find(c=>c.name===own.clip)??this.clips.find(c=>clean(c.name)===clean(own.clip));
        if(clip&&(own.span===undefined||Math.abs(clip.duration-own.span)<.03)){found={clip,own};break;}
      }
      // Techniques (game/techniques.ts): with no take of its own, the style's take fitted to this body (styleMoves.ts),
      // played whole with its blow on the move's contact - asked again next time while the takes are still coming.
      if(!found&&isTechnique(ender)&&Fighter.styleMove&&!this.isForm){
        const fit=Fighter.styleMove(this.source.scene,this.clips,state.fighter,ender);
        if(fit===undefined)return undefined;
        if(fit){this.ensurePoseNodes(fit.clip);found={clip:fit.clip,own:{clip:fit.clip.name,from:0,to:fit.clip.duration,contact:fit.contact}};}
      }
      this.enderClips.set(ender,found);
    }
    return found??undefined;
  }
  /** Whether a heavy, special or ultimate is drawn with one of the slot's own clips (`names`, the fighter's slot clips by
   *  default) - as an ender is where its body has no clip of its own for it, or where its own is a part of a slot's -
   *  rather than with an ender's own take. The props and hands a slot's clip is built around (Mirage Draw's put-away
   *  swords, the Shrike Bolt hand that holds no kunai, Cautery Blade's left hand, Needle Finger's pointing hand, Signal Fire's will)
   *  belong to that clip, not to the button. */
  slotClip(state:PlayerState,names:readonly string[]=this.slotClips(state.fighter)?.slice(1)??[]){
    if(this.swap)return false;
    if(!Fighter.ender(state))return true;
    const own=this.enderClip(state)?.clip;
    return !own||names.includes(own.name);
  }
  /** The four slots' clips as this body names them: its fighter's (`clips`), or its own where it is a form with a kit of
   *  its own (`formClips`: the YUGE). */
  private slotClips(fighter:FighterId){const definition=FIGHTERS[fighter];return this.isForm?definition.formClips??definition.clips:definition.clips;}
  /** This body's air string (AIR_STRING_CLIPS), or its own where it is a form that draws another (FORM_AIR_STRING_CLIPS). */
  private airStages(fighter:FighterId){return (this.isForm?FORM_AIR_STRING_CLIPS[fighter]:undefined)??AIR_STRING_CLIPS[fighter];}
  private clipFor(state:PlayerState):THREE.AnimationClip|undefined{
    // VOL.5, the move transplant: the action being drawn, when it is a borrowed move, is its own fighter's take.
    if(this.swap&&state===this.state)return this.swap.clip;
    if(state.action==='area'){const anim=areaAnim(state);return (anim.clip&&anim.fighter===state.fighter?this.findClip([anim.clip]):undefined)??this.clipFor({...state,action:anim.slot});}
    if(state.action==='victory'&&!this.victoryHeld){const entry=this.clips.find(c=>c.name===VICTORY_ENTRY);if(entry)return entry;}
    // Round 3d (ULTS): a hit-confirm ultimate's opener is thrown with a clip
    // of the fighter's own kit, until the confirm (see ULTIMATE_CLIPS).
    if(state.action==='ultimate'&&state.confirmedAt===undefined){
      const clip=this.clip('opener');
      if(clip)return clip;
    }
    // Round 4b (FANIM): a spirit's user commands the light string his spirit throws (SPIRIT_COMMAND) - on the ground: off it
    // he throws his own air string (AIR_RUSH names what it draws).
    const command=state.action==='light'&&!state.branch&&state.grounded&&!this.isSpirit&&!this.isForm&&(!state.awakened||state.fighter==='gosu')?SPIRIT_COMMAND[state.fighter]:undefined;
    if(command){const clip=this.clip('command');if(clip)return clip;}
    // A combo ender plays its own clip (comboClips.ts), off the floor as on it.
    const ender=this.enderClip(state);
    if(ender)return ender.clip;
    // Lock combat: a second round's blow plays its own take (render/lockRound.ts).
    const second=this.lockTake(state);
    if(second)return second.clip;
    // A rush stage plays its own clip; stage 0 is the light below.
    const stage=this.rushStage(state);
    if(stage){
      this.rushPlan??=this.planRush();
      const clip=(!state.grounded&&this.rushPlan.air[stage-1])||this.rushPlan.ground[stage-1];
      // The dream loop, round 29: on the floor, the stage's dream take where the body has one (DREAM_STAGES) - struck on
      // the stage's own measured contact (`rushFraction` reads an authored clip by its stage).
      if(clip&&DREAM_IMPACT&&Fighter.dreamTakes&&state.grounded&&clip===this.rushPlan.ground[stage-1]){
        const dream=this.clip(`dream rush ${stage}`);
        if(dream){this.rushAuthored.add(dream);return dream;}
      }
      if(clip)return clip;
    }
    // Round 5 (GUMMY): SUNRISE floats: he hangs in the air standing, glides travelling and blocks with his forearms
    // crossed (gummy/sunrise.ts).
    if(this.floating&&(state.action==='idle'||state.action==='run'||state.action==='guard')){const clip=this.clip(`float ${state.action}`);if(clip)return clip;}
    // The idle's own loop, or the fidget playing in its place.
    if(state.action==='idle'&&this.idleRig?.loop){const clip=this.idleRig.clip();if(clip)return clip;}
    // Engine VOL.7, step four: the action's clip as the body's clip map has it (src/engine/client/clips.ts).
    if(this.clipMap)return this.mappedClip(state,this.clipMap.clips);
    return this.ruledClip(state);
  }
  /** The action's clip found by name, as every body found it before its clip map, and as one the map was not written
   *  for still does (scripts/engine/clipMap.mts writes each body's map from it: `ruledClips`). */
  private ruledClip(state:PlayerState){
    const airNormal=!this.isForm&&!state.grounded&&(state.action==='light'||state.action==='heavy');
    if(state.fighter==='konta'&&ATTACK_SLOTS.has(state.action)&&!airNormal){
      const authored=this.findClip([`${this.isForm?'Kurobi':'Konta'} ${state.action}`]);
      if(authored)return authored;
    }
    // Round 4b (COMBAT): off the floor a light is its air string's own opener (AIR_STRING_CLIPS), ahead of an authored
    // light (Setsu's) - the jab thrown in the air was what the round-4 critic saw.
    if(state.action==='light'&&!state.grounded&&!(state.awakened&&state.fighter==='koko')){const opener=this.airStageClip(0);if(opener)return opener;}
    const authoredMotion=this.clips.find(c=>c.name===`Authored ${state.fighter} ${state.action}`);
    if(authoredMotion)return authoredMotion;
    if(state.action==='jump'&&this.falling){const fall=this.fallClip();if(fall)return fall;}
    if(state.action==='awaken'){
      const own=this.isForm?AWAKEN_FORM_TAKE[state.fighter]:AWAKEN_TAKE[state.fighter];
      const clip=this.findClip([...(own?[own]:[]),...(AWAKENINGS[state.fighter].clips??[]),'_Idle','Idle','stance']);
      if(clip)return clip;
    }
    // Crossing the floor slowly is a walk. Most rigs ship one and nothing was
    // reaching for it, so every step at any speed was the same full run.
    if(state.action==='run'&&this.walking&&this.walkClip&&!this.blended)return this.walkClip;
    const reaction=Fighter.REACTIONS[state.action];
    if(reaction){const clip=this.findClip(reaction);if(clip)return clip;}
    if(!state.grounded&&(state.action==='light'||state.action==='heavy')&&!(state.awakened&&state.fighter==='koko')){
      const own=state.action==='light'&&this.usesAuthoredAirString?this.airStages(state.fighter):undefined;
      const air=own?this.airStageClip(0):this.findClip([state.action==='light'?'air Attack 01':'air Attack 02','air Attack']);
      if(air)return air;
    }
    const isTaisei=state.fighter==='taisei';
    const authored=this.slotClips(state.fighter);
    if(authored){const slot=['light','heavy','special','ultimate'].indexOf(state.action);const name=slot>=0?authored[slot]:(state.action==='victory'?this.findClip(state.fighter==='full-beam'?['Lighthouse Salute',...VICTORY]:VICTORY)?.name:undefined)??({idle:'_Idle',run:'Run',dash:'Dash',jump:'jump',guard:'Block',hurt:'Hit 01',defeated:'Die fall'}as Record<string,string>)[state.action];const before=name?SLOT_CLIP_BEFORE[state.fighter]?.[name]:undefined;return this.findClip(before?[name!,before.clip]:[name??'_Idle'])??this.clips[0];}
    // (Round 5: his body throws no part of the GRAND TIDE - SUNRISE's does all of it - and stands in his stance for the
    // beats either side of it the form is not drawn for.)
    if(state.fighter==='gummy'){const names:Record<string,string[]>={idle:['_Idle'],victory:VICTORY,run:['Run'],dash:['Dash'],jump:['jump'],guard:['Block'],light:['Snapback Jab'],heavy:['Rogue Wave'],special:['SUNSET BARRAGE','Punch 01'],ultimate:[...(LUCY_TIDE?[TIDE_CLIP]:[]),'Sunrise Tide','_Idle'],hurt:['Hit 01'],defeated:['Die fall']};return this.findClip(names[state.action]??['_Idle'])??this.clips[0];}
    // Taisei's rebuild names its clips `adapted_*`, and nothing else on him
    // answers to `Dash`, `Block`, `jump` or `Hit 01` - so those still come
    // from here. `run` deliberately does not. He has been given a donated
    // `Run` twice now, and both times this override kept playing
    // `adapted_run` instead while measure_locomotion measured the clip he was
    // not playing: the renderer drove the old 2.5 m/s cycle at a rate
    // computed for a 3.0 m/s one, which is a gait and a stride describing two
    // different animations. Where a properly named clip exists it wins.
    if(isTaisei&&['dash','jump','guard','light','heavy','hurt'].includes(state.action)){const adapted=this.findClip(['adapted_'+(state.action==='hurt'?'hit':state.action)]);if(adapted)return adapted;}
    const table:Record<string,string[]>={idle:isTaisei?['taisei-ready','02-STANCE','stance','idle']:['_Idle','Idle'],victory:VICTORY,run:['Run','Walk'],dash:['Dash','Run'],jump:['jump','Jump Fall'],guard:['Block','Guard','02-STANCE'],light:['Punch 01','Punch','Light'],heavy:isTaisei?['Meteor','Kick 01','Punch 03']:['Whirlsphere Attack'],special:isTaisei?['03-SUNPALM-CANNON','Sunpalm Cannon']:['Whirlsphere Ready','Whirlsphere charge'],ultimate:isTaisei?['LAST SUN','Ultimate','01-OSSU']:['Whirlsphere charge Clone','Whirlsphere charge'],hurt:['Hit 01','Hit','Hurt'],defeated:['Die fall','Fall','Defeated']};
    return this.findClip(table[state.action]??table.idle)??this.findClip(table.idle)??this.clips[0];
  }
  /** Map elapsed move time onto clip time so the clip's own contact frame lands
   *  on the move's contact time, and so the way it gets there is a strike
   *  rather than an even sweep: a chamber drawn back over the wind-up, a drive
   *  across the last tenth of a second into contact, then a follow-through that
   *  runs out and holds. Returns null for anything that is not a single-contact
   *  melee swing, which is everything with its own handling.
   *
   *  A move with nothing measured is re-paced but not re-aligned - its own
   *  contact frame is wherever the animator put it, so `at` stands in for the
   *  measurement and the curve passes through the same point the straight line
   *  did. That is worth doing on its own: the shape is most of the feel. */
  private contactCurve(state:PlayerState,clip=this.active?.getClip()){
    // The area slot's cast lands its clip's own contact (its anim slot's) on the area move's release.
    const area=state.action==='area'?areaAnim(state):undefined,slot=(area?.clip&&area.fighter===state.fighter?'area':area?area.slot:state.action) as AttackSlot;
    // A combo ender played off a segment of a longer take (comboClips.ts): its contact frame put on the move's contact,
    // the wind-up and the follow-through laid evenly either side of it.
    const segment=this.segmentOf(state);
    if(segment){
      const move=this.moveFor(state),at=move.contacts[0]/Math.max(.01,state.actionDuration),t=THREE.MathUtils.clamp(state.actionTime,0,1);
      const fraction=segment.contact??at,held=this.plunge(state,t,at);
      return held<=at?held/Math.max(.001,at)*fraction:fraction+(held-at)/Math.max(.001,1-at)*(1-fraction);
    }
    // Every finite action comes through here, and a dash, a stagger and a
    // knockdown are not moves: reading a move table with one of those as the
    // key returns undefined and throws on the next line.
    if(!state.actionDuration||!ATTACK_SLOTS.has(state.action))return null;
    // A rush stage is a single blow on the stage's own timing, whatever clip
    // plays it: an authored clip keyed to the light's timing is paced like
    // any other rather than read straight across a different move.
    const stage=this.rushStage(state);
    // Round 3d (ULTS): an ultimate laid over its hit-confirm timing. One
    // authored on the move's own clock (Kuon's, Setsu's) holds its opener's
    // pose until the confirm, so a whiff never throws the cinematic's blows.
    if(slot==='ultimate'&&clip&&!isCharacterMotion(clip)){const laid=this.ultimateCurve(state,clip);if(laid!==undefined)return laid;}
    if(slot==='ultimate'&&clip&&isCharacterMotion(clip)&&state.confirmedAt===undefined){
      const move=this.moveFor(state);
      if(move.confirm)return Math.min(THREE.MathUtils.clamp(state.actionTime,0,1),(move.contacts[0]+.1)/state.actionDuration);
    }
    if(!stage&&clip&&(isCharacterMotion(clip)||state.fighter==='konta'&&/^(Konta|Kurobi)\s*(light|heavy|special|ultimate)$/i.test(clip.name)))return THREE.MathUtils.clamp(state.actionTime,0,1);
    const move=this.moveFor(state);
    const melee=move.style==='melee';
    // A string of blows is a string of shapes. This used to bail here and let
    // the linear fallback sweep the clip evenly across every contact.
    if(move.contacts.length>1){
      if(melee)return this.stringCurve(state,move);
      const clip=this.active?.getClip();
      return clip?clipAtMotion(clipMotionTable(clip),THREE.MathUtils.clamp(state.actionTime,0,1)):null;
    }
    const at=move.contacts[0]/state.actionDuration;
    if(at<=.02||at>=.98)return null;
    // An ender's own clip lands where comboClips.ts measured it; a body without that clip (a form's) throws the slot's,
    // and lands where the slot's does.
    const ender=Fighter.ender(state),own=this.enderClip(state);
    // (Round 4b, FMOVES: a body playing a slot's clip from before its new take lands it where it always landed.)
    const earlier=clip?Object.values(SLOT_CLIP_BEFORE[state.fighter]??{}).find(b=>b.clip===clip.name):undefined;
    const fraction=stage?this.rushFraction(clip,stage,state):own&&clip===own.clip?own.own.contact??at:(this.isForm?FORM_CONTACT[state.fighter]?.[slot]:undefined)??(earlier?earlier.contact??at:undefined)??CONTACT_FRACTION[state.fighter]?.[slot]??at;
    // A ground smash falling holds the pose before its blow until its feet are down (the simulation strikes on landing).
    const t=this.plunge(state,THREE.MathUtils.clamp(state.actionTime,0,1),at);
    if(!clip)return melee?Fighter.strike(t,at,fraction):null;
    // Preserve the clip's continuous motion clock for naturally paced throws.
    // Forcing every release marker through the melee clock creates abrupt
    // acceleration and recovery snaps (notably Ram and Scorched Earth).
    const natural=fraction*clip.duration/(at*state.actionDuration);
    if(area&&!area.full){
      if(t<=at){const wound=Fighter.windUp(t,at,fraction,state.actionDuration,clip,natural);this.chargeWanted=wound.hold;return wound.progress;}
      this.chargeWanted=0;
      return fraction+(1-fraction)*.12*THREE.MathUtils.smoothstep((t-at)/Math.max(.001,1-at),0,1);
    }
    const anchoredRelease=!ender&&(state.fighter==='kagari'&&slot==='special'||!!move.aimOnRelease);
    if(!melee&&!anchoredRelease&&natural>=PACE_BAND[0]&&natural<=PACE_BAND[1])return clipAtMotion(clipMotionTable(clip),t);
    // The wind-up (`windUp`) and the follow-through (`followThrough`) both
    // put the contact frame on the contact, so the seam at contact is exact
    // in position - and, since round 3c, in speed.
    if(t<=at){
      const wound=Fighter.windUp(t,at,fraction,state.actionDuration,clip,natural);
      this.chargeWanted=wound.hold;
      return wound.progress;
    }
    // Round 3c: the follow-through goes on from the speed the drive arrived
    // at, read off the wind-up's last sixtieth of a second (see
    // `followThrough`). It used to be eased from the contact at twice its
    // own average speed, whatever the drive had been doing: Ward's Rush 1
    // arrived at 0.57x and left at 5.6x, and his hand moved 1.25 m in the
    // frame after the blow.
    this.chargeWanted=0;
    const probe=Math.max(0,at-1/(60*state.actionDuration));
    const before=Fighter.windUp(probe,at,fraction,state.actionDuration,clip,natural).progress;
    const tau=(t-at)*state.actionDuration,left=(1-at)*state.actionDuration,gap=at-probe;
    // Round 3d (PACE): a blow the impact freeze held on its contact was
    // stopped by the body it hit, and takes its follow-through up from rest.
    // Carried on at the speed of the drive into it - with the shorter
    // wind-ups, three to four times the clip's own rate - the first frame
    // after the freeze jumped between a still frame and a slower one.
    const stopped=Math.abs(this.clockHeldAt-at*state.actionDuration)<=FREEZE_LATE;
    // A follow-through with time to spare plays as drawn, in its footage, and
    // then holds.
    if((1-fraction)*clip.duration<=left*FOLLOW_MIN)
      return Fighter.followThrough(tau,left,fraction,clip.duration,stopped?0:gap>1e-6?(fraction-before)/(gap*state.actionDuration):FOLLOW_MIN/clip.duration);
    // One that has to be hurried is hurried in the clip's motion, as the
    // wind-up is (see `clipMotionTable`): swept evenly through its footage it
    // crossed the bursts in it at whatever speed it was running - KoKo's
    // light turned a joint 55 degrees in a frame on the way out of its blow.
    const table=clipMotionTable(clip),contact=motionAt(table,fraction);
    const arrival=stopped?0:gap>1e-6?(contact-motionAt(table,before))/(gap*state.actionDuration):FOLLOW_MIN/clip.duration;
    return clipAtMotion(table,Fighter.followThrough(tau,left,contact,clip.duration,arrival));
  }
  /** Round 3d (ULTS): where in `clip` an ultimate is (see ULTIMATE_CLIPS), or
   *  undefined where its plan does not cover it - the time stops' strings,
   *  a fighter with no plan. Monotone in the move's clock within each phase:
   *  the confirm is a new clip, and a new epoch (see `phase`). */
  /** A fighter's ultimate plan as this body throws it: none on the fighter's own body where the plan is its form's alone. */
  private ultimatePlan(fighter:FighterId):UltimateClips|undefined{const plan=ULTIMATE_CLIPS[fighter];return plan?.formOnly&&!this.isForm?undefined:plan;}
  private ultimateCurve(state:PlayerState,clip:THREE.AnimationClip):number|undefined{
    const plan=this.ultimatePlan(state.fighter),move=this.moveFor(state);
    if(!plan||!state.actionDuration)return undefined;
    const D=state.actionDuration,t=THREE.MathUtils.clamp(state.actionTime,0,1)*D,L=Math.max(1e-3,clip.duration);
    const c0=move.contacts[0],last=move.contacts[move.contacts.length-1];
    if(plan.release!==undefined){
      // One clip, released on contact 0, swept evenly through its motion
      // (see clipMotionTable): the head skipped so the charge runs no faster
      // than the band allows, and the rest over the rest of the move.
      this.chargeWanted=0;
      const table=this.isForm&&state.fighter==='konta'&&clip.name==='Kurobi ultimate'?FOOTAGE_TABLE:clipMotionTable(clip),r=motionAt(table,plan.release),from=Math.max(0,r-PACE_BAND[1]*c0/L);
      if(t<=c0)return clipAtMotion(table,from+(r-from)*(c0>1e-3?t/c0:1));
      return Math.min(.999,clipAtMotion(table,r+(1-r)*(t-c0)/Math.max(1e-3,D-c0)));
    }
    const confirmed=state.confirmedAt!==undefined,opener=this.isForm?plan.formOpener:plan.opener;
    if(!confirmed&&opener){
      // The opener: a single swing of its own clip, its blow on contact 0,
      // shaped as contactCurve shapes one (windUp, then followThrough), and
      // its follow-through across a whiff's recovery.
      if(clip.name!==opener.clip)return undefined;
      // Its wind-up swept through its motion from the clip's first frame - the
      // stance-like pose every entry blends into cleanly, out of any idle or
      // fidget - at up to OPENER_FASTEST its drawn pace (the head is skipped
      // only past that), driven into the blow over its last stretch.
      const span=c0+OPENER_TAIL,u=Math.min(1,t/span),at=c0/span,f=opener.at;
      const table=clipMotionTable(clip),mF=motionAt(table,f),mStart=Math.max(0,mF-OPENER_FASTEST*c0/L);
      const wound=(v:number)=>{const w=THREE.MathUtils.clamp(v/at,0,1),k=1-CINE_DRIVE;return clipAtMotion(table,mStart+(mF-mStart)*(w<k?CINE_BUILT*w/k:CINE_BUILT+(1-CINE_BUILT)*Math.pow((w-k)/CINE_DRIVE,1.6)));};
      this.chargeWanted=0;
      if(u<=at)return wound(u);
      const probe=Math.max(0,at-1/(60*span)),before=wound(probe);
      // In footage: never slower than it was drawn, up to FOLLOW_MAX faster.
      const tau=(u-at)*span,left=(1-at)*span,gap=at-probe;
      return Math.min(.999,Fighter.followThrough(tau,left,f,L,gap>1e-6?(f-before)/(gap*span):FOLLOW_MIN/L));
    }
    const cine=plan.cine;
    if(!cine)return undefined;
    this.chargeWanted=0;
    if(cine.windows){
      // A string of the cinematic's blows, one window each.
      const blows=move.contacts.length-1,w=cine.windows;
      if(w.length!==blows)return undefined;
      const edges=(k:number)=>k<=0?c0:k>=blows?D:(move.contacts[k]+move.contacts[k+1])/2;
      let k=0;while(k<blows-1&&t>=edges(k+1))k++;
      const from=edges(k),to=edges(k+1),span=Math.max(1e-3,to-from),u=THREE.MathUtils.clamp((t-from)/span,0,1);
      const [start,end,blow]=w[k],at=THREE.MathUtils.clamp((move.contacts[k+1]-from)/span,.08,.92),share=end-start;
      const fraction=blow!==undefined?THREE.MathUtils.clamp((blow-start)/Math.max(1e-3,share),.08,.92):at;
      return Math.min(.999,start+share*(u<=at?fraction*(u/at):fraction+(1-fraction)*(u-at)/(1-at)));
    }
    // From the opener to the finisher, the clip from `from` to its blow,
    // swept through its motion and gathering into the blow; after it, the
    // rest of the clip, a little quicker than the rest of the move.
    const table=clipMotionTable(clip),mFrom=motionAt(table,cine.from),mAt=motionAt(table,cine.at);
    // Built slowly through most of it - a fist being blown up, a blade held
    // back - then driven into the blow over the last CINE_DRIVE of it.
    const gather=(time:number)=>{
      const u=THREE.MathUtils.clamp((time-c0)/Math.max(1e-3,last-c0),0,1),k=1-CINE_DRIVE;
      const g=u<k?CINE_BUILT*u/k:CINE_BUILT+(1-CINE_BUILT)*Math.pow((u-k)/CINE_DRIVE,1.6);
      return clipAtMotion(table,mFrom+(mAt-mFrom)*g);
    };
    if(t<=last)return gather(t);
    // The follow-through in footage, from the speed the gather arrived at:
    // never slower than it was drawn (see followThrough).
    const probe=Math.max(c0,last-1/60),arrival=(gather(last)-gather(probe))/Math.max(1e-3,last-probe);
    return Math.min(.999,Fighter.followThrough(t-last,Math.max(1e-3,D-last),gather(last),L,arrival));
  }
  /** The wind-up of a single blow, contact excluded: where in the clip it is
   *  at `t` (at or before `at`), and how much of a held chamber that is. The
   *  wind-up is paced in the clip's motion rather than its footage - see
   *  `clipMotionTable` - unless it is a held chamber, which stays in footage
   *  in either measure: its creep is written in footage and the tremor
   *  covers the hold, and a creep in motion through a busy stretch of
   *  footage is a stall on screen. Both put the contact frame on the
   *  contact. Never a mix of the two paths at one instant: a blend of two
   *  monotone paths is monotone but its speed is neither's, and measured it
   *  put a sixty-nine degree frame into Kosho's Amuse-Bouche that neither path
   *  had. */
  private static windUp(t:number,at:number,fraction:number,D:number,clip:THREE.AnimationClip,natural:number){
    const table=natural>=PACE_BAND[0]?clipMotionTable(clip):null;
    const c=table?motionAt(table,fraction):fraction;
    if(!table||c*clip.duration/(at*D)<PACE_BAND[0])return Fighter.pace(t,at,fraction,D,clip.duration);
    const paced=Fighter.pace(t,at,c,D,clip.duration);
    return {progress:clipAtMotion(table,paced.progress),hold:paced.hold};
  }
  /** The follow-through of a single blow, as a fraction of its clip.
   *
   *  `tau` is the time since the contact and `T` what the move has left after
   *  it, in seconds; `c` is where the contact frame is in the clip, `L` the
   *  clip's length, and `arrival` how fast the clip was being played as the
   *  blow landed, in seconds of clip a second. The clip leaves the contact
   *  at the speed it arrived at and settles, over FOLLOW_EASE, onto the speed
   *  the rest of the move needs: what is left of the clip spread over what is
   *  left of the move, never slower than the clip was drawn (FOLLOW_MIN), so
   *  a follow-through with time to spare plays as drawn and then holds its
   *  last pose - which the stance takes over (see TAIL_AFTER) - and never
   *  faster than FOLLOW_MAX: a clip with more follow-through than that is
   *  left part-way, for the next move to blend out of. Monotone, continuous
   *  in speed at the contact, and never above either speed it moves between.
   *  In seconds throughout, so it holds for any wind-up and any move length:
   *  a shorter wind-up arrives faster and leaves as fast. */
  /** The feel pass: a swing's move time. Around each contact `c` (in seconds, inside its own window between
   *  the half-way points to its neighbours): the wind-up up to the last
   *  ANIME_DRIVE of the drive is drawn slower, held into the chamber; that last
   *  stretch of drive is drawn in ANIME_SNAP - the strike, a frame or two; the
   *  contact pose holds `hold`; and the follow-through catches up by the end
   *  of the window. Every contact is still drawn on its own time, so the
   *  simulation's blow lands on the clip's: the curves downstream (contactCurve
   *  and its kin) shape the clip exactly as before, on this clock. */
  static animeWarp(t:number,contacts:readonly number[],D:number,hold:number){
    for(let k=0;k<contacts.length;k++){
      const c=contacts[k],L=k===0?0:(contacts[k-1]+c)/2,R=k===contacts.length-1?D:(c+contacts[k+1])/2;
      if(t<L||t>R)continue;
      if(c-L<ANIME_MIN||R-c<ANIME_MIN)return t;
      const drive=Math.min(ANIME_DRIVE,ANIME_DRIVE_SHARE*(c-L)),snap=Math.min(ANIME_SNAP,drive*.6),held=Math.min(hold,(R-c)*.4);
      if(t<=c-snap)return L+(t-L)*(c-drive-L)/Math.max(1e-4,c-snap-L);
      if(t<=c)return c-drive+(t-(c-snap))*drive/Math.max(1e-4,snap);
      if(t<=c+held)return c;
      return c+(t-c-held)*(R-c)/Math.max(1e-4,R-c-held);
    }
    return t;
  }
  private static followThrough(tau:number,T:number,c:number,L:number,arrival:number){
    const left=1-c;
    if(left<=1e-6||L<=1e-6)return Math.min(1,c);
    // Rates in shares of the clip a second: the clip played as drawn is 1/L.
    const slowest=FOLLOW_MIN/L,fastest=FOLLOW_MAX/L;
    const start=THREE.MathUtils.clamp(Number.isFinite(arrival)?arrival:slowest,0,fastest);
    // The cruise that ends the clip exactly as the move ends, allowing for
    // the ease off the arrival speed; held between the two.
    const ease=FOLLOW_EASE*(1-Math.exp(-Math.max(0,T)/FOLLOW_EASE));
    const cruise=THREE.MathUtils.clamp(T-ease>1e-6?(left-start*ease)/(T-ease):slowest,slowest,fastest);
    const played=cruise*tau+(start-cruise)*FOLLOW_EASE*(1-Math.exp(-Math.max(0,tau)/FOLLOW_EASE));
    return Math.min(1,c+Math.max(0,Math.min(left,played)));
  }

  /** One blow, paced in seconds.
   *
   *  `strike` shapes a swing in fractions of the wind-up, which is right when
   *  the clip and the move roughly agree how long the blow takes. They often
   *  do not: the same 0.88 s of Mirage Draw is asked to fill a 1.19 s move
   *  and Gummy's 1.88 s Grand Tide a 7.8 s one, and a shape in fractions
   *  simply slows the whole clip down - a fighter wading through the air, or
   *  holding one pose for two and a half seconds. The other way round, a
   *  4.17 s Punch 01 on a 0.82 s barrage blurs.
   *
   *  So outside the band the segments are sized in seconds. Too little clip:
   *  the draw-back plays at about three quarters speed, the drive at about
   *  the speed it was drawn, and what is left of the wind-up is a HELD
   *  chamber that still creeps forward - never motionless - with the
   *  procedural layer putting a charge tremor and a breath over it. Too much
   *  clip: the head of the clip is skipped so the draw runs no faster than
   *  the band allows, and the tail is capped the same way. The contact frame
   *  lands on the contact time in every case, which is the invariant
   *  everything else here rests on. */
  private static pace(t:number,at:number,c:number,D:number,L:number):{progress:number;hold:number}{
    const Tc=at*D,natural=c*L/Tc;
    if(natural>=PACE_BAND[0]&&natural<=PACE_BAND[1])return {progress:Fighter.strike(t,at,c,THREE.MathUtils.smoothstep(natural,SHAPE_FULL,SHAPE_NONE)),hold:0};
    if(natural>PACE_BAND[1]){
      // Skip the head. The draw is then at the top of the band rather than
      // at whatever the ratio happened to be.
      const s0=Math.max(0,c-PACE_BAND[1]*Tc/L);
      const e1=Math.min(1,c+PACE_TAIL_MAX*(D-Tc)/L);
      if(t<=at){const u=at>1e-4?t/at:1;return {progress:s0+(c-s0)*Math.pow(u,SKIP_SHAPE),hold:0};}
      const u=at<1-1e-4?(t-at)/(1-at):1;
      return {progress:Math.min(e1,c+Math.max((e1-c)*u*(2-u),RECOVERY_FLOOR*(t-at)*(e1-c))),hold:0};
    }
    // Too little clip for the wind-up.
    if(t<=at){
      const u=t*D;
      const driveSec=THREE.MathUtils.clamp((1-STRIKE_COILED)*c*L/1.15,.06,.24*Tc);
      const drawSec=THREE.MathUtils.clamp(STRIKE_DRAWN*c*L/.75,.06,.42*Tc);
      const settleSec=Math.max(0,Tc-drawSec-driveSec);
      const settleContent=Math.min(c*.5,PACE_CREEP*settleSec/D);
      const drawContent=Math.max(0,c-(1-STRIKE_COILED)*c-settleContent);
      // A hold is a hold only when there is really time in it.
      const hold=THREE.MathUtils.smoothstep(settleSec,.25,.6);
      if(u<drawSec){const v=u/drawSec;return {progress:drawContent*v*v*(3-2*v),hold:0};}
      if(u<drawSec+settleSec){
        const v=(u-drawSec)/Math.max(1e-4,settleSec);
        return {progress:drawContent+settleContent*v,hold:hold*Math.sin(v*Math.PI)};
      }
      const v=THREE.MathUtils.clamp((u-drawSec-settleSec)/Math.max(1e-4,driveSec),0,1);
      return {progress:drawContent+settleContent+(1-STRIKE_COILED)*c*Math.pow(v,STRIKE_DRIVE),hold:0};
    }
    // The follow-through plays at the speed it was drawn and then holds the
    // last pose, which is a fighter recovering their stance; before this it
    // was eased across the whole recovery at a third of its speed.
    const u=at<1-1e-4?(t-at)/(1-at):1;
    return {progress:Math.min(1,c+Math.max((1-c)*u*(2-u),RECOVERY_FLOOR*(t-at),(t-at)*D/L)),hold:0};
  }

  /** One blow, shaped: draw back, settle, drive, follow through.
   *
   *  `t` is how far through the swing, `at` where in it the blow lands, and
   *  `fraction` where in the clip that blow is drawn. A strike is not one
   *  speed, and it is not a chamber held for most of the move either: shaping
   *  it as a long hold followed by a short drive left Kenzo's heavy advancing
   *  its clip by seven per cent over its first nine hundred milliseconds,
   *  which on screen is a fighter standing still and then blurring. The
   *  draw-back keeps most of the motion, the settle is a beat rather than a
   *  wait, and the drive is fast. */
  private static strike(t:number,at:number,fraction:number,soft=0){
    if(t<=at){
      const u=at>1e-4?t/at:1;
      // `soft` flattens the wind-up toward an even sweep. The draw-settle-
      // drive is for a clip with more time than footage, where an even
      // sweep wades; a clip already being compressed does not need a shape
      // whose draw runs at 1.9x and drive at 1.6x the wind-up's average on
      // top of the compression - measured, that put a 57 degree frame on
      // Hachoir's hips at 1.2x. See `pace`.
      if(soft>=1)return fraction*u;
      const shaped=Fighter.strikeShape(u,fraction);
      return soft>0?THREE.MathUtils.lerp(shaped,fraction*u,soft):shaped;
    }
    // Ease out of the blow, and never below the recovery floor: the last pose
    // held is a fighter resetting their stance, the same pose crawled toward is
    // a dropped frame rate. Both terms rise with `t`, so the result cannot.
    const u=at<1-1e-4?(t-at)/(1-at):1;
    return Math.min(1,fraction+Math.max((1-fraction)*u*(2-u),RECOVERY_FLOOR*(t-at)));
  }
  /** The wind-up's shape alone: draw, settle, drive. */
  private static strikeShape(u:number,fraction:number){
    {
      // Eased in as well as out. A sine ease-out had its fastest frame on
      // the first one - the frame the blend from the idle is also weakest
      // on - and a draw-back that opens at 1.57x its own average is where
      // the pop out of idle came from on every swing measured. An
      // ease-in-out peaks in the middle of the draw at the same 1.5x and
      // opens from rest, the way an animator draws anticipation.
      if(u<=STRIKE_DRAW){const v=u/STRIKE_DRAW;return fraction*STRIKE_DRAWN*v*v*(3-2*v);}
      if(u<=STRIKE_SETTLE){
        const v=(u-STRIKE_DRAW)/(STRIKE_SETTLE-STRIKE_DRAW);
        return fraction*(STRIKE_DRAWN+(STRIKE_COILED-STRIKE_DRAWN)*v*v*(3-2*v));
      }
      const v=(u-STRIKE_SETTLE)/(1-STRIKE_SETTLE);
      return fraction*(STRIKE_COILED+(1-STRIKE_COILED)*Math.pow(v,STRIKE_DRIVE));
    }
  }

  /** A string of blows, each shaped like one. The clip is divided between the
   *  contacts and each share is driven by the same curve, so a barrage
   *  re-chambers between hits instead of sweeping evenly through all of them -
   *  the moves that should be the most exciting were the only ones with no
   *  snap in them at all. A phase too short to hold a beat falls back to a
   *  straight sweep rather than vibrating. */
  private stringCurve(state:PlayerState,move:MoveDefinition){
    const contacts=move.contacts,count=contacts.length;
    const elapsed=THREE.MathUtils.clamp(state.actionTime,0,1)*state.actionDuration;
    const edges=[0,...contacts.slice(1).map((c,i)=>(c+contacts[i])/2),state.actionDuration];
    let phase=0;
    while(phase<count-1&&elapsed>=edges[phase+1])phase++;
    const from=edges[phase],to=edges[phase+1],span=Math.max(1e-3,to-from);
    // Which part of the clip this blow lives in: an authored window where the
    // clip is a multi-punch combination, an equal share otherwise.
    const windows=(this.isForm?FORM_STRING_WINDOWS[state.fighter]?.[state.action as AttackSlot]:undefined)??STRING_WINDOWS[state.fighter]?.[state.action as AttackSlot];
    const window=windows&&windows.length===count?windows[phase]:undefined;
    const base=window?window[0]:phase/count,share=window?window[1]-window[0]:1/count;
    const t=THREE.MathUtils.clamp((elapsed-from)/span,0,1);
    if(span<STRING_FLOOR)return base+share*t;
    const at=THREE.MathUtils.clamp((contacts[phase]-from)/span,.08,.92);
    if(!window)return base+share*Fighter.strike(t,at,at);
    // An authored window already holds the blow's own snap - the first punch
    // of Konta's barrage crosses 0.72 m of hand travel in 0.07 s of clip -
    // so it is swept linearly through its contact. Shaping it as a strike
    // as well concentrated that authored snap into one frame: measured, the
    // hand moved 0.76 m between two drawn frames.
    const fraction=window[2]!==undefined?THREE.MathUtils.clamp((window[2]-window[0])/share,.08,.92):at;
    return base+share*(t<=at?fraction*(t/at):fraction+(1-fraction)*(t-at)/(1-at));
  }

  private groundedMelee(state:PlayerState){
    // A rush stage past the first is its own clip on its own timing.
    // A combo ender is its own move with its own clip (comboClips.ts), never Cloudstep.
    if(state.fighter!=='taisei'||(state.action!=='light'&&state.action!=='heavy')||this.rushStage(state)||Fighter.ender(state))return;
    // Round 4b (COMBAT): off the floor his light is his air string's own opener (AIR_STRING_CLIPS), not the Rock.
    if(state.action==='light'&&!state.grounded&&this.airStageClip(0))return;
    // Round 3 (MOVES): the heavy is Cloudstep, authored on its own clock and played straight through.
    if(state.action==='heavy'){const clip=this.clip(`melee ${TAISEI_TRANSMISSION}`);if(clip)return {clip,phase:TAISEI_TRANSMISSION,progress:THREE.MathUtils.clamp(state.actionTime,0,.999),contact:MOVES.taisei.heavy.contacts[0],elapsed:state.actionTime*state.actionDuration};}
    const move=MOVES.taisei[state.action],elapsed=state.actionTime*state.actionDuration;
    const boundaries=[0,...move.contacts.slice(1).map((contact,i)=>(contact+move.contacts[i])/2),move.duration];
    const phase=Math.min(move.contacts.length-1,boundaries.slice(1).filter(end=>elapsed>=end).length);
    const measured=TAISEI_MELEE_CONTACTS[phase];
    const clip=this.clip(`melee ${phase}`);
    if(!clip)return;
    const contact=move.contacts[phase],start=boundaries[phase],end=boundaries[phase+1];
    const peak=measured.peak;
    const punch=phase<2;
    const holdEnd=Math.min(end-.025,contact+(punch?.025:.075));
    let progress:number;
    if(elapsed<=contact){
      // Distribute the actual wind-up motion across the available time. The
      // old fixed 50 ms drive compressed most of Rock into three frames.
      // The measured contact pose remains exactly on the server's contact.
      const u=THREE.MathUtils.clamp((elapsed-start)/Math.max(.001,contact-start),0,1);
      const table=clipMotionTable(clip);
      progress=clipAtMotion(table,motionAt(table,peak)*Math.pow(u,1.15));
    }else{
      const recoveryEnd=punch?Math.min(end,holdEnd+.08):end;
      progress=elapsed<=holdEnd?peak:peak+Math.min(1,(elapsed-holdEnd)/(recoveryEnd-holdEnd))*(1-peak);
    }
    return {clip,phase,progress,contact,elapsed};
  }
  /** The move's clock as the clip is drawn from it.
   *
   *  Round 3c. The second blind critic counted 145 one-frame pops across the
   *  roster - a hand jumping up to 1.25 m, a head up to 44 cm in a sixtieth of
   *  a second - with the clip time holding for one to three frames and then
   *  jumping by up to 0.47 s. Two of the three things that did it were the
   *  clock rather than the clip:
   *   - the local copy's move clock is the simulation's, stepped once per
   *     60 Hz input tick, and the drawn frame does not share that phase: a
   *     frame that saw no tick held the clip and the next, seeing two, moved
   *     it twice as far. With a fast swing on either side, that is a still
   *     frame followed by a jump;
   *   - a blow the server confirms reaches the attacker a round trip after
   *     the predicted swing landed and froze on the simulation's own hitstop,
   *     and `impact` held the clip for another 50-70 ms while the move's
   *     clock ran on - by then usually in the NEXT stage's wind-up, or the
   *     chase dash after a finisher - and then the clip jumped to wherever
   *     the clock had got to. Ward's dash went from 0.56 to 1.03 s of clip in
   *     one frame.
   *  So the clip is drawn off a clock of its own. It runs on the time that
   *  really passed and is steered onto the move's clock (MOVE_CLOCK_GAIN):
   *  a tick seen late or twice is smoothed out rather than drawn. It holds
   *  where the move holds - the simulation's hitstop, a time stop - and for a
   *  confirmed blow only when the blow is the one being drawn (FREEZE_EARLY),
   *  and after any hold it catches up by running faster for a few frames,
   *  never by jumping. It never runs backwards inside one move and starts
   *  each move where the move's clock is; a clock that is not stepping in
   *  ticks (the snapshot timeline a remote body is drawn from is already
   *  continuous), or has moved further than MOVE_CLOCK_BAND off the drawn
   *  one - a correction, a test setting a time - is taken as it comes.
   *  Reactions keep the server's clock: they are its. */
  private stepMoveClock(state:PlayerState,real:number,finite:boolean,recoil:boolean){
    const duration=state.actionDuration;
    Object.assign(this.drawn,state);
    const seconds=state.actionTime*duration;
    // A freeze raised since the last frame: does it hold the clip?
    if(this.hitFreeze>this.freezeSeen+1e-6){
      let honoured=true;
      if(this.strikeContact){
        // The attacker's own: only on the blow being drawn, and only if the
        // move has not already held on it - the local copy of the simulation
        // freezes the swing on its own contact (its hitstop), a round trip
        // before the server says so, and holding it again for the news put a
        // second stop into Gummy's Rogue Wave a few frames after the first.
        honoured=false;
        if(ATTACK_SLOTS.has(state.action)&&duration>0){
          const at=this.moveClock;
          for(const contact of this.moveFor(state).contacts)
            if(at>=contact-FREEZE_EARLY&&at<=contact+FREEZE_LATE&&!(this.clockHeldAt>=contact-FREEZE_EARLY&&this.clockHeldAt<=at+1e-6)){honoured=true;break;}
        }
      }
      this.freezeHonoured=honoured;
    }
    const stage=this.rushStage(state),seq=ATTACK_SLOTS.has(state.action)?state.actionSeq:undefined;
    const fresh=!finite||recoil||!(duration>0)||state.action!==this.clockAction||stage!==this.clockStage||seq!==this.clockSeq
      ||state.actionTime<this.clockTime-.25||(state.actionStarted>this.clockStarted+1e-6&&state.actionTime<.1);
    // How far the move's own clock moved since the last frame, in ticks.
    const ticks=(seconds-this.clockSeconds)/MOVE_TICK;
    this.clockAction=state.action;this.clockStage=stage;this.clockSeq=seq;this.clockTime=state.actionTime;this.clockStarted=state.actionStarted;this.clockSeconds=seconds;
    const previous=this.moveClock;
    if(fresh){this.moveClock=seconds;this.clockLag=0;this.clockHeldAt=state.hitstop?seconds:-Infinity;}
    else if(state.hitstop||state.timeStopped){
      if(state.hitstop)this.clockHeldAt=this.moveClock;
      // A hold the move itself makes. The last tick before it may not have
      // been drawn yet: that much is caught up, at no more than real time.
      const target=seconds-this.clockLag;
      if(this.moveClock<target)this.moveClock=Math.min(target,this.moveClock+real);
    }else if(this.hitFreeze>0&&this.freezeHonoured){
      // A confirmed blow held on the frame it is drawn: the move runs on and
      // the drawn clock owes it the difference.
      this.clockLag=Math.max(0,seconds-this.moveClock);
    }else{
      // What is owed is paid back smoothly; and a clock that moved in whole
      // ticks - none this frame, two the next - is drawn at the time that
      // really passed and steered onto it, as long as it stays within a
      // couple of ticks. Anything else - a clock not on the tick grid (the
      // snapshot timeline), a test setting a time - is drawn as it is.
      this.clockLag*=Math.exp(-MOVE_CLOCK_GAIN*real);
      const target=seconds-this.clockLag,free=this.moveClock+real;
      const quantised=ticks>-1e-6&&ticks<3.5&&Math.abs(ticks-Math.round(ticks))<1e-3;
      this.moveClock=quantised&&real>0&&real<3*MOVE_TICK&&Math.abs(target-free)<=MOVE_CLOCK_BAND
        ?target+(free-target)*Math.exp(-MOVE_CLOCK_GAIN*real):target;
    }
    if(!fresh)this.moveClock=Math.max(this.moveClock,previous);
    if(duration>0){this.moveClock=Math.min(this.moveClock,duration);this.drawn.actionTime=this.moveClock/duration;}
    // The feel pass: a melee swing drawn on the snap-and-hold timing
    // (see animeWarp). Ultimates keep their own cinematic clocks.
    if(duration>0&&!recoil&&Fighter.animStyle!=='classic'&&state.action!=='ultimate'&&ATTACK_SLOTS.has(state.action)){
      const move=this.moveFor(state);
      if(move.style==='melee'){
        const big=!!Fighter.ender(state)||state.action==='special'||this.rushStage(state)>=RUSH_STAGES-1;
        this.drawn.actionTime=Fighter.animeWarp(this.moveClock,move.contacts,duration,big?ANIME_HOLD.big:state.action==='heavy'?ANIME_HOLD.heavy:ANIME_HOLD.light)/duration;
      }
    }
    return this.drawn;
  }
  static transitions:Record<TransitionKind,'inertial'|'frozen'>={attack:'inertial',motion:'frozen',reaction:'frozen',struck:'frozen',loop:'frozen'};
  private blendMode:'inertial'|'frozen'='frozen';
  /** The kind of the transition being drawn (see `startPoseBlend`). */
  private blendKind:TransitionKind='motion';
  /** The step the last pose was produced on, for the outgoing velocity. */
  private lastBlendDt=0;
  /** True while a transition is still being drawn. */
  private get transitioning(){return this.blendTime<this.blendDuration;}
  private startPoseBlend(duration:number,rootDuration=duration,kind:TransitionKind='motion'){
    this.blendMode=Fighter.transitions[kind];this.blendKind=kind;
    this.rootFromClamped=this.rootClamped;this.rootDrawnFrom.copy(this.rootDrawnLast);
    this.blendDuration=duration;this.blendTime=0;
    this.rootBlendDuration=rootDuration;this.rootBlendTime=0;
    const rate=this.blendMode==='inertial'&&this.lastBlendDt>1e-4?1/this.lastBlendDt:0;
    // Not the legs, and not the pelvis they hang from. Below the waist the
    // pose is the foot planter's as much as the clip's: carrying a striding
    // leg's swing - or the pelvis's sway, which is the IK's base - into a
    // stop, a guard or a swing drives the leg across a planted foot, and the
    // IK answers with the hip. Measured, Taisei's run into his jab turned a
    // thigh 72 degrees in a frame where the crossfade turned it 49, and
    // Konta's run into his guard 68 against 51; with the procedural layer
    // off the same seams were neutral. The upper body carries its motion;
    // the lower body is carried by its feet. Carrying the legs only while
    // standing, where nothing is planted, was tried: it bought rush seams
    // half a degree of smoothness and cost a get-up into idle four degrees
    // and a start of a run nearly five, through the same IK.
    const legs=this.strideNodes();
    // Capture the pose the animation system last produced, including an
    // interrupted transition, and not what the procedural layer left in the
    // bones afterwards. The lean is fifty-two degrees of aim and a third of a
    // radian of tilt, and it is reapplied in full on top of whatever this
    // blend produces - so capturing it here carried close to double the
    // intended offset through the first frames of every transition. It also
    // makes this independent of where in the frame it is called from.
    for(const pose of this.poseNodes){
      pose.fromPosition.copy(pose.blendPosition);pose.fromRotation.copy(pose.blendRotation);pose.fromScale.copy(pose.blendScale);
      // The same two animation-only poses give the velocity it was moving at.
      const carry=legs.has(pose.node)||this.rootChain.has(pose.node)?0:rate;
      rotationVector(_spin.copy(pose.blendRotation).multiply(_spinInverse.copy(pose.prevRotation).invert()),pose.sourceSpin);
      if(pose.sourceSpin.lengthSq()>FLIP_STEP*FLIP_STEP)pose.sourceSpin.set(0,0,0);
      pose.sourceSpin.multiplyScalar(carry).clampLength(0,SPIN_CARRY);
      pose.sourceDrift.subVectors(pose.blendPosition,pose.prevPosition).multiplyScalar(carry).clampLength(0,DRIFT_CARRY);
      pose.crossTarget.set(0,0,0,0);
    }
  }
  /** The crossfade of one joint, from where the transition found it toward
   *  the incoming clip. A plain slerp takes the shorter way round, which is
   *  right until the incoming clip, still turning, carries the joint across
   *  the far side of the pose it is leaving: then the shorter way is the
   *  other way, and the joint flips round in a frame. Round 3d (PACE): the
   *  shorter wind-ups start more clips part-way in (`pace` skips the head),
   *  often half a turn from an idle's fidget - Kosho's cigarette into
   *  Hachoir flipped a hand 145 degrees in a frame. So the target is kept
   *  sign-continuous from frame to frame and the blend goes on the way it
   *  started. While the two stay within half a turn this is the plain slerp. */
  private static crossfade(pose:PoseNode,weight:number){
    const from=pose.fromRotation,target=pose.sampleRotation,last=pose.crossTarget;
    const unset=last.x===0&&last.y===0&&last.z===0&&last.w===0;
    const toward=unset?from:last;
    const s=target.x*toward.x+target.y*toward.y+target.z*toward.z+target.w*toward.w<0?-1:1;
    last.set(target.x*s,target.y*s,target.z*s,target.w*s);
    const cos=from.x*last.x+from.y*last.y+from.z*last.z+from.w*last.w;
    if(cos>=0){pose.node.quaternion.slerpQuaternions(from,target,weight);return;}
    // Past the far side since the blend began: on round the long way.
    const theta=Math.acos(Math.max(-1,cos)),sin=Math.sin(theta);
    if(sin<1e-6){pose.node.quaternion.copy(weight<.5?from:last);return;}
    const a=Math.sin((1-weight)*theta)/sin,b=Math.sin(weight*theta)/sin;
    pose.node.quaternion.set(from.x*a+last.x*b,from.y*a+last.y*b,from.z*a+last.z*b,from.w*a+last.w*b).normalize();
  }
  private restoreSampledPose(){
    // PropertyMixer skips unchanged channels. Restore their sampled values
    // before applying a fresh blend so constant tracks cannot accumulate drift.
    for(const pose of this.poseNodes){pose.node.position.copy(pose.samplePosition);pose.node.quaternion.copy(pose.sampleRotation);pose.node.scale.copy(pose.sampleScale);}
  }
  private applyPoseBlend(dt:number){
    this.blendTime+=dt;this.rootBlendTime+=dt;
    const linear=this.blendDuration>0?Math.min(1,this.blendTime/this.blendDuration):1;
    const weight=linear*linear*(3-2*linear);
    const rootLinear=this.rootBlendDuration>0?Math.min(1,this.rootBlendTime/this.rootBlendDuration):1;
    const rootWeight=rootLinear*rootLinear*(3-2*rootLinear);
    // How far the carried velocity has taken the pose, in seconds of it: the
    // Hermite curve's velocity term, which starts at one and ends at rest.
    const inertial=this.blendMode==='inertial';
    const carried=inertial&&linear<1?(linear-2*linear*linear+linear*linear*linear)*this.blendDuration:0;
    const rootCarried=inertial&&rootLinear<1?(rootLinear-2*rootLinear*rootLinear+rootLinear*rootLinear*rootLinear)*this.rootBlendDuration:0;
    for(const pose of this.poseNodes){
      pose.prevPosition.copy(pose.blendPosition);pose.prevRotation.copy(pose.blendRotation);
      pose.samplePosition.copy(pose.node.position);pose.sampleRotation.copy(pose.node.quaternion);pose.sampleScale.copy(pose.node.scale);
      // The root's position on its own clock: see `rootBlendDuration`.
      const travels=this.rootChain.has(pose.node);
      const positional=travels?rootWeight:weight;
      if(positional<1)pose.node.position.lerpVectors(pose.fromPosition,pose.samplePosition,positional);
      if(weight<1){Fighter.crossfade(pose,weight);pose.node.scale.lerpVectors(pose.fromScale,pose.sampleScale,weight);}
      if(carried>0)pose.node.quaternion.premultiply(fromRotationVector(_turn.copy(pose.sourceSpin).multiplyScalar(carried),_spin));
      const drift=travels?rootCarried:carried;
      if(drift>0)pose.node.position.addScaledVector(pose.sourceDrift,drift);
      // Recorded on both branches, so a settled pose is as correct a starting
      // point for the next transition as a mid-blend one.
      pose.blendPosition.copy(pose.node.position);pose.blendRotation.copy(pose.node.quaternion);pose.blendScale.copy(pose.node.scale);
    }
    this.rootGrip=rootWeight;
    // How fast the animation alone is moving: the busiest joint's turn this
    // frame, a second, over the joints that make the silhouette - the
    // spine, the head, the shoulders, the upper arms and the legs. Not the
    // forearms and hands: Shirokane's seal turns both hands four degrees a
    // frame in front of a body that does not move at all, and on screen
    // that is a statue. See `holdLife`.
    if(dt>0){
      this.holdJoints??=new Set([...this.joints].filter(([name])=>!/hand|forearm|toe/i.test(name)).map(([,bone])=>bone as THREE.Object3D));
      let fastest=0;
      for(const pose of this.poseNodes)if(this.holdJoints.has(pose.node))fastest=Math.max(fastest,pose.prevRotation.angleTo(pose.blendRotation));
      this.animSpeed=fastest/dt;
    }
    this.lastBlendDt=dt;
  }
  private samplersFor(clip:THREE.AnimationClip){
    let tracks=this.poseSamplers.get(clip);
    if(!tracks){
      // The interpolants are the clip's, shared by every body that plays it:
      // each read is copied out at once, and the index an interpolant keeps
      // is only where its next search starts. Round 3c: building them per
      // body, and finding every track's node by a search of the whole rig,
      // cost Konta's 1224-track clips 3 ms each on the frame they were first
      // drawn (see `prepareMoves`).
      let shared=clipSamplers.get(clip);
      if(!shared){
        shared=[];
        for(const track of clip.tracks){
          const parsed=THREE.PropertyBinding.parseTrackName(track.name);
          if(!['position','quaternion','scale'].includes(parsed.propertyName))continue;
          // GLTFLoader installs the correct quaternion/cubic interpolant factory.
          const factory=track as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant};
          shared.push({name:parsed.nodeName,property:parsed.propertyName,interpolant:factory.createInterpolant()});
        }
        clipSamplers.set(clip,shared);
      }
      tracks=[];
      for(const sampler of shared){const node=this.nodeNamed(sampler.name);if(node)tracks.push({node,property:sampler.property,interpolant:sampler.interpolant});}
      this.poseSamplers.set(clip,tracks);
    }
    return tracks;
  }
  /** The rig's nodes by name, first in the order PropertyBinding.findNode
   *  searches them (the model itself, then depth first), built once: a track
   *  bound by searching the whole rig for its node, a thousand tracks a clip,
   *  was most of what a body cost to build. */
  private nodesByName?:Map<string,THREE.Object3D>;
  private nodeNamed(name:string){
    if(!this.nodesByName){
      const map=new Map<string,THREE.Object3D>([[this.model.name,this.model]]);
      this.model.traverse(node=>{if(node!==this.model&&!map.has(node.name))map.set(node.name,node);});
      this.nodesByName=map;
    }
    return this.nodesByName.get(name);
  }

  /** How far the visible pose is from where a clip begins, as a mean joint
   *  angle in radians. A blend long enough to carry a knockdown into a get-up
   *  is far too long for a jab returning to its own stance, and one length for
   *  both is why recoveries used to float. */
  /** How far the clip's pose at `at` seconds is from the pose being drawn.
   *  `at` is where the clip will actually START: `pace` skips the head of a
   *  clip with more wind-up than the move has time for, and measuring frame
   *  zero of a clip that starts a fifth of a second in scored Fang Crossing's
   *  entry as a near pose and handed it the shortest blend the clamp allows -
   *  three frames, over a sword arm that then turned forty degrees a frame. */
  private poseDistance(clip:THREE.AnimationClip,at=0){
    let total=0,count=0,travel=0,widest=0;
    for(const track of this.samplersFor(clip)){
      const pose=this.poseByNode.get(track.node);
      if(track.property==='position'){
        // How far the body itself has to travel, which the angles cannot see.
        // These rigs carry an attack's whole advance on the root's position
        // track - Kenzo's heavy ends 1.85 m from where the idle wants him, and
        // Gummy's 2.25 - and measuring only rotations scored that at 0.014 rad
        // and handed it the shortest blend the clamp allows. The body was then
        // dragged home at up to 29.5 m/s in an eighth of a second, which is
        // the snap out of a swing those four fighters have on every attack.
        if(track.node!==this.rootBone)continue;
        _blendTarget2.fromArray(track.interpolant.evaluate(at) as unknown as number[]);
        travel=_blendTarget2.distanceTo(pose?.blendPosition??(track.node as THREE.Object3D).position);
        continue;
      }
      if(track.property!=='quaternion')continue;
      // Canonical body joints only. Taking every track means an average over
      // whatever the rig happens to carry, and taking the largest is worse:
      // measured at the frame a swing ends, the biggest rotations in the file
      // belong to effect helpers, weapon controllers, elastic arm joints and
      // Kosho's cigarette - 1.91 rad on the cigarette against 0.03 on his leg.
      // The skeleton resolver already knows which bones are a body.
      if(!this.bodyJointSet.has(track.node as THREE.Object3D))continue;
      _blendTarget.fromArray(track.interpolant.evaluate(at) as unknown as number[]);
      // Against the blended pose, not the live bone: the live one has the lean
      // and the gaze baked into it, so the distance - and with it the length
      // of the transition - was being measured off a pose the clips never had.
      const angle=_blendTarget.angleTo(pose?.blendRotation??(track.node as THREE.Object3D).quaternion);
      total+=angle;widest=Math.max(widest,angle);
      count++;
    }
    this.poseGapMax=widest;
    // A metre of body travel counts for about as much as a radian of joint,
    // which is what puts a two-metre return at the ceiling and leaves a jab
    // returning to its own stance at the floor.
    return (count?total/count:0)+travel*ROOT_TRAVEL_WEIGHT;
  }
  /** The largest single-joint gap the last `poseDistance` saw, in radians.
   *  The mean is what sizes a transition; the widest joint is what shows.
   *  Kosho's idle has his hands in his pockets and Amuse-Bouche swings the arms:
   *  the mean over twenty joints called that a near pose and gave the entry
   *  three frames, and the forearm turned fifty-five degrees in one. */
  private poseGapMax=0;
  /** The canonical skeleton as a set, for `poseDistance`. */
  private get bodyJointSet(){
    if(!this.bodyJoints){this.bodyJoints=new Set<THREE.Object3D>();for(const bone of this.joints.values())this.bodyJoints.add(bone);}
    return this.bodyJoints;
  }

  /** Where in a gait clip the shared stride clock is, in seconds.
   *
   *  `gait` counts steps travelled, so multiplying it by each clip's own
   *  seconds-per-step lines the two clips up by step INDEX. Nothing in that
   *  says which foot is down. Measured by scripts/measure_gait_phase.mts -
   *  correlating (leftAnkle.y - rightAnkle.y) between the two clips over this
   *  very clock - Taisei and Ouga came out in near-perfect ANTI-phase, at
   *  -0.75 and -0.78, so the per-bone slerp underneath was mixing a
   *  left-forward pose against a right-forward one and the two cancelled: peak
   *  foot separation 0.54 m against the run clip's own 1.14 for Taisei, and 0.46
   *  against 0.99 for Ouga. Both of them shuffled.
   *
   *  `phase` is the offset, in steps, that maximises that correlation. It
   *  takes Taisei to 0.99 and a 1.08 m stride and Ouga to 0.98 and 0.93 m.
   *  The other five blended fighters have mismatched step counts - three
   *  against four, four against three, three against two - so no constant
   *  offset can hold them in parity; measured, it costs them almost nothing
   *  (stride within a tenth of the run clip's either way) and the offset still
   *  takes their correlation from around -0.2 to around +0.3. */
  /** Which cadence table row this body reads: a transformation's body has its
   *  own run and dash, measured separately - the bouncing form's run is not Gummy's. */
  private get cadenceKey(){return (this.isForm?`${this.state.fighter}-form`:this.state.fighter) as FighterId;}
  /** How many of the locomotion speed's units make a metre of the world's travel (see WORLD_GAIT_FORMS): 1 for everyone
   *  but the forms listed there. */
  private get gaitScale(){return this.isForm&&WORLD_GAIT_FORMS.has(this.state.fighter)?(this.group.scale.x||1):1;}
  private gaitTime(clip:THREE.AnimationClip,which:'run'|'walk'){
    const cadence=CADENCE[this.cadenceKey]?.[which];
    const step=cadence&&cadence.step>0?cadence.step:clip.duration/2;
    const at=(this.gait+(cadence?.phase??0))*step;
    return ((at%clip.duration)+clip.duration)%clip.duration;
  }
  /** True while the fighter is crossing the floor and has both gaits to cross
   *  it with. Six of the ten do; the rest ship a sprint and nothing slower. */
  private get blended(){return this.state.action==='run'&&!!this.walkClip&&!!this.runClip&&this.walkClip!==this.runClip;}
  /** Everything below the hips, both sides. Built once. */
  private strideNodes(){
    if(!this.legNodes){
      const set=new Set<THREE.Object3D>();
      for(const leg of this.legs)leg.hip.traverse(node=>set.add(node));
      this.legNodes=set;
    }
    return this.legNodes;
  }
  /** Mix the fighter's own stance under the spent tail of a move; see
   *  TAIL_AFTER. Written into the bones after the clip is sampled and before
   *  the pose blend records them, so it is part of the animation - the
   *  transition out of the move starts from it, and the root clamp and every
   *  procedural layer act on top of it as they do on any clip. */
  private settleTail(dt:number,state:PlayerState){
    const active=this.active;
    if(!active||!(state.action==='heavy'||state.action==='special'||state.action==='ultimate')||!state.actionDuration){this.tailWeight=0;this.tailSince=0;return;}
    // The stance the idle is standing in now - the fight-ready one where the
    // profile has it and an opponent is close (round 3c).
    this.idleClip=this.idleRig?.stance()??this.idleClip??this.clipFor({...state,action:'idle'});
    const idle=this.idleClip,clip=active.getClip();
    if(!idle||idle===clip)return;
    const move=this.moveFor(state),elapsed=state.actionTime*state.actionDuration,last=move.contacts[move.contacts.length-1]??0;
    // Starts only with time left to show it; once started it runs until the
    // move hands over - backing out of the stance would be a pop, and the
    // only way out is the move ending, which starts from here.
    const spent=elapsed>last+.1&&active.time>=clip.duration*.995&&(this.tailSince>0||state.actionDuration-elapsed>TAIL_AFTER+TAIL_BLEND*.5);
    if(dt>0){
      this.tailSince=spent?this.tailSince+dt:0;
      this.tailTime+=dt;
    }
    const want=THREE.MathUtils.smoothstep(this.tailSince,TAIL_AFTER,TAIL_AFTER+TAIL_BLEND);
    this.tailWeight=spent?Math.max(this.tailWeight,want):0;
    if(this.tailWeight<1e-3)return;
    if(this.tailSince<=dt)this.tailTime=0;
    const at=this.tailTime%idle.duration,mix=this.tailWeight;
    for(const track of this.samplersFor(idle)){
      const value=track.interpolant.evaluate(at);
      if(track.property==='quaternion'){_blendTarget.fromArray(value as unknown as number[]);track.node.quaternion.slerp(_blendTarget,mix);}
      else if(track.property==='position'){_leanPoint.fromArray(value as unknown as number[]);track.node.position.lerp(_leanPoint,mix);}
    }
  }
  private sampleActivePose(){
    if(!this.active)return;
    const clip=this.active.getClip();
    const tracks=this.samplersFor(clip);
    // Reapply every channel, including constants: the mixer deliberately skips
    // unchanged properties, while pose blending edits the same transforms.
    for(const track of tracks){const value=track.interpolant.evaluate(this.active.time);if(track.property==='position')track.node.position.fromArray(value);else if(track.property==='quaternion')track.node.quaternion.fromArray(value);else track.node.scale.fromArray(value);}
    // Legs that keep walking while the arms do the work.
    if(this.stride>.004&&this.runClip&&clip!==this.runClip&&this.legs.length){
      const cadence=CADENCE[this.cadenceKey]?.run;
      const step=cadence&&cadence.step>0?cadence.step:this.runClip.duration/2;
      const at=(((this.strideClock*step)%this.runClip.duration)+this.runClip.duration)%this.runClip.duration;
      const nodes=this.strideNodes(),mix=this.stride;
      for(const track of this.samplersFor(this.runClip)){
        if(!nodes.has(track.node as THREE.Object3D))continue;
        const value=track.interpolant.evaluate(at);
        if(track.property==='quaternion'){
          _blendTarget.fromArray(value as unknown as number[]);
          (track.node as THREE.Object3D).quaternion.slerp(_blendTarget,mix);
        }else if(track.property==='position'){
          _leanPoint.fromArray(value as unknown as number[]);
          (track.node as THREE.Object3D).position.lerp(_leanPoint,mix);
        }
      }
    }
    // The other half of the gait, mixed in underneath.
    if(!this.blended||this.gaitBlend>=.998||clip!==this.runClip)return;
    const walk=this.walkClip!,at=this.gaitTime(walk,'walk'),mix=1-this.gaitBlend;
    for(const track of this.samplersFor(walk)){
      const value=track.interpolant.evaluate(at);
      if(track.property==='quaternion'){
        _blendTarget.fromArray(value as unknown as number[]);
        (track.node as THREE.Object3D).quaternion.slerp(_blendTarget,mix);
      }else if(track.property==='position'){
        _leanPoint.fromArray(value as unknown as number[]);
        (track.node as THREE.Object3D).position.lerp(_leanPoint,mix);
      }
    }
  }
  /** Cycle the legs under a guard.
   *
   *  Guard is a whole-body clip and the simulation keeps a blocking fighter
   *  moving at 2.2 m/s, so blocking and walking glided sideways with entirely
   *  static legs - the clearest thing left in the game that said it was not a
   *  real fighting game. The stride is written over the guard pose from the
   *  hips down, at the same measured cadence the run uses, and the chest is
   *  given the hips' turn straight back - so the arms, the torso and the block
   *  itself stay exactly where the guard clip aimed them.
   *
   *  What is not taken is the pelvis height. A guard stance sits between 9 cm
   *  (Shiden) and 27 cm (Taisei) lower than a walk, so dropping walk leg angles
   *  under a walk pelvis would drive the soles through the floor; keeping the
   *  guard's own height and letting `supportTransition` settle what is left is
   *  what reconciles the two. */
  private guardStride(dt:number,state:PlayerState,runSign:number){
    if(!this.dynamics||!this.legs.length)return;
    // Hysteresis on the threshold, because this is a whole leg appearing.
    const moving=this.locomotionSpeed>(this.strideWeight>.02?.3:.4);
    const wanted=GUARD_STRIDE.has(state.fighter)&&state.action==='guard'&&state.grounded&&moving&&!this.floating?1:0;
    // Eased over about an eighth of a second either way.
    this.strideWeight+=(wanted-this.strideWeight)*(1-Math.exp(-dt*24));
    if(this.strideWeight<.004)return;
    // The same question the run path asks: a rig without a Walk clip runs its
    // Run at a walking pace, and asking the walk cadence about a run clip is
    // how the legs end up cycling faster than the body travels.
    const walking=this.walking&&!!this.walkClip;
    if(this.strideWalking!==walking){this.strideWalking=walking;this.strideClip=this.clipFor({...state,action:'run'});}
    const clip=this.strideClip;
    // Only a real gait. Where a rig has neither a walk nor a run the ladder
    // falls back to the idle, and overlaying an idle on a guard says nothing.
    if(!clip||!/run|walk|dash/i.test(clip.name))return;
    if(!this.legMask){this.legMask=new Set<THREE.Object3D>();for(const leg of this.legs)leg.hip.traverse(node=>this.legMask!.add(node));}
    // The same cadence the run path computes, not the flat 7.5 divisor this
    // file's own comment says made every fighter skate.
    const cadence=CADENCE[this.cadenceKey]?.[walking?'walk':'run'];
    const stride=TARGET_STRIDE*(this.legLength||.85)*(STRIDE_SCALE[this.state.fighter]??1);
    const speed=Math.max(.5,this.locomotionSpeed);
    const rate=(cadence&&cadence.step>0&&stride>0
      ?THREE.MathUtils.clamp(cadence.step*speed/stride,CADENCE_RANGE[0],CADENCE_RANGE[1])
      :THREE.MathUtils.clamp(speed/(walking?3.2:7.5),.65,1.25)*1.05)*runSign;
    // In clip seconds, wrapped both ways: a backpedal runs the cycle
    // backwards and a negative modulo is not a phase.
    this.legPhase=((this.legPhase+dt*rate)%clip.duration+clip.duration)%clip.duration;
    // Rotations only. A leg bone's position is its length, and taking that
    // from one clip while the pelvis comes from another dislocates the leg;
    // what a stride is made of is the angles anyway.
    //
    // The pelvis is in this, and the chest is given the difference straight
    // back. A guard stance is bladed and a walk is square, so walk leg angles
    // dropped under a guard pelvis swing the stride across the direction of
    // travel: measured on the six rigs that failed, the planted foot then
    // travelled between 0.97 and 1.6 times the speed of the body - worse than
    // the frozen pose it replaced. The pelvis height is deliberately left as
    // the guard keyed it, which is what `supportTransition` then settles.
    const spine=this.leanChain[1];
    for(const track of this.samplersFor(clip)){
      if(track.property!=='quaternion')continue;
      const pelvis=track.node===this.pelvis&&!!spine;
      if(!pelvis&&!this.legMask.has(track.node))continue;
      _blendTarget.fromArray(track.interpolant.evaluate(this.legPhase) as unknown as number[]);
      if(!pelvis){track.node.quaternion.slerp(_blendTarget,this.strideWeight);continue;}
      _strideFrom.copy(track.node.quaternion);
      track.node.quaternion.slerp(_blendTarget,this.strideWeight);
      // The chest keeps the orientation the guard put it in: with the hips
      // turned by q0 -> q1, a child holds still at q1^-1 * q0 * child.
      spine.quaternion.premultiply(_strideBack.copy(track.node.quaternion).invert().multiply(_strideFrom));
    }
  }

  /** An air-string blow thrown with the arms has its legs tucked under it
   *  (see AIR_STRING_CLIPS): the grounded clip draws a standing stance, and a
   *  jab thrown in mid-air from one reads as a body standing on nothing.
   *  Rotations only, as the stride's are, and not the pelvis. */
  private airTuck(real:number,state:PlayerState){
    const own=this.usesAuthoredAirString?this.airStages(state.fighter):undefined;
    const stage=this.rushStage(state);
    // (And a borrowed take that throws with its own legs - the ball modes' volleys and headers: render/ball/ballMoves.ts.)
    const legs=!!this.swap?.legs||isTechnique(state.branch)&&!!Fighter.styleLegs?.(state.fighter,state.branch);
    const wanted=own&&state.action==='light'&&!state.grounded&&!legs&&stage<own.length&&own[stage].tuck?1:0;
    this.tuckWeight+=THREE.MathUtils.clamp(wanted-this.tuckWeight,-real/TUCK_EASE,real/TUCK_EASE);
    if(this.tuckWeight<.004||!this.dynamics||!this.legs.length)return;
    const clip=this.clip('rise');
    if(!clip)return;
    if(!this.legMask){this.legMask=new Set<THREE.Object3D>();for(const leg of this.legs)leg.hip.traverse(node=>this.legMask!.add(node));}
    const at=clip.duration*TUCK_AT,w=this.tuckWeight*this.tuckWeight*(3-2*this.tuckWeight);
    for(const track of this.samplersFor(clip)){
      if(track.property!=='quaternion'||!this.legMask.has(track.node))continue;
      _blendTarget.fromArray(track.interpolant.evaluate(at) as unknown as number[]);
      track.node.quaternion.slerp(_blendTarget,w);
    }
  }
  private tuckWeight=0;
  /** Torsion's psychic flight (signature/TorsionFlight.ts): her walk, run and dash drawn as three ways of flying -
   *  a drift, a glide and a burst - on top of her three held hover clips. The whole body leans and rolls at the hips
   *  toward the way she travels and bobs; the legs, the arms and the head turn about her own side axis. */
  private torsionFlight(dt:number,state:PlayerState){
    if(state.fighter!=='torsion'||this.isForm||!this.dynamics)return;
    const pose=(this.flight??=new TorsionFlight()).update(dt,this.locomotionSpeed,state.alive?state.action:'idle');
    this.secondary?.hang(1-pose.stream);
    const hips=this.joints.get('Hips');
    if(pose.weight<.002||!hips?.parent)return;
    this.model.updateMatrixWorld(true);
    const v=Math.hypot(this.velocity.x,this.velocity.z);
    const hx=v>.5?this.velocity.x/v:Math.sin(this.facing),hz=v>.5?this.velocity.z/v:Math.cos(this.facing);
    // A turn about `travelSide` by a positive angle tips the body toward the heading (bodyDynamics' `lateral`).
    const travelSide=_flightSide.set(hz,0,-hx),heading=_flightHeading.set(hx,0,hz),side=_flightBody.set(Math.cos(this.facing),0,-Math.sin(this.facing));
    if(Math.abs(pose.bob)>1e-5){hips.getWorldPosition(_flightPoint);_flightPoint.y+=pose.bob;hips.position.copy(hips.parent.worldToLocal(_flightPoint));}
    _leanWorld.setFromAxisAngle(travelSide,pose.lean);
    if(Math.abs(pose.roll)>1e-5)_leanWorld.premultiply(_leanShare.setFromAxisAngle(heading,pose.roll));
    this.leanBone(hips,_leanWorld);
    hips.updateMatrixWorld(true);
    for(const [i,Side] of (['Left','Right']as const).entries()){
      const thigh=this.joints.get(`${Side}UpLeg`),knee=this.joints.get(`${Side}Leg`);
      if(thigh)this.leanBone(thigh,_leanWorld.setFromAxisAngle(side,pose.thigh[i]));
      if(knee)this.leanBone(knee,_leanWorld.setFromAxisAngle(side,pose.knee[i]));
      const arm=this.joints.get(`${Side}Arm`);
      if(arm&&Math.abs(pose.arms)>1e-5)this.leanBone(arm,_leanWorld.setFromAxisAngle(side,pose.arms));
    }
    // The neck and the head raised against the lean, so she looks where she flies.
    if(pose.lift>1e-4){if(this.neckBone)this.leanBone(this.neckBone,_leanWorld.setFromAxisAngle(travelSide,-pose.lift*.4));if(this.headBone)this.leanBone(this.headBone,_leanWorld.setFromAxisAngle(travelSide,-pose.lift*.6));}
  }
  private flight?:TorsionFlight;
  private culled:{mesh:THREE.SkinnedMesh;sphere:THREE.Sphere;anchor:THREE.Object3D;radius:number}[]=[];
  private contactShadow!:THREE.Mesh<THREE.CircleGeometry,THREE.MeshBasicMaterial>;
  unseen=false;
  private wasUnseen=false;
  /** Coming back into view: the garments are re-seated where the body now is (instead of swinging from where they
   *  were left) and the feet planted afresh. */
  private wake(){
    this.wasUnseen=false;
    this.secondary?.reset();
    for(const leg of this.legs)leg.planted=false;
  }
  /** Whether the camera could see this body, or nearly: a sphere round it as big as its culling bounds and two metres
   *  more, against the view's frustum; and anyone within ten metres of the lens counts, whose steps are heard and whose
   *  shadow can fall into view. */
  inView(frustum:THREE.Frustum,eye:THREE.Vector3){
    const p=this.group.position;
    if(p.distanceToSquared(eye)<100)return true;
    let reach=1.5;for(const entry of this.culled)reach=Math.max(reach,entry.radius);
    _viewSphere.center.set(p.x,p.y+1,p.z);_viewSphere.radius=reach*(this.group.scale.x||1)+2;
    return frustum.intersectsSphere(_viewSphere);
  }
  private cullBounds(){
    if(!this.culled.length)return;
    this.group.updateWorldMatrix(true,false);
    const unit=this.group.matrixWorld.getMaxScaleOnAxis()||1;
    let anchor:THREE.Object3D|undefined;
    for(const entry of this.culled){
      if(entry.anchor!==anchor){anchor=entry.anchor;anchor.getWorldPosition(_cullCentre);}
      entry.mesh.updateWorldMatrix(true,false);
      const matrix=entry.mesh.matrixWorld;
      entry.sphere.center.copy(_cullCentre).applyMatrix4(_cullInverse.copy(matrix).invert());
      entry.sphere.radius=entry.radius*unit/(matrix.getMaxScaleOnAxis()||1);
    }
  }
  /** World height of the lowest point of the feet, as currently posed. */
  private lowestSupport(){
    let lowest=Infinity;const p=this.fallback;
    for(const {mesh,index}of this.supportVertices)lowest=Math.min(lowest,mesh.getVertexPosition(index,p).applyMatrix4(mesh.matrixWorld).y);
    return lowest;
  }
  /** Put the feet on the floor, on every frame rather than only while a pose
   *  is changing over.
   *
   *  Measured on the drawn pose, the guard soles run to 15.2 cm through the
   *  tile (Kosho) and 11.5 cm (Kenzo), while Nigo hovers 4.1 cm over it and
   *  stays there, because this only ever ran during a blend - which is about
   *  one frame in a hundred.
   *
   *  Up is nearly free: an authored pose whose sole is under the origin is
   *  wrong wherever it is, and an up-only clamp provably cannot touch a body
   *  that is in the air. Down is not, so down is allowed only from a standing
   *  stance, where both feet are down by definition - a leap is meant to
   *  leave the floor and so is half of every stride. */
  private supportTransition(dt:number,state:PlayerState,real=dt){
    if(!this.pelvis||!this.pelvis.parent||!this.dynamics||this.isForm)return;
    this.group.updateMatrixWorld(true);
    const p=this.fallback,lowest=this.lowestSupport();
    if(!Number.isFinite(lowest))return;
    // Cosmetic psychic hover must not be pulled down like a standing guard.
    if(this.authoredHover(state)){this.support=0;this.soleGap=lowest-this.groundY;return;}
    const slack=this.groundY+.006-lowest;
    // Not a corpse. `defeated` is not a reaction, so this ran on a body the
    // ragdoll owned, read the un-simulated feet under the tile as slack, and
    // lifted the pelvis up to 0.18 m off the physics every frame - which is
    // where the sub-floor hands and heads in the ragdoll audit came from.
    // (The roster-wide motion pass: a get-up out of a daze is the stance - STANDING_RISE - and kept on the floor as one.)
    const rising=state.action==='getup'&&this.standingRise;
    const eligible=state.grounded&&state.alive&&!this.ragdoll&&(!REACTION_ACTIONS.has(state.action)||rising);
    // A guard with a stride laid over it is not a standing stance any more:
    // it has a flight phase like any other gait, and chasing that downward is
    // how a walk gets flattened into a shuffle.
    const standing=(STANCE_ACTIONS.has(state.action)||rising)&&this.strideWeight<.02;
    // A guard with a stride under it is not chased downward frame by frame -
    // but it is brought down by however much its LOWEST sole over the last
    // cycle floats. The pelvis height is the guard clip's, and KoKo's
    // guard is keyed 0.28 m above the floor he walks on: measured with
    // scripts/probe_locomotion_feel.mts, his blocking walk's lowest sole sat
    // 15-28 cm off the tile for the whole walk. `strideFloor` is the sole's
    // running minimum, relaxing upward slowly enough to span a stride, so
    // the flight phase of a step reads as flight and a sustained float as a
    // float.
    if(dt>0)this.strideFloor=Math.min(lowest,this.strideFloor+STRIDE_FLOOR_RELAX*dt);
    const floating=this.strideWeight>.5&&eligible?Math.max(-.4,Math.min(0,this.groundY+.006-this.strideFloor)):0;
    // The standing cap was 0.25 m, and KoKo's guard is keyed 0.276 m up:
    // the one stance that needed bringing down most was the one the cap
    // excluded, and he blocked on air. A stance is both feet down by
    // definition, so the cap is only there for a broken read; 0.4 m is
    // still under any leap.
    // (The roster-wide motion pass, FLOOR_GUARD: off its feet, it is only ever lifted.)
    if(this.thrown(state)){
      // On the wall clock: a big blow's freeze holds the clip, not the blend into the throw (iteration four's snap).
      // Measured as the pose lies, the rebound off the floor (LAND_BOUNCE) taken back out of it - lifted on top of
      // that - and never less than the clip alone was under.
      const under=Math.max(slack+this.bounceDrawn,this.clipUnder);
      // Let go of quicker in the air, where the body is travelling faster than that anyway.
      // (Round 98: and taken up gently while a launch is new - FLOOR_GUARD_FRESH: thrown out of an authored hurt into the
      // fold over the blow (round 97), its soles 10-15 cm under the tile, the whole body was lifted 12-13 cm in one frame,
      // the head with it - Vesper's 18 cm, Shiun's, Levin's; the launch takes the soles off the floor within a few frames.)
      const fresh=state.action==='launched'&&state.actionTime*state.actionDuration<FLOOR_GUARD_FRESH.within;
      if(real>0)this.support=under>this.support?Math.min(under,FLOOR_GUARD,this.support+(fresh?FLOOR_GUARD_FRESH.rate:FLOOR_GUARD_RATE)*real):Math.max(Math.max(0,under),this.support-FLOOR_GUARD_LET_GO*(state.grounded?1:3)*real);
      this.soleGap=lowest+this.support-this.groundY;
      if(Math.abs(this.support)<1e-4)return;
      this.pelvis.getWorldPosition(p);p.y+=this.support;this.pelvis.position.copy(this.pelvis.parent.worldToLocal(p));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
      return;
    }
    const wanted=!eligible?0:slack>0?Math.min(slack,.25):slack>-.4&&standing?slack:floating;
    // Rate limited, on purpose and in both directions. What this is for is the
    // sustained error - a Block stance keyed fifteen centimetres under the
    // floor, an idle keyed four over it - and not the single-frame spikes
    // these clips are full of: Gummy's Block drops twenty-one centimetres in
    // one frame, and a correction quick enough to follow that would yank the
    // whole body up and leave it there. A spike is a job for the foot, not for
    // the hips. Sixty centimetres a second settles a guard inside a quarter of
    // a second and stays under anything the plant tracker reads as a step.
    //
    // dt of zero is impact freeze: hold what is already applied rather than
    // stepping to the fresh target, which would move the body on the one
    // frame whose whole point is that nothing moves.
    //
    // Except in the first beat after a landing. The clip is still unwinding
    // a tucked descent and the server already has the body on the floor, so
    // for a third of a second the sole can be seven centimetres through the
    // tile on half the roster; at sixty centimetres a second the correction
    // arrives after the pose has moved on. Up is the direction that is never
    // wrong, so up is quick there.
    const upRate=this.sinceGrounded<LAND_RISE?4:.6;
    if(dt>0)this.support+=THREE.MathUtils.clamp((wanted-this.support)*(1-Math.exp(-dt*(this.sinceGrounded<LAND_RISE?40:22))),-.6*dt,upRate*dt);
    // Where the lowest sole ends up, which is what anyone can see.
    this.soleGap=lowest+this.support-this.groundY;
    if(Math.abs(this.support)<1e-4)return;
    this.pelvis.getWorldPosition(p);p.y+=this.support;this.pelvis.position.copy(this.pelvis.parent.worldToLocal(p));
    this.pelvis.updateMatrix();
    this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
  }
  /** Which reaction clip a struck body is in and where in it, keyed off the
   *  blow. The gates below count from the hit rather than from the action: a
   *  knockdown changes action on its way down, and reading the action's own
   *  clock restarted the count each time - which is what opened the window
   *  where a fighter on the floor played a standing recoil. */
  /** Where in a stagger clip a struck body is: snapped to the recoil, held on
   *  it for a beat, then played out at the rate it was drawn.
   *
   *  Weighted by what the blow was worth. A seventeen-damage barrage tick and
   *  a ninety-five-damage Senpugan used to drive this clip identically: the
   *  same snap, the same hold, the same rate out. A heavier blow now holds its
   *  peak longer and recovers slower, which is most of the difference between
   *  a tap and a hit that hurt. The peak pose itself is the same whatever
   *  landed - it is the recoil the clip was drawn with. */
  private stagger(clip:THREE.AnimationClip,elapsed:number){return this.recoilClock(clip,elapsed)/clip.duration;}
  /** Round 3e (REACT): the recoil's clip time, in seconds, `elapsed` seconds
   *  into it (`reactionSince`). It used to be struck in REACTION_SNAP - a
   *  fifth of a second of clip across two frames - which, with the blend into
   *  it only four frames long, was the one-frame jump the third blind critic
   *  measured on standing re-hits. Now it runs into its peak over REACT_IN,
   *  three times the peak's pace off the blow and easing onto it, while the
   *  struck blend (STRUCK_BLEND) brings the pose round from wherever the body
   *  was; then holds, then plays on at the rate it was drawn at. */
  private recoilClock(clip:THREE.AnimationClip,elapsed:number){
    const weight=THREE.MathUtils.clamp(this.hitDamage/80,.6,1.6);
    const peak=Math.min(REACTION_PEAK,clip.duration*.3);
    const hold=REACTION_HOLD*weight;
    if(elapsed<=REACT_IN){const u=1-Math.max(0,elapsed)/REACT_IN;return peak*(1-u*u*u);}
    // (Round 94: an authored hurt lets go at TAKE_RELEASE of its own pace however light the blow - a light blow ran the
    // take's let-go at up to 1.7 times its pace, and its victim stood back in the stance the take settles into, fists
    // up, before the string's next blow: the blind critics' "back in guard 67 ms after a high kick". A recoil of the
    // body's own still lets go faster for a lighter blow.)
    const rate=DZ_TAKE_CLIPS.has(clip.name)?TAKE_RELEASE:1/weight;
    if(elapsed<=REACT_IN+hold)return peak;
    const on=peak+(elapsed-REACT_IN-hold)*rate;
    // Lock combat's preview (Fighter.reelSway): held in the stagger, rocking, short of the stance.
    if(Fighter.reelSway>0){
      const top=Math.min(clip.duration,peak+REEL_ROCK);
      if(on>top){const since=(on-top)/rate;return Math.max(peak,top-Fighter.reelSway*(1-Math.cos(since*REEL_SWAY_HZ*Math.PI*2)));}
    }
    return Math.min(clip.duration,on);
  }

  /** Round 3e (REACT): how long a reaction has been running, as it is drawn.
   *  The server's clock for it is the action's, which the blow's own freeze
   *  holds at nought for 45-140 ms (its hitstop): the recoil then waited out
   *  the freeze on the clip's first frame and ran all of its entry in the
   *  frames after it. The blow's own clock - wall time since it landed here,
   *  on its event or its touch (`blowAt`) - keeps running through the freeze,
   *  so the body is seen to take the blow in it. Only a blow that belongs to
   *  this reaction counts: one older than the action by more than a touch's
   *  lead is some earlier hit's. */
  /** Round 3e (REACT): the air clock (`airClock`). Wall time while the body is
   *  launched and off the floor, held in a time stop; kept through a blow that
   *  launches it again and through a bounce off the floor; started again once
   *  it is out of the launch. */
  private stepAirClock(state:PlayerState,real:number){
    this.airStep=0;
    // A knockdown the server calls a frame or two before the body is down is
    // the same fall.
    if(state.action!=='launched'&&!(state.action==='knockdown'&&!state.grounded)){this.airClock=0;this.airTurn=0;return;}
    if(state.grounded)return;
    this.airStep=state.timeStopped?0:real;
    this.airClock+=this.airStep;
  }
  private reactionSince(elapsed:number){
    // Iteration seventeen: the blow's clock as it stands this frame. `reactTime` takes the frame's wall time in
    // `hitReact`, which runs after this, so the recoil was read a frame late - drawn behind the reaction layer, and
    // on uneven frames a long frame's step drawn in the short frame after it (Gohaku's let-go: a 22 ms frame's 12.7 cm
    // in a 15 ms frame, 14 cm as the critic scales it). `reactAhead` is what `hitReact` will add (see `update`).
    // (Round 25: a body reeling on past its hitstun reads its own presented clock only - see `reeling`.)
    if(this.reelHolding)return elapsed;
    const blow=this.reactTime+this.reactAhead-this.blowAt;
    return blow>=0&&blow<=elapsed+REACTION_LEAD?Math.max(elapsed,blow):elapsed;
  }
  private reaction(state:PlayerState){
    this.takeOn=undefined;
    const elapsed=state.actionTime*state.actionDuration;
    // Round 3e (REACT): the standing recoils read the blow's clock (see
    // `reactionSince`); the knockback reads the air clock (see `airClock`).
    const since=this.reactionSince(elapsed);
    this.lastSince=since;
    // A stagger, a dizzy and a body stopping against a wall all used to fall
    // past this and be played by the linear fallback, which stretches the
    // whole clip across the reaction's own window: a 0.9-second recoil inside
    // a 0.15-second flinch runs at six times speed and reads as a twitch, so
    // the fighter appeared to stand in a clean stance while damage numbers
    // came off his chest.
    //
    // Snap to the recoil, hold it for a beat, then play out at the rate it was
    // drawn at. A recoil that gets cut off by the next hit looks far better
    // than a complete one at six times speed, and being cut off is what being
    // hit again is.
    if(state.action==='flinch'||state.action==='stun'||state.action==='splat'){
      const clip=(DREAM_IMPACT&&Fighter.dreamTakes&&state.action==='flinch'?this.clip('dream flinch'):undefined)??this.clip(`reaction ${state.action}`);
      if(clip)return {clip,phase:'struck-'+state.action,progress:this.stagger(clip,since)};
    }
    // Death. `defeated` was a finite action carrying no duration, so its
    // clock was pinned at zero and the clip was held on its first frame - a
    // standing pose - for the whole three seconds, which is why a defeated
    // fighter froze on his feet instead of falling. It now falls on its own
    // clock and stays down until the respawn.
    if(state.action==='defeated'){
      const fall=this.clip('reaction defeated');
      if(fall&&elapsed<fall.duration)
        return {clip:fall,phase:'dying',progress:THREE.MathUtils.clamp(elapsed/fall.duration,0,.999)};
      // The first frame of the downed clip rather than the last: a loop holds
      // the same pose either way, and where the only downed clip is the get-up
      // its last frame is a fighter back on his feet.
      const floor=this.clip('reaction downed');
      if(floor)return {clip:floor,phase:'dead',progress:0};
      if(fall)return {clip:fall,phase:'dead',progress:.999};
    }
    // Round 3e (REACT): the get-up, paced by its motion (see `clipMotionTable`)
    // rather than laid evenly across the action: Taisei's and Ouga's 1.04 s
    // stand-up, run at twice its speed inside a half-second get-up, planted a
    // hand 40 cm in a frame. Spread by motion, its bursts take the time the
    // lying still gave up.
    // A dizzy body gets up too (the simulation ends a stun with the get-up's evade), but it was never down: it shakes
    // it off into its stance rather than playing the get-up off the floor - Taisei dropped from his dizzy stagger
    // straight onto his back and kipped up (8 October 2026), and so did every other rig (STANDING_RISE: all of them).
    if(state.action==='getup'&&this.standingRise&&STANDING_RISE.has(state.fighter)){
      const stance=this.idleRig?.stance()??this.clip('rest');
      if(stance)return {clip:stance,phase:'getup-standing',progress:THREE.MathUtils.clamp(elapsed/stance.duration,0,.999)};
    }
    if(state.action==='getup'){
      const clip=this.clip('reaction getup');
      if(clip&&state.actionDuration>0)return {clip,phase:'getup',progress:Math.min(.999,clipAtMotion(clipMotionTable(clip),THREE.MathUtils.clamp(elapsed/state.actionDuration,0,1)))};
    }
    if(state.action!=='hurt'&&state.action!=='launched'&&state.action!=='knockdown')return;
    // Where the blow landed, not which contact index it happened to be. The
    // old gate was hand-wired to the third contact of a heavy, so the fold was
    // unreachable by every other move however square in the stomach it landed.
    // The original condition is kept as a second route: it reads well on
    // taisei's three-hit heavy and nothing is served by regressing it.
    // Iteration seventeen: a body already folding stays folded through a touch the server has not yet confirmed. The
    // touch reads the blow's height off the striking surface as drawn, the event off the server's, and the two can
    // fall either side of FOLD_LOW: Taisei went from his fold to his hurt for the two frames between Gummy's touch and
    // its event and back, his hand 13-14 cm in a frame. The event decides.
    const abdomenNow=this.hitByTouch&&!!this.active&&this.active.getClip().name==='heavy-abdomen-fold';
    // (The dream loop, round 28: a standing hurt is the take picked for its blow, where the body has one - its fold is
    // one of them.)
    const taken=DREAM_IMPACT&&state.action==='hurt'&&!!this.hurtTake&&this.hitStyle!=='beam'&&!!this.clip(this.hurtTake);
    if(!taken&&(abdomenNow||this.hitStyle==='melee'&&!this.hitBehind&&(this.hitHeight<FOLD_LOW||(this.hitSlot==='heavy'&&this.hitContactIndex===2)))){
      const abdomen=this.clip('abdomen');
      // Round 3e (REACT): a standing body folds; a launch folds over the blow
      // for as long as the fold lasts and is then the knockback's; a body on
      // the floor is downed, never folded. It held the fold's last frame for
      // the whole flight and switched when the next blow arrived - Taisei's head
      // jumped 0.8 m in a frame - and drew a knockdown as a standing fold.
      if(abdomen&&(state.action==='hurt'&&state.grounded||state.action==='launched'&&this.airClock<abdomen.duration))
        return {clip:abdomen,phase:'abdomen-fold',progress:THREE.MathUtils.clamp((since+.025)/abdomen.duration,0,1)};
    }
    // Any launch, not only an ultimate's. A heavy that takes someone off their
    // feet is the payoff moment of the game and it had no air clip at all: it
    // fell through to the linear fallback and the body held one pose for the
    // whole flight, which LAUNCH_GRAVITY deliberately makes half again longer
    // than arcade gravity.
    // Round 3e (REACT): a knockdown still in the air is the launch's fall -
    // the server calls it a frame or two before the floor, and it played a
    // standing recoil for them (an 11-14 cm head jump on Konta and Taisei).
    const falling=state.action==='knockdown'&&!state.grounded&&this.airClock>0;
    const knockback=state.action==='launched'||falling||this.hitSlot==='ultimate'?this.clip('knockback'):undefined;
    if(knockback){
      // Keep the back-down source silhouette through descent. Ground contact
      // starts the separate collision/getup clip on the shared playback clock.
      if(!state.grounded){
        // A one-shot clip clamped at its end holds the last frame for the rest
        // of the flight, which is a body frozen in mid-air. Once it has played
        // out, its airborne half is run back and forth instead, so the
        // silhouette keeps changing all the way down.
        // Round 3e (REACT): on the air clock (see `airClock`), not the
        // action's. A blow that lands on a body already in the air starts a
        // new launch on the server, and the slam was replayed from its first
        // frame on every juggle hit - the third blind critic's 80-178 cm
        // one-frame jumps. Taken on through a re-launch, the throw carries
        // on; the new blow is answered by the reaction layer (`hitReact`).
        const played=this.airClock/knockback.duration;
        const spread=this.isForm?undefined:FLIGHT_SPREAD[state.fighter];
        if(spread&&knockback.name==='ultimate-knockback-air'){
          if(played<=spread[0])return {clip:knockback,phase:'knockback-air',progress:played};
          // The rest of the flight, never backwards (as `airTurn` is for the somersault), and never faster than
          // FLIGHT_RATE times the clip's own pace.
          if(this.airStep>0)this.airTurn=Math.min(1,this.airTurn+Math.min((1-this.airTurn)*this.airStep/Math.max(this.airStep,this.timeToGround(state)),
            FLIGHT_RATE*this.airStep/((spread[1]-spread[0])*knockback.duration)));
          return {clip:knockback,phase:'knockback-air',progress:THREE.MathUtils.lerp(spread[0],spread[1],this.airTurn)};
        }
        if(played<=1)return {clip:knockback,phase:'knockback-air',progress:played};
        // Past the authored throw. It is a one-shot - it launches the body,
        // turns it over and sets it down - and running its airborne half back
        // and forth is a fighter shuddering in mid-air. Where the rig has a
        // somersault, that takes over and keeps turning until the ground
        // arrives. Every rig has one now; the ping-pong is the fallback.
        const spin=this.clip('spin');
        if(spin&&spin!==knockback){
          // Round 3e (REACT): never backwards (see `airTurn`) - a re-launch
          // lengthens the flight, and the turn slows rather than rewinding.
          // What is left of it is spread over the time left before the floor.
          if(this.airStep>0)this.airTurn=Math.min(1,this.airTurn+(1-this.airTurn)*this.airStep/Math.max(this.airStep,this.timeToGround(state)));
          const sourceSeconds=THREE.MathUtils.lerp(16/24,2/24,this.airTurn);
          return {clip:spin,phase:'tumble',progress:sourceSeconds/spin.duration};
        }
        const progress=AIR_LOOP[0]+(AIR_LOOP[1]-AIR_LOOP[0])*(1-Math.abs(((played-1)/AIR_LOOP[2])%2-1));
        return {clip:knockback,phase:'knockback-air',progress};
      }
      const groundImpact=this.clip('ground impact');
      if(groundImpact&&this.reactionClock>.1){
        this.landingStarted??=elapsed;
        // Combo escape may shorten hurt; respect the server's remaining time.
        this.landingDuration??=Math.min(groundImpact.duration,Math.max(.08,state.actionDuration-elapsed));
        return {clip:groundImpact,phase:'knockdown-recovery',progress:THREE.MathUtils.clamp((elapsed-this.landingStarted)/this.landingDuration,0,1)};
      }
    }
    // On the floor. This used to fall all the way through to 'Hit 01' - a
    // standing recoil, played by a body lying on the ground, which is what a
    // live capture of a knockdown showed. Every rig ships a downed pose and
    // `clipFor` has always known its name; `reaction()` runs first and never
    // consulted the same table, so the pose was unreachable for the one action
    // it exists for. A knockdown is time spent on the floor, so it drops into
    // the pose and stays there rather than playing anything out.
    if(state.action==='knockdown'&&state.grounded){
      const floor=this.clip('reaction knockdown');
      if(floor)return {clip:floor,phase:'downed',
        progress:THREE.MathUtils.clamp(elapsed/Math.max(.35,floor.duration),0,.999)};
    }
    if(this.hitSlot==='ultimate'&&this.reactionClock>.45){
      if(state.grounded)this.landingStarted??=elapsed;
      const groundImpact=this.clip('ground impact');
      if(groundImpact&&this.landingStarted!==undefined){
        return {clip:groundImpact,phase:'ground-impact',progress:THREE.MathUtils.clamp((elapsed-this.landingStarted)/groundImpact.duration,0,1)};
      }
      const landing=this.clip('fall');
      if(landing){
        // Jump Fall's later frames contain the actual knee/torso compression.
        // Enter them on confirmed ground contact, not a guessed flight duration.
        const progress=this.landingStarted===undefined?.35:.5+.5*THREE.MathUtils.clamp((elapsed-this.landingStarted)/.15,0,1);
        return {clip:landing,phase:'landing',progress};
      }
    }
    // From behind, 'Hit 01' whips the head back toward the blow - into it. The
    // stagger in place is struck from nowhere in particular, and the lean in
    // `bodyDynamics`, which does know where the blow came from, pushes the
    // body the way it travelled.
    if(this.hitBehind&&state.action==='hurt'&&this.hitStyle!=='beam'){
      const stagger=this.clip('stagger');
      if(stagger)return {clip:stagger,phase:'struck-behind',progress:this.stagger(stagger,since)};
    }
    const own=this.clip('hit');
    if(!own)return;
    // The dream loop, round 28: a blow on its feet drawn with the hurt picked for it (DREAM_HURTS), where the body has
    // one; a beam's pressure keeps the hurt it was tuned on.
    const take=DREAM_IMPACT&&state.action==='hurt'&&this.hurtTake&&this.hitStyle!=='beam'?this.clip(this.hurtTake):undefined;
    const clip=take??own;
    if(take)this.takeOn=this.hurtTake as keyof typeof DREAM_HURTS;
    if(this.hitStyle==='beam'){
      const pressure=this.clip('pressure');
      if(pressure){
        const release=Math.max(.1,state.actionDuration-.18);
        let sourceSeconds:number;
        if(!state.grounded){
          // Keep the recoil airborne until the server confirms the landing.
          sourceSeconds=Math.min(.25,elapsed);
        }else{
          this.landingStarted??=elapsed;
          const recoveryStart=Math.max(release,this.landingStarted);
          if(elapsed<recoveryStart){
            const brace=THREE.MathUtils.clamp((elapsed-this.landingStarted)/Math.max(.001,recoveryStart-this.landingStarted),0,1);
            sourceSeconds=THREE.MathUtils.lerp(.25,.94,brace);
          }else{
            const recover=THREE.MathUtils.clamp((elapsed-recoveryStart)/Math.max(.001,state.actionDuration-recoveryStart),0,1);
            sourceSeconds=THREE.MathUtils.lerp(.94,1.12,recover);
          }
        }
        return {clip:pressure,phase:'beam-pressure',progress:sourceSeconds/pressure.duration};
      }
      // Keep the existing recoil's strained section through sustained pressure.
      // Small sampling variation retains motion without resetting the reaction.
      const release=Math.max(.1,state.actionDuration-.18);
      const sourceFrame=elapsed<.075?4*THREE.MathUtils.clamp(elapsed/.075,0,1)
        :elapsed<release?4+Math.sin((elapsed-.075)*24)*.45
        :THREE.MathUtils.lerp(4,21,THREE.MathUtils.clamp((elapsed-release)/.18,0,1));
      return {clip,phase:'beam-strain',progress:sourceFrame/21};
    }
    // Round 3e (REACT): the recoil on the blow's clock (`recoilClock`): into
    // its peak over REACT_IN, held a beat, then on at the rate it was drawn
    // at, cut off by whatever comes next. It used to be the clip's first
    // fifth across 25-75 ms and the rest squeezed into the hurt, however
    // long the clip: Gaunt' 2.2 s stagger ran at five to eight times its own
    // speed inside a rush stage's hurt, a hand crossing 60-110 cm a frame.
    const seconds=this.recoilClock(clip,since);
    // Rocked (round 3b): a blow big enough to hold its victim for most of a
    // second and a half without knocking them down - Shirokane's Lightning
    // Clone - used to stretch this recoil across the whole of it, and
    // the victim stood there, arms out, "barely reacting". The recoil plays
    // at the rate it was drawn, and the body then doubles over, dazed, for
    // the rest of it.
    if(state.actionDuration>=ROCKED_HURT){
      const reel=Math.min(ROCKED_REEL,clip.duration*.7);
      if(since<reel)return {clip,phase:'rocked',progress:Math.min(.999,seconds/clip.duration)};
      const daze=this.clip('daze');
      if(daze&&daze!==clip)return {clip:daze,phase:'rocked-daze',progress:THREE.MathUtils.clamp((since-reel)/daze.duration,0,.999)};
    }
    return {clip,phase:take?'recoil-'+this.hurtTake:'recoil',progress:Math.min(.999,seconds/clip.duration)};
  }
  /** `dt` is the clamped frame step the procedural layer integrates against.
   *  `real` is how much wall time actually passed, which is the clock the
   *  positions in `state` were interpolated on and the one the server's own
   *  windows run on. They are the same number above 20 fps and they are not
   *  below it: at 10 fps main.ts hands over 0.05 while the ground under the
   *  fighter moves 0.1 seconds' worth, so a velocity divided by the first read
   *  double, every fighter crossed the walk/run threshold standing still, and
   *  the reaction gates fired at half rate against a simulation that had not
   *  slowed down at all. */
  update(dt:number,state:PlayerState,interpolated=false,real=dt){
    if(DREAM_IMPACT)state=this.reeling(state,real);
    state=castHold(this.castHeld,state,real,this.locomotionSpeed,this.isForm,this.active);
    this.swap=Fighter.transplant?.(this,state);
    // The transformation's own geometry, where the source shipped it.
    if(this.awakenOn.length||this.awakenOff.length){
      const transformed=(this.swapped(state)&&state.fighter!=='kagari')||!!this.outfit?.variant?.goldHair||(state.fighter==='aquilo'&&state.action==='ultimate');
      for(const mesh of this.awakenOn)mesh.visible=transformed;
      for(const mesh of this.awakenOff)mesh.visible=!transformed;
    }
    if(this.awakenTuck.length){const tuck=this.swapped(state)||this.outfit?.variant?.goldHair?1:0;for(const t of this.awakenTuck)t.weights[t.index]=tuck;}
    // (A combo ender drawn with a take of its own keeps them: they are put away for the slot's own clips - see slotClip.)
    if(this.heldWeapons.length){const away=['heavy','special','ultimate'].includes(state.action)&&this.slotClip(state);for(const weapon of this.heldWeapons)weapon.visible=!away;}
    // Cautery Blade occupies the left hand. LANCET stays in the right hand;
    // the imported sheath must not masquerade as a second attack weapon.
    // Round 7 (WARD ULT): nor through his ultimate, whose left hand opens ROOM, makes the sign and goes on them (it held
    // the sheath out through the victim in the cinematic).
    if(this.wardSheath.length){const gamma=state.action==='special'&&this.slotClip(state,['Cautery Blade'])||state.action==='ultimate';for(const sheath of this.wardSheath)sheath.visible=!gamma;}
    // Round 5 (GUMMY): and as the GRAND TIDE takes him into the form, unawakened (gummy/grand-tide.ts).
    if(this.laughFace){const laugh=state.action==='awaken'||(state.action==='ultimate'&&!state.awakened&&state.actionTime*state.actionDuration<GRAND_TIDE_TAKE.laugh);this.laughFace.visible=laugh;if(this.plainFace)this.plainFace.visible=!laugh;}
    // Round 5 (GUMMY): Rogue Wave is thrown with the palms: the open hands are on through the heavy - not an
    // ender thrown in its slot, nor a heavy off the floor - and the fists off.
    // Round 6 (GUMMY ULT): and SUNRISE's grab flies open and shuts on them (gummy/grand-tide.ts grandTideGrab): the right alone.
    if(this.openHands.length){
      const palms=state.action==='heavy'&&!Fighter.ender(state)&&state.grounded&&!this.swap;
      const grab=state.action==='ultimate'&&!this.swap&&grandTideGrab(state,this.moveFor(state).contacts[0]).open;
      for(let i=0;i<this.openHands.length;i++){const open=palms||grab&&this.openSides[i]==='R';this.openHands[i].visible=open;this.fists[i].visible=!open;}
    }
    this.state=state;const actionSeconds=state.actionTime*state.actionDuration;this.will.value=state.fighter==='gummy'&&state.action==='special'&&!Fighter.ender(state)&&!this.swap?THREE.MathUtils.smoothstep(actionSeconds,.1,.25)*(1-THREE.MathUtils.smoothstep(actionSeconds,state.actionDuration-.3,state.actionDuration)):0;/* Round 3d (PACE): gone by the move's end, whatever its length (it faded over 2.5-2.9 s of a 2.6 s move). */const target=new THREE.Vector3(state.x,state.y,state.z);
    const delta=_step.set(state.x-this.previousPosition.x,state.y-this.previousPosition.y,state.z-this.previousPosition.z);
    const displacement=Math.hypot(delta.x,delta.z);
    this.previousVelocity.copy(this.velocity);
    // A round reset moves a fighter across the stage; that is not travel.
    const moved=dt>0&&displacement<2;
    this.travelled=moved?displacement:0;
    if(moved){
      this.motionPending+=real;
      if(delta.lengthSq()>1e-12){
        this.motionWindow.push({x:delta.x,y:delta.y,z:delta.z,gap:this.motionPending});
        this.motionSpan+=this.motionPending;this.motionPending=0;
        while(this.motionWindow.length>1&&this.motionSpan-this.motionWindow[0].gap>=VELOCITY_WINDOW)this.motionSpan-=this.motionWindow.shift()!.gap;
      }
      let x=0,y=0,z=0;
      for(const sample of this.motionWindow){x+=sample.x;y+=sample.y;z+=sample.z;}
      // The wait since the last change is only counted once it has outlasted
      // the gaps before it. Below that it is the renderer asking twice between
      // two snapshots and charging for it would read the speed low; above it
      // the fighter has genuinely stopped, and the speed bleeds away.
      const span=this.motionSpan+Math.max(0,this.motionPending-this.motionSpan/Math.max(1,this.motionWindow.length));
      this.velocity.set(x/span,y/span,z/span);
    }else{this.motionWindow.length=0;this.motionSpan=0;this.motionPending=0;this.velocity.set(0,0,0);}
    if(this.carriedVelocity){this.velocity.copy(this.carriedVelocity);this.travelled=Math.hypot(this.velocity.x,this.velocity.z)*real;}
    const speed=Math.hypot(this.velocity.x,this.velocity.z);
    // Twenty-four, not twelve: the ground speed ramps to a run in 121 ms and
    // an eighty-three millisecond filter had the legs still cycling at two
    // thirds pace a third of the way into it. The windowed sample is clean
    // enough to be followed this closely.
    this.locomotionSpeed=THREE.MathUtils.lerp(this.locomotionSpeed,speed,1-Math.exp(-dt*24));
    // Two thresholds rather than one: a single crossing point makes the clip
    // flicker between a walk and a run for anyone moving near it, and the
    // ground speed now ramps through that range on every start and stop.
    this.walking=this.locomotionSpeed*this.gaitScale<(this.walking?3.6:2.8);
    // The frame the floor arrives, not a fifty-millisecond average of the
    // descent: the window steadies the legs by flattening exactly the spike a
    // landing is made of, so the impact is read off the raw step instead.
    //
    // A reaction is excluded outright. A launch lands at 11 m/s and would ask
    // for the deepest dip in the game on a body that is already prone.
    if(state.grounded&&!this.wasGrounded&&!REACTION_ACTIONS.has(state.action)){
      const impact=Math.max(0,-this.fallSpeed);
      this.landPeak=impact>LAND_FLOOR?THREE.MathUtils.clamp((impact-LAND_FLOOR)*LAND_PER_SPEED,LAND_RANGE[0],LAND_RANGE[1]):0;
      this.landAge=0;this.landHeld=this.landPeak>0;
    }
    // A ground bounce back into the air ends the beat, or a fourteen
    // centimetre hip offset is carried up with the fighter.
    if(!state.grounded){this.landHeld=false;this.landPeak=0;}
    this.sinceGrounded=state.grounded?this.sinceGrounded+real:0;
    if(this.landHeld){
      // Held at nought until the soles are actually down. The server calls a
      // fighter grounded while the clip still has him tucked half a metre up,
      // and a dip that peaks then is a dip nobody sees.
      if(this.landAge>0||this.soleGap<.02)this.landAge+=dt;
      if(this.landAge>=LAND_RISE)this.landHeld=false;
    }
    // Down over the first sixty milliseconds and back up over the next
    // quarter second, which is a fighter taking an impact rather than the
    // four-frame twitch the old seventy-seven millisecond decay gave.
    this.landDip=this.landPeak*(this.landHeld
      ?THREE.MathUtils.smoothstep(this.landAge,0,LAND_FALL)*(1-THREE.MathUtils.smoothstep(this.landAge,LAND_FALL,LAND_RISE)):0);
    this.fallSpeed=moved?delta.y/dt:0;
    this.wasGrounded=state.grounded;
    this.previousPosition.copy(target);
    if(state.action==='jump'){
      if(this.previousAction!=='jump'){this.jumpAge=0;this.falling=false;}
      else{
        this.jumpAge+=dt;
        // The frame the arc turns over. A quarter of a metre a second rather
        // than zero, so a body drifting at the apex does not flicker.
        // Round 4b (JUMP): a form (Full Swell, Kurobi) is drawn at its own
        // origin, with no height and - unless one is carried - no velocity of
        // its own: it turns over on its fighter's arc, and its fall is laid
        // across the descent by time (fallAt), not by a height it cannot see.
        const arc=jumpArc(state.fighter),blind=this.isForm&&!this.carriedVelocity;
        if(!this.falling&&(blind?this.jumpAge>arc.rise+.08:this.velocity.y<-.25)&&this.fallClip()){
          this.falling=true;this.fallAt=this.jumpAge;this.fallFrom=this.isForm?Math.max(.08,arc.air-this.jumpAge):Math.max(.08,this.timeToGround(state));}
      }
    }else{this.jumpAge=0;this.falling=false;}
    if(state.grounded||!this.started)this.groundY=state.y;
    // A spawn and a round reset are placements rather than moves: the body
    // appears where it is told, facing where it is told. A round reset writes
    // yaw Math.PI, and without this the fighter visibly winds round to it.
    // Last frame's shake (BIG_SHAKE) comes off before the body is placed.
    this.group.position.sub(this.shakeDrawn);this.shakeDrawn.set(0,0,0);
    const placed=!this.started||this.group.position.distanceToSquared(target)>100;
    // While a ragdoll owns the body the group stays where it died. Physics
    // moves the hips in world space, and letting the server's knockback move
    // the group underneath that would apply the same push twice.
    // Drawn off it by the contact push (see TORSO_RADIUS); a placement drops it.
    if(placed)this.push.set(0,0,0);
    if(this.ragdoll){/* held */}
    else if(interpolated||placed){this.group.position.copy(target).add(this.push);this.started=true;}
    else this.group.position.sub(this.pushDrawn).lerp(target,1-Math.exp(-dt*19)).add(this.push);
    if(!this.ragdoll)this.pushDrawn.copy(this.push);
    if(!this.ragdoll){
      // Speed, for a death to inherit. Taken from the drawn body rather than
      // from the state, so it already carries prediction and interpolation.
      if(this.lastWorldAt>0&&real>0)this.deathVelocity.copy(this.group.position).sub(this.lastWorld).divideScalar(real);
      this.lastWorld.copy(this.group.position);this.lastWorldAt=1;
    }
    // The feel pass: a body frozen on a big blow shakes along it, a step each 30 Hz tick, the way a held cel does.
    if(!this.ragdoll&&this.bigHolding(state)){const k=(Math.floor(performance.now()*.03)&1?1:-1)*BIG_SHAKE;this.shakeDrawn.set(this.bigHx*k,0,this.bigHz*k);this.group.position.add(this.shakeDrawn);}
    else if(DREAM_IMPACT&&!this.ragdoll&&!!state.hitstop&&this.shakeLeft>0&&this.shakeTotal-this.shakeLeft>=HIT_SHAKE_DELAY){const live=this.shakeTotal-HIT_SHAKE_DELAY,k=(Math.floor((this.shakeTotal-this.shakeLeft-HIT_SHAKE_DELAY)*30)&1?-1:1)*this.shakeSize*Math.min(1,this.shakeLeft/live);this.shakeDrawn.set(this.shakeHx*k,0,this.shakeHz*k);this.group.position.add(this.shakeDrawn);}
    // A camera flick is not a body turn. Three hundred pixels of mouselook is
    // 0.69 rad in one frame - 2400 degrees a second - and an attack snaps up
    // to fifty-five degrees onto the auto-aim target in a single tick, which
    // is what makes a fighter read as a turret rather than as a person.
    // Ordinary mouselook peaks near 3.4 rad/s, so the cap never touches it.
    // (Round 93: a spin take turns the body with it - TAKE_TURN - eased toward the take this body last drew.)
    {const spin=DREAM_IMPACT&&state.action==='hurt'&&state.grounded?this.takeOn:undefined,want=spin==='dream spin L'?TAKE_TURN.most:spin==='dream spin R'?-TAKE_TURN.most:0;
      this.takeTurn+=(want-this.takeTurn)*(1-Math.exp(-real*(Math.abs(want)>Math.abs(this.takeTurn)?TAKE_TURN.in:TAKE_TURN.out)));
      if(Math.abs(this.takeTurn)<1e-4&&!want)this.takeTurn=0;}
    const diff=Math.atan2(Math.sin(state.yaw+this.takeTurn-this.group.rotation.y),Math.cos(state.yaw+this.takeTurn-this.group.rotation.y));
    const snapping=ROOT_CLAMPED.includes(state.action)||REACTION_ACTIONS.has(state.action);
    // The walk/run hysteresis rather than a bare threshold, so the turn rate
    // does not flip between two values for a fighter moving near it.
    const maxRate=snapping?28:state.grounded?22:18;
    // Budgeted in wall time. The clamp was per clamped step, so below 20 fps a
    // 0.2 s frame was allowed 0.05 s worth of turn: a ninety-degree turn took
    // 0.8 s of wall clock and the fighter visibly wound round after the
    // camera. The reported rate is against the same clock, or the hips'
    // counter-rotation is fed a number four times too large.
    // Round 4b (COMBAT): an attack's turn onto its target is eased over its wind-up (attackTurn), not snapped.
    const eased=placed?undefined:this.attackTurn(state,diff,real);
    const step=placed?diff:eased!==undefined?eased:interpolated?THREE.MathUtils.clamp(diff,-maxRate*real,maxRate*real):diff*(1-Math.exp(-dt*22));
    this.group.rotation.y+=step;
    this.turnRate=real>0?step/real:0;
    // Everything that mixes a world heading with the fighter's own facing has
    // to use the yaw the body is drawn at, not the one the server holds: while
    // the two differ by up to forty degrees, reading state.yaw would turn the
    // hips and the lean against a body that is not there yet.
    const visualYaw=this.group.rotation.y;
    const finite=['light','heavy','special','ultimate','awaken','hurt','flinch','launched','knockdown','getup','stun','dash','defeated'].includes(state.action);
    this.stepAirClock(state,real);
    // The wall time this frame adds to the blow's clock (`hitReact`, below), for the recoil to read now.
    this.reactAhead=state.timeStopped||this.bigHolding(state)?0:real;
    // A get-up entered from a stun is a body on its feet (STANDING_RISE); from anything else it rises off the floor.
    if(state.action==='getup'&&this.previousAction!=='getup')this.standingRise=this.previousAction==='stun'&&state.grounded;
    const recoil=this.reaction(state);
    // The move's clock as drawn (round 3c): what every pacing curve below is
    // read against. A reaction keeps the server's.
    const drawn=this.stepMoveClock(state,real,finite,!!recoil);
    const melee=this.swap?undefined:this.groundedMelee(drawn);
    // Konta's barrage used to be here too, swapping clips per third of the
    // move: 'Punch 02' does not exist on his rig, so two of the three blows
    // were the same punch, each third replayed a 4.17 s clip at fifteen times
    // speed, and the clip restarted - a 3.9 s rewind - at every phase edge.
    // It goes through `stringCurve` and STRING_WINDOWS now, on one clip.
    const combo=!melee&&!this.swap&&state.action==='heavy'&&isTaisei(state)&&!Fighter.ender(state)?Math.min(2,Math.floor(drawn.actionTime*3)):-1;
    const phase=recoil?'-'+recoil.phase:melee?'-'+melee.phase:combo>=0?'-'+combo
      // Round 3d (ULTS): the confirm hands the opener's clip to the cinematic's.
      :this.swap?this.swap.phase:state.action==='ultimate'&&state.confirmedAt!==undefined&&(ULTIMATE_CLIPS[state.fighter]?.formOnly?this.ultimatePlan(state.fighter)?.formOpener:ULTIMATE_CLIPS[state.fighter]?.opener)?'-cine':'';
    // What counts as a new instance of a move, as opposed to the same one seen
    // again. It is not a changed `actionStarted`: the local copy of the
    // simulation starts a swing a round trip before the authoritative one
    // does, so when the server's version arrives its timestamp differs by the
    // latency - and keying on the timestamp made every attack restart its clip
    // and re-blend about a tenth of a second in. A genuine restart is a
    // different action, a different phase, or a clock that has gone backwards
    // by more than a quarter of the move.
    // A rush presses light into light into light, so the same action and phase
    // follow each other with no gap; a new stage, or a new input edge on the
    // same slot, is a new move. The edge is stable across the prediction
    // handover, where a timestamp is not - see above.
    const attackSeq=ATTACK_SLOTS.has(state.action)?state.actionSeq:undefined,stage=this.rushStage(state);
    if(finite){
      // Round 3e (REACT): a reaction the server starts again is a new one
      // however far in it is first seen. A rush stage's hurt is a fifth of a
      // second, so it could be 0.1 in on its first frame - the fresh-start
      // test below then missed it, the recoil's clock went back to its start
      // under a blend that belonged to the blow before, and the hand crossed
      // 20-60 cm in a frame on every other stage of a string.
      if(state.action!==this.previousAction||phase!==this.previousPhase
        ||state.actionTime<this.lastProgress-.25
        ||(state.actionStarted>this.lastStarted+1e-6&&(state.actionTime<.1||REACTION_ACTIONS.has(state.action)))
        ||attackSeq!==undefined&&this.lastSeq!==undefined&&attackSeq!==this.lastSeq
        ||stage!==this.lastStage)this.actionEpoch++;
      this.lastStarted=state.actionStarted;this.lastProgress=state.actionTime;
    }
    this.lastSeq=attackSeq;this.lastStage=stage;
    this.previousPhase=phase;
    this.reactionClock+=state.timeStopped||state.hitstop?0:real;
    this.idleRig?.step(state.timeStopped||state.hitstop?0:real,state.action,state.grounded,state.alive,this.locomotionSpeed,this.targetDistance);
    // A victory's entry hands over to its loop on its last frame (VICTORY_ENTRY).
    if(state.action!=='victory')this.victoryHeld=false;
    else if(!this.victoryHeld&&this.active?.getClip().name===VICTORY_ENTRY&&this.active.time>=this.active.getClip().duration-1e-3)this.victoryHeld=true;
    const key=state.action+(finite?this.actionEpoch:'')+(this.victoryHeld?'-held':'')+phase+(state.action==='run'&&this.walking&&this.walkClip&&!this.blended?'-walk':'')+(state.action==='jump'&&this.falling?'-fall':'')+(state.action==='idle'?this.idleRig?.key??'':'');
    if(key!==this.actionKey){
      // Standing up out of a relaxed stance into a fight-ready one, or back:
      // a weight shift, not a snap (see IdleProfile.ready).
      const stanceSwitch=state.action==='idle'&&this.previousAction==='idle'&&key.endsWith('-ready')!==this.actionKey.endsWith('-ready');
      this.actionKey=key;this.struck=false;let clip=recoil?.clip??melee?.clip??this.clipFor(state);if(combo>=0){clip=this.clip(combo===2?'adapted heavy':'adapted light')??clip;}
      if(clip){
        // A reaction snaps on the frame the blow lands - that is what a
        // reaction is - and blends everything after it. A knockdown's fall,
        // slam, settle and get-up are 2.4 m of pose change between them, and
        // teleporting through each of those is the worst pop in the game.
        const reacting=REACTION_ACTIONS.has(state.action);
        // Round 15 (REHIT): and the server starting a reaction again for the
        // blow a touch has just struck - the struck blend that touch started
        // still running, on the same clip - is struck again. The touch's blend
        // ran toward the running recoil (its clock is the action's until the
        // server starts it again: `reactionSince`), so the restart is where the
        // recoil goes back to the blow; it had the shorter blend of a
        // reaction's own phase change (REACT_PHASE, as short as 60 ms), and a
        // head went 9-15 cm in a frame as a light string landed (Gummy).
        const again=reacting&&this.started&&this.transitioning&&this.blendKind==='struck'&&clip===this.active?.getClip()&&this.blendedEpoch===this.reactionEpoch;
        const struck=reacting&&(this.blendedEpoch!==this.reactionEpoch||again);
        // Where the clip opens: a paced swing may start part way in.
        const opensAt=finite&&ATTACK_SLOTS.has(state.action)&&!recoil&&!melee&&combo<0?(this.contactCurve(this.swap?this.swap.paced({...state,actionTime:0}):{...state,actionTime:0},clip)??0)*clip.duration:0;
        // Round 3e (REACT): a reaction's own phase changes - the throw into the
        // somersault, the floor, the get-up - are blended over REACT_PHASE,
        // scaled by how far apart the poses are (they were 35-90 ms).
        let duration=reacting?struck?(this.bigSnap?BIG_SNAP:STRUCK_BLEND):THREE.MathUtils.clamp(this.poseDistance(clip)*.2,REACT_PHASE[0],REACT_PHASE[1])
          :melee?Math.max(0,Math.min(.11,melee.contact-melee.elapsed-.035)):state.action==='idle'?.24:state.action==='guard'?.08:.11;
        // Round 15 (REHIT): a launch is struck, but never so fast that its
        // widest joint turns more than ENTRY_STEP in a frame at the blend's
        // steepest (the rule a swing's entry keeps). Out of a recoil the arms
        // can be half a turn from the launch's flail - Akagane's flung behind
        // him, twisted as his stance holds them, 177 degrees from it - and a
        // tenth of a second put a hand 27 cm through one frame as Sekka's
        // finisher threw him. A big blow keeps its one-frame snap.
        if(struck&&!this.bigSnap&&state.action==='launched'&&this.posed){this.poseDistance(clip);duration=Math.max(duration,Math.min(LAUNCH_ENTRY_MAX,this.poseGapMax*1.5/(ENTRY_STEP*60)));}
        if(reacting)this.blendedEpoch=this.reactionEpoch;
        if(struck)this.bigSnap=false;
        // Scaled by how far the two poses actually are apart. A reaction still
        // snaps - that is what a reaction is - and a melee blend still has to
        // fit inside its own wind-up, so neither is touched.
        // Not on the first clip a body ever plays: the pose it is coming from
        // is the bind pose, which nobody was ever in, so the distance between
        // the two says nothing about how long the change should take.
        if(this.posed&&!reacting&&!melee){
          duration*=THREE.MathUtils.clamp(this.poseDistance(clip,opensAt)/.34,.5,1.5);
          // And never so short that the widest joint has to turn more than
          // ENTRY_STEP in a frame at the blend's steepest, which is 1.5x its
          // average. A swing's entry is a pose the fighter snaps to; it is
          // not a pose they teleport to.
          if(finite&&ATTACK_SLOTS.has(state.action))duration=Math.max(duration,Math.min(ENTRY_MAX,this.poseGapMax*1.5/(ENTRY_STEP*60)));
          // Round 3e (REACT): a dash too - out of a run the widest joint is
          // often most of a half turn from the dash's lean (see DASH_ENTRY).
          if(state.action==='dash')duration=Math.max(duration,Math.min(DASH_ENTRY[1],this.poseGapMax*1.5/(ENTRY_STEP*60)),DASH_ENTRY[0]);
        }
        // And never longer than a fifth of the move it is blending into. A
        // dash is a fifth of a second and its blend could run to a sixth of
        // one, so the dash clip reached full weight with the dash almost over
        // and was immediately crossfaded out again - its shape was on screen
        // for about two frames. A dash should pop into its pose.
        // Round 3e (REACT): not in one frame, though. Held to a fifth of a
        // 0.22 s dash, the blend was 45 ms - three frames - and the third
        // blind critic measured a hand or a head crossing 22-72 cm in one of
        // them on every fighter it dashed (Nigo, Gaunt, KoKo, Setsu). A
        // dash may spend DASH_ENTRY_SHARE of itself getting into its pose.
        // (Lock combat's strings: a third of the stage, so the step from the last stage's pose is not a cut - the blind
        // critic saw one frame from a lunge to upright; measured, the head moved 12-18 m/s in the first frames of a stage.)
        if(!reacting&&state.actionDuration>0)duration=Math.min(duration,state.actionDuration*(state.action==='dash'?DASH_ENTRY_SHARE:state.lockRound!==undefined&&state.action==='light'?.36:.2));
        // And never shorter than a few frames of whatever rate is actually
        // being drawn. A 35 ms blend renders five intermediate weights at
        // 144 fps and one frame at 0.99 at thirty - which is a cut, on every
        // transition, on exactly the machines that were already struggling.
        // The melee branch was worse than that: its duration is the time left
        // before contact, the phase boundary is detected up to a frame late,
        // and below about 30 fps that arithmetic lands on zero outright.
        // The reaction snap is left alone - snapping is what a reaction is.
        if(!struck&&duration>0)duration=Math.max(duration,Math.min(.1,2.5*real));
        if(stanceSwitch)duration=READY_BLEND;
        // The frame a blow lands, the limbs snap and the root does not: a
        // body carried two metres into a swing comes back over a tenth of a
        // second rather than in one frame.
        // Round 3f (POPS2, ported for the combo enders): a body a move had carried out (ROOT_RETURN_RATE) comes back no
        // faster than a step, whatever the next move's own blend - a string's stage carried a lunge's metre out, and
        // the ender it is pressed into opens at home in a fifth of its own wind-up.
        const carried=this.rootClamped&&!struck?_rootLead.subVectors(this.rootDrawnLast,this.rootReference).length()*(this.group.getWorldScale(_rootShift).x||1):0;
        const rootDuration=struck?Math.max(duration,STRUCK_ROOT):Math.max(duration,Math.min(ROOT_RETURN_MAX,1.5*carried/ROOT_RETURN_RATE));
        this.startPoseBlend(this.started?duration:0,this.started?rootDuration:0,
          // Classed by both ends: a swing's recovery into the idle is an
          // attack transition as much as the idle into a swing is.
          struck?'struck':reacting?'reaction':ATTACK_SLOTS.has(state.action)||ATTACK_SLOTS.has(this.previousAction)?'attack'
            :REACTION_ACTIONS.has(this.previousAction)?'reaction':'motion');
        this.posed=true;
        this.restoreSampledPose();
        this.mixer.stopAllAction();
        const next=this.mixer.clipAction(clip).reset().setEffectiveWeight(1).play();
        const once=finite||clip.name===VICTORY_ENTRY;
        next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.timeScale=finite?0:1;
        // A run resumes where it left off. `reset()` puts the clip at zero,
        // and for the rigs that play their run by rate rather than off the
        // stride clock nothing overwrote it, so every dash, jab or flinch
        // that interrupted a run swapped the planted foot when the run came
        // back. `gait` still holds the phase the run was at.
        if(clip===this.runClip)next.time=this.gaitTime(clip,'run');
        // A move whose tail had already settled into the stance hands over
        // to the stance at the same point of its cycle, not at its start.
        if(clip===this.idleClip&&this.tailWeight>.01)next.time=this.tailTime%clip.duration;
        this.tailWeight=0;this.tailSince=0;
        this.active=next;
      }
    }else if(this.started&&REACTION_ACTIONS.has(state.action)&&this.blendedEpoch!==this.reactionEpoch){
      // Round 3e (REACT): a blow landing on a reaction the server has not
      // started again moves the recoil's clock (`reactionSince`) under the
      // same clip. The local fighter is drawn from its own copy, a display
      // delay ahead of the blow's event: its reaction starts again first and
      // the blow's clock arrives after, and the recoil went back 0.1-0.2 s in
      // one frame - a hand 40 cm - with no blend at all. Cross-faded, as a
      // reaction started again is.
      this.blendedEpoch=this.reactionEpoch;
      this.startPoseBlend(this.bigSnap?BIG_SNAP:STRUCK_BLEND,STRUCK_ROOT,'struck');this.bigSnap=false;
    }
    this.restoreSampledPose();
    let runSign=1,wantHip=0;
    // Guard is in here too: a fighter blocking and backing away is the most
    // common piece of movement in the game, and without this the overlaid
    // stride below would walk him forward while he retreats.
    if(state.action==='guard'&&this.locomotionSpeed>.4){
      // Where the feet are actually going, against where the fighter is
      // looking. Before this, strafing and backing away both played a forward
      // run, which is what made movement read as skating.
      if(Math.hypot(this.velocity.x,this.velocity.z)>1e-3)this.runBearing=Math.atan2(this.velocity.x,this.velocity.z);
      // (Against `facing`: a form's own yaw is its fighter's, its velocity the world's - see carriedVelocity.)
      const facing=this.facing,relative=Math.atan2(Math.sin(this.runBearing-facing),Math.cos(this.runBearing-facing));
      // Two thresholds, because this decides which way the clip runs: at one
      // crossing point a fighter circling an opponent flickers between the
      // forward and the backward cycle every few frames.
      const reversing=this.reverseBlend>.5?Math.abs(relative)>1.9:Math.abs(relative)>2.35;
      this.reverseBlend+=((reversing?1:0)-this.reverseBlend)*(1-Math.exp(-dt*11));
      const ahead=THREE.MathUtils.clamp(relative,-.95,.95);
      const behind=Math.atan2(Math.sin(relative+Math.PI),Math.cos(relative+Math.PI))*.5;
      // Blended along the shortest arc rather than switched between.
      wantHip=ahead+Math.atan2(Math.sin(behind-ahead),Math.cos(behind-ahead))*this.reverseBlend;
      // The sign flips once, half way through the blend. Never interpolated:
      // it would pass through zero, and a zero time scale is a frozen clip.
      if(this.reverseBlend>.5)runSign=-1;
    }else this.reverseBlend=0;
    // The hips lead a turn, which is most of what sells one. Not during a
    // snap: a strafe and a fifty-five degree auto-aim stack to eighty-three
    // degrees of twist, and the spine cannot carry that.
    if(!snapping)wantHip=THREE.MathUtils.clamp(wantHip+THREE.MathUtils.clamp(-this.turnRate*.05,-.42,.42),-.95,.95);
    this.hipYaw+=(wantHip-this.hipYaw)*(1-Math.exp(-dt*9));
    // A melee approach, which is the one time a fighter crosses several metres
    // of floor without `state.action` being 'run'. The stride is mixed in by
    // how fast the body is actually travelling and taken back out once the
    // blow has landed, so the follow-through is the pose the animator drew.
    {
      const stride=TARGET_STRIDE*(this.legLength||.85)*(STRIDE_SCALE[this.state.fighter]??1);
      this.strideClock+=this.travelled/Math.max(.2,stride);
      const attacking=ATTACK_SLOTS.has(state.action)&&state.actionDuration>0;
      const kicking=this.authoredKick(state)||this.authoredFloorStrike(state)||this.authoredHover(state)||this.authoredStep(state);
      const move=attacking?this.moveFor(state):undefined;
      const past=move?drawn.actionTime*drawn.actionDuration-move.contacts[move.contacts.length-1]:0;
      // Not for a fighter who strikes with their legs. Kosho's whole moveset
      // is kicks - his knee already travels more over a standing Hachoir
      // than anybody else's does mid-lunge - and mixing a walk cycle into the
      // limb that is doing the hitting would take the kick apart.
      // And a special or an ultimate the fighter walks through: since the
      // simulation preserves full directional travel during attacks,
      // the legs need a stride under the upper body's move as much as they
      // do under a lunge. The kick rule for Kosho stands for his melee moves.
      // (A combo ender in the special's slot that is a blow is a melee move like any other.)
      const walking=attacking&&(state.action==='special'||state.action==='ultimate')&&state.grounded&&!kicking&&!(Fighter.ender(state)&&move?.style==='melee');
      const want=attacking&&state.grounded&&!this.floating&&((move?.style==='melee'&&!kicking)||walking)
        ?THREE.MathUtils.clamp((this.locomotionSpeed-1.1)/2.4,0,1)*(walking?1:(1-THREE.MathUtils.smoothstep(past,0,.12)))*.62:0;
      // A previous lunge's residual gait must not bend the next authored kick.
      this.stride=kicking?0:this.stride+(want-this.stride)*(1-Math.exp(-dt*(want>this.stride?16:9)));
    }
    // Round 5 (GUMMY): a glide is not a gait: SUNRISE's plays as drawn, at any speed.
    if(this.active&&state.action==='run'&&(this.floating||this.authoredHover(state))){
      this.active.timeScale=1;
      // Torsion's flight (19 October, signature/TorsionFlight.ts): her Walk is the slow drift and her Run the
      // glide, mixed by how fast she goes as everyone's gait is. Each is one held pose, so no stride clock: forcing the
      // Run at every speed (it was, to keep the walk's knees off the glide) drew the walk and the run as one hover.
      if(this.authoredHover(state))this.gaitBlend=THREE.MathUtils.lerp(this.gaitBlend,
        THREE.MathUtils.smoothstep(this.locomotionSpeed,GAIT_RANGE[0],GAIT_RANGE[1]),1-Math.exp(-dt*9));
    }
    if(this.active&&state.action==='run'&&!this.floating&&!this.authoredHover(state)){
      // Play the clip at the rate that makes one of its steps cover the ground
      // the fighter actually covers in that time. Before this the divisor was
      // a flat 7.5 for the whole roster, while the clips themselves travel at
      // between 1.2 and 4.1 m/s - so the rate was chosen against a number no
      // clip had, and every fighter skated.
      const stride=TARGET_STRIDE*(this.legLength||.85)*(STRIDE_SCALE[this.state.fighter]??1);
      const speed=Math.max(.5,this.locomotionSpeed);
      this.gaitBlend=this.blended?THREE.MathUtils.lerp(this.gaitBlend,
        THREE.MathUtils.smoothstep(this.locomotionSpeed*this.gaitScale,GAIT_RANGE[0],GAIT_RANGE[1]),1-Math.exp(-dt*9)):1;
      // At a flat-out run there is no walk left in the mix, so the clip is
      // played the way it was before there was a gait to blend: by rate rather
      // than off the stride clock. Measured, the two agree - but the rate path
      // is the one the skate figures were taken against.
      if(this.blended&&this.gaitBlend<.995){
        // A walk and a run are one gait with a dial on it, not two states with
        // a threshold between them. Crossing that threshold used to swap the
        // clip and restart the cycle; there was no gait in between, so easing
        // onto the stick gave a walk or a sprint and nothing else.
        //
        // Both clips are read from the same stride clock, so what is blended
        // is two poses at the same point of the same step rather than a mush
        // of two unrelated ones.
        // A lower bound in steps/second, not clip playback rate: these clips
        // contain very different numbers of steps. The sprint's 0.7x floor
        // made Kenzo walk at 5.6 steps/second; no floor let Kagari hang in a lifted
        // pose. Two slow footfalls a second retain the walking rhythm.
        const step=CADENCE[this.cadenceKey]?.run?.step??this.runClip!.duration/2;
        const rate=THREE.MathUtils.clamp(step*speed/Math.max(.2,stride),step*2.2/this.gaitScale,CADENCE_RANGE[1]);
        this.gait+=runSign*rate*real/step;
        this.active.timeScale=0;
        this.active.time=this.gaitTime(this.runClip!,'run');
      }else{
        // Keep the stride clock in step with the clip the mixer is running, so
        // dropping back into a walk picks the gait up where it was.
        const runStep=CADENCE[this.cadenceKey]?.run?.step;
        if(runStep)this.gait=this.active.time/runStep;
        const walking=this.walking&&!!this.walkClip;
        const cadence=CADENCE[this.cadenceKey]?.[walking?'walk':'run'];
        this.active.timeScale=(cadence&&cadence.step>0&&stride>0
          ?THREE.MathUtils.clamp(cadence.step*speed/stride,CADENCE_RANGE[0],CADENCE_RANGE[1])
          :THREE.MathUtils.clamp(speed/(walking?3.2:7.5),.65,1.25)*1.05)*runSign;
      }
    }
    if(this.active&&state.action==='jump'){
      const clip=this.active.getClip();
      this.active.timeScale=0;
      if(this.falling){
        // Laid across the whole descent by how much of it is left, so the
        // clip's compression frames arrive on the touchdown rather than
        // somewhere after it - and so that however far the body has to fall,
        // the clip is moving the whole way down instead of waiting.
        const gone=this.isForm?(this.jumpAge-this.fallAt)/this.fallFrom:1-this.timeToGround(state)/this.fallFrom;
        this.active.time=clip.duration*THREE.MathUtils.clamp(gone,0,1);
      // Round 4b (JUMP): the takeoff is laid across the fighter's own rise (0.43-
      // 0.48 s to a 4-5.6 m apex, jumpArc), eased out - the push off the floor at
      // speed, then slowing into the top of the arc - and held there through the
      // hang. At 1.4x of wall time the short takeoffs (0.54 s) were spent a third
      // of the way up and stood on one frame for the rest of the climb.
      }else{const u=Math.min(1,this.jumpAge/jumpArc(state.fighter).rise);this.active.time=clip.duration*.72*(1-(1-u)*(1-u));}
    }
    // Cut the blend at contact rather than a frame and a half before it, so
    // a blend that was floored above is not immediately thrown away at a low
    // frame rate - which is how it came back as a cut anyway.
    if(melee&&melee.elapsed>=melee.contact-Math.min(.035,real))this.blendDuration=0;
    // A blow confirmed on the grounded melee's own contact lands on its
    // measured peak - only when it is the blow being drawn (see FREEZE_EARLY):
    // a late confirmation used to wind the follow-through back to the peak.
    const holding=this.hitFreeze>0&&this.freezeHonoured&&!recoil;
    if(this.strikeContact&&this.active&&melee&&holding)this.active.time=this.active.getClip().duration*TAISEI_MELEE_CONTACTS[melee.phase].peak;
    this.strikeContact=false;
    this.hitFreeze=Math.max(0,this.hitFreeze-real);this.hitFlash=Math.max(0,this.hitFlash-real);this.freezeSeen=this.hitFreeze;
    this.shakeLeft=Math.max(0,this.shakeLeft-real);
    // A big blow's hold ends with the simulation's hitstop it was drawn into, or at BIG_HOLD_MAX if the drawn state never showed one.
    if(this.bigLeft>0){this.bigLeft=Math.max(0,this.bigLeft-real);if(state.hitstop)this.bigStopSeen=true;else if(this.bigStopSeen){this.bigLeft=0;this.bigStopSeen=false;}}else this.bigStopSeen=false;
    // Round 3e (MODELS2): the colour comes with the swap, under the burst, quickly.
    this.awaken.value=THREE.MathUtils.lerp(this.awaken.value,this.swapped(state)?1:0,1-Math.exp(-dt*(state.action==='awaken'?24:7)));
    {
      // The transformation's colour, on the body, for the two fighters whose
      // transformation is only an aura. Emissive is added flat, so on anything
      // dark it is not a tint but a repaint: the RAKSHASA's black coat came out
      // solid green, and so did his skin. A fighter who grew a body of their
      // own does not need to be coloured in as well.
      // (Launch night: whoever stands the aura, not only a definition that burns - standingAura.ts.)
      const rim=this.auraColor(),glow=this.awaken.value*(standingAura(state.fighter)??0)*.12,
        base=state.fighter==='ouga'?.2:0;
      const ownGlow=BRIAR_GLOW.has(state.fighter);
      for(const m of this.outlineMaterials)if(m instanceof THREE.MeshToonMaterial&&!m.userData.ink&&!(ownGlow&&/^glow_/.test(m.name)))m.emissive.setRGB(base+rim.r*glow,base+rim.g*glow,base+rim.b*glow);
    }
    {
      // The feel pass: the body flash (applyHitFlash) - held near
      // full for the first frames, then eased out; white at the blow, then
      // cyan-white for any blow and the thrower's colour for a big one. A big
      // one starts hot enough to catch a little bloom; the rest stay under it.
      const f=this.flashTotal>0?this.hitFlash/this.flashTotal:0,knee=this.flashBig?.7:.72;
      // Held flat-out for the first frames, then eased off.
      // The dream loop (22 October 2026): about half as strong as it was - a hit reads off its burst and the body's
      // snap, not a body painted white; this is the light of the blow on it, not a cut-out.
      // (Round 40: under the dream switch the body goes red almost at once and stays red while it flies - see DREAM_FLASH.)
      const amount=f>0?(this.flashBig?(DREAM_IMPACT?DREAM_FLASH.bigAmount:.9):DREAM_IMPACT?DREAM_FLASH.amount:.6)*(f>knee?1:Math.pow(f/knee,this.flashBig?1.15:1.6)):0;
      const toward=Fighter.whiteFlash?0:DREAM_IMPACT?Math.min(1,(1-f)*DREAM_FLASH.redden):this.flashBig?Math.min(1,(1-f)*2.2):.6+.4*(1-f),peak=DREAM_IMPACT?(this.flashBig?1.1:1):this.flashBig?1.25+.4*f:1.05,t=this.flashTint;
      this.flash.value.set(THREE.MathUtils.lerp(1,t.r,toward)*peak,THREE.MathUtils.lerp(1,t.g,toward)*peak,THREE.MathUtils.lerp(1,t.b,toward)*peak,amount*VFX.bodyFlash*(Fighter.whiteFlash&&!this.flashBig?.55:1));// (VISUAL EFFECTS: the level's share, render/vfxLevel.ts)
      this.flashFlat.value=DREAM_IMPACT?this.flashBig?DREAM_FLASH.flat:DREAM_FLASH.flatLight:0;
    }
    // Every frame, a hold included: the drawn clock holds (see `stepMoveClock`),
    // so a hold is the same frame drawn again rather than the clip left where
    // it was while the move ran on without it.
    if(this.active&&finite){let progress=recoil?.progress??melee?.progress??(combo<0?this.contactCurve(this.swap?this.swap.paced(drawn):drawn):null)??Math.min(.999,Math.max(0,drawn.actionTime));if(state.fighter==='taisei'&&state.action==='special'&&!Fighter.ender(state)&&!this.swap&&!isCharacterMotion(this.active.getClip())){
        const t=drawn.actionTime*drawn.actionDuration,contact=MOVES.taisei.special.contacts[0],charge=t/contact;
        // Keep the source's charge/release poses, but distribute their actual
        // motion across the interval. A footage-linear sweep crossed the
        // source's forearm snap in one rendered frame (86 degrees at 60 Hz).
        const table=clipMotionTable(this.active.getClip());
        // Round 3d (PACE): the push to the release keeps the 0.34 s it had
        // when the beam came at 1.35 s (the last quarter of the wind-up), and
        // the charge before it is what shortens: squeezed into the last
        // quarter of a 0.75 s wind-up, it put a 0.2 m head step in one frame.
        const push=Math.max(.55,1-SUNPALM_PUSH/contact);
        const from=charge<push?.32:charge<1?.51:.68,to=charge<push?.51:charge<1?.68:.84;
        const u=THREE.MathUtils.clamp(charge<push?charge/push:charge<1?(charge-push)/(1-push):(t-contact)/(state.actionDuration-contact),0,1);
        progress=clipAtMotion(table,THREE.MathUtils.lerp(motionAt(table,from),motionAt(table,to),u));
      }
      // A take of their own drawn for another swap than theirs drives out on theirs (AWAKEN_TAKE_DRIVE).
      const drive=state.action==='awaken'&&!this.isForm?AWAKEN_TAKE_DRIVE[state.fighter]:undefined;
      if(drive!==undefined&&this.active.getClip().name===AWAKEN_TAKE[state.fighter])
        progress=Math.min(.999,awakenTakeTime(drawn.actionTime*drawn.actionDuration,awakeningSwapAt(state.fighter),drive)/this.active.getClip().duration);
      if(combo>=0)progress=(progress*3)%1;
      else if(!recoil){
        // A swing never runs backwards inside one move. The authoritative copy
        // of an attack starts a round trip after the local one, so when the
        // server's timestamp is finally taken the move's clock steps back by
        // the latency - about fifty milliseconds of the swing, played again.
        //
        // Only a swing: a reaction is the server's outright, so it has no
        // handover to absorb, and some of them deliberately run a clip back
        // and forth - a launched body that has spent its air clip keeps
        // turning rather than holding one pose all the way down.
        if(this.drawnEpoch!==this.actionEpoch){this.drawnEpoch=this.actionEpoch;this.drawnProgress=0;}
        progress=Math.max(progress,this.drawnProgress);this.drawnProgress=progress;
      }
      // A backdash plays the dash clip backwards: no rig ships one of its
      // own, and the forward clip run forward under a body going the other
      // way is a fighter moonwalking.
      // Round 3c: a dash plays no faster than DASH_RATE. Its clip is a sprint
      // cycle of two to five steps, 0.8-1.5 s long, and the dash is a fifth of
      // a second: laid across it whole, Kenzo's and Ward's legs pumped at seven
      // times speed and a hand crossed 1.2 m in one frame. The burst reads in
      // the first stride; the next move blends out of wherever it got to.
      if(state.action==='dash'&&drawn.actionDuration>0){const clip=this.active.getClip(),end=Math.min(clip.duration,this.isForm?clip.duration:DASH_CLIP_END[state.fighter]??clip.duration);progress=Math.min(progress,.999*Math.min(end/clip.duration,drawn.actionTime*DASH_RATE*drawn.actionDuration/clip.duration));}
      if(state.action==='dash'&&state.dashKind==='back')progress=1-progress;
      const segment=this.segmentOf(state);
      this.active.time=segment?segment.from+(segment.to-segment.from)*progress:this.active.getClip().duration*progress;}
    // Wall time, not the clamped step. This advances clip time and crossfade
    // weights, both of which are durations the animator authored in seconds:
    // a 0.12 s blend should take 0.12 s whatever the frame rate, and a run
    // clip played at a rate chosen to match the ground speed only covers that
    // ground if it is advanced by the time the ground moved in.
    // The garments' swing off first, so the clip below starts from the clip's rotation, not a held swing (see unswing).
    this.secondary?.unswing();
    this.mixer.update(state.timeStopped||state.hitstop?0:real);
    // A gait clip that does not loop. Kenzo's Run ends 65 degrees of knee
    // from where it starts and Konta's 71 (scripts/probe_loop_seam.mts,
    // against a typical frame of 16-18): every wrap of the cycle was a cut,
    // twice a second at a sprint. The wrap is blended over a few frames, from
    // the pose that was drawn, whenever no other transition is in flight.
    // Gait clips only. A guard's Block loops too, and blending its wrap
    // crossfaded the stride overlay's legs against themselves: Kenzo's
    // blocking walk went from a 54% to a 65% slide the first time this ran
    // on every loop.
    if(this.active){
      const clip=this.active.getClip(),time=this.active.time;
      if(this.active===this.loopAction&&/run|walk|dash/i.test(clip.name)&&time<this.loopTime-clip.duration*.5&&!this.transitioning)this.startPoseBlend(LOOP_BLEND,LOOP_BLEND,'loop');
      this.loopAction=this.active;this.loopTime=time;
    }
    this.sampleActivePose();
    this.selectShakugoArms(drawn);this.selectOyashioHands(drawn);this.selectSenkoHands(drawn);this.selectTokanMeshes(drawn);this.selectHighsunSunhammer(drawn);this.selectShakudoBlade(drawn);this.selectMadakeBody(drawn);
    this.settleTail(state.timeStopped||state.hitstop?0:real,drawn);
    // Wall time for the two as well: a blend is an authored duration, and on
    // the clamped step a 0.11 s transition took 0.44 s of wall clock at five
    // frames a second - half a move played while the body was still half in
    // the previous pose. A blend that cannot be drawn in more than one frame
    // collapses to a cut, which is the right answer on that machine.
    this.guardStride(state.timeStopped||state.hitstop?0:real,state,runSign);
    this.airTuck(real,state);
    this.torsionFlight(state.timeStopped||state.hitstop?0:real,state);
    // Launch day (rfhands): a hand the clip leaves flat or fanned, posed: after the clip is sampled (and the stance mixed in
    // under a spent move) and before the blend records it, so it is part of the animation (look/hands.ts). Not a spirit's
    // body, which is its user's fighter by id only; and not a body off the camera's view (`unseen`): in a twelve-fighter
    // match most are, and their fingers are cold memory nobody is looking at.
    if(this.hands&&this.active&&!this.isSpirit&&!this.unseen&&HANDS.on)this.hands.apply(this.active.getClip(),drawn,real);
    this.applyPoseBlend(real);
    this.pinHeldEquipment();
    this.turnWheel(state.timeStopped||state.hitstop?0:real,state);
    this.limitRootMotion(drawn,dt);
    this.driveRagdoll(state,real);
    const finger=this.spiritHands.length>0&&state.action==='heavy'&&this.slotClip(state,['Needle Finger']);for(const hand of this.spiritHands){const pointing=hand.name==='iron-pointing-hand';hand.visible=pointing?finger:!finger;if(pointing&&hand.morphTargetInfluences){const t=state.actionTime*state.actionDuration,c=MOVES.koko.heavy.contacts[0],d=state.actionDuration;/* Round 3d (PACE): out from the shot, back by the move's end (it was .35-.65 and .8-1.3 s of a .92 s move). */hand.morphTargetInfluences[0]=THREE.MathUtils.smoothstep(t,c-.01,c+.5*(d-c))*(1-THREE.MathUtils.smoothstep(t,c+.75*(d-c),d));}}
    this.previousAction=state.action;
    for(const expression of this.faceExpressions)expression.weights[expression.index]=expression.value;
    for(const hand of this.scaledHands)hand.scale.setScalar(this.handScale);
    for(const grip of this.grips)grip.bone.quaternion.copy(grip.target);
    // The held chamber's weight, eased in and out. Cleared by anything that is
    // not a paced swing, or a tremor would outlive the move it belongs to.
    if(!ATTACK_SLOTS.has(state.action))this.chargeWanted=0;
    this.chargeHold+=(this.chargeWanted-this.chargeHold)*(1-Math.exp(-dt*9));
    this.chargeWanted=0;
    this.group.updateMatrixWorld(true);
    // Off the camera's view the layers that only refine how the body looks wait (see `unseen`); the fighter's own
    // clock, which foot planting keeps, still runs.
    if(this.unseen){this.wasUnseen=true;this.serverTime+=state.timeStopped||state.hitstop?0:dt;}
    else{
      if(this.wasUnseen)this.wake();
      // The layers timed off a move's contacts read the move's clock as the clip
      // is drawn from it (round 3c), or they run a tick ahead of or behind the
      // blow they are shaped around.
      this.bodyDynamics(state.timeStopped||state.hitstop?0:dt,drawn,real);
      this.holdLife(state.timeStopped||state.hitstop?0:dt,drawn,real);
      if(this.dynamics)this.idleRig?.apply(this.facing);
      // The feel pass: a big blow's reaction holds where it snapped to
      // for as long as the simulation holds the body (see BIG_SHAKE).
      this.hitReact(state.timeStopped||this.bigHolding(state)?0:real,state);
      this.impactPose(state,real);
      this.rubberLimbs(drawn,state.timeStopped?0:real);
      this.group.updateMatrixWorld(true);
      this.footPlanting(state.timeStopped||state.hitstop?0:dt,state);
      this.aimHead(state.timeStopped||state.hitstop?0:dt,state);
      // Last, on the pose that is actually drawn. Running it before the lean,
      // the planting and the gaze corrected a pose nobody ever saw.
      this.supportTransition(state.timeStopped||state.hitstop?0:dt,state,real);
      this.group.updateMatrixWorld(true);
      this.stabilizeLegs(state.timeStopped||state.hitstop?0:real,state,placed);
      this.floorFeet(state,state.timeStopped||state.hitstop?0:real);
      for(const leg of this.legs)for(const bone of [leg.hip,leg.knee,leg.ankle]){
        let previous=this.legPresentation.get(bone);
        if(!previous){previous=new THREE.Quaternion();this.legPresentation.set(bone,previous);}
        previous.copy(bone.quaternion);
      }
      this.mouthBlade();
      // Cloth and hair are solved last, against finished world matrices, so the
      // lag reflects where the body actually ended up this frame, and the hair
      // answers the head turn above as well as the body.
      this.secondary?.launch(state.alive&&(state.action==='launched'||(state.action==='knockdown'||state.action==='getup')&&coatFlownWhileDown(state.fighter)||coatFlownInKick(state))?1:0,this.groundY);
      this.secondary?.update(state.timeStopped||state.hitstop?0:dt);
      // The feel pass (AnimStyle 'twos'): through an attack or a
      // reaction the body's whole pose - clip, layers, springs - is drawn on
      // the 30 Hz grid: the frames between two steps show the last step again,
      // while the body still travels, and the camera and the effects run on.
      this.stepPoseHold(state);
    }
    this.updateSmear(state,real);
    // What the blows inside this body push it to, from the next frame.
    this.contactPush(real,state);
    const shadow=this.contactShadow;
    shadow.position.y=this.groundY-state.y+.012;
    // (Round 5, GUMMY: and fainter under a floating SUNRISE - gummy/sunrise.ts - which stays on the floor.)
    shadow.material.opacity=.3/(1+(Math.max(0,state.y-this.groundY)+this.formLift)*.7);
    const forward=_handForward.set(Math.sin(visualYaw),0,Math.cos(visualYaw));
    this.fallback.copy(this.group.position).addScaledVector(forward,.55).addScaledVector(UP,1.15);
    if(this.rightBone)this.rightBone.getWorldPosition(this.handR);else this.handR.copy(this.fallback);
    if(this.leftBone)this.leftBone.getWorldPosition(this.handL);else this.handL.copy(this.fallback);
    // Hands drawn toward a knuckle, where the fighter's socket declaration says (Ouga's: src/engine/client/sockets.ts).
    {const hands=FIGHTER_SOCKETS[state.fighter]?.hands;if(hands){for(const [side,hand]of [['right',this.handR],['left',this.handL]]as const){const knuckle=this.bones.get(side+hands.toward);if(knuckle)hand.lerp(knuckle.getWorldPosition(this.fallback),hands.by);}}}
    // Round 3d (owner): an awakened spirit's user no longer steps out of the
    // fight - the spirit looms over them instead (SwordSpiritEffects' LOOM), so
    // the body stays drawn.
    if(this.awakenedForm){
      // Awakening owns the form model now: Full Swell and the NIGHTFALL are
      // the body for the whole window, not a flash inside one move. The swap
      // lands part-way through the transformation, behind the aura burst.
      const elapsed=state.actionTime*state.actionDuration;
      // Late in the transformation, not half way: the swap should be the last
      // thing that happens, so the fighter is seen changing into the form
      // rather than the form standing there while the pose plays out.
      // Round 3e (MODELS2): on the entry's burst (awakeningSwapAt), under its flash.
      const transformed=this.swapped(state);
      // A worn form leaves its fighter visible; a replacement body does not.
      const worn=AWAKENINGS[state.fighter].formTint!==undefined;
      // A replacement body is also shown for the middle of the ultimate when
      // the fighter is not awakened - Full Swell for Grand Tide. A worn
      // shell is not: Ikazuchi Arrow already summons its own full-size
      // Guardian, and drawing the worn one under it put two Guardian in the
      // frame, the smaller inside the larger.
      // Round 3d (ULTS): a hit-confirm ultimate's form is its cinematic's -
      // the base body throws the opener, and the form comes on the confirm.
      const hitConfirm=!!MOVES[state.fighter].ultimate.confirm;
      const fromStart=state.fighter==='gummy'?elapsed>=GRAND_TIDE_TAKE.swap:hitConfirm?state.confirmedAt!==undefined:elapsed>=.48;
      const until=state.fighter==='gummy'?grandTideOut(state,WHIFF_RECOVERY):state.actionDuration-.23;
      let show=transformed||(state.fighter!=='konta'&&!OWN_BODY_ULTIMATE.has(state.fighter)&&!worn&&!state.awakened&&state.action==='ultimate'&&!this.swap
        &&fromStart&&elapsed<until);
      this.model.visible=!show||worn;this.awakenedForm.group.visible=show;
      // Round 5 (GUMMY): a float the form is not drawn in starts from the floor the next time it is.
      if(!show)this.formLift=this.floatOffset=0;
      if(state.fighter==='konta'){
        if(this.cameraPoint)this.formEye.value.copy(this.cameraPoint);
        const swap=awakeningSwapAt(state.fighter);
        const goal=state.awakened?(state.action==='awaken'?THREE.MathUtils.smoothstep(elapsed,swap,Math.min(AWAKENING_ENTRY,swap+.4)):1):0;
        this.formReveal+=THREE.MathUtils.clamp(goal-this.formReveal,-real*6,real*6);
        if(!state.awakened&&ATTACK_SLOTS.has(state.action))this.formReveal=0;
        show=this.formReveal>.001;this.awakenedForm.group.visible=show;this.model.visible=this.formReveal<.999;
        this.formOpacity.value=1-this.formReveal;this.awakenedForm.formOpacity.value=this.formReveal;
        for(const material of this.outlineMaterials)material.opacity=1-this.formReveal;
        for(const material of this.awakenedForm.outlineMaterials)material.opacity=this.formReveal;
      }
      if(show){
        this.awakenedForm.targetDistance=this.targetDistance;this.awakenedForm.cameraPoint=this.cameraPoint;
        this.awakenedForm.carriedVelocity=(this.awakenedForm.carriedVelocity??new THREE.Vector3()).copy(this.velocity).divideScalar(this.awakenedForm.group.scale.x);
        this.awakenedForm.unseen=this.unseen;
        // (Round 5, GUMMY: a floating SUNRISE is placed at its float - floatForm - which its own update puts its body at.)
        this.awakenedForm.update(dt,{...state,x:0,y:this.awakenedForm.floating?this.floatOffset:0,z:AWAKENINGS[state.fighter].formForward??0,yaw:0},true,real);
        this.awakenedForm.contactShadow.visible=false;
        if(!worn){
          // The standing offset is baked at attach; this is drift. The sole's
          // height over a form's own cycle is not a ground signal - Kurobi's
          // run swings its lowest sole through 1.3 m - so what is corrected
          // is the SUSTAINED error: the least hover, or the least penetration,
          // the soles have shown recently. Down only from a stance, because a
          // flight phase is meant to leave the floor; up from anything, because
          // a sole under the tile is wrong wherever it is. Rate limited, and
          // never proportional: a gain of one on a per-frame minimum was a
          // 0.44 m vertical teleport.
          const y=this.awakenedForm.group.position.y;
          // Round 5 (GUMMY): SUNRISE floats (gummy/sunrise.ts): his own placing, below.
          if(this.awakenedForm.floating)this.floatForm(dt,real,state,elapsed);
          else if(state.grounded&&!REACTION_ACTIONS.has(state.action)){
            this.awakenedForm.group.updateMatrixWorld(true);
            const lowest=this.awakenedForm.lowestSupport();
            if(Number.isFinite(lowest)&&dt>0){
              const sink=this.group.position.y-lowest;
              this.formSink=Math.min(this.formSink+dt*.5,sink);
              this.formFloat=Math.min(this.formFloat+dt*.5,-sink);
              const standing=STANCE_ACTIONS.has(state.action)&&this.awakenedForm.strideWeight<.02;
              const delta=this.formSink>0?Math.min(this.formSink,.25):standing&&this.formFloat>0?-Math.min(this.formFloat,.25):0;
              const target=THREE.MathUtils.clamp(y+delta,-this.formHover-.9,-this.formHover+.4);
              this.awakenedForm.group.position.y+=THREE.MathUtils.clamp((target-y)*(1-Math.exp(-dt*22)),-.6*dt,.6*dt);
            }
          }else if(dt>0){
            this.formSink=this.formFloat=Infinity;
            // The roster-wide motion pass (FLOOR_GUARD): thrown off its feet, the form is never under the floor its
            // fighter left - lifted by what its soles are short, as the fighter's own body is, quickly up.
            let rest=-this.formHover;
            if(this.thrown(state)){
              this.awakenedForm.group.updateMatrixWorld(true);
              const lowest=this.awakenedForm.lowestSupport();
              if(Number.isFinite(lowest))rest+=THREE.MathUtils.clamp(this.groundY+.006-(lowest-(y-rest)),0,FLOOR_GUARD);
            }
            this.awakenedForm.group.position.y+=rest>y?Math.min(rest-y,FLOOR_GUARD_RATE*dt):(rest-y)*(1-Math.exp(-dt*6));
          }
        }
        // A replacement body owns the hands effects are placed from; a worn one
        // does not, or every Shrike Bolt would light up inside a giant's fist.
        if(!worn&&(FIGHTER_SOCKETS[state.fighter]?.formHands!=='awakened'||state.awakened)){this.handR.copy(this.awakenedForm.handR);this.handL.copy(this.awakenedForm.handL);}
        // Fade the shell out as the eye approaches rather than filling the
        // frame with purple: against a wall the camera has nowhere else to go.
        if(worn&&this.formMaterials.length){
          const base=AWAKENINGS[state.fighter].formOpacity??.6;
          // Scaled by the shell: a Guardian two and a half times his height
          // swallows the camera from further out than one at one and a half.
          const reach=AWAKENINGS[state.fighter].formScale??1;
          // Except as it rises: the awakening's lens stands two or three metres off, inside a 4.2 m shell's fade, so
          // Tobari's and Akagane's Guardian were never seen to form ("a faint see-through outline in the last frame", the
          // blind critics, 3 October). Through the awakening and two seconds after it they fade only right at the lens,
          // as their ghost does (EmperorEffects).
          if(state.action==='awaken')this.risenAt=this.serverTime;
          const rising=(state.fighter==='tobari'||state.fighter==='akagane')&&this.serverTime-this.risenAt<2;
          const near=this.cameraPoint?THREE.MathUtils.smoothstep(this.cameraPoint.distanceTo(this.group.position),rising?.8:.75*reach,rising?2.2:1.6*reach):1;
          for(const material of this.formMaterials)(material as THREE.MeshToonMaterial).opacity=base*near;
          // Off entirely rather than a faint wash: backed into a corner the
          // camera has nowhere to go, and a two-per-cent Guardian across the
          // whole frame is worse than no Guardian at all.
          this.awakenedForm.group.visible=near>.08;
        }
      }
    }
    this.cullBounds();
  }

  // Fighters that never look at each other read as mannequins no matter how
  // the limbs move. The head tracks the locked opponent while the fighter is
  // free, and hands back to the authored pose during an attack or a reaction,
  // where the clip already owns the gaze.
  /** Round 3e (MODELS2): whether the transformation has swapped in - awakened,
   *  and past the entry's burst (awakeningSwapAt) while the entry plays. */
  /** Four-armed Magatsu's wheel (WHEEL_VIEW): tipped toward the lens and turned a notch a blow. Its joint is keyed by no
   *  clip, so it is set here each frame, after the mixer. */
  private wheel?:{bone:THREE.Bone;rest:THREE.Quaternion;turn:number;goal:number;was:string}|null;
  private turnWheel(step:number,state:PlayerState){
    if(this.wheel===undefined){
      const bone=this.model.getObjectByName('Wheel') as THREE.Bone|undefined,rest=(this.source.scene.getObjectByName('Wheel') as THREE.Bone|undefined)?.quaternion;
      this.wheel=bone&&rest?{bone,rest:rest.clone(),turn:0,goal:0,was:state.action}:null;
    }
    const wheel=this.wheel;
    if(!wheel)return;
    if(WHEEL_HITS.has(state.action)&&!WHEEL_HITS.has(wheel.was))wheel.goal+=Math.PI/4;
    wheel.was=state.action;
    wheel.turn+=(wheel.goal-wheel.turn)*(step>0?1-Math.exp(-step/(WHEEL_NOTCH/3)):0);
    // Its axis as the clip leaves it, and the lens seen from its centre.
    const bone=wheel.bone;
    bone.quaternion.copy(wheel.rest).multiply(_wheelSpin.setFromAxisAngle(_wheelAxis.set(0,1,0),wheel.turn));
    bone.updateMatrixWorld(true);
    const goal=_wheelTip.identity();
    if(this.cameraPoint){
      bone.getWorldPosition(_wheelCentre);
      _wheelAxis.set(0,1,0).applyQuaternion(bone.getWorldQuaternion(_wheelParent)).normalize();
      _wheelEye.copy(this.cameraPoint).sub(_wheelCentre).normalize();
      if(_wheelAxis.dot(_wheelEye)<0)_wheelAxis.negate();
      // Tipped the least way that shows its face at WHEEL_VIEW at least: from straight on, the rim at 90 degrees.
      const seen=Math.acos(THREE.MathUtils.clamp(_wheelAxis.dot(_wheelEye),-1,1)),most=Math.PI/2-WHEEL_VIEW;
      if(seen>most&&_wheelCross.crossVectors(_wheelAxis,_wheelEye).lengthSq()>1e-8)goal.setFromAxisAngle(_wheelCross.normalize(),seen-most);
    }
    // The tip is a turn in the world: carried into the joint's parent's frame.
    const parent=bone.parent;
    if(parent){parent.getWorldQuaternion(_wheelParent);bone.quaternion.premultiply(_wheelParent).premultiply(goal).premultiply(_wheelParent.invert());}
  }
  private swapped(state:PlayerState){
    if(!state.awakened)return false;
    return state.action!=='awaken'||state.actionTime*state.actionDuration>=awakeningSwapAt(state.fighter);
  }
  private static AIM_STATES=['idle','run','dash','guard','walk'];
  /** Keep an attack's root travel near the fighter's gameplay position. */
  private limitRootMotion(state:PlayerState,dt=0){
    const root=this.rootBone;
    this.rootOffset=0;
    const airborne=state.action==='jump'&&!state.grounded;
    // Some imported blocks are travelling dodges. The simulation already
    // moves a guarding fighter; a second move in the clip separated Kosho's
    // drawn body from his capsule/shadow by several metres.
    const guarding=state.action==='guard'&&!this.isForm;
    // A reaction clip's root rides on top of a knockback the server is
    // already applying: see REACTION_ROOT. Death is left to the ragdoll.
    const reacting=REACTION_ACTIONS.has(state.action);
    const attacking=ROOT_CLAMPED.includes(state.action);
    const shibuichiShoulderCarry=state.fighter==='shibuichi'&&state.grounded&&attacking&&shibuichiAuthoredShoulderStep(this.active?.getClip().name??'',this.active?.time??0);
    const mizuhikiContactCarry=state.grounded&&attacking&&this.mizuhikiCarry(state);
    const hagureContactCarry=state.fighter==='hagure'&&state.grounded&&attacking?hagureAuthoredContactStep(this.active?.getClip().name,this.active?.time??0,this.isForm):0;
    const murexPylonStep=state.fighter==='murex'&&state.grounded&&attacking&&this.active?.getClip().name==='Spine Breaker'&&(this.active?.time??0)>.02&&(this.active?.time??0)<.85;
    const murexRushStep=state.fighter==='murex'&&state.grounded&&attacking&&this.active?.getClip().name==='Rush 1'&&(this.active?.time??0)>.005&&(this.active?.time??0)<.463;
    const guyRushStep=state.fighter==='madake'&&state.grounded&&attacking&&madakeAuthoredRushStep(this.active?.getClip().name??'',this.active?.time??0);
    const nativeJabStep=state.fighter==='rakucho'&&state.grounded&&attacking&&rakuchoAuthoredJabStep(this.active?.getClip().name??'',this.active?.time??0);
    // (Round 78: a light blow's step in, DREAM_STEP - not a body already stepping its own measured way in.)
    const dreamStep=DREAM_IMPACT&&state.grounded&&attacking&&!this.isForm&&state.action==='light'&&!OWN_STEPS.has(state.fighter)&&!REACHING_LIGHTS.has(state.fighter)?this.dreamStepIn(state):0;
    // Every fighter, capped or not: the seven rigs without an authored cap
    // still stop at the opponent's body.
    this.rootClamped=false;
    const caps=guarding?GUARD_ROOT:airborne?JUMP_ROOT:reacting?REACTION_ROOT:this.isForm&&state.fighter==='gummy'&&state.action==='ultimate'?GRAND_TIDE_LEAP:this.isForm&&state.fighter==='konta'?{rise:.6,drop:.35,travel:.65}:(this.isForm?FIGHTERS[state.fighter].formRootMotion:undefined)??FIGHTERS[state.fighter].rootMotion??UNCAPPED;
    // Nothing to clamp: the drawn room is let go, so the next swing measures
    // its own rather than slewing from the last one's.
    // (The drawn root is only recorded on a frame the clamp moved it: a
    // transition blends in clamped space only out of such a frame.)
    if(!root||!root.parent||!(guarding||airborne||attacking||reacting)){this.roomBody=Infinity;this.fallEpoch=-1;return;}
    this.group.updateMatrixWorld(true);
    const local=this.group.worldToLocal(root.getWorldPosition(_rootWorld));
    _rootRaw.copy(local);
    // On the root's own transition clock, a transition that starts from a
    // clamped pose is blended in clamped space: from the root that was drawn
    // to the new clip's root clamped by the new action's caps. Clamping the
    // blend of the two instead compresses the drawn pose a second time - a
    // swing cut short by a hit went from its own 2 m cap to the reaction's
    // 0.55 in one frame, 1.45 m - and a clip that opens far out leaks through
    // the middle of the blend. The chain carries no drift (`startPoseBlend`),
    // so what the new clip contributes is recovered from the blend exactly.
    const grip=this.rootFromClamped?this.rootGrip:1;
    if(grip<1){const g=Math.max(grip,1e-3);local.addScaledVector(this.rootDrawnFrom,-(1-g)).divideScalar(g);}
    const sideways=local.x-this.rootReference.x,up=local.y-this.rootReference.y,forward=local.z-this.rootReference.z;
    const flat=Math.hypot(sideways,forward);
    this.rootOffset=Math.max(flat,Math.abs(up));
    // These measured contact steps already have a bounded planted recovery.
    // Soft-compressing them makes the skin stop short despite a confirmed hit.
    const stepTravel=murexPylonStep?.315:murexRushStep?.55:guyRushStep?.565:hagureContactCarry?hagureContactCarry+.015:shibuichiShoulderCarry?.75:mizuhikiContactCarry?.60:nativeJabStep?.34:0;
    const flatScale=flat>1e-4?(stepTravel?Math.min(flat,stepTravel):softLimit(flat,caps.travel))/flat:1;
    const ceiling=up>=0?caps.rise:caps.drop;
    // Ume's reviewed kneeling smashes place skin on the sole plane. The
    // general tanh cap starts compressing immediately and lifted the entire
    // pose by13cm despite its native drop being inside the measured .54m cap.
    // Preserve that bounded native downward travel on grounded attacks only.
    // Authored psychic hover likewise keeps its bounded lift instead of being flattened.
    const nativeFloor=(state.fighter==='ume'||(state.fighter==='shakudo'||state.fighter==='shibuichi')&&this.authoredFloorStrike(state))&&state.grounded&&attacking&&!reacting&&up<0;
    // Both native Guy bodies bound Midwinter Bamboo to .499m rise/.304m crouch. Preserve the
    // authored airborne kick and planted support, without changing reaction/guard roots.
    // Rush1 also has a measured planted crouch. Tanh compression lifts its
    // native soles and leaves the second manual fist above the recoiling victim.
    const nativeGuySupport=state.fighter==='madake'&&state.grounded&&attacking&&(guyRushStep||this.authoredKick(state));
    const upScale=!guarding&&Math.abs(up)>1e-4?(nativeFloor||nativeGuySupport||murexRushStep||murexPylonStep||this.authoredHover(state)?Math.min(Math.abs(up),ceiling):softLimit(Math.abs(up),ceiling))/Math.abs(up):1;
    // And no further forward than the opponent's body. The simulation holds
    // the two capsules 1.1 m apart; a clip that carries the hips two metres
    // into a swing then draws the attacker's torso inside the defender's,
    // and it snaps back out when the clip ends. The room is measured along
    // the facing to the locked opponent, smoothed, and it only shrinks the
    // cap - never the sideways travel, and never a clip that is not
    // advancing. Slewed rather than tracked: a remote opponent's position
    // arrives at thirty hertz, and a cap that followed it exactly would
    // resample that into the attacker's pelvis.
    //
    // Measured twice: against where the server holds the opponent, and
    // against the opponent's body as it is DRAWN - staggered back, lunging
    // in with a swing of their own, carried by a replacement form - with the
    // middle of this torso kept DRAWN_GAP from the middle of that one. Both
    // in this body's own frame, so a transformation's body, which hangs
    // scaled and turned under its fighter, measures in its own units.
    let ahead=Infinity,body=Infinity,lead=0;
    const scale=this.group.getWorldScale(_rootLead).x||1;
    const approach=attacking?this.moveFor(state) as MoveDefinition&Approach:undefined;
    const elapsed=state.actionTime*state.actionDuration;
    const through=!!approach?.dashThrough&&elapsed>=(approach.contacts[0]??0)-THROUGH_LEAD;
    if(!airborne&&!through){
      // A transformation's body has no target of its own; it swings at its
      // fighter's.
      const point=this.targetPoint??this.owner?.targetPoint;
      if(point&&!reacting)ahead=this.group.worldToLocal(_rootOther.copy(point)).z-PUSH_RADIUS*2/scale;
      // A struck body keeps its distance too: a stagger clip that sways the
      // torso into the attacker gives the ground back instead.
      const other=this.opponentBody();
      if(other){
        // Where it would be drawn without its contact push (see `restCenter`):
        // a body pushed off this swing's fist must not hand it more room.
        const to=this.group.worldToLocal(other.restCenter(_rootOther));
        // The other body is taken as a disc, flattened across the line of
        // attack so a torso swaying a hand's width off it does not open and
        // shut the room from one frame to the next.
        // Only a body ahead: one behind - passed through, or struck from
        // behind - is not in the way of going forward.
        // A swordsman's wider gap is for his own swing: struck, he is a body
        // like any other, and held back further his attacker's fist would stop
        // in the air short of him.
        // Contact replays measure actual armor/skin clearance for these
        // narrow authored steps. The ordinary gap remains on every other clip.
        const stepGap=murexPylonStep?.70:murexRushStep?.70:guyRushStep?.65:hagureContactCarry?.65:shibuichiShoulderCarry?.40:mizuhikiContactCarry?.56:nativeJabStep?.72:dreamStep>0?DREAM_STEP.gap:0;
        const reach=(stepGap||(attacking&&this.armed&&!this.isForm?DRAWN_GAP_ARMED[state.fighter]??DRAWN_GAP:DRAWN_GAP))/scale;
        const across=(to.x-(this.rootReference.x+sideways*flatScale))/reach;
        if(Math.abs(across)<1&&to.z>this.rootReference.z)body=to.z-this.rootReference.z-reach*Math.sqrt(1-across*across*across*across);
        // The torso leans ahead of the hips in a lunge, and it is the torso
        // that would be drawn inside the other one. This body's own pose, so
        // it is taken as it is rather than slewed: the hips give back what
        // the chest takes, on the frame it takes it.
        const top=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
        if(top)lead=Math.max(0,(this.group.worldToLocal(top.getWorldPosition(_rootLead)).z-_rootRaw.z)*.5);
      }
    }
    let forwardScaled=forward*flatScale+dreamStep/scale;
    // Slewed toward what is wanted, exponentially and within a rate: in
    // fast and out slow for the server's figure, as before; the drawn one
    // moves at most ROOM_PULL_RATE inward, and starts - the first frame a
    // swing has an opponent to measure - where it does not yet bite, so
    // the give arrives as a shift rather than on the frame the swing starts.
    // A cap that stops applying opens at the release rate and is dropped once
    // it is well past anything a clip carries; one that starts applying
    // starts where it does not yet bite.
    if(!Number.isFinite(this.roomAhead))this.roomAhead=ahead;
    else if(!Number.isFinite(ahead))this.roomAhead=dt>0?Fighter.released(this.roomAhead,dt):this.roomAhead;
    else if(dt>0)this.roomAhead+=THREE.MathUtils.clamp((ahead-this.roomAhead)*(1-Math.exp(-dt*14)),-20*dt,5*dt);
    if(!Number.isFinite(this.roomBody))this.roomBody=Number.isFinite(body)?Math.max(body,forwardScaled+lead+ROOM_KNEE):body;
    else if(!Number.isFinite(body))this.roomBody=dt>0?Fighter.released(this.roomBody,dt):this.roomBody;
    else if(dt>0)this.roomBody+=THREE.MathUtils.clamp((body-this.roomBody)*(1-Math.exp(-dt*14)),-ROOM_PULL_RATE/scale*dt,5*dt);
    // The server's figure keeps its twelve-centimetre floor, so a clip's own
    // lunge is never frozen outright against a capsule; the drawn body's
    // may go below nothing, because a body already drawn that close has to
    // give some of it back - never more than ROOM_PULL.
    // Keep measured native steps instead of clipping them to12cm at touching
    // distance. The separate drawn torso envelope still prevents overlap.
    // These allowances never move the simulation or change attack reach.
    const stepLead=murexPylonStep?.315:murexRushStep?.55:guyRushStep?.565:hagureContactCarry?hagureContactCarry+.015:shibuichiShoulderCarry?.74:mizuhikiContactCarry?.60:nativeJabStep?.38:dreamStep>0?Math.max(.12,dreamStep+.04):.12;
    let roomCap=Math.min(Number.isFinite(this.roomAhead)?Math.max(stepLead,this.roomAhead):Infinity,Math.max(-ROOM_PULL/scale,this.roomBody-lead));
    // The simulation carries a charge-in; the clip's own lunge stays home.
    if(approach?.chargeIn&&!through)roomCap=Math.min(roomCap,CHARGE_ROOM/scale);
    // Round 3c: a cap that lets go opens at ROOM_RELEASE, whichever of its
    // parts let go. Each room above is slewed, but the charge-in's hold was
    // not: at THROUGH_LEAD before Mirage Draw's cut it went from a tenth of a
    // metre to wherever the other two had got to, and Kenzo's whole body
    // jumped 1.26 m forward in one frame. Closing is left to the parts.
    if(this.capEpoch!==this.actionEpoch||!(dt>0)){if(this.capEpoch!==this.actionEpoch)this.capDrawn=roomCap;this.capEpoch=this.actionEpoch;}
    else this.capDrawn=roomCap>this.capDrawn?Fighter.released(this.capDrawn,dt):roomCap;
    roomCap=Math.min(roomCap,this.capDrawn);
    if(forwardScaled>roomCap-ROOM_KNEE)forwardScaled=softCap(forwardScaled,roomCap);
    // Round 3c: a move settling into the stance (see TAIL_AFTER) walks its
    // root home, it does not snap it. The tail lerps the clip's root toward
    // the stance's in the clip's own metres - nine of them at the end of
    // Hachoir - and the clamp held the drawn body at its cap until that
    // came within reach, then let it follow at the raw root's pace: Kosho
    // came back 0.39 m in one frame. Held to TAIL_ROOT_RATE from where it
    // was drawn last frame, clamped or not.
    const settling=this.tailWeight>1e-3&&dt>0;
    const sameMove=this.fallEpoch===this.actionEpoch;
    this.fallEpoch=this.actionEpoch;
    if(!attacking||!sameMove)this.rootFalling=false;
    else if(this.rootDrawnLast.y-this.rootReference.y>ROOT_FALL_FROM/scale)this.rootFalling=true;
    const fall=this.rootFalling&&dt>0?ROOT_FALL_RATE*dt/scale:Infinity;
    const landing=this.rootReference.y+up*upScale<this.rootDrawnLast.y-fall;
    if(!landing&&this.rootDrawnLast.y-this.rootReference.y<=ROOT_FALL_FROM/scale)this.rootFalling=false;
    if(!settling&&!landing&&Math.abs(flatScale-1)<1e-4&&Math.abs(upScale-1)<1e-4&&Math.abs(forwardScaled-forward)<1e-4){this.rootDrawnLast.copy(_rootRaw);return;}
    local.set(this.rootReference.x+sideways*flatScale,this.rootReference.y+up*upScale,this.rootReference.z+forwardScaled);
    if(grip<1)local.lerpVectors(this.rootDrawnFrom,local,grip);
    if(local.y<this.rootDrawnLast.y-fall)local.y=this.rootDrawnLast.y-fall;
    if(settling){
      const step=_rootLead.subVectors(local,this.rootDrawnLast),most=TAIL_ROOT_RATE*dt/scale;
      if(step.length()>most)local.copy(this.rootDrawnLast).add(step.setLength(most));
    }
    this.rootDrawnLast.copy(local);
    const before=_rootShift.copy(root.position);
    root.position.copy(root.parent.worldToLocal(this.group.localToWorld(local)));
    this.rootClamped=true;
    before.subVectors(root.position,before);
    for(const sibling of this.rootSiblings)sibling.position.add(before);
    // The next transition has to blend from the pose that was drawn, and this
    // is the one place the drawn pose differs from the sampled one by metres.
    // `applyPoseBlend` records the basis before this runs, so it kept the
    // clip's raw root - 8.67 m out at the end of Kosho's Hachoir - while the
    // body on screen was held at the clamped two. The first frame of whatever
    // came next then blended from the raw figure and put him back where the
    // clip wanted him: measured, his head moved 6.61 m in a sixtieth of a
    // second, Kenzo's 3.83 and Gummy's 3.43. Only the root and the bones that
    // travel with it are corrected; everything else is the animation, and the
    // procedural layer is deliberately left out of the basis (see
    // `startPoseBlend`).
    // The height too, for an attack. It used to be horizontal only, because
    // folding the clamped height in started the blend out of a JUMP from the
    // tucked root and put Kenzo's soles 6.7 cm through the tile - and the jump
    // keeps that rule. An attack's raw root is another matter: Hachoir
    // rises 7.9 m, and now that the root eases back over a tenth of a second
    // rather than a frame, a basis holding the raw height put Kosho 7 m in
    // the air on the first frame of being hit.
    // Round 3c: in the GROUP's axes. This read the root's own x, y and z as
    // across, up and along, which they are only on a rig whose pelvis hangs
    // in an upright parent. A 3ds Max Biped's does not - its local y is the
    // body's sideways - so a jump kept the RAW sideways travel in the basis
    // as its "height", and the first frame of the landing drew the body the
    // half metre the jump's clamp had been holding back: Nigo, Kenzo, Kosho,
    // Kagari and Gummy popped 0.2-0.5 m on landing out of a rush's chase. And
    // the bones beside the root take the root's whole correction, height
    // included, since the clamp moved them by all of it.
    const rootPose=this.poseByNode.get(root);
    if(rootPose){
      const drawnRoot=this.rootDrawnLast;
      _rootBasis.set(drawnRoot.x,drawnRoot.y,drawnRoot.z);
      root.parent.worldToLocal(this.group.localToWorld(_rootBasis));
      _rootShift.subVectors(_rootBasis,rootPose.blendPosition);
      rootPose.blendPosition.copy(_rootBasis);
      for(const sibling of this.rootSiblings){const pose=this.poseByNode.get(sibling);if(pose)pose.blendPosition.add(_rootShift);}
    }
  }

  /** A room cap that no longer applies, opened by a frame; dropped once it is
   *  well past anything a clip carries. */
  private static released(room:number,dt:number){const open=room+ROOM_RELEASE*dt;return open>4?Infinity:open;}
  /** Rotate a bone about its own head by a world-space rotation, leaving the
   *  joint where its parent put it. Same algebra as the head aim. */
  private leanBone(bone:THREE.Bone,world:THREE.Quaternion){
    if(!bone.parent)return;
    bone.parent.getWorldQuaternion(_leanParent);
    _leanParentInverse.copy(_leanParent).invert();
    _leanLocal.copy(_leanParentInverse).multiply(world).multiply(_leanParent).multiply(bone.quaternion);
    bone.quaternion.copy(_leanLocal);
    bone.updateMatrix();
    bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
  }

  /** Two-bone analytic IK: swing `hip` and `knee` so that `ankle` lands on
   *  `target`, keeping the bend in the plane the clip already put it in.
   *
   *  Ward of cosines twice - once for the angle at the hip, once for the knee -
   *  then a single swing that aims the whole leg at the target. Preserving the
   *  existing bend plane is what keeps a knee from inverting: the clip has
   *  already decided which way this leg folds. */
  private solveLeg(leg:Leg,target:THREE.Vector3,weight:number){
    const {hip,knee,ankle,upper,lower}=leg;
    if(!hip.parent||!knee.parent)return;
    hip.getWorldPosition(_ikA);knee.getWorldPosition(_ikB);ankle.getWorldPosition(_ikC);
    // Never ask for a distance the leg cannot make: past full extension the
    // law of cosines has no solution and the knee snaps through.
    _ikT.copy(target);
    const span=upper+lower;
    _ikAT.subVectors(_ikT,_ikA);
    const reach=_ikAT.length();
    if(reach<1e-4)return;
    const wanted=THREE.MathUtils.clamp(reach,Math.abs(upper-lower)+1e-3,span*.999);
    if(wanted!==reach)_ikT.copy(_ikA).addScaledVector(_ikAT,wanted/reach);
    _ikAB.subVectors(_ikB,_ikA);_ikAC.subVectors(_ikC,_ikA);_ikAT.subVectors(_ikT,_ikA);
    _ikBA.subVectors(_ikA,_ikB);_ikBC.subVectors(_ikC,_ikB);
    // The plane the leg already folds in. A leg posed dead straight has no
    // plane to read, so fall back to the hip's own sideways axis.
    _ikAxis.crossVectors(_ikAC,_ikAB);
    if(_ikAxis.lengthSq()<1e-8){
      _ikAxis.set(1,0,0).applyQuaternion(hip.getWorldQuaternion(_ikFoot));
      _ikAxis.crossVectors(_ikAC,_ikAxis);
      if(_ikAxis.lengthSq()<1e-8)return;
    }
    _ikAxis.normalize();
    const cosine=(a:number,b:number,c:number)=>Math.acos(THREE.MathUtils.clamp((a*a+b*b-c*c)/(2*a*b),-1,1));
    const hipNow=_ikAC.angleTo(_ikAB),kneeNow=_ikBA.angleTo(_ikBC);
    const hipWant=cosine(upper,wanted,lower),kneeWant=cosine(upper,lower,wanted);
    this.leanBone(hip,_ikTurn.setFromAxisAngle(_ikAxis,(hipWant-hipNow)*weight));
    hip.updateMatrixWorld(true);
    this.leanBone(knee,_ikTurn.setFromAxisAngle(_ikAxis,(kneeWant-kneeNow)*weight));
    knee.updateMatrixWorld(true);
    // Now the leg is the right shape; point it at the target.
    hip.getWorldPosition(_ikA);ankle.getWorldPosition(_ikC);
    _ikAC.subVectors(_ikC,_ikA);_ikAT.subVectors(_ikT,_ikA);
    if(_ikAC.lengthSq()>1e-8&&_ikAT.lengthSq()>1e-8){
      _ikAxis.crossVectors(_ikAC,_ikAT);
      if(_ikAxis.lengthSq()>1e-10){
        _ikAxis.normalize();
        this.leanBone(hip,_ikTurn.setFromAxisAngle(_ikAxis,_ikAC.angleTo(_ikAT)*weight));
        hip.updateMatrixWorld(true);
      }
    }
  }

  /** Hold the foot that is carrying the weight still.
   *
   *  Not one clip in this roster is a real locomotion cycle: measured, the
   *  planted foot slides backwards under the hips at between a seventh and a
   *  half of the speed the body is travelling, so at a run the feet are simply
   *  carried along and the legs are decoration. Retiming cannot fix it -
   *  there is no ground contact in the source to match to.
   *
   *  So the contact is made here. Whichever foot is in the bottom of its own
   *  travel is pinned to the point it landed on, the leg is solved to keep it
   *  there while the body moves past, and it is let go when the clip lifts it
   *  or the leg runs out of length - which is what a step is. */
  private footPlanting(dt:number,state:PlayerState){
    this.serverTime+=dt;
    if(!this.legs.length||!this.dynamics)return;
    // Only a fighter standing on the floor under their own control. A reaction
    // is a body being thrown about, and pinning its feet would fight the clip.
    // Not a fighter who strikes with their legs mid-swing: Kosho's kicks are
    // the limb the planter would pin, and holding a foot through Hachoir
    // re-planted the ankle mid-kick the moment his lunge outran the leg -
    // measured as knee travel over the approach 1.9 -> 2.7, and it moved
    // with his height. The stride overlay already leaves his legs alone for
    // the same reason.
    const kicking=this.authoredKick(state)||this.authoredFloorStrike(state)||this.authoredHover(state)||this.authoredStep(state);
    const pivot=1-THREE.MathUtils.smoothstep(Math.abs(this.turnRate),4,12);
    // Round 5 (GUMMY): nor SUNRISE, floating: there is no floor under his feet to hold them to.
    const eligible=state.grounded&&state.alive&&!REACTION_ACTIONS.has(state.action)&&state.action!=='jump'&&!kicking&&pivot>.05&&!this.floating;
    for(const leg of this.legs){
      leg.ankle.getWorldPosition(_ikAnkle);
      const height=_ikAnkle.y-this.groundY;
      // The foot's own range of travel, tracked live: it drops onto a new low
      // or high at once and creeps back off it, so a clip change is followed
      // within a step rather than over a second.
      leg.low+=(height-leg.low)*(height<leg.low?.5:1-Math.exp(-dt*1.1));
      leg.high+=(height-leg.high)*(height>leg.high?.5:1-Math.exp(-dt*1.1));
      // How close to its own lowest the foot has to be to count as down. A
      // fraction of the whole travel is too generous on a high-knee sprint,
      // where a third of the range is a quarter of a metre in the air.
      // Bounded in leg lengths, not metres. An absolute 5 cm floor is where a
      // guard step's lift sits, so normalising Kenzo from 1.70 m to his intended
      // 1.81 took his blocking foot from 0.44 of travel to 0.70: 6% more
      // lift crossed a fixed line and the plant toggled every step.
      const scale=(this.legLength||.85)/.85;
      const lift=THREE.MathUtils.clamp((leg.high-leg.low)*PLANT_BAND,.05*scale,.2*scale);
      if(!eligible)leg.planted=false;
      else if(!leg.planted&&height<=leg.low+lift){
        leg.planted=true;leg.anchor.set(_ikAnkle.x,0,_ikAnkle.z);leg.plantYaw=this.group.rotation.y;
        // The frame a foot comes down. There were no footsteps in the game at
        // all, and this is the moment one happens - already computed, with the
        // speed that says how hard.
        if(this.locomotionSpeed>STEP_AUDIBLE&&this.serverTime-leg.stepped>STEP_GAP){
          leg.stepped=this.serverTime;
          this.steps.push({x:_ikAnkle.x,y:this.groundY,z:_ikAnkle.z,speed:this.locomotionSpeed});
          if(this.steps.length>4)this.steps.shift();
        }
      }
      else if(leg.planted&&height>leg.low+lift*RELEASE_BAND)leg.planted=false;
      if(leg.planted){
        // Out of leg. This is the moment a stride ends, whatever the clip is
        // doing: the hip has travelled as far past the foot as the leg allows.
        leg.hip.getWorldPosition(_ikA);
        const gap=Math.hypot(_ikA.x-leg.anchor.x,_ikA.y-_ikAnkle.y,_ikA.z-leg.anchor.z);
        // A reach release re-plants where the foot now is, a stride behind
        // - the ankle pop the round-11 audit measured. Latching a released
        // foot until it lifts, or until the clip moves it relative to the
        // hip, was tried this round and measured worse both ways: a guard
        // stance never lifts or swings its feet, so either latch turned every
        // blocking walk into a 97-99% slide. The pop stays; it is the only
        // contact a stance clip has.
        const twist=Math.abs(Math.atan2(Math.sin(this.group.rotation.y-leg.plantYaw),Math.cos(this.group.rotation.y-leg.plantYaw)));
        if(gap>(leg.upper+leg.lower)*LEG_REACH||twist>Math.PI/3)leg.planted=false;
      }
      // Faded out at a standstill. A fighter who is not going anywhere has
      // nothing to correct - their feet are not sliding - and holding the
      // ankles against the small drift an idle clip has makes the legs work
      // against it every frame, which the cloth then answers.
      //
      // And faded out again above a run. A dash is twenty-four metres a
      // second and an attack lunge can be sixteen; at those speeds a planted
      // foot is out of reach within two frames, so holding one only makes the
      // leg snap out and back. Nobody expects a body crossing five metres in
      // a third of a second to be walking.
      const carry=pivot*THREE.MathUtils.clamp(this.locomotionSpeed/.9,0,1)
        *(1-THREE.MathUtils.smoothstep(this.locomotionSpeed,PLANT_LIMIT[0],PLANT_LIMIT[1]));
      const wanted=leg.planted?carry:0;
      // Round 3c: a foot a swing lifts off its plant is let go at once. At the
      // standing rate the plant still held a third of Taisei's kicking foot
      // back toward the floor four frames into Rush 2, bending the kick by
      // 8 cm - and by more or less depending on the frame it lifted on.
      const release=ATTACK_SLOTS.has(state.action)?PLANT_OUT_STRIKE:PLANT_OUT;
      leg.weight+=(wanted-leg.weight)*(1-Math.exp(-dt*(wanted>leg.weight?PLANT_IN:release)));
      // A landing is absorbed in the knees. The hips come down by the whole
      // dip and the ankle is put back exactly where the dip moved it from, so
      // the foot stays on the floor while the body gives - which is the
      // difference between a fighter taking an impact and a fighter sinking
      // through the tile for the length of it. Nothing is captured and no
      // touchdown height is assumed, so a fall clip keyed off the floor
      // cannot float or sink the landing.
      const weight=Math.max(leg.weight,Math.min(1,this.landDip/LAND_HOLD));
      if(weight<.004)continue;
      // Only x and z are held, and only by a plant. The clip still owns how
      // high the foot is, so a heel lift or a crouch is untouched; what it
      // loses is the sliding. The anchor holds through the release fade too -
      // that is what letting a plant go slowly means - while a leg held only
      // because it is absorbing a landing keeps the foot the clip drew.
      const held=leg.weight>.004;
      _ikT.set(held?leg.anchor.x:_ikAnkle.x,_ikAnkle.y+this.landDip,held?leg.anchor.z:_ikAnkle.z);
      // Keep the sole pointing where the clip pointed it: the IK turns the
      // whole leg, and without this the foot is turned with it.
      leg.ankle.getWorldQuaternion(_ikFoot);
      this.solveLeg(leg,_ikT,weight);
      if(leg.ankle.parent){
        leg.ankle.parent.getWorldQuaternion(_leanParent);
        leg.ankle.quaternion.copy(_leanParentInverse.copy(_leanParent).invert()).multiply(_ikFoot);
        leg.ankle.updateMatrixWorld(true);
      }
    }
  }

  /** A support switch must not teleport a knee. Limit only exceptional leg
   *  solves during locomotion; ordinary authored steps pass through unchanged.
   *  Attacks and reactions are excluded, and floor contact is solved afterward. */
  private stabilizeLegs(dt:number,state:PlayerState,placed:boolean){
    if(!this.dynamics||placed||!state.grounded||this.authoredHover(state)||!['idle','run'].includes(state.action))return;
    for(const leg of this.legs)for(const bone of [leg.hip,leg.knee,leg.ankle]){
      const previous=this.legPresentation.get(bone);
      if(!previous)continue;
      const angle=previous.angleTo(bone.quaternion),budget=THREE.MathUtils.degToRad(state.action==='idle'&&!this.isForm?480:1440)*dt;
      if(angle>budget&&angle>1e-6){_blendTarget.copy(bone.quaternion);bone.quaternion.slerpQuaternions(previous,_blendTarget,budget/angle);}
    }
    this.group.updateMatrixWorld(true);
  }

  /** A stride mixed under a crouched guard can put one boot below the floor
   *  while the other is correctly supporting the body. Correct that leg, not
   *  the pelvis: lifting the whole fighter makes the shoulders bounce. Read
   *  the skinned boot hull, so different shoes and rigs need no magic offset.
   *  Authored attacks, airborne poses and reactions retain their own contacts. */
  private floorFeet(state:PlayerState,real=0){
    // (Round 96: and a body struck on its feet and drawn with an authored take - each foot put on the floor, down as well
    // as up. The takes keep both feet down and the blend into one does not: the knees fold on the limbs' clock and the
    // hips come down on the root's, later (STRUCK_ROOT), and every body's soles came 4-7 cm off the floor going into the
    // fold - two blind critics, "a hovering hunched squat (feet off the floor)". By the legs alone: the hips and all above
    // them stay as drawn, so nothing the reaction layers swing moves.)
    const planted=DREAM_IMPACT&&!!this.takeOn&&state.action==='hurt';
    // (Round 98: and a launch while its floor guard is easing in - FLOOR_GUARD_FRESH: the legs keep the soles out of the
    // floor while the hips are taken up slowly, or Nigo's stood 18 cm through it, tests/sharedMotion.)
    const fresh=state.action==='launched'&&state.actionTime*state.actionDuration<FLOOR_GUARD_FRESH.within;
    // (Round 103: and a striker's, on its feet - STRIKE_PLANT: its soles brought down by `plantLower`, and up by
    // `plantRaise` where nothing else would raise them.)
    const standing=['idle','run','guard'].includes(state.action)||state.action==='getup'&&this.standingRise;
    const swinging=DREAM_IMPACT&&state.grounded&&state.action==='light'&&!this.isForm;
    if(real>0){
      this.plantRaise=THREE.MathUtils.clamp(this.plantRaise+(swinging||standing?real:-real)/STRIKE_PLANT.ease,0,1);
      this.plantLower=THREE.MathUtils.clamp(this.plantLower+(swinging?real:-real)/STRIKE_PLANT.ease,0,1);
    }
    const striking=!planted&&!fresh&&state.grounded&&(swinging||this.plantLower>1e-3||!standing&&this.plantRaise>1e-3);
    if(!this.dynamics||!state.alive||!state.grounded&&!fresh||this.isForm||this.authoredHover(state)
      ||!standing&&!planted&&!fresh&&!striking)return;
    for(const [i,leg] of this.legs.entries()){
      // (A foot a stagger is stepping - STEP_SPEED - is meant to be off the floor.)
      if(planted&&this.staggerWeight>1e-3&&(this.staggerSwing[i]??-1)>=0)continue;
      // A second solve handles vertices partly weighted to the shin - toward the height the first chose.
      let goal=this.groundY+.006;
      for(let pass=0;pass<2;pass++){
        let lowest=Infinity;
        for(const {mesh,index}of leg.soles)lowest=Math.min(lowest,mesh.getVertexPosition(index,this.fallback).applyMatrix4(mesh.matrixWorld).y);
        let correction=goal-lowest;
        if(striking&&pass===0&&correction<=.4){
          correction*=correction<0?THREE.MathUtils.clamp((STRIKE_PLANT.reach+correction)/(STRIKE_PLANT.reach-STRIKE_PLANT.full),0,1)*this.plantLower:standing?1:this.plantRaise;
          goal=lowest+correction;
        }
        if(striking?Math.abs(correction)<=.004||correction>.4:planted?Math.abs(correction)<=.004||correction<-TAKE_PLANT:correction<=.001||correction>.4)break;
        leg.ankle.getWorldPosition(_ikAnkle);_ikAnkle.y+=correction;
        leg.ankle.getWorldQuaternion(_ikFoot);
        this.solveLeg(leg,_ikAnkle,1);
        if(leg.ankle.parent){
          leg.ankle.parent.getWorldQuaternion(_leanParent);
          leg.ankle.quaternion.copy(_leanParentInverse.copy(_leanParent).invert()).multiply(_ikFoot);
          leg.ankle.updateMatrixWorld(true);
        }
      }
    }
    this.soleGap=this.lowestSupport()-this.groundY;
  }

  /** Everything the clips do not know about the moment they are in: which way
   *  the blow came from and what it was worth, how fast the body is still
   *  sliding, how hard it is turning, which way the feet are going, and
   *  whether the swing hit anything at all.
   *
   *  All of it resolves to one lean spread along the spine plus a dip at the
   *  hips, so a single authored flinch answers a jab and a launcher
   *  differently, and a strafe stops reading as a forward run played sideways.
   *  `dt` of zero means hold what is already there - impact freeze stops the
   *  lean advancing without letting it snap back to nothing for a frame. */
  /** Lock combat's preview (Fighter.reelSway): a body standing in a string's recoil rocks over its fold, REEL_STAGGER
   *  radians at REEL_STAGGER_HZ, eased in and out over a tenth of a second - the takes stand still once their peak is
   *  struck, and the critic, rounds 4-6, saw Ouga "frozen" through every finisher's wind-up, where the victim
   *  should stagger on the spot. */
  private reelStagger=0;private staggerClock=0;
  private staggerSway(dt:number,state:PlayerState){
    const on=Fighter.reelSway>0&&state.alive&&state.grounded&&(state.action==='hurt'||state.action==='flinch'||this.reelHolding);
    this.reelStagger+=((on?1:0)-this.reelStagger)*(1-Math.exp(-dt*10));
    if(this.reelStagger<1e-3){this.reelStagger=0;this.staggerClock=0;return 0;}
    this.staggerClock+=dt;
    const w=Math.PI*2*REEL_STAGGER_HZ,t=this.staggerClock;
    return this.reelStagger*REEL_STAGGER*(Math.sin(t*w)*.7+Math.sin(t*w*1.7+1)*.3);
  }
  private bodyDynamics(dt:number,state:PlayerState,real=dt){
    if(!this.leanChain.length||!this.dynamics)return;
    const reacting=REACTION_ACTIONS.has(state.action);
    const attacking=state.action==='light'||state.action==='heavy'||state.action==='special'||state.action==='ultimate';
    const flat=Math.hypot(this.velocity.x,this.velocity.z);
    if(dt>0){
      // A heavy blow's recoil, fold and wrench are let go as much slower as
      // its reaction layer settles (see HIT_SLOW): a gut punch that lands
      // hard stays folded over.
      const slower=reacting?1+HIT_SLOW*this.hitHeavy:1;
      // (Round 98: a striker's drive held DRIVE.hold, then let go at DRIVE.rate.)
      this.driving=Math.max(0,this.driving-dt);
      this.recoil.multiplyScalar(Math.exp(-dt*(reacting?7:this.driving>0?0:this.drove&&attacking?DRIVE.rate:13)/slower));
      // (Round 84: a body on its feet held in its hurt stays folded over the blow until its stun is nearly over:
      // STUN_HOLD.)
      const stunned=DREAM_IMPACT&&state.action==='hurt'&&state.grounded&&state.actionDuration<ROCKED_HURT&&state.actionTime<STUN_HOLD.release;
      const settle=Math.exp(-dt*(reacting?6:11)/slower*(stunned?STUN_HOLD.rate:1));
      this.hitFold*=settle;this.hitTwist*=settle;
      // (Eased in a beat into a fresh stun; kept through a blow that lands on one already curled - its clock starts again
      // at nought, and let go and taken up again the head jumped 6-7 cm a frame on Dorado under Kosho's string.)
      const hunched=stunned&&(state.actionTime*state.actionDuration>=STUN_HOLD.after||this.stunHunch>.05)?STUN_HOLD.hunch:0;
      this.stunHunch+=(hunched-this.stunHunch)*(1-Math.exp(-dt*(hunched>this.stunHunch?STUN_HOLD.inRate:STUN_HOLD.outRate)));
      if(this.stunHunch<1e-4&&!hunched)this.stunHunch=0;
      // The tilt below turns the body AWAY from the heading it is given (a
      // rotation about heading x up tips the head toward -heading), so a blow
      // is given in negated: the struck body goes the way the blow travelled,
      // away from whoever threw it, and the attacker's small recoil pushes
      // him back off the contact. It used to be given in as it came, and a
      // punch from in front pulled the head toward the fist - measured, 2.6 cm
      // of head toward the attacker at 90 damage, cancelling part of the
      // clip's own recoil - while one from behind leaned the body back into
      // the blow.
      _leanAxis.copy(this.recoil).negate();
      // Still travelling under someone else's blow: the body goes with it.
      if(reacting&&flat>.6){
        _leanPoint.set(this.velocity.x,0,this.velocity.z).normalize();
        _leanAxis.addScaledVector(_leanPoint,Math.min(.18,flat*.02));
      }
      // Its own start and stop. A fighter who breaks into a run leans into it.
      if(!reacting&&state.grounded){
        _leanPoint.set(this.velocity.x-this.previousVelocity.x,0,this.velocity.z-this.previousVelocity.z);
        // Along the way it is going only: a turn's sideways push is the bank's (BANK), not a second tilt on top of it.
        if(flat>.5){const along=(_leanPoint.x*this.velocity.x+_leanPoint.z*this.velocity.z)/(flat*flat);_leanPoint.set(this.velocity.x*along,0,this.velocity.z*along);}
        const rate=_leanPoint.length()/Math.max(dt,1e-4);
        if(rate>1)_leanAxis.addScaledVector(_leanPoint.normalize(),THREE.MathUtils.clamp(rate*.0022,0,.1));
        // And a stop is a beat. Releasing the stick used to dissolve the run
        // into the idle with nothing planted; braking harder than a walk's
        // worth in a frame now gives at the knees, deeper for a harder stop,
        // and the dip is let go over a quarter of a second.
        const before=Math.hypot(this.previousVelocity.x,this.previousVelocity.z);
        const braking=(before-flat)/Math.max(dt,1e-4);
        if(braking>6&&flat<3)this.stopDip=Math.max(this.stopDip,Math.min(.045,braking*.0035));
      }
      this.stopDip*=Math.exp(-dt*9);
      // A swing that never connected carries its owner past where they aimed.
      // Only once its last contact has gone by: a multi-hit string is still
      // landing halfway through, and leaning out of it would be a lie.
      if(attacking&&!this.struck){
        const move=this.moveFor(state);
        const last=move.contacts[move.contacts.length-1],elapsed=state.actionTime*state.actionDuration;
        if(elapsed>last+.04){
          _leanPoint.set(Math.sin(this.facing),0,Math.cos(this.facing));
          _leanAxis.addScaledVector(_leanPoint,.08*THREE.MathUtils.smoothstep(elapsed,last+.04,last+.22));
        }
      }
      this.leanTilt.lerp(_leanAxis,1-Math.exp(-dt*(reacting?26:11)));
      if(this.leanTilt.length()>.34)this.leanTilt.setLength(.34);
      // The bank (BANK): the path's own bend, at its speed, as the sideways force a runner leans against.
      let wantRoll=0;
      const before=Math.hypot(this.previousVelocity.x,this.previousVelocity.z);
      if(!reacting&&state.grounded&&flat>1&&before>1){
        const bend=Math.atan2(this.previousVelocity.x*this.velocity.z-this.previousVelocity.z*this.velocity.x,this.previousVelocity.x*this.velocity.x+this.previousVelocity.z*this.velocity.z)/Math.max(real,1e-4);
        wantRoll=THREE.MathUtils.clamp(BANK.share*Math.atan(flat*bend/9.8),-BANK.most,BANK.most);
      }
      this.leanRoll+=(wantRoll-this.leanRoll)*(1-Math.exp(-dt*BANK.ease));
    }
    const tilt=this.leanTilt.length();
    // A held chamber trembles and breathes. Two shakes that do not line up,
    // and a slow breath, along the spine, weighted by how deep in the hold
    // the swing is; on a five-second wind-up this is the difference between
    // a fighter gathering a blow and a statue with an aura.
    const tremor=(this.chargeHold>.01?this.chargeHold*(CHARGE_TREMOR*(Math.sin(this.serverTime*61)*.6+Math.sin(this.serverTime*97+1.3)*.4)
      +CHARGE_BREATH*Math.sin(this.serverTime*7.5)):0)+this.staggerSway(dt,state);
    if(tilt<1e-4&&Math.abs(this.leanRoll)<1e-4&&Math.abs(this.hipYaw)<1e-3&&this.landDip<1e-3&&this.stopDip<1e-3
      &&Math.abs(this.hitFold)<1e-4&&Math.abs(this.hitTwist)<1e-4&&this.stunHunch<1e-4&&Math.abs(tremor)<1e-5)return;
    // The chain's own limit is a sum, not a per-term one: a lean at full tilt
    // with a full fold on top of it folds the mesh through itself. The lean is
    // the one that carries the blow's direction, so the fold pays for it.
    // (Round 84: and the stun's curl on top, on any take, inside the same limit - STUN_HOLD.)
    const room=Math.max(0,.52-tilt),fold=Math.min(room,Math.sign(this.hitFold)*Math.min(Math.abs(this.hitFold),room)*this.takeFold+this.stunHunch*this.takeHunch);
    // Pitching about the body's own lateral axis: positive folds it forward.
    const facing=this.facing,lateral=_foldAxis.set(Math.cos(facing),0,-Math.sin(facing));
    const shares=LEAN_SHARE.slice(0,this.leanChain.length);
    const total=shares.reduce((sum,share)=>sum+share,0)||1;
    // Renormalised the same way, because several rigs carry three spine bones
    // rather than four and a third of the fold would otherwise go nowhere.
    const folds=FOLD_SHARE.slice(0,this.leanChain.length);
    const foldTotal=folds.reduce((sum,share)=>sum+share,0)||1;
    const forward=_leanPoint.set(Math.sin(facing),0,Math.cos(facing));
    for(let i=0;i<this.leanChain.length;i++){
      const share=shares[i]/total;
      _leanWorld.identity();
      if(tilt>1e-4){
        // Tipping the body toward a horizontal heading is a rotation about the
        // heading crossed with up.
        _leanAxis.set(-this.leanTilt.z,0,this.leanTilt.x).normalize();
        _leanWorld.multiply(_leanShare.setFromAxisAngle(_leanAxis,tilt*share*this.takeLean));
      }
      // The bank lives above the hips (BANK): the legs stay under the body as it leans.
      if(Math.abs(this.leanRoll)>1e-4&&i>0)_leanWorld.multiply(_leanShare.setFromAxisAngle(forward,this.leanRoll*shares[i]/Math.max(1e-6,total-shares[0])));
      // Folding over the blow, or arching off it. Distributed up the chain
      // rather than with it, so the stomach closes and the hips stay put.
      if(Math.abs(fold)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,fold*folds[i]/foldTotal));
      if(Math.abs(tremor)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,tremor*folds[i]/foldTotal));
      if(Math.abs(this.hitTwist)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,this.hitTwist*(i===0?.6:.14)));
      // The legs turn toward the step and the chest turns back out of it, so a
      // fighter crossing in front of an opponent keeps facing them.
      if(Math.abs(this.hipYaw)>1e-3){
        const yaw=i===0?this.hipYaw:-this.hipYaw*.55/Math.max(1,this.leanChain.length-1);
        _leanWorld.multiply(_leanShare.setFromAxisAngle(UP,yaw));
      }
      this.leanBone(this.leanChain[i],_leanWorld);
    }
    // The head goes furthest and it gets there first. Applied on top of the
    // finished chain, and only while it is not being aimed at somebody: a
    // fighter tracking an opponent is not the one taking the punch.
    if(this.headBone&&this.aimWeight<.5&&(Math.abs(fold)>1e-4||Math.abs(this.hitTwist)>1e-4)){
      _leanWorld.identity();
      if(Math.abs(fold)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,fold*.5));
      if(Math.abs(this.hitTwist)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,this.hitTwist*.75));
      this.leanBone(this.headBone,_leanWorld);
    }
    // Absorbing a landing. The ankles are held at the height they touched down
    // at by `footPlanting`, so this is a knee bend read off the hips rather
    // than the whole skeleton translating down through the tile - which is
    // what the old five-centimetre clamp did, for the four frames it lasted.
    // This authored Rush1 support skips foot IK. Adding a generic hip dip
    // would translate its planted soles through the floor; retain torso dynamics.
    const dip=(state.fighter==='madake'||state.fighter==='murex')&&this.authoredStep(state)?0:this.landDip+this.stopDip;
    if(dip>1e-3&&this.pelvis&&this.pelvis.parent){
      this.pelvis.getWorldPosition(_leanPoint);
      _leanPoint.y-=dip;
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_leanPoint));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
    }
  }

  /** Life in a held pose; see HOLD_STILL. Applied every frame, a hitstop
   *  included - the clip is re-sampled into the bones each frame, so a layer
   *  that skipped a frame would pop the pose back - but advanced only on a
   *  frame that moves. */
  private holdLife(dt:number,state:PlayerState,real=dt){
    const slot=state.action;
    const casting=this.dynamics&&state.alive&&(slot==='heavy'||slot==='special'||slot==='ultimate')&&state.actionDuration>0;
    if(dt>0){
      let want=0,charge=this.holdCharge;
      if(casting){
        if(this.animSpeed<HOLD_STILL)this.stillHeld=true;else if(this.animSpeed>HOLD_MOVING)this.stillHeld=false;
        this.stillFor=this.stillHeld?this.stillFor+dt:0;
        const move=this.moveFor(state),elapsed=state.actionTime*state.actionDuration,last=move.contacts[move.contacts.length-1]??0;
        const still=THREE.MathUtils.smoothstep(this.stillFor,HOLD_IN[0],HOLD_IN[1]);
        if(elapsed<last){
          // A chamber the pacing holds on purpose counts as held from its
          // first frame; the rest has to be seen to stand still.
          want=Math.max(still,this.chargeHold)*(1-THREE.MathUtils.smoothstep(elapsed,last-HOLD_CLEAR-.15,last-HOLD_CLEAR));
          charge=1;
        }else{
          // The stance under a settled tail breathes on its own.
          want=still*THREE.MathUtils.smoothstep(elapsed,last+.12,last+.35)*(1-this.tailWeight);
          charge=0;
        }
        // And gone as the move hands over, so its end is the clip's own.
        want*=1-THREE.MathUtils.smoothstep(elapsed,state.actionDuration-.22,state.actionDuration-.04);
      }else{this.stillFor=0;this.stillHeld=false;}
      this.holdWeight+=(want-this.holdWeight)*(1-Math.exp(-dt*(want>this.holdWeight?HOLD_RISE:HOLD_FALL)));
      // The flavour only changes while the layer is nearly gone: it clears
      // before the blow and comes back after it.
      if(this.holdWeight<.05)this.holdCharge=charge;
      if(this.holdWeight>1e-3)this.holdClock+=dt;
    }
    this.secondary?.aura(casting?this.holdWeight*this.holdCharge:0);
    const weight=this.holdWeight;
    if(weight<1e-3||!this.leanChain.length)return;
    const charge=this.holdCharge,t=this.holdClock,tau=Math.PI*2;
    // A heavy's chamber is a beat, an ultimate's is the show.
    const size=slot==='ultimate'?1:slot==='special'?.85:.6;
    const facing=this.facing,lateral=_foldAxis.set(Math.cos(facing),0,-Math.sin(facing));
    const forward=_holdForward.set(Math.sin(facing),0,Math.cos(facing));
    const breath=Math.sin(t*HOLD_BREATH.rate*(charge?1:1.2)*tau)*weight*size*(charge+(1-charge)*HOLD_AFTER.breath);
    const sway=Math.sin(t*HOLD_SWAY.rate*tau+.7)*weight*size*(charge+(1-charge)*HOLD_AFTER.sway);
    const pumpPhase=t*HOLD_PUMP.rate*tau;
    const pump=Math.sin(pumpPhase+HOLD_PUMP.skew*Math.sin(pumpPhase))*weight*size*charge;
    // The tremor is a shake of a few hertz, which a frame rate much under
    // forty cannot draw: it aliases into noise, so it bows out there.
    const drawable=THREE.MathUtils.smoothstep(real>1e-4?1/real:60,28,48);
    const shake=(Math.sin(t*HOLD_SHAKE.rates[0]*tau)*.6+Math.sin(t*HOLD_SHAKE.rates[1]*tau+1.7)*.4)*weight*size*charge*drawable;
    // The spine: the breath pitches it, the weight shift rolls the hips one
    // way and the chest back the other, the tremor turns the chest.
    const chain=this.leanChain,top=chain.length-1;
    for(let i=0;i<chain.length;i++){
      _leanWorld.identity();
      const share=i===0?0:1/Math.max(1,top);
      _leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,-breath*HOLD_BREATH.spine*share));
      _leanWorld.multiply(_leanShare.setFromAxisAngle(forward,sway*HOLD_SWAY.roll*(i===0?1:-1.25*share)));
      if(i===top)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,shake*HOLD_SHAKE.chest));
      this.leanBone(chain[i],_leanWorld);
    }
    // The shoulders rise on the breath: each clavicle about the body's
    // forward axis, its own way up.
    const chest=chain[top];
    chest.getWorldPosition(_holdPoint);
    for(const name of SHOULDERS){
      const bone=this.joints.get(name);if(!bone)continue;
      const side=Math.sign(bone.getWorldPosition(_holdSide).sub(_holdPoint).dot(lateral))||1;
      this.leanBone(bone,_leanWorld.setFromAxisAngle(forward,Math.max(0,breath)*HOLD_BREATH.shoulder*side));
    }
    // Both arms pump and shake about the same world axis, so a two-handed
    // pose - a Sunpalm Cannon, a seal, a LAST SUN - stays joined.
    if(charge>0)for(const name of UPPER_ARMS){
      const bone=this.joints.get(name);if(!bone)continue;
      this.leanBone(bone,_leanWorld.setFromAxisAngle(lateral,-pump*HOLD_PUMP.arm-shake*HOLD_SHAKE.arm));
    }
    if(this.headBone)this.leanBone(this.headBone,_leanWorld.setFromAxisAngle(lateral,-breath*HOLD_BREATH.head+shake*HOLD_SHAKE.head));
    // The weight shift and the breath move the hips, and the planted feet
    // hold the floor, so the knees take it.
    if(this.pelvis&&this.pelvis.parent){
      this.pelvis.getWorldPosition(_holdPoint);
      _holdPoint.addScaledVector(lateral,sway*HOLD_SWAY.shift);
      _holdPoint.y-=(.5+.5*breath/Math.max(1e-3,weight*size))*HOLD_BREATH.dip*weight*size;
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_holdPoint));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
    }
  }

  /** The feel pass: the smear frame (see `smear`). Drawn across a melee swing's drive into a contact and the
   *  frame after it, from how fast the strike point is moving: the faster, the further back it reaches, up to
   *  SMEAR_MOST. On the stepped grid it is measured once a step, as the pose is. */
  private updateSmear(state:PlayerState,real:number){
    const motion=this.smear.motion.value,point=this.smear.point.value;
    if(Fighter.noSmear||state.fighter==='chohan'||state.fighter==='ovid'||state.fighter==='hagure'||state.fighter==='bruin'||state.fighter==='hawser'&&this.isForm){motion.w=0;this.smearSeen=false;return;}
    // On the stepped grid a repeated frame shows the step's smear again, as it shows the step's pose.
    if(this.stepRepeat)return;
    let on=false;
    const now=performance.now()/1000;
    if(Fighter.animStyle!=='classic'&&ATTACK_SLOTS.has(state.action)&&state.actionDuration>0&&!state.timeStopped&&real>0&&!this.unseen&&this.moveFor(state).style==='melee'){
      const move=this.moveFor(state),t=this.drawn.actionTime*this.drawn.actionDuration;
      let k=0;for(let i=1;i<move.contacts.length;i++)if(Math.abs(move.contacts[i]-t)<Math.abs(move.contacts[k]-t))k=i;
      const c=move.contacts[k];
      if(t>c-SMEAR_LEAD&&t<c+SMEAR_TAIL){
        // Whichever limb is striking: the fastest of the blade's point (or the right hand), the left hand and the feet.
        const limbs=this.smearLimbs??=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
        const prev=this.smearPrev??=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
        if(this.rightReach&&this.rightBone)limbs[0].copy(this.rightReach).applyMatrix4(this.rightBone.matrixWorld);else if(this.rightBone)this.rightBone.getWorldPosition(limbs[0]);
        if(this.leftBone)this.leftBone.getWorldPosition(limbs[1]);
        this.joints.get('RightFoot')?.getWorldPosition(limbs[2]);this.joints.get('LeftFoot')?.getWorldPosition(limbs[3]);
        this.group.getWorldPosition(_smearRoot);
        if(this.smearSeen){
          const gap=Math.max(now-this.smearAt,1/120);let best=-1,speed=SMEAR_SPEED;
          _smearCarry.subVectors(_smearRoot,this.smearPrevRoot);
          // The dream loop (22 October 2026): the striking limb is the one driving at the opponent, not the fastest -
          // a back foot kicked up behind a lunge was the fastest limb and smeared the trousers into a sheet. A limb
          // moving away from where the fighter faces counts for a third of its speed.
          // Where the move's own contact socket says the blow lands (engine/client/sockets.ts), the limb nearest it is
          // the striking one: a punch smears its arm and only a kick a leg.
          const fx=Math.sin(this.facing),fz=Math.cos(this.facing),socketed=DREAM_IMPACT&&this.meleeContactPoint(k,_smearSocket);let bestScore=SMEAR_SPEED,nearest=Infinity;
          for(let i=0;i<4;i++){
            if(i>=2&&limbs[i].y-_smearRoot.y<SMEAR_FOOT_LIFT)continue;
            _smearVel.subVectors(limbs[i],prev[i]).sub(_smearCarry);const v=_smearVel.length()/gap;
            if(socketed){const d=limbs[i].distanceToSquared(_smearSocket);if(v>SMEAR_SPEED&&d<nearest){nearest=d;speed=v;best=i;}continue;}
            const ahead=v>1e-4?(_smearVel.x*fx+_smearVel.z*fz)/(v*gap):0,score=DREAM_IMPACT?v*(.34+.66*Math.max(0,ahead)):v;
            if(score>bestScore){bestScore=score;speed=v;best=i;}
          }
          // A socket far from every moving limb (more than 0.6 m) names none of them: nothing is smeared.
          if(socketed&&nearest>.36)best=-1;
          if(best>=0){
            on=true;_smearVel.subVectors(limbs[best],prev[best]).sub(_smearCarry).normalize();
            motion.set(_smearVel.x,_smearVel.y,_smearVel.z,Math.min(best>=2?SMEAR_MOST_FOOT:SMEAR_MOST,speed*SMEAR_SECONDS));
            point.set(limbs[best].x,limbs[best].y,limbs[best].z,best===0&&this.armed?SMEAR_REACH_ARMED:best>=2?SMEAR_REACH_FOOT:SMEAR_REACH);
            // On that limb alone (SMEAR_LIMBS): the order of `limbs` is the order of the vertices' shares.
            this.smear.limb.value.set(best===0?1:0,best===1?1:0,best===2?1:0,best===3?1:0);
          }
        }
        for(let i=0;i<4;i++)prev[i].copy(limbs[i]);
        this.smearPrevRoot.copy(_smearRoot);
        this.smearSeen=true;this.smearAt=now;
      }else this.smearSeen=false;
    }else this.smearSeen=false;
    if(!on)motion.w=0;
  }
  /** The feel pass (AnimStyle 'twos'): keep or repeat the stepped pose. */
  private stepPoseHold(state:PlayerState){
    const stepped=Fighter.animStyle==='twos'&&(ATTACK_SLOTS.has(state.action)||REACTION_ACTIONS.has(state.action)||state.action==='awaken');
    this.stepRepeat=false;
    if(!stepped){this.stepAt=-1;return;}
    if(!this.stepNodes){const nodes:THREE.Object3D[]=[];this.model.traverse(o=>{if((o as THREE.Bone).isBone)nodes.push(o);});this.stepNodes=nodes;this.stepPose=new Float32Array(nodes.length*10);}
    const nodes=this.stepNodes,pose=this.stepPose!;
    if(this.stepAt!==Fighter.stepTick||this.stepEpoch!==this.actionEpoch){
      // A new step - or a new action inside one, which never shows the last one's pose - is the one held until the next.
      this.stepAt=Fighter.stepTick;this.stepEpoch=this.actionEpoch;
      for(let i=0,o=0;i<nodes.length;i++,o+=10){const n=nodes[i];n.position.toArray(pose,o);n.quaternion.toArray(pose,o+3);n.scale.toArray(pose,o+7);}
      return;
    }
    for(let i=0,o=0;i<nodes.length;i++,o+=10){const n=nodes[i];n.position.fromArray(pose,o);n.quaternion.fromArray(pose,o+3);n.scale.fromArray(pose,o+7);}
    this.group.updateMatrixWorld(true);this.stepRepeat=true;
  }
  /** Round 78: how far into its step a light blow is drawn (DREAM_STEP), metres: eased in over the last `rise` seconds
   *  before its first contact (a third of a metre over a sixth of a second keeps the head inside the pop guards'
   *  6 cm a frame), held, walked home. */
  private dreamStepIn(state:PlayerState){
    const move=this.moveFor(state),contact=move?.contacts?.[0];
    if(!move||!(contact!==undefined&&contact>0))return 0;
    const t=state.actionTime*state.actionDuration;
    const k=t<=contact?THREE.MathUtils.smoothstep(t,Math.max(0,contact-DREAM_STEP.rise),contact):1-THREE.MathUtils.smoothstep(t,contact+DREAM_STEP.hold,contact+DREAM_STEP.hold+DREAM_STEP.out);
    return DREAM_STEP.lead*k;
  }
  /** The feel pass: a big blow is being held (see BIG_SHAKE). */
  private bigHolding(state:PlayerState){return this.bigLeft>0&&!!state.hitstop;}
  /** The feel pass, iteration four: a big blow's freeze frame. While the hold lasts (bigHolding) the body
   *  is thrown back along the blow - the spine bent with it, the head whipped after it, the arms flung back the other
   *  way - over the reaction it snapped into, a held frame on impact; eased in on the snap and
   *  out as the hold lets go (IMPACT_POSE). About the world axis square to the blow, so it reads the same from any
   *  side; the legs are footPlanting's. A form's body (a beast, a giant) keeps its own reaction. */
  private impactPose(state:PlayerState,real:number){
    for(const [bone,turned] of this.impactApplied)if(bone.quaternion.angleTo(turned.written)<1e-6)bone.quaternion.copy(turned.base);
    this.impactApplied.clear();
    // (The dream loop tried this pose on every blow, a jab's at a third: a head 6-10 cm in a frame on a dozen fighters'
    // strings - the pops tests/reactionTakes guards against. It stays the big blow's at full weight, snapped in; round 86:
    // any other blow on a body on its feet, while its freeze lasts, at LIGHT_IMPACT's share, eased in.)
    const big=this.bigHolding(state);
    if(DREAM_IMPACT&&state.hitstop&&state.grounded&&state.action==='hurt'&&this.hitFlash>0)this.lightHeld=LIGHT_IMPACT.hold;else this.lightHeld=Math.max(0,this.lightHeld-real);
    const light=!big&&DREAM_IMPACT&&state.grounded&&state.action==='hurt'&&(!!state.hitstop&&this.hitFlash>0||this.lightHeld>0);
    if(big)this.impactLight=false;else if(light)this.impactLight=true;
    const want=big?1:light?LIGHT_IMPACT.share*Math.min(1,LIGHT_IMPACT.tall/(FIGHTERS[state.fighter]?.height??LIGHT_IMPACT.tall)):0;
    // (A light blow's share arrives over LIGHT_IMPACT.in, a big blow's whole pose over IMPACT_POSE.in.)
    const rise=this.impactLight?Math.max(want,.05)/LIGHT_IMPACT.in:1/IMPACT_POSE.in;
    this.impactWeight=THREE.MathUtils.clamp(this.impactWeight+(want>this.impactWeight?Math.min(want-this.impactWeight,real*rise):-Math.min(this.impactWeight-want,real/IMPACT_POSE.out)),0,1);
    if(this.impactWeight<=1e-3||!this.dynamics||this.isForm)return;
    const w=this.impactWeight*this.impactWeight*(3-2*this.impactWeight);
    // up x (bigHx, 0, bigHz): turning about it carries what is above the joint along the blow - a light blow's own
    // heading (the shake's) for its share.
    if(this.impactLight)_impactAxis.set(this.shakeHz,0,-this.shakeHx);else _impactAxis.set(this.bigHz,0,-this.bigHx);
    const turn=(name:string,angle:number)=>{
      const bone=this.joints.get(name);if(!bone?.parent)return;
      bone.parent.getWorldQuaternion(_impactParent);
      _impactLocal.copy(_impactAxis).applyQuaternion(_impactParent.invert()).normalize();
      const base=bone.quaternion.clone();
      bone.quaternion.premultiply(_impactTurn.setFromAxisAngle(_impactLocal,angle*w));
      this.impactApplied.set(bone,{base,written:bone.quaternion.clone()});
    };
    // The reaction's own shape decides which way: a body shot folds the body over the blow (hitFold > 0), so the pose
    // curls it over the fist; a head shot arches it off, so the pose throws it back. The arms fly toward the thrower
    // either way.
    // (The dream loop, round 26: a blow that knocks the body down - the slam, an air strike's spike - folds it over and
    // down whatever it struck, and further: driven toward the floor it is about to hit. Thrown back upright through the
    // freeze, a slam read as "a ground-pound effect pasted on a standing victim" to the calibration critic.)
    const knock=DREAM_IMPACT&&this.bigKnock;
    // (Round 90: and a blow drawn with an authored take bends the way the take goes - over the fist for the fold, off it for
    // the snap-back and the spins. Every melee blow lands low enough to fold (hitFold), so the freeze curled the body over
    // the fist on every one, and on a long spine it bent the snap-back's head forward again: Tempo's 11 cm, Gorai's 7.)
    const way=knock?-1:this.takeOn?(TAKE_SHAPE[this.takeOn].fold>=.5?-1:1):this.hitFold>.02?-1:1;
    const bend=way*IMPACT_POSE_SCALE*(knock?KNOCK_BEND:1);
    turn('Spine',IMPACT_POSE.spine[0]*bend);turn('Spine1',IMPACT_POSE.spine[1]*bend);turn('Spine2',IMPACT_POSE.spine[2]*bend);
    turn('Neck',IMPACT_POSE.neck*bend);turn('Head',IMPACT_POSE.head*bend);
    turn('LeftArm',IMPACT_POSE.arm);turn('RightArm',IMPACT_POSE.arm);
  }
  /** One blow's envelope, 0 at the blow, 1 at its peak, held there `hold`
   *  seconds (see HIT_HOLD), then settling at `settle` with a rebound at
   *  `swing`. Zero slope into and out of the hold, so it adds no step. */
  /** The dream loop (22 October 2026): a flung body's limbs flail - each arm and leg swinging out of step with the others
   *  (`phase`) through the flight, eased in off the blow and out well before the landing, so the landing's pose and the
   *  pop guards see none of it (LAUNCH_FLAIL). Radians to add to the limb's launch turn. */
  private flail(phase:number,amount:number){
    if(!DREAM_IMPACT||this.launchWeight<=0||this.launchAt<0)return 0;
    const t=this.reactTime-this.launchAt,k=THREE.MathUtils.smoothstep(t,.06,.22)*(1-THREE.MathUtils.smoothstep(this.launchArc,.45,.75))*this.launchWeight;
    return k>1e-4?Math.sin(t*LAUNCH_FLAIL.rate*Math.PI*2+phase)*amount*k:0;
  }
  private static hitEnvelope(t:number,rise=HIT_RISE,settle=HIT_SETTLE,hold=0,swing=HIT_SWING){
    if(t<=0)return 0;
    if(t<rise)return .5-.5*Math.cos(Math.PI*t/rise);
    const u=t-rise-hold;
    if(u<=0)return 1;
    return Math.exp(-u/settle)*(Math.cos(swing*u)+Math.sin(swing*u)/(swing*settle));
  }
  /** The Rubber recoil: from full stretch to rest on a stiff spring that
   *  overshoots into a squash and settles, no velocity step at the start. */
  private static rubberRecoil(w:number){return Math.exp(-w/RUBBER.settle)*(Math.cos(RUBBER.swing*w)+Math.sin(RUBBER.swing*w)/(RUBBER.swing*RUBBER.settle));}
  /** The reaction layer; see HIT_REACT and LAUNCH. Advanced on wall time
   *  through a hitstop - the body is seen to take the blow during the
   *  freeze - and held through a time stop. */
  private hitReact(real:number,state:PlayerState){
    this.reactTime+=real;this.reactAhead=0;this.bounceDrawn=0;
    {const shape=this.takeOn?TAKE_SHAPE[this.takeOn]:undefined,ease=1-Math.exp(-real/TAKE_EASE);
      this.takeFold+=((shape?.fold??1)-this.takeFold)*ease;this.takeLean+=((shape?.lean??1)-this.takeLean)*ease;this.takeHunch+=((shape?.hunch??1)-this.takeHunch)*ease;}
    // FLOOR_GUARD: how far the clip alone has the soles through the floor, before this layer turns the body over it.
    this.clipUnder=0;
    if(this.thrown(state)&&this.dynamics&&this.pelvis){this.group.updateMatrixWorld(true);const lowest=this.lowestSupport();if(Number.isFinite(lowest))this.clipUnder=Math.max(0,this.groundY+.006-lowest);}
    // The blow's own shove, which the contact push carries (see PUSH_SELL);
    // let go of with a withdrawn blow (see `withdraw`).
    this.sellNow=this.sellAmount*Fighter.sellEnvelope(this.reactTime-this.sellAt,this.sellSettle)*Fighter.letGo(this.reactTime-this.sellGone);
    if(!this.dynamics||!this.leanChain.length){this.launchWeight=0;return;}
    let twist=0,headYaw=0,dip=0,heaviest=0;
    const lean=_hitLean.set(0,0,0),whip=_hitWhip.set(0,0,0),shove=_hitShove.set(0,0,0),fling=_hitFling.set(0,0,0);
    for(const hit of this.hits){
      const t=this.reactTime-hit.at,h=hit.heavy;
      // A heavy blow holds its peak and settles slower (see HIT_HEAVY), and
      // lives as much longer as that takes to die away. It rises a little
      // slower as well, because it rises further: the snap's worst frame is
      // the clip's own, and the layer must not add to it.
      const rise=HIT_RISE*(1+.3*h),settle=HIT_SETTLE*(1+HIT_SLOW*h),hold=HIT_HOLD*h,swing=HIT_SWING*(1-.45*h);
      // A withdrawn blow (the server did not land it) lets go over WITHDRAW.
      const scale=hit.scale*Fighter.letGo(this.reactTime-hit.gone)*Fighter.hitReact;
      if(t>HIT_LIFE+hold+(settle-HIT_SETTLE)*5||scale<=0)continue;
      const e=Fighter.hitEnvelope(t,rise,settle,hold,swing)*scale;
      // The head of a heavy blow lags the body (HEAD_LAG): it whips once the
      // chest has been driven back, which is the weight reaching it - and it
      // keeps its fastest frames off the clip's own snap.
      const late=THREE.MathUtils.smoothstep(h,.3,.6),eh=late>0?Fighter.hitEnvelope(t-HEAD_LAG*late,rise*(1+.5*late),settle,hold,swing)*scale:e;
      twist+=hit.side*e*HIT_REACT.twist*((1+((hit.stand??1)-1)*h)/(hit.stand??1));headYaw+=hit.side*eh*HIT_REACT.headYaw;
      // (The dream loop, 23 October 2026: the standing fold, DREAM_STAND, whips the head and flings the arms further on
      // every blow; the chest's lean and twist, the knees' give and the hips' shove grow with it only as the blow is
      // heavy - a string stage's body leant, turned and sunk away from the fist left the next blow short of the skin,
      // tests/madakeConsecutiveContact and tests/murexChainContactRuntime.)
      const stand=hit.stand??1,chest=(1+(stand-1)*h)/stand;
      lean.x+=hit.hx*e*HIT_REACT.lean*chest;lean.z+=hit.hz*e*HIT_REACT.lean*chest;
      whip.x+=hit.hx*eh*HIT_REACT.headWhip;whip.z+=hit.hz*eh*HIT_REACT.headWhip;
      dip+=Math.max(0,e)*chest*HIT_REACT.dip;
      // Round 15 (REHIT): the arms' fling is a heading of its own, as the lean
      // and the whip are. It was a turn by the limbs' envelope about the
      // lean's axis, and the limbs lag the body (LIMB_LAG): where the lean's
      // envelope rebounds through nought the axis turned over in one frame
      // while the fling was still out, and both arms swung through twice
      // their fling - a hand 7-10 cm in a frame, late in a hurt the clip had
      // already finished (Kagari, Dorado, Kenzo, Sorrel, Gorai under Shirokane's or
      // KoKo's string). Laid along the blow, it passes through nought itself.
      const limb=Fighter.hitEnvelope(t-LIMB_LAG,LIMB_RISE,settle,hold,swing)*scale*HIT_REACT.arms;
      fling.x+=hit.hx*limb;fling.z+=hit.hz*limb;
      // The hips go first, and only with a blow's weight (see HIP_SHOVE).
      const push=Fighter.hitEnvelope(t,HIP_RISE,settle,hold,swing)*scale*chest*h*HIP_SHOVE;
      shove.x+=hit.hx*push;shove.z+=hit.hz*push;
      heaviest=Math.max(heaviest,h);
    }
    // A heavy blow may turn the body further than a flurry can (HIT_WIDER) -
    // the body: the head's own limits stay, because the neck is where one more
    // degree a frame shows first, and the body carries the head with it.
    const wide=1+HIT_WIDER*heaviest;
    twist=softTo(twist,HIT_LIMIT.twist*wide);headYaw=softTo(headYaw,HIT_LIMIT.headYaw);dip=softTo(dip,HIT_LIMIT.dip*wide);
    if(this.takeLean<.999)lean.multiplyScalar(this.takeLean);
    let leanAmount=lean.length(),whipAmount=whip.length(),flingAmount=fling.length();
    if(flingAmount>1e-6){flingAmount=softTo(flingAmount,HIT_LIMIT.arms*wide);fling.setLength(flingAmount);}
    if(leanAmount>1e-6)lean.multiplyScalar(softTo(leanAmount,HIT_LIMIT.lean*wide)/leanAmount);
    if(whipAmount>1e-6)whip.multiplyScalar(softTo(whipAmount,HIT_LIMIT.headWhip)/whipAmount);
    const shoveAmount=shove.length();
    if(shoveAmount>1e-6)shove.multiplyScalar(softTo(shoveAmount,HIP_SHOVE_MOST)/shoveAmount);
    // The launch: jack-knife, then a tumble back through the arc.
    // Round 3e (REACT): a knockdown called while the body is still in the air
    // is the same flight (see `reaction`): the tumble is handed back on the
    // floor, not a frame or two above it.
    const flying=state.action==='launched'||state.action==='knockdown'&&!state.grounded;
    // Round 3e (REACT): a launch drawn on a layer its blow did not start
    // (LAUNCH_STALE: an event that never came to `impact`) starts it here,
    // rather than playing out the end of the last one.
    if(flying&&!this.wasLaunched&&this.launchAt>=0&&(this.launchArc>=1||this.reactTime-this.launchAt>LAUNCH_STALE)){const facing=this.facing;this.startLaunch(undefined,undefined,false,-Math.sin(facing),-Math.cos(facing),0,1);}
    const launched=flying&&this.launchAt>=0;
    this.launchWeight=launched?1:Math.max(0,this.launchWeight-real/.12);
    // The landing (see LAND_BOUNCE): the frame a launched body is down, and
    // how fast it was falling when it got there.
    if(launched&&real>0)this.launchFall=Math.max(0,-this.velocity.y);
    if(this.wasLaunched&&!launched&&state.grounded&&this.launchAt>=0&&REACTION_ACTIONS.has(state.action)){this.landedAt=this.reactTime;this.landSpeed=this.launchFall;this.landRoll=1;}
    if(launched)this.landedAt=-1;
    // The hand-back (LAUNCH_HOLD): from the first frame the flight is over.
    // Held only by a body down on the floor: one the flight set on its feet (a pop, a dizzy) stands straight up out of it.
    if(launched)this.handAt=-1;else if(this.wasLaunched&&this.launchAt>=0){this.handAt=this.reactTime;this.handHold=state.action==='knockdown'?LAUNCH_HOLD:0;}
    const hand=this.handAt>=0?1-THREE.MathUtils.smoothstep(this.reactTime-this.handAt,this.handHold,this.handHold+LAUNCH_HAND):0;
    if(hand<=0)this.handAt=-1;
    this.wasLaunched=launched;
    let bounce=0,roll=0;
    if(this.landedAt>=0){
      const t=this.reactTime-this.landedAt;
      if(t<LAND_TIME&&REACTION_ACTIONS.has(state.action)){
        const u=t/LAND_TIME,height=Math.min(LAND_BOUNCE_MOST,this.landSpeed*LAND_BOUNCE);
        // Up off the floor and down again, the way a thrown body rebounds; and
        // on over along the throw while it is up, settling back as it lands.
        // (The roster-wide motion pass: over, legs first - the side the body lies on decides which way that is, LAUNCH_SIDE.
        // Rolled the other way, a body lying feet first along the throw sat up with its legs through the floor.)
        bounce=height*Math.sin(Math.PI*u)*(1-.35*u);roll=LAND_ROLL*this.landRoll*this.launchSide*Math.min(1,height/LAND_BOUNCE_MOST+.35)*Math.sin(Math.PI*u)*Math.sin(Math.PI*u*.5+Math.PI*.5);
      }else this.landedAt=-1;
    }
    let jack=0,headLag=0,tumble=0,trail=0,limbs=0,spin=0;
    if((this.launchWeight>0||hand>0)&&this.launchAt>=0&&this.pelvis){
      const t=this.reactTime-this.launchAt;
      jack=Fighter.hitEnvelope(t,LAUNCH_RISE,LAUNCH_SETTLE);
      headLag=Fighter.hitEnvelope(t-.04,LAUNCH_RISE,LAUNCH_SETTLE);
      limbs=Fighter.hitEnvelope(t-LIMB_LAG,LIMB_RISE+.04,LAUNCH_SETTLE);
      // Round 3e (REACT): what a re-launch took over (see `launchCarry`), let
      // go of over LAUNCH_LET_GO while the new launch's own rises.
      const held=Math.exp(-t/LAUNCH_LET_GO);
      jack=Math.max(jack,this.launchHeld[0]*held);headLag=Math.max(headLag,this.launchHeld[1]*held);limbs=Math.max(limbs,this.launchHeld[2]*held);
      // How far through the arc, never backwards: the flight time the rise
      // implies (a launch's rise until the measured one arrives - the
      // velocity window is seventy milliseconds behind a launch), and on the
      // way down the fall itself, which may only bring it forward.
      if(real>0){
        this.launchRise=Math.max(this.launchRise,this.velocity.y);
        const flight=2*(this.launchLed?this.launchGuess:Math.max(this.launchRise,this.launchGuess))/(JUMP_GRAVITY*LAUNCH_GRAVITY);
        this.launchArc=Math.min(1,this.launchArc+real/flight);
        // Round 3e (REACT): brought forward to the fall's own reading over
        // LAUNCH_CATCH, not in the frame the descent is first seen. The rise
        // is read off the drawn body seventy milliseconds late (and guessed
        // at LAUNCH_RISE_GUESS until then), so a low or re-launched arc was
        // well short of half way at the top, and the tumble and the
        // corkscrew, laid along it, turned up to a third of a turn in one
        // frame there - a 60-95 cm jump of the head at the apex.
        const top=this.launchLed?this.launchGuess:this.launchRise;
        if(top>2&&this.velocity.y<0){const fall=Math.min(1,.5-.5*this.velocity.y/top);if(fall>this.launchArc)this.launchArc+=(fall-this.launchArc)*Math.min(1,real/LAUNCH_CATCH);}
      }
      const arc=this.launchArc;
      trail=Math.max(THREE.MathUtils.smoothstep(t,.05,.2),this.launchHeld[3]*held)*(1-THREE.MathUtils.smoothstep(arc,.7,1));
      if(launched){
        // The clip's own pitch: the hips-to-neck line tipped toward the way
        // the body is flying, before anything here has touched it.
        const neck=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
        if(neck){
          this.pelvis.getWorldPosition(_hitFrom);neck.getWorldPosition(_hitTo).sub(_hitFrom);
          const pitch=Math.atan2(_hitTo.x*this.launchHeading.x+_hitTo.z*this.launchHeading.z,_hitTo.y);
          // Round 3e (REACT): a re-launch starts its path where the body is
          // drawn - the clip's pitch and the tumble it carried - and ends on
          // its back the nearer way round from there.
          if(!Number.isFinite(this.launchFrom))this.launchFrom=pitch+this.launchCarry;
          // On its back as the downed clip lies, which side of the turn that is (LAUNCH_SIDE).
          const lie=this.launchSide*LAUNCH_LAND;
          const land=lie+Math.PI*2*(this.launchCarry?Math.round((this.launchFrom-lie)/(Math.PI*2)):this.launchTurns);
          // Nearly even through the arc - a third faster off the blow than
          // into the landing - so a full turn is never more than eleven
          // degrees a frame at the hips. Done by LAUNCH_DONE of it, lying for the rest of the fall.
          const done=Math.min(1,arc/LAUNCH_DONE);
          const path=this.launchFrom+(land-this.launchFrom)*done*(1.35-.35*done);
          this.launchLand=land;this.launchDrawn=path;
          // Whole turns are free - the same rotation - so what the hips take
          // is the short way round. That matters once it is scaled: the
          // hand-back after the landing fades this toward nothing, and fading
          // a turn and a half would spin the body back through it.
          const short=THREE.MathUtils.euclideanModulo(path-pitch+Math.PI,Math.PI*2)-Math.PI;
          // Eased in off a blow from nothing; a re-launch has its tumble already.
          this.launchPitch=short*(this.launchCarry?1:THREE.MathUtils.smoothstep(t,0,.08));
        }
      }
      // The hand-back (LAUNCH_HOLD): the landing's pitch against the clip the body is in now, the turn it takes from
      // there kept continuous with the last frame's (whole turns are free, and a jump of one is not).
      else if(hand>0&&Number.isFinite(this.launchLand)){
        const neck=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
        if(neck){
          this.pelvis.getWorldPosition(_hitFrom);neck.getWorldPosition(_hitTo).sub(_hitFrom);
          const pitch=Math.atan2(_hitTo.x*this.launchHeading.x+_hitTo.z*this.launchHeading.z,_hitTo.y);
          // Down short of lying (an arc read late), it is laid the rest of the way over the hold.
          const short=THREE.MathUtils.euclideanModulo(this.launchLand-this.launchDrawn+Math.PI,Math.PI*2)-Math.PI;
          const want=this.launchDrawn+(this.handHold>0?short*THREE.MathUtils.smoothstep(this.reactTime-this.handAt,0,this.handHold):0);
          this.launchPitch+=THREE.MathUtils.euclideanModulo(want-pitch-this.launchPitch+Math.PI,Math.PI*2)-Math.PI;
        }
      }
      tumble=launched?this.launchPitch:this.launchPitch*hand;
      // The corkscrew (see LAUNCH_SPIN): whole turns about the line of flight,
      // eased in off the blow and out into the landing, so the landing sees
      // none of it.
      // Done by LAUNCH_SPUN of the arc - the arc is read off the body's rise
      // and fall, and a turn still going when the landing hands it back would
      // be unwound in a few frames - and taken the short way round, which at
      // full weight is the same rotation and, fading, the least one.
      if(this.launchSpin){
        const a=THREE.MathUtils.smoothstep(this.launchArc,.08,LAUNCH_SPUN);
        spin=THREE.MathUtils.euclideanModulo(this.launchSpin*Math.PI*2*a*THREE.MathUtils.smoothstep(t,.06,.2)+Math.PI,Math.PI*2)-Math.PI;
      }
      // Round 3e (REACT): a corkscrew a re-launch cut short unwinds the short
      // way over LAUNCH_UNWIND rather than in the frame the blow lands.
      if(this.spinCarry)spin+=this.spinCarry*(1-THREE.MathUtils.smoothstep(t,0,LAUNCH_UNWIND));
      this.launchLast[0]=jack;this.launchLast[1]=headLag;this.launchLast[2]=limbs;this.launchLast[3]=trail;this.lastSpin=spin;
      const w=this.launchWeight;jack*=w;headLag*=w;tumble*=launched?w:1;trail*=w;limbs*=w;spin*=w;
    }
    const hasLaunch=Math.abs(jack)+Math.abs(tumble)+Math.abs(trail)+Math.abs(limbs)+Math.abs(spin)+Math.abs(roll)>1e-4;
    // The root's own travel (see STEP_SPEED); a jump of metres in a frame is
    // a respawn or a vanish, not travel.
    const root=this.group.position;
    if(real>0&&Number.isFinite(this.staggerRoot.x)){this.staggerVelocity.set(root.x-this.staggerRoot.x,0,root.z-this.staggerRoot.z).divideScalar(real);if(this.staggerVelocity.lengthSq()>900)this.staggerVelocity.set(0,0,0);}
    if(real>0)this.staggerRoot.copy(root);
    const travel=Math.hypot(this.staggerVelocity.x,this.staggerVelocity.z);
    const stepping=state.grounded&&STEPPING_REACTIONS.has(state.action)&&this.legs.length>0&&travel<SKID_SPEED&&travel>(this.staggerWeight>0?STEP_SPEED*.8:STEP_SPEED);
    if(Math.abs(twist)<1e-4&&leanAmount<1e-4&&whipAmount<1e-4&&flingAmount<1e-4&&Math.abs(dip)<1e-4&&shoveAmount<1e-4&&!hasLaunch&&bounce<1e-4&&!stepping&&this.staggerWeight<1e-3){this.staggerWeight=0;return;}
    // Where the clip and the layers before this one have the ankles, before
    // anything here moves them.
    for(let i=0;i<this.legs.length&&i<this.legAnkles.length;i++)this.legs[i].ankle.getWorldPosition(this.legAnkles[i]);
    const chain=this.leanChain,top=chain.length-1;
    const twistTotal=TWIST_TOTAL[top],tipTotal=TIP_TOTAL[top],foldTotal=FOLD_TOTAL[top];
    const launchAxis=hasLaunch?tipAxis(this.launchHeading,_hitAxisB):undefined;
    leanAmount=lean.length();
    const leanAxis=leanAmount>1e-6?tipAxis(lean,_hitAxis):undefined;
    for(let i=0;i<chain.length;i++){
      _leanWorld.identity();
      if(Math.abs(twist)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,twist*TWIST_SHARE[i]/twistTotal));
      if(leanAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(leanAxis,leanAmount*LEAN_TIP[i]/tipTotal));
      if(launchAxis){
        // The hips carry the whole body back with the blow and over in the
        // tumble; the spine folds the chest forward over it.
        if(i===0){
          _leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,jack*LAUNCH.hips+tumble+roll));
          if(Math.abs(spin)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(this.launchHeading,spin));
        }
        else _leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,-jack*LAUNCH.fold*FOLD_LAUNCH[i]/foldTotal));
      }
      this.leanBone(chain[i],_leanWorld);
    }
    if(this.headBone){
      _leanWorld.identity();
      if(Math.abs(headYaw)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,headYaw));
      whipAmount=whip.length();
      if(whipAmount>1e-6)_leanWorld.multiply(_leanShare.setFromAxisAngle(tipAxis(whip,_hitAxisC),whipAmount));
      if(launchAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,headLag*LAUNCH.head));
      this.leanBone(this.headBone,_leanWorld);
    }
    // The arms fling the way the torso does not go, and trail behind a launch.
    const flingAxis=flingAmount>1e-4?tipAxis(fling,_hitAxisD):undefined;
    if(flingAxis||hasLaunch){
      for(const name of UPPER_ARMS){
        const bone=this.joints.get(name);if(!bone)continue;
        _leanWorld.identity();
        // A turn toward the blow's heading swings a hanging arm the other
        // way - toward whoever threw it - which is the arm trailing.
        if(flingAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(flingAxis,flingAmount));
        if(launchAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,(limbs+trail*LAUNCH.trail/LAUNCH.arms)*LAUNCH.arms+this.flail(name==='LeftArm'?0:2.1,LAUNCH_FLAIL.arms)));
        this.leanBone(bone,_leanWorld);
      }
    }
    // A launched body's legs trail too: the thighs swing toward whoever threw
    // it and the knees fold, which is the V of a jack-knife.
    if(launchAxis)for(const leg of this.legs){
      // The same turn swings a thigh (hanging down) toward the thrower, and
      // the opposite folds the shin back under it.
      this.leanBone(leg.hip,_leanWorld.setFromAxisAngle(launchAxis,limbs*LAUNCH.legs+trail*.25+this.flail(leg===this.legs[0]?1.0:3.6,LAUNCH_FLAIL.legs)));
      this.leanBone(leg.knee,_leanWorld.setFromAxisAngle(launchAxis,-(limbs+trail*.4)*LAUNCH.knees));
    }
    // The knees give under the blow, and a heavy one drives the hips back
    // and down into them (see HIP_SHOVE); a landing throws the body back up.
    // Only a body on its feet is shoved and has them held: one lying down or
    // getting up has no stance to keep, and its straight legs no bend to
    // solve in.
    const standing=state.grounded&&bounce<=1e-4&&this.legs.length>0&&STANDING_REACTIONS.has(state.action);
    if(!standing)shove.set(0,0,0);
    this.staggerSteps(real,stepping,state);
    const moved=(dip>1e-4||shove.lengthSq()>1e-8||bounce>1e-4)&&!!this.pelvis&&!!this.pelvis.parent&&!launched;
    const planted=!launched&&state.grounded&&bounce<=1e-4&&this.legs.length>0&&(standing&&moved||this.staggerWeight>1e-3);
    if(planted)for(let i=0;i<this.legs.length&&i<this.shoveAnkles.length;i++)this.shoveAnkles[i].copy(this.legAnkles[i]).lerp(this.staggerTarget[i],this.staggerWeight);
    if(moved&&this.pelvis&&this.pelvis.parent){
      this.pelvis.getWorldPosition(_leanPoint);
      _leanPoint.x+=shove.x;_leanPoint.z+=shove.z;_leanPoint.y+=bounce-dip-shove.length()*.35;this.bounceDrawn=bounce;
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_leanPoint));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
    }
    if(planted&&this.pelvis){
      this.pelvis.updateMatrixWorld(true);
      for(let i=0;i<this.legs.length&&i<this.shoveAnkles.length;i++)this.solveLeg(this.legs[i],this.shoveAnkles[i],1);
    }
    this.hipShove.copy(shove);
  }

  /** Contact (see TORSO_RADIUS), on the pose just drawn: the push this body
   *  wants off the striking surfaces inside it and off its own blow's shove,
   *  eased; and any blow that has just arrived answered as a touch. The push
   *  is applied to the group from the next frame (see `update`). Once a
   *  frame, first, whatever the server has since refused is let go of. */
  private contactPush(real:number,state:PlayerState){
    if(this.isForm)return;
    if(real>0)this.withdrawRejected();
    const want=_pushWant.set(0,0,0);
    let most=PUSH_MOST,lead=-1;
    GUARD.runs=0;
    if(Fighter.contact&&this.dynamics&&state.alive&&!this.ragdoll&&!state.timeStopped){
      const body=this.drawnBody(),hips=body.pelvis,top=body.joints.get('Neck')??body.joints.get('Spine2')??body.headBone;
      if(hips&&top){
        // This body as it would be drawn without the push.
        const scale=body===this?1:AWAKENINGS[state.fighter].formScale??1;
        _torsoA.setFromMatrixPosition(hips.matrixWorld).sub(this.push);
        _torsoB.setFromMatrixPosition(top.matrixWorld).sub(this.push);
        const head=body.headBone?_torsoH.setFromMatrixPosition(body.headBone.matrixWorld).sub(this.push):undefined;
        if(head)head.y+=HEAD_LIFT*scale;
        const radius=TORSO_RADIUS[state.fighter]*scale,headRadius=HEAD_RADIUS*scale;
        for(const other of Fighter.drawn){
          const s=other.state;
          // A swing, or a dash: a chase arriving at a launched body brings the
          // chaser's knees and feet up into it.
          const dashing=s.action==='dash';
          if(other===this||!s.alive||!(ATTACK_SLOTS.has(s.action)||dashing)||!(s.actionDuration>0))continue;
          // Fighters on one side never land a blow on each other (arcade
          // survival's co-op): an ally's fist passing is not a blow.
          if(s.team!==undefined&&s.team===state.team)continue;
          const dx=_torsoA.x-other.group.position.x,dz=_torsoA.z-other.group.position.z,flat=Math.hypot(dx,dz);
          if(flat>CONTACT_REACH*Math.max(1,scale))continue;
          // Only a blow thrown with the body. An iai dash passes through the
          // body it cuts on purpose (see THROUGH_LEAD).
          const move=dashing?undefined:other.moveFor(s) as MoveDefinition&Approach;
          if(move&&(move.style!=='melee'||move.dashThrough))continue;
          // A blade pushes only around a blow: a wind-up that carries it
          // overhead through the air a body stands in is not one yet, and a
          // recovery is the arm coming away. A move that holds its blades out
          // through a body the whole time it plays (`spacing`, the
          // Dust Sea Sundered) pushes throughout. A fist or a foot always does: a
          // kick still in the body as the next stage takes over is still in it.
          const steel=!!move&&(move.spacing!==undefined||Fighter.aroundContact(move,s.actionTime*s.actionDuration));
          // Pushed straight back from whoever struck, level.
          const hx=flat>1e-3?dx/flat:Math.sin(other.group.rotation.y),hz=flat>1e-3?dz/flat:Math.cos(other.group.rotation.y);
          const striker=other.drawnBody();
          beginContact(_torsoA,_torsoB,radius,head,headRadius,hx,hz);
          striker.strikeSurfaces(steel,!!move&&move.spacing!==undefined);
          const needed=endContact();
          // A blow this swing landed here (see LANDED), answered where it is
          // drawn.
          if(move&&!UNTOUCHED.has(state.action))this.touchFrom(other,move,hx,hz,radius);
          // And only a body the swing has landed on, or a chase is arriving
          // at, is pushed off its surfaces: a blade that missed a body passes
          // it, rather than shoving it as if it had struck.
          if(!this.pushedBy(other,dashing))continue;
          if((striker.armed||!!striker.blades?.length)&&CONTACT.runs>0)most=move?.spacing!==undefined?PUSH_MOST_HOLD:PUSH_MOST_ARMED;
          if(CONTACT.runs>0&&needed>lead){lead=needed;guardContact();}
          if(needed<=0)continue;
          want.x+=hx*(needed+CONTACT_MARGIN);want.z+=hz*(needed+CONTACT_MARGIN);
        }
      }
    }
    // The blow's own shove (see PUSH_SELL), as the reaction layer has it now.
    const sell=this.sellNow;
    if(sell>1e-4&&Fighter.contact&&!state.timeStopped){want.x+=this.sellDir.x*sell;want.z+=this.sellDir.z*sell;}
    const length=want.length();
    if(length>most)want.multiplyScalar(most/length);
    // Onto it fast: a fist is not let inside a body for a frame on the way to
    // being stopped by it. Off it slowly, and faster while the body's own
    // knockback is carrying it the same way, so letting go never reads as a
    // step back toward whoever threw the blow.
    if(real>0)this.pushBudget=PUSH_RISE*real;
    if(want.lengthSq()>=this.push.lengthSq()){
      // Up to it within the frame's budget: a fist's few centimetres at once,
      // a two-metre blade's shove over a few frames rather than in one.
      const step=_pushStep.subVectors(want,this.push),need=step.length();
      const take=Math.min(need,this.pushBudget);this.pushBudget-=take;
      if(need>1e-9)this.push.addScaledVector(step,take/need);
    }else if(real>0){
      const step=_pushStep.subVectors(want,this.push),need=step.length(),held=this.push.length();
      const away=held>1e-6?Math.max(0,(this.velocity.x*this.push.x+this.velocity.z*this.push.z)/held):0;
      if(need>1e-6)this.push.addScaledVector(step,Math.min(1,(PUSH_FALL+.5*away)*real/need));
      // And never let go back into steel still swinging through where the
      // body would be: held at the far side of it instead.
      if(GUARD.runs>0){
        const now=this.push.x*GUARD.hx+this.push.z*GUARD.hz,into=contactRun(now);
        if(into>=0){const clear=Math.max(now,Math.min(GUARD.exit[into],most));this.push.x+=GUARD.hx*(clear-now);this.push.z+=GUARD.hz*(clear-now);}
      }
    }
    // Drawn there on this frame, not the next.
    if(!this.ragdoll){
      const moved=_pushStep.subVectors(this.push,this.pushDrawn);
      if(moved.lengthSq()>1e-12){this.group.position.add(moved);this.pushDrawn.copy(this.push);this.group.updateMatrixWorld(true);}
    }
  }
  /** Every body's contact push brought up to date against every other body's
   *  finished pose (see TORSO_RADIUS). Each fighter already measures its own
   *  at the end of its update, but against the bodies drawn before it: one
   *  drawn after it swings a frame late. CombatEffects calls this once a frame,
   *  after every fighter has been drawn; it only ever pushes further, never
   *  lets go, so calling it twice is harmless. */
  static settleContacts(){for(const body of Fighter.drawn)body.contactPush(0,body.state);}
  /** Whether `other`'s striking surfaces push this body (see TORSO_RADIUS):
   *  its swing has landed here - this swing, answered as a touch or by its
   *  event, hit or guarded (see LANDED), or one before it that landed within
   *  PUSH_KEEP and may still be in the body - or it is a chase arriving at
   *  this body. */
  private pushedBy(other:Fighter,dashing:boolean){
    if(dashing)return this.targetOf(other);
    const s=other.state,seq=s.actionSeq??-1;
    for(const touch of this.touches)if(touch.from===other&&!touch.withdrawn&&(touch.seq===seq||this.reactTime-touch.at<=PUSH_KEEP))return true;
    return LANDED.landed(s.id,seq,this.state.id,s.actionStarted);
  }
  /** Whether this is the body `other` is fighting: its target point is on
   *  where this body stands (without the push). */
  private targetOf(other:Fighter){
    const point=other.targetPoint;
    return !!point&&Math.hypot(point.x-this.group.position.x+this.push.x,point.z-this.group.position.z+this.push.z)<=OPPONENT_MATCH;
  }
  /** Whether `elapsed` seconds into `move` is around one of its blows: from
   *  TOUCH_BEFORE ahead of a contact to PUSH_AFTER after it. */
  private static aroundContact(move:MoveDefinition,elapsed:number){
    for(const contact of move.contacts)if(elapsed>=contact-TOUCH_BEFORE&&elapsed<=contact+PUSH_AFTER)return true;
    return false;
  }
  /** Each blow of `other`'s swing that the simulation landed on this body
   *  (see LANDED), answered where it is drawn: inside the window of the
   *  contact that landed it, as soon as one of the swing's surfaces is at the
   *  skin (the contact solver's, TOUCH_REACH), or - where none gets there, a
   *  fist stopped short - once the contact has come due, on the chest facing
   *  the blow. A remote swing's verdict is in before the swing is drawn, so
   *  its blow is answered where the fist arrives; the local fighter's is the
   *  local copy's, on the tick the drawn swing reaches its contact.
   *  Answered as `impact` would answer its event (see `takeBlow`), and marked
   *  for the effects. A blow the guard took is pushed and not flinched: the
   *  event says what the guard did with it. Nothing is answered twice: not a
   *  contact touched already, nor one whose event has been handed over (it
   *  answered the blow itself), nor a prediction the server has refused. */
  private touchFrom(other:Fighter,move:MoveDefinition,hx:number,hz:number,radius:number){
    const s=other.state,elapsed=s.actionTime*s.actionDuration,seq=s.actionSeq??-1,slot=s.action as AttackSlot;
    const arrived=CONTACT.deepest>-TOUCH_REACH;
    for(let index=0;index<move.contacts.length;index++){
      const off=elapsed-move.contacts[index];
      if(off>TOUCH_AFTER||off<(arrived?-TOUCH_BEFORE:0))continue;
      const blow=LANDED.blow(s.id,seq,this.state.id,index);
      // Answered already: this contact, or the same blow under another input
      // edge (see LANDED's standsFor) - a replay can re-time a swing.
      let answered=false;
      for(const touch of this.touches)if(touch.from===other&&(touch.seq===seq&&touch.index===index||!!blow&&LANDED.same(LANDED.blow(s.id,touch.seq,this.state.id,touch.index),blow))){answered=true;break;}
      if(answered)continue;
      // Round 3e (REACT): nor, yet, one the local copy landed on a body it
      // could not vouch for (LANDED's `held`: on the move, in the air, in a
      // swing): it is answered when the server lands it, not before. The third
      // blind critic's fleeing targets flinched, flashed and sparked for blows
      // the server never landed.
      if(blow?LANDED.refused(blow)||blow.delivered||LANDED.held(blow):!LANDED.guarded(s.id,this.state.id,slot,index,s.actionStarted))continue;
      // Where it lands: the surface at the skin, or the chest facing the blow.
      const point=arrived?CONTACT.point:_touchPoint.copy(_torsoA).lerp(_torsoB,.6);
      if(!arrived){point.x-=hx*radius;point.z-=hz*radius;}
      this.answerTouch(other,move,index,seq,slot,hx,hz,point,!blow);
    }
  }
  /** One blow answered as a touch (see `touchFrom`). */
  private answerTouch(other:Fighter,move:MoveDefinition,index:number,seq:number,slot:AttackSlot,hx:number,hz:number,point:THREE.Vector3,guarded:boolean){
    const s=other.state,chain=slot==='light'?other.rushStage(s):0;
    const finisher=slot==='light'&&chain>=RUSH_STAGES-1;
    // Round 3e (REACT, for ULTFIX): an ultimate's blow weighs what its damage
    // schedule says (MoveDefinition.schedule, the simulation's `holdHit`) -
    // a barrage tick is not the finisher.
    const damage=move.schedule?.[index]??(index===move.contacts.length-1&&move.finisherDamage!==undefined?move.finisherDamage:move.damage);
    let ring=-1;
    if(!guarded){
      _touchDir.set(hx,0,hz);
      const height=point.y-this.group.position.y;
      this.hitFreeze=Math.max(this.hitFreeze,finisher?.1:.07);
      ring=this.takeBlow(slot,'melee',index,_touchDir,damage,height,{chain},finisher,undefined,true);
      // The replacement form IS the body while it shows (see `impact`).
      const form=this.drawnBody();
      if(form!==this){const inner=form.takeBlow(slot,'melee',index,_touchDir,damage,height,{chain},finisher,undefined,true);
        form.touches.push({from:other,seq,index,at:form.reactTime,slot,ring:inner,claimed:false,hx,hz});if(form.touches.length>6)form.touches.shift();}
    }
    this.touches.push({from:other,seq,index,at:this.reactTime,slot,ring,claimed:guarded,hx,hz});
    if(this.touches.length>6)this.touches.shift();
    Fighter.touchLog.push({serial:++Fighter.touchSerial,victim:this.state.id,attacker:s.id,fighter:s.fighter,slot,chain,damage,
      x:point.x,y:point.y,z:point.z,hx,hz,guarded,seq,index});
    if(Fighter.touchLog.length>16)Fighter.touchLog.shift();
  }
  /** This fighter's striking surfaces, each handed to the contact solver
   *  (`contactSurface`, see TORSO_RADIUS): the knuckles, the elbows, the
   *  heels, the toes and the knees, and a blade along its length from just
   *  past the hand (BLADE_FROM) - which pushes only where `steel` says so. */
  /** Exact authored ISOH steel, cached once; the curse and torso never become weapon reach. */
  private chohanBladeMarkers?: { base: THREE.Object3D; tip: THREE.Object3D } | null;
  private strikeSurfaces(steel=true,whole=false){
    if(hagureStrikeSurface(this.state.fighter,this.state.action,this.active?.getClip().name,this.active?.time??0,this.isForm,this.joints,contactSurface))return;
    this.knuckles??=HAND_SIDES.map(side=>this.bones.get(`${side.toLowerCase()}handmiddle1`)??this.bones.get(`${side.toLowerCase()}handindex1`));
    for(let side=0;side<2;side++){
      const name=HAND_SIDES[side],hand=this.joints.get(name+'Hand'),elbow=this.joints.get(name+'ForeArm');
      if(hand){
        _strikeP.setFromMatrixPosition(hand.matrixWorld);
        const knuckle=this.knuckles[side];
        if(knuckle)_strikeP.lerp(_strikeQ.setFromMatrixPosition(knuckle.matrixWorld),1.3);
        else if(elbow){
          // No fingers: the knuckles a fist's width on along the forearm.
          _strikeTip.subVectors(_strikeP,_strikeQ.setFromMatrixPosition(elbow.matrixWorld));
          const l=_strikeTip.length();if(l>1e-4)_strikeP.addScaledVector(_strikeTip,.08/l);
        }
        contactSurface(_strikeP);
      }
      if(elbow)contactSurface(_strikeP.setFromMatrixPosition(elbow.matrixWorld));
      for(const joint of STRIKE_LEGS[side]){const bone=this.joints.get(joint);if(bone)contactSurface(_strikeP.setFromMatrixPosition(bone.matrixWorld));}
    }
    // ISOH's measured markers preserve contacts along the whole dagger, rather than
    // inferring a reach from a wrist or the inventory curse's weighted mesh.
    if(this.state.fighter==='chohan'){
      if(this.chohanBladeMarkers===undefined){
        const base=this.model.getObjectByName('ChohanBladeBase'),tip=this.model.getObjectByName('ChohanBladeTip');
        this.chohanBladeMarkers=base&&tip?{base,tip}:null;
      }
      if(this.chohanBladeMarkers){
        this.chohanBladeMarkers.base.getWorldPosition(_strikeQ);
        this.chohanBladeMarkers.tip.getWorldPosition(_strikeTip);
        this.bladeSurfaces(steel,whole);
        return;
      }
    }
    // A blade that is out: the held steel hides for the moves that draw
    // their own (see `update`).
    if(this.state.fighter!=='irbis'&&(this.heldWeapons.length===0||this.heldWeapons[0].visible)){
      for(let side=0;side<2;side++){
        const reach=side?this.leftReach:this.rightReach,bone=side?this.leftBone:this.rightBone;
        if(!reach||!bone)continue;
        _strikeTip.copy(reach).applyMatrix4(bone.matrixWorld);_strikeQ.setFromMatrixPosition(bone.matrixWorld);
        // Close enough together that no stretch of steel between two of them
        // can cross a torso unseen: the GRAVEDIGGER is two and a half metres.
        // Only the forte pushes (see BLADE_FORTE); the whole blade touches.
        this.bladeSurfaces(steel,whole);
      }
      this.blades??=this.findBlades();
      for(const blade of this.blades){
        if(!blade.bone.visible)continue;
        _strikeTip.copy(blade.tip).applyMatrix4(blade.bone.matrixWorld);_strikeQ.setFromMatrixPosition(blade.bone.matrixWorld);
        this.bladeSurfaces(steel,whole);
      }
    }
  }
  /** One blade, from _strikeQ (the grip) to _strikeTip, to the solver: the
   *  forte pushes where `steel` says so, and all of it where `whole` does - a
   *  move that holds its blades through a body (see BLADE_FORTE). */
  private bladeSurfaces(steel:boolean,whole:boolean){
    const length=_strikeTip.distanceTo(_strikeQ),forte=whole?1:Math.min(BLADE_FORTE,BLADE_FORTE_MOST/Math.max(length,1e-3));
    const n=THREE.MathUtils.clamp(Math.ceil(length*(1-BLADE_FROM)/BLADE_STEP)+1,4,40);
    for(let i=0;i<n;i++){const u=BLADE_FROM+(1-BLADE_FROM)*i/(n-1);contactSurface(_strikeP.lerpVectors(_strikeQ,_strikeTip,u),steel&&u<=forte);}
  }
  /** See MOUTH_BLADE: the sword in the teeth, laid on the head's finished pose. */
  private mouthBladeBone?:THREE.Object3D|null;
  private mouthBlade(){
    const m=MOUTH_BLADE[this.state.fighter];
    if(!m||this.isForm||!this.headBone)return;
    if(this.mouthBladeBone===undefined)this.mouthBladeBone=this.model.getObjectByName(m.bone)??null;
    const bone=this.mouthBladeBone;
    if(!bone?.parent)return;
    this.headBone.updateMatrixWorld(true);
    _mouthM.compose(_mouthP.fromArray(m.at),_mouthQ.fromArray(m.turn),_mouthS.set(1,1,1));
    _mouthW.multiplyMatrices(this.headBone.matrixWorld,_mouthM);
    bone.parent.updateMatrixWorld(true);
    _mouthW.premultiply(_mouthM.copy(bone.parent.matrixWorld).invert());
    _mouthW.decompose(bone.position,bone.quaternion,bone.scale);
    bone.updateMatrixWorld(true);
  }
  private findBlades(){
    const out:{bone:THREE.Object3D;tip:THREE.Vector3}[]=[];
    const covered=(bone:THREE.Object3D)=>{for(let node:THREE.Object3D|null=bone;node;node=node.parent)if(node===this.rightBone&&this.rightReach||node===this.leftBone&&this.leftReach)return true;return false;};
    const reach=new Map<THREE.Object3D,{tip:THREE.Vector3;length:number}>();
    const world=new THREE.Vector3(),origin=new THREE.Vector3(),inverse=new THREE.Matrix4();
    this.model.updateMatrixWorld(true);
    this.model.traverse(object=>{
      const skin=object as THREE.SkinnedMesh;
      if(!skin.isSkinnedMesh)return;
      const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,positions=skin.geometry.attributes.position;
      if(!ids||!weights)return;
      for(let i=0;i<positions.count;i+=2){
        let heaviest=0,at=-1;
        for(let j=0;j<4;j++){const w=weights.getComponent(i,j);if(w>heaviest){heaviest=w;at=ids.getComponent(i,j);}}
        const bone=skin.skeleton.bones[at];
        if(!bone||!BLADE_BONE.test(bone.name)||covered(bone))continue;
        skin.getVertexPosition(i,world).applyMatrix4(skin.matrixWorld);
        const distance=world.distanceTo(bone.getWorldPosition(origin));
        let entry=reach.get(bone);
        if(!entry){entry={tip:new THREE.Vector3(),length:0};reach.set(bone,entry);}
        if(distance>entry.length&&distance<2.8){entry.length=distance;entry.tip.copy(world).applyMatrix4(inverse.copy(bone.matrixWorld).invert());}
      }
    });
    for(const [bone,entry] of reach)if(entry.length>BLADE_MIN)out.push({bone,tip:entry.tip});
    return out;
  }

  /** Stagger steps (see STEP_SPEED): into staggerTarget, where each foot is
   *  to be this frame, and `stagger`, how far in they are. `legAnkles` holds
   *  where the clip has the feet. */
  private staggerSteps(real:number,stepping:boolean,state:PlayerState){
    const n=Math.min(this.legs.length,2);
    if(this.staggerWeight<=0&&!stepping){this.staggerSwing[0]=this.staggerSwing[1]=-1;return;}
    if(this.staggerWeight<=0){for(let i=0;i<n;i++){this.staggerAt[i].copy(this.legAnkles[i]);this.staggerSwing[i]=-1;}this.staggerGathered=0;}
    if(stepping)this.staggerGathered=0;
    const vx=this.staggerVelocity.x,vz=this.staggerVelocity.z;
    // How far each held foot is from where the clip has it.
    let far=-1,most=0,swinging=false;
    for(let i=0;i<n;i++){
      if(this.staggerSwing[i]>=0){swinging=true;continue;}
      const d=Math.hypot(this.staggerAt[i].x-this.legAnkles[i].x,this.staggerAt[i].z-this.legAnkles[i].z);
      if(d>most){most=d;far=i;}
    }
    // One foot in the air at a time: while the push lasts, the one the body
    // has left furthest behind, once it is STEP_REACH behind where the clip
    // has it; once it is spent, one left out of place steps home.
    const gather=!stepping&&this.staggerGathered<STEP_GATHER&&most>STEP_SETTLE;
    if(!swinging&&far>=0&&(stepping&&most>STEP_REACH||gather)){
      this.staggerSwing[far]=0;this.staggerFrom[far].copy(this.staggerAt[far]);swinging=true;
      if(!stepping)this.staggerGathered++;
    }
    const holding=stepping||swinging||gather;
    this.staggerWeight=THREE.MathUtils.clamp(this.staggerWeight+(holding?real/STEP_IN:-real/STEP_FADE),0,1);
    for(let i=0;i<n;i++){
      const target=this.staggerTarget[i],clip=this.legAnkles[i];
      if(this.staggerSwing[i]<0){target.set(this.staggerAt[i].x,clip.y,this.staggerAt[i].z);continue;}
      this.staggerSwing[i]+=real;
      const u=Math.min(1,this.staggerSwing[i]/STEP_TIME),e=u*u*(3-2*u);
      // Toward where the clip has the foot a little way on, the body still
      // travelling; lifted over the floor on the way.
      target.set(clip.x+vx*STEP_LEAD*(1-e),clip.y,clip.z+vz*STEP_LEAD*(1-e));
      target.x=this.staggerFrom[i].x+(target.x-this.staggerFrom[i].x)*e;target.z=this.staggerFrom[i].z+(target.z-this.staggerFrom[i].z)*e;
      target.y+=STEP_LIFT*Math.sin(Math.PI*u);
      if(u>=1){
        this.staggerAt[i].copy(target);this.staggerSwing[i]=-1;
        // A foot coming down: the scrape and the dust the planter's steps get.
        const speed=Math.hypot(vx,vz);
        if(speed>STEP_AUDIBLE){this.steps.push({x:target.x,y:this.groundY,z:target.z,speed});if(this.steps.length>4)this.steps.shift();}
      }
    }
    if(state.action==='guard'||!state.grounded)this.staggerWeight=0;
  }

  /** Take back what an interrupted stretch left, eased; see rubberLimbs. */
  private releaseRubber(real:number){
    if(this.rubberRelease<0)return;
    // Eased rather than sprung: a hit cutting the swing short owns that
    // frame's snap already, and the arm is taken back under it.
    this.rubberRelease+=real;
    const x=1-THREE.MathUtils.smoothstep(this.rubberRelease,0,RUBBER.release);
    if(this.rubberRelease>RUBBER.release){this.rubberRelease=-1;return;}
    this.group.updateMatrixWorld(true);
    if(this.pelvis?.parent&&this.rubberGive.lengthSq()>1e-8){
      this.pelvis.getWorldPosition(_rubberPelvis).addScaledVector(this.rubberGive,x);
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_rubberPelvis));
      this.pelvis.updateMatrixWorld(true);
    }
    for(let which=0;which<2;which++){
      const hand=this.joints.get(HAND_SIDES[which]+'Hand'),offset=this.rubberOffset[which];
      if(!hand?.parent||offset.lengthSq()<1e-8)continue;
      hand.getWorldPosition(_rubberWrist).addScaledVector(offset,x);
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(_rubberWrist)));
      hand.updateMatrixWorld(true);
    }
  }
  /** Round 5 (GUMMY): the Rogue Wave's wind-up (PALMS_WIND): each hand drawn out behind him down its own forearm, as far as
   *  that forearm points backward, trembling while it is held. Kept as the stretch's offset, so a swing cut short lets
   *  it go on the same recoil as any other. */
  private palmsWindBack(elapsed:number,plan:[string,number][],real:number,wound:{back:number;rise:readonly [number,number];shake:number;rate:number}=PALMS_WIND){
    const grow=THREE.MathUtils.smoothstep(elapsed,wound.rise[0],wound.rise[1]);
    if(grow<1e-3){this.releaseRubber(real);return;}
    this.group.updateMatrixWorld(true);
    _palmsFacing.set(Math.sin(this.facing),0,Math.cos(this.facing));
    this.rubberEpoch=this.actionEpoch;this.rubberRelease=-1;this.rubberGive.set(0,0,0);
    const held=THREE.MathUtils.smoothstep(elapsed,wound.rise[1]-.04,wound.rise[1]+.04);
    for(const [side] of plan){
      const fore=this.joints.get(side+'ForeArm'),hand=this.joints.get(side+'Hand'),which=side==='Right'?0:1;
      if(!fore||!hand?.parent)continue;
      const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
      const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)continue;
      const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
      const backward=THREE.MathUtils.clamp(-along.dot(_palmsFacing)*1.4,0,1);
      const shake=Math.sin(elapsed*wound.rate*2*Math.PI+which*1.9)*wound.shake*held;
      const extend=(grow*wound.back*forearm+shake)*backward;
      wrist.addScaledVector(along,extend);
      this.rubberOffset[which].copy(along).multiplyScalar(extend);
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
      hand.updateMatrixWorld(true);
      this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(_rubberElbow).distanceTo(wrist)/forearm);
    }
  }
  /** Round 4b (GUMMY): the Gatling's real fists; see GATLING. */
  private gatlingStretch(state:PlayerState){
    const move=this.moveFor(state),contacts=move.contacts,elapsed=state.actionTime*state.actionDuration;
    this.group.updateMatrixWorld(true);
    const other=this.opponentBody(),surface=other?TORSO_RADIUS[other.state.fighter]+RUBBER_KNUCKLES:RUBBER.surface;
    const target=other?other.restCenter(_rubberTarget):this.targetPoint?_rubberTarget.copy(this.targetPoint).addScaledVector(UP,-.2)
      :_rubberTarget.set(Math.sin(this.facing),0,Math.cos(this.facing)).multiplyScalar(GATLING.ahead).add(this.group.position).addScaledVector(UP,1.2);
    for(let which=0;which<2;which++){
      // The right throws contacts 0, 2, 4...; the left 1, 3, 5... Their windows never overlap one hand's next.
      let reach=0;
      for(let i=which;i<contacts.length;i+=2){
        const u=elapsed-(contacts[i]-GATLING.out);
        if(u<0)break;
        if(u<GATLING.out){const v=u/GATLING.out;reach=1-(1-v)*(1-v)*(1-v);break;}
        if(u<GATLING.out+GATLING.hold){reach=1;break;}
        if(u<GATLING.out+GATLING.hold+GATLING.back){const v=(u-GATLING.out-GATLING.hold)/GATLING.back;reach=1-v*v*(3-2*v);break;}
      }
      if(reach<1e-3)continue;
      const side=HAND_SIDES[which],fore=this.joints.get(side+'ForeArm'),hand=this.joints.get(side+'Hand');
      if(!fore||!hand?.parent)continue;
      const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
      const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)continue;
      const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
      const toward=_rubberToward.subVectors(target,wrist),distance=toward.length();
      if(distance>1e-3)toward.divideScalar(distance);else toward.copy(along);
      const angle=Math.min(GATLING.aim,along.angleTo(toward)),axis=_rubberAxis.crossVectors(along,toward);
      if(axis.lengthSq()<1e-10)axis.copy(UP);
      const dir=angle>1e-4?_rubberDir.copy(along).applyQuaternion(_rubberTurn.setFromAxisAngle(axis.normalize(),angle)):_rubberDir.copy(along);
      wrist.addScaledVector(dir,THREE.MathUtils.clamp(distance-surface,GATLING.min,move.range)*reach);
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
      hand.updateMatrixWorld(true);
      this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(elbow).distanceTo(wrist)/forearm);
    }
  }
  /** Round 6 (GUMMY ULT): where the grab is held - the middle of the body it closed on, and that body's skin (its
   *  torso's radius) - kept from the frame it last followed them: a whiff closes on where they stood on the contact. */
  private grabAt=new THREE.Vector3();private grabSurface=0;private grabCast=-1;private grabHeld=false;
  /** Round 6 (GUMMY ULT): SUNRISE's grab, the GRAND TIDE's opener (gummy/grand-tide.ts GRAND_TIDE_GRAB, grandTideGrab). The
   *  take whips his right arm straight out of the crouch onto the blow (gummy-r5-g5moves1.glb 'Grand Tide Open'); from
   *  its forearm the hand shoots out to the body it is thrown at - the forearm stretched behind it, as the Gatling's
   *  are - turned off the forearm's line by no more than GRAND_TIDE_GRAB.aim, to that body's skin and GRAND_TIDE_GRAB.grip
   *  into it, as far as the move reaches (moves.ts ULTIMATES.gummy). Only once the arm has come through: a forearm
   *  still drawn back stretches nothing (as the Rogue Wave's palms wait for theirs). Held on them - the cinematic holds
   *  them where it caught them - and let go on RUBBER's recoil; for a whiff, closed on the air where they stood. Gummy
   *  alone (rubberLimbs), on whichever of his bodies is drawn. */
  private grandTideGrabStretch(state:PlayerState){
    const move=this.moveFor(state),phase=grandTideGrab(state,move.contacts[0]),G=GRAND_TIDE_GRAB;
    if(this.grabCast!==state.actionStarted){this.grabCast=state.actionStarted;this.grabHeld=false;}
    if(phase.reach===undefined&&(phase.back===undefined||phase.back>.4))return;
    this.group.updateMatrixWorld(true);
    const fore=this.joints.get('RightForeArm'),hand=this.joints.get('RightHand');
    if(!fore||!hand?.parent)return;
    const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
    const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)return;
    const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
    if(phase.follow||!this.grabHeld){
      const other=this.opponentBody();
      if(other){other.restCenter(this.grabAt);this.grabSurface=TORSO_RADIUS[other.state.fighter]??RUBBER.surface;}
      else if(this.targetPoint??this.owner?.targetPoint){this.grabAt.copy((this.targetPoint??this.owner!.targetPoint)!).addScaledVector(UP,-.2);this.grabSurface=RUBBER.surface;}
      else{this.group.getWorldPosition(this.grabAt).addScaledVector(this.group.getWorldDirection(_grabForward).setY(0).normalize(),G.ahead).addScaledVector(UP,1.2);this.grabSurface=0;}
      this.grabHeld=true;
    }
    const toward=_rubberToward.subVectors(this.grabAt,wrist),distance=toward.length();
    if(distance>1e-3)toward.divideScalar(distance);else toward.copy(along);
    const angle=Math.min(G.aim,along.angleTo(toward)),axis=_rubberAxis.crossVectors(along,toward);
    if(axis.lengthSq()<1e-10)axis.copy(UP);
    const dir=angle>1e-4?_rubberDir.copy(along).applyQuaternion(_rubberTurn.setFromAxisAngle(axis.normalize(),angle)):_rubberDir.copy(along);
    // Forward of him: the arm has come through (a drawn-back forearm points behind his facing). In the world's frame:
    // SUNRISE's body is drawn inside his, facing its own way only as his group does.
    const facing=this.group.getWorldDirection(_grabForward).setY(0).normalize();
    const ahead=THREE.MathUtils.smoothstep(along.dot(facing),-.1,.6);
    const full=THREE.MathUtils.clamp(distance-this.grabSurface+G.grip,G.min,move.range);
    let extend=full*(phase.reach!==undefined?phase.reach*ahead:Fighter.rubberRecoil(phase.back!));
    if(extend<0)extend=-RUBBER.squash*Math.tanh(-extend/RUBBER.squash);
    wrist.addScaledVector(dir,extend);
    hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
    hand.updateMatrixWorld(true);
    this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(elbow).distanceTo(wrist)/forearm);
  }
  /** Which RUBBER_HANDS plan a move stretches by: a rush stage's, a slot's - or a combo ender's own (`ender-<key>`): an
   *  ender is a move of its own, and a kick or a stamp does not throw a fist. */
  private rubberKey(state:PlayerState){
    const ender=Fighter.ender(state);
    return ender?'ender-'+ender:state.action+this.rushStage(state);
  }
  /** The Rubber stretch, on either body - SUNRISE is as rubber as he is (round 4b: its forearms are skinned for it,
   *  scripts/build_gummy_daybreak.py); see RUBBER, and GATLING for the Gatling's fists. */
  private rubberLimbs(state:PlayerState,real=0){
    this.rubberSpan=0;
    if(state.fighter!=='gummy'||!this.dynamics)return;
    if(this.swap){this.releaseRubber(real);return;}
    const gatling=state.action==='special'&&!Fighter.ender(state)&&state.actionDuration>0;
    // A stretch the move did not finish - a hit cut the swing short, the
    // next stage began - comes back on the same rubbery recoil from wherever
    // it was, rather than in one frame: measured, a Rogue Wave cut short at
    // its blow put the fist back 0.8 m between two frames.
    const stretching=!gatling&&ATTACK_SLOTS.has(state.action)&&!!RUBBER_HANDS[this.rubberKey(state)];
    if(this.rubberEpoch>=0&&(!stretching||this.rubberEpoch!==this.actionEpoch)){this.rubberEpoch=-1;this.rubberRelease=0;}
    if(!stretching){this.releaseRubber(real);}
    if(gatling){this.gatlingStretch(state);return;}
    // Round 6 (GUMMY ULT): the GRAND TIDE's opener is SUNRISE's grab (gummy/grand-tide.ts), its own stretch.
    if(state.action==='ultimate'){this.grandTideGrabStretch(state);if(LUCY_TIDE){const other=this.opponentBody();this.rubberSpan=Math.max(this.rubberSpan,tideHammer(state,this.joints,this.group,other?other.restCenter(_tideVictim):undefined));}return;}
    const elapsed=state.actionTime*state.actionDuration;
    const plan=ATTACK_SLOTS.has(state.action)?RUBBER_HANDS[this.rubberKey(state)]:undefined;
    if(!plan||!state.actionDuration)return;
    const move=this.moveFor(state),contact=move.contacts[0];
    // Round 5 (GUMMY): the Rogue Wave snaps out on its own beat, from arms already drawn out behind him (PALMS_WIND).
    const palms=state.action==='heavy'&&!Fighter.ender(state)&&state.grounded;
    // The Dust Sea pass: the jab and the leaping straight are wound up the same way (JAB_WIND), on his own body.
    const stage=state.action==='light'?this.rushStage(state):-1;
    const jab=!this.isForm&&!Fighter.ender(state)&&(stage===0&&state.grounded||stage===3);
    const wound=palms?PALMS_WIND:jab?JAB_WIND:undefined;
    const OUT=wound?wound.out:RUBBER.out,HOLD=palms?PALMS_WIND.hold:RUBBER.hold;
    const u=elapsed-(contact-OUT);
    if(wound&&u<=0){this.rubberLocked[0]=this.rubberLocked[1]=false;this.rubberGiven=0;this.palmsWindBack(elapsed,plan,real,wound);return;}
    if(u<=0||u>OUT+HOLD+.4){this.rubberLocked[0]=this.rubberLocked[1]=false;this.rubberGiven=0;this.releaseRubber(real);return;}
    // A new stretch: whatever an old one left is its to override.
    this.rubberEpoch=this.actionEpoch;this.rubberRelease=-1;this.rubberGive.set(0,0,0);this.rubberOffset[0].set(0,0,0);this.rubberOffset[1].set(0,0,0);
    // Out, a beat on the blow, then back through the overshoot.
    let reach:number;
    if(u<OUT){const v=u/OUT;reach=1-(1-v)*(1-v)*(1-v);}
    else if(u<OUT+HOLD)reach=1;
    else reach=Fighter.rubberRecoil(u-OUT-HOLD);
    // Where it is thrown at: the opponent's drawn body, or ahead.
    this.group.updateMatrixWorld(true);
    // Measured where the body would be drawn without its contact push, so the
    // fist does not chase a body its own blow is pushing (see TORSO_RADIUS);
    // and to that body's own skin, with the fist's knuckles outside it.
    const other=this.opponentBody(),surface=other?TORSO_RADIUS[other.state.fighter]+RUBBER_KNUCKLES:RUBBER.surface;
    const target=other?other.restCenter(_rubberTarget):this.targetPoint?_rubberTarget.copy(this.targetPoint).addScaledVector(UP,-.2)
      :_rubberTarget.set(Math.sin(this.facing),0,Math.cos(this.facing)).multiplyScalar(3).add(this.group.position).addScaledVector(UP,1.2);
    // A mirrored stage throws with the other hand.
    const mirrored=!!this.active&&!!mirrorSource(this.active.getClip());
    // Round 5 (GUMMY): the Rogue Wave's two palms land side by side, each a little to its own side of the body's middle.
    if(wound)_palmsFacing.set(Math.sin(this.facing),0,Math.cos(this.facing));
    if(palms){
      const r=this.joints.get('RightArm'),l=this.joints.get('LeftArm');
      if(r&&l){r.getWorldPosition(_palmsSide);l.getWorldPosition(_palmsShoulder);_palmsSide.sub(_palmsShoulder).setY(0);if(_palmsSide.lengthSq()>1e-8)_palmsSide.normalize();}
    }
    let first=true;
    for(const [side,share] of plan){
      const name=mirrored?(side==='Right'?'Left':'Right'):side;
      const fore=this.joints.get(name+'ForeArm'),hand=this.joints.get(name+'Hand');
      if(!fore||!hand||!hand.parent)continue;
      const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
      const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)continue;
      const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
      const aim=palms?_palmsTarget.copy(target).addScaledVector(_palmsSide,(name==='Right'?.5:-.5)*PALMS_WIND.apart):target;
      const toward=_rubberToward.subVectors(aim,wrist);
      const distance=toward.length();
      if(distance>1e-3)toward.divideScalar(distance);else toward.copy(along);
      // Turned from the forearm's own line toward the target as it goes out,
      // no further than AIM; once the fist has arrived the line is kept, so
      // the clip's follow-through does not sweep a stretched arm around.
      const out=u<OUT,which=name==='Right'?0:1;
      let dir:THREE.Vector3;
      if(out||!this.rubberLocked[which]){
        const angle=Math.min(RUBBER.aim,along.angleTo(toward))*Math.max(0,Math.min(1,reach));
        dir=angle>1e-4?_rubberDir.copy(along).applyQuaternion(_rubberTurn.setFromAxisAngle(_rubberAxis.crossVectors(along,toward).normalize(),angle)):_rubberDir.copy(along);
        // (Round 5: the Rogue Wave's line is kept only once its arm has come through.)
        this.rubberLine[which].copy(dir);this.rubberLocked[which]=!out&&(!wound||along.dot(_palmsFacing)>.2);
      }else dir=_rubberDir.copy(this.rubberLine[which]);
      // To the surface of the body it is thrown at, within MIN and MAX.
      const gap=Math.max(0,distance-surface);
      let length=THREE.MathUtils.clamp(gap,RUBBER.min*forearm,RUBBER.max*forearm);
      // Accent: the body gives a little, the rest of the stretch goes.
      if(first&&length>gap&&this.pelvis?.parent){
        // The fist shoots out on the stretch's ease-out, fastest on its first
        // frame; the body's weight goes back on a smooth rise instead (round
        // 3c): riding the fist's curve, half the give arrived in one frame and
        // Gummy's hips jumped 16 cm back as a stretch began.
        const lean=u<RUBBER.out?THREE.MathUtils.smoothstep(u/RUBBER.out,0,1):reach;
        // Round 3d (PACE): and it is eased toward, no faster than the whole
        // give over the stretch's own time. It only starts once the body is
        // inside the stretch's shortest reach, and the quicker lunges put
        // that late in the stretch, with the lean already whole: Gummy's
        // hips went 0.2 m back in a frame as his Stamp landed.
        const want=Math.min(RUBBER.pull,length-gap)*Math.max(0,Math.min(1,lean)),rate=RUBBER.pull/RUBBER.out*real;
        this.rubberGiven+=THREE.MathUtils.clamp(want-this.rubberGiven,-rate,rate);
        const give=this.rubberGiven;
        this.rubberGive.copy(_rubberBack.set(dir.x,0,dir.z).normalize()).multiplyScalar(-give);
        this.pelvis.getWorldPosition(_rubberPelvis).add(this.rubberGive);
        this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_rubberPelvis));
        this.pelvis.updateMatrixWorld(true);
        length=Math.min(length,gap+Math.min(RUBBER.pull,length-gap));
        hand.getWorldPosition(wrist);
      }
      first=false;
      // Round 5 (GUMMY): the Rogue Wave's palms go out as its arms come through - drawn on the 'twos', the take swings them
      // inside the stretch's own first frames - and an arm still behind him keeps the wind-up's stretch down its line.
      const ahead=wound?along.dot(_palmsFacing):1;
      let extend=length*reach*share*(wound?THREE.MathUtils.smoothstep(ahead,-.15,.55):1);
      // The overshoot squashes the arm, softly and only so far.
      if(extend<0)extend=-RUBBER.squash*Math.tanh(-extend/RUBBER.squash);
      wrist.addScaledVector(dir,extend);
      this.rubberOffset[which].copy(dir).multiplyScalar(extend);
      if(wound&&ahead<0&&u<OUT+HOLD){const back=wound.back*forearm*THREE.MathUtils.clamp(-ahead*1.4,0,1);wrist.addScaledVector(along,back);this.rubberOffset[which].addScaledVector(along,back);}
      // worldToLocal converts in place: on a copy, the wrist is measured below.
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
      hand.updateMatrixWorld(true);
      this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(elbow).distanceTo(wrist)/forearm);
    }
  }

  private aimHead(dt:number,state:PlayerState){
    const head=this.headBone;
    if(!head)return;
    const wanted=this.targetPoint&&state.alive&&Fighter.AIM_STATES.includes(state.action)?1:0;
    this.aimWeight=dt>0?THREE.MathUtils.lerp(this.aimWeight,wanted,1-Math.exp(-dt*7)):this.aimWeight;
    if(this.aimWeight<.002||!this.targetPoint)return;
    const local=this.group.worldToLocal(_aimTarget.copy(this.targetPoint));
    const origin=this.group.worldToLocal(head.getWorldPosition(_aimOrigin));
    const direction=local.sub(origin);
    if(direction.lengthSq()<1e-6)return;
    direction.normalize();
    // Clamp in the fighter's own frame: a neck cannot outrun the shoulders.
    const wantYaw=THREE.MathUtils.clamp(Math.atan2(direction.x,direction.z),-AIM_YAW,AIM_YAW);
    const wantPitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(direction.y,-1,1)),-AIM_PITCH,AIM_PITCH);
    // And a neck turns at a speed a neck turns at. The clamp above flips sign
    // the frame an opponent passes from one side of "behind" to the other,
    // and on a run reversal that was a hundred-degree head snap in one
    // frame - the largest single joint step in the whole locomotion set.
    // The gaze eases toward what it wants and never faster than AIM_RATE.
    const most=AIM_RATE*Math.max(dt,0);
    this.aimYaw+=THREE.MathUtils.clamp((wantYaw-this.aimYaw)*(1-Math.exp(-dt*14)),-most,most);
    this.aimPitch+=THREE.MathUtils.clamp((wantPitch-this.aimPitch)*(1-Math.exp(-dt*14)),-most,most);
    const yaw=this.aimYaw,pitch=this.aimPitch;
    _aimDirection.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    _aimSwing.setFromUnitVectors(FORWARD,_aimDirection);
    const groupQuaternion=this.group.getWorldQuaternion(_aimGroup);
    for(const [bone,share] of (this.neckBone?[[this.neckBone,.35],[head,.65]]:[[head,1]]) as readonly (readonly [THREE.Bone|undefined,number])[]){
      if(!bone||!bone.parent)continue;
      _aimShare.identity().slerp(_aimSwing,share*this.aimWeight);
      // Group space to world, then into the bone's parent frame.
      _aimWorld.copy(groupQuaternion).multiply(_aimShare).multiply(_aimInverse.copy(groupQuaternion).invert());
      // Rotating a bone about its own head by a world rotation R gives
      // newLocal = parent^-1 * R * parent * oldLocal.
      bone.parent.getWorldQuaternion(_aimParent);
      _aimParentInverse.copy(_aimParent).invert();
      _aimLocal.copy(_aimParentInverse).multiply(_aimWorld).multiply(_aimParent).multiply(bone.quaternion);
      bone.quaternion.copy(_aimLocal);
      bone.updateMatrix();
      bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
    }
  }
  /**
   * A sword does not move in the hand that is holding it.
   *
   * Nigo carries HAIZAN on a bone whose *rest* offset puts it 0.99 m up
   * from his right hand, and every clip he was authored with carries a
   * translation that brings it back to 0.07. A retarget writes rotations, so
   * a donated clip leaves that bone at rest - and the blade floats a metre
   * off his hand for the whole of `Run`, `down_lp`, `down_end`, `shake` and
   * `stun`. Running is where it shows, because running is the donated clip he
   * spends the most time in.
   *
   * Cutting five clips per fighter again would fix those five. This fixes the
   * class: whatever the fighter's own idle does with a bone he is holding is
   * what every other clip does with it.
   *
   * Only when the clip has put it a long way off. A clip that moves a prop a
   * little is choreography - a grip shifting, a blade turning in the hand -
   * and is left alone; nothing authored moves a held prop a quarter of a
   * metre, and nothing that does is doing it on purpose.
   */
  private findHeldEquipment(idle:THREE.AnimationClip|undefined){
    if(!idle)return;
    const hands=[this.joints.get('LeftHand'),this.joints.get('RightHand')].filter(Boolean) as THREE.Object3D[];
    if(!hands.length)return;
    const carried=new Set<THREE.Object3D>();
    for(const hand of hands)hand.traverse(node=>{if(node!==hand)carried.add(node);});
    if(!carried.size)return;
    // Only bones something is actually drawn on. A rig also carries IK
    // helpers and targets, and where those go is nobody's business.
    const skinned=new Set<THREE.Object3D>();
    this.model.traverse(object=>{
      const skin=object as THREE.SkinnedMesh;
      if(!skin.isSkinnedMesh)return;
      const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight;
      if(!ids||!weights)return;
      for(let i=0;i<ids.count;i++)for(let j=0;j<4;j++){
        if(weights.getComponent(i,j)<=.1)continue;
        const bone=skin.skeleton.bones[ids.getComponent(i,j)];
        if(bone&&carried.has(bone))skinned.add(bone);
      }
    });
    for(const track of this.samplersFor(idle)){
      if(track.property!=='position'||!skinned.has(track.node))continue;
      const value=track.interpolant.evaluate(0) as unknown as number[];
      this.heldPins.push({node:track.node,position:new THREE.Vector3(value[0],value[1],value[2])});
    }
  }
  private pinHeldEquipment(){
    for(const pin of this.heldPins){
      // The blade rows deliberately release the native blade. Preserve that one
      // authored drop; ordinary held equipment still follows its grip.
      if(this.state.fighter==='shidare'&&this.state.action==='awaken'&&pin.node.name==='Sword')continue;
      if(pin.node.position.distanceToSquared(pin.position)>HELD_SLACK*HELD_SLACK)pin.node.position.copy(pin.position);
    }
  }

  /** Hand a dead body to physics, and take it back when he respawns.
   *
   *  The authored death - a slam into the downed pose - is still what plays
   *  when Rapier has not loaded, and is still what a knockdown uses, because a
   *  knockdown has to end in a pose the get-up can start from. A death has no
   *  such obligation: nothing after it depends on where the body lies. */
  private driveRagdoll(state:PlayerState,real:number){
    const dying=state.action==='defeated'||!state.alive;
    if(!dying){
      if(this.ragdoll){this.ragdoll.dispose();this.ragdoll=undefined;this.lastWorldAt=-1;}
      this.deathSettle=0;this.deathClock=0;
      return;
    }
    if(!this.ragdoll){
      if(!ragdollsReady())return;
      // Built from the pose being drawn this frame, so the first physics frame
      // is the animation's last one and there is nothing to blend.
      this.group.updateMatrixWorld(true);
      const floor=state.grounded?this.group.position.y:0;
      const doll=new Ragdoll(this.joints,this.deathVelocity,floor);
      if(!doll.built){doll.dispose();return;}
      this.ragdoll=doll;
    }
    const step=state.timeStopped||state.hitstop?0:real;
    this.ragdoll.update(step);
    this.deathClock+=step;
    // The fall is physics; the lying there is authored. Once the body has
    // come to rest - or after four seconds whatever it is doing - the limbs
    // ease onto the downed clip over most of a second. Only rotations, and
    // never the root: where the corpse fell and which way up is the fall's
    // to decide.
    if(this.deathClock>1.2&&this.ragdoll.restless()<.6||this.deathClock>4)this.deathSettle=Math.min(1,this.deathSettle+step/.7);
    if(this.deathSettle>0){
      const downed=this.clip('reaction downed');
      if(downed){
        const weight=this.deathSettle*this.deathSettle*(3-2*this.deathSettle);
        for(const track of this.samplersFor(downed)){
          if(track.property!=='quaternion'||track.node===this.rootBone||!this.bodyJointSet.has(track.node as THREE.Object3D))continue;
          _blendTarget.fromArray(track.interpolant.evaluate(0) as unknown as number[]);
          (track.node as THREE.Object3D).quaternion.slerp(_blendTarget,weight);
        }
      }
    }
  }
  /** How far the corpse has been tidied into its downed pose, for the tests. */
  get settledDead(){return this.deathSettle;}

  motionEvidence(){const relative=(b:THREE.Object3D|undefined)=>b?this.group.worldToLocal(b.getWorldPosition(new THREE.Vector3())).toArray():null;return {model:this.isForm?FIGHTERS[this.state.fighter].formModel:this.outfit?.model??FIGHTERS[this.state.fighter].model,modelVisible:this.model.visible,formVisible:this.awakenedForm?.group.visible??false,formClip:this.awakenedForm?.active?.getClip().name,formClipTime:this.awakenedForm?.active?.time,formSpeed:this.awakenedForm?.locomotionSpeed,formLift:Number(this.formLiftDrawn.toFixed(3)),formHover:this.awakenedForm?Number(this.formHover.toFixed(3)):undefined,formOffset:this.awakenedForm?Number(this.awakenedForm.group.position.y.toFixed(3)):undefined,formSole:this.awakenedForm?.group.visible?Number((this.formSole()??NaN).toFixed(3)):undefined,action:this.state.action,elapsed:this.state.actionTime*this.state.actionDuration,duration:this.state.actionDuration,clip:this.active?.getClip().name,clipTime:this.active?.time,clipRate:this.active?.timeScale,soleGap:Number(this.soleGap.toFixed(4)),springBones:this.secondary?.boneCount??0,springSwing:this.secondary?.swingDegrees??0,aim:Number(this.aimWeight.toFixed(3)),rootOffset:Number(this.rootOffset.toFixed(3)),hold:Number(this.chargeHold.toFixed(3)),life:Number(this.holdWeight.toFixed(3)),rubber:Number(this.rubberSpan.toFixed(3)),handR:relative(this.rightBone),head:relative(this.headBone),drawn:[Number(this.group.position.x.toFixed(3)),Number(this.group.position.z.toFixed(3))],blend:this.blendDuration>0?Number(Math.min(1,this.blendTime/this.blendDuration).toFixed(3)):undefined};}
  /** Cosmetic hovering protects the authored lower body, not simulation movement. */
  private authoredHover(state:PlayerState):boolean {return state.fighter==='torsion'&&torsionAuthoredHover(this.active?.getClip().name);}
  /** A native kneeling smash uses its legs to place the knuckles on the
   * floor. Walking/ankle IK would fold the rear leg through the stage, then
   * support would lift the entire strike away from its intended contact. */
  private authoredFloorStrike(state:PlayerState):boolean {
    if(!state.grounded||!ATTACK_SLOTS.has(state.action))return false;
    if(state.fighter==='shibuichi')return shibuichiAuthoredGround(this.active?.getClip().name??'',this.active?.time??0);
    if(state.fighter==='shakudo')return shakudoAuthoredGround(this.active?.getClip().name);
    if(state.fighter!=='ume')return false;
    const clip=this.active?.getClip().name;
    return clip==='Magnolia Heel'||clip==='Shattering Blossom'||clip==='Aerial Blossom'||clip==='Bloomfall'||clip==='Magnolia Meteor';
  }
  /** Native contact steps own their foot support; a stride overlay would erase their plant. */
  private authoredStep(state:PlayerState):boolean {
    if(!state.grounded||!ATTACK_SLOTS.has(state.action))return false;
    if(state.fighter==='murex')return (this.active?.getClip().name==='Rush 1'&&(this.active?.time??0)>.005&&(this.active?.time??0)<.463)||(this.active?.getClip().name==='Spine Breaker'&&(this.active?.time??0)>.02&&(this.active?.time??0)<.85);
    if(state.fighter==='madake')return madakeAuthoredRushStep(this.active?.getClip().name??'',this.active?.time??0);
    if(state.fighter==='hagure')return hagureAuthoredContactStep(this.active?.getClip().name,this.active?.time??0,this.isForm)>0;
    if(state.fighter==='shibuichi')return shibuichiAuthoredShoulderStep(this.active?.getClip().name??'',this.active?.time??0);
    if(state.fighter==='rakucho')return rakuchoAuthoredJabStep(this.active?.getClip().name??'',this.active?.time??0);
    return this.mizuhikiCarry(state);
  }
  /** Mizuhiki's contact carry (`mizuhikiAuthoredContactCarry`): each attack clip of her body file steps half a metre forward by
   *  itself, and through its strike that step is let through whole and the legs left as keyed. Since 13 October 2026 her
   *  three cut lights and her heavy are Levin's takes under the same names (scripts/night/anim/picks.json), thrown from
   *  planted feet with no step of their own, so a lunge slid her across the floor in one pose. For those four the carry
   *  holds only where the clip playing does step itself: the body file's own, which tests/mizuhikiSharedIntegration.test.ts
   *  still measures to the blade's edge. A take without a step is stepped by the stride every other body gets, as Levin's
   *  own is. `Rush 2` (the kick), the special, the ultimate and the enders keep the carry as it was. */
  private static readonly MIZUHIKI_STRIDE_TAKES:ReadonlySet<string>=new Set(['Strand Cut','Rush 1','Rush 3','Cross Splice']);
  private static readonly stepped=new WeakMap<THREE.AnimationClip,boolean>();
  private mizuhikiCarry(state:PlayerState):boolean{
    const clip=this.active?.getClip();
    if(state.fighter!=='mizuhiki'||!clip||!(mizuhikiAuthoredContactCarry(clip.name,this.active?.time??0)>0))return false;
    return !Fighter.MIZUHIKI_STRIDE_TAKES.has(clip.name)||this.stepsItself(clip);
  }
  /** Whether a clip carries its own step: its root keyed more than 0.3 m ahead of where it starts (her rig is in metres;
   *  her body file's attack clips each go 0.50 m, Levin's takes on her 0 to 0.14). Read once a clip. */
  private stepsItself(clip:THREE.AnimationClip):boolean{
    let stepped=Fighter.stepped.get(clip);
    if(stepped===undefined){
      const values=this.rootBone?clip.tracks.find(track=>track.name===`${this.rootBone!.name}.position`)?.values:undefined;
      let ahead=0;
      if(values)for(let i=0;i<values.length;i+=3)ahead=Math.max(ahead,values[i+2]-values[2]);
      Fighter.stepped.set(clip,stepped=ahead>.3);
    }
    return stepped;
  }
  /** Preserve the actual striking leg through lunge and support layers. */
  private authoredKick(state:PlayerState):boolean {
    if(!ATTACK_SLOTS.has(state.action))return false;
    if(originalAuthoredKick(state.fighter,this.active?.getClip().name))return true;
    if(state.fighter==='kosho')return true;
    if(state.fighter==='rotfalke'){const clip=this.active?.getClip();return !!clip&&rotfalkeAuthoredKick(clip.name,(this.active?.time??0)/Math.max(1e-6,clip.duration));}
    if(state.fighter==='madake')return madakeAuthoredKick(this.active?.getClip().name??'');
    if(state.fighter==='shibuichi')return shibuichiAuthoredKick(this.active?.getClip().name??'');
    if(state.fighter==='shakudo')return shakudoAuthoredKick(this.active?.getClip().name);
    if(state.fighter==='tokan')return tokanStrikeJoint(state.action,this.active?.time,this.active?.getClip().name)==='LeftFoot';
    if(state.fighter==='strappado')return strappadoAuthoredKick(this.active?.getClip().name);
    if(state.fighter==='barrow')return barrowAuthoredKick(this.active?.getClip().name,this.outfitId??state.outfit,this.active?.time??0);
    if(state.fighter==='kusushi')return kusushiAuthoredKick(state.action,this.active?.time??0,this.active?.getClip().name);
    if(state.fighter==='senko')return senkoAuthoredKick(this.active?.getClip().name,this.active?.time??0);
    // Ampere's kicks (launch day, the rig audit: "at the frame it lands the leg is still chambered"): his heavy, his fourth
    // light and two enders are kicks thrown out of a lunge, and the stride mixed into a lunging body's legs until the blow
    // lands folded the kicking leg at the very frame of contact (the measure: the knee bent 75 degrees and the boot 8 cm off
    // the floor where the clip has the leg straight at chest height); the kick only showed in the follow-through.
    if(state.fighter==='ampere'){const clip=this.active?.getClip().name;return clip==='Cape Wrath Kick'||clip==='Rush 3'||clip==='Good Hope Drop'||clip==='Lineman\'s Kick';}
    if(state.fighter!=='mikage')return false;
    const clip=this.active?.getClip().name;
    return clip==='Pounce Heel'||clip==='Aerial Pounce Heel'||clip==='Rush 3'||clip==='Tailwhip Heel';
  }
  /** Visual companion only. Simulation still owns every damage receipt. */
  spiritSource?:Fighter;
  private shakudoBlade?:THREE.Object3D;
  private selectShakudoBlade(state:PlayerState){
    if(state.fighter!=='shakudo')return;
    this.shakudoBlade??=this.model.getObjectByName('shakudo_steel_limb_blade');
    if(this.shakudoBlade)this.shakudoBlade.visible=shakudoBladeVisible(this.active?.getClip().name??'_Idle',this.active?.time??0,state.awakened);
  }
  private highsunSunhammer?:THREE.Object3D;
  private selectHighsunSunhammer(state:PlayerState){
    if(state.fighter!=='highsun')return;
    this.highsunSunhammer??=this.model.getObjectByName('Highsun_Sunhammer');
    if(this.highsunSunhammer)this.highsunSunhammer.visible=highsunSunhammerVisible(state.action,state.action==='awaken'?state.actionTime*state.actionDuration:this.active?.time??0,this.active?.getClip().name);
  }
  /** Engine VOL.7, step five: what a socket declaration (src/engine/client/sockets.ts) reads of this body, filled
   *  for each ask - one object a body, since the effects ask every frame. */
  private socketAsk?:SocketAsk;
  /** Where this fighter's `kind` socket is now, as its declaration (src/engine/client/sockets.ts) places it - its blades'
   *  tips, the hand or foot each blow lands with, where its charges gather - in `out`; false where it declares none. */
  private socket(kind:SocketKind,out:THREE.Vector3,index?:number){
    if(!FIGHTER_SOCKETS[this.state.fighter])return false;
    const ask=this.socketAsk??=socketAsk(this,()=>this.moveFor(this.state).contacts,Fighter.ender);
    const shown=this.shownBody,active=this.active,drawn=shown.active;
    ask.shown=shown;ask.state=this.state;ask.index=index;ask.form=this.isForm;ask.shownForm=shown.isForm;
    ask.clip=active?.getClip().name;ask.time=active?.time;ask.phase=active?active.time/active.getClip().duration:0;
    ask.shownClip=drawn?.getClip().name;ask.shownTime=drawn?.time??0;ask.shownPhase=(drawn?.time??0)/Math.max(1e-6,drawn?.getClip().duration??1);
    ask.elapsed=this.state.actionTime*this.state.actionDuration;ask.formBody=this.awakenedForm?.group.visible?this.awakenedForm:undefined;
    ask.head=this.headBone;ask.rightHand=this.rightBone;
    return placeSocket(kind,ask,out);
  }
  /** Where a charge gathers (its socket declaration's `charge`), else in the right hand. */
  chargePosition(out:THREE.Vector3):THREE.Vector3{return this.socket('charge',out)?out:out.copy(this.handR);}
  /** Where this fighter's blow actually is: where its socket declaration puts it, else the tip of the blade its rig
   *  holds if there is one, the hand if not. */
  strikePoint(out:THREE.Vector3):THREE.Vector3{
    if(this.socket('strike',out))return out;
    if(this.rightReach&&this.rightBone)return out.copy(this.rightReach).applyMatrix4(this.rightBone.matrixWorld);
    return out.copy(this.handR);
  }
  /** True when the strike point is a weapon rather than a fist. */
  get armed(){return !FIGHTER_SOCKETS[this.state.fighter]?.unarmed&&!!this.rightReach;}
  /** Where a melee contact lands (its socket declaration's `contact`); false where it declares none, and the caller
   *  places the contact itself. Taisei's hand bone is his fist now, so the general path serves him (a striking surface
   *  measured off the Oup77 mesh had it half a metre off the end of his arm). */
  meleeContactPoint(index:number,out:THREE.Vector3){return this.socket('contact',out,index);}
  dispose(){
    Fighter.drawn.delete(this);
    this.ragdoll?.dispose();this.ragdoll=undefined;
    this.awakenedForm?.dispose();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.group.removeFromParent();
    disposeSkeletons(this.model);
    for(const m of this.outlineMaterials)m.dispose();
    const shadow=this.group.getObjectByName('contact-shadow') as THREE.Mesh<THREE.CircleGeometry,THREE.MeshBasicMaterial>;
    shadow.geometry.dispose();shadow.material.dispose();
  }
}
